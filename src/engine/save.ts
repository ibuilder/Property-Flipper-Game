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
  // v2 predates the charts, so it carries no time series. Seed one point from
  // the current state rather than leaving the charts empty -- a loaded save
  // then starts plotting from where it was rather than from nothing.
  2: (s: any) => {
    if (!Array.isArray(s.history) || s.history.length === 0) {
      s.history = [
        {
          day: s.day ?? 1,
          marketIndex: s.world?.marketIndex ?? 1,
          interestRate: s.world?.interestRate ?? 0.065,
          netWorth: Math.round(s.cash ?? 0),
          cash: Math.round(s.cash ?? 0),
          debt: 0,
          neighborhoods: { ...(s.world?.neighborhoodIndex ?? {}) },
        },
      ];
    }
    return s;
  },
  // v3 predates comp selection, seller archetypes, and deal projections.
  // Properties are rebuilt lazily: an empty compPool is repopulated by the
  // next appraisal refresh, which happens on the first day advance.
  3: (s: any) => {
    for (const prop of [...(s.market ?? []), ...(s.portfolio ?? [])]) {
      prop.compPool = prop.compPool ?? [];
      prop.selectedComps = prop.selectedComps ?? [];
      prop.sellerType = prop.sellerType ?? 'retail';
      prop.appraisal = prop.appraisal ?? { point: 0, low: 0, high: 0, confidence: 'comps', comps: [] };
      prop.appraisal.fitScore = prop.appraisal.fitScore ?? 0.5;
      if (prop.ownership) prop.ownership.projection = prop.ownership.projection ?? null;
    }
    for (const deal of s.closedDeals ?? []) {
      deal.postMortem = deal.postMortem ?? null;
    }
    return s;
  },
  // v4 predates authored scenarios; campaign saves simply have none.
  4: (s: any) => {
    s.scenarioId = s.scenarioId ?? null;
    s.scenario = s.scenario ?? null;
    return s;
  },
  // v5 predates reputation, rival buyers, and financed buyer offers. An old
  // save resumes at neutral standing with no competition on its listings.
  5: (s: any) => {
    s.reputation = s.reputation ?? { lenders: 50, agents: 50, contractors: 50 };
    for (const prop of [...(s.market ?? []), ...(s.portfolio ?? [])]) {
      if (prop.listing) prop.listing.competition = prop.listing.competition ?? 0.3;
      const offers = prop.ownership?.saleListing?.offers;
      for (const o of offers ?? []) {
        // Existing offers become cash offers, which cannot fall through on an
        // appraisal -- the safe reading of an ambiguous old save.
        o.financed = o.financed ?? false;
        o.appraisedValue = o.appraisedValue ?? Number.MAX_SAFE_INTEGER;
      }
    }
    return s;
  },
  // v6 predates the before/after snapshots. Older deals simply have none, and
  // the UI omits the panel rather than inventing a picture that was never taken.
  6: (s: any) => {
    for (const prop of s.portfolio ?? []) {
      if (prop.ownership) prop.ownership.boughtAs = prop.ownership.boughtAs ?? null;
    }
    for (const deal of s.closedDeals ?? []) {
      deal.before = deal.before ?? null;
      deal.after = deal.after ?? null;
    }
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
  state.history = state.history ?? [];
}
