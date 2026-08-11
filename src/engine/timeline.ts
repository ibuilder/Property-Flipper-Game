import { LEVELS_BY_ID } from './content';
import { campaignDayLimit } from './game';
import type { GameState, Money, PropertyId } from './types';

/**
 * The shape of a campaign, as spans on a common clock.
 *
 * A 450-day campaign was represented to the player by a single integer. Every
 * question about pacing -- how long did that renovation actually take, how
 * long did the last one sit unsold, was I ever running two at once, how much
 * of the clock have I spent doing nothing -- was unanswerable without reading
 * the whole log.
 *
 * Derived from the ledger and from live ownership rather than tracked
 * separately. The ledger is already the single choke point every dollar passes
 * through, so a span built from it cannot claim a renovation happened on days
 * when no renovation money moved.
 */

export type SpanKind = 'owned' | 'renovating' | 'listed' | 'let';

export interface TimelineSpan {
  kind: SpanKind;
  from: number;
  /** Exclusive. Equals `today` for anything still running. */
  to: number;
}

export interface TimelineLane {
  propertyId: PropertyId;
  address: string;
  spans: TimelineSpan[];
  /** Set once sold. */
  soldDay: number | null;
  profit: Money | null;
  /** Still held. */
  open: boolean;
}

export interface TimelineMarker {
  day: number;
  kind: 'buy' | 'sell' | 'setback';
  label: string;
}

export interface CampaignTimeline {
  fromDay: number;
  toDay: number;
  today: number;
  lanes: TimelineLane[];
  markers: TimelineMarker[];
  /** Days on which nothing at all was owned. The idle share of a campaign. */
  idleDays: number;
}

/** First and last day any money of a given category moved on a property. */
function ledgerSpan(
  state: GameState,
  propertyId: PropertyId,
  category: string,
): { from: number; to: number } | null {
  let from = Infinity;
  let to = -Infinity;
  for (const e of state.ledger) {
    if (e.propertyId !== propertyId || e.category !== category) continue;
    if (e.day < from) from = e.day;
    if (e.day > to) to = e.day;
  }
  return from === Infinity ? null : { from, to };
}

export function buildTimeline(state: GameState): CampaignTimeline {
  const today = state.day;
  const level = LEVELS_BY_ID[state.levelId];
  const limit = campaignDayLimit(state);
  // The sandbox has no clock, so the axis follows play with a little headroom
  // rather than pretending to an end that does not exist.
  const toDay = limit ?? Math.max(90, Math.ceil((today * 1.15) / 30) * 30);

  const lanes: TimelineLane[] = [];
  const markers: TimelineMarker[] = [];

  for (const deal of state.closedDeals) {
    const spans: TimelineSpan[] = [
      { kind: 'owned', from: deal.boughtDay, to: deal.soldDay },
    ];
    const reno = ledgerSpan(state, deal.propertyId, 'renovation');
    if (reno) spans.push({ kind: 'renovating', from: reno.from, to: reno.to });
    // Only when it was actually recorded. Deals closed before this was tracked
    // simply have no listing bar, rather than a plausible-looking invention.
    if (deal.listedDay != null) {
      spans.push({ kind: 'listed', from: deal.listedDay, to: deal.soldDay });
    }

    lanes.push({
      propertyId: deal.propertyId,
      address: deal.address,
      spans,
      soldDay: deal.soldDay,
      profit: deal.netProfit,
      open: false,
    });
    markers.push({ day: deal.boughtDay, kind: 'buy', label: `Bought ${deal.address}` });
    markers.push({
      day: deal.soldDay,
      kind: 'sell',
      label: `Sold ${deal.address} for ${deal.netProfit >= 0 ? '+' : ''}$${deal.netProfit.toLocaleString()}`,
    });
  }

  for (const prop of state.portfolio) {
    const own = prop.ownership;
    if (!own) continue;
    const spans: TimelineSpan[] = [{ kind: 'owned', from: own.purchaseDay, to: today }];

    const reno = ledgerSpan(state, prop.id, 'renovation');
    if (reno) {
      spans.push({
        kind: 'renovating',
        from: reno.from,
        // A job still running reaches today; a finished one stopped when the
        // last of its money moved.
        to: own.renovation ? today : reno.to,
      });
    }
    if (own.saleListing) {
      spans.push({ kind: 'listed', from: own.saleListing.listedDay, to: today });
    }
    if (own.rental?.tenancy) {
      spans.push({ kind: 'let', from: own.rental.tenancy.startedDay, to: today });
    }

    lanes.push({
      propertyId: prop.id,
      address: prop.address,
      spans,
      soldDay: null,
      profit: null,
      open: true,
    });
    markers.push({ day: own.purchaseDay, kind: 'buy', label: `Bought ${prop.address}` });
  }

  // Setbacks worth seeing on the axis: the days the campaign turned.
  for (const entry of state.log) {
    if (entry.tone !== 'bad') continue;
    markers.push({ day: entry.day, kind: 'setback', label: entry.message });
  }

  lanes.sort((a, b) => {
    const aStart = Math.min(...a.spans.map((s) => s.from));
    const bStart = Math.min(...b.spans.map((s) => s.from));
    return aStart - bStart;
  });

  // Days with nothing owned. The number that tells a player their capital sat
  // idle, which is invisible in a game measured only by profit per deal.
  let idleDays = 0;
  for (let d = 1; d <= today; d++) {
    const busy = lanes.some((l) =>
      l.spans.some((s) => s.kind === 'owned' && d >= s.from && d < Math.max(s.to, s.from + 1)),
    );
    if (!busy) idleDays += 1;
  }

  return {
    fromDay: 1,
    toDay: Math.max(toDay, today),
    today,
    lanes,
    markers,
    idleDays,
  };
}

/** How much of the clock so far had capital deployed. */
export function deploymentRate(t: CampaignTimeline): number {
  const elapsed = Math.max(1, t.today - t.fromDay + 1);
  return 1 - t.idleDays / elapsed;
}

export function describeDeployment(t: CampaignTimeline): string {
  const rate = deploymentRate(t);
  if (t.lanes.length === 0) {
    return 'Nothing bought yet. The clock is running either way.';
  }
  if (rate > 0.85) {
    return `Capital deployed ${Math.round(rate * 100)}% of the time. Very little of the clock wasted.`;
  }
  if (rate > 0.55) {
    return `Capital deployed ${Math.round(rate * 100)}% of the time. The idle stretches are where returns quietly go.`;
  }
  return `Capital sat idle ${t.idleDays} of ${t.today} days. A deal that returns 40% a year returns nothing on the months you were not in one.`;
}
