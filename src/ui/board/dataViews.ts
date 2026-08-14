import { NEIGHBORHOODS_BY_ID, type GameState, type Property } from '../../engine';

/**
 * The four overlays, as pure functions of a parcel and the world.
 *
 * Each answers one question, and the handoff's framing is worth keeping: they
 * are not four colour schemes, they are four *questions*, and the switch
 * between them is the player asking a different one. Colour is a data channel
 * here rather than decoration, which is why every view returns a step on one
 * shared ramp instead of a colour of its own.
 *
 * Pure and step-valued so they can be unit tested without rendering anything,
 * and so the ramp stays the single place a magnitude becomes a colour.
 */

export interface Parcel {
  gx: number;
  gy: number;
  neighborhoodId: string;
  /** The listing or holding standing on this lot, if any. */
  property: Property | null;
}

export type DataViewId = 'value' | 'rehab' | 'rival' | 'mine';

export interface DataView {
  id: DataViewId;
  label: string;
  /** The question it answers, shown under the switch. */
  question: string;
  step: (parcel: Parcel, state: GameState) => number;
}

/** Clamp into the 8-step ramp. */
const clamp = (n: number): number => Math.max(0, Math.min(7, Math.round(n)));

/** Effective price per square foot for a neighbourhood, index folded in. */
function pricePerSqft(neighborhoodId: string, state: GameState): number {
  const base = NEIGHBORHOODS_BY_ID[neighborhoodId]?.pricePerSqft ?? 100;
  return base * (state.world.neighborhoodIndex[neighborhoodId] ?? 1);
}

export const DATA_VIEWS: DataView[] = [
  {
    id: 'value',
    label: '$/sqft',
    question: 'What will the street pay, and where is it moving?',
    /*
     * The handoff's mapping is `(ppsf - 60) / 20`, which is calibrated for its
     * own four districts. Ours run from about $78 to $330, so that formula
     * pins half the town at step 7 and tells the player nothing. Same idea,
     * our range: the ramp spans the actual spread of the town.
     */
    step: (parcel, state) => clamp((pricePerSqft(parcel.neighborhoodId, state) - 70) / 34),
  },
  {
    id: 'rehab',
    label: 'Condition',
    question: 'Where is the rehab money, lot by lot?',
    // Inverted: a wrecked house is a *high* number here, because the question
    // is where the work is, not where the nice houses are.
    step: (parcel) => (parcel.property ? clamp((1 - parcel.property.condition) * 7) : 0),
  },
  {
    id: 'rival',
    label: 'Rivals',
    question: 'Who is buying volume instead of margin?',
    step: (parcel) => {
      const listing = parcel.property?.listing;
      if (!listing) return 0;
      // Competition is already 0-1 on the listing: how much rival attention it
      // draws. A hot listing is one you will have to overpay to win.
      return clamp(listing.competition * 7);
    },
  },
  {
    id: 'mine',
    label: 'My comps',
    question: 'What has my own work done to the block?',
    step: (parcel, state) => {
      const sold = state.closedDeals.filter((d) => d.neighborhoodId === parcel.neighborhoodId);
      if (sold.length === 0) return 0;
      // Every finished flip lifts the block a step, saturating at the top.
      return clamp(2 + sold.length * 2);
    },
  },
];

export const DATA_VIEWS_BY_ID: Record<DataViewId, DataView> = Object.fromEntries(
  DATA_VIEWS.map((v) => [v.id, v]),
) as Record<DataViewId, DataView>;
