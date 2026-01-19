const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const crypto = require('crypto');

// NOTE: this process runs *inside* the admin-agent container
const PORT = 4010;
const ADMIN_TOKEN = process.env.ADMIN_AGENT_TOKEN;
const COMPOSE_FILE = '/workspace/docker-compose.yml';
const UPDATE_LOCK_FILE = '/tmp/hailmary-update.lock';
const LAST_GOOD_FILE = '/tmp/hailmary-last-good.json';
const UPDATE_LOG_DIR = '/tmp';
const UPDATE_RING_BUFFER_SIZE = 2000;

// IMPORTANT:
// Inside the container our working dir is /workspace, so docker compose otherwise
// defaults the project name to "workspace" which does NOT match the host stack.
// That mismatch triggers network/volume warnings and can cause container name collisions
// (especially because we use explicit container_name in docker-compose.yml).
const COMPOSE_PROJECT_NAME =
  process.env.COMPOSE_PROJECT_NAME ||
  process.env.COMPOSE_PROJECT ||
  process.env.PROJECT_NAME ||
  'hail-mary';

/**
 * Services that are safe to "pull" from a registry.
 * (Exclude build-from-source/local-only images like hailmary-admin-agent.)
 *
 * IMPORTANT:
 * - Keep this list aligned with docker-compose.yml service names.
 * - If you add a new GHCR-backed service, add it here too.
 */
const PULLABLE_SERVICES = ['hailmary-api', 'hailmary-assistant', 'hailmary-pwa', 'hailmary-migrator', 'hailmary-postgres'];

/**
 * Runtime services we recreate during an update.
 * IMPORTANT: do NOT include:
 * - hailmary-admin-agent (self, would kill the update stream)
 * - hailmary-postgres (database, causes needless disruption)
 * - hailmary-migrator (run as one-shot job instead)
 */
const RUNTIME_SERVICES = [
  'hailmary-api',
  'hailmary-assistant',
  'hailmary-pwa',
];

/**
 * Build docker compose command arguments with project name
 */
function dockerComposeArgs(extraArgs) {
  return ['compose', '-p', COMPOSE_PROJECT_NAME, '-f', COMPOSE_FILE, ...extraArgs];
}

if (!ADMIN_TOKEN) {
  console.error('ADMIN_AGENT_TOKEN is required');
  process.exit(1);
}

/**
 * Verify admin token from request headers
 */
function getAuthToken(req, url) {
  const headerToken = req.headers['x-admin-token'];
  if (headerToken) {
    return headerToken;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  return url.searchParams.get('token') || '';
}

function verifyToken(req, res, url) {
  const token = getAuthToken(req, url);
  if (!token || token !== ADMIN_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  return true;
}

/**
 * Send SSE event
 */
function sendSSE(res, data, event) {
  if (event) {
    res.write(`event: ${event}\n`);
  }
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Pull only services that are safe to pull.
 * (Local-only images like hailmary-admin-agent must NOT be pulled.)
 *
 * This intentionally trades "generic" for "reliable": the agent controls
 * the update flow for *this* stack, and these services are known-pullable.
 */
async function pullLatestImages(res) {
  sendSSE(res, {
    type: 'log',
    text: `==> Pulling latest images (registry services only): ${PULLABLE_SERVICES.join(', ')}\n`
  });

  // docker compose pull <svc...>
  await executeCommand(
    'docker',
    dockerComposeArgs(['pull', ...PULLABLE_SERVICES]),
    res
  );
}

function createRingBuffer(maxSize) {
  const buffer = [];
  return {
    push(item) {
      buffer.push(item);
      if (buffer.length > maxSize) {
        buffer.splice(0, buffer.length - maxSize);
      }
    },
    getAll() {
      return [...buffer];
    },
  };
}

const updates = new Map();

function appendUpdateLine(update, text) {
  const ts = new Date().toISOString();
  const line = { ts, text };
  update.buffer.push(line);
  update.emitter.emit('line', line);
  if (update.logStream) {
    update.logStream.write(`${ts} ${text}\n`);
  }
}

function buildUpdateStatus(update) {
  return {
    updateId: update.updateId,
    state: update.state,
    exitCode: update.exitCode,
    startedAt: update.startedAt,
    finishedAt: update.finishedAt,
    lines: update.buffer.getAll(),
  };
}

async function recordLastGood(updateId) {
  try {
    const proc = spawn('bash', ['-lc', 'cd ~/Hail-Mary && git rev-parse HEAD'], {
      env: process.env,
    });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Failed to read git revision'));
        }
      });
      proc.on('error', reject);
    });

    const payload = {
      updateId,
      gitSha: output.trim(),
      recordedAt: new Date().toISOString(),
    };
    await fsPromises.writeFile(LAST_GOOD_FILE, JSON.stringify(payload, null, 2));
  } catch (error) {
    console.warn('Failed to record last-known-good metadata:', error.message);
  }
}

async function startSafeUpdate() {
  const updateId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const logPath = path.join(UPDATE_LOG_DIR, `hailmary-update-${updateId}.log`);

  const update = {
    updateId,
    startedAt,
    finishedAt: null,
    state: 'running',
    exitCode: null,
    emitter: new EventEmitter(),
    buffer: createRingBuffer(UPDATE_RING_BUFFER_SIZE),
    logStream: fs.createWriteStream(logPath, { flags: 'a' }),
  };

  updates.set(updateId, update);
  await fsPromises.writeFile(UPDATE_LOCK_FILE, updateId);
  await recordLastGood(updateId);

  const proc = spawn('bash', ['-lc', 'cd ~/Hail-Mary && ./scripts/safe-update.sh'], {
    env: process.env,
  });
  update.pid = proc.pid;

  const createLineHandler = () => {
    let buffer = '';
    return {
      onData(data) {
        buffer += data.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          appendUpdateLine(update, line);
        }
      },
      flush() {
        if (buffer) {
          appendUpdateLine(update, buffer);
          buffer = '';
        }
      },
    };
  };

  const stdoutHandler = createLineHandler();
  const stderrHandler = createLineHandler();

  proc.stdout.on('data', stdoutHandler.onData);
  proc.stderr.on('data', stderrHandler.onData);

  proc.on('close', async (code) => {
    stdoutHandler.flush();
    stderrHandler.flush();
    update.exitCode = code;
    update.finishedAt = new Date().toISOString();
    update.state = code === 0 ? 'success' : 'failed';
    update.emitter.emit('status', {
      state: update.state,
      exitCode: update.exitCode,
    });
    update.logStream.end();
    try {
      await fsPromises.unlink(UPDATE_LOCK_FILE);
    } catch (error) {
      console.warn('Failed to remove update lock file:', error.message);
    }
  });

  proc.on('error', async (error) => {
    appendUpdateLine(update, `ERROR: ${error.message}`);
    update.exitCode = 1;
    update.finishedAt = new Date().toISOString();
    update.state = 'failed';
    update.emitter.emit('status', {
      state: update.state,
      exitCode: update.exitCode,
    });
    update.logStream.end();
    try {
      await fsPromises.unlink(UPDATE_LOCK_FILE);
    } catch (err) {
      console.warn('Failed to remove update lock file:', err.message);
    }
  });

  return update;
}

async function handleUpdateStart(req, res, url) {
  if (!verifyToken(req, res, url)) return;

  try {
    const existingLock = await fsPromises.readFile(UPDATE_LOCK_FILE, 'utf8').catch(() => null);
    if (existingLock) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Update already running',
        updateId: existingLock.trim(),
      }));
      return;
    }

    const update = await startSafeUpdate();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      updateId: update.updateId,
      startedAt: update.startedAt,
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

async function handleUpdateStream(req, res, url) {
  if (!verifyToken(req, res, url)) return;

  const updateId = url.searchParams.get('updateId');
  if (!updateId || !updates.has(updateId)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Update not found' }));
    return;
  }

  const update = updates.get(updateId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  sendSSE(res, {
    updateId: update.updateId,
    startedAt: update.startedAt,
    pid: update.pid,
  }, 'meta');

  sendSSE(res, {
    state: update.state,
    exitCode: update.exitCode,
  }, 'status');

  update.buffer.getAll().forEach((line) => {
    sendSSE(res, line, 'line');
  });

  const onLine = (line) => sendSSE(res, line, 'line');
  const onStatus = (status) => sendSSE(res, status, 'status');

  update.emitter.on('line', onLine);
  update.emitter.on('status', onStatus);

  req.on('close', () => {
    update.emitter.off('line', onLine);
    update.emitter.off('status', onStatus);
  });
}

async function handleUpdateStatus(req, res, url) {
  if (!verifyToken(req, res, url)) return;

  const updateId = url.searchParams.get('updateId');
  const update = updateId ? updates.get(updateId) : null;
  if (!update) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Update not found' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(buildUpdateStatus(update)));
}

async function handleUpdateLog(req, res, url) {
  if (!verifyToken(req, res, url)) return;

  const updateId = url.searchParams.get('updateId');
  if (!updateId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'updateId is required' }));
    return;
  }

  const logPath = path.join(UPDATE_LOG_DIR, `hailmary-update-${updateId}.log`);
  try {
    await fsPromises.access(logPath);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    fs.createReadStream(logPath).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Log not found' }));
  }
}

/**
 * Execute shell command and stream output via SSE
 */
function executeCommand(command, args, res) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: '/workspace',
      env: process.env
    });

    let hasError = false;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      sendSSE(res, { type: 'log', text });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      sendSSE(res, { type: 'log', text });
    });

    proc.on('error', (error) => {
      hasError = true;
      sendSSE(res, { type: 'error', message: error.message });
      reject(error);
    });

    proc.on('close', (code) => {
      if (code !== 0 && !hasError) {
        hasError = true;
        sendSSE(res, { type: 'error', message: `Command exited with code ${code}` });
        reject(new Error(`Command exited with code ${code}`));
      } else if (!hasError) {
        resolve();
      }
    });
  });
}

/**
 * GET /update/stream - Stream update process via SSE
 */
async function handleLegacyUpdateStream(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!verifyToken(req, res, url)) return;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    sendSSE(res, { type: 'log', text: '==> Starting update process\n' });

    // Step 1: Pull latest images (registry services only, skip local builds)
    await pullLatestImages(res);

    sendSSE(res, { type: 'log', text: '\n==> Running database migrations\n' });

    // Step 2: Ensure postgres is up (DON'T recreate it, just ensure it's running)
    await executeCommand('docker', dockerComposeArgs([
      'up',
      '-d',
      '--no-recreate',
      'hailmary-postgres'
    ]), res);

    // Step 3: Run migrator as a one-shot job (clean + repeatable)
    // Use --no-deps to avoid starting postgres again (already running from step 2)
    await executeCommand('docker', dockerComposeArgs([
      'run',
      '--rm',
      '--no-deps',
      'hailmary-migrator'
    ]), res);

    sendSSE(res, { type: 'log', text: '\n==> Updating runtime services\n' });

    // Step 4: Recreate only runtime services (api/assistant/pwa)
    // Use --no-deps to avoid restarting postgres or admin-agent
    // Use --force-recreate to ensure fresh containers even if config unchanged
    await executeCommand('docker', dockerComposeArgs([
      'up',
      '-d',
      '--no-deps',
      '--force-recreate',
      ...RUNTIME_SERVICES
    ]), res);

    sendSSE(res, { type: 'log', text: '\n==> Update completed successfully\n' });
    sendSSE(res, { type: 'complete', success: true });
  } catch (error) {
    sendSSE(res, { type: 'error', message: error.message });
    sendSSE(res, { type: 'complete', success: false });
  }

  res.end();
}

/**
 * GET /version - Check for available updates
 */
async function handleVersion(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!verifyToken(req, res, url)) return;

  try {
    const services = ['hailmary-api', 'hailmary-assistant', 'hailmary-pwa'];
    const updates = [];

    for (const service of services) {
      // Get current running container image digest
      const getCurrentDigest = () => new Promise((resolve, reject) => {
        const proc = spawn('docker', [
          'inspect',
          `hailmary-${service.replace('hailmary-', '')}`,
          '--format',
          '{{.Image}}'
        ]);

        let output = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Failed to get current digest for ${service}`));
          }
        });
      });

      // Pull latest image quietly
      const pullLatest = () => new Promise((resolve, reject) => {
        const imageName = service === 'hailmary-api' || service === 'hailmary-assistant'
          ? `ghcr.io/martinbibb-cmd/hail-mary-${service.replace('hailmary-', '')}:latest`
          : `ghcr.io/martinbibb-cmd/hail-mary-pwa:latest`;

        const proc = spawn('docker', ['pull', '-q', imageName]);
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Failed to pull latest for ${service}`));
          }
        });
      });

      // Get latest image digest
      const getLatestDigest = (imageName) => new Promise((resolve, reject) => {
        const proc = spawn('docker', [
          'inspect',
          imageName,
          '--format',
          '{{.Id}}'
        ]);

        let output = '';
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.on('close', (code) => {
          if (code === 0) {
            resolve(output.trim());
          } else {
            reject(new Error(`Failed to get latest digest for ${service}`));
          }
        });
      });

      try {
        const currentDigest = await getCurrentDigest();
        await pullLatest();

        const imageName = service === 'hailmary-api' || service === 'hailmary-assistant'
          ? `ghcr.io/martinbibb-cmd/hail-mary-${service.replace('hailmary-', '')}:latest`
          : `ghcr.io/martinbibb-cmd/hail-mary-pwa:latest`;

        const latestDigest = await getLatestDigest(imageName);

        if (currentDigest !== latestDigest) {
          updates.push({
            service,
            updateAvailable: true,
            currentDigest: currentDigest.substring(0, 12),
            latestDigest: latestDigest.substring(0, 12)
          });
        } else {
          updates.push({
            service,
            updateAvailable: false,
            currentDigest: currentDigest.substring(0, 12)
          });
        }
      } catch (error) {
        updates.push({
          service,
          error: error.message
        });
      }
    }

    const hasUpdates = updates.some(u => u.updateAvailable);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasUpdates,
      services: updates,
      checkedAt: new Date().toISOString()
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/**
 * GET /health - Check service health after update
 */
async function handleHealth(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (!verifyToken(req, res, url)) return;

  try {
    // Wait a few seconds for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get service status
    const getStatus = () => new Promise((resolve, reject) => {
      const proc = spawn('docker', dockerComposeArgs([
        'ps',
        '--format',
        'json'
      ]));

      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error('Failed to get service status'));
        }
      });
    });

    const statusOutput = await getStatus();
    const services = statusOutput
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(s => s !== null);

    const serviceHealth = services.map(s => ({
      name: s.Service || s.Name,
      state: s.State || s.Status,
      healthy: (s.State || s.Status || '').toLowerCase().includes('running')
    }));

    const allHealthy = serviceHealth.every(s => s.healthy);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      healthy: allHealthy,
      services: serviceHealth,
      checkedAt: new Date().toISOString()
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === '/ops/update') {
    return handleUpdateStart(req, res, url);
  }

  if (req.method === 'GET' && url.pathname === '/ops/update/stream') {
    return handleUpdateStream(req, res, url);
  }

  if (req.method === 'GET' && url.pathname === '/ops/update/status') {
    return handleUpdateStatus(req, res, url);
  }

  if (req.method === 'GET' && url.pathname === '/ops/update/log') {
    return handleUpdateLog(req, res, url);
  }

  // Friendly alias: /update behaves like /update/stream
  if (req.method === 'GET' && url.pathname === '/update') {
    return handleLegacyUpdateStream(req, res);
  }

  if (req.method === 'GET' && url.pathname === '/update/stream') {
    return handleLegacyUpdateStream(req, res);
  } else if (req.method === 'GET' && url.pathname === '/version') {
    return handleVersion(req, res);
  } else if (req.method === 'GET' && url.pathname === '/health') {
    return handleHealth(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Admin agent listening on port ${PORT}`);
});
