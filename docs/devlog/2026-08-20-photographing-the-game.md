# I made the machine photograph my own game, and it found six bugs

*Property Flipper 2.2.0 — now playable in the browser.*

Property Flipper is a real estate flipping simulation that charges you for
everything the real thing charges you for: 2% buying closing costs, 6% agent
commission, points on the loan, and tax, insurance and utilities every day you
own the house. Together those eat most of the 30% margin the industry's 70%
rule holds back — which is exactly what that rule is standing in for.

This release started somewhere unglamorous. The store page needed screenshots,
I did not want to take them by hand, and by the end of it the game had six
fewer defects.

---

## Screenshots by hand go stale and nobody notices

A screenshot taken by hand is wrong the first time anything moves. So `npm run
shots` walks ten screens in Electron and photographs each at 1280×800 — the size
the itch embed uses. The scene list is shared with the accessibility audit,
because reaching those screens is the fiddly part and there should be exactly
one copy of it. `Math.random` is pinned, so the same town, the same houses and
the same numbers come out every run.

Then I looked at the pictures.

**A small green rectangle at the bottom of the deal screen.** 38×21 pixels of
nothing. It turned out to be a toast with an empty message: an engine function
that records the coach having spoken returns `{ ok: true, message: '' }` and
says in a comment that it is silent. It was not silent. It painted a blank green
plate and played the notification sound once per coach rule per day. With no
text in it there is nothing to read and nothing to name, which is why nobody had
ever reported it.

**A full-width horizontal scrollbar under the deal analyser**, for five pixels
of overflow. The blueprint corner marks hang 6px outside the panel they
decorate, and a box that scrolls one axis cannot be `visible` on the other — CSS
promotes it to `auto`. So five stray pixels of decoration grew a scrollbar the
length of the panel.

**The top bar's controls wrapped at 1280 and the wrapped line was painted
through the tab strip.** A fixed height cannot hold content that is allowed to
wrap. This one only appears below 1440px, which is the width the shell was
designed at — and 1280 is the width the store page tells people to play at. I
had been measuring the generous case and shipping the tight one.

**The main menu's first 180 pixels — including the title — were unreachable.**
A flex container that scrolls and centres on the same axis puts half its
overflow at a negative offset, and `scrollTop` cannot go below zero. On an
800px-tall window the game's name was above the top of the screen with the
scrollbar already at the top and no way to get to it.

Three of those four are now checks in the audit, verified by putting each defect
back and watching it fail. The audit itself moved to 1280×800.

Then I extended the walk to play a complete flip — buy, scope, wait out the
crew, list, cut the price, sell — and four screens it had never reached produced
two more: a 12×18 close button under the WCAG 2.2 target minimum, and a
timestamp at 3.42:1 in the light theme.

Six defects. Zero of them found by playing.

---

## What else is in 2.2.0

**It moves now.** The stylesheet had four `transition` declarations and no
keyframes in 2,100 lines — nothing on screen had ever moved, and that, not the
palette, is why it read as a spreadsheet. Cash, net worth and the day counter
now travel to their new value instead of cutting to it.

**Closing a flip has a moment.** It used to produce a toast and a row in a
ledger, while the code that renders a complete 1200×630 card of the deal sat
three clicks away where nobody found it. The card now raises itself the second a
sale closes, under a headline that counts to the profit — or the loss,
identically, because a game about underwriting that only makes a noise when you
win is teaching the wrong lesson.

**The board opens in colour.** Both art sets were always there; the survey-plat
line style is the better default over a colour price ramp and the wrong one to
open on. The first person shown a screenshot asked what had happened to the
colour, which is the only usability test that matters for a first impression.

**Your offer is drawn against the ceiling.** The analyser always printed the
70% rule's maximum and the itemised maximum side by side. It now shows where the
number you are typing sits between them. The state worth having is the middle
one: over the itemised maximum and under the rule of thumb, the shortcut waves
you through and the arithmetic does not. It is the only failure in this game
with no other visible symptom — every figure still looks reasonable and the
margin is already gone.

**Empty screens say what they are for.** Track record on day one used to be the
sentence "No completed flips yet." alone in six hundred pixels of nothing, on
the tab that carries the whole argument that this teaches something.

---

## Numbers, because that is the point

A bot that follows the 70% rule, inspects before offering and reserves 15%
contingency wins **72%** of tutorial campaigns and ends with about **$262,816**.
The same bot paying 92% of ARV wins **63%** and ends with **$218,515**. That gap
is the thesis, and it is measured on every commit across a hundred seeded
campaigns rather than asserted.

535 tests. Free, open source, no ads, no telemetry, no account, works offline.

**Play it in the browser above**, or download for Windows, macOS or Linux.

Source: <https://github.com/ibuilder/Property-Flipper-Game>
