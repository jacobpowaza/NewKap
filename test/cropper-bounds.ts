import test from 'ava';
import {validateCropperBounds} from '../main/common/cropper-bounds';

test('saved cropper bounds are restored when valid for the active display', t => {
  const cropper = validateCropperBounds({
    displayId: 7,
    x: 120,
    y: 80,
    width: 640,
    height: 360,
    ratio: [16, 9]
  }, {
    id: 7,
    width: 1440,
    height: 900
  });

  t.deepEqual(cropper, {
    displayId: 7,
    x: 120,
    y: 80,
    width: 640,
    height: 360,
    ratio: [16, 9]
  });
});

test('saved cropper bounds are clamped to current display size', t => {
  const cropper = validateCropperBounds({
    displayId: 7,
    x: 1300,
    y: 800,
    width: 900,
    height: 500,
    ratio: [16, 9]
  }, {
    id: 7,
    width: 1440,
    height: 900
  });

  t.deepEqual(cropper, {
    displayId: 7,
    x: 540,
    y: 400,
    width: 900,
    height: 500,
    ratio: [16, 9]
  });
});

test('saved cropper bounds are ignored for a different display or invalid dimensions', t => {
  t.is(validateCropperBounds({
    displayId: 1,
    x: 10,
    y: 10,
    width: 100,
    height: 100
  }, {
    id: 2,
    width: 800,
    height: 600
  }), undefined);

  t.is(validateCropperBounds({
    displayId: 2,
    x: 10,
    y: 10,
    width: 0,
    height: 100
  }, {
    id: 2,
    width: 800,
    height: 600
  }), undefined);
});
