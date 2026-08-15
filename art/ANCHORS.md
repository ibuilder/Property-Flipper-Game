# Anchors

**What an anchor is.** The pixel coordinate, inside that file's own artboard, where the **lot origin**
sits — grid point (gx=0, gy=0, z=0) under the projection x = 0.7071(gx+gy), y = 0.3748(gy-gx).
Draw the piece with its anchor placed on the lot's origin and it lands correctly, every time.

For **Scout's board sprites** there is no lot origin, so the anchor is the **ground contact point**:
where the dog's feet meet the ground plane.

Every number below is also machine-readable in a `_anchors.json` beside the files
(`_transforms.json` for the coloured houses, which additionally carries the scale).

---

## Houses — line set (`art/houses/`, 128 x 128)

Overlays share their base's anchor exactly. One anchor per archetype covers all five files.

| archetype | anchor x | anchor y |
| --- | --- | --- |
| bungalow | 45.6 | 73.4 |
| ranch | 44.9 | 69.7 |
| duplex | 46 | 78.2 |
| mill_loft | 46 | 85 |
| victorian | 46 | 85.2 |
| split_level | 46 | 77.5 |
| new_build | 46 | 79.4 |
| colonial | 45.8 | 76.4 |
| condo | 45.8 | 78.6 |
| townhouse | 46 | 76.9 |

## Houses — coloured set (`art/houses-color/`, 256 x 256)

The coloured drawings are fitted with a scale as well as a translate. `anchor` is the lot origin in
artboard pixels; `scale` is given in case you need to re-derive anything in grid units.
The seasonal remaps (`houses-dusk`, `houses-autumn`, `houses-winter`) reuse these numbers exactly.

| archetype | anchor x | anchor y | scale |
| --- | --- | --- | --- |
| bungalow | 22.510126420178633 | 169.62753507014554 | 2.762715566969452 |
| ranch | 12.205607476635521 | 153.0782342515236 | 2.888175852118347 |
| duplex | 39.504851735135645 | 181.9313612011623 | 2.3176340573355008 |
| mill_loft | 52.57814634276991 | 191.39615341350404 | 1.975252430564855 |
| victorian | 53.909651329429444 | 192.36013521049267 | 1.9403811255825976 |
| split_level | 34.7159917501689 | 179.59460132813805 | 2.4021645603564936 |
| new_build | 37.78178669194207 | 180.68389810240728 | 2.3627600818171755 |
| colonial | 37.7 | 180.6 | 2.3641 |
| condo | 45.4 | 186.3 | 2.1594 |
| townhouse | 39.7 | 182.1 | 2.3123 |

## Lot furniture — line set (`art/furniture/`, 64 x 64)

| piece | anchor x | anchor y | scale |
| --- | --- | --- | --- |
| tree_oak | -29 | 61 | 1.6065 |
| tree_pine | -25.7 | 61 | 1.5104 |
| tree_slim | -17.6 | 61 | 1.2933 |
| driveway | -2.5 | 32 | 0.9042 |
| fence | -27.3 | 45.2 | 1.5523 |
| hedge | -15.3 | 38.1 | 1.2286 |
| pool | -4.3 | 32 | 0.9494 |
| skip | -16.3 | 40.5 | 1.2658 |
| permit_board | -41.6 | 61 | 1.9287 |
| sold_sign | -37.1 | 61 | 1.8084 |
| for_sale_sign | -37.1 | 61 | 1.8084 |
| rival_hoarding | -12.8 | 53.4 | 1.1745 |
| parked_car | -9 | 35.9 | 1.2055 |
| street_lamp | -10.6 | 58 | 1 |

## Lot furniture — coloured set (`art/furniture-color/`, 96 x 96)

| piece | anchor x | anchor y | scale |
| --- | --- | --- | --- |
| tree_oak | -44.6 | 92 | 2.4374 |
| tree_pine | -39.5 | 92 | 2.2917 |
| tree_slim | -27.2 | 92 | 1.9622 |
| driveway | -4.4 | 48 | 1.3718 |
| fence | -41.9 | 68 | 2.3551 |
| hedge | -24.1 | 57.4 | 1.8891 |
| pool | -7 | 48 | 1.4404 |
| skip | -25.3 | 61 | 1.9206 |
| permit_board | -63.7 | 92 | 2.9263 |
| sold_sign | -56.8 | 92 | 2.7438 |
| for_sale_sign | -56.8 | 92 | 2.7438 |
| rival_hoarding | -20 | 80.5 | 1.782 |
| parked_car | -14.2 | 53.8 | 1.8291 |
| street_lamp | -16.7 | 87.4 | 1.5172 |

## Scout board sprites (`art/scout/`, 64 x 64)

Ground contact point, identical across all six frames so they alternate without drift.

| sprite | anchor x | anchor y |
| --- | --- | --- |
| scout-idle-1 | 31 | 52 |
| scout-idle-2 | 31 | 52 |
| scout-walking-1 | 31 | 52 |
| scout-walking-2 | 31 | 52 |
| scout-digging-1 | 31 | 52 |
| scout-digging-2 | 31 | 52 |

Scout's six mood portraits and the four NPC avatars are UI busts, not board pieces — they have no
lot anchor and are placed by the interface, not the grid.
