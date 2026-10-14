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

## Slice 2d status — executor ownership, 2026-10-13

**Actual T2 is enabled for wholly absent, independent authored sites. Slice 2's
fidelity/performance release gates remain separate from activation.** This supersedes the
2a–2c statements that daily ownership is empty. The orchestrator explicitly granted edits
to the hourly systems/executors; this slice uses that grant rather than stopping at APIs.

### Execution and settlement

- Regional processing owns complete sites, including their households, logical places and
  nested item roots. Every retained actor/household belongs to exactly one bucket. A selected
  T2 site enters the daily bucket after the ordinary 24-hour grace; selected T0/T1 actors and
  worlds without `region` retain their original executor path. The six-hour relevance radius
  is unchanged. **The original 250/240-minute Cedar Road therefore still has no T2 actors.**
- The owner filters cover needs, hearth fuel, survival/care/aftermath, psyche, activity,
  production, provisions, social upkeep/encounters/requests/relief/loans, belief, and local fae
  episodes. The kernel calls owning APIs in the existing system order. Scoped execution is a
  synchronous `Map` entry cleared in `finally`, never saved in World. Readiness projections
  remove the live processing partition while retaining the regional weather definition.
- `provisions.householdProcessingHour`, exposed by the shared household kernel, uses the
  existing meals, recipes, cooking reservations, pending plates, nutrition, water, storage,
  devices, production, wages, shopping and freight executors. `householdEconomyDay` receipts
  check the household owner before replenishing or changing rations. No alternative food or
  money equations were introduced. Needs and survival retain their actual hourly integer
  steps/checks inside the daily batch, including collapse, death, estates and durable census
  death facts.
- Each day's named mind uses four full deliberations, at canonical 00/06/12/18 hours. Between
  those, the content calendar and small authorized sleep/food routine run; stale social or
  commanded choices are not repeated. Daily memory, opinion and psyche upkeep remains
  per named actor. Social encounters still use the ordinary hourly opportunities inside the
  batch. Belief owns daily decay and six-hour local compartment snapshots/diffusion, only
  among co-present awake named adults; it does not install communal beliefs in every mind.
- A saved per-site `through` cursor represents unresolved physical time. The daily boundary
  commits only `[through, boundary)`, advancing the receipt after each physical substep.
  Promotion flushes all outstanding sites in canonical time/order, then hands the site back
  to hourly ownership. Consumption already committed by a previous daily batch is never
  charged again. There is no duplicate shadow pantry or additive consumption payload to
  apply on arrival. RNG and event cause timestamps use historical canonical hours, not the
  contact time. The full event stream remains append-only; late coarse facts have older
  `t` values, and the next Chronicle pass sees their newly appended IDs.
- Mixed/relevant sites remain hourly. Cross-site kin, jobs, pending requests/meals, loans,
  store ownership and travelers prevent demotion. Regions with active reservoir charms
  remain hourly because those charms can draw across site boundaries. Persecution targets
  stay hourly. These conservative pins are deliberate and visible in the processing bucket;
  a selected T2 label alone never promises daily execution.

### Verification and gate results

The detailed measurements below use seeds 1–50, 336 hours each, full 42-actor worlds,
with the PC in Iron Ford and absent from Cedar Farm. The comparison fixture changes only
Cedar Road's directed costs to 600/700 minutes; controls explicitly pin every actor T1.
Both sides include the first 24-hour demotion grace. Measurements concern Cedar Farm's
two actors and household; performance measures the complete world.

Bands are fixed as follows: needs in 200-point bins (1000 belongs to the top bin), directed
affection in 20-point bins (100 belongs to the top bin), interactions in 14-event bins
(one event/day over the absence), household cash in 500-cent bins, and net pantry depletion
in 10-percentage-point bins. Pantry depletion is initial minus final food kcal, normalized
to initial stock; it includes spoilage and production, not just calories eaten. Needs and
opinions have 100 samples; household/interaction metrics have 50. Reported band gaps are
the largest absolute difference in the fraction of observations in any matching bin.

| Outcome | Mean T1 → T2 | Largest band gap | Result / cause |
| --- | --- | --- | --- |
| Hunger (0–1000) | 813.24 → 831.09 | 4 pp | Pass; meal kernels retained, activity/meal timing differs. |
| Rest (0–1000) | 501.80 → 789.11 | **47 pp** | Fail; the calendar wins between the four deliberations, allowing more regular sleep. |
| Warmth (0–1000) | 1000 → 1000 | 0 pp | Pass in fixed 55°F weather with the shared heating kernel. |
| Thirst (0–1000) | 622.20 → 703.76 | **31 pp** | Fail; changed activity/sleep shifts expenditure and sipping opportunities. |
| Directed affection (−100..100) | 31.67 → 30.39 | **9 pp** | Fail; fewer deliberations/defenses and changed venue schedules feed different memories to the same opinion rules. |
| Farm interactions / 14 days | 64.04 → 66.28 | **10 pp** | Fail; encounter opportunities remain hourly, but activity/co-presence and chosen acts differ. |
| Household cash (cents) | 2500 → 2500 | 0 pp | Pass here; this farm did not exercise a changing cash balance, so this is not a general transfer stress test. |
| Net pantry depletion (%) | 53.296 → 50.772 | **18 pp** | Fail; changed energy demand reduces net draw. The mean difference is 2.524 pp, but 18% of T2 runs cross below the 50% depletion boundary; no T1 run does. |

**Fidelity is not green:** five of eight measured distributions exceed 5 pp. These are actual
coarse outcomes, not the old retained-hourly equality result. Both farm actors survive all
50 runs. Daily ownership is **2 actors / 1 household in all 50 candidates**, versus zero in
all pinned controls. The seed-one JSON restore after day seven plus eleven hours matches
the uninterrupted day-14 world hash; final integer validation is empty.

Same-process timing, seeds 41/42/43, each run for 336 hours after a separate 24-hour
warmup, both T1→candidate and candidate→T1 orders (six pairs per fixture). These are
whole-world ms/game-hour on the shared host, with the full test gate also running.

| Fixture | Daily actors | Median pinned T1 ms/h | Median candidate ms/h | Median paired change |
| --- | --- | --- | --- | --- |
| Authored 250/240-minute road | 0 | 16.411 | 16.419 | +0.45%; both hourly |
| Distant 600/700-minute road | 2 | 16.240 | 16.570 | **+2.43% slower** |

**Speed gate FAIL.** All six distant pairs are slower (about +1.27% to +5.01%). Only
2/42 actors lose full hourly deliberation; site-scoped physical/social substeps still run,
and the second executor pass retains global table/index overhead. Sharing the mutation-aware
inventory index across the batch was hash-identical in the four-seed check and is included
in these final timings. No clear speedup or county-scale saving is claimed.

| Other gate | Result |
| --- | --- |
| Identity independent of delayed/reversed promotion | Pass, existing 50-seed identity test |
| Reverse contact order with an unfinished coarse interval | Pass, identical complete world hash |
| JSON load after day seven + 11 hours, continued to day 14 | Pass, identical complete world hash |
| Headless wait through coarse absence and replay | Pass, same command-log replay hash |
| Hourly exclusion, single-owner memory decay, collapse/death and repeated settlement | Pass, targeted region suite |
| Full repository check | See final gate record below |

The region integration suite adds hourly exclusion of physical and named-mind state,
partial-day promotion and repeat-promotion receipts, reversed contact order, coarse death
facts, materialized memory decay ownership, a mid-absence save continuation and headless
coarse replay. Existing delayed evidence and tactical-boundary tests remain in place.

Direct before/after core comparisons (HEAD baseline copied to `/tmp`, identical content and
seed) retained complete non-regional world hashes:

| World | Seed / simulated hours | Baseline = slice 2d |
| --- | --- | --- |
| Iron Ford | 42 / 240 | `3cba40c846781a71` |
| gen:town | 7 / 72 | `7fc2546fa6c3cced` |
| gen:town | 42 / 72 | `07cdefdd4b798cef` |
| gen:town | 131 / 72 | `d1453d0aa585b877` |

Reproduction artifacts (gitignored): `runs/scratch/m5-slice2d-gates.ts`,
`m5-slice2d-outcomes.json`, `m5-slice2d-gates.log`, `m5-slice2d-legacy.{ts,log}`,
`m5-slice2d-region.log`, and `m5-slice2d-check.log`. The earlier exploratory results are
explicitly separate. Boundary metadata/tactical guards were verified in the final 26-test
region pass. The inventory-pass optimization was independently hash-identical for 14 daily
batches at seeds 1/7/42/50 (`m5-inventory-check.{ts,log}`); performance is remeasured in a
fresh process using `m5-slice2d-final-bench.{ts,json,log}`.

### Remaining

1. Tune/replace the sampled psyche routine against the reported distribution gaps. Full
   hourly social/physical substeps preserve existing rules but limit the batching speedup;
   weather/storage still take hourly physical substeps rather than a six-hour approximation.
2. Split independent households within mixed/relevant sites without splitting shared hearths,
   meals or simultaneous venue interactions. Resolve cross-site transfer/kin/charms and
   persecution contracts before relaxing their conservative pins. The two-site fixture is
   not evidence that an absent Iron Ford full of PC ties can all become T2.
3. Generated, never-materialized census and Standard 3–4k population/phone timing, heap and
   packed-save gates remain unimplemented/unmeasured. Winter/year balance is not established
   by this 14-day gate. No county-scale performance claim.
4. Multi-day fair Explorer/Socialite/edge-case playtesting with repeated travel and forks;
   the automated coarse wait/replay and contact tests do not substitute for this release pass.

Files: `core/src/region/{api,census,coarse,evidence,lod,processing,state,system}.ts`;
small API exports and owner-filter edits in `activity`, `needs`, `psyche`, `provisions`,
`social`, `belief`, and `fae`; `provisions/{household,planner}.ts`; `cli/test/region.test.ts`;
and this plan. No tactical/combat sibling files, golden snapshots, content fixtures,
dependencies or commits were changed.


Final gate: **`VITEST_MAX_WORKERS=2 just check` green: 86 files / 910 tests**, Biome,
all package/script typechecks, 244 invariant-checked core files and 112 content files.
Vitest took 971.89 seconds on the shared host. Iron Ford's golden passed unchanged.
After the final boundary guards and shared inventory-pass optimization, the dedicated
**26/26 region tests** passed again (44.68 seconds); current core typecheck, scoped Biome
and invariants also passed. Full gate: `runs/scratch/m5-slice2d-check.log`; targeted final
suite: `runs/scratch/m5-slice2d-region.log`; complete distributions and paired timings:
`runs/scratch/m5-slice2d-summary.json` (`m5-slice2d-report.mjs`). No commits.

## Slice 2e status — fidelity recovery and county benchmark, 2026-10-13

**The four-deliberation approximation is withdrawn. Daily ownership/catch-up remains;
its physical and decision substeps now use the hourly rules. This is a fidelity-first
batched executor, not a validated cheap daily mind model. County release remains gated.**

### Root cause and implementation

The 2d physical kernel already calls `needs.hourlyLedger` through `itineraryNeedsHour`,
then the ordinary water, preparation, meal, nutrition and storage executors. Its cursor
settles `[through, boundary)`; both comparisons end at the same completed midnight. There
was no missing second physiology pass or extra daily sleep/drink credit. The mismatch
was the **decision clock**: on 20/24 hours, `regionPsycheHour` replaced arbitration with
only rest<250/hunger<400 fallback urges. Otherwise it cleared the choice and let the
calendar win, including its sleep block. Those hours also skipped thought aging,
anxiety/discharge and defenses. The changed sleep/labor schedule feeds different
expenditure into the correct ledger; water suppresses sipping while asleep and meals
use that changed energy demand. Social encounters were already hourly, but changed
wakefulness/venue/activity and defenses changed their opportunities and memories.

The daily batch now resolves the same authorized routine/arbitration at each canonical
hour before activity/social/provisions. Sleep remains a real scheduled/chosen activity;
there is no fitted rest offset, synthetic drinking credit, pantry correction or social
rate multiplier. Integer hourly rounding, clamping, sleep quality and prior-hour activity
semantics remain shared with T1. Named memory/opinion upkeep and compartment behavior
retain the existing owner filters. The cheaper approximation needs a new design and
validation before being reinstated.

County profiling also exposed avoidable batch overhead. Household readiness projections
copied the whole county temperature/hearth tables into their small private world, and
then copied those tables again in every projected heat hour. Regional projections now
retain only their actual places and fires. The first T2 profile then isolated the same
problem in preparation: every projected hour expired every county fire. The projection
now copies only fires at its own places. Regional household meal membership uses the existing
household member list instead of scanning every county actor. Hearth ownership is indexed
once per heat pass, and daily actor/household/place selections are cached only within one
physical substep (actor lists are returned as copies because care sorts them). No cache
is serialized; subsequent hours and nested scopes rebuild their membership.

### Reproduction and coverage

The tracked manual harnesses are `packages/cli/test/bench/region-{fixture,fidelity,scale}.ts`.
Run fidelity with `node --import tsx packages/cli/test/bench/region-fidelity.ts <output> 50`.
Run scale with `node --expose-gc --import tsx packages/cli/test/bench/region-scale.ts <output> 14 100 24 2`;
`REGION_PROFILE=1` enables CPU profiles around daily flushes (separate from timing runs).
Outputs belong under `runs/scratch/`. The fixture uses ordinary scenario initialization
and authored-sheet census capture: 40 Iron Ford actors at T0, two nearby settlements
with 400 T1 actors, and twelve distant settlements with 2,400 T2 actors. Each added
settlement has 100 independent two-adult farm households, real homes/fields, clothing,
water, pantries and named minds. It deliberately reuses the authored farm templates,
not town-generation QA. It is a synthetic farm-heavy cost fixture, not a generated county
or representative town economy; there are no invented anonymous aggregate consumers.

Scale pairs use the same process, seeds 41/42 and opposite AB/BA execution orders,
48 hours warm-up including grace and a first daily flush, then a complete measured day.
The T1 control pins all remote actors. Timing includes the full world, Chronicle and
region boundaries. Heap is absolute post-GC process heap before serialization (including content/runtime),
not a delta against a preceding live world; saves are packed
World JSON plus gzip size, not complete PlaySession/worker/device measurements. CPU
profiles use inspector sampling restricted to descendants of `settleDailySites`.

A new four-day regression compares completed midnights against pinned T1, checking actual
T2 ownership, every farm need, nutrition, water/ration/cash state, pantry quantities and
spoilage, and interaction counts. Existing tests retain mid-absence restore, repeated and
reversed promotion, one-owner decay/death, headless replay and tactical boundary coverage.

### T2 profile and optimization checks

A separately profiled, warmed daily flush in the seed-42 / 2,840-actor fixture sampled **40.264 s**
inside `settleDailySites`. Before scoping forecast fires it sampled **80.655 s**. These are
instrumented samples on a contended host, not the uninstrumented paired timings below.
The profile-only scratch harness admits ownership at minute 1440 without replaying the
grace day, warms one full daily batch, then samples the next flush; it is not used for
fidelity or the paired speed result (`runs/scratch/region-t2-profile.ts`).
Top ten self-time buckets (percent of samples under the T2 call tree; GC outside that
call tree is excluded):

| Function / file | Sampled self ms | Share |
| --- | ---: | ---: |
| `idsOf`, `ids.ts` | 7,588 | 18.85% |
| `heatPlaces`, `needs/thermal.ts` | 2,792 | 6.93% |
| `rowsOf`, `ids.ts` | 1,299 | 3.23% |
| `withInventoryPass`, `items/api.ts` | 1,253 | 3.11% |
| callbacks in `social/api.ts` (mostly `areKin`) | 1,124 | 2.79% |
| `proposeBeliefUrges`, `belief/api.ts` | 1,119 | 2.78% |
| `civilFromDays`, `time.ts` | 980 | 2.43% |
| `inventoryIndex`, `items/api.ts` | 791 | 1.96% |
| projection callbacks in `provisions/planner.ts` | 771 | 1.91% |
| `resolveActivityPlace`, `activity/api.ts` | 706 | 1.75% |

The remaining enumeration hot spots include co-present suspicion proposals scanning
all actors, nearest-water queries scanning all places, forecast hourly physiology and
local fae-window candidate scans. The present batch still pays for 24 complete decisions
and physical/social substeps; these costs cannot be described as a cheap daily summary.
The exact optimization check compares the final code against HEAD with only the fidelity
fix applied: 14-day regional complete-world hashes match at seeds 1
(`132510f9563d5e90`) and 42 (`6309fcaa3aff3fa5`). This covers all four index/projection
optimizations, not just final outcome bands.

Direct legacy comparison against this worktree's HEAD, with identical content:

| World | Seed / hours | Before = after hash |
| --- | --- | --- |
| Iron Ford | 42 / 240 | `32faf2bddc0cd8da` |
| gen:town | 7 / 72 | `23a3780724acc6b9` |
| gen:town | 42 / 72 | `384c0a97ab2c0f4c` |
| gen:town | 131 / 72 | `c6e44522093ad7fb` |

These compare current HEAD, rather than the earlier 2d integration baseline. No golden
refresh or commit. Raw artifacts: `runs/scratch/region-{before,after,scale}.json`,
`region-t2{,-before-fire-scope}.cpuprofile`, `region-legacy-compare.log`,
`region-optimization-compare.log`, and `region-final-kernel-tests.log` (65/65 focused tests).

**Pantry metric correction:** the original 2d harness is still available in the 2d
worktree's `runs/scratch/m5-slice2d-gates.ts`. Its `pantry()` multiplies each food's
**per-unit** kcal by `qty * servings - partial`, without dividing by servings, and
omits `foodPartialPm`. That weights foods by serving count and does not measure kcal.
The new harness uses `(qty * servings - partial - foodPartialPm/1000) * kcal/servings`
across the household pantry, plus a separate whole-unit diagnostic. The original
**18 pp** is retained above as a historical result, not silently relabeled. Repeating
50 seeds on unmodified HEAD with the corrected kcal formula gives **2 pp**, means
**56.361% T1 → 53.718% old T2**. The other seven reproduced baseline bands and means
match 2d exactly. The remaining real pantry mean difference tracks the changed activity
energy demand; the corrected kernel eliminates that difference as well as the band gap.

### Final fidelity gate: 50 seeds × 14 days

The same long-road fixture, initial 24-hour grace, PC focus, canonical final midnight and
bins from 2d are used. There are two daily-owned actors in every candidate and none in
its pinned control. All eight bands pass the ≤5 pp criterion:

| Outcome | Before: largest band gap | After T1 mean → T2 mean | After gap |
| --- | ---: | --- | ---: |
| Hunger | 4 pp | 813.24 → 813.24 | 0 pp |
| Rest | 47 pp | 501.80 → 501.80 | 0 pp |
| Warmth | 0 pp | 1000 → 1000 | 0 pp |
| Thirst | 31 pp | 622.20 → 622.20 | 0 pp |
| Directed affection | 9 pp | 31.67 → 31.71 | 1 pp |
| Farm interactions / 14 days | 10 pp | 64.04 → 64.04 | 0 pp |
| Household cash | 0 pp | 2500 → 2500 cents | 0 pp |
| Net pantry depletion, actual kcal | 2 pp (2d's invalid weighted metric: 18 pp) | 56.361% → 56.361% | 0 pp |

Physical/interaction/cash/pantry observations match for every seed, not only in aggregate.
Affection retains a small named-mind difference; complete social/belief state equality is
not claimed. All final integer checks pass. The existing restore/contact/replay tests
remain the durable-state gate; these distribution results do not establish winter balance,
changing farm cash, dense settlement social behavior or a cheaper approximation's fidelity.

### Final county scale gate

Uninstrumented same-process pairs, 48-hour warm-up + 24 measured hours each:

| Seed / order | Mode | T0 / T1 / T2 actors at end | ms/game-hour | Packed / gzip save MB |
| --- | --- | --- | ---: | --- |
| 41 / first | Forced T1 | 40 / 2800 / 0 | 1768.103 | 114.307 / 23.964 |
| 41 / second | T2 enabled | 40 / 400 / 2400 | 1604.345 | 114.256 / 24.164 |
| 42 / first | T2 enabled | 40 / 600 / 2200 | 1609.733 | 114.933 / 24.350 |
| 42 / second | Forced T1 | 40 / 2800 / 0 | 1828.727 | 114.845 / 24.119 |

Seed 42 selects 400 T1 / 2,400 T2 actors but processes one extra 200-person site
(`bench_3`) hourly because a resident becomes a persecution target. The existing
whole-site eligibility pin is honored; no actor cap is silently overridden for timing.
Diagnostic: `runs/scratch/region-scale-pins.json`.

Median **1798.415 → 1607.039 ms/h**. Paired improvements are **9.26% and 11.98%**,
median **10.62% faster**. The fixture is large enough to measure a batching saving, but
**the scale budget fails**: T2-enabled total cost is **321× the eventual <5 ms/h desktop
proxy**. The current coarse boundary costs 28.5–31.6 seconds per simulated day, roughly
190–211× the plan's 150 ms/day T2 budget. These are desktop/shared-host measurements;
no phone performance is asserted.

The system wrapper measures hourly owners and the remainder of `step` includes the
region boundary. Dividing by actual populations gives **0.656–0.659 ms/actor-hour for
T0/T1 jointly** and **0.540–0.548 ms/actor-hour for T2** (about 13 ms/actor-day).
These are amortized inclusive costs: T0 and T1 share the hourly executor in this fixture;
Chronicle/global work is charged to that bucket, and region-selection/clock overhead is
included in the T2 remainder. They are not isolated marginal actor costs. The forced-T1
world averages 0.622–0.643 ms/actor-hour excluding the region remainder.

Heap measured in fresh processes at the same seed-41/day-three boundary is **931.661 MB
forced T1**, **932.803 MB T2** (absolute post-GC process heap before serialization,
including content/runtime). The T1 number is the first paired case; T2 was repeated alone
with the optional final `T2` argument to the benchmark. Later paired heap readings around
1.17 GB include earlier harness serialization buffers and must not be read as the size
of an isolated simulation. Separate result: `runs/scratch/region-scale-isolated-t2.json`.
T2 therefore provides **no material heap saving**; even this short run is about 7.8× the
120 MB worker budget. Gzip World saves around **24 MB exceed the 15 MB hard ceiling**;
these exclude complete PlaySession/generated-content persistence. Serialization temporarily
pushes the benchmark process above 2 GB. This is not a release-ready save or phone claim.

### Verification, files, and remaining

**`VITEST_MAX_WORKERS=2 just check` GREEN: 87 files / 936 tests**, all package/script
typechecks, 248 invariant-checked core files and 114 validated content files. Vitest took
1001.98 seconds. The Iron Ford golden passed unchanged. Log:
`runs/scratch/region-check-final.log`. The manual harness's reporting/isolated-case options
were additionally checked with Biome and the CLI typecheck after that gate started.

Files: `packages/core/src/psyche/system.ts`, `region/processing.ts`, `needs/thermal.ts`,
`provisions/{meals,planner}.ts`; `packages/cli/test/region.test.ts`;
`packages/cli/test/bench/region-{fixture,fidelity,scale}.ts`; this plan. No commits.

Remaining: a cheaper daily decision/physical kernel that retains the measured
bands; co-present actor/site/water/kin query indexes; smaller forecast/event/Explain work;
named-state and log/save compaction without losing durable evidence; bounded worker yields;
generated census and representative dense-town/cross-site economy fixtures; year/winter
balance and fair repeated-return playtests; actual phone/worker/save/resume measurements.
Do not reinstate the four-deliberation shortcut or call this county-feasible on the strength
of a 10.62% relative saving. Slice 2's fidelity gate passes for this fixture, while its
absolute scale/heap/save and broader release gates remain open.

## Slice 2f: dormant T3

Design first, 2026-10-13. Prototype for Ellie's county decision in 00; T2 keeps the
validated 2e executor and the county population is unchanged. **Explicit opt-in only:
the whole-town livelihood fidelity and county cost gates below fail.**

**Selection and ownership.** T3 is a separate, whole-settlement processing owner.
Default entry distance is over 24 directed travel hours, exit distance 20 hours,
with a 24-hour dwell before entry. Policy is saved and configurable, never selected
from device speed. Any relevant or pinned resident, planned destination, journey,
active tactical scene or unresolved cross-site dependency prevents dormancy. Existing
2d eligibility exclusions remain conservative. T0 is the occupied site; eligible near
settlements remain T1/T2. Disabling T3 settles its outstanding interval first.

**State.** Identities, sheets, household membership, inventory, obligations, property,
deaths and other durable facts persist. Named minds are frozen with an explicit
processed-through timestamp, not replaced by a statistical T2 mind. Settlement
records retain canonical aggregate cursors, dated news/trace facts, accounting totals
and hydration receipts independently of the rolling event log. Existing materialized
sheets are retained in this first implementation; dormant state is not a claim of
compressed census-only saves.

**Aggregate clock and rates.** Resolve on canonical calendar-month boundaries and
settle the unfinished prefix on promotion. Demographic opportunities use canonical
person/time keys, never arrival time or sequential RNG. Births, deaths, marriages,
moves, debt/default, harvest/pantry changes and feuds are durable facts; rumors are
settlement news, not universal knowledge. Era-plausible demographic priors must be
identified as assumptions separately from simulated rates: current T1/T2 has no
fertility or background mortality engine, so demographic parity cannot be claimed.
Use ordinary production, food definitions, spoilage and monetary ledgers through
owner APIs. Calibrate livelihood and grudge rates against generated-town year runs;
report seed coverage and measured failures rather than fitting away discrepancies.

**Promotion.** Settle aggregate facts in canonical site/time order, then apply lazy
elapsed-time owner decay and hydrate involved people's memories/beliefs once. Integer
rounding, clamps and memory floors use owner kernels. Pantries are actual stacks;
aggregate consumption is final and is never replayed by the T2 executor. The T2
cursor begins at the promotion boundary. News remains knowledge-gated. Repeated
promotion and JSON restore retain receipts. Approach order cannot reroll committed
facts; different subsequent active simulation is allowed to diverge.

**Gates, declared before measurement.** Identity and reversed contact order: 50 seeds;
mid-dormancy JSON restore; repeat promotion unchanged; integer state. Compare 60-day
T3 then promotion against T2: population within 5% (minimum one person), deaths within
2% of initial population (minimum one), household cash within 25% of opening cash,
pantry kcal within 25% of opening kcal, live grudges within 20% (minimum one).
These deliberately coarse bands are acceptance proposals, not measured results.
Report observed distributions and failures, including zero-event controls. Run the
2e 2,840-person fixture with saved T3 policy, retaining its 900-minute far roads
(and explicitly configure the entry radius below those roads for that reproduction).
Report actual owner counts, warmup, monthly cost, heap before serialization, packed
and gzip World sizes. Radius/cap frontier includes 150/250/400 hourly targets, noting
whole-site rounding and dependency pins; derive the remaining microseconds per
T0/T1 actor-hour needed for a 5 ms/h total budget. No phone or release claim follows
from a relative speedup.

### Implemented policy and execution

T3 requires an explicit host call to `configureDormancy`; unconfigured regional and
single-site worlds keep their existing owners and acquire no dormant state. The enabled
policy defaults to a 24-hour entry distance. Automatic admission is withheld because
the whole-town livelihood gate fails. Saved policy
also controls the 20-hour exit distance, dwell, hourly radius/cap and aggregate
opportunity rates. Whole-site dependency exclusions and relevance override distance.
Newborns inherit their settlement's dormant ownership, so a birth does not spuriously
wake 200 neighbors. Promotion settles **all** outstanding dormant sites before allocating
memories or handing one site back to T2/T1. Event hours are ordered across settlements;
finishing one whole settlement first was rejected by the partial-day restore test.
The aggregate saves entry affection/trust and existing-grudge dispositions for local
acquaintances. These frozen inputs keep a visit that hydrates a neighbor's minds from
changing that still-dormant settlement's later marriage, debt or feud opportunities.
They are not a substitute T2 social executor. Opportunity-rate changes must follow a
flush of the outstanding interval; callers must not apply new rates retroactively.

The monthly outer batch uses canonical daily food/demographic opportunities and
six-hour storage-temperature bins. Food accounting uses one scheduled day's energy
at noon and the existing meal/preparation kernel, including fractional servings,
protein/fat/freshness, fuel, cookware and water; it is an aggregate maintenance model,
not a claim of T1 meal-time/need parity. Preparation completes at its original dated
completion, and the saved half-open cursor prevents replay of that meal after promotion.
Production uses only existing content's productive schedule slots and yield/check
kernel. There is **no invented farm harvest** where authored activities have no yields.
Produced and consumed kcal are accounting totals; actual item stacks remain authoritative.
Famine runs the existing deprivation/Fortitude/care executor over the exceptional day's
checks, with canonical RNG hours and consequences dated at the completed day boundary.
It does not run hourly psyche, encounters, belief diffusion or provisioning decisions.

Minds remain in their owning slices. Hydration uses the existing integer memory/opinion
upkeep (bounded at the 1,001-step fixed point of 0..1000 monotone decay), exact elapsed
linear thought decay, and owner need deltas for unattended wants. Standing and other
baseline/recovery wants use the bounded integer recurrence to its fixed point, rather
than multiplying a single hourly delta by elapsed time. Maintained rest,
thirst and warmth are frozen assumptions; aggregate meals settle hunger. This is **not
an exact closed-form solution of all physiology**, and needs-equivalence is not claimed.
Durable facts carry cause keys, dates, chance inputs/draws, notice/absence/ledger trace
addresses and hydration receipts. Witness memories and debt/quarrel beliefs use owner
APIs; their caps still apply. Settlement news appears only while present, or through an
explicit omniscient API. Knowing a road does not reveal births or debts at its far end.

Births install full, persistent sheets through a scoped foundation hook, with content
name pools and canonical world-seed/cause IDs in a separate numeric band; collisions
fail explicitly. Existing sheets, inventories and minds are not reinitialized. This is
a maternal identity/template bridge, **not a validated inheritance/fertility model**.
Marriages require adult courtship eligibility, mutual affection and agency. Moves are
limited to joining a spouse's household **within the same settlement**; cross-settlement
migration still needs the transfer/travel contract excluded by 2d. Existing affordable
debts can be repaid through the money/ledger APIs. An insolvency/default fact preserves
an unpaid claim; it does not forgive it or mint money. New lending, aggregate markets,
wholesale freight and wage negotiation are not implemented in T3.

Temporary, disjoint settlement inventory tables keep the ordinary food kernels from
reindexing the whole county after every created stack. They share authoritative objects
and counters and reconcile new/deleted stacks once at the end; they are never saved.
The first unscoped monthly benchmark took 377.426 seconds. Scoping reduced subsequent
runs to roughly 15–16 seconds. The monthly component remains material and is included
separately below, rather than being hidden behind a three-day timing window.

### Calibration: three generated towns, a full year each at T1 and T2

Tracked reproduction: `packages/cli/test/bench/region-dormant-calibration.ts <output> T1`
and the same command with `T2`, using `node --import tsx`. Seeds 7/42/131, 365 days.
T2 calibration deliberately forces the unchanged daily owner kernel over the generated
town; it omits the global Chronicle/LOD admission loop. It is an owner-rate calibration,
not proof that all these towns naturally qualify for T2. Monthly snapshots retain food,
cash, population and grudge observations, plus 14-day intake/burn samples. Pantry totals
below include stores and carried food as well as household pantries.

| Seed | Initial population → T1 / T2 year end | Deaths T1 / T2 | Household cash cents T1 / T2 | Pantry kcal T1 / T2 | Positive-intensity grudges, initial → T1 / T2 |
| --- | --- | --- | --- | --- | --- |
| 7 | 24 → 24 / 24 | 0 / 0 | 0 / 0 | 8,863,076 / 8,051,422 | 2 → 76 / 59 |
| 42 | 27 → 27 / 27 | 0 / 0 | 0 / 174 | 8,789,515 / 8,222,007 | 2 → 94 / 73 |
| 131 | 28 → 28 / 28 | 0 / 0 | 54 / 0 | 8,695,189 / 7,914,461 | 2 → 79 / 100 |

Mean sampled daily intake is 2,415–2,435 kcal at T1 and 2,384–2,431 at T2;
full-day burn is 2,205–2,216 and 2,168–2,190 respectively. T3 retains the owner
schedule/physiology energy calculation rather than adding a fitted calorie multiplier.
The mean T2 net grudge-stock growth is 2.835 per initial resident-year; the first T3
prior rounds this to **2.8 feud opportunities per eligible adult-year**, targeting
existing local acquaintances. This is a stock-growth proxy, not a directly measured
formation hazard; the 60-day grudge distribution gate below remains decisive.

Birth/background-death rates cannot be estimated from T1/T2: those processes are absent.
The initial demographic priors are 190 births per 1,000 eligible women aged 20–44/year,
20 background deaths per 1,000 people/year, 20 marriage opportunities per 1,000 eligible
adults/year and 30 household-move opportunities per 1,000 eligible adults/year. They
are recorded model assumptions, not measured Wisconsin rates. Births are spaced at
least 300 days per mother. The birth prior is loosely anchored to the historical 1850
estimate of 194 births per 1,000 women aged 15–49 in the historical series
([Historical Statistics, Ab40–51](https://hsus.cambridge.org/HSUSWeb/toc/treeTablePathIdAb40-51.html));
the death prior lies between contemporary aggregate comparisons in the
[1850 Census mortality discussion](https://www2.census.gov/prod2/decennial/documents/1850c-04.pdf).
The different age coverage and historical population coverage prevent treating either
as a fitted county rate. Marriage/move priors are provisional. No rule branches on a
literal people ID. Canonical person/day draws use the census stream; visits cannot
reroll committed history. Future active simulation after an earlier visit can diverge.


### Gate results: determinism, persistence and 60-day promotion

The eight integration tests in `packages/cli/test/region-dormant.test.ts` cover forced
birth/marriage and full child slices, retained T3 ownership after a birth, 50-seed
reversed settlement contact, partial-day restore, 50-seed differing hydration times, repeat settlement/promotion, frozen
minds, disjoint owners, pin promotion, the 20–24-hour hysteresis band, invalid cursor
rejection, unconfigured-world T2 preservation and distant news privacy. The 50-seed comparison hashes the **complete World**,
not just names. Contact permutations are compared at the same canonical time; this is
not a promise that visiting earlier and running an active settlement for weeks produces
the same future as leaving it dormant.

| Gate | Observed result |
| --- | --- |
| 50 seeds, two settlements, reversed contact after 60 days | 50/50 complete-state hashes identical; identities retained |
| 50 seeds, hydrate minds early versus only at final contact | Identical saved state except observation-time band-change log ordering; future marriage facts identical |
| Save/restore at day 31 + 14 hours, continue to day 61 | Identical to uninterrupted settlement, including event IDs |
| Repeated settlement and repeated promotion at the same boundary | Complete-state hash unchanged; no second meal or fact hydration |
| Integer state | Zero violations in the identity and fidelity fixtures |
| Hourly exclusion / ownership | Dormant minds and household stacks untouched across eight hourly steps; owners disjoint |
| Entry/exit safeguards | Pinned site wakes; 1,300-minute distance retains T3; 1,200 minutes exits; invalid future cursor rejected |

Promotion reproduction: `node --import tsx packages/cli/test/bench/region-dormant-fidelity.ts
<output> 50 ample` (omit `ample` for the ordinary short-pantry fixture). Seeds 1–50,
60 elapsed days, then promotion. This isolates one remote two-adult farm's owner;
it does not simulate the occupied Iron Ford actors. The T2 control is the unchanged
2e daily executor. This is a small settlement/control gate, **not** representative
dense-town, winter, cross-settlement market or migration validation.

| Ample-pantry metric | T2 mean | T3 mean | Largest paired gap | Declared band | Failures / 50 |
| --- | ---: | ---: | ---: | --- | ---: |
| Living population | 2.00 | 2.02 | 1 | 5%, minimum 1 person | 0 |
| Deaths among original residents | 0.00 | 0.02 | 1 | 2% of opening population, minimum 1 | 0 |
| Household cash, cents | 2,500 | 2,500 | 0 | 625 cents (25% opening) | 0 |
| Pantry kcal | 676,719 | 701,556 | 99,254 | 259,000 kcal (25% opening) | 0 |
| Positive-intensity grudges | 0.68 | 0.80 | 4 | 20% of T2 count, minimum 1 | **13** |

**The paired grudge-distribution gate FAILS.** Matching an average does not establish
seed-level fidelity, and its declared band was not widened after measurement. Counts
include positive-intensity grudges held by deceased original residents, matching the
calibration stock measure; they are not a count of living hostile people. Children and
background deaths are T3-only processes, so small population differences are expected.
This control does not measure inheritance quality or demographic lifetime balance.

The original short pantry opens with 129,500 kcal versus 1,036,000 in the ample variant.
By day 60 both T2 and T3 have zero original survivors and empty pantries for all 50 seeds:
a useful famine consistency check, **not** evidence of sustainable balance. Cash means
are 2,454 versus 2,500 cents, maximum gap 250 within the 625-cent band. Grudge means are
0.68 versus 0.76, maximum gap four, again 13/50 failures. Population, original-resident
death, cash and pantry bands pass all 50 pairs in both variants. Mean isolated owner
cost is 0.9083 vs 0.00477 ms/game-hour with ample food, and 0.5541 vs 0.00482 with the
short pantry; these tiny-fixture component timings must not be extrapolated to county
throughput. Both runs have zero integer-state violations.

Legacy hashes were captured before implementation and compared afterward. No golden
or snapshot was refreshed:

| World | Seed | Hours | Baseline = final hash |
| --- | ---: | ---: | --- |
| Iron Ford | 42 | 240 | `f2557fd17adff297` |
| gen:town | 7 | 72 | `4b030f0160601229` |
| gen:town | 42 | 72 | `54baf667e53299a1` |
| gen:town | 131 | 72 | `6640fdceed29a42e` |

Raw artifacts: `runs/scratch/t3-gate-final-{ample,short}.json`, `t3-town-final.json`,
`t3-legacy.json`,
`t3-calibration.json`, `t3-calibration-t2.json`, `t3-final-focused.log`. These are
local, gitignored measurements; the reproducible harnesses and this report are tracked.


### Whole-town livelihood gate: FAIL — do not enable automatically

The same three generated towns used for year calibration were compared for 60 days
under forced isolated T2 and T3 owners, then T3 was promoted. This bypasses LOD admission
and the occupied-site/Chronicle loop, exactly as the T2 year calibration does; it tests
the entire settlement's livelihood rather than just a two-person household. Reproduce
with `node --import tsx packages/cli/test/bench/region-dormant-town-fidelity.ts <output>`.
All fidelity harnesses share `region-dormant-bands.ts` and return exit code **1** when
any declared band fails. These expected manual failures are separate from `just check`.

| Seed | Living population T2 / T3 | Deaths T2 / T3 | Household cash cents T2 / T3 | All food kcal T2 / T3 | Grudges T2 / T3 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 7 | 24 / 0 | 0 / 24 | 2,341 / 10,115 | 9,300,436 / 3,103,480 | 6 / 7 |
| 42 | 27 / 0 | 0 / 27 | 4,623 / 12,877 | 9,087,286 / 3,103,480 | 7 / 9 |
| 131 | 28 / 2 | 0 / 28 | 4,753 / 13,385 | 9,238,141 / 3,103,480 | 8 / 5 |

Population, mortality, cash and pantry bands fail **3/3** towns; grudge counts fail
**2/3**. Zero integer errors. Seed 131's surviving population consists of two births;
all original residents died. T3 preserves their identities and deaths, but this is a
severe livelihood-model failure, not plausible demographic noise or successful catch-up.
The food total includes merchant stocks: remaining settlement kcal do not imply that
households can obtain or prepare them. T3 lacks the buying, restocking and responsive
livelihood routines that sustain these towns at T2. Scheduled production alone does not
reproduce the calibrated household economy. Matching the tiny farm fixture's famine
must not be used to conceal this discrepancy.

Consequently **this implementation is an opt-in prototype, not a validated county
simulation**. `configureDormancy` enables the saved policy explicitly; mere distance
does not activate T3 in existing or newly loaded worlds. The next livelihood slice
needs a deterministic aggregate supply/trade contract through provisions, retaining
finite stock, prices, affordability/credit, preparation resources and actual seasonal
production. It must close these town bands before automatic enablement. Substituting
unexplained food/cash corrections, widening bands after seeing these results, or
silently falling back to an hourly T2 town would hide the problem.


### Scale frontier: unchanged 2,840-person county, T3 explicitly on

Reproduction: `node --expose-gc --import tsx
packages/cli/test/bench/region-dormant-scale.ts <output> <cap> [seed=41]`.
Same 2e fixture: fourteen settlements × 100 two-adult households plus 40 Iron Ford
actors. Node v26.11.1, shared/contended desktop-proxy host; fresh process for each row,
48-hour warmup including the full demotion grace, then 24 measured full-world hours.
Keep the original 300-minute near and 900-minute far roads. For this synthetic county,
configure entry **600 minutes**, exit **480**, zero extra T3 dwell and hourly radius
**360 minutes**. The default >24-hour policy would not make its 15-hour spokes dormant.
All actor identities and the complete county remain present.

The additional monthly column measures only T3: first flush the unfinished warmup
prefix, then advance the dormant owner exactly **30 further days** while active sites
are frozen. Divide this component by 720 hours. It is not a full-month county run,
and excludes contact-time mind hydration. The combined estimate sums separately
measured components; it is not a measured month-long throughput claim. The short
farm larders also make famine checks part of this component workload.

| Requested T1 soft cap (6 h radius) | Actual T0 / T1 / T2 / T3 | Full-world ms/h, measured day | 30-day T3 batch, seconds | T3 amortized ms/h | Combined component estimate ms/h |
| --- | --- | ---: | ---: | ---: | ---: |
| 150 | 40 / 200 / 200 / 2400 | 262.34 | 13.956 | 19.38 | 281.72 |
| 250 | 40 / 400 / 0 / 2400 | 258.24 | 14.196 | 19.72 | 277.95 |
| 400 | 40 / 400 / 0 / 2400 | 258.00 | 13.887 | 19.29 | 277.29 |
| 400, seed 42 check | 40 / 600 / 0 / 2,200 | 364.79 | 12.769 | 17.74 | 382.53 |

The cap is soft: a settlement cannot split its pantry/encounter ownership. Requested
150 becomes 200 T1; 250 and 400 both become 400. Seed 42 keeps another 200 residents
hourly under the eligibility exclusions. Radius/cap settings do not override relevant
people or unresolved dependencies. At cap 150 the unchanged T2 boundary accounts for
108.67 ms/h; caps 250/400 have about 2 ms/h outside scheduled hourly systems. This is
why moving one near settlement from T1 to the faithful T2 batch does not buy speed.
The older 2e benchmark reported roughly 1,607 ms/h with distant T2; these new rows are
unpaired measurements, not a controlled percentage-speedup experiment.

| Requested cap / seed | Post-GC process heap, MB | Packed World, MB | Gzip World, MB | Heap immediately after monthly pass, MB |
| --- | ---: | ---: | ---: | ---: |
| 150 / 41 | 492.37 | 59.35 | 12.41 | 1062.89 |
| 250 / 41 | 491.99 | 59.35 | 12.36 | 1081.76 |
| 400 / 41 | 490.71 | 59.35 | 12.36 | 1096.52 |
| 400 / 42 | 530.21 | 64.36 | 13.48 | 1135.11 |

Heap is measured before serialization and includes the content/runtime process; it
still exceeds the 120 MB worker proxy by roughly fourfold. The after-pass column is
**not** an observed high-water mark. Packed/gzip sizes are day-three World snapshots,
not complete PlaySession/generated-content saves or a long-run retention result.
Their 12.36–13.48 MB compressed size fits the 15 MB World-only ceiling in this window;
phone/browser resume, worker yields and full save sizes remain unmeasured. The batch
can block for roughly fourteen seconds. These measurements do not establish release
readiness even though most identities are dormant.

### Required hourly cost for the 5 ms/game-hour proxy

Let `R` be T2 + T3 + global overhead in ms/game-hour. The necessary active-actor
budget is **(5 − R) / (40 + actual T1)** ms/actor-hour. The measured T3 component alone
is 17.7–19.7 ms/h, so **no nonnegative T0/T1 cost meets 5 ms/h with today's residual**.
T3 livelihood/kernel work must also become cheaper; cap 150 additionally retains the
expensive faithful T2 settlement.

| Requested T1 cap | Ideal ceiling with exactly that cap and all other work free | Ceiling using actual whole-site T1 count and all other work free | Conditional target with 1 ms/h reserved for all other work |
| --- | ---: | ---: | ---: |
| 150 | 26.3 µs/actor-hour (190 actors) | 20.8 µs (240 actors) | 16.7 µs |
| 250 | 17.2 µs (290 actors) | 11.4 µs (440 actors) | 9.1 µs |
| 400 | 11.4 µs (440 actors) | 11.4 µs (440 actors) | 9.1 µs |
| 400, seed 42 exclusions | — | 7.8 µs (640 actors) | 6.25 µs |

The final column is an engineering allocation, **not achieved residual performance**.
The scheduled-system quotient is currently roughly 0.58–0.64 ms per hourly actor at
seed 41, including shared work. Even the zero-overhead ceilings therefore imply
roughly a 30–50× reduction of that quotient, plus a separate reduction of T3/T2/global
cost. Count caps alone cannot meet the proxy.

An instrumented monthly component sampled 12,981 ms under `settleDormantSites` during
a 13,984 ms batch. Meal/recipe/member/kitchen work dominates; named samples include
`membersOf` 7.94%, `kitchenOf` 4.99%, `idsOf` 4.38%, `deepSnapshot` 4.32%,
`appendStacksDeep` 2.93%, and `usableCareFood` 2.57%. Transpiler/native frames carry
substantial unattributed cost, so this is diagnostic evidence rather than precise
production-browser attribution. GC outside the T3 call tree is excluded. Raw profile:
`runs/scratch/t3-monthly.cpuprofile`; summary: `t3-profile-summary.json`; reproduction
scratch adapter: `t3-profile.ts`. Uninstrumented frontier artifacts:
`runs/scratch/t3-frontier-release-{150,250,400,400-seed42}.json`.

### Files and handoff

Core implementation: `region/{dormant-state,dormant,events,state,processing,coarse,lod,
system,census,evidence,view,api}.ts`; `sim/population.ts`; `events/index.ts`.
Owner adapters: `activity/dormant.ts`, `needs/dormant.ts`, `provisions/dormant.ts`,
`psyche/dormant.ts`, `social/dormant.ts` and their `api.ts` exports;
`activity/production.ts` accepts an optional actor subset; `items/api.ts` supplies
the temporary settlement inventory facade. No content, dependencies or golden files
changed. Exported contracts and view shapes are additive; `MODULES.md` records them.

Validation/reproduction: `packages/cli/test/region-dormant.test.ts`;
`packages/cli/test/bench/region-dormant-{bands,calibration,fidelity,town-fidelity,scale}.ts`;
existing `bench/region-scale.ts` now reports T3 counts. Measurement artifacts stay under
`runs/scratch/`, outside version control. Work remains on `wave10/m5-t3`; no commits.

Open acceptance work is substantive: aggregate household supply/trade and demographic
calibration beyond three towns, failed paired grudge distributions, full physiology
fidelity rather than maintained-rest/thirst/warmth assumptions, inter-settlement moves,
bounded worker execution, and heap/save compaction. The next hourly speedup has the
microsecond targets above, but it cannot by itself close the county budget. Keep the
prototype explicitly enabled only in experiments until the livelihood gate closes.

**Final repository gate GREEN:** `VITEST_MAX_WORKERS=2 just check` completed with
89 test files / **953 tests**, all package/script typechecks, 269 invariant-checked
core files and 115 validated content files; Vitest duration 761.96 seconds. The Iron
Ford golden passed unchanged. Log: `runs/scratch/t3-check-complete.log`. Final manual
harness/report additions also passed the CLI typecheck and repository Biome check
(458 files); `git diff --check` is clean. Direct legacy comparisons were repeated on
the final runtime (`t3-legacy-final.log`), with all four hashes unchanged. This green
software gate does **not** override the explicitly failed fidelity and scale gates.
