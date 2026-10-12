GREENHORN PLAYTEST, Coulee gen:town seed 7 (r2). The report could not be written to disk: the Write tool refused it under the rule that subagents return findings as text, so the full report is below. Running notes are at /home/eleanor/projects/coulee/playtests/2026-10-11-r2-greenhorn-gentown7/notes.md. Session dir (commands.jsonl, metrics.jsonl, transcript.txt) is left in place at /home/eleanor/projects/coulee/playtests/2026-10-11-r2-greenhorn-gentown7/session.

FINAL MESSAGE (summary)

Top 5 findings:
1. HIGH: Food-days readout lies. With standing eat off, "Food 0.0 days" and "Less than one day of food or cooking fuel remains" appear while the kit holds 21,809 usable kcal (about 7.5 days). Turning standing eat back on shows "Food 8.0 days". Health also keeps "malnourished" for days after feeding.
2. HIGH: Long waits stop repeatedly at the tavern. Awake, "wait until morning" or "wait until dusk" stops every 1 to 3 game hours whenever a family member chats at Ellis, with no reason given. Empty places skip 16 to 20 hours in one command.
3. HIGH: Unordered acts. Standing eat is on by default and ate 429, 868 and 1,445 kcal events unannounced. Walking and speech also happen unordered. Journal records events with no printed counterpart ("I had every reason for it", "I said something clever").
4. MEDIUM: Investigate and signs. Investigating the broom and tools signs cost an hour and printed nothing; both expired unresolved. aid says "Nothing here matches" for a listed person. Signs output says "No journal entries known yet."
5. MEDIUM: Economy is opaque. Work paid nothing across hours. Household is always $0.00 and unexplained. "Mail" never produced anything. Purse fell from $50.00 to $47.90 with no income.

Regression checklist:
1. Long wait skips time? PARTLY FIXED. One-command 20h and 16h skips when no one interrupts; repeated 1h stops at the tavern while chatted at.
2. Unordered actions? STILL BROKEN (partly). No spending, insults or gifts. Yes to unordered eating, walking and speech.
3. Social failure reason clear and believable? PARTLY FIXED. Clear only in explain, as a dice roll ("6 (d20 5, Charisma +1) vs DC 12"); on screen just "(it went badly)".
4. Where money goes? FIXED for purchases and beds (clear "Money:" lines). Household still unexplained.

Mode FAIR, 7 days 8 hours played, 137 commands (verify: "Verified 137 commands; final hash 716601c639050f54"). I grepped my own transcript.txt once to locate an unseen event; I did not read source or other reports.

FULL REPORT

1. Persona, world, mode, days, commands
- Persona: Greenhorn. Ellis Wayfarer, human newcomer, lodging at the Red Oak Tavern.
- World: procedurally generated ford town, seed 7, start 1855-04-01 00:00.
- Mode: FAIR. No source, content, design docs or reports read. Disclosure: grepped my own transcript.txt once (game output, not source) to find an event that appeared only in the journal.
- Days: 1855-04-01 00:00 to 1855-04-08 08:00 (7 days 8 hours).
- Commands: 137 applied (verify hash 716601c639050f54), plus about 20 zero-time queries or refusals.

2. Summary
Ellis arrived with $50.00, hardtack (4 lb), pemmican (3), dried apples (2), blanket, kettle, canteen and firewood. Day 1: met the tavern family, paid $0.25 beds, tried work (no pay). Bought matches and bacon at Whitlock Mercantile. Found standing eat on by default, eating the kit unordered; turning it off made the food readout say 0.0 days. Slept free on the Coulee hay ground under the blanket (20-hour wait in one command). Followed two fae signs: the porridge one resolved ("Small claw marks betray the pantry visitor"); broom and tools never resolved and faded. Nearly hit exhaustion (Rest 107) through my own inattention. Attended Sunday church, which moved "Unmoored" to steady. Day 8: $47.90, no income, a debt to Jory Rowe in the journal.

3. Fun moments (verbatim)
- Jory Rowe: "A warm room and a new face; that's a good day's work." / "For what it's worth, Richard Pascoe is of the hidden folk."
- Journal 1855-04-01 06:00: "Jory Rowe slighted me at the Red Oak Tavern on Sunday at first light. I said nothing then. I am saying it now, to this page."
- Journal 1855-04-02 00:00: "Monday, the 2nd of April, 1855. The full moon, which the Norwegians watch and the Cornish do not discuss. Snow in the night."
- Journal 1855-04-03 11:00: "Jory Rowe comforted me at the Red Oak Tavern on Tuesday in the forenoon, and would not hear thanks. Entered here so I do not forget the debt."
- "You examine the residue: Small claw marks betray the pantry visitor."
- Ellis, fetching water: "Spring in this country: half water, half promises."
- "Money: purse −$0.24, household +$0.00 — Bought 2 Bacon / side pork, salt-cured for $0.24"
- "Since last look: 20h passed." (camp wait, one command)
- "You may collapse from exhaustion in about 87 hours if this continues (Fortitude saves vary)."
- Place text: "A plain frame church; the bell was cast downriver." / "Silver maple at the wet edge, last year's hay stubble on the valley floor."

4. Confusion
- help is dense: "Need effects use the previous hour's activity", "wait follows your lodging order, returning to a nearby paid or own bed", "Eat defaults to ONE serving".
- Every interaction narrates jargon: "Resolved: Introduce oneself: 1068 (Reality 50 × Self-Command 50%, Voices 1000 × 100%, Impulse (±100))". explain repeats it. Reality, Voices and Impulse are never explained.
- Standing orders not introduced. First surprise: "[942] You ate Pemmican, Dried apples, Hardtack (ship's biscuit): 429 kcal, cold" on arrival at Kvale Ford Smithy.
- standing and agency with no argument only print usage; no view of current settings. standing eat off prints no confirmation.
- Undecodable labels: "held for your order", "Appetite: Weary", "Faith & Ritual: steady → Wanting church", "Unmoored".
- Cooking: "No available food/preparation matches." The reason (no water in canteen) appears only on a separate Kit line.
- Water: the Appetite hint says "fetch water", which did not fill the canteen (water 0 ml). "fill canteen" worked (not in help).
- work paid nothing, was never described, and routed me to the tavern even from the smithy.
- Conscience "The pantry is nearly bare: go to the store" persisted after buying food. mail walked me to the Mercantile; an hour later nothing; never explained.
- aid Richard Pascoe / aid 24 / aid Richard: "Nothing here matches" while Richard is listed as present.
- Household money $0.00 all run, never explained. "bed $0.25 until noon" was charged at 15:00 and 22:00.
- Sign labels churn: "Open sign", "Open question", "Read sign", "trace faded".
- Kit "4 × Hardtack" vs inspect "4 lb ... Remaining: 9.502 servings".
- "Heard: the Good Neighbors are abroad at Whitlock Mercantile." No way to act on it.
- Failed social action: "(it went badly)" on screen; explain gives "Flirt: Richard Pascoe → Ellis Wayfarer: 6 (d20 5, Charisma +1) vs DC 12 -> failure".

5. Boredom
- Long tavern stretches of family chatter that nothing asks Ellis to answer. "Skipped N minor conversations" hides it.
- No loan offer, request or "wants an answer" prompt in 8 days.
- work produced nothing for hours.
- Repeated 1-hour waits.

6. Bugs (event ids in [brackets] where available; all repros use the session dir above; --verify: 137 commands, hash 716601c639050f54)
- B1 HIGH: Food-days readout 0.0 with standing eat off. Expected: days track kit (21,809 kcal at 2,889/day ≈ 7.5 days). Actual: "Food 0.0 days" and "Less than one day of food or cooking fuel remains" (day 2 07:00; day 5 18:00). standing eat on restores "Food 8.0 days". Repro: standing eat off, then plan.
- B2 MEDIUM: "malnourished" Health tag persists after feeding at Hunger 804 (day 6 07:00) and 836 (day 7 22:00).
- B3 HIGH: Long waits stop per hour while awake at tavern. Day 1: wait until morning stopped 17:00, 18:00, 19:00 (Jory chat each time). Day 5: wait until dusk stopped 11:00, 14:00, 15:00, 17:00. Stop text: "Wait stopped at X (you meant to wait until Y)", no reason. Contrast: day 2 12:00 to day 3 08:00 at hay ground in one command (20h); day 4 16:00 to day 5 08:00 one command (16h, 19 skipped).
- B4 LOW: Blank affordance: "Appetite: That's done and gone. Least said. (held for your order; you may: )" (day 3 21:00).
- B5 LOW: signs with no signs prints "No journal entries known yet." (day 1 00:00).
- B6 MEDIUM: aid <listed person> returns "Nothing here matches" (day 2 05:00).
- B7 MEDIUM: investigate 25:0:dusk (broom, day 1 ~21:00) and investigate 25:6:dawn (tools, day 7 08:00) each cost 1h with no output; stayed "Open question" until faded. Expired sign: "That sign has left no trace to investigate.. No game time spent." (double period).
- B8 HIGH: Journal records events never printed. Journal 1855-04-02 19:00: "I had every reason for it, and I have written the reasons down so I shall not lose them." (inside the silent 20h camp wait). Journal 1855-04-02 08:00: "I shut a door in myself today." Journal 1855-04-04 05:00: "Richard Pascoe made eyes at me ... I said something clever and have been trying to remember what." No matching printed line.
- B9 MEDIUM: Journal 1855-04-06 10:00 says Richard comforted me and I "would not hear thanks"; the 11:00 wait stop said "Richard Pascoe: Comfort ▸ Ellis Wayfarer (it went badly)".
- B10 MEDIUM: Food-days header vs plan. Start: header "Food 6.0 days" vs plan "17499 usable kcal / 2142 kcal per day" (8.2 days). Day 1 13:00: header 6.0 vs 16521/2142 (7.7). Daily need jumps 2142 to 2889 by day 2 unexplained.
- B11 LOW: fetch water does not fill canteen; fill canteen does (1220 ml). Kit line "Less than a day of stored drinking water" stays at 1.2 L; no threshold given.
- B12 COULDN'T TELL: work no pay across about 5 game hours (purse unchanged; Rest 552 to 390). Could be intended; nothing says what work is for.
- B13 COULDN'T TELL: mail produced nothing in one hour at the Mercantile.

7. Exploits
- Free camping on the Coulee hay ground: $0 with the blanket, Rest 419 to 1000 over 20 hours. The tavern costs $0.25 a night for the same result.
- One-command skips: wait until morning passes 20 hours in an empty place, running past hunger and exhaustion with no warning.
- Standing eat (default on) keeps the character fed with no orders and eats a whole kit in one event (see Balance).

8. Balance notes (numbers)
- Purse $50.00 to $47.90 at day 8 08:00 (total $2.10): beds $0.25 each (about 7 nights), bacon $0.24, potatoes $0.06, matches $0.05. No income found.
- Prices: tavern meal $0.20; bed $0.25; hardtack $0.08; bacon $0.12; pemmican $0.30; potatoes $0.01/lb (6 lb for $0.06, 18 servings); matches $0.05; flint and steel $0.25; camp kettle and canteen $0.75.
- Food: hardtack 1,650 kcal/lb (3 servings per lb, about 550 each); potatoes 350 kcal/lb. Daily need 2,142 to 2,889 kcal by day 2.
- Standing eat chunks: 429 kcal (day 1 13:00); 868 kcal (day 2 04:00; again at camp); 1,445 kcal (day 3 19:00, four items at once, about two-thirds of a day's need).
- Vitals: awake Rest falls about 45 to 55 per hour (767 at day 5 08:00 to 107 at 22:00), about 80 per hour while working (552 to 390 in 2 hours). Sleep: Rest 107 to 768 in 5 hours; 419 to 1000 over the 20h camp. Hunger falls about 30 to 40 per hour; Thirst about 50 to 80 per hour.
- Exhaustion: Rest 107 "Exhausted" at 22:00 day 5 after about 14 hours awake. "Collapse in about 87 hours" stayed constant; no collapse occurred.
- Weight: 33.4 kg at start, 28.6 kg by day 7.
- Social check example: Flirt rolled 6 (d20 5, Charisma +1) vs DC 12.
- Faith & Ritual: one church visit (about 2h) moved Unmoored to steady.
- Signs: broom sign lasted about 4 game days before "trace faded"; tools sign still open on day 8.

9. Regression checklist
1. Long wait skips or stops? PARTLY FIXED. One-command 20h (day 2 to 3, nobody around) and 16h (day 4 to 5, 19 conversations skipped). Awake at tavern, stops every 1 to 3 hours on family chat ("Wait stopped at 19:00 (you meant to wait until 08:00)"); no reason given.
2. Unordered acts? STILL BROKEN (partly). No spending, insults or gifts beyond my orders. Yes: unordered eating ([942] 429 kcal; [4779] 1445 kcal), unordered walking (sleep, fetch water, work, wait moved me to tavern or Mercantile), unordered speech ("Ellis Wayfarer: 'You never have.'", "Busier. There's no end to it this time of year."). Journal records acts/speech not shown (B8).
3. Social failure reason? PARTLY FIXED. Clear only in explain, as a dice roll with DC. On screen: "(it went badly)". Nothing in the fiction explains it.
4. Where money goes? FIXED for purchases and beds ("Money: purse −$0.25, household +$0.00 — Tavern bed: $0.25"). STILL UNCLEAR: household ($0.00 always) and the "bed $0.25 until noon" label versus 15:00 and 22:00 charges.

10. Story worth retelling
Ellis Wayfarer came to the Red Oak Tavern in April 1855 with fifty dollars, a knapsack of biscuit and pemmican, and a habit of writing things down. Jory Rowe slighted her on her first Sunday; she recorded it and said nothing. She paid a quarter a night for a bed until she found the hay ground was free, and slept there under her blanket while the wait skipped a day. A broom stood bristles-up against the shut tavern door; she never learned what made it, and the sign faded before she could ask. Eight days in she has no income, a debt to Jory in her journal, and a half-remembered line she is still trying to recall.

11. Top 5 recommendations (ranked)
1. Make the food and health readouts truthful: "Food X days" should count kit food whatever standing eat says; no "less than one day" alarm with 7 days in the pack; "malnourished" should clear once fed (B1, B2, B10).
2. Make long waits finish or say why they stopped. Interrupting chatter should show its reason, and routine NPC talk should not cut a wait to one hour (B3, checklist 1).
3. Announce unordered acts as they happen: explain standing orders at first contact, add a standing status view and a confirmation on change, and stop one event eating 1,445 kcal of the kit unannounced (checklist 2, B8).
4. Print everything the journal records, and make investigate say something when it does not resolve, including "the lead is elsewhere" (B7, B8, B9).
5. Give the newcomer a visible way to earn and plain English for the unexplained words: work should say what it does and pays; household, mail, aid and "held for your order" need a line each; Reality / Voices / Impulse / DC should stay out of player-facing narration (Confusion, B12, B13).