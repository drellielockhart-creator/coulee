# Wave 12: cheaper household food forecasts

Decision (Ellie, 2026-10-13): make the household ration decision cheaper. Behavior may change, but it must stay faithful to P8: the planner and the sim use the same functions, and food is never one number. Baseline: `ae6868a` (branch point of `wave12/food-forecast`). No commits.

## Results

**Iron Ford runs about 22% faster, gen:town about 20%, and the county about 22% once forecasts settle.** Provisions dropped from 5.5 to 2.7 ms per game-hour at Iron Ford. The share of run time spent in the readiness projection fell from about 31% to about 12%.

| Run (ms per game-hour) | Before | After | Change |
|---|---:|---:|---:|
| Iron Ford 42, 30 d, interleaved bundle A/B (min of 3) | 13.82 | **10.81** | −21.8% |
| Iron Ford 42, `--years 1` (concurrent pair) | 19.82 | **15.85** | −20.0% |
| gen:town 7, 90 d (concurrent pair) | 13.25 | **10.61** | −19.9% |
| County, seed 41: 24 h measured after a 48 h warmup | 117.3 | 110.1 | −6% |
| County, seed 41: 72 h measured after a 96 h warmup | 130.1 | **101.2** | −22% |

The county fixture has 40 T0, 400 T1 and 2,400 T3 actors in 1,416 households, 216 of which are processed hourly.

| Provisions system (ms per game-hour) | Before | After |
|---|---:|---:|
| Iron Ford 30 d (A/B best) | 5.54 | 2.70 |
| Iron Ford year | 6.37 | 2.68 |
| gen:town 7 90 d | 3.71 | 1.76 |
| County, 72 h after 96 h | 56.0 | 28.1 |

**County day-start spike.** Measured at the day-start hour of days 4, 5 and 6, it went from 1,586, 1,384 and 1,249 ms to 1,125, 671 and 316 ms. Other hours have a median of 72 ms. In steady state only a handful of households forecast at a day start (2 to 4 per day on days 6 and 7 of the fixture). The spike that remains comes in the first days of a county, when every household forecasts at once and the near-threshold ones cannot yet hold a standing forecast. Day 4 had 202 forecasts and day 5 had 122. A per-hour stagger removes even that spike, but it distorted rationing, so it is not applied (see "Tried, measured, not applied").

The target was "most of the projected 25–40%". The result is about 20–22%. The projection estimate assumed the forecast could be skipped outright. In practice a household's cooking competes with its drinking for the same daily water, so most decisions sit close to a threshold that only the real meal kernels can settle (see the budget gate below). What remains of the forecast cost is mostly `serveMeal` (three exact meals per projected day) plus the storage kernel.

## What changed

1. **Quiet hours in decision projections** (`provisions/planner.ts`, `quietHours`). A decision (`planReadiness(..., details = false)`: the ration decision, relief reserves, the Director's tension probe) still runs the full hourly kernels at day starts (hour 0) and at every meal hour. The hours between them are stepped as quiet hours, which charge the same rules without the per-hour kernel passes:
   - The storage kernel itself (`storageHour`) runs every hour, covering rain, drying, spoilage by temperature, wetness and packaging, and vermin.
   - Thirst comes from `scheduledNeedHours`, the scheduled day's hourly need. This is the same loop as `dailyKcal`, now generalized to any need, with the ledger's labor, sleep, values, traits and weather terms. Whoever the water kernel would let drink (below 600, awake or roused) drinks with `drinkWater` from the same hauled household water that cooking draws on.
   - The home hearth burns `hearthBurn` for each hour it would be lit. The pantry pays in one draw when the woodpile covers the whole span. Otherwise the hours are replayed one by one with `heatingFuel`, so the fire goes out on the first hour the pile cannot pay, exactly as it would hourly.
   - Plates reach their diners (`preparationHour`) in the hour a meal is ready, or, for a plate left waiting, in the hour someone wakes.
   - Hourly devices step only if they burn fuel or water.

   Readouts (`details = true`: the play `plan`/readiness views, the Kit Sheet, the outfitter buy preview) still step every hour with every kernel.
2. **Planner fix: a waiting plate no longer cancels the table** (`planReadiness`, both modes). The live sim (`system.ts`) seats whoever is not still waiting on a plate. The planner used to skip the whole household's meal if any member was waiting. A sleeping child's late supper then cancelled everyone's breakfast, a day "failed", and the household cut rations with food in the larder. This was the main source of the gen:town 50% shortage notices (gen:town 7: 158 → 24 with this fix alone). P8 asks that the planner use the sim's rule, and now it does.
3. **Projection isolation.** Projected actors no longer carry this hour's live walk (`hourlyWalk`), minute budgets or journeys. All three belong to the live world. The walk was a real leak: a member walking at decision time put the projection through the needs ledger's per-walker branch with a two-actor world. This polluted that call site's inline cache, and the live ledger's spread of all 2,840 actors per walker then ran about 60× slower (county needs system: 10 → 296 ms per hour when decisions ran mid-day).
4. **Standing forecasts** (`provisions/household.ts`, `rules.ts RATION_LEASE`; state `HouseholdProvisions.rationLease`, optional and integer). A forecast of D days that leaves the ration where it was stands for `min(14, D − next cut − 1)` days. The next cut is 21 days at full rations, 10 at 90%, and 4 (the daily notice) at 75% or 50%. Full-ration forecasts look 36 days ahead (was 21), so they can stand. The household re-forecasts the same day start if any of these holds:
   - the larder (`larderKcal`) falls faster than 125% of the planned daily need;
   - on short rations, the larder gains anything (a restore may be due);
   - the table changes (the member count);
   - the ration changes.

   A forecast made at a cut ration never stands at full rations: a restore is judged at the cut ration, so it would overstate the larder. About 75% of daily decisions now keep a standing forecast (see "Fidelity").
5. **Shared helpers, no behavior change.** `hearthAt` and `hearthBurn` now back the kitchen's fire cost and the needs module's `heatPlaces`. This is one formula, called through `provisions/api.ts`. `scheduledNeedHours` exposes the `dailyKcal` loop for any need, and `dailyKcalParts` delegates to it unchanged.

Every planner run the player can see is still the full hourly projection. The decision runs the same kernels at the hours that matter for meals (cooking fire, water, cookware, time, spoilage, vermin, heating) and charges the hours between them through the same rule functions.

## Fidelity

**Decision path vs hourly readout.** At every day start of a year, for every household, the decision projection (quiet hours) and the hourly readout projection were both run at the same moment and compared (`runs/scratch/ff-validate.ts`).

| Town (365 d) | Decisions | Same days | Same ration decision |
|---|---:|---:|---:|
| Iron Ford 42 | 5,840 | 5,752 (98.5%) | 5,829 (99.8%) |
| gen:town 7 | 3,650 | 3,637 (99.6%) | 3,648 (99.9%) |
| gen:town 19 | 4,380 | 4,377 (99.9%) | 4,380 (100%) |

The 13 changed ration decisions over three town-years fall at a threshold, in both directions. Most differ by one day and a few by three to five. Five of them are Trevenna House (Iron Ford household 5), where a member's drinking timing tips a water-short supper. On its own, quiet-hour stepping makes a forecast about 17–19% cheaper: 6.3 vs 7.8 ms at Iron Ford, 7.7 vs 9.2 ms and 8.0 vs 9.5 ms in the gen towns. Most of the saving comes from standing forecasts, which remove about three in four forecasts.

**Standing forecasts** (`runs/scratch/ff-lease.ts`). On each day a household kept a standing forecast, the audit re-ran the decision projection and checked whether it would have changed the ration.

| Town (365 d) | Day-start decisions | Kept a standing forecast | Would have changed the ration |
|---|---:|---:|---:|
| Iron Ford 42 | 5,840 | 4,438 (76%) | 15 (0.34%) |
| gen:town 7 | 3,650 | 2,884 (79%) | 17 (0.59%) |
| gen:town 19 | 4,380 | 3,157 (72%) | 9 (0.29%) |

A missed change is caught within the standing period (at most 14 days, usually 1–5) or as soon as the larder outruns the plan.

## Balance (year runs, before → after)

`runs/scratch/ff-balance.ts` uses the harness's year run with an event-counting sink. Means are over the year's monthly means. "Shortage notices" counts `provisions.shortage` events, which are both cuts and the daily notice under four days, keyed by the ration they report. Nobody died in any run, before or after.

| Town | Hunger | Rest | Warmth | kcal (stat) | Shortage notices | by ration 50 / 75 / 90 | Restorations |
|---|---|---|---|---|---|---|---|
| Iron Ford 42 | 680 → 672 | 763 → 765 | 998 → 995 | 96,967 → 96,953 | 211 → 124 | 87/31/93 → 26/26/72 | 153 → 81 |
| gen:town 7 | 665 → 712 | 830 → 864 | 1000 → 1000 | 58,488 → 59,393 | 216 → 67 | 158/18/40 → 31/6/30 | 52 → 29 |
| gen:town 19 | 656 → 678 | 843 → 854 | 1000 → 1000 | 66,135 → 66,660 | 234 → 69 | 146/26/62 → 19/14/36 | 78 → 43 |

Monthly hunger means (Apr → Mar):

| Town | Before | After |
|---|---|---|
| Iron Ford 42 | 698 681 655 624 662 683 708 729 739 687 656 642 | 702 674 653 615 637 632 719 721 745 665 652 644 |
| gen:town 7 | 744 717 680 650 676 605 591 655 682 680 643 653 | 783 769 709 682 666 697 679 689 731 750 729 662 |
| gen:town 19 | 747 720 618 607 608 554 675 662 717 690 654 624 | 787 763 629 571 578 606 683 699 723 706 708 685 |

- Rationing still happens. Every town still cuts to 90%, 75% and 50% when larders run down. Iron Ford still cuts 72 times to 90% and gives 26 notices at 50%.
- The large drop in 50% notices in the gen towns comes from the planner fix (2). It no longer reports a full larder as zero days because one child's plate was waiting, so the gen towns go hungry less often (yearly hunger +22 and +47 points). Cash and kcal are flat or slightly up.
- Iron Ford is flat within run-to-run noise. Its August–September hunger dip (662 → 637 and 683 → 632) also appears with the planner fix alone on the old hourly path (614 in August). Two near-identical configurations (hourly vs quiet hours, with 99.9% identical decisions) differ by up to ±60 in a single month, so single-month differences of that size are noise.
- Iron Ford warmth reads 995 all year instead of 998–1000 in winter. That is one actor among 40 who stays cold the whole run (the April value is 995 before and after). It is not heating: the hearth formula is the same function.
- Starving and snowed-in households still cut promptly. A household without a standing forecast decides every day start as before. A standing forecast breaks the same day the larder outruns the plan, and on short rations the same day food arrives. `packages/cli/test/food-forecast.test.ts` pins these cases:
  - a larder of three hardtack cuts to 50% at day start;
  - an ample larder stays at full rations with a 14-day standing forecast;
  - emptying that larder with no store errand (snowed in) cuts the next day start;
  - a 75% household with a standing forecast restores full rations the day a full larder arrives;
  - near the 21-day threshold, a cooked larder (cornmeal, salt pork, dried apples) gets the same ration decision from the decision projection as from the hourly readout.

## Golden chronicle

`chronicle-iron_ford-42-30d.md` was refreshed deliberately (+28/−48). The reason line in `chronicle.test.ts`: *ration decisions step quiet hours, let a sleeping diner's plate wait without cancelling the table's meal, and let a forecast with days to spare stand, shifting ration cuts and downstream stories.* What changed: prose draws shift from April 16. The late-April tavern quarrel cluster (the Vance–Brenner insult and fight, two "Poor Aim" items, a "Talk" item and two "Peace Made" items) gives way to a rumor ("All Over the Ford") and an earlier debt dun. The 28 April Almanac counts five matters of note instead of eleven. No shortage story appears in either version.

## Tried, measured, not applied

**(a) A static larder budget before any projection.** A conservative check charged the same rules by the day: `recipesFor` usability with the poorest-yielding recipe, `minutesUntil` at the worst storage band in the horizon, the storage kernel's own vermin draws, the woodpile walked hour by hour with `hearthBurn`/`woodpileDelivery`, ignition supplies per lighting, and half-day water after the scheduled drinking. It decided "full rations" for only 9–12% of Iron Ford decisions. The binding resource is water. Members drink about 3 L a day each from the 5 L a member hauled for cooking, so most larders are cooking-water-limited every day. Only the real meal kernels can tell whether a day reaches half its plan. Its first version also let through two unsound cases, found by the validation harness:
- an exposed farmstead pantry (`farmstead` places count as outdoors for storage) whose tinder got rained on;
- drinking that came out of the cooking water.

A gate with 10% reach and that much special-casing was not worth its risk, so the standing forecast replaced it. That is the same idea with the budget taken from the last real forecast. The code is kept in `runs/scratch/ff-budget-gate.ts.txt`.

**(c) A per-household hour for decisions (household id mod 24).** It removed the day-start spike, but on year runs it doubled cut/restore cycles at Iron Ford and lowered gen:town 7's yearly hunger (with standing forecasts alone vs with both):

| Town | Shortage notices | 50% notices | Restorations | Hunger |
|---|---|---|---|---|
| Iron Ford 42 | 124 vs 241 | 26 vs 67 | 81 vs 159 | 671 vs 667 |
| gen:town 7 | 67 vs 95 | 31 vs 63 | 29 vs 25 | 712 vs 685 |

Decisions at varying hours fall before or after the day's shopping, which makes the restore-at-cut-ration rule flap. Since standing forecasts already remove the steady-state spike, the stagger is not applied.

## Risks and follow-ups

- **A standing forecast does not see shocks that leave the larder's kcal intact**: a lost kettle, a woodpile carried off, or wet tinder. The household notices at the next forecast, at most 14 days later. The 0.3–0.6% audit rate above includes these. If this matters, add guards on cookware count or woodpile.
- **Pre-existing restore flapping.** "Restore when D ≥ 30 days at the cut ration" judges at the cut ration, so a household restored to full can cut again the next day. Standing forecasts do not make this worse, because they never stand on a restore. A fix would judge restores at full rations, which is a design call.
- **Readouts got more optimistic** wherever a waiting plate used to cancel a meal. The new figure is the truthful one (the live table's rule).
- **First days of a county still spike** (about 1 s on day 4 of the fixture) while every household forecasts and none has a standing forecast yet. A deterministic per-household shortening of standing forecasts would spread later renewals but not the first ones.
- **`hourlyLedger`'s walker branch copies `world.activity.byActor` per walker** (needs module). It is O(actors²) at county, and fragile to V8 inline-cache state, as fix 3 shows. It is worth a lightweight override in a later perf pass.

## Method

Bundles were built with esbuild from the baseline source (`git archive HEAD`) and from the working tree (`runs/scratch/ff-mkbundle.sh`). Iron Ford 30 d is an interleaved A/B, minimum of 3 (`ff-ab.mjs`). The year and 90 d runs are concurrent base/current pairs. The county numbers come from `runs/scratch/ff-county.ts`: the 2e/2f fixture, dormancy as in M5-PLAN, warmup 48 h or 96 h, then 24 h or 72 h measured with the per-hour maximum. Balance comes from `ff-balance.ts` and `ff-cmp.py`, and the ablations from `ff-bal2.sh` with temporary flags that have since been removed. Fidelity comes from `ff-validate.ts` and `ff-lease.ts`. Scratch scripts are in `runs/scratch/ff-*`, and outputs in `runs/ff/`.

**Gate.** `VITEST_MAX_WORKERS=2 just check` passes: biome, all typechecks, 98 files / 1,041 tests, invariants (273 files) and content.

**Files touched**
- `packages/core/src/provisions/planner.ts`: quiet hours, the waiting-plate fix, projection isolation.
- `packages/core/src/provisions/household.ts`: standing forecasts and the 36-day full-ration horizon.
- `packages/core/src/provisions/rules.ts`: `RATION_LEASE`, `SHORTAGE_NOTICE_DAYS`.
- `packages/core/src/provisions/state.ts`: `rationLease`, optional.
- `packages/core/src/provisions/meals.ts`: `scheduledNeedHours`, `hearthAt`, `hearthBurn`.
- `packages/core/src/provisions/api.ts`: export of the hearth helpers.
- `packages/core/src/needs/thermal.ts`: uses `hearthBurn`.
- `packages/cli/test/food-forecast.test.ts`: new.
- `packages/cli/test/chronicle.test.ts`: reason line.
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`: refreshed.
- This report.
