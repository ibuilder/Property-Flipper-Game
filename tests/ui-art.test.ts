import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../src/engine/content';
import {
  COLOR_TRANSFORM,
  COLOR_UNIT,
  HOUSE_COLOR,
  HOUSE_COLOR_BARE,
  HOUSE_SEASON,
  SEASON_MAP,
  FURNITURE_COLOR,
  ICONS,
  ICON_BOX,
  NPC,
  PRESS,
  SCOUT,
  SCOUT_BOX,
} from '../src/ui/art.generated';
import { artIdFor, boardSeason, lotFurniture } from '../src/ui/board/art';
import { RULES } from '../src/ui/coach/rules';

/**
 * The rest of the delivered art.
 *
 * The assertions are aimed at one failure in particular, because it has already
 * happened once here: art and code agreeing on a *count* while disagreeing on
 * *names*. The house set shipped seven drawings against seven archetypes and
 * matched on four, and a count-based test passed the whole way through. So
 * every check below compares names against whatever the code actually asks for
 * -- the moods the coach rules use, the archetypes the content pack generates,
 * the icons the shell names -- rather than counting files.
 */

const TAB_ICONS = ['search', 'gavel', 'home', 'banknote', 'badge-check', 'file-text'];

describe('the interface art', () => {
  it('has a portrait for every mood the coach can actually be in', () => {
    const used = [...new Set(RULES.map((r) => r.mood))].sort();
    expect(used.length).toBeGreaterThan(0);
    for (const mood of used) {
      expect(SCOUT[mood], `Scout has no ${mood} portrait`).toBeTruthy();
    }
    // And nothing drawn that no rule can reach, which would mean either a
    // wasted commission or a rule that was removed and left its face behind.
    for (const mood of Object.keys(SCOUT)) {
      expect(used, `${mood} is drawn but no rule uses it`).toContain(mood);
    }
  });

  it('has an icon for every tab the shell names', () => {
    for (const name of TAB_ICONS) {
      expect(ICONS[name], `no icon named ${name}`).toBeTruthy();
    }
  });

  it('carries icons as usable path data on the stated grid', () => {
    expect(Object.keys(ICONS).length).toBe(22);
    for (const [name, paths] of Object.entries(ICONS)) {
      expect(paths.length, name).toBeGreaterThan(0);
      for (const d of paths) {
        expect(d, name).toMatch(/^M/);
        expect(d, name).not.toMatch(/NaN|undefined/);
      }
    }
    expect(ICON_BOX).toBe(24);
  });

  it('strips the paper and the broken kicker off the press set', () => {
    expect(Object.keys(PRESS).length).toBeGreaterThan(0);
    for (const [name, plate] of Object.entries(PRESS)) {
      expect(plate.body, name).not.toMatch(/#f4efe2/i);
      // The kicker is set in a type with no digits drawn, so it renders with
      // holes; it is the only accent-coloured group and it must not survive.
      expect(plate.body, name).not.toMatch(/#5980a6/i);
      expect(plate.body, `${name} must take the theme's ink`).toMatch(/currentColor/);
      expect(plate.w, name).toBeGreaterThan(0);
    }
  });

  it('keeps the plinth off the board copy of the coloured houses', () => {
    // The reason there are two cuts. On the board these stand on a lot the
    // board has coloured by data; a baked lawn would hide the answer.
    const ground = ['#cdc4b1', '#b0a693', '#9e9584', '#8b9d63'];
    for (const [id, states] of Object.entries(HOUSE_COLOR_BARE)) {
      for (const [state, body] of Object.entries(states)) {
        for (const fill of ground) {
          expect(body, `${id}/${state} still has ${fill}`).not.toContain(fill);
        }
      }
    }
    // And keeps it on the picture copy, or the houses would float there.
    for (const id of Object.keys(HOUSE_COLOR)) {
      expect(HOUSE_COLOR[id].base, `${id} lost its plinth`).toContain('#cdc4b1');
    }
  });

  it('can place every coloured house on the board grid', () => {
    expect(COLOR_UNIT).toBeGreaterThan(0);
    for (const id of Object.keys(HOUSE_COLOR)) {
      const t = COLOR_TRANSFORM[id];
      expect(t, `${id} has no transform`).toBeDefined();
      expect(t.k, `${id} scale`).toBeGreaterThan(0);
    }
    // Every archetype the engine generates must resolve to a coloured drawing
    // too, or the board's colour style has holes the line style does not.
    for (const a of ARCHETYPES) {
      expect(HOUSE_COLOR[artIdFor(a.id)], `${a.id} has no coloured drawing`).toBeDefined();
    }
  });

  it('places lot furniture on the lot, not inside the house', () => {
    // Every piece is drawn standing at its own lot's centre, which is exactly
    // where the building is. Without an offset a for-sale board is planted in
    // the living room and hidden by the roof.
    const listing = lotFurniture(3, 4, { ownership: null });
    expect(listing.map((p) => p.name)).toContain('for_sale_sign');
    for (const p of [...listing, ...lotFurniture(2, 2, null)]) {
      expect(p.u, `${p.name} u`).toBeGreaterThan(0);
      expect(p.u, `${p.name} u`).toBeLessThan(1);
      expect(p.v, `${p.name} v`).toBeGreaterThan(0);
      expect(p.v, `${p.name} v`).toBeLessThan(1);
    }
    // The sign belongs toward the front, which is the only part of the lot the
    // house does not stand on.
    const sign = listing.find((p) => p.name === 'for_sale_sign')!;
    expect(sign.u + sign.v).toBeGreaterThan(1.4);

    // A permit that is still queued is the one fact the board cannot otherwise
    // show; an issued one must not leave a board standing in the drive.
    const queued = lotFurniture(1, 1, {
      ownership: { renovation: { permit: { required: true, daysWaited: 2, queueDays: 10 } } },
    });
    expect(queued.map((p) => p.name)).toContain('permit_board');
    const issued = lotFurniture(1, 1, {
      ownership: { renovation: { permit: { required: true, daysWaited: 10, queueDays: 10 } } },
    });
    expect(issued.map((p) => p.name)).not.toContain('permit_board');
  });

  it('keeps empty-lot dressing stable across redraws', () => {
    // Derived from the coordinates alone. A tree that changes species when the
    // day advances reads as a rendering bug, not as weather.
    for (const [gx, gy] of [
      [0, 0],
      [3, 7],
      [11, 2],
      [16, 16],
    ]) {
      expect(lotFurniture(gx, gy, null)).toEqual(lotFurniture(gx, gy, null));
    }
    const across = Array.from({ length: 17 }, (_, i) => lotFurniture(i, 5, null).length);
    // Some lots planted, some bare, or it is either a forest or a car park.
    expect(across.some((n) => n > 0)).toBe(true);
    expect(across.some((n) => n === 0)).toBe(true);
  });

  it('divides out each furniture piece own artboard fitting', () => {
    // These arrived wrapped in a fit-to-artboard transform, like the coloured
    // houses but inline. Ingesting it without dividing it back out rendered
    // every piece at artboard size on the lot -- a tree taller than a house.
    for (const [name, piece] of Object.entries(FURNITURE_COLOR)) {
      expect(piece.k, `${name} scale`).toBeGreaterThan(0);
      expect(piece.body, name).toMatch(/^<g transform="translate\(/);
      expect(Number.isFinite(piece.tx) && Number.isFinite(piece.ty), name).toBe(true);
    }
    expect(Object.keys(FURNITURE_COLOR)).toHaveLength(14);
  });

  it('dresses the board for the season the rest of the game is in', () => {
    // Read from the same seasonOf the property facade uses, so the two pictures
    // of one house cannot disagree about the time of year.
    const seen = new Set<string | null>();
    for (let day = 0; day < 366; day += 7) seen.add(boardSeason(day));
    expect(seen.has('autumn'), 'autumn never comes').toBe(true);
    expect(seen.has('dusk'), 'winter never comes').toBe(true);
    expect(seen.has(null), 'spring and summer must use the set as drawn').toBe(true);

    for (const season of ['autumn', 'dusk']) {
      const set = HOUSE_SEASON[season];
      expect(set, `${season} has no drawings`).toBeDefined();
      for (const id of Object.keys(HOUSE_COLOR_BARE)) {
        expect(set[id], `${season}/${id}`).toBeDefined();
        expect(set[id].k, `${season}/${id} scale`).toBeGreaterThan(0);
        // A remap that came back identical would mean the season is drawn but
        // not applied, which looks exactly like it working.
        expect(set[id].base, `${season}/${id} is identical to the base set`).not.toBe(
          HOUSE_COLOR_BARE[id].base,
        );
        // And the plinth has to be off these too, or a seasonal lot covers the
        // data ramp that a spring one does not.
        expect(set[id].base).not.toContain('#cdc4b1');
      }
      const map = SEASON_MAP[season];
      expect(Object.keys(map).length, `${season} colour map`).toBeGreaterThan(20);
    }
  });

  it('writes the interface art sheet', () => {
    const cols = 8;
    const cell = 92;
    let body = '';
    let y = 40;

    body += label('ICONS', 12, y - 14);
    Object.keys(ICONS).forEach((name, i) => {
      const x = 12 + (i % cols) * cell;
      const yy = y + Math.floor(i / cols) * 64;
      body +=
        `<g transform="translate(${x} ${yy}) scale(1.4)" fill="none" stroke="#1d1f20"` +
        ` stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
        ICONS[name].map((d) => `<path d="${d}"/>`).join('') +
        `</g>` +
        `<text x="${x}" y="${yy + 46}" font-family="sans-serif" font-size="8" fill="#7a7a7d">${name}</text>`;
    });
    y += Math.ceil(Object.keys(ICONS).length / cols) * 64 + 34;

    body += label('SCOUT', 12, y - 14);
    const faces = [...Object.entries(SCOUT), ...Object.entries(NPC)];
    faces.forEach(([name, markup], i) => {
      const x = 12 + i * cell;
      body +=
        `<g transform="translate(${x} ${y}) scale(${(cell - 16) / SCOUT_BOX})">${markup}</g>` +
        `<text x="${x}" y="${y + cell - 4}" font-family="sans-serif" font-size="8" fill="#7a7a7d">${name}</text>`;
    });
    y += cell + 30;

    body += label('PRESS', 12, y - 14);
    for (const [name, plate] of Object.entries(PRESS)) {
      const w = 320;
      const h = (plate.h / plate.w) * w;
      body +=
        `<g transform="translate(12 ${y}) scale(${w / plate.w})" color="#1d1f20">${plate.body}</g>` +
        `<text x="${w + 24}" y="${y + h / 2}" font-family="sans-serif" font-size="9" fill="#7a7a7d">${name}</text>`;
      y += h + 10;
    }

    expect(body).not.toMatch(/NaN|Infinity|undefined/);

    const width = 12 + cols * cell + 20;
    writeFileSync(
      'docs/design/ui-art-sheet.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y + 20}"` +
        ` width="${width}" height="${y + 20}">` +
        `<rect width="100%" height="100%" fill="#f2f2f3"/>${body}</svg>\n`,
      'utf8',
    );
  });
});

function label(text: string, x: number, y: number): string {
  return (
    `<text x="${x}" y="${y}" font-family="sans-serif" font-size="10" font-weight="600"` +
    ` letter-spacing="1.6" fill="#1d1f20">${text}</text>`
  );
}
