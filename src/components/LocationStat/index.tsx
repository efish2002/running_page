import YearStat from '@/components/YearStat';
import {
  CHINESE_LOCATION_INFO_MESSAGE_FIRST,
  CHINESE_LOCATION_INFO_MESSAGE_SECOND,
} from '@/utils/const';
import CitiesStat from './CitiesStat';
import LocationSummary from './LocationSummary';
import PeriodStat from './PeriodStat';
import styles from './style.module.css';

interface ILocationStatProps {
  changeYear: (_year: string) => void;
  changeCity: (_city: string) => void;
  changeTitle: (_title: string) => void;
}

const LocationStat = ({
  changeYear,
  changeCity,
  changeTitle,
}: ILocationStatProps) => (
  <section className={`panel panel-bracket ${styles.panel}`}>
    <header className="panel-header">
      <span className="eyebrow">
        <span className="status-dot" />
        fleet / 城市编队
      </span>
      <span className="chip">map focus</span>
    </header>
    <div className={styles.body}>
      <p className={styles.motto}>
        {CHINESE_LOCATION_INFO_MESSAGE_FIRST}。
        <br />
        {CHINESE_LOCATION_INFO_MESSAGE_SECOND}。
      </p>
      <LocationSummary />
      <CitiesStat onClick={changeCity} />
      <PeriodStat onClick={changeTitle} />
      <YearStat year="Total" onClick={changeYear} />
    </div>
  </section>
);

export default LocationStat;
