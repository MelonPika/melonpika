import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { root } from './generate-profile.mjs';

const document = new JSDOM(await readFile(path.join(root, 'README.md'), 'utf8')).window.document;
const queue = [...new Set([...document.querySelectorAll('a[href^="https://"]')].map(a => a.href))];
const results = [];
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'MelonPika-profile-validator' }, signal: AbortSignal.timeout(20000) });
        result = { url, status: response.status, finalUrl: response.url };
        if (response.ok) break;
      } catch (error) { result = { url, error: error.message }; }
    }
    results.push(result);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));
await mkdir(path.join(root, '.cache'), { recursive: true });
await writeFile(path.join(root, '.cache/link-validation.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
if (results.some(r => !r.status || r.status < 200 || r.status >= 400)) process.exitCode = 1;
