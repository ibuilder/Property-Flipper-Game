import { workFinishedSoFar, type Property } from '../../engine';
import { conditionLabel } from '../format';
import House from '../graphics/House';

/**
 * The house as bought, next to the house as the crew has made it so far.
 *
 * Track record already pairs the two states after a sale. This is the one
 * place the pairing was missing: while the work is running, against the scope
 * that is producing the change. Both pictures are the same property; the left
 * is the purchase snapshot (`boughtAs`) and the right is the live facade,
 * including line items finished but not yet booked so the picture can move
 * without moving the appraisal.
 */
export default function JobBeforeAfter({
  property,
  day,
}: {
  property: Property;
  day: number;
}) {
  const before = property.ownership?.boughtAs;
  if (!before) return null;

  const job = property.ownership?.renovation;
  const finished = job ? workFinishedSoFar(job) : [];

  return (
    <div className="job-before-after">
      <div>
        <div className="chart-title">
          <h3>As bought</h3>
          <span className={`pill ${conditionLabel(before.condition).tone}`}>
            {conditionLabel(before.condition).text}
          </span>
        </div>
        <House property={before} className="house-hero" day={property.ownership!.purchaseDay} />
      </div>
      <div>
        <div className="chart-title">
          <h3>As the work stands</h3>
          <span className={`pill ${conditionLabel(property.condition).tone}`}>
            {conditionLabel(property.condition).text}
          </span>
        </div>
        <House property={property} className="house-hero" day={day} />
      </div>
      <p className="faint" style={{ fontSize: 12, margin: '8px 0 0', gridColumn: '1 / -1' }}>
        {finished.length > 0
          ? `${finished.length} line item${finished.length === 1 ? '' : 's'} finished so far. Value does not move until the job books.`
          : 'Nothing finished yet — the left-hand house is what you paid for.'}
      </p>
    </div>
  );
}
