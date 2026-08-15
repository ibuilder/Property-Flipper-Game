import {
  ART_UNIT,
  HOUSE_ANCHOR,
  HOUSE_ART,
  type ArtPath,
  type HouseState,
} from './art.generated';
import { COLOR_TRANSFORM, COLOR_UNIT, HOUSE_COLOR_BARE } from '../art.generated';
import { TILE, project } from './projection';

/**
 * The commissioned house art, placed on the board.
 *
 * Replaces the placeholder line drawings this module's predecessor generated.
 * The geometry now comes from `art/` via `scripts/art-ingest.mjs`; what is left
 * here is placement, which is the part that has to agree with the board.
 *
 * Two things in the delivery are easy to get wrong and are handled once, here.
 *
 * The artboards are each centred on their own drawing, so the lot origin sits
 * at a different height in every file -- a 15.5px spread across the seven
 * pieces, on a lot diamond 19px tall. Houses are therefore placed by
 * `HOUSE_ANCHOR`, never by the artboard centre, or a ranch hovers while a
 * victorian sinks.
 *
 * And the pen weights are delivered for a 36px lot. Scaling the art up to the
 * board's tile would scale the ink with it and the board would go muddy, so
 * stroke width is divided back out and expressed in board units.
 */

export type { HouseState };

/** Scale that lands a delivered footprint exactly on a board lot. */
export const ART_SCALE = TILE / ART_UNIT;

/**
 * Ink weight in board units for a delivered pen weight of 1.
 *
 * Tuned against the placeholder it replaces, which drew at 0.7 for detail and
 * 0.9 for contour. The delivered art carries a 2:1 ratio rather than that
 * 1.3:1, so contour reads harder at the same detail weight.
 */
const INK = 0.55;

/**
 * Content archetypes with no art of their own.
 *
 * The commissioning brief took its archetype list from the placeholder module
 * rather than from `content.ts`, so three ids the game actually generates
 * (`colonial`, `condo`, `townhouse`) were never drawn, while three that were
 * drawn (`mill_loft`, `split_level`, `new_build`) match nothing the engine
 * makes. Both lists are seven long, which is why a count-based test never
 * caught it.
 *
 * These are stand-ins chosen on era and massing so that every house on the
 * board still has a silhouette of its own, and they are **not** the fix. The
 * fix is art named for the ids in `content.ts`; until then a colonial is
 * wearing a split level's roof. `tests/art.test.ts` asserts this table covers
 * exactly the gap, so it cannot quietly rot once the real drawings land.
 */
export const SUBSTITUTE: Record<string, string> = {
  colonial: 'split_level',
  condo: 'mill_loft',
  townhouse: 'new_build',
};

/** The archetype whose drawing is used for a content archetype. */
export function artIdFor(archetypeId: string): string {
  if (HOUSE_ART[archetypeId]) return archetypeId;
  return SUBSTITUTE[archetypeId] ?? 'ranch';
}

/** Every archetype id there is a drawing for. */
export const DRAWN_ARCHETYPES = Object.keys(HOUSE_ART);

/** What the engine knows about a property, as far as the board is concerned. */
interface Drawable {
  condition: number;
  ownership?: {
    renovation?: unknown;
    saleListing?: unknown;
    rental?: { tenancy?: unknown } | null;
  } | null;
}

/**
 * Which overlay a property is wearing, if any.
 *
 * One overlay at a time rather than stacking them. They are drawn in the same
 * coordinate space and would compose without clipping, but several of them put
 * furniture in the same drive, and two boards in one driveway reads as a bug
 * rather than as two facts.
 *
 * Ordered by what the player most needs to see. Work in progress beats
 * everything -- it is the state with a clock on it. A let house is reporting
 * income and that outranks its condition. Dereliction outranks the for-sale
 * board because it is the thing that changes what the house is worth. A sound
 * house doing nothing gets no overlay at all, which is what keeps the board
 * from looking uniformly busy.
 */
export function houseState(prop: Drawable): HouseState | null {
  const own = prop.ownership;
  if (own?.renovation) return 'working';
  if (own?.rental?.tenancy) return 'occupied';
  if (prop.condition < 0.45) return 'distressed';
  if (own?.saleListing) return 'finished';
  return null;
}

export interface HouseDrawing {
  /** Base drawing then overlay, already in draw order. */
  paths: ArtPath[];
  /** SVG transform placing the artboard on the lot. */
  transform: string;
  /** Stroke width for a delivered weight, in the transformed space. */
  strokeWidth: (w: number) => number;
}

/**
 * Everything needed to draw one house, computed from the board's own
 * projection so the art cannot drift off the ground it stands on.
 */
export function houseDrawing(
  gx: number,
  gy: number,
  archetypeId: string,
  state: HouseState | null,
  cx = 0,
  cy = 0,
): HouseDrawing {
  const id = artIdFor(archetypeId);
  const art = HOUSE_ART[id];
  const anchor = HOUSE_ANCHOR[id];

  const paths = state ? [...art.base, ...art[state]] : art.base;

  // The lot's centre on the board is where the artboard's anchor point goes.
  const centre = project(gx + 0.5, gy + 0.5, cx, cy);
  const tx = centre.x - anchor.x * ART_SCALE;
  const ty = centre.y - anchor.y * ART_SCALE;

  return {
    paths,
    transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${ART_SCALE.toFixed(4)})`,
    strokeWidth: (w: number) => (w * INK) / ART_SCALE,
  };
}

/**
 * The same placement, for the coloured set.
 *
 * Two differences, both of which would show immediately if they were wrong.
 * The coloured art is drawn on a larger grid of its own -- `COLOR_UNIT` rather
 * than `ART_UNIT` -- and each file carries a per-archetype `k` that fits its
 * drawing to its artboard. Dividing `k` out is what keeps a bungalow smaller
 * than a mill loft instead of rendering every house the same height, which is
 * what using the artboards as delivered would do.
 *
 * The origin of the art is the lot's west corner, matching the line set, so
 * both styles stand on exactly the same ground.
 */
export function colorHouseDrawing(
  gx: number,
  gy: number,
  archetypeId: string,
  state: HouseState | null,
  cx = 0,
  cy = 0,
): { body: string; transform: string } | null {
  const id = artIdFor(archetypeId);
  const art = HOUSE_COLOR_BARE[id];
  const t = COLOR_TRANSFORM[id];
  if (!art || !t || !COLOR_UNIT) return null;

  const s = TILE / COLOR_UNIT / t.k;
  const o = project(gx, gy, cx, cy);
  return {
    body: art.base + (state && art[state] ? art[state] : ''),
    transform:
      `translate(${(o.x - s * t.tx).toFixed(2)} ${(o.y - s * t.ty).toFixed(2)})` +
      ` scale(${s.toFixed(5)})`,
  };
}
