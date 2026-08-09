import type {
  Archetype,
  DefectDef,
  LevelDef,
  MarketEventDef,
  Neighborhood,
  ScopeItemDef,
  SellerType,
} from './types';

// ---------------------------------------------------------------------------
// Neighborhoods
// ---------------------------------------------------------------------------

export const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 'riverside_flats',
    name: 'Riverside Flats',
    blurb: 'Entry-level stock near the old rail yard. Cheap to buy, slow to appreciate.',
    pricePerSqft: 95,
    rentPerSqft: 0.95,
    appreciation: 0.02,
    volatility: 0.8,
    taxRate: 0.011,
    hoaMonthly: 0,
    demand: 0.9,
  },
  {
    id: 'maple_heights',
    name: 'Maple Heights',
    blurb: 'Postwar suburbia with good schools. The bread-and-butter flip market.',
    pricePerSqft: 165,
    rentPerSqft: 1.2,
    appreciation: 0.03,
    volatility: 1.0,
    taxRate: 0.013,
    hoaMonthly: 0,
    demand: 1.1,
  },
  {
    id: 'old_town',
    name: 'Old Town',
    blurb: 'Historic district. Charming, well located, and full of surprises behind the plaster.',
    pricePerSqft: 190,
    rentPerSqft: 1.45,
    appreciation: 0.035,
    volatility: 1.3,
    taxRate: 0.014,
    hoaMonthly: 0,
    demand: 1.05,
  },
  {
    id: 'the_grid',
    name: 'The Grid',
    blurb: 'Downtown core. High price per foot, high carrying cost, impatient buyers.',
    pricePerSqft: 240,
    rentPerSqft: 1.95,
    appreciation: 0.045,
    volatility: 1.6,
    taxRate: 0.015,
    hoaMonthly: 385,
    demand: 1.2,
  },
  {
    id: 'millworks',
    name: 'The Millworks',
    blurb: 'Transitional industrial fringe. Gentrifying fast, but the swings are brutal.',
    pricePerSqft: 78,
    rentPerSqft: 0.8,
    appreciation: 0.06,
    volatility: 2.2,
    taxRate: 0.009,
    hoaMonthly: 0,
    demand: 0.75,
  },
  {
    id: 'harbor_point',
    name: 'Harbor Point',
    blurb: 'Waterfront luxury. Enormous spreads, enormous holding costs, thin buyer pool.',
    pricePerSqft: 330,
    rentPerSqft: 2.3,
    appreciation: 0.05,
    volatility: 2.0,
    taxRate: 0.017,
    hoaMonthly: 240,
    demand: 0.7,
  },
];

// ---------------------------------------------------------------------------
// Property archetypes
// ---------------------------------------------------------------------------

export const ARCHETYPES: Archetype[] = [
  { id: 'bungalow', name: 'Bungalow', beds: 2, baths: 1, sqftRange: [900, 1300], yearRange: [1920, 1955], valueAdj: 0.96 },
  { id: 'ranch', name: 'Ranch', beds: 3, baths: 2, sqftRange: [1200, 1800], yearRange: [1955, 1985], valueAdj: 1.0 },
  { id: 'colonial', name: 'Colonial', beds: 4, baths: 3, sqftRange: [2000, 2800], yearRange: [1960, 1999], valueAdj: 1.06 },
  { id: 'condo', name: 'Condo', beds: 2, baths: 1, sqftRange: [650, 1050], yearRange: [1975, 2015], valueAdj: 0.9 },
  { id: 'victorian', name: 'Victorian', beds: 4, baths: 2, sqftRange: [1800, 2600], yearRange: [1890, 1925], valueAdj: 1.04 },
  { id: 'townhouse', name: 'Townhouse', beds: 3, baths: 3, sqftRange: [1400, 1900], yearRange: [1985, 2010], valueAdj: 1.0 },
  { id: 'duplex', name: 'Duplex', beds: 4, baths: 2, sqftRange: [1600, 2200], yearRange: [1940, 1980], valueAdj: 0.98 },
];

// ---------------------------------------------------------------------------
// Scope of work catalogue
//
// Costs are deliberately in the right order of magnitude for a US residential
// rehab so that the 70% rule produces sensible numbers.
// ---------------------------------------------------------------------------

export const SCOPE_ITEMS: ScopeItemDef[] = [
  {
    id: 'paint_interior',
    name: 'Interior Paint',
    category: 'cosmetic',
    blurb: 'Cheapest dollar-for-dollar lift there is. Almost always worth doing.',
    baseCost: 900,
    costPerSqft: 2.6,
    days: 4,
    valueLift: 0.022,
    conditionLift: 0.05,
  },
  {
    id: 'flooring_lvp',
    name: 'Luxury Vinyl Plank Flooring',
    category: 'cosmetic',
    blurb: 'Durable, fast to install, photographs well. The workhorse flip floor.',
    baseCost: 1200,
    costPerSqft: 6.0,
    days: 6,
    valueLift: 0.04,
    conditionLift: 0.08,
  },
  {
    id: 'flooring_hardwood',
    name: 'Hardwood Flooring',
    category: 'cosmetic',
    blurb: 'Higher lift, but only pays off in price points where buyers expect it.',
    baseCost: 2000,
    costPerSqft: 12.0,
    days: 9,
    valueLift: 0.065,
    conditionLift: 0.1,
  },
  {
    id: 'kitchen_refresh',
    name: 'Kitchen Refresh',
    category: 'kitchen',
    blurb: 'Paint the boxes, new doors, new counters and hardware. Keep the layout.',
    baseCost: 12000,
    costPerSqft: 0,
    days: 10,
    valueLift: 0.055,
    conditionLift: 0.08,
  },
  {
    id: 'kitchen_full',
    name: 'Full Kitchen Gut',
    category: 'kitchen',
    blurb: 'New everything. Big lift, big spend, long schedule. Watch the plumbing.',
    baseCost: 32000,
    costPerSqft: 0,
    days: 21,
    valueLift: 0.115,
    conditionLift: 0.15,
  },
  {
    id: 'bath_refresh',
    name: 'Bathroom Refresh',
    category: 'bath',
    blurb: 'Vanity, fixtures, tile surround, paint. Quick and reliable.',
    baseCost: 6000,
    costPerSqft: 0,
    days: 7,
    valueLift: 0.032,
    conditionLift: 0.05,
  },
  {
    id: 'bath_full',
    name: 'Full Bathroom Gut',
    category: 'bath',
    blurb: 'Down to the studs. Necessary when the subfloor is gone.',
    baseCost: 16000,
    costPerSqft: 0,
    days: 14,
    valueLift: 0.068,
    conditionLift: 0.1,
  },
  {
    id: 'roof_replace',
    name: 'Roof Replacement',
    category: 'systems',
    blurb: 'Buyers will not close without it, but it adds little to the appraisal.',
    baseCost: 6500,
    costPerSqft: 4.2,
    days: 6,
    valueLift: 0.028,
    conditionLift: 0.15,
  },
  {
    id: 'hvac_replace',
    name: 'HVAC Replacement',
    category: 'systems',
    blurb: 'Another one that buyers treat as table stakes rather than an upgrade.',
    baseCost: 9500,
    costPerSqft: 0,
    days: 4,
    valueLift: 0.024,
    conditionLift: 0.12,
  },
  {
    id: 'electrical_rewire',
    name: 'Electrical Rewire',
    category: 'systems',
    blurb: 'Permits, inspections, open walls. Schedule killer on older homes.',
    baseCost: 6000,
    costPerSqft: 5.5,
    days: 12,
    valueLift: 0.02,
    conditionLift: 0.18,
  },
  {
    id: 'plumbing_repipe',
    name: 'Plumbing Repipe',
    category: 'systems',
    blurb: 'Rip out the galvanised. Invisible to buyers, fatal if skipped.',
    baseCost: 5000,
    costPerSqft: 4.4,
    days: 10,
    valueLift: 0.018,
    conditionLift: 0.15,
  },
  {
    id: 'windows_replace',
    name: 'Window Replacement',
    category: 'exterior',
    blurb: 'Energy story plus curb appeal. Expensive on a big house.',
    baseCost: 2500,
    costPerSqft: 9.5,
    days: 8,
    valueLift: 0.042,
    conditionLift: 0.1,
  },
  {
    id: 'siding_exterior',
    name: 'Siding & Exterior',
    category: 'exterior',
    blurb: 'Drives the photo that gets the showing booked.',
    baseCost: 3000,
    costPerSqft: 8.5,
    days: 10,
    valueLift: 0.05,
    conditionLift: 0.1,
  },
  {
    id: 'landscaping_curb',
    name: 'Landscaping & Curb Appeal',
    category: 'exterior',
    blurb: 'Cheap, fast, and disproportionately effective on days-on-market.',
    baseCost: 4500,
    costPerSqft: 0,
    days: 5,
    valueLift: 0.03,
    conditionLift: 0.04,
  },
  {
    id: 'foundation_repair',
    name: 'Foundation Repair',
    category: 'structural',
    blurb: 'Pure defence. Adds almost nothing to value, but nothing sells without it.',
    baseCost: 22000,
    costPerSqft: 0,
    days: 15,
    valueLift: 0.012,
    conditionLift: 0.2,
  },
  {
    id: 'open_floorplan',
    name: 'Open the Floor Plan',
    category: 'structural',
    blurb: 'Remove the wall between kitchen and living. Check if it is load bearing first.',
    baseCost: 18000,
    costPerSqft: 0,
    days: 14,
    valueLift: 0.07,
    conditionLift: 0.06,
  },
  {
    id: 'add_bathroom',
    name: 'Add a Bathroom',
    category: 'addition',
    blurb: 'Moves the house into a new comp bracket. Permits and plumbing make it slow.',
    baseCost: 28000,
    costPerSqft: 0,
    days: 25,
    valueLift: 0.09,
    conditionLift: 0.05,
  },
  {
    id: 'staging',
    name: 'Professional Staging',
    category: 'staging',
    blurb: 'Does not change the appraisal, but it shortens days on market noticeably.',
    baseCost: 3500,
    costPerSqft: 0,
    days: 3,
    valueLift: 0.018,
    conditionLift: 0,
  },
];

export const SCOPE_BY_ID: Record<string, ScopeItemDef> = Object.fromEntries(
  SCOPE_ITEMS.map((i) => [i.id, i]),
);

// ---------------------------------------------------------------------------
// Defects
//
// `mustFix` defects are the ones a buyer's inspector will always find. Leaving
// one unrepaired does not hide it -- it comes back as a price concession at
// closing, usually at more than it would have cost to just fix.
// ---------------------------------------------------------------------------

export const DEFECTS: DefectDef[] = [
  {
    id: 'foundation_settling',
    name: 'Foundation Settling',
    severity: 'major',
    blurb: 'Stair-step cracking in the block and a floor that is out of level.',
    repairCost: 22000,
    repairDays: 15,
    mustFix: true,
    weight: 0.6,
  },
  {
    id: 'knob_and_tube',
    name: 'Knob & Tube Wiring',
    severity: 'major',
    blurb: 'Uninsurable as-is. Every lender will require it gone.',
    repairCost: 15000,
    repairDays: 12,
    mustFix: true,
    weight: 0.9,
  },
  {
    id: 'roof_failure',
    name: 'Roof at End of Life',
    severity: 'major',
    blurb: 'Active leak in the back bedroom and cupping shingles throughout.',
    repairCost: 14000,
    repairDays: 6,
    mustFix: true,
    weight: 1.4,
  },
  {
    id: 'sewer_lateral',
    name: 'Collapsed Sewer Lateral',
    severity: 'major',
    blurb: 'The camera scope stops eighteen feet out. Excavation required.',
    repairCost: 13000,
    repairDays: 7,
    mustFix: true,
    weight: 0.7,
  },
  {
    id: 'galvanized_supply',
    name: 'Galvanised Supply Lines',
    severity: 'moderate',
    blurb: 'Rust-coloured water and pressure that dies when two taps are open.',
    repairCost: 12000,
    repairDays: 10,
    mustFix: true,
    weight: 1.1,
  },
  {
    id: 'mold_remediation',
    name: 'Mould in the Crawlspace',
    severity: 'moderate',
    blurb: 'Needs licensed remediation and a clearance test before drywall.',
    repairCost: 6500,
    repairDays: 6,
    mustFix: true,
    weight: 1.0,
  },
  {
    id: 'termite_damage',
    name: 'Termite Damage',
    severity: 'moderate',
    blurb: 'Sill plate is compromised along the south wall.',
    repairCost: 9000,
    repairDays: 8,
    mustFix: true,
    weight: 0.9,
  },
  {
    id: 'asbestos_tile',
    name: 'Asbestos Floor Tile',
    severity: 'moderate',
    blurb: 'Fine if undisturbed, but it is under the floor you were going to demo.',
    repairCost: 7000,
    repairDays: 5,
    mustFix: true,
    weight: 0.8,
  },
  {
    id: 'hvac_dead',
    name: 'Failed Furnace',
    severity: 'moderate',
    blurb: 'Cracked heat exchanger. Red-tagged by the gas utility.',
    repairCost: 9500,
    repairDays: 4,
    mustFix: true,
    weight: 1.2,
  },
  {
    id: 'window_rot',
    name: 'Rotted Window Frames',
    severity: 'minor',
    blurb: 'Sashes on the weather side are soft. Cosmetic until it is not.',
    repairCost: 4200,
    repairDays: 4,
    mustFix: false,
    weight: 1.5,
  },
  {
    id: 'deck_unsafe',
    name: 'Unsafe Deck',
    severity: 'minor',
    blurb: 'Ledger board is nailed, not bolted. An inspector will call it out.',
    repairCost: 5500,
    repairDays: 4,
    mustFix: false,
    weight: 1.2,
  },
  {
    id: 'water_heater',
    name: 'Water Heater Past Life',
    severity: 'minor',
    blurb: 'Nineteen years old and weeping at the base.',
    repairCost: 1800,
    repairDays: 1,
    mustFix: false,
    weight: 1.8,
  },
];

export const DEFECTS_BY_ID: Record<string, DefectDef> = Object.fromEntries(
  DEFECTS.map((d) => [d.id, d]),
);

// ---------------------------------------------------------------------------
// Market events
// ---------------------------------------------------------------------------

export const EVENTS: MarketEventDef[] = [
  {
    id: 'rate_cut',
    name: 'Central Bank Cuts Rates',
    blurb: 'Cheaper mortgages pull buyers off the sidelines. Expect faster sales.',
    minDays: 45,
    maxDays: 90,
    weight: 1.0,
    effects: { rateDelta: -0.0125, demandMultiplier: 1.25, valueDrift: 1.0004 },
  },
  {
    id: 'rate_hike',
    name: 'Rates Spike',
    blurb: 'Borrowing costs jump. Buyers vanish and your carry gets expensive.',
    minDays: 60,
    maxDays: 120,
    weight: 1.0,
    effects: { rateDelta: 0.015, demandMultiplier: 0.7, valueDrift: 0.9995 },
  },
  {
    id: 'housing_boom',
    name: 'Housing Boom',
    blurb: 'Multiple offers on everything. Do not confuse a rising tide with skill.',
    minDays: 60,
    maxDays: 120,
    weight: 0.8,
    effects: { valueDrift: 1.0011, demandMultiplier: 1.4 },
  },
  {
    id: 'correction',
    name: 'Market Correction',
    blurb: 'Prices roll over. Anything you are holding just got more expensive to hold.',
    minDays: 60,
    maxDays: 150,
    weight: 0.7,
    effects: { valueDrift: 0.9988, demandMultiplier: 0.65 },
  },
  {
    id: 'lumber_spike',
    name: 'Material Price Spike',
    blurb: 'Lumber and drywall are up sharply. Every open job just got pricier.',
    minDays: 30,
    maxDays: 75,
    weight: 1.1,
    effects: { costMultiplier: 1.28 },
  },
  {
    id: 'labor_shortage',
    name: 'Skilled Labour Shortage',
    blurb: 'Every decent sub is booked out. Schedules slip.',
    minDays: 40,
    maxDays: 90,
    weight: 1.1,
    effects: { costMultiplier: 1.12, timeMultiplier: 1.4 },
  },
  {
    id: 'permit_backlog',
    name: 'Permit Office Backlog',
    blurb: 'The city is six weeks behind on plan review. Nothing moves.',
    minDays: 30,
    maxDays: 60,
    weight: 0.9,
    effects: { timeMultiplier: 1.35 },
  },
  {
    id: 'revitalization',
    name: 'Neighborhood Revitalisation',
    blurb: 'A public investment package lands. Local values start climbing.',
    minDays: 90,
    maxDays: 180,
    weight: 0.7,
    effects: { valueDrift: 1.0022, demandMultiplier: 1.2, neighborhoodId: 'millworks' },
  },
  {
    id: 'employer_exit',
    name: 'Major Employer Leaves',
    blurb: 'The plant is closing. Local demand craters and inventory piles up.',
    minDays: 90,
    maxDays: 180,
    weight: 0.5,
    effects: { valueDrift: 0.9975, demandMultiplier: 0.5, neighborhoodId: 'riverside_flats' },
  },
  {
    id: 'school_rezoning',
    name: 'Favourable School Rezoning',
    blurb: 'Families follow school districts. Maple Heights just got more desirable.',
    minDays: 120,
    maxDays: 240,
    weight: 0.6,
    effects: { valueDrift: 1.0015, demandMultiplier: 1.25, neighborhoodId: 'maple_heights' },
  },
];

export const EVENTS_BY_ID: Record<string, MarketEventDef> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
);

// ---------------------------------------------------------------------------
// Campaign levels
// ---------------------------------------------------------------------------

export const LEVELS: LevelDef[] = [
  {
    id: 'first_flip',
    name: 'The First Flip',
    blurb:
      'Enough capital for one all-cash flip and a lot to learn. Buy a distressed house, fix what actually matters, and get out clean. Aim for the 70% rule until you have a reason not to.',
    startingCash: 175000,
    goalNetWorth: 285000,
    dayLimit: 450,
    neighborhoods: ['riverside_flats', 'maple_heights'],
    startingMarketIndex: 1.0,
    startingRate: 0.065,
    listingCount: 10,
  },
  {
    id: 'leverage',
    name: 'Working With Leverage',
    blurb:
      'Hard money lets you run two deals at once -- and turns a slow sale into a margin call. Points and interest come out of your profit either way.',
    startingCash: 160000,
    goalNetWorth: 450000,
    dayLimit: 600,
    neighborhoods: ['riverside_flats', 'maple_heights', 'old_town', 'millworks'],
    startingMarketIndex: 1.02,
    startingRate: 0.075,
    listingCount: 10,
  },
  {
    id: 'the_grind',
    name: 'Portfolio Builder',
    blurb:
      'The full board, a longer clock, and a target north of a million. You will sit through at least one correction. Plan your carry accordingly.',
    startingCash: 220000,
    goalNetWorth: 1500000,
    dayLimit: 900,
    neighborhoods: NEIGHBORHOODS.map((n) => n.id),
    startingMarketIndex: 1.0,
    startingRate: 0.07,
    listingCount: 10,
  },
  {
    id: 'sandbox',
    name: 'Sandbox',
    blurb: 'No clock, no target. Experiment with scopes and financing structures freely.',
    startingCash: 450000,
    goalNetWorth: Number.MAX_SAFE_INTEGER,
    dayLimit: null,
    neighborhoods: NEIGHBORHOODS.map((n) => n.id),
    startingMarketIndex: 1.0,
    startingRate: 0.07,
    listingCount: 12,
  },
];

export const LEVELS_BY_ID: Record<string, LevelDef> = Object.fromEntries(
  LEVELS.map((l) => [l.id, l]),
);

export const NEIGHBORHOODS_BY_ID: Record<string, Neighborhood> = Object.fromEntries(
  NEIGHBORHOODS.map((n) => [n.id, n]),
);

export const ARCHETYPES_BY_ID: Record<string, Archetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
);

// ---------------------------------------------------------------------------
// Sellers
//
// Replaces a single scalar "motivation" with people who have reasons. Who you
// are buying from changes the whole negotiation, and it is legible before you
// offer -- an estate sale and a developer are not the same conversation.
// ---------------------------------------------------------------------------

export const SELLER_TYPES: SellerType[] = [
  {
    id: 'estate',
    name: 'Estate sale',
    blurb: 'Heirs settling a property they never wanted. Motivated, and rarely emotional about price.',
    askBias: 0.97,
    reserveBias: 0.94,
    staleness: 1.4,
    concedes: 0.95,
    weight: 1.0,
  },
  {
    id: 'tired_landlord',
    name: 'Tired landlord',
    blurb: 'Done with tenants and repairs. Knows what is wrong with it, and will discount to be finished.',
    askBias: 0.99,
    reserveBias: 0.96,
    staleness: 1.2,
    concedes: 0.9,
    weight: 1.1,
  },
  {
    id: 'relocating',
    name: 'Relocating owner',
    blurb: 'Has a start date in another city. Patient at first, then suddenly not.',
    askBias: 1.02,
    reserveBias: 1.0,
    staleness: 1.6,
    concedes: 0.8,
    weight: 1.0,
  },
  {
    id: 'retail',
    name: 'Retail seller',
    blurb: 'Lives there, loves it, priced it off the neighbour who got lucky. Slow to move.',
    askBias: 1.06,
    reserveBias: 1.04,
    staleness: 0.7,
    concedes: 0.6,
    weight: 1.2,
  },
  {
    id: 'developer',
    name: 'Developer',
    blurb: 'Runs the same numbers you do. Will not hand you a margin, and knows exactly what the defects cost.',
    askBias: 1.03,
    reserveBias: 1.06,
    staleness: 0.5,
    concedes: 0.45,
    weight: 0.8,
  },
];

export const SELLER_TYPES_BY_ID: Record<string, SellerType> = Object.fromEntries(
  SELLER_TYPES.map((s) => [s.id, s]),
);

// ---------------------------------------------------------------------------
// Economic constants
// ---------------------------------------------------------------------------

export const ECON = {
  /** Buyer-side closing costs as a fraction of purchase price. */
  BUY_CLOSING_RATE: 0.02,
  /** Listing agent + buyer agent commission on sale. */
  COMMISSION_RATE: 0.06,
  /** Transfer tax and seller-side closing costs. */
  SELL_CLOSING_RATE: 0.01,
  /** Annual vacant-property insurance as a fraction of value. */
  INSURANCE_RATE: 0.007,
  /** Monthly utilities on a vacant property under renovation. */
  UTILITIES_MONTHLY: 210,
  /** Hard money: max loan as a fraction of purchase price. */
  MAX_LTV: 0.8,
  /** Hard money origination points. */
  LOAN_POINTS: 0.02,
  /** Spread over the prevailing rate charged by hard money lenders. */
  LOAN_SPREAD: 0.045,
  /** Balloon term in days. */
  LOAN_TERM_DAYS: 365,
  /** Inspection pricing and reveal rates. */
  INSPECTION: {
    standard: { cost: 650, revealRate: 0.6 },
    thorough: { cost: 1800, revealRate: 0.9 },
  },
  /** Cost to train one skill level, multiplied by 1.6^level. */
  SKILL_BASE_COST: 8000,
  SKILL_COST_FACTOR: 1.6,
  MAX_SKILL_LEVEL: 5,
  /** Days the player is allowed to run a negative balance before foreclosure. */
  DISTRESS_LIMIT_DAYS: 30,
  /** The industry heuristic the Deal Analyzer teaches. */
  RULE_OF_THUMB: 0.7,

  /** Holding for rent rather than selling. */
  RENTAL: {
    /** Fraction of collected rent paid to a manager. */
    management: 0.08,
    /** Maintenance and capital reserve, as a fraction of rent. */
    maintenance: 0.08,
    /** Long-run vacancy allowance a lender will underwrite to. */
    vacancyRate: 0.06,
    /** Lease length in days. */
    leaseDays: 365,
    /** Chance a tenant renews rather than leaving at lease end. */
    renewalChance: 0.62,
    /** Cost of turning a unit over between tenants. */
    turnoverCost: 1400,
    /**
     * Condition below which the place cannot lawfully be let at all. Sits at
     * the bottom of "Dated": rough and distressed houses have to be brought up
     * first, which is what stops renting a wreck as-is from beating flipping.
     */
    minCondition: 0.45,
  },

  /** Cash-out refinance into long-term debt. */
  REFI: {
    /** Lender will not exceed this share of appraised value. */
    maxLtv: 0.75,
    /** Nor will it go below this debt service coverage ratio. */
    minDscr: 1.2,
    /** Spread over the prevailing rate for a term loan -- far below hard money. */
    spread: 0.015,
    /** Amortisation period. */
    termYears: 30,
    /** Closing costs as a fraction of the new loan. */
    closingRate: 0.02,
    /** Seasoning: how long you must own it before a lender will refinance. */
    seasoningDays: 90,
  },

  /**
   * Multi-year neighborhood arcs.
   *
   * Rare per day but long-lived, so a campaign of any length sees one or two
   * and a short one may see none. Weighted toward gentrification because
   * decline is the more punishing of the two to be caught inside.
   */
  ARC: {
    dailyChance: 0.0022,
    gentrifyingShare: 0.6,
  },

  /**
   * Experience: the third currency, earned only by doing the work.
   *
   * Superlinear so that levels keep meaning something, and capped so it cannot
   * eventually hand out every skill for free -- money still has to buy most of
   * them.
   */
  XP: {
    base: 260,
    curve: 1.45,
    maxLevel: 12,
  },

  /**
   * A crew on the payroll instead of subs per job.
   *
   * Priced so that a crew pays for itself at roughly two-thirds utilisation
   * and bleeds money below half. That is the whole decision.
   */
  CREW: {
    /** Signing cost per head. */
    hiringCost: 3200,
    /** Wages per head per week, payable whether or not there is work. */
    weeklyPerHead: 2100,
    /** Your own people cost less per job than calling subs. */
    costFactor: 0.86,
    /** And work faster, up to capacity. */
    timeFactor: 0.78,
    /** And find trouble earlier, so fewer surprises land as change orders. */
    changeOrderFactor: 0.78,
    maxSize: 4,
  },

  /**
   * The financing menu beyond hard money.
   *
   * Each instrument is priced so that none dominates. Private money is cheaper
   * but lends less and has to be earned. Seller paper is cheapest of all and
   * the seller charges for it in the price. An equity partner has no rate at
   * all and takes a third of the upside forever.
   */
  FINANCING: {
    private: {
      /** Less than hard money: private lenders are conservative. */
      maxLtv: 0.65,
      /** Half the points. */
      points: 0.01,
      /** Spread over prevailing -- between hard money and a term loan. */
      spread: 0.028,
      termDays: 540,
      /** Nobody lends privately to a stranger. */
      minReputation: 62,
    },
    seller: {
      downPayment: 0.25,
      spread: 0.01,
      termDays: 730,
      /**
       * What the seller charges for carrying it. The classic trade: you can
       * have your price or my terms, not both.
       */
      priceUplift: 0.06,
      /** Only sellers who own it outright and want out will carry paper. */
      willingSellers: ['estate', 'tired_landlord', 'relocating'],
    },
    partner: {
      /** Share of the total cash requirement they put up. */
      contribution: 0.5,
      /** Share of the profit they take, after their capital comes back. */
      profitShare: 0.35,
    },
  },

  /**
   * Trustee sales.
   *
   * Calibrated so the auction is a genuinely different trade rather than a
   * discount button: the average lot goes for less than the average listing,
   * but you buy it blind, you pay cash, and roughly a third of them come with
   * somebody still living in the house.
   */
  AUCTION: {
    /** Credit bid as a share of value: what the lender is owed. */
    minOpeningRatio: 0.34,
    maxOpeningRatio: 0.88,
    /** Notice period before the sale. */
    minNoticeDays: 12,
    maxNoticeDays: 34,
    /** Where a completely uncontested room stops, as a share of value. */
    baseCeiling: 0.52,
    /** How much further a fully contested room will go. */
    interestCeilingRange: 0.34,
    /** Chance nobody else turns up at all, scaled by how quiet the lot is. */
    noShowChance: 0.22,
    /** Bid increment at the podium. */
    increment: 1000,
    /**
     * Closing costs at a trustee sale: title search, recording, transfer tax.
     * Lower than a retail purchase because there is no agent on either side --
     * which is part of why the discount survives to the buyer.
     */
    closingRate: 0.012,
    /** Chance the property still has somebody living in it. */
    occupiedChance: 0.34,
    /** Getting a holdover occupant out: a fixed cost plus a share of value. */
    evictionBase: 2800,
    evictionRate: 0.012,
    /** Days lost to the eviction before work can start. */
    evictionDays: 45,
    /** How many lots are on the board at once. */
    lotCount: 4,
    /** Days between fresh lots being posted. */
    refreshDays: 9,
    /**
     * Buying blind means buying the defects. Auction stock is drawn from the
     * distressed end and skips the retail market's disclosure entirely.
     */
    distressedChance: 0.72,
  },
} as const;
