import { NEIGHBORHOODS } from './content';
import type { GameState } from './types';

/**
 * How a neighborhood has moved, against the ones around it.
 *
 * The obvious version of this chart is the neighborhood's own index over time,
 * and it is worse than nothing. Measured over three 900-day campaigns, the
 * market-wide drift swamps the arc completely: a declining neighborhood
 * finished up 13.3% while one with no arc at all finished up 49.1%. Drawn
 * absolutely, a neighborhood in decline has a line that climbs, and the player
 * learns the opposite of the truth.
 *
 * What carries the signal is relative performance -- this place against the
 * average of all of them. An arc is a divergence, not a direction.
 *
 * It is deliberately not conclusive. Neighborhoods differ in volatility (the
 * noisiest ran 0.58% per five-day step against 0.20% for the calmest), so one
 * can outrun the pack for a long stretch with nothing behind it. The chart is
 * evidence a player has to weigh, which is the whole intended skill: an arc is
 * legible while it happens, and being early is worth more than being right
 * about any single house. Handing over a verdict would remove the decision.
 */

export interface TrendPoint {
  day: number;
  /** This neighborhood's index, rebased so the first sample is 1. */
  value: number;
  /** The average across all neighborhoods, rebased the same way. */
  market: number;
  /** value / market. Above 1 is outperforming. */
  relative: number;
}

export interface NeighborhoodTrend {
  neighborhoodId: string;
  points: TrendPoint[];
  /** Total change in this neighborhood's own index, as a fraction. */
  netChange: number;
  /** Change relative to the pack. This is the one that means something. */
  relativeChange: number;
  /**
   * Mean absolute five-day step, as a fraction. Some neighborhoods are simply
   * noisier, and a divergence in a noisy one is weaker evidence.
   */
  volatility: number;
  /** Days covered. */
  days: number;
}

/**
 * Build the series from the history the game already records.
 *
 * No new state: history has carried a per-neighborhood index sample every five
 * days since it was written. `window` trims to the most recent stretch, since
 * a divergence that ended two years ago is not a thing to act on.
 */
export function neighborhoodTrend(
  state: GameState,
  neighborhoodId: string,
  window = 240,
): NeighborhoodTrend {
  const ids = NEIGHBORHOODS.map((n) => n.id);
  const samples = state.history.filter(
    (h) => h.neighborhoods?.[neighborhoodId] != null && h.day >= state.day - window,
  );

  if (samples.length < 2) {
    return {
      neighborhoodId,
      points: [],
      netChange: 0,
      relativeChange: 0,
      volatility: 0,
      days: 0,
    };
  }

  const marketAt = (h: (typeof samples)[number]): number => {
    const vals = ids.map((id) => h.neighborhoods[id]).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
  };

  const base = samples[0].neighborhoods[neighborhoodId];
  const marketBase = marketAt(samples[0]);

  const points: TrendPoint[] = samples.map((h) => {
    const value = h.neighborhoods[neighborhoodId] / base;
    const market = marketAt(h) / marketBase;
    return { day: h.day, value, market, relative: market > 0 ? value / market : 1 };
  });

  let jitter = 0;
  for (let i = 1; i < points.length; i++) jitter += Math.abs(points[i].value - points[i - 1].value);
  jitter /= points.length - 1;

  const last = points[points.length - 1];
  return {
    neighborhoodId,
    points,
    netChange: last.value - 1,
    relativeChange: last.relative - 1,
    volatility: jitter,
    days: last.day - points[0].day,
  };
}

/** All of them, strongest divergence first. */
export function allTrends(state: GameState, window = 240): NeighborhoodTrend[] {
  return NEIGHBORHOODS.map((n) => neighborhoodTrend(state, n.id, window)).sort(
    (a, b) => b.relativeChange - a.relativeChange,
  );
}

/**
 * How much to trust a divergence, given how jumpy the neighborhood is.
 *
 * A crude signal-to-noise ratio: the divergence measured against the typical
 * five-day wobble. Deliberately crude, because a precise-looking number here
 * would imply a confidence the model does not support.
 */
export function trendStrength(t: NeighborhoodTrend): 'none' | 'faint' | 'clear' {
  if (t.points.length < 6) return 'none';
  const noise = Math.max(1e-6, t.volatility);
  const ratio = Math.abs(t.relativeChange) / noise;
  if (ratio < 4) return 'none';
  return ratio < 10 ? 'faint' : 'clear';
}

/**
 * One phrase for the map, or null.
 *
 * Never names an arc, and is not an arc detector. Measured over six 900-day
 * campaigns, a neighborhood diverging from the pack had an arc behind it nine
 * times out of twenty-nine; the largest divergence observed, 32% ahead, had no
 * arc at all. That is not a flaw to be tuned out. Prices are what set value
 * whether or not the engine has an arc object behind them, and a player who
 * buys into a neighborhood that has run 32% is right about the money even when
 * there is no story. The announced pill is the separate, reliable signal; this
 * is the evidence you are meant to weigh yourself.
 *
 * Speaks only on a clear and substantial divergence. At the first thresholds I
 * tried it fired on twenty of the twenty-four neighborhoods with nothing going
 * on, mostly to report a 2% drift -- which is how a chart becomes furniture.
 */
export function describeTrend(t: NeighborhoodTrend): string | null {
  if (trendStrength(t) !== 'clear') return null;
  const pct = Math.abs(t.relativeChange * 100);
  if (pct < 4) return null;
  const dir = t.relativeChange > 0 ? 'ahead of' : 'behind';
  return `running ${pct.toFixed(0)}% ${dir} the rest of the city`;
}
