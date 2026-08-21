import { describe, expect, it } from 'vitest';
import { standing } from '../src/ui/dealMeter';

/**
 * Where an offer stands between the two maximums.
 *
 * The tone is the whole point of this and it has three states, of which the
 * middle one is the lesson: an offer over the itemised maximum and under the
 * rule of thumb is the exact trap the 70% rule sets on an atypical deal, and
 * it has no other visible symptom — every figure on the screen still looks
 * reasonable and the margin is already gone.
 *
 * Tested as arithmetic rather than as a rendered bar because that is where it
 * can be wrong in a way nobody would see. A meter reading `good` on a deal that
 * loses money is worse than no meter: it is the interface agreeing with you.
 */
describe('the offer meter', () => {
  // A deal where the rule of thumb is the *generous* one: expensive carry, so
  // the itemised number lands below 70% of ARV less repairs.
  const RULE_GENEROUS = { arv: 100_000, mao70: 55_000, itemised: 48_000 };
  // And one where it is the conservative one: cheap carry, quick sale.
  const RULE_TIGHT = { arv: 100_000, mao70: 55_000, itemised: 62_000 };

  it('is good while the offer clears the itemised maximum', () => {
    const { arv, mao70, itemised } = RULE_GENEROUS;
    expect(standing(arv, mao70, itemised, 40_000).tone).toBe('good');
    // Exactly on the line is still on the right side of it.
    expect(standing(arv, mao70, itemised, 48_000).tone).toBe('good');
  });

  it('warns in the gap the rule of thumb would wave through', () => {
    // The case the whole component exists for.
    const { arv, mao70, itemised } = RULE_GENEROUS;
    const s = standing(arv, mao70, itemised, 52_000);
    expect(s.tone).toBe('warn');
    expect(s.headroom).toBe(-4_000);
  });

  it('is bad only once the offer clears both', () => {
    const { arv, mao70, itemised } = RULE_GENEROUS;
    expect(standing(arv, mao70, itemised, 55_001).tone).toBe('bad');
    expect(standing(arv, mao70, itemised, 90_000).tone).toBe('bad');
  });

  it('reads the other direction correctly when the rule is the tight one', () => {
    /*
     * The regression this guards. Comparing `warn` against the rule of thumb
     * specifically would paint an offer of $58,000 amber here — above the rule,
     * comfortably below the itemised maximum, and a perfectly good deal. The
     * comparison is against whichever maximum is higher, which gets both
     * directions right with one test.
     */
    const { arv, mao70, itemised } = RULE_TIGHT;
    expect(standing(arv, mao70, itemised, 58_000).tone).toBe('good');
    expect(standing(arv, mao70, itemised, 62_000).tone).toBe('good');
    expect(standing(arv, mao70, itemised, 63_000).tone).toBe('bad');
  });

  it('measures headroom against the itemised number, never the shortcut', () => {
    const { arv, mao70, itemised } = RULE_GENEROUS;
    const s = standing(arv, mao70, itemised, 40_000);
    expect(s.ceiling).toBe(48_000);
    expect(s.headroom).toBe(8_000);
  });

  it('places every mark on a 0-to-ARV scale that does not rescale itself', () => {
    // A scale that fitted itself to the marks would hide the answer to the
    // question the 70% rule is shorthand for: what share of the finished value
    // am I paying?
    const { arv, mao70, itemised } = RULE_GENEROUS;
    const s = standing(arv, mao70, itemised, 40_000);
    expect(s.offerAt).toBeCloseTo(0.4, 5);
    expect(s.ruleAt).toBeCloseTo(0.55, 5);
    expect(s.itemisedAt).toBeCloseTo(0.48, 5);
    expect(s.ofArv).toBeCloseTo(0.4, 5);
  });

  it('clamps the drawing without lying about the number', () => {
    const { arv, mao70, itemised } = RULE_GENEROUS;
    const s = standing(arv, mao70, itemised, 130_000);
    expect(s.offerAt).toBe(1); // the bar stops at the end
    expect(s.ofArv).toBeCloseTo(1.3, 5); // the figure does not
    expect(s.offScale).toBe(true);
    expect(s.headroom).toBe(-82_000);
  });

  it('survives a property with no value rather than dividing by it', () => {
    const s = standing(0, 0, 0, 10_000);
    expect(Number.isFinite(s.offerAt)).toBe(true);
    expect(s.offerAt).toBe(1);
    expect(s.tone).toBe('bad');
  });

  it('survives numbers that are not numbers', () => {
    const s = standing(Number.NaN, Number.NaN, Number.NaN, Number.NaN);
    for (const v of [s.offerAt, s.ruleAt, s.itemisedAt, s.headroom]) {
      expect(Number.isFinite(v), String(v)).toBe(true);
    }
  });
});
