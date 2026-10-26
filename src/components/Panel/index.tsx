import { ReactNode } from 'react';
import styles from './style.module.css';

export interface PanelStat {
  label: string;
  value: string;
  accent?: boolean;
  colour?: string;
}

interface PanelProps {
  eyebrow: string;
  chip: string;
  stats: PanelStat[];
  legend?: ReactNode;
  children: ReactNode;
}

export const Panel = ({
  eyebrow,
  chip,
  stats,
  legend,
  children,
}: PanelProps) => (
  <section className={`panel panel-bracket ${styles.panel}`}>
    <header className="panel-header">
      <span className="eyebrow">
        <span className="status-dot" />
        {eyebrow}
      </span>
      <span className="chip">{chip}</span>
    </header>
    <div className={styles.body}>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <span className="metric-label">{stat.label}</span>
            <span
              className={`metric-value ${
                stat.accent ? 'metric-value-accent' : ''
              }`}
              style={stat.colour ? { color: stat.colour } : undefined}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
      {legend}
      {children}
    </div>
  </section>
);

export interface LegendItem {
  name: string;
  color: string;
  kind?: 'bar' | 'line';
}

export const Legend = ({ series }: { series: LegendItem[] }) => (
  <ul className={styles.legend}>
    {series.map((item) => (
      <li key={item.name}>
        <span
          className={item.kind === 'bar' ? styles.legendBar : styles.legendLine}
          style={{ background: item.color }}
        />
        {item.name}
      </li>
    ))}
  </ul>
);
