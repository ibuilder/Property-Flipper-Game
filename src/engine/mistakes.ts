import type { Money } from './types';

/**
 * Mistake-as-lesson cards.
 *
 * Adapted from the realmogul sibling project, including its tone rule, which is
 * the important part: the goal is "oh, I get it now", never "you failed". A
 * player who has just lost a house to a foreclosure does not need to be told
 * off; they need to know what the professionals do differently.
 *
 * Pure. These functions take plain facts and return a card. The game loop
 * decides *when* something has gone wrong; this module decides what to say
 * about it.
 */

export type LessonConcept =
  | 'seventy_rule'
  | 'comps'
  | 'inspection'
  | 'contingency'
  | 'carry'
  | 'leverage'
  | 'liquidity';

export interface LessonCard {
  id: string;
  title: string;
  whatHappened: string;
  howProsAvoid: string;
  concept: LessonConcept;
}

const money = (n: number): string =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

export function foreclosureCard(address: string, payoff: Money): LessonCard {
  return {
    id: `foreclosure_${address}`,
    title: 'The lender took the house',
    whatHappened:
      `The note on ${address} matured and the ${money(payoff)} balloon came due while the ` +
      `property was still unsold. Hard money does not wait for a buyer.`,
    howProsAvoid:
      'Match the loan term to a realistic schedule, not an optimistic one, and start marketing ' +
      'before the work is finished. If a sale is slipping, cutting the price early costs far ' +
      'less than losing the asset.',
    concept: 'leverage',
  };
}

export function contingencyBlownCard(address: string, overage: Money): LessonCard {
  return {
    id: `contingency_${address}`,
    title: 'The contingency ran out',
    whatHappened:
      `A change order on ${address} came in ${money(overage)} past what you had set aside, so ` +
      `the difference came straight out of cash with the crew already on site.`,
    howProsAvoid:
      'Reserve against the age and condition of the house, not a flat percentage. An older ' +
      'property with an unknown roof or unopened walls wants 20% or more, and the unused ' +
      'portion comes back to you anyway.',
    concept: 'contingency',
  };
}

export function concessionCard(address: string, concession: Money, repairCost: Money): LessonCard {
  return {
    id: `concession_${address}`,
    title: 'The buyer priced the defects you left',
    whatHappened:
      `The buyer's inspector found what yours would have, and took ${money(concession)} off ` +
      `${address} for repairs that would have cost about ${money(repairCost)} to do properly.`,
    howProsAvoid:
      'Cure known defects during the rehab, while you control the schedule and the price. ' +
      'Buyers do not charge you the repair cost, they charge you the repair cost plus the ' +
      'hassle of it being their problem.',
    concept: 'inspection',
  };
}

export function arvMissCard(address: string, projected: Money, actual: Money): LessonCard {
  const shortfall = projected - actual;
  return {
    id: `arv_${address}`,
    title: 'The ARV did not hold',
    whatHappened:
      `You underwrote ${address} at ${money(projected)} and it sold for ${money(actual)} — ` +
      `${money(shortfall)} short. Every other number in the deal was built on that figure.`,
    howProsAvoid:
      'Pick comps that match on size, area, recency and finish, and be suspicious of the ' +
      'flattering ones. When your comps disagree with each other the confidence range widens ' +
      'for a reason — that is the deal telling you it is a guess.',
    concept: 'comps',
  };
}

export function overpaidCard(address: string, paid: Money, mao: Money): LessonCard {
  return {
    id: `overpaid_${address}`,
    title: 'You paid over the ceiling',
    whatHappened:
      `${address} came in at ${money(paid)} against a maximum allowable offer of ${money(mao)} — ` +
      `${money(paid - mao)} over. The margin was spent before any work started.`,
    howProsAvoid:
      'The ceiling is not a target to negotiate towards, it is the point past which the deal ' +
      'stops working. There is always another house; the discipline is being willing to let ' +
      'this one go.',
    concept: 'seventy_rule',
  };
}

export function slowSaleCard(address: string, daysOnMarket: number, carry: Money): LessonCard {
  return {
    id: `slow_${address}`,
    title: 'It sat, and the carry ate it',
    whatHappened:
      `${address} spent ${daysOnMarket} days on the market and cost ${money(carry)} in taxes, ` +
      `insurance, utilities and interest while it waited.`,
    howProsAvoid:
      'Buyer traffic falls off a cliff above true value, so overpricing does not cost a little ' +
      'time, it costs months. Price to sell in weeks and take the certain smaller number.',
    concept: 'carry',
  };
}

export function insolvencyCard(): LessonCard {
  return {
    id: 'insolvency',
    title: 'Out of cash',
    whatHappened:
      'Carrying costs, debt service and renovation spend outran what you had in the bank.',
    howProsAvoid:
      'Keep a reserve that is not committed to a deal. Liquidity is what lets you survive a ' +
      'slow sale or a bad surprise and still be there for the next one.',
    concept: 'liquidity',
  };
}

/**
 * Pick the cards a completed deal has earned.
 *
 * Deliberately capped and ranked: three lessons is a review, seven is a
 * telling-off, and the tone rule only survives if we stay brief.
 */
export function cardsForDeal(facts: {
  address: string;
  projectedArv: Money;
  actualSalePrice: Money;
  concession: Money;
  daysOnMarket: number;
  holdingCosts: Money;
  purchasePrice: Money;
  mao70: Money;
}): LessonCard[] {
  const cards: { card: LessonCard; weight: number }[] = [];

  const arvShortfall = facts.projectedArv - facts.actualSalePrice;
  if (arvShortfall > facts.projectedArv * 0.06) {
    cards.push({
      card: arvMissCard(facts.address, facts.projectedArv, facts.actualSalePrice),
      weight: arvShortfall,
    });
  }

  if (facts.concession > 0) {
    cards.push({
      card: concessionCard(facts.address, facts.concession, facts.concession / 1.15),
      weight: facts.concession,
    });
  }

  const overpaid = facts.purchasePrice - facts.mao70;
  if (overpaid > 0) {
    cards.push({ card: overpaidCard(facts.address, facts.purchasePrice, facts.mao70), weight: overpaid });
  }

  if (facts.daysOnMarket > 90) {
    cards.push({
      card: slowSaleCard(facts.address, facts.daysOnMarket, facts.holdingCosts),
      weight: facts.holdingCosts,
    });
  }

  return cards
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => c.card);
}
