import type { StressField as Field } from '../../engine';
import { money, percent } from '../format';

/**
 * Where the deal dies, as a shape.
 *
 * The table beneath this answers "what happens at these five points". This
 * answers the question those five points were only ever standing in for:
 * how far from the deal you underwrote is the ground that opens up.
 *
 * The contour is the whole picture. A deal whose zero line runs far below and
 * left of the marker has room; one where it passes close by is a forecast
 * wearing a margin's clothes, and no single profit figure can tell them apart.
 */

const W = 520;
const H = 300;
const PAD = { top: 10, right: 12, bottom: 30, left: 46 };

export default function StressField({
  field,
  baseProfit,
}: {
  field: Field;
  baseProfit: number;
}) {
  const cols = field.arvAt.length;
  const rows = field.costAt.length;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const cw = plotW / cols;
  const ch = plotH / rows;
  const px = (col: number) => PAD.left + col * cw;
  const py = (row: number) => PAD.top + row * ch;

  // Two ramps meeting at zero, so the sign change is the strongest edge on the
  // chart rather than one step in a continuous scale.
  const colourFor = (v: number): string => {
    if (v >= 0) {
      const t = field.max > 0 ? Math.min(1, v / field.max) : 0;
      return `color-mix(in srgb, var(--good) ${(12 + t * 62).toFixed(0)}%, transparent)`;
    }
    const t = field.min < 0 ? Math.min(1, v / field.min) : 0;
    return `color-mix(in srgb, var(--bad) ${(12 + t * 70).toFixed(0)}%, transparent)`;
  };

  const contour = field.breakEven
    .filter((p): p is { col: number; row: number } => p !== null)
    .map((p) => `${px(p.col) + cw / 2},${py(p.row) + ch / 2}`)
    .join(' ');

  // The deal as underwritten: ARV delta 0, no overrun. That is the top of the
  // grid at the column closest to zero.
  const baseCol = field.arvAt.reduce(
    (best, v, i) => (Math.abs(v) < Math.abs(field.arvAt[best]) ? i : best),
    0,
  );

  const xTicks = [-0.2, -0.15, -0.1, -0.05, 0, 0.05].filter(
    (v) => v >= field.arvAt[0] && v <= field.arvAt[cols - 1],
  );
  const yTicks = [0, 0.2, 0.4, 0.6].filter((v) => v <= field.costAt[rows - 1]);

  const colFor = (arv: number) =>
    ((arv - field.arvAt[0]) / (field.arvAt[cols - 1] - field.arvAt[0])) * (cols - 1);
  const rowFor = (cost: number) =>
    ((cost - field.costAt[0]) / (field.costAt[rows - 1] - field.costAt[0])) * (rows - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={
        `Stress field. The deal makes ${money(baseProfit)} as underwritten. ` +
        `Profit falls as the ARV estimate proves optimistic (left) and as the work runs over (down). ` +
        `The outlined curve is where it breaks even. The table below carries the same figures.`
      }
    >
      {field.grid.map((row, r) =>
        row.map((v, c) => (
          <rect
            key={`${r}-${c}`}
            x={px(c)}
            y={py(r)}
            width={cw + 0.6}
            height={ch + 0.6}
            fill={colourFor(v)}
          />
        )),
      )}

      {/* The line the whole chart exists to show. */}
      {contour && (
        <polyline
          points={contour}
          fill="none"
          stroke="var(--text)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}

      {/* Where you actually are. */}
      <g>
        <circle
          cx={px(baseCol) + cw / 2}
          cy={py(0) + ch / 2}
          r="5"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <text
          x={px(baseCol) + cw / 2 + 9}
          y={py(0) + ch / 2 + 4}
          fontSize="10"
          fill="var(--accent)"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {money(baseProfit)}
        </text>
      </g>

      {/* Axes */}
      {xTicks.map((v) => (
        <text
          key={v}
          x={px(colFor(v)) + cw / 2}
          y={H - 14}
          fontSize="10"
          fill="var(--text-faint)"
          textAnchor="middle"
        >
          {v === 0 ? 'as planned' : `${Math.round(v * 100)}%`}
        </text>
      ))}
      <text x={PAD.left + plotW / 2} y={H - 2} fontSize="10" fill="var(--text-faint)" textAnchor="middle">
        ARV versus your estimate
      </text>

      {yTicks.map((v) => (
        <text
          key={v}
          x={PAD.left - 6}
          y={py(rowFor(v)) + ch / 2 + 3}
          fontSize="10"
          fill="var(--text-faint)"
          textAnchor="end"
        >
          {v === 0 ? 'on budget' : `+${Math.round(v * 100)}%`}
        </text>
      ))}
      <text
        transform={`translate(11 ${PAD.top + plotH / 2}) rotate(-90)`}
        fontSize="10"
        fill="var(--text-faint)"
        textAnchor="middle"
      >
        work over budget
      </text>
    </svg>
  );
}
