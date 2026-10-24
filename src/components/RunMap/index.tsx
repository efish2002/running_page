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
  PROVINCE_FILL_COLOR,
  COUNTRY_FILL_COLOR,
  ROUTE_COLORS,
} from '@/utils/colors';
import { Coordinate, IViewState, geoJsonForMap } from '@/utils/utils';
import RunMarker from './RunMarker';
import RunMapButtons from './RunMapButtons';
import styles from './style.module.css';
import { FeatureCollection } from 'geojson';
import { RPGeometry } from '@/static/run_countries';
import './mapbox.css';
import LightsControl from '@/components/RunMap/LightsControl';

const calculateBearing = (start, end) => {
  const PI = Math.PI;
  const lat1 = (start[1] * PI) / 180;
  const lon1 = (start[0] * PI) / 180;
  const lat2 = (end[1] * PI) / 180;
  const lon2 = (end[0] * PI) / 180;
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / PI + 360) % 360;
};

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
  const keepWhenLightsOff = ['runs2', 'runs-glow'];
  function switchLayerVisibility(map: MapInstance, lights: boolean) {
    const styleJson = map.getStyle();
    styleJson.layers.forEach((it: { id: string }) => {
      if (!keepWhenLightsOff.includes(it.id)) {
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

  const initGeoDataLength = geoData.features.length;
  const isBigMap = (viewState.zoom ?? 0) <= 3;
  if (isBigMap && IS_CHINESE) {
    // Show boundary and line together, combine geoData(only when not combine yet)
    if (geoData.features.length === initGeoDataLength) {
      geoData = {
        type: 'FeatureCollection',
        features: geoData.features.concat(geoJsonForMap().features),
      };
    }
  }

  const isSingleRun =
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
    <section className={`panel panel-bracket ${styles.frame}`}>
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
          <Source id="data" type="geojson" data={geoData}>
            <Layer
              id="province"
              type="fill"
              paint={{
                'fill-color': PROVINCE_FILL_COLOR,
              }}
              filter={filterProvinces}
            />
            <Layer
              id="countries"
              type="fill"
              paint={{
                'fill-color': COUNTRY_FILL_COLOR,
                // in China, fill a bit lighter while already filled provinces
                'fill-opacity': [
                  'case',
                  ['==', ['get', 'name'], '中国'],
                  0.1,
                  0.5,
                ],
              }}
              filter={filterCountries}
            />
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
