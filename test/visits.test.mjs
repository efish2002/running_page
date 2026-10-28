import assert from 'node:assert/strict';
import {
  VISIT_COUNTER_KEY,
  VISIT_HISTORY_DAYS,
  countForDate,
  dailyVisitKey,
  formatVisitCount,
  mergeVisitDays,
  parseCounterValue,
  readVisitSnapshot,
  utcDate,
  visitChartBars,
  visitCounterUrl,
} from '../src/utils/visits.ts';

// --- the counter endpoints -------------------------------------------------

assert.equal(
  visitCounterUrl('hit', VISIT_COUNTER_KEY),
  'https://countapi.mileshilliard.com/api/v1/hit/running_page_visits',
  'a hit posts to the increment endpoint'
);

assert.equal(
  visitCounterUrl('get', VISIT_COUNTER_KEY),
  'https://countapi.mileshilliard.com/api/v1/get/running_page_visits',
  'a read uses the read endpoint'
);

assert.equal(
  visitCounterUrl('hit', 'a key/with spaces'),
  'https://countapi.mileshilliard.com/api/v1/hit/a%20key%2Fwith%20spaces',
  'a key is escaped before it goes into the url'
);

assert.equal(
  dailyVisitKey('2026-10-28'),
  'running_page_visits_2026-10-28',
  'every day counts into its own key'
);

assert.equal(
  utcDate(new Date('2026-10-28T23:59:59Z')),
  '2026-10-28',
  'the day key follows utc'
);

// --- the value the counter answers with ------------------------------------

assert.equal(
  parseCounterValue({ key: 'running_page_visits', value: '12' }),
  12,
  'the counter answers with a string'
);

assert.equal(
  parseCounterValue({ key: 'running_page_visits', value: 7 }),
  7,
  'a number is read as it is'
);

assert.equal(
  parseCounterValue({ error: 'Key not found' }),
  null,
  'a missing key has no count'
);

assert.equal(parseCounterValue({}), null, 'an empty answer has no count');
assert.equal(parseCounterValue(null), null, 'no answer has no count');
assert.equal(
  parseCounterValue({ value: 'abc' }),
  null,
  'a broken count is dropped'
);
assert.equal(
  parseCounterValue({ value: -3 }),
  null,
  'a negative count is dropped'
);

// --- the numbers on the panel ----------------------------------------------

assert.equal(formatVisitCount(1234), '1,234', 'a big count gets separators');
assert.equal(formatVisitCount(0), '0', 'no visit is zero');
assert.equal(formatVisitCount(-5), '0', 'a broken count never shows a minus');

// --- the daily record ------------------------------------------------------

const merged = mergeVisitDays([
  { date: '2026-10-26', count: 3 },
  { date: '2026-10-24', count: 1 },
  { date: '2026-10-25', count: 2 },
]);

assert.deepEqual(
  merged,
  [
    { date: '2026-10-24', count: 1 },
    { date: '2026-10-25', count: 2 },
    { date: '2026-10-26', count: 3 },
  ],
  'the days are sorted by date'
);

assert.deepEqual(
  mergeVisitDays([
    { date: '2026-10-25', count: 2 },
    { date: '2026-10-25', count: 5 },
  ]),
  [{ date: '2026-10-25', count: 5 }],
  'a day that shows up twice keeps the last count'
);

assert.deepEqual(
  mergeVisitDays([
    { date: '2026-10-25', count: 2 },
    { date: 'broken', count: 1 },
    { date: '2026-10-26', count: 'many' },
  ]),
  [
    { date: '2026-10-25', count: 2 },
    { date: '2026-10-26', count: 0 },
  ],
  'a broken day does not break the record'
);

const many = Array.from({ length: VISIT_HISTORY_DAYS + 5 }, (_, index) => ({
  date: `2026-10-${String(index + 1).padStart(2, '0')}`,
  count: index,
}));

assert.equal(
  mergeVisitDays(many).length,
  VISIT_HISTORY_DAYS,
  'the record only keeps the last days'
);

assert.equal(
  mergeVisitDays(many)[0].date,
  '2026-10-06',
  'the oldest days fall off the front'
);

// --- the snapshot the site ships -------------------------------------------

const snapshot = readVisitSnapshot({
  total: 42,
  updatedAt: '2026-10-28T01:30:00Z',
  days: [
    { date: '2026-10-27', count: 4 },
    { date: '2026-10-28', count: 9 },
  ],
});

assert.equal(snapshot.total, 42, 'the snapshot keeps the total');
assert.equal(snapshot.days.length, 2, 'the snapshot keeps the days');
assert.equal(
  snapshot.updatedAt,
  '2026-10-28T01:30:00Z',
  'the snapshot keeps the day it was written'
);

const empty = readVisitSnapshot({});
assert.equal(empty.total, 0, 'a snapshot without a total counts zero');
assert.deepEqual(empty.days, [], 'a snapshot without days has no record');

const broken = readVisitSnapshot({ total: 'many', days: 'none' });
assert.equal(broken.total, 0, 'a broken total counts zero');
assert.deepEqual(broken.days, [], 'broken days are dropped');

// --- the chart --------------------------------------------------------------

const bars = visitChartBars([
  { date: '2026-10-26', count: 0 },
  { date: '2026-10-27', count: 5 },
  { date: '2026-10-28', count: 2 },
]);

assert.equal(bars.length, 3, 'every day gets a bar');
assert.equal(bars[1].ratio, 1, 'the busiest day fills the chart');
assert.equal(bars[0].ratio, 0, 'a quiet day stays flat');
assert.equal(bars[2].ratio, 0.4, 'a bar follows the busiest day');

// --- the count of a single day ----------------------------------------------

assert.equal(
  countForDate(
    [
      { date: '2026-10-27', count: 4 },
      { date: '2026-10-28', count: 9 },
    ],
    '2026-10-28'
  ),
  9,
  'the count of the given day comes from the record'
);

assert.equal(
  countForDate(
    [
      { date: '2026-10-27', count: 4 },
      { date: '2026-10-28', count: 9 },
    ],
    '2026-10-29'
  ),
  0,
  'a day the record does not hold counts zero'
);

assert.equal(countForDate([], '2026-10-28'), 0, 'an empty record counts zero');
