import {
  ARCHETYPES_BY_ID,
  DEFECTS_BY_ID,
  ECON,
  NEIGHBORHOODS_BY_ID,
  defectRepairCost,
  type Property,
} from '../../engine';
import { conditionLabel, money, percent } from '../format';

/** Facts, comparable sales, and whatever the player currently knows is wrong. */
export default function PropertyFacts({ property }: { property: Property }) {
  const hood = NEIGHBORHOODS_BY_ID[property.neighborhoodId];
  const arch = ARCHETYPES_BY_ID[property.archetypeId];
  const cond = conditionLabel(property.condition);
  const known = property.defects.filter((d) => d.revealed && !d.repaired);
  const band = property.appraisal;
  const bandWidth = band.point > 0 ? (band.high - band.low) / band.point : 0;

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>The property</h2>
          <span className={`pill ${cond.tone}`}>{cond.text}</span>
        </div>
        <div className="panel-body">
          <div className="kv">
            <span className="k">Area</span>
            <span className="v">{hood?.name}</span>
          </div>
          <div className="kv">
            <span className="k">Type</span>
            <span className="v">
              {arch?.name} &middot; {property.beds}bd / {property.baths}ba
            </span>
          </div>
          <div className="kv">
            <span className="k">Size</span>
            <span className="v">{property.sqft.toLocaleString()} sqft</span>
          </div>
          <div className="kv">
            <span className="k">Built</span>
            <span className="v">{property.yearBuilt}</span>
          </div>
          <div className="kv">
            <span className="k">Property tax</span>
            <span className="v">{percent(hood?.taxRate ?? 0, 2)}/yr</span>
          </div>
          {(hood?.hoaMonthly ?? 0) > 0 && (
            <div className="kv">
              <span className="k">HOA</span>
              <span className="v">{money(hood!.hoaMonthly)}/mo</span>
            </div>
          )}
          <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            {hood?.blurb}
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Valuation</h2>
          <span className="pill mute">{band.confidence}</span>
        </div>
        <div className="panel-body">
          <div className="kv">
            <span className="k">Estimated as-is value</span>
            <span className="v" style={{ fontSize: 16, fontWeight: 600 }}>
              {money(band.point)}
            </span>
          </div>
          <div className="kv">
            <span className="k">Confidence range</span>
            <span className="v">
              {money(band.low)} &ndash; {money(band.high)}
            </span>
          </div>
          <div className="kv">
            <span className="k">Uncertainty</span>
            <span className={`v ${bandWidth > 0.2 ? 'warn' : ''}`}>
              &plusmn;{percent(bandWidth / 2, 1)}
            </span>
          </div>

          <div className="scope-group-label" style={{ marginTop: 16 }}>
            Comparable sales
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th className="right">Sqft</th>
                  <th className="right">Bd/Ba</th>
                  <th className="right">Sold</th>
                  <th className="right">Price</th>
                  <th className="right">$/sqft</th>
                </tr>
              </thead>
              <tbody>
                {band.comps.map((c, i) => (
                  <tr key={i}>
                    <td>{c.address}</td>
                    <td className="right num">{c.sqft.toLocaleString()}</td>
                    <td className="right num dim">
                      {c.beds}/{c.baths}
                    </td>
                    <td className="right num dim">{c.soldDaysAgo}d ago</td>
                    <td className="right num">{money(c.soldPrice)}</td>
                    <td className="right num dim">${Math.round(c.soldPrice / c.sqft)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Comps are similar homes, not identical ones. The spread between them is why your
            estimate has a range &mdash; and why an ARV that is 10% optimistic quietly destroys a
            15% margin.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Condition report</h2>
          {property.inspection !== 'none' && (
            <span className="pill info">{property.inspection} inspection</span>
          )}
        </div>
        <div className="panel-body">
          {property.inspection === 'none' ? (
            <p className="dim" style={{ margin: 0, fontSize: 13 }}>
              No inspection ordered. Anything wrong with this house is currently hidden &mdash;
              it will surface as a change order once a crew opens the walls, or as a buyer&rsquo;s
              concession when you try to sell.
            </p>
          ) : known.length === 0 ? (
            <p className="good" style={{ margin: 0, fontSize: 13 }}>
              The inspection found nothing outstanding.{' '}
              {property.inspection === 'standard' && (
                <span className="dim">
                  A standard inspection catches about{' '}
                  {percent(ECON.INSPECTION.standard.revealRate, 0)} of problems, so this is
                  reassuring rather than conclusive.
                </span>
              )}
            </p>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Finding</th>
                      <th>Severity</th>
                      <th className="right">Repair</th>
                      <th className="right">If left unfixed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {known.map((d) => {
                      const def = DEFECTS_BY_ID[d.defId];
                      const cost = defectRepairCost(d.defId, property);
                      if (!def) return null;
                      return (
                        <tr key={d.defId}>
                          <td>
                            {def.name}
                            <div className="faint" style={{ fontSize: 11.5 }}>
                              {def.blurb}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`pill ${
                                def.severity === 'major'
                                  ? 'bad'
                                  : def.severity === 'moderate'
                                    ? 'warn'
                                    : 'mute'
                              }`}
                            >
                              {def.severity}
                            </span>
                          </td>
                          <td className="right num">{money(cost)}</td>
                          <td className="right num bad">
                            {def.mustFix ? money(cost * 1.15) : money(cost * 0.5)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="faint" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
                Disclosed defects are already priced into what the seller will accept, so an
                inspection pays for itself when it finds something. What it cannot do is make the
                problem go away: fix it now, or hand a buyer 15% more than it would have cost.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
