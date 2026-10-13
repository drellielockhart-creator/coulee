# Wave 10 C: tactical follow-up

Source reports: `../2026-10-13-r3-edgeqa-ironford42/report.md` and
`../2026-10-13-r3-socialite-gentown7/report.md`, including session d/f/g/h and brawl2
command journals. The initial C1 and C2 PlaySession tests failed before changes: C1 had no tactical
view at creation, and C2 could not inspect Michael after the reported sequence.

All C items are implemented. No golden update. No commit.

| Item | Fix | PlaySession regression in `packages/cli/test/tactical-r3.test.ts` |
| --- | --- | --- |
| C1 | Authored danger is admitted before the first observation; ordinary orders refuse without time; Fight aliases the tactical attack | `C1 edgeqa seed 7: go 27 cannot consume the opening, and resume is available immediately` |
| C2 | Resume visits the six-second quiet deadline and retires the scene. Inspection stays available. Ordinary waits close the current hour, and short walks execute at the exact retained clock | `C2 socialite seed 8: wait, attack Joel, resume through the ending, inspect and walk`; parameterized `C2 edgeqa seed 7: attack, resume, flee/yield, resume, ordinary wait and walk` |
| C3 | Fight/attack/talk:fight admit a brawl lazily in authored or generated towns. The minute cursor transfers into the open frame, with one needs/supply settlement; bystanders gain witnessed, tellable news | `C3 socialite gen:town 7: the recorded talk:fight:3 opens a witnessed tactical brawl`; `C3 an attack transfers a spent town cursor once, preserves initiative and retires back to short walks` |
| C4 parley | A successful roll distinguishes accepted peace from refusal; queued blows from a settled episode cannot restart it | `C4 edgeqa parley: a heard appeal explicitly distinguishes refusal from peace` |
| C4 cancel | A hostile windup begins the brawl only on commitment. Cancellation retains recovery, without retaliation or a fight stamp | `C4 cancelled attack has recovery but no brawl, blows, or social incident` |
| C4 status/drink | Status describes being in a brawl; drinking refuses because of combat | `C4 mid-brawl status and drink refusal describe combat, with free inspection` |

C2 seed 8 uses brawl2's four attack/resume pairs and final resume. The seed-7
flee/yield cases now join adjacent Joel: the historical attack on Amos became reachable
only after the broken opening had already consumed an hour and moved Joel. C3 reuses
the local inspection/fight sequence at the generated tavern without four unrelated days
of conversations. Generated-town coverage saves mid-windup, continues both copies,
replays the journal, and checks a bystander can transmit the witnessed proposition.

Replay journals now identify rules **4** (`m6-r3`); explicit earlier rules are rejected.
Scene retirement is performed on an explicit resume/wait, never during observation.
Noncombat simulations retain their ordinary clock until an encounter is requested.
Town exits use the current place's walkable footprint and a deterministic nearby
same-site destination; authored scenes retain their authored exit.

## 1,000-seed rerun

`node --import tsx playtests/2026-10-13-wave10-tactical/distribution.ts`

Same fixture and policy as the slice-2 report: seeds 1–1000, standard newcomer versus
Lucius Vance in `tavern_instant`, attack when ready and accept offered submission.
The policy and actors were not tuned. [Seed rows](seeds.csv).

| Outcome | Brawls | Rate |
| --- | ---: | ---: |
| Knockout | 288 | 28.8% |
| Light nonbleeding bruise | 99 | 9.9% |
| Death | 0 | 0% |
| Flight ending | 368 | 36.8% |
| Accepted submission ending | 344 | 34.4% |
| Unfinished | 0 | 0% |

Knockout and bruise counts can overlap. Mean ending time: **15.2329 seconds**.
The distribution changed because opponents begin responding to committed hostility,
not a cancellable attack windup. No firearm/lethal tuning is implied.

## Fair CLI samples

Both samples use the newcomer in FAIR mode, with no state edits. Journals and transcripts
are included in `tavern/` and `generated/`. Each CLI call loads its save. The generated
sample starts at Rowe's, waits through Sunday church, then fights Jory at 13:00,
yields, resumes through the quiet deadline, inspects Loveday, and walks to Whitlock's.
The first attempt at noon correctly refused because Jory was away at church.

- Tavern: **12 commands**, verified hash `ed7258bfda492c78`.
- Generated town: **12 commands**, verified hash `df24b1d49c6f9103`.
- Focused acceptance: **48 tests passed** across the tactical, brawl, and final r3 suites.
  The existing malformed-input/save/replay regression also passes.
- Re-entry probe: two scenes in the same hour, integer state, exact replay hash
  `4d88df16b7565551` (`runs/scratch/c-reentry.ts`).

`VITEST_MAX_WORKERS=2 just check` passed: Biome checked 442 files, all package and
script typechecks passed, **955 tests in 89 files passed** (1044.34 seconds),
invariants passed for 260 files, and content validation passed for 115 files.
Full log: `runs/scratch/w10-c-check-green.log`.

`C3 a second town scene settles new witnesses needs and supplies from the same hour start`
also checks the later admission path through PlaySession.
`C3 ordinary conversations after retirement retain the hourly allowance` also passes:
the same exchange cannot reset its allowance merely because the tactical clock retained
a partial minute.

## Files touched

- `content/base/interactions/hostile.toml`
- `docs/impl/M6-SLICE2.md`
- `packages/cli/test/brawl.test.ts`
- `packages/cli/test/tactical-r3.test.ts`
- `packages/core/src/activity/api.ts`
- `packages/core/src/activity/tactical.ts`
- `packages/core/src/activity/view.ts`
- `packages/core/src/needs/tactical.ts`
- `packages/core/src/sim/advance.ts`
- `packages/core/src/social/availability.ts`
- `packages/core/src/social/combat.ts`
- `packages/core/src/tactical/api.ts`
- `packages/core/src/tactical/brawl.ts`
- `packages/core/src/tactical/spatial.ts`
- `packages/core/src/tactical/state.ts`
- `packages/core/src/tactical/system.ts`
- `packages/play/src/actions.ts`
- `packages/play/src/minutes.ts`
- `packages/play/src/session.ts`
- `packages/play/src/text.ts`
- `playtests/2026-10-13-wave10-tactical/distribution.ts`
- `playtests/2026-10-13-wave10-tactical/generated/commands.jsonl`
- `playtests/2026-10-13-wave10-tactical/generated/metrics.jsonl`
- `playtests/2026-10-13-wave10-tactical/generated/transcript.txt`
- `playtests/2026-10-13-wave10-tactical/report.md`
- `playtests/2026-10-13-wave10-tactical/seeds.csv`
- `playtests/2026-10-13-wave10-tactical/tavern/commands.jsonl`
- `playtests/2026-10-13-wave10-tactical/tavern/metrics.jsonl`
- `playtests/2026-10-13-wave10-tactical/tavern/transcript.txt`
