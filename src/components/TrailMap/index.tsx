import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  MapLayerMouseEvent,
  Marker,
  NavigationControl,
  ScaleControl,
  Source,
  MapRef,
} from 'react-map-gl';
import { FeatureCollection, LineString } from 'geojson';
import { MAPBOX_TOKEN } from '@/utils/const';
import { ROUTE_COLORS } from '@/utils/colors';
import { TrailRace, boundsOf } from '@/utils/trail';
import styles from './style.module.css';

const DEM_SOURCE = 'trail-dem';
const ROUTE_SOURCE = 'trail-routes';
const TERRAIN_EXAGGERATION = 1.35;
// the tile size mapbox uses, the zoom is derived from it
const TILE_SIZE = 256;
// the size of the map in the panel, the zoom follows it
const VIEW_WIDTH = 1400;
const VIEW_HEIGHT = 520;
// how much of the viewport the routes should fill
const VIEW_FILL = 0.8;

interface ITrailMapProps {
  races: TrailRace[];
  selected: string;
  onSelect: (_raceId: string) => void;
}

const routeGeoJson = (races: TrailRace[]): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: races
    .filter((race) => race.points.length > 1)
    .map((race) => ({
      type: 'Feature',
      properties: { raceId: race.id, name: race.name },
      geometry: {
        type: 'LineString',
        coordinates: race.points,
      },
    })),
});

interface ITrailViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

const viewStateFor = (races: TrailRace[], selected: string): ITrailViewState => {
  const target = selected
    ? races.filter((race) => race.id === selected)
    : races;
  const points = target.flatMap((race) => race.points);
  const bounds = boundsOf(points);
  if (!bounds) {
    return {
      longitude: 103.7,
      latitude: 31.2,
      zoom: 7.5,
      pitch: selected ? 58 : 46,
      bearing: 0,
    };
  }
  const longitude = (bounds.minLon + bounds.maxLon) / 2;
  const latitude = (bounds.minLat + bounds.maxLat) / 2;
  // the zoom that lets the routes fill the map, the smaller of the two wins
  const lonSpan = Math.max(bounds.maxLon - bounds.minLon, 0.02);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.02);
  const zoomLon = Math.log2(
    (VIEW_WIDTH * 360) / (TILE_SIZE * lonSpan * VIEW_FILL)
  );
  const zoomLat = Math.log2(
    (VIEW_HEIGHT * 360) / (TILE_SIZE * latSpan * VIEW_FILL)
  );
  const zoom = Math.min(12, Math.max(4, Math.min(zoomLon, zoomLat)));
  return { longitude, latitude, zoom, pitch: selected ? 58 : 46, bearing: 0 };
};

const TrailMap = ({ races, selected, onSelect }: ITrailMapProps) => {
  const mapRef = useRef<MapRef>();
  const [mapReady, setMapReady] = useState(false);
  const geoData = useMemo(() => routeGeoJson(races), [races]);

  const selectedRace = useMemo(
    () => races.find((race) => race.id === selected) ?? null,
    [races, selected]
  );

  const focusFilter = useMemo(
    () => ['==', ['get', 'raceId'], selected],
    [selected]
  );

  const mapRefCallback = useCallback((ref: MapRef) => {
    if (ref) {
      mapRef.current = ref;
      setMapReady(true);
    }
  }, []);

  const enableTerrain = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getSource(DEM_SOURCE)) {
      return false;
    }
    try {
      map.setTerrain({
        source: DEM_SOURCE,
        exaggeration: TERRAIN_EXAGGERATION,
      });
      map.setFog({
        color: 'rgb(14, 22, 36)',
        'high-color': 'rgb(46, 86, 120)',
        'horizon-blend': 0.6,
        'space-color': 'rgb(6, 10, 18)',
        'star-intensity': 0.2,
      });
    } catch {
      // the map still works without the terrain, the shade layer stays
    }
    return true;
  }, []);

  useEffect(() => {
    if (!mapReady) {
      return undefined;
    }
    const map = mapRef.current?.getMap();
    if (!map) {
      return undefined;
    }
    // the terrain is applied outside of the render loop, a fresh terrain
    // only gets its style properties on the frame after the style update
    const apply = () => {
      window.setTimeout(() => {
        if (enableTerrain()) {
          map.off('styledata', apply);
        }
      }, 0);
    };
    if (enableTerrain()) {
      return undefined;
    }
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [enableTerrain, mapReady]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }
    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }
    const target = selected
      ? races.find((race) => race.id === selected)
      : undefined;
    if (target) {
      const view = viewStateFor([target], selected);
      map.flyTo({
        center: [view.longitude, view.latitude],
        zoom: view.zoom,
        pitch: view.pitch,
        bearing: view.bearing,
        duration: 1400,
        essential: true,
      });
      return;
    }
    // the filter changed, the whole visible set gets framed again
    const view = viewStateFor(races, '');
    map.easeTo({
      center: [view.longitude, view.latitude],
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      duration: 900,
    });
  }, [races, selected, mapReady]);

  const onClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const raceId = feature?.properties?.raceId;
      if (typeof raceId === 'string' && raceId) {
        onSelect(raceId);
      }
    },
    [onSelect]
  );

  const start = selectedRace?.points[0];
  const end = selectedRace?.points[selectedRace.points.length - 1];
  const routeCount = races.filter((race) => race.points.length > 1).length;

  return (
    <section className={`panel panel-bracket ${styles.frame}`} data-trail-map>
      <header className="panel-header">
        <span className="eyebrow">
          <span className="status-dot" />
          terrain / 三维地形
        </span>
        <span className="chip">
          {routeCount} / {races.length} routes
        </span>
      </header>
      <div className={styles.map}>
        <Map
          initialViewState={viewStateFor(races, '')}
          ref={mapRefCallback}
          onClick={onClick}
          interactiveLayerIds={['trail-core', 'trail-focus']}
          style={{ width: '100%', height: 520 }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          attributionControl={false}
        >
          <Source
            id={DEM_SOURCE}
            type="raster-dem"
            url="mapbox://mapbox.mapbox-terrain-dem-v1"
            tileSize={512}
            maxzoom={14}
          >
            <Layer
              id="trail-shade"
              type="hillshade"
              paint={{
                'hillshade-exaggeration': 0.35,
                'hillshade-shadow-color': '#01060d',
                'hillshade-highlight-color': '#7fe3ff',
                'hillshade-accent-color': '#1b4a6b',
              }}
            />
          </Source>

          <Source id={ROUTE_SOURCE} type="geojson" data={geoData}>
            <Layer
              id="trail-glow"
              type="line"
              paint={{
                'line-color': ROUTE_COLORS.glow,
                'line-width': 4,
                'line-opacity': 0.3,
                'line-blur': 3,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="trail-core"
              type="line"
              paint={{
                'line-color': ROUTE_COLORS.core,
                'line-width': 1.5,
                'line-opacity': 0.85,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="trail-focus-glow"
              type="line"
              filter={focusFilter}
              paint={{
                'line-color': ROUTE_COLORS.glow,
                'line-width': 12,
                'line-opacity': 0.45,
                'line-blur': 8,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="trail-focus"
              type="line"
              filter={focusFilter}
              paint={{
                'line-color': '#ffffff',
                'line-width': 2.6,
                'line-opacity': 1,
              }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
          </Source>

          {start && (
            <Marker
              longitude={start[0]}
              latitude={start[1]}
              pitchAlignment="viewport"
            >
              <span className={styles.markerStart}>起</span>
            </Marker>
          )}
          {end && (
            <Marker longitude={end[0]} latitude={end[1]}>
              <span className={styles.markerEnd}>终</span>
            </Marker>
          )}

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendCore} />
              route
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendShade} />
              terrain
            </span>
          </div>
          <NavigationControl
            showCompass
            position="bottom-right"
            style={{ opacity: 0.85 }}
          />
          <ScaleControl position="bottom-left" style={{ opacity: 0.6 }} />
        </Map>
      </div>
    </section>
  );
};

export default TrailMap;
