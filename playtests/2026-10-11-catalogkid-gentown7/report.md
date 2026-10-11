# Catalog Kid / Min-maxer — generated town 7

## 1. Persona, world, mode, days played, number of commands

Catalog Kid: I wanted to lay out my gear, calculate calories per cent and per pound, and disappear into the hills for a fortnight. Ellis Wayfarer, procedurally generated ford town, world seed 7, FAIR throughout. Played April 1 00:00 through April 8 06:00, 1855: **7 days, 6 hours**.

**174 submitted game-command attempts: 156 accepted, 18 rejected.** Initial `--new` and final `--verify` are additional administrative calls. No forks. Used only the stateless session CLI for play; read only my own session log afterward to reconcile command indices. No source, content, design documents, or other playtest reports read. The repository check was run after play, with its output redirected rather than used as game information.

Session: `/home/eleanor/projects/coulee/playtests/2026-10-11-catalogkid-gentown7/session`.

Numbering below means the ordinal among `type: command` records in `commands.jsonl`, excluding its session header. Rejected commands have no such record; their submitted-attempt number is identified separately. Running notes use submitted-attempt numbers.

Replay verification passed: **`Verified 156 commands; final hash 68dc9e1c7edaaa0c.`** Verification confirms deterministic replay, not correctness of the observed behavior.

Post-play repository gate: **`just check` passed (exit 0)**. All session artifacts remain in place.

## 2. Summary: what I did and how it went

P8 matters in some calculations, but I could not make it govern the intended trip. The starter kit had a knapsack, wool blanket, nesting kettles, canteen, two armloads of wood, hardtack, pemmican, and dried apples. It weighed **33.374 kg**, bulk **64.5**, Medium load, with **16,599 usable kcal**, **6.8 forecast food days**, and **2.0 fuel days**. Firewood alone accounted for **18.144 kg**.

I browsed all 212 store actions, purchased one pound of each of its seven foods, measured changes with `plan`, then added four pounds of pork and two of cheese. Those nine purchases cost **$1.28** total. By April 1 19:00, the Kit Sheet forecast **15.7 days**, **37,918 usable kcal**, and **27.674 kg**. The reduced load followed automatic consumption of a whole unit of wood and some water, despite buying more food.

I ate hardtack raw and soaked, boiled cornmeal, and ate pemmican and pork raw. Flour, beans, and later hot preparation attempts were unavailable. I tested packing into the knapsack and canteen, changed rations through 50%, 150%, and 100%, visited both limestone caps, a sandstone face in rain, and Bellwether Spring, and tried fetching water, chopping wood, and foraging.

Waiting on a ridge and explicitly choosing Sleep both returned me to the tavern. Fetch water at the spring also returned me to the tavern without increasing carried kettle water. Most later meals came from automatic tavern purchases. Consequently this is a test of outfitting, preparation, packaging, and the obstacles to a wilderness test—not proof that my kit lasts fourteen unsupported days.

Finished with **$43.07**, **34,365 usable kcal**, **14.0 forecast food days**, **27.674 kg**, bulk **34.2**. Nothing fully spoiled. The budget remained comfortable; agency and information were the constraints.

## 3. Fun moments: verbatim game text

The product names delivered exactly the camping-catalog appeal:

> Knapsack, painted canvas, army pattern

> Camp kettle, nesting pair

The preparation result was satisfying and concrete:

> [1173] Meal: 533 kcal (hot) — explain 1173

The place and calendar had flavor:

> Sunday, the 1st of April, 1855. The Sabbath under a full moon; the evening service will want no lantern.

My supposedly numbers-only expedition developed an unexpected social life:

> I made eyes at Timothy Costello at The Wagon Bell Tavern on Saturday in the forenoon. My heart did a thing it has no business doing in a person of sense.

And this was a good little human moment:

> Honora Sheehan came by again with something for the pot, and would not stay to be thanked. I am learning to let a gift be a gift.

## 4. Confusion

- `inspect` shows internal-looking JSON, including `servingsLeftPm`, `bulkTenths`, and `supplyUnitsLeft`, but no kcal per serving, protein/fat, freshness benefit, individual shelf-life estimate, container capacity, or recipe requirements. I had to infer calories by buying things and subtracting Kit Sheet totals.
- `plan` says “Some food cannot be prepared with the available cookware, fuel, water, or time.” It never names the blocked food, missing implement, required water/fuel, or preparation duration. I could not tell how to make flour or beans usable.
- `explain 2850` returns **“Cannot prepare food: 0 () -> failure”**. That explains none of the possible causes.
- `cook cornmeal 1 boil` immediately eats it. The accepted command is a `provisions.eat`; there is no visible cooked food left to pack. I expected to make tomorrow's food as well as today's meal.
- Days of food do not transparently equal usable kcal divided by displayed daily kcal. Initially **16,599 / 1,980 = 8.38**, but the forecast is **6.8 days**. Later **34,365 / 1,980 = 17.36**, but the forecast is **14.0**. A projection may legitimately differ; its assumptions are absent.
- `go 4` is ambiguous with `go:24`. `pack knapsack into canteen` matches both directions. `eat salt_pork 1 raw` fails, while `eat:172:raw` succeeds. Repeated purchases produce separate stacks, making short names increasingly ambiguous. These are interface traps, not evidence that the food itself is unusable.
- Packing a two-pound cheese stack moves **one pound**, creates a new stack, and leaves the other pound loose. The observation does not clearly announce the partial move.
- A fetched drink can quench thirst without refilling carried water. Household supplies and portable supplies appear to follow different paths, but the CLI does not explain that distinction.

## 5. Boredom

The store's seven food purchase actions were buried on pages 9–10 among social actions; later the tavern had **309 actions** and food actions were on pages 14–16. Finding my catalog took much more paging than comparing it.

`wait 1d` often advances just one to several hours before a need band or social interaction interrupts it. I repeatedly resumed waits to reach a week. The repeated generic prep warning stopped adding information after its first appearance.

After the first day, the food budget was effectively solved, and automatic trips home replaced camping decisions with tavern routines. The journal recorded local conversations, loans, and flirtation but gave little narrative attention to my deliberate packing and recipe experiments.

## 6. Bugs: index, expected versus actual, repro

All entries use the session directory above. For each, run:

```sh
just run play --session /home/eleanor/projects/coulee/playtests/2026-10-11-catalogkid-gentown7/session --verify
```

Observed result for this recorded session: **Verified 156 commands; final hash 68dc9e1c7edaaa0c.** The indicated command ordinals locate the reproduction in its transcript/log. These are observed defects or explicit suspected defects; I did not inspect implementation to determine causes.

### A. High: no usable camping path through Sleep or waiting

**Commands 56, 62, 66–67** (submitted attempts 66, 73, 77–78). Expected: a character carrying a wool blanket can choose to sleep at the ridge, or receive a specific obstacle explaining why not. Actual: `go:4` reaches West limestone cap; `wait 12h` advances only one hour and moves Ellis to the tavern, where a bed costs 25¢. The next morning `go:4` followed by `sleep` likewise moves him back to the tavern. Sleep's listed action gives no warning that it includes a return journey.

Repro: trace `go:4` → `wait 12h` and later `go:4` → `sleep`. This may be an unsupported camping feature rather than a broken rule, but it blocks this playtest's central activity.

### B. High: automatic preparation fails while usable raw pack food exists

**Commands 73, 76, 85, 90, 97, 104** (attempts 84, 87, 98, 103, 113, 120). Expected: automatic feeding uses a feasible meal from available supplies, or explains why pack food is excluded. Actual: repeated `provisions.prep_failed` at the tavern while `plan` shows about **15 days / 37,368 usable kcal**. Hunger falls to **173** by April 3 05:00. Manual raw pemmican then consumes **867 kcal** successfully; exact raw pork consumes **850 kcal** successfully. Automatic outdoor feeding also succeeds at command 114 with a **1,285 kcal cold meal**.

Repro: follow the recorded waits after fuel falls to five units; inspect the failures and command 76's empty explanation, then compare manual raw meals at 90/97 and the outdoor meal at 114. Suspected household-versus-pack selection/fallback problem; the evidence does not establish the internal cause.

### C. Medium: solid provisions share a nominally full canteen with water

**Commands 45–47, 96, 114–115, 134** (attempts 50–52, 112, 130–131, 152). Expected: a two-quart canteen carrying **1,900 ml** cannot also accept a pound of solid food without displacing water or refusing the move. Actual: `pack potatoes into canteen` accepts **454 g** and reduces external bulk by **0.5**; later `pack:173:133` places **454 g of cheese** inside the canteen. It still reports **1,900 ml** of water. The food and water appear to occupy independent capacities.

Repro: trace packing command 45, then the matching cheese experiment at 114 and canteen inspection at 134. Some solid-capacity checks do exist: attempts to put the knapsack into the canteen were refused after these packing experiments. This is specifically a water/solid occupancy concern, not proof of unlimited storage.

### D. Medium: consuming fractions of supplies does not reduce their displayed mass

**Commands 41, 90–91, 97–98, 127, 155** (attempts 45, 103–104, 113–114, 144, 173). Expected: consuming food reduces carried mass proportionally; the Kit Sheet is meant to support weight optimization. Actual: cornmeal starts at **454 g / 3 servings**, and after consuming **533 kcal / one serving** still reports **454 g / 2 servings**. Consuming a pemmican serving and a pork serving, **1,717 kcal together**, leaves total load exactly **27,674 g** before and after. Remaining firewood also reports **9,072 g** despite only **5 supply units** remaining.

Repro: compare the initial cornmeal inspection at command 24 with 127/155, and plans around commands 90/97. This looks like whole-unit mass accounting; regardless of intent, it makes the displayed packing numbers misleading between unit boundaries.

### E. Medium: preparation failure explanations omit actionable information

**Command 76** (attempt 87), plus plans **29, 31, 42, 152**. Expected: identify the food, method, and missing resource or tool. Actual: “Cannot prepare food: 0 () -> failure,” accompanied by a warning listing four possible resource classes. Hot menu options disappear with no visible recipe-cost breakdown.

Repro: replay command 76 (`explain 2850`) and compare the Kit Sheet warning after flour/beans purchases. The deficiency is confirmed in the CLI output even if the underlying availability rules are correct.

### F. Low: provisioning narration does not distinguish the larder from the expedition pack

**Commands 64 and 156** (attempts 75 and 174). Expected: a personal food account is clear about which supplies it describes. Actual: the start-of-session journal claims “Less than a day of food at the worst of it” when the initial pack forecast was **6.8 days**. The week entry likewise says “the larder was down to under a day at the worst,” despite the well-stocked pack. It mentions the temporary 50% ration cut without explaining that it was restored shortly afterward.

Repro: compare initial plan command 2 with journal 64 and final journal 156. This may correctly describe a separate household larder; the bug report concerns the misleading personal account and missing scope, not a proven arithmetic error.

## 7. Exploits

**Observed storage advantage:** pack solid food into a water-filled canteen and gain external bulk reduction without losing the water. This also gives modest spoilage protection. Water displacement appears absent; see bug C.

**Likely low-effort loadout:** carry raw pork plus starter pemmican/hardtack and a little dried fruit, avoiding cooking dependence. Pork is both cheap and calorie-dense, and the observed raw serving worked. This is a strong candidate strategy, not proof of an optimal fourteen-day diet: protein/fat, monotony, freshness, and long-term illness tradeoffs were not exposed sufficiently to evaluate them.

**Ration-number temptation, not a verified exploit:** 50% rations turns **14.0 days** into **27.5 days** on the same supplies and does not immediately explain nutritional consequences. I restored 100% after testing 150%; I did not establish whether prolonged underfeeding is punished.

No unlimited-money, duplication, or infinite-storage exploit established.

## 8. Balance notes, with numbers

These calorie figures come from isolated purchase deltas where possible and manual meal observations. Every purchased unit inspected was a **454 g pound**. Figures are current usable calories, not unpublished content definitions. Price efficiency omits cooking resources and time.

| Food | Price/lb | Observed kcal/lb | kcal/$ | kcal/kg | Preparation and shelf observations |
|---|---:|---:|---:|---:|---|
| Cornmeal | $0.03 | 1,599 | 53,300 | 3,522 | Boil succeeded; 533 kcal/serving; 300 ml water used. Initial first-spoil forecast 359.6 days. Later hot option unavailable. |
| Potatoes | $0.01 | 351 | 35,100 | 773 | Added usable kcal with starter kit; automatically consumed in later hot meal. Forecast 249.6 days at 39°F, 149.7 at 45°F. |
| Salt pork | $0.13 | ~3,400 | ~26,150 | ~7,490 | Raw serving 850 kcal. Purchase delta corrected for simultaneous automatic meal gives ~3,401 kcal. Individual shelf estimate not available. |
| Swiss cheese | $0.13 | 1,800 | 13,846 | 3,965 | Raw option; initial first-spoil forecast 119.7 days at 47°F. |
| Dried apples | $0.11 | 1,098 | 9,982 | 2,419 | Raw and initially boil options. Starter first-spoil forecast 540.0 days. |
| Flour | $0.05 | 0 added usable | 0 with this kit | 0 usable with this kit | Unpreparable warning; bake and boil attempts refused. Latent calories unknown. |
| Dry beans | $0.04 | 0 added usable | 0 with this kit | 0 usable with this kit | Unpreparable warning; boil/stew attempts refused. Latent calories unknown. |
| Starter hardtack | Not purchasable here | 1,650 inferred | Unknown | 3,634 | 3 servings/lb; raw and soaked both 550 kcal/serving. Soaking used 250 ml water. |
| Starter pemmican | Not purchasable here | 2,601 inferred | Unknown | 5,729 | 3 servings/lb; raw serving 867 kcal. Boil initially listed, later unavailable. |

**There is no single winner on every metric.** Cornmeal wins purchasable calories per dollar, but needs preparation. Pork wins observed purchasable calories per kilogram and has a working raw option. Potatoes are cheap fresh-food candidates but extremely bulky per calorie. Cheese is inferior to pork on both calorie efficiencies; any balancing diet or taste benefit is not made visible. Dried apples are expensive calories; their reason to be in the pack needs a visible freshness/nutrition benefit.

For context, fourteen days at the initial displayed **1,980 kcal/day** is **27,720 kcal**. At the measured food densities, that is about **17.34 lb cornmeal / $0.52 / 7.87 kg**, or **8.15 lb pork / $1.06 / 3.70 kg**, before variety, prep, and the planner's additional assumptions. These are arithmetic comparisons, not independently validated survival kits. The $50 allowance is enormous relative to these food prices and the equipment cannot absorb it because it is not offered for purchase.

**Prep resources matter but are opaque.** Starter fuel forecast 2.0 days became 1.1 by 07:00. By evening only five supply units remained and hot methods disappeared. `plan` then said “no cooking fuel required by projected meals,” apparently reflecting a feasible cold-meal projection. That is useful adaptation, but easy to mistake for adequate fuel for the meals I actually want to cook. No explicit light-fire or replenish-carried-fuel workflow was discoverable in the menu/help.

**Packaging has measurable effects.** Wood into knapsack reduced external bulk **55.2 → 35.2** with mass unchanged. Cheese into canteen reduced it another **1.0**. Matched cheese stacks after splitting had spoilage **25 packed / 26 loose** on April 6 09:00 and **31 / 36** on April 8 06:00. This is a small but real storage benefit, not merely flavor. Capacities and protection ratings were absent from inspection.

**Spoilage did not become a decision over this week.** Nothing fully spoiled, consistent with the displayed forecasts being much longer than seven days. Forecasts change sharply with weather: cheese switched between roughly **116–120 days** in warmer conditions and **289–299 days** when colder; cornmeal briefly became the first-spoil item at **70.6 days** after a rainy outing. I cannot validate those eventual dates in a one-week run. The forecasts should label their assumed future temperature/wetness rather than look like fixed expiration dates.

**Food-duration validation is contaminated by tavern support.** April 1 19:00: **15.7 days / 37,918 kcal**. April 8 06:00: **14.0 days / 34,365 kcal**. Only **3,553 carried usable kcal** disappeared between those checkpoints over 6 days 11 hours, because most intervening meals were purchased at the tavern. This does not demonstrate that the forecast is generous or accurate. It demonstrates why a camp mode is needed to test it.

Expected catalog options unavailable at this outfitter: replacement hardtack/pemmican, alternative packs and sacks, covered food containers, a frying pan or baking implement, tinder/matches or another fire-starting kit, an axe/hatchet, fishing tackle, coffee/tea, salt, and sugar. These are persona expectations for an 1855 expedition catalog, not claims that the game's unseen content lacks them globally. The store had no purchasable gear at all in its visible menu.

## 9. Was there a story worth retelling?

I bought enough provisions for a fortnight for barely more than a dollar, tucked my wood into the knapsack, and marched up the limestone ridge. My blanket never got its chance: the moment I tried to sleep, Ellis went back to the tavern. I spent the week learning that I could eat pork directly but could not persuade the household cook to use my abundant pack food reliably. The canteen acquired a pound of cheese while apparently keeping all its water, and Timothy Costello acquired my attention. There is a funny story here about a would-be wilderness expert who could optimize everything except leaving home, but the gear decisions did not yet produce the expedition story I wanted.

## 10. Top five recommendations, ranked

1. **High — Make wilderness residence possible.** Add a visible camp/sleep-here choice using the blanket, with explicit shelter/fire requirements and persistent location intent. Show and let me control automatic paid returns, meals, and lodging. This unlocks an actual P8 endurance test.
2. **High — Make automatic feeding agree with feasible pack meals.** When hot preparation fails, use available suitable cold food or explain why it is excluded. Distinguish household and portable supply access. The Kit Sheet must forecast the policy the character will actually follow.
3. **Medium — Turn inspection into a usable catalog and Kit Sheet.** Show per-food kcal, protein/fat/freshness, price and mass/bulk, recipe time/water/fuel/tools, and specific missing requirements. Show container capacities and protection. Explain projection assumptions and offer a provisions-focused menu.
4. **Medium — Correct physical accounting.** Charge water and solids against shared container occupancy; reduce food and fuel mass as fractions are consumed; announce partial packing. My calories and my kilograms should describe the same remaining supplies.
5. **Medium — Give outfitting and preservation meaningful stakes.** Offer camping equipment and relevant tools for sale; expose reasons to diversify beyond cheap raw pork; distinguish shelf-life estimates by storage and forecast weather. Revisit budget/stock pressure after camping and the feeding policy are testable.
