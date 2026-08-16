import { describe, expect, it } from 'vitest';
import {
  LOT_UNITS,
  MIN_LOT_PX,
  MIN_SPRITE_PX,
  fitZoom,
  inkWeight,
  pxPerUnit,
  spriteUnit,
} from '../src/ui/board/legibility';
import { ZOOM, boardExtent } from '../src/ui/board/projection';

/**
 * Sizing the board against the device.
 *
 * Measured on a 375px phone before any of this existed: the six-district board
 * rendered at 0.31 CSS pixels per board unit -- lots 17.6px across, hairlines
 * at 0.17px, Scout at 5.9px. A stroke under a pixel is not a faint line, it is a
 * line the renderer may drop, so the drawing did not read as small, it read as
 * missing.
 *
 * These are the widths the board is actually given, not device categories: a
 * phone, a tablet, a split window and a comfortable desktop all end up here as
 * a number of pixels.
 */

const EXTENT = boardExtent(9).width;

// The board frame is inset from the viewport; these are measured frame widths.
const PHONE = 315;
const TABLET = 700;
const DESKTOP = 1018;

describe('sizing the board to the device', () => {
  it('opens the whole town only where the whole town is legible', () => {
    // On a wide window the default is unchanged: the town, all of it.
    expect(fitZoom(DESKTOP, EXTENT)).toBe('town');
    const desktopLot = LOT_UNITS * pxPerUnit(DESKTOP, EXTENT, ZOOM.town);
    expect(desktopLot).toBeGreaterThanOrEqual(MIN_LOT_PX);

    // On a phone it is not, so the board opens closer in rather than opening
    // on something nobody can read.
    expect(fitZoom(PHONE, EXTENT)).not.toBe('town');
  });

  it('never opens on a lot too small to tell a duplex from a bungalow', () => {
    for (const w of [PHONE, 420, 560, TABLET, 900, DESKTOP, 1600]) {
      const z = fitZoom(w, EXTENT);
      const lotPx = LOT_UNITS * pxPerUnit(w, EXTENT, ZOOM[z]);
      expect(lotPx, `${w}px frame opened at ${z}`).toBeGreaterThanOrEqual(MIN_LOT_PX);
    }
  });

  it('picks the widest view that clears the bar, not simply the closest', () => {
    // Zooming further than necessary trades away the thing the board is for,
    // which is seeing the town at once.
    const stops = Object.keys(ZOOM) as (keyof typeof ZOOM)[];
    for (const w of [PHONE, TABLET, DESKTOP]) {
      const chosen = fitZoom(w, EXTENT);
      const i = stops.indexOf(chosen);
      if (i === 0) continue;
      const looser = stops[i - 1];
      const lotPx = LOT_UNITS * pxPerUnit(w, EXTENT, ZOOM[looser]);
      expect(lotPx, `${w}px could have used ${looser}`).toBeLessThan(MIN_LOT_PX);
    }
  });

  it('keeps Scout visible as the board shrinks, without letting him take over', () => {
    const widthOf = (frame: number, zoom: number) => {
      // Inverse of spriteUnit: the board units the sprite comes out at.
      const unit = spriteUnit(frame, EXTENT, zoom);
      return (51 * 40) / unit;
    };

    for (const w of [PHONE, TABLET, DESKTOP]) {
      const z = ZOOM[fitZoom(w, EXTENT)];
      const units = widthOf(w, z);
      const px = units * pxPerUnit(w, EXTENT, z);
      expect(px, `${w}px frame: Scout is ${px.toFixed(1)}px`).toBeGreaterThanOrEqual(
        MIN_SPRITE_PX - 0.01,
      );
      // And never wider than a lot, or the dog is the landmark.
      expect(units, `${w}px frame`).toBeLessThanOrEqual(LOT_UNITS);
    }
  });

  it('grows Scout only when it has to', () => {
    // On a comfortable board he is a third of a lot and no more; the floor is
    // a rescue, not a policy.
    const unit = spriteUnit(DESKTOP, EXTENT, ZOOM.town);
    const units = (51 * 40) / unit;
    expect(units / LOT_UNITS).toBeCloseTo(0.34, 2);

    // Squeeze the board and he gets relatively larger, not smaller.
    const tight = (51 * 40) / spriteUnit(240, EXTENT, ZOOM.town);
    expect(tight).toBeGreaterThan(units);
  });

  it('holds the ink at a hairline until a hairline would vanish', () => {
    const base = 0.55;

    /*
     * The delivered weight is 0.55 board units and the board renders at about
     * one CSS pixel per unit on a desktop, so the line is half a CSS pixel:
     * solid on the 2x display it was tuned on, gone on a 1x one. Which is why
     * the floor is in device pixels rather than CSS ones.
     */
    expect(inkWeight(base, DESKTOP, EXTENT, ZOOM.town, 2)).toBe(base);
    expect(inkWeight(base, DESKTOP, EXTENT, ZOOM.town, 1)).toBeGreaterThan(base);

    // Cramped: widened by exactly enough to survive being rasterised.
    const tight = inkWeight(base, PHONE, EXTENT, ZOOM.town, 3);
    expect(tight).toBeGreaterThan(base);
    expect(tight * pxPerUnit(PHONE, EXTENT, ZOOM.town) * 3).toBeCloseTo(0.75, 5);
  });

  it('survives being asked before anything has been measured', () => {
    // The first render has no frame width, and a zero must not become a NaN
    // transform on every house.
    expect(pxPerUnit(0, EXTENT)).toBe(0);
    expect(Number.isFinite(spriteUnit(0, EXTENT))).toBe(true);
    expect(spriteUnit(0, EXTENT)).toBeGreaterThan(0);
    expect(Number.isFinite(inkWeight(0.55, 0, EXTENT))).toBe(true);
    expect(inkWeight(0.55, DESKTOP, EXTENT, 1, 0)).toBeGreaterThan(0);
    expect(fitZoom(0, EXTENT)).toBeTruthy();
  });
});
