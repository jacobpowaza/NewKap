export type Rectangle = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getContainedRectangle = (bounds: Rectangle, content: Size): Rectangle => {
  if (bounds.width <= 0 || bounds.height <= 0 || content.width <= 0 || content.height <= 0) {
    return {...bounds, width: 0, height: 0};
  }

  const scale = Math.min(bounds.width / content.width, bounds.height / content.height);
  const width = content.width * scale;
  const height = content.height * scale;

  return {
    left: bounds.left + ((bounds.width - width) / 2),
    top: bounds.top + ((bounds.height - height) / 2),
    width,
    height
  };
};

export const getCanvasPointFromClientPoint = ({
  client,
  bounds,
  canvasSize
}: {
  client: Point;
  bounds: Rectangle;
  canvasSize: Size;
}): Point => {
  const rendered = getContainedRectangle(bounds, canvasSize);

  if (rendered.width <= 0 || rendered.height <= 0) {
    return {x: 0, y: 0};
  }

  return {
    x: clamp(((client.x - rendered.left) / rendered.width) * canvasSize.width, 0, canvasSize.width),
    y: clamp(((client.y - rendered.top) / rendered.height) * canvasSize.height, 0, canvasSize.height)
  };
};
