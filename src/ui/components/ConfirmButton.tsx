import { useState, type ReactNode } from 'react';
import Modal from './Modal';

/**
 * A button that asks first, and says what it is about to do.
 *
 * Several actions in this game are irreversible and expensive: starting work
 * commits the whole scope in cash, accepting an offer closes the deal at that
 * price, an accepted purchase offer is binding. Before this, a single misplaced
 * click could spend six figures with no way back and no warning -- which made
 * the mouse a bigger risk than the underwriting.
 *
 * The dialog is deliberately not a bare "are you sure?". A confirmation that
 * carries no information trains people to dismiss it. This one restates the
 * amount and what it leaves behind, so reading it is worth the second it costs.
 */
export default function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  onConfirm,
  className = 'btn',
  disabled,
  danger,
  buttonTitle,
}: {
  label: ReactNode;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
  /** Tints the confirm button red, for actions that end something. */
  danger?: boolean;
  buttonTitle?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={className}
        disabled={disabled}
        title={buttonTitle}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>

      {open && (
        <Modal title={title} onClose={() => setOpen(false)} width={520}>
          <div className="panel-body" style={{ padding: 0 }}>
            {body}
            <div className="btn-row" style={{ marginTop: 18 }}>
              <button
                className={`btn ${danger ? 'danger' : 'primary'}`}
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </button>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
