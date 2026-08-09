import { useMemo, useState } from 'react';
import { NEIGHBORHOODS, arcIsVisible, type GameState } from '../../engine';
import { money, percent } from '../format';
import { SEQUENTIAL } from './Charts';

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

/** Map an index value onto the validated 5-step sequential ramp. */
function stepFor(index: number, lo: number, hi: number): string {
  if (hi - lo < 1e-6) return SEQUENTIAL[2];
  const t = (index - lo) / (hi - lo);
  const i = Math.max(0, Math.min(SEQUENTIAL.length - 1, Math.floor(t * SEQUENTIAL.length)));
  return SEQUENTIAL[i];
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
        <rect x="0" y="0" width="460" height="300" fill="#0b0e13" />

        {/* The river, which is why Riverside and Harbor Point are where they are. */}
        <path
          d="M-10,120 C60,140 90,190 84,300"
          stroke="#16293d"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M290,0 C300,40 330,60 460,70"
          stroke="#16293d"
          strokeWidth="20"
          fill="none"
          strokeLinecap="round"
        />

        {REGIONS.filter((r) => available.has(r.id)).map((r) => {
          const hood = NEIGHBORHOODS.find((n) => n.id === r.id)!;
          const idx = state.world.neighborhoodIndex[r.id] ?? 1;
          const isHover = hover === r.id;
          const owned = holdings[r.id] ?? 0;
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
                fill={stepFor(priceOf(r.id), lo, hi)}
                stroke={isHover ? '#e4e9f0' : '#0b0e13'}
                strokeWidth={isHover ? 2 : 2}
                opacity={isHover ? 1 : 0.92}
              />
              {/* Label sits on the fill, so it wears ink not the series colour. */}
              <text
                x={r.lx}
                y={r.ly}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="#0b1119"
                pointerEvents="none"
              >
                {hood.name}
              </text>
              <text
                x={r.lx}
                y={r.ly + 14}
                textAnchor="middle"
                fontSize="10.5"
                fill="#0b1119"
                opacity="0.75"
                pointerEvents="none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                ${hood.pricePerSqft}/sqft · {idx >= 1 ? '+' : ''}
                {((idx - 1) * 100).toFixed(1)}%
              </text>
              {owned > 0 && (
                <g pointerEvents="none">
                  <circle cx={r.lx} cy={r.ly - 18} r="9" fill="#0b0e13" opacity="0.75" />
                  <text
                    x={r.lx}
                    y={r.ly - 14.5}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#3ecf8e"
                  >
                    {owned}
                  </text>
                </g>
              )}
              {/* A visible arc is marked on the ground rather than only in the
                  log, because the whole value of noticing one is spatial. */}
              {arcs[r.id] && (
                <g pointerEvents="none">
                  <text
                    x={r.lx}
                    y={r.ly + 27}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={arcs[r.id] === 'gentrifying' ? '#0d4d2c' : '#5c1418'}
                  >
                    {arcs[r.id] === 'gentrifying' ? '▲ gentrifying' : '▼ declining'}
                  </text>
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
        <div style={{ display: 'flex', flex: 1, maxWidth: 200, height: 8, borderRadius: 4, overflow: 'hidden' }}>
          {SEQUENTIAL.map((c) => (
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
    </div>
  );
}
