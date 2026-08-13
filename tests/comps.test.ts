import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  adjustedPerSqft,
  compScatter,
  createGame,
  describeCompShape,
  selectComps,
  type Comp,
  type GameState,
  type Property,
} from '../src/engine';
import CompScatter from '../src/ui/graphics/CompScatter';

function subject(state: GameState): Property {
  return state.market.filter((p) => p.listing)[3]!;
}

describe('the comp scatter', () => {
  it('implies exactly the estimate the game is using', () => {
    // The reason to compute the chart from the same functions as the appraisal
    // rather than from its own arithmetic. A chart that draws a different
    // number from the one on the panel beside it is worse than no chart.
    for (const seed of [909, 606, 1234, 5678, 2468]) {
      const state = createGame('sandbox', seed);
      for (const p of state.market) {
        if (p.selectedComps.length === 0) continue;
        const s = compScatter(p, p.compPool, p.selectedComps);
        expect(s.impliedValue, `${p.address} @ ${seed}`).toBe(p.appraisal.point);
      }
    }
  });

  it('follows the selection when the player changes it', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const before = compScatter(prop, prop.compPool, prop.selectedComps);

    // Swap to the three worst-fitting comps, which are mostly out of area.
    const worst = [...prop.compPool]
      .map((c) => ({ c, s: compScatter(prop, [c], [c.id]) }))
      .sort((a, b) => b.s.medianPerSqft - a.s.medianPerSqft)
      .slice(0, 3)
      .map((x) => x.c.id);
    selectComps(state, prop.id, worst);

    const after = compScatter(prop, prop.compPool, prop.selectedComps);
    expect(after.impliedValue).toBe(prop.appraisal.point);
    expect(after.impliedValue).not.toBe(before.impliedValue);
    expect(after.points.filter((p) => p.selected)).toHaveLength(3);
  });

  it('adjusts a comp toward the subject rather than reporting what it sold for', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const s = compScatter(prop, prop.compPool, prop.selectedComps);
    // The adjustment is the teaching content, so it must actually be doing
    // something: raw and adjusted have to differ on a comp whose finish is
    // not the subject's.
    const moved = s.points.filter((p) => Math.abs(p.rawPerSqft - p.adjustedPerSqft) > 1);
    expect(moved.length).toBeGreaterThan(0);
    for (const p of s.points) {
      expect(p.adjustedPerSqft).toBe(adjustedPerSqft(prop, p.comp));
      expect(p.adjustedPerSqft).toBeGreaterThan(0);
    }
  });

  it('adjusts a dated comp up and a renovated comp down, for a mid-condition subject', () => {
    // The direction of the adjustment is the part a player has to internalise:
    // a cheap dated sale still implies a high value for a better house.
    const state = createGame('sandbox', 909);
    const prop = { ...subject(state), condition: 0.68, completedWork: [] };
    const base: Comp = {
      id: 'x',
      address: 'test',
      neighborhoodId: prop.neighborhoodId,
      sqft: prop.sqft,
      beds: prop.beds,
      baths: prop.baths,
      soldPrice: 200_000,
      soldDaysAgo: 30,
      distanceMi: 0.4,
      quality: 'average',
    };
    const raw = base.soldPrice / base.sqft;
    expect(adjustedPerSqft(prop, { ...base, quality: 'dated' })).toBeGreaterThan(raw);
    expect(adjustedPerSqft(prop, { ...base, quality: 'renovated' })).toBeLessThan(raw);
    expect(adjustedPerSqft(prop, base)).toBeCloseTo(raw, 6);
  });

  it('counts which side of the subject the selection sits on', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const s = compScatter(prop, prop.compPool, prop.selectedComps);
    const chosen = s.points.filter((p) => p.selected);
    const equal = chosen.filter((p) => p.comp.sqft === prop.sqft).length;
    expect(s.smaller + s.larger + equal).toBe(chosen.length);
  });
});

describe('what it says about the selection', () => {
  it('says nothing when the selection is local and tight', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const local = prop.compPool.filter((c) => c.neighborhoodId === prop.neighborhoodId);
    if (local.length < 2) return;
    const s = compScatter(prop, prop.compPool, local.map((c) => c.id));
    const adj = s.points.filter((p) => p.selected).map((p) => p.adjustedPerSqft);
    const spread = (Math.max(...adj) - Math.min(...adj)) / s.medianPerSqft;
    const brackets = s.smaller > 0 && s.larger > 0;
    if (spread < 0.35 && brackets) expect(describeCompShape(s)).toBeNull();
  });

  it('leads on the neighborhood, because that is the error with teeth', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const away = prop.compPool.filter((c) => c.neighborhoodId !== prop.neighborhoodId);
    expect(away.length).toBeGreaterThan(0);
    const s = compScatter(prop, prop.compPool, [away[0].id]);
    const text = describeCompShape(s)!;
    expect(text).toMatch(/neighborhood/i);
  });

  it('never claims price per foot falls with size', () => {
    // It does not, in this model: the correlation is -0.09. The usual line
    // from the property trade would be teaching a rule the game does not
    // implement, which is the one thing a teaching tool must not do.
    const state = createGame('sandbox', 909);
    for (const p of state.market) {
      for (const ids of [p.selectedComps, p.compPool.map((c) => c.id), [p.compPool[0].id]]) {
        const text = describeCompShape(compScatter(p, p.compPool, ids));
        if (!text) continue;
        expect(text).not.toMatch(/per foot (usually |tends to )?(falls|rises)/i);
        expect(text).not.toMatch(/bigger houses|larger houses sell/i);
      }
    }
  });

  it('says nothing at all when nothing is selected', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const s = compScatter(prop, prop.compPool, []);
    expect(describeCompShape(s)).toBeNull();
    expect(s.medianPerSqft).toBe(0);
    expect(s.impliedValue).toBe(0);
  });
});

describe('the comp scatter, drawn', () => {
  const render = (ids?: readonly string[]) => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const s = compScatter(prop, prop.compPool, ids ?? prop.selectedComps);
    return { svg: renderToStaticMarkup(createElement(CompScatter, { scatter: s })), s, prop };
  };

  it('draws every comp in the pool, selected or not', () => {
    const { svg, s } = render();
    // One filled or hollow marker each, plus ghosts for the ones that moved
    // and one for the estimate itself.
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBeGreaterThanOrEqual(s.points.length);
  });

  it('has no NaN in it, at any selection', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    for (const ids of [prop.selectedComps, prop.compPool.map((c) => c.id), [prop.compPool[0].id]]) {
      const { svg } = render(ids);
      expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('keeps everything inside the frame', () => {
    const W = 520;
    const H = 260;
    const { svg } = render();
    let checked = 0;
    for (const m of svg.matchAll(/\b(x|y|cx|cy|x1|x2|y1|y2)="(-?[\d.]+)"/g)) {
      const v = Number(m[2]);
      // cx and x1/x2 are horizontal; cy and y1/y2 are vertical.
      const horizontal = m[1] === 'x' || m[1] === 'cx' || m[1] === 'x1' || m[1] === 'x2';
      const limit = horizontal ? W : H;
      expect(v, `${m[1]}=${v} escapes the ${W}x${H} frame`).toBeGreaterThanOrEqual(-1);
      expect(v, `${m[1]}=${v} escapes the ${W}x${H} frame`).toBeLessThanOrEqual(limit + 1);
      checked++;
    }
    // Guard against the regex silently matching nothing and the test passing
    // by vacuity, which is how the first version of this test was wrong.
    expect(checked).toBeGreaterThan(20);
  });

  it('renders nothing rather than crashing on an empty pool', () => {
    const state = createGame('sandbox', 909);
    const prop = subject(state);
    const s = compScatter(prop, [], []);
    expect(renderToStaticMarkup(createElement(CompScatter, { scatter: s }))).toBe('');
  });

  it('tells a screen reader the number, not just that a chart exists', () => {
    const { svg, s } = render();
    const label = svg.match(/aria-label="([^"]+)"/)![1];
    expect(label).toMatch(/per square foot/i);
    expect(label).toContain(String(Math.round(s.medianPerSqft)));
  });
});
