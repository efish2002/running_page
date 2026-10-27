import assert from 'node:assert/strict';
import polyline from '@mapbox/polyline';
import {
  boundsOf,
  decodeRoute,
  filterRaces,
  parseItraRaces,
  routeThumbnailPath,
  summariseRaces,
} from '../src/utils/trail.ts';

const encoded = polyline.encode(
  [
    [30.0, 103.0],
    [30.1, 103.1],
    [30.2, 103.05],
  ],
  5
);

const raw = (over = {}) => ({
  date: '2026-10-18',
  name: 'Heming Tao Super Mountain Trail - 23KM',
  raceYearId: '125881',
  url: 'https://itra.run/Races/RaceDetails/125881',
  category: 'Half Marathon',
  country: 'CHN',
  distanceKm: 22,
  elevationM: 1160,
  itraPoints: 0,
  genderRank: 3,
  genderTotal: 238,
  generalRank: 3,
  generalTotal: 351,
  ageGroupRank: 1,
  participants: 351,
  finishers: 336,
  dnf: 15,
  malePct: 68,
  femalePct: 32,
  time: '2:33:02',
  score: null,
  scoreLabel: 'DNF',
  badges: [],
  route: { runId: 1, match: 'same-day', distanceKm: 23.25, polyline: encoded },
  ...over,
});

const payload = (races) => ({
  updatedAt: '2026-10-27',
  runner: 'https://itra.run/RunnerSpace/gao.hao.4683832',
  races,
});

// --- parseItraRaces ------------------------------------------------------

const races = parseItraRaces(payload([raw()]));

assert.equal(races.length, 1, 'every race of the file is read');
assert.equal(races[0].id, '125881', 'the race keeps its id');
assert.equal(races[0].year, '2026', 'the year comes from the date');
assert.equal(races[0].points.length, 3, 'the route is decoded');
assert.deepEqual(
  races[0].points[0],
  [103.0, 30.0],
  'the points are longitude first so the map takes them as they are'
);

const noRoute = parseItraRaces(payload([raw({ route: null })]));
assert.equal(noRoute[0].route, null, 'a race without a track has no route');
assert.deepEqual(noRoute[0].points, [], 'a race without a track has no points');

const bare = parseItraRaces(payload([{ date: '2024-01-02' }]));
assert.equal(bare[0].category, '', 'a race without a category still parses');
assert.equal(bare[0].distanceKm, 0, 'a race without a distance still parses');
assert.equal(bare[0].generalRank, null, 'a race without a rank has no rank');
assert.equal(bare[0].year, '2024', 'a bare race still knows its year');

// --- decodeRoute ---------------------------------------------------------

assert.deepEqual(
  decodeRoute(encoded)[1],
  [103.1, 30.1],
  'a decoded point is longitude and latitude'
);
assert.deepEqual(decodeRoute(''), [], 'an empty track decodes to nothing');
assert.doesNotThrow(
  () => decodeRoute('!!!'),
  'a broken track does not throw'
);

// --- filterRaces ---------------------------------------------------------

const many = parseItraRaces(
  payload([
    raw({ raceYearId: '1', date: '2026-10-18', category: 'Half Marathon' }),
    raw({ raceYearId: '2', date: '2025-05-01', category: '50K' }),
    raw({ raceYearId: '3', date: '2024-05-01', category: 'Half Marathon' }),
  ])
);

assert.equal(filterRaces(many, '2026', 'All').length, 1, 'the year filters');
assert.equal(filterRaces(many, 'All', '50K').length, 1, 'the category filters');
assert.equal(filterRaces(many, 'All', 'All').length, 3, 'no filter keeps all');
assert.equal(
  filterRaces(many, '2025', 'Half Marathon').length,
  0,
  'the year and the category filter together'
);

// --- summariseRaces ------------------------------------------------------

const summary = summariseRaces(
  parseItraRaces(
    payload([
      raw({ raceYearId: '1', date: '2026-10-18', distanceKm: 22, elevationM: 1160 }),
      raw({
        raceYearId: '2',
        date: '2025-05-01',
        category: '50K',
        distanceKm: 48,
        elevationM: 2900,
        generalRank: 12,
        genderRank: 5,
        participants: 200,
        finishers: 150,
      }),
      raw({
        raceYearId: '3',
        date: '2024-05-01',
        category: 'Vertical',
        distanceKm: 10,
        elevationM: 3600,
        generalRank: 1,
        genderRank: 2,
        participants: 100,
        finishers: 100,
      }),
    ])
  )
);

assert.equal(summary.count, 3, 'every race counts');
assert.equal(summary.withRoute, 3, 'every race has a route');
assert.equal(summary.totalDistanceKm, 80, 'the distances add up');
assert.equal(summary.totalElevationM, 7660, 'the climbs add up');
assert.equal(summary.avgDistanceKm, 26.67, 'the average distance');
assert.equal(summary.bestGeneralRank, 1, 'the best general rank');
assert.equal(summary.bestGenderRank, 2, 'the best gender rank');
assert.equal(summary.totalParticipants, 651, 'the participants add up');
assert.ok(
  Math.abs(
    summary.finishRate -
      (150 + 100 + 336) / (200 + 100 + 351)
  ) < 0.001,
  'the finish rate is the finishers over the participants'
);
assert.equal(summary.years.length, 3, 'every year is in the list');
assert.equal(summary.years[0].year, '2024', 'the years start at the oldest');
assert.equal(summary.years[2].year, '2026', 'the years end at the newest');
assert.equal(summary.years[2].count, 1, 'the races of a year are counted');
assert.equal(summary.years[0].elevationM, 3600, 'the climbs of a year add up');
assert.deepEqual(
  summary.categories.map((item) => item.category),
  ['Vertical', 'Half Marathon', '50K'],
  'the categories keep the order of the distances'
);
assert.equal(summary.longest.distanceKm, 48, 'the longest race');
assert.equal(summary.steepest.elevationM, 3600, 'the steepest race');

const empty = summariseRaces([]);
assert.equal(empty.count, 0, 'no race gives no count');
assert.equal(empty.totalDistanceKm, 0, 'no race gives no distance');
assert.equal(empty.longest, null, 'no race gives no longest race');
assert.equal(empty.years.length, 0, 'no race gives no year');
assert.equal(empty.finishRate, 0, 'no race gives no finish rate');

// --- boundsOf and routeThumbnailPath --------------------------------------

const box = boundsOf([
  [103.0, 30.0],
  [103.2, 30.2],
]);
assert.equal(box.minLon, 103.0, 'the west edge');
assert.equal(box.maxLat, 30.2, 'the north edge');

assert.deepEqual(boundsOf([]), null, 'no point has no bounds');

const path = routeThumbnailPath(
  [
    [103.0, 30.0],
    [103.2, 30.2],
  ],
  100,
  60,
  4
);
assert.ok(path.startsWith('M'), 'the path starts with a move');
assert.ok(path.includes('L'), 'the path has lines');
assert.ok(!path.includes('NaN'), 'the path has no broken numbers');

const numbers = path.match(/-?\d+(\.\d+)?/g).map(Number);
assert.ok(
  numbers.every((value) => value >= 0 && value <= 100),
  'the path stays inside the box'
);
assert.equal(routeThumbnailPath([], 100, 60, 4), '', 'no point gives no path');
