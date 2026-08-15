# Art still wanted — Property Flipper

Written to be forwarded as-is. Everything here is additive to what has already
been delivered; nothing already drawn needs redrawing.

Ordered by what unblocks the game soonest. Item 1 is a correctness problem —
the game currently shows the wrong house for three of its seven house types.
Item 2 is a list of numbers rather than a drawing, and unblocks 14 files that
are already drawn.

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

## 2. Furniture anchors — 14 numbers, and only for the line set

**Correction to an earlier version of this list, which asked for 28.** The
coloured furniture turned out not to need anything: it was delivered in world
coordinates, sharing the houses' origin and unit, with each piece's own fit
wrapped around it. It is placed and on the board.

The line set is the one that cannot be placed. Every piece is centred on its own
bounding box inside its 64 × 64 artboard, and centring is exactly what destroys
the information needed — a fence belongs on a boundary and a driveway at the
kerb, and once both are centred they are the same drawing as far as placement
goes.

Needed: for each of the 14 line files, the pixel coordinate inside its artboard
where the lot origin sits. No redraw.

**Better still**, if it is no more work: deliver the line furniture the way the
coloured furniture came — in world coordinates on the shared grid, with the
per-piece fit as a wrapping transform. Then there is nothing to send separately
and nothing to keep in sync.

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

## 4d. Two icons that would unlock a whole list

The renovation scope is grouped under eight category headings — `cosmetic`,
`kitchen`, `bath`, `systems`, `exterior`, `structural`, `addition`, `staging` —
over a long checklist that is the most-scanned list in the game. Marks would
help it a lot. Six of the eight have a good match in the 22 delivered icons;
**`kitchen` and `bath` have none**, and marking six of eight reads as broken
rather than partial, so none of them are marked.

Two icons, same 24px grid and 1.5 stroke as the rest: a `kitchen` (range or
cabinet run) and a `bath` (tub or basin). Smallest item on this list by effort,
and it is the difference between that checklist being marked and not.

---

## 5. Lower priority, only if you want to

- **A winter house set**, 7 base drawings. Winter currently borrows the dusk
  remap, which is an evening light rather than a season — cold and blue at about
  half value, so it passes for a winter afternoon far better than high-summer
  green does, but it is a stand-in.
- ~~**Condition overlays for the autumn and dusk remaps**~~ — **not needed.**
  The remaps turned out to be near-perfect colour substitutions of the base:
  same path count and order, thirteen of a hundred and two paths genuinely
  redrawn for the planting, and a colour mapping that is completely consistent
  across all seven archetypes. So the bases are used exactly as drawn and the
  overlays are carried into season by applying the same substitution. Both
  seasons are on the board now with all four condition states.
- **A cover image**, 630 × 500, for the itch.io page. Not isometric; this one is
  a poster.

---

## What is emphatically not wanted

Redraws of anything already delivered. The seven line archetypes, the 28 line
overlays, the coloured set, the 22 icons, Scout's six moods, the four NPC faces
and the masthead are all in the game and working. The only change any of them
needs is the anchor list in item 2.
