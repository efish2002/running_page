export interface RoutePathOptions {
  // side length of the square viewBox the route is drawn in
  size?: number;
  // margin kept around the route on its longer side
  padding?: number;
  // point budget after simplification
  maxPoints?: number;
  // simplification tolerance, in viewBox units
  epsilon?: number;
}

const DEFAULT_SIZE = 100;
const DEFAULT_PADDING = 15;
const DEFAULT_MAX_POINTS = 400;
const DEFAULT_EPSILON = 0.3;

type Point = [number, number];

// Ramer-Douglas-Peucker, iterative so a long track cannot blow the stack
const simplify = (points: Point[], epsilon: number): Point[] => {
  if (points.length < 3) {
    return points;
  }
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop() as [number, number];
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let farthest = 0;
    let index = -1;

    for (let i = start + 1; i < end; i++) {
      const [px, py] = points[i];
      let distance: number;
      if (length === 0) {
        distance = Math.hypot(px - ax, py - ay);
      } else {
        const t = Math.max(
          0,
          Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (length * length))
        );
        distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (distance > farthest) {
        farthest = distance;
        index = i;
      }
    }

    if (index > 0 && farthest > epsilon) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, index) => keep[index] === 1);
};

const thin = (points: Point[], maxPoints: number): Point[] => {
  if (points.length <= maxPoints) {
    return points;
  }
  const step = (points.length - 1) / (maxPoints - 1);
  const thinned: Point[] = [];
  for (let i = 0; i < maxPoints; i++) {
    thinned.push(points[Math.round(i * step)]);
  }
  thinned[maxPoints - 1] = points[points.length - 1];
  return thinned;
};

/**
 * Turns a track into an SVG path for a square viewBox.
 * The route keeps its aspect ratio, its longer side spans size - 2 * padding
 * and it is centred, with north pointing up.
 */
export const routePathForPoints = (
  points: Point[],
  options: RoutePathOptions = {}
): string => {
  const size = options.size ?? DEFAULT_SIZE;
  const padding = options.padding ?? DEFAULT_PADDING;
  const maxPoints = Math.max(2, options.maxPoints ?? DEFAULT_MAX_POINTS);
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;

  if (!points || points.length < 2) {
    return '';
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return '';
    }
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  if (spanLng === 0 && spanLat === 0) {
    return '';
  }

  const scale = (size - 2 * padding) / Math.max(spanLng, spanLat);
  const offsetX = (size - spanLng * scale) / 2;
  const offsetY = (size - spanLat * scale) / 2;

  const projected = points.map(
    ([lng, lat]) =>
      [
        (lng - minLng) * scale + offsetX,
        (maxLat - lat) * scale + offsetY,
      ] as Point
  );

  const simplified = thin(simplify(projected, epsilon), maxPoints);
  if (!simplified.length) {
    return '';
  }

  return simplified
    .map(
      ([x, y], index) =>
        `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
    )
    .join(' ');
};
