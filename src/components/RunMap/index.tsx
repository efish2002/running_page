import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import Map, { Layer, Source, FullscreenControl, NavigationControl, MapRef } from 'react-map-gl';
import { WebMercatorViewport } from 'viewport-mercator-project';
import useActivities from '@/hooks/useActivities';
import {
  MAP_LAYER_LIST,
  IS_CHINESE,
  ROAD_LABEL_DISPLAY,
  MAPBOX_TOKEN,
  USE_DASH_LINE,
  LINE_OPACITY,
  MAP_HEIGHT,
} from '@/utils/const';
import {
  geoJsonForRuns,
  formatRunTime,
  formatPace,
} from '@/utils/utils';

// 添加颜色函数（从 workouts_page 复制）
const colorFromType = (workoutType: string): string => {
  switch (workoutType) {
    case 'Run':
      return '#32D74B';
    case 'Trail Run':
      return '#FF9500';
    case 'Ride':
    case 'Indoor Ride':
      return '#007AFF';
    case 'VirtualRide':
      return '#5856D6';
    case 'Hike':
      return '#8E8E93';
    case 'Rowing':
      return '#5AC8FA';
    case 'Swim':
      return '#34C759';
    default:
      return '#32D74B';
  }
};
import RunMarker from './RunMarker';
import styles from './style.module.css';

const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide']);

// 计算两点间方位角
const calculateBearing = (start, end) => {
  const PI = Math.PI;
  const lat1 = (start[1] * PI) / 180;
  const lon1 = (start[0] * PI) / 180;
  const lat2 = (end[1] * PI) / 180;
  const lon2 = (end[0] * PI) / 180;
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / PI + 360) % 360;
};

// 获取核心边界
const getCoreBounds = (features) => {
  const allCoords = features
    .flatMap(f => f.geometry.coordinates)
    .filter(p => p && p[0] > 70 && p[0] < 140 && p[1] > 10 && p[1] < 60);

  if (allCoords.length === 0) return null;

  const lons = allCoords.map(p => p[0]).sort((a, b) => a - b);
  const lats = allCoords.map(p => p[1]).sort((a, b) => a - b);
  const medianLon = lons[Math.floor(lons.length / 2)];
  const medianLat = lats[Math.floor(lats.length / 2)];

  const coreCoords = allCoords.filter(
    p => Math.abs(p[0] - medianLon) < 0.3 && Math.abs(p[1] - medianLat) < 0.3
  );

  const finalCoords = coreCoords.length > 0 ? coreCoords : allCoords;
  return [
    [Math.min(...finalCoords.map(p => p[0])), Math.min(...finalCoords.map(p => p[1]))],
    [Math.max(...finalCoords.map(p => p[0])), Math.max(...finalCoords.map(p => p[1]))]
  ];
};

const RunMap = ({ title, changeYear, geoData, thisYear }) => {
  const { runs } = useActivities();
  
  const mapRef = useRef(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(3);

  // 判断是否为单条轨迹
  const isSingleRun = geoData?.features?.length === 1 && geoData?.features[0]?.geometry?.coordinates?.length > 0;
  const isBigMap = currentZoom <= 3;

  // 初始边界
  const initialBounds = useMemo(() => {
    const b = getCoreBounds(geoData?.features || []);
    return b || [[70, 10], [140, 60]];
  }, []);

  // 获取单条跑步的统计信息
  const runStats = useMemo(() => {
    if (!isSingleRun || !geoData?.features?.length) return null;

    const feature = geoData.features[0];
    const points = feature.geometry.coordinates;
    if (!points?.length) return null;

    const props = feature.properties || {};
    const targetId = props.run_id || feature.id;
    
    let fullRun = null;
    if (targetId !== undefined && targetId !== null) {
      fullRun = runs.find(r => String(r.run_id) === String(targetId) || String(r.id) === String(targetId));
    }
    
    if (!fullRun && props.start_date_local) {
      fullRun = runs.find(r => r.start_date_local === props.start_date_local);
    }

    const type = fullRun?.type || props.type || 'Run';
    const averageSpeed = fullRun?.average_speed || props.average_speed;
    const movingTime = fullRun?.moving_time || props.moving_time;

    return {
      name: props.name || '',
      startLon: points[0][0],
      startLat: points[0][1],
      endLon: points[points.length - 1][0],
      endLat: points[points.length - 1][1],
      distance: fullRun?.distance || props.distance || 0,
      runTimeStr: movingTime ? formatRunTime(movingTime) : '--:--',
      paceParts: averageSpeed ? formatPace(averageSpeed, type) : null,
      heartRate: fullRun?.average_heartrate || props.average_heartrate,
      displayDate: (fullRun?.start_date_local || props.start_date_local || '').slice(0, 10),
      isRide: RIDE_TYPES.has(type),
      runColor: colorFromType(type) || props.color || '#32D74B'
    };
  }, [isSingleRun, geoData, runs]);

  // ========== 核心：三维动画效果 ==========
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !mapLoaded) return;

    let animationFrameId;
    let isAnimating = true;
    const timeouts = [];

    const addTimeout = (fn, delay) => {
      const id = setTimeout(fn, delay);
      timeouts.push(id);
      return id;
    };

    // 单条轨迹时启用三维动画
    if (isSingleRun && geoData?.features?.length === 1) {
      const points = geoData.features[0].geometry.coordinates;
      const totalPoints = points.length;
      if (totalPoints < 2) return;

      const props = geoData.features[0].properties || {};
      let distance = props.distance || 0;
      if (!distance) {
        const targetId = props.run_id || geoData.features[0].id;
        const fullRun = runs.find(r => String(r.run_id) === String(targetId) || String(r.id) === String(targetId));
        distance = fullRun?.distance || 5000;
      }
      const distanceKm = distance / 1000;

      // 根据距离计算动画时长
      let targetDurationMs = 3500 + Math.sqrt(distanceKm) * 800;
      targetDurationMs = Math.min(targetDurationMs, 12000);

      // 计算累计距离数组
      const cumulativeDistances = new Float32Array(totalPoints);
      cumulativeDistances[0] = 0;
      for (let i = 1; i < totalPoints; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        cumulativeDistances[i] = cumulativeDistances[i - 1] + Math.sqrt(dx * dx + dy * dy);
      }
      const totalGeoDistance = cumulativeDistances[totalPoints - 1];

      let startTime = null;
      const startBearing = calculateBearing(points[0], points[Math.min(5, totalPoints - 1)]);
      let currentBearing = startBearing;

      // 1. 飞行到起点（三维视角）
      map.flyTo({
        center: points[0],
        bearing: startBearing,
        pitch: 70,
        zoom: 16,
        duration: 2500,
        essential: true
      });

      // 2. 动画循环
      const animate = (timestamp) => {
        if (!isAnimating) return;
        if (!startTime) startTime = timestamp;

        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / targetDurationMs, 1);
        const targetDist = progress * totalGeoDistance;

        // 二分查找当前位置
        let l = 0, r = totalPoints - 1, idx = 0;
        while (l <= r) {
          const mid = (l + r) >> 1;
          if (cumulativeDistances[mid] <= targetDist) {
            idx = mid;
            l = mid + 1;
          } else {
            r = mid - 1;
          }
        }
        if (idx >= totalPoints - 1) idx = totalPoints - 2;

        // 线性插值
        const distA = cumulativeDistances[idx];
        const distB = cumulativeDistances[idx + 1];
        const segmentLen = distB - distA;
        const remainder = segmentLen > 0 ? (targetDist - distA) / segmentLen : 0;

        setAnimationProgress(idx + remainder);

        if (progress < 1) {
          const p1 = points[idx];
          const p2 = points[idx + 1];
          const lng = p1[0] + (p2[0] - p1[0]) * remainder;
          const lat = p1[1] + (p2[1] - p1[1]) * remainder;

          // 计算前进方向
          const lookAheadDist = targetDist + totalGeoDistance * 0.05;
          let lookAheadIdx = idx;
          while (lookAheadIdx < totalPoints - 1 && cumulativeDistances[lookAheadIdx] < lookAheadDist) {
            lookAheadIdx++;
          }
          const targetBearing = calculateBearing([lng, lat], points[lookAheadIdx]);
          
          // 平滑转向
          let diff = targetBearing - currentBearing;
          diff = ((diff + 540) % 360) - 180;
          currentBearing += diff * 0.05;

          // 更新相机
          map.easeTo({
            center: [lng, lat],
            bearing: currentBearing,
            pitch: 70,
            zoom: 16,
            duration: 32,
            easing: (t) => t
          });

          animationFrameId = requestAnimationFrame(animate);
        } else {
          // 动画结束，展示完整轨迹
          setAnimationProgress(totalPoints);
          addTimeout(() => {
            const bounds = [
              [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))],
              [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]
            ];
            map.fitBounds(bounds, { padding: 60, pitch: 0, bearing: 0, duration: 3000 });
          }, 1000);
        }
      };

      // 延迟启动动画
      addTimeout(() => {
        if (isAnimating) animationFrameId = requestAnimationFrame(animate);
      }, 2600);

    } else {
      // 多条轨迹时重置视角
      setAnimationProgress(0);
      const bounds = getCoreBounds(geoData?.features || []);
      if (bounds) {
        const viewport = new WebMercatorViewport({ width: 800, height: 600 });
        const cam = viewport.fitBounds(bounds, { padding: 60 });
        addTimeout(() => {
          map.easeTo({
            center: cam.center,
            zoom: cam.zoom - 0.2,
            pitch: 0,
            bearing: 0,
            duration: 2000,
            easing: t => t * (2 - t),
            essential: true
          });
        }, 50);
      }
    }

    return () => {
      isAnimating = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      timeouts.forEach(clearTimeout);
    };
  }, [geoData, mapLoaded, isSingleRun, runs]);

  // 根据动画进度截取轨迹
  const displayData = useMemo(() => {
    if (!geoData) return null;

    if (geoData.features?.length === 1 && animationProgress > 0) {
      const feature = geoData.features[0];
      const points = feature.geometry.coordinates;
      const idx = Math.floor(animationProgress);
      const remainder = animationProgress - idx;
      
      const coords = points.slice(0, idx + 1);
      
      if (idx < points.length - 1 && remainder > 0) {
        const p1 = points[idx];
        const p2 = points[idx + 1];
        coords.push([
          p1[0] + (p2[0] - p1[0]) * remainder,
          p1[1] + (p2[1] - p1[1]) * remainder
        ]);
      }

      return {
        ...geoData,
        features: [{
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: coords
          }
        }]
      };
    }
    
    return geoData;
  }, [geoData, animationProgress]);

  const onMapLoad = useCallback((e) => {
    const map = e.target;
    if (map && IS_CHINESE) {
      import('@mapbox/mapbox-gl-language').then(module => {
        const MapboxLanguage = module.default;
        map.addControl(new MapboxLanguage({ defaultLanguage: 'zh-Hans' }));
      });
    }
    if (map && !ROAD_LABEL_DISPLAY) {
      MAP_LAYER_LIST.forEach(layerId => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });
    }
    setMapLoaded(true);
  }, []);

  const dash = USE_DASH_LINE && !isSingleRun && !isBigMap ? [2, 2] : [2, 0];

  return (
    <Map
      ref={mapRef}
      onLoad={onMapLoad}
      initialViewState={{ bounds: initialBounds, fitBoundsOptions: { padding: 60 } }}
      onZoom={(e) => setCurrentZoom(e.viewState.zoom)}
      style={{ width: '100%', height: MAP_HEIGHT }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      logoPosition="bottom-right"
      attributionControl={false}
      // ========== 三维效果配置 ==========
      fog={{ range: [0.8, 3.5], color: "#151516", "horizon-blend": 0.15, "star-intensity": 0.2 }}
      terrain={isSingleRun ? { source: 'mapbox-dem', exaggeration: 2.5 } : undefined}
    >
      {/* 3D 建筑物 */}
      <Layer
        id="3d-buildings"
        source="composite"
        source-layer="building"
        filter={['==', 'extrude', 'true']}
        type="fill-extrusion"
        minzoom={14}
        paint={{
          'fill-extrusion-color': '#1C1C1E',
          'fill-extrusion-height': ['*', ['get', 'height'], 4.0],
          'fill-extrusion-base': ['*', ['get', 'min_height'], 4.0],
          'fill-extrusion-opacity': 0.85,
        }}
      />
      
      {/* 地形数据源 */}
      <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} maxzoom={14} />
      
      {/* 轨迹图层 */}
      <Source id="data" type="geojson" data={displayData}>
        <Layer
          id="runs2"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': isSingleRun ? 5 : (isBigMap ? 1 : 2),
            'line-dasharray': dash,
            'line-opacity': isSingleRun || isBigMap ? 1 : LINE_OPACITY,
            'line-blur': 1,
          }}
          layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        />
      </Source>

      {/* 起点/终点标记 */}
      {isSingleRun && runStats && (
        <RunMarker 
          startLat={runStats.startLat} 
          startLon={runStats.startLon} 
          endLat={runStats.endLat} 
          endLon={runStats.endLon} 
        />
      )}
      
      <FullscreenControl position="top-left" />
      <NavigationControl showCompass={false} position="bottom-left" />

      {/* 单条轨迹信息卡片 */}
      {isSingleRun && runStats && (
        <div className={styles.runDetailCard}>
          <div className={styles.detailName}>
            <span>{runStats.name}</span>
            {runStats.displayDate && <span className={styles.detailDate}>{runStats.displayDate}</span>}
          </div>
          <div className={styles.detailStatsRow}>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>里程</span>
              <span className={styles.statVal} style={{ color: runStats.runColor }}>
                {(runStats.distance / 1000).toFixed(2)}<small>km</small>
              </span>
            </div>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>用时</span>
              <span className={styles.statVal}>{runStats.runTimeStr}</span>
            </div>
            <div className={styles.detailStatBlock}>
              <span className={styles.statLabel}>{runStats.isRide ? '均速' : '配速'}</span>
              <span className={styles.statVal}>{runStats.paceParts || "--'--"}</span>
            </div>
            {runStats.heartRate && (
              <div className={styles.detailStatBlock}>
                <span className={styles.statLabel}>心率</span>
                <span className={styles.statVal}>{Math.round(runStats.heartRate)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Map>
  );
};

export default RunMap;
