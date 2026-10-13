# Coulee r3 edge-case QA: iron_ford seed 42 (plus tavern_brawl)

All sessions are under `/home/eleanor/projects/coulee-pt-r3/playtests/2026-10-13-r3-edgeqa-ironford42/`. The exact sequence for every session is in its `commands.jsonl` and `transcript.txt`.

**You need to know about one problem I caused.** The scratchpad is shared with another agent. My first helper call ran through their `scratchpad/p.sh`, which is hard-wired to `playtests/2026-10-13-r3-socialite-gentown7/session`. Two query commands ("session-a" and "help") went to their session. Both reported "No game time spent", but queries do get written to the command log, so their `commands.jsonl` may have one or two extra query entries. I did not touch it after that and used my own `scratchpad/edgeqa42/q.sh` from then on.

## HIGH

**H1. Need effects lag one hour: each hour is charged at the previous hour's activity.**
Session-c, at the tavern at 10:00:
```
activity:idle_at_home → Rest 767→728 (-39)
work                  → 728→689 (-39)   ← charged as leisure
work                  → 689→566 (-123)
activity:idle_at_home → 566→443 (-123)  ← charged as work
activity:idle_at_home → 443→404 (-39)
```
Sleep shows the same pattern. In session-k at 17:00 (after an hour of work): `go 4`, `buy whiskey`, `sleep` gave "sleeping" with Rest 300→212 (-88, the work rate). `wake` then gave +140, a sleep hour, during the hour you were awake. A paid `meal` shows Hunger 854→812 for its own hour and only reaches 1000 in the next hour. `help` says "a partly spent hour uses its dominant activity"; in practice it uses the previous hour's activity.
- **Expected:** the hour you work, sleep or eat is charged at that activity's rate.
- **Actual:** every charge lands one hour late.

**H2. tavern_brawl: the first command is lost and the brawl resolves without the player.**
`--new --scenario tavern_brawl --seed 7`, then `go 27` (or `drink`):
```
Since last look: 1h passed.
Pike and Whitcomb square up beside you. Join, call for peace, or leave through the door.
Amos Whitcomb squares up to Joel Pike. A nonlethal brawl begins.
Amos Whitcomb and Joel Pike: the brawl ends with one fighter crossing the tavern door.
```
- The 1-minute walk cost a full hour and you never moved (`go 4` then says "You are already at Dunleavy's Tavern").
- `drink` lowered Thirst 850→794, so no drink happened.
- You never get the offered choice to join, call for peace or leave.
- At 00:00, `fight Joel Pike` / `fight Amos Whitcomb` return "is asleep", while `look` shows them awake and `inspect` says "idling".
- `tactical:resume` as the first command returns "Nothing here matches".
- Same result with seed 11. I could not test breaking up someone else's fight because of this.

**H3. After fleeing or yielding, the tactical scene never lets go.**
Session-f (fork of session-d):
```
tactical:flee, then tactical:resume ×4 → "You have left the brawl." (now on Main Street)
wait 1h → "Since last look: 3600s passed." / "Tactical 02:00:11.1 — awaiting your order."
go 4    → "Since last look: 1h passed." … still at Main Street, Tactical 03:00:11.1
```
In session-g (yield, then the brawl ends with "submission accepted"), `go 27` gives "Tactical scene owns this actor; finish or leave the scene first." No "Breathe" option appears until after a `wait 1h`.
- **Expected:** when the scene ends you return to ordinary time.
- **Actual:**
  - The scene persists for hours.
  - A short walk costs an hour and does not move you.
  - The time line reads "3600s".

## MEDIUM

**M1. Inspect shows a feeling even when the perception roll fails, plus exact opinion numbers.**
Session-k at Pratt's, 17:00, after `inspect Augusta`:
```
Seems to feel about you: friendly — is well disposed toward you.
Perception: reading their manner: 7 (d20 6, Wisdom +1, …) vs DC 17 -> failure
affection: -4 = base -4 + reasons 0 + immediate 0 (clamped −100..100)
```
Lydia also failed (5 vs DC 15) and still showed "cool". Every fair-mode inspect, even of absent NPCs ("unobserved"), prints:
- "Your opinion: Neutral",
- then the exact affection/respect/trust/fear breakdown,
- and numeric per-memory deltas.

I could not check whether the failure reading is a deliberate misread, because `--god` is fixed at creation. Separately, after I worked about 5 hours for Augusta she still shows "familiarity 0 of 1000".

**M2. `work` with no employer is still offered and burns heavy labor for nothing.**
Session-a: `quit`, then `hire Augusta weekly` is refused ("Already asked this employer today"; the refusal still costs an hour). `work` ×2 then walks you to Dunleavy's Tavern, status "working", Hunger -63 and Rest -88 per hour, $0 earned. The menu shows "Work [activity:work]" from turn 1, before any hire.

**M3. `fight X` in ordinary play resolves without tactics and without injury.**
Session-c, `fight Michael Dunleavy`:
- Takes 1 hour: "Fight! ▸ Michael Dunleavy (it went badly)".
- Michael says "put a steak on that eye", but Health stays Vigor 7/7, Wounds 0/12.
- Michael then reads as "civil — offers you ordinary courtesy".
- Brawls work in two inconsistent ways: tactical in the scenario, abstract here.

**M4. "Go to market" locks you out of the market.**
Session-a, 09:00, `activity:go_to_market`:
- The 2-minute walk shows "Since last look: 1h passed".
- Then `buy whiskey`, `sell blanket` and `go 27` all return "You are still at market … until 11:00".
- That is 2 hours spent at the store without being able to trade there.

**M5. A failed `meal` still costs an hour.**
Session-a: `meal` at 08:00 returns "No meal available: closed, insufficient cash, or kitchen supplies exhausted" and the clock advances an hour. After a paid meal the prompt still says "Conscience: The table is laid (… take a meal)".

**M6. Partial-hour work: pay is prorated but needs are not.**
Session-a: 11 × `buy:beans_dry` (55 minutes), then `work`. Earned unpaid goes $0.29→$0.30 (5 minutes of pay), but the hour is still charged like a work hour (Rest -88).

## LOW
- Menus list "Go to X (1 min)" for every place, but many walks report "(2 min on foot)" or 3 minutes (session-a, `go 19`: "3 min").
- "Collapsed [activity:incapacitated]" can be chosen while healthy, giving "lying helpless" ("You lie down to sleep"). `go 4` then walks you off normally.
- `inspect me` reports "at home, at leisure at Main Street".
- While I am mid-brawl my status line reads "at home, at leisure".
- The yield text "Ellis Wayfarer yields. Accept the surrender" addresses you as the one accepting your own surrender.
- `drink` mid-brawl says "there is no spring, creek or ford here" inside the tavern.
- The eat standing order drank whiskey during sleep: "You are drunk" (session-k).
- `plan` says "Fuel: no cooking fuel required" and also "Some food cannot be prepared with the available … fuel".
- After `quit`, the prompt still says "Daily round: Work".
- Parley: "Your call for peace is heard", but I still took Nonlethal 4 afterwards (session-h).
- `wait until 07:00` from 20:00 stopped at 22:00.
- A cancelled tactical attack still starts the brawl and costs 3 s of recovery.

## Held up
- **Minute budget:**
  - Walks (1–3 min) and purchases or sales (5 min) chain correctly.
  - Overflow carries the remainder into the next hour ("59 min left (1 spent)" after 59+2).
  - Queries and `--verify` mid-hour cost no time.
  - `wait 1h` from mid-hour finishes the current hour.
  - Buying wakes you from sleep and takes 5 minutes.
- **Money** balances on every transaction I checked:
  - Whiskey buys at $0.30, sells 3 for $0.48.
  - Blanket sells for $1.95.
  - Firewood sells at $0.01 against $0.02 retail, which matches the "capped below retail" comment, with no arbitrage.
  - Wages accrue $0.075 an hour and are paid on `quit` ("earned wages remain payable").
  - Same-day rehire is refused.
  - The bed is charged once, until noon.
- **Tactical clock** adds up across resume, cancel and recovery.
- **Mid-fight `sleep`** is refused cleanly.
- **Not tested:**
  - Fish and wood piece-rate saturation and store cash: yields are only 0.1–0.3 a unit per hour, so not enough stock to sell.
  - Dismissal: no workers.
  - Fighting a household member's kin with them present: the household had left.

## --verify (all pass)
| Session | Commands | Final hash |
|---|---|---|
| a | 121 | 09bdebeb12559c9f |
| b | 2 | 406a94242860e75b |
| c | 23 | 5dde65b54aeb09c0 |
| d | 7 | 8b664148fd719c5d (also verified mid-fight) |
| e | 7 | 98ce85988a7ab619 |
| f | 14 | c303ede3d7fff453 |
| g | 12 | a61add1b3ecba94c |
| h | 10 | 73cec54ba75a7a26 |
| i | 0 | dc8aa86de77925c3 |
| k | 131 | 5b975aa6228a23b7 |