import {
  ARCHETYPES_BY_ID,
  NEIGHBORHOODS_BY_ID,
  type ClosedDeal,
} from '../engine';
import { HOUSE_COLOR_BARE, HOUSE_PLINTH } from './art.generated';
import { money } from './format';

/**
 * A picture of one flip, to take away.
 *
 * The last item on the roadmap, and the only thing the game did not have: a
 * finished deal was a number in a table, and there was nothing a player could
 * put in front of anyone else. Distribution is the point -- somebody posting
 * their worst flip is the cheapest advertising this project will ever get --
 * but it only works if the card is worth posting, which means it has to be
 * honest about a loss rather than only celebrating a win.
 *
 * Built as a string of SVG rather than as a component, so it is a pure function
 * of a closed deal and can be asserted in a test without rendering anything.
 * Everything on it is read off `ClosedDeal`; nothing is recomputed here, so the
 * card cannot disagree with the ledger it came from.
 *
 * ## Why the colours are baked
 *
 * Every other picture in this app takes the theme. This one leaves in an email
 * and has to carry its own ground: a card drawn in `currentColor` would arrive
 * as an invisible rectangle. The palette below is the dark theme's, frozen.
 */

/** 1200 x 630, which is what every social preview crops to. */
export const CARD_W = 1200;
export const CARD_H = 630;

const INK = {
  bg: '#131e29',
  panel: '#0f1720',
  text: '#f2f2f3',
  dim: '#9aa7b4',
  faint: '#66727e',
  rule: '#2a3948',
  accent: '#94bce3',
  good: '#7fc8a9',
  bad: '#e0796b',
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Line {
  label: string;
  value: number;
}

/**
 * The cost stack, in the order the money actually moved.
 *
 * The same lines the margin waterfall shows in the app, because a card that
 * summarised differently from the panel it came from would be a second,
 * competing account of the same deal.
 */
export function cardLines(deal: ClosedDeal): Line[] {
  return [
    { label: 'Sale price', value: deal.salePrice },
    { label: 'Purchase', value: -deal.purchasePrice },
    { label: 'Closing', value: -deal.closingCosts },
    { label: 'Renovation', value: -deal.renovationSpend },
    { label: 'Carry', value: -deal.holdingCosts },
    ...(deal.financingCosts ? [{ label: 'Financing', value: -deal.financingCosts }] : []),
    { label: 'Commission', value: -deal.commission },
    ...(deal.concession ? [{ label: 'Concession', value: -deal.concession }] : []),
  ];
}

function text(
  x: number,
  y: number,
  s: string,
  opts: { size?: number; fill?: string; weight?: number; anchor?: string; track?: number } = {},
): string {
  const { size = 20, fill = INK.text, weight = 400, anchor = 'start', track } = opts;
  return (
    `<text x="${x}" y="${y}" font-family="Barlow, Segoe UI, system-ui, sans-serif" ` +
    `font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"` +
    (track ? ` letter-spacing="${track}"` : '') +
    `>${esc(s)}</text>`
  );
}

/**
 * The house, at the size the card wants it.
 *
 * This is the one place the plinth-carrying drawings belong: a single house is
 * the subject, there is no data ramp underneath, and the kerb and lawn are what
 * stop it floating. On the board the same plinth would paint over the lot
 * colour the four data views exist to show.
 */
function house(deal: ClosedDeal, x: number, y: number, size: number): string {
  const id = deal.after?.archetypeId ?? deal.before?.archetypeId ?? '';
  const art = HOUSE_COLOR_BARE[id];
  if (!art) return '';
  const k = size / 256;
  return (
    `<g transform="translate(${x} ${y}) scale(${k.toFixed(4)})">` +
    (HOUSE_PLINTH[id] ?? '') +
    art.base +
    `</g>`
  );
}

/**
 * One closed deal as a standalone SVG.
 *
 * `handle` is stamped on it only if the player set one -- an empty byline is
 * better than a placeholder that looks like somebody's name.
 */
export function dealCard(deal: ClosedDeal, handle?: string | null): string {
  const hood = NEIGHBORHOODS_BY_ID[deal.neighborhoodId]?.name ?? '';
  const arch = ARCHETYPES_BY_ID[deal.after?.archetypeId ?? '']?.name ?? '';
  const won = deal.netProfit >= 0;
  const tone = won ? INK.good : INK.bad;

  const lines = cardLines(deal);
  const rowY = 232;
  const rowH = 34;

  let body = '';
  body += `<rect width="${CARD_W}" height="${CARD_H}" fill="${INK.bg}"/>`;
  // A hairline frame, the same device the interface uses everywhere.
  body += `<rect x="18" y="18" width="${CARD_W - 36}" height="${CARD_H - 36}" fill="none" stroke="${INK.rule}"/>`;

  // Masthead row.
  body += text(56, 74, 'PROPERTY FLIPPER', { size: 15, fill: INK.accent, weight: 600, track: 3.4 });
  body += text(56, 128, deal.address, { size: 44, weight: 600 });
  body += text(56, 162, [hood, arch].filter(Boolean).join('  ·  '), { size: 20, fill: INK.dim });
  body += `<line x1="56" y1="192" x2="${CARD_W - 56}" y2="192" stroke="${INK.rule}"/>`;

  // The cost stack.
  lines.forEach((l, i) => {
    const y = rowY + i * rowH;
    body += text(56, y, l.label, { size: 20, fill: INK.dim });
    body += text(
      560,
      y,
      (l.value < 0 ? '-' : '') + money(Math.abs(l.value)),
      { size: 20, anchor: 'end', fill: l.value < 0 ? INK.text : INK.text },
    );
  });

  // The answer.
  const outY = rowY + lines.length * rowH + 26;
  body += `<line x1="56" y1="${outY - 26}" x2="560" y2="${outY - 26}" stroke="${INK.rule}"/>`;
  body += text(56, outY, won ? 'Profit' : 'Loss', { size: 24, weight: 600 });
  body += text(560, outY, money(deal.netProfit), { size: 30, weight: 600, anchor: 'end', fill: tone });

  // Two figures that say how it was won or lost, rather than only how much.
  const footY = CARD_H - 62;
  body += `<line x1="56" y1="${footY - 44}" x2="${CARD_W - 56}" y2="${footY - 44}" stroke="${INK.rule}"/>`;
  body += text(56, footY, 'ANNUALISED', { size: 13, fill: INK.faint, weight: 600, track: 2 });
  body += text(56, footY + 30, `${(deal.roi * 100).toFixed(1)}%`, { size: 26, weight: 600, fill: tone });
  body += text(250, footY, 'HELD', { size: 13, fill: INK.faint, weight: 600, track: 2 });
  body += text(250, footY + 30, `${deal.daysHeld} days`, { size: 26, weight: 600 });

  /*
   * What the post-mortem decided, when there is one.
   *
   * The single most interesting line on the card and the reason a loss is worth
   * posting: it names why, not just how much.
   */
  if (deal.postMortem?.headline) {
    body += text(470, footY, 'WHAT DECIDED IT', { size: 13, fill: INK.faint, weight: 600, track: 2 });
    const h = deal.postMortem.headline;
    body += text(470, footY + 28, h.length > 62 ? `${h.slice(0, 61)}…` : h, {
      size: 19,
      fill: INK.dim,
    });
  }

  if (handle && handle.trim()) {
    body += text(CARD_W - 56, 74, handle.trim(), { size: 17, fill: INK.faint, anchor: 'end' });
  }

  body += house(deal, 792, 150, 360);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" ` +
    `width="${CARD_W}" height="${CARD_H}">${body}</svg>`
  );
}

/** The deal most worth showing someone, and the one most worth confessing. */
export function bestAndWorst(
  deals: readonly ClosedDeal[],
): { best: ClosedDeal | null; worst: ClosedDeal | null } {
  let best: ClosedDeal | null = null;
  let worst: ClosedDeal | null = null;
  for (const d of deals) {
    if (!best || d.netProfit > best.netProfit) best = d;
    if (!worst || d.netProfit < worst.netProfit) worst = d;
  }
  // One deal is both, and calling the same flip your best and your worst reads
  // as a bug rather than as arithmetic.
  return best === worst ? { best, worst: null } : { best, worst };
}
