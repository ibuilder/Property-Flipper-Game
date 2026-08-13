import { useState } from 'react';
import { NEIGHBORHOODS_BY_ID, verdictOnReturn } from '../../engine';
import { conditionLabel, money, moneyShort, percent } from '../format';
import { useGame } from '../store';
import { Waterfall } from '../graphics/Charts';
import CalibrationPanel from '../components/CalibrationPanel';
import PostMortemPanel from '../components/PostMortemPanel';
import House from '../graphics/House';

/**
 * Track record.
 *
 * Every closed deal broken down into the same cost stack the analyzer used
 * before the purchase, so the player can compare what they projected against
 * what actually happened. That comparison is where the learning is.
 */
export default function DealsView() {
  const state = useGame();
  const [selected, setSelected] = useState<string>('');
  const deals = state?.closedDeals ?? [];

  // Default to the most recent deal, and follow along as new ones close.
  const key = (d: (typeof deals)[number]) => `${d.propertyId}-${d.soldDay}`;
  const shown =
    deals.find((d) => key(d) === selected) ?? (deals.length > 0 ? deals[deals.length - 1] : null);

  if (!state) return null;

  if (deals.length === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Track record</h2>
        </div>
        <div className="empty">No completed flips yet.</div>
      </div>
    );
  }

  const total = deals.reduce((s, d) => s + d.netProfit, 0);
  const wins = deals.filter((d) => d.netProfit > 0).length;
  const avgDays = deals.reduce((s, d) => s + d.daysHeld, 0) / deals.length;

  /**
   * Capital-weighted, not the average of the per-deal rates.
   *
   * Averaging percentages lets one tiny lucky deal at 400% drown out three
   * large ones that lost money, which flatters exactly the player who needs
   * flattering least. Weighting by the cash each deal tied up answers the
   * question actually being asked: how hard did my money work?
   */
  const totalDays = deals.reduce((s, d) => s + d.daysHeld, 0);
  const capitalWeightedRoi =
    totalDays > 0
      ? deals.reduce((s, d) => s + d.roi * d.daysHeld, 0) / totalDays
      : 0;
  const bestRoi = Math.max(...deals.map((d) => d.roi));
  const overall = verdictOnReturn(capitalWeightedRoi);

  return (
    <>
      <div className="grid-3">
        <Stat label="Total profit" value={money(total)} tone={total >= 0 ? 'good' : 'bad'} />
        <Stat
          label="Hit rate"
          value={`${wins} / ${deals.length}`}
          sub={percent(wins / deals.length, 0)}
        />
        <Stat
          label="Return on your time"
          value={percent(capitalWeightedRoi, 0)}
          tone={capitalWeightedRoi >= 0 ? 'good' : 'bad'}
          sub={`annualised · ${Math.round(avgDays)}d average hold · best ${percent(bestRoi, 0)}`}
        />
      </div>

      <p className="faint" style={{ fontSize: 12, marginTop: -4 }}>
        {overall.text} Returns are annualised against the cash you actually tied up and weighted by
        how long each deal held it &mdash; a small fast win does not outweigh a large slow loss.
      </p>

      {/* Above the per-deal breakdown, because it is the question the whole
          track record is trying to answer and a single deal cannot. */}
      <CalibrationPanel deals={deals} />

      <div className="panel">
        <div className="panel-head">
          <h2>Where the margin went</h2>
          <select
            className="btn small"
            style={{ paddingRight: 24 }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {deals.map((d) => (
              <option key={`${d.propertyId}-${d.soldDay}`} value={`${d.propertyId}-${d.soldDay}`}>
                {d.address} — {money(d.netProfit)}
              </option>
            ))}
          </select>
        </div>
        <div className="panel-body">
          {shown && (
            <>
              <Waterfall
                steps={[
                  { label: 'Sale price', value: shown.salePrice },
                  { label: 'Purchase', value: -shown.purchasePrice },
                  { label: 'Closing', value: -shown.closingCosts },
                  { label: 'Renovation', value: -shown.renovationSpend },
                  { label: 'Carry', value: -shown.holdingCosts },
                  ...(shown.financingCosts ? [{ label: 'Financing', value: -shown.financingCosts }] : []),
                  { label: 'Commission', value: -shown.commission },
                  ...(shown.concession ? [{ label: 'Concession', value: -shown.concession }] : []),
                ]}
                format={(n) => moneyShort(n)}
              />
              <p className="faint" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                Held {shown.daysHeld} days. Sale price is rarely the story — the gap between the
                first bar and the last is everything the business costs.
              </p>
            </>
          )}
        </div>
      </div>

      {shown?.before && shown?.after && (
        <div className="panel">
          <div className="panel-head">
            <h2>Before and after — {shown.address}</h2>
            <span className="faint" style={{ fontSize: 12 }}>
              {shown.daysHeld} days apart
            </span>
          </div>
          <div className="panel-body">
            <div className="grid-2">
              <div>
                <div className="chart-title">
                  <h3>Bought day {shown.boughtDay}</h3>
                  <span className={`pill ${conditionLabel(shown.before.condition).tone}`}>
                    {conditionLabel(shown.before.condition).text}
                  </span>
                </div>
                <House property={shown.before} className="house-hero" day={shown.boughtDay} />
                <div className="kv">
                  <span className="k">Paid</span>
                  <span className="v">{money(shown.purchasePrice)}</span>
                </div>
              </div>
              <div>
                <div className="chart-title">
                  <h3>Sold day {shown.soldDay}</h3>
                  <span className={`pill ${conditionLabel(shown.after.condition).tone}`}>
                    {conditionLabel(shown.after.condition).text}
                  </span>
                </div>
                <House property={shown.after} className="house-hero" day={shown.soldDay} />
                <div className="kv">
                  <span className="k">Sold for</span>
                  <span className="v">{money(shown.salePrice)}</span>
                </div>
              </div>
            </div>
            <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
              {shown.after.completedWork.length > 0
                ? `${shown.after.completedWork.length} line items of work, ${money(shown.renovationSpend)} spent.`
                : 'Sold as-is, with no work done.'}
            </p>
          </div>
        </div>
      )}

      {shown?.postMortem && (
        <div className="panel">
          <div className="panel-head">
            <h2>Post-mortem — {shown.address}</h2>
            <span className="faint" style={{ fontSize: 12 }}>
              what you believed on day {shown.boughtDay}
            </span>
          </div>
          <div className="panel-body">
            <PostMortemPanel pm={shown.postMortem} deal={shown} />
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>Closed deals</h2>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Area</th>
                  <th className="right">Bought</th>
                  <th className="right">Sold</th>
                  <th className="right">Rehab</th>
                  <th className="right">Carry</th>
                  <th className="right">Finance</th>
                  <th className="right">Comm.</th>
                  <th className="right">Concession</th>
                  <th className="right">Profit</th>
                  <th className="right">Days</th>
                  <th className="right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {[...deals].reverse().map((d) => (
                  <tr key={`${d.propertyId}-${d.soldDay}`}>
                    <td style={{ fontWeight: 500 }}>{d.address}</td>
                    <td className="dim">{NEIGHBORHOODS_BY_ID[d.neighborhoodId]?.name}</td>
                    <td className="right num">{moneyShort(d.purchasePrice)}</td>
                    <td className="right num">{moneyShort(d.salePrice)}</td>
                    <td className="right num dim">{moneyShort(d.renovationSpend)}</td>
                    <td className="right num dim">{moneyShort(d.holdingCosts)}</td>
                    <td className="right num dim">
                      {d.financingCosts ? moneyShort(d.financingCosts) : '—'}
                    </td>
                    <td className="right num dim">{moneyShort(d.commission)}</td>
                    <td className={`right num ${d.concession > 0 ? 'bad' : 'faint'}`}>
                      {d.concession > 0 ? moneyShort(d.concession) : '—'}
                    </td>
                    <td className={`right num ${d.netProfit >= 0 ? 'good' : 'bad'}`}>
                      {money(d.netProfit)}
                    </td>
                    <td className="right num dim">{d.daysHeld}</td>
                    <td className={`right num ${d.roi >= 0 ? 'good' : 'bad'}`}>
                      {percent(d.roi, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="faint" style={{ fontSize: 12 }}>
        ROI is annualised on the cash you actually put in, so a small fast flip can beat a large
        slow one. Concessions are what buyers took off for defects you chose not to repair.
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="panel">
      <div className="panel-body">
        <div className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
          {label}
        </div>
        <div className={`num ${tone ?? ''}`} style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
          {value}
        </div>
        {sub && <div className="faint" style={{ fontSize: 12 }}>{sub}</div>}
      </div>
    </div>
  );
}
