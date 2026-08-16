import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NEIGHBORHOODS, createGame } from '../src/engine';
import Board from '../src/ui/board/Board';
import { DRAWN_ARCHETYPES } from '../src/ui/board/art';
import { backdropAt, density } from '../src/ui/board/backdrop';
import { DATA_VIEWS } from '../src/ui/board/dataViews';
import { buildParcels } from '../src/ui/board/layout';

/**
 * The rest of the town.
 *
 * Measured before this existed: a Portfolio Builder board was 150 lots with ten
 * houses on it. The danger in fixing that is not that the scenery looks wrong,
 * it is that it looks *actionable* -- a backdrop house a player tries to buy is
 * worse than an empty lot. So most of what is asserted here is about what
 * scenery must never do.
 */

describe('the backdrop town', () => {
  it('builds most of the town without filling it', () => {
    for (const hood of NEIGHBORHOODS) {
      let built = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        if (backdropAt(i % 20, Math.floor(i / 20), hood.id)) built++;
      }
      const share = built / n;
      // Full blocks leave a listing nowhere to stand out; empty ones are the
      // problem this solves.
      expect(share, `${hood.id} density`).toBeGreaterThan(0.35);
      expect(share, `${hood.id} density`).toBeLessThan(0.9);
      expect(density(hood.id)).toBeGreaterThan(0);
    }
  });

  it('is the same town every time it is drawn', () => {
    // Derived from the lot alone: no RNG, no day, nothing stored. A house that
    // changes archetype when the day advances reads as a rendering fault.
    for (const [gx, gy] of [
      [0, 0],
      [3, 11],
      [16, 2],
      [8, 8],
    ]) {
      const a = backdropAt(gx, gy, 'old_town');
      const b = backdropAt(gx, gy, 'old_town');
      expect(a).toEqual(b);
    }
    // And a different neighbourhood is a different street.
    const sample = (id: string) =>
      Array.from({ length: 60 }, (_, i) => (backdropAt(i, 3, id) ? '1' : '0')).join('');
    expect(sample('old_town')).not.toBe(sample('harbor_point'));
  });

  it('never claims work the player has not done', () => {
    /*
     * `working` and `finished` mean *you* are doing something on that lot.
     * Scenery saying either would be the board lying about your own portfolio.
     */
    for (const hood of NEIGHBORHOODS) {
      for (let gx = 0; gx < 17; gx++) {
        for (let gy = 0; gy < 17; gy++) {
          const h = backdropAt(gx, gy, hood.id);
          if (!h) continue;
          expect(['distressed', 'occupied', null]).toContain(h.state);
          expect(DRAWN_ARCHETYPES, `${gx},${gy} archetype`).toContain(h.archetypeId);
        }
      }
    }
  });

  it('leaves the data views answering about real property only', () => {
    // The backdrop is a render layer. It must not reach the parcels the views
    // read, or the board starts shading lots the game does not model.
    const state = createGame('the_grind', 909);
    const parcels = buildParcels(state);
    const scenery = parcels.filter(
      (p) => !p.property && backdropAt(p.gx, p.gy, p.neighborhoodId),
    );
    expect(scenery.length, 'there should be scenery to test').toBeGreaterThan(10);

    for (const view of DATA_VIEWS) {
      if (view.id === 'value') continue; // ground price applies with or without a house
      for (const p of scenery) {
        expect(view.step(p, state), `${view.id} on scenery`).toBe(0);
      }
    }
  });

  it('draws scenery that cannot be clicked, focused or named', () => {
    const state = createGame('the_grind', 909);
    const html = renderToStaticMarkup(createElement(Board, { state }));

    const groups = html.match(/<g class="lot-backdrop"[^>]*>/g) ?? [];
    expect(groups.length, 'the town should have scenery on it').toBeGreaterThan(20);
    for (const g of groups) {
      expect(g, 'scenery must not take pointer events').toMatch(/pointer-events="none"/);
      expect(g, 'scenery must not be focusable').not.toMatch(/tabindex/i);
      expect(g, 'scenery must not be a button').not.toMatch(/role="button"/);
      expect(g, 'scenery must be dimmed apart from real property').toMatch(/opacity="0\./);
    }

    // Only lots the game models are reachable.
    const buttons = (html.match(/role="button"/g) ?? []).length;
    const modelled = buildParcels(state).filter((p) => p.property !== null).length;
    expect(buttons).toBe(modelled);
  });
});
