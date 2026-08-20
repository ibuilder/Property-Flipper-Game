/**
 * Types for `image.mjs`.
 *
 * The module is plain JavaScript because it is build tooling that runs under
 * bare `node` with no compile step, the same as every other script in here.
 * The tests are TypeScript, so the shape is declared rather than inferred --
 * without this, `readPng` comes back as `any` and the round-trip test that
 * exists to catch a swapped colour channel would not notice a swapped argument.
 */

/** An image in memory. Always RGBA, four bytes per pixel, row-major. */
export interface Bitmap {
  w: number;
  h: number;
  data: Buffer;
}

/** Decode an 8-bit non-interlaced PNG. Throws on anything else. */
export function readPng(path: string): Bitmap;

/** A rectangle out of an image, clamped to its bounds. No resampling. */
export function crop(img: Bitmap, x: number, y: number, w: number, h: number): Bitmap;

/** Area-averaged resample to an exact size. */
export function resize(img: Bitmap, w: number, h: number): Bitmap;

/**
 * Crop to the target aspect ratio, then resize to it.
 *
 * `anchorY` / `anchorX` choose which band survives the crop: 0 the top or left,
 * 1 the bottom or right, 0.5 the middle.
 */
export function fit(
  img: Bitmap,
  w: number,
  h: number,
  anchorY?: number,
  anchorX?: number,
): Bitmap;

/** Write a PNG. `opaque` drops the alpha channel, which is a third smaller. */
export function writePng(path: string, img: Bitmap, options?: { opaque?: boolean }): string;
