import { TrailRunner, indexProgress } from '@/utils/trail';
import styles from './style.module.css';

interface ITrailProfileProps {
  runner: TrailRunner;
}

const TrailProfile = ({ runner }: ITrailProfileProps) => {
  if (!runner.name) {
    return null;
  }

  const progress = indexProgress(runner.performanceIndex);

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <span className="eyebrow">
          <span className="status-dot" />
          runner / ITRA 跑者
        </span>
        {runner.level && <span className={styles.level}>{runner.level}</span>}
      </header>

      <a
        className={styles.name}
        href={runner.url}
        target="_blank"
        rel="noreferrer"
      >
        {runner.name}
      </a>

      <div className={styles.tags}>
        {runner.itraId && <span className={styles.tag}>{runner.itraId}</span>}
        {runner.gender && <span className={styles.tag}>{runner.gender}</span>}
        {runner.ageCategory && (
          <span className={styles.tag}>{runner.ageCategory}</span>
        )}
      </div>

      <div className={styles.index}>
        <span className="metric-label">performance index</span>
        <span className={styles.indexValue}>{runner.performanceIndex}</span>
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-valuenow={runner.performanceIndex}
        aria-valuemin={0}
        aria-valuemax={1000}
        aria-label="ITRA Performance Index"
      >
        <span className={styles.fill} style={{ width: `${progress}%` }} />
        <span className={styles.marker} style={{ left: `${progress}%` }} />
      </div>

      <a
        className={styles.link}
        href={runner.url}
        target="_blank"
        rel="noreferrer"
      >
        itra.run 跑步空间
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
};

export default TrailProfile;
