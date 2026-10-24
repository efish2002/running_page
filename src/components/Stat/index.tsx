import { intComma } from '@/utils/utils';

interface IStatProperties {
  value: string | number;
  description: string;
  className?: string;
  citySize?: number;
  onClick?: () => void;
}

const Stat = ({
  value,
  description,
  className = 'pb-2 w-full',
  citySize,
  onClick,
}: IStatProperties) => (
  <div className={className} onClick={onClick}>
    <span
      className={`font-mono font-semibold tracking-tight text-foreground ${
        citySize ? 'text-xl' : 'text-3xl'
      }`}
    >
      {intComma(value.toString())}
    </span>
    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
      {description}
    </span>
  </div>
);

export default Stat;
