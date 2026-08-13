import type { ClosedDeal, GameState } from './types';

/**
 * What the player has actually demonstrated.
 *
 * The handoff asks for a concept ledger so the coach stops explaining things
 * you have proved you know, and so an instructor can read what a run
 * demonstrated rather than what it scored.
 *
 * Derived from closed deals rather than recorded as events. That is a real
 * constraint and worth being plain about: it means a concept can only be
 * demonstrated by a deal reaching the end, and concepts whose evidence is not
 * on the closed deal -- whether an inspection happened, which refinance cap
 * bound -- are not measurable yet and are absent rather than guessed. The
 * alternative was instrumenting a dozen call sites and a save migration to
 * store what the ledger already implies, which buys nothing today.
 *
 * Mastery is *demonstrated twice*, per the handoff. Once is luck.
 */

export type ConceptId =
  | 'cost.stack'
  | 'market.traffic'
  | 'cost.over-improvement'
  | 'capital.leverage';

export interface ConceptDef {
  id: ConceptId;
  name: string;
  /** What the player must do, stated as the proof rather than as a cost. */
  proof: string;
  /** The failure mode it is the antidote to. */
  failureMode: string;
}

export const CONCEPTS: ConceptDef[] = [
  {
    id: 'cost.stack',
    name: 'The cost stack',
    proof: 'Two deals bought at or under the itemised maximum offer',
    failureMode: 'Paid too much',
  },
  {
    id: 'market.traffic',
    name: 'The traffic curve',
    proof: 'Two flips contracted inside 30 days at or under 102% of ARV',
    failureMode: 'Forgot the clock',
  },
  {
    id: 'cost.over-improvement',
    name: 'What the street pays for',
    proof: 'Two deals where the work came in at or under what was scoped',
    failureMode: 'Over-improved for the block',
  },
  {
    id: 'capital.leverage',
    name: 'Leverage',
    proof: 'Two financed deals closed profitably after points and interest',
    failureMode: 'Over-levered',
  },
];

/** How many demonstrations a concept needs before it counts as known. */
export const DEMONSTRATIONS_FOR_MASTERY = 2;

export interface ConceptProgress {
  id: ConceptId;
  demonstrated: number;
  mastered: boolean;
  /** The deals that count, most recent last. */
  deals: string[];
}

/** Did this deal demonstrate this concept? Pure, one deal at a time. */
function demonstrates(concept: ConceptId, deal: ClosedDeal): boolean {
  const p = deal.postMortem?.projected;
  switch (concept) {
    case 'cost.stack':
      // Bought inside the number the itemised stack said was the ceiling.
      return !!p && p.maoDetailed > 0 && deal.purchasePrice <= p.maoDetailed;

    case 'market.traffic': {
      // Contracted quickly, without buying the speed by underpricing badly.
      if (!p || p.arv <= 0) return false;
      if (deal.listedDay == null) return false;
      const onMarket = deal.soldDay - deal.listedDay;
      return onMarket <= 30 && deal.salePrice <= p.arv * 1.02;
    }

    case 'cost.over-improvement':
      // The work landed at or under what was scoped for it, which is the
      // observable half of not gold-plating a house the street will not pay
      // for. It cannot see an over-improvement that came in on budget.
      return !!p && p.repairEstimate > 0 && deal.renovationSpend <= p.repairEstimate;

    case 'capital.leverage':
      // Borrowed and still made money once the borrowing was paid for.
      return deal.financingCosts > 0 && deal.netProfit > 0;
  }
}

export function conceptProgress(deals: readonly ClosedDeal[]): ConceptProgress[] {
  return CONCEPTS.map((c) => {
    const hits = deals.filter((d) => demonstrates(c.id, d));
    return {
      id: c.id,
      demonstrated: hits.length,
      mastered: hits.length >= DEMONSTRATIONS_FOR_MASTERY,
      deals: hits.map((d) => d.address),
    };
  });
}

export function hasMastered(state: GameState, concept: ConceptId): boolean {
  return conceptProgress(state.closedDeals).find((p) => p.id === concept)?.mastered ?? false;
}

/** One line on where the player is, or null when nothing is proved yet. */
export function describeMastery(progress: readonly ConceptProgress[]): string | null {
  const done = progress.filter((p) => p.mastered);
  const started = progress.filter((p) => !p.mastered && p.demonstrated > 0);
  if (done.length === 0 && started.length === 0) return null;

  if (done.length === progress.length) {
    return 'Every concept demonstrated twice. There is nothing left here that a coach could tell you.';
  }
  if (done.length === 0) {
    return `${started.length} of ${progress.length} concepts shown once. Twice is the bar — once is luck, and the difference matters more here than anywhere else in the game.`;
  }
  return `${done.length} of ${progress.length} demonstrated. A concept counts when you have done it twice, not when you have read about it.`;
}
