import { describe, expect, it } from 'vitest';
import {
  BENCHMARKS,
  LATEST_BENCHMARK,
  compareToBenchmark,
  describeBenchmark,
} from '../src/engine';
import type { ClosedDeal } from '../src/engine';

function deal(over: Partial<ClosedDeal> = {}): ClosedDeal {
  return {
    propertyId: 'p1',
    address: '12 Test St',
    neighborhoodId: 'riverside_flats',
    boughtDay: 1,
    soldDay: 141,
    purchasePrice: 120_000,
    salePrice: 190_000,
    closingCosts: 2_400,
    renovationSpend: 38_000,
    holdingCosts: 6_200,
    financingCosts: 0,
    commission: 11_400,
    concession: 0,
    netProfit: 12_000,
    roi: 0.26,
    daysHeld: 140,
    postMortem: null,
    before: null,
    after: null,
    replay: null,
    ...over,
  };
}

describe('the published figures', () => {
  it('carries a real series that can be updated yearly', () => {
    expect(BENCHMARKS.length).toBeGreaterThan(1);
    for (const b of BENCHMARKS) {
      expect(b.grossRoi).toBeGreaterThan(0);
      expect(b.daysToFlip).toBeGreaterThan(30);
      expect(b.note.length).toBeGreaterThan(20);
    }
    // Newest first, so LATEST is genuinely the latest.
    expect(LATEST_BENCHMARK.year).toBe(Math.max(...BENCHMARKS.map((b) => b.year)));
  });

  it('records that the market got harder, not easier', () => {
    const y2025 = BENCHMARKS.find((b) => b.year === 2025)!;
    const y2024 = BENCHMARKS.find((b) => b.year === 2024)!;
    expect(y2025.grossRoi).toBeLessThan(y2024.grossRoi);
  });
});

describe('comparing like with like', () => {
  it('compares gross to gross, because that is what the national figure is', () => {
    const c = compareToBenchmark(deal());
    // 190,000 - 120,000 = 70,000 on 120,000 = 58.3%
    expect(c.grossProfit).toBe(70_000);
    expect(c.grossRoi).toBeCloseTo(0.5833, 3);
    expect(c.nationalGrossRoi).toBe(LATEST_BENCHMARK.grossRoi);
  });

  it('never mistakes the net figure for the gross one', () => {
    const c = compareToBenchmark(deal());
    // The whole point: the same deal reads very differently on the two bases,
    // and conflating them is how flipping gets oversold.
    expect(c.netProfit).toBe(12_000);
    expect(c.netRoi).toBeCloseTo(0.1, 3);
    expect(c.netRoi).toBeLessThan(c.grossRoi);
  });

  it('does not annualise one side of the comparison', () => {
    // ATTOM does not annualise, so neither can this. A 140-day deal and a
    // 365-day deal with the same gross percentage compare equal here, and the
    // days column is what carries the difference.
    const quick = compareToBenchmark(deal({ daysHeld: 90 }));
    const slow = compareToBenchmark(deal({ daysHeld: 300 }));
    expect(quick.grossRoi).toBeCloseTo(slow.grossRoi, 6);
    expect(quick.daysGap).toBeLessThan(slow.daysGap);
  });

  it('knows whether you beat the median', () => {
    expect(compareToBenchmark(deal()).beatIt).toBe(true);
    const weak = compareToBenchmark(deal({ salePrice: 130_000 }));
    expect(weak.beatIt).toBe(false);
    expect(weak.roiGap).toBeLessThan(0);
  });

  it('survives a zero purchase price without dividing by it', () => {
    const c = compareToBenchmark(deal({ purchasePrice: 0 }));
    expect(Number.isFinite(c.grossRoi)).toBe(true);
    expect(c.grossRoi).toBe(0);
  });
});

describe('what it tells the player', () => {
  it('names the gap between the headline basis and the real one', () => {
    const text = describeBenchmark(compareToBenchmark(deal()));
    expect(text).toMatch(/headlines use/i);
    expect(text).toMatch(/after those costs/i);
  });

  it('calls out a slow flip against the national average', () => {
    const text = describeBenchmark(compareToBenchmark(deal({ daysHeld: 300 })));
    expect(text).toMatch(/days longer/i);
    expect(text).toMatch(/carry does not stop/i);
  });

  it('credits speed when it was the source of the advantage', () => {
    const text = describeBenchmark(compareToBenchmark(deal({ daysHeld: 80 })));
    expect(text).toMatch(/quicker/i);
  });

  it('states the median plainly when the deal did not beat it', () => {
    const text = describeBenchmark(compareToBenchmark(deal({ salePrice: 128_000 })));
    expect(text).toMatch(/national median/i);
    expect(text).not.toMatch(/ahead of/i);
  });
});
