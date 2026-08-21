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
| Embed | Manually set size **1280 × 800**, click "Fullscreen button" on, "Mobile friendly" **on** |

**Mobile friendly changed from off to on.** It was off because the board was one
fixed picture that rendered lots eight pixels across on a phone. The board now
sizes itself against the width it is actually given -- opening closer in when
there is less room, and holding the ink above a device pixel -- and every
control meets the WCAG 2.2 target-size minimum, checked on every push. The
market table is still wider than a phone and scrolls sideways inside its own
frame, which is worth knowing before promising too much: it is playable on a
phone, and it is more comfortable on a tablet.
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
**$32,000** a campaign, measured across a hundred seeds.

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
and reserves 15% contingency wins **72%** of tutorial campaigns and ends with
about **$262,816**. The same bot paying 92% of ARV wins **63%** and ends with
**$218,515**. That gap is the whole thesis, and it is checked on every commit
across a hundred seeded campaigns.

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

## Images

Two generators, and they are not interchangeable.

`npm run marketing` cuts the commissioned key art to each storefront's aspect
ratio. `npm run shots` photographs the running game. Key art is allowed to be a
poster; a screenshot is a claim about what the software looks like.

| Slot | File | Size |
| --- | --- | --- |
| Cover / thumbnail | `docs/marketing/cover-630x500.png` | 630 x 500 |
| Page banner | `docs/marketing/banner-1920x620.png` | 1920 x 620 |
| Link preview | `docs/marketing/social-1200x630.png` | 1200 x 630 |

**Screenshots — upload these five, in this order.** itch shows the first
largest and it is the one that has to sell the game.

| # | File | Why |
| --- | --- | --- |
| 1 | `docs/shots/03-deal.png` | The deal analyzer, with the 70% rule and the itemised cost stack disagreeing and the sentence underneath saying which is right and by how much. The whole product in one image. |
| 2 | `docs/shots/06-board.png` | The coloured town at block zoom, with a crew on site. The one that reads as a game rather than as a spreadsheet. |
| 3 | `docs/shots/05-renovation.png` | Work in progress: contracted cost, contingency remaining, carrying cost per day, and every line item with its own price and duration. |
| 4 | `docs/shots/07-sale.png` | The flip closing: the loss headline, and the card underneath naming what decided it. The game marking its own homework, which is the thing nothing else in this genre does. |
| 5 | `docs/shots/02-market.png` | The same town in the line style — a survey plat under a price ramp. Shows the board is a data view, not decoration. |

The walk now plays a complete flip, so `08-finance` and `10-track-record` have
real numbers in them and are usable as sixth and seventh if itch takes them.
`01-menu`, `04-owned` and `09-skills` are captured for the audit's sake.

> The bot loses money on that flip, and shot 4 says so. It picked a cosmetic
> scope on a house in rough condition, ate two change orders through the
> contingency, and the card names the reason. That is a fair advertisement for
> what this game is: a screenshot of the simulation refusing to let a bad
> assumption through. If a winning example is wanted instead, play one and grab
> the card — every closed flip renders one.

**Do not upload the three UI mockups.** They are branded *Flip Empire*, they
show a dozen features that do not exist, one of them states the 70% rule wrongly,
and they carry the usual generated-text damage. Reasons in full in
[docs/marketing/README.md](marketing/README.md).

---

## Uploading the images

Written down because it took an afternoon to work out and it is needed again
every time the screenshots change.

itch's cover, banner and screenshot buttons all build their `<input type=file>`
when you click them and open the operating system's file dialog, which is not
something a browser-automation tool can reach. Three findings get round it:

1. **The cover and the banner go through itch's own upload API** and can be
   driven directly: POST `action=prepare` to `/dashboard/upload-image` (add
   `?game_id=<id>` for the banner, whose `type` is `layout`), POST the file to
   the presigned target it names, then POST `csrf_token` to its `success_url`.
   Put the returned id in `game[cover_image_id]` or
   `layout[banner_image][image_id]` and save.

2. **Screenshots cannot be done that way.** The same three calls succeed and
   the form carries `screenshot[<id>][position]` correctly, and the server
   discards them on save — a screenshot has to be a game-scoped *image* record,
   which only itch's own handler creates. Uploading and wiring the ids by hand
   looks like it worked, right up until the page is reloaded.

3. **So borrow itch's own picker.** Stub `HTMLElement.prototype.click` so it
   records the file input instead of opening the dialog, call the widget's
   `pick_screenshots()`, restore the stub, then put the files in the input it
   left behind and dispatch `change`. itch's real handler does the rest, and the
   images come back properly associated.

   One catch that costs an hour: itch appends that input as a direct child of
   `<html>`, outside `<body>`, where the accessibility tree cannot see it. Move
   it into `document.body` first or nothing can address it.

**The uploads finish out of order**, and the ids are not handed out in the order
the files were submitted — do not assume the mapping. Read the rendered
thumbnails, match them to the files by eye, then set the order and save again.

---

## Theme

itch **Edit theme**. Taken from the game's own dark palette so the page and the
embed do not fight each other across the frame boundary.

| Setting | Value |
| --- | --- |
| Background | `#0f172a` |
| Background 2 | `#1e293b` |
| Background 2 alpha | `0.95` |
| Text | `#f8fafc` |
| Link | `#fbbf24` |
| Button | `#22c55e` |
| Header | `#fbbf24` |
| Body font | Inter |
| Header font | Montserrat |
| Layout | Screenshots in the sidebar |

---

## Tags

`simulation` `real-estate` `management` `economy` `educational` `finance`
`strategy` `tycoon` `singleplayer` `no-ads` `offline` `open-source`

itch allows ten; the first ten above are the ones worth the slots. `real-estate`
and `educational` are the two that carry traffic this game can actually convert
— there is very little in either tag and almost nothing that is both.

---

## System requirements

Written from what the app is rather than from a template. It is an Electron
shell around a renderer that draws SVG and does arithmetic; there is no 3D, no
asset streaming, and nothing that touches the network.

**Minimum**

- Windows 10 (1809 or later) 64-bit, macOS 11, or a 64-bit Linux with glibc 2.28+
- Any 64-bit dual-core processor
- 4 GB RAM
- 400 MB disk
- No GPU requirement, no internet connection, no account

**Or none of the above** — the browser build is a single self-contained HTML
file and runs in any current browser, including on a phone or tablet. The market
table is wider than a phone and scrolls sideways inside its own frame, so it is
playable on a phone and more comfortable on a tablet.

---

## Install instructions

**Play in the browser:** press the button above. Nothing to install, and saves
live in the browser's own storage.

**Windows:** the `…-Setup.exe` to install, or the `…-Portable.exe` to run without
installing. Unsigned builds raise a SmartScreen warning on first launch —
*More info* then *Run anyway*. (Written without the version number on purpose:
this copy is pasted once and the filenames change every release.)

**macOS:** open the `.dmg` and drag Property Flipper to Applications. Unsigned
builds need *right-click → Open* the first time, because Gatekeeper will not
open them from a double-click.

**Linux:** download the `.AppImage`, `chmod +x` it, and run it. No dependencies.

---

## Links

| Field | Value |
| --- | --- |
| Source code | <https://github.com/ibuilder/Property-Flipper-Game> |
| Issues / bugs | <https://github.com/ibuilder/Property-Flipper-Game/issues> |
| Licence | MIT |

---

## Devlogs

itch pushes a devlog to everyone who follows the project and surfaces it in the
feed and on tag pages, which makes it the cheapest reach available and the one
part of the marketing plan that is worth writing carefully.

`docs/devlog/` holds them as Markdown, ready to paste into
**Dashboard → Devlog → New post**. The first is
[2026-08-20-photographing-the-game.md](devlog/2026-08-20-photographing-the-game.md) —
what shipped in 2.2.0, framed around the six defects that turned up when the
screenshots started being taken by machine. Written that way on purpose: itch's
audience is largely other developers, "here is a bug my tooling caught and yours
would too" travels further than "here is my update", and it explains what the
game is on the way past.

---

## Other renders

`docs/design/deal-card.svg` is an example of the card the game hands you when a
flip closes — the artefact a player is most likely to post, and the cheapest
advertising this will ever get. `docs/images/board-colour.svg` and
`board-line.svg` are vector versions of the town, both written by the test run.
