import {
  NEIGHBORHOODS_BY_ID,
  compFit,
  compScatter,
  describeCompShape,
  selectComps,
  type GameState,
  type Property,
} from '../../engine';
import { money, percent } from '../format';
import CompScatter from '../graphics/CompScatter';
import { useAction } from '../store';

/**
 * Choose the comparable sales your estimate rests on.
 *
 * This is the most consequential screen in the game and the one that teaches
 * the most, because a wrong ARV is the classic way a flip loses money and the
 * error is multiplicative — 10% high here is 10% high on everything
 * downstream. The comps are priced by the same model as the subject, so a
 * house two neighborhoods over genuinely did sell for more per foot, and the
 * mismatch reasons are shown rather than hidden.
 */
export default function CompPicker({
  property,
  state,
}: {
  property: Property;
  state: GameState;
}) {
  const act = useAction();
  const selected = new Set(property.selectedComps);

  const rows = [...property.compPool]
    .map((c) => ({ comp: c, fit: compFit(property, c) }))
    .sort((a, b) => a.fit.score - b.fit.score);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === 0 || next.size > 4) return;
    act((s) => selectComps(s, property.id, [...next]));
  };

  const band = property.appraisal.point
    ? (property.appraisal.high - property.appraisal.low) / property.appraisal.point
    : 0;

  const scatter = compScatter(property, property.compPool, property.selectedComps);
  const shapeWarning = describeCompShape(scatter);

  return (
    <div>
      <div className="kv total" style={{ marginTop: 0 }}>
        <span className="k">
          Your estimate from {selected.size} comp{selected.size === 1 ? '' : 's'}
        </span>
        <span className="v" style={{ fontSize: 16, fontWeight: 600 }}>
          {money(property.appraisal.point)}
        </span>
      </div>
      <div className="kv">
        <span className="k">Confidence range</span>
        <span className={`v ${band > 0.2 ? 'warn' : ''}`}>
          {money(property.appraisal.low)} – {money(property.appraisal.high)} (±
          {percent(band / 2, 1)})
        </span>
      </div>

      {/* Placed above the table deliberately. The chart is how you decide; the
          table is how you check. Reversing them makes this a spreadsheet with
          a decoration on the end. */}
      <div className="comp-chart">
        <CompScatter scatter={scatter} />
        <p className="comp-legend">
          <span className="dot local" /> in this neighborhood
          <span className="dot away" /> elsewhere
          <span className="dot hollow" /> not in use
          <span className="faint"> &middot; the small ring is what it sold for, the filled dot what
          it implies for a house in this condition</span>
        </p>
      </div>

      {shapeWarning && (
        <div className="verdict thin" style={{ marginTop: 10 }}>
          <strong>Look at the shape of your selection</strong>
          {shapeWarning}
        </div>
      )}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th aria-label="Use this comp"></th>
              <th>Sold</th>
              <th>Area</th>
              <th className="right">Sqft</th>
              <th className="right">Bd</th>
              <th>Finish</th>
              <th className="right">Price</th>
              <th className="right">$/sqft</th>
              <th className="right">Age</th>
              <th>Fit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ comp, fit }) => {
              const on = selected.has(comp.id);
              const sameHood = comp.neighborhoodId === property.neighborhoodId;
              const quality =
                fit.score < 0.35 ? 'good' : fit.score < 0.8 ? 'warn' : 'bad';
              return (
                <tr
                  key={comp.id}
                  className={`clickable ${on ? 'selected' : ''}`}
                  onClick={() => toggle(comp.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(comp.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={on}
                  aria-label={`${comp.address}, ${
                    on ? 'in use' : 'not in use'
                  }. ${fit.reasons.join('; ') || 'close match'}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={on}
                      readOnly
                      tabIndex={-1}
                      style={{ width: 'auto', accentColor: 'var(--accent)' }}
                    />
                  </td>
                  <td>{comp.address}</td>
                  <td className={sameHood ? 'dim' : 'warn'}>
                    {NEIGHBORHOODS_BY_ID[comp.neighborhoodId]?.name}
                  </td>
                  <td className="right num">{comp.sqft.toLocaleString()}</td>
                  <td className="right num dim">{comp.beds}</td>
                  <td className="dim">{comp.quality}</td>
                  <td className="right num">{money(comp.soldPrice)}</td>
                  <td className="right num">${Math.round(comp.soldPrice / comp.sqft)}</td>
                  <td className="right num dim">{comp.soldDaysAgo}d</td>
                  <td>
                    <span className={`pill ${quality}`}>
                      {quality === 'good' ? 'close' : quality === 'warn' ? 'loose' : 'poor'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.some((r) => selected.has(r.comp.id) && r.fit.reasons.length > 0) && (
        <div className="verdict thin" style={{ marginTop: 12 }}>
          <strong>Your selection has mismatches</strong>
          {rows
            .filter((r) => selected.has(r.comp.id) && r.fit.reasons.length > 0)
            .map((r) => `${r.comp.address}: ${r.fit.reasons.join(', ')}`)
            .join(' · ')}
        </div>
      )}

      <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
        A good comp is the same size, in the same area, sold recently, in a similar state. Nothing
        adjusts for a mismatch on your behalf — lean on a bigger house or a pricier street and your
        estimate inherits the difference, which then flows straight into your maximum offer.
      </p>
    </div>
  );
}
