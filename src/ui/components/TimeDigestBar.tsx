import { NEIGHBORHOODS_BY_ID, digestHeadline, type TimeDigest } from '../../engine';
import { money, percent } from '../format';
import { dismissDigest } from '../store';

/**
 * What moved while you skipped ahead.
 *
 * Almost every day in a campaign is silent — measured at 97%, with stretches
 * of over a hundred days — so pressing "+30d" used to produce no response at
 * all unless something dramatic happened. Waiting is a legitimate and often
 * correct strategy here, because listings get cheaper the longer they sit, and
 * the game gave no way to see that working.
 *
 * Nothing here is invented. Every figure is a diff of two real moments.
 */
export default function TimeDigestBar({ digest }: { digest: TimeDigest }) {
  const d = digest;
  const mover = d.moverId ? NEIGHBORHOODS_BY_ID[d.moverId]?.name : null;

  return (
    <div className="digest" role="status">
      <div className="digest-main">
        <span className="digest-span">
          {d.days}d
          <span className="faint"> to day {d.toDay}</span>
        </span>
        <span className="digest-headline">{digestHeadline(d)}</span>
        <button className="digest-close" onClick={dismissDigest} aria-label="Dismiss summary">
          &times;
        </button>
      </div>

      <div className="digest-facts">
        {d.carryPaid !== 0 && (
          <span className="fact">
            <b>Carry</b>
            <span className="bad">{money(d.carryPaid)}</span>
          </span>
        )}
        {d.netWorthDelta !== 0 && (
          <span className="fact">
            <b>Net worth</b>
            <span className={d.netWorthDelta >= 0 ? 'good' : 'bad'}>
              {d.netWorthDelta >= 0 ? '+' : ''}
              {money(d.netWorthDelta)}
            </span>
          </span>
        )}
        {d.cutCount > 0 && (
          <span className="fact">
            <b>Price cuts</b>
            <span>{d.cutCount}</span>
          </span>
        )}
        {d.newListings > 0 && (
          <span className="fact">
            <b>New</b>
            <span>{d.newListings}</span>
          </span>
        )}
        {d.listingsLost > 0 && (
          <span className="fact">
            <b>Gone</b>
            <span className="warn">
              {d.listingsLost}
              {/* Named when it was one you were following. A count is a
                  statistic; the address is the thing worth reading. */}
              {d.watchedLost.length > 0 && (
                <span className="faint"> · incl. {d.watchedLost.join(', ')}</span>
              )}
            </span>
          </span>
        )}
        {Math.abs(d.marketIndexDelta) > 0.002 && (
          <span className="fact">
            <b>Market</b>
            <span className={d.marketIndexDelta >= 0 ? 'good' : 'bad'}>
              {d.marketIndexDelta >= 0 ? '+' : ''}
              {(d.marketIndexDelta * 100).toFixed(1)}%
            </span>
          </span>
        )}
        {Math.abs(d.rateDelta) > 0.0005 && (
          <span className="fact">
            <b>Rate</b>
            <span className={d.rateDelta <= 0 ? 'good' : 'bad'}>
              {d.rateDelta >= 0 ? '+' : ''}
              {percent(d.rateDelta, 2)}
            </span>
          </span>
        )}
        {mover && Math.abs(d.moverDelta) > 0.005 && (
          <span className="fact">
            <b>{mover}</b>
            <span className={d.moverDelta >= 0 ? 'good' : 'bad'}>
              {d.moverDelta >= 0 ? '+' : ''}
              {(d.moverDelta * 100).toFixed(1)}%
            </span>
          </span>
        )}
        {d.jobsRunning.map((j) => (
          <span className="fact" key={j.address}>
            <b>{j.address}</b>
            <span>{j.daysLeft > 0 ? `${j.daysLeft}d of work left` : 'work done'}</span>
          </span>
        ))}
        {d.onMarket.map((m) => (
          <span className="fact" key={m.address}>
            <b>{m.address}</b>
            <span className={m.daysOnMarket > 60 ? 'warn' : ''}>
              {m.daysOnMarket}d on market
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
