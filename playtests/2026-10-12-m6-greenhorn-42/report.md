# M6 slice 1 — fair Greenhorn, seed 42

Source `tavern_instant`, ordinary commanded newcomer Ellis Wayfarer, standard kit.
Clock v1 / rules v1, engine `m6-slice1`; full source/content fingerprints are in
`commands.jsonl`. CLI session mode saves and reloads between calls. No god observations,
world edits, or designer commands were used.

Commands: `wait 1h` → `guard` → `resume`. Verification: **3 commands**, final hash
`5da90f8beffa0258`. Exact elapsed time is in `timing.csv`; 33 ticks / 3.3 seconds total.

> A chair scrapes back. Someone squares up to you. Paused before anyone acts.

> Tactical 00:00:00.0 — awaiting your order.

After choosing guard, no time passes; the timeline includes initiative preparation:

> Tactical 00:00:00.0 — guard: windup; 2.1s remaining.

Resume stops automatically when recovery finishes, before the requested six seconds:

> Paused at 00:00:03.3.

> Since last look: 3.3s passed.

> Tactical 00:00:03.3 — awaiting your order.

The useful moment is that “guard” declares an intention and “resume” lets it happen.
There is no need to race another player or an NPC. The guard posture remains saved;
no attack or retaliation is implied. Enemy initiative and queued deadlines are absent
from the fair timeline.

Confusion found and fixed during development: the CLI previously rendered “No time
passed” after a fractional action. It now prints seconds and the exact tactical timeline.
This final transcript supersedes the earlier scratch sessions. There is intentionally no
fight outcome in slice 1; after trying the clock, a Greenhorn needs slice 2's brawl/yield
choices to make the situation into a story. No damage or balance conclusion is claimed.
