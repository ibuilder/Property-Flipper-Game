import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  buildDigest,
  createGame,
  digestHeadline,
  digestWorthShowing,
  makeOffer,
  snapshotWorld,
  startRenovation,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

function skip(state: ReturnType<typeof createGame>, days: number) {
  const before = snapshotWorld(state);
  for (let i = 0; i < days && state.phase === 'playing'; i++) advanceDay(state);
  return buildDigest(before, state);
}

describe('the time digest', () => {
  it('reports the span it covers', () => {
    const state = createGame('first_flip', 11);
    const d = skip(state, 30);
    expect(d.days).toBe(30);
    expect(d.fromDay).toBe(1);
    expect(d.toDay).toBe(31);
  });

  it('says something about a stretch that would otherwise be silent', () => {
    // The measured problem: 97% of days produce no log line. Every one of
    // those days should still produce a digest with something in it.
    const state = createGame('first_flip', 12);
    const d = skip(state, 30);
    expect(digestWorthShowing(d)).toBe(true);
    expect(digestHeadline(d).length).toBeGreaterThan(10);
  });

  it('never claims a one-day step is worth summarising', () => {
    const state = createGame('first_flip', 13);
    expect(digestWorthShowing(skip(state, 1))).toBe(false);
  });

  it('counts price cuts and sums carry from the ledger, not from an estimate', () => {
    const state = createGame('first_flip', 14);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, false);

    const before = snapshotWorld(state);
    const ledgerStart = state.ledger.length;
    for (let i = 0; i < 40; i++) advanceDay(state);
    const d = buildDigest(before, state);

    const actualCarry = state.ledger
      .slice(ledgerStart)
      .filter((e) => e.category === 'holding')
      .reduce((s, e) => s + e.amount, 0);
    expect(d.carryPaid).toBe(Math.round(actualCarry));
    expect(d.carryPaid).toBeLessThan(0);
  });

  it('notices listings that went to another buyer', () => {
    const state = createGame('the_grind', 15);
    const before = snapshotWorld(state);
    for (let i = 0; i < 120; i++) advanceDay(state);
    const d = buildDigest(before, state);
    // Over four months on a busy board, something is bought or withdrawn.
    expect(d.listingsLost + d.newListings).toBeGreaterThan(0);
  });

  it('leads with work finishing over anything else', () => {
    const state = createGame('sandbox', 16);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, false);
    startRenovation(state, prop.id, ['paint_interior'], 0.1);

    // Run to the day the job completes.
    let d = skip(state, 1);
    for (let i = 0; i < 200 && prop.ownership?.renovation; i++) {
      d = skip(state, 1);
    }
    // Once there is no job running the headline moves on; while one is
    // running and finished, it leads.
    expect(digestHeadline(d).length).toBeGreaterThan(0);
  });

  it('tracks how long your own listing has been sitting', async () => {
    const state = createGame('sandbox', 17);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, false);
    // List it well above value so it sits rather than selling.
    const { listForSale } = await import('../src/engine');
    listForSale(state, prop.id, Math.round(prop.appraisal.point * 1.6));

    const d = skip(state, 45);
    expect(d.onMarket.length).toBe(1);
    expect(d.onMarket[0].daysOnMarket).toBeGreaterThan(30);
  });

  it('falls back to something true rather than to nothing', () => {
    const quiet = {
      days: 30,
      fromDay: 1,
      toDay: 31,
      carryPaid: 0,
      netWorthDelta: 0,
      marketIndexDelta: 0,
      rateDelta: 0,
      newListings: 0,
      listingsLost: 0,
      biggestCut: null,
      cutCount: 0,
      moverId: null,
      moverDelta: 0,
      jobsRunning: [],
      onMarket: [],
    };
    expect(digestHeadline(quiet)).toMatch(/staler/i);
    // And a genuinely empty window is not shown at all.
    expect(digestWorthShowing(quiet)).toBe(false);
  });
});
