import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { LngLat, MapMouseEvent, MapRef } from 'react-map-gl';
import { panCenter, rotateView, type ScreenPoint } from './gestures';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;
// the pixels the pointer has to travel before the gesture counts as a drag
const DRAG_THRESHOLD = 4;

type Gesture = 'rotate' | 'pan';

/**
 * Hands the mouse buttons of the terrain map their own meaning, the left
 * button turns the view and the right one drags the map. Mapbox pans with
 * the left button and turns the view with the right one, both of them are
 * taken over here.
 *
 * The returned function tells whether the click that just came in belongs to
 * a drag, a drag must not pick a race by accident.
 */
export const useMapGestures = (
  mapRef: RefObject<MapRef | undefined>,
  ready: boolean
) => {
  const dragged = useRef(false);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const map = mapRef.current?.getMap();
    if (!map) {
      return undefined;
    }
    const canvas = map.getCanvas();

    // the map event is the one the mouse handlers of mapbox listen to,
    // stopping it keeps them from panning or turning the view as well
    const blockNative = (event: MapMouseEvent) => {
      const button = event.originalEvent.button;
      if (button === LEFT_BUTTON || button === RIGHT_BUTTON) {
        event.preventDefault();
      }
    };
    map.on('mousedown', blockNative);

    let gesture: Gesture | null = null;
    let moved = false;
    let origin: ScreenPoint = { x: 0, y: 0 };
    let start = { bearing: 0, pitch: 0 };
    let anchor: LngLat | null = null;

    const pointOf = (event: MouseEvent): ScreenPoint => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!gesture) {
        return;
      }
      const point = pointOf(event);
      const delta = { x: point.x - origin.x, y: point.y - origin.y };
      if (!moved) {
        if (Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD) {
          return;
        }
        moved = true;
      }
      if (gesture === 'rotate') {
        const view = rotateView(start, delta);
        map.setBearing(view.bearing);
        map.setPitch(view.pitch);
        return;
      }
      if (!anchor) {
        return;
      }
      // the grabbed point has to travel to the cursor, the camera walks the
      // other way so that the map follows the hand
      const next = panCenter(
        map.project(anchor),
        map.project(map.getCenter()),
        point
      );
      map.setCenter(map.unproject([next.x, next.y]));
    };

    const onMouseUp = () => {
      gesture = null;
      anchor = null;
      dragged.current = moved;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button === LEFT_BUTTON) {
        gesture = 'rotate';
        start = { bearing: map.getBearing(), pitch: map.getPitch() };
      } else if (event.button === RIGHT_BUTTON) {
        gesture = 'pan';
        const point = pointOf(event);
        anchor = map.unproject([point.x, point.y]);
      } else {
        return;
      }
      moved = false;
      dragged.current = false;
      origin = pointOf(event);
      // the drag must not select the text of the page underneath
      event.preventDefault();
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      map.off('mousedown', blockNative);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [mapRef, ready]);

  const consume = useCallback(() => {
    if (!dragged.current) {
      return false;
    }
    dragged.current = false;
    return true;
  }, []);
  return consume;
};