import { NEIGHBORHOODS_BY_ID } from './content';
import { netWorth } from './finance';
import { jobDaysRemaining } from './renovation';
import type { GameState, Money } from './types';

/**
 * What changed while you were skipping.
 *
 * The measured problem: 97% of days in a campaign produce no log line at all,
 * with silent stretches of up to 131 days. A player pressing "+30d" is told
 * nothing unless something dramatic happened, so waiting -- which is a real
 * and often correct strategy, because listings get cheaper as they sit -- felt
 * like the game had stopped responding.
 *
 * The fix is not to invent events. Plenty was already happening: the market
 * index moved, sellers got more realistic, carry accumulated, the crew got
 * closer to finishing. All of it was real, and all of it was invisible. This
 * diffs two moments and says what actually moved, so time passing becomes
 * information rather than an empty progress bar.
 */

export interface WorldSnapshot {
  day: number;
  cash: Money;
  netWorth: Money;
  marketIndex: number;
  interestRate: number;
  ledgerLength: number;
  /** Asking prices, so price cuts can be spotted. */
  asks: Record<string, { address: string; ask: Money }>;
  neighborhoodIndex: Record<string, number>;
}

export function snapshotWorld(state: GameState): WorldSnapshot {
  const asks: WorldSnapshot['asks'] = {};
  for (const p of state.market) {
    if (p.listing) asks[p.id] = { address: p.address, ask: p.listing.askPrice };
  }
  return {
    day: state.day,
    cash: state.cash,
    netWorth: netWorth(state),
    marketIndex: state.world.marketIndex,
    interestRate: state.world.interestRate,
    ledgerLength: state.ledger.length,
    asks,
    neighborhoodIndex: { ...state.world.neighborhoodIndex },
  };
}

export interface PriceCut {
  address: string;
  from: Money;
  to: Money;
}

export interface TimeDigest {
  days: number;
  fromDay: number;
  toDay: number;
  /** Everything the portfolio cost to simply own over the window. */
  carryPaid: Money;
  netWorthDelta: Money;
  marketIndexDelta: number;
  rateDelta: number;
  newListings: number;
  /** Listings that went under contract to somebody else. */
  listingsLost: number;
  /**
   * The ones you were actually following, by name.
   *
   * A count of listings lost is a statistic; the address of the one you had
   * starred is the sentence that changes what you do next.
   */
  watchedLost: string[];
  /** The largest reduction on anything still available. */
  biggestCut: PriceCut | null;
  cutCount: number;
  /** Neighborhood that moved most, either way. */
  moverId: string | null;
  moverDelta: number;
  /** Work still running, and how much longer. */
  jobsRunning: { address: string; daysLeft: number }[];
  /** Properties sitting on the market, and for how long. */
  onMarket: { address: string; daysOnMarket: number }[];
}

export function buildDigest(before: WorldSnapshot, state: GameState): TimeDigest {
  const days = state.day - before.day;

  // Carry is summed from the ledger rather than estimated, so it is exactly
  // what left the account.
  const carryPaid = state.ledger
    .slice(before.ledgerLength)
    .filter((e) => e.category === 'holding')
    .reduce((s, e) => s + e.amount, 0);

  let biggestCut: PriceCut | null = null;
  let cutCount = 0;
  let newListings = 0;

  for (const p of state.market) {
    if (!p.listing) continue;
    const was = before.asks[p.id];
    if (!was) {
      newListings += 1;
      continue;
    }
    const drop = was.ask - p.listing.askPrice;
    if (drop > 0) {
      cutCount += 1;
      if (!biggestCut || drop > biggestCut.from - biggestCut.to) {
        biggestCut = { address: p.address, from: was.ask, to: p.listing.askPrice };
      }
    }
  }

  const stillListed = new Set(state.market.filter((p) => p.listing).map((p) => p.id));
  const gone = Object.keys(before.asks).filter((id) => !stillListed.has(id));
  const listingsLost = gone.length;
  // Named, not counted. The digest already reported how many listings went to
  // somebody else, which told the player nothing about whether it mattered.
  const watchedLost = gone
    .filter((id) => state.watched.includes(id))
    .map((id) => before.asks[id].address);

  let moverId: string | null = null;
  let moverDelta = 0;
  for (const [id, now] of Object.entries(state.world.neighborhoodIndex)) {
    const was = before.neighborhoodIndex[id];
    if (was === undefined) continue;
    const d = now - was;
    if (Math.abs(d) > Math.abs(moverDelta)) {
      moverDelta = d;
      moverId = id;
    }
  }

  const jobsRunning = state.portfolio
    .filter((p) => p.ownership?.renovation)
    .map((p) => ({
      address: p.address,
      daysLeft: jobDaysRemaining(p.ownership!.renovation!),
    }));

  const onMarket = state.portfolio
    .filter((p) => p.ownership?.saleListing)
    .map((p) => ({
      address: p.address,
      daysOnMarket: p.ownership!.saleListing!.daysOnMarket,
    }));

  return {
    days,
    fromDay: before.day,
    toDay: state.day,
    carryPaid: Math.round(carryPaid),
    netWorthDelta: netWorth(state) - before.netWorth,
    marketIndexDelta: state.world.marketIndex - before.marketIndex,
    rateDelta: state.world.interestRate - before.interestRate,
    newListings,
    listingsLost,
    watchedLost,
    biggestCut,
    cutCount,
    moverId,
    moverDelta,
    jobsRunning,
    onMarket,
  };
}

/**
 * Whether this digest is worth showing at all.
 *
 * A one-day step has nothing to summarise, and a digest that appears saying
 * "nothing happened" every time trains people to ignore it -- which would
 * waste the one surface that makes waiting legible.
 */
export function digestWorthShowing(d: TimeDigest): boolean {
  if (d.days < 2) return false;
  return (
    d.cutCount > 0 ||
    d.newListings > 0 ||
    d.watchedLost.length > 0 ||
    d.listingsLost > 0 ||
    Math.abs(d.carryPaid) > 0 ||
    Math.abs(d.marketIndexDelta) > 0.004 ||
    Math.abs(d.rateDelta) > 0.0015 ||
    d.jobsRunning.length > 0 ||
    d.onMarket.length > 0
  );
}

/**
 * One line naming the most useful thing that happened.
 *
 * Ordered by what should change a decision, not by size: a price cut on a
 * house you could buy matters more than a rate wobble, and a job finishing
 * matters more than either.
 */
export function digestHeadline(d: TimeDigest): string {
  const nearlyDone = d.jobsRunning.filter((j) => j.daysLeft <= 0);
  if (nearlyDone.length > 0) {
    return `Work finished on ${nearlyDone[0].address}.`;
  }
  if (d.biggestCut) {
    const cut = d.biggestCut.from - d.biggestCut.to;
    return `${d.biggestCut.address} came down $${cut.toLocaleString()} to $${d.biggestCut.to.toLocaleString()}.`;
  }
  if (d.watchedLost.length > 0) {
    // Ahead of the count, because this is the one the player cared about.
    return d.watchedLost.length === 1
      ? `${d.watchedLost[0]} went to another buyer. You were watching that one.`
      : `${d.watchedLost.join(' and ')} both went to other buyers while you waited.`;
  }
  if (d.listingsLost > 0) {
    return `${d.listingsLost} listing${d.listingsLost === 1 ? '' : 's'} went to another buyer while you waited.`;
  }
  if (d.newListings > 0) {
    return `${d.newListings} new listing${d.newListings === 1 ? '' : 's'} came on.`;
  }
  if (d.moverId && Math.abs(d.moverDelta) > 0.01) {
    const name = NEIGHBORHOODS_BY_ID[d.moverId]?.name ?? d.moverId;
    return `${name} moved ${d.moverDelta > 0 ? 'up' : 'down'} ${Math.abs(d.moverDelta * 100).toFixed(1)}%.`;
  }
  if (d.onMarket.length > 0) {
    const worst = [...d.onMarket].sort((a, b) => b.daysOnMarket - a.daysOnMarket)[0];
    return `${worst.address} has been on the market ${worst.daysOnMarket} days.`;
  }
  return 'Quiet. Listings are staler, which is worth something.';
}
