# Property Flipper — art delivery

Anchors for every placeable piece are in **ANCHORS.md** (and in a `_anchors.json` /
`_transforms.json` beside the files). An anchor is the pixel coordinate, inside that file's own
artboard, where the lot origin sits.

Ten archetype ids, matching the engine: bungalow, ranch, duplex, mill_loft, victorian, split_level,
new_build, colonial, condo, townhouse.

## art/houses/ — monochrome line set
10 archetypes + 40 condition overlays (distressed, occupied, working, finished).
128 x 128, pure #000000 stroke on transparent, two weights (2px contour / 1px interior), no fills.
Overlays share their base's transform exactly, so a state swap never moves the building.
Source: `_gen.js`. Known deviation: strokes are live stroke attributes, not outlined paths.

## art/houses-color/ — coloured set
10 archetypes + 40 condition overlays. 256 x 256. Flat-shaded: one base colour per material with
four derived values (roof-left x1.14, roof-right x0.86, left wall x1.08, right wall x0.80), warm lit
windows, fascia bands, chimneys, kerbed plinth with lawn, path and planting. Colour is baked, so
runtime recolour does not apply to this set. Source: `_gen_color.js`.

## art/houses-dusk/ · art/houses-autumn/ · art/houses-winter/
10 bases + 40 overlays each. Pure colour remaps of the coloured set, not redraws — dusk drops every
value to 52% and pushes it blue while the glass brightens; autumn rusts the greens; winter goes cold
and pale. Same anchors and transforms as houses-color.

## art/furniture/ (64px line) · art/furniture-color/ (96px colour)
14 pieces each, same geometry, both anchored: tree_oak, tree_pine, tree_slim, driveway, fence, hedge,
pool, skip, permit_board, sold_sign, for_sale_sign, rival_hoarding, parked_car, street_lamp.
Both sets are now generated from one description in `_gen_color.js`, which is why the anchors agree.

## art/scout/ · art/scout-line/
Six board sprites (coloured in `scout/`, monochrome line in `scout-line/` for the line board) — idle, walking, digging, two frames each — isometric, standing on the ground
plane, 64 x 64, anchored at the ground contact point.
Six mood portraits (briefing, explaining, pointing, warning, approving, disappointed) and four NPC
avatars (appraiser, lender, rival, inspector) at 320 x 320. One parametric bust rig: mood is carried
by brow height and angle, eyelid, mouth curve, ear droop and head tilt.

## art/icons/ — 22
24px grid, 1.5 stroke, round caps and joins, single colour, Lucide-compatible names.

## art/press/ — transparent, no paper ground
`charset.svg` — the full drawn face: A-Z, 0-9, % . , ' - : $ ! ? /. No font dependency.
`masthead-the_weekly_plat.svg` (760 x 190) with its kicker now switched on.
Ten headline plates at 680 x 140: rates_cut, rates_spike, boom, slump, school_rezoning,
revitalization, lumber_spike, labor_shortage, permit_backlog, employer_exit.
(plate-zoning_shift and plate-mill_rezoned are gone — replaced by school_rezoning and
revitalization, redrawn rather than renamed, so the words match the events.)
`cover-630x500.svg` — the itch.io cover. A poster, not isometric, and the one file that
deliberately carries a ground.

## art/index.html
Open it in a browser: every file in the delivery at its real size, grouped by folder and captioned
with its filename. Nothing to install.

## Format
SVG throughout. Paths only, explicit viewBox, origin top-left, no <image>, no fonts, no external
references, no id attributes.

## Generators
`_gen.js` (line houses + overlays), `_gen_color.js` (coloured houses, overlays, furniture),
`_gen_scout.js` (board sprites, coloured and line from one description),
`_type.js` (the wood-type face and the plate layout). Anchors are re-derivable from these — nothing
was measured by hand.
