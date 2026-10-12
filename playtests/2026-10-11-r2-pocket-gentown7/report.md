PLAYTEST pocket-gentown7 (regression wave r2). The report file could not be written (the tool refused a report .md from a subagent), so the full report is below. Running notes are at /home/eleanor/projects/coulee/playtests/2026-10-11-r2-pocket-gentown7/notes.md. Session dir (commands.jsonl, metrics.jsonl, transcript.txt, save.json) is at /home/eleanor/projects/coulee/playtests/2026-10-11-r2-pocket-gentown7/session.

TOP 5 FINDINGS
1. HIGH: Food shows "Food 0.0 days" and "Less than one day of food ... remains" whenever the eat standing order is off, while `plan` shows 22993 usable kcal (about 8 days). Reproduced 3 times. Toggling eat back on restores "Food 8.0 days". Repro: `--verify` gives "Verified 68 commands; final hash 3ba91cd4d05556d0".
2. HIGH: Starvation ETA is wrong. "You may collapse from starvation in about 367 hours" at Hunger 271; hunger falls about 30 per awake hour, so empty in about 9 hours. The ETA barely moves down to Hunger 0 (359 h).
3. MEDIUM: Waits stop for social chatter (Good day, Gossip, Slight, arrivals) about as often as for needs: about 10 social stops in 7 days.
4. MEDIUM: Favor requests are answerable only by typed `answer:3:25:8160:help:yes`. They are not on the default menu, and the favor's terms are never described (`explain 8160` says "No known explanation").
5. MEDIUM: Observations are not phone-sized. `prices` prints about 330 lines unpaged; `inspect` prints about 41 KB of JSON; every reply repeats the full status block even for "no time passed". A dead-end fae sign also stays "Open sign" forever.

REGRESSION CHECKLIST
- Since-last-look summary instead of repeated text: STILL BROKEN. The summary line is good ("Since last look: 15h passed; Company: steady -> Restless; Hunger: Peckish -> steady."), but the full block still repeats, including for "Since last look: no time passed."
- Waits interrupted only by things worth stopping for: STILL BROKEN. Need stops are good ("You are getting tired", "You are starving now"); social stops are too frequent.
- Status block short enough for a phone: STILL BROKEN. About 35-45 lines per reply with menu and interrupts.

=== FULL REPORT ===

1. Persona, world, mode, days, commands
- Pocket player (phone, 5-minute chunks, long waits). World: gen:town seed 7, start 1855-04-01 00:00 at the Red Oak Tavern; character Ellis Wayfarer (newcomer kit, tavern lodging).
- Mode FAIR. No source, content, design docs or other reports read. The only extra text was the JSON printed by the game's own `inspect`.
- Days played: 7 (1855-04-01 00:00 to 04-07 19:00). Commands: 68 applied (verified); about 100 CLI calls including queries and rejected inputs.
- Command index below = line number in session/commands.jsonl (line 1 is the header).

2. Summary
Chunked play: tavern start with Jory Rowe; camp in the open at Badger Ford; a pemmican purchase; work; the porridge-bowl fae sign; an accepted favor from Jory; a deliberate starvation test (eat off) and feeding before collapse; a walk to Tregear Upper Coulee Farm at dusk following the sign's timed lead. Texture is strong (timed fae signs, mood place text, a journal that reads like a person, a useful since-last-look line). Broken: the food display, the starvation ETA, waits that stop for gossip, and observations too long for a phone.

3. Fun moments (verbatim)
- Tregear farm, 04-07 19:00: "A frost pocket, patched fence and a root cellar nearly through its winter stores." / "Ash gathers on the wrong side of the hearthstone. There is danger here; the ordinary rules feel uncertain. Iron at a threshold keeps small visitors out."
- Sign follow-up: "The trace runs toward Tregear Upper Coulee Farm. Return there at dusk; the timing matters."
- Day 1: "Jory Rowe: 'There's something queer going on, Miss Wayfarer. Mark me.'" / "Jory Rowe: 'For what it's worth, Richard Pascoe is of the hidden folk.'"
- Journal 04-03 09:00: "I shut a door in myself today. I cannot say which, only that the house is quieter."
- Journal 04-05 16:00: "Jory Rowe slighted me at the Red Oak Tavern. I held my face still and counted to a hundred; it did not help."
- Appetite 04-07 10:00: "Something's wrong. I can feel it in my teeth."
- 04-06 20:00: "You ate Pemmican: 967 kcal, cold" then "You are easing from starving to hungry".
- 04-06 17:00: "Jory Rowe offers a favor with an obligation. Answer within the hour; silence means no answer."
- 04-03 20:00: "Wait stopped at 20:00 (you meant to wait until 06:00)." / "You are getting tired" / "You may collapse from exhaustion in about 92 hours if this continues (Fortitude saves vary)."

4. Confusion
- Self-Command is jargon: "Resolved: Introduce oneself: 1068 (Reality 50 x Self-Command 50%, Voices 1000 x 100%, Impulse (+/-100)) -> command". Same for Work.
- "Self-Command: Resolved: At home" shows at Badger Ford camp, at Whitlock Mercantile, and at the Red Oak after work.
- Food: "Food 0.0 days" with "Less than one day of food or cooking fuel remains." while `plan` shows about 8 days (B1).
- "Kit: Less than a day of stored drinking water" with no clue where the water is kept.
- "malnourished" appears in Health from 04-04 08:00 to the end with no explanation or cure. Only hint, journal 04-04: "I am down with want of food. Too long on salt meat and meal; the body keeps its own books."
- Conscience lines end "(you may: call for the mail)" whenever the pantry is low. Unknown what it does.
- `standing` and `agency` with no argument give only a usage error.
- `wait 1d` says "Wait stopped at 17:00 (you meant to wait until 15:00)". Odd for a one-day wait.

5. Boredom
- 04-03 to 04-05 felt flat: repeating tavern chatter; nothing for me to do between NPC lines.
- Journal about 25 entries in 5 days, mostly "was in close talk with ... I would give a good deal to know the subject." Two identical lines at 04-03 13:00 and 14:00.
- Work gave no visible reward; purse only went down.
- With routine standing orders on, a one-day wait needed zero decisions.

6. Bugs
B1 HIGH. Food shows zero days and a scarcity warning when the eat standing order is off.
- Where: command 36 (`standing eat off`, 04-04 14:00, line 37); command 38 (eat on, line 39); command 43 (eat off, 04-05 12:00, line 44); command 60 (eat on, 04-06 21:00, line 61).
- Expected: food days follow the kit (about 8 days; plan "22993 usable kcal / 2889 kcal per day").
- Actual: "Food 0.0 days; Medium, 30.9 kg." and "Less than one day of food or cooking fuel remains." The same minute `plan` lists 2 Hardtack, 3 Pemmican, 4 Pemmican, 2 Dried apples. Eat on gave "Food 8.0 days" (04-04 16:00) and "Food 7.0 days" (04-06 21:00). At 04-06 06:00, `agency` printed "Kit: Less than four days of usable food at current rations." (two food numbers disagree).
- Repro: `just run play --session <session dir> --verify` -> "Verified 68 commands; final hash 3ba91cd4d05556d0." Toggle `standing eat off` and read the status line.

B2 HIGH. Starvation and exhaustion ETAs are far too long.
- Where: 04-06 10:00 to 19:00, eat off.
- Expected: hunger falls about 30 per awake hour (807 -> 736 -> 678 over 04-05 13:00-17:00; 358 -> 271 over 04-06 07:00-10:00), empty about 9 hours after "Hungry".
- Actual: "about 367 hours" at Hunger 271; "about 363 hours" at 71; "about 359 hours" at 0. Exhaustion ETA also barely moves: "about 90 hours" at Rest 256, "88" at 166, "86" at 76.
- Not verified: collapse and death. Hunger reached 0 at 19:00 and I fed her then (Vigor still 7/7).

B3 MEDIUM. Request answers are typed-only, off the default menu, and never describe the favor.
- Where: command 56 (`answer:3:25:8160:help:yes`, line 58, 04-06 18:00).
- Expected: request states what is asked; accept and refuse appear as numbered menu items on page 1; obligation shown.
- Actual: "Pending favor with an obligation: answer:3:25:8160:help:yes or answer:3:25:8160:help:no (expires within the hour)". Neither is on the default 14-16 entry menu; they appear on `actions 1`. Accepting gave "Your answer on the request: accepted" and an hour's help. Did not check the journal for a booked obligation; COULDN'T TELL.

B4 MEDIUM. Fae sign dead ends stay open; the "dawn" tag is ignored.
- Where: command 20 (`investigate 25:2:dawn`, line 23, 04-03 11:00, not dawn). 04-04 08:00 retry rejected: "You have already tested this sign. Returning cannot change the evidence."
- Actual: check succeeded ("Investigate: 10 (d20 9, Intelligence +1) vs DC 10 -> success") but gave "You find where the trace ends. It points nowhere further." The sign stayed as "Open sign: ... (investigate 25:2:dawn)" in every observation for the rest of play, in every town.

B5 MEDIUM. Waits stop for social chatter as often as needs.
- Stops at 04-04 10:00 (Loveday: Good day); 04-05 12:00 (Peran: Good day); 04-05 15:00 (Jory arrives); 04-05 17:00 (Jory: Slight); 04-06 03:00 (Nils Dahl: Good day); 04-06 06:00 (Loveday: Comfort, it went badly); 04-07 14:00 (Jory: Comfort, badly); 04-07 16:00 (Jory: Gossip); 04-07 18:00 (Jory: Chat; Peran: Slight).
- Need stops were well judged ("You are getting tired", "You are hungry now", "You are starving now").

B6 MEDIUM. Observations not phone-sized.
- `prices` at Whitlock Mercantile: about 330 lines unpaged, then the status block again. `inspect Ellis Wayfarer`: about 41 KB JSON.
- Every reply repeats the status block (about 9 lines), place text, Here list, interrupts, NPC lines and a 14-16 line menu, even for "Since last look: no time passed." (`signs`, `journal`, `plan`, `standing eat on`).

B7 LOW. Stale labels and dangling text.
- "sleeping" stays on the status line after waking, with the full awake menu (04-03 08:00; 04-07 09:00).
- Appetite: "That's done and gone. Least said. (held for your order; you may: )" (empty option, 04-03 10:00 and 04-07 16:00).
- Health lists conditions with no explanation: "malnourished, starving, fatigued".

B8 LOW. Journal.
- 04-04 20:00: "Peran Rausch was in close talk with Peran Rowe" (no such person; Peran Rowe meant).
- 04-03 13:00 and 14:00: identical line twice.

B9 LOW. Text glitches.
- Kvale Ford Smithy description starts "Ford Smithy stands at (44, 24)..." (name cut).
- `actions 2` lists "Inspect Water Street" twice (places 23 and 24).
- Two similar arrow lines in the Mercantile price list. `signs` opens with "No journal entries known yet."

B10 LOW. Misleading errors and missing views.
- `places` at camp: "Use actions <page> with an available positive page number.." (wrong text, double period).
- `eat 145 raw`: "Ambiguous food: use a stable eat:item:method action id." although #145 is the id `plan` shows.
- `aid Peran Rowe` / `aid Peran`: "Nothing here matches" although Peran Rowe (#5) is in the Here list. `aid` is on no menu.
- `go 22` at camp: "No such destination." Camp offers no travel until you wake, and the message does not say so.
- `standing` / `agency` with no argument: usage error only; no way to view current settings.

B11 LOW, COULDN'T TELL. Work pays nothing visible.
- `work` walked me to the Red Oak Tavern; four shifts left the purse unchanged. `explain 5821`: "Resolved: Work: 1680 (Reality 100 x Self-Command 50%, Voices 1605 x 100%, Impulse (+/-100)) -> command". Pay may be deferred.

7. Exploits
- Routine standing orders make a day input-free: with sleep, eat, drink and warmth on, `wait 1d` / `wait until morning` kept her fed, watered and rested (04-02 to 04-03: ate three times, slept, no input). Suits a pocket player, but the game can run on autopilot.
- Camping in the open is free; Warmth stayed 1000 from 31 F to 53 F, rain included. Cold never bit in this range (not tested below 31 F).
- Switching eat off reliably triggers the false food alarm (B1).

8. Balance notes (numbers)
- Money: $50.00 -> $47.80 in 7 days. Spent: 4 Pemmican at $0.30 ($1.20); 4 tavern beds at $0.25 ($1.00). Income recorded: $0.
- Food: 04-01 kit 17499 usable kcal at 2142 kcal/day; 04-04 kit 22993 usable kcal at 2889 kcal/day. Daily need up about 35% while idle or working, no stated cause.
- Meals: Hardtack raw 550 kcal; Pemmican raw 967 kcal; routine three-item meal 868 kcal.
- Hunger: 1000 after eating; falls about 30/awake hour; Hungry about 270; Starving about 70; empty about 9 h later.
- Thirst: 900 to Thirsty (494) in about 5 awake hours.
- Rest: 922 (04-03 08:00) to Tired (294) by 20:00, about 12 awake hours; Exhausted at 76 (04-06 21:00).
- Warmth 1000 throughout (31-53 F, rain included).
- Interrupts over 7 days: about 8 need stops, about 10 social stops, 1 request.
- Tavern bed $0.25 per night; camp free.

9. Regression checklist
- Since-last-look summary instead of repeated text: STILL BROKEN. Summary works ("Since last look: 4h passed; Company: Restless -> steady."), but the full block still repeats, including for "Since last look: no time passed."
- Waits interrupted only by worthwhile things: STILL BROKEN. Social stops as frequent as need stops (B5).
- Status block phone-sized: STILL BROKEN. About 35-45 lines per reply with menu and interrupts; `prices` and `inspect` far worse (B6).

10. Story worth retelling
Ellis Wayfarer arrives at the Red Oak Tavern on the first of April, and Jory Rowe tells her Richard Pascoe is of the hidden folk. A porridge bowl licked clean on the outside starts a fae sign that never closes. She sleeps rough at Badger Ford, loses a long wait, and is starving on the sixth of April while the Rowes and Pascoe talk about the mail. A favor from Jory comes with an obligation she never fully understands. Three tools at a threshold point her to Tregear Upper Coulee Farm, where ash sits on the wrong side of the hearthstone.

11. Top 5 recommendations (ranked)
1. Make the food display follow the kit, not the eat standing order (B1).
2. Recompute starvation and exhaustion ETAs from the real decay rate, or drop them (B2).
3. Stop waits for third-party chatter (greetings, gossip, arrivals, slights); journal it and show a one-line summary at the next stop (B5).
4. Put request options on the default menu, state the favor's terms, and show the booked obligation (B3).
5. Make observations phone-sized: no repeated status block on no-time replies, page `prices`, replace `inspect` JSON with a summary, and close dead-end fae signs (B6, B4).