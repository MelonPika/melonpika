import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { palette as p, languageColor } from './generate-profile.mjs';
import { boundSnake } from './bounded-snake.mjs';

const replacements = { '#444444': p.muted, ...Object.fromEntries([
  ['Python', ['#3572a5', '#ffe9a3']], ['JavaScript', ['#f1e05a', '#ffd166']],
  ['TypeScript', ['#3178c6', '#b9edf2']], ['Vue', ['#41b883', '#c5e8c5']],
  ['HTML', ['#e34c26', '#ffaec5']], ['CSS', ['#563d7c', '#bbe8f2']]
].flatMap(([name, colors]) => colors.map(color => [color, languageColor(name)]))) };

export function styleSnake(source) {
  source = boundSnake(source);
  const variables = { cb: p.border, cs: p.primary, ce: p.surface, c0: p.surface, c1: p.contributionLow, c2: p.contributionMid, c3: p.secondary, c4: p.primary };
  for (const [name, color] of Object.entries(variables)) {
    const pattern = new RegExp(`(--${name}\\s*:)\\s*[^;}]+`, 'g');
    if (!pattern.test(source)) throw new Error(`Snake SVG is missing --${name}`);
    source = source.replace(pattern, `$1${color}`);
  }
  const box = source.match(/\bviewBox="([^"]+)"/)?.[1].trim().split(/\s+/).map(Number);
  if (!box || box.length !== 4 || box.some(n => !Number.isFinite(n))) throw new Error('Snake SVG has an invalid viewBox');
  const [x, y, width, height] = box;
  source = source.replace(/<rect\b[^>]*\bid="cozy-background"[^>]*\/>/g, '');
  return source.replace(/<svg\b[^>]*>/, tag => `${tag}<rect id="cozy-background" x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${p.background}"/>`);
}

export function style3D(source) {
  // Change only color declarations: preserve the real calendar, radar, pie, and animations.
  const rule = (selector, property, value) => {
    const pattern = new RegExp(`(\\.${selector}\\s*\\{[^}]*?\\b${property}\\s*:\\s*)[^;}]+`, 'g');
    if (!pattern.test(source)) throw new Error(`3D SVG is missing .${selector} ${property}`);
    source = source.replace(pattern, `$1${value}`);
  };
  for (const [name, color] of Object.entries({ fg: p.text, bg: p.background, weak: p.muted })) {
    rule(`fill-${name}`, 'fill', color);
    rule(`stroke-${name}`, 'stroke', color);
  }
  rule('fill-strong', 'fill', p.primary);
  rule('radar', 'fill', p.secondary);
  rule('radar', 'stroke', p.secondary);
  const shade = (color, darker) => {
    const rgb = color.slice(1).match(/../g).map(hex => Math.round(parseInt(hex, 16) * .7 ** darker));
    return `rgb(${rgb.join(', ')})`;
  };
  [p.surface, p.contributionLow, p.contributionMid, p.secondary, p.primary].forEach((color, i) => {
    for (const [face, darker] of [['top', 0], ['left', .5], ['right', 1]]) rule(`cont-${face}-${i}`, 'fill', shade(color, darker));
  });
  return source.replace(/#[\da-f]{6}\b/gi, color => replacements[color.toLowerCase()] || color);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snake = process.argv.includes('--snake');
  for (const file of process.argv.slice(2).filter(arg => arg !== '--snake')) {
    const source = await readFile(file, 'utf8');
    if (!source.includes('<svg') || !source.includes('</svg>')) throw new Error(`Invalid generated SVG: ${file}`);
    await writeFile(file, snake ? styleSnake(source) : style3D(source));
  }
}
