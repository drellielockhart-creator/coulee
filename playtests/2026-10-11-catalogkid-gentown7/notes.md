# Catalog Kid running playtest notes

FAIR, generated town seed 7, Ellis Wayfarer. All game knowledge came from the session CLI. No source, content, design documents, or other reports read. Numbers below are submitted game-command attempts; rejected attempts count. Initial --new and final --verify are administrative calls.

## Attempts 1–3: initial kit

Help, plan, inspect hardtack. April 1 00:00, $50, 33°F dry. Medium load: 33.374 kg, bulk 64.5. Starter knapsack, blanket, kettle, canteen, two armloads wood, 4 lb hardtack, 3 lb pemmican, 2 lb dried apples. Plan: 6.8 days, 16,599 usable kcal, 1,980 kcal/day, fuel 2 days, apples spoil first in 540 days. Division gives 8.38 days; projection assumptions unclear. Hardtack inspection: JSON, 1,816 g / 12 servings, no nutrition or recipe requirements.

## Attempts 4–17: store discovery

Wait to 06:00; go to Crane General Store; inspect store; page all 212 actions. Seven foods purchasable: flour 5¢, cornmeal 3¢, pork 13¢, beans 4¢, apples 11¢, potatoes 1¢, cheese 13¢. No gear purchase actions. The food catalog sits on pages 9–10.

## Attempts 18–41: sample purchases

Inspect actor and containers. Hardtack/knapsack purchase attempts 21–22 refused. Buy one pound of each food and plan after each purchase. Every bought pound is 454 g. Cornmeal adds 1,599 usable kcal; potatoes 351; flour/beans zero with generic unpreparable warning; cheese 1,800; pork about 3,401 after correcting for an automatic 397 kcal meal; dried apples 1,098. Forecast potato shelf life 249.6 days at 39°F, 149.7 at 45°F; cheese 119.7 at 47°F. Canteen: 1,900 ml water, 2,354 g. Kettle: 3,320 ml water, 4,681 g. Knapsack: 1,361 g. Capacities absent.

## Attempts 42–55: preparation and outfitting

Meal explain prints only target/ration labels. Flour bake and beans boil refused. Cornmeal boil at 45 immediately feeds 533 hot kcal and consumes 300 ml water: cook also means eat. Raw cornmeal refused. Hardtack soak at 48 feeds 550 cold kcal and consumes 250 ml water. Potato into full canteen at 50 accepted, bulk reduced 0.5, no water displacement shown. Buy 4 lb pork for 52¢ and 2 lb cheese for 26¢. Total nine food purchases $1.28. April 1 19:00: 15.7 days, 37,918 kcal, 1,980 kcal/day, 27.674 kg, bulk 55.2, $47.42. Automatic evening cooking removes potato and reduces wood qty 2→1. Flour and beans remain blocked. Fuel projection says no cooking fuel required.

## Attempts 56–75: first failed camping attempt

Go 4 ambiguous with go:24; exact go:4 works. Raw hardtack feeds 550 kcal. Hot methods now absent. Wood qty 1 weighs 9,072 g but has only 5 fuel units remaining. Kettle water now 1,724 ml. On ridge at 21:00, wait 12h moves me back to tavern at 22:00, sleeping, and spends 25¢. Journal describes less than a day of food at start despite pack forecast 6.8 days.

## Attempts 76–98: household and pack mismatch

Explicit Sleep on ridge at 78 also returns to tavern despite blanket. Fetch water at tavern does not increase carried water. Explain prep failure 87: “Cannot prepare food: 0 () -> failure”. Go to spring quenches thirst; fetch_water at 89 returns to tavern, kettle still 1,724 ml. Chop wood at 81/91 does not add carried fuel. Automatic preparation fails with about 15 days usable pack food; Hunger reaches 173 at April 3 05:00. Waits stop after need bands or social events, often only 1–8 hours.

## Attempts 99–118: manual feeding and bulk

Tavern menu has 309 actions. Raw pork appears on page 15; typed eat salt_pork fails but exact eat:172:raw at 113 works and feeds 850 kcal. Pemmican at 103 feeds 867 kcal. Total weight stays 27.674 kg after both servings, 1,717 kcal consumed. Packing wood into knapsack at 109 reduces bulk 55.2→35.2; weight unchanged. Bag into canteen refused after wood is inside. April 3 18:00, forecast 14.5 days, $46.52. Another ridge wait returns me home to sleep.

## Attempts 119–136: rain and packaging

Advance with waits and daily plans. April 4 13:00: rain, 50°F, cheese forecast 117.9 days. April 5: East sandstone face in rain. Packing 2 lb cheese into canteen moves just 1 lb into new stack #231 and leaves #173 with 1 lb, without clear partial-move feedback. Outdoor automatic meal succeeds: 1,285 cold kcal, unlike repeated home prep failures. Bulk 35.2→34.2. Cornmeal briefly spoils first in 70.6 days, then next morning cheese first in 292.1 days. Nothing fully spoils.

## Attempts 137–156: rations and matched cheese

Same 34,365 usable kcal: ration 50% gives 27.5 days / 1,285 kcal/day; 150% gives 9.9 days / 3,855 kcal/day; restored 100% gives 14.1 days. No immediate explanation of underfeeding consequences. April 6 09:00, packed cheese spoilage 25 versus loose cheese 26, both dry. Cornmeal has 2 servings left but still weighs its original 454 g for 3 servings. Full canteen retains 1,900 ml while holding cheese. Bag into canteen refused after cheese is inside; some capacity enforcement exists. April 7 08:00: $43.72, 34,365 kcal, 14.2 food days, 27.674 kg. Tavern purchases preserve carried food.

## Attempts 157–174: end

Final ridge outing: one hour Forage adds no carried food; Chop wood returns to tavern, portable fuel still 5 units. Manual drink quenches thirst from local water, no carried load change. End April 8 06:00: 7 days 6 hours, $43.07, 34,365 usable kcal / 1,980 kcal/day, 14.0 food days, 27.674 kg, bulk 34.2. Packed cheese spoilage 31 versus loose 36; cornmeal 29. No fully spoiled food. Week journal discusses under-one-day larder and ration cut despite full pack and restored 100% rations. Household-versus-pack scope is confusing.

## Replay and numbering

174 submitted attempts = 156 accepted commands plus 18 rejected. Session log retains all 156 accepted records. --verify passed: “Verified 156 commands; final hash 68dc9e1c7edaaa0c.” Final report uses accepted command ordinals, excluding the session header.

Key accepted ordinals: initial plan 2; buy cornmeal 22; boil cornmeal 41; soaked hardtack 43; potato into canteen 45; bulk buys 48–50; raw hardtack 52; ridge 56; wait return 62; Sleep return 67; fetch water 73/78; explain failure 76; pemmican 90; pork 97; wood packing 94; rainy cheese packing 114; matched cheese inspections 125/126 and 153/154; cornmeal 127/155; final plan 152; final journal 156.

Post-play repository gate: `just check` completed successfully (exit 0). Its output was redirected to /tmp/coulee-catalogkid-check.log and was not read for playtest information. Report has all ten requested sections; session commands.jsonl, metrics.jsonl, and transcript.txt remain in place.
