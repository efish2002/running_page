import assert from 'node:assert/strict';
import {
  ACWR_LABELS,
  BALANCE_LABELS,
  HRV_LABELS,
  READINESS_LABELS,
  TONE_COLOURS,
  TONE_LABELS,
  TREND_LABELS,
  baselineBand,
  dayAxis,
  dayLabel,
  dailyValues,
  inYear,
  latestOf,
  loadBalanceOf,
  monthLabel,
  monthTicks,
  movingAverage,
  readinessFactors,
  statusStrip,
  toneOf,
} from '../src/components/TrainingStatus/trend.ts';

const status = (date, phrase, extra = {}) => ({
  date,
  phrase,
  status: 4,
  ...extra,
});

// --- toneOf ---------------------------------------------------------------

assert.equal(toneOf('MAINTAINING_2'), 'maintaining', 'the level is read');
assert.equal(toneOf('PEAKING_1'), 'peak');
assert.equal(toneOf('PRODUCTIVE_3'), 'productive');
assert.equal(toneOf('RECOVERY_2'), 'recovery');
assert.equal(toneOf('DETRAINING_1'), 'detraining');
assert.equal(toneOf('OVERREACHING_1'), 'overreaching');
assert.equal(toneOf('UNPRODUCTIVE_2'), 'unproductive');
assert.equal(toneOf('STRAINED_1'), 'strained');
assert.equal(toneOf('NO_STATUS_1'), 'none');
assert.equal(toneOf(''), 'none', 'a day without a level has no tone');
assert.equal(toneOf(undefined), 'none');
assert.equal(toneOf('SOMETHING_NEW'), 'none', 'an unknown level has no tone');

assert.equal(TONE_LABELS.maintaining, '维持');
assert.equal(TONE_LABELS.productive, '高效');
assert.equal(TONE_LABELS.recovery, '恢复');
assert.notEqual(
  TONE_COLOURS.maintaining,
  TONE_COLOURS.productive,
  'every level has its own colour'
);
assert.notEqual(TONE_COLOURS.recovery, TONE_COLOURS.detraining);

// --- inYear ---------------------------------------------------------------

assert.equal(inYear('2026-03-02', '2026'), true);
assert.equal(inYear('2025-03-02', '2026'), false);
assert.equal(inYear('2025-03-02', 'Total'), true, 'the total view keeps it');

// --- dayAxis ---------------------------------------------------------------

const yearAxis = dayAxis(
  [{ date: '2026-03-01' }, { date: '2026-04-02' }],
  '2026'
);
assert.equal(
  yearAxis.start,
  '2026-01-01',
  'a year starts on the first of January'
);
assert.equal(yearAxis.end, '2026-04-02', 'a year ends on the last day it has');

const totalAxis = dayAxis(
  [{ date: '2025-12-31' }, { date: '2026-04-02' }],
  'Total'
);
assert.equal(
  totalAxis.start,
  '2025-12-31',
  'the total view starts at the first day it has'
);
assert.equal(totalAxis.end, '2026-04-02');

assert.equal(
  dayAxis([{ date: '2025-03-02' }], '2026'),
  null,
  'a year without a single day has no axis'
);

// --- dailyValues -----------------------------------------------------------

const days = dailyValues(
  [
    { date: '2026-03-01', score: 40 },
    { date: '2026-03-03', score: 60 },
  ],
  { start: '2026-03-01', end: '2026-03-03' },
  (row) => row.score
);
assert.equal(days.length, 3, 'every day of the axis is a point');
assert.equal(days[0].value, 40);
assert.equal(days[1].value, null, 'a day without a value breaks the line');
assert.equal(days[2].value, 60);

const emptyDay = dailyValues(
  [{ date: '2026-03-01', score: null }],
  { start: '2026-03-01', end: '2026-03-01' },
  (row) => row.score
);
assert.equal(emptyDay[0].value, null, 'a day without a reading is empty');

// --- movingAverage ---------------------------------------------------------

assert.deepEqual(
  movingAverage([1, 2, 3, 4, 5, 6, 7], 3),
  [1, 1.5, 2, 3, 4, 5, 6],
  'the average looks back over the window'
);
assert.deepEqual(
  movingAverage([null, 2, 3], 2),
  [null, 2, 2.5],
  'the days without a value are left out'
);
assert.deepEqual(movingAverage([null, null], 7), [null, null]);

// --- monthTicks ------------------------------------------------------------

const ticks = monthTicks({ start: '2026-01-01', end: '2026-03-05' }, '2026');
assert.equal(ticks.length, 3, 'a tick for every month of the axis');
assert.equal(ticks[0].index, 0);
assert.equal(ticks[0].label, '01');
assert.equal(ticks[1].label, '02');
assert.equal(ticks[2].label, '03');

const totalTicks = monthTicks(
  { start: '2025-10-26', end: '2026-01-10' },
  'Total'
);
assert.equal(totalTicks[0].label, '25-10', 'the total view names the year');
assert.equal(totalTicks[1].label, '25-11');
assert.equal(totalTicks[2].label, '25-12');
assert.equal(totalTicks[3].label, '26-01');

// --- dayLabel --------------------------------------------------------------

assert.equal(dayLabel('2026-10-26', '2026'), '10-26');
assert.equal(
  dayLabel('2025-10-26', 'Total'),
  '2025-10-26',
  'the total view keeps the whole date'
);

// --- statusStrip ----------------------------------------------------------

const strip = statusStrip(
  [
    status('2026-03-01', 'MAINTAINING_2'),
    status('2026-03-02', 'PRODUCTIVE_1'),
    status('2025-12-31', 'RECOVERY_1'),
    status('2026-03-03', ''),
  ],
  '2026'
);
assert.equal(strip.length, 3, 'the days of the year are kept');
assert.equal(strip[0].tone, 'maintaining');
assert.equal(strip[1].tone, 'productive');
assert.equal(strip[2].tone, 'none', 'a day without a level has no colour');

// --- latestOf -------------------------------------------------------------

const latest = latestOf([
  { date: '2026-03-01' },
  { date: '2026-04-02' },
  { date: '2026-03-15' },
]);
assert.equal(latest.date, '2026-04-02', 'the newest day wins');
assert.equal(latestOf([]), null);

// --- baselineBand ---------------------------------------------------------

const band = baselineBand({
  date: '2026-10-25',
  status: 'UNBALANCED',
  last_night_avg: 41,
  low_upper: 40,
  balanced_low: 43,
  balanced_upper: 58,
});
assert.equal(band.low, 40, 'the low end of the baseline');
assert.equal(band.balancedLow, 43);
assert.equal(band.balancedHigh, 58);
assert.equal(
  baselineBand({ date: '2026-10-25' }).balancedHigh,
  null,
  'a night without a baseline has no band'
);

// --- readinessFactors -----------------------------------------------------

const factors = readinessFactors({
  date: '2026-10-25',
  hrv_factor: 57,
  sleep_factor: 50,
  stress_factor: 78,
  acwr_factor: 89,
});
assert.equal(factors.length, 4, 'the readiness is built from four factors');
assert.equal(factors[0].label, 'HRV');
assert.equal(factors[0].value, 57);
assert.equal(factors[3].value, 89);

// --- loadBalanceOf --------------------------------------------------------

const balances = loadBalanceOf(
  [
    { date: '2026-03-01', month: '2026-03', aerobic_low: 900 },
    { date: '2026-04-01', month: '2026-04', aerobic_low: 1100 },
    { date: '2025-12-01', month: '2025-12', aerobic_low: 700 },
  ],
  '2026'
);
assert.equal(balances.length, 2, 'only the months of the year are kept');
assert.equal(balances[1].month, '2026-04');

// --- the labels Garmin actually sends -------------------------------------

assert.equal(HRV_LABELS.BALANCED, '平衡');
assert.equal(HRV_LABELS.UNBALANCED, '不平衡');
assert.equal(HRV_LABELS.LOW, '偏低');
assert.equal(HRV_LABELS.NONE, '无数据', 'a night without a reading');

assert.equal(READINESS_LABELS.HIGH, '良好');
assert.equal(READINESS_LABELS.MODERATE, '一般');
assert.equal(READINESS_LABELS.LOW, '偏低');
assert.equal(READINESS_LABELS.POOR, '较差');

assert.equal(TREND_LABELS.ACCLIMATIZING, '适应中');
assert.equal(TREND_LABELS.ACCLIMATED, '已适应');
assert.equal(TREND_LABELS.DEACCLIMATIZING, '脱适应');

assert.equal(BALANCE_LABELS.BALANCED, '均衡');
assert.equal(BALANCE_LABELS.ANAEROBIC_SHORTAGE, '无氧不足');
assert.ok(BALANCE_LABELS.AEROBIC_LOW_SHORTAGE, 'a low aerobic shortage');
assert.ok(BALANCE_LABELS.AEROBIC_HIGH_SHORTAGE, 'a high aerobic shortage');
assert.ok(BALANCE_LABELS.AEROBIC_HIGH_FOCUS, 'a focus on the high aerobic');

assert.equal(ACWR_LABELS.OPTIMAL, '最佳');
assert.equal(ACWR_LABELS.LOW, '偏低');
assert.equal(ACWR_LABELS.HIGH, '偏高');
assert.equal(ACWR_LABELS.VERY_HIGH, '极高');

// --- monthLabel -----------------------------------------------------------

assert.equal(
  monthLabel('2026-01', '2026'),
  '01',
  'a single year shows the month'
);
assert.equal(monthLabel('2026-10', '2026'), '10');

assert.equal(
  monthLabel('2025-10', 'Total'),
  '25-10',
  'the total view has two octobers, so the year has to be there'
);
assert.equal(monthLabel('2026-10', 'Total'), '26-10');

console.log('training status tests passed');
