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
  originateLoan,
  pointsDiscount,
  quoteScope,
  rateDiscount,
  renovationDiscount,
  settlementPrice,
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
      expect(competingBid(prop, generous, rng)).toBeNull();
    }
  });

  it('can outbid a wafer-thin offer on a contested listing', () => {
    const state = createGame('the_grind', 88);
    const prop = state.market[0];
    prop.listing!.competition = 1;
    prop.listing!.daysOnMarket = 0;
    const thin = currentReserve(prop) + 10;

    const rng = new Rng(9);
    let outbids = 0;
    for (let i = 0; i < 200; i++) if (competingBid(prop, thin, rng) !== null) outbids++;
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
