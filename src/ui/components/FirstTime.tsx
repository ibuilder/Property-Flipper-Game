import { useCallback, useEffect, useState, type ReactNode } from 'react';

/**
 * A hint that appears once, where the decision is, and then never again.
 *
 * The alternative was a tour: five modals up front explaining screens you have
 * not seen yet, which people click through without reading and which then
 * cannot be consulted at the moment they would have helped. These appear
 * inline the first time you reach each place -- the first listing you open,
 * the first house you own, the first time you put one on the market -- and
 * dismiss permanently.
 *
 * The Help dialog remains the place to go back and read everything.
 */

const PREFIX = 'flipper:seen:';

function hasSeen(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === '1';
  } catch {
    // Private mode, or no storage: show the hint, which is the safe failure.
    return false;
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(PREFIX + key, '1');
  } catch {
    /* nothing to do; the hint simply reappears next session */
  }
}

/** Clears every hint, so they all show again. Exposed through the Help dialog. */
export function resetHints(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export default function FirstTime({
  id,
  title,
  children,
}: {
  /** Stable key. Changing it makes the hint show again for everyone. */
  id: string;
  title: string;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);

  // Read storage in an effect rather than during render: the value is not part
  // of React's state model, and reading it in the body makes the first paint
  // depend on it.
  useEffect(() => {
    setShow(!hasSeen(id));
  }, [id]);

  const dismiss = useCallback(() => {
    markSeen(id);
    setShow(false);
  }, [id]);

  if (!show) return null;

  return (
    <div className="first-time">
      <div className="ft-head">
        <strong>{title}</strong>
        <button className="btn small" onClick={dismiss} aria-label={`Dismiss hint: ${title}`}>
          Got it
        </button>
      </div>
      <div className="ft-body">{children}</div>
    </div>
  );
}
