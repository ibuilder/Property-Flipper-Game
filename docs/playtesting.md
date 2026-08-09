# Playtesting

The balance harness runs a rules-following bot through complete campaigns
across thirty seeds and checks that discipline beats recklessness, that
inspecting pays for itself, and that contingency is not a handicap. Those are
the things a bot can settle, and they are settled.

Everything below is what it cannot tell you. A bot never fails to find the comp
picker. It never buys three houses without opening the analyzer. It is never
bored, never confused about what ARV means, and never closes the tab.

---

## Run it in three sessions

Do not do all three with the same person. They are testing different things.

### Session 1 — Can a stranger get through the first flip?

**Recruit:** someone with no property background at all.
**Setup:** The First Flip, standard difficulty. Browser build. Say nothing
beyond "this is a game about flipping houses — think out loud."
**Watch for, and time:**

- How long before they open a listing.
- Whether they read the analyzer or scroll past it.
- Whether they inspect before their first offer. If not, ask afterwards whether
  they had noticed the button.
- Their first offer as a percentage of the asking price. Anything near 100%
  means the central idea has not landed.
- Whether they know what ARV means by the end without being told.

**Do not help until they are properly stuck.** The moment you want to intervene
is the most valuable data in the session — write down exactly what they were
trying to do.

**Afterwards:** "What was the game asking you to be good at?" If the answer is
not roughly "not overpaying", the tutorial has failed regardless of whether
they won.

### Session 2 — Does it hold someone who already knows this?

**Recruit:** someone who actually flips, invests, underwrites, or lends.
**Setup:** Portfolio Builder, standard. Let them talk.
**Watch for:**

- Every number they call wrong. Write down the number, their expected value,
  and why. This is the highest-value output of the whole exercise.
- Whether they reach for something that is not there. Wholesaling? 1031
  exchange? Multiple offers? Anything they expect and cannot find.
- Whether the seller archetypes read as real people or as multipliers.
- Whether they trust the comp model. If they do not, ask what would fix it.

**Afterwards:** "Would you give this to somebody you were training?" That is
the only question that matters for the teaching case, and a polite yes is not a
yes — ask who, specifically.

### Session 3 — Does anyone play it twice?

**Recruit:** somebody who finished session 1, a week later.
**Setup:** whatever they want. Watch what they pick.
**Watch for:**

- Do they choose a harder campaign, a harder difficulty, or the same again?
- Do they find the auction, BRRRR, the financing menu, or a crew on their own?
- Do they play differently, or repeat the first run?
- When do they stop, and what were they doing when they did?

If they never discover a whole subsystem unprompted, that subsystem is not
discoverable. That is a finding, not a failure.

---

## Getting the data back

In-game: **Saves → Copy session report**. It copies a plain-text account of the
run — seed, difficulty, what was built, which features were touched at all,
every closed deal, and the last fifteen log lines.

The "what was used" checklist is the part to read first. A feature nobody found
is indistinguishable from a feature nobody wanted, and only that list tells them
apart.

The seed reproduces the run exactly, so any surprising session can be replayed.

---

## What counts as a finding worth acting on

**Act on:**

- Anybody bouncing off before their first offer. Nothing else matters if they
  do not reach the decision the game is about.
- A domain expert calling a number wrong, with a reason.
- Two or more testers making the same mistake at the same place. Once is a
  person; twice is the design.
- A subsystem nobody finds without being told.

**Do not act on:**

- "It should have 3D renovation." That is a different game, deliberately — see
  the roadmap.
- A single person's difficulty opinion. That is what the difficulty settings are
  for, and the bot measures the curve more reliably than one session can.
- Requests to remove costs because they feel punishing. Those costs are the
  entire point; if they feel unfair, the fix is making them *visible earlier*,
  not smaller.

---

## Before re-tuning anything

Re-run the harness and compare against the committed baseline. A change that
makes one tester happier and moves the disciplined-versus-reckless gap is not a
tuning fix, it is a regression with good manners.

```bash
npm test && cat balance-output.txt
```

The current baseline, for reference:

| Bot | Win rate | Net worth |
| --- | --- | --- |
| Disciplined (70% rule, inspects, 15% contingency) | 77% | $278,829 |
| Reckless (92% of ARV, no inspection, no contingency) | 47% | $154,486 |
| Blind (70% rule, no inspection) | 63% | $219,646 |

And note that the longer campaigns are sampled over twenty seeds rather than
ten. Ten was not enough: a two-campaign difference read as a twenty-point swing
in win rate, which was enough to make sampling error look convincingly like a
balance regression. It did, twice.
