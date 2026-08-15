import {
  COLOR_TRANSFORM,
  COLOR_UNIT,
  FURNITURE_COLOR,
  FURNITURE_LINE,
  HOUSE_COLOR_BARE,
  HOUSE_SEASON,
  SPRITE_COLOR,
  SPRITE_LINE,
  type Placeable,
} from '../art.generated';
import { seasonOf } from '../graphics/houseArt';
import {
  ART_UNIT,
  HOUSE_ANCHOR,
  HOUSE_ART,
  type ArtPath,
  type HouseState,
} from './art.generated';
import { TILE, project } from './projection';

/**
 * The commissioned art, placed on the board.
 *
 * The geometry comes from `art/` via `npm run art`; what is left here is
 * placement, which is the part that has to agree with the board.
 *
 * Every placeable piece declares the same two things, and both come from the
 * delivery rather than from measurement:
 *
 *   anchor   where the lot origin -- grid (0,0) -- lands inside that file's
 *            artboard. For Scout, where his feet meet the ground.
 *   scale    the fit the file applies to its own drawing.
 *
 * Which makes placement one function for everything. Dividing the fit back out
 * is what keeps a bungalow smaller than a mill loft: each artboard is fitted to
 * its own drawing, so used as delivered every house would render the same
 * height.
 *
 * Two earlier faults are worth remembering because the anchors are what fixed
 * them. Placing artboards by their centres left a 15.5px spread of ground level
 * across the archetypes, on a lot 19px tall. And the line furniture was for two
 * deliveries unplaceable, because it had been centred on its own bounding box
 * -- a fence belongs on a boundary and a driveway at the kerb, and centred they
 * are the same drawing.
 */

export type { HouseState };

/** Scale that lands a delivered line footprint exactly on a board lot. */
export const ART_SCALE = TILE / ART_UNIT;

/**
 * Ink weight in board units for a delivered pen weight of 1.
 *
 * Tuned against the placeholder these replaced, which drew at 0.7 for detail
 * and 0.9 for contour. The delivered art carries a 2:1 ratio rather than that
 * 1.3:1, so contour reads harder at the same detail weight.
 */
const INK = 0.55;

/**
 * How big Scout is on a lot.
 *
 * The one number the delivery does not state: every other placeable piece
 * carries a scale and the sprites carry only an anchor. Read in the coloured
 * set's units -- where the houses and furniture live -- all six frames measure
 * 65 to 69% of a lot wide, which is a dog as long as the parked car two lots
 * over. So this is chosen rather than derived: sized so he is about a third of
 * a lot, which reads as a figure standing on a plot at town zoom without
 * competing with the building.
 *
 * Replace with the delivered figure the moment one exists. It is the only
 * placement number in this file that is a judgement rather than a measurement.
 */
const SPRITE_UNIT = 108;

/** Every archetype id there is a drawing for. */
export const DRAWN_ARCHETYPES = Object.keys(HOUSE_ART);

/**
 * The drawing used for a content archetype.
 *
 * Every id the engine generates now has art of its own. This used to map three
 * of them onto stand-ins, because the brief was written from the placeholder
 * module rather than from `content.ts` and asked for the wrong seven names.
 * `tests/art.test.ts` compares the two lists directly, so a new archetype fails
 * loudly here rather than quietly wearing another type's roof.
 */
export function artIdFor(archetypeId: string): string {
  return HOUSE_ART[archetypeId] ? archetypeId : 'ranch';
}

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
 * One at a time rather than stacking them. They are drawn in the same space and
 * would compose without clipping, but several put furniture in the same drive,
 * and two boards in one driveway reads as a bug rather than as two facts.
 *
 * Ordered by what the player most needs to see. Work in progress beats
 * everything -- it is the state with a clock on it. A let house is reporting
 * income and that outranks its condition. Dereliction outranks the for-sale
 * board because it is what changes the number. A sound house doing nothing gets
 * no overlay, which is what keeps the board from looking uniformly busy.
 */
export function houseState(prop: Drawable): HouseState | null {
  const own = prop.ownership;
  if (own?.renovation) return 'working';
  if (own?.rental?.tenancy) return 'occupied';
  if (prop.condition < 0.45) return 'distressed';
  if (own?.saleListing) return 'finished';
  return null;
}

/** An SVG transform placing an artboard point on a board point. */
function place(
  origin: { x: number; y: number },
  anchor: readonly [number, number],
  fit: number,
  unit: number,
): { transform: string; scale: number } {
  const s = TILE / unit / fit;
  return {
    scale: s,
    transform:
      `translate(${(origin.x - s * anchor[0]).toFixed(2)} ` +
      `${(origin.y - s * anchor[1]).toFixed(2)}) scale(${s.toFixed(5)})`,
  };
}

export interface HouseDrawing {
  /** Base drawing then overlay, already in draw order. */
  paths: ArtPath[];
  /** How many of those are the base, for inking the overlay differently. */
  baseCount: number;
  transform: string;
  /** Stroke width for a delivered weight, in the transformed space. */
  strokeWidth: (w: number) => number;
}

/** The line drawing of one house, placed. */
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
  const a = HOUSE_ANCHOR[id];
  const paths = state ? [...art.base, ...art[state]] : art.base;
  const { transform } = place(project(gx, gy, cx, cy), [a.x, a.y], 1, ART_UNIT);
  return {
    paths,
    baseCount: art.base.length,
    transform,
    strokeWidth: (w: number) => (w * INK) / ART_SCALE,
  };
}

/** The coloured drawing of one house, placed, in whatever season is asked for. */
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
  const t = COLOR_TRANSFORM[id];
  if (!t || !COLOR_UNIT) return null;

  const set = (season && HOUSE_SEASON[season]?.[id]) || HOUSE_COLOR_BARE[id];
  if (!set) return null;

  const body = set.base + (state && set[state] ? set[state] : '');
  const { transform } = place(project(gx, gy, cx, cy), [t.tx, t.ty], t.k, COLOR_UNIT);
  return { body, transform };
}

/**
 * Which set of drawings the calendar calls for.
 *
 * Taken from the same `seasonOf` the property facade uses, so the two pictures
 * of one house cannot disagree about the time of year. Spring and summer are
 * the set as drawn; the other two have their own, delivered complete.
 */
export function boardSeason(day: number): string | null {
  const s = seasonOf(day);
  if (s === 'autumn') return 'autumn';
  if (s === 'winter') return 'winter';
  return null;
}

export interface PlacedPiece {
  name: string;
  /** Where on the lot it stands, as a fraction along each grid axis. */
  u: number;
  v: number;
}

/**
 * What furniture stands on a lot.
 *
 * Chosen to say something the board does not already say, rather than to dress
 * it. Two of the three are facts with no other representation on the map:
 *
 *   for_sale_sign   this house is on the market. The condition overlays only
 *                   cover houses you already own, so without it a listing and a
 *                   holding are the same picture.
 *   permit_board    the job here is waiting on the city. Permits hold a
 *                   renovation for weeks and were visible only inside the
 *                   property panel -- the one place you are not looking when
 *                   you are wondering why nothing is happening.
 *
 * The third is honest decoration: empty lots get a tree, keyed off position so
 * it is the same tree every draw. A tree that changes species when the day
 * advances reads as a rendering bug, not as weather.
 *
 * Offsets are toward the south corner, which is the front of the lot in this
 * projection and the only part of it a house does not stand on. Every piece is
 * drawn standing at its own lot's centre, so without one a for-sale board is
 * planted in the living room and hidden by the roof.
 */
export function lotFurniture(
  gx: number,
  gy: number,
  prop: {
    ownership?: {
      renovation?: {
        permit?: { required?: boolean; daysWaited: number; queueDays: number } | null;
      } | null;
    } | null;
  } | null,
): PlacedPiece[] {
  if (!prop) {
    const h = Math.abs((gx * 73856093) ^ (gy * 19349663));
    const u = 0.34 + ((h >> 4) % 5) * 0.08;
    const v = 0.34 + ((h >> 8) % 5) * 0.08;
    const n = h % 10;
    if (n < 2) return [{ name: 'tree_oak', u, v }];
    if (n < 4) return [{ name: 'tree_pine', u, v }];
    if (n === 4) return [{ name: 'tree_slim', u, v }];
    return [];
  }

  const out: PlacedPiece[] = [];
  const own = prop.ownership;
  if (!own) out.push({ name: 'for_sale_sign', u: 0.82, v: 0.9 });

  const permit = own?.renovation?.permit;
  if (permit?.required && permit.daysWaited < permit.queueDays) {
    out.push({ name: 'permit_board', u: 0.9, v: 0.6 });
  }
  return out;
}

/** Move a piece from the lot's centre, where it is drawn, to where it stands. */
function offsetFor(
  gx: number,
  gy: number,
  p: PlacedPiece,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const o = project(gx, gy, cx, cy);
  const drawnAt = project(gx + 0.5, gy + 0.5, cx, cy);
  const want = project(gx + p.u, gy + p.v, cx, cy);
  return { x: o.x + (want.x - drawnAt.x), y: o.y + (want.y - drawnAt.y) };
}

/**
 * Lot furniture, placed.
 *
 * One group per piece, because each carries its own fit. Painted back to front
 * so a piece nearer the viewer is drawn last.
 */
export function furnitureDrawing(
  gx: number,
  gy: number,
  pieces: readonly PlacedPiece[],
  style: 'line' | 'colour',
  cx = 0,
  cy = 0,
): { body: string } | null {
  if (!pieces.length || !COLOR_UNIT) return null;
  const set: Record<string, Placeable> = style === 'colour' ? FURNITURE_COLOR : FURNITURE_LINE;

  const parts: string[] = [];
  for (const p of [...pieces].sort((a, b) => a.u + a.v - (b.u + b.v))) {
    const piece = set[p.name];
    if (!piece) continue;
    const { transform } = place(
      offsetFor(gx, gy, p, cx, cy),
      piece.anchor,
      piece.scale,
      COLOR_UNIT,
    );
    parts.push(`<g transform="${transform}">${piece.body}</g>`);
  }
  return parts.length ? { body: parts.join('') } : null;
}

/**
 * Where Scout is standing, if anywhere.
 *
 * One dog. He goes to the job that is running, because that is the lot with a
 * clock on it and the only one where a figure adds information rather than
 * decoration -- a board with a dog on every lot is a kennel. Ties break on
 * position so he does not teleport between two equally valid sites as the day
 * advances.
 */
export function scoutLot<T extends { gx: number; gy: number; property: unknown }>(
  parcels: readonly T[],
  isWorking: (property: unknown) => boolean,
): T | null {
  let best: T | null = null;
  for (const p of parcels) {
    if (!p.property || !isWorking(p.property)) continue;
    if (!best || p.gx + p.gy < best.gx + best.gy) best = p;
  }
  return best;
}

/**
 * Scout, placed on a lot.
 *
 * Frames alternate on the day rather than on a timer: the board is a still
 * picture of one day, so the animation belongs to time passing in the game and
 * not to time passing while you look at it. It also means nothing is running
 * when nothing is happening.
 */
export function scoutDrawing(
  gx: number,
  gy: number,
  action: 'idle' | 'walking' | 'digging',
  day: number,
  style: 'line' | 'colour',
  cx = 0,
  cy = 0,
): { body: string; transform: string } | null {
  if (!COLOR_UNIT) return null;
  const set: Record<string, Placeable> = style === 'colour' ? SPRITE_COLOR : SPRITE_LINE;
  const frame = set[`scout-${action}-${(day % 2) + 1}`];
  if (!frame) return null;
  // Stands toward the front of the lot, clear of the building.
  const at = offsetFor(gx, gy, { name: 'scout', u: 0.72, v: 0.94 }, cx, cy);
  const { transform } = place(at, frame.anchor, frame.scale, SPRITE_UNIT);
  return { body: frame.body, transform };
}
