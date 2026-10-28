// The site counts its own visits with a free counter that needs no account.
// The browser posts one hit per page load, the daily job snapshots the same
// counter into src/static/visits.json so the panel still has a record when
// the counter cannot be reached.
export const VISIT_COUNTER_BASE = 'https://countapi.mileshilliard.com/api/v1';
export const VISIT_COUNTER_KEY = 'running_page_visits';
export const VISIT_HISTORY_DAYS = 14;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface VisitDay {
  date: string;
  count: number;
}

export interface VisitSnapshot {
  total: number;
  updatedAt: string;
  days: VisitDay[];
}

export interface VisitChartBar extends VisitDay {
  ratio: number;
}

export const visitCounterUrl = (kind: 'hit' | 'get', key: string) =>
  `${VISIT_COUNTER_BASE}/${kind}/${encodeURIComponent(key)}`;

export const dailyVisitKey = (date: string) => `${VISIT_COUNTER_KEY}_${date}`;

export const utcDate = (now: Date = new Date()) =>
  now.toISOString().slice(0, 10);

export const parseCounterValue = (payload: unknown): number | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const raw = (payload as { value?: unknown }).value;
  const count = typeof raw === 'number' ? raw : Number(raw);

  return Number.isFinite(count) && count >= 0 ? count : null;
};

export const formatVisitCount = (count: number) =>
  new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(count)));

export const mergeVisitDays = (
  days: VisitDay[],
  limit: number = VISIT_HISTORY_DAYS
): VisitDay[] => {
  const byDate = new Map<string, number>();

  days.forEach((day) => {
    if (!day || !DAY_PATTERN.test(day.date)) {
      return;
    }
    const count = Number(day.count);
    byDate.set(day.date, Number.isFinite(count) && count > 0 ? count : 0);
  });

  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-limit)
    .map(([date, count]) => ({ date, count }));
};

export const readVisitSnapshot = (raw: unknown): VisitSnapshot => {
  if (!raw || typeof raw !== 'object') {
    return { total: 0, updatedAt: '', days: [] };
  }

  const source = raw as {
    total?: unknown;
    updatedAt?: unknown;
    days?: unknown;
  };
  const total = Number(source.total);
  const days = Array.isArray(source.days) ? (source.days as VisitDay[]) : [];

  return {
    total: Number.isFinite(total) && total > 0 ? total : 0,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    days: mergeVisitDays(days),
  };
};

export const visitChartBars = (days: VisitDay[]): VisitChartBar[] => {
  const busiest = Math.max(1, ...days.map((day) => day.count));

  return days.map((day) => ({
    date: day.date,
    count: day.count,
    ratio: day.count / busiest,
  }));
};
