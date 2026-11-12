export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ViewAngle {
  bearing: number;
  pitch: number;
}

// the degrees a pixel of drag turns the view, the same feel mapbox gives
// its own rotate gesture
const BEARING_PER_PIXEL = 0.8;
const PITCH_PER_PIXEL = 0.5;
const MAX_PITCH = 85;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Turns the view after a drag, the horizontal part gives the bearing and the
 * vertical one the pitch.
 */
export const rotateView = (
  start: ViewAngle,
  delta: ScreenPoint
): ViewAngle => ({
  bearing: start.bearing + delta.x * BEARING_PER_PIXEL,
  pitch: clamp(start.pitch - delta.y * PITCH_PER_PIXEL, 0, MAX_PITCH),
});

/**
 * Moves the camera so that the grabbed point ends up under the cursor, the
 * camera therefore walks against the drag.
 */
export const panCenter = (
  anchor: ScreenPoint,
  center: ScreenPoint,
  cursor: ScreenPoint
): ScreenPoint => ({
  x: center.x - (cursor.x - anchor.x),
  y: center.y - (cursor.y - anchor.y),
});
