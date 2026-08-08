import { ECON, type DealAnalysis } from '../../engine';
import { VERDICT_COPY, money, percent } from '../format';

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
        </>
      )}

      {verdict && (
        <div className={`verdict ${verdict}`} style={{ marginTop: 14 }}>
          <strong>{VERDICT_COPY[verdict].title}</strong>
          {VERDICT_COPY[verdict].body}
        </div>
      )}
    </>
  );
}
