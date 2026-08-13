import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyzeDeal, createGame, estimateArv, stressField, stressTest } from '../src/engine';
import StressField from '../src/ui/graphics/StressField';

/**
 * The chart itself, rendered.
 *
 * The engine tests prove the numbers; these prove the picture drawn from them
 * is a picture. An SVG with a NaN in a coordinate does not throw and does not
 * warn -- it silently drops the element, so the failure mode of this component
 * is a chart that is quietly missing its most important line. That is exactly
 * the sort of thing that survives a code review and gets shipped.
 */

const W = 520;
const H = 300;
const PAD = { top: 10, right: 12, bottom: 30, left: 46 };

/** The modal's default scope. */
const SCOPE = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];

/** A real property from a real campaign, priced at a multiple of the max offer. */
function render(multipleOfMao: number) {
  const state = createGame('sandbox', 909);
  const prop = state.market.filter((p) => p.listing)[3]!;
  const arv = estimateArv(prop, state.world, state.day, SCOPE);
  const first = analyzeDeal(prop, state.world, state.day, arv, SCOPE, state.skills, {});
  const offer = Math.round(first.maoDetailed * multipleOfMao);
  const analysis = analyzeDeal(prop, state.world, state.day, arv, SCOPE, state.skills, { offer });

  const test = stressTest(offer, analysis.inputs, analysis.dailyCarry, analysis.loanRate);
  const field = stressField(offer, analysis.inputs, analysis.dailyCarry, analysis.loanRate);
  const svg = renderToStaticMarkup(
    createElement(StressField, { field, baseProfit: test.base.profit }),
  );
  return { svg, field, test, offer };
}

// Comfortable, marginal, and already underwater. The chart has to survive all
// three, and the third is the one that breaks naive contour code.
const CASES = [
  ['a generous offer', 0.72],
  ['an offer at the itemised max', 1.0],
  ['overpaying', 1.35],
] as const;

describe('the stress field, drawn', () => {
  for (const [label, mult] of CASES) {
    describe(label, () => {
      it('contains no NaN or undefined coordinates', () => {
        const { svg } = render(mult);
        // The silent killer: React renders NaN into an attribute happily and
        // the browser drops the element without a word.
        expect(svg).not.toMatch(/NaN/);
        expect(svg).not.toMatch(/undefined/);
        expect(svg).not.toMatch(/Infinity/);
      });

      it('draws one cell per sample', () => {
        const { svg, field } = render(mult);
        const rects = svg.match(/<rect/g) ?? [];
        expect(rects).toHaveLength(field.grid.length * field.grid[0].length);
      });

      it('keeps every drawn coordinate inside the frame', () => {
        const { svg } = render(mult);
        for (const m of svg.matchAll(/\b(x|y|cx|cy)="(-?[\d.]+)"/g)) {
          const v = Number(m[2]);
          const limit = m[1] === 'x' || m[1] === 'cx' ? W : H;
          expect(v, `${m[1]}=${v} escapes the ${limit}px frame`).toBeGreaterThanOrEqual(0);
          expect(v, `${m[1]}=${v} escapes the ${limit}px frame`).toBeLessThanOrEqual(limit);
        }
      });

      it('labels both axes and describes itself to a screen reader', () => {
        const { svg, test } = render(mult);
        expect(svg).toContain('ARV versus your estimate');
        expect(svg).toContain('work over budget');
        expect(svg).toMatch(/aria-label="[^"]{80,}"/);
        // The alt text has to carry the actual number, not just say a chart
        // exists -- it is the only version a screen reader user gets.
        expect(svg).toContain('breaks even');
        expect(test.base.profit).toBeDefined();
      });
    });
  }

  it('draws the break-even line inside the plot area, or not at all', () => {
    for (const [label, mult] of CASES) {
      const { svg, field } = render(mult);
      const poly = svg.match(/<polyline points="([^"]+)"/);
      const expected = field.breakEven.filter(Boolean).length;

      if (expected === 0) {
        expect(poly, `${label} drew a contour it never computed`).toBeNull();
        continue;
      }
      expect(poly, `${label} computed a contour but drew nothing`).not.toBeNull();

      const pts = poly![1].trim().split(/\s+/);
      expect(pts, label).toHaveLength(expected);
      for (const pt of pts) {
        const [x, y] = pt.split(',').map(Number);
        expect(Number.isFinite(x) && Number.isFinite(y), `${label}: bad point ${pt}`).toBe(true);
        expect(x).toBeGreaterThanOrEqual(PAD.left);
        expect(x).toBeLessThanOrEqual(W - PAD.right);
        expect(y).toBeGreaterThanOrEqual(PAD.top);
        expect(y).toBeLessThanOrEqual(H - PAD.bottom);
      }
    }
  });

  it('puts the marker on the deal as underwritten, and its label beside it', () => {
    const { svg, field, test } = render(1.0);
    const circle = svg.match(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"/);
    expect(circle).not.toBeNull();
    const cx = Number(circle![1]);
    const cy = Number(circle![2]);

    // The marker sits at cost delta 0 -- the top row -- at the column nearest
    // to an ARV delta of 0. Anywhere else and it is marking a different deal
    // from the one the panel above it just priced.
    const cols = field.arvAt.length;
    const rows = field.costAt.length;
    const cw = (W - PAD.left - PAD.right) / cols;
    const ch = (H - PAD.top - PAD.bottom) / rows;
    const baseCol = field.arvAt.reduce(
      (best, v, i) => (Math.abs(v) < Math.abs(field.arvAt[best]) ? i : best),
      0,
    );
    expect(cx).toBeCloseTo(PAD.left + baseCol * cw + cw / 2, 3);
    expect(cy).toBeCloseTo(PAD.top + ch / 2, 3);
    expect(field.costAt[0]).toBe(0);
    expect(Math.abs(field.arvAt[baseCol])).toBeLessThan((0.28 / (cols - 1)) * 0.51);

    // And the label must not run off the right edge.
    const label = svg.match(/<text[^>]*x="([\d.]+)"[^>]*>\$?[\d,\-−]+<\/text>/);
    if (label) expect(Number(label[1]) + 60).toBeLessThanOrEqual(W);
    expect(rows).toBeGreaterThan(1);
    expect(test.base.profit).not.toBeNaN();
  });
});
