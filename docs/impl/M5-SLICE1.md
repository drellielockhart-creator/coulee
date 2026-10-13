# M5 slice 1: Walk to the neighbor

Implementation report, 2026-10-12. Branch `wave6/m5-slice1`, baseline `1b6abdb`. No commit. This implements M5-PLAN §§1–3 within §6 slice 1: hourly boundaries, both small populations hourly, no T0 change.

## Delivered contracts and boundaries

- Optional `World.region` and `activity.journeys`; standalone saves/sources retain absent fields. Region v1 owns the authored graph, site registry, known destinations, private road addresses and geographic location query. Content owns `RegionDef`/`RegionEdge`, including directed costs and preserved future crossing/season/hazard metadata.
- Foundation's idempotent `installSite(world, content, siteId)` installs only that site's geometry. Both authored populations are allocated once at creation before the existing module initializers. Arrival never reinitializes actors, pantries or shops. Deferred population materialization and canonical census reservation remain slice 2; this API is not a claim of general county installation.
- Activity owns `TravelOrder`, `Journey`, `travelInterval`, validation, authorized start/continuation and the preparation/commit/finalization hooks. Integer feet carry fractional numerators; unused whole minutes continue across junctions. Final spare minutes are waiting. Commands: `activity.travel`, `stop`, `resume`, `turn_back`, `camp`. NPC intentions can call the same authorized start API; no automatic NPC journeys are added.
- `provisions.tripReadiness` and the optional itinerary argument/result on `readinessOf` project the same needs, travel and provisioning kernels. Walking admits only carried cold/zero-preparation foods and carried water. Stopped cooking uses existing real cookware, ignition, water, fuel and time. Resuming extinguishes roadside heat and waits for unfinished roadside meals. No relief, credit or charity policy changed.
- Fair route previews are zero-time `activity.observe` queries. Forecasts name hourly rounding, walking minutes, arrival time, foods/servings/spoilage, kcal/protein/fat/Fresh, water, fuel, load and rest, with self-knowledge Explain. Future vermin/preparation checks are labeled with time, road and consequences; the projection assumes no loss/success without sampling RNG. Outside fixed weather, departure weather is an explicit assumption. Dynamic weather/encounters and multi-day uncertainty belong to later slices.
- Headless text/menu and the web route card send the same offered Commands. Journey location shows the road/direction/feet; private addresses prevent distant walkers witnessing each other. Arrival selects the destination site. Arrival, critical vitals/water and camp decisions interrupt. The web hides the departed town canvas on the road. No region map or phone performance claim.

The authored `iron_ford_neighbors` scenario extends unchanged Iron Ford with Martha and Jonas Hale at Cedar Farm. Cedar Ridge Road is 60,000 feet, with directed base costs 250/240 minutes. The test fixture pins dry, calm 55°F weather. The ordinary daily limit is eight walking hours, with an eight-hour camp.

## Verification

Targeted travel tests: **16 passed** (13 integration, 3 arithmetic). Coverage includes outbound/return, no reseeding, mid-edge save/load/fork/replay, exact fixed-weather elapsed time/water/physical needs/nutrition, integer state, commanded and NPC agency, revoked authorization, remote pantry/workplace/shop/care exclusion, private occupancy/views, invalid/disconnected/boat routes, stop/resume/repeated turn-back, real camp rest/daily interrupts, exhausted supplies and extinguished roadside heat.

`VITEST_MAX_WORKERS=4 just check` passed: **69 test files, 744 tests**, Biome, all package/script typechecks, invariants (214 files), and content validation (103 files). The full suite took 769.18 seconds, including the 50 generated-town 30-day runs. `just web-build` passed. Golden snapshots remain unchanged. Validation artifacts are in gitignored `runs/scratch/check-final.txt` and `runs/scratch/web-build.txt`.

### Legacy 30-day proof

Captured on `1b6abdb` before edits, with the original content bundle, then repeated under this implementation for 720 hours without a region:

| Source / seed | Before | After, original bundle | All stats rows |
| --- | --- | --- | --- |
| `iron_ford` / 42 | `452d392e6ace6b4e` | `452d392e6ace6b4e` | Identical |
| `gen:town` / 7 | `ba0fe2d136d68320` | `ba0fe2d136d68320` | Identical |

The new authored content necessarily changes the bundle fingerprint stored in `world.meta.contentHash`. Expanded-bundle raw hashes are `b8f044ef03da7896` and `319d1e0ae3ed222f`. Normalizing **only that metadata field** to the respective pinned run yields exactly the two original hashes above; every other serialized state/log byte and every stats row matches. Product hash computation is unchanged. The reproducible comparison and frozen bundle are `runs/scratch/legacy-proof.ts`, `m5-baseline-content.json`, `legacy-proof.json` and `legacy-proof-final.txt`; original CLI runs used `--days 30 --no-events`. No golden update.

## Fair session-mode playtests

Content hash: `b9a326b6610817f8fc55f747dbbbf672b077d1d160c2a44a191f14f7aec29f22`. Source `iron_ford_neighbors`, seed 42, standard newcomer Ellis Wayfarer. Both personas used fair observations and one CLI command per call, with no world edits or god observations. The same newcomer kit is intentional: Catalog kid tests planning decisions rather than a separate character-generation preset.

**Greenhorn**, `runs/w6-m5s1-4`: sleep → wait 5h → route Cedar Farm → travel Cedar Farm → wait 10h (arrival interrupts) → go Cedar Farm fields → sleep → wait 16h → route Iron Ford → travel Iron Ford → wait 10h. Queries do not enter the replay log. `--verify`: **11 commands; final hash `69a65f023d979aab`**.

> Route to Cedar Farm: 6 hours to arrival (hourly boundaries; final spare minutes are waiting).

> Carried provisions: 643 kcal, protein 18 g, fat 34 g, Fresh 15; water 1396 ml used / 4304 ml left; fuel 0.

> Ellis Wayfarer — walking on Cedar Ridge Road, 11520 feet from this leg's entrance; only carried supplies are at hand.

> Here: no one else.

> You arrive at Cedar Farm gate (360 min on foot).

Return preview: five hours, 868 kcal, 704 ml water and rest 303/1000; Monday 11:00 arrival reports rest 303. Return text:

> You arrive at Dunleavy's Tavern (300 min on foot).

**Catalog kid**, `runs/w6-m5s1-5`: sleep → wait 5h → empty kettle → route Cedar Farm → fetch water → route Cedar Farm → travel Cedar Farm → wait 10h → go Cedar Farm fields → sleep → wait 14h → route Iron Ford → travel Iron Ford → wait 10h. `--verify`: **14 commands; final hash `6320a4b44f72f0e9`**. The first preview left 552 ml at arrival. Refilling before departure raised the forecast reserve to 4,948 ml, with 752 ml used and rest 451. Actual arrival was Sunday 14:00, rest 451. Return forecast and Monday 11:00 arrival both report rest 381.

Confusion/triage: in the exploratory Greenhorn transcript, `sleep` at the farm gate yard was refused with the too-generic “Use a regional travel order to leave this site.” The visible local destination menu led to the farm fields, where the ordinary camp action worked. A future copy pass should distinguish unavailable lodging from intersite movement. No hidden help or stocked pantry was required. Hourly waiting is conspicuous but labeled; long waits stop exactly on arrival. Final verified transcripts supersede exploratory sessions 1–3, recorded while implementation was changing.

## Performance baseline

Node 26 desktop measurements, six initial core hourly frames per source. The regional payload/save snapshot is after one departure hour; legacy is after six ordinary hours. View time includes fair observation plus viewmodel. These are core timings, not browser render or phone measurements; warm-up dominates the maximum and they do not establish scaling or speedup. Measured while the validation host was also running tests.

| Measurement | Iron Ford | Two-site fixture |
| --- | ---: | ---: |
| Mean core frame, ms | 56.67 | 49.48 |
| Maximum core frame, ms | 298.40 | 267.22 |
| Observation + viewmodel, ms | 21.21 | 11.88 |
| Observation bytes | 56,014 | 25,951 |
| Viewmodel bytes | 31,142 | 6,894 |
| Full session save bytes | 838,974 | 1,332,034 |
| Gzip save bytes | 71,094 | 107,347 |
| Serialize, ms | 2.91 | 4.52 |
| Load, ms | 4.59 | 6.02 |

## Ownership and out-of-area edits

Owned implementation: `region/**`, `activity/**`, provisions itinerary/forecast files, content region schema and authored fixture. Provisions touched only `api.ts`, `trip.ts`, `meals.ts`, `system.ts`, `temperature.ts`, `environment.ts`, `nutrition.ts`, `spoilage.ts`: shared route forecast, road supply/preparation and environmental plumbing. No economy/credit policy changes.

Every edit outside those areas:

- Foundation: `core/src/{world.ts,index.ts,viewmodel.ts,sim/init.ts,sim/sim.ts}` for composition, scoped geometry installation, road address reservation, frame hooks and current-site view filtering.
- Needs: `core/src/needs/{api.ts,system.ts,thermal.ts,view.ts}` for the shared itinerary ledger, fractional final hour and fixed environment.
- Items: `core/src/items/camping.ts` for fixed-weather thermal context and ordinary camp affordances at private road addresses.
- Fae: `core/src/fae/charms.ts`, one distance-return change: regional sites cannot share a local charm reach; standalone fallback unchanged. No charm pressure/social item-request changes.
- Play: `play/src/{actions.ts,describe.ts,interrupts.ts,observation.ts,session.ts,text.ts}` for shared Commands, zero-time query, location/perception, local destinations and arrival/camp/supply interrupts.
- Web: `apps/web/src/{components/PlayPanel.tsx,components/SiteMap.tsx,sim.worker.ts}` for destination/card controls, road presentation and denying distant pantry queries.
- Integration tests: `cli/test/region-travel.test.ts`; content registration: `content/src/schema/{bundle.ts,index.ts,scenario.ts}`; documentation: `docs/impl/{MODULES.md,M5-SLICE1.md}`.

## Slice 2

Implement census and scoped materialization, T1/T2 selections, shared household kernels, relevance/hysteresis, durable pending evidence and hydration. Replace eager two-site initialization with canonical reservations before expanding population. Promote/demote without replaying consumption or losing inventory, debt, grudges or deaths. Prove visit-time/order-independent identities and post-log-eviction witnesses across 50 seeds; require ≤5 percentage-point distribution differences and Standard census heap/save benchmarks. Persistent geographic camp/cache addresses and regional news remain later M5 contracts; this slice's private transit placeholders are deliberately temporary.

## Complete changed-file inventory

- `apps/web/src/components/PlayPanel.tsx`
- `apps/web/src/components/SiteMap.tsx`
- `apps/web/src/sim.worker.ts`
- `content/base/places/cedar_farm.toml`
- `content/base/regions/iron_ford_neighbors.toml`
- `content/base/scenarios/iron_ford_neighbors.toml`
- `docs/impl/M5-SLICE1.md`
- `docs/impl/MODULES.md`
- `packages/cli/test/region-travel.test.ts`
- `packages/content/src/schema/bundle.ts`
- `packages/content/src/schema/index.ts`
- `packages/content/src/schema/region.ts`
- `packages/content/src/schema/scenario.ts`
- `packages/core/src/activity/api.ts`
- `packages/core/src/activity/commands.ts`
- `packages/core/src/activity/events.ts`
- `packages/core/src/activity/state.ts`
- `packages/core/src/activity/system.ts`
- `packages/core/src/activity/travel-rules.test.ts`
- `packages/core/src/activity/travel-rules.ts`
- `packages/core/src/activity/travel.ts`
- `packages/core/src/activity/view.ts`
- `packages/core/src/fae/charms.ts`
- `packages/core/src/index.ts`
- `packages/core/src/items/camping.ts`
- `packages/core/src/needs/api.ts`
- `packages/core/src/needs/system.ts`
- `packages/core/src/needs/thermal.ts`
- `packages/core/src/needs/view.ts`
- `packages/core/src/provisions/api.ts`
- `packages/core/src/provisions/environment.ts`
- `packages/core/src/provisions/meals.ts`
- `packages/core/src/provisions/nutrition.ts`
- `packages/core/src/provisions/spoilage.ts`
- `packages/core/src/provisions/system.ts`
- `packages/core/src/provisions/temperature.ts`
- `packages/core/src/provisions/trip.ts`
- `packages/core/src/region/api.ts`
- `packages/core/src/region/index.ts`
- `packages/core/src/region/state.ts`
- `packages/core/src/region/view.ts`
- `packages/core/src/sim/init.ts`
- `packages/core/src/sim/sim.ts`
- `packages/core/src/viewmodel.ts`
- `packages/core/src/world.ts`
- `packages/play/src/actions.ts`
- `packages/play/src/describe.ts`
- `packages/play/src/interrupts.ts`
- `packages/play/src/observation.ts`
- `packages/play/src/session.ts`
- `packages/play/src/text.ts`

## Wave 6 polish: midnight forecast, road prose, water orders

Branch `wave6/m5-polish`, baseline `6452521`, 2026-10-12. No commit. Reproduced with fresh fair `iron_ford_neighbors` / seed 42 sessions in this worktree: `runs/smoke-m5-polish-before` and `runs/smoke-m5-polish-after`. Commands: `route Cedar Farm`, `travel Cedar Farm`, `wait 3h`. The optional authored road description changes the content fingerprint; the after session starts fresh.

### Before / after

Before:

> Route to Cedar Farm: 0 hours to the next decision (hourly boundaries; final spare minutes are waiting).
> A future check is uncertain; forecast stops before rolling it.

After:

> Route to Cedar Farm: 6 hours to arrival if nothing goes wrong (hourly boundaries; final spare minutes are waiting).
> Walking time: 313 min; arrival 1855-04-01 06:00.
> Carried provisions: 0 kcal, protein 0 g, fat 0 g, Fresh 0; water 740 ml used / 4960 ml left; fuel 0.
> Uncertain vermin check at 00:00, day 1, on Cedar Ridge Road: Hardtack (ship's biscuit), 90/1000 risk; assumes no loss. A loss would leave less food, and could require a resupply delay.
> Consider leaving at dawn: wait until dawn, then route again.

Zero food intake is correct for this particular departure: arrival at the 06:00 boundary precedes execution of the breakfast hour. The existing dawn regression still proves nonzero food intake and exact nutrition/supply/needs agreement. Forecasts additionally name darkness, weather, crossings and hazards. Unsupported crossings remain unavailable for actual travel, but can be previewed conditionally. Future vermin and cooking checks are reported without sampling RNG. Empty carried water produces a warning while projecting a conditional arrival; actual travel still stops. Long itineraries assume eight-hour camps and resumption; if physiology prevents completion or the seven-day projection limit is reached, the card labels the partial supply coverage alongside a nominal complete itinerary.

Before:

> Spring at On the road. Last year’s leaves lie against the shaded edges. The paths about On the road are quiet.

After:

> Cedar Ridge Road, toward Cedar Farm. The road climbs out of the coulee through wooded slopes, then follows the ridge toward farm clearings. In the dark, the road ahead and the land beyond its edges are hard to make out.

Before:

> Appetite: Drink accessible water (held for your order; you may: fetch water)

After:

> Appetite: Drink from carried water (held for your order; you may: drink)

### Verification and ownership

`packages/cli/test/region-travel.test.ts`: 18 integration tests, including separate CLI text/command regressions for midnight forecasting, transit descriptions in darkness/daylight and after stopping, and the actionable carried-water hint. Additional regressions cover named crossings/rain and a water shortage with unchanged live interruption behavior. Midnight forecasting preserves the world hash, repeats identically, and agrees with execution for this no-loss seed. Original travel arithmetic and dawn exactness regressions remain intact.

`VITEST_MAX_WORKERS=4 just check` passed: Biome, all package/script typechecks, **69 test files / 749 tests**, invariants (214 files) and content validation (103 files). Vitest took 1,020.82 seconds. Log: `runs/scratch/m5-polish-check.txt`. Final targeted verification: `runs/scratch/m5-polish-travel-tests.txt` (18 passed). The after smoke session's `--verify` passed: three commands, final hash `a94ad558fea52ab9`. No golden changes.

Owned edits: activity travel finalization's optional forecast-warning callback; provisions trip, storage, meal and system forecast options and road Appetite label; region road prose API; optional region-edge description schema and Cedar Ridge Road content; regional CLI tests and this report.

Out-of-area edits, complete list:

- `packages/core/src/fae/view.ts`: one import, one road-description lookup and one base-layer substitution (three added lines, one removed). Keeps all subsequent fair omen layers. No fae rules changed.
- `packages/play/src/text.ts`: route-card arrival/walking/risk text and the road-only fetch-water thought's hint to the offered `drink` command. No `play/describe.ts`, social or talk edits.
