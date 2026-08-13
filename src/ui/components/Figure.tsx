import type { ReactNode } from 'react';

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
  formula,
  note,
  size = 'stat',
  tone,
  title,
}: {
  label: ReactNode;
  value: ReactNode;
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
  const cls = `figure figure-${size}${tone ? ` figure-${tone}` : ''}`;

  if (size === 'row') {
    return (
      <div className={cls} title={title}>
        <div className="figure-lead">
          <span className="figure-label">{label}</span>
          {formula && <span className="figure-formula">{formula}</span>}
        </div>
        <span className="figure-value">{value}</span>
      </div>
    );
  }

  return (
    <div className={cls} title={title}>
      <span className="figure-label">{label}</span>
      <span className="figure-value">{value}</span>
      {formula && <span className="figure-formula">{formula}</span>}
      {note && <span className="figure-note">{note}</span>}
    </div>
  );
}
