# Coulee — Gear & Economy

> **Revision 2026-10-10.** Brought into line with `00` (P6 pocket, P7 psyche, P8 crunch, peoples roster, spring 1855), `adr/0001`, the lead's ownership calls, and `10`/`11`/`12`/rewritten `07`. What changed:
> - **P8 provisions model (new §3.7–3.9).** `03` owns food and consumable item fields (C48): kcal, protein/fat, Fresh, shelf life, spoilage multipliers by temperature band, wetness and packaging, preparation (fire, fuel, cookware, water, time), preservation recipes, consumables burn (fuel, lamp oil, candles, powder in grains, ball, caps, flints, fodder, wear), rations planning, and pantries as household inventories. Integer units throughout (ADR); spoilage is a band lookup table, not a decay curve (C49).
> - **Catalog tables carry P8 columns.** §6.4 is now cookware + a provisions table with kcal, P/F, Fresh, shelf life, spoilage and prep columns, a found-food table, and a packaging-and-stores table. Fire & Light rows give burn rates. Arms get an ammunition-burn table.
> - **Pocket Outfitter (new §2.6).** Book, Kit Sheet, Flat-Lay and Readiness adjusted for phones, deferring layout to `11` §2.6–2.8. Readiness gains P8 rows, and arithmetic rows are never skill-gated.
> - **Peoples and cultures (new §6.16).** Goods from `12`: hearth-loaf, hand-bell, flatbrød, klippfisk, sauerkraut, pasty, crib tin, cave mushrooms. Goblin ¾ carrying capacity and 70% rations flow through ordinary rules. No people-priced goods.
> - **Iron (§3.3).** IP and skin contact are *inputs* to `06`'s Drift-keyed weaknesses. No witch-specific iron rule (C27).
> - **Encumbrance (§4).** `03` owns bands and penalties, `02` owns C(STR) and size, `05` reads the bands. Integer anchor table (C22).
> - **Insulation in °F** of comfort-band extension, wool wet retention 50% (C23).
> - **C10 fix.** The plowed-up "knapped flint blade" and flint-headed arrows are gone (replaced by an English gunflint scraper and horn-tipped arrows), plus a note on Native-made trade goods.
> - **Smaller fixes.** Start date is now a decision (§11). Integer price ledger (§8.1). The Thorn Court ferryman becomes the River's (C16). Viroqua and "Father Doyle" removed from canon-facing text (C7). Backgrounds re-scoped as `03`'s columns in `06`'s table (C31). Merchant temperament in `10`'s drives and norms. Dreams credited to `10`. New §13 (conflicts addressed) and §14 (implementation notes against `packages/` code).

> Scope: items, the Outfitter, the catalog experience, encumbrance, condition, **food, provisions, consumables and pantries (P8)**, prices, trade, fae exchange, loot, and how objects carry stories. Rules math (checks, damage, conditions, deficiency conditions) lives in `02-rules-and-characters.md`. Memory, belief, opinion, rumor and notoriety live in `04-social-simulation.md`; drives, norms and the rest of the psyche live in `10-psyche.md`. Physiological burn rates, the effects of hunger and nutrition, weather and storage temperature, and settlement quantities live in `05-world-sim-and-storyteller.md`. Mode-specific loops (Curse economy, the Prince's demands, Drift and witch weaknesses) live in `06-game-modes.md`. Screen layouts per device live in `11-interface-and-platforms.md`. Peoples and cultures live in `12-peoples.md`.

**Status:** Draft, revised 2026-10-10. Tags: **[DECISION]** comes from `00`, the ADR, Ellie, or a lead ownership call; **[PROPOSAL]** is this doc's recommendation; **[OPEN]** needs Ellie.

---

## 1. Why the catalog feeling works

`00` names the catalog feeling as the first of three feelings. This doc is where it has to be earned, so it starts by pulling the feeling apart.

A kid with a camping catalog and a PHB isn't really shopping. They're **running scenarios.** Each item is a small story: *"if it rains the second night, the oilcloth goes under the blanket and the matches stay dry in the tin."* The pleasure comes from six things working together:

1. **Imagined situations.** Every item answers a question about the future ("what if it's cold?" "what if I meet a wolf?"). Browsing is rehearsal.
2. **Tradeoffs under a budget.** $50 can't buy everything. The rifle *or* the mule. Scarcity turns preference into identity: the kit you pick is who you are.
3. **Specificity.** "A rope" is boring. "50 ft of 1/2-inch manila, 6 lb, holds a man and his regrets" is a promise. Brand names, materials, and odd numbers ("3-point blanket," "No. 1 trap") make things feel real.
4. **Copy that implies stories.** Good catalog text hints at the situation an item exists for, and the reader's imagination fills in the rest.
5. **Weight versus utility.** The backpacker's ounce-counting. Every item has to justify riding on your back, so the cost isn't only money.
6. **The kit coming together.** The flat-lay photo of everything laid out on the floor. Seeing it as a *system* (fire + water + shelter + food + defense) and noticing the gap ("I have no way to cross a river") is the payoff.

The PHB equipment chapter adds two more:

7. **Legible mechanics next to flavor.** "Bedroll, 1 sp, 5 lb" sits beside "Trail rations (per day)". The number shows the item is *real to the rules*: it will matter.
8. **Mundane and magical in one list.** Holy water sits next to a 10-ft pole. The ordinary and the uncanny have the same standing, which is exactly the Driftless-Faerie tone.

`00` P8 ("crunch you can pack") adds a ninth, which the kid with the catalog only half-knew:

9. **The countdown.** Things run out. Ten days of hardtack is a clock; so is a tin of 100 caps, a quart of lamp oil, and the one dry pair of socks. Planning against the clock (what spoils first, what needs a fire, what the mule eats) is the catalog feeling extended past the store counter into the trip.

**[DECISION]** Each of these nine has to show up as a concrete UX or system feature. The map:

| Ingredient | System/UX that delivers it |
|---|---|
| Imagined situations | "What's this for" copy + the **Readiness** panel (§2.4), gated by the character's skill |
| Budget tradeoffs | Hard starting purse, period prices, no free respec of purchases; credit exists but costs (§8.5) |
| Specificity | Named makers, real materials, odd period units (§5) |
| Story-implying copy | Every item has catalog copy written in period voice with a situational hint |
| Weight vs. utility | Live weight + bulk projection with consequences spelled out in plain terms (§2.3, §4) |
| Kit coming together | The **Flat-Lay**: your purchases laid out on a blanket on the store floor, top-down (§2.3) |
| Legible mechanics | Every price and penalty has an expandable "show the math" ledger (P1) |
| Mundane beside magical | One catalog: salt and hex charms sit in the same book as frying pans (§6.12) |
| The countdown (P8) | Food and consumable fields (§3.7–3.8), the provisions planner and Pantry view (`11` §2.8, §3.9 here), Readiness P8 rows (§2.4), "buy by the day" (§2.6) |

---

## 2. The Outfitter experience

### 2.1 Diegetic framing

**[PROPOSAL]** True mail-order wishbooks (Montgomery Ward, 1872) come later than our core era. What did exist in the 1850s were manufacturers' **trade sheets**, broadsides, wholesale price lists, and the general store's **daybook/ledger**. So the Outfitter's catalog is a *thing in the world*: the proprietor's own **Book** (at Iron Ford, Gussie Pratt's, `01` §8.3), a fat clothbound volume assembled by pasting in engraved plates cut from makers' trade sheets, with prices inked in by hand and crossed out as freight costs change. That gets us wishbook energy without an anachronism, and it makes the catalog an object that belongs to an actor (P2):

- Crossed-out prices are **real price history**. The Book shows the price last month, and a handwritten margin note says why ("river froze — Feb."). The game opens on 1 April 1855, just before ice-out, so the first marginalia a player reads are about winter prices about to fall.
- The proprietor's marginalia reflect *the proprietor's* Mind: "Don't buy this, junk" next to an item she got stuck with is a lie if her Deceive beats your Read People.
- Other Outfitters' Books in other towns have different plates, prices, and opinions.

### 2.2 The shopping screen

This is the **Desk** layout (≥ 1024 px, `11` §1.1, §3.1). Pocket and Folio keep the same information and change the arrangement (§2.6, `11` §2.6). Layout (landscape, information-dense per P6):

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [thumb-index tabs: Packs | Shelter | Fire | Cookery | Tools | Clothing |  │
│  Arms | Armor | Medicine | Fishing | Rope | Folk-Magic | Books | Animals |│
│  Services | Under the Counter*]                                          │
├────────────────────────────┬──────────────────────────────┬──────────────┤
│  LEFT PAGE: catalog plate  │ RIGHT PAGE: listing          │  KIT SHEET   │
│  engraved illustration of  │ HOLLISTER & SONS FELLING AXE │  paper doll  │
│  selected item (+ variants │ $1.50 · 5 lb · Bulk 6 · Long │  + packing   │
│  by maker/quality)         │ "Ground true at Pittsburgh.  │  list +      │
│                            │  Will drop a 10-in. oak      │  weight/bulk │
│  hover: callouts on plate  │  before the coffee boils."   │  bars +      │
│  (materials, maker's mark) │ Tags: chop 3 · cut 1 · iron  │  READINESS   │
│                            │ [Compare] [Add to order]     │              │
├────────────────────────────┴──────────────────────────────┴──────────────┤
│ LEDGER STRIP (proprietor's hand): order lines... Total $23.15             │
│ Purse $40.00 (specie $12.00, notes $28.00 @ disc.)  Remaining $16.85      │
│ Proprietor remarks: "You'll want a second pair of socks. Nobody listens." │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Plates are generated from the low-poly models** with an engraving/hatching pass (cross-hatch, sepia ink, slightly off-register). We get a large illustrated catalog almost for free, and the plate exactly matches the in-world model (P6, cheap art). **[DECISION]** (`00`, ADR) The models are Blender placeholders; per `11` §5.5 the plates are **baked at build time** by `tools/blender` to WebP, so phones never run the engraving shader. The live shader survives only as an optional Desk effect for the Flat-Lay.
- **Thumb-index tabs** like a dictionary's. *Under the Counter* only shows up when the proprietor's Opinion of you clears a threshold or you ask the right way (grimoires, cold-iron work, questionable remedies, stolen goods).
- **Compare** puts two to four items side by side as engraved plates with tag deltas. For example, felling axe vs. hatchet: chop 3 vs. 2, 5 lb vs. 1.5 lb, Long vs. belt-carry.
- **Variants:** one plate, several entries by maker and quality ("Common hatchet $0.50 / Hollister hatchet $0.65 / Brauer cold-hammered $1.40").
- **[PROPOSAL]** The same catalog UI component is reused for spells, feats, and skills in `02`, so a spellbook page and an axe page feel related. `00` says gear, spells, feats, and skills should all feel like shopping for possibilities.

### 2.3 Loadout visualization: the Kit Sheet and the Flat-Lay

**[PROPOSAL]** Three views of one data model, with no inventory Tetris grid:

1. **Kit Sheet (paper doll + packing list).** A front/back silhouette with **carry points**: hat, neck, body layers (under, shirt, coat), belt (×4 hooks), pockets (×4–6, depending on clothing), shoulder sling (×2), back (pack), bedroll strap (top/bottom of pack), hands. Clicking a carry point opens a nested **packing list** in indented ledger style:
   ```
   Knapsack, painted canvas (14.2 / 20 bulk, 31 lb)
     ├ Match safe, tin  [waterproof]  ← reach: 20 s
     │   └ Lucifers ×40
     ├ Hardtack 6 lb
     └ ...
   ```
   **Reach time** is shown per item. Things at the bottom of a pack take longer to get out (§3.4). Players will reorganize for the emergency they expect, which *is* the catalog feeling.
2. **Weight & Bulk bars.** Two horizontal bars with band ticks (Unburdened / Light / Medium / Heavy / Staggering). Under them, consequences in plain words, recalculated live as you add items:
   > *At this load: 2.4 mph on trail (was 3.0). Stealth −2 (the tin cup clanks; lash it). Swimming: you will sink in deep water unless you drop the pack. Fatigue ×1.4.*
   Each line expands into the math (P1). The lines come from the core's `loadConsequences(kit)` query (`11` §1.7); the UI formats, never computes.
3. **The Flat-Lay.** A toggle that drops the camera to the store floor, where an assistant lays everything you've chosen on a blanket in a tidy grid, top-down, in the game's real rendering. It's the knolling photo from every gear catalog. Items are grouped by function (fire, water, shelter, food, tools, arms, medicine, fae), and **empty groups show as a dashed outline**, so a missing category is visible at a glance. **[PROPOSAL]** (P8) The food group renders as a pile with a **days label** ("≈ 9 days at ¾") and a small red-ink tick on whatever spoils first; the fire group shows a fuel note ("cook-fires: 1 armload per supper, gather on site"). The Flat-Lay is the "what am I missing?" glance, so `11` makes it reachable from Pack anywhere, not only in a store.

**[OPEN]** Do we want an *optional* spatial pack grid (RE4 attaché-style) for players who like that? It's fun, but it fights the nesting model. My recommendation is no: bulk + nesting + reach time gives the same "packing" decision without the fiddliness. `11` §2.7 adds a second argument: a grid is a precision-drag task, which is the worst interaction on a phone.

### 2.4 Readiness: "what's this for," made systemic

**[PROPOSAL]** The **Readiness panel** lists situations and whether your kit answers them, derived from affordance tags (§3.2):

| Situation | Needs | Status |
|---|---|---|
| Start a fire in rain | ignite (wet-tolerant or in waterproof container) + tinder (dry) | ✓ lucifers in match safe + fatwood |
| Night in the open, January | comfort floor ≤ forecast low: ≈ 70°F of insulation from clothing + bedding + fire (°F model, §6.6, `05` §6.3), shelter ≥ 1 | ✗ 38°F of insulation; no fire planned |
| Cross a swollen creek | rope ≥ 30 ft, or buoyant load | ~ rope ok; load sinks |
| Kill/drive off a wolf | arms (any) | ✓ fowling piece |
| Treat a bleeding wound | bandage | ✗ |
| Resist being pixie-led | iron, bread, or reversible coat | ✓ iron nails in pocket |
| **Ten days up the coulee** (P8) | food-days ≥ 10 at the planned burn and ration (§3.7.6) | ✓ 12 d at full ration on the trail |
| **Cook supper in the rain** (P8) | prep needs of the food you carry: `cook`/`boil` cookware, dry ignite + tinder, fuel on site | ~ pan ✓, kettle ✓, tinder will be damp by day 3 |
| **Stay off the scurvy road** (P8) | mean Fresh ≥ 20 over the trip, or forage planned (§3.7.3) | ✗ Fresh 0: dried apples or kraut would fix it |
| **Light for the Diggings** (P8) | light + fuel ≥ planned hours | ✓ 10 h of lard oil |
| **Shots** (P8) | the scarcest of powder, ball, caps/flints, patches for the guns carried (§6.7) | ~ 22 shots: caps run out first |
| **Feed the mule** (P8) | fodder-days ≥ trip length when grazing is poor (`05` season) | ✗ 3 days of oats in April |

The twist that keeps it simulationist: **Readiness is filtered through the character's Woodcraft (and Lore: Nature / Fae) ranks.** A greenhorn sees four situations, and one of them is wrong ("Bear: ✓ hatchet"). A seasoned woodsman sees fifteen, including ones the player hadn't thought about ("Wet feet, day 3: ✗ — no spare socks"). Skill investment literally widens your imagination at the store. The kid with the catalog *learned* what to imagine; the character does too.

**[PROPOSAL] Judgments are gated; arithmetic isn't.** `00` P8 says crunch is never a hidden penalty, and `10` (principle 3) says the psyche never falsifies rations math or Readiness. So the panel has two kinds of row:
- **Situation rows** ("Bear: ✓ hatchet") are the *character's judgment*. Which ones appear, and whether they're right, depends on Woodcraft and Lore. A wrong row is marked as the character's estimate, and its Explain says so ("your Woodcraft 1 thinks a hatchet answers a bear").
- **Arithmetic rows** (food-days, fuel-nights, shots, fodder-days, what spoils first) are **always present and always correct**, computed by the same core functions the sim runs (`07` §3.6, "forecast = outcome"). The only skill effect is the *uncertainty range* on forecasts that depend on things the character can't know, like weather (`11` §2.8: "6 d 10 h, est. 5–7"). Woodcraft and an Almanac narrow the range.

**Proprietor remarks** come from the proprietor's own Sheet and Mind. She reads your kit with *her* Woodcraft skill and comments, and her psyche (`10`) shapes what she says: a strong `honesty` norm warns you about the gap, a loud `greed` drive upsells the expensive fix, and one who dislikes you (`04` Opinion) says nothing at all. Those remarks are a social interaction and leave memories on both sides (`04`).

### 2.5 Catalog copy guidelines

- Period voice, 1–3 sentences, with **one situational hint per entry**. The hint shouldn't be a stat; it should suggest an *afternoon*.
- Sly honesty is allowed. Patent medicines get breathless copy, and the tag line underneath tells the truth only if you've Identified it (§3.6).
- Mention the maker and the place. Geography is flavor ("tanned at Galena").
- Examples: *"Recommended by gentlemen who have spent a night in a March creek."* / *"Will not keep the wolves off. Will keep them in front of you."*
- **Food copy** names a situation *and* hints at the crunch: how it keeps, what it needs, what it costs to carry. *"Soak before trying your teeth on it"* tells you hardtack wants water; *"Nourishing, if you have six hours and a fire"* tells you beans want fuel and time. The numbers sit in the listing; the copy makes you remember them.
- **Depiction rules** (`11` §7.7, `12` §8.1) apply to copy. No period caricature of any people or culture, and no copy that "jokes" in a period voice about a group. Goods made by Native craftspeople carry ordinary maker copy (§6 intro).

### 2.6 Pocket and Folio: the Outfitter on a phone

**[DECISION]** (P6) The Outfitter is fully playable on a phone. `11` §2.6–2.8 owns the layouts (Book page, ledger peek sheet, Kit Sheet · Readiness · Flat-Lay tabs, provisions planner). **[PROPOSAL]** This section says what each piece must keep from §2.2–2.4 when it shrinks, and what the phone version adds.

| Piece | Desk (§2.2–2.4) | Pocket (< 600 px) | Must not lose |
|---|---|---|---|
| **The Book** | Plate left, listing right, Kit Sheet column | One page at a time: plate, then listing. Vertical thumb-index on the thumb side. Horizontal swipe turns pages. Variants are a **maker strip** under the price ("Common · Hollister · Brauer ▸"). | Crossed-out prices with their margin reason; the proprietor's marginalia (tap to read the hand); *Under the Counter* gating |
| **Food pages** | Listing shows the P8 fields | A **nutrition strip** under the price at rung 1 of `11`'s legibility ladder: "1,650 kcal/lb · keeps 18 mo in tin · soak or fry". Tap for rung 3 (P/F, Fresh, spoilage table); "Show the math" for rung 4. | Prep needs, shelf life in the *current* season, kcal per lb |
| **Quantity** | Type a number | **Buy by the day** (below), plus a stepper | The weight and days the order adds, live |
| **Compare** | 2–4 plates | 2, stacked, deltas highlighted | Tag deltas, kcal/lb for food |
| **Ledger strip** | Bottom strip | **Peek sheet**: Order · Purse · Load band · Ready *n/m* · **Food *d*** | Purse split by money type at *this* merchant (§8.6) |
| **Kit Sheet** | Paper doll + packing tree | Paper doll with ≥ 48 px carry points; the packing tree is `11` §2.7's ledger tree, with Move by tap-tap, not drag | Reach time per item |
| **Readiness** | Full table | Half sheet shows the **worst 5 rows**, each with one **fix-it action** ("Add: wool socks, $0.20 ▸" opens that Book page). Full sheet shows all. | The judgment/arithmetic split; the greenhorn's footer ("Woodcraft 1: you may not know what you don't know") |
| **Flat-Lay** | Top-down render | Starts zoomed to fit; pinch or double-tap-drag to zoom; tap an item to open its Book page. Landscape is suggested once, never required. | Dashed outlines for empty groups; the food pile's days label |
| **Remarks** | Ledger strip line | A handwritten marginal note that slides in and never blocks input | It's a social interaction with a memory (§2.4) |
| **Haggling** (§8.4) | Dialogue panel | Three tack buttons in the thumb zone, odds from the core's `odds()` query | The walk-away floor reveal |

**Buy by the day [PROPOSAL].** The single most useful phone affordance, and good on Desk too. On a provisions page or from the ledger strip, the player sets **days**, **people and animals fed**, **expected labor** (camp / trail / hard), and a **ration style**: *Army* (hardtack, salt pork, coffee, sugar, salt), *Light* (pemmican, parched corn, dried apples), *Settler* (flour, cornmeal, bacon, beans), or *Custom*. The core's `planProvisions` query fills the order to the target days at the chosen ration and returns lb, Bulk, cost, fire needs, Fresh and what spoils first. The player can then edit lines. It answers "how much food do I need?" in the period's own terms (a *ration* was a unit of issue), and it makes the weight-for-worth tradeoff a one-tap comparison. Ten days on the trail for one man: *Army* is about 17 lb and $1.60, and wants a fire for the pork and coffee; *Light* (10½ lb pemmican, 3 lb parched corn) is about 13½ lb and $3.30, and wants no fire at all. The saving is less weight than people expect and a lot of fire, which is the honest lesson (worked in §3.7.6).

**Time while shopping [PROPOSAL].** Browsing happens in a full sheet, so the sim is paused (`11` §1.6). Committing costs game time: about 5 game-minutes per order line, 10 per haggle round, 15 to try on clothes. Browsing is free; the conversation isn't. At Desk the same costs apply when the order is placed.

**Same answers on every device.** Readiness, `loadConsequences`, `planProvisions` and prices are core queries returning Explain records (`11` §1.7). A phone and a desktop looking at the same kit see the same numbers.

---

## 3. The item model

### 3.1 Properties every item has

**[PROPOSAL]** One item schema serves everything from a lucifer match to a mule's pack saddle. Data-driven (`07`): content TOML validated by zod (ADR). **[DECISION]** (ADR invariant 2) Stored values are integers: grams, cents, tenths of a Bulk, kcal, ml, minutes, and percent multipliers. The UI displays pounds and ounces; the catalog tables in §6 are in lb for readability, and the content compiler converts (1 lb = 454 g).

Fields split into the **def** (the template, shared by every axe of that kind) and the **stack** (a quantity of one def that shares state, or a single individuated instance).

| Field | Where | Type | Notes |
|---|---|---|---|
| `id` | def | ItemDef id | Template: base stats, copy, plate model |
| `section`, `copy`, `maker`, `truth` | def | — | Catalog section (§6), period copy (§2.5), maker (§5.2), hidden truth for patent medicines, glamours, counterfeits (§3.6) |
| `unit` | def | string | What one unit is: "lb", "box of 100", "quart", "pair", "each". Prices and P8 fields are per unit. |
| `weight_g` | def | int, grams per unit | Stacks multiply. Displayed in lb/oz. |
| `bulk` | def | int, tenths of a Bulk per unit | **1 Bulk ≈ 1 quart of awkward volume.** Rigid items count full volume; soft items compress (blanket rolled = 8) |
| `shape` | def | flags | `Long` (>3 ft, can't go in a pack; slung or lashed), `Rigid`, `Soft`, `Fragile` |
| `value_cents` | def | int | Base value at the river-town reference (§8.1) |
| `materials` | def | list of `{material, pct}` | `iron 90, wood 10`; drives Iron Presence, rust, burning, buoyancy, fae reactions. `tinplate` counts as iron (§3.3). |
| `quality` | stack | tier | Shoddy / Common / Good / Fine / Exceptional (§5) |
| `condition` | stack | 0–100 | Wear, damage, rust, rot; thresholds affect function (§3.6). Also the "wear" consumable for socks and soles (§3.8). |
| `wetness` | stack | 0–100 (percent saturation) | §3.5 |
| `spoilage` | stack | 0–1000 (‰ toward spoiled) + integer carry | Food only (§3.7.4) |
| `temp state` | derived | frozen / normal / hot | From storage temperature (`05`); wet items and liquids freeze below 32°F |
| `lot` | stack | acquired-at minute + source | Separates purchases so "what spoils first" and "where did this come from" are answerable (`07` §3.6) |
| `affordances` | def | tag → magnitude (tenths) | `cut 2`, `ignite 1`, `boil 1` (§3.2) |
| `tags` | def | tags | `waterproof`, `noisy`, `flammable`, `perishable`, `wet_ruin`, `blessed`, `fae_made`, `fae_food`, `glamoured`, `cursed`, `ward_bread`… |
| `container` | def | capacity (g, Bulk, ml), `protects[]`, carry point | §3.4; `protects` doubles as the food **packaging class** (§3.7.4) |
| `wearable` | def | slot, `insulation` (°F), `wind_block_pct`, `wet_retention_pct` | §6.6, `05` §6.3 (C23) |
| `supply` | def | `{kind, units}` | This item is a consumable supply: a quart of lard oil is 600 lamp-minutes (§3.8) |
| `consumes` | def | list of `{kind, per: hour/use/day, units}` | Devices that burn supplies: a lantern, a rifle, a mule (§3.8) |
| `food` | def | block | The P8 food fields (§3.7.2) |
| `wear` | def | int | Base condition loss per use or day (§3.6, §3.8) |
| `contents` | stack | location | Nesting: an item's location can be another stack (§3.4) |
| `provenance` | stack | log | Maker, owners, events (§10) |
| `known` | per actor | knowledge | What *this* actor believes about the item: true value, efficacy, glamour, freshness (§3.6) |

### 3.2 Affordances: how the sim uses items generically

**[DECISION]** (from P1, P2) Jobs and actions query **affordances, not item IDs.** "Cut rope" needs `cut ≥ 1`. "Fell a tree" needs `chop ≥ 1`, and time scales inversely with `chop` × quality × condition × the actor's Str. Any actor (player, farmer, fae with a stolen knife) can use anything that has the affordance.

Core affordance vocabulary (extensible):

| Affordance | Meaning | Typical sources |
|---|---|---|
| `cut` | Slice soft material | Knives, axes, broken glass (cut 0.5, Fragile) |
| `chop` | Fell, split, limb | Axes, hatchets; a big knife = chop 0.5, high wear |
| `saw` | Clean cross-cuts | Bucksaw |
| `pierce` | Puncture, awl, spike | Awl, bayonet, miner's candlestick |
| `pry` | Leverage | Crowbar, pick, axe (risk of breaking) |
| `hammer` | Drive | Hammer, axe poll, rock (0.5) |
| `dig` | Move earth | Spade, pick, hands (0.2) |
| `ignite` | Start fire | Lucifers (fast, wet-fragile), flint & steel (slow, wet-tolerant), burning glass (sun only) |
| `tinder` | Takes a spark | Char cloth, fatwood, birch bark |
| `light` | Illuminate (radius) | Candle 1, lantern 3, torch 2 |
| `contain-liquid` | Hold water | Canteen, kettle, oilcloth bag |
| `boil` | Heat liquids over fire | Kettle, pan, tin cup (small) |
| `cook` | Fry, sear, parch, roast in a vessel | Frying pan, Dutch oven lid, a flat stone (0.5) |
| `bake` | Enclosed dry heat | Dutch oven, reflector oven, a hearth oven (fixed) |
| `grind` | Mill grain or coffee | Coffee mill, quern, a mortar (0.5), two rocks (0.2) |
| `open-tin` | Open a sealed tin (no can opener exists in 1855) | Any `cut ≥ 2` or `pry ≥ 1` tool, slowly; a cold chisel |
| `insulate` | Warmth, in °F of comfort-band extension (`05` §6.3) | Clothing, bedding (`wearable.insulation`); reduced by wetness by material |
| `preserve` | Salt, cure, smoke, dry (§3.7.7) | Salt, a brine keg, a smokehouse (fixed), a drying rack |
| `shelter` | Keep off rain/wind/snow | Gum blanket 1, fly 2, wall tent 4 |
| `bind` | Tie, lash, haul | Rope, cord, rawhide, belts |
| `climb` | Anchor/aid climbing | Rope + grapnel, spikes |
| `float` | Buoyancy | Wood, empty kegs, sealed canteens |
| `heal-*` | Medical | `heal-bleed`, `heal-pain`, `heal-ague`, `heal-infection` |
| `sew` | Repair cloth/leather | Needle & thread, awl |
| `signal` | Be noticed far away | Whistle, mirror, gunshot, bell |
| `read`/`write` | Literacy work | Books, journal, pencil |
| `ward-fae` | Repels/confounds fae | Iron, salt, rowan, bread, bells, blessed items |
| `see-true` | Pierces glamour | Hag stone, four-leaf clover, St. John's wort (situational) |

Magnitude, quality, and condition multiply (integer tenths and percents, rounded once per query). NPCs use the same queries: a farmer whose axe was stolen borrows a neighbor's (`04` social event) or chops slowly with a hatchet. Food preparation queries cookware the same way: beans need `boil`, not "a kettle" (§3.7.5).

### 3.3 Iron, cold iron, and other meaningful materials

**[PROPOSAL]** Iron is the most important material in the game. In folklore it's the one thing the Fair Folk can't abide, and in 1850s America *nearly everything useful is iron*: axes, guns, kettles, traps, horseshoes, nails, and even the tin cup (tinplate is iron sheet). That gives us the central gear tension of the fae wilds.

**Iron Presence (IP)** = Σ (ferrous mass in lb × proximity factor). Worn against skin ×1.5, carried ×1, on a pack animal within 10 yd ×0.5. **[PROPOSAL] Integer form:** `IP_g = Σ floor(weight_g × qty × ferrous_pct × proximity_pct × cold_pct / 1,000,000)`, where `ferrous_pct` is the summed `pct` of `iron`, `steel`, `tinplate` and `cold_iron` in `materials`, `proximity_pct` is 150 / 100 / 50, and `cold_pct` is 300 for `cold_iron` (else 100). The UI shows IP in lb to one decimal (`IP_g / 454`). A tinned canteen and a tin of oysters both count: tinplate is iron sheet.

**Skin contact** is a second, separate input: a boolean per hand and body slot, true when an item with ferrous material is held bare-handed or worn against skin. Gloves, wooden handles and a canvas sling break contact without changing IP. That distinction matters to `06`'s "−2 when touching" and to `12`'s faekin habit gear (§6.16).

Effects, scaled by the local **Fae intensity**:

| Effect | How IP matters |
|---|---|
| **Anchor** | High IP resists fae path-warping (being pixie-led, time slippage, losing the trail). You get lost less. |
| **Blind** | High IP also stops you *finding* fae places. Rings, doors, and markets don't appear to a man hung with iron. Can't get lost, can't get in. |
| **Ward** | Lesser fae won't approach within IP-scaled radius; they can't cross an unbroken iron line (nails, a chain, a horseshoe over the door). |
| **Offense** | Fae actors' Opinion takes a penalty proportional to the IP you bring into their places. Bargaining while armed with iron is an insult. |
| **Harm** | Iron weapons do extra harm to fae and break glamours on contact. |
| **Souring** | Fae-made items in the same container as iron slowly lose potency (they "sour"). |
| **Weakness input** | **[DECISION]** (lead call, C27) `06` owns every fae weakness, witch's or anyone's. Triggers key off **Drift thresholds** and the Pact (`06` §3.8: at Drift 40, iron causes discomfort, −2 when touching). `03` supplies only the **inputs**: IP (with cold iron's multiplier) and skin contact. `02`'s Witch class feature points at `06`, not here. There is no witch-specific iron rule in this doc. |

**What `03` hands `06` [PROPOSAL, for `06` to accept or replace].** `06` §3.8 gives a flat −2 when touching iron at Drift 40. If `06` wants the severity to scale with load, a suggested input curve, in integer bands: contact with any ferrous item → the `06` touch penalty; IP 0–2 lb carried → nothing extra; 2–5 lb → discomfort (a `10` Id-voiced unease thought, sleep quality −10%); 5–15 lb → the `06` penalty applies to all checks, not just touch; above 15 lb → a Will save each hour or Sickened (`02`). These numbers are only a suggestion; `06` owns the curve and its thresholds.

**Peoples feed the same curve (`12` §10.2).** No people has its own iron rule. A shadow-faekin counts as Drift + 30 (proposed; +25 under review) for weakness triggers, so a baseline faekin meets `06`'s Drift-40 band and iron discomfort scaled by this section's IP. An elf counts as Drift − 10. Goblins and humans are baseline. Content: replace the code's `cold_iron_sensitive` boolean with `12`'s `weakness_drift_offset` (§14).

**Cold iron.** In folklore "cold iron" just means iron, but we want a premium tier. **[PROPOSAL, still OPEN as C28]** *Cold iron* is wrought iron that was **hammered to shape cold** (or from meteoric or bog ore) and never quench-hardened into steel. It's soft, holds a poor edge, and costs more, but its fae effects are ×3 per lb (`cold_pct` 300 above). Steel counts as ordinary iron. That gives the adventurer an interesting budget choice: a 4-oz cold-iron knife gets most of the warding with almost none of the Blind penalty. For contact effects, cold iron is also worse per touch: `12` §7.2's iron-flinch tell uses Will DC 15 for cold iron against DC 10 for ordinary iron, so a cold-iron ring pressed into a palm is the sharper test even though a skillet carries more IP.

Other materials with meaning:

| Material | Significance |
|---|---|
| **Steel** | Counts as iron (×1). Holds an edge. Rusts. |
| **Lead** | The region's main mineral (galena). Fae-neutral. Bullets. Valuable as ore. |
| **Silver** | Some creatures are vulnerable (per `01` §7 bestiary). Silver coin is the one human money fae will take, as *metal*, not as money. Holed silver dimes as charms. |
| **Brass / copper** | Non-ferrous metal for tools: brass snare wire, copper powder flasks, brass bells. Fae-tolerated. |
| **Rowan** | Wards. Wands. Rare in the Driftless (grows north), so imported and priced accordingly. |
| **Salt** | Wards (lines and circles), preservation, a trade good. Fae must count spilled salt (folklore; **[OPEN]** whether we use that one). |
| **Bread** | A heel in the pocket keeps you from being led astray. Perishable: it molds in 5–7 days, and moldy bread doesn't count. **[PROPOSAL]** Mechanically, a `ward_bread` tag that works while the stack's spoilage is below the *turning* threshold (§3.7.4). The elves' twice-baked **hearth-loaf** (`12` §5.5) keeps about 3 weeks dry, so it wards for 3 weeks; flatbrød and hardtack are bread too but the folk belief doesn't credit them, so they don't (**[OPEN]**: should hardtack count? It would make the ward trivial for soldiers). |
| **Wool / cotton / linen** | Wetness behavior (§3.5). |
| **Gum (india-rubber)** | Waterproof. Gets brittle in deep cold (< 0°F → cracks on use). |
| **Fae materials** | Thornwood, moonsilk, glamour-gold, bone of things that never lived. Act strangely near iron. Loot only (§9). |
| **Blessed** | Not a material but a property applied by a clergy actor with the right check. Strength depends on the blesser's faith/standing, which ties blessing to the social sim. |

### 3.4 Containers and nesting

**[PROPOSAL]**
- Containers have `capacity_weight`, `capacity_bulk`, and **protective properties** that apply to contents: `waterproof` (to a submersion duration), `airtight`, `crushproof`, `insulated`, `iron-lined` (blocks fae effects in or out: a cold-iron box holds a fae-made thing safely), `concealed` (hidden pocket: Perception DC).
- **Nesting is arbitrary depth.** Matches → match safe → coat pocket → coat → you. Protection is evaluated from the outside in: water hits the coat, then the pocket, then the tin, and stops at the first waterproof layer that holds.
- **Reach time** = base by carry point (pocket 2 s, belt 3 s, sling 3 s, pack outer 10 s, pack interior 20–40 s by depth/fullness) + per-nesting-level 3 s. In real-time-with-pause combat, reloading from a powder horn on your belt vs. a powder keg in your pack is a life-or-death difference. **[DECISION]** (lead call, C21) Reach is a T0 duration on the sub-minute clock; `07` §3.4 proposes tenths of a second, so pocket = 20 tenths, pack interior = 200–400.
- Liquids are contents too. A canteen is a container with 2 qt of water, and water weighs 2 lb/qt. Filling your canteens is a weight decision. A canteen worn under the coat stays above freezing in January; one on the pack strap freezes solid and may split its seam (§3.7.4, "carried on the body").
- **Protection is packaging.** The same `protects` list that keeps matches dry sets the spoilage multiplier for food inside (§3.7.4). An oilcloth bag is shelter for bread and a slower clock for flour.
- **Animals and caches are containers** with their own rules (§4.3, §4.4).

### 3.5 Wet and dry

**[PROPOSAL]** `wetness` 0–100 (percent saturation) per stack, an integer. Sources: rain (by exposure and cover), fording or swimming (by depth reached), sweat (base layers), snowmelt, spills. Drying: by air temp, wind, and fire proximity, with material dry rates (wool slow, linen fast, leather slow and stiffens). Rates per material are integer points per hour by condition band; `05` supplies the air and fire terms. "Wet" for rules purposes means wetness > 20.

| Material/item | When wet |
|---|---|
| Wool | Keeps **50%** of its insulation (`wet_retention_pct` 50; agreed with `05` §6.3 to close C23; this doc previously said 70%). Heavy (+40% weight at saturation). |
| Cotton | Keeps ~10% insulation. *"Cotton kills"* is true here. |
| Fur, buffalo robe | Keeps ~60%, but takes days to dry and stiffens if dried too near a fire. |
| Leather boots | Stiffen on drying (condition loss unless greased). Freeze below 32°F. |
| Black powder | Wetness > 0.2 → misfire chance rises steeply; > 0.5 → inert until carefully dried (risk!). |
| Lucifers | Inert when wet; recover poorly. |
| Flint & steel | Works wet; char cloth/tinder must be dry. |
| Paper, books | Ink runs; spellbooks risk losing spells (per `02`). |
| Iron/steel | Rust: condition loss over time while wet unless `oiled`. |
| Bread, flour, hardtack | Spoil faster (`wet_pct` 300–600 in §3.7.2); flour clumps; hardtack softens and grows mold. |
| Salt, sugar | Clump, then dissolve; wet sugar draws ants. |
| Coffee (green), tea | Mold at `wet_pct` 300. |
| Gum blanket, oilcloth | Waterproof; make wet things inside them *stay* wet. |

That gives the classic outdoor stories: the dry pair of socks, the powder that wouldn't fire, the frozen boots in the morning, the sack of flour that went over the side at the ford and came out as paste.

### 3.6 Condition, failure, and knowledge

- `condition` 100 → 0 from use, abuse, weather, and age. Below 50: affordance magnitude scales down. Below 25: **failure checks under stress** (rope bears a load → roll; axe on frozen oak → head may fly off). Failures go in the Chronicle.
- **Maintenance actions:** sharpen (whetstone), oil (gun oil, neatsfoot), grease (boots), dry, mend (sewing kit), re-haft. These are small, satisfying camp activities that also fill the downtime RimWorld-style.
- **Knowledge is per-actor.** Items have true properties and believed properties. A patent medicine's true effect may be "30% alcohol, 0.5 gr opium." The character knows that only after Medicine/Lore checks or experience. Fake silver, fae glamour-gold, counterfeit bank notes, cursed items and **fae food** (true kcal 0, apparent kcal whatever the glamour says; §3.7.2) all use the same mechanism. **[DECISION]** (P1) The game always knows the truth and can show the math once the character knows.
- **Freshness is mostly visible.** Ordinary spoilage stages (§3.7.4) are things anyone can see and smell, so they're public knowledge to whoever holds the item. Exceptions use the knowledge mechanism: milk from snakeroot-grazed cows (`05` §6.5 milk sickness) looks fine, and a cursed root cellar's faster rot looks like bad luck until someone suspects otherwise.

### 3.7 Provisions: the P8 food model

`00` P8: *food is not one number.* Hardtack, pemmican, salt pork, parched corn, cornmeal, dried apples, coffee, sugar, tinned oysters, fresh trout and morels should all feel different to carry and to live on. This section is the item side of that promise.

#### 3.7.1 Who owns what

**[DECISION]** (lead call, C48):

| Piece | Owner | This doc's part |
|---|---|---|
| Food and consumable **item fields** (kcal, protein/fat, Fresh, shelf life, spoilage multipliers, packaging classes, prep requirements, supply/consumes) | **`03`** | §3.7.2–3.8, catalog §6 |
| **Pantries** as household inventories in `03`'s item model | **`03`** (model); `05` (quantities, production) | §3.9 |
| Physiological **burn rates** (kcal/day, labor and cold modifiers, water) and the **effects** of hunger and nutrition | `05` §6.1–6.2 | reads them |
| Storage **temperature** (weather, cellars, buildings) | `05` §4.4, §6.3 | supplies the band table the item multipliers key on (§3.7.4) |
| Deficiency **conditions** (Hungry, Starving, scurvy stages, food poisoning) | `02` | supplies the inputs (Fresh, protein/fat, spoiled-food flag) |
| **Monotony** and food cravings as thoughts | `10` (the `hunger` drive), computed by `05` from diet history | supplies food groups and per-serving morale |
| People-level modifiers (goblins eat 70%) and culture foodways | `12` | lists the items (§6.16) |
| Screens (provisions planner, Pantry view, status-strip Food pip) | `11` §2.8, §1.4 | supplies the fields and the queries' meaning |

#### 3.7.2 The food fields

**[PROPOSAL]** Every food item carries a `food` block. This ratifies the field list already in `packages/content/src/schema/items.ts` (`07` §3.6 asked `03` to), with the additions marked ✚ (details in §14).

| Field | Type | Meaning |
|---|---|---|
| `kcal` | int per unit | Energy. A working man on the trail burns ~3,600 kcal/day (`05` §6.1: 2,400 × 1.5). |
| `protein_g`, `fat_g` | int per unit | Lets `05`/`02` model lean-meat starvation (all venison, no fat), and lets fat be the winter fuel it was. |
| `fresh` | 0–100 per serving | The anti-scurvy and variety factor (§3.7.3). Hardtack 0; dried apples 30; sauerkraut 60; ramps 90. |
| `group` | enum | grain, bread, legume, meat, fish, fat, dairy, egg, fruit, vegetable, fungus, nut, sweet, beverage, condiment, mixed. Monotony counts distinct groups (`05`). |
| `servings` | int per unit | Meal-sized servings. A lb of hardtack is 3; a lb of pemmican is 3; a lb of coffee is 40 cups. |
| `morale` | −20..20 per serving, eaten plain | Sugar +2, hardtack −1. Prep methods add their own. |
| `shelf_life_days` | int | Days to spoiled at `cool`, dry, unpackaged (§3.7.4). |
| `spoilage.temperature_pct` | per band, % | Rate multiplier per storage band: frozen / cold / cool / warm / hot. Default 5 / 50 / 100 / 170 / 300. |
| `spoilage.wet_pct` | % | Rate multiplier while the item's wetness > 20. |
| `spoilage.packaging_pct` | protection → % | Rate multiplier when a container in its chain has that protection (§3.7.4). |
| `spoilage.spoils_to` | item ref | What it becomes (milk → clabber, green coffee → nothing, fresh pork → ruined). Omitted = ruined and removed. |
| `spoilage.vermin` | bool | Mice, weevils, ants: loss events in storage without `vermin_proof`. |
| ✚ `spoilage.turning_pm` | int, ‰ of shelf life | Where "turning" begins (default 750). Turning food is edible at a morale penalty, and bread stops counting as a ward. |
| ✚ `spoilage.frozen_ruins` | bool | Freezing ruins it outright (potatoes, eggs, apples, milk in glass) instead of preserving it. |
| `prep[]` | list | Ways to make it edible (§3.7.5). `raw` means edible as-is. |
| `liquid_ml`, `hydrates` | int, bool | Drinks; milk and coffee count toward water (`05` §6.2). |
| `alcohol_pct`, `stimulant` | int, bool | Whiskey; coffee and tea (a `10` craving source). |
| ✚ `fae_food` | bool | Fae fare. True kcal is 0 whatever it looks like; eating it starts `02`'s Bound chain (C26), adds `06` Drift, and `05` halves mortal food's satisfaction afterward. Never in the Book. |
| ✚ `taboo_tags` | list | What cultural norms can object to: `fae_grown` (forage taken at Fae intensity ≥ 2, `12` §5.5's elven taboo), `horse_meat` (most settler cultures won't eat it, even hungry), `meat_friday` (`sabbath`-style norms). Norms live in `10`; this is only the hook. |

#### 3.7.3 Nutrition: calories, protein and fat, Fresh

- **Calories** are the clock. The planner divides kcal on hand by the actor's daily burn from `05` (with `12`'s per-people `kcal_pct`: goblins 70).
- **Protein and fat** matter at the edges. A diet of lean game alone, with no fat, starves a man slowly however much he eats; a winter diet needs fat. `03` supplies the grams; `05` decides the thresholds and `02` the condition. Pemmican and salt pork are fat-heavy *on purpose*: that's why they were carried.
- **Fresh** is a 0–100 score per serving for "living food": fruit, greens, potatoes, sauerkraut, fresh meat and fish. The day's Fresh is the serving-weighted mean (the code's `freshPoints / servings`). `05` owns the scurvy clock; **[PROPOSAL]** for calibration, `03`'s numbers assume onset after roughly six weeks at a daily Fresh below 10. Bands used in copy and the UI: **dead food** (0–9: hardtack, salt pork, flour, sugar), **keeping food** (10–39: dried apples, cheese, potatoes in March), **fresh food** (40+: trout, venison, greens, berries, kraut).
- **Monotony** is computed by `05` from the last 14 days' distinct groups and items, and voiced by `10`'s `hunger` drive as an Id thought ("Not bacon again"). The fields that feed it are `group` and per-serving `morale`. Coffee, sugar and a hot meal are the cheap cures; that's why they're in every period outfit.

#### 3.7.4 Shelf life and spoilage

**[PROPOSAL]** One accumulator per stack, integer, compared against a fixed threshold. No exponential decay anywhere (ADR; C49).

- **Accumulator:** `spoilage` 0–1000 (per-mille of shelf life used, the repo's fraction convention and the code's field) **plus an integer `spoilageCarry`** per stack. Turning at `turning_pm` (default 750); spoiled at 1000. The carry is not optional: without it, long-keeping food never spoils (hardtack would gain 0.08‰ an hour, which rounds to zero every step; see §14).
- **Step:** every 6-hour sub-step for exposed stacks (packs, camps, open barrels), lazily in closed form for stacks in stable storage (`07` §3.6). For a step of Δ minutes:
  ```
  combined_pct = max(1, temp_pct[band] × (wet ? wet_pct : 100) × pack_pct / 10,000)   // integer, floor
  num          = 1,000 × Δ × combined_pct + carry
  den          = shelf_life_days × 1,440 × 100
  spoilage    += floor(num / den);  carry = num mod den                                  // carry stored per stack
  ```
  Magnitudes stay far below 2⁵³, so plain JS numbers are exact on every engine.
- **Temperature bands** come from `05`'s storage temperature (°F): frozen < 32 ≤ cold < 45 ≤ cool < 70 ≤ warm < 85 ≤ hot. These match the code's `TEMP_BANDS`.
- **Packaging (`pack_pct`):** for each *distinct* protection class present anywhere in the item's container chain (`airtight`, `waterproof`, `vermin_proof`, `brine`, `cool_storage`, …) multiply by the item's `packaging_pct` for that class, integer and floored, with a floor of 5%. Two oilcloth bags don't double-count. A class the item doesn't list has no effect (salt pork doesn't care about `crushproof`).
- **Wet:** applies only when the item's own wetness > 20. A `waterproof` layer that holds keeps the item dry in the first place (§3.4), which is usually worth more than its spoilage multiplier.
- **Freezing:** frozen food mostly stops spoiling (5% or less), but potatoes, eggs and apples **spoil to ruin** on freezing (a `frozen_ruins` entry: ✚ field), and frozen food costs +50% `fire_minutes` to prepare (thawing).
- **Carried on the body:** pockets and inner coat count as `max(air, 40°F)`; the pack counts as air temperature. A pasty in a coat pocket is still warm at noon, and a canteen under the coat doesn't freeze.
- **Stages:** *fresh* → *turning* (edible, morale −2 per serving, `ward_bread` lapses, the planner flags it) → *spoiled* (`spoils_to` or removed with a `provisions.spoiled` event; eating spoiled food is a food-poisoning risk that `05` §6.5 and `02` own).

**Approximation note (C49).** Real spoilage rates rise roughly exponentially with temperature (a Q10 of 2–3: doubling or tripling per 18°F). Stepped bands are a piecewise-constant fit. Within a band the error can reach ±40% at the band edges. That's acceptable because period shelf lives are folk estimates to begin with, and the bands are legible ("warm: ×1.7"), which a curve wouldn't be.

**Worked example: "the trout will turn by morning"** (`11` §1.6's dispatch). Two pounds of brook trout caught at 5 pm in July, in a creel on the pack (no protection), dry. Shelf life 2 days; July evening air is in the `warm` band, and trout's `warm` is 250%. `combined_pct` = 250. Per hour: 1,000 × 60 × 250 / (2 × 1,440 × 100) ≈ 52.1‰ (52 plus a carry). Turning (750‰) arrives after 14.4 h, about 7:25 am; spoiled after 19.2 h, about noon. Put the same trout in the Glovers' springhouse (`cool_storage`, 48°F, `cool` band, 100%): turning at 36 h. Smoke it over a slow fire for a night (§3.7.7) and it keeps about two weeks.

**Worked example: hardtack.** Shelf 540 days. In a tin canister (`airtight` 30%) in the `cool` band: `combined_pct` 30, so about 1,800 days, which matches period crates opened years after packing. In a haversack through a wet week (`wet_pct` 500): 500%, so a 108-day clock while it stays wet, and the haversack's tarred canvas only gives `splashproof`.

#### 3.7.5 Preparation

**[PROPOSAL]** Each `prep` entry is one way to make the food edible:

| Field | Meaning |
|---|---|
| `method` | raw, soak, boil, cook (fry), bake, roast, brew, grind, parch |
| `minutes` | Elapsed time per **batch** (soaking and simmering count) |
| `fire_minutes` | Active fire per batch, drawn from the fire's fuel (§3.8). 0 = no fire. |
| `batch_servings` | Servings one batch makes with one set of cookware (default 8). A pot of beans for six takes as long as a pot for one, which is why households and messes eat cheaper than loners. |
| `cookware` | Affordances needed (`boil`, `cook`, `bake`, `grind`), never item ids (§3.2) |
| `water_ml` | Per serving: soaking hardtack, boiling beans, brewing coffee |
| `kcal_pct` | Share of kcal available this way. Dry beans raw: 0. Morels raw: not offered (they make you sick). |
| `morale` | Per serving. Hot coffee +4, fried hardtack +2, raw salt pork −3. |
| `yields` | Preparing turns it into another item: green coffee → roasted → ground (ground coffee keeps a week). |
| `check` | Optional skill check for quality, e.g. Trade (Cookery) DC 10 for bread; failure wastes some or costs morale. |

- **Fire is a place, not an item.** Cooking needs a lit fire at the site (the code's `Fire` record), and fuel burns per fire-minute whatever the fire is for. A warming fire already lit cooks supper at no extra fuel. A **cold camp** (no fire) shows no light or smoke, which matters to a witch in hiding and to a posse; it limits supper to `raw` methods. This is where pemmican and parched corn earn their price.
- **Water** comes from the water budget (`05` §6.2). Soaking a day's hardtack costs ¾ L. Beans cost 1.5 L a day and three hours of fire. On a dry ridge, that's decisive.
- **Time** is real. At T1 a meal's `minutes` are part of the camp Activity; at T0 they're visible work. Ten minutes of fry-pan bacon is fine; eight hours of soaked beans means you're staying put.

#### 3.7.6 Rations and planning

**[PROPOSAL]** A **ration** is a standing order (a Command, `11` §2.8): a percentage of the eater's daily burn (100 / 75 / 50 / custom), meals per day (3 in camp; 2 on the trail plus a cold "noon piece"), and an **eat-order policy** (*spoils first* by default; or *lightest first* to shed weight; or *best morale first*; or *save the pemmican*). NPC households run the same order (`rationPct`), set by their head's Ego arbitration when stores run short (`10`): the Id says eat, the Superego says thrift, and the planner says how many days that leaves.

- **`planProvisions(holder, policy, horizon)`** is a pure core query (`11` §1.7). It walks day by day in integers: meals chosen by policy, prep checked against cookware, fire and water on hand, spoilage advanced with the forecast temperature band, burn from `05` (labor and cold modifiers) × `12`'s `kcal_pct`. **Days of food** is the last day whose meals reach ≥ 50% of the ration (`11`'s definition). The same function rations NPC households, so the forecast and the outcome can only differ through weather and events the forecast couldn't know (shown as a range).
- **The period unit.** Outfitters and the Army sold food by the **ration**: a day's issue for one man. **[PROPOSAL]** The Book's "N days' rations" means N Army rations (per day: 1 lb hard bread, ¾ lb salt pork, coffee 1.6 oz, sugar 2.4 oz, salt ½ oz ≈ 4,460 kcal, about 2 lb). That's *more* than a trail burn of 3,600, because the Army fed marching men generously; ten rations last a hiker about 12 days. The planner always translates the Book's units into the character's days.

**Worked comparison: ten days on the trail, one man** (burn 3,600 kcal/day, full ration, so 36,000 kcal):

| Style | Contents | lb | Bulk | $ | Fire per day | Prep per day | Fresh | Notes |
|---|---|---|---|---|---|---|---|---|
| **Army** | 8 lb hardtack, 6 lb salt pork, ¾ lb coffee, 1¼ lb sugar, ½ lb salt | 16.6 | 16 | 1.60 | ~1 armload (fry pork, brew coffee) | ~1 h | 0 | Hardtack eats raw in a pinch. Monotony by day 4. |
| **Light** | 10½ lb pemmican, 3 lb parched corn | 13.5 | 8 | 3.30 | none | none | ~3 | Cold camp all the way. Monotony by day 3; no coffee. |
| **Settler** | 6 lb flour, 4 lb bacon, 4 lb beans, 3 lb cornmeal, ¾ lb coffee, 1 lb sugar | 18.8 | 13 | 1.22 | ~2 armloads (bake, simmer) | 2–3 h | 0 | Cheapest and best morale, if you camp long enough to cook. |
| **+ 2 lb dried apples** to any | | +2 | +2 | +0.20 | — | — | mean +~10 | The cheapest scurvy insurance in the Book. |

That's the whole lesson in one table: the light kit saves less weight than expected and costs twice as much, and what it actually buys is **independence from fire**.

#### 3.7.7 Preservation and packaging

**[DECISION]** (`00` P8) Packaging and storage are gear. The catalog side is §6.4c (tins, oilcloth, gum bags, crocks, kegs, barrels, the crib tin). Storage structures are §3.9. **[PROPOSAL]** Preservation is a set of **recipes** in the crafting system (§5.3): inputs + affordances + fuel + time + an optional check → an output item with a longer shelf life. They run as T1 Activities for households (hog-killing week is a real event in every farm's calendar) and as camp work for the PC.

| Process | Input | Needs | Time · fuel | Output | Shelf life |
|---|---|---|---|---|---|
| **Salting / brining** | 5 lb fresh pork + 1 lb salt | keg or crock (`brine`) | 4–6 weeks to cure | 5 lb salt pork | 3 days → 120 (365 in brine) |
| **Smoking** | salt pork, fish, venison | smokehouse, or a pole frame over a slow fire | fish: 1 night, 4 armloads; hams: 2 weeks, 1 armload/day | smoked meat or fish | fish ~14 d; hams ~180 |
| **Drying / jerking** | 3 lb lean fresh meat | drying rack, sun or slow fire | 2 days by fire (6 armloads) or 4 sun days | 1 lb dried beef | 180 |
| **Pemmican** | 1 lb dried meat + 1 lb rendered fat | `grind` (or a stone), a kettle to melt fat | 2 h, 1 armload | 2 lb pemmican | 730 |
| **Parching corn** | 3 lb shelled corn | `cook` (dry kettle or pan) | 30 min, ½ armload | 3 lb parched corn | 365 |
| **Rendering** | 10 lb fat trimmings | `boil` kettle | 2 h, 2 armloads | ~8 lb lard, cracklings | 180 |
| **Kraut** | 10 lb cabbage + ¼ lb salt | crock (`brine`), a weight | 4 weeks, no fire | 10 lb sauerkraut (Fresh 60) | 180 |
| **Drying fruit or morels** | fresh apples or morels | rack, sun or oven | 2–4 days | dried (Fresh falls: 90 → 30) | 180–270 |
| **Freezing** | anything that tolerates it | a winter cache, a north wall | while the band stays `frozen` | same item | spoilage ×0.05; thawing +50% fire |
| **Roasting coffee** | green coffee | `cook` | 20 min, ⅓ armload | roasted, then ground (`grind`) | 365 → 30 → 7 |

**Period limits [DECISION by the 1855 pin].** No Mason jars (patented 1858), no condensed milk (patented 1856), and **no can opener** (1858). Tinned oysters, sardines and meats exist and are dear, and a tin is opened with a knife, a hatchet or a chisel (`open-tin`, §3.2), which takes a minute, makes noise, and can cost condition. Home preserving means crocks sealed with wax and bladder, brine, smoke, and drying.

### 3.8 Consumables that aren't food

**[PROPOSAL]** Everything that runs out uses `supply` (this item *is* N units of a kind) and `consumes` (this device *uses* N units per hour, use or day). Units are integers named by the kind. The planner sums them the same way it sums kcal.

| Supply kind | Unit | Sources (per unit of item) | Burned by | Notes |
|---|---|---|---|---|
| `fire` | fire-minute | Firewood armload 60 (≈ 20 lb, Bulk 20); deadfall gathered on site | Any lit fire, 1 per minute | Matches `05` §6.3 ("1 armload ≈ 1 hour"). An all-night warming fire in January is ~8 armloads, 160 lb of wood, so fuel is gathered, not carried: the consumable is **gathering time** (Woodcraft-scaled, `05` ecology) and dry tinder. Wet wood gives half the minutes and a smoky fire. |
| `match` | strike | Lucifers 100 per box | Fire-starting: 1 per attempt; wind and wet add attempts (Woodcraft check) | Wet lucifers are ruined (§3.5). |
| `flint_strike` | strike | Gun flint ~40 | Flintlocks: 1 per shot, plus misfires; flint & steel fire-starting | |
| `lamp_oil` | lamp-minute | Lard oil 600 per quart; camphene 360 per pint | Lantern 60 per hour | A quart of lard oil is 10 hours of lantern. The status pip says "Lamp oil 4 nights". |
| `candle` | candle-minute | Tallow, 6 per lb, ~7 h each (2,520 per lb); spermaceti ~8 h each | Candle in a holder, 60 per hour | Mice eat tallow (`vermin`). Goblin miners carry candles for the bad-air test (`12` §8.6). |
| `torch` | torch-minute | Pitch torch ~30 each | Burning torch | |
| `powder_gr` | grain (7,000 per lb) | Black powder by the lb, paper cartridges (charge included) | Firearms, per shot (§6.7 burn table) | A squirrel rifle is cheap to feed; a musket is not. |
| `ball_<cal>`, `shot_oz` | ball, ounce of shot | Cast balls; lead cast with a mould (§6.7) | Per shot | |
| `percussion_cap` | cap | Tin of 100 | 1 per shot attempt; a misfire wastes one | Caps are usually the first thing to run out. |
| `patch` | patch | Patch box ~100 | Rifles, 1 per shot | |
| `fodder` | animal-day | Oats: bushel (32 lb) ≈ 4 working horse-days at 8 lb; hay | Animals, per day when not grazing | Grazing at T1 in season replaces fodder (`05`). |
| `water` | ml | Canteens, kettles, springs | People 3–5 L/day (`05` §6.2), prep `water_ml`, animals 30–40 L | Boiling for safety costs ~10 fire-minutes per kettle. |
| `dose` | dose | Laudanum 2 oz ≈ 16 teaspoon doses; quinine 1 oz ≈ 15 doses | Medicine use | The true effect per dose is hidden until known (§3.6). |
| `tobacco` | chew/pipe | Plug or twist by the lb (~16 days at 1 oz) | Habit (a `10` craving) | Optional vice; also trade currency. |

**Wear as a consumable.** Some things run out by wearing out. Socks lose ~5 condition per walking day (×2 wet), so a pair lasts about three weeks and a spare pair is a P8 item, not a joke. Boot soles lose condition per 10 miles, rope per load-bearing use, moccasins fast in rock. Mending (§3.6) buys condition back for thread and time.

### 3.9 Pantries and household stores

**[DECISION]** (lead call, C48) A pantry is a **household inventory in this doc's item model**: stacks whose location is the household (the code's `{ kind: 'household' }`), nested in fixed containers (barrels, crocks, the root cellar). No separate commodity abstraction for households.

**[PROPOSAL]**
- **Storage places are containers with a storage kind.** A household has several: kitchen shelves (`indoor`), a **root cellar** (`cellar`, ≈ 50°F, slow to follow the air), a **springhouse** (`cool_storage`, ~48°F year-round, running water), a **smokehouse** (a process, §3.7.7, then storage), an **ice house** (cold or frozen through summer if ice was cut in January), a **corncrib** (dry, vermin-prone), a buried **cache** (cellar band; smell risk, §4.5). `05` maps each storage kind to a temperature; the item's multipliers do the rest.
- **Mouths and policy.** The planner, pointed at a household, counts every member's burn (children by `05`'s age scale, `12`'s `kcal_pct`), the animals' fodder, and the household's ration %. It shows a **season horizon**: days to ice-out, to first greens, to harvest, to hog-killing.
- **Seasonal rhythm** (quantities from `05` §4.3 and §7.1): flour and cornmeal from the mill after harvest; salt pork and lard at **hog-killing** (Nov–Dec); potatoes and roots into the cellar in October; kraut in crocks; maple sugar in March. **Spring is the hunger gap.** On 1 April 1855 the kraut is gone, the potatoes are sprouting, the river is still closing the store's supply line, and the first ramps are three weeks off. P8's "a hard winter empties them" is the default opening condition, not a disaster.
- **Census households have pantries too** (`07` §3.6), stepped lazily in closed form, so a bad harvest empties real pantries, not a statistic. T2 settlement "stock" (§8.2) is the sum of household, institutional and store inventories, held in aggregate until something promotes them.
- **Institutional pantries** use the same model: the goblin **Club pantry** with its rules of draw (`12` §8.6), a congregation's charity barrel, a hotel kitchen, the witch's hut cellar (`06` §3.10).
- **The store is not the storekeeper's pantry.** Gussie Pratt's shelves are the store's inventory (a place location); her kitchen is her household's. Taking a sack off her own shelf is a transaction at cost, which keeps her ledger honest and her daughter's flour bin a separate story.
- **Seeing someone else's pantry is a belief** with a date (`11` §2.8, `04`): "the Haugens' cellar was half empty, as of Tuesday."
- **Curses and pantries.** `06` owns curses. `03` exposes the hooks a curse can use: a `spoilage_pct` modifier on one storage container ("Sour the Stores"), vermin events, and the knowledge gate (§3.6) that makes cursed rot look like bad luck.
- **Theft** from a pantry is an ordinary item move with witnesses and traces (`04`, `05` §3.6).

**Worked example: the Pratt household, 1 April 1855** (seeded in `content/base/scenarios/iron_ford.toml`). Pantry: 40 lb flour (66,000 kcal), 12 lb salt pork (40,800), 4 lb dried apples (4,400), 2 lb green coffee, 30 armloads of firewood. Mouths: Gussie and Lydia at `05`'s baseline 2,400 each. **Days of food: 23.** Mean Fresh: about 2. The store downstairs holds 300 lb of flour, but that's stock she owes a Galena wholesaler for (`01` §8.3), and the planner's warning line reads "No fresh food: scurvy watch from ~6 weeks; ramps due ~25 Apr". That's a pressure the sim can run without anyone scripting it.

---

## 4. Encumbrance

**[DECISION]** (P1) Realistic and legible: weight *and* bulk, with consequences shown in plain words.

**Ownership [PROPOSAL, per `09` C22's recommendation, which this doc adopts].**
- **`02` owns carrying capacity C(STR)**, using the 3.5-shaped heavy-load column, and the **size multipliers** (Small ×¾, so goblins carry ¾ as much, `12` §8.5).
- **`03` owns the bands and their penalties** (this section). `02` §11's "Load" row (Light/Medium/Heavy with −3/−6) should point here instead of defining its own. `02`'s maximum-DEX cap stays with armor, which `02` owns.
- **`05` reads `03`'s bands** for travel, fatigue and kcal burn ("+10% per heavy-load hour" means the Heavy band and above). `05` §1.4's ">⅓ capacity" scheme is retired.

### 4.1 Load bands

Carrying capacity **C** comes from Strength and size, defined in `02`. For a STR 10, Medium actor C is about 100 lb (45,400 g). Internally penalties are **continuous**; the bands below are the legible labels.

| Band | Load / C | Overland speed | Fatigue rate | Stealth | Climb/Swim | Other |
|---|---|---|---|---|---|---|
| Unburdened | ≤ 25% | 100% | ×1.0 | — | — | Can run full |
| Light | ≤ 40% | 95% | ×1.1 | −0 to −1 | −1 | |
| Medium | ≤ 66% | 80% | ×1.4 | −2 | −3 | Run ×3 not ×4 |
| Heavy | ≤ 100% | 60% | ×2.0 | −5 | −6 | Can't run; Balance checks on steep slopes |
| Staggering | ≤ 150% | 30% | ×3.0 | −10 | no swim | Short hauls only |

A sense of scale: a soldier on campaign carried ~45–60 lb. The *Greenhorn's Outfit* kit (§7.3) weighs ~65 lb, which is Medium for an average character (65%, at the top of the band). The game should say so cheerfully at the counter. The same kit on a STR 10 goblin (C ≈ 75 lb) is 87%, Heavy; that's the honest other side of goblins' 70% rations (`12` §8.6), and Readiness shows both.

**[PROPOSAL] Integer form.** Load is `load_pm = floor(1000 × load_g / C_g)`. Each penalty is a piecewise-linear table over `load_pm` with anchors at 0, 250, 400, 660, 1000 and 1500, interpolated with integer floor division:

| `load_pm` anchor | 0 | 250 | 400 | 660 | 1000 | 1500 |
|---|---|---|---|---|---|---|
| Speed % | 100 | 100 | 95 | 80 | 60 | 30 |
| Fatigue % | 100 | 100 | 110 | 140 | 200 | 300 |
| Stealth | 0 | 0 | −1 | −2 | −5 | −10 |
| Climb/Swim | 0 | 0 | −1 | −3 | −6 | no swim |

Above 1500 the actor can't move with the load. The band *label* is whichever range `load_pm` falls in; the *penalty* is the interpolated value, so adding a pound always shows a change in the Explain, never a sudden cliff except at labeled thresholds (running, swimming).

### 4.2 Bulk

- Each carry point has a **comfortable bulk** (pack per its capacity, pockets 0.5 each, belt items small). Overstuffing (lashing gear on the outside) is allowed but adds **Awkward**: Climb/Balance/Stealth penalties and a snag chance in brush.
- **Long** items (rifles, axes, poles, snowshoes) on a sling or lashed: Awkward in caves and dense brush, and they snag.
- **Squeezes.** Cave passages have a bulk limit. If your body + worn gear exceeds it, you take the pack off and push or drag it ahead (slow, noisy, and you can be separated from it). This is the main cave-crawling decision (`05`).
- **Noise:** items tagged `noisy` (tinware, loose cartridges, bells, chains) add to Stealth noise unless **lashed** or packed in cloth, which is a reach-time tradeoff.

### 4.3 Swimming and fording

Net buoyancy = body buoyancy (by fat/muscle per Sheet, roughly neutral) − (load weight − float of load). Waterlogged wool and powder kegs change mid-swim. Swim DC rises with net negative buoyancy. **Drop pack** is a one-click emergency action. The pack sinks or floats by its own buoyancy and may wash downstream and be found later by an NPC (provenance hook!). Fording waist-deep counts load ×0.5 and adds a current check.

### 4.4 Pack animals

**[PROPOSAL]** Animals are actors (P2) with Sheets: capacity, fatigue, fear, needs (food, water), and opinions (of you, of fae places).

| Animal | Pack capacity | Notes |
|---|---|---|
| Horse (saddle) | rider + ~60 lb gear, or ~150 lb packed | Eats ~15 lb hay + 4–8 lb grain/day when worked |
| Draft horse | ~250 lb packed | Slow; eats more |
| Mule | ~200–250 lb | Sure-footed on coulee slopes; stubborn (has opinions) |
| Ox | ~200 lb, or pulls | Slow, cheap, grazes |
| Dog | ~15–20 lb with dog-pack | Alarms, tracks; fae can bewitch |
| Handcart (you pull) | ~250 lb on a road | Useless off-road |

- **Fodder is weight.** In summer, animals graze at T1. In winter and early spring (`05`), you carry grain, and 4–8 lb a day per animal adds up fast. A mule carrying its own winter feed is a classic death spiral. Fodder is a `supply` like any other (§3.8), so the provisions planner shows "Oats (Dorcas) 3 days" beside the people's food (`11` §2.8).
- **Fae and animals:** horses refuse to enter high-Fae-intensity sites without Animal Handling checks. Iron horseshoes add IP (anchoring and offense). Unshod animals are possible but go lame on limestone.

### 4.5 Caches

**[PROPOSAL]** A cache is a container placed in the world, with:
- **Concealment** (Woodcraft/Stealth check → Perception DC to find).
- **Protection:** hung (vs. bears and raccoons), buried, rock-cairned, in a tin or keg (waterproof, smell-proof).
- **Risks** simulated at T1/T2: animals (food smell: any `food` stack not in an `airtight` container), weather (spring flood), humans who saw you (an actor's memory → rumor → theft), and the **fae tithe** in high-intensity areas (something taken, something left in its place).
- **Food in caches** spoils at the cache's storage band (buried: the cellar band; hung: air), per §3.7.4. A cache laid down in October holds well; one laid down in July is a gamble.
- Caches show on the region map for the character who made them, with a knowledge-decay twist: memory fades, and the marker gets fuzzier if you don't note it in your journal (§6.13, journal item).

---

## 5. Quality, makers, crafting, repair

### 5.1 Quality tiers

| Tier | Price × | Effect | Notes |
|---|---|---|---|
| Shoddy | ×0.5 | Affordance −1 (min 0.5), condition loss ×2 | Peddlers' stock, factory seconds, "Birmingham ware" |
| Common | ×1 | Baseline | Catalog default |
| Good | ×2 | Affordance +0.5, condition loss ×0.75 | Named maker's standard line |
| Fine | ×5 | +1 (3.5e "masterwork" analogue), ×0.5 wear | Made to order; weeks of lead time |
| Exceptional | ×10+ | Unique traits | A specific master's best work; provenance starts with the maker |

### 5.2 Makers

**[PROPOSAL]** Fictional makers give items identity. National and regional brands appear in the Book; **individual NPC crafters are makers too**, and their reputation spreads through the rumor system (`04`).

| Maker | Place | Line | Character |
|---|---|---|---|
| **Hollister & Sons** | Pittsburgh | Axes, hatchets, edge tools | "The axe that comes back sharp." Good tier at Common price +30% |
| **Ostrander Rifle Works** | St. Louis | Heavy half-stock plains rifles, fowlers | Prized, heavy, accurate, expensive |
| **Brauer Brothers** | Milwaukee | Cutlery, pocket knives, **cold-hammered iron** | German smiths; the only regular cold-iron source |
| **Penhallow & Trist** | Mineral Point | Mining picks, candles, fuse, lamps | Cornish mining toolwrights |
| **Haugen Woolen Mill** | a Driftless coulee | Blankets, socks, mackinaws | Local wool; fae-touched rumors about their spinning |
| **Carrow & Tuck** | Hartford | Revolvers, pistols | Patent-protected, fashionable, pricey |
| **Fenwick Lamp Co.** | Cincinnati | Lanterns, burning fluid | Their camphene is famous for exploding |
| **Haverill Community** | upstate New York | Steel traps | A utopian community's sole income; traps are excellent |
| **Kittredge** | Boston | Almanacs | Weather calls are *actually* generated from the `05` weather model with seeded error |
| **Ashby, Crane & Co.** | St. Louis | Wholesale everything | Supplies most Outfitters; their plates fill most Books |

Individual crafters: *"Made by O. Thorsrud, Kvale Ridge"* on a knife is a provenance root. If Thorsrud's reputation rises (a rumor says his knives never break), his knives' prices rise across the region. If he dies, they become heirlooms.

### 5.3 Crafting and repair

- **Player crafting:** via Trade skills from `02` (Trade: Leatherwork, Smithing, Carpentry, Sewing, Gunsmithing, Cookery…; plus Herbalism). Inputs: materials + tools (with affordances) + time + fuel + a check. The check result sets quality. Camp-craftable: snares, bows (slow), moccasins, bullets (lead + bullet mold + fire), pemmican, jerked meat, parched corn, tinder, torches, rope from basswood bark (low quality), splints, simple charms. Preservation recipes are §3.7.7; they're the same recipe shape.
- **Not easily craftable:** black powder (saltpeter + sulfur + charcoal + skill + risk; **[OPEN]** whether cave saltpeter is a thing in our Driftless), percussion caps, glass, steel, paper.
- **NPC crafters** are actors running a T1 "work the forge/bench" Activity. Output feeds the settlement stock (§8.2). Commissions have **lead time** and **queue position** affected by Opinion. A smith who dislikes you is "very busy this month."
- **Repair:** self-repair restores condition up to a skill-based cap. Professional repair restores more and costs ~10–25% of value. Some repairs (re-browning a rifle barrel, rebuilding a lock) need a specialist in a bigger town.

---

## 6. The Starter Catalog

Prices are **Outfitter prices at the river-town reference settlement** in spring 1855 (**[DECISION]**, `00`), with frontier markup already included (§8.1). They're research-informed approximations meant to *feel* right against the anchor: **a laborer earns about $1 a day.** Weight is in lb for reading; content stores grams (§3.1). Bulk per §3.1. "—" means negligible. Tag abbreviations: `Fe` iron, `CFe` cold iron, `wp` waterproof, `L` Long, `F` Fragile, `nz` noisy, `per` perishable. Food columns: kcal and P/F (protein/fat, g) are per unit; Fresh is per serving (§3.7.3); shelf life is at `cool`, dry, unpackaged; prep lists fire-minutes · cookware · water per serving (§3.7.5). Insulation is in °F of comfort-band extension (§6.6).

**Goods made by Native craftspeople [PROPOSAL; final treatment waits on `01` Q1].** Several items here came into the 1850s market through Native makers and the fur trade: the bark canoe, ash-splint pack baskets, smoked-hide moccasins and jerkins, pemmican. Rules for them: they're **traded goods with makers** like any other (§5.2 provenance); their copy is ordinary catalog copy about use, never mystical or fae-coded; they're never "found" or dug up (§9); and whether a maker is a named Ho-Chunk or other nation's actor depends on `01`'s Option A/B/C/D and its consultation plan. Options for Ellie: (a) keep them as listed with neutral provenance until `01` decides; (b) mark them "trade" with no maker until then; (c) drop them from the starter Book. I'd pick (a).

### 6.1 Packs & Bedding

| Item | $ | lb | Bulk | Tags | Catalog copy |
|---|---|---|---|---|---|
| Haversack, tarred canvas | 0.75 | 1 | cap 8 | container, wp-light | "Slung at the hip for the day's bread and powder. Tarred against a passing shower, not a river." |
| Knapsack, painted canvas, army pattern | 1.50 | 3 | cap 20 | container, wp-light | "Of the pattern carried to Mexico. Painted black; the straps will find your collarbones." |
| Pack board & tumpline | 2.50 | 5 | cap 45 | container, rigid | "The portager's friend. Load it high, put the strap across your brow, and keep your eyes on your feet." |
| Ash-splint pack basket | 1.25 | 3 | cap 30 | container, crushproof | "Woven of pounded black ash. Will not crush your eggs nor your lantern glass." |
| Saddlebags, leather, pair | 3.50 | 6 | cap 2×14 | container, animal | "Galena-tanned. Fit any saddle with a tree worth the name." |
| Blanket, wool, 3-point | 3.00 | 5 | 8 | ins 10°F, wool | "Three points woven at the edge, three good nights in October." |
| Blanket, wool, 4-point heavy (Haugen) | 4.50 | 7 | 10 | ins 14°F, wool | "Spun in the coulees from coulee sheep. Stays warm wet, as wool should." |
| Buffalo robe | 5.00 | 12 | 16 | ins 25°F, fur, wet keeps 60% | "Hair side in. Sleeping in one, a man forgets January for a few hours." |
| Gum blanket (india-rubber) | 2.25 | 3 | 3 | wp, shelter 1, ground (stops ground chill and ground damp) | "Goodyear's process. A floor in the mud, a roof in the rain, a poncho between. Cracks in hard frost." |
| Bed tick, ticking cloth | 0.40 | 1.5 | 2 | fill w/ straw/leaves → ins 5°F, ground | "Stuff with dry leaves and sleep off the frozen ground." |
| Blanket straps & pins | 0.15 | — | — | bind | "Two straps and a horse-blanket pin. Holds a bedroll through a laurel thicket." |

### 6.2 Shelter

| Item | $ | lb | Bulk | Tags | Catalog copy |
|---|---|---|---|---|---|
| Oiled-canvas fly, 8×10 | 3.00 | 9 | 10 | shelter 2, wp | "String it between two trees and the weather becomes something that happens to other people." |
| Wall tent, 9×9, with fly | 12.00 | 45 | 60 | shelter 4 | "For the gentleman with a mule. Room to stand and to be miserable standing up." |
| Tent poles & pegs, set | 0.75 | 8 | 6 | L | "Cut your own in any woodlot, or carry these and save the hour." |
| Oilcloth ground sheet | 1.00 | 4 | 4 | wp, ground | "The ground is wet. It is always wet." |
| Mosquito bar (netting) | 0.50 | 1 | 1 | insect-ward | "June in the river bottoms will teach you the price of this item. Learn it here instead." |
| Snowshoes, ash & rawhide, pair | 2.50 | 4 | 8 | L, snow-travel | "Bear-paw pattern for timber. You will walk like a duck and live like a man." |
| Canvas bucket | 0.35 | 1 | 1 (folds) | contain-liquid | "Folds flat. Waters a horse, douses a fire." |

### 6.3 Fire & Light

| Item | $ | lb | Bulk | Tags | Catalog copy |
|---|---|---|---|---|---|
| Lucifers (friction matches), box of 100 | 0.05 | 0.1 | — | ignite 2, 100 strikes, wet-ruin | "Strike anywhere. Strike *only* where you mean to." |
| Match safe, tinned brass, screw lid | 0.25 | 0.2 | cap 0.5 | container, wp | "A small thing to carry. The difference between a fire and a funeral." |
| Flint, steel & char tin | 0.25 | 0.5 | — | ignite 1 (wet-ok), Fe; char cloth ~30 lightings | "Your grandfather's method, and it still works when the matches don't." |
| Burning glass | 0.40 | 0.2 | — | ignite 1 (sun only), F | "Needs only the sun, which in November you may not have." |
| Tinder pouch: birch bark & fatwood | 0.05 | 0.3 | — | tinder | "Pitch pine split fine. Lights in the drizzle." |
| Tallow candles, lb (6) | 0.15 | 1 | 1 | light 1; ~7 h each (2,520 candle-min/lb); vermin eat them | "Smoky and honest. Mice will eat them if you don't." |
| Spermaceti candles, lb (6) | 0.40 | 1 | 1 | light 1.5; ~8 h each | "Clean flame from the whale fishery. For reading, and for impressing a widow." |
| Tin lantern, pierced | 0.50 | 1.5 | 3 | light 1.5, Fe, wind-proof; burns 1 candle | "Throws stars on the walls. Will not blow out." |
| Glass lantern, lard-oil (Fenwick) | 1.50 | 3 | 4 | light 3, F, Fe (tinplate); burns 60 lamp-min/h | "Fenwick's patent. See ten paces in a cave and keep both hands for climbing." |
| Lard oil, quart | 0.30 | 2 | 1 | fuel: 600 lamp-min (10 h in a lantern); congeals below ~40°F | "Pressed from honest pork." |
| Camphene burning fluid, pint | 0.25 | 1 | 1 | fuel: 360 lamp-min, light +1 while it lasts; explosive risk | "Burns twice as bright as lard oil. Fill the lamp *cold*." |
| Miner's candlestick ("sticking tommy") | 0.20 | 0.5 | — | light-holder, pierce 1, Fe | "Drives into a timber or a crack in the limestone. Penhallow & Trist, as used at Mineral Point." |
| Pitch torch, 3 | 0.10 | 3 | 3 | light 2, L, smoky; ~30 min each | "Crude, and visible from the next ridge." |
| Firewood, armload (split oak and ash) | 0.02 (or gathered) | 20 | 20 | fuel: 60 fire-min | "One armload keeps a cook-fire going about an hour. In January you will want eight, and you will not want to carry them." |

### 6.4 Cookery & Provisions

#### 6.4a Cookware and water

| Item | $ | lb | Bulk | Tags | Catalog copy |
|---|---|---|---|---|---|
| Tin cup | 0.10 | 0.3 | 1 | boil 0.5, Fe, nz | "Drink from it, cook in it, bang it on the table when the coffee's late." |
| Tin plate | 0.08 | 0.4 | 1 | Fe, nz | "Will outlast your appetite." |
| Frying pan, sheet iron | 0.50 | 2.5 | 3 | cook 1, Fe | "Bacon, then cornbread in the grease. The whole of frontier cookery." |
| Dutch oven, cast iron, 10 qt | 1.75 | 14 | 6 | bake 1, cook 1, boil 1, Fe, heavy | "Bakes bread in a hole in the ground. Too heavy to carry and too good to leave." |
| Reflector oven, tin | 0.75 | 3 | 4 | bake 0.75, Fe (tinplate) | "Bakes before an open fire, so long as you keep turning the pan and stay to watch it." |
| Camp kettle, nesting pair | 0.75 | 3 | 4 (nests) | boil 1, Fe (tinplate), nz; holds 4 qt | "One for water, one for whatever you catch." |
| Coffee mill, hand | 0.60 | 2 | 2 | grind 1, Fe | "Green beans keep for a year. Ground coffee keeps for a week." |
| Canteen, tin, wool-covered, 2 qt | 0.75 | 1 (+4 full) | 3 | contain-liquid, wp, Fe (tinplate); freezes on the strap below 32°F | "Wet the wool and the water stays cool. The cork will want replacing." |
| Canteen, gourd | 0.30 | 0.5 (+4) | 3 | contain-liquid, F | "No iron in it, if that worries you." |

#### 6.4b Provisions

Columns per §6's intro. "Keeps best / worst" names the strongest packaging or storage multiplier and the worst condition (§3.7.4). Prep: fire-minutes · cookware · water per serving.

| Item (unit) | $ | lb | Bulk | kcal | P/F g | Fresh | Shelf | Keeps best / worst | Prep | Catalog copy |
|---|---|---|---|---|---|---|---|---|---|---|
| Flour, wheat (lb; 25-lb sack $1.25) | 0.05 | 1 | 0.6 | 1,650 | 46/5 | 0 | 240 d | tin ×0.4, vermin-proof ×0.7 / wet ×6, mice | bake 60 · bake · 120 ml (Trade (Cookery) DC 10); or slapjacks 30 · cook · 120 ml | "Fine milled at the falls. Keep it dry, keep it from the mice, keep it." |
| Cornmeal (lb; 10 lb $0.30) | 0.03 | 1 | 0.6 | 1,680 | 36/17 | 0 | 120 d | cold ×0.5 / wet ×5, warm ×1.7 (goes rancid) | mush 30 · boil · 250 ml; johnnycake 20 · cook | "Johnnycake, mush, or bait." |
| Parched corn (lb) | 0.06 | 1 | 0.8 | 1,800 | 40/20 | 0 | 365 d | tin ×0.4 / wet ×4 | **raw ✓**; or 20 · boil · 250 ml | "Corn browned dry in a kettle. Eat it by the handful on the march; it asks nothing of you but teeth." |
| Hardtack (ship's biscuit) (lb) | 0.08 | 1 | 1 | 1,650 | 40/6 | 0 | 540 d | tin ×0.3 / wet ×5, weevils | raw (−2 morale); soak 30 min · — · 250 ml; fry 15 · cook (+2) | "Soak before trying your teeth on it." |
| Bread, fresh loaf (lb) | 0.04 | 1 | 2 | 1,200 | 40/10 | 5 | 5 d | oilcloth (dry) / wet ×3, warm ×1.7 | raw ✓; `ward_bread` while fresh | "Baked this morning. Eat it this week, and keep the heel in your pocket." |
| Flatbrød (lb) (`12`) | 0.08 | 1 | 3, F | 1,700 | 45/8 | 0 | 365 d | tin ×0.4 / wet ×5, crushes | raw ✓ | "Rolled thin as paper on Kvale Ridge and baked dry. Weighs nothing, breaks if you sit on it, keeps till spring." |
| Hearth-loaf (lb) (`12`) | 0.06 | 1 | 1.5 | 1,600 | 42/6 | 0 | 21 d | dry / wet ×4 | raw ✓; `ward_bread` for its whole shelf life | "Twice-baked rye under a crust of salt, from the Hall bakers on the Ridge. Counts as bread in your pocket until the day it molds." |
| Bacon / side pork, salt-cured (lb) | 0.12 | 1 | 1 | 3,400 | 30/370 | 0 | 120 d | brine ×0.1, cold ×0.3 / warm ×2.2, hot ×4.5 | raw (−3); fry 15 · cook (+2); boil 60 · boil · 400 ml | "Salt-cured. Melts in summer, keeps in winter." |
| Pemmican (lb) | 0.30 | 1 | 0.5 | 2,900 | 110/270 | 5 | 730 d | cold ×0.5 / hot ×2, wet ×2 | **raw ✓**; or boiled with flour 20 · boil · 300 ml | "Dried meat pounded with fat. A pound feeds a working man a day." |
| Dried beef / jerked venison (lb) | 0.15 | 1 | 1 | 1,500 | 300/30 | 0 | 180 d | tin ×0.4 / wet ×3 | raw ✓ (lean: eat with fat) | "Sliced thin and dried over a smoke. A pound is a great deal of chewing and not much of a supper." |
| Salt cod / klippfisk (lb) (`12`) | 0.06 | 1 | 1 | 1,300 | 280/10 | 0 | 365 d | dry / wet ×3 | soak 1,440 min · — · 1 L, then 30 · boil | "Split, salted and dried on the rocks at Lofoten, or at Gloucester. Soak it a day or chew it a week." |
| Beans, dry (lb) | 0.04 | 1 | 0.5 | 1,550 | 100/6 | 0 | 730 d | dry / wet ×3 (they sprout) | soak 480 min, then 180 · boil · 500 ml; raw gives 0 kcal | "Nourishing, if you have six hours and a fire." |
| Potatoes (peck, 15 lb) | 0.10 | 15 | 12 | 5,250 | 135/2 | 40 | 150 d | cellar (cold ×0.5) / **frost ruins**, warm ×2 (sprouting) | boil 30 · boil · 250 ml; roast in the coals 45 · — | "Dug last fall and kept dark and above freezing. By April they're sprouting eyes, and you'll be glad of them." |
| Sauerkraut (lb, from the crock) (`12`) | 0.05 | 1 | 0.5 | 90 | 4/0 | 60 | 180 d | brine ×0.2 / warm ×2 | raw ✓ | "Cabbage, salt and patience. The German wives swear it keeps a crew from the scurvy, and the German wives are right." |
| Dried apples (lb) | 0.10 | 1 | 1 | 1,100 | 4/1 | 30 | 270 d | tin ×0.4 / wet ×4 | raw ✓; stew 30 · boil · 200 ml (+3) | "Pie for the homesick." |
| Cheese (lb) | 0.12 | 1 | 1 | 1,800 | 110/150 | 5 | 60 d | cold ×0.5 / warm ×1.7, hot ×3 | raw ✓ | "From the Swiss settlement down the valley." |
| Butter, salted, crocked (lb) | 0.15 | 1 | 0.5 | 3,250 | 4/370 | 5 | 90 d | sealed crock ×0.5, springhouse ×0.5 / warm ×2 (rancid) | raw ✓ | "Packed hard into stoneware under a cloth of brine. Keeps till Easter, if the cellar stays cool." |
| Lard (lb) | 0.09 | 1 | 0.5 | 4,100 | 0/454 | 0 | 180 d | sealed crock ×0.5 / hot ×3 | cooking fat: +2 morale to fried meals | "Rendered at hog-killing. Every fried thing in the county starts here." |
| Eggs (dozen) | 0.10 | 1.5 | 2, F | 850 | 70/60 | 10 | 21 d | cold ×0.5 / **frost ruins**, warm ×2 | boil 10 · boil; fry 5 · cook | "Fresh from the yard, packed in oats. Mind the pack." |
| Milk (quart) | 0.03 | 2.2 | 1 | 600 | 32/35 | 20 | 1 d | springhouse ×0.5 / warm ×2.5 → spoils to clabber | raw ✓ (hydrates) | "From the cow this morning. Ask the farmer what the cow's been eating." |
| Oysters, tinned (1-lb tin) | 0.40 | 1.25 | 1 | 300 | 40/10 | 10 | 1,095 d sealed; 1 d open | sealed: ignores wet and vermin | open the tin (1 min, `cut 2` or `pry`); raw ✓ (+4) | "Baltimore cove oysters, sealed in tin. A luxury in January and a dear one: you are paying to carry the can." |
| Sugar, brown (lb) | 0.08 | 1 | 1 | 1,720 | 0/0 | 0 | 730 d | tin / wet ×3, ants | raw ✓ (+2) | "A little sweetness in the wilderness." |
| Maple sugar (lb) | 0.09 | 1 | 0.5 | 1,600 | 0/0 | 0 | 730 d | tin / wet ×3 | raw ✓ (+2) | "Boiled down on the north slopes in March. Forty kettles of sap went into a cake of this." |
| Coffee, green beans (lb) | 0.14 | 1 | 1 | 0 | — | 0 | 365 d (ground: 7 d) | tin / wet ×3 | roast 20 · cook, grind · grind, brew 15 · boil · 250 ml; 40 cups (+4, stimulant) | "The frontier runs on it." |
| Tea (lb) | 0.60 | 1 | 1.5 | 0 | — | 0 | 365 d | tin / wet ×3 | brew 10 · boil · 250 ml; 150 cups (+3, stimulant) | "For those raised otherwise." |
| Salt (lb) | 0.03 | 1 | 0.5 | — | — | — | keeps | — / wet: clumps and dissolves | preserve (~1 lb per 5 lb meat, §3.7.7); **ward-fae (line)** | "Seasons meat, cures hides, keeps certain visitors outside the circle." |
| Whiskey (quart) | 0.25 | 2.5 | 1 | 2,080 | — | 0 | years | — | raw; 45% alcohol, antiseptic 0.5, trade | "Medicine, currency, mistake." |
| Tobacco, plug (lb) | 0.25 | 1 | 0.5 | — | — | — | 365 d | tin / wet ×3 | habit (`10` craving), ~16 days at 1 oz | "Navy plug, pressed hard. Small change in every camp on the river." |

#### 6.4c Packaging and stores

**[DECISION]** (`00` P8) Packaging is gear. Every item here is a container whose `protects` list sets the spoilage multiplier for the food inside (§3.7.4) and keeps the wet out (§3.4).

| Item | $ | lb | Capacity | Protects | Typical effect | Catalog copy |
|---|---|---|---|---|---|---|
| Tin canister, 1 gal, press lid | 0.30 | 1.5 | 4 Bulk | airtight, vermin-proof, crushproof; Fe (tinplate) | hardtack ×0.3, flour ×0.4, sugar dry | "Keeps the weevils out of the biscuit and the damp out of the sugar." |
| Oilcloth provision bag | 0.15 | 0.3 | 3 Bulk | waterproof (rain and splash; not immersion past a minute) | stops `wet_pct` | "Linseed-oiled linen with a drawstring neck. Rain runs off it; the creek does not." |
| India-rubber provision bag | 0.75 | 0.75 | 4 Bulk | waterproof (10 min immersion), airtight when rolled tight; cracks below 0°F | floats a side of bacon across a ford | "Goodyear's cloth. Carries your bacon over the ford, if you tie it right." |
| Tarred sack | 0.10 | 0.5 | 50 lb | splashproof | slows wet, not mice | "For grain and potatoes. Not for anything a mouse can smell." |
| Stoneware crock, 2 gal, lid | 0.40 | 9 | 8 Bulk | vermin-proof, brine; F | kraut, butter, salt pork in brine | "Salt-glazed stoneware, up the river from the Ohio potteries. Heavy as sin, and holds brine, butter or kraut till spring." |
| Bladder & wax, for a crock | 0.03 | — | — | makes a crock airtight | butter and lard ×0.5 | "Tie it on wet; it dries tight as a drum." |
| Keg, half-barrel, for brine | 0.75 | 20 | 50 lb | brine, vermin-proof | salt pork ×0.1 | "Fill it at hog-killing. Empty it by April." |
| Flour barrel | 0.50 | 18 | 196 lb | vermin-proof (mostly) | flour ×0.7 | "Holds a barrel of flour, which is what a family eats by spring." |
| Crib tin (miner's dinner pail) (`12`) | 0.20 | 1 | 2 Bulk | crushproof, vermin-proof; keeps food warm ~2 h; Fe (tinplate) | a pasty arrives whole and warm | "Tin pail with a tray for the tea. Every man in the Diggings knows his own by the dents." |
| Creel, willow | 0.35 | 1 | 6 Bulk | — (airy: fish stay cool if the moss is wet) | fresh fish one band cooler while the moss is wet | "Line it with wet moss and the trout reach the pan in better temper." |

**Storage structures** aren't sold in the Book; they're built, hired (§6.15), or part of a farm. Each is a fixed container with a storage kind (§3.9): root cellar, springhouse, smokehouse, ice house, corncrib, cache.

#### 6.4d Found, not bought

Wild food has the same fields. Prices are what a store or a neighbor pays for it, when anyone does. Seasons and stock are `05` §5.4; foraging yield is `05`'s formula.

| Item (unit) | Trade value | kcal | P/F g | Fresh | Shelf | Keeps best / worst | Prep | Note |
|---|---|---|---|---|---|---|---|---|
| Brook trout, fresh (lb) | 0.06 | 640 | 90/30 | 45 | 2 d | cold ×0.3, frozen ×0.02 / warm ×2.5, hot ×5 | fry 15 · cook; roast on a stick 25 · — | The spring creeks are full of them (`05` §5.2). |
| Venison, fresh (lb) | 0.05 | 550 | 100/15 | 40 | 3 d hung | cold ×0.3, frozen ×0.02 / warm ×2.5 | roast 40 · —; fry 20 · cook | Lean: a diet of venison alone needs fat beside it (§3.7.3). |
| Ramps (lb) | — | 140 | 7/1 | 90 | 5 d | cold ×0.5 / warm ×2 | raw ✓ (−1); fry 5 · cook | North slopes, Apr–May. The first fresh food of the year. |
| Morels (lb) | 0.10 | 140 | 14/2 | 60 | 3 d (dried 180 d) | cold ×0.5 / wet ×2 | fry 10 · cook (with fat). **No raw option**: raw morels make you sick. | Late Apr–May. |
| Cave mushrooms (lb) (`12`) | — | 140 | 14/2 | 50 | 4 d | cold ×0.5 | fry 10 · cook; boil 15 · boil | Grown in goblin Club cellars: winter fresh food. |
| Berries (quart) | 0.05 | 150 | 2/1 | 90 | 1 d | cold ×0.5 / warm ×2 | raw ✓ (+3) | Jun–Aug (`05` §5.4). |
| Fae fare (any) | — | **0** (looks like plenty) | — | — | — | — | raw | `fae_food`. Never in the Book. Starts `02`'s Bound chain, adds `06` Drift; mortal food then satisfies at 50% for a while (`05`, C26). Its apparent kcal is a glamour (§3.6). |

### 6.5 Tools

| Item | $ | lb | Bulk | Tags | Catalog copy |
|---|---|---|---|---|---|
| Felling axe (Hollister & Sons) | 1.50 | 5 | 6 | chop 3, cut 1, hammer 1, L, Fe | "Ground true at Pittsburgh. Will drop a ten-inch oak before the coffee boils." |
| Hatchet / belt axe | 0.65 | 1.5 | 2 | chop 2, cut 1, hammer 1, Fe | "Kindling, tent pegs, and the last argument." |
| Butcher knife, sheath | 0.50 | 0.5 | — | cut 2, Fe | "Plain as a fence post and twice as useful." |
| Clasp knife (jackknife) | 0.35 | 0.25 | — | cut 1, Fe | "Lives in the pocket and goes everywhere you do." |
| Clasp knife, Brauer two-blade | 0.90 | 0.25 | — | cut 1.5, Good, Fe | "Milwaukee steel. A boy's first fortune." |
| Bucksaw | 1.25 | 4 | 6 | saw 3, L | "For the man who means to stay the winter." |
| Spade | 0.90 | 5 | 5 | dig 3, L, Fe | "Graves, latrines, and the occasional fortune." |
| Pick, miner's (Penhallow & Trist) | 1.25 | 6 | 5 | dig 2, pry 2, L, Fe | "Cornish pattern for the lead diggings. Limestone yields to it, eventually." |
| Crowbar, 3 ft | 0.75 | 8 | 3 | pry 3, L, Fe | "For doors that should open and lids that shouldn't." |
| Claw hammer | 0.40 | 1.5 | 1 | hammer 2, pry 1, Fe | "Every cabin begins with one." |
| Cut nails, lb | 0.06 | 1 | 0.5 | building, Fe (ward-fae as line) | "Ten-penny. A pocketful has uses beyond carpentry." |
| Auger, 1-inch | 0.60 | 2 | 1 | bore | "Bores the holes for pegs, traps, and tapping maples." |
| Whetstone | 0.15 | 0.5 | — | maintain-edge | "A dull knife is how men lose fingers." |
| Gun oil / neatsfoot oil, small tin | 0.15 | 0.3 | — | maintain (rust, leather) | "Keeps the rust off the barrel and the crack out of the boot." |
| Sewing kit ("housewife") | 0.25 | 0.2 | — | sew | "Needles, thread, buttons, and the memory of whoever rolled it." |
| Awl & waxed thread | 0.20 | 0.2 | — | sew-leather, pierce 1 | "For harness, boots, and the sole that's flapping." |
| Pocket compass | 1.00 | 0.2 | — | navigate, **fae-sensitive** | "True north, ordinarily. Note when it isn't." |
| Spyglass, brass, 3-draw | 6.00 | 1.5 | 1 | sight, F | "Three draws of brass. See the smoke before the smoke sees you." |
| Pocket watch, silver case | 7.00 | 0.3 | — | timekeeping, silver, **fae-sensitive** | "Keeps railroad time. If it runs fast in the hollow, trust the watch." |
| Slate & pencil | 0.10 | 1 | 1 | write (erasable) | "For tallies, notes, and messages you don't want to keep." |

*Note: the compass and watch double as fae-intensity instruments. Needle drift and time slippage are readable simulation outputs, which rewards a player who knows the folklore.*

### 6.6 Clothing (by season)

Driftless winters reach −30°F. Clothing is the main insulation budget. **[PROPOSAL, closes C23]** `03` publishes clothing and bedding values in **`05`'s units: °F of comfort-band extension** (`wearable.insulation`), plus wind block and wet retention. Layers sum with bedding at night; layer rules and the comfort band live in `05` §6.3. The old `insulate` points converted at roughly ×5, matched to `05`'s anchors (wool shirt 6, wool union suit 8, buffalo robe 25). Wet retention by material: wool 50%, cotton 10%, fur 60%, leather 30%, gum and oilskin 100% (they don't absorb, but they trap sweat).

| Item | $ | lb | Season | Tags | Catalog copy |
|---|---|---|---|---|---|
| Red flannel drawers & undershirt | 1.25 | 1.5 | Fall–Spring | ins 8°F, wool | "Itches until November. After November you will love it." |
| Wool socks, pair (Haugen) | 0.20 | 0.2 | All | ins 2°F (feet), wool; wear ~5/walking day (§3.8) | "Buy three. Change them daily. Nobody listens." |
| Cotton shirt | 0.50 | 0.5 | Summer | ins 2°F, cotton | "Cool in July. Deadly in a cold rain." |
| Wool flannel shirt, checked | 1.25 | 1 | All | ins 6°F, wool | "The woodsman's shirt. Warm when wet, which it will be." |
| Trousers, jean cloth | 1.50 | 1.5 | Summer | ins 2°F, cotton-blend | "Kentucky jeans, double-seated." |
| Trousers, heavy wool | 2.50 | 2 | Fall–Spring | ins 7°F, wool | "Shed snow, hold heat." |
| Brogans | 1.25 | 2.5 | All | footwear | "Pegged soles, rough-out leather. Rub them with tallow." |
| Boots, tall cowhide | 3.50 | 4 | All | footwear, ford-shallow | "To the knee. Keeps out snakes and shallow fords." |
| Moccasins, smoked hide | 0.50 | 0.5 | Summer/snow | footwear, Stealth +2, wet-fast | "Silent on leaves. Wet in the first puddle. Warm in dry snow." |
| Moccasin liners, blanket wool | 0.25 | 0.3 | Winter | ins 4°F (feet), wool | "Turns a summer moccasin into a winter one." |
| Gaiters / leggings, wool | 0.50 | 0.5 | All | ins 2°F, ticks, snow, brush | "Keeps out snow, burs, and the creeping things of June." |
| Mackinaw coat (Haugen) | 5.00 | 5 | Winter | ins 20°F, wind 40%, wool | "Thick as a door, warm as a kitchen." |
| Capote, hooded blanket coat | 4.00 | 4.5 | Winter | ins 17°F, wool, **reversible** | "Cut from a single blanket, sashed at the waist. Turn it inside-out when the woods start acting strange." |
| Buffalo coat | 12.00 | 15 | Deep winter | ins 32°F, wind 80%, fur, heavy | "For the January teamster. You will be warm, and slow." |
| Oilskin slicker | 2.00 | 3 | Spring/Fall | ins 2°F, wind 90%, wp, shelter 0.5 (self) | "Yellow, stiff, and the only dry thing on the river." |
| Felt hat, wide brim | 1.50 | 0.5 | All | rain/sun | "Fit for the Sabbath and the storm." |
| Straw hat | 0.25 | 0.2 | Summer | sun | "Haying weather." |
| Fur cap with earflaps | 1.50 | 0.5 | Winter | ins 5°F (head), fur | "Frostbite starts at the ears." |
| Mittens, wool, with leather overmitts | 0.60 | 0.5 | Winter | ins 5°F (hands), Dex −2 | "Take them off to shoot. Put them back on before you forget how." |
| Muffler, wool | 0.40 | 0.3 | Winter | ins 3°F | "Knitted by somebody's mother." |

**Reversibility:** wearing a coat inside-out is a clothing *state*, not an item. It's a folk ward against being pixie-led. It costs social Opinion in towns ("is he simple?") and helps in the wilds.

### 6.7 Arms

Combat stats (damage, range, accuracy, Defense for armor) are owned by `02` §9.5; listed here are price, reload time, handling tags and what each gun eats. **Gap (`09` §4 #2):** `02` stats six firearms; the Bowie, saber, sword-cane, bows, crossbow, squirrel and plains rifles, double gun, pepperbox and all of §6.8's armor still need `02` numbers. **[DECISION]** (00) Black powder is slow and expensive. One shot matters. Reload times are T0 durations (C21; `07` proposes tenths of a second).

| Item | $ | lb | Bulk | Reload | Tags | Catalog copy |
|---|---|---|---|---|---|---|
| Bowie knife | 2.00 | 1 | 1 | — | cut 2, chop 0.5, weapon, Fe | "Arkansas pattern. Kitchen, camp, and the other thing." |
| Cavalry saber, surplus | 4.00 | 3 | 3 | — | weapon, L, Fe | "Dragoon pattern. Useless for chores, alarming in a doorway." |
| Sword-cane | 6.00 | 1.5 | 1 | — | weapon, concealed, Fe | "A gentleman's walking stick until it isn't." |
| Smoothbore musket, surplus flintlock, .69 | 6.00 | 10 | 8 | ~20 s | firearm, L, Fe, misfire-wet high | "Fought the British. Will fight a deer. Hits what it is pointed near." |
| Percussion musket (converted) | 9.00 | 10 | 8 | ~20 s | firearm, L, Fe | "Converted to caps, so it fires in drizzle more often than not." |
| Squirrel rifle, .36 | 12.00 | 7 | 7 | ~30 s | firearm, L, Fe, accurate | "Small ball, little powder, fine for the pot." |
| Kentucky long rifle, flint, .45 (old) | 14.00 | 9 | 9 | ~35 s | firearm, L, Fe, accurate | "Long, elegant, and older than you. Patched with care." |
| Plains rifle, half-stock .54 (Ostrander) | 25.00 | 10.5 | 8 | ~30 s | firearm, L, Fe, accurate, heavy ball | "Drops an elk at two hundred yards. Built in St. Louis for men who could not afford to miss." |
| Fowling piece, single, 12 ga. | 7.00 | 7 | 8 | ~20 s | firearm, shot/ball, L, Fe | "Ducks, partridge, and anything at twelve paces." |
| Double-barrel shotgun, 12 ga. | 18.00 | 8 | 8 | ~40 s (both) | firearm, 2 shots, L, Fe | "Two answers before you need to reload." |
| Single-shot percussion pistol | 5.00 | 2 | 1 | ~20 s | firearm, Fe | "For the coat pocket and the last resort." |
| Pepperbox pistol, 4-barrel | 8.00 | 2 | 1 | ~2 min | firearm, 4 shots, chain-fire risk, Fe | "Fires four times. Occasionally all at once." |
| Revolver, .36 six-shot (Carrow & Tuck) | 24.00 | 2.6 | 1 | ~90 s per cylinder | firearm, 6 shots, Fe | "Six shots, patent cylinder. The finest pocket artillery in the Union." |
| Hunting bow, hickory | 3.00 | 2 | 4 | 2 s | bow, L, silent, no Fe | "Quiet. Ask anyone it's been used on." |
| Arrows, dozen, iron-headed | 0.75 | 1 | 2 | — | ammo, Fe (heads) | "Barbed for game." |
| Arrows, dozen, horn-tipped | 0.60 | 1 | 2 | — | ammo, no Fe | "Turned cow-horn points from a Milwaukee comb works. No iron in them, for hunting where iron isn't welcome." |
| Crossbow, old-country | 10.00 | 8 | 6 | ~25 s | silent, L, Fe | "Brought over in a trunk. Silent as a closed door." |
| Black powder, rifle grade, lb (canister) | 0.40 | 1 | 0.5 | — | powder: 7,000 gr (60–200 loads by gun; burn table below), wet-ruin, explosive | "Keep it dry, keep it away from the fire, keep it away from fools." |
| Powder horn | 0.50 | 0.5 | 1 | — | container (powder), wp-partial | "Scraped thin enough to see the level through." |
| Powder flask, copper (Carrow & Tuck) | 1.00 | 0.6 | 0.5 | — | container (powder), wp, measure | "Measures the charge. Doesn't sweat in rain." |
| Lead, bar, 5 lb | 0.35 | 5 | 0.5 | — | cast-bullets, lead: 35,000 gr (balls per lb below) | "Mined fifty miles from here. Cast your own." |
| Bullet mould, specify caliber | 0.40 | 0.5 | — | — | cast (lead+fire) | "Twelve balls an hour by a good fire." |
| Patches & patch box | 0.15 | 0.2 | — | — | ammo-support | "Greased linen. A ball without a patch is a prayer." |
| Percussion caps, tin of 100 | 0.30 | 0.1 | — | — | ignition: 100 caps, 1 per shot attempt; wet-ruin | "Without these, your rifle is a club." |
| Gun flints, dozen | 0.10 | 0.2 | — | — | ignition, ignite 1; ~40 strikes each | "English flint, good for forty strikes each." |
| Shot, No. 4 birdshot, 5 lb | 0.40 | 5 | 0.5 | — | ammo (shotgun): 80 oz, ~64 loads at 1¼ oz | "Partridge and teal." |
| Paper cartridges, .69, ten | 0.25 | 1 | 0.5 | faster | ammo, wet-ruin | "Bite, pour, ram. Faster than a horn." |
| Silver ball, cast, each | 0.75 | 0.05 | — | — | ammo, silver | "Ask no questions about why you'd want one, and we'll ask none about why we stock them." |
| Gun case, oiled leather | 0.75 | 1 | — | +3 s draw | wp (for gun) | "Keeps the lock dry through a river crossing." |

**[PROPOSAL] What each gun eats** (`consumes` per shot, §3.8). Period-typical charges; `02` can tune for balance. Powder in grains (7,000 per lb), ball weight in grains of lead.

| Gun | Powder/shot | Shots per lb powder | Ball | Balls per lb lead | Ignition | Other |
|---|---|---|---|---|---|---|
| Squirrel rifle, .36 | 35 gr | 200 | 65 gr | ~107 | cap | patch |
| Kentucky long rifle, flint, .45 | 60 gr + 5 priming | ~108 | 128 gr | ~54 | flint (~40 strikes) | patch |
| Plains rifle, .54 | 100 gr | 70 | 225 gr | ~31 | cap | patch |
| Smoothbore musket, .69 (flint or converted) | 110 gr (+5 priming if flint) | ~60 | 480 gr | ~14 | flint or cap | or a paper cartridge (charge and ball included) |
| Fowling piece / double gun, 12 ga. | 75 gr | ~93 | 1¼ oz shot, or a 12-ga ball | 64 loads per 5 lb shot | cap | wads |
| Single-shot pistol, .50 | 40 gr | 175 | 180 gr | ~39 | cap | — |
| Revolver, .36 | 20 gr | 350 | 80 gr | ~87 | 6 caps per cylinder | grease over the chambers |

The lesson the table teaches: a pound of powder is 200 squirrel shots or 60 musket shots, and a tin of 100 caps usually runs out before either. The planner's "Shots" row is the minimum across powder, ball, ignition and patches (§2.4).

### 6.8 Armor (and why it's rare)

**[PROPOSAL]** Armor is rare on the frontier for simulable reasons, and the sim produces them on its own:
- **Weight and heat:** a mail shirt in a Wisconsin July → heat exhaustion (`05`).
- **Guns:** a .54 ball goes through most period armor at short range; armor helps against teeth, claws, blades, and spent shot.
- **Cost:** a mail shirt costs a month of labor.
- **Social signal:** a man in armor in a river town looks deranged or dangerous (Opinion and Notoriety hits, `04`).
- **Iron:** metal armor is a massive Iron Presence. Great against fae claws, terrible for finding or bargaining with fae.

| Item | $ | lb | Tags | Catalog copy |
|---|---|---|---|---|
| Quilted jack, cotton-wadded | 3.00 | 6 | armor light, ins 5°F, cotton | "Will turn a knife and a cold wind. Hot as Hades in summer." |
| Smoked-hide jerkin, moose | 5.00 | 7 | armor light, no Fe, wet-heavy | "Traded down from the north woods. Quiet, and no iron to trouble anyone." |
| Buff coat, thick oil-tanned leather | 8.00 | 9 | armor medium-light, ins 8°F, leather | "Your great-grandfather's cavalry wore these. Wolves can't get through it." |
| Plate-insert vest | 10.00 | 12 | armor medium (torso), Fe | "Steel plates sewn behind the lining. For the man who expects a knife and not a rifle." |
| Cuirass, heirloom (old-country cuirassier) | 20.00 | 18 | armor heavy (torso), Fe, conspicuous | "Breast and back, from some emperor's war. You will be noticed." |
| Mail shirt, old-country | 30.00 | 22 | armor medium-heavy, Fe heavy | "Ten thousand rings, riveted by hand. A fae's nightmare, and a sweat bath." |

### 6.9 Medicine & Remedies

**[DECISION]** (P1) Period remedies have *true* simulated effects, good or bad, independent of what people believe (§3.6).

| Item | $ | lb | True effect (hidden until known) | Catalog copy |
|---|---|---|---|---|
| Linen bandages, roll | 0.15 | 0.2 | heal-bleed 1 | "Clean linen, boiled. Keep it in the oilcloth." |
| Lint & sticking plaster | 0.10 | 0.1 | minor wounds | "For blisters and the small calamities." |
| Laudanum, 2 oz | 0.25 | 0.3 | heal-pain 2; ~16 doses; addictive; overdose | "Tincture of opium. A teaspoon for the toothache, and no more." |
| Quinine sulfate, 1 oz | 3.00 | 0.1 | heal-ague (real malaria treatment); ~15 doses | "Dear as silver and worth it. The river bottoms will give you the ague." |
| Calomel, packet | 0.15 | — | purgative; mercury harm | "The physician's mainstay." *(It poisons you.)* |
| Dr. Pelham's Universal Restorative | 0.75 | 0.5 | ~30% alcohol, trace opium; morale +, heal 0 | "Cures catarrh, dyspepsia, female complaint, melancholy, and the bloody flux." |
| Horse & Human Liniment | 0.35 | 0.5 | heal-sprain 0.5 (counterirritant) | "For the stiff leg, on either species." |
| Mustard plaster | 0.10 | 0.1 | chest congestion minor; burns if left on | "Draws the cold out of the chest." |
| Snakeroot, dried | 0.10 | 0.1 | none vs. venom (folk belief only) | "For the rattlesnake bite." *(Timber rattlers live on the bluffs. This won't help.)* |
| Willow bark, dried | 0.05 | 0.1 | heal-pain 0.5, fever 0.5 | "Steep and drink bitter." |
| Surgeon's pocket case | 6.00 | 1 | enables Medicine: surgery, extract ball | "Lancets, probe, forceps, and a curved needle. Courage not included." |
| Carbolic? *(not period: 1867)* | — | — | — | *Kept off the list. The Book is pinned to spring 1855 (`00`); carbolic can arrive only through a legacy time-skip.* |

### 6.10 Fishing & Trapping

| Item | $ | lb | Tags | Catalog copy |
|---|---|---|---|---|
| Fishing line, braided silk, 30 yd | 0.40 | — | fish | "Strong enough for a pike, fine enough for a brookie." |
| Hooks, assorted, dozen | 0.10 | — | fish, Fe | "Limerick bend." |
| Jointed rod, ash & lancewood | 2.00 | 1 | fish +, L | "Three joints, brass ferrules. The spring creeks are full of trout." |
| Fly book & a dozen flies | 1.50 | 0.3 | fish (trout) ++ | "Tied by a Scotchman in Galena who will not say what he puts in the hackle." |
| Trot line with 20 hooks | 0.50 | 0.5 | fish (passive, river) | "Set it at dusk across a slough. Catfish by morning." |
| Fish gig, three-tine | 0.50 | 1.5 | fish (spear), Fe, L (w/ pole) | "For the spring sucker run, by torchlight." |
| Steel trap No. 1 (Haverill) | 0.60 | 1.5 | trap (muskrat, mink), Fe | "The Community's best. Muskrat money is real money." |
| Steel trap No. 3 (Haverill) | 1.25 | 3 | trap (fox, beaver, otter), Fe | "Double spring. Set it under water for beaver." |
| Wolf trap No. 4 (Haverill) | 2.50 | 5 | trap (wolf), Fe | "The county pays a bounty. The wolf disagrees." |
| Snare wire, brass, coil | 0.15 | 0.2 | snare, no Fe | "Brass, not iron. Rabbits don't care which. Some things do." |
| Fleshing knife & stretching boards | 0.40 | 2 | process-pelt | "A pelt badly fleshed is a pelt half-priced." |
| Castor bait, vial | 0.20 | — | lure (beaver) | "Smells like what it is." |

### 6.11 Rope & Climbing

| Item | $ | lb | Bulk | Tags | Catalog copy |
|---|---|---|---|---|---|
| Hemp rope, ½-in., 50 ft | 1.00 | 8 | 4 | bind, climb, holds ~600 lb (new) | "Tarred hemp. Swells when wet, rots if you let it." |
| Manila rope, ½-in., 50 ft | 1.50 | 6 | 3 | bind, climb, holds ~900 lb | "Lighter and stronger. Holds a man and his regrets." |
| Rawhide line, 30 ft | 0.60 | 2 | 1 | bind; stretches wet | "Shrinks as it dries. Lash something wet and it holds like iron." |
| Cord / twine, ball | 0.10 | 0.3 | 0.5 | bind 0.5 | "Snares, lashings, laces, and a hundred small repairs." |
| Grappling iron, 4-tine | 1.25 | 4 | 1 | climb, Fe | "For bluff faces and second-story windows." |
| Iron spikes, dozen | 0.40 | 3 | 1 | climb, anchor, Fe (ward line) | "Drive them into a crack in the limestone. Or across a threshold." |
| Rope ladder, 20 ft | 2.00 | 10 | 6 | climb (easy) | "For the shaft at the old diggings, going down and especially coming up." |
| Block & tackle, single | 3.00 | 8 | 3 | haul ×2 | "Haul a wagon out of a slough, or a friend out of a sinkhole." |

### 6.12 Folk-Magic & Fae Protection

**[PROPOSAL]** Folk wards are real in the sim. Their power is low and situational, scaled by Fae intensity and sometimes by the user's belief or Lore (Fae) (`02`). The Outfitter stocks them openly, because in the Driftless everyone does.

| Item | $ | lb | Tags | Catalog copy |
|---|---|---|---|---|
| Rock salt, 5 lb | 0.12 | 5 | ward-fae (circle/line), preserve | "A ring of it round your bedroll. The Norwegians swear by it and so do the Irish." |
| Iron nails, pocketful | 0.03 | 0.5 | ward-fae 1, Fe | "Carry three in the left pocket. Every child in the county knows why." |
| Horseshoe, worn | 0.10 | 1 | ward-fae (over door/tent), Fe, luck | "Hung points up. One you find yourself is luckier." |
| Cold-iron knife (Brauer, cold-hammered) | 3.50 | 0.5 | cut 1, **CFe**, ward-fae 3 | "Hammered cold, never quenched. Holds a poor edge and a great reputation." |
| Cold-iron horseshoe-nail ring | 1.00 | — | **CFe**, ward-fae 1 (worn) | "Bent from a nail, worn on the finger. Small, cheap, and they notice it." |
| Rowan-and-red-thread cross | 0.10 | — | ward-fae 1, rowan | "Two twigs of mountain ash bound with red. Sewn in a hem or hung in a window." |
| Red thread, skein | 0.03 | — | charm-making | "For binding charms and for mending." |
| Bread heel (fresh) | 0.01 | 0.2 | ward-pixie-led, per (5–7 days) | "Keep it in your pocket. Keep it fresh. Don't eat it." |
| St. John's wort sachet | 0.10 | — | ward-fae 0.5, see-true (Midsummer) | "Gathered on the right night. Ask the herb-wife which." |
| Holed silver dime on a string | 0.15 | — | ward 1, silver | "Ten cents of silver and five cents of labor. Worn at the throat." |
| Brass bell, small | 0.15 | 0.2 | ward (rung: breaks lesser glamour), signal, nz | "Like a church bell, smaller. Ring it when the woods go quiet." |
| Witch bottle, stoneware | 0.40 | 1.5 | ward-curse (buried at threshold), F | "Fill it as your grandmother told you. Bury it at the door." |
| Himmelsbrief (heaven-letter) | 0.50 | — | ward (bearer: fire, shot, "evil"), blessed? | "Copied in a fair German hand. Carry it and be protected against sword, shot, and the evil thing." |
| Hex sign, painted barn-board | 1.50 | 6 | ward (camp/structure), L | "Rosettes and distelfinks. Nails to the barn; leans against a tent." |
| Holy water, vial | 0.25 (donation) | 0.2 | blessed, ward/harm vs. certain fae | "Blessed by the priest who comes up from the landing. He does not know we sell it." |
| Hag stone (holed stone) | 1.00 | 0.3 | see-true (look through), rare | "Found in a creekbed, worn clean through. Look through it, if you dare." |
| Gunflint scraper, English | 0.20 | 0.1 | cut 1, F, no Fe | "Struck from the same Brandon flint as your gunlock's, and sold by the same merchant. Sharp as anything, and no iron in it." |
| Hand-bell, bronze (Hall-cast) (`12`) | 0.35 | 0.3 | signal, nz, **ward-fae** (ringing holds a short line ward), no Fe | "From the Hall foundry at Prairie du Chien, the same that cast the Iron Ford bell. Ring it at the threshold and walk on." |

*Hidden data:* each ward has a true strength per fae type (`01`/`02` bestiary). Some wards work only on some Courts. Players learn this the way people did, through experience and rumor.

**No Native artifacts as wards or no-iron goods (C10, `01` §2.1).** In the Driftless, a flint point or blade turned up by a plow is a Native artifact. Treating it as a fae weapon, a charm, or an iron-free trade good is the mystification `01` §2.1 forbids, so the Book's no-iron tools have European sources: English gunflint, brass, horn, bronze. The European folk diagnosis "elf-shot" can stay as belief (`05`, `06`), but its physical token is a fae-made thorn or splinter, never a found point. **[OPEN]** Whether a found point exists in the game at all, and if so as what, waits on `01` Q1.

### 6.13 Books & Almanacs

| Item | $ | lb | Tags | Catalog copy |
|---|---|---|---|---|
| Kittredge's Almanack for the Year | 0.06 | 0.2 | moon phases, weather forecast (seeded error), Sabbaths | "Moon, tides, and weather for the year, plus the remedy for warts." |
| Pocket Bible | 0.50 | 0.5 | read, blessed (if owner devout), social | "The Word in small type. A comfort, and a credential at a stranger's door." |
| Rusk's *Domestic Medicine* | 3.00 | 3 | Medicine +2 (reference), true-effect lookup | "Every family's physician between the doctor's visits." |
| *Emigrant's Guide to the Upper Mississippi* | 0.75 | 0.5 | region knowledge (some wrong) | "Roads, ferries, landings, and which springs are sweet. Some of it was true once." |
| County map, lithographed | 0.50 | — | region-map reveal (surveyed areas only) | "As surveyed. The coulees not surveyed are left blank, and blank is accurate." |
| Bank Note Detector (monthly) | 0.25 | 0.2 | Bargain (appraise currency) (§8.6) | "Lists every bank, its discount, and the counterfeits now circulating. This month's." |
| Herbal & botany manual | 1.50 | 1 | Lore (Nature) +2 (forage) | "Which root will feed you and which will stop your heart." |
| Blank journal & pencils | 0.30 | 0.5 | write, **personal Chronicle** | "For cache locations, debts owed, and the names you must not forget." |
| *The Long-Hidden Friend* (charm book) | 0.35 | 0.2 | folk-magic recipes (Under the Counter) | "Charms against fire, theft, wounds, and the evil eye, from the old German." |
| Spellbook, blank, vellum, 100 pp | 8.00 | 3 | spellbook (per `02`), F (wet!) | "Calf vellum, oilcloth-wrapped. What you write in it is your affair." |
| Grimoire, used (contents unknown) | 15–60 | 2–5 | spells?, curses?, provenance (Under the Counter) | "From an estate. The previous owner will not be needing it." |
| Scribing ink & quills, set | 2.00 | 0.3 | scribe spells (cost/time per `02`) | "Oak-gall ink. Ground powders sold separately and quietly." |

**[PROPOSAL]** The journal is a real item: it *stores* the character's notes on caches, debts, and names. Lose it and the map markers for unnoted caches decay faster. Fae who steal it learn your secrets.

### 6.14 Animals, Tack & Boats

| Item | $ | lb | Tags | Catalog copy |
|---|---|---|---|---|
| Saddle horse, sound | 80 (50–150) | — | actor, mount | "Sound of wind and limb, so the seller swears." |
| Canadian horse, hardy | 65 | — | actor, mount/pack, winter-hardy | "Small, ugly, tireless. Eats bark if it must." |
| Draft horse | 120 | — | actor, haul | "For the plow and the wagon, not the trail." |
| Mule | 90 | — | actor, pack 225, sure-footed | "More sense than a horse and more opinions." |
| Oxen, yoke of two | 70 | — | actor ×2, haul, grazers | "Slow as Sunday and twice as reliable." |
| Hound | 5 | — | actor, track, alarm | "Good nose, bad manners." |
| Milk goat | 3 | — | actor, milk | "A quart a day and a hatred of fences." |
| Riding saddle | 15.00 | 25 | tack | "Hand-stitched; the tree fits most horses." |
| Pack saddle, sawbuck | 5.00 | 20 | tack, enables pack | "Two crossbucks and the patience to load them even." |
| Bridle & bit | 2.00 | 2 | tack | "Snaffle bit, plain headstall." |
| Horse blanket | 1.50 | 4 | ins 10°F (animal), wool | "A cold horse is a lame horse by morning." |
| Oats, bushel | 0.35 | 32 | fodder: ~4 working horse-days at 8 lb, ~5 at rest | "Your horse will thank you. Your mule will expect it." |
| Hay, bale (~60 lb) | 0.15 | 60 | fodder: ~4 horse-days; Bulk 40, so it rides in a wagon or stays in the barn | "Cut on the river bottoms in July. Your horse has opinions about the slough hay."|
| Handcart | 6.00 | 60 | container 250 (roads) | "As pulled across the plains by the faithful." |
| Skiff, flat-bottom, 14 ft | 8.00 | 120 | boat, river | "Rows on the sloughs, poles up the creeks." |
| Bark canoe, 16 ft (trade) | 15.00 | 60 | boat, portage | "Two men can carry it, and it will carry them both and a winter's furs." |

### 6.15 Services

| Service | $ | Notes |
|---|---|---|
| Bed (shared), one night | 0.25 | With strangers. Rumors travel here (`04`). |
| Private room, one night | 0.75 | Lock, washstand. |
| Board, one day (3 meals) | 1.00 | At the hotel or a widow's. |
| Meal at an ordinary | 0.25 | |
| Hot bath | 0.25 | Cures "Filthy" condition; social Opinion +. |
| Laundry, per piece | 0.05 | Dries your kit too. |
| Stabling + hay, one night | 0.35 | |
| Guide, per day (plus found) | 2.50 | The guide is an actor with skills, opinions, and fears of certain hollows. |
| Hired hand / porter, per day | 1.00 | Reference wage. |
| Letter postage (prepaid, <3000 mi) | 0.03 | Letters move via the post as T2 objects; replies arrive weeks later. |
| Letter written by a scribe | 0.10 | For the illiterate. The scribe now knows your business. |
| Ferry: person / horse & rider / wagon | 0.10 / 0.25 / 0.75 | The ferryman is a famous rumor hub. |
| Steamboat, deck passage, ~200 mi | 3.00 | Cabin passage $10. Season April–November only. |
| Blacksmith: shoe a horse | 0.75 | Adds IP to the horse. |
| Blacksmith/gunsmith repair | 0.25–3.00 | By condition restored (§5.3). |
| Doctor's visit | 1.00–2.00 | Doctor's Medicine skill varies a lot. |
| Tooth pulled | 0.50 | |
| Blessing of an item | donation 0.25+ | Clergy actor must agree; may ask why. |
| Assay of ore | 1.00 | Galena or something else? |
| Note-shaving (exchange bank notes for specie) | 2–40% discount | §8.6 |
| Board, one day, as a household's guest | 0.50 or labor | You eat from *their* pantry (§3.9) at their ration. In a hungry April, a guest is a cost they'll remember (`04` Obligation). |
| Bread baked from your flour | 0.02 per loaf | A town baker or a farm wife turns your flour into bread (Fresh 5, shelf 5 d) so you don't need an oven on the trail. |
| Butchering, salting & packing a hog | 0.50, or a share of the meat | At hog-killing (Nov–Dec). Brine keg and salt extra (§3.7.7). |
| Smoking in a neighbor's smokehouse | 1 lb in 10 | Hams and bacon; two weeks. |
| Ice, delivered to your ice house | 0.50 per ton | Cut on the slough in January. Only the hotel, the doctor and the rich bother. |
| Root cellar, dug and stoned (a crew, ~6 days) | 12.00 | Gives a household cellar storage (§3.9). A crew with **cellar-craft** (`12` §8.6: the goblin pares at the Diggings are known for it) charges ~$18, and their cellars spoil at 60% of the normal rate. Priced by skill, not by people. |

### 6.16 Peoples and cultures in the Book

**[PROPOSAL]** `12` §1's ground rule applies to goods: **foodways and material culture belong to cultures, not peoples.** A Norwegian human and a Norwegian elf buy the same flatbrød. Nothing in the Book is priced, gated or labeled by people, and no people is a merchant "type" (`12` §8.1). These rows exist because `12` proposed them; they're ordinary items anyone can buy.

| Item | Section | From (`12`) | Why it's in the sim |
|---|---|---|---|
| Hearth-loaf | §6.4b | Hall culture (§5.5) | Elves' forage taboo (food from Fae intensity ≥ 2 must be hallowed with salt and grace) makes Hall-raised elves carry more stores; the loaf is their bread ward, good for its 3-week shelf life. |
| Hand-bell, bronze | §6.12 | Hall culture (§5.5) | A no-iron ward and a signal. Bronze, so it's iron-neutral. |
| Flatbrød, klippfisk, sauerkraut | §6.4b | Norwegian and German foodways (§9) | Light trail bread, a keeping fish that costs a day of soaking, and the county's main anti-scurvy food. |
| Pasty | §6.4b note below | Cornish foodways, shared by goblin pares (§8.6) | A day's dinner in a pastry case. |
| Crib tin | §6.4c | Mining culture (§8.6) | Packaging that keeps a pasty whole and warm for a shift underground. |
| Cave mushrooms | §6.4d | Goblin Club cellars (§8.6) | Winter fresh food; a reason the Club pantry matters in a scurvy spring. |
| Candles, tallow | §6.3 | Mining practice (§8.6) | Goblins' darkvision saves lamp oil, but a flame is still the bad-air test. |
| Gloves, horn spoons, wooden- and brass-fitted tools | §6.5, §6.4a | Faekin habit gear (§7.3) | Ordinary goods that break iron *contact* (§3.3). Each is a weak tell (strength 5) to someone who knows to look; to everyone else they're just gloves. The Book never labels them. |
| Small sizes (clothing, boots, packs) | all | Goblin body (§8.5) | Bespoke at most Outfitters: same price, a week's lead time, except at the Diggings, where they're stock. Never a surcharge. |

**Pasty (each).** $0.06 · 1 lb · Bulk 1 · 1,200 kcal · P/F 35/60 · Fresh 15 · shelf 3 d (warm ×2) · raw ✓ (+2 warm, 0 cold) · *"Beef, potato and turnip in a crimped crust, with the initial pricked in the corner so the knockers know whose crust it is."* (Copy note: leaving the last corner for the knockers is a Cornish miners' custom, `01` bestiary #8; it's a culture's courtesy, not a goblin trait.)

**Rations and size.** Goblins' 70% `kcal_pct` and ¾ carrying capacity (`12` §8.5–8.6) need no item rules: the planner multiplies the burn and `02`'s C(STR) shrinks the load bands. Readiness shows both sides of the tradeoff.

**Catalog size.** That's ~250 entries counting variants and the new provisions, packaging and found-food rows, well over the 80–150 target. **[PROPOSAL]** Ship the vertical slice (`07`) with ~90: Packs, Shelter, Fire, Cookery, **a dozen core provisions with full P8 fields** (flour, cornmeal, hardtack, salt pork, pemmican, beans, dried apples, potatoes, coffee, sugar, salt, whiskey), three packaging items, Tools, Clothing core, a quarter of Arms, Folk-Magic. Grow from there.

---

## 7. Starting budgets and kits

### 7.1 Scale

What $1 means: a day's labor, four nights in a shared bed, eight pounds of bacon, two and a half pounds of powder, two-thirds of a felling axe. A $50 purse is two months' wages. A good rifle is half of it. A horse is beyond it. **That's the point.** The `00` example ("$50 between a better bedroll, a second canteen, and a hatchet") is the intended texture: a mid-tier start can buy most of a kit but not everything, and the big-ticket choices (rifle, animal) define the character.

### 7.2 Starting purse by background

**Ownership (C31).** `09` recommends one Background table owned by `06`, with columns contributed by `03` (purse, money form, possessions, heirloom) and `02` (upbringing feats, skills). **[PROPOSAL]** This section is `03`'s columns for that table. The rows below are `03`'s original list; where `06` §7.2 has a matching background, its name is in brackets, and `06` decides the final roster.

Classes are defined in `02`, so **[PROPOSAL]** starting money keys mainly off **background** (what you did before), with small class adjustments. Each background also comes with **one heirloom item** (§10.3), the clothes you're wearing, and **two days' food in the pocket** (bread and cheese, or the background's own: a miner's pasty, a soldier's hardtack). Peoples never change the purse (`12` §1): no people is richer or poorer by type.

| Background | Base purse | Form of money | Starting possessions (free) |
|---|---|---|---|
| Farmhand / hired man [farm daughter] | $25 | Mostly local notes | Work clothes, brogans, clasp knife |
| Lead miner [Cornish miner] | $35 | Company scrip $15 (Hardscrabble Mining Co.) + $20 notes | Miner's pick, sticking tommy, candles |
| Raftsman / riverman [river pilot] | $40 | Mixed specie & notes | Slicker, pole-hook, knowledge of 3 ferries |
| Discharged soldier | $30 | Specie (back pay) | Surplus musket, knapsack, canteen |
| Itinerant preacher [failed seminarian] | $20 | Coins | Bible, hymnal; hospitality Opinion + in Hearths |
| Peddler | $30 | Mixed | Peddler's pack with ~$40 trade stock (shoddy) |
| Schoolteacher / clerk [Yankee clerk] | $55 | Good notes | Books (2), pocket watch |
| Widow(er), homestead sold | $90 | Notes of mixed quality | Good clothes, a horse *or* a grievance (pick one) |
| Remittance man (a family's disappointment) | $150 | Eastern drafts (must be cashed at a bank) | Fine clothes, Notoriety as "rich greenhorn" |

**Class adjustments (placeholder):** arcane casters start with a blank spellbook + starting spells (equivalent to ~$25 of value) and −$15 purse. Divine casters get a holy symbol and a blessing service free. Martial classes get +$10 or one weapon at Good quality. **[OPEN]** Rolled variance (+2d10, like 3.5e) or fixed? I recommend rolling, with a visible average, because the roll gives each run a different budget and a different identity.

**Credit at start:** the Outfitter may extend a tab or a **grubstake** (§8.5) to a character she trusts or wants to bet on. That's how a poor character buys the rifle, and it's also how the story starts with a debt.

### 7.3 Prebuilt kits

For players who don't want to shop. Every kit can be edited after buying and always shows its total.

| Kit | Total | Wt | Contents (summary) | Who it's for |
|---|---|---|---|---|
| **Greenhorn's Outfit** | $22.08 | ~65 lb | Knapsack; 3-pt blanket; gum blanket; hatchet; butcher knife; canteen; cup; frying pan; nesting kettles; 2 boxes lucifers + match safe; 10 days rations (hardtack, bacon, coffee, sugar, salt); 2 pr socks; single fowler, 1 lb powder, 5 lb shot, caps, horn; 50 ft hemp rope | A safe, heavy, generic start. The proprietor *will* mention the weight. |
| **Trapline** | $36.10 | ~60 lb | Pack basket; 4-pt blanket; squirrel rifle, powder, 5 lb lead, mould, caps, horn; 6 No. 1 + 2 No. 3 traps; hatchet; butcher & fleshing knives; brass snare wire; kettle, cup; flint & steel; 2 weeks pemmican/hardtack; mackinaw; moccasins | Fall/winter fur income; slow, practical, money-making. |
| **Parson's Satchel** | $14.43 | ~30 lb | Haversack; pocket Bible; holy water; *Domestic Medicine*; 3 bandages; laudanum; whiskey; 3-pt blanket; gum blanket; cup; canteen; lucifers & safe; candles; 5 days rations; 5 lb salt; iron nails; rowan cross; journal; clasp knife | Healer/social start; keeps cash for room and board in Hearths. |
| **Light Foot** (iron-light) | $20.80 | ~30 lb | Ash basket; 3-pt blanket; gum blanket; capote (reversible); moccasins; wool shirt; hunting bow, 2 doz arrows (1 horn-tipped); gunflint scraper; brass snare wire; gourd canteen; burning glass; lucifers; tinder; 5 lb pemmican; salt; rowan & red thread; hag stone; brass bell. **IP ≈ 0.** | Fae work: finding rings and markets, bargaining. Weak against wolves and men. |
| **Winter Overland** | $154.60 | mule-borne | Mule + sawbuck + 4 bu oats; buffalo robe; 4-pt blanket; snowshoes; mackinaw; fur cap; mittens; red flannels; 3 pr socks; tall boots; Dutch oven; kettles; felling axe; bucksaw; oiled fly; 30 days rations; double shotgun, 2 lb powder, shot, caps | Rich backgrounds only. Survives January, if the mule does. |

**[PROPOSAL] Kit provisions at a glance** (P8). The Readiness panel shows this for any kit; these are the numbers it would show at the counter on 1 April 1855. Burns from `05` §6.1: camp 2,400, trail 3,600, winter trail ×1.2.

| Kit | Food | kcal | Days (camp / trail) | Fresh | Fire needed? | Scarcest consumable | What the proprietor should say |
|---|---|---|---|---|---|---|---|
| Greenhorn's Outfit | 10 Army rations (~20 lb) | ~44,600 | 18 / 12 | 0 | for pork and coffee; hardtack eats raw | shot: 64 loads (caps 100, powder ~93) | "That's twelve days, not ten, if you walk. Buy two pounds of dried apples." |
| Trapline | 7 lb pemmican, 8 lb hardtack | ~33,500 | 14 / 9 | ~2 | no | caps: 100 shots (powder 200, lead 500+) | "Two weeks at camp. Hauling traps, nine days." |
| Parson's Satchel | 5 Army rations | ~22,300 | 9 / 6 | 0 | for pork and coffee | candles: ~42 h | "You'll eat at other people's tables. Mind what that costs them in April." |
| Light Foot | 5 lb pemmican | ~14,500 | 6 / 4 | ~5 | **never** | food itself | "Four days, then you're foraging. In April that's ramps and not much else." |
| Winter Overland | 30 Army rations; 4 bu oats | ~133,800 | — / 31 at winter trail | 0 | yes (Dutch oven) | **oats: 16 mule-days** at 8 lb | "Your provisions last a month. Your mule's last two weeks." |

---

## 8. Economy

### 8.1 How a price is made

**[PROPOSAL]** Every item has a **base value** (cents) at a notional river-town reference. The price a given merchant asks is computed, and **the computation is shown** (P1) in a hover ledger:

```
Ask = Base
    × Quality × Condition
    × Remoteness   (freight: +5–10% per day's wagon haul from the river landing)
    × Scarcity     (local stock vs. demand, from settlement T2 state)
    × Season       (river frozen Dec–Mar: imported goods ↑; pelts ↓ in summer)
    × Merchant     (Sheet/Mind: greed trait, cash need, stock he's stuck with)
    × Opinion      (merchant's opinion of buyer: ±25%)
    ÷ Currency     (what you're paying with: specie 1.0, good notes 0.95, wildcat 0.6, scrip 0.8…)
```

Example: a felling axe at a hamlet two days up a coulee in February, from a merchant who dislikes you, paid in Bank of Kickapoo Valley notes: 1.50 × 1.15 × 1.3 × 1.1 × 1.15 ÷ 0.6 ≈ **$4.73**. The player can read every line.

**[DECISION]** (ADR invariant 2) **Integer form.** Every factor is an integer percent. The ledger multiplies `base_cents` by each factor in the order shown, keeping an exact rational (numerator and denominator as integers, all well below 2⁵³), and rounds **once**, half-up, to the cent at the end. Each ledger line shows its own factor and the running price for reading, but the stored price comes only from the final rounding, so the order of display can't change the result. The example is 150 × 115 × 130 × 110 × 115 × 100 / (100⁵ × 60) = 472.8 → 473¢.

### 8.2 Supply and demand per settlement

**[PROPOSAL]** (co-owned with `05`)
- **T2:** each settlement tracks **stock by commodity class** (~25 classes: flour, salt meat, powder, lead, tools, cloth, ironmongery, liquor, medicine, pelts, ore, livestock…), **demand** (population × needs × season), and **cash on hand** (specie and notes separately). **[PROPOSAL]** Each commodity class maps to **representative item defs with shares** ("salt meat" = 80% salt pork, 15% dried beef, 5% salt cod), so promotion turns a T2 number into real stacks with lots and spoilage. Settlement stock is the aggregate of household pantries (§3.9), institutional stores and store shelves; `05` owns the quantities and `03` the prices.
- **Inflows:** steamboat landings (seasonal), wagon freight, local production (NPC crafter Activities, farms, mines, trapping), peddlers (actors who walk the region map carrying stock).
- **Outflows:** consumption, export (pelts, lead, wheat downriver), spoilage, theft, fire.
- **Prices drift** toward scarcity-adjusted equilibrium daily, in integer percents. Shocks propagate. The river freezing, a mine strike, a wildcat bank failing, a fae blight on the wheat, or **the player buying all the powder in town** all move prices. (Someone will notice that last one, and rumors follow.)
- **The food year (P8).** Flour, salt pork and coffee are dearest in March, when the river's been shut since December and pantries are thin; the first steamboat after ice-out (April) drops them sharply. Potatoes and eggs are cheap in autumn and scarce in spring. Fresh meat is cheap at hog-killing. The game opens on 1 April 1855, on the high side of that curve: the Book's marginalia say prices are about to fall, and a patient player can wait two weeks for the boat.
- **T0 promotion:** when the player enters a store, its shelf inventory is instantiated from settlement stock + that merchant's share + their specialties, consistent with what T2 said (`07` consistency requirement).

### 8.3 Merchants as actors

**[DECISION]** (P2) Merchants are ordinary actors with Sheets and Minds. Their Bargain skill (and Trade, for goods they make) sets how well they price. Their psyche (`10`) shapes their marginalia, remarks, and haggling: the `greed` drive's weight, norms like `honesty`, `thrift` and `piety`, and a gossip's traits. The "Merchant" factor in §8.1 reads them through `10`'s derived views, never through a separate personality block. Their **needs** matter: a merchant with a note due at the bank in a week sells cheap for specie. Their **memories** of you (haggled hard, paid promptly, paid with fae gold) feed their **Opinion**. The Outfitter isn't a menu; she's Gussie Pratt (`01` §8.3), and she remembers.

### 8.4 Haggling

**[PROPOSAL]** A short exchange, not a minigame:
1. **Bargain to appraise** (yours vs. his) reveals the base value with an error band. A low roll may convince you a shoddy rifle is Good.
2. **Offer/counter**, up to three rounds. Each round the player picks a *tack*:
   - **Reason** (Persuade vs. his Read People/Will): moves price toward base.
   - **Bluff** ("Haugen's sells it for a dollar"): bigger move if it works; if caught, Opinion falls and a memory forms.
   - **Intimidate**: works on some merchants, and becomes a grudge and a rumor.
   - **Sweeten**: pay part in specie, take a shopworn item, buy in bulk, bring news (information is currency in `04`).
3. The merchant's **walk-away floor** = his cost basis × his need state × Opinion. He won't sell below it, and the floor is shown once you've seen through him (Read People).
4. **Outcome writes memories** for both. Repeatedly squeezing a merchant raises your prices with him later and spreads "skinflint" to his friends.

### 8.5 Credit, tabs, grubstakes, debt

- **Tab:** the merchant writes you into his daybook. Limit = f(Opinion, Notoriety, collateral, his cash position). Interest is customary (~1% per month on frontier store credit, more for strangers). The **daybook is an object in the world**. Burn it and the debts are forgotten (and so is everything else he was owed, by everyone).
- **Grubstake** **[PROPOSAL]**: the Outfitter (or any wealthy actor) outfits you in exchange for a **share of what you find**, typically 25–50%, recorded as a contract. It was real practice in mining country. It gives adventurer mode its first goal ("pay back Pratt"), creates an NPC with a stake in your survival who may send someone after you if you vanish, and turns loot into a social question.
- **Default:** creditors run the ordinary social sim. Grudges, rumors ("doesn't pay"), refused credit across the county as rumors spread, a constable, a court day (debt is a mundane civil matter, so it fits `01`'s no-witchcraft-statute law, C13), or a hired man with a club. Debts outlive you and fall on heirs in legacy mode (`06`), through `04`'s inherited Obligation.
- **Persecution reaches the counter.** `04` §9 owns the persecution ladder (rungs 0–6) for any person or Figure (C41). Merchants read it like anyone: from rung 3 (Shunning) a merchant who holds the belief pulls credit, refuses service or asks a premium (the Opinion factor in §8.1 can go below its usual −25% floor). `06`'s witch labels (Whispered, Suspected, Known, Hunted) are names for those same rungs, not a separate price rule. A revealed shadow-faekin enters at rung 1 (`12` §7.6), so their tab survives unless things escalate.

### 8.6 Money itself: specie, notes, scrip, and wildcats

**[PROPOSAL]** Money is plural and suspect, as it really was:

| Money | Notes |
|---|---|
| **Specie** (gold & silver coin) | Accepted everywhere at par or a premium. Scarce. Heavy-ish: 1,000 silver dollars ≈ 59 lb. Fae accept silver as *metal*. |
| **Foreign silver** | Spanish/Mexican reales ("bits": two bits = 25¢) still circulate. Legal-tender status ends in February 1857, a scheduled in-world event now that the start is pinned to spring 1855: merchants start discounting bits in the months before. |
| **Bank notes, good** | Notes of solid banks (Milwaukee, Chicago, eastern) trade near par: 0.95–1.0. |
| **Wildcat notes** | Under Wisconsin's free-banking law (1852), small banks issued notes backed by deposited state bonds, often from offices deliberately placed in hard-to-reach places so notes couldn't be redeemed. Trade at 0.4–0.85. **Banks can fail** (a T2 event), and their notes fall to near zero overnight. The 1861 collapse of Southern-bond-backed banks and the Milwaukee bank riot are a model for a world event. |
| **Counterfeits** | Circulate with real notes. Detected via Bargain (appraise) + the current **Bank Note Detector** (§6.13). Passing one knowingly is a crime and a rumor. |
| **Company scrip** | Hardscrabble Mining Co. pays miners in scrip good at its store at par, elsewhere at 0.5–0.8. |
| **Shinplasters** | Small private notes from merchants or towns; good only locally. |
| **Drafts** | Bills of exchange; must be cashed at a bank or by a trusting merchant. |
| **Barter** | Pelts, lead, ginseng, whiskey, labor. Valued by each actor's own needs. A farm wife in February values a needle and salt more than a wildcat dollar. |

The purse UI splits money by type and shows effective value **at this merchant.** A player who goes deep into the wilds with $40 in Bank of Kickapoo Valley notes may come back to find the bank has failed while they were gone. That's P3 working on the player's own pocketbook.

**[PROPOSAL] Fae-touched banks:** one or two wildcat banks in the coulees are fronts, or simply are fae: their notes redeem in something, just not money. A redemption journey is a natural adventure hook.

### 8.7 The fae economy

**[PROPOSAL]** The Fair Folk don't use money; they use **exchange with meaning**. Fae actors (Sheets and Minds, P2) value things by specificity, uniqueness, and what the giving costs the giver. That makes the fae economy a mirror of the provenance system (§10): **a mass-made tin cup is worthless; your mother's tin cup is treasure.**

| Fae value | What it costs you in the sim | Typical return |
|---|---|---|
| **Names** (true or given) | Fae gains a hold: commands, location sense, Will penalty vs. that Court | Major boons, passage, a name for a name |
| **Memories** | A specific Memory record is deleted from your Mind (`04`). NPCs who shared it notice you don't remember | Knowledge, a secret, a path through |
| **Years** | Age advances (Sheet effects, age categories per `02`) | Healing, youth for another, power |
| **Senses / faculties** | Lose color vision, the hearing in one ear, the taste of salt, your shadow (social Opinion hits), warmth (permanent cold vulnerability) | Fae sight, a familiar, magic |
| **Sleep / dreams** | Fatigue recovery reduced (`05`); the bargain opens a dream channel (`10` owns dreams, Faerie's way into the mind) | Prophecy, nightly visits |
| **Firstborn / future claims** | A **lien on an actor not yet born**, tracked by the sim. When the child is born (yours, or the claim is badly worded: *any* firstborn in the household), the fae come to collect | The greatest boons |
| **Service / labor** | A geas: a task with a deadline and a condition | Favor, Court standing |
| **Hospitality** | Milk, bread, a place by the fire, a song. Small and repeatable | Goodwill, lesser fae help (and pests leave) |
| **Storied objects** | An item with rich provenance. Value = Chronicle weight of the item (§10) | Anything, if the story is good enough |
| **Silver** | As metal, not money | Small trades |

What fae **disdain**: paper money (amusing at best), iron (an insult), mass-made goods, lies (they bargain literally and remember exactly; `10`: fae can't speak insincerely, but they can be wrong).

**Not a currency (C45).** This table is about *gifts with meaning*, not money. The Courts' fungible power is **Woe** (`06`), and Fae intensity stays the spatial field. A bargain can move Woe, standing or Drift as a side effect; the price in the table is what *you* lose.

**Fae food** is the fae economy's commonest gift and its cheapest trap: a feast that costs nothing to accept. Its item fields are in §6.4d (`fae_food`); what it does to you is `02`'s Bound chain, `06`'s Drift and `05`'s nutrition penalty (C26).

**Bargains are contracts with literal enforcement.** The wording is stored. Breaking terms triggers metaphysical consequences (curses, conditions, a Court's hunt), not reputational ones. **Fae goods** may be **glamoured**: fae gold is leaves with a duration-limited glamour. Pay a merchant with it and when it turns at dawn, his Opinion becomes a grudge and a rumor ("paid in leaves — witch-touched"). Ordinary systems chain into a story with no scripting.

### 8.8 How the witch gets goods

**[PROPOSAL]** (coordinate with `06`) The witch can't walk into the Outfitter, or she can only in disguise and at risk. Her catalog is *the world*. Her access channels:

| Channel | How it works | Costs/risks |
|---|---|---|
| **Foraging** | Herbs, roots, game, nuts, ginseng; reeds and bark for cordage; clay | Seasonal; Woodcraft/Herbalism skill; time |
| **Crafting** | Snares, bows, hide clothing, charms, poppets, potions, and her own preserving (§3.7.7: drying, smoking, a kraut crock in the hut cellar) | Time, skill; iron work gets harder as her Drift rises (`06` owns the weakness; §3.3 supplies IP and contact) |
| **Theft** | From farms, clotheslines, springhouses, caches, peddlers | Each theft is an event: memories, rumors, hunters (`04`) |
| **Curse-extorted offerings** | "Leave a ham at the crossroads by Friday or your cows go dry." Villagers who believe pay. The Curse economy lives in `06` | Raises Notoriety and Heat on `04`'s ladder; offerings can be traps (iron, poison, an ambush). Every ham comes out of a real pantry (§3.9), and that household's April remembers it. |
| **Hedge-trade with outcasts** | The drunk ferryman, a hermit trapper, a runaway, a peddler who doesn't ask questions, other cast-outs | Small markets, bad prices, betrayal risk (they're actors with their own needs: reward money) |
| **Fae gifts** | The Prince and lesser fae give things | Strings: obligations, glamours, souring near iron |
| **Proxy purchase** | A child, a sympathizer, a bewitched man buys for her | The proxy's memory and loyalty are the weak point |
| **Grave goods and the dead** | Hunters who die in the woods have kits | Morally loaded; corpses carry provenance |

Her Readiness panel is the same feature with a different shelf. Her catalog fantasy is the forager's guide and the herbal: browsing the woods themselves for what they could become. Her **hut cellar** is a household pantry like any other (§3.9, `06` §3.10), and her provisions planner runs on the same functions. Winter in exile is P8 at its sharpest: no store, no credit, a cold camp whenever smoke would give her away (§3.7.5).

---

## 9. Loot and treasure in a simulated world

**[DECISION]** (P1) Nothing appears from a loot table that the world can't explain. Every item in a site has a **provenance generator**: who put it here, when, and why. Monsters don't carry gold because animals don't carry anything. A wolf den holds bones and maybe the belt of the trapper it ate.

**[PROPOSAL]** World generation (`05`) runs a **history pass** that seeds the region with deposits, each with a story:

| Site | What's there and why |
|---|---|
| **Old lead diggings / "badger holes"** | Miners lived in hillside holes (the origin of Wisconsin's "Badger" nickname). Abandoned picks, a tin of candles, a cache of galena someone meant to come back for, a skeleton under a collapse with his mining-claim papers |
| **Caves & sinkholes** | Things that fell in (livestock, people, a peddler's cart), outlaw or counterfeiter caches (plates, paper, ink, bad notes), saltpeter workings, fae doors, previous adventurers' kits with their journals |
| **Wrecked keelboat / steamboat snag** | Cargo: casks of whiskey, barrels of salt pork (spoiled), bolts of cloth, a strongbox |
| **Abandoned claim shanty** | Whatever a failed homesteader couldn't carry: a Dutch oven, a family Bible with names, seed corn, a debt notice |
| **Fae barrow / ring / market** | Fae goods: glamoured, storied, dangerous; things fae took from humans (a christening cup, a child's shoe, a name written on a paper) |
| **Monster lairs** | Remains of victims with their gear (provenance → the victim's family *wants* it back, which is a social hook); "magpie" creatures with hoarding traits that collect bright things |
| **Effigy mounds** | **[OPEN — sensitive]** The real Driftless contains Indigenous effigy mounds, which are sacred burial sites. I strongly recommend they are **not** loot sites. Disturbing them should be a grave transgression with consequences, and how (or whether) they appear should be decided in `01` with care and, ideally, consultation. The same goes for **Native artifacts** generally (C10): no plowed-up points, blades or pottery as loot, curse components or no-iron goods (§6.12). `11` §7.7 keeps them off the map and out of the plates. Fae barrows are always explicitly fae and fictional, never a mound type (`05` M4). |

**Rewards that feel D&D-like but are plausible:**
- **Bounties:** wolf bounties (counties paid them historically: ~$5 a scalp), outlaw rewards, "return the missing child" rewards posted by actors.
- **Salvage and resale:** a cave's contents become merchant stock.
- **Raw value:** galena (lead ore, assay it), pelts (muskrat ~$0.15, mink ~$1.50, otter ~$4, wolf pelt + bounty), and **ginseng**. Wild "sang" was a real cash crop dug from Driftless woods. ~$1–2/lb dried, it's the frontier's treasure-hunting, and it's protected by fae in some hollows.
- **Specimens:** naturalists and eastern collectors pay for fae curiosities, strange skulls, and pressed flowers that shouldn't exist.
- **Knowledge items:** maps, grimoires, the journal of the last person who came here.
- **Favor:** fae boons, Court standing, an NPC's lifelong gratitude (an Opinion, `04`).
- **Magic items:** rare, storied, mostly fae-made or old-country heirlooms. **[PROPOSAL]** No "+1 swords" in shops. Magic items are things with *history* (§10), and their power can grow from their story.

---

## 10. How gear makes stories

### 10.1 Provenance logs

**[PROPOSAL]** Every item above a value threshold or flagged as **notable** keeps a **provenance log**: maker, place and date of manufacture, each owner, and **notable events** detected by Chronicle hooks (`05`, `07`):
- *Saved a life:* the canteen was the only water during the three-day lost-in-the-coulees event.
- *Took a life:* this rifle killed the white stag / the man from Raft Island Slough.
- *Survived disaster:* the match safe kept the only dry matches after the drowning.
- *Was lost and found:* the pack floated downstream and a farmer's boy found it.
- *Was given:* gifts, inheritances, fae bargains.

Items cross from ordinary to **notable** once they have enough logged events. Notable items get **names** from the Chronicle generator ("the Drowning Tin," "Pratt's Grubstake Rifle," "Old Fourteen-Day Blanket") and a short story blurb on the item card in the same catalog voice: *"Carried down the Kickapoo in the flood of '56. Kept the matches dry."*

### 10.2 Minds attach to things

**[PROPOSAL]** (with `04`) Actors form **attachments** to items: a mood buff when carrying an heirloom, grief when it's lost, an Opinion of whoever stole it. NPCs **recognize items**: *"That's my brother's rifle. Where did you get it?"* A rifle taken from a dead man in the woods turns into a murder accusation in town. No script, just item provenance + NPC memory + rumor.

### 10.3 Heirlooms and legacy

- Every background starts with one **heirloom**: an item with a short pregenerated provenance (grandfather's knife from the old country, a mother's sewing kit, a discharged soldier's musket). Fae value it. Pawnbrokers too.
- In legacy mode (`00` P5), notable items **persist in the changed world**. Your next character might find your last one's rifle on a merchant's wall at the Outfitter, priced at $40 because "it has a history," with the Book's marginalia telling the story secondhand, slightly wrong.

### 10.4 Chronicle lines (examples)

> *14 Oct 1855. Bought at Pratt's: one Hollister felling axe, $1.50, on credit.*
> *2 Feb 1856. The Hollister's head flew off on frozen oak. Marta Haugen re-hafted it for a pair of socks' worth of silver and would take no more.*
> *9 Jun 1856. Traded the Hollister to a ferryman of the River for passage, because he wanted "an axe that had been forgiven."*

(The ferryman belongs to the River, which `01` §4.3 says is not a court; the Thorn is the Prince's. C16.)

---

## 11. Challenges to `00`

> **Resolved: era width.** `00` now pins the start to **spring 1855** (**[DECISION]**), which is what this challenge asked for. Kept for the reasoning. Originally: `00` gave the era as 1830s–1870s. For gear that's a forty-year span of rapid change: flintlock to percussion (1820s–40s), first practical revolvers (1836) to mass-produced ones (1850s), metallic cartridges (1860s), mail-order catalogs (1872), carbolic antisepsis (1867). A catalog needs **one reference year**, or the price list is incoherent. **Recommendation:** pin the Outfitter's Book to **~1855–56**. It keeps percussion rifles and revolvers rare and expensive, keeps flintlocks around as cheap surplus, sits inside the wildcat-banking boom before the Panic of 1857, and has steamboats at their peak on the upper river. Later decades can come in as world-time passing (a legacy run in 1868 finds cartridge rifles in the Book) instead of as an anachronistic blend.

> **Challenge to 00 (minor) — "catalog."** `00` invokes the outdoor-gear catalog and wishbook. The in-world artifact should be the proprietor's assembled **Book** of trade plates (§2.1), not a mail-order catalog, to keep the 1850s honest. The feeling is the same and the object is truer.

---

## 12. Open questions for Ellie

Numbering is kept stable because `08` cites these by number.

1. ~~**Reference year:** pin the Book to ~1855?~~ **Resolved** by `00`: spring 1855.
2. ~~**Witch and iron:** should the witch be mechanically iron-sensitive?~~ **Resolved** by the lead's ownership call (C27): `06` owns all weaknesses, keyed to Drift and the Pact; `03` supplies IP and contact as inputs (§3.3). Whether a *starting* witch already feels iron is now `06`'s question (her Origin's starting Drift).
3. **Cold iron:** do you like "cold-hammered, never quenched" as the definition, or would you rather go folklore-literal (all iron is cold iron) or meteoric/bog-iron only (rarer, more treasure-like)? (C28, still open.)
4. **Starting money:** rolled (3.5e-style variance) or fixed per background?
5. **Pack grid:** confirm no spatial Tetris inventory, or do you want it as an option? (`11` §2.7 also recommends no.)
6. **Readiness panel gated by skill:** does it feel right that a greenhorn's checklist is shorter and sometimes wrong? **Refined:** §2.4 now gates only *judgment* rows; P8 arithmetic rows (food-days, fuel, shots, fodder, spoils-first) are always shown and always correct, with a forecast range. Does that split work for you?
7. **Grubstake as the default adventurer opening:** should most adventurer starts begin in debt to the Outfitter?
8. **Fae prices:** how dark do bargains go by default? Firstborn liens and memory deletion are powerful story engines but heavy. Are there content toggles?
9. **Effigy mounds and Indigenous presence:** how does the setting handle real sacred sites and peoples of the region (Ho-Chunk and others)? This doc treats mounds and Native artifacts as *not lootable* and keeps found flint out of the Book (C10). Native-made trade goods (canoe, baskets, moccasins, pemmican) have three handling options in §6's intro, pending `01` Q1.
10. **Real-world remedies with true effects:** comfortable simulating that calomel poisons you and snakeroot does nothing, while showing period copy that claims otherwise?
11. **Magic items in shops:** agree there are none for sale (only storied items and folk wards), or do you want an Under-the-Counter tier of minor magic, PHB-style?
12. **Ginseng and wild-harvest economics:** is "sang digging" a welcome Driftless-specific money loop, maybe fae-guarded?
13. **Money weight:** do coins weigh something (1,000 silver dollars ≈ 59 lb)? I recommend yes, since it makes bank notes useful and gives treasure real logistics.

**New with this revision (P8 and peoples):**

14. **How hard should P8 bite by default?** Scurvy onset (~6 weeks at Fresh < 10, `05`'s call), spoilage speed, and monotony's mood weight could sit behind one **"Larder" difficulty dial** (forgiving / period / harsh) in `06` §8.1, the way the Prejudice dial works. I recommend *period* as the default, with forgiving for new players. Yes?
15. **Ration units in the Book.** The Book sells "N days' rations" as Army rations (~4,460 kcal), which last a hiker longer than N days. Keep the period unit and let the planner translate (my recommendation), or relabel everything in "days at your burn"?
16. **Hardtack as a bread ward.** Folk belief credits fresh bread; should hardtack and flatbrød count against being pixie-led? Counting them makes the ward nearly free for anyone with rations (§3.3).
17. **Cold camps.** Should a fireless camp make the actor measurably harder to find (no smoke or light for `05`'s perception and `06`'s hunters)? It's what makes pemmican worth twice the price, and it's central to witch-mode exile.
18. **Fuel as time, not weight.** Firewood is gathered, not carried, so the fire budget is gathering time and dry tinder. Is that enough crunch, or do you want carried fuel (charcoal, a spirit stove) to matter on the bluffs and in winter?
19. **Native-made goods in the starter Book** (§6 intro): (a) keep with neutral provenance, (b) mark "trade" with no maker, or (c) drop until `01` Q1 is settled? I'd pick (a).
20. **Small sizes for goblins** (§6.16): bespoke at the same price with a week's lead time, stock at the Diggings. Comfortable, or should small sizes simply be stock everywhere to avoid any friction that reads as exclusion?
21. **Cellar-craft as a paid service** (§6.15): `12` makes goblin-dug cellars spoil at 60%. Pricing it by skill keeps it from being a people perk; is it a niche you want at all, given `12`'s rule that goblins aren't merchants by type? (It's labor and skill, which `12` explicitly allows.)

---

## 13. Conflicts addressed (from `09`)

| ID | What this revision does |
|---|---|
| **C2** (pocket UI) | §2.6 sets what the Book, Kit Sheet, Readiness, Flat-Lay and haggling must keep on phones, and adds Buy by the day and shopping-time costs. Layout stays with `11` §2.6–2.8. **Resolved for `03`.** |
| **C6** (start date) | Book pinned to spring 1855 by `00`; §11 challenge marked resolved; foreign silver's 1857 end is a scheduled event; food-year prices open in April 1855. **Resolved for `03`.** |
| **C7** (names) | Viroqua and Black Earth Creek replaced with Hollin County places; "Father Doyle" removed from copy; Gussie Pratt as the Iron Ford proprietor. The Bank of Kickapoo Valley stays as an illustrative fictional wildcat bank named for the real river. **Resolved for `03`.** |
| **C10** (Native artifacts) | Knapped flint blade and flint/bone arrows removed and replaced with European-sourced no-iron goods; rule against Native artifacts as wards, loot or no-iron goods (§6.12, §9); options for Native-made trade goods (§6 intro). **Resolved for `03`**; the wider question stays with `01` Q1. |
| **C16** (court names) | The ferryman belongs to the River, not the Thorn (§10.4). **Resolved.** |
| **C21** (clock) | Reach and reload times are T0 durations on the sub-minute clock; integer game-minutes everywhere else. **Resolved for `03`.** |
| **C22** (encumbrance) | `03` owns bands and penalties with an integer anchor table; `02` owns C(STR) and size; `05` reads the bands (§4). **Resolved for `03`**; `02` §11 and `05` §1.4 need matching edits. |
| **C23** (insulation units) | All clothing and bedding in °F of comfort-band extension; wool wet retention 50% (§3.5, §6.1, §6.6). **Resolved.** |
| **C26** (fae food) | `fae_food` item flag with true kcal 0; effects deferred to `02`/`05`/`06` (§3.7.2, §6.4d, §8.7). **Item side resolved.** |
| **C27** (witch weaknesses) | No witch iron rule in `03`; IP and skin contact are inputs to `06`'s Drift-keyed triggers; peoples' offsets per `12` (§3.3). **Resolved for `03`.** |
| **C28** (cold iron) | Definition kept as a proposal, integrated into the integer IP formula. **Still open** (Q3). |
| **C29/C34** (protections, charm prices) | `06`'s protections (horseshoe, rowan, hex sign, iron nails, salt, witch bottle, Bible, bread and salt) are all ordinary §6.4b/§6.12/§6.13 items, priced $0.03–$1.50. Charm prices in `02` remain `02`'s fix. **No change needed here.** |
| **C31** (backgrounds) | §7.2 re-scoped as `03`'s columns in `06`'s table, with name mappings. **Resolved for `03`.** |
| **C35** + gap 2 (weapon stats) | Ammunition burn table added; missing combat and Defense stats flagged to `02` (§6.7). **Partly addressed.** |
| **C41** (persecution) | Merchant behavior reads `04`'s rungs; `06` labels are names for rungs (§8.5). **Resolved for `03`.** |
| **C45** (fae currency) | Fae exchange is gifts, not currency; Woe is `06`'s single currency (§8.7). **Resolved for `03`.** |
| **C48** (P8) | Food and consumable fields, spoilage, prep, preservation, rations planning, consumables, pantries, catalog columns (§3.7–3.9, §6.4). **Resolved for `03`.** |
| **C49** (determinism) | Integer spoilage accumulator with carry and a band lookup table (with an approximation note); integer IP; integer load anchors; integer price ledger with one rounding. `03` has no exp/log/pow/trig. **Resolved for `03`.** |
| `09` gap 19 (food) | Covered by §3.7–3.9. |

---

## 14. Implementation notes

Code read 2026-10-10 ~21:00: `packages/content/src/schema/items.ts`, `content/base/items/_seed_examples.toml`, `content/base/scenarios/iron_ford.toml` (pantries and stock), `packages/core/src/items/{state,api,view}.ts`, `packages/core/src/provisions/{state,api,view,system,temperature,events,commands}.ts`, and `content/base/needs/needs.toml`. **No code was edited.** The doc is the design target; these are notes for `module:provisions` and `module:content-items`.

**Aligned (and ratified by this doc, as `07` §3.6 asked):**
- `ItemSchema` and `FoodSchema` match §3.1 and §3.7.2 almost field for field: integer `weight_g`, `value_cents`, `kcal`, `protein_g`, `fat_g`, `fresh`, `group`, `servings`, `morale`, `shelf_life_days`, `spoilage.{temperature_pct, wet_pct, packaging_pct, spoils_to, vermin}`, `prep[]` with `fire_minutes`, `batch_servings`, `cookware` as affordances, `water_ml`, `kcal_pct`, `yields`, `check`; `supply` and `consumes`; `wearable.insulation` in °F with `wet_retention_pct`.
- `TEMP_BANDS` and their °F cut points match §3.7.4. Default band multipliers 5/50/100/170/300 match.
- `tinplate` counts as iron, which §3.3 relies on.
- Seed values match the catalog: hardtack, flour, salt pork, dried apples, trout, whiskey, firewood (60 fire-min), lucifers (100), lard oil (600 lamp-min) and the glass lantern (60/h).
- Pantries as `{ kind: 'household' }` stack locations are exactly §3.9's model. `Readiness` in `provisions/api.ts` has the arithmetic rows §2.4 needs (`daysOfFoodTenths`, `daysOfFuelTenths`, `spoilsFirst`, `unpreparable`).

**Divergences:**

| Code today | This doc | Suggested change |
|---|---|---|
| `ItemStack.spoilage` 0..1000 and the system comment's hourly step of `1000 / (shelf_life_days × 24)` | §3.7.4: per-mille **plus an integer carry** | Without a carry, hardtack (540 d) gains 0.077‰/h, which floors to 0, so it never spoils; anything over ~42 days' shelf life is affected at hourly steps. Add `spoilageCarry` to `ItemStack`, or step daily with a carry. |
| No `lot` on stacks | §3.1, `07` §3.6 | Add `lot` (acquired-at minute + source) so spoils-first and provenance work across purchases. |
| No `turning` stage | `spoilage.turning_pm` (default 750) | Add the field; emit a `provisions.turning` event (feeds `11`'s "will turn by morning" dispatch). |
| No `frozen_ruins` | §3.7.2 | Add the bool; potatoes and eggs need it. |
| No `fae_food`, `taboo_tags` | §3.7.2 | Add both (C26, `12` §5.5). |
| `HouseholdProvisions.storage` is one enum per household (`indoor` / `cellar` / `springhouse`) | §3.9: storage is per **container/structure**, and a household has several | Make storage kind a property of fixed container items (root cellar, springhouse, ice house, smokehouse, corncrib, cache), with `storageTempF` keyed by it; add `ice_house`, `cache_buried`, and `carried_body` (`max(air, 40)`). |
| `wetness` 0..100 | §3.5 now says 0–100 | Aligned (the doc changed). |
| `loadBand` is a stub returning `'Unburdened'` | §4.1 integer anchor table | Implement from `02`'s C(STR) and size (Small ×¾); no people-id branching. |
| `bulk` and `affordances` are `decimal1` floats | integer tenths (§3.1) | Convert at compile time (`07` §3.6 already notes this). |
| `priceAt` applies only `markupPct` | §8.1 full ledger, integer, one rounding | Fine for M1; M4 needs the ledger with Explain lines. |
| `coffee_green` has one `brew` method needing `cook + grind + boil` | §3.7.7: roast → grind → brew via `yields` (ground coffee keeps 7 d) | Either is fine for M1; the `yields` chain is what makes "ground coffee keeps a week" true. |
| `MATERIALS` has no `bronze` | Hall-cast hand-bell (§6.12) | Add `bronze` (iron-neutral). |
| `PROTECTIONS` has no `ground` | Gum blanket and bed tick block ground chill (§6.1) | Probably a `wearable`/bedding field rather than a protection; flag for `05` §6.3. |
| `supply` kinds documented as `powder (charges)` | §3.8 and §6.7: `powder_gr` in grains | Grains let one powder item feed guns with different charges. |
| `readinessOf` returns `warnings: string[]` | P1 and `11` §1.5 | Return keyed, Explain-backed warnings so they localize and expand to "show the math". |
| Readiness has no judgment rows or skill gate | §2.4 | Add situation rows gated by Woodcraft/Lore as a separate list; keep the arithmetic fields ungated. |
| People schema has no `kcal_pct`; faekin `cold_iron_sensitive` boolean | `12` §13 | `12` owns the fix; `03` reads `kcal_pct` in the planner and `weakness_drift_offset` only through `06`. |
| `needs.toml` hunger is an abstract `decay_per_hour` | P8, `05` §6.1 | Fine for M1; M4 switches to kcal burn (`07` and `11` already flag it). |
