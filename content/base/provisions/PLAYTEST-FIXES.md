# Economy, camping and production playtest fixes — 2026-10-11

Worktree: `pf/economy`. No commits. This wave is **partial**: the provisions CPU target and default sleep/wait location behavior remain unresolved.

## Performance first

Before gameplay changes, iron_ford seed 42 / 30 days / profile / no-events / save:

| Build | Provisions ms/hour | Final hash | Save bytes |
| --- | ---: | --- | ---: |
| Crunch baseline | 12.581 | `27ac16938c1cb763` | 12,762,179 |
| Performance changes only | 7.248 | `27ac16938c1cb763` | 3,768,526 |

**PARTIAL:** 42% less provisions time; the required <=3 ms/hour is NOT met. Scoped inventory indices, cached kitchen calculations/calendar values, sparse projection tables, hoisted meal calculations, skipping unusable extra main dishes once everyone is full, and omitting discarded forecast explanations preserve the hash. Real events retain their Explains. No cadence or decision rule was reduced.

The original save's largest logical slices were log (8.266 MB) and social (3.390 MB). Lossless JSON shape/subtree interning reduces disk size without throwing away events, knowledge, replay inputs, or object independence after decode. `runs/pf-performance-only.patch` separates the performance work for the orchestrator; new serialization/calendar files are included. Evidence is in `runs/pf-perf-before`, `runs/pf-perf-after`, and the additional isolated benchmark `/tmp/coulee-pf-benchmark/runs/pf-meal-opt3`.

After gameplay changes: final isolated profile **7.939 ms/hour provisions**, 17.59 ms/hour overall, **3,897,603 bytes** at 30 days (`runs/pf-final-profile`), hash `10f05de909ad5958`, unchanged by the final meal optimizations. Concurrent gates inflate wall-clock profiles, so do not interpret those as isolated benchmarks. One-year save: 5.76 MB; the requested size cap was for 30 days.

## Finding outcomes and observed play

1. **FIXED — conservation, spread, restock.** Wages accrue only for labor at the workplace, up to eight hours/day, and Saturday payments debit the employer household. Insufficient cash becomes arrears. Unemployed actors receive no invented allowance. Every store's buyback is below the cheapest county retail quote, removing mill flour/corn arbitrage. Generated stores receive delivery rules. Randomized tests check wages, freight, and county cash during ordinary multi-day simulation. Freight is the implemented external cash boundary; taxes and the land office do not yet transact.
   - Before: blanket sold for its full $3.00 retail price; mill flour bought for 4 cents sold at Pratt's for 5.
   - After: fair `runs/pf-spread` sale moved purse $42.41 -> $44.36: $1.95 for the blanket. The catalog-wide spread regression covers both stores.
2. **FIXED — lone household stores.** Household readiness, meal preparation, fuel and water include a lone member's carried kit while at home. Before: day-zero 50% cut despite about six days carried food. After, fair generated session Explain #223: "Larder horizon and ration cut: 75 (Days of food tenths, Ration percent) -> rations_cut". That is the existing psyche-mode response to actual stores; commanded mode skips automatic ration changes.
3. **PARTIAL — camping.** Bedding, shelter, wind, rain, wetness and a fuel-paid fire affect the real thermal ledger. `sleep_rough`, `rest_at_camp`, and `make_campfire` are ordinary activity Commands available to all actors. Before: "after going to Upper Lantern Coulee, `sleep` arrived at Dunleavy's Tavern in one hour and charged $0.25."
   - After: explicit camp activities hold location and use carried supplies. However ordinary sleep/rest still resolve home, and repeating the same camp activity does not renew its lock. The fair test returned to town April 2 and resumed camping April 4; the initial April 1–15 segment was interrupted. Extending the session while alternating distinct sleep/rest Commands then held Huldra's Shelf continuously from April 4 14:00 to April 18 14:00. Fix default destinations and repeated-command locks in the scheduling/agency group.
4. **FIXED — production-lite.** Fishing, seasonal greens/ramps/morels/berries, wood gathering/chopping, and snaring produce real stacks using season, habitat, tools and skill checks. Integer fractional yield carries survive saves. NPCs execute the same hook. Foraging after exhaustion produced fresh greens and ramps worth 382 usable kcal versus 2,142/day required; gathering does not erase the calorie problem. Garden/harvest intentionally remain stubs.
5. **PARTIAL — catalog fixed, prices verb awaits UI group.** Pratt's and generated general stores stock camping gear, cookware, tools, lights, containers, cloth, tinder, arms/ammunition and other portable catalog goods, with deliveries. Kit Sheet and priced purchase actions consume the stock data. The existing provision view supplies stock prices, but the headless parser rejects `prices` with "No available action matches; use look or actions"; no play/UI files were edited. Fair seed-7 session bought an oilcloth fly from Whitlock Mercantile for $6.20. Large livestock/boats and supernatural wares are not added as general-store stock.
6. **FIXED BY CRUNCH — encumbrance.** Confirmed existing carried-load effects on travel time, fatigue and stealth/climb/swim checks; did not duplicate them. See REVIEW-FIXES.md item 4.
7. **FIXED — fourteen-day logistics experiment completed, with limitations below.** Fair iron_ford session bought a fly, 14 parched-corn units, fishing line and snare wire, then reached Huldra's Shelf April 1 noon:
   - "Food 14.0 days; 38304 usable kcal / 2142 kcal per day."
   - "Load: 42889 g; bulk 85.9; Heavy."
   - By April 5: "Thirst 0 (Parched)"; remaining food could not solve water access/capacity.
   - April 15 noon: "Food 0.0 days; 0 usable kcal / 2142 kcal per day." Load 27,775 g / bulk 67.2 / Medium. "Less than a day of stored drinking water; preparation also draws from it." "No fresh food: scurvy watch after about six weeks."
   - Choices matter for weight, water, shelter and perishability without raising staple prices. The initial segment was interrupted, but the extension completed fourteen continuous days at the Shelf (April 4–18 14:00). At the end: hunger 0, thirst 0, rest 1000, warmth 1000, load 27.8 kg. Sustained zero hunger/thirst currently does not kill the actor, so this is not a validated survival challenge. The current psyche also made an uncommanded $1.50 repayment on April 16; the agency group must gate that social action. The session did not independently quantify a fuel bottleneck; thermal/fire regression verifies real fuel consumption.
8. **PARTIAL — performance; FIXED — 30-day save size.** See measurements above.

## Validation

`just check` passed: 51 test files, 484 tests, all typechecks, Biome, invariants (156 core files), and content validation (77 files). Log: `runs/pf-check-complete.log`. `git diff --check` passed.

## Replays and balance

Fresh fair session transcripts/command logs: `runs/pf-camp-iron` and `runs/pf-camp-gen`. Original commands were repeated where still meaningful; old build command hashes cannot be replayed against changed content as though identical. Session verification: iron 116 commands, hash `9ea40fa7f77ccff3`; generated 7 commands, hash `df6d9359e5083017`. Final meal optimization also preserves the full 30-day gameplay hash.

Year run: `runs/pf-economy-year`, hash `fd35878beb5b2243`. Monthly hunger/rest/warmth means and household cash (cents):

| Date | Hunger | Rest | Warmth | Household cash |
| --- | ---: | ---: | ---: | ---: |
| Apr 1 | 764 | 711 | 998 | 49,832 |
| May 1 | 781 | 470 | 1000 | 39,576 |
| Jun 1 | 721 | 477 | 1000 | 36,022 |
| Jul 1 | 748 | 665 | 1000 | 33,107 |
| Aug 1 | 604 | 310 | 1000 | 31,093 |
| Sep 1 | 657 | 393 | 1000 | 28,975 |
| Oct 1 | 747 | 426 | 1000 | 26,724 |
| Nov 1 | 781 | 466 | 999 | 17,754 |
| Dec 1 | 801 | 464 | 975 | 15,470 |
| Jan 1 | 792 | 462 | 975 | 15,550 |
| Feb 1 | 750 | 439 | 975 | 15,623 |
| Mar 1 | 766 | 407 | 975 | 14,989 |

Most frequent chronicle titles: Accounts Settled 136, A Neighborly Act 83, A Debt Pressed 41. No winter calorie collapse in these averages; household cash declines and summer rest is poor. These means do not prove individual households are healthy or that the economy is balanced. Household cash excludes purses and tills; `countyCash` includes all three.

## Integration contracts and out-of-area edits

- `provisions/agency.ts` reads optional **`agencyMode`** through `psycheOf`. `commanded` suppresses autonomous shopping, ration cuts and board purchases. The baseline psyche has no mode field; the agency group must confirm the field name and hook standing orders into routine feeding/drinking. No `controller` rule branches were added. This adapter does not implement standing orders or their Command.
- Optional state: `employment`, `externalCashCents`, `productionCarry`. Additive wage/restock event fields; new `provisions.production` event. Domestic schema adds `buyback_pct` (65 default).
- Public items APIs add `campThermal` and `withInventoryPass`; provisions exports `countyCash`. Inventory indices may cache deep traversal, with mutation invalidation and live deletion checks.
- **Save wire format change:** CLI `--save` writes `coulee.packed-json.v1`; use exported `packJson`/`unpackJson`. `restoreSim` accepts both a legacy World and PackedJson. Play-session serialization remains unchanged. Manifest saveBytes is encoded bytes; per-slice figures are raw logical sizes, not additive encoded sizes.
- Out of area: `needs/system.ts` minimal camp thermal hook; `packages/content/src/schema/items.ts` buyback field; core serialization/index/sim restore; CLI save integration, integration tests and chronicle golden. Snapshot update reason: paid attendance, actual production and thermal exposure change schedules and stories.
- No activity scheduling/calls, psyche, social, or play UI files changed. No packages installed. No commit made.

## Changed files

- `content/base/activities/activities.toml`
- `content/base/items/wild_food.toml`
- `content/base/provisions/domestic.toml`
- `content/base/provisions/restock.toml`
- `content/base/scenarios/iron_ford/50-stocks.toml`
- `packages/cli/src/main.ts`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`
- `packages/content/src/schema/items.ts`
- `packages/core/src/index.ts`
- `packages/core/src/items/api.ts`
- `packages/core/src/needs/system.ts`
- `packages/core/src/provisions/api.ts`
- `packages/core/src/provisions/economy.ts`
- `packages/core/src/provisions/environment.ts`
- `packages/core/src/provisions/events.ts`
- `packages/core/src/provisions/meals.ts`
- `packages/core/src/provisions/planner.ts`
- `packages/core/src/provisions/state.ts`
- `packages/core/src/provisions/system.ts`
- `packages/core/src/sim/sim.ts`
- `packages/worldgen/src/population.ts`
- `content/base/provisions/PLAYTEST-FIXES.md`
- `packages/cli/test/pf-economy.test.ts`
- `packages/core/src/activity/production.ts`
- `packages/core/src/items/camping.ts`
- `packages/core/src/provisions/agency.ts`
- `packages/core/src/provisions/calendar.ts`
- `packages/core/src/provisions/employment.ts`
- `packages/core/src/serialization.test.ts`
- `packages/core/src/serialization.ts`
