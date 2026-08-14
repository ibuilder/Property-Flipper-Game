import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  createGame,
  jobProgress,
  makeOffer,
  startRenovation,
  workFinishedSoFar,
} from '../src/engine';
import { buildHouseArt } from '../src/ui/graphics/houseArt';
import { currentReserve } from '../src/engine/market';

function boughtWreck(seed: number) {
  const state = createGame('sandbox', seed);
  const prop = state.market
    .filter((p) => p.listing)
    .sort((a, b) => a.condition - b.condition)[0];
  const res = makeOffer(state, prop.id, Math.round(prop.listing!.askPrice * 1.15), false);
  expect(res.ok, `setup purchase failed: ${res.message}`).toBe(true);
  return { state, prop };
}

describe('work finished so far', () => {
  it('finishes nothing on the first day and everything on the last', () => {
    const { state, prop } = boughtWreck(41);
    startRenovation(state, prop.id, ['roof_replace', 'paint_interior', 'landscaping_curb'], 0.1);
    const job = prop.ownership!.renovation!;

    expect(workFinishedSoFar(job)).toHaveLength(0);

    job.daysElapsed = job.totalDays;
    expect(workFinishedSoFar(job)).toHaveLength(3);
  });

  it('runs the trades in the order they actually happen', () => {
    const { state, prop } = boughtWreck(42);
    // Systems before finishes before curb appeal.
    startRenovation(
      state,
      prop.id,
      ['landscaping_curb', 'paint_interior', 'electrical_rewire'],
      0.1,
    );
    const job = prop.ownership!.renovation!;

    const seen: string[] = [];
    for (let d = 0; d <= job.totalDays; d++) {
      job.daysElapsed = d;
      for (const id of workFinishedSoFar(job)) {
        if (!seen.includes(id)) seen.push(id);
      }
    }
    expect(seen.indexOf('electrical_rewire')).toBeLessThan(seen.indexOf('paint_interior'));
    expect(seen.indexOf('paint_interior')).toBeLessThan(seen.indexOf('landscaping_curb'));
  });

  it('only ever adds work, never takes it back', () => {
    const { state, prop } = boughtWreck(43);
    startRenovation(state, prop.id, ['roof_replace', 'flooring_lvp', 'siding_exterior'], 0.1);
    const job = prop.ownership!.renovation!;

    let previous = 0;
    for (let d = 0; d <= job.totalDays; d++) {
      job.daysElapsed = d;
      const n = workFinishedSoFar(job).length;
      expect(n).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });

  it('does not un-finish work when a change order lands mid-job', () => {
    // Observed for real: a termite change order appeared on day 16, sorted
    // ahead of the roof as a defect repair, and pushed already-finished work
    // back out of the set. On the roof that means the holes reappear.
    const { state, prop } = boughtWreck(49);
    startRenovation(state, prop.id, ['roof_replace', 'electrical_rewire', 'paint_interior'], 0.1);
    const job = prop.ownership!.renovation!;

    job.daysElapsed = Math.round(job.totalDays * 0.5);
    const before = workFinishedSoFar(job);
    expect(before.length).toBeGreaterThan(0);

    // A crew opens a wall and finds something. This is exactly the shape the
    // engine appends during advanceRenovation.
    job.lines.push({
      itemId: 'defect:termite_damage',
      quotedCost: 9_000,
      quotedDays: 8,
      changeOrder: true,
      defectId: 'termite_damage',
    });
    job.totalDays += 6;

    const after = workFinishedSoFar(job);
    for (const id of before) {
      expect(after, `"${id}" un-finished when a change order landed`).toContain(id);
    }
  });

  it('puts defect repairs first, before anything closes over them', () => {
    const { state, prop } = boughtWreck(44);
    const defect = prop.defects[0];
    if (!defect) return;
    defect.revealed = true;

    startRenovation(state, prop.id, [`defect:${defect.defId}`, 'paint_interior'], 0.1);
    const job = prop.ownership!.renovation!;

    const order: string[] = [];
    for (let d = 0; d <= job.totalDays; d++) {
      job.daysElapsed = d;
      for (const id of workFinishedSoFar(job)) if (!order.includes(id)) order.push(id);
    }
    expect(order[0]).toMatch(/^defect:/);
  });
});

describe('the house changes while the work is happening', () => {
  it('takes the roof holes away partway through, not on the last day', () => {
    const { state, prop } = boughtWreck(45);
    startRenovation(state, prop.id, ['roof_replace', 'landscaping_curb'], 0.1);
    const job = prop.ownership!.renovation!;

    const atStart = buildHouseArt(
      { ...prop, renovating: true, workInProgress: [], renovationProgress: 0 },
      100,
    );
    job.daysElapsed = job.totalDays; // roof is first in trade order
    const midway = buildHouseArt(
      {
        ...prop,
        renovating: true,
        workInProgress: workFinishedSoFar(job),
        renovationProgress: 0.9,
      },
      100,
    );

    expect(atStart.roof.gaps.length).toBeGreaterThan(0);
    expect(midway.roof.gaps.length).toBe(0);
    // And the tarp comes off with them.
    expect(atStart.works?.tarp).toBe(true);
    expect(midway.works?.tarp).toBe(false);
  });

  it('takes the scaffolding down as the job nears the end', () => {
    const { prop } = boughtWreck(46);
    const early = buildHouseArt(
      { ...prop, renovating: true, workInProgress: [], renovationProgress: 0.05 },
      100,
    );
    const late = buildHouseArt(
      { ...prop, renovating: true, workInProgress: [], renovationProgress: 0.95 },
      100,
    );
    expect(late.works!.scaffoldX.length).toBeLessThan(early.works!.scaffoldX.length);
    expect(late.works!.scaffoldX.length).toBeGreaterThan(0);
  });

  it('never lets in-progress work touch the property value', () => {
    // The whole reason workInProgress is separate from completedWork.
    const { state, prop } = boughtWreck(47);
    startRenovation(state, prop.id, ['roof_replace', 'kitchen_refresh'], 0.1);

    const before = prop.appraisal.point;
    /*
     * Sit out the permit first.
     *
     * `roof_replace` is systems work, so the city has to look at it before
     * anyone starts and no days are worked while it does. Advancing three days
     * used to be enough to see progress and now is not, which is the permit
     * queue doing exactly its job -- so the test waits it out rather than
     * quietly switching to a cosmetic scope that would dodge the point.
     */
    const job = prop.ownership!.renovation;
    if (!job) return;
    const queue = job.permit?.queueDays ?? 0;
    for (let i = 0; i < queue + 3; i++) advanceDay(state);

    expect(jobProgress(job)).toBeGreaterThan(0);
    // completedWork is what valuation reads, and it is still empty.
    expect(prop.completedWork).toHaveLength(0);
    expect(prop.appraisal.point).toBeCloseTo(before, 0);
  });

  it('shows no scaffolding at all once nobody is on site', () => {
    const { prop } = boughtWreck(48);
    const idle = buildHouseArt({ ...prop, renovating: false }, 100);
    expect(idle.works).toBeNull();
    expect(idle.skip).toBe(false);
  });
});
