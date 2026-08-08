import { describe, expect, it } from 'vitest';
import {
  LEVELS_BY_ID,
  advanceDaysUntilAttention,
  createGame,
  listForSale,
  makeOffer,
  trueValue,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

/**
 * Multi-day skip behaviour.
 *
 * Buyer offers expire in three to seven days, so a naive "+30 days" silently
 * threw away sales the player would have taken. These pin the auto-stop.
 */
describe('advanceDaysUntilAttention', () => {
  it('advances the full count when nothing needs attention', () => {
    const state = createGame('sandbox', 2024);
    const res = advanceDaysUntilAttention(state, 20);
    expect(res.daysAdvanced).toBe(20);
    expect(res.stoppedEarly).toBe(false);
    expect(res.reason).toBe('completed');
    expect(state.day).toBe(21);
  });

  it('stops on a live buyer offer instead of running past it', () => {
    const state = createGame('sandbox', 909);

    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    expect(makeOffer(state, prop.id, prop.listing!.askPrice, false).ok).toBe(true);

    const owned = state.portfolio[0];
    // List well under value so a buyer turns up quickly.
    const value = trueValue(owned, state.world, state.day);
    expect(listForSale(state, owned.id, Math.round(value * 0.85)).ok).toBe(true);

    const res = advanceDaysUntilAttention(state, 300);
    const offers = state.portfolio[0]?.ownership?.saleListing?.offers ?? [];

    expect(res.stoppedEarly).toBe(true);
    expect(res.daysAdvanced).toBeLessThan(300);
    expect(offers.length).toBeGreaterThan(0);
    // The offer must still be live -- that was the entire point.
    expect(offers[0].expiresDay).toBeGreaterThanOrEqual(state.day);
  });

  it('stops when the game ends', () => {
    const state = createGame('first_flip', 55);
    state.cash = 10_000_000;
    const res = advanceDaysUntilAttention(state, 50);
    expect(res.daysAdvanced).toBe(1);
    expect(res.reason).toBe('gameOver');
    expect(state.phase).toBe('won');
  });

  it('never runs past a level deadline', () => {
    const state = createGame('first_flip', 77);
    state.day = LEVELS_BY_ID['first_flip'].dayLimit! - 2;
    const res = advanceDaysUntilAttention(state, 100);
    expect(state.phase).toBe('lost');
    expect(res.daysAdvanced).toBeLessThan(100);
  });

  it('is a no-op once the game is already over', () => {
    const state = createGame('first_flip', 88);
    state.phase = 'won';
    const res = advanceDaysUntilAttention(state, 30);
    expect(res.daysAdvanced).toBe(0);
    expect(state.day).toBe(1);
  });
});
