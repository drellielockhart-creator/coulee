# Playtest triage: 2026-10-11 regression wave (r2)

**Build:** `5188b00`: wave 4 merged (fae 1a plus fixes, survival plus fixes, play polish, perf pass, web PlaySession).

**Sessions:** 7 Claude personas, all FAIR except edge-case QA. Reports are in `playtests/2026-10-11-r2-*/report.md`.

| Persona | World | Model | Days | Commands |
|---|---|---|---|---|
| Greenhorn | Iron Ford 42 | Haiku | 7.5 | 131 |
| Greenhorn | gen:town 7 | Haiku | 7.3 | 137 |
| Socialite | Iron Ford 42 | Opus | 6.3 | 116 |
| Catalog kid | Iron Ford 42 | Sonnet | 5 | 137 |
| Explorer | gen:town 7 | Sonnet | 8 | 141 |
| Edge-case QA | Iron Ford 42 | Sonnet | 7.3 | 122, plus about a dozen forks |
| Pocket | gen:town 7 | Haiku | 7 | 68 |

**Determinism held:** every session and fork passes `--verify`.

**Harness note:** sibling agents shared one scratch helper script, so about 14 of the catalog kid's read-only queries ran against other sessions. Nothing changed state. Next time each agent keeps its helpers in its own playtest dir.

## Fixed since r1 (confirmed by the personas)
- Social verbs show real words, and gossip carries the rumor.
- The commanded PC never insults, gifts, courts, lends or spends on its own (socialite, edge QA).
- Opinion explains add up (7 checked). Journal grammar about "you" is correct.
- Money lines explain purse changes. The buy/sell spread exists (blanket $3.00 buy, $1.95 sell), and the purse reconciles to the cent with no round-trip arbitrage.
- Parser robustness: menu `-1`/`0`, `wait until 7:30`/nonsense, and bad buy quantities all give clear zero-time refusals.
- Outfitter camping gear (tent, fly, blanket, ground sheet, kettle, axe, lantern, canteens). Multi-night camping works. Partly eaten food loses weight. Staggering slows you.
- Wood and fishing produce goods.
- Death, retire and depart end the session cleanly; `--verify` and `--fork` work afterwards. Neighbors fed a collapsed PC.
- Fae: signs on day 1, timed leads to places, a strong omen and place pair (the spring bell and the church bell).

## Tier 1: blocks the loop

| # | Finding | Who | Cause / pointer |
|---|---|---|---|
| 1 | **No water in the wild.** `drink` is refused at named springs ("No accessible water; fetch water at your lodgings…"). `fetch_water` walks to the tavern. Camp sleep locks out `drink` and `go` for 8 h, which led to near-death twice. A two-week trip is really 1.5 days. | greenhorn-IF, explorer, catalog kid (+ pocket indirectly) | `play/text.ts:312` falls back to a hard-coded refusal. Springs, creeks and rivers aren't water sources in provisions. |
| 2 | **Food readout lies.**<br>• "Food 0.0 days" whenever the eat standing order is off, and transiently otherwise, with 7–21 days in the pack.<br>• A false "Less than one day of food" alarm.<br>• The header uses a different kcal/day than it prints (2142 shown, 2889 used).<br>• Daily need jumps 2142 → 2889 unexplained.<br>• Kit "less than four days" disagrees with both. | all 7 | `provisions` readiness: `daysOfFoodTenths` depends on the standing order. |
| 3 | **Standing orders misbehave.**<br>• **Sleep:** inert for a lodger unless a bed was paid by hand after noon; the PC sat at Rest 0 all night (edge QA B12).<br>• **Eat:** under-feeds (about 870 kcal per 12 h, so "malnourished" by day 3–5). It stalls "at table" for 4 h, burns sugar first, and eats 1,445 kcal in one unannounced event.<br>• **Malnourished** persists at Hunger 1000.<br>• **Access:** `eat pemmican` says "inaccessible" while it's in the kit.<br>• **Purchases:** psyche-mode buys never appear in the kit. | edge QA, socialite, catalog kid, greenhorns, explorer | `provisions/services.ts admitSleep()` needs a command-voiced urge. `psyche/agency.ts` standing urges. |
| 4 | **Social availability is wrong.**<br>• People talking in the room are refused as "at work at Huldra's Shelf until 12:00" (6+ times, fork repro).<br>• False "asleep".<br>• "Already acquainted" with strangers.<br>• "Already courted today" three days later.<br>• "Ambiguous person" given a full name.<br>• `help <person>` prints help.<br>• `aid <present person>` → "Nothing here matches" (4 reports). | socialite, greenhorns, explorer, pocket | `social/availability.ts:35` checks the scheduled block, not the actual activity. |
| 5 | **Waits stop for third-party chatter** every 1–3 h in company (Good day, Slight, Gossip, Comfort, arrivals, favor offers). Stop lines give no reason or date. A quiet place skips 16–24 h in one command. | 5 of 7 | `play/interrupts.ts` |
| 6 | **Fair-mode leaks** (edge QA):<br>• `investigate <guessed id>` answers differently for unnoticed omens ("Go to the sign first" vs "no trace"): a free existence oracle.<br>• `retire` in a fork prints the omniscient epilogue (NPC private defenses).<br>• `explain` uses different refusals for secret vs nonexistent events. | edge QA | `fae/investigate.ts investigationEligibility` checks place before notice. |
| 7 | **Signs:**<br>• Investigating outside the window (a dawn sign at 11:00) costs an hour, prints nothing, and burns the one attempt.<br>• A single permanent roll (about 60%).<br>• A dead end ("points nowhere further") stays an "Open sign" forever.<br>• Description-only omens (glimmer, ash, hearth guest) aren't investigable. | greenhorns, explorer, pocket, socialite | `fae/investigate.ts` |
| 8 | **Survival ETAs are wrong.** "Collapse from starvation in about 367 hours" at Hunger 271 (real: about 9 h). The exhaustion ETA (about 90 h) barely moves. | pocket, greenhorn-IF, greenhorn-g7 | `needs` survival warning |

## Tier 2: legibility, pacing, economy
- **Time costs.**
  - Every action is a whole hour: a "(2 min on foot)" walk costs 60 min, about 18% of an explorer's week.
  - One buy is an hour, so outfitting takes a day.
  - `standing`, `agency`, `rations`, `pack` and `fill` each cost an hour while the usage says "No game time spent". → Decision D1.
- **No income.** Work, tend bar and hold court pay the newcomer $0.00 (5 reports). Money doesn't bind: $3.84 spent in 8 days, and a two-week kit costs under $12. → Decision D2.
- **Requests are opaque.**
  - Favor offers never state the favor or the obligation.
  - Answering takes a typed `answer:28:41:1200:help:yes`, and the options aren't on the default menu.
  - Michael made 5–7 offers a week.
  - Accepted obligations never show in the journal.
- **Phone size.**
  - Every reply repeats the full status block, even "no time passed".
  - `prices` runs 230–330 lines.
  - `inspect` dumps raw JSON (1,432 lines for self).
- **Refusal wording.**
  - "Nothing here matches" covers closed counter, unaffordable, locked, out of stock, partly eaten, and an internal id leak.
  - Double periods ("investigate..").
- **Places.**
  - The Go menu shows only 3–4 hubs.
  - Twins read alike: two Water Streets, three kitchen gardens, two farms, two limestone caps.
  - Coordinates appear in names and in a description ("Ford Smithy stands at (44, 24)").
  - Placeholder text at Pratt's: "A ginseng and fur buyer's trade is a placeholder awaiting consultation."
  - `inspect The Cold Stair` tells a newcomer "A refuge from fae".
- **Social legibility.**
  - You can't see anyone's opinion of you. The base term is unexplained (2 → 22 on courting). → Decision D3.
  - Psyche thoughts lack their object.
  - Blank "(you may: )".
  - "I was short with Joel today" in the journal with no on-screen event (4 reports): is it an act or a thought?
  - The journal says "comforted me" where the screen said "it went badly".
- **Dialogue repetition.** The wolf story came 8+ times from 6 people, and `ask_about` went 0/4 on news.
- **Containers.** Cheese packs into a canteen holding water, and the canteen refills to 1900 ml around it.
- **Load.** Buying has no carry cap (97 kg Staggering bought). `go` then silently fails, while a tavern bed is charged from Pratt's.
- **Stock.** Pratt's staples (cornmeal, pemmican, apples, beans, cheese) are gone in 5 days with no restock seen.
- **Balance.**
  - Bacon dominates (raw-edible, 28k kcal/$, 7.5k kcal/kg).
  - Tinned oysters are a trap.
  - Camping with a blanket is free and beats the $0.25 bed.
  - Foraging gave 0 for 4.
- **Exploits.**
  - A free "ribbon" gift with no ribbon.
  - Courting succeeds on one roll on day 1.
  - Lend plus instant repay farms trust.
- **Menu hazards.** A newcomer is offered "Hold court" and "Keep the tavern" (which lock the menu). `retire`/`depart` sit next to "Wait 1 hour" with no confirmation.
- **Social window.** NPCs work 08–18 and many sleep from 18–20, and the barkeep is "at work until 24:00". Feuds evaporate within the hour ("liar and a cheat", then comfort).

## Strengths to protect
- The journal and defense-mechanism voice:
  - "I shut a door in myself today…"
  - "There is nothing in it. I looked at it from three sides…"
  - "Every dollar owed to Amos Whitcomb is a rope around my neck."
- Overheard dialogue: "Married. Worse than drowned, he says."; "Talk to the cow, most likely."
- Omen and place pairs, timed leads, and huldre cattle at dusk ("Do not follow them.").
- Survival drama and neighbor rescue; deterministic replay and forks.

## Decisions surfaced for Ellie
- **D1. Sub-hour actions.**
  - Today every Command is a whole game-hour, so a 2-minute walk, a single purchase or a settings change all cost 60 minutes.
  - **Recommendation:** an hour has a minute budget. Short acts (a walk under about 15 min, a purchase line, a chat, a settings change) chain within the hour until it's spent; the sim still ticks hourly.
  - Settings changes (`standing`, `agency`, `rations`) cost nothing.
  - This changes ADR 0002's time contract (Command → hour), so it needs an ADR amendment.
- **D2. Newcomer income.**
  - The PC can't earn, and "work" pays only employed actors.
  - **Recommendation:** day labor and hiring on through ordinary social and economy rules (ask an employer for work; daily or weekly wages to the purse; piece rates for wood, fish and furs at the store).
  - This keeps P8 pressure on logistics while giving coin a use.
- **D3. Others' opinions of you.**
  - **Recommendation:** a perception-gated "seems to feel about you" line in `inspect`, with the visible reasons (what you did to them) and a coarse band, never the exact number.

## Fix wave plan (wave 5)
- **A. Provisions, water and standing orders:** Tier 1 #1, #2, #3 and #8, plus containers, load and buying, stock and restock, the bed charge, forage yields, and food balance via existing P8 levers (salt meat raises thirst, monotony).
- **B. Social and play loop:**
  - Tier 1 #4 and #5, plus #6's epilogue and explain parts.
  - Requests legibility, refusal wording, settings at no time cost, phone-size output, and the Go menu's nearest places.
  - Journal vs screen consistency, the gift and courting exploits, lend/borrow pockets, menu hazards, and the social window.
- **C. Fae signs and leaks:** Tier 1 #6 (the investigate oracle) and #7. These go to the fae 1b agent, which owns `fae/`.
- **D. Text and content:** twin place descriptions, coordinates in names, placeholder text, the Cold Stair spoiler, and dialogue pools with teller-owned stories.
