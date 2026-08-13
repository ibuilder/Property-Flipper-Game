import type { NeighborhoodTrend } from '../../engine';
import { trendStrength } from '../../engine';

/**
 * A neighborhood's recent price movement, against the rest of the city.
 *
 * Two lines: this place, and the average of all of them. Drawing the pack is
 * the whole point — the absolute line alone is misleading, because market-wide
 * drift is larger than any arc and a declining neighborhood's own index still
 * climbs. What matters is the gap between the two, so the gap is shaded.
 *
 * Small enough to sit in a table row. It answers "has anything been happening
 * here" at a glance and nothing more; the number beside it carries the detail.
 */

const W = 64;
const H = 20;
const PAD = 2;

export default function TrendSpark({ trend }: { trend: NeighborhoodTrend }) {
  const pts = trend.points;
  if (pts.length < 3) return null;

  const all = pts.flatMap((p) => [p.value, p.market]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(1e-6, hi - lo);

  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);

  const line = (get: (i: number) => number) =>
    pts.map((_, i) => `${x(i).toFixed(1)},${y(get(i)).toFixed(1)}`).join(' ');

  const strength = trendStrength(trend);
  const ahead = trend.relativeChange > 0;
  // Only colour a divergence that is worth reading as one. A faint one is
  // drawn in the neutral text colour so it does not imply a signal.
  const tone =
    strength === 'clear' ? (ahead ? 'var(--good)' : 'var(--bad)') : 'var(--text-dim)';

  // The gap between the two lines: out along this neighborhood, back along the
  // pack. A polygon closes itself, so there is no need to restate the start.
  const band = [
    ...pts.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`),
    ...pts.map((p, i) => `${x(i).toFixed(1)},${y(p.market).toFixed(1)}`).reverse(),
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      role="img"
      aria-label={
        `Over the last ${trend.days} days this neighborhood moved ` +
        `${(trend.netChange * 100).toFixed(0)}%, which is ` +
        `${Math.abs(trend.relativeChange * 100).toFixed(0)}% ` +
        `${ahead ? 'ahead of' : 'behind'} the average of all neighborhoods.`
      }
    >
      <polygon points={band} fill={tone} fillOpacity="0.16" stroke="none" />
      {/* The pack, faint: a reference, not a subject. */}
      <polyline
        points={line((i) => pts[i].market)}
        fill="none"
        stroke="var(--text-faint)"
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <polyline points={line((i) => pts[i].value)} fill="none" stroke={tone} strokeWidth="1.5" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].value)} r="1.8" fill={tone} />
    </svg>
  );
}
