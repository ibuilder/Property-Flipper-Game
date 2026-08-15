import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../src/engine/content';
import {
  COLOR_TRANSFORM,
  COLOR_UNIT,
  HOUSE_COLOR,
  HOUSE_COLOR_BARE,
  ICONS,
  ICON_BOX,
  NPC,
  PRESS,
  SCOUT,
  SCOUT_BOX,
} from '../src/ui/art.generated';
import { artIdFor } from '../src/ui/board/art';
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
