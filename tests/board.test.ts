import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/engine';
import Board from '../src/ui/board/Board';
import { DATA_VIEWS, type Parcel } from '../src/ui/board/dataViews';
import { DISTRICTS, buildParcels } from '../src/ui/board/layout';
import { GRID, TILE, boardExtent, project, tileSides, tileTop } from '../src/ui/board/projection';

describe('the projection', () => {
  it('puts the centre of the board at the origin', () => {
    const middle = project(GRID / 2, GRID / 2);
    expect(middle.x).toBeCloseTo(0, 6);
    expect(middle.y).toBeCloseTo(0, 6);
  });

  it('turns the square grid into a diamond', () => {
    // Moving along +gx and +gy both go right; they go *opposite* ways
    // vertically. That is what makes it isometric rather than a squashed grid,
    // and it is the property every other piece of geometry here depends on.
    const o = project(0, 0);
    const alongX = project(1, 0);
    const alongY = project(0, 1);
    expect(alongX.x).toBeGreaterThan(o.x);
    expect(alongY.x).toBeGreaterThan(o.x);
    expect(alongX.y).toBeLessThan(o.y);
    expect(alongY.y).toBeGreaterThan(o.y);
  });

  it('foreshortens vertically, or it is not a projection at all', () => {
    const wide = project(GRID, GRID).x - project(0, 0).x;
    const tall = project(GRID, 0).y - project(0, GRID).y;
    expect(Math.abs(tall)).toBeLessThan(Math.abs(wide));
  });

  it('gives every tile four corners that enclose an area', () => {
    const top = tileTop(3, 4);
    expect(top).toHaveLength(4);
    // Shoelace: a degenerate tile would come out at zero.
    let area = 0;
    for (let i = 0; i < top.length; i++) {
      const a = top[i];
      const b = top[(i + 1) % top.length];
      area += a.x * b.y - b.x * a.y;
    }
    expect(Math.abs(area / 2)).toBeGreaterThan(TILE);
  });

  it('draws only the two side faces a fixed camera can see', () => {
    // Drawing all four is wasted geometry that also paints over neighbours.
    const sides = tileSides(2, 2, 10);
    expect(sides).toHaveLength(2);
    for (const face of sides) expect(face).toHaveLength(4);
  });

  it('drops the side faces downward, never up', () => {
    const [face] = tileSides(2, 2, 10);
    const tops = face.slice(0, 2);
    const bottoms = face.slice(2);
    for (const b of bottoms) {
      expect(Math.max(...bottoms.map((p) => p.y))).toBeGreaterThan(Math.min(...tops.map((p) => p.y)));
      expect(b.y).toBeGreaterThan(Math.min(...tops.map((p) => p.y)) - 0.001);
    }
  });

  it('sizes the viewBox to contain the whole board', () => {
    const e = boardExtent(9);
    for (const [gx, gy] of [
      [0, 0],
      [GRID, 0],
      [0, GRID],
      [GRID, GRID],
    ]) {
      const p = project(gx, gy, e.cx, e.cy);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(e.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(e.height);
    }
  });
});

describe('the layout', () => {
  it('keeps every district inside the grid', () => {
    for (const d of DISTRICTS) {
      expect(d.gx + d.w, d.id).toBeLessThanOrEqual(GRID);
      expect(d.gy + d.h, d.id).toBeLessThanOrEqual(GRID);
    }
  });

  it('never overlaps two districts', () => {
    const taken = new Set<string>();
    for (const d of DISTRICTS) {
      for (let y = d.gy; y < d.gy + d.h; y++) {
        for (let x = d.gx; x < d.gx + d.w; x++) {
          const key = `${x},${y}`;
          expect(taken.has(key), `${d.id} overlaps at ${key}`).toBe(false);
          taken.add(key);
        }
      }
    }
  });

  it('puts each house on exactly one lot, and keeps it there', () => {
    // A house that moves between renders turns the map into a shuffling
    // puzzle. Placement walks fixed orders on both sides so it cannot.
    const state = createGame('sandbox', 909);
    const a = buildParcels(state);
    const b = buildParcels(state);
    expect(a.map((p) => `${p.gx},${p.gy},${p.property?.id ?? ''}`)).toEqual(
      b.map((p) => `${p.gx},${p.gy},${p.property?.id ?? ''}`),
    );

    const ids = a.filter((p) => p.property).map((p) => p.property!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still gives empty lots a parcel', () => {
    // The overlays colour the ground, not just the houses: a district with
    // nothing for sale still has a price per square foot worth seeing.
    const state = createGame('sandbox', 909);
    const parcels = buildParcels(state);
    expect(parcels.some((p) => p.property === null)).toBe(true);
  });
});

describe('the data views', () => {
  const state = createGame('sandbox', 909);
  const parcels = buildParcels(state);

  it('always returns a step on the shared ramp', () => {
    for (const view of DATA_VIEWS) {
      for (const parcel of parcels) {
        const step = view.step(parcel, state);
        expect(Number.isInteger(step), `${view.id} gave ${step}`).toBe(true);
        expect(step, view.id).toBeGreaterThanOrEqual(0);
        expect(step, view.id).toBeLessThanOrEqual(7);
      }
    }
  });

  it('uses the whole ramp on the value view rather than pinning the town', () => {
    // The handoff's own mapping is calibrated for its four districts. Ours run
    // from about $78 to $330, and the borrowed formula flattened half the town
    // onto step 7 — a view that cannot distinguish anything is not a view.
    const view = DATA_VIEWS.find((v) => v.id === 'value')!;
    const steps = new Set(parcels.map((p) => view.step(p, state)));
    expect(steps.size).toBeGreaterThan(2);
  });

  it('reads condition as where the work is, not where the nice houses are', () => {
    const view = DATA_VIEWS.find((v) => v.id === 'rehab')!;
    const base: Parcel = { gx: 0, gy: 0, neighborhoodId: 'old_town', property: null };
    const wreck = { ...base, property: { ...parcels.find((p) => p.property)!.property!, condition: 0.05 } };
    const mint = { ...base, property: { ...wreck.property, condition: 0.98 } };
    expect(view.step(wreck, state)).toBeGreaterThan(view.step(mint, state));
  });

  it('is quiet on an empty lot in every view', () => {
    const empty: Parcel = { gx: 0, gy: 0, neighborhoodId: 'old_town', property: null };
    for (const view of DATA_VIEWS) {
      if (view.id === 'value') continue; // ground price applies with or without a house
      expect(view.step(empty, state), view.id).toBe(0);
    }
  });
});

describe('the board, drawn', () => {
  it('renders without NaN and draws a polygon per lot', () => {
    const state = createGame('sandbox', 909);
    const html = renderToStaticMarkup(createElement(Board, { state }));
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
    const parcels = buildParcels(state);
    expect((html.match(/<polygon/g) ?? []).length).toBeGreaterThanOrEqual(parcels.length);
  });

  it('names each district on a plate, so labels survive any overlay', () => {
    const state = createGame('sandbox', 909);
    const html = renderToStaticMarkup(createElement(Board, { state }));
    expect((html.match(/board-plate/g) ?? []).length).toBeGreaterThan(1);
  });

  it('tells a screen reader what the colour currently means', () => {
    const state = createGame('sandbox', 909);
    const html = renderToStaticMarkup(createElement(Board, { state }));
    // The map's own label, not the first one in the document -- the segmented
    // controls above it are labelled too.
    const label = html.match(/role="img"[^>]*aria-label="([^"]+)"/)![1];
    expect(label).toMatch(/shaded by/i);
    expect(label).toMatch(/lots/i);
  });
});
