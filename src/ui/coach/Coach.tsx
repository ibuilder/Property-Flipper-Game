import { useMemo, useState } from 'react';
import { conceptProgress, noteCoachLine } from '../../engine';
import { ScoutPortrait } from '../components/Art';
import { useAction } from '../store';
import { useDealContext } from './context';
import { RULES, type CoachContext, type CoachRule } from './rules';

/**
 * Scout.
 *
 * Selection is the whole of the logic and it is deliberately small: take every
 * rule whose predicate passes, drop the ones on cooldown, the ones that have
 * used up their lifetime, and the ones teaching something the player has
 * already demonstrated twice; then take the highest priority. Ties break to
 * the concept with the least progress, so a player who keeps overpaying hears
 * about overpaying rather than about whichever rule sorted first.
 *
 * He never blocks input, never repeats a line inside its cooldown, and never
 * explains something you have proved you know. The mute is on the card
 * itself -- an off switch you have to go to Settings to find is not an off
 * switch, it is a dark pattern with a conscience.
 *
 * Firing history lives in the save now (`coachLog`), not in component state.
 * It used to be local, which meant cooldowns reset on every restart -- a long
 * campaign resumed the next day would repeat the line it gave yesterday, which
 * is precisely the nagging the cooldowns exist to prevent. It is the only
 * thing the coach writes, and it goes through an engine action so that stays
 * checkable.
 */

export default function Coach({ context: base }: { context: CoachContext }) {
  // Whatever screen is open publishes what it is looking at; the shell only
  // knows about the game state.
  const deal = useDealContext();
  const context: CoachContext = {
    ...base,
    property: deal.property ?? base.property,
    analysis: deal.analysis ?? base.analysis,
    offer: deal.offer ?? base.offer,
  };
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('flipper:coach') === 'off';
    } catch {
      return false;
    }
  });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const act = useAction();

  const { state } = context;
  const history = state.coachLog;
  const progress = useMemo(() => conceptProgress(state.closedDeals), [state.closedDeals.length]);

  const rule = useMemo(() => {
    if (muted) return null;
    const eligible = RULES.filter((r) => {
      const seen = history[r.id];
      if (seen && seen.count >= r.maxLifetime) return false;
      if (seen && state.day - seen.day < r.cooldownDays) return false;
      if (r.suppressAfterMastery && r.teaches) {
        if (progress.find((p) => p.id === r.teaches)?.mastered) return false;
      }
      try {
        return r.when(context);
      } catch {
        // A rule that throws is a rule that says nothing. It must never take
        // the screen down with it.
        return false;
      }
    });
    if (eligible.length === 0) return null;

    const leastProgress = (r: CoachRule) =>
      r.teaches ? (progress.find((p) => p.id === r.teaches)?.demonstrated ?? 0) : 99;

    return eligible.sort(
      (a, b) => b.priority - a.priority || leastProgress(a) - leastProgress(b),
    )[0];
  }, [muted, context, history, progress, state.day]);

  const setMute = (next: boolean) => {
    setMuted(next);
    try {
      localStorage.setItem('flipper:coach', next ? 'off' : 'on');
    } catch {
      /* the setting simply will not persist */
    }
  };

  if (muted) {
    return (
      <button className="coach-recall btn" onClick={() => setMute(false)}>
        Call Scout
      </button>
    );
  }

  if (!rule || dismissed === rule.id) return null;

  /*
   * Record the firing, once per game-day.
   *
   * Deferred to a microtask because this runs during render and the write goes
   * through the store; committing state mid-render is a loop waiting to
   * happen. The day check is what keeps it to one write rather than one per
   * re-render, which matters now the count is persisted and the lifetime cap
   * reads it.
   */
  const seen = history[rule.id];
  if (!seen || seen.day !== state.day) {
    queueMicrotask(() => act((s) => noteCoachLine(s, rule.id)));
  }

  let math: string | null = null;
  try {
    math = rule.math?.(context) ?? null;
  } catch {
    math = null;
  }

  return (
    <aside className={`coach blueprint mood-${rule.mood}`} role="status" aria-live="polite">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="coach-head">
        <span className="coach-portrait" aria-hidden="true">
          <ScoutPortrait mood={rule.mood} size={34} />
        </span>
        <div className="coach-who">
          <strong>Scout</strong>
          <span className="coach-role">· site foreman · {rule.mood}</span>
        </div>
        <div className="coach-controls">
          <button className="coach-x" onClick={() => setDismissed(rule.id)} title="Dismiss">
            ×
          </button>
          <button className="coach-x" onClick={() => setMute(true)} title="Mute Scout">
            mute
          </button>
        </div>
      </div>
      <p className="coach-line">{rule.line(context)}</p>
      {math && <p className="coach-math">{math}</p>}
    </aside>
  );
}

