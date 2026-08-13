import { useState } from 'react';
import { FORECAST_CONFIDENCE, commitForecast, type Property } from '../../engine';
import { money, percent } from '../format';
import { useAction } from '../store';

/**
 * Commit to a number before you find out.
 *
 * The range is pre-filled at a deliberately generous width around the
 * projection, and the player narrows it. That is the right way round: an empty
 * form gets skipped, and the lesson is not in the typing — it is in being
 * shown, ten deals later, that the width you keep choosing is wrong. Starting
 * everybody wide means the first thing the calibration panel ever says is
 * "these are too loose to be worth stating", which is the correct first
 * lesson and one almost every new forecaster needs.
 *
 * Once committed it is locked. A prediction you can revise after the work
 * starts going badly measures nothing except hindsight.
 */
export default function ForecastPanel({
  property,
  projectedProfit,
}: {
  property: Property;
  projectedProfit: number;
}) {
  const act = useAction();
  const existing = property.ownership?.forecast ?? null;

  // Deliberately not centred on the projection. The projection is made against
  // a cosmetic scope before the house has been opened up, so it is closer to a
  // ceiling than to a middle -- there is far more room below it than above.
  // Starting the range asymmetric prompts the question; the copy answers it.
  // The exact correction is not supplied: finding your own is the exercise.
  const round = (n: number) => Math.round(n / 500) * 500;
  const [low, setLow] = useState(() => round(projectedProfit * 0.5));
  const [high, setHigh] = useState(() => round(projectedProfit * 1.25));

  if (existing) {
    const mid = (existing.low + existing.high) / 2;
    const halfWidth = mid !== 0 ? (existing.high - existing.low) / 2 / Math.abs(mid) : 0;
    return (
      <div className="forecast committed">
        <div className="kv total" style={{ marginTop: 0 }}>
          <span className="k">
            You committed, on day {existing.day}
            <br />
            <span className="faint" style={{ fontSize: 11 }}>
              {percent(existing.confidence, 0)} confident, &plusmn;{percent(halfWidth, 0)} wide
            </span>
          </span>
          <span className="v">
            {money(existing.low)} &ndash; {money(existing.high)}
          </span>
        </div>
        <p className="faint" style={{ fontSize: 11.5, margin: '8px 0 0', lineHeight: 1.5 }}>
          Locked until this sells. Whether it lands inside is not the point on its own &mdash; one
          forecast tells you nothing. The pattern across all of them is in your track record.
        </p>
      </div>
    );
  }

  const mid = (low + high) / 2;
  const halfWidth = mid !== 0 ? (high - low) / 2 / Math.abs(mid) : 0;
  const invalid = high <= low;

  return (
    <div className="forecast">
      <p className="forecast-lead">
        Before you start work, commit to what this will actually clear. Not a guess at the right
        answer &mdash; a range you would defend, wide enough that you believe it{' '}
        {percent(FORECAST_CONFIDENCE, 0)} of the time.
      </p>
      {/* Named plainly, because a range pre-filled off-centre without
          explanation looks like a bug rather than a point. */}
      <p className="forecast-lead" style={{ marginTop: -6 }}>
        The starting range sits below the projection above, and not evenly. A projection is priced
        against a cosmetic scope on a house nobody has opened up yet, so it is nearer a ceiling than
        a middle &mdash; what is still hidden can only cost you. How far below is yours to judge,
        and your track record will tell you whether you judged it well.
      </p>

      <div className="forecast-inputs">
        <label className="field">
          <span className="label">At worst</span>
          <input
            type="number"
            step={500}
            value={low}
            onChange={(e) => setLow(Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span className="label">At best</span>
          <input
            type="number"
            step={500}
            value={high}
            onChange={(e) => setHigh(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="kv">
        <span className="k">How precise a claim that is</span>
        <span className={`v ${halfWidth > 0.35 ? 'faint' : halfWidth < 0.08 ? 'warn' : ''}`}>
          &plusmn;{percent(halfWidth, 0)}
        </span>
      </div>

      {/* Both failure modes named, because a player will otherwise optimise for
          the one that cannot embarrass them. */}
      <p className="faint" style={{ fontSize: 11.5, margin: '6px 0 10px', lineHeight: 1.5 }}>
        {halfWidth > 0.35
          ? 'That is wide enough that it will almost always be right, which means it is not telling you anything. Narrow it until it could be wrong.'
          : halfWidth < 0.08
            ? 'That is a very confident claim on a deal with a renovation still ahead of it. Being wrong is fine; being narrow and wrong repeatedly is the thing worth learning about.'
            : 'A range you could be wrong about, which is what makes being right worth something.'}
      </p>

      <button
        className="btn primary"
        disabled={invalid}
        onClick={() => act((s) => commitForecast(s, property.id, low, high))}
      >
        {invalid ? 'The high end must be above the low' : 'Commit this forecast'}
      </button>
      <p className="faint" style={{ fontSize: 11, margin: '8px 0 0' }}>
        Optional, and permanent once made.
      </p>
    </div>
  );
}
