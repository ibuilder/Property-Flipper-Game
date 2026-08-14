import type { ScenarioDef } from './scenarios';
import type { GameState } from './types';

/**
 * The first fifteen minutes.
 *
 * One authored deal, one house, no market. The player closes a complete flip
 * before the game shows them four neighbourhoods, and nothing is explained
 * that is not about to be used.
 *
 * The gate is the point rather than the tour. A player who has closed one flip
 * understands every noun on the town screen; one who has not reads it as a
 * spreadsheet and bounces. So the market, auctions, finance and skills stay
 * shut until the tutorial deal is done -- win *or* lose, because losing the
 * first one teaches the same nouns and being trapped in a tutorial you failed
 * is the worst possible introduction to a game about failing well.
 *
 * -- On not adding save state --
 *
 * There is no `tutorial` field anywhere. Whether the tutorial is running is
 * `scenarioId === TUTORIAL_ID`, and whether it is finished is "have you closed
 * a deal", both of which the save already carries. That means no migration, no
 * version bump, and no way for a saved game to disagree with itself about
 * whether the player has been taught. The tour's *position* is UI state and
 * lives in the browser, because a half-finished tour is not worth persisting
 * across machines.
 */

export const TUTORIAL_ID = 'first_fifteen';

/**
 * The authored deal.
 *
 * Deliberately forgiving: a distressed house well under value from a motivated
 * seller, with real defects to find and a scope worth arguing about. The first
 * deal has to be winnable by someone who does not yet know what they are
 * doing, or the lesson is "this game is unfair" rather than any of the things
 * it is trying to teach.
 *
 * `distractors: 0` is what makes it one house and no market. That field
 * already existed for the lesson scenarios; this is the first thing to use it
 * at zero.
 */
export const TUTORIAL: ScenarioDef = {
  id: TUTORIAL_ID,
  name: 'Your first flip',
  brief:
    'One house. Work down the left: pick the comps that set what it is worth, pay for an inspection before you commit, then choose what work to do. The panel on the right re-prices the whole deal every time you touch something — watch it, and do not offer more than the itemised maximum.',
  lesson:
    'That is the whole loop, and every deal after this is the same four questions asked faster: what is it worth, what is wrong with it, what will the work cost, and what is the most I can pay and still get paid. The town is open now.',
  startingCash: 200_000,
  dayLimit: 300,
  marketIndex: 1.0,
  interestRate: 0.065,
  // Low enough that a careful first-timer clears it, high enough that
  // overpaying does not.
  targetProfit: 10_000,
  distractors: 0,
  builtIn: true,
  property: {
    archetypeId: 'bungalow',
    neighborhoodId: 'maple_heights',
    sqft: 1280,
    yearBuilt: 1961,
    condition: 0.38,
    /*
     * A moderate and a minor, so the inspection visibly pays for itself
     * without the deal turning into a horror story on the first attempt.
     * Deliberately not one of the majors: `roof_failure` and its siblings are
     * must-fix and cost five figures, which teaches "this game is unfair"
     * before it teaches anything about disclosure.
     */
    defectIds: ['hvac_dead', 'water_heater'],
    disclosedIds: [],
    sellerType: 'tired_landlord',
    /*
     * Below the itemised maximum offer, deliberately.
     *
     * At $132,000 the maximum this deal supports was $107,499 — so a
     * first-timer paying the asking price lost money before they had learned
     * what a maximum offer was. That is a fine lesson for scenario 1 of the
     * curriculum and a terrible one for the front door. A test checks the
     * relationship across several seeds rather than pinning the number, since
     * the comp pool is noisy and a tutorial forgiving on only some seeds is
     * not forgiving.
     */
    askPrice: 98_000,
  },
};

export function isTutorial(state: GameState): boolean {
  return state.scenarioId === TUTORIAL_ID;
}

/**
 * Has the tutorial deal been seen through to an end?
 *
 * Closing *any* deal counts, and so does running out of clock. The gate is
 * there to stop a stranger reading the town screen cold, not to enforce a
 * standard.
 */
export function tutorialComplete(state: GameState): boolean {
  if (!isTutorial(state)) return true;
  return state.closedDeals.length > 0 || state.phase !== 'playing';
}

/** Screens that exist at all times, tutorial or not. */
const ALWAYS: readonly string[] = ['market', 'portfolio'];

/**
 * Whether a screen is open yet.
 *
 * Market and portfolio stay available because the tutorial deal lives on them
 * -- the house has to be findable and, once bought, manageable. Everything
 * else is held back until there is a completed flip to make sense of it.
 */
export function isUnlocked(state: GameState, tab: string): boolean {
  if (!isTutorial(state) || tutorialComplete(state)) return true;
  return ALWAYS.includes(tab);
}

/** Why a locked tab is locked, for the tooltip. */
export function lockReason(tab: string): string {
  const named: Record<string, string> = {
    auction: 'Trustee sales open once you have closed a flip. They are the same maths under a clock, and the clock is easier once the maths is familiar.',
    finance: 'Borrowing opens once you have closed a flip. Your first one is cash, so nothing is happening to the numbers that you did not do.',
    skills: 'Skills and crews open once you have closed a flip — there is nothing to spend them on until you have run a deal end to end.',
    deals: 'Your track record opens when there is one.',
  };
  return named[tab] ?? 'Opens once you have closed your first flip.';
}

export interface TourStep {
  /** The screen this step teaches on. */
  tab: 'market' | 'portfolio';
  title: string;
  body: string;
}

/**
 * Seven steps, each naming the decision rather than the control.
 *
 * "Click the comps panel" teaches the interface; "your comps decide what this
 * is worth, and everything downstream is a percentage of that" teaches the
 * game. The player can find a panel. What they cannot do yet is know which of
 * the four numbers on screen is the one that matters.
 */
export const TOUR: TourStep[] = [
  {
    tab: 'market',
    title: 'One house, to begin with',
    body: 'There is exactly one listing. The rest of the town is shut until you have closed this, because every screen out there assumes you already know what a deal looks like. Open it.',
  },
  {
    tab: 'market',
    title: 'What is it worth?',
    body: 'Nobody tells you. You produce it, from comparable sales you choose yourself — and every number after this is a share of that one. Pick the comps that argue with you, not the ones that flatter.',
  },
  {
    tab: 'market',
    title: 'Find out what is wrong with it',
    body: 'An inspection is not really about knowing. Anything it finds is disclosed, and a seller concedes most of what is written down. Anything it misses you pay for at full price, later, with a crew standing in the room.',
  },
  {
    tab: 'market',
    title: 'Some work pays, some does not',
    body: 'The street sets the ceiling, not the kitchen. Restoring what the comps already assume is worth doing; going past it is a gift to the buyer.',
  },
  {
    tab: 'market',
    title: 'The two maximum offers',
    body: 'The rule of thumb takes 30% off the top; the itemised figure adds up every real cost and takes what is left. When they disagree, the itemised one is right — and the panel shows you both so you can watch them disagree.',
  },
  {
    tab: 'portfolio',
    title: 'Every day costs money',
    body: 'From here the clock is a line item. Carry, interest, and the days between finishing and selling all come out of the same profit you underwrote.',
  },
  {
    tab: 'portfolio',
    title: 'Then sell it, and read the bill',
    body: 'List it and watch how price moves buyer traffic — it falls off a cliff above what the house is worth. When it closes, the track record tells you which of your own assumptions cost you the most.',
  },
];
