import React from 'react';
import { Marker } from 'react-map-gl';

const RunMarker = ({ startLon, startLat, endLon, endLat }) => {
  const size = 5;
  
  return (
    <>
      <Marker longitude={startLon} latitude={startLat} pitchAlignment="viewport">
        <div style={{
          transform: `translate(${-size / 2}px,${-size}px)`,
          maxWidth: '25px',
        }}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="#32D74B">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </div>
      </Marker>
      <Marker longitude={endLon} latitude={endLat}>
        <div style={{
          transform: `translate(${-size / 2}px,${-size}px)`,
          maxWidth: '25px',
        }}>
          <svg width="25" height="25" viewBox="0 0 24 24" fill="#FF3B30">
            <circle cx="12" cy="12" r="8" />
          </svg>
        </div>
      </Marker>
    </>
  );
};

export default RunMarker;
