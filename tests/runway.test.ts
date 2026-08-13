import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  advanceDay,
  cashRunway,
  createGame,
  describeRunway,
  estimateArv,
  makeOffer,
  quoteScope,
  rule70Mao,
  runwayLevel,
  startRenovation,
  type GameState,
} from '../src/engine';
import HoldingCost from '../src/ui/graphics/HoldingCost';

const SCOPE = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];

/**
 * Buy something, financed, and start work on it.
 *
 * Pays well over asking, the same trick the timeline tests use: an offer that
 * merely clears the 70% rule can lose to a rival or be refused, and a setup
 * that sometimes fails to buy turns every assertion below into a test of the
 * dice rather than of the runway.
 */
function withAProperty(seed = 909, financed = true): GameState {
  const state = createGame('the_grind', seed);
  const target = state.market.find((p) => p.listing);
  expect(target, 'nothing listed on day one').toBeDefined();
  const res = makeOffer(state, target!.id, Math.round(target!.listing!.askPrice * 1.15), financed);
  expect(res.ok, `setup purchase failed: ${res.message}`).toBe(true);

  for (let d = 0; d < 20; d++) {
    for (const p of state.portfolio) {
      if (p.ownership && !p.ownership.renovation && p.ownership.renovationSpend === 0) {
        startRenovation(state, p.id, SCOPE, 0.1);
      }
    }
    advanceDay(state);
  }
  expect(state.portfolio.length, 'setup produced no portfolio').toBeGreaterThan(0);
  return state;
}

describe('the daily cost of holding', () => {
  it('reports nothing to hold when nothing is held', () => {
    const r = cashRunway(createGame('the_grind', 909));
    expect(r.lines).toHaveLength(0);
    expect(r.burn).toBe(0);
    expect(r.accruing).toBe(0);
    expect(r.days).toBeNull();
    expect(runwayLevel(r)).toBe('idle');
    expect(describeRunway(r)).toBeNull();
  });

  it('matches what the day actually takes out of the balance', () => {
    // The reason to compute this from the same functions the tick uses. If the
    // projection and the ledger disagree, the panel is lying about the future.
    const state = withAProperty();
    expect(state.portfolio.length).toBeGreaterThan(0);
    const r = cashRunway(state);

    const before = state.cash;
    const cashBefore = r.burn;
    advanceDay(state);
    const actual = before - state.cash;

    // Renovation draws and sale proceeds are lumpy and land on their own days;
    // this compares the smooth part, which is what the panel projects.
    const lumpy = state.ledger
      .filter((e) => e.day === state.day - 1)
      .filter((e) => e.category !== 'holding' && e.category !== 'financing' && e.category !== 'rent' && e.category !== 'rentalOpex')
      .reduce((s, e) => s + e.amount, 0);
    expect(actual + lumpy).toBeCloseTo(cashBefore, 0);
  });

  it('counts interest-only debt as accruing, not as cash leaving', () => {
    const state = withAProperty(909, true);
    const r = cashRunway(state);
    const loan = state.loans[0];
    if (!loan || loan.kind === 'term') return;

    expect(r.accruing).toBeGreaterThan(0);
    // It accrues on the loan and never appears as money moving.
    const financingOut = state.ledger
      .filter((e) => e.category === 'financing' && e.description.startsWith('Interest accrued'))
      .reduce((s, e) => s + e.amount, 0);
    expect(financingOut).toBe(0);
    expect(loan.interestAccrued).toBeGreaterThan(0);
  });

  it('treats contingency as committed rather than spendable', () => {
    const state = withAProperty();
    const r = cashRunway(state);
    const job = state.portfolio.find((p) => p.ownership?.renovation)?.ownership?.renovation;
    if (!job) return;
    expect(r.reserved).toBe(Math.round(job.contingencyRemaining));
    expect(r.free).toBe(r.cash - r.reserved);
    expect(r.free).toBeLessThanOrEqual(r.cash);
  });

  it('sorts the worst drain first, because that is the one to act on', () => {
    const state = withAProperty();
    const r = cashRunway(state);
    for (let i = 1; i < r.lines.length; i++) {
      expect(r.lines[i].net).toBeGreaterThanOrEqual(r.lines[i - 1].net);
    }
  });

  it('grades on the daily cost, not on days of cash', () => {
    // Days-of-cash measured 524 to 17,475 across every sample taken, so it
    // cannot separate a healthy position from a costly one. If this ever
    // regresses to a days-based threshold, every real campaign reads 'idle'.
    const state = withAProperty();
    const r = cashRunway(state);
    expect(r.freeDays === null || r.freeDays > 200).toBe(true);
    expect(runwayLevel(r)).not.toBe('idle');
  });

  it('says nothing when holding is genuinely cheap', () => {
    const r = {
      ...cashRunway(createGame('the_grind', 909)),
      burn: 5,
      accruing: 2,
      free: 100_000,
    };
    expect(describeRunway(r)).toBeNull();
  });

  it('leads on the invisible half when the invisible half is bigger', () => {
    const base = cashRunway(createGame('the_grind', 909));
    const text = describeRunway({ ...base, burn: 40, accruing: 160, free: 100_000 })!;
    expect(text).toMatch(/never touches your balance|accru/i);
    expect(text).toMatch(/closing/i);
    // And it converts to a figure a player can feel.
    expect(text).toContain('90-day');
  });

  it('calls being committed past the balance what it is', () => {
    const base = cashRunway(createGame('the_grind', 909));
    const r = { ...base, free: -5_000, cash: 1_000, reserved: 6_000 };
    expect(runwayLevel(r)).toBe('bleeding');
    expect(describeRunway(r)).toMatch(/committed/i);
  });
});

describe('the holding-cost bar', () => {
  it('renders nothing when there is no cost to show', () => {
    const r = cashRunway(createGame('the_grind', 909));
    expect(renderToStaticMarkup(createElement(HoldingCost, { runway: r, level: 'idle' }))).toBe('');
  });

  it('draws a segment per component and no NaN', () => {
    const state = withAProperty();
    const r = cashRunway(state);
    const svg = renderToStaticMarkup(
      createElement(HoldingCost, { runway: r, level: runwayLevel(r) }),
    );
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    expect(svg).toMatch(/<rect/);
    expect(svg).toContain('/day');
  });

  it('segments add up to the whole bar', () => {
    const state = withAProperty();
    const r = cashRunway(state);
    const svg = renderToStaticMarkup(
      createElement(HoldingCost, { runway: r, level: runwayLevel(r) }),
    );
    // Every segment width, less the 0.35 gap each one leaves.
    const widths = [...svg.matchAll(/<rect[^>]*x="([\d.]+)"[^>]*width="([\d.]+)"/g)]
      .map((m) => Number(m[2]))
      .filter((w) => w > 0);
    const total = widths.reduce((s, w) => s + w + 0.35, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  it('tells a screen reader where the money went', () => {
    const state = withAProperty();
    const r = cashRunway(state);
    const svg = renderToStaticMarkup(
      createElement(HoldingCost, { runway: r, level: runwayLevel(r) }),
    );
    const label = svg.match(/aria-label="([^"]+)"/)![1];
    expect(label).toMatch(/a day/);
    if (r.accruing > 0.5) expect(label).toMatch(/closing/i);
  });
});
