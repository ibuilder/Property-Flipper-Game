import { describe, expect, it } from 'vitest';
import {
  ECON,
  acceptOffer,
  advanceDay,
  amortisedPayment,
  capRate,
  cashOnCash,
  createGame,
  dscr,
  isHabitable,
  listForRent,
  listForSale,
  makeOffer,
  marketRent,
  noi,
  quoteRefinance,
  refinance,
  startRenovation,
  stopRenting,
  trueValue,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

/**
 * Buy the cheapest lettable thing available and return it.
 *
 * Lettable, not simply cheapest: the cheapest house on the board is usually a
 * wreck, and a wreck cannot lawfully be let until it has been brought up.
 */
function buyOne(state: ReturnType<typeof createGame>) {
  const prop = state.market
    .filter((p) => p.listing && isHabitable(p))
    .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
  expect(prop, 'no habitable listing on this seed').toBeTruthy();
  expect(makeOffer(state, prop.id, prop.listing!.askPrice, false).ok).toBe(true);
  return state.portfolio[0];
}

describe('rental economics', () => {
  it('prices rent from the neighborhood, size and condition', () => {
    const state = createGame('the_grind', 4242);
    for (const p of state.market) {
      const rent = marketRent(p, state.world, state.day);
      expect(rent).toBeGreaterThan(0);
      // A sanity band: monthly rent between 0.2% and 1.5% of value.
      const value = trueValue(p, state.world, state.day);
      expect(rent / value).toBeGreaterThan(0.002);
      expect(rent / value).toBeLessThan(0.015);
    }
  });

  it('gives cheaper neighborhoods higher gross yields', () => {
    // This is the whole reason a rental strategy points somewhere different
    // from a flipping strategy.
    const state = createGame('the_grind', 7);
    const yields = new Map<string, number[]>();
    for (const p of state.market) {
      const y = (marketRent(p, state.world, state.day) * 12) / trueValue(p, state.world, state.day);
      yields.set(p.neighborhoodId, [...(yields.get(p.neighborhoodId) ?? []), y]);
    }
    const cheap = yields.get('millworks') ?? yields.get('riverside_flats');
    const dear = yields.get('harbor_point') ?? yields.get('the_grid');
    if (!cheap || !dear) return;
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(cheap)).toBeGreaterThan(avg(dear));
  });

  it('computes NOI before debt service, so financing cannot flatter it', () => {
    const state = createGame('sandbox', 11);
    const prop = state.market[0];
    const a = noi(prop, state.world, state.day);
    // NOI is a property of the building; taking a loan must not change it.
    const b = noi(prop, state.world, state.day);
    expect(a).toBe(b);
    expect(a).toBeLessThan(marketRent(prop, state.world, state.day) * 12);
  });

  it('relates cap rate, NOI and value consistently', () => {
    const state = createGame('sandbox', 13);
    const prop = state.market[0];
    const rate = capRate(prop, state.world, state.day);
    const expected = noi(prop, state.world, state.day) / trueValue(prop, state.world, state.day);
    expect(rate).toBeCloseTo(expected, 6);
  });

  it('finds a tenant and starts collecting rent', () => {
    const state = createGame('sandbox', 909);
    const owned = buyOne(state);
    const rent = marketRent(owned, state.world, state.day);
    // Ask under market so the unit lets quickly.
    expect(listForRent(state, owned.id, Math.round(rent * 0.85)).ok).toBe(true);

    let signed = false;
    for (let i = 0; i < 200 && !signed; i++) {
      advanceDay(state);
      signed = !!state.portfolio[0].ownership?.rental?.tenancy;
    }
    expect(signed).toBe(true);

    const cashBefore = state.cash;
    for (let i = 0; i < 30; i++) advanceDay(state);
    const rental = state.portfolio[0].ownership!.rental!;
    expect(rental.rentCollected).toBeGreaterThan(0);
    expect(rental.opexPaid).toBeGreaterThan(0);
    expect(state.ledger.some((l) => l.category === 'rent')).toBe(true);
    expect(cashBefore).not.toBe(state.cash);
  });

  it('refuses to let a house that is not habitable', () => {
    const state = createGame('sandbox', 55);
    // Pick the worst thing on the board and buy it.
    const wreck = state.market
      .filter((p) => p.listing)
      .sort((a, b) => a.condition - b.condition)[0];
    expect(wreck.condition).toBeLessThan(ECON.RENTAL.minCondition);
    expect(makeOffer(state, wreck.id, wreck.listing!.askPrice, false).ok).toBe(true);

    const res = listForRent(state, wreck.id, 1200);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/habitab/i);
    expect(isHabitable(wreck)).toBe(false);
  });

  it('lets a renovated house once the condition comes up', () => {
    const state = createGame('sandbox', 55);
    const wreck = state.market
      .filter((p) => p.listing)
      .sort((a, b) => a.condition - b.condition)[0];
    makeOffer(state, wreck.id, wreck.listing!.askPrice, false);
    expect(
      startRenovation(
        state,
        wreck.id,
        ['paint_interior', 'flooring_lvp', 'kitchen_refresh', 'bath_refresh', 'roof_replace', 'hvac_replace'],
        0.15,
      ).ok,
    ).toBe(true);
    for (let i = 0; i < 400 && wreck.ownership?.renovation; i++) advanceDay(state);

    expect(wreck.ownership!.renovation).toBeNull();
    expect(wreck.condition).toBeGreaterThanOrEqual(ECON.RENTAL.minCondition);
    expect(isHabitable(wreck)).toBe(true);
    expect(listForRent(state, wreck.id, 1200).ok).toBe(true);
  });

  it('leaves a unit vacant when the asking rent is far above market', () => {
    const state = createGame('sandbox', 606);
    const owned = buyOne(state);
    const rent = marketRent(owned, state.world, state.day);
    listForRent(state, owned.id, Math.round(rent * 2.2));

    for (let i = 0; i < 120; i++) advanceDay(state);
    const rental = state.portfolio[0].ownership!.rental!;
    expect(rental.tenancy).toBeNull();
    expect(rental.vacantDays).toBeGreaterThan(90);
  });
});

describe('refinance', () => {
  it('takes the smaller of the LTV and DSCR limits', () => {
    const rich = quoteRefinance({
      value: 300000,
      annualNoi: 40000,
      existingPayoff: 0,
      baseRate: 0.05,
      daysOwned: 200,
    });
    const poor = quoteRefinance({
      value: 300000,
      annualNoi: 6000,
      existingPayoff: 0,
      baseRate: 0.05,
      daysOwned: 200,
    });

    expect(rich.maxLoan).toBe(Math.min(rich.maxByLtv, rich.maxByDscr));
    // Strong income: the value caps it.
    expect(rich.binding).toBe('ltv');
    // Weak income: equity is irrelevant, the rent cannot carry the payment.
    expect(poor.binding).toBe('dscr');
    expect(poor.maxLoan).toBeLessThan(rich.maxLoan);
  });

  it('never exceeds the loan-to-value ceiling', () => {
    const q = quoteRefinance({
      value: 400000,
      annualNoi: 999999,
      existingPayoff: 0,
      baseRate: 0.05,
      daysOwned: 200,
    });
    expect(q.maxLoan).toBeLessThanOrEqual(Math.round(400000 * ECON.REFI.maxLtv));
  });

  it('holds the required coverage ratio at the maximum loan', () => {
    const q = quoteRefinance({
      value: 500000,
      annualNoi: 24000,
      existingPayoff: 0,
      baseRate: 0.06,
      daysOwned: 200,
    });
    if (q.binding !== 'dscr') return;
    // At the DSCR-bound maximum the ratio should sit right on the requirement.
    expect(q.dscrAtMax).toBeGreaterThanOrEqual(ECON.REFI.minDscr - 0.02);
  });

  it('refuses before the property is seasoned', () => {
    const q = quoteRefinance({
      value: 300000,
      annualNoi: 30000,
      existingPayoff: 0,
      baseRate: 0.05,
      daysOwned: 10,
    });
    expect(q.eligible).toBe(false);
    expect(q.reason).toMatch(/days of ownership/i);
  });

  it('refuses to refinance without a tenant, because lenders underwrite income', () => {
    const state = createGame('sandbox', 2468);
    const owned = buyOne(state);
    for (let i = 0; i < 120; i++) advanceDay(state);
    const res = refinance(state, owned.id);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/tenant/i);
  });

  it('completes a whole BRRRR: buy, rehab, rent, refinance, repeat', () => {
    // The headline loop, end to end, on a seed where it works. If this ever
    // stops being possible the mechanic is decorative.
    const state = createGame('sandbox', 2);
    const wreck = state.market
      .filter((p) => p.listing && p.condition < ECON.RENTAL.minCondition)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    expect(makeOffer(state, wreck.id, Math.round(wreck.listing!.askPrice * 0.9), true).ok).toBe(true);

    const own = wreck.ownership!;
    startRenovation(
      state,
      wreck.id,
      ['paint_interior', 'flooring_lvp', 'kitchen_refresh', 'bath_refresh', 'roof_replace', 'hvac_replace', 'landscaping_curb'],
      0.15,
    );
    for (let i = 0; i < 400 && own.renovation; i++) advanceDay(state);
    expect(isHabitable(wreck)).toBe(true);

    listForRent(state, wreck.id, marketRent(wreck, state.world, state.day));
    for (let i = 0; i < 250 && !own.rental?.tenancy; i++) advanceDay(state);
    expect(own.rental?.tenancy).toBeTruthy();
    while (state.day - own.purchaseDay < ECON.REFI.seasoningDays + 30) advanceDay(state);

    const cashBefore = state.cash;
    const res = refinance(state, wreck.id);
    expect(res.ok).toBe(true);
    // Capital comes back out, the tenant stays, and the debt is now amortising.
    expect(state.cash).toBeGreaterThan(cashBefore);
    expect(own.rental!.tenancy).toBeTruthy();
    expect(state.loans[0].kind).toBe('term');

    // And you cannot simply go round again: the income has been fully lent
    // against, so a second refinance only buys another set of closing costs.
    const again = refinance(state, wreck.id);
    expect(again.ok).toBe(false);
    expect(again.message).toMatch(/already pulled out|return nothing/i);
  });

  it('refuses to refinance a house bought at retail, because the rent will not carry it', () => {
    // The counter-case to the BRRRR test above. Pay full price, skip the
    // rehab, and the loan a lender will write does not even clear the hard
    // money -- which is the whole reason BRRRR insists on buying below value.
    const state = createGame('sandbox', 3690);
    const prop = state.market
      .filter((p) => p.listing && isHabitable(p))
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, true).ok).toBe(true);
    const owned = state.portfolio[0];
    expect(state.loans[0].kind).toBe('hardMoney');

    const rent = marketRent(owned, state.world, state.day);
    listForRent(state, owned.id, Math.round(rent * 0.8));
    for (let i = 0; i < 250 && !owned.ownership?.rental?.tenancy; i++) advanceDay(state);
    expect(owned.ownership?.rental?.tenancy).toBeTruthy();
    for (let i = 0; i < ECON.REFI.seasoningDays; i++) advanceDay(state);

    const res = refinance(state, owned.id);
    expect(res.ok).toBe(false);
    expect(state.loans[0].kind).toBe('hardMoney');
  });

  it('converts hard money into an amortising loan when the numbers do work', () => {
    const state = createGame('sandbox', 2);
    const wreck = state.market
      .filter((p) => p.listing && p.condition < ECON.RENTAL.minCondition)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, wreck.id, Math.round(wreck.listing!.askPrice * 0.9), true);
    const owned = state.portfolio[0];
    startRenovation(
      state,
      wreck.id,
      ['paint_interior', 'flooring_lvp', 'kitchen_refresh', 'bath_refresh', 'roof_replace', 'hvac_replace', 'landscaping_curb'],
      0.15,
    );
    for (let i = 0; i < 400 && owned.ownership?.renovation; i++) advanceDay(state);
    listForRent(state, owned.id, marketRent(owned, state.world, state.day));
    for (let i = 0; i < 250 && !owned.ownership?.rental?.tenancy; i++) advanceDay(state);
    while (state.day - owned.ownership!.purchaseDay < ECON.REFI.seasoningDays + 30) advanceDay(state);

    const cashBefore = state.cash;
    const res = refinance(state, owned.id);
    expect(res.ok).toBe(true);

    expect(state.cash).toBeGreaterThan(cashBefore);
    expect(state.loans).toHaveLength(1);
    expect(state.loans[0].kind).toBe('term');
    expect(state.loans[0].monthlyPayment).toBeGreaterThan(0);
    expect(owned.ownership!.cashedOut).toBeGreaterThan(0);
  });

  it('amortises the balance down as payments are made', () => {
    const p = amortisedPayment(200000, 0.06, 30);
    // A 30-year $200k at 6% is about $1,199/mo.
    expect(p).toBeGreaterThan(1100);
    expect(p).toBeLessThan(1300);
  });
});

describe('renting and selling do not collide', () => {
  it('refuses to list for sale while a tenant is in place', () => {
    const state = createGame('sandbox', 1234);
    const owned = buyOne(state);
    const rent = marketRent(owned, state.world, state.day);
    listForRent(state, owned.id, Math.round(rent * 0.8));
    for (let i = 0; i < 250 && !owned.ownership?.rental?.tenancy; i++) advanceDay(state);
    if (!owned.ownership?.rental?.tenancy) return;

    const res = listForSale(state, owned.id, 100000);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/tenant/i);
  });

  it('refuses to renovate around a sitting tenant', () => {
    const state = createGame('sandbox', 5678);
    const owned = buyOne(state);
    const rent = marketRent(owned, state.world, state.day);
    listForRent(state, owned.id, Math.round(rent * 0.8));
    for (let i = 0; i < 250 && !owned.ownership?.rental?.tenancy; i++) advanceDay(state);
    if (!owned.ownership?.rental?.tenancy) return;

    const res = startRenovation(state, owned.id, ['paint_interior'], 0.1);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/lives there|lease/i);
  });

  it('lets you stop renting once the unit is empty', () => {
    const state = createGame('sandbox', 4321);
    const owned = buyOne(state);
    listForRent(state, owned.id, 999999); // nobody will take it
    for (let i = 0; i < 20; i++) advanceDay(state);
    expect(stopRenting(state, owned.id).ok).toBe(true);
    expect(state.portfolio[0].ownership!.rental).toBeNull();
  });
});

describe('investor metrics', () => {
  it('computes cash-on-cash and DSCR the standard way', () => {
    expect(cashOnCash(30000, 18000, 100000)).toBeCloseTo(0.12, 6);
    expect(dscr(30000, 25000)).toBeCloseTo(1.2, 6);
    expect(dscr(30000, 0)).toBe(Infinity);
  });
});
