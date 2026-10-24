import YearStat from '@/components/YearStat';
import useActivities from '@/hooks/useActivities';
import styles from './style.module.css';

const YearsStat = ({
  year,
  onClick,
}: {
  year: string;
  onClick: (_year: string) => void;
}) => {
  const { years } = useActivities();
  const yearsArray = years.filter((item) => item !== year && item !== 'Total');
  yearsArray.push('Total');
  if (year !== 'Total') {
    yearsArray.unshift(year);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="section-label">
        <span>annual records</span>
        <span>
          {years[years.length - 1]} — {years[0]}
        </span>
      </div>
      <div className={styles.list}>
        {yearsArray.map((item) => (
          <YearStat
            key={item}
            year={item}
            onClick={onClick}
            active={item === year}
          />
        ))}
      </div>
    </div>
  );
};

export default YearsStat;
