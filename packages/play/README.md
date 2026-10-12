# Headless play

`PlaySession.create(content, {source: 'iron_ford', seed: 42, pc: {name: 'Ellis Wayfarer', kit: 'newcomer', lodging: 'tavern'}})` creates a **new** ordinary actor and household before module initialization. `source` also accepts `gen:town` (optional independent `worldSeed`) or `{kind: 'generated', recipe}`. Logs normalize generated sources to a versioned recipe. Neither the base content nor the authored population is mutated.

The public package is pure TypeScript with no IO. `observe('fair' | 'god')`, `act(Command | stableActionId)`, `advance(minutes | {time?, event?, maxMinutes?})`, `save()`, static `load(content, json)`, `fork()`, `commandLog`, `telemetry`, and static `replay(content, log)` are exported. Actions return validation failures without advancing time. Queries are zero-time Commands; other actions occupy an hour because the current core clock is hourly. Activities can lock their duration. Effects of an activity enter the next hourly physiology pass, exactly as in core. An accepted intention can still fail a core check; `warning` reports resource rejection. Unavailable social intentions are rejected without advancing time, including a rollback if the target becomes unavailable during the hourly pass.

`commandLog` is a JSONL header followed by commands with before/after hashes and times. Replay checks each boundary, not only the final hash. Saves include the world, source/PC specification, compact PC event summaries, interned perspective-gated Explain trees, command log and deterministic telemetry. Forks clone the state and history. Loading restores the world without module initialization; new generated saves also retain prepared source content to avoid regenerating the town and rerunning QA. Older saves remain loadable.

## CLI

```
just run play --text --scenario iron_ford --seed 42 --log runs/visit
just run play --jsonl --scenario gen:town --seed 7 --world-seed 7
just run play --replay runs/visit/commands.jsonl
```

Text accepts displayed numbers, stable IDs, or verbs (`help`). `actions 1`, `actions 2`, etc. paginate the full catalog. `eat hardtack 2` eats two servings; `cook hardtack soak` uses a feasible preparation with the same fire/fuel/cookware/water kernel as meals and readiness. It prepares and eats, rather than reserving a cooked meal. `drink` consumes accessible water; `activity:fetch_water` performs the core hauling activity. `wait until 08:00` means the next occurrence; event waits such as `wait until social.interaction` default to a one-day cap. Named boundaries are dawn (06:00), morning (08:00), noon (12:00), dusk (18:00), night (21:00), and tomorrow (next midnight). Unknown targets and fractional hours are rejected. Event targets are limited to social.interaction, belief.transmitted, provisions.wages, and activity.gathering. All waits remain interruptible, but only by what needs an answer (a request) or changes her situation (danger, a blow aimed at her, a worsening need, her own arrival somewhere). Talk among others, arrivals and even brawls between others never stop a wait; what is said or done to her that asks nothing of her goes to the digest (`To you:`). `save FILE`, `load FILE`, and `fork` are host operations; with `--log`, fork also writes a branch-point save. No commit or network operation is involved.

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

Start generated worlds with `--scenario gen:town --seed 7 --world-seed 9`. Fair mode is the default; `--god` at creation persists for all later calls. Report your mode. Exit codes: **0** success, **2** invalid command (one line: the reason and "No game time spent."; no world change, and the menu last shown still applies), **1** internal error.

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
- `provisions.empty`: pours one water vessel out (`empty <vessel>`, menu id `empty:<item>`; one game-hour, like `fill`). Water weighs 1 g/ml, so `provisions.refill` (and the standing drink order's automatic refilling) stops at the load she can still move with (150% of capacity): a fill past that is trimmed, said aloud (`provisions.refilled.shortMl`), and refused outright when nothing is left to spare. A `drink` is offered whenever any water is to hand, as `min(500, available)` ml with the amount in its label.

Existing `core.urge` supplies movement, rest/sleep/work, and catalog interactions. Existing buy/eat/pack/set_rations Commands are used unchanged. Provisions exposes shared prep/availability/quote/water queries through its API; no host prep math is substituted. Activity keeps an explicit conversational intention at its current venue instead of moving the speaker according to their schedule before social resolves it. Starting kits are a `playStarts` domain in the existing items schema's domain registry (`content/base/play`). The `walk` activity is ordinary content.

For the web orchestrator:

1. Load the content bundle as today; construct a `PlaySession` in the worker with source/seed/PC spec. Retain the existing worker message types where convenient.
2. Pass existing `lib/commands.ts` values to `session.act`. Render `result.observation`; use `actions` for valid affordances and show rejection reasons. Queries are available through observation Commands.
3. Route speed ticks through `advance(60)` and pause on returned interrupts. Exported `alertFor` and `provisionsAlert` in `interrupts.ts` accept already-known events/readiness; the same defaults are available to a staged worker migration.
4. Keep `lib/timePolicy.ts` for sheet/hidden-window speed clamping. Add the real-time three-pauses/30-second coalescer in the host (never suppress Danger), independently of the deterministic event policy.
5. Use `save`/`load` for persistence and preserve mode explicitly. Keep telemetry out of fair UI snapshots. The merged psyche implementation handles Commands directly; no fallback is used.

The web app is not rewritten by this slice. Hourly timing, domestic supply automation, employment/wages from existing occupation rules, and no reserved cooked-meal inventory remain current simulation limits.

## Agency and observation (2026-10-11 playtest fixes)

New PCs default to `pc.agencyMode: 'commanded'`. Any actor can have this sheet policy; an absent field means `psyche` and leaves legacy NPC state hashes unchanged. Scenario data uses optional `agency_mode` and `standing_orders`. `core.standing_orders` carries `{agencyMode?, orders: {sleep, eat, drink, warmth, lodging, activities}}`; `activities` is a list of explicitly permitted activity ids. The text shell offers `agency commanded|psyche` and `standing <sleep|eat|drink|warmth|lodging> on|off`. Standing orders persist across saves and forks. Consequential interaction urges remain advisory, with frustration/anxiety intact. Household errands, spontaneous encounters, defense acts, mediation, retaliation and unsolicited lending respect the policy. Paid board requires an explicit order; standing sleep can use already-paid lodging or free shelter.

`prices` shows grouped local stock, `inspect` renders known people and item facts, and session `places 1`, `places 2` paginate all mapped destinations. Place prose comes from authored/worldgen content. Own opinion reasons show current weighted contributions, base and immediate mood, with clamp bounds. Other minds remain hidden.

Session `--compact` persists a display preference and omits unchanged lines; explicit `look` and menu pages print in full. Observations add `self.provisions.householdCents`, `self.agencyMode`, `self.standingOrders`, `place.description`, `knownPeople`, `interactionVerbs`, and `changes` (elapsed minutes, need bands, notable events, coalesced conversation count, and money entries). Money entries contain signed purse/household cents, event id/time and the transaction reason. The observer captures financial events as they are emitted, independently of the rolling log. Queries and failed commands cost no time. Session help excludes REPL-only save/load/fork/quit verbs.

`social.interactionAvailability(world, content, actorId, targetId, interactionId)` is the shared menu/validation preflight. Explicit conversations reserve both participants before movement and resolve before spontaneous encounters. The activity reservation and social command priority are necessary to close the within-hour race between an offered action and its execution.

## Play-loop polish (wave 3)

- **Walking arrives.** A trip takes its site-grid distance at 264 ft/min (`activity.walkMinutes`), slowed by the load (`movementDelay(..., baseMinutes)`), and a trip that fits in the hour is simply done: `go Pratt` shows Pratt at once, with `activity.moved.minutes` ("You arrive at … (2 min on foot)"). A longer trip leaves the PC on the road; the status line reads "on the road to X, about N min more" and the observation carries `self.activity.travelingTo`/`arriveAt`. Iron Ford's map is 640 × 480 ft, so every hop in it is a few minutes; roads between sites are an hour.
- **Her own words first.** `observation.said` ranks the PC's own exchange first (she spoke), then what was said to her, then news she was told, then overheard talk. An act with no composed words prints "Nothing worth repeating is said." `KnownEvent` gains `speakerId`/`hearerId`.
- **Plain English everywhere.** `describe.ts` (`describeEvent`, `moneyReason`) tells every event the player can see in a sentence ("You are getting peckish", "You lie down to sleep", "You arrive at …"); routine bookkeeping (arbitrations, drinks, activity changes she did not order) is flagged `routine` and left out of the event list. `Interrupt.reason` is now the sentence and `Interrupt.kind` the machine key. A wait cut short reports `ActResult.stopped` ("Wait stopped at 02:00 (you meant to wait until 07:00)"); `ActResult.notice` confirms packing. The `Self-Command` line carries the id to `explain`.
- **Camping with the ordinary verbs.** `items.campContext` says whether an actor stands on open ground (field, outdoor, wild) that is not her lodgings and carries bedding. Then the offered `activity:sleep` is the camp bed on the spot (`Make camp and sleep here`), `rest` rests where she stands, and the camp activities appear. For a held actor the standing sleep order beds down in place, the standing meal is eaten from her pack, and the lodging order's walk home applies only in town. No bedding: nothing is offered that walks her to a paid bed unasked.
- **Money moves only on her order.** A held actor's lending, borrowing or repaying runs only when the arbitration was a command (`social/system.ts`). Debts become `self.obligations` (creditor, cents, due date: the chronicle's `overdue_days` after the loan), a line in the status when due within a week or overdue, an entry at the end of `journal`, and, once due, a Conscience duty thought ("Pay what you owe …") for a held actor.
- Smaller: `pack X into Y` reads its direction; ambiguous orders list names and prices; bare `buy`/`sell` explain themselves; infants are not offered a chat; "Heard:" lists on a `look`, not every turn.

## Social and play loop (wave 5, r2 playtest fixes)

- **Availability reads what people do, not their schedule.** `social.interactionAvailability` refuses "asleep" only for the actually asleep (before anyone's first hour, the schedule stands in), names where a traveller is going, and treats someone at work (a `labor` activity) by `social_tuning.work_talk_minutes`: a short exchange (15 minutes or less: a greeting, a chat, settling up, the news) can be had while they keep working; a longer one is refused until the work block ends. Work at least `work_talk_sociability` sociable (keeping the tavern, the shop) is done while talking, with no limit and no cost. A deliberate exchange that holds someone at, or due at, less sociable work adds a `kept_from_work` Reason to their opinion (it cites their memory of the talk, so it fades) and marks the event `atWork`. Structural refusals are sentences ("You have already met Joel Pike", "You owe Amos Whitcomb nothing"); a cooldown names when it ends.
- **Requests state their terms.** `social.requested` and `PendingRequest` carry the ask, what a yes undertakes (money, favors, due date) and when it lapses (`social.requestTerms`). Answers are numbered first on the menu and typed as `yes` / `no` (`yes Michael` when several are open). The asker waits `request_cooldown_hours` before asking again, longer after a refusal or silence. Favors owed and what others owe her are listed in the journal and on `inspect`.
- **Waits.** See the interrupt policy above. A stop line always says when (with the day) and why.
- **Settings take no time.** `core.standing_orders` and `provisions.set_rations` are applied at once (`psyche.applyStandingOrders`, `provisions.applyRations`), logged as zero-time commands, and replay the same way. Bare `standing`, `agency` and `rations` print the current settings.
- **Phone-size output.** A reply that took no time is the answer and one line (`No time passed (…)`); refusals are one line; `prices` pages 20 lines (`prices 2`, `prices bacon`); `inspect me` and containers read as sentences; the Go entries are the nearest eight places (public ones first among equals) with minutes on foot. `retire` and `depart` ask for `confirm`, by name or number.
- **Specific refusals.** Buy, sell, go, sleep/rest/work and pack orders that are not on offer still reach the game, which says why: the counter is closed (with its hours), the goods are sold out or broken open, too dear (with the purse), the store cannot pay, the hour is still held (until when), the work is not her trade, the container is full.
- **Fair endings.** A story that has been forked (in either line) ends with the fair epilogue only; `--god` reads the county's secrets. `explain` gives one refusal for a secret id and a missing one.
- **Talk.** A speaker does not repeat a line to anyone for three days while another fits (the pair-week and room windows still come first). Asked for the news (`ask_about`), anyone holding tellable news tells some of it (belief `asked`). Chat price lines quote the store the town shops at.

- **Exploits closed.** A gift hands over one real item (`requires.gift_item`, `give_item`; the owned item nearest `gift_value_cents` from the giver's kit, else their household's stores), or there is no gift. Court needs the target to know the asker (`requires.target_min_familiarity`) and fails outright below the target's regard (`check.min_regard`, explained). A money debt repaid within `repay_trust_min_hours` earns the lender no trust. Loans and repayments move purse to purse (`transferCash` pocket `'purse'`).
