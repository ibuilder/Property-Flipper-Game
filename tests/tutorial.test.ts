import { describe, expect, it } from 'vitest';
import {
  SCENARIOS,
  TOUR,
  TUTORIAL,
  TUTORIAL_ID,
  analyzeDeal,
  createGame,
  estimateArv,
  isTutorial,
  isUnlocked,
  lockReason,
  createScenarioGame,
  tutorialComplete,
} from '../src/engine';
import { DEFECTS_BY_ID } from '../src/engine/content';

const TABS = ['market', 'auction', 'portfolio', 'finance', 'skills', 'deals'];

describe('the first fifteen minutes', () => {
  it('is one house and no market', () => {
    // `distractors: 0` is what makes it a tutorial rather than a small level.
    expect(TUTORIAL.distractors).toBe(0);
    const state = createScenarioGame(TUTORIAL, 1);
    expect(state.market).toHaveLength(1);
  });

  it('gives the house defects that exist and are survivable', () => {
    // A major must-fix on the first deal teaches "this game is unfair" before
    // it teaches anything about disclosure.
    expect(TUTORIAL.property.defectIds.length).toBeGreaterThan(0);
    for (const id of TUTORIAL.property.defectIds) {
      const def = DEFECTS_BY_ID[id];
      expect(def, `unknown defect ${id}`).toBeDefined();
      expect(def.severity, `${id} is too harsh for a first deal`).not.toBe('major');
    }
  });

  it('is winnable even by someone who pays the asking price', () => {
    /*
     * The right test is the itemised maximum offer against the ask, not the
     * as-is appraisal against the ask. A distressed house is *supposed* to be
     * listed near or above what it is worth today -- the money is in what it
     * becomes. `maoDetailed` is the number that already accounts for that, so
     * a first-timer who pays full ask should still be inside it.
     *
     * Checked across several seeds because the comp pool is noisy, and a
     * tutorial that is only forgiving on some seeds is not forgiving.
     */
    for (const seed of [1, 7, 42, 909, 5678]) {
      const state = createScenarioGame(TUTORIAL, seed);
      const prop = state.market[0];
      expect(prop.listing, `seed ${seed}`).toBeTruthy();

      const scope = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];
      const arv = estimateArv(prop, state.world, state.day, scope);
      const analysis = analyzeDeal(prop, state.world, state.day, arv, scope, state.skills, {});
      expect(
        analysis.maoDetailed,
        `seed ${seed}: paying the ask loses money before the player has learned anything`,
      ).toBeGreaterThan(prop.listing!.askPrice);
    }
  });

  it('is the front door, listed first', () => {
    expect(SCENARIOS[0].id).toBe(TUTORIAL_ID);
  });
});

describe('the gate', () => {
  it('shuts everything but the deal until a flip is closed', () => {
    const state = createScenarioGame(TUTORIAL, 1);
    expect(isTutorial(state)).toBe(true);
    expect(tutorialComplete(state)).toBe(false);

    expect(isUnlocked(state, 'market')).toBe(true);
    expect(isUnlocked(state, 'portfolio')).toBe(true);
    for (const tab of ['auction', 'finance', 'skills', 'deals']) {
      expect(isUnlocked(state, tab), tab).toBe(false);
    }
  });

  it('opens on a closed deal', () => {
    const state = createScenarioGame(TUTORIAL, 1);
    state.closedDeals.push({ address: 'x' } as never);
    expect(tutorialComplete(state)).toBe(true);
    for (const tab of TABS) expect(isUnlocked(state, tab), tab).toBe(true);
  });

  it('opens on a loss too, because being trapped in a failed tutorial is worse', () => {
    // Win *or* lose. The gate exists to stop a stranger reading the town
    // screen cold, not to enforce a standard.
    const state = createScenarioGame(TUTORIAL, 1);
    state.phase = 'lost';
    expect(tutorialComplete(state)).toBe(true);
    for (const tab of TABS) expect(isUnlocked(state, tab), tab).toBe(true);
  });

  it('never gates an ordinary campaign', () => {
    const state = createGame('first_flip', 1);
    expect(isTutorial(state)).toBe(false);
    for (const tab of TABS) expect(isUnlocked(state, tab), tab).toBe(true);
  });

  it('never gates the other authored lessons', () => {
    // They are single-deal too, but they are for players who have already been
    // through the front door.
    for (const s of SCENARIOS.filter((x) => x.id !== TUTORIAL_ID)) {
      const state = createScenarioGame(s, 1);
      expect(isUnlocked(state, 'finance'), s.id).toBe(true);
    }
  });

  it('explains every lock rather than just refusing', () => {
    for (const tab of ['auction', 'finance', 'skills', 'deals']) {
      const why = lockReason(tab);
      expect(why.length, tab).toBeGreaterThan(20);
      // A reason, not a restatement of the fact that it is locked.
      expect(why, tab).toMatch(/closed|flip|track record/i);
    }
  });

  it('adds no save state to disagree with itself', () => {
    // The gate is derived from scenarioId and closedDeals, both of which the
    // save already carries. If a `tutorial` field ever appears here, the
    // migration and the derivation can drift apart.
    const state = createScenarioGame(TUTORIAL, 1);
    expect(Object.keys(state)).not.toContain('tutorial');
  });
});

describe('the tour', () => {
  it('has seven steps, each on a screen that exists during the tutorial', () => {
    expect(TOUR).toHaveLength(7);
    for (const step of TOUR) {
      expect(['market', 'portfolio']).toContain(step.tab);
    }
  });

  it('names the decision rather than the control', () => {
    // A player can find a panel. What they cannot do yet is know which of the
    // four numbers on it matters.
    for (const step of TOUR) {
      expect(step.body.length).toBeGreaterThan(60);
      expect(step.body, step.title).not.toMatch(/click|press|button|tab on the/i);
    }
  });

  it('follows the deal in order', () => {
    // Value, then condition, then scope, then price: the sequence *is* the
    // lesson, so a reordering should fail rather than merely read oddly.
    const titles = TOUR.map((s) => s.title.toLowerCase());
    expect(titles[1]).toMatch(/worth/);
    expect(titles[2]).toMatch(/wrong with it/);
    expect(titles[3]).toMatch(/work/);
    expect(titles[4]).toMatch(/offer/);
    expect(titles[5]).toMatch(/day|cost/);
    expect(titles[6]).toMatch(/sell/);
  });
});
