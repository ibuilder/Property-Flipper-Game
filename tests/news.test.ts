import { describe, expect, it } from 'vitest';
import { EVENTS, advanceDay, createGame, marketNews, quietWeek } from '../src/engine';
import type { GameState } from '../src/engine';

/** Force an event on, so the feed has something specific to describe. */
function withEvent(state: GameState, defId: string): GameState {
  state.world.activeEvents.push({ defId, daysRemaining: 30, startedDay: state.day });
  return state;
}

describe('the market news', () => {
  it('is empty on a quiet day, and says so rather than rendering nothing', () => {
    const state = createGame('sandbox', 909);
    state.world.activeEvents = [];
    state.world.arcs = [];
    expect(marketNews(state)).toHaveLength(0);
    // An empty feed looks broken; a quiet market is also information.
    expect(quietWeek(state)).toMatch(/quiet market|nothing moving/i);
  });

  it('goes quiet again once there is news', () => {
    const state = withEvent(createGame('sandbox', 909), EVENTS[0].id);
    expect(marketNews(state).length).toBeGreaterThan(0);
    expect(quietWeek(state)).toBeNull();
  });

  it('derives the effect line from the event, never from prose', () => {
    // The rule the whole feature rests on. A hand-written effect line drifts
    // from the simulation the first time somebody tunes a number, and a news
    // feed that lies about the model teaches the wrong model confidently.
    for (const def of EVENTS) {
      const state = withEvent(createGame('sandbox', 909), def.id);
      const item = marketNews(state).find((n) => n.id.includes(def.id))!;
      expect(item, def.id).toBeDefined();

      const e = def.effects;
      const mechanical =
        (e.valueDrift !== undefined && e.valueDrift !== 1) ||
        (e.costMultiplier !== undefined && e.costMultiplier !== 1) ||
        (e.timeMultiplier !== undefined && e.timeMultiplier !== 1) ||
        (e.demandMultiplier !== undefined && e.demandMultiplier !== 1) ||
        (e.rateDelta !== undefined && e.rateDelta !== 0);

      // An event with mechanical effects must state them. One without gets no
      // effect line at all, rather than a reassuring sentence.
      expect(item.effects.length > 0, `${def.id} effects`).toBe(mechanical);
    }
  });

  it('states the direction the modifier actually goes', () => {
    const rising = EVENTS.find((d) => (d.effects.costMultiplier ?? 1) > 1);
    if (rising) {
      const state = withEvent(createGame('sandbox', 909), rising.id);
      const item = marketNews(state).find((n) => n.id.includes(rising.id))!;
      const line = item.effects.find((l) => l.includes('renovation quotes'))!;
      expect(line).toMatch(/\+\d/);
    }

    const softening = EVENTS.find((d) => (d.effects.demandMultiplier ?? 1) < 1);
    if (softening) {
      const state = withEvent(createGame('sandbox', 909), softening.id);
      const item = marketNews(state).find((n) => n.id.includes(softening.id))!;
      const line = item.effects.find((l) => l.includes('Buyer traffic'))!;
      // Less traffic means longer to sell, which is the consequence that
      // matters -- not the multiplier.
      expect(line).toContain('longer');
    }
  });

  it('phrases effects in the player’s terms, not the model’s', () => {
    for (const def of EVENTS) {
      const state = withEvent(createGame('sandbox', 909), def.id);
      const item = marketNews(state).find((n) => n.id.includes(def.id))!;
      for (const line of item.effects) {
        expect(line, def.id).not.toMatch(/multiplier|drift|modifier|delta/i);
      }
    }
  });

  it('carries an arc once it is visible, and not before', () => {
    const state = createGame('sandbox', 909);
    state.world.activeEvents = [];
    state.world.arcs = [
      {
        neighborhoodId: 'old_town',
        kind: 'gentrifying',
        startedDay: state.day,
        totalDays: 900,
        announced: false,
      },
    ];
    // An arc runs silently for its first stretch; reporting it early would
    // give away the information the player is meant to be paying for.
    expect(marketNews(state)).toHaveLength(0);

    for (let i = 0; i < 400; i++) advanceDay(state);
    const news = marketNews(state);
    expect(news.some((n) => n.id.startsWith('arc:'))).toBe(true);
  });

  it('leads with what just happened', () => {
    const state = createGame('sandbox', 909);
    state.world.activeEvents = [
      { defId: EVENTS[0].id, daysRemaining: 10, startedDay: 5 },
      { defId: EVENTS[1].id, daysRemaining: 10, startedDay: 40 },
    ];
    const news = marketNews(state);
    expect(news[0].day).toBeGreaterThanOrEqual(news[news.length - 1].day);
  });

  it('gives every item a stable id, so the list does not thrash', () => {
    const state = withEvent(createGame('sandbox', 909), EVENTS[0].id);
    const a = marketNews(state).map((n) => n.id);
    const b = marketNews(state).map((n) => n.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });
});
