import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { root } from './generate-profile.mjs';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';

// Bootstrap uses the generators' actual renderers with the saved public calendar.
// It never impersonates a successful GraphQL response or needs a personal token.
const versions = {
  snk: { repository: 'Platane/snk', commit: 'd8f6715049803e982ee5ff501b6b9b7d5deeb09b' },
  three: { repository: 'yoshi389111/github-profile-3d-contrib', commit: 'e235d118909be71eb7edb05482a3de4e76156df3' }
};
async function source(name: keyof typeof versions) {
  const spec = versions[name], dir = path.join(root, '.cache/vendor', name === 'three' ? '3d' : name);
  try { await access(path.join(dir, '.source-commit')); if ((await readFile(path.join(dir, '.source-commit'), 'utf8')) === spec.commit) return dir; } catch { /* download first use */ }
  await mkdir(dir, { recursive: true });
  const response = await fetch(`https://codeload.github.com/${spec.repository}/tar.gz/${spec.commit}`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Cannot download ${spec.repository}: ${response.status}`);
  const archive = path.join(root, '.cache', `${name}.tar.gz`);
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xf', archive, '--strip-components=1', '-C', dir], { stdio: 'pipe' });
  await writeFile(path.join(dir, '.source-commit'), spec.commit);
  return dir;
}
const data = JSON.parse(await readFile(path.join(root, 'assets/profile/public-data.json'), 'utf8'));
const output = path.join(root, 'assets/profile');
const snk = await source('snk');
const load = (file: string) => import(pathToFileURL(file).href);
const [{ cellsToGrid }, { getBestRoute }, { getPathToPose }, { snake4 }, { createSvg }] = await Promise.all([
  load(path.join(snk, 'packages/generate-snake-animation/cellsToGrid.ts')),
  load(path.join(snk, 'packages/solver/getBestRoute.ts')),
  load(path.join(snk, 'packages/solver/getPathToPose.ts')),
  load(path.join(snk, 'packages/types/__fixtures__/snake.ts')),
  load(path.join(snk, 'packages/svg-creator/index.ts'))
]);
const first = new Date(data.calendar[0].date + 'T00:00:00Z');
const origin = first.getTime() - first.getUTCDay() * 86400000;
const cells = data.calendar.map((d: { date: string; count: number; level: number }) => {
  const day = new Date(d.date + 'T00:00:00Z');
  return { ...d, x: Math.floor((day.getTime() - origin) / 604800000), y: day.getUTCDay() };
});
const grid = cellsToGrid(cells), chain = getBestRoute(grid, snake4);
chain.push(...getPathToPose(chain.at(-1), snake4));
for (const dark of [false, true]) {
  const draw = { colorDots: { 1: '#b9edf2', 2: '#d7c4f3', 3: '#ffd3b0', 4: '#ffaec5' }, colorEmpty: dark ? '#373341' : '#eee9f4', colorSnake: '#ffaec5', colorDotBorder: 'transparent', sizeCell: 16, sizeDot: 12, sizeDotBorderRadius: 2 };
  await writeFile(path.join(output, dark ? 'github-snake-dark.svg' : 'github-snake.svg'), createSvg(grid, cells, chain, draw, { stepDurationMs: 100 }));
}
console.log(`Platane/snk generated both animated SVGs from ${cells.length} real public contribution days.`);
const three = await source('three');
const [{ create3DContrib }, { createCssColors }] = await Promise.all([
  load(path.join(three, 'src/create-3d-contrib.ts')), load(path.join(three, 'src/create-css-colors.ts'))
]);
const settings = JSON.parse(await readFile(path.join(root, '.github/profile-3d-settings.json'), 'utf8'));
for (const setting of settings) {
  const dom = new JSDOM('<!doctype html><body><div id="chart"></div></body>');
  const container = d3.select(dom.window.document).select('#chart');
  const chart = container.append('svg').attr('xmlns', 'http://www.w3.org/2000/svg').attr('width', 1280).attr('height', 850).attr('viewBox', '0 0 1280 850').attr('role', 'img');
  chart.append('title').text(`${data.username}'s real public contribution calendar`);
  chart.append('desc').text('Generated with the official github-profile-3d-contrib calendar renderer. Contribution-type breakdown and commit-language pie will be added by the first authenticated GitHub Actions run.');
  chart.append('style').html(`text{font-family:Arial,sans-serif}${createCssColors(setting)}`);
  create3DContrib(chart, { contributionCalendar: data.calendar.map((d: any) => ({ date: new Date(d.date + 'T00:00:00Z'), contributionCount: d.count, contributionLevel: d.level })) }, 0, 0, 1280, 850, setting, false);
  chart.append('text').attr('x', 60).attr('y', 70).attr('fill', setting.strongColor).attr('font-size', 30).attr('font-weight', 700).text(data.username);
  chart.append('text').attr('x', 1260).attr('y', 32).attr('fill', setting.foregroundColor).attr('text-anchor', 'end').attr('font-size', 16).text(`${data.calendar[0].date} / ${data.calendar.at(-1).date}`);
  chart.append('text').attr('x', 760).attr('y', 170).attr('fill', setting.strongColor).attr('font-size', 20).text('Contribution breakdown');
  chart.append('text').attr('x', 760).attr('y', 205).attr('fill', setting.foregroundColor).attr('font-size', 16).text('[Added after the first Actions run]');
  chart.append('text').attr('x', 760).attr('y', 232).attr('fill', setting.weakColor).attr('font-size', 14).text('The calendar below already uses real public data.');
  chart.append('text').attr('x', 60).attr('y', 625).attr('fill', setting.strongColor).attr('font-size', 20).text('Public repository languages');
  const pie = d3.pie<any>().value(d => d.percent)(data.languages);
  const arc = d3.arc<any>().innerRadius(36).outerRadius(68);
  const pieGroup = chart.append('g').attr('transform', 'translate(133,720)');
  pieGroup.selectAll('path').data(pie).join('path').attr('d', arc).attr('fill', (_, i) => ['#ffe9a3', '#b9edf2', '#d7c4f3'][i % 3]);
  data.languages.forEach((l: any, i: number) => chart.append('text').attr('x', 225).attr('y', 704 + i * 24).attr('fill', setting.foregroundColor).attr('font-size', 18).text(`${l.name} ${l.percent}%`));
  chart.append('text').attr('x', 384).attr('y', 830).attr('fill', setting.strongColor).attr('text-anchor', 'end').attr('font-size', 32).attr('font-weight', 700).text(data.calendar.reduce((sum: number, d: any) => sum + d.count, 0));
  chart.append('text').attr('x', 395).attr('y', 830).attr('fill', setting.foregroundColor).attr('font-size', 24).text('contributions · last year');
  await writeFile(path.join(output, setting.fileName), container.html() + '\n');
}
await writeFile(path.join(output, 'contribution-provenance.json'), JSON.stringify({
  username: data.username, calendarSource: data.sources.calendar, fetchedAt: data.fetchedAt,
  days: data.calendar.length, totalContributions: data.calendar.reduce((sum: number, d: any) => sum + d.count, 0),
  snake: versions.snk, threeDimensionalCalendar: versions.three,
  note: 'Initial calendars generated locally from public HTML. Full contribution-category radar and commit-language pie require the first profile-3d workflow run with its built-in GITHUB_TOKEN.'
}, null, 2) + '\n');
console.log('Official 3D renderer generated animated light/dark calendars; unverified breakdown is explicitly marked.');
