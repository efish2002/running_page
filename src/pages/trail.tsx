import { useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import TrailMap from '@/components/TrailMap';
import TrailProfile from '@/components/TrailProfile';
import TrailRaces from '@/components/TrailRaces';
import TrailStats from '@/components/TrailStats';
import {
  filterRaces,
  parseItraRaces,
  parseItraRunner,
  raceCategories,
  raceYears,
  summariseRaces,
} from '@/utils/trail';
import itraPayload from '@/static/itra_races.json';
import styles from './style.module.css';

const Trail = () => {
  const races = useMemo(() => parseItraRaces(itraPayload), []);
  const runner = useMemo(() => parseItraRunner(itraPayload), []);
  const [year, setYear] = useState('All');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState('');

  const years = useMemo(() => raceYears(races), [races]);
  const categories = useMemo(() => raceCategories(races), [races]);

  const visible = useMemo(
    () => filterRaces(races, year, category),
    [races, year, category]
  );

  const summary = useMemo(() => summariseRaces(visible), [visible]);

  const totalDistance = useMemo(
    () => races.reduce((sum, race) => sum + race.distanceKm, 0),
    [races]
  );
  const totalElevation = useMemo(
    () => races.reduce((sum, race) => sum + race.elevationM, 0),
    [races]
  );

  return (
    <Layout wide>
      <section className={`panel panel-bracket ${styles.hud}`}>
        <div className={styles.hudIntro}>
          <div className="eyebrow">
            <span className="status-dot" />
            trail / 越野跑
          </div>
          <h1 className={styles.hudTitle}>
            <a href="/trail">越野跑 · ITRA 赛事与路线</a>
          </h1>
          <p className={styles.hudText}>
            全部比赛成绩来自 ITRA 跑步空间。上方是三维地形图，中部是每一场比赛的路线缩略图，
            下方是累计指标与年度、分类分布。路线几何取自本地 Garmin 活动记录。
          </p>
          <div className={styles.chips}>
            <span className="chip">{races.length} races</span>
            <span className="chip">{totalDistance.toFixed(0)} km</span>
            <span className="chip">{totalElevation.toLocaleString('en-US')} m↑</span>
            <span className="chip">itra.run</span>
          </div>
        </div>

        <TrailProfile runner={runner} />
      </section>

      <div className={styles.main}>
        <TrailMap
          races={visible}
          selected={selected}
          onSelect={setSelected}
        />
        <TrailRaces
          races={visible}
          years={years}
          categories={categories}
          year={year}
          category={category}
          selected={selected}
          onYear={setYear}
          onCategory={setCategory}
          onSelect={setSelected}
        />
        <TrailStats races={visible} summary={summary} />
      </div>
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Trail;
