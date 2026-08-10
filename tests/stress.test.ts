import { describe, expect, it } from 'vitest';
import { ARV_DELTAS, COST_DELTAS, describeResilience, stressTest } from '../src/engine';
import type { AnalyzerInputs } from '../src/engine/analyzer';
import { projectDeal } from '../src/engine/analyzer';

/** A comfortable deal: 250k ARV, 40k of work, two months of schedule. */
function inputs(over: Partial<AnalyzerInputs> = {}): AnalyzerInputs {
  return {
    arv: 250_000,
    repairEstimate: 40_000,
    renovationDays: 40,
    marketingDays: 25,
    targetProfitRate: 0.15,
    useFinancing: false,
    ...over,
  };
}

const CARRY = 45;
const RATE = 0.11;

describe('the stress table', () => {
  it('is the same size as its axes', () => {
    const t = stressTest(150_000, inputs(), CARRY, RATE);
    expect(t.rows).toHaveLength(COST_DELTAS.length);
    for (const row of t.rows) expect(row).toHaveLength(ARV_DELTAS.length);
  });

  it('agrees with the engine at the unshocked cell', () => {
    // The whole value of the table depends on it being computed by the same
    // function that prices a real offer. If these ever diverge the tool is
    // worse than useless, because it is confidently wrong.
    const i = inputs();
    const offer = 150_000;
    const direct = projectDeal(offer, i, CARRY, RATE);
    const t = stressTest(offer, i, CARRY, RATE);
    expect(t.base.profit).toBe(direct.profit);

    const baseCell = t.rows[0][ARV_DELTAS.indexOf(0)];
    expect(baseCell.profit).toBe(direct.profit);
  });

  it('gets worse as ARV falls and as costs rise', () => {
    const t = stressTest(150_000, inputs(), CARRY, RATE);
    for (const row of t.rows) {
      for (let c = 1; c < row.length; c++) {
        // Columns run from the worst ARV miss to the best.
        expect(row[c].profit).toBeGreaterThan(row[c - 1].profit);
      }
    }
    for (let r = 1; r < t.rows.length; r++) {
      for (let c = 0; c < t.rows[r].length; c++) {
        expect(t.rows[r][c].profit).toBeLessThan(t.rows[r - 1][c].profit);
      }
    }
  });

  it('finds the ARV miss that breaks the deal, and it checks out', () => {
    const i = inputs();
    const offer = 150_000;
    const t = stressTest(offer, i, CARRY, RATE);
    expect(t.breakEvenArvDelta).not.toBeNull();

    // At the break-even point profit is ~0; a little worse and it is negative.
    const atBreak = projectDeal(
      offer,
      { ...i, arv: Math.round(i.arv * (1 + t.breakEvenArvDelta!)) },
      CARRY,
      RATE,
    );
    expect(Math.abs(atBreak.profit)).toBeLessThan(600);

    const past = projectDeal(
      offer,
      { ...i, arv: Math.round(i.arv * (1 + t.breakEvenArvDelta! - 0.02)) },
      CARRY,
      RATE,
    );
    expect(past.profit).toBeLessThan(0);
  });

  it('finds the overrun that breaks the deal, and it checks out', () => {
    const i = inputs();
    const offer = 150_000;
    const t = stressTest(offer, i, CARRY, RATE);
    expect(t.breakEvenCostDelta).not.toBeNull();
    expect(t.breakEvenCostDelta!).toBeGreaterThan(0);

    const atBreak = projectDeal(
      offer,
      { ...i, repairEstimate: Math.round(i.repairEstimate * (1 + t.breakEvenCostDelta!)) },
      CARRY,
      RATE,
    );
    expect(Math.abs(atBreak.profit)).toBeLessThan(600);
  });

  it('reports no break-even for a deal that never works', () => {
    // Paying far too much: underwater at every point on the grid.
    const t = stressTest(240_000, inputs(), CARRY, RATE);
    expect(t.base.profit).toBeLessThan(0);
    expect(t.breakEvenArvDelta).toBeNull();
    expect(t.survivalRate).toBe(0);
    expect(describeResilience(t)).toMatch(/nothing to stress-test/i);
  });

  it('separates two deals with the same projected profit but different room', () => {
    // This is the case a single point estimate cannot express, and the reason
    // the table exists. Same profit, very different exposure: the thin one
    // carries a much larger repair bill against the same value.
    const cheapWork = inputs({ arv: 250_000, repairEstimate: 20_000 });
    const heavyWork = inputs({ arv: 250_000, repairEstimate: 90_000 });

    const a = stressTest(163_000, cheapWork, CARRY, RATE);
    const b = stressTest(93_000, heavyWork, CARRY, RATE);

    // Comparable profit at plan...
    expect(Math.abs(a.base.profit - b.base.profit)).toBeLessThan(4_000);
    // ...but the heavy-rehab deal is far more exposed to a budget overrun,
    // because the same percentage overrun is a much bigger number.
    expect(b.breakEvenCostDelta!).toBeLessThan(a.breakEvenCostDelta!);
  });

  it('describes resilience in terms of room for error, not profit', () => {
    const t = stressTest(150_000, inputs(), CARRY, RATE);
    const text = describeResilience(t);
    expect(text).toMatch(/breaks|survives/i);
    expect(text).toMatch(/%/);
    // It must never claim the deal survives both shocks at once. Each
    // threshold is solved with the other held at plan, and joining them with
    // "and" would be a much stronger claim than the maths supports.
    expect(text).toMatch(/on its own/i);
    expect(text).not.toMatch(/optimistic and/i);
  });

  it('counts how much of the grid survives', () => {
    const comfortable = stressTest(120_000, inputs(), CARRY, RATE);
    const tight = stressTest(185_000, inputs(), CARRY, RATE);
    expect(comfortable.survivalRate).toBeGreaterThan(tight.survivalRate);
    expect(comfortable.survivalRate).toBeLessThanOrEqual(1);
    expect(tight.survivalRate).toBeGreaterThanOrEqual(0);
  });
});
