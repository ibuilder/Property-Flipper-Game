import { describe, expect, it } from 'vitest';
import {
  Rng,
  acceptOffer,
  advanceDay,
  adjustReputation,
  changeOrderChance,
  commissionDiscount,
  createGame,
  hasAppraisalGap,
  initialReputation,
  listForSale,
  makeOffer,
  ECON,
  mergeTemplate,
  originateLoan,
  rejectOffer,
  sellingCosts,
  pointsDiscount,
  quoteScope,
  rateDiscount,
  renovationDiscount,
  settlementPrice,
  startRenovation,
  trueValue,
} from '../src/engine';
import { competingBid, currentReserve } from '../src/engine/market';

describe('rival buyers', () => {
  it('marks well-priced listings as more contested', () => {
    const state = createGame('the_grind', 4242);
    const withComp = state.market.map((p) => ({
      ratio: p.listing!.askPrice / trueValue(p, state.world, state.day),
      heat: p.listing!.competition,
    }));
    // Cheaper relative to value should broadly mean more interest.
    const cheap = withComp.filter((x) => x.ratio < 1);
    const dear = withComp.filter((x) => x.ratio > 1.05);
    if (cheap.length === 0 || dear.length === 0) return;
    const avg = (xs: typeof cheap) => xs.reduce((s, x) => s + x.heat, 0) / xs.length;
    expect(avg(cheap)).toBeGreaterThan(avg(dear));
  });

  it('does not outbid a comfortably strong offer', () => {
    const state = createGame('the_grind', 77);
    const prop = state.market[0];
    prop.listing!.competition = 1;
    const generous = Math.round(currentReserve(prop) * 1.3);
    const rng = new Rng(1);
    // Well clear of the reserve: no amount of interest should snipe it.
    for (let i = 0; i < 50; i++) {
      expect(competingBid(prop, generous, 0, rng)).toBeNull();
    }
  });

  it('never bids below the price the seller just refused', () => {
    // Regression: competition measured headroom on the raw offer while
    // acceptance used the persuaded one, so a skilled negotiator could be
    // "outbid" at a number under the seller's own reserve.
    const state = createGame('the_grind', 4242);
    const prop = state.market[0];
    prop.listing!.competition = 1;
    prop.listing!.daysOnMarket = 0;
    const reserve = currentReserve(prop);

    for (const neg of [0, 3, 5]) {
      const rng = new Rng(7);
      for (let i = 0; i < 300; i++) {
        const bid = competingBid(prop, Math.round(reserve * 0.9), neg, rng);
        if (bid !== null) expect(bid).toBeGreaterThanOrEqual(reserve);
      }
    }
  });

  it('lets negotiation skill protect against being sniped', () => {
    const state = createGame('the_grind', 4242);
    const prop = state.market[0];
    prop.listing!.competition = 1;
    prop.listing!.daysOnMarket = 0;
    const reserve = currentReserve(prop);

    // The same number, judged at two skill levels. A persuasive buyer's offer
    // reads as stronger, so it should draw fewer rivals -- not the same or more.
    const offer = Math.round(reserve * 1.02);
    const rate = (neg: number) => {
      const rng = new Rng(11);
      let hits = 0;
      for (let i = 0; i < 500; i++) if (competingBid(prop, offer, neg, rng) !== null) hits++;
      return hits / 500;
    };

    expect(rate(5)).toBeLessThan(rate(0));
  });

  it('can outbid a wafer-thin offer on a contested listing', () => {
    const state = createGame('the_grind', 88);
    const prop = state.market[0];
    prop.listing!.competition = 1;
    prop.listing!.daysOnMarket = 0;
    const thin = currentReserve(prop) + 10;

    const rng = new Rng(9);
    let outbids = 0;
    for (let i = 0; i < 200; i++) if (competingBid(prop, thin, 0, rng) !== null) outbids++;
    expect(outbids).toBeGreaterThan(0);
  });

  it('removes listings that rivals buy, over time', () => {
    const state = createGame('the_grind', 31337);
    for (const p of state.market) if (p.listing) p.listing.competition = 1;
    const originals = new Set(state.market.map((p) => p.id));

    for (let i = 0; i < 120; i++) advanceDay(state);

    const survivors = state.market.filter((p) => originals.has(p.id));
    expect(survivors.length).toBeLessThan(originals.size);
    expect(state.log.some((l) => /another buyer/i.test(l.message))).toBe(true);
  });
});

describe('appraisal gap', () => {
  it('settles a financed offer at the appraisal when it comes in low', () => {
    const offer = {
      id: 'o1',
      amount: 300000,
      inspectionConcession: 0,
      expiresDay: 10,
      buyerName: 'x',
      financed: true,
      appraisedValue: 280000,
    };
    expect(hasAppraisalGap(offer)).toBe(true);
    expect(settlementPrice(offer)).toBe(280000);
  });

  it('leaves a cash offer alone', () => {
    const offer = {
      id: 'o2',
      amount: 300000,
      inspectionConcession: 0,
      expiresDay: 10,
      buyerName: 'x',
      financed: false,
      appraisedValue: Number.MAX_SAFE_INTEGER,
    };
    expect(hasAppraisalGap(offer)).toBe(false);
    expect(settlementPrice(offer)).toBe(300000);
  });

  it('books the sale at the settled price, not the contract price', () => {
    const state = createGame('sandbox', 5150);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, false).ok).toBe(true);

    const owned = state.portfolio[0];
    listForSale(state, owned.id, Math.round(trueValue(owned, state.world, state.day) * 0.85));

    let gapSeen = false;
    for (let i = 0; i < 300 && state.closedDeals.length === 0; i++) {
      advanceDay(state);
      const sale = state.portfolio[0]?.ownership?.saleListing;
      const o = sale?.offers[0];
      if (o) {
        gapSeen = hasAppraisalGap(o);
        const expected = settlementPrice(o);
        acceptOffer(state, owned.id, o.id);
        expect(state.closedDeals[0].salePrice).toBe(expected);
      }
    }
    expect(state.closedDeals.length).toBe(1);
    // Not asserting a gap occurred -- it is stochastic -- only that if one did,
    // the booked price honoured it, which the loop above checks.
    expect(typeof gapSeen).toBe('boolean');
  });
});

describe('buyer offers respect the asking price', () => {
  it('never offers more than the player listed at', () => {
    // Regression: the financed stretch was applied after the list-price clamp,
    // so a financed buyer could bid up to 5% over the price on the board.
    const state = createGame('the_grind', 909);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, false).ok).toBe(true);

    const owned = state.portfolio[0];
    // List well under value so buyers are keen and the clamp is what binds.
    const listPrice = Math.round(trueValue(owned, state.world, state.day) * 0.8);
    listForSale(state, owned.id, listPrice);

    let seen = 0;
    for (let i = 0; i < 400 && seen < 12; i++) {
      advanceDay(state);
      const sale = state.portfolio[0]?.ownership?.saleListing;
      for (const o of sale?.offers ?? []) {
        expect(o.amount).toBeLessThanOrEqual(listPrice);
        seen++;
      }
      if (sale && sale.offers.length > 0) rejectOffer(state, owned.id, sale.offers[0].id);
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('before and after', () => {
  it('captures the house as bought and as sold, and they differ', () => {
    const state = createGame('sandbox', 6161);
    const prop = state.market
      .filter((p) => p.listing && p.condition < 0.5)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    if (!prop) return;

    const conditionAtPurchase = prop.condition;
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, false).ok).toBe(true);

    const owned = state.portfolio[0];
    expect(owned.ownership!.boughtAs).not.toBeNull();
    expect(owned.ownership!.boughtAs!.condition).toBe(conditionAtPurchase);

    startRenovation(state, owned.id, ['paint_interior', 'flooring_lvp'], 0.15);
    for (let i = 0; i < 90 && owned.ownership?.renovation; i++) advanceDay(state);

    listForSale(state, owned.id, Math.round(trueValue(owned, state.world, state.day) * 0.85));
    for (let i = 0; i < 300 && state.closedDeals.length === 0; i++) {
      advanceDay(state);
      const sale = state.portfolio[0]?.ownership?.saleListing;
      if (sale && sale.offers.length > 0) acceptOffer(state, owned.id, sale.offers[0].id);
    }
    expect(state.closedDeals).toHaveLength(1);

    const deal = state.closedDeals[0];
    expect(deal.before).not.toBeNull();
    expect(deal.after).not.toBeNull();
    // The snapshot must be frozen at purchase, not a live reference that
    // followed the property through its renovation.
    expect(deal.before!.condition).toBe(conditionAtPurchase);
    expect(deal.after!.condition).toBeGreaterThan(deal.before!.condition);
    expect(deal.before!.completedWork).toHaveLength(0);
    expect(deal.after!.completedWork).toContain('paint_interior');
  });
});

describe('scope templates', () => {
  it('keeps defect repairs when a template is applied', () => {
    // Regression: applying a template replaced the whole selection, silently
    // unticking a defect repair the player had deliberately budgeted for.
    const current = ['defect:foundation_settling', 'paint_interior'];
    const template = ['paint_interior', 'flooring_lvp', 'kitchen_refresh'];
    const merged = mergeTemplate(current, template, []);

    expect(merged).toContain('defect:foundation_settling');
    expect(merged).toEqual(expect.arrayContaining(template));
  });

  it('drops discretionary items the template does not include', () => {
    const merged = mergeTemplate(['kitchen_full', 'bath_full'], ['paint_interior'], []);
    expect(merged).toEqual(['paint_interior']);
  });

  it('never re-scopes work already completed', () => {
    const merged = mergeTemplate([], ['paint_interior', 'flooring_lvp'], ['paint_interior']);
    expect(merged).toEqual(['flooring_lvp']);
  });

  it('does not duplicate an item already selected', () => {
    const merged = mergeTemplate(['paint_interior'], ['paint_interior'], []);
    expect(merged).toEqual(['paint_interior']);
  });
});

describe('reputation', () => {
  it('starts neutral and clamps at both ends', () => {
    const rep = initialReputation();
    expect(rep.lenders).toBe(50);
    adjustReputation(rep, 'lenders', 999);
    expect(rep.lenders).toBe(100);
    adjustReputation(rep, 'lenders', -999);
    expect(rep.lenders).toBe(0);
  });

  it('prices loans better for a trusted borrower', () => {
    const state = createGame('sandbox', 2);
    const cheap = originateLoan('a', 'p', 200000, state.world, 1, 95);
    const dear = originateLoan('b', 'p', 200000, state.world, 1, 5);
    expect(cheap.loan.pointsPaid).toBeLessThan(dear.loan.pointsPaid);
    expect(cheap.loan.annualRate).toBeLessThan(dear.loan.annualRate);
    expect(cheap.netProceeds).toBeGreaterThan(dear.netProceeds);
  });

  it('applies the agent discount inside sellingCosts, for every caller', () => {
    // Regression: the engine discounted commission while the offer cards did
    // not, so the panel for comparing offers was wrong by exactly the benefit
    // the player had earned. Making it a parameter of sellingCosts means a
    // caller cannot forget it silently.
    const flat = sellingCosts(400000);
    const earned = sellingCosts(400000, 100);
    const burned = sellingCosts(400000, 0);

    expect(flat.commission).toBe(Math.round(400000 * ECON.COMMISSION_RATE));
    expect(earned.commission).toBeLessThan(flat.commission);
    expect(burned.commission).toBeGreaterThan(flat.commission);
    // Closing costs are not an agent's to discount.
    expect(earned.closing).toBe(flat.closing);
  });

  it('lowers commission and change orders as standing improves', () => {
    expect(commissionDiscount(100)).toBeGreaterThan(commissionDiscount(0));
    expect(changeOrderChance(0, 100)).toBeLessThan(changeOrderChance(0, 0));
    expect(renovationDiscount(100)).toBeGreaterThan(renovationDiscount(0));
    // Neutral standing must be exactly neutral, or every existing balance
    // number would silently shift.
    expect(pointsDiscount(50)).toBe(0);
    expect(rateDiscount(50)).toBe(0);
    expect(commissionDiscount(50)).toBe(0);
    expect(renovationDiscount(50)).toBe(0);
  });

  it('quotes cheaper work for a trusted client', () => {
    const state = createGame('sandbox', 3);
    const prop = state.market[0];
    const trusted = quoteScope(['kitchen_full'], prop, state.world, state.skills, 100);
    const burned = quoteScope(['kitchen_full'], prop, state.world, state.skills, 0);
    expect(trusted.totalCost).toBeLessThan(burned.totalCost);
  });

  it('punishes a foreclosure durably', () => {
    const state = createGame('sandbox', 31338);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, true);
    expect(state.loans).toHaveLength(1);

    const before = state.reputation.lenders;
    state.day = state.loans[0].maturityDay;
    state.cash = 0;
    advanceDay(state);

    expect(state.log.some((l) => /Foreclosure/.test(l.message))).toBe(true);
    expect(state.reputation.lenders).toBeLessThan(before - 20);
  });
});

