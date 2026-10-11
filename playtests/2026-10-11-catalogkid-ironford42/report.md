# Catalog Kid / Min-maxer — Iron Ford 42

## 1. Persona, world, mode, days played, number of commands

Catalog Kid / Min-maxer: the camping-catalog and Player’s Handbook kid, looking for a numerical reason to choose each item. Ellis Wayfarer in authored Iron Ford, seed 42, FAIR throughout. Played April 1 00:00 through April 8 16:00: **7 days 16 hours**. **170 command attempts** in transcript.txt, including queries and rejected inputs; additionally started the session and requested --verify. No source, content, design documents, or other reports were read. No game files were edited.

Session: `/home/eleanor/projects/coulee/playtests/2026-10-11-catalogkid-ironford42/session`. Command indices below count the `> command` lines in transcript.txt, starting with help as #1. Rejected commands appear there but do not necessarily appear in commands.jsonl.

## 2. Summary: what I did and how it went

I started with $50 and an already supplied newcomer kit: knapsack, wool blanket, nesting kettle, full canteen, two armloads of wood, four pounds of hardtack, three pounds of pemmican, and two pounds of dried apples. The initial Kit Sheet forecast 6.8 days, 16,599 usable kcal, 1,980 kcal/day, two days of fuel, 33.374 kg and bulk 64.5 (Medium).

I bought cornmeal, cheese, ten pounds of parched corn, beans, salt pork, an oilcloth bag, frying pan and matches. For just $0.40, the parched corn added 17,000 usable kcal and raised food from 8.9 to 14.3 days. I left for Upper Lantern Coulee with $46.53, 41.922 kg, bulk 81.8 (Heavy), 44,240 usable kcal, and a 14.7-day forecast. Later I bought a tin canister, flour and tinned oysters. I tested raw/soaked hardtack, boiled pemmican, boiled/fried cornmeal, raw/fried bacon, and raw oysters, checking plan repeatedly.

**P8 has real machinery, but this play interface makes much of the decision work inaccessible.** Containers reduced spoilage; cooking spent fuel and eventually became unavailable; weight crossed an encumbrance category. Yet inspecting products does not show their nutrition, preparation costs, capacity or protection. The everyday schedule repeatedly returned me to the tavern, so I could not carry out a sustained wilderness expedition. Automatic tavern meals preserved the reserves while spending cash.

At the end I had $39.78 and 34,463 usable kcal, with 13.6 days forecast. No food spoiled. This is not evidence that a 14.7-day wilderness forecast was accurate: most elapsed days were spent eating tavern meals. The 115–540-day spoilage horizons were beyond the playtest window.

## 3. Fun moments: verbatim game text

The catalog names delivered the pleasure I came for:

> Buy Flint, steel & char tin ($0.25)

> Buy Sewing kit ("housewife") ($0.25)

The boiled pemmican gave a satisfying, concrete result:

> Meal: 867 kcal (hot)

The town had a better little story than my thwarted expedition:

> Mrs. A. Pratt has pressed Mr. J. Brenner for $6.40, and in company. The account is long standing and the patience short.

> We are glad to report that Mr. J. Brenner has paid Mrs. A. Pratt what was owing, to the last cent. The affair, which threatened to turn into something worse, has gone back to being a ledger.

## 4. Confusion

- The Kit Sheet is an inventory plus aggregate forecast, not the comparison sheet I wanted. No kcal/lb, protein/fat, preparation minutes, water/fuel per serving, base shelf life, container capacity, or protection factors were exposed by inspect. Unowned cornmeal and cheese could not be inspected at all (#21–22).
- Food days do not follow the displayed division: initially 16,599 / 1,980 = 8.38, but the headline says 6.8. At departure 44,240 / 1,980 = 22.34, but it says 14.7. Projection constraints may explain this; the interface does not tell me which ones bind.
- Buying beans created “Some food cannot be prepared with the available cookware, fuel, water, or time.” Which food, which missing resource, how much? The beans had no eat action even when I owned a kettle, water and fuel. Both attempted boil commands were rejected. `explain 2857` answered only “Cannot prepare food: 0 () -> failure”.
- The offered food actions say prepare-and-eat. My `cook` attempts failed, and I found no way to produce a batch for later, schedule a long bean cook, or soak overnight.
- Names work differently across verbs. `buy salt_pork` succeeded, but `eat salt_pork` failed; `eat bacon` worked. `buy flour 2` was ambiguous with a flour sack, while `buy:flour` worked.
- Packing a stack moves one unit and splits it. Neither the response nor help explains that. After packing cheese, I had one pound protected and one loose.
- The week-one journal said the ration was cut to 50 and the larder fell below a day. I never changed my ration setting and my Kit Sheet never fell below 6.5 days. This may describe the lodging household, but the scope is not labeled.

## 5. Boredom

The shop inventory first appeared on menu page 10, behind inspections, travel, occupations and social actions. By day eight there were 521 available actions at the tavern. Browsing packing combinations is particularly noisy.

Long waits repeatedly stopped for conversations, movement and need bands. A requested day could advance one hour. I spent many commands resuming waits instead of making provisioning decisions. The same generic preparation warning persisted through almost every observation after buying beans.

Most shelf lives were so long that spring provisioning never felt threatened by rot. The oilcloth and tin canister made numerical differences, but neither prevented a loss that would otherwise have occurred during this trip.

## 6. Bugs: expected versus actual, command indices and repro

All cases below use the session directory given in section 1. Replay verification status is recorded at the end of this report. These are observed interface/behavior defects or explicitly labeled suspected defects; no implementation diagnosis was attempted.

### B1 — High: wilderness actions relocate the expedition to town

**Indices:** #48–56, #62–64, #72–74, #142–143. Expected: sleeping in a wild place should either camp there or state that wilderness sleeping is unavailable. Fetching water should identify a water source or fail. An expedition should be able to remain outdoors between commands.

Actual: after going to Upper Lantern Coulee, `sleep` arrived at Dunleavy’s Tavern in one hour and charged $0.25. `activity:fetch_water` likewise returned to the tavern. After foraging at Huldra’s Shelf, the next `wait 1d` returned me to tavern work. After going to The Cold Stair, the next wait returned me to a paid tavern meal.

Repro: replay through #55, issue `sleep`; separately #62 followed by `activity:fetch_water`, or #142 followed by `wait 1d`. The transcript records arrival events and the location/cash changes. This blocks the requested two-week field test, whether caused by lodging rules or routine arbitration.

### B2 — Medium: directional packing input is treated as unordered

**Index:** #140. Expected: `pack knapsack into canteen` resolves the stated direction. Actual: “Ambiguous: pack:308:311, pack:311:308”.

Repro: at an unlocked activity state with the starting knapsack and canteen, enter that exact command. The stable action ID worked at #167. This is not ambiguity between two knapsacks; it is ambiguity with the reverse operation.

### B3 — Medium: a full canteen accepts an army knapsack and conceals its bulk

**Indices:** #167–169. Expected: a full 2-quart water vessel rejects a knapsack or explicitly explains an abstract packing rule. Actual: `pack:308:311` succeeded; inspect showed knapsack depth 1/containerId 311. Total bulk fell **45.0 → 43.0**, while load remained **24.638 kg**. The canteen was last observed holding 1,900 ml, and no emptying operation occurred.

Repro: issue `pack:308:311`, then `plan` and `inspect knapsack`. The action was offered in the menu as early as #17. Empty soft bags can fold, but this still needs a volume/water compatibility explanation; the current menu encourages physically surprising bulk reduction.

### B4 — Medium: preparation failure has no actionable explanation

**Indices:** #31, #46, #55, #64, #71, #122. Expected: identify beans and the missing requirement, including duration if it exceeds one command. Actual: generic warning; rejected commands say “No available food/preparation matches”; the failure event explain gives no inputs. Beans are purchasable but no prepare action appears for them.

Repro: buy two beans with the starting kettle/canteen/wood, inspect the available food actions, and try `cook beans 1 boil`. At #71, `explain 2857` reproduces the empty explanation. The restriction may be legitimate; the absence of an explanation is the defect.

### B5 — Medium, suspected forecast presentation defect: cooking makes totals difficult to reconcile

**Indices:** #119, #125–130, #136–138. Expected: a 533-kcal cornmeal meal should expose its intake and any projected loss from depleted preparation resources. Fuel coverage should disclose when it changes the assumed menu.

Actual: before frying, plan showed **42,937 usable kcal, 14.7 food days, 1.1 fuel days**, and wood had **45 units**. After one 533-kcal fried serving, wood had **15 units**, but plan showed **36,318 usable kcal, the same 14.7 food days, and 1.5 fuel days**. The unexplained usable-energy drop was **6,619 kcal**, or **6,086 beyond intake**. After bacon exhausted the wood, plan said “Fuel: no cooking fuel required by projected meals” while still warning that some food could not be prepared and rejecting flour preparation.

Repro: replay through #126, fry one cornmeal serving, then plan and inspect wood. Replay through #136 for the no-fuel wording. A changed projected meal mix could explain the numbers; this report does **not** assert actual inventory calories were destroyed. It reports the missing bridge between consumption, usable stock and forecasts.

## 7. Exploits

- **Bulk hiding:** #167 packs the knapsack into a canteen and removes two bulk units. I confirmed this one case; I did not test recursive loaded-pack compression.
- **Cheap raw calories:** parched corn supplies 42,500 kcal per dollar and has a raw option. My $.40 purchase alone added 17,000 kcal without cookware dependence. It looks like the default budget staple, not a proven universal winner: protein/fat and monotony consequences were not shown well enough to establish nutritional dominance.
- **Town fallback:** wilderness sleep/travel routinely returns to a warm, watered tavern. This preserves carried food while charging modest fees. It is chiefly an expedition blocker rather than a free-money exploit.
- Matches still had all **100 supply units** after several hot meals (#139). I could not establish a benefit from buying them; ignition might be abstracted or town fires might supply it. Do not infer that they never matter elsewhere.

## 8. Balance notes, with numbers

### Food comparisons available from play

All pound measures observed were 454 g. Values marked “inferred” multiply observed servings per pound by observed meal kcal; they are not a hidden catalog read. Preparation requirements below are only what I successfully demonstrated. Protein and fat quantities were unavailable.

| Food | Price | Observed/inferred kcal per purchase unit | kcal/$ | kcal/kg | Preparation observed |
|---|---:|---:|---:|---:|---|
| Parched corn | $.04/lb | 1,700, measured purchase delta | 42,500 | 3,744 | Raw and boil offered; raw reserves useful without fuel |
| Cornmeal | $.03/lb | ~1,600, inferred from 3 servings and 533-kcal meals | ~53,333 | ~3,524 | Boil and fry both 533 kcal, hot; fry consumed 30 fuel units |
| Cheese | $.12/lb | 1,800, measured purchase delta | 15,000 | 3,965 | Raw offered; fry offered with pan/fuel |
| Hardtack | $.08/lb | ~1,650, inferred from starting servings and 550-kcal meals | ~20,625 | ~3,634 | Raw and soaked both 550 kcal, cold |
| Pemmican | $.30/lb | ~2,600, inferred from 3 servings/lb and rounded 867-kcal meal | ~8,667 | ~5,727 | Raw offered; boiled 867 kcal, hot |
| Salt pork | $.12/lb | Not established per lb | Not established | Not established | Raw and fried both 850 kcal per tested serving |
| Tinned oysters | $.35/tin | 310, inferred from 2 servings at 155 kcal | ~886 | ~574 including 540-g package | Raw 155 kcal, cold; fry offered |
| Dry beans | $.04/lb | Not established | Not established | Not established | No usable preparation action found |
| Flour | $.05/lb | Not established | Not established | Not established | Fry offered while fueled; unavailable after fuel exhaustion |

Cornmeal beats parched corn on nominal calorie price but needs preparation. Pemmican earns a reason to exist through calorie density and low bulk: starting three pounds weighed 1.362 kg and occupied bulk 1.5, versus hardtack’s four pounds/1.816 kg/bulk 4. Thus **one food is not obviously best on every axis**. However, the cheap raw option makes fuel and cookware optional for many meals, and the hidden nutrition terms prevented me from judging the cost of a mostly-corn diet. Oysters are about 48 times worse than parched corn on calorie price; their appeal needs another visible payoff.

### Load, containers and fuel

| Item/choice | Price | Weight/bulk observed | What mattered |
|---|---:|---|---|
| Army knapsack | $1.50 catalog | 1.361 kg / 2 | Capacity/protection absent from inspect; could pack into canteen |
| Full tin canteen | $.75 catalog | 2.354 kg / 3; 1,900 ml | It stayed full during town cooking tests |
| Oilcloth bag | $.60 | 227 g / 1 | Packed cheese spoilage 24 vs loose 38 by April 8 |
| Airtight tin canister | $1.20 | 680 g / 3 | Packed cornmeal spoilage 18 vs loose 28 by April 8 |
| Starting firewood | Already owned | 18.144 kg / 40 for two armloads | More than half the original load; exhausted after hot-meal tests |

Packing one pound of cheese reduced total bulk **82.8 → 81.8**, with unchanged 42.472 kg. Packing cornmeal into tin preserved weight and concealed its external bulk. Protection is real: oilcloth cheese’s final spoilage was about **37% lower** than loose cheese; tin cornmeal about **36% lower** than loose cornmeal. These stacks began together, but differed in consumption and time of packing, so these are observed endpoint comparisons rather than isolated material-effect coefficients.

Fuel is a major weight decision. One armload remains a full 9.072-kg load while partly consumed, then disappears at exhaustion. Frying bacon removed the final armload and changed load **33.710 → 24.638 kg**. A clearer remaining-fuel weight readout would help pack planning. Buying a pan pushed the outfit farther into Heavy; depletion returned it to Medium. No travel-time penalty was evident in the one-hour moves I tested.

### Spoilage and forecast checks

- Initial earliest spoilage: dried apples **540 days**. Buying cornmeal: **359.6 days**. Buying cheese: **299.6 days** in the cold morning, later **119.6** around 50°F. April 8: cheese **115.3 days** around 52°F. These look like current-condition projections; warmer hours change the estimate sharply.
- No food spoiled during 7 days 16 hours, consistent with every displayed earliest-spoil horizon being far outside the test. I could not validate an actual spoil date.
- Departure April 1 20:00: **14.7 days / 44,240 kcal**. April 2 04:00: **15.1 / 43,707**, with daily demand now 2,570 rather than 1,980. April 4 19:00: **15.0 / 41,492**. April 8 16:00: **13.6 / 34,463**, daily demand 1,980. Forecast changes do not function as a simple countdown, and purchased tavern meals prevent a clean endurance comparison.
- Cash: $50 → $46.53 at first departure → $39.78 final. Cheap provisions barely challenged $50. The scarce resources felt like kilograms, preparation availability and command attention, not money.

### Catalog gaps I wanted

The displayed catalog was extensive: matches and safe, flint/steel, tinder, candles/oils/lanterns, pans/kettles/oven, sacks/kegs/crocks/canisters, multiple packs and blankets, tents, knives, axes, compass and sewing kit. I did not find a fishing line/hook kit, salt as a standalone cooking supply, spoon/cutlery, or small repair cord/rope. Those are player expectations for an 1855 travel catalog, not claims that historically precise omissions were proven. More valuable than adding items now would be exposing uses for the items already present.

## 9. Was there a story worth retelling?

I went to Pratt’s to buy fourteen days of hill food and discovered that forty cents of parched corn could do most of the numerical work. While I compared corn and cheese, Augusta Pratt publicly called in Johann Brenner’s $6.40 debt, and by the next hour the account was settled. I headed for the coulee carrying forty-two kilograms, cooked a little, and requested sleep; the game put me back into a paid tavern bed. Over the week my great wilderness expedition became a series of aborted departures and well-fed town routines. The final absurd souvenir was an army knapsack successfully tucked into my water canteen.

## 10. Top five recommendations, ranked

1. **High — Make expedition commands persist outdoors.** Give camping/rest, local water and fuel collection explicit place-aware outcomes; preserve an intentional trip across the next routine tick. This is necessary to test whether packing decisions survive actual field use.
2. **High — Make the Kit Sheet a real comparison and explanation surface.** Inspect shop goods before purchase; show kcal/$, kcal/kg, protein/fat, servings, preparation time/water/fuel/cookware, shelf-life assumptions, and container capacities/protection. Identify the exact constraint behind food-days and every preparation warning.
3. **Medium — Make packing directional and physically legible.** Fix reversed-input ambiguity; reject incompatible water-vessel contents or explain the abstraction. Support packing quantities and show the resulting contents/capacity directly.
4. **Medium — Explain forecast menu changes and fuel exclusion.** Separate edible raw stock, stock requiring preparation and projected usable stock. Say “out of fuel; projecting cold meals” rather than implying no fuel is needed, and explain the 6,619-kcal projection change after a 533-kcal meal.
5. **Medium — Give food and gear tradeoffs visible consequences within a trip.** Show nutritional deficits, meal comfort, ignition and water costs; let a long bean preparation complete. Keep parched corn’s attractive niche, but make the reason to carry pemmican, cheese, cookware, waterproof storage and fresh food assessable. Add a compact shop menu and less interruptive multi-day waiting so the player spends attention on these decisions.

Verification: `just run play --session /home/eleanor/projects/coulee/playtests/2026-10-11-catalogkid-ironford42/session --verify` exited 0: **“Verified 152 commands; final hash b1c1f370c723c83a.”** All accepted recorded commands replayed deterministically; this does not adjudicate the design intent of reported behavior. The 170 transcript attempts include rejected inputs and CLI queries that are not all replay records.


Repository gate: `just check` exited 0; 41 test files / 391 tests passed, invariants passed. No game-code changes were made.
