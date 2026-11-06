// Keep Platane/snk's contribution data, but route the snake within visible cells.
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
const number = value => Number(value.toFixed(6)).toString();

export function readSnakeGrid(source) {
  const css = source.match(/<style\b[^>]*>([\s\S]*?)<\/style>/)?.[1];
  if (!css) throw new Error('Snake SVG has no animation styles');
  const rectangles = [...source.matchAll(/<rect\b[^>]*\/>/g)].map(([tag]) => attributes(tag));
  const hasClass = (rectangle, name) => rectangle.class?.split(/\s+/).includes(name);
  const dots = rectangles.filter(rectangle => hasClass(rectangle, 'c'));
  const segments = rectangles.filter(rectangle => hasClass(rectangle, 's'));
  if (!dots.length || !segments.length) throw new Error('Snake SVG is missing its grid or body');
  const xs = [...new Set(dots.map(dot => Number(dot.x)))].sort((a, b) => a - b);
  const ys = [...new Set(dots.map(dot => Number(dot.y)))].sort((a, b) => a - b);
  const pitch = xs.length > 1 ? xs[1] - xs[0] : ys[1] - ys[0];
  const dotSize = Number(css.match(/\.c\s*\{[^}]*\bwidth\s*:\s*([\d.]+)px/)?.[1] ?? dots[0].width);
  if (!(pitch > 0 && dotSize > 0 && dotSize <= pitch)) throw new Error('Snake SVG has invalid cell dimensions');
  const colors = new Map([...css.matchAll(/\.c\.([\w-]+)\s*\{[^}]*?fill\s*:\s*var\(--c(\d+)\)/g)].map(([, id, color]) => [id, Number(color)]));
  const cells = dots.map(dot => {
    const colorClass = dot.class.split(/\s+/).find(name => name !== 'c');
    const color = colorClass ? colors.get(colorClass) : 0;
    if (!Number.isInteger(color) || color < 0 || color > 4) throw new Error('Snake SVG has a missing or invalid contribution color');
    return { x: (Number(dot.x) - xs[0]) / pitch, y: (Number(dot.y) - ys[0]) / pitch, color };
  });
  if (cells.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.y))) throw new Error('Snake cells are not aligned');
  const initialLength = Number(attributes(source.match(/<svg\b[^>]*>/)[0])['data-snake-initial-length'] ?? segments.length);
  return { css, cells, segments, initialLength, pitch, dotSize, left: xs[0], top: ys[0], stack: rectangles.find(rectangle => hasClass(rectangle, 'u')) };
}

export function planSnakeRoute(cells, length = 4) {
  if (!cells.length || !Number.isInteger(length) || length < 2) throw new Error('Invalid snake grid or length');
  const key = cell => `${cell.x},${cell.y}`;
  const indices = new Map(cells.map((cell, index) => [key(cell), index]));
  if (indices.size !== cells.length || cells.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0)) throw new Error('Invalid contribution cells');
  if (cells.length <= length) throw new Error('Contribution grid is too small for the snake');
  const neighbors = cells.map(({ x, y }) => [[x + 1, y], [x, y + 1], [x - 1, y], [x, y - 1]].map(point => indices.get(point.join(','))).filter(index => index !== undefined));
  const connected = new Set([0]);
  for (const index of connected) for (const next of neighbors[index]) connected.add(next);
  const noRoute = () => new Error('No route inside the contribution cells can reach every day without intersecting the growing snake');
  if (connected.size !== cells.length) throw noRoute();

  // Visit each day once so even a fully populated year can grow without collisions.
  const columns = [...new Set(cells.map(cell => cell.x))].sort((a, b) => a - b);
  let route = columns.flatMap((x, i) => cells.filter(cell => cell.x === x).sort((a, b) => i % 2 ? b.y - a.y : a.y - b.y));
  if (!route.every((cell, i) => !i || Math.abs(cell.x - route[i - 1].x) + Math.abs(cell.y - route[i - 1].y) === 1)) {
    // Partial boundary weeks can need a different sweep. Prefer constrained cells
    // and reject branches that would strand an endpoint before finishing the year.
    const used = new Set(), path = [];
    let attempts = 0;
    const degree = index => neighbors[index].filter(next => !used.has(next)).length;
    function search(current) {
      if (++attempts > 100000) throw noRoute();
      used.add(current); path.push(current);
      if (path.length === cells.length) return true;
      const candidates = neighbors[current].filter(next => !used.has(next)).sort((a, b) => degree(a) - degree(b));
      for (const next of candidates) {
        let ends = 0, possible = true;
        for (let index = 0; index < cells.length; index++) if (!used.has(index) && index !== next) {
          const count = degree(index);
          if (count === 0 || count === 1 && ++ends > 1) { possible = false; break; }
        }
        if (possible && search(next)) return true;
      }
      used.delete(current); path.pop();
      return false;
    }
    const colors = cells.map(cell => (cell.x + cell.y) % 2);
    const majority = colors.filter(color => color === 0).length > cells.length / 2 ? 0 : 1;
    const starts = cells.map((_, index) => index).filter(index => cells.length % 2 === 0 || colors[index] === majority).sort((a, b) => neighbors[a].length - neighbors[b].length);
    if (!starts.some(search)) throw noRoute();
    route = path.map(index => cells[index]);
  }
  const position = ({ x, y }) => ({ x, y });
  const poses = [route.slice(0, length).reverse().map(position)];
  for (const cell of route.slice(length)) {
    const previous = poses.at(-1);
    poses.push([position(cell), ...(cell.color > 0 ? previous : previous.slice(0, -1))]);
  }
  return poses;
}

export const snakeTimeline = Object.freeze({ start: 2, end: 90, fadeStart: 94, fadeEnd: 97 });

export function boundSnake(source) {
  const grid = readSnakeGrid(source);
  const poses = planSnakeRoute(grid.cells, grid.initialLength);
  const steps = poses.length - 1;
  const duration = Math.ceil(steps * 100 / ((snakeTimeline.end - snakeTimeline.start) / 100));
  const timeAt = step => snakeTimeline.start + step / steps * (snakeTimeline.end - snakeTimeline.start);
  const width = (Math.max(...grid.cells.map(cell => cell.x)) + 1) * grid.pitch;
  const clearedAt = new Map();
  // The initial body already occupies these days when it fades into view.
  poses[0].forEach(cell => clearedAt.set(`${cell.x},${cell.y}`, 0));
  poses.forEach(([head], step) => {
    const key = `${head.x},${head.y}`;
    if (!clearedAt.has(key)) clearedAt.set(key, step);
  });
  let variables = grid.css.match(/:root\s*\{[^}]+\}/)?.[0];
  if (!variables) throw new Error('Snake SVG is missing its palette');
  if (!/--c0\s*:/.test(variables)) variables = variables.replace(/\}$/, ';--c0:var(--ce)}');
  const styles = [variables, `.c{shape-rendering:geometricPrecision;fill:var(--ce);stroke:var(--cb);stroke-width:1px;width:${grid.dotSize}px;height:${grid.dotSize}px;animation:none ${duration}ms linear infinite}`, `.s{shape-rendering:geometricPrecision;fill:var(--cs);animation:none ${duration}ms linear infinite}`, `.u{transform:scale(0,1);animation:none ${duration}ms linear infinite}`, `@keyframes snake-reset{0%,100%{opacity:0}${snakeTimeline.start}%,${snakeTimeline.fadeStart}%{opacity:1}${snakeTimeline.fadeEnd}%{opacity:0}}#snake-body{opacity:0;animation:snake-reset ${duration}ms linear infinite}`];
  const dots = grid.cells.map((cell, index) => {
    let className = 'c';
    if (cell.color > 0) {
      const name = `c${index.toString(36)}`;
      const step = clearedAt.get(`${cell.x},${cell.y}`);
      if (step === undefined) throw new Error('Snake route skipped a contribution');
      const time = timeAt(step);
      const frames = `0%,${number(time - .0001)}%{fill:var(--c${cell.color})}${number(time)}%,${snakeTimeline.fadeEnd}%{fill:var(--ce)}100%{fill:var(--c${cell.color})}`;
      styles.push(`@keyframes ${name}{${frames}}.c.${name}{fill:var(--c${cell.color});animation-name:${name}}`);
      className += ` ${name}`;
    }
    return `<rect class="${className}" x="${grid.left + cell.x * grid.pitch}" y="${grid.top + cell.y * grid.pitch}" rx="2" ry="2"/>`;
  });
  const eaten = grid.cells.filter(cell => cell.color > 0).sort((a, b) => clearedAt.get(`${a.x},${a.y}`) - clearedAt.get(`${b.x},${b.y}`));
  const blocks = [];
  for (const cell of eaten) {
    if (blocks.at(-1)?.color !== cell.color) blocks.push({ color: cell.color, times: [] });
    blocks.at(-1).times.push(timeAt(clearedAt.get(`${cell.x},${cell.y}`)));
  }
  let count = 0;
  const stack = blocks.map((block, index) => {
    const name = `u${index.toString(36)}`;
    const x = count / eaten.length * width;
    count += block.times.length;
    const frames = ['0%{transform:scale(0,1)}'];
    block.times.forEach((time, i) => frames.push(`${number(Math.max(0, time - .0001))}%{transform:scale(${number(i / block.times.length)},1)}${number(time)}%{transform:scale(${number((i + 1) / block.times.length)},1)}`));
    frames.push(`${snakeTimeline.fadeEnd}%{transform:scale(1,1)}100%{transform:scale(0,1)}`);
    styles.push(`@keyframes ${name}{${frames.join('')}}.u.${name}{fill:var(--c${block.color});animation-name:${name};transform-origin:${number(x)}px 0}`);
    return `<rect class="u ${name}" x="${number(x)}" y="${grid.stack?.y ?? (Math.max(...grid.cells.map(cell => cell.y)) + 3) * grid.pitch}" width="${number(block.times.length / eaten.length * width)}" height="${grid.dotSize}"/>`;
  });
  const snake = Array.from({ length: poses.at(-1).length }, (_, index) => {
    const size = grid.dotSize;
    const born = poses.findIndex(pose => pose.length > index);
    const transform = position => `transform:translate(${position.x * grid.pitch}px,${position.y * grid.pitch}px)`;
    const frames = poses.flatMap((pose, step) => {
      if (step < born) return [];
      const point = pose[index], before = poses[step - 1]?.[index], after = poses[step + 1]?.[index];
      if (before && after && before.x + after.x === 2 * point.x && before.y + after.y === 2 * point.y) return [];
      return `${number(timeAt(step))}%{${transform(point)}}`;
    });
    const origin = transform(poses[born][index]);
    const last = transform(poses.at(-1)[index]);
    styles.push(`@keyframes s${index}{0%{${origin}}${frames.join('')}100%{${last}}}.s.s${index}{${origin};opacity:${born ? 0 : 1};animation-name:s${index}${born ? `,g${index}` : ''}}`);
    if (born) styles.push(`@keyframes g${index}{0%,${number(timeAt(born) - .0001)}%{opacity:0}${number(timeAt(born))}%,100%{opacity:1}}`);
    const inset = (grid.dotSize - size) / 2;
    return `<rect class="s s${index}" data-born-step="${born}" x="${number(grid.left + inset)}" y="${number(grid.top + inset)}" width="${size}" height="${size}" rx="${index ? 2 : 3}" ry="${index ? 2 : 3}"/>`;
  });
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/, `<style>${styles.join('')}</style>`);
  source = source.replace(/<g id="snake-body">[\s\S]*?<\/g>/, '');
  source = source.replace(/<rect\b[^>]*\/>/g, tag => attributes(tag).class?.split(/\s+/).some(name => ['c', 's', 'u'].includes(name)) ? '' : tag);
  source = source.replace(/<svg\b[^>]*>/, tag => tag.replace(/\sdata-snake-initial-length="[^"]*"/, '').replace('>', ` data-snake-initial-length="${grid.initialLength}">`));
  if (!source.includes('Snake route stays inside the contribution cells.')) source = source.replace('</desc>', ' Snake route stays inside the contribution cells.</desc>');
  if (!source.includes('The snake grows after eating')) source = source.replace('</desc>', ' The snake grows after eating and fades out before the calendar resets.</desc>');
  return source.replace('</svg>', dots.join('') + stack.join('') + '<g id="snake-body">' + snake.join('') + '</g></svg>');
}
