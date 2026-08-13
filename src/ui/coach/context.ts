import { useSyncExternalStore } from 'react';
import type { DealAnalysis, Property } from '../../engine';

/**
 * What the screen currently in front of the player is looking at.
 *
 * Scout is mounted once, at the shell, so he survives a tab change and keeps
 * one firing history. But his sharpest lines are about a deal being priced
 * right now, and that lives inside the buy modal several levels down.
 *
 * Passing it down would mean threading a coach prop through every screen, and
 * mounting a second Coach inside the modal would give it a second, empty
 * cooldown history -- so the same line could fire twice by walking in and out
 * of a dialog. A tiny published store keeps one coach and one history.
 */

export interface DealContext {
  property: Property | null;
  analysis: DealAnalysis | null;
  offer: number | null;
}

const EMPTY: DealContext = { property: null, analysis: null, offer: null };

let current: DealContext = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function setDealContext(next: DealContext): void {
  // Reference-compared by the store, so only publish on a real change or the
  // subscriber re-renders on every keystroke in the offer box.
  if (
    current.property === next.property &&
    current.analysis === next.analysis &&
    current.offer === next.offer
  ) {
    return;
  }
  current = next;
  emit();
}

export function clearDealContext(): void {
  if (current === EMPTY) return;
  current = EMPTY;
  emit();
}

export function useDealContext(): DealContext {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => EMPTY,
  );
}
