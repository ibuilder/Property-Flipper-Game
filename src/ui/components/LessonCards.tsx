import type { LessonCard } from '../../engine';

/**
 * Mistake-as-lesson cards.
 *
 * The tone rule matters more than the styling: this is "here is what happened
 * and what professionals do differently", never a scolding. So the cards are
 * warned rather than errored, the heading names the situation rather than the
 * player, and the advice always comes second.
 */
export default function LessonCards({ cards }: { cards: LessonCard[] }) {
  if (cards.length === 0) return null;

  return (
    <>
      {cards.map((c) => (
        <div
          key={c.id}
          style={{
            border: '1px solid #5c4a17',
            background: 'var(--warn-dim)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--warn)' }}>{c.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 8 }}>{c.whatHappened}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }} className="dim">
            <strong style={{ color: 'var(--text)' }}>What the pros do: </strong>
            {c.howProsAvoid}
          </div>
        </div>
      ))}
    </>
  );
}
