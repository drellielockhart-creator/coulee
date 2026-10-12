# Crunch review fixes

Branch `fix/crunch`, baseline `ca48292`. No commit was made. The regression cases live in `packages/cli/test/provisions.test.ts` and `content-items.test.ts`.

## Findings

1. **FIXED — store credit.** Credit purchases create mirrored social obligations through `social.extendCredit`; settlement and forgiveness synchronize every owned store tab from the same debt ledger. Regressions cover opening debt, new credit, repayment restoring capacity, forgiveness, and netting against an existing keeper debt. Stores without a keeper cannot issue unsecured credit.
2. **FIXED — shopping nutrition.** Grocery decisions cover preparable fat, Fresh and protein targets before cheap energy, use diet history, and explain targets. Alcohol does not substitute for groceries. A starving household with an empty pantry seeks commerce rather than an impossible meal.
3. **FIXED — nested pack bulk.** Soft containers occupy their contents plus shell overhead; ancestor checks use projected relocation and reject atomically. Rigid shells accommodate declared capacity. Regression includes two blankets inside a knapsack inside a haversack and overflow through an additional enclosing bag.
4. **FIXED — load consequences.** Small actors have 75% capacity; carried load increases labor fatigue and movement time, blocks movement above 150%, and adds named stealth/climb/swim check modifiers. Shared APIs supply the applied Explain terms.
5. **FIXED — readiness days.** Projection judges complete 24-hour windows against 50% of the full daily ration, includes pending meal completions, and uses the runtime actor/household preparation budgets. An unavailable cold lunch no longer ends a cornmeal forecast. Projection does not mutate the caller.
6. **FIXED — carried drinking water.** NPC and command drinking debit the same physical source as cookery; refilling validates accessible sources, liquid capacity and enclosing containers. Readiness includes drinking demand. Headless actions expose refill. No water-source activity grants fictitious thirst recovery.
7. **FIXED — preparation duration.** Resources and portions become pending batches; calories arrive on completion. Active work is serial and reserves cook activity; unattended time overlaps other work. Pending output survives JSON continuation, and the planner executes the same kernel. Household meals use the best available cook. Content distinguishes hands-on preparation from elapsed simmering/baking time.
8. **FIXED — ignition.** A new cooking fire requires accessible ignition gear, dry tinder and fuel; the selected dry strikes and tinder are charged, and the resulting fire is tracked. Existing fires and lit hearths supply credit to both recipes and readiness.
9. **FIXED — oysters.** Opening requires cut/pry capability. Partial tins become a one-day opened endpoint; untouched units retain sealed protection and shelf life. Quantity and partial servings are conserved.
10. **FIXED — frost.** Potatoes and eggs use `frozen_ruins`. Frozen preparation adds 50% thawing time/fire through `recipesFor`, shared by projection and runtime.
11. **FIXED — protein physiology.** Content defines protein targets, deficiency/recovery thresholds, minimum history and fatigue effect. Equal-energy low-protein and adequate diets diverge; protein contributes to malnutrition independently of fat and energy.
12. **FIXED — nutrition Explain.** Named terms expose rolling intake, thresholds, history, hysteresis and the energy/fat/protein branches. Fresh-food and alcohol conditions likewise show their causes.
13. **PARTIAL — catalog coverage.** Coverage follows the current P8 rows; missing foods, wrappers, cookware and containers are present. Dutch ovens support cook/boil. Replacement horn arrows and English scrapers are the current goods; old ids remain compatibility aliases. Prices and intentional unit/preparation differences are documented in `../items/CATALOG-NOTES.md`. Preservation jobs, wet-moss creel cooling, rubber frost cracking, tobacco wet ruin/keeping and the lard frying-ingredient morale bonus remain unimplemented conditional behaviors; the notes identify them explicitly.
14. **FIXED — repeated inventory scans.** A pass-local location index supplies kitchen fuel, liquid and affordances together. Quantity/deletion changes are observed live; callers rebuild the index for subsequent passes after structural changes. Proposal caches live on the ephemeral hourly context, never world state. Controlled 200-meal comparison: 1,000 → 200 whole-table scans (80% reduction), 145 → 53 ms. This is a kernel benchmark, not a whole-simulation speed claim.

## Shared hearth and winter calibration

Heating and cookery use a shared physical fire interval. A cookstove's paid cooking interval heats its home; an already heated hour supplies the kitchen. Longer preparations buy only uncovered fire time. Regression verifies heating-first and cooking-first charging.

The seed-42 chronicle golden was deliberately refreshed because physical drinking, pending preparation, load/travel, diet selection and synchronized debt change actor schedules and witnessed events.

**PARTIAL — winter calibration.** Winter is survivable after fixing the scheduling loop and increasing dried-apple deliveries (240-lb target/80-lb maximum) while reducing closed-river delivery to 35%. Hunger/rest no longer collapse across most families, and expensive foods remain constrained by store inventory and the same cash/credit rules. Concentration in poor households cannot be claimed: wages still pay six days irrespective of attendance and have no general cost-of-living drain. This is a separate employment/economy balance problem, not a reason to disguise deficiency thresholds or multiply historical food prices. The improvident Fenns remain protein-malnourished; rich households with missed meals also retain hardship.

Both complete runs used iron_ford seed 42, 8,760 hours, `--years 1 --no-events --save --profile`. Artifacts are in `runs/crunch-before/` and `runs/crunch-after/` (gitignored). The final hash is `2af235f6d2519d36`. Winter means cover December–February inclusive (91 days).

| Winter mean | Before | After |
|---|---:|---:|
| Hunger, 0–1000 (higher is better) | 343.6 | 759.0 |
| Rest, 0–1000 | 332.5 | 495.8 |
| Warmth, 0–1000 | 870.4 | 976.7 |
| Daily consumed kcal, whole town | 69,703 | 103,901 |
| Actors with a scurvy condition | 36.1 | 4.6 |

At year end: malnourished **40 → 5**, full scurvy **40 → 4**, starving **27 → 2**, exhausted **24 → 2**; all 40 remain alive. The whole-year profile is **15.32 → 28.89 ms/game-hour**, provisions **4.757 → 15.668 ms/hour**. The final profile overlapped the full gate, so it is not a controlled throughput comparison; it nevertheless does not support a whole-sim speedup claim. Pending preparation, physiology, water, ignition and shared heating add projection work. The meal scan benchmark is the isolated performance evidence.


## Out-of-area integration hooks

- `needs/api.ts`: physical water/projection and actionable food-seeking urges.
- `needs/system.ts`: load/deficiency fatigue, shared age-scaled physiological expenditure, removal of fictitious activity/source drinking.
- `needs/thermal.ts`: shared heating/cooking fire charge.
- `activity/api.ts`: hands-on preparation reservation.
- `activity/system.ts`: load transit limits and retention of the requested activity on arrival.
- `social/api.ts`: credit creation through the obligation ledger.
- `social/interact.ts`: synchronize tabs after repayment/loan/forgiveness and compose shared load modifiers into relevant checks.
- `packages/play/src/actions.ts`: additive refill offer/validation.
- `packages/cli/test/psyche.test.ts`: isolate hunger-versus-duty fixtures from recent meals and the pre-meal snack window; preserve the arbitration assertions.
- CLI play tests: wait for load-aware travel, assert completed rather than instant meals, and use controlled conversation timing instead of brittle NPC trajectories.
- Chronicle golden: authorized deliberate refresh.

These hooks are required to make provisions/items consequences execute through their owning modules. Existing exported shapes are additive; new optional stack/preparation fields remain JSON data.

## Monthly and household comparison

Monthly means over every daily stats row; hunger/rest/warmth are on 0–1000.

| Month | Hunger before → after | Rest before → after | Warmth before → after | Town kcal/day before → after | Cash cents before → after | Scurvy cases before → after |
|---|---:|---:|---:|---:|---:|---:|
| 1855-04 | 696.4 → 793.4 | 590.9 → 508.4 | 1,000.0 → 1,000.0 | 88,329.1 → 96,222.8 | 70,255.9 → 69,508.8 | 0.0 → 0.0 |
| 1855-05 | 673.3 → 731.4 | 564.1 → 460.5 | 1,000.0 → 1,000.0 | 90,424.6 → 95,927.4 | 120,676.7 → 116,590.3 | 11.9 → 1.2 |
| 1855-06 | 618.6 → 699.6 | 529.2 → 458.5 | 1,000.0 → 1,000.0 | 87,056.4 → 95,105.1 | 174,843.6 → 168,353.7 | 39.9 → 3.1 |
| 1855-07 | 575.5 → 611.0 | 519.5 → 433.0 | 1,000.0 → 1,000.0 | 82,722.8 → 90,063.4 | 229,103.5 → 219,237.6 | 40.0 → 4.0 |
| 1855-08 | 530.5 → 612.0 | 469.5 → 426.5 | 1,000.0 → 1,000.0 | 80,145.7 → 91,975.1 | 280,993.7 → 268,246.4 | 40.0 → 4.0 |
| 1855-09 | 503.2 → 668.7 | 430.2 → 469.3 | 1,000.0 → 1,000.0 | 76,279.2 → 93,487.5 | 335,631.9 → 319,919.6 | 40.0 → 4.0 |
| 1855-10 | 544.2 → 751.2 | 461.4 → 464.1 | 1,000.0 → 1,000.0 | 82,695.0 → 96,538.0 | 383,770.7 → 363,558.4 | 39.5 → 6.0 |
| 1855-11 | 549.9 → 798.2 | 474.8 → 486.2 | 998.1 → 998.8 | 76,618.7 → 98,055.6 | 430,626.2 → 403,172.0 | 36.0 → 7.0 |
| 1855-12 | 428.5 → 788.0 | 399.6 → 504.2 | 927.5 → 978.7 | 74,401.0 → 104,038.3 | 485,486.1 → 454,428.5 | 33.5 → 5.9 |
| 1856-01 | 308.6 → 743.7 | 314.5 → 489.6 | 795.1 → 974.6 | 71,927.8 → 105,171.4 | 541,517.2 → 509,789.7 | 35.9 → 4.0 |
| 1856-02 | 290.3 → 744.2 | 279.9 → 493.3 | 889.9 → 976.9 | 62,302.6 → 102,397.4 | 595,251.9 → 563,852.3 | 38.9 → 4.0 |
| 1856-03 | 222.9 → 718.4 | 204.7 → 489.6 | 992.0 → 997.3 | 53,168.0 → 94,352.7 | 649,601.8 → 615,903.4 | 40.0 → 4.0 |

End-of-year household means and affected members. A condition count is not a mortality count.

| Household | Hunger before → after | Rest before → after | Malnourished before → after | Full scurvy before → after |
|---|---:|---:|---:|---:|
| pratt | 804 → 890 | 718 → 752 | 2 → 0 | 2 → 0 |
| brenner | 0 → 806 | 0 → 642 | 3 → 0 | 3 → 0 |
| tveit | 0 → 772 | 0 → 623 | 2 → 0 | 2 → 0 |
| kvale | 0 → 868 | 60 → 566 | 2 → 0 | 2 → 0 |
| trevenna | 707 → 921 | 633 → 783 | 3 → 0 | 3 → 0 |
| whitcomb | 404 → 432 | 338 → 408 | 4 → 2 | 4 → 2 |
| moe | 0 → 912 | 60 → 538 | 2 → 0 | 2 → 0 |
| dunleavy | 0 → 853 | 15 → 614 | 4 → 0 | 4 → 0 |
| bell | 0 → 914 | 0 → 770 | 3 → 0 | 3 → 0 |
| hurd | 625 → 899 | 828 → 608 | 1 → 0 | 1 → 0 |
| stoughton | 0 → 588 | 0 → 989 | 1 → 0 | 1 → 0 |
| glover | 0 → 912 | 26 → 820 | 3 → 0 | 3 → 0 |
| haugen | 0 → 636 | 0 → 525 | 2 → 0 | 2 → 2 |
| fenn | 884 → 908 | 882 → 836 | 3 → 3 | 3 → 0 |
| pascoe | 0 → 244 | 40 → 532 | 3 → 0 | 3 → 0 |
| hatch | 860 → 844 | 628 → 728 | 2 → 0 | 2 → 0 |

The two surviving catastrophic cases are Tobias Vik and Ezra Sloat in the Whitcomb household: their occupations confine them at Lantern Spring/The Cold Stair, and their shared pantry is at Dunleavy’s Tavern. They cannot reach its food despite household cash. Physical provisioning for confined actors is still needed. Haugen calories and protein are adequate but keeping produce is insufficient. The Fenns eat almost exclusively pork/apples, meeting energy while protein is only 38–41% of target. These are visible remaining confinement/kit/diet problems rather than a townwide shortage.

## Changed files

- `content/base/items/CATALOG-NOTES.md`
- `content/base/items/ammunition.toml`
- `content/base/items/animals_tack_boats.toml`
- `content/base/items/cookery.toml`
- `content/base/items/fire_light.toml`
- `content/base/items/folk_magic.toml`
- `content/base/items/packs_bedding.toml`
- `content/base/items/provisions.toml`
- `content/base/items/shelter.toml`
- `content/base/items/trade_goods.toml`
- `content/base/items/wild_food.toml`
- `content/base/provisions/REVIEW-FIXES.md`
- `content/base/provisions/domestic.toml`
- `content/base/provisions/nutrition.toml`
- `content/base/provisions/ration_policies.toml`
- `content/base/provisions/restock.toml`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`
- `packages/cli/test/content-items.test.ts`
- `packages/cli/test/play-reconciliation.test.ts`
- `packages/cli/test/play-session.test.ts`
- `packages/cli/test/play.test.ts`
- `packages/cli/test/provisions.test.ts`
- `packages/cli/test/psyche.test.ts`
- `packages/content/src/schema/items.ts`
- `packages/core/src/activity/api.ts`
- `packages/core/src/activity/system.ts`
- `packages/core/src/items/api.ts`
- `packages/core/src/items/containers.ts`
- `packages/core/src/items/encumbrance.ts`
- `packages/core/src/items/state.ts`
- `packages/core/src/items/view.ts`
- `packages/core/src/needs/api.ts`
- `packages/core/src/needs/system.ts`
- `packages/core/src/needs/thermal.ts`
- `packages/core/src/provisions/api.ts`
- `packages/core/src/provisions/commands.ts`
- `packages/core/src/provisions/economy.ts`
- `packages/core/src/provisions/environment.ts`
- `packages/core/src/provisions/events.ts`
- `packages/core/src/provisions/meals.ts`
- `packages/core/src/provisions/nutrition.ts`
- `packages/core/src/provisions/planner.ts`
- `packages/core/src/provisions/rules.ts`
- `packages/core/src/provisions/state.ts`
- `packages/core/src/provisions/system.ts`
- `packages/core/src/social/api.ts`
- `packages/core/src/social/interact.ts`
- `packages/play/src/actions.ts`

## Chronicle density

Final year: 63 × **A Neighborly Act**, 42 × **Ill Luck**, 31 × **Accounts Settled**, 29 × **A Timely Kindness**, 28 × **A Brawl at Dunleavy's Tavern**, 25 × **A Good Neighbor**, 21 × **Through the Worst**, 20 × **A Poor Return**, 18 × **First at Every Door**, 18 × **All Over the Ford**, 16 × **In Want**, 14 × **A Poor Aim at Ferry Landing**. No routine per-actor/hour need events were reintroduced.

## Validation

Focused provisions/content/chronicle regressions passed (123 tests before the added recovery case); the expanded provisions suite passed all 33 tests and the fixture-adjusted psyche suite passed all 9. Typecheck, invariant and content gates passed separately. **Final `just check`: PASS** — Biome, all package/script typechecks, 41 suites/408 tests, invariants (146 core files) and content validation (77 files). The final saved year also has zero `findNonIntegers` findings. The ignition correction changes the final hash to `2af235f6d2519d36`, while every daily stats row remains identical to the earlier calibrated year. No commit was made.
