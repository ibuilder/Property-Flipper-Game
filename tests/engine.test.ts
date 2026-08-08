import { describe, expect, it } from 'vitest';
import {
  ECON,
  Rng,
  SAVE_VERSION,
  SaveError,
  acceptOffer,
  advanceDay,
  afterRepairValue,
  analyzeDeal,
  conditionMultiplier,
  createGame,
  deserialize,
  detailedMao,
  inspectionConcession,
  listForSale,
  loanPayoff,
  makeOffer,
  netWorth,
  orderInspection,
  rule70Mao,
  scheduleDays,
  serialize,
  startRenovation,
  trueValue,
  upgradeMultiplier,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';
import { LEVELS_BY_ID } from '../src/engine/content';

const SEED = 12345;

/**
 * Pick the cheapest listing the player can actually close on. Several tests
 * used to grab market[0] blindly, which fails whenever the seed happens to put
 * a Harbor Point house at the top of the list.
 */
function cheapestAffordable(state: ReturnType<typeof createGame>) {
  const affordable = state.market
    .filter((p) => p.listing)
    .filter((p) => currentReserve(p) * 1.03 + 1000 < state.cash)
    .sort((a, b) => currentReserve(a) - currentReserve(b));
  if (affordable.length === 0) throw new Error('No affordable listing for this seed');
  return affordable[0];
}

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(SEED);
    const b = new Rng(SEED);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('round-trips through its serialised state', () => {
    const a = new Rng(SEED);
    a.next();
    a.next();
    const restored = Rng.fromState(a.getState());
    expect(restored.next()).toBe(Rng.fromState(a.getState()).next());
  });

  it('stays within bounds', () => {
    const rng = new Rng(SEED);
    for (let i = 0; i < 500; i++) {
      const v = rng.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe('valuation', () => {
  it('values a better-condition house higher', () => {
    expect(conditionMultiplier(0.9)).toBeGreaterThan(conditionMultiplier(0.3));
  });

  it('applies diminishing returns to stacked upgrades', () => {
    const one = upgradeMultiplier(['kitchen_full']) - 1;
    const many = upgradeMultiplier([
      'kitchen_full',
      'bath_full',
      'flooring_hardwood',
      'siding_exterior',
      'windows_replace',
      'open_floorplan',
    ]) - 1;
    // Six items must be worth more than one, but far less than six times more.
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThan(one * 6);
  });

  it('prices ARV above as-is value for a distressed house', () => {
    const state = createGame('first_flip', SEED);
    const distressed = state.market.find((p) => p.condition < 0.45);
    if (!distressed) return; // seed-dependent; skip rather than assert falsely
    const asIs = trueValue(distressed, state.world, state.day);
    const arv = afterRepairValue(distressed, state.world, state.day, [
      'kitchen_refresh',
      'paint_interior',
      'flooring_lvp',
    ]);
    expect(arv).toBeGreaterThan(asIs);
  });
});

describe('deal analyzer', () => {
  it('computes the 70% rule correctly', () => {
    expect(rule70Mao(300000, 45000)).toBe(300000 * 0.7 - 45000);
  });

  it('produces a lower MAO when carrying costs are higher', () => {
    const base = {
      arv: 300000,
      repairEstimate: 40000,
      renovationDays: 40,
      marketingDays: 45,
      targetProfitRate: 0.15,
      useFinancing: false,
    };
    const cheap = detailedMao(base, 60, 0.07);
    const expensive = detailedMao(base, 220, 0.07);
    expect(expensive).toBeLessThan(cheap);
  });

  it('charges for financing when leverage is used', () => {
    const base = {
      arv: 300000,
      repairEstimate: 40000,
      renovationDays: 40,
      marketingDays: 45,
      targetProfitRate: 0.15,
      useFinancing: false,
    };
    const unlevered = detailedMao(base, 100, 0.07);
    const levered = detailedMao({ ...base, useFinancing: true }, 100, 0.07);
    expect(levered).toBeLessThan(unlevered);
  });

  it('lowers MAO as scope grows', () => {
    const state = createGame('first_flip', SEED);
    const prop = state.market[0];
    const arv = afterRepairValue(prop, state.world, state.day, ['paint_interior']);
    const small = analyzeDeal(prop, state.world, state.day, arv, ['paint_interior'], state.skills);
    const big = analyzeDeal(
      prop,
      state.world,
      state.day,
      arv,
      ['paint_interior', 'kitchen_full', 'bath_full'],
      state.skills,
    );
    expect(big.repairEstimate).toBeGreaterThan(small.repairEstimate);
    expect(big.mao70).toBeLessThan(small.mao70);
  });
});

describe('scheduling', () => {
  it('overlaps trades rather than summing them', () => {
    expect(scheduleDays([10, 6, 4])).toBeLessThan(20);
    expect(scheduleDays([10, 6, 4])).toBeGreaterThan(10);
  });

  it('handles the empty and single cases', () => {
    expect(scheduleDays([])).toBe(0);
    expect(scheduleDays([7])).toBe(7);
  });
});

describe('game lifecycle', () => {
  it('creates a level with the right starting position', () => {
    const level = LEVELS_BY_ID['first_flip'];
    const state = createGame('first_flip', SEED);
    expect(state.cash).toBe(level.startingCash);
    expect(state.market.length).toBe(level.listingCount);
    expect(state.portfolio).toHaveLength(0);
    expect(state.phase).toBe('playing');
  });

  it('lets an inspection be ordered before buying, and the seller concedes', () => {
    const state = createGame('sandbox', 606);
    const prop = state.market.find((p) => p.defects.length >= 2 && p.condition < 0.5);
    if (!prop) return;

    const before = currentReserve(prop);
    expect(orderInspection(state, prop.id, 'thorough').ok).toBe(true);
    const after = currentReserve(prop);

    // Findings on paper are findings the seller has to price in.
    expect(prop.defects.some((d) => d.revealed)).toBe(true);
    expect(after).toBeLessThan(before);
  });

  it('advances days without throwing', () => {
    const state = createGame('the_grind', SEED);
    for (let i = 0; i < 400; i++) advanceDay(state);
    expect(state.day).toBe(401);
    expect(Number.isFinite(state.cash)).toBe(true);
    expect(Number.isFinite(state.world.marketIndex)).toBe(true);
    expect(state.world.marketIndex).toBeGreaterThan(0.5);
  });

  it('rejects an offer below the seller reserve', () => {
    const state = createGame('first_flip', SEED);
    const prop = state.market[0];
    const reserve = currentReserve(prop);
    const res = makeOffer(state, prop.id, Math.round(reserve * 0.5), false);
    expect(res.ok).toBe(false);
    expect(state.portfolio).toHaveLength(0);
  });

  it('never lists a property below its own reserve', () => {
    // Regression: ask premium and reserve ratio are independent draws, so
    // without a clamp about one listing in six had a reserve above its asking
    // price and would reject a full-price offer.
    for (const seed of [1, 2, 3, 5, 7, 11, 13, 17, 19, 23]) {
      const state = createGame('the_grind', seed);
      for (const p of state.market) {
        expect(currentReserve(p)).toBeLessThanOrEqual(p.listing!.askPrice);
      }
    }
  });

  it('always accepts a full asking-price offer', () => {
    const state = createGame('sandbox', 4711);
    const prop = cheapestAffordable(state);
    const ask = prop.listing!.askPrice;
    expect(makeOffer(state, prop.id, ask, false).ok).toBe(true);
  });

  it('refuses an offer the player cannot fund', () => {
    const state = createGame('first_flip', SEED);
    state.cash = 1000;
    const prop = state.market[0];
    const res = makeOffer(state, prop.id, 200000, false);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/need/i);
  });

  it('completes a buy, renovate, sell cycle and books a closed deal', () => {
    const state = createGame('sandbox', 777);
    const prop = state.market.reduce((a, b) => (a.sqft < b.sqft ? a : b));
    const reserve = currentReserve(prop);

    expect(makeOffer(state, prop.id, reserve + 500, false).ok).toBe(true);
    expect(state.portfolio).toHaveLength(1);

    const owned = state.portfolio[0];
    expect(orderInspection(state, owned.id, 'thorough').ok).toBe(true);

    expect(startRenovation(state, owned.id, ['paint_interior', 'flooring_lvp'], 0.2).ok).toBe(true);

    // Run the job out.
    for (let i = 0; i < 60 && state.portfolio[0]?.ownership?.renovation; i++) advanceDay(state);
    expect(state.portfolio[0].ownership!.renovation).toBeNull();
    expect(state.portfolio[0].completedWork).toContain('paint_interior');

    const value = trueValue(state.portfolio[0], state.world, state.day);
    expect(listForSale(state, owned.id, Math.round(value * 0.97)).ok).toBe(true);

    let sold = false;
    for (let i = 0; i < 400 && !sold; i++) {
      advanceDay(state);
      const sale = state.portfolio[0]?.ownership?.saleListing;
      if (sale && sale.offers.length > 0) {
        expect(acceptOffer(state, owned.id, sale.offers[0].id).ok).toBe(true);
        sold = true;
      }
    }
    expect(sold).toBe(true);
    expect(state.closedDeals).toHaveLength(1);
    expect(state.portfolio).toHaveLength(0);

    const deal = state.closedDeals[0];
    expect(deal.commission).toBeGreaterThan(0);
    expect(deal.holdingCosts).toBeGreaterThan(0);
  });

  it('escrows contingency and returns the unused portion', () => {
    const state = createGame('sandbox', 4242);
    const prop = cheapestAffordable(state);
    expect(makeOffer(state, prop.id, currentReserve(prop) + 1000, false).ok).toBe(true);
    const owned = state.portfolio[0];
    // A clean house so no change orders can consume the contingency.
    owned.defects = [];

    const before = state.cash;
    startRenovation(state, owned.id, ['paint_interior'], 0.25);
    const job = owned.ownership!.renovation!;
    expect(state.cash).toBeCloseTo(before - job.spent - job.contingencyBudgeted, 0);

    for (let i = 0; i < 40 && owned.ownership?.renovation; i++) advanceDay(state);
    // The contingency came back, so total renovation outlay is just the scope.
    const contingencyEntries = state.ledger.filter((l) =>
      l.description.includes('Unused contingency'),
    );
    expect(contingencyEntries).toHaveLength(1);
    expect(contingencyEntries[0].amount).toBe(job.contingencyBudgeted);
  });

  it('charges a buyer concession for defects left unrepaired', () => {
    const state = createGame('sandbox', 999);
    const prop = state.market[0];
    const concessionBefore = inspectionConcession(prop);
    if (prop.defects.length === 0) return;
    expect(concessionBefore).toBeGreaterThan(0);

    prop.defects.forEach((d) => (d.repaired = true));
    expect(inspectionConcession(prop)).toBe(0);
  });

  it('forecloses when a balloon payment cannot be met', () => {
    const state = createGame('sandbox', 31337);
    const prop = state.market[0];
    makeOffer(state, prop.id, currentReserve(prop) + 1000, true);
    expect(state.loans).toHaveLength(1);

    const loan = state.loans[0];
    // Jump to maturity with no cash to cover the balloon.
    state.day = loan.maturityDay;
    state.cash = 0;
    advanceDay(state);

    expect(state.loans).toHaveLength(0);
    expect(state.portfolio).toHaveLength(0);
    expect(state.log.some((l) => l.message.includes('Foreclosure'))).toBe(true);
  });

  it('accrues loan interest over time', () => {
    const state = createGame('sandbox', 555);
    const prop = state.market[0];
    makeOffer(state, prop.id, currentReserve(prop) + 1000, true);
    const loan = state.loans[0];
    const before = loanPayoff(loan);
    for (let i = 0; i < 30; i++) advanceDay(state);
    expect(loanPayoff(state.loans[0])).toBeGreaterThan(before);
  });

  it('declares a loss when the clock runs out', () => {
    const state = createGame('first_flip', SEED);
    state.day = LEVELS_BY_ID['first_flip'].dayLimit!;
    advanceDay(state);
    expect(state.phase).toBe('lost');
    expect(state.outcomeMessage).toMatch(/clock ran out/i);
  });

  it('declares a win when net worth clears the target', () => {
    const state = createGame('first_flip', SEED);
    state.cash = LEVELS_BY_ID['first_flip'].goalNetWorth + 50000;
    advanceDay(state);
    expect(state.phase).toBe('won');
  });

  it('marks inventory at liquidation value, not gross', () => {
    const state = createGame('sandbox', 1234);
    const prop = cheapestAffordable(state);
    const gross = trueValue(prop, state.world, state.day);
    const cashBefore = state.cash;
    expect(makeOffer(state, prop.id, currentReserve(prop) + 1000, false).ok).toBe(true);

    const owned = state.portfolio[0];
    const impliedMark = netWorth(state) - state.cash;
    // The mark must be below gross by at least the 7% cost of selling.
    expect(impliedMark).toBeLessThan(trueValue(owned, state.world, state.day) * 0.94);
    expect(cashBefore).toBeGreaterThan(state.cash);
  });

  it('keeps every cash movement in the ledger', () => {
    const state = createGame('sandbox', 8080);
    const prop = state.market[0];
    const startingCash = state.cash;
    makeOffer(state, prop.id, currentReserve(prop) + 1000, false);
    for (let i = 0; i < 25; i++) advanceDay(state);

    const ledgerSum = state.ledger.reduce((s, e) => s + e.amount, 0);
    expect(Math.round(startingCash + ledgerSum)).toBe(Math.round(state.cash));
  });
});

describe('history series', () => {
  it('records a point at creation and samples as days pass', () => {
    const state = createGame('sandbox', 4321);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].day).toBe(1);

    for (let i = 0; i < 40; i++) advanceDay(state);
    // Sampled every 5 days, so 40 days adds 8 points.
    expect(state.history.length).toBe(9);
    expect(state.history.at(-1)!.day).toBe(40);
  });

  it('captures a final point when the game ends, whatever the day', () => {
    const state = createGame('first_flip', 99);
    state.day = 137; // deliberately not on a sampling boundary
    state.cash = 10_000_000;
    advanceDay(state);
    expect(state.phase).toBe('won');
    expect(state.history.at(-1)!.day).toBe(138);
  });

  it('tracks net worth and market movement', () => {
    const state = createGame('the_grind', 7);
    for (let i = 0; i < 100; i++) advanceDay(state);
    const pts = state.history;
    expect(pts.every((p) => Number.isFinite(p.netWorth))).toBe(true);
    expect(pts.every((p) => Number.isFinite(p.marketIndex))).toBe(true);
    expect(Object.keys(pts.at(-1)!.neighborhoods).length).toBeGreaterThan(0);
  });

  it('stays small enough to keep saves portable', () => {
    const state = createGame('the_grind', 11);
    for (let i = 0; i < 900; i++) advanceDay(state);
    // A full campaign must not accumulate an unbounded series.
    expect(state.history.length).toBeLessThan(200);
  });
});

describe('save files', () => {
  it('round-trips a game', () => {
    const state = createGame('leverage', SEED);
    for (let i = 0; i < 30; i++) advanceDay(state);
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(state))));
    expect(restored.day).toBe(state.day);
    expect(restored.cash).toBe(state.cash);
    expect(restored.market.length).toBe(state.market.length);
  });

  it('resumes the exact random stream after a reload', () => {
    const a = createGame('sandbox', 24680);
    for (let i = 0; i < 20; i++) advanceDay(a);
    const b = deserialize(JSON.parse(JSON.stringify(serialize(a))));

    for (let i = 0; i < 20; i++) {
      advanceDay(a);
      advanceDay(b);
    }
    expect(b.cash).toBe(a.cash);
    expect(b.world.marketIndex).toBe(a.world.marketIndex);
    expect(b.market.map((p) => p.id)).toEqual(a.market.map((p) => p.id));
  });

  it('refuses a save from a newer version', () => {
    const state = createGame('first_flip', SEED);
    const file = serialize(state);
    file.version = SAVE_VERSION + 5;
    expect(() => deserialize(file)).toThrow(SaveError);
  });

  it('refuses a save with an unknown level', () => {
    const state = createGame('first_flip', SEED);
    const file = serialize(state);
    (file.state as any).levelId = 'not_a_level';
    expect(() => deserialize(file)).toThrow(SaveError);
  });

  it('migrates a v2 save by seeding the chart series', () => {
    const state = createGame('first_flip', SEED);
    for (let i = 0; i < 20; i++) advanceDay(state);
    const file: any = serialize(state);
    file.version = 2;
    delete file.state.history;

    const restored = deserialize(file);
    // Charts must have something to draw rather than starting blank.
    expect(restored.history.length).toBeGreaterThan(0);
    expect(restored.history[0].day).toBe(restored.day);
    expect(restored.history[0].netWorth).toBe(Math.round(restored.cash));
  });

  it('migrates a v1 save', () => {
    const state = createGame('first_flip', SEED);
    const file: any = serialize(state);
    file.version = 1;
    delete file.state.world.baseRate;
    delete file.state.closedDeals;
    const restored = deserialize(file);
    expect(restored.world.baseRate).toBeGreaterThan(0);
    expect(restored.closedDeals).toEqual([]);
  });
});

describe('net worth', () => {
  it('subtracts outstanding debt, so leverage costs net worth', () => {
    // Buying below true value legitimately creates net worth -- that is the
    // whole business. What leverage must not do is create it for free: the
    // same purchase financed should be worth strictly less than one paid in
    // cash, by the origination points.
    const build = (financed: boolean) => {
      const state = createGame('sandbox', 1111);
      const prop = cheapestAffordable(state);
      const offer = currentReserve(prop) + 1000;
      expect(makeOffer(state, prop.id, offer, financed).ok).toBe(true);
      return state;
    };

    const cash = build(false);
    const levered = build(true);

    expect(levered.loans).toHaveLength(1);
    expect(cash.loans).toHaveLength(0);
    expect(netWorth(levered)).toBeLessThan(netWorth(cash));

    // And the gap is the points, not something arbitrary.
    const points = levered.loans[0].pointsPaid;
    expect(netWorth(cash) - netWorth(levered)).toBeCloseTo(points, -1);
  });

  it('counts an owned property toward net worth', () => {
    const state = createGame('sandbox', 2222);
    const before = netWorth(state);
    const prop = cheapestAffordable(state);
    makeOffer(state, prop.id, currentReserve(prop) + 1000, false);
    // Cash fell by the purchase price but the asset replaced it, so net worth
    // must not have collapsed by anything like the purchase price.
    expect(netWorth(state)).toBeGreaterThan(before * 0.9);
  });
});

