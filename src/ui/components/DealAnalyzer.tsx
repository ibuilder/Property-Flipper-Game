import {
  ECON,
  costOfADay,
  explainCostStack,
  explainRule70,
  explainRuleGap,
  returnProfile,
  verdictOnReturn,
  type DealAnalysis,
} from '../../engine';
import { VERDICT_COPY, money, percent } from '../format';
import ExplainTable from './ExplainTable';

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
}: {
  analysis: DealAnalysis;
  offer: number;
  showRuleExplainer?: boolean;
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

      <div className="kv total">
        <span className="k">
          Max offer &mdash; 70% rule
          <br />
          <span className="faint" style={{ fontSize: 11 }}>
            (ARV &times; {ECON.RULE_OF_THUMB}) &minus; repairs
          </span>
        </span>
        <span className="v">{money(analysis.mao70)}</span>
      </div>
      <div className="kv total">
        <span className="k">
          Max offer &mdash; itemised
          <br />
          <span className="faint" style={{ fontSize: 11 }}>
            every real cost, plus 15% target profit
          </span>
        </span>
        <span className="v">{money(analysis.maoDetailed)}</span>
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

      {breakdown && (
        <>
          <div className="scope-group-label" style={{ marginTop: 18 }}>
            Projected P&amp;L at {money(offer)}
          </div>
          <div className="kv">
            <span className="k">Purchase</span>
            <span className="v bad">{money(-breakdown.purchase)}</span>
          </div>
          <div className="kv">
            <span className="k">Closing costs ({percent(ECON.BUY_CLOSING_RATE, 0)})</span>
            <span className="v bad">{money(-breakdown.buyClosing)}</span>
          </div>
          <div className="kv">
            <span className="k">Renovation</span>
            <span className="v bad">{money(-breakdown.repairs)}</span>
          </div>
          <div className="kv">
            <span className="k">Holding costs</span>
            <span className="v bad">{money(-breakdown.holding)}</span>
          </div>
          {breakdown.financing > 0 && (
            <div className="kv">
              <span className="k">Financing (points + interest)</span>
              <span className="v bad">{money(-breakdown.financing)}</span>
            </div>
          )}
          <div className="kv">
            <span className="k">Agent commission ({percent(ECON.COMMISSION_RATE, 0)})</span>
            <span className="v bad">{money(-breakdown.commission)}</span>
          </div>
          <div className="kv">
            <span className="k">Seller closing</span>
            <span className="v bad">{money(-breakdown.sellClosing)}</span>
          </div>
          <div className="kv">
            <span className="k">Sale at ARV</span>
            <span className="v good">{money(analysis.arv)}</span>
          </div>
          <div className="kv total">
            <span className="k">Projected profit</span>
            <span className={`v ${breakdown.profit >= 0 ? 'good' : 'bad'}`}>
              {money(breakdown.profit)}{' '}
              <span className="faint">({percent(breakdown.profit / analysis.arv, 1)})</span>
            </span>
          </div>

          {/* Profit alone cannot separate a tight flip from one that drags,
              and that is the comparison the whole business runs on. It belongs
              here, at the moment of choosing, not only in the track record
              after the decision is irreversible. */}
          <div className="kv total">
            <span className="k">
              Annualised return
              <br />
              <span className="faint" style={{ fontSize: 11 }}>
                on {money(cashIn)} of your cash, over {analysis.holdDays} days
              </span>
            </span>
            <span className={`v ${projected.annualised >= 0 ? 'good' : 'bad'}`}>
              {percent(projected.annualised, 0)}
            </span>
          </div>
          <div className="kv">
            <span className="k">
              Equity multiple
              <br />
              <span className="faint" style={{ fontSize: 11 }}>
                cash back for every dollar in
              </span>
            </span>
            <span className="v">{projected.multiple.toFixed(2)}&times;</span>
          </div>
          <div className="kv">
            <span className="k">Each extra day costs</span>
            <span className="v bad">
              {money(dayCost.dollars)}{' '}
              <span className="faint">
                and {percent(Math.abs(dayCost.roiDelta), 2)} off the return
              </span>
            </span>
          </div>

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
    </>
  );
}
