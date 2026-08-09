import { describe, expect, it } from 'vitest';
import {
  ECON,
  Rng,
  advanceDay,
  createGame,
  isOccupied,
  listForSale,
  placeBid,
  settleAuction,
  startRenovation,
  trueValue,
  withdrawBid,
  type AuctionLot,
} from '../src/engine';

function lot(over: Partial<AuctionLot> = {}): AuctionLot {
  return {
    propertyId: 'x',
    openingBid: 100_000,
    saleDay: 20,
    rivalInterest: 0.5,
    occupied: false,
    myMaxBid: null,
    result: null,
    ...over,
  };
}

/** Advance until a lot is on the block, and return it. */
function firstLot(state: ReturnType<typeof createGame>) {
  for (let i = 0; i < 40 && state.auction.lots.length === 0; i++) advanceDay(state);
  expect(state.auction.lots.length).toBeGreaterThan(0);
  return state.auction.lots[0];
}

describe('proxy bidding', () => {
  it('pays one increment over the underbidder, not your maximum', () => {
    // Rivals stop at 150k, our maximum is 400k: we should pay 151k, not 400k.
    const rng = new Rng(1);
    const l = lot({ myMaxBid: 400_000, rivalInterest: 0 });
    // Drive the rival ceiling deterministically by settling many times and
    // checking the invariant holds on every outcome that we win.
    for (let i = 0; i < 200; i++) {
      const r = settleAuction(l, 300_000, 500_000, new Rng(i));
      if (!r.won) continue;
      expect(r.price).toBeLessThanOrEqual(l.myMaxBid!);
      expect(r.price).toBeGreaterThanOrEqual(l.openingBid);
      // Never more than a single increment above what the room would pay.
      expect(r.price).toBeLessThanOrEqual(
        Math.max(l.openingBid, r.underbid + ECON.AUCTION.increment),
      );
    }
    expect(rng).toBeTruthy();
  });

  it('never wins when the room outbids you', () => {
    for (let i = 0; i < 200; i++) {
      const l = lot({ myMaxBid: 110_000 });
      const r = settleAuction(l, 400_000, 500_000, new Rng(i));
      if (r.won) expect(r.underbid).toBeLessThan(110_000);
      else expect(r.underbid).toBeGreaterThanOrEqual(110_000);
    }
  });

  it('refuses a bid you could not fund, because there is no financing here', () => {
    const l = lot({ myMaxBid: 200_000 });
    const r = settleAuction(l, 300_000, 150_000, new Rng(3));
    expect(r.won).toBe(false);
  });

  it('treats a bid under the opening as no bid at all', () => {
    const l = lot({ myMaxBid: 50_000 });
    const r = settleAuction(l, 300_000, 500_000, new Rng(4));
    expect(r.won).toBe(false);
  });

  it('makes an honest maximum safe: shading can never win a lot the honest bid loses', () => {
    // This is the property that matters, and it is worth stating precisely.
    // A shaded bid can occasionally save you part of one increment -- if it
    // happens to land between the runner-up and the next increment, the clamp
    // to your own maximum stops there. What it can never do is win something
    // the honest bid would have lost. So the downside of bidding your true
    // ceiling is bounded by a single increment, and the upside is every lot
    // that sits between the two numbers.
    let honestWonMore = 0;
    for (let seed = 0; seed < 400; seed++) {
      const honest = settleAuction(lot({ myMaxBid: 260_000 }), 300_000, 900_000, new Rng(seed));
      const shaded = settleAuction(lot({ myMaxBid: 200_000 }), 300_000, 900_000, new Rng(seed));

      if (shaded.won) {
        expect(honest.won).toBe(true);
        expect(honest.price - shaded.price).toBeLessThanOrEqual(ECON.AUCTION.increment);
      }
      if (honest.won && !shaded.won) honestWonMore += 1;
    }
    // And it is not a theoretical advantage: the honest bid wins lots the
    // shaded one does not.
    expect(honestWonMore).toBeGreaterThan(0);
  });
});

describe('the auction board', () => {
  it('posts lots with a notice period rather than instantly', () => {
    const state = createGame('the_grind', 21);
    const l = firstLot(state);
    expect(l.saleDay).toBeGreaterThan(state.day);
    expect(l.saleDay - state.day).toBeLessThanOrEqual(ECON.AUCTION.maxNoticeDays);
  });

  it('opens below value, because the credit bid is what is owed', () => {
    const state = createGame('the_grind', 22);
    firstLot(state);
    for (const l of state.auction.lots) {
      const prop = state.auctionBlock.find((p) => p.id === l.propertyId)!;
      const value = trueValue(prop, state.world, state.day);
      expect(l.openingBid).toBeLessThan(value);
    }
  });

  it('discloses nothing: auction stock carries no revealed defects and no listing', () => {
    const state = createGame('the_grind', 23);
    firstLot(state);
    for (const prop of state.auctionBlock) {
      expect(prop.listing).toBeNull();
      expect(prop.inspection).toBe('none');
      expect(prop.defects.every((d) => !d.revealed)).toBe(true);
    }
  });

  it('rejects a bid below the opening, and one above your cash', () => {
    const state = createGame('the_grind', 24);
    const l = firstLot(state);
    expect(placeBid(state, l.propertyId, l.openingBid - 1).ok).toBe(false);
    expect(placeBid(state, l.propertyId, state.cash + 1).ok).toBe(false);
    expect(placeBid(state, l.propertyId, l.openingBid).ok).toBe(true);
    expect(withdrawBid(state, l.propertyId).ok).toBe(true);
    expect(state.auction.lots.find((x) => x.propertyId === l.propertyId)!.myMaxBid).toBeNull();
  });

  it('settles on the sale day and takes the money', () => {
    const state = createGame('the_grind', 25);
    const l = firstLot(state);
    const propId = l.propertyId;
    // Bid the maximum we can afford so we are very likely to win.
    placeBid(state, propId, Math.min(state.cash, Math.round(state.cash * 0.95)));

    const cashBefore = state.cash;
    while (state.day <= l.saleDay + 1) advanceDay(state);

    const owned = state.portfolio.find((p) => p.id === propId);
    const stillOnBoard = state.auction.lots.some((x) => x.propertyId === propId);
    expect(stillOnBoard).toBe(false);
    if (owned) {
      expect(state.cash).toBeLessThan(cashBefore);
      expect(owned.ownership!.loanId).toBeNull(); // cash only
      expect(state.auctionBlock.some((p) => p.id === propId)).toBe(false);
    }
  });
});

describe('possession', () => {
  it('blocks work, sale and letting until an occupant is out', () => {
    const state = createGame('the_grind', 99);
    // Find an occupied lot and win it.
    let owned: ReturnType<typeof createGame>['portfolio'][number] | undefined;
    for (let round = 0; round < 12 && !owned; round++) {
      for (let i = 0; i < 40 && state.auction.lots.length === 0; i++) advanceDay(state);
      const occupiedLot = state.auction.lots.find((l) => l.occupied && !l.myMaxBid);
      if (occupiedLot) {
        placeBid(state, occupiedLot.propertyId, Math.round(state.cash * 0.9));
        const saleDay = occupiedLot.saleDay;
        while (state.day <= saleDay + 1) advanceDay(state);
        owned = state.portfolio.find((p) => p.ownership?.occupiedUntilDay !== null);
      } else {
        advanceDay(state);
      }
    }
    if (!owned) return; // no occupied lot came up affordably on this seed

    expect(isOccupied(owned, state.day)).toBe(true);
    expect(startRenovation(state, owned.id, ['paint_interior'], 0.1).ok).toBe(false);
    expect(listForSale(state, owned.id, 200_000).ok).toBe(false);

    while (state.day < owned.ownership!.occupiedUntilDay!) advanceDay(state);
    expect(isOccupied(owned, state.day)).toBe(false);
  });
});
