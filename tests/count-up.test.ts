import { describe, expect, it } from 'vitest';
import { COUNT_MS, direction, ease, sample } from '../src/ui/countUp';

/**
 * The tween behind the top bar's figures.
 *
 * Tested apart from React because the failure that matters is arithmetic, not
 * rendering: a number that overshoots its target, or that settles a fraction
 * away from it, is the display lying about the simulation. This game's whole
 * claim is that its numbers are honest, so the one that moves has to arrive
 * exactly.
 */
describe('the counting tween', () => {
  it('starts where it started and ends where it ends', () => {
    expect(sample(100, 500, 0)).toBe(100);
    expect(sample(100, 500, COUNT_MS)).toBe(500);
    // Exactly, not nearly. `toBe`, not `toBeCloseTo`: the last frame returns
    // the target itself rather than an eased float that lands near it.
    expect(sample(175_000, 117_073, COUNT_MS)).toBe(117_073);
  });

  it('never overshoots in either direction', () => {
    for (const [from, to] of [
      [0, 1000],
      [1000, 0],
      [-18_400, 42_000],
      [42_000, -18_400],
    ] as const) {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      for (let t = 0; t <= COUNT_MS + 200; t += 7) {
        const v = sample(from, to, t);
        expect(v, `${from}->${to} at ${t}ms`).toBeGreaterThanOrEqual(lo);
        expect(v, `${from}->${to} at ${t}ms`).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('moves monotonically toward the target', () => {
    let last = sample(0, 1000, 0);
    for (let t = 0; t <= COUNT_MS; t += 5) {
      const v = sample(0, 1000, t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('is past halfway before halfway, because it eases out', () => {
    // The interesting end is the arrival; the player already knows what the
    // number was. If this ever inverts, the motion will read as sluggish.
    expect(sample(0, 100, COUNT_MS / 2)).toBeGreaterThan(50);
  });

  it('holds the target once the time is up, however late the frame is', () => {
    // requestAnimationFrame does not fire in a hidden window, so a tween can be
    // resumed long after it should have finished. It must not run backwards or
    // past the end when that happens.
    expect(sample(10, 20, 10_000)).toBe(20);
    expect(sample(10, 20, Number.POSITIVE_INFINITY)).toBe(20);
  });

  it('refuses to animate values that are not numbers', () => {
    expect(sample(Number.NaN, 500, 100)).toBe(500);
    expect(sample(100, Number.NaN, 100)).toBeNaN();
    expect(sample(100, 500, Number.NaN)).toBe(500);
  });

  it('eases between 0 and 1 and is clamped outside it', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-5)).toBe(0);
    expect(ease(5)).toBe(1);
  });

  it('says nothing when a re-render did not move the number', () => {
    // Otherwise every unrelated store tick would flash every figure.
    expect(direction(100, 100)).toBe(0);
    expect(direction(100, 101)).toBe(1);
    expect(direction(101, 100)).toBe(-1);
    expect(direction(Number.NaN, 100)).toBe(0);
  });
});
