I could not write report.md: the file-write tool refused ("Subagents should return findings as text, not write report files"), so the whole report is below. The running notes are in /home/eleanor/projects/coulee/playtests/2026-10-11-r2-explorer-gentown7/notes.md, and the session files are in .../session/.

# FINAL SUMMARY

**Top 5 findings**
1. HIGH: Walking is mispriced. Arrival text says "(2 min on foot)", but all 34 walks cost 60 min each (commands.jsonl shows at=0, end=60). That is about 34 game hours of an 8-day run.
2. HIGH: Hazel Spring says "Cold water issues at the sandstone/dolomite contact", but `drink` returns "No accessible water; fetch water at your lodgings or go to a water source." Camp sleep then locks out Drink and Go for 8 hours. I slept Thirsty (342) and woke Parched (174, "collapse from thirst in about 31 hours").
3. MEDIUM: The numbered Go menu shows only 3 or 4 hub places. The other ~22 places are reachable only through `places N`. Twin places read alike: two "Water Street", three identical kitchen gardens, two identical farms.
4. MEDIUM: Sign investigation is one permanent roll (d20+Int 1 vs DC 10). Two of my three rolls failed ("You have already tested this sign. Returning cannot change the evidence."). My one success gave "It points nowhere further."
5. MEDIUM: `wait` and `standing` are surprising.
   - `standing lodging off` costs 1 hour although it says "No game time spent".
   - `wait` and `sleep` silently walk you to the tavern.
   - Tavern chatter stops `wait` every 2-3 hours.
   - Workers are unreachable until noon.

**Regression checklist**
- Fae within first days and sign-to-place lead: FIXED. The broom sign appeared day 1 and I followed a sign to a place, but the payoff is thin.
- Go menu lists reachable places: STILL BROKEN on the numbered menu. `places 1/2/3` does list them.
- Walking time sensible: STILL BROKEN.
- Kitchen-garden places distinguishable: STILL BROKEN. Three gardens share one text, told apart only by coordinates and one extra omen line.

**Would I keep playing?** Yes, for the journal voice and the fae omens. The pull fades after about 3 days to the same cold food and the same tavern chatter.

---

# FULL REPORT

## 1. Persona, world, mode, days, commands
- Persona: EXPLORER.
- World: gen:town seed 7, character Ellis Wayfarer, $50 start, Red Oak Tavern.
- Mode: FAIR.
- Played 1855-04-01 00:00 to 04-08 23:00, which is 7.96 days.
- 145 logged commands: about 95 spent game time and about 50 were free queries. About 8 more typed commands were rejected before logging.
- `--verify` returned "Verified 141 commands; final hash 50f493b50d071b7c." The session is deterministic.

## 2. Summary
I visited all 27 places. I slept in the tavern bed and at open camps, investigated 3 signs, chatted with neighbors, bought food once, tried Work and Attend Church once each, and let days pass with waits, including 24-hour waits at the quiet ford.

The atmosphere is strong. The non-boilerplate place text, the omen lines and the journal voice carry the "one more day" pull. Exploration itself is costly. Every hop is a flat hour, the Go menu hides most places, workers are unreachable until noon, and a failed sign roll is permanent. The one real danger I met was thirst at a spring that would not give water. I hit Exhausted, Parched and Malnourished but never collapsed.

## 3. Fun moments (verbatim)
- Day 1 tavern: "The broom leans bristles upward against the shut door." (investigate 25:0:dusk). An hour later Jory Rowe: "For what it's worth, Richard Pascoe is of the hidden folk." Ellis: "I'd want more than talk before I'd credit that."
- Hazel Spring: "Cold water issues at the sandstone/dolomite contact. Neighbors leave a clean saucer; nobody admits hearing the bell below the water." The church echoes it: "A plain frame church; the bell was cast downriver." This is the best linked pair in the game.
- West sandstone face: "The ledge returns a footstep from an awkward direction. Give no name to an answering rock."
- East sandstone face: "A cow-bell sounds somewhere beyond the empty ledges. The iron-shod survey post stands silent; the bells keep away."
- Tregear farm: "Ash gathers on the wrong side of the hearthstone. There is danger here; the ordinary rules feel uncertain. Iron at a threshold keeps small visitors out."
- I slept through events at Hazel Spring and found them on waking: "[3733] A pale light slips between two trunks and leaves no shadow." and "[3737] These lights hold their distance like guests waiting to be invited."
- Journal voice:
  - "I shut a door in myself today. I cannot say which, only that the house is quieter."
  - "Richard Pascoe made eyes at me. I did not know where to look, so I looked at him, which was the trouble."
  - "Tuesday, the 3rd of April, 1855. The full moon, which the Norwegians watch and the Cornish do not discuss."
  - "I went to bed parched. A person can learn a good deal about the world from the floor of an empty belly."
  - "Week 1, accounted. 17 meals, 17 cold; fresh victuals about 10 in the hundred."
- Debt line: "Bartholomew Tregear comforted me at West sandstone face ... and would not hear thanks. Entered here so I do not forget the debt."
- Survival warning: "You may collapse from thirst in about 31 hours if this continues (Fortitude saves vary)."
- Church worked: "Faith & Ritual: Unmoored → steady". The nudge was "When did you last bend the knee?" and typed `attend church` worked.
- Pascoe: "Spring in this country: half water, half promises."

## 4. Confusion
1. The numbered Go menu offers only Badger Ford, Smithy, Mercantile and Red Oak. The rest need `places N`.
2. "(2 min on foot)" is printed, but 60 minutes pass.
3. Two "Water Street" places, (32,0) and (32,32), have near-identical text and the menu gives no coordinates.
4. `wait until noon` at Tregear farm teleported me to the tavern: "Wait stopped at 11:00 ... You arrive at the Red Oak Tavern". Sleeping at Coulee road with lodging OFF also walked me home, cost $0.25 and dropped Rest 156 → 73 on the way.
5. `standing` alone prints only usage, not the current orders.
6. Appetite/Conscience slot junk:
   - "Appetite: Best not to think of it. (held for your order; you may: )" at Hunger 528.
   - "Appetite: And Richard Pascoe can keep out of my way, too."
   - "Something to eat. Now." at Hunger 612, steady.
   - "Parched: a drink of water" at Thirst 888.
7. `meal` is ambiguous ("Which one? Take a meal; Cook"). `take_meal` took an hour, the purse was unchanged and Hunger fell 787 → 716.
8. `aid Richard Pascoe` returned "Nothing here matches" although he was in the room, and gave no hint that he was not in need.
9. Day 4 "malnourished after a week of poor eating", with an `explain` that is a wall of variable names.
10. Journal lines with no referent: "There is nothing in it. I looked at it from three sides..."
11. `talk introduce <name>` says "That person is not here". `introduce <name>` works. The 16-item menu hides talk options.
12. The glimmer, ash and hearth-guest lines sit in the place text but are not listed signs. `investigate glimmer` returned "That sign has left no trace to investigate."

## 5. Boredom
- Walking is 34 flat hours, and Rest drains about 77/h, so a visit-everything day is impossible.
- Every worker I tried (mill, school, Tregear, Vik and Freeman farms) was "at work ... until 12:00" or 18:00, so mornings are empty.
- I ate 17 cold meals of hardtack, apples and pemmican. I never cooked.
- Money is irrelevant. I spent $1.96 of $50 in 8 days, and Work paid nothing in 2 hours.
- Many places share one template sentence ("Spring mud holds wagon ruts, and oak-covered bluffs rise beyond the roofs.").
- At the tavern, `wait` stops every 2-3 hours for chatter ("Skipped 12 minor conversations nearby" and then a stop anyway). `wait 3d` there took 4 commands and moved the clock 7 hours. At empty Badger Ford, `wait 3d` ran 24 hours per command.
- No requests, loan offers or goals arrived in 8 days.

## 6. Bugs
Session dir: /home/eleanor/projects/coulee/playtests/2026-10-11-r2-explorer-gentown7/session. `--verify` passes, so every item replays. Indices are line numbers in commands.jsonl.
1. #72: `standing lodging off` charges 1 hour (2100→2160), but the text says "No game time spent". Expected zero time.
2. #123 then `drink`: Hazel Spring gives "No accessible water; fetch water at your lodgings or go to a water source." and the Drink item is absent from the menu. Expected drinkable water, or a reason. It did allow a drink on 04-01, probably from the canteen, but the UI never says only the canteen counts.
3. #124-126: camp sleep (8 hours minimum) removes Drink and Go from the menu. Typed `go Hazel Spring` returns "Nothing here matches" with no mention of sleep. I fell from Thirst 342 to 174 and was trapped. `wait` did stop at 00:00 on the Parched alert.
4. #71: `wait` relocates you to the tavern silently.
5. All 34 walks: a "2-5 min on foot" label but a 60 min cost.
6. #117: `sleep` at Coulee road with lodging off walked me home for $0.25 and Rest fell 156 → 73. The menu label was just "Sleep", not "Make camp".
7. #57, #85: investigations failed (d20 6 + 1 = 7 and d20 8 + 1 = 9, both vs DC 10). "The trace will not yield a clear reading. Another attempt would tell you nothing new." Retry: "You have already tested this sign. Returning cannot change the evidence." The dice are visible only via `explain`. #111 succeeded: "You find where the trace ends. It points nowhere further."
8. Stale or contradictory Appetite text (see Confusion 6).
9. Malnourished event text says "a week" on day 4.
10. Low confidence, #138 and #141: two separate 24-hour camp waits ended with identical Rest 280 and Thirst 676 (04-07 18:00 and 04-08 20:00). It may be a cycle coincidence.
11. `wait 3d` stopped at exactly 24 hours at Badger Ford with only "(you meant to wait until 04-09 18:00)" and no reason.

## 7. Exploits
None found. Money has no use.

Standing orders keep Ellis fed and watered at the tavern with no actions ("Food 12.0 days" after a $0.96 purchase), so passive waiting there is a stable loop. Its only cost is the chatter interrupts.

## 8. Balance numbers
- Rest falls 77/h awake (800 → 723 → 646 → 569 → 492) and about 100/h working (498 → 298 in 2 h). Sleep restores about 140/h (453 → 873 in 3 h).
- Thirst falls about 40-80/h (900 → 342 in 20 h). Hunger falls about 40/h.
- Auto-meals give 867 kcal, about 2 a day, so about 1734 kcal against 2142 needed (81%). Malnourished was flagged on day 3.5.
- Prices: bed $0.25, tavern meal $0.20, hardtack $0.08. 12 hardtack cost $0.96 and took "Food" from 6.0 to 12.0 days.
- Walks: 34 × 60 min = 34 h, about 18% of the 191 hours played.
- About 25 waits. About 14 stopped early: 9 NPC chatter stops (low value), 3 body alerts (very worth it), 1 lodging relocation, 1 cap at the quiet ford. About 1 in 3 stops was worth it.
- Investigation: DC 10 with Int +1 gives about 60% to succeed. I got 1 success in 3, with a permanent single roll.

## 9. Regression checklist
1. Fae within first days and lead from sign to place: FIXED, with a thin payoff.
   - Signs found: day 1 "Open sign: The broom leans bristles upward against the shut door. (investigate 25:0:dusk)"; day 3 "[21:2:dawn] Read sign: A pale light slips between two trunks..."; day 4 "[10:3:dawn] Read sign: Three tools lie with their handles pointing to the threshold."
   - Leads named places: "Heard: the Good Neighbors are abroad at Hazel Spring" and "...at Kitchen garden and stubble (17, 18)".
   - Remote investigate says "Go to the sign or its lead first."
   - The result at the garden was "It points nowhere further."
2. Go menu lists reachable places: STILL BROKEN on the numbered menu, which shows only "10. Go to Badger Ford [go:13] / 11. Go to Kvale Ford Smithy [go:20] / 12. Go to Whitlock Mercantile [go:22]". It is FIXED via `places 1/2/3`, which lists all 26 destinations.
3. Walking time sensible: STILL BROKEN. "You arrive at Whitlock Mercantile (2 min on foot)" came with "Since last look: 1h passed".
4. Five kitchen-garden-style places distinguishable: STILL BROKEN, partial.
   - I found 3 "Kitchen garden and stubble" places, all "Potatoes held back for seed; no new crop before summer." They differ only by coordinates in the name, and (17,18) alone adds "A hearth guest has been attending to the threshold."
   - Vik Ridge Farm and Freeman Lower Slope Farm both read "A house, garden and byre above the spring floods."
   - The two limestone caps and the two Water Streets also share text.

Other new systems:
- Survival works and is dramatic.
- Neighbors helping happened: "Bartholomew Tregear: Comfort ▸ Ellis Wayfarer (it went badly)" and "Loveday Rowe comforted me, unasked."
- My own `aid` was untestable because nobody was in need.
- Open-air camping works.
- The standing-order newcomer works ("Held for your order; routine standing orders only").
- Requests and loan offers: COULDN'T TELL. None arrived.
- Debts in the journal: one prose line only, with no structured "what you owe" list.
- Plain-English events are good.

## 10. Story
Ellis Wayfarer arrives on a full-moon Sabbath and sees a broom hung bristles-up against the tavern door, and fails to read it. An hour later the innkeeper whispers that Richard Pascoe, the pleasant man at the next table, is "of the hidden folk". Pascoe spends the week making eyes at Ellis ("which was the trouble"). Ellis goes to Hazel Spring, sleeps beside it, wakes to find a light that "slips between two trunks and leaves no shadow", and nearly dies of thirst because the spring's cold water will not be drunk. A neighbor, Bartholomew Tregear, comforts the wreck of a newcomer, and the journal makes a debt of it. The omens never resolve into an answer.

## 11. Top 5 recommendations
1. Charge the minutes the walk label shows, or batch sub-hour hops, and show minutes on the Go items.
2. Fix the water and sleep trap. Make springs and creeks drinkable or explain why not. Warn or refuse camp-sleep when Thirsty. Let a camper `drink`, `wake` or `go`.
3. List the nearest 6-8 destinations on the main menu with minutes. Give twin places distinct text (the church/spring bell pair is the model).
4. Make signs pay and fail gracefully. Show odds, allow a different-method retry or give a hint on failure, make description-only omens into signs, and make a successful lead point somewhere.
5. Tame waiting and standing orders.
   - `wait` should not stop for "it went well" small talk.
   - `standing` should print current orders and not charge an hour.
   - Stop silent relocations on `wait` and `sleep`.
   - Clean up the empty "you may:" and stale Appetite lines.
   - Stagger work hours so mornings have someone to talk to, and give coin a use (pay for `Work`).