# M6 slice 1 — fair Pocket player, seed 7

Source `tavern_instant`, ordinary commanded newcomer and standard kit. Clock/rules v1;
source/content fingerprints are in `commands.jsonl`. One CLI session-mode command per
call, saving/loading each time; no god observations or world edits.

Commands: `wait 1h` → `step south` → `cancel` → `resume` → `step south` → `resume` →
`resume` → `breathe`. Verification: **8 commands**, final hash `595acaa4d1e8d7fa`.
The scene ends at tick 142 / **14.2 seconds**, preserving the open hour. `timing.csv`
records each exact interval, including zero-time declarations.

Cancellation releases the destination but preserves the original recovery deadline:

> Tactical 00:00:00.0 — move: recovery; 5.5s remaining.

The next resume pauses after recovery. A second step then lands and finishes:

> Paused at 00:00:08.2.

> Since last look: 2.7s passed.

After a further six quiet seconds, Breathe is offered:

> You take a breath. Ordinary time resumes from this instant.

This is a useful pocket interaction: declare, reconsider, put the session away, then
resume without losing or rerolling the pending action. Cancellation cannot produce a
free move. The quiet period is a presentation affordance; it does not assert that future
combat is safe. No screen timing or precision tapping is required.

The worker parity test imports the actual worker with in-memory transport and a real
PlaySession; both danger and recovery stops match the headless hashes and exact
instants. This is transport/behavior evidence, not browser screenshots or a phone CPU
benchmark. Minimal web controls use 56px buttons and the same offered Commands.
