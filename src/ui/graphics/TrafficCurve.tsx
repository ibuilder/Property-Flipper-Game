import type { TrafficPoint } from '../../engine';
import { money } from '../format';

/**
 * What price does to traffic.
 *
 * Days-on-market has always been a number the player reads after the fact. The
 * shape is the thing that teaches: interest falls off *exponentially* above
 * true value and only saturates gently below it, so the cost of optimism is
 * not linear in the price. Six per cent of hope is bought with two months of
 * carry, and no single figure makes that land.
 *
 * A histogram rather than a line, because the player is choosing among
 * discrete prices rather than reading a continuous function -- and because the
 * bar they are standing on can be solid while the rest stay quiet, which is
 * the whole comparison in one mark.
 *
 * Sampled from the engine's own arrival-rate function. A chart that drew its
 * own curve would look authoritative and be wrong, which is worse than not
 * drawing one.
 */

const W = 520;
const H = 168;
const PAD = { top: 14, right: 12, bottom: 30, left: 40 };

export default function TrafficCurve({
  points,
  current,
}: {
  points: TrafficPoint[];
  /** The multiple the player has actually chosen. */
  current: number;
}) {
  if (points.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / points.length;

  const finite = points.filter((p) => Number.isFinite(p.expectedDays));
  const worst = Math.max(1, ...finite.map((p) => p.expectedDays));

  // The bar the player is standing on: nearest sample to their price.
  const activeIndex = points.reduce(
    (best, p, i) =>
      Math.abs(p.multiple - current) < Math.abs(points[best].multiple - current) ? i : best,
    0,
  );
  const active = points[activeIndex];

  return (
    <div className="traffic">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={
          `Days to an offer against list price. At ${Math.round(current * 100)}% of value the ` +
          `wait is about ${active.expectedDays} days. Pricing above value costs time steeply: ` +
          `the bars climb exponentially once you pass 100%.`
        }
      >
        {points.map((p, i) => {
          const days = Number.isFinite(p.expectedDays) ? p.expectedDays : worst;
          const h = Math.max(2, (days / worst) * plotH);
          const x = PAD.left + i * slot;
          const isActive = i === activeIndex;
          return (
            <g key={p.multiple}>
              <rect
                x={x + 1}
                y={PAD.top + plotH - h}
                width={slot - 2}
                height={h}
                fill={isActive ? 'var(--color-accent-solid)' : 'var(--color-accent-200)'}
              />
              {/* Only the ends and the chosen bar are labelled: fourteen
                  numbers along an axis is a table, not a chart. */}
              {(isActive || i === 0 || i === points.length - 1) && (
                <text
                  x={x + slot / 2}
                  y={H - 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={isActive ? 'var(--color-accent-ink)' : 'var(--text-faint)'}
                >
                  {Math.round(p.multiple * 100)}%
                </text>
              )}
            </g>
          );
        })}

        {/* True value: the line the exponential turns at. */}
        {(() => {
          const i = points.findIndex((p) => p.multiple >= 1);
          if (i <= 0) return null;
          const x = PAD.left + i * slot;
          return (
            <g>
              <line
                x1={x}
                x2={x}
                y1={PAD.top - 6}
                y2={PAD.top + plotH}
                stroke="var(--text-faint)"
                strokeDasharray="3 3"
              />
              <text x={x + 4} y={PAD.top - 1} fontSize="9" fill="var(--text-faint)">
                what it is worth
              </text>
            </g>
          );
        })()}

        <text
          x={PAD.left - 6}
          y={PAD.top + 8}
          textAnchor="end"
          fontSize="9.5"
          fill="var(--text-faint)"
        >
          slow
        </text>
        <text
          x={PAD.left - 6}
          y={PAD.top + plotH}
          textAnchor="end"
          fontSize="9.5"
          fill="var(--text-faint)"
        >
          fast
        </text>
        <text
          x={PAD.left + plotW / 2}
          y={H - 3}
          textAnchor="middle"
          fontSize="9.5"
          fill="var(--text-faint)"
        >
          list price, as a share of what it is worth
        </text>
      </svg>

      <p className="traffic-read">
        At {money(active.listPrice)} you wait about <strong>{active.expectedDays} days</strong> for
        a first offer &mdash; and that is an average, so half of all sales take longer.
      </p>
    </div>
  );
}
