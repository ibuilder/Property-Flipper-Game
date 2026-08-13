import { useMemo, useState } from 'react';
import {
  NEIGHBORHOODS,
  NEIGHBORHOODS_BY_ID,
  allTrends,
  arcIsVisible,
  describeTrend,
  type GameState,
} from '../../engine';
import { money, percent } from '../format';
import { RAMP } from './Charts';
import TrendSpark from './TrendSpark';

/**
 * A stylized map of the six areas, heat-coloured by current price index.
 *
 * Sequential encoding, not categorical: the thing being shown is magnitude
 * (how expensive an area has become), so it is one hue light-to-dark rather
 * than six competing colours. That also sidesteps the six-way colour-vision
 * problem a categorical map would have had.
 *
 * The shapes are hand-placed rather than geographic -- the town is fictional.
 * What they encode faithfully is adjacency and character: the river runs
 * through Riverside, the Millworks sits against the industrial edge, Harbor
 * Point is on the water.
 */

interface Region {
  id: string;
  /** Polygon in a 0 0 460 300 space. */
  points: string;
  /** Label anchor. */
  lx: number;
  ly: number;
}

const REGIONS: Region[] = [
  { id: 'harbor_point', points: '300,8 452,8 452,96 356,104 296,72', lx: 376, ly: 52 },
  { id: 'the_grid', points: '176,60 296,72 356,104 330,176 196,168', lx: 264, ly: 122 },
  { id: 'old_town', points: '58,44 176,60 196,168 96,180 46,124', lx: 122, ly: 116 },
  { id: 'riverside_flats', points: '8,132 46,124 96,180 88,262 8,254', lx: 52, ly: 200 },
  { id: 'maple_heights', points: '96,180 196,168 330,176 318,286 104,290', lx: 210, ly: 236 },
  { id: 'millworks', points: '330,176 452,96 452,286 318,286', lx: 388, ly: 210 },
];

/** Map a value onto the 8-step data ramp. Index is magnitude. */
function stepFor(index: number, lo: number, hi: number): number {
  if (hi - lo < 1e-6) return Math.floor(RAMP.length / 2);
  const t = (index - lo) / (hi - lo);
  return Math.max(0, Math.min(RAMP.length - 1, Math.floor(t * RAMP.length)));
}

/**
 * Labels sit on a paper plate, never straight on the parcel.
 *
 * The parcel beneath is the data layer and can be any step of the ramp, so
 * text painted directly on it is legible against some steps and not others.
 * Choosing ink by ramp step nearly worked and then did not: the step where
 * paper starts beating ink is not the same in both themes -- measured, light
 * mode fails at step 4 with 2.55:1 -- so any fixed crossover is wrong in one
 * theme or the other.
 *
 * A plate is the handoff's own answer and it removes the question entirely:
 * every label is text-on-background, which is checked for AA once and holds
 * everywhere.
 */
const PLATE = {
  fill: 'var(--color-bg)',
  stroke: 'var(--color-divider)',
} as const;

/** Rough advance width, enough to size a plate around a label. */
function plateWidth(...lines: [string, number][]): number {
  return Math.max(...lines.map(([text, px]) => text.length * px * 0.52)) + 12;
}

export default function NeighborhoodMap({
  state,
  onSelect,
}: {
  state: GameState;
  onSelect?: (neighborhoodId: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const available = useMemo(
    () => new Set(Object.keys(state.world.neighborhoodIndex)),
    [state.world.neighborhoodIndex],
  );

  /**
   * Shade by *effective price per square foot*, not by the index alone.
   *
   * Every index starts at exactly 1.000, so an index-only ramp renders the
   * whole map one flat colour on day one and only becomes informative much
   * later. Price level is the thing a buyer actually reads off a map, it
   * differs hugely from the first day ($78/sqft in the Millworks against $330
   * at Harbor Point), and it still moves with the cycle because the index is
   * folded into it.
   */
  const priceOf = (id: string) =>
    (NEIGHBORHOODS.find((n) => n.id === id)?.pricePerSqft ?? 100) *
    (state.world.neighborhoodIndex[id] ?? 1);

  const prices = REGIONS.filter((r) => available.has(r.id)).map((r) => priceOf(r.id));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);

  const holdings = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of state.portfolio) m[p.neighborhoodId] = (m[p.neighborhoodId] ?? 0) + 1;
    return m;
  }, [state.portfolio.length, state.portfolio.map((p) => p.id).join(',')]);

  // Only arcs that have become visible on the ground. An arc runs silently for
  // its first stretch, and showing it early would give away the one piece of
  // information the player is meant to be paying for.
  const arcs = useMemo(() => {
    const m: Record<string, 'gentrifying' | 'declining'> = {};
    for (const arc of state.world.arcs) {
      if (arcIsVisible(arc, state.day)) m[arc.neighborhoodId] = arc.kind;
    }
    return m;
  }, [state.world.arcs, state.day]);

  const active = hover ? NEIGHBORHOODS.find((n) => n.id === hover) : null;
  const activeIndex = hover ? (state.world.neighborhoodIndex[hover] ?? 1) : 0;

  return (
    <div>
      <svg
        viewBox="0 0 460 300"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6 }}
        role="img"
        aria-label="Map of the six neighborhoods, shaded by current price index"
      >
        <rect x="0" y="0" width="460" height="300" fill="var(--color-bg)" />

        {/* The river, which is why Riverside and Harbor Point are where they are. */}
        <path
          d="M-10,120 C60,140 90,190 84,300"
          stroke="var(--color-neutral-300)"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M290,0 C300,40 330,60 460,70"
          stroke="var(--color-neutral-300)"
          strokeWidth="20"
          fill="none"
          strokeLinecap="round"
        />

        {REGIONS.filter((r) => available.has(r.id)).map((r) => {
          const hood = NEIGHBORHOODS.find((n) => n.id === r.id)!;
          const idx = state.world.neighborhoodIndex[r.id] ?? 1;
          const isHover = hover === r.id;
          const owned = holdings[r.id] ?? 0;
          const step = stepFor(priceOf(r.id), lo, hi);
          const stats = `$${hood.pricePerSqft}/sqft · ${idx >= 1 ? '+' : ''}${(
            (idx - 1) *
            100
          ).toFixed(1)}%`;
          const pw = plateWidth([hood.name, 12], [stats, 10.5]);
          return (
            <g
              key={r.id}
              onMouseEnter={() => setHover(r.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(r.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${hood.name}, price index ${idx.toFixed(3)}${
                owned ? `, ${owned} owned` : ''
              }`}
              style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
            >
              <polygon
                points={r.points}
                fill={RAMP[step]}
                stroke={isHover ? 'var(--color-text)' : 'var(--color-bg)'}
                strokeWidth={isHover ? 2 : 2}
                opacity={isHover ? 1 : 0.92}
              />
              {/* On a plate, so the label is legible over any ramp step. */}
              <g pointerEvents="none">
                <rect
                  x={r.lx - pw / 2}
                  y={r.ly - 13}
                  width={pw}
                  height={31}
                  fill={PLATE.fill}
                  stroke={PLATE.stroke}
                  strokeWidth="1"
                />
                <text
                  x={r.lx}
                  y={r.ly}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--color-text)"
                >
                  {hood.name}
                </text>
                <text
                  x={r.lx}
                  y={r.ly + 13}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="var(--text-faint)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {stats}
                </text>
              </g>
              {owned > 0 && (
                <g pointerEvents="none">
                  <circle cx={r.lx} cy={r.ly - 18} r="9" fill="var(--color-bg)" opacity="0.85" />
                  <text
                    x={r.lx}
                    y={r.ly - 14.5}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="var(--good)"
                  >
                    {owned}
                  </text>
                </g>
              )}
              {/* A visible arc is marked on the ground rather than only in the
                  log, because the whole value of noticing one is spatial.

                  On a paper plate, per the handoff's rule for labels over a
                  data overlay: the parcel beneath can be any step of the ramp,
                  and a coloured word sitting straight on it is legible against
                  some of them and not others. */}
              {arcs[r.id] && (
                <g pointerEvents="none">
                  {(() => {
                    const up = arcs[r.id] === 'gentrifying';
                    const label = up ? '▲ gentrifying' : '▼ declining';
                    const w = label.length * 5.4 + 8;
                    return (
                      <>
                        <rect
                          x={r.lx - w / 2}
                          y={r.ly + 19}
                          width={w}
                          height={13}
                          fill="var(--color-bg)"
                          stroke="var(--color-divider)"
                          strokeWidth="0.5"
                        />
                        <text
                          x={r.lx}
                          y={r.ly + 28.5}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="700"
                          fill={up ? 'var(--good)' : 'var(--bad)'}
                        >
                          {label}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend: sequential ramps get a gradient strip with end labels. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 10,
          fontSize: 11,
          color: 'var(--text-faint)',
        }}
      >
        <span>Cheaper</span>
        {/* Square, and every step of the ramp the map can actually paint. */}
        <div style={{ display: 'flex', flex: 1, maxWidth: 220, height: 8, overflow: 'hidden' }}>
          {RAMP.map((c) => (
            <div key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <span>Pricier</span>
        <span style={{ marginLeft: 'auto' }}>
          {active ? (
            <>
              <strong style={{ color: 'var(--text)' }}>{active.name}</strong> · index{' '}
              {activeIndex.toFixed(3)} · tax {percent(active.taxRate, 2)} · typical{' '}
              {money(active.pricePerSqft)}/sqft
            </>
          ) : (
            'Hover an area for detail'
          )}
        </span>
      </div>

      <TrendStrip state={state} />
    </div>
  );
}

/**
 * Where money has been moving, over the last eight months.
 *
 * Below the map rather than on it: at the size these shapes are drawn, six
 * sparklines inside the polygons would be six illegible squiggles. The value
 * is in comparing them, and a column does that better than a map does.
 *
 * Ordered by divergence, so whatever is happening is at the ends.
 */
function TrendStrip({ state }: { state: GameState }) {
  const trends = useMemo(() => allTrends(state), [state.day, state.history.length]);
  if (trends.every((t) => t.points.length < 3)) return null;

  return (
    <div className="trend-strip">
      <div className="trend-strip-head">
        Price movement, last {trends[0]?.days ?? 0} days
        <span className="faint"> &middot; dashed line is the city average</span>
      </div>
      {trends.map((t) => {
        const note = describeTrend(t);
        return (
          <div key={t.neighborhoodId} className="trend-row">
            <span className="trend-name">{NEIGHBORHOODS_BY_ID[t.neighborhoodId]?.name}</span>
            <TrendSpark trend={t} />
            <span className={`trend-net ${t.netChange >= 0 ? 'good' : 'bad'}`}>
              {t.netChange >= 0 ? '+' : ''}
              {(t.netChange * 100).toFixed(0)}%
            </span>
            <span className="trend-note">{note ?? ''}</span>
          </div>
        );
      })}
      {/* Said once, under the whole strip, because it applies to every row and
          it is the thing that stops this being read as a tip sheet. */}
      <p className="trend-caveat">
        A neighborhood can run ahead of the pack for months with nothing behind it, and an
        announced arc can be slow to show up here. This is evidence, not a verdict.
      </p>
    </div>
  );
}
