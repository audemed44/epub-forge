import { spawn } from 'node:child_process';
import path from 'node:path';

const port = Number(process.env.SMOKE_PORT || 4317);
const baseUrl = `http://127.0.0.1:${port}`;
const smokeDataRoot = path.join(process.cwd(), '.tmp', 'smoke-data');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }
    await sleep(300);
  }
  throw new Error('Server did not become ready in time');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const server = spawn('node', ['apps/api/src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      ONE_PORT_DEV: '0',
      DATA_ROOT: smokeDataRoot,
      EPUB_OUTPUT_DIR: path.join(smokeDataRoot, 'epubs'),
      BOOKDROP_DIR: path.join(smokeDataRoot, 'bookdrop'),
      CONFIG_DIR: path.join(smokeDataRoot, 'config'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer();

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    assert(healthResponse.ok, 'health endpoint failed');
    const health = await healthResponse.json();
    assert(health.ok === true, 'health.ok not true');
    assert(Array.isArray(health.parsers), 'health.parsers is not an array');

    const rootResponse = await fetch(`${baseUrl}/`);
    assert(rootResponse.ok, 'root route failed');
    const rootHtml = await rootResponse.text();
    assert(rootHtml.includes('id="root"') || rootHtml.includes('WebToEpub Server'), 'root HTML missing expected marker');

    const listResponse = await fetch(`${baseUrl}/api/build-jobs`);
    assert(listResponse.ok, 'build-jobs list failed');
    const listPayload = await listResponse.json();
    assert(Array.isArray(listPayload.jobs), 'build-jobs payload missing jobs array');

    const badJobResponse = await fetch(`${baseUrl}/api/build-jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(badJobResponse.status === 400, `expected 400 for invalid build job payload, got ${badJobResponse.status}`);

    console.log('Smoke checks passed');
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      server.once('exit', () => resolve());
      setTimeout(() => resolve(), 1500);
    });

    if (stderr.trim().length > 0) {
      console.error('[smoke] server stderr output:');
      console.error(stderr.trim());
    }
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
