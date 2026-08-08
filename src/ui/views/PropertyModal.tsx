import { useEffect, useMemo, useState } from 'react';
import {
  ECON,
  analyzeDeal,
  estimateArv,
  makeOffer,
  maxLoanAmount,
  orderInspection,
  quoteScope,
  type Property,
} from '../../engine';
import { currentReserve } from '../../engine/market';
import { money, percent } from '../format';
import { useAction, useGame, useVersion } from '../store';
import DealAnalyzer from '../components/DealAnalyzer';
import PropertyFacts from '../components/PropertyFacts';
import ScopeBuilder from '../components/ScopeBuilder';
import Modal from '../components/Modal';

/** The buy-side workflow: inspect, scope, analyze, offer. */
export default function PropertyModal({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const state = useGame();
  const version = useVersion();
  const act = useAction();
  const [scope, setScope] = useState<string[]>(['paint_interior', 'flooring_lvp', 'landscaping_curb']);
  const [offer, setOffer] = useState<number>(0);
  const [financed, setFinanced] = useState(false);
  const [touchedOffer, setTouchedOffer] = useState(false);

  const analysis = useMemo(() => {
    if (!state) return null;
    const arv = estimateArv(property, state.world, state.day, scope);
    return analyzeDeal(property, state.world, state.day, arv, scope, state.skills, {
      offer: offer > 0 ? offer : undefined,
      useFinancing: financed,
    });
  }, [version, property, scope, offer, financed, state?.day]);

  // Seed the offer box with the more conservative of the two max-offer figures.
  useEffect(() => {
    if (touchedOffer || !analysis) return;
    const suggested = Math.max(0, Math.min(analysis.mao70, analysis.maoDetailed));
    setOffer(Math.round(suggested));
  }, [analysis?.mao70, analysis?.maoDetailed, touchedOffer]);

  if (!state || !analysis) return null;

  const listing = property.listing;
  const quote = quoteScope(scope, property, state.world, state.skills);
  const loan = financed ? maxLoanAmount(offer) : 0;
  const cashAtClose = offer - loan + Math.round(offer * ECON.BUY_CLOSING_RATE);
  const cashAfterRehab = state.cash - cashAtClose - quote.totalCost;
  const canFund = state.cash >= cashAtClose;

  const toggle = (id: string) =>
    setScope((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal
      title={property.address}
      onClose={onClose}
      subtitle={
        <>
          Asking {money(listing?.askPrice ?? 0)} &middot; {listing?.daysOnMarket ?? 0} days on
          market
          {(listing?.sellerMotivation ?? 0) > 0.66 && (
            <span className="pill warn" style={{ marginLeft: 8 }}>
              motivated seller
            </span>
          )}
        </>
      }
    >
          <div className="grid-2">
            <div>
              <PropertyFacts property={property} />

              <div className="panel">
                <div className="panel-head">
                  <h2>Due diligence</h2>
                </div>
                <div className="panel-body">
                  <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
                    Inspect before you offer. Findings are disclosed to the seller, who has to
                    concede most of the repair cost or lose the deal &mdash; and if the numbers stop
                    working, you have not bought anything yet.
                  </p>
                  <div className="btn-row">
                    <button
                      className="btn"
                      disabled={property.inspection !== 'none' || state.cash < ECON.INSPECTION.standard.cost}
                      onClick={() => act((s) => orderInspection(s, property.id, 'standard'))}
                    >
                      Standard &mdash; {money(ECON.INSPECTION.standard.cost)}
                      <span className="faint">
                        {' '}
                        (finds ~{percent(ECON.INSPECTION.standard.revealRate, 0)})
                      </span>
                    </button>
                    <button
                      className="btn"
                      disabled={
                        property.inspection === 'thorough' ||
                        state.cash < ECON.INSPECTION.thorough.cost
                      }
                      onClick={() => act((s) => orderInspection(s, property.id, 'thorough'))}
                    >
                      Thorough &mdash; {money(ECON.INSPECTION.thorough.cost)}
                      <span className="faint">
                        {' '}
                        (finds ~{percent(ECON.INSPECTION.thorough.revealRate, 0)})
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h2>Planned scope of work</h2>
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
                </div>
              </div>
            </div>

            <div>
              <div className="panel">
                <div className="panel-head">
                  <h2>Deal analyzer</h2>
                </div>
                <div className="panel-body">
                  <DealAnalyzer analysis={analysis} offer={offer} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h2>Make an offer</h2>
                </div>
                <div className="panel-body">
                  <label className="field">
                    <span className="label">Offer price</span>
                    <input
                      type="number"
                      value={offer}
                      step={1000}
                      onChange={(e) => {
                        setTouchedOffer(true);
                        setOffer(Number(e.target.value));
                      }}
                    />
                  </label>

                  <label
                    className="scope-item"
                    style={{ marginBottom: 12, background: financed ? 'var(--accent-dim)' : undefined }}
                  >
                    <input
                      type="checkbox"
                      checked={financed}
                      onChange={(e) => setFinanced(e.target.checked)}
                    />
                    <span style={{ flex: 1 }}>
                      <span className="name">Use hard money</span>
                      <span className="blurb" style={{ display: 'block' }}>
                        Borrows {percent(ECON.MAX_LTV, 0)} of the price at{' '}
                        {percent(state.world.interestRate + ECON.LOAN_SPREAD, 2)} with{' '}
                        {percent(ECON.LOAN_POINTS, 0)} in points, balloon due in{' '}
                        {ECON.LOAN_TERM_DAYS} days. Frees up cash for the rehab, but if you have not
                        sold by maturity the lender takes the house.
                      </span>
                    </span>
                  </label>

                  <div className="kv">
                    <span className="k">Cash needed at closing</span>
                    <span className={`v ${canFund ? '' : 'bad'}`}>{money(cashAtClose)}</span>
                  </div>
                  {financed && (
                    <div className="kv">
                      <span className="k">Loan amount</span>
                      <span className="v">{money(loan)}</span>
                    </div>
                  )}
                  <div className="kv">
                    <span className="k">Cash left after funding the rehab</span>
                    <span className={`v ${cashAfterRehab < 0 ? 'bad' : ''}`}>
                      {money(cashAfterRehab)}
                    </span>
                  </div>

                  {cashAfterRehab < 0 && (
                    <div className="verdict thin" style={{ marginTop: 12 }}>
                      <strong>You cannot fund this scope</strong>
                      Closing would leave you short for the renovation. Reduce the scope, lower the
                      offer, or use financing.
                    </div>
                  )}

                  <div className="btn-row" style={{ marginTop: 14 }}>
                    <button
                      className="btn primary"
                      disabled={!canFund || offer <= 0}
                      onClick={() => {
                        const res = act((s) => makeOffer(s, property.id, offer, financed));
                        if (res.ok) onClose();
                      }}
                    >
                      Submit offer of {money(offer)}
                    </button>
                    <button className="btn" onClick={onClose}>
                      Walk away
                    </button>
                  </div>

                  <p className="faint" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                    The seller has a reserve you cannot see. A rejected offer costs nothing but the
                    day &mdash; and listings that sit get cheaper. Negotiation skill makes the same
                    number more persuasive.
                  </p>
                </div>
              </div>
            </div>
          </div>
    </Modal>
  );
}


