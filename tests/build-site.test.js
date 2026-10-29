import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, access } from 'node:fs/promises';

test('site package includes offline assets but excludes repository and test files', async () => {
  execFileSync(process.execPath, ['scripts/build-site.js'], { cwd: new URL('../', import.meta.url) });
  const root = new URL('../.site/', import.meta.url);
  assert.deepEqual((await readdir(root)).sort(), ['.nojekyll', 'icon.svg', 'index.html', 'src', 'sw.js', 'vendor']);
  const worker = await readFile(new URL('sw.js', root), 'utf8');
  const paths = [...worker.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]);
  for (const path of paths) await access(new URL(path, root));
  for (const path of ['.git', '.github', 'tests', 'docs', 'package.json', 'AGENTS.md']) {
    await assert.rejects(access(new URL(path, root)), { code: 'ENOENT' });
  }
  assert.match(await readFile(new URL('index.html', root), 'utf8'), /src="\.\/src\/app.js"/);
});
