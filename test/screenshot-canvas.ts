import test from 'ava';
import {getCanvasPointFromClientPoint, getContainedRectangle} from '../main/common/screenshot-canvas';

test('screenshot pointer mapping accounts for horizontal letterboxing', t => {
  const point = getCanvasPointFromClientPoint({
    client: {x: 250, y: 250},
    bounds: {left: 0, top: 0, width: 500, height: 500},
    canvasSize: {width: 100, height: 200}
  });

  t.deepEqual(point, {x: 50, y: 100});
});

test('screenshot pointer mapping clamps to the rendered image rectangle', t => {
  const point = getCanvasPointFromClientPoint({
    client: {x: 125, y: 250},
    bounds: {left: 0, top: 0, width: 500, height: 500},
    canvasSize: {width: 100, height: 200}
  });

  t.deepEqual(point, {x: 0, y: 100});
});

test('contained rectangle preserves canvas aspect ratio inside css bounds', t => {
  t.deepEqual(getContainedRectangle(
    {left: 10, top: 20, width: 800, height: 300},
    {width: 400, height: 400}
  ), {
    left: 260,
    top: 20,
    width: 300,
    height: 300
  });
});
