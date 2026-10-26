import { Factor } from './trend';
import styles from './style.module.css';

interface FactorBarsProps {
  factors: Factor[];
}

/**
 * The factors the readiness of a day is built from.
 */
const FactorBars = ({ factors }: FactorBarsProps) => (
  <ul className={styles.factors}>
    {factors.map((factor) => (
      <li key={factor.label}>
        <span className={styles.factorLabel}>{factor.label}</span>
        <span className={styles.factorTrack}>
          <i
            className={styles.factorFill}
            style={{
              width: `${Math.min(100, Math.max(0, factor.value ?? 0))}%`,
            }}
          />
        </span>
        <span className={styles.factorValue}>
          {factor.value === null ? '-' : Math.round(factor.value)}
        </span>
      </li>
    ))}
  </ul>
);

export default FactorBars;
