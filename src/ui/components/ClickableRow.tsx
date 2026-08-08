import type { ReactNode } from 'react';

/**
 * A table row that behaves like a button.
 *
 * A bare `<tr onClick>` is invisible to keyboard and screen-reader users: it
 * has no role, no tab stop, and no Enter/Space handling. Since opening a
 * listing is the single most important action in the game, the row carries all
 * three.
 */
export default function ClickableRow({
  onActivate,
  selected,
  label,
  children,
}: {
  onActivate: () => void;
  selected?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <tr
      className={`clickable ${selected ? 'selected' : ''}`}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={selected}
    >
      {children}
    </tr>
  );
}
