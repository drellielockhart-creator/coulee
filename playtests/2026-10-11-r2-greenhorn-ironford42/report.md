PLAYTEST r2 GREENHORN, Iron Ford seed 42. Report file could not be written (write refused), so the full report follows. Session dir: /home/eleanor/projects/coulee/playtests/2026-10-11-r2-greenhorn-ironford42/session (commands.jsonl, metrics.jsonl, transcript.txt, save.json left in place). Running notes: .../notes.md.

TOP 5 FINDINGS
1. HIGH - Food header says "Food 0.0 days" for the whole session while plan says 20670-29506 usable kcal (about 7-10 days) and the Kit line says "Less than four days". Kit kcal looks roughly 3x over the game's own per-serving values.
2. HIGH - Cannot drink at "Spring at East Bluff". drink -> "No accessible water; fetch water at your lodgings or go to a water source.." Thirst 460 -> 180 (Parched) over 5h; warning "You may collapse from thirst in about 28 hours". Saved only by walking back to the tavern.
3. HIGH - investigate of the broom sign at 11:00 (sign says "investigate 4:0:dawn") burned the one test with no result text. At dawn: "You have already tested this sign. Returning cannot change the evidence."
4. MEDIUM - work never pays or reports anything (purse flat over 5h of work). work auto-walks you to the tavern from anywhere.
5. MEDIUM - Favors/debts have no amount or terms; "standing", "agency", "rations" bare forms error instead of showing settings; "standing eat off", "agency commanded", "rations 100" each cost a game hour with no confirmation.

REGRESSION CHECKLIST
- Long wait skips time: PARTIAL. FIXED in quiet places ("wait until morning" 6h in one command at cmd 14; 9h camping at East Bluff). STILL BROKEN in the tavern: about 30 "Wait stopped" outputs, several with no reason line; wait 1d moved 1h at a time.
- Character does something unordered: STILL BROKEN. Auto-eat 643 kcal during a wait (cmd 14); auto-walk to tavern under lodging order (cmd 114); self-resolved "At home"/"Walk"; journal: "I was short with Nora Dunleavy today and had no cause." No unordered spending.
- Failed social action reason clear: PARTIAL. Event line only "(it went badly)"; explain gives "Tell a tale: Joel Pike -> Ellis Wayfarer: 3 (d20 3, Charisma +0) vs DC 12 -> failure" (clear, but hidden behind explain).
- Money trail (purse vs household, bed/meal): PARTIAL. Purse lines are clear ("Money: purse -$0.25, household +$0.00 - Tavern bed: $0.25"). Household is always $0.00 and unexplained; there is no income line at all.

=== FULL REPORT ===
1. Persona/world/mode/days/commands: Greenhorn, Ellis Wayfarer. Iron Ford seed 42, FAIR mode, no source/docs read. Days: 1855-04-01 00:00 to 04-08 11:00 (about 7.5 days). Commands: 131 recorded per --verify (includes about 35 read-only queries; usage errors not logged).

2. Summary: Arrived with $50, no household. Introduced self to the innkeeper, slept in the tavern bed (7 nights at $0.25), camped once at East Bluff, bought 30 hardtack total, tried work repeatedly (no pay), accepted one favor from Michael Dunleavy and refused another, investigated the sign (wasted), nearly died of thirst at East Bluff, attended Sunday service Apr 8. Purse $45.65; spent $4.35 (hardtack $2.40, beds $1.75, meal $0.20). No income seen.

3. Fun moments (verbatim):
- Journal 04-01 21:00: "Michael Dunleavy helped me, unasked. There are people in this county who keep the word neighbor alive."
- Journal 04-05 15:00: "I went to bed parched. A person can learn a good deal about the world from the floor of an empty belly."
- Journal 04-04 18:00: "Michael Dunleavy lent money to Lucius Vance ... Money passes, and so do obligations; I have begun to keep a list."
- Journal 04-04 11:00: "I notice I am saying the same thing to myself over and over, in the same words."
- Journal 04-03 17:00: "I shut a door in myself today. I cannot say which, only that the house is quieter."
- Journal 04-07: "Week 1. The house took 2297 calories a head by the day, near enough ... Set down also: nothing worth the naming gone."
- Sign: "You remember: The broom leans bristles upward against the shut door. The question is still open; use signs."
- Overheard: "It's only talk, mind, but Brigid Dunleavy is of the hidden folk." / status "Heard: Brigid Dunleavy is of the hidden folk"
- Place: "The Outfitter: general store, post-office counter, and the town's ledger of debts."
- Survival text: "You may collapse from exhaustion in about 90 hours if this continues (Fortitude saves vary)."

4. Confusion:
- "Resolved: Introduce oneself: 967 (Reality 50 x Self-Command 50%, Voices 1000 x 100%, Impulse (+/-100)) -> command" - no meaning given for Reality/Voices/Impulse.
- Favor: "offers a favor with an obligation. Answer within the hour; silence means no answer." explain: "Request awaits the issuer: 0 () -> pending". Answer by typing "answer:28:41:1200:help:yes". No terms shown anywhere.
- journal "lists what you owe" - never showed an amount.
- sleep advances only 1h per command despite help "Sleep keeps you in bed at least 4 hours".
- work walked me to the tavern every time, printed "You begin working", nothing else. "Resolved: Work: -250 (...)" unexplained.
- "Food 0.0 days" header vs plan "29506 usable kcal / 2889 kcal per day" and Kit "Less than four days".
- meal: paid $0.20 at 09:00, "eat meal" -> "No available food/preparation matches", then 2h later "You ate Milk, whole, Eggs, Cheese, ...: 750 kcal, hot" with no link.
- bare "standing" -> "Use standing <sleep|eat|drink|warmth|lodging> <on|off>." (no current values). bare "agency" and "rations" likewise.
- investigate: see bug 3.
- "aid Nora Dunleavy" / "aid Nora" / "aid 29" -> "Nothing here matches ..." though Nora is present; aid never appears in menu.
- "Faith & Ritual: steady -> Wanting church" appears unexplained; "attend church" appears only on Sunday in the Conscience line.
- prices prints about 230 lines.

5. Boredom: Tavern waits repeat the same banter lines ("...and the fish was longer than the boat." / "And I'm the Queen of England." / "Mud to the axles on Main Street.") dozens of times; Conscience "The table is laid (you may: take a meal)" nearly every hour; only chat/introduce as social verbs, always "it went well" for me.

6. Bugs (cmd # = line in commands.jsonl; repro: session dir + `just run play --session <dir> --verify` -> "Verified 131 commands; final hash d7585fb7f1057adc.")
B1 HIGH food header. cmd 14 (wait until morning) auto-ate 643 kcal; cmd 17 plan shows header "Food 0.0 days" (was 6.0 at 00:00) while kcal only 17499->16856. Expected header tracks kit. Header stuck at 0.0 through session (cmd 30: 32806 kcal/2142; cmd 106: 20670 kcal/2889). rations 100 (cmd 63) did not fix it.
B2 HIGH kit vs kcal. cmd 60 plan: 29506 kcal with 2 hardtack (#345), 3 pemmican (#346), 2 dried apples (#347), 10 hardtack (#861). By the game's own per-serving values (hardtack 550, pemmican ~967) about 10k, ~3x less. cmd 106 same pattern (~7.6k vs 20670). Pemmican count does not clearly drop with servings eaten.
B3 HIGH sign. cmd 25 investigate 4:0:dawn at 11:00 Apr 1: 1h passed, no result, sign still open. Dawn Apr 2: "You have already tested this sign. Returning cannot change the evidence.. No game time spent."
B4 HIGH drink at spring. Apr 4 01:00 and Apr 5 16:00 at East Bluff: drink -> "No accessible water; fetch water at your lodgings or go to a water source.." while place says "Spring at East Bluff." and Appetite says "you may: fetch water". Thirst 460 (Thirsty, Apr 5 11:00) -> 180 (Parched, 16:00). Expected: drinkable at named spring, or text consistent.
B5 MEDIUM unordered walking. work auto-walks to tavern (cmd 32 Apr 1 14:00; cmd 65 Apr 3). cmd 114 wait until 08:00 at Lutheran Church (Apr 7 11:00): "Wait stopped at 12:00 ... You arrive at Dunleavy's Tavern" (lodging order, documented only in help).
B6 MEDIUM work no result. cmd 32-34 and 65-66: purse flat at $48.25 across 5h of work; no pay/journal/status line.
B7 MEDIUM config cost an hour silently: cmd 16 standing eat off (480->540), cmd 52 agency commanded (2040->2100), cmd 63 rations 100 (3300->3360). Only explain shows a result.
B8 MEDIUM default standing eat: cmd 14 ate Pemmican, Dried apples, Hardtack (643 kcal) during a plain wait; standing eat is on by default. Meal bought cmd 18 eaten later at cmd 23 output "You ate Milk, whole, Eggs, ... 750 kcal, hot".
B9 MEDIUM unordered self-commands and rudeness. Journal 04-05 19:00 "I was short with Nora Dunleavy today and had no cause." and 04-06 08:00 same for Amos Whitcomb. "Resolved: At home" 43 times, "Resolved: Walk" 18 times, self-chosen. After agency commanded (cmd 52) lines continued (event ids 10264, 11744, 13926, 17065, 19870), so commanded mode may not be respected.
B10 MEDIUM wait stops. About 30 "Wait stopped at HH:00 (you meant to wait until ...)" outputs; some with no reason line (18:00 Apr 1, 04:00 Apr 3, 07:00 Apr 5 after wait 1d moved 1h). Stop lines give no date. Quiet places run through (cmd 14: 6h; East Bluff: 9h).
B11 MEDIUM favors have no terms. Refused (cmd 79) and accepted (cmd 39): only "refused"/"accepted"; no amount/effect shown.
B12 LOW stock vanished silently: cmd 28 (Apr 1 13:00) pemmican 24, dried apples 30, cornmeal 150, cheese 25; cmd 62 (Apr 3 07:00) none of those listed. buy pemmican / buy dried apples -> "Nothing here matches".
B13 LOW daily need changed silently 2142 -> 2889 kcal/day (cmd 60) with no message.
B14 LOW aid errors (see confusion).
B15 LOW typos: "source.." double period; rations error lacks current value.

7. Exploits: Camping at East Bluff is free (no bed charge) and worked well. Food is cheap (hardtack $0.08 for 550 kcal; full 2889 kcal/day about $0.42), so money barely binds. Quiet-room waits skip time at no cost.

8. Balance numbers: start $50.00. Hardtack $0.08 (550 kcal), pemmican $0.30 (~967 kcal), dried apples $0.10, bed $0.25 until noon, meal $0.20, firewood $0.02. Hunger decays ~30-35/awake hour; Peckish ~600; 2 hardtack raised 588->926. Rest decays ~40-50/awake hour (566->411 in 3h); Tired ~300; exhaustion warning at Rest 261. Thirst decays ~30/h (Thirsty 460, Parched 180; warning "about 28 hours"). Starvation warning at Hunger 291: "about 367 hours" (scale looks inconsistent with thirst/exhaustion). Malnourished appeared Apr 4 ("You are malnourished after a week of poor eating"), cleared Apr 5 03:00 ("You are eating well enough again"). Journal: "2297 calories a head by the day" vs displayed 2889 need.

9. Regression checklist: as in the top section above (long wait PARTIAL/STILL BROKEN in tavern; unordered actions STILL BROKEN; social failure reason PARTIAL; money trail PARTIAL).

10. Story: Ellis Wayfarer came to Iron Ford with fifty dollars and no idea what the town wanted. Michael Dunleavy kept offering help "with an obligation", and Ellis kept not knowing what was promised, though Michael did help unasked more than once. A broom leaned against the tavern's shut door and the question it raised never got an answer, because the first look came at the wrong hour. A week of hardtack and quarter beds later, Ellis had never earned a cent, had been short with Nora and Amos for no reason Ellis could name, and had nearly died of thirst at a spring that would not give water. Ellis went to Sunday service to hear the pastor insulted.

11. Top 5 recommendations (ranked):
1. Fix the food readout and kit kcal (header 0.0 days; ~3x over-count; header stuck).
2. Make drinking at a named spring work, or make text and Appetite line consistent.
3. Do not burn the sign test when investigating outside its window; show an outcome; tell the window.
4. Give work a visible result (pay or reason) and stop silent auto-walking.
5. Make favors/debts concrete (amount, terms, journal entry); make standing/agency/rations print settings and confirm changes without costing an hour.
Lower priority: explain reasons and dates on every Wait stopped; stop prices dumping ~230 lines; fix the double period in the drink error.