import type { ReactNode } from 'react';
import { useCountUp } from '../useCountUp';

/**
 * A number that shows its work.
 *
 * The handoff's rule is that every figure on screen goes through this, and the
 * reason is narrower than "transparency": a player who cannot see where a
 * number came from cannot tell a number they should argue with from one they
 * should accept. The game already computed every formula -- `explain.ts` has
 * carried label, formula, plugged and result for a long time -- but it was
 * folded behind a disclosure, which means it was available to people who
 * already suspected something was wrong. The formula belongs next to the
 * figure, before the suspicion.
 *
 * The mono/proportional split is load-bearing rather than decorative: every
 * figure and every formula is mono, everything else is not, so the eye learns
 * where the numbers are without being told.
 *
 * Three shapes, because a figure does three jobs:
 *
 *   stat   a labelled quantity in a column -- micro label, figure, formula
 *   row    label on the left, figure on the right, formula under the label.
 *          The ledger shape.
 *   hero   the one figure a screen exists to produce
 */

export type FigureSize = 'stat' | 'row' | 'hero';

export default function Figure({
  label,
  value,
  amount,
  format,
  formula,
  note,
  size = 'stat',
  tone,
  title,
}: {
  label: ReactNode;
  /** Pre-formatted, for anything that is not a rolling quantity. */
  value?: ReactNode;
  /**
   * The number itself, when it is one. Given this, the figure rolls to its new
   * value rather than snapping, which is what connects the control you moved
   * to the number that moved. `format` turns it back into text every frame.
   */
  amount?: number;
  format?: (n: number) => string;
  /**
   * How the value was arrived at, in the player's own numbers. Shown always,
   * not on demand. Omit only when the figure is its own explanation.
   */
  formula?: ReactNode;
  /** A plain-language read on what the figure means. */
  note?: ReactNode;
  size?: FigureSize;
  /**
   * 'loss' is the one thing in the game allowed to be red, per the handoff --
   * a negative projected profit and nothing else. Its scarcity is what makes
   * it land, so it is deliberately not a general-purpose negative.
   */
  tone?: 'loss' | 'good' | 'muted';
  title?: string;
}) {
  // Unconditional: hooks cannot be called behind an if, and it is a no-op
  // when there is no amount to roll.
  const rolled = useCountUp(amount ?? 0);
  const shown = amount === undefined ? value : (format ?? String)(rolled);

  const cls = `figure figure-${size}${tone ? ` figure-${tone}` : ''}`;

  if (size === 'row') {
    return (
      <div className={cls} title={title}>
        <div className="figure-lead">
          <span className="figure-label">{label}</span>
          {formula && <span className="figure-formula">{formula}</span>}
        </div>
        <span className="figure-value">{shown}</span>
      </div>
    );
  }

  return (
    <div className={cls} title={title}>
      <span className="figure-label">{label}</span>
      <span className="figure-value">{shown}</span>
      {formula && <span className="figure-formula">{formula}</span>}
      {note && <span className="figure-note">{note}</span>}
    </div>
  );
}
