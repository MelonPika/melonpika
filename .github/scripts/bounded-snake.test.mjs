import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planSnakeRoute, readSnakeGrid, snakeTimeline } from './bounded-snake.mjs';
import { styleSnake } from './pastel-3d.mjs';

const calendar = (width, height, color = index => index % 5) => Array.from({ length: width * height }, (_, index) => ({ x: Math.floor(index / height), y: index % height, color: color(index) }));
const key = point => `${point.x},${point.y}`;

function verifyRoute(cells, poses) {
  const allowed = new Set(cells.map(key));
  const food = new Set(cells.filter(cell => cell.color > 0).map(key));
  assert(poses.length > 2, 'Snake should move');
  const visited = new Set(poses[0].map(key));
  for (let step = 0; step < poses.length; step++) {
    const pose = poses[step];
    assert.equal(new Set(pose.map(key)).size, pose.length, 'The snake must not intersect itself');
    for (const segment of pose) assert(allowed.has(key(segment)), 'Every body segment must stay on a visible contribution cell');
    if (step) {
      const previous = poses[step - 1];
      const grows = food.has(key(pose[0])) && !visited.has(key(pose[0]));
      assert.equal(Math.abs(pose[0].x - previous[0].x) + Math.abs(pose[0].y - previous[0].y), 1, 'The head must move one adjacent cell per step');
      assert.equal(pose.length, previous.length + Number(grows), 'Eating a new contribution must add exactly one segment; empty days must not grow the snake');
      assert.deepEqual(pose.slice(1), grows ? previous : previous.slice(0, -1), 'Growth retains the old tail while the body follows the head');
    }
    visited.add(key(pose[0]));
  }
  for (const cell of cells.filter(cell => cell.color > 0)) assert(visited.has(key(cell)), 'Every colored contribution must be visited');
}

test('a full year grows after eating every contribution without collisions or leaving the grid', () => {
  const cells = calendar(53, 7);
  verifyRoute(cells, planSnakeRoute(cells));
});

test('partial first and last weeks do not send the snake into missing boxes', () => {
  const cells = calendar(53, 7).filter(cell => !(cell.x === 0 && cell.y < 4) && !(cell.x === 52 && cell.y > 4));
  verifyRoute(cells, planSnakeRoute(cells));
});

test('all boundary-week shapes support a growing snake, including 54-column calendars', () => {
  for (const width of [53, 54]) for (let first = 0; first < 7; first++) for (let last = 0; last < 7; last++) {
    const cells = calendar(width, 7).filter(cell => !(cell.x === 0 && cell.y < first) && !(cell.x === width - 1 && cell.y > last));
    verifyRoute(cells, planSnakeRoute(cells));
  }
});

test('even a contribution on every day grows to fill the grid without a length cap', () => {
  const cells = calendar(8, 7, () => 4);
  const poses = planSnakeRoute(cells);
  verifyRoute(cells, poses);
  assert.equal(poses.at(-1).length, cells.length);
});

test('an empty calendar still has a moving, bounded snake', () => {
  const cells = calendar(8, 7, () => 0);
  const poses = planSnakeRoute(cells);
  verifyRoute(cells, poses);
  assert(poses.every(pose => pose.length === 4));
});

test('sparse contributions are reached without sweeping every empty week', () => {
  const meals = new Set(['2,5', '50,4', '50,6', '51,0', '51,1', '51,2', '51,6', '52,0', '52,5']);
  const cells = calendar(53, 7, () => 0).map(cell => ({ ...cell, color: meals.has(key(cell)) ? 4 : 0 }));
  const poses = planSnakeRoute(cells);
  verifyRoute(cells, poses);
  assert(poses.length < 100, 'The snake should take adjacent shortcuts across empty weeks');
});

test('shortcuts preserve meals along the route, including isolated contributions', () => {
  for (const stride of [2, 7, 19, 47]) {
    const cells = calendar(12, 7, index => index % stride === stride - 1 ? 3 : 0);
    verifyRoute(cells, planSnakeRoute(cells));
  }
});

test('disconnected contribution cells fail instead of being silently skipped', () => {
  const cells = [...calendar(5, 3, () => 0), { x: 10, y: 2, color: 4 }];
  assert.throws(() => planSnakeRoute(cells), /No route inside/);
});

test('an unexpected SVG color format fails instead of erasing contribution data', async () => {
  const source = await readFile(new URL('../../assets/profile/github-snake.svg', import.meta.url), 'utf8');
  assert.throws(() => readSnakeGrid(source.replaceAll('.c.', '.unknown.')), /missing or invalid contribution color/);
});

test('both displayed SVGs retain contribution data and contain every animated body rectangle', async () => {
  for (const name of ['github-snake.svg', 'github-snake-dark.svg']) {
    const source = await readFile(new URL(`../../assets/profile/${name}`, import.meta.url), 'utf8');
    const before = readSnakeGrid(source);
    const bounded = styleSnake(source);
    const after = readSnakeGrid(bounded);
    assert.deepEqual(after.cells, before.cells, 'Rerouting must preserve each day and contribution level');
    assert.equal(after.initialLength, before.initialLength, 'Rerendering must preserve the initial size rather than reuse the fully grown body');
    assert.equal(styleSnake(bounded), bounded, 'Daily restyling should not accumulate changes');
    assert.equal(source, bounded, 'Committed snapshots must already use the bounded route');
    const right = after.left + Math.max(...after.cells.map(cell => cell.x)) * after.pitch + after.dotSize;
    const bottom = after.top + Math.max(...after.cells.map(cell => cell.y)) * after.pitch + after.dotSize;
    const animations = [...after.css.matchAll(/@keyframes s(\d+)\{([\s\S]*?)\}\.s\.s\1\{/g)];
    assert.equal(animations.length, after.segments.length);
    const poses = planSnakeRoute(after.cells, after.initialLength);
    assert.equal(after.segments.length, poses.at(-1).length);
    assert.match(after.css, /@keyframes snake-reset\{0%,100%\{opacity:0\}/, 'The snake must be invisible at both sides of the loop reset');
    assert(after.css.includes(`${snakeTimeline.fadeEnd}%{fill:var(--ce)}100%{fill:var(--c`), 'Contribution cells must refill during the invisible reset');
    for (const [index, segment] of after.segments.entries()) {
      const born = poses.findIndex(pose => pose.length > index);
      assert.equal(Number(segment['data-born-step']), born);
      if (born) assert(after.css.includes(`@keyframes g${index}{0%,`), 'New tail segments must stay hidden until food is eaten');
    }
    for (const [, index, frames] of animations) {
      const segment = after.segments[Number(index)];
      assert(Number(segment.width) <= after.dotSize && Number(segment.height) <= after.dotSize);
      for (const [, dx, dy] of frames.matchAll(/translate\((-?[\d.]+)px,(-?[\d.]+)px\)/g)) {
        const x = Number(dx) + Number(segment.x), y = Number(dy) + Number(segment.y);
        assert(x >= after.left && y >= after.top, 'Animation must stay below the top edge and right of the left edge');
        assert(x + Number(segment.width) <= right && y + Number(segment.height) <= bottom, 'Animation must stay above the bottom edge and left of the right edge');
      }
    }
  }
});
