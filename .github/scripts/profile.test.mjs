import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escape, parseStats, parseLanguages, validateStreak, parseCalendar, replaceSection, wrap } from './generate-profile.mjs';

test('untrusted public repository descriptions cannot inject SVG or HTML', () => {
  assert.equal(escape('<script x="y">&\'hello'), '&lt;script x=&quot;y&quot;&gt;&amp;&apos;hello');
});
test('failed service cards are rejected instead of becoming profile statistics', () => {
  assert.throws(() => parseStats('<svg><text>Rate limit exceeded</text></svg>'), /missing/);
  assert.throws(() => parseLanguages('<svg><text>No languages found</text></svg>'), /Incomplete/);
  assert.throws(() => parseLanguages('<text data-testid="lang-name">Python 140%</text>'), /Incomplete/);
});
test('full integer statistics are parsed without inventing values', () => {
  const values = { stars: 0, commits: 13, prs: 0, issues: 0, contribs: 1, 'level-rank-icon': 'C' };
  const source = '<svg>' + Object.entries(values).map(([key, v]) => `<text data-testid="${key}">${v}</text>`).join('') + '</svg>';
  assert.deepEqual(parseStats(source), { stars: 0, commits: 13, prs: 0, issues: 0, contribs: 1, rank: 'C', rankProgress: null });
  const ringSource = source + '@keyframes rankAnimation { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 75; } }';
  assert.equal(parseStats(ringSource).rankProgress, .25);
  assert.throws(() => parseStats(ringSource.replace('75;', '150;')), /invalid rank progress/);
});
test('streak validation rejects invalid counts and date order', () => {
  const valid = { mode: 'daily', totalContributions: 35, currentStreak: { length: 1, start: '2026-10-22', end: '2026-10-22' }, longestStreak: { length: 2, start: '2026-04-29', end: '2026-04-30' } };
  assert.equal(validateStreak(valid), valid);
  assert.throws(() => validateStreak({ ...valid, currentStreak: { length: -1 } }), /Invalid/);
  assert.throws(() => validateStreak({ ...valid, longestStreak: { length: 2, start: '2026-05-01', end: '2026-04-30' } }), /dates/);
});
test('calendar parser correlates dates with tooltip counts, including zero days', () => {
  const html = Array.from({ length: 365 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 9, 23 + i)).toISOString().slice(0, 10);
    return `<td data-date="${date}" id="day-${i}" data-level="${i === 364 ? 4 : 0}"></td><tool-tip for="day-${i}">${i === 364 ? '17 contributions' : 'No contributions'} on a day.</tool-tip>`;
  }).join('');
  const days = parseCalendar(html);
  assert.equal(days.length, 365);
  assert.equal(days.at(-1).count, 17);
  assert.equal(days[0].count, 0);
  assert.throws(() => parseCalendar(html.replace('17 contributions', 'data unavailable')), /Invalid calendar/);
  assert.throws(() => parseCalendar('<html>Rate limit exceeded</html>'), /Incomplete/);
});
test('README updates preserve user text outside a unique managed region', () => {
  const readme = 'Keep my intro\n<!-- BEGIN featured -->old<!-- END featured -->\nKeep my footer';
  const updated = replaceSection(readme, 'featured', 'new');
  assert.equal(updated, 'Keep my intro\n<!-- BEGIN featured -->\nnew\n<!-- END featured -->\nKeep my footer');
  assert.throws(() => replaceSection(readme + '<!-- BEGIN featured -->', 'featured', 'new'), /Invalid README/);
});
test('wide CJK repository descriptions stay within three readable card lines', () => {
  const lines = wrap('这是一个很长的公开项目介绍。'.repeat(15));
  assert.equal(lines.length, 3);
  assert(lines.at(-1).endsWith('…'));
  assert(lines.every(line => [...line].length <= 29));
});
test('saved assets originate from the configured public account', async () => {
  const data = JSON.parse(await readFile(new URL('../../assets/profile/public-data.json', import.meta.url), 'utf8'));
  const config = JSON.parse(await readFile(new URL('../profile.json', import.meta.url), 'utf8'));
  assert.equal(data.username, 'MelonPika');
  assert(data.calendar.length >= 350);
  for (const name of config.featured) {
    const repo = data.repositories.find(r => r.name === name);
    assert(repo, `Missing public project ${name}`);
    assert(repo.url.startsWith('https://github.com/MelonPika/'));
  }
});
