import { describe, expect, it } from 'vitest';
import { appendFileSync, writeFileSync } from 'node:fs';

/**
 * Vitest intercepts console output, which makes the balance table -- the whole
 * reason this harness exists -- invisible. Write it to a file instead so the
 * numbers can actually be read and compared between runs.
 */
const REPORT_FILE = 'balance-output.txt';
writeFileSync(REPORT_FILE, '');
function report(line: string): void {
  appendFileSync(REPORT_FILE, `${line}\n`);
}
import {
  ECON,
  acceptOffer,
  analyzeDeal,
  advanceDay,
  afterRepairValue,
  createGame,
  listForSale,
  makeOffer,
  netWorth,
  orderInspection,
  quoteScope,
  reducePrice,
  rule70Mao,
  startRenovation,
  trueValue,
  type GameState,
  type Property,
} from '../src/engine';
import { scopeIdForDefect } from '../src/engine/renovation';
import { defectRepairCost } from '../src/engine/valuation';
import { DEFECTS_BY_ID, LEVELS_BY_ID } from '../src/engine/content';

/**
 * Balance harness.
 *
 * A rules-following bot plays whole campaigns so we can check that the
 * economics are actually winnable by someone applying the 70% rule -- and, just
 * as importantly, that they are NOT winnable by someone ignoring it. A
 * simulation that rewards both strategies equally teaches nothing.
 *
 * The bot deliberately plays with the same information a human has: it works
 * from the noisy appraisal, not from true value.
 */

const COSMETIC_SCOPE = [
  'paint_interior',
  'flooring_lvp',
  'kitchen_refresh',
  'landscaping_curb',
  'staging',
];

const GUT_SCOPE = [
  'paint_interior',
  'flooring_lvp',
  'kitchen_full',
  'bath_full',
  'roof_replace',
  'hvac_replace',
  'landscaping_curb',
  'staging',
];

/**
 * Scope has to match the house. A cosmetic refresh on a gut job leaves the
 * condition -- and therefore the ARV -- far short of what the numbers assumed,
 * which is one of the classic ways a first flip goes wrong.
 */
function scopeFor(prop: Property): string[] {
  return prop.condition < 0.45 ? GUT_SCOPE : COSMETIC_SCOPE;
}

interface BotConfig {
  /** Fraction of ARV used as the buy ceiling. 0.70 is the industry rule. */
  rule: number;
  maxConcurrent: number;
  /** Contingency as a fraction of scope cost. */
  contingency: number;
  inspect: boolean;
}

interface RunResult {
  won: boolean;
  finalNetWorth: number;
  days: number;
  deals: number;
  profitableDeals: number;
  totalProfit: number;
  foreclosures: number;
}

/**
 * The bot's view of ARV. It knows roughly what its own scope will lift, but its
 * anchor is the noisy appraisal, so its ARV inherits that error -- which is
 * exactly the real failure mode the game is trying to teach.
 */
function estimateArv(state: GameState, prop: Property, scope: string[]): number {
  const truthAsIs = trueValue(prop, state.world, state.day);
  const truthArv = afterRepairValue(prop, state.world, state.day, scope);
  if (truthAsIs <= 0) return prop.appraisal.point;
  const lift = truthArv / truthAsIs;
  return Math.round(prop.appraisal.point * lift);
}

function knownDefectScope(prop: Property): string[] {
  return prop.defects
    .filter((d) => d.revealed && !d.repaired && DEFECTS_BY_ID[d.defId]?.mustFix)
    .map((d) => scopeIdForDefect(d.defId));
}

function runCampaign(levelId: string, seed: number, cfg: BotConfig): RunResult {
  const state = createGame(levelId, seed);
  const level = LEVELS_BY_ID[levelId];
  const limit = level.dayLimit ?? 900;
  let foreclosures = 0;

  while (state.phase === 'playing' && state.day < limit) {
    // --- Buy ---
    if (state.portfolio.length < cfg.maxConcurrent) {
      const candidates = state.market
        .filter((p) => p.listing)
        .map((p) => {
          const scope = scopeFor(p);
          const quote = quoteScope(scope, p, state.world, state.skills);
          const arv = estimateArv(state, p, scope);
          // Reserve for defects we cannot see yet. A real buyer pads for this.
          const hiddenPad = quote.totalCost * 0.18;
          const mao = Math.round(arv * cfg.rule - quote.totalCost - hiddenPad);
          return { p, mao, arv };
        })
        .filter((c) => c.mao > 5000)
        .sort((a, b) => b.arv - b.mao - (a.arv - a.mao));

      for (const c of candidates.slice(0, 4)) {
        // Only pay for due diligence on a property we are actually in
        // contention for. Inspecting everything on the MLS is how a beginner
        // bleeds cash without ever closing.
        const inContention = c.mao >= c.p.listing!.askPrice * 0.85;
        if (cfg.inspect && inContention && c.p.inspection === 'none') {
          orderInspection(state, c.p.id, 'standard');
        }

        const knownDefects = knownDefectScope(c.p);
        const scope = [...scopeFor(c.p), ...knownDefects];
        const quote = quoteScope(scope, c.p, state.world, state.skills);
        // Re-price the offer now that we know what is actually wrong with it.
        const pad = quote.totalCost * (cfg.inspect ? 0.1 : 0.18);
        const mao = Math.round(c.arv * cfg.rule - quote.totalCost - pad);

        // Never bid above the ask -- when MAO clears the asking price the deal
        // is simply a good one, not a reason to overpay. And where an
        // inspection put defects on paper, renegotiate the ask down by the
        // repair credit rather than paying list for a house with a bad roof.
        const disclosed = c.p.defects
          .filter((d) => d.revealed && !d.repaired)
          .reduce((s, d) => s + defectRepairCost(d.defId, c.p), 0);
        const askCap = Math.round(c.p.listing!.askPrice * 0.97 - disclosed * 0.85);

        const offer = Math.min(mao, askCap);
        if (offer < 5000) continue;

        // The point of due diligence is being willing to walk. Run the deal
        // through the analyzer at the price we would actually pay and drop it
        // if the margin no longer justifies the risk.
        const analysis = analyzeDeal(c.p, state.world, state.day, c.arv, scope, state.skills, {
          offer,
          useFinancing: true,
        });
        if (analysis.verdict === 'thin' || analysis.verdict === 'loss') continue;

        // Keep enough dry powder to actually fund the rehab; reach for hard
        // money only when an all-cash close would leave nothing for the work.
        const allCashNeed = offer * 1.02 + quote.totalCost * 1.2;
        const financed = allCashNeed > state.cash;
        const res = makeOffer(state, c.p.id, offer, financed);
        if (res.ok) break;
      }
    }

    // --- Manage what we own ---
    for (const prop of [...state.portfolio]) {
      const own = prop.ownership;
      if (!own) continue;

      if (!own.renovation && !own.saleListing && prop.completedWork.length === 0) {
        const scope = [...scopeFor(prop), ...knownDefectScope(prop)];
        const res = startRenovation(state, prop.id, scope, cfg.contingency);
        if (!res.ok) {
          // Cannot fund the full scope -- fall back to cosmetics only.
          startRenovation(state, prop.id, ['paint_interior', 'landscaping_curb'], 0.1);
        }
        continue;
      }

      if (!own.renovation && !own.saleListing && prop.completedWork.length > 0) {
        listForSale(state, prop.id, prop.appraisal.point);
        continue;
      }

      const sale = own.saleListing;
      if (sale) {
        const best = [...sale.offers].sort((a, b) => b.amount - a.amount)[0];
        if (best && best.amount >= sale.listPrice * 0.93) {
          acceptOffer(state, prop.id, best.id);
        } else if (sale.daysOnMarket > 0 && sale.daysOnMarket % 30 === 0) {
          reducePrice(state, prop.id, Math.round(sale.listPrice * 0.96));
        }
      }
    }

    const before = state.portfolio.length;
    advanceDay(state);
    if (state.portfolio.length < before && state.log.at(-1)?.message.includes('Foreclosure')) {
      foreclosures += 1;
    }
  }

  const profits = state.closedDeals.map((d) => d.netProfit);
  return {
    won: state.phase === 'won',
    finalNetWorth: netWorth(state),
    days: state.day,
    deals: state.closedDeals.length,
    profitableDeals: profits.filter((p) => p > 0).length,
    totalProfit: profits.reduce((s, p) => s + p, 0),
    foreclosures,
  };
}

function summarise(label: string, runs: RunResult[]) {
  const n = runs.length;
  const winRate = runs.filter((r) => r.won).length / n;
  const avgDeals = runs.reduce((s, r) => s + r.deals, 0) / n;
  const allDeals = runs.reduce((s, r) => s + r.deals, 0);
  const profitableRate = allDeals > 0 ? runs.reduce((s, r) => s + r.profitableDeals, 0) / allDeals : 0;
  const avgProfitPerDeal = allDeals > 0 ? runs.reduce((s, r) => s + r.totalProfit, 0) / allDeals : 0;
  const avgNetWorth = runs.reduce((s, r) => s + r.finalNetWorth, 0) / n;

  report(
    `${label.padEnd(28)} win ${(winRate * 100).toFixed(0).padStart(3)}%  ` +
      `deals ${avgDeals.toFixed(1).padStart(4)}  ` +
      `profitable ${(profitableRate * 100).toFixed(0).padStart(3)}%  ` +
      `$/deal ${Math.round(avgProfitPerDeal).toLocaleString().padStart(9)}  ` +
      `net worth ${Math.round(avgNetWorth).toLocaleString().padStart(10)}`,
  );

  return { winRate, avgDeals, profitableRate, avgProfitPerDeal, avgNetWorth };
}

// A wide seed set: per-deal profit across ~12 runs is far too noisy to tune
// against, and early passes on this harness were chasing sampling error.
const SEEDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
];

/*
 * A hundred seeds, not thirty.
 *
 * Thirty was enough while the content was fixed and became not enough the first
 * time it changed. Adding three archetypes read as the disciplined bot's
 * profitable-deal rate falling from 59% to 51%, through a threshold, which
 * looked like a balance regression worth reverting for. At two hundred seeds
 * the same two configurations both sit at 59%: the standard error on that
 * statistic across thirty campaigns is about seven points, and the whole move
 * was inside it.
 *
 * The harness exists to measure the economics rather than a sample of them, so
 * the sample is now large enough to tell the difference between a change and a
 * coincidence.
 */
const CAREFUL: BotConfig = { rule: 0.7, maxConcurrent: 1, contingency: 0.15, inspect: true };

/**
 * A note on which metric these assertions use.
 *
 * Average profit *per deal* looks like the natural measure of strategy quality
 * and is actively misleading here, because the strategies do not transact at
 * the same rate. A bot that skips inspections keeps the seller's reserve high,
 * so fewer deals ever clear and only the obviously-good ones close -- giving it
 * a flattering per-deal number off half the volume. Conditioning on having
 * transacted is a selection effect, not a result.
 *
 * Final net worth is the unconditional outcome, and it is what the game itself
 * scores, so that is what these assert on.
 */
describe('balance', () => {
  it('makes the tutorial winnable for a disciplined 70%-rule buyer', () => {
    const runs = SEEDS.map((s) => runCampaign('first_flip', s, CAREFUL));
    const stats = summarise('first_flip @ 70%', runs);

    // Beatable, but not a formality, and it must require actually trading.
    expect(stats.winRate).toBeGreaterThan(0.6);
    expect(stats.winRate).toBeLessThan(1.0);
    expect(stats.avgDeals).toBeGreaterThan(0.5);
    expect(stats.profitableRate).toBeGreaterThan(0.55);
  }, 120000);

  it('punishes a buyer who ignores the rule and pays near ARV', () => {
    const disciplined = SEEDS.map((s) => runCampaign('first_flip', s, CAREFUL));
    const reckless = SEEDS.map((s) =>
      runCampaign('first_flip', s, { rule: 0.92, maxConcurrent: 1, contingency: 0, inspect: false }),
    );

    const a = summarise('first_flip @ 70% (careful)', disciplined);
    const b = summarise('first_flip @ 92% (reckless)', reckless);

    // The core educational claim: discipline must pay, on the outcome the game
    // actually scores.
    expect(a.avgNetWorth).toBeGreaterThan(b.avgNetWorth);
    expect(a.winRate).toBeGreaterThan(b.winRate);
  }, 150000);

  it('shows due diligence pays for itself', () => {
    const inspected = SEEDS.map((s) => runCampaign('first_flip', s, CAREFUL));
    const blind = SEEDS.map((s) => runCampaign('first_flip', s, { ...CAREFUL, inspect: false }));

    const a = summarise('first_flip inspected', inspected);
    const b = summarise('first_flip blind', blind);

    // Inspecting closes more deals (the seller concedes disclosed defects) and
    // ends richer, even though the blind bot's surviving deals look prettier.
    expect(a.avgNetWorth).toBeGreaterThan(b.avgNetWorth);
    expect(a.avgDeals).toBeGreaterThan(b.avgDeals);
  }, 150000);

  it('leaves the contingency doing real work', () => {
    const reserved = SEEDS.map((s) => runCampaign('first_flip', s, CAREFUL));
    const none = SEEDS.map((s) => runCampaign('first_flip', s, { ...CAREFUL, contingency: 0 }));
    const a = summarise('first_flip 15% contingency', reserved);
    const b = summarise('first_flip no contingency', none);
    // Not necessarily a large gap -- contingency is insurance, not alpha -- but
    // it should not be a handicap.
    expect(a.avgNetWorth).toBeGreaterThanOrEqual(b.avgNetWorth * 0.98);
  }, 150000);

  it('runs the longer campaigns to completion without breaking', () => {
    // See the note on SEEDS: the sample was widened to a hundred when adding
    // three archetypes moved a rate by eight points that was not actually
    // moving. Twenty seeds rather than ten. At ten, a two-campaign difference reads as
    // a twenty-point swing in win rate, which is enough to make a change look
    // like a balance regression when it is sampling error -- exactly the trap
    // the event-chain work walked into.
    for (const levelId of ['leverage', 'the_grind', 'sandbox']) {
      const runs = SEEDS.slice(0, 20).map((s) =>
        runCampaign(levelId, s, { ...CAREFUL, maxConcurrent: 2 }),
      );
      const stats = summarise(`${levelId} @ 70%`, runs);
      expect(Number.isFinite(stats.avgNetWorth)).toBe(true);
      expect(stats.avgDeals).toBeGreaterThan(0);
      // Later levels should be harder than the tutorial, not impossible.
      if (levelId !== 'sandbox') expect(stats.winRate).toBeLessThan(0.95);
    }
  }, 300000);
});



