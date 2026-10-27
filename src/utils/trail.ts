import polyline from '@mapbox/polyline';

export type TrailCoordinate = [number, number];

export interface TrailRoute {
  runId: number;
  match: string;
  distanceKm: number;
  polyline: string;
}

export interface TrailRace {
  id: string;
  date: string;
  year: string;
  name: string;
  url: string;
  category: string;
  country: string;
  distanceKm: number;
  elevationM: number;
  itraPoints: number;
  genderRank: number | null;
  genderTotal: number | null;
  generalRank: number | null;
  generalTotal: number | null;
  ageGroupRank: number | null;
  participants: number;
  finishers: number | null;
  dnf: number | null;
  malePct: number | null;
  femalePct: number | null;
  time: string;
  score: number | null;
  scoreLabel: string;
  badges: string[];
  route: TrailRoute | null;
  points: TrailCoordinate[];
}

export interface TrailYear {
  year: string;
  count: number;
  distanceKm: number;
  elevationM: number;
}

export interface TrailCategory {
  category: string;
  count: number;
}

export interface TrailSummary {
  count: number;
  withRoute: number;
  totalDistanceKm: number;
  totalElevationM: number;
  totalItraPoints: number;
  avgDistanceKm: number;
  avgElevationM: number;
  bestGeneralRank: number | null;
  bestGenderRank: number | null;
  totalParticipants: number;
  finishRate: number;
  years: TrailYear[];
  categories: TrailCategory[];
  longest: TrailRace | null;
  steepest: TrailRace | null;
}

export interface TrailBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

// the categories of ITRA, from the shortest to the longest
const CATEGORY_ORDER = [
  'Vertical',
  '10K',
  'Half Marathon',
  'Marathon',
  '50K',
  '100K',
];

const numberOr = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const decodeRoute = (encoded: string): TrailCoordinate[] => {
  if (!encoded) {
    return [];
  }
  try {
    return polyline
      .decode(encoded, 5)
      .map((point) => [point[1], point[0]] as TrailCoordinate);
  } catch {
    return [];
  }
};

export const parseItraRaces = (payload: {
  races?: Array<Record<string, unknown>>;
}): TrailRace[] => {
  const rows = payload?.races ?? [];
  return rows.map((row) => {
    const date = typeof row.date === 'string' ? row.date : '';
    const route = (row.route ?? null) as TrailRoute | null;
    return {
      id: String(row.raceYearId ?? ''),
      date,
      year: date.slice(0, 4),
      name: typeof row.name === 'string' ? row.name : '',
      url: typeof row.url === 'string' ? row.url : '',
      category: typeof row.category === 'string' ? row.category : '',
      country: typeof row.country === 'string' ? row.country : '',
      distanceKm: numberOr(row.distanceKm),
      elevationM: numberOr(row.elevationM),
      itraPoints: numberOr(row.itraPoints),
      genderRank: numberOrNull(row.genderRank),
      genderTotal: numberOrNull(row.genderTotal),
      generalRank: numberOrNull(row.generalRank),
      generalTotal: numberOrNull(row.generalTotal),
      ageGroupRank: numberOrNull(row.ageGroupRank),
      participants: numberOr(row.participants),
      finishers: numberOrNull(row.finishers),
      dnf: numberOrNull(row.dnf),
      malePct: numberOrNull(row.malePct),
      femalePct: numberOrNull(row.femalePct),
      time: typeof row.time === 'string' ? row.time : '',
      score: numberOrNull(row.score),
      scoreLabel: typeof row.scoreLabel === 'string' ? row.scoreLabel : '',
      badges: Array.isArray(row.badges) ? (row.badges as string[]) : [],
      route,
      points: route ? decodeRoute(route.polyline) : [],
    };
  });
};

export const filterRaces = (
  races: TrailRace[],
  year: string,
  category: string
): TrailRace[] =>
  races.filter(
    (race) =>
      (year === 'All' || race.year === year) &&
      (category === 'All' || race.category === category)
  );

export const raceYears = (races: TrailRace[]): string[] =>
  [...new Set(races.map((race) => race.year))].filter(Boolean).sort();

export const raceCategories = (races: TrailRace[]): string[] => {
  const seen = new Set(races.map((race) => race.category).filter(Boolean));
  return [...seen].sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    if (leftIndex === -1 || rightIndex === -1) {
      return left.localeCompare(right);
    }
    return leftIndex - rightIndex;
  });
};

export const summariseRaces = (races: TrailRace[]): TrailSummary => {
  const count = races.length;
  const sum = (pick: (_race: TrailRace) => number) =>
    races.reduce((total, race) => total + pick(race), 0);

  const totalDistanceKm = sum((race) => race.distanceKm);
  const totalElevationM = sum((race) => race.elevationM);
  const totalItraPoints = sum((race) => race.itraPoints);
  const totalParticipants = sum((race) => race.participants);

  const ranked = races.filter((race) => race.generalRank !== null);
  const genderRanked = races.filter((race) => race.genderRank !== null);
  const counted = races.filter(
    (race) => race.finishers !== null && race.participants > 0
  );

  const years = raceYears(races).map((year) => {
    const ofYear = races.filter((race) => race.year === year);
    return {
      year,
      count: ofYear.length,
      distanceKm: round(
        ofYear.reduce((total, race) => total + race.distanceKm, 0),
        1
      ),
      elevationM: ofYear.reduce((total, race) => total + race.elevationM, 0),
    };
  });

  const categories = raceCategories(races).map((category) => ({
    category,
    count: races.filter((race) => race.category === category).length,
  }));

  const longest = races.length
    ? races.reduce((best, race) =>
        race.distanceKm > best.distanceKm ? race : best
      )
    : null;
  const steepest = races.length
    ? races.reduce((best, race) =>
        race.elevationM > best.elevationM ? race : best
      )
    : null;

  return {
    count,
    withRoute: races.filter((race) => race.points.length > 0).length,
    totalDistanceKm: round(totalDistanceKm, 1),
    totalElevationM,
    totalItraPoints,
    avgDistanceKm: count ? round(totalDistanceKm / count, 2) : 0,
    avgElevationM: count ? Math.round(totalElevationM / count) : 0,
    bestGeneralRank: ranked.length
      ? Math.min(...ranked.map((race) => race.generalRank as number))
      : null,
    bestGenderRank: genderRanked.length
      ? Math.min(...genderRanked.map((race) => race.genderRank as number))
      : null,
    totalParticipants,
    finishRate: counted.length
      ? round(
          counted.reduce((total, race) => total + (race.finishers ?? 0), 0) /
            counted.reduce((total, race) => total + race.participants, 0),
          4
        )
      : 0,
    years,
    categories,
    longest,
    steepest,
  };
};

export const boundsOf = (points: TrailCoordinate[]): TrailBounds | null => {
  if (!points.length) {
    return null;
  }
  let minLon = points[0][0];
  let maxLon = points[0][0];
  let minLat = points[0][1];
  let maxLat = points[0][1];
  for (const [lon, lat] of points) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLon, minLat, maxLon, maxLat };
};

export const routeThumbnailPath = (
  points: TrailCoordinate[],
  width: number,
  height: number,
  padding = 4
): string => {
  const bounds = boundsOf(points);
  if (!bounds) {
    return '';
  }
  const spanLon = bounds.maxLon - bounds.minLon;
  const spanLat = bounds.maxLat - bounds.minLat;
  const innerWidth = Math.max(1, width - padding * 2);
  const innerHeight = Math.max(1, height - padding * 2);
  const span = Math.max(spanLon, spanLat) || 1;
  const offsetX = (innerWidth - (spanLon / span) * innerWidth) / 2;
  const offsetY = (innerHeight - (spanLat / span) * innerHeight) / 2;

  return points
    .map(([lon, lat], index) => {
      const x = round(
        padding + offsetX + ((lon - bounds.minLon) / span) * innerWidth,
        2
      );
      const y = round(
        padding + offsetY + (1 - (lat - bounds.minLat) / span) * innerHeight,
        2
      );
      return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
};
