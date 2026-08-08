import { LEVELS_BY_ID } from './content';
import { SAVE_VERSION } from './game';
import type { GameState } from './types';

/**
 * Save serialisation with explicit versioning.
 *
 * The original game wrote a bare JSON blob with no version marker, so any
 * change to the state shape turned every existing save into a crash. Here the
 * version travels with the file and unknown-but-newer saves are rejected
 * politely rather than half-loaded.
 */

export interface SaveFile {
  version: number;
  savedAt: string;
  state: GameState;
}

export function serialize(state: GameState): SaveFile {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
}

export class SaveError extends Error {}

/** Migrations keyed by the version they upgrade *from*. */
const MIGRATIONS: Record<number, (s: any) => any> = {
  // v1 predates neighborhood-level rate tracking.
  1: (s: any) => {
    s.world = s.world ?? {};
    s.world.baseRate = s.world.baseRate ?? s.world.interestRate ?? 0.065;
    s.closedDeals = s.closedDeals ?? [];
    s.distressDays = s.distressDays ?? 0;
    return s;
  },
};

export function deserialize(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new SaveError('Save file is not valid JSON.');
  const file = raw as Partial<SaveFile>;

  if (typeof file.version !== 'number') throw new SaveError('Save file has no version marker.');
  if (file.version > SAVE_VERSION) {
    throw new SaveError(
      `This save was written by a newer version of the game (v${file.version}). Update to open it.`,
    );
  }
  if (!file.state) throw new SaveError('Save file contains no game state.');

  let state: any = file.state;
  for (let v = file.version; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) state = migrate(state);
    state.version = v + 1;
  }

  validate(state);
  return state as GameState;
}

function validate(state: any): void {
  const required = ['day', 'cash', 'levelId', 'world', 'market', 'portfolio', 'skills'];
  for (const key of required) {
    if (state[key] === undefined) throw new SaveError(`Save file is missing "${key}".`);
  }
  if (!LEVELS_BY_ID[state.levelId]) {
    throw new SaveError(`Save file references an unknown level "${state.levelId}".`);
  }
  if (!Array.isArray(state.market) || !Array.isArray(state.portfolio)) {
    throw new SaveError('Save file has a malformed property list.');
  }
  state.loans = state.loans ?? [];
  state.ledger = state.ledger ?? [];
  state.log = state.log ?? [];
  state.closedDeals = state.closedDeals ?? [];
}
