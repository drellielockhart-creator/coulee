# Wave 10 B: social view and memory

All group-B items implemented; no commits made.

Validation: `VITEST_MAX_WORKERS=2 just check` passed: 89 test files, 954 tests, all package/script typechecks, Biome, invariants (260 files), and content validation (115 files). `git diff --check` is clean. Only touched files were formatted. The gate log is `runs/scratch/social-view-r3-check.log`.

| Item | Fix | Regression |
|---|---|---|
| B1 inspect leaks | Fair query payloads and web snapshots zero both opinion ledgers, withhold exact familiarity, omit private causes, and present bands. Failed readings retain the misread band and say “hard to read.” Absent NPCs cannot be read. God retains exact values. | `inspect hides both ledgers nearby and absent, hedges failed reads, and keeps god exact`; web `renders the player opinion as an impression without axes or memory deltas` |
| B2 direction | Separate the player's impression from NPC regard. Authored `memory_agent` corrects failed-borrow rejection and lost-fight roles/did flags without reversing the already-correct opinion ledger. | `socialite borrow refusal, help and lost fight belong to the recipient’s ledger` (also asserts slight ownership) |
| B2 duplicate/raw reasons | Deduplicate fair remembered lines; known-deed reasons stay deduplicated. Combat memories and reasons use participant accounts rather than raw event text. | `deduplicates known reasons and gives combat a reason label instead of raw event text` |
| B3 hearsay | Use persistent memory source metadata for “Heard from…”; tells become “Suspected that…”. Belief views expose attributed accounts while retaining their own credence. Public suspicion is described as talk, not revelation of truth. Presented ancestry remains unchanged. | `presents a tell as suspicion and hearsay with its source, including after log eviction` |
| B4 introductions | An opinion acquired through overhearing does not establish a meeting. Eligibility and inspect use actual exchanges, memories and established ties. | `overheard opinions do not prevent a real introduction` |
| B4 self tells | Distinguish an inner suppression check from noticing another actor's tell. | `does not narrate a suppression check as noticing oneself; yield addresses the yielder` |
| B5 food gifts | Whole parcels preferred; partially eaten food is still shareable, using ordinary item transfers that preserve partial use. | `replays the socialite’s opening commands through inspect and food gift to Richard Pascoe` |
| B5 gift dialogue | Named gift lines bind the actual transferred item instead of inventing eggs, ribbons, lettuce or wood. | Same recorded-opening gift regression |
| B5 yield | Render “You yield” for the yielding PC without asking them to accept their own surrender. | Suppression/yield regression above |
| B5 remote/sleeping conversation | Filter stale venue occupancy and check presence/awake state again at resolution, including answered requests. | `refuses NPC chat and help when the PC is away/asleep` |

The new CLI regressions are in `packages/cli/test/social-view-r3.test.ts`. The recorded opening replays the first 20 command rows from `playtests/2026-10-13-r3-socialite-gentown7/session/commands.jsonl`, then `talk:gift:24`. Actor 24 is Richard Pascoe in that recorded world. The explorer introduction repro uses Amos Whitcomb in `iron_ford_neighbors`.

Direction audit: the socialite's April 4 `talk:borrow:2` / `inspect Josiah Whitlock` transcript prints Ellis's refusal grievance immediately below Josiah's regard. Opinion ownership was correct. However, the episodic rejection memory marked Ellis as its doer, despite its summary saying Josiah turned Ellis away. Lost-fight memories had the same problem: the loser was the doer of being knocked down. Correcting these roles fixes memory-digest grievances and makes the summaries and participants agree.

Concealment audit: the socialite's “Remembered: Elijah Freeman is of the hidden folk” followed tell event 818, before gossip. This is emergent evidence with mundane lookalikes, not unearned factual knowledge. `design-docs/12-peoples.md` §§7.1–7.4 require precisely that distinction. No ancestry reveal or rumor seed was added, and no credence math was changed.

Golden reason: failed-borrow and failed-fight memories now attribute refusal/knockdown to the responder, altering subsequent grievance-driven choices; actual introductions and shareable food also alter downstream encounters. The 30-day golden was deliberately refreshed, with a one-line explanation in the test. Its first divergence in the combined patch is the introduction eligibility correction at April 1 06:00.

Fair headless verification: `runs/scratch/social-b-r3-final`, generated town seed 7. Commands: `wait until 08:00`, `talk:introduce:24`, `inspect Richard Pascoe`, `talk:gift:24`, `inspect Richard Pascoe`; `--verify` reports **Verified 5 commands; final hash c2b3226b2b6bdaf0**.

Related test fixtures: the strife tests now put their fighters in the same place; the look-text fixture supplies an attributed rumor account. The charm-loan fixture now seeds neighbors' knowledge of the sack (not their decision to borrow), and checks loan memories at return rather than assuming they survive 45 days. The autonomous loan, on-time return, witness, and twelve-week repayment assertions all remain and pass. These changes isolate the intended tests from the corrected social encounters.

## Files touched

- `apps/web/src/components/Peek.tsx`
- `apps/web/src/components/dossier/KnownTab.tsx`
- `apps/web/src/components/dossier/OpinionsTab.tsx`
- `apps/web/src/components/panels.test.tsx`
- `content/base/interactions/hostile.toml`
- `content/base/interactions/obligation.toml`
- `content/base/social/talk-manners.toml`
- `content/base/social/talk.toml`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`
- `packages/cli/test/chronicle.test.ts`
- `packages/cli/test/fae-charms.test.ts`
- `packages/cli/test/play-polish.test.ts`
- `packages/cli/test/play-reconciliation.test.ts`
- `packages/cli/test/social.test.ts`
- `packages/content/src/schema/social.ts`
- `packages/core/src/belief/view.ts`
- `packages/core/src/social/api.ts`
- `packages/core/src/social/combat.ts`
- `packages/core/src/social/gifts.ts`
- `packages/core/src/social/interact.ts`
- `packages/core/src/social/opinion.ts`
- `packages/core/src/social/system.ts`
- `packages/core/src/social/view.ts`
- `packages/core/src/social/volition.ts`
- `packages/play/src/describe.ts`
- `packages/play/src/observation.ts`
- `packages/play/src/session.ts`
- `packages/play/src/text.ts`
- `packages/play/src/view.ts`
- `packages/cli/test/social-view-r3.test.ts`
