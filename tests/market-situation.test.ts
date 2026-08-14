import { describe, expect, it } from 'vitest';
import { createGame, listingSituation } from '../src/engine';

describe('why a house is for sale', () => {
  it('says nothing about a property that is not listed', () => {
    const state = createGame('sandbox', 909);
    const owned = { ...state.market[0], listing: null };
    expect(listingSituation(owned)).toBeNull();
  });

  it('names the seller on every listing', () => {
    const state = createGame('sandbox', 909);
    for (const p of state.market.filter((x) => x.listing)) {
      const s = listingSituation(p)!;
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.detail.length).toBeGreaterThan(20);
    }
  });

  it('only lights up when there is a reason to move', () => {
    // If every row glowed, none of them would mean anything -- the same
    // argument as reserving red for one use.
    const state = createGame('sandbox', 909);
    const listed = state.market.filter((p) => p.listing);
    const live = listed.filter((p) => listingSituation(p)!.actionable);
    expect(live.length).toBeLessThan(listed.length);
  });

  it('calls a motivated seller actionable', () => {
    const state = createGame('sandbox', 909);
    const p = state.market.find((x) => x.listing)!;
    const keen = { ...p, listing: { ...p.listing!, sellerMotivation: 0.9, daysOnMarket: 3 } };
    expect(listingSituation(keen)!.actionable).toBe(true);

    const fresh = { ...p, listing: { ...p.listing!, sellerMotivation: 0.2, daysOnMarket: 1 } };
    expect(listingSituation(fresh)!.actionable).toBe(false);
  });

  it('counts a long-sitting listing as actionable even from a calm seller', () => {
    // The reserve erodes with time whoever is selling, so a stale listing is
    // an opportunity regardless of temperament.
    const state = createGame('sandbox', 909);
    const p = state.market.find((x) => x.listing)!;
    const stale = { ...p, listing: { ...p.listing!, sellerMotivation: 0.1, daysOnMarket: 70 } };
    const s = listingSituation(stale)!;
    expect(s.actionable).toBe(true);
    expect(s.text).toContain('70 days');
  });

  it('leaves the days off a listing too fresh for it to mean anything', () => {
    const state = createGame('sandbox', 909);
    const p = state.market.find((x) => x.listing)!;
    const fresh = { ...p, listing: { ...p.listing!, sellerMotivation: 0.1, daysOnMarket: 4 } };
    expect(listingSituation(fresh)!.text).not.toContain('days');
  });
});
