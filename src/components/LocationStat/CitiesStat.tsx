import Stat from '@/components/Stat';
import useActivities from '@/hooks/useActivities';
import styles from './style.module.css';

// only support China for now
const CitiesStat = ({ onClick }: { onClick: (_city: string) => void }) => {
  const { cities } = useActivities();

  const citiesArr = Object.entries(cities);
  citiesArr.sort((a, b) => b[1] - a[1]);
  return (
    <div className={styles.group}>
      <div className="section-label">
        <span>cities / 城市</span>
        <span>{citiesArr.length}</span>
      </div>
      <div className={styles.list}>
        {citiesArr.map(([city, distance]) => (
          <Stat
            key={city}
            className={styles.row}
            value={city}
            description={`${(distance / 1000).toFixed(0)} km`}
            citySize={3}
            onClick={() => onClick(city)}
          />
        ))}
      </div>
    </div>
  );
};

export default CitiesStat;
