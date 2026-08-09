import { EVENTS_BY_ID, NEIGHBORHOODS_BY_ID } from './content';
import type { Money, NeighborhoodArc, WorldState } from './types';

/**
 * Multi-year neighborhood arcs, and events that lead somewhere.
 *
 * Two things were missing from the world model, and they are the same
 * complaint from different directions: nothing that happened had consequences
 * beyond its own duration.
 *
 * A revitalisation event nudged a neighborhood's index for sixty days and then
 * stopped, which is not what gentrification is. Real neighborhood change is
 * slow, directional, visible for years before it finishes, and it is the one
 * thing in this game where being early is worth more than being right about any
 * single house. An arc runs for several in-game years, moves the index a little
 * every day, and -- crucially -- is legible while it is happening, so buying
 * into it is a decision rather than a lottery.
 *
 * Event chains are the short-horizon version. A rate spike does not simply
 * expire: it makes a correction more likely, and a correction makes distressed
 * inventory more likely. Each link fires with a probability rather than a
 * certainty, so the chain is a tendency you can plan against, not a script you
 * can memorise.
 */

export type ArcKind = 'gentrifying' | 'declining';

export interface ArcDef {
  kind: ArcKind;
  name: string;
  /** What a player sees before it is obvious in the price. */
  earlySign: string;
  blurb: string;
  /** Daily drift applied to the neighborhood index at the peak of the arc. */
  peakDailyDrift: number;
  minDays: number;
  maxDays: number;
}

export const ARCS: Record<ArcKind, ArcDef> = {
  gentrifying: {
    kind: 'gentrifying',
    name: 'Gentrifying',
    earlySign: 'Two coffee shops, a bike lane, and permit filings up sharply.',
    blurb:
      'Money is moving in. Values climb for years, not weeks — but so does what you have to pay to get in, so the profit belongs to whoever bought before it was obvious.',
    peakDailyDrift: 0.00042,
    minDays: 700,
    maxDays: 1400,
  },
  declining: {
    kind: 'declining',
    name: 'Declining',
    earlySign: 'Two shopfronts boarded on the main street and the school roll falling.',
    blurb:
      'Money is leaving. A house bought here at today’s comps is worth less every month you hold it, and the comps you are underwriting against are already stale.',
    peakDailyDrift: -0.0003,
    minDays: 600,
    maxDays: 1200,
  },
};

/**
 * How strongly an arc is pulling today.
 *
 * Ramped in and out rather than switched on, because a neighborhood does not
 * begin gentrifying at full speed on a Tuesday. The shape also means the
 * middle of an arc is where the movement is, so noticing one early is worth
 * something and noticing one late is worth nothing.
 */
export function arcIntensity(arc: NeighborhoodArc, day: number): number {
  const elapsed = day - arc.startedDay;
  if (elapsed < 0 || elapsed > arc.totalDays) return 0;
  const t = elapsed / arc.totalDays;
  // A smooth hump: zero at both ends, one in the middle.
  return Math.sin(Math.PI * t);
}

export function arcDailyDrift(arc: NeighborhoodArc, day: number): number {
  return ARCS[arc.kind].peakDailyDrift * arcIntensity(arc, day);
}

/**
 * Whether the arc is far enough along to be visible on the ground.
 *
 * Deliberately later than the arc starts. The information the player is buying
 * is early, not free: for the first stretch there is nothing to see, and after
 * that the sign appears while there is still most of the move left.
 */
export function arcIsVisible(arc: NeighborhoodArc, day: number): boolean {
  return day - arc.startedDay >= arc.totalDays * 0.18;
}

export function describeArc(arc: NeighborhoodArc, day: number): string {
  const def = ARCS[arc.kind];
  const hood = NEIGHBORHOODS_BY_ID[arc.neighborhoodId]?.name ?? arc.neighborhoodId;
  if (!arcIsVisible(arc, day)) return '';
  return `${hood}: ${def.name.toLowerCase()}. ${def.earlySign}`;
}

// ---------------------------------------------------------------------------
// Event chains
// ---------------------------------------------------------------------------

/**
 * What each event tends to lead to, and how likely that is when it ends.
 *
 * Probabilities rather than certainties: a rate spike usually does not cause a
 * correction, and knowing that it sometimes does is the useful part. The chain
 * fires when the first link expires, so there is a lag you can act inside.
 */
export const EVENT_CHAINS: Record<string, { next: string; chance: number; why: string }[]> = {
  // Measured rather than guessed: chains cost the leverage campaign about five
  // points of win rate and the_grind about the same, which is a difficulty
  // increase worth having for a levered run that a correction is supposed to
  // hurt. A first pass appeared to cost three times that, but the harness was
  // sampling those campaigns over ten seeds, where two campaigns is a
  // twenty-point swing.
  rate_hike: [
    {
      next: 'correction',
      chance: 0.26,
      why: 'Buyers priced out at the higher rate stop clearing inventory.',
    },
  ],
  correction: [
    {
      next: 'employer_exit',
      chance: 0.16,
      why: 'A soft market is a bad time to be the marginal employer.',
    },
  ],
  housing_boom: [
    {
      next: 'lumber_spike',
      chance: 0.38,
      why: 'Everybody is building at once and the materials run short.',
    },
    {
      next: 'labor_shortage',
      chance: 0.34,
      why: 'Every decent sub is booked out for months.',
    },
  ],
  lumber_spike: [
    {
      next: 'permit_backlog',
      chance: 0.26,
      why: 'Work pulled forward to beat the price rise floods plan review.',
    },
  ],
  employer_exit: [
    {
      next: 'correction',
      chance: 0.2,
      why: 'The jobs going takes local demand with it.',
    },
  ],
  rate_cut: [
    {
      next: 'housing_boom',
      chance: 0.35,
      why: 'Cheaper money pulls buyers off the sidelines all at once.',
    },
  ],
};

/** Chain candidates for an event that has just expired. */
export function chainFrom(defId: string): { next: string; chance: number; why: string }[] {
  return (EVENT_CHAINS[defId] ?? []).filter((c) => EVENTS_BY_ID[c.next]);
}

/** Every active arc's effect on one neighborhood, summed. */
export function arcDriftFor(world: WorldState, neighborhoodId: string, day: number): number {
  let drift = 0;
  for (const arc of world.arcs) {
    if (arc.neighborhoodId !== neighborhoodId) continue;
    drift += arcDailyDrift(arc, day);
  }
  return drift;
}

/**
 * A rough sense of what an arc has done to a neighborhood so far, for the UI.
 * Integrating the hump exactly is not worth it; the midpoint rule is close
 * enough for a label.
 */
export function arcMoveSoFar(arc: NeighborhoodArc, day: number): number {
  const elapsed = Math.max(0, Math.min(arc.totalDays, day - arc.startedDay));
  const def = ARCS[arc.kind];
  // Mean of sin over [0, t] scaled by the peak.
  const t = elapsed / arc.totalDays;
  const meanIntensity = t <= 0 ? 0 : (1 - Math.cos(Math.PI * t)) / (Math.PI * t);
  return def.peakDailyDrift * meanIntensity * elapsed;
}

/** Value change on a property from an arc, in money, for explaining it. */
export function arcValueEffect(value: Money, arc: NeighborhoodArc, day: number): Money {
  return Math.round(value * arcMoveSoFar(arc, day));
}
