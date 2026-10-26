import { useMemo } from 'react';
import { Legend, Panel } from '@/components/Panel';
import TrendChart, {
  ChartPoint,
  ChartSeries,
} from '@/components/PhysiologyTrends/TrendChart';
import {
  garminTrainingUpdatedAt,
  trainingAcclimation,
  trainingHrv,
  trainingLoadBalance,
  trainingReadiness,
  trainingStatus,
  trainingVo2,
} from '@/utils/garminTraining';
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
  monthTicks,
  movingAverage,
  readinessFactors,
  statusStrip,
  toneOf,
} from './trend';
import FactorBars from './FactorBars';
import RangeBar from './RangeBar';
import StatusStrip from './StatusStrip';
import styles from './style.module.css';

interface TrainingStatusProps {
  year: string;
}

const COLORS = {
  readiness: 'hsl(var(--accent))',
  hrv: 'hsl(var(--accent-2))',
  acute: 'hsl(var(--signal))',
  chronic: 'hsl(var(--accent))',
  altitude: 'hsl(var(--accent-2))',
};

const READINESS_SERIES: ChartSeries[] = [
  {
    name: '每日恢复力',
    color: COLORS.readiness,
    kind: 'line',
    width: 1,
    opacity: 0.3,
  },
  {
    name: '7 日均线',
    color: COLORS.readiness,
    kind: 'line',
    fill: true,
    width: 2.2,
  },
];

const HRV_SERIES: ChartSeries[] = [
  { name: '夜间 HRV', color: COLORS.hrv, kind: 'line', width: 1, opacity: 0.3 },
  {
    name: '7 日均线',
    color: COLORS.hrv,
    kind: 'line',
    fill: true,
    width: 2.2,
  },
];

const LOAD_SERIES: ChartSeries[] = [
  {
    name: '短期负荷',
    color: COLORS.acute,
    kind: 'line',
    width: 1,
    opacity: 0.28,
  },
  { name: '短期负荷 7 日均', color: COLORS.acute, kind: 'line', width: 2.2 },
  {
    name: '长期负荷',
    color: COLORS.chronic,
    kind: 'line',
    width: 1.6,
    opacity: 0.9,
  },
];

const ALTITUDE_SERIES: ChartSeries[] = [
  {
    name: '每日适应',
    color: COLORS.altitude,
    kind: 'line',
    width: 1,
    opacity: 0.3,
  },
  {
    name: '7 日均线',
    color: COLORS.altitude,
    kind: 'line',
    fill: true,
    width: 2.2,
  },
];

const FITNESS_TRENDS: Record<string, string> = {
  '1': '上升',
  '2': '平稳',
  '3': '下降',
};

const round = (value: number, digits = 1) =>
  Number.isFinite(value) ? value.toFixed(digits) : '-';

const TrainingStatus = ({ year }: TrainingStatusProps) => {
  const cells = useMemo(() => statusStrip(trainingStatus, year), [year]);

  const statusOfYear = useMemo(
    () => trainingStatus.filter((record) => inYear(record.date, year)),
    [year]
  );
  const latestStatus = useMemo(() => latestOf(statusOfYear), [statusOfYear]);

  const readiness = useMemo(
    () => trainingReadiness.filter((record) => inYear(record.date, year)),
    [year]
  );
  const latestReadiness = useMemo(() => latestOf(readiness), [readiness]);

  const hrv = useMemo(
    () => trainingHrv.filter((record) => inYear(record.date, year)),
    [year]
  );
  const latestHrv = useMemo(() => latestOf(hrv), [hrv]);

  const acclimation = useMemo(
    () => trainingAcclimation.filter((record) => inYear(record.date, year)),
    [year]
  );
  const latestAcclimation = useMemo(() => latestOf(acclimation), [acclimation]);

  const vo2 = useMemo(
    () => trainingVo2.filter((record) => inYear(record.date, year)),
    [year]
  );
  const latestVo2 = useMemo(() => latestOf(vo2), [vo2]);

  const balances = useMemo(
    () => loadBalanceOf(trainingLoadBalance, year),
    [year]
  );
  const latestBalance = balances.length ? balances[balances.length - 1] : null;

  // every chart of the panel walks the same days, so they share one axis
  const axis = useMemo(
    () =>
      dayAxis(
        [
          ...trainingStatus,
          ...trainingReadiness,
          ...trainingHrv,
          ...trainingAcclimation,
        ],
        year
      ),
    [year]
  );
  const ticks = useMemo(
    () => (axis ? monthTicks(axis, year) : undefined),
    [axis, year]
  );

  const readinessPoints: ChartPoint[] = useMemo(() => {
    if (!axis) {
      return [];
    }
    const days = dailyValues(readiness, axis, (record) => record.score);
    const average = movingAverage(days.map((day) => day.value));
    return days.map((day, index) => ({
      label: dayLabel(day.date, year),
      values: [day.value ?? Number.NaN, average[index] ?? Number.NaN],
      x: index,
    }));
  }, [readiness, axis, year]);

  const hrvPoints: ChartPoint[] = useMemo(() => {
    if (!axis) {
      return [];
    }
    const days = dailyValues(hrv, axis, (record) => record.last_night_avg);
    const average = movingAverage(days.map((day) => day.value));
    return days.map((day, index) => ({
      label: dayLabel(day.date, year),
      values: [day.value ?? Number.NaN, average[index] ?? Number.NaN],
      x: index,
    }));
  }, [hrv, axis, year]);

  const loadPoints: ChartPoint[] = useMemo(() => {
    if (!axis) {
      return [];
    }
    const acute = dailyValues(
      statusOfYear,
      axis,
      (record) => record.acute_load
    );
    const chronic = dailyValues(
      statusOfYear,
      axis,
      (record) => record.chronic_load
    );
    const average = movingAverage(acute.map((day) => day.value));
    return acute.map((day, index) => ({
      label: dayLabel(day.date, year),
      values: [
        day.value ?? Number.NaN,
        average[index] ?? Number.NaN,
        chronic[index]?.value ?? Number.NaN,
      ],
      x: index,
    }));
  }, [statusOfYear, axis, year]);

  const altitudePoints: ChartPoint[] = useMemo(() => {
    if (!axis) {
      return [];
    }
    const days = dailyValues(acclimation, axis, (record) => record.altitude);
    const average = movingAverage(days.map((day) => day.value));
    return days.map((day, index) => ({
      label: dayLabel(day.date, year),
      values: [day.value ?? Number.NaN, average[index] ?? Number.NaN],
      x: index,
    }));
  }, [acclimation, axis, year]);

  const statusTone = toneOf(latestStatus?.phrase);
  const band = latestHrv ? baselineBand(latestHrv) : null;

  if (
    !trainingStatus.length &&
    !trainingReadiness.length &&
    !trainingHrv.length &&
    !trainingAcclimation.length
  ) {
    return (
      <Panel
        eyebrow="training status / 训练状态"
        chip="waiting for garmin"
        stats={[
          { label: '状态', value: '待同步' },
          { label: '来源', value: 'Garmin Connect' },
        ]}
      >
        <p className={styles.note}>
          佳明训练状态（训练状态、恢复力、HRV、训练负荷、海拔适应）尚未同步，运行
          <b> Run Data Sync </b>工作流后即可展示。
        </p>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        eyebrow="status / 训练状态"
        chip={`${cells.length} days`}
        stats={[
          {
            label: '当前状态',
            value: TONE_LABELS[statusTone],
            accent: true,
            colour: TONE_COLOURS[statusTone],
          },
          {
            label: '体能趋势',
            value: latestStatus?.fitness_trend
              ? FITNESS_TRENDS[String(latestStatus.fitness_trend)] ?? '-'
              : '-',
          },
          {
            label: '最新 VO2max',
            value: latestVo2 ? `${round(latestVo2.value)}` : '-',
          },
          {
            label: '急慢性负荷比',
            value: latestStatus?.acwr
              ? `${round(latestStatus.acwr, 2)} ${
                  ACWR_LABELS[String(latestStatus.acwr_status)] ?? ''
                }`.trim()
              : '-',
          },
        ]}
      >
        <StatusStrip cells={cells} year={year} />
      </Panel>

      <Panel
        eyebrow="recovery / 恢复力"
        chip={`${readiness.length} days`}
        stats={[
          {
            label: '当前恢复力',
            value: latestReadiness?.score
              ? `${Math.round(latestReadiness.score)} ${
                  READINESS_LABELS[String(latestReadiness.level)] ?? ''
                }`.trim()
              : '-',
            accent: true,
          },
          {
            label: '恢复时长',
            value: latestReadiness?.recovery_time
              ? `${Math.round(latestReadiness.recovery_time / 60)} h`
              : '-',
          },
          {
            label: '睡眠分',
            value: latestReadiness?.sleep_score
              ? `${Math.round(latestReadiness.sleep_score)}`
              : '-',
          },
        ]}
        legend={<Legend series={READINESS_SERIES} />}
      >
        <TrendChart
          points={readinessPoints}
          series={READINESS_SERIES}
          ticks={ticks}
          formatValue={(value) => `${Math.round(value)}`}
          formatAxis={(value) => round(value, 0)}
          height={170}
        />
        {latestReadiness && (
          <FactorBars factors={readinessFactors(latestReadiness)} />
        )}
      </Panel>

      <Panel
        eyebrow="hrv / 心率变异"
        chip={`${hrv.length} nights`}
        stats={[
          {
            label: '昨夜均值',
            value: latestHrv?.last_night_avg
              ? `${Math.round(latestHrv.last_night_avg)} ms`
              : '-',
            accent: true,
          },
          {
            label: '状态',
            value: latestHrv?.status
              ? HRV_LABELS[String(latestHrv.status)] ?? String(latestHrv.status)
              : '-',
          },
          {
            label: '周均值',
            value: latestHrv?.weekly_avg
              ? `${Math.round(latestHrv.weekly_avg)} ms`
              : '-',
          },
          {
            label: '夜间峰值',
            value: latestHrv?.last_night_high
              ? `${Math.round(latestHrv.last_night_high)} ms`
              : '-',
          },
        ]}
        legend={<Legend series={HRV_SERIES} />}
      >
        <TrendChart
          points={hrvPoints}
          series={HRV_SERIES}
          ticks={ticks}
          formatValue={(value) => `${Math.round(value)} ms`}
          formatAxis={(value) => round(value, 0)}
          height={170}
        />
        {band && (
          <RangeBar
            label="基线区间"
            value={latestHrv?.last_night_avg ?? null}
            min={band.balancedLow}
            max={band.balancedHigh}
            colour={TONE_COLOURS.recovery}
          />
        )}
      </Panel>

      <Panel
        eyebrow="load / 短期与长期负荷"
        chip={`${statusOfYear.length} days`}
        stats={[
          {
            label: '短期负荷',
            value: latestStatus?.acute_load
              ? `${Math.round(latestStatus.acute_load)}`
              : '-',
            accent: true,
          },
          {
            label: '长期负荷',
            value: latestStatus?.chronic_load
              ? `${Math.round(latestStatus.chronic_load)}`
              : '-',
          },
          {
            label: '负荷区间',
            value: latestStatus?.chronic_min
              ? `${Math.round(latestStatus.chronic_min)}-${Math.round(
                  latestStatus.chronic_max ?? 0
                )}`
              : '-',
          },
        ]}
        legend={<Legend series={LOAD_SERIES} />}
      >
        <TrendChart
          points={loadPoints}
          series={LOAD_SERIES}
          ticks={ticks}
          formatValue={(value) => `${Math.round(value)}`}
          formatAxis={(value) => round(value, 0)}
          formatAxisRight={(value) => round(value, 0)}
          height={190}
        />
        {latestBalance && (
          <div className={styles.balance}>
            <span className={styles.balanceTitle}>
              月度负荷 {latestBalance.month}
              {latestBalance.phrase
                ? ` · ${BALANCE_LABELS[latestBalance.phrase] ?? latestBalance.phrase}`
                : ''}
            </span>
            <RangeBar
              label="有氧低"
              value={latestBalance.aerobic_low ?? null}
              min={latestBalance.aerobic_low_min ?? null}
              max={latestBalance.aerobic_low_max ?? null}
              colour={TONE_COLOURS.productive}
            />
            <RangeBar
              label="有氧高"
              value={latestBalance.aerobic_high ?? null}
              min={latestBalance.aerobic_high_min ?? null}
              max={latestBalance.aerobic_high_max ?? null}
              colour={TONE_COLOURS.maintaining}
            />
            <RangeBar
              label="无氧"
              value={latestBalance.anaerobic ?? null}
              min={latestBalance.anaerobic_min ?? null}
              max={latestBalance.anaerobic_max ?? null}
              colour={TONE_COLOURS.peak}
            />
          </div>
        )}
      </Panel>

      <Panel
        eyebrow="altitude / 海拔适应"
        chip={`${acclimation.length} days`}
        stats={[
          {
            label: '当前适应',
            value: latestAcclimation?.altitude
              ? `${Math.round(latestAcclimation.altitude)} m`
              : '-',
            accent: true,
          },
          {
            label: '适应度',
            value:
              latestAcclimation?.percentage !== null &&
              latestAcclimation?.percentage !== undefined
                ? `${Math.round(latestAcclimation.percentage)}%`
                : '-',
          },
          {
            label: '当前海拔',
            value: latestAcclimation?.current_altitude
              ? `${Math.round(latestAcclimation.current_altitude)} m`
              : '-',
          },
          {
            label: '趋势',
            value: latestAcclimation?.trend
              ? TREND_LABELS[String(latestAcclimation.trend)] ?? '-'
              : '稳定',
          },
        ]}
        legend={<Legend series={ALTITUDE_SERIES} />}
      >
        <TrendChart
          points={altitudePoints}
          series={ALTITUDE_SERIES}
          ticks={ticks}
          formatValue={(value) => `${Math.round(value)} m`}
          formatAxis={(value) => round(value, 0)}
          height={170}
        />
      </Panel>

      <p className={styles.source}>
        数据来源 Garmin Connect · 最近同步{' '}
        {garminTrainingUpdatedAt ? garminTrainingUpdatedAt.slice(0, 10) : '—'}
      </p>
    </>
  );
};

export default TrainingStatus;
