const http = require('http');
const { spawn } = require('child_process');

const PORT = 4010;
const ADMIN_TOKEN = process.env.ADMIN_AGENT_TOKEN;
const COMPOSE_FILE = '/workspace/docker-compose.yml';

if (!ADMIN_TOKEN) {
  console.error('ADMIN_AGENT_TOKEN is required');
  process.exit(1);
}

/**
 * Verify admin token from request headers
 */
function verifyToken(req, res) {
  const token = req.headers['x-admin-token'];
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
function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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
async function handleUpdateStream(req, res) {
  if (!verifyToken(req, res)) return;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  try {
    sendSSE(res, { type: 'log', text: '==> Starting update process\n' });

    // Step 1: Pull latest images
    sendSSE(res, { type: 'log', text: '==> Pulling latest images\n' });
    await executeCommand('docker', ['compose', '-f', COMPOSE_FILE, 'pull'], res);

    sendSSE(res, { type: 'log', text: '\n==> Updating services\n' });

    // Step 2: Update services
    await executeCommand('docker', [
      'compose',
      '-f',
      COMPOSE_FILE,
      'up',
      '-d',
      '--remove-orphans'
    ], res);

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
  if (!verifyToken(req, res)) return;

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
  if (!verifyToken(req, res)) return;

  try {
    // Wait a few seconds for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get service status
    const getStatus = () => new Promise((resolve, reject) => {
      const proc = spawn('docker', [
        'compose',
        '-f',
        COMPOSE_FILE,
        'ps',
        '--format',
        'json'
      ]);

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

  if (req.method === 'GET' && url.pathname === '/update/stream') {
    handleUpdateStream(req, res);
  } else if (req.method === 'GET' && url.pathname === '/version') {
    handleVersion(req, res);
  } else if (req.method === 'GET' && url.pathname === '/health') {
    handleHealth(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Admin agent listening on port ${PORT}`);
});
