import { ECON, type ConceptId, type DealAnalysis, type GameState, type Property } from '../../engine';

/**
 * Scout's rules. Data, not logic.
 *
 * One flat table so a non-programmer can review what the coach will say and
 * when. Everything that decides whether a line fires lives in the row: the
 * predicate, the priority, how often it may repeat, and the concept it
 * teaches. There is no branching anywhere else.
 *
 * The character, per the handoff: a working dog in a hard hat who has been on
 * more sites than you have. Not a mascot and not a hint vending machine -- the
 * tradesman who has seen this exact mistake before and says so once, plainly,
 * before you make it. Short declarative sentences, trade vocabulary used
 * correctly, dry. He does not say "Woof". He says "Nothing appraises without a
 * roof."
 *
 * Every line names the number and can be checked against the ledger. A coach
 * that cannot be audited is just a voice being confident at you.
 */

export type Mood = 'briefing' | 'explaining' | 'pointing' | 'warning' | 'approving' | 'disappointed';

/** Everything a rule is allowed to look at. */
export interface CoachContext {
  state: GameState;
  /** The property being looked at, if any. */
  property?: Property | null;
  /** The live analysis on the buy screen, if any. */
  analysis?: DealAnalysis | null;
  /** The offer currently typed, if any. */
  offer?: number | null;
}

export interface CoachRule {
  id: string;
  mood: Mood;
  /** Higher wins when several rules are eligible. */
  priority: number;
  /** Game-days before this may fire again. */
  cooldownDays: number;
  /** Times it may ever fire in one campaign. */
  maxLifetime: number;
  when: (c: CoachContext) => boolean;
  line: (c: CoachContext) => string;
  /** The arithmetic behind the line, so it is falsifiable. */
  math?: (c: CoachContext) => string;
  teaches?: ConceptId;
  /** Stop saying it once the player has demonstrated the concept twice. */
  suppressAfterMastery?: boolean;
}

const money = (n: number): string =>
  (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

export const RULES: CoachRule[] = [
  {
    id: 'offer-over-mao',
    mood: 'warning',
    priority: 90,
    cooldownDays: 6,
    maxLifetime: 8,
    teaches: 'cost.stack',
    suppressAfterMastery: true,
    when: (c) =>
      !!c.analysis && !!c.offer && c.offer > c.analysis.maoDetailed && c.analysis.maoDetailed > 0,
    line: () => 'That is not a thin deal, that is a paid hobby.',
    math: (c) =>
      `${money(c.offer!)} against an itemised maximum of ${money(
        c.analysis!.maoDetailed,
      )} — you are ${money(c.offer! - c.analysis!.maoDetailed)} over before anything goes wrong`,
  },
  {
    id: 'unfundable',
    mood: 'pointing',
    priority: 95,
    cooldownDays: 4,
    maxLifetime: 6,
    when: (c) => !!c.analysis && !!c.offer && c.offer > 0 && c.state.cash < c.offer * 0.12,
    line: () =>
      'Price it all you like. Closing takes cash, and you are underwriting a house you cannot get to the table.',
    math: (c) => `${money(c.state.cash)} on hand against a ${money(c.offer!)} purchase`,
  },
  {
    id: 'no-inspection',
    mood: 'warning',
    priority: 80,
    cooldownDays: 10,
    maxLifetime: 5,
    when: (c) => !!c.property && !c.property.ownership && c.property.inspection === 'none',
    line: () => 'You are bidding on six defects and can only see two of them.',
    math: () =>
      `a standard inspection is ${money(ECON.INSPECTION.standard.cost)} and what it finds becomes the seller's problem, not yours`,
  },
  {
    id: 'rule-of-thumb-generous',
    mood: 'explaining',
    priority: 60,
    cooldownDays: 20,
    maxLifetime: 3,
    teaches: 'cost.stack',
    suppressAfterMastery: true,
    when: (c) =>
      !!c.analysis && c.analysis.mao70 - c.analysis.maoDetailed > c.analysis.arv * 0.02,
    line: () =>
      'The seventy per cent rule is flattering this one. Thirty per cent is not profit, it is a guess at the costs — and on this house the guess is low.',
    math: (c) =>
      `rule says ${money(c.analysis!.mao70)}, the itemised stack says ${money(
        c.analysis!.maoDetailed,
      )}`,
  },
  {
    id: 'thin-margin',
    mood: 'disappointed',
    priority: 70,
    cooldownDays: 12,
    maxLifetime: 6,
    when: (c) => {
      const p = c.analysis?.breakdown?.profit;
      return p !== undefined && p > 0 && p < c.analysis!.arv * 0.04;
    },
    line: () => 'One change order eats that. There is no room in it for the job to be normal.',
    math: (c) =>
      `${money(c.analysis!.breakdown!.profit)} on a ${money(c.analysis!.arv)} house`,
  },
  {
    id: 'carry-is-the-clock',
    mood: 'explaining',
    priority: 55,
    cooldownDays: 25,
    maxLifetime: 3,
    teaches: 'market.traffic',
    suppressAfterMastery: true,
    when: (c) => !!c.analysis && c.analysis.dailyCarry * c.analysis.holdDays > c.analysis.arv * 0.03,
    line: () =>
      'The clock is a line item here. Every day between finishing and selling is paid out of the profit, whether or not anything happens.',
    math: (c) =>
      `${c.analysis!.holdDays} days × ${money(c.analysis!.dailyCarry)}/day = ${money(
        c.analysis!.dailyCarry * c.analysis!.holdDays,
      )}`,
  },
  {
    id: 'bought-right',
    mood: 'approving',
    priority: 40,
    cooldownDays: 30,
    maxLifetime: 3,
    when: (c) =>
      !!c.analysis &&
      !!c.offer &&
      c.offer > 0 &&
      c.analysis.maoDetailed > 0 &&
      c.offer <= c.analysis.maoDetailed * 0.92,
    line: () => 'Bought right. Everything after this is execution.',
    math: (c) =>
      `${money(c.offer!)} against a ceiling of ${money(c.analysis!.maoDetailed)}`,
  },
  {
    id: 'sitting-on-cash',
    mood: 'briefing',
    priority: 30,
    cooldownDays: 45,
    maxLifetime: 3,
    when: (c) =>
      c.state.portfolio.length === 0 && c.state.day > 45 && c.state.closedDeals.length === 0,
    line: () =>
      'Nothing bought yet. Waiting is a position and sometimes the right one, but it is not free — the clock is the only thing here that never stops.',
    math: (c) => `day ${c.state.day}, nothing owned, nothing closed`,
  },
];
