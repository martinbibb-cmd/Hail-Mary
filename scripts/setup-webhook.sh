#!/bin/bash
# ==============================================================================
# Hail-Mary Webhook Listener Setup
# ==============================================================================
# This script sets up a simple webhook listener that receives GitHub push
# events and triggers a deployment.
#
# Usage:
#   ./setup-webhook.sh
#
# Prerequisites:
#   - Node.js installed
#   - Set WEBHOOK_SECRET environment variable
#   - Configure GitHub webhook to point to your NAS endpoint
# ==============================================================================

set -e

DEPLOY_DIR="${DEPLOY_DIR:-/opt/hail-mary}"
WEBHOOK_PORT="${WEBHOOK_PORT:-9000}"
WEBHOOK_DIR="$DEPLOY_DIR/webhook"

echo "=========================================="
echo "Hail-Mary Webhook Setup"
echo "=========================================="

# Create webhook directory
mkdir -p "$WEBHOOK_DIR"

# Create webhook listener script
cat > "$WEBHOOK_DIR/webhook-server.js" << 'SCRIPT'
const http = require('http');
const crypto = require('crypto');
const { execSync, exec } = require('child_process');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET;
const DEPLOY_DIR = process.env.DEPLOY_DIR || '/opt/hail-mary';
const DEPLOY_SCRIPT = `${DEPLOY_DIR}/scripts/nas-deploy.sh`;

if (!SECRET) {
  console.error('ERROR: WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

function verifySignature(payload, signature) {
  if (!signature) return false;
  const sig = `sha256=${crypto.createHmac('sha256', SECRET).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sig));
}

function triggerDeploy(branch) {
  console.log(`[${new Date().toISOString()}] Triggering deployment for branch: ${branch}`);
  
  exec(DEPLOY_SCRIPT, (error, stdout, stderr) => {
    if (error) {
      console.error(`Deployment error: ${error.message}`);
      return;
    }
    if (stdout) console.log(`Deployment output: ${stdout}`);
    if (stderr) console.error(`Deployment stderr: ${stderr}`);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  if (req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'];
    
    if (!verifySignature(body, signature)) {
      console.error(`[${new Date().toISOString()}] Invalid signature`);
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    try {
      const payload = JSON.parse(body);
      const event = req.headers['x-github-event'];
      
      console.log(`[${new Date().toISOString()}] Received ${event} event`);
      
      if (event === 'push') {
        const branch = payload.ref?.replace('refs/heads/', '');
        
        // Only deploy for main or staging branches
        if (branch === 'main' || branch === 'staging') {
          res.writeHead(200);
          res.end('Deployment triggered');
          triggerDeploy(branch);
        } else {
          res.writeHead(200);
          res.end(`Ignored push to branch: ${branch}`);
        }
      } else if (event === 'workflow_run') {
        // Deploy when CI workflow completes successfully
        if (payload.action === 'completed' && payload.workflow_run?.conclusion === 'success') {
          res.writeHead(200);
          res.end('Deployment triggered after successful CI');
          triggerDeploy(payload.workflow_run.head_branch);
        } else {
          res.writeHead(200);
          res.end('Workflow not completed successfully');
        }
      } else if (event === 'ping') {
        res.writeHead(200);
        res.end('Pong');
      } else {
        res.writeHead(200);
        res.end(`Event ${event} ignored`);
      }
    } catch (error) {
      console.error(`Error processing webhook: ${error.message}`);
      res.writeHead(400);
      res.end('Bad Request');
    }
  });
});

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Webhook server listening on port ${PORT}`);
  console.log(`Webhook endpoint: http://your-nas-ip:${PORT}/webhook`);
});
SCRIPT

# Create systemd service file
cat > "$WEBHOOK_DIR/hailmary-webhook.service" << SERVICE
[Unit]
Description=Hail-Mary GitHub Webhook Listener
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$WEBHOOK_DIR
Environment=DEPLOY_DIR=$DEPLOY_DIR
Environment=WEBHOOK_PORT=$WEBHOOK_PORT
Environment=WEBHOOK_SECRET=CHANGE_THIS_SECRET_BEFORE_USE
ExecStart=/usr/bin/node $WEBHOOK_DIR/webhook-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

echo ""
echo "Webhook files created:"
echo "  - $WEBHOOK_DIR/webhook-server.js"
echo "  - $WEBHOOK_DIR/hailmary-webhook.service"
echo ""
echo "To install the webhook service:"
echo ""
echo "  1. Copy the service file:"
echo "     sudo cp $WEBHOOK_DIR/hailmary-webhook.service /etc/systemd/system/"
echo ""
echo "  2. Edit the service file and set your WEBHOOK_SECRET:"
echo "     sudo nano /etc/systemd/system/hailmary-webhook.service"
echo ""
echo "  3. Enable and start the service:"
echo "     sudo systemctl daemon-reload"
echo "     sudo systemctl enable hailmary-webhook"
echo "     sudo systemctl start hailmary-webhook"
echo ""
echo "  4. Configure GitHub webhook:"
echo "     - Go to your repository Settings > Webhooks"
echo "     - Add webhook URL: http://your-nas-ip:$WEBHOOK_PORT/webhook"
echo "     - Set Content type: application/json"
echo "     - Set Secret: (same as WEBHOOK_SECRET in service file)"
echo "     - Select events: 'Push' and/or 'Workflow runs'"
echo ""
echo "  5. (Optional) Set up TLS with a reverse proxy (nginx/Caddy)"
echo "     or use Cloudflare Tunnel for secure external access"
