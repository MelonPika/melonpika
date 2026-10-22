import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseDocument } from 'yaml';
import { root } from './generate-profile.mjs';

const readme = await readFile(path.join(root, 'README.md'), 'utf8');
assert(!/<(?:script|style)\b|\s(?:style|on\w+)=/i.test(readme), 'README contains unsupported style/script/event handlers');
assert(!/Shadows_Lunarfox|Kuala Lumpur|lunarfox\.my|g\.dev\/lunarfox|shadowslunarfox-4093|91894334/i.test(readme), 'Reference identity leaked into profile');
const dom = new JSDOM(readme).window.document;
const paths = new Set();
for (const element of dom.querySelectorAll('img,source,a')) {
  const source = element.getAttribute('src') || element.getAttribute('srcset') || element.getAttribute('href');
  if (element.tagName === 'IMG') assert(element.getAttribute('alt'), 'Every image needs alt text');
  if (source && !/^https:\/\//.test(source)) {
    assert(!source.startsWith('/') && !source.includes('..'), `Unsafe local path: ${source}`);
    paths.add(source);
  }
}
for (const file of paths) await access(path.join(root, file));
const headings = [...dom.querySelectorAll('h2')].map(n => n.textContent);
const order = ['Cozy Corner', 'Learning & Badges', 'Featured Repositories', 'GitHub Stats', 'Activity Graph', 'Contribution Snake', '3D Contributions'];
assert.equal(headings.length, order.length);
order.forEach((label, i) => assert(headings[i].includes(label), `Wrong section order: ${label}`));
let svgs = 0;
async function visit(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await visit(file);
    else if (file.endsWith('.svg')) {
      const source = await readFile(file, 'utf8');
      const doc = new JSDOM(source, { contentType: 'image/svg+xml' }).window.document;
      assert.equal(doc.documentElement.localName, 'svg', file);
      assert(!doc.querySelector('script,foreignObject'), `Unsafe SVG: ${file}`);
      assert(!/\b(?:NaN|Infinity|undefined)\b/.test(source), `Invalid values in ${file}`);
      assert(doc.documentElement.hasAttribute('viewBox'), `Missing responsive viewBox: ${file}`);
      svgs++;
    }
  }
}
await visit(path.join(root, 'assets/profile'));
const workflows = await readdir(path.join(root, '.github/workflows'));
const groups = new Set();
for (const name of workflows.filter(f => f.endsWith('.yml'))) {
  const source = await readFile(path.join(root, '.github/workflows', name), 'utf8');
  const document = parseDocument(source, { uniqueKeys: true });
  assert.equal(document.errors.length, 0, `Invalid YAML: ${name}`);
  const workflow = document.toJS();
  assert(workflow.on.workflow_dispatch !== undefined || 'workflow_dispatch' in workflow.on, `Missing manual trigger: ${name}`);
  if (name !== 'validate.yml') {
    assert(workflow.on.schedule?.length, `Missing daily schedule: ${name}`);
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    assert(!groups.has(workflow.concurrency.group), 'Independent generators must not cancel each other in a shared pending queue');
    groups.add(workflow.concurrency.group);
  }
  for (const job of Object.values(workflow.jobs)) for (const step of job.steps || []) {
    if (step.uses) assert(/@[a-f\d]{40}$/.test(step.uses), `Action is not pinned: ${step.uses}`);
    if (step.run?.includes('.github/scripts/')) for (const script of step.run.match(/\.github\/scripts\/[\w.-]+/g) || []) await access(path.join(root, script));
  }
}
const snake = await readFile(path.join(root, 'assets/profile/github-snake.svg'), 'utf8');
const three = await readFile(path.join(root, 'assets/profile/3d-contributions-light.svg'), 'utf8');
assert(snake.includes('@keyframes'), 'Snake is not animated');
assert(three.includes('<animate'), '3D calendar has no growing animation');
console.log(`Validated ${svgs} XML SVGs, ${paths.size} README paths, all seven section headings, animations, and ${workflows.length} workflow YAML files.`);
