# Wave 11 performance, pass 4: the hourly sim

Baseline: `cc090fd` (the unmodified `wave11/perf4` worktree). Goal (00 decisions log, 2026-10-13; M5-PLAN "Budget framing correction"): T1 ≤ 30 µs per actor-hour on desktop. Hard rules: determinism and integer state, and **hash-identical** results. Every change below leaves every fixture's final hash, chronicle and stats byte-identical. No content, schedule, horizon semantics, RNG stream/key or snapshot changed. No commits.

## Results

**Iron Ford improved about 1.2× and the county benchmark about 2.3× (2.6× at seed 42), all hash-identical.** The ≥3× Iron Ford goal was not reached without changing behavior. Iron Ford's profile is flat: no single exact fix is worth more than about 5%. The O(actors²) and O(table)-per-actor scans showed up only at county scale, and the large wins came from removing them there. The ≤30 µs per T1 actor-hour target remains about 9× away at county (280 µs). Most of the remaining cost is behavior-shaped; see the proposals below.

| Run (ms per game-hour) | Before | After | µs per actor-hour |
|---|---:|---:|---:|
| Iron Ford 42, 30 d, interleaved bundle A/B (min of 3) | 17.60 | **14.68** (1.20×) | 440 → 367 |
| Iron Ford 42, year (concurrent batch, CLI) | 22.52 | 20.38 | 563 → 510 |
| Iron Ford 42, 30 d (concurrent batch) | 19.66 | 16.16 | |
| gen:town 7, 90 d (batch) | 15.67 | 13.46 | |
| gen:town 19, 90 d (batch) | 18.44 | 15.85 | |
| iron_ford_neighbors 42, 30 d (batch) | 20.95 | 16.63 | |
| **County 2e/2f fixture, seed 41: 40 T0 + 400 T1 + 2,400 T3** | 279.9 | **123.3** (2.27×) | 636 → 280 per hourly actor |
| County seed 42: 40 T0 + 600 T1 + 2,200 T3 (both measured under gate load) | 488.2 | 185.4 (2.63×) | 763 → 290 |

Per-system breakdown, top 8 (ms per game-hour). Iron Ford columns are the A/B best runs; county columns are seed 41.

| System | Iron Ford before | Iron Ford after | County before | County after |
|---|---:|---:|---:|---:|
| provisions | 7.24 | 5.78 | 102.6 | 56.8 |
| psyche | 5.06 | 4.47 | 96.0 | 27.7 |
| social | 3.23 | 2.46 | 38.9 | 9.7 |
| needs | 0.58 | 0.56 | 11.3 | 10.1 |
| activity | 0.43 | 0.37 | 12.6 | 5.0 |
| chronicle | 0.32 | 0.31 | 1.7 | 1.9 |
| fae | 0.22 | 0.22 | 11.0 | 6.5 |
| belief | 0.17 | 0.16 | 3.4 | 3.3 |

## Hash identity

| Run | Baseline hash | Final hash |
|---|---|---|
| iron_ford 42, 30 d | `ac54fe716c63b9e3` | `ac54fe716c63b9e3` |
| iron_ford 42, year | `510438d08c6dfa7e` | `510438d08c6dfa7e` |
| gen:town 7, 90 d | `07b43ea77f7ba60d` | `07b43ea77f7ba60d` |
| gen:town 19, 90 d | `9f8bb57e559e782a` | `9f8bb57e559e782a` |
| iron_ford_neighbors 42, 30 d | `c9f4009728ae7ccd` | `c9f4009728ae7ccd` |
| county seed 41 (state hash after 72 h) | `115eea145e5a7972` | `115eea145e5a7972` |
| county seed 42 | `5b930d766bfa5cf9` | `5b930d766bfa5cf9` |

The chronicle and `stats.csv` are byte-identical for every CLI run. The Iron Ford golden snapshot passes unchanged; `vitest -u` was never run.

The checks ran after every increment: 14 staged comparisons of the four 30/90-day fixtures, plus the county fixture at seeds 41 and 42. Each comparison covers final hash, `chronicle.md` and `stats.csv`.

## What changed (all exact)

Structural (county-scale, removes O(actors²) or O(table) work per actor or per interaction):

1. **Store tab sync** (`provisions/economy.ts synchronizeStoreTabs`, run after *every* interaction): it was O(stores × all processing actors). Now it visits only debtors in the keeper's ledger plus existing tab rows. Owed cents can only come from the keeper's opinion record, and integer tab keys order themselves. Social at county: 33 → 10 ms/h.
2. **Relationship pair index** (`social/pairs.ts`, derived and never saved). `areKin`, `areKinBy`, `isEstranged`, `edge`, `hasMet`, `hasEdge`, `computeBase`, `evictable` and the talk `courting` check each scanned the whole relationship list per call. The index is rebuilt when the list's identity or length changes (only `push` and filtered copies ever mutate it), and lists keep array order.
3. **Place index** (`activity/venues.ts`): place ids by site and tag, plus place rows by site. It is rebuilt hourly and invalidated at every place install (`sim/init.ts`, `sim/population.ts`). It backs `resolveActivityPlace` venue candidates (previously a scan of every place per actor-hour), `nearestWaterSource`, and fae `snapshotWindow`'s lead-place and bell scans. All of these callers sort by a total order or ask a boolean.
4. **Grudge holder index** (`belief/grudges.ts grudgesHeldBy`). Grudges are only added through the counter and `holderId` never changes. Rows are re-checked live. It backs belief urges and `grudgeTargetsOf`.
5. **Belief urges**: the per-actor scan of *every actor* (looking for co-located suspects) now visits only the targets the holder actually suspects, in ascending id order.
6. **Relief pair loop** (O(actors²) per relief hour): a pure prefilter (known want, or a Sunday office collection) runs before the attempt-key string lookup and the age checks.
7. **Call candidates** (`activity/api.ts`): strangers skip the opinion sum (no record means all-zero dimensions and no label). Adulthood is tested arithmetically against `latestBirthDay(14, now)`, verified equal to `yearsBetween` over 272k cases.
8. **Readiness projection** (`provisions/planner.ts`; 30–36% of all time):
   - The projection copies only its own places' fires, as the regional branch already did.
   - `withFixedMembership` memoizes processing-actor ids/rows and the heated-place/home derivations for the projection's lifetime, since membership cannot change there.
   - `heatPlaces` uses Maps for its internals and writes regional temperatures in place instead of merging the county table every heated hour.
   - The full-ration decision horizon is 21 days, not 22. This is exact: every cut is `days < 21`, and no event carries the figure at full rations. The restore horizon keeps 31 days because its Explain prints the projected days.
9. **Inventory index** (`items/api.ts`): stack creation inside a pass now extends a copy-on-write index instead of rebuilding over every stack. New ids are exactly `(old counter, counter]`, so lists stay ascending, and holders of the old index keep their snapshot. Deep traversal uses a numeric container→contents map.
10. **Routine memo** (`activity/calendar.ts withRoutineMemo`): psyche's Mind and its gathered proposals derive one actor's routine once per actor-hour instead of twice. Each derivation includes `callTarget` at county.

Per-call overheads (Iron Ford-visible):

- `sortedKeys()` (`ids.ts`) caches sorted content keys: observances, needs, drives, thoughts, norms and others were sorted per actor-hour.
- Sorted hearth definitions and the cook activity are cached per bundle.
- `yearsBetween` uses packed civil dates with a "today" slot.
- Nutrition's hourly Explain closures are created only when a condition flips.
- Talk: Scene memo fields replace `once()` closures and string keys; `when` conditions are compiled to the keys a line sets, and visited in canonical order; pools are prefiltered per outcome; slot copies no longer go through `Object.entries`.
- The `storageHour` closure is hoisted.
- `keeperAt` no longer materializes the processing-actor list.

## Remaining hotspots (ranked, after this pass)

1. **Readiness projection** (`planReadiness` from `householdEconomyDay`): about 31% of Iron Ford time and 33–36% of county time. At county it runs as a 4–5 s burst at each day start, which blows the 8 ms frame slice. Inside the projection, cost is spread across the shared hourly kernels: `serveMeal`/`recipesFor`, `projectWaterHour`/`heatPlaces`, `waterHour`, `nutritionHour` and `storageHour`. Each costs 12–15 µs per projected household-hour at Iron Ford, and the household takes 504 projected hours per day.
2. **Psyche proposal gathering** (Mind + six modules' urges): about 12% at Iron Ford. Within it, `proposeSocialUrges` → `requiresFail` → `memoryDigests` (a full scan of the owner's memories every actor-hour) costs about 2.5%.
3. **Psyche rule candidates** (`ruleCandidates`/`pickTarget` opinion sums): about 5%.
4. **Talk composition** (`composeExchange`: render, regex tidy, repeat bookkeeping): about 7% at Iron Ford.
5. **County `callCandidates`** (every adult of every other household, per visiting actor-hour): about 6% at county.
6. **Event copy** (`appendEvent` → `copyData`) and GC: about 2–4% each.

## Proposed behavior-changing follow-ups (not applied)

1. **Ration decision without the 21–31-day hourly projection.** Step the projection in whole days (meals at daily resolution, spoilage and fuel charged per day), or decide "full rations" from a conservative kcal/fuel/water budget and fall back to the hourly projection only near a threshold. Expected gain: about 25–30% at Iron Ford (≈4 of 14.7 ms/h) and 30–40% at county (≈45 of 123 ms/h). Either way, the midnight burst goes away. Even without that change, **staggering** each household's decision across hours (household id mod 24) would spread the 4–5 s county spike into 24 slices with no change to the mean.
2. **Psyche cadence for idle minds.** Sleeping or locked actors whose needs bands and present company are unchanged could skip proposal gathering and rule scans, and only age their thoughts. This changes arbitration noise and thought timing. Expected gain: 30–40% of psyche, about 10–12% overall.
3. **Lazy talk rendering.** Compose an exchange's words only for exchanges someone perceives, or render them in views. Repeat-avoidance state (`world.social.talk`) currently depends on rendered text, so this changes the hash. Expected gain: about 5–7% at Iron Ford.
4. **Callers drawn from acquaintances and kin only.** Strangers currently get weight 20 each, so every adult in the county is a candidate. Expected gain: about 6% at county.
5. **Incrementally maintained memory digests**, through a salience epoch bumped by every memory write. This is exact in principle, but it needs an invariant that every write goes through memory.ts, which no check enforces today. Expected gain: about 2.5%.

Even with (1)–(4), T1 would be about 150–180 µs per actor-hour on desktop, which is still 5–6× over the 30 µs target. Psyche/social logic depth per actor-hour is the next lever, and a phone measurement is still missing.

## Method and caveats

Baselines and finals use the requested `just run run … --no-events --profile` commands, run as one concurrent batch. Wall times on this shared host (sibling worktrees running vitest) are noisy. Iron Ford before/after is therefore also given as an interleaved A/B of esbuild bundles of `cc090fd` and the working tree, minimum of three 30-day runs. The county numbers come from `runs/scratch/county.ts`: the 2e/2f fixture with dormancy configured as in M5-PLAN "Scale frontier", 48-hour warmup and 24 measured hours. That window contains one day start, so the daily readiness spike is amortized over it. The T3 monthly batch is not measured. CPU profiles (`node --cpu-prof`) came from esbuild bundles so that frames have line numbers. The tsx `--keep-names` helper `__name` costs about 2–5% in CLI runs and does not exist in production builds. Artifacts are in `runs/perf4/`, and scripts and the log in `runs/scratch/` (gitignored).

**Gate:** `VITEST_MAX_WORKERS=4 just check` passes: lint, all typechecks, 96 files / 1,027 tests, invariants (271 files) and content. The first gate run caught a test that mutates `content.observances` after the sorted-key cache had seen it. Content-keyed caches (`sortedKeys`, hearths, the cook activity) now revalidate against the table's current key list, and the hash comparisons were rerun before the final gate.

**Files touched** (all in `packages/core/src`):
- New: `social/pairs.ts`, `activity/venues.ts`.
- Modified: `activity/{api,calendar,system}.ts`; `belief/{api,grudges,system,tells}.ts`; `fae/episodes.ts`; `ids.ts`; `items/api.ts`; `needs/{api,survival,system,tactical,thermal}.ts`; `provisions/{api,economy,environment,household,meals,nutrition,planner,services}.ts`; `psyche/{defenses,state,system,thoughts}.ts`; `region/processing.ts`; `sim/{init,population}.ts`; `social/{api,opinion,relief,strife,system,talk,urges,volition}.ts`; `time.ts`.
- This report.
