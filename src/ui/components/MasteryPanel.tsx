import {
  CONCEPTS,
  DEMONSTRATIONS_FOR_MASTERY,
  conceptProgress,
  describeMastery,
  type ClosedDeal,
} from '../../engine';

/**
 * What you have proved, as opposed to what you have been told.
 *
 * The handoff's rule is that every node names the proof, not a cost: skills
 * are earned by demonstration, there is no second currency and nothing to
 * spend. That is the whole difference between this and the skills tree beside
 * it -- one is what you bought, this is what you have shown you can do.
 *
 * Nodes are diamonds because a diamond is not a checkbox. A checkbox is a
 * thing you tick off a list; these are supposed to read as survey marks on a
 * drawing, and the shape does more work there than any label would.
 */
export default function MasteryPanel({ deals }: { deals: readonly ClosedDeal[] }) {
  const progress = conceptProgress(deals);
  const summary = describeMastery(progress);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Mastery</h2>
        <span className="dim" style={{ fontSize: 12 }}>
          {progress.filter((p) => p.mastered).length} of {progress.length} demonstrated
        </span>
      </div>
      <div className="panel-body">
        <p className="dim" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.55 }}>
          Nothing here is bought. Each one is earned by doing it{' '}
          {DEMONSTRATIONS_FOR_MASTERY} times in deals you actually closed &mdash; once is luck, and
          the difference matters more here than anywhere else in the game.
        </p>

        <div className="mastery-grid">
          {CONCEPTS.map((concept) => {
            const p = progress.find((x) => x.id === concept.id)!;
            const state = p.mastered ? 'earned' : p.demonstrated > 0 ? 'partial' : 'locked';
            return (
              <div key={concept.id} className={`mastery-node ${state}`}>
                <span className="mastery-diamond" aria-hidden="true" />
                <div className="mastery-body">
                  <div className="mastery-name">{concept.name}</div>
                  {/* The proof, never a price. */}
                  <div className="mastery-proof">{concept.proof}</div>
                  <div className="mastery-count">
                    {p.demonstrated} of {DEMONSTRATIONS_FOR_MASTERY}
                    {p.deals.length > 0 && (
                      <span className="faint"> &middot; {p.deals.slice(-2).join(', ')}</span>
                    )}
                  </div>
                  <div className="mastery-failure">
                    The failure it prevents: {concept.failureMode.toLowerCase()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {summary && (
          <p className="faint" style={{ fontSize: 12, lineHeight: 1.5, margin: '12px 0 0' }}>
            {summary}
          </p>
        )}
      </div>
    </div>
  );
}
