import { useState } from 'react';
import {
  ECON,
  capRate,
  cashOnCash,
  dscr,
  isHabitable,
  listForRent,
  loanPayoff,
  marketRent,
  noi,
  quoteRefinance,
  refinance,
  setAskingRent,
  stopRenting,
  trueValue,
  type Property,
} from '../../engine';
import { money, percent } from '../format';
import { useAction, useGame } from '../store';
import ConfirmButton from '../components/ConfirmButton';

/**
 * Hold it instead of selling it.
 *
 * The screen exists to make one distinction concrete: equity and borrowing
 * capacity are not the same thing. A property can be worth plenty and still
 * refuse to refinance because the rent will not carry the payment, and the
 * quote says which of the two tests is binding rather than just refusing.
 */
export default function RentalPanel({ property }: { property: Property }) {
  const state = useGame();
  const act = useAction();
  const own = property.ownership;
  const [draftRent, setDraftRent] = useState<number | null>(null);

  if (!state || !own) return null;

  const market = marketRent(property, state.world, state.day);
  const rental = own.rental;
  const rent = rental?.tenancy?.rent ?? rental?.askingRent ?? market;
  const annualNoi = noi(property, state.world, state.day, rent);
  const value = trueValue(property, state.world, state.day);
  const loan = state.loans.find((l) => l.id === own.loanId);
  const annualDebtService = loan ? (loan.kind === 'term' ? loan.monthlyPayment * 12 : loan.principal * loan.annualRate) : 0;
  const invested =
    own.purchasePrice + own.closingCosts + own.renovationSpend - (loan?.principal ?? 0) - own.cashedOut;

  const quote = quoteRefinance({
    value,
    annualNoi,
    existingPayoff: loan ? loanPayoff(loan) : 0,
    baseRate: state.world.baseRate,
    lenderReputation: state.reputation.lenders,
    daysOwned: state.day - own.purchaseDay,
  });

  // Not yet a rental: offer the choice.
  if (!rental) {
    const suggested = draftRent ?? market;
    const habitable = isHabitable(property);
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Hold it and rent</h2>
          <span className="dim num" style={{ fontSize: 12 }}>
            cap {percent(capRate(property, state.world, state.day), 2)}
          </span>
        </div>
        <div className="panel-body">
          <p className="dim" style={{ marginTop: 0, fontSize: 13 }}>
            Selling converts your equity to cash once. Renting keeps the asset, pays you monthly,
            and lets a refinance pull the capital back out to buy the next one &mdash; which is the
            whole BRRRR idea. What stops it being free money is that the rent has to carry the new
            payment.
          </p>

          <div className="kv">
            <span className="k">Market rent</span>
            <span className="v">{money(market)}/mo</span>
          </div>
          <div className="kv">
            <span className="k">
              Net operating income
              <br />
              <span className="faint" style={{ fontSize: 11 }}>
                rent less vacancy, management, maintenance, tax and insurance
              </span>
            </span>
            <span className="v">{money(annualNoi)}/yr</span>
          </div>
          <div className="kv">
            <span className="k">Cap rate</span>
            <span className="v">{percent(annualNoi / Math.max(1, value), 2)}</span>
          </div>

          <label className="field" style={{ marginTop: 12 }}>
            <span className="label">Asking rent</span>
            <input
              type="number"
              step={25}
              value={suggested}
              onChange={(e) => setDraftRent(Number(e.target.value))}
            />
          </label>
          {suggested > market * 1.1 && habitable && (
            <div className="verdict thin">
              <strong>That is above market</strong>
              Tenant interest falls off steeply above the going rate, and every empty month is rent
              you never get back.
            </div>
          )}
          {!habitable && (
            <div className="verdict thin">
              <strong>Not habitable yet</strong>
              A landlord owes a warranty of habitability. Bring the condition up and repair any
              known major defect first &mdash; that rehab is the R in the middle of BRRRR, and it
              is why buying a wreck and letting it as-is is not a strategy.
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              disabled={!habitable}
              onClick={() => act((s) => listForRent(s, property.id, suggested))}
            >
              Advertise to let
            </button>
          </div>
        </div>
      </div>
    );
  }

  // It is a rental.
  const t = rental.tenancy;
  const monthlyCash = annualNoi / 12 - annualDebtService / 12;
  const tapped = loan?.kind === 'term' && quote.cashOut <= 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{t ? 'Tenanted' : 'To let'}</h2>
        <span className={`pill ${t ? 'good' : 'warn'}`}>
          {t ? `lease ends day ${t.leaseEndsDay}` : `${rental.vacantDays} days vacant`}
        </span>
      </div>
      <div className="panel-body">
        <div className="kv">
          <span className="k">{t ? 'Rent' : 'Asking'}</span>
          <span className="v">{money(t?.rent ?? rental.askingRent)}/mo</span>
        </div>
        <div className="kv">
          <span className="k">Market rent</span>
          <span className="v dim">{money(market)}/mo</span>
        </div>
        <div className="kv">
          <span className="k">NOI</span>
          <span className="v">{money(annualNoi)}/yr</span>
        </div>
        <div className="kv">
          <span className="k">Cap rate</span>
          <span className="v">{percent(annualNoi / Math.max(1, value), 2)}</span>
        </div>
        {annualDebtService > 0 && (
          <>
            <div className="kv">
              <span className="k">Debt service</span>
              <span className="v bad">{money(annualDebtService)}/yr</span>
            </div>
            <div className="kv">
              <span className="k">
                DSCR
                <br />
                <span className="faint" style={{ fontSize: 11 }}>
                  lenders want {ECON.REFI.minDscr.toFixed(2)}x
                </span>
              </span>
              <span
                className={`v ${dscr(annualNoi, annualDebtService) >= ECON.REFI.minDscr ? 'good' : 'bad'}`}
              >
                {dscr(annualNoi, annualDebtService).toFixed(2)}x
              </span>
            </div>
          </>
        )}
        <div className="kv total">
          <span className="k">Monthly cash flow</span>
          <span className={`v ${monthlyCash >= 0 ? 'good' : 'bad'}`}>{money(monthlyCash)}</span>
        </div>
        {invested > 0 && (
          <div className="kv">
            <span className="k">Cash-on-cash</span>
            <span className="v">
              {percent(cashOnCash(annualNoi, annualDebtService, invested), 1)}
              <span className="faint"> on {money(invested)} in</span>
            </span>
          </div>
        )}

        {rental.turnovers > 0 && (
          <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
            {rental.turnovers} turnover{rental.turnovers === 1 ? '' : 's'} so far &mdash;{' '}
            {money(rental.rentCollected)} collected, {money(rental.opexPaid)} spent running it.
          </p>
        )}

        <label className="field" style={{ marginTop: 12 }}>
          <span className="label">
            {t ? 'Rent at next renewal' : 'Asking rent'}
          </span>
          <input
            type="number"
            step={25}
            value={draftRent ?? rental.askingRent}
            onChange={(e) => setDraftRent(Number(e.target.value))}
          />
        </label>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => act((s) => setAskingRent(s, property.id, draftRent ?? rental.askingRent))}
          >
            Update rent
          </button>
          {!t && (
            <button className="btn" onClick={() => act((s) => stopRenting(s, property.id))}>
              Stop letting
            </button>
          )}
        </div>

        {/* Refinance */}
        <div className="scope-group-label" style={{ marginTop: 18 }}>
          Cash-out refinance
        </div>
        <div className="kv">
          <span className="k">Capped by value ({percent(ECON.REFI.maxLtv, 0)} LTV)</span>
          <span className="v dim">{money(quote.maxByLtv)}</span>
        </div>
        <div className="kv">
          <span className="k">Capped by income (DSCR {ECON.REFI.minDscr.toFixed(2)}x)</span>
          <span className="v dim">{money(quote.maxByDscr)}</span>
        </div>
        <div className="kv total">
          <span className="k">
            Loan available
            <br />
            <span className="faint" style={{ fontSize: 11 }}>
              bound by {quote.binding === 'dscr' ? 'the income' : 'the value'}
            </span>
          </span>
          <span className="v">{money(quote.maxLoan)}</span>
        </div>
        {quote.payoff > 0 && (
          <div className="kv">
            <span className="k">Clears existing debt</span>
            <span className="v bad">{money(-quote.payoff)}</span>
          </div>
        )}
        <div className="kv">
          <span className="k">Closing costs</span>
          <span className="v bad">{money(-quote.closingCosts)}</span>
        </div>
        <div className="kv total">
          <span className="k">Cash back to you</span>
          <span className={`v ${quote.cashOut >= 0 ? 'good' : 'bad'}`}>{money(quote.cashOut)}</span>
        </div>
        <div className="kv">
          <span className="k">New payment</span>
          <span className="v">
            {money(quote.monthlyPayment)}/mo at {percent(quote.rate, 2)} over {ECON.REFI.termYears}{' '}
            years
          </span>
        </div>

        {!quote.eligible && (
          <div className="verdict thin" style={{ marginTop: 12 }}>
            <strong>Not yet</strong>
            {quote.reason}
          </div>
        )}
        {quote.eligible && tapped && (
          <div className="verdict thin" style={{ marginTop: 12 }}>
            <strong>Already tapped out</strong>
            You have pulled out everything this income supports. Going again returns nothing and
            costs another round of closing fees. To get more out, raise the rent or add value.
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <ConfirmButton
            className="btn primary"
            disabled={!quote.eligible || !t || tapped}
            buttonTitle={!t ? 'Lenders underwrite the income — get a tenant first' : undefined}
            label={`Refinance and take ${money(Math.max(0, quote.cashOut))} out`}
            title="Take this loan?"
            confirmLabel={`Take ${money(Math.max(0, quote.cashOut))} out`}
            body={
              <>
                <p style={{ marginTop: 0 }}>
                  This puts a 30-year loan on {property.address} and hands you the difference. The
                  cash is yours to redeploy; the payment is due every month whether the unit is let
                  or not.
                </p>
                <div className="kv">
                  <span className="k">New loan</span>
                  <span className="v">{money(quote.maxLoan)}</span>
                </div>
                <div className="kv">
                  <span className="k">Payment</span>
                  <span className="v bad">
                    {money(quote.monthlyPayment)}/mo at {percent(quote.rate, 2)}
                  </span>
                </div>
                <div className="kv total">
                  <span className="k">Cash to you</span>
                  <span className="v good">{money(quote.cashOut)}</span>
                </div>
                <div className="kv">
                  <span className="k">Monthly cash flow afterwards</span>
                  <span
                    className={`v ${annualNoi / 12 - quote.monthlyPayment >= 0 ? 'good' : 'bad'}`}
                  >
                    {money(annualNoi / 12 - quote.monthlyPayment)}
                  </span>
                </div>
                <div className="verdict thin" style={{ marginTop: 12 }}>
                  <strong>Coverage falls to {quote.dscrAtMax.toFixed(2)}&times;</strong>
                  That is the whole margin between the rent and the payment. One long vacancy, or a
                  tenant who leaves in a soft market, and this property starts costing you money
                  every month rather than making it.
                </div>
              </>
            }
            onConfirm={() => act((s) => refinance(s, property.id))}
          />
        </div>
        <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          Equity is not the same as borrowing capacity. When the income binds before the value
          does, the answer is more rent or a cheaper purchase &mdash; not more equity.
        </p>
      </div>
    </div>
  );
}
