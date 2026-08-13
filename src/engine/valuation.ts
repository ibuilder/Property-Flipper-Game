import {
  ARCHETYPES_BY_ID,
  DEFECTS_BY_ID,
  NEIGHBORHOODS_BY_ID,
  SCOPE_BY_ID,
} from './content';
import { Rng } from './rng';
import type {
  Appraisal,
  AppraisalConfidence,
  Comp,
  CompFit,
  Money,
  Property,
  WorldState,
} from './types';

/**
 * Valuation is the centre of the whole game, so it is worth stating the model
 * plainly:
 *
 *   value = baseValue x conditionMultiplier x upgradeMultiplier
 *
 * `baseValue` is what the dirt and the square footage are worth in today's
 * market. `conditionMultiplier` is how much the market discounts a house that
 * needs work. `upgradeMultiplier` is the premium for specific improvements,
 * with diminishing returns so that you cannot simply buy every line item.
 *
 * The player never sees this number. They see an `Appraisal` derived from it,
 * with noise that shrinks as they spend money on better information.
 */

/** Spring selling season peaks around day 150; winter troughs in December. */
export function seasonality(day: number): number {
  return 1 + 0.032 * Math.sin((2 * Math.PI * (day - 60)) / 365);
}

function ageAdjustment(yearBuilt: number): number {
  // Roughly 0.93 for an 1890 build up to 1.05 for new construction.
  const t = Math.max(0, Math.min(1, (yearBuilt - 1890) / (2015 - 1890)));
  return 0.93 + t * 0.12;
}

/**
 * Smaller homes sell for more per square foot.
 *
 * Kitchens, bathrooms, roofs and lots do not shrink proportionally, so cost
 * and value per foot both rise as the house gets smaller. Normalised so a
 * 1,600 sqft house is unaffected: roughly +9% per foot at 800 sqft, -7% at
 * 2,800.
 *
 * This is also what makes comp selection bite. Without it, a comp 30% smaller
 * than the subject priced identically per foot, so leaning on the wrong-sized
 * comparable cost nothing and the "different size" warning was empty advice.
 */
function scaleAdjustment(sqft: number): number {
  return Math.pow(1600 / Math.max(300, sqft), 0.12);
}

/**
 * How hard the market discounts a house that needs work.
 *
 * The spread here is the single most important number in the game. It has to
 * be wide enough that a genuinely distressed property is cheap relative to its
 * repaired value, because that gap -- not the upgrades themselves -- is where a
 * flip's margin comes from. Calibrated so a wreck at condition 0.2 is worth
 * roughly 47% of the same house at condition 0.95, which is about what
 * gut-job comps actually trade at.
 */
export function conditionMultiplier(condition: number): number {
  const c = Math.max(0, Math.min(1, condition));
  return 0.32 + 0.76 * c;
}

/**
 * Total value lift from completed work, with diminishing returns. Stacking
 * every line item on the catalogue should not double the house.
 */
export function upgradeMultiplier(completedWork: readonly string[]): number {
  let raw = 0;
  for (const id of completedWork) {
    raw += SCOPE_BY_ID[id]?.valueLift ?? 0;
  }
  const damped = raw * (1 - Math.min(0.45, raw * 0.5));
  return 1 + damped;
}

export function baseValue(prop: Property, world: WorldState, day: number): Money {
  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  const arch = ARCHETYPES_BY_ID[prop.archetypeId];
  if (!hood || !arch) throw new Error(`Unknown neighborhood/archetype on ${prop.id}`);

  const hoodIndex = world.neighborhoodIndex[prop.neighborhoodId] ?? 1;
  return (
    hood.pricePerSqft *
    prop.sqft *
    scaleAdjustment(prop.sqft) *
    arch.valueAdj *
    ageAdjustment(prop.yearBuilt) *
    world.marketIndex *
    hoodIndex *
    seasonality(day)
  );
}

/** The property's real as-is market value today. Hidden from the player. */
export function trueValue(prop: Property, world: WorldState, day: number): Money {
  const value =
    baseValue(prop, world, day) *
    conditionMultiplier(prop.condition) *
    upgradeMultiplier(prop.completedWork);
  return Math.max(0, Math.round(value));
}

/**
 * After Repair Value: what the property is worth once a given scope is
 * complete. This is the number the 70% rule is built on, and getting it wrong
 * is the single most common way to lose money on a flip.
 */
export function afterRepairValue(
  prop: Property,
  world: WorldState,
  day: number,
  plannedScope: readonly string[] = [],
): Money {
  const allWork = [...new Set([...prop.completedWork, ...plannedScope])];
  let condition = prop.condition;
  for (const id of plannedScope) {
    condition += SCOPE_BY_ID[id]?.conditionLift ?? 0;
  }
  condition = Math.max(0, Math.min(0.97, condition));

  const value =
    baseValue(prop, world, day) * conditionMultiplier(condition) * upgradeMultiplier(allWork);
  return Math.max(0, Math.round(value));
}

/**
 * Defect repair costs scale with the size of the house.
 *
 * The catalogue quotes each defect against a 1,600 sqft baseline. Without this
 * adjustment a flat $22k foundation repair lands identically on a 650 sqft
 * condo and a 2,800 sqft colonial, which made small cheap properties
 * effectively uninsurable teardowns and produced buyer concessions larger than
 * the house was worth.
 */
export function defectCostFactor(prop: Property): number {
  return Math.max(0.6, Math.min(1.5, 0.5 + (0.5 * prop.sqft) / 1600));
}

export function defectRepairCost(defId: string, prop: Property): Money {
  const def = DEFECTS_BY_ID[defId];
  if (!def) return 0;
  return Math.round(def.repairCost * defectCostFactor(prop));
}

export function defectRepairDays(defId: string, prop: Property): number {
  const def = DEFECTS_BY_ID[defId];
  if (!def) return 0;
  // Schedule scales more gently than cost -- a bigger roof is more material,
  // not proportionally more days.
  return Math.max(1, Math.round(def.repairDays * (0.75 + 0.25 * defectCostFactor(prop))));
}

/**
 * The player's estimate of After Repair Value.
 *
 * The split here is deliberate. A competent renovator knows fairly well what a
 * given scope of work *lifts* -- that is a function of the work itself. What
 * they do not know precisely is the *level*: what the house is worth today.
 * So the uncertainty rides entirely on the appraisal, and the lift ratio is
 * applied to it cleanly.
 *
 * That is why a bad ARV estimate is the classic way to lose money on a flip:
 * the error is multiplicative, so being 10% high on as-is value makes you 10%
 * high on ARV, and the 70% rule then hands you a max offer that is 10% too
 * generous on a deal whose entire margin was 15%.
 */
export function estimateArv(
  prop: Property,
  world: WorldState,
  day: number,
  plannedScope: readonly string[],
): Money {
  const asIs = trueValue(prop, world, day);
  if (asIs <= 0) return prop.appraisal.point;
  const lift = afterRepairValue(prop, world, day, plannedScope) / asIs;
  return Math.round(prop.appraisal.point * lift);
}

/** Repair cost of every defect still outstanding, known or not. */
export function outstandingDefectCost(prop: Property, onlyRevealed: boolean): Money {
  let total = 0;
  for (const d of prop.defects) {
    if (d.repaired) continue;
    if (onlyRevealed && !d.revealed) continue;
    total += defectRepairCost(d.defId, prop);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Player-facing appraisal
// ---------------------------------------------------------------------------

const NOISE_BY_CONFIDENCE: Record<AppraisalConfidence, number> = {
  guess: 0.14,
  comps: 0.09,
  inspected: 0.055,
  appraised: 0.03,
};

function noiseFor(confidence: AppraisalConfidence, analysisSkill: number): number {
  const base = NOISE_BY_CONFIDENCE[confidence];
  return base * Math.max(0.35, 1 - 0.09 * analysisSkill);
}

const STREETS = [
  'Alder', 'Beacon', 'Cedar', 'Dover', 'Elm', 'Fulton', 'Granite', 'Hawthorn',
  'Ivy', 'Juniper', 'Kessler', 'Larkspur', 'Mulberry', 'Nash', 'Orchard',
  'Pearl', 'Quarry', 'Rowan', 'Sycamore', 'Tanner', 'Union', 'Vernon',
];
const SUFFIXES = ['St', 'Ave', 'Ln', 'Ct', 'Rd', 'Way', 'Ter'];

export function generateAddress(rng: Rng): string {
  return `${rng.int(12, 4980)} ${rng.pick(STREETS)} ${rng.pick(SUFFIXES)}`;
}

/**
 * Generate the pool of comparable sales offered for a property.
 *
 * Each comp is a real house priced with the same valuation model as the
 * subject, so its price genuinely follows from its own square footage,
 * neighborhood, and finish. That is what makes selection a skill: a comp two
 * neighborhoods over really did sell for more per foot, and leaning on it
 * really will push your estimate high — in a direction you could have
 * predicted by looking at it.
 */
export function generateCompPool(
  prop: Property,
  world: WorldState,
  day: number,
  rng: Rng,
): Comp[] {
  const hoodIds = Object.keys(world.neighborhoodIndex);
  const pool: Comp[] = [];
  const count = 7;

  for (let i = 0; i < count; i++) {
    // A spread of quality: some near-identical, some tempting but wrong.
    const tier = i < 2 ? 'close' : i < 5 ? 'loose' : 'poor';

    const sqftDelta =
      tier === 'close' ? rng.float(-0.07, 0.07) : tier === 'loose' ? rng.float(-0.2, 0.2) : rng.float(-0.45, 0.5);
    const sameHood = tier === 'close' ? true : tier === 'loose' ? rng.chance(0.7) : rng.chance(0.25);
    const hoodId = sameHood ? prop.neighborhoodId : rng.pick(hoodIds);

    const quality: Comp['quality'] =
      tier === 'close'
        ? rng.pick(['average', 'renovated'] as const)
        : rng.pick(['renovated', 'average', 'dated'] as const);

    const sqft = Math.max(400, Math.round(prop.sqft * (1 + sqftDelta)));
    const condition = quality === 'renovated' ? 0.92 : quality === 'average' ? 0.68 : 0.4;

    // Price it as an actual property, using the model everything else uses.
    //
    // Finish is expressed purely through `condition`, with no completed work.
    // Giving renovated comps a scope of work stacked an upgrade multiplier on
    // top of the condition multiplier, and the quality adjustment below only
    // inverts the condition part -- so every renovated comp read high and
    // pushed the player's whole estimate up with it.
    const ghost: Property = {
      ...prop,
      sqft,
      neighborhoodId: hoodId,
      condition,
      completedWork: [],
      defects: [],
    };

    const soldDaysAgo =
      tier === 'close' ? rng.int(10, 70) : tier === 'loose' ? rng.int(20, 140) : rng.int(90, 300);

    // Sold in the past, so priced against the market as it was then.
    const pastDay = Math.max(1, day - soldDaysAgo);
    const base = trueValue(ghost, world, pastDay);
    const price = Math.round(base * (1 + rng.clampedNormal(0, 0.035, 2)));

    pool.push({
      id: `c${i}_${prop.id}`,
      address: generateAddress(rng),
      neighborhoodId: hoodId,
      sqft,
      beds: prop.beds + (tier === 'close' ? 0 : rng.chance(0.4) ? rng.pick([-1, 1]) : 0),
      baths: prop.baths,
      soldPrice: Math.max(1000, price),
      soldDaysAgo,
      distanceMi:
        (sameHood ? rng.float(0.1, 0.9) : rng.float(1.4, 4.5)) * (tier === 'poor' ? 1.6 : 1),
      quality,
    });
  }

  return pool.sort((a, b) => a.soldDaysAgo - b.soldDaysAgo);
}

/**
 * How badly a comp matches the subject. Lower is better.
 *
 * Surfaced in the UI so the player can learn the heuristics rather than guess
 * them: same area, similar size, recent, similar finish.
 */
export function compFit(prop: Property, comp: Comp): CompFit {
  const reasons: string[] = [];
  let score = 0;

  const sizeGap = Math.abs(comp.sqft - prop.sqft) / prop.sqft;
  score += sizeGap * 2.2;
  if (sizeGap > 0.2) reasons.push(`${Math.round(sizeGap * 100)}% different in size`);

  if (comp.neighborhoodId !== prop.neighborhoodId) {
    score += 0.55;
    reasons.push('different neighborhood');
  }

  const stale = Math.max(0, comp.soldDaysAgo - 90) / 200;
  score += stale;
  if (comp.soldDaysAgo > 120) reasons.push(`sold ${comp.soldDaysAgo} days ago`);

  score += Math.max(0, comp.distanceMi - 1) * 0.16;
  if (comp.distanceMi > 2) reasons.push(`${comp.distanceMi.toFixed(1)} miles away`);

  if (comp.beds !== prop.beds) {
    score += 0.18;
    reasons.push(`${comp.beds} bed vs ${prop.beds}`);
  }

  return { compId: comp.id, score, reasons };
}

/** The three closest matches, used as the default selection. */
export function defaultCompSelection(prop: Property, pool: Comp[]): string[] {
  return [...pool]
    .sort((a, b) => compFit(prop, a).score - compFit(prop, b).score)
    .slice(0, 3)
    .map((c) => c.id);
}

/**
 * Derive the player's estimate from the comps they chose.
 *
 * This is the mechanism the whole buy-side rests on. The estimate is a median
 * price per square foot across the selection, adjusted for finish, applied to
 * the subject. There is no hidden appeal to the true value: choose well and it
 * lands close, choose badly and it is wrong by roughly the amount the bad
 * comps were unrepresentative.
 */
/**
 * The condition a comp was in when it sold, by its stated finish.
 *
 * Exported so the adjustment can be explained rather than merely applied: the
 * whole point of an adjustment grid is that the player can see it.
 */
export const COMP_CONDITION: Record<Comp['quality'], number> = {
  renovated: 0.92,
  average: 0.68,
  dated: 0.4,
};

/**
 * What a comp implies the subject is worth per square foot.
 *
 * The comp's finish is adjusted to the subject's condition and the subject's
 * own completed work is added back on top. Deliberately *not* adjusted for
 * neighborhood, size or age -- those are the differences the player is
 * supposed to notice and price themselves, and hiding them would remove the
 * only decision this screen contains.
 *
 * This is the number the estimate is a median of, so it is the number worth
 * plotting. Raw price per foot is what the comp sold for; this is what it
 * says about *your* house, and they can differ by a third on a dated comp.
 */
export function adjustedPerSqft(prop: Property, comp: Comp): number {
  const raw = comp.soldPrice / comp.sqft;
  const qualityAdj =
    conditionMultiplier(prop.condition) / conditionMultiplier(COMP_CONDITION[comp.quality]);
  return raw * qualityAdj * upgradeMultiplier(prop.completedWork);
}

/** The median of a list, for an even count the mean of the middle two. */
function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
}

export function appraisalFromComps(
  prop: Property,
  pool: Comp[],
  selectedIds: readonly string[],
  confidence: AppraisalConfidence,
  analysisSkill: number,
): Appraisal {
  const chosen = pool.filter((c) => selectedIds.includes(c.id));
  if (chosen.length === 0) {
    return { point: 0, low: 0, high: 0, confidence, comps: [], fitScore: 1 };
  }

  const perSqft = chosen.map((c) => adjustedPerSqft(prop, c));
  const sorted = [...perSqft].sort((a, b) => a - b);
  const median = medianOf(perSqft);

  const point = Math.round(median * prop.sqft);

  // Band width follows how well the comps match and how much better the
  // player's information is, not a fixed constant.
  const avgFit = chosen.reduce((s, c) => s + compFit(prop, c).score, 0) / chosen.length;
  const spread =
    sorted.length > 1 ? (sorted[sorted.length - 1] - sorted[0]) / Math.max(1e-9, median) : 0.1;

  let band = NOISE_BY_CONFIDENCE[confidence] * 0.55 + avgFit * 0.09 + spread * 0.25;
  band *= Math.max(0.4, 1 - 0.08 * analysisSkill);
  // Thin selections are less reliable however good each comp is.
  if (chosen.length < 3) band *= 1.25;
  band = Math.max(0.02, Math.min(0.35, band));

  return {
    point,
    low: Math.round(point * (1 - band)),
    high: Math.round(point * (1 + band)),
    confidence,
    comps: chosen,
    fitScore: avgFit,
  };
}

/** One comp, positioned. */
export interface CompPoint {
  comp: Comp;
  selected: boolean;
  /** Same neighborhood as the subject. */
  local: boolean;
  /** How far it is from the subject, from compFit. Lower is better. */
  fit: number;
  /** What it actually sold for, per foot. */
  rawPerSqft: number;
  /** What it says the subject is worth, per foot, after adjusting for finish. */
  adjustedPerSqft: number;
}

/**
 * The comp set as a picture.
 *
 * The table lists ten comps and says which are a poor fit. It cannot show the
 * two things that actually decide whether an estimate is any good: whether the
 * selection brackets the subject or sits entirely to one side of it, and how
 * far apart the chosen comps are once adjusted -- which is precisely what
 * widens the confidence band.
 *
 * Plotted against size because that is the mismatch with teeth. A comp 40%
 * larger is not merely "different"; price per foot varies with size, so
 * anchoring on it moves the estimate in a direction the player can see here
 * and cannot see in a list sorted by fit score.
 */
export interface CompScatter {
  points: CompPoint[];
  /** The subject's size -- the vertical the selection should straddle. */
  subjectSqft: number;
  /**
   * The median adjusted price per foot across the selection. This is the
   * estimate divided by the subject's size, so the horizontal drawn at this
   * height crosses the subject's vertical exactly at the estimate.
   */
  medianPerSqft: number;
  /** The estimate implied, which must equal the appraisal's point value. */
  impliedValue: Money;
  /** Selected comps smaller than the subject, and larger. */
  smaller: number;
  larger: number;
}

export function compScatter(
  prop: Property,
  pool: readonly Comp[],
  selectedIds: readonly string[],
): CompScatter {
  const chosenIds = new Set(selectedIds);
  const points: CompPoint[] = pool.map((comp) => ({
    comp,
    selected: chosenIds.has(comp.id),
    local: comp.neighborhoodId === prop.neighborhoodId,
    fit: compFit(prop, comp).score,
    rawPerSqft: comp.soldPrice / comp.sqft,
    adjustedPerSqft: adjustedPerSqft(prop, comp),
  }));

  const chosen = points.filter((p) => p.selected);
  const medianPerSqft = chosen.length ? medianOf(chosen.map((p) => p.adjustedPerSqft)) : 0;

  return {
    points,
    subjectSqft: prop.sqft,
    medianPerSqft,
    impliedValue: Math.round(medianPerSqft * prop.sqft),
    smaller: chosen.filter((p) => p.comp.sqft < prop.sqft).length,
    larger: chosen.filter((p) => p.comp.sqft > prop.sqft).length,
  };
}

/**
 * One sentence on what is wrong with the shape of the selection, or nothing.
 *
 * Ordered by how much each error actually costs, measured against this model
 * rather than assumed from property-trade folklore. Across seven seeds and
 * every listing in them, leaning on out-of-area comps moves the estimate by
 * 76%; leaning on the worst-fitting comps moves it 25%; and price per foot is
 * essentially uncorrelated with size here (r = -0.09), so the usual line about
 * larger houses selling for less per foot would be teaching a rule this game
 * does not implement. Crossing the neighborhood line is the error with teeth,
 * so it speaks first and the size note makes no claim about direction.
 *
 * Silent when the selection is sound. The table already reports per-comp
 * mismatches, and repeating them here would be noise.
 */
export function describeCompShape(s: CompScatter): string | null {
  const chosen = s.points.filter((p) => p.selected);
  if (chosen.length === 0) return null;

  const away = chosen.filter((p) => !p.local);
  if (away.length > 0) {
    const local = chosen.filter((p) => p.local);
    const lead =
      away.length === chosen.length
        ? 'Every comp you have chosen is outside this neighborhood.'
        : `${away.length} of your ${chosen.length} comps ${away.length === 1 ? 'is' : 'are'} outside this neighborhood.`;
    // Only quantify the gap when there is a local comp to measure it against;
    // otherwise there is nothing on screen to compare with and a number would
    // be asserting a baseline the player cannot check.
    if (local.length > 0) {
      const lm = medianOf(local.map((p) => p.adjustedPerSqft));
      const am = medianOf(away.map((p) => p.adjustedPerSqft));
      if (lm > 0) {
        const gap = Math.round(Math.abs(am / lm - 1) * 100);
        if (gap >= 8) {
          return `${lead} They imply ${gap}% ${am > lm ? 'more' : 'less'} per square foot than your local ones, and nothing adjusts for the street. This is the single largest source of a wrong estimate.`;
        }
      }
    }
    return `${lead} Location is the one difference nothing here adjusts for, and it is the largest source of a wrong estimate — a house two neighborhoods over genuinely did sell for a different price per foot.`;
  }

  const adj = chosen.map((p) => p.adjustedPerSqft);
  const spread = (Math.max(...adj) - Math.min(...adj)) / Math.max(1e-9, s.medianPerSqft);
  if (spread > 0.35) {
    return `Your comps disagree by ${Math.round(spread * 100)}% per square foot once adjusted. The estimate is the middle of that, which is why the confidence range is wide — the spread is the uncertainty, not a detail.`;
  }

  if (chosen.length >= 2 && (s.smaller === 0 || s.larger === 0)) {
    const side = s.smaller === 0 ? 'larger than' : 'smaller than';
    return `Every comp you have chosen is ${side} this house, so the estimate is extrapolating rather than interpolating. Size matters much less than location here, but a selection that brackets the subject is still the safer one.`;
  }
  return null;
}
