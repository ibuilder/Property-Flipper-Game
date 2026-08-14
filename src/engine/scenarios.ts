import {
  ARCHETYPES_BY_ID,
  DEFECTS_BY_ID,
  NEIGHBORHOODS,
  NEIGHBORHOODS_BY_ID,
  SELLER_TYPES_BY_ID,
} from './content';
import { Rng } from './rng';
import { TUTORIAL } from './tutorial';
import type {
  ClosedDeal,
  Defect,
  GameState,
  Money,
  Property,
  ScenarioProperty,
  SellerTypeId,
} from './types';

/**
 * Authored deals.
 *
 * One mechanism serving two features: the built-in scenarios below are the
 * curriculum, and the same shape is what the editor produces and the share
 * code carries. A scenario pins down the single thing being taught -- a
 * specific house, a specific seller, a specific market -- so the lesson is not
 * at the mercy of a random draw.
 */

// Defined in types.ts, because replaying a closed deal needs the same shape
// and one definition is what keeps a replay faithful to what it replays.
export type { ScenarioProperty } from './types';

export interface ScenarioDef {
  id: string;
  name: string;
  /** Shown before play: what you are being asked to do. */
  brief: string;
  /** Shown after: what it was teaching. */
  lesson: string;
  startingCash: Money;
  dayLimit: number;
  marketIndex: number;
  interestRate: number;
  /** Profit on the deal required to pass. */
  targetProfit: Money;
  property: ScenarioProperty;
  /** Extra random listings, so the authored one is not the only choice. */
  distractors: number;
  /** True for the shipped curriculum, false for user-authored. */
  builtIn?: boolean;
}

// ---------------------------------------------------------------------------
// The curriculum
//
// Each lesson isolates one way a flip goes wrong. They are deliberately small:
// a single deal, a short clock, and a pass mark you cannot hit by accident.
// ---------------------------------------------------------------------------

export const SCENARIOS: ScenarioDef[] = [
  // The first fifteen minutes. Defined in tutorial.ts because the gate and the
  // tour live with it, and listed first because it is the front door.
  TUTORIAL,
  {
    id: 'lesson_seventy',
    name: '1. The 70% Rule',
    brief:
      'One house, priced where a retail seller thinks it is worth. Run the Deal Analyzer before you offer. Paying the asking price on this deal loses money; the rule tells you what it is actually worth to you.',
    lesson:
      'The 30% the rule takes off the top is not profit. It is closing costs, carry, and a 6% commission, with profit as whatever survives. On a normal deal those consume most of it — which is why the ceiling feels so far below the ask.',
    startingCash: 200000,
    dayLimit: 240,
    marketIndex: 1.0,
    interestRate: 0.065,
    targetProfit: 18000,
    distractors: 3,
    builtIn: true,
    property: {
      archetypeId: 'ranch',
      neighborhoodId: 'maple_heights',
      sqft: 1450,
      yearBuilt: 1972,
      condition: 0.34,
      defectIds: [],
      disclosedIds: [],
      sellerType: 'retail',
      askPrice: 168000,
    },
  },
  {
    id: 'lesson_inspection',
    name: '2. The Inspection Pays',
    brief:
      'This house has problems nobody has written down yet. You can buy it blind and find out with a crew standing in the room, or spend a little to find out while walking away is still free.',
    lesson:
      'An inspection is not really about knowing — it is about leverage. Findings on paper force the seller to concede, so the fee buys you a discount as well as information. Skip it and the same defects arrive as change orders at full price, or as a buyer concession at 1.15× what the repair would have cost.',
    startingCash: 220000,
    dayLimit: 260,
    marketIndex: 1.0,
    interestRate: 0.065,
    targetProfit: 15000,
    distractors: 3,
    builtIn: true,
    property: {
      archetypeId: 'bungalow',
      neighborhoodId: 'old_town',
      sqft: 1180,
      yearBuilt: 1926,
      condition: 0.3,
      defectIds: ['knob_and_tube', 'roof_failure', 'galvanized_supply'],
      disclosedIds: [],
      sellerType: 'estate',
      askPrice: 148000,
    },
  },
  {
    id: 'lesson_comps',
    name: '3. Comps Lie',
    brief:
      'A small house with some very tempting comparables nearby — bigger homes, better streets, higher prices. Build your estimate carefully. The pass mark assumes you did not take the flattering ones.',
    lesson:
      'Price per square foot rises as houses get smaller, and it rises again on a better street. A comp that is 30% bigger or one neighborhood over is not your house. Because ARV sits at the top of every other calculation, a 10% error there quietly eats a 15% margin.',
    startingCash: 190000,
    dayLimit: 240,
    marketIndex: 1.0,
    interestRate: 0.065,
    targetProfit: 12000,
    distractors: 4,
    builtIn: true,
    property: {
      archetypeId: 'condo',
      neighborhoodId: 'the_grid',
      sqft: 760,
      yearBuilt: 1998,
      condition: 0.38,
      defectIds: ['water_heater'],
      disclosedIds: ['water_heater'],
      sellerType: 'tired_landlord',
      askPrice: 172000,
    },
  },
  {
    id: 'lesson_carry',
    name: '4. Carry Kills',
    brief:
      'An expensive house in a thin market. The margin looks generous. The question is whether it survives the months it takes to sell — price it to move, or watch the carry eat it.',
    lesson:
      'Buyer traffic falls off a cliff above true value, so overpricing does not cost you a little time, it costs you months. On a property like this, taxes, insurance and utilities alone run into hundreds a day before any loan interest.',
    startingCash: 520000,
    dayLimit: 300,
    marketIndex: 1.0,
    interestRate: 0.07,
    targetProfit: 30000,
    distractors: 3,
    builtIn: true,
    property: {
      archetypeId: 'colonial',
      neighborhoodId: 'harbor_point',
      sqft: 2450,
      yearBuilt: 1988,
      condition: 0.4,
      defectIds: ['deck_unsafe'],
      disclosedIds: ['deck_unsafe'],
      sellerType: 'relocating',
      askPrice: 690000,
    },
  },
  {
    id: 'lesson_leverage',
    name: '5. Leverage Cuts Both Ways',
    brief:
      'Not enough cash to close and fund the work. Hard money solves that — for a price, and on a clock. Points come out of the wire whether or not the house sells.',
    lesson:
      'Leverage does not create margin, it rents it. Points are charged up front, interest runs every day the house is unsold, and the balloon does not care how the market is doing. Used on a short schedule it multiplies returns; used on a slow one it takes the house.',
    startingCash: 95000,
    dayLimit: 300,
    marketIndex: 0.99,
    interestRate: 0.085,
    targetProfit: 14000,
    distractors: 3,
    builtIn: true,
    property: {
      archetypeId: 'duplex',
      neighborhoodId: 'millworks',
      sqft: 1820,
      yearBuilt: 1958,
      condition: 0.26,
      defectIds: ['hvac_dead', 'mold_remediation'],
      disclosedIds: ['hvac_dead'],
      sellerType: 'tired_landlord',
      askPrice: 118000,
    },
  },
];

export const SCENARIOS_BY_ID: Record<string, ScenarioDef> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
);

// ---------------------------------------------------------------------------
// Replaying a deal you have already closed
// ---------------------------------------------------------------------------

/**
 * Turn a finished deal back into a problem.
 *
 * The learning research this comes from is specific: attempting a problem
 * before being taught beats being taught first, but only when the instruction
 * actually follows. The post-mortem already supplies the instruction -- what
 * varied, and how professionals avoid it. What was missing was the third beat,
 * where you get to use it.
 *
 * So the same house, the same seller, the same market, the same money. What
 * changes is only what you know, which is the entire point: it isolates
 * judgement from luck, and it is the only way to find out whether the lesson
 * actually landed or merely sounded reasonable.
 *
 * The pass mark is your own result. Beating an abstract target teaches you
 * about the target; beating yourself teaches you about the decision.
 */
export function replayScenario(deal: ClosedDeal): ScenarioDef | null {
  const cap = deal.replay;
  if (!cap) return null;

  const beat = Math.max(1000, Math.round(deal.netProfit));
  const lost = deal.netProfit <= 0;

  return {
    id: `replay_${deal.propertyId}_${deal.soldDay}`,
    name: `Replay: ${deal.address}`,
    brief: lost
      ? `The same house, the same seller, the same market, and the same money in your pocket. ` +
        `Last time it lost ${formatMoney(Math.abs(deal.netProfit))} over ${deal.daysHeld} days. ` +
        `Anything above breaking even beats it.`
      : `The same house, the same seller, the same market, and the same money in your pocket. ` +
        `Last time you made ${formatMoney(deal.netProfit)} over ${deal.daysHeld} days. Beat it.`,
    lesson:
      'Knowing what went wrong and acting on it are different skills. The first is the ' +
      'post-mortem; this was the second. If the second run went better, the difference was ' +
      'judgement rather than luck -- and judgement is the part that carries to the next deal.',
    startingCash: cap.cashAtPurchase,
    // Generous enough that the clock is not the lesson. The lesson is the deal.
    dayLimit: Math.max(240, Math.round(deal.daysHeld * 1.6)),
    marketIndex: cap.marketIndex,
    interestRate: cap.interestRate,
    targetProfit: lost ? 1 : beat + 1,
    property: cap.property,
    // No distractors: you are not being asked to find the deal again, you are
    // being asked to underwrite this one properly.
    distractors: 0,
    builtIn: false,
  };
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Building the authored property
// ---------------------------------------------------------------------------

/** Turn a scenario's property description into a real Property. */
export function buildScenarioProperty(
  spec: ScenarioProperty,
  id: string,
  address: string,
  rng: Rng,
): Property {
  const arch = ARCHETYPES_BY_ID[spec.archetypeId] ?? ARCHETYPES_BY_ID['ranch'];

  const defects: Defect[] = spec.defectIds
    .filter((d) => DEFECTS_BY_ID[d])
    .map((d) => ({
      defId: d,
      revealed: spec.disclosedIds.includes(d),
      repaired: false,
    }));

  return {
    id,
    address,
    archetypeId: arch.id,
    neighborhoodId: spec.neighborhoodId,
    sqft: spec.sqft,
    beds: arch.beds,
    baths: arch.baths,
    yearBuilt: spec.yearBuilt,
    condition: Math.max(0.05, Math.min(0.97, spec.condition)),
    defects,
    completedWork: [],
    appraisal: { point: 0, low: 0, high: 0, confidence: 'comps', comps: [], fitScore: 1 },
    compPool: [],
    selectedComps: [],
    sellerType: spec.sellerType,
    listing: {
      askPrice: spec.askPrice,
      daysOnMarket: 0,
      // The reserve follows the seller archetype rather than being authored,
      // so an instructor sets the ask and the negotiation still behaves.
      reserve: Math.round(
        spec.askPrice * (SELLER_TYPES_BY_ID[spec.sellerType]?.reserveBias ?? 1) * 0.94,
      ),
      sellerMotivation: rng.float(0.35, 0.75),
      // Authored deals get modest rival interest: enough that dawdling costs
      // you, not so much that the lesson turns into a race.
      competition: 0.35,
    },
    ownership: null,
    inspection: 'none',
    noiseSeed: rng.int(1, 2 ** 30),
  };
}

// ---------------------------------------------------------------------------
// Share codes
// ---------------------------------------------------------------------------

/**
 * Encode a scenario as a URL-safe string.
 *
 * Deliberately plain base64 of minified JSON rather than anything clever: an
 * instructor sharing a deal should be able to inspect and hand-edit what they
 * are sending, and the format needs to survive being pasted into a chat window.
 */
export function encodeScenario(def: ScenarioDef): string {
  const compact = {
    n: def.name,
    b: def.brief,
    l: def.lesson,
    c: def.startingCash,
    d: def.dayLimit,
    m: def.marketIndex,
    i: def.interestRate,
    t: def.targetProfit,
    x: def.distractors,
    p: [
      def.property.archetypeId,
      def.property.neighborhoodId,
      def.property.sqft,
      def.property.yearBuilt,
      Math.round(def.property.condition * 100),
      def.property.defectIds.join('|'),
      def.property.disclosedIds.join('|'),
      def.property.sellerType,
      def.property.askPrice,
    ],
  };
  return toBase64Url(JSON.stringify(compact));
}

/**
 * UTF-8 aware base64.
 *
 * `btoa` only accepts Latin-1, so it throws on the em-dashes and multiplication
 * signs that appear throughout the scenario copy. Encoding to UTF-8 bytes first
 * is what makes the share code survive real prose.
 */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.trim().replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf8');
}

export class ScenarioError extends Error {}

export function decodeScenario(code: string): ScenarioDef {
  let json: string;
  try {
    json = fromBase64Url(code);
  } catch {
    throw new ScenarioError('That does not look like a scenario code.');
  }

  let raw: any;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ScenarioError('That scenario code is damaged.');
  }

  const p = raw?.p;
  if (!Array.isArray(p) || p.length < 9) {
    throw new ScenarioError('That scenario code is missing its property.');
  }
  if (!NEIGHBORHOODS_BY_ID[p[1]]) {
    throw new ScenarioError(`Unknown neighborhood "${p[1]}".`);
  }
  if (!ARCHETYPES_BY_ID[p[0]]) {
    throw new ScenarioError(`Unknown property type "${p[0]}".`);
  }

  const split = (s: unknown) =>
    String(s ?? '')
      .split('|')
      .filter((x) => x && DEFECTS_BY_ID[x]);

  return {
    id: 'shared',
    name: String(raw.n ?? 'Shared deal').slice(0, 80),
    brief: String(raw.b ?? '').slice(0, 600),
    lesson: String(raw.l ?? '').slice(0, 600),
    startingCash: clampNum(raw.c, 10000, 5_000_000, 200000),
    dayLimit: clampNum(raw.d, 30, 900, 240),
    marketIndex: clampNum(raw.m, 0.6, 1.8, 1),
    interestRate: clampNum(raw.i, 0.01, 0.2, 0.065),
    targetProfit: clampNum(raw.t, 0, 2_000_000, 15000),
    distractors: clampNum(raw.x, 0, 10, 3),
    property: {
      archetypeId: p[0],
      neighborhoodId: p[1],
      sqft: clampNum(p[2], 300, 6000, 1400),
      yearBuilt: clampNum(p[3], 1850, 2025, 1970),
      condition: clampNum(p[4], 5, 97, 40) / 100,
      defectIds: split(p[5]),
      disclosedIds: split(p[6]),
      sellerType: (SELLER_TYPES_BY_ID[p[7]] ? p[7] : 'retail') as SellerTypeId,
      askPrice: clampNum(p[8], 5000, 5_000_000, 150000),
    },
  };
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** A blank scenario for the editor to start from. */
export function blankScenario(): ScenarioDef {
  return {
    id: 'custom',
    name: 'Untitled deal',
    brief: 'Describe what the player is walking into.',
    lesson: 'What should they take away once it is done?',
    startingCash: 200000,
    dayLimit: 240,
    marketIndex: 1,
    interestRate: 0.065,
    targetProfit: 15000,
    distractors: 3,
    property: {
      archetypeId: 'ranch',
      neighborhoodId: NEIGHBORHOODS[1].id,
      sqft: 1400,
      yearBuilt: 1975,
      condition: 0.35,
      defectIds: [],
      disclosedIds: [],
      sellerType: 'retail',
      askPrice: 160000,
    },
  };
}

/** Did the player clear the scenario's pass mark? */
export function scenarioPassed(state: GameState, def: ScenarioDef): boolean {
  return state.closedDeals.some((d) => d.netProfit >= def.targetProfit);
}
