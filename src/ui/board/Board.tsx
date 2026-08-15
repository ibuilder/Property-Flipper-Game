import { useMemo, useState } from 'react';
import { NEIGHBORHOODS_BY_ID, type GameState, type Property } from '../../engine';
import { RAMP } from '../graphics/Charts';
import { DATA_VIEWS, DATA_VIEWS_BY_ID, type DataViewId, type Parcel } from './dataViews';
import { houseDrawing, houseState } from './art';
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

  const parcels = useMemo(
    () => buildParcels(state),
    // Rebuilt when the board's contents change, not on every tick.
    [state.market.length, state.portfolio.length, state.day],
  );
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
                  {built &&
                    tileSides(parcel.gx, parcel.gy, EXTRUDE, extent.cx, extent.cy).map((face, i) => (
                      <polygon key={i} points={toPoints(face)} fill={RAMP[sideStep]} />
                    ))}
                  <polygon
                    points={toPoints(tileTop(parcel.gx, parcel.gy, extent.cx, extent.cy))}
                    fill={RAMP[step]}
                    stroke={isHover ? 'var(--color-text)' : 'var(--color-bg)'}
                    strokeWidth={isHover ? 1.5 : 0.6}
                  />

                  {/* Drawn after the lot top so they stand on it. */}
                  {built && <House parcel={parcel} extent={extent} />}
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
function House({ parcel, extent }: { parcel: Parcel; extent: { cx: number; cy: number } }) {
  const prop = parcel.property!;
  const state = houseState(prop);
  /*
   * `extent.cy`, not `extent.cy - EXTRUDE`. A built lot is drawn as a plateau:
   * the top face sits at `cy` and the extrusion hangs *below* it. Subtracting
   * the height, which this did while the houses were abstract enough to hide
   * it, lifts the building a full storey off the ground it is standing on.
   */
  const d = houseDrawing(parcel.gx, parcel.gy, prop.archetypeId, state, extent.cx, extent.cy);
  // Everything past the base drawing is the overlay, and is inked differently.
  const baseCount = houseDrawing(parcel.gx, parcel.gy, prop.archetypeId, null).paths.length;

  return (
    <g pointerEvents="none" transform={d.transform} fill="none" strokeLinejoin="round">
      {d.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={i < baseCount ? 'var(--color-text)' : 'var(--color-accent-ink)'}
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
