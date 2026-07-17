export type CropperBounds = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  ratio?: number[];
  displayId?: number;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const validateCropperBounds = (
  cropper: CropperBounds | undefined,
  display: {id: number; width: number; height: number}
): CropperBounds | undefined => {
  if (!cropper || cropper.displayId !== display.id) {
    return undefined;
  }

  const {x, y, width, height, ratio} = cropper;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return undefined;
  }

  if (width <= 0 || height <= 0 || display.width <= 0 || display.height <= 0) {
    return undefined;
  }

  const boundedWidth = Math.min(width, display.width);
  const boundedHeight = Math.min(height, display.height);

  return {
    x: clamp(x, 0, Math.max(0, display.width - boundedWidth)),
    y: clamp(y, 0, Math.max(0, display.height - boundedHeight)),
    width: boundedWidth,
    height: boundedHeight,
    ratio: Array.isArray(ratio) && ratio.length === 2 && ratio.every(value => isFiniteNumber(value)) ? ratio : undefined,
    displayId: display.id
  };
};
