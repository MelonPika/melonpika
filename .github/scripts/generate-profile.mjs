import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'assets/profile');
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export const palette = Object.freeze({
  background: '#0B0D12', surface: '#1B2029', primary: '#FDD879',
  secondary: '#B4F5FD', pink: '#FFB6C1', text: '#FDFBF6', muted: '#A9B0BC',
  border: '#303744', inset: '#11161E', contributionLow: '#37444B', contributionMid: '#6D929A'
});
export const languageColor = name => ({ Python: palette.primary, JavaScript: palette.text, TypeScript: palette.secondary, Vue: palette.contributionMid, HTML: palette.pink, CSS: palette.muted })[name] || palette.muted;
// Both image variants retain the requested dark artwork, even on GitHub's light page.
const theme = () => ({ ...palette, title: palette.primary, cyan: palette.secondary });
const text = (x, y, label, size = 14, fill = 'currentColor', attrs = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${attrs}>${escape(label)}</text>`;
const num = (x, y, value, fill, size = 34, attrs = '') => text(x, y, Number(value).toLocaleString('en-US'), size, fill, `font-family="Consolas,monospace" font-weight="700" ${attrs}`);
export function svg(width, height, title, body, description = title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description"><title id="title">${escape(title)}</title><desc id="description">${escape(description)}</desc>${body}</svg>\n`;
}
function card(title, eyebrow, height, dark, content, description) {
  const p = theme(dark);
  return svg(640, height, title, `<rect x=".5" y=".5" width="639" height="${height - 1}" rx="22" fill="${p.surface}" stroke="${p.border}"/><g font-family="Segoe UI,Arial,sans-serif" fill="${p.text}">${text(28, 32, eyebrow, 10, p.muted, 'letter-spacing="1.7" font-family="Consolas,monospace"')}${text(28, 69, title, 27, p.title, 'font-family="Georgia,serif" font-weight="700"')}<path d="M604 36 608 48 620 52 608 56 604 68 600 56 588 52 600 48Z" fill="${p.pink}" opacity=".8"/>${content(p)}</g>`, description);
}
export function parseStats(source) {
  const value = id => {
    const match = source.match(new RegExp(`data-testid=["']${id}["'][^>]*>([^<]+)<`));
    if (!match) throw new Error(`Statistics response missing ${id}`);
    return match[1].trim();
  };
  const result = Object.fromEntries(['stars', 'commits', 'prs', 'issues', 'contribs'].map(id => {
    const raw = value(id);
    if (!/^\d+$/.test(raw)) throw new Error(`Statistics response has an invalid ${id}`);
    return [id, Number(raw)];
  }));
  result.rank = value('level-rank-icon');
  if (!/^[SABC][+-]?$/.test(result.rank)) throw new Error('Statistics response has an invalid rank');
  const ring = source.match(/@keyframes\s+rankAnimation\s*\{\s*from\s*\{\s*stroke-dashoffset:\s*([\d.]+);\s*\}\s*to\s*\{\s*stroke-dashoffset:\s*([\d.]+);/);
  result.rankProgress = ring ? 1 - Number(ring[2]) / Number(ring[1]) : null;
  if (result.rankProgress !== null && (!Number.isFinite(result.rankProgress) || result.rankProgress < 0 || result.rankProgress > 1)) throw new Error('Statistics response has invalid rank progress');
  return result;
}
export function parseLanguages(source) {
  const result = [...source.matchAll(/data-testid=["']lang-name["'][^>]*>([^<]+)</g)].map(m => {
    const value = m[1].trim().match(/^(.+?)\s+(\d+(?:\.\d+)?)%$/);
    if (!value) throw new Error('Invalid language data');
    return { name: value[1].replaceAll('&amp;', '&'), percent: Number(value[2]) };
  });
  const total = result.reduce((n, l) => n + l.percent, 0);
  if (!result.length || total < 99 || total > 100.1 || result.some(l => l.percent < 0 || l.percent > 100)) throw new Error('Incomplete language data');
  return result;
}
export function validateStreak(data) {
  const validCount = n => Number.isSafeInteger(n) && n >= 0;
  if (data.mode !== 'daily' || !validCount(data.totalContributions)) throw new Error('Invalid streak data');
  for (const key of ['currentStreak', 'longestStreak']) {
    const s = data[key];
    if (!s || !validCount(s.length)) throw new Error(`Invalid ${key}`);
    if (s.length && (!/^\d{4}-\d{2}-\d{2}$/.test(s.start) || !/^\d{4}-\d{2}-\d{2}$/.test(s.end) || s.start > s.end || !Number.isFinite(Date.parse(s.end)))) throw new Error(`Invalid ${key} dates`);
  }
  return data;
}
export function parseCalendar(html) {
  const tips = new Map([...html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)].map(m => [m[1].match(/\bfor="([^"]+)"/)?.[1], m[2].trim()]));
  const days = [...html.matchAll(/<(?:td|rect)\b[^>]*\bdata-date="[^>]+>/g)].map(m => {
    const attr = key => m[0].match(new RegExp(`\\b${key}="([^"]+)"`))?.[1];
    const date = attr('data-date'), level = Number(attr('data-level'));
    const tip = tips.get(attr('id'));
    const count = tip?.startsWith('No contributions') ? 0 : Number(tip?.match(/^([\d,]+) contribution/)?.[1].replaceAll(',', ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(count) || count < 0 || !Number.isInteger(level) || level < 0 || level > 4) throw new Error(`Invalid calendar day ${date}`);
    return { date, count, level };
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 350 || new Set(days.map(d => d.date)).size !== days.length) throw new Error('Incomplete contribution calendar');
  return days;
}
export async function request(url, json = false) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = { 'User-Agent': 'MelonPika-profile', Accept: json ? 'application/vnd.github+json' : '*/*' };
      if (new URL(url).hostname === 'api.github.com' && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
      return json ? await response.json() : await response.text();
    } catch (error) { last = error; }
  }
  throw last;
}
async function fetchData(config) {
  const user = encodeURIComponent(config.username);
  const base = `https://github-readme-stats.shion.dev/api`;
  const sources = {
    profile: `https://api.github.com/users/${user}`,
    overview: `${base}?username=${user}&number_format=long&disable_animations=true&include_all_commits=false&count_private=false`,
    streak: `https://streak-stats.demolab.com/?user=${user}&type=json&mode=daily&timezone=${encodeURIComponent(config.timezone)}`,
    languages: `${base}/top-langs/?username=${user}&layout=compact&disable_animations=true`,
    calendar: `https://github.com/users/${user}/contributions`
  };
  const [profile, overview, streak, languages, calendar] = await Promise.all([
    request(sources.profile, true), request(sources.overview), request(sources.streak, true), request(sources.languages), request(sources.calendar)
  ]);
  const repositories = [];
  for (let page = 1; ; page++) {
    const batch = await request(`https://api.github.com/users/${user}/repos?type=owner&per_page=100&sort=full_name&page=${page}`, true);
    if (!Array.isArray(batch)) throw new Error('GitHub did not return repositories');
    repositories.push(...batch.filter(r => !r.private && r.owner.login.toLowerCase() === config.username.toLowerCase()).map(r => ({
      name: r.name, description: r.description, language: r.language, fork: r.fork, archived: r.archived, stars: r.stargazers_count, forks: r.forks_count, url: r.html_url, pushedAt: r.pushed_at
    })));
    if (batch.length < 100) break;
  }
  if (profile.login.toLowerCase() !== config.username.toLowerCase()) throw new Error('Unexpected GitHub account');
  return {
    username: config.username, fetchedAt: new Date().toISOString(), sources,
    profile: { login: profile.login, bio: profile.bio, location: profile.location, blog: profile.blog, followers: profile.followers, publicRepos: profile.public_repos, avatarUrl: profile.avatar_url },
    repositories, overview: parseStats(overview), streak: validateStreak(streak), languages: parseLanguages(languages), calendar: parseCalendar(calendar)
  };
}
const dateLabel = date => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z')) : '';
const range = s => s.length ? `${dateLabel(s.start)} – ${dateLabel(s.end)}` : 'No active streak';
function overviewCard(data, dark) {
  const s = data.overview;
  return card('GitHub Overview', 'LITTLE EXPERIMENTS, GROWING AT MY OWN PACE', 302, dark, p => [
    num(44, 139, s.stars, p.title), text(44, 163, 'Total Stars', 14, p.muted),
    num(246, 139, s.commits, p.cyan), text(246, 163, 'Commits · last year', 14, p.muted),
    `<path d="M44 181H410" stroke="${p.border}"/>`,
    ...[[44, s.prs, 'Pull requests'], [174, s.issues, 'Issues'], [304, s.contribs, 'Repos · last year']].flatMap(([x, n, label]) => [num(x, 216, n, p.text, 24), text(x, 239, label, 12, p.muted)]),
    `<circle cx="521" cy="161" r="52" fill="none" stroke="${p.border}" stroke-width="2"/>` + (s.rankProgress == null ? '' : `<circle cx="521" cy="161" r="52" fill="none" stroke="${p.cyan}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${104 * Math.PI}" stroke-dashoffset="${104 * Math.PI * (1 - s.rankProgress)}" transform="rotate(-90 521 161)"/>`),
    text(521, 175, s.rank, 38, p.text, 'text-anchor="middle" font-family="Consolas,monospace" font-weight="700"'), text(521, 239, 'GitHub Rank', 14, p.muted, 'text-anchor="middle"'),
    text(28, 284, 'A little curiosity goes a long way. (ᵔᴥᵔ)', 12, p.muted)
  ].join(''), `${data.username}: ${s.stars} stars, ${s.commits} commits in the last year, ${s.prs} PRs, ${s.issues} issues, ${s.contribs} contributed repositories in the last year. Rank ${s.rank}; ring progress from the statistics provider.`);
}
function streakCard(data, dark) {
  const s = data.streak;
  return card('Contribution Streak', 'ONE LITTLE STEP AT A TIME', 282, dark, p => `<rect x="228" y="94" width="184" height="146" rx="18" fill="${p.inset}" stroke="${p.border}"/>` + [
    [120, s.totalContributions, 'Total contributions', s.totalContributions ? `Since ${s.firstContribution}` : 'No contributions yet', p.cyan, 32],
    [320, s.currentStreak.length, 'Current streak', range(s.currentStreak), p.title, 48],
    [520, s.longestStreak.length, 'Longest streak', range(s.longestStreak), p.text, 32]
  ].map(([x, n, label, dates, color, size]) => num(x, 157, n, color, size, 'text-anchor="middle"') + text(x, 188, label, 14, p.text, 'text-anchor="middle"') + text(x, 214, dates, 11, p.muted, 'text-anchor="middle"')).join('') + text(28, 264, 'Every small contribution counts. (ง •̀_•́)ง', 12, p.muted), `${s.totalContributions} lifetime contributions; current streak ${s.currentStreak.length} days (${range(s.currentStreak)}); longest streak ${s.longestStreak.length} days (${range(s.longestStreak)}). Timezone: Asia/Singapore.`);
}
function languagesCard(data, dark) {
  const ls = data.languages, h = 194 + Math.ceil(ls.length / 2) * 40;
  return card('Most Used Languages', 'THE LANGUAGES IN MY ORIGINAL REPOSITORIES', h, dark, p => {
    let offset = 28;
    const bars = ls.map(l => {
      const width = 584 * l.percent / 100, x = offset; offset += width;
      return `<rect x="${x}" y="142" width="${width}" height="12" fill="${languageColor(l.name)}"/>`;
    }).join('');
    return text(28, 119, ls[0].name, 18, p.text, 'font-weight="600"') + text(612, 119, `${ls[0].percent}%`, 29, p.title, 'text-anchor="end" font-family="Consolas,monospace" font-weight="700"') + `<defs><clipPath id="bar"><rect x="28" y="142" width="584" height="12" rx="6"/></clipPath></defs><g clip-path="url(#bar)">${bars}</g>` + ls.map((l, i) => {
      const x = 28 + i % 2 * 304, y = 199 + Math.floor(i / 2) * 40;
      return `<circle cx="${x + 5}" cy="${y - 5}" r="5" fill="${languageColor(l.name)}"/>` + text(x + 20, y, l.name, 14, p.text) + text(x + 276, y, `${l.percent}%`, 13, p.muted, 'text-anchor="end"') + `<rect x="${x}" y="${y + 12}" width="${276 * l.percent / 100}" height="3" rx="1.5" fill="${languageColor(l.name)}"/>`;
    }).join('');
  }, ls.map(l => `${l.name}: ${l.percent}%`).join('; ') + '. Repository language data; forks excluded by the statistics provider.');
}
export function wrap(value, width = 56, maxLines = 3) {
  const units = Array.from(String(value || 'Description not provided.'));
  const lines = [];
  let line = '', used = 0;
  for (const c of units) {
    const cost = /[^\x00-\x7f]/.test(c) ? 2 : 1;
    if (used + cost > width) { lines.push(line.trim()); line = ''; used = 0; }
    line += c; used += cost;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.length > maxLines ? [...lines.slice(0, maxLines - 1), lines[maxLines - 1].slice(0, -1) + '…'] : lines;
}
function repositoryCard(repo, dark) {
  const p = theme(dark);
  return svg(560, 200, repo.name, `<rect x="8.5" y="8.5" width="543" height="183" rx="16" fill="${p.surface}" stroke="${p.border}"/><g font-family="Segoe UI,Arial,sans-serif">` + text(28, 46, repo.name.length > 38 ? repo.name.slice(0, 37) + '…' : repo.name, 18, p.title, 'font-weight="600"') + `<rect x="${repo.fork ? 452 : 478}" y="28" width="${repo.fork ? 80 : 54}" height="23" rx="11.5" fill="none" stroke="${p.border}"/>` + text(repo.fork ? 492 : 505, 44, repo.fork ? 'Public fork' : 'Public', 12, p.muted, 'text-anchor="middle"') + wrap(repo.description).map((line, i) => text(28, 81 + i * 22, line, 16, p.muted)).join('') + `<circle cx="35" cy="166" r="7" fill="${languageColor(repo.language)}"/>` + text(48, 171, repo.language || 'Language not reported', 14, p.muted) + text(355, 171, `☆ ${repo.stars}   ⑂ ${repo.forks}`, 14, p.muted) + '</g>', `${repo.url}. ${repo.fork ? 'Forked repository. ' : ''}${repo.description || 'Description not provided.'}`);
}
function activityCard(data, dark) {
  const p = theme(dark), days = data.calendar.slice(-31), max = Math.max(1, ...days.map(d => d.count));
  const points = days.map((d, i) => [65 + i * 29, 240 - d.count / max * 150]);
  return svg(1000, 300, 'Activity over the last 31 days', `<rect x=".5" y=".5" width="999" height="299" rx="22" fill="${p.surface}" stroke="${p.border}"/><g font-family="Segoe UI,Arial,sans-serif">${text(500, 36, 'Activity over the last 31 days', 22, p.title, 'text-anchor="middle" font-weight="600"')}` + Array.from({ length: 5 }, (_, i) => `<path d="M65 ${90 + i * 37.5}H935" stroke="${p.border}" stroke-dasharray="3 5"/>${text(50, 95 + i * 37.5, (max * (4 - i) / 4).toFixed(max > 3 ? 0 : 2), 11, p.muted, 'text-anchor="end"')}`).join('') + `<path d="M65 240L${points.map(v => v.join(' ')).join('L')}L935 240Z" fill="${p.cyan}" opacity=".08"/><polyline points="${points.map(v => v.join(',')).join(' ')}" fill="none" stroke="${p.title}" stroke-width="2.5"/>` + points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${p.cyan}"><title>${days[i].date}: ${days[i].count} contributions</title></circle>`).join('') + days.filter((_, i) => i % 5 === 0).map(d => text(65 + days.indexOf(d) * 29, 267, dateLabel(d.date), 12, p.muted, 'text-anchor="middle"')).join('') + '</g>', `${data.username}'s public contribution counts, ${days[0].date} to ${days.at(-1).date}. ` + days.map(d => `${d.date}: ${d.count}`).join('; '));
}
function badge(label, value, color) {
  const left = Math.ceil(label.length * 6.1 + 12), right = Math.ceil(value.length * 6.1 + 12);
  return svg(left + right, 20, `${label}: ${value}`, `<clipPath id="badge"><rect width="${left + right}" height="20" rx="3"/></clipPath><g clip-path="url(#badge)"><path d="M0 0h${left}v20H0Z" fill="${palette.surface}"/><path d="M${left} 0h${right}v20H${left}Z" fill="${color}"/></g><g text-anchor="middle" font-family="Verdana,Arial,sans-serif" font-size="11">${text(left / 2, 14, label, 11, palette.text)}${text(left + right / 2, 14, value, 11, palette.background)}</g>`);
}
export function replaceSection(readme, marker, content) {
  const begin = `<!-- BEGIN ${marker} -->`, end = `<!-- END ${marker} -->`;
  if (readme.split(begin).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(end) < readme.indexOf(begin)) throw new Error(`Invalid README markers: ${marker}`);
  return readme.slice(0, readme.indexOf(begin) + begin.length) + '\n' + content.trim() + '\n' + readme.slice(readme.indexOf(end));
}
const picture = (name, alt, width = '100%') => `    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/profile/${name}-dark.svg" />
      <img src="assets/profile/${name}-light.svg" alt="${escape(alt)}" width="${width}" />
    </picture>`;
async function render(data, config) {
  if (data.username !== config.username) throw new Error('Snapshot belongs to another account');
  await mkdir(path.join(out, 'repositories'), { recursive: true });
  const files = new Map();
  for (const dark of [false, true]) {
    const suffix = dark ? 'dark' : 'light';
    files.set(`stats-overview-${suffix}.svg`, overviewCard(data, dark));
    files.set(`stats-streak-${suffix}.svg`, streakCard(data, dark));
    files.set(`languages-${suffix}.svg`, languagesCard(data, dark));
    files.set(dark ? 'activity.svg' : 'activity-light.svg', activityCard(data, dark));
  }
  files.set('followers.svg', badge('Followers', String(data.profile.followers), palette.secondary));
  files.set('stars.svg', badge('GitHub stars', String(data.overview.stars), palette.primary));
  files.set('repositories.svg', badge('Public repos', String(data.profile.publicRepos), palette.primary));
  const selected = config.featured.map(name => {
    const repo = data.repositories.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (!repo) throw new Error(`Featured repository is missing or private: ${name}`);
    return repo;
  }).filter(repo => repo.fork === false);
  let featured = '<h2>✨ <samp>Featured Repositories (ง •̀_•́)ง</samp></h2>\n';
  selected.forEach((repo, i) => {
    const name = `repositories/repo-${i + 1}`;
    for (const dark of [false, true]) files.set(`${name}-${dark ? 'dark' : 'light'}.svg`, repositoryCard(repo, dark));
    if (i % 2 === 0) featured += '\n<p align="left">\n';
    featured += `  <a href="${escape(repo.url)}">\n${picture(name, `${repo.name}${repo.fork ? ' (public fork)' : ''}: ${repo.description || 'Description not provided.'}`, '405')}\n  </a>\n`;
    if (i % 2 === 1 || i === selected.length - 1) featured += '</p>\n';
  });
  let readme = await readFile(path.join(root, 'README.md'), 'utf8');
  readme = replaceSection(readme, 'featured-repositories', featured);
  // Finish all rendering and marker validation before writing any generated file.
  for (const [name, content] of files) await writeFile(path.join(out, name), content);
  await writeFile(path.join(root, 'README.md'), readme);
  console.log(`Rendered ${files.size} profile SVGs for ${config.username}; ${selected.length} verified repositories.`);
}
export async function main() {
  const config = JSON.parse(await readFile(path.join(root, '.github/profile.json'), 'utf8'));
  const snapshot = path.join(out, 'public-data.json');
  const data = process.argv.includes('--from-snapshot') ? JSON.parse(await readFile(snapshot, 'utf8')) : await fetchData(config);
  await render(data, config);
  if (!process.argv.includes('--from-snapshot')) await writeFile(snapshot, JSON.stringify(data, null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
