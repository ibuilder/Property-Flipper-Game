import type { ClosedDeal, Money } from './types';

/**
 * How your deal compares to what real flippers actually did.
 *
 * Every other number in this game is invented by the game. These are not:
 * they are ATTOM's published national figures, and they let a player check the
 * simulation against the world instead of taking its word for anything.
 *
 * The comparison has to be made carefully, and the care is itself the lesson.
 * ATTOM's headline "ROI" is *gross*: resale price against purchase price, with
 * no deduction for the rehab, the carry, the commission or the financing. It
 * is the number quoted in every article about flipping, and it is roughly
 * double what the same deal returns after costs. So this compares gross to
 * gross -- and then shows the player what their own gross figure became once
 * the costs the headline ignores were taken out.
 *
 * That gap is the single most useful thing a beginner can be shown, because
 * the gross number is the one that made them want to try this.
 */

export interface BenchmarkYear {
  year: number;
  /** Median gross profit: resale less purchase, before any costs. */
  grossProfit: Money;
  /** Gross ROI on the purchase price. */
  grossRoi: number;
  /** Average days from purchase to resale. */
  daysToFlip: number;
  /** Flips completed nationally. */
  flips: number;
  note: string;
}

/**
 * ATTOM U.S. Home Flipping Reports.
 *
 * Kept as data rather than baked into copy so it can be updated each year
 * without touching any logic.
 */
export const BENCHMARKS: BenchmarkYear[] = [
  {
    year: 2025,
    grossProfit: 65_981,
    grossRoi: 0.255,
    daysToFlip: 161,
    flips: 297_045,
    note: 'The lowest return since 2008. Acquisition and renovation costs rose faster than resale values, and more investors were paying for hard money rather than using cash.',
  },
  {
    year: 2024,
    grossProfit: 72_000,
    grossRoi: 0.321,
    daysToFlip: 162,
    flips: 309_050,
    note: 'The year before the squeeze, and still well below the margins of the previous decade.',
  },
];

export const LATEST_BENCHMARK = BENCHMARKS[0];

export interface BenchmarkComparison {
  year: number;
  /** Yours, on the same gross basis the national figure uses. */
  grossProfit: Money;
  grossRoi: number;
  daysHeld: number;
  /** Theirs. */
  nationalGrossProfit: Money;
  nationalGrossRoi: number;
  nationalDays: number;
  /** What the gross figure became after the costs it ignores. */
  netProfit: Money;
  netRoi: number;
  /** Positive means you beat the national median. */
  roiGap: number;
  daysGap: number;
  beatIt: boolean;
}

/**
 * Compare one closed deal to the national median, gross against gross.
 *
 * Deliberately not annualised: ATTOM does not annualise, and quietly
 * annualising one side of a comparison is how statistics get abused.
 */
export function compareToBenchmark(
  deal: ClosedDeal,
  year = LATEST_BENCHMARK.year,
): BenchmarkComparison {
  const b = BENCHMARKS.find((x) => x.year === year) ?? LATEST_BENCHMARK;
  const grossProfit = deal.salePrice - deal.purchasePrice;
  const grossRoi = deal.purchasePrice > 0 ? grossProfit / deal.purchasePrice : 0;
  const netRoi = deal.purchasePrice > 0 ? deal.netProfit / deal.purchasePrice : 0;

  return {
    year: b.year,
    grossProfit,
    grossRoi,
    daysHeld: deal.daysHeld,
    nationalGrossProfit: b.grossProfit,
    nationalGrossRoi: b.grossRoi,
    nationalDays: b.daysToFlip,
    netProfit: deal.netProfit,
    netRoi,
    roiGap: grossRoi - b.grossRoi,
    daysGap: deal.daysHeld - b.daysToFlip,
    beatIt: grossRoi >= b.grossRoi,
  };
}

/**
 * The sentence that does the teaching.
 *
 * Leads with the gap between gross and net, because that is the part nobody
 * tells beginners and the part that decides whether this is a business or an
 * expensive hobby.
 */
export function describeBenchmark(c: BenchmarkComparison): string {
  const grossPct = (c.grossRoi * 100).toFixed(1);
  const netPct = (c.netRoi * 100).toFixed(1);
  const nationalPct = (c.nationalGrossRoi * 100).toFixed(1);

  const standing = c.beatIt
    ? `That is ahead of the ${c.year} national median of ${nationalPct}%.`
    : `The ${c.year} national median was ${nationalPct}%.`;

  const speed =
    c.daysGap < -20
      ? ` You were ${Math.abs(c.daysGap)} days quicker than the national average, which is where most of the advantage came from.`
      : c.daysGap > 20
        ? ` You took ${c.daysGap} days longer than the national average of ${c.nationalDays}, and carry does not stop.`
        : '';

  const wedge =
    c.netProfit < c.grossProfit
      ? ` On the same basis the headlines use — resale against purchase, ignoring the rehab, carry and commission — this deal made ${grossPct}%. After those costs it actually made ${netPct}%. That wedge is what the published figure never shows.`
      : '';

  return `${standing}${speed}${wedge}`;
}
