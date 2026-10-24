import { lazy, Suspense } from 'react';
import useActivities from '@/hooks/useActivities';
import { formatPace } from '@/utils/utils';
import useHover from '@/hooks/useHover';
import { yearStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import styles from './style.module.css';

const YearStat = ({
  year,
  onClick,
  active = false,
}: {
  year: string;
  onClick: (_year: string) => void;
  active?: boolean;
}) => {
  let { activities: runs, years } = useActivities();
  const [hovered, eventHandlers] = useHover();
  const YearSVG = lazy(() => loadSvgComponent(yearStats, `./year_${year}.svg`));

  if (years.includes(year)) {
    runs = runs.filter((run) => run.start_date_local.slice(0, 4) === year);
  }
  let sumDistance = 0;
  let streak = 0;
  let pace = 0; // eslint-disable-line no-unused-vars
  let paceNullCount = 0; // eslint-disable-line no-unused-vars
  let heartRate = 0;
  let heartRateNullCount = 0;
  let totalMetersAvail = 0;
  let totalSecondsAvail = 0;
  runs.forEach((run) => {
    sumDistance += run.distance || 0;
    if (run.average_speed) {
      pace += run.average_speed;
      totalMetersAvail += run.distance || 0;
      totalSecondsAvail += (run.distance || 0) / run.average_speed;
    } else {
      paceNullCount++;
    }
    if (run.average_heartrate) {
      heartRate += run.average_heartrate;
    } else {
      heartRateNullCount++;
    }
    if (run.streak) {
      streak = Math.max(streak, run.streak);
    }
  });
  sumDistance = parseFloat((sumDistance / 1000.0).toFixed(1));
  const avgPace = formatPace(totalMetersAvail / totalSecondsAvail);
  const hasHeartRate = !(heartRate === 0);
  const avgHeartRate = (heartRate / (runs.length - heartRateNullCount)).toFixed(
    0
  );
  return (
    <div
      className={`${styles.card} ${active ? styles.active : ''}`}
      onClick={() => onClick(year)}
      {...eventHandlers}
    >
      <div className={styles.head}>
        <span className={styles.year}>{year}</span>
        <span className={styles.tag}>{active ? 'live' : 'archived'}</span>
      </div>
      <div className={styles.metrics}>
        <div>
          <span className="metric-label">runs</span>
          <span className="metric-value">{runs.length}</span>
        </div>
        <div>
          <span className="metric-label">distance</span>
          <span className="metric-value metric-value-accent">
            {sumDistance}
          </span>
        </div>
        <div>
          <span className="metric-label">pace</span>
          <span className="metric-value">{avgPace}</span>
        </div>
        <div>
          <span className="metric-label">streak</span>
          <span className="metric-value">{streak} day</span>
        </div>
        {hasHeartRate && (
          <div className="col-span-2">
            <span className="metric-label">avg heart rate</span>
            <span className="metric-value">{avgHeartRate}</span>
          </div>
        )}
      </div>
      {year !== 'Total' && hovered && (
        <Suspense fallback="loading...">
          <YearSVG className={styles.svg} />
        </Suspense>
      )}
    </div>
  );
};

export default YearStat;
