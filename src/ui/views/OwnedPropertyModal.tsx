import { useMemo, useState } from 'react';
import {
  DEFECTS_BY_ID,
  ECON,
  SCOPE_BY_ID,
  acceptOffer,
  analyzeDeal,
  dailyHoldingCost,
  delist,
  estimateArv,
  inspectionConcession,
  jobDaysRemaining,
  jobProgress,
  listForSale,
  hasAppraisalGap,
  loanPayoff,
  orderInspection,
  quoteScope,
  settlementPrice,
  reducePrice,
  rejectOffer,
  sellingCosts,
  startRenovation,
  type Property,
} from '../../engine';
import { money, percent } from '../format';
import { useAction, useGame, useVersion } from '../store';
import DealAnalyzer from '../components/DealAnalyzer';
import PropertyFacts from '../components/PropertyFacts';
import ScopeBuilder from '../components/ScopeBuilder';
import Modal from '../components/Modal';

/** Manage an owned property: renovate, then list and negotiate the exit. */
export default function OwnedPropertyModal({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const state = useGame();
  const version = useVersion();
  const act = useAction();
  const own = property.ownership;

  const [scope, setScope] = useState<string[]>([]);
  const [contingency, setContingency] = useState(15);
  const [listPrice, setListPrice] = useState<number | null>(null);

  const quote = useMemo(
    () => (state ? quoteScope(scope, property, state.world, state.skills, state.reputation.contractors) : null),
    [version, scope, property],
  );

  const analysis = useMemo(() => {
    if (!state) return null;
    const arv = estimateArv(property, state.world, state.day, scope);
    return analyzeDeal(property, state.world, state.day, arv, scope, state.skills, {
      offer: own?.purchasePrice,
      useFinancing: !!own?.loanId,
    });
  }, [version, property, scope]);

  if (!state || !own || !quote || !analysis) return null;

  const toggle = (id: string) =>
    setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const loan = state.loans.find((l) => l.id === own.loanId);
  const invested =
    own.purchasePrice + own.closingCosts + own.renovationSpend + own.holdingCostsPaid;
  const suggestedList = property.appraisal.point;
  const effectiveList = listPrice ?? suggestedList;
  const concession = inspectionConcession(property);
  const { commission, closing } = sellingCosts(effectiveList, state.reputation.agents);
  const netAtList = effectiveList - commission - closing - concession - (loan ? loanPayoff(loan) : 0);

  return (
    <Modal
      title={property.address}
      onClose={onClose}
      subtitle={
        <>
          Bought day {own.purchaseDay} for {money(own.purchasePrice)} &middot; held{' '}
          {state.day - own.purchaseDay} days &middot; {money(invested)} in
        </>
      }
    >
          <div className="grid-2">
            <div>
              <PropertyFacts property={property} />

              {property.inspection !== 'thorough' && !own.renovation && (
                <div className="panel">
                  <div className="panel-head">
                    <h2>Further inspection</h2>
                  </div>
                  <div className="panel-body">
                    <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
                      You already own it, so an inspection no longer buys you a discount &mdash; but
                      knowing now beats a change order later, when the crew is standing idle.
                    </p>
                    <div className="btn-row">
                      {property.inspection === 'none' && (
                        <button
                          className="btn"
                          onClick={() => act((s) => orderInspection(s, property.id, 'standard'))}
                        >
                          Standard &mdash; {money(ECON.INSPECTION.standard.cost)}
                        </button>
                      )}
                      <button
                        className="btn"
                        onClick={() => act((s) => orderInspection(s, property.id, 'thorough'))}
                      >
                        Thorough &mdash; {money(ECON.INSPECTION.thorough.cost)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              {own.renovation ? (
                <RenovationPanel property={property} />
              ) : own.saleListing ? (
                <SalePanel property={property} onClose={onClose} />
              ) : (
                <>
                  <div className="panel">
                    <div className="panel-head">
                      <h2>Plan the renovation</h2>
                      <span className="dim num" style={{ fontSize: 12 }}>
                        {money(quote.totalCost)} &middot; {quote.totalDays}d
                      </span>
                    </div>
                    <div className="panel-body">
                      <ScopeBuilder
                        property={property}
                        state={state}
                        scope={scope}
                        onToggle={toggle}
                      />

                      <label className="field" style={{ marginTop: 16 }}>
                        <span className="label">
                          Contingency reserve &mdash; {contingency}% ({money(
                            Math.round(quote.totalCost * (contingency / 100)),
                          )}
                          )
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={40}
                          step={5}
                          value={contingency}
                          onChange={(e) => setContingency(Number(e.target.value))}
                        />
                      </label>
                      <p className="faint" style={{ fontSize: 12, marginTop: -4 }}>
                        Held in escrow and released back to you if unused. Change orders draw from
                        it first; once it is gone they come straight out of cash, which is how a
                        good deal turns into a forced sale.
                      </p>

                      <div className="kv total">
                        <span className="k">Cash required now</span>
                        <span
                          className={`v ${
                            state.cash < quote.totalCost * (1 + contingency / 100) ? 'bad' : ''
                          }`}
                        >
                          {money(Math.round(quote.totalCost * (1 + contingency / 100)))}
                        </span>
                      </div>

                      <div className="btn-row" style={{ marginTop: 14 }}>
                        <button
                          className="btn primary"
                          disabled={scope.length === 0}
                          onClick={() =>
                            act((s) =>
                              startRenovation(s, property.id, scope, contingency / 100),
                            )
                          }
                        >
                          Start work
                        </button>
                        <button
                          className="btn"
                          onClick={() => act((s) => listForSale(s, property.id, suggestedList))}
                        >
                          Skip work, list as-is
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-head">
                      <h2>Projection</h2>
                    </div>
                    <div className="panel-body">
                      <DealAnalyzer
                        analysis={analysis}
                        offer={own.purchasePrice}
                        showRuleExplainer={false}
                      />
                    </div>
                  </div>
                </>
              )}

              {!own.renovation && !own.saleListing && (
                <div className="panel">
                  <div className="panel-head">
                    <h2>Exit</h2>
                  </div>
                  <div className="panel-body">
                    <label className="field">
                      <span className="label">List price</span>
                      <input
                        type="number"
                        step={1000}
                        value={effectiveList}
                        onChange={(e) => setListPrice(Number(e.target.value))}
                      />
                    </label>
                    <div className="kv">
                      <span className="k">Commission ({percent(ECON.COMMISSION_RATE, 0)})</span>
                      <span className="v bad">{money(-commission)}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Seller closing</span>
                      <span className="v bad">{money(-closing)}</span>
                    </div>
                    {concession > 0 && (
                      <div className="kv">
                        <span className="k warn">Expected buyer concession</span>
                        <span className="v bad">{money(-concession)}</span>
                      </div>
                    )}
                    {loan && (
                      <div className="kv">
                        <span className="k">Loan payoff</span>
                        <span className="v bad">{money(-loanPayoff(loan))}</span>
                      </div>
                    )}
                    <div className="kv total">
                      <span className="k">Net proceeds</span>
                      <span className="v">{money(netAtList)}</span>
                    </div>
                    <div className="kv total">
                      <span className="k">Profit vs everything in</span>
                      <span className={`v ${netAtList - invested >= 0 ? 'good' : 'bad'}`}>
                        {money(netAtList - invested)}
                      </span>
                    </div>
                    <div className="btn-row" style={{ marginTop: 14 }}>
                      <button
                        className="btn primary"
                        onClick={() => act((s) => listForSale(s, property.id, effectiveList))}
                      >
                        List at {money(effectiveList)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
    </Modal>
  );
}

function RenovationPanel({ property }: { property: Property }) {
  const state = useGame()!;
  const job = property.ownership!.renovation!;
  const pct = jobProgress(job);
  const changeOrders = job.lines.filter((l) => l.changeOrder);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Work in progress</h2>
        <span className="dim num" style={{ fontSize: 12 }}>
          {jobDaysRemaining(job)} days left
        </span>
      </div>
      <div className="panel-body">
        <div className="bar" style={{ marginBottom: 14 }}>
          <span style={{ width: `${pct * 100}%` }} />
        </div>

        <div className="kv">
          <span className="k">Contracted</span>
          <span className="v">{money(job.spent - changeOrders.reduce((s, l) => s + l.quotedCost, 0))}</span>
        </div>
        <div className="kv">
          <span className="k">Change orders ({changeOrders.length})</span>
          <span className={`v ${changeOrders.length ? 'bad' : ''}`}>
            {money(changeOrders.reduce((s, l) => s + l.quotedCost, 0))}
          </span>
        </div>
        <div className="kv">
          <span className="k">Contingency remaining</span>
          <span className={`v ${job.contingencyRemaining <= 0 ? 'bad' : 'good'}`}>
            {money(job.contingencyRemaining)} / {money(job.contingencyBudgeted)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Carrying cost while you wait</span>
          <span className="v">{money(dailyHoldingCost(property, state.world, state.day))}/day</span>
        </div>

        <div className="scope-group-label" style={{ marginTop: 16 }}>
          Line items
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              {job.lines.map((line, i) => {
                const label = line.defectId
                  ? DEFECTS_BY_ID[line.defectId]?.name
                  : SCOPE_BY_ID[line.itemId]?.name;
                return (
                  <tr key={i}>
                    <td>
                      {label}
                      {line.changeOrder && (
                        <span className="pill bad" style={{ marginLeft: 8 }}>
                          change order
                        </span>
                      )}
                    </td>
                    <td className="right num">{money(line.quotedCost)}</td>
                    <td className="right num dim">{line.quotedDays}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {job.contingencyRemaining <= 0 && changeOrders.length > 0 && (
          <div className="verdict thin" style={{ marginTop: 14 }}>
            <strong>Contingency exhausted</strong>
            Any further discoveries come straight out of cash.
          </div>
        )}
      </div>
    </div>
  );
}

function SalePanel({ property, onClose }: { property: Property; onClose: () => void }) {
  const state = useGame()!;
  const act = useAction();
  const own = property.ownership!;
  const sale = own.saleListing!;
  const loan = state.loans.find((l) => l.id === own.loanId);
  const invested =
    own.purchasePrice + own.closingCosts + own.renovationSpend + own.holdingCostsPaid;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>On the market</h2>
        <span className="dim num" style={{ fontSize: 12 }}>
          {sale.daysOnMarket} days &middot; {sale.reductions} reduction
          {sale.reductions === 1 ? '' : 's'}
        </span>
      </div>
      <div className="panel-body">
        <div className="kv">
          <span className="k">Listed at</span>
          <span className="v" style={{ fontSize: 16, fontWeight: 600 }}>
            {money(sale.listPrice)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Your estimate of value</span>
          <span className="v">{money(property.appraisal.point)}</span>
        </div>
        <div className="kv">
          <span className="k">Bleeding while it sits</span>
          <span className="v bad">
            {money(dailyHoldingCost(property, state.world, state.day))}/day
          </span>
        </div>

        {sale.daysOnMarket > 45 && sale.offers.length === 0 && (
          <div className="verdict thin" style={{ marginTop: 12 }}>
            <strong>No interest in {sale.daysOnMarket} days</strong>
            Buyer traffic falls off sharply above true value. A price cut almost always costs less
            than another two months of carry.
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button
            className="btn"
            onClick={() => act((s) => reducePrice(s, property.id, Math.round(sale.listPrice * 0.96)))}
          >
            Cut 4% &rarr; {money(Math.round(sale.listPrice * 0.96))}
          </button>
          <button className="btn" onClick={() => act((s) => delist(s, property.id))}>
            Withdraw
          </button>
        </div>

        <div className="scope-group-label" style={{ marginTop: 18 }}>
          Offers
        </div>
        {sale.offers.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>
            No offers on the table.
          </div>
        ) : (
          [...sale.offers]
            .sort((a, b) => settlementPrice(b) - settlementPrice(a))
            .map((o) => {
            const settles = settlementPrice(o);
            const gap = hasAppraisalGap(o);
            const { commission, closing } = sellingCosts(settles, state.reputation.agents);
            const payoff = loan ? loanPayoff(loan) : 0;
            const net = settles - commission - closing - o.inspectionConcession - payoff;
            const profit = settles - commission - closing - o.inspectionConcession - invested;
            return (
              <div
                key={o.id}
                className="panel"
                style={{ marginBottom: 10, background: 'var(--bg-inset)' }}
              >
                <div className="panel-body">
                  <div className="kv">
                    <span className="k">
                      {o.buyerName} offers{' '}
                      <span className={`pill ${o.financed ? 'mute' : 'good'}`}>
                        {o.financed ? 'financed' : 'cash'}
                      </span>
                    </span>
                    <span className="v" style={{ fontSize: 15, fontWeight: 600 }}>
                      {money(o.amount)}
                    </span>
                  </div>
                  {gap && (
                    <div className="kv">
                      <span className="k warn">
                        Lender&rsquo;s appraisal
                        <br />
                        <span className="faint" style={{ fontSize: 11 }}>
                          the loan cannot exceed it, so the price falls to it
                        </span>
                      </span>
                      <span className="v bad">{money(o.appraisedValue)}</span>
                    </div>
                  )}
                  <div className="kv">
                    <span className="k">Commission + closing</span>
                    <span className="v bad">{money(-(commission + closing))}</span>
                  </div>
                  {o.inspectionConcession > 0 && (
                    <div className="kv">
                      <span className="k warn">
                        Inspection concession
                        <br />
                        <span className="faint" style={{ fontSize: 11 }}>
                          defects you left unrepaired
                        </span>
                      </span>
                      <span className="v bad">{money(-o.inspectionConcession)}</span>
                    </div>
                  )}
                  {payoff > 0 && (
                    <div className="kv">
                      <span className="k">Loan payoff</span>
                      <span className="v bad">{money(-payoff)}</span>
                    </div>
                  )}
                  <div className="kv total">
                    <span className="k">Cash to you</span>
                    <span className="v">{money(net)}</span>
                  </div>
                  <div className="kv total">
                    <span className="k">Deal profit</span>
                    <span className={`v ${profit >= 0 ? 'good' : 'bad'}`}>{money(profit)}</span>
                  </div>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <button
                      className="btn primary"
                      onClick={() => {
                        const res = act((s) => acceptOffer(s, property.id, o.id));
                        if (res.ok) onClose();
                      }}
                    >
                      Accept
                    </button>
                    <button
                      className="btn"
                      onClick={() => act((s) => rejectOffer(s, property.id, o.id))}
                    >
                      Decline
                    </button>
                    <span className="faint" style={{ fontSize: 12 }}>
                      expires day {o.expiresDay}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


