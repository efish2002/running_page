export interface MetricLike {
  id?: string;
  name?: string;
  start_date: string;
  distance?: number;
  duration?: number;
  vo2_max?: number;
  elevation_gain?: number;
  elevation_loss?: number;
  max_elevation?: number;
  min_elevation?: number;
  max_hr?: number;
  avg_hr?: number;
  aerobic_te?: number;
  anaerobic_te?: number;
  training_load?: number;
  avg_cadence?: number;
  max_cadence?: number;
}

export interface ActivityLike {
  run_id: number;
  distance: number;
  moving_time: string;
  start_date: string;
  start_date_local: string;
}

export interface MonthBucket {
  month: string;
  runs: number;
  distance: number;
  movingTime: number;
  longestRun: number;
  elevationGain: number;
  maxElevation: number;
  climbRate: number;
  aerobicTe: number | null;
  vo2Max: number | null;
  trainingLoad: number | null;
  avgHr: number | null;
}

export interface Vo2Point {
  date: string;
  value: number;
  average: number | null;
  x: number;
}

// A metric is only trusted when it starts close to the activity it belongs to
const MATCH_WINDOW_MS = 45 * 60 * 1000;
const AVERAGE_WINDOW_DAYS = 30;

const parseUtc = (value: string): number =>
  new Date(`${value.replace(' ', 'T')}Z`).getTime();

export const movingTimeSeconds = (movingTime: string): number => {
  if (!movingTime) {
    return 0;
  }
  const splits = movingTime.split(', ');
  const days = splits.length === 2 ? parseInt(splits[0], 10) : 0;
  const time = splits[splits.length - 1];
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
};

/**
 * Garmin records the start of an activity a few seconds apart from the first
 * point of the track, so a metric belongs to the activity that starts closest
 * to it on the same day.
 */
export const matchMetrics = (
  activities: ActivityLike[],
  metrics: MetricLike[]
): Map<number, MetricLike> => {
  const byDay = new Map<string, MetricLike[]>();
  metrics.forEach((metric) => {
    const day = metric.start_date.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) {
      bucket.push(metric);
    } else {
      byDay.set(day, [metric]);
    }
  });

  const matched = new Map<number, MetricLike>();
  activities.forEach((activity) => {
    const candidates = byDay.get(activity.start_date.slice(0, 10));
    if (!candidates || !candidates.length) {
      return;
    }
    const target = parseUtc(activity.start_date);
    let best: MetricLike | null = null;
    let bestDistance = Infinity;
    candidates.forEach((candidate) => {
      const distance = Math.abs(parseUtc(candidate.start_date) - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    });
    if (best && bestDistance <= MATCH_WINDOW_MS) {
      matched.set(activity.run_id, best);
    }
  });
  return matched;
};

const inYear = (activity: ActivityLike, year: string): boolean =>
  year === 'Total' || activity.start_date_local.slice(0, 4) === year;

interface MonthValues {
  aerobicTe: number[];
  vo2Max: number[];
  trainingLoad: number[];
  avgHr: number[];
}

const valuesFor = (values: Map<string, MonthValues>, month: string) => {
  const found = values.get(month);
  if (found) {
    return found;
  }
  const created: MonthValues = {
    aerobicTe: [],
    vo2Max: [],
    trainingLoad: [],
    avgHr: [],
  };
  values.set(month, created);
  return created;
};

const average = (list: number[] | undefined) =>
  list?.length
    ? list.reduce((sum, value) => sum + value, 0) / list.length
    : null;

/**
 * One bucket per month with the volume of the month and the metrics Garmin
 * recorded for the runs inside it.
 */
export const monthBuckets = (
  activities: ActivityLike[],
  metrics: MetricLike[],
  year: string
): MonthBucket[] => {
  const matched = matchMetrics(activities, metrics);
  const buckets = new Map<string, MonthBucket>();
  const values = new Map<string, MonthValues>();

  activities
    .filter((activity) => inYear(activity, year))
    .forEach((activity) => {
      const month = activity.start_date_local.slice(0, 7);
      const bucket =
        buckets.get(month) ??
        ({
          month,
          runs: 0,
          distance: 0,
          movingTime: 0,
          longestRun: 0,
          elevationGain: 0,
          maxElevation: 0,
          climbRate: 0,
          aerobicTe: null,
          vo2Max: null,
          trainingLoad: null,
          avgHr: null,
        } as MonthBucket);

      bucket.runs += 1;
      bucket.distance += activity.distance;
      bucket.movingTime += movingTimeSeconds(activity.moving_time);
      bucket.longestRun = Math.max(bucket.longestRun, activity.distance);

      const metric = matched.get(activity.run_id);
      if (metric) {
        if (typeof metric.elevation_gain === 'number') {
          bucket.elevationGain += metric.elevation_gain;
        }
        if (typeof metric.max_elevation === 'number') {
          bucket.maxElevation = Math.max(
            bucket.maxElevation,
            metric.max_elevation
          );
        }
        const monthValues = valuesFor(values, month);
        if (typeof metric.aerobic_te === 'number') {
          monthValues.aerobicTe.push(metric.aerobic_te);
        }
        if (typeof metric.vo2_max === 'number') {
          monthValues.vo2Max.push(metric.vo2_max);
        }
        if (typeof metric.training_load === 'number') {
          monthValues.trainingLoad.push(metric.training_load);
        }
        if (typeof metric.avg_hr === 'number') {
          monthValues.avgHr.push(metric.avg_hr);
        }
      }

      buckets.set(month, bucket);
    });

  const result = [...buckets.values()].sort((a, b) =>
    a.month < b.month ? -1 : 1
  );
  result.forEach((bucket) => {
    bucket.climbRate =
      bucket.distance > 0 ? bucket.elevationGain / (bucket.distance / 1000) : 0;
    const monthValues = values.get(bucket.month);
    bucket.aerobicTe = average(monthValues?.aerobicTe);
    bucket.vo2Max = average(monthValues?.vo2Max);
    bucket.trainingLoad = average(monthValues?.trainingLoad);
    bucket.avgHr = average(monthValues?.avgHr);
  });
  return result;
};

/**
 * The VO2 max Garmin recorded for every run of the year, together with the
 * average of the last thirty days.
 */
export const vo2Trend = (
  activities: ActivityLike[],
  metrics: MetricLike[],
  year: string
): Vo2Point[] => {
  const matched = matchMetrics(activities, metrics);
  const points: Array<Omit<Vo2Point, 'x'> & { time: number }> = [];

  activities
    .filter((activity) => inYear(activity, year))
    .forEach((activity) => {
      const metric = matched.get(activity.run_id);
      if (!metric || typeof metric.vo2_max !== 'number') {
        return;
      }
      points.push({
        date: activity.start_date_local.slice(0, 10),
        value: metric.vo2_max,
        average: null,
        time: parseUtc(activity.start_date),
      });
    });

  points.sort((a, b) => a.time - b.time);
  const first = points.length ? points[0].time : 0;
  return points.map((point) => {
    const from = point.time - AVERAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const window = points.filter(
      (item) => item.time >= from && item.time <= point.time
    );
    const average = window.length
      ? window.reduce((sum, item) => sum + item.value, 0) / window.length
      : null;
    return {
      date: point.date,
      value: point.value,
      average,
      x: Math.round((point.time - first) / (24 * 60 * 60 * 1000)),
    };
  });
};
