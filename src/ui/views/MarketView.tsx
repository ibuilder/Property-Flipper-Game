import { useMemo, useState } from 'react';
import { NEIGHBORHOODS_BY_ID, ARCHETYPES_BY_ID, type Property } from '../../engine';
import { conditionLabel, money, moneyShort } from '../format';
import { useGame, useVersion } from '../store';
import PropertyModal from './PropertyModal';
import ClickableRow from '../components/ClickableRow';

type SortKey = 'ask' | 'condition' | 'sqft' | 'estimate' | 'dom';

export default function MarketView() {
  const state = useGame();
  const version = useVersion();
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('ask');
  const [hood, setHood] = useState<string>('all');

  const rows = useMemo(() => {
    if (!state) return [];
    let list = state.market.filter((p) => p.listing);
    if (hood !== 'all') list = list.filter((p) => p.neighborhoodId === hood);
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'condition':
          return a.condition - b.condition;
        case 'sqft':
          return b.sqft - a.sqft;
        case 'estimate':
          return a.appraisal.point - b.appraisal.point;
        case 'dom':
          return (b.listing?.daysOnMarket ?? 0) - (a.listing?.daysOnMarket ?? 0);
        default:
          return (a.listing?.askPrice ?? 0) - (b.listing?.askPrice ?? 0);
      }
    });
  }, [version, state?.market, sort, hood, state?.day]);

  if (!state) return null;
  const active = state.market.find((p) => p.id === selected) ?? null;
  const hoods = [...new Set(state.market.map((p) => p.neighborhoodId))];

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Listings</h2>
          <div className="btn-row">
            <select
              value={hood}
              onChange={(e) => setHood(e.target.value)}
              className="btn small"
              style={{ paddingRight: 24 }}
            >
              <option value="all">All areas</option>
              {hoods.map((h) => (
                <option key={h} value={h}>
                  {NEIGHBORHOODS_BY_ID[h]?.name ?? h}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="btn small"
              style={{ paddingRight: 24 }}
            >
              <option value="ask">Sort: asking price</option>
              <option value="estimate">Sort: estimated value</option>
              <option value="condition">Sort: worst condition</option>
              <option value="sqft">Sort: largest</option>
              <option value="dom">Sort: longest on market</option>
            </select>
          </div>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Area</th>
                  <th>Type</th>
                  <th className="right">Sqft</th>
                  <th className="right">Built</th>
                  <th>Condition</th>
                  <th className="right">Asking</th>
                  <th className="right">Est. as-is</th>
                  <th className="right">Spread</th>
                  <th className="right">DOM</th>
                  <th>Due diligence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <MarketRow
                    key={p.id}
                    prop={p}
                    selected={p.id === selected}
                    onClick={() => setSelected(p.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <div className="empty">No listings match that filter.</div>}
        </div>
      </div>

      <p className="faint" style={{ fontSize: 12 }}>
        The asking price is what the seller wants. The estimate is what your comps suggest it is
        worth as-is, and it carries real error &mdash; open a listing to see the confidence band and
        run the numbers before you offer.
      </p>

      {active && <PropertyModal property={active} onClose={() => setSelected(null)} />}
    </>
  );
}

function MarketRow({
  prop,
  selected,
  onClick,
}: {
  prop: Property;
  selected: boolean;
  onClick: () => void;
}) {
  const cond = conditionLabel(prop.condition);
  const ask = prop.listing?.askPrice ?? 0;
  const est = prop.appraisal.point;
  const spread = est - ask;

  return (
    <ClickableRow
      onActivate={onClick}
      selected={selected}
      label={`${prop.address}, asking ${money(ask)}`}
    >
      <td style={{ fontWeight: 500 }}>{prop.address}</td>
      <td className="dim">{NEIGHBORHOODS_BY_ID[prop.neighborhoodId]?.name}</td>
      <td className="dim">{ARCHETYPES_BY_ID[prop.archetypeId]?.name}</td>
      <td className="right num">{prop.sqft.toLocaleString()}</td>
      <td className="right num dim">{prop.yearBuilt}</td>
      <td>
        <span className={`pill ${cond.tone}`}>{cond.text}</span>
      </td>
      <td className="right num">{money(ask)}</td>
      <td className="right num dim">{moneyShort(est)}</td>
      <td className={`right num ${spread > 0 ? 'good' : 'bad'}`}>
        {spread > 0 ? '+' : ''}
        {moneyShort(spread)}
      </td>
      <td className="right num dim">{prop.listing?.daysOnMarket ?? 0}</td>
      <td>
        {prop.inspection === 'none' ? (
          <span className="faint" style={{ fontSize: 12 }}>
            not inspected
          </span>
        ) : (
          <span className="pill info">{prop.inspection}</span>
        )}
      </td>
    </ClickableRow>
  );
}


