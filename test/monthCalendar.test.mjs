import assert from 'node:assert/strict';
import { routePathForPoints } from '../src/components/MonthCalendar/routePath.ts';
import { buildMonthGrid } from '../src/components/MonthCalendar/monthGrid.ts';

const parse = (path) => {
  const numbers = path.match(/-?\d+(\.\d+)?/g).map(Number);
  const points = [];
  for (let i = 0; i < numbers.length; i += 2) {
    points.push([numbers[i], numbers[i + 1]]);
  }
  return points;
};

// --- routePathForPoints -------------------------------------------------
// points are [lng, lat], the same order the map helpers use.

assert.equal(routePathForPoints([]), '', 'no points means no route');
assert.equal(routePathForPoints([[1, 2]]), '', 'a single point is not a route');
assert.equal(
  routePathForPoints([
    [1, 2],
    [1, 2],
  ]),
  '',
  'a collapsed route is not a route'
);

const square = routePathForPoints([
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
]);
assert.equal(
  square,
  'M 15.0,85.0 L 85.0,85.0 L 85.0,15.0 L 15.0,15.0',
  'a square route fills a 70 unit box inside the 100 unit viewBox'
);

const wide = routePathForPoints([
  [0, 0],
  [10, 0],
  [10, 1],
  [0, 1],
]);
assert.equal(
  wide,
  'M 15.0,53.5 L 85.0,53.5 L 85.0,46.5 L 15.0,46.5',
  'a wide route keeps its aspect ratio and is centred vertically'
);

const tall = routePathForPoints([
  [0, 0],
  [0, 10],
  [1, 10],
  [1, 0],
]);
assert.equal(
  tall,
  'M 46.5,85.0 L 46.5,15.0 L 53.5,15.0 L 53.5,85.0',
  'a tall route keeps its aspect ratio and is centred horizontally'
);

const circle = [];
for (let i = 0; i <= 200; i += 1) {
  const angle = (i / 200) * Math.PI * 2;
  circle.push([Math.cos(angle), Math.sin(angle)]);
}
const circlePath = routePathForPoints(circle);
const circlePoints = parse(circlePath);
assert.ok(
  circlePoints.length <= circle.length,
  'the simplified route never grows beyond the input'
);
const circleBox = {
  x: circlePoints.map((p) => p[0]),
  y: circlePoints.map((p) => p[1]),
};
assert.ok(
  Math.abs(Math.min(...circleBox.x) - 15) < 0.2 &&
    Math.abs(Math.max(...circleBox.x) - 85) < 0.2,
  'the simplified route still spans the 70 unit box'
);
assert.ok(
  Math.abs((Math.min(...circleBox.y) + Math.max(...circleBox.y)) / 2 - 50) < 0.2,
  'the simplified route stays centred'
);

const zigzag = Array.from({ length: 500 }, (_, i) => [i / 5, i % 2 ? 0.5 : 0]);
const capped = routePathForPoints(zigzag, { maxPoints: 50 });
assert.ok(
  parse(capped).length <= 50,
  'a dense route is decimated down to the point budget'
);
const cappedPoints = parse(capped);
assert.equal(
  cappedPoints[0][0],
  15,
  'the first point of the route is kept'
);
assert.equal(
  cappedPoints[cappedPoints.length - 1][0],
  85,
  'the last point of the route is kept'
);

// --- buildMonthGrid ----------------------------------------------------

const runs = [
  { start_date_local: '2026-10-01 06:30:00', distance: 5000 },
  { start_date_local: '2026-10-01 18:10:00', distance: 3000 },
  { start_date_local: '2026-10-15 07:00:00', distance: 12000 },
  { start_date_local: '2026-09-30 07:00:00', distance: 9000 },
];

const grid = buildMonthGrid(2026, 9, runs);
assert.equal(grid.length, 42, 'the grid always holds six weeks of cells');
assert.deepEqual(
  grid.slice(0, 4).map((cell) => cell.day),
  [null, null, null, null],
  '1 October 2026 is a Thursday, so four cells are empty'
);
assert.equal(grid[4].day, 1, 'the first of the month lands on a Thursday');
assert.equal(grid[4].distance, 8000, 'two runs on the same day add up');
assert.equal(grid[4].runs.length, 2, 'both runs of the day are kept');
assert.equal(grid[18].day, 15, 'the fifteenth lands on the expected cell');
assert.equal(grid[18].distance, 12000, 'a single run keeps its distance');
assert.equal(
  grid.filter((cell) => cell.day === 30).length,
  1,
  'the thirtieth appears once'
);
assert.equal(
  grid.slice(35).every((cell) => cell.day === null),
  true,
  'the trailing cells are empty'
);
assert.equal(
  buildMonthGrid(2026, 9, []).every((cell) => cell.distance === 0),
  true,
  'a month without runs has no distance'
);
const feb2026 = buildMonthGrid(2026, 1, []);
assert.equal(
  feb2026.filter((cell) => cell.day !== null).length,
  28,
  'February 2026 has 28 days'
);
assert.equal(
  feb2026.filter((cell) => cell.day !== null).length,
  new Date(2026, 2, 0).getDate(),
  'the day count follows the real calendar'
);

console.log('month calendar tests passed');
