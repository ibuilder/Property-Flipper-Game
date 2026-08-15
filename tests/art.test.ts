import { readdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../src/engine/content';
import {
  DRAWN_ARCHETYPES,
  SUBSTITUTE,
  artIdFor,
  houseDrawing,
  houseState,
} from '../src/ui/board/art';
import { HOUSE_ANCHOR, HOUSE_ART, HOUSE_STATES } from '../src/ui/board/art.generated';
import { project } from '../src/ui/board/projection';

/**
 * The commissioned art, and the two ways it can be wrong.
 *
 * The contact sheet is regenerated as part of the test run. A reference built
 * by hand goes stale the first time somebody adjusts a roof pitch, and a stale
 * reference is worse than none when an artist is quoting against it. Drawing it
 * through the same `houseDrawing` the board uses means the sheet cannot
 * disagree with what ships.
 *
 * The assertions guard the two failures this integration actually had. The
 * first is coverage: the previous test asserted the *count* of drawn
 * archetypes was seven, which passed happily while three of the seven ids
 * matched nothing in `content.ts` and three content ids had no drawing at all.
 * Counts are checked here against the content pack itself. The second is
 * anchoring: each artboard is centred on its own drawing, so the lot origin
 * sits at a different height in every file, and placing them by artboard centre
 * left a 15.5px spread on a 19px lot.
 */

const CELL = 132;
const ROW = 150;
const OUT = 'docs/design/art-sheet.svg';
const COLS = ['base', ...HOUSE_STATES] as const;

describe('the house art', () => {
  it('has a base and every state for every archetype, all non-empty', () => {
    expect(DRAWN_ARCHETYPES).toHaveLength(7);
    for (const id of DRAWN_ARCHETYPES) {
      for (const col of COLS) {
        const paths = HOUSE_ART[id][col];
        expect(paths?.length, `${id}/${col}`).toBeGreaterThan(0);
        for (const p of paths) {
          expect(p.d, `${id}/${col}`).toMatch(/^M[-\d.]/);
          expect(p.d).not.toMatch(/NaN|Infinity|undefined/);
          expect([1, 2]).toContain(p.w);
        }
      }
      expect(HOUSE_ANCHOR[id], `${id} anchor`).toBeDefined();
    }
  });

  it('draws every archetype the content pack actually generates', () => {
    // The check the old count-based test could not make. Every id the engine
    // can put on the board has to resolve to a drawing, and every substitute
    // has to be covering a real gap rather than shadowing a delivered piece.
    const content = ARCHETYPES.map((a) => a.id);
    for (const id of content) {
      expect(HOUSE_ART[artIdFor(id)], `${id} resolves to a drawing`).toBeDefined();
    }

    const missing = content.filter((id) => !HOUSE_ART[id]);
    expect(
      Object.keys(SUBSTITUTE).sort(),
      'the substitute table must cover exactly the archetypes with no art of their own',
    ).toEqual(missing.sort());

    for (const [from, to] of Object.entries(SUBSTITUTE)) {
      expect(HOUSE_ART[from], `${from} has no art, so it needs a substitute`).toBeUndefined();
      expect(HOUSE_ART[to], `${from} substitutes ${to}, which must exist`).toBeDefined();
    }
  });

  it('stands every archetype on the same ground', () => {
    // The regression that motivates HOUSE_ANCHOR. Placing each artboard by its
    // centre put the lot origins 15.5px apart on a lot 19px tall; every
    // archetype must land its own anchor on the one lot centre.
    const centre = project(3.5, 4.5, 100, 100);
    const placed = DRAWN_ARCHETYPES.map((id) => {
      const d = houseDrawing(3, 4, id, null, 100, 100);
      const m = d.transform.match(/translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)/);
      expect(m, `${id} transform`).not.toBeNull();
      const [tx, ty, k] = m!.slice(1).map(Number);
      return { id, x: tx + HOUSE_ANCHOR[id].x * k, y: ty + HOUSE_ANCHOR[id].y * k };
    });

    for (const p of placed) {
      expect(p.x, `${p.id} x`).toBeCloseTo(centre.x, 1);
      expect(p.y, `${p.id} y`).toBeCloseTo(centre.y, 1);
    }
  });

  it('picks the overlay by what the player most needs to see', () => {
    const sound = { condition: 0.9 };
    expect(houseState(sound)).toBeNull();
    expect(houseState({ condition: 0.2 })).toBe('distressed');
    expect(houseState({ ...sound, ownership: { saleListing: {} } })).toBe('finished');
    expect(houseState({ ...sound, ownership: { rental: { tenancy: {} } } })).toBe('occupied');
    // Work outranks everything, including a derelict shell and a live tenancy.
    expect(
      houseState({ condition: 0.1, ownership: { renovation: {}, rental: { tenancy: {} } } }),
    ).toBe('working');
    // Dereliction outranks the board: it is what changes the number.
    expect(houseState({ condition: 0.1, ownership: { saleListing: {} } })).toBe('distressed');
  });

  it('carries every SVG that is in art/, so an addition cannot go un-ingested', () => {
    const files = readdirSync('art/houses').filter((f) => f.endsWith('.svg'));
    expect(files).toHaveLength(DRAWN_ARCHETYPES.length * COLS.length);
    for (const id of DRAWN_ARCHETYPES) {
      expect(files, `${id} base`).toContain(`house-${id}.svg`);
      for (const st of HOUSE_STATES) expect(files).toContain(`house-${id}-${st}.svg`);
    }
  });

  it('writes the contact sheet', () => {
    let body = '';
    const anchor = project(0.5, 0.5, 0, 0);

    DRAWN_ARCHETYPES.forEach((id, r) => {
      const label = Object.entries(SUBSTITUTE)
        .filter(([, to]) => to === id)
        .map(([from]) => from);
      body +=
        `<text x="12" y="${r * ROW + 24}" font-family="sans-serif" font-size="13"` +
        ` font-weight="600" fill="#1d1f20">${id}</text>`;
      if (label.length) {
        body +=
          `<text x="12" y="${r * ROW + 40}" font-family="sans-serif" font-size="10"` +
          ` fill="#a0522d">standing in for ${label.join(', ')}</text>`;
      }

      COLS.forEach((col, c) => {
        const cx = 150 + c * CELL + CELL / 2;
        const cy = r * ROW + 96;
        const state = col === 'base' ? null : col;
        const d = houseDrawing(0, 0, id, state, cx - anchor.x, cy - anchor.y);
        const baseCount = HOUSE_ART[id].base.length;

        body += `<g transform="${d.transform}" fill="none" stroke-linejoin="round">`;
        d.paths.forEach((p, i) => {
          const ink = i < baseCount ? '#1d1f20' : '#5980a6';
          body += `<path d="${p.d}" stroke="${ink}" stroke-width="${d.strokeWidth(p.w).toFixed(3)}"/>`;
        });
        body += '</g>';

        if (r === 0) {
          body +=
            `<text x="${cx}" y="18" text-anchor="middle" font-family="sans-serif"` +
            ` font-size="11" letter-spacing="1.4" fill="#7a7a7d">${col.toUpperCase()}</text>`;
        }
      });
    });

    expect(body).not.toMatch(/NaN|Infinity|undefined/);

    const width = 150 + COLS.length * CELL + 20;
    const height = DRAWN_ARCHETYPES.length * ROW + 20;
    writeFileSync(
      OUT,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"` +
        ` width="${width}" height="${height}">\n` +
        `<rect width="${width}" height="${height}" fill="#f2f2f3"/>\n` +
        `<text x="12" y="${height - 6}" font-family="sans-serif" font-size="10" fill="#7a7a7d">` +
        `Property Flipper house art, at the size it renders on the board. ` +
        `Base drawing in ink, condition overlay in accent.</text>\n` +
        `${body}\n</svg>\n`,
      'utf8',
    );
  });
});
