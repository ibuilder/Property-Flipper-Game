import { useEffect, useRef, useState } from 'react';

/**
 * Roll a figure to its new value instead of snapping to it.
 *
 * The analyser recomputes on every keystroke and every toggled comp, and it
 * did so instantaneously -- which reads as a form redrawing rather than as an
 * instrument responding. A short roll is what makes the connection between the
 * thing you changed and the number that moved legible: the eye follows motion,
 * and there is no motion to follow in a value that simply becomes another
 * value.
 *
 * 120ms and linear, per the handoff: no easing bounce. An eased count-up draws
 * attention to the animation; a linear one draws attention to the change.
 *
 * Three things this deliberately does not do:
 *
 *   - It never animates the *first* value. Rolling every figure up from zero
 *     on mount is a splash screen, not information.
 *   - It gives up and snaps on a change large enough that the intermediate
 *     frames would be nonsense -- switching property, not nudging an offer.
 *   - It respects prefers-reduced-motion, where it snaps always. This is
 *     decoration on top of a number that is already correct, which is exactly
 *     the kind of motion that setting exists to remove.
 */
export function useCountUp(value: number, duration = 120): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // A jump this big is a different subject, not a changed figure. Rolling
    // through the gap would render a second of meaningless numbers.
    const far = Math.abs(value - from.current) > Math.max(1_000_000, Math.abs(value) * 4);

    if (reduced || far || !Number.isFinite(value) || !Number.isFinite(from.current)) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = a + (b - a) * t;
      setShown(t === 1 ? b : next);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = b;
    };

    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return shown;
}
