# Coulee — Vision & Pillars

> Working title. "Coulee" is the Driftless word for the steep, narrow valleys that cut the region. Placeholder until we find something better.

**Status:** Foundational. Every other doc in this folder should agree with this one; if they disagree, this one wins until we explicitly change it.

---

## The one-sentence pitch

A simulationist fantasy-frontier adventuring game, rendered and run like RimWorld but built on the bones of a 3.5e-style Player's Handbook. You play one character in a fae-haunted alternate Driftless Region of 1800s America. The world, its people, and their relationships keep going whether or not you're watching.

## The three feelings we're chasing

1. **The catalog feeling.** You're a kid on the floor with the Player's Handbook in one hand and an outdoor-gear catalog in the other. You budget $50 between a better bedroll, a second canteen, and a hatchet. Every item is a promise of a situation you'll be ready for. Gear, spells, feats, and skills should all feel like *shopping for possibilities*.
2. **The RimWorld story feeling.** You don't "win." You keep playing because something interesting is always about to happen, and you tell people about what happened afterward. Stories come out of systems colliding, not out of a script.
3. **The campaign feeling.** It's like a good long D&D campaign: recurring NPCs who remember you, a world that reacts, rumors that get ahead of you, consequences that come back three sessions later.

## Design pillars

### P1. Simulationist first
In Forge terms we are on the Simulationist end. The rules model how the world works, and the fiction comes out of that model. When we're unsure, we ask "what would actually happen?" before "what's most fun?" We trust that a deep enough simulation produces fun, and we tune the outputs afterward.
- Corollary: **rules are legible.** Like a PHB, the game should be able to show you the math: why you failed that Climb check, why the blacksmith dislikes you. **But only the math your character could know.** Inner states and hidden facts are gated by the character's knowledge. The full truth comes out in the post-run Chronicle epilogue.

### P2. Everyone is a character sheet
NPCs run on the same rules as the player: stats, skills, inventory, needs, memories, opinions. The innkeeper has a Profession check and a grudge against her brother-in-law. No special-case NPC logic where a general rule would do. This is what lets the social sim and the off-screen life work.

### P3. The world runs off-screen
Characters keep living and relating to each other when you aren't there. Two farmers feud, a peddler spreads a rumor, a child goes missing in the woods. We get this through **level-of-detail simulation** (below). This pillar is what goes *deeper than RimWorld*: RimWorld simulates your colony, and we want to simulate the county.

### P4. One engine, two (or more) ways to play
The same world sim supports:
- **Adventurer mode:** you're a frontier adventurer who outfits in town and goes out into the faerie wilds.
- **Witch mode:** you're a witch bound to the Faerie Prince, exiled to the wilds, gaining power by cursing humans while they hunt you.
The modes differ in starting situation, goals, which factions like you, and some exclusive systems (e.g., the Curse economy). They don't differ in how the world works. If a feature only makes sense in one mode, check whether it's secretly a general system first.

### P5. Stories over victory
No win screen is required. There can be goals (ambitions, a Prince's demands, a debt to pay), but a run ends when the character **dies, retires, or departs** (becomes fae, crosses over for good), and the run's history is the reward. Plan for a **chronicle/legacy** system: a readable history of what happened, and the ability to start a new character in the same, changed world. That could be a newcomer, or any existing NPC.

### P6. Readable from above, and from a pocket
RimWorld-style presentation: technically 3D or 2.5D, simple low-poly or flat shapes, top-down camera, information-dense UI. Art should be cheap to make and clear to read. We'd rather show a lot of state clearly than a little state beautifully.
- **[DECISION, Ellie 2026-10-10] Fully playable on phones**, through a **"pocket" interface**, with desktop as an equal target. That means:
  - The pocket interface is a real interface designed for thumbs and short sessions, not a shrunken desktop UI.
  - Desktop gets the dense, multi-panel RimWorld layout.
  - Both run the same game. See `11-interface-and-platforms.md`.

### P7. The psyche is the alignment system
**[DECISION, Ellie 2026-10-10]** We don't use D&D alignment. Characters' inner lives use a **Freudian/Jungian** model, a deliberate thematic swing. Full treatment in `10-psyche.md`. Canonical sketch:
- **Freud (structural model) drives the thoughts system.**
  - Every Thought is voiced by the **Id** (appetite, impulse, fear, desire) or the **Superego** (conscience, shame, internalized community and church norms).
  - The **Ego** arbitrates between them. **Ego strength** works like a stat.
  - Unresolved conflict produces **anxiety**, which the mind discharges through **defense mechanisms**: repression, projection, displacement, rationalization, sublimation, denial, reaction formation.
  - Defenses are social-sim engines. Projection and displacement are how a frightened village picks a scapegoat.
- **Jung supplies the deep layer.**
  - **Persona:** the public mask, versus the private self.
  - **Shadow:** disowned traits, which resonates on purpose with shadow-faekin.
  - **Archetypes and complexes:** recurring patterns that shape behavior and story roles.
  - **Collective unconscious:** dreams, which is where Faerie can reach people.
- **Cosmological hook [PROPOSAL]:** Faerie is the land's Id, the Ice is its Superego, and the settled, surveyed world is the Ego struggling between them.
- **Period framing [PROPOSAL]:** Freud and Jung are 40–60 years in the future in 1855. In-world, this "mental philosophy" belongs to the era of mesmerism, phrenology, and Swedenborgian spiritualism, and the UI can use period-flavored labels over the clinical ones.

### P8. Crunch you can pack
**[DECISION, Ellie 2026-10-10]** The player has to *keep track of things*: different kinds of food, camp rations, fuel, powder and shot, lamp oil, medicine, spare socks. There should be lots of crunch, and it has to **make a meaningful difference**. That's what pays off the catalog-as-a-kid feeling: specifics matter because the world checks them. Concretely:
- **Food is not one number.** Each foodstuff has weight, bulk, calories, a nutrition profile (at least: calories, protein/fat, and a "fresh" factor guarding against scurvy and monotony), shelf life and **spoilage** (driven by temperature, wetness, and packaging), and **preparation requirements** (raw-edible, needs cooking, needs water, needs fire and fuel and a pot). Hardtack, pemmican, salt pork, parched corn, cornmeal, dried apples, coffee, sugar, tinned oysters, fresh trout, and morels should all feel different to carry and to live on.
- **Consumables run out on a schedule you can plan against.** That means meals per day, fuel per fire, caps per shot, oil per night of lamplight, and so on. The UI has to make the planning legible: days of food at current rations, what spoils first, weight and bulk tradeoffs.
- **Packaging and storage are gear:** tins, oilcloth, crocks, a smokehouse, a root cellar.
- **NPCs live by the same rules (P2).** Households have pantries, a hard winter empties them, and a ruined harvest or a cursed root cellar is a real, simulated catastrophe.
- **Crunch must stay legible (P1).** It's never a hidden penalty. A greenhorn may misjudge it (see 03's Readiness panel), but the game can always show its work.

## Setting in brief
(Full treatment: `01-setting.md`)

- **Place:** A fantasy reimagining of the Driftless Area of SW Wisconsin and the bordering corners of MN, IA, and IL. It's the part of the upper Midwest the glaciers never flattened: steep wooded coulees, dolomite-capped sandstone bluffs, goat prairies, spring-fed trout streams, sinkholes, caves, and the big river. The starter county is the fictional **Hollin County** (proposal, see 01), set on the real rivers. **Lore hook (proposal, refined in 01):** the **Glacier Compact**. The Ice bargained with Faerie and went around, so the Driftless is where Faerie never left, and the Ice remains a dormant third power.
- **Era/tech:** **The game starts in spring 1855** (revised: setting and economy docs both needed a pinned year for prices and politics, and 1855 is pre–Civil War). The broader feel is the 1840s–60s American frontier. Black-powder firearms exist but are slow and expensive. Steamboats on the river, a few mills, lead mining, logging. It's not steampunk, and it's deliberately *de-cowboy-ized*: the feel is more homesteads, river towns, mines, and German/Norwegian/Cornish/Yankee settlers than cattle and six-shooters. D&D tropes such as wizards, clerics, monsters, and dungeons (which are caves and old mines here) sit inside this.
- **Currency:** Dollars and cents. Prices should feel like a period catalog.
- **Peoples [DECISION, Ellie 2026-10-10]:** four playable peoples. Full treatment in `12-peoples.md`.
  - **Humans:** the settler majority.
  - **Elves:** part of "the civilized world of humans and elves." They're established and coexist with human society.
  - **Shadow-faekin:** *hidden*, and somewhere between humans and elves. Being hidden is the point: concealment, passing, and discovery are first-class social-sim material, since actors hold **beliefs** about who is faekin.
  - **Goblins.**
  The engine still treats ancestry as data (no hardcoded peoples in sim code), but these four are canon.
- **The wilds are Faerie, to varying degrees.** The main wilderness isn't just "forest with wolves." It's the edge of a fae realm with its own courts, bargains, rules, and logic. Not all wilderness is equally fae: **Fae intensity (0–5)** is a per-tile field with a map-level baseline. It changes over time: surveys, iron, bells, and newspapers lower it; fear, bargains, and grudges raise it.

## Core structural decisions

These are the decisions the detailed docs build on. Each one can be challenged, but it should be challenged on purpose.

### Single protagonist (for now)
The player controls one character directly. Companions, hirelings, and familiars may exist as semi-autonomous actors the player influences but doesn't micromanage. The architecture should not *prevent* a party or colony later.

### Two map scales
- **Region map:** the county-scale overworld. It's a graph or hex map of coulees, ridges, river bottoms, towns, farms, and fae sites. Overland travel happens here and takes hours or days.
- **Site maps:** RimWorld-style tile maps generated or loaded when you're physically somewhere: a camp, a town, a cave, a fae glade. Moment-to-moment play and tactical combat happen here.

### Level-of-detail (LOD) simulation
| Tier | Where | Fidelity | Tick |
|---|---|---|---|
| **T0 – Live** | The site map the player is on | Full: pathing, needs, every action, real-time-with-pause | Sub-second game ticks |
| **T1 – Nearby** | Sites and actors within some radius / recently relevant | Abstracted: actors resolve "activities" (work the farm, go to the tavern, visit X) and social interactions as rolled events | Game-hours |
| **T2 – Distant** | Rest of the region | Statistical: settlement-level economics, rumor diffusion, faction moods, population changes | Game-days |
**Revisions from the detailed docs:**
- Tier is set by **relevance to the player** (pursuers, rivals, kin, grudge-holders) as well as distance. A posse hunting you stays high-fidelity even when it's far away.
- T2 still keeps **coarse, lazily updated per-actor minds**, so a distant grudge doesn't dissolve into a statistic. A T2 tick is daily for economics, with ~6-hour sub-steps for weather and rumor.
- **Census materialization:** the population exists as a census, and individual sheets are **lazily and deterministically materialized** when needed. Every actor is still a character sheet; most of them just haven't been written down yet.

An actor moving between tiers must keep consistent state. When the player arrives at a T1 site, it gets promoted to T0 and has to look like the place that was being simulated. This is a key technical risk. See `07-architecture-and-prototype.md`.

### Time
Real-time-with-pause on site maps, with speed controls like RimWorld. Overland travel compresses time. The calendar matters: seasons (Driftless winters are brutal), moon phases (fae logic), weekdays/Sabbath (town logic), and harvest cycles.

### D&D 3.5 as ancestor, not as license
We borrow 3.5e's *shape*: six ability scores, skill ranks, feats as discrete purchasable options, d20 + modifier vs. DC, spells as a catalog, classes or class-like progression, and a long equipment list with weights and prices. We do **not** copy text or proprietary specifics, and we freely change rules that don't serve a real-time simulation (e.g., per-round action economy may become a timed-action system). See `02-rules-and-characters.md`.

### Storyteller
Like RimWorld's AI storytellers, a **director** watches the world state and pacing and injects or encourages events. It should prefer to **nudge the simulation** (make a wolf pack hungrier, make a rumor spread) over dropping in events from nowhere. See `05-world-sim-and-storyteller.md`.

## Shared vocabulary

Every doc uses these terms with these meanings.

- **Actor:** any simulated being with a character sheet (people, notable animals, fae).
- **Sheet:** an actor's rules-state: abilities, skills, feats, conditions, inventory.
- **Mind:** an actor's psychological state: needs, mood, traits, memories, opinions, goals.
- **Memory:** a stored record of an event from one actor's perspective, possibly distorted. It decays over time.
- **Opinion:** one actor's directed, multi-dimensional attitude toward another actor (or faction).
- **Rumor:** a transmissible claim about the world that moves between actors through social contact and can mutate along the way.
- **Belief:** an actor's held claim about a fact, with credence and supporting evidence. Actors act on beliefs, never on ground truth.
- **Figure:** an identity that rumors attach to ("the Bluff Witch," "the stranger who killed the hodag"), which may or may not be correctly linked to a real actor. (Renamed from "Persona" so that word can keep its Jungian meaning.)
- **Persona (Jungian):** the public mask an actor presents, as distinct from their private self. See `10-psyche.md`.
- **Id / Ego / Superego:** the three agencies of the psyche. Thoughts are voiced by Id or Superego, and the Ego arbitrates. See P7 and `10-psyche.md`.
- **Defense:** a defense mechanism, i.e. how a mind discharges anxiety from Id/Superego conflict (projection, displacement, etc.). Defenses produce social behavior.
- **Shadow:** an actor's disowned traits (Jungian). Not to be confused with **shadow-faekin**, the people, though the echo is deliberate.
- **Grudge:** a strong, durable negative opinion tied to specific memories, which drives goal-directed hostile behavior. Grudges are first-class objects and can target an actor, a household, a Figure, or an unknown culprit.
- **Notoriety:** how widely and how vividly an actor or Figure is known in a community.
- **Reputation:** the valenced content of what a community believes about an actor or Figure.
- **Settlement / Hearth:** a human (or other people's) community site: town, village, farmstead cluster.
- **The Wilds / Faerie:** fae-influenced wilderness. It has **Fae intensity** (how strongly fae logic applies) as a map property.
- **Court:** a fae political faction. The **Faerie Prince** heads the one that conscripts the witch.
- **Site:** any location that can become a site map.
- **Activity:** a T1 abstracted unit of what an actor is doing over a block of time.
- **Director:** the storyteller system.
- **Chronicle:** the generated, readable history of a run.
- **Curse:** a magical act of harm. It's a general system any qualified actor can use (NPC witches exist in adventurer mode), but it's central to witch mode.
- **Woe:** witch power harvested from victims' minds (roughly suffering × belief × attribution). See 06.
- **Tithe:** the Faerie Prince's periodic cut of a witch's Woe.
- **Gleaning:** a witch claiming Woe from misfortune she didn't cause.
- **Drift:** a universal 0–100 measure of an actor becoming fae. At 100, they depart.
- **Vigor / Wounds:** Vigor is HP-like stamina and luck. Wounds are persistent, located injuries (see 02).
- **Director's Ledger:** the log of every nudge the director made, for debugging and the epilogue.
- **Outfitter:** the frontier store where adventurer mode begins, and the main "catalog" shopping experience.

## Doc map

| File | Covers |
|---|---|
| `00-vision-and-pillars.md` | This document |
| `01-setting.md` | The world: geography, history, the four peoples in setting context, factions, Faerie, towns, tone (Hollin County is the flavor bible and constraint set for generated counties, ADR 0003) |
| `02-rules-and-characters.md` | Abilities, skills, feats, classes/progression, checks, combat, magic, conditions, health/injury |
| `03-gear-and-economy.md` | Items, the Outfitter, the catalog experience, encumbrance, durability, prices, trade |
| `04-social-simulation.md` | Minds, memory, opinion, relationships, rumors, grudges, off-screen social life |
| `05-world-sim-and-storyteller.md` | LOD sim, ecology, weather/seasons, survival, the director, event design |
| `06-game-modes.md` | Adventurer and Witch modes: loops, goals, progression, mode-exclusive systems |
| `07-architecture-and-prototype.md` | Tech stack, data model, sim architecture, milestones, first vertical slice |
| `08-open-questions.md` | Decisions waiting on Ellie, consolidated |
| `09-consistency-notes.md` | Cross-doc conflicts and how they were (or should be) resolved |
| `10-psyche.md` | Freudian/Jungian mind model: Id/Ego/Superego thoughts, defenses, Persona/Shadow, archetypes, dreams |
| `11-interface-and-platforms.md` | Pocket (phone) and desktop interfaces, touch controls, PWA/app packaging |
| `12-peoples.md` | Humans, elves, shadow-faekin, goblins |
| `13-fae-magic-charms-and-omens.md` | Omens and signs, fae magic anyone can learn, fae charms as items and as settlement-disrupting artifacts |
| `adr/` | Architecture decision records (e.g., `0001-typescript-stack.md`) |

## Decisions log
- **2026-10-10 (Ellie):**
  - TypeScript implementation; the runner-up from 07 becomes the plan. See `adr/0001-typescript-stack.md`.
  - Fully playable on mobile with a "pocket" interface, with desktop also targeted.
  - Freud/Jung psyche replaces alignment.
  - Peoples are humans, elves, shadow-faekin, and goblins.
  - Blender for placeholder art.
  - Lots of meaningful supply crunch: food types, rations, consumables (P8).
  - **Procedural world generation** is the target (terrain, settlements, population, pre-play history). Hand-authored scenarios are kept as fixtures and curated seeds. See `adr/0003-procedural-world-generation.md`.
  - A **headless play mode** so AI agents can playtest without the UI. Every milestone includes agent playtesting, and every UI action must also be a headless Command. See `adr/0002-headless-play-and-agent-playtesting.md`.
- **2026-10-11 (Ellie):**
  - **PC agency: high agency for now (answers 08 Q05).** The player character acts only on the player's Commands plus routine standing orders (sleep, eat from own stores, keep warm). The psyche still voices Id/Superego thoughts, Self-Command still arbitrates, and overriding still costs anxiety, but consequential autonomous acts (spending, hostility, gifts, courting) never happen without an order. **Keep it flexible:** implement it as an **agency mode** on an actor's psyche (`commanded` / `psyche` / later `fits` or a player toggle), a sheet property any actor can have (P2: e.g., a fae-charmed NPC can be put under command). It must not be a branch on `controller`.
  - **P8 pressure comes from logistics, not prices.** 1855 staples stay period-cheap. The crunch comes from weight, bulk, fuel, water, spoilage, nutrition/scurvy, gear, and trips where you can't buy. The Outfitter stocks the 03 catalog, including camping gear.
  - **Fae omens, fae magic for anyone, and disruptive fae artifacts.**
    - **Omens and signs** are keyed to the fae intensity field.
    - **Learning fae magic is something anyone can theoretically do**: human, elf, goblin, faekin, at a cost.
    - **Fae artifacts and charms find their way into mortal settlements and disrupt them.** A single wondrous, useful thing arrives in a town and reshapes desire, envy, ownership, rumor, faith and feud around itself; the town's story becomes the object's story.
    - The touchpoint is the "object falls from the sky" premise of *The Gods Must Be Crazy*, used only as a narrative shape and **not** homaged. Avoid its colonial/primitivist framing: every people here is equally sophisticated, and the charm disrupts *because* it is genuinely useful and genuinely strange.
    - Charms are also **real gameplay items** for the PC, with uses, costs and consequences. See `13-fae-magic-charms-and-omens.md`.
  - **Doc 13's thirteen recommendations are approved** (13 §10). These include:
    - the **conservation rule**: no fae effect creates kcal, cents or stacks, only moves or borrows them;
    - Fae Courtesy as the working check;
    - the Tally as an Obligation-ledger debt;
    - debt as the road to the Witch's Debt Origin;
    - `capped` fae compulsion on the PC by default;
    - charms working at FI 0 and thinning their town;
    - Director windfalls only from pre-existing reservoir charms;
    - about one county charm thread every 6–8 weeks;
    - the Cold Stair at FI 1 (algific);
    - heavy strings behind World toggles;
    - one secondhand charm at a time under the store counter.
  - **Forfeit Rule and charms (13 §1.1):** whether a charm's harm to third parties is the human keeper's act or fae harm is **per-charm data** (`harm_basis = instrument | fae`).
- **2026-10-12 (Ellie):**
  - **Art direction: a somewhat crude but attractive watercolor painting.** It applies to the "second pass" visual work: whenever placeholder assets are replaced or new ones made, and whenever graphics effects or styling are optimized or added.
    - Visible brush texture, soft bleeding edges, paper grain, and a limited, slightly washed palette.
    - Hand-made rather than photoreal or clean vector.
    - It must stay legible from above and in a pocket (P6).
    - Until that pass, placeholder Blender art and the current UI styling stand.
  - **Queued features** (after the current backlog clears; see `docs/impl/BACKLOG.md`):
    - **Parties.** The player recruits companions, and NPCs form parties emergently, including hunts for the witch, for other witches, or for fae.
    - **Elevation.** Underground and building floors, with the RimWorld-style top-down view kept most of the time. Things flying overhead (birds, someday airships), a camera that can tilt up to the sky, and a simulated night sky with fictional constellations and astrological meaning.
  - **Fae slice 1b design calls:**
    - **Butter on credit:** yes. The poorest households can buy the sack's feeding makings on ordinary store credit.
    - **Loan due dates missed because the lender's household is at church or out:** accepted as texture (13 §8.2 criterion 5's residual breaches stand).
    - **Keeper at the attachment cap (Ellie delegated: "the option that leads to the most interesting gameplay outcomes"):** a keeper may refuse, but refusal has costs on both sides.
      - **The keeper:** an honest keeper accrues duty-guilt with each refusal (scaled by honesty) until they lend, so they end up running a rota. A dishonest keeper feels little and hoards.
      - **Refused neighbors:** opinion falls and covetousness rises, gossip spreads ("sits on plenty while others go short"), and desperation acts follow, so a hoarder ends in a feud or a theft.
      - Refusal becomes a story, not a stall.
- **2026-10-13 (Ellie; 08 items 11–13 and 15):**
  - **Sub-hour actions: a minute budget per hour.** Short acts (a walk under about 15 minutes, a purchase line, a chat) chain within the hour, while the sim still ticks hourly. Settings changes cost no time. This amends ADR 0002.
  - **Newcomer income: day labor and piece rates.** Hiring on goes through the ordinary social and economy rules (ask an employer; daily or weekly wages to the purse). The store pays piece rates for wood, fish and furs. P8 pressure stays on logistics.
  - **Others' opinions of you:** a perception-gated "seems to feel about you" line on `inspect`, with a coarse band and the visible reasons, never the number.
  - **M6 combat defaults approved** (Q04 and the M6 plan §7):
    - a tenth-second tactical clock with auto-pause and auto-Tactical;
    - a level-1 musket hit can kill, with an explicit Dying/stabilization state, no protagonist protection, and lethality distributions shown before final tuning;
    - Vigor stays until M7;
    - a three-gun retained-charge misfire subset;
    - a minimal inquiry/arrest/hearing loop.
  - Item 14 (M5 travel defaults) was not overridden, so slice 2 proceeds on them.
  - **The storyteller (Director, 05 §8; `docs/impl/DIRECTOR-PLAN.md`):** queued, with D0 (measurement) started.
    - **Witch-mode misattribution (05 Q8):** yes, as system behavior, within 05 §8.9's guardrails.
    - **The unconscious (C55):** the Director may read unconscious states (anxiety near thresholds, a charged Shadow, defenses that fired) to time stressors. It never writes psyche state.
    - **Foresight:** by default the Director may look ahead only on unseen counter-based rolls it is allowed to tilt, choosing threads before it looks. This is an **optional setting** per run (off / tiltable-only (default) / full), recorded in the manifest and the Ledger.

## Things Ellie has said she'll decide later
- ~~The roster of fantasy peoples/ancestries~~ (decided 2026-10-10: humans, elves, shadow-faekin, goblins). Fuller lore for each people is still to come from Ellie.
- (Add as they come up.)
