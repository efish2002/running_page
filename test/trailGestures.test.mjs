import assert from 'node:assert/strict';
import { rotateView, panCenter } from '../src/components/TrailMap/gestures.ts';

const round = (value) => Math.round(value * 1e6) / 1e6;

// --- rotateView -------------------------------------------------------
// the left button turns the view, the horizontal drag gives the bearing
// and the vertical one the pitch

const still = rotateView({ bearing: 0, pitch: 0 }, { x: 0, y: 0 });
assert.equal(still.bearing, 0, 'a drag that did not move keeps the bearing');
assert.equal(still.pitch, 0, 'a drag that did not move keeps the pitch');

const right = rotateView({ bearing: 0, pitch: 0 }, { x: 100, y: 0 });
assert.equal(
  round(right.bearing),
  80,
  'a hundred pixels to the right turn the view by eighty degrees'
);

const up = rotateView({ bearing: 0, pitch: 0 }, { x: 0, y: -100 });
assert.equal(
  round(up.pitch),
  50,
  'a hundred pixels up tilt the view towards the horizon'
);

const down = rotateView({ bearing: 0, pitch: 46 }, { x: 0, y: 100 });
assert.equal(
  round(down.pitch),
  0,
  'a hundred pixels down lay the view flat on the ground'
);

const steep = rotateView({ bearing: 0, pitch: 80 }, { x: 0, y: -100 });
assert.equal(
  steep.pitch,
  85,
  'the pitch never reaches past eighty five degrees'
);

const keepsBearing = rotateView({ bearing: 37, pitch: 46 }, { x: 25, y: 0 });
assert.equal(
  round(keepsBearing.bearing),
  57,
  'the turn is counted from the bearing the drag started at'
);

// --- panCenter --------------------------------------------------------
// the right button drags the map, the grabbed point stays under the cursor

const untouched = panCenter(
  { x: 100, y: 100 },
  { x: 500, y: 300 },
  { x: 100, y: 100 }
);
assert.deepEqual(
  untouched,
  { x: 500, y: 300 },
  'a cursor that stayed put keeps the center where it was'
);

const dragged = panCenter(
  { x: 100, y: 100 },
  { x: 500, y: 300 },
  { x: 140, y: 100 }
);
assert.deepEqual(
  dragged,
  { x: 460, y: 300 },
  'the camera walks against the drag so the map follows the cursor'
);

const pulled = panCenter(
  { x: 100, y: 100 },
  { x: 500, y: 300 },
  { x: 100, y: 60 }
);
assert.deepEqual(
  pulled,
  { x: 500, y: 340 },
  'a drag upwards moves the camera down the screen'
);

console.log('trail gesture tests passed');
