import { EVENTS_BY_ID } from './content';
import type { WorldState } from './types';

export interface EventModifiers {
  valueDrift: number;
  costMultiplier: number;
  timeMultiplier: number;
  rateDelta: number;
  demandMultiplier: number;
}

const NEUTRAL: EventModifiers = {
  valueDrift: 1,
  costMultiplier: 1,
  timeMultiplier: 1,
  rateDelta: 0,
  demandMultiplier: 1,
};

/**
 * Combine every active event into a single set of modifiers.
 *
 * Multiplicative effects compound; the rate delta is additive. Events scoped
 * to a single neighborhood only apply when that neighborhood is being asked
 * about, which is what makes a local revitalisation or plant closure feel
 * different from a market-wide swing.
 */
export function eventModifiers(world: WorldState, neighborhoodId?: string): EventModifiers {
  const out: EventModifiers = { ...NEUTRAL };

  for (const active of world.activeEvents) {
    const def = EVENTS_BY_ID[active.defId];
    if (!def) continue;
    const scoped = def.effects.neighborhoodId;
    if (scoped && scoped !== neighborhoodId) continue;

    out.valueDrift *= def.effects.valueDrift ?? 1;
    out.costMultiplier *= def.effects.costMultiplier ?? 1;
    out.timeMultiplier *= def.effects.timeMultiplier ?? 1;
    out.demandMultiplier *= def.effects.demandMultiplier ?? 1;
    out.rateDelta += def.effects.rateDelta ?? 0;
  }

  return out;
}

/** Human-readable summary of what is currently affecting the market. */
export function describeActiveEvents(world: WorldState): string[] {
  return world.activeEvents.map((a) => {
    const def = EVENTS_BY_ID[a.defId];
    return def ? `${def.name} (${a.daysRemaining}d left)` : a.defId;
  });
}
