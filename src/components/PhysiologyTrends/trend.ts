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
  name?: string;
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
// The track of the file and the length the API reports differ by a few metres
const DISTANCE_TOLERANCE = 0.05;
const DISTANCE_SLACK = 200;

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

const sameRun = (activity: ActivityLike, metric: MetricLike): boolean => {
  if (
    typeof activity.distance !== 'number' ||
    typeof metric.distance !== 'number' ||
    activity.distance <= 0 ||
    metric.distance <= 0
  ) {
    return true;
  }
  const slack = Math.max(
    DISTANCE_SLACK,
    activity.distance * DISTANCE_TOLERANCE
  );
  return Math.abs(activity.distance - metric.distance) <= slack;
};

/**
 * Garmin names a run after the place it started in, so two activities that
 * carry the same name are the same run. The name is what identifies a run
 * when the recorded track is shorter than the activity Garmin measured.
 */
const sameName = (activity: ActivityLike, metric: MetricLike): boolean =>
  typeof activity.name === 'string' &&
  activity.name.length > 0 &&
  activity.name === metric.name;

const shiftDay = (day: string, offset: number): string => {
  const time = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(time)) {
    return day;
  }
  return new Date(time + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
};

/**
 * Garmin records the start of an activity a few seconds apart from the first
 * point of the track, so a metric belongs to the activity that starts closest
 * to it on the same day. A metric is given to one activity only and the run
 * has to be the same one, either because the names agree or because the
 * length of the track agrees.
 */
export const matchMetrics = (
  activities: ActivityLike[],
  metrics: MetricLike[]
): Map<number, MetricLike> => {
  const byDay = new Map<string, number[]>();
  metrics.forEach((metric, index) => {
    if (typeof metric?.start_date !== 'string') {
      return;
    }
    const day = metric.start_date.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) {
      bucket.push(index);
    } else {
      byDay.set(day, [index]);
    }
  });

  const pairs: Array<{
    activity: ActivityLike;
    metric: MetricLike;
    gap: number;
  }> = [];
  activities.forEach((activity) => {
    if (typeof activity.start_date !== 'string') {
      return;
    }
    const day = activity.start_date.slice(0, 10);
    const target = parseUtc(activity.start_date);
    // a run that starts at night may cross midnight, so the neighbours count
    [-1, 0, 1].forEach((offset) => {
      const candidates = byDay.get(shiftDay(day, offset));
      if (!candidates) {
        return;
      }
      candidates.forEach((index) => {
        const candidate = metrics[index];
        const gap = Math.abs(parseUtc(candidate.start_date) - target);
        if (gap > MATCH_WINDOW_MS) {
          return;
        }
        if (!sameName(activity, candidate) && !sameRun(activity, candidate)) {
          return;
        }
        pairs.push({ activity, metric: candidate, gap });
      });
    });
  });

  pairs.sort((a, b) => a.gap - b.gap);

  const matched = new Map<number, MetricLike>();
  const takenMetrics = new Set<MetricLike>();
  const takenActivities = new Set<number>();
  pairs.forEach((pair) => {
    // a metric belongs to one run and a run keeps the metric that fits best
    if (
      takenMetrics.has(pair.metric) ||
      takenActivities.has(pair.activity.run_id)
    ) {
      return;
    }
    takenMetrics.add(pair.metric);
    takenActivities.add(pair.activity.run_id);
    matched.set(pair.activity.run_id, pair.metric);
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
