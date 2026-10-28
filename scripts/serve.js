import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(root + sep) && path !== resolve(root, 'index.html')) { response.writeHead(403).end(); return; }
    if (!['.html', '.js', '.css', '.svg'].includes(extname(path)) || !['GET', 'HEAD'].includes(request.method)) { response.writeHead(404).end(); return; }
    const file = await readFile(path); response.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-cache' }); response.end(request.method === 'HEAD' ? undefined : file);
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Job Application Checklist: http://127.0.0.1:${server.address().port}`));
