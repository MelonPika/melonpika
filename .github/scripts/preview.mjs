import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { JSDOM } from 'jsdom';
import { root } from './generate-profile.mjs';

const cache = path.join(root, '.cache');
await mkdir(cache, { recursive: true });
const css = await readFile(path.join(root, 'node_modules/github-markdown-css/github-markdown.css'), 'utf8');
async function renderMarkdown(directory, reference = false) {
  const markdown = await readFile(path.join(directory, 'README.md'), 'utf8');
  const response = await fetch('https://api.github.com/markdown', {
    method: 'POST', headers: { 'User-Agent': 'MelonPika-profile-preview', 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: markdown, mode: 'gfm' }), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`GitHub Markdown renderer returned HTTP ${response.status}`);
  const html = await response.text();
  await writeFile(path.join(cache, reference ? 'reference-github-render.html' : 'profile-github-render.html'), html);
  const document = new JSDOM(html).window.document;
  for (const element of document.querySelectorAll('img,source')) {
    const attr = element.tagName === 'SOURCE' ? 'srcset' : 'src';
    const value = element.getAttribute('data-canonical-src') || element.getAttribute(attr);
    if (!value) continue;
    if (!/^https?:/.test(value)) element.setAttribute(attr, `/${reference ? 'reference/' : ''}${value}`);
    else if (value.includes('raw.githubusercontent.com/ShadowsLunarfox/ShadowsLunarfox/main/')) element.setAttribute(attr, '/reference/' + value.split('/main/')[1]);
  }
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}\nbody{margin:0;background:#fff}article{box-sizing:border-box;max-width:894px;margin:24px auto;padding:32px;border:1px solid #d1d9e0;border-radius:6px}@media(prefers-color-scheme:dark){body{background:#0d1117}article{border-color:#30363d}}@media(max-width:600px){article{margin:0;padding:16px;border:0;border-radius:0}}</style><article class="markdown-body">${document.body.innerHTML}</article></html>`;
}
const documents = new Map([['/profile', await renderMarkdown(root)]]);
try { await access(path.join(cache, 'reference/README.md')); documents.set('/reference', await renderMarkdown(path.join(cache, 'reference'), true)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (documents.has(url.pathname)) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(documents.get(url.pathname)); }
    if (!/^\/(?:assets\/profile\/|reference\/)/.test(url.pathname)) { res.writeHead(404); return res.end(); }
    const local = path.resolve(root, url.pathname.startsWith('/reference/') ? '.cache' + url.pathname : '.' + url.pathname);
    if (!local.startsWith(root)) throw new Error('Invalid asset path');
    res.setHeader('Content-Type', local.endsWith('.svg') ? 'image/svg+xml' : local.endsWith('.png') ? 'image/png' : 'application/octet-stream');
    res.end(await readFile(local));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const candidates = [process.env.PROFILE_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
let executablePath;
for (const file of candidates) { try { await access(file); executablePath = file; break; } catch { /* next browser */ } }
if (!executablePath) { server.close(); throw new Error('Set PROFILE_CHROME to your installed Chromium browser executable.'); }
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
try {
  for (const [name] of documents) for (const scheme of ['light', 'dark']) for (const mobile of [false, true]) {
    if (name === '/reference' && mobile) continue;
    const page = await browser.newPage({ viewport: { width: mobile ? 375 : 1280, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${port}${name}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(async () => { await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); });
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
      brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
      headings: [...document.querySelectorAll('h2')].map(h => h.textContent),
      overflowing: [...document.querySelectorAll('table,td,img')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ tag: e.tagName, source: e.getAttribute('src') }))
    }));
    const filename = `${name.slice(1)}-${mobile ? 'mobile' : 'desktop'}-${scheme}.png`;
    await page.screenshot({ path: path.join(cache, filename), fullPage: true });
    results.push({ file: filename, ...metrics });
    await page.close();
  }
  await writeFile(path.join(cache, 'visual-validation.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  if (results.some(r => r.file.startsWith('profile-') && (r.documentWidth > r.viewport || r.brokenImages.length))) process.exitCode = 1;
} finally { await browser.close(); server.close(); }
