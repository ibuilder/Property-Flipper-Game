import { useEffect, useRef, useState } from 'react';
import { COUNT_MS, direction, sample } from '../countUp';

/**
 * A number that travels to its new value.
 *
 * Used for the handful of figures in the top bar that change after almost
 * every action -- cash, net worth, debt, the day. Everything else on screen
 * is a table the player is reading rather than a gauge they are watching, and
 * animating a table is noise.
 *
 * Three things this has to get right, all of which are failure modes rather
 * than polish:
 *
 * 1. **The first value never counts.** Starting a campaign would otherwise run
 *    $175,000 up from zero, which looks like the game handing you money you
 *    have not been given.
 * 2. **It always arrives.** `requestAnimationFrame` does not fire in a hidden
 *    window, so a tween begun before the player switched tabs would freeze
 *    part-way and leave a wrong number on screen indefinitely. A timer snaps
 *    to the true value whether or not any frame was ever painted.
 * 3. **Reduced motion means no motion.** The setting is honoured by not
 *    starting a tween at all, not by running one quickly.
 */
export default function Ticker({
  value,
  format,
  className = '',
  tint = true,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  /** Brief green/red flash in the direction of travel. */
  tint?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const from = useRef(value);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;

    if (prefersReducedMotion()) {
      setShown(value);
      setDir(0);
      return;
    }

    setDir(direction(start, value));
    const began = now();

    const step = () => {
      const elapsed = now() - began;
      setShown(sample(start, value, elapsed));
      if (elapsed < COUNT_MS) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);

    // The guarantee. Runs whether or not a single frame was painted.
    timer.current = setTimeout(() => {
      setShown(value);
      setDir(0);
    }, COUNT_MS + 60);

    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(timer.current);
    };
  }, [value]);

  const flash = tint && dir !== 0 ? ` tick-${dir > 0 ? 'up' : 'down'}` : '';
  return (
    <span className={`${className}${flash}`.trim()}>
      {format(shown)}
    </span>
  );
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function prefersReducedMotion(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
