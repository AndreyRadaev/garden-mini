import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const example = { updatedAt: '2026-11-04T10:00:00.000Z', points: { sverdlova: { name: 'Свердлова', month: { revenue: 123 } } } };
const server = createServer((req, res) => {
  if (req.url === '/api/login' && req.method === 'POST') {
    res.setHeader('Set-Cookie', 'garden_session=test; HttpOnly; Path=/');
    res.setHeader('Content-Type', 'application/json');
    return res.end('{"ok":true}');
  }
  if (req.url === '/api/compact' && req.headers.cookie === 'garden_session=test') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(example));
  }
  res.statusCode = 401; res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const child = spawn(process.execPath, [join(root, 'scripts', 'build-snapshot.mjs')], {
    cwd: root,
    env: { ...process.env, DASHBOARD_ORIGIN: `http://127.0.0.1:${server.address().port}`, DASHBOARD_LOGIN: 'test', DASHBOARD_PASSWORD: 'test', SNAPSHOT_PASSPHRASE: 'test-only-long-passphrase' },
    stdio: 'pipe'
  });
  const exit = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  assert.equal(exit, 0, 'snapshot build failed');
  const encrypted = JSON.parse(await readFile(join(root, 'dist', 'data', 'current.enc.json'), 'utf8'));
  assert.equal(encrypted.version, 1);
  assert.equal(JSON.stringify(encrypted).includes('Свердлова'), false);
  const pass = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('test-only-long-passphrase'), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(encrypted.salt, 'base64'), iterations: encrypted.iterations, hash: 'SHA-256' }, pass, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const clear = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(encrypted.iv, 'base64') }, key, Buffer.from(encrypted.data, 'base64'));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(clear)), example);
  console.log('Snapshot encryption and decryption passed');
} finally { server.close(); }

