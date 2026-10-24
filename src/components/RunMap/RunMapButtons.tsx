import useActivities from '@/hooks/useActivities';
import styles from './style.module.css';

const RunMapButtons = ({
  changeYear,
  thisYear,
}: {
  changeYear: (_year: string) => void;
  thisYear: string;
}) => {
  const { years } = useActivities();
  const yearsButtons = years.slice();
  yearsButtons.push('Total');

  return (
    <div className={styles.seg}>
      {yearsButtons.map((year) => (
        <button
          key={`${year}button`}
          type="button"
          className={`${styles.button} ${year === thisYear ? styles.selected : ''}`}
          onClick={() => {
            changeYear(year);
          }}
        >
          {year}
        </button>
      ))}
    </div>
  );
};

export default RunMapButtons;
