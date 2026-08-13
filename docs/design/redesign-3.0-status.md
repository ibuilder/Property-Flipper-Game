# Redesign 3.0 — what is built

Tracking against `redesign-3.0-handoff.md`. Written down so the next session
does not have to re-derive it from the git log.

## Decisions taken

Three questions were open when the work started and were resolved without the
author present. Each is reversible; each is stated here so it can be argued
with rather than discovered.

| Question | Decision | Why |
| --- | --- | --- |
| Light vs dark ground | **Dark default, light a real option** | Requested. It also is not a compromise: a blueprint is a cyanotype, and the handoff's own dark treatment is `--color-accent-900` / `--color-bg` / `--color-accent-400` from its own sheet. The dark theme is the same nine-step ramp read from the other end. |
| The red rule | **Adopted** | "Red appears in exactly one place: a negative projected profit." The sharpest idea in the handoff. Two tests hold the line. |
| Barlow / Barlow Condensed | **Not bundled** | The build is one self-contained file with no external fonts. Bundling costs ~40–80KB base64 and is a size decision that should be made deliberately. Falls back through platform condensed faces today, which is visibly not the same look. **Open.** |
| Balance | **Presentation must not move it; new systems re-baseline deliberately** | The handoff says balance must not move *and* proposes permits and rivals, which necessarily move it. Those cannot both hold. Every commit so far is byte-identical on the harness. |

## Phase 1 — legibility · **done**

- `Figure.tsx`; every number carries its formula, inline, never behind a
  disclosure. `explain.ts` already computed the provenance; it was hidden.
- Two max offers side by side, each showing its arithmetic in the player's own
  numbers rather than naming itself.
- The deal screen is two columns with the analyser pinned. This was the worst
  UX failure in the original.
- The plain return leads on holds under a quarter; annualised is the footnote.

## The design system · **done**

- Industry tokens, dark-first, light via `data-theme`, toggle in the HUD.
- Square geometry, hairline borders, registration marks from pseudo-elements.
- Outline tags instead of filled pills; the accent primary button is the only
  filled object.
- `tests/theme.test.ts` parses the real stylesheet, resolves `var()` and
  `color-mix()` as a browser composites them, and measures WCAG contrast on
  both grounds. It has caught two real bugs, one of them in the handoff.

## Phase 3 — Scout and mastery · **done**

- `ui/coach/rules.ts` — a flat rules table, data not logic.
- `ui/coach/Coach.tsx` — priority, cooldown, lifetime cap, mastery suppression.
- `engine/mastery.ts` — four concepts, derived from closed deals, demonstrated
  twice. Its limits are documented in the file.
- `MasteryPanel` on the Skills tab; every node names the proof, never a cost.

## Not built

| Item | Note |
| --- | --- |
| **The isometric board** | The largest remaining piece. Needs `projection.ts`, ground + overlay layers, four data views, three zoom levels, pins. The handoff's spec is complete enough to build from. Blocked on nothing but time. |
| **Commissioned art** | 7 archetypes × 4 condition states, lot furniture, 6 Scout portraits. The slots exist at final size; art drops in without layout changes. |
| **The guided first fifteen minutes** | The 7-step tour and the gate that keeps the town, financing, auctions and rentals locked until one tutorial deal closes. |
| **Permits and the inspector queue** | Genuinely new, and would move balance. |
| **Class board and instructor tools** | Deal codes, section board, CSV concept report, coach lock for assessment runs. |
| **The market news beat** | "The Weekly Plat" rail, with every item naming its mechanical consequence. |

Much of what the handoff schedules for "Systems" already existed before it was
written: crew, rivals, difficulty, seasons, neighbourhood arcs, auctions and
BRRRR are all in the engine. Its 3-week estimate for that phase is wrong in
our favour; the real remaining work is presentation.
