# Wave 12: cheaper household food forecasts

Decision (Ellie, 2026-10-13): make the household ration decision cheaper. Behavior may change, but it must stay faithful to P8: the planner and the sim use the same functions, and food is never one number. Baseline: `ae6868a` (branch point of `wave12/food-forecast`). The first pass was committed as `9f26ad0`. This report covers that pass plus the review fixes; the review fixes are uncommitted.

## Results

**Runs are about 17–20% faster: Iron Ford 30 d −18.5%, the year −19.8%, gen:town 7 90 d −16.7%. The county is about 22% faster once forecasts settle.** Provisions fell from 5.5–6.3 to 2.0–2.8 ms per game-hour. The forecast's share of run time fell from about 31% to about 13%.

| Run (ms per game-hour) | Before | After | Change |
|---|---:|---:|---:|
| Iron Ford 42, 30 d, interleaved bundle A/B (min of 3) | 13.71 | **11.17** | −18.5% |
| Iron Ford 42, `--years 1` (concurrent pair) | 19.68 | **15.79** | −19.8% |
| gen:town 7, 90 d (concurrent pair) | 13.22 | **11.01** | −16.7% |
| County, seed 41: 24 h measured after a 48 h warmup | 117.3 | 112.3 | −4% |
| County, seed 41: 72 h measured after a 96 h warmup | 130.8 | **102.1** | −22% |

The county fixture has 40 T0, 400 T1 and 2,400 T3 actors in 1,416 households; 216 households are processed hourly.

| Provisions system (ms per game-hour) | Before | After |
|---|---:|---:|
| Iron Ford year | 6.33 | 2.82 |
| gen:town 7 90 d | 3.76 | 2.00 |
| County, 72 h after 96 h | 56.0 | 28.6 |

**County day-start spike.** On days 4, 5 and 6 the day-start hour fell from 1,576 / 1,411 / 1,224 ms to 1,232 / 672 / 324 ms; the median hour is 73 ms. In steady state only a handful of households forecast at a day start. A spike remains in the first days of a county: every household forecasts at once, and the near-threshold ones cannot yet hold a standing forecast (202 forecasts on day 4, 122 on day 5). A per-hour stagger removes that spike too, but it distorted rationing, so it is not applied (see "Tried, measured, not applied").

**Against the target.** The target was most of the projected 25–40%; this pass gets about 17–20%. The projection estimate assumed the forecast could be skipped outright. In practice a household's cooking competes with its drinking for the same daily water, so most decisions sit close to a threshold that only the real meal kernels can settle (see the budget gate below). Most of what remains is `serveMeal`, three exact meals per projected day, plus the storage kernel. The review fixes cost about 3 points of the first pass's gain: full-ration forecasts now look 40 days ahead instead of 36, and projections that used to stop early on a false failure now run on.

## What changed

1. **Quiet hours in decision projections** (`provisions/planner.ts`, `quietHours`).
   - Which calls are decisions: every `planReadiness(..., details = false)`. That is the ration decision, relief reserves (`relief.ts reliefParcel`/`householdFoodDays`) and the Director's tension probe (`api.ts tensionProvisions`).
   - What still runs in full: the hourly kernels at day starts (hour 0) and at every meal hour.
   - The hours between are stepped as quiet hours, which charge the same rules without the per-hour kernel passes:
     - The storage kernel itself (`storageHour`) runs every hour, covering rain, drying, spoilage by temperature, wetness and packaging, and vermin.
     - Thirst comes from `scheduledNeedHours`, the scheduled day's hourly need: the same loop as `dailyKcal`, generalized to any need, with the ledger's labor, sleep, values, traits and weather terms. Whoever the water kernel would let drink (able to act, below 600, awake or roused) drinks with `drinkWater` from the same hauled household water that cooking uses. A cook held at the hearth counts as awake. Anyone whose needs are frozen does not thirst.
     - The home hearth burns `hearthBurn` each hour it would be lit. The pantry pays in one draw when the woodpile covers the whole span; otherwise the hours are replayed with `heatingFuel`, so the fire goes out on the first hour the pile cannot pay, as it would hourly. On an old save whose fire has no `until`, the fire's minutes run from the span's first hour.
     - Plates reach their diners (`preparationHour`) in the hour a meal is ready, or for a waiting plate, in the hour someone wakes. Heat and thirst are settled first.
     - Hourly devices step only if they burn fuel or water.
   - Readouts (`details = true`: the play `plan`/readiness views, the Kit Sheet, the outfitter buy preview) still step every hour with every kernel.
2. **Planner: the live table's diner rule** (`planReadiness`, both modes).
   - The live table (`system.ts`) seats only members who can act, are awake and have no plate still waiting. The planner now uses that same rule, and judges each meal against the diners' plates only.
   - Orders are not consulted. The readout projects what exists as if it is eaten, so a held member without an eat order still counts, as `provisions-wave5` pins.
   - Before, any waiting plate skipped the whole household's meal. A sleeping child's late supper cancelled everyone's breakfast.
   - Before, a bedridden member's share also stayed in the day's target while their food never arrived.
   - Both made a full larder read as nearly empty and forced cuts. This was the main source of the gen:town 50% notices.
3. **Planner: lean days are not an empty larder** (`planReadiness`, both modes).
   - Old rule: the first day bringing under half its plan ended the forecast. A rainy day that wets a farmstead's tinder, or a day short of cooking water, therefore read as the end of the food.
   - The reviewer's cases: Iron Ford household 7 read 3, 2 and 1 days on days 122–124 while holding about 34 days of food; household 12 read 7 days on day 149 with 221,000 kcal in store.
   - New rule: a short day with at least a day's plan still in store (`stockKcal`, prepared or not) is a lean day. The larder counts as spent on a short day without a day's food left, or on the first of three short days running (`LEAN_STREAK`). Short last days look past the horizon for the verdict.
   - Lean days are named in the readout: "A lean day ahead: day N brings X of Y kcal (a fire, its tinder, water or time falls short that day); the larder lasts past it."
   - Charm rows (13 §5.7) are taken at the horizon itself, before any days looked past it.
   - Household 7 now reads 30, 29, 28 and 27 days on days 120–123. Household 12 reads the full horizon on day 149.
4. **Projection isolation.**
   - Projected actors no longer carry the live hour's walk (`hourlyWalk`), minute budgets, journeys or tactical frame (`tactical`, `backgroundTactical`).
   - The walk was a real leak. A member walking at decision time sent the projection through the needs ledger's per-walker branch with a two-actor world, which polluted that call site's inline cache.
   - The live ledger's per-walker copy of all 2,840 actors then ran about 60× slower. The county needs system went from 10 to 296 ms per hour when decisions ran mid-day.
5. **Standing forecasts** (`provisions/household.ts`, `rules.ts RATION_LEASE`; state `HouseholdProvisions.rationLease`, integer).
   - **How long a forecast stands.** A forecast of D days that leaves the ration where it was stands for S days. S is the most for which D − S × 1.25 ≥ next cut + 1, at most 14. The next cut is 21 days at full rations, 10 at 90%, and 4 (the daily notice) at 75% or 50%.
   - **Why the 1.25 factor.** Even at the guard's limit of 125% of planned consumption every day, the household cannot pass the next cut or the notice threshold during the standing period. Review fix: the first pass used D − next cut − 1, which gave a 75% household with D = 19 a 14-day lease. At 124% consumption that household could reach about 1.6 days of food with no cut.
   - **Horizon.** Full-ration forecasts look 40 days ahead (21 + 1 + 14 × 1.25), so they can stand 14 days.
   - **When it is broken.** The household re-forecasts at the next day start if any of these holds:
     - the larder (`larderKcal`) falls faster than 125% of the planned daily need;
     - on short rations, the larder gains anything (a restore may be due);
     - the member count changes;
     - the ration changes.
   - **Other rules.** A forecast made at a cut ration never stands at full rations: restores are judged at the cut ration. A stale forecast is dropped on any day the household makes no decision (rations not automatic, or the head may not decide).
   - About 76–80% of daily decisions now keep a standing forecast (see "Fidelity").
6. **The readout shows what the ration rests on (P1/P8).**
   - `Readiness.rations` (additive) gives the household's ration and an Explain: "Rations decided at each day start", or "Rations held on a standing forecast". The standing case has these terms: forecast day, days of food then, recheck-by day, larder then, planned kcal a day, guard percent.
   - A standing forecast also adds a warning line: "Rations held at 75% on the forecast of <date>: 19.0 days of food; rechecked by <date>, or the first morning the larder falls faster than planned or gains food."
   - The Kit Sheet or `plan` can therefore say "less than four days" beside an unchanged ration, and the reason is right there.
   - `planner.ts rationStanding` builds both for households and for a member's own view.
7. **Replay rules version 4 → 5** (`packages/play/src/session.ts`), so replay logs recorded before this change fail with a clear version error. `brawl.test.ts` pins it.
8. **Shared helpers, no behavior change.** `hearthAt` and `hearthBurn` back both the kitchen's fire cost and the needs module's `heatPlaces`, through `provisions/api.ts`. `scheduledNeedHours` exposes the `dailyKcal` loop for any need, and `dailyKcalParts` delegates to it unchanged.

## Fidelity

**Decision path vs hourly readout** (`runs/scratch/ff-validate.ts`). At every day start of a year, for every household, the decision projection (quiet hours) and the hourly readout projection ran at the same moment and were compared.

| Town (365 d) | Decisions | Same days | Same ration decision |
|---|---:|---:|---:|
| Iron Ford 42 | 5,840 | 5,789 (99.1%) | 5,828 (99.8%) |
| gen:town 7 | 3,650 | 3,646 (99.9%) | 3,649 (99.97%) |
| gen:town 19 | 4,380 | 4,375 (99.9%) | 4,379 (99.98%) |

Over three town-years, 14 ration decisions changed. All fall at a threshold, in both directions, and most differ by one day. Nine are Dunleavy's Tavern (Iron Ford household 6), whose projected thirst swings; see Risks. On its own, quiet-hour stepping makes a forecast about 15–18% cheaper: 6.3 vs 7.6 ms at Iron Ford, 7.3 vs 8.5 ms and 8.2 vs 9.4 ms in the gen towns. Most of the saving comes from standing forecasts, which remove about four in five forecasts.

**Standing forecasts** (`runs/scratch/ff-lease.ts`). On each day a household kept a standing forecast, the audit re-ran the decision projection. It counted whether the ration would have changed, and whether a daily shortage notice (under four days) was suppressed.

| Town (365 d) | Day-start decisions | Kept a standing forecast | Would have changed the ration | Notices suppressed |
|---|---:|---:|---:|---:|
| Iron Ford 42 | 5,840 | 4,426 (76%) | 18 (0.41%) | 4 |
| gen:town 7 | 3,650 | 2,907 (80%) | 2 (0.07%) | 0 |
| gen:town 19 | 4,380 | 3,482 (80%) | 12 (0.34%) | 5 |

Fourteen of Iron Ford's 18 are Dunleavy's Tavern (household 6). Its forecast swings because a member's thirst runs to zero in the projection. That is a projection artifact, and the live household keeps eating. A missed change is caught within the standing period (at most 14 days, usually 1–5), or the morning the larder outruns the plan.

## Balance (year runs, before → after)

**How it was measured.** `runs/scratch/ff-balance.ts` runs the harness's year with an event-counting sink. Hunger, rest and warmth are averages of the monthly means. "Shortage notices" counts `provisions.shortage` events: both cuts and the daily notice under four days, keyed by the ration each reports. Nobody died in any run, before or after.

| Town | Hunger | Rest | Warmth | kcal (stat) | Shortage notices | by ration 50 / 75 / 90 | Restorations |
|---|---|---|---|---|---|---|---|
| Iron Ford 42 | 680 → 698 | 763 → 765 | 998 → 996 | 96,967 → 97,827 | 211 → 66 | 87/31/93 → 2/5/59 | 153 → 58 |
| gen:town 7 | 665 → 715 | 830 → 868 | 1000 → 1000 | 58,488 → 59,486 | 216 → 36 | 158/18/40 → 7/5/24 | 52 → 24 |
| gen:town 19 | 656 → 724 | 843 → 875 | 1000 → 1000 | 66,135 → 67,335 | 234 → 37 | 146/26/62 → 3/3/31 | 78 → 31 |

Monthly hunger means (Apr → Mar):

| Town | Before | After |
|---|---|---|
| Iron Ford 42 | 698 681 655 624 662 683 708 729 739 687 656 642 | 707 702 674 687 658 705 703 715 742 713 676 689 |
| gen:town 7 | 744 717 680 650 676 605 591 655 682 680 643 653 | 788 777 747 703 722 716 690 667 713 725 698 636 |
| gen:town 19 | 747 720 618 607 608 554 675 662 717 690 654 624 | 792 795 683 732 696 716 726 694 727 734 701 695 |

**Takeaways**
- **Hunger and rest improved in every town.** Yearly hunger rose by 18, 50 and 68 points; the worst month rose by 34, 45 and 129 points.
- **Rationing still happens when larders run down.** Iron Ford still cuts to 90% 59 times and gen:town 7 24 times.
- **Most of the old severe notices were false.** The 50% notices came mostly from planner errors (fixes 2 and 3): a waiting plate, a bedridden member's share, or a rainy day read as an empty larder. Each made a household eat at half rations with food in store.
- **Iron Ford warmth reads 995–996 instead of 998–1000 in winter.** That is one actor in 40 who stays cold all run (April reads 995 before and after); the hearth formula is the same function.
- **Starving and snowed-in households still cut promptly.** A household without a standing forecast decides at every day start as before. A standing forecast breaks the morning the larder outruns the plan, and on short rations the morning food arrives.

`packages/cli/test/food-forecast.test.ts` pins these cases:
- a larder of three hardtack cuts to 50% at day start;
- an ample larder stays full with a 14-day standing forecast;
- emptying that larder with no store errand (snowed in) cuts at the next day start;
- a 75% household with a standing forecast restores full rations the day a full larder arrives;
- a two-person household with one bedridden adult and a full larder does not cut;
- the readout names the standing forecast with its Explain terms and warning line;
- near the 21-day threshold, a cooked larder (cornmeal, salt pork, dried apples) gets the same ration decision from the decision projection as from the hourly readout.

## Golden chronicle

`chronicle-iron_ford-42-30d.md` was refreshed twice: in `9f26ad0`, and again for the review fixes (+46/−40).

The reason line in `chronicle.test.ts` reads: *forecasts seat only the diners the live table would, ride out lean days, and stand no longer than the larder guard allows; the April stores never run short.*

What changed: April's second week reports "stores ran short not once" instead of once. Prose draws shift from April 17: a threat at Brenner House, a fight at Penhallow Diggings with its peace, and a brawl at Ferryman's House replace the Dunleavy–Brenner brawl, its peace and the 20¢ dun. No shortage story appears in either version.

## Tried, measured, not applied

**(a) A static larder budget before any projection.**
- **What it checked.** A conservative check charged the same rules by the day:
  - `recipesFor` usability with the poorest-yielding recipe;
  - `minutesUntil` at the worst storage band in the horizon;
  - the storage kernel's own vermin draws;
  - the woodpile, walked hour by hour;
  - ignition supplies per lighting;
  - half-day water after scheduled drinking.
- **Reach.** It decided "full rations" for only 9–12% of Iron Ford decisions.
- **Why so few.** Water binds. Members drink about 3 L a day each from the 5 L per member hauled for cooking, so most larders are short of cooking water every day, and only the real meal kernels can tell whether a day reaches half its plan.
- **Unsound cases.** Its first version let two through: an exposed farmstead pantry whose tinder got rained on, and drinking that came out of the cooking water.
- **Outcome.** The standing forecast replaced it: the same idea, with the budget taken from the last real forecast. The code is in `runs/scratch/ff-budget-gate.ts.txt`.

**(c) A per-household hour for decisions (household id mod 24).** It removed the day-start spike. On year runs, though, it doubled cut/restore cycles at Iron Ford and lowered gen:town 7 hunger. The table compares standing forecasts alone with standing forecasts plus the stagger (first-pass build):

| Town | Shortage notices | 50% notices | Restorations | Hunger |
|---|---|---|---|---|
| Iron Ford 42 | 124 vs 241 | 26 vs 67 | 81 vs 159 | 671 vs 667 |
| gen:town 7 | 67 vs 95 | 31 vs 63 | 29 vs 25 | 712 vs 685 |

Decisions at varying hours fall before or after the day's shopping, which makes the restore-at-cut-ration rule flap. Standing forecasts already remove the steady-state spike, so the stagger is not applied.

## Risks and follow-ups

- **Shocks the standing forecast cannot see.** A lost kettle, a woodpile carried off or wet tinder leaves the larder's kcal intact, so the standing forecast misses it. The household notices at the next forecast, at most 14 days later; the audit rate above includes these. Guards on cookware or woodpile would cover it.
- **Lean days and real hunger.** A chronic shortfall is still caught: three short days running, or a short day without a day's food in store. A shortfall that alternates good and bad days is not. Each lean day is named in the readout.
- **Pre-existing restore flapping.** "Restore when D ≥ 30 days at the cut ration" is judged at the cut ration, so a household restored to full can cut again the next day. Standing forecasts never stand on a restore. Judging restores at full rations would fix it, but that is a design call.
- **Readouts read longer** wherever a waiting plate, a bedridden member or a lean day used to end the forecast. The new figures follow the live table's rules.
- **Projection artifact (Iron Ford household 6).** A member's projected thirst runs to zero, so the forecast swings day to day. Worth a separate look at the projection's drinking for that household.
- **First days of a county still spike** (about 1.2 s on day 4 of the fixture).
- **County-scale cost in the needs module.** `hourlyLedger`'s walker branch copies `world.activity.byActor` once per walker. At county scale that is O(actors²), and it is sensitive to V8 inline-cache state (fix 4). It is worth a lightweight override in a later perf pass.

## Method

- Bundles were built with esbuild from the baseline source (`git archive` of `ae6868a`) and from the working tree (`runs/scratch/ff-mkbundle.sh`).
- Iron Ford 30 d is an interleaved A/B, minimum of 3 (`ff-ab.mjs`). The year and 90 d runs are concurrent base/current pairs.
- County numbers come from `ff-county.ts`: the 2e/2f fixture, with dormancy as in M5-PLAN.
- Balance comes from `ff-balance.ts` and `ff-cmp.py`, and the ablations from `ff-bal2.sh`. Fidelity comes from `ff-validate.ts` and `ff-lease.ts`, and the projection traces from `ff-probe3.ts` and the reviewer's `rev-ff-why.ts`.
- Scripts are in `runs/scratch/`, outputs in `runs/ff/`.

**Gate.** `VITEST_MAX_WORKERS=2 just check` passes: biome, all typechecks, 98 files and 1,043 tests, invariants (273 files) and content.

**Files touched**
- `packages/core/src/provisions/planner.ts`: quiet hours, the diner rule, lean days, projection isolation, `rationStanding`.
- `packages/core/src/provisions/household.ts`: standing forecasts, guard-bounded length, the 40-day full-ration horizon, dropping stale forecasts.
- `packages/core/src/provisions/rules.ts`: `RATION_LEASE`, `SHORTAGE_NOTICE_DAYS`.
- `packages/core/src/provisions/state.ts`: `rationLease`, optional.
- `packages/core/src/provisions/api.ts`: `Readiness.rations` and the hearth helper exports.
- `packages/core/src/provisions/meals.ts`: `scheduledNeedHours`, `hearthAt`, `hearthBurn`.
- `packages/core/src/needs/thermal.ts`: uses `hearthBurn`.
- `packages/play/src/session.ts`: rules version 5.
- `packages/cli/test/brawl.test.ts`: version pin.
- `packages/cli/test/food-forecast.test.ts`: new.
- `packages/cli/test/chronicle.test.ts`: reason lines.
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`: refreshed.
- This report.
