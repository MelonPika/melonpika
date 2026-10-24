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
  return { css, cells, segments, pitch, dotSize, left: xs[0], top: ys[0], stack: rectangles.find(rectangle => hasClass(rectangle, 'u')) };
}

export function planSnakeRoute(cells, length = 4) {
  if (!cells.length || !Number.isInteger(length) || length < 2) throw new Error('Invalid snake grid or length');
  const width = Math.max(...cells.map(cell => cell.x)) + 1;
  const height = Math.max(...cells.map(cell => cell.y)) + 1;
  const id = (x, y) => y * width + x;
  const allowed = new Set(cells.map(cell => id(cell.x, cell.y)));
  if (allowed.size !== cells.length || cells.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0)) throw new Error('Invalid contribution cells');
  const positions = ids => ids.map(value => ({ x: value % width, y: Math.floor(value / width) }));
  let initial;
  for (let y = 0; y < height && !initial; y++) {
    for (let x = length - 1; x < width && !initial; x++) {
      const pose = Array.from({ length }, (_, offset) => id(x - offset, y));
      if (pose.every(value => allowed.has(value))) initial = pose;
    }
  }
  if (!initial) throw new Error('Contribution grid is too small for the snake');
  const poses = [initial];
  const visited = new Set([initial[0]]);

  // Breadth-first search includes the body, so turns never intersect the snake.
  function travel(goal) {
    const current = poses.at(-1);
    if (goal(current)) return;
    const queue = [{ pose: current, parent: -1 }];
    const seen = new Set([current.join(',')]);
    for (let index = 0; index < queue.length; index++) {
      const { pose } = queue[index];
      const x = pose[0] % width, y = Math.floor(pose[0] / width);
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const head = id(nx, ny);
        if (!allowed.has(head) || pose.slice(0, -1).includes(head)) continue;
        const next = [head, ...pose.slice(0, -1)];
        const key = next.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ pose: next, parent: index });
        if (goal(next)) {
          const route = [];
          for (let cursor = queue.length - 1; queue[cursor].parent !== -1; cursor = queue[cursor].parent) route.push(queue[cursor].pose);
          for (const step of route.reverse()) { poses.push(step); visited.add(step[0]); }
          return;
        }
      }
    }
    throw new Error('No route inside the contribution cells can reach the next snake position');
  }

  for (const cell of cells.filter(cell => cell.color > 0).sort((a, b) => a.color - b.color || a.x - b.x || a.y - b.y)) {
    const target = id(cell.x, cell.y);
    if (!visited.has(target)) travel(pose => pose[0] === target);
  }
  // An empty calendar still gets a moving snake instead of a stationary frame.
  if (poses.length === 1) {
    const [head] = positions(initial);
    const distance = cell => Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y);
    const target = cells.reduce((best, cell) => distance(cell) > distance(best) ? cell : best);
    travel(pose => pose[0] === id(target.x, target.y));
  }
  // Return the whole body to its initial pose for a continuous animation loop.
  travel(pose => pose.every((value, index) => value === initial[index]));
  return poses.map(positions);
}

export function boundSnake(source) {
  const grid = readSnakeGrid(source);
  const poses = planSnakeRoute(grid.cells, grid.segments.length);
  const steps = poses.length - 1;
  const duration = steps * 100;
  const width = (Math.max(...grid.cells.map(cell => cell.x)) + 1) * grid.pitch;
  const clearedAt = new Map();
  poses.forEach(([head], step) => {
    const key = `${head.x},${head.y}`;
    if (!clearedAt.has(key)) clearedAt.set(key, step);
  });
  let variables = grid.css.match(/:root\s*\{[^}]+\}/)?.[0];
  if (!variables) throw new Error('Snake SVG is missing its palette');
  if (!/--c0\s*:/.test(variables)) variables = variables.replace(/\}$/, ';--c0:var(--ce)}');
  const styles = [variables, `.c{shape-rendering:geometricPrecision;fill:var(--ce);stroke:var(--cb);stroke-width:1px;width:${grid.dotSize}px;height:${grid.dotSize}px;animation:none ${duration}ms linear infinite}`, `.s{shape-rendering:geometricPrecision;fill:var(--cs);animation:none ${duration}ms linear infinite}`, `.u{transform:scale(0,1);animation:none ${duration}ms linear infinite}`];
  const dots = grid.cells.map((cell, index) => {
    let className = 'c';
    if (cell.color > 0) {
      const name = `c${index.toString(36)}`;
      const step = clearedAt.get(`${cell.x},${cell.y}`);
      if (step === undefined) throw new Error('Snake route skipped a contribution');
      const time = step / steps * 100;
      const frames = step === 0 ? '0%,100%{fill:var(--ce)}' : `0%,${number(Math.max(0, time - .0001))}%{fill:var(--c${cell.color})}${number(time)}%,100%{fill:var(--ce)}`;
      styles.push(`@keyframes ${name}{${frames}}.c.${name}{fill:var(--c${cell.color});animation-name:${name}}`);
      className += ` ${name}`;
    }
    return `<rect class="${className}" x="${grid.left + cell.x * grid.pitch}" y="${grid.top + cell.y * grid.pitch}" rx="2" ry="2"/>`;
  });
  const eaten = grid.cells.filter(cell => cell.color > 0).sort((a, b) => clearedAt.get(`${a.x},${a.y}`) - clearedAt.get(`${b.x},${b.y}`));
  const blocks = [];
  for (const cell of eaten) {
    if (blocks.at(-1)?.color !== cell.color) blocks.push({ color: cell.color, times: [] });
    blocks.at(-1).times.push(clearedAt.get(`${cell.x},${cell.y}`) / steps * 100);
  }
  let count = 0;
  const stack = blocks.map((block, index) => {
    const name = `u${index.toString(36)}`;
    const x = count / eaten.length * width;
    count += block.times.length;
    const frames = ['0%{transform:scale(0,1)}'];
    block.times.forEach((time, i) => frames.push(`${number(Math.max(0, time - .0001))}%{transform:scale(${number(i / block.times.length)},1)}${number(time)}%{transform:scale(${number((i + 1) / block.times.length)},1)}`));
    frames.push('100%{transform:scale(1,1)}');
    styles.push(`@keyframes ${name}{${frames.join('')}}.u.${name}{fill:var(--c${block.color});animation-name:${name};transform-origin:${number(x)}px 0}`);
    return `<rect class="u ${name}" x="${number(x)}" y="${grid.stack?.y ?? (Math.max(...grid.cells.map(cell => cell.y)) + 3) * grid.pitch}" width="${number(block.times.length / eaten.length * width)}" height="${grid.dotSize}"/>`;
  });
  const snake = grid.segments.map((segment, index) => {
    const size = Math.min(grid.dotSize, Number(segment.width));
    const transform = position => `transform:translate(${position.x * grid.pitch}px,${position.y * grid.pitch}px)`;
    const frames = poses.flatMap((pose, step) => {
      const point = pose[index], before = poses[step - 1]?.[index], after = poses[step + 1]?.[index];
      if (before && after && before.x + after.x === 2 * point.x && before.y + after.y === 2 * point.y) return [];
      return `${number(step / steps * 100)}%{${transform(point)}}`;
    });
    styles.push(`@keyframes s${index}{${frames.join('')}}.s.s${index}{${transform(poses[0][index])};animation-name:s${index}}`);
    const inset = (grid.dotSize - size) / 2;
    return `<rect class="s s${index}" x="${number(grid.left + inset)}" y="${number(grid.top + inset)}" width="${size}" height="${size}" rx="${segment.rx}" ry="${segment.ry}"/>`;
  });
  source = source.replace(/<style\b[^>]*>[\s\S]*?<\/style>/, `<style>${styles.join('')}</style>`);
  source = source.replace(/<rect\b[^>]*\/>/g, tag => attributes(tag).class?.split(/\s+/).some(name => ['c', 's', 'u'].includes(name)) ? '' : tag);
  if (!source.includes('Snake route stays inside the contribution cells.')) source = source.replace('</desc>', ' Snake route stays inside the contribution cells.</desc>');
  return source.replace('</svg>', dots.join('') + stack.join('') + snake.join('') + '</svg>');
}
