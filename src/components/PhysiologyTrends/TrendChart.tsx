import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import styles from './style.module.css';

export interface ChartPoint {
  label: string;
  values: number[];
  x?: number;
}

export interface ChartSeries {
  name: string;
  color: string;
  kind: 'bar' | 'line';
  fill?: boolean;
}

interface TrendChartProps {
  points: ChartPoint[];
  series: ChartSeries[];
  formatValue?: (_value: number, _seriesIndex: number) => string;
  formatAxis?: (_value: number) => string;
  height?: number;
}

const PAD = { top: 14, right: 12, bottom: 22, left: 42 };

const defaultFormat = (value: number) =>
  Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);

const scaleOf = (values: number[]) => {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) {
    return { min: 0, max: 1 };
  }
  const min = Math.min(...usable);
  const max = Math.max(...usable);
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }
  return { min, max };
};

// a line needs some air above and below, a bar always grows from zero
const withPadding = (scale: { min: number; max: number }) => {
  const span = scale.max - scale.min;
  if (span <= 0) {
    return scale;
  }
  const pad = span * 0.08;
  return { min: scale.min - pad, max: scale.max + pad };
};

const TrendChart = ({
  points,
  series,
  formatValue = defaultFormat,
  formatAxis = defaultFormat,
  height = 210,
}: TrendChartProps) => {
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  // the svg is drawn in the size of its box, so the labels keep their shape
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) {
        setWidth(next);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const plotWidth = width - PAD.left - PAD.right;
    const plotHeight = height - PAD.top - PAD.bottom;

    const positions = points.map((point, index) => point.x ?? index);
    const minX = Math.min(...positions);
    const maxX = Math.max(...positions);
    const spanX = maxX - minX || 1;

    const barValues: number[] = [];
    const lineValues: number[] = [];
    points.forEach((point) => {
      point.values.forEach((value, index) => {
        if (!Number.isFinite(value)) {
          return;
        }
        if (series[index]?.kind === 'bar') {
          barValues.push(value);
        } else {
          lineValues.push(value);
        }
      });
    });

    const rawBarScale = scaleOf(barValues.length ? barValues : [0]);
    const barScale = {
      min: Math.min(0, rawBarScale.min),
      max: rawBarScale.max,
    };
    const lineScale = withPadding(
      scaleOf(lineValues.length ? lineValues : [0])
    );
    const gridScale = series.some((item) => item.kind === 'bar')
      ? barScale
      : lineScale;

    const xOf = (position: number) =>
      PAD.left + ((position - minX) / spanX) * plotWidth;

    const yOf = (value: number, scale: { min: number; max: number }) =>
      PAD.top +
      plotHeight -
      ((value - scale.min) / (scale.max - scale.min || 1)) * plotHeight;

    const bars = series
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.kind === 'bar')
      .map((entry) => {
        const slot = plotWidth / Math.max(points.length, 1);
        return points.map((point, pointIndex) => {
          const value = point.values[entry.index];
          const x = xOf(positions[pointIndex]) - slot * 0.3;
          const width = slot * 0.6;
          if (!Number.isFinite(value)) {
            return null;
          }
          const top = yOf(value, barScale);
          const bottom = yOf(barScale.min, barScale);
          return {
            x,
            y: Math.min(top, bottom),
            width,
            height: Math.abs(bottom - top),
            color: entry.item.color,
          };
        });
      });

    const lines = series
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.kind === 'line')
      .map((entry) => {
        const segments: string[] = [];
        const area: string[] = [];
        let started = false;
        points.forEach((point, pointIndex) => {
          const value = point.values[entry.index];
          if (!Number.isFinite(value)) {
            started = false;
            return;
          }
          const x = xOf(positions[pointIndex]);
          const y = yOf(value, lineScale);
          segments.push(
            `${started ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`
          );
          area.push(`${started ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`);
          started = true;
        });
        return {
          item: entry.item,
          seriesIndex: entry.index,
          path: segments.join(' '),
          area:
            area.length > 1
              ? `${area.join(' ')} L ${xOf(
                  positions[positions.length - 1]
                ).toFixed(1)},${(PAD.top + plotHeight).toFixed(1)} L ${xOf(
                  positions[0]
                ).toFixed(1)},${(PAD.top + plotHeight).toFixed(1)} Z`
              : '',
        };
      });

    const grid = [0, 0.5, 1].map((step) => {
      const value = gridScale.min + (gridScale.max - gridScale.min) * step;
      return { y: yOf(value, gridScale), label: formatAxis(value) };
    });

    const labelStep = Math.max(1, Math.ceil(points.length / 8));

    return {
      plotWidth,
      plotHeight,
      positions,
      xOf,
      bars,
      lines,
      grid,
      labelStep,
      barScale,
      lineScale,
    };
  }, [points, series, height, formatAxis, width]);

  if (!points.length) {
    return (
      <div className={styles.empty} role="img" aria-label="没有可显示的数据">
        no data
      </div>
    );
  }

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDistance = Infinity;
    geometry.positions.forEach((position, index) => {
      const distance = Math.abs(geometry.xOf(position) - x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    setHover(nearest);
  };

  const active = hover === null ? null : points[hover];
  const guideX = hover === null ? 0 : geometry.xOf(geometry.positions[hover]);
  const tooltipLeft = Math.min(Math.max((guideX / width) * 100, 12), 88);

  return (
    <div className={styles.chart} ref={containerRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={styles.svg}
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={series.map((item) => item.name).join('、')}
      >
        <defs>
          {series.map((item, index) =>
            item.fill ? (
              <linearGradient
                key={item.name}
                id={`trend-fill-${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={item.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={item.color} stopOpacity="0" />
              </linearGradient>
            ) : null
          )}
        </defs>

        {geometry.grid.map((line) => (
          <g key={line.y}>
            <line
              className={styles.grid}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={line.y}
              y2={line.y}
            />
            <text className={styles.axisLabel} x={PAD.left - 8} y={line.y + 3}>
              {line.label}
            </text>
          </g>
        ))}

        {geometry.bars.map((bars, seriesIndex) => (
          <g key={seriesIndex}>
            {bars.map((bar, index) =>
              bar ? (
                <rect
                  key={index}
                  className={styles.bar}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx={2}
                  fill={bar.color}
                />
              ) : null
            )}
          </g>
        ))}

        {geometry.lines.map((line) => (
          <g key={line.item.name}>
            {line.area && (
              <path
                d={line.area}
                fill={`url(#trend-fill-${line.seriesIndex})`}
                stroke="none"
              />
            )}
            <path
              className={styles.line}
              d={line.path}
              stroke={line.item.color}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {active && (
          <line
            className={styles.guide}
            x1={guideX}
            x2={guideX}
            y1={PAD.top}
            y2={height - PAD.bottom}
          />
        )}

        {points.map((point, index) => {
          if (index % geometry.labelStep !== 0 && index !== points.length - 1) {
            return null;
          }
          return (
            <text
              key={point.label + index}
              className={styles.axisLabel}
              x={geometry.xOf(geometry.positions[index])}
              y={height - 6}
              textAnchor="middle"
            >
              {point.label}
            </text>
          );
        })}
      </svg>

      {active && (
        <div className={styles.tooltip} style={{ left: `${tooltipLeft}%` }}>
          <span className={styles.tooltipTitle}>{active.label}</span>
          {series.map((item, index) => {
            const value = active.values[index];
            if (!Number.isFinite(value)) {
              return null;
            }
            return (
              <span key={item.name} className={styles.tooltipRow}>
                <i style={{ background: item.color }} />
                {item.name}
                <b>{formatValue(value, index)}</b>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrendChart;
