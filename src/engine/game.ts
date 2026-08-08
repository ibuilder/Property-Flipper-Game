import {
  DEFECTS_BY_ID,
  ECON,
  LEVELS_BY_ID,
  NEIGHBORHOODS_BY_ID,
  SCOPE_BY_ID,
  EVENTS,
  EVENTS_BY_ID,
} from './content';
import { eventModifiers } from './events';
import {
  buyClosingCosts,
  dailyHoldingCost,
  dailyInterest,
  loanPayoff,
  maxLoanAmount,
  netWorth,
  originateLoan,
  sellingCosts,
  skillCost,
  totalDebt,
} from './finance';
import {
  ageListing,
  evaluateOffer,
  generateProperty,
  rollBuyerOffer,
} from './market';
import { Rng } from './rng';
import {
  changeOrderChance,
  createJob,
  defectIdFromScopeId,
  isDefectScopeId,
  quoteScope,
  quoteScopeItem,
  scheduleDays,
} from './renovation';
import type {
  ActionResult,
  ClosedDeal,
  GameState,
  LedgerCategory,
  LogTone,
  Money,
  Property,
  PropertyId,
  SkillId,
} from './types';
import { makeAppraisal, trueValue } from './valuation';

export const SAVE_VERSION = 3;

/** How often the charts' time series is sampled, in days. */
export const HISTORY_INTERVAL_DAYS = 5;

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

/** Run a function with the game's RNG and persist its advanced state. */
function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(state.rngState);
  const out = fn(rng);
  state.rngState = rng.getState();
  return out;
}

/**
 * The single choke point for every cash movement.
 *
 * Routing everything through here is what makes the ledger -- and therefore
 * the per-deal P&L -- trustworthy. The original game mutated cash from a dozen
 * places with no record, which is precisely why it could not show a player
 * where their money went.
 */
function applyCash(
  state: GameState,
  amount: Money,
  category: LedgerCategory,
  description: string,
  propertyId?: PropertyId,
): void {
  const rounded = Math.round(amount);
  if (rounded === 0) return;
  state.cash = Math.round(state.cash + rounded);
  state.ledger.push({ day: state.day, category, description, amount: rounded, propertyId });
}

function log(state: GameState, tone: LogTone, message: string): void {
  state.log.push({ day: state.day, tone, message });
  // Keep the log bounded so a 900-day campaign does not grow without limit.
  if (state.log.length > 600) state.log.splice(0, state.log.length - 600);
}

function findOwned(state: GameState, id: PropertyId): Property | undefined {
  return state.portfolio.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

export function createGame(levelId: string, seed: number): GameState {
  const level = LEVELS_BY_ID[levelId];
  if (!level) throw new Error(`Unknown level: ${levelId}`);

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rngState: seed >>> 0,
    levelId,
    day: 1,
    phase: 'playing',
    outcomeMessage: '',
    cash: level.startingCash,
    skills: { negotiation: 0, analysis: 0, management: 0, marketing: 0 },
    world: {
      marketIndex: level.startingMarketIndex,
      baseRate: level.startingRate,
      interestRate: level.startingRate,
      neighborhoodIndex: Object.fromEntries(level.neighborhoods.map((id) => [id, 1])),
      activeEvents: [],
    },
    market: [],
    portfolio: [],
    loans: [],
    ledger: [],
    log: [],
    closedDeals: [],
    history: [],
    distressDays: 0,
  };

  withRng(state, (rng) => {
    for (let i = 0; i < level.listingCount; i++) {
      state.market.push(
        generateProperty(rng, state.world, state.day, level.neighborhoods, state.skills.analysis),
      );
    }
  });

  recordHistory(state);
  log(state, 'info', `${level.name} begins. You have $${level.startingCash.toLocaleString()}.`);
  return state;
}

/** Append a sample to the chart series. */
function recordHistory(state: GameState): void {
  state.history.push({
    day: state.day,
    marketIndex: state.world.marketIndex,
    interestRate: state.world.interestRate,
    netWorth: netWorth(state),
    cash: Math.round(state.cash),
    debt: totalDebt(state),
    neighborhoods: { ...state.world.neighborhoodIndex },
  });
}

// ---------------------------------------------------------------------------
// Buy side
// ---------------------------------------------------------------------------

export function makeOffer(
  state: GameState,
  propertyId: PropertyId,
  amount: Money,
  useFinancing: boolean,
): ActionResult {
  if (state.phase !== 'playing') return { ok: false, message: 'The game is over.' };

  const idx = state.market.findIndex((p) => p.id === propertyId);
  if (idx === -1) return { ok: false, message: 'That property is no longer on the market.' };
  const prop = state.market[idx];
  if (!prop.listing) return { ok: false, message: 'That property is not listed.' };
  if (amount <= 0) return { ok: false, message: 'Offer must be positive.' };

  const closing = buyClosingCosts(amount);
  const loanPrincipal = useFinancing ? maxLoanAmount(amount) : 0;
  const points = Math.round(loanPrincipal * ECON.LOAN_POINTS);
  const cashNeeded = amount - loanPrincipal + closing;

  if (state.cash < cashNeeded) {
    return {
      ok: false,
      message: `You need $${cashNeeded.toLocaleString()} at closing and have $${Math.round(
        state.cash,
      ).toLocaleString()}.`,
    };
  }

  const outcome = evaluateOffer(prop, amount, state.skills.negotiation);
  if (!outcome.accepted) {
    log(state, 'warn', `Offer of $${amount.toLocaleString()} on ${prop.address} rejected.`);
    return { ok: false, message: outcome.message };
  }

  // Deal accepted -- close it.
  state.market.splice(idx, 1);
  prop.listing = null;
  prop.ownership = {
    purchaseDay: state.day,
    purchasePrice: amount,
    closingCosts: closing,
    loanId: null,
    renovation: null,
    saleListing: null,
    holdingCostsPaid: 0,
    renovationSpend: 0,
  };

  applyCash(state, -amount, 'acquisition', `Purchased ${prop.address}`, prop.id);
  applyCash(state, -closing, 'closing', `Closing costs on ${prop.address}`, prop.id);

  if (useFinancing && loanPrincipal > 0) {
    const { loan, netProceeds } = originateLoan(
      `l${state.loans.length + 1}_${prop.id}`,
      prop.id,
      loanPrincipal,
      state.world,
      state.day,
    );
    state.loans.push(loan);
    prop.ownership.loanId = loan.id;
    applyCash(state, netProceeds, 'loan', `Hard money advance on ${prop.address}`, prop.id);
    applyCash(state, 0, 'financing', `Origination points: $${points.toLocaleString()}`, prop.id);
    log(
      state,
      'info',
      `Financed $${loanPrincipal.toLocaleString()} at ${(loan.annualRate * 100).toFixed(
        2,
      )}%. Points of $${points.toLocaleString()} came out of the wire.`,
    );
  }

  prop.appraisal = makeAppraisal(prop, state.world, state.day, 'comps', state.skills.analysis);
  state.portfolio.push(prop);
  log(state, 'good', `Bought ${prop.address} for $${amount.toLocaleString()}.`);
  return { ok: true, message: `Closed on ${prop.address}.` };
}

// ---------------------------------------------------------------------------
// Due diligence
// ---------------------------------------------------------------------------

/**
 * Order due diligence on any property -- listed or owned.
 *
 * Inspecting before you offer is the point: the findings are what let you
 * lower the offer, widen the contingency, or walk. The fee is sunk whether or
 * not you end up buying, which is exactly the real trade-off.
 */
export function orderInspection(
  state: GameState,
  propertyId: PropertyId,
  level: 'standard' | 'thorough',
): ActionResult {
  const prop =
    findOwned(state, propertyId) ?? state.market.find((p) => p.id === propertyId);
  if (!prop) return { ok: false, message: 'No such property.' };
  if (prop.inspection === 'thorough') {
    return { ok: false, message: 'A thorough inspection has already been done.' };
  }
  if (prop.inspection === level) {
    return { ok: false, message: `A ${level} inspection has already been done.` };
  }

  const spec = ECON.INSPECTION[level];
  if (state.cash < spec.cost) return { ok: false, message: 'Not enough cash for that inspection.' };

  applyCash(state, -spec.cost, 'inspection', `${level} inspection on ${prop.address}`, prop.id);
  prop.inspection = level;

  // Analysis skill makes an inspector more thorough, up to a hard cap.
  const rate = Math.min(0.97, spec.revealRate + 0.03 * state.skills.analysis);
  let found = 0;
  withRng(state, (rng) => {
    for (const d of prop.defects) {
      if (d.revealed || d.repaired) continue;
      if (rng.chance(rate)) {
        d.revealed = true;
        found += 1;
      }
    }
  });

  prop.appraisal = makeAppraisal(prop, state.world, state.day, 'inspected', state.skills.analysis);

  log(
    state,
    found > 0 ? 'warn' : 'good',
    found > 0
      ? `Inspection on ${prop.address} turned up ${found} issue${found === 1 ? '' : 's'}.`
      : `Inspection on ${prop.address} came back clean.`,
  );
  return {
    ok: true,
    message: found > 0 ? `${found} defect(s) found.` : 'No defects found -- though that is not a guarantee.',
  };
}

// ---------------------------------------------------------------------------
// Renovation
// ---------------------------------------------------------------------------

export function startRenovation(
  state: GameState,
  propertyId: PropertyId,
  scopeIds: readonly string[],
  contingencyRate: number,
): ActionResult {
  const prop = findOwned(state, propertyId);
  if (!prop?.ownership) return { ok: false, message: 'You do not own that property.' };
  if (prop.ownership.renovation) return { ok: false, message: 'Work is already underway here.' };
  if (prop.ownership.saleListing) return { ok: false, message: 'Delist it before starting work.' };
  if (scopeIds.length === 0) return { ok: false, message: 'Add at least one line item.' };

  const quote = quoteScope(scopeIds, prop, state.world, state.skills);
  const contingency = Math.round(quote.totalCost * contingencyRate);
  const upfront = quote.totalCost + contingency;

  if (state.cash < upfront) {
    return {
      ok: false,
      message: `That scope needs $${upfront.toLocaleString()} up front (including $${contingency.toLocaleString()} contingency). You have $${Math.round(
        state.cash,
      ).toLocaleString()}.`,
    };
  }

  applyCash(state, -quote.totalCost, 'renovation', `Scope of work on ${prop.address}`, prop.id);
  applyCash(state, -contingency, 'renovation', `Contingency reserve on ${prop.address}`, prop.id);

  prop.ownership.renovation = createJob(quote.lines, quote.totalDays, contingency, state.day);
  prop.ownership.renovationSpend += quote.totalCost;

  log(
    state,
    'info',
    `Work started on ${prop.address}: ${quote.lines.length} line items, ${quote.totalDays} days, $${quote.totalCost.toLocaleString()}.`,
  );
  return { ok: true, message: 'Crew mobilised.' };
}

/** Advance one property's renovation by a day, surfacing change orders. */
function advanceRenovation(state: GameState, prop: Property, rng: Rng): void {
  const own = prop.ownership;
  if (!own?.renovation) return;
  const job = own.renovation;

  job.daysElapsed += 1;

  // Hidden defects surface once a crew is inside the walls.
  const chance = changeOrderChance(state.skills.management);
  for (const d of prop.defects) {
    if (d.revealed || d.repaired) continue;
    const def = DEFECTS_BY_ID[d.defId];
    if (!def || !def.mustFix) continue;
    if (!rng.chance(chance)) continue;

    d.revealed = true;
    const q = quoteScopeItem(`defect:${d.defId}`, prop, state.world, state.skills);
    if (!q) continue;

    job.lines.push({
      itemId: `defect:${d.defId}`,
      quotedCost: q.cost,
      quotedDays: q.days,
      changeOrder: true,
      defectId: d.defId,
    });
    job.totalDays += Math.max(1, Math.round(q.days * 0.8));
    job.spent += q.cost;
    own.renovationSpend += q.cost;

    const fromContingency = Math.min(q.cost, job.contingencyRemaining);
    job.contingencyRemaining -= fromContingency;
    const overage = q.cost - fromContingency;
    if (overage > 0) {
      applyCash(state, -overage, 'changeOrder', `Change order: ${def.name}`, prop.id);
    } else {
      state.ledger.push({
        day: state.day,
        category: 'changeOrder',
        description: `Change order (from contingency): ${def.name}`,
        amount: 0,
        propertyId: prop.id,
      });
    }

    log(
      state,
      overage > 0 ? 'bad' : 'warn',
      `Change order on ${prop.address}: ${def.name}, $${q.cost.toLocaleString()}` +
        (overage > 0
          ? ` -- contingency exhausted, $${overage.toLocaleString()} out of pocket.`
          : ' -- covered by contingency.'),
    );
  }

  if (job.daysElapsed < job.totalDays) return;

  // Job complete.
  for (const line of job.lines) {
    if (line.defectId) {
      const d = prop.defects.find((x) => x.defId === line.defectId);
      if (d) d.repaired = true;
      continue;
    }
    const item = SCOPE_BY_ID[line.itemId];
    if (!item) continue;
    if (!prop.completedWork.includes(line.itemId)) prop.completedWork.push(line.itemId);
    prop.condition = Math.min(0.97, prop.condition + item.conditionLift);
  }

  const returned = job.contingencyRemaining;
  if (returned > 0) {
    applyCash(state, returned, 'renovation', `Unused contingency released on ${prop.address}`, prop.id);
  }
  own.renovation = null;

  log(
    state,
    'good',
    `Work complete on ${prop.address}.` +
      (returned > 0 ? ` $${returned.toLocaleString()} of contingency came back.` : ''),
  );
}

// ---------------------------------------------------------------------------
// Sell side
// ---------------------------------------------------------------------------

export function listForSale(
  state: GameState,
  propertyId: PropertyId,
  listPrice: Money,
): ActionResult {
  const prop = findOwned(state, propertyId);
  if (!prop?.ownership) return { ok: false, message: 'You do not own that property.' };
  if (prop.ownership.renovation) return { ok: false, message: 'Finish the work before listing.' };
  if (prop.ownership.saleListing) return { ok: false, message: 'Already listed.' };
  if (listPrice <= 0) return { ok: false, message: 'List price must be positive.' };

  prop.ownership.saleListing = {
    listPrice: Math.round(listPrice),
    listedDay: state.day,
    daysOnMarket: 0,
    offers: [],
    reductions: 0,
  };
  log(state, 'info', `Listed ${prop.address} at $${Math.round(listPrice).toLocaleString()}.`);
  return { ok: true, message: 'Listed.' };
}

export function reducePrice(
  state: GameState,
  propertyId: PropertyId,
  newPrice: Money,
): ActionResult {
  const prop = findOwned(state, propertyId);
  const sale = prop?.ownership?.saleListing;
  if (!sale) return { ok: false, message: 'That property is not listed.' };
  if (newPrice >= sale.listPrice) return { ok: false, message: 'That is not a reduction.' };
  sale.listPrice = Math.round(newPrice);
  sale.reductions += 1;
  log(state, 'info', `Reduced ${prop!.address} to $${Math.round(newPrice).toLocaleString()}.`);
  return { ok: true, message: 'Price reduced.' };
}

export function delist(state: GameState, propertyId: PropertyId): ActionResult {
  const prop = findOwned(state, propertyId);
  if (!prop?.ownership?.saleListing) return { ok: false, message: 'That property is not listed.' };
  prop.ownership.saleListing = null;
  log(state, 'info', `Withdrew ${prop.address} from the market.`);
  return { ok: true, message: 'Delisted.' };
}

export function acceptOffer(
  state: GameState,
  propertyId: PropertyId,
  offerId: string,
): ActionResult {
  const prop = findOwned(state, propertyId);
  const own = prop?.ownership;
  const sale = own?.saleListing;
  if (!prop || !own || !sale) return { ok: false, message: 'That property is not listed.' };

  const offer = sale.offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, message: 'That offer is no longer available.' };

  const salePrice = offer.amount;
  const { commission, closing } = sellingCosts(salePrice);
  const concession = offer.inspectionConcession;

  const loan = state.loans.find((l) => l.id === own.loanId);
  const payoff = loan ? loanPayoff(loan) : 0;
  const financingCosts = loan ? loan.pointsPaid + Math.round(loan.interestAccrued) : 0;

  applyCash(state, salePrice, 'sale', `Sold ${prop.address}`, prop.id);
  applyCash(state, -commission, 'commission', `Agent commission on ${prop.address}`, prop.id);
  applyCash(state, -closing, 'closing', `Seller closing costs on ${prop.address}`, prop.id);
  if (concession > 0) {
    applyCash(
      state,
      -concession,
      'concession',
      `Buyer inspection concession on ${prop.address}`,
      prop.id,
    );
  }
  if (loan) {
    applyCash(state, -payoff, 'loan', `Loan payoff on ${prop.address}`, prop.id);
    state.loans = state.loans.filter((l) => l.id !== loan.id);
  }

  const netProfit =
    salePrice -
    commission -
    closing -
    concession -
    own.purchasePrice -
    own.closingCosts -
    own.renovationSpend -
    own.holdingCostsPaid -
    financingCosts;

  const daysHeld = Math.max(1, state.day - own.purchaseDay);
  const cashInvested = Math.max(
    1,
    own.purchasePrice + own.closingCosts + own.renovationSpend - (loan?.principal ?? 0),
  );

  const deal: ClosedDeal = {
    propertyId: prop.id,
    address: prop.address,
    neighborhoodId: prop.neighborhoodId,
    boughtDay: own.purchaseDay,
    soldDay: state.day,
    purchasePrice: own.purchasePrice,
    salePrice,
    closingCosts: own.closingCosts + closing,
    renovationSpend: own.renovationSpend,
    holdingCosts: Math.round(own.holdingCostsPaid),
    financingCosts,
    commission,
    concession,
    netProfit: Math.round(netProfit),
    roi: (netProfit / cashInvested) * (365 / daysHeld),
    daysHeld,
  };
  state.closedDeals.push(deal);
  state.portfolio = state.portfolio.filter((p) => p.id !== prop.id);

  log(
    state,
    netProfit >= 0 ? 'good' : 'bad',
    `Sold ${prop.address} for $${salePrice.toLocaleString()}. Net ${
      netProfit >= 0 ? 'profit' : 'loss'
    } of $${Math.abs(Math.round(netProfit)).toLocaleString()} over ${daysHeld} days.`,
  );

  checkOutcome(state);
  return { ok: true, message: 'Sale closed.' };
}

export function rejectOffer(
  state: GameState,
  propertyId: PropertyId,
  offerId: string,
): ActionResult {
  const sale = findOwned(state, propertyId)?.ownership?.saleListing;
  if (!sale) return { ok: false, message: 'That property is not listed.' };
  sale.offers = sale.offers.filter((o) => o.id !== offerId);
  return { ok: true, message: 'Offer declined.' };
}

// ---------------------------------------------------------------------------
// Skills and debt
// ---------------------------------------------------------------------------

export function trainSkill(state: GameState, skill: SkillId): ActionResult {
  const level = state.skills[skill];
  if (level >= ECON.MAX_SKILL_LEVEL) return { ok: false, message: 'Already at maximum.' };
  const cost = skillCost(level);
  if (state.cash < cost) {
    return { ok: false, message: `That costs $${cost.toLocaleString()}.` };
  }
  applyCash(state, -cost, 'training', `Trained ${skill} to level ${level + 1}`);
  state.skills[skill] = level + 1;
  log(state, 'good', `${skill[0].toUpperCase()}${skill.slice(1)} is now level ${level + 1}.`);
  return { ok: true, message: `${skill} improved.` };
}

export function repayLoan(state: GameState, loanId: string, amount: Money): ActionResult {
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, message: 'No such loan.' };
  const payoff = loanPayoff(loan);
  const pay = Math.min(Math.round(amount), payoff);
  if (pay <= 0) return { ok: false, message: 'Repayment must be positive.' };
  if (state.cash < pay) return { ok: false, message: 'Not enough cash.' };

  applyCash(state, -pay, 'loan', `Loan repayment`, loan.propertyId);

  // Interest comes off first, then principal.
  const toInterest = Math.min(pay, loan.interestAccrued);
  loan.interestAccrued -= toInterest;
  loan.principal -= pay - toInterest;

  if (loan.principal <= 0.5) {
    state.loans = state.loans.filter((l) => l.id !== loan.id);
    const prop = findOwned(state, loan.propertyId);
    if (prop?.ownership) prop.ownership.loanId = null;
    log(state, 'good', 'Loan paid off in full.');
  }
  return { ok: true, message: 'Payment applied.' };
}

// ---------------------------------------------------------------------------
// The day loop
// ---------------------------------------------------------------------------

export function advanceDay(state: GameState): ActionResult {
  if (state.phase !== 'playing') return { ok: false, message: 'The game is over.' };

  state.day += 1;
  const level = LEVELS_BY_ID[state.levelId];

  withRng(state, (rng) => {
    updateWorld(state, rng);
    updateEvents(state, rng);
    refreshMarket(state, rng, level.neighborhoods, level.listingCount);
    updatePortfolio(state, rng);
  });

  handleLoanMaturity(state);
  refreshAppraisals(state);
  checkDistress(state);
  checkOutcome(state);

  if (state.day % HISTORY_INTERVAL_DAYS === 0 || state.phase !== 'playing') {
    recordHistory(state);
  }

  return { ok: true, message: `Day ${state.day}.` };
}

export interface SkipResult {
  daysAdvanced: number;
  stoppedEarly: boolean;
  reason: 'completed' | 'offer' | 'setback' | 'gameOver';
}

/**
 * Advance up to `count` days, stopping as soon as something needs a decision.
 *
 * Buyer offers expire in three to seven days, so a naive multi-day skip would
 * run straight past a sale the player would have taken. Advancing halts on a
 * new offer, on any setback worth reading (a change order that breaches the
 * contingency, a foreclosure), and on the game ending.
 */
export function advanceDaysUntilAttention(state: GameState, count: number): SkipResult {
  const offersOpen = () =>
    state.portfolio.reduce((n, p) => n + (p.ownership?.saleListing?.offers.length ?? 0), 0);

  const before = offersOpen();
  let daysAdvanced = 0;

  for (let i = 0; i < count; i++) {
    if (state.phase !== 'playing') {
      return { daysAdvanced, stoppedEarly: true, reason: 'gameOver' };
    }

    const logMark = state.log.length;
    advanceDay(state);
    daysAdvanced += 1;

    if (state.phase !== 'playing') {
      return { daysAdvanced, stoppedEarly: true, reason: 'gameOver' };
    }
    if (offersOpen() > before) {
      return { daysAdvanced, stoppedEarly: true, reason: 'offer' };
    }
    if (state.log.slice(logMark).some((e) => e.tone === 'bad')) {
      return { daysAdvanced, stoppedEarly: true, reason: 'setback' };
    }
  }

  return { daysAdvanced, stoppedEarly: false, reason: 'completed' };
}

function updateWorld(state: GameState, rng: Rng): void {
  const mods = eventModifiers(state.world);

  // Market index: event drift plus a small random walk, gently mean-reverting
  // so a campaign cannot run away to absurd values.
  const pull = (1 - state.world.marketIndex) * 0.0006;
  state.world.marketIndex *= mods.valueDrift;
  state.world.marketIndex += pull + rng.clampedNormal(0, 0.0011, 2.5);
  state.world.marketIndex = Math.max(0.55, Math.min(1.9, state.world.marketIndex));

  // Rates drift slowly toward a long-run anchor; events shift the effective rate.
  state.world.baseRate += (0.065 - state.world.baseRate) * 0.002 + rng.clampedNormal(0, 0.0002, 2);
  state.world.baseRate = Math.max(0.02, Math.min(0.14, state.world.baseRate));
  state.world.interestRate = Math.max(0.01, state.world.baseRate + mods.rateDelta);

  // Per-neighborhood appreciation and idiosyncratic noise.
  for (const [id, idx] of Object.entries(state.world.neighborhoodIndex)) {
    const hood = NEIGHBORHOODS_BY_ID[id];
    if (!hood) continue;
    const local = eventModifiers(state.world, id);
    const drift = hood.appreciation / 365;
    const noise = rng.clampedNormal(0, 0.0009 * hood.volatility, 2.5);
    const next = idx * local.valueDrift + drift + noise;
    state.world.neighborhoodIndex[id] = Math.max(0.5, Math.min(2.2, next));
  }
}

function updateEvents(state: GameState, rng: Rng): void {
  for (const active of state.world.activeEvents) active.daysRemaining -= 1;

  const expired = state.world.activeEvents.filter((a) => a.daysRemaining <= 0);
  for (const e of expired) {
    const def = EVENTS_BY_ID[e.defId];
    if (def) log(state, 'info', `${def.name} has run its course.`);
  }
  state.world.activeEvents = state.world.activeEvents.filter((a) => a.daysRemaining > 0);

  // At most two overlapping events, so the modifiers stay legible.
  if (state.world.activeEvents.length >= 2) return;
  if (!rng.chance(0.012)) return;

  const candidates = EVENTS.filter(
    (e) => !state.world.activeEvents.some((a) => a.defId === e.id),
  );
  if (candidates.length === 0) return;

  const totalWeight = candidates.reduce((s, e) => s + e.weight, 0);
  let roll = rng.float(0, totalWeight);
  let chosen = candidates[0];
  for (const e of candidates) {
    roll -= e.weight;
    if (roll <= 0) {
      chosen = e;
      break;
    }
  }

  state.world.activeEvents.push({
    defId: chosen.id,
    daysRemaining: rng.int(chosen.minDays, chosen.maxDays),
    startedDay: state.day,
  });
  log(state, 'warn', `${chosen.name}: ${chosen.blurb}`);
}

function refreshMarket(
  state: GameState,
  rng: Rng,
  neighborhoods: readonly string[],
  target: number,
): void {
  for (const prop of state.market) {
    if (prop.listing) ageListing(prop.listing, rng);
  }

  // Very stale listings get withdrawn.
  state.market = state.market.filter(
    (p) => !p.listing || p.listing.daysOnMarket < 240 || !rng.chance(0.05),
  );

  while (state.market.length < target) {
    state.market.push(
      generateProperty(rng, state.world, state.day, neighborhoods, state.skills.analysis),
    );
  }
}

function updatePortfolio(state: GameState, rng: Rng): void {
  for (const prop of [...state.portfolio]) {
    const own = prop.ownership;
    if (!own) continue;

    // Carry: taxes, insurance, utilities, HOA.
    const carry = dailyHoldingCost(prop, state.world, state.day);
    own.holdingCostsPaid += carry;
    applyCash(state, -carry, 'holding', `Carrying costs on ${prop.address}`, prop.id);

    // Loan interest.
    const loan = state.loans.find((l) => l.id === own.loanId);
    if (loan) {
      const interest = dailyInterest(loan);
      loan.interestAccrued += interest;
      state.ledger.push({
        day: state.day,
        category: 'financing',
        description: `Interest accrued on ${prop.address}`,
        amount: 0,
        propertyId: prop.id,
      });
    }

    advanceRenovation(state, prop, rng);

    // Sell side.
    const sale = own.saleListing;
    if (sale) {
      sale.daysOnMarket += 1;
      sale.offers = sale.offers.filter((o) => o.expiresDay > state.day);
      if (sale.offers.length < 3) {
        const offer = rollBuyerOffer(
          prop,
          state.world,
          state.day,
          sale.listPrice,
          sale.daysOnMarket,
          state.skills.marketing,
          rng,
        );
        if (offer) {
          sale.offers.push(offer);
          log(
            state,
            'good',
            `Offer on ${prop.address}: $${offer.amount.toLocaleString()} from ${offer.buyerName}.`,
          );
        }
      }
    }
  }
}

function handleLoanMaturity(state: GameState): void {
  for (const loan of [...state.loans]) {
    if (state.day < loan.maturityDay) continue;
    const payoff = loanPayoff(loan);

    if (state.cash >= payoff) {
      applyCash(state, -payoff, 'loan', 'Balloon payment at maturity', loan.propertyId);
      state.loans = state.loans.filter((l) => l.id !== loan.id);
      const prop = findOwned(state, loan.propertyId);
      if (prop?.ownership) prop.ownership.loanId = null;
      log(state, 'warn', 'A hard money note matured and was paid off in full.');
      continue;
    }

    // Cannot pay the balloon: the lender takes the asset.
    const prop = findOwned(state, loan.propertyId);
    state.loans = state.loans.filter((l) => l.id !== loan.id);
    if (prop) {
      state.portfolio = state.portfolio.filter((p) => p.id !== prop.id);
      log(
        state,
        'bad',
        `Foreclosure. The note on ${prop.address} matured and you could not cover the $${payoff.toLocaleString()} balloon. The lender took the property.`,
      );
    }
  }
}

function refreshAppraisals(state: GameState): void {
  for (const prop of [...state.market, ...state.portfolio]) {
    const conf = prop.inspection === 'none' ? 'comps' : 'inspected';
    prop.appraisal = makeAppraisal(prop, state.world, state.day, conf, state.skills.analysis);
  }
}

function checkDistress(state: GameState): void {
  if (state.cash < 0) {
    state.distressDays += 1;
    if (state.distressDays === 1) {
      log(state, 'bad', 'You are cash negative. Sell something or the bank steps in.');
    }
  } else {
    state.distressDays = 0;
  }
}

function checkOutcome(state: GameState): void {
  if (state.phase !== 'playing') return;
  const level = LEVELS_BY_ID[state.levelId];
  const worth = netWorth(state);

  if (worth >= level.goalNetWorth) {
    state.phase = 'won';
    state.outcomeMessage = `You hit $${worth.toLocaleString()} net worth on day ${state.day}.`;
    log(state, 'good', state.outcomeMessage);
    return;
  }

  if (state.distressDays > ECON.DISTRESS_LIMIT_DAYS) {
    state.phase = 'lost';
    state.outcomeMessage = `Insolvent for ${state.distressDays} days. Your creditors have taken over.`;
    log(state, 'bad', state.outcomeMessage);
    return;
  }

  if (level.dayLimit !== null && state.day > level.dayLimit) {
    state.phase = 'lost';
    state.outcomeMessage = `The clock ran out on day ${state.day} with a net worth of $${worth.toLocaleString()}, short of the $${level.goalNetWorth.toLocaleString()} target.`;
    log(state, 'bad', state.outcomeMessage);
  }
}

// ---------------------------------------------------------------------------
// Derived read models for the UI
// ---------------------------------------------------------------------------

export function propertyValueEstimate(state: GameState, prop: Property): Money {
  return prop.appraisal.point;
}

/** True value -- only used for post-hoc reporting, never shown pre-sale. */
export function propertyTrueValue(state: GameState, prop: Property): Money {
  return trueValue(prop, state.world, state.day);
}

export { netWorth, skillCost, scheduleDays };
