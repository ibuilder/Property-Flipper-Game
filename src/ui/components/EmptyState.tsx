import type { ReactNode } from 'react';

/**
 * A screen with nothing in it yet, saying what will be in it.
 *
 * `.empty` was a single grey sentence in the middle of a very large
 * rectangle -- "No completed flips yet." -- on two of the six tabs a new
 * player clicks first out of curiosity. A player who has not sold anything
 * cannot tell from that whether the screen is broken, unfinished, or waiting,
 * and it is the screen that carries the entire argument that this game teaches
 * something.
 *
 * So the empty version does the job the full version will do: it names what
 * gets measured here, and says the one thing that would fill it in. `preview`
 * takes rows of label-and-placeholder so the reader sees the shape of the
 * answer before there is an answer, which is the difference between "nothing
 * here" and "not yet".
 */
export default function EmptyState({
  title,
  children,
  preview,
  hint,
}: {
  title: string;
  /** One or two sentences. What this screen is for. */
  children: ReactNode;
  /** The figures this screen will report, shown as dashes. */
  preview?: string[];
  /** The single action that fills it in. */
  hint?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-body">{children}</p>

      {preview && preview.length > 0 && (
        <div className="empty-state-preview" aria-hidden="true">
          {preview.map((label) => (
            <div key={label} className="empty-state-figure">
              <span className="empty-state-label">{label}</span>
              <span className="empty-state-dash">—</span>
            </div>
          ))}
        </div>
      )}

      {hint && <p className="empty-state-hint">{hint}</p>}
    </div>
  );
}
