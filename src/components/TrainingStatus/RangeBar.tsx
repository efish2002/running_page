import styles from './style.module.css';

interface RangeBarProps {
  label: string;
  value: number | null;
  min?: number | null;
  max?: number | null;
  colour?: string;
}

/**
 * A value that has a healthy range, the range is drawn behind the value.
 */
const RangeBar = ({ label, value, min, max, colour }: RangeBarProps) => {
  const bounds = [value, min, max].filter(
    (item): item is number => typeof item === 'number' && Number.isFinite(item)
  );
  if (!bounds.length) {
    return null;
  }
  const top = Math.max(...bounds) * 1.15 || 1;
  const percent = (item?: number | null) =>
    typeof item === 'number' && Number.isFinite(item)
      ? Math.min(100, Math.max(0, (item / top) * 100))
      : 0;

  const zoneLeft = percent(min);
  const zoneWidth = Math.max(0, percent(max) - zoneLeft);

  return (
    <div className={styles.range}>
      <span className={styles.rangeLabel}>{label}</span>
      <span className={styles.rangeTrack}>
        <i
          className={styles.rangeZone}
          style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }}
        />
        <i
          className={styles.rangeValue}
          style={{
            left: `${percent(value)}%`,
            background: colour ?? 'hsl(var(--accent))',
          }}
        />
      </span>
      <span className={styles.rangeText}>
        {value === null || !Number.isFinite(value) ? '-' : Math.round(value)}
        {typeof min === 'number' && typeof max === 'number' ? (
          <em>
            {' '}
            / {Math.round(min)}-{Math.round(max)}
          </em>
        ) : null}
      </span>
    </div>
  );
};

export default RangeBar;
