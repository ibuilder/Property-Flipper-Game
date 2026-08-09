import { ECON } from './content';
import { Rng } from './rng';
import type { Auction, AuctionLot, Money, Property, WorldState } from './types';
import { trueValue } from './valuation';

/**
 * Trustee sales: the other way to buy a house.
 *
 * A courthouse-step auction is not a faster version of the retail market, it
 * is a different trade with a different risk profile, and modelling it as
 * "the same house, cheaper" would teach the wrong lesson. The four things that
 * make it different are all here:
 *
 *   sight unseen   You cannot inspect. Not "an inspection costs more" -- you
 *                  cannot walk the property at all, so every defect stays
 *                  hidden until your own crew finds it.
 *   cash only      No financing. The full price is due immediately, which is
 *                  what keeps most buyers off the courthouse steps and is
 *                  where the discount actually comes from.
 *   as-is, occupied  Somebody may still be living there, and getting them out
 *                  costs money and months before you can start work.
 *   no going back  Once the hammer falls it is yours, defects and all. There
 *                  is no inspection contingency to renegotiate under.
 *
 * The bidding itself is a proxy auction: you set a maximum, rivals bid against
 * it, and if you win you pay one increment above the runner-up rather than
 * your maximum. That is how these actually run, and it means an honest
 * maximum is never punished -- which is exactly the discipline the game is
 * trying to teach everywhere else.
 */

/**
 * The opening bid, which is the lender's credit bid: what they are owed, not
 * what the house is worth. A property with a small remaining balance opens far
 * below value, which is where the bargains hide -- and also why the crowd is
 * bigger there.
 */
export function openingBid(prop: Property, world: WorldState, day: number, rng: Rng): Money {
  const value = trueValue(prop, world, day);
  // Owed anywhere from a third to nearly all of value.
  const owed = rng.float(ECON.AUCTION.minOpeningRatio, ECON.AUCTION.maxOpeningRatio);
  return Math.max(1000, Math.round(value * owed));
}

export function createAuctionLot(
  prop: Property,
  world: WorldState,
  day: number,
  rng: Rng,
): AuctionLot {
  const value = trueValue(prop, world, day);
  const opening = openingBid(prop, world, day, rng);

  // How many rivals turn up tracks how obviously cheap the opening bid is.
  // A lot opening at 35% of value draws a crowd; one opening at 90% draws
  // nobody, and those are the ones that go back to the lender.
  const discount = 1 - opening / Math.max(1, value);
  const interest = Math.max(0, Math.min(1, discount * 1.5 + rng.float(-0.15, 0.15)));

  return {
    propertyId: prop.id,
    openingBid: opening,
    saleDay: day + rng.int(ECON.AUCTION.minNoticeDays, ECON.AUCTION.maxNoticeDays),
    rivalInterest: interest,
    occupied: rng.chance(ECON.AUCTION.occupiedChance),
    myMaxBid: null,
    result: null,
  };
}

/**
 * What the rival bidders will go to.
 *
 * Professionals at a trustee sale are disciplined -- they have their own
 * maximum and they stop. The spread of that ceiling is what makes the auction
 * winnable at all: on a quiet lot the crowd stops well short of value, on a
 * contested one they push it past what a flip can carry.
 */
export function rivalCeiling(
  lot: AuctionLot,
  value: Money,
  rng: Rng,
): Money {
  if (rng.chance(ECON.AUCTION.noShowChance * (1 - lot.rivalInterest))) {
    // Nobody else came. The lot goes at the opening bid if you want it.
    return 0;
  }
  // Interest scales how close to value the room will go.
  const ceilingRatio =
    ECON.AUCTION.baseCeiling + lot.rivalInterest * ECON.AUCTION.interestCeilingRange;
  const jitter = rng.float(-0.07, 0.07);
  return Math.round(value * Math.max(0.25, ceilingRatio + jitter));
}

/**
 * Settle one lot.
 *
 * Returns what the player pays, or null if they did not win. Paying one
 * increment above the runner-up rather than your own maximum is the whole
 * point of a proxy bid: bidding your true ceiling costs you nothing when the
 * room is quiet, so there is never a reason to shade it.
 */
export function settleAuction(
  lot: AuctionLot,
  value: Money,
  cashAvailable: Money,
  rng: Rng,
): { won: boolean; price: Money; underbid: Money } {
  const rivals = rivalCeiling(lot, value, rng);
  const mine = lot.myMaxBid ?? 0;

  // No bid, or a bid you could not actually fund. A trustee sale wants
  // certified funds on the day; there is no "subject to financing".
  if (mine < lot.openingBid || mine > cashAvailable) {
    return { won: false, price: 0, underbid: Math.max(rivals, lot.openingBid) };
  }

  const runnerUp = Math.max(rivals, lot.openingBid - ECON.AUCTION.increment);
  if (rivals >= mine) {
    return { won: false, price: 0, underbid: rivals };
  }

  const price = Math.min(mine, Math.max(lot.openingBid, runnerUp + ECON.AUCTION.increment));
  return { won: true, price, underbid: rivals };
}

/** Cost and delay of getting a holdover occupant out. */
export function evictionCost(prop: Property, world: WorldState, day: number): Money {
  // Scales a little with the property, because a bigger house means more to
  // clear out and a longer stay to fund.
  const value = trueValue(prop, world, day);
  return Math.round(ECON.AUCTION.evictionBase + value * ECON.AUCTION.evictionRate);
}

/** A blank auction board. */
export function createAuction(): Auction {
  return { lots: [], nextRefreshDay: 0 };
}
