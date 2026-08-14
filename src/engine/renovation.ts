import { DEFECTS_BY_ID, SCOPE_BY_ID } from './content';
import { eventModifiers } from './events';
import { defectRepairCost, defectRepairDays } from './valuation';
import { changeOrderReduction, renovationDiscount } from './reputation';
import type { PermitStatus } from './permits';
import type {
  Money,
  Property,
  RenovationJob,
  ScopeLineItem,
  SkillId,
  WorldState,
} from './types';

/**
 * Scope of work, quoting, and change orders.
 *
 * The change order mechanic is the part worth explaining. When you buy a
 * house, some of its defects are hidden. An inspection reveals a fraction of
 * them; the rest stay hidden until a crew opens a wall. At that point the work
 * is unavoidable and it lands as a change order against your contingency.
 * Budget too little contingency and the overage comes straight out of cash,
 * usually at the worst possible moment.
 */

/** A scope line referring to curing a known defect rather than an upgrade. */
export const DEFECT_PREFIX = 'defect:';

export function isDefectScopeId(itemId: string): boolean {
  return itemId.startsWith(DEFECT_PREFIX);
}

export function defectIdFromScopeId(itemId: string): string {
  return itemId.slice(DEFECT_PREFIX.length);
}

export function scopeIdForDefect(defectId: string): string {
  return `${DEFECT_PREFIX}${defectId}`;
}

export interface Quote {
  cost: Money;
  days: number;
  label: string;
}

function managementCostFactor(skill: number): number {
  // Better project management buys you materials cheaper and wastes less.
  return Math.max(0.7, 1 - 0.035 * skill);
}

function managementTimeFactor(skill: number): number {
  return Math.max(0.65, 1 - 0.05 * skill);
}

/** Price and schedule a single scope line for a specific property. */
/**
 * How your own crew changes a quote, if you have one.
 *
 * Passed in rather than read from state so this module stays free of the game
 * loop, and defaulted to neutral so every existing caller is unaffected.
 */
export interface CrewEffect {
  cost: number;
  time: number;
}

const NO_CREW: CrewEffect = { cost: 1, time: 1 };

export function quoteScopeItem(
  itemId: string,
  prop: Property,
  world: WorldState,
  skills: Record<SkillId, number>,
  /** Contractor standing, 0-100. Crews price a reliable client better. */
  contractorReputation = 50,
  crew: CrewEffect = NO_CREW,
): Quote | null {
  const mods = eventModifiers(world, prop.neighborhoodId);
  const costFactor =
    mods.costMultiplier *
    managementCostFactor(skills.management) *
    (1 - renovationDiscount(contractorReputation)) *
    crew.cost;
  const timeFactor = mods.timeMultiplier * managementTimeFactor(skills.management) * crew.time;

  if (isDefectScopeId(itemId)) {
    const defId = defectIdFromScopeId(itemId);
    const def = DEFECTS_BY_ID[defId];
    if (!def) return null;
    return {
      cost: Math.round(defectRepairCost(defId, prop) * costFactor),
      days: Math.max(1, Math.round(defectRepairDays(defId, prop) * timeFactor)),
      label: `Repair: ${def.name}`,
    };
  }

  const item = SCOPE_BY_ID[itemId];
  if (!item) return null;
  const raw = item.baseCost + item.costPerSqft * prop.sqft;
  return {
    cost: Math.round(raw * costFactor),
    days: Math.max(1, Math.round(item.days * timeFactor)),
    label: item.name,
  };
}

/**
 * Price a whole scope. Days are not simply summed -- a real crew overlaps
 * trades, so the schedule is the longest task plus a fraction of the rest.
 */
export function quoteScope(
  itemIds: readonly string[],
  prop: Property,
  world: WorldState,
  skills: Record<SkillId, number>,
  contractorReputation = 50,
  crew: CrewEffect = NO_CREW,
): { lines: ScopeLineItem[]; totalCost: Money; totalDays: number } {
  const lines: ScopeLineItem[] = [];
  let totalCost = 0;
  const dayList: number[] = [];

  for (const id of itemIds) {
    const q = quoteScopeItem(id, prop, world, skills, contractorReputation, crew);
    if (!q) continue;
    lines.push({
      itemId: id,
      quotedCost: q.cost,
      quotedDays: q.days,
      changeOrder: false,
      defectId: isDefectScopeId(id) ? defectIdFromScopeId(id) : undefined,
    });
    totalCost += q.cost;
    dayList.push(q.days);
  }

  return { lines, totalCost, totalDays: scheduleDays(dayList) };
}

/**
 * Trades overlap, so a 10-day kitchen and a 6-day floor is not 16 days of
 * calendar time. Longest task, plus 55% of everything else.
 */
export function scheduleDays(days: readonly number[]): number {
  if (days.length === 0) return 0;
  const sorted = [...days].sort((a, b) => b - a);
  const rest = sorted.slice(1).reduce((s, d) => s + d, 0);
  return Math.max(1, Math.round(sorted[0] + rest * 0.55));
}

export function createJob(
  lines: ScopeLineItem[],
  totalDays: number,
  contingency: Money,
  startedDay: number,
  permit: PermitStatus | null = null,
): RenovationJob {
  return {
    lines,
    totalDays,
    daysElapsed: 0,
    contingencyRemaining: contingency,
    contingencyBudgeted: contingency,
    spent: lines.reduce((s, l) => s + l.quotedCost, 0),
    startedDay,
    permit,
  };
}

/** Probability that a given hidden defect surfaces on any one work day. */
export function changeOrderChance(managementSkill: number, contractorReputation = 50): number {
  const base = Math.max(0.02, 0.065 - 0.007 * managementSkill);
  // A crew that trusts you flags things early and prices them sanely, so
  // fewer surprises land as formal change orders mid-job.
  return Math.max(0.01, base * (1 - changeOrderReduction(contractorReputation)));
}

export function jobProgress(job: RenovationJob): number {
  if (job.totalDays <= 0) return 1;
  return Math.min(1, job.daysElapsed / job.totalDays);
}

export function jobDaysRemaining(job: RenovationJob): number {
  return Math.max(0, job.totalDays - job.daysElapsed);
}

/**
 * The order trades actually run in.
 *
 * Structure and systems come before anything that covers them up, finishes go
 * in after, and curb appeal is last because it is the first thing to get
 * damaged by everything else. Used only to decide what a half-finished house
 * should look like -- the engine still applies every line at completion, so
 * this cannot affect a valuation.
 */
const TRADE_ORDER: Record<string, number> = {
  structural: 0,
  systems: 1,
  additions: 2,
  kitchen: 3,
  bathrooms: 4,
  cosmetic: 5,
  exterior: 6,
  marketing: 7,
};

function tradeRank(line: ScopeLineItem): number {
  // Change orders sort last regardless of trade, because they are discovered
  // partway through: the work already finished does not un-finish itself
  // because somebody found termites. Ranking them by trade instead let a
  // mid-job defect repair insert itself ahead of a completed roof, which made
  // the holes reappear in the picture.
  if (line.changeOrder) return 100;
  // A planned defect repair is remedial and does go first, before anything is
  // closed up over the top of it.
  if (isDefectScopeId(line.itemId)) return -1;
  const category = SCOPE_BY_ID[line.itemId]?.category;
  return TRADE_ORDER[category ?? 'cosmetic'] ?? 5;
}

/**
 * Which line items a job has plausibly finished by now.
 *
 * Purely for the picture. The schedule the engine runs is a single total
 * rather than a per-line plan -- trades overlap, which is why the total is the
 * longest task plus a fraction of the rest -- so this apportions each line's
 * quoted days across that total in trade order. It is an approximation, and it
 * is the honest kind: a roof that has been replaced stops having holes in it
 * partway through the job rather than snapping into place on the last day.
 */
export function workFinishedSoFar(job: RenovationJob): string[] {
  const progress = jobProgress(job);
  if (progress >= 1) return job.lines.map((l) => l.itemId);

  const ordered = [...job.lines].sort((a, b) => tradeRank(a) - tradeRank(b));
  const totalQuoted = ordered.reduce((s, l) => s + Math.max(1, l.quotedDays), 0);
  if (totalQuoted <= 0) return [];

  const done: string[] = [];
  let cumulative = 0;
  for (const line of ordered) {
    cumulative += Math.max(1, line.quotedDays);
    if (cumulative / totalQuoted <= progress) done.push(line.itemId);
    else break;
  }
  return done;
}

/**
 * Apply a saved template to the current scope selection.
 *
 * A template swaps out the *discretionary* line items and leaves everything
 * else alone. Two things are deliberately preserved:
 *
 *   - Defect repairs. They are not discretionary -- skipping one does not save
 *     the money, it defers it into a buyer concession at 1.15x. An earlier
 *     version replaced the whole selection, so clicking a template silently
 *     unticked a foundation repair the player had just budgeted for, which is
 *     the exact mistake the game exists to warn against.
 *   - Work already completed, which cannot be scoped again.
 */
export function mergeTemplate(
  currentScope: readonly string[],
  templateIds: readonly string[],
  completedWork: readonly string[],
): string[] {
  const keep = currentScope.filter((id) => isDefectScopeId(id));
  const fresh = templateIds.filter(
    (id) => !completedWork.includes(id) && !isDefectScopeId(id),
  );
  return [...new Set([...keep, ...fresh])];
}

/** Scope items that are still worth offering for this property. */
export function availableScopeItems(prop: Property): string[] {
  return Object.keys(SCOPE_BY_ID).filter((id) => !prop.completedWork.includes(id));
}
