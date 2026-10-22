import { mkdir, writeFile } from 'node:fs/promises';
import { escape, svg, root } from './generate-profile.mjs';
import path from 'node:path';

// Original vector artwork. No image or source code from the reference is reused.
export async function renderStatic(name = 'MelonPika') {
  const dir = path.join(root, 'assets/profile');
  await mkdir(dir, { recursive: true });
  const gradient = '<defs><linearGradient id="pastel"><stop stop-color="#ffaec5"/><stop offset=".35" stop-color="#d7c4f3"/><stop offset=".7" stop-color="#ffe9a3"/><stop offset="1" stop-color="#b9edf2"/></linearGradient></defs>';
  const sparkles = [[64, 43], [168, 90], [265, 30], [854, 44], [957, 86], [1020, 28]].map(([x, y], i) => `<path d="M${x} ${y - 6}l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#fff" opacity=".7"><animate attributeName="opacity" values=".25;.9;.25" dur="${2.5 + i / 4}s" repeatCount="indefinite"/></path>`).join('');
  await writeFile(path.join(dir, 'header.svg'), svg(1100, 180, `${name}'s profile header`, `${gradient}<path d="M0 0H1100V128C984 179 879 92 733 124S466 180 310 130 113 177 0 123Z" fill="url(#pastel)"/>${sparkles}<text x="550" y="87" text-anchor="middle" fill="#3b2d4f" font-family="Verdana,Arial,sans-serif" font-size="48" font-weight="700">${escape(name)}</text>`));
  await writeFile(path.join(dir, 'footer.svg'), svg(1100, 110, 'Pastel waving footer', `${gradient}<path d="M0 35C147 88 246 5 390 37S629 83 771 35 986 80 1100 30V110H0Z" fill="url(#pastel)"/>`));
  for (const dark of [false, true]) {
    const lines = [`Hi, I'm ${name}`, 'A cozy corner for code & curiosity', 'Small steps, pastel skies & little experiments'];
    const width = lines.map(line => [...line].length * 13.2);
    const body = `<style>@keyframes reveal{0%,4%{width:0}67%,88%{width:var(--line-width)}99%,100%{width:0}}@keyframes cursor{0%,4%{transform:translateX(0)}67%,88%{transform:translateX(var(--line-width))}99%,100%{transform:translateX(0)}}@keyframes line{0%,33.2%{opacity:1}33.34%,100%{opacity:0}}@keyframes blink{50%{opacity:0}}.line{opacity:0;animation:line 15.6s linear infinite}.reveal{animation:reveal 5.2s steps(40,end) infinite}.cursor{animation:cursor 5.2s steps(40,end) infinite}.caret{animation:blink .8s step-end infinite}@media(prefers-reduced-motion:reduce){.line,.reveal,.cursor,.caret{animation:none}.line:first-of-type{opacity:1}.reveal{width:var(--line-width)}.cursor{display:none}}</style>` + lines.map((line, i) => `<defs><clipPath id="clip-${i}"><rect class="reveal" x="${380 - width[i] / 2}" y="8" width="${width[i]}" height="42" style="--line-width:${width[i]}px"/></clipPath></defs><g class="line" style="animation-delay:${i * 5.2}s"><g clip-path="url(#clip-${i})"><text x="380" y="37" text-anchor="middle" textLength="${width[i]}" lengthAdjust="spacingAndGlyphs" font-family="Fira Code,Consolas,Liberation Mono,monospace" font-size="22" fill="${dark ? '#ffaec5' : '#615276'}">${escape(line)}</text></g><g class="cursor" style="--line-width:${width[i]}px"><text class="caret" x="${380 - width[i] / 2}" y="37" font-family="monospace" font-size="22" fill="${dark ? '#ffaec5' : '#615276'}">▏</text></g></g>`).join('');
    await writeFile(path.join(dir, `typing-${dark ? 'dark' : 'light'}.svg`), svg(760, 60, `Animated introduction: ${name}`, body, lines.join('. ') + '. Three typing lines with a 1.2-second pause; reduced-motion support.'));
  }
  await writeFile(path.join(dir, 'melon-fox.svg'), svg(280, 280, 'A pastel moon fox with melon headphones and a little laptop', `
    <defs><radialGradient id="glow"><stop stop-color="#fff4d2"/><stop offset="1" stop-color="#f5e9fa" stop-opacity="0"/></radialGradient><linearGradient id="fur" x2="0" y2="1"><stop stop-color="#ffe4d0"/><stop offset="1" stop-color="#ffc6b6"/></linearGradient></defs>
    <circle cx="140" cy="136" r="126" fill="url(#glow)"/>
    <g fill="#d7c4f3"><path d="M224 24a21 21 0 1 0 24 30 21 21 0 0 1-24-30Z"/><path d="m49 48 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="m241 117 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/></g>
    <g fill="#ffe9a3"><circle cx="76" cy="29" r="3"/><circle cx="226" cy="79" r="3"/><path d="m32 160 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
    <ellipse cx="142" cy="251" rx="103" ry="12" fill="#d7c4f3" opacity=".35"/>
    <path d="M195 232c70 0 65-66 40-81 4 29-22 27-44 38Z" fill="url(#fur)" stroke="#eab4ad" stroke-width="2"/><path d="M235 151c2 19-7 23-16 28 6 12 17 14 28 10 4-15-2-29-12-38Z" fill="#fff6e9"/>
    <ellipse cx="140" cy="201" rx="64" ry="49" fill="url(#fur)"/>
    <path d="M78 107 68 44q34 8 47 40M165 83q22-33 49-39l-11 64" fill="url(#fur)" stroke="#eab4ad" stroke-width="2"/><path d="m79 61 6 38 18-14Zm120 0-25 24 18 14Z" fill="#f0b2c9"/>
    <ellipse cx="140" cy="129" rx="72" ry="60" fill="url(#fur)" stroke="#eab4ad" stroke-width="2"/>
    <path d="M73 133c20 6 24 22 43 9q24 38 48 0c20 13 26-3 44-9-1 35-27 55-68 55s-65-20-67-55Z" fill="#fff7ec"/>
    <path d="M107 127q8-8 15 0m37 0q8-8 15 0" fill="none" stroke="#615276" stroke-width="3" stroke-linecap="round"/>
    <path d="m135 140 5 4 5-4Zm5 4v6m-9 0q9 9 18 0" fill="none" stroke="#615276" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="99" cy="141" rx="11" ry="6" fill="#ffaec5" opacity=".7"/><ellipse cx="181" cy="141" rx="11" ry="6" fill="#ffaec5" opacity=".7"/>
    <path d="M72 122v-13a68 68 0 0 1 136 0v13" fill="none" stroke="#a8cdb6" stroke-width="9"/>
    <rect x="62" y="112" width="19" height="33" rx="9" fill="#bfe5c9" stroke="#8cbb9c" stroke-width="2"/><rect x="199" y="112" width="19" height="33" rx="9" fill="#bfe5c9" stroke="#8cbb9c" stroke-width="2"/>
    <path d="M129 73q-3-17 13-22-4 13-13 22Z" fill="#a4ccae"/>
    <path d="M92 194h101l-9 54H101Z" fill="#d7c4f3" stroke="#aa94c1" stroke-width="2"/>
    <path d="M88 248h110v5H88Z" fill="#b8a4cf"/>
    <circle cx="143" cy="221" r="12" fill="#c4e5c8"/><path d="m135 216 16 10m-11-15 6 21m-16-10 25-3" stroke="#96bf9c" stroke-width="1.2"/><path d="m146 206 3-5" stroke="#96bf9c" stroke-width="2"/>
    <ellipse cx="93" cy="205" rx="13" ry="10" fill="#ffe1cf"/><ellipse cx="191" cy="205" rx="13" ry="10" fill="#ffe1cf"/>
    <g fill="#ffaec5"><circle cx="40" cy="207" r="3"/><circle cx="243" cy="222" r="3"/></g>`));
  await writeFile(path.join(dir, 'badge-placeholder.svg'), svg(96, 96, 'Placeholder for a future verified learning badge', `<path d="m30 62-5 28 23-12 23 12-5-28" fill="#d7c4f3" opacity=".55"/><path d="m48 7 9 7 12 1 4 12 8 9-4 12 1 12-11 5-8 9-11-4-11 4-8-9-11-5 1-12-4-12 8-9 4-12 12-1Z" fill="#f5eaf3" stroke="#d7c4f3" stroke-width="2"/><circle cx="48" cy="41" r="21" fill="none" stroke="#d7c4f3" stroke-dasharray="3 3"/><path d="M48 30v22M37 41h22" stroke="#b89fcf" stroke-width="3" stroke-linecap="round"/>`));
  console.log('Rendered original header, typing animation, melon fox, footer, and badge placeholder.');
}
if (process.argv[1]?.endsWith('static-assets.mjs')) await renderStatic();
