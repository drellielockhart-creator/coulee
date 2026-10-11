# Headless play

`PlaySession.create(content, {source: 'iron_ford', seed: 42, pc: {name: 'Ellis Wayfarer', kit: 'newcomer', lodging: 'tavern'}})` creates a **new** ordinary actor and household before module initialization. `source` also accepts `gen:town` (optional independent `worldSeed`) or `{kind: 'generated', recipe}`. Logs normalize generated sources to a versioned recipe. Neither the base content nor the authored population is mutated.

The public package is pure TypeScript with no IO. `observe('fair' | 'god')`, `act(Command | stableActionId)`, `advance(minutes | {time?, event?, maxMinutes?})`, `save()`, static `load(content, json)`, `fork()`, `commandLog`, `telemetry`, and static `replay(content, log)` are exported. Actions return validation failures without advancing time. Queries are zero-time Commands; other actions occupy an hour because the current core clock is hourly. Activities can lock their duration. Effects of an activity enter the next hourly physiology pass, exactly as in core. An accepted intention can still fail a core check; `warning` reports resource rejection or an unresolved social intention.

`commandLog` is a JSONL header followed by commands with before/after hashes and times. Replay checks each boundary, not only the final hash. Saves include the world, source/PC specification, knowledge history, command log and deterministic telemetry. Forks clone the state and history. Generated-world QA still runs when reconstructing a generated source, so initial creation/load is slower than an authored session.

## CLI

```
just run play --text --scenario iron_ford --seed 42 --log runs/visit
just run play --jsonl --scenario gen:town --seed 7 --world-seed 7
just run play --replay runs/visit/commands.jsonl
```

Text accepts displayed numbers, stable IDs, or verbs (`help`). `actions 1`, `actions 2`, etc. paginate the full catalog. `eat hardtack 2` eats two servings; `cook hardtack soak` uses a feasible preparation with the same fire/fuel/cookware/water kernel as meals and readiness. It prepares and eats, rather than reserving a cooked meal. `drink` consumes accessible water; `activity:fetch_water` performs the core hauling activity. `wait until 08:00` means the next occurrence; event waits such as `wait until social.interaction` default to a one-day cap. All waits remain interruptible. `save FILE`, `load FILE`, and `fork` are host operations; with `--log`, fork also writes a branch-point save. No commit or network operation is involved.

JSONL produces exactly one observation per input line, with a `result` field. Send `"look"` to bootstrap, then a returned stable action ID as a JSON string or a complete core Command from `actions[].command`. Invalid JSON/commands produce an observation with `result.ok: false`. No unsolicited startup line appears in JSON mode. `--god` is explicit in every observation.

The log directory contains `commands.jsonl`, `metrics.jsonl`, and `transcript.txt`. Metrics are **designer telemetry**, not fair PC knowledge: purse/household cash, actual energy expenditure from the needs ledger, intake, personal/household spoilage and vermin losses, opinion deltas toward the PC, transmitted rumors about the PC, defense event IDs, chronicle pattern IDs, deaths when supported, idle and deciding **game minutes**. No wall-clock decision time is invented by the deterministic library.

## Fair knowledge and module gaps

Fair observations project the PC's module views, visible people (name, presented people, activity only), local stock, mapped place names, known event summaries and filtered explanations. Knowledge is recorded during each hour, following PC movement; walking to a place does not reveal its past events. Explain children are independently gated. Fair observations omit remote minds, private traits, the global belief graph, unconscious defenses, and other authors' journals. God mode adds the full view model and belief graph. Returned observations and forks do not expose mutable world references.

Existing leaks isolated by this projection: `toViewModel` lists remote actors and private traits; social views ignore perspective; global belief views expose unknown Figures and world misfortune; chronicle view excludes omniscient entries but otherwise ignores viewer identity. Failed notice checks for another actor’s concealed tells are also omitted (even a failed check label would disclose what was there). Those views themselves remain unchanged for their owners to reconcile. A PC's own known beliefs may legitimately mention concealed ancestry; there is no blanket text censorship.

Psyche and social are stubs in this checkout. `psyche.supplyCommandFallback` supplies only explicit command choices through the existing API, and clears expired fallback choices. A completed psyche pass can replace them normally. It does not invent thoughts, checks, opinion effects, or memories. Social commands return an explicit unresolved warning if no interaction event appears. The chronological journal can therefore remain sparse. The core has no completed death/combat system: survival tests also check hunger/thirst, not just `alive`.

## Cross-module changes and integration

New Commands, declared only in their owners' command files:

- `activity.observe`: look, inspect, plan, journal, explain (shell-handled, no elapsed time).
- `activity.wait`: duration and optional time/event boundary (shell-handled hourly stepping).
- `provisions.sell`: a core transaction for intact goods, limited by store cash, with a `provisions.sale` event and price Explain.
- `provisions.drink`: consumes accessible water through the meal water kernel and emits the existing needs intake events.

Existing `core.urge` supplies movement, rest/sleep/work, and catalog interactions. Existing buy/eat/pack/set_rations Commands are used unchanged. Provisions exposes shared prep/availability/quote/water queries through its API; no host prep math is substituted. Activity keeps an explicit conversational intention at its current venue instead of moving the speaker according to their schedule before social resolves it. Starting kits are a `playStarts` domain in the existing items schema's domain registry (`content/base/play`). The `walk` activity is ordinary content.

For the web orchestrator:

1. Load the content bundle as today; construct a `PlaySession` in the worker with source/seed/PC spec. Retain the existing worker message types where convenient.
2. Pass existing `lib/commands.ts` values to `session.act`. Render `result.observation`; use `actions` for valid affordances and show rejection reasons. Queries are available through observation Commands.
3. Route speed ticks through `advance(60)` and pause on returned interrupts. Exported `alertFor` and `provisionsAlert` in `interrupts.ts` accept already-known events/readiness; the same defaults are available to a staged worker migration.
4. Keep `lib/timePolicy.ts` for sheet/hidden-window speed clamping. Add the real-time three-pauses/30-second coalescer in the host (never suppress Danger), independently of the deterministic event policy.
5. Use `save`/`load` for persistence and preserve mode explicitly. Keep telemetry out of fair UI snapshots. Remove the command-only fallback when the complete psyche implementation handles Commands reliably.

The web app is not rewritten by this slice. Hourly timing, free lodging/domestic supply automation, employment/wages from existing occupation rules, no reserved cooked-meal inventory, and unresolved social effects are current simulation limits, not headless-only rule branches.
