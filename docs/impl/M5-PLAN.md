# M5: a living county you can travel through

Planning baseline: `wave6/m5-plan`, 2026-10-12. Recommendations below implement 00 P1–P8, ADRs 0001–0003, 05 §§1–3, and 07 §12.4; departures needing Ellie's decision are explicit. M5 delivers outfit → travel → camp → arrive → return to consequences. Combat, vehicle ownership, recruitment, and full tactical T0 remain later work.

## 1. Starting point and ownership

County generation is ahead of 07's status paragraph: `packages/worldgen/src/county/` is version 3, with six layers, named geography, crossings, seasonal metadata, directional river costs, and county-to-town context. Its default is 100×128 cells / 800 square miles. It has no census, history pre-roll, non-town layouts, or playable county. `countyTownContext()` currently accepts only ford towns; `applyCountyContext()` largely supplies descriptions, not geometrically matching entrances. Town generation is independently versioned and runs disposable 30-day QA.

Core remains hourly and single-site. `sim/init.ts` installs only `scenario.site`; `activity/api.ts:walkMinutes()` substitutes 60 minutes between sites. `ActorCore.placeId` remains the origin during local transit. `viewmodel.ts` selects the scenario's site and enumerates all places/households. There is no LOD/census implementation. `provisions/planner.ts:planReadiness()` projects schedules with travel cleared; it is not a trip forecast. Temperature/rain hooks exist, but not the proposed regional weather model.

Conversely, `packages/play/src/session.ts` and `apps/web/src/sim.worker.ts` already share PlaySession, saves, fair observations, and interrupts; BACKLOG's spectator-only note is stale. Camps already have gear/thermal rules in `items/camping.ts`. Fae episodes, charm reservoirs, survival, and Chronicle persistence also exist.

Ownership follows `docs/impl/MODULES.md`. Foundation adds composition, IDs, scoped initialization, save migrations, and schedule hooks. Assign a new **region owner** `core/src/region/**` (registry, census, LOD, graph, weather); **needs-activities** owns `activity/travel*.ts`, journey execution, and relocation; **provisions** owns forecast/P8 changes; **content-world/worldgen** owns region schemas, generation and fixtures. Belief, social, fae, Chronicle, play and web retain their directories. Register these contracts before implementation; cross-module writes use owning `api.ts` only. All paths below are under `packages/` unless otherwise stated.

## 2. One World, persistent identities, bounded detail

Add optional `World.region: RegionState` and `World.activity.journeys`; absence retains existing single-town behavior. Region holds:

- Versioned source recipe, county layer hashes, world seed distinct from sim seed, world-size/LOD policy version; immutable raster/graph and site registry.
- `SiteRecord`: stable site/node ID, kind, pinned layout version/context, entrances by edge and side, structure/ownership records, persistent deltas/traces, resource stocks, tier and processed-through timestamps. Loaded layout is optional; authoritative records are not.
- Census households/members, reserved IDs and permanent ref mappings; per-actor geographic knowledge; dynamic weather/reach state. Module-owned beliefs, stacks, minds and fae truth remain in their existing slices.

Define shared `RegionDef` schemas in `content/src/schema/region.ts`, registered through `regionDomains`; worldgen adapts its output to these ordinary authored shapes. Core imports schema types only, never worldgen. Preserve `RegionEdge` IDs, cells, climb/descent, crossings, `availableMonths`, hazards, `costMinutes.ab/ba`, and downstream direction. Add traversal capabilities and non-geographic path conditions. Do not flatten directed costs into one distance.

Use globally unique site-qualified definition/actor/household keys. Foundation adds idempotent `installSite()`/`materializeActor()` with scoped module initialization; never rerun whole-world initializers, replace the World, or reseed stocks upon arrival. Reserve runtime IDs in canonical registry/member order, so visiting B before C cannot rename people, stacks, or places. Existing Iron Ford IDs stay stable. Activities alone update `ActorCore.placeId` and occupancy.

Add a location query returning site/place/level or edge/direction/distance. During travel, `placeId` resolves to an outdoor transit place, never the departure hearth. Transit occupancy excludes travelers until a shared encounter is admitted; two people anywhere on the same long edge are not automatically neighbors. Audit `resolveActivityPlace()`, `provisions.api.bestStore()`, care relocation, fae distance searches and social calls: cross-site intentions must request graph travel, not reuse the one-hour fallback or compare unrelated local coordinates.

**Census:** seed identity with `(worldSeed, householdSeed, memberIndex, populationVersion)`, canonical time zero on the census stream. Record birth, people/presentation, culture, occupation, alive status and exposure. Census households own real item stacks under reserved HouseholdIds before their members materialize. Add household lookup/consumer APIs supporting census records without inventing placeholder actors for `Household.headId`; promotion installs the existing household and materializes its head. Consumption counts each living member exactly once across both representations. Identity is time-independent; current health, debts, losses and memories come from persistent exposure/pending evidence. Contact, a named rumor, victim selection, debt/grudge involvement, or live-site entry materializes sheets. Named actors never become anonymous again.

**Materialization:** initially load the starting town. Load another site when entered or when a consequential scene requires it; nearby simulation needs logical places, not tile arrays. Camps/encounters use stable `(edge, distance bucket, level)` addresses and 05 §2.2 context. Generate base geometry from pinned context, then apply structure/item deltas, resources, current weather, traces and activity placement. Season changes overlays, not building positions. Drop empty camp geometry on departure; caches, remains, fires and discoveries preserve a site record. Persistent buildings and unique items are never garbage-collected as trivia.

Worldgen runs outside core. A deterministic materialization request pauses advancement at a boundary; PlaySession and CLI resolve it through the same pure worldgen adapter, then install results in sorted ID order. No game time passes while the worker yields. Save pending requests; generator completion order and wall time cannot affect outcomes. Separate layout generation from `generateTown()`'s population/tension/QA pipeline: a visit neither creates a second census nor reruns 30-day QA.

**LOD (missing M2.5 is part of M5's critical path):**

| Tier | Work and selection |
| --- | --- |
| T0 | One physically occupied site; current live-site presentation and individual rules. Full sub-minute path/combat scheduler remains M6. |
| T1 | Hourly activities, needs, individual social/psyche rules. Within six hours' travel or relevant: kin, rivals, destination, active threads. Pursuers/companions are pinned regardless of distance. |
| T2 | Daily household production/consumption, economic transfers and coarse named minds; six-hour weather, storage and rumor steps. Preserve individual grudges, obligations, exposure and evidence. |

Promote immediately; demote after 24 hours below relevance/radius thresholds. Standard targets ≤400 T1 actors, ≤150 live-site actors; rank unpinned candidates by relevance, route distance, then ID. Pins override the soft T1 cap and must be profiled. Never vary policy with device speed or hide present people to meet a render cap. Large gatherings use activity zones, while all participants remain represented.

Add `region.api` selections/buckets so hourly systems do not still scan every T2 actor, place and stack. Each actor/household has one processing owner per interval. T2 P8 uses the same meal/prep/storage kernels, grouped by household and environmental schedule; settlement food totals are derived views. Production, purchases and money transfers use provisions APIs. Social/psyche daily summaries preserve named minds; belief owns compartment diffusion and hydration. Promotion consumes ordered pending deltas once, with at most 48 hours of unresolved detail; it never charges consumption again for time already summarized. Canonical-time RNG and stored cause snapshots prevent arrival-time rerolls.

**Persistence:** retain immutable county data once, generated site bases once, and mutable deltas; no duplicated full content bundle per town. Extend `play/session.ts`'s `generatedContent` persistence into versioned generated additions without dropping old saves. Foundation provides pure migrations in `serialization.ts`; format-1 standalone saves remain loadable. Save tiers, cursors, integer remainders, journey decisions, evidence and requests. Pin generator versions; loading never regenerates with a newer algorithm. Unsupported versions fail explicitly.

`events/index.ts` keeps two days routine/two weeks notable events. Census witness records, route knowledge, pending news, traces and Chronicle facts must carry their own evidence payloads; EventIds are references, not storage. Preserve `Sim.sink` for full external logs. Compact session telemetry/journal archives separately from live state without deleting replay commands or learned facts.

At twice the initial named-actor target, compact oldest irrelevant T2 minds through social/belief APIs: merge repetitive memories and retain coarse psyche plus durable relationships/evidence. Never compact active obligations, pursuers or named historical facts away. This threshold and site-delta compaction are saved policy, not reactions to available RAM.

## 3. Travel and the shared forecast

Add `activity.travel {destinationNodeId, edgeIds, pace, campPolicy}`, plus stop/resume/turn-back/camp Commands. Route preview is a zero-time query. Core validates continuity, direction, capability, knowledge, load and agency; stale/invalid orders cost zero time. Every executor calls `authorizeAct` and `canAct`. NPC journey intentions use the same API; no controller branches.

A Journey stores leader, member IDs (one initially), transport reference (null initially), ordered directed legs, current segment/feet progress with remainder, origin/destination entrances, daily walking minutes, camp state, resolved checks and pending interruption. Keep personal inventories separate; future party membership/consent belongs to social, vehicles to items. A journey is a transport operation, not a replacement actor.

**Timing recommendation:** retain hourly command/interrupt boundaries for M5, explicitly displayed in previews. Compute movement in integer feet/minutes, carry unused movement across ordinary junctions, and round the final stop to the next hour, with the remaining minutes charged as waiting. No extra hour per graph edge. This is a documented limit on 07's eventual T0 clock, not a claim of tactical simulation.

Foundation adds a county-frame preparation hook before needs, producing a shared interval itinerary. Needs currently charges the previous activity; travelers instead consume this itinerary exactly once. Activity commits its movement after needs/agency checks, fae/social observe committed locations, provisions consumes the same itinerary, and Chronicle remains last. Preserve existing non-region system ordering. Stop at a blocked crossing/encounter before resolving unapproved action; spend any remainder waiting there and return the interrupt at that hour boundary. Do not advance another hour after collapse, danger or arrival. Save only completed frames initially.

Create pure `activity/travel-rules.ts` functions for leg costs/progress and interval contexts, exposed through activity API. Use current `items.api.loadReport()`/`movementDelay()`/`loadFatigue()`; apply load once. Generated road `costMinutes` already includes climb/descent: do not add grade again. Reversed traversal swaps climb/descent. Spatial crossing/encounter checks use segment positions, not just endpoints. Define new terrain, weather and travel tuning in content.

Regional weather starts with existing monthly normals/rain and adds six-hour regimes, hourly interpolation, fog, mud, snow and reach stage from rainfall/melt. A shared `region.api.environmentAt(location,time)` feeds travel, `needs/thermal.ts`, `items/camping.ts`, `provisions/{temperature,spoilage,environment}.ts`, and fae. Keep old temperature signatures as standalone defaults. Seasons and route closures are real constraints; river edges require an appropriate transport capability, so existing canoe costs never authorize walking downriver.

Use 05's navigation DC terms: route class, fog/night/snow/FI, known maps and familiarity. Key checks to journey/edge/attempt at committed times; persist outcomes. Failure adds measured delay or selects a connected wrong turn; reloading/previewing cannot reroll. Allow bushwhacking as a persisted ad-hoc edge over traversable raster cells, with the same crossing checks. Cliffs require supported climbing actions or a refusal, never a cheap diagonal bypass.

Fords use hydrology's inches plus dynamic stage: below 18 inches ordinary crossing; 18–36 inches checked crossing with load, wetness and possible physical gear loss; deeper/flood-current crossings require supported assistance or are blocked. Resolve material loss by moving stacks to persistent downstream sites. Offer wait, alternate route, or return before commitment. Default to eight walking hours/day; continued forced march requires explicit policy and Constitution checks. Fatigue, thirst, cold, nutrition and collapse remain needs/provisions rules.

**Forecast contract:** extend `provisions.api.readinessOf()` with optional itinerary/environment inputs and expose `tripReadiness()`. Projection and live execution share interval labor, `hourlyLedger`, water draw, `serveMeal`, preparation time, storage/spoilage, devices and thermal kernels. Recompute load after eating/refilling; invalidate `PlacementMemo` and kitchen caches when location/storage changes. Traveling actors use carried food/water, never a remote pantry, shop, hearth or automatic homeward schedule. Cooking and collecting supplies take actual stopped time. Camp uses ordinary sleep/fire/refill/food Commands and real cookware, ignition, fuel, shelter and bedding.

Show arrival range, food by type, kcal/protein/fat/Fresh, water, fuel, spoilage, load and rest warnings with Explains. Fair forecasts use known conditions and labeled uncertainty, never future RNG rolls or hidden charm truth. Fixed-environment fixtures must match the execution ledger exactly; the three-day Iron Ford–farmstead return trip must stay within **±5%** for consumed provisions. Record uncertainty separately from arithmetic error.

## 4. County entry, encounters, knowledge and news

Extend `play/source.ts` with an additive generated-county source: resolved county recipe, population/layout versions, starting node and history policy. CLI manifests/replays and worker new-game messages persist it. Flow: generate county → preview eligible starting ford towns → choose (or stable first suitable town) → create census → materialize town → ordinary newcomer/kit flow. Do not offer landings/diggings as starts until their layouts exist. Add `iron_ford_county` containing unchanged Iron Ford and neighboring farm/settlement/anchor; retain `iron_ford` and `gen:town` as single-site sources. QA rejects unreachable/no-food openings explicitly, without seed rerolls.

History pre-roll remains unfinished M5a, not something arrival can fake. M5 defaults to authored/generated starting tensions with `historyYears: 0`, pending Ellie's scope decision. Reserve a pre-roll source version; never describe those tensions as five years of simulated history.

**Encounters:** interval intersections between existing journeys create people encounters on a camp-sized site at that position. Wildlife encounters draw from versioned local populations/stocks; materialize notable animals as sheets, debit/reserve their source population, and preserve survivors. M5 supports observe, evade, retreat and existing social interaction; tactical fighting is M6. Use bounded encounter windows/cooldowns, not an independent spawn roll every UI refresh.

Fae owns route omens and fae-path conditions through `fae/api.ts`. Reuse `episodes.ts` canonical-window snapshots and persistent observer attempts, with stable edge-place addresses; route entry cannot reroll signs. Apply protected-site exclusions first, including destinations. Seed the county reservoir once as actual unique item stacks (doc 13: roughly 25–40, mostly under the hill); finds and travelers move them, never manufacture rewards. Keep heavy strings behind existing consent/toggle policy.

Fae-path encounters select existing anchor residents/custodians, materialize their sheets, and offer courtesy, a bounded exchange, or withdrawal through social Commands. They are accountable actors with inventories and memories; omens alone do not substitute for meeting someone on the path.

Fae paths have opening conditions, tolls and capped time-slip. Store objective and subjective elapsed minutes separately: the county advances objectively; traveler needs, injuries, devices and carried spoilage advance subjectively with integer carries. Do not use the existing blanket `needsFrozen()` stasis hook as a substitute. Default nonconsensual cap: 144 objective hours; no reverse-time path in M5. FI danger is perceptible at ≥3; forecasts, toll consent and Drift changes use fae knowledge/agency rules. Drift remains universal, including departure at 100; no ancestry-specific route branches.

Add per-actor unknown/rumored/charted/visited/familiar geography, timestamps and source provenance. Initial ordinary roads/towns are charted; hidden anchors/paths require evidence. A lost actor sees their believed position and uncertainty, not the truth marker. `play/{observation,knowledge,actions,interrupts}.ts` and `region/view.ts` filter before sending data. Edge proximity is insufficient for witnessing: require actual co-location/perception. Update event-position tracking as travel moves; household inventories, hidden FI and distant present state must not leak through map payloads.

Travelers carry only claims they hold. On arrival or a road conversation, social invokes `belief.api.transmit()` using road/landing/tavern channels. T2 departure packets retain speaker/CensusRef, proposition, provenance, language, credibility and earliest arrival; six-hour diffusion cannot outrun the route or cross a closure. Hydration deterministically gives particular actors sourced memories. Scope current county-global Commons/misfortune/escalation calculations in `belief/{state,system,escalation}.ts` to settlement compartments, keeping additive legacy views.

Chronicle keeps one county history with site-qualified facts, persistent summaries and dated knowledge basis. `chronicle/{facts,digest,view}.ts` must distinguish off-screen truth from news learned later. Return reveals ordinary changes through people, prices and traces; it does not automatically disclose every distant event. Shared interrupts stop road advancement for danger, blocked route/lostness, unresolved request, critical vitals/supplies, camp decision and arrival; background gossip stays in the digest.

## 5. Web and budgets

Add `apps/web/src/components/RegionMap.tsx` and a region renderer fed solely by filtered worker data: terrain/water/roads, known sites, dated reports and journey position. Reuse `SiteRenderer.ts` on arrival, selecting the actor's active site rather than `scenario.site`. No baked county SVG or client-side routing/rules. Basic legible rendering ships first; watercolor texture/assets are a later art pass.

Phone flow at 390×844: Region → tap destination → route alternatives/details → Kit/forecast → Depart. A bottom sheet exposes food/water gaps, crossings, elapsed/remaining time and Stop/Camp/Return. Alerts open the needed decision and preserve the journey. Desktop uses the same route card beside map/kit panels. Provide a selectable destination list and keyboard controls alongside touch pan/zoom. Every action is an offered headless Command; `protocol.ts` adds pure region/route queries and patches. Save before departure/camp and on backgrounding; resume paused with a digest.

Release gates on Standard: 6× on iPhone 15/Pixel 8a class, 1× on iPhone 12 class; travel day at Ultra ≤3 s; worker heap ≤120 MB; T1 30 actors <5 ms/hour, 400 ≤40 ms/hour; T2 ≤150 ms/day, six-hour work ≤15 ms, pantries/spoilage ≤10%; forecast ≤20 ms. Yield worker work in ≤8 ms chunks without changing sim order. Add 6× explicitly: current `SPEEDS` has only 1×/2×/3×/Ultra, and Ultra's fixed two hours/second cannot meet the travel gate.

Target saves 3–6 MB compressed, hard ceiling 15 MB, write ≤300 ms; cold resume ≤3 s. Measure complete session saves, including generated additions and knowledge. Send static region layers once, view patches ≤64 KB and ≤10 Hz; never clone World to the UI. Existing desktop timing is not phone evidence. Measure baseline first; regression gates cannot excuse failing absolute release gates.

## 6. Mergeable slices and gates

Sizes are focused engineer-weeks including integration, not promises of elapsed parallel time. Each slice includes core, headless and minimal web parity, passes `just check`, preserves legacy sources, and merges independently. Larger county exposure remains gated until slice 2 proves M2.5.

1. **Walk to the neighbor (½–1 week).** Two authored sites, one multi-hour road, region registry, scoped installation, journey Command/preview, carried P8 consumption and arrival in both shells. Keep both small populations hourly; no claim of county scaling. Test outbound/return, mid-edge save/load, no remote pantry/workplace access, agency, exact fixed-weather forecast and integer state. Fair **Greenhorn + Catalog kid** complete the trip without designer help; record frame/payload/save baseline.
2. **Leave people living (2–3 weeks).** Census, T1/T2 selections, household kernels, relevance/hysteresis, pending evidence and hydration. Two-settlement fixture survives absence and return. Across 50 seeds, identity is independent of visit time/order; census witness remembers after log eviction; promotions preserve inventory, debt, grudge and death facts. Compare tier distributions (needs, interactions, opinions, cash, pantry draw); require ≤5 percentage-point outcome-band differences. Fair **Explorer + Socialite + edge-case QA** exercise repeated visits/forks; benchmark Standard synthetic census against T2/heap/save gates.
3. **Start in a generated county (1–2 weeks).** Source/manifest/replay integration, actual entrance alignment, census-backed town/farm/landing/diggings layouts and site persistence. Keep caves/anchors surface-accessible without underground simulation. Test county seeds 1–64, both presets; existing town 1–50 fixtures unchanged; distinct sim seeds 9/42. Reject unplayable starts, preserve first-four-layer hashes, verify arrival-order independence and no QA on load. Fair **Greenhorn + Explorer** outfit and visit neighbors on representative/fresh seeds. Measure generation separately from deferred history against <3 s phone target.
4. **Expedition logistics (2–3 weeks).** Shared itinerary forecast, weather/season/grade, fords, lostness, bushwhacking, camps and people/wildlife encounters. Test wet/dry/cold, direction reversal, load changes, forced march, no-cookware kits, water shortages, blocked paths, stop/resume and expired previews. Fifty seeded three-day round trips: zero seams, ±5% provisions, identical saved/replayed hashes. Fair **Explorer + Catalog kid + Pocket player** compare kit choices and interrupt pacing; hit forecast/travel-day budgets.
5. **Bring back news and wonders (1–2 weeks).** Road rumor carriers/compartments, cross-site Chronicle, canonical route omens, reservoir and forward fae slip. Test delayed/blocked news, named listeners after promotion, >14-day evidence retention, protected sites, subjective pack/objective pantry clocks and charm conservation. Fair **Socialite + Explorer + edge-case QA** return to learn an off-screen rumor and carry an existing charm home. Year runs inspect monthly hunger/rest/warmth, money/food accounting, story frequency and save growth.
6. **County release gate (1–2 weeks).** Complete region map/new-game pocket flow, payload scoping, save/resume, 6×/Ultra and bounded worker work. Run identical command logs in Node and browser engines (WebKit/Chromium/Firefox), including UI/headless interrupt parity and mid-journey saves. Fair **Explorer + Catalog kid + Pocket player** cover authored and generated seeds 1–50 plus fresh seeds. Device screenshots and measured phone gates are required from a browser-capable host. No release with unmeasured phone performance.

All playtest reports follow ADR 0002: mode, recipe/content versions, command log, metrics, quoted moments, confusion/boredom, reproducible bugs and triage. Neutral edge-case QA covers ADR's robustness persona. Determinism, knowledge leaks, duplicated consumption and historical contradictions block a slice; rerun failing transcripts plus fresh seeds. Use `simFor()`/collecting sinks for long-log tests. Deliberate golden changes require their design reason.

## 7. Decisions for Ellie and extension risks

- **Hourly travel versus full T0 now:** recommend hourly stops, explicit rounded forecasts and current live-site fidelity for M5; sub-minute combat/pathing in M6. Minute-scale flash-flood reactions are consequently deferred.
- **Standard geography/population mismatch:** recommend current 800-square-mile county, 3–4k census, roughly 800 initially named; farm clusters are not extra major towns. Keep world-size policy device-independent and versioned.
- **History pre-roll:** recommend defer 5–10 years; mark M5a history acceptance outstanding. Implementing it now adds separate balance/performance work beyond these estimates.
- **Off-screen approximation:** recommend exact identities, conserved stores/money and recorded consequences; tolerate unrecorded routine placement variation within measured tier bands. Never reconstruct evidence from a pruned log.
- **Performance shortfall:** optimize indexing, scoped kernels and summaries first. If Standard misses by ≥3×, return with measured scope options; never silently reduce population on phones.
- **Map knowledge/edge of county:** recommend charted ordinary routes, discoverable wild paths, off-map county seat as a future arrival source; no adjacent-county simulation yet.
- **Fae time and hazards:** recommend capped forward slip, noncombat encounters, explicit toll decisions; defer reverse time and large-loss bargains. Universal Drift rules apply without requiring the Witch campaign.
- **Vehicles/river trade:** capability-based directed legs accept later boats/wagons with item-container cargo, crew and portage. Replace abstract freight with manifested shipments once; prevent double restocking. No boat ownership UI in M5.
- **Parties:** social owns recruitment, purpose and agency transfer; journey membership references those actors and supplies individual P8 contexts. Pins retain distant pursuers. Do not merge minds, inventories or permissions into the leader.
- **Elevation:** addresses include a default level 0 and explicit entrance links; grade uses real rise/fall independently. Later stairs/caves add levels, flyers add altitude; neither requires renumbering sites or rewriting graph traversal.

## Slice 2a status — wave 7, 2026-10-13

**Mergeable region-owned subset: authored census and policy APIs. Slice 2 is not complete.**
`region.initRegion` now captures the fixture's already allocated identities and household IDs
once. `ensureCensus` also admits subsequently created sheets without reseeding an existing
member. Birth/name/people/presentation/occupation/languages are persistent snapshots; culture
and never-materialized procedural population generation are not implemented by this bridge.
Current sheets, inventory, money, obligations and grudges remain solely in their owning slices.
`censusConsumers` returns each living household member once; age derives from birth and
objective time; `refreshCensus` preserves survival's death cause/time/place/event independently
of log retention. These are records and queries, **not a second consumption or mortality kernel**.

`selectRegionTiers` implements directed walking distance, six-hour relevance, kin, rivals,
obligations, grudges, destination and active-thread relevance, explicit companion/pursuer pins,
a 400-actor soft T1 cap with deterministic ties, and 24-hour demotion hysteresis. T0 identifies
the focused actor's occupied site. The saved `selected` tier is separate from `processing`:
**T2 selections still run T1 executors.** `hourlyActorIds` therefore returns all retained sheets.
The unmodified Cedar road costs 250/240 minutes, so its absent site correctly stays within T1;
a long-road test variant exercises T2 eligibility. The policy never changes with host speed.

`recordCensusEvidence` accepts a producer-resolved, already-perceived memory snapshot plus a
stable cause key. Duplicate keys are idempotent; conflicting payloads fail. Ordered hydration
uses `social.addMemory`, with receipts surviving event eviction. The witness-only evidence view
does not expose remote facts. `promoteCensusActor` reuses the existing sheet and hydrates once;
it neither reconstructs inventory nor revives the dead. `regionSystem` flushes pending evidence
at promotion/relevance or a maximum 48-hour unresolved age **when the host invokes it**.
Evidence production, rumor compartments and canonical delayed-memory decay remain owner work;
this API does not claim arrival-time-independent social outcome distributions yet.

### Requests to foundation / owning modules for slice 2b

- **Foundation:** invoke `region.api.regionSystem(world, ctx)` once at each completed hour,
  after `sim/sim.ts:stepHourly` advances `world.time`, using a fresh `makeContext`; add the
  corresponding hook to `sim/advance.ts` at completed tactical frame closure. This matches the
  tested boundary timestamps (private hydration events are sifted next hour). Absent regions
  are a no-op. Tests in `cli/test/region.test.ts` currently invoke the
  boundary explicitly; production CLI/play retain the existing hourly schedule. No hidden
  mutation has been added to a location or weather query. Register a region event union if tier
  decisions need logged Explains, and validate census/LOD versions at restore.
- **Play/foundation:** after PC creation or observation-focus changes, call `ensureCensus` and
  `setRegionFocus(world, playerId)`; run the boundary hook before presenting arrival. Initial
  authored census capture already runs through the existing `initRegion` composition hook.
- **Provisions/needs/activity:** add household-scoped shared meal/prep/storage, production,
  economic transfer and survival kernels, then let hourly systems consume processing buckets.
  Do not enable actual T2 until every interval has exactly one owner. Preserve inventory,
  obligation, death and pending-meal facts when promoting; never replay summarized consumption.
- **Social/belief/psyche:** produce consequential evidence at its source, provide daily named-mind
  and delayed hydration/decay APIs, and retain unresolved debts/grudges. The current explicit
  snapshot API is exercised with a witness fixture, not automatically fed from the event log.
- **Foundation/worldgen/content:** canonical census RNG and reserved IDs for never-materialized
  households, culture/exposure generation, household APIs without placeholder heads, scoped
  actor materialization and pinned population versions. Existing authored IDs are retained.
- **Release gates still open:** real T2 ≤5 percentage-point outcome bands across seeds, Standard
  3–4k census performance/heap/save gates, automated absent-site return consequences in the
  production lifecycle, and full fair multi-day Explorer/Socialite QA. No phone/T2 speed claim.

### Verification for this subset

The region suite exercises 50 seeds × 42 authored members (2,100 identities), reversing promotion
order after varied objective delays; 16-day event eviction before witness hydration; the exact
24-hour demotion / 48-hour pending-evidence boundaries; 400-cap ordering and 405 pin override;
inventory/debt/grudge/death preservation; JSON save/load mid-absence; and a replayable headless
round trip. A five-day retained-executor comparison checks needs, interactions/opinions, cash,
and pantry state for exact equality (0 percentage-point difference). This is T0/T1 fallback
parity, **not validation of a coarse T2 approximation**. No golden is refreshed.

Performance, `iron_ford_neighbors`, seed 42, 720 hours: the pre-edit CLI run measured
**19.56 ms/h**, the post-edit CLI run **26.42 ms/h** (the latter overlapped test work).
A subsequent same-process pair, removing only the new optional metadata for the baseline,
measured **20.61 → 19.80 ms/h**. Host contention/JIT variation prevents a speedup claim;
actual T2 performance is unmeasured. Both runs emitted 85,961 events, retained 8,808, and
produced a 4.72 MB packed save. Removing `region.census` and `region.lod` from the after-save
recovers the exact before hash **`73fe5661ebde796e`**. Artifacts: `runs/m5-before/`,
`runs/m5-after/`, `runs/m5-benchmark-paired.json` (gitignored).

Final gate: **`VITEST_MAX_WORKERS=2 just check` green: 81 files / 839 tests**, lint,
all package/script typechecks, 239 core-file invariant checks and 110 content files validated.
The unchanged Iron Ford golden passed. `just bundle` was needed first in this fresh worktree
for the worker tests' generated bundle import. The initial unconstrained run was stopped after
missing-bundle failures and a long test exceeding its explicit timeout; neither required a
source change. The successful complete gate took 926 seconds in Vitest. Log:
`runs/m5-check-final.log` (gitignored). No commits, golden edits or cross-owner source edits.

Touched files: `core/src/region/{api,state,census,evidence,lod,system}.ts`,
`cli/test/region.test.ts` (paths under `packages/`), and this plan.

## Slice 2b status — wave 8, 2026-10-13

**Mergeable subset: production lifecycle plus a shared daily household ration/domestic-supply
kernel. Coarse T2 is NOT enabled; slice 2 remains incomplete.**

- `stepHourly` now calls the region boundary with a fresh context after advancing time;
  tactical advancement calls it only after the frame is settled. Arrival observations and
  interrupts therefore see the completed boundary. Evidence hydration uses the boundary's
  timestamp/sink and cannot run during an unfinished tactical frame.
- Play creation explicitly admits the PC to the census and sets the observation focus.
  `setRegionFocus` refreshes the census and tier selection immediately; it does not change agency.
  Restore rejects unsupported region/census/LOD/processing versions without mutating valid saves.
  Old regional saves acquire missing optional state during ordinary advancement.
- `region.processingBuckets` gives disjoint hourly/daily actor and household selections.
  **Every retained sheet and household is still hourly-owned, including policy-selected T2.**
  Daily ownership requests fail before mutation. This is a closed gate, not a partially active
  approximation. The other hourly systems still enumerate their existing tables.
- `provisions.householdEconomyDay` extracts the existing daily ration decision and domestic
  water/fuel work unchanged, using the existing P8 readiness projection and actual provisions
  APIs/stores. The ordinary daily economy pass calls this shared entry point through the hourly
  household bucket. Regional receipts retain the latest processed day per household, reject
  backward replay, and survive promotion and save/load. Repeated calls cannot replenish supplies
  or reconsider rations. Non-regional worlds allocate no receipt state and keep the old behavior.
  Freight, wages, purchases and every meal remain in their existing executors.

Small ownership exception beyond the explicitly granted hooks: `provisions/{api,economy,household}.ts`
extracts and exposes the existing household kernel and adds its ownership check. It changes no
ration formula, agency decision, meal planner or employment logic. This avoids a second economy
implementation in region. No social/belief/activity/tactical-owner files are changed.

### Verification and measurement

The region suite has 16 passing tests, including automatic boundary hydration/48-hour flushing,
arrival focus, partial tactical frame save/restore, disjoint processing buckets, guarded daily
household execution, preserved inventory/debt/grudge/death facts, version rejection and replay.
Its five-day comparison now actually selects distant actors T2 while pinning the control T1;
it also verifies a saved continuation. It still compares **retained hourly processing**.

A separate **50-seed × three-day** two-site long-road comparison gives **0 percentage-point
outcome-band differences** for the fallback: every needs, social (including interactions/opinions),
belief, provisions/cash and inventory slice is exactly equal to a fully pinned T1 control.
Two distant actors per seed select T2; **zero actors process as T2**. Thus the requested coarse
approximation comparison is **unmeasured**, not passed. Harness/results:
`runs/scratch/m5-outcomes{.ts,.json,.log}` (gitignored).

Same-process 30-day `iron_ford_neighbors`, seed 42: **16.91 → 16.04 ms/h** (before then after),
**14.94 → 15.26 ms/h** (after then before; numbers presented before → after). These order effects
support no speedup claim. Both versions emit **85,270 events**. Removing census/LOD/processing
metadata yields the same complete remaining-world hash **`3d1e236af7c30f23`** in all four runs.
Plain JSON size is 14,099,120 → 14,100,069 bytes; this is not a packed/compressed save measurement.
The harness uses the pre-edit hourly loop, provisions system and economy from this worktree's
HEAD for the baseline, alongside the current implementation in one process; each run starts
fresh and simulates 720 hours after separate 24-hour warmups. Artifacts and harness:
`runs/scratch/m5-benchmark{.ts,.json,.log}` and `m5-baseline*.ts` (gitignored).

Fair Explorer/Socialite transcript: `runs/scratch/m5-2b-fair/`, authored recipe
`iron_ford_neighbors`, seed 42, content hash prefix `b31e5543049f`; no god mode or world edits.
Ten commands travel to Cedar Farm, camp, meet Jonas, and return after one objective day.
`just run play --session runs/scratch/m5-2b-fair --verify` confirms replay/save equality at
hash **`29c6805429a31c79`**. Excerpt:

```text
> travel cedar farm
> wait 5 hours
You arrive at Cedar Farm gate (360 min on foot)
> introduce jonas
Jonas Hale: “Jonas Hale. Pleased to meet you.”
> chat jonas
Jonas Hale: “Middling, and no use complaining. Yourself?”
> travel iron ford
> wait 8 hours
Wait stopped at 00:00 on Monday the 2nd ... You arrive at Dunleavy's Tavern (300 min on foot).
... sold out until then: Eggs, Bread heel, fresh.
```

The excerpt omits the recorded field/camp/wait/farmhouse commands; the complete command log,
transcript and telemetry are in that directory. Food fell 6.0 → 5.0 displayed days, the purse
stayed $50.00, and there were no wounds. Arrival interruptions and ordinary conversations worked.
The outward loaded trip took six hours despite the shorter graph cost: existing load rounding,
not this slice's LOD behavior. No new progression blocker was observed; one day is insufficient
for the required multi-day Explorer/Socialite/edge-case release pass. This transcript demonstrates
lifecycle and ordinary absent-site consequences, not a coarse T2 simulation.

### Precisely remaining before enabling T2

1. Shared household-scoped meal/preparation/storage kernels and their six-hour environmental
   schedule, including water/fire/fuel/cookware, pending plates, devices and fae hems. The current
   daily economy kernel handles only domestic replenishment and ration policy.
2. Scoped activity/production, wage/purchase/transfer and needs/survival executors consuming the
   same interval partition. Pin mixed households, ongoing preparation, travelers, cross-household
   trades and tactical participants until their transfer rules are defined. Current all-world
   executors must not run over any future daily-owned records.
3. Social/psyche daily named-mind effects, settlement belief compartments, producer-side evidence
   and canonical delayed-memory decay. Existing named debts and grudges stay authoritative in
   their current slices; no summary recreates them. Existing hydration receipts are now wired,
   but summarized physical deltas/promotion catch-up do not yet exist.
4. Actual coarse T2 versus T0/T1 outcome-band gates (≤5 percentage points across 50 seeds),
   Standard 3–4k census and phone timing/heap/save gates. No coarse-T2 performance claim follows
   from the retained-executor comparisons. Generated never-materialized census remains deferred.

Touched files (all formatter writes restricted to these files):
`packages/core/src/region/{api,census,lod,processing,state,system}.ts`,
`packages/core/src/provisions/{api,economy,household}.ts`,
`packages/core/src/sim/{sim,advance}.ts`, `packages/play/src/source.ts`,
`packages/cli/test/region.test.ts`, and `docs/impl/M5-PLAN.md`.
No commits or golden updates.

Final gate: **`VITEST_MAX_WORKERS=2 just check` green: 82 files / 855 tests**, lint,
all package/script typechecks, 241 invariant-checked files and 110 content files validated.
Vitest took 1152.46 seconds on the shared host. Iron Ford's golden passed unchanged.
`just bundle` was run before the gate for the worker tests' generated content import.
Complete gate log: `runs/scratch/m5-check.log` (gitignored).

## Slice 2c status — delayed evidence subset, 2026-10-13

**Incomplete: actual coarse population T2 remains disabled.** This change does not implement
meal/preparation/storage, production/economic transfers, survival, daily social/psyche,
belief compartments, or pending physical-delta settlement. No actor is removed from its
hourly executor, and no T2 speedup is claimed.

The implemented subset is **producer-snapshotted delayed memory decay**:

- `social.memoryDecayPolicy` captures the existing memory rule's time constant, floor and
  forgetting threshold. `decayMemorySnapshot` shares the ordinary integer daily decay step.
  Neither changes the legacy social executor or allocates a memory ID.
- `region.recordCoarseCensusEvidence` accepts an already-perceived memory after the current
  day's mind upkeep. It captures policy at production time; an old event told today starts
  aging today. Original evidence stays immutable for duplicate/conflict checks.
- The completed-hour region boundary ages unresolved snapshots through completed midnight
  upkeep only. At exactly 00:00, promotion leaves that day's decay to social; after that
  hour closes, region has already applied it. Hydration permanently ends region's decay
  ownership. Forgotten snapshots retain a receipt and cannot resurrect on repeat promotion.
- Existing `recordCensusEvidence` callers/saves retain their behavior. No production source
  is automatically routed into the new API: source-side named summaries still need their
  owners' kernels. This is an available evidence kernel, not an enabled population T2 type.
- Conflicting evidence now rejects before refreshing census timestamps, so failure does not
  mutate the world.

### Integration gates and exact remaining hooks

`runs/scratch/m5-slice2c-gates.ts` compares the long-road two-site fixture against pinned T1
for 50 seeds × 336 hours, records actual daily-owned actor counts, and checks a day-seven
JSON save/load continuation. Full needs/social/belief/provisions/items equality is stricter
than outcome bands **only for the retained executor being tested**. A zero daily-owned count
fails the actual-T2 prerequisite regardless of equal outcomes. The ordinary fixture's
250/240-minute road remains correctly within the six-hour T1 radius; enabling distant T2
must not be confused with overriding that policy.

Required owner work, beyond region and the granted cross-module `api.ts` edits:

| Executor | Required partition/extraction before enabling population T2 |
| --- | --- |
| `needs/{system,thermal,survival,survival-social}.ts` | Scoped physiology, heating, exposure counters, checks, collapse/death, care and aftermath; preserve canonical checks and estate/death facts. |
| `activity/{system,production}.ts`, `psyche/system.ts` | Scoped intentions/activity and named-mind daily summaries; pin journeys, mixed households and tactical actors; stop hourly work for daily owners. |
| `provisions/{system,meals,environment,nutrition,economy,employment}.ts` | Scoped meal preparation/plates, six-hour storage/weather/devices/hems, nutrition, production, wages, shopping/freight; use the same P8 kernels and transfer APIs. |
| `social/{system,memory,opinion,requests,relief,objects,strife}.ts` | Scoped encounters/upkeep and consequential producer evidence; preserve named ledgers and reasons. |
| `belief/{system,tells,misfortune,escalation}.ts` | Scoped attribution/decay and settlement diffusion; avoid whole-world Commons as a substitute for compartments. |
| `region/processing.ts` plus foundation composition | Activate a shared interval partition only after those owners honor it; save cursors/remainders, settle ordered physical deltas once on promotion, and never replay prior consumption. |

The explicit file-ownership exception in the task covered small `api.ts` changes; broader
executor-hook authorization was requested asynchronously and has not been received during
this subset. No unapproved system files, sibling worktrees, golden snapshots or commits
are changed.

The isolated decay tests do not establish whole-mind summary parity: delayed insertion can
interact with memory caps, weekly consolidation, opinion reasons and disposition changes.
Those remain part of the social/psyche bands, not implied by the snapshot-kernel result.
The hydration entry point also defers during unfinished tactical frames, including explicit
promotion calls, to prevent applying midnight decay twice when social later closes the frame.

### Measured gate table (this subset)

| Gate | Result |
| --- | --- |
| 50 seeds × 14-day long-road absence: needs, interactions/opinions, cash, pantry | Exact full-slice equality for retained hourly executors; 0 percentage-point band difference. **Not coarse-T2 parity.** |
| Actual T2 processing | **FAIL: 0 daily-owned actors in all 50 runs**, despite 2 selected T2 actors per run. |
| Day-seven JSON save/load, continued to day 14 | Identical world hash (seed 1). |
| Identity / reverse delayed promotion order | Existing 50-seed integration gate passes in the 20-test region suite. |
| Isolated delayed memory decay, 14 days | Matches ordinary integer memory decay, including day-seven restore; midnight ownership, forgotten receipts and unfinished tactical frames pass. |
| Population T2 speed / absent-site-only ms/h | **Unmeasured: no population T2 executor.** |

The 50 paired full-fixture runs have median **21.74 ms/h pinned T1**, **21.95 ms/h
retained candidate**. Each pair alternated candidate/control hours on the shared host.
These are 42-actor two-site costs, not the cost of Cedar Farm's two absent actors.
Do not interpret the timing noise as a speed comparison between T1 and coarse T2.
Harness/results/log: `runs/scratch/m5-slice2c-gates.{ts,json,log}`; summarized results:
`runs/scratch/m5-2c-summary.json` (generated by `m5-2c-report.mjs`). All are gitignored.

Touched files: `packages/core/src/region/{evidence,state,system}.ts`,
`packages/core/src/social/api.ts`, `packages/cli/test/region.test.ts`, and this plan.
No commits or golden updates. Final-source focused gate: **20/20 region tests**, Biome and
241 core-file invariants pass. Full-check result is recorded below after completion.

Full gate: **`VITEST_MAX_WORKERS=2 just check` green: 82 files / 859 tests**, all package
and script typechecks, 241 invariant-checked files, 110 content files validated. Vitest took
1065.40 seconds on the shared host. Iron Ford's golden passed unchanged. Log:
`runs/scratch/m5-2c-check.log`. The final one-line compatibility adjustment preserving
census-only evidence recipients was checked afterward with Biome and the full **20/20 region
suite** (`runs/scratch/m5-2c-region-final.log`, 13.20 seconds). No commits.
