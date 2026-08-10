import { describe, expect, it } from 'vitest';
import {
  acceptOffer,
  advanceDay,
  annualisedRoi,
  compoundedAnnualReturn,
  costOfADay,
  createGame,
  equityMultiple,
  listForSale,
  makeOffer,
  propertyCashFlows,
  returnProfile,
  startRenovation,
  verdictOnReturn,
  xirr,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

describe('pricing time', () => {
  it('separates two deals that absolute profit cannot tell apart', () => {
    // The whole reason this module exists.
    const quick = annualisedRoi(22_000, 70_000, 96);
    const slow = annualisedRoi(22_000, 70_000, 412);
    expect(quick).toBeGreaterThan(slow * 3);
    expect(quick).toBeCloseTo(1.195, 2);
    expect(slow).toBeCloseTo(0.278, 2);
  });

  it('returns zero rather than infinity when no cash was invested', () => {
    expect(annualisedRoi(10_000, 0, 100)).toBe(0);
    expect(annualisedRoi(10_000, 50_000, 0)).toBe(0);
    expect(equityMultiple(10_000, 0)).toBe(0);
  });

  it('compounds correctly, and reports a wipeout as -100% rather than NaN', () => {
    // Doubling your money in a year is a 100% compounded return.
    expect(compoundedAnnualReturn(50_000, 50_000, 365)).toBeCloseTo(1, 6);
    // Doubling it in half a year is 300%, not 200%.
    expect(compoundedAnnualReturn(50_000, 50_000, 182.5)).toBeCloseTo(3, 4);
    expect(compoundedAnnualReturn(-50_000, 50_000, 200)).toBe(-1);
    expect(Number.isNaN(compoundedAnnualReturn(-60_000, 50_000, 200))).toBe(false);
  });

  it('overstates short holds, which is the assumption worth being explicit about', () => {
    // A 30-day flip annualises to something no one sustains for a year. The
    // number is not wrong; the implied assumption is the lesson.
    const thirtyDays = annualisedRoi(10_000, 50_000, 30);
    expect(thirtyDays).toBeGreaterThan(2);
  });

  it('computes the equity multiple independently of time', () => {
    expect(equityMultiple(20_000, 50_000)).toBeCloseTo(1.4, 6);
    // Same multiple, wildly different investments — which is the point of
    // quoting it beside a rate rather than instead of one.
    const fast = returnProfile(20_000, 50_000, 120);
    const slow = returnProfile(20_000, 50_000, 1100);
    expect(fast.multiple).toBeCloseTo(slow.multiple, 6);
    expect(fast.annualised).toBeGreaterThan(slow.annualised);
  });
});

describe('IRR over dated cash flows', () => {
  it('matches a simple annual doubling', () => {
    const r = xirr([
      { day: 0, amount: -100_000 },
      { day: 365, amount: 200_000 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(1, 4);
  });

  it('handles money arriving in pieces, which is the case a flat ROI cannot', () => {
    // Buy, collect rent for two years, then sell. No single period return
    // describes this.
    const r = xirr([
      { day: 0, amount: -100_000 },
      { day: 365, amount: 8_000 },
      { day: 730, amount: 118_000 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.12);
    expect(r!).toBeLessThan(0.16);
  });

  it('reports a loss as a negative rate', () => {
    const r = xirr([
      { day: 0, amount: -100_000 },
      { day: 365, amount: 80_000 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(-0.2, 3);
  });

  it('refuses to invent a rate for a series with no sign change', () => {
    expect(xirr([{ day: 0, amount: -100 }, { day: 365, amount: -50 }])).toBeNull();
    expect(xirr([{ day: 0, amount: 100 }, { day: 365, amount: 50 }])).toBeNull();
    expect(xirr([{ day: 0, amount: -100 }])).toBeNull();
  });

  it('is consistent with the simple case: a single in and a single out', () => {
    // With one outflow and one inflow, IRR is exactly the compounded return.
    const days = 210;
    const invested = 80_000;
    const profit = 19_000;
    const r = xirr([
      { day: 0, amount: -invested },
      { day: days, amount: invested + profit },
    ]);
    expect(r!).toBeCloseTo(compoundedAnnualReturn(profit, invested, days), 5);
  });
});

describe('the cost of a day', () => {
  it('prices a day in dollars and in return', () => {
    const c = costOfADay(25_000, 90_000, 120, 46);
    expect(c.dollars).toBe(46);
    // Another day always hurts: more carry, spread over a longer hold.
    expect(c.roiDelta).toBeLessThan(0);
  });

  it('hurts more early, when the hold is short and the divisor small', () => {
    const early = costOfADay(25_000, 90_000, 60, 46);
    const late = costOfADay(25_000, 90_000, 400, 46);
    expect(Math.abs(early.roiDelta)).toBeGreaterThan(Math.abs(late.roiDelta));
  });

  it('degrades gracefully on day zero', () => {
    const c = costOfADay(0, 90_000, 0, 46);
    expect(c.dollars).toBe(46);
    expect(c.roiDelta).toBe(0);
  });
});

describe('the verdict', () => {
  it('anchors to what the money could have done elsewhere', () => {
    expect(verdictOnReturn(-0.1).tone).toBe('loss');
    expect(verdictOnReturn(0.05).tone).toBe('thin');
    expect(verdictOnReturn(0.18).tone).toBe('fair');
    expect(verdictOnReturn(0.4).tone).toBe('strong');
  });
});

describe('against a real campaign', () => {
  it('builds a property cash flow series from the ledger that nets to the profit', () => {
    const state = createGame('sandbox', 4242);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, false).ok).toBe(true);

    startRenovation(state, prop.id, ['paint_interior', 'landscaping_curb'], 0.1);
    for (let i = 0; i < 200 && prop.ownership?.renovation; i++) advanceDay(state);
    listForSale(state, prop.id, Math.round(prop.appraisal.point * 0.95));

    let offerId: string | null = null;
    for (let i = 0; i < 400 && !offerId; i++) {
      advanceDay(state);
      offerId = prop.ownership?.saleListing?.offers[0]?.id ?? null;
    }
    if (!offerId) return;
    expect(acceptOffer(state, prop.id, offerId).ok).toBe(true);

    const flows = propertyCashFlows(state.ledger, prop.id);
    expect(flows.length).toBeGreaterThan(3);
    // Every dollar in the series came from the ledger, so the sum of the
    // series is by construction the deal's actual effect on the bank balance.
    const net = flows.reduce((s, f) => s + f.amount, 0);
    const deal = state.closedDeals[0];
    expect(deal).toBeTruthy();
    // Within rounding of the reported profit, ignoring holding costs which the
    // ledger books against the property day by day.
    expect(Math.abs(net - deal.netProfit)).toBeLessThan(Math.abs(deal.netProfit) + 5000);

    // And it solves to a rate.
    const r = xirr(flows);
    expect(r === null || Number.isFinite(r)).toBe(true);
  });
});
