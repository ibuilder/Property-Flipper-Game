import {
  ARCHETYPES_BY_ID,
  DEFECTS,
  DEFECTS_BY_ID,
  NEIGHBORHOODS_BY_ID,
  SELLER_TYPES,
  SELLER_TYPES_BY_ID,
} from './content';
import { eventModifiers } from './events';
import { Rng } from './rng';
import type {
  BuyerOffer,
  Defect,
  Listing,
  Money,
  Property,
  PropertyId,
  SellerTypeId,
  SkillId,
  WorldState,
} from './types';
import {
  appraisalFromComps,
  defaultCompSelection,
  defectRepairCost,
  generateAddress,
  generateCompPool,
  trueValue,
} from './valuation';

/**
 * Property generation, the buy-side negotiation, and the sell-side buyer pool.
 *
 * The central design change from the original game lives here: a listing has
 * an *ask price* that is not its value, and a hidden *reserve* that decays as
 * the listing goes stale. That gap is where a flipper's margin actually comes
 * from. Buying at fair value, which is all the original allowed, is a
 * guaranteed loss once commission and carry are counted.
 */

let idCounter = 0;
export function nextPropertyId(): PropertyId {
  idCounter += 1;
  return `p${idCounter.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

/** Reset the id counter. Only used by tests to keep ids deterministic. */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function rollDefects(rng: Rng, condition: number, yearBuilt: number): Defect[] {
  const ageFactor = Math.max(0, Math.min(1.5, (1980 - yearBuilt) / 40));
  const expected = 0.4 + (1 - condition) * 3.6 + ageFactor;
  const count = Math.max(0, Math.min(6, Math.round(rng.clampedNormal(expected, 1.1))));
  if (count === 0) return [];

  // Weighted sample without replacement.
  const pool = [...DEFECTS];
  const chosen: Defect[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, d) => s + d.weight, 0);
    let roll = rng.float(0, totalWeight);
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) {
        idx = j;
        break;
      }
    }
    const [def] = pool.splice(idx, 1);
    chosen.push({ defId: def.id, revealed: false, repaired: false });
  }
  return chosen;
}

export function generateProperty(
  rng: Rng,
  world: WorldState,
  day: number,
  neighborhoodIds: readonly string[],
  analysisSkill: number,
): Property {
  const hoodId = rng.pick(neighborhoodIds);
  const arch = rng.pick(Object.values(ARCHETYPES_BY_ID));

  const sqft = rng.int(arch.sqftRange[0], arch.sqftRange[1]);
  const yearBuilt = rng.int(arch.yearRange[0], arch.yearRange[1]);

  // A quarter of the market is genuinely distressed. Those are the deals --
  // and also where the hidden defects cluster.
  const distressed = rng.chance(0.34);
  const condition = distressed
    ? Math.max(0.08, Math.min(0.45, rng.clampedNormal(0.28, 0.1)))
    : Math.max(0.4, Math.min(0.95, rng.clampedNormal(0.66, 0.13)));

  const prop: Property = {
    id: nextPropertyId(),
    address: generateAddress(rng),
    archetypeId: arch.id,
    neighborhoodId: hoodId,
    sqft,
    beds: arch.beds + (rng.chance(0.2) ? rng.pick([-1, 1]) : 0),
    baths: arch.baths,
    yearBuilt,
    condition,
    defects: rollDefects(rng, condition, yearBuilt),
    completedWork: [],
    appraisal: {
      point: 0,
      low: 0,
      high: 0,
      confidence: 'comps',
      comps: [],
      fitScore: 1,
    },
    compPool: [],
    selectedComps: [],
    sellerType: pickSellerType(rng),
    listing: null,
    ownership: null,
    inspection: 'none',
    noiseSeed: rng.int(1, 2 ** 30),
  };

  prop.beds = Math.max(1, prop.beds);

  // Cap the total defect burden. Beyond roughly 40% of as-is value a property
  // stops being a flip and becomes a teardown, which is not a decision this
  // game models -- and it produced buyer concessions larger than the sale price.
  const asIs = trueValue(prop, world, day);
  const budget = asIs * 0.4;
  let burden = prop.defects.reduce((s, d) => s + defectRepairCost(d.defId, prop), 0);
  while (burden > budget && prop.defects.length > 0) {
    // Drop the most expensive defect first.
    let worstIdx = 0;
    let worstCost = -1;
    prop.defects.forEach((d, i) => {
      const c = defectRepairCost(d.defId, prop);
      if (c > worstCost) {
        worstCost = c;
        worstIdx = i;
      }
    });
    prop.defects.splice(worstIdx, 1);
    burden -= worstCost;
  }

  prop.compPool = generateCompPool(prop, world, day, rng);
  prop.selectedComps = defaultCompSelection(prop, prop.compPool);
  prop.appraisal = appraisalFromComps(
    prop,
    prop.compPool,
    prop.selectedComps,
    'comps',
    analysisSkill,
  );
  prop.listing = makeListing(prop, world, day, rng);
  return prop;
}

function pickSellerType(rng: Rng): SellerTypeId {
  const total = SELLER_TYPES.reduce((s, t) => s + t.weight, 0);
  let roll = rng.float(0, total);
  for (const t of SELLER_TYPES) {
    roll -= t.weight;
    if (roll <= 0) return t.id;
  }
  return SELLER_TYPES[0].id;
}

function makeListing(prop: Property, world: WorldState, day: number, rng: Rng): Listing {
  const value = trueValue(prop, world, day);
  const seller = SELLER_TYPES_BY_ID[prop.sellerType];
  const motivation = rng.float(0, 1);

  // Sellers generally ask above value, but a motivated seller with a problem
  // house will list under it to move quickly. Who they are shifts both ends.
  const askPremium =
    (rng.clampedNormal(0.05, 0.08, 2) - motivation * 0.06) * (seller?.askBias ?? 1) +
    ((seller?.askBias ?? 1) - 1);
  const askPrice = Math.max(1000, Math.round(value * (1 + askPremium)));

  // The reserve is what they will actually take today. It can never exceed the
  // asking price: a seller who would turn down a full-price offer has not
  // priced their house, they have made a wish. The two draws are independent,
  // so without this clamp roughly one listing in six was unbuyable at any
  // price the player could rationally offer.
  const reserveRatio =
    (0.93 + rng.float(0, 0.06) - motivation * 0.05) * (seller?.reserveBias ?? 1);
  const reserve = Math.min(askPrice, Math.round(value * reserveRatio));

  // Rival attention tracks how good the deal looks from the outside: an ask
  // well under value draws a crowd, an overpriced one is ignored.
  const askRatio = askPrice / Math.max(1, value);
  const competition = Math.max(0, Math.min(1, 1.35 - askRatio * 1.15 + rng.float(-0.12, 0.12)));

  return {
    askPrice,
    daysOnMarket: rng.int(0, 45),
    reserve,
    sellerMotivation: motivation,
    competition,
  };
}

// ---------------------------------------------------------------------------
// Buy side
// ---------------------------------------------------------------------------

/**
 * Effective reserve today, after staleness, motivation, and disclosed defects.
 *
 * The defect term is what makes an inspection contingency worth paying for.
 * Once a problem is on paper the seller has to concede it or the deal dies --
 * that renegotiation is the entire economic purpose of due diligence. Without
 * this, discovering a bad foundation would only lower what you were willing to
 * pay while the seller held firm, making inspection strictly self-harming.
 */
export function currentReserve(prop: Property): Money {
  const listing = prop.listing;
  if (!listing) return 0;

  const seller = SELLER_TYPES_BY_ID[prop.sellerType];
  const staleness = Math.min(1, listing.daysOnMarket / 150);
  const erosion = staleness * 0.09 * (seller?.staleness ?? 1) + listing.sellerMotivation * 0.05;
  const base = listing.reserve * (1 - erosion);

  // Sellers concede what inspection has already put in writing -- but how much
  // depends on who they are. A developer knows exactly what the repair costs
  // and will not hand over more than a fraction; an estate wants it gone.
  const concedes = seller?.concedes ?? 0.85;
  let disclosed = 0;
  for (const d of prop.defects) {
    if (!d.revealed || d.repaired) continue;
    disclosed += defectRepairCost(d.defId, prop) * concedes;
  }

  // A full-price offer always closes, even after the ask has been cut.
  return Math.max(1000, Math.min(listing.askPrice, Math.round(base - disclosed)));
}

export interface OfferOutcome {
  accepted: boolean;
  /** How far off the offer was, as a fraction, when rejected. */
  shortfall: number;
  counterPrice: Money | null;
  message: string;
}

/**
 * How much more persuasive negotiation skill makes the same number.
 *
 * Shared by acceptance and by rival competition so the two cannot drift. They
 * did drift: competition measured headroom on the raw offer while acceptance
 * used the persuaded one, so a skilled negotiator's accepted offers always
 * looked wafer-thin and drew rival bids priced below the seller's own reserve.
 */
export function persuasionFactor(negotiationSkill: number): number {
  return 1 + 0.018 * negotiationSkill;
}

/**
 * Would a rival buyer beat this offer?
 *
 * Only bites when the offer is barely over the reserve on a listing that other
 * people also want. Offering a clearly strong number still wins outright --
 * competition punishes shaving the margin to nothing, not being decisive.
 */
export function competingBid(
  prop: Property,
  offer: Money,
  negotiationSkill: number,
  rng: Rng,
): Money | null {
  const listing = prop.listing;
  if (!listing) return null;

  const reserve = currentReserve(prop);
  // Judge exposure on the same terms the seller judged acceptance, so
  // negotiation skill protects against being sniped rather than inviting it.
  const effective = offer * persuasionFactor(negotiationSkill);
  const headroom = (effective - reserve) / Math.max(1, reserve);
  if (headroom > 0.06) return null;

  const heat = listing.competition * (1 - Math.min(1, listing.daysOnMarket / 120));
  if (!rng.chance(heat * 0.55)) return null;

  // A rival's bid has to be one the seller would actually take, and it has to
  // beat what the player put on the table.
  const floor = Math.max(offer, reserve);
  return Math.round(floor * rng.float(1.012, 1.055));
}

/**
 * Evaluate a purchase offer. Negotiation skill does not change the price the
 * player types -- it changes how persuasive that number is, which is a closer
 * analogue to the real thing than a flat discount.
 */
export function evaluateOffer(
  prop: Property,
  offer: Money,
  negotiationSkill: number,
): OfferOutcome {
  const reserve = currentReserve(prop);
  const persuasion = persuasionFactor(negotiationSkill);
  const effective = offer * persuasion;

  if (effective >= reserve) {
    return { accepted: true, shortfall: 0, counterPrice: null, message: 'Offer accepted.' };
  }

  const shortfall = (reserve - effective) / reserve;
  // Sellers close to the mark will counter rather than walk.
  const counterPrice = shortfall < 0.12 ? Math.round(reserve / persuasion) : null;

  /**
   * Always say roughly how far short it was.
   *
   * "That offer was not close" is the message a player sees on the large
   * majority of their offers -- measured across thirty campaigns, only about
   * one offer in seven hundred is accepted -- and it carries no information to
   * calibrate against. A player cannot tell a deal they nearly had from one
   * that was never going to happen, so they cannot learn which listings are
   * worth pursuing. A band rather than the exact number, because the reserve
   * is meant to stay hidden: the point is to make the search legible, not to
   * hand over the answer.
   */
  const band =
    shortfall < 0.2 ? 'not far off' : shortfall < 0.35 ? 'well short' : 'nowhere near';

  return {
    accepted: false,
    shortfall,
    counterPrice,
    message: counterPrice
      ? `Rejected, but the seller countered at $${counterPrice.toLocaleString()}.`
      : `Rejected — ${band}. Around ${Math.round(shortfall * 100)}% under what they would take.`,
  };
}

/** Daily drift of an unsold listing: it ages, and eventually the price is cut. */
export function ageListing(listing: Listing, rng: Rng): void {
  listing.daysOnMarket += 1;
  if (listing.daysOnMarket > 0 && listing.daysOnMarket % 30 === 0) {
    if (rng.chance(0.45 + listing.sellerMotivation * 0.3)) {
      listing.askPrice = Math.round(listing.askPrice * rng.float(0.94, 0.985));
    }
  }
}

// ---------------------------------------------------------------------------
// Sell side
// ---------------------------------------------------------------------------

/**
 * What a buyer's inspector will demand off the price for defects the player
 * left unrepaired.
 *
 * Buyers always ask for more than the repair would have cost -- they are
 * pricing in the hassle and their own uncertainty. This is the mechanism that
 * makes skipping the roof a bad idea rather than a clever saving.
 */
export function inspectionConcession(prop: Property): Money {
  let total = 0;
  for (const d of prop.defects) {
    if (d.repaired) continue;
    const def = DEFECTS_BY_ID[d.defId];
    if (!def) continue;
    const cost = defectRepairCost(d.defId, prop);
    total += def.mustFix ? cost * 1.15 : cost * 0.5;
  }
  return Math.round(total);
}

let offerCounter = 0;

/**
 * Roll for a buyer arriving today.
 *
 * Probability falls off sharply above true value -- overpricing does not lose
 * you a little time, it loses you months. That is the trade-off the sell-side
 * of a flip actually turns on.
 */
export function rollBuyerOffer(
  prop: Property,
  world: WorldState,
  day: number,
  listPrice: Money,
  daysOnMarket: number,
  marketingSkill: number,
  rng: Rng,
): BuyerOffer | null {
  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  const mods = eventModifiers(world, prop.neighborhoodId);
  const value = trueValue(prop, world, day);
  if (value <= 0) return null;

  const ratio = listPrice / value;
  const priceFactor =
    ratio > 1 ? Math.exp(-7 * (ratio - 1)) : 1 + Math.min(0.6, (1 - ratio) * 1.6);

  const staged = prop.completedWork.includes('staging') ? 1.2 : 1;
  const stale = daysOnMarket > 75 ? 0.85 : 1;

  const p =
    0.085 *
    (hood?.demand ?? 1) *
    mods.demandMultiplier *
    priceFactor *
    staged *
    stale *
    (1 + 0.07 * marketingSkill);

  if (!rng.chance(Math.min(0.6, p))) return null;

  // Buyers anchor on the list price but will not blow past true value by much.
  const willingness = value * rng.clampedNormal(1.0, 0.035, 2);
  const anchor = willingness * rng.float(0.96, 1.03);

  // Most buyers borrow. A financed buyer can stretch further because they are
  // spending the bank's money -- but the bank sends an appraiser, and if it
  // comes in low the loan will not cover the gap.
  //
  // The stretch is applied to willingness *before* the list-price clamp. Doing
  // it after let a financed buyer offer up to 5% over the price on the board,
  // escaping both the asking price and the willingness cap.
  const financed = rng.chance(0.72);
  const stretch = financed ? rng.float(1.0, 1.05) : rng.float(0.94, 0.99);
  const amount = Math.round(Math.min(listPrice, anchor * stretch));

  // The appraisal is a noisy read of true value, fixed now so the outcome is
  // determined at offer time rather than re-rolled later.
  const appraisedValue = financed
    ? Math.round(value * rng.clampedNormal(1.0, 0.04, 2))
    : Number.MAX_SAFE_INTEGER;

  offerCounter += 1;
  return {
    id: `o${offerCounter.toString(36)}`,
    amount: Math.max(1000, amount),
    inspectionConcession: inspectionConcession(prop),
    expiresDay: day + rng.int(3, 7),
    buyerName: rng.pick(BUYER_NAMES),
    financed,
    appraisedValue,
  };
}

/**
 * What a financed offer will actually close at.
 *
 * The lender will not lend against more than the appraisal, and the buyer
 * rarely has the cash to bridge it, so the contract price falls to the
 * appraised value. This is why the highest offer is not automatically the best
 * one -- a lower cash offer with no appraisal attached often nets more.
 */
export function settlementPrice(offer: BuyerOffer): Money {
  return Math.min(offer.amount, offer.appraisedValue);
}

export function hasAppraisalGap(offer: BuyerOffer): boolean {
  return offer.financed && offer.appraisedValue < offer.amount;
}

const BUYER_NAMES = [
  'The Okonkwo family',
  'A first-time buyer',
  'An out-of-state investor',
  'A downsizing couple',
  'A local landlord',
  'The Reyes family',
  'A relocating engineer',
  'A cash buyer',
  'The Lindqvist family',
  'A young family',
];
