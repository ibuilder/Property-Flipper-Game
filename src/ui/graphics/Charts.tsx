import { useId, useMemo, useState } from 'react';

/**
 * Charts.
 *
 * Every colour here is a token now, so the charts follow the theme rather than
 * being pinned to one ground. The sequential ramp is the Industry data ramp
 * from the 3.0 handoff, which is defined per theme and always runs away from
 * the active ground.
 *
 * What that costs, stated plainly: the previous literals were not eyeballed,
 * they were run through the data-viz validator against this app's actual
 * chart surface (#0b0e13) -- lightness band, chroma and contrast all passing,
 * with the green/red pair sitting in the 6-8 CVD band and therefore carrying
 * secondary encoding (the waterfall labels every bar and encodes sign as
 * direction). The dark theme still resolves to values close to those. **The
 * light theme's chart colours have not been through that validation.** The
 * secondary encoding is unchanged and does the heavy lifting either way, but
 * a validator pass over the light ground is outstanding work, not a thing
 * that has been done and is being reported.
 *
 * Deliberately one y-axis per chart. Market index and interest rate are
 * different scales, so they are two charts rather than one dual-axis chart.
 */

export const SERIES = {
  primary: 'var(--color-accent)',
  positive: 'var(--good)',
  negative: 'var(--bad)',
} as const;

/**
 * The Industry data ramp: index is magnitude. Defined per theme in
 * styles.css so it runs away from whichever ground is active -- pale-to-deep
 * on paper, deep-to-pale on the dark drawing.
 */
export const RAMP = [
  'var(--ramp-0)',
  'var(--ramp-1)',
  'var(--ramp-2)',
  'var(--ramp-3)',
  'var(--ramp-4)',
  'var(--ramp-5)',
  'var(--ramp-6)',
  'var(--ramp-7)',
] as const;

/** The five-step subset the map was built against. */
export const SEQUENTIAL = [RAMP[1], RAMP[3], RAMP[4], RAMP[5], RAMP[6]] as const;

const GRID = 'var(--color-neutral-200)';
const AXIS = 'var(--color-neutral-400)';
const MUTED = 'var(--color-neutral-600)';

export interface Point {
  x: number;
  y: number;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

/**
 * A single-series line chart with a crosshair and tooltip.
 *
 * One series means no legend box is needed -- the title names it.
 */
export function LineChart({
  data,
  height = 150,
  format,
  formatX = (x) => `Day ${Math.round(x)}`,
  color = SERIES.primary,
  area = true,
  baseline,
}: {
  data: Point[];
  height?: number;
  format: (y: number) => string;
  formatX?: (x: number) => string;
  color?: string;
  area?: boolean;
  /** Draw a reference line, e.g. the starting value. */
  baseline?: number;
}) {
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const W = 600;
  const H = height;
  const M = { top: 10, right: 12, bottom: 22, left: 54 };

  const geom = useMemo(() => {
    if (data.length === 0) return null;
    const xs = data.map((d) => d.x);
    const ys = data.map((d) => d.y);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    if (baseline !== undefined) {
      minY = Math.min(minY, baseline);
      maxY = Math.max(maxY, baseline);
    }
    // Never a zero-height band.
    if (minY === maxY) {
      minY -= Math.abs(minY) * 0.05 || 1;
      maxY += Math.abs(maxY) * 0.05 || 1;
    }
    const pad = (maxY - minY) * 0.12;
    minY -= pad;
    maxY += pad;

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const sx = (x: number) =>
      M.left + ((x - minX) / Math.max(1e-9, maxX - minX)) * (W - M.left - M.right);
    const sy = (y: number) =>
      M.top + (1 - (y - minY) / Math.max(1e-9, maxY - minY)) * (H - M.top - M.bottom);

    return { sx, sy, minY, maxY, minX, maxX };
  }, [data, height, baseline]);

  if (!geom || data.length < 2) {
    return <div className="empty">Not enough history yet — advance a few days.</div>;
  }

  const { sx, sy, minY, maxY } = geom;
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(d.x)} ${sy(d.y)}`).join(' ');
  const fill = `${line} L${sx(data[data.length - 1].x)} ${H - M.bottom} L${sx(data[0].x)} ${H - M.bottom} Z`;
  const ticks = niceTicks(minY, maxY);
  const active = hover === null ? null : data[hover];

  const move = (delta: number) =>
    setHover((h) => {
      const next = h === null ? data.length - 1 : h + delta;
      return Math.max(0, Math.min(data.length - 1, next));
    });

  return (
    <>
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      onMouseLeave={() => setHover(null)}
      /* The readout used to be reachable by mouse and nothing else. The chart
         now takes focus and the arrow keys walk the series, which is also the
         only way to read an individual point on a touch screen. */
      tabIndex={0}
      onFocus={() => setHover((h) => h ?? data.length - 1)}
      onBlur={() => setHover(null)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowRight') move(step);
        else if (e.key === 'ArrowLeft') move(-step);
        else if (e.key === 'Home') setHover(0);
        else if (e.key === 'End') setHover(data.length - 1);
        else if (e.key === 'Escape') setHover(null);
        else return;
        e.preventDefault();
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        // Nearest point, so the hit target is far bigger than the mark.
        let best = 0;
        let bestD = Infinity;
        data.forEach((d, i) => {
          const dist = Math.abs(sx(d.x) - px);
          if (dist < bestD) {
            bestD = dist;
            best = i;
          }
        });
        setHover(best);
      }}
      role="img"
      aria-label={`Line chart, ${data.length} points, from ${format(data[0].y)} to ${format(
        data[data.length - 1].y,
      )}`}
    >
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth="1" />
          <text
            x={M.left - 8}
            y={sy(t) + 3.5}
            textAnchor="end"
            fill={MUTED}
            fontSize="10"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {format(t)}
          </text>
        </g>
      ))}

      {baseline !== undefined && (
        <line
          x1={M.left}
          x2={W - M.right}
          y1={sy(baseline)}
          y2={sy(baseline)}
          stroke={AXIS}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      )}

      {area && <path d={fill} fill={`url(#g${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

      <line
        x1={M.left}
        x2={W - M.right}
        y1={H - M.bottom}
        y2={H - M.bottom}
        stroke={AXIS}
        strokeWidth="1"
      />
      <text x={M.left} y={H - 6} fill={MUTED} fontSize="10">
        {formatX(data[0].x)}
      </text>
      <text x={W - M.right} y={H - 6} textAnchor="end" fill={MUTED} fontSize="10">
        {formatX(data[data.length - 1].x)}
      </text>

      {/* Emphasised endpoint */}
      <circle
        cx={sx(data[data.length - 1].x)}
        cy={sy(data[data.length - 1].y)}
        r="3.5"
        fill={color}
        stroke="var(--color-bg)"
        strokeWidth="2"
      />

      {active && (
        <g pointerEvents="none">
          <line
            x1={sx(active.x)}
            x2={sx(active.x)}
            y1={M.top}
            y2={H - M.bottom}
            stroke={AXIS}
            strokeWidth="1"
          />
          <circle cx={sx(active.x)} cy={sy(active.y)} r="4" fill={color} stroke="var(--color-bg)" strokeWidth="2" />
          <g
            transform={`translate(${Math.min(Math.max(sx(active.x) - 58, M.left), W - M.right - 116)} ${M.top})`}
          >
            <rect width="116" height="34" rx="4" fill="var(--color-surface)" stroke="var(--color-neutral-400)" />
            <text x="8" y="14" fill="var(--color-neutral-600)" fontSize="10">
              {formatX(active.x)}
            </text>
            <text
              x="8"
              y="27"
              fill="var(--color-text)"
              fontSize="12"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {format(active.y)}
            </text>
          </g>
        </g>
      )}
      </svg>
      {/* Announced to screen readers as the selection moves, and invisible
          otherwise. Without it the arrow keys would move a marker nobody could
          perceive. */}
      <div className="sr-only" role="status" aria-live="polite">
        {active ? `${formatX(active.x)}: ${format(active.y)}` : ''}
      </div>
    </>
  );
}

/**
 * The same series as a table, collapsed by default.
 *
 * A chart is a summary; sometimes you want the number. This is also the plain
 * fallback for anyone who cannot use the plot at all, and it is why the plot
 * itself does not have to carry every label.
 */
export function ChartData({
  data,
  format,
  formatX = (x) => `Day ${Math.round(x)}`,
  label,
  max = 40,
}: {
  data: Point[];
  format: (y: number) => string;
  formatX?: (x: number) => string;
  label: string;
  /** Long series are thinned evenly rather than truncated. */
  max?: number;
}) {
  if (data.length === 0) return null;
  const stride = Math.max(1, Math.ceil(data.length / max));
  const rows = data.filter((_, i) => i % stride === 0 || i === data.length - 1);

  return (
    <details className="chart-data">
      <summary>
        {label} as a table
        {stride > 1 && <span className="faint"> &middot; every {stride}th sample</span>}
      </summary>
      <div className="table-wrap" style={{ maxHeight: 240, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th className="right">{label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={i}>
                <td className="dim">{formatX(d.x)}</td>
                <td className="right num">{format(d.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A compact single-series line for small multiples. No axes, no tooltip. */
export function Sparkline({
  data,
  color = SERIES.primary,
  height = 34,
}: {
  data: Point[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} />;
  const W = 120;
  const H = height;
  const ys = data.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const xs = data.map((d) => d.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const sx = (x: number) => ((x - minX) / Math.max(1e-9, maxX - minX)) * W;
  const sy = (y: number) => 3 + (1 - (y - minY) / span) * (H - 6);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(d.x)} ${sy(d.y)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }} aria-hidden="true">
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={sx(data[data.length - 1].x)} cy={sy(data[data.length - 1].y)} r="2.5" fill={color} />
    </svg>
  );
}

export interface WaterfallStep {
  label: string;
  /** Signed: positive is money in, negative is money out. */
  value: number;
}

/**
 * Deal P&L waterfall.
 *
 * Sign is encoded three ways -- colour, bar direction, and a signed direct
 * label -- because the green/red pair is in the CVD warn band and colour alone
 * would not be enough.
 */
export function Waterfall({
  steps,
  format,
  height = 230,
}: {
  steps: WaterfallStep[];
  format: (n: number) => string;
  height?: number;
}) {
  const W = 640;
  const H = height;
  const M = { top: 14, right: 12, bottom: 58, left: 62 };

  const geom = useMemo(() => {
    let running = 0;
    const bars = steps.map((s) => {
      const from = running;
      running += s.value;
      return { ...s, from, to: running };
    });
    const values = bars.flatMap((b) => [b.from, b.to]).concat(0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || 1;
    return { bars, min: min - pad, max: max + pad, total: running };
  }, [steps]);

  const { bars, min, max, total } = geom;
  const sy = (v: number) => M.top + (1 - (v - min) / Math.max(1e-9, max - min)) * (H - M.top - M.bottom);
  const bandW = (W - M.left - M.right) / (bars.length + 1);
  const barW = Math.min(46, bandW * 0.62);
  const ticks = niceTicks(min, max);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={`Profit and loss waterfall ending at ${format(total)}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth="1" />
          <text
            x={M.left - 8}
            y={sy(t) + 3.5}
            textAnchor="end"
            fill={MUTED}
            fontSize="10"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {format(t)}
          </text>
        </g>
      ))}
      <line x1={M.left} x2={W - M.right} y1={sy(0)} y2={sy(0)} stroke={AXIS} strokeWidth="1" />

      {bars.map((b, i) => {
        const x = M.left + bandW * i + (bandW - barW) / 2;
        const top = sy(Math.max(b.from, b.to));
        // A 2px gap keeps adjacent fills from touching.
        const h = Math.max(2, Math.abs(sy(b.from) - sy(b.to)) - 2);
        const positive = b.value >= 0;
        return (
          <g key={i}>
            <rect
              x={x}
              y={top}
              width={barW}
              height={h}
              rx="3"
              fill={positive ? SERIES.positive : SERIES.negative}
            />
            <text
              x={x + barW / 2}
              y={top - 5}
              textAnchor="middle"
              fill={positive ? 'var(--good)' : 'var(--bad)'}
              fontSize="10"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {positive ? '+' : '−'}
              {format(Math.abs(b.value))}
            </text>
            <text
              x={x + barW / 2}
              y={H - M.bottom + 14}
              textAnchor="middle"
              fill={MUTED}
              fontSize="9.5"
            >
              {b.label.length > 12 ? `${b.label.slice(0, 11)}…` : b.label}
            </text>
          </g>
        );
      })}

      {/* Final net bar, anchored to the baseline. */}
      {(() => {
        const x = M.left + bandW * bars.length + (bandW - barW) / 2;
        const top = Math.min(sy(0), sy(total));
        const h = Math.max(2, Math.abs(sy(0) - sy(total)));
        const positive = total >= 0;
        return (
          <g>
            <rect
              x={x}
              y={top}
              width={barW}
              height={h}
              rx="3"
              fill={positive ? SERIES.positive : SERIES.negative}
              opacity="0.55"
              stroke={positive ? SERIES.positive : SERIES.negative}
              strokeWidth="2"
            />
            <text
              x={x + barW / 2}
              y={top - 5}
              textAnchor="middle"
              fill={positive ? 'var(--good)' : 'var(--bad)'}
              fontSize="11"
              fontWeight="600"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {format(total)}
            </text>
            <text x={x + barW / 2} y={H - M.bottom + 14} textAnchor="middle" fill="var(--color-text)" fontSize="9.5">
              Net
            </text>
          </g>
        );
      })()}
    </svg>
  );
}
