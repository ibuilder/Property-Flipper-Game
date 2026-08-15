# Property Flipper — art delivery

Two complete sets. Pick one before extending either.

## art/houses/ — monochrome line set (original brief)
7 archetypes + 28 condition overlays. Pure #000000 stroke on transparent, two weights
(2px contour / 1px interior), 128x128 artboard, recoloured at runtime. Source: `_gen.js`.
Known deviation: strokes are live stroke attributes, not outlined paths.

## art/houses-color/ — coloured set (reference-matched)
7 archetypes + 28 condition overlays. 256x256 artboard. Flat-shaded: one base colour per material
with four derived values (roof-left x1.14, roof-right x0.86, left wall x1.08, right wall x0.80),
warm lit windows, fascia bands, chimneys, kerbed plinth with lawn, path and planting.
Colour is baked, so runtime recolour and the two themes do not apply to this set.
Source: `_gen_color.js`.

## art/houses-dusk/ · art/houses-autumn/
7 each. Colour remaps of the coloured bases, not redraws — dusk drops every value to 52% and pushes
it blue while the glass brightens; autumn rusts the greens. Winter follows the same pattern.

## art/furniture-color/ (14) · art/furniture/ (14 line)
Trees x3, driveway, fence, hedge, pool, skip, permit board, sold sign, for-sale sign,
rival hoarding, parked car, street lamp. 96px artboards, same projection and scale.

## art/scout/ — 6 moods + 4 NPC cast
One parametric bust rig. Mood is carried by brow height and angle, eyelid, mouth curve, ear droop
and head tilt; nothing else moves. 320x320. Cast: appraiser, lender, rival, inspector.
Not yet delivered: the 3 isometric board sprites (idle / walking / digging, 2 frames each).

## art/icons/ — 22
24px grid, 1.5 stroke, round caps and joins, single colour. All 22 use Lucide-compatible names;
swap any for the Lucide original rather than carrying your own.

## art/press/ — 1 masthead + 6 headline plates
Condensed wood-type drawn as outlined paths, no font dependency. Uppercase A-Z only —
digits and punctuation glyphs are not drawn yet, which is why the masthead kicker has gaps.

## Format
SVG throughout. Paths only, explicit viewBox, origin top-left, no <image>, no fonts, no external
references, no id attributes on internal elements. Overlays share their base's transform exactly,
so a state swap never moves the building.

## Screens built on the set
- `Board Screen.dc.html` — 3x3 block, click a lot, underwriting panel, Scout coaching, state machine
- `Style Guide.dc.html` — construction rules, palette, full asset index
- `Coloured Houses.dc.html` · `Property Flipper Art.dc.html` · `Colour Test.dc.html` — delivery boards
