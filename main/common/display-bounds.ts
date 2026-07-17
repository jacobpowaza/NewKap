export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const translateBoundsToDisplay = (bounds: Bounds, displayBounds: Pick<Bounds, 'x' | 'y'>): Bounds => ({
  ...bounds,
  x: displayBounds.x + bounds.x,
  y: displayBounds.y + bounds.y
});
