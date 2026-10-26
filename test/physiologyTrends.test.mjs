import assert from 'node:assert/strict';
import {
  matchMetrics,
  monthBuckets,
  vo2Trend,
} from '../src/components/PhysiologyTrends/trend.ts';

const activity = (run_id, distance, start_date_local, start_date) => ({
  run_id,
  distance,
  moving_time: '0:30:00',
  start_date,
  start_date_local,
});

const metric = (start_date, extra = {}) => ({
  start_date,
  ...extra,
});

// --- matchMetrics -------------------------------------------------------

const activities = [
  activity(1, 8000, '2026-03-02 07:10:00', '2026-03-01 23:10:00'),
  activity(2, 5000, '2026-04-05 19:00:00', '2026-04-05 11:00:00'),
];
const metrics = [
  metric('2026-03-01 23:12:00', { vo2_max: 51 }),
  metric('2026-04-05 11:20:00', { vo2_max: 52 }),
  metric('2026-04-06 09:00:00', { vo2_max: 53 }),
];

const matched = matchMetrics(activities, metrics);
assert.equal(matched.get(1).vo2_max, 51, 'the closest metric of the day wins');
assert.equal(
  matched.get(2).vo2_max,
  52,
  'a metric from another day is never used'
);
assert.equal(matched.size, 2, 'every activity found its metric');

// a metric far away on the same day is not a match
const farAway = matchMetrics(
  [activity(3, 8000, '2026-03-02 07:10:00', '2026-03-01 23:10:00')],
  [metric('2026-03-01 21:00:00', { vo2_max: 40 })]
);
assert.equal(farAway.size, 0, 'a metric hours away is not a match');

// --- monthBuckets --------------------------------------------------------

const buckets = monthBuckets(
  [
    activity(1, 8000, '2026-03-02 07:10:00', '2026-03-01 23:10:00'),
    activity(2, 12000, '2026-03-20 07:10:00', '2026-03-19 23:10:00'),
    activity(3, 5000, '2026-04-05 19:00:00', '2026-04-05 11:00:00'),
    activity(4, 9000, '2025-12-05 19:00:00', '2025-12-05 11:00:00'),
  ],
  [
    metric('2026-03-01 23:12:00', {
      elevation_gain: 300,
      max_elevation: 800,
      training_load: 120,
      avg_hr: 150,
    }),
    metric('2026-03-19 23:12:00', {
      elevation_gain: 100,
      max_elevation: 700,
      training_load: 80,
      avg_hr: 160,
    }),
    metric('2026-04-05 11:20:00', { elevation_gain: 50, max_elevation: 600 }),
  ],
  '2026'
);

assert.equal(buckets.length, 2, 'only the months of the year are kept');
assert.equal(buckets[0].month, '2026-03');
assert.equal(buckets[0].runs, 2);
assert.equal(buckets[0].distance, 20000, 'the distance of the month is summed');
assert.equal(buckets[0].longestRun, 12000, 'the longest run of the month');
assert.equal(buckets[0].movingTime, 3600, 'the moving time of the month');
assert.equal(buckets[0].elevationGain, 400, 'the climb of the month is summed');
assert.equal(buckets[0].maxElevation, 800, 'the highest point of the month');
assert.equal(buckets[0].climbRate, 20, 'the climb per kilometre of the month');
assert.equal(
  buckets[0].trainingLoad,
  100,
  'the training load of the month is averaged'
);
assert.equal(buckets[0].avgHr, 155, 'the heart rate of the month is averaged');
assert.equal(buckets[1].month, '2026-04');
assert.equal(buckets[1].runs, 1);
assert.equal(
  buckets[1].trainingLoad,
  null,
  'a month without metrics has no load'
);
assert.equal(
  buckets[1].avgHr,
  null,
  'a month without metrics has no heart rate'
);

const total = monthBuckets(
  [
    activity(1, 8000, '2026-03-02 07:10:00', '2026-03-01 23:10:00'),
    activity(4, 9000, '2025-12-05 19:00:00', '2025-12-05 11:00:00'),
  ],
  [],
  'Total'
);
assert.equal(total.length, 2, 'the total view keeps every month');
assert.equal(total[0].month, '2025-12');
assert.equal(total[1].month, '2026-03');

// --- vo2Trend ------------------------------------------------------------

const vo2 = vo2Trend(
  [
    activity(1, 8000, '2026-03-02 07:10:00', '2026-03-01 23:10:00'),
    activity(2, 8000, '2026-03-10 07:10:00', '2026-03-09 23:10:00'),
    activity(3, 8000, '2026-03-12 07:10:00', '2026-03-11 23:10:00'),
    activity(4, 8000, '2025-12-05 19:00:00', '2025-12-05 11:00:00'),
  ],
  [
    metric('2026-03-01 23:12:00', { vo2_max: 50 }),
    metric('2026-03-09 23:12:00', { vo2_max: 52 }),
    metric('2026-03-11 23:12:00', { vo2_max: 54 }),
    metric('2025-12-05 11:20:00', { vo2_max: 48 }),
  ],
  '2026'
);

assert.equal(vo2.length, 3, 'only the activities of the year are kept');
assert.equal(vo2[0].value, 50);
assert.equal(vo2[2].value, 54);
assert.equal(vo2[0].average, 50, 'the first value is its own average');
assert.equal(vo2[2].average, 52, 'the average covers the last thirty days');
assert.equal(vo2[1].average, 51, 'the average covers the last thirty days');

const vo2Total = vo2Trend(
  [
    activity(1, 8000, '2026-03-02 07:10:00', '2026-03-01 23:10:00'),
    activity(4, 8000, '2025-12-05 19:00:00', '2025-12-05 11:00:00'),
  ],
  [
    metric('2026-03-01 23:12:00', { vo2_max: 50 }),
    metric('2025-12-05 11:20:00', { vo2_max: 48 }),
  ],
  'Total'
);
assert.equal(vo2Total.length, 2, 'the total view keeps every year');
assert.equal(
  vo2Total[0].date,
  '2025-12-05',
  'the points start with the oldest run'
);
assert.equal(
  vo2Total[1].x,
  87,
  'the position counts the days since the first run'
);

console.log('physiology trend tests passed');
