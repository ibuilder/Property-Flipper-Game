# Why this is a rewrite

Notes on the state of [ibuilder/Property-Flipper-Game](https://github.com/ibuilder/Property-Flipper-Game)
and the design changes made here.

## The original did not run

```
$ python main.py
Fatal error: 'GameState' object has no attribute 'game_time'
```

It crashed on the first frame. The repository contained three mutually incompatible generations of
the same API glued together.

**The UI targeted a `GameState` that did not exist.** The Pygame views referenced 13 distinct
`game_state.*` members; `game/game_state.py` defined 5 of them.

| UI expected | Reality |
| --- | --- |
| `game_state.game_time` | never defined — the crash site, `game/ui/main_menu.py:167` |
| `game_state.properties_for_sale` | it was `market_properties` |
| `game_state.market` | no `Market` instance was ever constructed |
| `game_state.get_active_event_modifier()` | did not exist |
| `game_state.active_events` | it was `active_event`, singular |
| `game_state.locations` | it was `locations_data` |
| `game_state.selected_property_for_renovation` | never defined |
| `prop.id` | it was `property_id` |

**The engine called methods it never wrote.** `advance_day()` called `player.apply_daily_costs()`
and `player.update_renovations()`. Neither existed on `Player`, so advancing a day — the core
loop — was guaranteed to raise.

**`Player` had eight latent `NameError`s.** It imported exactly two constants but used
`MAX_LOAN_AMOUNT`, `MAX_SKILL_LEVEL`, `SKILL_UPGRADE_COST_BASE`, `NEGOTIATION_BONUS_PER_LEVEL`, and
more. Every loan and skill action would crash.

**Arity mismatches on the hottest function.** `Property.calculate_value(self, game_state)` took one
argument. It was called as `calculate_value(market, game_state)` in five places and
`calculate_value(market)` in one.

**Inconsistent data shapes.** `market.py` called `locations_data.items()`; `locations.json` was a
list. `main.py`'s dummy-file generator wrote `value_increase`/`condition_increase` keys while the
real `upgrades.json` used `value_increase_percent`/`base_cost`. `get_market_modifiers()` read
`effects` as a flat dict while the generator wrote it as a list of typed effect objects.

Also: three source files were 0 bytes (`market_event.py`, `calculations.py`, `objectives_view.py`),
`levels.json` was `[]`, `.pyc` files were committed, there was no `requirements.txt`, no tests, no
`.gitignore`, and a blanket `except` in `main.py` swallowed every traceback — which is why the
failure surfaced as one cryptic line instead of a stack.

Roughly 1,400 of ~1,900 lines were Pygame UI written against a dead API.

## The deeper problem: it could not teach flipping

Fixing the crashes would have produced a running game that still taught nothing.

`calculate_value()` was deterministic and fully visible, and you bought *at* that value and sold
*at* that value. There were no closing costs, no financing, no carrying costs, and no commission.
So profit came only from upgrades whose `value_increase_percent` exceeded their cost — a solved
arithmetic problem, not a decision.

Real flipping turns on two things the original had neither of:

- **Uncertainty.** You estimate ARV and repair cost. Both can be wrong, and the error is
  multiplicative.
- **A cost stack.** The 30% haircut in the 70% rule is not profit. It is closing costs, points,
  months of carry, and 6% commission, with profit as whatever survives.

## What changed

| Original | Now |
| --- | --- |
| Buy at computed value | Ask price, hidden seller reserve that decays with time on market, offer/reject |
| Value is known exactly | Noisy appraisal with a confidence band and comps; ARV is an estimate |
| No inspections | Inspect before offering; findings force a seller concession |
| Upgrades are a flat list | Line-item scope of work, overlapping trade schedules, contingency budget |
| No hidden problems | Defects surface as change orders mid-rehab, or as buyer concessions at closing |
| Sell instantly at value | List price drives days-on-market; carry accrues while you wait |
| No transaction costs | Closing, points, interest, tax, insurance, utilities, HOA, commission |
| Random events as a coin flip | Market index, interest rates, seasonality, per-neighborhood cycles |
| Loss = cash < 0 and no properties | Insolvency clock, loan maturity, foreclosure |
| `levels.json` was `[]` | Four campaigns with distinct capital, goals, and market regimes |
| No tests | 40 tests plus a 30-seed balance harness |

## Bugs found by building it

Three genuine modeling errors surfaced during development and are worth recording, because each was
found by a different method.

**Distressed stock was never cheap enough to flip** — found by the balance harness returning zero
deals across all seeds. The condition curve (`0.62 + 0.42c`) priced a wreck at 74% of the same house
renovated. Real gut-job comps trade closer to 45%. Widened to `0.32 + 0.76c`.

**Defect costs did not scale with house size** — found by instrumenting the sell side. A flat
$22,000 foundation repair landed identically on a 650 sqft condo and a 2,800 sqft colonial,
producing a $49,450 buyer concession on a $60,000 house. Costs now scale against a 1,600 sqft
baseline, and total defect burden is capped at 40% of as-is value.

**Sellers listed below their own reserve** — found by playing the UI, when a $152,000 offer on a
$154,210 listing was rejected. The ask premium and reserve ratio were independent draws, so roughly
one listing in six had a reserve above its asking price and would refuse a full-price offer. The
reserve is now clamped to the ask.

Two further issues were errors in the *tests* rather than the engine, and are recorded because the
engine was right both times:

- A test asserted that buying with leverage must reduce net worth. Buying below true value
  legitimately creates net worth — that is the entire business. The correct assertion is that the
  financed purchase is worth exactly the origination points less than the same purchase in cash.
- The balance harness compared strategies on average profit *per deal*. That conditions on having
  transacted, and the strategies transact at very different rates: skipping inspections keeps the
  seller's reserve high, so fewer deals clear and only the obviously-good ones close, flattering the
  per-deal number off half the volume. Final net worth — the unconditional outcome, and what the
  game scores — is what the assertions use.

## One design change driven by the harness

The inspection mechanic was originally available only after purchase. The balance harness showed
blind play earning more per deal, which was correct: an inspection you cannot act on is a pure cost.
Real due diligence happens during a contingency period, *before* closing, so that findings can
lower the offer or justify walking away.

Inspections now work on listed properties, and disclosed defects reduce the seller's reserve by 85%
of the repair cost. That single change is what makes due diligence pay, and it is the clearest
example of the simulation and the lesson being the same thing.
