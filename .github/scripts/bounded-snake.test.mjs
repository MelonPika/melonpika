import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planSnakeRoute, readSnakeGrid } from './bounded-snake.mjs';
import { styleSnake } from './pastel-3d.mjs';

const calendar = (width, height, color = index => index % 5) => Array.from({ length: width * height }, (_, index) => ({ x: Math.floor(index / height), y: index % height, color: color(index) }));
const key = point => `${point.x},${point.y}`;

function verifyRoute(cells, poses) {
  const allowed = new Set(cells.map(key));
  assert(poses.length > 2, 'Snake should move');
  assert.deepEqual(poses.at(-1), poses[0], 'The entire body must join continuously at the loop boundary');
  const visited = new Set();
  for (let step = 0; step < poses.length; step++) {
    const pose = poses[step];
    assert.equal(new Set(pose.map(key)).size, pose.length, 'The snake must not intersect itself');
    for (const segment of pose) assert(allowed.has(key(segment)), 'Every body segment must stay on a visible contribution cell');
    visited.add(key(pose[0]));
    if (step) {
      const previous = poses[step - 1];
      assert.equal(Math.abs(pose[0].x - previous[0].x) + Math.abs(pose[0].y - previous[0].y), 1, 'The head must move one adjacent cell per step');
      assert.deepEqual(pose.slice(1), previous.slice(0, -1), 'The body must follow the head');
    }
  }
  for (const cell of cells.filter(cell => cell.color > 0)) assert(visited.has(key(cell)), 'Every colored contribution must be visited');
}

test('a full year stays inside the grid, eats every contribution, and loops continuously', () => {
  const cells = calendar(53, 7);
  verifyRoute(cells, planSnakeRoute(cells));
});

test('partial first and last weeks do not send the snake into missing boxes', () => {
  const cells = calendar(53, 7).filter(cell => !(cell.x === 0 && cell.y < 4) && !(cell.x === 52 && cell.y > 4));
  verifyRoute(cells, planSnakeRoute(cells));
});

test('an empty calendar still has a moving, bounded snake', () => {
  const cells = calendar(8, 7, () => 0);
  verifyRoute(cells, planSnakeRoute(cells));
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
    assert.equal(styleSnake(bounded), bounded, 'Daily restyling should not accumulate changes');
    assert.equal(source, bounded, 'Committed snapshots must already use the bounded route');
    const right = after.left + Math.max(...after.cells.map(cell => cell.x)) * after.pitch + after.dotSize;
    const bottom = after.top + Math.max(...after.cells.map(cell => cell.y)) * after.pitch + after.dotSize;
    const animations = [...after.css.matchAll(/@keyframes s(\d+)\{([\s\S]*?)\}\.s\.s\1\{/g)];
    assert.equal(animations.length, after.segments.length);
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
