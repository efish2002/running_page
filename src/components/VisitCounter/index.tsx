import { VisitDay, formatVisitCount, visitChartBars } from '@/utils/visits';
import styles from './style.module.css';

interface VisitCounterProps {
  total: number;
  today: number;
  days: VisitDay[];
  updatedAt: string;
  live: boolean;
}

const updatedLabel = (updatedAt: string) => {
  if (!updatedAt) {
    return 'no snapshot yet';
  }

  return `updated ${updatedAt.slice(0, 10)}`;
};

const VisitCounter = ({
  total,
  today,
  days,
  updatedAt,
  live,
}: VisitCounterProps) => {
  const bars = visitChartBars(days);

  return (
    <section className={`panel panel-bracket ${styles.panel}`}>
      <header className="panel-header">
        <span className="eyebrow">
          <span className="status-dot" />
          traffic / 站点访问
        </span>
        <span className="chip">{live ? 'live' : 'snapshot'}</span>
      </header>
      <div className={styles.body}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className="metric-label">total visits</span>
            <span className="metric-value metric-value-accent">
              {formatVisitCount(total)}
            </span>
          </div>
          <div className={styles.stat}>
            <span className="metric-label">today</span>
            <span className="metric-value">{formatVisitCount(today)}</span>
          </div>
        </div>
        {bars.length > 0 && (
          <div
            className={styles.chart}
            role="img"
            aria-label={`visits per day, ${formatVisitCount(total)} in total`}
          >
            {bars.map((bar) => (
              <span
                key={bar.date}
                className={`${styles.bar} ${
                  bar.date === bars[bars.length - 1].date
                    ? styles.barLatest
                    : ''
                }`}
                style={{
                  height: `${Math.max(6, Math.round(bar.ratio * 100))}%`,
                }}
                title={`${bar.date} · ${formatVisitCount(bar.count)}`}
              />
            ))}
          </div>
        )}
        <p className={styles.foot}>last 14 days · {updatedLabel(updatedAt)}</p>
      </div>
    </section>
  );
};

export default VisitCounter;
