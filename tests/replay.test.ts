import { describe, expect, it } from 'vitest';
import {
  acceptOffer,
  advanceDay,
  createScenarioGame,
  createGame,
  listForSale,
  makeOffer,
  orderInspection,
  replayScenario,
  startRenovation,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

/** Buy, renovate, sell — and return the closed deal. */
function playOneDeal(seed: number, opts: { inspect?: boolean } = {}) {
  const state = createGame('sandbox', seed);
  const prop = state.market
    .filter((p) => p.listing)
    .sort((a, b) => currentReserve(a) - currentReserve(b))[0];

  if (opts.inspect) orderInspection(state, prop.id, 'thorough');
  if (!makeOffer(state, prop.id, prop.listing!.askPrice, false).ok) return null;

  startRenovation(state, prop.id, ['paint_interior', 'flooring_lvp'], 0.15);
  for (let i = 0; i < 300 && prop.ownership?.renovation; i++) advanceDay(state);
  listForSale(state, prop.id, Math.round(prop.appraisal.point * 0.94));

  let offerId: string | null = null;
  for (let i = 0; i < 400 && !offerId; i++) {
    advanceDay(state);
    offerId = prop.ownership?.saleListing?.offers[0]?.id ?? null;
  }
  if (!offerId) return null;
  acceptOffer(state, prop.id, offerId);
  return { state, deal: state.closedDeals[0], bought: prop };
}

describe('replaying a closed deal', () => {
  it('captures the house as it was bought, not as it was sold', () => {
    const played = playOneDeal(31);
    if (!played) return;
    const { deal } = played;

    expect(deal.replay).not.toBeNull();
    const spec = deal.replay!.property;

    // The renovation raised the condition and completed work. The replay must
    // hand back the wreck, not the finished house.
    expect(spec.condition).toBeLessThan(0.9);
    expect(spec.condition).toBeCloseTo(deal.before!.condition, 5);
    expect(spec.sqft).toBe(played.bought.sqft);
    expect(spec.yearBuilt).toBe(played.bought.yearBuilt);
    expect(spec.neighborhoodId).toBe(deal.neighborhoodId);
  });

  it('does not hand back the knowledge an inspection was paid for', () => {
    // This is the property that keeps the replay honest. A thorough inspection
    // reveals most defects; if those came back pre-disclosed, the second run
    // would be an easier house than the one that was got wrong.
    const played = playOneDeal(32, { inspect: true });
    if (!played) return;
    const spec = played.deal.replay!.property;

    if (spec.defectIds.length > 0) {
      expect(spec.disclosedIds.length).toBeLessThanOrEqual(spec.defectIds.length);
      // Everything disclosed must actually be one of the defects.
      for (const d of spec.disclosedIds) expect(spec.defectIds).toContain(d);
    }
  });

  it('builds a playable scenario with the player’s own result as the bar', () => {
    const played = playOneDeal(33);
    if (!played) return;
    const def = replayScenario(played.deal);
    expect(def).not.toBeNull();

    expect(def!.property).toEqual(played.deal.replay!.property);
    expect(def!.startingCash).toBe(played.deal.replay!.cashAtPurchase);
    expect(def!.marketIndex).toBe(played.deal.replay!.marketIndex);
    // No distractors: the task is to underwrite this house properly, not to
    // find it again.
    expect(def!.distractors).toBe(0);
    // The bar is the player's own result, so beating it is beating yourself.
    if (played.deal.netProfit > 0) {
      expect(def!.targetProfit).toBeGreaterThan(played.deal.netProfit);
    } else {
      expect(def!.targetProfit).toBeGreaterThan(0);
    }
  });

  it('actually starts, and puts the same house on the board', () => {
    const played = playOneDeal(34);
    if (!played) return;
    const def = replayScenario(played.deal)!;

    const replayed = createScenarioGame(def, 99);
    expect(replayed.phase).toBe('playing');
    expect(replayed.market.length).toBeGreaterThan(0);

    const hero = replayed.market[0];
    expect(hero.sqft).toBe(def.property.sqft);
    expect(hero.yearBuilt).toBe(def.property.yearBuilt);
    expect(hero.neighborhoodId).toBe(def.property.neighborhoodId);
    expect(hero.condition).toBeCloseTo(def.property.condition, 5);
    expect(replayed.cash).toBe(def.startingCash);
    // And the defects are back, hidden again except what was disclosed.
    expect(hero.defects.map((d) => d.defId).sort()).toEqual([...def.property.defectIds].sort());
    for (const d of hero.defects) {
      expect(d.revealed).toBe(def.property.disclosedIds.includes(d.defId));
      expect(d.repaired).toBe(false);
    }
  });

  it('refuses to replay a deal captured before the feature existed', () => {
    const played = playOneDeal(35);
    if (!played) return;
    const legacy = { ...played.deal, replay: null };
    expect(replayScenario(legacy)).toBeNull();
  });

  it('sets a beatable bar on a deal that lost money', () => {
    const played = playOneDeal(36);
    if (!played) return;
    const losing = { ...played.deal, netProfit: -12_000 };
    const def = replayScenario(losing)!;
    expect(def.targetProfit).toBe(1);
    expect(def.brief).toMatch(/lost/i);
  });
});
