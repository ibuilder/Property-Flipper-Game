import { EVENTS_BY_ID, NEIGHBORHOODS_BY_ID } from './content';
import { ARCS, arcIsVisible } from './arcs';
import type { GameState, NewsItem } from './types';

/**
 * The Weekly Plat: what is happening, and what it does to your board.
 *
 * The world was silent between decisions. The digest fixed dead air after a
 * *skip*; during ordinary play nothing ever spoke, so a rate move or a
 * materials shortage changed the arithmetic under the player without ever
 * announcing itself.
 *
 * The rule that makes this teaching rather than flavour: **every item states
 * its mechanical consequence**, and that consequence is computed from the
 * event's own modifiers rather than written as prose. Hand-written effect
 * lines drift from what the event actually does the first time somebody tunes
 * a number, and a news feed that lies about the simulation is worse than no
 * news feed -- it teaches the wrong model confidently.
 *
 * So `effects` below is derived, always. If an event has no mechanical effect
 * it gets no effect line, rather than a reassuring sentence.
 */

/** Turn a multiplier into a signed percentage a person would say. */
function pct(mult: number): string {
  const d = (mult - 1) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(Math.abs(d) < 1 ? 1 : 0)}%`;
}

/**
 * What an event does, in the player's terms.
 *
 * Phrased as the thing it changes for them -- "your renovation quotes", "your
 * exit window" -- rather than as the model's variable names. The player does
 * not have a cost multiplier; they have quotes that came back higher.
 */
function effectsOf(defId: string): string[] {
  const def = EVENTS_BY_ID[defId];
  if (!def) return [];
  const e = def.effects;
  const out: string[] = [];

  if (e.valueDrift !== undefined && e.valueDrift !== 1) {
    out.push(`What houses are worth: ${pct(e.valueDrift)} while it lasts.`);
  }
  if (e.costMultiplier !== undefined && e.costMultiplier !== 1) {
    out.push(`Your renovation quotes: ${pct(e.costMultiplier)}.`);
  }
  if (e.timeMultiplier !== undefined && e.timeMultiplier !== 1) {
    out.push(`Schedules: ${pct(e.timeMultiplier)} — every extra day is carry.`);
  }
  if (e.demandMultiplier !== undefined && e.demandMultiplier !== 1) {
    const slower = e.demandMultiplier < 1;
    out.push(
      `Buyer traffic: ${pct(e.demandMultiplier)} — your exit window is ${
        slower ? 'longer' : 'shorter'
      }.`,
    );
  }
  if (e.rateDelta !== undefined && e.rateDelta !== 0) {
    const pts = (e.rateDelta * 100).toFixed(2);
    out.push(`Borrowing: ${e.rateDelta > 0 ? '+' : ''}${pts} points on anything you finance.`);
  }
  return out;
}

/**
 * The feed, most recent first.
 *
 * Three sources, all of them things already happening in the simulation rather
 * than a separate content system: market events, neighbourhood arcs that have
 * become visible on the ground, and the interest rate when it has moved enough
 * to matter.
 */
export function marketNews(state: GameState, limit = 8): NewsItem[] {
  const items: NewsItem[] = [];

  for (const active of state.world.activeEvents) {
    const def = EVENTS_BY_ID[active.defId];
    if (!def) continue;
    const hood = def.effects.neighborhoodId
      ? NEIGHBORHOODS_BY_ID[def.effects.neighborhoodId]?.name
      : null;
    items.push({
      id: `event:${active.defId}:${active.startedDay}`,
      kicker: hood ? hood.toUpperCase() : 'THE MARKET',
      headline: def.name,
      body: def.blurb,
      effects: effectsOf(active.defId),
      daysRemaining: active.daysRemaining,
      day: active.startedDay,
    });
  }

  for (const arc of state.world.arcs) {
    if (!arcIsVisible(arc, state.day)) continue;
    const def = ARCS[arc.kind];
    const hood = NEIGHBORHOODS_BY_ID[arc.neighborhoodId];
    items.push({
      id: `arc:${arc.neighborhoodId}:${arc.startedDay}`,
      kicker: (hood?.name ?? arc.neighborhoodId).toUpperCase(),
      headline: def.name,
      body: def.earlySign,
      /*
       * An arc's daily drift is small and its *duration* is the point, so the
       * honest effect line is about direction over years rather than a
       * percentage this week. Quoting a daily figure would be technically
       * accurate and would teach the wrong thing about what an arc is.
       */
      effects: [
        arc.kind === 'gentrifying'
          ? 'Values here climb for years, and so does what you pay to get in.'
          : 'Values here fall for years. The comps you are underwriting against are already stale.',
      ],
      daysRemaining: Math.max(0, arc.startedDay + arc.totalDays - state.day),
      day: arc.startedDay,
    });
  }

  // Newest first: a feed reads top-down and the thing that just happened is
  // the thing worth reading.
  return items.sort((a, b) => b.day - a.day).slice(0, limit);
}

/**
 * One line for a quiet week, or null when there is news.
 *
 * A feed that renders an empty box on a calm week looks broken. Saying that
 * nothing is happening is also information -- in this game a quiet market is
 * when discipline is cheapest, which is worth pointing out once.
 */
export function quietWeek(state: GameState): string | null {
  if (marketNews(state).length > 0) return null;
  return 'Nothing moving this week. A quiet market is the cheapest time to be patient — nobody is bidding against you and nothing is running away from you.';
}
