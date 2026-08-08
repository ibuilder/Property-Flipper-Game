import { ECON, NEIGHBORHOODS_BY_ID } from './content';
import { inspectionConcession } from './market';
import { trueValue } from './valuation';
import type { GameState, Loan, Money, Property, WorldState } from './types';

/**
 * Every dollar of cost that is not the purchase price or the renovation.
 *
 * This module exists because the original game had none of it, and its absence
 * is exactly why that version could not teach flipping: without closing costs,
 * financing points, daily carry and a 6% commission, "buy at value, sell at
 * value" looks free. It is not. On a typical deal these line items consume
 * most of the 30% haircut the 70% rule reserves.
 */

export function buyClosingCosts(purchasePrice: Money): Money {
  return Math.round(purchasePrice * ECON.BUY_CLOSING_RATE);
}

export function sellingCosts(salePrice: Money): { commission: Money; closing: Money } {
  return {
    commission: Math.round(salePrice * ECON.COMMISSION_RATE),
    closing: Math.round(salePrice * ECON.SELL_CLOSING_RATE),
  };
}

/** What a hard money lender will advance against a given purchase price. */
export function maxLoanAmount(purchasePrice: Money): Money {
  return Math.round(purchasePrice * ECON.MAX_LTV);
}

export function loanRate(world: WorldState): number {
  return world.interestRate + ECON.LOAN_SPREAD;
}

export function originateLoan(
  id: string,
  propertyId: string,
  principal: Money,
  world: WorldState,
  day: number,
): { loan: Loan; netProceeds: Money } {
  const pointsPaid = Math.round(principal * ECON.LOAN_POINTS);
  const loan: Loan = {
    id,
    propertyId,
    principal,
    pointsPaid,
    annualRate: loanRate(world),
    maturityDay: day + ECON.LOAN_TERM_DAYS,
    interestAccrued: 0,
    originatedDay: day,
  };
  // Points are deducted from the funding wire, which is how it works in
  // practice -- you never see that money.
  return { loan, netProceeds: principal - pointsPaid };
}

/** Interest-only daily accrual on the outstanding principal. */
export function dailyInterest(loan: Loan): Money {
  return (loan.principal * loan.annualRate) / 365;
}

/** Total payoff required to release the lien today. */
export function loanPayoff(loan: Loan): Money {
  return Math.round(loan.principal + loan.interestAccrued);
}

/**
 * Daily cost of simply owning the thing: taxes, insurance, utilities, HOA.
 * This is the number that punishes a slow sale.
 */
export function dailyHoldingCost(prop: Property, world: WorldState, day: number): Money {
  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  if (!hood) return 0;
  const value = trueValue(prop, world, day);
  const tax = (value * hood.taxRate) / 365;
  const insurance = (value * ECON.INSURANCE_RATE) / 365;
  const utilities = ECON.UTILITIES_MONTHLY / 30.44;
  const hoa = hood.hoaMonthly / 30.44;
  return tax + insurance + utilities + hoa;
}

/** Sum of every liability the player owes right now. */
export function totalDebt(state: GameState): Money {
  return state.loans.reduce((sum, l) => sum + loanPayoff(l), 0);
}

/**
 * Net worth = cash + liquidation value of the portfolio - debt.
 *
 * Inventory is marked at what it would actually net if sold today: true value
 * less commission, seller closing, and any concession a buyer's inspector
 * would extract. Marking at gross value instead lets a player "win" on paper
 * while holding a house they have never proved they can sell, which defeats
 * the point of a game about completing the round trip.
 *
 * True value is used rather than the player's own estimate so the win
 * condition cannot be gamed by being deliberately wrong.
 */
export function netWorth(state: GameState): Money {
  const portfolioValue = state.portfolio.reduce((sum, p) => {
    const gross = trueValue(p, state.world, state.day);
    const saleCosts = gross * (ECON.COMMISSION_RATE + ECON.SELL_CLOSING_RATE);
    return sum + Math.max(0, gross - saleCosts - inspectionConcession(p));
  }, 0);
  return Math.round(state.cash + portfolioValue - totalDebt(state));
}

/** Cost to buy the next level of a skill. */
export function skillCost(currentLevel: number): Money {
  return Math.round(ECON.SKILL_BASE_COST * Math.pow(ECON.SKILL_COST_FACTOR, currentLevel));
}
