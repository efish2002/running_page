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
  inYear,
  latestOf,
  loadBalanceOf,
  monthlyAverage,
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

// --- monthlyAverage -------------------------------------------------------

const readiness = [
  { date: '2026-03-01', score: 40 },
  { date: '2026-03-15', score: 60 },
  { date: '2026-04-02', score: 80 },
  { date: '2025-12-31', score: 20 },
];

const months = monthlyAverage(readiness, '2026', (row) => row.score);
assert.equal(months.length, 2, 'only the months of the year are kept');
assert.equal(months[0].month, '2026-03');
assert.equal(months[0].value, 50, 'the score of the month is averaged');
assert.equal(months[1].month, '2026-04');
assert.equal(months[1].value, 80);

const totalMonths = monthlyAverage(readiness, 'Total', (row) => row.score);
assert.equal(totalMonths.length, 3, 'the total view keeps every month');
assert.equal(totalMonths[0].month, '2025-12');

const withoutValue = monthlyAverage(
  [{ date: '2026-03-01', score: null }],
  '2026',
  (row) => row.score
);
assert.equal(
  withoutValue.length,
  0,
  'a month without a value is not part of the trend'
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

console.log('training status tests passed');
