import { projectDeal, type AnalyzerInputs } from './analyzer';
import { annualisedRoi } from './returns';
import type { Money } from './types';

/**
 * What happens to this deal when you are wrong.
 *
 * The analyzer answers "what is this worth if my estimates are right", which
 * is the easier half of underwriting and the half beginners already do. The
 * harder half is knowing which estimate you cannot afford to be wrong about,
 * and it has had no representation in this game at all.
 *
 * Two variables, because that is what actually kills flips and because the
 * two-variable data table is the exact instrument professional modelling
 * courses spend their time on:
 *
 *   ARV was optimistic     the comps flattered you, or the market moved
 *   the work ran over      hidden defects, change orders, a slower schedule
 *
 * The grid is computed by calling projectDeal, the same function the engine
 * prices a real offer with. Reimplementing the arithmetic here would let the
 * stress test drift away from the thing it is stress-testing, which is the one
 * way a tool like this can be actively harmful.
 */

/** How wrong the ARV estimate might be, as a fraction. */
export const ARV_DELTAS = [-0.12, -0.08, -0.04, 0, 0.04] as const;

/** How far over the repair budget might run, as a fraction. */
export const COST_DELTAS = [0, 0.1, 0.25, 0.5] as const;

export interface StressCell {
  arvDelta: number;
  costDelta: number;
  profit: Money;
  /** Annualised return on the cash tied up, so cells are comparable. */
  annualised: number;
}

export interface StressTest {
  /** Rows are cost overruns, columns are ARV deltas. */
  rows: StressCell[][];
  arvDeltas: readonly number[];
  costDeltas: readonly number[];
  /** The deal as underwritten, for reference. */
  base: StressCell;
  /**
   * How far ARV can fall before this deal breaks even, holding costs at plan.
   * Null when it does not break even even at the base estimate.
   */
  breakEvenArvDelta: number | null;
  /** How far the budget can overrun before break-even, holding ARV at plan. */
  breakEvenCostDelta: number | null;
  /** Share of the grid that still makes money. */
  survivalRate: number;
}

function cellFor(
  inputs: AnalyzerInputs,
  dailyCarry: Money,
  rate: number,
  offer: Money,
  arvDelta: number,
  costDelta: number,
): StressCell {
  const shocked: AnalyzerInputs = {
    ...inputs,
    arv: Math.round(inputs.arv * (1 + arvDelta)),
    repairEstimate: Math.round(inputs.repairEstimate * (1 + costDelta)),
  };
  const b = projectDeal(offer, shocked, dailyCarry, rate);
  const cashIn = Math.max(1, b.purchase + b.buyClosing + b.repairs - b.loan);
  const days = Math.max(1, shocked.renovationDays + shocked.marketingDays);
  return {
    arvDelta,
    costDelta,
    profit: b.profit,
    annualised: annualisedRoi(b.profit, cashIn, days),
  };
}

/** Bisect for the delta at which profit crosses zero. */
function breakEven(
  probe: (delta: number) => Money,
  lo: number,
  hi: number,
): number | null {
  if (probe(lo) > 0) return null; // still profitable at the far end
  if (probe(hi) < 0) return null; // already losing at the near end
  let a = lo;
  let b = hi;
  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2;
    if (probe(mid) >= 0) b = mid;
    else a = mid;
  }
  return (a + b) / 2;
}

export function stressTest(
  offer: Money,
  inputs: AnalyzerInputs,
  dailyCarry: Money,
  rate: number,
): StressTest {
  const rows = COST_DELTAS.map((costDelta) =>
    ARV_DELTAS.map((arvDelta) => cellFor(inputs, dailyCarry, rate, offer, arvDelta, costDelta)),
  );

  const base = cellFor(inputs, dailyCarry, rate, offer, 0, 0);

  // How far ARV can fall, at plan cost. Searching downward from zero.
  const breakEvenArvDelta = breakEven(
    (d) => cellFor(inputs, dailyCarry, rate, offer, d, 0).profit,
    -0.6,
    0,
  );

  // How far the budget can run over, at plan ARV. Searching upward from zero.
  const breakEvenCostDelta = breakEven(
    (d) => cellFor(inputs, dailyCarry, rate, offer, 0, -d).profit,
    -3,
    0,
  );

  const all = rows.flat();
  const survivalRate = all.filter((c) => c.profit > 0).length / all.length;

  return {
    rows,
    arvDeltas: ARV_DELTAS,
    costDeltas: COST_DELTAS,
    base,
    breakEvenArvDelta,
    // Negated back: the bisection searched a mirrored axis so both solves run
    // in the same increasing direction.
    breakEvenCostDelta: breakEvenCostDelta === null ? null : -breakEvenCostDelta,
    survivalRate,
  };
}

/**
 * The same question sampled finely enough to draw.
 *
 * The table answers "what happens at these five points". A field answers
 * "where does this deal die", which is a shape rather than a set of numbers,
 * and it is the thing a player should be able to see without reading anything.
 */
export interface StressField {
  /** Profit at [row][col], rows are cost overruns, cols are ARV deltas. */
  grid: Money[][];
  arvAt: number[];
  costAt: number[];
  /**
   * The profit = 0 contour, as one point per column in grid space
   * (col index, fractional row index). Null where the column never crosses.
   *
   * Computed by interpolating within each column rather than by marching
   * squares, which is exact here: profit falls monotonically as ARV drops and
   * as costs rise, so the zero set is a single curve with at most one crossing
   * per column.
   */
  breakEven: ({ col: number; row: number } | null)[];
  min: Money;
  max: Money;
}

export function stressField(
  offer: Money,
  inputs: AnalyzerInputs,
  dailyCarry: Money,
  rate: number,
  cols = 41,
  rows = 25,
  arvRange: [number, number] = [-0.2, 0.08],
  costRange: [number, number] = [0, 0.7],
): StressField {
  const arvAt = Array.from(
    { length: cols },
    (_, i) => arvRange[0] + ((arvRange[1] - arvRange[0]) * i) / (cols - 1),
  );
  const costAt = Array.from(
    { length: rows },
    (_, j) => costRange[0] + ((costRange[1] - costRange[0]) * j) / (rows - 1),
  );

  const grid: Money[][] = costAt.map((cost) =>
    arvAt.map((arv) => cellFor(inputs, dailyCarry, rate, offer, arv, cost).profit),
  );

  let min = Infinity;
  let max = -Infinity;
  for (const row of grid) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const breakEven = arvAt.map((_, col) => {
    for (let r = 0; r < rows - 1; r++) {
      const a = grid[r][col];
      const b = grid[r + 1][col];
      if (a >= 0 && b < 0) {
        // Linear interpolation to the crossing.
        const t = a / (a - b);
        return { col, row: r + t };
      }
    }
    return null;
  });

  return { grid, arvAt, costAt, breakEven, min, max };
}

/**
 * One sentence on how much room the deal has.
 *
 * Deliberately about margin for error rather than about profit. Two deals with
 * identical projected profit can be completely different propositions, and the
 * difference does not show up anywhere on a single point estimate -- which is
 * the entire reason this table exists.
 */
export function describeResilience(t: StressTest): string {
  if (t.base.profit <= 0) {
    return 'This does not work even if every estimate is right. There is nothing to stress-test.';
  }
  const arv = t.breakEvenArvDelta;
  const cost = t.breakEvenCostDelta;

  // Stated as two separate thresholds, because that is what they are: each is
  // solved with the other assumption held at plan. Joining them with "and"
  // would claim the deal survives both at once, which is a much stronger and
  // completely unearned claim -- the grid shows what happens when they arrive
  // together, and it is worse than either alone.
  const arvText =
    arv === null
      ? 'It survives any plausible miss on value'
      : `On its own, a ${Math.abs(arv * 100).toFixed(0)}% miss on ARV breaks it`;
  const costText =
    cost === null
      ? ', as it does any plausible overrun on the work'
      : `; on its own, the work running ${(cost * 100).toFixed(0)}% over does`;

  const verdict =
    arv !== null && Math.abs(arv) < 0.05
      ? ' That is thin — a single bad comp puts this underwater, and the grid below shows what happens when both go wrong together.'
      : arv !== null && Math.abs(arv) < 0.1
        ? ' That is ordinary room. The grid below shows what happens when both go wrong together, which is the case worth looking at.'
        : ' That is real room to be wrong.';

  return `${arvText}${costText}.${verdict}`;
}
