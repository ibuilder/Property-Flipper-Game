import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRAWN_ARCHETYPES, houseShape, type Condition } from '../src/ui/board/houses';
import { project, toPoints } from '../src/ui/board/projection';

/**
 * The placeholder contact sheet, regenerated as part of the test run.
 *
 * A reference sheet that is built by hand goes stale the first time somebody
 * adjusts a roof pitch, and a stale reference is worse than none when an
 * artist is quoting against it. Generating it from the same functions the
 * board draws with means it cannot disagree with what ships -- and putting it
 * in the suite means nobody has to remember to run it.
 *
 * The assertions are real rather than ceremonial: they check every archetype
 * and state actually produced geometry, which is the thing a silent failure
 * here would hide.
 */

const CONDITIONS: Condition[] = ['distressed', 'working', 'finished'];
const CELL = 132;
const ROW = 150;
const OUT = 'docs/design/art-placeholders.svg';

describe('the placeholder art sheet', () => {
  it('draws every archetype in every state, and writes the sheet', () => {
    let body = '';
    let shapes = 0;

    DRAWN_ARCHETYPES.forEach((id, r) => {
      body += `<text x="12" y="${r * ROW + 24}" font-family="sans-serif" font-size="13" font-weight="600" fill="#1d1f20">${id}</text>`;

      CONDITIONS.forEach((cond, c) => {
        const cx = 150 + c * CELL + CELL / 2;
        const cy = r * ROW + 96;
        /*
         * `project` centres the whole 17x17 board on the origin, so asking for
         * lot (0,0) puts it half a board to the left. The sheet wants one house
         * in the middle of a cell, so the offset is cancelled by anchoring on
         * where the lot's own centre lands.
         */
        const anchor = project(0.5, 0.5, 0, 0);
        const s = houseShape(0, 0, id, cond, cx - anchor.x, cy - anchor.y);

        // Every slot must produce a silhouette. An archetype that renders
        // nothing would be an empty box on the board and an empty cell here.
        expect(s.walls.length, `${id} walls`).toBeGreaterThan(0);
        expect(s.roof.length, `${id} roof`).toBeGreaterThan(0);
        if (cond === 'working') expect(s.scaffold.length, `${id} scaffold`).toBeGreaterThan(0);
        else expect(s.scaffold, `${id} scaffold`).toHaveLength(0);
        expect(s.broken).toBe(cond === 'distressed');
        shapes++;

        body += '<g>';
        for (const w of s.walls) {
          body += `<polygon points="${toPoints(w)}" fill="none" stroke="#1d1f20" stroke-width="0.9"/>`;
        }
        for (const p of s.roof) {
          const dash = s.broken ? ' stroke-dasharray="2 2"' : '';
          body += `<polygon points="${toPoints(p)}" fill="none" stroke="#1d1f20" stroke-width="1.1"${dash}/>`;
        }
        for (const l of s.scaffold) {
          body += `<polyline points="${toPoints(l)}" fill="none" stroke="#5980a6" stroke-width="0.8"/>`;
        }
        body += '</g>';

        if (r === 0) {
          body += `<text x="${cx}" y="18" text-anchor="middle" font-family="sans-serif" font-size="11" letter-spacing="1.4" fill="#7a7a7d">${cond.toUpperCase()}</text>`;
        }
      });
    });

    expect(shapes).toBe(DRAWN_ARCHETYPES.length * CONDITIONS.length);
    expect(body).not.toMatch(/NaN|Infinity|undefined/);

    const width = 150 + CONDITIONS.length * CELL + 20;
    const height = DRAWN_ARCHETYPES.length * ROW + 20;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n` +
      `<rect width="${width}" height="${height}" fill="#f2f2f3"/>\n` +
      `<text x="12" y="${height - 6}" font-family="sans-serif" font-size="10" fill="#7a7a7d">` +
      `Property Flipper placeholder houses, at the size they render on the board. Replace them; do not match them.</text>\n` +
      `${body}\n</svg>\n`;

    writeFileSync(OUT, svg, 'utf8');
  });

  it('covers every archetype the content pack defines', () => {
    // If someone adds an eighth archetype, the board falls back to a generic
    // silhouette and the art brief silently under-counts what needs drawing.
    // Better to fail here than to under-commission.
    expect(DRAWN_ARCHETYPES.length).toBe(7);
  });
});
