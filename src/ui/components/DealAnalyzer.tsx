import {
  ECON,
  costOfADay,
  explainCostStack,
  explainRule70,
  explainRuleGap,
  minimumCashToBuy,
  returnProfile,
  verdictOnReturn,
  type DealAnalysis,
  type StressField as StressFieldData,
  type StressTest,
} from '../../engine';
import { VERDICT_COPY, money, percent } from '../format';
import ExplainTable from './ExplainTable';
import Figure from './Figure';
import StressTable from './StressTable';

/**
 * The Deal Analyzer panel.
 *
 * This is the teaching surface. It shows the 70% rule and the itemised cost
 * stack side by side precisely so the player can watch them disagree: the rule
 * of thumb is calibrated for a typical deal, and the moment one input is
 * atypical -- an expensive area, a long schedule, high rates -- the itemised
 * number is the one that is right.
 */
export default function DealAnalyzer({
  analysis,
  offer,
  showRuleExplainer = true,
  stress = null,
  stressField = null,
  cashOnHand,
}: {
  analysis: DealAnalysis;
  offer: number;
  showRuleExplainer?: boolean;
  /** Supplied on the buy screen so the panel can say when a deal is unfundable. */
  cashOnHand?: number;
  /**
   * Supplied by the buy screen, where the stress test is a decision aid.
   * Omitted once the property is owned: the estimates are no longer estimates
   * at that point, and the question has changed from "should I" to "now what".
   */
  stress?: StressTest | null;
  /** The finely sampled version, so the break-even line is a curve. */
  stressField?: StressFieldData | null;
}) {
  const { breakdown, verdict } = analysis;
  const ruleGap = analysis.maoDetailed - analysis.mao70;

  // The cash actually tied up: everything paid out that a loan did not cover.
  // Return is measured against this rather than against the purchase price,
  // because leverage is exactly what makes those two numbers differ.
  const cashIn = breakdown
    ? Math.max(1, breakdown.purchase + breakdown.buyClosing + breakdown.repairs - breakdown.loan)
    : 1;
  const projected = returnProfile(breakdown?.profit ?? 0, cashIn, Math.max(1, analysis.holdDays));
  const dayCost = costOfADay(
    breakdown?.profit ?? 0,
    cashIn,
    Math.max(1, analysis.holdDays),
    analysis.dailyCarry,
  );
  const returnVerdict = verdictOnReturn(projected.annualised);

  const minCash = minimumCashToBuy(offer);
  const outOfReach = cashOnHand !== undefined && offer > 0 && cashOnHand < minCash;

  return (
    <>
      <div className="kv">
        <span className="k">Estimated ARV</span>
        <span className="v">{money(analysis.arv)}</span>
      </div>
      <div className="kv">
        <span className="k">Repair estimate</span>
        <span className="v">{money(analysis.repairEstimate)}</span>
      </div>
      <div className="kv">
        <span className="k">
          Hold time <span className="faint">(work + marketing)</span>
        </span>
        <span className="v">{analysis.holdDays} days</span>
      </div>
      <div className="kv">
        <span className="k">Carrying cost</span>
        <span className="v">{money(analysis.dailyCarry)}/day</span>
      </div>

      <div style={{ height: 14 }} />

      {/* The two max offers side by side, each showing its working.
          This is the best teaching moment in the game: the 70% rule stops
          being a magic number and becomes a proxy you can audit. */}
      <div className="mao-pair">
        <div className="blueprint mao-plate">
          <Figure
            label="Max offer — rule of thumb"
            amount={analysis.mao70}
            format={money}
            formula={`(${money(analysis.arv)} × ${ECON.RULE_OF_THUMB}) − ${money(
              analysis.repairEstimate,
            )}`}
          />
        </div>
        <div className="blueprint mao-plate primary">
          <span className="corner tl" />
          <span className="corner br" />
          <Figure
            label="Max offer — itemised"
            amount={analysis.maoDetailed}
            format={money}
            formula={`every real cost, plus ${percent(0.15, 0)} target profit`}
          />
        </div>
      </div>

      {showRuleExplainer && Math.abs(ruleGap) > analysis.arv * 0.015 && (
        <p className="faint" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
          {ruleGap < 0 ? (
            <>
              The rule of thumb is <strong className="warn">{money(-ruleGap)} too generous</strong>{' '}
              on this deal. Its flat 30% haircut does not cover {analysis.holdDays} days of carry at{' '}
              {money(analysis.dailyCarry)}/day plus commission here. Trust the itemised number.
            </>
          ) : (
            <>
              The rule of thumb is <strong>{money(ruleGap)} conservative</strong> here &mdash; this
              property carries cheaply and sells fast, so you can pay a little more than 70% and
              still clear your margin.
            </>
          )}
        </p>
      )}

      {/* Stated before the projection, not after it. A projection showing a
          strong return on a house you cannot fund is worse than no projection:
          it invites you to spend the effort of underwriting a deal that was
          never available, and only the offer screen used to say so. */}
      {outOfReach && (
        <div className="verdict loss" style={{ marginTop: 14 }}>
          <strong>You cannot fund this at any price you would pay</strong>
          Even borrowing the maximum, closing needs {money(minCash)} and you have{' '}
          {money(cashOnHand)}. The numbers below describe a deal you cannot take.
        </div>
      )}

      {breakdown && (
        <>
          <div className="scope-group-label" style={{ marginTop: 18 }}>
            Projected P&amp;L at {money(offer)}
          </div>
          {/* Every line shows how it was reached. The stack is the lesson:
              the 30% haircut the rule of thumb applies is standing in for
              exactly these rows, and seeing them itemised is what turns the
              rule from a number to memorise into one you can check. */}
          <Figure
            size="row"
            label="Sale at ARV"
            value={money(analysis.arv)}
            formula="what the comps you picked say it is worth finished"
          />
          <Figure
            size="row"
            label="Purchase"
            value={money(-breakdown.purchase)}
            formula="your offer"
          />
          <Figure
            size="row"
            label="Buy-side closing"
            value={money(-breakdown.buyClosing)}
            formula={`${money(breakdown.purchase)} × ${percent(ECON.BUY_CLOSING_RATE, 0)}`}
          />
          <Figure
            size="row"
            label="Renovation"
            value={money(-breakdown.repairs)}
            formula="your scope of work, quoted for this house"
          />
          <Figure
            size="row"
            label="Holding costs"
            value={money(-breakdown.holding)}
            formula={`${analysis.holdDays} days × ${money(analysis.dailyCarry)}/day`}
          />
          {breakdown.financing > 0 && (
            <Figure
              size="row"
              label="Financing"
              value={money(-breakdown.financing)}
              formula={`points + ${percent(analysis.loanRate, 2)} on ${money(
                breakdown.loan,
              )} for ${analysis.holdDays} days`}
            />
          )}
          <Figure
            size="row"
            label="Agent commission"
            value={money(-breakdown.commission)}
            formula={`${money(analysis.arv)} × ${percent(ECON.COMMISSION_RATE, 0)}`}
          />
          <Figure
            size="row"
            label="Seller closing"
            value={money(-breakdown.sellClosing)}
            formula="title, escrow and transfer at sale"
          />

          {/*
            The verdict plate. This is the one element in the entire game
            allowed to turn red, and only when the projection is negative --
            its scarcity is the whole reason it lands.
          */}
          <div className={`blueprint verdict-plate${breakdown.profit < 0 ? ' loss' : ''}`}>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <Figure
              size="hero"
              label="Projected profit"
              amount={breakdown.profit}
              format={money}
              tone={breakdown.profit < 0 ? 'loss' : undefined}
              formula={`sale − purchase − closing − work − carry${
                breakdown.financing > 0 ? ' − financing' : ''
              } − commission`}
              note={`${percent(breakdown.profit / analysis.arv, 1)} of the after-repair value.`}
            />
          </div>

          {/* Profit alone cannot separate a tight flip from one that drags,
              and that is the comparison the whole business runs on. It belongs
              here, at the moment of choosing, not only in the track record
              after the decision is irreversible. */}
          {/*
            On a short hold, the plain return leads.

            A playthrough sold in 32 days for $14,671 on $250,163 -- 5.9% on
            the money, reported as 167% annualised. Both are correct and the
            caveat about redeploying capital was already shown, but the big
            number is the one that gets read, and it flatters a thin deal
            precisely when the player most needs to see that it is thin. So
            below a quarter the honest figure goes first and the annualised
            one becomes the footnote rather than the headline.
          */}
          {analysis.holdDays < 90 ? (
            <>
              <Figure
                size="row"
                label="Return on your cash"
                value={percent(breakdown.profit / cashIn, 1)}
                formula={`${money(breakdown.profit)} ÷ ${money(cashIn)} over ${analysis.holdDays} days`}
              />
              <Figure
                size="row"
                label="…annualised"
                value={percent(projected.annualised, 0)}
                tone="muted"
                formula={`× 365 ÷ ${analysis.holdDays}d — only real if you can redeploy immediately`}
              />
            </>
          ) : (
            <Figure
              size="row"
              label="Annualised return"
              value={percent(projected.annualised, 0)}
              formula={`${money(breakdown.profit)} ÷ ${money(cashIn)} × 365 ÷ ${analysis.holdDays}d`}
            />
          )}
          <Figure
            size="row"
            label="Equity multiple"
            value={`${projected.multiple.toFixed(2)}×`}
            formula="cash back for every dollar of your own money in"
          />
          <Figure
            size="row"
            label="Each extra day costs"
            value={money(dayCost.dollars)}
            formula={`carry plus ${percent(Math.abs(dayCost.roiDelta), 2)} off the annualised return`}
          />

          {breakdown.profit > 0 && (
            <p className="faint" style={{ fontSize: 12, margin: '8px 0 0' }}>
              {returnVerdict.text}
              {analysis.holdDays < 90 && (
                <>
                  {' '}
                  An annualised figure on a {analysis.holdDays}-day hold assumes you can find and
                  fund another deal like it immediately &mdash; which is the hard part.
                </>
              )}
            </p>
          )}
        </>
      )}

      {verdict && (
        <div className={`verdict ${verdict}`} style={{ marginTop: 14 }}>
          <strong>{VERDICT_COPY[verdict].title}</strong>
          {VERDICT_COPY[verdict].body}
        </div>
      )}

      {/* The working, on demand. Every line is computed from the same functions
          the engine decides with, so it cannot drift from what actually happens. */}
      <ExplainTable title="Show the 70% rule with my numbers" lines={explainRule70(analysis)} />
      {Math.abs(ruleGap) > analysis.arv * 0.015 && (
        <ExplainTable title="Why the two max offers disagree" lines={explainRuleGap(analysis)} />
      )}
      {breakdown && (
        <ExplainTable
          title="Show every cost, itemised"
          lines={explainCostStack(analysis, offer)}
        />
      )}
      {stress && <StressTable test={stress} field={stressField} />}
    </>
  );
}
