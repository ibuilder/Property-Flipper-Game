import { dailyHoldingCost, dailyInterest, loanPayoff, sellingCosts } from './finance';
import { annualOpex } from './rental';
import type { GameState, Money, Property } from './types';

/**
 * What standing still costs, per day.
 *
 * This began as a cash-runway warning, on the strength of a note I wrote
 * during a playthrough saying that running out of money mid-renovation was the
 * most common way a campaign is lost. Then I measured it: across eight
 * campaigns of three hundred days, buying every deal that cleared the 70%
 * rule, there was not one occasion where the player could not afford to start
 * a job or fund the cheapest listing on the board. Zero refusals. Median free
 * cash covers the median job three times over. Liquidity does not bind in this
 * game as it is currently balanced, and a runway gauge would have sat on
 * permanent green -- furniture at best, and at worst teaching that a danger
 * exists where the model contains none.
 *
 * What the same measurements did show is worth a panel of its own. Carry and
 * financing together run 10.8% of profit before carry, and financing is three
 * and a half times the carry: $7,386 against $2,104 on a mean 48-day hold. One
 * deal held 184 days paid $23,103 in time costs against $5,837 of profit.
 *
 * And the larger half of that is invisible. Interest on an interest-only loan
 * accrues; it never appears in the cash balance and never shows up in the
 * ledger as money leaving. It is settled in full at closing, by which point
 * nothing can be done about it. That is the number this panel exists to show.
 *
 * Everything is computed from the same functions the daily tick uses, so the
 * figures cannot drift from what will actually happen:
 *
 *   burn         carry, mortgage payments and rental opex, net of rent. Cash
 *                genuinely leaving, every day, whether or not anything happens.
 *   accruing     interest piling up on interest-only debt. Not a cash drain
 *                today, which is exactly why it is the dangerous one.
 *   reserved     contingency budgeted against live jobs. Already committed and
 *                still sitting in the balance, so it flatters the cash figure.
 */

/** Same shape as the helper in explain.ts, which is module-private there. */
const money = (n: Money): string =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

export type RunwayStatus = 'renovating' | 'listed' | 'let' | 'vacant' | 'idle';

/** One property's contribution to the daily rate. */
export interface RunwayLine {
  propertyId: string;
  address: string;
  status: RunwayStatus;
  /** Taxes, insurance, utilities, HOA. */
  carry: Money;
  /** Cash actually leaving for debt each day. Interest-only loans pay nothing. */
  debtService: Money;
  /** Interest piling up on interest-only debt: owed, but not paid today. */
  accruing: Money;
  /** Rent in, less management and maintenance. Zero unless let and occupied. */
  netRent: Money;
  /** Contingency still held against a live job here. */
  reserved: Money;
  /** Net daily cash effect. Negative drains. */
  net: Money;
}

export interface CashRunway {
  cash: Money;
  /** Committed to live jobs but not yet paid out. */
  reserved: Money;
  /** What a new deal can actually draw on. */
  free: Money;
  /** Net cash leaving per day. Positive means the balance is falling. */
  burn: Money;
  /** Interest accruing per day without touching cash. */
  accruing: Money;
  /** Days until cash reaches zero at today's rate. Null when not burning. */
  days: number | null;
  /** Days until free cash reaches zero. Null when not burning. */
  freeDays: number | null;
  /** Net proceeds if everything currently listed sold at its ask today. */
  ifEverythingSold: Money;
  /** Whether anything is actually listed to produce those proceeds. */
  listedCount: number;
  lines: RunwayLine[];
}

function statusOf(prop: Property): RunwayStatus {
  const own = prop.ownership;
  if (!own) return 'idle';
  if (own.renovation) return 'renovating';
  if (own.saleListing) return 'listed';
  if (own.rental) return own.rental.tenancy ? 'let' : 'vacant';
  return 'idle';
}

export function cashRunway(state: GameState): CashRunway {
  const lines: RunwayLine[] = [];

  for (const prop of state.portfolio) {
    const own = prop.ownership;
    if (!own) continue;

    const carry = dailyHoldingCost(prop, state.world, state.day);

    let debtService = 0;
    let accruing = 0;
    const loan = state.loans.find((l) => l.id === own.loanId);
    if (loan) {
      // Mirrors the daily tick exactly: a term loan is actually paid, an
      // interest-only loan accrues and is settled at payoff.
      if (loan.kind === 'term') debtService = (loan.monthlyPayment * 12) / 365;
      else accruing = dailyInterest(loan);
    }

    let netRent = 0;
    const tenancy = own.rental?.tenancy;
    if (tenancy) {
      const gross = tenancy.rent * 12;
      netRent = gross / 365 - annualOpex(gross) / 365;
    }

    const reserved = own.renovation?.contingencyRemaining ?? 0;

    lines.push({
      propertyId: prop.id,
      address: prop.address,
      status: statusOf(prop),
      carry,
      debtService,
      accruing,
      netRent,
      reserved,
      net: netRent - carry - debtService,
    });
  }

  // Worst first: the thing to act on is the biggest drain, and a list sorted
  // by anything else buries it.
  lines.sort((a, b) => a.net - b.net);

  const reserved = Math.round(lines.reduce((s, l) => s + l.reserved, 0));
  const burn = lines.reduce((s, l) => s - l.net, 0);
  const accruing = lines.reduce((s, l) => s + l.accruing, 0);
  const cash = state.cash;
  const free = cash - reserved;

  const listed = state.portfolio.filter((p) => p.ownership?.saleListing);
  const ifEverythingSold = listed.reduce((sum, prop) => {
    const own = prop.ownership!;
    const ask = own.saleListing!.listPrice;
    const costs = sellingCosts(ask, state.reputation.agents);
    const loan = state.loans.find((l) => l.id === own.loanId);
    return sum + ask - costs.commission - costs.closing - (loan ? loanPayoff(loan) : 0);
  }, 0);

  // Only meaningful while actually burning. A portfolio that nets positive has
  // no runway to report and saying "infinite" invites exactly the complacency
  // this is here to prevent.
  const days = burn > 0.01 ? Math.floor(Math.max(0, cash) / burn) : null;
  const freeDays = burn > 0.01 ? Math.floor(Math.max(0, free) / burn) : null;

  return {
    cash,
    reserved,
    free,
    burn: Math.round(burn),
    accruing: Math.round(accruing),
    days,
    freeDays,
    ifEverythingSold: Math.round(ifEverythingSold),
    listedCount: listed.length,
    lines,
  };
}

/** How much of the day's cost is hidden from the cash balance. */
export type RunwayLevel = 'idle' | 'cheap' | 'costly' | 'bleeding';

/**
 * Graded on the total daily cost of holding, not on days of cash.
 *
 * Days-of-cash was the obvious axis and it is the wrong one: it measured
 * between 524 and 17,475 days across every sample taken, so every threshold
 * expressible in it is either never reached or always reached. Total daily
 * cost separates the cases that actually differ -- an unlevered house sitting
 * finished costs a few dollars a day, a leveraged one mid-job costs a couple
 * of hundred, and only the second is worth interrupting the player for.
 *
 * 'bleeding' is reserved for a genuine emergency: committed beyond the
 * balance, which is the one liquidity failure the model can still produce.
 */
export function runwayLevel(r: CashRunway): RunwayLevel {
  if (r.free < 0) return 'bleeding';
  const total = r.burn + r.accruing;
  if (total < 20) return 'idle';
  if (total < 120) return 'cheap';
  return 'costly';
}

/**
 * One sentence, and only when there is something to say.
 *
 * Leads on the accruing interest whenever it is the larger half, because it is
 * the half the player cannot see anywhere else -- the cash balance is silent
 * on it and it arrives whole at closing. Says nothing on a small unlevered
 * position: a warning that is always on is furniture, and the player stops
 * reading it well before the run where it would have mattered.
 */
export function describeRunway(r: CashRunway): string | null {
  if (r.free < 0) {
    return `You have committed ${money(-r.free)} more than you hold. The contingency on your live jobs is already spoken for, so the next change order comes out of money you do not have.`;
  }

  const total = r.burn + r.accruing;
  if (total < 20) return null;

  if (r.accruing > r.burn) {
    // Ninety days, because that is roughly the hold this game actually
    // produces and a per-day figure is too small to feel like anything.
    return `Holding costs ${money(total)} a day, and ${money(r.accruing)} of that never touches your balance — it is interest accruing on interest-only debt, settled in full at closing. Over a 90-day hold that is ${money(r.accruing * 90)} you will not see coming.`;
  }
  if (r.accruing > 0) {
    return `Holding costs ${money(total)} a day: ${money(r.burn)} leaving your account and ${money(r.accruing)} accruing quietly against the sale.`;
  }
  return `Holding costs ${money(total)} a day whether or not anything happens. Every day between finishing and selling is paid out of the profit.`;
}

