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
}

export interface Loan {
  id: string;
  propertyId: PropertyId;
  principal: Money;
  /** Origination fee, already deducted at funding. */
  pointsPaid: Money;
  annualRate: number;
  /** Day the balloon payment comes due. */
  maturityDay: number;
  interestAccrued: Money;
  originatedDay: number;
}

export type SkillId = 'negotiation' | 'analysis' | 'management' | 'marketing';

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
  | 'loan';

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
  levelId: string;
  day: number;
  phase: GamePhase;
  outcomeMessage: string;
  cash: Money;
  skills: Record<SkillId, number>;
  world: WorldState;
  /** Properties currently for sale on the open market. */
  market: Property[];
  /** Properties the player owns. */
  portfolio: Property[];
  loans: Loan[];
  ledger: LedgerEntry[];
  log: LogEntry[];
  /** Sale results, kept for the performance screen. */
  closedDeals: ClosedDeal[];
  /** Sampled time series for the charts. */
  history: HistoryPoint[];
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
  /** Projected-versus-actual, when a projection was captured at purchase. */
  postMortem: PostMortem | null;
}

/** Result shape returned by every player action. */
export interface ActionResult {
  ok: boolean;
  message: string;
}
