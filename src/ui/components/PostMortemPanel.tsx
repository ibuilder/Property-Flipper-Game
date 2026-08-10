import {
  cardsForDeal,
  replayScenario,
  type ClosedDeal,
  type PostMortem,
  type VarianceCategory,
} from '../../engine';
import { money, percent } from '../format';
import { startScenario } from '../store';
import ConfirmButton from './ConfirmButton';
import LessonCards from './LessonCards';

/**
 * Projected versus actual, with the gap attributed.
 *
 * The game could always tell you a deal lost money. This says which assumption
 * was wrong — and since the projection was captured at the moment of purchase,
 * it is a genuine record of what you believed rather than a reconstruction.
 */

const ADVICE: Record<VarianceCategory, string> = {
  arv: 'ARV comes from the comps you chose. Same size, same area, sold recently, similar finish.',
  scope: 'Scope grows. Budget the work you can see, then reserve for the work you cannot.',
  changeOrders: 'Change orders come from defects nobody inspected for. Due diligence is cheaper.',
  carry: 'Every extra day costs taxes, insurance, utilities and interest. Price beats patience.',
  concession: 'Buyers charge about 15% more than the repair would have cost. Fix it during the rehab.',
  financing: 'Points are charged up front and interest runs whether or not the house has sold.',
};

export default function PostMortemPanel({
  pm,
  deal,
}: {
  pm: PostMortem;
  deal: ClosedDeal;
}) {
  const missedBy = pm.actualProfit - pm.projected.projectedProfit;
  const beat = missedBy >= 0;
  const worst = [...pm.lines].sort((a, b) => a.amount - b.amount)[0];
  const paidOverMao = pm.projected.purchasePrice - pm.projected.mao70;

  const cards = cardsForDeal({
    address: deal.address,
    projectedArv: pm.projected.arv,
    actualSalePrice: pm.actualSalePrice,
    concession: deal.concession,
    daysOnMarket: deal.daysHeld,
    holdingCosts: deal.holdingCosts,
    purchasePrice: pm.projected.purchasePrice,
    mao70: pm.projected.mao70,
  });

  return (
    <>
      <div className={`verdict ${beat ? 'strong' : Math.abs(missedBy) > 20000 ? 'loss' : 'thin'}`}>
        <strong>{pm.headline}</strong>
        {beat
          ? 'The plan held. Worth noting which assumption you were conservative on.'
          : 'Compare each line below against what you assumed before you bought.'}
      </div>

      <div className="scope-group-label" style={{ marginTop: 16 }}>
        What you underwrote, and what happened
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Assumption</th>
              <th className="right">Projected</th>
              <th className="right">Actual</th>
              <th className="right">Miss</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>After-repair value</td>
              <td className="right num">{money(pm.projected.arv)}</td>
              <td className="right num">{money(pm.actualSalePrice)}</td>
              <td
                className={`right num ${pm.actualSalePrice >= pm.projected.arv ? 'good' : 'bad'}`}
              >
                {money(pm.actualSalePrice - pm.projected.arv)}
              </td>
            </tr>
            <tr>
              <td>Profit</td>
              <td className="right num">{money(pm.projected.projectedProfit)}</td>
              <td className="right num">{money(pm.actualProfit)}</td>
              <td className={`right num ${beat ? 'good' : 'bad'}`}>{money(missedBy)}</td>
            </tr>
            <tr>
              <td>
                Price paid vs 70% rule
                <div className="faint" style={{ fontSize: 11 }}>
                  MAO was {money(pm.projected.mao70)}
                </div>
              </td>
              <td className="right num">{money(pm.projected.mao70)}</td>
              <td className="right num">{money(pm.projected.purchasePrice)}</td>
              <td className={`right num ${paidOverMao <= 0 ? 'good' : 'bad'}`}>
                {paidOverMao <= 0 ? 'under' : `+${money(paidOverMao)}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="scope-group-label" style={{ marginTop: 16 }}>
        Where the plan moved
      </div>
      {pm.lines.map((l, i) => (
        <div
          key={i}
          style={{
            padding: '8px 0',
            borderTop: i === 0 ? 'none' : '1px solid #202834',
          }}
        >
          <div className="kv" style={{ padding: 0, border: 'none' }}>
            <span className="k" style={{ fontWeight: 500, color: 'var(--text)' }}>
              {l.label}
            </span>
            <span className={`v ${l.amount >= 0 ? 'good' : 'bad'}`}>
              {l.amount >= 0 ? '+' : ''}
              {money(l.amount)}
            </span>
          </div>
          <div className="faint" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {l.note}
          </div>
        </div>
      ))}

      {cards.length > 0 && (
        <>
          <div className="scope-group-label" style={{ marginTop: 18 }}>
            Lessons from this deal
          </div>
          <LessonCards cards={cards} />
        </>
      )}

      {!beat && worst && cards.length === 0 && (
        <div className="verdict fair" style={{ marginTop: 14 }}>
          <strong>Next time</strong>
          {ADVICE[worst.category]}
        </div>
      )}

      {paidOverMao > 0 && (
        <p className="warn" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          You paid {money(paidOverMao)} over the 70% rule&rsquo;s maximum offer
          {pm.projected.arv > 0 && <> ({percent(paidOverMao / pm.projected.arv, 1)} of ARV)</>}. The
          rule exists to absorb exactly the surprises listed above.
        </p>
      )}

      {/* Knowing what went wrong and acting on it are different skills. The
          panel above is the first; this is the only way to practise the
          second. */}
      {deal.replay && (
        <div className="verdict fair" style={{ marginTop: 16 }}>
          <strong>Run it again, knowing what you know</strong>
          The same house, the same seller, the same market, and the same money in your pocket. The
          only thing that changes is you. Beating {money(Math.max(0, deal.netProfit))} on the second
          run means the difference was judgement rather than luck.
          <div className="btn-row" style={{ marginTop: 12 }}>
            <ConfirmButton
              className="btn primary"
              label="Replay this deal"
              title="Start the replay?"
              confirmLabel="Replay it"
              body={
                <>
                  <p style={{ marginTop: 0 }}>
                    This starts a fresh, self-contained run of {deal.address} and leaves your
                    current campaign untouched &mdash; but you will be taken out of it. Save first
                    if you are mid-deal elsewhere.
                  </p>
                  <div className="kv">
                    <span className="k">To beat</span>
                    <span className={`v ${deal.netProfit >= 0 ? 'good' : 'bad'}`}>
                      {money(deal.netProfit)} in {deal.daysHeld} days
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">Starting cash</span>
                    <span className="v">{money(deal.replay.cashAtPurchase)}</span>
                  </div>
                  <div className="kv">
                    <span className="k">
                      What you are told up front
                      <br />
                      <span className="faint" style={{ fontSize: 11 }}>
                        only what the seller disclosed the first time
                      </span>
                    </span>
                    <span className="v">
                      {deal.replay.property.disclosedIds.length} of{' '}
                      {deal.replay.property.defectIds.length} defects
                    </span>
                  </div>
                  <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>
                    What an inspection found last time is knowledge you paid for, so you pay for it
                    again. Otherwise the replay would be an easier house than the one you got
                    wrong.
                  </p>
                </>
              }
              onConfirm={() => {
                const def = replayScenario(deal);
                if (def) startScenario(def);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
