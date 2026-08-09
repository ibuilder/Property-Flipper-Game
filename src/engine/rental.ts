import { DEFECTS_BY_ID, ECON, NEIGHBORHOODS_BY_ID } from './content';
import type { Money, Property, Rental, WorldState } from './types';
import { conditionMultiplier, trueValue, upgradeMultiplier } from './valuation';

/**
 * Renting rather than selling -- the R and the second R of BRRRR.
 *
 * This is the point where the game stops being a series of transactions and
 * becomes a business. A flip converts equity to cash once; a rental holds the
 * asset, throws off income, and lets a refinance pull the capital back out to
 * buy the next one. The numbers that decide whether that works -- NOI, cap
 * rate, cash-on-cash, DSCR -- are the ones every lender and investor actually
 * uses, so they are computed here rather than approximated.
 */

/** What the unit would let for today, per month. */
export function marketRent(prop: Property, world: WorldState, day: number): Money {
  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  if (!hood) return 0;

  // Rent follows condition and finish, but less steeply than value does: a
  // tired house rents at a discount, not at half price. It still has to be
  // steep enough that buying a wreck and letting it as-is is not the dominant
  // strategy -- see isHabitable, which stops that outright.
  const cond = 0.55 + 0.55 * Math.max(0, Math.min(1, prop.condition));
  const upgrades = 1 + (upgradeMultiplier(prop.completedWork) - 1) * 0.5;
  const hoodIndex = world.neighborhoodIndex[prop.neighborhoodId] ?? 1;

  return Math.round(hood.rentPerSqft * prop.sqft * cond * upgrades * hoodIndex);
}

/**
 * Whether the place can legally be let at all.
 *
 * A landlord owes an implied warranty of habitability, and a house with an
 * open roof or dead wiring does not meet it. This is the rule that puts the
 * rehab in BRRRR: you cannot skip straight from buying a wreck to collecting
 * rent on it, which is exactly the shortcut the yield maths would otherwise
 * make irresistible.
 */
export function isHabitable(prop: Property): boolean {
  if (prop.condition < ECON.RENTAL.minCondition) return false;
  // Known life-safety defects have to be fixed first. Undiscovered ones do not
  // block you -- an inspector finds those, and you have not called one.
  return !prop.defects.some(
    (d) => d.revealed && !d.repaired && DEFECTS_BY_ID[d.defId]?.severity === 'major',
  );
}

/**
 * Annual operating expenses on a tenanted property.
 *
 * Taxes and insurance are already charged daily as carry, so this covers the
 * costs that only exist because there is a tenant: management, maintenance and
 * a capital reserve. Utilities move to the tenant, which is why holding a
 * rented property costs slightly less per day than holding an empty one.
 */
export function annualOpex(grossRent: Money): Money {
  return Math.round(grossRent * (ECON.RENTAL.management + ECON.RENTAL.maintenance));
}

/**
 * Net operating income: rent less vacancy less operating expenses.
 *
 * Deliberately *before* debt service -- that is what makes it a property of
 * the building rather than of how you financed it, and why lenders size loans
 * against it.
 */
export function noi(prop: Property, world: WorldState, day: number, rent?: Money): Money {
  const monthly = rent ?? marketRent(prop, world, day);
  const gross = monthly * 12;
  const effective = gross * (1 - ECON.RENTAL.vacancyRate);
  // Taxes and insurance belong in NOI even though the game also charges them
  // daily; excluding them would overstate the yield a lender will underwrite.
  const hood = NEIGHBORHOODS_BY_ID[prop.neighborhoodId];
  const value = trueValue(prop, world, day);
  const taxes = value * (hood?.taxRate ?? 0.012);
  const insurance = value * ECON.INSURANCE_RATE;
  const hoa = (hood?.hoaMonthly ?? 0) * 12;

  return Math.round(effective - annualOpex(effective) - taxes - insurance - hoa);
}

/** NOI as a fraction of value. What buyers of income property actually quote. */
export function capRate(prop: Property, world: WorldState, day: number, rent?: Money): number {
  const value = trueValue(prop, world, day);
  if (value <= 0) return 0;
  return noi(prop, world, day, rent) / value;
}

/** Annual cash left after debt service, over the cash actually invested. */
export function cashOnCash(
  annualNoi: Money,
  annualDebtService: Money,
  cashInvested: Money,
): number {
  if (cashInvested <= 0) return 0;
  return (annualNoi - annualDebtService) / cashInvested;
}

/**
 * Debt service coverage ratio.
 *
 * The number that decides whether a lender will write the loan at all. Below
 * about 1.20 the income does not cover the payment with the cushion they
 * require, and the answer is no regardless of how much equity is in the deal.
 */
export function dscr(annualNoi: Money, annualDebtService: Money): number {
  if (annualDebtService <= 0) return Infinity;
  return annualNoi / annualDebtService;
}

/** A fresh rental record for a property about to be listed to let. */
export function createRental(askingRent: Money): Rental {
  return {
    askingRent,
    tenancy: null,
    vacantDays: 0,
    rentCollected: 0,
    opexPaid: 0,
    turnovers: 0,
  };
}

/**
 * Chance of signing a tenant on any given day.
 *
 * Same shape as the buyer model: demand falls off sharply once the asking rent
 * is above what the unit is worth, so over-asking costs you months of vacancy
 * rather than a few days.
 */
export function tenantInterest(
  asking: Money,
  market: Money,
  neighborhoodDemand: number,
  marketingSkill: number,
): number {
  if (market <= 0) return 0;
  const ratio = asking / market;
  const priceFactor = ratio > 1 ? Math.exp(-6 * (ratio - 1)) : 1 + Math.min(0.5, (1 - ratio) * 1.4);
  return Math.min(0.55, 0.11 * neighborhoodDemand * priceFactor * (1 + 0.05 * marketingSkill));
}

/** Daily cash a tenanted property actually throws off, before debt service. */
export function dailyRentalCashflow(rental: Rental): Money {
  if (!rental.tenancy) return 0;
  const gross = rental.tenancy.rent * 12;
  return (gross - annualOpex(gross)) / 365;
}
