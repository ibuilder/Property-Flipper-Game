import { DEFECTS_BY_ID, SCOPE_BY_ID } from './content';
import { eventModifiers } from './events';
import { defectRepairCost, defectRepairDays } from './valuation';
import { changeOrderReduction, renovationDiscount } from './reputation';
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
export function quoteScopeItem(
  itemId: string,
  prop: Property,
  world: WorldState,
  skills: Record<SkillId, number>,
  /** Contractor standing, 0-100. Crews price a reliable client better. */
  contractorReputation = 50,
): Quote | null {
  const mods = eventModifiers(world, prop.neighborhoodId);
  const costFactor =
    mods.costMultiplier *
    managementCostFactor(skills.management) *
    (1 - renovationDiscount(contractorReputation));
  const timeFactor = mods.timeMultiplier * managementTimeFactor(skills.management);

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
): { lines: ScopeLineItem[]; totalCost: Money; totalDays: number } {
  const lines: ScopeLineItem[] = [];
  let totalCost = 0;
  const dayList: number[] = [];

  for (const id of itemIds) {
    const q = quoteScopeItem(id, prop, world, skills, contractorReputation);
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
): RenovationJob {
  return {
    lines,
    totalDays,
    daysElapsed: 0,
    contingencyRemaining: contingency,
    contingencyBudgeted: contingency,
    spent: lines.reduce((s, l) => s + l.quotedCost, 0),
    startedDay,
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
