# Roadmap

Where Property Flipper stands, what the market looks like, and what to build next.

Last updated: August 2026.

---

## 1. Where it stands today

Rewritten against the actual repository rather than from memory. The previous
version of this section claimed 45 tests and no charts; both were long stale.

**Simulation.** Offer-versus-reserve buying, noisy ARV from player-selected
comps, pre-purchase inspection driving seller concessions, line-item scope with
change orders and contingency, the full cost stack, days-on-market selling,
auctions, five financing instruments, BRRRR with refinance caps, crews, XP and
difficulty, multi-year neighbourhood arcs and event chains.

**Teaching.** Every figure carries its formula inline. Both maximum offers sit
side by side showing their arithmetic. A stress field draws where the deal dies
as a contour. Comps plot against the city rather than in isolation. Post-mortems
attribute the miss. Players commit a forecast before buying and are scored on
calibration. Scout, a rules-table coach, speaks once before a mistake and
retires per concept once it has been demonstrated twice.

**Presentation.** Industry design system, dark-first with a real light theme,
Barlow embedded and subset, blueprint geometry, one accent with three token
roles, red reserved for a negative projected profit alone.

**Verification.** 375 tests. A 20-seed balance harness. A contrast audit that
runs the real renderer in Electron on every push and fails the build under AA.
A smoke test launching the packaged app on all three platforms.

**What it still does not have:** a sense of *place*. The map is a flat polygon
diagram; there is no property you can look at, no board you can zoom into, and
no world that speaks to you between decisions. It is now a very good
instrument. It is not yet somewhere you want to spend an evening.

---

## 2. What the research says

### The genre has a hole in the middle

| | Renovation sims | Property Flipper | Idle / tycoon |
| --- | --- | --- | --- |
| Example | House Flipper | — | Landlord Go, Real Estate Tycoon |
| Strength | Tactile, satisfying renovation | Deal underwriting | Accessible, endless progression |
| Weakness | No financial model | No visuals | No decisions worth making |

House Flipper is criticised specifically for the things this project already models. Reviewers note
that finished homes go instantly to auction where a dozen buyers bid and keep buying regardless of
how many they own, and that the simulation "lacks the financial complexity and logistical
challenges of actual house flipping businesses." The Seattle Times covered the same gap between
flipping on television and flipping in reality.

Meanwhile the tycoon end of the market is built on clicker economics — arbitrage on price ticks,
prestige resets, passive rent. Engaging, but nothing is being taught.

**Positioning: the deal, not the drywall.** This is the only one of the three where being wrong
about ARV costs you money.

### There is a real professional market, and it runs on Excel

Cornell (Real Estate Investment Modeling), Wharton with Wall Street Prep, A.CRE, RealData and REIA
all sell underwriting education. Every one of them teaches through spreadsheets. An interactive
simulation where a bad ARV estimate visibly destroys a deal is a genuinely differentiated format
for that audience — and it is the audience this project's author already works in.

### What retains players in management sims

The consistent finding across genre analysis: progression has to keep the next goal just out of
reach, and — directly relevant to the next phase — *the world should visibly transform as a result
of the player's decisions*, not merely increment a counter. Long-term retention in this genre comes
from a meta-progression layer that persists across runs.

---

## 3. Honouring the original wishlist

The Pygame README listed the author's own future ideas. Status after v2:

| Idea | Status |
| --- | --- |
| More property types and locations | **Done** — 7 archetypes, 6 neighborhoods |
| More diverse upgrades | **Done** — 18 scope items across 8 categories |
| More detailed market simulation (gentrification) | **Done** — multi-year neighborhood arcs |
| More complex event types and chains | **Done** — chains with probabilistic links |
| Improved UI/UX (visual properties, graphs, tooltips) | **Partial** — tooltips and copy done, visuals are Phase 1 |
| Difficulty levels | **Done** — four campaigns times three settings |
| More staff types (specialists, agents) | **Done** — a crew on the payroll |
| Player XP and levelling alongside cash-bought skills | **Done** |
| Auctions and bidding | **Done** — trustee sales with proxy bidding |
| AI competitors | **Done** — rival buyers on every listing |
| Tenant management | **Done** — Phase 4 (BRRRR) |

The roadmap below is largely a sequenced version of that list, with market research deciding the
order.

---

## 4. Phases

Effort is rough developer-days for one person.

### Phase 1 — Make the state visible — **done**

The single biggest gap, and the one the retention research points straight at.

1. **Procedural house illustrations.** SVG facades generated from data the property already has:
   archetype for silhouette, sqft for scale, `yearBuilt` for period detail, and `condition` for
   decay — boarded windows, gapped shingles, stained siding, an overgrown yard. Seeded from the
   existing `noiseSeed` so a house always looks like itself. Completed scope items visibly change
   it: `roof_replace` fixes the roof, `landscaping_curb` fixes the yard.
   *Why first:* condition is currently an invisible decimal driving the entire economy, and the
   before/after of a flip is the emotional payload of the whole loop.
2. **Charts.** Market index and rate history, net worth over time, per-neighborhood price trends,
   and a P&L waterfall per closed deal. Requires a new sampled history series in `GameState` and a
   save migration to v3.
3. **Neighborhood map.** Stylized, heat-coloured by price index, holdings pinned. Makes cycles
   spatial rather than tabular.

No new stack — SVG and Canvas in the existing React app, ~20–30 kB. Explicitly **not** a game
engine; see §6.

### Phase 2 — Depth in the deal — **partly done**

Make the underwriting itself richer, since that is the differentiator.

- ~~**Pick your own comps.**~~ **Done.** Choose from a pool of seven; each is priced by the same
  valuation model as the subject, so a bad selection is wrong in a direction you could have
  predicted. Required adding a scale effect to valuation — smaller homes carry a higher price per
  foot — without which a size-mismatched comp cost nothing and the warning was empty advice.
- ~~**Seller archetypes.**~~ **Done.** Estate, tired landlord, relocating, retail, developer, each
  with its own ask bias, reserve, patience, and — the one that matters — how much of a disclosed
  defect it will concede.
- ~~**Appraisal gap.**~~ **Done.** Buyer offers are cash or financed. Financed buyers bid higher but
  bring a lender's appraisal, and the price falls to it when it comes in low — so the highest offer
  is not automatically the best one. The decision sits at offer selection, not at closing.
- ~~**Scope templates.**~~ **Done.** Two presets ship and any assembled scope can be saved.
- ~~**Financing menu**~~ **Done.** Five instruments rather than one: cash, hard money, private
  money that has to be earned before anyone will lend it, seller paper bought by paying more for
  the house, and an equity partner who takes no interest and a third of the upside. Cash-out refi
  arrived with BRRRR.
- **Permits and inspections as schedule risk**, tied to the existing permit-backlog event.

### Phase 3 — Progression that survives run three — **partly done**

- ~~**Reputation**~~ **Done.** Three tracks — lenders, agents, contractors — earned by outcomes
  rather than bought with cash. Lenders price points and rates; agents cut commission and bring
  pocket listings before they hit the market; contractors quote cheaper and spring fewer change
  orders. Neutral standing is exactly neutral, so it layers onto existing balance without shifting
  it. A foreclosure costs 28 points and is the one thing lenders genuinely remember.
- ~~**Crew and staff**~~ **Done.** People on the payroll instead of subs per job: cheaper, faster
  and fewer surprises up to capacity — and owed wages every day, including the ones where everything
  you own is sitting on the market waiting for a buyer. Past capacity they are slower than
  subcontracting, because they can only be in one place at a time. That is the decision that
  actually decides whether the business scales past one house.
- ~~**XP and levelling**~~ **Done.** A third currency alongside cash-bought skills and earned
  reputation. Experience comes only from doing the work — closing, selling, winning at auction,
  letting, refinancing — cannot be bought or hurried, and grants a skill point per level rather than
  a silent bonus, so a save that ignores it is completely unaffected by it.
- ~~**Explicit difficulty settings**~~ **Done.** Three settings expressed as one small table of
  multipliers: capital, volatility, what stays hidden, rival aggression, seller firmness, change
  orders and the clock. Standard is exactly neutral by construction, so the campaigns the balance
  harness measures are untouched — and nothing here touches the arithmetic the game teaches. The
  70% rule, the cost stack, cap rate and DSCR mean the same thing at every setting; what changes is
  how much room you have to be wrong.

### Phase 4 — A world with other people in it — **partly done**

- ~~**AI competitors**~~ **Done.** Every listing carries a rival-interest level driven by how good
  the deal looks from outside. Contested listings get bought out from under you while you
  deliberate, and an offer that only just clears the seller's reserve can be sniped — so a good
  deal no longer waits indefinitely, which was the main pressure the game lacked.
- ~~**Auctions**~~ **Done.** Trustee sales on their own board: the opening bid is the lender's
  credit bid rather than value, you cannot inspect, you cannot finance, and about a third of lots
  come occupied — which costs cash and 45 days of carry before a crew can start. Bidding is by
  proxy, so an honest maximum is never punished. Runs on its own random stream, so the courthouse
  and the flipping game can each change without reshuffling the other.
- ~~**BRRRR**~~ **Done.** Rent rather than sell: tenants who sign at a rate that depends on how far
  your asking rent sits above market, leases that end and sometimes renew, vacancy and turnover
  cost, and an operating expense stack that makes NOI mean what it means to a lender. On top of
  that a cash-out refinance sized by the *lesser* of a 75% LTV cap and a 1.20× DSCR test, so a
  house bought at retail will not refinance however much equity it has — which is precisely why
  BRRRR requires buying below value. Habitability gates letting, so the rehab genuinely comes
  first, and the resulting loan amortises daily rather than ballooning.
- ~~**Gentrification and decline**~~ **Done.** Multi-year arcs rather than events: a neighborhood
  moves a little every day for two to four years, ramping in and out, and stays silent for its
  first stretch — so the information is early rather than free. By the time the map says the
  Millworks is gentrifying, most of the move is still ahead but the cheapest way in has gone.
- ~~**Event chains**~~ **Done.** A rate spike tends toward a correction, a boom toward a materials
  spike and then a permit backlog. Probabilities rather than a script, and a chained event stands in
  for the day's random one rather than arriving on top of it — otherwise "chains" is just a word for
  more events.

### Phase 5 — Make it teach deliberately — **mostly done**

Where the professional-education market gets served.

- ~~**Deal post-mortems.**~~ **Done.** The projection is captured at the moment of purchase and
  compared against what happened, with the gap attributed to a named cause and the biggest miss
  called out.
- ~~**Scenario editor.**~~ **Done.** Author a deal — house, defects and which are disclosed, seller,
  market, clock, pass mark — and share it as a self-contained code. Nothing has to be hosted.
- ~~**Curriculum mode.**~~ **Done.** Five lessons, each isolating one failure: the 70% rule, why the
  inspection pays, how comps mislead, what carry costs, what leverage rents you. The lesson text is
  shown on completion either way, because failing is when you most need it.
- **Shareable deal cards** — an image of your best or worst flip. Free distribution.

### Phase 6 — Distribution — **wired, pending credentials**

- ~~**Code signing.**~~ **Wired.** Windows signing with a timestamp server, and macOS signing with
  the hardened runtime, JIT entitlements and notarisation, all switched on automatically the moment
  the credentials exist as repository secrets — and producing a working unsigned build when they do
  not. What cannot be done from a repository is buy the identities: a Windows certificate is
  $200–400/year from a CA, and macOS needs Apple Developer Program membership at $99/year. See
  [RELEASING.md](RELEASING.md) for exactly which secrets to set.
- ~~**Verify the macOS and Linux builds.**~~ **Done, differently.** Verifying on real hardware is
  not something one person with one Windows machine can do, and not something anyone should have to
  remember on every release. So CI launches the built app on Windows, macOS and Linux on every push
  and asserts the renderer actually mounts — which catches the class of failure that motivated the
  item (an icon that will not convert, a file missing from the package, a path that only resolved on
  the build machine) and catches it before a release rather than after.
- **itch.io** first (the browser build is already the right shape), Steam if Phase 4 lands. The
  release artifacts are what would be uploaded; the upload itself is manual.
- **Playtesting with actual flippers** to re-tune balance against humans rather than the bot. This
  is the one genuinely irreplaceable item on the list: the harness can prove discipline beats
  recklessness across thirty seeds, and it cannot tell you whether the game is any good.

---

## 5. Suggested order

Phase 1 → Phase 2 → Phase 5 → Phase 3 → Phase 4 → Phase 6.

**Status.** Phases 1 through 5 are complete. Phase 6 is wired and waiting on credentials that have
to be bought rather than written.

Phase 5 was pulled ahead of 3 and 4 deliberately: post-mortems and the scenario editor are cheap,
they compound the existing differentiator, and they serve the professional audience without needing
the simulation to get any bigger. Phases 3 and 4 are what turn it into a game people play for
twenty hours — worth doing, but only after the teaching case was fully made.

**What is left is not code:**

1. **Buy the signing identities.** A Windows code signing certificate ($200–400/year) and Apple
   Developer Program membership ($99/year). The pipeline already uses them the moment they appear as
   repository secrets, and produces working unsigned builds until then.
2. **Playtest with people rather than the bot.** The balance harness proves a disciplined bot beats
   a reckless one across thirty seeds and that inspecting pays for itself. It cannot tell you
   whether any of it is enjoyable, whether the vocabulary lands, or where a real beginner gets
   stuck. Every remaining tuning question is one only humans can answer.
3. **Publish.** itch.io first — the single-file browser build is already the right shape for it.

**Deliberately not built:** a 3D renovation mode, multiplayer, and anything requiring a game engine.
See §6.

---

## 6. What we are deliberately not doing

- **Unity or Unreal.** There is no simulated space, no physics, no real-time rendering. Adopting one
  means a third full rewrite into C#/C++, kills the 308 kB browser demo, and swaps a fast accessible
  UI for a toolkit that is bad at dense tables. The graphics this game needs are SVG and Canvas.
- **3D or first-person renovation.** That is House Flipper's game, it is executed well there, and
  competing on it means losing on it.
- **Multiplayer.** The interesting competition is AI bidders, not other humans.
- **Free-to-play monetisation.** The loop is deliberate, slow decisions. Timers and boosts would
  destroy the thing the game is for.
- **Real property data.** Landlord Go does GPS-linked real listings. It adds licensing and privacy
  problems and teaches nothing extra.

---

## 7. Open question

The one fork that changes prioritisation is **who this is for**:

- **A game.** Ship on itch and Steam. Phases 3 and 4 matter most — progression, competitors,
  auctions, BRRRR.
- **A teaching tool.** Serve the market Cornell and Wharton charge for. Phases 2 and 5 matter most —
  deal depth, post-mortems, the scenario editor, curriculum.
- **Both.** Sequence as in §5, which is built to keep both doors open for as long as possible.

The phases overlap heavily, so this is a question of order rather than direction — but it decides
what gets built after Phase 1.

---

## Sources

- [House Flipper review — Game Informer](https://gameinformer.com/review/house-flipper/a-definite-fixer-upper)
- [House Flipper: The Ultimate Guide — Real Estate Skills](https://www.realestateskills.com/blog/house-flipper-game)
- [For house flippers, reality doesn't match reality TV — Seattle Times](https://www.seattletimes.com/business/real-estate/for-house-flippers-reality-doesnt-match-reality-tv/)
- [Real Estate Investment Modeling — eCornell](https://ecornell.cornell.edu/certificates/real-estate/real-estate-investment-modeling/)
- [Real Estate Investing Certificate — Wharton Online & Wall Street Prep](https://wallstreetprep.wharton.upenn.edu/real-estate-investing-certificate/)
- [Adventures in CRE](https://www.adventuresincre.com/)
- [15 Best Property Management Simulation Games — Zeevou](https://zeevou.com/blog/property-management-simulation-games/)
- [Idle vs Incremental vs Tycoon — André Guerrero](https://medium.com/tindalos-games/idle-vs-incremental-vs-tycoon-understanding-the-core-mechanics-f12d62f4b9f7)
- [Roblox Tycoon Games 2026: Builds, Loops and Economies — Gaming Endsights](https://endsights.com/roblox-tycoon-games)

---

## 7. Remaining work, in order

Written at the end of the redesign push so the next session starts without
re-deriving anything. Everything here is scoped; none of it is blocked except
where stated.

### A. The Weekly Plat — market news with consequences

The world is silent between decisions. The digest fixed dead air after a
*skip*; nothing speaks during ordinary play.

A right rail: newspaper masthead, then items with a kicker, a headline, and —
the part that matters — **an effect line naming what it does to your board**
("Your carry cost per day: unchanged. Your exit window: shorter."). The news
beat is a teaching device, not flavour.

The engine already generates market events (`events.ts`), arcs (`arcs.ts`) and
rate moves. This is presentation over existing data. Effect lines must be
computed from the event's actual modifiers, never written as prose, or they
will drift from what the event really does.

### B. The traffic curve, drawn

Listing price drives days-on-market steeply and the player currently reads a
number. A 14-bar histogram with the bar at the current multiplier solid makes
the cliff visible: traffic falls off above about 102% of ARV, and that is
seventy-odd days and real carry.

Use the engine's own curve, not the prototype's simplified one. Keep the
exponential shape visible. The data is in `market.ts`.

### C. The guided first fifteen minutes

Highest impact on whether a new player continues. It is third because it should
introduce a game that already has A and B in it.

One authored deal, one house, no market. Town board, financing, auctions and
rentals stay locked until the tutorial deal closes — win or lose. The
minute-by-minute table is in `docs/design/redesign-3.0-handoff.md`.
`scenarios.ts` can already author a deal; the gate and the seven-step tour are
new.

### D. The isometric board

Largest, and the only item with a real dependency: **it needs commissioned art
to not be a downgrade from the map that exists now.** The full spec —
projection maths, tile size, the four data views, three zoom levels, pin
anatomy — is in the handoff. Put the projection in one module and have both the
ground and the overlay read from it; labels live in an untransformed layer or
the lettering shears and the whole aesthetic collapses.

Do not ship this with placeholder blocks.

### E. Smaller, all cheap

- **Widen the contrast audit.** It sees one seeded market on one screen. Drive
  it through an owned property, a listed one and the track record. It has
  already caught a bug on a branch the local run never rendered, so its blind
  spots are the shape of its coverage.
- **Persist Scout''s cooldowns.** They reset on restart, so a long campaign
  resumed tomorrow can repeat a line. Needs a save version bump; batch it with
  the next one.
- **Retire the legacy colour aliases.** `--good/--warn/--bad` still bypass the
  one-ramp discipline. File by file, not in one change.
- **Permits and the inspector queue.** The only unbuilt *system* from the
  handoff. It will move balance — re-baseline deliberately.

### Still yours

Signing certificates, the itch HTML embed (project kind is stuck on
Downloadable), the cover image, and human playtesting. And the open balance
question from `docs/playthrough-findings.md`: **liquidity never binds** in this
game — measured, zero occasions across eight campaigns — which is a design
decision rather than a bug, but real flipping is substantially about running
out of money and this currently is not.

### A note on the market research above

Sections 2–6 predate this push and were **not** re-researched when section 7
was written: there was not enough context budget left in that session to do it
properly, and stale research presented as fresh is worse than none. The genre
analysis still reads as sound; the competitive claims are worth re-checking
before they are used to justify anything.
