import { describe, expect, it } from 'vitest';
import {
  CONCEPTS,
  DEMONSTRATIONS_FOR_MASTERY,
  analyzeDeal,
  conceptProgress,
  createGame,
  describeMastery,
  estimateArv,
  hasMastered,
  type ClosedDeal,
  type GameState,
} from '../src/engine';
import { RULES, type CoachContext } from '../src/ui/coach/rules';

const SCOPE = ['paint_interior', 'flooring_lvp', 'landscaping_curb'];

/** A closed deal shaped to demonstrate, or fail to demonstrate, a concept. */
function deal(over: Partial<ClosedDeal> = {}): ClosedDeal {
  return {
    propertyId: 'p1',
    address: '1 Test St',
    neighborhoodId: 'old_town',
    boughtDay: 0,
    soldDay: 100,
    purchasePrice: 100_000,
    salePrice: 200_000,
    closingCosts: 2_000,
    renovationSpend: 30_000,
    holdingCosts: 3_000,
    financingCosts: 0,
    commission: 12_000,
    concession: 0,
    netProfit: 40_000,
    roi: 0.4,
    daysHeld: 100,
    listedDay: 80,
    postMortem: {
      projected: {
        arv: 200_000,
        repairEstimate: 30_000,
        renovationDays: 40,
        marketingDays: 30,
        projectedProfit: 45_000,
        purchasePrice: 100_000,
        mao70: 110_000,
        maoDetailed: 105_000,
      },
      actualSalePrice: 200_000,
      actualProfit: 40_000,
      lines: [],
      headline: '',
    },
    before: null,
    after: null,
    replay: null,
    ...over,
  } as ClosedDeal;
}

function context(offerMultiple: number): CoachContext {
  const state = createGame('sandbox', 909);
  const prop = state.market.filter((p) => p.listing)[3]!;
  const arv = estimateArv(prop, state.world, state.day, SCOPE);
  const first = analyzeDeal(prop, state.world, state.day, arv, SCOPE, state.skills, {});
  const offer = Math.round(first.maoDetailed * offerMultiple);
  const analysis = analyzeDeal(prop, state.world, state.day, arv, SCOPE, state.skills, { offer });
  return { state, property: prop, analysis, offer };
}

describe('the mastery ledger', () => {
  it('reports nothing proved on a fresh campaign', () => {
    const progress = conceptProgress([]);
    expect(progress).toHaveLength(CONCEPTS.length);
    for (const p of progress) {
      expect(p.demonstrated).toBe(0);
      expect(p.mastered).toBe(false);
    }
    expect(describeMastery(progress)).toBeNull();
  });

  it('needs the concept demonstrated twice, because once is luck', () => {
    const disciplined = deal({ purchasePrice: 90_000 });
    const once = conceptProgress([disciplined]).find((p) => p.id === 'cost.stack')!;
    expect(once.demonstrated).toBe(1);
    expect(once.mastered).toBe(false);

    const twice = conceptProgress([disciplined, disciplined]).find((p) => p.id === 'cost.stack')!;
    expect(twice.demonstrated).toBe(DEMONSTRATIONS_FOR_MASTERY);
    expect(twice.mastered).toBe(true);
  });

  it('does not credit a deal bought over the itemised maximum', () => {
    const overpaid = deal({ purchasePrice: 130_000 });
    expect(conceptProgress([overpaid, overpaid]).find((p) => p.id === 'cost.stack')!.demonstrated).toBe(
      0,
    );
  });

  it('credits a fast sale only when it was not bought by underpricing', () => {
    const fast = deal({ listedDay: 80, soldDay: 100, salePrice: 200_000 });
    expect(conceptProgress([fast]).find((p) => p.id === 'market.traffic')!.demonstrated).toBe(1);

    const slow = deal({ listedDay: 20, soldDay: 100 });
    expect(conceptProgress([slow]).find((p) => p.id === 'market.traffic')!.demonstrated).toBe(0);

    // Sold fast because it was given away: over 102% of ARV is the only bar,
    // and this one is well under, so it counts. The guard is the other way.
    const dumped = deal({ listedDay: 95, soldDay: 100, salePrice: 260_000 });
    expect(conceptProgress([dumped]).find((p) => p.id === 'market.traffic')!.demonstrated).toBe(0);
  });

  it('cannot credit anything from a deal with no projection recorded', () => {
    // Deals closed before post-mortems existed. Absent, not guessed.
    const bare = deal({ postMortem: null });
    const p = conceptProgress([bare, bare]);
    expect(p.find((x) => x.id === 'cost.stack')!.demonstrated).toBe(0);
    expect(p.find((x) => x.id === 'market.traffic')!.demonstrated).toBe(0);
  });

  it('answers hasMastered off real game state', () => {
    const state = createGame('sandbox', 909) as GameState;
    expect(hasMastered(state, 'cost.stack')).toBe(false);
    state.closedDeals.push(deal({ purchasePrice: 90_000 }), deal({ purchasePrice: 90_000 }));
    expect(hasMastered(state, 'cost.stack')).toBe(true);
  });
});

describe('Scout', () => {
  it('has a unique id for every rule', () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every rule a cooldown and a lifetime, so nothing can nag', () => {
    for (const r of RULES) {
      expect(r.cooldownDays, r.id).toBeGreaterThan(0);
      expect(r.maxLifetime, r.id).toBeGreaterThan(0);
      expect(r.priority, r.id).toBeGreaterThan(0);
    }
  });

  it('backs every line with arithmetic that can be checked', () => {
    // A coach that cannot be audited is a voice being confident at you.
    const c = context(1.4);
    for (const r of RULES) {
      if (!r.when(c)) continue;
      expect(r.math, `${r.id} fires with no working shown`).toBeDefined();
      expect(r.math!(c).length, r.id).toBeGreaterThan(8);
    }
  });

  it('never throws, whatever it is handed', () => {
    // Rules run against every screen. One that assumes a property is present
    // must not take the interface down when it is not.
    const bare: CoachContext = { state: createGame('sandbox', 1) };
    for (const r of RULES) {
      expect(() => r.when(bare), r.id).not.toThrow();
      if (r.when(bare)) {
        expect(() => r.line(bare), r.id).not.toThrow();
        expect(() => r.math?.(bare), r.id).not.toThrow();
      }
    }
  });

  it('calls out an offer over the itemised maximum', () => {
    const rule = RULES.find((r) => r.id === 'offer-over-mao')!;
    expect(rule.when(context(1.4))).toBe(true);
    expect(rule.when(context(0.8))).toBe(false);
    expect(rule.math!(context(1.4))).toMatch(/\$[\d,]+ over/);
  });

  it('approves a deal bought well inside the ceiling, and only then', () => {
    const rule = RULES.find((r) => r.id === 'bought-right')!;
    expect(rule.when(context(0.8))).toBe(true);
    expect(rule.when(context(1.1))).toBe(false);
    expect(rule.mood).toBe('approving');
  });

  it('stays in character', () => {
    // The brief: short declarative sentences, trade vocabulary, dry. Never
    // cute. He does not say "Woof".
    const c = context(1.4);
    for (const r of RULES) {
      const line = r.line(c);
      expect(line, r.id).not.toMatch(/woof|good boy|!{1}/i);
      expect(line.length, `${r.id} is a speech, not a line`).toBeLessThan(240);
    }
  });

  it('marks which rules retire once the concept is proved', () => {
    // The field that stops him nagging an expert, and the same field an
    // instructor report reads.
    const teaching = RULES.filter((r) => r.teaches);
    expect(teaching.length).toBeGreaterThan(0);
    for (const r of teaching) {
      expect(CONCEPTS.map((c) => c.id), `${r.id} teaches an unknown concept`).toContain(r.teaches);
    }
    expect(teaching.some((r) => r.suppressAfterMastery)).toBe(true);
  });
});
