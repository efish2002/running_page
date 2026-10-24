import { lazy, Suspense } from 'react';
import { totalStat } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import styles from './style.module.css';

// Lazy load both github.svg and grid.svg
const GithubSvg = lazy(() => loadSvgComponent(totalStat, './github.svg'));

const GridSvg = lazy(() => loadSvgComponent(totalStat, './grid.svg'));

const SVGStat = () => (
  <section id="svgStat" className={`panel panel-bracket ${styles.frame}`}>
    <header className="panel-header">
      <span className="eyebrow">
        <span className="status-dot" />
        archive grid / 年度热力
      </span>
      <span className="chip">click a cell to locate</span>
    </header>
    <div className={styles.body}>
      <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
        <GithubSvg className={styles.svg} />
        <GridSvg className={styles.svg} />
      </Suspense>
    </div>
  </section>
);

export default SVGStat;
