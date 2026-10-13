# M6 slice 1: Pause at a real instant

Implementation on `wave6/m6-slice1`, based on `43e4a3d`, 2026-10-12. No commit.
Q04 remains undecided: tenths and automatic danger pause/Tactical are the plan's defaults,
not a new design approval. `sim/clock.ts:TICKS_PER_SECOND` is the resolution setting.

## Delivered

- Optional, versioned tactical state; `World.time` remains integer minutes and `tenth`
  is the within-minute offset. `instantOf` never bitwise-truncates the full instant.
- Plain saved binary heap ordered by `(instant, actorId, seq)`. Saved tokens, command
  sequences, authorization basis/issuer, action phase, guard posture, recovery deadline,
  reservations, pending routine commands, and interruption latch survive restoration.
- `advanceUntil` is an atomic driver. Entry happens at an hour boundary, before later
  actions. A frame prepares journey intervals, thermal/need rates, and psyche intentions;
  activity and the other hourly effects settle once at its saved closing boundary, in
  module order. The closing accounting view retains the interval's calendar/RNG keys;
  emitted events are stamped at the actual boundary, after due tactical actions.
- Live actors accrue the ordinary need kernels using immutable rest/exertion rates and
  integer carries. Need-meter and carried-device supply deadlines are sparse stops,
  so subdividing an advance cannot move a vital/depletion event. T1 actors retain hourly
  settlement. Meals, production, nutrition and storage are not rerun per tactical query.
  No T2 or fae subjective-time implementation is claimed beyond M5 slice 1's contracts.
- Activity owns authoritative five-foot cells with `(site, level=0, x, y)`. This slice
  uses an authored place's rectangular walkable interior. Commands move one orthogonal
  cell, reserve it immediately, and commit at the scheduled instant. Occupied cells,
  reserved cells, diagonals and leaving the interior are refused. Load affects duration
  once. No renderer animation can change the position.
- Initiative is a saved d20 + Dexterity check with a self-only Explain. NPC psyche can
  propose one authorized guard at entry. Commanded actors remain idle until commanded.
  Guard establishes a saved passive posture, not permission to attack. Movement clears
  that posture. Every action start and physical commitment checks agency and capacity.
  Revocation cancels the uncommitted effect; cancellation releases its cell and retains
  recovery. New declarations cannot skip recovery.
- Breathe appears after six quiet seconds and only demotes with an empty action heap.
  It preserves the exact clock and open frame. The remainder of that interval is accounted
  as waiting for former participants; ordinary orders resume through hourly boundaries.
  Journeys remain suspended without spending distance or changing their walking status.
- Headless and worker use the same fair event filter and interrupt callback. Danger and
  own action completion pause at the atomic instant. The fair timeline exposes only the
  player's position/posture/phase/deadline, not NPC initiative or plans. Events and the
  knowledge archive retain optional tenth stamps. Replay headers include clock/rules,
  engine and source fingerprints; tactical log rows include exact start/end instants and
  sequence. Unsupported clock/rules versions are rejected; absent-state format-1 worlds
  keep their legacy path. Worker restoration remains paused.

The opt-in content fixture is `tavern_instant` (extends Iron Ford). Ordinary social fights
are unchanged: no damage, attacks, weapons, reloads, surrender or retaliation are enabled
by this slice. `requestEncounter` accepts existing colocated actors and a place; the
caller remains responsible for materializing a future M5 encounter and its entrances.
The fixture does not invent actors or inventories.

## Fair play

Both runs used one CLI session-mode Command per call, fair observations, normal newcomer
kit, and no world edits. Each call reloads the preceding save.

- [Greenhorn, seed 42](../../playtests/2026-10-12-m6-greenhorn-42/report.md): 3 commands,
  `wait 1h → guard → resume`; verified hash `5da90f8beffa0258`.
- [Pocket player, seed 7](../../playtests/2026-10-12-m6-pocket-7/report.md): 8 commands,
  two steps with cancellation/recovery, then Breathe; verified hash `595acaa4d1e8d7fa`.

> A chair scrapes back. Someone squares up to you. Paused before anyone acts.

> Tactical 00:00:00.0 — guard: windup; 2.1s remaining.

> Paused at 00:00:03.3.

> Since last look: 3.3s passed.

Pocket's exit is tick 142, not an hour. An early CLI bug that described fractional
advancement as “No time passed” was corrected; final transcripts are the linked runs.

## Verification and legacy proof

Focused acceptance: **28 tests in 4 files** (core clock/heap, integration, real worker,
existing worker protocol). Includes randomized heap ties, large/boundary clock round trips,
reservation contention in either admission order, interval partition equality, exact vital
threshold events, authoritative movement, no duplicate hourly work, revocation, commanded
agency, :59.9, 23:59:59.9, midnight and mid-recovery saves, session replay, and actual worker
save/hash/interrupt parity. `just web-build` passes. No browser or phone-performance claim.
`VITEST_MAX_WORKERS=4 just check` passed: **75 files / 780 tests**, all package and
script typechecks, Biome, invariants (230 files), and content validation (105 files).
The full suite took 708.09 seconds. Evidence: `runs/scratch/m6-check-green.log`; web build:
`runs/scratch/m6-web-green.log`. `git diff --check` passes; golden files are untouched.

The unchanged baseline code was extracted from `43e4a3d` into `/tmp/m6-baseline` without
altering Git. The original content bundle was captured before the new fixture. Each source
ran **720 hours / 30 days** before and after. No tactical state occurs in these sources.

| Source / seed | Baseline | Final code, pinned bundle |
| --- | --- | --- |
| `iron_ford` / 42 | `d71b7f45ae388993` | `d71b7f45ae388993` |
| `gen:town` / 7 | `9b11e818b3357a99` | `9b11e818b3357a99` |

With the expanded bundle, raw hashes are `78113487ae964ae9` and `5b0e4e0198a39d3b`.
Normalizing **only `world.meta.contentHash`** to the respective pinned bundle reproduces
both baseline hashes. The engine's state-hash function is unchanged. No golden file changed.
Reproduction scripts/data: `runs/scratch/m6-legacy{,-baseline}.ts`,
`m6-baseline-content.json`, `m6-legacy-{before,release}.json`, `m6-fresh-proof.ts/json`.

## Ownership and integration

Ownership/additive contracts are registered in `MODULES.md`. Main implementation is
`tactical/**`, `sim/{clock,heap,advance,schedule}.ts`, activity hooks, PlaySession and the
new web `TacticalTimeline`. Contracts remain additive; no sibling relief, fae, social
objects, or region-map implementation is replaced.

Out-of-area edits, for the integrator:

- **Foundation composition:** `core/src/{world,command,index}.ts`, `events/{base,index}.ts`,
  `sim/sim.ts`: optional state/events/commands, context stamps, legacy adapter and restore
  version check. The ordinary hourly order and absent-scene serialized shape remain intact.
- **Needs:** `needs/{api,system,tactical}.ts`: preparation, exact interval needs and avoiding
  duplicate live settlement. Uses the existing ledger and need mutation kernel.
- **Provisions:** `provisions/{api,system,employment,nutrition,environment,state,tactical}.ts`:
  suspend live work/meals/automatic drinking; interval burn/device supply and saved carries.
  These are clock/ownership hooks, not relief, debt, credit or economy-policy changes.
- **Psyche:** `psyche/{api,agency,tactical}.ts`: ownership authorization and entry guard
  proposals. No compulsion or social-object policy changes.
- **Content:** `content/src/schema/scenario.ts` and the new scenario: optional validated
  authored trigger, with no new domain defaults on existing scenarios.
- **CLI:** `cli/src/play-session.ts`: render fractional advancement and timeline in session
  replies. Integration tests are in `cli/test/tactical.test.ts`.
- **Web shared files:** only the small `PlayPanel.tsx` insertion and worker progression/
  snapshot hooks; new timeline component and worker integration test hold the rest.

## Slice 2

Use the action heap, commitment authorization, grid reservations and passive guard posture
for melee/nonlethal actions, grapple, fear, yielding and reachable flight. Add meaningful
NPC intent arbitration and cancellation/condition rules; hand off one outcome per episode
to social. Extend authored interiors into obstacle/exit geometry and multi-cell routes as
those encounters require. Preserve unseen-information filtering, exact deadlines and the
commanded actor's explicit permission for every consequential action. Weapons, injuries,
reloads and fae harm permission remain their later slice gates.

## Complete source-file inventory

- `apps/web/src/components/TacticalTimeline.tsx`
- `apps/web/src/tactical.worker.test.ts`
- `content/base/scenarios/tavern_instant.toml`
- `packages/cli/test/tactical.test.ts`
- `packages/core/src/activity/tactical.ts`
- `packages/core/src/needs/tactical.ts`
- `packages/core/src/provisions/tactical.ts`
- `packages/core/src/psyche/tactical.ts`
- `packages/core/src/sim/advance.ts`
- `packages/core/src/sim/clock.ts`
- `packages/core/src/sim/heap.ts`
- `packages/core/src/tactical/api.ts`
- `packages/core/src/tactical/commands.ts`
- `packages/core/src/tactical/events.ts`
- `packages/core/src/tactical/heap.test.ts`
- `packages/core/src/tactical/index.ts`
- `packages/core/src/tactical/spatial.ts`
- `packages/core/src/tactical/state.ts`
- `packages/core/src/tactical/system.ts`
- `packages/core/src/tactical/view.ts`
- `packages/play/src/tactical.ts`
- `apps/web/src/components/PlayPanel.tsx`
- `apps/web/src/sim.worker.ts`
- `packages/cli/src/play-session.ts`
- `packages/content/src/schema/scenario.ts`
- `packages/core/src/activity/api.ts`
- `packages/core/src/activity/production.ts`
- `packages/core/src/activity/state.ts`
- `packages/core/src/activity/system.ts`
- `packages/core/src/activity/travel.ts`
- `packages/core/src/command.ts`
- `packages/core/src/events/base.ts`
- `packages/core/src/events/index.ts`
- `packages/core/src/index.ts`
- `packages/core/src/needs/api.ts`
- `packages/core/src/needs/system.ts`
- `packages/core/src/provisions/api.ts`
- `packages/core/src/provisions/employment.ts`
- `packages/core/src/provisions/environment.ts`
- `packages/core/src/provisions/nutrition.ts`
- `packages/core/src/provisions/state.ts`
- `packages/core/src/provisions/system.ts`
- `packages/core/src/psyche/agency.ts`
- `packages/core/src/psyche/api.ts`
- `packages/core/src/sim/schedule.ts`
- `packages/core/src/sim/sim.ts`
- `packages/core/src/world.ts`
- `packages/play/src/actions.ts`
- `packages/play/src/describe.ts`
- `packages/play/src/interrupts.ts`
- `packages/play/src/observation.ts`
- `packages/play/src/session.ts`
- `packages/play/src/text.ts`
