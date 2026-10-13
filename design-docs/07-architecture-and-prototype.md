# Coulee: Architecture & Prototype Plan

**Status:** Rewritten 2026-10-10 to match `adr/0001-typescript-stack.md`, replacing the earlier Rust + Godot version. `00` wins on design, and the ADR wins on stack, invariants, and the clock. `02`–`06` and `10`–`12` own the game rules. `11` owns the interfaces, client budgets, reference devices, and World-size presets. This doc owns the *machinery*: the core contract, determinism and integer math, LOD and census, saves and the worker protocol, the content pipeline, the harness, testing, and milestones.

**Revision 2026-10-11:** Added ADR 0002 PlaySession contracts and milestone playtest gates, ADR 0003 M5a worldgen scope, and current town-slice integration status on `wip/worldgen`.

**Tags:** **[DECISION]** comes from `00`, the ADR, Ellie, or a lead ownership call. **[PROPOSAL]** is mine and can be overridden. **[OPEN]** needs Ellie. **Implementation notes** compare this doc with the code being written in `packages/` today. **The doc is the design target**, so a listed divergence is a question for the next pass, not a silent change to either side.

**Resolves or advances:** C1, C2 (sim side), C9 (with `11`), C21, C36/C37 (implement `04`), C39, C40 (mechanism), C49, and gap 18.

---

## 0. TL;DR

- **[DECISION] Stack (ADR):** TypeScript strict ESM in pnpm workspaces.
  - `packages/core` is the pure deterministic sim.
  - `packages/content` turns TOML into a zod-validated JSON bundle.
  - `packages/cli` is the headless `coulee` harness.
  - `packages/play` defines the shared, IO-free `PlaySession` for fair/god observations, interrupts, replay/save/fork, and telemetry (ADR 0002; built).
  - `packages/worldgen` is the pure deterministic layered generator, emitting authored-scenario shapes (ADR 0003; town v2 and county stage v3 built).
  - `apps/web` is a Vite + React + three.js **PWA**, with the sim in a **Web Worker**.
  - Vitest + fast-check for tests; Biome plus `scripts/check-invariants.ts` for lint.
  - Capacitor and Tauri come later.
- **[DECISION] Same seed + same commands ⇒ the same event log and state hash on V8 and JavaScriptCore.** We get there by banning transcendental `Math` in core and restating every `exp`/`log`/`pow`/`sigmoid` in `04`/`05` as **committed integer lookup tables plus fixed-point helpers** (§4). We verify it by running the harness under Node (V8), Bun (JSC), and Playwright WebKit and comparing hashes.
- **[PROPOSAL] T0 clock (C21):** the canonical clock stays integer game-minutes. A live site adds a **sub-minute clock of game-seconds within the current minute, at tenth-second resolution (0–599)**, which `02`'s 0.1 s initiative steps need. T0 is **event-driven**: actions and path segments schedule their own completions in a total-ordered queue, so cost scales with events, not actors × seconds (§3.4).
- **[DECISION, with `11`] Scale is a World setting** (Small / Standard / Large), recorded in the World and identical on every device. Phones run the same sim *slower* through a speed governor. They never run a coarser sim (§6).
- **[DECISION] Census materialization (`00`):** named actors have full sheets and minds. Everyone else lives in household census records and is materialized deterministically, with a time-independent identity, on first relevance (§5.3).
- **[PROPOSAL, aligned with `11` §4.3] A save is a snapshot plus a command journal,** stored in OPFS from the worker with an IndexedDB index. The World never crosses the worker boundary. Positions travel as transferable typed arrays, and panels get small view models and query results (§7).
- **Today (2026-10-12):** M0 and the M1–M3 town slice are integrated; headless/web PlaySession and survival are done. M4 P8 systems and storefront/Kit Sheet are built; winter relief (#3) is in progress. M5a town v2 and county stage v3 are done; census, pre-roll and non-town layouts remain ahead. M5 has a written plan (`docs/impl/M5-PLAN.md`), with slice 1 in progress. Doc 13 fae 1a/1b are implemented; spread/rota/performance gates remain partial and refusal costs are in progress. Full milestone, engine/device and M6–M8 gates remain ahead. **[DECISION]** marks canon; plan recommendations remain **[PROPOSAL]** unless explicitly decided.

---

## 1. What the project demands

In priority order:
1. **An off-screen social sim plus a psyche** (P2, P3, P7). This is the novel risk.
2. **Determinism across engines:** JSC on iPhones and on Tauri/Linux, V8 elsewhere. Share-a-seed, golden chronicles, journal saves, and bug repro all depend on it.
3. **Phones as a full target** (P6).
4. **P8 crunch:** many stacks with spoilage state, and pantries across the county.
5. **Data-driven content.**
6. **Dense UI** (`11`).
7. **Low-poly 3D.**
8. **AI-codability.**

Items 1, 2, 4, and 5 need no renderer. That's why the core is headless and the harness comes first.

---

## 2. Stack and process model

### 2.1 Stack (ADR)

| Concern | Choice |
|---|---|
| Language | TS `strict`, ESM, erasable syntax only (`tsconfig.base.json`: ES2024, `erasableSyntaxOnly`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) |
| Dev runtime | Node 26 + `tsx`. The harness writes `run.sqlite` with built-in `node:sqlite` |
| Content | TOML (`smol-toml`) → zod 4 → JSON bundle |
| Tests / lint | Vitest, fast-check, file snapshots / Biome + invariant checker |
| Web | Vite, React, three.js via `@react-three/fiber`, zustand for view-model stores, `vite-plugin-pwa` |
| Assets | Blender 5.2 headless scripts → `.glb`, palette vertex colors (budgets in `11` §5.5) |
| Tasks | `just`. `just check` is the one "am I done" command |

### 2.2 Process model

```
Main thread (apps/web): React overlay (pocket/desk/folio, 11) + three.js canvas
   │  Commands, queries, view requests ▼        ▲ positions (transferable), VMs ≤10 Hz, events, query results
Sim worker: shell (run loop, speed governor, slicing, OPFS/IDB I/O, gzip)
   └── @coulee/core (pure) + frozen content bundle
Node: packages/cli uses core for runs and packages/play PlaySession for playable REPL/JSONL (ADR 0002); sweeps fan out over worker_threads
Prose provider (optional): main thread or its own worker, never core
```

**[DECISION] Core purity:** `packages/core/src` has no DOM, no Node APIs, no IO, no wall clock, no timers, no `Math.random`, and no async. Its tsconfig gives it only `lib: ES2024` and `types: []`, so touching `window` or `process` is a compile error. Everything impure lives in the worker shell (`apps/web/src/worker/`) or in `packages/cli`.

### 2.3 Alternatives considered

The previous `07` recommended a Rust core with a Godot 4 shell (via gdext) and listed all-TypeScript as runner-up. **`adr/0001` adopted the runner-up** for phone play, browser shareability, and UI fluency. It accepts a lower performance ceiling and pays for cross-engine determinism with discipline. The core contract is narrow and plain-data, so one hot system (say, T2 diffusion) could move to WASM behind the same signature if a benchmark ever demands it. That's not planned. The ADR is the decision record.

---

## 3. Core architecture

### 3.1 Contract

**[DECISION]** The shell never mutates world state. Systems are `(world, ctx) => void` functions run in a fixed order. The event log is append-only, and every check or arbitration yields an `Explain`.

**[PROPOSAL]** Public surface (names indicative):

```ts
createSim(bundle, scenario, seed): Sim;   loadSim(bundle, snapshot, journal): Sim;
sim.enqueue(cmd: Command): void            // applied at the next step boundary, logged as 'core.command'
sim.advance(limit: { tenths } | { minutes }): AdvanceResult  // stops early on interrupts (hostility, arrival, alert)
sim.query<K>(kind: K, args, viewer): QueryResult[K]          // pure, knowledge-gated, returns Explain (11 §1.7)
sim.view<K>(kind: K, args, viewer): ViewModel[K]             // dossier, catalog page, ledger rows...
sim.drainEvents(sinceSeq): EventRecord[];  snapshot(world): Snapshot;  hashValue(world): string
```

- **Commands are the only input,** and they enter psyche arbitration as `voice: 'command'` proposals (`core/src/urge.ts`). That's P2 made literal: the player's will is one more urge, and the rules can still interfere.
- **A command is stamped with the sim instant at which it's applied,** not the wall-clock time of the tap. UI latency can't affect determinism, and replays are **speed-independent**: one journal reproduces identically at 1× or 6×.
- **`query` and `view` are where P1 gating lives.** They're computed for a `Viewer` (the PC, the post-run epilogue, or a debug god-view), so hidden truth never leaves core in normal play. The CLI's `inspect --as <actor>` calls the same functions.

### 3.2 Module slices, not an ECS

**[PROPOSAL, adopted by the code]** The data is relational and sparse (opinion edges, beliefs, lineages, households, debts), and P2 makes actors uniform. So the World is one plain object of integer-keyed tables plus **per-module slices** (`needs`, `activity`, `psyche`, `social`, `belief`, `items`, `provisions`, `chronicle`, ...). Each module writes only its own slice and calls other modules through their `api.ts`. Event kinds and command kinds use a registry pattern (`'<module>.<kind>'`), so parallel agents never edit one shared file.

TS performance rules:
- **Stable object shapes.** A factory initializes every field. Never `delete` a field or add one later.
- **No per-step allocation in hot loops.** Scratch arrays live in the system context.
- **Sparse sorted arrays for opinions, and venue buckets for encounters.** No dense matrices and no all-pairs scans.

### 3.3 Data model (semantics belong to the owning docs)

- **`ActorCore`** (exists): id, key, name, sex, `born`, **`ancestryId` (ground-truth people) and `presentsAsId`**, occupation, household, place, traits, a minimal `Sheet` (`02`), `controller: 'ai' | 'player'` (never used to pick a rule path), and `alive`.
- **Mind** is a logical grouping spread across slices:
  - needs, 0–1000 (`04`/`10` own the list, C38)
  - psyche: `egoStrength`, `superegoStrictness`, `idAppetite` (0–100), anxiety (0–1000), thoughts voiced by Id or Superego, Persona and Shadow (`10`)
  - memories, opinions, grudges, Figures, notoriety (`04`)
  - beliefs over interned props with credence 0–100 (`04` §5)
- **Opinions follow `04` §6 (C36):** affection, respect, and trust run −100..100, fear runs 0..100. Every change carries a Reason. **Obligation** is a ledger, and grudges are first-class rows.
- **Norms:** per the lead call, `04`'s Values become **superego content (internalized norms)**. `12` adds a separate `culture` axis that supplies most of them.
- **Peoples:** content only. Sim logic never branches on a people id. Discovery runs on `04` beliefs (`Is(x, people)`). `12` §7.1 models passing as one identity with a concealed attribute plus a Persona-level `presents_as`.
- **Households** own a pantry, an inventory in `03`'s item model (C48). `12` §8.6 adds **institutional inventories** (a miners' club pantry), which use the same model.
- **Places:** settlements, sites, buildings, and camps, keyed by `PlaceId`. Region edges count as places for actors in transit (`05` §3.4).

**Implementation notes (20:50).**
- **`ActorCore` stores `values: Values` (04's nine bipolar Values, −3..+3) as a personality block, with traits shifting them.** That diverges from the lead call (Values → superego norms) unless `10` argues for keeping a temperament block. Flag for `10`/`04`.
- **`presentsAsId` lives on `ActorCore`; `12` §7.1 puts `presents_as` in the Persona.** Either works if views read it through one accessor.
- **`content/base/peoples/peoples.toml` contains placeholder mechanics Ellie hasn't decided:** goblin `size = "small"` and 25 ft speed, elf maturity at 30 with a 300-year lifespan, and shadow-faekin `cold_iron_sensitive`. The schema says "placeholder until 12 lands". `12` now exists, and its proposals should replace these, flagged as proposals.

### 3.4 Time, speeds, and the T0 sub-minute clock (C21)

**[DECISION] (ADR):**
- Canonical time is integer game-minutes since 1855-04-01 00:00 local solar time.
- T1 steps hourly. T2 steps daily, with 6-hour sub-steps.
- At 1×, a game-hour takes about 40 real seconds. `11` §1.6's speed ladder (Tactical ½, Tactical, 1×, 3×, 6×, Ultra) supersedes `05` §4.1.

**[PROPOSAL] T0 clock** (this answers `11`'s "seconds or deciseconds?"):

```ts
interface Clock { minute: GameMinute; tenth: number }   // tenth: 0..599, meaningful only while a site is live
type T0Instant = number;                                  // minute*600 + tenth; safe for millions of game-years; no bitwise ops
```

- **Units:** `02` §7 maps onto tenths with no floats.
  - Swift action: 5 tenths.
  - Standard action: 30 tenths (18 windup, 12 recovery).
  - Full-round action: 60 tenths.
  - First-action delay: `max(3, 30 − initiative)` tenths.
  - Reloads: 120–400 tenths.
  - `11`'s strip shows whole seconds (`4:10:23p`).
- **Event-driven T0** (per `11` §5.4). The live site has one **min-heap keyed `(instant, actorId, seq)`**. That's a total order, so two completions on the same tenth always resolve the same way. Entries are:
  - action phase ends (windup → effect → recovery)
  - **path-segment ends**: movement is analytic along straight segments split at corners, with integer interpolation of position (tile coordinates in Q8), and a tile reservation taken when a segment starts
  - staggered perception scans (every 5 game-s when calm, 1 s when hostile, offset by actor id)
  - sound and sight emissions from events
- **Needs and other per-minute systems run at minute rollover.** The T1 hour runs at :00, and the T2 steps at 00:00 and every 6 hours.
- **Order within an instant:** apply commands → pop the due heap entries in key order → event subscribers.
- **Positions are queries.** "Where is X at instant i?" is a pure function of X's current segment. The renderer gets positions sampled at frame times (§7.3), never a per-second sim loop.
- **Speed only changes how many tenths the worker advances per real second.** If the worker can't keep up, `11`'s speed governor lowers *effective* speed (`▶6×→4×`). The step structure never coarsens.
- **Sleep, Wait, and Ultra.** The `Wait`/`Sleep` command **deterministically demotes the live site to T1** for its duration: every actor's job queue is summarized to an Activity (§5.2), and the site is re-promoted on wake or interrupt. This is what makes `11`'s "Sleep 8 h in ≤ 5 s" reachable on a phone. Because a command triggers it, not the speed setting, it stays replay-identical.
- **Combat:** `11` proposes auto-Tactical (1 game-second per real second) when hostility begins, followed by a pause to plan. The sim supports that through an `interrupt` (hostility perceived by the PC). **[OPEN] C21(b)** is Ellie's call, and I support `11`'s default.
- **RNG at T0:** draws inside a minute must use `tick = T0Instant`, or include the instant and heap `seq` in the key. Otherwise two attacks by one actor in the same game-minute roll identical d20s.

**Implementation notes.** `time.ts` is integer-only. `World.time` is "start of the next hour" and `SimContext` is built per hour, which is right for M1. T0 will need a `tenth` field and a per-instant context. `rng(…, tick, …)` currently receives the minute.

### 3.5 The event log as backbone (C39)

**[PROPOSAL]** State is authoritative and snapshotted. The log is the authoritative *history*, and every story system subscribes to it. One event shape, merging `05` §9.1's fields with what the code has:

| Field | Notes |
|---|---|
| `id`, `seq`, `t`, `tenth?` | `tenth` only for T0-originated events |
| `kind`, `data` | namespaced registry kinds; integer payloads |
| `roles[]` | `{ actor, role }` (agent, patient, witness, victim, speaker, ...). **Must also accept `CensusRef`** (§5.3) |
| `place`, `edge?`, `tier` | `tier` = fidelity of origin |
| `visibility` | `public / witnessed / private / secret / inner` (the code's set; `inner` is for mind events) |
| `importance` | **0–1000** (`11` §8 asks for it) |
| `causes[]` | explicit causal links, for sifting |
| `explain?` | P1 |
| `directorNudge?` | links to the Director's Ledger (`05`) |

**Subscribers, in fixed order:**
1. Perception → memories (`04` §4)
2. Psyche → thoughts, anxiety, defense events (`10`)
3. Opinion → reasons, grudges (`04` §6)
4. Rumor seeding → variants with lineage (`04` §8)
5. **Persecution** → Heat/Consensus and rungs 0–6 per target. `04` §9 owns this. `05`'s alert levels cover only non-person threats, and `06`'s witch labels map onto the rungs (C41).
6. Notoriety
7. Director → nudges that go through the rules and may only voice facts some carrier knows (C43)
8. Chronicle (`05` §11)

**Retention:**
- T0 micro-events roll up into one "Fight" or "Work" event at demotion.
- Low-importance, unreferenced events are pruned after 30 game-days.
- The log is chunked into immutable **4,096-event segments**. Sealed segments are written once and paged in on demand.

**Implementation notes.**
- **`importance` is 0..100 in `events/base.ts`.** Recommend 0–1000 to match `11`'s alert score.
- **`EventRole.actor` is `ActorId` only**, so it needs `CensusRef` support before M2.5.
- **`tier`, `tenth`, and `directorNudge` are absent.** Fine until M2.5, M6, and M7 respectively.
- **Commands are logged as `core.command` events,** so the save journal (§7.1) is a filtered view of the log. Good.

### 3.6 Items, provisions, pantries (P8, C48)

**[DECISION] (lead call):**
- `03` owns food and consumable item fields.
- `05` owns burn rates and the effects of hunger and nutrition.
- Pantries are household inventories in `03`'s item model.

**[PROPOSAL] Representation:**
- **Instances vs. stacks.** An instance exists only when something individuates it (wear, provenance, an enchantment, a curse). Fungible goods are stacks: `{ def, qty, container, spoil, wet, lot }`.
  - `spoil` is an integer accumulator compared against shelf life × band and packaging multipliers.
  - `lot` separates purchases so "what spoils first" is answerable.
- **Units are integers:** grams, cents, kcal, ml, minutes, and per-cent multipliers.
- **Spoilage is table-driven, never a continuous decay.** Each 6-hour sub-step (or on read, for stacks in stable storage) adds `rate × tempBandPct × wetPct × packagingPct / 10⁶`, using integer per-cent products with an integer carry. `11` §8 asks `05` for exactly these band tables.
- **Lazy where possible.** A cellar stack advances in closed form from `(lastTouched, storage band)`. Only exposed stacks (packs, camps, open barrels) step every 6 hours.
- **Census households have pantries too,** so a hard winter empties real pantries, not a statistic.
- **Forecast = outcome.** The provisions planner and Readiness (`11` §2.8) call the same functions the sim uses. They can disagree only through weather and events the forecast couldn't know, and the forecast shows those as ranges.

**Implementation notes.**
- **`schema/items.ts` already implements a rich P8 model.** It has integer `weight_g`/`value_cents`, `food { kcal, protein_g, fat_g, fresh, group, servings, shelf_life_days, spoilage { temperature_pct by band, wet_pct, packaging_pct, spoils_to, vermin }, prep[] { method, minutes, fire_minutes, batch_servings, cookware, water_ml, kcal_pct, check } }`, `supply` and `consumes` for fuel, oil, caps, and powder, and pantry, inventory, and store-stock seeds.
- **That matches this plan, and `03` should ratify it as the field list.**
- **Divergence: `bulk` and `affordances` are one-decimal floats (`decimal1`).** The compiler should convert them to integer tenths before they enter World state (invariant 2).
- **`needs.toml` hunger is still an abstract `decay_per_hour`.** Fine for M1. M4 replaces it with kcal burn (`05`).

---

## 4. Cross-engine determinism and the integer math kit (C1, C49)

### 4.1 Why the ban, precisely

- **IEEE-754 requires correct rounding for `+ − × ÷` and `sqrt`,** so every engine agrees bit-for-bit on them.
- **ECMAScript leaves `Math.exp`, `log`, `pow`, `sin`/`cos`/`tan`, `atan2`, `hypot`, `cbrt`, and friends implementation-approximated.** V8 and JavaScriptCore can differ in the last bit. One last-bit difference that crosses a `floor`, a threshold, or a DC forks the run forever.
- **The `**` operator has `pow` semantics and is banned.** Integer powers go through `ipow`.

Other traps the checker covers:
- Locale-dependent APIs (`localeCompare`, `Intl`, `toLocale*`).
- Comparator-less `sort()`, which stringifies numbers.
- `for...in` and history-dependent key order.
- Async and GC-observable APIs.
- Negative rounding and `%`: use `floorDiv`/`mod`.

### 4.2 Conventions

- **Stored state is integer** at the ADR's scales. **[PROPOSAL]** additions: salience, juiciness, and importance 0–1000; weights in grams; bulk in tenths.
- **Transient fixed-point:** **Q8** (×256) for logit-space values and weights, **Q16** (×65,536) for fractions and decay factors.
  - Products are exact integer products kept under 2^53, then `floorDiv`.
  - For integer operands under 2^53, `Math.floor(a / b)` is both exact and engine-identical.
- **Probabilities are per-mille at the roll site** (`rng.chancePermille`).
- **Tables are generated offline and committed as integer literals.** `scripts/gen-fixed-tables.ts` runs in Node and may use `Math.exp`. Its output, `core/src/fixed/tables.gen.ts`, carries a checksum, and a Node-only Vitest test regenerates the tables and fails on diff. **Core never computes a table at startup**, because that computation could differ by one unit on JSC.
- **The content compiler is under the same ban,** since mods may be compiled on a phone. Derived constants use basic arithmetic only.
- **The renderer is exempt.** `apps/web` can use any `Math`, because nothing it computes flows back into the sim.

### 4.3 Restated formulas

**(1) Exponential decay:** memory salience (`04` §4.3), grudges (`04` §6.3), traces (`05` §3.6), and EMAs (`05` §8).

The table is `EXP_NEG_Q16[i] = round(65536·e^(−i/256))` for `i = 0..4096` (x from 0 to 16). Lookup with linear interpolation (dt and τ in minutes):

```ts
function decayQ16(dt: number, tau: number): number {
  const num = dt * 256, i = floorDiv(num, tau);
  if (i >= 4096) return 0;
  const fracQ8 = floorDiv((num - i * tau) * 256, tau);
  const a = EXP_NEG_Q16[i], b = EXP_NEG_Q16[i + 1];
  return a - floorDiv((a - b) * fracQ8, 256);
}
```

- **Error:** under 2 Q16 units absolute (the interpolation error is ≤ h²/8 with h = 1/256).
- **Salience is lazy.** A memory stores `s0` (0–1000) and `tRef`. On read, `s = max(floorFor(kind), floorDiv(s0 * decayQ16(now − tRef, τ), 65536))`. Rehearsal sets `s0 = min(1000, s + 200)` and `tRef = now`. There's no daily decay pass, which is a large saving at T2.
- **`04`'s τ in integers** (intensity I in 0–100, Rancor R in −3..+3, Neighborliness N):
  - negative memories: `τ = floorDiv(τKind*(50+I)*(4+R), 200)`
  - positive memories: `τ = floorDiv(τKind*(50+I)*(20+3N), 1000)`
- **Grudge drift:** "−(1/τ_grudge)/day" is read as exponential with τ = 60 d × (1 + Rancor), in the same lazy form. If C12 picks the no-decay floor for uncanny grudges, that's a data flag.
- **EMA with a fixed step Δ:** `αQ16 = 65536 − decayQ16(Δ, τ)`, computed once by lookup. Each step does `e += floorDiv((x − e)·αQ16, 65536)`.

**(2) Log-odds credence** (`04` §5.3).

The table is `LOGIT_Q8[c] = round(256·ln(c/(100−c)))` for c = 1..99 (monotone, ±1176).

Weights in Q8:
- **Base:** Observation 640, Physical 384, Document 256, Statement 205, Overheard 154.
- **Trust:** maps −100..100 onto 0.2..1.5 as `51 + floorDiv((T+100)*333, 200)`.
- **Novelty** (k = 0.5): `floorDiv(512, 2 + shared)`.
- **Plausibility:** built from `04`'s terms the same way.
- **Combined:** `w = mulQ8(mulQ8(mulQ8(base, trust), plaus), novelty)`, and `Δ = ±w`.

The update:

```ts
const L = LOGIT_Q8[clamp(c, 1, 99)] + carry + sumDelta;
const c2 = nearestIndex(LOGIT_Q8, clamp(L, LOGIT_Q8[1], LOGIT_Q8[99])); // binary search; ties → lower
const carry2 = clamp(L - LOGIT_Q8[c2], -127, 127);
```

- **Check against `04`'s example:** c = 44 gives L = −62. A Statement at trust ≈ 1.2 with plausibility 0.6 gives w = 147, so L = 85 and **c = 58**, matching `04`'s 0.58.
- **Carry [PROPOSAL]:** near the extremes, one credence point spans about 60 Q8 units, so a weak echo (about 10) would vanish. An int8 `carry` per belief keeps the residual while credence stays 0–100 per the ADR. The alternative is storing logit-Q8, which would be an ADR amendment. **[OPEN]**
- **0 and 100** are reserved for certainty states that `04` defines. The logit path never produces them.

**(3) Sigmoid:** telling a rumor (`04` §8.3).

- The table is `SIG_PERMILLE[i] = round(1000/(1+e^(−(i−128)/16)))` for i = 0..256 (x from −8 to 8).
- Index with `i = 128 + floorDiv(xQ8, 16)`, clamped, with interpolation.
- `p_tell = SIG(scoreQ8 − 128)`, then `chancePermille`.
- **Error:** under 0.2‰ with interpolation (up to 16‰ without).

**(4) Logistic growth:** ecology stocks (`05` §5.1).

Never use the closed form, which needs `exp`. Step it discretely each day. The compiler stores `rDayQ24 = floorDiv(round(r·2^24), 365)`.

```ts
acc += floorDiv(rDayQ24 * N, K) * (K - N);   // < 2^53 for K up to ~1e9
N   += floorDiv(acc, 1 << 24);  acc = mod(acc, 1 << 24);
```

- **The per-stock carry `acc` lets small populations grow.** A 6-wolf pack gains about 0.003 a day.
- Daily Euler error at r ≤ 0.5/yr is well under the parameter uncertainty in `05`'s table.

**(5) Compound probability**, `1 − (1−p)^k` (disease contacts, repeated exposure).

- `ipowQ16(65536 − pQ16, k)` by square-and-multiply with `mulQ16`.

**(6) Wind chill** (`05` §6.3).

- The NWS formula has a V^0.16 term. Ship an offline-generated 2-D table `WINDCHILL_F[T][v]` for T = −60..50 °F and v = 0..60 mph: 6,771 int8 entries.

**(7) Normal-ish draws.**

- No Box–Muller (it needs `log`, `cos`, and `sqrt`). Use Irwin–Hall sums of 4 uniform ints, `3d6`-shaped sums, or content-authored categorical tables (census age pyramids).

**(8) Geometry.**

- `Math.sqrt` is allowed, but squared distances are preferred.
- `hypot` and `atan2` are banned. T0 facing is 8 or 16 integer directions.

**(9) Variance envelopes.**

- `05` N1's ±1σ is `Math.sqrt(n·p·(1−p))` on integers, which is allowed.

**Escape hatch [PROPOSAL].** If a smooth transcendental is ever truly needed, add `core/src/fixed/softmath.ts`: range reduction plus a fixed polynomial over basic operations. It's deterministic by construction, needs review and a cross-engine test, and is not the default.

### 4.4 RNG and state hash

- **[DECISION]** `rng(seed, stream, tick, key)` is pure and hash-mixed. Streams are a closed union. Keys come from the entities a decision is about.
- **`shuffleByKey`** makes a candidate ordering depend only on the set of keys, not on construction order.
- **Uniform ints use rejection sampling,** never float scaling.
- **The state hash** canonically serializes the World (sorted keys) into two 32-bit `imul` lanes.
- **`coulee diff --bisect`** compares per-day hashes, then per-minute hashes, to find the first divergence.

### 4.5 Enforcement

**[PROPOSAL]** `scripts/check-invariants.ts` is an AST scan of `packages/core/src` and the derivation code in `packages/content/src`. It bans:
- `Math.random`
- any `Math.*` outside the allowlist: `abs floor ceil round trunc sign min max sqrt imul clz32 fround`
- `**`
- `Date`, `performance`, timers, `queueMicrotask`, `crypto`, `Intl`, `localeCompare`, `toLocale*`
- comparator-less `sort()`
- `for...in`
- `async`/`await`/`Promise`, `WeakRef`, `FinalizationRegistry`
- `enum`/`namespace`
- imports from outside core except `@coulee/content` types

Biome's `noRestrictedGlobals` catches globals cheaply. The member and operator bans need the AST pass. The **runtime integer audit** (`findNonIntegers`, which already exists in `hash.ts`) runs after every simulated day in tests and in `coulee run --check-state`.

**Implementation notes.**
- **`rng.ts` matches the ADR exactly:** lowbias32 mixing, rejection-sampled `int`, `chancePermille`, `shuffleByKey`, `fork`, and a closed `STREAMS` list that includes `census`, `psyche`, `provisions`, `spoilage`, and `cooking`.
  - `12` §7.2 names a `peoples_tell` stream that isn't in the list yet.
  - The header cites "07 §3.6"; that's now §4.4.
- **`hash.ts` sorts keys with a comparator-less `Object.keys(o).sort()`.** On strings that's deterministic, but the ban as written would flag it. Either exempt string-typed arrays or pass an explicit code-unit comparator. I prefer the comparator, because the rule stays simple.
- **The repo pins `typescript ^7.0.2`, the native-compiler line.** Confirm that a usable programmatic AST API exists before building the checker on it. `@babel/parser` (already in the lockfile) or a Biome GritQL plugin are the fallbacks.

---

## 5. LOD tiers and census materialization

### 5.1 Tiers

**[DECISION] (`00`)** T0 is the live site. T1 is nearby or relevant actors, running hourly activities. T2 is distant: daily aggregates plus coarse, lazily updated per-actor minds. Relevance raises tier.

**Ownership (C40):** `05` owns tier *policy* (radius, relevance, pinning), `04` owns social hydration, and this doc owns the *mechanism*.

| Tier | Update method | Scheduler | Writes |
|---|---|---|---|
| T0 | timed actions, analytic movement, staggered perception, per-minute needs | the T0 heap (§3.4) | everything |
| T1 | `Activity { kind, place, start, end, partners }`. At its end: resolve with real Sheet modifiers, run Ego arbitration for the next urge, roll co-located interactions from venue buckets | activity-end heap, drained at hour boundaries | needs, memories, thoughts, opinions, inventory, events |
| T2 | named minds daily (`04` §13 caps); compartment diffusion (`04` §11); settlement economy; pantries and weather on 6-hour sub-steps | staggered by settlement hour | aggregates, prevalence, **pending deltas** |

- `tier(actor) = max(locationTier, relevanceTier)`, recomputed hourly, with hysteresis.
- Pinned actors (companions, pursuers, grudge-holders acting on the PC, Director threads) never drop below T1.
- **Tier caps and radii are the same on every device** (`11` §5.1).

### 5.2 Promotion and demotion

- **T2 → T1 catch-up.** Apply the actor's pending deltas in order, each resolved with RNG keyed on `(actor, subject)`, so the result doesn't depend on when promotion happens. "Settlement prevalence of R is 600‰" becomes, for this actor, either a Told memory with a source drawn from their ties, or nothing. Backfill is capped at 48 h (`05` §2.3).
- **T1 → T0 materialize.** Each Activity becomes a position plus a current action at `progress‰ = (now − start)·1000 / (end − start)`. Partners are placed adjacent. Needs interpolate. The site is generated from `(worldSeed, placeId, genVersion)` and reconciled with persistent deltas and traces.
- **T0 → T1 summarize.** Job queues collapse to the nearest Activity. Fights resolve first. Micro-events roll up.
- **[PROPOSAL] for today's M3:** enter the one live site **through `materialize()`**, not a hand-written spawn, so LOD (M2.5) is an extension rather than a rewrite.

**Consistency contract:**
1. **Round-trip property tests:** Sheet, Mind (needs within tolerance), inventory totals, and relationships survive promote/demote/promote.
2. **Statistical equivalence** across 50 seeds, comparing forced T0 vs. T1 and T1 vs. T2: needs, interactions per actor-day, opinion drift, money flow, and **pantry drawdown**.
3. **No seams.** Nothing in a memory, belief, or Chronicle entry may be contradicted by what the player finds. **[OPEN] (08 §2.6):** may trivia drift? I recommend yes.

### 5.3 Census materialization

**[DECISION] (`00`)** The population exists as a census, and sheets are materialized lazily and deterministically. `04` §13.3 gives the generator to this doc. `05` owns the census *numbers*, and `12` §2 proposes people shares as priors.

**[PROPOSAL]:**

```ts
interface CensusRecord { household: HouseholdId; place: PlaceId; seed: number; members: CensusMember[]; exposure: HouseholdExposure }
interface CensusMember { idx: number; born: GameMinute; sex: Sex; people: PeopleId; presentsAs: PeopleId;
                         culture: CultureId; occupation: OccupationId; alive: boolean; materialized: ActorId | null }
type CensusRef = { household: HouseholdId; idx: number };
```

- **Census households are real households.** They have pantries and an `exposure` aggregate (hardship, illness, losses, debts, mood band). T2 applies the same rules to them in aggregate (labor, consumption, SEIR disease), per P2.
- **Events can name a census member before they exist** via `CensusRef` ("a boy of the Vogt household saw her on the bluff road"). Perception records a deferred memory against the ref.
- **Triggers:**
  - direct contact with the PC
  - a rumor or event that needs a specific person
  - moving to T0
  - becoming party to a grudge, debt, persecution role, or club membership
- **Two-layer generation:**
  1. **Identity:** name, abilities, traits, psyche parameters, norms, Shadow seed, and true and presented people. It comes only from `rng(seed, 'census', 0, mixKey(household.seed, idx))`, so it's **time-independent**: day 10 and day 300 produce the same person. `12` §13 (proposed `inheritance` block) adds binary faekin inheritance from the household seed, and that slots in here.
  2. **History:** current needs, opinions of household and neighbors, and recent memories. It's synthesized from `exposure` plus every event that referenced the member's `CensusRef`. Those events become real memories, so nothing already recorded can be contradicted.
- **ActorIds are allocated in system order** (deterministic). The ref → id mapping is permanent, and events keep their refs.
- **Compaction.** `11` §5.6 proposes compacting the oldest *irrelevant* named actors to T2-minimal once a soft cap is passed. They're never deleted or un-materialized. Compaction is a deterministic rule keyed on game state, so it's the same on every device.
- **Sensitivity.** People shares and inheritance rules are content, decided by `12` and Ellie. The engine stores the truth and gates it behind beliefs. It never makes a prejudice true (`12` §1, rule 5).

**Implementation notes.** The `census` stream and `HouseholdId` exist. There's no `CensusRecord` yet. When it lands, check that the identity layer is keyed on the household seed and `idx` only, and never on `now`.

---

## 6. Scale and budgets (C2, C9), coordinated with `11`

**[DECISION, lead call + `11` §5.1]** Outcomes are platform-independent. World size, tier caps, T1 radius, relevance thresholds, census rules, and compaction never vary by device. A slower device runs the same sim more slowly through the speed governor.

**`11` owns** the World-size presets, reference devices, frame/battery/thermal budgets, and per-device worker CPU shares. In summary:
- **Small**: about 400 named.
- **Standard**: about 800 named, 3–4k people, about 6 settlements. It's the default everywhere.
- **Large**: about 1,500 named.
- **T0 cap is 150 at every size.**
- **Phone floor** is an iPhone 12 class device. **Mid phone** is an iPhone 15 / Pixel 8a class device.

This doc adopts those presets. That retires the old `07`'s "2–5k named, all with full minds" in favor of `00`'s census, and it lines up with `05`'s area and population. **[PROPOSAL]** The preset must be stored in `World.meta` and in the save header. The code's `WorldMeta` doesn't have it yet.

**Sim-side budgets** this doc adds, measured as worker CPU on the mid phone unless noted:

| Budget | Target | Why |
|---|---|---|
| T0 heap entry (avg incl. subscribers) | ≤ 5 µs | Market day at 6× ≈ 30–80k entries/s lands inside `11`'s ≤ 50% core |
| T1 game-hour, 30 actors (**ADR M2 gate**) | < 5 ms | ADR |
| T1 game-hour, 400 actors | ≤ 40 ms, sliced ≤ 8 ms | `11` §5.4 |
| T2 game-day, Standard | ≤ 150 ms total; 6-h sub-step ≤ 15 ms | `11` §5.4 |
| Pantries + spoilage share of T2 | ≤ 10% | M4 gate |
| Query (planner, odds, readiness) | ≤ 20 ms | `11` §5.4 |
| Journal replay of 1 game-day, Standard (phone floor) | ≤ 1.5 s | So `11`'s cold resume (≤ 3 s) holds; see §7.1 |
| Harness `smoke_town` 1 year (Node, desktop) | ≤ 3 s | tuning loop |
| Harness Standard 1 year (Node, desktop) | ≤ 45 s | sweeps across seeds |
| Worker heap | Small ≤ 60, Standard ≤ 120, Large ≤ 220 MB | `11` §5.6 |

**Checkpoints:**
- **M2:** the ADR gate.
- **M4:** pantries at Standard.
- **M5:** Standard sustains 6× on the mid phone and 1× on the phone floor.

If Standard misses by 3× or more, fix the data layout before adding systems. Narrowing Standard's named count is the structural fallback.

---

## 7. Saves, storage, and the worker protocol

### 7.1 Saves (aligned with `11` §4.3)

**[PROPOSAL]** A save is the latest **snapshot** plus the **command journal** since it was taken.

- **The journal is the `core.command` stream,** written to OPFS *before* a command's effects are shown. That gives Commitment integrity (`06` §8.2): force-quitting can't undo a death.
- **Snapshot cadence:** at each in-game dawn, on `visibilitychange: hidden`, and before Travel/Sleep. Three snapshots rotate.
- **Header:** `format, gameVersion, contentHash, modList, seed, worldSize, minute, tenth, stateHash, journalLength`.
- **Body:** the canonical JSON of the World, gzipped with `CompressionStream` in the worker.
- **Event-log segments** are separate immutable OPFS files referenced by id, so a snapshot rewrites only live state and the open segment.
- **Size.** My estimate for Standard is 3–6 MB gzipped. `11`'s ceiling is 15 MB, and the write budget is 300 ms.
- **Resume = load the snapshot + replay the journal tail.** The tail is at most about one game-day thanks to the dawn snapshot, hence the §6 replay budget. If the replay hash doesn't match the header's `stateHash` at the next snapshot, we've found a determinism bug: report it and keep the snapshot.
- **Mid-T0 snapshots** happen only at instant boundaries and include the clock `tenth`, the heap, and the current path segments. The determinism suite saves and loads in the middle of a fight.
- **Content ids in saves are strings** (`"base:hardtack"`). Unknown ids become `MissingContent` placeholders with a warning.
- **Migrations:** a `format` integer and pure `migrate_vN(json)` functions. Before 0.x, saves may break, loudly.
- **Storage:**
  - **OPFS** via `createSyncAccessHandle` (worker-only, synchronous, the right shape here) holds snapshots, the journal, and segments.
  - **IndexedDB** holds the index, settings, and the prose cache, and is the fallback store.
  - Call `navigator.storage.persist()`.
  - **iOS evicts storage for non-installed sites unused for 7 days.** `11` handles the install and backup UX. Export/import of a `.coulee` file (snapshot + journal + content hash) is also the bug-report bundle: `coulee replay bundle.coulee` reproduces it, and `--engine-check` replays under Node and Bun. **[OPEN]** OK to offer this as an opt-in report?

### 7.2 Transfer costs

`postMessage` structured-clones its payload, paying for every object and byte on *both* threads. A Standard World as objects is tens of MB, which would cost hundreds of ms per clone on a phone. **[PROPOSAL] Rules:**
1. **The World never crosses the boundary.**
2. **Positions are a transferable `Float32Array`** (id, x, y, facing, anim, flags), about 3.6 KB for 150 actors. Two buffers ping-pong, and the worker sends a new batch only when a buffer comes back, which gives natural backpressure at display rate. The sim stores positions as integers, and the conversion to float happens only in this render feed. A `SharedArrayBuffer` ring is allowed where the page is cross-origin isolated (`11` §5.4: Capacitor and Tauri can set COOP/COEP), but it's not required.
3. **View models** go out at ≤ 10 Hz with structural sharing: only changed VMs are posted, and each is ≤ 64 KB. zustand selectors keep re-renders within `11`'s 4 ms.
4. **Queries** are request/response with an Explain and are debounced by the UI.
5. **Slicing:** the worker never blocks for more than 8 ms. It yields via `MessageChannel` between slices, so taps and queries never wait behind a T2 day.

### 7.3 Protocol v1 (sketch)

```ts
type ToWorker = { v: 1 } & (
  | { type: 'init'; bundleUrl: string; scenario?: string; save?: string }
  | { type: 'cmd'; clientSeq: number; cmd: Command }
  | { type: 'speed'; speed: Speed }                         // incl. paused, tactical, tactical_half
  | { type: 'query'; reqId: number; kind: QueryKind; args: unknown }
  | { type: 'view'; reqId: number; kind: ViewKind; args: unknown } | { type: 'unview'; reqId: number }
  | { type: 'pos-return'; buf: ArrayBuffer } | { type: 'save'; slot?: string } | { type: 'export' });
type FromWorker = { v: 1 } & (
  | { type: 'pos'; minute: number; tenth: number; buf: ArrayBuffer }          // transferred
  | { type: 'vm'; reqId: number; vm: unknown } | { type: 'query-result'; reqId: number; result: unknown }
  | { type: 'events'; items: EventVM[] }                                      // knowledge-gated
  | { type: 'cmd-result'; clientSeq: number; ok: boolean; appliedAt: number; reason?: string }
  | { type: 'interrupt'; reason: 'hostility' | 'arrival' | 'alert' | 'need' } // 11's auto-pause and Tactical
  | { type: 'governor'; requested: Speed; effective: Speed }                  // 11's ▶6×→4×
  | { type: 'saved'; bytes: number } | { type: 'error'; message: string });
```

**[DECISION] (ADR 0002)** Game-event stopping and the knowledge-gated alert score belong to **one shared PlaySession interrupt policy**, used by headless waits and the pocket UI. The worker forwards its interrupts; each UI owns real-time toast coalescing and presentation. `08` Q14 still owns the category defaults, threshold and action-end/sheet toggles; it does not reopen the shared-policy decision. Interrupts stop advancement without changing the rules of the actions already applied.

### 7.4 Packaging (`11` §4 owns)

The PWA is offline-first. A bundle with a new `contentHash` triggers the save-compatibility check. Capacitor and Tauri come later. Tauri's system webviews include WebKitGTK/JSC on Linux, so desktop builds span engines too.

---

## 8. Testing

| Layer | Tool | Examples |
|---|---|---|
| Unit | Vitest | expression parser; calendar; `decayQ16`, `LOGIT_Q8` round-trips; spoilage band math; kcal burn |
| Property | fast-check | opinions in bounds under any event sequence; credence in 0–100 and carry within ±127; Σ stack grams = carried grams; promote/demote round-trip; the loader returns errors (never throws) on arbitrary TOML; rumor lineages terminate; census identity is time-independent; heap order is total |
| Determinism | Vitest | same seed ⇒ same hash; `run(2y)` = `run(1y)→save→load→run(1y)`; save/load mid-fight; the same journal at 1× and 6× ⇒ equal hashes; snapshot + journal replay = continuous run |
| **Cross-engine** | `just check-engines` | `smoke_town` and the combat golden under **Node (V8), Bun (JSC; runs TS directly), Playwright WebKit, and Playwright Firefox** (`playwright-core` is already a dev dependency). Per-day hashes must be equal, with `--bisect` on mismatch |
| Golden | Vitest file snapshots | `smoke_town` seed 42 for 1 year: `chronicle.md` + stats summary. **A Chronicle diff is a design review.** Intentional changes update the snapshot with a one-line rationale |
| Tables | Vitest (Node) | regenerated tables = committed tables |
| Integer audit | `findNonIntegers` | after every simulated day in tests |
| Content | `coulee content check` | schema, references, lints (P8 fields on provisions, price/weight sanity, duplicate ids, banned 3.5e proper nouns) |
| Statistical (soft) | `coulee sweep` | 64 seeds × 5 years against tuned bands; nightly, non-blocking |
| LOD equivalence | harness | §5.2 |
| Bench | `coulee bench` + a browser bench page | §6 and `11` §5 budgets, tracked over time |
| Shell smoke | Playwright | boot the PWA at 390×844 and 1440×900, run 600 game-seconds, assert no console errors and a position batch ≤ 16 KB, capture screenshots |

`just check` = Biome + invariants + typecheck + Vitest (golden and determinism included) + `content check`. `just check-engines` runs in CI once a remote exists (08 §2.6).

**Story metrics** (harness, for regressions only):
- feuds per 100 actor-years
- Chronicle callback share
- rumor mutations at the far settlement
- the drama Gini
- dead-air days
- **defense events per actor-year by type** (projection and displacement should cluster after misfortune, per P7)
- **households short of food per winter** (P8 should bite without wiping out the county)

---

## 9. Content as data and modding

**[DECISION] (ADR)** TOML is validated by zod and compiled to a JSON bundle. No hardcoded peoples. No copied 3.5e text.

**[PROPOSAL] Pipeline:**
1. Parse with `smol-toml`.
2. Run the zod schemas (per-module domains, as the code already does).
3. Check referential integrity.
4. Run semantic lints.
5. **Compile:** decimals → integer tenths, derived constants (`rDayQ24`), pre-parsed expressions, the canonical bundle, and `contentHash`.

**The bundle is the canonical input** for seeds and saves. The web app ships the bundle and never compiles base TOML at runtime. `content/base/items/_seed_examples.toml` and `peoples/peoples.toml` show the live shapes, and this doc doesn't duplicate them.

**Effects** use a small declarative effect union. DCs and weights use a tiny **integer** expression language: whitelisted variables, `+ − ×`, floor `÷`, `min/max/clamp`, no loops, and calls only from a fixed table.

**Mods.**
- The base game is a mod (`content/base/mod.toml`), and others live in `mods/<id>/`.
- Load order is a topological sort over `depends`/`load_after`, with ties broken by id.
- Merge semantics: add, field-level `patch`, and `remove` with a warning.
- Ids are namespaced, and saves record the mod list plus the content hash.

**Modding ceiling (gap 18; replaces Rhai/mlua):**
- **(a) Now:** declarative effects plus the integer expression language. That covers about 90% of the catalog.
- **(b) Later:** named hooks in a **QuickJS-compiled-to-WASM sandbox**. Its libm is compiled into the WASM module, so its math is identical on every engine. Hooks get a read-only view, return effect lists, and run under an instruction budget.
- **(c) Native TS modules:** fast, but unsandboxed and not checkable for determinism. Desktop-only, if ever.
- **[OPEN] (08 §2.6):** (a) now, with (b) as the ceiling?

---

## 10. Psyche placement, the harness, and the LLM adapter

### 10.1 Psyche

**[DECISION] (lead call)** `10` owns the psyche (drives, Id/Superego/Ego, anxiety, defenses, Persona/Shadow, archetypes, dreams). `04` keeps memory, belief, opinion, grudge, rumor, Figure, and notoriety.

**Architecturally (as the code's urge contract already does):**
- **Proposals come from modules.** Needs, activity, social, belief, and provisions each propose voiced urges (`id` or `superego`) with integer intensities and reasons. Psyche turns them into Thoughts.
- **The Ego arbitrates** hourly at T1 and at T0 decision points, and produces one `ChosenUrge` with an Explain (`knowledge: 'self'`). That Explain is what "why did I do that?" shows.
- **Unresolved conflict adds anxiety.** A defense fires as an urge or event, and downstream modules consume it:
  - projection writes a belief about someone else, which feeds `04` §5.4 attribution (C3)
  - displacement retargets an aggression urge onto a safer actor
  - repression lowers a memory's `s0`
- **Dreams** run nightly on a stream keyed `(actor, night)`. They produce dream-flagged memories and thoughts, plus Fae-intensity hooks (P7's collective unconscious).
- **Persona** is the psychological face of `04`'s identity and Figure model (C47; `12` §7.1).

**Implementation notes.** `schema/psyche.ts` and `core/src/psyche/state.ts` match the ADR:
- ego, superego, and idAppetite at 0–100; anxiety at 0–1000; thought intensity at 0–1000
- seven defenses
- `recentDefenses` records
- trait `period_label`, `voice_pct`, and `urge_bias`

Thought decay is linear per hour (integer), which is fine. If `10` wants exponential fading, use `decayQ16`. As `11` §9 also notes, `persona` is a free-text label and `shadow` is a list of trait ids with no reveal state. `10-psyche.md` doesn't exist yet, so both should be reconciled with it.

### 10.2 Harness (first target)

**[DECISION] (ADR)** The sim harness is the first target. `packages/cli` uses `cac`:

```text
coulee run       --scenario iron_ford --years 1 --seed 42 [--tier t0|t1|t2|auto] [--size small] [--check-state] --out runs/x
coulee sweep     --scenario … --years 5 --seeds 1..64 --jobs 16 --param social.gossip_rate=50,100,200
coulee inspect   runs/x actor gussie_pratt [--as <viewer>]      |  coulee inspect runs/x rumor <id>
coulee chronicle runs/x [--voice paper|journal|epilogue]        |  coulee diff runs/a runs/b [--bisect]
coulee replay    bundle.coulee [--engine-check]                 |  coulee content check [--mods …]
coulee bench     --size standard --days 30                      |  coulee save dump file.coulee --json
```

**Outputs** in `runs/<name>/`:
- `chronicle.md`
- `stats.csv` (daily: population, need quantiles, **food on hand per household**, interactions, rumor prevalence, grudges, the **persecution rung histogram**, money, births and deaths)
- `events.jsonl`
- `run.sqlite`
- `manifest.json` (seed, content hash, params, git SHA, Node version)

Sweep parameters are integers (per-cent), so tuning never introduces floats into state.

### 10.3 PlaySession (ADR 0002; built)

**[DECISION]** `packages/play` is pure TypeScript over core, with no IO. A `PlaySession` holds the World, one player-controlled actor, the command log, and an observation renderer. Pocket, desktop, text REPL and JSONL are views over the same API and view model: **every graphical player action must also be a headless Command**. A feature that cannot be played headlessly is not done.

- **Fair observations (default):** perceived place/time/weather and people present; own needs, conscious thoughts and inventory; provisions planner; witnessed events, heard rumors and the PC's beliefs. Available actions have stable ids. `explain <id>` exposes participated-check math through the same knowledge gates; hidden minds, concealed ancestry and unlearned unconscious sources do not leak through Explain or action listings.
- **God observations (`--god`):** ground truth, other minds and the Director's Ledger, for designer/debug agents. Reports record fair/god mode; god runs cannot substitute for fair acceptance.
- **Time:** actions consume game time; `wait <dur>` and `wait until <condition>` stop through the shared interrupt policy (§7.3).
- **Replay/save/fork:** world source + seed + command log reproduces a session. The source is an authored scenario id or a versioned generated recipe (world preset, constraints/pins, world seed and layer versions); keep the simulation seed distinct. `save`, `load` and `fork` support A/B decisions from the same state, with ancestry and observation mode recorded. CLI/worker shells own storage.
- **Telemetry:** JSONL metrics record money, calories eaten/burned, spoilage losses, opinion deltas, heard rumors about the PC, triggered defenses, Chronicle beats, deaths, and time idle versus deciding. Shells measure wall time; pure packages do not.

```text
coulee play --scenario iron_ford --seed 42 --text
coulee play --scenario iron_ford --seed 42 --jsonl [--god]
coulee play --replay log.jsonl
```

These transports are built, along with stateless `--session` play; see `packages/play/README.md`.

### 10.4 Optional LLM adapter

**[PROPOSAL, unchanged principle]** It renders only: facts in, prose out, and the sim never reads prose back.

- `ProseProvider.render(req): Promise<Prose>`, with `TemplateProvider` as the default (offline, deterministic) and `LlmProvider` opt-in. It lives outside core.
- The cache is content-addressed by `hash(kind, facts, promptVersion, model)`, in IndexedDB (web) or `.cache/prose/` (harness).
- Guardrails: timeouts fall back to templates, nothing blocks a step, a post-check rejects proper nouns that aren't in `facts`, and budgets are capped.
- **On the web, a key in browser storage is readable by any script on the origin,** so runtime use needs a user-supplied key with warnings, a proxy, or a local model. **[OPEN] (08 §2.6):** I default to dev-time only.

---

## 11. Repo: what exists vs. what's planned

### 11.1 Actual state (2026-10-12)

| Path | State |
|---|---|
| Root | Workspace, tsconfigs, Biome, `justfile`, Vitest and invariant checker landed (M0). `CLAUDE.md` and its `AGENTS.md` symlink share the rules for the two agent pools: Claude and Codex |
| `packages/core/src` | Foundation and module slices for `needs/`, `activity/`, `psyche/`, `social/`, `belief/`, `items/`, `provisions/`, `chronicle/`, `fae/`. Town social/Chronicle integration, survival and fae 1a/1b are built; LOD/census/region runtime remain ahead |
| `packages/content/src`, `content/base` | Loader, validator, bundler and module schemas; authored Iron Ford fixture, peoples/cultures, name pools, occupations/schedules, items and P8 food, beliefs and seeded tensions |
| `packages/cli` | Headless scenario runs, inspection and content commands; generated-town run/export/replay-manifest support |
| `packages/play` | ADR 0002 PlaySession built: fair/god observations, shared interrupts, replay/save/load/fork/verify, telemetry and storefront/food-ledger queries; used by CLI and web |
| `packages/worldgen` | **Town v2 and county stage v3 built:** pure deterministic layers → ordinary `ScenarioDef`, `SiteDef`, `PlaceDef`; town population, households, relationships, pantries and tensions. `coulee run --scenario gen:town` runs it; `coulee gen town` exports editable TOML plus recipe/report. County layers/graph, names and ford-town context exist; census, non-town layouts and pre-roll remain planned (§12.3a) |
| `apps/web`, `tools/blender`, `apps/web/public/assets` | Worker/PWA shell, pocket/desktop panels and data-driven site rendering; Blender scripts/placeholder assets, web PlaySession, storefront and Kit Sheet integrated. Materialization and measured cross-engine/device gates remain ahead |
| `scripts/`, `docs/impl/MODULES.md` | Invariant checker and screen capture tooling; `scripts/codex.sh` delegates Codex jobs alongside Claude's pool. `MODULES.md` owns file boundaries, additive contracts and module acceptance; current ownership includes fae, play and worldgen, with proposed region ownership for M5 |

Implementation of the town slice does **not** establish completion of every M1–M3 target below, cross-engine/device budgets, or the ADR 0002 agent playtest pass.

### 11.2 Planned additions

```text
packages/core/src/
  fixed/        math.ts (floorDiv, mulQ8/16, ipow, decayQ16, logit, sigmoid) · tables.gen.ts
  t0/           clock.ts · heap.ts · movement.ts · perception.ts · spatial.ts · pathing.ts
  lod/          tiering.ts · promote.ts · demote.ts · pending.ts · census.ts
  rules/        expr.ts · effects.ts · combat.ts · wounds.ts · magic.ts · curses.ts · drift.ts
  world-sim/    weather.ts · ecology.ts · disease.ts · economy.ts · travel.ts
  director/  persecution/  views/  queries/  snapshot.ts · migrate.ts
apps/web/src/   worker/ (sim.worker, loop, governor, protocol, opfs, idb) · ui/{pocket,desk,folio,shared} · render/ · pwa/
packages/play/     exists: shared PlaySession (ADR 0002); regional actions planned
packages/worldgen/ exists: town v2 + county v3 (ADR 0003); census/pre-roll/non-town layouts planned
scripts/        gen-fixed-tables.ts (planned); check-invariants.ts · codex.sh (exist)
docs/impl/      MODULES.md (exists)
CLAUDE.md · AGENTS.md (symlink): shared rules for Claude and Codex pools
```

**[PROPOSAL] `CLAUDE.md` essentials:**
- canon order: `00` > ADRs 0001–0003 > `docs/impl/MODULES.md` > design docs 01–12
- the §4.5 bans
- integer state scales
- every check produces an Explain
- no hardcoded peoples
- the World never crosses the worker boundary
- `just check` before "done"
- golden diffs need a rationale
- never copy 3.5e text

---

## 12. Milestones

**[PROPOSAL]** Ordering principle: **de-risk the novel thing first** (social sim, psyche, LOD), then the known things. Every milestone ends demoable with `just check`, cross-engine validation (`just check-engines` once wired), and an agent playtest pass (ADR 0002); M5a worldgen precedes M5 travel (ADR 0003). The acceptance criteria are gates.

**[DECISION] Shared playtest gate (every milestone):** run the named ADR 0002 personas in **fair mode**, replay their command logs, and compare supported actions/observations/interrupts with pocket and desktop on the same state. **Crashes, replay divergence, knowledge leaks, UI-parity failures, and progression blockers block acceptance.** God-mode diagnosis is recorded separately. Balance/exploit, confusion, boredom and story findings are triaged/deduped with a disposition (fix, tuning, design review, or deferred with reason); a finding that blocks progression blocks the gate. Reports include fun moments, bugs/repro logs, exploits, balance notes and whether the run produced a story worth retelling, under `playtests/<date>-<persona>-<seed>/{report.md,commands.jsonl,metrics.jsonl}`. Regressions replay the same logs/seeds plus fresh seeds.

**[PROPOSAL] Coverage below** makes the gates runnable; seed counts and balance/story pass bands remain `08` Q15, not new settled decisions. For "fresh seeds," record at least two seeds outside the listed regression set. Later fixtures are authored acceptance targets to build with their milestone. Before PlaySession or the UI exists, use command-driven harness smoke on the available surface and mark the missing gate evidence pending; M0's foundation is done, but do not invent a retrospective ADR 0002 pass.

### 12.1 Today's slice: M0 done; M1–M3 town slice integrated

| # | Scope | Acceptance |
|---|---|---|
| **M0** Skeleton | workspace, tsconfigs, Biome, invariant checker, `just`, CLAUDE.md, MODULES.md, core foundation (landed), scenario loader | `just check` green; `coulee run --scenario iron_ford --days 10 --seed 1` prints dated lines with moon and Sabbath; determinism test **and a Bun cross-engine hash test** pass; `content check` passes on `base` |
| **M1** Headless town + psyche-lite | needs, norms, traits, activities, interactions; T1 scheduler; Ego arbitration over voiced proposals; `04` opinions with Reasons; template Chronicle | 1 game-year in ≤ 3 s; ≥ 20 legible Chronicle entries with one visible relationship drift and one **defense event that reads as psychology**; `inspect` shows an arbitration Explain; golden snapshot committed |
| **M2** Memory, belief, rumor, grudge, defenses | `04` §4–8 using the §4.3 integer forms; projection/displacement into attribution; grudges; notoriety; persecution rungs 0–6; headless `witch_hunt` scenario | `inspect rumor` prints the transmission tree; with 6 injected curses per season, an accusation (rung ≥ 2) emerges in ≥ 50% and < 100% of 64 seeds; **ADR gate: < 5 ms per game-hour for 30 T1 actors on the mid phone** |
| **M3** Web shell, thin | worker + protocol v1; one T0 site (instanced low-poly); tap/click-to-move; pause/speeds; inspector via `view()`; installable PWA | the site is entered **through `materialize()`**; NPCs stand where their activities say; the inspector equals `coulee inspect --as pc`; Playwright smoke passes at both viewports |

**Status (2026-10-12):** M0 and the M1–M3 town slice are integrated (needs/activities, psyche, social, belief, provisions, Chronicle, web and Blender assets). Headless play is done; web PlaySession logs replay headlessly to the same hash. Survival is done (deprivation, collapse/death, aid, funerals/estates and death/retire/depart endings). Doc 13 fae 1a/1b are implemented; 1b spread, year-long rota and performance remain partial, and costs for keepers and those refused are in progress. Full targets remain unmet: LOD/materialization, persecution beyond rung 3, `witch_hunt`, cross-engine validation and phone budgets. The wave-4 Iron Ford year measured 17.1 ms/hour on desktop; performance targets remain unmet.

| Milestone | Explicit playtest gate (shared blockers and triage above apply to each) |
|---|---|
| **M0** | **Greenhorn + Exploit hunter / griefer:** `iron_ford`, seeds 1 and 42; launch, inspect, issue a command, advance and replay the available harness surface. Foundation done; PlaySession/parity evidence pending |
| **M1** | **Greenhorn + Roleplayer / socialite:** `iron_ford`, seeds 1–10 and 42, plus fresh seeds; follow a work/meal/Sabbath loop, override an urge, explain the arbitration and a changed relationship |
| **M2** | **Roleplayer / socialite + Exploit hunter / griefer:** `iron_ford` rumor/concealment fixture, seeds 1–20 and 42, and `witch_hunt`, seeds 1–64, plus fresh seeds; trace a heard rumor and accusation/defusal without seeing private truth |
| **M3** | **Greenhorn + Pocket player:** `iron_ford`, seeds 1 and 42, plus fresh seeds; replay movement, inspection, pause/wait and resume headlessly and at 390×844 / 1440×900, comparing Commands, observations and interrupts |

### 12.2 M2.5: LOD + census (must land before M5)

**Status (2026-10-12):** Not built. Census/materialization, T1/T2 tiering and compartment diffusion remain on M5's critical path (plan slice 2); slice 1 keeps two small populations hourly. The design below remains **[PROPOSAL]**.

Tiering with hysteresis, pending deltas, compartment diffusion, census records and materialization, relevance pinning, `CensusRef` event roles, and World size in `meta`.

**Acceptance:**
- Round-trip and equivalence tests pass across 50 seeds.
- A rumor born in settlement A is held by specific named actors in B after promotion.
- A census member who witnessed an event remembers it once materialized.
- Identity is time-independent (property test).

**Playtest gate:** **Explorer + Roleplayer / socialite + Exploit hunter / griefer**, on authored two-settlement LOD/census fixtures, seeds 1–50 plus fresh seeds. Leave, hear a rumor, return and contact a census witness; repeat across promotion/demotion and save/load. Shared blockers and triage apply, including any recorded-history contradiction.

### 12.3 M4: Outfitter + P8 provisions

**Status (2026-10-12):** P8 meals/nutrition, timed preparation, spoilage, nested gear/load, water, camping, trade/credit and restocking are built, with the web storefront, compare/buy preview and Kit Sheet. Acceptance **#2, #5 and #6 are met** (summer spoilage/Explains; food-number Explains; pocket shopping). **#1** has shared planner/sim kernels and regression coverage, but the exact $50/10-day/three-temperature gate is pending. **#3** relief is in progress; borrowing and rescue exist, but a zero-food household still lacks ordinary neighbor relief and the failed-harvest Standard gate is pending. **#4** is data-driven in its parts; the end-to-end new-food gate is pending. **#7** save/load is tested; cross-engine evidence is pending. **#8** awaits Standard T2, which is not built. M4 is not fully accepted.

**Scope:**
- `03` ratifies the `items.ts` field list.
- Content: **≥ 60 catalog items, including ≥ 15 foodstuffs** with full P8 fields. Hardtack, pemmican, salt pork, bacon, parched corn, cornmeal, flour, dried apples, beans, rice, coffee, tea, sugar, salt, and tinned oysters, plus fresh trout and morels in forage and fishing tables.
- Consumables: lamp oil, candles, lucifers, caps, powder, ball, and firewood.
- Systems:
  - buy, sell, and haggle (`04` opinions)
  - store shelves materialized from `03`'s ledger
  - `03` encumbrance bands (needs C22)
  - ration plans (full, short, half)
  - kcal burn (`05`)
  - a 14-day nutrition window producing **monotony thoughts** (`10`/`04`) and a **scurvy hook** (`02`)
  - band-table spoilage
  - prep needing fire, fuel, cookware, water, and time
  - pantries for every household and club
- UI (`11` §2.6–2.8): the Book, the Kit Sheet, the provisions planner, and Readiness.

**Acceptance:**
1. With $50, buy a 10-day kit. The planner's days-of-food is within ±0.5 day of actual consumption in scripted 10-day camps at 10°F, 40°F, and 70°F.
2. In July, fresh trout spoils within 1–3 days while salt pork keeps, and the stack Explain shows the band and packaging terms.
3. A Standard harness winter after a failed harvest leaves ≥ 10% of households short. That produces borrowing, theft, or club relief through ordinary `04` interactions, unscripted, and starvation deaths stay under a tunable band (initially < 2%).
4. A new TOML foodstuff appears in the catalog, pantries, and forage with no code change.
5. Every food number in the UI has an Explain.
6. The pocket flow (browse, compare, buy, read days-of-food) works one-thumbed at 390×844.
7. Spoilage and pantries are bit-identical across save/load and across engines.
8. Pantries cost ≤ 10% of the Standard T2 day.

**Playtest gate:** **Catalog kid / min-maxer + Greenhorn + Pocket player + Exploit hunter / griefer**, on `iron_ford` shopping, 10-day temperature-camp and failed-harvest fixtures, seeds 1–10 and 42 plus fresh seeds. Buy/pack a $50 kit, prepare meals, change rations, and compare planner/outcome and pocket/headless shopping. Shared blockers and triage apply.

### 12.3a M5a: Worldgen (before M5; ADR 0003)

**Status (2026-10-12):** Town slice v2 and county stage v3 are done and integrated. County generation has terrain, hydrology, ecology, fae field, named settlements/creeks/valleys and terrain-following route graphs, with QA across seeds 1–64 in both presets and county-to-ford-town context/export. Census, history pre-roll, non-town layouts, the county charm reservoir and playable county travel are not built. Real phone/cross-engine measurements and full county acceptance remain pending; Q07/Q08 and plan recommendations remain open/proposed.

**Town slice, implemented:**

- `generateTown` layers terrain → settlement → population → tensions → QA, using independent fixed salts on the `worldgen` RNG stream, keyed by generator version and stable actor keys. World seed and simulation seed are separate.
- `coulee` / `river` presets; town name, river and 3–5 farmstead constraints. An 80×64 town site uses descriptive geology and place footprints; the standalone renderer infers elevation and stream curves, while county v3 supplies a separate terrain/hydrology raster. It contains roughly 23–33 actors, homes/workplaces, pantries/store stocks, kinship/debts, concealment and seeded tensions.
- Emits ordinary authored-scenario/site/place records; `townContent` installs them without mutating the input bundle. Core and renderer have no generator-specific rule path.
- `coulee run --scenario gen:town` and `coulee gen town` support runs and editable TOML export with recipe/report; manifests restore world source, simulation seed and content hash. Invalid recipes or failed seeds reject explicitly, with no retry or silent seed substitution.
- Every generation validates schemas/references, integer seeds, footprints, reachability, homes/pantries, workplaces, names, ford, fae anchor, concealment and tensions, then runs a disposable 30-day sim. QA leaves the returned start untouched. CLI integration coverage spans seeds 1–50, determinism, manifest replay and TOML round trips (`runs/worldgen-qa.json`).

**Remaining scope:** on-demand non-town site layouts, census/households/population, county charm reservoir, playable travel/food acceptance, constrained set pieces, and **history pre-roll**. ADR 0003 proposes 5–10 years; `08` Q08 still owns duration and seed-validity bands. Hollin is the constraint/flavor bible, and authored Iron Ford remains a regression fixture.

**Acceptance for the county stage:**

1. Same versioned recipe (preset, seed, constraints/pins and layer versions) gives the same output/hash across engines; later-layer changes leave earlier layers stable. Authored and generated worlds use the same sim/UI contracts.
2. QA across seeds flags missing ford towns, unreachable required sites, unplayable starting routes/food, county collapse, fae deserts and towns without tensions. Hardship and shortages are reported separately; a hungry spring is intended.
3. The town slice's provisional collapse detector rejects ≥50% deaths or ≥75% of actors meeting <25% of energy obligations on at least five of the final seven days. This is an engineering detector, **not** Q08's settled hunger policy or proof of a playable PC opening. Add explicit starting-route/food checks for county acceptance.
4. Pre-roll produces learnable local history, grudges, debts, rumors and Figures; inspect and replay it after full social/Chronicle integration. Town Chronicles now contain integrated social stories; they do not establish county pre-roll acceptance.
5. Re-run the existing 1–50 town matrix after integration; **[PROPOSAL]** county QA covers seeds 1–64 across supported presets plus fresh seeds, preserving recipes and failing checks. Measure generation + pre-roll against ADR 0003's **<3 s mid-phone target**; a miss requires explicit lead review, not a desktop-only timing claim.

**Playtest gate:** **Greenhorn + Explorer + Roleplayer / socialite + Catalog kid / min-maxer + Exploit hunter / griefer**, on `gen:town` world seeds 1–50 (both presets; farmstead constraints 3 and 5), simulation seeds 9 and 42, and authored `iron_ford` seed 42 as control, plus fresh world seeds. For the county stage, use the 1–64 matrix above: outfit, reach a required site/fae anchor, return and learn a pre-roll tension. Shared blockers and triage apply. Automated all-AI survival QA does not substitute for these fair PlaySession runs; town fair-play reports exist in `playtests/`; the full matrix and playable county gate remain pending.

### 12.4 M5: Region map + travel

**Status (2026-10-12):** Plan written and merged: `docs/impl/M5-PLAN.md`; slice 1 (two authored sites, a multi-hour road, carried P8 supplies and arrival in both shells) is in progress. This checkout still has single-site play and no region runtime. County travel, trip forecasts, census/LOD, region UI and acceptance evidence remain ahead. Plan recommendations are **[PROPOSAL]**; §7 defaults await Ellie in `08`.

**Scope:**
- the procedurally generated county graph (ADR 0003 M5a), with Hollin constraints and authored fixtures
- `Travel` per edge with interrupts
- edges as places, with camps generated at the encounter point
- weather affecting speed and spoilage
- provisions consumed en route
- live T0↔T1 promotion and demotion
- census materialization on contact
- `11` §2.10's region map

**Acceptance:**
1. Iron Ford → a farmstead → back over 3 game-days consumes provisions within ±5% of the planner.
2. On return, named actors hold a rumor born in the player's absence, and the Chronicle reflects off-screen events.
3. 50 scripted seeded trips show zero seam contradictions.
4. Standard sustains 6× on the mid phone and 1× on the phone floor.
5. A day of travel at Ultra takes ≤ 3 s on the mid phone (`11` §5.4).

**Playtest gate:** **Explorer + Catalog kid / min-maxer + Pocket player**, on authored Iron Ford–farmstead round trips and M5a generated counties, seeds 1–50 plus fresh seeds. Pack, travel/camp, stop at danger/vitals/arrival, and return to off-screen consequences. Shared blockers and triage apply, with headless/pocket interrupt parity and seam contradictions checked explicitly.

### 12.5 M6: First combat

**Status (2026-10-12):** Not started. Survival already uses Vigor/Wounds and Fortitude saves; tactical combat, the T0 scheduler, weapon/reload execution and combat UI remain ahead. Scope and gates below remain **[PROPOSAL]**.

**Scope:**
- the T0 sub-minute clock and heap
- `02` §7 timed actions (windup/recovery, initiative delay, Concentration)
- auto-Tactical per the C21 decision
- black-powder reloads
- Vigor/Wounds and morale
- an Explain for every roll
- witness memories, then rumors
- `11` §2.11's pocket combat (pause-first planning and a timeline strip)

**Acceptance:**
1. The PC vs. 2 content creatures resolves, with every roll explainable.
2. A fight's journal replays bit-identically on V8, JSC, and SpiderMonkey, including a save/load mid-fight.
3. 40 combatants in Tactical 2× stay within `11`'s T0 share on the mid phone.
4. A witnessed fight's rumor reaches a nearby settlement through T1/T2.
5. Same-tenth completions resolve in heap order (property test).

**Playtest gate:** **Greenhorn + Catalog kid / min-maxer + Exploit hunter / griefer + Pocket player**, on authored PC-vs-two-creatures, reload and witnessed-fight fixtures, seeds 1–10 and 42 plus fresh seeds. Plan/attack/reload, interrupt, save/load mid-fight and replay at different speeds; verify only participated/witnessed math is visible. Shared blockers and triage apply.

### 12.6 M7: Adventurer vertical slice

**Status (2026-10-12):** Not complete. Newcomer creation/starting kits, outfitting, local exploration/camping, fae omens/charms and death/retire/depart endings exist. Full character creation, regional expedition/return, Director, dreams and legacy starts remain ahead; the vertical-slice gates remain **[PROPOSAL]**.

**Scope:**
- character creation (`02`/`06`; `11` §2.9) with people choice from content
- Iron Ford, a farmstead cluster, an old mine or cave, and a fae glade with an FI field
- a Director with 3–4 nudge types and a ledger
- dreams v1 (`10`), linked to Fae intensity
- death, retirement, or departure → Chronicle export → a legacy start

**Acceptance:**
1. A 60–90-minute run on phone and on desktop: outfit, travel, explore, return hurt, and find the town talking.
2. At least one unscripted callback in the Chronicle.
3. At least half of playtesters report a provisioning choice that changed an outcome (P8 bites).
4. A legacy character meets NPCs who remember the predecessor, per the `04` Q10 decision.

**Playtest gate:** **Greenhorn + Catalog kid / min-maxer + Roleplayer / socialite + Explorer + Pocket player**, on the authored Iron Ford/farm/mine/glade fixture, seed 42, and generated counties, seeds 1–10 plus fresh seeds. Complete the 60–90-minute outfit/explore/return/legacy loop on phone, desktop and headless. Shared blockers and triage apply; provisioning impact, callbacks and story value are recorded against the acceptance criteria above.

### 12.7 M8: Witch vertical slice

**Status (2026-10-12):** Not started. Psyche defenses, concealment, belief attribution and persecution rungs 0–3 exist; pact/witch start, curses, Woe/Tithe/Drift play, hunts and curse UI do not. Doc 13 is canon for fae systems; its implemented slices do not establish the Witch loop. Scope and gates below remain **[PROPOSAL]**.

**Scope:**
- the pact and witch start (`06`)
- ≥ 8 curses using `02`'s single DC formula (C29)
- Woe and the monthly Tithe (C45, C19)
- **Drift-keyed weaknesses owned by `06`.** Triggers are keyed to Drift thresholds and the pact, `03`'s iron load is an input, and `02`'s Witch feature references `06` (C27).
- persecution through `04` rungs 0–6, with `06`'s labels (Unknown 0, Whispered 1, Suspected 2–3, Known 4, Hunted 5–6; C41)
- witch-hunters pinned at T1
- Shadow and projection feeding scapegoating (`10`)
- content-limit toggles as World flags (08 §2.1)
- `11` §2.13's curse UI

**Acceptance:**
1. A 60-minute session where curses fuel power and the county's response (whispers, then accusation, then a hunt) emerges with no mode-scripted hunts.
2. In the harness, rung 5 is reached in some seeds and not others.
3. Every weakness trigger shows its Drift or pact Explain.
4. Toggled-off content never fires across 64 seeds.
5. The Chronicle reads like a folk tale.

**Playtest gate:** **Witch + Roleplayer / socialite + Exploit hunter / griefer + Pocket player**, on an authored pact/curse/persecution fixture and generated counties, seeds 1–64 plus fresh seeds, across the World content toggles. Complete a 60-minute curse/glean/Tithe/pressure/defusal loop; verify fair observations, weakness Explains and replay, with god diagnosis separately labeled. Shared blockers and triage apply; Woe exploits, moral texture, escalation pacing and folk-tale quality get explicit dispositions.

---

## 13. Risks

| Risk | L / I | Mitigation |
|---|---|---|
| Scope creep | Very high / fatal | Gated milestones; `parking-lot.md`; content volume follows systems; witch mode validated headlessly at M2 |
| Social sim and psyche produce mush | High / severe | Built first; story metrics; read the Chronicles; defenses must be *legible* events; if it's still mush at M2, fewer and stronger ties |
| Cross-engine divergence | Medium / severe | The ban + committed tables; `check-engines` from M0; per-day bisect; replay bundles |
| Phone performance and thermals | High / moderate | Event-driven T0; lazy decay and spoilage; sliced T2; the governor; gates at M2, M4, M5 |
| LOD seams | High / severe | M2.5 before M5; materialize-only site entry from M3; equivalence tests |
| iOS storage eviction | Medium / severe | `persist()`; the install prompt and export (`11`); Capacitor path |
| Worker-boundary bloat | Medium / moderate | Typed protocol; payload asserts in Playwright smoke; CLAUDE.md rule |
| Architecture erosion under agentic coding | High / moderate | Invariant checker, integer audit, golden and determinism tests, MODULES.md ownership, audits against this doc |
| Systems handling sensitive content carelessly (passing, persecution, Native nations) | Medium / high | Peoples and prejudice priors are data only; truth gated behind beliefs; content flags; `01` §2 and `12` decide, and the engine doesn't assume |
| Smaller risks | — | Toolchain churn (TS 7/Vite 8/Vitest 5): pin versions. Content IP: proper-noun lint plus review. Save churn: string ids and migrations. Over-engineering: no LLM or real mod system before M7 |

---

## 14. Decisions for Ellie

The ADR closes the earlier `07` questions on stack, sharing, platforms, and headless-first. New questions:

1. **T0 resolution and combat speed (C21).** Tenth-second sub-clock (recommended)? Auto-Tactical on hostility, as `11` proposes?
2. **Credence storage (§4.3 (2)).** The ADR's 0–100 plus a small logit carry (recommended), or amend the ADR to store logit-Q8?
3. **Scale.** Confirm `11`'s World sizes as the only scale lever, with Standard (about 800 named) as the default everywhere and the size stored in the save.
4. **Values vs. norms.** The code stores `04`'s nine Values as a −3..+3 personality block. Per the lead call, they should become superego norms. Keep a temperament block alongside them (`10`'s call), or migrate fully?
5. **Bug-report export** of the snapshot + journal as an opt-in?
6. **Modding ceiling:** declarative now, QuickJS-WASM later?
7. **LLM at runtime?** Still open, and harder in a PWA.

Still carried in `08`: LOD strictness, git hosting/CI (`check-engines` needs it), art pipeline details, and `11`'s reference devices.
