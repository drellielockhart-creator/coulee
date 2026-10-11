# Explorer playtest, gen:town seed 7

## 1. Persona, world, mode, days, commands
Explorer; gen:town seed 7 (Ford town, Ellis Wayfarer at The Wagon Bell Tavern); FAIR mode; 1855-04-01 00:00 to 04-10 13:00 (about 9.5 days); 134 session commands (commands.jsonl lines), many were read-only queries. `--verify`: "Verified 120 commands; final hash 268643b1a841cd2d" (run at 120).

## 2. Summary
Introduce attempt at midnight failed, slept, then toured all 17 named places plus the wild reaches in one 24h walk (every go = 1 hour, so I walked into Exhausted, Rest 0). Then tried the Work/Fish/Forage/Chop/Mill/Sap/Church/Pay-a-call activities, then waited days. The world reads as alive via journal and overheard NPC doings, but my own agency produced almost nothing visible, and waits are broken into 1-3 hour pieces.

## 3. Fun moments
- "Sunday, the 1st of April, 1855. The Sabbath under a full moon; the evening service will want no lantern."
- "Honora Sheehan came by again with something for the pot, and would not stay to be thanked. I am learning to let a gift be a gift."
- "I made eyes at Timothy Costello at The Wagon Bell Tavern on Monday in the afternoon. My heart did a thing it has no business doing in a person of sense."
- "Patrick Sheehan settled with Honora Sheehan ... One more account closed in a county full of open ones."
- Week summary: "Week 1. The ration cut to 50 in the hundred; the larder was down to under a day at the worst. Meals 4, cold 3."
- Church on Sunday full of neighbors (Strauss, Vance, Keller, Carter); schedules visibly shift by weekday.

## 4. Confusion
- Chat/Gossip/Pray results show only "[id] Chat > X: success" with no words. I never learn what was said.
- Store has no visible price list; "buy" lists ambiguous ids only; auto-purchases (cornmeal, flour) happened without my asking.
- Activities I pick get overridden: "Work the ferry", "Run the mill", "Pay a call" all executed at the tavern; "Fish"/"Forage"/"Boil sap" hop to a different place each hour. Header says "running the mill" while at The Wagon Bell Tavern.
- 5 places all named "Kitchen garden and stubble" (go:22,24,26,28,30) with no way to tell which farm.
- Journal 04-01 00:00 "the children no longer ask" at day 0 with 6.8 days food; ration 50% preset is unexplained.
- "Self-Command: Drags out to it, slow about it" unexplained.
- Preached at the innkeeper and at myself in church (failure) - unclear why I'm doing it.

## 5. Boredom
- From day 3 on I sat in the tavern. "wait 1d"/"wait 3d"/"wait until 07:00" stop on social.interaction nearly every 1-3 waking hours: ~35 wait commands for ~6 days. Interrupts are almost never worth it (NPC chat between two others).
- Inspect gives bare JSON (id/name/kind); places have no description, so exploring is just names. Wild places are empty with no resources/discoveries.
- No income found; nothing to aim at.

## 6. Bugs
1. cmd 5 "talk:introduce:3" at 00:00 offered while Patrick/Honora/Johanna/Costello asleep ("activity":"sleeping"); result "The requested conversation did not take place: the other person may have left or be unavailable." and an hour elapsed. Expected: not offered, or no time cost. Repro: new seed 7, choose 13. Verify OK.
2. Activity/location mismatch: choosing ferry/mill/call-on-kin leaves player at the tavern with header naming the activity (cmds around 04-05 14:00, 04-06 12:00).
3. Chop wood: Fuel stayed 1.1 -> 1.0 days after "splitting firewood" (04-06 09:00); no wood gained.
4. Fishing/foraging produce no item or event in the log; plan shows no new food.
5. "explain 483" (Repay > $4.38) -> "That explanation is not known to your character", yet the event is listed in the output.
6. "rations 100" printed no confirmation text.
Repro for all: session dir /home/eleanor/projects/coulee/playtests/2026-10-11-explorer-gentown7/session; --verify passes (deterministic).

## 7. Exploits
None found. (Tavern bed/meal prices are trivial; wealth decays only ~$0.5-1/day.)

## 8. Balance notes
- Purse $50.00 -> $42.85 over 9 days (about $0.8/day), no income from any activity.
- Travel any-to-any: 1h. A full tour of 22 places took ~21 game hours; Rest 0 by 06:00.
- Hunger 800 -> ~510 in ~30h; Thirst crosses "Thirsty" within ~16h. Food 6.8 -> 5.7 days over 9 days thanks to tavern meals.
- Fuel 2.0 -> 1.0 days in 5 days; chopping does not restore it.
- Interrupts: roughly 60% of waits stopped within 3 hours.

## 9. Story
Ellis arrived on a full-moon Sabbath with a thin larder and a 50% ration and never quite recovered the confidence of a stranger. Over a week the tavern household of Sheehans and the lodger Costello traded debts and kindnesses (settled accounts, "something for the pot"), while Ellis, by the journal, developed an inconvenient fondness for Costello. Sunday at Ridge Lutheran the whole district turned up and Ellis preached to himself and failed. Small, but it felt like a place where people owe each other.

## 10. Top 5 recommendations
1. Make waits coalesce: suppress/aggregate social.interaction among others so "wait 1d" actually advances a day; interrupt only for things involving the player.
2. Show dialogue/outcome text for chats, gossip, prayers, so social actions have payoff.
3. Give explicit activities real, visible results (fish, forage, wood, wages) and honor the chosen location instead of reverting to tavern.
4. Add place descriptions and discoverable features (resources, view, who is usually there); disambiguate the five gardens.
5. Hide/disable impossible actions (introduce sleeping people) and show store prices; add a goal or hook (income, debt, romance thread) to pull "one more day".

Would I keep playing? Barely: the journal voice and NPC web are a strong pull, but without agency or income I'd stop around day 4.
