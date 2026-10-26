import { ReactNode, useMemo } from 'react';
import { Activity } from '@/utils/utils';
import { garminMetrics, garminMetricsUpdatedAt } from '@/utils/garminMetrics';
import { monthBuckets, vo2Trend } from './trend';
import TrendChart, { ChartPoint, ChartSeries } from './TrendChart';
import styles from './style.module.css';

interface PhysiologyTrendsProps {
  activities: Activity[];
  year: string;
}

const COLORS = {
  vo2: 'hsl(var(--accent))',
  average: 'hsl(var(--accent-2))',
  endurance: 'hsl(var(--accent-2))',
  altitude: 'hsl(var(--signal))',
  load: 'hsl(var(--accent))',
  heartRate: 'hsl(var(--accent-2))',
};

const VO2_SERIES: ChartSeries[] = [
  { name: 'VO2 max', color: COLORS.vo2, kind: 'line', fill: true },
  { name: '30 日均线', color: COLORS.average, kind: 'line' },
];

const ENDURANCE_SERIES: ChartSeries[] = [
  { name: '月里程 km', color: COLORS.endurance, kind: 'bar' },
  { name: '有氧训练效应', color: COLORS.vo2, kind: 'line' },
];

const ALTITUDE_SERIES: ChartSeries[] = [
  { name: '月爬升 m', color: COLORS.altitude, kind: 'bar' },
  { name: '最高海拔 m', color: COLORS.vo2, kind: 'line' },
];

const LOAD_SERIES: ChartSeries[] = [
  { name: '月训练负荷', color: COLORS.load, kind: 'bar' },
  { name: '平均心率 bpm', color: COLORS.heartRate, kind: 'line' },
];

const round = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toFixed(digits) : '-';

interface PanelProps {
  eyebrow: string;
  chip: string;
  stats: Array<{ label: string; value: string; accent?: boolean }>;
  legend?: ReactNode;
  children: ReactNode;
}

const Panel = ({ eyebrow, chip, stats, legend, children }: PanelProps) => (
  <section className={`panel panel-bracket ${styles.panel}`}>
    <header className="panel-header">
      <span className="eyebrow">
        <span className="status-dot" />
        {eyebrow}
      </span>
      <span className="chip">{chip}</span>
    </header>
    <div className={styles.body}>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <span className="metric-label">{stat.label}</span>
            <span
              className={`metric-value ${
                stat.accent ? 'metric-value-accent' : ''
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
      {legend}
      {children}
    </div>
  </section>
);

const PhysiologyTrends = ({ activities, year }: PhysiologyTrendsProps) => {
  const buckets = useMemo(
    () => monthBuckets(activities, garminMetrics, year),
    [activities, year]
  );

  const vo2 = useMemo(
    () => vo2Trend(activities, garminMetrics, year),
    [activities, year]
  );

  const previousYear = useMemo(() => {
    const parsed = Number(year);
    return Number.isFinite(parsed) && parsed > 0 ? `${parsed - 1}` : '';
  }, [year]);

  const previousVo2 = useMemo(
    () =>
      previousYear ? vo2Trend(activities, garminMetrics, previousYear) : [],
    [activities, previousYear]
  );

  const vo2Points: ChartPoint[] = useMemo(
    () =>
      vo2.map((point) => ({
        // the total view spans several years, the month alone would be ambiguous
        label: year === 'Total' ? point.date : point.date.slice(5),
        values: [point.value, point.average ?? Number.NaN],
        x: point.x,
      })),
    [vo2, year]
  );

  const endurancePoints: ChartPoint[] = useMemo(
    () =>
      buckets.map((bucket, index) => ({
        label: bucket.month.slice(2),
        values: [bucket.distance / 1000, bucket.aerobicTe ?? Number.NaN],
        x: index,
      })),
    [buckets]
  );

  const altitudePoints: ChartPoint[] = useMemo(
    () =>
      buckets.map((bucket, index) => ({
        label: bucket.month.slice(2),
        values: [bucket.elevationGain, bucket.maxElevation || Number.NaN],
        x: index,
      })),
    [buckets]
  );

  const loadPoints: ChartPoint[] = useMemo(
    () =>
      buckets.map((bucket, index) => ({
        label: bucket.month.slice(2),
        values: [bucket.trainingLoad ?? Number.NaN, bucket.avgHr ?? Number.NaN],
        x: index,
      })),
    [buckets]
  );

  const totalDistance = buckets.reduce(
    (sum, bucket) => sum + bucket.distance,
    0
  );
  const longestRun = buckets.reduce(
    (max, bucket) => Math.max(max, bucket.longestRun),
    0
  );
  const totalGain = buckets.reduce(
    (sum, bucket) => sum + bucket.elevationGain,
    0
  );
  const highestPoint = buckets.reduce(
    (max, bucket) => Math.max(max, bucket.maxElevation),
    0
  );
  const aerobicList = buckets
    .map((bucket) => bucket.aerobicTe)
    .filter((value): value is number => value !== null);
  const aerobicAverage = aerobicList.length
    ? aerobicList.reduce((sum, value) => sum + value, 0) / aerobicList.length
    : 0;
  const loadList = buckets
    .map((bucket) => bucket.trainingLoad)
    .filter((value): value is number => value !== null);
  const loadAverage = loadList.length
    ? loadList.reduce((sum, value) => sum + value, 0) / loadList.length
    : 0;
  const loadPeak = loadList.reduce((max, value) => Math.max(max, value), 0);
  const heartRateList = buckets
    .map((bucket) => bucket.avgHr)
    .filter((value): value is number => value !== null);
  const heartRateAverage = heartRateList.length
    ? heartRateList.reduce((sum, value) => sum + value, 0) /
      heartRateList.length
    : 0;

  const latestVo2 = vo2.length ? vo2[vo2.length - 1] : null;
  const peakVo2 = vo2.reduce((max, point) => Math.max(max, point.value), 0);
  const averageVo2 = vo2.length
    ? vo2.reduce((sum, point) => sum + point.value, 0) / vo2.length
    : 0;
  const previousAverage = previousVo2.length
    ? previousVo2.reduce((sum, point) => sum + point.value, 0) /
      previousVo2.length
    : 0;
  const vo2Delta = previousAverage ? averageVo2 - previousAverage : 0;

  if (!garminMetrics.length) {
    return (
      <Panel
        eyebrow="physiology / 生理趋势"
        chip="waiting for garmin"
        stats={[
          { label: '状态', value: '待同步' },
          { label: '来源', value: 'Garmin Connect' },
        ]}
      >
        <p className={styles.note}>
          佳明生理指标（最大摄氧量、海拔、训练效应）尚未同步，运行
          <b> Run Data Sync </b>工作流后即可展示。
        </p>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        eyebrow="vo2 max / 最大摄氧量"
        chip={`${vo2.length} runs`}
        stats={[
          {
            label: '最新 VO2max',
            value: latestVo2 ? round(latestVo2.value) : '-',
            accent: true,
          },
          {
            label: year === 'Total' ? '历史峰值' : '年度峰值',
            value: peakVo2 ? round(peakVo2) : '-',
          },
          {
            label: '较上一年',
            value: previousAverage
              ? `${vo2Delta >= 0 ? '+' : ''}${round(vo2Delta)}`
              : '-',
          },
          {
            label: '30 日均线',
            value: latestVo2?.average ? round(latestVo2.average) : '-',
          },
        ]}
      >
        <TrendChart
          points={vo2Points}
          series={VO2_SERIES}
          formatValue={(value) => `${round(value)} ml/kg/min`}
          formatAxis={(value) => round(value, 0)}
        />
      </Panel>

      <Panel
        eyebrow="endurance / 耐力"
        chip={`${(totalDistance / 1000).toFixed(0)} km`}
        stats={[
          {
            label: '年度里程',
            value: `${(totalDistance / 1000).toFixed(1)} km`,
            accent: true,
          },
          {
            label: '最长单次',
            value: `${(longestRun / 1000).toFixed(1)} km`,
          },
          {
            label: '平均有氧效应',
            value: aerobicList.length ? round(aerobicAverage, 2) : '-',
          },
        ]}
      >
        <TrendChart
          points={endurancePoints}
          series={ENDURANCE_SERIES}
          formatValue={(value, index) =>
            index === 0 ? `${round(value)} km` : round(value, 2)
          }
          formatAxis={(value) => round(value, 0)}
          formatAxisRight={(value) => round(value, 1)}
        />
      </Panel>

      <Panel
        eyebrow="altitude / 海拔适应"
        chip={`${Math.round(totalGain)} m`}
        stats={[
          {
            label: '年度爬升',
            value: `${Math.round(totalGain)} m`,
            accent: true,
          },
          { label: '最高海拔', value: `${Math.round(highestPoint)} m` },
          {
            label: '爬升率',
            value: totalDistance
              ? `${round(totalGain / (totalDistance / 1000))} m/km`
              : '-',
          },
        ]}
      >
        <TrendChart
          points={altitudePoints}
          series={ALTITUDE_SERIES}
          formatValue={(value, index) =>
            index === 0 ? `${Math.round(value)} m` : `${Math.round(value)} m`
          }
          formatAxis={(value) => round(value, 0)}
          formatAxisRight={(value) => round(value, 0)}
        />
      </Panel>

      <Panel
        eyebrow="load / 训练负荷"
        chip={`${Math.round(loadAverage)} / 月`}
        stats={[
          {
            label: '平均月负荷',
            value: loadList.length ? `${Math.round(loadAverage)}` : '-',
            accent: true,
          },
          {
            label: '峰值月负荷',
            value: loadPeak ? `${Math.round(loadPeak)}` : '-',
          },
          {
            label: '平均心率',
            value: heartRateList.length
              ? `${Math.round(heartRateAverage)} bpm`
              : '-',
          },
        ]}
      >
        <TrendChart
          points={loadPoints}
          series={LOAD_SERIES}
          formatValue={(value, index) =>
            index === 0 ? `${Math.round(value)}` : `${Math.round(value)} bpm`
          }
          formatAxis={(value) => round(value, 0)}
          formatAxisRight={(value) => round(value, 0)}
        />
      </Panel>
      <p className={styles.source}>
        数据来源 Garmin Connect · 最近同步{' '}
        {garminMetricsUpdatedAt ? garminMetricsUpdatedAt.slice(0, 10) : '—'}
      </p>
    </>
  );
};

export default PhysiologyTrends;
