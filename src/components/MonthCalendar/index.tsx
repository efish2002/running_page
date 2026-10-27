import { useEffect, useMemo, useState } from 'react';
import { Activity, pathForRun } from '@/utils/utils';
import { ROUTE_COLORS } from '@/utils/colors';
import { buildMonthGrid } from './monthGrid';
import { routePathForPoints } from './routePath';
import styles from './style.module.css';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

type CalendarMode = 'routes' | 'heat';

interface IMonthCalendarProps {
  activities: Activity[];
  year: string;
  onSelectRuns: (_runIds: number[]) => void;
}

const latestActivityMonth = (
  activities: Activity[],
  year: number
): number | null => {
  let month: number | null = null;
  for (const activity of activities) {
    if (activity.start_date_local.slice(0, 4) !== `${year}`) {
      continue;
    }
    const activityMonth = Number(activity.start_date_local.slice(5, 7)) - 1;
    if (month === null || activityMonth > month) {
      month = activityMonth;
    }
  }
  return month;
};

const MonthCalendar = ({
  activities,
  year,
  onSelectRuns,
}: IMonthCalendarProps) => {
  const [viewYear, setViewYear] = useState(() => {
    const parsed = Number(year);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [mode, setMode] = useState<CalendarMode>('routes');

  // follow the year picked on the map
  useEffect(() => {
    if (year === 'Total') {
      return;
    }
    const parsed = Number(year);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }
    setViewYear(parsed);
    const month = latestActivityMonth(activities, parsed);
    setViewMonth(month === null ? new Date().getMonth() : month);
  }, [year]);

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, activities),
    [activities, viewYear, viewMonth]
  );

  const monthDistance = useMemo(
    () => grid.reduce((sum, cell) => sum + cell.distance, 0),
    [grid]
  );

  // the trailing padding week is invisible but still takes a full row
  const visibleGrid = useMemo(() => {
    let lastFilled = -1;
    grid.forEach((cell, index) => {
      if (cell.day !== null) {
        lastFilled = index;
      }
    });
    return grid.slice(0, lastFilled + 1);
  }, [grid]);

  const routes = useMemo(() => {
    const paths = new Map<number, string>();
    grid.forEach((cell) => {
      if (cell.day === null) {
        return;
      }
      const run = cell.runs.find((item) => item.summary_polyline);
      if (!run) {
        return;
      }
      const path = routePathForPoints(pathForRun(run));
      if (path) {
        paths.set(cell.day, path);
      }
    });
    return paths;
  }, [grid]);

  const shiftMonth = (delta: number) => {
    const next = viewMonth + delta;
    if (next < 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else if (next > 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(next);
    }
  };

  const selectDay = (runIds: number[]) => {
    onSelectRuns(runIds);
    const map = document.querySelector('[data-run-map]');
    map?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const heatLevel = (distance: number) => {
    if (distance === 0) {
      return '';
    }
    if (distance < 5000) {
      return styles.heatLow;
    }
    if (distance < 10000) {
      return styles.heatMid;
    }
    if (distance < 20000) {
      return styles.heatHigh;
    }
    return styles.heatTop;
  };

  return (
    <section className={`panel panel-bracket ${styles.panel}`}>
      <header className="panel-header">
        <span className="eyebrow">
          <span className="status-dot" />
          activity grid / 逐日轨迹
        </span>
        <div className={styles.controls}>
          <span className="chip">{(monthDistance / 1000).toFixed(1)} km</span>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navButton}
              aria-label="上个月"
              onClick={() => shiftMonth(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className={styles.monthLabel}>
              {String(viewMonth + 1).padStart(2, '0')} / {viewYear}
            </span>
            <button
              type="button"
              className={styles.navButton}
              aria-label="下个月"
              onClick={() => shiftMonth(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
          <div className={styles.modes}>
            <button
              type="button"
              className={`${styles.modeButton} ${
                mode === 'routes' ? styles.modeActive : ''
              }`}
              onClick={() => setMode('routes')}
            >
              route
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${
                mode === 'heat' ? styles.modeActive : ''
              }`}
              onClick={() => setMode('heat')}
            >
              heat
            </button>
          </div>
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.grid}>
          {WEEKDAYS.map((day) => (
            <div key={day} className={styles.weekday}>
              {day}
            </div>
          ))}
          {visibleGrid.map((cell, index) => {
            if (cell.day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className={`${styles.cell} ${styles.cellEmpty}`}
                />
              );
            }
            const path = routes.get(cell.day);
            const hasRuns = cell.runs.length > 0;
            const heat = mode === 'heat' ? heatLevel(cell.distance) : '';
            return (
              <div
                key={cell.day}
                className={`${styles.cell} ${
                  hasRuns ? styles.cellRun : ''
                } ${heat}`}
                title={
                  hasRuns
                    ? `${viewMonth + 1}月${cell.day}日 · ${(
                        cell.distance / 1000
                      ).toFixed(1)} km`
                    : undefined
                }
                onClick={() =>
                  hasRuns && selectDay(cell.runs.map((run) => run.run_id))
                }
              >
                <span className={styles.dayNumber}>{cell.day}</span>
                {mode === 'routes' && path && (
                  <svg
                    viewBox="0 0 100 100"
                    className={styles.route}
                    aria-hidden="true"
                  >
                    <path
                      className={styles.routeGlow}
                      d={path}
                      style={{ stroke: ROUTE_COLORS.glow }}
                    />
                    <path
                      className={styles.routeCore}
                      d={path}
                      style={{ stroke: ROUTE_COLORS.core }}
                    />
                  </svg>
                )}
                {mode === 'heat' && hasRuns && (
                  <span className={styles.heatValue}>
                    {(cell.distance / 1000).toFixed(1)}
                  </span>
                )}
                {hasRuns && (
                  <span className={styles.overlay}>
                    <span className={styles.overlayDay}>{cell.day}</span>
                    <span className={styles.overlayDistance}>
                      {(cell.distance / 1000).toFixed(1)} km
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default MonthCalendar;
