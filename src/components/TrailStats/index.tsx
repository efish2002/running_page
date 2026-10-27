import { Panel } from '@/components/Panel';
import { TrailRace, TrailSummary } from '@/utils/trail';
import styles from './style.module.css';

interface ITrailStatsProps {
  races: TrailRace[];
  summary: TrailSummary;
}

const TrailStats = ({ races, summary }: ITrailStatsProps) => {
  const maxYearCount = Math.max(
    1,
    ...summary.years.map((item) => item.count)
  );
  const maxCategoryCount = Math.max(
    1,
    ...summary.categories.map((item) => item.count)
  );

  return (
    <>
      <Panel
        eyebrow="totals / 累计指标"
        chip={`${summary.count} races`}
        stats={[
          {
            label: '比赛场次',
            value: `${summary.count}`,
            accent: true,
          },
          {
            label: '总距离',
            value: `${summary.totalDistanceKm.toFixed(0)} km`,
          },
          {
            label: '总爬升',
            value: `${summary.totalElevationM.toLocaleString('en-US')} m`,
          },
          {
            label: 'ITRA 积分',
            value: `${summary.totalItraPoints}`,
          },
          {
            label: '平均距离',
            value: `${summary.avgDistanceKm.toFixed(1)} km`,
          },
          {
            label: '平均爬升',
            value: `${summary.avgElevationM} m`,
          },
          {
            label: '完赛率',
            value: `${(summary.finishRate * 100).toFixed(1)}%`,
          },
          {
            label: '最好总名次',
            value: summary.bestGeneralRank ? `#${summary.bestGeneralRank}` : '-',
          },
          {
            label: '最好性别名次',
            value: summary.bestGenderRank ? `#${summary.bestGenderRank}` : '-',
          },
          {
            label: '含路线',
            value: `${summary.withRoute} / ${summary.count}`,
          },
        ]}
      >
        <div className={styles.highlights}>
          {summary.longest && (
            <div className={styles.highlight}>
              <span className="metric-label">最长距离</span>
              <span className={styles.highlightName}>
                {summary.longest.name}
              </span>
              <span className={styles.highlightValue}>
                {summary.longest.distanceKm} km · {summary.longest.elevationM} m
              </span>
            </div>
          )}
          {summary.steepest && (
            <div className={styles.highlight}>
              <span className="metric-label">最大爬升</span>
              <span className={styles.highlightName}>
                {summary.steepest.name}
              </span>
              <span className={styles.highlightValue}>
                {summary.steepest.elevationM} m · {summary.steepest.distanceKm} km
              </span>
            </div>
          )}
          <div className={styles.highlight}>
            <span className="metric-label">参赛人次</span>
            <span className={styles.highlightName}>
              {summary.totalParticipants.toLocaleString('en-US')}
            </span>
            <span className={styles.highlightValue}>累计报名人数</span>
          </div>
        </div>
      </Panel>

      <Panel
        eyebrow="by year / 年度分布"
        chip={`${summary.years.length} years`}
        stats={[
          {
            label: '最活跃年份',
            value:
              summary.years.length > 0
                ? summary.years.reduce((best, item) =>
                    item.count > best.count ? item : best
                  ).year
                : '-',
            accent: true,
          },
          {
            label: '年均场次',
            value: summary.years.length
              ? (summary.count / summary.years.length).toFixed(1)
              : '-',
          },
        ]}
      >
        <div className={styles.chart}>
          {summary.years.map((item) => {
            const height = (item.count / maxYearCount) * 100;
            return (
              <div key={item.year} className={styles.barColumn}>
                <div className={styles.barTrack}>
                  <span
                    className={styles.barValue}
                    style={{ bottom: `${height}%` }}
                  >
                    {item.count}
                  </span>
                  <span
                    className={styles.barFill}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className={styles.barLabel}>{item.year}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        eyebrow="by category / 分类分布"
        chip={`${summary.categories.length} categories`}
        stats={summary.categories.map((item) => ({
          label: item.category,
          value: `${item.count}`,
        }))}
      >
        <ul className={styles.distribution}>
          {summary.categories.map((item) => (
            <li key={item.category}>
              <span className={styles.distributionLabel}>{item.category}</span>
              <span className={styles.distributionTrack}>
                <span
                  className={styles.distributionFill}
                  style={{ width: `${(item.count / maxCategoryCount) * 100}%` }}
                />
              </span>
              <span className={styles.distributionValue}>{item.count}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          比赛数据来自 ITRA 跑步空间（
          <a
            href="https://itra.run/RunnerSpace/gao.hao.4683832"
            target="_blank"
            rel="noreferrer"
          >
            gao.hao.4683832
          </a>
          ），路线来自本地 Garmin 活动记录，共 {races.length} 场。
        </p>
      </Panel>
    </>
  );
};

export default TrailStats;
