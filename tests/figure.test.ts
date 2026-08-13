import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analyzeDeal, createGame, estimateArv, type GameState, type Property } from '../src/engine';
import DealAnalyzer from '../src/ui/components/DealAnalyzer';
import Figure from '../src/ui/components/Figure';

const SCOPE = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];

function analysisAt(multipleOfMao: number): {
  html: string;
  profit: number;
  state: GameState;
  prop: Property;
} {
  const state = createGame('sandbox', 909);
  const prop = state.market.filter((p) => p.listing)[3]!;
  const arv = estimateArv(prop, state.world, state.day, SCOPE);
  const first = analyzeDeal(prop, state.world, state.day, arv, SCOPE, state.skills, {});
  const offer = Math.round(first.maoDetailed * multipleOfMao);
  const analysis = analyzeDeal(prop, state.world, state.day, arv, SCOPE, state.skills, { offer });
  const html = renderToStaticMarkup(
    createElement(DealAnalyzer, { analysis, offer, cashOnHand: state.cash }),
  );
  return { html, profit: analysis.breakdown?.profit ?? 0, state, prop };
}

describe('a figure', () => {
  it('puts the formula next to the value, not behind a disclosure', () => {
    const html = renderToStaticMarkup(
      createElement(Figure, {
        label: 'Max offer',
        value: '$123,456',
        formula: '(ARV × 0.7) − repairs',
      }),
    );
    expect(html).toContain('$123,456');
    expect(html).toContain('(ARV × 0.7) − repairs');
    expect(html).toContain('figure-formula');
    // No <details>, no toggle: the working is not something you opt into.
    expect(html).not.toMatch(/<details|<summary|<button/);
  });

  it('wears the loss colour only when handed it', () => {
    const plain = renderToStaticMarkup(
      createElement(Figure, { label: 'x', value: '$1' }),
    );
    const loss = renderToStaticMarkup(
      createElement(Figure, { label: 'x', value: '-$1', tone: 'loss' }),
    );
    expect(plain).not.toContain('figure-loss');
    expect(loss).toContain('figure-loss');
  });
});

describe('the deal analyser', () => {
  it('gives every figure a formula', () => {
    // The rule the handoff sets: a number with no visible provenance is a
    // number the player cannot argue with, and arguing with it is the game.
    const { html } = analysisAt(1.0);
    // Root figures only. Counting `class="figure` would also catch
    // figure-label, figure-value and figure-formula on every child.
    const figures = (html.match(/class="figure figure-(stat|row|hero)/g) ?? []).length;
    const formulas = (html.match(/class="figure-formula"/g) ?? []).length;
    expect(figures).toBeGreaterThan(8);
    expect(formulas, 'a figure somewhere is not showing its working').toBe(figures);
  });

  it('shows both max offers with their working, side by side', () => {
    const { html } = analysisAt(1.0);
    expect(html).toContain('Max offer — rule of thumb');
    expect(html).toContain('Max offer — itemised');
    expect(html).toContain('mao-pair');
    // The rule of thumb shows its actual arithmetic rather than naming itself.
    expect(html).toMatch(/\(\$[\d,]+ × 0\.7\) − \$[\d,]+/);
  });

  it('turns the verdict plate red only when the projection is negative', () => {
    // Red appears in one place in the whole game. If it starts appearing on
    // healthy deals it stops meaning anything, which is the entire argument
    // for the rule.
    const good = analysisAt(0.7);
    expect(good.profit).toBeGreaterThan(0);
    expect(good.html).toContain('verdict-plate');
    expect(good.html).not.toContain('verdict-plate loss');
    expect(good.html).not.toContain('figure-loss');

    const bad = analysisAt(1.45);
    expect(bad.profit).toBeLessThan(0);
    expect(bad.html).toContain('verdict-plate loss');
    expect(bad.html).toContain('figure-loss');
  });

  it('uses the loss tone nowhere but the verdict', () => {
    for (const mult of [0.7, 1.0, 1.45]) {
      const { html } = analysisAt(mult);
      expect(html.split('figure-loss').length - 1).toBeLessThanOrEqual(1);
    }
  });

  it('renders without NaN at any offer', () => {
    for (const mult of [0.2, 0.7, 1.0, 1.45, 2.0]) {
      const { html } = analysisAt(mult);
      expect(html, `at ${mult}× MAO`).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('states the carry as days times a rate, not as a total to take on trust', () => {
    const { html } = analysisAt(1.0);
    expect(html).toMatch(/\d+ days × \$[\d,]+\/day/);
  });
});
