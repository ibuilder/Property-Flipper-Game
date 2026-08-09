# itch.io page copy

Paste-ready. Everything below is the text for the project page; the fields at
the top are the settings that go beside it.

---

## Project settings

| Field | Value |
| --- | --- |
| Title | Property Flipper |
| Short description (tagline) | Buy distressed, underwrite honestly, and get out before the carry eats the margin. |
| Classification | Game |
| Kind of project | HTML (playable in browser) — with downloads attached |
| Release status | Released |
| Pricing | Free, donations enabled |
| Embed | Manually set size **1280 × 800**, click "Fullscreen button" on, "Mobile friendly" off |
| Genre | Simulation |
| Tags | real-estate, simulation, management, economy, educational, finance, singleplayer, no-ads, offline, open-source |
| Platforms | Windows, macOS, Linux, HTML5 |
| Average session | About an hour |
| Inputs | Mouse, keyboard |
| Accessibility | Configurable controls, one-hand play, high-contrast, textual alternatives to charts |

> **Embed size matters.** The layout collapses to a single column under 1240px
> wide, which works but hides the side-by-side comparisons the game is built
> around. 1280 × 800 keeps them.

---

## Page body

### Property Flipper

**Most flipping games let you buy at value and sell at value, and call the
difference profit. That is not a business — it is a rounding error dressed up as
one.**

This one charges you for everything the real thing charges you for: 2% buying
closing costs, 6% agent commission, points on the loan, and property tax,
insurance and utilities every single day you own the house. Together those eat
most of the 30% margin the industry's 70% rule holds back — which is exactly
what that rule is standing in for, and why it exists.

So the question the game asks is the one the job asks. **What is the most you
can pay for this house and still make money?**

---

### What you actually do

**Screen the market.** Every listing shows an asking price and your estimate of
what it is worth. Those are different numbers, and the gap between them is not
the deal — it is where the conversation starts.

**Build a valuation you can defend.** Pick your own comparable sales from a pool
of seven. Every one is priced by the same model as the house you are buying, so
leaning on a bigger house or a better street is wrong in a direction you could
have predicted. Nothing adjusts for a mismatch on your behalf, and the error
flows straight into your maximum offer.

**Inspect before you offer.** A standard inspection finds about 60% of what is
wrong; a thorough one, 90%. Findings are disclosed to the seller, who has to
concede most of the repair cost or lose the deal. That renegotiation is the
entire economic reason due diligence exists — and skipping it costs about
$59,000 a campaign, measured.

**Scope the work and price the risk.** Eighteen line items across eight
categories. Set a contingency reserve; hidden defects surface as change orders
against it once a crew opens the walls. Budget nothing and the first surprise
comes out of the cash you needed for the rest of the job.

**Sell — or don't.** List price drives buyer traffic off a cliff above true
value. A financed buyer's lender appraises the house, and the price falls to the
appraisal when it comes in low, so the highest offer is not automatically the
best one. Or keep it: put a tenant in, then refinance and pull your capital back
out to buy the next one.

---

### Five ways to buy, and none of them is free

- **Cash.** Nothing to service and nothing to default on. One deal at a time.
- **Hard money.** Fast, expensive, and the balloon does not care whether it sold.
- **Private money.** Cheaper — and nobody lends privately to a stranger. You have to earn it.
- **Seller financing.** The seller carries the note below market, and charges you on the price for doing it. Your price or my terms, not both.
- **An equity partner.** No interest, no maturity, nothing to default on — and a permanent third of the upside, with their capital coming back before yours.

And a fifth way in: **the courthouse steps.** Trustee sales open at what the
lender is owed rather than what the house is worth. You cannot inspect, cannot
finance, and about a third of lots still have somebody living in them.

---

### What it teaches, honestly

Every number in this game is the number the industry uses. ARV, MAO, the 70%
rule, cap rate, NOI, DSCR, cash-on-cash, LTV, seasoning, the appraisal gap.
Nothing is a game-ified stand-in, and nothing is hidden behind a difficulty
setting — difficulty changes how much room you have to be wrong, never what a
deal is worth.

It is measured, too. A bot that follows the 70% rule, inspects before offering
and reserves 15% contingency wins 77% of tutorial campaigns and ends with about
**$278,829**. The same bot paying 92% of ARV with no inspection and no
contingency wins 47% and ends with **$154,486**. That gap is the whole thesis,
and it is checked on every commit across thirty seeded campaigns.

There is also a **Learn** mode: five short scenarios, each isolating exactly one
way a flip goes wrong.

---

### Everything else

- Four campaigns and a sandbox, three difficulty settings, and a scenario editor that shares authored deals as a self-contained code
- Procedurally drawn houses that visibly decay and visibly recover, with known defects pinned to where they actually are
- Charts you can read with the keyboard, and a table under every one of them
- Neighborhoods that gentrify or decline over years, not weeks
- Seeded and deterministic: the same seed plays out the same way, and saves capture the random stream exactly
- Free, open source, no ads, no telemetry, no account, works offline

**Play in the browser above, or download for Windows, macOS or Linux.**

Source: https://github.com/ibuilder/Property-Flipper-Game

---

## Screenshot shot-list

Five, in this order. The first is the one that has to sell it.

1. **The Deal Analyzer**, on a listing where the 70% rule and the itemised cost
   stack disagree — with the explainer expanded. This is the whole product in
   one image.
2. **A property dialog**, showing the house illustration with defect pins, the
   comp picker with a mismatch warning visible, and the condition report.
3. **The scope builder** mid-renovation, with a change order that has breached
   the contingency.
4. **A before/after pair** from the track record, with the P&L waterfall
   beneath it.
5. **The map**, with a neighborhood mid-arc and holdings pinned.

Capture at 1280 × 800 in the browser build so they match the embed.
