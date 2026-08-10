import { ECON, NEIGHBORHOODS_BY_ID } from './content';
import { dailyHoldingCost, loanRate } from './finance';
import type { Money, Property, SkillId, WorldState } from './types';
import { quoteScope } from './renovation';

/**
 * The Deal Analyzer.
 *
 * This is the teaching surface of the game. It runs the two calculations a
 * real flipper runs before making an offer:
 *
 *   1. The 70% rule -- the back-of-envelope screen.
 *        MAO = (ARV x 0.70) - repairs
 *      The 30% haircut is not profit. It is closing costs, financing points,
 *      months of carry, and a 6% commission, with profit as whatever survives.
 *
 *   2. The itemised version -- what the 70% is standing in for.
 *        MAO = ARV - repairs - buy costs - carry - financing - sell costs - profit
 *      When these two disagree, the itemised one is right, and the gap is the
 *      lesson: the rule of thumb is calibrated for a typical deal, and an
 *      atypical one (expensive neighborhood, long schedule, high rates) breaks it.
 */

export interface AnalyzerInputs {
  arv: Money;
  repairEstimate: Money;
  /** Days of renovation work planned. */
  renovationDays: number;
  /** Days expected on market after the work is done. */
  marketingDays: number;
  /** Fraction of ARV the player wants to clear as profit. */
  targetProfitRate: number;
  /** Whether the purchase will be financed with hard money. */
  useFinancing: boolean;
}

export interface CostBreakdown {
  purchase: Money;
  buyClosing: Money;
  repairs: Money;
  holding: Money;
  financing: Money;
  commission: Money;
  sellClosing: Money;
  totalCost: Money;
  profit: Money;
  /**
   * What a lender would advance, or zero for a cash purchase.
   *
   * Exposed because return has to be measured against the cash actually tied
   * up rather than against the price, and leverage is exactly what makes those
   * two numbers differ -- the same profit on a quarter of the cash is a very
   * different result, which is the whole argument for borrowing and the whole
   * risk of it.
   */
  loan: Money;
}

export interface DealAnalysis {
  arv: Money;
  repairEstimate: Money;
  /** Maximum allowable offer per the 70% rule. */
  mao70: Money;
  /** Maximum allowable offer per the itemised cost stack. */
  maoDetailed: Money;
  holdDays: number;
  /** Estimated daily carrying cost at ARV. */
  dailyCarry: Money;
  /** Verdict on a specific offer, when one is supplied. */
  breakdown: CostBreakdown | null;
  verdict: 'strong' | 'fair' | 'thin' | 'loss' | null;
  /**
   * The assembled inputs and the rate used, so a caller can re-run the same
   * projection under different assumptions.
   *
   * Exposed rather than recomputed by the caller because a stress test built
   * from slightly different inputs than the analysis it sits beneath would be
   * confidently, invisibly wrong -- which is worse than not having one.
   */
  inputs: AnalyzerInputs;
  loanRate: number;
}

/** The classic screen: 70% of ARV, less repairs. */
export function rule70Mao(arv: Money, repairEstimate: Money): Money {
  return Math.round(arv * ECON.RULE_OF_THUMB - repairEstimate);
}

/**
 * Solve for the highest purchase price that still clears the target profit.
 *
 * Everything except the purchase price is either fixed or a function of ARV,
 * so this rearranges to a closed form. Buy-side closing costs scale with the
 * purchase price, hence dividing through by (1 + BUY_CLOSING_RATE).
 */
export function detailedMao(
  inputs: AnalyzerInputs,
  dailyCarry: Money,
  rate: number,
): Money {
  const holdDays = inputs.renovationDays + inputs.marketingDays;
  const carry = dailyCarry * holdDays;
  const sellSide = inputs.arv * (ECON.COMMISSION_RATE + ECON.SELL_CLOSING_RATE);
  const targetProfit = inputs.arv * inputs.targetProfitRate;

  // Financing costs depend on the loan, which depends on the price we are
  // solving for. Anchor the estimate on the 70% rule figure; it is close
  // enough for a pre-offer screen and avoids a circular solve.
  let financing = 0;
  if (inputs.useFinancing) {
    const anchor = Math.max(0, rule70Mao(inputs.arv, inputs.repairEstimate));
    const principal = anchor * ECON.MAX_LTV;
    financing = principal * ECON.LOAN_POINTS + (principal * rate * holdDays) / 365;
  }

  const numerator =
    inputs.arv - sellSide - inputs.repairEstimate - carry - financing - targetProfit;
  return Math.round(numerator / (1 + ECON.BUY_CLOSING_RATE));
}

/** Full projected P&L for a specific offer price. */
export function projectDeal(
  offer: Money,
  inputs: AnalyzerInputs,
  dailyCarry: Money,
  rate: number,
): CostBreakdown {
  const holdDays = inputs.renovationDays + inputs.marketingDays;
  const buyClosing = Math.round(offer * ECON.BUY_CLOSING_RATE);
  const holding = Math.round(dailyCarry * holdDays);

  let financing = 0;
  let loan = 0;
  if (inputs.useFinancing) {
    loan = Math.round(offer * ECON.MAX_LTV);
    financing = Math.round(loan * ECON.LOAN_POINTS + (loan * rate * holdDays) / 365);
  }

  const commission = Math.round(inputs.arv * ECON.COMMISSION_RATE);
  const sellClosing = Math.round(inputs.arv * ECON.SELL_CLOSING_RATE);

  const totalCost =
    offer + buyClosing + inputs.repairEstimate + holding + financing + commission + sellClosing;

  return {
    purchase: offer,
    buyClosing,
    repairs: inputs.repairEstimate,
    holding,
    financing,
    commission,
    sellClosing,
    totalCost,
    profit: Math.round(inputs.arv - totalCost),
    loan,
  };
}

function verdictFor(profit: Money, arv: Money): DealAnalysis['verdict'] {
  if (arv <= 0) return null;
  const margin = profit / arv;
  if (margin >= 0.15) return 'strong';
  if (margin >= 0.08) return 'fair';
  if (margin > 0) return 'thin';
  return 'loss';
}

/**
 * Run the analyzer for a property the player is considering.
 *
 * `plannedScope` drives both the repair estimate and the schedule, so the
 * analyzer updates live as the player adds and removes line items. That
 * feedback loop -- watching MAO fall as you add a full kitchen gut -- is the
 * whole point.
 */
export function analyzeDeal(
  prop: Property,
  world: WorldState,
  day: number,
  arv: Money,
  plannedScope: readonly string[],
  skills: Record<SkillId, number>,
  options: {
    offer?: Money;
    targetProfitRate?: number;
    useFinancing?: boolean;
    knownDefectCost?: Money;
  } = {},
): DealAnalysis {
  const quote = quoteScope(plannedScope, prop, world, skills);
  const repairEstimate = quote.totalCost + (options.knownDefectCost ?? 0);

  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  const marketingDays = Math.round(45 / Math.max(0.4, hood?.demand ?? 1));

  const inputs: AnalyzerInputs = {
    arv,
    repairEstimate,
    renovationDays: quote.totalDays,
    marketingDays,
    targetProfitRate: options.targetProfitRate ?? 0.15,
    useFinancing: options.useFinancing ?? false,
  };

  // Carry is estimated against the finished house, which is the conservative
  // read -- taxes and insurance are assessed on the improved value.
  const dailyCarry = dailyHoldingCost(
    { ...prop, condition: 0.95 },
    world,
    day,
  );
  const rate = loanRate(world);

  const breakdown =
    options.offer !== undefined ? projectDeal(options.offer, inputs, dailyCarry, rate) : null;

  return {
    arv,
    repairEstimate,
    mao70: rule70Mao(arv, repairEstimate),
    maoDetailed: detailedMao(inputs, dailyCarry, rate),
    holdDays: inputs.renovationDays + inputs.marketingDays,
    dailyCarry: Math.round(dailyCarry),
    breakdown,
    verdict: breakdown ? verdictFor(breakdown.profit, arv) : null,
    inputs,
    loanRate: rate,
  };
}
