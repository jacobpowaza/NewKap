import test from 'ava';
import {translateBoundsToDisplay} from '../main/common/display-bounds';

test('display-local crop bounds are translated to absolute desktop coordinates', t => {
  t.deepEqual(
    translateBoundsToDisplay(
      {x: 40, y: 50, width: 320, height: 180},
      {x: 1440, y: 0}
    ),
    {x: 1480, y: 50, width: 320, height: 180}
  );
});

test('display-local crop bounds preserve negative display origins', t => {
  t.deepEqual(
    translateBoundsToDisplay(
      {x: 40, y: 50, width: 320, height: 180},
      {x: -1280, y: -200}
    ),
    {x: -1240, y: -150, width: 320, height: 180}
  );
});
