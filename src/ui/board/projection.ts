/**
 * The isometric projection, in one place.
 *
 * The handoff is emphatic that this lives in a single module and that both the
 * ground and the label overlay read from it, and the reason is specific: if the
 * two ever disagree the labels drift off the lots they name, which looks like a
 * rendering bug and is actually two copies of the same arithmetic.
 *
 * Drawn as SVG polygons computed from these functions rather than as a
 * CSS `rotateX/rotateZ` ground layer. Same picture, and it avoids the trap the
 * handoff warns about in the same breath -- a transformed parent shears its
 * text, so labels have to live in a separate untransformed layer positioned by
 * hand. Computing the geometry directly means there is nothing to shear and
 * nothing to keep in sync.
 */

/** Tile pitch: a 36px lot with a 4px gutter. */
export const TILE = 40;
/** The board is 17 tiles square. */
export const GRID = 17;
/** Half the board, in local units, so the origin sits at the centre. */
const HALF = (GRID * TILE) / 2;

/**
 * The two projection lines from the handoff.
 *
 * 0.7071 is cos(45°) and 0.3748 is the vertical foreshortening that falls out
 * of a 58° tilt. They are written as constants rather than derived so the board
 * cannot silently change shape if someone adjusts an angle elsewhere.
 */
const KX = 0.7071;
const KY = 0.3748;

export interface Point {
  x: number;
  y: number;
}

/**
 * Grid cell to screen point.
 *
 * `gx`/`gy` are fractional on purpose: corners are asked for at `gx + 1`, and
 * pins sit at cell centres.
 */
export function project(gx: number, gy: number, cx = 0, cy = 0): Point {
  const x = gx * TILE - HALF;
  const y = gy * TILE - HALF;
  return {
    x: cx + KX * (x + y),
    y: cy + KY * (y - x),
  };
}

/** The four corners of one cell's top face, clockwise from the north corner. */
export function tileTop(gx: number, gy: number, cx = 0, cy = 0): Point[] {
  return [
    project(gx, gy, cx, cy),
    project(gx + 1, gy, cx, cy),
    project(gx + 1, gy + 1, cx, cy),
    project(gx, gy + 1, cx, cy),
  ];
}

/**
 * The two visible side faces of an extruded cell.
 *
 * Only two of the four are ever seen from a fixed camera, so drawing the other
 * two is wasted geometry. `height` is in screen pixels rather than grid units:
 * the extrusion is a graphical device for "this reads as built", not a third
 * spatial dimension the projection knows about.
 */
export function tileSides(gx: number, gy: number, height: number, cx = 0, cy = 0): Point[][] {
  const [n, e, s, w] = tileTop(gx, gy, cx, cy);
  const drop = (p: Point): Point => ({ x: p.x, y: p.y + height });
  return [
    // South-east face.
    [e, s, drop(s), drop(e)],
    // South-west face.
    [s, w, drop(w), drop(s)],
  ];
}

/** A polygon as an SVG `points` string. */
export function toPoints(poly: Point[]): string {
  return poly.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/**
 * The bounding box of the whole board, for a viewBox.
 *
 * Computed from the projection rather than assumed, so changing TILE or GRID
 * cannot leave the board clipped.
 */
export function boardExtent(height = 0): { width: number; height: number; cx: number; cy: number } {
  const corners = [project(0, 0), project(GRID, 0), project(GRID, GRID), project(0, GRID)];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys) + height;
  const pad = 24;
  return {
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    cx: -minX + pad,
    cy: -minY + pad,
  };
}

export type ZoomLevel = 'town' | 'block' | 'lot';

/** The three camera stops. */
export const ZOOM: Record<ZoomLevel, number> = {
  town: 1,
  block: 1.8,
  lot: 3.2,
};
