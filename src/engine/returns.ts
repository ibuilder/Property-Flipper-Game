import type { LedgerEntry, Money, PropertyId } from './types';

/**
 * Time-adjusted returns: what a deal earned per unit of time and capital.
 *
 * The game already computed an annualised figure, but only once, at the sale,
 * in one column of the track record -- which is after every decision that
 * could have been informed by it. Absolute profit was the number the player
 * actually saw while choosing, and absolute profit cannot tell these two deals
 * apart:
 *
 *   $22,000 profit on $70,000 of cash in 96 days   -> about 119% a year
 *   $22,000 profit on $70,000 of cash in 412 days  -> about 28% a year
 *
 * They are not the same business. One compounds several times a year; the
 * other ties up the only capital a first-time flipper has for over a year to
 * earn roughly what an index fund would. Every professional curriculum in this
 * field is built around exactly this distinction, and pricing time is the
 * thing beginners most reliably fail to do.
 */

/**
 * Annualised return, the simple way: scale the period return to a year.
 *
 * This is the industry shorthand and it is what the track record has always
 * reported, so it stays -- changing the formula would silently reprice every
 * deal already in a player's history against a different definition.
 *
 * It overstates short holds, because it assumes the capital is redeployed
 * instantly and repeatedly on identical terms. That assumption is worth
 * stating to the player rather than hiding: "if you could do this all year"
 * is exactly the comparison being made, and exactly the part that is hard.
 */
export function annualisedRoi(profit: Money, cashInvested: Money, daysHeld: number): number {
  if (cashInvested <= 0 || daysHeld <= 0) return 0;
  return (profit / cashInvested) * (365 / daysHeld);
}

/**
 * Compounded annual growth on the capital, which is the honest version of the
 * same question and the one to use when comparing two deals of very different
 * lengths.
 *
 * Returns -1 for a wipeout rather than NaN: losing everything is a real
 * outcome and the caller should be able to render it.
 */
export function compoundedAnnualReturn(
  profit: Money,
  cashInvested: Money,
  daysHeld: number,
): number {
  if (cashInvested <= 0 || daysHeld <= 0) return 0;
  const multiple = 1 + profit / cashInvested;
  if (multiple <= 0) return -1;
  return Math.pow(multiple, 365 / daysHeld) - 1;
}

/**
 * Equity multiple: total cash back divided by total cash in.
 *
 * Deliberately not time-adjusted -- that is the point of quoting it beside a
 * rate. A 1.4x that took four months and a 1.4x that took three years are the
 * same multiple and wildly different investments, and seeing both numbers
 * together is what makes that obvious.
 */
export function equityMultiple(profit: Money, cashInvested: Money): number {
  if (cashInvested <= 0) return 0;
  return (cashInvested + profit) / cashInvested;
}

export interface DatedFlow {
  day: number;
  amount: Money;
}

/**
 * Internal rate of return over irregularly dated cash flows.
 *
 * Worth the trouble because a flip is the only case where a single annualised
 * number is sufficient. The moment a property is let, refinanced, or partly
 * cashed out, the money arrives in pieces at different times and only an IRR
 * can weigh them -- a cash-on-cash figure is a snapshot of one month, and the
 * BRRRR path had no time-weighted measure at all before this.
 *
 * Solved by bisection rather than Newton's method: no derivative to get wrong,
 * no divergence on the badly-behaved series a losing deal produces, and the
 * cost is irrelevant at this size.
 */
export function xirr(flows: readonly DatedFlow[], guessBounds = [-0.9999, 100]): number | null {
  if (flows.length < 2) return null;

  const sorted = [...flows].sort((a, b) => a.day - b.day);
  const start = sorted[0].day;
  const hasPositive = sorted.some((f) => f.amount > 0);
  const hasNegative = sorted.some((f) => f.amount < 0);
  // Without a sign change there is no root, and pretending otherwise would
  // hand back a confident number for a series that has no rate of return.
  if (!hasPositive || !hasNegative) return null;

  const npv = (rate: number): number =>
    sorted.reduce((sum, f) => {
      const years = (f.day - start) / 365;
      return sum + f.amount / Math.pow(1 + rate, years);
    }, 0);

  let [lo, hi] = guessBounds;
  let fLo = npv(lo);
  let fHi = npv(hi);
  if (Number.isNaN(fLo) || Number.isNaN(fHi) || fLo * fHi > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-9) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Every cash movement attributable to one property, in order.
 *
 * Built from the ledger rather than tracked separately, so it cannot drift
 * away from what actually happened to the bank balance -- the ledger is
 * already the single choke point every dollar passes through.
 */
export function propertyCashFlows(
  ledger: readonly LedgerEntry[],
  propertyId: PropertyId,
): DatedFlow[] {
  return ledger
    .filter((e) => e.propertyId === propertyId && e.amount !== 0)
    .map((e) => ({ day: e.day, amount: e.amount }));
}

/**
 * What holding this one more day costs, in both currencies that matter.
 *
 * The dollar figure was already visible. The return figure is the one that
 * changes behaviour: it makes the difference between a scope that finishes in
 * six weeks and one that finishes in ten legible at the moment of choosing,
 * rather than in the post-mortem.
 */
export function costOfADay(
  profitIfSoldToday: Money,
  cashInvested: Money,
  daysHeldSoFar: number,
  dailyCarry: Money,
): { dollars: Money; roiDelta: number } {
  if (cashInvested <= 0 || daysHeldSoFar <= 0) {
    return { dollars: Math.round(dailyCarry), roiDelta: 0 };
  }
  const today = annualisedRoi(profitIfSoldToday, cashInvested, daysHeldSoFar);
  const tomorrow = annualisedRoi(profitIfSoldToday - dailyCarry, cashInvested, daysHeldSoFar + 1);
  return { dollars: Math.round(dailyCarry), roiDelta: tomorrow - today };
}

/**
 * How a deal reads once time is priced in. One shape, so every surface that
 * shows a return shows the same three numbers in the same order.
 */
export interface ReturnProfile {
  profit: Money;
  cashInvested: Money;
  days: number;
  /** Simple annualisation, matching the track record. */
  annualised: number;
  /** Compounded, for comparing deals of different lengths. */
  compounded: number;
  multiple: number;
  /** Null when the cash flows have no sign change to solve against. */
  irr: number | null;
}

export function returnProfile(
  profit: Money,
  cashInvested: Money,
  days: number,
  flows?: readonly DatedFlow[],
): ReturnProfile {
  return {
    profit,
    cashInvested,
    days,
    annualised: annualisedRoi(profit, cashInvested, days),
    compounded: compoundedAnnualReturn(profit, cashInvested, days),
    multiple: equityMultiple(profit, cashInvested),
    irr: flows ? xirr(flows) : null,
  };
}

/**
 * A plain-language read on whether the capital was well used.
 *
 * Anchored to what the money could have done elsewhere rather than to an
 * arbitrary scale. A flip that returns less than a broad index fund is not a
 * disaster, but it is a lot of work and risk for nothing, and that is the
 * judgement the game should be helping the player make.
 */
export function verdictOnReturn(annualised: number): {
  tone: 'strong' | 'fair' | 'thin' | 'loss';
  text: string;
} {
  if (annualised <= 0) {
    return { tone: 'loss', text: 'Lost money. The time was spent as well as the capital.' };
  }
  if (annualised < 0.1) {
    return {
      tone: 'thin',
      text: 'Below what the money would have earned sitting in an index fund, for considerably more work and risk.',
    };
  }
  if (annualised < 0.25) {
    return {
      tone: 'fair',
      text: 'A real return, but thinner than the risk of a flip is usually worth.',
    };
  }
  return {
    tone: 'strong',
    text: 'A strong return on the capital and the time it was tied up for.',
  };
}
