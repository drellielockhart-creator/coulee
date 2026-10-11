# Post-merge play reconciliation

Mode: fair. Main checkout; the in-progress merge is preserved.

## Root causes and repairs

- Both seven-day survival failures were telemetry regressions: integration removed hourly `needs.changed`, so burned calories read zero. Play now reads the same pre-step hourly physiology ledger as needs. Survival assertions remain intact.
- Log retention invalidated event-array offsets. Action and wait processing now use `log.lastId` and `eventsSince`.
- PC knowledge formerly retained only ids pointing into a disposable log. Sessions now archive known event summaries and recursively gated explanations, interning repeated Explain subtrees in saves. Save/load/fork preserve the archive; old saves recover retained knowledge. Journal queries return all known entries, and heard rumors remain available independently of fading beliefs.
- `ask_about` did not exist in the integrated interaction catalog. A data-driven speaker direction lets it use the ordinary social/belief transmission path with the target speaking. Introduce/chat/gossip/ask/insult/apologize are tested for real resolved interactions, memories and reasoned opinions.
- Self-Command thoughts expire at the end of their hour; the renderer now shows the actual chosen verdict alongside living Appetite and Conscience thoughts.
- Separate purchased batches made `eat hardtack` ambiguous. The parser chooses the first feasible batch of the same named food in deterministic catalog order; explicit action ids select individual batches.

- Replay verification exposed a separate integration bug: both psyche thought emitters stored the live thought's reason array on old events. Later decay mutated the append-only log; a process restart severed the reference, so session replay diverged. Both emitters now copy the terms. A regression test compares uninterrupted play with save/load after every command and asserts that old events remain unchanged.
- Playtesting found that an unrelated spontaneous interaction could mask a failed requested interaction. Results now match both interaction id and target. Menus also suppress acquaintance-incompatible introductions/gossip without removing raw Command compatibility.
- Failed apologies had been narrated as mended quarrels. Journal templates now distinguish success and failure, with a source-level regression test.

## Fair module views

Core views now omit remote actors and private traits (including psyche's former fallback from presented traits to actual traits). Social views hide private memories, numeric reason deltas and unrelated relationship edges. Belief views hide other actors' unheard beliefs, unknown Figures and world-level misfortune/heat/consensus. Psyche explanations gate every child and hidden verdict. Failed concealed-tell checks are omniscient at their source. Other writers' journals and ledgers stay private even when the incident was public. Play retains its stricter projection.

Regression coverage is in `packages/cli/test/play-reconciliation.test.ts` and the existing social view tests. Existing ancestry-view tests now co-locate the viewer with the observed actor; they still assert the presented ancestry. Commerce tests now run during posted hours; they retain their cash/credit assertions.

## Trade and board

`content/base/provisions/services.toml` defines venue-tagged rules, shared by authored and generated places: stores 06:00–21:00, tavern meals 06:00–23:00, bed 25 cents through noon, meal 20 cents. All actors use the same rules. Bed fees transfer actual cash once per stay; paid meals consume the host's pantry and preparation supplies. Host households retain normal meal schedules. The UI receives hours and prices through provisions views. The 30-day golden chronicle was deliberately refreshed because hours and paid board change errands, consumption and consequent stories.

## Changed code

- Play: `session.ts`, `knowledge.ts`, `observation.ts`, `actions.ts`, `text.ts`, README.
- Core: `viewmodel.ts`, `explain.ts`; psyche, social, belief and chronicle view functions; belief tells; psyche thought event emitters; social interactions; activity bed admission; provisions services, transactions, state, commands, system and views.
- Content: items/social schemas, venue services, ask-about interaction, and failed-apology journal templates.
- Tests: play reconciliation, existing play/session, belief, content-world, social, provisions, integration, and chronicle golden.


## Year balance check

Iron Ford seed 42 ran 8,760 hours at 15.03 ms/game-hour; retained world save size was 13.69 MB (6,754 retained events of 768,454). This measurement preceded the Explain ownership repair, which does not change physiology or economic rules.

Winter balance remains weak. At year end, mean hunger/rest were 259/248 with venue rules, versus 390/367 in an otherwise identical run with venue services disabled; warmth was 1000 in both. This single-seed comparison does not establish a general balance result, but it does show that the new constraints warrant further winter tuning. Month-end hunger fell from 682 in April to 281 in January and 254 in February. Most repeated headline: “A Neighborly Act” (62 in the year), followed by “Ill Luck” (45). The monthly CSV and both run summaries are in `runs/iron_ford-42` and `runs/recon-venue-baseline.json`.

Other limits: one-hour scheduling can carry a conversation target away before resolution; this now produces an accurate warning. Some legacy journal prose still assumes children or a witness's viewpoint even for a single newcomer or a participant. Death/combat remains incomplete. No packages were installed and no commit/merge/reset/stash was run.


## Final three-day sessions

Both runs used one command per CLI invocation, fair mode, and reached **1855-04-04 00:00**. They exercised introduction/chat/ask/gossip, shopping, carried food, paid meals, drink and sleep; both also attempted insults and apologies. Journals and old explanations were queried afterward. The generated apology correctly remained a failure in the journal.

| World | Seed | Purse | Hunger | Thirst | Rest | Food days | PC knowledge archive |
|---|---:|---:|---:|---:|---:|---:|---:|
| iron_ford | 42 | $39.94 | 911 | 656 | 1000 | 7.8 | 129 KB |
| gen:town | 7 | $46.45 | 925 | 704 | 1000 | 6.3 | 109 KB |

Final world hashes: `df8f8dc380acafda` (Iron Ford), `4ee4bb57dd0e6134` (generated). Full command logs, telemetry and transcripts are attached in the two subdirectories. Earlier exploratory sessions are kept under `runs/*firstpass` and `runs/*before-replay-fix`; they demonstrate bugs fixed during reconciliation and are not the final replay artifacts.

### Generated-town exchange (excerpt; menus omitted)

```text
> gossip Submit
[1208] Gossip ▸ Submit Crane: success
Conscience: You don't know that. You're only repeating it.
Self-Command: Resolved: Gossip
> insult Submit
[1344] Insult ▸ Submit Crane: success
Insult: Ellis Wayfarer → Submit Crane: 13 () vs DC 11 -> success
> apologize Submit
[1401] Apologize ▸ Submit Crane: failure
Apologize: Ellis Wayfarer → Submit Crane: 9 (d20 8, Charisma +1) vs DC 13 -> failure
Appetite: I keep going over what Submit Crane did.
Conscience: Is Insult any way to treat a neighbor?
Self-Command: Resolved: Apologize
```

Replay verification after the final queries: **37 commands** for Iron Ford, **38 commands** for the generated town. Both match the hashes above. The PC archive accounts for about 2% of the total three-day session save (6.40 MB authored; 4.85 MB generated, including prepared content). No full world events are duplicated in that archive.

## Final validation

`just check` passed: 41 test files, 391 tests, all package/script typechecks, Biome, core invariants and content validation. `git diff --check` passed. Both three-day session logs passed `--verify`. `MERGE_HEAD` remains set; the merge was not committed or otherwise altered.
