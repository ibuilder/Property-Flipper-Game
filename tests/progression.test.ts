import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_META,
  ECON,
  advanceDay,
  campaignDayLimit,
  createGame,
  crewFactors,
  crewUtilisation,
  difficultyMods,
  disbandCrew,
  hireCrew,
  initialExperience,
  isNeutral,
  levelProgress,
  makeOffer,
  resizeCrew,
  spendExperience,
  startRenovation,
  xpForLevel,
  awardXp,
} from '../src/engine';
import { LEVELS_BY_ID } from '../src/engine/content';
import { currentReserve } from '../src/engine/market';

describe('experience', () => {
  it('needs progressively more xp for each level', () => {
    const gaps = [2, 3, 4, 5, 6].map((l) => xpForLevel(l) - xpForLevel(l - 1));
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    }
  });

  it('grants a spendable point per level rather than a silent bonus', () => {
    const exp = initialExperience();
    const gained = awardXp(exp, xpForLevel(3));
    expect(gained).toBe(2);
    expect(exp.level).toBe(3);
    expect(exp.unspentPoints).toBe(2);
  });

  it('stops at the level cap, so it cannot hand out every skill for free', () => {
    const exp = initialExperience();
    awardXp(exp, 10_000_000);
    expect(exp.level).toBe(ECON.XP.maxLevel);
  });

  it('reports progress through the current level', () => {
    const exp = initialExperience();
    awardXp(exp, Math.round(xpForLevel(2) / 2));
    expect(exp.level).toBe(1);
    expect(levelProgress(exp)).toBeGreaterThan(0.3);
    expect(levelProgress(exp)).toBeLessThan(0.7);
  });

  it('is earned by doing the work, not by spending money', () => {
    const state = createGame('sandbox', 31);
    expect(state.experience.xp).toBe(0);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, false);
    expect(state.experience.xp).toBeGreaterThan(0);
  });

  it('spends a point into a skill, and refuses when there are none', () => {
    const state = createGame('sandbox', 32);
    expect(spendExperience(state, 'analysis').ok).toBe(false);

    awardXp(state.experience, xpForLevel(2));
    expect(state.experience.unspentPoints).toBe(1);
    expect(spendExperience(state, 'analysis').ok).toBe(true);
    expect(state.skills.analysis).toBe(1);
    expect(state.experience.unspentPoints).toBe(0);
  });
});

describe('a crew on the payroll', () => {
  it('costs money every day, including the idle ones', () => {
    const state = createGame('sandbox', 33);
    expect(hireCrew(state, 2).ok).toBe(true);

    const cashBefore = state.cash;
    for (let i = 0; i < 14; i++) advanceDay(state);

    expect(state.cash).toBeLessThan(cashBefore);
    expect(state.crew!.idleDays).toBe(14);
    expect(state.crew!.workingDays).toBe(0);
    expect(crewUtilisation(state.crew)).toBe(0);
    expect(state.ledger.some((e) => e.description.includes('no job running'))).toBe(true);
  });

  it('works out cheaper and faster than subs, up to capacity', () => {
    const none = crewFactors(null, 1);
    expect(none).toEqual({ cost: 1, time: 1, changeOrder: 1 });

    const crew = { size: 2, hiredDay: 1, idleDays: 0, workingDays: 0, wagesPaid: 0 };
    const atCapacity = crewFactors(crew, 2);
    expect(atCapacity.cost).toBeLessThan(1);
    expect(atCapacity.time).toBeLessThan(1);
    expect(atCapacity.changeOrder).toBeLessThan(1);
  });

  it('slows down when spread over more jobs than it has people', () => {
    const crew = { size: 1, hiredDay: 1, idleDays: 0, workingDays: 0, wagesPaid: 0 };
    const one = crewFactors(crew, 1);
    const three = crewFactors(crew, 3);
    expect(three.time).toBeGreaterThan(one.time);
    // And past a point, worse than just calling subs.
    expect(three.time).toBeGreaterThan(1);
  });

  it('tracks utilisation once there is work', () => {
    const state = createGame('sandbox', 34);
    hireCrew(state, 1);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, false);
    startRenovation(state, prop.id, ['paint_interior', 'flooring_lvp'], 0.1);

    for (let i = 0; i < 10; i++) advanceDay(state);
    expect(state.crew!.workingDays).toBeGreaterThan(0);
    expect(crewUtilisation(state.crew)).toBeGreaterThan(0);
  });

  it('will not let a crew go mid-job', () => {
    const state = createGame('sandbox', 35);
    hireCrew(state, 1);
    const prop = state.market
      .filter((p) => p.listing)
      .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
    makeOffer(state, prop.id, prop.listing!.askPrice, false);
    startRenovation(state, prop.id, ['paint_interior'], 0.1);
    advanceDay(state);

    expect(disbandCrew(state).ok).toBe(false);
    for (let i = 0; i < 200 && prop.ownership?.renovation; i++) advanceDay(state);
    expect(disbandCrew(state).ok).toBe(true);
    expect(state.crew).toBeNull();
  });

  it('caps the crew size', () => {
    const state = createGame('sandbox', 36);
    expect(hireCrew(state, ECON.CREW.maxSize + 1).ok).toBe(false);
    expect(hireCrew(state, 1).ok).toBe(true);
    expect(resizeCrew(state, 2).ok).toBe(true);
    expect(state.crew!.size).toBe(2);
  });
});

describe('difficulty', () => {
  it('leaves standard exactly neutral, so the measured campaigns are untouched', () => {
    expect(isNeutral('standard')).toBe(true);
    expect(isNeutral(undefined)).toBe(true);
    expect(isNeutral('forgiving')).toBe(false);
    expect(isNeutral('brutal')).toBe(false);
  });

  it('produces an identical game on standard whether or not it is named', () => {
    const a = createGame('first_flip', 77);
    const b = createGame('first_flip', 77, 'standard');
    expect(a.cash).toBe(b.cash);
    expect(a.market.map((p) => p.address)).toEqual(b.market.map((p) => p.address));
  });

  it('moves capital and the clock in the direction it says', () => {
    const easy = createGame('first_flip', 78, 'forgiving');
    const hard = createGame('first_flip', 78, 'brutal');
    const base = LEVELS_BY_ID.first_flip.startingCash;

    expect(easy.cash).toBeGreaterThan(base);
    expect(hard.cash).toBeLessThan(base);
    expect(campaignDayLimit(easy)!).toBeGreaterThan(campaignDayLimit(hard)!);
  });

  it('never changes the arithmetic the game teaches', () => {
    // Every difficulty knob is about room for error, not about what a deal is
    // worth. Nothing here should touch the rule, the cost stack or the yields.
    for (const d of ['forgiving', 'standard', 'brutal'] as const) {
      const m = difficultyMods(d);
      expect(m).not.toHaveProperty('ruleOfThumb');
      expect(m).not.toHaveProperty('commission');
      expect(DIFFICULTY_META[d].name.length).toBeGreaterThan(0);
    }
  });

  it('has no clock at all in the sandbox, whatever the setting', () => {
    expect(campaignDayLimit(createGame('sandbox', 79, 'brutal'))).toBeNull();
  });
});
