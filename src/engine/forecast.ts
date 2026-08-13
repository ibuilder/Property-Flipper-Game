import type { ClosedDeal, Forecast, Money, ScoredForecast } from './types';

/**
 * Commit to a number before you find out.
 *
 * Every other teaching surface in this game explains something. This one asks
 * the player a question and writes the answer down, which is the only mechanism
 * here that can tell them something about themselves rather than about the
 * model. You cannot discover that you are systematically optimistic by reading
 * a panel; you discover it by making twelve predictions and being shown that
 * nine of them were high.
 *
 * The forecast is a range, not a point, and the width is the player's to
 * choose. That is the entire lesson. A point estimate is never right and
 * teaches nothing; a range from zero to a million is always right and teaches
 * nothing either. Being useful means being narrow, and being narrow means
 * sometimes being wrong, and the skill is knowing how narrow you have earned
 * the right to be.
 *
 * Scoring therefore reports two numbers that must be read together:
 *
 *   calibration   how often the truth landed inside. Stated as an 80% range,
 *                 so roughly four in five should hit. Consistently better than
 *                 that is not excellence, it is ranges too wide to be worth
 *                 stating -- and the panel says so.
 *   sharpness     how wide the ranges were, relative to the value. A player
 *                 who hits 80% with +/-5% ranges knows something. A player who
 *                 hits 80% with +/-60% ranges knows nothing and has simply
 *                 declined to answer.
 *
 * Neither is a score on its own and neither is shown on its own.
 */

/** The confidence a forecast range is declared at. */
export const FORECAST_CONFIDENCE = 0.8;

/** Below this many resolved forecasts, any rate is noise. */
export const MIN_FOR_VERDICT = 5;

export function makeForecast(
  propertyId: string,
  day: number,
  low: Money,
  high: Money,
): Forecast {
  return {
    propertyId,
    day,
    low: Math.min(low, high),
    high: Math.max(low, high),
    confidence: FORECAST_CONFIDENCE,
  };
}

/**
 * Resolve a forecast against what actually happened.
 *
 * `position` places the outcome on the range: 0 at the low end, 1 at the high
 * end, outside [0,1] when missed. Kept rather than a bare hit/miss because the
 * direction of the misses is the finding -- eleven misses that were all high
 * is a different diagnosis from eleven scattered.
 */
export function scoreForecast(f: Forecast, actual: Money): ScoredForecast {
  const span = Math.max(1, f.high - f.low);
  const mid = (f.low + f.high) / 2;
  return {
    ...f,
    actual,
    hit: actual >= f.low && actual <= f.high,
    position: (actual - f.low) / span,
    /** Half-width over the midpoint: how precise the claim was. */
    relativeWidth: mid !== 0 ? span / 2 / Math.abs(mid) : 0,
    error: mid !== 0 ? (actual - mid) / Math.abs(mid) : 0,
  };
}

export interface Calibration {
  count: number;
  /** Share of outcomes that landed inside the stated range. */
  hitRate: number;
  /** The rate that was claimed. */
  target: number;
  /** Mean half-width relative to the midpoint. Lower is a sharper claim. */
  sharpness: number;
  /**
   * Share of misses where the forecast was too *high* -- the outcome landed
   * under the range. Named for what it measures rather than for the sign of
   * `position`, which is the opposite way round and easy to misread.
   */
  tooHighShare: number;
  /**
   * Median signed error against the midpoint, as a fraction. Negative means
   * outcomes came in below what you predicted.
   *
   * The robust one. A share-of-misses figure ignores everything that landed
   * inside the range, so a forecaster who is consistently near the bottom edge
   * of their own ranges looks fine by that measure and is plainly biased by
   * this one.
   */
  medianError: number;
  scored: ScoredForecast[];
}

export function calibration(scored: readonly ScoredForecast[]): Calibration {
  const count = scored.length;
  if (count === 0) {
    return {
      count: 0,
      hitRate: 0,
      target: FORECAST_CONFIDENCE,
      sharpness: 0,
      tooHighShare: 0,
      medianError: 0,
      scored: [],
    };
  }

  const misses = scored.filter((s) => !s.hit);
  const errors = [...scored.map((s) => s.error)].sort((a, b) => a - b);
  const median =
    errors.length % 2 === 1
      ? errors[(errors.length - 1) / 2]
      : (errors[errors.length / 2 - 1] + errors[errors.length / 2]) / 2;

  return {
    count,
    hitRate: scored.filter((s) => s.hit).length / count,
    target: FORECAST_CONFIDENCE,
    sharpness: scored.reduce((s, f) => s + f.relativeWidth, 0) / count,
    // Undefined when nothing was missed; reported as 0 and guarded by the
    // miss-count check in the verdict.
    tooHighShare: misses.length ? misses.filter((m) => m.position < 0).length / misses.length : 0,
    medianError: median,
    scored: [...scored],
  };
}

/** Pull every resolved forecast out of the closed deals that carry one. */
export function resolvedForecasts(deals: readonly ClosedDeal[]): ScoredForecast[] {
  return deals
    .filter((d): d is ClosedDeal & { forecast: Forecast } => d.forecast != null)
    .map((d) => scoreForecast(d.forecast, d.netProfit));
}

export type CalibrationVerdict =
  | 'too-few'
  | 'well-calibrated'
  | 'overconfident'
  | 'underconfident'
  | 'optimistic'
  | 'pessimistic';

/** Beyond this median error, the ranges are in the wrong place, not the wrong size. */
const BIAS_THRESHOLD = 0.25;

/**
 * The finding, in one word.
 *
 * Order matters. A systematic direction is a more useful thing to know about
 * yourself than a width problem: being wrong the same way every time is fixed
 * by moving your estimates, while being wrong in both directions is fixed only
 * by admitting you do not know. So direction is diagnosed first.
 *
 * It is diagnosed on the median error rather than on the share of misses,
 * because the share of misses ignores everything that landed inside the range.
 * Measured against real campaigns, a player anchoring on the engine's own
 * projection comes in with a median error of -78% while only 72% of their
 * misses are one-sided -- a share-based test set at 80% calls that
 * "overconfident" and tells them to widen their ranges, which is exactly the
 * wrong advice. The ranges are not too narrow; they are in the wrong place.
 */
export function calibrationVerdict(c: Calibration): CalibrationVerdict {
  if (c.count < MIN_FOR_VERDICT) return 'too-few';

  const missed = Math.round(c.count * (1 - c.hitRate));
  if (Math.abs(c.medianError) > BIAS_THRESHOLD) {
    return c.medianError < 0 ? 'optimistic' : 'pessimistic';
  }
  // A weaker signal, kept for the case where the median sits inside the range
  // but the misses all run the same way.
  if (missed >= 3) {
    if (c.tooHighShare >= 0.8) return 'optimistic';
    if (c.tooHighShare <= 0.2) return 'pessimistic';
  }

  if (c.hitRate < c.target - 0.2) return 'overconfident';
  // A range wide enough never to be wrong is not a forecast. Only called out
  // when the ranges are also genuinely loose -- hitting every one of six with
  // tight ranges is skill, not evasion.
  if (c.hitRate > 0.95 && c.sharpness > 0.25) return 'underconfident';
  return 'well-calibrated';
}

export function describeCalibration(c: Calibration): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const width = `${pct(c.sharpness)}`;

  switch (calibrationVerdict(c)) {
    case 'too-few':
      return `${c.count} of ${MIN_FOR_VERDICT} forecasts resolved. Below five, a hit rate is noise — the point of this is the pattern across deals, not any one of them.`;
    case 'optimistic':
      return `Your deals come in a median of ${pct(Math.abs(c.medianError))} below the middle of your own range. That is not bad luck across ${c.count} forecasts, it is a bias: the ranges are in the wrong place, not the wrong size, and widening them would only hide it. Predict less and you will be right more.`;
    case 'pessimistic':
      return `Your deals come in a median of ${pct(Math.abs(c.medianError))} above the middle of your own range. You are underestimating your own work, which costs you the deals you talk yourself out of — and those never appear here to correct you.`;
    case 'overconfident':
      return `Your ranges caught ${pct(c.hitRate)} of outcomes, against the ${pct(c.target)} you claimed. They average ±${width}, which is a tighter claim than your results support. Widening them is not defeat; a range you actually believe is worth more than a narrow one you do not.`;
    case 'underconfident':
      return `You have caught ${pct(c.hitRate)} — better than the ${pct(c.target)} claimed, but your ranges average ±${width}, which is wide enough that hitting them costs nothing. A forecast that cannot be wrong is not telling you anything. Try halving the width.`;
    default:
      return `${pct(c.hitRate)} of outcomes landed inside your ranges, against ${pct(c.target)} claimed, at an average width of ±${width}. That is a genuinely calibrated forecast: narrow enough to be useful and honest about what you do not know.`;
  }
}
