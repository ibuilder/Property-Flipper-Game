import { memo, useMemo, useState } from 'react';
import { NEIGHBORHOODS_BY_ID, type GameState, type Property } from '../../engine';
import { RAMP } from '../graphics/Charts';
import { DATA_VIEWS, DATA_VIEWS_BY_ID, type DataViewId, type Parcel } from './dataViews';
import {
  boardSeason,
  colorHouseDrawing,
  furnitureDrawing,
  houseDrawing,
  houseState,
  lotFurniture,
  scoutDrawing,
  scoutLot,
} from './art';
import { backdropAt, type BackdropHouse } from './backdrop';
import { DISTRICTS, STREETS, activeDistricts, buildParcels } from './layout';
import { GRID, TILE, ZOOM, boardExtent, project, tileSides, tileTop, toPoints } from './projection';

/**
 * The town, as a survey plat.
 *
 * The flat polygon map it replaces answered one question — how expensive is
 * this area — and answered it for six shapes. This answers four questions for
 * every lot, which is the difference between a picture of the town and an
 * instrument for reading it.
 *
 * Two layers, per the handoff. The ground is geometry computed from
 * `projection.ts`; the labels are a plain overlay positioned from the same
 * functions. Nothing is CSS-transformed, so nothing shears and there is no
 * second copy of the maths to drift.
 *
 * The extrusion is a graphical device rather than a third dimension: a lot
 * with something standing on it gets side faces one ramp step darker, which
 * reads as built without anyone having to draw a house.
 */

const EXTRUDE = 9;

export default function Board({
  state,
  onSelect,
}: {
  state: GameState;
  onSelect?: (property: Property) => void;
}) {
  const [view, setView] = useState<DataViewId>(() => {
    try {
      const saved = localStorage.getItem('flipper:boardView');
      return (DATA_VIEWS.some((v) => v.id === saved) ? saved : 'value') as DataViewId;
    } catch {
      return 'value';
    }
  });
  const [zoom, setZoom] = useState<keyof typeof ZOOM>('town');
  const [hover, setHover] = useState<string | null>(null);
  /*
   * Line or colour.
   *
   * Both sets are complete, and they are genuinely different pictures rather
   * than two finishes of one: the line set takes the theme and stays out of the
   * way of the data ramp, and the coloured set is a warmer, more literal town
   * that reads better at a glance and worse over a colour scale. There is no
   * right answer to impose, so it is the player's, and it persists.
   */
  const [style, setStyle] = useState<'line' | 'colour'>(() => {
    try {
      return localStorage.getItem('flipper:boardArt') === 'colour' ? 'colour' : 'line';
    } catch {
      return 'line';
    }
  });

  const parcels = useMemo(
    () => buildParcels(state),
    // Rebuilt when the board's contents change, not on every tick.
    [state.market.length, state.portfolio.length, state.day],
  );
  /*
   * Where Scout is standing, resolved once so the parcel loop only has to
   * compare a key rather than re-scan the board for every lot.
   */
  const scoutAt = useMemo(() => {
    const lot = scoutLot(parcels, (p) => Boolean((p as Property).ownership?.renovation));
    return lot ? `${lot.gx},${lot.gy}` : null;
  }, [parcels]);
  const season = boardSeason(state.day);

  const districts = activeDistricts(state);
  const active = DATA_VIEWS_BY_ID[view];
  const extent = boardExtent(EXTRUDE);
  const scale = ZOOM[zoom];

  const choose = (next: DataViewId) => {
    setView(next);
    try {
      localStorage.setItem('flipper:boardView', next);
    } catch {
      /* the choice simply will not persist */
    }
  };

  const chooseStyle = (next: 'line' | 'colour') => {
    setStyle(next);
    try {
      localStorage.setItem('flipper:boardArt', next);
    } catch {
      /* the choice simply will not persist */
    }
  };

  return (
    <div className="board">
      <div className="board-head">
        {/* Square segmented control, one solid active state, no radius. */}
        <div className="seg" role="group" aria-label="Data view">
          {DATA_VIEWS.map((v) => (
            <button
              key={v.id}
              className={`seg-opt${v.id === view ? ' on' : ''}`}
              onClick={() => choose(v.id)}
              aria-pressed={v.id === view}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="House art">
          {(['line', 'colour'] as const).map((s) => (
            <button
              key={s}
              className={`seg-opt${s === style ? ' on' : ''}`}
              onClick={() => chooseStyle(s)}
              aria-pressed={s === style}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Zoom">
          {(Object.keys(ZOOM) as (keyof typeof ZOOM)[]).map((z) => (
            <button
              key={z}
              className={`seg-opt${z === zoom ? ' on' : ''}`}
              onClick={() => setZoom(z)}
              aria-pressed={z === zoom}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <p className="board-question">{active.question}</p>

      <div className="board-frame">
        <svg
          viewBox={`0 0 ${extent.width} ${extent.height}`}
          style={{ width: `${scale * 100}%`, height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Map of the town, ${GRID} by ${GRID} lots, shaded by ${active.label}. ${active.question}`}
        >
          {/* Streets first: everything else sits on them. */}
          {STREETS.cols.map((gx) => (
            <polygon
              key={`c${gx}`}
              points={toPoints([
                project(gx, 0, extent.cx, extent.cy),
                project(gx + 1, 0, extent.cx, extent.cy),
                project(gx + 1, GRID, extent.cx, extent.cy),
                project(gx, GRID, extent.cx, extent.cy),
              ])}
              fill="var(--color-neutral-300)"
            />
          ))}
          {STREETS.rows.map((gy) => (
            <polygon
              key={`r${gy}`}
              points={toPoints([
                project(0, gy, extent.cx, extent.cy),
                project(GRID, gy, extent.cx, extent.cy),
                project(GRID, gy + 1, extent.cx, extent.cy),
                project(0, gy + 1, extent.cx, extent.cy),
              ])}
              fill="var(--color-neutral-300)"
            />
          ))}

          {/*
            Painter's order: back to front, or a lot's extrusion draws over the
            one behind it. In this projection depth increases with gx + gy.
          */}
          {[...parcels]
            .sort((a, b) => a.gx + a.gy - (b.gx + b.gy))
            .map((parcel) => {
              const step = active.step(parcel, state);
              const built = parcel.property !== null;
              /*
                Extrusion means "something stands here", so scenery earns it
                too -- a house on a flat lot beside houses on plinths reads as
                a rendering fault. It changes no data: the ramp still colours
                the top face by the view's own answer.
              */
              const standing = built || backdropAt(parcel.gx, parcel.gy, parcel.neighborhoodId) !== null;
              const isHover = hover === `${parcel.gx},${parcel.gy}`;
              const sideStep = Math.min(7, step + 3);
              const key = `${parcel.gx},${parcel.gy}`;

              return (
                <g
                  key={key}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => parcel.property && onSelect?.(parcel.property)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && parcel.property) {
                      e.preventDefault();
                      onSelect?.(parcel.property);
                    }
                  }}
                  tabIndex={parcel.property ? 0 : -1}
                  role={parcel.property ? 'button' : undefined}
                  aria-label={
                    parcel.property
                      ? `${parcel.property.address}, ${
                          NEIGHBORHOODS_BY_ID[parcel.neighborhoodId]?.name
                        }`
                      : undefined
                  }
                  style={{ cursor: parcel.property ? 'pointer' : 'default', outline: 'none' }}
                >
                  {standing &&
                    tileSides(parcel.gx, parcel.gy, EXTRUDE, extent.cx, extent.cy).map((face, i) => (
                      <polygon key={i} points={toPoints(face)} fill={RAMP[sideStep]} />
                    ))}
                  <polygon
                    points={toPoints(tileTop(parcel.gx, parcel.gy, extent.cx, extent.cy))}
                    fill={RAMP[step]}
                    stroke={isHover ? 'var(--color-text)' : 'var(--color-bg)'}
                    strokeWidth={isHover ? 1.5 : 0.6}
                  />

                  {/*
                    The rest of the town. Scenery on lots the game does not
                    model, drawn first and dimmed, so a real listing is always
                    the sharpest thing on its block.
                  */}
                  {!built && (
                    <Backdrop
                      gx={parcel.gx}
                      gy={parcel.gy}
                      neighborhoodId={parcel.neighborhoodId}
                      cx={extent.cx}
                      cy={extent.cy}
                      style={style}
                      season={season}
                    />
                  )}
                  {/*
                    Furniture before the house, so a sign in the drive is
                    overlapped by the building rather than pasted over it.
                  */}
                  <Furniture parcel={parcel} extent={extent} style={style} />
                  {/* Drawn after the lot top so they stand on it. */}
                  {built && (
                    <House
                      parcel={parcel}
                      extent={extent}
                      style={style}
                      season={boardSeason(state.day)}
                    />
                  )}
                  {/*
                    Scout inside his own lot's group, drawn after that lot's
                    house so he stands in front of it, and before every lot
                    nearer the camera so they can occlude him. Drawing him
                    globally last put him on top of houses he is standing
                    behind.
                  */}
                  {scoutAt === key && (
                    <ScoutOnSite parcel={parcel} state={state} extent={extent} style={style} />
                  )}
                </g>
              );
            })}

        </svg>

        {/*
          The overlay. Positioned with the same projection, in its own
          untransformed layer, so district plates and pins never shear.
        */}
        <div className="board-overlay" style={{ transform: `scale(${scale})` }}>
          {districts.map((d) => {
            const centre = project(
              d.gx + d.w / 2,
              d.gy + d.h / 2,
              extent.cx,
              extent.cy - EXTRUDE,
            );
            const hood = NEIGHBORHOODS_BY_ID[d.id];
            return (
              <div
                key={d.id}
                className="board-plate"
                style={{
                  left: `${(centre.x / extent.width) * 100}%`,
                  top: `${(centre.y / extent.height) * 100}%`,
                }}
              >
                {hood?.name}
              </div>
            );
          })}
        </div>
      </div>

      <BoardLegend view={view} />
    </div>
  );
}

/**
 * Scout, on the job that is running.
 *
 * One dog, on the lot with a clock on it. Anywhere else he would be decoration,
 * and a figure on every lot is a kennel rather than a town.
 */
function ScoutOnSite({
  parcel,
  state,
  extent,
  style,
}: {
  parcel: Parcel;
  state: GameState;
  extent: { cx: number; cy: number };
  style: 'line' | 'colour';
}) {
  const d = scoutDrawing(parcel.gx, parcel.gy, 'digging', state.day, style, extent.cx, extent.cy);
  if (!d) return null;
  return (
    <g
      className="lot-scout"
      pointerEvents="none"
      transform={d.transform}
      dangerouslySetInnerHTML={{ __html: d.body }}
    />
  );
}

/**
 * A house on a lot the game does not model.
 *
 * Inert by construction: no pointer events, no focus, no label. Dimmed rather
 * than restyled -- the moment scenery gets its own visual language it starts to
 * look like it means something, and the one thing it must never look like is a
 * lot you can buy.
 *
 * Drawn out in full, and memoised rather than deduplicated.
 *
 * The obvious optimisation is to define each distinct picture once in `<defs>`
 * and instance it with `<use>`, since a hundred lots share about thirty
 * drawings. It does cut the node count -- 13,805 to 5,627 on the six-district
 * board -- and it measured about six times *worse* on forced layout, because
 * every `<use>` instantiates its own shadow tree. So the duplication stays.
 *
 * What actually mattered was not drawing this twice. The scenery depends on the
 * lot, the style and the season and on nothing else -- not the data view, not
 * the hover -- so with primitive props and `memo` around it, switching view or
 * moving the mouse skips all hundred houses instead of re-parsing 800KB of
 * markup. Measured: the first paint costs 576ms, every view switch after it
 * costs under a millisecond.
 */
const Backdrop = memo(function Backdrop({
  gx,
  gy,
  neighborhoodId,
  cx,
  cy,
  style,
  season,
}: {
  gx: number;
  gy: number;
  neighborhoodId: string;
  cx: number;
  cy: number;
  style: 'line' | 'colour';
  season: string | null;
}) {
  const house = backdropAt(gx, gy, neighborhoodId);
  if (!house) return null;

  if (style === 'colour') {
    const c = colorHouseDrawing(gx, gy, house.archetypeId, house.state, cx, cy, season);
    if (!c) return null;
    return (
      <g
        className="lot-backdrop"
        pointerEvents="none"
        opacity={0.62}
        transform={c.transform}
        dangerouslySetInnerHTML={{ __html: c.body }}
      />
    );
  }

  const d = houseDrawing(gx, gy, house.archetypeId, house.state, cx, cy);
  return (
    <g
      className="lot-backdrop"
      pointerEvents="none"
      opacity={0.42}
      transform={d.transform}
      fill="none"
      strokeLinejoin="round"
    >
      {d.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={i < d.baseCount ? 'var(--color-text)' : 'var(--color-accent-ink)'}
          strokeWidth={d.strokeWidth(p.w)}
        />
      ))}
    </g>
  );
});

/** Whatever stands on the lot besides the house. */
function Furniture({
  parcel,
  extent,
  style,
}: {
  parcel: Parcel;
  extent: { cx: number; cy: number };
  style: 'line' | 'colour';
}) {
  /*
   * A tree goes where nothing else does. Before the backdrop existed every
   * open lot was a candidate; now the open lots are the ones the town did not
   * build on, which is exactly where a tree belongs.
   */
  const occupied = !parcel.property && backdropAt(parcel.gx, parcel.gy, parcel.neighborhoodId);
  const pieces = occupied ? [] : lotFurniture(parcel.gx, parcel.gy, parcel.property);
  const f = furnitureDrawing(parcel.gx, parcel.gy, pieces, style, extent.cx, extent.cy);
  if (!f) return null;
  return (
    <g
      className="lot-furniture"
      pointerEvents="none"
      dangerouslySetInnerHTML={{ __html: f.body }}
    />
  );
}

/**
 * A house on a lot.
 *
 * Ink only, no fill, so it reads over any step of the data ramp beneath it --
 * the same problem the labels have, solved the same way. Everything about how
 * the drawing meets the ground lives in `art.ts`; this only decides the colour
 * of the ink.
 *
 * The overlay is drawn in the accent rather than the text colour. It is the
 * half of the picture that changes -- scaffolding, a board in the drive,
 * boarded windows -- and holding it apart from the building is what lets the
 * player read the state of a lot at town zoom without reading the house.
 */
function House({
  parcel,
  extent,
  style,
  season,
}: {
  parcel: Parcel;
  extent: { cx: number; cy: number };
  style: 'line' | 'colour';
  season: string | null;
}) {
  const prop = parcel.property!;
  const state = houseState(prop);

  if (style === 'colour') {
    const c = colorHouseDrawing(
      parcel.gx,
      parcel.gy,
      prop.archetypeId,
      state,
      extent.cx,
      extent.cy,
      season,
    );
    if (c) {
      return (
        <g
          className="lot-house"
          pointerEvents="none"
          transform={c.transform}
          dangerouslySetInnerHTML={{ __html: c.body }}
        />
      );
    }
  }

  /*
   * `extent.cy`, not `extent.cy - EXTRUDE`. A built lot is drawn as a plateau:
   * the top face sits at `cy` and the extrusion hangs *below* it. Subtracting
   * the height, which this did while the houses were abstract enough to hide
   * it, lifts the building a full storey off the ground it is standing on.
   */
  const d = houseDrawing(parcel.gx, parcel.gy, prop.archetypeId, state, extent.cx, extent.cy);

  return (
    <g className="lot-house" pointerEvents="none" transform={d.transform} fill="none" strokeLinejoin="round">
      {d.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={i < d.baseCount ? 'var(--color-text)' : 'var(--color-accent-ink)'}
          strokeWidth={d.strokeWidth(p.w)}
        />
      ))}
    </g>
  );
}

/**
 * One ramp, labelled by what it means in this view.
 *
 * The same eight steps carry every quantity on the board, so the legend has to
 * say what they currently stand for or the colour is decoration again.
 */
function BoardLegend({ view }: { view: DataViewId }) {
  const ends: Record<DataViewId, [string, string]> = {
    value: ['cheaper', 'pricier'],
    rehab: ['sound', 'needs everything'],
    rival: ['ignored', 'contested'],
    mine: ['untouched', 'my block'],
  };
  const [lo, hi] = ends[view];
  return (
    <div className="board-legend">
      <span>{lo}</span>
      <div className="board-ramp">
        {RAMP.map((c) => (
          <div key={c} style={{ flex: 1, background: c }} />
        ))}
      </div>
      <span>{hi}</span>
    </div>
  );
}
