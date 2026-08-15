import { marketNews, quietWeek, type GameState } from '../../engine';
import { gameDate } from '../format';
import { Press, hasPress } from './Art';

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
        <div className="plat-title">
          <Press name="masthead-the_weekly_plat" title="The Weekly Plat" />
        </div>
        <div className="plat-dateline">
          Kesslerville &middot; Week {week} &middot; {gameDate(state.day)}
        </div>
      </div>

      {quiet && <p className="plat-quiet">{quiet}</p>}

      {items.map((item) => {
        const plate = plateFor(item.id);
        return (
        <article key={item.id} className="plat-item">
          <div className="plat-kicker">{item.kicker}</div>
          {plate ? (
            /*
             * Set in wood-type when there is a plate for this event. The
             * engine's own headline goes on as the accessible name, so the
             * text is never only available as a picture.
             */
            <h3 className="plat-headline plat-headline-set">
              <Press name={plate} title={item.headline} />
            </h3>
          ) : (
            <h3 className="plat-headline">{item.headline}</h3>
          )}
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
        );
      })}
    </aside>
  );
}

/**
 * Which headline plate belongs to a news item.
 *
 * Every market event now has one. The two that used to name events this game
 * does not have -- `zoning_shift` and `mill_rezoned` -- were redrawn as
 * `school_rezoning` and `revitalization` rather than renamed, so the drawn
 * words match the story underneath them.
 *
 * Keyed off the definition id inside the item id, which is built as
 * `event:<defId>:<startedDay>`.
 */
export const PLATES: Record<string, string> = {
  housing_boom: 'plate-boom',
  correction: 'plate-slump',
  rate_cut: 'plate-rates_cut',
  rate_hike: 'plate-rates_spike',
  school_rezoning: 'plate-school_rezoning',
  revitalization: 'plate-revitalization',
  lumber_spike: 'plate-lumber_spike',
  labor_shortage: 'plate-labor_shortage',
  permit_backlog: 'plate-permit_backlog',
  employer_exit: 'plate-employer_exit',
};

function plateFor(itemId: string): string | null {
  const [kind, defId] = itemId.split(':');
  if (kind !== 'event') return null;
  const name = PLATES[defId];
  return name && hasPress(name) ? name : null;
}
