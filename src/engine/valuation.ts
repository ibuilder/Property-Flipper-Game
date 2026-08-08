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

  // Adjust each comp toward the subject: its finish down or up to the
  // subject's condition, then the subject's own completed work back on top.
  // Deliberately *not* adjusted for neighborhood, size or age -- those are the
  // differences the player is supposed to notice and price themselves.
  const COMP_CONDITION: Record<Comp['quality'], number> = {
    renovated: 0.92,
    average: 0.68,
    dated: 0.4,
  };
  const subjectUpgrades = upgradeMultiplier(prop.completedWork);

  const perSqft = chosen.map((c) => {
    const raw = c.soldPrice / c.sqft;
    const qualityAdj = conditionMultiplier(prop.condition) / conditionMultiplier(COMP_CONDITION[c.quality]);
    return raw * qualityAdj * subjectUpgrades;
  });

  const sorted = [...perSqft].sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 1
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

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
