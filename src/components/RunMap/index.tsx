import MapboxLanguage from '@mapbox/mapbox-gl-language';
import React, { useRef, useCallback, useState, useEffect } from 'react';
import Map, {
  Layer,
  Source,
  FullscreenControl,
  NavigationControl,
  MapRef,
} from 'react-map-gl';
import { MapInstance } from 'react-map-gl/src/types/lib';
import useActivities from '@/hooks/useActivities';
import {
  MAP_LAYER_LIST,
  IS_CHINESE,
  ROAD_LABEL_DISPLAY,
  MAPBOX_TOKEN,
  USE_DASH_LINE,
  MAP_HEIGHT,
  PRIVACY_MODE,
  LIGHTS_ON,
} from '@/utils/const';
import {
  PROVINCE_BASE_COLOR,
  PROVINCE_FILL_COLOR,
  PROVINCE_BORDER_COLOR,
  COUNTRY_FILL_COLOR,
  COUNTRY_BORDER_COLOR,
  ROUTE_COLORS,
} from '@/utils/colors';
import {
  Coordinate,
  IViewState,
  worldGeoJsonForMap,
  chinaGeoJsonForMap,
} from '@/utils/utils';
import RunMarker from './RunMarker';
import RunMapButtons from './RunMapButtons';
import styles from './style.module.css';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';
import LightsControl from '@/components/RunMap/LightsControl';

// layers owned by this component, their visibility is driven by props
const OWN_LAYERS = [
  'countries',
  'world-line',
  'provinces-base',
  'province',
  'provinces-line',
  'runs-glow',
  'runs2',
];

interface IRunMapProps {
  title: string;
  viewState: IViewState;
  setViewState: (_viewState: IViewState) => void;
  changeYear: (_year: string) => void;
  geoData: FeatureCollection<RPGeometry>;
  thisYear: string;
}

const RunMap = ({
  title,
  viewState,
  setViewState,
  changeYear,
  geoData,
  thisYear,
}: IRunMapProps) => {
  const { countries, provinces } = useActivities();
  const mapRef = useRef<MapRef>();
  const [lights, setLights] = useState(PRIVACY_MODE ? false : LIGHTS_ON);
  function switchLayerVisibility(map: MapInstance, lights: boolean) {
    const styleJson = map.getStyle();
    styleJson.layers.forEach((it: { id: string }) => {
      if (!OWN_LAYERS.includes(it.id)) {
        if (lights) map.setLayoutProperty(it.id, 'visibility', 'visible');
        else map.setLayoutProperty(it.id, 'visibility', 'none');
      }
    });
  }
  const mapRefCallback = useCallback(
    (ref: MapRef) => {
      if (ref !== null) {
        const map = ref.getMap();
        if (map && IS_CHINESE) {
          map.addControl(new MapboxLanguage({ defaultLanguage: 'zh-Hans' }));
        }
        // all style resources have been downloaded
        // and the first visually complete rendering of the base style has occurred.
        map.on('style.load', () => {
          if (!ROAD_LABEL_DISPLAY) {
            MAP_LAYER_LIST.forEach((layerId) => {
              if (map.getLayer(layerId)) {
                map.removeLayer(layerId);
              }
            });
          }
          mapRef.current = ref;
          switchLayerVisibility(map, lights);
        });
      }
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        switchLayerVisibility(map, lights);
      }
    },
    [mapRef, lights]
  );
  const filterProvinces = provinces.slice();
  const filterCountries = countries.slice();
  // for geojson format
  filterProvinces.unshift('in', 'name');
  filterCountries.unshift('in', 'name');

  const isBigMap = (viewState.zoom ?? 0) <= 3;
  const showBoundaries = IS_CHINESE && isBigMap;
  const boundaryVisibility = lights ? 'visible' : 'none';

  const isSingleRun =
    !isBigMap &&
    geoData.features.length === 1 &&
    geoData.features[0].geometry.coordinates.length;
  let startLon = 0;
  let startLat = 0;
  let endLon = 0;
  let endLat = 0;
  if (isSingleRun) {
    const points = geoData.features[0].geometry.coordinates as Coordinate[];
    [startLon, startLat] = points[0];
    [endLon, endLat] = points[points.length - 1];
  }
  let dash = USE_DASH_LINE && !isSingleRun && !isBigMap ? [2, 2] : [2, 0];
  const onMove = React.useCallback(
    ({ viewState }: { viewState: IViewState }) => {
      setViewState(viewState);
    },
    []
  );
  const style: React.CSSProperties = {
    width: '100%',
    height: MAP_HEIGHT,
  };
  const fullscreenButton: React.CSSProperties = {
    position: 'absolute',
    marginTop: '29.2px',
    right: '0px',
    opacity: 0.3,
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (mapRef.current) {
        mapRef.current.getMap().resize();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <section className={`panel panel-bracket ${styles.frame}`} data-run-map>
      <header className="panel-header">
        <span className="eyebrow">
          <span className="status-dot" />
          route feed / 路线图层
        </span>
        <RunMapButtons changeYear={changeYear} thisYear={thisYear} />
      </header>
      <div className={styles.map}>
        <Map
          {...viewState}
          onMove={onMove}
          style={style}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          ref={mapRefCallback}
          mapboxAccessToken={MAPBOX_TOKEN}
        >
          {showBoundaries && (
            <Source
              id="world-boundary"
              type="geojson"
              data={worldGeoJsonForMap}
            >
              <Layer
                id="countries"
                type="fill"
                paint={{
                  'fill-color': COUNTRY_FILL_COLOR,
                  'fill-opacity': 0.75,
                }}
                filter={filterCountries}
                layout={{ visibility: boundaryVisibility }}
              />
              <Layer
                id="world-line"
                type="line"
                paint={{
                  'line-color': COUNTRY_BORDER_COLOR,
                  'line-width': 0.6,
                  'line-opacity': 0.6,
                }}
                layout={{ visibility: boundaryVisibility }}
              />
            </Source>
          )}
          {showBoundaries && (
            <Source
              id="china-boundary"
              type="geojson"
              data={chinaGeoJsonForMap}
            >
              <Layer
                id="provinces-base"
                type="fill"
                paint={{
                  'fill-color': PROVINCE_BASE_COLOR,
                }}
                layout={{ visibility: boundaryVisibility }}
              />
              <Layer
                id="province"
                type="fill"
                paint={{
                  'fill-color': PROVINCE_FILL_COLOR,
                }}
                filter={filterProvinces}
                layout={{ visibility: boundaryVisibility }}
              />
              <Layer
                id="provinces-line"
                type="line"
                paint={{
                  'line-color': PROVINCE_BORDER_COLOR,
                  'line-width': 0.7,
                  'line-opacity': 0.85,
                }}
                layout={{ visibility: boundaryVisibility }}
              />
            </Source>
          )}
          <Source id="data" type="geojson" data={geoData}>
            <Layer
              id="runs-glow"
              type="line"
              paint={{
                'line-color': ROUTE_COLORS.glow,
                'line-width': isSingleRun ? 10 : isBigMap ? 3 : 5,
                'line-opacity': isSingleRun ? 0.35 : isBigMap ? 0.16 : 0.22,
                'line-blur': isSingleRun ? 4 : 3,
              }}
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
            />
            <Layer
              id="runs2"
              type="line"
              paint={{
                'line-color': ROUTE_COLORS.core,
                'line-width': isSingleRun ? 3 : isBigMap ? 0.8 : 1.4,
                'line-dasharray': dash,
                'line-opacity': isSingleRun ? 1 : isBigMap ? 0.55 : 0.8,
                'line-blur': 0.4,
              }}
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
            />
          </Source>
          {isSingleRun && (
            <RunMarker
              startLat={startLat}
              startLon={startLon}
              endLat={endLat}
              endLon={endLon}
            />
          )}
          {title && <span className={styles.runTitle}>{title}</span>}
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.legendCore} />
              core
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendGlow} />
              halo
            </span>
            {showBoundaries && (
              <span className={styles.legendItem}>
                <span className={styles.legendVisit} />
                visited
              </span>
            )}
          </div>
          <FullscreenControl style={fullscreenButton} />
          {!PRIVACY_MODE && (
            <LightsControl setLights={setLights} lights={lights} />
          )}
          <NavigationControl
            showCompass={false}
            position={'bottom-right'}
            style={{ opacity: 0.85 }}
          />
        </Map>
      </div>
    </section>
  );
};

export default RunMap;
