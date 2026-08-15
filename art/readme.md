# Property Flipper — art delivery

Stage 1 (7 house archetypes) and stage 2 (28 condition-state overlays). 35 SVGs in `houses/`.

## Naming
`house-<id>.svg` — base drawing
`house-<id>-<state>.svg` — overlay, states: distressed, occupied, working, finished

ids: bungalow, ranch, duplex, mill_loft, victorian, split_level, new_build

## Conformance with the brief
- True isometric, x = 0.7071(gx+gy), y = 0.3748(gy-gx); viewed from the south-east, two wall faces.
- 128 x 128 artboard, explicit viewBox, origin top-left, house centred.
- Footprint inside the 36px lot diamond; only eaves overhang.
- Two weights: 2px outer contour, 1px interior detail.
- Pure #000000 stroke on transparent. No fills, gradients, shadows, texture, baked material colour.
- No <image>, no fonts, no text, no external references, no id attributes.
- Overlays share the base drawing's origin and transform exactly, so state swaps do not move the building.

## Known deviation, flagged not hidden
Strokes are live `stroke` attributes, not outlined paths. This keeps the line weight correct at every
scale and makes runtime recolour a single attribute swap. Outlining to filled paths is a mechanical
conversion if the pipeline requires it.

## Source
`_gen.js` is the source file: each archetype is a parametric solid (footprint, wall height, roof type,
window schedule) and every overlay is a function of that solid. Change a pitch or a footprint there and
all five files for that archetype regenerate consistently.
