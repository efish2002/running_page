import { useMemo } from 'react';
import { ROUTE_COLORS } from '@/utils/colors';
import {
  TrailRace,
  routeThumbnailPath,
} from '@/utils/trail';
import styles from './style.module.css';

interface ITrailRacesProps {
  races: TrailRace[];
  years: string[];
  categories: string[];
  year: string;
  category: string;
  selected: string;
  onYear: (_year: string) => void;
  onCategory: (_category: string) => void;
  onSelect: (_raceId: string) => void;
}

const rankText = (rank: number | null, total: number | null) => {
  if (rank === null) {
    return '-';
  }
  return total ? `${rank} / ${total}` : `${rank}`;
};

const TrailRaces = ({
  races,
  years,
  categories,
  year,
  category,
  selected,
  onYear,
  onCategory,
  onSelect,
}: ITrailRacesProps) => {
  const yearOptions = useMemo(() => ['All', ...years], [years]);
  const categoryOptions = useMemo(() => ['All', ...categories], [categories]);

  return (
    <section className={`panel panel-bracket ${styles.panel}`}>
      <header className="panel-header">
        <span className="eyebrow">
          <span className="status-dot" />
          races / 比赛与路线
        </span>
        <span className="chip">{races.length} races</span>
      </header>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>year</span>
          <div className={styles.filterChips}>
            {yearOptions.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.chipButton} ${
                  year === item ? styles.chipActive : ''
                }`}
                onClick={() => onYear(item)}
              >
                {item === 'All' ? '全部' : item}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>category</span>
          <div className={styles.filterChips}>
            {categoryOptions.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.chipButton} ${
                  category === item ? styles.chipActive : ''
                }`}
                onClick={() => onCategory(item)}
              >
                {item === 'All' ? '全部' : item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {races.length === 0 ? (
        <p className={styles.empty}>这个筛选条件下没有比赛记录。</p>
      ) : (
        <div className={styles.grid}>
          {races.map((race) => {
            const path = routeThumbnailPath(race.points, 100, 100, 9);
            const active = race.id === selected;
            return (
              <article
                key={race.id}
                className={`${styles.card} ${active ? styles.cardActive : ''}`}
                onClick={() => onSelect(race.id)}
              >
                <div className={styles.thumb}>
                  {path ? (
                    <svg viewBox="0 0 100 100" aria-hidden="true">
                      <path
                        className={styles.thumbGlow}
                        d={path}
                        style={{ stroke: ROUTE_COLORS.glow }}
                      />
                      <path
                        className={styles.thumbCore}
                        d={path}
                        style={{ stroke: ROUTE_COLORS.core }}
                      />
                    </svg>
                  ) : (
                    <span className={styles.thumbEmpty}>no route</span>
                  )}
                  <span className={styles.thumbDate}>{race.date.slice(5)}</span>
                </div>

                <div className={styles.body}>
                  <h3 className={styles.name}>
                    <a
                      href={race.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {race.name}
                    </a>
                  </h3>
                  <div className={styles.tags}>
                    <span className={styles.tag}>{race.category}</span>
                    {race.country && <span className={styles.tag}>{race.country}</span>}
                    <span className={styles.tag}>{race.distanceKm} km</span>
                    <span className={styles.tag}>{race.elevationM} m↑</span>
                  </div>

                  <dl className={styles.facts}>
                    <div>
                      <dt>ITRA</dt>
                      <dd>{race.itraPoints}</dd>
                    </div>
                    <div>
                      <dt>总排名</dt>
                      <dd>{rankText(race.generalRank, race.generalTotal)}</dd>
                    </div>
                    <div>
                      <dt>性别排名</dt>
                      <dd>{rankText(race.genderRank, race.genderTotal)}</dd>
                    </div>
                    <div>
                      <dt>用时</dt>
                      <dd>{race.time || race.scoreLabel || '-'}</dd>
                    </div>
                    <div>
                      <dt>参赛</dt>
                      <dd>{race.participants}</dd>
                    </div>
                    <div>
                      <dt>完赛</dt>
                      <dd>{race.finishers ?? '-'}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default TrailRaces;
