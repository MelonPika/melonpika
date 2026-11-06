import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseLanguages } from './generate-profile.mjs';

test('the language service can report a valid empty result', () => {
  assert.deepEqual(parseLanguages('<svg><text class="stat bold">No languages data.</text></svg>'), []);
});

test('empty language results do not conceal service errors or invalid percentages', () => {
  for (const source of [
    '<svg><text>Rate limit exceeded</text></svg>',
    '<svg><text>Something went wrong</text></svg>',
    '<text data-testid="lang-name">Python 140%</text>',
    '<text data-testid="lang-name">Python 30%</text>'
  ]) assert.throws(() => parseLanguages(source));
  assert.deepEqual(parseLanguages('<text data-testid="lang-name">Python 70%</text><text data-testid="lang-name">TypeScript 30%</text>'), [
    { name: 'Python', percent: 70 }, { name: 'TypeScript', percent: 30 }
  ]);
});

const available = { name: 'Available', description: 'A public project', language: 'Python', fork: false, stars: 0, forks: 0, url: 'https://github.com/Example/Available' };
for (const populated of [false, true]) test(`profile refresh handles ${populated ? 'available and unavailable' : 'no'} public featured repositories`, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'melonpika-profile-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert(path.basename(directory).startsWith('melonpika-profile-'));
    await rm(directory, { recursive: true, force: true });
  });
  const scripts = path.join(directory, '.github/scripts');
  const assets = path.join(directory, 'assets/profile');
  await mkdir(scripts, { recursive: true });
  await mkdir(assets, { recursive: true });
  await copyFile(new URL('./generate-profile.mjs', import.meta.url), path.join(scripts, 'generate-profile.mjs'));
  await writeFile(path.join(directory, '.github/profile.json'), JSON.stringify({ username: 'Example', featured: ['Missing', 'Forked', 'available'] }));
  const emptyStreak = { length: 0 };
  const data = {
    username: 'Example', profile: { followers: 0, publicRepos: populated ? 2 : 0 },
    overview: { stars: 0, commits: 0, prs: 0, issues: 0, contribs: 0, rank: 'C', rankProgress: null },
    streak: { totalContributions: 0, currentStreak: emptyStreak, longestStreak: emptyStreak },
    languages: populated ? [{ name: 'Python', percent: 100 }] : [],
    repositories: populated ? [available, { ...available, name: 'Forked', fork: true }] : [],
    calendar: Array.from({ length: 31 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, i + 1)).toISOString().slice(0, 10), count: 0, level: 0 }))
  };
  await writeFile(path.join(assets, 'public-data.json'), JSON.stringify(data));
  const intro = '<img src="assets/profile/header.svg" alt="Custom banner" />\nKeep my introduction.\n';
  const footer = '\nKeep my footer.\n';
  await writeFile(path.join(directory, 'README.md'), intro + '<!-- BEGIN featured-repositories -->Old cards<!-- END featured-repositories -->' + footer);
  await writeFile(path.join(assets, 'header.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 1"/>');
  const header = await readFile(path.join(assets, 'header.svg'));
  const { stdout, stderr } = await promisify(execFile)(process.execPath, [path.join(scripts, 'generate-profile.mjs'), '--from-snapshot'], { cwd: directory });
  assert.match(stdout, new RegExp(`${populated ? 1 : 0} verified repositories`));
  assert.match(stderr, /Skipping unavailable public featured repository: Missing/);
  const readme = await readFile(path.join(directory, 'README.md'), 'utf8');
  assert(readme.startsWith(intro));
  assert(readme.endsWith(footer));
  assert(!readme.includes('Missing') && !readme.includes('Forked'));
  assert.deepEqual(await readFile(path.join(assets, 'header.svg')), header);
  assert.equal((await readdir(path.join(assets, 'repositories'))).length, populated ? 2 : 0);
  if (populated) assert.match(readme, /https:\/\/github.com\/Example\/Available/);
  else assert.match(readme, /No featured public repositories available right now/);
  for (const theme of ['light', 'dark']) {
    const svg = await readFile(path.join(assets, `languages-${theme}.svg`), 'utf8');
    assert(!/\b(?:NaN|Infinity|undefined)\b/.test(svg));
    assert.match(svg, populated ? /Python/ : /No language data in public original repositories yet/);
    if (!populated) assert(!svg.includes('%'));
  }
});
