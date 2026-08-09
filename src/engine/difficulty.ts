import type { Difficulty, DifficultyMods } from './types';

/**
 * Difficulty as a small set of multipliers, applied at the points where the
 * game is actually hard.
 *
 * Two rules held this to something honest. First, standard is exactly neutral
 * -- every multiplier is 1 and every additive term is 0, so the campaigns the
 * balance harness measures are untouched and "standard" is not a euphemism for
 * anything. Second, nothing here touches the arithmetic the game teaches: the
 * 70% rule, the cost stack, cap rate and DSCR mean the same thing at every
 * setting. What changes is how much room you have to be wrong.
 *
 * Forgiving gives you more capital, calmer markets, fewer hidden defects and
 * less competition. Brutal takes all four away. Neither one lies to you about
 * what a deal is worth.
 */

export const DIFFICULTY_META: Record<
  Difficulty,
  { name: string; blurb: string }
> = {
  forgiving: {
    name: 'Forgiving',
    blurb:
      'More starting capital, a calmer market, fewer hidden defects, and rivals who let you think. The arithmetic is identical — you just get more room to be wrong.',
  },
  standard: {
    name: 'Standard',
    blurb: 'The campaigns as designed and as measured. Winnable, but not a formality.',
  },
  brutal: {
    name: 'Brutal',
    blurb:
      'Less capital, a market that moves against you, more hidden behind the walls, and rivals who take the good deals while you deliberate. Nothing is unfair; there is simply no slack.',
  },
};

const MODS: Record<Difficulty, DifficultyMods> = {
  forgiving: {
    startingCash: 1.25,
    volatility: 0.7,
    hiddenDefects: 0.75,
    competition: 0.6,
    sellerFirmness: 0.94,
    changeOrders: 0.7,
    clock: 1.2,
  },
  standard: {
    startingCash: 1,
    volatility: 1,
    hiddenDefects: 1,
    competition: 1,
    sellerFirmness: 1,
    changeOrders: 1,
    clock: 1,
  },
  brutal: {
    startingCash: 0.8,
    volatility: 1.35,
    hiddenDefects: 1.3,
    competition: 1.45,
    sellerFirmness: 1.05,
    changeOrders: 1.35,
    clock: 0.85,
  },
};

export function difficultyMods(d: Difficulty | undefined): DifficultyMods {
  return MODS[d ?? 'standard'] ?? MODS.standard;
}

/** True when the setting changes nothing at all, which only standard does. */
export function isNeutral(d: Difficulty | undefined): boolean {
  const m = difficultyMods(d);
  return (
    m.startingCash === 1 &&
    m.volatility === 1 &&
    m.hiddenDefects === 1 &&
    m.competition === 1 &&
    m.sellerFirmness === 1 &&
    m.changeOrders === 1 &&
    m.clock === 1
  );
}
