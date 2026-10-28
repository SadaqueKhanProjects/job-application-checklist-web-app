import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('preview serves every app asset with its correct content type', async () => {
  const server = spawn(process.execPath, ['scripts/serve.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '0' } });
  try {
    const output = await Promise.race([once(server.stdout, 'data'), once(server, 'exit').then(() => { throw new Error('Server exited before readiness'); })]);
    const origin = output[0].toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    for (const [path, type] of [['/', 'text/html'], ['/src/styles.css', 'text/css'], ['/src/app.js', 'text/javascript'], ['/src/domain.js', 'text/javascript'], ['/sw.js', 'text/javascript'], ['/icon.svg', 'image/svg+xml']]) {
      const response = await fetch(origin + path); assert.equal(response.status, 200, path); assert.ok(response.headers.get('content-type').startsWith(type)); assert.ok((await response.text()).length > 20);
    }
    const model = await fetch(origin + '/vendor/ocr/lang/eng.traineddata.gz');
    assert.equal(model.status, 200);
    assert.equal(model.headers.get('content-type'), 'application/gzip');
    assert.ok((await model.arrayBuffer()).byteLength > 1000);
    const worker = await fetch(origin + '/vendor/ocr/worker.min.js');
    assert.equal(worker.status, 200);
    assert.ok(worker.headers.get('content-type').startsWith('text/javascript'));
    assert.equal((await fetch(origin + '/package.json')).status, 404);
    assert.equal((await fetch(origin + '/missing.js')).status, 404);
  } finally { server.kill(); await once(server, 'exit'); }
});
