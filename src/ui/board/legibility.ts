import { TILE, ZOOM, type ZoomLevel } from './projection';

/**
 * How big things have to be to be worth drawing.
 *
 * The board is one SVG scaled to whatever width it is given, so everything in
 * it -- lots, houses, ink, Scout -- shrinks together as the window narrows.
 * Measured on a 375px phone, the six-district board renders at 0.31 CSS pixels
 * per board unit: lots 17.6px across, hairlines at 0.17px, and Scout at 5.9px.
 * A stroke thinner than a pixel is not a faint line, it is a line the renderer
 * is free to drop, so at that size the drawing does not read as small -- it
 * reads as missing.
 *
 * None of this is a fixed breakpoint. The board does not care whether it is on
 * a phone; it cares how many pixels it actually got, which is a different
 * number on a split window, a sidebar, or a tablet held either way. So
 * everything here is a function of the measured frame, and the pieces that have
 * a legibility floor are given one in CSS pixels rather than in board units.
 */

/** Board units across one lot, corner to corner. */
export const LOT_UNITS = TILE * 0.7071 * 2;

/**
 * A lot has to be about this wide before a house on it is a house.
 *
 * Below it the ten silhouettes stop being distinguishable, which is the one
 * quality bar the archetypes were commissioned against -- a duplex must not
 * read as a bungalow while you are choosing which lot to open.
 */
export const MIN_LOT_PX = 26;

/** Scout's floor. Under this he is a smudge with a hard hat. */
export const MIN_SPRITE_PX = 14;

/** And his ceiling, as a share of a lot, so he never rivals the building. */
const SPRITE_LOT_SHARE = 0.34;

/** Roughly how wide Scout's own drawing is, in his artboard's units. */
const SPRITE_ART_WIDTH = 51;

/** CSS pixels per board unit, at a given zoom. */
export function pxPerUnit(frameWidth: number, extentWidth: number, zoom = 1): number {
  if (frameWidth <= 0 || extentWidth <= 0) return 0;
  return (frameWidth * zoom) / extentWidth;
}

/**
 * The zoom to open at on this device.
 *
 * The smallest stop that makes a lot legible, which on a wide window is the
 * whole town and on a phone is a block. Every stop stays available -- this
 * picks where to start, it does not take the control away. Choosing for the
 * player and then locking them out of the choice would be worse than the
 * illegible default it replaces.
 */
export function fitZoom(frameWidth: number, extentWidth: number): ZoomLevel {
  const stops = Object.keys(ZOOM) as ZoomLevel[];
  for (const z of stops) {
    const lotPx = LOT_UNITS * pxPerUnit(frameWidth, extentWidth, ZOOM[z]);
    if (lotPx >= MIN_LOT_PX) return z;
  }
  // Nothing clears the bar, so open as close in as the board goes.
  return stops[stops.length - 1];
}

/**
 * The art unit to read Scout's sprites in, for this rendered size.
 *
 * This is the number the delivery never stated. Every other placeable piece
 * carries a scale; the six sprites carry only a ground-contact anchor. Read in
 * the coloured set's own units all six frames come out 65 to 69% of a lot wide,
 * which is a dog as long as the parked car two lots over.
 *
 * So it is chosen, and now chosen per device rather than once: a third of a lot
 * wherever a third of a lot is big enough to see, and larger in proportion as
 * the board gets smaller, so he does not disappear before the houses do. A
 * bigger art unit means a smaller sprite, which is why the floor divides.
 */
export function spriteUnit(frameWidth: number, extentWidth: number, zoom = 1): number {
  const px = pxPerUnit(frameWidth, extentWidth, zoom);
  const wanted = LOT_UNITS * SPRITE_LOT_SHARE;
  // Board units Scout needs to be, to clear the floor in real pixels.
  const floor = px > 0 ? MIN_SPRITE_PX / px : wanted;
  const widthUnits = Math.max(wanted, floor);
  return (SPRITE_ART_WIDTH * TILE) / widthUnits;
}

/**
 * The thinnest line worth drawing, in *device* pixels.
 *
 * Device rather than CSS pixels, because that is the distinction that decides
 * whether a hairline survives. The delivered ink is 0.55 board units, and the
 * board renders at roughly one CSS pixel per unit on a desktop -- so the line
 * is half a CSS pixel, which is perfectly solid on the 2x display it was tuned
 * on and disappears on a 1x one.
 */
const MIN_STROKE_DEVICE_PX = 0.75;

/**
 * Ink weight for the line board, in board units.
 *
 * Held at the delivered hairline until a hairline would fall under a device
 * pixel, then widened by exactly enough to survive. Scaling ink with the board
 * would thicken it on a large screen, which is the opposite of what a drawing
 * wants: the point is that the line stays fine and stays *there*.
 */
export function inkWeight(
  base: number,
  frameWidth: number,
  extentWidth: number,
  zoom = 1,
  devicePixelRatio = 1,
): number {
  const px = pxPerUnit(frameWidth, extentWidth, zoom);
  if (px <= 0) return base;
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const minUnits = MIN_STROKE_DEVICE_PX / dpr / px;
  return Math.max(base, minUnits);
}
