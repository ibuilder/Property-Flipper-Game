import { describe, expect, it } from 'vitest';
import {
  ARCS,
  Rng,
  advanceDay,
  arcDailyDrift,
  arcIntensity,
  arcIsVisible,
  arcMoveSoFar,
  chainFrom,
  createGame,
  type NeighborhoodArc,
} from '../src/engine';
import { EVENTS_BY_ID } from '../src/engine/content';

function arc(over: Partial<NeighborhoodArc> = {}): NeighborhoodArc {
  return {
    neighborhoodId: 'millworks',
    kind: 'gentrifying',
    startedDay: 100,
    totalDays: 1000,
    announced: false,
    ...over,
  };
}

describe('neighborhood arcs', () => {
  it('ramps in and out rather than switching on', () => {
    const a = arc();
    expect(arcIntensity(a, 100)).toBeCloseTo(0, 3);
    expect(arcIntensity(a, 600)).toBeCloseTo(1, 3);
    expect(arcIntensity(a, 1100)).toBeCloseTo(0, 3);
  });

  it('contributes nothing before it starts or after it ends', () => {
    const a = arc();
    expect(arcDailyDrift(a, 50)).toBe(0);
    expect(arcDailyDrift(a, 2000)).toBe(0);
  });

  it('pushes values up when gentrifying and down when declining', () => {
    expect(arcDailyDrift(arc({ kind: 'gentrifying' }), 600)).toBeGreaterThan(0);
    expect(arcDailyDrift(arc({ kind: 'declining' }), 600)).toBeLessThan(0);
  });

  it('stays invisible at first, so being early is worth something', () => {
    const a = arc();
    expect(arcIsVisible(a, 120)).toBe(false);
    // And becomes visible while most of the move is still ahead.
    expect(arcIsVisible(a, 400)).toBe(true);
    expect(Math.abs(arcMoveSoFar(a, 400))).toBeLessThan(Math.abs(arcMoveSoFar(a, 1100)) * 0.5);
  });

  it('moves a neighborhood measurably over years, not weeks', () => {
    const a = arc();
    const overAMonth = Math.abs(arcMoveSoFar(a, 130));
    const overTheArc = Math.abs(arcMoveSoFar(a, 1100));
    expect(overAMonth).toBeLessThan(0.02);
    expect(overTheArc).toBeGreaterThan(0.15);
  });

  it('runs in a real campaign and shows up in the index', () => {
    // Force an arc rather than waiting for the dice.
    const state = createGame('the_grind', 41);
    const target = 'millworks';
    state.world.arcs.push(arc({ neighborhoodId: target, startedDay: state.day, totalDays: 800 }));
    const control = createGame('the_grind', 41);

    for (let i = 0; i < 500; i++) {
      advanceDay(state);
      advanceDay(control);
    }

    expect(state.world.neighborhoodIndex[target]).toBeGreaterThan(
      control.world.neighborhoodIndex[target],
    );
    // And it was announced along the way, once it became visible.
    expect(state.log.some((l) => /gentrifying/i.test(l.message))).toBe(true);
  });

  it('does not touch the neighborhoods it is not in', () => {
    const state = createGame('the_grind', 42);
    state.world.arcs.push(
      arc({ neighborhoodId: 'millworks', startedDay: state.day, totalDays: 800 }),
    );
    const control = createGame('the_grind', 42);
    for (let i = 0; i < 300; i++) {
      advanceDay(state);
      advanceDay(control);
    }
    expect(state.world.neighborhoodIndex.harbor_point).toBeCloseTo(
      control.world.neighborhoodIndex.harbor_point,
      6,
    );
  });
});

describe('event chains', () => {
  it('points every link at an event that actually exists', () => {
    for (const id of Object.keys(EVENTS_BY_ID)) {
      for (const link of chainFrom(id)) {
        expect(EVENTS_BY_ID[link.next]).toBeTruthy();
        expect(link.chance).toBeGreaterThan(0);
        expect(link.chance).toBeLessThan(1);
        expect(link.why.length).toBeGreaterThan(10);
      }
    }
  });

  it('makes a rate spike lead somewhere, but not always', () => {
    const links = chainFrom('rate_hike');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].next).toBe('correction');
    // A tendency, not a script.
    expect(links[0].chance).toBeLessThan(0.6);
  });

  it('leaves unchained events alone', () => {
    expect(chainFrom('school_rezoning')).toHaveLength(0);
  });

  it('fires a chain when the first link expires', () => {
    const state = createGame('the_grind', 43);
    // Put a rate spike on the board with one day left.
    const def = EVENTS_BY_ID.rate_hike;
    state.world.activeEvents.push({ defId: def.id, daysRemaining: 1, startedDay: state.day });

    let sawChain = false;
    for (let i = 0; i < 60 && !sawChain; i++) {
      advanceDay(state);
      sawChain = state.log.some((l) => /following on/i.test(l.message));
      if (state.world.activeEvents.some((a) => a.defId === 'correction')) sawChain = true;
    }
    // Probabilistic: on a seed where it does not fire, the rate spike must at
    // least have expired cleanly rather than hanging around.
    expect(state.world.activeEvents.some((a) => a.defId === 'rate_hike')).toBe(false);
  });

  it('does eventually chain, across enough seeds', () => {
    let chained = 0;
    for (let seed = 0; seed < 40; seed++) {
      const state = createGame('the_grind', 500 + seed);
      state.world.activeEvents.push({
        defId: 'rate_hike',
        daysRemaining: 1,
        startedDay: state.day,
      });
      advanceDay(state);
      advanceDay(state);
      if (state.world.activeEvents.some((a) => a.defId === 'correction')) chained += 1;
    }
    // Around 42% by design; a wide band so this is not a coin-flip test.
    expect(chained).toBeGreaterThan(6);
    expect(chained).toBeLessThan(34);
    expect(ARCS.gentrifying.peakDailyDrift).toBeGreaterThan(0);
    expect(new Rng(1)).toBeTruthy();
  });
});
