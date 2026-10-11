# 01 — Setting

> Companion to `00-vision-and-pillars.md`, which wins in any conflict. Tags: **[DECISION]** from 00, the ADRs, or Ellie · **[PROPOSAL]** needs Ellie's sign-off · **[OPEN]** unresolved. Where I think 00 should change, I say so in a marked **Challenge to 00** box.

> **Revision 2026-10-10.** Brought into line with 00's second revision, `adr/0001` and `adr/0003`, Ellie's decisions of the same date, the ownership calls in `09`, and the new docs `10-psyche`, `11-interface-and-platforms`, `12-peoples`. Section numbers are unchanged so existing cross-references still hold. What changed:
> - **Peoples (§6, rewritten).** The "structural slots only" section is now the roster: humans, elves, shadow-faekin, goblins. Ellie's one-liners are **[DECISION]**; all lore beyond them lives in `12` and is **[PROPOSAL]**. The slot analysis and cautions stay, now with a "filled by" column. New hooks for peoples in §4.3 (court postures), §4.5 (fae rules), §5.1–5.2 (settlements, Halls, Clubs), §7 (bestiary overlap with goblins and changelings), §8 (cast and places).
> - **Psyche (§4.7, new).** Faerie as the land's Id, the Ice as its Superego, the settled world as the Ego, as a cross-reference to `10` §11. Fae minds (Id plus Law, no Ego), dreams as Faerie's channel, and the witch's introjected Prince are summarized where they touch the lore (§4.2, §4.4, §4.5, §4.6, §7 #7).
> - **"Drift" collision (C11).** The Ice is no longer "the Drift." **Drift** now means only 00's 0–100 measure of becoming fae (`06`). Drift-wights are now **erratics**.
> - **Rules scoped.** The harm rule is now the **Forfeit Rule** with per-court scope (C14, §4.5). Grudges founded on the uncanny don't decay (C12, §4.4). The Prince has a fixed core and a per-World overlay (C15). The witch's weaknesses are owned by `06`, keyed to Drift and the pact, with `03`'s Iron Presence as input (C27/C28, §4.5). Fae "cannot lie" becomes sincere-but-fallible (`10` §10).
> - **Native nations (C10, §1.5, §2).** Fixed a slip in the translation table (rockshelter "old marks"), added principles on rock art, found stone tools, and worldgen, a sovereign-neighbor sketch for Option C (§2.4), and a downstream fix list for the other docs.
> - **Law and persecution (C13, C41, §5.4, §5.6).** `04` §9 owns the ladder (rungs 0–6); `06`'s witch labels map onto it. With no witchcraft statute, "trial" rungs mean mundane charges, church discipline, or mob action.
> - **Magic traditions (C17, §5.3).** Framing-to-class mapping for `02`; the Fae-intensity curve stated for `02` to adopt.
> - **Scale and generation (C7, C8, C9, §3.2, §8).** Hollin County sized to `05`/`11`'s Standard World, with the county seat on-map and the land office off-map. Under ADR 0003, §8 is the **flavor bible and constraint set** for generated counties, with Iron Ford as the authored fixture. A names crosswalk for the C7 pass.
> - **Calendar fix (§3.1).** Start year 1855 is now a **[DECISION]**; only the Civil War question stays open. Added the 1854–55 politics. Fae festival names stay the settlers' (C19).
> - **P8 supply texture (§5.7, new).** Setting-side hooks for the supply crunch.
> - **Tone.** Period psyche vocabulary, no therapy-speak, a no-tropes list for peoples (§9). Challenges to 00 updated (§10), open questions renumbered additively (§11).
> - **Implementation notes (§12, new)** on where the code differs.
> - **09 items assigned to 01, 01's side done:** C5, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, C18, C19, C27/C28 (iron and the witch), C41. **Advanced, needing action elsewhere:** C7 (crosswalk in §8.4; the names pass itself is in `02`–`06`), C26 (hospitality row), C47 and C48 (cross-referenced in §5.2, §6.3). The edits other docs owe are listed in §2.4 (C10) and the **Remaining** notes in §10.
> - **Checked and clean:** no Rust/Godot, alignment, exp/log formulas, or "Persona" as rumor identity were present. Rumor identity is written "Figure" wherever it appears now (§5.6).

---

## 0. The setting in nine lines

1. **[DECISION]** A fae-haunted alternate Driftless with the feel of the 1840s–60s American frontier (00): dollars, black powder, steamboats, lead diggings, and homesteads. No cowboys and no steampunk.
2. **[DECISION]** **The game starts in spring 1855** (00). **[PROPOSAL]** The default county is the fictional Hollin County on real rivers, with real towns off-map as distant cities. Under ADR 0003 it is a flavor bible for generated counties, with Iron Ford as the authored fixture (§8).
3. **[PROPOSAL]** **The Glacier Compact.** The Ice didn't simply refuse to trespass. It made a bargain with Faerie and went around. The Ice is a dormant third party that still keeps the terms. (In this doc "the Ice" is the sovereign. **Drift** is 00's measure of becoming fae.)
4. **[PROPOSAL]** **Faerie lives on the uncanny.** Its hold on a place is measured by how strange that place still is to the humans who live near it. Survey lines, iron, plows, bells, and newspapers wear it down. Fear, bargains, and grudges build it up.
5. **[PROPOSAL]** **The Faerie Prince is a zealot, not a sadist.** He believes that settlement is about to destroy the land, and he's partly right. Human suffering is his tool because grudges are the only human memories that don't fade.
6. **[PROPOSAL]** **Three magic traditions, sorted by class and legitimacy:** congregational clerics, lyceum-and-survey wizards, and folk practitioners (braucher, cunning folk, pellars). The witch-panic lives in the gap between the folk healer and the witch.
7. **[PROPOSAL]** **Native nations are present as political actors** on the same sheets and minds as everyone else. They're never fae stand-ins or monsters, and their sacred beings and sites don't become game content. Ellie picks how close to history we go (§2).
8. **[PROPOSAL]** **Persecution of witches is extralegal.** The territorial and state law doesn't recognize witchcraft. Mobs, charivari, vigilance committees, and private bounties do the hunting, and the sheriff may be the witch's unlikely protector.
9. **[DECISION]** **Four peoples: humans, elves, shadow-faekin, and goblins** (Ellie, 2026-10-10). Elves are part of "the civilized world of humans and elves." Shadow-faekin are hidden and somewhere between humans and elves. Goblins exist. **[PROPOSAL]** Everything beyond those one-liners (renouncer elves, the Unrenounced, the Deep Accord) is in `12` and is open to Ellie's own lore (§6).

---

## 1. The real Driftless, as raw material

### 1.1 Landform and rock

- **Extent.** The Driftless covers SW Wisconsin plus slivers of SE Minnesota, NE Iowa, and NW Illinois. It's roughly 16,000 sq mi on a strict reading and more on a generous one. The region shows no sign of the last (Wisconsin) glaciation's drift: no till, no moraines, no kettle lakes, no erratic boulders. (Some margins carry traces of much older glaciations, and geologists argue about the edges.) The real reason it escaped is that northern highlands and the Lake Superior basin split the advancing ice into lobes, which flowed around it on both sides.
- **The rock is a layer cake of Paleozoic sediments.** Cambrian sandstones are soft and form cliffs, rock shelters, pillars, and natural bridges. Above them, Ordovician dolomite (the Prairie du Chien Group) caps the ridges, with St. Peter sandstone and then the Platteville and Galena dolomites in the south. Locals call the dolomite "limestone." In-world characters should too, but a geologist NPC would correct them.
- **Topography is inverted from what newcomers expect.** Roads, farms, and towns sit on the *flat ridgetops*. The *coulees* (steep, branching, dead-end valleys) cut down hundreds of feet to stream bottoms. Ridge roads are dry and fast. Coulee bottoms are fertile, foggy, frost-prone, and flood-prone.
- **Bluffs** line the Mississippi at 400–600 ft, with dolomite caps over sandstone faces. The Wisconsin River valley has broad sandy terraces, braided channels, and sandbars.
- **Karst.** Dolomite dissolves, so the landscape has sinkholes, losing streams, springs, and caves. Some springs run cold and steady all year and keep water open in January.
- **Algific talus slopes** are a weird and perfect detail. On certain north-facing slopes, ice trapped in fissures exhales cold air all summer. They hold relict Ice Age species, such as the Iowa Pleistocene snail and northern monkshood. Summer frost on these slopes is a real feature.
- **Sandstone oddities** include hoodoos and pillars, rockshelters, and natural bridges. Glacial Lake Wisconsin sat on the eastern edge, and when its ice dam failed near the end of the last glaciation, the outflow cut the Wisconsin Dells.

### 1.2 Water

- **The Mississippi** in the 1850s ran without locks and dams (those came in the 1930s). It was shallower and braided, full of sloughs, backwaters, islands, and snags, and it froze in winter. **Lake Pepin** is a natural widening of the river, dammed by the Chippewa River's sediment fan. **Trempealeau Mountain** is a bluff that stands as an island in the river.
- **The Wisconsin River** is the old voyageur route via the Fox–Wisconsin portage. It carried log and lumber rafts from the northern pineries, and it's famous for shifting sandbars.
- **The Kickapoo** is notoriously crooked, covering roughly twice the distance its valley does. It floods hard, and its wooded valley is deep and narrow. The name is usually glossed as Algonquian for "one who goes here, then there." Treat that gloss as folk etymology.
- **Smaller rivers** include the Bad Axe, Root, Upper Iowa, Turkey, Trempealeau, Black, Baraboo, Pecatonica, Platte, Grant, and Galena (once called the Fever River).
- **Trout streams.** Spring-fed coldwater creeks run in nearly every coulee. Brook trout are native. Brown trout weren't introduced until the 1880s, so in 1855 a fishing NPC catches brookies only.

### 1.3 Ecology circa 1855

- **Vegetation mosaic.** Oak savanna (bur and white oak) covers the ridges and sunny slopes and is kept open by fire. *Goat prairies* grow on steep south- and southwest-facing bluffs: hot, dry, fire-maintained, with little bluestem and pasqueflower, and home to timber rattlesnakes. North slopes and coves hold maple–basswood forest, with relict white pine and hemlock in cool sandstone gorges. River bottoms hold silver maple, cottonwood, and wet prairie.
- **Fauna still present** include wolves, black bear, cougar, elk (declining, gone by the 1870s), beaver, otter, timber rattlesnake and massasauga, and wild turkey. **Passenger pigeons** came in apocalyptic numbers. The 1871 nesting in central Wisconsin covered roughly 850 square miles. Bison were already gone from the region.
- **Foraging and trade goods** include **wild ginseng** (a real Driftless cash crop, dug and sold for the China trade), goldenseal, morels, ramps, black walnut, butternut, hickory nuts, wild plums, and maple sugar.
- **Climate.** Winters are brutal, with −30°F snaps and ridge-top blizzards. Cold air pools in coulee bottoms, so frost hits there first. Fog fills the coulees at dawn. Summer thunderstorms bring flash floods down the coulees, and spring brings mud.

### 1.4 Human history (compressed)

| When | What |
|---|---|
| c. 700–1100 CE | Late Woodland peoples build **effigy mounds**: birds, bears, long-tailed "water spirit" or panther forms, and linear and conical mounds. Wisconsin once held an estimated 15,000+ mounds, and most were later plowed or built over. Man Mound near Baraboo is the only surviving human-form effigy. Effigy Mounds National Monument in NE Iowa preserves a large group. The Ho-Chunk and other nations regard them as ancestral and sacred. |
| 1600s–1700s | French fur trade arrives. **Prairie du Chien** becomes a multinational trading town. Métis families form. |
| 1788 | Julien Dubuque mines lead by agreement with the **Meskwaki**, who already mined and traded it. |
| 1820s | **Lead rush.** Galena booms. Southern miners arrive, some bringing enslaved people (Henry Dodge held enslaved workers at his diggings into the 1830s). Miners live in hillside dugouts. "Badgers" is the usual story behind the nickname, and "Suckers" were the Illinoisans who went home for the winter. |
| 1825, 1829 | Treaties of Prairie du Chien. The Ho-Chunk cede the lead region under heavy pressure from illegal miners. |
| 1832 | **Black Hawk War.** Black Hawk's band of Sauk, Meskwaki, and Kickapoo people, including many women and children, recrosses into Illinois and is pursued by regulars and militia (a young Lincoln among them). The pursuit runs through the Driftless to the Battle of Wisconsin Heights and ends in the **Bad Axe Massacre** at the mouth of the Bad Axe River, where the steamboat *Warrior* fired on people trying to cross. Dakota allies of the US killed many who made it to the west bank. |
| 1830s–40s | **Cornish miners** come to Mineral Point and build stone cottages along Shake Rag Street. They bring pasties, Methodism, deep-mining skill, and knockers. A federal **land office** opens at Mineral Point in 1834. The Military Road is built through Blue Mounds in the late 1830s. The **Tower Hill shot tower** near Helena drops molten lead down a shaft cut into a sandstone bluff. |
| 1836–48 | Wisconsin Territory, with its first capital at Belmont. In **1837** the Ho-Chunk "treaty" is signed by a delegation without authority to cede land. The Ho-Chunk then face **repeated removals**: to the Iowa Neutral Ground in 1840, to Minnesota in the late 1840s and 1855, and after 1862 to Crow Creek in Dakota Territory and then Nebraska. Many Ho-Chunk kept returning to Wisconsin, refused to leave, or bought land. |
| 1845 | Swiss settlers found New Glarus. |
| 1848 | Statehood. Germans arrive after the failed 1848 revolutions (the "Forty-Eighters"), and in 1852 Sauk City founds the oldest freethinker congregation in the US. **Norwegian** settlement fills the Coon Valley and Vernon County ridges. Free Black and formerly enslaved settlers found **Pleasant Ridge** (Grant County, c. 1850) and **Cheyenne Valley** (Vernon County, 1850s). Both had integrated churches and schools. |
| 1849–50s | Many lead miners leave for the California gold rush. Wheat boom. Land sells at $1.25/acre at the land office, and claim clubs defend squatters at the auctions. |
| 1857 | The railroad reaches Prairie du Chien. Panic of 1857 and wildcat-bank failures. The Meskwaki *buy* land at Tama, Iowa rather than accept a reservation. |
| 1861–65 | Civil War. Wisconsin sends tens of thousands of men, and there are draft riots in 1862. The **US–Dakota War** of 1862 in Minnesota is followed by mass execution and expulsion. |
| 1860s–70s | Zinc ("dry bone") mining replaces lead. Wheat fails and the region shifts to dairy. Plowing the slopes starts the erosion that becomes catastrophic in the 20th century, which is why Coon Creek later hosts the first federal soil-conservation project. |

### 1.5 Translation table: real → fantasy → gameplay

| Real element | Fantasy version | Site maps suggested | Hazards | Resources |
|---|---|---|---|---|
| **Ridgetop** | Human ground. Roads, farms, churches. Low Fae intensity. | Farmstead, crossroads, ridge village | Blizzard exposure, lightning, ridge-road robbers | Grain, livestock, trade, shelter |
| **Coulee** | The gradient into Faerie. Intensity rises toward the coulee head. | Branching valley with stream, side-coves, and a spring at the head. Generated as a dead-end tree. | Fog, frost pockets, flash floods, being pixie-led, ambush from both slopes | Water, game, ginseng, hardwood, fae trade |
| **Goat prairie** | Liminal sun-ground, open and exposed. Fae revels at dusk. | Steep grass slope with rock outcrops, overlooking a coulee | Rattlesnakes, prairie fire, falls, revels | Medicinal herbs, vantage, snake venom |
| **Bluff / cliff** | Sandstone faces hold rockshelters. Some pillars are petrified trolls (a Norwegian import; §7 #16). **Real rockshelters can carry rock art and old occupation deposits that belong to Native history, not to Faerie, so generated shelters are camp-and-cold-storage terrain only (§2.1 #4).** | Cliff face plus talus plus shelter | Falls, rockfall, troll thaw at dusk | Camp shelter, lookouts, honey trees |
| **Sinkhole** | A door. Some are just holes. Some go *down* into the Under-Court. | Funnel with debris and possibly a cave mouth | Collapse, bad air, falls, things climbing out | Cave access, cold storage |
| **Cave** | Dungeon equivalent, bounded by the rules of the Under-Court. Fae relics are fae-made (thorn, bone-white glass, tarnished fairy coin), never stone tools or anything from a burial (§2.1 #4). | Multi-level cave tile map: water, squeezes, chambers | Darkness, flooding, getting lost, knockers, cold | Saltpeter (black powder!), crystals, fae relics, lost miners' gear |
| **Algific slope** | "Cold stairs." Places where the Ice still breathes and Faerie is weak. | North-slope talus with frost in July | Hypothermia in summer, erratics | Relict herbs, ice (sellable in summer), a refuge *from* fae |
| **Spring** | The strongest fae anchors. Every big spring has a tenant. | Spring pool, spring house, millrace | Nøkk, drowning, bargains | Clean water, healing herbs, fae audience |
| **Trout stream** | Running water is a fae barrier and a road for water-fae | Stream corridor with fords | Cold water, crossing checks, nøkk | Trout, crayfish, water-powered mills |
| **Mississippi** | The great boundary. Faerie thins west of it, but the river has its own drowned society. | Landing, ferry, slough maze, island, steamboat deck | Snags, ice-out, draug, steamboat boiler explosions, river pirates | Trade, transport, wood-yard income, mussels |
| **Wisconsin River** | The raft road from the pineries, sandbar country | Sandbar camp, raft, river town | Shifting bars, raftsmen brawls | Lumber, news from up north, fearsome critters riding in on the rafts |
| **Kickapoo valley** | The deepest, most fae-thick valley in the region | Long, crooked, forested valley | Floods, disorientation (the river doubles back on itself), dense fae | Rare herbs, hidden coulees, fae courts |
| **Lead diggings** | Played-out mines, active Cornish mines, the knockers' frontier, and the workplace of the goblin pares who treat with the knockers (§6.3, `12` §8) | Mine shafts, drifts, windlasses, smelter, badger holes | Black damp, flooding, collapse, knockers' anger | Lead (shot!), galena, zinc ore, abandoned tools |
| **Badger holes** | Hillside dugout homes of poor miners and squatters, and hideouts for witches | Dugout interior | Collapse, discovery | Cheap shelter, a cache |
| **Shot tower** | A vertical industrial site cut into a bluff | Tower, shaft, finishing house | Falls, molten lead | Shot, a vertical dungeon |
| **Effigy mounds** | **Not a dungeon. Not fae.** See §2. | — | — | — |
| **Wheat and sloped plowing** | Plowing the slopes destroys fae ground *and* soil. This is the Prince's case against settlement. | Field on a slope with a raw gully | Erosion events, flood debris | Grain, cash |
| **Land survey** | Section lines in iron chain bind land into "known" ground | Surveyor's camp, section-corner posts | Surveyors disappearing | Plat maps (information as an item) |

---

## 2. Native nations: an approach, with options

This is the most consequential tone decision in the setting. There are two failure modes, and they pull in opposite directions:

- **Erasure.** You present a Driftless of homesteads and fae where nobody lived before the Yankees. That's false, and it quietly repeats the "empty land" story that justified dispossession.
- **Mystification.** Native people show up as spirit guides, keepers of fae secrets, ancient curses, "Indian burial grounds," or a faerie-adjacent people who are part of the wild rather than of civilization. This one is especially tempting here, because the setting's core axis is *civilized humans vs. the wild Faerie*. Any Native presence placed on the "wild" side of that axis lands right in the trope.

### 2.1 Principles regardless of which option Ellie picks [PROPOSAL]

1. **Native actors are people on the same sheets and minds as everyone else (P2).** They have jobs, debts, factions, grudges, politics, ambitions, faith, and skepticism. A Ho-Chunk ginseng trader runs the same Activity system as a Norwegian miller.
2. **Native nations stand on the *civilized* side of the human/Faerie axis.** They have their own long knowledge of the land and its dangers, the way the Norwegians have theirs. Their knowledge isn't fae, it doesn't come from fae, and it doesn't make them fae.
3. **No Native sacred beings appear as game content.** That means no waterspirits or underwater panthers, no thunderbirds, no wendigo, no skinwalkers, no "shaman" class, and no Native-derived spells or curses. The bestiary (§7) draws on settler, immigrant, and lumber-camp folklore, which is the folklore *the settlers brought with them*.
4. **Effigy mounds, burial sites, and rockshelters with rock art or occupation deposits aren't adventure sites.** You can't loot or dig them, they aren't haunted, and they're not fae. If they appear at all, they appear as what they are: places that other people's ancestors made and that settlers are plowing under. The social sim can register a farmer plowing a mound as a real event with consequences between people.
5. **Real atrocities don't get supernatural content.** Bad Axe isn't a haunted dungeon. Nothing fae happens there. If the game shows it, it shows it as history people remember differently (see 2.3).
6. **No "vanishing Indian," no noble savage, no "Indian maiden's leap" legends.** Lovers' leap stories such as the one attached to Maiden Rock on Lake Pepin were largely settler inventions and should be left out.
7. **Consultation before ship.** If real nations appear (Options A or C), budget for paid cultural consultants and sensitivity readers. The Ho-Chunk Nation has a Heritage Preservation department, and the other nations involved have their own offices. Treat consultation as a production line item rather than a courtesy.
8. **Named Native NPCs stay as placeholders** in prototype data until consultation. Don't invent Ho-Chunk or Sauk names casually.
9. **Found stone tools and rock art aren't fae.** A flint point or scraper turned up by a plow in the Driftless is a Native artifact. It isn't an "elf arrow," a curse component, a fae weapon, or a no-iron trade good. The same goes for rock art and for anything in a rockshelter or cave that people left. *Elf-shot* survives as a European **folk diagnosis** (sudden lameness blamed on fae darts, with a thorn or splinter found in the wound), as in `12` §12. A plowed-up point can appear as what it is: an item people argue about owning, selling, or returning (a social event, §2.3). (C10)
10. **Generated content obeys the same lines.** The ADR 0003 generator must not emit effigy-mound-like earthworks, burials, or rock art as fae features, dungeons, or loot. Fae barrows (`05` M4) are fictional European-style barrows, flagged `fictional = true`, with their own vocabulary and no overlap with mound forms. Any "uncanny-terrain" seeding for the Fae intensity field (ADR 0003, layer 4) takes caves, springs, fog pockets, old-growth, and algific slopes. It does not take mounds.
11. **No people in §6 fills the Native slot.** None of the four peoples is "here first," "close to nature," or a stand-in for a real nation (`12` Ground rules 2 and 3). If a design review finds a people drifting into that slot, the people changes. §2 doesn't.

### 2.2 Options

| Option | What it is | Upside | Downside |
|---|---|---|---|
| **A. Historical presence** | Real nations with real names and accurate politics. Ho-Chunk families who resisted removal, Meskwaki land purchases, Dakota towns upriver. The fictional county includes Ho-Chunk neighbors. | Honest. Removal is the background noise of 1855, and the social sim can show it at the scale of individuals. | Highest research and consultation burden. Plays a real ongoing injustice as a backdrop to fun. |
| **B. Fictional nations** | Invented nations with analogous histories | Lower consultation burden. Creative freedom. | Reads as a dodge. A fictional people with a recognizably Ho-Chunk history is *still* about the Ho-Chunk, with less accountability. |
| **C. Divergent history** *(my recommendation)* | Real nations, but history diverges somewhere *political*, not magical. For example, the 1837 treaty is repudiated as fraudulent (which it largely was), and the Ho-Chunk retain a sovereign, recognized homeland on Hollin County's northern edge. They're a neighboring polity with towns, farms, traders, a council, diplomats, and lawyers. | Native presence as a *contemporary power* rather than victims or mystics. Gives the region-map faction system a sovereign neighbor with its own interests (including in the witch problem, the surveyors, and the Prince). Fits the "slightly off-kilter America" brief. | Still needs consultation. Alt-history that's kinder than reality could feel like whitewashing unless the game still shows pressure from land speculators, surveyors, and settlers. |
| **D. Omit** | No Native nations at all | Zero risk of bad depiction | Erasure. In a game whose premise is "this land was never empty, it belonged to someone else," the omission becomes thematically loud. Not recommended. |

**Crucial constraint on Option C:** the divergence must *not* be caused by Faerie. ("The fae protected them.") That would turn Native sovereignty into a magical exception and put them back on the wild side of the axis. The cause should be human: legal, diplomatic, or military.

**Interaction with ADR 0003 (procedural worlds).** Option C sets a political frame, not a map. A generated county that borders a sovereign nation gets it as a **region-graph neighbor with its own faction record**, never as a generated "wilderness" tile type. Because the actual nations are a consultation question, generated counties default to a *named placeholder polity* (`Neighbor Nation (placeholder)`) that every content check allows and no shipped build may contain until Ellie picks A/B/C/D and consultation signs off.

### 2.3 The Black Hawk War in the game [PROPOSAL]

In 1855 the war is 23 years old. Most adult men in the county have an opinion about it, and some were in it. The memory system (`04-social-simulation.md`) should use that:
- **Militia veterans** carry Memories of 1832 that *drift with each retelling*, growing braver and bloodier. This makes a great showcase for memory distortion and rumor mutation.
- Under Options A and C, **Sauk, Meskwaki, or Ho-Chunk actors** carry their own Memories of the same events, and the two accounts conflict.
- The game takes no narrator's position. The Chronicle records what each actor *says*. Nobody fights the war again for spectacle, and no quests involve it.

### 2.4 What the Native-nations decision asks of the other docs [PROPOSAL, C10]

**Downstream fixes, with 01's recommended replacements.** None of these edits is in this pass, since each belongs to its owning doc. The principles above are the spec.

| Where | Problem | 01's replacement |
|---|---|---|
| `05` §6.5 (elf-shot), `05` F9 | "A flint 'elf arrow' may be found in the wound" / "flint points found" | Keep *elf-shot* as a folk diagnosis. The wound holds a thorn, a blackthorn splinter, or nothing. Principle 9. |
| `06` §3.7 #15 Elf-Shot | "a flint arrowhead found in a field" as a curse component | A thorn-and-hair bundle or a nail-paring. The curse is unchanged. |
| `03` §6.12 | "Knapped flint blade… turned up by the plow" | An imported gunflint scraper, or cut it. A plowed-up point, if it appears at all, is a flagged social item (principle 9), never a sold curio. |
| `05` §5.3 | "Barrow-wights / old dead: undisturbed graves; a plow opens a barrow" beside the excluded trope | Restate as an explicitly fictional **fae barrow** (principle 10), as `05` M4 already does. No "disturbed grave" curse. |
| `02` §4.1 | **Lore (Old Peoples)** invites the "vanished mound-builders" myth | Rename **Lore (History)**, ordinary human knowledge, which includes treaties and the nations' present politics. |
| `05` §7.2 | History written for Option A ("removals 1830–1874"), with no neighbor faction under Option C | Add a sovereign-neighbor faction (below). |

**A sovereign neighbor under Option C: what the sim needs (structure only; content waits for consultation).**
- **A faction record on the region graph** that behaves like any polity: it has a council, towns, farms, traders, lawyers and diplomats, standing interests, and a position on the surveys and the witch. It is a faction in `05` §7.2's sense, with clocks. It is never a threat table, an encounter, or a "tribe" spawn.
- **Standing interests the sim can run** (my reading of the history, for Ellie and any consultant to correct): enforcement of the repudiated 1837 treaty against squatters and speculators; the survey line (who may run chains where); river and ginseng trade, including credit with the Outfitter; jurisdiction (what a county JP can and can't do across the line); and each side's pressure on the other's mobs.
- **Jurisdiction rules** belong in `04` §9.3 and §5.4 below: a county sheriff has no writ over the neighbor's citizens, a mob can't be "raised" there, and a witch who crosses the line is in a place with its own law. That makes the border a real option for flight and a real diplomatic risk, with no supernatural exemption (see "Crucial constraint" in §2.2).
- **Pressure must stay visible** (the whitewashing risk in §2.2): speculators, surveyors, and squatters keep pushing, and the Chronicle records it.
- **Gap closed:** this fills `09` gap #5. The faction table itself is `05`'s edit.

---

## 3. When and where

### 3.1 Start year [DECISION, 00 and ADR 0001]

**Spring 1855**, with canonical time as integer game-minutes since 1855-04-01 00:00 (ADR 0001). Reasons:
- Statehood is recent, the land office is busy, and surveyors are pushing chains into the last unsurveyed coulees.
- Politics are unsettled in ways the social sim can use. The Whig party is collapsing, the Republican party was founded in Ripon, Wisconsin in 1854, and the Kansas–Nebraska Act (1854) and the 1854 Milwaukee rescue of the fugitive Joshua Glover have made slavery a county-level quarrel. **Know-Nothing nativism peaks in 1854–55**, aimed at Irish and German Catholics. That is real period prejudice, and it is where `12` §11's Prejudice options start. Editor Bell "drifting toward Republican" (§8.3) sits on this fault line.
- The lead boom is fading. Mines stand half-abandoned because the miners went to California, which leaves good dungeon stock.
- Norwegian and German immigration is near its peak, which gives the population folk-belief diversity.
- The railroad is two years away (Prairie du Chien, 1857) and the Panic of 1857 is coming. The director gets slow-burn structural events: a rail survey, bank failures, and banknotes losing value. (For `03-gear-and-economy.md`, note that 1850s "dollars" meant a chaos of state-bank notes trading at a discount, with specie scarce. That's a gift for the catalog feeling.)
- The Civil War is six years out. It's long enough for most runs to never hit it, and a legacy world can.

> **The start year is settled (was Challenge to 00).** 00 now pins spring 1855. **[OPEN]** What remains is the **Civil War**: a third of a county's young men gone, widows, draft resistance, wartime prices. Either it is a scheduled world event (April 1861, a little over six years or about 3.2 million game-minutes out) that only legacy time-skips (`06` §5.4) and very long runs reach, or it is explicitly removed in this alt-history. Leaving it ambiguous will produce inconsistent data. (Ellie: Q2 in §11.)

### 3.2 Map frame [PROPOSAL]

- **A fictional county, Hollin County,** sits between the Mississippi and the Kickapoo, north of the Wisconsin. The rivers are real and the towns are fictional.
- **Scale (C9).** `05` owns world scale and `11` owns the World-size setting. Hollin County is the **Standard World**: about 24 × 30 miles (~720 sq mi), about 6 settlements, 3,000–4,000 people, about 800 named actors with the rest as census (`05` §1.2, `11` §5.1, `07`). The **Small World ("A Coulee")** is the south-west quarter: Iron Ford, Lantern Coulee, Penhallow Diggings, and Kvale Ridge, about 360 sq mi. The **Large World** adds a second river town and a second mining district. 01 previously said "a few hundred sq mi" and "25 miles across"; both are superseded.
- **Real towns** such as **Prairie du Chien, La Crosse, Galena, Mineral Point, and Decorah** exist as *off-map T2 cities*: market destinations, sources of news and newcomers, the **federal land-district office** (historically at a district seat, not the county seat), and the bank that's failing.
- **The county seat is on the map (resolving the C9 split in favor of `05`).** It holds the courthouse, the circuit court's sitting days, the sheriff, the county paper (the Chronicle's "Paper" voice, `05` §11), and a bank branch. It is a river town of 600–900, and its name is part of the C7 names pass (§8.4). In the Small World it is off-map and reached by the river road. The land office is not there. `06`'s "land office or claims agent" guaranteed-institution check is met by a **claims agent or claim club** in the threshold town.
- **Iron Ford's *Sentinel*** stays: a small town paper and a bias parameter on local rumor, not the Chronicle voice. A county-seat paper and a village paper can disagree, and that is content.
- The region map has room for 6–10 hearths (Standard) and 3–5 major fae zones.

---

## 4. Faerie

### 4.1 Lore hook: the Glacier Compact [PROPOSAL]

00 now carries this as its lore hook: the Ice bargained with Faerie and went around. I'd sharpen it into a **bargain** with explicit terms, because bargains are how Faerie works, and a bargain gives us a counterparty:

> When the Ice came south, it was not weather; it was **the Ice**, a slow cold sovereign that makes the world flat, known, and sorted. It ground everything it covered into till and laid it down in rows. Faerie met it at the edge of the hills and struck terms: the Ice would part and go around, and in exchange Faerie would *never cross out*: the Fair Folk would stay inside the unflattened land. The ice lobes went around on both sides. The Compact still holds.

**Naming (C11).** Capital-D **Drift** is 00's measure of an actor becoming fae (`06`). It is *not* the Ice, and "the Ice" is now this doc's only name for the sovereign (as `10` §11 and `12` §3.1 already use it). Fae call it **the Till** ("what is laid down"). Settlers' geologists say "drift" for glacial deposits, which is exactly what the Driftless lacks. The near-pun is available to writers and is never explained in-world.

Consequences:
- **Faerie is fenced in.** The fae are a besieged, landlocked sovereignty. This explains why the Driftless is the place where Faerie never left: it *can't* leave.
- **The Ice is dormant, not dead.** Algific slopes are where it still breathes. Granite boulders that appear in coulees (impossible in real Driftless geology) are its probes. That gives us **erratics** (§7 #29, formerly "Drift-wights") and a long-arc threat.
- **Settlers are the Ice by other means.** Survey grids, straight roads, iron chains, plows, and the habit of naming and sorting all do to Faerie what the Ice would have done. Fae intellectuals say exactly this. It's the Prince's thesis (§4.4).
- **Peoples and the Compact (`12` §3.2).** Elves and goblins arrive on the settlers' tide and are not parties to it. Whether a shadow-faekin on a ridge farm is "Faerie crossing out" is an open question among fae jurists, which is one reason faekin cluster inside the line. Rumor says erratics hunt faekin first. **[PROPOSAL]** That rumor is false: erratics are hostile to everyone.
- **In-world, nobody agrees on any of this.** The Lutheran pastor calls it a heathen fable. A lyceum geologist offers the lobes-and-highlands explanation. The Under-Court tells it differently again. Per P1, the game holds the "truth" in data, but actors only hold *beliefs*.
- **Folk-geology bonus:** Glacial Lake Wisconsin's catastrophic drainage is remembered in fae lore as the time the Ice *tried to cheat*, drowning what it promised not to walk on. The Dells are the scar.

### 4.2 What Faerie is [PROPOSAL]

- Faerie isn't a separate dimension you portal into. It's a **condition the land is in**, stronger in some places than others. That condition is **Fae intensity** (§4.6).
- **Faerie runs on the uncanny.** Its power over a place is roughly *how much that place is still strange to the people around it*: unmapped, unnamed, feared, bargained with, remembered. Fae aren't evil. They're a sovereignty whose existence depends on human minds *not* finishing the job of knowing them.
- This makes Faerie and the social sim the same system. **Rumors, Notoriety, Memories, and Grudges about fae phenomena are literally fae power.** A coulee everyone tells stories about is stronger than one nobody mentions.
- Fae are **actors** (P2). They have sheets and minds. Their minds follow a different model, owned by `10` §10 (this closes `09` gap #4): **Id plus Law, with no Ego.** The needs this doc promised map onto drives (tribute to greed/hunger, recognition to envy, novelty to lust/longing, plus a wildness drive that rages at plows, surveys, and iron). *Propriety* is not a need but **Law**: an absolute veto that produces no guilt, because it is physics rather than conscience. Frustrated drives go into an Affront store and spawn grudges. They're bound by **rules** (§4.5) that are absolute for them in the way physics is absolute for humans.
- Faerie also reaches minds it can't touch directly through **dreams** (§4.6, `10` §9). Dreams are its channel, and the "collective unconscious" is the in-world Deep Commons.

### 4.3 The courts [PROPOSAL]

Faerie is a **political landscape**, not a monolith. Its rightful sovereign, the one who struck the Glacier Compact, is **asleep under the ridges**. Nobody agrees whether that's a sleep, a death, or a sulk. The courts are, in effect, factions in a regency crisis about how to survive settlement.

| Court | Who | Strategy for survival | Disposition to humans |
|---|---|---|---|
| **The Prince's Court** ("the Coulee Heads," "the Thorn") | The Prince, his retainers, huldre households, will-o'-wisps, the fiercer wild fae | **Re-enchant through fear.** Keep humans out of the high coulees and off the slopes, and make the land uncanny again. | Hostile in practice, contemptuous in principle |
| **The Hearth Court** ("the Tame," "the Porridge Court") | Nisse, kobolds, Hausgeister, moss folk, the fae who live *with* humans | **Accommodation.** Live in barns and mills, take tribute, become part of the household. | Cooperative, though touchy about tribute |
| **The Under-Court** | Knockers, trolls, the cave-dwellers. Neutral and mercantile. | **Depth.** Let the surface go. Underground can't be plowed. | Transactional. They trade with miners. |
| **The Alder Court** (the Erlking's) | The Erlking and his daughters, changeling-makers | **Replenishment.** Take human children and raise them fae, so Faerie gains numbers. | Predatory toward the young. Courteous to adults. |
| **The River** (not a court) | Nøkk, draugar, the drowned, the river itself | Nobody owns the river. It's the boundary, and the boundary keeps its own society. | Indifferent, hungry |

**Political fun:** the Hearth Court considers the Prince a dangerous radical. The Prince considers the Hearth fae collaborators who have become *pets*. ("The nisse sweep barns for porridge now. Is that survival?") Witch mode can interact with this dispute, and adventurers can be hired into it. `10` §10 gives the sneer a psychological reading: fae who have lived with a household for twenty years or more *grow a small Ego*, with a little anxiety, defenses, and even guilt. Accommodation is, literally, becoming a bit more human. Whether the Prince's contempt is also fear is a question the game can leave in the dialogue.

**Naming note (C16).** "The Thorn" and "the Coulee Heads" name the Prince's Court *only*. Ferrymen, boatmen, and anything on the water belong to **the River**, which is not a court. A court's retainer can *use* a ferry, but "the Thorn Court's ferryman" is a River figure in the Prince's pay, and the sim should say so (`03` §10.4 to be reworded). `06`'s "1–2 rival Courts as alternate patrons" draws from the Hearth, Under-, and Alder Courts.

**Court postures toward the four peoples (`12`) [PROPOSAL].** Each court's opinion is a prior on `04`'s dimensions, not a rule, and individual fae differ.

| Court | Humans | Elves (renouncers) | Shadow-faekin (the Unrenounced) | Goblins (Deep Accord) |
|---|---|---|---|---|
| **Prince's** | Raw material and instruments | Apostates; respected for what they gave up (Aff −30, Res +10) | Courted as kin. That is recruitment pressure, not complicity | Contempt mixed with wariness. Harming one is a diplomatic incident with the Under-Court |
| **Hearth** | Household partners | Cool. Elves keep sealed names and ring bells | Quiet allies. A hearth fae may greet a faekin as kin, which is a tell (`12` §7.2) | Neutral |
| **Under** | Customers and trespassers | Indifferent | Unremarkable | **Treaty partners.** Good-standing goblins get +20 Aff, +20 Tru |
| **Alder** | Courteous to adults, predatory toward their children | Wary. Whether it takes elven children is a Hall fear the sealed name answers. **[OPEN]** (Ellie's lore) | Claims them as "strayed" | Avoids the Under-Court's clients |
| **River** | Indifferent, hungry | Indifferent | Indifferent | Indifferent |

Note the courts contest what faekin *are*. The Halls say unrenounced, the Prince's Court says kin, and the Alder Court says strayed. Those competing claims are lore for fae NPC dialogue, held as beliefs (P1).

### 4.4 The Faerie Prince [PROPOSAL]

**Fixed core and per-World overlay (C15).** Under ADR 0003 each World generates its own Prince, so this section is split. The **fixed core** is everything below: his motive, his honesty, his taste for story, and his boredom with cruelty. The **per-World overlay** is `06` §3.4's temperament (Capricious, Jealous, Melancholy), his agendas, his seat's location, and his look. `06`'s "Hungry" and "Cold" temperaments are **excluded** because they make him a sadist, which contradicts the core. The core is not generated.

**What he wants:** for the Driftless to stay *untilled*: unplowed slopes, unsurveyed coulees, springs that still have tenants. He's watched the first gullies open on plowed slopes and the first trout streams silt up, and he's correct that settlement as practiced will wreck this land. (It did, historically.) He's an ecological zealot with a monstrous method.

**Why suffering, specifically:**
1. **Grudges founded on the uncanny don't decay [PROPOSAL, resolves C12 as option (a)].** Per 00, Memories decay and Grudges are durable. To Faerie, a memory that won't fade is a little piece of the uncanny lodged permanently in a human mind. A county full of people who *remember* the woods hurt them is a county where Faerie stays strong for a generation. Joy and wonder fade, and dread doesn't.
   - **The mechanical rule.** An ordinary human grudge decays on `04` §6.3's schedule (τ = 60 days × (1 + Rancor)), because most feuds do cool. A grudge whose founding event carries an `uncanny` tag (a fae act, a curse, a dream-visitation, a hag-riding) has **no time decay**, or a high floor. `04` owns the number and needs an `uncanny` flag on the founding Memory. The Prince's craft is therefore *converting ordinary hurt into uncanny hurt*: a curse turns a lost cow into a grudge that lasts a lifetime. This is why a curse is worth more to him as a story than as damage, and it gives witch mode a reason to prefer strangeness to harm.
   - **Fae side.** Fae grudges and bargain memories never decay (`10` §10).
   - **`06` §8.1's "Social memory" slider** scales the ordinary decay only.
2. **Fear keeps the line.** Frightened people don't plow the coulee head, don't let the surveyor's crew camp there, and don't cut the spring-wood.
3. **He can't do it himself [PROPOSAL, scoped under C14].** Under the Glacier Compact, or under older rules nobody fully remembers, the Fair Folk may not *directly* harm a human who hasn't **forfeited** protection (§4.5, the Forfeit Rule). A human, however, can harm humans. **The witch is a legal instrument:** a human hand doing what a fae hand may not. It's also deniable, which matters in court politics. The Prince's Court is the court that keeps this rule *most strictly*. Others read it more loosely (§4.5), which is what the Prince resents.
4. **Persecution feeds him too.** When villagers hunt the witch, their fear, their grudges, and their stories of the hunt all count. The witch doesn't even have to succeed. She has to be *remembered*. This is a tragic irony that witch-mode players should be able to discover.

**What he's like:** young by fae standards, a younger son of the sleeping sovereign, and so needing a project to justify his claim. He's sincere and charming, and he keeps his word to the letter, because he must (§4.5). He isn't interested in cruelty for its own sake, and he gets *bored* by witches who are only cruel. He wants artful harm that becomes a story. Mechanically, a curse that generates Rumor and Notoriety is worth more to him than raw damage, which pushes witch players toward interesting play rather than murder sprees. (Cross-reference `06-game-modes.md` for the Curse economy.)

**In the witch's head [PROPOSAL, `10` §13.3].** The Prince doesn't only command the witch. He speaks in her dreams (`10` §9.2), and on binding she takes on a pact-sourced norm in his voice (*"The moon wanes. Remember what you owe."*) that carries his Behests and the Tithe. The witch has **two superegos**, her old one (Mother, the Pastor) and his, and the arbitration between them is where witch mode's moral texture lives. His desire for her is a drive with a target, not a fifth opinion dimension (`10` §10, C36). Whether the player wants the Prince as a second conscience at all is Ellie's call (`10` Q10).

**What he doesn't know or won't admit:** his strategy also feeds the Ice. Communities that fear the woods organize, survey faster, buy more iron, and invite the railroad. The Hearth Court's slow accommodation may be the only strategy that actually works. `10` §11 turns this into cosmology (§4.7): a superego draws its energy from the id, so the Prince's fear campaign powers the very Ice he fights. **[OPEN]** Whether the game ever *confirms* this in-world is a question for Ellie (Q7). I recommend only fae intellectuals and one lyceum crank say it, as beliefs.

### 4.5 Fae rules and logic [PROPOSAL]

These are **hard rules for fae actors**: constraints in the action-selection system, not flavor. Per P1 they're legible: the UI can show "the nøkk *cannot* follow you: you crossed running water."

| Rule | Fae side | Human countermeasures / exploits | Systems hook |
|---|---|---|---|
| **Bargains bind** | A struck bargain is enforced by the world. Fae can't break the letter and will exploit loopholes. | Precise wording. Witnesses. Lutheran pastors refuse to let parishioners bargain at all. | Bargain is a **first-class data object**: parties, terms (from templates), deadline, penalty. Breaking one applies a condition. |
| **Fae cannot lie** | They can mislead, omit, riddle, and be *wrong*, but never speak insincerely. A fae asserts nothing it doesn't believe, and hedges ("it is said," "so the river thinks") anything it holds at less than near-certainty. **[PROPOSAL, `10` §10 option (a)]** | Ask direct questions. Learn to hear hedges (Lore (Fae) ≥ 2 weights unhedged fae statements as strong evidence and hedged ones as weak) | Dialogue: fae statements are flagged *sincere* in data, not *true*. This keeps P1's epistemics (a fae is a fallible witness, not an oracle) and respects `05`'s rule that the Director voices only what a carrier knows (C43). Inference is the player's job. |
| **Names** | Knowing someone's *true* name gives leverage, and the name a community uses for you is a handle fae can pull | Nicknames, farm names (Norwegian practice), baptismal names kept private. Peoples add customs: elves' sealed names, goblins' deep-names, faekin's dusk-names (`12` §5.4, §8.4, §6.5) | Actors have `true_name` and `known_as`. Fae effects target what they can address. **The witch gets a new name from the Prince.** Elven sealed names and goblin deep-names fill `true_name`; effects that target the name take −4. |
| **Iron** | Iron burns, wards, and breaks glamours. Fae can't cross an iron line or enter an iron-shod circle. **Cold iron** (cold-hammered, never quenched) is the strong tier, x3 per pound (`03` §3.3, **[PROPOSAL]**, C28). Ordinary iron and steel count as iron. | Horseshoes over doors, nails in thresholds, open scissors over cradles, an iron knife in the milk pail (all real folk practices) | Iron is a gear tag, measured as `03`'s **Iron Presence**. It lowers local Fae intensity and offends fae. **Who suffers from iron is not a rule here (C27).** `06` owns every fae weakness, keyed to **Drift thresholds** (Drift 40: iron discomfort, salt stings, bells ache; Drift 60: no running water unaided, no consecrated ground) and to the Prince's pact. `03`'s Iron Presence is an *input* to them, `02`'s Witch features reference `06`, and a witch's discomfort is therefore a number the UI can show. Peoples feed in only through a Drift offset (`12` §6.6, §10.2). |
| **Thresholds** | A fae may not enter a dwelling uninvited | Don't invite. Beware of saying "come in." | Site maps tag thresholds. Invitation is a social action. |
| **Hospitality** | Guest-right binds both host and guest. Eating fae food binds the eater to Faerie. | Carry your own food. This is where the Outfitter's "trail victuals" earn their place (P8), and where an elf's hallowed hearth-loaf and salt grace (`12` §5.5) matter. | One condition chain, **owned by `02`** (C26): Bound, then Longing, then Wasting. `05` supplies the nutrition effect of fae food, `06` the Drift gain, `04`/`10` the longing need. Peoples change only the *rate* (shadow-faekin advance at 50%, which makes fae food a tell). |
| **Running water** | Many fae can't cross running water except by bridge or invitation. Old belief says witches can't either. | Trout streams become *defensive lines* | Pathfinding constraint. The Driftless's stream density makes this strategically huge. For a witch it is a **Drift-60 weakness** (`06` §3.8), not an independent rule. Before that, she crosses freely. |
| **Thanks and debt** | Thanking a fae admits a debt | Say "well done" instead | Dialogue flag creating a minor Bargain |
| **Counting** | Many lesser fae must count spilled seeds or grains | Spill mustard seed or poppy seed | Item effect that stalls certain creatures |
| **Bells and Sabbath** | Church bells push fae back. Sunday mornings are fae-thin. | Ring bells | Settlement event that lowers intensity in bell range at scheduled times |
| **Turned clothes** | Being "pixie-led" breaks if you turn your coat inside out | Know the trick | A Lore (Fae) check reveals it |
| **Time slippage** | Time runs differently in high-intensity ground | Avoid lingering. Keep a watch. Some say an iron-cased watch keeps true time. | See below |

**The Forfeit Rule: scope of "fae may not directly harm" [PROPOSAL, resolves C14].** The rule is real, but it protects people who have not *forfeited* protection, and the list of forfeits is broad and written in data so the UI can show it (P1: "you are inside a ring; the Hunt may take you"). A fae may directly harm a human who:

| Forfeits by... | Examples |
|---|---|
| **Trespass** | Entering Fae intensity 3+ ground uninvited after dusk; breaking a ring; cutting spring-wood or taking tithed harvest (§4.6) |
| **Bargain** | Accepting a deal or a gift, saying thanks (§4.5), breaking a struck bargain |
| **Hospitality** | Eating or drinking fae food; being a guest and breaking guest-right |
| **Breach of tribute** | Missing the Christmas porridge, whistling underground, sneering at a household spirit. This is the "fae grievance" behind `05` F9 elf-shot cattle. |
| **Being unclaimed** | An infant who is unnamed and has no iron over the cradle. Whether a *named but unwarded* child counts is the Alder Court's reading, not the Prince's. |
| **The road on a Hunt night** | On a ridge road at Yule night, you are "in the Hunt's road." |

**Courts read the rule differently**, which is politics: the **Prince's Court** keeps it strictly (hence the witch as an instrument); the **Hearth Court** is bound by household tribute; the **Under-Court** by the Deep Accord and its customers' courtesies; the **Alder Court** reads "unclaimed" widely; the **River** doesn't claim to be bound by the Compact at all (it takes its toll). The Hunt and ring dances take only those who have forfeited. `05` F1/F5 should state the forfeit that applies. `06` curse #28 (changeling swap) is the Alder Court's act or the witch's, not the Prince's.

**Time slippage** [PROPOSAL, resolves C18; 01 owns the rule, 05 owns the fae-path numbers]: At high Fae intensity, *subjective* time for the player and nearby actors runs slower than world time. An evening at a revel can cost three days outside. Per P3, the world sim keeps ticking: crops, feuds, and rumors move on without you. That's the Rip Van Winkle beat done by simulation. For 05 and 07: cap the ratio, and always *show* it (a "time out of joint" indicator), because surprise time loss can feel unfair. Reverse slippage, where you return *before* you left, should be very rare and treated as a story event.
- **Lingering** (§4.6 ratios): FI 3 ×1.5–2, FI 4 ×3–7, FI 5 up to about ×24, **hard-capped at three days outside per sitting** unless the Director spends a story event.
- **Fae-path traverses** (`05` §1.4's non-geographic edges) are a *per-traverse total*, not a per-hour rate: `05`'s "1d6 days for a one-hour walk at FI 4" is acceptable as a **traverse cost the UI discloses before the player commits**, and nothing more. Negative time and "months or years" are story events only, at FI 5 and on the festival nights of §4.6, never an ordinary roll. `05` Q11's 1d6-month cap is the ceiling for those events.
- **Peoples (`12`)** do not change slippage. Comfort bands and drift do.

### 4.6 Fae intensity [PROPOSAL]

**[DECISION]** Fae intensity is a map property. **[PROPOSAL]** Make it a **scalar 0–5 on each region node**, with a **per-tile field on site maps** that's seeded from the node and perturbed locally (springs high, iron fences low). Make it **dynamic**.

| Level | Name | Typical places | Effects |
|---|---|---|---|
| 0 | Known | Town centers, churchyards, iron-fenced ground | No fae effects. Fae avoid it or are weakened. |
| 1 | Settled | Farms, ridge roads | Hearth fae only. Minor omens. |
| 2 | Edge | Coulee mouths, woodlots, river bottoms | Wisps, pixie-led checks, small fae. Folk magic +. |
| 3 | Wild | Mid-coulee, goat prairies at dusk, big springs | Fae actors common. Bargain rules strictly enforced. Time slippage ×1.5–2. Spell potency shifts. |
| 4 | Deep | Coulee heads, Kickapoo backwaters, cave depths | Court presence. Navigation edges on the region graph *reroute*. Time ×3–7. Memory distortion for witnesses. |
| 5 | Court | Seats of the courts | Faerie proper. Human rules don't apply (the Forfeit Rule still does, §4.5). Time slippage severe: up to about ×24, capped at three days outside per sitting (§4.5). |

**Effects, by system:**
- **Navigation:** region-graph edges above 3 may connect differently each visit. Paths that fold back are very Kickapoo.
- **Checks:** fae-related DCs scale. Folk magic gets stronger as intensity rises and lyceum magic gets weaker (see §5.3).
- **Ecology and supply (P8):** high-intensity land is unnaturally fertile, with huge trout and perfect ginseng, but its harvest is *tithed*. Take too much and you owe. It is also the forage a hungry party is tempted by in the spring gap (§5.7), and the forage that Hall custom forbids elves to eat unhallowed at FI 2 and above (`12` §5.5).
- **Memory:** events witnessed at intensity 4+ are stored with higher distortion. Witness testimony about fae events is unreliable, which matters for witch hunts.
- **Dreams (`10` §9):** a fae sender's dream lands with a probability that rises with the sleeper's local intensity (`Rcp = 10 + 10×FI + ...`, falling with iron by the bed, open scissors, a horseshoe). Dreams are how Faerie talks to minds it may not touch. Hag-riding (`06` curse #13) is a sent nightmare, and the rider's face is whoever the victim already resents. Dreams are *spectral evidence* (`10` §9.1), as dangerous as in 1692.
- **Comfort bands (`12`):** each people has a comfort band of intensity (humans 0–2, shadow-faekin 1–4, goblins 0–2 on the surface and 0–4 underground; elves 0–2 plus the Pull at 3 and above). Outside it, ordinary Id-voiced restlessness or longing thoughts accumulate. Comfort is a fact about bodies and habits, not virtue.
- **Weather:** local anomalies such as summer frost, fog that holds at noon, and silent snow.

**What raises it:** bargains struck, curses laid, fear-Rumors spreading, abandonment of farms, fae festivals (Midsummer/St. John's Eve, which is Norwegian *Sankthans*; All Hallows; Walpurgisnacht; Yule, for the Wild Hunt), and dark of the moon. Settlement-level psyche aggregates nudge it too (`10` §11): a high collective Shadow plus fear-rumors raises it.

**What lowers it:** survey lines run and plats filed, iron set, land plowed, roads graded, bells, newspapers *debunking* (in-world, debunking articles are anti-fae weapons), the railroad, and schools. **Ridicule works like debunking**: the lumber-camp hodag joke is a small anti-fae act (`10` §7.2, humor; `10` caps it at roughly 1 FI per 20 tellings in a season). Sublimation and an elven Renewal (`12` §5.2: iron touched, bells rung on Midsummer Eve) lower it locally.

**Festival names (C19).** The in-world fae calendar uses the *settlers'* festivals above, not the Celtic wheel (`05` §4.5 should replace Imbolc, Beltane, Lammas, and Samhain with All Hallows, Sankthans, Walpurgisnacht, and harvest home). The **Tithe is monthly, at the full moon** (`06` §3.6). A harvest-time Behest from the Prince is a special event, not a second Tithe cadence.

This turns the setting's central conflict into one number the director (05) can watch and nudge.

### 4.7 The cosmology as a psyche [PROPOSAL, cross-reference to `10` §11]

Ellie's P7 swing (00) and this doc's lore line up, and `10` §11 states the correspondence. It is a **writing frame**, not a rule that characters or the UI recite.

| In the psyche (`10`) | In the land (this doc) |
|---|---|
| **Id**: appetite, the unnamed, impulse | **Faerie** (§4.2): strong where minds haven't finished knowing a place. The courts are its drives given faces. |
| **Superego**: prohibition, order, the compulsion to sort | **The Ice** (§4.1): the survey grid, the till laid in rows, the iron chain, the keeping of terms. It keeps the Compact like a conscience keeps a rule. |
| **Ego**: the arbiter that makes a livable compromise | **Settlement**: the mill dam is a negotiated peace between a stream's appetite and a grid's order. Hearth-Court accommodation is the Ego's middle way. |

What follows for setting writers:
- **The Prince's thesis and its flaw are Freud's.** A superego draws its energy from the id it represses. His fear campaign makes communities organize, survey, buy iron, and invite the railroad (§4.4), which powers the Ice he fights. `10` §11 makes persecution count toward the Ice's quiet advance: a rigid superego crusade (reaction formation, identification with the aggressor) is the Ice's work, not the Ego's.
- **The Hearth Court is the sustainable path** because accommodation is the only strategy that grows an Ego (§4.3).
- **Elves are Faerie's Superego made flesh** (a rendering of `12` §3.1 for writers): renouncers who chose law, iron, and names. **Shadow-faekin are what everyone else imagines as the Shadow**, though what a faekin actually is stays a matter of belief. The glossary's echo between Jung's Shadow and *shadow*-faekin is deliberate, and the Jungian Shadow is not the people (`12` §7.7). **Goblins stand off the axis**, with a practical treaty with the deep.
- **Dreams** are the medium (§4.2, §4.6). The Prince speaks in them.
- **The sleeping sovereign.** **[OPEN]** The Jungian Self is the center that integrates the whole. If Ellie wants the sleeping sovereign (§4.3) to matter, the sovereign can be the land's Self, and waking it means individuation for the land, with all the danger that implies. If it is too epic for a sim, it stays a regency crisis (Q8).
- **P1: nobody says it.** The game holds the cosmology in data and structure. In-world, only fae intellectuals and one lyceum crank put it into words, as beliefs that can be wrong (`10` §11, Q7). Period labels carry the psychology to the player (§9.1, `10` §12).

---

## 5. Human society

### 5.1 Settlements [PROPOSAL]

| Type | Population | Character |
|---|---|---|
| **River town** | 300–3,000 | Steamboat landing, warehouses, hotel, newspaper, several churches, bank. Yankee merchants, German artisans, Irish laborers. |
| **Mining camp/town** | 100–800 | Cornish stone cottages, Methodist chapel, smelter, company store, badger holes on the edges |
| **Mill village** | 50–300 | At a coulee mouth where the stream drops: grist mill, smithy, store, school, one church. **The Outfitter lives here** (the edge of the wilderness). |
| **Ridge settlement** | Scattered farms | Norwegian or German Lutheran parishes. Church and school as the only public buildings. |
| **Free settlement** | Scattered farms | Black and integrated farming communities on the Pleasant Ridge / Cheyenne Valley model |
| **Native towns** | Per §2 choice | — |

**Peoples across settlement types [PROPOSAL, priors from `12` §2, §5.2, §8.3].** Humans are everywhere, in every institution and niche. **Elves** live mixed in with their neighbors (several households on Kvale Ridge, a few in Iron Ford) rather than in enclaves, tied to a Hall off-map and a lay Hall-reader locally. **Goblin pares** work in the mining camps, the smelter, the quarries, and the well-digging trade, and keep a Club (below). **Shadow-faekin** (roughly 2% of Hollin County, a few dozen households) pass inside human and elven communities. They cluster on failing lower-coulee farms, at the ferry and wood-yard on the slough, and in peddling, fiddling, midwifery, and ginseng-digging. That is why nobody is ever sure. Expect roughly 85% human, 8% elf, 2% faekin, 5% goblin as a *prior* for `05`'s census, not a quota. Ellie's lore overrides it (`12` Q14).

### 5.2 Institutions

- **Churches.** Norwegian Lutheran: a university-trained clergy vs. Haugean lay preachers, and the splits are bitter. German Lutheran and Catholic. Yankee Congregationalist and Presbyterian. Cornish Methodist, with circuit riders and class meetings. Irish Catholic. Freethinkers. **[OPEN]** Use real denominations, or lightly fictionalized ones such as "the Synod" or "the Connexion"? I lean toward real names with fictional congregations and doctrine kept non-specific.
- **The land office.** Claims, plats, and surveyors. It's *the* anti-fae institution without knowing it. Deputy surveyors run section lines with Gunter's chain, which is 66 feet of iron links.
- **Claim clubs.** Squatters' associations that intimidate outside bidders at land auctions. They're extralegal, organized, and a ready-made mob.
- **County government.** Sheriff, justice of the peace, circuit court that sits a few times a year, county board. County-seat fights are a classic feud generator.
- **Militia.** Mostly a social club and a parade, with some Black Hawk War veterans. It musters for real when there's a witch.
- **Mine companies.** Capital from Galena and the East. Company stores and debts.
- **River trade.** Steamboats, ferries, and wood-yards (where farmers sell cordwood to the boats), plus raftsmen coming down from the pineries.
- **Newspapers.** Every town of 500 has one or two, often in German or Norwegian, and they're aggressively partisan. In the sim, a newspaper is a **rumor amplifier with a bias parameter**, and an editor NPC decides what to print.
- **Schools.** One-room district schools and a young Normal-school movement. Schoolteachers are often young women from the East.
- **Lyceums.** Debating and lecture societies. This is where wizards come from (below).
- **Halls (elves).** A congregation that performed the Leaving and keeps the Roll of sealed names, attached in each country to a national church (Lutheran, Anglican, Methodist, Catholic). Locally a lay Hall-reader leads the Midsummer Renewal. A Hall is a superego institution: it teaches the Catechism (`12` §5.7) and enforces it with expulsion, not law. Its doctrine toward the unrenounced is harsher than anyone's. **[PROPOSAL, `12` §5]**
- **Clubs (goblins).** A friendly society on the model of the real Cornish and German miners' benefit societies: sick fund, burial dues, widows' share, and a **club pantry**, a household inventory on `03`'s item model (C48). A real safety net in a hard winter, and a real conflict when a non-member family starves next door. **[PROPOSAL, `12` §8.3, §8.6]**
- **Mutual-aid generally.** Norwegian and German congregations, the Cornish class meetings, and freethinker societies each run a version of this. The Club is one among many, not a special "goblin thing."

### 5.3 Magic traditions: who are the wizards and clerics? [PROPOSAL]

Three traditions. Each draws on a different source, sits at a different place in the social order, and interacts differently with Fae intensity.

**1. Congregational magic (clerics).** Divine power flows *through a congregation*. A pastor's or priest's or preacher's spellcasting scales with the size of the flock and its opinion of them. That's a direct hook into the social sim: a cleric who loses the congregation's respect loses power. Haugean lay preachers draw power from small, intense groups. Ordained clergy draw from large, lukewarm ones. **Bells, consecrated ground, and Sabbath** are this tradition's area effects. It's strongest at low Fae intensity.
- **[OPEN]** Does divine magic require *belief* in the cleric, or in God? The social-sim version (belief in the cleric) is more systemic. The theological version is more respectful of believers. Ellie decides.

**2. Lyceum magic (wizards).** The 1850s American culture of self-improvement, natural philosophy, and print produced a *learned* arcane tradition. Its practitioners are "natural philosophers": geologists, surveyors, schoolteachers, physicians, a few professors. They learn from correspondence courses and expensive imported books. (This is very much the PHB-and-catalog feeling: spellbooks are *mail-order*, and the Outfitter takes orders.) Its principle is **measuring and naming**: the arcane works by making things known. That makes it strongest at *low* Fae intensity and *destructive* to Faerie. A wizard's Detect spell measurably lowers local intensity. Wizards are therefore middle-class, respectable, and in the Prince's eyes the enemy. Fringe practitioners round out the tradition: mesmerists, phrenologists, spiritualist mediums (spiritualism began in 1848 and was enormous in the 1850s Midwest), and patent-medicine showmen (bards and illusionists). The same fringe carries the period's psychology: **mental philosophers, phrenologists, and mesmerists** are the in-world custodians of the vocabulary that `10` §12 uses for the psyche (Conscience, Self-Command, Nerves, Self-Culture), and their dream-books and magnetic sleep are the setting's psychotherapy.

**3. Folk magic (cunning folk).** Practical, hereditary, mostly done by women or the poor, and often immigrant. It works *with* the fae logic instead of against it, so it's strongest at *higher* intensity.
- **Braucherei** ("powwowing"): Pennsylvania German healing by charms, gestures, and scripture. The real 1820 handbook *The Long Lost Friend* (Hohman) gives the flavor. Do *not* use the word "powwow" in-game. Despite its real historical usage among Pennsylvania Germans, it reads as appropriation now. Use *Brauche*/*braucher*.
- **Norwegian *kloke folk*** ("wise folk"), with *svartebøker* (black books of charms).
- **Cornish pellars** (charmers).
- **German *Sixth and Seventh Books of Moses*** grimoire culture, and *Himmelsbriefe* (protective "letters from heaven").
- **Hex signs / barn stars.** A note for honesty: scholars think Pennsylvania barn stars were mostly decorative, and the "hex sign" label is largely a 20th-century tourist framing. In *our* world they work, and that's a fine off-kilter divergence.

**The crucial social fact:** folk practitioners do the same *kinds* of things a witch does: charms, bargains, dealings at the edge. When a witch appears, the braucher is the first suspect. Witch hunts in this setting mostly *catch the wrong person*. That's historically resonant and great for the social sim.

**Mapping to `02`'s classes (C17) [PROPOSAL; framing only, since `02` owns mechanics].**

| Tradition (this doc) | `02` class | Note |
|---|---|---|
| **Congregational** | **Circuit Rider** (itinerant), plus a **settled-pastor path** `02` still lacks | Itinerants draw on "active stops" and Faith standing. A settled pastor's power scales with the flock's size and regard, which is the social-sim hook. `02` needs a Pastor variant or NPC class (`02` Q7). |
| **Lyceum** | **Almanacker** | Fold the Almanacker's conjunction timing into the lyceum identity: almanac-reckoning is the popular-science wing, with astrology on the fringe. Measuring and naming still lower local intensity. |
| **Lyceum fringe** | **Mountebank** | Patent-medicine showmen *borrow lyceum authority* but cast folk-style nostrums. Prestige is lyceum, mechanics are folk. No class change needed. |
| **Folk** | **Cunning Folk** (and the Mountebank's nostrums) | Works *with* fae logic. |
| *(neither)* | **Fae-Touched**, **Witch** | Fae power, not a human tradition (see §6.3 on how Fae-Touched differs from shadow-faekin). |

**Fae-intensity curve for `02` §10.1 to adopt.** Lyceum (arcane) and congregational (divine) power are strongest at FI 0–2 and *weaken* as intensity rises. Folk power *strengthens* as it rises. Fae power is strongest at FI 3–5. A Detect or survey act by a lyceum wizard lowers local intensity slightly (§4.6). Peoples don't change the curve; elves' renounced status gives a Will bonus against fae enchantment, not a magic bonus (`12` §5.6).

### 5.4 Law and justice [PROPOSAL]

- **Formal law** is Yankee common law. JPs handle small matters, the circuit court handles serious ones, and the sheriff has a deputy or two. There's no jail worth the name, so the county pays a farmer to hold prisoners.
- **There's no crime of witchcraft.** Territorial and state codes don't recognize it, because the legislature considers itself enlightened. Harming someone by curse is unprosecutable unless you can prove a mundane act.
- **So justice for witches is extralegal:** vigilance committees, claim-club mobs, militia musters "for public order," **charivari** (rough music, a real frontier shaming ritual: a mob at your door at night with pots, horns, and threats), tar-and-feathering, and banishment. Private **bounties** come from mine companies, churches, or an aggrieved family.
- This creates great triangles. The **sheriff may protect a suspected witch from the mob** out of duty, even while hating her. The **newspaper** decides whether the county reads the hunt as justice or disgrace.
- **What `04`'s "Trial" rung means under no-statute (C13) [PROPOSAL].** `04` §9.2 rung 6 ("Mob / Trial") and §9.3's `Arrest` stay, but the legal channel processes only **mundane charges**: poisoning a well or a cow, arson, slander and defamation suits, assault, theft. A **church trial** is ecclesiastical discipline (admonition, suspension, expulsion), never a capital proceeding. `05` S6's "tried, hanged, or swum" becomes **mob action**: charivari, ride-out-of-county, burning out, a lynching at the extreme. A sheriff's evidence threshold (`04` §9.3) is the main brake on rung 6, and a sheriff who refuses to arrest a suspected witch for want of a mundane charge is restraint, which the sim logs as a notable event.
- **Law and peoples.** There is no statute against any people either. A believed shadow-faekin starts on `04`'s ladder at rung 1 (`12` §7.6), and the danger is extralegal in the same way.
- **Law across the border.** Under Option C a county JP and sheriff have no writ across the neighboring nation's line (§2.4), which makes the border a flight route and a diplomatic risk.
- **[OPEN]** Alternative: a statute exists, such as a territorial "Act for the Suppression of Fae Compacts," with formal witch trials. That's simpler for gameplay but loses the extralegal texture, and it would need a statute-for-faekin question too. I recommend no statute. (Q6)

### 5.5 How communities handle the fae

- **Apotropaics everywhere.** Horseshoes, nails in thresholds, rowan or mountain ash, St. John's wort hung on Midsummer, open scissors over the cradle, salt, bread in the pocket, steel thrown in the millpond before swimming. Each hearth has an **apotropaic profile** that lowers its intensity and shapes how fae actors treat it.
- **Tribute.** Porridge with butter for the nisse at Christmas, which is a real and serious Norwegian obligation. Bread without caraway for the moss folk, who hate caraway in the German tales. Crusts left in the mine for knockers.
- **Taboos.** Don't whistle underground (Cornish). Don't say "thank you" in the woods. Don't name the thing.
- **Ethnic friction.** Each immigrant group *reads* the fae through its own tradition, and they disagree. The Norwegian calls it a huldra, the German a Waldfrau, the Yankee pastor a demon, the lyceum man a hallucination from bad water. Disagreement is content. Their countermeasures differ in effectiveness depending on what the thing actually is.
- **Peoples' own customs.** Elves ring a hand-bell, hallow food before eating forage, and renew their sealed names each Midsummer. Goblins keep the Accord's courtesies (no whistling underground, crusts for the knockers) as a point of pare honor. Shadow-faekin keep a quiet code (keep the secret, shelter your own, never name another). Each is a *norm* held in a person's superego (`12` §5.7, §8.7, §7.7), not a fact about bodies, and different households hold it with different strength.
- **Professional fae-handling.** Adventurers are the 1850s answer: hired to clear the knocker-infested drift, recover the taken child, or escort the surveyors. This is adventurer mode's employment economy.

### 5.6 How communities handle witches

Historical analogues to borrow *structures* from, not plots:
- **Early modern witch panics:** accusation cascades, spectral evidence, and old grudges recoded as witchcraft. *Most accusations came from neighbors who already disliked each other.* This is the single most important design insight for the social sim, since it means accusation should be *driven by existing Opinion and Grudge data*.
- **Changeling killings** (the real 1895 Bridget Cleary case in Ireland is the grim reference) show how fae belief licenses violence within families.
- **19th-century Pennsylvania "hex" feuds:** families believing a neighbor had hexed them, and brauchers paid to counter-hex.
- **Charivari and frontier vigilantism.**

Mechanically: misfortune happens, an actor seeks an explanation, and candidate blame flows along existing negative Opinions and Notoriety. Rumor spreads with mutation, and a threshold triggers collective action. The real witch is *one candidate among many*, and the system shouldn't privilege her unless evidence does.

**The ladder is `04`'s (C41).** `04` §9 owns the persecution mechanism for any *person or Figure*, with rungs 0 to 6 (Unease, Whispers, Accusation, Shunning, Institutional, Hunt, Mob/Trial), driven by Heat and Consensus. `05`'s alert level covers only non-person threats (wolves, fire, epidemics), and its S6 witch panic is `04` rungs 5–6. `06` supplies the witch-facing labels:

| `04` rung | `06` Notoriety label |
|---|---|
| 0 Unease | Unknown |
| 1 Whispers | Whispered |
| 2 Accusation, 3 Shunning | Suspected |
| 4 Institutional | Known |
| 5 Hunt, 6 Mob/Trial | Hunted |

**What gets accused is a Figure.** A hunt is aimed at a rumor identity (a Figure such as "the Bluff Witch"), which may or may not be linked to a real actor (`04` §5.1). It is not a Jungian Persona. The mask a person presents is the Persona (`10` §8.1). A Figure is the shape of a rumor.

**The mind behind the mob (`10` §7, §15.1).** Misfortune creates anxiety. A frightened village discharges it through **projection** (finding in others the traits it won't own) and **displacement** (aggression at a safer target). That is why accusations flow along existing grudges and also toward people who are *different*. Prejudice enters only as belief and prior (`12` §11): the sim never makes it true. A rigid-conscience crusade is the Ice's work (§4.7).

---

### 5.7 Supply and the seasons: the setting side of P8 [PROPOSAL]

P8 makes food and consumables real. `03` owns the item fields, `05` the burn rates and spoilage physics. This subsection is the *setting texture* that gives those numbers a calendar and a landscape.

- **The hungry gap.** In a farm county in 1855, late winter and early spring are the lean months: the cellar is low, the salt pork barrel is nearly empty, the hens haven't laid, and the first greens are weeks off. April is when the game starts. Morels, ramps, and early cress come in just then, and the best foraging is in high-intensity coulees whose harvest is tithed (§4.6). A hungry household is *tempted* by fae ground.
- **What a household puts by.** Salt pork and smoked meat, flour and cornmeal from the mill (paid in toll, a share of the grain), root-cellar potatoes, turnips and cabbage, sauerkraut crocks, dried apples, maple sugar and sorghum, and a few bought things: coffee, tea, sugar, salt, and tinware. Salt is shipped in by steamboat, so a frozen river or a failed bank is a supply shock.
- **Cold is a resource.** Springhouses, coulee-bottom cellars, and ice cut in winter and packed in sawdust keep food. The algific slopes (§1.1) hold summer ice, which is both a trade good and a refuge from fae. Goblin crews fit cellars and cave stores that spoil more slowly (`12` §8.6).
- **Provisioning is where the Outfitter lives.** A party's pack is decided at Pratt & Daughter (§8.3): hardtack, bacon, flour, parched corn, dried apples, coffee, a skillet, a pot, oilcloth. Peoples change the *mix* (an elf carries a hearth-loaf and more stores, since Hall custom limits foraging at FI 2 and above; a goblin eats about 70% of a human ration but carries less), not the principle.
- **Pantries are household inventories** on `03`'s item model, for every named household and for institutions like the Club pantry. A ruined harvest, a cursed root cellar, or a hard winter empties them, and the simulation can show it.
- **Fae food versus yours.** Guest-right (§4.5) is a supply question: a party that carries its own food can decline. A party out of food at dusk in a coulee is the scenario the rule exists for.

---

## 6. Peoples

**[DECISION, Ellie 2026-10-10; 00, ADR 0001]** There are four peoples with the ids `human`, `elf`, `shadow_faekin`, `goblin`. The engine still treats ancestry as a data slot with no hardcoded peoples in sim code. What Ellie has said about them is only this:
- Elves are part of "the civilized world of humans and elves."
- Shadow-faekin are "sort of hidden and somewhat between humans and elves." Per the ADR they are concealed by default, pass as human or elf, and are known to others only through beliefs.
- Goblins exist.

**[PROPOSAL]** Everything else (origins, culture, mechanics, relations) is in **`12-peoples.md`**, which owns the roster. Each major choice there has alternatives, and Ellie's own lore overrides it. This section keeps the *structural analysis* that shaped it and says where peoples touch the setting.

### 6.1 Structural roles a people could fill

| Slot | What it gives the setting | Example concept | **Filled by (`12`) [PROPOSAL]** |
|---|---|---|---|
| **Renouncers** | A civilized people who *used to be* of Faerie and chose iron, names, and civilization. Bitterest toward witches (apostate vs. defector) and best informed about fae. | "Elves" as the Fair Folk who left the hill. The Erlking/elf-king etymology (Danish *ellerkonge*) fits nicely. | **Elves**, Option A ("renouncers"): their ancestors left Faerie in the Old World and took baptism, iron, and mortal names. |
| **Underground neighbors** | A mining people with a treaty relationship to the Under-Court | Small, durable folk who partner with the Cornish | **Goblins**, Option G1 ("the Deep Accord"). A small mortal people of the Old World mining uplands. |
| **River people** | A people whose sovereignty is the boundary itself | Boat-dwelling families | **Unfilled.** Goblin Option G2/G3 could grow it later, with a shantyboat-caricature risk (`12` §8.2). |
| **Hearth-kin** | A people who live *inside* human households, like the nisse grown into citizens | A small domestic people with legal status but social marginality | **Deliberately unfilled.** A servile or domestic people echoes slavery in an antebellum setting. `12` §8.1 rejects it outright for goblins. Hearth fae stay fae (Hearth Court). |
| **Newcomers** | A people *also* arriving as immigrants, with their own folk practice and fae reading | A late-arriving people competing for land | **All four.** None was here first. Elves and goblins arrive with the Norwegian, German, Yankee, and Cornish waves; faekin arrive unannounced among all of them. |
| *(new)* **The hidden** | A people who pass | — | **Shadow-faekin**, Option SF-A ("the Unrenounced"). Not elves (no Leaving) and not human, and Faerie doesn't claim them. |

**Cautions (retained and now applied):**
- **No "were here first, close to nature" people.** Given §2, that slot is occupied by real history, and a fantasy people in it reads as a Native stand-in (principle 11). `12` Ground rule 2.
- **No people maps onto a real ethnicity.** Ethnic diversity in this setting is *human* diversity. Elves and goblins each span several Old World nations (`12` Ground rule 3).
- **Peoples are not cultures** (`12` Ground rule 1). Language, literacy, faith, and most norms come from a separate *culture* record. A Norwegian Lutheran elf shares a culture with a Norwegian Lutheran human. This is the main defense against essentialism, and it is why peoples carry no psyche content (`12` §1; `10`).
- **Differences are bodily or metaphysical, never moral or intellectual.** Ability modifiers on STR/DEX/CON at ±1 only, none on INT/WIS/CHA. No people is born good, evil, clever, or dim (`12` Ground rule 4).
- **Prejudice is belief data.** The sim never makes a prejudice true. Faekin aren't disproportionately witches, and goblins aren't disproportionately anything (`12` Ground rule 5).

### 6.2 The questions 01 asked, answered or routed

| Question (earlier draft) | Status |
|---|---|
| Are elves *from* Faerie (renouncers), or separate from it entirely? | **[PROPOSAL, Option A]** Renouncers. Options B (cousins, never fae) and C (fae under charter) in `12` §3.3. **[OPEN]** for Ellie (`12` Q1). |
| Settlers alongside Yankees and Norwegians, or already in the Driftless? | **Settlers.** None of the four was here first, so the Native slot (§2) stays occupied by real history. |
| Can a member of any people become a witch? Does the Prince prefer some? | **Yes, any people can be a witch.** The Prince's preferences are about *story*, not nature: he covets elves (an apostate's return is the best story) and courts faekin as kin. That is recruitment pressure through desperation, not a trait. The Director must not tune it otherwise (`12` §6.2, §10.2). **[OPEN]** (`12` Q13). |
| Do peoples differ mechanically in how fae rules affect them (iron, thresholds)? | **Only by data inputs to `06`'s Drift-keyed weaknesses (C27).** There is no per-people iron rule. Faekin carry a +30 weakness offset, elves −10, and goblins and humans 0. Comfort bands and the Bound rate vary (`12` §10.2). The boolean `cold_iron_sensitive` goes away (`12` §13). |

### 6.3 The four peoples in the setting [PROPOSAL; full treatment in `12`]

**Humans** are the settler majority in all its quarrelling varieties: Yankee, Norwegian, German, Swiss, Cornish, Irish, French and Métis, free Black settlers (§1.4, §5). Cultures carry the content. Humans are the Ego's population in §4.7's frame, and the Prince's thesis is about them.

**Elves** are renouncers: fae who left Faerie in the Old World and became mortal, long-lived (about 150 years) citizens of Christendom, living mixed with their neighbors.
- *Setting hooks:* the Iron Ford bell was cast by an elven founder; the Midsummer Renewal falls on a fae festival night on purpose; Hall custom forbids eating unhallowed forage; they are overrepresented in bell-founding, glazing, grafting, lyceums, and survey crews for *historical and cultural* reasons, and deliberately not in banking, law, or speculation.
- *Relation to Faerie:* apostates to the Prince, who respects what they gave up. They feel the **Pull** at FI 3 and above and resist it. Those who give in fall hard (the **Lapse**).

**Shadow-faekin** are "the Unrenounced": descended from fae who crossed into the mortal world *without* renouncing, kept some of their nature, and hid. They are between mortal and fae by nature, and between human and elf by appearance, because a faekin can pass as either.
- *How they differ from the other "part-fae" mechanisms (C5, `12` §4):* **Drift** (`06`) is acquired movement toward Faerie that anyone can gain; faekin merely have a floor of 10. **Fae-Touched** (`02`) is a vocation trained after a marking event, open to any people. **Changelings** (§7 #12) are real fae infants left by the Alder Court. A *people* born into a community with customs is a fourth thing, and villagers conflate all four. The sim keeps them distinct in ground truth and lets beliefs blur them, which is how `04` attribution should work.
- *Concealment:* **one identity with a concealed attribute**, not an alias or a separate Figure (C47). Ground truth is the actor's ancestry. It is a Secret plus what the actor *presents as*, and others hold `Is(x, faekin)` at some credence. Data-driven tells have mundane lookalikes, folk tests have false positives, and discovery enters `04`'s ladder at rung 1 (`12` §7).
- *Framing, per `12` §7.8:* recommended F1 (folkloric vocabulary: "witch-kin," iron-key tests) plus F2 (universal-psychological: everyone conceals something, faekin are the sharpest case), with F3 (an explicit analogy to real racial passing) avoided because Hollin County contains real Black settlers and their history would be trivialized. **Do not** use real-race terms for faekin ("passing," "one-drop," blood fractions). **Authored-content rule:** the Glovers and the Cheyenne Valley model are never faekin. **Director rule:** `05` may never nudge a faekin tell or seed a faekin rumor, so exposure is always emergent. **[OPEN]** framing is Ellie's call (`12` Q6, `10` Q4, `11` Q4). I recommend F1+F2 and make no claim beyond that.

**Goblins** are the Deep Accord: a small (about 3½–4 ft), mortal people of the Old World mining uplands who struck a treaty with the under-fae, whose ancestors came with the Cornish and German lead miners.
- *Setting hooks:* a pare (work-team) at Penhallow Diggings, quarries, well-digging, powder-men, the saltpeter trade, and a Club with a pantry (§5.2). Knockers knock for them first.
- *Caricature baggage (`12` §8.1):* antisemitic coding (goblins are not bankers, merchants, or hoarders; no gold iconography; no cabal), racial and period Irish caricature (differences are size, eyes, and ears only; skin tones never map onto a human group; no comic drunkenness), "born evil," disability-as-ugliness, infantilizing, servility (rejected), "dirty miners" class contempt (mining is skilled work). Goblins are adults with full dignity, and mining *labor and skill* is theirs, never mining capital.
- *Self-name:* "goblin" was the Old World miners' word. Some prefer *Pare-folk*. **[OPEN]** (`12` Q3).

**Prejudice (`12` §11).** Recommended **P3 (restrained both)**: human-culture priors exist but stay mild and drive *attribution* (who gets suspected), and fantasy-people priors carry the visible, playable prejudice. A **Prejudice dial** scales all group priors from 0 to 150%, and the Chronicle notes when it is off default. `04`'s Outsider term will reproduce real prejudice dynamics either way, so "none" isn't neutral. 1855 is Know-Nothing season (§3.1), so the honest option includes real nativism. **[OPEN]** (`12` Q8).

### 6.4 Bestiary overlap check [C5]

Playable peoples and bestiary creatures must not blur.
- **Goblins vs. knockers (§7 #8).** Knockers are Under-Court fae; goblins are the *mortals who treat with them*. Humans conflate the two, and goblins take "knocker" as an insult. Neither is the other's pet or servant.
- **Goblins vs. kobolds (§7 #2).** The kobold–cobalt etymology is human folk etymology that people use *against* goblins. No creature entry is a goblin.
- **Night Market.** `05` F4 "Goblin market" collides with a playable people. Rename it **Night Market** in ids and system text, and keep "goblin market" only as period human slang in NPC barks, where saying it in front of a goblin takes an `04` insult Reason (`12` §8.1, option c).
- **Elf-shot** is a European folk diagnosis for sudden lameness, and elves resent the name (§2.1 #9).
- **Changelings (§7 #12)** remain Alder Court actors with disguised sheets. They are **not** shadow-faekin and are NPC-only, so `06`'s Changeling mode is re-pitched as **"shadow-faekin coming of age,"** with a knows / suspects / doesn't-know creation option (`12` §4, §7.7; **[OPEN]** `12` Q12).
- **No monsters called goblin, elf, or orc.** Those names are peoples or absent. Hostile fae aren't "goblin raiders," and the bestiary has no spawn table keyed to a people.

### 6.5 Open questions on peoples

Routed to `12` §14 (elf origin, faekin origin, goblin option and self-name, ability mods, intermarriage, concealment framing, false-positive rate, prejudice, Night Market, the +30 offset, the Prince's preferences, population shares, coined words) and `10` Q4 (concealment framing). Ellie's own lore overrides everything in `12`. The coined words in `12` (the Leaving, Halls, the Roll, the Lantern, the Quiet, the Deep Accord, the Club) are placeholders.

---

## 7. Starter bestiary [PROPOSAL]

Sourced from **settler, immigrant, and lumber-camp folklore**: the stories the newcomers carried in. Every creature is an **actor** with a sheet and a mind. "Sim role" describes its off-screen behavior. General sources: James P. Leary, *Wisconsin Folklore* (1998); the Wisconsin collecting of Charles E. Brown (1930s–40s pamphlets); W. T. Cox, *Fearsome Creatures of the Lumberwoods* (1910); H. H. Tryon, *Fearsome Critters* (1939); Norwegian collections by Asbjørnsen and Moe; the Grimms' *Deutsche Sagen*; and Cornish folklore collected by Robert Hunt (1865) and William Bottrell.

| # | Creature | Source | In-world | Sim role / behavior | Habitat (intensity) |
|---|---|---|---|---|---|
| 1 | **Nisse / tomte** | Norwegian/Swedish | Small farm guardian, old and touchy | Bound to a farm site. Opinion of the household changes farm productivity off-screen. Punishes laziness and missed Christmas porridge. Can leave, or turn malicious. | Farms (1) |
| 2 | **Kobold / Hausgeist** | German | Household spirit, cook's helper, prankster | Same slot as the nisse with a more volatile temperament. Poltergeist escalation when neglected. Nisse–kobold friction in mixed households. The kobold–cobalt etymology is folk etymology that humans sometimes turn *against* goblins; a kobold is a fae, not a goblin (§6.4). | Houses, mills (1) |
| 3 | **Huldra / huldrefolk** | Norwegian | A beautiful hill-woman with a cow's tail she hides. Her people live in the hills with their own cattle. | **A social actor:** seeks courtship and marriage with humans. In folk tales, a church wedding makes the tail drop off and she becomes strong and plain. Full relationship-sim participant. | Goat prairies, summer pastures (2–4) |
| 4 | **Nøkk (nøkken)** | Norwegian | Water spirit and shapeshifter (sometimes a white horse). Plays the fiddle, lures swimmers. | Ambush predator at spring pools and millponds. Can also be bargained with to *teach fiddle*. Repelled by steel thrown in the water. | Springs, millponds (3) |
| 5 | **Fossegrim** | Norwegian | Waterfall fiddler | Pure bargain NPC: teaches music for an offering. Bards' patron. | Small falls (3) |
| 6 | **Draug** | Norwegian (sea revenant) | Here: the drowned of the river and its steamboat wrecks | **Undead actor that keeps its living Memories and Grudges.** A great P2 showcase: a dead raftsman still hunting the man who cheated him. | Mississippi, sloughs (2–4) |
| 7 | **Mara** | Scandinavian/German | Nightmare spirit that rides sleepers and tangles horses' manes. In some tales it's the wandering soul of a living person. | Causes a sleep-deprivation condition. **May be linked to a living actor**, so villagers seek "who is the mara?" A witch-panic engine. It is the folklore basis for **hag-riding** (`06` curse #13), a sent dream (`10` §9.3) whose rider wears the face of whoever the sleeper already resents, which makes the victim's own Shadow do the scapegoating. | Anywhere, at night (1–3) |
| 8 | **Knockers / Tommyknockers** | Cornish | Mine spirits. Knock to warn of collapse, or cause it if offended. | Under-Court faction. Opinion of a mine crew drives collapse events. Tribute is pasty crusts. Whistling offends them. **Not goblins.** Goblins are the mortals who treat with them under the Deep Accord, and are warned and spared (§6.4, `12` §8). | Mines (2–4) |
| 9 | **Piskies** (pixie-led) | Cornish/English | Small mischief fae who lead you in circles | Navigation hazard. Turning your coat inside out breaks it. | Fields, coulee mouths (2) |
| 10 | **Will-o'-the-wisp / Irrlicht / Jack o' Lantern** | German/English/Cornish | Lights in the bottoms | Lure that drags travelers' paths toward hazards. Rumor generator ("I saw lights in Lantern Coulee"). | River bottoms (2–3) |
| 11 | **Erlking (Erlkönig)** | German (Herder via Danish *ellerkonge*; Goethe, 1782) | Head of the Alder Court. Courtly, fatal to children. | High-level political actor. Off-screen, his goal is child acquisition, so the director can make a child "sicken." | Alder thickets, fog (4–5) |
| 12 | **Changeling (bytting / Wechselbalg)** | Norwegian/German/Irish | A fae left in place of a taken child | An actor with a *disguised* sheet. It is **not** a shadow-faekin (§6.3, `12` §4). **Sensitivity:** historically used to explain disabled children and justify abuse. Design so suspicion falls on real children too, and the game shows that harm. Never equate disability with changelings. | Hearths (via the Alder Court) |
| 13 | **Nachtkrapp** | German (Swabia/Austria) | The night raven that takes children who stay up late | Mostly a nursery threat that's *occasionally real*. A child-endangerment event source. | Towns at night (1–2) |
| 14 | **Wild Hunt (Oskoreia / Wilde Jagd)** | Norwegian/German | The Yule-season ride of the dead and the fae | **Regional moving event** along ridge roads. Meeting it forces a check. It takes people, or recruits them. | Ridges, Yule (any) |
| 15 | **Moss folk (Moosleute)** | German | Tiny forest people. Want bread, hate caraway. | Trade partners for foragers. Offended by caraway. Gentle until wronged. | Maple coves (2–3) |
| 16 | **Troll** | Norwegian | Huge, slow, turns to stone in sunlight | **Sandstone pillars that aren't always in the same place.** Awake at night, petrified by day. Bridge tolls. | Bluffs, natural bridges (3–4) |
| 17 | **Witch's carrier (milk-hare)** | Scandinavian (Swedish *bjära*) and British witch-hare lore | A familiar that sucks neighbors' cows and brings milk home | **Witch-mode familiar candidate.** Its theft is a detectable pattern villagers can trace. | Farms (1–2) |
| 18 | **Loup-garou** | French-Canadian/Métis voyageur lore | A person under a curse who becomes a wolf. In Québécois tales, the curse falls on those who skip Easter duty for seven years, and drawing blood frees them. | **A condition on a human sheet** rather than a monster type. Any villager could have it. | Anywhere (any) |
| 19 | **Bluff dog** | Modern Upper Midwest cryptid lore (the "dogman," the Bray Road Beast of 1990s Walworth County, outside the Driftless) | An upright canine thing on the bluffs | Transplanted and anachronistic. Use as the fae beast form that the loup-garou rumor *gets confused with*. | Bluffs (3) |
| 20 | **Ridgeway Ghost** | Iowa County, WI, 19th century. Shapeshifting ghost of the old Military Road near Ridgeway. | A road-bound, shapeshifting haunt that rides with travelers | **Bound to a region-graph edge.** Travel encounters on that edge. Takes many forms. | One road (2) |
| 21 | **Hodag** | Rhinelander, WI, 1893 hoax by Eugene Shepard (north woods) | Horned, spiny, foul-smelling, came down on the rafts | Territorial apex beast. Comic-awful. Lumber-camp tall tale made real. | River-bottom thickets (2–3) |
| 22 | **Hidebehind** | Lumber-camp "fearsome critters" | Always behind something | **Line-of-sight mechanic:** it can't be seen and stalks camps. Perception gameplay. | Deep woods (3) |
| 23 | **Agropelter** | Fearsome critters | Throws branches at passersby | Ranged harasser in hollow trees | Woods (2) |
| 24 | **Sidehill gouger** | American tall tale | Legs shorter on one side, can only circle a hill one way | **Made for coulee country.** A harmless-ish nuisance that's trivially escaped by reversing direction (legible rules!). | Steep slopes (2) |
| 25 | **Squonk** | Fearsome critters (Pennsylvania hemlock) | Weeps constantly. Dissolves into tears if captured. | Harmless rumor bait. A collector's item you can never deliver. | Hemlock gorges (3) |
| 26 | **Snow snake** | Lumber-camp tall tale | Invisible in snow | Winter hazard | Ridges in winter (2) |
| 27 | **River serpent** | 19th-century Wisconsin and Lake Pepin lake-serpent reports (collected by Brown) | Something long in the big water | Rare apex event. Steamboat sightings fuel the newspaper. Its folklore is the settler and steamboat-era newspaper marvel only, with no borrowing from Native water-being traditions (§2.1 #3). | Lake Pepin, Mississippi (3) |
| 28 | **Black dog / church grim** | English/Cornish | Churchyard guardian. An omen of death. | Omen actor: attaches to someone the director has flagged at risk. Guards consecrated ground from fae. | Churchyards (0–1) |
| 29 | **Erratic** *(original; was "Drift-wight")* | Setting lore (§4.1) | A granite boulder that shouldn't be here, and walks. A probe of the Ice. Fae call it a till-wight. | **Anti-fae third party.** Lowers intensity wherever it rests. Hostile to everyone, with no preference for any people (§4.1). A long-arc threat. | Algific slopes, anywhere (any) |
| 30 | **Wisps of the Survey** *(original, optional)* | Setting lore | Lost chainmen still running lines | Ghost surveyors pushing the grid forward. Fae fear them. | Coulee heads (3–4) |

**Excluded on purpose:** wendigo, thunderbird, underwater panther and waterspirits, skinwalker, and any being from living Native religious traditions (§2.1). Also no "Indian burial ground" haunts. Also no creature named after, or standing in for, one of the four peoples: no goblin, orc, or elf monsters, and no spawn table keyed to a people (§6.4). Peoples are actors with cultures, not encounters.

---

## 8. Starter county: Hollin County [PROPOSAL]

A single county of about 24 × 30 miles (the Standard World, §3.2). The Mississippi bounds it on the west and the Kickapoo on the east. The Ho-Chunk homeland borders it to the north under Option C, and the Wisconsin River lies to the south. The county seat is on-map (§3.2) and the federal land office is off-map.

**Status under ADR 0003 (C8).** The game generates counties procedurally. **This section is therefore the flavor bible and constraint set for generated counties**, and Hollin County, Iron Ford, and the cast below are the **authored fixture** (the `iron_ford` scenario), a curated seed and a regression and tutorial world. For generation, each named place and person is a **template with placement constraints**, not a coordinate:
- *Iron Ford* = "a mill village on a mid-size creek with fall, at a coulee mouth within a day of a fae anchor, with a smithy that keeps an iron threshold."
- *Lantern Coulee* = the fae-anchor coulee (FI 2 to 5) above the threshold town. *Penhallow Diggings* = the mine district. *Kvale Ridge* = a Lutheran ridge parish at a three-coulee head. *Raft Island Slough* = the river backwater with a wood-yard and ferry.
- The cast (§8.3) is a set of **roles with built-in tensions** (outfitter-with-a-secret, freethinking smith, split-parish pastor, mine captain squeezed between company and knockers, surveyor, debunking editor, militia captain who needs an enemy) that the generator casts onto suitable generated people. `06`'s "Threshold Town" is the *role* that Iron Ford fills in the authored world, and `06`'s guaranteed-institutions checklist is a worldgen validation rule (minus the land office, §3.2).
- The tile and name pools in §8.4 supply the generator's vocabulary.

### 8.1 Named locations

**1. Iron Ford (starter town; Fae intensity 0–1).** A mill village of about 260 people at the mouth of Lantern Coulee, where Hasp Creek drops into the river bottoms. Its name comes from the founding legend that the first smith, Brenner's predecessor, sank a cartload of iron bars into the ford so that whatever followed the settlers down the coulee couldn't cross. The bars are still there, maintained every spring, and it's a civic ritual. That makes the ford a **literal iron threshold** between town and Faerie. The **Outfitter** is here.

**2. Lantern Coulee (2→5).** The adventurer's main wilderness. It's a branching coulee system climbing five miles from Iron Ford to its spring head. The lower coulee has farms that are failing. The middle has a goat prairie called Huldra's Shelf (huldre cattle graze there and you can hear their bells) and the **Cold Stair**, an algific slope with an erratic sitting on it. The upper coulee holds the Prince's court at the Lantern Spring. Wisps at night give it its name. Several fae-adjacent households of the lower coulee are shadow-faekin, passing as human (§8.3 on how many and who is *not*). Surveyor Whitcomb's chain crew has reached the middle coulee, and two chainmen are missing.

**3. Penhallow Diggings (2–4 underground).** A half-abandoned Cornish lead mine on the ridge between coulees. Half the crew went to California in '49. The upper drifts are worked by Captain Trevenna's remaining men, and the lower drifts are flooded and knocker-held. Badger holes in the hillside house squatters, and one is a witch-mode refuge candidate. A Galena company wants to reopen it with a steam pump and doesn't believe in knockers. **[PROPOSAL, `12` §8.3]** A goblin **pare** of about twelve miners and their households works inside Trevenna's remaining crew, and the knockers knock for the pare first. A company that wants to bring in a *new* pare for its Accord standing, and does not ask Trevenna's, is a ready-made quarrel (`12` §8.9 #1).

**4. Kvale Ridge (1).** A Norwegian Lutheran parish with a church, school, and fifteen farms. Every farm has a nisse and nobody admits it. The parish has split over a Haugean lay preacher. The ridge commands the head of three coulees, so it's the human frontline. **[PROPOSAL, `12` §5.2]** Several elven households farm here inside the parish. A lay Hall-reader holds a copy of the Roll and leads the Midsummer Renewal. A Haugean teaching that elves are "baptized but not born again" would give the parish split a peoples dimension that Pastor Tveit cannot afford (`12` §9).

**5. Raft Island Slough (2–3).** A Mississippi backwater maze below Iron Ford, with a steamboat **wood-yard** run by a poor family who sell cordwood to passing boats. There's also a ferry landing and the wreck of the *Fair Columbia* (a boiler explosion in 1849), whose draugar remember who sold the captain bad wood. Ferry and wood-yard hands are among the places faekin households find work (`12` §6.3). Nothing about the site marks them, and nothing should.

### 8.2 Iron Ford: town sketch

**Layout (site map):** a single street along Hasp Creek. The **grist mill** and dam stand at the head, then the **smithy** at the iron ford. Along the street are the **Outfitter** (Pratt & Daughter), **Dunleavy's tavern** (which also serves as the JP's court), the **Sentinel** print shop, the **schoolhouse**, and a frame **Lutheran church** with a bell cast by an elven founder in Prairie du Chien (`12` §5.2). A **Methodist meeting** gathers in Trevenna's parlor. Farms climb the slopes, the **ferry landing** is at the bottom, and the road climbs up to Kvale Ridge.

**Economy:** milling, smithing, wood-yard, cordwood, ginseng buying, and outfitting adventurers and surveyors.

### 8.3 Notable NPCs (social-sim seeds)

Each NPC comes with a secret or tension and a built-in grudge vector.

- **Augusta "Gussie" Pratt** (52, Yankee widow from Vermont), proprietor of **Pratt & Daughter Outfitters**. She holds credit on half the town, and her ledger is social leverage. *Secret:* she buys fae goods quietly. Last fall, fairy gold paid for a winter's flour and turned to oak leaves in her till. She hasn't told anyone, and she's in debt to a Galena wholesaler.
- **Lydia Pratt** (19), her daughter. She's studying lyceum magic by mail-order course and wants to go to the Normal school. She's sweet on Whitcomb's young assistant, who is one of the *missing chainmen*. **[PROPOSAL, `12` §5.9 #1]** He is an elf. The Prince took him as a deserter rather than as prey, and the Hall-reader on Kvale Ridge forbids anyone to bargain for him.
- **Johann Brenner** (44, a Forty-Eighter freethinker from Baden), the blacksmith. He maintains the ford's iron. He doesn't believe in God but absolutely believes in iron. He's in a running public feud with Pastor Tveit, conducted through letters to the *Sentinel*. As a freethinker he is among the safest people in the county to tell a secret like "I am shadow-faekin" (`12` §6.4). He would shrug.
- **Rev. Anders Tveit** (38, university-trained Norwegian Lutheran), pastor of the Iron Ford and Kvale Ridge congregations. His power, per the congregational-magic proposal, is draining because of the split with **Siri Kvale** (60), a Haugean lay preacher whose small Ridge following is fervent.
- **Captain Josiah Trevenna** (55, Cornish mine captain, Methodist class leader). He leaves pasty crusts in the drifts. He owes the Galena company and is caught between them and the knockers. His wife **Loveday** is a pellar: she charms warts, sets bones, and *will be the first person accused if a witch appears.* **[PROPOSAL, `12` §8.3]** His remaining crew includes a goblin pare, and the knockers knock for them first. Trevenna's pasty crusts and the pare's Accord courtesies are the same custom from two angles.
- **Deputy Surveyor Amos Whitcomb** (34, from New York) is running section lines up Lantern Coulee and has lost two chainmen. Rationalist and stubborn. He's the human the Prince most wants hurt, which makes him a natural witch-mode target and an adventurer-mode employer.
- **Horace Bell** (41), editor of the *Iron Ford Sentinel*. Whig drifting toward Republican, and a fierce debunker of fae "superstition," which makes him unwittingly the best anti-fae weapon in town. His bias parameter decides whether a witch hunt is reported as justice or disgrace.
- **Michael Dunleavy** (47, Irish), tavern keeper and justice of the peace. The tavern is the social hub. His wife **Nora** knows changeling lore and watches their new baby very closely, too closely. (Her fear is the historical changeling-suspicion pattern, §7 #12. The sim should show that it harms a real child. `12` §12 notes that the Irish were drawn as apelike "goblins" in 1850s cartoons, so no goblin in this game gets Irish coding, and Dunleavy is written as an ordinary tavern keeper.)
- **Captain Elias Hurd** (46), militia captain and Black Hawk War veteran. His war story grows every time he tells it, which showcases memory drift. His standing depends on being the town's protector, so he *needs* a threat. He'll lead any witch hunt.
- **Clara Stoughton** (24, from Connecticut), schoolteacher and a competent minor wizard of the lyceum tradition. She teaches reading and wards. She's privately skeptical of Bell's debunking because she's *measured* things up the coulee. **[PROPOSAL, `12` §9 #1]** She is a natural candidate for the **wrongly suspected** hook: a human, and a lyceum wizard whose Detects lower fae intensity, whom Iron Ford nonetheless comes to believe is faekin. The more she measures, the more a frightened town reads that as a defense. The sim stays honest that she is human.
- **Thomas and Harriet Glover** (Black farmers from Ohio, 40s) own the best spring farm on the coulee's lower slope. Harriet is the county's sharpest horse trader. Whitcomb's new survey line throws their claim into doubt, and a speculator is circling. Their spring's tenant has been courteous to them for years, and nobody else knows why. **[PROPOSAL]** The reason is something they *did*, never something they *are*: they never plowed the spring slope, Harriet leaves the courtesies a Norwegian neighbor taught her, and she once bargained shrewdly with the tenant. It must not be an inherited gift, a special sight, or a mystical tie. And per `12` §6.3 they are never faekin in authored content: fantasy concealment must not be mapped onto real racial history.
- **Tollef Haugen** (58, Norwegian), the miller. His mill never floods because of the nisse he keeps fed. He lies to Pastor Tveit about it.
- **[Role, no name yet] The Hall-reader (elf, Kvale Ridge farmer) [PROPOSAL, `12` §5.2].** Keeps a copy of the Roll, leads the Midsummer Renewal, and forbids bargaining for the missing chainman. His farm-daughter, home from Huldra's Shelf humming tunes nobody taught her, is at Drift 38 (`12` §5.9 #3). *Tension:* the Catechism against his daughter.
- **[Role, no name yet] The Accord-speaker (goblin elder, Penhallow) [PROPOSAL, `12` §8.3].** Handles tribute and courtesy with the Under-Court and is the first person called when a drift goes wrong. *Tension:* the company's new pare and the steam pump.
- **[Role, no name yet] A lower-coulee household (shadow-faekin, passing as human) [PROPOSAL, `12` §6.3].** Keeps to the Lantern, shelters no one, and has been in the county eleven years. *Tension:* their eldest has started not aging like her friends. **[OPEN]** Whether any *named* cast member is faekin is Ellie's call. I recommend not, so the cast stays free of concealment and the sim discovers it among generated households.
- **[Placeholder: Ho-Chunk neighbor or trader]**, per §2 option. Probably a ginseng and fur buyer with business ties to Pratt and a political view on the surveyors. Their name and details wait for consultation.

**Inner-life seeds [PROPOSAL, for `10`; numbers are `10`'s].** A one-line psyche sketch per major character, so the Id/Superego conflict has something to arbitrate on day one. Norms and drives are `10` §3 vocabulary; the likely defenses are from its catalog, never destiny.

| Character | Id pulls (drives) | Superego holds (norms, source) | Likely defense under strain |
|---|---|---|---|
| **Gussie Pratt** | `greed`, `fear` of ruin | `thrift` and `honesty` (parent), shame of debt (community) | Rationalization ("the fairy gold was a fair trade") |
| **Johann Brenner** | `rage`, `lust` for argument | Freethinker `honesty` (self), `duty` to the ford | Sublimation into iron and letters to the *Sentinel* |
| **Rev. Anders Tveit** | `fear` of losing his flock, `envy` of Kvale | `piety`, `propriety` (church) | Reaction formation (zeal against what he privately fears) |
| **Capt. Elias Hurd** | `fear`, `greed` for standing | `duty`, `shame` (community) | Projection and identification: he *needs* an enemy |
| **Josiah Trevenna** | `fear`, `hunger` for safe wages | Methodist `duty`, `neighborliness`, Cornish custom | Undoing: pasty crusts as penance |
| **Clara Stoughton** | `longing` for East and certainty | `honesty` (self), `propriety` | Isolation of affect, which reads as coldness |
| **Nora Dunleavy** | `fear` for the baby | Catholic `piety`, `our_own` | Displacement and projection onto the child |

**Seeded tensions the sim can run from day one:** Brenner vs. Tveit; Tveit vs. Kvale; Glovers vs. the speculator (with Whitcomb in the middle); Pratt's secret debt; Lydia and the missing chainman; Trevenna caught between the company and the knockers; Nora's changeling fear; Hurd's need for an enemy; and, if Ellie and `12` confirm them, the Hall-reader's daughter at Drift 38, the missing elf chainman, and the company's new goblin pare.

### 8.4 Names crosswalk for the C7 pass [PROPOSAL]

Seven docs use different counties, towns, and people. Once Ellie approves §8, one names pass should move every worked example into Hollin County or mark it *illustrative, not canon*. This table proposes the mapping. Real towns used as on-map places (Viroqua, Readstown) are the main contradiction with §3.2.

| Doc | Used there | Proposed |
|---|---|---|
| `02` §14 | Kettle Coulee; Rush Creek ford; Haugen farm; **Readstown** store | Kettle Coulee as a side-coulee of Lantern Coulee. Rush Creek ford becomes Iron Ford (Hasp Creek). Haugen's farm becomes a Kvale Ridge farm of the miller's kin. The Readstown store (Readstown is real, so off-map) becomes Pratt & Daughter. |
| `03` | Bank of Kickapoo Valley; Black Earth Creek; "Father Doyle"; Viroqua (in a chronicle line) | The bank becomes a county-seat branch (a failing wildcat note-issuer). Black Earth Creek becomes Hasp Creek. Father Doyle is the county-seat priest (Irish Catholic, Dunleavy's parish). Viroqua is a real town, so it stays an off-map city or is replaced by the fictional county seat. |
| `04` §15 | Rush Creek (~180); Viroqua; Readstown (real towns, so off-map or replaced by the county seat and Iron Ford); Hemlock Coulee; ***Bad Axe Clarion*** (editor Sloane); **Rev. Whitcomb**; Deacon Pruitt; Sheriff Rude | Rush Creek becomes a second, smaller village (a Large-World addition, or illustrative). Hemlock Coulee is a Lantern side-coulee. The *Clarion* is the county-seat paper. **Rename Rev. Whitcomb** (clashes with Surveyor Whitcomb; "Rev. Whitlock" works). Deacon Pruitt stays, since `03` no longer uses Pruitt. Sheriff Rude is the county sheriff. |
| `05` | Fenner Coulee; the Vogt farm | A Kvale Ridge side-coulee and a ridge farm |
| `06` §9 | **Prairie Landing**; Halvorsen's Outfitting; Rush Coulee; Bear Creek; Hollow Coulee; Sugar Bluff; Hartmann mill; Doyle | These illustrate a *generated* World (C8) and can stay, labeled so. |
| Duplicates | "Brandt" four times (`04`, `06`, and a `06` "Josiah Brandt" beside `02`'s Josiah Penhallow); three different newspapers | Rename two Brandts. Three papers collapse to the *Sentinel* (village) and the county-seat paper. |

**Name pools for the generator.** Surnames and given names by culture (Yankee, Norwegian, German, Swiss, Cornish, Irish, French and Métis, free Black settlers) are `content/base/names/*.toml`. Elves share their country's pool, weighted to saints' and apostles' names. Faekin draw from their presenting community's most common names (`12` §5.4, §6.5), and goblins use Cornish and German pools (`12` §8.4). **No invented Tolkien-style names** for elves and **no comic or diminutive names** for goblins.

---

## 9. Tone guide

### 9.1 What it feels like [PROPOSAL]

- **Folk-uncanny, not horror.** The dread is real and specific (fog in the coulee at dusk, a bell heard where no cow should be), but the world is mostly *ordinary*. Fae matter because daily life is so concrete: ledgers, chores, sermons, debts.
- **Practical people in an impractical land.** Settlers don't marvel at faeries. They nail horseshoes, argue about which tradition's charms work, and get on with the harvest.
- **Off-kilter, not alternate.** Everything is *almost* the real 1850s. The newspaper runs a "Strayed and Stolen" column that lists a cow, a horse, and a child. The general store sells nails by the pound and also by the doorway. Bells ring at noon "to set the time right."
- **Seasonal.** Spring mud and morels. Summer storms and goat-prairie revels. Autumn harvest and the Wild Hunt's first rumors. Winter isolation, Christmas porridge, and the river frozen into a road.
- **Moral texture.** Nobody's simply right. The surveyor is honest and destroying something. The Prince is sincere and monstrous. The mob is frightened and wrong.
- **Inner lives in period voice (P7).** The game shows minds through the vocabulary of the 1850s, not the clinic: *conscience*, *the Old Adam*, *self-command*, *nerves*, *the Hidden Self*, *self-culture*, *the Deep Commons* (`10` §12). Characters think in mental philosophy, phrenology, pietist soul-talk, and spiritualism. A **Clinical labels** toggle exists for players who want Freud and Jung's terms, but the default world never says "id" or "projection." The psychology runs underneath as structure, not narration.
- **Peoples are neighbors.** Elves, goblins, and faekin are written as people with jobs, debts, congregations, and grudges, not as exotic. Difference shows up in small, specific, domestic ways: a hand-bell by the door, a pare's club dues, a particular knot in a fence-rail tie.

### 9.2 Avoid [PROPOSAL]

- **Cowboys:** cattle drives, quick-draw duels, swinging saloon doors, Stetsons, tin-star sheriffs, "lawless Wild West." Our frontier is *farm, mill, mine, and river*.
- **Steampunk:** brass, gears, airships, magitech. Technology stays at period level.
- **Grimdark:** atrocity for texture, everyone vile, misery as aesthetic. Witch mode is dark, but its darkness should be *meaningful*, about grudges and their cost.
- **Twee:** cottagecore fairies, Thomas Kinkade glow, Midwestern-nice parody, Fargo-accent comedy.
- **Faux-medieval:** no castles, knights, or feudal lords. Fae courts are strange, not Arthurian.
- **Native tropes:** see §2.
- **Fantasy-people tropes:** no orc hordes, no Tolkienesque elves, no "noble savage" or "primitive tribe" reading of any people, no goblin-as-vermin or goblin-as-banker, no people who are good or evil by birth (§6.1, `12` §8.1). No people is a stand-in for a real ethnicity.
- **Therapy-speak:** clinical jargon, pop-psych diagnosis, a character who "has issues." The psyche is period-voiced (§9.1), and nobody says "your inner child."
- **Misusing real analogies:** concealment and persecution echo several real histories (passing, converso history, the closet, European witch panics). The game doesn't borrow real-race vocabulary for faekin and doesn't make any real group the model for a fantasy one (§6.3, `12` §7.8).

### 9.3 Touchstones

- **Literary:** Susanna Clarke, *Jonathan Strange & Mr Norrell* (fae courts with rules and the cost of English magic). John Crowley, *Little, Big* (Faerie as a landscape condition). Ole Rølvaag, *Giants in the Earth* (Norwegian settlers and trolls of the mind on the prairie). Hamlin Garland, *Main-Travelled Roads* and *Boy Life on the Prairie* (he was born in West Salem, Driftless edge). Laura Ingalls Wilder, *Little House in the Big Woods* (Pepin County, the material texture of the catalog feeling). August Derleth's Sac Prairie writings (Sauk City). Manly Wade Wellman's Silver John stories (American folk-fantasy done right). Shirley Jackson, "The Lottery" and *We Have Always Lived in the Castle* (a community discharging its fear onto a scapegoat, which is what the persecution ladder and the defense catalog are for).
- **Film and TV:** *First Cow* and *Meek's Cutoff* (Kelly Reichardt's de-cowboyed frontier). *The Witch* (2015) for persecution dynamics and folk dread, though we're less bleak. *Over the Garden Wall* (autumnal off-kilter Americana, maybe the single best tone match). *Days of Heaven* for light and land.
- **Games:** RimWorld and Dwarf Fortress (stories from systems). *Pentiment* (a community with memory, persecution, and chronicle). *Kentucky Route Zero* (off-kilter Americana). *Cultist Simulator* (legible weird rules).
- **Music:** Hardanger fiddle, shape-note singing, Cornish carols, German hymnody.

---

## 10. Challenges to 00

> **Challenge 1: Pin the start year. [RESOLVED]** 00 now says spring 1855 (§3.1). What remains is the Civil War: a scheduled event or removed (Q2).

> **Challenge 2: Ice "wouldn't trespass" → Ice made a bargain. [ADOPTED in 00's lore hook, marked "proposal, refined in 01"]** It's a minor reframing (§4.1). Making the glacier a counterparty to a Compact gives Faerie a border it can't cross and a dormant antagonist, and it fits the bargain logic. 00's P7 hook already calls it "the Ice." **Remaining:** add "the Ice" to 00's glossary so the word "Drift" is not reused for it (C11).

> **Challenge 3: Not all wilderness is Faerie. [ADOPTED]** 00 now says "the wilds are Faerie, to varying degrees." Low-intensity ordinary woods with wolves and blizzards still need to exist so that Faerie stays special and survival play has a baseline (§4.6).

> **Challenge 4: Accuracy nit. [RESOLVED]** 00 now says "dolomite-capped sandstone bluffs." Keep "limestone" as the in-world colloquial word.

> **Challenge 5: Doc-map rows and the "Setting in brief."** 00's doc map still describes `01` as covering "peoples (as slots)". It should say "peoples summary; roster in `12`." The "Setting in brief" calls Hollin County a proposal. Under ADR 0003 it is a *flavor bible and authored fixture* (§8), and the sentence can say so.

> **Challenge 6: The harm rule.** 00 and `04` should not state "fae can't harm humans" without the scope. §4.5's **Forfeit Rule** is the version the other docs should cite (C14).

---

## 11. Open questions for Ellie

1. **Native nations:** Option A, B, C, or D (§2.2)? I recommend C. Are you willing to budget for paid consultation? Until you choose, generated counties use a placeholder neighbor polity that no shipped build may contain (§2.2).
2. **Civil War:** the start year is decided (spring 1855). Is the war in the timeline as a scheduled April 1861 event, or removed from this alt-history? (Reachable only by legacy time-skips and very long runs.)
3. **Real places:** a fictional county on real rivers with real towns off-map, or fully fictional geography? (Proposed: the county seat is fictional and on-map, and the land office is off-map in a real town, §3.2.)
4. **Real denominations** or fictionalized ones?
5. **Congregational magic:** does clerical power scale with belief in *the cleric* (systemic) or in *God* (theological)?
6. **Witchcraft law:** extralegal persecution only (recommended), or a formal statute and trials?
7. **The Prince's thesis:** should the game ever confirm that fear-based re-enchantment backfires, or leave it ambiguous?
8. **The sleeping sovereign:** is a "rightful monarch who might wake" a story lever you want, or is it too epic for a sim?
9. **Elves (§6.2):** *routed to `12` §14.* Proposed: renouncers from Faerie, settlers (not prior inhabitants), and any people can be a witch. Your lore overrides it.
10. **Iron and the witch:** *resolved by ownership.* `06` owns every fae weakness, keyed to Drift thresholds and the pact; `03`'s Iron Presence is an input; `02`'s Witch features reference `06` (§4.5, C27). Reopen it only if you want iron to be a pact penalty independent of Drift.
11. **Time slippage:** how harsh can it be? Is losing a week to a revel acceptable? (Proposed in §4.5: ratios capped, three days outside per sitting by default, longer only as story events.)
12. **Bestiary tone:** how much lumber-camp comedy (hodag, sidehill gouger, squonk) versus straight folk dread? I'd keep both, with the comedy at low intensity and the dread deep.
13. **Changelings:** do you want them at all, given the historical abuse they rationalized? If yes, are you comfortable with the "suspicion harms real children" framing?
14. **Your own Driftless:** which coulees, towns, or family stories should go in? Your childhood knowledge beats anything in this doc.

*Added 2026-10-10:*

15. **The Forfeit Rule (§4.5, C14):** is "fae may directly harm only those who have forfeited protection (trespass, bargain, hospitality, breached tribute, unclaimed infants, the Hunt's road), read differently by each court" the right scope?
16. **Uncanny grudges don't decay (§4.4, C12):** OK to make grudges founded on fae events exempt from `04`'s decay while ordinary feuds cool? (`04` would add an `uncanny` flag.)
17. **The Prince's fixed core and per-World overlay (§4.4, C15):** OK to generate his temperament and agendas per World, from Capricious, Jealous, and Melancholy only?
18. **Cosmology (§4.7):** keep it as hidden structure that only fae intellectuals and a lyceum crank ever voice (my recommendation, and `10` Q12), or make it explicit lore? And is the sleeping sovereign the land's Self (waking = individuation), or just a regency crisis (Q8)?
19. **Fae "cannot lie" (§4.5, `10` Q9):** sincere but fallible, with hedges (recommended), or literally true?
20. **Scale and seat (§3.2, C9):** is Hollin County the Standard World (~720 sq mi, ~800 named), with the county seat on-map and the land office off-map?
21. **Names crosswalk (§8.4, C7):** approve the mapping and the Rev. Whitcomb rename, so the names pass can run?
22. **Peoples in the authored cast (§8.3):** the elf chainman, the goblin pare at Penhallow, the Hall-reader and Accord-speaker, and an unnamed faekin household. Yes, no, or different? And do you want any *named* cast member to be faekin (I recommend not)?
23. **Festival names (§4.6, C19):** the settlers' festival names, not the Celtic wheel, with a monthly Tithe?
24. **Magic-tradition mapping (§5.3, C17):** the mapping to `02`'s classes and the FI curve (arcane and divine weaken, folk strengthens), plus a settled-pastor path in `02`.

---

## 12. Implementation notes (checked 2026-10-10 against `content/base/` and `packages/`)

The docs are the design target. These are divergences and alignments for the content-world and schema owners. No code was edited.

**Aligned**
- `content/base/places/iron_ford.toml` and `scenarios/iron_ford.toml` implement §8 as a minimal fixture: Iron Ford at Fae intensity 1, the mill, smithy, Pratt & Daughter, Dunleavy's tavern, Lutheran church, Brenner's house, and ferry landing, with Gussie and Lydia Pratt and Johann Brenner, and the seeded *Pratt debt* tension and her secret `deals_with_fae`. Names and ages match §8.3.
- Fae intensity is an integer 0–5 on sites and places, and the core's `faeIntensity` falls back from the place override to the site (`sim/init.ts`). That matches §4.6 and 00 (a per-tile field with a map-level baseline is still to come).
- The scenario schema carries `ancestry` and `presents_as`, and the content check validates both against the peoples list. That is the concealment model in §6.3 (`12` §7.1).

**Divergences**
| Code today | This doc | Change |
|---|---|---|
| `iron_ford.toml`: `tile_ft = 10`, grid 64 × 48 (640 × 480 ft) | `05` §2.1: **5 ft tiles**; a village is 160 × 160 tiles (800 ft) | Set `tile_ft = 5` and rescale the grid to about 160 × 160 so that the mill, street, and slopes fit. The schema default of 10 should also become 5. |
| Only one seeded tension (`pratt_debt`) | §8.3 lists eight, plus the peoples-linked ones (§8.3, if confirmed) | Content-world expands the scenario toward the ~30–40 actors its header promises. |
| Every seeded actor has `ancestry = "human"`; no elf, goblin, or faekin exists in the scenario | §8.3 proposes an elven chainman, a goblin pare at Penhallow, a Hall-reader, an Accord-speaker, and an unnamed faekin household | Add them only after Ellie confirms (Q22). The scenario has the fields it needs. |
| `peoples.toml` is placeholder (`cold_iron_sensitive`, elf lifespans to 300, goblin lifespans to 60, per-people `literacy_pct`) | `12` §13 lists each fix | Out of scope here. See `12` §13. |
| No `place` record for Penhallow, Lantern Coulee, Kvale Ridge, or the slough | §8.1 | M5a (worldgen) templates, per ADR 0003. |
| Nothing in the fixture marks fae places as `fictional` barrows or flags `uncanny` grudges | §2.1 #10 and §4.4 need a `fictional` flag on fae barrow features and an `uncanny` tag on founding Memories | Add to the worldgen and `04` schemas when those land. |
