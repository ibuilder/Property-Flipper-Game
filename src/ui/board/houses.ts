import { project, type Point } from './projection';

/**
 * Placeholder axonometric houses, drawn from the archetype the engine already
 * knows about.
 *
 * These are **placeholders and are meant to be replaced** -- the commissioning
 * brief is in `docs/design/art-brief.md`. They exist for two reasons. A board
 * of coloured rectangles reads as a spreadsheet with a tilt, and it is very
 * hard to brief an artist against nothing: a real drawing of the wrong quality
 * is a far better thing to hand someone than a description.
 *
 * Deliberately plain. Line drawings with no fill and no detail, sized and
 * anchored exactly where the commissioned art will sit, so swapping them out
 * is a change of geometry and not a change of layout. Nothing else in the
 * board reads these functions -- `Board.tsx` asks for a shape and draws it.
 *
 * Every archetype is distinguishable at town zoom, which is the only quality
 * bar these have to clear: a duplex should not be mistaken for a bungalow when
 * you are picking which lot to look at.
 */

export type RoofStyle = 'gable' | 'hip' | 'flat' | 'saltbox' | 'mono';

interface Archetype {
  /** How much of the lot the building covers, 0-1. */
  footprint: number;
  /** Wall height in screen pixels. */
  wall: number;
  /** Roof rise above the wall, in screen pixels. */
  rise: number;
  roof: RoofStyle;
}

/**
 * One entry per archetype the content pack defines, plus a fallback.
 *
 * The numbers are chosen for *silhouette* rather than for realism: at this
 * size the only thing that separates a mill loft from a ranch is the outline,
 * so height and roof style carry the whole identity.
 */
const ARCHETYPES: Record<string, Archetype> = {
  bungalow: { footprint: 0.62, wall: 7, rise: 6, roof: 'gable' },
  ranch: { footprint: 0.74, wall: 6, rise: 4, roof: 'hip' },
  duplex: { footprint: 0.78, wall: 9, rise: 5, roof: 'gable' },
  mill_loft: { footprint: 0.72, wall: 15, rise: 2, roof: 'flat' },
  victorian: { footprint: 0.58, wall: 13, rise: 10, roof: 'gable' },
  split_level: { footprint: 0.7, wall: 10, rise: 5, roof: 'saltbox' },
  new_build: { footprint: 0.68, wall: 11, rise: 3, roof: 'mono' },
};

const FALLBACK: Archetype = { footprint: 0.66, wall: 8, rise: 5, roof: 'gable' };

export type Condition = 'distressed' | 'working' | 'finished';

export interface HouseShape {
  /** Wall faces, back to front. */
  walls: Point[][];
  /** The roof, as one or two planes. */
  roof: Point[][];
  /** Scaffold poles, drawn only while work is happening. */
  scaffold: Point[][];
  /** A gap in the roofline: the one thing that reads as "wrecked" this small. */
  broken: boolean;
}

/**
 * Build the shape for a lot.
 *
 * Everything is computed through `project`, so the houses share the board's
 * single source of truth for the isometric maths and cannot drift out of
 * alignment with the lots they stand on.
 */
export function houseShape(
  gx: number,
  gy: number,
  archetypeId: string,
  condition: Condition,
  cx = 0,
  cy = 0,
): HouseShape {
  const a = ARCHETYPES[archetypeId] ?? FALLBACK;
  const inset = (1 - a.footprint) / 2;

  const lo = inset;
  const hi = 1 - inset;
  const corner = (fx: number, fy: number) => project(gx + fx, gy + fy, cx, cy);

  // Footprint, clockwise from the north corner.
  const n = corner(lo, lo);
  const e = corner(hi, lo);
  const s = corner(hi, hi);
  const w = corner(lo, hi);

  const up = (p: Point, h: number): Point => ({ x: p.x, y: p.y - h });

  const wallTop = {
    n: up(n, a.wall),
    e: up(e, a.wall),
    s: up(s, a.wall),
    w: up(w, a.wall),
  };

  // Only the two faces a fixed camera can see, same as the lot extrusion.
  const walls: Point[][] = [
    [e, s, wallTop.s, wallTop.e],
    [s, w, wallTop.w, wallTop.s],
  ];

  const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const roof: Point[][] = [];

  switch (a.roof) {
    case 'flat':
      roof.push([wallTop.n, wallTop.e, wallTop.s, wallTop.w]);
      break;
    case 'mono': {
      // One plane, lifted along a single edge.
      const liftN = up(wallTop.n, a.rise);
      const liftE = up(wallTop.e, a.rise);
      roof.push([liftN, liftE, wallTop.s, wallTop.w]);
      break;
    }
    case 'hip': {
      const peak = up(mid(wallTop.n, wallTop.s), a.rise);
      roof.push([wallTop.e, wallTop.s, peak], [wallTop.s, wallTop.w, peak]);
      break;
    }
    case 'saltbox': {
      // Ridge off-centre: a long plane and a short one.
      const ridgeA = up(mid(wallTop.n, wallTop.e), a.rise);
      const ridgeB = up(mid(wallTop.w, wallTop.s), a.rise * 0.55);
      roof.push([wallTop.e, wallTop.s, ridgeB, ridgeA], [wallTop.s, wallTop.w, ridgeB]);
      break;
    }
    case 'gable':
    default: {
      const ridgeA = up(mid(wallTop.n, wallTop.e), a.rise);
      const ridgeB = up(mid(wallTop.w, wallTop.s), a.rise);
      roof.push([wallTop.e, wallTop.s, ridgeB, ridgeA], [wallTop.n, wallTop.e, ridgeA]);
      break;
    }
  }

  // Scaffold: verticals up the two visible corners, plus a lift line.
  const scaffold: Point[][] = [];
  if (condition === 'working') {
    const poleTop = a.wall + a.rise + 3;
    for (const base of [e, s, w]) {
      scaffold.push([base, up(base, poleTop)]);
    }
    scaffold.push([up(e, poleTop * 0.6), up(s, poleTop * 0.6)]);
    scaffold.push([up(s, poleTop * 0.6), up(w, poleTop * 0.6)]);
  }

  return { walls, roof, scaffold, broken: condition === 'distressed' };
}

/** Which of the three states a property is in, for the board. */
export function conditionOf(prop: {
  condition: number;
  ownership?: { renovation?: unknown } | null;
}): Condition {
  if (prop.ownership?.renovation) return 'working';
  return prop.condition < 0.45 ? 'distressed' : 'finished';
}

/** Every archetype id this module knows how to draw, for the art brief. */
export const DRAWN_ARCHETYPES = Object.keys(ARCHETYPES);
