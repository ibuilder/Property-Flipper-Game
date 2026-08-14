import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  createGame,
  describePermit,
  drawPermitQueue,
  jobProgress,
  makeOffer,
  newPermit,
  permitDaysLeft,
  permitIssued,
  permitReasons,
  startRenovation,
  type GameState,
} from '../src/engine';
import { Rng } from '../src/engine/rng';

/** Buy the first listing outright, paying over the odds so setup never fails. */
function bought(seed = 909): { state: GameState; id: string } {
  const state = createGame('the_grind', seed);
  const target = state.market.find((p) => p.listing)!;
  const res = makeOffer(state, target.id, Math.round(target.listing!.askPrice * 1.15), true);
  expect(res.ok, res.message).toBe(true);
  return { state, id: target.id };
}

const COSMETIC = ['paint_interior', 'flooring_lvp'];
const STRUCTURAL = ['roof_replace', 'electrical_rewire'];

describe('when a permit is needed', () => {
  it('is not needed for paint and flooring', () => {
    // The scope decision is the point: a cosmetic refresh starts on Monday.
    expect(permitReasons(COSMETIC.map((id) => ({ itemId: id }) as never))).toEqual([]);
  });

  it('is needed the moment you touch the systems', () => {
    const reasons = permitReasons(STRUCTURAL.map((id) => ({ itemId: id }) as never));
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('names the trades that caused it, because the scope chose this', () => {
    const state = createGame('sandbox', 1);
    const permit = newPermit(
      STRUCTURAL.map((id) => ({ itemId: id }) as never),
      state.world,
      Rng.fromState(5),
    );
    expect(permit.required).toBe(true);
    expect(describePermit(permit)).toMatch(/Roof|Electrical/);
    expect(describePermit(permit)).toMatch(/carry runs/);
  });

  it('says nothing at all when none is required', () => {
    const state = createGame('sandbox', 1);
    const permit = newPermit(
      COSMETIC.map((id) => ({ itemId: id }) as never),
      state.world,
      Rng.fromState(5),
    );
    expect(permit.required).toBe(false);
    expect(describePermit(permit)).toBeNull();
    // An absent permit must never block work.
    expect(permitIssued(permit)).toBe(true);
    expect(permitIssued(null)).toBe(true);
  });

  it('draws the queue once, so it can be told to the player up front', () => {
    // A queue you only discover by waiting is weather, not a decision.
    const state = createGame('sandbox', 1);
    for (let i = 0; i < 20; i++) {
      const days = drawPermitQueue(state.world, Rng.fromState(i + 1));
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThan(40);
    }
  });
});

describe('waiting in the queue', () => {
  it('stops work without stopping the clock', () => {
    // The whole cost of a permit is that carry runs while nothing happens.
    // Softening either half would remove the point.
    const { state, id } = bought();
    startRenovation(state, id, STRUCTURAL, 0.1);
    const job = state.portfolio.find((p) => p.id === id)!.ownership!.renovation!;
    expect(job.permit?.required).toBe(true);

    const cashBefore = state.cash;
    const queue = job.permit!.queueDays;
    for (let i = 0; i < queue; i++) advanceDay(state);

    // Days passed and money left, but no work was done.
    expect(state.day).toBeGreaterThan(1);
    expect(state.cash).toBeLessThan(cashBefore);
    expect(job.daysElapsed).toBe(0);
    expect(jobProgress(job)).toBe(0);
  });

  it('starts work the day the permit lands', () => {
    const { state, id } = bought(606);
    startRenovation(state, id, STRUCTURAL, 0.1);
    const job = state.portfolio.find((p) => p.id === id)!.ownership!.renovation!;
    const queue = job.permit!.queueDays;

    for (let i = 0; i < queue + 2; i++) advanceDay(state);
    expect(permitIssued(job.permit)).toBe(true);
    expect(job.daysElapsed).toBeGreaterThan(0);
  });

  it('counts down honestly', () => {
    const { state, id } = bought(1234);
    startRenovation(state, id, STRUCTURAL, 0.1);
    const job = state.portfolio.find((p) => p.id === id)!.ownership!.renovation!;
    const before = permitDaysLeft(job.permit);
    advanceDay(state);
    expect(permitDaysLeft(job.permit)).toBe(before - 1);
  });

  it('never delays a cosmetic job', () => {
    const { state, id } = bought(5678);
    startRenovation(state, id, COSMETIC, 0.1);
    const job = state.portfolio.find((p) => p.id === id)!.ownership!.renovation!;
    expect(job.permit).toBeNull();
    advanceDay(state);
    expect(job.daysElapsed).toBe(1);
  });

  it('is deterministic for a seed, like everything else', () => {
    const a = bought(4321);
    startRenovation(a.state, a.id, STRUCTURAL, 0.1);
    const b = bought(4321);
    startRenovation(b.state, b.id, STRUCTURAL, 0.1);
    const qa = a.state.portfolio[0].ownership!.renovation!.permit!.queueDays;
    const qb = b.state.portfolio[0].ownership!.renovation!.permit!.queueDays;
    expect(qa).toBe(qb);
  });
});
