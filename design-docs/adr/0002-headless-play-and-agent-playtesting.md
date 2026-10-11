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
- A session is fully defined by **scenario + seed + command log**. Every playtest report attaches its command log, so any bug or story can be replayed exactly (`coulee play --replay log.jsonl`).
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
