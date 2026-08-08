import type { Reputation, ReputationId } from './types';

/**
 * Standing with lenders, agents and contractors.
 *
 * Skills are bought with cash; reputation is earned by outcomes. That split
 * matters: money can buy you a better estimator, but nothing except a track
 * record gets a lender to drop a point. It is also the mechanism that makes a
 * fifth flip meaningfully easier than a first, which is what the genre
 * research points to for retention past the opening hours.
 *
 * All three sit on 0-100 and start at 50, so there is room to fall as well as
 * climb -- a foreclosure should cost you something durable.
 */

export const REPUTATION_META: Record<
  ReputationId,
  { name: string; blurb: string; effect: (v: number) => string }
> = {
  lenders: {
    name: 'Lenders',
    blurb:
      'Built by paying off notes and selling profitably; destroyed by a foreclosure. Buys cheaper money.',
    effect: (v) =>
      `${(pointsDiscount(v) * 100).toFixed(2)} pts off origination, ${(
        rateDiscount(v) * 100
      ).toFixed(2)}% off the rate`,
  },
  agents: {
    name: 'Agents',
    blurb:
      'Built by closing sales cleanly; eroded by withdrawing listings and cutting prices. Buys deal flow and a thinner commission.',
    effect: (v) =>
      `${(commissionDiscount(v) * 100).toFixed(2)}% lower commission, ${(
        pocketListingChance(v) * 100
      ).toFixed(1)}%/day chance of an off-market listing`,
  },
  contractors: {
    name: 'Contractors',
    blurb:
      'Built by finishing jobs you funded properly; eroded by running out of money mid-job. Buys fewer surprises and cheaper work.',
    effect: (v) =>
      `${(renovationDiscount(v) * 100).toFixed(1)}% cheaper work, ${(
        changeOrderReduction(v) * 100
      ).toFixed(0)}% fewer change orders`,
  },
};

export function initialReputation(): Reputation {
  return { lenders: 50, agents: 50, contractors: 50 };
}

/** Move a track, clamped. Returns the actual delta applied. */
export function adjustReputation(rep: Reputation, id: ReputationId, delta: number): number {
  const before = rep[id];
  rep[id] = Math.max(0, Math.min(100, before + delta));
  return rep[id] - before;
}

/** Normalised distance from the neutral starting point, -1 to +1. */
function scaled(v: number): number {
  return (v - 50) / 50;
}

// --- lenders ---------------------------------------------------------------

/** Fraction knocked off origination points. Up to half at perfect standing. */
export function pointsDiscount(v: number): number {
  return Math.max(-0.25, Math.min(0.5, scaled(v) * 0.5));
}

/** Absolute reduction in the annual rate, up to 1.5 points. */
export function rateDiscount(v: number): number {
  return Math.max(-0.0075, Math.min(0.015, scaled(v) * 0.015));
}

// --- agents ----------------------------------------------------------------

/** Absolute reduction in commission, up to 1 point off the standard 6%. */
export function commissionDiscount(v: number): number {
  return Math.max(-0.005, Math.min(0.01, scaled(v) * 0.01));
}

/**
 * Daily chance an agent brings something before it hits the open market.
 *
 * Pocket listings are the concrete payoff for agent standing: not a modifier
 * on a number, but access to deals other buyers never see.
 */
export function pocketListingChance(v: number): number {
  return Math.max(0, scaled(v) * 0.02);
}

// --- contractors -----------------------------------------------------------

export function renovationDiscount(v: number): number {
  return Math.max(-0.08, Math.min(0.12, scaled(v) * 0.12));
}

export function changeOrderReduction(v: number): number {
  return Math.max(-0.2, Math.min(0.4, scaled(v) * 0.4));
}

export function reputationLabel(v: number): { text: string; tone: string } {
  if (v >= 80) return { text: 'trusted', tone: 'good' };
  if (v >= 62) return { text: 'solid', tone: 'good' };
  if (v >= 40) return { text: 'unproven', tone: 'mute' };
  if (v >= 22) return { text: 'wary', tone: 'warn' };
  return { text: 'burned', tone: 'bad' };
}
