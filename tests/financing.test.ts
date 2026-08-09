import { describe, expect, it } from 'vitest';
import {
  ECON,
  acceptOffer,
  advanceDay,
  createGame,
  financingMenu,
  listForSale,
  makeOffer,
  quoteFinancing,
  sellerWillCarry,
  splitProceeds,
  startRenovation,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

function cheapest(state: ReturnType<typeof createGame>) {
  return state.market
    .filter((p) => p.listing)
    .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
}

describe('the financing menu', () => {
  it('offers five instruments, and prices each differently', () => {
    const state = createGame('sandbox', 5);
    const prop = cheapest(state);
    const menu = financingMenu(prop, 150_000, state.world, state.reputation, state.cash);

    expect(menu.map((q) => q.kind)).toEqual([
      'cash',
      'hardMoney',
      'private',
      'seller',
      'partner',
    ]);
    // Cash needs the most cash; every form of leverage needs less.
    const cash = menu.find((q) => q.kind === 'cash')!;
    for (const q of menu.filter((x) => x.kind !== 'cash')) {
      expect(q.cashRequired).toBeLessThan(cash.cashRequired);
    }
  });

  it('makes private money cheaper than hard money, and smaller', () => {
    const state = createGame('sandbox', 6);
    const prop = cheapest(state);
    const rep = { ...state.reputation, lenders: 90 };
    const hard = quoteFinancing('hardMoney', prop, 200_000, state.world, rep, 1e9);
    const priv = quoteFinancing('private', prop, 200_000, state.world, rep, 1e9);

    expect(priv.annualRate).toBeLessThan(hard.annualRate);
    expect(priv.points).toBeLessThan(hard.points);
    expect(priv.advance).toBeLessThan(hard.advance);
    expect(priv.termDays).toBeGreaterThan(hard.termDays);
  });

  it('refuses private money to a stranger', () => {
    const state = createGame('sandbox', 7);
    const prop = cheapest(state);
    const q = quoteFinancing(
      'private',
      prop,
      200_000,
      state.world,
      { ...state.reputation, lenders: 30 },
      1e9,
    );
    expect(q.available).toBe(false);
    expect(q.reason).toMatch(/standing/i);
  });

  it('charges for seller paper in the price, not the rate', () => {
    const state = createGame('sandbox', 8);
    const carrier = state.market.find((p) => p.listing && sellerWillCarry(p));
    if (!carrier) return;

    const q = quoteFinancing('seller', carrier, 200_000, state.world, state.reputation, 1e9);
    const hard = quoteFinancing('hardMoney', carrier, 200_000, state.world, state.reputation, 1e9);

    expect(q.priceUplift).toBeGreaterThan(0);
    expect(q.annualRate).toBeLessThan(hard.annualRate);
    expect(q.points).toBe(0);
    expect(q.termDays).toBeGreaterThan(hard.termDays);
  });

  it('will not find a seller to carry when the seller wants cashing out', () => {
    const state = createGame('sandbox', 9);
    const unwilling = state.market.find((p) => p.listing && !sellerWillCarry(p));
    if (!unwilling) return;
    const q = quoteFinancing('seller', unwilling, 200_000, state.world, state.reputation, 1e9);
    expect(q.available).toBe(false);
    expect(q.reason).toMatch(/carry paper/i);
  });

  it('takes no interest from a partner, and a share of the profit instead', () => {
    const state = createGame('sandbox', 10);
    const prop = cheapest(state);
    const q = quoteFinancing('partner', prop, 200_000, state.world, state.reputation, 1e9);
    expect(q.annualRate).toBe(0);
    expect(q.termDays).toBe(0);
    expect(q.profitShare).toBeCloseTo(ECON.FINANCING.partner.profitShare, 6);
  });
});

describe('splitting proceeds with a partner', () => {
  it('returns capital first, then shares the profit', () => {
    // Put in 100k, deal cost 250k all-in, sold netting 300k: 50k of profit.
    const s = splitProceeds(300_000, 100_000, 250_000, 0.35);
    expect(s.partnerProfit).toBe(17_500);
    expect(s.toPartner).toBe(117_500);
    expect(s.toYou).toBe(182_500);
    expect(s.toPartner + s.toYou).toBe(300_000);
  });

  it('gives a partner no profit share on a deal that lost money', () => {
    const s = splitProceeds(230_000, 100_000, 250_000, 0.35);
    expect(s.partnerProfit).toBe(0);
    expect(s.toPartner).toBe(100_000); // capital back, nothing more
    // The loss lands entirely on you, which is what equity costs the sponsor.
    expect(s.toYou).toBe(130_000);
  });

  it('cannot pay a partner more than the deal actually produced', () => {
    const s = splitProceeds(60_000, 100_000, 250_000, 0.35);
    expect(s.toPartner).toBeLessThanOrEqual(60_000);
    expect(s.toYou).toBeGreaterThanOrEqual(0);
  });
});

describe('buying with each instrument', () => {
  it('still accepts the old boolean shorthand', () => {
    const a = createGame('sandbox', 11);
    const propA = cheapest(a);
    expect(makeOffer(a, propA.id, propA.listing!.askPrice, false).ok).toBe(true);
    expect(a.loans).toHaveLength(0);

    const b = createGame('sandbox', 11);
    const propB = cheapest(b);
    expect(makeOffer(b, propB.id, propB.listing!.askPrice, true).ok).toBe(true);
    expect(b.loans[0].kind).toBe('hardMoney');
  });

  it('records a partner on the deal and settles them at the sale', () => {
    const state = createGame('sandbox', 12);
    const prop = cheapest(state);
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, 'partner').ok).toBe(true);

    const own = state.portfolio[0].ownership!;
    expect(own.partner).not.toBeNull();
    expect(own.partner!.capital).toBeGreaterThan(0);
    expect(state.loans).toHaveLength(0); // equity, not debt

    startRenovation(state, prop.id, ['paint_interior', 'landscaping_curb'], 0.1);
    for (let i = 0; i < 200 && own.renovation; i++) advanceDay(state);
    listForSale(state, prop.id, Math.round(prop.appraisal.point * 0.95));

    let offerId: string | null = null;
    for (let i = 0; i < 300 && !offerId; i++) {
      advanceDay(state);
      offerId = own.saleListing?.offers[0]?.id ?? null;
    }
    if (!offerId) return;

    const cashBefore = state.cash;
    expect(acceptOffer(state, prop.id, offerId).ok).toBe(true);
    expect(state.cash).toBeGreaterThan(cashBefore);
    // The partner settlement is on the ledger, not silently absorbed.
    expect(state.ledger.some((e) => e.description.includes('Partner settlement'))).toBe(true);
  });

  it('pays more for the house when the seller carries the note', () => {
    const state = createGame('sandbox', 13);
    const carrier = state.market.find((p) => p.listing && sellerWillCarry(p));
    if (!carrier) return;
    const asked = carrier.listing!.askPrice;
    const res = makeOffer(state, carrier.id, asked, 'seller');
    if (!res.ok) return; // the reserve may still refuse on this seed

    const own = state.portfolio[0].ownership!;
    expect(own.purchasePrice).toBeGreaterThan(asked);
    expect(state.loans[0].kind).toBe('seller');
    expect(state.loans[0].pointsPaid).toBe(0);
  });
});
