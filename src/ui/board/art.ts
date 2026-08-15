import {
  ART_UNIT,
  HOUSE_ANCHOR,
  HOUSE_ART,
  type ArtPath,
  type HouseState,
} from './art.generated';
import {
  COLOR_TRANSFORM,
  COLOR_UNIT,
  FURNITURE_COLOR,
  HOUSE_COLOR_BARE,
  HOUSE_SEASON,
  SEASON_MAP,
} from '../art.generated';
import { seasonOf } from '../graphics/houseArt';
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
 * What furniture stands on a lot.
 *
 * Chosen to say something the board does not already say, rather than to dress
 * it. Two of the three are facts with no other representation anywhere on the
 * map:
 *
 *   for_sale_sign   this house is on the market and can be bought. The
 *                   condition overlays only cover houses you already own, so
 *                   without this a listing and a holding look identical.
 *   permit_board    the job here is waiting on the city. Permits can hold a
 *                   renovation for weeks and until now were visible only inside
 *                   the property panel, which is the one place you are not
 *                   looking when you are wondering why nothing is happening.
 *
 * The third is honest decoration. Empty lots get a tree, chosen by position so
 * it is the same tree every time the board draws -- a town with nothing on its
 * spare ground reads as a diagram, and a tree that moves when the day advances
 * reads as a bug.
 */
export interface PlacedPiece {
  name: string;
  /** Where on the lot it stands, as a fraction along each grid axis. */
  u: number;
  v: number;
}

export function lotFurniture(
  gx: number,
  gy: number,
  prop: {
    ownership?: { renovation?: { permit?: { required?: boolean; daysWaited: number; queueDays: number } | null } | null } | null;
  } | null,
): PlacedPiece[] {
  if (!prop) {
    // Deterministic from the coordinates: no RNG, no day, nothing to flicker.
    const h = Math.abs((gx * 73856093) ^ (gy * 19349663));
    const n = h % 10;
    // Nudged off the exact centre so a row of empty lots is not a row of
    // identically planted trees.
    const u = 0.34 + ((h >> 4) % 5) * 0.08;
    const v = 0.34 + ((h >> 8) % 5) * 0.08;
    if (n < 2) return [{ name: 'tree_oak', u, v }];
    if (n < 4) return [{ name: 'tree_pine', u, v }];
    if (n === 4) return [{ name: 'tree_slim', u, v }];
    return [];
  }

  /*
   * Toward the south corner, which is the front of the lot in this projection
   * and the only part of it a house does not stand on. Every piece is drawn
   * standing at the lot's own centre, so without an offset a for-sale board
   * would be planted inside the living room and hidden by the roof.
   */
  const out: PlacedPiece[] = [];
  const own = prop.ownership;
  if (!own) out.push({ name: 'for_sale_sign', u: 0.82, v: 0.9 });

  const permit = own?.renovation?.permit;
  if (permit?.required && permit.daysWaited < permit.queueDays) {
    out.push({ name: 'permit_board', u: 0.9, v: 0.6 });
  }

  return out;
}

/**
 * Furniture placement.
 *
 * Simpler than the houses because the coloured furniture arrived in world
 * coordinates: it shares the houses' origin and unit, so there is no per-piece
 * fitting to divide out and no anchor to look up. The offsets that put a street
 * lamp to one side of the lot are already in the geometry.
 */
export function furnitureDrawing(
  gx: number,
  gy: number,
  pieces: readonly PlacedPiece[],
  cx = 0,
  cy = 0,
): { body: string } | null {
  if (!pieces.length || !COLOR_UNIT) return null;
  const o = project(gx, gy, cx, cy);
  // Where the drawing stands by default: its own lot's centre.
  const drawnAt = project(gx + 0.5, gy + 0.5, cx, cy);

  /*
   * One group per piece, because each carries its own artboard fitting and so
   * needs its own scale. Dividing that `k` back out is what puts a tree at tree
   * size on the lot rather than at the size it was drawn to fill its own 96px
   * board -- and painting order is back to front, so a piece nearer the viewer
   * is drawn last.
   */
  const ordered = [...pieces].sort((a, b) => a.u + a.v - (b.u + b.v));
  const parts: string[] = [];
  for (const p of ordered) {
    const piece = FURNITURE_COLOR[p.name];
    if (!piece) continue;
    const s = TILE / COLOR_UNIT / piece.k;
    const want = project(gx + p.u, gy + p.v, cx, cy);
    const dx = o.x + (want.x - drawnAt.x);
    const dy = o.y + (want.y - drawnAt.y);
    parts.push(
      `<g transform="translate(${(dx - s * piece.tx).toFixed(2)} ` +
        `${(dy - s * piece.ty).toFixed(2)}) scale(${s.toFixed(5)})">${piece.body}</g>`,
    );
  }
  if (!parts.length) return null;
  return { body: parts.join('') };
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
  season: string | null = null,
): { body: string; transform: string } | null {
  const id = artIdFor(archetypeId);
  const art = HOUSE_COLOR_BARE[id];
  if (!art || !COLOR_UNIT) return null;

  const dressed = season ? HOUSE_SEASON[season]?.[id] : undefined;
  const t = dressed ?? COLOR_TRANSFORM[id];
  if (!t) return null;

  const base = dressed ? dressed.base : art.base;
  // The overlays are recoloured here rather than stored per season; see
  // SEASON_MAP for why.
  const overlay = state && art[state] ? recolour(art[state], season) : '';

  const s = TILE / COLOR_UNIT / t.k;
  const o = project(gx, gy, cx, cy);
  return {
    body: base + overlay,
    transform:
      `translate(${(o.x - s * t.tx).toFixed(2)} ${(o.y - s * t.ty).toFixed(2)})` +
      ` scale(${s.toFixed(5)})`,
  };
}

/** Memoised so a board redraw does not re-run 10 substitutions a frame. */
const recoloured = new Map<string, string>();

function recolour(body: string, season: string | null): string {
  const map = season ? SEASON_MAP[season] : undefined;
  if (!map) return body;
  const key = `${season}:${body.length}:${body.slice(0, 40)}`;
  const hit = recoloured.get(key);
  if (hit !== undefined) return hit;
  const out = body.replace(/#[0-9a-fA-F]{6}/g, (hex) => map[hex.toLowerCase()] ?? hex);
  recoloured.set(key, out);
  return out;
}

/**
 * Which set of drawings the calendar calls for.
 *
 * Spring and summer are the set as drawn. Autumn has its own. Winter uses the
 * dusk remap, which is **a stand-in and not a winter set** -- it is an evening
 * light, cold and blue at about half value, and it passes for a winter
 * afternoon far better than high-summer green does. It should be replaced the
 * day a winter set exists.
 *
 * Taken from the same `seasonOf` the property facade uses, so the two pictures
 * of the same house cannot disagree about the time of year.
 */
export function boardSeason(day: number): string | null {
  switch (seasonOf(day)) {
    case 'autumn':
      return 'autumn';
    case 'winter':
      return 'dusk';
    default:
      return null;
  }
}
