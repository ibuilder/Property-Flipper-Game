import { describe, expect, it } from 'vitest';
import {
  LEVELS_BY_ID,
  advanceDaysUntilAttention,
  createGame,
  listForSale,
  makeOffer,
  trueValue,
} from '../src/engine';
import { noteCoachLine } from '../src/engine/game';
import { currentReserve } from '../src/engine/market';
import { toastFor } from '../src/ui/store';

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

/**
 * Which action results are allowed to speak.
 *
 * `useAction` is the only place an `ActionResult` becomes a toast, so it is the
 * only place the "silent" contract can be kept. It was not being kept:
 * `noteCoachLine` returns `{ ok: true, message: '' }` with a comment saying a
 * toast every time the coach speaks would be a notification about a
 * notification, and got one anyway -- an empty green plate, 38x21 CSS px, at
 * the bottom of the screen, plus the new-log sound, once per coach rule per
 * day. It was found in a screenshot of the deal modal rather than in play,
 * because with no text in it there is nothing to read and nothing to name.
 */
describe('toastFor', () => {
  it('stays silent when a successful action asked to say nothing', () => {
    expect(toastFor({ ok: true, message: '' }, 1)).toBeNull();
  });

  it('keeps the coach silent, which is the case that motivated this', () => {
    const state = createGame('first_flip', 4242);
    const result = noteCoachLine(state, 'seventy_rule');
    // The engine still records the line -- silence is about the toast, not the
    // bookkeeping.
    expect(state.coachLog['seventy_rule']?.count).toBe(1);
    expect(toastFor(result, 1)).toBeNull();
  });

  it('still speaks for anything with something to say', () => {
    expect(toastFor({ ok: true, message: 'Offer accepted.' }, 7)).toEqual({
      id: 7,
      message: 'Offer accepted.',
      tone: 'ok',
    });
    expect(toastFor({ ok: false, message: 'Not enough cash.' }, 8)).toEqual({
      id: 8,
      message: 'Not enough cash.',
      tone: 'error',
    });
  });

  it('never swallows a refusal, even one that forgot to explain itself', () => {
    // The player pressed a button and nothing happened; they will press it
    // again. A clumsy message beats no message.
    const toast = toastFor({ ok: false, message: '' }, 3);
    expect(toast?.tone).toBe('error');
    expect(toast?.message).not.toBe('');
  });
});
