import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/engine';
import Board from '../src/ui/board/Board';

/**
 * The pictures the README shows, generated rather than captured.
 *
 * A screenshot pasted into a repository is out of date the first time somebody
 * changes a colour, and nobody ever notices because nobody diffs a PNG. These
 * come out of the same components the game renders, in the test run, so a
 * README image that disagrees with the game is a failing build rather than a
 * stale file.
 *
 * They are SVG because GitHub renders it, it stays sharp on any display, and
 * the whole board is a few hundred kilobytes of paths rather than a photograph
 * of some pixels.
 */

const OUT = 'docs/images';

/** The dark palette, frozen: a README image has to carry its own ground. */
const INK = {
  bg: '#131e29',
  text: '#f2f2f3',
  accent: '#94bce3',
  street: '#22303d',
};

function paint(svg: string): string {
  return svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .split('var(--color-bg)')
    .join(INK.bg)
    .split('var(--color-text)')
    .join(INK.text)
    .split('var(--color-accent-ink)')
    .join(INK.accent)
    .split('var(--color-accent)')
    .join(INK.accent)
    .split('var(--color-neutral-300)')
    .join(INK.street);
}

function boardSvg(style: 'line' | 'colour', day: number): string {
  /*
   * Two districts rather than six.
   *
   * The full board is a better instrument and a worse picture: a hundred and
   * fifty lots at README width is a texture, and the coloured version of it is
   * a two-megabyte file to say so. The opening campaign is the same town, drawn
   * close enough to read.
   */
  const state = createGame('first_flip', 909);
  state.day = day;

  // A town with something happening in it: a job running, one let, one listed,
  // one derelict, and one waiting on the city.
  const forced = [
    { renovation: { permit: null } },
    { rental: { tenancy: {} } },
    { saleListing: {} },
    null,
    { renovation: { permit: { required: true, daysWaited: 1, queueDays: 20 } } },
  ];
  state.market.forEach((p, i) => {
    if (i < forced.length && forced[i]) {
      (p as unknown as { ownership: unknown }).ownership = forced[i];
    }
    if (i === 3) p.condition = 0.15;
  });

  globalThis.localStorage = {
    getItem: (k: string) => (k === 'flipper:boardArt' ? style : null),
    setItem: () => {},
  } as unknown as Storage;

  const html = renderToStaticMarkup(createElement(Board, { state }));
  return html.match(/<svg[\s\S]*?<\/svg>/)![0];
}

describe('the README images', () => {
  it('draws the town in both styles, and writes them', () => {
    mkdirSync(OUT, { recursive: true });

    for (const [style, day, name] of [
      ['colour', 40, 'board-colour'],
      ['line', 40, 'board-line'],
    ] as const) {
      const svg = boardSvg(style, day);
      expect(svg, `${name} must not render a broken number`).not.toMatch(
        /NaN|Infinity|undefined/,
      );

      const vb = svg.match(/viewBox="([^"]+)"/)![1];
      const [, , w, h] = vb.split(' ').map(Number);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);

      // A town, not an empty grid: the scenery is most of what is drawn.
      const houses = (svg.match(/lot-house/g) ?? []).length;
      const scenery = (svg.match(/lot-backdrop/g) ?? []).length;
      expect(houses, `${name} houses`).toBeGreaterThan(5);
      expect(scenery, `${name} scenery`).toBeGreaterThan(15);

      writeFileSync(
        `${OUT}/${name}.svg`,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
          `<rect width="100%" height="100%" fill="${INK.bg}"/>${paint(svg)}</svg>\n`,
        'utf8',
      );
    }
  });
});
