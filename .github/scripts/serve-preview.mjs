import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { root } from './generate-profile.mjs';

const portIndex = process.argv.indexOf('--port');
const port = portIndex === -1 ? 4173 : Number(process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port followed by a port number from 1 to 65535.');
const css = await readFile(path.join(root, 'node_modules/github-markdown-css/github-markdown.css'), 'utf8');
const assets = path.join(root, 'assets/profile');
const documents = new Map([
  ['/', 'README.md'], ['/profile', 'README.md'],
  ['/.github/SETUP.md', '.github/SETUP.md'],
  ['/.github/THIRD_PARTY_NOTICES.md', '.github/THIRD_PARTY_NOTICES.md']
]);

async function render(file) {
  const markdown = await readFile(path.join(root, file), 'utf8');
  const html = marked.parse(markdown, { gfm: true });
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MelonPika · README preview</title><link rel="icon" href="data:,">
<style>${css}
body{margin:0;background:#fff}article{box-sizing:border-box;max-width:894px;margin:24px auto;padding:32px;border:1px solid #d1d9e0;border-radius:6px}
@media(prefers-color-scheme:dark){body{background:#0d1117}article{border-color:#30363d}}
@media(max-width:600px){article{margin:0;padding:16px;border:0;border-radius:0}}
</style></head><body><article class="markdown-body">${html}</article></body></html>`;
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let content;
    if (documents.has(pathname)) {
      content = await render(documents.get(pathname));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (pathname.startsWith('/assets/profile/')) {
      const file = path.resolve(assets, pathname.slice('/assets/profile/'.length));
      const relative = path.relative(assets, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(404); return res.end('Not found'); }
      content = await readFile(file);
      res.setHeader('Content-Type', file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream');
    } else { res.writeHead(404); return res.end('Not found'); }
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : error instanceof URIError ? 400 : 500;
    res.writeHead(status); res.end(status === 404 ? 'Not found' : 'Unable to render preview');
    if (status === 500) console.error(error.message);
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Choose another with npm run preview -- --port ${port + 1}` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`README preview: http://127.0.0.1:${port}`);
  console.log('Refresh your browser after saving README.md. Press Ctrl+C to stop.');
  console.log('This preview renders locally and does not call the GitHub API.');
});
