import { NEIGHBORHOODS_BY_ID } from '../../engine';
import { DRAWN_ARCHETYPES, type HouseState } from './art';

/**
 * The rest of the town.
 *
 * Every lot the game does not model gets a house anyway. Measured before this
 * existed, a Portfolio Builder board was a hundred and fifty lots with ten
 * houses on it -- seven per cent built -- because only listings and your own
 * holdings stand on the grid. That reads as a diagram of a town rather than a
 * town, and it got worse rather than better when the lots stopped being
 * coloured rectangles: real architecture on one lot in fourteen just draws
 * attention to the thirteen empty ones.
 *
 * These are scenery and nothing else. They are **not** properties: they never
 * enter `state.market` or `state.portfolio`, carry no price, cannot be hovered,
 * clicked or focused, and are invisible to the four data views, which continue
 * to answer their questions about the lots the game actually models. A backdrop
 * house that could be mistaken for a listing would be worse than an empty lot,
 * so the one thing they must never look like is something you can buy.
 *
 * Everything here is derived from the lot's own coordinates and the
 * neighbourhood it sits in. No RNG, no state, no day: the same town every time
 * the board draws, and no save migration, because nothing is stored.
 */

/** A cheap, stable hash of a lot. */
function hash(gx: number, gy: number, salt: number): number {
  let h = (gx * 73856093) ^ (gy * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return Math.abs(h ^ (h >>> 16));
}

/**
 * How densely a neighbourhood is built up, 0 to 1.
 *
 * Taken from the same `demand` the simulation uses to decide how fast houses
 * sell there, so the picture agrees with the economics: the areas people want
 * to live in are the areas with houses on them. Kept clear of both extremes --
 * a full block leaves nowhere for a listing to stand out, and an empty one is
 * the problem this is solving.
 */
export function density(neighborhoodId: string): number {
  const demand = NEIGHBORHOODS_BY_ID[neighborhoodId]?.demand ?? 1;
  return Math.max(0.45, Math.min(0.82, 0.38 + demand * 0.32));
}

export interface BackdropHouse {
  archetypeId: string;
  state: HouseState | null;
}

/**
 * The house standing on an unmodelled lot, if any.
 *
 * Returns null for the lots that stay open, which is what keeps the town from
 * looking like a subdivision and leaves somewhere for the trees to go.
 */
export function backdropAt(
  gx: number,
  gy: number,
  neighborhoodId: string,
): BackdropHouse | null {
  if ((hash(gx, gy, 1) % 1000) / 1000 >= density(neighborhoodId)) return null;

  const ids = DRAWN_ARCHETYPES;
  const archetypeId = ids[hash(gx, gy, 2) % ids.length];

  /*
   * A little life, and deliberately little.
   *
   * Most of the town is just standing there. A few houses are let, which is
   * true of any street, and a few are visibly run down, which is what makes a
   * cheap neighbourhood look cheap rather than merely be coloured as one. None
   * are ever `working` or `finished`: those two overlays mean *you* are doing
   * something here, and scenery must not claim that.
   */
  const roll = hash(gx, gy, 3) % 100;
  const rough = 1 - Math.min(1, (NEIGHBORHOODS_BY_ID[neighborhoodId]?.demand ?? 1));
  const derelict = 6 + Math.round(rough * 26);
  const state: HouseState | null =
    roll < derelict ? 'distressed' : roll < derelict + 22 ? 'occupied' : null;

  return { archetypeId, state };
}
