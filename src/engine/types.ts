/**
 * Domain types for the Property Flipper simulation.
 *
 * All money is whole dollars, stored as integers, to avoid floating point
 * drift accumulating over a 900-day campaign. Percentages are stored as
 * decimals (0.06 == 6%).
 */

export type Money = number;
export type PropertyId = string;

// ---------------------------------------------------------------------------
// Static content (loaded from src/engine/content.ts, never mutated)
// ---------------------------------------------------------------------------

export interface Neighborhood {
  id: string;
  name: string;
  blurb: string;
  /** Baseline value per square foot in a neutral market. */
  pricePerSqft: number;
  /**
   * Monthly market rent per square foot, at average condition.
   *
   * Deliberately not a fixed multiple of pricePerSqft: cheap areas run higher
   * gross yields than expensive ones, which is exactly why a rental strategy
   * points somewhere different from a flipping strategy.
   */
  rentPerSqft: number;
  /** Annualised organic appreciation, e.g. 0.03 for 3%/yr. */
  appreciation: number;
  /** Relative price volatility. 1.0 is average. */
  volatility: number;
  /** Annual property tax rate applied to assessed value. */
  taxRate: number;
  /** Monthly HOA dues, if any. */
  hoaMonthly: Money;
  /** How quickly homes sell here. 1.0 average, >1 is a hot area. */
  demand: number;
}

export interface Archetype {
  id: string;
  name: string;
  beds: number;
  baths: number;
  sqftRange: [number, number];
  yearRange: [number, number];
  /** Desirability adjustment applied on top of the neighborhood rate. */
  valueAdj: number;
}

export type ScopeCategory =
  | 'cosmetic'
  | 'kitchen'
  | 'bath'
  | 'systems'
  | 'exterior'
  | 'structural'
  | 'addition'
  | 'staging';

export interface ScopeItemDef {
  id: string;
  name: string;
  category: ScopeCategory;
  blurb: string;
  /** Flat cost component. */
  baseCost: Money;
  /** Additional cost scaled by property square footage. */
  costPerSqft: number;
  /** Calendar days of work at baseline crew productivity. */
  days: number;
  /** Value lift as a fraction of the property's base value. */
  valueLift: number;
  /** How much this improves measured condition (0-1 scale). */
  conditionLift: number;
}

export type DefectSeverity = 'minor' | 'moderate' | 'major';

export interface DefectDef {
  id: string;
  name: string;
  severity: DefectSeverity;
  blurb: string;
  repairCost: Money;
  repairDays: number;
  /**
   * True when a buyer's inspector will always catch this and demand it be
   * cured. These are the ones that turn into change orders and price
   * concessions -- you cannot paint over a cracked foundation.
   */
  mustFix: boolean;
  /** Relative likelihood of appearing on an older / poorer-condition home. */
  weight: number;
}

export interface MarketEventDef {
  id: string;
  name: string;
  blurb: string;
  minDays: number;
  maxDays: number;
  /** Relative likelihood of being drawn. */
  weight: number;
  effects: {
    /** Multiplier applied to the market-wide value index. */
    valueDrift?: number;
    /** Multiplier on renovation material + labour costs. */
    costMultiplier?: number;
    /** Multiplier on renovation duration. */
    timeMultiplier?: number;
    /** Additive change to the prevailing interest rate. */
    rateDelta?: number;
    /** Multiplier on buyer demand (affects days on market). */
    demandMultiplier?: number;
    /** Restrict the effect to a single neighborhood. */
    neighborhoodId?: string;
  };
}

export interface LevelDef {
  id: string;
  name: string;
  blurb: string;
  startingCash: Money;
  /** Net worth required to win. */
  goalNetWorth: Money;
  /** Hard deadline in days; null for sandbox. */
  dayLimit: number | null;
  neighborhoods: string[];
  /** Starting market index. <1 is a buyer's market. */
  startingMarketIndex: number;
  startingRate: number;
  /** Number of active listings kept on the market. */
  listingCount: number;
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export interface Defect {
  defId: string;
  /** Has the player discovered this yet (via inspection or during work)? */
  revealed: boolean;
  /** Has it been repaired? */
  repaired: boolean;
}

export type AppraisalConfidence = 'guess' | 'comps' | 'inspected' | 'appraised';

export interface Appraisal {
  /** Midpoint of the player's estimate of current as-is value. */
  point: Money;
  low: Money;
  high: Money;
  confidence: AppraisalConfidence;
  /** The comps this estimate was actually built from. */
  comps: Comp[];
  /** How well the chosen comps match the subject; drives the band width. */
  fitScore: number;
}

/**
 * What the player believed at the moment they committed.
 *
 * Captured at purchase so the post-mortem can compare it against what actually
 * happened and attribute the difference. Without this the game can tell you
 * that you lost money but not *why*, which is the only part worth learning.
 */
export interface DealProjection {
  arv: Money;
  repairEstimate: Money;
  renovationDays: number;
  marketingDays: number;
  projectedProfit: Money;
  purchasePrice: Money;
  /** MAO figures at the time, for hindsight on discipline. */
  mao70: Money;
  maoDetailed: Money;
}

export type VarianceCategory =
  | 'arv'
  | 'scope'
  | 'changeOrders'
  | 'carry'
  | 'concession'
  | 'financing';

export interface VarianceLine {
  category: VarianceCategory;
  label: string;
  /** Negative hurt the deal, positive helped it. */
  amount: Money;
  note: string;
}

/**
 * Everything the facade renderer needs, and nothing else.
 *
 * Kept separate from Property so a closed deal can carry a cheap snapshot of
 * how the house looked when bought and when sold. Storing the whole Property
 * twice would drag the comp pool into every save for no benefit.
 */
export interface HouseSubject {
  id: string;
  address: string;
  archetypeId: string;
  neighborhoodId: string;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
  condition: number;
  defects: Defect[];
  completedWork: string[];
  noiseSeed: number;
  /**
   * Line items a running job has finished but not yet booked.
   *
   * Visual only, and deliberately separate from completedWork: writing these
   * into completedWork would let a half-finished renovation raise the
   * property's value, which is the one thing a progress indicator must never
   * do.
   */
  workInProgress?: string[];
  /** 0-1 through the current job, for taking scaffolding down as it nears done. */
  renovationProgress?: number;
  /** Crew on site: draws a skip in the drive. */
  renovating?: boolean;
  /** Board in the yard. */
  forSale?: boolean;
}

/** Projected-versus-actual, with the gap attributed. */
export interface PostMortem {
  projected: DealProjection;
  actualSalePrice: Money;
  actualProfit: Money;
  lines: VarianceLine[];
  /** The single biggest driver of the miss. */
  headline: string;
}

/**
 * A comparable sale.
 *
 * Comps are generated as real properties and priced with the same valuation
 * model as everything else, so a comp in a pricier area genuinely did sell for
 * more per square foot. That is what makes choosing them a skill rather than a
 * formality: lean on the wrong ones and your estimate is wrong in a specific,
 * explicable direction.
 */
export interface Comp {
  id: string;
  address: string;
  neighborhoodId: string;
  sqft: number;
  beds: number;
  baths: number;
  soldPrice: Money;
  soldDaysAgo: number;
  distanceMi: number;
  /** Standard the comp was in when it sold. */
  quality: 'renovated' | 'average' | 'dated';
}

/** How far a comp is from the subject, 0 (identical) to 1 (useless). */
export interface CompFit {
  compId: string;
  /** Lower is better. */
  score: number;
  reasons: string[];
}

export type SellerTypeId =
  | 'estate'
  | 'tired_landlord'
  | 'developer'
  | 'retail'
  | 'relocating';

export interface SellerType {
  id: SellerTypeId;
  name: string;
  blurb: string;
  /** Multiplier on the asking premium. */
  askBias: number;
  /** Multiplier on the reserve ratio; below 1 means they will take less. */
  reserveBias: number;
  /** How fast the reserve erodes with days on market. */
  staleness: number;
  /** Fraction of a disclosed defect they will concede. */
  concedes: number;
  weight: number;
}

export interface ScopeLineItem {
  itemId: string;
  /** Quoted cost at the time the scope was locked in. */
  quotedCost: Money;
  quotedDays: number;
  /** True when this line came from a change order rather than the plan. */
  changeOrder: boolean;
  /** Defect this line is curing, if any. */
  defectId?: string;
}

export interface RenovationJob {
  lines: ScopeLineItem[];
  /** Total days of work required, including change orders added so far. */
  totalDays: number;
  daysElapsed: number;
  /** Budgeted contingency, in dollars, still unspent. */
  contingencyRemaining: Money;
  contingencyBudgeted: Money;
  /** Money already paid out on this job. */
  spent: Money;
  startedDay: number;
}

export interface Listing {
  /** Price the property is publicly listed at. */
  askPrice: Money;
  daysOnMarket: number;
  /**
   * Hidden reserve. An offer at or above this is accepted. Decays as the
   * listing goes stale.
   */
  reserve: Money;
  /** 0-1; motivated sellers drop their reserve faster. */
  sellerMotivation: number;
  /**
   * How much rival buyer attention this listing draws, 0-1.
   *
   * Drives both the chance a competitor buys it out from under you and the
   * chance a marginal offer gets outbid. Underpriced listings draw the most,
   * which is exactly why good deals do not sit around waiting.
   */
  competition: number;
}

export interface Property {
  id: PropertyId;
  address: string;
  archetypeId: string;
  neighborhoodId: string;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
  /** True physical condition, 0-1. The player only ever sees an estimate. */
  condition: number;
  defects: Defect[];
  /** Scope item ids already completed on this property. */
  completedWork: string[];
  /** Player-facing valuation, recomputed when new information arrives. */
  appraisal: Appraisal;
  /** Every comparable sale on offer for this property. */
  compPool: Comp[];
  /** Which comps the player is leaning on. Defaults to the closest matches. */
  selectedComps: string[];
  /** Who is selling, and therefore how they behave. */
  sellerType: SellerTypeId;
  /** Set while the property sits on the open market. */
  listing: Listing | null;
  /** Set once the player owns it. */
  ownership: Ownership | null;
  /**
   * Due diligence level purchased on this property.
   *
   * This lives on the Property rather than on Ownership deliberately: a real
   * buyer inspects during the contingency period, *before* closing, so that
   * the findings can inform the offer or justify walking away. Putting it
   * behind ownership would make inspection a pure cost with no decision value.
   */
  inspection: 'none' | 'standard' | 'thorough';
  /** Stable per-property noise seed so estimates don't jitter between renders. */
  noiseSeed: number;
}

/**
 * One lot at a trustee sale.
 *
 * The property itself lives in `GameState.auctionBlock`, kept apart from the
 * open market because almost nothing you can do to a listing applies here:
 * there is no seller to negotiate with, no inspection to order, and no
 * contingency to walk away under.
 */
export interface AuctionLot {
  propertyId: PropertyId;
  /** The lender's credit bid: what they are owed, not what it is worth. */
  openingBid: Money;
  /** The day it goes under the hammer. */
  saleDay: number;
  /** How much of a crowd the opening bid has drawn, 0-1. */
  rivalInterest: number;
  /** Somebody still lives there, and getting them out costs time and money. */
  occupied: boolean;
  /** Your standing maximum. Rivals bid against it while you are elsewhere. */
  myMaxBid: Money | null;
  result: AuctionResult | null;
}

export interface AuctionResult {
  won: boolean;
  /** What you actually paid: one increment over the runner-up, never more than your maximum. */
  price: Money;
  /** What the room was willing to go to. Visible only after the fact. */
  underbid: Money;
  day: number;
}

export interface Auction {
  lots: AuctionLot[];
  nextRefreshDay: number;
}

/**
 * A multi-year change in what a neighborhood is.
 *
 * Not an event: events expire and leave nothing behind. An arc moves the index
 * a little every day for years, ramping in and out, and is visible on the
 * ground well before it is finished — which is what makes buying into one an
 * actual decision rather than a lottery.
 */
export interface NeighborhoodArc {
  neighborhoodId: string;
  kind: 'gentrifying' | 'declining';
  startedDay: number;
  totalDays: number;
  /** Whether the player has been told. Arcs run silently before that. */
  announced: boolean;
}

/**
 * Everything needed to rebuild one house exactly.
 *
 * Lives here rather than in scenarios.ts because two things need it now: an
 * authored lesson, and replaying a deal you have already closed. One
 * definition, so a replay cannot quietly diverge from the house it is
 * replaying.
 */
export interface ScenarioProperty {
  archetypeId: string;
  neighborhoodId: string;
  sqft: number;
  yearBuilt: number;
  /** 0-1. */
  condition: number;
  defectIds: string[];
  /** Defects already on the table before any inspection. */
  disclosedIds: string[];
  sellerType: SellerTypeId;
  askPrice: Money;
}

/**
 * A closed deal, packaged so it can be played again.
 *
 * The market conditions travel with the house because a replay in a different
 * market is a different problem -- the point is to hand back the same decision
 * with the benefit of knowing how it went, not a superficially similar one.
 */
export interface ReplayCapture {
  property: ScenarioProperty;
  marketIndex: number;
  interestRate: number;
  /** What the player had to work with, so the replay is neither easier nor harder. */
  cashAtPurchase: Money;
  boughtFor: Money;
}

export type Difficulty = 'forgiving' | 'standard' | 'brutal';

/**
 * Difficulty expressed entirely as multipliers, so there is exactly one place
 * to look for what a setting changes.
 */
export interface DifficultyMods {
  startingCash: number;
  /** How violently the market index and rates move. */
  volatility: number;
  /** How much stays hidden behind the walls. */
  hiddenDefects: number;
  /** How aggressively rival buyers work the same listings. */
  competition: number;
  /** How firmly sellers hold their reserve. */
  sellerFirmness: number;
  /** How often a crew finds something unbudgeted. */
  changeOrders: number;
  /** How much of the campaign clock you get. */
  clock: number;
}

/** Accumulated know-how. Cannot be bought, and is never lost. */
export interface Experience {
  xp: number;
  level: number;
  /** Levels earned but not yet spent on a skill. */
  unspentPoints: number;
}

/**
 * People on the payroll rather than subs called per job.
 *
 * Cheaper and faster per job, and billed every day whether or not there is
 * work -- which is the decision that actually decides whether the business
 * scales past one house at a time.
 */
export interface Crew {
  size: number;
  hiredDay: number;
  idleDays: number;
  workingDays: number;
  wagesPaid: Money;
}

/** How a purchase is paid for. */
export type FinancingKind = 'cash' | 'hardMoney' | 'private' | 'seller' | 'partner';

export interface FinancePlan {
  kind: FinancingKind;
}

/**
 * An equity partner on a single deal.
 *
 * Not debt: there is no rate, no maturity and nothing to default on. What
 * there is instead is a permanent claim on the upside, and a first claim on
 * the capital, which is what makes equity the expensive-but-safe option.
 */
export interface Partnership {
  name: string;
  capital: Money;
  profitShare: number;
}

export interface Ownership {
  purchaseDay: number;
  purchasePrice: Money;
  closingCosts: Money;
  /** Attached hard money loan, if the purchase was financed. */
  loanId: string | null;
  renovation: RenovationJob | null;
  /** Set once the player lists it for sale. */
  saleListing: SaleListing | null;
  /** Running total of holding costs paid on this property. */
  holdingCostsPaid: Money;
  /** Running total of renovation spend, including change orders. */
  renovationSpend: Money;
  /** What was believed at the moment of purchase. */
  projection: DealProjection | null;
  /** How it looked the day it was bought, for the before/after. */
  boughtAs: HouseSubject | null;
  /** Set once the property is held for rent rather than sale. */
  rental: Rental | null;
  /** Cash already pulled back out by refinancing. */
  cashedOut: Money;
  /**
   * Set when an auction property came with somebody living in it. Nothing can
   * be done to the house until they are out -- but the carry runs regardless,
   * which is the cost the courthouse discount is paying for.
   */
  occupiedUntilDay: number | null;
  /** Set when somebody else put up part of the capital for this deal. */
  partner: Partnership | null;
  /**
   * The deal exactly as it was the day it was bought, in a form that can
   * rebuild it. Captured at purchase rather than derived at sale, because by
   * then the condition has changed and every defect has been found.
   */
  replay: ReplayCapture | null;
  /**
   * The profit range committed to at purchase, if the player made one.
   *
   * Held here while the deal is live and copied onto the closed deal at sale,
   * so the record survives the property leaving the portfolio.
   */
  forecast?: Forecast | null;
}

export interface SaleListing {
  listPrice: Money;
  listedDay: number;
  daysOnMarket: number;
  /** Offers currently on the table. */
  offers: BuyerOffer[];
  /** Price reductions taken so far. */
  reductions: number;
}

export interface BuyerOffer {
  id: string;
  amount: Money;
  /** Concession the buyer will demand after their inspection. */
  inspectionConcession: Money;
  /** Day the offer expires. */
  expiresDay: number;
  buyerName: string;
  /**
   * Financed buyers bid higher but bring a lender's appraisal. If it comes in
   * below the contract price the loan will not cover the difference, and the
   * price falls to the appraisal. Cash buyers offer less and simply close.
   */
  financed: boolean;
  /**
   * What the lender will value it at, fixed when the offer is made so the
   * outcome is determined rather than re-rolled on inspection.
   */
  appraisedValue: Money;
}

export interface Tenancy {
  rent: Money;
  startedDay: number;
  /** They may renew at the end, or they may not. */
  leaseEndsDay: number;
}

export interface Rental {
  /** What the unit is advertised at. */
  askingRent: Money;
  tenancy: Tenancy | null;
  /** Days empty in the current spell. Vacancy is the real cost of over-asking. */
  vacantDays: number;
  rentCollected: Money;
  opexPaid: Money;
  turnovers: number;
}

/**
 * Short-term acquisition debt and long-term rental debt behave differently
 * enough that the type distinguishes them: hard money is interest-only with a
 * balloon that can take the house, a term loan amortises and simply gets paid.
 */
export type LoanKind = 'hardMoney' | 'term' | 'private' | 'seller';

export interface Loan {
  id: string;
  propertyId: PropertyId;
  kind: LoanKind;
  principal: Money;
  /** Amortising payment for a term loan; zero for interest-only hard money. */
  monthlyPayment: Money;
  /** Origination fee, already deducted at funding. */
  pointsPaid: Money;
  annualRate: number;
  /** Day the balloon payment comes due. */
  maturityDay: number;
  interestAccrued: Money;
  originatedDay: number;
}

export type SkillId = 'negotiation' | 'analysis' | 'management' | 'marketing';

/**
 * Standing with the three parties whose goodwill actually compounds.
 *
 * Distinct from skills, which are bought with cash. Reputation is earned by
 * outcomes and is the thing that makes a fifth flip easier than a first --
 * which is how the business really works, and what the genre research points
 * to for retention past the opening hours.
 */
export type ReputationId = 'lenders' | 'agents' | 'contractors';

/** 0-100, starting at 50. */
export type Reputation = Record<ReputationId, number>;

export interface BuyerOfferTerms {
  /** Financed buyers pay more but bring an appraisal with them. */
  financed: boolean;
}

export type LedgerCategory =
  | 'acquisition'
  | 'closing'
  | 'financing'
  | 'renovation'
  | 'changeOrder'
  | 'holding'
  | 'inspection'
  | 'sale'
  | 'commission'
  | 'concession'
  | 'training'
  | 'loan'
  | 'rent'
  | 'rentalOpex';

export interface LedgerEntry {
  day: number;
  category: LedgerCategory;
  description: string;
  /** Positive is cash in, negative is cash out. */
  amount: Money;
  propertyId?: PropertyId;
}

export interface ActiveEvent {
  defId: string;
  daysRemaining: number;
  startedDay: number;
}

/**
 * One item in the market news feed.
 *
 * `effects` is the load-bearing field and it is always *derived* from the
 * thing's own modifiers, never authored. An item that cannot say what it does
 * to the player's board carries an empty list rather than a reassuring
 * sentence.
 */
export interface NewsItem {
  id: string;
  /** Where it applies: a neighbourhood name, or the market at large. */
  kicker: string;
  headline: string;
  body: string;
  /** What it does to your board, computed. */
  effects: string[];
  daysRemaining: number;
  /** The day it began, so the feed can sort newest first. */
  day: number;
}

export interface WorldState {
  /** Market-wide value index. 1.0 is the level the campaign started at. */
  marketIndex: number;
  /** Underlying rate before event effects are layered on. */
  baseRate: number;
  /** Prevailing interest rate, drives hard money pricing and buyer demand. */
  interestRate: number;
  /** Per-neighborhood index layered on top of the market index. */
  neighborhoodIndex: Record<string, number>;
  activeEvents: ActiveEvent[];
  /** Slow, directional neighborhood change. Outlives any event. */
  arcs: NeighborhoodArc[];
}

export type GamePhase = 'playing' | 'won' | 'lost';

/**
 * A periodic snapshot of the things worth plotting.
 *
 * Sampled rather than recorded every day: a 900-day campaign at daily
 * resolution is more points than any chart can usefully draw, and the save
 * file has to stay small enough to hand around.
 */
export interface HistoryPoint {
  day: number;
  marketIndex: number;
  interestRate: number;
  netWorth: Money;
  cash: Money;
  debt: Money;
  /** Per-neighborhood index at this sample. */
  neighborhoods: Record<string, number>;
}

export interface GameState {
  version: number;
  seed: number;
  rngState: number;
  /**
   * A second, independent random stream for the auction board.
   *
   * Separate so that changes to one side of the game cannot reshuffle the
   * other. Both derive from the same seed, so a given seed still reproduces a
   * whole campaign exactly.
   */
  auctionRngState: number;
  /** A third stream for the slow world: neighborhood arcs and event chains. */
  worldRngState: number;
  levelId: string;
  difficulty: Difficulty;
  day: number;
  phase: GamePhase;
  outcomeMessage: string;
  cash: Money;
  skills: Record<SkillId, number>;
  /** Standing with lenders, agents and contractors. */
  reputation: Reputation;
  /** Accumulated know-how, earned only by doing the work. */
  experience: Experience;
  /** People on the payroll, if you have chosen to carry any. */
  crew: Crew | null;
  world: WorldState;
  /** Properties currently for sale on the open market. */
  market: Property[];
  /** Properties going to a trustee sale, and the lots themselves. */
  auctionBlock: Property[];
  auction: Auction;
  /** Properties the player owns. */
  portfolio: Property[];
  loans: Loan[];
  ledger: LedgerEntry[];
  log: LogEntry[];
  /** Sale results, kept for the performance screen. */
  closedDeals: ClosedDeal[];
  /**
   * Listings the player is following.
   *
   * Ids rather than objects, because a listing leaves the market when someone
   * else buys it and the whole point is to be told that it is gone.
   */
  watched: PropertyId[];
  /** Sampled time series for the charts. */
  history: HistoryPoint[];
  /**
   * Set when playing an authored deal rather than a campaign. Carries its own
   * win condition, so `levelId` is only a fallback for shared world settings.
   */
  scenarioId: string | null;
  /** The authored deal itself, inlined so a save is self-contained. */
  scenario: unknown | null;
  /** Consecutive days the player has been unable to service debt. */
  distressDays: number;
}

export type LogTone = 'info' | 'good' | 'bad' | 'warn';

export interface LogEntry {
  day: number;
  tone: LogTone;
  message: string;
}

export interface ClosedDeal {
  propertyId: PropertyId;
  address: string;
  neighborhoodId: string;
  boughtDay: number;
  soldDay: number;
  purchasePrice: Money;
  salePrice: Money;
  closingCosts: Money;
  renovationSpend: Money;
  holdingCosts: Money;
  financingCosts: Money;
  commission: Money;
  concession: Money;
  netProfit: Money;
  /** Annualised return on the cash actually invested. */
  roi: number;
  daysHeld: number;
  /**
   * The day it went on the market, so "how long did it sit" is answerable
   * afterwards rather than only while it was still listed.
   *
   * Optional because deals closed before this existed have no record of it,
   * and inventing one from the ledger would be a guess presented as a fact.
   */
  listedDay?: number | null;
  /** Projected-versus-actual, when a projection was captured at purchase. */
  postMortem: PostMortem | null;
  /** How the house looked the day it was bought, and the day it sold. */
  before: HouseSubject | null;
  after: HouseSubject | null;
  /** Enough to rebuild this deal and let the player run it again. */
  replay: ReplayCapture | null;
  /**
   * The profit range the player committed to before buying, if they did.
   *
   * Optional and nullable: forecasting is voluntary, and deals closed before
   * it existed have none. A skipped forecast is not scored — being made to
   * guess would produce numbers that measure compliance rather than belief.
   */
  forecast?: Forecast | null;
}

/**
 * A range the player commits to before the outcome is known.
 *
 * Stored against the property at purchase and copied onto the closed deal so
 * it survives the sale. Immutable once made: a forecast you can revise after
 * seeing how the work is going is not a forecast.
 */
export interface Forecast {
  propertyId: string;
  /** The day it was committed. */
  day: number;
  low: Money;
  high: Money;
  /** The confidence the range is declared at, e.g. 0.8. */
  confidence: number;
}

/** A forecast with the outcome measured against it. */
export interface ScoredForecast extends Forecast {
  actual: Money;
  hit: boolean;
  /** 0 at the low end, 1 at the high end; outside [0,1] means missed. */
  position: number;
  /** Half-width over midpoint: how precise the claim was. */
  relativeWidth: number;
  /** Signed error against the midpoint, as a fraction. */
  error: number;
}

/** Result shape returned by every player action. */
export interface ActionResult {
  ok: boolean;
  message: string;
  /**
   * A price the seller said they would take, when a rejected offer was close
   * enough to draw a counter.
   *
   * Structured rather than left buried in the message text so the interface
   * can offer it as a decision. Making the player read a number out of a toast
   * and retype it is the kind of friction that turns a negotiation into
   * paperwork -- and it hides the actual question, which is whether the
   * countered price still clears your own maximum.
   */
  counterPrice?: Money;
}
