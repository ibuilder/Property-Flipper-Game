import { useState } from 'react';
import { TOUR } from '../../engine';

/**
 * The seven steps, in a strip above the screen they teach on.
 *
 * Not a modal and not a spotlight overlay. Both of those stop the game to
 * explain the game, which is the thing that makes tutorials feel like homework
 * — and both would fight the one rule this interface actually has, which is
 * that the panel re-prices as you touch it. You cannot learn that from a
 * dialog sitting on top of it.
 *
 * So it is a strip you can read, ignore, or dismiss, sitting where the screen
 * it describes already is. Each step names the *decision*, not the control: a
 * player can find a panel, but they cannot yet know which of the four numbers
 * on it is the one that matters.
 *
 * Position lives in the browser rather than the save. A half-finished tour is
 * not worth carrying between machines, and keeping it out of the save means
 * the tutorial gate has no state that can disagree with itself.
 */
const KEY = 'flipper:tour';

export default function TourCard({ tab }: { tab: string }) {
  const [step, setStep] = useState(() => {
    try {
      const raw = Number(localStorage.getItem(KEY));
      return Number.isFinite(raw) && raw >= 0 && raw < TOUR.length ? raw : 0;
    } catch {
      return 0;
    }
  });
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'off';
    } catch {
      return false;
    }
  });

  const save = (next: number | 'off') => {
    try {
      localStorage.setItem(KEY, String(next));
    } catch {
      /* the position simply will not persist */
    }
  };

  if (hidden) {
    return (
      <button
        className="btn tour-recall"
        onClick={() => {
          setHidden(false);
          save(step);
        }}
      >
        Show the walkthrough
      </button>
    );
  }

  const current = TOUR[step];
  // Steps are written for a screen. Saying so beats silently describing
  // something the player is not looking at.
  const elsewhere = current.tab !== tab;

  return (
    <section className="tour blueprint" aria-label="Walkthrough">
      <span className="corner tl" />
      <span className="corner br" />

      <div className="tour-head">
        <span className="tour-count">
          Step {step + 1} of {TOUR.length}
        </span>
        <div className="tour-controls">
          <button
            className="btn small"
            disabled={step === 0}
            onClick={() => {
              const next = step - 1;
              setStep(next);
              save(next);
            }}
          >
            Back
          </button>
          <button
            className="btn small primary"
            disabled={step === TOUR.length - 1}
            onClick={() => {
              const next = step + 1;
              setStep(next);
              save(next);
            }}
          >
            Next
          </button>
          <button
            className="btn small"
            onClick={() => {
              setHidden(true);
              save('off');
            }}
          >
            Hide
          </button>
        </div>
      </div>

      <h3 className="tour-title">{current.title}</h3>
      <p className="tour-body">{current.body}</p>
      {elsewhere && (
        <p className="tour-where">
          This one is about the {current.tab === 'market' ? 'Market' : 'Portfolio'} tab.
        </p>
      )}
    </section>
  );
}
