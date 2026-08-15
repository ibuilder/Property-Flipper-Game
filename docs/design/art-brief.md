# Art commission — Property Flipper

Everything an illustrator needs to quote for and deliver the art. Written to be
handed over as-is.

**What the game is.** A real-estate underwriting simulation that is also a
teaching tool: you buy a house, work out what it is worth, renovate it and sell
it, and the game shows you every number it used. It is played on desktop and
tablet, ships as a web build and a desktop app, and is used both for fun and in
a classroom.

**What already exists.** Placeholder art is in the game now and is rendered in
`art-placeholders.svg` alongside this file, at the exact size it appears
on screen. **It is there to show the slots, the scale and the projection — not
the standard.** Replace it. Do not match it.

---

## 1. House style

The whole interface is drawn as construction documents: a blueprint aesthetic,
hairline borders, square corners, one steel-blue accent on a dark ground with a
light-paper alternative. The art has to belong to that.

- **Line drawings.** No fill, no gradients, no texture, no shadows.
- **Two weights only:** 2px outer contour, 1px interior detail, at the sizes
  given below.
- **Monochrome.** Everything is drawn in a single colour and recoloured at
  runtime — deliver in pure black `#000000` on transparent.
- **No baked-in colour of any kind**, including for materials. A brick house
  and a clapboard house are told apart by line, not by hue.
- Think measured drawing or patent illustration rather than game asset.

The one thing to get right: these are read at a glance, in a grid, while the
player is deciding which house to look at. **Silhouette carries the meaning.**
A duplex must not be mistakable for a bungalow at 40 pixels.

---

## 2. Deliverables

### 2a. House archetypes, axonometric — **7 drawings** — **delivered, but against the wrong list**

The core of the commission. Seven drawings arrived and are on the board.

**This brief asked for the wrong seven ids, and that is our error, not the
artist's.** The list below was taken from the placeholder module rather than
from `src/engine/content.ts`, which is what actually decides the archetype of
every house the game generates. Both lists are seven long, so the test guarding
coverage — which counted drawings rather than comparing ids — passed throughout.

| id | What it is | status |
| --- | --- | --- |
| `bungalow` | Single storey, low pitched roof, front porch | delivered, in use |
| `ranch` | Long, low, wide footprint, shallow hip roof | delivered, in use |
| `duplex` | Two storeys, two front doors, plain | delivered, in use |
| `victorian` | Tall, steep gable, bay window, ornament | delivered, in use |
| `mill_loft` | Converted industrial, tall, flat roof, big windows | delivered, **no such archetype** |
| `split_level` | Staggered floors, offset roofline | delivered, **no such archetype** |
| `new_build` | Contemporary, mono-pitch roof, clean rectangles | delivered, **no such archetype** |

**Still to draw — these are the ids the game actually generates:**

| id | What it is | currently wearing |
| --- | --- | --- |
| `colonial` | Four bed, symmetrical front, 1960–1999, traditional | `split_level` |
| `condo` | Small, 650–1050 sqft, one of many units, 1975–2015 | `mill_loft` |
| `townhouse` | Three storeys, narrow, attached, 1985–2010 | `new_build` |

The three delivered drawings with no archetype are being used as stand-ins so
that no house falls back to a generic blob, and the substitutions are chosen on
era and massing. They are a stopgap: a colonial is currently wearing a split
level's roof. The three drawings above are the outstanding commission, and they
need the same base-plus-four-overlays treatment as everything else.

The three orphans are worth keeping. If `mill_loft`, `split_level` or
`new_build` are ever added to `content.ts` they are already drawn.

- **Projection:** true isometric. The board uses a 58° tilt with the ground
  rotated 45°, which flattens to screen as `x = 0.7071·(gx+gy)`,
  `y = 0.3748·(gy−gx)`. In practice: draw to a standard 2:1 isometric grid and
  it will sit correctly.
- **Viewed from:** the south-east. Two wall faces visible, never four.
- **Footprint:** fits inside a 36 × 36px lot diamond. Height above the lot is
  yours to judge per archetype — the mill loft should tower over the bungalow.
- **Canvas:** 128 × 128px artboard, house centred, so it can be scaled down.

### 2b. Condition states — **4 per archetype, 28 total** — **delivered**

Same footprint every time. These are drawn as **swappable overlays** on the
base drawing, not as four separate houses, so a lot can change state without
the building appearing to move.

Delivered and wired. The overlay is inked in the accent while the building
stays in the text colour, so the state of a lot reads at town zoom without
having to read the house. One overlay shows at a time, in the order
`working` > `occupied` > `distressed` > `finished`: they compose cleanly in
geometry, but several of them put furniture in the same driveway, and two
boards in one drive reads as a bug rather than as two facts.

| state | What it shows |
| --- | --- |
| `distressed` | Boarded windows, gaps in the roofline, overgrowth |
| `occupied` | Curtains, a car, signs of life — the previous owner is still in |
| `working` | Scaffolding, a skip in the drive, materials stacked |
| `finished` | Clean, a sold board, tidy planting |

`working` and `distressed` matter most: they are how the board shows, at a
glance, which of your houses is costing you money today.

### 2c. Lot furniture — **14 small pieces** — **delivered, not yet placed**

Trees (3 varieties), driveway, fence, hedge, pool, skip, permit board, sold
sign, for-sale sign, rival hoarding, parked car, street lamp. Same projection,
sized to sit on a 36px lot beside a house.

All fourteen arrived and are carried in the bundle, but nothing is placed yet,
because **where on the lot each piece stands is not recoverable from the files**
— see the anchor note in section 3. The houses solved this by shipping their
generator, from which the lot origin can be re-derived; the furniture came
without one. Placing them by eye would put a street lamp in a different spot at
every zoom. What is needed is one number per piece: where the lot origin sits
inside its 64 × 64 artboard.

### 2d. Scout — **6 portraits + 3 sprites**

Scout is the coaching character: a working dog in a hard hat who has been on
more sites than the player has. **Not a mascot.** He is the tradesman who has
seen this exact mistake before and says so once, plainly, before you make it.
Dry, competent, unimpressed. He does not wink and he is never cute.

Six bust portraits, 320 × 320px, one per mood: `briefing`, `explaining`,
`pointing`, `warning`, `approving`, `disappointed`. Hard hat and clipboard.
They must be distinguishable as thumbnails at 34px, which is where they
actually appear.

Three isometric sprites for the board, 2 frames each: idle, walking, digging.

### 2e. Icons — **22**

Lucide-compatible line icons at 1.5 stroke weight: ruler, hammer, hard-hat,
file-text, trending-up, trending-down, gavel, key, users, badge-check, clock,
banknote, percent, alert-triangle, home, wrench, clipboard-check, calendar,
map-pin, scale, search, layers. If Lucide already has a good one, say so and we
will use it rather than pay for a redraw.

### 2f. Newspaper mastheads — **7**

One for *The Weekly Plat* (the in-game paper) plus six headline plates for
market events. Condensed serif or slab, engraved feel.

---

## 3. Format and delivery

- **SVG only.** No PNG, no raster, at any stage.
- One file per asset, named by the ids in this brief: `house-bungalow.svg`,
  `house-bungalow-distressed.svg`, `scout-warning.svg`, `icon-hammer.svg`.
- Paths only. **Convert all strokes to outlined paths, and all text to paths.**
- No `<image>`, no embedded raster, no external references, no fonts — the game
  ships as one self-contained file with a strict content-security policy and
  will silently drop anything it has to fetch.
- No `id` attributes on internal elements (they collide when inlined).
- Origin at top-left of the artboard, with an explicit `viewBox`.
- Source files (AI, Figma, whatever you work in) delivered alongside.

**The anchor. Read this one twice — it is the thing that goes wrong.**

Tell us, for every piece, **where the lot origin sits inside its artboard**, as
a pixel coordinate. One line per file in a `README` is fine.

It is not enough to say the drawing is centred, because a taller house pushes
its own drawing up the artboard. In the first delivery every artboard was
centred on its own bounding box, which put the lot origin at a different height
in all seven files — a **15.5px spread on a lot diamond only 19px tall**. Placed
by artboard centre, the ranch hovered a storey up and the victorian sank into
the ground. It was recoverable only because the generator shipped with the art
and the anchor could be re-derived by running it.

A drawing is unusable without this number, however good it is.

**Licence:** full assignment or a perpetual, irrevocable, worldwide licence to
use, modify and sublicense as part of the game, including commercial release.
Say up front if that is a problem.

---

## 4. Scope and sequencing

If the whole thing is too large to take at once, this is the order that gets
the most value soonest, and each stage is usable on its own:

1. ~~**7 house archetypes**~~ — **delivered**, though against the wrong id list.
2. ~~**Condition states**~~ — **delivered**, all 28, and wired.
3. **The 3 missing archetypes** — `colonial`, `condo`, `townhouse`, base plus
   four overlays each, 15 drawings. This is now the top of the list: until they
   land, three of the seven house types the game generates are wearing another
   type's roof.
4. **Anchors for the 14 delivered furniture pieces** — no drawing needed, just
   the lot origin for each. Small, and it unblocks work already paid for.
5. **Scout's 6 portraits** — the coach is written and running; he has no face.
6. Icons, then mastheads.

Please quote per stage.

---

## 5. How to check your work before delivering

The honest test, and the one the placeholders fail: **shrink it to 40 pixels
wide and look at it next to the other six.** If you cannot tell which archetype
it is, the detail is in the wrong place. Everything in this brief is read small
and in a group.

---

## 6. Questions we expect, answered

**Can I use colour?** No. Everything is recoloured at runtime to match the
player's theme, and there are two themes.

**How much interior detail?** Enough to read at 40px and no more. Windows and
doors, yes. Individual bricks, no — they turn to mush and they cost you time.

**Perspective or isometric?** Isometric, strictly. Parallel lines stay
parallel. No vanishing point.

**Can the houses overlap their lot?** The roof may overhang slightly. The
footprint may not — lots sit next to each other on a grid and an oversized
footprint will collide with the neighbours.

**What about interiors?** Not in this commission. The game never goes inside.
