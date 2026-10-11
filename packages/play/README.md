# Headless play

`PlaySession.create(content, {source: 'iron_ford', seed: 42, pc: {name: 'Ellis Wayfarer', kit: 'newcomer', lodging: 'tavern'}})` creates a **new** ordinary actor and household before module initialization. `source` also accepts `gen:town` (optional independent `worldSeed`) or `{kind: 'generated', recipe}`. Logs normalize generated sources to a versioned recipe. Neither the base content nor the authored population is mutated.

The public package is pure TypeScript with no IO. `observe('fair' | 'god')`, `act(Command | stableActionId)`, `advance(minutes | {time?, event?, maxMinutes?})`, `save()`, static `load(content, json)`, `fork()`, `commandLog`, `telemetry`, and static `replay(content, log)` are exported. Actions return validation failures without advancing time. Queries are zero-time Commands; other actions occupy an hour because the current core clock is hourly. Activities can lock their duration. Effects of an activity enter the next hourly physiology pass, exactly as in core. An accepted intention can still fail a core check; `warning` reports resource rejection or an unresolved social intention.

`commandLog` is a JSONL header followed by commands with before/after hashes and times. Replay checks each boundary, not only the final hash. Saves include the world, source/PC specification, compact PC event summaries, interned perspective-gated Explain trees, command log and deterministic telemetry. Forks clone the state and history. Loading restores the world without module initialization; new generated saves also retain prepared source content to avoid regenerating the town and rerunning QA. Older saves remain loadable.

## CLI

```
just run play --text --scenario iron_ford --seed 42 --log runs/visit
just run play --jsonl --scenario gen:town --seed 7 --world-seed 7
just run play --replay runs/visit/commands.jsonl
```

Text accepts displayed numbers, stable IDs, or verbs (`help`). `actions 1`, `actions 2`, etc. paginate the full catalog. `eat hardtack 2` eats two servings; `cook hardtack soak` uses a feasible preparation with the same fire/fuel/cookware/water kernel as meals and readiness. It prepares and eats, rather than reserving a cooked meal. `drink` consumes accessible water; `activity:fetch_water` performs the core hauling activity. `wait until 08:00` means the next occurrence; event waits such as `wait until social.interaction` default to a one-day cap. All waits remain interruptible. `save FILE`, `load FILE`, and `fork` are host operations; with `--log`, fork also writes a branch-point save. No commit or network operation is involved.

JSONL produces exactly one observation per input line, with a `result` field. Send `"look"` to bootstrap, then a returned stable action ID as a JSON string or a complete core Command from `actions[].command`. Invalid JSON/commands produce an observation with `result.ok: false`. No unsolicited startup line appears in JSON mode. `--god` is explicit in every observation.

The log directory contains `commands.jsonl`, `metrics.jsonl`, and `transcript.txt`. Metrics are **designer telemetry**, not fair PC knowledge: purse/household cash, actual energy expenditure from the needs ledger, intake, personal/household spoilage and vermin losses, opinion deltas toward the PC, transmitted rumors about the PC, defense event IDs, chronicle pattern IDs, deaths when supported, idle and deciding **game minutes**. No wall-clock decision time is invented by the deterministic library.

## Playing as an agent

Use stateless sessions when each shell call starts a new process. Run **one command per call**, from the repo root:

```sh
just run play --session runs/my-playtest --new --scenario iron_ford --seed 42
just run play --session runs/my-playtest "go Pratt"
just run play --session runs/my-playtest "buy hardtack 3" # during posted hours
just run play --session runs/my-playtest "plan"
just run play --session runs/my-playtest "explain 123"
just run play --session runs/my-playtest --look
just run play --session runs/my-playtest --fork runs/alternative
just run play --session runs/my-playtest --verify
```

Choose a number from the **previous call's printed menu**, or quote a typed command/stable action ID. `actions 2` shows page 2; the next numbered command uses that page. `help`, `inspect <name>`, `journal`, `wait 2h`, and `wait until 08:00` work as in text mode. `plan` checks provisions; replace `123` with a known event ID printed with an `explain` hint. Queries cost no game time. Waits can stop early on interrupts: read the resulting time and warnings before acting again. `--look` reprints the current observation without recording an action.

Start generated worlds with `--scenario gen:town --seed 7 --world-seed 9`. Fair mode is the default; `--god` at creation persists for all later calls. Report your mode. Exit codes: **0** success, **2** invalid command (reason and current menu; no world change), **1** internal error.

The directory holds `session.json` (world source, seed, PC spec, mode), atomic `save.json` (world and previous menu), `commands.jsonl`, `metrics.jsonl`, and `transcript.txt`. Accepted Commands append to the replay log; help/menu pagination record a zero-time look. Invalid attempts appear only in the transcript; metrics append when game time advances. Use `--fork` before testing alternatives; its destination must be new or empty. `--verify` reconstructs the initial world and replays every accepted command, checking the final saved hash. Attach these files to bug reports; use `just run play --replay runs/my-playtest/commands.jsonl` (add `--god` for god logs) for independent reproduction.

## Fair knowledge

Fair observations project the PC's module views, visible people (name, presented people, activity only), local stock, mapped place names, known event summaries and filtered explanations. Knowledge is recorded during each hour, following PC movement; walking to a place does not reveal its past events. Explain children are independently gated. Fair observations omit remote minds, private traits, the global belief graph, unconscious defenses, and other authors' journals. God mode adds the full view model and belief graph. Returned observations and forks do not expose mutable world references.

Perspective gating also lives in the core module views, so the web and other hosts receive the same protection: remote actors and private traits are omitted, other minds and unheard beliefs are hidden, global Figures require a known proposition, private journals require their author, and Explain children are independently gated. Failed concealed-tell checks are omniscient at their source. Play retains its stricter projection.

Psyche and social use their integrated implementations. Commands enter ordinary psyche arbitration and take precedence; Appetite and Conscience show actual thoughts and Self-Command shows the chosen verdict. Introduce, chat, gossip, ask about, insult and apologize resolve through social checks, memories and opinion reasons. `ask about Nora` asks Nora to share news; `gossip Nora` tells her yours. Some interactions require acquaintance or a prior offense, and targets can leave or sleep before the hourly social pass.

PC knowledge survives the rolling world log: events are captured by increasing event id, with only known summaries and explanations archived. Repeated Explain subtrees are interned in saves; world payloads and other minds are not copied. `explain <id>` remains available after trimming, `journal` returns the full known chronicle, and observations include remembered rumors. Old saves recover only knowledge still present in their retained world log. The core still lacks completed death/combat rules; survival tests check hunger and thirst too.

## Shops and board

`content/base/provisions/services.toml` supplies venue-tagged hours and prices for authored and generated towns. General stores trade from 06:00 to 21:00; tavern meal service runs 06:00–23:00. `meal` buys food from the host's real pantry and cooking resources for 20 cents. Sleeping at a tavern charges 25 cents once for access through the next noon; the host household uses its own beds. Charges move actual money to the host. NPCs use the same transaction and bed rules. Carried food can still be eaten normally. Domestic water/fuel hauling and occupation wages remain automatic.

## Cross-module changes and integration

New Commands, declared only in their owners' command files:

- `activity.observe`: look, inspect, plan, journal, explain (shell-handled, no elapsed time).
- `activity.wait`: duration and optional time/event boundary (shell-handled hourly stepping).
- `provisions.sell`: a core transaction for intact goods, limited by store cash, with a `provisions.sale` event and price Explain.
- `provisions.board_meal`: purchases a tavern meal through the same pantry/preparation kernel.
- `provisions.drink`: consumes accessible water through the meal water kernel and emits the existing needs intake events.

Existing `core.urge` supplies movement, rest/sleep/work, and catalog interactions. Existing buy/eat/pack/set_rations Commands are used unchanged. Provisions exposes shared prep/availability/quote/water queries through its API; no host prep math is substituted. Activity keeps an explicit conversational intention at its current venue instead of moving the speaker according to their schedule before social resolves it. Starting kits are a `playStarts` domain in the existing items schema's domain registry (`content/base/play`). The `walk` activity is ordinary content.

For the web orchestrator:

1. Load the content bundle as today; construct a `PlaySession` in the worker with source/seed/PC spec. Retain the existing worker message types where convenient.
2. Pass existing `lib/commands.ts` values to `session.act`. Render `result.observation`; use `actions` for valid affordances and show rejection reasons. Queries are available through observation Commands.
3. Route speed ticks through `advance(60)` and pause on returned interrupts. Exported `alertFor` and `provisionsAlert` in `interrupts.ts` accept already-known events/readiness; the same defaults are available to a staged worker migration.
4. Keep `lib/timePolicy.ts` for sheet/hidden-window speed clamping. Add the real-time three-pauses/30-second coalescer in the host (never suppress Danger), independently of the deterministic event policy.
5. Use `save`/`load` for persistence and preserve mode explicitly. Keep telemetry out of fair UI snapshots. The merged psyche implementation handles Commands directly; no fallback is used.

The web app is not rewritten by this slice. Hourly timing, domestic supply automation, employment/wages from existing occupation rules, and no reserved cooked-meal inventory remain current simulation limits.
