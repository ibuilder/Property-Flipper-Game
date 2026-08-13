import type { CompScatter as Scatter } from '../../engine';
import { money } from '../format';

/**
 * The comp set, as a picture.
 *
 * Two things decide whether an estimate is any good and neither is visible in
 * a list: whether the comps agree with each other, and whether they are from
 * the same place as the subject. The table can say "different neighborhood" in
 * small grey text; only a chart can show that the out-of-area comps are sitting
 * in a band of their own, half again as high, dragging the median with them.
 *
 * Height is the adjusted price per foot -- the quantity the estimate is a
 * median of -- so the horizontal median line crosses the subject's vertical
 * exactly at the estimate. That crossing is the whole screen in one mark: move
 * the selection and watch it move.
 *
 * Raw price is drawn as a ghost tethered to each point, because the finish
 * adjustment is otherwise invisible and it is large. A dated comp sells cheap
 * and still implies a high value for a house in better condition; the tether
 * is the only place that reasoning is shown rather than assumed.
 */

const W = 520;
const H = 260;
const PAD = { top: 14, right: 14, bottom: 34, left: 52 };

export default function CompScatter({ scatter }: { scatter: Scatter }) {
  const { points, subjectSqft, medianPerSqft } = scatter;
  if (points.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Every comp's adjusted value sets the scale, because comparing them is the
  // point -- an out-of-area comp at three times the local ones has to look
  // like three times. Raw prices only count for comps actually in use: an
  // unselected comp's ghost is decoration, and letting one stretch the axis
  // squashes the entire decision into a sliver at the bottom.
  const allY = points.flatMap((p) =>
    p.selected ? [p.adjustedPerSqft, p.rawPerSqft] : [p.adjustedPerSqft],
  );
  const allX = points.map((p) => p.comp.sqft).concat(subjectSqft);
  const yMax = Math.max(...allY) * 1.08;
  const yMin = Math.min(...allY, medianPerSqft) * 0.92;
  const xMin = Math.min(...allX) * 0.94;
  const xMax = Math.max(...allX) * 1.06;

  const px = (sqft: number) => PAD.left + ((sqft - xMin) / (xMax - xMin)) * plotW;
  const py = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const subjectX = px(subjectSqft);
  const medianY = py(medianPerSqft);
  const selected = points.filter((p) => p.selected);

  // Four gridlines, on round numbers rather than on the data's extremes.
  const step = niceStep((yMax - yMin) / 4);
  const ticks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={
        `Comparable sales. Your ${selected.length} chosen comps imply ` +
        `$${Math.round(medianPerSqft)} per square foot, which on ${subjectSqft.toLocaleString()} ` +
        `square feet is ${money(scatter.impliedValue)}. ` +
        `${selected.filter((p) => !p.local).length} of them are outside this neighborhood. ` +
        `The table below carries every figure.`
      }
    >
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={py(v)}
            y2={py(v)}
            stroke="var(--text-faint)"
            strokeOpacity="0.15"
          />
          <text x={PAD.left - 7} y={py(v) + 3} fontSize="10" fill="var(--text-faint)" textAnchor="end">
            ${Math.round(v)}
          </text>
        </g>
      ))}

      {/* The subject's size. The selection ought to straddle it. */}
      <line
        x1={subjectX}
        x2={subjectX}
        y1={PAD.top}
        y2={PAD.top + plotH}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        strokeOpacity="0.7"
      />
      <text x={subjectX} y={PAD.top - 4} fontSize="10" fill="var(--accent)" textAnchor="middle">
        this house
      </text>

      {/* The median of the selection: the estimate, per foot. */}
      {medianPerSqft > 0 && (
        <>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={medianY}
            y2={medianY}
            stroke="var(--accent)"
            strokeWidth="1.5"
          />
          <circle cx={subjectX} cy={medianY} r="4" fill="var(--accent)" />
        </>
      )}

      {points.map((p) => {
        const x = px(p.comp.sqft);
        const y = py(p.adjustedPerSqft);
        const rawY = py(p.rawPerSqft);
        // Amber, not red: an out-of-area comp is a risk to be aware of, not a
        // mistake. Sometimes it is the only comparable sale there is.
        const colour = p.local ? 'var(--good)' : 'var(--warn)';
        return (
          <g key={p.comp.id} opacity={p.selected ? 1 : 0.32}>
            {/* What it sold for, tethered to what it implies for the subject.
                Drawn only for comps in use: on the others it is clutter, and
                it is not guaranteed to be inside the frame. */}
            {p.selected && Math.abs(rawY - y) > 1.5 && (
              <>
                <line
                  x1={x}
                  x2={x}
                  y1={rawY}
                  y2={y}
                  stroke={colour}
                  strokeOpacity="0.4"
                  strokeDasharray="2 2"
                />
                <circle cx={x} cy={rawY} r="2" fill="none" stroke={colour} strokeOpacity="0.5" />
              </>
            )}
            <circle
              cx={x}
              cy={y}
              r={p.selected ? 5.5 : 4}
              fill={p.selected ? colour : 'none'}
              stroke={colour}
              strokeWidth="1.5"
            />
          </g>
        );
      })}

      <text x={PAD.left} y={H - 4} fontSize="10" fill="var(--text-faint)">
        {Math.round(xMin).toLocaleString()} sqft
      </text>
      <text x={W - PAD.right} y={H - 4} fontSize="10" fill="var(--text-faint)" textAnchor="end">
        {Math.round(xMax).toLocaleString()} sqft
      </text>
      <text
        transform={`translate(11 ${PAD.top + plotH / 2}) rotate(-90)`}
        fontSize="10"
        fill="var(--text-faint)"
        textAnchor="middle"
      >
        $/sqft implied for this house
      </text>
    </svg>
  );
}

/** A round-ish step: 1, 2 or 5 times a power of ten. */
function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
}
