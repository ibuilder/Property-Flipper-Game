import { ECON, SELLER_TYPES_BY_ID } from './content';
import { pointsDiscount, rateDiscount } from './reputation';
import type {
  FinancePlan,
  FinancingKind,
  Loan,
  Money,
  Property,
  Reputation,
  WorldState,
} from './types';
import { loanRate } from './finance';

/**
 * The financing menu.
 *
 * Hard money was the only instrument in the game, which quietly taught that
 * the financing decision is binary -- borrow or don't. It is not. The same
 * house bought four different ways produces four different deals, and which
 * one is right depends on the schedule, the seller, and how much of the upside
 * you are willing to give away.
 *
 *   cash      No cost, no leverage. One deal at a time.
 *   hard money  Fast, expensive, and the balloon does not care whether you
 *              sold. Points come out of the wire on day one.
 *   private   Relationship money: cheaper points and rate, less of it, and
 *              only once you have a track record worth lending against.
 *   seller    The seller carries the note. Cheap and patient -- but they want
 *              a higher price in exchange, which is the oldest trade in the
 *              business: your price, my terms.
 *   partner   Somebody else's cash instead of debt. No interest, no balloon,
 *              nothing to default on -- and a permanent share of the profit,
 *              with their capital coming back before yours.
 *
 * The teaching point is that none of these is free and none is strictly best.
 * Debt costs money and can kill you on a slow sale; equity costs upside and
 * cannot.
 */

export interface FinanceQuote {
  kind: FinancingKind;
  label: string;
  /** What the instrument advances, or the partner contributes. */
  advance: Money;
  /** Cash you still need at closing. */
  cashRequired: Money;
  /** Up-front cost deducted from the advance. */
  points: Money;
  annualRate: number;
  /** Days until the whole thing comes due, if it is debt. */
  termDays: number;
  /** What the seller wants extra for carrying the note. */
  priceUplift: Money;
  /** Share of the profit an equity partner takes. */
  profitShare: number;
  available: boolean;
  /** Why not, when unavailable. */
  reason: string;
  /** One line on what this instrument costs you and when. */
  note: string;
}

/**
 * Which sellers will carry a note.
 *
 * Somebody who owns it free and clear and wants out is a candidate; somebody
 * who needs the cash to buy their next house is not, and a developer running
 * the same numbers you are will not hand you cheap money.
 */
export function sellerWillCarry(prop: Property): boolean {
  const terms = ECON.FINANCING.seller.willingSellers as readonly string[];
  return terms.includes(prop.sellerType);
}

export function quoteFinancing(
  kind: FinancingKind,
  prop: Property,
  price: Money,
  world: WorldState,
  reputation: Reputation,
  cashOnHand: Money,
): FinanceQuote {
  const closing = Math.round(price * ECON.BUY_CLOSING_RATE);

  switch (kind) {
    case 'cash':
      return {
        kind,
        label: 'All cash',
        advance: 0,
        cashRequired: price + closing,
        points: 0,
        annualRate: 0,
        termDays: 0,
        priceUplift: 0,
        profitShare: 0,
        available: cashOnHand >= price + closing,
        reason: 'You do not have the cash to close.',
        note: 'Nothing to service and nothing to default on. Also one deal at a time.',
      };

    case 'hardMoney': {
      const advance = Math.round(price * ECON.MAX_LTV);
      const pts = Math.round(advance * ECON.LOAN_POINTS * (1 - pointsDiscount(reputation.lenders)));
      return {
        kind,
        label: 'Hard money',
        advance,
        cashRequired: price - advance + closing,
        points: pts,
        annualRate: Math.max(0.02, loanRate(world) - rateDiscount(reputation.lenders)),
        termDays: ECON.LOAN_TERM_DAYS,
        priceUplift: 0,
        profitShare: 0,
        available: cashOnHand >= price - advance + closing,
        reason: 'Even with the advance you cannot cover the down payment and closing.',
        note: `Points come out of the wire on day one, and the balloon is due in ${ECON.LOAN_TERM_DAYS} days whether or not it has sold.`,
      };
    }

    case 'private': {
      const cfg = ECON.FINANCING.private;
      const advance = Math.round(price * cfg.maxLtv);
      const pts = Math.round(advance * cfg.points);
      const qualifies = reputation.lenders >= cfg.minReputation;
      return {
        kind,
        label: 'Private lender',
        advance,
        cashRequired: price - advance + closing,
        points: pts,
        annualRate: Math.max(0.02, world.interestRate + cfg.spread),
        termDays: cfg.termDays,
        priceUplift: 0,
        profitShare: 0,
        available: qualifies && cashOnHand >= price - advance + closing,
        reason: qualifies
          ? 'You cannot cover the larger down payment private money requires.'
          : `Private money is relationship money. You need a standing of ${cfg.minReputation} with lenders; you are at ${Math.round(reputation.lenders)}.`,
        note: `Cheaper than hard money in both points and rate, and it lends less. ${cfg.termDays} days, interest only.`,
      };
    }

    case 'seller': {
      const cfg = ECON.FINANCING.seller;
      const willing = sellerWillCarry(prop);
      // The trade: patient, cheap money in exchange for a fuller price. A
      // seller carrying paper is not doing you a favour, they are being paid
      // in interest and in price for the risk of not being cashed out.
      const uplift = Math.round(price * cfg.priceUplift);
      const fullPrice = price + uplift;
      const down = Math.round(fullPrice * cfg.downPayment);
      const advance = fullPrice - down;
      return {
        kind,
        label: 'Seller carries the note',
        advance,
        cashRequired: down + Math.round(fullPrice * ECON.BUY_CLOSING_RATE),
        points: 0,
        annualRate: Math.max(0.01, world.interestRate + cfg.spread),
        termDays: cfg.termDays,
        priceUplift: uplift,
        profitShare: 0,
        available:
          willing && cashOnHand >= down + Math.round(fullPrice * ECON.BUY_CLOSING_RATE),
        reason: willing
          ? 'You cannot cover the down payment the seller wants.'
          : `A ${SELLER_TYPES_BY_ID[prop.sellerType]?.name ?? 'seller'} will not carry paper. They want cashing out.`,
        note: `No points, a rate below hard money, and ${cfg.termDays} days to work with — bought by paying ${(cfg.priceUplift * 100).toFixed(0)}% more for the house. Price and terms are the same trade.`,
      };
    }

    case 'partner': {
      const cfg = ECON.FINANCING.partner;
      const needed = price + closing;
      const advance = Math.round(needed * cfg.contribution);
      return {
        kind,
        label: 'Equity partner',
        advance,
        cashRequired: needed - advance,
        points: 0,
        annualRate: 0,
        termDays: 0,
        priceUplift: 0,
        profitShare: cfg.profitShare,
        available: cashOnHand >= needed - advance,
        reason: 'You cannot cover your own half of the capital.',
        note: `No interest, no balloon, nothing to default on. They get their capital back before you get yours, then ${(cfg.profitShare * 100).toFixed(0)}% of whatever is left.`,
      };
    }
  }
}

/** Every option, in the order they should be shown. */
export function financingMenu(
  prop: Property,
  price: Money,
  world: WorldState,
  reputation: Reputation,
  cashOnHand: Money,
): FinanceQuote[] {
  const kinds: FinancingKind[] = ['cash', 'hardMoney', 'private', 'seller', 'partner'];
  return kinds.map((k) => quoteFinancing(k, prop, price, world, reputation, cashOnHand));
}

/** Turn a chosen quote into the loan it implies, if it is debt at all. */
export function loanFromQuote(
  id: string,
  propertyId: string,
  quote: FinanceQuote,
  day: number,
): Loan | null {
  if (quote.advance <= 0) return null;
  if (quote.kind === 'cash' || quote.kind === 'partner') return null;

  return {
    id,
    propertyId,
    kind:
      quote.kind === 'hardMoney'
        ? 'hardMoney'
        : quote.kind === 'private'
          ? 'private'
          : 'seller',
    principal: quote.advance,
    monthlyPayment: 0,
    pointsPaid: quote.points,
    annualRate: quote.annualRate,
    maturityDay: day + quote.termDays,
    interestAccrued: 0,
    originatedDay: day,
  };
}

/**
 * Split a sale between you and an equity partner.
 *
 * Capital first, then profit. Structuring it the other way -- a straight
 * percentage of gross proceeds -- would mean a partner profiting from a deal
 * that lost money, which is not how any of these are papered and would teach
 * something false about what equity costs.
 */
export function splitProceeds(
  netProceeds: Money,
  partnerCapital: Money,
  totalInvested: Money,
  profitShare: number,
): { toPartner: Money; toYou: Money; partnerProfit: Money } {
  // Return of capital comes first, and is capped by what there is.
  const capitalBack = Math.min(Math.max(0, netProceeds), partnerCapital);
  const profit = netProceeds - totalInvested;
  const partnerProfit = profit > 0 ? Math.round(profit * profitShare) : 0;
  const toPartner = Math.round(capitalBack + partnerProfit);
  return { toPartner, toYou: Math.round(netProceeds - toPartner), partnerProfit };
}

export function financePlanFromQuote(quote: FinanceQuote): FinancePlan {
  return { kind: quote.kind };
}
