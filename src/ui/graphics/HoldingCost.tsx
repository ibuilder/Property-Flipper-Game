import type { CashRunway, RunwayLevel } from '../../engine';
import { money } from '../format';

/**
 * What today cost, split by where it went.
 *
 * A single bar rather than a chart, because there is one quantity worth
 * knowing and it is a rate. The segments are ordered so the accruing interest
 * sits at the end under a hatch: it is the piece that never appears in the
 * cash balance, and the hatch is there to say so without a paragraph.
 *
 * Rent, when there is any, is drawn as a credit below the line rather than
 * netted into it. Netting would let a let property hide the cost of a vacant
 * one, and the point of the bar is that each house is costing what it costs.
 */

const H = 22;

export default function HoldingCost({
  runway,
  level,
}: {
  runway: CashRunway;
  level: RunwayLevel;
}) {
  const carry = runway.lines.reduce((s, l) => s + l.carry, 0);
  const debt = runway.lines.reduce((s, l) => s + l.debtService, 0);
  const rent = runway.lines.reduce((s, l) => s + l.netRent, 0);
  const accruing = runway.accruing;

  const gross = carry + debt + accruing;
  if (gross < 0.5) return null;

  const segs = [
    { key: 'carry', v: carry, fill: 'var(--text-faint)', label: 'taxes, insurance, utilities' },
    { key: 'debt', v: debt, fill: 'var(--warn)', label: 'mortgage payments' },
    { key: 'accruing', v: accruing, fill: 'var(--bad)', label: 'interest accruing, unpaid' },
  ].filter((s) => s.v > 0.5);

  let x = 0;
  return (
    <div className={`holding-cost ${level}`}>
      <div className="holding-head">
        <span className="holding-total">{money(gross)}<span className="per">/day</span></span>
        {rent > 0.5 && <span className="holding-credit">less {money(rent)}/day of rent</span>}
      </div>

      <svg
        viewBox={`0 0 100 ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block' }}
        role="img"
        aria-label={
          `Holding costs ${money(gross)} a day: ` +
          segs.map((s) => `${money(s.v)} ${s.label}`).join(', ') +
          (accruing > 0.5 ? '. The accruing interest does not leave your account until closing.' : '.')
        }
      >
        <defs>
          {/* The hatch marks the money that is real but not yet gone. */}
          <pattern id="accrue-hatch" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="var(--bad)" opacity="0.55" />
            <path d="M0,4 l4,-4" stroke="var(--bad)" strokeWidth="1.4" />
          </pattern>
        </defs>
        {segs.map((s) => {
          const w = (s.v / gross) * 100;
          const seg = (
            <rect
              key={s.key}
              x={x}
              y={0}
              width={Math.max(0, w - 0.35)}
              height={H}
              fill={s.key === 'accruing' ? 'url(#accrue-hatch)' : s.fill}
            />
          );
          x += w;
          return seg;
        })}
      </svg>

      <p className="holding-legend">
        {segs.map((s) => (
          <span key={s.key}>
            <span className={`swatch ${s.key}`} />
            {money(s.v)} {s.label}
          </span>
        ))}
      </p>
    </div>
  );
}
