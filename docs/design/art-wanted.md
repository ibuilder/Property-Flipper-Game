# Art still wanted — Property Flipper

Written to be forwarded as-is. Everything here is additive to what has already
been delivered; nothing already drawn needs redrawing.

Ordered by what unblocks the game soonest. Item 1 is a correctness problem —
the game currently shows the wrong house for three of its seven house types.
Item 2 is a number, not a drawing, and unblocks 28 files that are already drawn.

**Universal rules** (unchanged from the main brief, repeated because they are
the ones that have bitten):

- SVG only. Explicit `viewBox`, origin top-left, paths only, no `<image>`, no
  fonts, no external references, no `id` attributes.
- **Ship an anchor for every piece**: where the lot origin sits inside the
  artboard, as a pixel coordinate. A list in a README is fine. Without it the
  piece cannot be placed, however good it is.
- Isometric where it stands on the ground: `x = 0.7071·(gx+gy)`,
  `y = 0.3748·(gy−gx)`, viewed from the south-east, two wall faces.
- Deliver press and interface art on **transparent**, never on a paper ground.

---

## 1. Three missing house archetypes — 30 files

The engine generates seven archetypes. Four have art. These three do not, and
are currently borrowing another type's drawing, so a colonial is wearing a split
level's roof.

The ids are fixed by `src/engine/content.ts` and the filenames must match them
exactly — this is precisely where the last delivery went wrong.

| id | beds / baths | size | era | what it is |
| --- | --- | --- | --- | --- |
| `colonial` | 4 / 3 | 2000–2800 sqft | 1960–1999 | Two storeys, symmetrical front, centred door, shutters, restrained |
| `condo` | 2 / 1 | 650–1050 sqft | 1975–2015 | Small unit in a larger block; read as one of many, not a house |
| `townhouse` | 3 / 3 | 1400–1900 sqft | 1985–2010 | Three storeys, narrow frontage, attached on both sides, garage below |

**1a — line set, 15 files**, matching `art/houses/`:
`house-colonial.svg`, `house-colonial-distressed.svg`, `-occupied`, `-working`,
`-finished`, and the same five each for `condo` and `townhouse`.
128 × 128 artboard, `#000000` stroke on transparent, two weights (2px contour,
1px interior), no fills. States are **overlays** on the base, sharing its exact
transform.

**1b — coloured set, 15 files**, matching `art/houses-color/`:
same names, 256 × 256, flat-shaded in the established palette, with the kerbed
plinth and lawn as the existing seven have. Add the three entries to
`_transforms.json` (`k`, `tx`, `ty`).

If `_gen.js` and `_gen_color.js` are extended to produce these, that is ideal —
the anchors are then re-derivable and nothing has to be measured by hand.

### Optional, and genuinely optional

The three drawings already delivered that no archetype uses — `mill_loft`,
`split_level`, `new_build` — are good and are being kept. If you would rather
add those ids to the game than draw three new houses, say so: it is a content
change on our side and roughly the same amount of work. Either answer is fine;
what does not work is the current state, where the two lists disagree.

---

## 2. Furniture anchors — no drawing, 28 numbers

Fourteen pieces have now arrived twice — a line set on 64 × 64 and a coloured
set on 96 × 96 — and neither carries an anchor. Both sets are compiled into the
game and **neither can be placed**, because "where on the lot does this stand"
is not recoverable from the file.

Needed: for each of the 28 files, the pixel coordinate inside its artboard where
the lot origin sits. That is all. This is the cheapest outstanding item on the
whole commission.

Pieces: `tree_oak`, `tree_pine`, `tree_slim`, `driveway`, `fence`, `hedge`,
`pool`, `skip`, `permit_board`, `sold_sign`, `for_sale_sign`, `rival_hoarding`,
`parked_car`, `street_lamp`.

---

## 3. Scout's board sprites — 6 files

Flagged as not delivered in the last package. Scout is the coaching character: a
working dog in a hard hat, dry and competent, never cute.

`scout-idle-1.svg`, `scout-idle-2.svg`, `scout-walking-1.svg`,
`scout-walking-2.svg`, `scout-digging-1.svg`, `scout-digging-2.svg`.

Isometric, standing on the ground plane, same projection as the houses, and
sized to stand beside a house on a 36px lot without overpowering it. Two frames
each, meant to alternate. Anchor required, as above.

---

## 4. Press — a charset and four plates

**4a — digits and punctuation for the wood-type.** The condensed face is drawn
for uppercase A–Z only. No plate can currently carry a rate, a percentage or a
date, which rules out most of what a market paper prints. Needed: `0–9`, and
`% . , ' - :`.

This is why the masthead's kicker is currently switched off — it renders with
holes in it.

**4b — four more headline plates**, 680 × 140, transparent, matching the six
delivered. These are the market events with no plate:

| event id | what it is |
| --- | --- |
| `lumber_spike` | Material costs jump |
| `labor_shortage` | Crews scarce, jobs run long |
| `permit_backlog` | The city stops issuing on time |
| `employer_exit` | A major employer leaves town |

**4c — two renames, or two redraws.** `plate-zoning_shift` and
`plate-mill_rezoned` name events this game does not have. The nearest are
`school_rezoning` and `revitalization`. Renaming the files is enough if the
drawn words suit; if the plates literally read MILL REZONED then they need
redrawing, because a plate contradicting the story under it is worse than no
plate. Both are unused until this is settled.

---

## 5. Lower priority, only if you want to

- **A winter house set**, 7 base drawings, to complete the seasonal remaps
  alongside `houses-autumn` and `houses-dusk`.
- **Condition overlays for the autumn and dusk remaps**, 28 each. Without them
  those sets are base-only and cannot drive the board, which shows houses being
  renovated, let and listed. Not needed if the remaps are only ever decorative —
  and if they are pure colour transforms of the base, we can derive the overlays
  here rather than have them drawn.
- **A cover image**, 630 × 500, for the itch.io page. Not isometric; this one is
  a poster.

---

## What is emphatically not wanted

Redraws of anything already delivered. The seven line archetypes, the 28 line
overlays, the coloured set, the 22 icons, Scout's six moods, the four NPC faces
and the masthead are all in the game and working. The only change any of them
needs is the anchor list in item 2.
