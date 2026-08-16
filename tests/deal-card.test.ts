import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DealCardModal from '../src/ui/components/DealCardModal';
import type { ClosedDeal } from '../src/engine';
import { CARD_H, CARD_W, bestAndWorst, cardLines, dealCard } from '../src/ui/dealCard';

/**
 * The deal card.
 *
 * A card is a claim about a deal that leaves the machine without the deal
 * attached, so the thing worth asserting is that every figure on it came off
 * the ledger rather than being recomputed here. A card that rounded differently
 * from the panel it was opened from would be a second, competing account of the
 * same flip.
 */

function deal(over: Partial<ClosedDeal> = {}): ClosedDeal {
  return {
    propertyId: 'p1',
    address: '114 Rope Walk',
    neighborhoodId: 'old_town',
    boughtDay: 20,
    soldDay: 96,
    purchasePrice: 121_000,
    salePrice: 198_500,
    closingCosts: 3_400,
    renovationSpend: 41_250,
    holdingCosts: 2_980,
    financingCosts: 6_100,
    commission: 9_925,
    concession: 0,
    netProfit: 13_845,
    roi: 0.412,
    daysHeld: 76,
    listedDay: 78,
    postMortem: null,
    before: null,
    after: {
      id: 'p1',
      address: '114 Rope Walk',
      archetypeId: 'victorian',
      neighborhoodId: 'old_town',
      sqft: 2100,
      beds: 4,
      baths: 2,
      yearBuilt: 1908,
      condition: 0.86,
      defects: [],
      completedWork: [],
      noiseSeed: 7,
    },
    ...over,
  } as ClosedDeal;
}

describe('the deal card', () => {
  it('puts every figure from the ledger on it, unrounded', () => {
    const d = deal();
    const svg = dealCard(d);
    for (const n of [
      d.salePrice,
      d.purchasePrice,
      d.closingCosts,
      d.renovationSpend,
      d.holdingCosts,
      d.financingCosts,
      d.commission,
      d.netProfit,
    ]) {
      expect(svg, `${n} should appear on the card`).toContain(n.toLocaleString('en-US'));
    }
    expect(svg).toContain('114 Rope Walk');
    expect(svg).toContain('76 days');
    expect(svg).toContain('41.2%');
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('shows the same lines as the margin waterfall', () => {
    // Two accounts of one deal is one account too many.
    const lines = cardLines(deal());
    expect(lines.map((l) => l.label)).toEqual([
      'Sale price',
      'Purchase',
      'Closing',
      'Renovation',
      'Carry',
      'Financing',
      'Commission',
    ]);
    // Everything after the sale price is money going out.
    for (const l of lines.slice(1)) expect(l.value, l.label).toBeLessThanOrEqual(0);
    // And they reconcile to the profit the engine recorded.
    const sum = lines.reduce((s, l) => s + l.value, 0);
    expect(sum).toBe(deal().netProfit);
  });

  it('drops the lines that did not happen', () => {
    const clean = cardLines(deal({ financingCosts: 0, concession: 0 }));
    expect(clean.map((l) => l.label)).not.toContain('Financing');
    expect(clean.map((l) => l.label)).not.toContain('Concession');
    // A zero row reads as a cost that was incurred and happened to be nothing.
    const conceded = cardLines(deal({ concession: 2_500 }));
    expect(conceded.map((l) => l.label)).toContain('Concession');
  });

  it('is as willing to say Loss as Profit', () => {
    // The whole point of it as distribution: a bad flip is the postable one.
    const bad = dealCard(deal({ netProfit: -18_400, roi: -0.31 }));
    expect(bad).toContain('Loss');
    expect(bad).toContain('-$18,400');
    expect(bad).toContain('-31.0%');
    expect(dealCard(deal())).toContain('Profit');
  });

  it('names what decided it, when the post-mortem knows', () => {
    const withPm = dealCard(
      deal({
        postMortem: {
          headline: 'The ARV was optimistic by $14,200',
          projected: {} as never,
          actualSalePrice: 0,
          actualProfit: 0,
          lines: [],
        } as never,
      }),
    );
    expect(withPm).toContain('WHAT DECIDED IT');
    expect(withPm).toContain('The ARV was optimistic');
    // And says nothing at all when there is no projection to compare against.
    expect(dealCard(deal())).not.toContain('WHAT DECIDED IT');
  });

  it('escapes an address rather than letting it close a tag', () => {
    // Addresses are generated, but a scenario code carries one in from outside.
    const svg = dealCard(deal({ address: '12 <script>x</script> Way' }));
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('signs the card only when there is something to sign it with', () => {
    expect(dealCard(deal(), 'mattie')).toContain('mattie');
    expect(dealCard(deal(), '   ')).toBe(dealCard(deal(), ''));
  });

  it('will not call one flip both the best and the worst', () => {
    const only = [deal()];
    expect(bestAndWorst(only).best).toBe(only[0]);
    expect(bestAndWorst(only).worst).toBeNull();

    const many = [deal({ netProfit: 10 }), deal({ netProfit: -5 }), deal({ netProfit: 40 })];
    expect(bestAndWorst(many).best?.netProfit).toBe(40);
    expect(bestAndWorst(many).worst?.netProfit).toBe(-5);
    expect(bestAndWorst([]).best).toBeNull();
  });

  it('mounts in a modal with an accessible description', () => {
    /*
     * The card is an image, so the only thing a screen reader gets is the alt
     * text. It has to carry the actual result rather than "deal card", or the
     * one artefact this feature exists to share says nothing to anyone using
     * one.
     */
    const html = renderToStaticMarkup(
      createElement(DealCardModal, { deal: deal(), onClose: () => {} }),
    );
    expect(html).toContain('data:image/svg+xml');
    expect(html).toMatch(/alt="[^"]*114 Rope Walk[^"]*profit[^"]*13,845[^"]*76 days/);
    expect(html).toContain('Copy image');
    expect(html).toContain('Save PNG');
    expect(html).not.toMatch(/NaN|undefined/);
  });

  it('writes a sample card', () => {
    const svg = dealCard(
      deal({
        postMortem: {
          headline: 'Carry ate the margin: 76 days held, 34 of them listed',
        } as never,
      }),
      'mattie',
    );
    expect(svg).toContain(`viewBox="0 0 ${CARD_W} ${CARD_H}"`);
    writeFileSync('docs/design/deal-card.svg', `${svg}\n`, 'utf8');
  });
});
