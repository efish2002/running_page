import { chinaGeojson, RPGeometry } from '@/static/run_countries';
import { chinaCities } from '@/static/city';
import { Position } from 'geojson';

type Ring = Position[];
type PolygonRings = Ring[];

interface ProvinceShape {
  name: string;
  polygons: PolygonRings[];
  bbox: [number, number, number, number];
}

// District names that only exist inside a municipality, mapped to the
// prefecture-level city that owns them.
const DISTRICT_CITY_MAP: Record<string, string> = {
  东城区: '北京市',
  西城区: '北京市',
  海淀区: '北京市',
  丰台区: '北京市',
  大兴区: '北京市',
  浦东新区: '上海市',
  徐汇区: '上海市',
  南岸区: '重庆市',
};

const CITY_NAME_PATTERN =
  /^([\u4e00-\u9fa5]{2,8}(?:市|自治州|特别行政区|盟|地区|区|县))/;

const polygonsOf = (geometry: RPGeometry): PolygonRings[] => {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates as Ring[]];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as PolygonRings[];
  }
  return [];
};

const provinceShapes: ProvinceShape[] = chinaGeojson.features.map((feature) => {
  const polygons = polygonsOf(feature.geometry);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  polygons.forEach((polygon) =>
    polygon.forEach((ring) =>
      ring.forEach((point) => {
        if (point[0] < minX) minX = point[0];
        if (point[1] < minY) minY = point[1];
        if (point[0] > maxX) maxX = point[0];
        if (point[1] > maxY) maxY = point[1];
      })
    )
  );
  return {
    name: String(feature.properties?.name ?? ''),
    polygons,
    bbox: [minX, minY, maxX, maxY],
  };
});

const provinceNameById: Record<string, string> = {};
chinaGeojson.features.forEach((feature) => {
  provinceNameById[String(feature.properties?.id ?? '')] = String(
    feature.properties?.name ?? ''
  );
});

const provinceIdByCity: Record<string, string> = {};
chinaCities.forEach((city) => {
  provinceIdByCity[city.name] = city.province;
});

const pointInRing = (ring: Ring, x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const pointInPolygon = (
  polygon: PolygonRings,
  x: number,
  y: number
): boolean => {
  if (!polygon.length || !pointInRing(polygon[0], x, y)) {
    return false;
  }
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(polygon[i], x, y)) {
      return false;
    }
  }
  return true;
};

const provinceForCoordinate = (point: [number, number]): string => {
  const [x, y] = point;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return '';
  }
  for (const shape of provinceShapes) {
    const [minX, minY, maxX, maxY] = shape.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) {
      continue;
    }
    const hit = shape.polygons.some((polygon) => pointInPolygon(polygon, x, y));
    if (hit) {
      return shape.name;
    }
  }
  return '';
};

const provinceForCity = (city: string): string => {
  const id = provinceIdByCity[city];
  if (!id) {
    return '';
  }
  return provinceNameById[id] || '';
};

const cityFromRunName = (name: string): string => {
  const matched = name ? name.match(CITY_NAME_PATTERN)?.[1] : undefined;
  if (!matched) {
    return '';
  }
  if (provinceIdByCity[matched]) {
    return matched;
  }
  return DISTRICT_CITY_MAP[matched] || '';
};

export { provinceForCoordinate, provinceForCity, cityFromRunName };
