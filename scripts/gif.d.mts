/**
 * Types for `gif.mjs`. Same reason as `image.d.mts`: the module is plain
 * JavaScript because it is build tooling that runs under bare `node`, and the
 * tests are TypeScript.
 */
import type { Bitmap } from './image.mjs';

export type Rgb = [number, number, number];

/** Median-cut palette across every frame at once. */
export function quantise(frames: Bitmap[], max?: number, stride?: number): Rgb[];

/** Nearest-palette index per pixel. Pass a shared `cache` across frames. */
export function indexFrame(
  frame: Bitmap,
  palette: Rgb[],
  cache?: Map<number, number>,
): Uint8Array;

/** GIF's variable-width LZW. */
export function lzw(indices: Uint8Array | number[], minCodeSize: number): Buffer;

/** Write an animated GIF. `delay` is in hundredths of a second. */
export function writeGif(
  path: string,
  frames: Bitmap[],
  options?: { delay?: number; loop?: number; colours?: number },
): { path: string; bytes: number; w: number; h: number; frames: number; colours: number };
