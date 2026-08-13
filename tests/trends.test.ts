import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  NEIGHBORHOODS,
  advanceDay,
  allTrends,
  createGame,
  describeTrend,
  neighborhoodTrend,
  trendStrength,
  type GameState,
} from '../src/engine';
import TrendSpark from '../src/ui/graphics/TrendSpark';

function aged(days: number, seed = 909): GameState {
  const state = createGame('sandbox', seed);
  for (let d = 0; d < days; d++) advanceDay(state);
  return state;
}

describe('neighborhood trends', () => {
  it('says nothing on a fresh campaign rather than inventing a line', () => {
    const state = createGame('sandbox', 909);
    const t = neighborhoodTrend(state, NEIGHBORHOODS[0].id);
    expect(t.points.length).toBeLessThan(3);
    expect(t.netChange).toBe(0);
    expect(trendStrength(t)).toBe('none');
    expect(describeTrend(t)).toBeNull();
  });

  it('rebases both series so they start together', () => {
    const t = neighborhoodTrend(aged(400), NEIGHBORHOODS[0].id);
    expect(t.points.length).toBeGreaterThan(5);
    expect(t.points[0].value).toBeCloseTo(1, 9);
    expect(t.points[0].market).toBeCloseTo(1, 9);
    expect(t.points[0].relative).toBeCloseTo(1, 9);
  });

  it('measures against the pack, not against zero', () => {
    // The reason this exists. Market-wide drift is larger than any arc, so a
    // neighborhood can decline relative to the city while its own index rises.
    // If relative ever collapses into absolute, that case becomes invisible.
    const state = aged(700);
    const trends = allTrends(state);
    const rising = trends.filter((t) => t.netChange > 0);
    expect(rising.length).toBeGreaterThan(0);
    for (const t of trends) {
      const last = t.points[t.points.length - 1];
      expect(last.relative).toBeCloseTo(last.value / last.market, 9);
    }
    // Somewhere in a long campaign, at least one neighborhood should be up in
    // absolute terms and behind in relative terms. That is the whole point.
    const upButBehind = trends.filter((t) => t.netChange > 0 && t.relativeChange < 0);
    expect(upButBehind.length).toBeGreaterThan(0);
  });

  it('sorts strongest divergence first', () => {
    const trends = allTrends(aged(600));
    for (let i = 1; i < trends.length; i++) {
      expect(trends[i].relativeChange).toBeLessThanOrEqual(trends[i - 1].relativeChange);
    }
  });

  it('only covers the window it claims to', () => {
    const state = aged(900);
    const t = neighborhoodTrend(state, NEIGHBORHOODS[0].id, 240);
    expect(t.days).toBeLessThanOrEqual(240);
    for (const p of t.points) expect(p.day).toBeGreaterThanOrEqual(state.day - 240);
  });

  it('stays quiet on ordinary drift, so it is not furniture', () => {
    // At the first thresholds tried, this fired on 20 of the 24 neighborhoods
    // with nothing happening, mostly to report a 2% wobble.
    let spoke = 0;
    let total = 0;
    for (const seed of [909, 606, 1234, 5678, 2468, 4321]) {
      for (const t of allTrends(aged(900, seed))) {
        total++;
        if (describeTrend(t)) spoke++;
      }
    }
    expect(total).toBe(36);
    expect(spoke).toBeLessThan(total * 0.6);
  });

  it('never claims a divergence is an arc', () => {
    // It is not diagnostic of one: measured over six campaigns, the largest
    // divergence had no arc behind it. Promising otherwise would be a lie.
    for (const seed of [909, 606, 1234, 5678]) {
      for (const t of allTrends(aged(900, seed))) {
        const text = describeTrend(t);
        if (!text) continue;
        expect(text).not.toMatch(/gentrif|declin|arc/i);
      }
    }
  });

  it('quantifies the divergence it reports', () => {
    const trends = allTrends(aged(900, 606));
    const spoken = trends.map(describeTrend).filter((x): x is string => x !== null);
    expect(spoken.length).toBeGreaterThan(0);
    for (const text of spoken) {
      expect(text).toMatch(/\d+% (ahead of|behind) the rest of the city/);
    }
  });
});

describe('the sparkline', () => {
  it('draws nothing before there is history to draw', () => {
    const t = neighborhoodTrend(createGame('sandbox', 909), NEIGHBORHOODS[0].id);
    expect(renderToStaticMarkup(createElement(TrendSpark, { trend: t }))).toBe('');
  });

  it('draws both series and the band between them', () => {
    const t = neighborhoodTrend(aged(600), NEIGHBORHOODS[0].id);
    const svg = renderToStaticMarkup(createElement(TrendSpark, { trend: t }));
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    expect((svg.match(/<polyline/g) ?? [])).toHaveLength(2);
    expect(svg).toMatch(/<polygon/);
  });

  it('closes the band with one point per sample on each side', () => {
    const t = neighborhoodTrend(aged(600), NEIGHBORHOODS[0].id);
    const svg = renderToStaticMarkup(createElement(TrendSpark, { trend: t }));
    const poly = svg.match(/<polygon points="([^"]+)"/)![1];
    expect(poly.trim().split(/\s+/)).toHaveLength(t.points.length * 2);
  });

  it('keeps every coordinate inside its little box', () => {
    for (const hood of NEIGHBORHOODS) {
      const t = neighborhoodTrend(aged(900), hood.id);
      const svg = renderToStaticMarkup(createElement(TrendSpark, { trend: t }));
      for (const m of svg.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(0);
        expect(Number(m[1])).toBeLessThanOrEqual(64);
        expect(Number(m[2])).toBeGreaterThanOrEqual(0);
        expect(Number(m[2])).toBeLessThanOrEqual(20);
      }
    }
  });

  it('only colours a divergence worth reading as one', () => {
    const state = aged(900, 606);
    for (const t of allTrends(state)) {
      const svg = renderToStaticMarkup(createElement(TrendSpark, { trend: t }));
      if (!svg) continue;
      if (trendStrength(t) === 'clear') {
        expect(svg).toMatch(/var\(--(good|bad)\)/);
      } else {
        expect(svg).not.toMatch(/var\(--(good|bad)\)/);
      }
    }
  });

  it('describes itself with the numbers, for a screen reader', () => {
    const t = neighborhoodTrend(aged(600), NEIGHBORHOODS[0].id);
    const svg = renderToStaticMarkup(createElement(TrendSpark, { trend: t }));
    const label = svg.match(/aria-label="([^"]+)"/)![1];
    expect(label).toMatch(/ahead of|behind/);
    expect(label).toMatch(/\d+ days/);
  });
});
