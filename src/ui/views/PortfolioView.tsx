import { useState } from 'react';
import {
  NEIGHBORHOODS_BY_ID,
  dailyHoldingCost,
  isOccupied,
  jobDaysRemaining,
  jobProgress,
  loanPayoff,
  type Property,
} from '../../engine';
import { conditionLabel, money, moneyShort } from '../format';
import { useGame } from '../store';
import OwnedPropertyModal from './OwnedPropertyModal';
import ClickableRow from '../components/ClickableRow';

export default function PortfolioView() {
  const state = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  if (!state) return null;

  const active = state.portfolio.find((p) => p.id === selected) ?? null;

  if (state.portfolio.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Portfolio</h2>
        </div>
        <div className="empty">
          You do not own anything yet. Find a listing whose numbers work and make an offer.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Portfolio</h2>
          <span className="dim" style={{ fontSize: 12 }}>
            {money(
              state.portfolio.reduce((s, p) => s + dailyHoldingCost(p, state.world, state.day), 0),
            )}
            /day in carry
          </span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th className="right">Paid</th>
                  <th className="right">In</th>
                  <th className="right">Est. value</th>
                  <th className="right">Carry/day</th>
                  <th className="right">Debt</th>
                  <th className="right">Held</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.portfolio.map((p) => (
                  <PortfolioRow
                    key={p.id}
                    prop={p}
                    onClick={() => setSelected(p.id)}
                    selected={p.id === selected}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {active && <OwnedPropertyModal property={active} onClose={() => setSelected(null)} />}
    </>
  );
}

function PortfolioRow({
  prop,
  onClick,
  selected,
}: {
  prop: Property;
  onClick: () => void;
  selected: boolean;
}) {
  const state = useGame()!;
  const own = prop.ownership!;
  const cond = conditionLabel(prop.condition);
  const loan = state.loans.find((l) => l.id === own.loanId);
  const invested = own.purchasePrice + own.closingCosts + own.renovationSpend + own.holdingCostsPaid;
  const held = state.day - own.purchaseDay;

  let status: React.ReactNode;
  if (own.renovation) {
    const pct = jobProgress(own.renovation);
    status = (
      <div style={{ minWidth: 130 }}>
        <div style={{ fontSize: 12, marginBottom: 3 }}>
          Renovating &middot; {jobDaysRemaining(own.renovation)}d left
        </div>
        <div className="bar">
          <span style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
    );
  } else if (own.saleListing) {
    const offers = own.saleListing.offers.length;
    status = offers > 0 ? (
      <span className="pill good">{offers} offer{offers === 1 ? '' : 's'}</span>
    ) : (
      <span className="pill info">Listed &middot; {own.saleListing.daysOnMarket}d</span>
    );
  } else if (isOccupied(prop, state.day)) {
    status = (
      <span className="pill bad">
        Occupied &middot; {own.occupiedUntilDay! - state.day}d
      </span>
    );
  } else if (own.rental?.tenancy) {
    status = <span className="pill good">Let &middot; {money(own.rental.tenancy.rent)}/mo</span>;
  } else if (own.rental) {
    status = <span className="pill warn">Vacant &middot; {own.rental.vacantDays}d</span>;
  } else {
    status = <span className={`pill ${cond.tone}`}>{cond.text}</span>;
  }

  return (
    <ClickableRow onActivate={onClick} selected={selected} label={`Manage ${prop.address}`}>
      <td style={{ fontWeight: 500 }}>{prop.address}</td>
      <td className="dim">{NEIGHBORHOODS_BY_ID[prop.neighborhoodId]?.name}</td>
      <td>{status}</td>
      <td className="right num">{moneyShort(own.purchasePrice)}</td>
      <td className="right num dim">{moneyShort(invested)}</td>
      <td className="right num">{moneyShort(prop.appraisal.point)}</td>
      <td className="right num dim">
        {money(dailyHoldingCost(prop, state.world, state.day))}
      </td>
      <td className="right num">
        {loan ? <span className="bad">{moneyShort(loanPayoff(loan))}</span> : <span className="faint">&mdash;</span>}
      </td>
      <td className="right num dim">{held}d</td>
      <td className="right">
        <button className="btn small">Manage</button>
      </td>
    </ClickableRow>
  );
}
