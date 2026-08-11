import { useMemo, useState } from 'react';
import {
  ECON,
  loanPayoff,
  netWorth,
  repayLoan,
  totalDebt,
  type LedgerCategory,
} from '../../engine';
import { money, percent } from '../format';
import { useAction, useGame, useVersion } from '../store';
import MarketCharts from './MarketCharts';
import CampaignTimeline from '../graphics/CampaignTimeline';

const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  acquisition: 'Acquisitions',
  closing: 'Closing costs',
  financing: 'Financing',
  renovation: 'Renovation',
  changeOrder: 'Change orders',
  holding: 'Carrying costs',
  inspection: 'Inspections',
  sale: 'Sale proceeds',
  commission: 'Agent commission',
  concession: 'Buyer concessions',
  training: 'Training',
  loan: 'Loan movements',
  rent: 'Rent collected',
  rentalOpex: 'Management & maintenance',
};

export default function FinanceView() {
  const state = useGame();
  const version = useVersion();
  const act = useAction();
  const [showAll, setShowAll] = useState(false);

  const totals = useMemo(() => {
    if (!state) return [];
    const map = new Map<LedgerCategory, number>();
    for (const e of state.ledger) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => a[1] - b[1]);
  }, [version, state?.ledger.length]);

  if (!state) return null;

  const entries = showAll ? state.ledger : state.ledger.slice(-60);

  return (
    <div className="grid-2">
      <div>
        <CampaignTimeline state={state} />
        <MarketCharts state={state} />

        <div className="panel">
          <div className="panel-head">
            <h2>Position</h2>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span className="k">Cash</span>
              <span className={`v ${state.cash < 0 ? 'bad' : ''}`}>{money(state.cash)}</span>
            </div>
            <div className="kv">
              <span className="k">Properties held</span>
              <span className="v">{state.portfolio.length}</span>
            </div>
            <div className="kv">
              <span className="k">Outstanding debt</span>
              <span className={`v ${totalDebt(state) > 0 ? 'bad' : ''}`}>
                {money(totalDebt(state))}
              </span>
            </div>
            <div className="kv total">
              <span className="k">Net worth</span>
              <span className="v">{money(netWorth(state))}</span>
            </div>
            <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              Inventory is marked at what it would actually net if sold today &mdash; less
              commission, closing, and any concession a buyer&rsquo;s inspector would extract. A
              house you cannot sell is not worth its sticker price.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Debt</h2>
            <span className="dim" style={{ fontSize: 12 }}>
              hard money at {percent(state.world.interestRate + ECON.LOAN_SPREAD, 2)} today
            </span>
          </div>
          <div className="panel-body flush">
            {state.loans.length === 0 ? (
              <div className="empty">No debt outstanding.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Kind</th>
                      <th className="right">Principal</th>
                      <th className="right">Interest</th>
                      <th className="right">Payment</th>
                      <th className="right">Payoff</th>
                      <th className="right">Rate</th>
                      <th className="right">Matures</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.loans.map((l) => {
                      const prop = state.portfolio.find((p) => p.id === l.propertyId);
                      const daysLeft = l.maturityDay - state.day;
                      return (
                        <tr key={l.id}>
                          <td>{prop?.address ?? l.propertyId}</td>
                          <td>
                            <span
                              className={`pill ${
                                l.kind === 'term' ? 'info' : l.kind === 'hardMoney' ? 'mute' : 'good'
                              }`}
                            >
                              {l.kind === 'term'
                                ? 'amortising'
                                : l.kind === 'hardMoney'
                                  ? 'hard money'
                                  : l.kind === 'private'
                                    ? 'private'
                                    : 'seller note'}
                            </span>
                          </td>
                          <td className="right num">{money(l.principal)}</td>
                          <td className="right num bad">
                            {l.kind === 'term' ? (
                              <span className="faint">&mdash;</span>
                            ) : (
                              money(l.interestAccrued)
                            )}
                          </td>
                          <td className="right num">
                            {l.monthlyPayment > 0 ? (
                              `${money(l.monthlyPayment)}/mo`
                            ) : (
                              <span className="faint">at payoff</span>
                            )}
                          </td>
                          <td className="right num">{money(loanPayoff(l))}</td>
                          <td className="right num dim">{percent(l.annualRate, 2)}</td>
                          <td className={`right num ${daysLeft < 60 && l.kind !== 'term' ? 'bad' : 'dim'}`}>
                            {daysLeft > 3650 ? `${Math.round(daysLeft / 365)}y` : `${daysLeft}d`}
                          </td>
                          <td className="right">
                            <button
                              className="btn small"
                              disabled={state.cash < loanPayoff(l)}
                              onClick={() => act((s) => repayLoan(s, l.id, loanPayoff(l)))}
                            >
                              Pay off
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Where the money went</h2>
          </div>
          <div className="panel-body">
            {totals.length === 0 ? (
              <div className="empty">No transactions yet.</div>
            ) : (
              totals.map(([cat, amount]) => (
                <div className="kv" key={cat}>
                  <span className="k">{CATEGORY_LABEL[cat]}</span>
                  <span className={`v ${amount >= 0 ? 'good' : 'bad'}`}>{money(amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Ledger</h2>
          <button className="btn small" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show recent' : `Show all (${state.ledger.length})`}
          </button>
        </div>
        <div className="panel-body flush">
          {entries.length === 0 ? (
            <div className="empty">Nothing recorded yet.</div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th className="right">Day</th>
                    <th>Description</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e, i) => (
                    <tr key={i}>
                      <td className="right num dim">{e.day}</td>
                      <td style={{ whiteSpace: 'normal' }}>{e.description}</td>
                      <td className={`right num ${e.amount >= 0 ? 'good' : 'bad'}`}>
                        {e.amount === 0 ? <span className="faint">accrued</span> : money(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


