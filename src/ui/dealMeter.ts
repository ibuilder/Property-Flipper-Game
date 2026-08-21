/**
 * Where an offer stands against the two maximums, as a distance.
 *
 * The analyser already prints both maximum offers and a sentence about which
 * one to trust. What it never showed is where the number you are actually
 * typing sits between them -- and that is the thing a player has to feel rather
 * than read, because it changes under their hands while they type.
 *
 * Three states, and the middle one is the whole lesson:
 *
 *   good  the offer clears the itemised maximum. Every real cost is covered
 *         and the target margin survives.
 *   warn  the offer is over the itemised maximum and under the rule of thumb.
 *         The shortcut would wave this through and the arithmetic does not.
 *         This is exactly the trap the 70% rule sets on an atypical deal, and
 *         it has no other visible symptom.
 *   bad   over both. Nothing thinks this is a deal.
 *
 * The scale runs 0 to ARV rather than fitting the marks, because "what share
 * of the finished value am I paying" is the question the 70% rule is a
 * shorthand for, and a scale that rescales itself would hide the answer.
 */

export interface Standing {
  /** Positions on a 0..1 scale of the ARV. Clamped; see `offScale`. */
  offerAt: number;
  ruleAt: number;
  itemisedAt: number;
  /** The binding maximum, in money. The itemised one, always. */
  ceiling: number;
  /** Ceiling less the offer. Negative means the offer is over it. */
  headroom: number;
  /** The offer as a share of ARV, which is the number the rule is about. */
  ofArv: number;
  /** True when the offer runs past the end of the scale. */
  offScale: boolean;
  tone: 'good' | 'warn' | 'bad';
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export function standing(
  arv: number,
  mao70: number,
  maoDetailed: number,
  offer: number,
): Standing {
  // A property with no value is not a scale. Rather than divide by it, collapse
  // everything to the left edge and let the caller draw an empty meter.
  const scale = Number.isFinite(arv) && arv > 0 ? arv : 1;
  const safe = (n: number) => (Number.isFinite(n) ? n : 0);

  const o = safe(offer);
  const rule = safe(mao70);
  const itemised = safe(maoDetailed);

  /*
   * `warn` is checked against whichever maximum is higher, not against the rule
   * specifically. On a deal where the rule is the *conservative* one -- cheap
   * carry, fast sale -- an offer between the two is above the rule and below
   * the itemised number, which is fine and should read as fine. Comparing
   * against the higher of the two gets both directions right with one test.
   */
  const looser = Math.max(rule, itemised);
  const tone: Standing['tone'] = o <= itemised ? 'good' : o <= looser ? 'warn' : 'bad';

  return {
    offerAt: clamp01(o / scale),
    ruleAt: clamp01(rule / scale),
    itemisedAt: clamp01(itemised / scale),
    ceiling: itemised,
    headroom: itemised - o,
    ofArv: o / scale,
    offScale: o > scale,
    tone,
  };
}
