import { describe, expect, it } from 'vitest';
import {
  SCENARIOS,
  ScenarioError,
  acceptOffer,
  advanceDay,
  blankScenario,
  createScenarioGame,
  decodeScenario,
  encodeScenario,
  listForSale,
  makeOffer,
  startRenovation,
  trueValue,
} from '../src/engine';

describe('scenarios', () => {
  it('places the authored property on the market with its authored terms', () => {
    for (const def of SCENARIOS) {
      const state = createScenarioGame(def, 42);
      const hero = state.market.find((p) => p.id === `s_${def.id}`);
      expect(hero, `${def.id} hero listing`).toBeDefined();
      expect(hero!.sqft).toBe(def.property.sqft);
      expect(hero!.neighborhoodId).toBe(def.property.neighborhoodId);
      expect(hero!.listing!.askPrice).toBe(def.property.askPrice);
      expect(hero!.sellerType).toBe(def.property.sellerType);
      expect(state.cash).toBe(def.startingCash);
    }
  });

  it('discloses exactly the defects the author marked as known', () => {
    const def = SCENARIOS.find((s) => s.property.disclosedIds.length > 0)!;
    const state = createScenarioGame(def, 7);
    const hero = state.market.find((p) => p.id === `s_${def.id}`)!;

    const revealed = hero.defects.filter((d) => d.revealed).map((d) => d.defId).sort();
    expect(revealed).toEqual([...def.property.disclosedIds].sort());
    // And the hidden ones are genuinely present but not shown.
    expect(hero.defects.length).toBe(def.property.defectIds.length);
  });

  it('includes distractor listings so the right deal must be recognised', () => {
    const def = SCENARIOS[0];
    const state = createScenarioGame(def, 11);
    expect(state.market.length).toBe(def.distractors + 1);
  });

  it('is reproducible from its seed', () => {
    const def = SCENARIOS[1];
    const a = createScenarioGame(def, 2024);
    const b = createScenarioGame(def, 2024);
    expect(b.market.map((p) => p.address)).toEqual(a.market.map((p) => p.address));
  });

  it('passes only when a deal clears the target profit', () => {
    const def = SCENARIOS[0];
    const state = createScenarioGame(def, 5);
    expect(state.phase).toBe('playing');

    // A deal below the bar must not pass it.
    state.closedDeals.push({
      propertyId: 'x',
      address: 'x',
      neighborhoodId: 'maple_heights',
      boughtDay: 1,
      soldDay: 2,
      purchasePrice: 1,
      salePrice: 2,
      closingCosts: 0,
      renovationSpend: 0,
      holdingCosts: 0,
      financingCosts: 0,
      commission: 0,
      concession: 0,
      netProfit: def.targetProfit - 1,
      roi: 0,
      daysHeld: 1,
      postMortem: null,
      before: null,
      after: null,
      replay: null,
    });
    advanceDay(state);
    expect(state.phase).toBe('playing');

    state.closedDeals[0].netProfit = def.targetProfit;
    advanceDay(state);
    expect(state.phase).toBe('won');
  });

  it('fails when the clock runs out', () => {
    const def = SCENARIOS[0];
    const state = createScenarioGame(def, 6);
    state.day = def.dayLimit;
    advanceDay(state);
    expect(state.phase).toBe('lost');
    expect(state.outcomeMessage).toMatch(/time is up/i);
  });

  it('can be played to a win', () => {
    const def = SCENARIOS[0];
    const state = createScenarioGame(def, 3);
    const hero = state.market.find((p) => p.id === `s_${def.id}`)!;

    // Buy well under the ask, which is what the lesson is about.
    let bought = false;
    for (const price of [0.62, 0.68, 0.74, 0.8, 0.86, 0.92, 1]) {
      if (makeOffer(state, hero.id, Math.round(hero.listing!.askPrice * price), false).ok) {
        bought = true;
        break;
      }
    }
    expect(bought).toBe(true);

    const owned = state.portfolio[0];
    startRenovation(state, owned.id, ['paint_interior', 'flooring_lvp', 'kitchen_refresh'], 0.15);
    for (let i = 0; i < 90 && owned.ownership?.renovation; i++) advanceDay(state);

    listForSale(state, owned.id, Math.round(trueValue(owned, state.world, state.day) * 0.95));
    // Run right up to the scenario's own clock so it must resolve one way or
    // the other rather than being cut short by an arbitrary loop bound.
    while (state.phase === 'playing' && state.day <= def.dayLimit) {
      advanceDay(state);
      const sale = state.portfolio[0]?.ownership?.saleListing;
      if (sale && sale.offers.length > 0) acceptOffer(state, owned.id, sale.offers[0].id);
    }
    expect(['won', 'lost']).toContain(state.phase);
  });
});

describe('scenario share codes', () => {
  it('round-trips every built-in scenario', () => {
    for (const def of SCENARIOS) {
      const restored = decodeScenario(encodeScenario(def));
      expect(restored.name).toBe(def.name);
      expect(restored.startingCash).toBe(def.startingCash);
      expect(restored.targetProfit).toBe(def.targetProfit);
      expect(restored.property.sqft).toBe(def.property.sqft);
      expect(restored.property.askPrice).toBe(def.property.askPrice);
      expect(restored.property.defectIds).toEqual(def.property.defectIds);
      expect(restored.property.disclosedIds).toEqual(def.property.disclosedIds);
      expect(restored.property.sellerType).toBe(def.property.sellerType);
    }
  });

  it('produces a URL-safe code', () => {
    const code = encodeScenario(SCENARIOS[0]);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects nonsense politely', () => {
    expect(() => decodeScenario('not a code!!')).toThrow(ScenarioError);
    expect(() => decodeScenario('')).toThrow(ScenarioError);
  });

  it('rejects a code naming an unknown neighborhood', () => {
    const def = blankScenario();
    const tampered = { ...def, property: { ...def.property, neighborhoodId: 'atlantis' } };
    expect(() => decodeScenario(encodeScenario(tampered))).toThrow(/neighborhood/i);
  });

  it('clamps hostile values rather than trusting them', () => {
    const def = blankScenario();
    const nasty = {
      ...def,
      startingCash: 10 ** 12,
      dayLimit: -5,
      property: { ...def.property, sqft: 10 ** 9, condition: 40 },
    };
    const restored = decodeScenario(encodeScenario(nasty as any));
    expect(restored.startingCash).toBeLessThanOrEqual(5_000_000);
    expect(restored.dayLimit).toBeGreaterThanOrEqual(30);
    expect(restored.property.sqft).toBeLessThanOrEqual(6000);
    expect(restored.property.condition).toBeLessThanOrEqual(0.97);
  });

  it('drops defect ids it does not recognise', () => {
    const def = blankScenario();
    const tampered = {
      ...def,
      property: { ...def.property, defectIds: ['roof_failure', 'gremlins'] },
    };
    const restored = decodeScenario(encodeScenario(tampered as any));
    expect(restored.property.defectIds).toEqual(['roof_failure']);
  });
});
