/**
 * Which ground the drawing is on.
 *
 * The Industry system in the 3.0 handoff is specified on a light technical
 * ground. This ships dark by default anyway, and not as a compromise: a
 * blueprint is a cyanotype, and the handoff's own dark treatment is exactly
 * that palette. Light remains a real option rather than a courtesy, because a
 * classroom projector and a printed handout both want paper, and this is meant
 * to be teachable in a room.
 *
 * Stored as an explicit choice only. There is no "system" setting: the OS
 * preference decides the *initial* value on a machine that has never chosen,
 * and after that the player's choice is the one that counts -- a game that
 * silently repaints itself when the OS flips at sunset is a bug, not a
 * feature.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'flipper:theme';

let current: Theme = read();
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* fall through to the default */
  }
  // Never chosen on this machine. Follow the OS once, then stop listening.
  try {
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  } catch {
    /* no matchMedia; dark it is */
  }
  return 'dark';
}

export function theme(): Theme {
  return current;
}

export function setTheme(next: Theme): void {
  current = next;
  apply();
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* the setting simply will not persist */
  }
  for (const fn of listeners) fn();
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Write the choice onto the document element.
 *
 * Dark is the bare `:root` block rather than a `[data-theme="dark"]` one, so
 * the attribute is only ever set for light. That means the default paints
 * correctly even before this module has run.
 */
export function apply(): void {
  const root = document.documentElement;
  if (current === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
