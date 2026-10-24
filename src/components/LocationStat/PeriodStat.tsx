import Stat from '@/components/Stat';
import useActivities from '@/hooks/useActivities';
import styles from './style.module.css';

const PeriodStat = ({ onClick }: { onClick: (_period: string) => void }) => {
  const { runPeriod } = useActivities();

  const periodArr = Object.entries(runPeriod);
  periodArr.sort((a, b) => b[1] - a[1]);
  return (
    <div className={styles.group}>
      <div className="section-label">
        <span>period / 时段</span>
        <span>{periodArr.length}</span>
      </div>
      <div className={styles.list}>
        {periodArr.map(([period, times]) => (
          <Stat
            key={period}
            className={styles.row}
            value={period}
            description={`${times} runs`}
            citySize={3}
            onClick={() => onClick(period)}
          />
        ))}
      </div>
    </div>
  );
};

export default PeriodStat;
