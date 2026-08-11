# Playthrough findings

A full First Flip campaign, played end to end, plus a measurement of how much
of a campaign is silent. Written down because the last time these were only
said aloud they were lost.

Verification note: the browser pane was not compositing during this pass
(`document.hidden === true`), which stops React committing updates, so the
campaign was driven through the engine directly rather than clicked through.
That finds logic, pacing and copy problems. It does not find visual ones, and
the visual list at the bottom is therefore reasoned from the code rather than
observed.

---

## Fixed in this pass

### Almost the entire campaign was silent

Measured across five seeds of The First Flip, playing 450 days each:

| Seed | Dead days | Longest silent run | Log lines in the whole campaign |
| --- | --- | --- | --- |
| 1 | 439 / 450 (98%) | 108 days | 12 |
| 2 | 438 / 450 (97%) | 131 days | 14 |
| 3 | 430 / 450 (96%) | 61 days | 24 |
| 5 | 435 / 450 (97%) | 118 days | 18 |
| 7 | 434 / 450 (96%) | 99 days | 19 |

A player pressing **+30d** could be told nothing at all for four months. Waiting
is a legitimate and often correct strategy here — listings get cheaper the
longer they sit — and the game gave no way to see that working.

Fixed by adding a digest after any multi-day skip: what it cost in carry, which
listings were cut and by how much, what came on, what went to somebody else,
where the market and rates moved, and how the work or the sale is progressing.
Nothing in it is invented; it is a diff of two real moments.

### The game let you underwrite a house you could not buy

The worst finding. The screen picked a $277,905 house, the analyzer showed a
174% annualised return surviving 100% of the stress grid, and only the offer
button revealed there was no way to fund it. Every minute spent on that deal
was wasted on something never available.

It turned out to be subtler than it first looked: the house *was* affordable —
with leverage it needed $55,036 at closing rather than $255,166. The rejection
named the problem and not the solution, which was one radio button away on the
same screen.

Three fixes:

- The rejection now names the cheaper route and its cost when one exists.
- Listings beyond reach at *any* leverage are marked in the market table.
- The analyzer says a deal is unfundable **above** the projection rather than
  leaving it to the offer button, so nobody underwrites a deal they cannot take.

---

## Not fixed, worth doing

### The player cannot follow a property

Three times in one campaign a listing being tracked went under contract to
another buyer, and the only sign was an offer failing with "that property is no
longer on the market". The digest reports the count of listings lost but has no
idea which one you cared about. A watchlist — even just a star on the row —
would let the digest say *"the one you were watching is gone"*, which is the
sentence that actually matters.

### The annualised figure flatters a thin deal

The playthrough sold in 32 days for $14,671 net on a $250,163 purchase — a
5.9% return on the money, reported as **167% annualised**. Both numbers are
correct and the caveat about redeploying capital is already shown, but the big
number is the one that gets read. Worth considering leading with the plain
return on short holds and offering the annualised figure second.

---

## Where graphics and UI would earn their place

Ordered by how much each would change the experience, not by effort.

1. **A timeline, not a day counter.** The single biggest gap. A campaign is 450
   days and the player sees one integer. A horizontal strip showing purchases,
   renovation spans, listing periods and sales — with the clock moving along it
   — would make the shape of a campaign visible for the first time. It is also
   the natural home for the digest.

2. **Renovation progress on the property, not in a number.** The facade already
   changes when work completes. It should change *during* — scaffolding coming
   down room by room, the roof finishing before the siding. Right now a 22-day
   job is a progress bar.

3. **The stress grid deserves to be a heat map, not a table.** It is already
   shaded, but a proper two-axis field with the break-even contour drawn on it
   would make "where does this deal die" a shape rather than a number to read.

4. **Comps as a scatter, not a list.** Price per square foot against size, your
   subject marked, the selected comps highlighted. The mismatch warning
   currently explains in words what one chart would show instantly.

5. **The cash runway.** A simple bar showing cash against committed spend and
   expected proceeds. Running out of money mid-renovation is the most common
   way a campaign is lost and there is no visual warning of it approaching.

6. **Neighborhood arcs on the map over time.** Arcs run for years and are shown
   as a text pill. A small sparkline per region on the map would show a
   neighborhood turning while it is still worth acting on.
