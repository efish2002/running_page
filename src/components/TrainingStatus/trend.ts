export interface StatusRecord {
  date: string;
  status?: number | null;
  phrase?: string;
  fitness_trend?: number | null;
  since?: string;
  acute_load?: number | null;
  chronic_load?: number | null;
  chronic_max?: number | null;
  chronic_min?: number | null;
  acwr?: number | null;
  acwr_percent?: number | null;
  acwr_status?: string;
}

export interface HrvRecord {
  date: string;
  status?: string;
  phrase?: string;
  last_night_avg?: number | null;
  last_night_high?: number | null;
  weekly_avg?: number | null;
  low_upper?: number | null;
  balanced_low?: number | null;
  balanced_upper?: number | null;
  marker?: number | null;
}

export interface ReadinessRecord {
  date: string;
  score?: number | null;
  level?: string;
  feedback?: string;
  recovery_time?: number | null;
  sleep_score?: number | null;
  hrv_factor?: number | null;
  sleep_factor?: number | null;
  stress_factor?: number | null;
  acwr_factor?: number | null;
  acute_load?: number | null;
  hrv_weekly_avg?: number | null;
}

export interface AcclimationRecord {
  date: string;
  altitude?: number | null;
  percentage?: number | null;
  trend?: string | null;
  current_altitude?: number | null;
  heat_percentage?: number | null;
  heat_trend?: string | null;
}

export interface Vo2Record {
  date: string;
  value: number;
  precise?: number | null;
}

export interface LoadBalanceRecord {
  date: string;
  month: string;
  aerobic_low?: number | null;
  aerobic_high?: number | null;
  anaerobic?: number | null;
  aerobic_low_min?: number | null;
  aerobic_low_max?: number | null;
  aerobic_high_min?: number | null;
  aerobic_high_max?: number | null;
  anaerobic_min?: number | null;
  anaerobic_max?: number | null;
  phrase?: string;
}

export type StatusTone =
  | 'peak'
  | 'productive'
  | 'maintaining'
  | 'recovery'
  | 'detraining'
  | 'overreaching'
  | 'unproductive'
  | 'strained'
  | 'none';

// Garmin answers with the level and a variant of it, the level is the part
// that carries the meaning
const TONE_BY_LEVEL: Record<string, StatusTone> = {
  PEAK: 'peak',
  PEAKING: 'peak',
  PRODUCTIVE: 'productive',
  MAINTAINING: 'maintaining',
  RECOVERY: 'recovery',
  DETRAINING: 'detraining',
  OVERREACHING: 'overreaching',
  UNPRODUCTIVE: 'unproductive',
  STRAINED: 'strained',
  NO_STATUS: 'none',
  UNKNOWN: 'none',
};

export const TONE_LABELS: Record<StatusTone, string> = {
  peak: '巅峰',
  productive: '高效',
  maintaining: '维持',
  recovery: '恢复',
  detraining: '退步',
  overreaching: '过载',
  unproductive: '无效',
  strained: '受限',
  none: '无数据',
};

export const TONE_COLOURS: Record<StatusTone, string> = {
  peak: 'hsl(var(--signal))',
  productive: 'hsl(var(--accent))',
  maintaining: 'hsl(var(--accent-2))',
  recovery: 'hsl(var(--good))',
  detraining: 'hsl(var(--subtle))',
  overreaching: 'hsl(var(--danger))',
  unproductive: 'hsl(var(--danger))',
  strained: 'hsl(var(--danger))',
  none: 'hsl(var(--line) / 0.22)',
};

export const HRV_LABELS: Record<string, string> = {
  BALANCED: '平衡',
  UNBALANCED: '不平衡',
  LOW: '偏低',
  POOR: '较差',
  NONE: '无数据',
};

export const READINESS_LABELS: Record<string, string> = {
  HIGH: '良好',
  MODERATE: '一般',
  LOW: '偏低',
  POOR: '较差',
};

export const TREND_LABELS: Record<string, string> = {
  ACCLIMATIZING: '适应中',
  ACCLIMATED: '已适应',
  DEACCLIMATIZING: '脱适应',
};

export const BALANCE_LABELS: Record<string, string> = {
  AEROBIC_SHORTAGE: '有氧不足',
  ANAEROBIC_SHORTAGE: '无氧不足',
  AEROBIC_LOW_SHORTAGE: '有氧低强度不足',
  AEROBIC_HIGH_SHORTAGE: '有氧高强度不足',
  AEROBIC_HIGH_FOCUS: '有氧高强度偏重',
  AEROBIC_EXCESS: '有氧过量',
  ANAEROBIC_EXCESS: '无氧过量',
  BALANCED: '均衡',
  OPTIMAL: '最佳',
};

export const ACWR_LABELS: Record<string, string> = {
  OPTIMAL: '最佳',
  HIGH: '偏高',
  VERY_HIGH: '极高',
  LOW: '偏低',
};

export const toneOf = (phrase?: string | null): StatusTone => {
  const level = String(phrase || '')
    .split('_')[0]
    .toUpperCase();
  return TONE_BY_LEVEL[level] ?? 'none';
};

export const inYear = (date: string, year: string): boolean =>
  year === 'Total' || (date || '').slice(0, 4) === year;

export interface DayAxis {
  start: string;
  end: string;
}

export interface DayValue {
  date: string;
  value: number | null;
}

export interface Tick {
  index: number;
  label: string;
}

const DAY_MS = 86400000;

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export const shiftDay = (date: string, days: number): string =>
  new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);

export const daySpan = (start: string, end: string): number =>
  Math.max(0, Math.round((toUtc(end) - toUtc(start)) / DAY_MS));

/**
 * The calendar days the view covers. A single year starts on the first of
 * January, the total view starts on the first day that carries a value.
 */
export const dayAxis = (
  records: { date: string }[],
  year: string
): DayAxis | null => {
  const dates = records
    .map((record) => record?.date)
    .filter((date): date is string => Boolean(date) && inYear(date, year))
    .sort();
  if (!dates.length) {
    return null;
  }
  return {
    start: year === 'Total' ? dates[0] : `${year}-01-01`,
    end: dates[dates.length - 1],
  };
};

/**
 * One value for every day of the axis, the days without a value stay empty
 * so that the line breaks there.
 */
export const dailyValues = <T extends { date: string }>(
  records: T[],
  axis: DayAxis,
  valueOf: (_record: T) => number | null | undefined
): DayValue[] => {
  const byDate = new Map<string, number>();
  records.forEach((record) => {
    if (!record?.date) {
      return;
    }
    const value = valueOf(record);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return;
    }
    byDate.set(record.date, value);
  });
  const total = daySpan(axis.start, axis.end);
  const days: DayValue[] = [];
  for (let index = 0; index <= total; index += 1) {
    const date = shiftDay(axis.start, index);
    days.push({ date, value: byDate.get(date) ?? null });
  }
  return days;
};

/**
 * The average of the days that lead up to every point, the days without a
 * value are left out.
 */
export const movingAverage = (
  values: (number | null)[],
  window = 7
): (number | null)[] =>
  values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1);
    const usable = slice.filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value)
    );
    if (!usable.length) {
      return null;
    }
    return usable.reduce((sum, value) => sum + value, 0) / usable.length;
  });

/**
 * A tick for the first day of every month of the axis.
 */
export const monthTicks = (axis: DayAxis, year: string): Tick[] => {
  const ticks: Tick[] = [];
  const total = daySpan(axis.start, axis.end);
  for (let index = 0; index <= total; index += 1) {
    const date = shiftDay(axis.start, index);
    if (index === 0 || date.endsWith('-01')) {
      ticks.push({ index, label: monthLabel(date.slice(0, 7), year) });
    }
  }
  return ticks;
};

/**
 * The day of a point. The total view spans several years, so the date has to
 * carry the year there.
 */
export const dayLabel = (date: string, year: string): string =>
  year === 'Total' ? date : date.slice(5);

export interface StripCell {
  date: string;
  tone: StatusTone;
  label: string;
}

/**
 * The month of a point on the axis. The total view holds two octobers, so the
 * year has to be part of the label there.
 */
export const monthLabel = (month: string, year: string): string =>
  year === 'Total' ? month.slice(2) : month.slice(5);

/**
 * One cell for every day of the year, the cell carries the level of the day.
 */
export const statusStrip = (
  records: StatusRecord[],
  year: string
): StripCell[] =>
  records
    .filter((record) => record?.date && inYear(record.date, year))
    .map((record) => {
      const tone = toneOf(record.phrase);
      return { date: record.date, tone, label: TONE_LABELS[tone] };
    });

export const latestOf = <T extends { date: string }>(
  records: T[]
): T | null => {
  if (!records.length) {
    return null;
  }
  return records.reduce((latest, record) =>
    record.date >= latest.date ? record : latest
  );
};

export interface Band {
  low: number | null;
  balancedLow: number | null;
  balancedHigh: number | null;
}

export const baselineBand = (record: HrvRecord): Band => ({
  low: record.low_upper ?? null,
  balancedLow: record.balanced_low ?? null,
  balancedHigh: record.balanced_upper ?? null,
});

export interface Factor {
  label: string;
  value: number | null;
}

export const readinessFactors = (record: ReadinessRecord): Factor[] => [
  { label: 'HRV', value: record.hrv_factor ?? null },
  { label: '睡眠', value: record.sleep_factor ?? null },
  { label: '压力', value: record.stress_factor ?? null },
  { label: '负荷', value: record.acwr_factor ?? null },
];

export const loadBalanceOf = (
  records: LoadBalanceRecord[],
  year: string
): LoadBalanceRecord[] =>
  records.filter((record) => inYear(record.month || record.date || '', year));
