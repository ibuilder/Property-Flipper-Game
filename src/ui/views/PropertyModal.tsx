import { useEffect, useMemo, useState } from 'react';
import {
  ECON,
  analyzeDeal,
  estimateArv,
  financingMenu,
  makeOffer,
  orderInspection,
  quoteScope,
  returnProfile,
  stressField,
  stressTest,
  type FinancingKind,
  type Property,
} from '../../engine';
import { currentReserve } from '../../engine/market';
import { money, percent } from '../format';
import { useAction, useGame, useVersion } from '../store';
import DealAnalyzer from '../components/DealAnalyzer';
import PropertyFacts from '../components/PropertyFacts';
import ScopeBuilder from '../components/ScopeBuilder';
import Modal from '../components/Modal';
import ConfirmButton from '../components/ConfirmButton';
import FirstTime from '../components/FirstTime';

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
  const [kind, setKind] = useState<FinancingKind>('cash');
  const [touchedOffer, setTouchedOffer] = useState(false);
  const [counter, setCounter] = useState<number | null>(null);

  const financed = kind !== 'cash';

  const analysis = useMemo(() => {
    if (!state) return null;
    const arv = estimateArv(property, state.world, state.day, scope);
    return analyzeDeal(property, state.world, state.day, arv, scope, state.skills, {
      offer: offer > 0 ? offer : undefined,
      useFinancing: financed,
    });
  }, [version, property, scope, offer, financed, state?.day]);

  // Only worth computing once there is an offer to shock, and cheap enough at
  // twenty cells that it can follow the slider.
  const stress = useMemo(
    () =>
      analysis && offer > 0
        ? stressTest(offer, analysis.inputs, analysis.dailyCarry, analysis.loanRate)
        : null,
    [analysis, offer],
  );

  // A thousand samples rather than twenty, so the break-even line is a curve
  // instead of a staircase. Still only a millisecond of arithmetic.
  const field = useMemo(
    () =>
      analysis && offer > 0
        ? stressField(offer, analysis.inputs, analysis.dailyCarry, analysis.loanRate)
        : null,
    [analysis, offer],
  );

  // Seed the offer box with the more conservative of the two max-offer figures.
  useEffect(() => {
    if (touchedOffer || !analysis) return;
    const suggested = Math.max(0, Math.min(analysis.mao70, analysis.maoDetailed));
    setOffer(Math.round(suggested));
  }, [analysis?.mao70, analysis?.maoDetailed, touchedOffer]);

  if (!state || !analysis) return null;

  const listing = property.listing;
  const scopeQuote = quoteScope(
    scope,
    property,
    state.world,
    state.skills,
    state.reputation.contractors,
  );
  const menu = financingMenu(property, offer, state.world, state.reputation, state.cash);
  const quote = menu.find((q) => q.kind === kind) ?? menu[0];
  const cashAtClose = quote.cashRequired;
  const cashAfterRehab = state.cash - cashAtClose - scopeQuote.totalCost;
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
          {/*
            Two columns with the analyser column pinned.

            This is the fix for the worst UX failure in the original: the
            panel that re-prices the deal scrolled out of the viewport exactly
            as you changed what it was pricing, so you toggled a comp and then
            had to go looking for the consequence. Decision and consequence
            now share a viewport at every scroll position.
          */}
          <div className="grid-2 deal-grid">
            <div>
              <FirstTime id="first-listing" title="How to read a listing">
                <p>
                  Four numbers decide everything here, and they are not the asking price. What is
                  it worth once repaired (<strong>ARV</strong>), what will the work cost, what will
                  it cost to hold, and what is the most you can pay and still make money
                  (<strong>MAO</strong>).
                </p>
                <p>
                  Work down the left column &mdash; the comps set your value, the inspection tells
                  you what is wrong &mdash; then pick a scope on the right. The projection re-prices
                  as you go, and the two maximum offers appear at the bottom.
                </p>
              </FirstTime>

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
                    {money(scopeQuote.totalCost)} &middot; {scopeQuote.totalDays}d
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

            <div className="deal-analyser">
              <div className="panel">
                <div className="panel-head">
                  <h2>Deal analyzer</h2>
                  <span className="live-kicker">live · every number shows its work</span>
                </div>
                <div className="panel-body">
                  <DealAnalyzer
                    analysis={analysis}
                    offer={offer}
                    stress={stress}
                    stressField={field}
                    cashOnHand={state.cash}
                  />
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

                  <div className="scope-group-label">How you pay for it</div>
                  {menu.map((q) => (
                    <label
                      key={q.kind}
                      className={`scope-item${kind === q.kind ? ' on' : ''}`}
                      style={{ opacity: q.available || kind === q.kind ? 1 : 0.55 }}
                    >
                      <input
                        type="radio"
                        name="financing"
                        checked={kind === q.kind}
                        disabled={!q.available}
                        onChange={() => setKind(q.kind)}
                      />
                      <span style={{ flex: 1 }}>
                        <span className="name">{q.label}</span>
                        <span className="meta" style={{ display: 'block' }}>
                          {q.advance > 0 && `${money(q.advance)} advanced · `}
                          {q.annualRate > 0
                            ? `${percent(q.annualRate, 2)} · ${q.termDays}d`
                            : q.profitShare > 0
                              ? `${percent(q.profitShare, 0)} of the profit`
                              : 'no financing cost'}
                          {q.points > 0 && ` · ${money(q.points)} points`}
                          {q.priceUplift > 0 && ` · +${money(q.priceUplift)} on the price`}
                        </span>
                        <span className="blurb" style={{ display: 'block' }}>
                          {q.available ? q.note : q.reason}
                        </span>
                      </span>
                    </label>
                  ))}

                  <div className="kv" style={{ marginTop: 10 }}>
                    <span className="k">Cash needed at closing</span>
                    <span className={`v ${canFund ? '' : 'bad'}`}>{money(cashAtClose)}</span>
                  </div>
                  {quote.advance > 0 && (
                    <div className="kv">
                      <span className="k">
                        {quote.kind === 'partner' ? 'Partner puts in' : 'Advanced'}
                      </span>
                      <span className="v">{money(quote.advance)}</span>
                    </div>
                  )}
                  {quote.priceUplift > 0 && (
                    <div className="kv">
                      <span className="k warn">
                        Seller&rsquo;s price for carrying it
                        <br />
                        <span className="faint" style={{ fontSize: 11 }}>
                          the contract price becomes {money(offer + quote.priceUplift)}
                        </span>
                      </span>
                      <span className="v bad">{money(-quote.priceUplift)}</span>
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
                    <ConfirmButton
                      className="btn primary"
                      disabled={!canFund || offer <= 0}
                      label={`Submit offer of ${money(offer)}`}
                      title="Submit this offer?"
                      confirmLabel={`Offer ${money(offer)}`}
                      body={
                        <>
                          <p style={{ marginTop: 0 }}>
                            An offer is binding. If the seller takes it you own {property.address}{' '}
                            at that price, with everything that is still wrong with it.
                          </p>
                          <div className="kv">
                            <span className="k">Offer</span>
                            <span className="v">{money(offer)}</span>
                          </div>
                          <div className="kv">
                            <span className="k">Cash at closing</span>
                            <span className="v bad">{money(-cashAtClose)}</span>
                          </div>
                          {quote.advance > 0 && (
                            <div className="kv">
                              <span className="k">
                                {quote.label}
                                <br />
                                <span className="faint" style={{ fontSize: 11 }}>
                                  {quote.termDays > 0
                                    ? `due day ${state.day + quote.termDays}`
                                    : `${percent(quote.profitShare, 0)} of the profit, forever`}
                                </span>
                              </span>
                              <span className="v">{money(quote.advance)}</span>
                            </div>
                          )}
                          {quote.priceUplift > 0 && (
                            <div className="kv">
                              <span className="k warn">Seller&rsquo;s premium for the note</span>
                              <span className="v bad">{money(-quote.priceUplift)}</span>
                            </div>
                          )}
                          <div className="kv total">
                            <span className="k">Left to fund the rehab</span>
                            <span className={`v ${cashAfterRehab < 0 ? 'bad' : ''}`}>
                              {money(cashAfterRehab)}
                            </span>
                          </div>
                          {analysis.breakdown && (
                            <div className="kv total">
                              <span className="k">
                                If it goes to plan
                                <br />
                                <span className="faint" style={{ fontSize: 11 }}>
                                  {money(analysis.breakdown.profit)} over {analysis.holdDays} days
                                </span>
                              </span>
                              <span
                                className={`v ${
                                  analysis.breakdown.profit >= 0 ? 'good' : 'bad'
                                }`}
                              >
                                {percent(
                                  returnProfile(
                                    analysis.breakdown.profit,
                                    Math.max(
                                      1,
                                      analysis.breakdown.purchase +
                                        analysis.breakdown.buyClosing +
                                        analysis.breakdown.repairs -
                                        analysis.breakdown.loan,
                                    ),
                                    Math.max(1, analysis.holdDays),
                                  ).annualised,
                                  0,
                                )}{' '}
                                <span className="faint">a year</span>
                              </span>
                            </div>
                          )}
                          {property.inspection === 'none' && (
                            <div className="verdict thin" style={{ marginTop: 12 }}>
                              <strong>You have not inspected it</strong>
                              Anything wrong with this house is still hidden. It will surface as a
                              change order once the walls are open, or as a buyer&rsquo;s concession
                              when you sell &mdash; and by then the seller is no longer the one
                              paying for it.
                            </div>
                          )}
                          {offer > analysis.mao70 && offer > analysis.maoDetailed && (
                            <div className="verdict thin" style={{ marginTop: 12 }}>
                              <strong>Above both of your maximums</strong>
                              This offer clears neither the 70% rule ({money(analysis.mao70)}) nor
                              your own itemised costs ({money(analysis.maoDetailed)}). You may have
                              a reason; the numbers do not.
                            </div>
                          )}
                        </>
                      }
                      onConfirm={() => {
                        const res = act((s) => makeOffer(s, property.id, offer, kind));
                        if (res.ok) onClose();
                        else setCounter(res.counterPrice ?? null);
                      }}
                    />
                    <button className="btn" onClick={onClose}>
                      Walk away
                    </button>
                  </div>

                  {/* A counter used to be a sentence in a toast that the player
                      had to read and retype. It is a decision, so it gets to be
                      one — and the only thing that matters about it is whether
                      it still clears your own maximum. */}
                  {counter !== null && (
                    <div
                      className={`verdict ${counter <= analysis.maoDetailed ? 'fair' : 'thin'}`}
                      style={{ marginTop: 12 }}
                    >
                      <strong>The seller countered at {money(counter)}</strong>
                      {counter <= analysis.maoDetailed ? (
                        <>
                          That is still inside your itemised maximum of{' '}
                          {money(analysis.maoDetailed)}. The deal survives it.
                        </>
                      ) : (
                        <>
                          That is {money(counter - analysis.maoDetailed)} above your itemised
                          maximum of {money(analysis.maoDetailed)}. Taking it means buying a
                          different deal from the one you underwrote.
                        </>
                      )}
                      <div className="btn-row" style={{ marginTop: 10 }}>
                        <button
                          className="btn"
                          onClick={() => {
                            setTouchedOffer(true);
                            setOffer(counter);
                            setCounter(null);
                          }}
                        >
                          Put {money(counter)} in the box
                        </button>
                        <button className="btn" onClick={() => setCounter(null)}>
                          Leave it
                        </button>
                      </div>
                    </div>
                  )}

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


