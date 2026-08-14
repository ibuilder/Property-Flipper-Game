import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buyerArrivalRate, createGame, trafficCurve, trueValue } from '../src/engine';
import TrafficCurve from '../src/ui/graphics/TrafficCurve';

function subject() {
  const state = createGame('sandbox', 909);
  const prop = state.market.filter((p) => p.listing)[3]!;
  return { state, prop, value: trueValue(prop, state.world, state.day) };
}

describe('the traffic curve', () => {
  it('is sampled from the engine, not from a copy of it', () => {
    // The same contract as the stress grid. A pricing aid that draws its own
    // curve would look authoritative and be wrong, which is worse than not
    // drawing one at all.
    const { state, prop } = subject();
    const curve = trafficCurve(prop, state.world, state.day, 0);
    for (const point of curve) {
      const direct = buyerArrivalRate(prop, state.world, state.day, point.listPrice, 0, 0);
      expect(point.chance).toBeCloseTo(direct, 10);
    }
  });

  it('gets slower the higher you price it', () => {
    const { state, prop } = subject();
    const curve = trafficCurve(prop, state.world, state.day, 0);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].chance).toBeLessThanOrEqual(curve[i - 1].chance);
      expect(curve[i].expectedDays).toBeGreaterThanOrEqual(curve[i - 1].expectedDays);
    }
  });

  it('falls off far more steeply above value than it gains below it', () => {
    // The asymmetry is the whole lesson of the sale screen. Giving a house
    // away does not make it sell arbitrarily faster, but optimism costs
    // exponentially.
    const { state, prop, value } = subject();
    const at = (m: number) => buyerArrivalRate(prop, state.world, state.day, value * m, 0, 0);
    const base = at(1);
    const cheaper = at(0.94) / base;
    const dearer = base / at(1.06);
    expect(cheaper).toBeLessThan(1.3);
    expect(dearer).toBeGreaterThan(1.4);
  });

  it('turns the daily chance into an honest average wait', () => {
    // Arrivals are one Bernoulli trial per day, so the wait is geometric with
    // mean 1/p. If this ever becomes a median or a promise it is lying.
    const { state, prop } = subject();
    for (const p of trafficCurve(prop, state.world, state.day, 0)) {
      if (!Number.isFinite(p.expectedDays)) continue;
      expect(p.expectedDays).toBe(Math.round(1 / p.chance));
    }
  });

  it('marketing skill moves the whole curve, not just one end', () => {
    const { state, prop } = subject();
    const plain = trafficCurve(prop, state.world, state.day, 0);
    const skilled = trafficCurve(prop, state.world, state.day, 5);
    for (let i = 0; i < plain.length; i++) {
      expect(skilled[i].chance).toBeGreaterThan(plain[i].chance);
    }
  });

  it('samples the range it says it does', () => {
    const { state, prop } = subject();
    const curve = trafficCurve(prop, state.world, state.day, 0, 0.9, 1.16, 14);
    expect(curve).toHaveLength(14);
    expect(curve[0].multiple).toBeCloseTo(0.9);
    expect(curve[13].multiple).toBeCloseTo(1.16);
  });
});

describe('the traffic curve, drawn', () => {
  const render = (current = 1.0) => {
    const { state, prop } = subject();
    const points = trafficCurve(prop, state.world, state.day, 0);
    return renderToStaticMarkup(createElement(TrafficCurve, { points, current }));
  };

  it('draws one bar per sample and no NaN', () => {
    const html = render();
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
    expect((html.match(/<rect/g) ?? []).length).toBe(14);
  });

  it('marks the price the player actually chose', () => {
    // Solid for the chosen bar, quiet for the rest: the comparison in one mark.
    const low = render(0.9);
    const high = render(1.16);
    expect(low).toContain('var(--color-accent-solid)');
    expect(high).toContain('var(--color-accent-solid)');
    expect(low).not.toBe(high);
  });

  it('says the wait is an average rather than a promise', () => {
    expect(render()).toMatch(/average/i);
  });

  it('describes the shape to a screen reader, not just the number', () => {
    const label = render().match(/aria-label="([^"]+)"/)![1];
    expect(label).toMatch(/days/);
    expect(label).toMatch(/exponential|steep/i);
  });

  it('renders nothing rather than crashing with no points', () => {
    expect(renderToStaticMarkup(createElement(TrafficCurve, { points: [], current: 1 }))).toBe('');
  });
});
