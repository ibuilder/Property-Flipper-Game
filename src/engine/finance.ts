import { ECON, NEIGHBORHOODS_BY_ID } from './content';
import { inspectionConcession } from './market';
import { commissionDiscount, pointsDiscount, rateDiscount } from './reputation';
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

/**
 * Commission and seller-side closing on a sale.
 *
 * Agent standing is a parameter rather than something the caller applies
 * afterwards, because it was applied in only one of the two places: the engine
 * charged the discounted rate while the offer cards previewed the flat one, so
 * the panel whose entire job is comparing offers was wrong by exactly the
 * benefit the player had earned.
 */
export function sellingCosts(
  salePrice: Money,
  agentReputation = 50,
): { commission: Money; closing: Money; rate: number } {
  const rate = ECON.COMMISSION_RATE - commissionDiscount(agentReputation);
  return {
    commission: Math.round(salePrice * rate),
    closing: Math.round(salePrice * ECON.SELL_CLOSING_RATE),
    rate,
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
  /** Lender standing, 0-100. A track record is what buys cheaper money. */
  lenderReputation = 50,
): { loan: Loan; netProceeds: Money } {
  const points = ECON.LOAN_POINTS * (1 - pointsDiscount(lenderReputation));
  const pointsPaid = Math.round(principal * points);
  const loan: Loan = {
    id,
    propertyId,
    kind: 'hardMoney',
    principal,
    // Interest-only: the whole principal comes due at the balloon.
    monthlyPayment: 0,
    pointsPaid,
    annualRate: Math.max(0.02, loanRate(world) - rateDiscount(lenderReputation)),
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

/** Standard amortising payment. */
export function amortisedPayment(principal: Money, annualRate: number, years: number): Money {
  const r = annualRate / 12;
  const n = years * 12;
  if (r <= 0) return Math.round(principal / n);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -n)));
}

export interface RefinanceQuote {
  /** What the lender will advance, after both tests. */
  maxLoan: Money;
  /** Which test bound the loan -- the thing the player can actually act on. */
  binding: 'ltv' | 'dscr';
  maxByLtv: Money;
  maxByDscr: Money;
  rate: number;
  monthlyPayment: Money;
  /** Existing debt that has to be cleared first. */
  payoff: Money;
  closingCosts: Money;
  /** What actually lands in the player's account. */
  cashOut: Money;
  dscrAtMax: number;
  eligible: boolean;
  reason: string;
}

/**
 * Size a cash-out refinance.
 *
 * Two independent tests, and the smaller wins: loan-to-value caps how much of
 * the asset a lender will lend against, and debt service coverage caps how
 * much the *income* can carry. A property can be worth plenty and still fail
 * on DSCR, which is the single most useful thing this screen teaches -- equity
 * is not the same as borrowing capacity.
 */
export function quoteRefinance(args: {
  value: Money;
  annualNoi: Money;
  existingPayoff: Money;
  baseRate: number;
  lenderReputation?: number;
  daysOwned: number;
}): RefinanceQuote {
  const rate = Math.max(
    0.02,
    args.baseRate + ECON.REFI.spread - rateDiscount(args.lenderReputation ?? 50),
  );
  const maxByLtv = Math.round(args.value * ECON.REFI.maxLtv);

  // Largest principal whose payment the NOI still covers at the required ratio.
  const affordableAnnualService = args.annualNoi / ECON.REFI.minDscr;
  const monthlyRate = rate / 12;
  const n = ECON.REFI.termYears * 12;
  const factor = monthlyRate > 0 ? monthlyRate / (1 - Math.pow(1 + monthlyRate, -n)) : 1 / n;
  const maxByDscr = Math.max(0, Math.round(affordableAnnualService / 12 / factor));

  const maxLoan = Math.min(maxByLtv, maxByDscr);
  const binding = maxByDscr < maxByLtv ? 'dscr' : 'ltv';
  const monthlyPayment = amortisedPayment(maxLoan, rate, ECON.REFI.termYears);
  const closingCosts = Math.round(maxLoan * ECON.REFI.closingRate);
  const cashOut = Math.round(maxLoan - args.existingPayoff - closingCosts);

  const seasoned = args.daysOwned >= ECON.REFI.seasoningDays;
  const coversPayoff = maxLoan >= args.existingPayoff;

  return {
    maxLoan,
    binding,
    maxByLtv,
    maxByDscr,
    rate,
    monthlyPayment,
    payoff: args.existingPayoff,
    closingCosts,
    cashOut,
    dscrAtMax: monthlyPayment > 0 ? args.annualNoi / (monthlyPayment * 12) : Infinity,
    eligible: seasoned && coversPayoff && maxLoan > 0,
    reason: !seasoned
      ? `Lenders want ${ECON.REFI.seasoningDays} days of ownership before refinancing. ${
          ECON.REFI.seasoningDays - args.daysOwned
        } to go.`
      : !coversPayoff
        ? 'The new loan would not even clear the existing debt. Raise the income or the value first.'
        : maxLoan <= 0
          ? 'The income does not support a loan at all yet.'
          : binding === 'dscr'
            ? `Bound by DSCR: the income supports ${maxLoan.toLocaleString()} even though the value would allow ${maxByLtv.toLocaleString()}.`
            : `Bound by LTV at ${(ECON.REFI.maxLtv * 100).toFixed(0)}% of value.`,
  };
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
