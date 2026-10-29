import { cp, mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, '.site');
await rm(output, { recursive: true, force: true });
await mkdir(output);
// Publish only runtime assets and their bundled licence notices.
for (const path of ['index.html', 'icon.svg', 'sw.js', 'src', 'vendor/ocr']) {
  await cp(join(root, path), join(output, path), { recursive: true });
}
await writeFile(join(output, '.nojekyll'), '');
console.log(`Static site prepared in .site (${(await readdir(output)).length} top-level entries).`);
