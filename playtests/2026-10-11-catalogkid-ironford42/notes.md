# Catalog Kid FAIR playtest notes

Only session CLI observations used. Iron Ford seed 42; Ellis Wayfarer; started April 1 00:00 with $50, 33.374 kg, bulk 64.5, Medium. Initial plan: 6.8 days, 16,599 usable kcal, 1,980 kcal/day, fuel 2 days, dried apples spoil first in 540 days. The kcal division is 8.38 days, so the 6.8 forecast evidently includes other constraints not explained.

Help: actions take one hour, queries no time; sleep locks four hours. April 1 07:00 at Pratt's after sleep, wait, travel: purse $48.70 despite only explicit bed charge $0.25; automatic 594 kcal hot meal on travel. Plan dropped to 6.5 days. No clear itemized cash explanation.

Catalog found on actions pages 10–13, after many pages of inspect/travel/work/social options. Foods: hardtack $.08, flour $.05, cornmeal $.03, salt pork $.12, pemmican $.30, parched corn $.04, green coffee $.14, tea $.60, sugar $.08, dried apples $.10, dry beans $.04, cheese $.12, tinned oysters $.35. Extensive authentic gear incl matches, flint/steel, tinder, lanterns, pans, oven, containers, blankets, tents, tools. Cannot inspect unowned cornmeal or cheese: no available action matches.

Owned inspect shows stack state, not catalog nutrition or prep requirements: hardtack 4 lb/1,816g/bulk4/11.514 servings; pemmican 3 lb/1,362g/bulk1.5/9 servings. Knapsack 1,361g/bulk2; no capacity/protection shown. Canteen 2,354g including 1,900ml, bulk3. Menu offers putting knapsack into kettle or canteen.

April 1 shopping: cornmeal 2lb $.06; cheese 2lb $.24 adds 3,600 usable kcal; parched corn 10lb $.40 adds 17,000 kcal, 4.54kg, bulk8. Forecast 8.9 ->14.3 days. Beans 2lb $.08 gives no increase in days, generic preparation warning. Salt pork 2lb $.24 ->16.3 days. Oilcloth bag $.60/227g/bulk1; frying pan $.50; matches $.05. Departure purse $46.53, 41.922kg, bulk81.8, Heavy; forecast14.7 days/44,240kcal/1,980 daily; fuel1 day; cheese earliest298.7 days. Cheese forecast changed299.6->119.6->298.7 as weather changed.

Packing cheese split off ONE lb into bag, preserving weight and reducing total bulk by1. No qty offered in help. Hardtack raw and soaked both550kcal cold; pemmican boiled867kcal hot. Cornmeal boiled533kcal hot. Explain only gives intake total and names of modifiers; no water/fuel cost. Dry beans boil rejected (both identifier and beans name). One cornmeal serving depleted one whole9.072kg armload in visible weight; firewood supply units before was70 (2 armloads), after one armload survives.

Sleep in Upper Lantern Coulee teleported me to Dunleavy's Tavern in one hour and charged$.25. This undermines wilderness test. Wait12h stopped after6h due thirst band. At April2 04:00 plan15.1 days/43,707kcal/2,570 daily; fuel1.2 days. Packed cheese spoilage4, still4000 servingsPm.

April4 19:00 packed cheese spoilage12 vs loose18: real protection difference, but no near-term spoilage. Food15.0 days/41,492kcal despite elapsed3.8days from departure forecast14.7; tavern meals preserve reserves (purse44.13). Sleeping locks hide travel actions; CLI just says no available action. Persistent schedule returns me to tavern after foraging/wait and even fetching water.

April5 bought tin canister$1.20/680g/bulk3; packed one lb cornmeal, reducing bulk. Bought flour$.05, oysters$.35. Beans never have an eat menu action: hidden preparation time restriction presumably. At13:00 plan14.7days/42,937kcal/fuel1.1days. Fry cornmeal533kcal hot: firewood45->15 units, canteen stays1900ml (town water); plan usable kcal42,937->36,318 (loss6619 for533 intake), food stays14.7days, fuel increases1.1->1.5days despite consuming30units. Strong forecast inconsistency to investigate. Eat salt_pork rejects despite buy salt_pork accepting: likely only display name matches food parser. Oysters155kcal serving, cold.

Final April8 16:00 (7 days16hours),170 transcript command attempts plus start and verify. Purse39.78; food13.6days/34,463kcal/1,980daily; load24.638kg/bulk43 after exploit. Oilcloth cheese spoilage24 vs loose38; tin cornmeal18 vs loose28. Oysters partly eaten still spoilage10/540g/one serving remaining; no opened status shown. No food spoiled; earliest forecast115.3days. All long-horizon spoilage estimates beyond test, cannot validate actual spoil date.

Confirmed exploit: stable pack:308:311 packs army knapsack INTO FULL 2qt canteen, reduces bulk45->43 with unchanged24.638kg. Inspect shows depth1/container311. Natural-language pack knapsack into canteen says ambiguous with reverse operation. Matches stayed100 after multiple hot meals; their value was not demonstrated. Fuel exhausted frying bacon850kcal hot (raw also850); cooking flour now rejected. Forecast fuel text says no fuel required while unpreparable food remains. Week1 journal says ration cut50 and larder underone day even though player's Kit never below6.5days and never changed rations: possibly household scope, unexplained.

Verification completed: exit0, Verified152 commands; final hash b1c1f370c723c83a. Report written.
Required just check completed exit0;41 test files/391 tests passed;invariants passed.
