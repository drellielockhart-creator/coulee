# Coulee R2 regression playtest: edge-case QA / economy audit, Iron Ford seed 42

The Write tool refused to create `report.md`: "Subagents should return findings as text, not write report files." Per the brief's fallback, the full report is below. Running notes are in `/home/eleanor/projects/coulee/playtests/2026-10-11-r2-edgeqa-ironford42/notes.md`.

Paths below are under `/home/eleanor/projects/coulee/playtests/2026-10-11-r2-edgeqa-ironford42/`. "Command index N" means line N+1 of `<session>/commands.jsonl` (line 1 is the header). Refused or no-time probes are not logged, so I quote their input and output. Labels: **[FAIR]** found by fair play, **[SRC]** I read source, **[GOD]** used a `--god` session.

## Top findings and verdicts (the short version)

**Top 5 findings**
1. **HIGH, B12.** The default standing "sleep" order never puts a lodger to bed. The PC sits awake at Rest 0 all night unless the player has already paid the bed by hand after noon. It reproduces in a clean `fresh/` session.
2. **MED, B7, fair-mode leak.** `investigate 1:0:dawn` returns "Go to the sign or its lead first.", while `1:5:dawn` returns "That sign has left no trace to investigate." That reveals unnoticed omens by place and time.
3. **MED, B10, fair-mode leak.** `retire` in a `--fork` prints an omniscient "Epilogue: what the county never knew" with NPCs' private psychology.
4. **MED, B4.** `standing eat off` makes the status line read "Food 0.0 days" with 16,856 kcal in the pack, and fires a false "Less than one day of food or cooking fuel remains."
5. **MED, B2/B13.** `agency` and `standing` toggles each cost a game hour although the usage line says "No game time spent." "Nothing here matches X" is reused for six different refusals.

**Regression checklist**
- -1 or 0 as a menu number: FIXED ("No such menu number. No game time spent.").
- `wait until 7:30` and `wait until nonsense`: FIXED.
- Buy quantities 0, negative, over stock: FIXED.
- Help listing dead commands: FIXED (only a minor wart).
- Round-trip arbitrage and the zero-spread blanket: FIXED (buy $3.00, sell $1.95).
- Fair-mode leaks: STILL BROKEN (B7, B8, B10).
- Debt, courtship or payment without order: FIXED for what I could trigger. COULDN'T TELL for loans, since none were ever offered.
- Death and endings: FIXED.

---

# Full report

## 1. Persona, world, mode, days, commands
- Persona: edge-case QA tester and economy auditor.
- World: Iron Ford, seed 42. PC "Ellis Wayfarer" is a human newcomer lodging at Dunleavy's Tavern with $50.00.
- Main session `session/`: FAIR, commanded agency. It ran 1855-04-01 00:00 to 04-08 08:00, which is 7.3 days. It has 122 logged commands, about 165 CLI calls counting refused probes. `--verify` gives "Verified 122 commands; final hash d9576a7dfc3a7da9".
- Throwaway dirs: `fresh/` (clean FAIR), `god/` (GOD), and about a dozen forks (`fork-econ`, `fork-death`, `fork-req`, `fork-act`, `fork-camp`, `fork-psy`, `fork-retire`, `fork-v2`, `fork-verbs` and others). They took about 170 more calls, including about 50 malformed inputs and the wait loops to collapse and death.
- **Budget note:** total calls exceeded the nominal 200. The main line itself stayed under it.
- Source I read [SRC], to design tests or find causes:
  - `provisions/api.ts` (saleQuote)
  - `provisions/services.ts` (admitSleep)
  - `psyche/agency.ts` and `psyche/system.ts` (standing orders)
  - `fae/investigate.ts`
  - `play/src/interrupts.ts`
  - `fae/omens.toml`
  - `scenarios/iron_ford/20-actors-slopes.toml` (Edwin and Hester Fenn are concealed shadow-faekin)
- **Disclosure:** while grepping for "wage" I opened `content/base/provisions/PLAYTEST-FIXES.md`. It is a fix-notes file, not a player report, but I saw it. I did not read any `playtests/` reports.

## 2. Summary
I broke the game as a system: money model, parser, fair-mode leaks, collapse and death, and save/fork/verify consistency.

The economy is sound. Resale is capped at 65% of base value and at the lowest retail price minus 1 cent, so round trips lose money. The main purse reconciles to the cent: $50.00 − 8 beds × $0.25 − whiskey round trip $0.14 − meal $0.20 − coffee $0.70 − hardtack $0.80 = $46.16. The parser is largely FIXED. Death, retire and depart end the session cleanly, and `--verify` and `--fork` still work afterwards.

The real problems:
- The default standing orders do not actually look after a lodger's sleep.
- Fair mode still leaks hidden state through refusal wording and the fork epilogue.
- Several meta commands burn game time silently.
- The PC has no income, and staple stock vanishes in 5 days.

## 3. Fun moments (verbatim)
- "The Sabbath under a full moon; the evening service will want no lantern. Rain in the evening."
- "At Dunleavy's Tavern: The broom leans bristles upward against the shut door. I would like to know what made it." Investigating gave "You find where the trace ends. It points nowhere further."
- `Nora Dunleavy: “Married. Worse than drowned, he says.”`
- `Hester Fenn: “So there I was, alone on the bluff, with the wolves all round...”` then `Amos Whitcomb: “You told it different last week. There were fewer wolves.”`
- `Lydia Pratt: “I hear salt-cured bacon / side pork is 14 cents the pound at Dunleavy's Tavern.”` (it is $0.12 at Pratt's)
- "**A Poor Aim at Pratt & Daughter, Outfitters** ... misjudged the room. The laugh, we hear, went the other way." and "**The Brenner-Fenn Difficulty** It must now be called a feud."
- "You have collapsed. You cannot act; someone must bring water, food and shelter." Neighbors came: "You ate Dried apples, Hardtack (ship's biscuit), Pemmican: 1011 kcal, cold".
- Diary: "I shut a door in myself today. I cannot say which, only that the house is quieter." and "A person can learn a good deal about the world from the floor of an empty belly."
- "Tuesday, the 3rd of April, 1855. The full moon, which the Norwegians watch and the Cornish do not discuss."
- "Michael Dunleavy offers a favor with an obligation. Answer within the hour; silence means no answer."

## 4. Confusion
- "Nothing here matches “X”; try look, prices, places or actions." answers six different situations (B13).
- `standing` and `agency` with no argument print usage only, so you cannot view the current orders. The only view is `inspect <own name>`, which dumps JSON (B9).
- `wait until morning` means 08:00, but the counter opens at 06:00.
- Waits are chopped by standing-order events, so one line of waiting often takes 3 to 8 commands.
- "Wait stopped at 15:00 (you meant to wait until 14:00)". The target has no date, so it looks like an overshoot.
- A 2 to 3 minute walk ("You arrive at Pratt & Daughter, Outfitters (2 min on foot)") costs a whole game hour. `pack`, `unpack`, `rations` and `agency` also cost an hour.
- The default menu is a 17-item shortlist. `actions 1` starts with 37 "Inspect <place>" lines, and the numbers differ between the two views.
- "Open sign: The broom leans bristles upward ... (investigate 4:0:dawn)" shows at Pratt's, far from the tavern. Investigating from there is refused.
- "Retire from this life [retire]" and "Depart from the coulee [depart]" sit next to "Wait 1 hour" in the action list. One mistyped menu number ends the character with no confirmation.
- `buy beans 5` bought 5 "Coffee, green beans" for $0.70 with no "Which one?". "Beans, dry" had sold out, so only the coffee matched. `buy blanket` does ask.

## 5. Boredom
- Rest falls about 60/h awake, so the main line became a loop of `sleep`, `wait until 08:00` (two to four interrupts), `wait`, `sleep`.
- A newcomer cannot earn money, so after day 2 there is nothing to optimise.
- Four production attempts in early April all gave "You gathered nothing" (fish ×2, forage ×1, gather wood ×1).

## 6. Bugs
Severity: H high, M medium, L low.

**B12 (H, gameplay). The standing "sleep" order is inert for a lodger unless a bed was paid by hand after noon.**
- Observed in `fresh/` with no `agency` or `standing` commands. From 00:00 Apr 1, `wait until 21:00` then `wait until 07:00` gave Rest 0 at 18:00. At the end: `1855-04-02 06:00 ... Vitals: Hunger 306 (Peckish); Rest 0 (Exhausted)`, PC "at home, at leisure" all night.
- Also in the main session on the nights of Apr 2 and Apr 3 (command indices 66 to 70 and 75 to 81).
- Expected: with `standing sleep on` and Rest < 750 at night, the PC goes to bed.
- Actual: it idles. The only hint is "Appetite: Weary: a bed would be welcome (held for your order; you may: sleep)".
- It works only after a manual `sleep` paid after noon. Main index 87 (Apr 4 16:00) then index 88 gave "[10856] You lie down to sleep" and Rest 886 at 03:00.
- Cause [SRC]: `provisions/services.ts` `admitSleep()` refuses to pay unless the chosen urge is a command. A bed paid before noon lasts only until that noon.
- Repro: `fresh/`, `--verify` "Verified 14 commands; final hash 14668d63a530a378".

**B7 (M, FAIR LEAK). `investigate <id>` is an existence oracle for omens the character never noticed.**
- Main session, tavern, 1855-04-01 16:00:
  - `investigate 1:0:dawn` gives "Go to the sign or its lead first.. No game time spent."
  - `investigate 10:0:dawn` gives the same text.
  - `1:5:dawn`, `2:0:dawn`, `3:0:dawn`, `9:0:dawn` and others give "That sign has left no trace to investigate.."
- So the player learns hidden signs exist at place 1 (Brenner House) and place 10 (Glover Barn). Ids are guessable as `place:index:window`, and each probe is free.
- [GOD] The god journal has "06:00 Correspondents mention Brenner House. Three tools lie with their handles pointing to the threshold." The fair journal correctly omits it.
- Cause [SRC]: `investigationEligibility()` checks `a.placeId !== e.snapshot.placeId` before the noticed check.
- Repro: `session/`, `--verify` d9576a7dfc3a7da9.

**B4 (M). `standing eat off` gives "Food 0.0 days" and a false alert.**
- `fork-death/` index 31. Before: "Food 6.0 days". After: "Food 0.0 days; Medium, 32.1 kg", and `plan` says "Food 0.0 days; 16856 usable kcal / 2142 kcal per day". It also fires "Less than one day of food or cooking fuel remains."
- Expected: about 7.9 days.
- Repro: `fork-death/`, `--verify` "Verified 64 commands; final hash 1e60d3c499ae95be".

**B10 (M, FAIR LEAK). `retire` in a fork prints an omniscient epilogue of NPC inner psychology.**
- `fork-retire2/`, forked from main at day 8: "Epilogue: what the county never knew ... Nobody in the story had this. ... Johanne Moe could not bear a thing in her own heart and found it, quite sincerely, in Lydia Pratt." and "Ezra Sloat was not well, and said otherwise."
- A player can fork, retire, read private defenses of people the PC has not met, then keep playing the original.
- In 8 days it never named a fae identity, so I rate it M. Death prints it too.

**B2 / B3 / B11 (M/L). Meta commands cost an hour, though the usage text says "No game time spent."**
- `agency commanded` at main index 18 (`at 480, end 540`). It also re-asserts all standing orders as true.
- Each `standing <x> on|off` is an hour (`fork-death` indices 30 to 34, `fork-camp` indices 89 to 93).
- `rations 100` is an hour; `rations 5` and `rations 151` are refused without time.
- Switching everything off takes 5 hours.

**B13 (M, UX). "Nothing here matches" covers many different refusals.**
1. Closed counter: `buy eggs 1` at 00:00, though `prices` lists eggs.
2. Unaffordable item: `buy cuirass 1` with $17.06 against a $20.00 item in stock (`fork-econ`).
3. Locked activity: `go Pratt` and `sleep` while "sitting in judgment" (`fork-act`). The right wording, "Your current activity is still locked.", already exists for interactions.
4. Out of stock: `buy cornmeal 10`.
5. Partial goods: `sell hardtack 999` after hardtack was partly eaten.
6. `rest` while locked leaks an internal id: "Nothing here matches “activity:idle_at_home”".

**B15 (M). A Staggering PC silently fails to walk, yet a paid bed is still charged.**
- `fork-econ` index 36: `buy cornmeal 150` gives "Load: 97250 g; bulk 146.5; Staggering". Buying has no carry cap.
- Index 52: `go East Bluff` spends an hour and the PC stays at Pratt's with no message.
- Index 53: `sleep` prints "You paid Michael Dunleavy $0.25 (Tavern bed)" while still at Pratt's, Rest still 0.
- Repro: `fork-econ/`, `--verify` "Verified 53 commands; final hash 3640adee159aa37a".

**B9 (L/M). `inspect Ellis Wayfarer` dumps a 1,432-line raw JSON actor record** (needs, thoughts, opinions, inventory, `"obligations": []`). `inspect me` is rejected. Repro: main index 41.

**B5 (L, content).** Pratt's place text includes "A ginseng and fur buyer's trade is a placeholder awaiting consultation."

**B1 (L).** `signs` with nothing to show prints "No journal entries known yet." (indices 4 and 6).

**B6 (L).** "You are malnourished after a week of poor eating" fires on day 3 (`fork-death`, event 8381, 1855-04-04).

**B8 (L, FAIR LEAK).** `explain <id>` says "That explanation is not known to your character." for a secret event that exists, and "No known explanation with that id." for one that does not. Repro: main `explain 1573` vs `explain 1800`.

**B14 (L).** A newcomer can pick "Hold court" ("sitting in judgment") and "Keep the tavern". Hold court locks the menu to look, signs, plan, journal, drink, wait and eat for about 2 hours (`fork-act`).

**B16 (L).** Wording and typos:
- Double periods: "Supply exactly one nonempty command line.." and "That sign has left no trace to investigate.."
- `places 0` says "Use actions <page>...".
- `buy whiskey 99999999999999999999` says "Quantity must be a positive whole number."
- `eat hardtack 0` and `explain abc` both give a generic "Action is unavailable..."

**B17 (L).** Accepting a favor makes the journal say "Entered here so I do not forget the debt.", but the journal and the `inspect` obligations list stay empty, though help says "journal (lists what you owe)". Possibly intended (`fork-req`).

## 7. Exploits
Looked for and not found:
- **Round trips.** Blocked [SRC]: `saleQuote` = min(retail − 1¢, lowestRetail − 1¢, floor(value × 65%)). Measured:
  - Blanket $3.00 buy, $1.95 sell.
  - Whiskey $0.30 at the tavern, $0.16 sell (Pratt's retail is $0.25).
  - Firewood $0.02 buy, $0.01 sell.
  - Knapsack sells for $0.97, kettle for $0.48.
  - No cross-store arbitrage.
- **Money from nowhere.** The main purse reconciles exactly (see Summary).
- **Wages.** Work, tend bar and hold court all paid $0.00.
- **Eating or selling what you lack.** `eat dried apples 99` gives "No available food/preparation matches"; `sell firewood 99` gives "Quantity exceeds available stock".
- **Store credit.** The buy command carries `onCredit: false`. No unpaid credit was observed.

Found:
- **Free hidden-state information** (B7 plus B10): free existence checks on hidden omens, and an NPC-psychology readout via fork + retire.
- **Dominant strategy.** Camping with a blanket is free and beats the $0.25 bed.

## 8. Balance notes (numbers)
- **Start:** $50.00; 17,499 usable kcal (6.0 days) against 2,142 kcal/day.
- **Spend:** $3.84 over 8 days, about $0.48/day, so $50 lasts about 100 days. A tavern meal is $0.20 for about 1,011 kcal.
- **Income: none.** Eight working hours (index 48 plus the `wait 8h`) left the purse at $49.36. Wages go only to employed actors [SRC]. A newcomer cannot earn.
- **Food is nearly free.** Cornmeal is $0.03, hardtack $0.08, pemmican $0.30 (2,900 kcal/lb).
- **Unexplained kcal change:** the plan said 2,142 kcal/day on day 1 and 2,889 on day 6 (+35%) with no change by me.
- **Staples vanish.** Pratt's stock on day 1 vs Apr 6 10:00, with none of it bought by me: Cornmeal 150 → 0, Pemmican 24 → 0, Dried apples 30 → 0, Beans, dry 60 → 0, Cheese 25 → 0, Flour 300 → 157, Bacon 80 → 71, Lard oil 20 → 10. No restock was seen.
- **Camping beats the bed.** `fork-camp`: 7 hours at East Bluff with a blanket took Rest 9 → 684, Warmth 1000 at 35°F, no fee.
- **Rest decay:** about 60/h awake, about 123/h working. Rest hits 0 after about 15 hours awake.
- **Survival timing:** `fork-camp` with all standing orders off: Thirst 236 at 04:00 Apr 5, collapse at 08:00 Apr 6, "This life has ended: death — thirst." at 00:00 Apr 7. That is about 44 hours from parched to dead. At Pratt's (`fork-death`) neighbors fed and watered the PC, so no death.
- **Load:** 97 kg "Staggering" is purchasable, and armor too (Mail shirt $30 on day 1, `fork-econ` index 49).

## 9. Regression checklist
- **-1 or 0 as a menu number:** FIXED. Main: `0` and `-1` both give "No such menu number. No game time spent." The same for `99999` and `-5`.
- **`wait until 7:30`:** FIXED. "Unknown wait target; use HH:00, dawn, morning, noon, dusk, night or tomorrow (whole hours only). No game time spent." The same for `wait until nonsense`; `wait until 25:00` gives "Hour must be 0–23."; `wait 400d` gives "Wait uses whole hours, at most 30 days. No game time spent."
- **Buy quantities 0, negative, over stock:** FIXED. "Quantity must be a positive whole number." and "Quantity exceeds available stock."
- **Session-mode help listing dead commands:** FIXED. I exercised `cook`, `rest`, `depart`, `retire`, `pack`, `unpack`, `rations`, `agency`, `standing`, `aid`, `investigate` and `insult Joel Pike`. Each is accepted or refused with a reason. The wart is B13 item 6.
- **Round trip and zero-spread blanket:** FIXED. Blanket $3.00 buy, "Sold 1 Blanket, wool, 3-point for $1.95".
- **Fair-mode leaks:** STILL BROKEN.
  - B7, B8 and B10 above.
  - FIXED parts: the fair journal, signs list and place text hide unnoticed omens; `inspect Hester Fenn` says "Human"; NPC `explain` says "That explanation is not known to your character."
  - COULDN'T TELL if an omen was really fae: investigating returns only a dead-end.
  - COULDN'T TELL whether the 04:00 broom omen was noticed while asleep.
  - Minor: `inspect The Cold Stair` tells a newcomer "A refuge from fae, and cold storage for anyone brave enough."
- **Commanded PC put in debt, courted, or made to pay without order:** FIXED/OK for what I could trigger.
  - Seven favor offers from Michael Dunleavy (Apr 1 11:00 and 23:00, Apr 2 14:00, Apr 3 06:00, Apr 6 00:00, Apr 7 16:00, Apr 8 00:00) all lapsed with "Your answer on the request: no answer" and no purse change.
  - A stale `answer:` id is refused.
  - A "yes" needs an explicit command.
  - COULDN'T TELL for loan and courtship offers: none appeared.
  - A psyche-mode fork spent money on its own, which is expected.
- **Death and endings:** FIXED.
  - `retire` (`fork-death` index 61) and a real death (`fork-camp`: "This life has ended: death — thirst.") refuse every action with "This life has ended; only reading remains. No game time spent." That covers `wait`, `go`, `buy`, `sleep`, `drink`, `retire`, `depart`, `aid`, and standing and agency changes.
  - `look`, `journal` and `1` still work.
  - `--verify` passes: fork-death "Verified 64 commands; final hash 1e60d3c499ae95be", fork-camp "Verified 108 commands; final hash 6561f91a45e95c80".
  - `--fork` works on an ended session.

## 10. Story
Ellis Wayfarer arrives at Dunleavy's Tavern at midnight and pays a quarter for a bed. He wakes to a broom leaning bristles-up against the shut door, and an investigation that "points nowhere further". By afternoon Johann Brenner is mocking Hester Fenn across the room, Hester is telling the wolf story, and the Sentinel has declared a Brenner-Fenn feud. In a fork where I switched off every standing order, Ellis starved at Pratt's counter, and two sleepy clerks "hesitated to help" but fed him anyway. The only offers that ever came to him were favors with an obligation, and he answered none. The epilogue then tells the reader what nobody in the story knew: Gussie Pratt's anger "had found Ellis Wayfarer instead, who had done nothing at all to earn it."

## 11. Top 5 recommendations (ranked)
1. **Fix B12.** Let the standing sleep order pay for the bed, or surface "not sleeping because the bed is unpaid". Today the default order is a silent no-op that exhausts the character.
2. **Close the fair-mode leaks (B7, B8, B10).** Check `noticed` before the place check in `investigationEligibility()`, return one generic refusal, merge the two `explain` refusals, and gate or trim the fork `retire` epilogue.
3. **Fix the `standing eat off` Food readout (B4).** "Food 0.0 days" with 16,856 kcal in the pack, plus a false alert, invites a panic buy.
4. **Make time-cost honest and refusals specific.** Make `agency`, `standing` and `rations` free, or print "1 hour". Replace the shared "Nothing here matches" with the real reason: closed, locked, can't afford, out of stock, partly eaten.
5. **Give the newcomer an income, restock staples, and cap purchases by carry capacity.** The PC earns $0.00, and cornmeal, beans, pemmican, cheese and apples are gone in 5 days. Camping makes the bed pointless, and 150 lb of meal can be bought into a Staggering load (B15).
