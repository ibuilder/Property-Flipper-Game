import { Rng } from '../../engine';
import type { HouseSubject } from '../../engine';

/**
 * Turns a property's data into a drawable facade.
 *
 * This is the visual encoding of `condition`, which until now was an invisible
 * decimal driving the entire economy. Every mark below is derived from state
 * the simulation already tracks -- nothing is decorative:
 *
 *   archetype    -> silhouette, roof form, storeys
 *   sqft         -> width and height of the massing
 *   yearBuilt    -> period detail (porch, dormers, window divisions)
 *   condition    -> decay: missing shingles, boarded windows, siding stains,
 *                   an overgrown yard, a leaning porch
 *   completedWork-> targeted repair: a new roof fixes the shingles, siding
 *                   fixes the stains, landscaping fixes the yard
 *   noiseSeed    -> stable variation, so a house always looks like itself
 *
 * Kept as pure data so it can be unit-tested and so the React component stays
 * a dumb renderer.
 */

export interface HousePalette {
  sky: string;
  ground: string;
  wall: string;
  wallShade: string;
  roof: string;
  trim: string;
  glass: string;
  door: string;
}

export interface WindowSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Boarded up: drawn as planks instead of glass. */
  boarded: boolean;
  /** Cracked or dark: lit windows read as occupied and cared for. */
  lit: boolean;
  /** Georgian-style muntin bars, for older houses. */
  panes: boolean;
}

export interface ShrubSpec {
  x: number;
  r: number;
  /** Overgrown shrubs are taller and raggeder. */
  wild: boolean;
}

export interface HouseArt {
  /** viewBox is always 0 0 200 140. */
  palette: HousePalette;
  /** Main massing. */
  body: { x: number; y: number; w: number; h: number };
  roof: {
    kind: 'gable' | 'hip' | 'flat' | 'mansard';
    points: string;
    /** Patches of missing shingles, as rects in roof space. */
    gaps: { x: number; y: number; w: number; h: number }[];
  };
  windows: WindowSpec[];
  door: { x: number; y: number; w: number; h: number };
  porch: { x: number; y: number; w: number; h: number; lean: number } | null;
  chimney: { x: number; y: number; w: number; h: number } | null;
  dormers: { x: number; y: number; w: number; h: number }[];
  shrubs: ShrubSpec[];
  /** Grass tufts for an unkempt yard. */
  weeds: { x: number; h: number }[];
  /** Damp/dirt streaks down the walls. */
  stains: { x: number; y: number; w: number; h: number; o: number }[];
  /** A skip in the drive while work is underway. */
  skip: boolean;
  /** Sale sign planted in the yard. */
  sign: 'none' | 'sale' | 'sold';
  /** Drives ground colour and a dusting of snow in winter. */
  season: 'spring' | 'summer' | 'autumn' | 'winter';
}

const W = 200;
const H = 140;
const GROUND_Y = 118;

/** Warm daylight for a cared-for house, cold and grey for a wreck. */
function palette(condition: number, renovating: boolean, day: number): HousePalette {
  const c = Math.max(0, Math.min(1, condition));
  // Wall colour desaturates and darkens as condition falls.
  const wallLight = 62 + c * 24;
  const wallSat = 6 + c * 16;
  const hue = 32;

  const season = seasonOf(day);
  const ground =
    season === 'winter'
      ? '#3a4048'
      : season === 'autumn'
        ? c > 0.55
          ? '#4a4526'
          : '#3a3520'
        : c > 0.55
          ? '#24402c'
          : '#2a2b22';

  return {
    sky: renovating ? '#1a2230' : c > 0.6 ? '#16202e' : '#141a24',
    ground,
    wall: `hsl(${hue} ${wallSat}% ${wallLight}%)`,
    wallShade: `hsl(${hue} ${wallSat}% ${wallLight - 12}%)`,
    roof: c > 0.5 ? '#3d4654' : '#332f2c',
    trim: c > 0.55 ? '#e8e4dc' : '#8a8479',
    glass: c > 0.5 ? '#7fb2e0' : '#2b3440',
    door: c > 0.5 ? '#8a4b32' : '#4a3a30',
  };
}

export function buildHouseArt(prop: HouseSubject, day = 150): HouseArt {
  const rng = new Rng(prop.noiseSeed);
  const c = Math.max(0, Math.min(1, prop.condition));
  const done = new Set(prop.completedWork);
  const renovating = !!prop.renovating;

  // Any defect that is known and unrepaired makes the house look worse than
  // condition alone suggests -- that is the point of an inspection.
  const knownDefects = prop.defects.filter((d) => d.revealed && !d.repaired).length;

  // --- massing -----------------------------------------------------------
  const big = Math.max(0, Math.min(1, (prop.sqft - 650) / (2800 - 650)));
  const twoStorey =
    prop.archetypeId === 'colonial' ||
    prop.archetypeId === 'victorian' ||
    prop.archetypeId === 'townhouse';

  const bodyW = 78 + big * 54;
  const bodyH = twoStorey ? 52 : 36;
  const bodyX = (W - bodyW) / 2;
  const bodyY = GROUND_Y - bodyH;

  // --- roof --------------------------------------------------------------
  const kind: HouseArt['roof']['kind'] =
    prop.archetypeId === 'condo'
      ? 'flat'
      : prop.archetypeId === 'victorian'
        ? 'mansard'
        : prop.archetypeId === 'ranch' || prop.archetypeId === 'duplex'
          ? 'hip'
          : 'gable';

  const eaveY = bodyY;
  const overhang = 7;
  const peakH = kind === 'flat' ? 6 : kind === 'mansard' ? 26 : 22 + big * 8;
  const peakY = eaveY - peakH;

  let points: string;
  if (kind === 'flat') {
    points = `${bodyX - 4},${eaveY} ${bodyX + bodyW + 4},${eaveY} ${bodyX + bodyW + 4},${eaveY - 6} ${bodyX - 4},${eaveY - 6}`;
  } else if (kind === 'hip') {
    points = `${bodyX - overhang},${eaveY} ${bodyX + bodyW * 0.3},${peakY} ${bodyX + bodyW * 0.7},${peakY} ${bodyX + bodyW + overhang},${eaveY}`;
  } else if (kind === 'mansard') {
    points = `${bodyX - overhang},${eaveY} ${bodyX - 2},${peakY + 10} ${bodyX + bodyW * 0.5},${peakY} ${bodyX + bodyW + 2},${peakY + 10} ${bodyX + bodyW + overhang},${eaveY}`;
  } else {
    points = `${bodyX - overhang},${eaveY} ${bodyX + bodyW / 2},${peakY} ${bodyX + bodyW + overhang},${eaveY}`;
  }

  // Missing shingles. A replaced roof is always sound regardless of condition.
  const roofSound = done.has('roof_replace');
  const gapCount = roofSound ? 0 : Math.round((1 - c) * 7 + knownDefects * 0.5);
  const gaps = Array.from({ length: Math.min(9, gapCount) }, () => ({
    x: bodyX + rng.float(4, bodyW - 10),
    y: peakY + rng.float(4, Math.max(6, peakH - 4)),
    w: rng.float(4, 9),
    h: rng.float(2, 4),
  }));

  // --- windows -----------------------------------------------------------
  const windowsNew = done.has('windows_replace');
  const period = prop.yearBuilt < 1945;
  const cols = Math.max(2, Math.min(5, Math.round(2 + big * 3)));
  const rows = twoStorey ? 2 : 1;
  const winW = 13;
  const winH = 16;
  const spanW = cols * winW + (cols - 1) * 10;
  const startX = bodyX + (bodyW - spanW) / 2;

  const windows: WindowSpec[] = [];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      // Leave a gap on the ground floor for the door.
      const isDoorSlot = r === rows - 1 && i === Math.floor(cols / 2);
      if (isDoorSlot) continue;
      const boarded = !windowsNew && rng.next() < (1 - c) * 0.55;
      windows.push({
        x: startX + i * (winW + 10),
        y: bodyY + 8 + r * (winH + 12),
        w: winW,
        h: winH,
        boarded,
        lit: !boarded && c > 0.62 && rng.chance(0.45),
        panes: period && !windowsNew,
      });
    }
  }

  const doorW = 14;
  const door = {
    x: bodyX + bodyW / 2 - doorW / 2,
    y: GROUND_Y - 24,
    w: doorW,
    h: 24,
  };

  // --- period details ----------------------------------------------------
  const porch =
    period && prop.archetypeId !== 'condo'
      ? {
          x: bodyX - 4,
          y: GROUND_Y - 20,
          w: bodyW + 8,
          h: 20,
          // A neglected porch sags.
          lean: (1 - c) * 2.4,
        }
      : null;

  const chimney =
    kind !== 'flat' && rng.chance(0.7)
      ? { x: bodyX + bodyW * rng.float(0.62, 0.8), y: peakY + 2, w: 8, h: peakH * 0.8 + 8 }
      : null;

  const dormers =
    twoStorey && kind === 'gable' && rng.chance(0.5)
      ? [
          { x: bodyX + bodyW * 0.28, y: peakY + peakH * 0.45, w: 14, h: 11 },
          { x: bodyX + bodyW * 0.58, y: peakY + peakH * 0.45, w: 14, h: 11 },
        ]
      : [];

  // --- yard --------------------------------------------------------------
  // Overgrowth is reserved for genuinely neglected houses. A looser threshold
  // put weeds on merely dated ones, which made the yard stop distinguishing
  // anything.
  const landscaped = done.has('landscaping_curb');
  const wild = !landscaped && c < 0.42;
  const shrubs = Array.from({ length: landscaped ? 4 : rng.int(1, 3) }, (_, i) => ({
    x: bodyX + (i + 0.5) * (bodyW / (landscaped ? 4 : 3)) + rng.float(-6, 6),
    r: landscaped ? rng.float(5, 7) : rng.float(3, 9),
    wild,
  }));

  const weeds = wild
    ? Array.from({ length: rng.int(8, 16) }, () => ({
        x: rng.float(6, W - 6),
        h: rng.float(3, 8),
      }))
    : [];

  // --- wear --------------------------------------------------------------
  const sidingNew = done.has('siding_exterior') || done.has('paint_interior');
  const stainCount = sidingNew ? 0 : Math.round((1 - c) * 5);
  const stains = Array.from({ length: stainCount }, () => ({
    x: bodyX + rng.float(4, bodyW - 10),
    y: bodyY + rng.float(2, 8),
    w: rng.float(3, 7),
    h: rng.float(10, bodyH - 6),
    o: rng.float(0.05, 0.16),
  }));

  return {
    palette: palette(c, renovating, day),
    body: { x: bodyX, y: bodyY, w: bodyW, h: bodyH },
    roof: { kind, points, gaps },
    windows,
    door,
    porch,
    chimney,
    dormers,
    shrubs,
    weeds,
    stains,
    skip: renovating,
    sign: prop.forSale ? 'sale' : 'none',
    season: seasonOf(day),
  };
}

/**
 * Which season the scene is in.
 *
 * Seasonality is mechanically real -- the spring selling market is worth about
 * 3% on value -- and until now was completely invisible. Day 1 is 1 March, so
 * the offset puts winter where December falls.
 */
export function seasonOf(day: number): HouseArt['season'] {
  const doy = (day + 59) % 365;
  if (doy < 60) return 'spring';
  if (doy < 152) return 'summer';
  if (doy < 244) return 'summer';
  if (doy < 305) return 'autumn';
  return 'winter';
}

export const HOUSE_VIEWBOX = `0 0 ${W} ${H}`;
export const HOUSE_GROUND_Y = GROUND_Y;
export const HOUSE_W = W;
export const HOUSE_H = H;
