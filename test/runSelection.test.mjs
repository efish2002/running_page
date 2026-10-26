import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRunsByIds } from '../src/utils/runSelection.ts';

const activities = [
  { run_id: 1, start_date_local: '2026-10-01 07:00:00', distance: 8000 },
  { run_id: 2, start_date_local: '2026-10-01 18:00:00', distance: 5000 },
  { run_id: 3, start_date_local: '2026-09-12 07:00:00', distance: 10000 },
  { run_id: 4, start_date_local: '2025-10-05 07:00:00', distance: 12000 },
];

const yearRuns = activities.filter((run) =>
  run.start_date_local.startsWith('2026')
);

test('empty id list keeps the currently filtered runs', () => {
  const selected = selectRunsByIds(activities, yearRuns, []);
  assert.equal(selected.length, 3);
  assert.deepEqual(
    selected.map((run) => run.run_id),
    [1, 2, 3]
  );
});

test('ids inside the filtered set resolve to that run', () => {
  const selected = selectRunsByIds(activities, yearRuns, [3]);
  assert.deepEqual(
    selected.map((run) => run.run_id),
    [3]
  );
});

test('ids outside the filtered set resolve from the full activity list', () => {
  const selected = selectRunsByIds(activities, yearRuns, [4]);
  assert.deepEqual(
    selected.map((run) => run.run_id),
    [4]
  );
});

test('several ids of one day resolve together', () => {
  const selected = selectRunsByIds(activities, yearRuns, [1, 2]);
  assert.deepEqual(
    selected.map((run) => run.run_id),
    [1, 2]
  );
});

test('unknown ids resolve to nothing', () => {
  const selected = selectRunsByIds(activities, yearRuns, [999]);
  assert.deepEqual(selected, []);
});
