import {
  DIFFICULTY_META,
  LEVELS_BY_ID,
  NEIGHBORHOODS_BY_ID,
  campaignDayLimit,
  defaultCompSelection,
  netWorth,
  totalDebt,
  type GameState,
} from '../engine';

/**
 * A plain-text account of how a session actually went.
 *
 * Written for playtesting, which is the one thing the balance harness cannot
 * do. The bot can prove that discipline beats recklessness across thirty
 * seeds; it cannot tell you that a real person spent forty minutes never
 * finding the comp picker, or bought three houses without once opening the
 * analyzer. Those show up here.
 *
 * Deliberately human-readable rather than a save blob: a tester will paste
 * this into a message, and whoever reads it should be able to see the shape of
 * the session without loading anything. The seed is included so any run can be
 * reproduced exactly.
 */
export function sessionReport(state: GameState): string {
  const level = LEVELS_BY_ID[state.levelId];
  const limit = campaignDayLimit(state);
  const lines: string[] = [];

  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  lines.push('=== Property Flipper session report ===');
  lines.push(
    `${level?.name ?? state.levelId} on ${DIFFICULTY_META[state.difficulty].name} · seed ${state.seed}`,
  );
  lines.push(`Day ${state.day}${limit ? ` of ${limit}` : ''} · ${state.phase}`);
  if (state.outcomeMessage) lines.push(state.outcomeMessage);
  lines.push('');

  lines.push('-- Position --');
  lines.push(`Cash ${money(state.cash)} · debt ${money(totalDebt(state))} · net worth ${money(netWorth(state))}`);
  lines.push(`Holding ${state.portfolio.length} · closed ${state.closedDeals.length}`);
  lines.push(
    `Skills n${state.skills.negotiation}/a${state.skills.analysis}/m${state.skills.management}/k${state.skills.marketing}` +
      ` · reputation L${Math.round(state.reputation.lenders)}/A${Math.round(state.reputation.agents)}/C${Math.round(state.reputation.contractors)}` +
      ` · level ${state.experience.level} (${state.experience.xp} xp, ${state.experience.unspentPoints} unspent)`,
  );
  if (state.crew) {
    lines.push(
      `Crew of ${state.crew.size} · ${state.crew.workingDays} worked / ${state.crew.idleDays} idle · ${money(state.crew.wagesPaid)} in wages`,
    );
  }
  lines.push('');

  /**
   * Which parts of the game were touched at all.
   *
   * The single most useful thing in this report. A feature nobody found is
   * indistinguishable from a feature nobody wanted, and only this tells them
   * apart.
   */
  lines.push('-- What was used --');
  const used = {
    'inspected before offering': state.ledger.some((e) => e.category === 'inspection'),
    // Compared against what the game picked for them, rather than against a
    // guessed count. A checklist that reports the wrong thing is worse than
    // one that omits it.
    'changed the comp selection': [...state.market, ...state.portfolio].some((p) => {
      const preset = defaultCompSelection(p, p.compPool);
      return (
        p.selectedComps.length !== preset.length ||
        p.selectedComps.some((id) => !preset.includes(id))
      );
    }),
    'used financing': state.ledger.some((e) => e.category === 'loan'),
    'took on a partner': state.portfolio.some((p) => p.ownership?.partner),
    'bid at auction': state.auction.lots.some((l) => l.myMaxBid !== null),
    'let a property': state.portfolio.some((p) => p.ownership?.rental),
    'refinanced': state.ledger.some((e) => e.description.includes('Refinanced')),
    'hired a crew': !!state.crew || state.ledger.some((e) => e.description.includes('crew')),
    'trained a skill': state.ledger.some((e) => e.category === 'training'),
    'reduced a list price': state.portfolio.some((p) => (p.ownership?.saleListing?.reductions ?? 0) > 0),
  };
  for (const [what, did] of Object.entries(used)) {
    lines.push(`  ${did ? '[x]' : '[ ]'} ${what}`);
  }
  lines.push('');

  if (state.closedDeals.length > 0) {
    lines.push('-- Deals --');
    for (const d of state.closedDeals) {
      const held = d.soldDay - d.boughtDay;
      lines.push(
        `  ${d.address}: bought ${money(d.purchasePrice)} d${d.boughtDay}, sold ${money(d.salePrice)} d${d.soldDay}` +
          ` (${held}d) → ${d.netProfit >= 0 ? '+' : ''}${money(d.netProfit)}`,
      );
    }
    const total = state.closedDeals.reduce((s, d) => s + d.netProfit, 0);
    const wins = state.closedDeals.filter((d) => d.netProfit > 0).length;
    lines.push(
      `  Total ${money(total)} across ${state.closedDeals.length}, ${wins} profitable (${pct(wins / state.closedDeals.length)})`,
    );
    lines.push('');
  }

  if (state.portfolio.length > 0) {
    lines.push('-- Still holding --');
    for (const p of state.portfolio) {
      const own = p.ownership!;
      const what = own.renovation
        ? 'renovating'
        : own.saleListing
          ? `listed ${own.saleListing.daysOnMarket}d`
          : own.rental?.tenancy
            ? 'let'
            : own.rental
              ? 'vacant'
              : 'idle';
      lines.push(
        `  ${p.address} (${NEIGHBORHOODS_BY_ID[p.neighborhoodId]?.name}): ${what}` +
          ` · paid ${money(own.purchasePrice)} · in for ${money(own.purchasePrice + own.closingCosts + own.renovationSpend + own.holdingCostsPaid)}`,
      );
    }
    lines.push('');
  }

  // The last stretch of the log, which is usually where a session went wrong.
  lines.push('-- Last 15 events --');
  for (const e of state.log.slice(-15)) {
    lines.push(`  d${e.day} [${e.tone}] ${e.message}`);
  }

  return lines.join('\n');
}
