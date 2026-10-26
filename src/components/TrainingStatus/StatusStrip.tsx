import { useState, type MouseEvent } from 'react';
import { StripCell, TONE_COLOURS, TONE_LABELS } from './trend';
import styles from './style.module.css';

interface StatusStripProps {
  cells: StripCell[];
  year: string;
}

/**
 * One cell for every day of the year, the colour of the cell is the level the
 * training was in on that day.
 */
const StatusStrip = ({ cells, year }: StatusStripProps) => {
  const [hover, setHover] = useState<number | null>(null);

  if (!cells.length) {
    return null;
  }

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.min(
      cells.length - 1,
      Math.max(0, Math.floor(ratio * cells.length))
    );
    setHover(index);
  };

  const ticks: Array<{ month: string; index: number }> = [];
  cells.forEach((cell, index) => {
    const month = cell.date.slice(0, 7);
    const last = ticks[ticks.length - 1];
    if (!last || last.month !== month) {
      ticks.push({ month, index });
    }
  });

  const active = hover === null ? null : cells[hover];

  // the total view crosses a year, the year is written where the year turns
  const tickLabel = (month: string, index: number) => {
    if (year !== 'Total') {
      return month.slice(5);
    }
    const opensAYear = month.endsWith('-01') && index > 0;
    return opensAYear ? month.slice(2) : month.slice(5);
  };

  return (
    <div className={styles.stripWrap}>
      <div
        className={styles.strip}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="每日训练状态"
      >
        {cells.map((cell, index) => (
          <i
            key={cell.date}
            className={styles.cell}
            style={{
              background: TONE_COLOURS[cell.tone],
              opacity: hover === index ? 1 : 0.72,
            }}
          />
        ))}
      </div>
      <div className={styles.ruler}>
        {ticks.map((tick, index) => (
          <span
            key={`${tick.month}-${tick.index}`}
            className={styles.tick}
            style={{ left: `${(tick.index / cells.length) * 100}%` }}
          >
            {tickLabel(tick.month, index)}
          </span>
        ))}
      </div>
      {active && hover !== null && (
        <span
          className={styles.tip}
          style={{ left: `${((hover + 0.5) / cells.length) * 100}%` }}
        >
          {active.date} · {TONE_LABELS[active.tone]}
        </span>
      )}
    </div>
  );
};

export default StatusStrip;
