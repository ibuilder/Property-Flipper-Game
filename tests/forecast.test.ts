import { describe, expect, it } from 'vitest';
import {
  FORECAST_CONFIDENCE,
  MIN_FOR_VERDICT,
  acceptOffer,
  advanceDay,
  calibration,
  calibrationVerdict,
  commitForecast,
  createGame,
  describeCalibration,
  listForSale,
  makeForecast,
  makeOffer,
  resolvedForecasts,
  scoreForecast,
  type ClosedDeal,
  type GameState,
  type ScoredForecast,
} from '../src/engine';
import { deserialize, serialize } from '../src/engine/save';

/**
 * Buy something, paying over the odds so setup never loses to a rival.
 *
 * Financed, because the opening balance does not cover the first listing
 * outright and a setup that fails on cash tests nothing about forecasts.
 */
function bought(seed = 909): { state: GameState; id: string } {
  const state = createGame('the_grind', seed);
  const target = state.market.find((p) => p.listing)!;
  const res = makeOffer(state, target.id, Math.round(target.listing!.askPrice * 1.15), true);
  expect(res.ok, `setup purchase failed: ${res.message}`).toBe(true);
  return { state, id: target.id };
}

/** A scored forecast with a chosen outcome, for testing the maths directly. */
function score(low: number, high: number, actual: number): ScoredForecast {
  return scoreForecast(makeForecast('p', 1, low, high), actual);
}

describe('committing a forecast', () => {
  it('records the range and locks it', () => {
    const { state, id } = bought();
    expect(commitForecast(state, id, 10_000, 30_000).ok).toBe(true);
    const f = state.portfolio.find((p) => p.id === id)!.ownership!.forecast!;
    expect(f.low).toBe(10_000);
    expect(f.high).toBe(30_000);
    expect(f.confidence).toBe(FORECAST_CONFIDENCE);

    const again = commitForecast(state, id, 0, 999_999);
    expect(again.ok).toBe(false);
    expect(again.message).toMatch(/already committed/i);
    expect(state.portfolio.find((p) => p.id === id)!.ownership!.forecast!.high).toBe(30_000);
  });

  it('accepts a range given the wrong way round', () => {
    const { state, id } = bought();
    expect(commitForecast(state, id, 30_000, 10_000).ok).toBe(true);
    const f = state.portfolio.find((p) => p.id === id)!.ownership!.forecast!;
    expect(f.low).toBe(10_000);
    expect(f.high).toBe(30_000);
  });

  it('refuses once the house is listed', () => {
    // A forecast made with offers coming in is not a forecast.
    const { state, id } = bought();
    const prop = state.portfolio.find((p) => p.id === id)!;
    listForSale(state, id, prop.appraisal.point);
    const res = commitForecast(state, id, 10_000, 30_000);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/listed/i);
  });

  it('refuses on a property you do not own', () => {
    const state = createGame('the_grind', 909);
    const listed = state.market.find((p) => p.listing)!;
    expect(commitForecast(state, listed.id, 1, 2).ok).toBe(false);
    expect(commitForecast(state, 'nonsense', 1, 2).ok).toBe(false);
  });

  it('survives a save and reload', () => {
    const { state, id } = bought();
    commitForecast(state, id, 12_000, 28_000);
    // Round-tripped through JSON, because that is what a real save does and it
    // is where an undefined field would quietly vanish.
    const back = deserialize(JSON.parse(JSON.stringify(serialize(state))));
    expect(back.portfolio.find((p) => p.id === id)!.ownership!.forecast!.low).toBe(12_000);
  });

  it('migrates an older save without inventing forecasts', () => {
    // Back-filling a forecast after the outcome is known would corrupt the one
    // measurement this feature exists to make.
    const { state, id } = bought();
    commitForecast(state, id, 1_000, 2_000);
    const file = JSON.parse(JSON.stringify(serialize(state)));
    file.version = 13;
    delete file.state.portfolio.find((p: { id: string }) => p.id === id).ownership.forecast;
    for (const d of file.state.closedDeals) delete d.forecast;

    const back = deserialize(file);
    expect(back.portfolio.find((p) => p.id === id)!.ownership!.forecast).toBeNull();
    for (const d of back.closedDeals) expect(d.forecast).toBeNull();
    expect(resolvedForecasts(back.closedDeals)).toHaveLength(0);
  });

  it('carries onto the closed deal when the house sells', () => {
    const { state, id } = bought();
    commitForecast(state, id, 5_000, 45_000);
    const prop = state.portfolio.find((p) => p.id === id)!;
    listForSale(state, id, Math.round(prop.appraisal.point * 0.8));
    // Offers have to be taken; they do not close themselves.
    for (let d = 0; d < 400 && state.closedDeals.length === 0; d++) {
      for (const o of prop.ownership?.saleListing?.offers ?? []) acceptOffer(state, id, o.id);
      advanceDay(state);
    }

    expect(state.closedDeals.length, 'the house never sold').toBeGreaterThan(0);
    const deal = state.closedDeals[0];
    expect(deal.forecast).not.toBeNull();
    expect(deal.forecast!.low).toBe(5_000);

    // And it scores against the profit the player was asked to predict.
    const [s] = resolvedForecasts(state.closedDeals);
    expect(s.actual).toBe(deal.netProfit);
  });
});

describe('scoring one forecast', () => {
  it('places the outcome on the range', () => {
    expect(score(0, 100, 50).position).toBeCloseTo(0.5);
    expect(score(0, 100, 0).position).toBeCloseTo(0);
    expect(score(0, 100, 100).position).toBeCloseTo(1);
    expect(score(0, 100, 150).position).toBeCloseTo(1.5);
    expect(score(0, 100, -50).position).toBeCloseTo(-0.5);
  });

  it('counts the edges as inside', () => {
    expect(score(10, 20, 10).hit).toBe(true);
    expect(score(10, 20, 20).hit).toBe(true);
    expect(score(10, 20, 9).hit).toBe(false);
    expect(score(10, 20, 21).hit).toBe(false);
  });

  it('measures width against the midpoint, so ranges are comparable', () => {
    // A $40k range on a big deal and a $6k one on a small deal can be the same
    // claim. Raw dollars would say otherwise.
    expect(score(80_000, 120_000, 100_000).relativeWidth).toBeCloseTo(0.2);
    expect(score(27_000, 33_000, 30_000).relativeWidth).toBeCloseTo(0.1);
  });

  it('signs the error so a direction is visible', () => {
    expect(score(0, 100, 75).error).toBeCloseTo(0.5);
    expect(score(0, 100, 25).error).toBeCloseTo(-0.5);
  });

  it('does not divide by zero on a range straddling break-even', () => {
    const s = score(-10_000, 10_000, 4_000);
    expect(Number.isFinite(s.relativeWidth)).toBe(true);
    expect(Number.isFinite(s.error)).toBe(true);
    expect(s.hit).toBe(true);
  });
});

describe('calibration across deals', () => {
  /**
   * n forecasts of a given width, with the misses split evenly above and below.
   *
   * The split matters: a fixture whose misses all land on one side is testing
   * the bias diagnosis, not the width one, and the code correctly reports bias
   * first. Alternating keeps highShare near 0.5 so width is what is measured.
   */
  const many = (n: number, hit: (i: number) => boolean, width = 0.2): ScoredForecast[] => {
    let misses = 0;
    return Array.from({ length: n }, (_, i) => {
      const lo = 100 - width * 100;
      const hi = 100 + width * 100;
      if (hit(i)) return score(lo, hi, 100);
      const above = misses++ % 2 === 0;
      return score(lo, hi, above ? hi + width * 100 : lo - width * 100);
    });
  };

  it('is empty and honest with nothing to score', () => {
    const c = calibration([]);
    expect(c.count).toBe(0);
    expect(calibrationVerdict(c)).toBe('too-few');
    expect(describeCalibration(c)).toMatch(/noise/i);
  });

  it('refuses a verdict below five forecasts', () => {
    const c = calibration(many(4, () => false));
    expect(calibrationVerdict(c)).toBe('too-few');
    expect(describeCalibration(c)).toContain(String(MIN_FOR_VERDICT));
  });

  it('calls narrow-and-missing overconfident', () => {
    // Half inside against a claimed 80%, with tight ranges.
    const c = calibration(many(10, (i) => i % 2 === 0, 0.05));
    expect(c.hitRate).toBeCloseTo(0.5);
    expect(calibrationVerdict(c)).toBe('overconfident');
    expect(describeCalibration(c)).toMatch(/widen/i);
  });

  it('calls never-wrong-but-useless underconfident', () => {
    const c = calibration(many(10, () => true, 0.5));
    expect(c.hitRate).toBe(1);
    expect(calibrationVerdict(c)).toBe('underconfident');
    expect(describeCalibration(c)).toMatch(/cannot be wrong|halving/i);
  });

  it('does not punish hitting every one with tight ranges', () => {
    // Perfect hit rate is only 'too wide' when the ranges are also loose.
    const c = calibration(many(8, () => true, 0.06));
    expect(c.hitRate).toBe(1);
    expect(calibrationVerdict(c)).toBe('well-calibrated');
  });

  it('names a one-sided bias rather than a width problem', () => {
    // Every miss came in below the range: the ranges are in the wrong place.
    const scored = [
      score(80, 120, 100),
      score(80, 120, 100),
      score(80, 120, 40),
      score(80, 120, 30),
      score(80, 120, 20),
      score(80, 120, 10),
    ];
    const c = calibration(scored);
    expect(c.tooHighShare).toBe(1);
    expect(calibrationVerdict(c)).toBe('optimistic');
    expect(describeCalibration(c)).toMatch(/move them down|bias/i);
  });

  it('names the opposite bias too', () => {
    const scored = [
      score(80, 120, 100),
      score(80, 120, 100),
      score(80, 120, 200),
      score(80, 120, 210),
      score(80, 120, 220),
      score(80, 120, 230),
    ];
    const c = calibration(scored);
    expect(c.tooHighShare).toBe(0);
    expect(calibrationVerdict(c)).toBe('pessimistic');
    expect(describeCalibration(c)).toMatch(/underestimating/i);
  });

  it('accepts a genuinely calibrated forecaster', () => {
    // Eight of ten inside, at a claimed 80%, with usable widths.
    const c = calibration(many(10, (i) => i > 1, 0.15));
    expect(c.hitRate).toBeCloseTo(0.8);
    expect(calibrationVerdict(c)).toBe('well-calibrated');
    expect(describeCalibration(c)).toMatch(/calibrated/i);
  });

  it('always reports width alongside hit rate, so neither can be gamed alone', () => {
    // The wide-range cheat and the point-estimate trap must read differently
    // even though a hit rate alone cannot distinguish them from skill.
    const cheat = calibration(many(10, () => true, 0.9));
    const skill = calibration(many(10, (i) => i > 1, 0.1));
    expect(cheat.hitRate).toBeGreaterThan(skill.hitRate);
    expect(cheat.sharpness).toBeGreaterThan(skill.sharpness * 3);
    expect(calibrationVerdict(cheat)).toBe('underconfident');
    expect(calibrationVerdict(skill)).toBe('well-calibrated');
  });

  it('calls a large median error bias, even when the misses are not one-sided enough', () => {
    // The case that caught a real mis-diagnosis. Anchoring on the engine's own
    // projection produces a median error near -50% with only about three
    // quarters of misses on one side. A share-of-misses test set at 80% calls
    // that "overconfident" and advises widening the ranges, which is precisely
    // backwards: they are in the wrong place, not the wrong size.
    const scored = [
      score(80, 120, 50),
      score(80, 120, 45),
      score(80, 120, 40),
      score(80, 120, 55),
      score(80, 120, 48),
      score(80, 120, 140),
      score(80, 120, 150),
      score(80, 120, 95),
      score(80, 120, 100),
    ];
    const c = calibration(scored);
    expect(c.tooHighShare).toBeGreaterThan(0.6);
    expect(c.tooHighShare).toBeLessThan(0.8);
    expect(c.medianError).toBeLessThan(-0.25);
    expect(calibrationVerdict(c)).toBe('optimistic');
    expect(describeCalibration(c)).toMatch(/predict less|wrong place/i);
    // It may mention widening in order to rule it out; what it must never do
    // is recommend it, which is the overconfident message's advice.
    expect(describeCalibration(c)).not.toMatch(/widening them is not defeat/i);
  });

  it('does not call ordinary scatter a bias', () => {
    // Misses on both sides and a median near the middle is a width problem,
    // and must not be reported as one-sided.
    const c = calibration([
      score(80, 120, 100),
      score(80, 120, 60),
      score(80, 120, 145),
      score(80, 120, 102),
      score(80, 120, 55),
      score(80, 120, 150),
    ]);
    expect(Math.abs(c.medianError)).toBeLessThan(0.25);
    expect(calibrationVerdict(c)).toBe('overconfident');
  });

  it('reads forecasts only off the deals that carry one', () => {
    const deals = [
      { propertyId: 'a', netProfit: 100, forecast: makeForecast('a', 1, 80, 120) },
      { propertyId: 'b', netProfit: 50, forecast: null },
      { propertyId: 'c', netProfit: 10 },
    ] as unknown as ClosedDeal[];
    const scored = resolvedForecasts(deals);
    expect(scored).toHaveLength(1);
    expect(scored[0].propertyId).toBe('a');
    expect(scored[0].actual).toBe(100);
  });
});
