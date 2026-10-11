# 05 — World Simulation & the Storyteller

**Status:** Draft for review. Revised 2026-10-10 (see the revision note).
**Owns:** the region map, site maps, LOD tier *policy* and how state moves between tiers, time/calendar/weather, ecology, **physiology (burn rates, the effects of hunger, thirst, cold, fatigue and nutrition, and spoilage physics)**, **household pantries and the lean-season economy**, settlements and factions as systems, **alert levels for non-person threats**, the Director, story sifting, the incident catalog, and the Chronicle.
**Does not own:** minds, memory, rumor, grudge, notoriety, and **the persecution ladder** (`04`); the psyche: drives, anxiety, defenses, Persona, Shadow, dreams (`10`); the peoples roster and prejudice data (`12`); injury, the condition vocabulary, and per-victim disease mechanics (`02`); **item stats, food and consumable item fields, and prices** (`03`); mode loops, the Curse economy, **Drift and witch weaknesses** (`06`); the event struct, determinism kit, saves, and budgets (`07`); and screens (`11`). Where this doc needs one of those, it defines the **hook**: the data that crosses the boundary.

Tags: **[DECISION]** follows from `00`, the ADRs, or Ellie. **[PROPOSAL]** is new and up for review. **[OPEN]** needs Ellie.

> **Revision 2026-10-10.** Brought into line with `00`, ADRs 0001–0003, Ellie's decisions of 2026-10-10, the lead's ownership calls, and the new/rewritten `07`, `10`, `11`, `12`. Nothing strong was cut; what changed:
>
> - **Stack and determinism (C1, C49).** Every `exp`/`log`/`pow`/trig formula is restated in integer, fixed-point, or lookup-table form with an approximation note (new §13). Fractions are stored as per-mille integers; needs are 0–1000 (ADR). Weather, ice, flood, ecology, spoilage, SEIR, the Director's EMAs and interest score all have integer forms.
> - **Clock and speed (C21).** Canonical time is integer game-minutes since 1855-04-01. T0 runs `07` §3.4's sub-minute clock (tenths of a game-second, event-driven). §3.3 and §4.1 now use `11` §1.6's speed ladder (1× = 40 real s per game-hour) instead of the old 60 s.
> - **Scale and start (C6, C8, C9).** Fixed spring-1855 start; worlds are procedural by default (ADR 0003) with authored fixtures; Small/Standard/Large World sizes from `11` §5.6/`07` §6 replace "600–1,500 named"; the lazy census is now a **[DECISION]** (`00`), with peoples and pantries on every census household.
> - **Physiology (P8; C24, C26, C48).** §6 is rewritten as the owner of burn rates and nutrition effects: a kcal energy ledger, a water ledger, scurvy, protein/fat, and monotony; spoilage environment inputs (temperature, wetness, storage kinds); **household pantries in a lean 1855 spring** (the hungry gap, rationing policy, the Apr 1 starting distribution); fae food as a nutrition effect. Disease keeps epidemiology only (C25).
> - **Alert levels (C41).** `alert_level` now covers **non-person threats only**. People-directed escalation is `04` §9's rungs 0–6; `06`'s witch tiers are labels on them. `HearthState.fear` is the merged `04` M + `10` community-anxiety value; `suspicion` is a derived view, not a ladder.
> - **Director and the psyche (`10`).** Tension gains an *inner* term (the PC's anxiety); new nudges N11 (stressor timing) and N12 (dream tilt); the Director may *read* but never *write* psyche state; ledger lines about a PC's unconscious are redacted by default.
> - **Peoples (`12`).** Settlement and census records carry peoples/cultures; the Director may not shape arrivals, rumors, tells, or scapegoats by people; F4 becomes **Night Market**.
> - **Sensitivity fixes (C10, C13).** The found-flint "elf arrow" is dropped (folk diagnosis kept; proof is a fae thorn); "barrow-wights" restated as explicitly fictional fae barrow-folk; "hanged" becomes mob action or a mundane trial (pending `01` Q6); a sovereign-neighbor row flagged for the faction table.
> - **Calendar and fae paths (C18, C19).** `01`'s festival names; the Tithe is monthly (`06`) and Lammas is a one-off Behest; time-slip is capped and always shown, using `01` §4.5's ratios.
> - **Smaller items.** C20 (Cartography), C22/C23 (reads `03`'s load bands; °F insulation model confirmed), C39/C40 (event struct and tier mechanism deferred to `07`), C43 (the Director voices only what some carrier knows), C44 (Chronicle shows only what the PC knows during play), C45 (Woe is the fae currency), C14 (each F-incident names its trespass basis). New incidents D7, D8, S9. New §14 lists divergences from the code.
>
> **Resolves from `09`:** C6, C8, C9, C10, C13 (text; the legal question stays `01` Q6), C14, C18, C19, C20 (Cartography only), C21, C22, C23, C24, C26 (05's share), C39, C40, C41, C43, C44, C45, C48, C49. **Still open here:** the county seat on/off-map (C9), tenth-second resolution and auto-Tactical (C21b, `07` Q1), the sovereign-neighbor row (C10, `01` Q1), and the new questions at the end of §12.

---

## 0. Governing principles for this doc

1. **[DECISION]** P1 and P3 put the *county* in charge, not the player and not the Director. Everything in the Director section is subordinate to that.
2. **[PROPOSAL] Conservation of causes.** Every observable change in the world must have a cause recorded in the event log. That cause can be a sim process, an actor's choice, an arrival from beyond the map edge, or a Director nudge, which is also logged. Nothing appears "because the story needed it" without a ledger line. This is what makes P1's "show the math" possible at world scale.
3. **[PROPOSAL] Evidence, not cutscenes.** Off-screen events reach the player through *traces*: physical evidence, changed prices, rumors, and missing faces. The world tells you what happened by having been changed by it.
4. **[PROPOSAL] Period-real numbers first, then tune.** Climate, travel speeds, disease, and populations start from 1850s Driftless data. We bend them for fun only after watching them run.
5. **[DECISION, ADR 0001; C49] Integers and tables.** Nothing in this doc may need `exp`, `log`, `pow`, or trig at runtime. Where a formula is written with them for readability (logistic growth, EMAs, decay, wind chill, ice growth), §13 gives the integer form. Designer-facing tables use miles, °F, and fractions; the sim stores feet, whole °F, and per-mille.
6. **[PROPOSAL] Physical quantities live in ledgers.** Energy, water, warmth, spoilage, and stock are tracked in kcal, ml, °F, and spoil-points. The 0–1000 "need" the rest of the game sees is a pure function of a ledger. That is what lets the provisions planner (`11` §2.8), the Readiness panel (`03`), NPC household rationing, and the sim all run *the same arithmetic* (forecast = outcome).
7. **[PROPOSAL] The Director reads minds and moves the world; it never writes a mind.** Psyche state (`10`) is an input to its tension model and a source of latent drama, but every effect it has on a mind passes through something that mind would meet anyway: a stressor, an arrival, a dream's candidate list.
8. **Example names are illustrative (C7).** Fenner Coulee, the Vogt farm, and the like are placeholders until `01`'s Hollin County cast is approved and the names pass is done. They are not canon.

---

## 1. The Region Map

### 1.1 Structure: a graph over a raster

**[PROPOSAL]** The region map is a **graph of nodes and edges laid over a coarse terrain raster.**

- **Nodes** are places: sites (§2), junctions, fords, passes, landmarks.
- **Edges** are routes: ridge roads, valley roads, creek-bottom trails, deer paths, the river, and fae paths.
- **Raster** is a terrain grid at **40-acre resolution** (one quarter-quarter section, 1,320 ft on a side). It stores elevation, slope aspect, soil, vegetation stage, hydrology, fae intensity, and ecological stocks. Off-road travel, site generation context, and ecology all read the raster.

**Why a graph and not hexes.** The Driftless constrains movement. You go along a ridgetop or up a coulee bottom. You almost never go straight across, because that means a 300–500 ft descent through brush and limestone ledges and then the same climb back up. Real roads in Vernon, Crawford, and Richland counties follow ridges ("Ridge Road" is still everywhere) or creek bottoms. A hex grid would flatten that, making a coulee wall cost about the same as a gentle slope and hiding the region's defining feature. A graph makes *route choice* the overland decision: the fast, exposed ridge road, or the sheltered, fog-prone, flood-prone valley road. The raster underneath means the player is never railroaded. **Bushwhacking** (leaving the graph) is always allowed. It is slow and risky, and it builds an ad-hoc edge across raster cells.

**Why the raster at 40 acres.** It matches the Public Land Survey System that was actually carving up Wisconsin at this time: 6-mile townships, 1-mile sections, 40-acre quarter-quarters. Land claims, plat maps, and speculator purchases can all key to the same cells. This gives the economy and the map a shared unit.

### 1.2 Scale and generation

**[DECISION, ADR 0003] Procedural by default.** A new game generates its county: terrain, hydrology, ecology, the Fae-intensity field, settlement siting, routes, sites, population, and a 5–10-year history pre-roll. Hand-authored worlds remain a supported input. `01`'s Hollin County and Iron Ford are the **flavor bible and constraint set**, and the `iron_ford` scenario is the first fixture and the tutorial seed. This supersedes this doc's earlier "hand-authored skeleton" (C8): "Threshold Town" is the *role* a generated World fills, and the default hand-built World uses Iron Ford.

| Layer | Source | Contents |
|---|---|---|
| Skeleton | Generated from constraints (a fixture may pin it) | Big river and backwaters, 4–6 major creek systems, major ridges, 3–5 villages (the county seat is off-map, below), the mine district, 6–10 "anchor" fae sites (the Prince's seat among them), steamboat landings |
| Detail | Generated, seeded per layer (`gen_version`) | Minor coulees and side valleys, homesteads, springs, caves and sinkholes, minor fae sites, deer paths, minor roads, abandoned claims |
| Pre-roll history | Generated by running the headless sim before play | Debts, courtships, feuds, grudges, Figures, the winter's weather, and the winter's pantries (§6.9). The pre-roll's Chronicle becomes "local history" |
| Dynamic | Sim-generated during play | New homesteads, new roads worn by traffic, logged-off slopes, burned areas, new graves, new fae rings |

**World size [DECISION, lead call + `11` §5.6 + `07` §6].** The size is chosen at creation, stored in `World.meta` and the save header, and is the **only scale lever**. Tier caps, radii, and relevance thresholds are identical on every device (`11` §5.1); a slower phone runs the same simulation more slowly.

| | Small ("A Coulee") | **Standard** (default) | Large ("The Long County") |
|---|---|---|---|
| Area | ~360 sq mi | **720 sq mi** (24 × 30 mi) | ~1,000 sq mi |
| Raster (40-acre cells) | 5,760 (72 × 80) | **11,520** (96 × 120) | ~16,000 (100 × 160) |
| Nodes | 200–350 | **400–700**: ~150 homesteads, ~6 settlements, ~60 caves/mines, ~40 fae sites, the rest junctions, fords, landmarks | 650–1,000 |
| Settlements | 3–4 | **~6** | 8–10 |
| People (census) | 1,500–2,000 | **3,000–4,000** | ~5,000 |
| Named actors at start | ~400 | **~800** | ~1,500 |

This retires the older "600–1,500 named, 3,000–5,000 people" (C9). The named count grows during play as census members materialize (§3.5) and is bounded by a soft ceiling per size (`07` §5.3 compaction).

**Composition.** The census draws peoples and cultures from content priors, never from code. `12` §2 gives the county priors: roughly 85% human, 8% elf, ~2% shadow-faekin (actual; believed shares differ), 5% goblin, with goblins clustered at the mine district and bluff quarries and everyone else mixed. Cultures (Yankee, Norwegian Lutheran, German Catholic and Lutheran, Cornish Methodist, Irish Catholic, French/Métis, free Black settler households, and so on) are a separate axis (`12` §1) and drive language, foodways, denomination, and norms. The Standard World's ~60–100 faekin and ~160–200 goblins fall out of the shares; they are not placed by hand.

**Start date [DECISION, `00`; C6].** The run begins **1855-04-01 00:00** (the ADR epoch), a Sunday: Palm Sunday in 1855 (Easter fell on April 8). The old "pick any start year in 1835–1870 with era variants" is withdrawn. Other eras are reachable only as *later states of the same county* through legacy time-skips (§11.3; `06` §5.4), so the arrival, price, and density tables stay keyed on the calendar year: the railroad survey and the Panic of 1857 are scheduled-pressure data (§10.5), not variants. The Civil War question stays with `01` Q2.

**The county seat [OPEN, C9].** `01` §3.2 and §8 put the county seat off-map; this doc's earlier text put it on-map. **Recommendation:** off-map. It is a T2 city at the map edge that supplies the land office, circuit court terms, railroad scheme clocks, and a paper that arrives by mail, while the largest on-map settlement (Iron Ford's role) holds a justice of the peace, a print shop (the *Sentinel*), and the monthly court day. Court day, the Paper voice, and Land Office references below are written to work either way.

### 1.3 Terrain types (raster cell classes)

*Speeds are designer-facing mph. The sim stores feet per game-minute (1 mph = 88 ft/min), so 3.0 mph is 264 ft/min and a 6-mile road is `floorDiv(31680, 264)` = 120 game-minutes.*

| Terrain | Driftless reality | Travel (mph on foot, off-road) | Notes |
|---|---|---|---|
| Ridgetop prairie/oak savanna | Flat-ish uplands, farmed early | 2.5 | Exposed to wind and lightning; good visibility |
| Goat prairie | Steep **south/west-facing** bluff slopes, dry grass, limestone outcrops | 0.75 | Hot in summer. Rattlesnakes (timber rattler). Fae favor them |
| Wooded slope | **North/east-facing** slopes, maple-basswood, cool and damp | 0.75 | Ginseng and morel habitat; easy to get lost |
| Coulee bottom | Narrow valley floor, spring creek, pasture or brush | 2.0 | Fog, cold-air pooling, flash floods |
| Limestone bluff/cliff | Sheer faces, 50–200 ft | Climb only | Climb DC by height; caves at the base |
| River bottom/backwater | Sloughs, islands, floodplain forest, wild rice | 1.0 (wading) / boat | Ague mosquitoes; seasonal flooding |
| Marsh/fen | Sedge meadow, tamarack | 0.5 | Cranberries; bog bodies; will-o'-wisps |
| Pine relic/cliff pine | Rare white pine on cool cliffs | 0.75 | High fae intensity, old places |
| Cleared field | Wheat, corn, hay, stumps | 2.5 | Seasonal: mud in April, crops block line-of-sight in August |
| Logged-off slope | Stumps and slash | 0.5 | Erosion risk, fire risk, raspberries |
| Sinkhole/karst | Depressions, sinking streams | — | Cave entrances |

**[PROPOSAL] Aspect matters.** The raster stores aspect, and vegetation is derived from it. South-facing slopes are prairie, north-facing are forest. This is the Driftless's signature look, and the fae lore can lean on it: the Court holds the sunny bluffs, and the dark slopes belong to something else. `01` decides.

### 1.4 Edges and travel

```
Edge {
  id, a: NodeId, b: NodeId,
  kind: RidgeRoad | ValleyRoad | Trail | DeerPath | River | FaePath | Bushwhack,
  length_ft: int, climb_ft: int,       // all lengths in feet (integers, §13)
  surface_state: Dry | Mud | Snow(depth_in) | Ice | Flooded(depth_ft),
  ford?: { stream: StreamId, base_depth_in, current_pm },
  lost_dc_base: int, exposure: 0..3,   // wind/lightning exposure
  fae_intensity_max: 0..5,
  traffic_pm: 0..1000,                 // wear; high traffic upgrades DeerPath→Trail→Road over months
  known_by: KnowledgeRef               // see 1.6
}
```

**Base speeds [PROPOSAL]** (mph; an 8-hour travel day is the default):

| Mode | Road | Trail | Deer path | Off-road (see terrain) | Notes |
|---|---|---|---|---|---|
| Walking, light load | 3.0 | 2.0 | 1.5 | table above | Climb: +30 min per 1,000 ft up, +15 min per 1,000 ft down |
| Walking, loaded | road 3.0 × band | 2.0 × band | 1.5 × band | ×band | The band's **overland speed %** is read from `03` §4.1 (Unburdened 100, Light 95, Medium 80, Heavy 60, Staggering 30), replacing this doc's old "heavy load > ⅓ capacity" (C22). `02` owns capacity; `03` owns the bands |
| Horse (sustained) | 4.5 | 3.0 | 1.5 | ×1.0 (mostly leading it) | Horse fatigue tracked |
| Wagon | 2.5 | 1.5 | — | — | Mud halves it; ruts |
| Canoe | downstream 4–5, upstream 1.5–2 | | | | Portage at dams/rapids |
| Steamboat | downstream 9, upstream 6 | | | | River only; Apr–Nov; fare via `03` |

Modifiers: mud ×0.6, snow 6–12" ×0.6, snow >12" ×0.35 (snowshoes restore to ×0.7), night ×0.5 unless a road under a moon of half or more, fog ×0.7.

**Fatigue and food.** Travel drains the rest need (§6.4) at the band's **fatigue rate** from `03` §4.1 (×1.0 Unburdened to ×3.0 Staggering), ×1.5 climbing, ×0.5 riding, and burns kcal by activity class (§6.1: a loaded day's walk is *Moderate* to *Heavy*; a forced march is *Extreme*). Forced march past 8 hours/day requires Constitution checks per `02`'s fatigue hooks.

**Getting lost [PROPOSAL].** On entering an edge without a known route, roll a Wayfinding check (`02`) against:

`DC = edge.lost_dc_base (Road 0 / Trail 8 / DeerPath 12 / Bushwhack 15) + fog 5 + night 5 + fresh snow 3 + fae_intensity × 2 − map quality bonus (0–6) − familiarity (0–6)`

- Fail: **turned around**. Add 25–100% to the travel time and make another roll.
- Fail by 5+: you arrive at a random adjacent node instead.
- Fail by 10+ on an edge with fae intensity ≥ 3: **pixie-led**. You are diverted onto a fae path (below) involuntarily. This is a fae event, not just a navigation failure.

**Fording.** Each ford has `base_depth_ft`, and the weather sim (§4.4) supplies `stage_ft`. Under 1.5 ft: free. 1.5–3 ft: Strength/Swim check, wet clothing (§6.3), and possible loss of dropped gear. Over 3 ft or a flood current: impassable without a boat, rope, or bridge. A coulee creek can go from 1 ft to 8 ft in 45 minutes during a flash flood and recede within 12–24 hours.

**Fae paths [PROPOSAL].** These are edges that do not obey geography.

```
FaePath extends Edge {
  opens_when: Condition[]   // moon phase, quarter day, dusk/dawn, fog, specific offering, invitation
  subjective_min: int       // how long it feels
  slip: { ratio_x10: int, cap_hours: int, reverse: bool }   // objective_min = floorDiv(subjective_min × ratio_x10, 10), capped
  toll: Toll?               // a gift, a name, a memory (hooks 04), a year of your life (consented)
  connects: NodeId pairs that may be miles apart, or nodes that only exist in Faerie
}
```

Fae paths are the region's "warp lanes," and they keep their own logic: a path that runs ridge-to-ridge only in valley fog, a path that opens at moonrise on the full moon between two fairy rings 9 miles apart. Time-slip is real, **capped, and always shown** (C18). The ratio follows `01` §4.5–4.6 for the ground the path crosses: Fae intensity 3 runs ×1.5–2, intensity 4 runs ×3–7, and intensity 5 ("severe") is **[PROPOSAL]** ×8–12 (`ratio_x10` 80–120). So a one-hour walk at intensity 4 costs 3–7 hours, not days; this doc's earlier "1d6 days per hour" is withdrawn. The world sim keeps running while you're in there. That mechanic exists because the sim runs off-screen, and coming home to find your claim jumped is a better story than a fade-to-black.

- **Non-consensual slip has a hard cap** of `cap_hours` per traversal (default 144 h = 6 days). Larger losses come only from **consent or a named incident**: a toll ("a year of your life"), a bargain's term, or a ring dance at All Hallows (F1). That keeps a Rip Van Winkle skip a story the player walked into.
- **Reverse slip** (arriving before you left) exists only on paths flagged `reverse`, which are Fae intensity 5 anchor paths, and is a story event, not a roll (`01`: "very rare").
- **Shown, always.** The UI carries the "time out of joint" indicator with the current ratio (`11`). A traveler with Lore (Fae) 2+, or an iron-cased watch, gets the estimated cost *before* entering. Surprise time loss that can't be foreseen would be unfair; a cost that can be foreseen is a choice.
- **Whose clock.** The traveler's body, wounds, needs, and *carried goods' spoilage* run on subjective time. The world, home pantries, farms, and other people run on objective time. So hardtack in your pack barely ages through a slip, and the stew pot back home does.

### 1.5 Fog of war and knowledge

**[PROPOSAL]** Map knowledge is **per-actor**, not per-player. The player's fog of war is simply the player character's knowledge. This also gives NPCs geography knowledge that rumors (`04`) can carry: "the Haugen boy knows a shortcut through Fenner Coulee."

| Knowledge state | What the map shows |
|---|---|
| Unknown | Nothing; the raster renders as blank paper |
| Rumored | A vague icon with a placement error radius (up to 2 mi), labeled with the rumor's content |
| Charted | From a map item; accuracy depends on that map |
| Visited | True position and the terrain seen; a last-seen timestamp |
| Familiar | Visited 5+ times; −familiarity to the lost DC; you notice changes on arrival |

Knowledge is **dated**. The map shows what you *last saw*, so a farmhouse that burned yesterday still shows as standing until you look. That is how off-screen events stay surprising.

### 1.6 Maps as items

**[PROPOSAL]** Maps are items (stats in `03`) that carry **knowledge payloads**. Reading a map merges its payload into your knowledge, tagged with the map's provenance.

```
MapItem {
  kind: PlatMap | HandDrawn | RiverChart | FaeMap | TreasureMap,
  author: ActorId?, made_on: Date,
  coverage: CellSet, entries: [{ feature, believed_pos, true_pos, error_ft, label }],
  accuracy_pm: 0..1000, staleness: derived from made_on,
  fae: bool   // fae maps show fae paths; their accuracy may depend on moon phase
}
```

- **Plat maps** from the land office are accurate for sections and roads and blind to fae sites. They cost around $0.50–$2 (`03`).
- **Hand-drawn maps** from NPCs are made from *that NPC's knowledge*, including their errors and their lies.
- **Treasure maps** are mostly rumors made physical. See §10 M-series.
- **Fae maps** are drawn on birch bark or skin. They show fae paths and may be true only on certain nights.
- The player can **draw maps** and sell them, resolved with **Trade (Cartography)** or **Lore (Local)** from `02`'s list (there is no Cartography/Craft skill; **[OPEN]** which of the two `02` prefers, C20). This produces a catalog item from your own exploration.

---

## 2. Site Maps

### 2.1 Grid and size

**[PROPOSAL]** Site tiles are **5 ft squares**, a direct 3.5e inheritance that keeps reach, movement, and spell areas legible. `11` §2.2's zoom stops and touch-target math assume 5 ft; the content schema's current default is 10 ft (§14).

| Site type | Typical size (tiles) | Real footprint | Persistence class |
|---|---|---|---|
| Camp (anywhere off-graph) | 60×60 | 300 ft | Ephemeral |
| Homestead | 120×120 | 600 ft | Persistent |
| Village | 160×160 | 800 ft | Persistent |
| Town / county seat | 240×240 | 1,200 ft | Persistent |
| Mine (surface + levels) | 100×100 surface + 2–4 levels of 80×80 | | Persistent |
| Cave | 1–4 levels of 60–120 | | Persistent |
| Fae glade | 80×80 | 400 ft, or "larger inside" | Persistent, with fae rules |
| River bottom | 120×120 | | Semi-persistent |
| Bluff top | 100×100 | | Semi-persistent |
| Goat prairie | 100×100 (steep; elevation layers) | | Semi-persistent |
| Ford/crossing | 80×80 | | Semi-persistent |

**Persistence classes:**
- *Ephemeral* sites are discarded on leave unless something notable remains (a grave, a cache, a fire scar). Then they get promoted to semi-persistent.
- *Semi-persistent* sites keep a delta log that decays (§2.4).
- *Persistent* sites keep a full delta log and structural records.

### 2.2 Generation from region context

**[PROPOSAL]** Generation is a pure function. The same inputs always give the same site.

```
generate_site(world_seed, site_id, gen_version, context) -> SiteBase
context = {
  raster_cells: elevation, aspect, soil, vegetation_stage, hydrology, fae_intensity,
  site_record: type, structures[], owners, resource_stocks,
  season, snow_depth, stream_stage, recent_weather,
  edges: which routes enter and where (roads enter at the right map edge)
}
seed = hash(world_seed, site_id, gen_version)
```

Generation passes, in order:
1. **Landform**: a heightmap shaped by the raster: coulee walls, the creek, limestone ledges, a sinkhole. Elevation is rendered as levels for the 2.5D view (P6).
2. **Hydrology**: springs, creek channel, floodplain.
3. **Vegetation**: from aspect, soil, `vegetation_stage` (old growth, second growth, logged, cleared, burned), and season.
4. **Structures**: placed from `site_record.structures[]`. Each structure's layout is seeded by its own id, so adding a barn doesn't reshuffle the house.
5. **Resources**: forageables, game sign, and ore, instantiated from the node's ecology stocks (§5) at density proportional to the stock.
6. **Fae overlay**: rings, standing stones, wrong-colored flowers, path entrances. Intensity scales the density and the strangeness.

`gen_version` is stored per site in the save. A patch that changes generators does not reshape existing sites unless a migration says so (`07`).

### 2.3 Promotion (T1/T2 → T0): making the place look like what was simulated

00 calls this a key technical risk. **[PROPOSAL]** Use a **layered reconstruction** in which each layer has exactly one authority:

| Layer | Authority | Rebuilt by |
|---|---|---|
| L0 Base terrain | Seed + raster | `generate_site` (deterministic) |
| L1 Structures | Site record (sim-authoritative list with condition, owner, contents) | Deterministic placement per structure id; position persisted once first placed |
| L2 Deltas | Delta log (player and actor edits: trees cut, holes dug, walls broken, items dropped) | Replay the compacted log |
| L3 Ecology overlay | Node resource stocks | Density resampled from stocks; *specific* harvested plants persist via L2 |
| L4 Weather/season overlay | Weather sim | Snow, mud, flood level, ice |
| L5 Traces | Trace records (§3.6) | Instantiate as tiles and objects |
| L6 Actors | T1 activity records | Placement rules per activity |
| L7 Items | Sheets (inventories), container records, and pantry stacks | Already authoritative; just placed. Pantry and pack stacks are first brought current by closed-form spoilage (§6.8), so what the player finds is as spoiled as the sim says |

**Catch-up rule.** If the site was at **T2** when promoted, first run a **T1 backfill** over the gap, capped at 48 game-hours (anything older is already summarized at T2). The backfill uses a seed derived from `(site_id, last_t1_time)`, so loading the same save twice gives the same backfill. Then instantiate.

**Actor placement from activities:**

```
Activity { actor, kind, site, zone_hint, started, ends, progress, interruptible }
kind → placement rule
  Plowing(field_7)        → random walkable tile in field_7's zone, facing the furrow, tool equipped
  Sleeping                → own bed tile, or the hearth if the bed is gone
  Drinking(tavern)        → tavern interior, near other Drinking actors (clusters by opinion, 04)
  Traveling(edge_e)       → on the site edge where edge_e enters, mid-stride
  Hiding(from=player)     → best-concealment tile per a Stealth check (yes, a real check at promotion)
```

**Consistency checks at promotion** run in debug builds and are logged in release. Is every actor's activity possible given the L1/L2 state? If a farmer is "plowing" a field that a flood left under 3 ft of water, re-resolve that activity as **interrupted by** the flood. Promotion reveals what T1 skipped. It does not contradict it.

### 2.4 Demotion (T0 → T1): what gets saved when you leave

**[PROPOSAL]** Before demoting:

1. **Settle dynamic processes.** Fires, floods, fights, and chases in progress are resolved at T1 granularity: the fire burns to completion against fuel and weather, and the fight resolves via `02`'s abstract combat hook.
2. **Compact deltas.**
   - Keep: structural edits, dug or filled tiles, cut trees (≥1), graves, caches, any item with value ≥ $0.10 or that is flagged notable (owned, quest-linked, unique).
   - Aggregate: litter, footprints, and minor trample become **traces** with decay timers rather than tile deltas.
   - Cap: 20,000 deltas per persistent site. Past that, the oldest low-significance deltas merge into "worn" region flags.
3. **Convert actors to activities.** Each actor's current job plus their goal stack (`04`) becomes an Activity.
4. **Write a site summary** for T2: occupancy, damage state, stocks changed, and notable events (to the event log).

**Decay at T1/T2.** Deltas on semi-persistent sites decay. Footprints last 1–3 days (less in rain, preserved in mud until it dries). Campfire ash lasts 1–2 weeks. A cut trail regrows in about 2 years. A grave stays for decades and turns into an unmarked depression after about 20 years without care.

---

## 3. Level-of-Detail Simulation

### 3.1 Tier assignment

**[DECISION]** Three tiers per `00`. **[PROPOSAL]** Assignment is by **relevance, not just radius**:

```
tier(site) =
  T0 if player is on it
  T1 if travel_hours(player, site) <= 6
       or site.relevance >= R1
  T2 otherwise

relevance(site) = Σ over actors there: pinned(actor)*10 + |opinion_of_player|/10
                + active_thread_weight(site) + (site is a planned destination)*5
```

**Pinned actors** are always at least T1 wherever they are: companions, pursuers (witch hunters, a grudge-bearer actively hunting the player), and actors in Director-flagged threads (§8). A posse hunting the witch is never coarser than T1.

**[DECISION, `00`; C40]** At the actor level the rule is `tier(actor) = max(locationTier, relevanceTier)`, recomputed hourly with hysteresis (`07` §5.1 owns the mechanism: promote at once, demote only after a dwell). This doc owns the *policy* (radii, relevance weights, pinning), `04` owns social hydration, `07` owns the mechanism and budgets. **The caps and radii are the same on every device** (`11` §5.1), because tier changes outcomes. Relevance never reads an actor's people or culture.

**[PROPOSAL]** Exactly **one T0 site** at a time, because there is one protagonist. The architecture should allow N T0 sites for a future party or colony mode (`00`'s "don't prevent it").

### 3.2 What runs at each tier

| System | T0 (live) | T1 (nearby) | T2 (distant) |
|---|---|---|---|
| Movement | Analytic path segments, event-driven (`07` §3.4) | Edge traversal by activity; arrival times | Flow between settlements as rates |
| Needs (§6) | Ledgers advance at each game-minute rollover (burn by activity class) | Per activity block (eat at Meal activity, etc.) | Household-level: pantry vs. mouths at the household's ration (§6.9) |
| Psyche (`10`) | Thoughts continuous; Ego arbitration hourly (ADR) and on interrupt | Arbitration at activity end; defenses roll per block | A few integers per named mind and one daily roll; a community-anxiety aggregate per settlement |
| Pantries and spoilage (§6.8–6.9) | Items in hand and containers; spoil points advance per hour for exposed stacks | Household pantries stepped per 6-hour sub-step; stable stores in closed form | Same arithmetic, closed form, per household (census households included) |
| Actions/checks | Every action rolls | One roll per activity outcome ("plowed 3 acres"; "tracked deer: success") | None per actor; outcome distributions |
| Combat | Full tactical (`02`) | Abstract resolution (`02` hook): N rounds collapsed to opposed totals | Casualty tables at faction/population level |
| Social (`04`) | Individual interactions | Interaction events rolled per co-located pair per activity | Opinion drift; rumor diffusion over `04` §11.3's compartments (household ⊂ congregation/language ⊂ settlement), with a graph between settlements |
| Economy (`03`) | Individual trades | Store restocking, daily sales, wages | Production/consumption, prices, river trade |
| Ecology (§5) | Individual animals with sheets | Herds/packs as group actors moving on edges | Cell stocks with logistic growth |
| Weather (§4.4) | Local, with microclimate | Same weather, sampled hourly | County weather state (also feeds T0/T1) |
| Disease (§6.5) | Individual infection | Individual infection | SEIR compartments per settlement |
| Fae | Full fae rules | Fae actors as activities; fae paths | Court schemes as clocks (§7.2) |

### 3.3 Tick rates

**[DECISION, ADR; C21]** Game time is integer **game-minutes**. Real-time mapping is in §4.1 and `11` §1.6.

| Tier | Step | Notes |
|---|---|---|
| T0 | **Event-driven on the sub-minute clock** (`07` §3.4): instants are `minute × 600 + tenth`, i.e. tenths of a game-second. Per-minute systems (needs, ledgers) run at minute rollover | Actions are timed actions in `02` §7's units (swift 0.5 s, standard 3 s, reloads 12–40 s). Movement is analytic along path segments, not a per-second loop over actors. Tenth-second resolution is `07`'s proposal (`07` Q1) |
| T1 | 1 game-hour | Activities are 1–8 hours; resolved when they end or are interrupted. Ego arbitration (`10`) runs here hourly |
| T2 | 1 game-day, with **6-hour sub-steps for weather, rumor diffusion, and pantry/spoilage** | Flash floods and stage-road rumors outrun a day |

**[DECISION, `00`]** `00` adopted the 6-hour T2 sub-steps that this doc originally proposed as a challenge to its "game-days" tick. The sub-steps are cheap, county-level arrays, so a flood that T1 *sees* at 3 p.m. reaches a T2 village that same afternoon.

### 3.4 Moving actors and items between tiers

- **Actor demotion T0→T1**: snapshot the sheet (authoritative everywhere; there is no "lite" sheet), then compute the Activity from the current job and goals.
- **Actor demotion T1→T2**: a named actor stays a named actor. At T2 they are *parked* at their home site with a "routine" activity, and their mind (`04`) runs at T2 cadence: opinion drift, memory decay, and goal re-evaluation once per day.
- **Actor promotion T2→T1→T0**: resume the routine activity, run the catch-up rule, then place.
- **Items** never change representation. An item is always an entity (or a fungible stack, `07` §3.6) in an inventory, container, or site delta. **Household pantries are inventories in `03`'s item model at every tier (C48)**, so a census household at T2 has real stacks, not a statistic. The **settlement ledger** (bushels of wheat, barrels of pork by commodity class, `03` §8) is a *derived view*: the sum of household pantries plus commercial stocks (store, mill, granary, charity box, the Club pantry). It feeds `03`'s prices and `HearthState.prosperity`. It is not authoritative, so when a site is promoted nothing needs to be "materialized" out of it: the stacks are already there, brought current by closed-form spoilage (§6.8). Demotion folds only *un-notable, un-individuated* loose stacks (litter, dropped scraps) back into their owner's pantry or the commons.
- **Edges count as places.** An actor mid-journey at T1 is "on edge E, 40% along." If the player enters that edge, the encounter is generated on a **camp-sized site** at that position. This is how you meet travelers on the road, and it requires no spawning: they were really there.

### 3.5 Budget sketch

**[PROPOSAL]** Policy numbers. `07` §6 owns the real profiling, targets, and gates (measured as worker CPU on a mid phone); `11` §5.4 owns the device classes.

| Tier | Typical count | Per-step cost target |
|---|---|---|
| T0 | ≤ **150** actors at every World size (town on market day), ≤ 15k items, 240² tiles | Heap entry ≤ 5 µs; ≤ 15% of one core at 1×, ≤ 50% at 6× |
| T1 | Cap **250 / 400 / 600** actors (Small / Standard / Large), 20–80 sites | 30 actors < 5 ms per game-hour (the ADR's M2 gate); 400 actors ≤ 40 ms, sliced ≤ 8 ms |
| T2 | 3–10 settlements, ~40 animal populations, ~8 factions, 5.8k–16k raster cells, 400–1,500 named actors parked plus census | ≤ 150 ms per game-day on the mid phone (≤ 50 ms desktop); ≤ 15 ms per 6-hour sub-step; **pantries and spoilage ≤ 10% of T2** |

At 6× one game-hour passes in about 6.7 real seconds (`11` §1.6), so the T1 budget is generous. The raster ecology update is one integer pass over 6–16k cells, which is trivial. If the T2 day misses by 3× or more, the structural fallback is `07`'s: fix the data layout first, narrow Standard's named count last.

**Population vs. P2.** 3,000–4,000 humans (and others) as full sheets with minds, all ticking `04`'s social sim, is expensive and mostly wasted. **[DECISION, `00`]** **Lazy, deterministic census materialization:**

- **Named actors**, ~400 / 800 / 1,500 by size, have full sheets and minds from world generation. These are everyone who owns land, runs an institution, or has a story role, plus their households' adults.
- **Census population** is held in household records with no mind yet. The shape is `07` §5.3's: `{ household, place, seed, members: [{ idx, born, sex, people, presentsAs, culture, occupation, alive, materialized }], exposure, pantry }`. **Census households are real households**: they have a pantry (§6.9) and an `exposure` aggregate (hardship, illness, losses, debts).
- **Materialization** is deterministic from the household seed and the member's `idx`, and it is **time-independent**: day 10 and day 300 produce the same person (`07` §5.3). It happens on the first relevant contact: the player meets them, a rumor names them, an event needs a victim, they move to T0, or they become party to a grudge, debt, or persecution role. After that the actor is permanent and named. Events may name a census member before they exist through a `CensusRef`.
- The engine stores the truth about `people` and `presentsAs` and gates it behind beliefs (`12` §7). It never makes a prejudice true.

Before materialization, census members still use the same rules in aggregate: their labor, their **kcal need (people-scaled, §6.1)**, their pantry draw, and their disease exposure all count at T2. That keeps this fully compatible with P2's "no special-case NPC logic": it's an instantiation policy, not a separate rule set. (`00` has since adopted this reading; this paragraph was originally a challenge to P2.)

### 3.6 Off-screen events become evidence: Traces

**[PROPOSAL]** Every T1/T2 event resolution that has a physical footprint writes **trace records**. Promotion (§2.3 L5) instantiates them, and the region map can show them from a distance (smoke, buzzards).

```
Trace {
  id, event_id, site_id, zone_hint, created_at,
  kind: Tracks | Blood | Carcass | Burned | Grave | Damage | Missing | Smoke | Buzzards | Notice | PriceChange | Absence
  detect: { skill: Perception|Tracking|Bargain|Gather Information, dc: int },   // 02 skill names; Gather Information TBD in 02 (see 09)
  reveals: [Fact],        // what a successful check teaches, e.g. "3+ wolves, 2 days ago, heading NE"
  decay: { tau_min, weather_pct },   // exponential via the decayQ16 table (§13), evaluated lazily on read
  visible_from_region: bool, range_mi
}
```

| Off-screen event | Traces produced |
|---|---|
| Wolf raid on sheep | Carcasses (buzzards visible for 2 days within 2 mi), tracks (Tracking DC 12, +5 after rain), farmer's grudge against wolves (`04`), bounty notice at the store |
| Barn fire | Smoke column (visible 8 mi, same day), charred ruin (permanent until rebuilt), lumber price +10% (`03`), a barn-raising event queued |
| Murder | Fresh grave or a missing person (Absence trace: their usual activity goes unattended, so the cows go unmilked), a rumor (`04`), blood (Perception DC 15) |
| Fae abduction | Fairy ring of trampled grass, a dropped shoe at the edge, a family that stops coming to church, a sheriff's notice |
| Price shock | PriceChange trace in the store ledger; the clerk's dialogue mentions it; Bargain (appraise) reveals the cause |
| A household running short (§6.9) | Chimney smoke only at supper; the dog gone; a boy hired out early; a longer credit line in the store ledger; a neighbor's covered basket (Absence, PriceChange). Read People or a look at the pantry reveals `ration_pct` ≤ 70, and the planner's pantry view shows "as of Tue" |
| Death from disease | New grave, black crepe on the door, the Sabbath service lists names, and a later newspaper item |

**Absence is a trace.** The most period-true evidence is someone not being where they should be: the miller hasn't opened in three days. T1 knows every named actor's routine, so a broken routine is detectable by anyone who expects it. NPCs notice absences too (`04` hook), and that is how villagers discover that the witch has been cursing them.

---

## 4. Time and Calendar

### 4.1 Game speed

**[DECISION]** Real-time with pause on site maps; overland travel compresses time.

**[PROPOSAL]**

| Speed | Game time per real second | 1 game-day takes |
|---|---|---|
| 1× | 1 game-minute | 24 min |
| 3× | 3 game-minutes | 8 min |
| 6× | 6 game-minutes | 4 min |
| Ultra (sleep/wait/craft, no threats nearby) | 30 game-minutes | 48 s |
| Overland travel | Resolved per edge with interrupt checks | ~1–3 s per edge |

Overland travel is interruptible. Each edge rolls for encounters drawn from the T1 actors *actually on that edge* plus the ecology and fae populations of its cells. Weather changes, getting lost, and Director-flagged events can stop the journey and spawn a camp-sized site.

### 4.2 Day and night

**[PROPOSAL]** Use **local solar time**. Standard time zones don't exist until 1883, and a town clock set by its own noon is a nice period detail. At 43.5°N:

| Date | Sunrise | Sunset | Day length |
|---|---|---|---|
| Winter solstice | 7:30 | 16:30 | ~9 h |
| Equinoxes | 6:00 | 18:00 | 12 h |
| Summer solstice | 4:20 | 19:40 | ~15.3 h |

Civil twilight adds about 35 min on each end. Light level from the sun and moon feeds Perception and stealth (`02`). Coulee bottoms lose direct sun 1–2 hours before ridgetops: **valley dusk** is a real local modifier.

### 4.3 Seasons and the agricultural year

| Months | Season beats (human) | Beats (wild) |
|---|---|---|
| Jan–Feb | Ice cutting, logging camps active, butchering done, deep cold, sleigh travel on the frozen river | Wolves hungriest; deer yarded; fae courts in their winter state |
| Mar–Apr | **Maple sugaring**, mud season, ice-out, spring log drive, steamboats return | Spring melt floods; pigeons return; morels late April |
| May | Planting wheat/corn; Syttende Mai (May 17) | Ramps, morels; fawning; turkey gobbling |
| Jun | Haying; strawberries; Midsummer | Fireflies; ague season starts |
| Jul | **Wheat harvest** (late July); Fourth of July | Blackberries; thunderstorms; tornadoes |
| Aug | Threshing; oats; county fair prep | Elderberries, plums; milk-sickness season (white snakeroot) |
| Sep | Corn cut and shocked; **county fair**; ginseng digging | Wild rice; hazelnuts; bucks in rut late |
| Oct | Potato harvest, apple butter, husking bees | Walnuts, hickory; waterfowl migration |
| Nov | Butchering begins; elections (first Tuesday); Thanksgiving by governor's proclamation | River freezes late Nov–mid Dec; fae Samhain |
| Dec | Christmas (German and Norwegian customs); logging camps open | Deep snow begins |

### 4.4 Weather simulation

**[PROPOSAL]** A **county-scale stochastic weather generator** driven by monthly climate normals, plus **local microclimate modifiers** per raster cell.

**Normals.** These start from La Crosse/Prairie du Chien and are shifted **−2°F** for the tail of the Little Ice Age.

| Month | Mean high °F | Mean low °F | Precip (in) | Snow (in) | Notes |
|---|---|---|---|---|---|
| Jan | 24 | 4 | 1.1 | 11 | Record lows −40°F |
| Feb | 29 | 8 | 1.0 | 8 | |
| Mar | 41 | 20 | 2.0 | 8 | Melt, ice-out late Mar–mid Apr |
| Apr | 57 | 33 | 3.4 | 2 | |
| May | 69 | 45 | 4.0 | 0 | Tornado season begins |
| Jun | 78 | 55 | 4.6 | 0 | Peak thunderstorms and flash floods |
| Jul | 83 | 60 | 4.3 | 0 | |
| Aug | 80 | 58 | 4.4 | 0 | |
| Sep | 71 | 48 | 3.4 | 0 | First frost ~Sep 25 in valleys, ~Oct 5 on ridges |
| Oct | 58 | 36 | 2.3 | 0.5 | |
| Nov | 41 | 24 | 2.0 | 6 | River freeze-up |
| Dec | 27 | 10 | 1.3 | 11 | |

**Weather state** (county-level, 6-hour sub-step):

```
WeatherState {
  regime: HighPressure | WarmFront | ColdFront | Clipper | Stationary | Thunderstorm complex,
  temp_f, dewpoint_f, wind_mph, wind_dir, cloud: 0..1, precip_rate_in_hr, precip_type,
  regime_hours_left,
  soil_moisture: per cell (0..1), frozen_ground: per cell bool,
  snowpack_in: per cell, river_stage_ft: per stream reach, river_ice: per reach {None|Forming|Solid(thickness_in)|Breakup}
}
```

Regimes form a Markov chain with month-specific transition tables, giving 2–5 day weather systems. That's the way Midwestern weather actually behaves, and a single forecast ("bad weather coming") makes it a readable thing to plan around.

**Microclimate modifiers** (per cell, from the raster):

- **Cold-air pooling**: on clear, calm nights coulee bottoms run **5–10°F colder** than ridgetops, so frost pockets kill valley crops first.
- **Valley fog**: forms on clear, calm nights when the bottom's temperature reaches its dewpoint. It is common after rain and in autumn, and it burns off 2–4 hours after sunrise. Ridgetops sit above it ("islands in a white sea"), and the fae like it.
- **Wind**: ridges and goat prairies get full wind; coulees about 40%.
- **Snow drift**: drifts accumulate on lee slopes, and ridge roads drift shut.

**Hazard generation:**
- **Flash flood**: a coulee reach floods when `rain_in_3h × runoff_coefficient > threshold`. The runoff coefficient is high when soil moisture is above 0.8 or the ground is frozen, and higher on logged or cleared slopes. This makes **logging and plowing increase flood risk**, as historically happened in the Driftless.
- **Tornado**: in a thunderstorm-complex regime, May–Aug, there is about a 1–2% chance per storm day of a touchdown somewhere in the county. The path is 5–15 mi long and 100–400 yd wide, laid on the raster.
- **Lightning**: per storm hour, strike probability per exposed cell. Fires take more readily in dry fuel.
- **River ice**: thickness grows with freezing degree-days (about 1 in per ~15 FDD early). It is safe for a person at ≥ 4 in and for a wagon at ≥ 8 in. Breakup is triggered by melt plus rising stage and can produce an **ice jam** flood.
- **Spring melt**: snowpack × melt rate → river stage. A big-snow winter reliably means April floods on the big river.

**Forecasting.** NPCs with Trade (Farming), Lore (Nature), or Lore (Almanac) can forecast 1–2 days ahead with skill-scaled accuracy, which makes this a legible game system. The almanac item (`03`) gives seasonal tendencies that are about as wrong as real almanacs were.

### 4.5 Moon and the fae calendar

**[PROPOSAL]** A true **29.53-day** synodic cycle. The phase affects night light (full moon ≈ dim lamplight for Perception purposes) and fae logic.

| Fae calendar date | Date | Sim effects |
|---|---|---|
| Imbolc / Candlemas | Feb 1–2 | Courts stir; first bargains of the year |
| Spring equinox | ~Mar 20 | Fae paths reorient; balance day |
| **Beltane / May Eve** | Apr 30–May 1 | Fae intensity +1 county-wide for 24 h; abduction risk; fae markets |
| **Midsummer** | ~Jun 21–24 | Fae revels; fae intensity +1; St. John's Eve customs in German/Norwegian settlements |
| Lammas | Aug 1 | Harvest tithes owed to the Court (witch mode: Prince's demand cadence) |
| Autumn equinox | ~Sep 22 | |
| **Samhain / All Hallows** | Oct 31–Nov 1 | The border thins: fae intensity +2; the dead and the Hunt ride |
| **Midwinter / Yule** | ~Dec 21 | The Wild Hunt season begins (through Twelfth Night, Jan 6) |
| Full moons | every 29.53 d | Certain fae paths open; fae revel; werewolf-type populations (if `01` has them) act |
| New moons | | Dark; witch rites favored (`06`); smugglers move |

`01` owns the names and meanings. This table only defines the **calendar slots** the sim reads.

### 4.6 The human calendar

| Recurring | When | Sim effect |
|---|---|---|
| Sabbath | Sunday | Most work stops; church attendance (Piety, gossip hub for `04`); stores closed in Yankee/Norwegian towns, beer gardens open in German ones |
| Market day | Saturday (configurable per town) | Farmers come to town: T0 population doubles; prices and rumor exchange peak |
| Court day | Monthly (county seat) | Trials, land disputes; crowd; a hanging is possible |
| Mail day | 1–2×/week by stage; daily by steamboat in season | News and rumors from outside enter; letters (hooks) |
| Fourth of July | Jul 4 | Oratory, militia muster, fireworks/anvil shooting, drunkenness, fights |
| County fair | Late Sep, 2–3 days | Livestock and produce competitions (Prosperity), horse races, a sideshow; strangers |
| Thanksgiving | Late Nov (governor's proclamation) | Family gatherings |
| Christmas | Dec 24–26 | Customs vary by settler group; Julebukking (Norwegian mumming), which has great masks-and-fae potential |
| Elections | First Tuesday of Nov | Faction contests (§7) |
| Harvest | Late Jul–Oct | All hands; wages up; hired-labor demand (opportunity) |
| Butchering | Nov–Dec | Meat stocks; wolves and bears drawn |
| Steamboat season | ~Apr 10–Nov 25 | Trade, immigration, disease import (cholera) |

---

## 5. Ecology

### 5.1 Model

**[PROPOSAL]** Ecology has two representations:

- **Stocks** live in raster cells (T2): plant resources and small game as numbers with **logistic growth** toward a carrying capacity `K(cell, season, vegetation_stage)`.
- **Populations** are herds, packs, flocks, colonies, and broods (T1/T2). They are group actors with territory, needs, and memory, and they are **materialized as individual animal actors** at T0.

```
Population {
  id, species, count, age_structure, health: 0..1, hunger: 0..1,
  territory: CellSet, den_or_home: NodeId,
  needs: { food_kcal_per_day, water, shelter, breeding_site?, (fae) glamour/offerings? },
  fears: { humans: 0..1, iron: 0..1, fire: 0..1 },   // learned; rises after being shot at
  memory: [ { place, event, valence } ],            // "sheep at the Vogt farm were easy"
  leader?: ActorId  // a notable animal with a full sheet: the old one-eyed she-wolf
}
```

**Population update (T2, daily):**
```
prey_available = Σ stock in territory × catchability(season, snow)
hunger += need − min(need, prey_available)
if hunger > 0.5: territory expands 10%/week; daytime activity rises; risk tolerance rises
if hunger > 0.7 and a livestock node in/near territory with deterrence < risk tolerance:
    queue a Raid activity at T1 (→ incident A1)
births at season; deaths from starvation (hunger > 0.9 for 14 days), hunting, disease
```

This is P1 in miniature. A wolf pack raids the Vogt sheep because a hard winter yarded the deer in a coulee the pack can't reach, and because the Vogts' dog died last month. The Director can *see* that chain and nudge it (§8), but it cannot invent it.

### 5.2 Species roster (1850s Driftless baseline)

| Species | Representation | Density / numbers (county) | Notes |
|---|---|---|---|
| White-tailed deer | Stock + herds | ~10–20/sq mi in good habitat (7–14k) | Market hunting drives decline; winter yards |
| Gray wolf | Packs (4–8) | 6–10 packs, territories 40–100 sq mi | Bounties paid by county ($5–$10 per scalp, varies) |
| Black bear | Individuals | 30–60 | Raid cornfields, hogs, smokehouses |
| Cougar ("panther") | Individuals | 0–3 | Rare and legendary |
| Elk | Small herd | 0–20 (gone by 1866) | Era-dependent extinction event |
| Beaver | Colonies | 1 per ~1–2 stream mi, unless trapped out | Dams alter hydrology and flood fields |
| **Passenger pigeon** | **Migratory superflock event** | 0 to *millions* | See below |
| Wild turkey | Flocks | Declining | Extirpated in WI by ~1880 |
| Prairie chicken, ruffed grouse | Stock | | |
| Waterfowl | Seasonal stock (river) | Massive spring/fall migrations | |
| Brook trout | Stock per spring creek | | Siltation from plowing kills them |
| River fish (catfish, sturgeon, walleye, pike) | Stock per reach | | Sturgeon to 100+ lb |
| Timber rattlesnake | Stock on goat prairies | | Bites in summer |
| Fur-bearers (mink, muskrat, otter, fox, raccoon) | Stock | | Trapping economy (`03`) |

**Passenger pigeons [PROPOSAL].** The species gets a dedicated system because it is the most extraordinary real phenomenon available to us. Wisconsin's 1871 nesting covered about 850 sq mi and held an estimated 100+ million birds.

- **Flight events** in spring and fall: flocks that darken the sky for hours. They are a pure spectacle event with a small effect: hunters get easy meat, and crops get stripped.
- **Nesting events**, rare (about 1 in 5 years, era-weighted toward earlier years): a mast-rich forest region becomes a nesting for 4–6 weeks. Effects:
  - Professional netters arrive from off-map with the railroad or steamboats.
  - Pigeon prices crash, there is a frenzy, and trees break under the weight.
  - Hogs get turned loose to fatten on squabs.
  - Fae are agitated. **[OPEN]** for `01`: do the fae have a stake in the pigeons?
- A **long-term decline curve** is tied to era and to how much netting the sim allowed. A run starting in 1868 may see the last great nesting. The Chronicle should treat that weight seriously.

### 5.3 Monster and fae populations

**[PROPOSAL]** These use the same Population schema with extended needs. Example placeholders follow; `01` owns the bestiary. Wisconsin lumber-camp "fearsome critters" (hodag, hidebehind, agropelter) and Cornish mine knockers are strong candidates.

| Population | Needs | Raids/acts because |
|---|---|---|
| Knockers (mine fae) | Respect: crumbs left, no whistling; undisturbed lodes | A company blasts a "their" vein → collapses, lost lodes |
| Hidebehind-type predator | Lone travelers in deep woods; darkness | Logging pushes it from its range → a lumber camp disappears one by one |
| Fae revelers (court-aligned) | Offerings, music, mortals' attention, open land | A church bell newly hung within 1 mi → fae intensity drops → they retaliate or move |
| Barrow-wights / old dead | Undisturbed graves | A plow opens a barrow (see the M-series sensitivity note) |
| Will-o'-wisp swarm | Marsh, fog, travelers | Fog nights; draining the marsh angers them |

The fae need **glamour/belief/offerings** where an animal needs kcal. The schema is the same and the currency is different. **[OPEN]** for `01`/`06`: is "glamour" a real simulated resource that the witch's Curses feed? (Recommended: yes. One currency, many producers.)

### 5.4 Foraging and plants by season

| Plant | Season | Habitat | Use / value |
|---|---|---|---|
| Maple sap | Mar–early Apr | Maple-basswood slopes | Sugar; ~40 gal sap → 1 gal syrup |
| Ramps (wild leeks) | Apr–May | North slopes | Food, spring tonic |
| Morels | late Apr–May | Dying elms, old orchards, south-then-north slopes | Food, small trade |
| Fiddleheads, nettles | May | Bottoms | Food |
| Wild strawberries | June | Prairie, field edges | Food |
| Black raspberries, blackberries | Jul–Aug | Edges, logged-off slopes | Food, preserves |
| Wild plums, elderberries | Aug–Sep | Bottoms, edges | Food, wine |
| Hazelnuts | Aug–Sep | Savanna edges | Food |
| **Ginseng** | Dig Aug–Oct (berries red) | Rich north-facing maple slopes | **Major cash trade good**, sold dried to dealers for the China trade. Plants take 5+ years to reach diggable size, so it is easily overharvested |
| Wild rice | Sep | River backwaters | Food, trade |
| Black walnut, hickory | Sep–Oct | Slopes, bottoms | Food |
| Cranberries | Sep–Oct | Marsh | Trade |
| Goldenseal, mayapple, bloodroot | Spring–summer | Woods | Medicine (hooks to `02`'s healing) |
| **White snakeroot** | Aug–Oct bloom | Woodland pasture | *Poison*: the cause of milk sickness (§6.5) |
| Fae plants (placeholders) | By fae calendar | High fae intensity | Spell components, bargains (`02`/`06`) |

Forage yield per search = `stock_density × season_curve × (1 + Woodcraft_margin×0.05)`, capped by the stock. Harvesting draws down the cell stock.

### 5.5 Depletion and recovery

**[PROPOSAL]** Every stock has `K`, a growth rate `r`, and a **pressure** history. Representative recovery figures:

| Resource | r (per year) | Depletion pattern | Recovery |
|---|---|---|---|
| Beaver colonies | ~0.15 | Trapped out in 2–3 seasons of heavy trapping | Recolonization from neighboring streams, 5–15 years |
| Deer | ~0.3 | Market hunting, bad winters | 3–5 years if pressure stops |
| Ginseng | ~0.05 | Diggers take the mature plants | 10+ years; may never come back if no seed plants are left |
| Forest (sawlogs) | succession stages | Logging: old growth → logged-off | Old growth never in-game; second growth sawlogs in 40–60 years |
| Brook trout | ~0.4 | Siltation from plowed slopes lowers K | Only if slopes are reforested |
| Wolves | ~0.2 | Bounties, poison (strychnine was used) | Fast if prey holds |

Depletion is visible: fewer forage nodes on the site map, trapper NPCs moving on, and fur prices up (`03`). It feeds the Director's "economic squeeze" heuristics. **[PROPOSAL]** The Chronicle's annual Almanac page (§11) reports these as county trends.

---

## 6. Survival Systems

**[PROPOSAL]** Needs are 0–100 meters on every actor's Mind (`04` owns the structure; this doc owns the physiology). Thresholds map to **conditions owned by `02`**. This section defines the inputs and burn rates.

### 6.1 Hunger

- Baseline **2,400 kcal/day**; ×1.5 for heavy labor, travel, or combat; +20% below 20°F effective temperature; +10% per heavy-load hour.
- Food items carry kcal and spoilage (`03`). Pemmican, salt pork, and hardtack keep; fresh meat lasts 1–3 days in summer and weeks frozen.
- Stages: Fed > Peckish (<60) > Hungry (<30; −1 to physical checks) > Starving (<10; Con check daily or take ability damage via `02`).
- **Fae food** sets a flag: mortal food satisfies at 50% for 1d6 weeks (see §6.5).

### 6.2 Thirst

- **3 L/day** baseline; 5 L in July heat or under labor.
- Water source quality: spring 0 risk; running creek low; river or slough moderate (cholera, dysentery); stagnant high. Boiling removes the risk at a fuel and time cost.
- Dehydration stages work like hunger but run about 4× faster.

### 6.3 Temperature and exposure

**[PROPOSAL]** Use an insulation model with legible numbers that 03's clothing stats plug into.

```
effective_temp = air_temp − wind_chill(wind_mph, after shelter) − wet_penalty + fire_bonus + sun_bonus
comfort_band  = [base_low − Σ insulation(layers), base_high − Σ heat_load(layers)]
base comfort band (dry, at rest) = 60–80°F; activity shifts it down 10–20°F
```

- **Layers**: each clothing item has `insulation` (°F of band extension, e.g., wool union suit 8, wool shirt 6, frock coat 10, buffalo robe 25), `wind_block` (0–1), and `wet_retention` (wool keeps 50% of its insulation wet; cotton keeps 10%). `03` supplies the numbers.
- **Wetness** 0–1 rises with rain, fording, sweat, and snow melt on you. Drying rate depends on air temp, wind, and fire proximity.
- **Shelter**: none (full wind) / windbreak (−50% wind) / lean-to (−70%, +5°F with a reflector fire) / tent (−90%) / cabin (indoor temp is simulated by building heat balance; a cabin with a stove holds 40–60°F above outside).
- **Fire**: +15–30°F within 2 tiles, falling off with distance. It burns fuel (1 armload ≈ 1 hour) and needs a check to start in wet or wind (`02` skills, `03` tinderboxes and matches).
- Outcomes when below the band: Chilled → Hypothermic (mild / severe / fatal), a few °F of core per hour of exposure, and frostbite risk to extremities below 0°F effective. Outcomes when above: Heat exhaustion → heat stroke in July.

### 6.4 Fatigue and sleep

- Fatigue rises ~6/hour awake; ×1.5 under labor or forced march.
- Sleep restores ~12/hour, scaled by **sleep quality** (0.3–1.2), which depends on bedding, warmth, shelter, noise, perceived danger (mind hook), and fae disturbance.
- Stages map to `02`'s fatigued and exhausted. More than 40 hours awake forces Con checks to stay awake.
- **Watches**: if you sleep alone in the wilds, threats get a surprise round unless an alarm (dog, bells on a line, companion) is present.

### 6.5 Disease and illness

**[PROPOSAL]** Individual infection at T0/T1, and **SEIR compartments per settlement** at T2, so epidemics are real off-screen processes that leave traces: graves, black crepe, quarantined steamboats.

| Disease | Transmission | Season/vector | Incubation | Course | Fatality | Notes |
|---|---|---|---|---|---|---|
| **Cholera** | Contaminated water | Summer; imported by steamboat (epidemics in 1849, 1850, 1854) | 0.5–5 days | Violent, 1–3 days | ~40–50% untreated | Boiling water and clean springs protect |
| **Ague** (malaria, *P. vivax*) | Mosquito | Jun–Sep, river bottoms and sloughs | 10–30 days | Recurring fever every 48 h for weeks; relapses months later | Low (<2%) but debilitating | Quinine/"Peruvian bark" is expensive (`03`); draining sloughs lowers risk |
| Typhoid | Water/food | Summer–fall | 1–3 weeks | Weeks of fever | ~10–20% | |
| Dysentery ("bloody flux") | Water/food | Summer, camps | 1–3 days | 1–2 weeks | ~5–20% | Rises with crowding |
| Smallpox | Person-to-person | Any | 7–17 days | 2–4 weeks | ~30% | Vaccination exists; the sim tracks a vaccinated flag |
| Consumption (TB) | Close contact | Chronic | Months–years | Slow decline | High over years | A long-running household tragedy |
| Measles, scarlet fever, diphtheria | Contact | Winter/spring | ~1–2 weeks | | High in children | Drives Chronicle grief beats |
| **Milk sickness** | Drinking milk from cows that ate **white snakeroot** | Aug–Oct, woodland-pastured herds | days | "The trembles" in cattle, then nausea and weakness in people | ~25% | The cause was unknown in the period, so NPCs attribute it to witches or fae. That makes it a **perfect witch-mode misattribution engine** |
| Rabies (hydrophobia) | Bite | Any | 1–3 months | Fatal once symptomatic | ~100% | From wolves, foxes, skunks |

**Fae afflictions (placeholders for `01`/`02`):**

| Affliction | Source | Effect |
|---|---|---|
| Elf-shot | Invisible fae dart | Sudden lameness or paralysis of a limb; a flint "elf arrow" may be found in the wound. Cattle too |
| Pixie-led | Fae path entry (§1.4) | Lost; time-slip |
| Fae-food hunger | Eating fae food | Mortal food at 50% for 1d6 weeks; risk of wasting |
| Glamour-sickness | Prolonged high fae intensity exposure | Wisdom drain; seeing things that aren't (or are) there |
| Stolen years | Dancing in a ring | Aging, or lost time on return |
| Changeling | Infant swap | A household tragedy; the changeling is an actor with its own sheet |

**Medicine hooks**: Medicine checks and the herbal remedy catalog (`02`/`03`), the town doctor (an institution), bleeding and calomel as period-plausible bad medicine (a Medicine check with **negative** expected value), and clerical magic if `02` has it.

### 6.6 Injury interaction

**[PROPOSAL] Hooks only.** `02` owns wounds. This doc consumes `injury.mobility_mult` (travel speed), `injury.bleeding` (thirst and fatigue burn), `injury.infection_risk` (with wetness, dirt, and the disease system), and `injury.pain` (sleep quality). Cold slows bleeding and raises shock risk, so the exposure system reports `core_temp` back to `02`.

---

## 7. Settlements and Factions

### 7.1 Settlements as systems

**[PROPOSAL]**

```
Settlement {
  id, name, site_id, founded, ancestry_mix (data slots), denomination_mix,
  population: { households[], census_counts by age/sex/occupation, named_actors[] },
  buildings[] (site record), institutions[],
  economy: { production[], consumption[], stocks (ledger, 03), wages, prices (03) },
  hearth_state: HearthState, threats: ThreatRecord[], alert_level: 0..5,
  growth: { immigration_rate, emigration_rate, birth_rate, death_rate }
}

HearthState {          // the collective "mood": 0..100 each; a T2 aggregate of residents' minds (04) plus events
  prosperity,          // food stocks, prices, wages vs. cost of living
  fear,                // recent violent/uncanny events weighted by proximity and recency
  cohesion,            // average intra-settlement opinion; feuds lower it, bees and weddings raise it
  piety,               // church attendance, revival effects
  suspicion,           // directed: toward outsiders, a named actor, an ancestry group, "a witch"
  grievance            // directed: toward a faction (mining co., speculator, the Court)
}
```

**Production and consumption (T2 daily, handed to `03` for prices).** Each household and institution has recipes: a farm turns labor, land, and season into wheat, corn, pork, and hay; the mill turns wheat into flour; the store does import/export via the river; the smithy uses iron and charcoal to make tools. Shortfalls raise prices, and surpluses get exported by steamboat in season. **`03` owns prices**; this doc owns the quantities.

**Institutions** (each a building plus a staff of named actors plus a function):

| Institution | Function in the sim |
|---|---|
| Church(es) | Piety; Sabbath gathering; charity (catches the starving); witch-hunting (high Piety + Fear + Suspicion) |
| Store / Outfitter | Trade hub; credit and debt; rumors; adventurer start (`06`) |
| Tavern / inn | Rumor exchange (`04`), hiring, fights; travelers stay here (arrivals) |
| Mill | Processing bottleneck; flood-vulnerable |
| Smithy | Repairs; iron, with fae relevance |
| Justice of the peace / sheriff / constable | Crime response, posses, bounties |
| Militia | Muster on threat; the Fourth of July |
| Post office / stage stop | Mail; news ingress |
| Newspaper (county seat) | **Chronicle voice** (§11); amplifies rumors county-wide |
| School | Children's daily routine (Absence traces when they vanish) |
| Doctor | Disease response |
| Land office (county seat) | Claims, speculators |

**Growth and decline.** Immigration is a T2 flow from the map edge (the steamboat landing or road entry), with rate set by `prosperity`, available land cells, era, and news (a cholera year cuts it 50%). Arrivals are materialized as new households. Decline comes from emigration (low prosperity, high fear), deaths, and fires. Settlements can **die**: an abandoned village becomes a ruin site with traces, and that's a good adventure location.

**Threat response ladder [PROPOSAL].** `alert_level` rises with fear plus specific threat records:

| Level | Response | Example triggers |
|---|---|---|
| 0 | Normal | |
| 1 | Talk: rumors spread faster, doors locked at night | Livestock killed |
| 2 | Watch: night watch, children kept home, prices up | Second incident; a missing person |
| 3 | Posse: the sheriff raises 5–15 armed men for 1–3 days | A clear culprit or tracks to follow |
| 4 | Militia/bounty: wolf bounty raised; hired hunters arrive (off-map arrivals); the church preaches against it | Repeated incidents; a death |
| 5 | Panic: witch-hunt, mob violence, people flee, scapegoats | Fear > 80 and Suspicion focused on a target |

In **witch mode** the ladder *is* the antagonist. The witch's Curses raise Fear and add evidence. `04` decides who the suspicion focuses on, which isn't always the real witch, and scapegoating an innocent neighbor is a major story generator.

### 7.2 Factions

**[PROPOSAL]** Factions are T2 agents with goals pursued through **schemes**: multi-step plans with progress clocks, borrowed from Blades in the Dark's faction clocks. That makes them legible to P1's "show the math."

```
Faction {
  id, kind: Town | Company | Church | Militia | Speculators | Court | Population,
  leaders: ActorId[], members: ActorId[] | census share,
  assets: { money, land_cells, buildings, influence: per settlement, armed_strength },
  goals: [{ kind, target, priority }],
  schemes: [{ id, goal, steps[], clock: 0..N, segments, per_day_progress_roll, visible_traces[] }],
  relations: { faction_id: -100..100 },
  opinion_of_player: (04 faction-opinion hook)
}
```

| Faction (placeholder names; `01` owns) | Typical goals | Example scheme (clock) |
|---|---|---|
| County seat town | Get the railroad; be the trade hub | "Courting the railroad" (8): lobbying, a bond issue, a survey party arrives, and a rival village withers |
| Mining company | Extract lead; cheap labor | "Sink the deep shaft" (6): steam pump, blasting, which angers the knockers → collapse risk |
| Land speculators | Buy cells cheap, sell dear | "Paper title" (6): buy tax-delinquent claims, then evict squatters |
| Lumber company | Cut the pine, drive logs in spring | "Clear Fenner Coulee" (4/season) → floods and siltation downstream |
| Churches (per denomination) | Converts, temperance, a new church | "Revival" (4) → Piety +20, Suspicion of the uncanny +10 |
| Militia / Vigilance committee | Order, as they define it | "Clean out the bottoms" (4): drive off squatters/"witches" |
| Temperance society | Close the tavern | Petition, then a vote |
| The Prince's Court | Keep Faerie's claim; punish trespass; harvest mortal… something | "Reclaim the bluff" (8): curse the settlers there (the witch's work, in witch mode) |
| Other courts | Rival agendas (`01`) | Bargain with the player against the Prince |
| Wolf packs, fearsome critters | Survive (Population needs) | No clocks; need-driven |

**T2 faction loop (daily):**
1. Choose a scheme step based on priority × feasibility.
2. Roll progress using faction assets against opposition (other factions, the player's recent acts).
3. Write traces and events. A survey party passes through; a notice of foreclosure is posted.
4. Update relations.

Schemes are visible to anyone who looks: a clock's segments are discoverable facts ("the railroad men have been dining with the mayor"). A player who investigates can *see* the clock. **[PROPOSAL]** The UI shows faction clocks for factions you have intelligence on, at the precision your knowledge allows.

**Sensitivity note.** The Ho-Chunk, Sauk, Meskwaki, and Dakota were real nations in this region and this era, with removals in 1830–1874 and repeated returns. They are not monster populations and should not be a "faction to fight." **[OPEN]** for `01`: how (and whether) they appear, ideally with cultural consultation. Real effigy mounds are sacred sites. Mechanics such as "dig up a mound for treasure" are off the table. Fae barrows are fictional and fine.

---

## 8. The Director

### 8.1 Prior art

| System | Core mechanism | Strengths | Weaknesses for us |
|---|---|---|---|
| **RimWorld** (Cassandra, Phoebe, Randy) | Threat points ∝ colony wealth × adaptation; a storyteller cycles "on" and "off" days and spawns incidents from a weighted deck. Cassandra ramps steadily, Phoebe gives long rests, Randy is random | Readable pacing; personality is a great *player-facing* difficulty knob; adaptation (mercy after losses) | Raids spawn from nowhere at the map edge. Wealth-based scaling punishes building up. Incidents are often disconnected from world causes |
| **Left 4 Dead AI Director** | Tracks survivor "emotional intensity" (damage taken, nearby enemies); cycles build-up → peak (cap ~3–5 s) → fade → relax (30–45 s); populates *unseen* areas only | The best explicit **tension model** in the field; spawns only where the player isn't looking (in-fiction plausibility) | Runs on minutes, not seasons; enemies are disposable with no persistent causes |
| **Dwarf Fortress** | No director. Pure emergence from deep sim plus a long history (Legends mode) | Stories feel *true*; legacy history; the gold standard for "simulation as storyteller" | Pacing is uneven: long dull stretches, then sudden collapse. Players supply most of the narrative framing |
| **Wildermyth** | Authored story beats (events with role-casting) triggered by character state and relationships; procedural comics | Casting existing characters into authored beats makes relationships matter; callbacks feel personal | Lots of authored content; beats can feel like a card deck; less simulation |
| **James Ryan (Talk of the Town, story sifting) / Kreminski's Felt/Winnow** | The sim overgenerates and a sifter finds narratively interesting patterns after the fact | Makes emergent stories *noticeable*; feeds retellings (Chronicle) | Sifting alone doesn't shape pacing |

### 8.2 Our approach: the Nudging Director

**[DECISION]** It prefers nudges to spawns (`00`). **[PROPOSAL]** The design, in one line: **an L4D-style tension model plus RimWorld-style personalities, acting through a constrained set of plausibility-bounded nudges, aimed by a Wildermyth/Ryan-style thread interest model, logged for P1 legibility.**

The Director's job is not to make things happen. **Things are already happening.** The sim generates more latent drama than any player can witness. The Director's job is to (a) **choose which latent dramas ripen, and when**, and (b) **route them toward the player's attention** without breaking causality.

### 8.3 What the Director can do: the nudge catalog

Every nudge has a **cost** in Director budget (§8.5) and must pass a **plausibility check**: the nudged state must be one the sim could have produced on its own. Concretely, it must lie within the **±1σ envelope** of the relevant stochastic process, or be a choice among options an actor's own goal scoring (`04`) rates within 15% of its best option.

| # | Nudge | Example | Plausibility bound | Cost |
|---|---|---|---|---|
| N1 | **Probability tilt** | Steer a cold front's track 10 mi east; tilt a pending d% roll | Within ±1σ of the generator | 1–3 |
| N2 | **Tie-break choice** | A wolf pack picks the Vogt sheep over the deer yard (similar scores) | Option within 15% of the actor's best | 2 |
| N3 | **Goal tip** | The grudge-bearer's "confront the player" goal gets +10% priority | ±10% to one goal's priority; must already exist in the actor's mind | 3 |
| N4 | **Rumor seed** | An NPC who *witnessed* X now mentions it at the tavern | The speaker must know the fact (`04` memory); the rumor content must derive from it | 2 |
| N5 | **Resource drift** | A deer herd moves two cells away → the pack's hunger rises | Within normal seasonal movement | 2–4 |
| N6 | **Timing shift** | A queued raid happens tomorrow instead of in 4 days | Within the event's own window | 2 |
| N7 | **Arrival shaping** | Next steamboat's passengers include a land agent and a sick deckhand | Arrivals are drawn from era tables; the Director re-weights composition up to ×2 | 3–5 |
| N8 | **Route crossing** | A peddler takes the ridge road the player is on rather than the valley road | Both routes valid for the peddler | 3 |
| N9 | **Discovery steer** | A trace's detect DC is −2, or it's placed on the path, not behind the barn | Within the placement rules | 1 |
| N10 | **Mercy** (personality-gated) | A trapper's routine passes the player's frozen camp | N8 rules; only when the death-spiral detector fires | 5 |

**Hard prohibitions [PROPOSAL]:**
- No creating actors, items, or populations except through N7 arrivals at map edges using era rates.
- No teleporting anything.
- No changing anything the player has observed (including via the player's dated knowledge).
- No fudging dice in visible checks: rolls the player sees are sacred. N1 only tilts *unseen* processes.
- No editing memories or opinions directly. Only N3/N4 influence `04`, through its own channels.
- No acting on T0 inside the player's field of view (an L4D lesson).

**Director's Ledger.** Every nudge writes `{t, nudge, target, before, after, rationale(thread_id, tension), cost}`. It is hidden by default, readable in a "Show the Director's hand" option for players who want P1 all the way down, and essential for tuning.

### 8.4 Tension model

**[PROPOSAL]** Measured **tension** `τ ∈ [0, 100]` is computed from sim state about the player:

```
τ = clamp( 25·physical_danger      // HP fraction lost, active wounds, hostile actors within 1 travel-hour, exposure stage
         + 20·survival_pressure    // worst need stage, days of food on hand < 3, illness
         + 20·pursuit              // pinned hostile actors' proximity and knowledge of player location (witch mode: hunt intensity)
         + 15·social_pressure      // grudges against player (count × strength), debts due, suspicion on player
         + 10·uncanny              // fae intensity of current location, active fae afflictions
         + 10·economic_pressure    // money vs. obligations )
```

Each term is normalized 0–1. There are two time constants: `τ_fast` (EMA over 6 game-hours), which tracks peaks, and `τ_slow` (EMA over 7 game-days), which tracks arcs.

**Pacing state machine** (L4D adapted to days):

```
RELAX ──(relax_days elapsed)──▶ BUILD ──(τ_fast ≥ peak_threshold)──▶ PEAK
  ▲                                                                   │
  └──────────────(τ_fast < 30 for 12h)◀── FADE ◀──(peak_hours elapsed or threat resolved)
```

- **RELAX**: the Director spends only on opportunity and social threads and on N9 discovery of pleasant things. It *suppresses* threat ripening with N6 delays, which is fully plausible because threats have windows.
- **BUILD**: it ripens the highest-interest threat thread via N2, N3, N5, and N6, and seeds rumors (N4) so the player gets **foreshadowing**. A threat should be rumored before it arrives. That's Chekhov in reverse, and it's legible.
- **PEAK**: hands off. The sim resolves. The Director does nothing except refuse to stack new threats (N6 delays others).
- **FADE**: allows the aftermath. Funerals, grudges, and recovery are all sim-native.

### 8.5 Budget

Budget accrues per game-day at the personality's rate, capped (e.g., 30). Spending is the only way to nudge. This bounds how "authored" a run can feel. **A Director at budget 0 is pure Dwarf Fortress.** That's a legitimate setting, offered as the personality "The Land Itself" (§8.8).

### 8.6 Story interest: threads, guns, callbacks

**[PROPOSAL]** The Director keeps a **Thread registry** fed by story sifting (§9).

```
Thread {
  id, pattern: PatternId, actors: {role: ActorId}, places, opened_at, last_advanced,
  stakes: 0..1, player_involvement: 0..1, open_questions: [Question],
  state: Latent | Foreshadowed | Active | Climax | Resolved | Abandoned,
  guns: [ChekhovGun], callbacks: [MemoryRef]
}
ChekhovGun { planted_event, planted_at, salience, seen_by_player: bool, fire_window: [min,max] days, fired: bool }
```

**Interest score** (computed per thread daily):

```
interest = 3.0·player_involvement
         + 2.0·stakes                                  // lives, livelihoods, relationships at risk
         + 1.5·ripeness(age)                           // rises to peak ~7–21 days, falls after 60 (stale)
         + 1.5·callback_strength                       // links to high-salience player memories / grudges (04)
         + 1.0·unfired_guns_seen_by_player
         + 1.0·novelty                                 // pattern not seen recently
         + 0.5·mode_fit                                // §8.9
         − 2.0·repetition                              // same pattern resolved in last 30 days
         − 3.0·implausibility_cost                     // budget the nudges would need
```

**Heuristics the Director acts on:**

- **Unresolved threads** with high interest get pushed from Latent to Foreshadowed to Active.
- **Chekhov's guns.** Anything the player *saw* that implies future action is a gun: a stranger's threat, an injured bear that escaped, a rumor of treasure, a debt with a due date, a fae bargain's unspecified "price." Seen guns approaching the end of `fire_window` get top ripening priority. **Unseen guns can quietly expire**, because the sim lets them fizzle with no nudge needed.
- **Callbacks.** The Director scores threads by how strongly they would reconnect to old high-salience memories (`04`). The trapper you saved in spring is the one passing your frozen camp in January (N10 plus N8). The bully you humiliated two years ago now runs the vigilance committee. These are sim-true: his goals moved him there. The Director only nudged his election odds within ±1σ.
- **Reversal and consequence.** It prefers threads where the player's past action is the cause, so P3's "consequences that come back three sessions later" is an explicit objective.
- **Spread of attention.** It avoids running two Active threats at once unless the personality wants chaos (Tall Tale).

### 8.7 Death spirals and mercy

The **death-spiral detector** fires when `τ_slow > 80` for 3 days with falling health and food. Personalities differ:

- Almanac and Hearth spend on N10 mercy: plausible rescues, opportunities, a weather break.
- Tall Tale doesn't care.
- Hidebehind lets you die *meaningfully*: it ripens the callback thread so the death lands in the Chronicle.
- "The Land Itself" does nothing.

**[DECISION]** Following P5, a run can end with your death. Mercy is a nudge toward plausible help, never invulnerability.

### 8.8 Director personalities

**[PROPOSAL]** These are player-selectable at run start and changeable mid-run (logged in the Chronicle). The names draw on Driftless and period folklore.

| Personality | Inspiration | Pacing curve | Budget/day | Preferences |
|---|---|---|---|---|
| **The Almanac** (default) | The farmer's almanac: seasonal, steady, slightly wrong | Cassandra-like: 6–10 day RELAX→PEAK cycles that intensify gently over a year and **follow the seasons** (hard winters are hard) | 3 | Balanced threads; foreshadows reliably; mercy on |
| **The Hearthside** | Grandmother's stories by the stove | Phoebe-like: long RELAX (15–30 days), soft peaks | 2 | Social, economic, opportunity threads; strong mercy; fewer deaths, more weddings |
| **The Tall Tale** | Lumber-camp whoppers, Paul Bunyan, fearsome critters | Randy-like: random walk; peaks can stack | 5, with random spending | Novelty ×2; spectacle (pigeon nesting, tornadoes, fae revels); no mercy |
| **The Hidebehind** | The lumberjack monster that's always behind you | Slow BUILD over 15–25 days with heavy foreshadowing (rumors, traces, absences), rare and brutal PEAKs | 3 | Uncanny and pursuit threads; withholds discovery until late; "meaningful death" |
| **The Circuit Rider** | Methodist preachers riding the frontier circuit, carrying news and judgment | Medium cycles tied to the Sabbath and social calendar | 3 | Social, grudge, and callback threads ×2; moral consequences; "the past comes back" |
| **The Good Neighbors** | The euphemism for the fae | Lunar: peaks track full moons and quarter days | 4 | Fae threads ×2; bargains; time-slips; capricious kindnesses |
| **The Land Itself** | Dwarf Fortress | None | **0** | Pure sim. The Director still *sifts* for the Chronicle but never nudges |

Personalities are **data**: a curve, weights, budget, mercy policy, and category multipliers. Modders and Ellie can add more.

### 8.9 Adventurer vs. Witch

| Aspect | Adventurer | Witch |
|---|---|---|
| Where tension comes from | The wilds (fae, monsters, weather, survival); town is the haven | The settlements (the Hunt); the wilds are home but hungry; the Prince above |
| Pursuit term in τ | Rare (grudges, outlaws) | Primary: `hunt_intensity` = Σ settlements' suspicion focused on the witch × alert_level |
| Thread preferences | Quest hooks via town institutions (missing persons, bounties, treasure rumors); exploration | The Prince's demands (the Court's scheme clocks); scapegoats; near-discoveries; a villager who might become an ally |
| RELAX looks like | Town, trade, the Outfitter, social life | A hidden camp, foraging, a fae revel; the hunt goes cold (N6 delays the posse's next sweep) |
| PEAK looks like | A monster lair, a blizzard on the ridge, a fae bargain gone wrong | A posse with dogs; a witch-finder arrives (N7); a cursed family's son tracks you |
| Special interplay | — | **Curses are player-owned nudges.** The witch does to the sim what the Director does. The Director treats Curses as authoritative and never counters them invisibly. It responds through sim channels: fear, suspicion, the ladder (§7.1) |
| The Prince | Distant, background faction | A second "director" in fiction: the Court's scheme clocks generate demands. The Director may N6-shift a demand's timing within its window but not its content |

**[PROPOSAL]** In witch mode the Director's mercy takes the form of **misattribution**. When the hunt closes in, it can tip suspicion toward a plausible scapegoat (N3 on a villager's suspicion goal, within 10%), using milk sickness, an eccentric widow, or a newcomer. This is both merciful and morally terrible, which is exactly the witch fantasy. The Chronicle remembers who hanged.

---

## 9. Story Sifting

### 9.1 Event log

**[PROPOSAL]** Every T0/T1/T2 resolution with any consequence writes an Event. This is the substrate shared by `04` (memories are perspectival copies of events), the Director, and the Chronicle.

```
Event {
  id, t, tier, site, edge?,
  type: EventType,                       // ~150 types: Attacked, Gifted, Lied, Married, Died, Cursed, Raided, PriceShift, ...
  roles: { agent?, patient?, instrument?, witness[] : ActorId|PopulationId|FactionId },
  causes: EventId[],                     // explicit causal links where the sim knows them
  effects: { opinion_deltas[], need_deltas[], items_moved[], traces[] },
  visibility: Public | Witnessed | Secret,
  importance: 0..1,                      // computed: stakes × notoriety of participants
  director_nudge?: LedgerId              // if a nudge contributed
}
```

**Retention.** T0 micro-events (each sword swing) roll up into a single "Fight" event at demotion. Events with importance below 0.05 are pruned after 30 days unless something references them in `causes`. The estimate is about 2–10k retained events per game-year. That's small.

### 9.2 Pattern language

**[PROPOSAL]** Sifting patterns are declarative, Datalog/Felt-style queries over the log. They are matched **incrementally**: the Winnow approach keeps partial matches open as threads.

```
pattern Betrayal:
  e1: Event(type in {Helped, Gifted, Saved, Lent}, agent=?A, patient=?B)
  e2: Event(type in {Attacked, Lied_about, Stole_from, Informed_on, Cursed}, agent=?B, patient=?A, t > e1.t)
  where opinion(?A→?B, e1.t) > 30
  importance: high if ?A = player or ?B = player

pattern Nemesis:
  ≥3 Events(type in Harm*, agent=?X, patient=player) over > 14 days, ?X survives all

pattern Feud:
  chain of ≥3 Harm events alternating between households ?H1 and ?H2, each citing the previous in `causes`
```

**Starter pattern library (~30 at launch).** Partial matches create Director threads; complete matches create Chronicle entries.

| Pattern | Partial match → Director thread | Full match → Chronicle |
|---|---|---|
| Betrayal | A trusted actor with a new grudge against the player | "Betrayed by…" |
| Nemesis | Two harms by the same actor | A recurring antagonist arc |
| Feud | Two-step harm chain between households | "The Lund–Becker feud" |
| Revenge | A grudge holder with a goal targeting the grudge object | "…had his revenge" |
| Debt repaid / unpaid | A loan with a due date | |
| Return of the lost | A missing actor still alive (fae-taken, lost) | "…came back after N years" |
| Reversal of fortune | Prosperity delta > 50% in a household | "Rags to riches / ruin" |
| Hubris | An actor ignored a warning (the knockers, a forecast) → harm | |
| Scapegoat | Suspicion on an innocent while the real culprit is known to the player | "They hanged the wrong woman" |
| The last of | A species or population or family line reaching 0–1 | "The last wolf in Fenner Coulee" |
| Love across lines | Rising romance between feuding houses or ancestries | |
| Prophecy fulfilled | A rumor or fae prediction later matched by an event | |
| Unlikely friendship | Opinion from ≤ −30 to ≥ +50 between two actors | |
| The long winter | Survival pressure > 0.7 for > 20 days, survived | |

**Callback index.** Sifting also maintains, per named actor, a ranked list of **events this actor would bring up**: high-salience memories (`04`). Dialogue, rumors, the Director, and the Chronicle all draw from it.

---

## 10. Incident Catalog

Format: **trigger** (sim terms) / **touches** (systems) / **outcomes**. Incidents are not spawned cards. Each is a *named pattern of sim behavior* that the sim produces natively. The Director can ripen one with nudges, and the Chronicle names it. *Bold* marks the Director nudges commonly used.

### 10.1 Weather (W)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| W1 | Valley fog | Clear, calm night; bottom temp ≤ dewpoint; autumn or after rain | Travel (lost DC +5), stealth, fae paths that open in fog, ambush | Lost travelers; pixie-led; witch slips past a posse; ridge-dwellers see "the white sea" |
| W2 | Coulee flash flood | Rain ≥ 1.5 in/3 h on soil moisture > 0.8 or frozen ground; amplified by logged/plowed slopes | Hydrology, fords, mills, livestock, actors on valley edges | Drownings; the mill wheel ripped out; a ford closed 12–24 h; uncovered things (a coffin, a cache); a lumber-company grievance |
| W3 | Blizzard | Clipper/low regime, Nov–Mar, wind > 25 mph + snow | Exposure, travel (ridge roads drift shut), livestock | Frozen travelers found in spring (a trace that waits for melt); stranded at a stranger's cabin (social); livestock losses → wolves' next raid |
| W4 | Deep cold snap | Arctic high, lows ≤ −20°F for 3+ days | Exposure, fuel stocks, river ice | A firewood shortage and price spike; deaths of the poor and elderly; the river becomes a highway; wolves hungrier |
| W5 | Thunderstorm and lightning | Thunderstorm complex, May–Sep | Fire, livestock, exposure on ridges | A barn fire (→S4 barn raising); a struck tree reveals a hollow with something inside; a person struck |
| W6 | Tornado | Thunderstorm complex, May–Aug, ~1–2%/storm day | Structures, actors, raster vegetation | A path of destruction; a homestead erased; a "miraculous" survival (Piety spike); the fae blamed or credited |
| W7 | Ice-out and spring flood | Snowpack × melt rate; Mar–Apr | River stage, steamboats, bottomland homesteads | Ice jam flood; first steamboat (news, goods, immigrants, disease); bottomland crops delayed |
| W8 | Drought | Precip < 50% of normal over 6 weeks, Jun–Aug | Crops, streams (fords easy, mills idle), fire risk, prosperity | Crop failure → emigration, debt, foreclosures (speculators' scheme advances); wildfire risk |
| W9 | Early killing frost | Clear, calm night in Sep before harvest; frost pockets | Valley crops (cold-air pooling) | Valley farms ruined while ridge farms are fine → inequality, grievance, envy (`04`) |
| W10 | Thin ice | Ice < 4 in where a route crosses; Dec or March | Travel, drowning | A sleigh through the ice; cargo on the river bottom (salvage opportunity); a rescue that creates a life-debt (social) |

### 10.2 Wildlife (A)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| A1 | Wolf raid on livestock | Pack hunger > 0.7; livestock in territory; deterrence < risk tolerance | Ecology, household economy, hearth fear, bounty institution | Sheep lost; bounty raised; a hunter hired (arrival); the player tracks the pack to its den; the pack's leader becomes a named nemesis |
| A2 | Bear in the corn | Aug–Sep, mast failure, cornfield in range | Ecology, crops, smokehouse stocks | Crop loss; bear hunt (a social event); a sow with cubs (moral choice) |
| A3 | Pigeon flight | Spring/fall migration window; flock route over the county | Food stocks, crops, spectacle | Free meat; crops stripped; awe (Chronicle) |
| A4 | Pigeon nesting | Rare (~1 in 5 yrs, era-weighted); mast-rich forest region | Arrivals (netters), prices, ecology, fae | A boomtown for 6 weeks; a frenzy; trees broken; the fae disturbed; a long-term population hit |
| A5 | Rabid animal | Rabies seeded in a fox or wolf population (low base rate; rises with density) | Disease, fear, dogs, children | A bite → 1–3 month incubation (a Chekhov's gun!); a dog put down; panic |
| A6 | Deer winter crash | Snow > 18 in for 30+ days | Ecology, wolves, hunters | Starving deer in yards; wolves move on livestock (→A1); venison scarce |
| A7 | Beaver dam burst | Beaver dam + heavy rain, or a trapper removing the colony | Hydrology, fields, mill pond | A flooded hayfield; a dam-building colony moved by a farmer → feud with the trapper |
| A8 | Panther on the bluff | Cougar territory overlaps a homestead; hunger | Fear, livestock, legend | A calf taken; screams at night attributed to the fae; a legendary hunt |

### 10.3 Fae (F)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| F1 | The ring dance | Full moon or quarter day; a fae ring site; a mortal alone nearby | Fae, time-slip, missing persons | A mortal dances and returns 1d6 days, months, or years later; a search party (→H1); a family's grief or joy |
| F2 | Changeling | Unbaptized infant (< 6 weeks) in a household with fae intensity ≥ 2 and no iron or protections | Fae, household, suspicion, Piety | A sickly "wrong" baby; rituals (some cruel, historically); the real child in Faerie (a hook); witch blamed |
| F3 | Pixie-led | Lost check failed by 10+ in fae intensity ≥ 3 | Travel, fae paths, time | A traveler found miles away days later, or never; the player diverted into Faerie |
| F4 | Goblin market | Quarter day night at a known fae site | Economy (fae prices in memories, years, names), fae food | Unique items; a bad bargain; fae food → affliction |
| F5 | The Wild Hunt rides | Samhain–Twelfth Night; winter storm regime | Fae, travelers abroad at night, livestock, fear | Livestock gone; a traveler taken or recruited; one of the Hunt left behind, wounded (hook) |
| F6 | A bargain offered | Fae actor with a goal the player could serve; player in high fae intensity | Fae, contracts (`06`), social | Power for a price with an unspecified term (a Chekhov's gun with a long fuse) |
| F7 | The knockers | Mine faction blasting in a fae-claimed vein; or a miner whistling / not leaving crusts | Mining, fae, disaster | Warnings (tapping) → heeded: safe; ignored → collapse (→D4); a lode "moves" (economic) |
| F8 | The Prince's demand | Court scheme step; fae calendar date (Lammas tithe, etc.) | Witch mode core (`06`); faction clocks | A curse quota, a named target, a gift owed; failure → the Prince's displeasure |
| F9 | Elf-shot cattle | High fae intensity pasture; fae grievance against the household | Livestock, household economy, suspicion | Lame cattle; flint points found; neighbors whisper "witch" |
| F10 | Church bell vs. the Court | A church with a bell is built within 1 mi of a fae site | Fae intensity −1 in radius, Court grievance, Piety | The fae retreat or retaliate; the bell cracks mysteriously; a schism |

### 10.4 Social (S)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| S1 | Feud turns violent | Feud pattern at step ≥ 3; alcohol; a public event | `04`, crime, cohesion | A brawl, a shooting, a trial; families taking sides; the player asked to choose |
| S2 | Elopement | Romance across a disapproving line (`04`) + a parent's blocking action | `04`, travel | The couple flees to the wilds or a fae path; a posse; a marriage that heals or deepens a feud |
| S3 | Camp meeting / revival | Church faction scheme; late summer; Piety < threshold | Piety +20, Suspicion of the uncanny +10, crowds | Conversions; temperance; a preacher who names a witch; a crowd for pickpockets |
| S4 | Barn raising / husking bee | Barn lost (fire, tornado) or harvest; cohesion > 40 | Cohesion, labor, romance, drink | A barn rebuilt in a day; courtships; a fight; a fairy fiddler shows up |
| S5 | Wedding or funeral | Sim-native: a marriage decision; a death | Gathering hub, rumors, inheritance | Feuds aired, inheritance disputes, grief beats; who attends is itself social data |
| S6 | Witch panic | Settlement fear > 70 and suspicion focused, plus an uncanny event (milk sickness, elf-shot, F2) | Alert ladder L5, `04`, the witch | A mob; a scapegoat tried, hanged, or swum; the real witch (player) exposed or saved by misattribution |
| S7 | A stranger comes to town | N7 arrival shaping, or a routine arrival with a hidden past (generated sheet with secrets) | `04`, rumors, crime | A con man, a fugitive, a long-lost relative, a witch-finder, a fae in disguise |
| S8 | Mid-run immigration wave | Prosperity high + good news back East + steamboat season | Population, land, ancestry mix, prices | A new church, a new language in the store, friction, a speculator's bonanza |

### 10.5 Economic (E)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| E1 | Ginseng rush | Dealer price high (`03`) + a rumor of rich slopes | Ecology (depletion), arrivals, trespass | Diggers flood the woods; trespass fights; slopes stripped in 2 seasons; fae of the north slopes angered |
| E2 | Mill breakdown | Mill wear + flood or drought | Flour supply, prices, the miller's mood | Long trips to the next mill; an opportunity to repair it (skill check) or invest |
| E3 | Price shock | Steamboat grounded or delayed; wheat price swing downriver | `03` prices, debt, prosperity | Hoarding, debts called, profit for the prepared |
| E4 | Bank panic / wildcat notes | Era 1857, or a T2 bank-health roll | Currency (`03`): banknotes devalue 0–100% | The player's cash is worthless; counterfeit suspicion; a run on the store |
| E5 | New lead strike | Mining scheme progress, or a player discovery | Arrivals, land, mining faction, knockers | A boom camp; claim disputes (→C4); the knockers' wrath |
| E6 | Foreclosure | Household debt > threshold + speculator scheme step | Land, grievance, emigration, `04` | An eviction; a family on the road; arson against the speculator; the player could pay the debt |
| E7 | Railroad survey | County-seat faction scheme reaches its survey step | Factions, land prices, rivalry between towns | Land prices jump along the line; a village's doom; surveyors in fae country |

### 10.6 Crime (C)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| C1 | Horse theft | An outlaw actor with a need for money + a poorly guarded horse | Crime, posse, travel | A posse; a horse-thief hanging; the player hired as tracker (→H4) |
| C2 | Counterfeit ring | Era plus a counterfeiter actor; currency trust low | `03`, crime | Bad bills in the player's purse; investigation |
| C3 | Murder | Grudge (`04`) at max + means + opportunity (alone on a road, T1) | Crime, `04`, traces (blood, grave, absence) | A body found or not; the wrong man arrested; the victim's ghost? (`01`) |
| C4 | Claim jumping | Absent claimant (the player in Faerie!) + land value up | Land, `04`, law | The player returns to find someone on their land; legal or violent resolution |
| C5 | Highway robbery | Outlaw band on a ridge road; travelers with cash at the season's market | Travel, crime | An ambush on an edge; a robbed peddler's grudge; bounty notices |
| C6 | Arson | A grievance against a faction (speculator, company) | Fire, crime, rumors | The burned office; the accused; the true arsonist knows the player saw them (a gun) |

### 10.7 Disaster (D)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| D1 | Cholera outbreak | Steamboat season + an infected arrival + contaminated water source at the landing | SEIR, deaths, fear, trade | Quarantine; flight; mass graves; the doctor's heroism or failure; a spring that never had cases (the knowledge spreads) |
| D2 | Ague season | Jun–Sep, bottomland settlers, mosquito stock | Disease, labor shortfall | Shaking fevers; quinine price spike; bottomland emigration |
| D3 | Town fire | Dry, windy + an ignition (lamp, lightning, arson) in a wooden district | Fire spread (T1 resolution on site grid), economy | Half of Main Street lost; a rebuild boom; someone was trapped |
| D4 | Mine collapse | Mine safety roll × knocker anger × blasting | Mining, deaths, trapped miners | A rescue (a T0 opportunity); dead miners; a company grievance; a newly opened cave (into Faerie?) |
| D5 | Wildfire | Drought + wind + ignition; goat prairies and logged-off slopes | Vegetation reset (prairie renewal), structures | Burned homes; goat prairie renewed; fae of the prairie strengthened |
| D6 | Milk sickness | Aug–Oct + woodland pasture with snakeroot + a dairy household | Disease, livestock "trembles," suspicion | Deaths blamed on witches or fae; a herb-wise NPC who figures it out; witch-panic fuel (→S6) |

### 10.8 Opportunity (O)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| O1 | Bounty posted | Threat ladder ≥ 4 or a sheriff's warrant | Economy, crime/ecology | Money; a target with its own goals (it may flee, ambush, or bargain) |
| O2 | Hiring call | Harvest labor demand, a logging crew, a survey party, a steamboat crew | Economy, travel, social | Wages; new companions; a trip to a far part of the map |
| O3 | Peddler with rare goods | A peddler actor's route + Director N8 | `03` catalog, rumors | A rare item; a treasure map (M-series); news from elsewhere |
| O4 | Abandoned homestead | A household emigrated or died | Land, salvage, traces | A free roof; whatever drove them off is still there |
| O5 | The doctor needs an assistant | An epidemic + a skilled player | Disease, social standing | Reputation; exposure risk; access to medicine |

### 10.9 Mysteries and treasure (M)

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| M1 | Lost lode | A rumor seeded from a real unclaimed ore cell (rumor content derives from a true fact, distorted, `04`) | Rumor, exploration, mining | The lode is real but displaced; or it's under a fae glade |
| M2 | Buried payroll | A real past event: a robbery whose loot was cached and whose robber died (event log) | Rumor, map items, crime | A treasure map from the robber's effects; other seekers |
| M3 | Lights on the bluff | Fae revel or wisp population at night, seen from a settlement | Rumor, fae, fear | Investigation → a fae revel, smugglers, or a witch's camp (yours?) |
| M4 | The barrow not on the plat map | A procedural fae barrow (never a real-world mound type) | Exploration, fae, undead | Treasure plus a curse; something now loose |
| M5 | A drowned man's map | A body recovered from the river after ice-out (W7) carries a MapItem | Map items, rumor | It leads somewhere true, as of the drowned man's knowledge |

### 10.10 Hooks (H): quest-like threads

| ID | Incident | Trigger | Touches | Outcomes |
|---|---|---|---|---|
| H1 | The miller's daughter went into the woods | Any named young actor fails to return from a woods activity (fae ring F1, pixie-led F3, elopement S2, injury, or murder C3: the real cause is in the log) | Absence trace, search party (institution), Director thread | Found alive (where? why?), found dead, found changed, or never. The Director may ripen it, but **the answer already exists** |
| H2 | The child who came back wrong | Return-of-the-lost pattern + a changeling or fae-touched flag | Fae, family, suspicion | The family's love vs. the town's fear; the real child is in Faerie |
| H3 | A debt comes due | A loan event with a due date (the player or an ally owes) | Economy, `04`, possibly the Court | Pay, flee, work it off, or bargain with someone worse |
| H4 | The sheriff needs a tracker | An unresolved crime + player Tracking notoriety (`04`) | Crime, travel | A manhunt; the quarry has a side of the story |
| H5 | Letter from back East | Mail day + a backstory element (`02`/`06` background) | Social, arrivals | A relative arrives; an inheritance; a past catches up |
| H6 | The Prince remembers | Witch mode: an old demand unmet, or adventurer mode: a fae bargain struck early in the run | Fae, callbacks | The long-fuse gun fires |

**Total: 59 incidents.**

---

## 11. The Chronicle

### 11.1 Data model

**[PROPOSAL]**

```
ChronicleEntry {
  id, date_range, source_events: EventId[], pattern?: PatternId, thread?: ThreadId,
  actors: ActorId[], places: SiteId[],
  importance: 0..1, valence: -1..1,
  voice: Journal | Paper | Almanac | Ballad,
  knowledge_basis: Witnessed | Heard(rumor_id) | Public | Omniscient(post-run only),
  text: { template_id, bindings, rendered: string },
  player_annotations?: string
}

Chronicle {
  run_id, world_seed, character, start, end?, entries[],
  annual_almanacs[], cast: ranked actors by appearance × importance,
  legacy_payload  // what persists into a later run in the same world (P5)
}
```

**Knowledge basis matters.** During a run, the Chronicle only contains what the **player character knows or what is public**. This is P1-consistent: you don't get told about the murder you didn't witness. You get the newspaper's *wrong* version of it. After death or retirement, an **Omniscient epilogue** reveals the truth: "what really happened to the miller's daughter." That reveal is a huge part of the RimWorld/DF "story to tell afterward" reward.

### 11.2 Presentation: four voices

**[PROPOSAL]**

| Voice | Covers | Style | When |
|---|---|---|---|
| **The Journal** | The player character's own experiences | First person, colored by the character's mind (traits, mood, opinions from `04`); a hard-bitten trapper and a pious Norwegian widow write differently | Auto-entries on importance ≥ 0.3; player can annotate |
| **The Paper** | Public events: crimes, deaths, markets, elections, disasters | Period newspaper clippings: headlines, small-caps, editorial bias (the paper is a faction actor with opinions!) | Weekly issue from the county seat, if it has a newspaper institution; the player can buy it, and it's also a rumor vector |
| **The Almanac** | Annual summary | Weather extremes, harvest yields, prices, births and deaths, populations ("wolves: few"), notable events; dry and statistical with a wry aside | Each Jan 1 and at run end |
| **The Ballad** | Legendary events: high importance plus high notoriety | Folk-song or tall-tale verse fragments; how the county remembers it, distortions included | When the rumor system (`04`) has carried a story widely enough to become folklore |

**Prose generation.** Templates with grammar-based variation (Tracery-like) and typed bindings are the baseline: deterministic, cheap, and testable.

**[OPEN]** Optionally, an LLM pass rewrites entries in-voice, constrained to the bound facts, for the journal and ballads. Ellie's AI expertise makes this a natural place to experiment. It must never invent facts not in `source_events`; validate by fact-extraction diffing. `07` owns the tech decision.

### 11.3 Legacy

**[PROPOSAL]** At run end, the `legacy_payload` persists into a new run in the same world (P5) and holds:

- The world state, advanced 1–20 years by a fast T2 rollout.
- The previous character as a historical actor: their grave, cabin ruin, and remembered deeds, and their ballads as rumors.
- Unresolved threads as long-fuse guns.

A new character can find the old one's journal in a trunk. That item is the Chronicle itself, rendered in the world.

---

## 12. Open Questions for Ellie

1. **[OPEN] Population scale vs. P2.** Is lazy, deterministic materialization of census households (§3.5) an acceptable reading of "everyone is a character sheet"?
2. **[OPEN] County geography.** Is the county a fantasy remap of a real county (Vernon/Crawford/Richland-like), or an original county with real Driftless physiography? How much real geography: the Mississippi, the Kickapoo, the Wisconsin River?
3. **[OPEN] Era start.** Is the run's start year selectable within 1835–1870 (with era variants like pigeon decline, railroad, wildcat banks, cholera years), or fixed?
4. **[OPEN] Fae intensity scale.** I've assumed 0–5 with specific mechanical meanings. `01` may want to define it.
5. **[OPEN] Glamour as a resource.** Should fae populations need a simulated currency (belief/offerings/glamour) that Curses produce? I recommend yes: one currency, many producers and consumers.
6. **[OPEN] Director visibility.** Should the Director's Ledger be player-visible by default, opt-in, or debug-only? I recommend opt-in ("Show the Director's hand").
7. **[OPEN] Personalities.** Do the seven names land? Should mid-run switching be allowed? Is "The Land Itself" (no Director) a first-class option?
8. **[OPEN] Witch-mode misattribution as mercy.** Is the Director tipping suspicion toward an innocent scapegoat the right moral texture for the witch fantasy, or too dark as a *system* behavior (versus a player choice via Curses)?
9. **[OPEN] Indigenous presence.** How do the Ho-Chunk and other real nations appear, if at all, and with what consultation? I've excluded them from monster and "hostile faction" mechanics and kept real mounds out of treasure systems.
10. **[OPEN] Chronicle prose.** Template-only, or a constrained LLM rewriter? This needs `07`'s input on runtime and offline-play constraints.
11. **[OPEN] Time-slip severity.** Can fae paths cost *years* (a Rip Van Winkle run that skips the world forward)? It's thematically perfect and mechanically disruptive. I propose capping it at 1d6 months outside Samhain.
12. **[OPEN] Disease lethality.** Do we use period-real fatality rates (cholera ~50%) or tune them down? I propose real rates with real, legible protections (boil water, avoid the landing in cholera summer), since P1 says model first.
13. **[OPEN] Multiple counties / travel off-map.** Is the map edge a hard wall with "off-map journeys" abstracted (go to St. Louis for 3 weeks), or are other counties future content?
14. **[OPEN] Era-accurate disappearance events.** Should elk extinction, the pigeon decline, and the wolf extirpation run on fixed historical schedules or purely from simulated pressure? I propose simulated pressure with era-weighted baselines, so a run *can* save the pigeons locally. That's a story too.
