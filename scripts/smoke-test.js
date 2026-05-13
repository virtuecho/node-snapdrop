const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function requestHome(port) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        path: '/',
        port,
        timeout: 1000,
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );

    request.once('error', reject);
    request.once('timeout', () => {
      request.destroy(new Error('HTTP request timed out.'));
    });
  });
}

async function waitForHealthyServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const statusCode = await requestHome(port);
      if (statusCode >= 200 && statusCode < 400) {
        return statusCode;
      }
      lastError = new Error(`Unexpected HTTP status ${statusCode}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw lastError || new Error('Server did not become healthy in time.');
}

async function main() {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
    const statusCode = await waitForHealthyServer(port, 5000);
    console.log(`Smoke test passed: GET / returned ${statusCode}.`);
  } catch (error) {
    console.error('Smoke test failed.');
    if (output.trim()) {
      console.error(output.trim());
    }
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
