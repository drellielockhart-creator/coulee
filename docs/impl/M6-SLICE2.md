# M6 slice 2: A brawl with an ending

`wave8/m6-slice2`, 2026-10-13. No commit. Ellie's approved Q04 defaults supersede the
older planning document's undecided label. This slice keeps the tenth-second clock and
existing Vigor; it introduces no firearm executor or protagonist protection.

## Delivered

- Unarmed d20 melee with natural 1/20, critical confirmation, STR/progression and passive
  Defense. Positive nonlethal damage accumulates separately from Vigor; reaching current
  Vigor knocks an actor unconscious. Criticals only create light, nonbleeding bruises.
- Timed Grabbed → Held → Pinned contests, defender-wins-ties checks, escape/release and
  restrained movement. Conditions use the existing deduplicating setter.
- Source-specific Shaken (−2), deduplicated first-blow/half-stamina/restraint morale (at most one save per hit),
  anxiety and private Explains. NPCs choose attack, escape, flight or submission from the
  same health/agency state. Fear never orders a commanded actor to act.
- Yield stops pending nonlethal blows immediately on commitment; acceptance completes
  the incident. A successful parley can stop NPC fights, but cannot commandeer a commanded
  participant. Incapacity and crossing an authored exit also end the relevant pair.
- Every action start and effect rechecks `authorizeAct` using saved basis/issuer. Guard is
  passive. Optional reactions grant 1–3 attacks for one minute, spend the grant on declaration,
  have a six-second cooldown, and retain cooldown/recovery after cancellation or regrant.
  A granted movement reaction resolves before departure; the ordinary careful step avoids it.
- Flight follows a deterministic occupied-cell/reservation-aware route, paying for each
  segment and the door crossing. Position/place mutation belongs to activity. Cancel/revocation
  stops future segments; saving mid-route resumes the same route decisions and clock.
- Needs owns separate combat health and a lethal API hook: largest overflow/critical bonus/
  threshold injury contribution, burden, Spent/Staggered and explicit Dying. Dying is unconscious,
  checks Fortitude DC 15 every 600 tenths from injury onset, and dies after three accumulated
  failures through the existing `die` path. A 600-tenth Medicine DC 15 action stabilizes.
  Stable patients wake after one recovery interval (one hour); hunger recovery cannot clear combat incapacity. Dying and nonlethal recovery also advance during ordinary hours.
- A durable social incident applies memories/opinion reasons and `noteStrife` once per
  pair/scene, not per punch or restarted episode. Chronicle stores one witnessed summary before log eviction.
  A quarrel stopped before any attack/grapple contest produces no false fight stamp.
- Fair headless menus/parser expose attack, grapple, escape, yield, accept, parley (`break up`),
  flee, stabilize, reaction/revoke, and existing move/guard/cancel/resume/breathe. Own health
  appears in the timeline. Public checks show outcomes while private enemy modifiers, Defense,
  initiative and queued intentions remain withheld. The existing 56px web action buttons
  consume this shared menu and interruption policy.
- Replay headers use engine `m6-slice2`, rules 3 and clock 1. Explicit version-1 and version-2 journals
  are rejected; the saved world shape remains additive and clock format 1 stays intact.

`tavern_instant` lets the PC start a conflict. `tavern_brawl` seeds a fight between existing
Pike and Whitcomb, beside the newcomer, for joining and peacemaking. Other named patrons
remain bystanders. These remain authored opt-in scenes; ordinary county social-fight
replacement waits for the slice-4 permission/evidence gate.

## Acceptance and measured outcomes

The focused acceptance suite covers idle commanded agency, revoked issuers, submission,
exactly-once strife/opinions/Chronicle, grapples, fear deduplication, cancel properties,
bounded/revoked reactions, real flight and saves, fair disclosure/replay, seeded unarmed
checks, Dying deadlines, stabilization and death. Existing tactical/worker parity tests
remain in the full gate. Golden files are unchanged.

Original implementation gate: **green** (`VITEST_MAX_WORKERS=4 just check`): **83 files / 864 tests** in
810.16 seconds, plus Biome, all package/script typechecks, invariants (243 files) and
content validation (112 files). `git diff --check` is clean. Gate transcript:
`runs/scratch/m6-check-green.log`.

1,000 brawls, seeds 1–1000, standard newcomer versus Lucius Vance. Policy: explicitly attack
when ready and accept offered surrender; the opponent uses ordinary NPC arbitration.
Counts are brawls with at least one such outcome; bruises and knockouts can overlap.

| Outcome | Brawls | Rate |
| --- | ---: | ---: |
| Knockout | 257 | 25.7% |
| Injury: light nonbleeding bruise | 83 | 8.3% |
| Death | 0 | 0.0% |

Review rerun, rules 3: **382 flights, 257 knockouts, 361 accepted submissions, zero unfinished**.
Mean ending time: **15.2401 seconds**. The previous implementation had 519 flights, 270 knockouts and 211 submissions. These are
fixture/policy results, not firearm lethality tuning; unarmed accidents are not modeled.
[Seed rows and executable reproduction](../../playtests/2026-10-13-m6-brawl-distribution/report.md).

## Fair play

All sessions used ordinary CLI commands and the standard newcomer, with no state edits or
god observations. Each command invocation reloads its save; all journals verify exactly.

- [Greenhorn, 42](../../playtests/2026-10-13-m6-greenhorn-42/report.md): starts and yields;
  9 commands, hash `c01fe88c923b3322`.
- [Socialite, 7](../../playtests/2026-10-13-m6-socialite-7/report.md): joins, then breaks up
  both pair conflicts; 8 commands, hash `52b2aba46f1d2e7d`.
- [Edge-case QA, 119](../../playtests/2026-10-13-m6-edge-case-qa-119/report.md): attacks,
  flees by paid segments, reaches Main Street and breathes; 17 commands, hash `4233196d2709ba68`.

```text
just run play --session runs/scratch/m6-verified-42 --new --scenario tavern_instant --seed 42
just run play --session runs/scratch/m6-verified-42 "wait 1h"
just run play --session runs/scratch/m6-verified-42 "attack Lucius"
just run play --session runs/scratch/m6-verified-42 resume
just run play --session runs/scratch/m6-verified-42 yield
# Resume at each interrupt:
Paused at 00:00:07.0.
Ellis Wayfarer and Lucius Vance: the brawl ends with submission accepted; the blows stop.
```

Flee currently pauses after each segment's recovery, which is legible but tap-heavy. The
future route-resume presentation can improve that without changing paid movement or agency.

## Scope exceptions and remaining work

Small owner-boundary hooks were necessary for a playable brawl:

- **Needs:** new combat health module plus optional state/event/API, `canAct` integration
  and an optional cause-specific death Explain. Deprivation physiology is preserved.
- **Psyche/social/Chronicle:** API-owned fear, arbitration, incidents and synchronous summaries.
  No income, employment, piece-rate, relief or inspection-opinion feature was changed.
- **Activity/foundation/content:** one authored-door place handoff, optional sheet progression,
  sparse health deadlines, authored scene seeds and combat tuning/schema composition.
  M5 regional kernels, minute-budget accounting and ADR 0002 are untouched.
- **Play:** tactical-only affordances, descriptions, interruption classification and a replay
  version bump. Web controls already share this layer; no styling/rendering changes were needed.

Remaining: weapon/armor profiles, located injuries, Blood/bleeding, material-consuming
medical care and recovery, then firearm/load/smoke mechanics in slice 3; county encounters,
fae harm permissions and inquiry/arrest/hearing in slice 4. No browser screenshots or
phone-performance certification is claimed. Melee in this slice is unarmed.

## Files touched

- `content/base/combat/brawl.toml`
- `content/base/scenarios/tavern_brawl.toml`
- `content/base/scenarios/tavern_instant.toml`
- `docs/impl/M6-SLICE2.md`
- `docs/impl/MODULES.md`
- `packages/cli/test/brawl.test.ts`
- `packages/content/src/schema/bundle.ts`
- `packages/content/src/schema/combat.ts`
- `packages/content/src/schema/scenario.ts`
- `packages/core/src/activity/tactical.ts`
- `packages/core/src/actor.ts`
- `packages/core/src/chronicle/api.ts`
- `packages/core/src/needs/api.ts`
- `packages/core/src/needs/combat.ts`
- `packages/core/src/needs/events.ts`
- `packages/core/src/needs/state.ts`
- `packages/core/src/needs/survival-social.ts`
- `packages/core/src/needs/survival.ts`
- `packages/core/src/psyche/state.ts`
- `packages/core/src/psyche/tactical.ts`
- `packages/core/src/sim/advance.ts`
- `packages/core/src/social/api.ts`
- `packages/core/src/social/combat.ts`
- `packages/core/src/social/state.ts`
- `packages/core/src/tactical/api.ts`
- `packages/core/src/tactical/brawl.ts`
- `packages/core/src/tactical/commands.ts`
- `packages/core/src/tactical/events.ts`
- `packages/core/src/tactical/rules.ts`
- `packages/core/src/tactical/spatial.ts`
- `packages/core/src/tactical/state.ts`
- `packages/core/src/tactical/system.ts`
- `packages/core/src/tactical/view.ts`
- `packages/play/src/describe.ts`
- `packages/play/src/interrupts.ts`
- `packages/play/src/session.ts`
- `packages/play/src/tactical.ts`
- `packages/play/src/text.ts`
- `playtests/2026-10-13-m6-brawl-distribution/report.md`
- `playtests/2026-10-13-m6-brawl-distribution/seeds.csv`
- `playtests/2026-10-13-m6-edge-case-qa-119/commands.jsonl`
- `playtests/2026-10-13-m6-edge-case-qa-119/metrics.jsonl`
- `playtests/2026-10-13-m6-edge-case-qa-119/report.md`
- `playtests/2026-10-13-m6-edge-case-qa-119/transcript.txt`
- `playtests/2026-10-13-m6-greenhorn-42/commands.jsonl`
- `playtests/2026-10-13-m6-greenhorn-42/metrics.jsonl`
- `playtests/2026-10-13-m6-greenhorn-42/report.md`
- `playtests/2026-10-13-m6-greenhorn-42/transcript.txt`
- `playtests/2026-10-13-m6-socialite-7/commands.jsonl`
- `playtests/2026-10-13-m6-socialite-7/metrics.jsonl`
- `playtests/2026-10-13-m6-socialite-7/report.md`
- `playtests/2026-10-13-m6-socialite-7/transcript.txt`


## Cross-model review fixes (2026-10-13)

The fair transcripts above are historical rules-2 runs; rules-3 replay deliberately rejects
them. The new regression coverage reuses reviewer `runs/scratch/rv-a.ts` through `rv-g.ts`.
The Monte Carlo table and CSV above are the new rules-3 measurements.

| Finding | Fix | Regression in `cli/test/brawl.test.ts` |
| --- | --- | --- |
| Blocked flee continuation | Failed continuation calls `decideBrawl` | Exhaustive idle/flight policies, seeds 1–300, including route seed 209 |
| Simultaneous yields | Mutual submission settles as peace | Both yields wind up together; seeds 65/145/165 in sweep |
| Fled player trapped | Breathe uses the fled actor's recovery and six quiet seconds | Remote fight, save/resume, ordinary wait; all 600 sweep cases leave Tactical within 6,000 ticks |
| Attack then parley | Other fighters consult `brawlIntent`; participant menu says Offer peace | Healthy NPC refuses successful Persuade; willing NPC accepts; commanded opponent retains choice |
| Repeated fight stamps | One pair/scene stamp, including reversed pair order; episode keeps deduplication past archive eviction | Four restarted episodes produce one strife stamp |
| Step forces yield | NPC takes a reachable closing step, or guards if blocked | Step-away regression; new 1,000-seed ending distribution |
| Permanent Stable | One-hour wake deadline; existing injury burden and Vigor loss remain | Deadline-minus-one stays unconscious; deadline wakes |
| Recovery requires Tactical | Ordinary hourly adapter advances all overdue health deadlines | Nonlethal clears; Dying reaches the ordinary death path without scene state |
| Replay version collision | Rules version 3 | Versions 1 and 2 reject; rules-3 save/replay hashes agree |
| Retired scene blocks ordinary orders | Breathe parks the clock in additive `World.backgroundTactical`, clears `World.tactical`; the shared driver resumes background work | Partial hour survives Breathe (`tactical.test.ts`), short core advancement and background save hashes match |
| Symmetric opinions | Target and initiator use their respective content opinion deltas | Only victim gains the authored fear delta |
| Double morale saves | Combine same-hit transitions in one Composure roll | One save for first blow plus half stamina |
| Unbounded combat archives | Drop fear triggers as episodes end; keep at most 256 social incidents | Cleared fear; 300 handoffs retain 256 incidents |
| Main Street shown as home | Flight clears the previous activity to location-neutral idle | Paid flight leaves Main Street with no home activity |
| Unreadable Explain and bruising | Recursively render visible child checks with signed modifiers/DC; expose own nonlethal in status | God detail has DC; fair detail withholds enemy Defense; status shows bruised 3 |

The background clock retains the open-hour accounting rather than rounding elapsed time.
NPC fights continue after a bystander leaves; no NPC actions are silently discarded.
This branch does not contain main's `play/minutes.ts`; clearing `world.tactical` removes its
scene-presence blocker. Main's authored-scenario opt-out remains an independent policy.

Review revision files (in addition to this document):

- `packages/core/src/tactical/{api,brawl,spatial,state,system,view}.ts`
- `packages/core/src/needs/{combat,view}.ts`
- `packages/core/src/psyche/tactical.ts`, `packages/core/src/social/combat.ts`
- `packages/core/src/activity/tactical.ts`, `packages/core/src/world.ts`
- `packages/core/src/sim/{advance,sim}.ts`
- `packages/play/src/{session,tactical,text}.ts`
- `packages/cli/test/{brawl,tactical}.test.ts`
- `playtests/2026-10-13-m6-brawl-distribution/{report.md,seeds.csv}`

Validation: **green**, `VITEST_MAX_WORKERS=2 just check`: **83 files / 874 tests** in
728.41 seconds, plus Biome, all package/script typechecks, invariants (243 files), and
content validation (112 files). Transcript: `runs/scratch/m6-review-check.log`.
The final background-scene tests also pass independently. An ordinary-command replay across
Breathe, save/load and a one-hour wait matches hash `35fdd4aaa938f632` (scratch reproduction:
`runs/scratch/review-retired-replay.ts`). `git diff --check` is clean. No golden update and no commit.

## Wave 10 C: ordinary-town entry and shell clock handoff (2026-10-13)

The r3 follow-up supersedes the earlier authored-only admission policy for explicitly
ordered unarmed fights. `fight`, `attack`, and `talk:fight` now enter the same tactical
kernel in any town. Town minute cursors enter the open hour exactly once; ordinary
short orders resume against the retained clock. Authored danger is present in the first
observation. After a fight or flight, explicit resume/wait reaches the six-second quiet
deadline and retires the scene without an hour-long wait. Queries never advance time.
Cancelled windups retain recovery without starting hostility. Bystanders remember and
can pass on the fight through the existing belief transmission API. Replay rules are 4.

[Regression table, fair CLI journals, generated-town sample and 1,000-seed rerun](../../playtests/2026-10-13-wave10-tactical/report.md).
