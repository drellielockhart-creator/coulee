# Greenhorn playtest: Iron Ford (seed 42)

## 1. Persona, world, mode, days, commands
- Persona: Greenhorn. Never played; learns only from the game UI and `help`. Character: Ellis Wayfarer, purse $50, a Medium-load pack of provisions.
- World: authored town of Iron Ford, seed 42, scenario iron_ford, spring 1855.
- Mode: FAIR. No source, content, design docs, or other playtest reports read.
- Days played: 8 in-game days (1855-04-01 00:00 to 04-08 ~08:00).
- Commands: about 95 state-changing game actions plus about 20 read-only queries (plan, journal, look, explain, inspect, help, actions).
- Session: /home/eleanor/projects/coulee/playtests/2026-10-11-greenhorn-ironford42/session (commands.jsonl, metrics.jsonl, transcript.txt, save.json left in place).
- Determinism: `--verify` on the session reports "Verified 90 commands; final hash 0d2796309e800449." (90 commands at the time of verify.)

## 2. Summary
I started at Dunleavy's Tavern with $50 and a 6.8-day food supply. I tried the menu, the Kit Sheet, chat, shopping, work, and meals. I could not find any income. "Work" always walked me back to the tavern and paid nothing I could see. Purse fell from $50.00 to $37.12 by day 8, with no earnings, through beds (~$0.25 a night), meals ($0.20), a $0.02 firewood sale, and a $0.60 flour purchase I never ordered. The game kept me alive: the journal shows Michael Dunleavy quietly feeding me, and the town is interesting (a fae rumour, a pastor, an active tavern). I was never told why anything happened, and several things happened that I did not choose.

## 3. Fun moments (verbatim from the game)
- "Miss Ellis Wayfarer, whose pantry has been bare, did not go hungry this week; Mr. M. Dunleavy saw to that, and mentioned it to nobody. We mention it for him." (journal, 1855-04-02 19:00)
- "Michael Dunleavy came by again with something for the pot, and would not stay to be thanked. I am learning to let a gift be a gift." (1855-04-02 19:00)
- "Nora Dunleavy was in close talk with Michael Dunleavy at Dunleavy's Tavern on Monday of an evening. I would give a good deal to know the subject." (1855-04-02 19:00)
- "Nora Dunleavy settled with Michael Dunleavy at Dunleavy's Tavern on Thursday in the afternoon. One more account closed in a county full of open ones." (1855-04-05 17:00)
- "Heard: Brigid Dunleavy is of the hidden folk" (at Pratt & Daughter, 1855-04-05)
- The journal's prose and the bare dramatic-irony hooks are the strongest part of the game for me. I wanted to know the subject of Nora and Michael's talk.

## 4. Confusion
1. No prices before buying. Bare `buy` returns "Ambiguous: buy:hardtack, buy:flour, buy:flour_sack_25lb, ..." with IDs only. Bare `sell` returns "Ambiguous: sell:308, sell:309, sell:312, ...".
2. Income. No job or wage is shown anywhere. `work` at the tavern for 2 hours left the purse unchanged apart from the meal. `work` from elsewhere walked me to Dunleavy's Tavern ("Stopped: activity.moved") with no explanation. The conscience line "Daily round: Work" nags but never says how.
3. Conversations are invisible. "Chat ▸ Mercy Bell: success" and "Chat ▸ Pastor Tveit Tveit: success" show no dialogue text. "Resolved: Chat: 1091 (Reality 50 × Self-Command 50%, Voices 1000 × 100%, Impulse (±100)) -> command" is the only trace; "Reality", "Voices", "Impulse" are never explained to a new player.
4. "talk <person>" repeatedly returns "The requested conversation did not take place: the other person may have left or be unavailable," for people listed as Here (Amos Whitcomb at the tavern, Augusta Pratt at the outfitters).
5. "rations 60" moved Food from 7.2 to 12.1 days. Only `help` shows the 10..150 range. I could not tell whether 60 is a good setting, what it costs, or whether it's a ration cut (the journal calls the ration "cut to 50 in the hundred").
6. "Fuel: 1.2 days" appeared on day 5 and was still 1.2 on day 8 with no explanation of what fuel does or how to buy it. The Wood-yard had no one to buy from; "buy firewood" was not an available action there.
7. Menu order. The first page is a wall of "Inspect <place>" entries for every location (20+ per page). Action lists grow to 349-383 entries as people accumulate. Useful items (Work, Sleep, Eat, Go) sit above them, but nothing says which list is which.
8. "Good day ▸ Ellis Wayfarer: success" (at the church, 1855-04-02) and "Pastor Tveit Tveit" (duplicated name) both read oddly.
9. Sleep. "wait until 19:00" put me to sleep through to 08:00 next day ("Stopped: social.interaction"). I was not asked.
10. "Sabbath" in the conscience line ("The Sabbath must be kept") while shopping on Sunday. Unclear whether trade is restricted on Sundays.

## 5. Boredom
- "wait 1d" stops at every social interaction. A single game day took 10 to 15 calls. Pacing is punishing for a player who wants to advance time.
- With no income and no job, the loop is: eat, sleep, wait, repeat. Little for the player to decide.
- Every person in a room prompts a Chat/Introduce entry, so the menu is mostly chatter entries.

## 6. Bugs
1. **Unexplained purse drop while asleep (command index approximate, 1855-04-01 06:00 to 07:00).** Purse $49.75 at 06:00, $41.93 at 07:00, a loss of $7.82 with no bought/sold/paid line in transcript.txt (lines ~1239-1258). Expected: only the $0.25 bed charge. Actual: $7.82 gone. Repro: `new --scenario iron_ford --seed 42`, then `wait until 06:00`, `wait 1h`. Session --verify: 0d2796309e800449 (deterministic, so the loss is reproducible).
2. **Auto-purchase during a wait (around command ~85, 1855-04-05 09:00 to 04-07).** "Bought 12 flour for $0.60" (transcript line ~4496, explain 8859). I never issued a buy command; the purchase happened while I was on `wait 1d` at Pratt & Daughter (activity 'at market'). Expected: no purchase without a player command. Actual: money spent autonomously. Repro: go to Pratt & Daughter, then `wait 1d` repeatedly.
3. **Autonomous hostile social actions (command index approximate, 1855-04-06 13:00 and 1855-04-07 09:00/14:00).** Journal: "I slighted Nora Dunleavy...", "I made sport of Amos Whitcomb...", "I made sport of Gussie Pratt...". I never chose to insult anyone. Expected: the player decides social actions, or the journal records what the character does with an explanation. Actual: insults recorded in the journal as the character's own choices. Repro: session dir, `wait 1d` repeatedly around Dunleavy's Tavern and Pratt's.
4. **Journal weekly summary contradicts state (1855-04-07 00:00).** "Week 1. ... the larder was down to under a day at the worst. Meals 11, cold 11. We lived on eggs, fresh bread heel and whiskey." Food was 6.4-7.3 days through this period, and I never had eggs or whiskey in inventory (`plan`). Expected: summary matches the state. Actual: larder under a day and eggs/whiskey claimed. Likely a flavor-text generator running off stale or wrong data.
5. **Conversations are silent (every Chat).** "Chat ▸ X: success" with no dialogue text. Expected: some output of what was said, or a clear note that conversation text is hidden. Actual: a success line with no content. (May be intended, but a greenhorn cannot tell.)
6. **Talk failures for people listed as present.** "talk Amos Whitcomb" and "talk Augusta Pratt" returned "did not take place: ... may have left" while the Here: line showed them. Reproduce: Dunleavy's Tavern 1855-04-01 03:00, `introduce Amos Whitcomb`.
7. **Duplicate name.** "Pastor Tveit Tveit" (church, 1855-04-02 09:00). Likely a title plus name concatenation bug.

## 7. Exploits
- None deliberately tried. The bare `buy` / `sell` ID listing plus `buy <id>` could let a player dump stock blindly. Selling one armload of firewood for $0.02 with no price shown is a trap for players, not really an exploit.
- `rations 60` raised food days from 7.2 to 12.1 instantly. If higher ration settings are free, this is a food-security lever worth checking.

## 8. Balance notes (numbers)
- Starting purse $50.00. Day 8 purse $37.12 with zero income. Net burn about $1.60/day including meals and beds.
- Bed $0.25 per night (tavern). Meal $0.20. Hardtack $0.08. Flour 12 for $0.60 (about $0.05 each). Firewood armload sold for $0.02.
- Food: 16,599 kcal on hand at day 1; 1,980 kcal/day plan. After flour and a few meals, 17,382 usable kcal at 1,188 kcal/day on day 8.
- Fuel: 2.0 days on day 1, 1.2 days by day 5, unchanged by day 8. Warmth stayed at 1000 on the tavern side, so fuel did not visibly bite in 8 days.
- Vitals: Thirst and Drink dip toward 500-700 by day 8 with no visible warning.

## 9. Story worth retelling
Yes. A stranger arrives in Iron Ford with fifty dollars and an empty larder, and the innkeeper Michael Dunleavy quietly feeds her without being thanked. The journal keeps watch over his household: his daughter Nora is in close talk with him at night, his brother-in-law Lucius Vance borrows money from him, and the town's gossip says Brigid Dunleavy is "of the hidden folk." The stranger never learns what the close talk is about. The game tells us so in its own words: "I would give a good deal to know the subject." The threads are good; the player just can't pull them yet.

## 10. Top 5 recommendations (ranked)
1. **Stop autonomous purchases and insults during `wait` (bugs 2 and 3).** A player who types `wait` should not lose money or gain a journal sin. Gate social actions and buys behind player choice, or surface them as explicit events.
2. **Show prices and income.** Bare `buy`/`sell` should list names and prices, and "work" should say where it happens and what it pays. Right now a new player has no way to earn.
3. **Explain the unexplained $7.82 loss (bug 1)** and make the bed/meal/ration charges visible in one line.
4. **Make `wait 1d` stop only on events the player cares about.** It currently halts on every social interaction, so a game day is 10-15 calls.
5. **Fix the menu.** Collapse Inspect entries into one submenu, put Work/Eat/Sleep first, and stop Chat/Introduce entries from growing without bound.
