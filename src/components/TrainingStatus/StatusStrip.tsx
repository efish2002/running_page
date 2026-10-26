import { useState, type MouseEvent } from 'react';
import { StripCell, TONE_COLOURS, TONE_LABELS } from './trend';
import styles from './style.module.css';

interface StatusStripProps {
  cells: StripCell[];
}

/**
 * One cell for every day of the year, the colour of the cell is the level the
 * training was in on that day.
 */
const StatusStrip = ({ cells }: StatusStripProps) => {
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
        {ticks.map((tick) => (
          <span
            key={`${tick.month}-${tick.index}`}
            className={styles.tick}
            style={{ left: `${(tick.index / cells.length) * 100}%` }}
          >
            {tick.month.slice(5)}
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
