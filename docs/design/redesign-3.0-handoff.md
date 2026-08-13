# Handoff: Property Flipper 3.0 — graphics, gameplay, UX and teaching upgrade

## Overview

An upgrade package for **ibuilder/Property-Flipper-Game** (https://github.com/ibuilder/Property-Flipper-Game, branch `main`, live at https://ibuilder.github.io/Property-Flipper-Game/).

The existing game is a genuinely good simulation: seeded RNG, a single `applyCash()` writer, a ledger that provably sums to cash, a bot-measured balance harness across 30 seeds, and an honest cost stack. **The simulation is not the problem and must not be re-balanced.** The problem is that the correct simulation is unreadable: a flat polygon map, teaching delivered as dismissible prose, figures with no visible provenance, an analyser that scrolls out of view as you change what it prices, consequences resolved as log lines, and no character to fail in front of.

This package upgrades three things and nothing else:

1. **Graphics** — an isometric, "survey plat" board where lots and houses are real objects you zoom into, and colour is a data overlay rather than decoration.
2. **Gameplay** — crew/contractor management, permits and inspectors, rival bidders, neighbourhood lift, market cycles, a market news beat, tenant stories in BRRRR, a mastery tree, and a class leaderboard.
3. **Teaching** — every number carries its live formula; a mutable coach character (Scout, a site-foreman dog) speaks at the decision point; a gated first-fifteen-minutes; a five-failure-mode curriculum with instructor read-outs.

Target audiences, in priority order: students in a class, self-taught first-time flippers, professionals wanting a sandbox, and casual tycoon players who learn by accident. Platform: desktop-first, tablet, **and phone-playable**.

## About the design files

The files in this bundle are **design references authored in HTML** — prototypes that demonstrate intended look, layout, information hierarchy and behaviour. They are **not production code to copy**.

The task is to **recreate these designs inside the existing Property-Flipper-Game codebase**, using its established environment and patterns: TypeScript, React, the pure `src/engine/` + `src/ui/` split, the `useVersion()` subscription model, and the single-file web bundle build. Do not port the prototype's inline styles or its `.dc.html` component runtime — those are artefacts of the design tool. Read the prototype for *what to build*; write it the way the repo already writes things.

Concretely: the prototype's economics are a simplified restatement of the real engine's, written to make the UI demonstrable. **Where the prototype and `src/engine/` disagree on a number, the engine is right.** Wire the real engine's values into the new UI.

## Fidelity

**High-fidelity.** Colours, type, spacing, layout, copy and interaction states are final and should be recreated faithfully. The exception is illustrative art: house archetypes, lot furniture and Scout's portraits appear in the prototype as hatched placeholder blocks, with a commissioning spec in `Upgrade Package.dc.html` (Sheet 03). Build the code so that art drops into those slots without layout changes.

## Design system

Everything uses the **Industry** design system — a wireframe/blueprint aesthetic: steel-blue accent on a light technical ground, Barlow Condensed headings over Barlow body, a modular grid, and cards/figures/buttons framed as square-cornered hairline-bordered "blueprint" objects with `+` registration marks at the corners.

The full token sheet is bundled at `_ds/styles.css` in this handoff. **Port the tokens, not the stylesheet** — map `--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*` into whatever the codebase already uses for theming.

Rationale worth keeping: a construction game drawn as construction documents. It is thematically exact, it is dramatically cheaper to art-direct than painted isometric, and it cannot be mistaken for a slot machine — which matters for classroom credibility.

### Non-negotiable visual rules

- Cards and figures are **line drawings**: transparent, 1px hairline border, square corners, four `+` corner marks. Never a surface fill, never a radius.
- The **solid accent primary button is the only filled object** on the board.
- One steel ramp carries every quantity. Ramp step = magnitude.
- **Hatching means "unknown"** — hidden defects, unpermitted work, stale comps. Same hatch, same meaning, everywhere: `repeating-linear-gradient(45deg, var(--color-neutral-400) 0 4px, transparent 4px 8px)`.
- **Red appears in exactly one place in the entire game**: a negative projected profit. Its scarcity is what makes it land. `#8a2f2f` on `#f7ecec`.
- Photographs go through the `.duotone` wrapper. Icons are Lucide at stroke-width 1.5.
- Never a browser-default focus ring: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`.

## Design tokens

### Colour

```
--color-bg          #f2f2f3    light technical ground
--color-text        #1d1f20
--color-accent      #5980a6    steel blue — the only accent (mono scheme)
```

Each role carries a 100–900 OKLCH ramp on a shared perceptual lightness scale: `--color-neutral-100…900`, `--color-accent-100…900`. Use 100–300 for tinted fills, hovers and subtle borders; 500 as base; 700–900 for text on tinted fills and pressed states. Prefer ramp steps over ad-hoc `color-mix()`.

Also used, and only for these purposes:

```
divider             var(--color-divider)     every hairline
loss red            #8a2f2f  on  #f7ecec     negative profit ONLY
dark section ground #1d2d3d  text #f2f2f3    pitch-deck dividers only
dark section accent #94bce3                  mono/formula text on dark
```

The isometric data ramp, used verbatim for parcel fills (index = magnitude step 0–7):

```js
const RAMP = ["#eef6ff","#d6ebff","#b5d9fd","#94bce3","#749dc4","#597ea3","#416180","#2c455d"];
```

Parcel border is `RAMP[step + 2]` (clamped to 7). Parcel extrusion is `box-shadow: 5px 5px 0 RAMP[step + 3]`.

### Type

```
--font-heading   Barlow Condensed    all headings, map labels, character names, big numbers in slide decks
--font-body      Barlow              all body copy, labels, UI text
mono             ui-monospace, Menlo, monospace    EVERY number and EVERY formula
```

The mono/proportional split is load-bearing, not decorative: **every figure and every formula is mono; everything else is not.** It is how the player's eye learns to find the numbers.

Scale as used in the prototype UI:

```
9–10px   / .14–.18em tracking / uppercase / neutral-600   micro labels above figures, sheet numbers
11px     mono                                             formula lines, meta, DOM, timestamps
12–13px  body                                             supporting copy, verdict lines, notes
14px     body                                             decision-row primary text
16px     Condensed                                        map pin address, crew name
18–22px  mono                                             HUD figures, section totals
24–26px  mono                                             verdict-plate profit figure
h2 / h4 / h5                                              from Industry's own scale
```

Minimum sizes: nothing below 24px on a 1920×1080 slide; 44px minimum hit target on phone.

### Spacing & geometry

Use `--space-1…8` (density 0.85× is baked in) and `--radius-*` (4px, but **cards, figures and buttons are square** — radius is only for the rare non-blueprint element). Never a raw px value the tokens already carry.

### Shadow

`--shadow-sm` on map pins, `--shadow-md` on the recall button, `--shadow-lg` on the coach card. Nothing else is elevated.

---

## The isometric board — exact spec

This is the single most important new piece of rendering. Put the projection maths in **one module**, `src/ui/board/projection.ts`, and have both the ground layer and the label overlay read from it.

```
tile          40 × 40 px   (lot = 36px square + 4px gutter)
grid          17 × 17 tiles = 680 × 680 px logical
projection    transform: rotateX(58deg) rotateZ(-45deg)
              applied to the GROUND layer only, with transform-style: preserve-3d
screen X      CX + 0.7071 × (x + y)
screen Y      CY + 0.3748 × (y − x)
              where x = gx × 40 + 20 − 340,  y = gy × 40 + 20 − 340
extrusion     box-shadow: 5px 5px 0 RAMP[step+3]  on lots that read as built
street        10px, --color-neutral-300, laid on the 8-tile line both axes
zoom          town 1.0  →  block 1.8  →  lot 3.2
```

**Labels and pins must live in a separate, untransformed overlay layer above the ground**, positioned with the same two projection lines. If you shear the lettering, the whole aesthetic collapses. In the prototype, district labels sit on a small paper plate (`background: var(--color-bg)`, 1px divider border, `2px var(--space-3)` padding) so they hold contrast against any data overlay recolouring the parcels beneath them.

### Four data views

Pure functions, `(parcel, state) => rampStep`, one per overlay, in `src/ui/board/dataViews.ts`. Trivially unit-testable; keep them pure.

| View | Question it answers | Mapping |
| --- | --- | --- |
| **$/sqft** | What will the street pay, and where is it moving? | `min(7, round((districtPpsf − 60) / 20))` |
| **Condition** | Where is the rehab money, lot by lot? | per-parcel condition → step 1–7 |
| **Rivals** | Who is buying volume instead of margin? | rival-active parcels step 6, others step 1 |
| **My comps** | What has my own work done to the block? | my finished flips step 7, others step 0 |

The switch is a square segmented control, one solid accent active state, no radius, `white-space: nowrap; flex: none` on each option so it never wraps. Persist the selection across zoom levels and sessions.

### Four districts (prototype content, mirror the engine's real values)

| District | $/sqft | Trend | Grid origin | Size | Character |
| --- | --- | --- | --- | --- | --- |
| Old Town | 190 | +1.2% | 1,1 | 4×4 | Retail value, no margin. Rehab costs bite. |
| Maple Heights | 132 | +0.4% | 9,1 | 5×4 | Bread-and-butter flips. Sells fast, carries cheap. |
| Riverside Flats | 95 | −0.6% | 1,9 | 5×4 | Softening. Six-month-old comps are lying to you. |
| The Millworks | 78 | +2.4% | 9,9 | 4×4 | Rising, but rehab-heavy and slow to resell. |

### Listing pins

Anchored to a lot, `transform: translate(-50%, -100%)`, with a 1px 18px accent-700 leader line down to the lot. The card is a blueprint object with `tl` and `br` corner marks only, `--shadow-sm`, `white-space: nowrap`, and three lines:

1. Kicker, 11px uppercase .1em — **the seller's motivation**, because motivation is the deal ("Distressed · tired landlord", "Trustee sale · Thu", "Rival under contract"). Accent-700 when actionable, neutral-600 otherwise.
2. Address, 16px Condensed.
3. `$154,572 · 42d` — mono 11px, ask and days-on-market.

Border goes `--color-accent-700` when actionable, `--color-divider` when not. Pins are focusable buttons — keyboard parity is required.

---

## Screens

Six top-level screens, presented as numbered drawing sheets ("1 · THE TOWN" … "6 · MASTERY"), because the sequence *is* the deal lifecycle and numbering it teaches the lifecycle. Tabs are Condensed, uppercase, .04em, with a 2px accent bottom border on the active one and no other decoration.

### Persistent chrome

**HUD (sticky top, z 40).** Left: a 22px accent-200 diamond (rotate 45°) + "PROPERTY FLIPPER" in Condensed 19px with "UNDERWRITING SIM · REV 3.0" beneath in 10px .16em uppercase. Centre, all mono 18px over 9px uppercase labels: Cash, Net worth, Day (`118 / 600`), and a **Market cycle** meter — an 8px hairline box with a repeating accent-200 dash fill and a 2px accent-700 playhead, labelled with the phase ("Late expansion"). Right: `+1 day`, `+1 week` secondary buttons and a `First 15 min` primary button. All buttons square (`border-radius: 0`).

**Right rail — "The Weekly Plat" (border-left, full height).** A newspaper masthead: 26px Condensed name under a 2px solid text-coloured rule, with "Kesslerville · Week 17 · day 118" in 10px uppercase. Then market news items — kicker (10px uppercase accent-700), headline (19px Condensed), body (12px muted), and critically **an effect line in accent-800 stating what it does to your board** ("Your carry cost per day: unchanged. Your exit window: shorter."). Below, a day-stamped event log in mono/body pairs.

The news beat is a teaching device, not flavour: every item names its mechanical consequence.

### 1 · The town

Purpose: choose where to hunt, and understand that cheap per square foot is not cheap to fix.

Layout: sheet header (sheet number, h2, one-line thesis) with the data-view switch right-aligned on the same baseline; the board in a full-width blueprint frame (`overflow-x: auto`, 440px tall, min-width 900px, with a 40px background grid); then four district cards in a wrapping row.

District card: blueprint frame, all four corner marks, name in h5 with the trend right-aligned in mono (accent-700 when positive), `$132` in mono 20px with a small `/sqft`, and the character note in 12px muted.

### 2 · The deal — the most important screen

Purpose: produce ARV, discover defects, scope work, and find the true maximum offer.

**This screen is the fix for the original's worst UX failure.** The original stacked eight sections vertically inside a scrolling modal, so the analyser left the viewport exactly when you changed what it priced. Here it is **two columns, and the analyser column is `position: sticky; top: 112px`** — decision and consequence always share a viewport.

Left column, in order, each a blueprint card:

- **Header** — address, a `Distressed` outline tag, then the facts in one muted line: "Maple Heights · Duplex · 4bd/2ba · 2,015 sqft · built 1956 · asking $154,572 · 42 days on market". A square `All cash` / `Hard money` segmented control sits right.
- **Exterior photograph** — 200px, duotoned, with a mono caption naming the shot ("exterior — 3/4 view, overcast, 16:9").
- **1 · Pick your comps** — five comps as decision rows. Teaching line: *"Your comp set sets ARV, and ARV sets everything downstream. Pick the ones that argue, not the ones that flatter."* Footer shows **ARV from your set** in mono 22px with its formula in accent-700 mono beneath, then a live warning plate: if the set runs >6% over the neighbourhood median, "Your set runs 12% over the median. Appraisals follow the median, not your optimism." (accent-200 ground); otherwise a reassurance on accent-100.
- **2 · Inspect before you offer** — three tiers as cards (Skip $0/0%, Standard $450/60%, Thorough $900/90%). Teaching line: *"Anything an inspection finds becomes a disclosure, and the seller concedes most of it. Anything it misses becomes a change order you pay for."* Below, **Found & disclosed** vs **Still hidden (est.)** as paired mono figures, and the known/unknown bar — solid accent-500 for found, 45° hatch for hidden.
- **3 · Scope the work** — two labelled groups, and the grouping is the lesson: *"Restores the house to what the comps assume"* and *"Above the comps — pays only if the street supports it"*. Optional items show a return ratio in their verdict line ("Returns 0.32× — buyers here discount pools"), accent-800 when below 1.0. Footer: scope total and work days, plus a live plate warning that skipped restore lines come off at closing at 1.15×.

Right column — **the analyser** (blueprint card on `--color-neutral-100`):

- Kicker: "LIVE · EVERY NUMBER SHOWS ITS WORK".
- **The two max offers, side by side.** `Rule of thumb — 70%` on a plain bordered plate; `Itemised — every real cost` on an accent-100 plate with an accent-700 border. Both in mono 22px with their formulas beneath. Then a **spread note** that explains the disagreement in words: "The rule is $3,471 conservative on this house — it carries cheaply and sells fast, so you can pay a little over 70% and still clear your margin." This is the single best teaching moment in the game; the 70% rule stops being a magic number and becomes a proxy you can audit.
- **The ledger** — ten rows, each `label · value` with the formula in 10px mono beneath: ARV, repairs, buy-side closing (2%), financing (2% points + 11.5% × 80% LTV × days/365), carry (days × $25/day), agent commission (6%), seller closing (1%), inspection, seller concession in (75% of disclosed), buyer concession out (1.15× repairs left undone). Negative values in accent-800.
- **Your offer** — a range slider, 0.40–1.00 of ARV, step 0.005, with mono end labels. The custom thumb is a 14×22px accent rectangle; the track is a 4px neutral-300 line. Square, not round — it reads as a drafting slide.
- **Verdict plate** — projected profit in mono 26px, its formula, and a plain-language verdict: "Room for one bad surprise, which is the whole job." / "Thin. One change order eats this." / "Underwater before a single surprise. Move the offer down, or walk." **This is the one element allowed to turn red.**
- Primary button: "Submit offer & open the site", with a muted note: "Seller reserve is hidden. A rejection costs one day."

### 3 · The site

Purpose: learn that crew choice is a schedule decision and schedule is carry.

Three crew cards, then a two-column body. Crews: **Bonded GC** (Fast, +22% cost, ×0.75 duration, rework 2%), **Your own crew** (Balanced, base, ×1.0, rework 8%), **Low bidder** (Cheap/slow, −18% cost, ×1.55 duration, rework 21%). Each shows the three trade-offs in one mono line so the comparison is unavoidable. Thesis line: *"Cheap and slow is a real cost, priced daily."*

Left: **Schedule** — a Gantt of task lanes; name (118px), a 16px lane with an accent-filled bar (1px accent-600 border), and `6d · $9,800` mono right. Footer: carry while open, permit ("Issued day 127 (11-day queue)"), inspection status.

Right: **Contingency** — remaining over total in mono 24px, a 12px hairline bar draining accent-500, and the lesson: *"When this runs out, change orders come straight out of cash — and out of your profit."* Below, **Change orders** with a `why` line that changes based on the inspection tier chosen two screens earlier — "Caught in inspection — seller conceded 75%" vs "Missed at inspection — full cost is yours". Consequence traced back to a decision.

### 4 · The sale

Purpose: internalise the traffic curve.

Left: **List price** in mono 24px with `% of ARV` beneath, a 0.90–1.16 slider, and a **14-bar traffic histogram** where the bar matching the current multiplier is solid accent and the rest are accent-200. Below: days on market, extra carry, net at close. A live note: "You are 6% over ARV. Traffic falls off a cliff above about 102% — that is 74 days and $1,850 of carry."

Traffic model in the prototype: `dom = min(240, round(16 × e^(14 × (mult − 0.98))))`. Replace with the engine's real curve; keep the exponential shape visible.

Right: **Or keep it — BRRRR.** The **binding-cap pair**: two bars, 75%-of-value and 1.20× debt service, each with amount and formula, and **the shorter one rendered solid** while the other is accent-300. "The lesser of two caps" becomes obvious without a sentence. Then cash pulled back, a note naming which cap bound and why, and a one-line tenant story ("Marisol T. — 3 yrs at her last place, 41% rent-to-income. Screens clean, pays on the 3rd.") that makes DSCR concrete.

### 5 · The book

Purpose: post-mortem. Four KPI cards (deals closed, avg net per flip vs underwritten, avg days held with carry as % of costs, **70% discipline "5 of 6" with what the break cost**), a holdings table, and a **waterfall post-mortem** — underwritten profit, each deduction as a floating bar, actual profit — closing with a sentence that names the largest line *and whose choice it was*: "The single largest line is the one you chose: 34 extra days on market at $28/day, because you listed 6% over ARV."

Read the losses first. Winners teach you nothing you did not already believe.

### 6 · Mastery

Four branches (Valuation, Scope & schedule, Leverage, Cycle & exit), three nodes each. Nodes are 12px diamonds — solid accent earned, accent-300 in progress, transparent with a neutral-400 border locked. **Every node names the proof, not a cost**: "Two deals inside 6% of median". Skills are earned by demonstration; there is no second currency and no point-spending.

Below: the **class board** (same seed for everyone, ranked on risk-adjusted return, so it compares decisions and not luck) and **instructor tools** — author a deal and share a code, section board, concept report as CSV, and lock the coach for assessment runs. The deal code is a plain string (`KSSLR-4B2-1956-TIRED-D3`) so nothing needs hosting.

---

## Scout — the dog companion

Per the brief: **an optional coach you can turn off once you know the game.**

### Character

A working dog in a hard hat who has been on more sites than you have. Not a mascot, not a tutorial pop-up, not a hint vending machine — the tradesman who has seen this exact mistake before and says so once, plainly, before you make it.

- **Voice:** short declarative sentences, trade vocabulary used correctly, dry. Never cute, never punning. He does not say "Woof." He says "Nothing appraises without a roof."
- **Never:** blocks input, repeats a line inside 20 game-days, celebrates a win, or explains something you have demonstrated twice.
- **Always:** names the number and shows the formula. Every line is falsifiable against the ledger.
- **Off switch:** Mute on the card, or Settings → Coach: off. Assessment runs force him off **and the save records it**, so an instructor knows which runs were unassisted.

### Card UI

Fixed bottom-left, `z-index: 60`, max-width 380px, blueprint frame on `--color-bg` with `--shadow-lg`. A 64px duotone portrait with a mono caption, then name in Condensed 18px + "· site foreman · warning" in 10px uppercase, a Mute control top-right, the line at 14px with `text-wrap: pretty`, the formula in 11px accent-700 mono, and a primary CTA with a mono progress counter. Muted, it collapses to a single `CALL SCOUT` accent button in the same corner (`z-index: 59`). **Never modal.**

### Dialogue system

One flat rules table — data, not logic, so a non-programmer can review it. Evaluate on every state version bump; the highest-priority rule whose `when` passes and whose cooldown has expired wins, ties breaking to the concept the player has least mastery in.

```ts
{
  id: "comp-set-inflated",
  mood: "warning",             // briefing | explaining | pointing | warning | approving | disappointed
  priority: 70,
  cooldownDays: 20,
  maxLifetime: 3,              // times it may ever fire
  when: (s) => s.deal && s.deal.compPpsf > s.deal.medianPpsf * 1.06,
  line: (s) => `Your comp set averages ${pct(s)}% above the neighbourhood median. An appraiser will not follow you there, and neither will the buyer's lender.`,
  math: (s) => `your set $${a}/sqft vs median $${b}/sqft`,
  teaches: "valuation.comp-discipline",
  suppressAfterMastery: true
}
```

`suppressAfterMastery` is what stops him nagging an expert — and the same field is what the instructor report reads.

### Starter line set — one per failure mode

| Trigger | Mood | Line | Teaches |
| --- | --- | --- | --- |
| Offer > itemised MAO | warning | "That is not a thin deal, that is a paid hobby." | cost.stack |
| Inspection skipped | warning | "You are bidding on six defects and can only see two of them." | risk.disclosure |
| Optional scope, ratio < 1 | disappointed | "Maple Heights does not pay for a pool. The street sets the ceiling, not the kitchen." | cost.over-improvement |
| List price > 104% ARV | pointing | "Two months of carry to chase six percent of optimism." | market.traffic |
| Contingency exhausted | explaining | "Fifteen percent was the floor, not the plan. The rest comes out of your pocket now." | cost.contingency |
| Refi blocked by DSCR | explaining | "Rent will not carry more loan than this, whatever the equity says. That is why you buy below value." | capital.dscr |
| Closed inside MAO | approving | "Bought right. Everything after this is execution." | — |
| Rival outbids at 84% ARV | briefing | "Let them have it. Kestrel is buying volume, not margin." | market.rivals |

### The guided tour — 7 steps

Launched from the HUD's `First 15 min` button; each step sets the screen it teaches on, and the card shows "step 3 of 7". Steps: the town and where margin lives → comps first → the inspection lever → the two max offers → crew and carry → the traffic curve → the ledgered post-mortem. Exiting returns Scout to contextual mode.

---

## Interactions & behaviour

- **Everything recomputes live.** Toggling a comp moves ARV, both max offers, the whole ledger, the profit verdict and Scout's line in one pass. No "recalculate" button exists anywhere.
- **Number changes:** 120ms count-up, no easing bounce. The formula line beneath re-types only its changed term.
- **Camera:** zoom is a 260ms transform on the ground layer; the overlay cross-fades at 160ms so lettering never scales mid-flight.
- **Change order:** the lot's hatching grows, Scout's sprite walks to it, the contingency bar drains left. 700ms total, skippable.
- **Day tick:** one 80ms flash on the day counter. **Never animate the board on a tick** — 600 days of animation is 600 days of annoyance.
- **Hover/press:** from the accent ramp, one step past base. Focus is the 2px accent `:focus-visible` ring.
- **Keyboard parity:** board pins, data views and the coach are focusable controls; existing N/W/M and 1–6 shortcuts keep working; Esc closes.
- **Responsive:** two-column screens collapse to one; the analyser becomes a sticky bottom sheet on phone; 44px minimum targets; pinch-zoom on the board; the right rail moves below the content.

## State

Prototype state, as a guide to what the UI needs to own (the engine owns the rest):

```
screen        town | deal | site | sale | book | mastery
dataView      value | rehab | rival | mine
day           number
comps         Record<compId, boolean>
inspection    none | standard | thorough
scope         Record<scopeId, boolean>
offerRatio    0.40–1.00 of ARV
saleMult      0.90–1.16 of ARV
crew          gc | inhouse | cheap
tour          0 = off, 1..7 = step
coachMuted    boolean
financing     cash | hard
```

Three settings should be real product options (they are Tweaks in the prototype): **coach on/off**, **show formulas on/off** (an instructor may want them hidden for assessment), and **difficulty** (Forgiving / Standard / Brutal).

---

## Modules to write

`src/engine/` stays pure TypeScript with no DOM. Board maths lives in the UI.

| Path | Status | Responsibility |
| --- | --- | --- |
| `src/ui/board/projection.ts` | new | The two lines of isometric maths, tile size, zoom levels. Single source of truth for ground and overlay. |
| `src/ui/board/Board.tsx` | new | Transformed ground layer + flat overlay layer. Subscribes to `useVersion()`; never reads the engine twice per frame. |
| `src/ui/board/dataViews.ts` | new | Pure `(parcel, state) => rampStep` functions, one per overlay. |
| `src/ui/coach/rules.ts` | new | The Scout rules table. Data, not logic. |
| `src/ui/coach/Coach.tsx` | new | Selection (priority, cooldown, mastery suppression) and the card. Writes nothing but its own dismissals. |
| `src/ui/components/Figure.tsx` | new | The traceable figure: value + formula. **Every number on screen goes through it.** |
| `src/ui/views/Deal.tsx` | rewrite | Two columns, sticky analyser, comps → inspection → scope → offer as one screen. |
| `src/ui/views/Site.tsx` | new | Crew choice, schedule lanes, permits, change orders against contingency. |
| `src/ui/views/Sale.tsx` | new | List-price dial, traffic curve, net at close, BRRRR binding-cap pair. |
| `src/engine/mastery.ts` | new | Concept ledger: which concepts demonstrated, when, assisted or not. Pure, seeded, saved. |
| `src/engine/crew.ts` | new | Crew multipliers on cost, duration, rework. Feeds `renovation.ts`; does not replace it. |
| `src/engine/rivals.ts` | new | Rival bidders as seeded agents with a stated strategy (volume vs margin) so behaviour is legible. |
| `src/engine/save.ts` | migrate | One new save version: mastery ledger, coach state, board camera. Existing saves migrate forward with defaults. |

## Phasing — 10 weeks

1. **Legibility (2 wks)** — `Figure.tsx` everywhere, Deal rewritten to two columns, formulas live. No new systems. *This alone fixes most of the teaching problem — ship it first.*
2. **The board (3 wks)** — projection, ground and overlay layers, four data views, three zoom levels, pins. Placeholder line-art houses; commissioned art drops in later with no code changes.
3. **Scout & onboarding (2 wks)** — rules table, coach card, mastery ledger, the gated first fifteen minutes. Ship the tutorial gate with it or the coach has nothing to introduce.
4. **Systems (3 wks)** — crew, permits, rivals, neighbourhood lift, seasons, class board. Each lands with its own balance-harness run before merge.

## Constraints the upgrade must respect

- **Single-file web bundle.** Stays self-contained and CSP-safe. Art as inline SVG symbols referenced by `<use>`, no external fonts, no CDN.
- **Engine purity.** No DOM in `src/engine/`. Mastery and crew are pure and tested.
- **One cash writer.** Crew, permits and rework all move money through `applyCash()`. The ledger-sums-to-cash test is the guard.
- **Determinism.** Rivals and crew rework draw from the seeded PRNG, so a shared deal code reproduces exactly.
- **No engine re-balancing.** `tests/balance.test.ts` should pass unchanged. **If it moves, treat it as a regression, not progress.**

## Onboarding — the first fifteen minutes

One authored deal, one house, no market. The player closes a complete flip before the game shows them four neighbourhoods. Nothing is explained that is not about to be used.

| Min | Player does | Game teaches | Held back |
| --- | --- | --- | --- |
| 0–1 | Camera lands on one lot; Scout hands over a clipboard | This is a house, that is your cash, days pass when you say so | Every tab but the deal |
| 1–3 | Picks three of five comps | ARV is produced, not given | Financing, auction, rentals |
| 3–5 | Buys the standard inspection; 4 of 6 defects surface | Findings become disclosure, disclosure becomes concession | Thorough tier |
| 5–8 | Scopes work; one over-improvement offered at 0.32× | Some repairs restore value, some destroy it | Crew choice |
| 8–10 | Drags the offer past itemised MAO and back | The 70% rule is a proxy for a stack of real costs | Hard money |
| 10–12 | Offers, gets one counter, closes | Rejection costs a day, not a deal | Seller archetypes |
| 12–14 | Advances weeks; one change order fires | Contingency is a real account with a real floor | Permit queue |
| 14–15 | Lists at ARV, contracts in 19 days, reads the P&L | Where the money went, line by line, in your own decisions | Everything else — now unlocked |

**Gate rule:** town board, financing, auctions and rentals stay locked until the tutorial deal closes — win or lose. A player who has closed one flip understands every noun on the town screen; one who has not will read it as a spreadsheet.

## Learning design — five failure modes

Mastery is **demonstrated twice, unassisted** (coach muted, no rewind).

| Failure mode | Concept | Proof of learning | Instructor reads |
| --- | --- | --- | --- |
| Paid too much | MAO, the cost stack, 70% as a proxy | Two deals at or under itemised MAO, coach off | Offer ÷ MAO ratio per deal |
| Believed the comps | Comparable selection, adjustment, appraisal risk | Comp set within 6% of median twice; one survived a low appraisal | Comp deviation from median |
| Skipped the inspection | Information asymmetry, disclosure, concession | Inspected before offering on every deal in a campaign | Inspection rate; hidden-cost exposure |
| Forgot the clock | Carry, DOM, the traffic curve | Two flips contracted inside 30 days at ≤102% ARV | Avg DOM; carry as % of costs |
| Over-levered | Points, interest, DSCR vs LTV as competing caps | One hard-money deal priced right; one refi against the binding cap | Which cap bound, and whether the player named it |

The five map onto a standard residential-development unit: valuation, cost estimating, project scheduling, real-estate finance, disposition. Each is one 50-minute class with one authored deal code, and the code needs nothing hosted.

## Assets to commission

| Asset | Count | Spec |
| --- | --- | --- |
| House archetypes, axonometric | 7 | Bungalow, ranch, duplex, mill loft, Victorian, split-level, new-build. Line drawing, 2px outer / 1px inner, no fill. |
| Condition states per archetype | 4 | Distressed, occupied, under construction (scaffold + skip), finished. Same footprint, swappable overlay. |
| Lot furniture | ~14 | Trees, driveways, fences, pool, skip, permit board, sold sign, rival hoarding. |
| Scout portraits | 6 | Briefing, explaining, pointing, warning, approving, disappointed. Bust, hard hat, clipboard. 320×320. |
| Scout on-site sprite | 3 | Idle, walking the site, digging (change orders). Isometric, 2 frames each. |
| Overlay icons (Lucide, 1.5) | ~22 | ruler, hammer, hard-hat, file-text, trending-up/down, gavel, key, users, badge-check. |
| Newspaper mastheads | 1 + 6 | The Weekly Plat, plus six stock headline plates for market events. |

All flat SVG line drawings, so they duotone with the theme and scale to any zoom. Authored as symbols and referenced by `<use>`, the whole set fits inside the existing single-file bundle budget.

In the prototype these appear as hatched placeholders with mono captions naming the shot. Keep the slots; drop the art in.

## Files in this bundle

| File | What it is |
| --- | --- |
| `Property Flipper 3.dc.html` | **The interactive prototype.** All six screens, live recomputation, Scout, and the 7-step tour. Open in a browser and click through it — this is the primary reference. |
| `Upgrade Package.dc.html` | The 8-sheet design spec: diagnosis, principles, art direction, live UI kit, Scout's brief and dialogue schema, onboarding, learning design, handoff. |
| `Upgrade Pitch.dc.html` | An 11-slide pitch deck for the upgrade — use it to get the work approved. |
| `support.js`, `deck-stage.js` | Runtime for the prototype files. **Design-tool artefacts — do not port.** |
| `_ds/styles.css` | The Industry design system token sheet. Port the tokens; do not ship the stylesheet. |
| `_ds/readme.md` | The design system's own guide — the authority on the blueprint aesthetic. |

Open the three `.dc.html` files directly in a browser. They are self-contained apart from the sibling `support.js` / `deck-stage.js` / `_ds/` paths, so keep the folder structure as it is.

## The one-sentence version

The simulation already tells the truth; this package is what it takes to make somebody believe it — so the rule is that no number in `src/engine/` needs to change for any of it.
