import { marketNews, quietWeek, type GameState } from '../../engine';
import { gameDate } from '../format';

/**
 * The Weekly Plat.
 *
 * A masthead rather than a notification tray, because the framing changes how
 * it is read: a feed of alerts is something you dismiss, and a paper is
 * something you scan. The game already had a log — this is not that. The log
 * says what happened to *you*; this says what is happening to the market, and
 * every item ends by naming what that does to your board.
 *
 * The effect lines are computed in the engine from each event's own modifiers,
 * never written. That is the whole reason this is a teaching surface rather
 * than set dressing: it cannot tell you the market softened by 4% while the
 * simulation quietly does something else.
 */
export default function NewsRail({ state }: { state: GameState }) {
  const items = marketNews(state);
  const quiet = quietWeek(state);
  const week = Math.max(1, Math.ceil(state.day / 7));

  return (
    <aside className="plat" aria-label="Market news">
      <div className="plat-masthead">
        <div className="plat-title">The Weekly Plat</div>
        <div className="plat-dateline">
          Kesslerville &middot; Week {week} &middot; {gameDate(state.day)}
        </div>
      </div>

      {quiet && <p className="plat-quiet">{quiet}</p>}

      {items.map((item) => (
        <article key={item.id} className="plat-item">
          <div className="plat-kicker">{item.kicker}</div>
          <h3 className="plat-headline">{item.headline}</h3>
          <p className="plat-body">{item.body}</p>

          {/* The reason this exists. Derived, so it cannot drift from the
              simulation it is describing. */}
          {item.effects.map((e, i) => (
            <p key={i} className="plat-effect">
              {e}
            </p>
          ))}

          {item.daysRemaining > 0 && (
            <div className="plat-meta">{item.daysRemaining} days left</div>
          )}
        </article>
      ))}
    </aside>
  );
}
