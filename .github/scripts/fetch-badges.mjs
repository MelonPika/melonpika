import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './generate-profile.mjs';

const badges = {
  python: 'Python-ffe9a3?logo=python', typescript: 'TypeScript-b9edf2?logo=typescript',
  javascript: 'JavaScript-ffd166?logo=javascript', vue: 'Vue-c5e8c5?logo=vuedotjs',
  git: 'Git-ffd3b6?logo=git', github: 'GitHub-d7c4f3?logo=github',
  contact: 'GitHub-MelonPika-ffaec5?logo=github&labelColor=615276'
};
const output = path.join(root, 'assets/profile/badges');
await mkdir(output, { recursive: true });
for (const [file, query] of Object.entries(badges)) {
  const url = `https://img.shields.io/badge/${query}&style=flat&logoColor=3b2d4f`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  let content = await response.text();
  if (!response.ok || !content.includes('<svg') || /badge not found|invalid|inaccessible/i.test(content)) throw new Error(`Invalid badge: ${file}`);
  if (!/\bviewBox=/.test(content)) {
    const width = content.match(/<svg[^>]*\bwidth="(\d+(?:\.\d+)?)"/)?.[1];
    const height = content.match(/<svg[^>]*\bheight="(\d+(?:\.\d+)?)"/)?.[1];
    if (!width || !height) throw new Error(`Badge dimensions missing: ${file}`);
    content = content.replace('<svg ', `<svg viewBox="0 0 ${width} ${height}" `);
  }
  await writeFile(path.join(output, `${file}.svg`), content + '\n');
}
const avatar = await fetch('https://avatars.githubusercontent.com/u/81864061?s=96&v=4', { signal: AbortSignal.timeout(30000) });
if (!avatar.ok || !avatar.headers.get('content-type')?.startsWith('image/')) throw new Error('Cannot download public avatar');
await writeFile(path.join(root, 'assets/profile/avatar.png'), Buffer.from(await avatar.arrayBuffer()));
console.log('Saved seven pastel technology/contact badges and the public GitHub avatar locally.');
