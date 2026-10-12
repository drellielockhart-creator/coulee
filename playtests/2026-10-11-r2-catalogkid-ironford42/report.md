# Playtest report: CATALOG KID / MIN-MAXER, Iron Ford (seed 42), regression wave R2

I could not write report.md. The Write tool refused ("Subagents should return findings as text, not write report files"), so the whole report is below, per the brief's fallback. I did not work around the block. Notes are in `notes.md`, the Outfitter price list is in `prices-outfitter.txt`, and the session is in `session/`, all under `/home/eleanor/projects/coulee/playtests/2026-10-11-r2-catalogkid-ironford42/`.

## Top 5 findings
1. **HIGH: no drinkable or refillable water in the wild.**
   - `drink` at Lantern Spring returned "No accessible water; fetch water at your lodgings or go to a water source."
   - `fetch_water` walks you to the tavern instead. Camp sleep locks out `go` and `drink` for 8 hours.
   - Two canteens (3.8 L) lasted about 1.5 days, so a two-week trip is really a 1.5-day trip. Thirst reached 164 "Parched".
2. **MEDIUM: Kit Sheet shows "Food 0.0 days; 62517 usable kcal"** (cmd #158, Apr 4 14:00). It was back to 21.0 days the next morning.
3. **MEDIUM: printed kcal/day is wrong early.**
   - It reads 2142 at the start, but the day counts match about 2889: "17499 usable kcal / 2142 kcal per day" gives "6.0 days", and 17499/2142 is 8.2. At Heavy load it prints 2889 and the arithmetic works.
   - Health shows "malnourished" with 20 days of food. It persists at Hunger 1000.
4. **MEDIUM: a cheese was packed into a tin canteen holding 422 ml of water.** The canteen was then refilled to 1900 ml with the cheese still listed inside (1900 g capacity). Capacity refusals for knapsack, kettle and hardtack into the canteen work, but the message is the misleading "Nothing here matches".
5. **BALANCE: bacon dominates every food.** It is raw-edible, $0.12 per lb, 28,300 kcal/$ and 7,490 kcal/kg. Pemmican costs 2.5x as much and is lighter in kcal per kg. Food for 22 days cost about $2.5 of $50. Money is not a constraint. Water, Rest, load and clock-hours are.

## 1. Persona, world, mode, days, commands
- Persona: Catalog Kid. World: Iron Ford, seed 42, FAIR mode.
- About 5 in-game days played (Apr 1 to Apr 6, 1855), short of 7-14. Every buy, pack, fill and standing change costs a game-hour, so outfitting ate the first 3 days.
- 177 lines in transcript.txt, about 14 of them wasted or no-ops.
- Harness collision, not a game bug:
  - The shared scratchpad `p.sh` was overwritten by sibling agents. About 14 of my early read-only queries (inspect, prices, places, --look) ran against OTHER agents' sessions.
  - One of those calls failed with `EEXIST ... r2-explorer-gentown7/session/.lock`.
  - They were read-only, so no state changed. They may have left extra transcript lines in those sessions.
- `--verify`: "Verified 137 commands; final hash 7650d14ebe325396."

## 2. Summary
I read the Outfitter catalog, bought one of each food to inspect it (shop goods cannot be inspected until bought), and used `plan` constantly. I camped 3 nights (East Bluff x2, Huldra's Shelf x1). Camping works, wood and fishing work, and Staggering has effects. Foraging gave nothing in 2 of 2 tries. Water is the real limit. Total spend was about $12.3 (gear about $9, food about $2.7, beds $0.75).

## 3. Fun moments (verbatim)
- "Kittredge's Almanack for the Year: $0.06", "Dr. Pelham's Universal Restorative: $0.75", "The Long-Hidden Friend (charm book): $0.35", "Grimoire, used (contents unknown): $15.00".
- "Muster ground, Fourth of July picnics, and where charivaris begin."
- "The broom leans bristles upward against the shut door." and "A neat plait has appeared in the loose straw by the door."
- "A cow-bell sounds somewhere beyond the empty ledges. There is danger here; the ordinary rules feel uncertain. The iron-shod survey post stands silent; the bells keep away."
- Journal: "I shut a door in myself today. I cannot say which, only that the house is quieter." / "Money passes, and so do obligations; I have begun to keep a list." / "I notice I am saying the same thing to myself over and over, in the same words. A person ought to be able to say a thing once and be done."
- "Conscience: It is late; the day starts early (held for your order; you may: sleep)"
- "You ate Cheese, Swiss, Dried apples, Parched corn: 867 kcal, cold"
- "You may collapse from thirst in about 28 hours if this continues (Fortitude saves vary)."
- "You gathered 1 Brook trout, fresh"

## 4. Confusion
1. A spring you cannot drink from (see finding 1).
2. After "Make camp and sleep here" the menu offers only wait, eat, plan and journal. `go 24` gave "No such destination." and `go Lantern Spring` gave "Nothing here matches". I could not act on the Kit warning "Less than a day of stored drinking water".
3. `fill canteen` is not in `help`, yet it works at the tavern (1 hour, canteen to 1900 ml). `fill kettle` gives "Nothing here matches"; the kettle never filled.
4. `pack` refusals say "Nothing here matches “knapsack into canteen”" instead of giving a reason.
5. `actions` pages never list buy or sell. `standing` alone prints only usage, so you cannot view current orders.
6. `forage_greens`, `fish_creek` and `fetch_water` pick a location and walk you there. Forage took me to the danger place Huldra's Shelf.
7. "Conscience: The pantry is nearly bare: go to the store" appears with 20 days of food in the pack.
8. `cook bacon 1 fry` used an hour and showed no result line.
9. The start kit has 2 armloads of firewood, 18 kg, 54% of the 33.4 kg load.
10. `inspect` of a container prints raw JSON: `Container: {"capacity_g":13600,"capacity_bulk":20,...}`.

## 5. Boredom
- One buy is one game-hour, so a 15-item list is a whole day. The counter closes at 21:00, so about 15 buys per day is the cap.
- Packing, filling and standing changes also cost an hour each.
- After day 2 there was nothing to optimise except keeping canteens full.
- Forage gave nothing twice, and the first fishing try gave nothing.

## 6. Bugs
Repro for all: session dir `playtests/2026-10-11-r2-catalogkid-ironford42/session`; `--verify` passes ("Verified 137 commands; final hash 7650d14ebe325396"). Indices are transcript line indices.
1. **HIGH:** no drinking or filling in the wild. Cmds #113, #123, #124, #128, #130. Expected: a spring lets you drink and fill. Actual: refused, and `fetch_water` teleports to the tavern.
2. **MEDIUM:** "Food 0.0 days; 62517 usable kcal / 2889 kcal per day." Cmd #158, right after selling 3 firewood (#154) and buying a gourd canteen (#155), with Rest 0. Expected about 21 days. It was 21.0 again by #163.
3. **MEDIUM:** printed kcal/day versus the days figure. Cmds #2, #29, #31, #38 against #84.
4. **MEDIUM:** Health "malnourished" with Hunger 586 and then 1000, and 20 days of food (#164-#177). Standing eat ate only 867 kcal in 12 hours. No stated cause or cure.
5. **MEDIUM:** capacity overflow. #86 packed cheese into the canteen with 422 ml in it. Later the canteen held 1900 ml with the cheese still inside (#127, #158; "1 × Cheese, Swiss (#867) in #343").
6. **LOW:** misleading refusals at #85, #88, #93, #63 and #116.
7. **LOW:** raw JSON from `inspect` of a container (#5).
8. **LOW:** "pantry is nearly bare" with a full pack (#108).
9. **LOW:** `cook bacon 1 fry` (#141) gave no event. The stack went 3.935 to 1.588 servings after one raw eat plus one fry, which is 2.35 servings for 2 requested.
10. **LOW:** the cheese "Spoils first" forecast swung 59.6 d, then 147.2 d, then 97.8 d, then 97.1 d (#38, #84, #108, #158), unexplained.

## 7. Exploits
- No real exploit. Food is a free action.
- Standing eat quietly burned 15.5 servings of brown sugar (4.487 of 20 left at #152).
- The gourd canteen ($0.30, 227 g empty, 1900 ml, bought pre-filled) beats the tin one ($0.75, 454 g) for water capacity.

## 8. Balance notes (numbers)
Per 1 lb: kcal, $, kcal per $, kcal per kg, prep.
- Hardtack: 1650, 0.08, 20.6k, 3640, raw/soak/fry. A serving is 550 kcal.
- Pemmican: 2900, 0.30, 9.7k, 6390, raw/boil. A serving is 967 kcal.
- Dried apples: 1100, 0.10, 11k, 2420, raw/boil.
- Cornmeal: 1680, 0.03, 56k, 3700, boil/fry.
- Flour: 1650, 0.05, 33k, 3630, bake/fry.
- Bacon: 3400, 0.12, 28.3k, 7490, raw/fry/boil. It gives 3.935 servings per lb.
- Parched corn: 1800, 0.06, 30k, 3970, raw/boil. It gives 3.785 servings per lb.
- Cheese: 1800, 0.12, 15k, 3970, raw/fry. Spoilage went 5 to 18 per 1000 in about 2 days.
- Beans: 1550, 0.04, 38.7k, 3410, raw/boil.
- Sugar: 1720, 0.08, 21.5k, 3790, raw. It has 20 servings.
- Tinned oysters: 300 kcal per tin at $0.40, 750 kcal/$. A trap.
- Brook trout: 640 kcal/lb, spoils in about 1.9 days.

Other numbers:
- **Spoilage:** hardtack 4/1000 after 3.5 days. Bacon outside the canister 13/1000, bacon in the airtight canister 11/1000, so the canister gives about 15% protection.
- **Trout spoilage:** 41/1000 after about 1 hour and 110/1000 after 5 hours, about 22 per hour. That gives about 45 hours to 1000, so the plan's "Spoils first: Brook trout, fresh in 1.9 days" is accurate.
- **Burn:** Hunger falls about 42/hr awake and about 19/hr asleep. A pemmican serving gave +320 hunger, about 3 kcal per point, so about 2,700-2,900 kcal/day.
- **Spread:** firewood bought at $0.02 and sold at $0.01. Three armloads sold for $0.03 against $0.06 paid, so 50% each way. Purse went $50.00 to $37.71 with no income.
- **Load classes:** Medium 33.4-36.5 kg, Heavy 40.7-49.4 kg, Staggering 69.2 kg. A firewood armload is about 9 kg and bulk 20.
- **Rest drain:** about 40/hr at leisure, about 110/hr when Heavy and active (335 to 225 to 115 to 5 over 3 hours). Exhausted is easy to reach. Bed sleep of 7 hours restored 223 to 986.
- **Gear:** a full two-week kit costs under $12. The $50 is mostly unspendable on useful survival gear.

## 9. Regression checklist
- **Outfitter sells real camping gear: FIXED.**
  - "Blanket, wool, 3-point: $3.00", "Oiled-canvas fly, 8×10: $3.00", "Wall tent, 9×9, with fly: $12.00", "Oilcloth ground sheet: $1.00".
  - "Camp kettle, nesting pair: $0.75", "Felling axe (Hollister & Sons): $1.50", "Glass lantern, lard-oil (Fenwick): $1.50".
  - Also canteens, a Dutch oven, a fishing set, salt, matches and traps. There is no literal "bedroll".
- **Camp several nights away from town: FIXED.**
  - 3 nights with "Make camp and sleep here [activity:sleep]". `wait` stopped for hunger and thirst but never relocated me.
  - In town, `sleep` still walked me to the tavern bed: "Money: purse −$0.25, household +$0.00 — Tavern bed: $0.25".
  - Water is the real blocker.
- **Containers obey capacity: STILL BROKEN (partly).**
  - Knapsack, kettle and hardtack into the canteen are refused (bad message).
  - Cheese went into a canteen holding water, and the canteen was later refilled to 1900 ml with the cheese still listed inside.
- **Partly eaten food loses weight: FIXED, in whole-unit steps.**
  - Pemmican "3 lb; 1362 g ... 7.756 servings" became "2 lb; 908 g ... 5.756 servings".
  - Load went 42384 g to 40350 g.
  - Bacon at 1.588 of 4 servings still shows 454 g.
- **'Staggering' has effects: FIXED.** The same tavern-outfitter hop went from "(2 min on foot)" to "(4 min on foot)" at 69.2 kg. Rest drain was higher (-110 on the buy hour, 572 to 462, against -39 on the walk hour).
- **Money supply sane: FIXED for the spread; COULDN'T TELL on wages.** The buy/sell spread is 50%, and no money appeared. I never worked.
- **Fishing / foraging / wood: MIXED.**
  - Wood FIXED: "You gathered 1 Armload of firewood", +9 kg per hour.
  - Fishing FIXED: "You gathered 1 Brook trout, fresh" on the second try. The first try, while Exhausted, gave nothing.
  - Foraging STILL BROKEN or COULDN'T TELL: "You gathered nothing" twice (#107, #171).

## 10. Story
Ellis spent three days and $12 building the perfect camp: blanket, ground sheet, hatchet, rod, a $0.30 gourd canteen, and 22 days of bacon and hardtack. He slept under the stars on East Bluff. The next day he reached a place called Lantern Spring, Parched, with his canteens bone-dry. The game told him: "No accessible water; fetch water at your lodgings or go to a water source." He was standing in the Spring. He walked back to the tavern pump and learned the two-week trip was a 1.5-day trip. He spent a later night on Huldra's Shelf, "the bells keep away", and the bells did, but his thirst did not.

## 11. Top 5 recommendations (ranked)
1. Fix wilderness water. Allow `drink` and `fill` at springs and creeks, document `fill`, make `fetch_water` fill containers instead of teleporting, show stored-water hours on the Kit Sheet, and let camp sleep be interrupted for water.
2. Make the Kit Sheet trustworthy. Fix "Food 0.0 days" and make the days figure use the kcal/day it prints. Explain "malnourished". Tune standing eat so it does not under-feed or burn the sugar.
3. Make food choices matter. Bacon dominates, so differentiate with protein or morale, warm-weather spoilage or cost. Give prep a visible payoff and event. Let the player inspect shop goods before buying.
4. Cut action overhead. Let `buy` take multiple lines or less than an hour, make `pack` and `fill` bulk or add a "pack for trip", stop charging an hour per standing change, and show the current standing orders.
5. Polish containers and messages. Reject solid food in a liquid-filled container and re-check capacity on fill. Say why a pack is refused. Remove the raw JSON from `inspect`. Fix the "pantry is nearly bare" line. Check forage yields (0 for 2).