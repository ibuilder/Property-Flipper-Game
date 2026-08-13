import { useMemo, useState } from 'react';
import {
  NEIGHBORHOODS_BY_ID,
  ARCHETYPES_BY_ID,
  ECON,
  analyzeDeal,
  canAffordAtAll,
  estimateArv,
  minimumCashToBuy,
  type GameState,
  toggleWatch,
  type Property,
} from '../../engine';
import { conditionLabel, money, moneyShort, percent } from '../format';
import { useAction, useGame, useVersion } from '../store';
import PropertyModal from './PropertyModal';
import ClickableRow from '../components/ClickableRow';
import FirstTime from '../components/FirstTime';
import SortableTh from '../components/SortableTh';
import NeighborhoodMap from '../graphics/NeighborhoodMap';
import House from '../graphics/House';

type SortKey =
  | 'address'
  | 'area'
  | 'type'
  | 'sqft'
  | 'built'
  | 'condition'
  | 'ask'
  | 'estimate'
  | 'spread'
  | 'dom'
  | 'interest';

/** Columns where the interesting end is the large one, so sort there first. */
const DESCENDING_FIRST: ReadonlySet<SortKey> = new Set(['sqft', 'spread', 'dom', 'interest', 'built']);

/**
 * The scope the screening filter assumes.
 *
 * A maximum offer is only defined relative to a scope, and the screen cannot
 * know what you intend to do to the house. It assumes the cheapest plausible
 * cosmetic refresh -- the same three items the offer screen starts you with --
 * which makes it optimistic about anything needing systems work.
 */
const SCREEN_SCOPE = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];

/**
 * How much of the asking price a maximum offer covers.
 *
 * Almost nothing clears a maximum offer at the asking price -- across 400
 * day-one listings, four did. That is not a flaw in the model, it is the
 * business: the margin comes from what you negotiate off the ask and from
 * listings that go stale. So the useful screening question is not "does this
 * work today" but "how big a discount would this need", and a house needing
 * 40% off is not worth the click.
 */
function screenRatio(prop: Property, state: GameState): number {
  const ask = prop.listing?.askPrice ?? 0;
  if (ask <= 0) return 0;
  const arv = estimateArv(prop, state.world, state.day, SCREEN_SCOPE);
  const a = analyzeDeal(prop, state.world, state.day, arv, SCREEN_SCOPE, state.skills, {});
  return Math.min(a.mao70, a.maoDetailed) / ask;
}

/**
 * Discount threshold for "within reach".
 *
 * Calibrated against the hidden seller reserves: it hides 60% of listings and
 * has never yet hidden one that was actually workable. Loose on purpose -- a
 * screen that occasionally wastes a click is far better than one that buries
 * the deal.
 */
const WITHIN_REACH = 0.75;

export default function MarketView() {
  const state = useGame();
  const version = useVersion();
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('ask');
  const [descending, setDescending] = useState(false);
  const [hood, setHood] = useState<string>('all');
  const [onlyWorkable, setOnlyWorkable] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);

  const onSort = (key: SortKey) => {
    if (key === sort) {
      setDescending((d) => !d);
    } else {
      setSort(key);
      setDescending(DESCENDING_FIRST.has(key));
    }
  };

  const rows = useMemo(() => {
    if (!state) return [];
    let list = state.market.filter((p) => p.listing);
    if (hood !== 'all') list = list.filter((p) => p.neighborhoodId === hood);
    if (onlyWorkable) {
      // Reach is two separate questions and the filter has to ask both. A
      // listing can be perfectly priced and still be one you could never fund,
      // and the second case used to be invisible until the offer was rejected.
      list = list.filter(
        (p) =>
          screenRatio(p, state) >= WITHIN_REACH &&
          canAffordAtAll(p.listing!.askPrice, state.cash),
      );
    }

    const dir = descending ? -1 : 1;
    const by = (a: Property, b: Property): number => {
      switch (sort) {
        case 'address':
          return a.address.localeCompare(b.address);
        case 'area':
          return (NEIGHBORHOODS_BY_ID[a.neighborhoodId]?.name ?? '').localeCompare(
            NEIGHBORHOODS_BY_ID[b.neighborhoodId]?.name ?? '',
          );
        case 'type':
          return (ARCHETYPES_BY_ID[a.archetypeId]?.name ?? '').localeCompare(
            ARCHETYPES_BY_ID[b.archetypeId]?.name ?? '',
          );
        case 'condition':
          return a.condition - b.condition;
        case 'sqft':
          return a.sqft - b.sqft;
        case 'built':
          return a.yearBuilt - b.yearBuilt;
        case 'estimate':
          return a.appraisal.point - b.appraisal.point;
        case 'spread':
          return (
            a.appraisal.point - (a.listing?.askPrice ?? 0) -
            (b.appraisal.point - (b.listing?.askPrice ?? 0))
          );
        case 'dom':
          return (a.listing?.daysOnMarket ?? 0) - (b.listing?.daysOnMarket ?? 0);
        case 'interest':
          return (a.listing?.competition ?? 0) - (b.listing?.competition ?? 0);
        default:
          return (a.listing?.askPrice ?? 0) - (b.listing?.askPrice ?? 0);
      }
    };
    return [...list].sort((a, b) => by(a, b) * dir);
  }, [version, state?.market, sort, descending, hood, onlyWorkable, state?.day]);

  if (!state) return null;
  const active = state.market.find((p) => p.id === selected) ?? null;
  const hoods = [...new Set(state.market.map((p) => p.neighborhoodId))];

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>The town</h2>
          <button className="btn small" onClick={() => setMapOpen((v) => !v)}>
            {mapOpen ? 'Hide map' : 'Show map'}
          </button>
        </div>
        {mapOpen && (
          <div className="panel-body">
            <NeighborhoodMap
              state={state}
              onSelect={(id) => setHood((h) => (h === id ? 'all' : id))}
            />
          </div>
        )}
      </div>

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
            <button
              className={`btn small${onlyWorkable ? ' primary' : ''}`}
              onClick={() => setOnlyWorkable((v) => !v)}
              title={`Hide listings that would need more than a ${Math.round(
                (1 - WITHIN_REACH) * 100,
              )}% discount off asking before the numbers could work`}
            >
              {onlyWorkable ? '✓ ' : ''}Within reach
            </button>
          </div>
        </div>
        <div className="panel-body" style={{ paddingBottom: 0 }}>
          <FirstTime id="first-market" title="Start here">
            <p>
              Open a listing and run the numbers before you do anything else. Nothing on this
              board works at its asking price &mdash; the margin comes out of what you negotiate
              off it, and out of listings that have sat long enough for the seller to get
              realistic.
            </p>
            <p>
              Sort by any column, and use <strong>within reach</strong> to hide the ones that
              would need an implausible discount. Days on market is the most useful column here:
              a listing at 60 days has a more flexible seller than the same house at 5.
            </p>
          </FirstTime>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th aria-label="Preview"></th>
                  {(
                    [
                      ['address', 'Address', 'left'],
                      ['area', 'Area', 'left'],
                      ['type', 'Type', 'left'],
                      ['sqft', 'Sqft', 'right'],
                      ['built', 'Built', 'right'],
                      ['condition', 'Condition', 'left'],
                      ['ask', 'Asking', 'right'],
                      ['estimate', 'Est. as-is', 'right'],
                      ['spread', 'Spread', 'right'],
                      ['dom', 'DOM', 'right'],
                      ['interest', 'Interest', 'left'],
                    ] as [SortKey, string, 'left' | 'right'][]
                  ).map(([key, label, align]) => (
                    <SortableTh
                      key={key}
                      id={key}
                      label={label}
                      align={align}
                      active={sort}
                      descending={descending}
                      onSort={onSort}
                    />
                  ))}
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
          {rows.length === 0 && (
            <div className="empty">
              {onlyWorkable
                ? 'Nothing on the board is close enough to be worth underwriting today. Advance the clock — listings that sit get cheaper, and new ones arrive.'
                : 'No listings match that filter.'}
            </div>
          )}
        </div>
      </div>

      <p className="faint" style={{ fontSize: 12 }}>
        The asking price is what the seller wants. The estimate is what your comps suggest it is
        worth as-is, and it carries real error &mdash; open a listing to see the confidence band and
        run the numbers before you offer.
        {onlyWorkable && (
          <>
            {' '}
            <strong>Within reach</strong> is a screen, not an answer. Almost nothing works at the
            asking price &mdash; the margin comes out of what you negotiate off it, so this hides
            only the listings that would need more than a{' '}
            {Math.round((1 - WITHIN_REACH) * 100)}% discount before the arithmetic could ever
            close. It assumes a cosmetic refresh and nothing more, which makes it optimistic about
            any house that needs a roof or a furnace.
          </>
        )}
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
  const state = useGame()!;
  const act = useAction();
  const watched = state.watched.includes(prop.id);
  const cond = conditionLabel(prop.condition);
  const ask = prop.listing?.askPrice ?? 0;
  const est = prop.appraisal.point;
  const spread = est - ask;

  // Marked on the row rather than discovered at the offer. Borrowing the
  // maximum is the cheapest way in, so if that still exceeds your cash there
  // is no route to this house at all.
  const minCash = minimumCashToBuy(ask);
  const unaffordable = state.cash < minCash;
  const affordTitle = `Even at ${percent(ECON.MAX_LTV, 0)} leverage, closing needs ${money(
    minCash,
  )} and you have ${money(state.cash)}.`;

  return (
    <ClickableRow
      onActivate={onClick}
      selected={selected}
      label={`${prop.address}, asking ${money(ask)}`}
    >
      <td style={{ padding: '4px 8px' }}>
        <House property={prop} className="house-thumb" />
      </td>
      <td style={{ fontWeight: 500 }}>
        {/* A star, and nothing more. The digest already counted the listings
            that went to other buyers; this is what tells it which one you
            cared about. Stops propagation so following a listing is not also
            a click into it. */}
        <button
          className={`watch-star${watched ? ' on' : ''}`}
          aria-pressed={watched}
          title={watched ? 'Watching — you will be told if it goes' : 'Watch this listing'}
          onClick={(e) => {
            e.stopPropagation();
            act((sx) => toggleWatch(sx, prop.id));
          }}
        >
          {watched ? '★' : '☆'}
        </button>
        {prop.address}
      </td>
      <td className="dim">{NEIGHBORHOODS_BY_ID[prop.neighborhoodId]?.name}</td>
      <td className="dim">{ARCHETYPES_BY_ID[prop.archetypeId]?.name}</td>
      <td className="right num">{prop.sqft.toLocaleString()}</td>
      <td className="right num dim">{prop.yearBuilt}</td>
      <td>
        <span className={`pill ${cond.tone}`}>{cond.text}</span>
      </td>
      <td className={`right num ${unaffordable ? 'faint' : ''}`}>
        {money(ask)}
        {unaffordable && (
          <>
            <br />
            <span className="pill mute" style={{ fontSize: 10 }} title={affordTitle}>
              beyond your cash
            </span>
          </>
        )}
      </td>
      <td className="right num dim">{moneyShort(est)}</td>
      <td className={`right num ${spread > 0 ? 'good' : 'bad'}`}>
        {spread > 0 ? '+' : ''}
        {moneyShort(spread)}
      </td>
      <td className="right num dim">{prop.listing?.daysOnMarket ?? 0}</td>
      <td>
        {/* Rival attention. A contested listing will not wait for you. */}
        {(() => {
          const c = prop.listing?.competition ?? 0;
          if (c > 0.55) return <span className="pill bad">hot</span>;
          if (c > 0.3) return <span className="pill warn">watched</span>;
          return <span className="faint" style={{ fontSize: 12 }}>quiet</span>;
        })()}
      </td>
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


