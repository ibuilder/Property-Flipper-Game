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
  quoteRefinance,
  sellingCosts,
  skillCost,
  totalDebt,
} from './finance';
import {
  ageListing,
  competingBid,
  evaluateOffer,
  generateProperty,
  hasAppraisalGap,
  rollBuyerOffer,
  settlementPrice,
} from './market';
import {
  adjustReputation,
  commissionDiscount,
  initialReputation,
  pocketListingChance,
} from './reputation';
import {
  annualOpex,
  createRental,
  isHabitable,
  marketRent,
  noi,
  tenantInterest,
} from './rental';
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
import {
  createAuction,
  createAuctionLot,
  evictionCost,
  settleAuction,
} from './auction';
import type {
  ActionResult,
  AuctionLot,
  ClosedDeal,
  DealProjection,
  GameState,
  HouseSubject,
  PostMortem,
  VarianceLine,
  LedgerCategory,
  Loan,
  LogTone,
  Money,
  Property,
  PropertyId,
  SkillId,
} from './types';
import {
  appraisalFromComps,
  compFit,
  defaultCompSelection,
  estimateArv,
  generateAddress,
  generateCompPool,
  trueValue,
} from './valuation';
import { analyzeDeal } from './analyzer';
import { buildScenarioProperty, type ScenarioDef } from './scenarios';

export const SAVE_VERSION = 9;

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
 * The auction's own random stream.
 *
 * Kept separate from the main one deliberately. Drawing auction lots from the
 * shared stream meant that merely *adding* the auction reshuffled every
 * existing campaign -- the same seed produced different listings, different
 * defects and different buyers, and the balance harness moved by tens of
 * thousands of dollars for reasons that had nothing to do with the change.
 * With its own stream, the flipping game is reproducible across every future
 * change to the courthouse, and vice versa.
 */
function withAuctionRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(state.auctionRngState);
  const out = fn(rng);
  state.auctionRngState = rng.getState();
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
    // Offset so the two streams never run in lockstep off the same seed.
    auctionRngState: (seed ^ 0x9e3779b9) >>> 0,
    levelId,
    day: 1,
    phase: 'playing',
    outcomeMessage: '',
    cash: level.startingCash,
    skills: { negotiation: 0, analysis: 0, management: 0, marketing: 0 },
    reputation: initialReputation(),
    world: {
      marketIndex: level.startingMarketIndex,
      baseRate: level.startingRate,
      interestRate: level.startingRate,
      neighborhoodIndex: Object.fromEntries(level.neighborhoods.map((id) => [id, 1])),
      activeEvents: [],
    },
    market: [],
    auctionBlock: [],
    auction: createAuction(),
    portfolio: [],
    loans: [],
    ledger: [],
    log: [],
    closedDeals: [],
    history: [],
    scenarioId: null,
    scenario: null,
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

/**
 * Start an authored deal.
 *
 * Built on the sandbox level so the world rules are shared, then overridden:
 * the authored property is placed on the market alongside a few random
 * distractors, so the lesson still requires recognising the right deal rather
 * than clicking the only one available.
 */
export function createScenarioGame(def: ScenarioDef, seed: number): GameState {
  const state = createGame('sandbox', seed);

  state.scenarioId = def.id;
  state.scenario = def;
  state.cash = def.startingCash;
  state.world.marketIndex = def.marketIndex;
  state.world.baseRate = def.interestRate;
  state.world.interestRate = def.interestRate;
  state.ledger = [];
  state.log = [];
  state.history = [];

  withRng(state, (rng) => {
    const hero = buildScenarioProperty(
      def.property,
      `s_${def.id}`,
      generateAddress(rng),
      rng,
    );
    hero.compPool = generateCompPool(hero, state.world, state.day, rng);
    hero.selectedComps = defaultCompSelection(hero, hero.compPool);
    hero.appraisal = appraisalFromComps(
      hero,
      hero.compPool,
      hero.selectedComps,
      'comps',
      state.skills.analysis,
    );

    const distractors = state.market.slice(0, Math.max(0, def.distractors));
    state.market = [hero, ...distractors];
  });

  recordHistory(state);
  log(state, 'info', `${def.name}. Target profit $${def.targetProfit.toLocaleString()}.`);
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

/**
 * Choose which comparable sales to lean on.
 *
 * Re-derives the estimate immediately, so the player can watch their own ARV
 * move as they swap comps in and out. That feedback is the point -- being
 * wrong about ARV is the most expensive mistake available, and this is where
 * it originates.
 */
export function selectComps(
  state: GameState,
  propertyId: PropertyId,
  compIds: readonly string[],
): ActionResult {
  const prop =
    state.market.find((p) => p.id === propertyId) ?? findOwned(state, propertyId);
  if (!prop) return { ok: false, message: 'No such property.' };
  if (compIds.length === 0) return { ok: false, message: 'Pick at least one comparable.' };
  if (compIds.length > 4) return { ok: false, message: 'Four comparables is plenty.' };

  prop.selectedComps = compIds.filter((id) => prop.compPool.some((c) => c.id === id));
  prop.appraisal = appraisalFromComps(
    prop,
    prop.compPool,
    prop.selectedComps,
    prop.inspection === 'none' ? 'comps' : 'inspected',
    state.skills.analysis,
  );
  return { ok: true, message: `Estimate now $${prop.appraisal.point.toLocaleString()}.` };
}

/** A cheap copy of just what the facade renderer reads. */
function snapshot(prop: Property, opts: { renovating?: boolean; forSale?: boolean } = {}): HouseSubject {
  return {
    id: prop.id,
    address: prop.address,
    archetypeId: prop.archetypeId,
    neighborhoodId: prop.neighborhoodId,
    sqft: prop.sqft,
    beds: prop.beds,
    baths: prop.baths,
    yearBuilt: prop.yearBuilt,
    condition: prop.condition,
    defects: prop.defects.map((d) => ({ ...d })),
    completedWork: [...prop.completedWork],
    noiseSeed: prop.noiseSeed,
    ...opts,
  };
}

/** Capture what the player believed at the moment they committed. */
function captureProjection(
  state: GameState,
  prop: Property,
  price: Money,
  useFinancing: boolean,
): DealProjection {
  // Project against a plausible cosmetic scope; the player refines it later,
  // and the post-mortem reports the difference as scope variance.
  const assumedScope = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];
  const arv = estimateArv(prop, state.world, state.day, assumedScope);
  const analysis = analyzeDeal(prop, state.world, state.day, arv, assumedScope, state.skills, {
    offer: price,
    useFinancing,
  });

  return {
    arv,
    repairEstimate: analysis.repairEstimate,
    renovationDays: analysis.holdDays - Math.round(analysis.holdDays * 0.5),
    marketingDays: Math.round(analysis.holdDays * 0.5),
    projectedProfit: analysis.breakdown?.profit ?? 0,
    purchasePrice: price,
    mao70: analysis.mao70,
    maoDetailed: analysis.maoDetailed,
  };
}

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

  // The seller would take it -- but so would somebody else. A thin offer on a
  // contested listing can still lose.
  const rival = withRng(state, (rng) =>
    competingBid(prop, amount, state.skills.negotiation, rng),
  );
  if (rival !== null) {
    prop.listing.askPrice = Math.max(prop.listing.askPrice, rival);
    prop.listing.reserve = Math.max(prop.listing.reserve, rival);
    log(
      state,
      'bad',
      `Outbid on ${prop.address}. Another buyer went to $${rival.toLocaleString()}.`,
    );
    return {
      ok: false,
      message: `Outbid at $${rival.toLocaleString()}. A thin offer on a wanted house is a coin flip.`,
    };
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
    projection: captureProjection(state, prop, amount, useFinancing),
    boughtAs: snapshot(prop),
    rental: null,
    cashedOut: 0,
    occupiedUntilDay: null,
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
      state.reputation.lenders,
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

  prop.appraisal = appraisalFromComps(
    prop,
    prop.compPool,
    prop.selectedComps,
    'inspected',
    state.skills.analysis,
  );

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
  if (prop.ownership.rental?.tenancy) {
    return { ok: false, message: 'Someone lives there. Wait for the lease to end.' };
  }
  if (prop.ownership.saleListing) return { ok: false, message: 'Delist it before starting work.' };
  if (isOccupied(prop, state.day)) {
    return {
      ok: false,
      message: `The previous owner is still in the house until day ${prop.ownership.occupiedUntilDay}. No crew can start until they are out.`,
    };
  }
  if (scopeIds.length === 0) return { ok: false, message: 'Add at least one line item.' };

  const quote = quoteScope(scopeIds, prop, state.world, state.skills, state.reputation.contractors);
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
  const chance = changeOrderChance(state.skills.management, state.reputation.contractors);
  for (const d of prop.defects) {
    if (d.revealed || d.repaired) continue;
    const def = DEFECTS_BY_ID[d.defId];
    if (!def || !def.mustFix) continue;
    if (!rng.chance(chance)) continue;

    d.revealed = true;
    const q = quoteScopeItem(`defect:${d.defId}`, prop, state.world, state.skills, state.reputation.contractors);
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
      // Blowing through the contingency means the crew waits on your money.
      adjustReputation(state.reputation, 'contractors', -3);
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
  // A job that ran to completion on the money you set aside is what earns a
  // crew's goodwill.
  adjustReputation(state.reputation, 'contractors', returned > 0 ? 4 : 2);

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
  if (prop.ownership.rental?.tenancy) {
    return {
      ok: false,
      message: 'A tenant is in place. You cannot sell it out from under them mid-lease.',
    };
  }
  if (isOccupied(prop, state.day)) {
    return {
      ok: false,
      message: 'Nobody will buy a house with the previous owner still in it. Get possession first.',
    };
  }
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

  // A financed buyer cannot borrow against more than the appraisal, so the
  // price falls to it. Nothing to decide here -- the decision was choosing
  // this offer over a cash one.
  const salePrice = settlementPrice(offer);
  if (hasAppraisalGap(offer)) {
    log(
      state,
      'warn',
      `Appraisal came in at $${offer.appraisedValue.toLocaleString()} on ${prop.address}, under the $${offer.amount.toLocaleString()} contract. The price fell to the appraisal.`,
    );
  }
  const { commission, closing } = sellingCosts(salePrice, state.reputation.agents);
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

  const postMortem = own.projection
    ? buildPostMortem(own.projection, {
        salePrice,
        renovationSpend: own.renovationSpend,
        holdingCosts: Math.round(own.holdingCostsPaid),
        financingCosts,
        concession,
        commission,
        closing,
        daysHeld: Math.max(1, state.day - own.purchaseDay),
        actualProfit: Math.round(netProfit),
      })
    : null;

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
    postMortem,
    before: own.boughtAs,
    after: snapshot(prop),
  };
  state.closedDeals.push(deal);
  state.portfolio = state.portfolio.filter((p) => p.id !== prop.id);
  own.rental = null;

  // Outcomes move standing. Closing cleanly builds it with agents; a
  // profitable exit reassures lenders. Both are modest -- reputation should
  // take several deals to shift, not one.
  adjustReputation(state.reputation, 'agents', sale.reductions > 2 ? 1 : 3);
  if (loan) adjustReputation(state.reputation, 'lenders', netProfit > 0 ? 4 : 1);
  else if (netProfit > 0) adjustReputation(state.reputation, 'lenders', 1);

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

/**
 * Attribute the gap between what was projected and what happened.
 *
 * The game could always tell you that a deal lost money. This says which
 * assumption was wrong, which is the only part worth learning from. Each line
 * is signed from the deal's point of view: negative hurt it.
 */
function buildPostMortem(
  projected: DealProjection,
  actual: {
    salePrice: Money;
    renovationSpend: Money;
    holdingCosts: Money;
    financingCosts: Money;
    concession: Money;
    commission: Money;
    closing: Money;
    daysHeld: number;
    actualProfit: Money;
  },
): PostMortem {
  const lines: VarianceLine[] = [];

  const arvMiss = actual.salePrice - projected.arv;
  lines.push({
    category: 'arv',
    label: 'After-repair value',
    amount: arvMiss,
    note:
      arvMiss < 0
        ? `Sold ${pct(arvMiss, projected.arv)} under the ARV you underwrote. The comps you leaned on were optimistic.`
        : `Sold ${pct(arvMiss, projected.arv)} above your ARV. Conservative comps, or a market that moved your way.`,
  });

  const scopeMiss = projected.repairEstimate - actual.renovationSpend;
  lines.push({
    category: 'scope',
    label: 'Renovation spend',
    amount: scopeMiss,
    note:
      scopeMiss < 0
        ? `Spent $${Math.abs(scopeMiss).toLocaleString()} more than budgeted — a wider scope, or change orders.`
        : `Came in $${scopeMiss.toLocaleString()} under budget.`,
  });

  const projectedHold = projected.renovationDays + projected.marketingDays;
  const dayMiss = projectedHold - actual.daysHeld;
  lines.push({
    category: 'carry',
    label: 'Time on the deal',
    amount: Math.round((dayMiss / Math.max(1, actual.daysHeld)) * actual.holdingCosts),
    note:
      dayMiss < 0
        ? `Held ${Math.abs(dayMiss)} days longer than planned, at $${Math.round(
            actual.holdingCosts / Math.max(1, actual.daysHeld),
          ).toLocaleString()}/day of carry.`
        : `Closed ${dayMiss} days faster than planned.`,
  });

  if (actual.concession > 0) {
    lines.push({
      category: 'concession',
      label: 'Buyer concession',
      amount: -actual.concession,
      note: `The buyer's inspector found defects you left unrepaired and took $${actual.concession.toLocaleString()} off.`,
    });
  }

  if (actual.financingCosts > 0) {
    lines.push({
      category: 'financing',
      label: 'Financing',
      amount: -actual.financingCosts,
      note: `Points and interest on the hard money.`,
    });
  }

  // The biggest single negative is the story.
  const worst = [...lines].sort((a, b) => a.amount - b.amount)[0];
  const beat = actual.actualProfit >= projected.projectedProfit;
  const headline = beat
    ? `Beat the projection by $${(actual.actualProfit - projected.projectedProfit).toLocaleString()}.`
    : worst && worst.amount < 0
      ? `${worst.label} was the problem: ${worst.note}`
      : `Came in $${(projected.projectedProfit - actual.actualProfit).toLocaleString()} under projection.`;

  return {
    projected,
    actualSalePrice: actual.salePrice,
    actualProfit: actual.actualProfit,
    lines,
    headline,
  };
}

function pct(delta: Money, base: Money): string {
  if (base === 0) return '0%';
  return `${Math.abs((delta / base) * 100).toFixed(1)}%`;
}

/** Is a holdover occupant still in the house? */
export function isOccupied(prop: Property, day: number): boolean {
  const until = prop.ownership?.occupiedUntilDay;
  return until !== null && until !== undefined && day < until;
}

// ---------------------------------------------------------------------------
// The courthouse steps
// ---------------------------------------------------------------------------

/**
 * Leave a standing maximum on a lot.
 *
 * A proxy bid, not a price: rivals bid against it and you pay one increment
 * over whoever stops second. That means naming your true ceiling is never
 * punished, so the only question the auction asks is the one worth asking --
 * what is this actually worth to you, sight unseen.
 */
export function placeBid(state: GameState, propertyId: PropertyId, maxBid: Money): ActionResult {
  const lot = state.auction.lots.find((l) => l.propertyId === propertyId);
  if (!lot) return { ok: false, message: 'That lot is not on the block.' };
  if (lot.result) return { ok: false, message: 'That lot has already been sold.' };
  if (maxBid < lot.openingBid) {
    return {
      ok: false,
      message: `The opening bid is $${lot.openingBid.toLocaleString()}. Anything under it is not a bid.`,
    };
  }
  if (maxBid > state.cash) {
    return {
      ok: false,
      message:
        'A trustee sale wants certified funds on the day. You cannot bid more cash than you have, ' +
        'and there is no financing here.',
    };
  }

  lot.myMaxBid = Math.round(maxBid);
  const prop = state.auctionBlock.find((p) => p.id === propertyId);
  log(
    state,
    'info',
    `Maximum of $${lot.myMaxBid.toLocaleString()} left on ${prop?.address ?? 'a lot'}, ` +
      `sale on day ${lot.saleDay}.`,
  );
  return {
    ok: true,
    message: `Bidding up to $${lot.myMaxBid.toLocaleString()}. You pay one increment over the underbidder, not your maximum.`,
  };
}

/** Withdraw a standing bid before the sale. */
export function withdrawBid(state: GameState, propertyId: PropertyId): ActionResult {
  const lot = state.auction.lots.find((l) => l.propertyId === propertyId);
  if (!lot) return { ok: false, message: 'That lot is not on the block.' };
  if (lot.result) return { ok: false, message: 'That lot has already been sold.' };
  lot.myMaxBid = null;
  return { ok: true, message: 'Bid withdrawn.' };
}

// ---------------------------------------------------------------------------
// Hold it instead: rent, then refinance
// ---------------------------------------------------------------------------

/** Advertise the property to let rather than to sell. */
export function listForRent(
  state: GameState,
  propertyId: PropertyId,
  askingRent: Money,
): ActionResult {
  const prop = findOwned(state, propertyId);
  const own = prop?.ownership;
  if (!prop || !own) return { ok: false, message: 'You do not own that property.' };
  if (own.renovation) return { ok: false, message: 'Finish the work before letting it.' };
  if (own.saleListing) return { ok: false, message: 'It is listed for sale. Withdraw it first.' };
  if (own.rental) return { ok: false, message: 'It is already a rental.' };
  if (askingRent <= 0) return { ok: false, message: 'Rent must be positive.' };
  if (isOccupied(prop, state.day)) {
    return { ok: false, message: 'Somebody is still living there. Get possession first.' };
  }
  if (!isHabitable(prop)) {
    return {
      ok: false,
      message:
        'It is not habitable. A landlord owes a warranty of habitability, so the ' +
        'condition has to come up and any known major defect has to be repaired ' +
        'before you can let it.',
    };
  }

  own.rental = createRental(Math.round(askingRent));
  const market = marketRent(prop, state.world, state.day);
  log(
    state,
    'info',
    `Advertised ${prop.address} to let at $${Math.round(askingRent).toLocaleString()}/mo` +
      ` (market is about $${market.toLocaleString()}).`,
  );
  return { ok: true, message: 'Listed to let.' };
}

export function setAskingRent(
  state: GameState,
  propertyId: PropertyId,
  rent: Money,
): ActionResult {
  const rental = findOwned(state, propertyId)?.ownership?.rental;
  if (!rental) return { ok: false, message: 'That property is not a rental.' };
  if (rent <= 0) return { ok: false, message: 'Rent must be positive.' };
  rental.askingRent = Math.round(rent);
  return {
    ok: true,
    message: rental.tenancy
      ? 'Applies when the current lease ends.'
      : `Now advertised at $${Math.round(rent).toLocaleString()}/mo.`,
  };
}

/** Stop renting: the tenant leaves at lease end and the property frees up. */
export function stopRenting(state: GameState, propertyId: PropertyId): ActionResult {
  const own = findOwned(state, propertyId)?.ownership;
  if (!own?.rental) return { ok: false, message: 'That property is not a rental.' };
  if (own.rental.tenancy) {
    return {
      ok: false,
      message: 'There is a tenant in place. You cannot sell it out from under them mid-lease.',
    };
  }
  own.rental = null;
  return { ok: true, message: 'No longer advertised to let.' };
}

/**
 * Pull the capital back out.
 *
 * The second R. A term loan against the improved value repays the acquisition
 * debt and returns the down payment, so the same cash can buy the next house
 * while this one keeps paying. What stops it being free money is DSCR: the
 * rent has to carry the new payment.
 */
export function refinance(state: GameState, propertyId: PropertyId): ActionResult {
  const prop = findOwned(state, propertyId);
  const own = prop?.ownership;
  if (!prop || !own) return { ok: false, message: 'You do not own that property.' };
  if (!own.rental?.tenancy) {
    return { ok: false, message: 'Lenders underwrite the income. Get a tenant in place first.' };
  }

  const existing = state.loans.find((l) => l.id === own.loanId);
  const quote = quoteRefinance({
    value: trueValue(prop, state.world, state.day),
    annualNoi: noi(prop, state.world, state.day, own.rental.tenancy.rent),
    existingPayoff: existing ? loanPayoff(existing) : 0,
    baseRate: state.world.baseRate,
    lenderReputation: state.reputation.lenders,
    daysOwned: state.day - own.purchaseDay,
  });

  if (!quote.eligible) return { ok: false, message: quote.reason };

  // Refinancing a hard money note is worth doing for the terms alone. Doing it
  // again on a loan that already amortises, for no cash, just buys another set
  // of closing costs.
  if (existing?.kind === 'term' && quote.cashOut <= 0) {
    return {
      ok: false,
      message:
        'A second refinance would return nothing and cost you the closing fees. ' +
        'You have already pulled out everything the income supports.',
    };
  }

  if (existing) {
    applyCash(state, -quote.payoff, 'loan', `Paid off hard money on ${prop.address}`, prop.id);
    state.loans = state.loans.filter((l) => l.id !== existing.id);
  }

  const loan: Loan = {
    id: `t${state.loans.length + 1}_${prop.id}`,
    propertyId: prop.id,
    kind: 'term',
    principal: quote.maxLoan,
    monthlyPayment: quote.monthlyPayment,
    pointsPaid: quote.closingCosts,
    annualRate: quote.rate,
    // A term loan amortises rather than ballooning, so maturity is far out.
    maturityDay: state.day + ECON.REFI.termYears * 365,
    interestAccrued: 0,
    originatedDay: state.day,
  };
  state.loans.push(loan);
  own.loanId = loan.id;

  applyCash(state, quote.maxLoan, 'loan', `Refinanced ${prop.address}`, prop.id);
  applyCash(state, -quote.closingCosts, 'closing', `Refinance closing costs`, prop.id);
  own.cashedOut += quote.cashOut;

  adjustReputation(state.reputation, 'lenders', 3);
  log(
    state,
    'good',
    `Refinanced ${prop.address}: $${quote.maxLoan.toLocaleString()} at ${(quote.rate * 100).toFixed(2)}%, ` +
      `$${quote.cashOut.toLocaleString()} back in your pocket. DSCR ${quote.dscrAtMax.toFixed(2)}x.`,
  );
  return { ok: true, message: `$${quote.cashOut.toLocaleString()} cash out.` };
}

/** One day of a rental: find a tenant, collect rent, handle a lease ending. */
function advanceRental(state: GameState, prop: Property, rng: Rng): void {
  const own = prop.ownership;
  const rental = own?.rental;
  if (!own || !rental) return;

  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  const market = marketRent(prop, state.world, state.day);

  if (!rental.tenancy) {
    rental.vacantDays += 1;
    const chance = tenantInterest(
      rental.askingRent,
      market,
      hood?.demand ?? 1,
      state.skills.marketing,
    );
    if (rng.chance(chance)) {
      rental.tenancy = {
        rent: rental.askingRent,
        startedDay: state.day,
        leaseEndsDay: state.day + ECON.RENTAL.leaseDays,
      };
      log(
        state,
        'good',
        `Tenant signed at ${prop.address}: $${rental.askingRent.toLocaleString()}/mo after ${rental.vacantDays} days vacant.`,
      );
      rental.vacantDays = 0;
    }
    return;
  }

  // Rent arrives daily rather than monthly so the ledger stays smooth.
  const gross = rental.tenancy.rent * 12;
  const daily = gross / 365;
  const opexDaily = annualOpex(gross) / 365;
  rental.rentCollected += daily;
  rental.opexPaid += opexDaily;
  applyCash(state, daily, 'rent', `Rent from ${prop.address}`, prop.id);
  applyCash(state, -opexDaily, 'rentalOpex', `Management and maintenance`, prop.id);

  if (state.day >= rental.tenancy.leaseEndsDay) {
    if (rng.chance(ECON.RENTAL.renewalChance)) {
      rental.tenancy.leaseEndsDay = state.day + ECON.RENTAL.leaseDays;
      log(state, 'good', `The tenant at ${prop.address} renewed for another year.`);
    } else {
      rental.tenancy = null;
      rental.turnovers += 1;
      applyCash(
        state,
        -ECON.RENTAL.turnoverCost,
        'rentalOpex',
        `Turnover at ${prop.address}`,
        prop.id,
      );
      log(state, 'warn', `The tenant at ${prop.address} moved out. Turnover and vacancy now.`);
    }
  }
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
  withAuctionRng(state, (rng) => refreshAuction(state, rng, level.neighborhoods));

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

  // Rival buyers work the same market. A well-priced house does not sit around
  // waiting for you to finish deliberating, which is the main pressure the
  // game was missing -- previously a good deal would keep indefinitely.
  const taken: Property[] = [];
  state.market = state.market.filter((p) => {
    if (!p.listing) return true;
    const heat = p.listing.competition * (1 - Math.min(1, p.listing.daysOnMarket / 150));
    if (rng.chance(heat * 0.035)) {
      taken.push(p);
      return false;
    }
    return true;
  });
  for (const p of taken) {
    log(
      state,
      'warn',
      `${p.address} went under contract to another buyer at $${p.listing!.askPrice.toLocaleString()}.`,
    );
  }

  // Very stale listings get withdrawn.
  state.market = state.market.filter(
    (p) => !p.listing || p.listing.daysOnMarket < 240 || !rng.chance(0.05),
  );

  // Standing with agents buys access: a listing shown to you before it is
  // shown to anyone else, priced as though it had not been marketed.
  if (rng.chance(pocketListingChance(state.reputation.agents))) {
    const pocket = generateProperty(
      rng,
      state.world,
      state.day,
      neighborhoods,
      state.skills.analysis,
    );
    if (pocket.listing) {
      pocket.listing.askPrice = Math.round(pocket.listing.askPrice * 0.93);
      pocket.listing.reserve = Math.min(pocket.listing.reserve, pocket.listing.askPrice);
      pocket.listing.competition = 0;
      pocket.listing.daysOnMarket = 0;
    }
    state.market.push(pocket);
    log(state, 'good', `An agent brought you ${pocket.address} before it hits the market.`);
  }

  while (state.market.length < target) {
    state.market.push(
      generateProperty(rng, state.world, state.day, neighborhoods, state.skills.analysis),
    );
  }
}

/**
 * Post new lots, and hold the sale on any that have come due.
 *
 * The board is refreshed on a fixed cadence rather than continuously so that
 * the notice period means something: a lot you see today is genuinely
 * available for a couple of weeks, and knowing you cannot inspect it is a
 * decision you get time to sit with.
 */
function refreshAuction(state: GameState, rng: Rng, neighborhoods: readonly string[]): void {
  // Settle anything whose sale day has arrived.
  const due = state.auction.lots.filter((l) => l.saleDay <= state.day && !l.result);
  for (const lot of due) {
    const prop = state.auctionBlock.find((p) => p.id === lot.propertyId);
    if (!prop) {
      lot.result = { won: false, price: 0, underbid: 0, day: state.day };
      continue;
    }
    const value = trueValue(prop, state.world, state.day);
    const outcome = settleAuction(lot, value, state.cash, rng);
    lot.result = { ...outcome, day: state.day };

    if (!outcome.won) {
      if (lot.myMaxBid !== null && lot.myMaxBid >= lot.openingBid) {
        log(
          state,
          'warn',
          `Outbid on ${prop.address} at auction. It went for $${outcome.underbid.toLocaleString()}; ` +
            `your maximum was $${lot.myMaxBid.toLocaleString()}.`,
        );
      }
      continue;
    }

    takeAuctionTitle(state, prop, lot, outcome.price);
  }

  // Retire settled lots and their properties.
  const settled = new Set(
    state.auction.lots.filter((l) => l.result).map((l) => l.propertyId),
  );
  state.auction.lots = state.auction.lots.filter((l) => !l.result);
  state.auctionBlock = state.auctionBlock.filter((p) => !settled.has(p.id));

  if (state.day < state.auction.nextRefreshDay) return;
  state.auction.nextRefreshDay = state.day + ECON.AUCTION.refreshDays;

  while (state.auction.lots.length < ECON.AUCTION.lotCount) {
    const prop = generateProperty(
      rng,
      state.world,
      state.day,
      neighborhoods,
      state.skills.analysis,
    );
    // Auction stock is not a listing. There is no seller to negotiate with and
    // nothing has been disclosed, so it carries neither.
    prop.listing = null;
    prop.inspection = 'none';
    for (const d of prop.defects) d.revealed = false;
    state.auctionBlock.push(prop);
    state.auction.lots.push(createAuctionLot(prop, state.world, state.day, rng));
  }
}

/** Take title at the courthouse: pay in full, in cash, warts and all. */
function takeAuctionTitle(
  state: GameState,
  prop: Property,
  lot: AuctionLot,
  price: Money,
): void {
  applyCash(state, -price, 'acquisition', `Won ${prop.address} at trustee sale`, prop.id);
  // Auction closing costs are lower -- no agent on either side -- but a title
  // search on a foreclosure is not optional.
  const closing = Math.round(price * ECON.AUCTION.closingRate);
  applyCash(state, -closing, 'closing', `Title and recording on ${prop.address}`, prop.id);

  prop.ownership = {
    purchaseDay: state.day,
    purchasePrice: price,
    closingCosts: closing,
    loanId: null,
    renovation: null,
    saleListing: null,
    holdingCostsPaid: 0,
    renovationSpend: 0,
    projection: null,
    boughtAs: snapshot(prop),
    rental: null,
    cashedOut: 0,
    occupiedUntilDay: null,
  };

  state.portfolio.push(prop);
  state.auctionBlock = state.auctionBlock.filter((p) => p.id !== prop.id);

  log(
    state,
    'good',
    `Won ${prop.address} at trustee sale for $${price.toLocaleString()}` +
      (lot.result ? ` (next bidder stopped at $${lot.result.underbid.toLocaleString()})` : '') +
      '.',
  );

  if (lot.occupied) {
    const cost = evictionCost(prop, state.world, state.day);
    prop.ownership.occupiedUntilDay = state.day + ECON.AUCTION.evictionDays;
    applyCash(state, -cost, 'holding', `Cash for keys and legal on ${prop.address}`, prop.id);
    log(
      state,
      'bad',
      `${prop.address} came occupied. $${cost.toLocaleString()} and ` +
        `${ECON.AUCTION.evictionDays} days before you can touch it -- and you are ` +
        'carrying it the whole time.',
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
      if (loan.kind === 'term') {
        // A term loan is actually paid, daily, and the payment splits into
        // interest and principal -- so the balance genuinely amortises rather
        // than sitting there accruing forever.
        const daily = (loan.monthlyPayment * 12) / 365;
        applyCash(state, -daily, 'financing', `Mortgage payment on ${prop.address}`, prop.id);
        loan.principal = Math.max(0, loan.principal - Math.max(0, daily - interest));
        if (loan.principal <= 0.5) {
          state.loans = state.loans.filter((l) => l.id !== loan.id);
          own.loanId = null;
          log(state, 'good', `${prop.address} is paid off free and clear.`);
        }
      } else {
        loan.interestAccrued += interest;
        state.ledger.push({
          day: state.day,
          category: 'financing',
          description: `Interest accrued on ${prop.address}`,
          amount: 0,
          propertyId: prop.id,
        });
      }
    }

    advanceRenovation(state, prop, rng);
    advanceRental(state, prop, rng);

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
      // A foreclosure is the one thing lenders genuinely remember.
      adjustReputation(state.reputation, 'lenders', -28);
      log(
        state,
        'bad',
        `Foreclosure. The note on ${prop.address} matured and you could not cover the $${payoff.toLocaleString()} balloon. The lender took the property, and your standing with lenders took a serious hit.`,
      );
    }
  }
}

function refreshAppraisals(state: GameState): void {
  for (const prop of [...state.market, ...state.portfolio]) {
    const conf = prop.inspection === 'none' ? 'comps' : 'inspected';
    if (prop.selectedComps.length === 0) {
      prop.selectedComps = defaultCompSelection(prop, prop.compPool);
    }
    prop.appraisal = appraisalFromComps(
      prop,
      prop.compPool,
      prop.selectedComps,
      conf,
      state.skills.analysis,
    );
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

  // Authored deals have their own pass mark: complete a flip that clears the
  // target profit. Net worth is the wrong measure here -- a scenario is about
  // one deal done well, not a portfolio.
  const scenario = state.scenario as ScenarioDef | null;
  if (scenario) {
    const best = state.closedDeals.reduce(
      (m, d) => Math.max(m, d.netProfit),
      Number.NEGATIVE_INFINITY,
    );
    if (state.closedDeals.length > 0 && best >= scenario.targetProfit) {
      state.phase = 'won';
      state.outcomeMessage = `Cleared the target with $${best.toLocaleString()} on the deal.`;
      log(state, 'good', state.outcomeMessage);
      return;
    }
    if (state.distressDays > ECON.DISTRESS_LIMIT_DAYS) {
      state.phase = 'lost';
      state.outcomeMessage = 'Insolvent. The scenario is over.';
      log(state, 'bad', state.outcomeMessage);
      return;
    }
    if (state.day > scenario.dayLimit) {
      state.phase = 'lost';
      state.outcomeMessage =
        state.closedDeals.length > 0
          ? `Time is up. Best deal returned $${best.toLocaleString()} against a $${scenario.targetProfit.toLocaleString()} target.`
          : 'Time is up without completing a flip.';
      log(state, 'bad', state.outcomeMessage);
    }
    return;
  }

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
