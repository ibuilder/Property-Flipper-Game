import { NEIGHBORHOODS, type GameState } from '../../engine';
import type { Parcel } from './dataViews';

/**
 * Where each neighbourhood sits on the board, and which lot each house takes.
 *
 * Six districts in a three-by-two arrangement with streets between them, laid
 * out by hand rather than generated: the town is fictional, and what the
 * arrangement has to encode faithfully is adjacency and character, not
 * geography. Riverside and Harbor Point are on opposite edges because the
 * river runs between them; the Millworks sits against the industrial corner.
 *
 * Deterministic placement matters more than it looks. A house has to stay on
 * the same lot between renders and between sessions, or the board becomes a
 * shuffling puzzle rather than a map — so lots are assigned by walking the
 * district's cells in a fixed order and filling them with whatever the engine
 * lists in its own fixed order.
 */

export interface District {
  id: string;
  gx: number;
  gy: number;
  w: number;
  h: number;
}

/** Streets run between the blocks, on these grid lines. */
export const STREETS = { cols: [5, 11], rows: [6, 7] };

export const DISTRICTS: District[] = [
  { id: 'old_town', gx: 0, gy: 1, w: 5, h: 5 },
  { id: 'the_grid', gx: 6, gy: 1, w: 5, h: 5 },
  { id: 'harbor_point', gx: 12, gy: 1, w: 5, h: 5 },
  { id: 'riverside_flats', gx: 0, gy: 9, w: 5, h: 5 },
  { id: 'maple_heights', gx: 6, gy: 9, w: 5, h: 5 },
  { id: 'millworks', gx: 12, gy: 9, w: 5, h: 5 },
];

/** Districts the current campaign actually uses, in board order. */
export function activeDistricts(state: GameState): District[] {
  const live = new Set(Object.keys(state.world.neighborhoodIndex));
  return DISTRICTS.filter((d) => live.has(d.id) && NEIGHBORHOODS.some((n) => n.id === d.id));
}

/**
 * Every lot on the board, with whatever stands on it.
 *
 * Listings first, then holdings, so a house the player owns keeps a lot even
 * once it has left the market. Empty lots are still parcels: the data overlays
 * colour the ground, not just the houses, and a district with nothing for sale
 * still has a price per square foot worth seeing.
 */
export function buildParcels(state: GameState): Parcel[] {
  const out: Parcel[] = [];

  for (const district of activeDistricts(state)) {
    const here = [
      ...state.market.filter((p) => p.neighborhoodId === district.id),
      ...state.portfolio.filter((p) => p.neighborhoodId === district.id),
    ];

    let i = 0;
    for (let dy = 0; dy < district.h; dy++) {
      for (let dx = 0; dx < district.w; dx++) {
        out.push({
          gx: district.gx + dx,
          gy: district.gy + dy,
          neighborhoodId: district.id,
          property: here[i] ?? null,
        });
        i++;
      }
    }
  }

  return out;
}
