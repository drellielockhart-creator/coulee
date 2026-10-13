# M6 slice 2: Reachable flight and exact-time persistence

Fair mode; standard newcomer kit; seed 119. Engine `m6-slice2`, clock 1, rules 2.
No state edits or god observations during play. Each CLI invocation loads the preceding save.

`wait 1h → attack Lucius → resume → flee → resume ×12 → breathe`

> You cross the tavern door and leave the brawl.

Flight traverses cells and pauses at segment recovery. This is safe and legible but needs many Resume taps; route-wide resume presentation can be improved later without changing rules.

Replay: `just run play --replay playtests/2026-10-13-m6-edge-case-qa-119/commands.jsonl` (or the original session's `--verify`).
Verified 17 commands; final hash `4233196d2709ba68`.
Elapsed: 420 tenths; endings: flight; deaths: 0.
Metrics are post-run measurements from the saved world and command journal.

No blocking defects remain from this pass. Broader firearm, medical and county law playtesting belongs to later slices.
