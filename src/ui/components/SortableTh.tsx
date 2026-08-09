import type { ReactNode } from 'react';

/**
 * A column header you can sort by.
 *
 * The listings table used to be sorted from a dropdown that offered five of
 * the twelve columns, which meant the obvious gesture -- click the column you
 * care about -- did nothing at all. Clicking a header sorts by it; clicking
 * again reverses. The arrow says which way, and aria-sort says the same thing
 * to a screen reader.
 */
export default function SortableTh<K extends string>({
  id,
  label,
  active,
  descending,
  onSort,
  align = 'left',
  title,
}: {
  id: K;
  label: ReactNode;
  active: K | null;
  descending: boolean;
  onSort: (key: K) => void;
  align?: 'left' | 'right';
  title?: string;
}) {
  const isActive = active === id;
  return (
    <th
      className={align === 'right' ? 'right' : undefined}
      aria-sort={isActive ? (descending ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        className={`th-sort${isActive ? ' active' : ''}`}
        onClick={() => onSort(id)}
        title={title ?? `Sort by ${typeof label === 'string' ? label.toLowerCase() : id}`}
      >
        {align === 'right' && isActive && <span className="arrow">{descending ? '▼' : '▲'}</span>}
        <span>{label}</span>
        {align !== 'right' && isActive && <span className="arrow">{descending ? '▼' : '▲'}</span>}
      </button>
    </th>
  );
}
