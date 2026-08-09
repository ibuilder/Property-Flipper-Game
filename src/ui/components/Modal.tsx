import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Which dialogs are currently open, innermost last.
 *
 * A confirmation dialog opens on top of the property dialog that launched it.
 * Both listen for Escape on the document at capture phase, where
 * stopPropagation does not stop a sibling listener on the same node -- so
 * without this, one Escape closed both and the player lost their whole scope.
 * Only the dialog on top of the stack responds.
 */
const stack: symbol[] = [];

/**
 * Accessible modal shell.
 *
 * The hand-rolled backdrops this replaces had none of the behaviour a dialog
 * is expected to have: Escape did nothing, focus stayed on whatever was behind
 * the overlay, and screen readers were never told a dialog had opened. Since
 * the property dialogs are where nearly all of the game's decisions are made,
 * that was the least accessible part of the app.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  width,
  dismissable = true,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  /** Outcome dialogs are terminal, so they cannot be dismissed. */
  dismissable?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const token = useRef<symbol>(Symbol('modal'));

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    // Move focus into the dialog so the keyboard lands somewhere sensible.
    panelRef.current?.focus();

    const me = token.current;
    stack.push(me);
    const isTopmost = () => stack[stack.length - 1] === me;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (e.key === 'Escape' && dismissable && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Keep Tab inside the dialog.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    // Stop the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const at = stack.indexOf(me);
      if (at >= 0) stack.splice(at, 1);
      // Only the last dialog to close should restore the page's scrolling.
      if (stack.length === 0) document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [onClose, dismissable]);

  return (
    <div
      className="modal-backdrop"
      onClick={dismissable ? onClose : undefined}
      role="presentation"
    >
      <div
        className="modal"
        style={width ? { maxWidth: width } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          {dismissable && onClose && (
            <button className="close-x" onClick={onClose} aria-label="Close dialog">
              &times;
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
