import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES, EVENTS } from '../src/engine/content';
import {
  COLOR_TRANSFORM,
  COLOR_UNIT,
  HOUSE_COLOR_BARE,
  HOUSE_PLINTH,
  HOUSE_SEASON,
  SEASON_NAMES,
  FURNITURE_COLOR,
  FURNITURE_LINE,
  SPRITE_COLOR,
  SPRITE_LINE,
  SPRITE_NAMES,
  ICONS,
  ICON_BOX,
  NPC,
  PRESS,
  SCOUT,
  SCOUT_BOX,
} from '../src/ui/art.generated';
import {
  artIdFor,
  boardSeason,
  lotFurniture,
  scoutDrawing,
  scoutLot,
} from '../src/ui/board/art';
import { RULES } from '../src/ui/coach/rules';
import { PLATES } from '../src/ui/components/NewsRail';

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

  it('has a drawing for every name the interface actually asks for', () => {
    /*
     * Scans the source rather than a list kept alongside it. A hand-maintained
     * list of what is used is the thing that goes stale, and a missing icon
     * fails silently -- `Icon` renders nothing rather than throwing, so a typo
     * shows up as a slightly narrower heading and nothing else.
     */
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.tsx')) files.push(full);
      }
    };
    walk('src/ui');

    const icons = new Set<string>();
    const faces = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<Icon\s+name="([^"]+)"/g)) icons.add(m[1]);
      for (const m of src.matchAll(/<Face\s+who="([^"]+)"/g)) faces.add(m[1]);
    }

    expect(icons.size, 'no icons are being used at all').toBeGreaterThan(6);
    for (const name of icons) {
      expect(ICONS[name], `the interface asks for icon "${name}" and it is not drawn`).toBeTruthy();
    }
    for (const who of faces) {
      expect(NPC[who], `the interface asks for face "${who}" and it is not drawn`).toBeTruthy();
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

  it('inks the press set with theme tokens rather than paper', () => {
    expect(Object.keys(PRESS).length).toBeGreaterThan(0);
    // The cover is a poster for the itch page, rasterised from art/ by a build
    // script. Shipping it inside the app would carry an illustration nothing
    // draws.
    expect(PRESS['cover-630x500'], 'the cover must not ship in the bundle').toBeUndefined();
    for (const [name, plate] of Object.entries(PRESS)) {
      expect(plate.w, name).toBeGreaterThan(0);
      expect(plate.h, name).toBeGreaterThan(0);
      expect(plate.body, `${name} still carries a paper ground`).not.toMatch(/#f4efe2/i);
      expect(plate.body, `${name} must take the theme's ink`).toMatch(/currentColor/);
      // Raw accent hex is mapped to the token so the kicker -- switched on now
      // the face has digits -- follows the theme rather than one fixed blue.
      expect(plate.body, `${name} has a hardcoded accent`).not.toMatch(/#5980a6/i);
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
    // And it is kept, once, so a house that is the subject still stands on
    // something. Carrying a whole second copy of every house cost 438KB.
    for (const id of Object.keys(HOUSE_COLOR_BARE)) {
      expect(HOUSE_PLINTH[id], `${id} has no plinth`).toContain('#cdc4b1');
    }
  });

  it('can place every coloured house on the board grid', () => {
    expect(COLOR_UNIT).toBeGreaterThan(0);
    for (const id of Object.keys(HOUSE_COLOR_BARE)) {
      const t = COLOR_TRANSFORM[id];
      expect(t, `${id} has no transform`).toBeDefined();
      expect(t.k, `${id} scale`).toBeGreaterThan(0);
    }
    // Every archetype the engine generates must resolve to a coloured drawing
    // too, or the board's colour style has holes the line style does not.
    for (const a of ARCHETYPES) {
      expect(HOUSE_COLOR_BARE[artIdFor(a.id)], `${a.id} has no coloured drawing`).toBeDefined();
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

  it('carries an anchor and a fit for every placeable piece', () => {
    /*
     * The anchor is the whole reason these can be placed at all. The line
     * furniture was unusable for two deliveries because it had been centred on
     * its own bounding box -- a fence belongs on a boundary and a driveway at
     * the kerb, and centred they are the same drawing.
     *
     * The fit has to be divided back out at placement. Ingesting it without
     * doing so rendered every piece at artboard size: measured in the app, all
     * fourteen identical at 65.8px on a lot 24.2px tall.
     */
    for (const [label, set] of [
      ['line', FURNITURE_LINE],
      ['colour', FURNITURE_COLOR],
    ] as const) {
      expect(Object.keys(set), `${label} furniture`).toHaveLength(14);
      for (const [name, piece] of Object.entries(set)) {
        expect(piece.scale, `${label}/${name} fit`).toBeGreaterThan(0);
        expect(Number.isFinite(piece.anchor[0]), `${label}/${name} anchor x`).toBe(true);
        expect(Number.isFinite(piece.anchor[1]), `${label}/${name} anchor y`).toBe(true);
        expect(piece.body.length, `${label}/${name} body`).toBeGreaterThan(0);
      }
    }
    // Both finishes must describe the same piece in the same place, or the two
    // board styles disagree about where a hedge is.
    for (const name of Object.keys(FURNITURE_LINE)) {
      expect(FURNITURE_COLOR[name], `${name} has no coloured twin`).toBeDefined();
    }
  });

  it('anchors all six Scout frames on one ground point', () => {
    // Frames alternate. If the contact point moved between them he would hop.
    for (const [label, set] of [
      ['colour', SPRITE_COLOR],
      ['line', SPRITE_LINE],
    ] as const) {
      expect(Object.keys(set), `${label} sprites`).toHaveLength(SPRITE_NAMES.length);
      const anchors = new Set(Object.values(set).map((p) => `${p.anchor[0]},${p.anchor[1]}`));
      expect(anchors.size, `${label} sprites must share one ground point`).toBe(1);
    }
  });

  it('dresses the board for the season the rest of the game is in', () => {
    // Read from the same seasonOf the property facade uses, so the two pictures
    // of one house cannot disagree about the time of year.
    const seen = new Set<string | null>();
    for (let day = 0; day < 366; day += 7) seen.add(boardSeason(day));
    expect(seen.has('autumn'), 'autumn never comes').toBe(true);
    expect(seen.has('winter'), 'winter never comes').toBe(true);
    expect(seen.has(null), 'spring and summer must use the set as drawn').toBe(true);

    for (const season of SEASON_NAMES) {
      const set = HOUSE_SEASON[season];
      expect(set, `${season} has no drawings`).toBeDefined();
      for (const id of Object.keys(HOUSE_COLOR_BARE)) {
        expect(set[id], `${season}/${id}`).toBeDefined();
        // A remap that came back identical would mean the season is drawn but
        // not applied, which looks exactly like it working.
        expect(set[id].base, `${season}/${id} is identical to the base set`).not.toBe(
          HOUSE_COLOR_BARE[id].base,
        );
        // The plinth has to be off these too, or a seasonal lot covers the data
        // ramp that a spring one does not.
        expect(set[id].base, `${season}/${id} kept its plinth`).not.toContain('#cdc4b1');
        // And every condition state has to exist, or a house being renovated
        // loses its scaffolding when the leaves turn.
        for (const st of ['distressed', 'occupied', 'working', 'finished']) {
          expect(set[id][st], `${season}/${id}/${st}`).toBeTruthy();
        }
      }
    }
  });

  it('has a headline plate for every market event', () => {
    // Two plates used to name events this game does not have. They were
    // redrawn rather than renamed, so the drawn words match the story.
    const events = EVENTS.map((e) => e.id);
    for (const id of events) {
      expect(PLATES[id], `market event ${id} has no plate mapped`).toBeTruthy();
      expect(PRESS[PLATES[id]], `${id} maps to a plate that is not drawn`).toBeTruthy();
    }
    for (const name of Object.keys(PRESS)) {
      if (!name.startsWith('plate-')) continue;
      const claimed = Object.values(PLATES).includes(name);
      expect(claimed, `${name} is drawn but no event uses it`).toBe(true);
    }
  });

  it('puts Scout on the job that is running, and only there', () => {
    const working = { ownership: { renovation: {} } };
    const idle = { ownership: null };
    const parcels = [
      { gx: 9, gy: 9, property: idle },
      { gx: 4, gy: 2, property: working },
      { gx: 7, gy: 1, property: working },
      { gx: 1, gy: 1, property: null },
    ];
    const isWorking = (p: unknown) =>
      Boolean((p as { ownership?: { renovation?: unknown } })?.ownership?.renovation);

    const lot = scoutLot(parcels, isWorking)!;
    expect(lot, 'Scout should stand on a live job').toBeTruthy();
    // Ties break on position so he does not teleport between two equally valid
    // sites as the day advances.
    expect([lot.gx, lot.gy]).toEqual([4, 2]);
    expect(scoutLot(parcels, isWorking)).toBe(lot);

    // No job, no dog. A figure on every lot is a kennel, not a town.
    expect(scoutLot([{ gx: 0, gy: 0, property: idle }], isWorking)).toBeNull();
    expect(scoutLot([], isWorking)).toBeNull();
  });

  it('alternates Scout on the day rather than on a timer', () => {
    // The board is a still picture of one day, so the animation belongs to time
    // passing in the game. It also means nothing runs while nothing happens.
    const a = scoutDrawing(3, 4, 'digging', 10, 'colour', 0, 0)!;
    const b = scoutDrawing(3, 4, 'digging', 11, 'colour', 0, 0)!;
    expect(a.body).not.toBe(b.body);
    expect(scoutDrawing(3, 4, 'digging', 12, 'colour', 0, 0)!.body).toBe(a.body);
    // Same lot, same transform: alternating frames must not make him hop.
    expect(a.transform).toBe(b.transform);

    for (const style of ['line', 'colour'] as const) {
      for (const action of ['idle', 'walking', 'digging'] as const) {
        expect(scoutDrawing(2, 2, action, 0, style, 0, 0), `${style}/${action}`).toBeTruthy();
      }
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
