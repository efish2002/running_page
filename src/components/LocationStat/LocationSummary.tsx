import useActivities from '@/hooks/useActivities';
import { intComma } from '@/utils/utils';
import styles from './style.module.css';

// only support China for now
const LocationSummary = () => {
  const { years, countries, provinces, cities } = useActivities();

  const items = [
    { label: 'years', value: years.length },
    { label: 'countries', value: countries.length },
    { label: 'provinces', value: provinces.length },
    { label: 'cities', value: Object.keys(cities).length },
  ];

  return (
    <div className={styles.group}>
      <div className="section-label">
        <span>coverage / 覆盖</span>
      </div>
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.label} className={styles.summary}>
            <span className={styles.summaryValue}>
              {intComma(`${item.value}`)}
            </span>
            <span className={styles.summaryLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocationSummary;
