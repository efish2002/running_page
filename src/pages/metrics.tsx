import { useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Layout from '@/components/Layout';
import PhysiologyTrends from '@/components/PhysiologyTrends';
import TrainingStatus from '@/components/TrainingStatus';
import useActivities from '@/hooks/useActivities';
import styles from './style.module.css';

const Metrics = () => {
  const { activities, years } = useActivities();
  const [year, setYear] = useState('Total');

  const yearList = useMemo(() => ['Total', ...years], [years]);
  const totalDistance = useMemo(
    () => activities.reduce((sum, run) => sum + (run.distance || 0), 0) / 1000,
    [activities]
  );

  return (
    <Layout>
      <section className={`panel panel-bracket ${styles.hud}`}>
        <div className="eyebrow">
          <span className="status-dot" />
          metrics / 生理与训练指标
        </div>
        <h1 className={styles.hudTitle}>
          <a href="/metrics">生理指标 · 训练状态</a>
        </h1>
        <p className={styles.hudText}>
          这些数字来自佳明连接（Garmin Connect）的每日指标接口：最大摄氧量、训练效应、
          海拔适应、恢复力与心率变异。趋势图按天展示原始值，并叠加 7 日移动平均。
        </p>
        <div className={styles.chips}>
          <span className="chip">{activities.length} runs</span>
          <span className="chip">{totalDistance.toFixed(0)} km</span>
          <span className="chip">garmin connect</span>
        </div>
      </section>

      <aside className={styles.rail}>
        <section className={`panel panel-bracket ${styles.years}`}>
          <header className="panel-header">
            <span className="eyebrow">
              <span className="status-dot" />
              period / 时间范围
            </span>
          </header>
          <div className={styles.yearList}>
            {yearList.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setYear(item)}
                className={`${styles.yearButton} ${
                  year === item ? styles.yearButtonActive : ''
                }`}
              >
                {item === 'Total' ? '全部' : item}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <div className={styles.main}>
        <PhysiologyTrends activities={activities} year={year} />
        <TrainingStatus year={year} />
      </div>
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Metrics;
