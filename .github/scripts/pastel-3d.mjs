import { readFile, writeFile } from 'node:fs/promises';

const replacements = { '#3572a5': '#ffe9a3', '#f1e05a': '#ffd166', '#3178c6': '#b9edf2', '#41b883': '#c5e8c5', '#e34c26': '#ffaec5', '#563d7c': '#bbe8f2' };
for (const file of process.argv.slice(2)) {
  const source = await readFile(file, 'utf8');
  if (!source.includes('<svg') || !source.includes('</svg>')) throw new Error(`Invalid generated SVG: ${file}`);
  await writeFile(file, source.replace(/#[\da-f]{6}\b/gi, color => replacements[color.toLowerCase()] || color));
}
