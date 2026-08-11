import { describe, expect, it } from 'vitest';
import {
  acceptOffer,
  advanceDay,
  buildTimeline,
  createGame,
  deploymentRate,
  describeDeployment,
  listForSale,
  makeOffer,
  startRenovation,
} from '../src/engine';
import { currentReserve } from '../src/engine/market';

function cheapest(state: ReturnType<typeof createGame>) {
  return state.market
    .filter((p) => p.listing)
    .sort((a, b) => currentReserve(a) - currentReserve(b))[0];
}

/**
 * Buy a property outright for the purposes of a test about something else.
 *
 * Offering exactly the asking price is a coin flip by design -- a rival can
 * snipe a thin offer on a wanted house, which is a real mechanic and not
 * something these tests are examining. Paying a premium removes that
 * randomness so a failure here means the timeline is wrong.
 */
function buy(state: ReturnType<typeof createGame>, prop: { id: string; listing: any }) {
  const res = makeOffer(state, prop.id, Math.round(prop.listing.askPrice * 1.15), false);
  expect(res.ok, `setup purchase failed: ${res.message}`).toBe(true);
  return res;
}

describe('the campaign timeline', () => {
  it('is empty but honest before anything is bought', () => {
    const state = createGame('first_flip', 21);
    for (let i = 0; i < 40; i++) advanceDay(state);
    const t = buildTimeline(state);

    expect(t.lanes).toHaveLength(0);
    // The clock ran regardless, and the timeline says so.
    expect(t.idleDays).toBe(t.today);
    expect(deploymentRate(t)).toBe(0);
    expect(describeDeployment(t)).toMatch(/clock is running/i);
  });

  it('spans the campaign clock, not just the days played', () => {
    const state = createGame('first_flip', 22);
    const t = buildTimeline(state);
    // 450-day campaign: the axis shows the whole thing on day 1, so the player
    // can see how much of it is still ahead.
    expect(t.toDay).toBeGreaterThan(400);
    expect(t.fromDay).toBe(1);
  });

  it('gives the sandbox a growing axis rather than a fake deadline', () => {
    const state = createGame('sandbox', 23);
    for (let i = 0; i < 100; i++) advanceDay(state);
    const t = buildTimeline(state);
    expect(t.toDay).toBeGreaterThanOrEqual(t.today);
    // Not the 450 of a campaign, and not absurdly far out either.
    expect(t.toDay).toBeLessThan(t.today * 2);
  });

  it('opens a lane on purchase and keeps it open while held', () => {
    const state = createGame('sandbox', 24);
    const prop = cheapest(state);
    buy(state, prop);
    for (let i = 0; i < 20; i++) advanceDay(state);

    const t = buildTimeline(state);
    expect(t.lanes).toHaveLength(1);
    const lane = t.lanes[0];
    expect(lane.open).toBe(true);
    expect(lane.soldDay).toBeNull();
    const owned = lane.spans.find((s) => s.kind === 'owned')!;
    expect(owned.to).toBe(state.day);
  });

  it('derives the renovation span from money that actually moved', () => {
    const state = createGame('sandbox', 25);
    const prop = cheapest(state);
    // Assert the setup rather than trusting it: a rejected offer here would
    // otherwise surface as an unrelated crash on an empty lane list.
    buy(state, prop);
    const startDay = state.day;
    expect(startRenovation(state, prop.id, ['paint_interior', 'flooring_lvp'], 0.1).ok).toBe(true);
    for (let i = 0; i < 200 && prop.ownership?.renovation; i++) advanceDay(state);

    const t = buildTimeline(state);
    expect(t.lanes).toHaveLength(1);
    const reno = t.lanes[0].spans.find((s) => s.kind === 'renovating');
    expect(reno).toBeTruthy();
    expect(reno!.from).toBeGreaterThanOrEqual(startDay);
    // It cannot claim work happened after the job ended.
    expect(reno!.to).toBeLessThanOrEqual(state.day);
  });

  it('marks a listing period only while genuinely listed', () => {
    const state = createGame('sandbox', 26);
    const prop = cheapest(state);
    buy(state, prop);

    let t = buildTimeline(state);
    expect(t.lanes[0].spans.some((s) => s.kind === 'listed')).toBe(false);

    listForSale(state, prop.id, Math.round(prop.appraisal.point * 1.5));
    for (let i = 0; i < 20; i++) advanceDay(state);
    t = buildTimeline(state);
    expect(t.lanes[0].spans.some((s) => s.kind === 'listed')).toBe(true);
  });

  it('closes the lane on sale and records the result', () => {
    const state = createGame('sandbox', 27);
    const prop = cheapest(state);
    buy(state, prop);
    listForSale(state, prop.id, Math.round(prop.appraisal.point * 0.9));

    let offerId: string | null = null;
    for (let i = 0; i < 400 && !offerId; i++) {
      advanceDay(state);
      offerId = prop.ownership?.saleListing?.offers[0]?.id ?? null;
    }
    if (!offerId) return;
    acceptOffer(state, prop.id, offerId);

    const t = buildTimeline(state);
    const lane = t.lanes[0];
    expect(lane.open).toBe(false);
    expect(lane.soldDay).not.toBeNull();
    expect(lane.profit).not.toBeNull();
    // And the hold span stops at the sale rather than running to today.
    const owned = lane.spans.find((s) => s.kind === 'owned')!;
    expect(owned.to).toBe(lane.soldDay);

    // "How long did it sit unsold" has to survive the sale, or the timeline
    // answers it only while the answer does not matter yet.
    const listed = lane.spans.find((s) => s.kind === 'listed');
    expect(listed).toBeTruthy();
    expect(listed!.to).toBe(lane.soldDay);
    expect(listed!.from).toBeGreaterThanOrEqual(owned.from);
  });

  it('draws no listing bar for a deal that predates the record of one', () => {
    // Older saves have no listedDay. Inventing one from the ledger would be a
    // guess rendered as a fact, so the bar is simply absent.
    const state = createGame('sandbox', 31);
    state.closedDeals.push({
      propertyId: 'old',
      address: '1 Legacy Way',
      neighborhoodId: 'riverside_flats',
      boughtDay: 10,
      soldDay: 90,
      purchasePrice: 100_000,
      salePrice: 150_000,
      closingCosts: 2_000,
      renovationSpend: 20_000,
      holdingCosts: 3_000,
      financingCosts: 0,
      commission: 9_000,
      concession: 0,
      netProfit: 16_000,
      roi: 0.5,
      daysHeld: 80,
      postMortem: null,
      before: null,
      after: null,
      replay: null,
    });

    const lane = buildTimeline(state).lanes.find((l) => l.address === '1 Legacy Way')!;
    expect(lane).toBeTruthy();
    expect(lane.spans.some((s) => s.kind === 'listed')).toBe(false);
    expect(lane.spans.some((s) => s.kind === 'owned')).toBe(true);
  });

  it('counts idle days, which profit-per-deal cannot show', () => {
    const state = createGame('sandbox', 28);
    // Thirty days doing nothing, then buy.
    for (let i = 0; i < 30; i++) advanceDay(state);
    const prop = cheapest(state);
    buy(state, prop);
    for (let i = 0; i < 10; i++) advanceDay(state);

    const t = buildTimeline(state);
    expect(t.idleDays).toBeGreaterThanOrEqual(29);
    expect(deploymentRate(t)).toBeLessThan(0.4);
    expect(describeDeployment(t)).toMatch(/idle/i);
  });

  it('orders lanes by when each deal started', () => {
    const state = createGame('sandbox', 29);
    const first = cheapest(state);
    buy(state, first);
    for (let i = 0; i < 25; i++) advanceDay(state);
    const second = cheapest(state);
    if (second && second.id !== first.id) {
      buy(state, second);
    }

    const t = buildTimeline(state);
    for (let i = 1; i < t.lanes.length; i++) {
      const prev = Math.min(...t.lanes[i - 1].spans.map((s) => s.from));
      const cur = Math.min(...t.lanes[i].spans.map((s) => s.from));
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });
});

