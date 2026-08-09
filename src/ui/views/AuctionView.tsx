import { useState } from 'react';
import {
  ARCHETYPES_BY_ID,
  ECON,
  NEIGHBORHOODS_BY_ID,
  estimateArv,
  evictionCost,
  placeBid,
  quoteScope,
  withdrawBid,
  type AuctionLot,
  type Property,
} from '../../engine';
import { money, moneyShort, percent } from '../format';
import { useAction, useGame } from '../store';
import ConfirmButton from '../components/ConfirmButton';
import FirstTime from '../components/FirstTime';
import House from '../graphics/House';

/**
 * The courthouse steps.
 *
 * Deliberately a different screen from the market, because it is a different
 * trade. There is no comp picker, no inspection button, no seller to persuade
 * and no contingency to walk away under -- and the absence of all of that is
 * the lesson. What is left is one number: what is this worth to you when you
 * cannot see inside it.
 */
export default function AuctionView() {
  const state = useGame();
  if (!state) return null;

  const lots = state.auction.lots
    .map((lot) => ({
      lot,
      prop: state.auctionBlock.find((p) => p.id === lot.propertyId),
    }))
    .filter((x): x is { lot: AuctionLot; prop: Property } => !!x.prop)
    .sort((a, b) => a.lot.saleDay - b.lot.saleDay);

  return (
    <>
      <FirstTime id="first-auction" title="Different trade, different risks">
        <p>
          A trustee sale is not the retail market with a discount. You cannot inspect, you cannot
          finance, and the moment the hammer falls the house is yours with every problem it has.
          Roughly a third come with the previous owner still living in them.
        </p>
        <p>
          The opening bid is what the lender is owed, not what the house is worth &mdash; which is
          why the cheap-looking lots draw the biggest crowd. Leave a maximum and rivals bid against
          it; if you win you pay one increment over whoever stopped second, never your own
          maximum. So there is no reason to shade it.
        </p>
      </FirstTime>

      {lots.length === 0 ? (
        <div className="panel">
          <div className="panel-head">
            <h2>The block</h2>
          </div>
          <div className="empty">
            No lots posted. New notices go up every {ECON.AUCTION.refreshDays} days &mdash; advance
            the clock.
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {lots.map(({ lot, prop }) => (
            <LotCard key={lot.propertyId} lot={lot} prop={prop} />
          ))}
        </div>
      )}

      <p className="faint" style={{ fontSize: 12 }}>
        Every figure here is an estimate built from comps alone. Nobody has been inside, so the
        condition shown is what the exterior suggests and the defect list is empty because nothing
        has been looked for &mdash; not because there is nothing wrong.
      </p>
    </>
  );
}

function LotCard({ lot, prop }: { lot: AuctionLot; prop: Property }) {
  const state = useGame()!;
  const act = useAction();
  const [bid, setBid] = useState<number | null>(null);

  const daysLeft = lot.saleDay - state.day;
  const arv = estimateArv(prop, state.world, state.day, []);
  // Rebuilding a blind purchase: assume the median gut, because you cannot
  // know and pretending otherwise is how people lose money here.
  const quote = quoteScope(
    ['paint_interior', 'flooring_lvp', 'kitchen_refresh', 'bath_refresh', 'roof_replace'],
    prop,
    state.world,
    state.skills,
    state.reputation.contractors,
  );
  const eviction = lot.occupied ? evictionCost(prop, state.world, state.day) : 0;
  const current = bid ?? lot.myMaxBid ?? lot.openingBid;
  // A rough walk-away: what you could pay and still clear the rule's margin
  // after the work, the carry you cannot avoid, and getting possession.
  const ceiling = Math.max(
    0,
    Math.round(arv * ECON.RULE_OF_THUMB - quote.totalCost - eviction),
  );

  const heat =
    lot.rivalInterest > 0.6 ? 'bad' : lot.rivalInterest > 0.32 ? 'warn' : 'mute';
  const heatText =
    lot.rivalInterest > 0.6 ? 'crowded' : lot.rivalInterest > 0.32 ? 'watched' : 'quiet';

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{prop.address}</h2>
        <span className={`pill ${daysLeft <= 3 ? 'bad' : 'info'}`}>
          {daysLeft <= 0 ? 'selling today' : `${daysLeft}d to sale`}
        </span>
      </div>
      <House property={prop} className="house-hero" day={state.day} />
      <div className="panel-body">
        <div className="kv">
          <span className="k">Area</span>
          <span className="v">
            {NEIGHBORHOODS_BY_ID[prop.neighborhoodId]?.name} &middot;{' '}
            {ARCHETYPES_BY_ID[prop.archetypeId]?.name}
          </span>
        </div>
        <div className="kv">
          <span className="k">Size / built</span>
          <span className="v">
            {prop.sqft.toLocaleString()} sqft &middot; {prop.yearBuilt}
          </span>
        </div>
        <div className="kv">
          <span className="k">
            Opening bid
            <br />
            <span className="faint" style={{ fontSize: 11 }}>
              what the lender is owed, not what it is worth
            </span>
          </span>
          <span className="v">{money(lot.openingBid)}</span>
        </div>
        <div className="kv">
          <span className="k">Estimated value repaired</span>
          <span className="v">{money(arv)}</span>
        </div>
        <div className="kv">
          <span className="k">
            Assumed rebuild
            <br />
            <span className="faint" style={{ fontSize: 11 }}>
              you cannot inspect, so budget for the median gut
            </span>
          </span>
          <span className="v bad">{money(-quote.totalCost)}</span>
        </div>
        {lot.occupied && (
          <div className="kv">
            <span className="k warn">
              Occupied
              <br />
              <span className="faint" style={{ fontSize: 11 }}>
                cash for keys, legal, and {ECON.AUCTION.evictionDays} days of carry before you can
                start
              </span>
            </span>
            <span className="v bad">{money(-eviction)}</span>
          </div>
        )}
        <div className="kv">
          <span className="k">Interest in the room</span>
          <span className={`pill ${heat}`}>{heatText}</span>
        </div>
        <div className="kv total">
          <span className="k">
            Walk-away number
            <br />
            <span className="faint" style={{ fontSize: 11 }}>
              {percent(ECON.RULE_OF_THUMB, 0)} of value, less the work and possession
            </span>
          </span>
          <span className={`v ${ceiling >= lot.openingBid ? 'good' : 'bad'}`}>
            {money(ceiling)}
          </span>
        </div>

        {ceiling < lot.openingBid && (
          <div className="verdict thin" style={{ marginTop: 12 }}>
            <strong>It opens above your maximum</strong>
            Even at the credit bid this does not clear the rule once the work and possession are
            paid for. Let the lender keep it.
          </div>
        )}

        <label className="field" style={{ marginTop: 14 }}>
          <span className="label">Your maximum</span>
          <input
            type="number"
            step={ECON.AUCTION.increment}
            value={current}
            onChange={(e) => setBid(Number(e.target.value))}
          />
        </label>

        {current > ceiling && ceiling > 0 && (
          <div className="verdict thin">
            <strong>Above your own walk-away</strong>
            {moneyShort(current - ceiling)} above the number you just worked out, on a house nobody
            has been inside.
          </div>
        )}

        <div className="btn-row">
          <ConfirmButton
            className="btn primary"
            disabled={current < lot.openingBid || current > state.cash}
            label={lot.myMaxBid === null ? 'Leave a bid' : `Change bid`}
            title="Bid on this lot?"
            confirmLabel={`Bid up to ${money(current)}`}
            body={
              <>
                <p style={{ marginTop: 0 }}>
                  If you win, {prop.address} is yours on day {lot.saleDay} for cash, sight unseen,
                  with whatever is wrong with it. There is no inspection contingency and no way
                  out.
                </p>
                <div className="kv">
                  <span className="k">Maximum</span>
                  <span className="v">{money(current)}</span>
                </div>
                <div className="kv">
                  <span className="k">Cash if you win at that price</span>
                  <span className={`v ${state.cash - current < quote.totalCost ? 'bad' : ''}`}>
                    {money(state.cash - current)}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Still needed for the work</span>
                  <span className="v bad">{money(-quote.totalCost)}</span>
                </div>
                {state.cash - current < quote.totalCost && (
                  <div className="verdict thin" style={{ marginTop: 12 }}>
                    <strong>Winning would leave you unable to rebuild it</strong>
                    A house you cannot renovate is a house you cannot sell, and the carry runs
                    either way.
                  </div>
                )}
                {lot.occupied && (
                  <div className="verdict thin" style={{ marginTop: 12 }}>
                    <strong>Somebody lives here</strong>
                    {money(eviction)} and {ECON.AUCTION.evictionDays} days before a crew can start
                    &mdash; and you are carrying it the whole time.
                  </div>
                )}
              </>
            }
            onConfirm={() => act((s) => placeBid(s, prop.id, current))}
          />
          {lot.myMaxBid !== null && (
            <button className="btn" onClick={() => act((s) => withdrawBid(s, prop.id))}>
              Withdraw
            </button>
          )}
          {lot.myMaxBid !== null && (
            <span className="faint" style={{ fontSize: 12 }}>
              standing at {money(lot.myMaxBid)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
