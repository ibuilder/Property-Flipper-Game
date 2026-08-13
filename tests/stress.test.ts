import { describe, expect, it } from 'vitest';
import { ARV_DELTAS, COST_DELTAS, describeResilience, stressField, stressTest } from '../src/engine';
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

describe('the stress field', () => {
  it('samples the axes it says it does', () => {
    const f = stressField(150_000, inputs(), CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
    expect(f.arvAt).toHaveLength(41);
    expect(f.costAt).toHaveLength(25);
    expect(f.grid).toHaveLength(25);
    for (const row of f.grid) expect(row).toHaveLength(41);
    expect(f.arvAt[0]).toBeCloseTo(-0.2);
    expect(f.arvAt[40]).toBeCloseTo(0.08);
    expect(f.costAt[0]).toBeCloseTo(0);
    expect(f.costAt[24]).toBeCloseTo(0.7);
  });

  it('is priced by the engine, not by a copy of it', () => {
    // Same contract as the table: every cell is projectDeal on shocked inputs.
    // A heat map that drifts from the pricing is a picture of nothing.
    const i = inputs();
    const offer = 150_000;
    const f = stressField(offer, i, CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
    for (const [r, c] of [
      [0, 0],
      [12, 20],
      [24, 40],
    ]) {
      const direct = projectDeal(
        offer,
        {
          ...i,
          arv: Math.round(i.arv * (1 + f.arvAt[c])),
          repairEstimate: Math.round(i.repairEstimate * (1 + f.costAt[r])),
        },
        CARRY,
        RATE,
      );
      expect(f.grid[r][c]).toBe(direct.profit);
    }
  });

  it('falls monotonically in both directions', () => {
    // The contour is interpolated per column on the assumption of a single
    // crossing. That is only sound because the surface is monotone, so the
    // assumption is worth asserting rather than trusting.
    const f = stressField(150_000, inputs(), CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
    for (const row of f.grid) {
      for (let c = 1; c < row.length; c++) expect(row[c]).toBeGreaterThan(row[c - 1]);
    }
    for (let r = 1; r < f.grid.length; r++) {
      for (let c = 0; c < f.grid[r].length; c++) {
        expect(f.grid[r][c]).toBeLessThan(f.grid[r - 1][c]);
      }
    }
  });

  it('puts the break-even line where the sign actually changes', () => {
    const f = stressField(150_000, inputs(), CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
    const found = f.breakEven.filter((p) => p !== null);
    expect(found.length).toBeGreaterThan(0);
    for (const p of found) {
      const above = Math.floor(p!.row);
      expect(f.grid[above][p!.col]).toBeGreaterThanOrEqual(0);
      expect(f.grid[above + 1][p!.col]).toBeLessThan(0);
    }
  });

  it('never bridges a gap it did not measure', () => {
    // The chart draws the contour as one polyline over the non-null columns.
    // If those columns were ever discontiguous the line would jump across the
    // gap and assert a boundary nobody computed. Monotonicity says they cannot
    // be -- columns that lose money even on budget sit entirely to the left,
    // and columns that profit even at full overrun sit entirely to the right.
    for (const offer of [120_000, 150_000, 170_000, 185_000, 210_000]) {
      const f = stressField(offer, inputs(), CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
      const cols = f.breakEven.map((p) => p !== null);
      const first = cols.indexOf(true);
      const last = cols.lastIndexOf(true);
      if (first === -1) continue;
      for (let c = first; c <= last; c++) {
        expect(cols[c], `offer ${offer} has a hole at column ${c}`).toBe(true);
      }
    }
  });

  it('draws no line at all for a deal that is dead everywhere', () => {
    const f = stressField(260_000, inputs(), CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
    expect(f.max).toBeLessThan(0);
    expect(f.breakEven.every((p) => p === null)).toBe(true);
  });

  it('draws no line for a deal that survives the whole grid', () => {
    const f = stressField(60_000, inputs(), CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);
    expect(f.min).toBeGreaterThan(0);
    expect(f.breakEven.every((p) => p === null)).toBe(true);
  });

  it('agrees with the table it sits above', () => {
    // Both are drawn from the same deal, so the single-variable break-even the
    // table reports has to land on the field's contour. If they disagreed the
    // player would be reading two different deals on one screen.
    const i = inputs();
    const offer = 150_000;
    const t = stressTest(offer, i, CARRY, RATE);
    const f = stressField(offer, i, CARRY, RATE, 41, 25, [-0.2, 0.08], [0, 0.7]);

    // The table's ARV break-even, at plan cost, is where the contour meets the
    // top row of the field.
    const topRowCrossing = f.grid[0].findIndex((v) => v >= 0);
    expect(topRowCrossing).toBeGreaterThan(0);
    const bracketLo = f.arvAt[topRowCrossing - 1];
    const bracketHi = f.arvAt[topRowCrossing];
    expect(t.breakEvenArvDelta!).toBeGreaterThanOrEqual(bracketLo);
    expect(t.breakEvenArvDelta!).toBeLessThanOrEqual(bracketHi);
  });
});
