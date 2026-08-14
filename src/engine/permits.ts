import { SCOPE_BY_ID } from './content';
import { eventModifiers } from './events';
import type { Rng } from './rng';
import type { ScopeLineItem, WorldState } from './types';

/**
 * Permits, and the queue you wait in for them.
 *
 * The one system from the handoff that was genuinely missing, and it is worth
 * having for a specific reason rather than for completeness: every other delay
 * in this game is something you chose. A slow crew is a price you accepted, a
 * long marketing period is a price you set. The permit queue is the first
 * delay that is simply imposed, and learning that some of the clock is not
 * yours to manage is a real part of the job.
 *
 * Only structural, systems and addition work is pulled. Paint and flooring are
 * not, which is what makes the scope decision interesting: a cosmetic
 * refresh starts on Monday, and the moment you touch the wiring you are in a
 * queue behind everybody else who touched theirs.
 *
 * -- On balance --
 *
 * This *does* move the harness, and it is meant to: it adds days, days are
 * carry, and carry is profit. The handoff says balance must not move and also
 * asks for permits, which cannot both hold. Treated as a deliberate
 * re-baseline rather than a regression, with the old and new numbers recorded
 * in the commit.
 */

/** Categories a city wants to look at before you start. */
const PERMITTED = new Set(['structural', 'systems', 'addition']);

export interface PermitStatus {
  /** Whether this scope needs one at all. */
  required: boolean;
  /** Days spent waiting so far. */
  daysWaited: number;
  /** Total queue length drawn when the job started. */
  queueDays: number;
  /** The trades that triggered it, for the UI to name. */
  reasons: string[];
}

/** Does this scope need a permit, and for what? */
export function permitReasons(lines: readonly ScopeLineItem[]): string[] {
  const out = new Set<string>();
  for (const line of lines) {
    const def = SCOPE_BY_ID[line.itemId];
    if (def && PERMITTED.has(def.category)) out.add(def.name);
  }
  return [...out];
}

/**
 * How long the office takes.
 *
 * Drawn once when work starts rather than ticked down probabilistically, so
 * the player can be *told* the number and plan against it. A queue whose
 * length you only discover by waiting is not a decision, it is weather.
 *
 * The permit-backlog event stretches it, which is the first time that event
 * has done anything a player can see -- it previously only nudged a time
 * multiplier they had no way to attribute.
 */
export function drawPermitQueue(world: WorldState, rng: Rng, neighborhoodId?: string): number {
  const mods = eventModifiers(world, neighborhoodId);
  const base = rng.int(5, 16);
  return Math.max(1, Math.round(base * mods.timeMultiplier));
}

export function newPermit(
  lines: readonly ScopeLineItem[],
  world: WorldState,
  rng: Rng,
  neighborhoodId?: string,
): PermitStatus {
  const reasons = permitReasons(lines);
  return {
    required: reasons.length > 0,
    daysWaited: 0,
    queueDays: reasons.length > 0 ? drawPermitQueue(world, rng, neighborhoodId) : 0,
    reasons,
  };
}

/** Has the office come back yet? */
export function permitIssued(permit: PermitStatus | null | undefined): boolean {
  if (!permit || !permit.required) return true;
  return permit.daysWaited >= permit.queueDays;
}

/** Days still to wait, for the UI. */
export function permitDaysLeft(permit: PermitStatus | null | undefined): number {
  if (permitIssued(permit)) return 0;
  return Math.max(0, permit!.queueDays - permit!.daysWaited);
}

/**
 * One sentence on where the permit is.
 *
 * Names the trades that caused it, because the lesson is that the *scope*
 * chose this, not the dice.
 */
export function describePermit(permit: PermitStatus | null | undefined): string | null {
  if (!permit || !permit.required) return null;
  if (permitIssued(permit)) {
    return `Permit issued after ${permit.queueDays} days in the queue.`;
  }
  const left = permitDaysLeft(permit);
  return `Waiting on a permit — ${left} day${left === 1 ? '' : 's'} left of a ${
    permit.queueDays
  }-day queue. ${permit.reasons.join(' and ')} put you in it, and the carry runs while you wait.`;
}
