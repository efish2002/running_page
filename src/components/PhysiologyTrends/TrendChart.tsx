import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
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
  width?: number;
  opacity?: number;
}

export interface ChartTick {
  index: number;
  label: string;
}

interface TrendChartProps {
  points: ChartPoint[];
  series: ChartSeries[];
  ticks?: ChartTick[];
  formatValue?: (_value: number, _seriesIndex: number) => string;
  formatAxis?: (_value: number) => string;
  formatAxisRight?: (_value: number) => string;
  height?: number;
}

const PAD = { top: 14, bottom: 22, left: 42 };
const PAD_RIGHT = 12;
const PAD_RIGHT_SECOND_AXIS = 34;

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
  ticks,
  formatValue = defaultFormat,
  formatAxis = defaultFormat,
  formatAxisRight = defaultFormat,
  height = 210,
}: TrendChartProps) => {
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  // every chart on the page needs its own gradient, the ids are shared
  // across the whole document otherwise
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

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

    // a bar and a line carry different units, the line needs its own axis
    const secondAxis = barValues.length > 0 && lineValues.length > 0;
    const pad = {
      ...PAD,
      right: secondAxis ? PAD_RIGHT_SECOND_AXIS : PAD_RIGHT,
    };

    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;

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

    // every point sits in the middle of its slot, so a bar never reaches the
    // gutter of the axis labels
    const slot = plotWidth / Math.max(points.length, 1);
    const xOf = (position: number) =>
      pad.left + slot / 2 + ((position - minX) / spanX) * (plotWidth - slot);

    const yOf = (value: number, scale: { min: number; max: number }) =>
      pad.top +
      plotHeight -
      ((value - scale.min) / (scale.max - scale.min || 1)) * plotHeight;

    // the ticks that are handed in are thinned out, two of them must never
    // touch each other
    const visibleTicks = ticks?.length
      ? ticks.reduce<ChartTick[]>((kept, tick) => {
          const position = positions[tick.index];
          if (position === undefined) {
            return kept;
          }
          const last = kept[kept.length - 1];
          const gap = last
            ? xOf(position) - xOf(positions[last.index])
            : Infinity;
          if (gap < Math.max(26, tick.label.length * 5.6 + 6)) {
            return kept;
          }
          kept.push(tick);
          return kept;
        }, [])
      : null;

    const bars = series
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.kind === 'bar')
      .map((entry) => {
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
        const areas: string[] = [];
        const bottom = (pad.top + plotHeight).toFixed(1);
        let started = false;
        let run: string[] = [];
        let runStart = 0;
        let runEnd = 0;

        // the fill has to close every stretch on its own, a gap in the line
        // must not be bridged by the shape underneath it
        const closeRun = () => {
          if (run.length > 1 && entry.item.fill) {
            areas.push(
              `${run.join(' ')} L ${runEnd.toFixed(1)},${bottom} L ${runStart.toFixed(
                1
              )},${bottom} Z`
            );
          }
          run = [];
        };

        points.forEach((point, pointIndex) => {
          const value = point.values[entry.index];
          if (!Number.isFinite(value)) {
            closeRun();
            started = false;
            return;
          }
          const x = xOf(positions[pointIndex]);
          const y = yOf(value, lineScale);
          const command = `${started ? 'L' : 'M'} ${x.toFixed(1)},${y.toFixed(1)}`;
          segments.push(command);
          if (!run.length) {
            runStart = x;
          }
          run.push(command);
          runEnd = x;
          started = true;
        });
        closeRun();

        return {
          item: entry.item,
          seriesIndex: entry.index,
          path: segments.join(' '),
          areas,
        };
      });

    const grid = [0, 0.5, 1].map((step) => {
      const value = gridScale.min + (gridScale.max - gridScale.min) * step;
      const rightValue = lineScale.min + (lineScale.max - lineScale.min) * step;
      return {
        y: yOf(value, gridScale),
        label: formatAxis(value),
        rightLabel: secondAxis ? formatAxisRight(rightValue) : null,
      };
    });

    const labelStep = Math.max(1, Math.ceil(points.length / 8));

    return {
      pad,
      plotWidth,
      plotHeight,
      positions,
      xOf,
      bars,
      lines,
      grid,
      labelStep,
      visibleTicks,
      barScale,
      lineScale,
    };
  }, [points, series, ticks, height, formatAxis, formatAxisRight, width]);

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

  // the ticks of the caller win, otherwise every n-th point is named
  const axisLabels =
    geometry.visibleTicks ??
    points
      .map((point, index) => ({ index, label: point.label }))
      .filter(
        (_, index) =>
          index % geometry.labelStep === 0 || index === points.length - 1
      );

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
                id={`trend-fill-${gradientId}-${index}`}
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
          <line
            key={line.y}
            className={styles.grid}
            x1={geometry.pad.left}
            x2={width - geometry.pad.right}
            y1={line.y}
            y2={line.y}
          />
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
            {line.areas.map((area, index) => (
              <path
                key={index}
                d={area}
                fill={`url(#trend-fill-${gradientId}-${line.seriesIndex})`}
                stroke="none"
              />
            ))}
            <path
              className={styles.line}
              d={line.path}
              stroke={line.item.color}
              vectorEffect="non-scaling-stroke"
              style={{
                strokeWidth: line.item.width,
                opacity: line.item.opacity,
              }}
            />
          </g>
        ))}

        {active && (
          <line
            className={styles.guide}
            x1={guideX}
            x2={guideX}
            y1={geometry.pad.top}
            y2={height - geometry.pad.bottom}
          />
        )}

        {geometry.grid.map((line) => (
          <text
            key={line.y}
            className={styles.axisLabel}
            x={geometry.pad.left - 8}
            y={line.y + 3}
          >
            {line.label}
          </text>
        ))}

        {geometry.grid.map((line) =>
          line.rightLabel === null ? null : (
            <text
              key={`right-${line.y}`}
              className={styles.axisLabel}
              x={width - geometry.pad.right + 8}
              y={line.y + 3}
              textAnchor="start"
            >
              {line.rightLabel}
            </text>
          )
        )}

        {axisLabels.map((item) => (
          <text
            key={item.label + item.index}
            className={styles.axisLabel}
            x={geometry.xOf(geometry.positions[item.index])}
            y={height - 6}
            textAnchor="middle"
          >
            {item.label}
          </text>
        ))}
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
