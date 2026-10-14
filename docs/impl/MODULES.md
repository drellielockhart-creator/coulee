# Coulee module ownership and contracts

**Status (2026-10-12):** M1–M3 town slice, survival, fae 1a/1b, headless/web PlaySession and M4 UI are integrated; town v2 and county generator v3 are built. Relief, charm refusal costs and M5 slice 1 are in progress. Each module retains **exclusive file ownership**; original acceptance lists remain targets, not blanket completion claims.
**Canon, in order:** `design-docs/00-vision-and-pillars.md`, then `design-docs/adr/0001` to `0003`, then this file, then design docs 01–13 (13 owns fae omens, magic and charms). Docs 01–07 predate the TypeScript decision, so ignore their Rust/Godot specifics. In 04, "Persona" for rumor identities is now **Figure**.

Read `CLAUDE.md` first: it has the invariants and the commands.

---

## 0. Rules for every module agent

1. **Write only the paths you own** (listed under your `## module:<id>` heading). You may *read* anything.
   - If you need a change in a file you don't own, don't make it. Write the exact request (file, change, reason) under **"Requests to foundation"** in your final report. The orchestrator applies foundation changes between waves.
2. **`just check` must pass** before you finish: lint, typecheck, tests, invariants, and content validation. Run `just fmt` to auto-format.
3. **Contracts are additive.** You may add fields, event kinds, commands, API functions, and optional parameters.
   - You may **not** rename, remove, or change the meaning of an exported type, field, or function that another module or the web reads. That includes your own `view.ts` shapes.
   - If you must break something, keep the old shape working and report it.
4. **Handle empty or absent module data.** The town modules are integrated; tests and legacy saves may still supply empty values (`[]`, `null`, `0`, a no-op). Put your behavior behind your own API, not inside someone else's.
5. **Determinism:**
   - No `Math.random`, `Date`, timers, or transcendental `Math` in `packages/core/src`. `check-invariants` enforces this.
   - Randomness comes only from `ctx.rng(stream, mixKey(...entities, SALT))`. Pick a module-specific salt constant per decision.
   - Iterate tables with `idsOf()` / `rowsOf()`. Sort only with total comparators: break ties by id.
   - Accumulated state is **integers**. Scales: needs 0..1000, opinions −100..100, credence 0..100, money in cents, time in game-minutes, per-mille for fractions.
   - The determinism test in `packages/cli/test/determinism.test.ts` must keep passing, including JSON save/load mid-run and the all-integers check.
6. **P1 legibility:** every check or arbitration that changes state attaches an `Explain` to the event it emits. Use `knowledge` (`'public'|'participants'|'self'|'omniscient'`) to say who may see the math. View functions honor `ViewOptions.perspective` and `omniscient`.
7. **P2:** no player-only rule paths or rules branching on `controller`. Agency is actor policy (`commanded` or `psyche`) plus standing orders; every consequential executor uses `psyche/api.ts authorizeAct` (13 §2.2), alongside `needs/api.ts canAct`.
8. **No hardcoded peoples** (ADR invariant 4). Read people *fields* (`concealed`, `cold_iron_sensitive`...), never compare against `'shadow_faekin'`.
9. **Do not copy D&D text.** Use mechanics shapes only.
10. **Tests:**
    - Unit tests go next to your code (`packages/core/src/<module>/*.test.ts`). Core tests may not import `@coulee/content` (Node).
    - Integration tests that need real content go in **`packages/cli/test/<module-id>.test.ts`**, which you own. Use `packages/cli/test/helpers.ts` (`baseContent()`, `simFor()`, `actorByKey()`).
11. **Shared play/worldgen contracts:** `packages/play` (ADR 0002) and `packages/worldgen` (ADR 0003) exist and have their own owners below:
    - every player action must be a `Command`;
    - observations come from the view model, with `perspective` gating;
    - town worldgen emits the same shapes as scenario TOML; county graphs are generator output, not yet a playable region.

---

## 1. Architecture at a glance

### 1.1 Layout and ownership map

```
packages/core/src/
  ids.ts time.ts rng.ts explain.ts checks.ts hash.ts      foundation
  actor.ts content.ts urge.ts command.ts world.ts         foundation (composition)
  viewmodel.ts viewmodel-types.ts index.ts                foundation (composition)
  events/{base,core-events,index}.ts                      foundation (Event union registry)
  sim/{context,init,schedule,sim}.ts                      foundation (system order, loop)
  needs/ activity/                                        module:needs-activities
  psyche/                                                 module:psyche
  social/                                                 module:social
  belief/                                                 module:belief
  provisions/ items/                                      module:provisions
  chronicle/                                              module:chronicle
  fae/                                                    module:fae
  region/                                                 module:region (proposed; not present yet)
packages/content/src/
  loader.ts index.ts *-cli.ts schema/{common,bundle,index,rules}.ts   foundation
  schema/needs-activities.ts   module:needs-activities
  schema/psyche.ts             module:psyche
  schema/social.ts             module:social
  schema/belief.ts             module:belief
  schema/items.ts              module:provisions
  schema/chronicle.ts          module:chronicle
  schema/fae.ts                module:fae
  schema/world.ts schema/scenario.ts   module:content-world
packages/cli/                  foundation (except test/<module-id>.test.ts: that module)
packages/play/                 module:play (pure shared session and host queries)
packages/worldgen/             module:worldgen (town + county/ layers and graph)
content/base/skills/           foundation
content/base/...               see each module
apps/web/                      module:web (except apps/web/public/assets/**)
apps/web/public/assets/, tools/blender/   module:assets
scripts/check-invariants*.ts   foundation;   scripts/screens.ts   module:web
```

Every module directory in `core/src/<m>/` has the same files:

| File | Contents |
|---|---|
| `state.ts` | `XState` slice type, `createXState()`, `initXState(world, ctx: InitContext)`: seeds from the scenario |
| `events.ts` | `XEvent` union of `EventOf<'x.kind', Data>`. **Add your event kinds here** (registry pattern; `events/index.ts` already unions every module's union) |
| `commands.ts` | `XCommand` union of `CommandOf<'x.kind', Data>` (`never` = none). Same registry pattern via `command.ts` |
| `system.ts` | `xSystem(world, ctx: SimContext)`: the hourly system, if any |
| `api.ts` | Functions other modules call. **This is the only way to touch another module's state** |
| `view.ts` | View-model parts plus `xDailyStats(world, content)` (stats.csv columns: return the *same keys every day*) |
| `index.ts` | Barrel. Exported from `@coulee/core` as a namespace (`import { social } from '@coulee/core'`) |

### 1.2 System order (fixed: `core/src/sim/schedule.ts`)

One step = one game-hour (T1). Before the systems run, the loop:
- emits `core.day_started` at 00:00;
- logs every Command as `core.command`.

| # | System | Owner | Reads | Writes |
|---|---|---|---|---|
| 1 | `psycheSystem` | psyche | proposals from every module + `core.urge` commands | `world.psyche` (thoughts, `chosen`, anxiety, defenses) |
| 2 | `activitySystem` | needs-activities | `psyche.chosenUrge`, schedules, places | `world.activity`, **`ActorCore.placeId`**, occupancy |
| 3 | `needsSystem` | needs-activities | current hour's activity minutes (labor, asleep, local walks) | `world.needs`, band conditions |
| 4 | `faeSystem` | fae | committed locations, canonical episodes, charm stores | `world.fae`; items/needs/social/belief effects through APIs |
| 5 | `socialSystem` | social | `activity.venues`, `psyche.chosenUrge` | `world.social`; calls `belief.transmit`, `needs.satisfyNeed` |
| 6 | `beliefSystem` | belief | beliefs, grudges, misfortune | `world.belief` |
| 7 | `provisionsSystem` | provisions | activity, items, temperature | `world.items`, `world.provisions`; calls `needs.feed` |
| 8 | `chronicleSystem` | chronicle | event log since cursor | `world.chronicle` |

Wave 10 A (2026-10-13): intentions and activity precede physiology, eliminating the one-hour lag. Short orders and local walks replace their actual share of the hour; needs round the weighted balance once. The same order applies to coarse regional hours; tactical participants retain interval settlement. Provisions completes preparations due by the closing boundary and never automatically feeds or recruits a sleeping cook.

Daily work runs when `ctx.isNewDay` (00:00), and `chronicle` sees the day's last events at the next hour. Module init order is explicit in `sim/init.ts` (items before provisions; fae last), after core creates places, households and actors.

### 1.3 Data flow

```
                ┌──────────── proposeXUrges(world, ctx, actorId): UrgeProposal[] ────────────┐
                │   needs (Id: hunger/rest/company)   activity (Superego: schedule duty)      │
                │   social (company, confront)  belief (avoid/accuse)  provisions (eat/buy)  │
                ▼                                                                             │
 Commands ─► psyche: Thoughts (Id | Superego | command) ─► Ego arbitration ─► ChosenUrge ─────┤
                │                       └─► anxiety ─► defense ─► psyche.defense event          │
                ▼                                                                             │
 activity: 'activity' urge or schedule ─► place + ActorCore.placeId ─► occupancy (venues)     │
                ▼                                                                             │
 social: pools at venues ─► interaction (check + Explain) ─► memories, opinion reasons,       │
                │            needs.satisfyNeed(company)   'interaction'/'defense' urges        │
                │                                                                             │
                └─ gossip ─► belief.transmit() ─► rumor variant, listener credence, Told memory│
 belief: credence decay, attribution, grudges, Heat/Consensus, escalation ladder 0-3 ─────────┘
 provisions: meals (prep: fire+fuel+cookware+water) ─► needs.feed(kcal); spoilage; nutrition
 chronicle: event log ─► notability + patterns ─► entries (period voices) ─► chronicle.md + UI feed
 view: toViewModel(world, content, opts) = core + Σ module view parts (perspective-gated)
```

### 1.4 Cross-module call contracts

| Caller | Callee (file) | Contract |
|---|---|---|
| psyche | `needs/api.ts proposeNeedUrges` | Id-voiced urges from deficits; intensity 0..1000 rising as the need falls below the 10 §3.4 thresholds (600/500/400 → ×10 scale already) |
| psyche | `activity/api.ts proposeActivityUrges` | Superego `duty` urges from `scheduledBlock()`; intensity = `ScheduleBlock.duty` |
| psyche | `social/api.ts proposeSocialUrges` | Company-seeking (activity at a sociable venue) and targeted interaction urges (confront, apologize, court) |
| psyche | `belief/api.ts proposeBeliefUrges` | Grudge/belief-driven urges (avoid, ask around, accuse) |
| psyche | `provisions/api.ts proposeProvisionUrges` | "Eat now" (Id), "buy flour before the Sabbath" (Superego), keyed to readiness |
| psyche | `belief/api.ts formProjection` | Projection defense: holder forms a belief that the target has the disowned trait |
| activity, social | `psyche/api.ts chosenUrge` | Read-only. `null` ⇒ activity follows the schedule; social pools normally |
| social | `activity/api.ts venues / occupants` | Pools = actors sharing a place this hour, ascending ids |
| social | `belief/api.ts transmit` | **The only gossip path.** Social picks *whether* to gossip (interaction volition); belief picks the *topic*, mutation, credence update, the Told memory, and emits `belief.transmitted` |
| social | `belief/api.ts hasRumorFor` | Precondition for `requires.rumor_available` |
| social, belief, provisions | `needs/api.ts satisfyNeed` | Generic need delta (company, faith, security), clamped 0..1000 |
| provisions | `needs/api.ts feed / drink` | Food energy (kcal) and water (ml) → hunger/thirst. Needs owns the conversion and labor multipliers |
| needs, provisions | `activity/api.ts currentActivity / laborOf / isAsleep` | Labor level drives need decay and kcal/day |
| belief | `social/api.ts addMemory / opinionOf / areKin` | Told/Observed memories cite events; opinions feed plausibility and trust |
| social, belief | `psyche/api.ts addThought / addAnxiety` | Inject reactive thoughts ("hit him") and fear/anxiety from events |
| anyone | `items/api.ts` (provisions) | `stacksAt`, `stacksDeep`, `affordanceAt`, `weightG`, `bulkTenths`, `moveStack`, `consumeStack` (jobs query **affordances**, never item ids; 03 §3.2) |
| web, cli | `chronicle/api.ts renderChronicleMarkdown / chronicleEntries` | chronicle.md and the UI feed |
| web | `provisions/api.ts readinessOf` | The P8 planner query (11 §1.7: the UI asks, the core answers) |
| social | `provisions/api.ts transferCash` | Loans/repayments debit real cents (purse first, then household cash), credit the payee’s purse and record only the actual transfer on the debt ledger |
| social, provisions | `belief/api.ts isShunning` | Rung 3 consequences: shunners withhold every non-hostile interaction (`shun_volition_penalty`); a shunning storekeeper charges 150% and refuses credit |
| belief | `social/api.ts addOpinionReason`, `reasonsOf` | A formed belief about a person (and a projection) adds one Reason citing `{kind:'belief', id, propId}`, sized by the predicate's valence and weighted by credence |
| psyche | `social/api.ts addDefenseReason`, `acquaintancesOf` | Rationalization leaves "Had it coming" (`{kind:'defense', eventId, strength}`, fades like the bucket); the mind's acquaintances come from social, not from its tables |
| needs | `provisions/api.ts airTempF` | One weather hook for exposure and spoilage |
| every executor | `psyche/api.ts authorizeAct`, `needs/api.ts canAct` | Actor-wide authorization and incapacity checks; consequential replies become social pending requests |
| social, play | `social/api.ts interactionAvailability / requestTerms` | Shared zero-time social preflight and explicit terms for pending requests |
| belief, social | `fae/api.ts effectiveFi / charmTransferred / noteItemInteraction` | Protected-site-safe FI for tells and charm custody/interaction notifications; fae owns magical truth |
| provisions planner | `fae/forecast.ts forecastCharms / forecastHems` | Knowledge-gated charm projection; verified hems use the ordinary storage kernel |
| web, cli | `packages/play` | Shared Commands, fair/god observations, interrupts, replay/save/fork and storefront/food-ledger queries |
| cli, play source | `packages/worldgen` | Versioned town records installed by `townContent`; county v3 returns layers/graph/hashes/QA and ford-town context |

**Mutation rights on shared core data:**
- `ActorCore.placeId`: activity only.
- `ActorCore.sheet.conditions`: each module toggles only the condition ids it owns (listed per module), via `setCondition()`.
- `ActorCore.alive`: needs survival owns death (`needs/survival-social.ts`); provisions handles estates/succession through APIs.
- Survival aftermath owns household-head succession and kin adoption (`ActorCore.householdId`); moves still go through activity. Other shared fields are read-only after init unless an owning API explicitly handles the change.
- **Decision (integration, 2026-10-11): acquired traits stay in psyche state.** Habitual defenses grant Suspicious/Zealot into `psyche.byActor[id].acquired`; psyche never appends to `ActorCore.traits` (the authored sheet). Anything that weighs traits reads `psyche/api.ts effectiveTraits(world, id)` (innate ∪ acquired): psyche's own thought weighting and social's `trait:` volition driver do.

### 1.5 Content pipeline

- TOML lives in `content/base/<dir>/**/*.toml`. Records are `[[key]]` arrays of tables; scenarios are one file or one directory per scenario.
- zod schemas live in `packages/content/src/schema/*.ts` and are **strict** (unknown keys are errors).
- Each schema file exports a domains object (`xDomains`) and a cross-reference check (`xRefs`). `schema/bundle.ts` spreads them all, so **to add a content domain, add it to your own `xDomains`** with a new directory you own.
- Scenario composition: per-module scenario fields (`xActorFields`, `xHouseholdFields`, `xScenarioFields`) live in the module's schema file and are spread into `schema/scenario.ts`. Extend your own field objects, not scenario.ts.
- Core imports content **types** only (`core/src/content.ts`).
- Field names stay snake_case from TOML through TS. Integer units are in the name: `weight_g`, `value_cents`, `kcal`, `*_pct`, `*_minutes`, `*_ml`. Decimals (`decimal1`) are allowed only for magnitudes (affordances, bulk); convert them with `Math.round(x*10)`.
- `pnpm -C packages/content run bundle` writes `packages/content/dist/content-bundle.json`, which the web worker fetches.

### 1.6 Commands, urges, events (core contracts)

- `Urge` (`core/src/urge.ts`): `{kind:'activity', activityId, placeId?, itemId?} | {kind:'interaction', interactionId, targetId?, topic?, itemId?, terms?} | {kind:'defense', defense, targetId?}`; item `Terms` are loan/sale/gift data.
- `UrgeProposal`: `{urge, voice: 'id'|'superego'|'command', intensity 0..1000, label, source, reasons: ExplainTerm[], drive?, norm?, speaker?}`.
- `ChosenUrge`: `{urge, voice, thoughtId?, compromise, at, explain}`, stored at `world.psyche.byActor[id].chosen`.
- Commands:
  - Commands carry an issuer for agency checks; `core.standing_orders` changes actor policy at zero time.
  - `core.urge {urge}` is the universal "I want to do X". It enters psyche as a `'command'` proposal.
  - Module commands like `provisions.buy` are handled by their owner's system via `commandsFor(ctx.commands, 'provisions.')`.
- Events: `ctx.emit({kind, data, roles?, visibility?, place?, importance?, causes?, explain?, t?})`.
  - Event kinds are `'<module>.<snake_case>'`.
  - `visibility`: `public | witnessed | private | secret | inner` (mind events are `inner`).
  - Give `importance` (0..100) to anything chronicle-worthy.
  - **Log only what someone could tell or ask about.** Routine bookkeeping is state, not events: the hourly need balance (`needs/system.ts hourlyLedger`, re-derived for the dossier's Explain), hearth burning (logged when lit/out), lamps by the clock, belief fading (logged when a belief lapses), unchanged re-attributions. A year of Iron Ford is ~0.75M events (~2 per actor-hour), not 4M.
  - **Bounded retention (ADR 0001 + P6).** The log is append-only and ids stay dense, but the World holds a rolling window (`DEFAULT_LOG_RETENTION`: 2 days of everything, 14 days of events with importance ≥ 20), trimmed daily after the chronicle has sifted. The full stream goes to `Sim.sink` (the CLI writes `events.jsonl` through it). Pass `logRetention: null` to `createSim` (tests: `simFor()` does) to keep every event. No module may look up old events in the log: cite ids, keep what you need in your own state.

---

## module:needs-activities

**Owned paths (exclusive):**
- `packages/core/src/needs/**`, `packages/core/src/activity/**`
- `packages/content/src/schema/needs-activities.ts`
- `content/base/needs/**`, `content/base/activities/**` except fae-owned `activities/charms.toml`
- `packages/cli/test/needs-activities.test.ts`, `survival.test.ts`, `survival-wave4.test.ts`

**Implements:**
- `needs/system.ts needsSystem`: decay by `decay_per_hour` × `labor_pct[labor]` × `asleep_pct`, plus the current activity's `needs` deltas, clamped 0..1000. Then update `bands`, emit `needs.band_changed`, and toggle band conditions.
- `needs/api.ts`: `feed(kcal)`, `drink(ml)`, `proposeNeedUrges`, `canAct` and survival queries; the shared integer hourly ledger applies labor and physiology, including protein/fat debt.
- `activity/system.ts activitySystem`: apply the `chosenUrge` activity unless `lockedUntil`; else the schedule (`scheduledBlock`); else idle at home.
  - Resolve the place (`home | workplace | venue` by `venue_tags`, deterministic choice | `anywhere`).
  - Move the actor (T1: instant within a site is fine for M1; `travel` is available for multi-hour moves).
  - Emit `activity.started` / `activity.moved`, then `recomputeOccupancy()`.
- Survival owns deprivation/Fortitude checks, Vigor/Wounds, collapse/death, aid and fae-time stasis; aftermath calls social/provisions APIs for grief, funerals, adoption and estates.
- `activity/api.ts proposeActivityUrges`: Superego duty from the schedule. Add the Sabbath (`attend_church` on Sunday mornings for the pious via schedule or urge) and market-day behavior (05 §4.6).

**Content:** flesh out `needs.toml` per the 10 §3.4 registry, keeping the 0..1000 scale: hunger, thirst, rest, warmth, company, standing, security, faith. Also flesh out `activities.toml` (sleep, work, meals at table, cook, keep house, tend stock, attend church, tavern, visit kin, market, fetch water, chop wood...). Occupation **schedules** are written by content-world against your `OccupationSchema`.

**May read:** everything; `psyche/api.chosenUrge`; `content.occupations`; `world.places`/`households`.

**Event kinds:** `needs.band_changed`, `needs.fed`, `needs.drank`, survival/collapse/death/aid/stasis events; `activity.started`, `activity.moved` and observance/attendance/rota/gathering events. The module event unions are authoritative.

**Conditions owned:** need-band conditions (`hungry`, `starving`, `exhausted`...) and survival harm/collapse conditions declared in `content/base/needs/`.

**Viewmodel parts:** `NeedsActorView` (`needs/view.ts`), `ActivityActorView` and `ActivityPlaceView` (`activity/view.ts`). Fill `name`/`verb`/`travelingTo`/`arriveAt` truthfully; the renderer interpolates with them.

**Read:**
- 05 §6.1–6.4 (Hunger, Thirst, Temperature, Fatigue and sleep)
- 02 §11 "Needs and survival: rules hooks only"
- 04 §3.3 "Needs and Mood", §11.2 "T1: activity-scheduled encounters"
- 10 §3.4 "Need registry"
- 05 §4.3 "Seasons and the agricultural year", §4.6 "The human calendar"
- 07 §3.5 "LOD tier management" (T1 activity model)

**Acceptance:**
- In Iron Ford, seed 42, 14 days: every adult is at their workplace during most scheduled work hours on workdays, asleep at home at night, and most church-going actors are at the church on Sunday morning. Assert the fractions in `packages/cli/test/needs-activities.test.ts`.
- Needs stay in 0..1000 under a fast-check property over random activity sequences. Sleeping raises rest; heavy labor drains hunger faster than rest-labor (asserted).
- With no chosen urge, authorized behavior follows schedules. With a `core.urge` command `{kind:'activity', activityId:'drink_at_tavern'}` for an actor, that actor ends up at the tavern within the hour through psyche arbitration. Test the activity side by setting `world.psyche.byActor[id].chosen` directly.
- Occupancy equals the set of actors whose `placeId` is that place, for every hour (property).
- `needs_*_mean` columns appear in stats.csv. Determinism tests pass.

---

## module:psyche

**Owned paths:**
- `packages/core/src/psyche/**`
- `packages/content/src/schema/psyche.ts`
- `content/base/traits/**`; new domains under `content/base/psyche/**` (drives, norms, defenses, voices per 10 §14.3)
- `packages/cli/test/psyche.test.ts`

**Implements:**
- `psyche/system.ts psycheSystem`: gather proposals from the module `propose*Urges` APIs (including fae) plus `core.urge` commands (voice `'command'`), as in §1.4. Then:
  - Build Thoughts: trait `voice_pct` and `urge_bias` multipliers; decay; cap per tier.
  - Arbitrate (10 §5.2 scoring; ties broken by total order). The output is `ChosenUrge` with an `Explain` of kind `'arbitration'`, knowledge `'self'`, and children = candidates with scores.
  - **A `'command'` proposal always wins** (10 §5.5) and books anxiety from the overridden voices.
  - Compromise/sublimation when ego strength allows (10 §5.3).
  - Anxiety economics (10 §6), integer fixed-point decay.
  - Defenses (10 §7): emit `psyche.defense`.
    - Displacement/projection set `chosen` to a `{kind:'defense', defense, targetId}` urge that social executes.
    - Projection also calls `belief.formProjection`.
- `psyche/api.ts`: thoughts/anxiety, effective traits, actor agency/standing orders and `authorizeAct`; autonomous urges remain advisory for commanded actors unless authorized.
- Persona/Shadow minimal fields (10 §8.1–8.2). You may restructure `persona` into a struct, but **keep `PsycheActorView.persona: string | null`** for the web (add new fields alongside).

**Content:** traits with psyche weights (04 §3.2 examples; 10 §3), defenses (10 §7.2; the 7 in `DEFENSE_IDS` for M1), drives/norms if you implement them.

**May read:** all module APIs and views; `ActorCore.values`/`traits`.

**Event kinds:** `psyche.thought` (notable only), `psyche.arbitrated` (only on real conflict or a change of course: keep the log lean), `psyche.defense` (importance ≥ 30).

**Conditions owned:** none by default (add `anxious` if you want; declare it here in your report).

**Viewmodel:** `PsycheActorView`.
- `thoughts` carry `voice` so the UI can render Id vs. Superego voices (period labels per 10 §12 are welcome as extra fields).
- **P1:** defenses and shadow are hidden from the self-view until Insight (`canSeeUnconscious`); keep that.

**Read:**
- 00 P7
- ADR 0001 "Psyche-lite"
- 10 §3 "Structure", §4 "Thoughts", §5 "Ego arbitration", §6 "Anxiety economics", §7 "Defenses", §8.1–8.2, §14 "Implementation" (esp. **§14.5 Divergences**: 0..1000 intensity scale, command voice, P1 view gating)
- 04 §3.1 "Personality: Values", §3.2 "Traits"

**Acceptance:**
- Unit: arbitration is deterministic and its Explain children sum correctly. A `'command'` proposal wins against any Id/Superego mix (property test). Anxiety stays in 0..1000 (property).
- Integration (Iron Ford, 30 days): every living actor has a `chosen` urge most hours, and at least one `psyche.defense` event occurs across seeds 1..10. A hot-tempered actor's defenses skew to displacement versus a pious actor's to repression/reaction formation over many seeds (assert a ratio band).
- Hunger below 300 produces an Id thought about eating that wins arbitration over a mild duty, unless superego is very strict (test both).
- Determinism tests pass. Thoughts never leak into another actor's view with `perspective` set.

---

## module:social

**Owned paths:**
- `packages/core/src/social/**`
- `packages/content/src/schema/social.ts`
- `content/base/interactions/**`, `content/base/social/**` except the fae-owned records listed under module:fae
- `packages/cli/test/social.test.ts`

**Implements:**
- `social/system.ts socialSystem`: encounter pooling at shared venues (04 §11.2: sample top ties present + 1 stranger; **no all-pairs scan**), volition (Comme il Faut terms in `InteractionDef.volition`), checks via `core/checks.ts` (`skillCheck`, `opposedCheck`, `saveTerms`).
  - Effects: opinion **reasons** only (04 §6.2 DECISION), memories, and `needs.satisfyNeed`. Witnesses (0–2 sampled) get `overheard` memories.
  - Execute `chosen` urges of kind `interaction` and `defense` (displacement = hostile interaction toward a safer target; 10 §7).
  - Emit `social.interaction` with the Explain and roles `[initiator agent, target target, witnesses witness]`.
- `social/api.ts`:
  - `addMemory` (real; integer salience 0..1000, decay per 04 §4.3 with fixed-point multipliers);
  - `opinionOf` (weight reasons by cited memory salience / belief credence);
  - `proposeSocialUrges`;
  - `opinionLabel`;
  - relationship/kinship helpers;
  - the compatibility base (04 §3.1).
- Memory decay and consolidation daily (04 §4.3); distortion is optional for M1 (04 §4.4).

**Content:** the 04 §10 catalog, at least chat, gossip, deep talk, compliment, slight, insult, fight (stub as an opposed check with no injuries), help, lend, borrow, repay, dun, gift, warn, apologize, forgive, threaten, flirt, toast. **Write mechanics in your own words** (no D&D text).

**May read:** `activity.venues`, `psyche.chosenUrge`, `belief.hasRumorFor`, needs values, `ActorCore.values/traits`.

**Event kinds:** `social.interaction`, `social.memory_formed` (optional; keep lean), `social.label_changed` (Friend/Enemy transitions; chronicle-worthy).

**Conditions owned:** none (`drunk` belongs to provisions).

**Viewmodel:** `SocialActorView` (opinions with reasons, memories, relationships). Respect `perspective`:
- other actors' memories are private (show only to self/god);
- opinions toward the viewer are inferable only via labels. Document your choice.

**Read:**
- 04 §3.1–3.2, §4 "Memory", §6 "Opinion", §7 "Relationships, households, lineage", §10 "Social interactions catalog", §11.1–11.2, §12.1 "Character dossier"
- 02 §3.6 "Opposed checks"
- 10 §13.2 "With 04"

**Acceptance:**
- Iron Ford, 60 days, seed 42: ≥ 3 interactions per actor-day on average (04 §11.2 budget). Every `social.interaction` with a check carries an Explain. At least one opinion pair drifts by ≥ 20 affection over the run.
- Encounter selection cost is O(n·k), not O(n²): assert via a counter on a synthetic 300-actor pool, or a code comment plus a test with a capped sample.
- Opinion values equal base + Σ weighted reasons + volatile (property). They're clamped, and never written directly.
- Gossip interactions call `belief.transmit` exactly once each; an empty belief graph resolves as `told: false`.
- Determinism tests pass.

---

## module:belief

**Owned paths:**
- `packages/core/src/belief/**`
- `packages/content/src/schema/belief.ts`
- `content/base/beliefs/**` except fae-owned `beliefs/charms.toml`
- `packages/cli/test/belief.test.ts`

**Implements:**
- `belief/state.ts initBeliefState`: also seed `scenario.beliefs` and `scenario.secrets` (intern props, mapping actor/figure keys by the predicate's arg kinds; validate in `beliefRefs`).
- `belief/api.ts`:
  - `transmit` (04 §8.3 topic score, §8.5 mutation, §5.3 credence update with lineage novelty; integer logit table, no `exp`/`log`). It adds a Told memory via `social.addMemory` and emits `belief.transmitted`.
  - `hasRumorFor`, `observe`, `formProjection`, `suspicionOf`, `proposeBeliefUrges`.
- `belief/system.ts beliefSystem`:
  - credence decay;
  - attribution re-runs on misfortunes (04 §5.4);
  - grudges as objects (04 §6.3: spawn, drift, rehearsal);
  - community Heat/Consensus (04 §9.1) and the escalation ladder **rungs 0–3** (04 §9.2: Unease, Whispers, Accusation, Shunning) with dwell times and step-down;
  - misfortune pressure M;
  - **concealed shadow_faekin suspicion** (12 §7: tells → evidence → `faekin(x)` beliefs; priors per 12 §7.4 / §11.4).
- Figures (00 glossary; 04 §5.1): `IsFigure` props with their own credence.

**Content:** predicates (04 §5.1; ~15 for M1), evidence base weights, channel tables (04 §8.4) as data.

**May read:** `social` (opinions, memories, kinship), `psyche` (anxiety), `activity` (who is where), peoples fields.

**Event kinds:** `belief.formed`, `belief.transmitted`, `belief.grudge_formed`, `belief.escalation` (+ `belief.figure_attached`, `belief.suspicion_raised` as you need).

**Conditions owned:** none.

**Viewmodel:** `BeliefActorView` (beliefs, grudges) and `BeliefGlobalView` (figures, persecutions, misfortune). P1: hide others' private beliefs; show voiced ones.

**Read:**
- 04 §5 "Beliefs and knowledge", §6.3 "Grudge", §7.3 "Inherited grudges", §8 "Rumor system", §9.1–9.2, §9.5 "Defusal", §15.1 & §15.4 (worked stories)
- 12 §7 "Concealment and discovery", §11 "Relations, prejudice, and priors"
- 10 §7 (projection → beliefs)

**Acceptance:**
- A seeded rumor started by one actor in Iron Ford reaches ≥ 30% of adults within 30 days on most seeds 1..20 (once social gossips; until then, test `transmit` directly). The variant tree records mutations. Repeated hearings from one lineage count less than independent sources (unit test on the novelty term).
- Credence stays in 0..100 (property). No `exp`/`log`: the integer logit table is checked by `check-invariants`.
- Escalation: with injected misfortunes attributed to one actor, the ladder reaches rung ≥ 2 in some but not all seeds (07 M2 spirit), and steps down without fuel.
- A concealed `shadow_faekin` actor is never revealed in views with `omniscient: false` unless some belief exists. Their `people` field shows the presented people.
- Determinism tests pass.

---

## module:provisions

The user's standing directive (00 P8, restated 2026-10-10): **the player has to keep track of different kinds of food, camp rations and supplies, and that crunch must make a meaningful difference.** It's the "looking through catalogs as a kid" feeling: specifics matter because the world checks them. This module is where that promise is kept or broken. Every number here has to bite, and has to be explainable.

**Owned paths:**
- `packages/core/src/provisions/**`, `packages/core/src/items/**`
- `packages/content/src/schema/items.ts` (the item/food schema; content-items writes TOML against it)
- `content/base/provisions/**` (new domains: meal plans, ration policies, store restock tables)
- `packages/cli/test/provisions.test.ts`

**Implements:**
- **Item model** (`items/`, 03 §3):
  - stacks with nesting containers to arbitrary depth;
  - protection evaluated outside-in (03 §3.4);
  - affordance queries scaled by quality/condition;
  - wetness;
  - weight/bulk totals and load bands from STR (03 §4.1; `ItemsActorView.loadBand`);
  - partial `moveStack` (split);
  - provenance ids.
- **Food crunch** (`provisions/system.ts`). Every rule is integer and comes with an Explain:
  - **Meals** at meal hours (breakfast, dinner, supper; 05 §6.1). Households eat from the pantry at home; travelers eat from their kit.
    - Pick foods by a household/actor policy: balance kcal, freshness, variety, spoilage-first, and cost.
    - **Preparation:** prep methods need a fire (consumes `supply.kind = 'fire'` items for `fire_minutes`, per batch), cookware affordances, water per serving, and time.
    - With no fire or kettle, beans are inedible and hardtack is eaten raw at a morale cost.
    - `kcal_pct` applies. Optional prep skill checks use `trade_cookery`.
  - **Spoilage:** hourly or daily, `spoilage += 1000/(shelf_life_days×24)` per hour, × temperature band % (`temperature.ts`: monthly normals + diurnal; storage kind) × wet % × packaging % (from the protections of the containers it sits in).
    - At 1000 the stack spoils into `spoils_to` or is ruined, and `provisions.spoiled` fires with an Explain naming the factors.
    - Vermin risk for `vermin` foods in unprotected storage.
  - **Nutrition:** daily intake history; scurvy risk from low `fresh` over weeks; monotony from few food groups; conditions and `provisions.nutrition` events; morale hooks (psyche may read).
  - **Households and stores:**
    - pantries deplete; rations get cut on shortage (`provisions.shortage`);
    - store stock at Pratt & Daughter with markup and **credit** (Gussie's ledger, 01 §8.3; 03 §8.5);
    - NPC purchases via urges;
    - `provisions.buy/eat/set_rations/pack` commands by the same rules.
  - **Consumables on a schedule:** lamp oil per hour lit, candles, fuel per fire. Devices with `consumes` draw from `supply` items. (Caps per shot wait for combat; keep the mechanism generic.)
- `provisions/api.ts readinessOf`: the P8 planner. It returns days of food at current rations, kcal/day, days of fuel, what spoils first, what is unpreparable with the kit on hand, and plain-language warnings. **The planner and the sim must agree:** same functions, no separate estimate math (11 §1.7).
- `proposeProvisionUrges`.
- Temperature hook: keep `airTempF`/`storageTempF`/`tempBand` signatures; a weather module will replace the internals later.

**May read:** activity (location, labor), needs, ActorCore abilities, places/households.

**Event kinds:** `items.created`, `items.moved`, `items.consumed`; `provisions.meal`, `provisions.spoiled`, `provisions.purchase`, `provisions.shortage`, `provisions.nutrition` (+ `provisions.fire_lit`, `provisions.prep_failed` as you need).

**Conditions owned:** `malnourished`, `scurvy_early`, `scurvy`, `drunk`, `hungover` (declare others in your report).

**Viewmodel:**
- `ItemsActorView`, `ItemStackView` (Kit Sheet / Flat-Lay, 03 §2.3);
- `ProvisionsActorView` (purse, nutrition, readiness);
- `ProvisionsHouseholdView` (pantry, readiness);
- `ProvisionsPlaceView` (store stock with prices).

**Read:**
- **00 P8**
- 03 §2.3 "Loadout visualization", §2.4 "Readiness", §3 "The item model" (all), §4 "Encumbrance", §6.3 "Fire & Light", §6.4 "Cookery & Provisions", §8.1 "How a price is made", §8.5 "Credit, tabs, grubstakes, debt"
- 05 §6.1 "Hunger", §6.2 "Thirst", §6.3 "Temperature and exposure", §4.3 (seasons)
- 12 §5.5 / §8.6 "Material culture and P8" (foodways; goblin `kcal_pct`)
- 11 §1.7 "The UI asks; the core answers"

**Acceptance** (each one is a test in `packages/cli/test/provisions.test.ts` or a core unit test):
1. **Food is not one number:** two households with equal kcal stores eat differently. One has only flour + salt pork; the other adds dried apples or fresh fish. Over 60 days in spring, the first's members cross a scurvy-risk threshold and the second's do not.
2. **Spoilage bites and is explained:** the same salt pork lasts measurably longer in the cellar than indoors in July, and longer in brine than loose. Hardtack spoils far faster when wet unless it's in an `airtight`/`waterproof` container. Fresh trout is gone within ~2 days in summer. Each `provisions.spoiled` has an Explain listing band/wet/packaging multipliers.
3. **Preparation bites:**
   - Without a `boil` affordance, a beans-and-hardtack kit yields hardtack-only meals (raw, morale penalty).
   - Without fire supply, no cooked meals; with firewood, fire supply is consumed per batch.
   - Coffee needs grind + boil + fire.
4. **Planner = sim:** `readinessOf(...).daysOfFoodTenths` predicts the day the pantry runs out within ±10% when the sim is run forward with no restocking (multiple seeds).
5. **Households deplete:** in Iron Ford over 90 days with no buying, at least one household issues `provisions.shortage` and cuts rations. With buying enabled, store stock falls and cash/credit moves (integer cents; the ledger balances).
6. **Consumables on a schedule:** a lit lantern burns `lamp_oil` at its `consumes` rate. When oil runs out it stops providing `light`.
7. **Integers everywhere** (`findNonIntegers` stays empty). Determinism tests pass.

---

## module:content-items

**Owned paths:**
- `content/base/items/**` except fae-owned `items/fae.toml`
- `packages/cli/test/content-items.test.ts`

**Task:** transcribe the whole 03 §6 Starter Catalog (6.1–6.14; services in 6.15 are not items) into `content/base/items/<section>.toml` per `packages/content/src/schema/items.ts`, **in your own words where copy is concerned**. The catalog copy in 03 is original to this project, so you may keep it.

- Units: lb → grams (×453.6, rounded); prices $ → cents; bulk as given (one decimal).
- Materials as percent of mass; `tinplate` counts as iron (03 §3.3).
- Affordance tags per 03 §3.2 (snake_case: `heal_bleed`, `ward_fae`, `contain_liquid` → use `container.liquid_ml`); tags (`wet_ruin`, `noisy`, `waterproof`, `perishable`...).
- Containers with `capacity_g`, `capacity_bulk`, `protects`, `carry`.
- Wearables with `insulation` (°F of band extension per 05 §6.3) and `wet_retention_pct`.
- `supply`/`consumes` for fuel, lamp oil, candles, powder, caps, ball (kinds: `fire`, `lamp_oil`, `candle`, `match`, `powder`, `percussion_cap`, `ball_<caliber>`).

**Food items need full P8 fields.** That's every food in 6.4 plus wild foods worth having: fresh trout, morels, ramps, wild greens, venison, eggs, milk, butter, potatoes, parched corn, pemmican, beans, cornmeal, tea, sugar, salt pork, cheese, tinned oysters, molasses, vinegar, dried apples, whiskey.

- Fields: kcal, protein_g, fat_g, fresh, group, servings, morale, shelf_life_days, spoilage (temperature_pct, wet_pct, packaging_pct, spoils_to, vermin), and prep methods with fire_minutes/batch_servings/cookware/water_ml/kcal_pct.
- Use real-world nutrition figures for the foodstuff (per lb), and period-plausible shelf lives (03 notes: "keeps months", "melts in summer", "ground coffee keeps for a week").
- **Make them feel different to carry and to live on** (00 P8 list: hardtack, pemmican, salt pork, parched corn, cornmeal, dried apples, coffee, sugar, tinned oysters, fresh trout, morels).
- Add packaging items that matter: tins, crocks, oilcloth bags, a brine keg, a flour sack, a provisions box (vermin-proof).
- Add prep chains where they matter (green coffee → roasted → ground), using `yields`.

**May read:** everything. Don't edit schemas; send schema requests to module:provisions via your report.

**Read:**
- 03 §1–§2.5 (catalog feeling, copy guidelines), §3.1–3.5, §6 (all), §7 "Starting budgets and kits"
- 00 P8
- 05 §6.1, §6.3 (insulation numbers)
- 12 §5.5, §8.6 (foodways)

**Acceptance:**
- `just content` passes. Every 03 §6.1–6.14 row has an item (a test lists the expected ids).
- Every item in sections `provisions`/`wild_food` has `food` with ≥ 1 prep method. Items whose 03 tags include `per` have finite `shelf_life_days`.
- The three 03 §7.3 prebuilt kits can be assembled from ids (a test checks they exist).
- At least 15 distinct foods with distinct (kcal/lb, fresh, shelf_life, prep) profiles: no two foods identical on all four (test).
- Weights and prices match 03 within rounding (spot-check test of 20 items).

---

## module:chronicle

**Owned paths:**
- `packages/core/src/chronicle/**`
- `packages/content/src/schema/chronicle.ts`
- `content/base/chronicle/**`
- `packages/cli/test/chronicle.test.ts` (+ golden snapshot files under `packages/cli/test/__snapshots__/chronicle*`)

**Implements:**
- `chronicleSystem`: incremental story sifting over events since `cursor` (05 §9).
  - Notability from `importance` + participants' notoriety.
  - Pattern detectors: start with Feud, Betrayal, Unlikely friendship, Debt repaid/unpaid, Reversal of fortune, The long winter/shortage (P8!), Scapegoat (05 §9.2 table).
  - Partial matches are kept as threads.
  - Emit `chronicle.pattern_matched`.
- Period-voice template prose from `chronicleTemplates` (Tracery-like variants, deterministic via `ctx.rng('chronicle', ...)`): Journal, Paper, Almanac, Ballad (05 §11.2).
- Knowledge basis per entry (05 §11.1): during a run, only public or PC-known; omniscient entries are epilogue only.
- `renderChronicleMarkdown` for chronicle.md (day/week grouping, headlines for the paper voice, an omniscient epilogue section at the end).
- `chronicleEntries` and the UI feed view.
- Replace the M0 day-heading placeholder with something readable. A daily almanac line is fine, but **chronicle.md should read as a story, not a log.**

**May read:** the event log, all views and APIs (names, places, opinions).

**Event kinds:** `chronicle.pattern_matched`.

**Viewmodel:** `ChronicleGlobalView.recent` (keep `ChronicleEntryView` fields; add `pattern`/`knowledge` if useful).

**Read:**
- 05 §9 "Story Sifting", §11 "The Chronicle"
- 04 §12.5 "Chronicle", §15 "Worked stories"
- 03 §10.4 "Chronicle lines (examples)"
- 01 §9 "Tone guide"
- 07 §4 "The sim harness" (story-quality metrics), §5 "Testing strategy" (golden chronicles)

**Acceptance:**
- `just run run --scenario iron_ford --seed 42 --days 60` produces a chronicle.md with ≥ 20 non-heading entries once other modules emit events.
  - With stubs, it still renders a clean almanac.
  - Templates are covered by a test that feeds synthetic events (`social.interaction` insult, `provisions.shortage`, `belief.escalation`, `psyche.defense`) and checks the rendered prose.
- At least 4 pattern detectors are unit-tested on synthetic logs (positive and negative cases).
- A golden snapshot of seed 42 / 30 days exists. Update it deliberately: a chronicle diff is a design review (07 §5).
- Entries never reference events above the viewer's knowledge in non-omniscient views. Determinism tests pass.

---

## module:content-world

**Owned paths:**
- `content/base/peoples/**`, `content/base/names/**`, `content/base/occupations/**`, `content/base/places/**`, `content/base/scenarios/**`, `content/base/cultures/**` (new, per 12 §13)
- `packages/content/src/schema/world.ts`, `packages/content/src/schema/scenario.ts`
- `packages/cli/test/content-world.test.ts`
- The charm fixture `scenarios/charm_at_iron_ford.toml` is fae-owned.

**Task:**
1. **Peoples** per ADR 0001 "Peoples" and **12-peoples.md §10 and §13 "Divergences"**:
   - update elf/goblin lifespans, senses (add `darkvision_ft`), `kcal_pct`, the `fae` block, `traits`;
   - move literacy to cultures (with care around the 12 §8.1 pitfalls).
   - `shadow_faekin` stays concealed by default with `passes_as`.
   - Schema changes go in `world.ts` (yours). If the core actor init must read a new field, report it as a foundation request.
2. **Name pools** for Yankee, Norwegian, German, Cornish, Irish, Swiss, and Black settler families from Ohio (01 §8.3), with elves and goblins added per 12 §5.4/§8.4.
3. **Occupations with schedules** against `OccupationSchema` (owned by needs-activities): storekeeper, smith, miller, tavern keeper/JP, pastor, lay preacher, mine captain, miner, surveyor, chainman, editor/printer, schoolteacher, farmer, farm wife, hired hand, child, militia captain (part-time), pellar/cunning-folk, wood-yard cutter, ferryman.
4. **Places:** the full Iron Ford site (01 §8.2: mill and dam, smithy at the ford, the Outfitter, Dunleavy's tavern, Sentinel print shop, schoolhouse, Lutheran church, Methodist meeting in Trevenna's parlor, ferry landing, the iron ford itself, homes, a few farmsteads on the slopes), with positions/footprints on the 64×48 grid and `model` ids. Coordinate model ids with module:assets via your report; both of you read `places/*.toml`.
5. **The Iron Ford scenario** (01 §8.3 NPC seeds):
   - ~30–40 actors in households, with relationships (kin, employer, creditor, neighbor, congregant);
   - seed opinions with reasons;
   - beliefs/secrets/figures/grudges (belief's fields);
   - pantries, inventories, and store stock (provisions' fields; make the larders *different*: a prosperous household vs. a failing lower-coulee farm);
   - **seeded tensions** from 01 §8.3: Brenner vs. Tveit; Tveit vs. Kvale; the Glovers vs. the speculator; Pratt's secret debt; Lydia and the missing chainman; Trevenna caught between company and knockers; Nora's changeling fear; Hurd's need for an enemy.
   - Include **at least one concealed shadow_faekin** (secret: `faekin(self)`), **some elves**, and **a goblin or two**. Follow 12's guidance on dignified portrayal.
   - Leave the Ho-Chunk placeholder as a placeholder (01 §8.3; it awaits consultation).
   - You may split the scenario into `scenarios/iron_ford/*.toml` (files merge).

**Read:**
- 01 §5 "Human society", §8 "Starter county", §9 "Tone guide"
- 12 (all, esp. §1 "Ground rules", §5–§9, §10 "Mechanics summary", §11.2, §13 "Implementation notes")
- 02 §2 "Ability scores", §12 "Ancestry hooks"
- 04 §7 "Relationships, households, lineage"
- 03 §7.2 "Starting purse by background"
- ADR 0003 (your scenario is the first worldgen fixture: keep it expressible as data)

**Acceptance:**
- `just content` passes; the Iron Ford scenario has 30–40 actors in ≥ 8 households, every actor has an occupation with a schedule, and every household has a home place on the site grid with no overlapping footprints (test).
- Every 01 §8.3 named NPC exists (test lists keys). ≥ 8 tensions are listed under `tensions` with actors.
- ≥ 1 concealed shadow_faekin, ≥ 2 elves, ≥ 1 goblin. Their `presents_as` is honored in `toViewModel` (non-omniscient views show the presented people).
- **Hand-authored abilities are final scores:** ancestry ability mods apply only in generated census actors (ADR 0003), not to authored sheets.
- `coulee run --scenario iron_ford --seed 42 --days 30` completes; determinism tests pass.

---

## module:web

**Owned paths:**
- `apps/web/**` **except** `apps/web/public/assets/**`
- `scripts/screens.ts`

**Implements:** the real pocket and desktop UI over the existing worker scaffold:
- `src/protocol.ts`, `src/sim.worker.ts`, `src/useSim.ts`: extend freely. Keep the "UI asks, core answers" rule (11 §1.7): **never recompute rules in the UI**, and use `query` messages backed by core APIs.
- Pocket layout (thumb-first, short sessions) and desktop multi-panel layout (11 §1–§2), from **the same view model**.
- Top-down three.js (or `@react-three/fiber`, installed) site view of Iron Ford: places from `vm.places` footprints and `model` glbs from `/assets/models/<model>.glb` (fall back to boxes), actors at their place.
  - Orthographic camera; interpolation between snapshots.
  - Draw from world data, never baked layouts (ADR 0003).
- Panels:
  - character dossier (needs, thoughts with Id/Superego voices, opinions with reasons, memories, beliefs);
  - **the P8 provisions panel** (Kit Sheet / pantry, days of food, what spoils first, weight/bulk, readiness warnings via the `readiness` query);
  - chronicle feed;
  - time controls with RimWorld-like speeds.
- **ADR 0002 parity rule:** every player action is a `Command` sent to the worker (`core.urge` for activities and interactions, module commands such as `provisions.buy`). Nothing in the UI mutates state.
- PWA: installable, works offline after first load (vite-plugin-pwa configured).

**Installed for you:** react 19, react-dom, three, @types/three, @react-three/fiber, zustand, vite-plugin-pwa, playwright-core, and @fontsource (eb-garamond, im-fell-english, ibm-plex-mono). You cannot install packages; report needs.

**May read:** everything; `@coulee/core` view types are your contract.

**Read:**
- 00 P6
- 11-interface-and-platforms.md (all; esp. §1 "Design principles", §1.7, §2 "Pocket, screen by screen")
- 03 §2.2 "The shopping screen", §2.3 "Loadout visualization", §2.4 "Readiness"
- 04 §12 "Player-facing UX"
- 10 §4.3 "How Thoughts look", §12 "Period framing"
- ADR 0002

**Acceptance:**
- `just web-build` succeeds; `just screens` produces `runs/screens/desktop.png` and `phone.png` showing the site view, a dossier, and the provisions panel with no page errors.
- At phone width (390 px) there is no horizontal scroll and every control is ≥ 44 px.
- The UI renders correctly with empty thoughts and readiness.
- Speeds work; pause works; `+1h` steps.
- Every interactive player action goes through `ToWorker` `command` messages (grep test or code review note).
- `just check` passes (the web typecheck is part of it).

---

## module:assets

**Owned paths:**
- `tools/blender/**`
- `apps/web/public/assets/**` (`models/<id>.glb`, `previews/<id>.png`)

**Art direction:** existing Blender models are placeholders. Replacement art and styling follow Ellie's 2026-10-12 watercolor direction in `00`, retaining overhead/phone legibility.

**Implements:** Blender 5.2 headless bpy scripts generating **flat-shaded low-poly** glb models with vertex colors from the shared palette (`tools/blender/palette.py`), plus 256 px preview PNGs. `just assets` rebuilds everything deterministically (no random without fixed seeds).

Models:
- **buildings** for every `model` id used in `content/base/places/*.toml`: mill, smithy, store, tavern, church, cabin, house, print shop, schoolhouse, landing, barn, farmstead;
- **props** (bridge/ford with iron bars, fences, woodpile, trees: oak, maple, pine; bluff rock);
- a few **actor figures** (generic adult, child, mule) at a common scale. 1 tile = 10 ft; models in meters, origin at footprint center on the ground, +Y up in glTF.

Keep each glb small (< 50 KB typical).

**May read:** `content/base/places/**` (model ids and footprints), apps/web code (how models are loaded).

**Read:**
- 00 P6
- ADR 0001 "Stack" (Assets row)
- 01 §8.2 "Iron Ford: town sketch", §1 (landforms, for props)
- 11 §5 (rendering notes, if present)

**Acceptance:**
- `just assets` runs headless with no errors and writes a glb + png for every place `model` id present in content at the time, plus the props list.
- A test or script check (`tools/blender/check_assets.py`, or a vitest in your report) confirms every referenced model id has a file.
- Models are flat-shaded, vertex-colored, < 2k triangles each.
- Previews read clearly at 128 px.

---

## Appendix A: foundation-owned files (request changes; don't edit)

- Root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig*.json`, `biome.json`, `justfile`, `.gitignore`, `CLAUDE.md`, `vitest.config.ts`.
- `packages/core/`: `package.json`, `tsconfig.json`, and `src/` files outside the module directories (`ids, time, rng, explain, checks, hash, urge, command, actor, content, world, viewmodel, viewmodel-types, index`, `events/**`, `sim/**`, their tests).
- `packages/content/`: everything except the module-owned schema files listed above.
- `packages/cli/`: everything except `test/<module-id>.test.ts`.
- `scripts/check-invariants*.ts`, `content/base/skills/**`, this file.

## Appendix B: requests to foundation (template for your final report)

```
### Requests to foundation (module:<id>)
- file: packages/core/src/actor.ts
  change: add `alive`-toggle helper `kill(world, ctx, actorId, cause)` emitting core.actor_died
  why: provisions starvation deaths (P8 acceptance 5)
```

## module:fae (slices 1a and 1b integrated)

Owner: `packages/core/src/fae/**`, `packages/content/src/schema/fae.ts`, `content/base/fae/**`, `packages/cli/test/fae.test.ts` and `fae-fix.test.ts`. Slice 1a contracts and acceptance are design-docs/13 §8.1; charms are added by 1b below. Workings and Tally remain ahead. Schedule: activity → fae → social. Fae owns episodes, canonical snapshots, thinning, signatures and open questions. It consumes belief and psyche through their APIs. Agency and authorization remain psyche-owned; pending loan requests remain social-owned. Additive consumers: place descriptions/worldgen, play Commands/observations, chronicle omen prose. Foundation owns the fae stream, composition, unions and optional canonical-time `rngAt` (present on real sim contexts; optional for legacy module fixtures).

### Slice 1b: charms

Adds to the slice 1a ownership: `content/base/fae/{charms,quirks}.toml`, `content/base/interactions/fae.toml` (fae-owned interactions, executed by social), `content/base/items/fae.toml` (fae-section items), `content/base/beliefs/charms.toml` (item predicates and `stock_short`), `content/base/activities/charms.toml`, `content/base/social/talk-charms.toml`, the fixture `content/base/scenarios/charm_at_iron_ford.toml`, `packages/cli/test/fae-charms.test.ts`, `packages/cli/test/fae-signs-r2.test.ts` and `scripts/fae1b-batch.ts`. Design: design-docs/13 §5, §6, §8.2.

World slice, one owner per record: `world.fae.{charms, drawCases, known, counts, ablation}` (fae); `world.social.{objectLoans, rotas}` (social); misfortunes stay belief's; stacks provisions'. Charm-specific fae fields are optional and initialized on use; adding 1b preserves legacy worlds without charms.

Contracts (all additive):
- **foundation:** `Urge` gains `itemId?` (activity, interaction) and `terms?` (interaction; `Terms` loan/sale/gift); `sameUrge`, `urgeLabel` and psyche `urgeKey` compare them field by field.
- **content:** `charms`, `quirks` domains; `ScenarioDef.fae_reservoir`; `InteractionDef.item {act, holder, response?, decision}`; derived predicates `claim.<item>.<claim>(item)` built at load (`DERIVATIONS` in `schema/bundle.ts`, run in `loadContent` before hashing); document `extends = "<id>"` for fixture scenarios (child scalars win, arrays concatenate).
- **belief:** `PropArg {kind:'item'}`; `Misfortune.causeItemId?` / `MisfortuneRequest.causeItemId?` (epilogue only; attribution never reads it); `formGrudge`; `registerMisfortune` re-exported.
- **social:** `objects.ts` (object loans, `itemPreflight`, `holderDecision`, `loanUrges`, `loansDaily`, `loansHourly`; a loan is between households: any grown member of the lender's house present takes it back, and a borrower on the return errand who finds nobody to take it leaves it with the house's stores; the recharge duty is kept by the borrower's fae tending urge); item responses `show_item | lend_item | return_item | accept_item` for pending requests (with `itemId`/`terms`); events `social.loan_opened | loan_closed | loan_breached | item_refused`; `social.interaction.itemId?`.
- **provisions/items:** scenario `stocks[].keeper` (a household that keeps a store nobody lives at or works in: it owns the stock and gives ordinary store credit; Iron Ford's town springhouse is kept by the Pratts, Ellie 2026-10-12); `items/iron.ts` `binIron` (Iron Presence at a bin, 03 §3.3; hearth gear excluded), `storageHour(..., hems?)` with the hem set committed by fae; `Readiness.charms?` rows from `fae/forecast.ts`; the planner projects verified hems on its own copy.
- **psyche:** `externalProposals` includes `proposeFaeUrges`; standing capability `tie_the_sack_nightly` (act `tie_charm`).
- **chronicle:** fact class `charm`; pattern `charm` (levels 1–3, closing, `charm.truth`, written again only when the pounds drawn have changed); template slots `charm claim keeper keeper_short source lb resolution lent_to blame`; `when.stage` = `arrived | again | still` (a reopened story has no arrival; under the same keeper it is no news); `ChronicleState.charmMemo?` (per-charm last Truth pounds and last keeper, kept past closed-thread eviction).
- **play:** charm actions, `charms` on the fair observation (`fae.charmView`), fae Command results as `detail`, refused charm Commands roll back at zero cost.
- **fae API and forecast adapters:** `charmView`, `forecastCharms`/`forecastHems` (in `fae/forecast.ts`), `charmKeepWeight`, `charmTransferred`, `grantLook`, `restitutionOwed`, `restitutionMade`, `noteItemInteraction`, `loanTerms`, `tieWindow`; checkShortfall/countStock in `fae/discovery.ts`.

---

## module:play

**Owned paths:** `packages/play/**`; integration coverage in `packages/cli/test/play*.test.ts` (CLI transport remains foundation-owned; web integration remains web-owned).

**Implements:** pure `PlaySession`, source/PC creation, stable actions and validation, fair/god observations and durable known-event/Explain archives, shared interrupts, replay/save/load/fork and telemetry; storefront, trade preview and food-ledger host queries.

**Contract:** CLI and web submit the same core Commands and advance through the same session; queries/settings and refusals cost zero time, other current actions use hourly steps. Shells own IO, storage and wall time; fair observations never expose remote minds or hidden charm truth.

**Acceptance:** ADR 0002; replay each command boundary and saved continuation; web command logs replay headlessly to the same hash. Headless play is done; regional actions await M5.

---

## module:worldgen

**Owned paths:** `packages/worldgen/**`, `packages/cli/test/worldgen*.test.ts`, `packages/cli/test/county.test.ts` and their fixtures. CLI commands remain foundation-owned; authored content and world/scenario schemas remain content-world-owned.

**Implements:** independently versioned town v2 and county v3. Town layers emit ordinary scenario/site/place records and disposable 30-day QA; county layers emit terrain, hydrology, ecology, fae field, named settlements/features and routes with hashes/QA, SVG export and ford-town context.

**Contract:** versioned recipes and independent world/sim seeds reproduce output; `townContent` installs records without mutating the bundle; `countyTownContext` supplies ford-town context, not a region runtime. No generator-specific sim rules or silent seed retries.

**Acceptance:** ADR 0003; town seeds 1–50, county seeds 1–64 in both presets, earlier-layer hash stability and TOML round trips. Census, pre-roll, non-town layouts, county reservoir and playable-county acceptance remain ahead.

---

## module:region (proposed M5 ownership; no runtime yet)

**Proposed owned paths:** `packages/core/src/region/**` for registry, graph, census/LOD and regional weather, per `docs/impl/M5-PLAN.md`. Foundation owns composition/IDs/scoped init/save migrations; needs-activities owns journey execution in `activity/travel*.ts`; content-world owns new region schemas/fixtures.

**Proposed contract:** `region/api.ts` supplies site/graph lookups, processing selections and environment queries; activity alone relocates actors, and existing modules retain their minds, beliefs, stores and fae truth. Register additive contracts before implementation. M5 slice 1 is in progress; census/LOD and county release follow later plan slices.

## M5 slice 1 additive contracts (2026-10-12)

- **region owner:** `core/src/region/**`: optional `World.region`, authored registry, knowledge and geographic location queries. Both fixture populations remain T1. `content-world` owns `schema/region.ts` and the authored fixture.
- **activity:** optional `journeys`, directed leg progress in feet and integer fractional carry, shared interval preparation/commit/finalization, validated travel/stop/resume/turn-back/camp Commands. Only activity relocates actors. Foundation installs site geometry idempotently; fixture population is allocated once before module initialization in canonical scenario order.
- **provisions:** `tripReadiness` projects the same travel itinerary and needs/provisions kernels on a private copy; carried-only road supply and stopped preparation. No changes to credit, relief or charity policy.
- **foundation/play/web:** additive composition hooks before needs and after provisions, filtered region observation, zero-time route queries and offered travel Commands. Existing system order and absent-region state remain unchanged. No T0, census or LOD claim in slice 1.

### module:fae, wave 6: refusal costs (design-docs/00 decisions, 2026-10-12)

A keeper at the attachment cap may refuse, but refusal has costs on both sides (`fae/refusal.ts`).
Contracts (all additive):
- **fae API:**
  - `charmRefused(world, ctx, keeperId, askerId, itemId, how)`;
  - `charmGuilt`, `guiltToward`;
  - `charmCovetPressure(world, actorId, itemId)`, the hook a generic desperation-theft act (module:social, wave 6 relief) can read; theft itself is not built here.
- **`CharmState`:** `guilt?` (per keeper, 0..600, decays about 4% a day, halved by lending to a household turned away) and `refusals?` (per asker: count, last, grudges founded).
- **Event `fae.turned_away`:** inner; an Explain of the guilt formula, knowledge `self`.
- **social:**
  - a failed `beg_loan` (the holder's decision or a failed persuasion) and a commanded keeper's refused or lapsed `lend_item` request both call `charmRefused`;
  - `holderDecision` adds the pro term "Guilt over turning neighbors away" (`guiltToward`).
- **belief content:** predicate `hoards(household, item)` ("…keep it to themselves while others go short", juiciness 60), observed by the refused.
- **Grudges:** three refusals of the same asker found an `apology` grudge; five found a `humiliation` grudge (existing strife lines).
- **social `opinion.ts`:** reason merges fold `-0` (a pre-existing `findNonIntegers` hit, seed 42, day 60).
- **Chronicle:**
  - `fae.turned_away` becomes a hidden `refuse` fact in the charm story (omniscient only);
  - the epilogue writes `charm.refused` (a third refusal of the same asker) and `charm.relented` (the keeper lends at last to a household once turned away), each once;
  - new template slots `asker` and `asker_short`;
  - `PatternDef.entryKeys?`: extra entry keys a pattern writes, which the template-coverage test accepts.

## module:tactical — M6 slice 1 (2026-10-12)

**Owner:** `core/src/tactical/**`, `content/base/scenarios/tavern_instant.toml`,
`cli/test/tactical.test.ts`. Foundation owns `sim/{clock,heap,advance}.ts` and composition;
activity owns `activity/tactical.ts` positions/suspension; needs and provisions own interval
settlement; psyche owns `psyche/tactical.ts` entry reactions. Play/web retain their shells.

**Additive contracts:** optional `World.tenth` and versioned `World.tactical`; integer instant
`time * TICKS_PER_MINUTE + tenth`, with resolution in `sim/clock.ts`. Saved heap orders
`(instant, actorId, seq)`; tokens, authorization basis, recovery deadlines, reservations,
interrupt latch and hour-frame cursors survive saves. `advanceUntil` stops after an atomic
instant using the host's shared, perception-filtered interrupt callback. Legacy `step` uses
its unchanged hourly path when no scene occurs. Format-1 absent-state saves remain valid.

`activity.api` alone installs/moves authoritative five-foot grid positions (site, level 0,
x, y); the authored place footprint supplies walkable cells in this slice. Tactical
participants suspend ordinary action executors; needs uses the same hourly ledger with
integer elapsed carries; provisions settles carried-device time through its API. Hour-frame
rates are written by needs at preparation and consumed through `needs.api`; supply carries
remain provisions-owned. `psyche.api.tacticalReaction` proposes one authorized guard at
entry. Commands `tactical.move/guard/cancel/advance/breathe` are shared by both shells.
Scenario `tactical_scene` is opt-in content; no ordinary social fight replacement yet.

**Acceptance:** scripted danger/worker parity, heap/boundary/reservation properties,
mid-action/midnight persistence, replay, commanded and revoked agency; `just check` and
unchanged legacy hashes with pinned content. Damage, hostile AI, perception geometry,
weapons, law and fae harm permission remain later slices.

M6 slice 1 frame phases: preparation installs saved journey intervals, thermal/rest/exertion
rates and psyche intentions. Closing runs the remaining hourly systems in module order
once; the accounting calendar/RNG keys refer to the elapsed interval, while emitted event
stamps refer to the actual closing boundary. Sparse need-meter and carried-device unit
deadlines make alert instants independent of query subdivision. The activity ownership
query also excludes former participants during settlement of their partial scene hour.
Implementation, 30-day legacy proof and fair play reports: `M6-SLICE1.md`.

### M6 slice 2 — brawls (2026-10-13)

The tactical owner extends `core/src/tactical/**` rather than creating a second combat
clock/module. Combat tuning is owned in `content/src/schema/combat.ts` and `content/base/combat/**`;
fixtures are `tavern_instant` and `tavern_brawl`, with acceptance in `cli/test/brawl.test.ts`.
`Action` adds melee, grapple/escape, yield/accept, parley, reachable flee, stabilization and
bounded reaction orders. Optional saved brawl episodes deduplicate the social handoff by
scene/pair. Explicit commands authorize one action (or the cells of one flee route);
no commanded retaliation is implied. Commitment revalidates the saved issuer.

Condition owners: tactical owns Grabbed/Held/Pinned and existing Unready; psyche owns
source-specific `combat_shaken`; needs owns `combat_unconscious`, Dying, Spent and Staggered.
`needs.api.applyHit/healthOf/stabilize/advanceCombatHealth/nextCombatHealthInstant` keep combat
health separate from deprivation wounds. Foundation's sparse clock consults injury deadlines
without re-running hourly systems. `die` remains the sole death path. Located/Blood/bleeding
and material treatment remain slice 3. `activity.api.leaveTactical` commits a paid crossing
of an authored door; no coordinate/actor place writes occur in the tactical owner.

`psyche.api.brawlFear/brawlIntent/endBrawlFear` owns transition-deduplicated morale and NPC
choices. `social.api.recordCombatOutcome` owns durable incidents, memories, opinions and
one `noteStrife` stamp per pair/scene. `chronicle.api.recordFight` persists the witnessed
summary synchronously. Play supplies fair menu/parser/interrupt additions; the existing web
TacticalTimeline renders these same actions. Replay rules version 3 identifies the reviewed
behavior; version-1 and version-2 journals are explicitly rejected. Noncombat snapshots remain additive.
See `M6-SLICE2.md` for the outcome distribution, fair transcripts and exact file inventory.


M6 slice 2 review adds `World.backgroundTactical`: Breathe removes active tactical state while
retaining the open clock frame and any remote brawl deadlines. The shared advancement driver
restores this state only while executing, then parks it again; saves remain plain data.
Needs owns Stable's `wakeAt` deadline and hourly recovery outside scenes. Fear trigger retention
ends with each episode; social retains at most 256 incidents, with per-scene episode stamp flags
preserving pair deduplication beyond archive eviction.

## module:director — D0 measurement (2026-10-13)

**Owner: director.** `packages/core/src/director/**`, `packages/content/src/schema/director.ts`,
`content/base/director/**`, `packages/cli/test/director.test.ts`, `docs/impl/director/**`.
Foundation composition is granted for D0. Runs hourly after chronicle, assesses daily.
Chronicle retains pattern definitions and owns optional `PatternDef.openState` projections;
its engine passes projections through `director.api.recordProjection` without changing prose.
Needs, belief, social, provisions, region and tactical expose additive read-only tension APIs.
Social owns the shared fair event perception query (play delegates to it).

**Contracts:** optional version-1 `World.director` (legacy saves migrate on restore),
`director.personality = land_itself`, `director.foresight = off | tiltable | full` (default tiltable).
Director events have slice-local IDs; only the latest tension Explain is retained, and none enter the causal
simulation log. This is necessary for exact non-director state/event-ID invariance.
Ledger retains seven compact daily assessments; older rows compact to a count and monthly metrics.
Survival is sampled daily and held; other tension terms remain hourly. The registry caps total
threads at 64 (24 Latent), guns at eight per thread, and retires settled records after seven days.
Retention counters distinguish capacity removal from story endings; see `director/D0-MEASUREMENT.md`.
No bias hooks, RNG draws, LOD pins, agency changes, or writes to other slices in D0.
God observations and CLI manifests expose analytics; fair observations expose nothing new.

**Acceptance:** `just check`; unchanged Iron Ford golden; stripped-world hashes against
pre-D0 at Iron Ford 42 (30/365d), generated towns 7/19 (90d), neighbors 42 (30d);
year-run baseline for Iron Ford and generated towns 7/19, measured Director ms/hour.

### M5 slice 2f — dormant settlement ownership (2026-10-13)

Region adds optional saved `dormant` policy/cursors/facts, `T3`, a `dormant`
processing bucket, `configureDormancy`, `settleDormantSites`, `wakeDormantSite`
and perspective-gated `dormantNews`. T2 keeps its 2e hourly decision kernel.
The existing 2d owner filters also exclude dormant sites. Only region chooses owners.

Owner APIs provide elapsed memory/opinion/thought/need upkeep; real pantry
preparation/spoilage, exceptional famine survival, existing debt settlement, local
routine placement and scheduled productive yields. Items lends independent sites
temporary inventory tables, reconciled after an aggregate pass; these are not saved.
Foundation's scoped population hook installs a persistent child without reseeding
any existing sheet or inventory; birth IDs occupy a separate deterministic band.
Region facts and hydration receipts outlive the event-log window. No player-only
rules, legacy-world policy fields, or statistical T2 executor are introduced.
