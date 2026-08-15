# Art still wanted — Property Flipper

Written to be forwarded as-is. Everything here is additive; nothing already
drawn needs redrawing.

**The third delivery closed almost everything.** All ten archetypes now match
`content.ts`, every placeable piece carries a machine-readable anchor, the line
furniture is placed, Scout is on the board, the wood-type has digits, every
market event has a headline plate, and there are three complete seasonal sets.
What follows is what is left, and it is short.

---

## 1. A scale for Scout's board sprites — one number

The only placement figure in the game that is a judgement rather than a
measurement. Every other placeable piece declares a `scale` alongside its
anchor; the six sprites declare an anchor only.

Read in the coloured set's units — where the houses and furniture live — all six
frames measure **65–69% of a lot wide**, which puts a dog the length of the
parked car two lots over. They are currently drawn at a scale chosen here so
Scout is about a third of a lot: a figure standing on a plot, legible at town
zoom, not competing with the building.

Needed: the intended scale, or confirmation that a third of a lot is right. If
the sprites are meant to be read in a different art space, say which.

---

## 2. Two icons — `kitchen` and `bath`

The renovation scope is grouped under eight category headings — `cosmetic`,
`kitchen`, `bath`, `systems`, `exterior`, `structural`, `addition`, `staging` —
over the most-scanned list in the game. Six of the eight have a good match in
the 22 delivered icons. **`kitchen` and `bath` have none**, and marking six of
eight reads as broken rather than partial, so none of them are marked.

Two icons on the same 24px grid at 1.5 stroke: a `kitchen` (range or cabinet
run) and a `bath` (tub or basin). Smallest item here by effort, and it is the
difference between that checklist being marked and not.

---

## 3. A decision, not a drawing: three archetypes with nowhere to live

`mill_loft`, `split_level` and `new_build` are drawn — base plus four condition
states, in line, colour and all three seasons — and match no archetype the
engine generates. They have been kept rather than discarded.

Adding them to `content.ts` would put them in the game and is a small change on
our side, but it is a **content and balance** change rather than an art one:
each needs a bed and bath count, a size range, an era and a value adjustment,
and the balance harness has to be re-run against it. Say the word and it is an
afternoon's work with the numbers measured before and after.

Either answer is fine. What is not fine is leaving three complete sets of
drawings that nothing can ever show, so this wants a decision rather than
silence.

---

## 4. Lower priority

- **A winter set exists now**, so nothing here is a stand-in any more. Dusk is
  carried and complete but unused: the game has seasons, not times of day, and
  there is no hook that would make an evening light mean anything. If a
  night-time mechanic ever appears it is already drawn.
- **The four unplaced icons** — `alert-triangle`, `clock`, `percent`, `ruler` —
  are compiled and waiting. They belong on things that repeat inline rather than
  on headings, and a mark is only worth adding where it makes a list scannable.
  No new art needed; this is our call, not yours.

---

## What is emphatically not wanted

Redraws of anything delivered. Ten archetypes, forty condition overlays, three
seasonal sets, both furniture finishes, six board sprites in two inks, six
moods, four faces, 22 icons, a masthead, ten plates, a charset and a cover are
all in the game and working. The one thing any of them needs is item 1.
