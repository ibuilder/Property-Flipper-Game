import type { DealAnalysis } from './analyzer';
import { ECON } from './content';
import type { Money } from './types';

/**
 * "Show me the maths."
 *
 * Borrowed wholesale from the realmogul sibling project, whose docstring makes
 * the case better than I can: because every line is computed from the same
 * functions the engine decides with, the explanation cannot drift out of sync
 * with what actually happens. A tutorial that restates the formula in prose can
 * quietly become a lie the day someone changes a constant. This cannot.
 *
 * Each line is a named quantity, the formula in words, the player's own numbers
 * plugged into it, and the result -- designed to render as a small table.
 */
export interface ExplainLine {
  label: string;
  formula: string;
  plugged: string;
  result: string;
  /** Set on the line that is the answer, so the UI can weight it. */
  emphasis?: boolean;
}

const money = (n: number): string =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const pct = (n: number, digits = 1): string => `${(n * 100).toFixed(digits)}%`;

/**
 * Walk the 70% rule with this deal's numbers.
 *
 * Deliberately shows the haircut broken out, because "30% is not profit" is the
 * single most misunderstood thing about the rule.
 */
export function explainRule70(analysis: DealAnalysis): ExplainLine[] {
  const haircut = analysis.arv * (1 - ECON.RULE_OF_THUMB);
  return [
    {
      label: 'After-repair value',
      formula: 'from the comps you selected',
      plugged: 'median $/sqft across your comps, applied to this house',
      result: money(analysis.arv),
    },
    {
      label: `The ${pct(1 - ECON.RULE_OF_THUMB, 0)} haircut`,
      formula: `ARV × ${(1 - ECON.RULE_OF_THUMB).toFixed(2)}`,
      plugged: `${money(analysis.arv)} × ${(1 - ECON.RULE_OF_THUMB).toFixed(2)}`,
      result: money(haircut),
    },
    {
      label: 'Repair estimate',
      formula: 'your scope of work, quoted for this property',
      plugged: `${analysis.holdDays} days of hold time assumed`,
      result: money(analysis.repairEstimate),
    },
    {
      label: 'Maximum allowable offer',
      formula: `(ARV × ${ECON.RULE_OF_THUMB}) − repairs`,
      plugged: `${money(analysis.arv * ECON.RULE_OF_THUMB)} − ${money(analysis.repairEstimate)}`,
      result: money(analysis.mao70),
      emphasis: true,
    },
  ];
}

/**
 * The itemised version: every cost the 30% is standing in for.
 *
 * When this disagrees with the rule of thumb, this one is right, and seeing the
 * two side by side with real numbers is the point of the whole exercise.
 */
export function explainCostStack(
  analysis: DealAnalysis,
  offer: Money,
  targetProfitRate = 0.15,
): ExplainLine[] {
  const b = analysis.breakdown;
  if (!b) return [];

  const lines: ExplainLine[] = [
    {
      label: 'Purchase',
      formula: 'your offer',
      plugged: 'what you hand the seller',
      result: money(-b.purchase),
    },
    {
      label: 'Buy-side closing',
      formula: `offer × ${pct(ECON.BUY_CLOSING_RATE, 0)}`,
      plugged: `${money(offer)} × ${pct(ECON.BUY_CLOSING_RATE, 0)}`,
      result: money(-b.buyClosing),
    },
    {
      label: 'Renovation',
      formula: 'sum of your scope lines',
      plugged: 'quoted at current material and labour rates',
      result: money(-b.repairs),
    },
    {
      label: 'Carrying costs',
      formula: 'daily carry × days held',
      plugged: `${money(analysis.dailyCarry)}/day × ${analysis.holdDays} days`,
      result: money(-b.holding),
    },
  ];

  if (b.financing > 0) {
    lines.push({
      label: 'Financing',
      formula: 'points + interest over the hold',
      plugged: `${pct(ECON.LOAN_POINTS, 0)} up front, then interest for ${analysis.holdDays} days`,
      result: money(-b.financing),
    });
  }

  lines.push(
    {
      label: 'Agent commission',
      formula: `ARV × ${pct(ECON.COMMISSION_RATE, 0)}`,
      plugged: `${money(analysis.arv)} × ${pct(ECON.COMMISSION_RATE, 0)}`,
      result: money(-b.commission),
    },
    {
      label: 'Seller closing',
      formula: `ARV × ${pct(ECON.SELL_CLOSING_RATE, 0)}`,
      plugged: `${money(analysis.arv)} × ${pct(ECON.SELL_CLOSING_RATE, 0)}`,
      result: money(-b.sellClosing),
    },
    {
      label: 'Sale at ARV',
      formula: 'what it is worth once the work is done',
      plugged: 'assuming your scope lands and the market holds',
      result: money(analysis.arv),
    },
    {
      label: 'Profit',
      formula: 'ARV − everything above',
      plugged: `${money(analysis.arv)} − ${money(b.totalCost)}`,
      result: `${money(b.profit)} (${pct(b.profit / Math.max(1, analysis.arv), 1)} of ARV)`,
      emphasis: true,
    },
  );

  return lines;
}

/** Why the two maximum offers disagree, in one line each. */
export function explainRuleGap(analysis: DealAnalysis): ExplainLine[] {
  const gap = analysis.maoDetailed - analysis.mao70;
  return [
    {
      label: 'Rule of thumb says',
      formula: `(ARV × ${ECON.RULE_OF_THUMB}) − repairs`,
      plugged: 'one flat haircut, calibrated for a typical deal',
      result: money(analysis.mao70),
    },
    {
      label: 'Itemised says',
      formula: 'ARV − every real cost − target profit',
      plugged: `${analysis.holdDays} days of carry at ${money(analysis.dailyCarry)}/day, priced individually`,
      result: money(analysis.maoDetailed),
    },
    {
      label: gap < 0 ? 'The rule is too generous by' : 'The rule is conservative by',
      formula: 'itemised − rule of thumb',
      plugged:
        gap < 0
          ? 'this deal carries or sells worse than the average the rule assumes'
          : 'this deal carries cheaply and sells fast',
      result: money(Math.abs(gap)),
      emphasis: true,
    },
  ];
}
