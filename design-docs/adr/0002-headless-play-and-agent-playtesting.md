# ADR 0002: Headless play mode and agent playtesting

**Status:** Accepted (Ellie, 2026-10-10)
**Builds on:** ADR 0001 (headless core, Commands, Explain), 00 P1/P2.

## Context
Ellie wants AI agents (Claude sessions and subagents) to be able to **play the game headlessly**, so they can playtest and improve gameplay without the graphical UI. She also wants playtesting factored into every plan from here on.

## Decision

### 1. The game is fully playable headless
- A new package, **`packages/play`**, is pure TypeScript on top of `core` with no IO. It defines a `PlaySession`: a world, one *player-controlled actor*, a command log, and an observation renderer.
- **`coulee play`** in `packages/cli` wraps it in two transports:
  - **`--text`** (default): a readable REPL in the spirit of a MUD or text adventure. An LLM agent or a human can play it in a terminal.
  - **`--jsonl`**: one JSON command in, one JSON observation out, for scripted bots and harnesses.
- **UI parity rule:** *every player action in the graphical UI must be a `Command` that is also available headless.* The pocket UI, the desktop UI, and the headless REPL are three views over the same `PlaySession` API and view-model. A feature that can't be played headless isn't done.

### 2. Observations are fair by default
- **Fair mode** (default) renders only what the player character perceives or knows (P1 legibility gating): place, time, weather, who's present, the PC's own needs, thoughts (Id/Superego voices), and inventory; the provisions planner (days of food, what spoils first); events the PC witnessed; rumors the PC heard; the PC's beliefs about others; and the available actions, with stable ids.
- `explain <id>` shows the math behind any check, arbitration, or price, but only for things the PC was party to.
- **God mode** (`--god`) shows ground truth: other minds, hidden faekin, the Director's Ledger. It's for designer/debug agents only. Playtest reports must say which mode they used.

### 3. Time and interruption
- Actions consume game time. `wait <dur>` and `wait until <condition>` fast-forward.
- **Fast-forward stops on "interesting events,"** using the *same* interrupt/alert policy as the pocket UI's auto-pause (`11-interface-and-platforms.md`). One policy, tested headlessly, serves the phone.

### 4. Reproducibility and branching
- A session is fully defined by **world source + seed + command log**. The world source is either an authored scenario id or a generated-world recipe (`gen_version`, world preset, constraints/pins, world seed; ADR 0003). Every playtest report attaches its command log, so any bug or story can be replayed exactly (`coulee play --replay log.jsonl`).
- `save`, `load`, and `fork` let agents A/B a decision ("what if I'd bought the second canteen?") from the same state.

### 5. Telemetry
- Sessions emit metrics as JSONL alongside the log:
  - **Survival/economy:** money over time, calories eaten vs. burned, spoilage losses.
  - **Social/psyche:** opinion deltas, rumors heard about the PC, defenses the PC triggered.
  - **Story and pacing:** story beats from the chronicle sifter, deaths, time spent idle vs. deciding.

## Playtesting as process

**Every milestone's acceptance criteria include an agent playtest pass.**

Playtest **personas** (agent prompts), mixing model tiers for different player sophistication:

| Persona | Plays to find… |
|---|---|
| Greenhorn | Onboarding confusion, unclear affordances. Cheap model on purpose. |
| Catalog kid / min-maxer | Whether P8 crunch actually matters, plus dominant strategies and exploits. |
| Roleplayer / socialite | Whether the social sim and psyche produce stories and reasons. |
| Explorer | Pacing, boredom, the "keep playing" pull (P5). |
| Exploit hunter / griefer | Degenerate loops, broken economy, sim crashes. |
| Pocket player | Short sessions: is each 5-minute chunk satisfying, and do interrupts fire well? |
| Witch (from M8) | Curse/Woe economy, persecution pressure, moral texture. |

Loop: **play → report → triage/dedupe → design change → implement → regression playtest** (same seeds and command logs, plus fresh seeds).

Playtest reports cover:
- fun moments (quoted)
- confusion
- boredom
- bugs, with repro logs
- exploits
- balance notes
- whether the run produced a story worth retelling

Reports live in `playtests/<date>-<persona>-<seed>/` with `report.md`, `commands.jsonl`, and `metrics.jsonl`.

## Consequences
- Fair-mode rendering forces us to build **knowledge-gating** early. That's good: it's needed for P1 and the Chronicle anyway.
- The text renderer becomes a living spec for what the UI must show.
- It costs a small extra package, plus discipline on UI parity.

## Amendment 2026-10-13: minute budget

Accepted by Ellie (00 decisions log; 08 #11). Town Commands share a 60-minute
budget, through `PlaySession` in both the CLI and web worker. The simulation still
runs its existing hourly systems, in their existing order. No new periodic tick is
introduced, and uncommanded NPC schedules are unchanged.

- **Costs are content.** `content/base/play-time/town.toml` sets a 15-minute local
  walk cutoff and 5 minutes per buy/sell line (regardless of quantity). Walks use
  `activity.walkMinutes`: grid distance in feet / 264 feet per minute, rounded up,
  then the existing load speed percentage, rounded up again. Social interactions
  use their existing TOML `minutes`: durations below 60 resolve as short acts;
  durations of 60 or more retain the hourly action path. Rest, work, sleep, food
  preparation, water handling, packing, regional travel and fae workings retain
  the hourly path. Look, inspect, help, previews, signs and settings cost zero.
- **Execution and accounting.** A short act resolves immediately through the
  ordinary authorized movement, transaction or social executor. Psyche arbitrates
  explicit urges against current thoughts, with proportional override anxiety;
  hourly thought decay, defenses and NPC decisions do not run again. The actor
  wakes and remains at leisure after the short act. No hourly need decay, wages,
  meals or production run until the boundary. The activity slice records integer
  minutes per activity. At the boundary, physiology charges exactly one hour to
  the dominant activity, adding unspent minutes to the remaining activity (the
  newly ordered activity for a long act, or current leisure when waiting). Ties
  favor the remaining activity, then activity-id order. This is deliberately an
  hourly approximation, not minute-by-minute physiology. Paid labor and production
  use only the unspent minutes; they cannot earn a full hour after shopping for
  most of it. Long actions still establish their ordinary activity duration locks.
- **Crossing a boundary.** An act that exhausts or exceeds the budget resolves
  once, runs exactly one hourly tick, and carries any excess minutes into the new
  budget. It is never replayed as a command during that tick. A long order closes
  the current hour. `wait 1h` likewise closes that hour; from minute 12 it passes
  48 minutes, while `wait until` retains its named boundary. This keeps existing
  whole-hour waits and speed controls usable. Rejected preflights and unavailable
  conversations spend nothing and restore the cursor on rollback.
- **Interrupts and visibility.** Short-act events pass through the same perception,
  knowledge archive and interrupt classifier immediately. An arrival or an
  addressed threat can auto-pause before the hour ends. If an act crosses the
  boundary, its own alerts and that tick's alerts are returned together. Hourly
  event timestamps remain hourly; log order and the command's minute cursor order
  sub-hour actions. Cooldowns remain in hourly world time; command RNG uses the
  hour plus starting cursor so distinct acts do not reuse a draw. Queries consume
  neither draws nor minutes.
- **Persistence and display.** Optional `World.activity.minuteBudgets[actorId]`
  holds `spent`, activity minute totals, and a transient accounting activity during
  settlement. It is absent from untouched simulations and included in world hashes,
  saves and forks. Existing saves without it start with 60 minutes available.
  Command logs add `atMinute`/`endMinute` and advertise `rulesVersion: 2`; explicitly
  versioned v1 replays are rejected because action timing changed. Observations add
  `minuteBudget: { spent, remaining }`; `time.t` stays the hourly world boundary,
  and `elapsedMinutes` reports actual budget consumption. CLI output and the web
  clock show remaining minutes. The worker resumes its countdown from that cursor,
  and all orders continue through `PlaySession`.

The opt-in tactical tenth-second driver remains its separate existing clock;
minute budgeting is disabled in tactical worlds and authored tactical scenarios.
Regional journeys retain their own saved intervals. Future encounter admission
from a partially spent town hour must hand the cursor to the tactical frame; it
must not run a second physiology pass for those minutes.
