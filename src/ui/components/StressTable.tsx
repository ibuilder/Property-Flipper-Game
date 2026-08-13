import { useState } from 'react';
import {
  describeResilience,
  type StressField as StressFieldData,
  type StressTest,
} from '../../engine';
import StressField from '../graphics/StressField';
// Full figures rather than the abbreviated form used elsewhere: a grid exists
// to be compared across, and "$9,926" next to "$12k" cannot be.
import { money, percent } from '../format';

/**
 * The two-variable stress table.
 *
 * Collapsed by default, because it answers a question a player does not know
 * to ask until they have lost money once — and opening it is the moment that
 * changes. The analyzer above says what the deal is worth if the estimates
 * hold; this says which estimate you cannot afford to be wrong about.
 *
 * Read like the Excel data table it is modelled on: value across the top,
 * budget overrun down the side, profit where they meet. The shading does the
 * work — what matters is not any single number but where the sign flips, and
 * how far that boundary sits from the cell you actually underwrote.
 */
export default function StressTable({
  test,
  field = null,
}: {
  test: StressTest;
  /** The finely sampled version, for the contour. */
  field?: StressFieldData | null;
}) {
  const [open, setOpen] = useState(false);

  const worst = Math.max(...test.rows.flat().map((c) => Math.abs(c.profit)), 1);

  return (
    <div className="stress">
      <button
        className="stress-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        What if I am wrong?
        <span className="survival">
          {percent(test.survivalRate, 0)} of cases still profit
        </span>
      </button>

      {open && (
        <div className="stress-body">
          <p className="stress-lead">{describeResilience(test)}</p>

          {field && <StressField field={field} baseProfit={test.base.profit} />}

          {/* The same figures as a table. Not a fallback bolted on: a contour
              tells you the shape and a table tells you the number, and an
              underwriter wants both. It is also the only version that works
              without colour. */}
          <details className="stress-numbers">
            <summary>The same grid as numbers</summary>
          <div className="table-wrap">
            <table className="stress-grid">
              <caption>
                Projected profit when the value is off and the work runs over
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="corner">
                    Overrun ↓ / ARV →
                  </th>
                  {test.arvDeltas.map((d) => (
                    <th key={d} scope="col" className="right">
                      {d === 0 ? 'as planned' : `${d > 0 ? '+' : ''}${Math.round(d * 100)}%`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {test.rows.map((row, r) => (
                  <tr key={r}>
                    <th scope="row">
                      {test.costDeltas[r] === 0
                        ? 'on budget'
                        : `+${Math.round(test.costDeltas[r] * 100)}%`}
                    </th>
                    {row.map((cell, c) => {
                      const isBase = cell.arvDelta === 0 && cell.costDelta === 0;
                      const intensity = Math.min(1, Math.abs(cell.profit) / worst);
                      return (
                        <td
                          key={c}
                          className={`right num ${cell.profit >= 0 ? 'pos' : 'neg'}${
                            isBase ? ' base' : ''
                          }`}
                          style={{ '--i': intensity.toFixed(2) } as React.CSSProperties}
                          title={
                            isBase
                              ? 'The deal exactly as you underwrote it'
                              : `${percent(cell.annualised, 0)} annualised`
                          }
                        >
                          {money(cell.profit)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </details>

          <p className="stress-note">
            The ring is the deal as you underwrote it and the dark line is where it breaks even.
            Everything below and to the left is a version of this deal where you were wrong about
            something &mdash; which is most deals. A profit that only exists in the top-right corner
            is not a margin, it is a forecast.
          </p>
        </div>
      )}
    </div>
  );
}
