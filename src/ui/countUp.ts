/**
 * Numbers that move to their new value instead of cutting to it.
 *
 * The stylesheet had four `transition` declarations and no keyframes in two
 * thousand lines, and that -- not the palette -- is why the game read as a
 * spreadsheet. Nothing on screen ever moved. Cash, net worth and the day
 * counter change after almost every action, so making those three travel
 * changes the feel of the whole game for very little code.
 *
 * The arithmetic lives here, apart from React, because it is the part worth
 * testing: a tween that overshoots or that never arrives is a number lying
 * about the state of the simulation, and this game's entire claim is that its
 * numbers are honest.
 */

/** How long a change takes. Long enough to read as motion, short enough that a
 *  player pressing `N` repeatedly is never waiting for the display. */
export const COUNT_MS = 420;

/**
 * Ease-out cubic: fast away from the old value, settling into the new one.
 *
 * Ease-*out* rather than in-out because the interesting end is the arrival.
 * The player already knows what the number was.
 */
export function ease(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) ** 3;
}

function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 1;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * The value to show `elapsed` ms into a change from `from` to `to`.
 *
 * Exact at both ends by construction rather than by easing arithmetic that
 * happens to land there: `elapsed >= duration` returns `to` itself, so the
 * final frame is the true value and not a float a fraction away from it.
 */
export function sample(from: number, to: number, elapsed: number, duration = COUNT_MS): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return to;
  if (duration <= 0 || elapsed >= duration) return to;
  if (elapsed <= 0) return from;
  return from + (to - from) * ease(elapsed / duration);
}

/**
 * Which way a change went, for the tint.
 *
 * Zero for no change, so a re-render that does not move the number does not
 * flash it. Callers treat 0 as "say nothing".
 */
export function direction(from: number, to: number): -1 | 0 | 1 {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return 0;
  return to > from ? 1 : -1;
}
