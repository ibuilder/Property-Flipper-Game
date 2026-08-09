import { ECON } from './content';
import type { Crew, Experience, GameState, Money, SkillId } from './types';

/**
 * Three different things that make a fifth flip easier than a first, kept
 * deliberately separate because they are earned in different currencies.
 *
 *   skills      Bought with cash. Instant, expensive, and available on day one
 *               to anyone who can afford it.
 *   reputation  Earned from counterparties by how you behave towards them.
 *               Cannot be bought at any price.
 *   experience  Earned from doing the work. Cannot be bought or hurried, and
 *               unlike the other two it is never lost.
 *
 * Collapsing any two of these into one number would have been simpler and
 * would have taught less: money, relationships and know-how are genuinely
 * different resources, and a game about a business should not pretend
 * otherwise.
 *
 * A crew is separate again -- not progression but an operating decision, and
 * the one that decides whether the business scales past doing one house at a
 * time.
 */

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export function initialExperience(): Experience {
  return { xp: 0, level: 1, unspentPoints: 0 };
}

/** XP needed to reach a given level. Superlinear, so levels keep meaning something. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(ECON.XP.base * Math.pow(level - 1, ECON.XP.curve));
}

export function xpToNextLevel(exp: Experience): number {
  return Math.max(0, xpForLevel(exp.level + 1) - exp.xp);
}

export function levelProgress(exp: Experience): number {
  const floor = xpForLevel(exp.level);
  const ceiling = xpForLevel(exp.level + 1);
  if (ceiling <= floor) return 1;
  return Math.max(0, Math.min(1, (exp.xp - floor) / (ceiling - floor)));
}

/**
 * Award experience and level up if earned.
 *
 * A level grants a skill point to spend rather than applying a bonus
 * directly. That keeps the choice with the player, keeps levelling from
 * silently changing the numbers under a deal in progress, and means a bot or
 * a save that ignores progression is completely unaffected by it.
 */
export function awardXp(exp: Experience, amount: number): number {
  if (amount <= 0) return 0;
  exp.xp += Math.round(amount);
  let gained = 0;
  while (exp.level < ECON.XP.maxLevel && exp.xp >= xpForLevel(exp.level + 1)) {
    exp.level += 1;
    exp.unspentPoints += 1;
    gained += 1;
  }
  return gained;
}

/** What each kind of completed work is worth. */
export const XP_AWARDS = {
  /** Closing a purchase at all. */
  purchase: 40,
  /** Finishing a renovation, scaled by its size. */
  renovationPerDay: 2,
  /** Selling, whether or not it went well -- you learn either way. */
  sale: 80,
  /** And a bonus for selling profitably, scaled by the margin. */
  profitableSaleBonus: 120,
  /** Winning at auction, which is a harder thing to do well. */
  auctionWin: 90,
  /** Signing a first tenant, and refinancing out. */
  tenancy: 50,
  refinance: 110,
} as const;

// ---------------------------------------------------------------------------
// Crew
// ---------------------------------------------------------------------------

/**
 * A retained crew instead of subcontracting every job.
 *
 * The decision this models is the one that actually decides whether a flipping
 * business scales: people cost money whether or not there is work for them.
 * Subs are expensive per job and free when idle. A crew is cheaper per job,
 * faster, and knows the work well enough to find fewer nasty surprises -- and
 * bills you every single day, including the ones where every house you own is
 * sitting on the market waiting for a buyer.
 *
 * Capacity is the other half. One crew runs one job at full speed; a second
 * concurrent job shares them and both slow down. Growing the crew raises the
 * ceiling and the weekly bill together.
 */
export function hireCrewCost(size: number): Money {
  return Math.round(ECON.CREW.hiringCost * size);
}

export function crewWeeklyCost(size: number): Money {
  return Math.round(ECON.CREW.weeklyPerHead * size);
}

export function createCrew(size: number, day: number): Crew {
  return {
    size,
    hiredDay: day,
    idleDays: 0,
    workingDays: 0,
    wagesPaid: 0,
  };
}

/** How many jobs this crew runs at full speed. */
export function crewCapacity(crew: Crew | null): number {
  return crew ? crew.size : 0;
}

/**
 * Cost and time multipliers from having your own crew on a job.
 *
 * Over capacity, the time advantage decays and then reverses: three jobs on a
 * one-crew payroll is slower than subcontracting all three, because your
 * people can only be in one place at a time and you have stopped calling subs.
 */
export function crewFactors(
  crew: Crew | null,
  activeJobs: number,
): { cost: number; time: number; changeOrder: number } {
  if (!crew || activeJobs === 0) return { cost: 1, time: 1, changeOrder: 1 };

  const load = activeJobs / Math.max(1, crew.size);
  // At or under capacity: cheaper and faster. Over it, the crew is spread thin.
  const time = load <= 1 ? ECON.CREW.timeFactor : ECON.CREW.timeFactor * load;
  return {
    cost: ECON.CREW.costFactor,
    time,
    // Your own people spot trouble earlier, whatever the load.
    changeOrder: ECON.CREW.changeOrderFactor,
  };
}

/** Charge a day of wages, whether or not there was work. */
export function payCrew(state: GameState, activeJobs: number): Money {
  const crew = state.crew;
  if (!crew) return 0;
  const daily = crewWeeklyCost(crew.size) / 7;
  if (activeJobs > 0) crew.workingDays += 1;
  else crew.idleDays += 1;
  crew.wagesPaid += daily;
  return daily;
}

/**
 * Whether the crew is currently paying for itself.
 *
 * Surfaced to the player rather than kept internal, because "am I busy enough
 * to justify these people" is the actual question and it is answerable from
 * numbers the game already tracks.
 */
export function crewUtilisation(crew: Crew | null): number {
  if (!crew) return 0;
  const total = crew.workingDays + crew.idleDays;
  return total === 0 ? 0 : crew.workingDays / total;
}

// ---------------------------------------------------------------------------
// Spending an experience point
// ---------------------------------------------------------------------------

export function spendPoint(
  exp: Experience,
  skills: Record<SkillId, number>,
  skill: SkillId,
): { ok: boolean; message: string } {
  if (exp.unspentPoints <= 0) {
    return { ok: false, message: 'No unspent experience points.' };
  }
  if (skills[skill] >= ECON.MAX_SKILL_LEVEL) {
    return { ok: false, message: 'That skill is already at its maximum.' };
  }
  exp.unspentPoints -= 1;
  skills[skill] += 1;
  return { ok: true, message: `Experience spent on ${skill}.` };
}
