import { useCallback, useSyncExternalStore } from 'react';
import {
  advanceDaysUntilAttention,
  createGame,
  createScenarioGame,
  deserialize,
  serialize,
  type ActionResult,
  type GameState,
  type Difficulty,
  type ScenarioDef,
} from '../engine';
import { cueForLog, play } from './sound';

/**
 * A deliberately small store.
 *
 * The engine mutates GameState in place, which keeps the simulation code plain
 * and fast, so React cannot rely on reference identity to detect changes.
 * Instead every action bumps a version counter and that is what components
 * subscribe to. This avoids deep-cloning a 900-day game state on every tick.
 */

interface Snapshot {
  state: GameState | null;
  version: number;
  toast: Toast | null;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

let snapshot: Snapshot = { state: null, version: 0, toast: null };
const listeners = new Set<() => void>();
let toastId = 0;

function emit(): void {
  snapshot = { ...snapshot, version: snapshot.version + 1 };
  listeners.forEach((l) => l());
}

/**
 * Sound the newest log line, if there is one.
 *
 * Driven off the engine's own log rather than off individual UI handlers: if
 * the simulation thought something was worth telling you about, that is
 * exactly the set of things worth hearing, and the two cannot drift apart.
 */
let lastSoundedLogLength = 0;

function soundNewLog(): void {
  const log = snapshot.state?.log;
  if (!log) {
    lastSoundedLogLength = 0;
    return;
  }
  if (log.length <= lastSoundedLogLength) {
    // Includes a fresh game or a loaded save, where the log can shrink.
    lastSoundedLogLength = log.length;
    return;
  }
  // Only the most significant of a batch -- advancing thirty days can produce
  // a dozen lines and playing all of them is a car alarm.
  const fresh = log.slice(lastSoundedLogLength);
  lastSoundedLogLength = log.length;
  const rank = { bad: 3, warn: 2, good: 1, info: 0 } as const;
  const worst = fresh.reduce((a, b) => (rank[b.tone] > rank[a.tone] ? b : a));
  const cue = cueForLog(worst.tone, worst.message);
  if (cue) play(cue);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

export function useStore(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useGame(): GameState | null {
  return useStore().state;
}

/**
 * The store's change counter.
 *
 * Because the engine mutates GameState in place, `gameState.version` is the
 * save-format version and never changes during play -- using it as a useMemo
 * dependency silently freezes the memo. Depend on this instead.
 */
export function useVersion(): number {
  return useStore().version;
}

/** Run an engine action and surface its message as a toast. */
export function useAction() {
  return useCallback((fn: (state: GameState) => ActionResult): ActionResult => {
    if (!snapshot.state) return { ok: false, message: 'No game in progress.' };
    let result: ActionResult;
    try {
      result = fn(snapshot.state);
    } catch (err) {
      result = { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
    toastId += 1;
    snapshot.toast = { id: toastId, message: result.message, tone: result.ok ? 'ok' : 'error' };
    // A refused action never reaches the log, so give it its own sound.
    if (!result.ok) play('warn');
    else soundNewLog();
    emit();
    return result;
  }, []);
}

export function dismissToast(): void {
  snapshot.toast = null;
  emit();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export function startGame(levelId: string, seed?: number, difficulty?: Difficulty): void {
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  snapshot.state = createGame(levelId, actualSeed, difficulty);
  snapshot.toast = null;
  emit();
}

export function startScenario(def: ScenarioDef, seed?: number): void {
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  snapshot.state = createScenarioGame(def, actualSeed);
  snapshot.toast = null;
  emit();
}

export function quitToMenu(): void {
  snapshot.state = null;
  emit();
}

const STOP_MESSAGE: Record<string, string> = {
  offer: 'An offer came in.',
  setback: 'Something went wrong.',
  gameOver: 'The campaign is over.',
};

/** Skip ahead, stopping early when the simulation says something needs a decision. */
export function advanceDays(count: number): void {
  const state = snapshot.state;
  if (!state) return;

  const result = advanceDaysUntilAttention(state, count);
  soundNewLog();
  if (result.stoppedEarly && result.daysAdvanced < count) {
    toastId += 1;
    snapshot.toast = {
      id: toastId,
      message: `${STOP_MESSAGE[result.reason] ?? 'Stopped.'} Day ${state.day}.`,
      tone: result.reason === 'setback' ? 'error' : 'ok',
    };
  }
  emit();
}

// ---------------------------------------------------------------------------
// Persistence
//
// The renderer has no filesystem access; everything goes through the narrow
// preload bridge. When running in a plain browser (dev, or the web build) the
// bridge is absent and we fall back to localStorage.
// ---------------------------------------------------------------------------

interface Bridge {
  saves: {
    write(slot: string, data: unknown): Promise<{ ok: boolean }>;
    read(slot: string): Promise<{ ok: boolean; data?: unknown; error?: string }>;
    list(): Promise<{ ok: boolean; saves: { slot: string; modified: string }[] }>;
    remove(slot: string): Promise<{ ok: boolean }>;
    exportToFile(data: unknown): Promise<{ ok: boolean; path?: string }>;
    importFromFile(): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  };
}

function bridge(): Bridge | null {
  return (globalThis as unknown as { flipper?: Bridge }).flipper ?? null;
}

export const hasNativeBridge = (): boolean => bridge() !== null;

export async function saveGame(slot: string): Promise<ActionResult> {
  if (!snapshot.state) return { ok: false, message: 'Nothing to save.' };
  const payload = serialize(snapshot.state);
  const api = bridge();
  try {
    if (api) {
      await api.saves.write(slot, payload);
    } else {
      localStorage.setItem(`flipper:save:${slot}`, JSON.stringify(payload));
    }
    return { ok: true, message: `Saved to "${slot}".` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Save failed.' };
  }
}

export async function loadGame(slot: string): Promise<ActionResult> {
  const api = bridge();
  try {
    let raw: unknown;
    if (api) {
      const res = await api.saves.read(slot);
      if (!res.ok) return { ok: false, message: res.error ?? 'No save found.' };
      raw = res.data;
    } else {
      const stored = localStorage.getItem(`flipper:save:${slot}`);
      if (!stored) return { ok: false, message: 'No save found.' };
      raw = JSON.parse(stored);
    }
    snapshot.state = deserialize(raw);
    emit();
    return { ok: true, message: 'Game loaded.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Load failed.' };
  }
}

export async function listSaves(): Promise<{ slot: string; modified: string }[]> {
  const api = bridge();
  if (api) {
    const res = await api.saves.list();
    return res.saves ?? [];
  }
  return Object.keys(localStorage)
    .filter((k) => k.startsWith('flipper:save:'))
    .map((k) => ({ slot: k.replace('flipper:save:', ''), modified: '' }));
}

export async function deleteSave(slot: string): Promise<void> {
  const api = bridge();
  if (api) await api.saves.remove(slot);
  else localStorage.removeItem(`flipper:save:${slot}`);
}

export async function exportSave(): Promise<ActionResult> {
  if (!snapshot.state) return { ok: false, message: 'Nothing to export.' };
  const api = bridge();
  if (!api) return { ok: false, message: 'Export is only available in the desktop app.' };
  const res = await api.saves.exportToFile(serialize(snapshot.state));
  return res.ok
    ? { ok: true, message: `Exported to ${res.path}` }
    : { ok: false, message: 'Export cancelled.' };
}

export async function importSave(): Promise<ActionResult> {
  const api = bridge();
  if (!api) return { ok: false, message: 'Import is only available in the desktop app.' };
  const res = await api.saves.importFromFile();
  if (!res.ok) return { ok: false, message: res.error ?? 'Import cancelled.' };
  try {
    snapshot.state = deserialize(res.data);
    emit();
    return { ok: true, message: 'Save imported.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'That file is not a valid save.' };
  }
}

/** Autosave hook used after each day tick. */
export async function autosave(): Promise<void> {
  if (!snapshot.state) return;
  await saveGame('autosave');
}
