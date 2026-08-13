import {
  MIN_FOR_VERDICT,
  calibration,
  calibrationVerdict,
  describeCalibration,
  resolvedForecasts,
  type ClosedDeal,
} from '../../engine';
import { money, percent } from '../format';

/**
 * Were you right about your own deals?
 *
 * Every other panel in the game tells the player something about the model.
 * This is the only one that tells them something about themselves, and it can
 * only do that because they committed to a number before they knew.
 *
 * Two figures, shown together and never apart: how often the truth landed
 * inside the range, and how wide the ranges were. Either alone is trivially
 * gamed — a range of nothing to everything hits every time, and a point
 * estimate misses every time — so the panel refuses to lead with a single
 * score. That refusal is the lesson.
 */
export default function CalibrationPanel({ deals }: { deals: readonly ClosedDeal[] }) {
  const scored = resolvedForecasts(deals);
  const c = calibration(scored);
  const verdict = calibrationVerdict(c);

  if (c.count === 0) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Were you right?</h2>
        </div>
        <div className="empty">
          You have not committed a forecast yet. Before starting work on a house, say what you think
          it will clear &mdash; a range, not a number. After a few deals this becomes the only
          honest read on whether your underwriting is any good.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Were you right?</h2>
        <span className={`pill ${TONE[verdict]}`}>{LABEL[verdict]}</span>
      </div>
      <div className="panel-body">
        <div className="grid-2">
          <div className="kv total" style={{ marginTop: 0 }}>
            <span className="k">
              Landed inside your range
              <br />
              <span className="faint" style={{ fontSize: 11 }}>
                you claimed {percent(c.target, 0)}
              </span>
            </span>
            <span className="v">{percent(c.hitRate, 0)}</span>
          </div>
          <div className="kv total" style={{ marginTop: 0 }}>
            <span className="k">
              Average width
              <br />
              <span className="faint" style={{ fontSize: 11 }}>
                how precise a claim you made
              </span>
            </span>
            <span className="v">&plusmn;{percent(c.sharpness, 0)}</span>
          </div>
        </div>

        <p className="calib-verdict">{describeCalibration(c)}</p>

        {c.count >= MIN_FOR_VERDICT && (
          <ForecastStrip scored={c.scored} />
        )}

        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Deal</th>
                <th className="right">You said</th>
                <th className="right">It made</th>
                <th className="right">Miss</th>
              </tr>
            </thead>
            <tbody>
              {[...c.scored].reverse().map((s, i) => (
                <tr key={`${s.propertyId}-${i}`}>
                  <td>{deals.find((d) => d.propertyId === s.propertyId)?.address ?? s.propertyId}</td>
                  <td className="right num dim">
                    {money(s.low)} &ndash; {money(s.high)}
                  </td>
                  <td className={`right num ${s.hit ? 'good' : 'bad'}`}>{money(s.actual)}</td>
                  <td className="right num dim">
                    {s.hit ? (
                      <span className="faint">inside</span>
                    ) : (
                      <span className="warn">
                        {s.position < 0 ? 'under by ' : 'over by '}
                        {money(Math.abs(s.position < 0 ? s.actual - s.low : s.actual - s.high))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Every forecast on one axis, normalised so the range is the middle band.
 *
 * Normalising is what makes them comparable: a $40,000 range on a big deal and
 * a $6,000 range on a small one are the same claim, and plotting raw dollars
 * would say otherwise. What the eye is looking for is whether the misses sit
 * on one side, which is the difference between being imprecise and being
 * biased — and only the second one has an obvious fix.
 */
function ForecastStrip({ scored }: { scored: readonly { position: number; hit: boolean }[] }) {
  const W = 100;
  const H = 46;
  // Clamp the tails so one wild miss does not squash everything into the band.
  const clamp = (p: number) => Math.max(-0.6, Math.min(1.6, p));
  const x = (p: number) => ((clamp(p) + 0.6) / 2.2) * W;

  return (
    <div className="calib-strip">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block' }}
        role="img"
        aria-label={
          `${scored.filter((s) => s.hit).length} of ${scored.length} outcomes fell inside the ` +
          `forecast range. The table below lists each one.`
        }
      >
        {/* The band you claimed. */}
        <rect x={x(0)} y={4} width={x(1) - x(0)} height={H - 18} fill="var(--good)" fillOpacity="0.1" />
        <line x1={x(0)} x2={x(0)} y1={4} y2={H - 14} stroke="var(--good)" strokeOpacity="0.5" strokeWidth="0.4" />
        <line x1={x(1)} x2={x(1)} y1={4} y2={H - 14} stroke="var(--good)" strokeOpacity="0.5" strokeWidth="0.4" />

        {scored.map((s, i) => (
          <circle
            key={i}
            cx={x(s.position)}
            // Spread vertically so overlapping outcomes stay countable.
            cy={9 + ((i * 7) % (H - 28))}
            r="1.4"
            fill={s.hit ? 'var(--good)' : 'var(--bad)'}
            fillOpacity={s.hit ? 0.85 : 1}
          />
        ))}
      </svg>
      <div className="calib-axis">
        <span>came in under</span>
        <span className="mid">your range</span>
        <span>came in over</span>
      </div>
    </div>
  );
}

const LABEL: Record<string, string> = {
  'too-few': 'not enough yet',
  'well-calibrated': 'well calibrated',
  overconfident: 'too narrow',
  underconfident: 'too wide',
  optimistic: 'systematically optimistic',
  pessimistic: 'systematically pessimistic',
};

const TONE: Record<string, string> = {
  'too-few': 'info',
  'well-calibrated': 'good',
  overconfident: 'warn',
  underconfident: 'warn',
  optimistic: 'bad',
  pessimistic: 'bad',
};
