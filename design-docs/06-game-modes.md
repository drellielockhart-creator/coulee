# Coulee — Game Modes

> **Revision 2026-10-10.** Brought into line with `00` (P6–P8, peoples, Figure), the ADRs (TypeScript, determinism, integer game-minutes, headless Commands, procedural worlds), `09`'s ownership calls, and the new `10-psyche`, `11-interface-and-platforms`, and `12-peoples`. What changed:
> - **Creation (§7):** the four peoples with presents-as and self-knowledge; a new Upbringing screen (culture is not people); a Temperament & Conscience screen (psyche setup per `10`) in place of any alignment; one Background table owned here (C31); World size and a fixed spring-1855 start; pocket rules per `11` §2.9.
> - **Witch:** the Pact as an Id bargain with Hold clamps and an introjected Prince (§3.3); Woe restated in integers and read through victims' psyches (§3.6); hag-riding and dream curses per `10` §9 (§3.7); the Prince reconciled with `01` (§3.4).
> - **Weaknesses (§3.8.1, new):** `06` owns them (C27). Two tracks: *nature* (Drift + people offset, with `03` Iron Presence as input) and *claim* (Drift + the Pact's mark). `02`'s Unhallowed now points here.
> - **Persecution (§3.9):** witch-facing labels mapped onto `04` §9 rungs 0–6 (C41); covers are Personas seen as Figures (C47).
> - **Shadow-faekin and the other peoples in both modes (§5.5, new);** Changeling mode re-pitched (§6).
> - **Fixes:** flint "elf arrows" removed and the curse renamed Fairy-Shot (C10); Chronicle truth only in the epilogue (C44); no witchcraft statute (C13); Tithe monthly with a Lammas Behest (C19); Woe as the single fae currency and witch XP (C30, C45); worked examples labeled illustrative and the Brandt name collision removed (C7).
> - **New §12 Implementation notes** (checked against `packages/` and `content/`) and **§13**, a table of the `09` items this doc addresses. Section numbers before §12 are unchanged, so other docs' references still land.

**Status:** Draft for Ellie's review, revised 2026-10-10. Depends on `00-vision-and-pillars.md` (canonical) and `adr/0001`–`0003`. Reads `01`–`05`, `07`, and `10`–`12`. Where this doc needs a number or mechanism another doc owns, it names the owner. **Owns** (per `09` §3): modes, Ambitions, Origins, the Pact, the curse catalog, links, protections, Woe and the Tithe, Drift, **witch weaknesses** (C27), the **witch-facing persecution labels** (C41), Backgrounds (C31), endings, the creation flow, difficulty, and save modes.

**Tags:** **[DECISION]** follows from `00`, an ADR, Ellie, or a recorded lead ownership call. **[PROPOSAL]** is this doc's recommendation. **[OPEN]** needs Ellie.

---

## 0. Summary

- **[DECISION]** Every mode is the same world running under the same rules (P4). A mode is a **starting situation, a set of goals, a set of faction stances, and a small number of exclusive systems** layered on top. It is not a different game.
- **[PROPOSAL]** Mode-exclusive systems should be as thin as possible. The **Curse**, **Woe**, **Pact**, and **Drift** systems described here are written as *general* systems that any actor can use. Witch mode is simply the mode where the player starts with a Pact. The payoff: NPC witches exist in adventurer mode, adventurers hunt witches in witch mode, and both run on the same code.
- **[PROPOSAL]** The witch's power currency is **Woe**: suffering, measured in victims' Minds and multiplied by how much they *believe* they're cursed. The Prince demands a share of it each moon, called the **Tithe** (an echo of the ballad of Tam Lin, where Faerie pays a "teind to Hell"). What's left over buys Gifts. The design is built around one tension: **belief is what makes curses profitable, and belief is also what makes the village hunt you.**
- **[PROPOSAL]** Any actor who spends long enough with Faerie accumulates **Drift**, a universal stat, whatever their mode. A witch who buys transformations drifts fast. An adventurer who takes fae bargains drifts slowly. When Drift is high enough, the actor stops being human (an ending, not a game over).
- **[PROPOSAL]** A **World** persists across **Runs**. When a run ends, its character becomes an NPC or a legend in that world, and the next character, in either mode, inherits the consequences.
- **[DECISION]** No alignment. A character's inner life is `10`'s psyche: Id and Superego voices, an arbitrating Ego, anxiety, defenses, Persona and Shadow. **[PROPOSAL]** In witch mode, the Pact is an **Id bargain**, the Prince becomes a second conscience in her head, and Woe is read out of victims' psyches, so it's fed by the same fear that hunts her (§3.3, §3.6).
- **[DECISION]** Four peoples (humans, elves, shadow-faekin, goblins), with lore in `12`. **[PROPOSAL]** Every people can play either mode. Peoples feed this doc's systems only as data: a Drift floor, Drift-gain bands, and a weakness offset (§3.8.1, §5.5).
- **[DECISION, lead call]** This doc owns **witch weaknesses**, keyed to Drift and the Pact, with `03`'s iron load as an input (C27). It supplies the **witch-facing labels** for `04`'s persecution rungs, and doesn't run a ladder of its own (C41).

---

## 1. Shared frame

### 1.1 What every mode has in common

| Element | Shared behavior | Owner |
|---|---|---|
| World | One generated region (coulees, river towns, farms, fae sites), simulated at T0/T1/T2 LOD | 05, 07 |
| Character | One sheet + Mind, same rules as every NPC (P2). The Mind's psyche (drives, norms, anxiety, defenses, Persona, Shadow, dreams) is `10`'s | 02, 04, 10 |
| People | Human, elf, shadow-faekin, or goblin, as content data; culture is a separate record | 12 |
| Creation flow | Same screen sequence; modes swap in mode-specific screens (§7). Pocket and Desk layouts per `11` §2.9 | this doc, 11 |
| Time | Real-time-with-pause on site maps, compressed overland travel, calendar with seasons, moon, Sabbath, harvest. Canonical clock is integer game-minutes; T0 adds a sub-minute clock for movement and combat (C21) | 00, ADR, 05, 07 |
| Social sim | Memories, beliefs, opinions, rumors, grudges, Figures, notoriety, and the persecution ladder, all running off-screen | 04 |
| Director | Watches pacing and nudges the sim; each mode gets its own *pressure vocabulary* (§1.4) | 05 |
| Run end | Death, retirement, or **departure** (transformation, exile, vanishing into Faerie) | 00 P5, this doc |
| Chronicle | Readable history of the run, written from the event log | 05 (owner, C44); this doc supplies the ledger contents |
| Legacy | A new character in the same, changed world | this doc + 07 |

### 1.2 Runs, Worlds, and the Chronicle

**[PROPOSAL]** Separate the **World** (persistent: map, actors, history, faction state) from the **Run** (one protagonist's life). A World can host any number of sequential Runs.

- **The Chronicle** is generated from the event log. `05` §11 owns it (voices, knowledge basis, epilogue). It's written in the register of a county history or a ballad sheet, depending on the event: *"In the autumn of '55 Josiah Penhallow came up the Kickapoo with forty dollars and a borrowed rifle..."* It contains:
  - a **timeline** of notable events filtered by salience (05/04 provide salience scores);
  - **people**: everyone the protagonist meaningfully affected, and what they now think of them;
  - **the ledger** (this doc supplies its contents): money made and lost, debts, kills, Woe harvested, curses cast, lives saved, and the people blamed for things the protagonist did;
  - **songs and rumors**: what the county *believes* happened, shown next to what actually happened. This side-by-side view of rumor and truth is the signature feature. It turns 04's rumor distortion into the reward.
- **[PROPOSAL, revised for C44]** The Chronicle can be read at any time during play, not only at the end. RimWorld players narrate their colonies themselves, and we should help. **During play it shows only what the PC knows** (P1): the rumor column, plus whatever truth the PC witnessed or learned. The **side-by-side truth column appears only in the post-run epilogue**, along with the hidden things P1 gates: the defenses that fired (`10`), who was really faekin (`12`), and the Director's Ledger.
- **[OPEN]** Should the Chronicle be exportable as a nicely formatted text or HTML document for sharing? Recommended, and cheap.

### 1.3 Death, retirement, departure

**[DECISION]** A run ends when the character dies or retires (P5).

**[DECISION]** `00` P5 now names a third category, **departure** (this doc's earlier challenge, accepted): the character leaves the playable world without dying. Examples: becoming fae, going under the hill for a hundred years, taking the steamboat to St. Louis forever, imprisonment for life. Departure is a distinct category because the character stays in the World (as a fae noble, as a legend, as an inmate) and can show up in later runs. That differs from both death and retirement.

| End | Trigger | What the character becomes in the World |
|---|---|---|
| Death | Vigor/Wounds per 02; execution; exposure; fae taking | A grave, a ghost-rumor, an estate (heirs inherit gear and debts) |
| Retirement | Player chooses it once **retirement conditions** are met (§2.8, §3.12), or at any time with a "quiet ending" | NPC living at a home site, with T1/T2 sim |
| Departure | Story condition (Drift 100, imprisonment, emigration, pact resolution) | Fae actor, absent actor, or prisoner, who may return as an event |

### 1.4 Core loops at three timescales

| Timescale | Shared skeleton | Adventurer fills it with | Witch fills it with |
|---|---|---|---|
| **Moment** (seconds–minutes, site map) | Move, perceive, act, react; real-time-with-pause | Tactical combat, climbing a bluff, haggling, picking a lock, reading fae signs | Stalking a farmstead at night, gathering a link (hair, footprint soil), the ritual itself, fleeing dogs |
| **Day / Expedition** (hours–weeks, region map + sites) | Plan → go → spend resources → come back changed | Outfit → travel → camp → explore → encounter → return → sell/rest/socialize | Choose a target → gather links → cast → watch the Woe come in → lie low → answer the Prince |
| **Season / Campaign** (months–years) | Calendar pressure, relationships maturing, faction shifts | Debts paid, fame grows, homestead raised, rivals made, fae entanglements | Moon-by-moon Tithe, notoriety rises and falls, the hunt, Drift, the pact's endgame |

**[PROPOSAL]** Each mode gives the Director a **pressure vocabulary**: the kinds of nudges it prefers.
- Adventurer: rumors of treasure, creditor patience running out, wolves hungrier in a hard winter, a rival outfitting for the same cave.
- Witch: the Prince's impatience, a cunning-man arriving in town, a revival meeting that whips up fear, a scapegoat accused in your place (a moral test, not a threat).

**[DECISION]** Nudges work through the rules, and a nudge may only voice a fact some in-world carrier knows (`05` §8.3, C43). The Director can make a fear-rumor spread faster; it can't invent the accusation. **[PROPOSAL, from `12` §7.8]** The Director may never nudge a faekin tell or seed a faekin rumor, in any mode. Exposure is always emergent.

---

## 2. Adventurer mode

### 2.1 Fantasy and premise

You're a newcomer, or a local with something to prove, at a town on the edge of the wilds, with some dollars, a reason, and a list of things to buy. You go up the coulees into country where Faerie never left, and you come back with money, scars, debts, friends, and stories. Or you don't come back.

### 2.2 The opening: the edge-of-wilderness town

**[PROPOSAL]** Every adventurer run starts in a **Threshold Town**: the last settlement before high Fae intensity. **[DECISION, ADR 0003]** Worlds are procedurally generated, so "Threshold Town" is a **role** that a generated settlement fills, and the guaranteed cast below is a **worldgen constraint and QA rule** (a World without a qualifying town is flagged as degenerate). `01`'s hand-authored **Iron Ford** is the first fixture and the default curated seed (C8). Guaranteed cast:

| Institution | Role in the loop |
|---|---|
| **The Outfitter** | Catalog shopping, credit, buys back some goods (03 owns the details) |
| Tavern / boarding house | Rumors, hirelings, lodging, social life |
| Claims agent (the land office itself may sit at the county seat, on- or off-map per `01`/`05`) | Homestead claims, survey work, maps |
| Assayer / general buyer | Turns finds into dollars; appraises fae oddities (often wrongly) |
| Church / meeting house | Healing, community standing, Sabbath logic, anti-fae sentiment, consecrated ground (§3.8.1) |
| Smithy | Repairs, iron goods (iron matters against fae; see 01, and §3.8.1 for what it does to the fae-touched) |
| A cunning-man or -woman on the outskirts | Folk magic, fae lore, cures; mildly disreputable |
| Doctor or barber-surgeon (maybe) | Injury treatment for a fee |

**[DECISION]** The Outfitter is the opening set-piece. Starting money is in **dollars** and the first real decisions are budget decisions (00 feeling #1). **[PROPOSAL]** The player doesn't pick gear from a menu during character creation. Creation ends with the character standing in the street holding their money. The Outfitter is an in-world shop with a counter, a catalog, a clerk with a Mind, and maybe credit. That's where the catalog feeling lives.

### 2.3 Why go into the wilds: Ambitions

**[PROPOSAL]** At creation the adventurer picks a **Background** (where they come from, which sets skills, contacts, and starting dollars) and one or two **Ambitions** (why they're here, which sets goals the sim tracks). Ambitions work like RimWorld backstories crossed with CK traits: they seed *actors and facts* into the World, not just text.

| Ambition | Seeds in the World | Goal / pressure | Resolves when |
|---|---|---|---|
| **Debt** | A creditor actor (banker, uncle, steamboat captain) with a Grudge-in-waiting; a due date | Pay $X by a date; creditor sends reminders, then agents | Paid off (relief, opinion boost) or defaulted (lawsuit, debt-collector actor, flight) |
| **Treasure rumor** | A Rumor whose truth is randomized (true, partly true, a fae lure, someone else's scam); a rival who heard it too | Find the lost lead cache, the Frenchman's silver, the fae hoard | Found, disproven, or a rival gets there first |
| **Bounty** | A target actor (outlaw, beast, or "witch") and a poster in town | Bring them in or bring proof | Captured, killed, or found not to deserve it (see §5) |
| **Missing person** | A real missing actor who *is* somewhere in the sim: taken by fae, run off, dead, or living happily under a new name | Find them | Found in whatever state the sim left them |
| **Scholarly curiosity** | A sponsoring society that pays for specimens and notes; a journal item | Catalog N fae phenomena, map a cave system, collect specimens | Publication, a lecture invitation, Notoriety among the learned |
| **Homestead claim** | A claim filed on land with a complication (fae site on it, disputed boundary, squatter) | "Prove up": build, clear, live there N seasons | Deed granted; transitions toward Homesteader play (§6) |
| **Fae-touched** | A missing year in your memory; a fae actor who knows you | Learn what happened to you | Learned, and maybe you owe something |
| **Fleeing the past** | A pursuer actor in T2 who's slowly closing in | Keep your secret; build a new name | Secret kept, revealed, or pursuer confronted |
| **Calling / mission** | A church or society backing you; a parish to serve | Build a congregation, cleanse a fae site | Your institution takes root |
| **Glory** | Nothing seeded, only a hunger | Become widely and favorably known: `04` Notoriety ≥ 60% with positive Reputation in at least half the county's settlements (placeholder until `04` publishes a tier table, C42) | Ballads are sung (literally: the Chronicle generates one) |

**[PROPOSAL]** Ambitions can change during play. The sim can **offer** new Ambitions when circumstances fit: you saved a child, the parents want a godparent; you killed a fae hound and the Court wants weregild. Accepting is a choice. This is the CK "new ambition" pattern.

**[PROPOSAL]** Traits and Ambitions are separate. Traits are who you are (Greedy, Pious, Fae-blind, Teetotaler, Night Owl); in the psyche (`10`) they set drive weights, norm strengths, and defense styles. Ambitions are what you want; in the psyche they're standing goals whose progress and setbacks generate Id and Superego Thoughts ("Twelve dollars. Bring back pelts.").

### 2.4 The expedition loop

| Phase | Where | Key decisions | Systems |
|---|---|---|---|
| **Plan** | Town, region map | Where to go and why (rumor, bounty, map), how long, season and moon timing, who to bring | Rumors (04), maps as items (03), calendar (05) |
| **Outfit** | Outfitter, other shops | Budget vs. weight vs. preparedness; which foods (calories, keeping, cooking needs); buy on credit? | 03 catalog and P8 food fields, encumbrance, the provisions planner (`11` §2.8), credit as a social relationship (04) |
| **Travel** | Region map | Route (ridge vs. bottomland vs. river), pace, forage or carry | Overland time compression, weather, travel events (05); kcal burn by pace (05) |
| **Camp** | Generated camp site map | Fire or no fire, watch rotation, shelter quality; what to cook and what to eat cold; when to sleep under fae moons | Needs, fatigue, cold, cooking prep and fuel (03/05), dreams (10 §9), night encounters (05), the bedroll you bought (03) |
| **Explore** | Site maps: caves, glades, ruins, old mines | Push on or turn back; what to carry out | Skills, light, rope; Fae intensity rules |
| **Encounter** | Anywhere | Fight, talk, flee, bargain, trick | Combat (02), fae etiquette (01), social checks |
| **Return** | Region map | Route home, injuries, encumbrance of loot | Same as travel, with consequences |
| **Settle up** | Town | Sell, pay debts, heal, carouse, tell the tale, train/level | Economy (03), social (04), progression (02) |

**[PROPOSAL]** Expeditions should usually be **1–10 in-game days** and **30–120 real minutes** (on a phone, about 3–12 short sessions; `11` §1.3). Long expeditions (a winter trapline, a deep cave system) are possible but need logistics: caches, pack mules, a hireling who stays to guard the camp.

**[DECISION] P8 makes the expedition loop a supply game.** `03` owns the food and consumable fields, `05` owns burn rates and the effects of hunger and nutrition, and the planner and Readiness panel call the same core functions the sim uses, so "days of food at current rations" is a promise the sim keeps (`07` §3.6, `11` §1.7). What this doc adds is *pressure*: Ambitions with deadlines, rumors that go stale, and a creditor who won't wait mean every extra day of hardtack is a day of something else. Hunger also enters the psyche. Short rations raise Appetite Thoughts in the PC and rage in hirelings, and rage displaces onto whoever's weakest (`10` §15.2).

**[PROPOSAL] "Telling the tale."** When you return, the tavern prompts you to tell what happened. You pick what to emphasize or invent (Deceive/Perform/Persuade checks), and that seeds a **Rumor** with you as the source. Your hirelings tell *their* version too, and it may not match. Fame is something you craft and lose control of, which is pure P2/P3.

### 2.5 Social consequences in town

Adventuring is a social act because everyone in town is a character sheet with opinions.

| Consequence | How it arises | Example |
|---|---|---|
| **Fame / Notoriety** | Rumors with you as subject spread, mutate, decay (04) | "Killed a black dog with a fence post" becomes "wrestled the Devil" |
| **Owing and being owed** | Credit at the Outfitter, a rescue, a loan, a funeral paid for | The Outfitter extends credit because you brought her son back |
| **Romance** | Opinion dimensions (04): attraction + respect + time together | The schoolteacher who reads your specimen notes |
| **Rivals** | Competing Ambitions, insults, failed deals | Another adventuring party racing you to the same cave |
| **Suspicion** | Returning from the wilds unharmed and with fae goods; visible Drift tells, which are also lookalikes for faekin tells (`12` §7.2) | "He came back from Hollow Coulee without a scratch. That's not natural." (§5.3) |
| **Factional standing** | Churches, the mining company, the land office, fae Courts | Cleanse a fae well: church loves you, the Court remembers |

**[PROPOSAL]** Town should feel like the **base layer of a RimWorld colony you don't control**. You come back and things have happened: a wedding, a fire, a feud, the blacksmith's daughter ran off. The Director should make sure **every return to town has at least one change** worth noticing, mostly by surfacing what T1 already produced rather than inventing something.

### 2.6 Hirelings and companions (scope-limited)

**[DECISION]** Single protagonist. Companions are semi-autonomous (00).

**[PROPOSAL]**
- **Cap:** at most 2 human/people companions + 1 animal (dog, mule, horse) in v1. Familiars (witch mode) use the same slot logic.
- **Hiring:** a contract in dollars per day plus a share of finds, and **board**, negotiated (Bargain/Persuade vs. their Mind). Board means the employer feeds them from the same pack, so a hireling is a P8 cost (`12` §8.6: a goblin hand eats 70% of a human ration). Contracts are remembered: stiff a hireling, or short his rations, and the whole tavern hears.
- **Control:** stances, not orders (Follow / Hold here / Guard camp / Scout ahead / Fight freely / Avoid fights), plus context requests ("carry this," "keep watch"). They have needs, fears, and morale; they can refuse, desert, or steal.
- **Companions vs. hirelings:** a hireling becomes a **companion** when their opinion of you crosses a threshold. Companions work for a share or for free, have their own Ambitions, and may ask you to help with them. A companion's personal quest is generated from their sheet, not hand-written.
- **Witnesses:** companions are the main source of truthful, or at least alternate, rumors about you (§2.4).

### 2.7 Long-term progression

| Track | What it is | Notes |
|---|---|---|
| **Character level** | XP and levels, feats, skills, spells (02) | 3.5e shape. **[PROPOSAL]** XP from *overcoming* (fights, traps, discoveries, delivered goals), not just killing |
| **Wealth and property** | Dollars, gear, land, buildings | Homestead claim → cabin → farm. **[PROPOSAL]** The **home site** is a persistent site map kept at T1 while you're away, and it can be raided, burned, or tended by a hired hand |
| **Reputation** | Valenced standing per community and faction | 04 owns the model |
| **Notoriety** | How widely known you are | 00 vocabulary; can be high and negative |
| **Fae entanglements** | Bargains, favors owed, names known, geasa, gifts | The adventurer's dark mirror of the witch's Pact. Each bargain adds **Drift** (§3.8) |
| **Network** | People who trust you, owe you, love you | Effectively your "party" in social terms |
| **Self-Culture** (individuation) | Stages 0–5: meeting and owning the Shadow, the soul-image, the Self (`10` §8.5) | Progression as self-knowledge: each stage reveals more of your own defenses (Insight), raises Self-Command, and is an XP story beat. Advanced by events, not grinding |

**[PROPOSAL] No level scaling.** The world doesn't level with you. Deep Faerie is lethal at level 1 and still dangerous at level 10. Progression opens up *depth* (how far into high Fae intensity you can survive) and *social reach*, not bigger numbers on the same rats.

### 2.8 End states

| End | Condition |
|---|---|
| **Death** | Per 02. Heirs (if any) inherit estate and debts; a grave site appears |
| **Comfortable retirement** | Player-chosen, once: no outstanding debt + a home site + $X savings or income, *or* age ≥ N, *or* a crippling injury |
| **Legendary retirement** | Ambition fulfilled + "County Legend" standing (placeholder: `04` Notoriety ≥ 80% with positive Reputation in most settlements; C42). The Chronicle produces a ballad |
| **Departure** | Gone under the hill (Drift 100 or a fae bargain), emigrated, imprisoned |
| **Quiet ending** | Retire at any time. Recorded honestly in the Chronicle ("She went back to Ohio.") |

### 2.9 Why this isn't "Skyrim in Wisconsin"

1. **Logistics are the game.** What you carried decides what you can do. Skyrim never asks whether you brought a second pair of socks; Driftless winters will.
2. **The world doesn't wait or scale.** Quest givers die, rumors go stale, the treasure gets found by someone else, the creditor sues.
3. **Consequence over content.** There are almost no authored quests. Goals come from Ambitions, rumors, and other actors' needs. The story is what the systems do.
4. **The town is the other half of the game.** Your reputation, debts, and relationships are as important as your sword. Skyrim's NPCs are furniture; ours are character sheets with grudges.
5. **Faerie isn't monsters with HP.** High Fae intensity changes rules: names have power, bargains bind, iron burns, time slips, hospitality is law. Fighting is often the worst option.
6. **One life, and history accumulates.** Permadeath by default (§8), and a World that remembers previous runs.
7. **It's legible.** You can always see why you failed (P1). The pleasure is mastery of a system, not spectacle.

---

## 3. Witch mode

### 3.1 Fantasy and premise

You made a bargain with the Faerie Prince, or one was made for you. Now you belong to his Court: exiled from the company of your own people, whether human, elven, faekin, or goblin, living in the wilds, and obliged to deliver suffering. Every curse makes you stronger, and every curse makes the village a little more frightened, a little more certain, a little more organized. The question each run asks is **what kind of witch you will be**, and what it costs to choose.

### 3.2 Handling the theme (read this first)

The witch-hunt theme sits close to real history. Thousands of people were executed in early modern Europe and colonial America, and most of them were women, disproportionately poor, widowed, elderly, outspoken, or otherwise marginal. Folk-magic accusations and violence continued well into the 19th and even 20th centuries (the 1895 killing of Bridget Cleary in Ireland as a suspected changeling; the 1928 "hex murder" in York County, Pennsylvania). The period setting puts us right in the zone of real cunning-folk, braucherei ("powwowing"; `01` §5.3 keeps that word out of the game), and hex belief among German, Cornish, Irish, and Yankee settlers.

The tension: Ellie's premise makes the witch *really* guilty. She really does curse people. That's the opposite of the historical truth, where the accused were innocent. Done carelessly, this ends up saying "the witch-hunters were right."

**[PROPOSAL] Recommended approach: make the simulation tell the historical truth even though the protagonist is a real witch.**

1. **Persecution is indiscriminate by design.** 04's suspicion model should make the village's *selection* of suspects follow real-world bias: outsiders, widows, the poor, the odd, the unmarried, the quarrelsome, people of the "wrong" ancestry or church. The village almost never identifies the actual witch first. **Innocent people get accused**, and the player sees it happen. This is emergent, not scripted, and it's the single most important thematic lever.
2. **The witch is also a victim.** Every Origin (§3.3) is a story of coercion, desperation, or injustice. The Prince is the true predator. The game never pretends the witch chose freely.
3. **Real costs land on real people.** Victims are full actors with families, memories, and grief (P2). The Chronicle names them. Suffering isn't abstracted into a resource bar the player can ignore: Woe is *literally read out of named people's Minds*.
4. **Mercy and defiance are mechanically real paths,** not "bad ending vs. good ending" flavor. A low-harm, defiant witch is harder to play but fully viable (§3.9).
5. **No glorified torture.** The game can depict trials, ordeals, and mob violence, but frames them as horror, never as spectacle or reward. Historically, 19th-century American persecution was mostly **extralegal**: ostracism, charivari, beatings, shootings, "scratching" to draw blood, the swimming ordeal, burning the witch's possessions. Legal executions for witchcraft had ended. That's more frightening and more true than courtroom drama. **[PROPOSAL, C13]** Following `01` §5.4 there's **no witchcraft statute**. `04`'s institutional and trial rungs process only **mundane charges** a curse can look like (poisoning a well, arson, killing stock, slander suits), and church trials are ecclesiastical discipline. Foul the Well (#8) is the curse most likely to bring a real legal charge.
6. **The hunt is the village's own psyche.** `10` §7 makes scapegoating a *mechanism*: frightened minds discharge anxiety by projection and displacement onto weak targets, zealots are made by reaction formation, and friends testify by identification with the aggressor. The village accuses the widow because of what the village can't admit about itself, not because the widow did anything. That's the historical truth, run as simulation. The epilogue can name each defense that fired (`10` §15.1).
7. **No people is guilty by nature.** Prejudice is belief data, never ground truth (`12` §1). Shadow-faekin are over-represented among witches only through one structural channel: persecution makes people desperate, and desperation is where the Prince recruits (`12` §6.2). The Director must not tune it otherwise, and it may never nudge a faekin tell (§1.4).

**[OPEN] Tone options for Ellie:**

| Option | Description | Risk |
|---|---|---|
| **A. Tragic folk horror** (recommended) | Curses are real, persecution is mostly misdirected, and the game's sympathy is with all victims. Power has a visible human cost | Heavier; needs careful writing in event text |
| **B. Dark power fantasy with consequences** | Lean into being the villain (*Dungeon Keeper*, *Overlord*); thematic depth comes from the Chronicle and scapegoats | Can tip into edgy; mitigated by points 1 and 3 above |
| **C. Ambiguous magic** | Curses work *through belief* (Woe needs belief), so it's uncertain whether the witch causes misfortune or just claims it. "Gleaning" (§3.6) is the main loop | Undercuts the power fantasy; very literary |

The systems below support all three; the difference is tuning and writing. **[PROPOSAL]** Default to A, keeping B available by tuning, and make C's gleaning path available in all of them.

**Content toggles [PROPOSAL]:** harm to children (changeling and infant curses can be disabled, or limited to "threatened, never shown"), depiction of mob violence (on-screen / off-screen), animal harm detail, Fits and the `lust` drive (`10` Q13), and the **Prejudice dial** (`12` §11.1: scales all group-opinion priors 0–150%; the Chronicle notes a non-default setting). Toggles are **World flags** fixed at creation (`07` M8), so a toggled-off curse never fires anywhere in that World, NPC witches included. **[PROPOSAL]** The witch's gender and people are player-chosen. Event and rumor text should reflect that accusations fall harder on women and on the marginalized, because `04`'s bias model and `10`'s archetype fit (the Hag cast onto widows who keep herbs) do so, not because of a special rule.

### 3.3 The Pact: Origins

**[PROPOSAL]** The witch picks an **Origin** at creation, just as the adventurer picks an Ambition. The Origin sets: starting **Prince's opinion** of you, the **Hold** (what he holds over you), starting relationships, a hidden or open **Escape Clause**, and the moral color of the run.

| Origin | Story | The Hold | Starting state | Escape Clause (hint) |
|---|---|---|---|---|
| **Debt** | You bargained for a harvest, a husband's life, a mortgage paid. You got it. Now the bill | Your **name** (he can call you, and you must come) | Prince: amused. Family alive and grateful, and ignorant | Pay the debt in full, *in kind*: return what was given |
| **Desperation** | Widowed, starving, turned out by the parish in January. He offered bread | Your **shadow** (Drift starts higher) | Prince: indifferent. The village owes you a guilty conscience | Someone must willingly give you shelter for a winter |
| **Revenge** | Someone wronged you: assault, theft of land, a hanged brother. You asked for power to repay it | Your **anger** (you can't forgive while bound) | Prince: delighted. A named enemy actor with a Grudge, and you have one too | Avenge yourself *or* forgive, and the Pact cracks either way |
| **Inheritance** | Your grandmother's pact passed to you on her deathbed. You never chose this | Your **blood line** (heirs inherit the Pact) | Prince: proprietary. A family hut, old grimoire, village suspicion already primed | End the line, or find the original contract |
| **The Stolen Child** | The Prince took your child. While you serve, the child lives under the hill | **Your child** | Prince: wary (you'll betray him if you can). Strongest defiance motive | Win the child back by fae law: three tasks, a riddle, a ride (Tam Lin pattern) |
| **The Accused** | The village called you a witch before you were one. You fled to the woods and he found you there | Your **reputation** (you can never clear your name while bound) | Prince: patient. Notoriety starts at "Suspected"; you have a grudge against the accusers | Expose the real wrongdoers who accused you |
| **Ambition** | You wanted power and went looking | Your **heart** (literal: kept in a box in Faerie) | Prince: respectful and suspicious. Higher starting Woe, lower starting relationships | Steal the box back |

**[PROPOSAL] Pact Terms.** After the Origin, a short Pact screen sets three clauses, each a choice between 2–3 options (picking from a menu rather than writing anything):
- **Tithe rate:** how much Woe the Prince takes each moon (low / standard / high), traded against starting Gifts.
- **Geas:** a prohibition (never cross running water by your own feet, never refuse a request made three times, never eat salt, never speak your true name). Breaking it has a cost; geasa make good emergent problems. A geas is **absolute from the first day**, while a weakness (§3.8.1) is a graded penalty that arrives with Drift. The running-water geas therefore bites long before the running-water weakness does, and it pays a larger starting Gift to match.
- **Boon:** a starting power the Prince grants.

This is the witch's equivalent of Outfitter shopping: **a catalog of bargains**.

**[PROPOSAL] The Pact is an Id bargain** (`10` §13.3). The Prince bargains with appetite, so each Origin keys a drive, and the **Hold** clamps the psyche. Origins also set **starting Drift** (C27: witches begin above 0):

| Origin | Drive keyed (+20 weight) | Hold's clamp on the psyche | Starting Drift |
|---|---|---|---|
| Debt | `hunger` / `greed` / `fear` (pick one) | "Your name": Persona `control` −20 (masks slip) | 5 |
| Desperation | `hunger` / `fear` | "Your shadow": blocks individuation stage 2 until the shadow is reclaimed (`10` §8.5) | 15 |
| Revenge | `rage` | "Your anger": `rage` drive can't fall below 60 | 5 |
| Inheritance | (none) superego `duty` toward the line, an inherited norm | "Your blood line": the pact norm's speaker is "Grandmother" as well as the Prince | 10 |
| The Stolen Child | `longing` | "Your child": the Prince's commands carry the child's voice when she hesitates | 5 |
| The Accused | `fear`, plus a seeded identification style ("if they call me witch...") | "Your reputation": the accusers' Figure of her can't decay below rung 2 while bound | 5 |
| Ambition | `greed` / `envy` | "Your heart": Affection toward anyone capped at +40 | 10 |

People modifiers then apply (Drift floor 10 for faekin; `12` §10.2).

**[PROPOSAL] The introjected Prince.** On binding, the witch gains a **`pact`-sourced norm** voiced by the Prince (`10` §3.3, §13.3): *"The moon wanes. Remember what you owe."* It carries Behests and the Tithe as Superego Thoughts with real intensity. Her old conscience (Mother, the Pastor, the Hall, the Pare's Word) still speaks, and it forbids what the new one commands. **The witch has two superegos.** That conflict is the mode's moral engine, with no morality meter (§3.11). Starting strength of the pact norm: 60, or 75 for Ambition and Revenge, whose wants already agree with it.

**[OPEN, `10` Q8] Dream bargains.** The Prince can *offer* in dreams (§3.4). **[PROPOSAL]** A dream offer is only an invitation, and consent must be given awake, at a threshold place, in words. That keeps every Origin a choice made under pressure rather than a trick, which matters for §3.2 point 2. The alternative (a dream bargain binds) is pure horror and available as a later Origin variant if Ellie wants it.

### 3.4 The Faerie Prince as an actor

**[DECISION]** The Prince is an actor with a sheet and Mind (P2), the head of a Court (00).

**[PROPOSAL, C15]** His **core is fixed** and belongs to `01` §4.4: the sleeping sovereign's younger son, a sincere zealot for the unsurveyed land, who keeps his word to the letter, is bored by cruelty for its own sake, and prizes harm that *becomes a story*. Calling him "the true predator" (§3.2) means he's the one who coerces; it doesn't mean he's a sadist. A sincere believer who uses a desperate widow as an instrument is worse, and more interesting. Why he needs her at all: **the Fair Folk may not directly harm the unbargained** (`01` §4.4), so a mortal bound by bargain is the Court's loophole. Her hands, her links, and her lies (a mortal can say what fae can't) do what his can't (C14; `01` owns the rule's exact scope).

He's the most important NPC in witch mode and an instrument of the Director, but he still runs on general rules:

- **His mind** is a fae mind (`10` §10): Id plus **Law**, no Ego, no defenses, and grudges and bargain memories that never decay. Law vetoes outright lies, uninvited entry, and broken bargains. He can't speak insincerely, but he can be wrong, and he's a master of the true statement that misleads.
- **Opinion of the witch** uses `04`'s model with no new dimensions (C36): *amusement* is Affection, *esteem* is Respect, *trust* is Trust. *Desire* (does he want her closer, as courtier or prize) is a **targeted `lust`/`longing` drive** in his mind, not an opinion dimension.
- **Temperament** is a per-World **mood overlay** on the fixed core, generated within a template: Capricious, Jealous, Melancholy, Exacting, or Wry. **Hungry and Cold are dropped**, because sadism contradicts `01`'s Prince.
- **Moods** follow the moon and the Court's fortunes. Waxing moon, generous; dark moon, demanding. A defeat by a rival Court makes him harsh and impatient (not cruel for pleasure).
- **His voice in her head.** Through the pact norm (§3.3) he speaks as a Superego voice, and through dreams he speaks directly (`10` §9.2). Behests and summonses arrive as dreams or as Thoughts, and only audiences need a place.
- **His view of peoples [PROPOSAL, `12` Q13 open]:** he *covets* elves (an apostate's return is the best story), *courts* shadow-faekin as kin, and holds goblins in contempt and wariness (harming one is an incident with the Under-Court). These are story preferences, not judgments of nature (`12` §10.2).
- **Agendas** are real goals in the sim that he pursues with or without the witch:
  - stop the new mill dam on his stream (economic actor vs. fae actor);
  - punish a family that broke a fae bargain three generations ago;
  - win a wager with a rival Court ("which of us can make the parson curse God?");
  - acquire a particular mortal: a fiddler, a beautiful child, a midwife;
  - keep the railroad (iron road) out of the coulees, an endgame-scale agenda (01).
- **Behests** are his demands, delivered at moon phases. Each is generated from his agendas plus the witch's capabilities:
  - *"Before the next full moon, the miller Hartmann's wheel will stop."*
  - *"Bring me a lock of the schoolteacher's hair."*
  - *"Let the Lutherans believe the Methodists cursed them."*
  - Behests pay Woe bonuses or Prince opinion, and failure costs opinion and draws punishment.
  - **[PROPOSAL, C19] Lammas Behest.** The Tithe stays monthly (§3.6). At Lammas, the harvest feast, he adds one special **harvest Behest** tied to `05`'s harvest-tithe beat: a field, a mill, a granary. Festival names follow `01`.
- **Punishments** escalate. A missed Tithe and he takes what's owed from *you*: Con damage, a lost memory (forcibly repressed, `10` §7.2: it still shapes beliefs but can't be recalled), a year of your life (age), the use of your voice for a week. Each moon of Arrears also tightens his **claim** (§3.8.1). Repeated failure: he summons you by your name (if he holds it) and you lose time in Faerie.
- **He isn't omniscient.** He knows Woe that flows to him and what his fae informants (crows, hobs, the will-o'-wisp) tell him. That lets the witch **deceive** him, which is a core skill of defiant play. Deceiving a mind that can't lie but can read is a contest of Deceive against his Read People, and his Law means he'll take a carefully *true* statement at face value.
- **He's bound by fae law** (01): literal words, hospitality, the power of names, iron, gifts creating obligation. A clever witch can trap him in his own bargains.

**[PROPOSAL, revised for C15]** "The Prince" is one fixed character (`01`), with a per-World temperament overlay and per-World **agendas** generated from the map (the mill dam is on *this* World's stream). The 1–3 **rival Courts** whose heads can become alternate patrons are `01`'s **Hearth, Under, and Alder Courts** (C16). The Thorn is the Prince's own Court, and the River is not a court.

### 3.5 What a Curse is, mechanically

**[PROPOSAL]** A **Curse** is a ritual Activity that applies a **Malady** to a **target** through a **link**. A Malady is a bundle of `02`'s **effect primitives** (conditions, check modifiers, ability drain) plus Mind effects: a Thought, a memory, an anxiety charge, or a dream (`04`, `10`). "Malady" and `02`'s "effect primitives" are the same idea, and `02`'s name wins in code (C29). Curses are a general system: any actor with a Pact (or the right Gift or feat) can use them. See §5.

**Division of labor (C29).** `06` owns the catalog, links, timing, protections, Trace, backlash, and the Woe economy. **`02` owns the single DC formula.** It must pick between `02` §10.6's form (10 + rite rank + CHA + link) and the level-based form below, which this doc and `10` §15.3 use as the interim. The link and timing bonuses below are inputs either way. The ritual runs as an Activity in game-minutes; at T0 its progress advances on the sub-minute clock, so a dog waking mid-ritual interrupts it at a real instant (C21).

**Anatomy of a curse:**

| Component | Description |
|---|---|
| **Target** | Person, household, animal/herd, field, well/spring, building, or a *relationship* between two people |
| **Link** | The sympathetic connection. Stronger links mean a higher save DC and longer range. See link table |
| **Components** | Physical materials (poppets, thorns, a toad, graveyard dirt, a nail from a coffin), bought, foraged, or stolen |
| **Timing** | Moon phase, hour (midnight, cockcrow), sacred days (Walpurgisnacht, Midsummer Eve/Sankthans, All Hallows, Yule; `01`'s festival names, C19). Right timing raises DC or yield |
| **Casting** | A timed Activity: 10 min to a whole night. Performed in person at a location (crossroads, the target's threshold, your hut's hearth). Claim-track weaknesses apply where she casts (§3.8.1) |
| **Save** | Target's Will or Fort vs. DC. Interim DC = 10 + witch level + Link bonus + Timing bonus + Gift bonuses, pending `02`'s single formula. Will includes the target's **Composure** (`10` §13.1), so a calm, steady mind resists better than a frightened one. Protections add to the save (below) |
| **Duration** | Fixed, until broken, or until a condition is met ("until the cow is sold") |
| **Trace** | What evidence the curse leaves: signs, symptoms, a witness, a physical object. Feeds 04's suspicion |
| **Backlash** | **Sympathy runs both ways.** Countermagic that attacks the curse can hurt the caster (folk belief: plunge a hot iron into the bewitched churn and the witch is burned; boil a witch bottle and she suffers) |

**Links (strongest to weakest):**

| Link | Bonus | Range | How obtained |
|---|---|---|---|
| True name, spoken by the target themselves | +6 | County | Rare: trickery, a christening, a confession |
| Blood, or hair/nail parings | +4 | County | Theft, a familiar, a barber, a hairbrush |
| An accepted gift | +4 | County | Give them an apple, a ribbon, a loaf. Folk belief: never take gifts from a witch |
| Worn clothing / long-held possession | +3 | Region | Theft, a laundry line |
| Footprint soil, a cast-off item | +2 | 1 mile | Follow them |
| Crossing their threshold (invited or not) | +2 | Their household | Bluff in, sneak in, ask for water |
| Eye contact (the Evil Eye) | +1 | Line of sight | Be there |
| Common name only | +0 | 1 mile | Overhear it |

**Protections (folk countermagic, available to NPCs and players alike):** horseshoe over the door (+2 save for the household), rowan cross, a hex sign on the barn (the Pennsylvania-German barn star; +2 for livestock), iron nails in the threshold (crossing links fail), salt across the sill (also a claim-track barrier, §3.8.1), a witch bottle (reflects curses on the household *and* triggers backlash), Bible under the pillow (+2 vs. hag-riding and other dream curses), open scissors or a knife under the pillow (iron; +2 vs. dream curses, and lowers dream receptivity per `10` §9.2), carrying bread and salt, standing as a church member in good standing (+2, from `02` §10.6), and the cunning-man's charm (variable). **[PROPOSAL]** This is **the one protection table** (C29). `02` §10.6's separate values should be replaced by a reference here. These are ordinary items in 03's catalog. The *adventurer's* Outfitter sells horseshoes and rowan charms, and the witch's victims buy them. This keeps economy and curse system one system.

**Iron in the witch's own work.** Several curses use iron (#4's nail, a coffin nail). Iron components stay usable: handling a nail is a few seconds of Iron Presence, and below effective Drift 40 it costs nothing. Higher up, the iron table in §3.8.1 applies, so a deeply drifted witch handles her nails with tongs, a glove, or a familiar's mouth.

**Interface [PROPOSAL; `11` §2.13 owns the layout].** The witch plans at her hearth on **The Working** card. Every number on it (resist odds, expected Woe, Trace, talk) is a **core query** (`curseForecast(plan)`) returning an Explain, so the card and the sim can't disagree. The household members who'll bear the curse are listed by name on the card. Protections she hasn't seen show as `?`, and the odds widen to match. Woe arrives as quiet ledger lines with no celebratory feedback. Toggled-off curses are absent from the catalog. On a phone the card is one scrollable sheet with a thumb-zone **Begin**. Every step is also a headless Command (ADR 0002), so agent playtesters can curse.

**Breaking curses:** a cunning-man's counter-ritual (contested check), destroying the curse object (poppet, witch bottle), drawing the witch's blood ("scratching," which in folk belief breaks the spell and is a horrifying, common historical act of violence), the witch lifting it, or the target getting the witch to **accept a gift** or **speak a blessing** on them. That last one is a social trap: villagers may try to trick a suspected witch into blessing them.

### 3.6 Woe and the Tithe: how suffering becomes power

**[PROPOSAL] Naming.** Use **Woe** for the resource (an old, plain, Driftless-appropriate word) and **the Tithe** for the Prince's monthly cut. Alternatives considered: "Teind" (too obscure as the main resource; fine as flavor for the Tithe), "Misery," "Sorrow," "Bane."

**Woe is generated per victim per day:**

```
Woe/day (per sufferer) = Suffering × Belief × Attribution
```

- **Suffering** (0–5): read from the victim's psyche, counting only what's *attributable to the curse*, including knock-on effects (a lame horse means a lost harvest means hunger). **[PROPOSAL, from `10` §13.3]** `S = min(5, floor(moodLoss / 10) + floor(anxietyGain / 100))`, where `moodLoss` is the summed mood of curse-attributable Thoughts and `anxietyGain` is the day's curse-attributable anxiety (0–1000 scale). Grief from a death caused by a curse is a big, slow source.
- **Belief** (×0.25 to ×2): does the victim think they're bewitched? The tier is read from the victim's `04` Beliefs (credence 0–100):

  | Victim's belief | Read from | Multiplier (per-cent) |
  |---|---|---|
  | Unaware (blames weather, luck, God) | `bewitched(self)` < 20 | 25 |
  | Uneasy ("something's not right") | `bewitched(self)` 20–49 | 75 |
  | Believes they're cursed | `bewitched(self)` ≥ 50 | 150 |
  | Believes they're cursed *and knows by whom* (correctly or not) | also `caused(x, this misfortune)` ≥ 50 for some x | 200 |

- **Attribution** (×0 to ×1): is this suffering linked to the witch? Curses she cast: 100%. Suffering she **claims** (see Gleaning below): 50% if the victim believes she caused it, otherwise 0.
- **Secondary sufferers:** family and close friends of the victim generate Woe at 50% through 04's relationships, using their *own* Suffering and Belief. Cursing a beloved person is worth more than cursing a hermit. Someone suffering as **the accused** (persecution, shunning, a charivari) is also a sufferer of the curse they're blamed for (§3.9).
- **Diminishing returns:** a victim's Woe yield decays as they habituate (×0.8 per week of the same curse), so stacking curses on one family is less efficient than spreading fear, which spreads *suspicion*. In the psyche, habituation is the victim's ego adapting (`10` §13.3).

**The victim's psyche modifies the reading [PROPOSAL, `10` §13.3].** Defenses that fire in the victim change what the witch can harvest:

| Victim's defense | Effect on Woe |
|---|---|
| Denial ("won't hear of it") | Belief capped at Unaware (25) while it lasts |
| Isolation ("steeling oneself") | S −1 |
| Humor ("making light") | S −1, and Belief capped at Uneasy (75) |
| Projection or displacement onto *anyone* | Reaches "knows by whom" (200), whoever they name |
| Repression | Today's S = 0, but S +1 in that night's nightmare |

The upshot: **curses on the calm, the skeptical, and the humorous yield little, and curses on the frightened, the superstitious, and the rigidly righteous yield the most.** Woe is fed by the same minds that hunt witches.

**Integer form [PROPOSAL, C49].** Woe is stored in **centi-Woe** (1 Woe = 100), matching `10` §15.3. Per sufferer per day:

```ts
// all integers; beliefPct ∈ {25,75,150,200}, attrPct ∈ {0,50,100}, kinPct ∈ {50,100}
const raw = S * 100 * beliefPct * attrPct * kinPct * HABIT_PCT[weeks];   // < 2^53
const centiWoe = floorDiv(raw + carry, 100_000_000);
carry = mod(raw + carry, 100_000_000);     // per (sufferer, curse) carry so small yields aren't lost
```

`HABIT_PCT` is a committed integer table (100, 80, 64, 51, 40, 32, 25, 20, 16, 12, then a floor of 10), generated offline by repeated `floor(×80/100)`. No `pow` at runtime (`07` §4.2). Check: Frau Hartmann in §9.2 has S = 2, Unaware, attribution 100%, primary, week 0, so 2 × 100 × 25 × 100 × 100 × 100 / 10⁸ = **50 centi-Woe**, i.e. 0.5 Woe/day. Carl Ahrens in `10` §15.3 has S = 3, Uneasy, giving 225.

**How she knows [PROPOSAL, P1].** The Pact gives the witch a **sense of Woe**, so her Woe ledger shows each sufferer's yield and its Belief tier as `self`-knowledge: she can taste fear. But at the "knows by whom" tier, the ledger says only *"they name someone."* It doesn't say whom. Finding out whether they've named her or a neighbor takes the familiar, a cover identity, or gossip. That gap is where scapegoating gets its moral weight.

**The core tension, stated plainly:** Belief multiplies Woe, but belief is also 04's suspicion pipeline. A curse nobody notices is safe and nearly worthless. A curse that makes the whole valley whisper your name is enormously profitable, and it's how witch-hunts start. The *Belief ×2 "knows by whom"* tier pays the same whether they name you **or an innocent neighbor**. That makes scapegoating the most profitable strategy, which is the moral trap at the center of the mode.

**Gleaning [PROPOSAL]:** the witch can harvest Woe from misfortune she *didn't* cause (a natural death, a barn fire, a hard winter) by **claiming it**: being seen at the funeral, letting the rumor spread that she did it, leaving a sign. Gleaned Woe needs Belief, so it raises notoriety without anyone actually being harmed. It's the low-harm path's main engine, and it has risks:
- The Prince notices gleaned Woe tastes thin. Each moon there's a check: if more than 40% of the Tithe (placeholder, a per-cent integer) is gleaned, his *esteem* drops, unless the witch hides it (Deceive vs. his Read People, Gifts that disguise Woe).
- Claiming a death you didn't cause still gets you hunted for it.

**The Tithe [PROPOSAL, C19]:** **monthly, at each full moon** (the full moon comes from `core` `time.ts`'s integer moon phase), plus the Lammas harvest Behest (§3.4). The Prince takes his share by Pact rate (30/40/50% of the moon's Woe, or a flat minimum, whichever is greater; integer per-cent of centi-Woe). Shortfalls become **Arrears**, which he collects in punishment (§3.4) and which tighten his claim (§3.8.1). Surplus Woe is the witch's to spend.

**[PROPOSAL, C45] One fae currency.** Woe is the single fungible fae currency. NPC witches, the Prince's Court, and rival Courts all run on it. `05`'s fae "glamour" need is satisfied by Woe and by offerings. **Fae intensity** stays the spatial field (`00`/`01`) and isn't spent.

**What Woe buys:**

| Spend | Examples | Cost type |
|---|---|---|
| **Gifts** (permanent powers; three trees) | *Hedge* (survival): speak with beasts, find water, hut-hiding, weatherwise. *Craft* (cursing): weaker links suffice, longer range, curses leave no trace, dual-target curses. *Changes* (transformation): hare-shape, crow-shape, glamour (wear a borrowed face), no reflection, walk unseen at dusk | Woe; some Gifts add Drift |
| **Favor** | Buy the Prince's opinion back, ask for a specific boon, delay a Behest | Woe paid as extra Tithe |
| **Workings** (one-off big magic) | Raise a hailstorm, call a fae hunt against a posse, open a fairy road | Lots of Woe + Prince's permission |
| **Mercies** (protecting humans) | Buy a clause from the Prince: "No harm will come to the Lindqvist household from your Court." These are binding fae law | Woe + Prince opinion; he finds mercy distasteful but bargains are bargains |
| **Healing yourself** | Woe can close wounds and drive off sickness | Woe, at a bad rate |
| **Power from Woe** (`02` §6.3) | The Witch class's own sink: substitute Woe for spell points, boost a DC, fuel a rite | Woe; `02` sets the exchange rates |

**[PROPOSAL, C30] One currency, two sinks, separate XP.** The witch has **one** power currency, Woe. The Witch class's fae spontaneous casting (`02`) stays, and "Power from Woe" is simply a second sink for the same Woe, so there's no parallel resource. Witch level comes from **XP** as usual, while Gifts come from **Woe**. That means a cautious witch can gain levels by surviving and doing things, even with low Woe income. Woe is about breadth of power; XP is about competence. **Curses grant XP only when they overcome something** (`02` §6.6's "overcoming" rule): a protected target, a Behest delivered, a witch-finder evaded, a hunt turned. A routine curse on an unwarded dairy pays Woe and nothing else. Defiant acts (a scapegoat cleared, a Mercy bought, an Escape Clause advanced) and individuation stages (`10` §8.5) are story beats, so the low-harm witch levels too.

### 3.7 Curse catalog

Yields are relative ("Low" is about 1–3 Woe/day per primary sufferer at Belief ×1; "Very High" is 10+). Visibility is how much Trace and suspicion the curse generates. **[PROPOSAL]** v1 ships about 12 of these; the full set is the target.

| # | Curse | Target | Link & components | Timing | Effect | Woe | Visibility |
|---|---|---|---|---|---|---|---|
| 1 | **Sour the Milk** | Dairy household | Threshold or touch of the pail; a pinch of rennet | Any night | Milk sours within the hour; butter, cheese, and income fail | Low | Low (but a classic sign of witchery) |
| 2 | **Hold the Butter** | Household | A pin stuck in their churn dasher | Any | The churn won't "come"; hours of work wasted daily. Countered by a hot iron in the churn (backlash: burns) | Low | Medium |
| 3 | **Dry the Cow** | One animal | Hair from its tail; milked into a hare-skin (in hare-shape: steal milk directly) | Waning moon | Cow goes dry; household loses milk and income | Low–Med | Low |
| 4 | **Lame the Beast** | Horse, ox | Hoofprint soil + iron nail driven into it | Any | Lame condition; plowing and hauling fail; possibly sold or shot | Medium | Low–Med |
| 5 | **Murrain** | Herd | Hair from 3 animals; buried poppet of tallow in their pasture | Dark moon | Wasting sickness across the herd; deaths over weeks | High | High |
| 6 | **Blight the Field** | Crop field | Soil from the field + a straw poppet burned at the field's edge | Dark moon, growing season | Crop yield ×0.3; a lost winter for the family | High (slow, deep) | Medium |
| 7 | **Hailcalling** | A farm district | A bowl of water stirred at a crossroads; a big Woe spend | Summer storm season | Hailstorm on a chosen area. Crop and roof damage; injuries | Very High | Very High (whole district fears) |
| 8 | **Foul the Well** | Water source | A dead toad dropped in the well | Any | Water sickens; illness spreads to everyone using it | High | High |
| 9 | **Bad Bread** | Household | Accepted gift of yeast or flour | Any | Bread won't rise, beer won't work, and pantry stacks spoil faster: a `curse` multiplier (×300%) on `05`'s spoilage rate for the household's open stacks. Hunger, shame | Low | Low |
| 10 | **Cold Hearth** | Household | Threshold crossing; ashes taken from their fire | Winter | Fire won't catch or stay lit. Cold exposure | Medium (lethal in January) | Medium |
| 11 | **The Evil Eye** ("Overlooking") | Person or animal | Line of sight + gaze | Any | Ill health: −2 to Fort and Con-based checks; children and animals more vulnerable | Low–Med | Medium (people notice the stare) |
| 12 | **Crossed Luck** | Person | Name + crossing their path left-handed | Any | −2 to all checks; small accidents (05 event weights shift) | Medium | Low (looks like bad luck) |
| 13 | **Hag-Riding** | Person (asleep) | Any link; riding *in person* (entering the bedchamber, or by a Changes Gift) adds +2 and lets her choose to show her own face | Night | A **sent nightmare** (`10` §9.3). On a failed save it lands whatever the sleeper's receptivity: sleep quality ×30%, so Fatigued follows; a fear Thought at 70; +150 anxiety; a *Hag-ridden* memory. **The rider's face** is hers only if she shows it; otherwise it's whoever the *victim* already resents most (their best projection candidate) or a Figure with notoriety ≥ 30% (`10` §9.3) | High (very believable) | High (they describe a weight and a face), but the face is often *someone else's* |
| 14 | **Pining** (wasting sickness) | Person | Hair or nails in a wax poppet, pierced and slowly melted | Waning moon to dark | Progressive Con drain over weeks; nightly wasting dreams that block anxiety discharge in sleep (`10` §9.3); death if not broken | Very High | High (the classic accused curse) |
| 15 | **Fairy-Shot** (folk: "elf-shot") | Person or animal | A fae-made bolt (a blackthorn splinter or a dart of bone that never lived), begged from the Prince's Court + fae permission | Any | Sudden sharp pain, paralysis or a fit; may be fatal in animals. The bolt crumbles to a splinter in the wound | Medium | Medium. Villagers call it "elf-shot," which elves resent: using the word near an elf is an `04` insult Reason, and it nudges attribution toward elves among the Superstitious (`12` §12) |
| 16 | **Stolen Voice** | Person | Something they said captured in a corked bottle at the moment they said it | Any | Mute until the bottle is opened. Social and economic damage | Medium | High (unmistakable) |
| 17 | **Pins and Nails** | Person | Hair + a ritual involving pins swallowed by a poppet | Dark moon | Target vomits pins and fits; spectacular, terrifying | Very High | Extreme (a witch-hunt trigger) |
| 18 | **Set at Odds** | A relationship (two actors) | Something belonging to each, tied with a knot of black thread | Any | Opinion between them decays fast; quarrels; feuds (04) | Medium (two sufferers + kin) | Very Low (nobody suspects magic). The subtlest curse |
| 19 | **Turn the Heart** | A courting couple or marriage | Hair from one, a gift accepted by the other | Waxing moon | One partner's affection drains: their soul-image projection is withdrawn from the spouse in dreams (`10` §8.4, §9.3). Heartbreak, broken engagements | Medium | Low |
| 20 | **Tie the Knot** (ligature) | A couple | A knotted cord hidden near their bed | Wedding night or any | Infertility or impotence while the cord is knotted (historical "aiguillette") | Medium | Low–Med. **[OPEN]** Content-sensitive; toggleable |
| 21 | **Pixie-Led** | Traveler | Name + their path crossing a fae site | Dusk | Target gets lost in the wilds (05: navigation failure); may wander into Faerie | Medium | Low (folk belief: "pixie-led" or "fairy-led") |
| 22 | **The Fetch** | Person | Their reflection caught in still water at midnight | Midnight | Their double is seen around the county, first in other people's dreams, then awake (`10` §9.3), a death omen. Terror; others shun them | High (spreads to kin) | High |
| 23 | **Rot the Roof** | Building | A rotten board from it, nailed upside down at a crossroads | Any | Accelerated decay; leaks, collapse risk; stores under it get the wet band (`05` spoilage) | Low–Med | Low |
| 24 | **Bind the Tongue** | Person | Their name written on a slip in your mouth while they speak | During a trial or meeting | Cannot testify, accuse, or preach for a day. **The witch's main defense tool** | Low | Low (unless used repeatedly) |
| 25 | **Name-Rot** (Forgetting) | Person | True name + a burned scrap of their writing | Dark moon | Neighbors slowly forget the target: opinions decay toward neutral, debts and kindness forgotten. Social erasure | High | Very Low |
| 26 | **Take the Shine** | Person | Hair + a mirror they used | Full moon | Steal their luck or beauty: target −2 Cha (or −luck), witch gains it temporarily | Medium | Medium |
| 27 | **Sending** (Black Dog) | Household | Your familiar + a link | Night | Your familiar haunts them as a spectral beast. Fear, livestock panic | High | High (witnesses) |
| 28 | **Changeling** | Infant | Prince's Workings + the child's caul or hair | Specific moons | Swap the infant for a fae stock; the real child goes under the hill. Enormous Woe; enormous horror. The witch's act is what makes it lawful for the Court (C14: she is the trespass). Literal changelings are never playable (`12` §4). **[OPEN]** Content-toggled; off-screen or threatened-only by default | Extreme | Extreme, and the Bridget Cleary danger: *the family may harm the "changeling"* |
| 29 | **Ill-Wishing unto Death** | Person | True name + blood + Prince's sanction | Dark moon | A death curse: a slow, inevitable decline over a moon unless broken | Extreme | Very High |
| 30 | **Cellar-Blight** (P8) | A household's root cellar, smokehouse, or club pantry | Soil from its floor + a dead mouse sealed in a crock | Dark moon, autumn to spring | Stored food spoils at the next band up (`05` spoilage tables), and the cellar's vermin check fails weekly. A hard winter becomes a hungry one: the catastrophe P8 names | High (slow; grows through the winter) | Medium. Mundane lookalikes: damp, rats, a warm spell |
| 31 | **Dream-Sending** | Person (asleep) | Any link | Night | Plant a dream (`10` §9.2) carrying a motif and one proposition. Lands if a receptivity roll succeeds (no save). It creates `Dream` evidence, weighted by the sleeper's Superstition. **A mortal witch's dream can lie**, which a fae sender's can't: that's one reason the Court needs her. Used to steer suspicion, deliver a warning, or court an ally | Low (unless the content frightens) | Very Low, unless the sleeper tells a dream-reader |

**Dream curses [PROPOSAL, `10` §9].** Hag-Riding, Pining, the Fetch, Turn the Heart, and Dream-Sending all work through `10`'s dream channel: the collective unconscious is Faerie's medium, and dreams are how Faerie reaches minds it can't touch. Three rules follow:
1. **Receptivity matters.** Iron within reach, open scissors, and a horseshoe over the bed lower it, and Fae intensity and the sleeper's own anxiety and Drift raise it (`10` §9.2). A failed save on a hag-riding lands regardless.
2. **The victim supplies the meaning.** The rider's face, the dream's symbols, and who gets blamed come from the victim's own Shadow and grudges (§3.6's projection row). Hag-riding is the purest case: **the curse frames whoever the victim already resents**, and the "knows by whom" tier pays the witch either way. Example: `10` §15.3, where Carl Ahrens's nightmare wears his brother-in-law's face and an old land dispute becomes a feud.
3. **Spectral evidence is dangerous.** Dream evidence counts by Superstition and by congregation (`10` §9.1). **[OPEN, `10` Q7]** Recommended yes, because it's historically central and terrifying.

**[PROPOSAL]** Every curse in the catalog should have **at least one period-plausible countermeasure** the villagers can use and **one mundane explanation** they might believe instead (milk fever, drought, "God's will"). That's what makes Belief a contested variable rather than automatic.

### 3.8 Drift: becoming fae

**[PROPOSAL]** **Drift** (0–100) is a universal actor stat measuring how far someone has moved toward Faerie. (The pun on "Driftless" is deliberate: the region the glaciers wouldn't cross, and the people who drift out of the human world.)

Drift is an integer 0–100 on the actor. It's distinct from shadow-faekin heritage (`12` §4): Drift is *acquired*, heritage is *born*, and villagers confuse the two by design.

- **Gained by** (integer placeholders; `05` and `02` own the conditions, this doc owns the gains):

  | Source | Drift gain |
  |---|---|
  | A Changes Gift bought | +3 to +8 by Gift |
  | Hare-shape, crow-shape, or a borrowed face, per use | +1 per night |
  | Eating a fae meal (C26: `02`'s Bound chain carries the condition; `05` the nutrition; this row is `06`'s share) | +2 per meal |
  | A night at Fae intensity ≥ 3 | +1 (FI 3–4), +2 (FI 5) |
  | A fae bargain struck | +2 to +10 by its weight |
  | Time lost under the hill | +1 per subjective week |

- **People modifiers** (`12` §10.2, data): a **Drift floor** (faekin 10) and **Drift-gain bands** in integer per-cent (elves: 50% below Drift 40 and 200% at 40 and above, which is the Lapse). Gains are applied as `floor(gain × pct / 100)` with a per-actor carry.
- **Fae longing (C38).** `10` §3.4 makes this doc own the *gain* of the fae-longing need, which feeds the `longing` drive. Each Drift gain from food, music, or a night at FI ≥ 3 also lowers the fae-longing need by `20 × gain` (0–1000 scale). Elves feel the Pull independently (`12` §5.6).
- **Effects by threshold.** These follow **raw Drift**: Faerie's hold on you, which no heritage offsets. Penalties for iron, salt, bells, holy ground, and running water are **weaknesses** and live in §3.8.1.

| Drift | Effects (raw Drift) |
|---|---|
| 20 | Fae etiquette checks +1; dream receptivity rises (`10` §9.2 adds Drift/4) |
| 40 | Fae etiquette +2; Persona `control` −1 per 10 Drift above 40 (masks thin, `10` §11) |
| 60 | Aging slows (apparent age ×⅔, by integer table); fae treat you as kin (as faekin Guest-Right, `12` §6.6) |
| 80 | Your name begins to change (others' memory of it drifts; true-name links on you weaken by 2); Self-Command −1 per week (`10` §3.1) |
| 100 | **Departure.** You become fae. Run ends; you persist as a fae actor in the World |

- Drift can be reduced, slowly and with difficulty: living among humans, accepting hospitality, a priest's blessing (if you can stand it), breaking the Pact. Never below the people's floor.
- **[PROPOSAL]** Adventurers have Drift too. Fae bargains, fae food, and lost time raise it. That's the main way adventurer mode "touches" witch-mode systems from the inside: an adventurer whose hands shake around an iron horseshoe will get *accused of witchcraft* (§5), or of being faekin.

#### 3.8.1 Weaknesses: iron, salt, bells, holy ground, running water (C27)

**[DECISION, lead call]** `06` owns the witch's (and everyone's) fae weaknesses. Triggers are keyed to **Drift thresholds and the Pact**. `03`'s **Iron Presence (IP)** is an *input*. `02`'s Witch class feature references this section. **[PROPOSAL]** It's one general system, so it applies to adventurers, NPC witches, elves, and faekin alike (P4).

**Two tracks.** Folklore mixes two different ideas, and splitting them fixes several contradictions at once:
- **Nature** is what a fae-ish body can't abide: iron, salt on the skin, the ring of a bell. It keys on **effective Drift** `E = clamp(0, 100, Drift + people offset)`. The offset is `12`'s data: human 0, elf −10, shadow-faekin +30, goblin 0. `02`'s Iron-Sick hardship or feature becomes a +20 nature offset (proposal for `02`).
- **Claim** is Faerie's *ownership* of you, which holy ground, church bells, salt lines, and running water refuse. It keys on **claim** `K = Drift + 25 while bound by a Pact + 5 per moon of Arrears (max +20)`. **Heritage doesn't add to claim:** a faekin is kin to Faerie but unclaimed by it (`12` §2).

That split is why a shadow-faekin can sit in a Lutheran pew with an aching head and nobody the wiser, why a newly bound witch can drive an iron nail into a hoofprint but can't cast inside a salt line, and why a deeply drifted adventurer slowly loses both.

**Nature track** (effective Drift E):

| E | Band | Effects |
|---|---|---|
| ≥ 20 | Tells | Animals uneasy on first meeting; shadow lag at FI ≥ 3 in low light; milk turns near you. These are the same tell records as `12` §7.2, so a drifted human and a faekin are indistinguishable by them (lookalikes by design). Suspicion sources, not penalties |
| ≥ 40 | Discomfort | Iron per the table below. Salt stings bare skin (−1 to handling with salt). **Bell ache:** when a bell rings within earshot, Will DC 12 or −1 to checks for 10 minutes (a tell) |
| ≥ 60 | Pain | Iron per the table. Wielding an iron weapon needs Will DC 12 per scene (`03`'s rule, now keyed here). Cold-iron contact deals 1 nonlethal per minute |
| ≥ 80 | Burn | Iron per the table. Skin contact with any iron deals 1 nonlethal per minute (cold iron 1d4). Can't wield iron. Mortals who meet your eyes: Will DC 10 + E/10 or Shaken for a minute |

**Iron table** (penalty to all checks while the IP is on or about you; IP from `03` §3.3, where cold iron already counts ×3 if `03`'s tier is adopted, C28):

| Band \ IP (lb-equivalent) | 0–1 | 2–5 | 6–15 | 16+ |
|---|---|---|---|---|
| Discomfort (E 40–59) | 0 | 0 | −1 | −2 |
| Pain (E 60–79) | 0 | −1 | −2 | −4 |
| Burn (E ≥ 80) | −1 | −2 | −4 | −6 |

The 2–5 column at Discomfort is deliberately free, matching `03`'s "discomfort above IP 5": a knife and a tin cup cost nothing, while a rifle, hatchet, and kettle together do.

**Claim track** (claim K):

| K | Band | Effects |
|---|---|---|
| ≥ 30 | **Unhallowed** (`02` §6.3's feature is this row) | On consecrated ground, within earshot of a church bell while it rings, or inside a salt line: −2 to all checks, and casting or curse rites need Will DC 15 |
| ≥ 50 | **Running water** | Crossing running water on your own feet needs Will DC 15. On a failure you're turned back and may retry in an hour. Crossing ends any shape or glamour. Being carried (boat, horse, another's back) is allowed at −2 for the crossing |
| ≥ 70 | **Barred** | Can't enter consecrated ground at all. Running water is impassable except when carried in a boat by someone else. A salt line is a wall to you and to your Sendings |

A newly bound witch starts at K = 30–40 (§3.3's starting Drift + 25), so every witch is Unhallowed from level 1, as `02` wants. Running water arrives around Drift 25 and Barred around Drift 45, both reached mainly by buying Changes Gifts. Arrears push her there faster: a witch three moons behind is claimed 15 points harder.

**Examples:**

| Actor | Drift | E | K | What bites |
|---|---|---|---|---|
| Human adventurer, two fae meals | 4 | 4 | 4 | Nothing |
| Human witch, Debt Origin, day 1 | 5 | 5 | 30 | Unhallowed only; iron is fine |
| Shadow-faekin farmer, never drifted | 10 | 40 | 10 | Iron discomfort at IP 6+, salt sting, bell ache. Can attend church |
| Shadow-faekin witch, day 1 | 10 | 40 | 35 | Both: the hardest witch start, offset by See the Seam, Guest-Right, and a halved Bound rate (§5.5) |
| Elf witch after the Lapse | 45 | 35 | 70 | Barred from her own Hall's church, while still able to hold its bell |
| Human witch, many Changes Gifts | 62 | 62 | 87 | Pain-band iron and Barred |

**[OPEN] The faekin offset.** `12` proposes +30 and flags that +30 puts a faekin at Drift 30 into the old Drift-60 band (running water, holy ground). With the claim split, heritage never adds to holy-ground or running-water weaknesses, so +30 now only governs *how much iron and salt hurt*. I recommend keeping +30. The alternative is +25 (`12` Q10).

**Legibility (P1, `07` M8 acceptance 3).** Every weakness check emits an Explain that names its track, Drift, the offset or the Pact mark, and the IP. What the *character* knows of it is gated:
- A **witch** knows her claim through the Pact and sees full numbers.
- An **adventurer** sees band words ("your hands ache around iron") unless they have Lore (Fae) ≥ 2 or Second Sight.
- A **faekin who doesn't know** what they are (§5.5) sees the effect labeled *unexplained* until they learn it.

`11` §2.13 shows weaknesses where they bite: the Kit view marks iron items with their cost ("Hatchet: −1 while held"), the map's Iron overlay shows ambient IP, and route cards flag running water and holy ground.

**Integers and determinism.** E, K, IP bands, and penalties are integers and table lookups. Will saves go through `02`'s checks on the `checks` stream. No new rng stream.

### 3.9 Persecution from the witch's side

**[DECISION, lead call, C41]** `04` §9 owns persecution of any person or Figure: Heat, Consensus, and the **rungs 0–6** (Unease, Whispers, Accusation, Shunning, Institutional, Hunt, Mob/Trial). `05`'s alert levels cover only non-person threats (wolves, fire, epidemic). This doc runs **no ladder of its own**. It supplies the **witch-facing labels** for `04`'s rungs and defines how witch mode reads and plays against them.

**Witch-facing labels [DECISION, lead call]** (per settlement; the county can disagree with itself):

| Label | `04` rungs | Community state | What villagers do |
|---|---|---|---|
| **Unknown** | none, or 0 (Unease) | Misfortunes are bad luck, or private worry | Nothing special |
| **Whispered** | 1 (Whispers) | "There's a witch about." A Figure exists, or suspicion is diffuse | Protections go up (horseshoes sell out at the Outfitter); sermons |
| **Suspected** | 2–3 (Accusation, Shunning) | Named suspects, who may or may not include the witch | Avoidance, tests (asking the suspect to bless something), consulting a cunning-man, scratching, shunning |
| **Known** | 4 (Institutional) | Consensus on one identity, and an office-holder believes it | Petitions, church discipline, a newspaper item, a JP hearing on a *mundane* charge (C13), a hired witch-finder |
| **Hunted** | 5–6 (Hunt, Mob/Trial) | Active hunt with a leader actor, then the mob | Searches of the wilds, dogs, bounties posted (adventurers take them, §5), charivari, burning the hut |

**[PROPOSAL] Which process does the label read?** `04` runs a process per *target*, and a witch has several targets that can point at her: her own name, each Figure the county has invented ("the Bluff Witch"), and each cover Persona. The label shown for a settlement is the **highest rung among processes whose target the settlement links to her**: her name always, a Figure or cover only where `is_figure` credence links it to her at ≥ 50 in that settlement's Consensus. A dossier line under the label shows each target separately (*"the Bluff Witch: Hunted · Margarethe Vogel: Whispered"*). A Figure can be Hunted while she isn't, and that gap is the space she plays in.

**Display [PROPOSAL, `11` §2.13; `04` Q3 open].** Labels show per settlement in the rumor ledger header and by each town on the region map. A **"Show the rung"** setting (off by default at Frontier, on at Settler) adds `04`'s rung name and number. With it off, the label updates only when the PC *learns* of the change (a friend's warning, a sermon, a notice nailed up), so a label can be stale, and it says so.

**Faekin revelation is not witch notoriety.** A believed faekin enters `04`'s ladder at rung 1 on their *own* process (`12` §7.6). The two attribution terms reinforce each other (`12` §11.3), so a faekin witch who's revealed as faekin climbs faster as a witch suspect. But the labels stay separate.

**The witch's tools against persecution:**

| Tool | How it works | Cost/risk |
|---|---|---|
| **Cover identity** | The witch can visit settlements as a peddler, herb-woman, or traveler (Disguise + Glamour Gifts). **[PROPOSAL, C47]** Each cover is a **Persona** she wears (`10` §8.1), which others perceive as a **Figure** (`04` §5.1) with its own reputation and opinions, linked to her only through `is_figure` beliefs. The same model covers aliases (`02` Mountebank). Faekin heritage is *not* a cover: it's a concealed attribute of one identity (`12` §7.1) | Blown covers merge suspicion onto the witch; high-Drift tells leak through. **Persona strain** (`10` §8.1): every hour in a cover adds anxiety by the gap between the mask and her private self, and slips come when she's drunk, harrowed, or in a Fit |
| **Lying low** | Stop cursing; suspicion decays (04) | Woe income stops; Tithe arrears, and Arrears tighten the claim (§3.8.1) |
| **Scapegoating** | Plant evidence (a poppet in someone's chimney), spread rumor (via a cover identity or familiar), send a dream (#31), Bind the Tongue of the accused's defenders | **Morally heavy, very effective.** The scapegoat suffers persecution; their suffering produces Woe *for you* (Belief ×2 applies to curses they're blamed for). The Prince adores this. Often she doesn't need to: the village's own projection finds a scapegoat unaided (§9.2, `10` §15.1) |
| **Clearing a scapegoat** | Expose yourself partially, plant counter-evidence, intimidate the witch-finder | Costs notoriety safety; Chronicle remembers |
| **Turning the hunt** | Pixie-lead the posse, call the fae hunt, Set at Odds the posse leaders | Woe, more Belief, more fear |
| **Sanctuary** | Retreat into high Fae intensity. Humans make morale checks scaled by Fae intensity and their own Drift/faith to follow; few will go deep | Deep Faerie raises Drift and puts you under the Prince's eye |
| **Allies among outcasts** | Hermits, a disgraced midwife, a moonshiner, a deserter, other witches, sympathetic cunning-folk, a household you spared, a **Lantern** house (`12` §6.3) if she's faekin. They hide you, carry news, buy your simples | They become suspects too |
| **Working the village's psyche** | Feed the defenses that point elsewhere: a fear-rumor where envy already runs high, a dream that gives a nightmare a face. Starve the ones that point at her: lie low when the town is harrowed, since a hungry, frightened town hunts (`10` §7.3) | Every lever is one the epilogue can name |

**Countermeasures the village uses** (generated from 04 and the actors' sheets, not scripted): the **cunning-man/-woman** (a real NPC with counter-curse abilities; can be bribed, befriended, or cursed); the **witch-finder** (a traveling specialist actor; frightening, often a fraud, with his own Ambition: fame and fees; in the psyche, often a reaction-formation zealot drawn to what he hunts, `10` §7.2); the **revival preacher** (raises community fear and faith; a fire sermon is sublimated rage that speeds rung 3+ Heat); **ordeals** (swimming, weighing against a Bible, the "witch cake"); and the **witch bottle** (backlash risk). **[PROPOSAL]** Witch ordeals use the same data shape as `12` §7.5's faekin tests: each has true-positive and false-positive rates in content, so P1 can show the player that ordeals are bad evidence. The swimming ordeal "convicts" mostly the people who can't swim.

**[PROPOSAL]** The village is always reasoning under uncertainty. 04's suspicion model should make it possible for the village to be **wrong, divided, or corrupt**: neighbors use witchcraft accusations to settle land disputes and old grudges, just as historically. Some hunts will target people who had nothing to do with you. Whether you intervene is the game. **Dampers are real too:** a doctor's natural explanation, a skeptic's joke at the tavern (humor is debunking, `10` §7.2), a legalistic sheriff who wants Observation evidence (`04` §9.3), and a good harvest that raises the whole town's Self-Command.

### 3.10 Survival in exile

The day-to-day of witch mode is a small RimWorld survival game.

- **The Hut [PROPOSAL]:** a persistent home site in the wilds with a **Concealment** rating (location, Hedge Gifts, a glamour over the door). It holds the hearth (casting focus), stores of herbs and components, a garden, and a cellar. It can be found by hunters (Concealment vs. their Tracking/Perception), burned, or abandoned for a new one.
- **The larder [DECISION, P8].** The witch lives by the same food model as everyone (`03` fields, `05` burn and spoilage). She starts with what she carried out of her old life (§7.4) and has **no store credit**: every pound comes from foraging, trapping, the garden, payment for simples, or theft. The hut's cellar is a household inventory (`07` §3.6), so damp, a warm spell, and vermin spoil it on the same tables as a farm cellar. A burned hut is a lost winter. Two temptations sit on top of the numbers: **fae food**, which is plentiful at the Prince's table and costs Drift and the Bound chain (§3.8), and **the victims' pantries**, which her own Cellar-Blight and Bad Bread empty (#9, #30). A witch who starves a valley eats less too, because nobody trades with the herb-woman in a hungry year.
- **Foraging and simples:** the witch is an expert herbalist (Herbalism, Medicine, and Lore (Nature) in 02). She can sell cures, charms, and abortifacients to villagers through a cover identity or at the hut door at night. **[PROPOSAL]** This is an important *dual-use* system: the same skills curse and heal, which mirrors history (cunning-folk were often both). A witch can make a living helping people.
- **The Familiar [PROPOSAL]:** an animal actor with a sheet and Mind: toad, hare, black cat, crow, black dog, owl. Uses the companion slot (§2.6). It scouts, steals links (the cat brings back a ribbon; the crow pulls a hair from a scalp), watches the hut, and can be the vehicle for Sendings. It can also be **captured, killed, or turned** (a familiar caught by villagers is "proof"). Familiars have opinions of the witch and of the Prince.
- **Winter:** brutal. The witch has no church, no neighbors, no store credit. Winter is when Hedge Gifts, a well-stocked cellar, and outcast allies matter most, and when the Prince's demands feel cruelest.

### 3.11 The moral dimension: paths through the Pact

**[PROPOSAL] No morality meter.** The game doesn't score you good or evil. It tracks facts (who suffered, who died, who was blamed) and the Prince's opinion. The Chronicle makes the shape of your run legible. "Paths" are emergent styles, not tracks:

| Path | How it plays | Supported by |
|---|---|---|
| **Obedient** | Fulfill Behests, pay the Tithe, rise in the Court | High Woe, Prince's favor, fast Drift |
| **The Discerning Witch** | Curse only those who "deserve" it: the abusive husband, the swindling land agent, the witch-finder himself | Targeting is free; the sim decides whether the community agrees they deserved it |
| **Minimal harm** | Glean, keep curses low and reversible (Sour the Milk, Crossed Luck), lift curses after the Tithe | Gleaning; deception Gifts; Mercies; very tight margins |
| **The Protector** | Buy Mercies for households; secretly heal; steer the Prince's Behests elsewhere | Woe spent on others; Prince suspicious |
| **The Double Game** | Feed the Prince while working toward breaking the Pact | Escape Clause + deception |
| **The Turncoat** | Ally with a rival Court (the Hearth, Under, or Alder Court) | Rival patron; Court politics (01, 05) |
| **The Usurper** | Accumulate enough Woe, Drift, and allies to challenge the Prince | Endgame Working |

**Defying the Prince** is always possible and always costs something: refusing a Behest (opinion loss, punishment), lying about the Tithe (deception check each moon), warning a target (the target's Belief rises and so may your notoriety), or protecting a scapegoat.

**[PROPOSAL] The paths, read through the psyche** (`10` §13.3). Because she has two superegos (§3.3), each path is also a pattern of Thoughts and defenses, which the epilogue can name and Insight can reveal during play:

| Path | Psyche pattern |
|---|---|
| Obedient | **Identification with the aggressor**: the Prince's norm wins every arbitration, and her old conscience goes quiet. Lowest anxiety, fastest Drift |
| The Discerning Witch | **Rationalization**: each curse forms a `Deserved(victim)` belief at credence 60, and the epilogue counts them |
| Minimal harm | **Compromise**: Ego verdicts that half-satisfy both voices; high, steady anxiety |
| The Protector | **Undoing**: penance acts, lifted curses, bought Mercies. Discharges guilt, which the Prince finds distasteful |
| The Double Game | A **Persona** worn toward the Prince himself, with Persona strain, and slips when she's harrowed |
| Defiance | The **old conscience** wins: moral anxiety stays low, real anxiety (his punishments) runs high |

None of these is scored. The anxiety bands, the defenses that fire, and the Thoughts are mechanics with real effects (Composure on Will, Fits at the breaking point), so choosing a path changes how she plays as well as what the Chronicle says.

### 3.12 Endings

| Ending | Condition | Fate in the World |
|---|---|---|
| **Killed by the mob** | Death at human hands (`04` rung 6). **[PROPOSAL]** Historically accurate for the 1800s: mob violence or shooting rather than judicial burning, though "burning the witch's house with her in it" is plausible. With no witchcraft statute (C13), a **legal** hanging is possible only for a mundane capital charge (a death by a poisoned well), so it's rare | Grave or unmarked grave; ghost rumors; the village's guilt or pride enters 04 memory, and its rationalizations harden (`10` §7.2) |
| **Taken by the Prince** | Arrears too high, betrayal discovered | Departure: imprisoned under the hill. May appear in later runs |
| **Becoming fae** | Drift 100 | Departure: becomes a fae actor, maybe a Court noble |
| **Breaking the Pact** | Fulfill the Origin's Escape Clause, or a general method (recover your name and burn the contract at a liminal site with a human ally present) | Retirement as a mortal: often still notorious, now powerless. A hard, earned ending |
| **Overthrowing the Prince** | Usurper path: a Working + rival Court support + his true name | Departure: you become the Prince (and the next witch's patron, §5) |
| **Redemption / reintegration** | Pact broken + notoriety cleared in a community + accepted hospitality | Retirement among humans. Very rare, by design |
| **Fleeing** | Leave the region downriver | Departure; the Prince may follow |

---

## 4. Shared systems map

**[PROPOSAL]** Here's where each "witch" or "adventurer" thing actually lives in the engine. This is the P4 test: "If a feature only makes sense in one mode, check whether it's secretly a general system first."

| System | General form | Adventurer use | Witch use |
|---|---|---|---|
| **Pact** | Any binding fae contract with clauses, Holds, geasa | Fae bargains (a wish for safe passage, a cure) | The central Pact |
| **Curse / Malady** | Ritual Activity: link + target → condition | Rare: buy a curse from a fae; a cunning-man's counter-curse | Main verb |
| **Woe** | Suffering × Belief × Attribution, read from victims' psyches, computed for any actor with a Pact that "eats" Woe. The single fae currency (C45) | NPC witches and fae run on it | Currency |
| **Drift** | Universal stat | Fae entanglement | Transformation |
| **Weaknesses** | Nature track (Drift + people offset, IP input) and claim track (Drift + Pact mark), §3.8.1 | A drifted adventurer's iron trouble; a faekin's bell ache | Unhallowed from day one; running water; Barred |
| **Suspicion / Notoriety** | 04 (rungs 0–6, Figures) | Fame; accused of witchcraft when weird, or believed faekin | Persecution, through the witch-facing labels (§3.9) |
| **Psyche** | `10`: voices, arbitration, defenses, Persona, Shadow | Ambitions as Thoughts; isolation on a hard expedition; Self-Culture | Two superegos; the paths as defense patterns (§3.11) |
| **Persona / Figure** | One identity model (`04` + `10`, C47) | Aliases; a reputation that outruns you | Cover identities; Figures like "the Bluff Witch" |
| **Dreams** | `10` §9: Faerie's channel into minds | Fae lures; the Prince's courtship of the drifting | Behests; hag-riding and dream curses |
| **Countermagic items** | 03 catalog | Sold at the Outfitter; adventurer tools | The thing in your way |
| **Companions / familiars** | Semi-autonomous actor slot | Hirelings, dog, mule | Familiar |
| **Home site** | Persistent site at T1 | Homestead | Hut |
| **Patron** | An actor who issues demands with opinion stakes | The creditor, the sponsoring society, the church | The Prince |
| **Ambition / Origin** | Seeded goals + seeded actors | Ambitions | Origins |

The **Patron** row is worth emphasizing: the Prince's Behests and the creditor's letters are the same system (a patron actor with an agenda, generating demands with deadlines and opinion stakes). One implementation serves both.

---

## 5. Mode interplay: one world, many runs

This is the big payoff of P2 and P4.

### 5.1 NPC witches in adventurer mode

**[PROPOSAL]** The Director (05) and the fae Courts can **create witches off-screen** using the same Origin logic: when an NPC meets an Origin's preconditions (deep debt + nearby fae site + desperation in Mind; a stolen child; revenge plus a grudge), the Prince may offer a Pact, and the NPC's Mind decides. In psyche terms the offer arrives as a dream invitation (§3.3), then as an Id-voiced Thought keyed to the Origin's drive. The NPC's Ego arbitrates it against their conscience, waking, like any other urge (`10` §5), so a strong Self-Command and a strict Haugean conscience refuse more often than a starving widow does. That NPC then runs the full witch toolset at T1/T2: cursing, Woe, Tithe, cover identity.

**[PROPOSAL] The PC can be offered too.** An adventurer who meets an Origin's preconditions can receive the same offer. Accepting turns the run into witch mode without a new run: the Pact screens (§7.3) open in play, and the character keeps everything else. Modes are starting situations, not separate games (P4). This answers `02`'s question whether non-witches can become Witches mid-run (Q6 there).

Consequences for an adventurer:
- Misfortune in town has a *real* cause sometimes, and a scapegoat cause other times.
- A **witch bounty** is a classic Ambition hook, and a moral one. The posted target might be the real witch, a scapegoat, or the real witch who is herself a victim (the Stolen Child Origin).
- The adventurer can **side with the witch**: help break her Pact (the human ally an Escape Clause needs), bargain with the Prince for her, or hunt her.
- Countermagic gear at the Outfitter has real demand, and real prices that rise in a witch scare (03 economy reacting to 04 fear).

### 5.2 Adventurers in witch mode

The posse, the witch-finder, and the bounty hunter are **adventurer-shaped NPCs** generated by the same Background/Ambition system. A level-4 hunter with a good rifle, a dog, iron shot, and a rowan charm is a serious threat built from the same rules as the player in adventurer mode.

### 5.3 Anyone can be accused

**[PROPOSAL]** 04's suspicion model applies to every actor, including adventurer protagonists. Drift tells, returning unharmed from Faerie, fae gifts, being believed faekin (`12` §7.4) or being an outsider among a people not your own, quarreling with someone who then falls ill, or being a woman living alone can all draw accusation. So can being the nearest weak target when a neighbor's anxiety needs somewhere to go (`10` §7.2). An adventurer can find themselves on the wrong side of a witch-hunt. That's a story no single-mode game can tell.

### 5.4 Legacy across runs

**[PROPOSAL]** When a run ends, its protagonist is converted into an ordinary World actor (alive, dead, or departed) and the World keeps simulating. The next run can be either mode in the same World:

| Previous run ended as... | Possible next-run situations |
|---|---|
| Adventurer retired with a homestead | Your old character is an NPC farmer. Your new witch might be ordered to curse them. Or they might shelter her |
| Adventurer died in a cave | The cave holds their gear; their grave is a site; their widow runs the boarding house and resents adventurers |
| Witch burned | Her hut is a haunted site; the village has a memory of "the witch of Bad Axe Coulee"; protections are everywhere; the cunning-man who found her is famous. New adventurer starts in a scarred town |
| Witch became fae | She's now a fae noble, possibly the *next adventurer's* most dangerous encounter, or a patron who remembers her own exile kindly |
| Witch overthrew the Prince | **She is the Prince now.** A new witch run can be conscripted by your former character, whose temperament derives from her history |
| Adventurer hunted a witch who was a scapegoat | The innocent's family holds a Grudge against the old character and their heirs |

**[PROPOSAL] Time skip between runs.** When a new run starts in an existing World, the player picks a gap (0 / 1 / 5 / 20 years). T2 simulation fast-forwards: people age, marry, die; towns grow; the railroad comes. Your old character's memory is now rumor and legend, which has mutated (04). The Chronicle of the previous run is available in-world as a county history book, and it's *the rumor version*. **[DECISION]** Every World starts in spring 1855 (`00`), so later eras are reached only through these skips (C6). Peoples' lifespans make skips matter differently: a retired elf PC is still around after 20 years (`12` §5.8), and a faekin who passed as human has likely moved on to avoid the Unaging tell (`12` §7.3), so they may turn up in another settlement under the same face.

**[DECISION, `00` P5]** "Choose a soul" is in: the player may *play as* an existing NPC (the previous run's widow, a random villager) as well as a newcomer. Any actor's sheet is playable, which constrains `07` (every actor, including census-materialized ones, must be fully playable). **[PROPOSAL]** Choosing a soul skips creation screens 4–15 and shows the actor's sheet and Ties as they stand. The psyche comes as the sim built it, so the Shadow stays hatched (P1), and a concealed faekin's self-knowledge is whatever the actor believed.

---

## 6. Additional modes (sketches)

These fall out of the same engine. None are in scope for v1; listing them tests whether the architecture is general enough.

| Mode | Premise | Loop | New systems needed |
|---|---|---|---|
| **Homesteader** | Prove up a claim: clear, build, farm, survive winters, raise a family | RimWorld base-building at a single home site; town trips for supplies; the wilds encroach | Building/crops depth (05), family as companions |
| **Changeling** | You're a fae child raised as human, and you're starting to notice | Social-sim-heavy; hide your nature (Drift starts high), discover your Court, choose a side | Few: Drift, suspicion, Pact |
| **Circuit Rider** (preacher or doctor) | Ride a circuit of settlements, tending souls or bodies | Travel loop between hearths; social sim as main gameplay; fae and witch troubles as "cases" | Congregations as a reputation variant |
| **Cunning-Folk** | Village wise-woman or -man selling charms and counter-curses | Service economy: diagnose (real curse? natural? scapegoat?), counter-curse, avoid accusation yourself | Witch mode's systems from the other side |
| **Witch-Finder** | A traveling hunter of witches, honest or fraud | Investigation; the dark mirror of witch mode, and a sharp lens on the theme | Investigation UI on top of 04 rumors |
| **Peddler** | Trade between towns and fae markets | Economic arbitrage, rumor carrier | 03 trade depth |
| **Party / Colony** | Control 3–6 actors directly: an adventuring company or a family homestead | RimWorld proper | Multi-actor control (00 says: don't prevent it) |

---

## 7. Character creation, screen by screen

**[PROPOSAL]** One flow with mode-specific branches. Every screen has **Randomize** (RimWorld-style) and a **Show the math** panel (P1). The whole flow should take 3–10 minutes, or 30 seconds with "Quick start" (random within mode, straight to play).

### 7.1 Shared screens

| # | Screen | Contents |
|---|---|---|
| 1 | **World** | New World (seed, region size, Fae intensity overall, starting year) or Existing World (pick one; choose time skip; see its Chronicle) |
| 2 | **Mode** | Adventurer / Witch / (future modes). One-paragraph pitch each, with difficulty note |
| 3 | **Storyteller & difficulty** | Director personality (05), difficulty preset, save mode (§8), content toggles |
| 4 | → mode branch | See below |
| 9 | **People** | Ancestry slot (data-driven; Ellie's roster TBD), sex/gender, age band, appearance |
| 10 | **Abilities** | Point-buy (default), roll 4d6-drop-lowest, or Hard Country 3d6-in-order (02 §2.2; rolled methods get a Chronicle tag), with ancestry modifiers |
| 11 | **Class** | Class or class-like progression (02; "Callings" in 02 are prestige classes, chosen later). Witch mode restricts or adds options (e.g., Witch class, Hedge-Witch variant) |
| 12 | **Skills & Feats** | Catalog-style (feeds feeling #1). Background sets some pre-picks |
| 13 | **Traits** | 2–3 Mind traits (04) with a "conflicting traits" check, RimWorld-style |
| 14 | **Ties** | 2–4 pre-seeded relationships, generated by Background/Origin, editable: a sister in town, an old rival, a lover left behind. These become real actors |
| 15 | **Review** | PHB-style character sheet + one-paragraph generated biography. "Begin" |

### 7.2 Adventurer branch

| # | Screen | Contents |
|---|---|---|
| 4 | **Background** | Where you came from: Yankee clerk, Cornish miner, discharged soldier, farm daughter, failed seminarian, river pilot, … Sets skills, contacts, and **starting dollars** (e.g., $20–$150; 03 owns the numbers) |
| 5 | **Ambition(s)** | Pick 1 (or 2 at higher difficulty for more pressure). Shows what it seeds |
| 6 | **Threshold Town** | Choose or randomize which town you arrive at; shows its institutions |
| 7 | **Arrival** | How you arrive: steamboat, wagon, on foot, already living there. Affects starting goods (a trunk vs. a pack) and who knows you |
| 8 | **Debts & assets** | Optional: borrow money (creates a creditor), or carry an heirloom (sell it or keep it) |

Then the shared screens (9–15). **No gear screen**: you arrive with clothes, a pack or trunk, and dollars. Shopping is the first act of play.

### 7.3 Witch branch

| # | Screen | Contents |
|---|---|---|
| 4 | **Former life** | Who you were before: farmwife, midwife, schoolmistress, servant girl, widow, miller's son. Sets skills and Ties (people who knew you, now dangerous) |
| 5 | **Origin** | The Pact story (§3.3) |
| 6 | **Pact Terms** | Tithe rate / Geas / Boon (§3.3) |
| 7 | **The Prince** | Meet him: generated temperament and first agenda, shown through a short scene. Randomize allowed |
| 8 | **Familiar & Hut** | Choose familiar species; choose hut location from 3 generated candidates (Concealment vs. proximity to a settlement vs. Fae intensity) |

Then shared 9–15, with the Class screen preset to the Witch class.

---

## 8. Difficulty, save modes, accessibility

### 8.1 Difficulty

**[PROPOSAL]** Separate the **Storyteller** (pacing personality; 05) from **difficulty sliders**, as RimWorld does.

| Slider | Affects | Modes |
|---|---|---|
| Wilds lethality | Fae and beast danger, Fae intensity scaling | Both |
| Frontier hardship | Prices, wages, weather severity, disease | Both |
| Social memory | How long memories and grudges last; rumor reach | Both |
| Prince's appetite | Tithe minimums, punishment severity, Behest frequency | Witch |
| Village resolve | Speed of suspicion → hunt; witch-finder frequency | Witch |
| Debt pressure | Creditor patience, interest | Adventurer |

Presets: **Settler** (gentle), **Frontier** (intended), **Driftless Winter** (hard), **Custom**.

### 8.2 Save modes

| Mode | Behavior | Chronicle tag |
|---|---|---|
| **Commitment** (default for "Frontier") | One autosaved timeline. Death is final. Quit = save | None (the canonical experience) |
| **Second Wind** **[PROPOSAL]** | Commitment, but the first death per run (or per in-game year) becomes a **rescue**: an NPC finds you, nurses you, and **you owe them**. The debt is real in 04/03. Diegetic, simulationist alternative to reloading | "Saved by X" |
| **Free saves** | Save and load anywhere | "Reloaded" counter shown on the Chronicle (non-judgmental, like a game-time stamp) |

**[PROPOSAL]** Save mode is fixed at run start and can only go *down* in commitment (Commitment → Free saves), never up.

### 8.3 Accessibility

- **Pause on events** (configurable by event type), adjustable game speed including slower than 1×.
- **Show the math** everywhere (P1); also an accessibility feature.
- Text scaling, high-contrast and colorblind-safe palettes for map overlays (Fae intensity, suspicion heatmaps), full keyboard remapping, no time-pressured QTE-style inputs.
- **Content toggles** (§3.2): child harm, sexual-content-adjacent curses (Tie the Knot, Turn the Heart), on-screen mob violence, animal harm detail, spiders/insect fae.
- **Combat assist:** auto-resolve or AI-controlled tactical combat for players here for the story.
- **Reading aids:** Chronicle and rumor text with optional plain-language summaries.

---

## 9. The first 30 minutes

### 9.1 Adventurer: "Forty-Three Dollars"

*Character: Ada Kessler, 24, former schoolteacher from Ohio. Background: Clerk. Ambition: Missing Person (her brother Henry came west two years ago; his letters stopped last fall). Arrives by steamboat at Prairie Landing, a Threshold Town where the Kickapoo-analogue river meets the big one.*

**0:00–3:00.** Ada steps off the steamboat at dusk in late April. The camera pulls up to the top-down view: a muddy levee, a warehouse, a dozen frame buildings, a church spire, and beyond it all the dark green wall of the bluffs. A tooltip: *Fae intensity is low here. It rises as you go up the coulees.* She has $43.15, a carpetbag, and Henry's last letter (an item, readable). The letter mentions "the Lindqvist place up Rush Coulee" and "a man named Doyle who knows where the silver is."

**3:00–6:00.** She takes a room at the boarding house ($0.50/night with supper). The landlady, Mrs. Eberhardt, has an opinion of her already ("schoolteacher from Ohio": respectable, soft). At supper, the player sees the social layer for the first time: three boarders, one of whom (a surly Cornish miner) recognizes Henry's name and goes quiet. A small icon: *Rumor learned: "Henry Kessler owed money to Doyle."* Ada's Mind gets a worry.

**6:00–15:00. The Outfitter.** Morning. Halvorsen's Outfitting & General Merchandise. This is the set-piece (03). The counter, the shelves, the catalog UI with weights and prices. Mr. Halvorsen suggests a list "for a lady going up the coulees" (a tutorial nudge, with his own opinions baked in). The player wants: a blanket roll ($3.00), canteen ($0.75), a hatchet ($0.65), a used Kentucky long rifle ($14.00) or a cheaper fowling piece ($7.00), powder and shot, a lantern ($1.50), oil, matches, hardtack, bacon, coffee, a rope, and maybe a horseshoe charm (the first hint that the store sells against Faerie). $43 doesn't cover it. The player stares at the encumbrance bar and the budget. Feeling #1, delivered. She ends up with the fowling piece, no lantern (candles instead), and $6.40 left. Halvorsen offers $10 credit "against your brother's good name." Henry had credit here, apparently, and owed $11. Accept? She does. A creditor relationship is born.

**15:00–20:00.** She finds the claims office, where a clerk looks up the Lindqvist claim on a map (a map item, purchasable for $0.50, which reveals the region-map route). She asks around for Doyle: a tavern-keeper says he went up Rush Coulee in March and "hasn't come down, which isn't unusual for Doyle." The rumor system now has two leads that may be the same lead.

**20:00–27:00.** Overland travel. The region map: the route up Rush Coulee is a day's walk. Weather: a spring shower. She passes a farm (a T1 site promoted briefly: a farmwife hanging laundry who waves and gives a warning: *"Don't take the left fork after the spring. Folks get turned around."*). She makes camp at dusk under a limestone overhang. The camp site map loads: she gathers wood, the fire takes (Woodcraft check, shown), she eats. The bedroll she bought matters: comfortable, rested.

**27:00–30:00.** Night. A light in the trees that isn't a lantern. The pause triggers: *Something is watching your camp.* A will-o'-the-wisp, or something wearing one. Options: follow it, call out, stay by the fire, throw salt (she didn't buy salt). She stays by the fire. In the morning, at the left fork after the spring, there's a scrap of blue wool on a thorn, Henry's color. The Chronicle's first entry writes itself: *"In April of '55 Ada Kessler came up Rush Coulee looking for her brother, carrying forty-three dollars' worth of hope and a fowling piece she had never fired."*

### 9.2 Witch: "The Bill Comes Due"

*Character: Margarethe Vogel, 38, farm wife. Former life: Farmwife. Origin: Debt (two winters ago, her husband Karl lay dying of lung fever; she went to the stone ring on Sugar Bluff at midnight and asked). Pact Terms: standard Tithe, Geas "never refuse a request made three times," Boon "Hare-shape." The Prince's temperament: Capricious. Familiar: a hare that is not quite a hare. Hut: a collapsed charcoal-burner's cabin in Hollow Coulee, three miles from the Vogel farm.*

**0:00–4:00.** Opening scene, short, in-engine, top-down: the Vogel farm at night. Karl, healthy, asleep. Margarethe at the window. A tall shape at the edge of the woods. The text is minimal: *"He said he would come for the payment when the debt was ripe. Karl lived. The bill is due."* She walks out into the dark. The player takes control as she reaches the treeline. (She left; Karl will wake to find her gone, a memory and a grief that 04 tracks. Karl is an actor. He will look for her.)

**4:00–8:00.** The Prince's first audience, on a fae site map at the stone ring: high Fae intensity, colors slightly wrong, music. He's amused. He explains the Tithe in his own words and issues the **first Behest**: *"The Hartmann mill on Bear Creek turns on water that was mine. Before the moon is full, sour the miller's house."* The UI introduces the Woe panel: current Woe 0, Tithe due in 14 days, minimum 20.

**8:00–14:00. The hut.** Hollow Coulee. A survival tutorial in disguise: the cabin is half-collapsed; she has a shawl, a knife, her wedding ring, a sack of seed potatoes she took from the cellar. Clear the debris, lay a fire, forage (wild leeks, morels in late April, nettles). The hare familiar appears: it has a Mind, an opinion of her (curious), and a stat block. A Concealment meter for the hut appears, low.

**14:00–20:00. The first curse.** Night. She walks (or, in hare-shape, runs, which costs a little Drift) to the Hartmann farm. The site map at night: sleeping dog (Perception check vs. her Stealth), lit kitchen window, the dairy shed. Curse menu: **Sour the Milk** (threshold link: she must touch the pail) or **Hold the Butter** (pin in the dasher). The tooltip shows the math: save DC, expected Woe, Trace. She chooses Sour the Milk. The ritual is a 10-minute Activity with a progress bar; the dog stirs once. Done. She slips away.

**20:00–25:00.** Time skips to morning. A small "remote view" panel (the familiar watching, or a summary) shows Frau Hartmann finding the milk sour. Her Mind: *annoyed*, Belief: *Unaware (×0.25)*. Woe/day: 0.5. The player sees immediately: *this won't pay the Tithe.* The UI's Belief column explains why. To make Woe, people must **believe**. Options surface naturally: repeat it until they suspect, curse something bigger, or **make them believe**, which requires being seen, or leaving a sign, or a rumor. The core tension, taught in five minutes.

**25:00–30:00.** She goes to the Hartmann farm again the next night and this time leaves a sign: a knot of black thread on the gate. Frau Hartmann finds it, and her Belief jumps to *Believes cursed (×1.5)*. Woe rises. But she tells her neighbor, Frau Lindqvist, who tells her husband, who says: *"Margarethe Vogel left her husband in the night two weeks ago. Went into the woods. Make of that what you will."* The suspicion panel for the Bear Creek community opens for the first time and shows a list of suspects. Margarethe's name is there. So is the name of old Widow Brandt, who lives alone and keeps goats, and was seen near the Hartmann place picking mushrooms. The first scapegoat has appeared without the player doing anything. The hare looks at Margarethe. The Chronicle: *"In the spring of '55, Margarethe Vogel paid the first installment on her husband's life."*

---

## 10. Challenges to 00

1. **Run-end categories (minor).** P5 says runs end by death or retirement. Propose adding **departure** (becoming fae, imprisonment under the hill, emigration) as a third category, since departed characters persist in the World differently (§1.3).
2. **"Curse" in the glossary is defined as witch-mode-only.** P4 itself says to check whether a mode feature is secretly a general system. Propose redefining **Curse** in 00 as *"a ritual act that applies a malady to a target through a sympathetic link; the witch's main verb, available to any actor with the means"*, and adding **Woe**, **Tithe**, **Pact**, **Drift**, **Patron**, **Behest**, **Ambition**, and **Origin** to the shared vocabulary.
3. **Single protagonist and legacy.** Not a contradiction, but "Choose a soul" (play any existing actor in a World, §5.4) should be recognized in 00 as a legacy option, since it constrains 07's data model (every actor must be fully playable).

---

## 11. Open questions for Ellie

1. **Tone for witch mode:** A (tragic folk horror, recommended), B (dark power fantasy with consequences), or C (ambiguous magic)? See §3.2.
2. **Is the witch always "she"?** Recommend player choice, with the sim's bias model making gender matter.
3. **Is the Prince one fixed character or a generated actor per World?** (§3.4) Recommend a generated temperament with a fixed role.
4. **Name for the resource:** Woe (recommended), Teind, Sorrow, Bane, or something of yours?
5. **Content limits:** Should changeling swaps and death curses exist at all, be toggleable, or be NPC-only (the Prince does them, the witch only enables)?
6. **How evil can the obedient path be?** Is there a ceiling (e.g., no mass-casualty Workings like plague), or does the sim allow it with consequences?
7. **Adventurer starting money and debt:** comfortable with $20–$150 by Background and optional borrowing? (03 owns the numbers.)
8. **Companion cap:** 2 people + 1 animal for v1, OK?
9. **"Choose a soul":** should players be able to play any existing NPC in a World?
10. **Time skip between runs:** offer 0/1/5/20 years? Should the 1830s–1870s span itself advance (the railroad arriving as an era change)?
11. **Which mode for the vertical slice?** This doc assumes the engine ships first (P4) and suggests adventurer as the first playable mode with one NPC witch running at T1 (§5.1). That exercises the curse system without needing all of witch mode's UI. Agree?
12. **Real history references** (Salem, Bridget Cleary, the York hex murder, Pennsylvania-German powwow): use them as background research only, or allow in-world analogues (e.g., an in-world almanac of famous witch cases)?
13. **Indigenous peoples of the Driftless (the Ho-Chunk homeland):** this doc deliberately avoids casting any real Indigenous people as "outcasts," "fae," or witches. Coordinate with 01 on how (and whether) the setting represents them.
14. **Drift as a universal stat:** do you like adventurers slowly becoming fae as a long-term risk and reward?
