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
 * Build the estimate the player actually sees.
 *
 * Two deliberate design choices here:
 *
 * 1. The point estimate is *biased*, not merely noisy. If it were centred on
 *    the truth the player could average several looks and recover the real
 *    number for free. A real appraisal is one draw, and you live with it.
 *
 * 2. The noise is derived from the property's stable `noiseSeed`, so the
 *    estimate does not jitter every time the UI re-renders. It only moves when
 *    the player buys better information.
 */
export function makeAppraisal(
  prop: Property,
  world: WorldState,
  day: number,
  confidence: AppraisalConfidence,
  analysisSkill: number,
): Appraisal {
  const truth = trueValue(prop, world, day);
  const noise = noiseFor(confidence, analysisSkill);

  // Stable per-property, per-confidence-level bias.
  const rng = new Rng(prop.noiseSeed ^ (confidence.length * 2654435761));
  const bias = rng.clampedNormal(0, noise * 0.55, 2);
  const point = Math.round(truth * (1 + bias));

  const comps = makeComps(prop, world, day, truth, noise, rng);

  return {
    point,
    low: Math.round(point * (1 - noise)),
    high: Math.round(point * (1 + noise)),
    confidence,
    comps,
  };
}

function makeComps(
  prop: Property,
  world: WorldState,
  day: number,
  truth: Money,
  noise: number,
  rng: Rng,
): Comp[] {
  const count = 3;
  const comps: Comp[] = [];
  for (let i = 0; i < count; i++) {
    // Comps are similar but not identical homes, so their prices differ both
    // because of real differences and because of appraisal noise.
    const sqftDelta = rng.float(-0.12, 0.12);
    const sqft = Math.round(prop.sqft * (1 + sqftDelta));
    const priceNoise = rng.clampedNormal(0, noise * 0.8, 2);
    const soldPrice = Math.round(truth * (1 + sqftDelta * 0.7) * (1 + priceNoise));
    comps.push({
      address: generateAddress(rng),
      sqft,
      beds: prop.beds + (rng.chance(0.25) ? rng.pick([-1, 1]) : 0),
      baths: prop.baths,
      soldPrice: Math.max(1000, soldPrice),
      soldDaysAgo: rng.int(8, 120),
    });
  }
  return comps.sort((a, b) => a.soldDaysAgo - b.soldDaysAgo);
}
