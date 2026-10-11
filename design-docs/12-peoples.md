# 12 — Peoples

**Status:** First draft, 2026-10-10. This doc owns the lore and data for the peoples roster (09 ownership map). Tags: **[DECISION]** comes from Ellie, `00`, or the ADR. **[PROPOSAL]** is mine and needs sign-off. **[OPEN]** is unresolved.

**What is actually decided:**
- There are four playable peoples, with ids `human`, `elf`, `shadow_faekin`, `goblin`.
- Elves belong to "the civilized world of humans and elves."
- Shadow-faekin are "sort of hidden and somewhat between humans and elves." Per the ADR they're concealed by default, pass as human or elf, and are known to others only through beliefs.
- Goblins exist.
- No people is hardcoded in sim logic (ADR invariant 4).

Everything else is **[PROPOSAL]**. Ellie has more lore coming, so each major choice comes with alternatives, and her lore overrides this doc wherever they differ.

**Boundaries with other docs:**
- `06` owns fae weaknesses and Drift. Peoples only feed inputs into them (C27).
- `10` owns the psyche. This doc supplies culture-level superego content as data (C3).
- `04` owns belief, opinion, Figures, and the persecution ladder (C41).
- `03` owns item fields, and `05` owns burn rates and spoilage (C48).
- `02` owns the ancestry schema.

---

## 1. Ground rules [PROPOSAL]

1. **Peoples are not cultures.** A *people* (human, elf, faekin, goblin) is a kind of being. A *culture* covers language, church, Old Country, food, naming, and the norms a person grows up with. A Norwegian Lutheran elf shares a culture with a Norwegian Lutheran human. Most of what an NPC believes is right comes from culture, congregation, and household, not from people. That's the main defense against essentialism. Implementation: give `culture` its own record (§13).
2. **No people was "here first."** All four arrived like the Yankees and Norwegians did, or arrived alongside them. None fills the "close to nature, here before" slot that `01` §2 and §6.1 reserve for real history.
3. **No people maps onto a real ethnicity.** Elves and goblins each span several Old World nations.
4. **Mechanical differences are bodily or metaphysical, never moral or intellectual.**
   - Ability modifiers apply only to STR, DEX, or CON, at ±1, and should net to zero.
   - No people has an INT, WIS, or CHA modifier.
   - The real differences live in size, senses, lifespan, diet, and how Faerie treats a people.
5. **Prejudice is belief data, never ground truth.** The sim never makes a prejudice true. Shadow-faekin aren't disproportionately witches, and goblins aren't disproportionately anything.
6. **Legible (P1), but limited to what the PC could know.** The truth about who belongs to which people comes out in the post-run Chronicle.

## 2. At a glance [PROPOSAL]

| | Humans | Elves | Shadow-faekin | Goblins |
|---|---|---|---|---|
| **Gist** | The settler majority, in all its quarrelling varieties | Fae who renounced Faerie long ago and became mortal, long-lived citizens of Christendom | A hidden people between mortal and fae who never renounced, passing among humans and elves | A small, mortal mining people with a treaty with the Under-Court |
| **Faerie** | Mortal. Settlement is "the Ice by other means." | Apostates to the Prince. They feel the pull and resist it. | Kin to Faerie, unclaimed by it | Treaty partners of the Under-Court |
| **Arrived** | 1820s on | With the Norwegian, German, and Yankee waves (1840s–50s) | Among every wave, unannounced | With the Cornish and German lead miners (1820s–40s) |
| **Share of Hollin County** (prior for `05`) | ~85% | ~8% | ~2% actual (believed share varies) | ~5%, mostly at the Diggings and the bluffs |
| **Size / typical lifespan** | Medium / ~70 | Medium / ~150 | Medium / ~105, ages slowly after 30 | Small / ~80 |

## 3. Peoples and Faerie

### 3.1 The axis [PROPOSAL]

`00` P7's cosmological hook says Faerie is the land's Id, the Ice its Superego, and the settled world the Ego. This is a frame for writing content, not a claim about anyone's nature.
- **Humans** are the Ego's population, pressing into the land.
- **Elves** are Faerie's Superego made flesh: they chose law, iron, names, and conscience over appetite, and their institutions keep that choice.
- **Shadow-faekin** are what everyone *else* imagines as the Shadow: the part of Faerie that walked out of the hill without renouncing anything. Whether that's true is left to belief.
- **Goblins** stand off the axis. They have a practical treaty with the deep that neither the Ice nor the Prince cares about.

For C11, this doc calls `01`'s anti-fae sovereign **"the Ice"** and the Drift-wights **"erratics."**

### 3.2 The Glacier Compact [PROPOSAL]

| People | Relation to the Compact (`01` §4.1) |
|---|---|
| **Humans** | Not parties to it. Surveying and plowing do the Ice's work, and the Compact never anticipated settlers. |
| **Elves** | Older than the Compact. Elves left Faerie *in the Old World*, where Faerie thinned under bells and plows with no Ice to bargain with. Arriving in the Driftless, they meet a Faerie that never thinned, like meeting the family you walked out on. The Prince argues that elves here are a standing breach ("Faerie crossing out in church clothes"). The Ice has never acted on that. |
| **Shadow-faekin** | They're the open legal question: is a faekin on a ridge farm "Faerie crossing out"? Fae jurists disagree. That gives faekin one reason to cluster in the Driftless, since inside the line nobody can call them a breach. Rumor says erratics hunt faekin first. **[OPEN]** I'd make the rumor false: erratics are hostile to everyone. |
| **Goblins** | It doesn't touch them. The Ice never went underground, and the Under-Court's whole strategy (`01` §4.3, "Depth") relies on that. |

### 3.3 Are elves fae? (08 ★, `01` §6.2)

| Option | Ground truth | Upside | Downside |
|---|---|---|---|
| **A. Renouncers** *(recommended)* | Elves *were* fae. Over centuries in the Old World, whole households left the hill, took baptism, iron, and mortal names, and gave up the road back. Now they're mortal but long-lived, iron-tolerant, and still pulled toward Faerie. | Uses `01`'s strongest slot. Elves are the best-informed and most bitter opponents of witches. It gives the Prince a grievance (apostates), makes the elven community a superego institution, and builds an inner conflict into elf PCs. | Elves move close to faekin's "between" space. §4 and §6 keep them apart through *renounced vs. unrenounced*. |
| **B. Cousins, never fae** | A separate mortal people. "Elf" is a human misnomer they resent: think of *elf-shot*. | The cleanest separation from Faerie | Wastes the hook. "Between humans and elves" loses meaning. |
| **C. Fae under charter** | Still fae, kept civil by an ancient charter: they can't lie, keep bargains, and can't enter uninvited | Exotic | Elves would be bound by `01` §4.5's hard fae rules, which makes "civilized citizens" hard to sustain. |

**Rec: A.** The renunciation (**the Leaving**, a placeholder name) was a rite performed in **Halls** and sealed with iron, bells, and a new name. That's why elves keep sealed names (§5.4), and why the Prince's Court calls them deserters.

## 4. Shadow-faekin vs. the other "part-fae" mechanisms (C5)

| Mechanism | Owner | What it is | Inherited? | Hidden? |
|---|---|---|---|---|
| **Shadow-faekin** | `12` | A *people*: born, never chosen, a community with customs | Yes | By default |
| **Drift** | `06` | Acquired movement toward Faerie, 0–100. Anyone can gain it. | No (faekin have a floor, §6.6) | Its tells show |
| **Fae-Touched** (class) | `02` | A vocation: fae power trained after a marking event. Any people can take it. | No | No |
| **Touched** (feat) | `02` | A mark left by an event | No | No |
| **Changeling** (`01` bestiary #12) | `01` | A real fae infant left by the Alder Court | n/a | Yes |

**[PROPOSAL]** Re-pitch `06`'s Changeling mode as **"Shadow-faekin coming of age"**: a faekin raised human who doesn't know (§7.7), or who knows and hides it. This reuses the concealment system and keeps literal changelings unplayable, which `01` Q13 flags as sensitive.

Villagers conflate all of these. The sim keeps them distinct in ground truth and lets beliefs blur them, which is how `04` attribution should work.

---

## 5. Elves

### 5.1 Origins [PROPOSAL, Option A]

- Each renouncing household passed through a **Hall**, a congregation that performed the Leaving and kept the **Roll** of sealed names.
- Elves have lived inside Christendom for about a thousand years and speak the languages of their countries.
- The Halls attached themselves to national churches: Lutheran in Norway and the German states, Anglican and Methodist in England, Catholic in Ireland and Bavaria.
- Elves came to the Driftless with the same 1840s–50s migrations as their neighbors, for the same reasons: land, debt, and 1848.
- There's no single elven nation. Elvishness cuts across nationality (Ground rule 3).
- They kept three things: the **Old Speech** (liturgical only), the Roll, and bell-founding.
- Under Option B, keep all of this except the Leaving.

### 5.2 In Hollin County, 1855 [PROPOSAL]

- **Where they live.** Elves are mixed in with humans, not in enclaves, which is "the civilized world of humans and elves" in practice. Several elven households farm on **Kvale Ridge** inside the Norwegian parish, and a few live in **Iron Ford**.
- **The Iron Ford bell.** The town's Lutheran bell was cast by an elven founder in Prairie du Chien.
- **The Hall-reader.** The nearest Hall is off-map downriver. Locally, a lay **Hall-reader** keeps a copy of the Roll and leads the **Renewal** each Midsummer Eve: iron touched, bells rung, names re-sealed. It deliberately falls on the fae festival night (`01` §4.6).
- **Economic niches** (cultural and historical, not aptitude).
  - Most elves farm.
  - They're overrepresented in bell-founding, glazing, and orchard grafting, all of which reward long lives.
  - They're also overrepresented in lyceums, survey crews, and schoolrooms. The Halls are literate institutions, and "measuring and naming" (`01` §5.3) suits people who renounced the unnamed.
  - They're deliberately *not* overrepresented in banking, law, or speculation. That avoids an "elites who run things" trope, which drifts toward antisemitic coding.
- **Callings.** Hall culture produces a share of `02`'s **Iron Wardens** and **Witch-Finders**: renouncers police the line they crossed.

### 5.3 Relations [PROPOSAL]

- **Humans.** Neighbors and in-laws. When a human and an elf have a child, the child is born human *or* elf, rolled per child, never "half." That avoids any blood-fraction mechanics. **[OPEN]** Should intermarriage exist at all? I recommend it does. Friction runs both ways: humans envy elven lifespans and resent Hall exclusivity, while elves find humans hasty.
- **Shadow-faekin.** Hall doctrine is harsher toward them than any other group's. The unrenounced are an affront to the Leaving, and sheltering one is a Hall offence. That's a cultural norm individual elves follow, bend, or defy.
- **Goblins.** Mild mutual regard between two Old World minorities with long memories. Elves find goblin plain speech rude, and goblins find elves stiff.
- **Prince's Court.** Baseline opinion of elves: Affection −30, Respect +10. He respects what they gave up.

### 5.4 Naming [PROPOSAL]

- **Given names:** from the household's language, favoring saints, apostles, and Old Testament names (Johanne, Absalon, Kristoffer, Magdalena, Tobias). Renouncers chose "names with church in them."
- **Surname:** national custom.
- **House-name:** formal, naming the Hall the family swore at ("Absalon Moe *of Sølvklokke Hall*").
- **Sealed name:** given at the Renewal and never spoken. It fills `01` §4.5's `true_name`. Fae effects that target the name take −4, the same mechanism as Name-Keeper.
- **Generator rule:** no invented Tolkien-style elvish names.

### 5.5 Material culture and P8 [PROPOSAL]

- **Forage taboo.** Hall culture forbids eating anything grown or caught at Fae intensity ≥ 2 unless it's first hallowed with salt and a spoken grace. This is superego content, not physiology.
  - The result: elves carry more stores and forage less. An elven party's pack is heavier, and `03`'s Readiness panel leans on stores.
  - A player can break the taboo. It raises a superego thought, and it becomes a Hall matter if anyone sees.
- **Hearth-loaf** (new `03` item): twice-baked rye with a salt crust.
  - It keeps about 3 weeks dry.
  - It counts as the "bread in the pocket" ward (`03` §3.3) for its whole shelf life.
- **Diet** leans on salt, smoked fish, honey, and orchard fruit.
- **Hand-bell** (new `03` item, ~$0.35): a bronze bell with `signal` and `ward-fae`. Ringing it holds a short line ward.
- **Iron** is no problem for elves.

### 5.6 Mechanics [PROPOSAL] (full table §10)

- **DEX +1, CON −1.** Light-boned.
- **Low-light vision.**
- **Lifespan:** maturity 25, middle 70, old 110, venerable 150, max +3d20.
- **Renounced:**
  - fae notice −2
  - −4 against name-targeting effects
  - +2 Will against fae enchantment (Charmed, Glamoured, Fascinated by fae music)
- **The Lapse.** Drift gain is 50% below Drift 40 and 200% at 40 and above. Elves resist the pull, and those who give in fall hard. This is a band table, not a curve.
- **Weakness offset −10** (input to `06`). For weakness triggers an elf counts as Drift − 10, so iron discomfort starts at Drift 50.
- **The Pull.** At Fae intensity ≥ 3, an elf gets an hourly Id-voiced **Longing** thought, intensity 40 + 10 per FI step above 3. It feeds `02`'s fae-longing need (C38). The pull is metaphysical. How an elf answers it is cultural.
- **[OPEN] Half-rate memory decay.** It would fit the Prince's "grudges persist" thesis, but it risks the stereotype "elves hold grudges." I'd ship without it and let Rancor (as superego content) carry vindictiveness.

### 5.7 Psyche: Hall culture as superego content [PROPOSAL, for `10`]

This applies only to actors raised in Hall households. A foundling elf or a freethinker's child doesn't get it.
- **The Hall Catechism**, as data:
  - Never bargain with the Fair Folk.
  - Never speak a sealed name.
  - Ring the bell.
  - Hallow the food.
  - Don't shelter the unrenounced.
  - Remember.
- **Psyche-lite priors:** `superegoStrictness` +10, `idAppetite` −5.
- **The core conflict** is the Pull (Id) against the Catechism (Superego). Defenses that should be possible:
  - **reaction formation:** the elf who most longs for Faerie becomes its fiercest hunter
  - **sublimation:** into music, grafting, or bells
  - **projection:** "it's the faekin who long for it"
- **Archetypes humans project onto elves:** Senex, and the fae Anima/Animus. Elves cast faekin as the Shadow.

### 5.8 Play

- **Adventurer.**
  - The best-provisioned and worst-foraging people by custom.
  - Glamour-resistant, and fae courts treat them coldly.
  - Welcome on survey crews; Iron Warden is a natural path.
  - The **legacy people**: a retired elf PC is still around after a 20-year skip (`06` §5.4).
- **Witch.**
  - The Prince *covets* elves, because an apostate's return is the best story. Debt, Ambition, and Inheritance Origins fit.
  - A strict superego means high anxiety and frequent defenses.
  - The Lapse makes Departure loom.
  - The Hall's response to discovery is the harshest of any community.

### 5.9 Hooks

1. **The missing chainman.** One of Whitcomb's missing chainmen (`01` §8.3), the young assistant Lydia Pratt is sweet on, is an elf. The Prince took him as a deserter, not as prey. The Hall-reader forbids anyone to bargain for him.
2. **The cracked bell.** The Iron Ford bell cracks in a hard frost, and town Fae intensity creeps up a step. A new bell takes 6 weeks and costs $90. Who pays? And was it the frost?
3. **The Lapse.** A Kvale Ridge farm daughter comes home from Huldra's Shelf humming tunes nobody taught her. She's at Drift 38. Her father is the Hall-reader.
4. **Two memories.** An elf who was 60 in 1832 remembers the Bad Axe pursuit differently from Captain Hurd's growing story (`01` §2.3). Two long memories contest one event. This is purely social memory, with no supernatural content (`01` §2.1.5).

---

## 6. Shadow-faekin

### 6.1 Origins: options [PROPOSAL]

| Option | Ground truth | Notes |
|---|---|---|
| **SF-A. The Unrenounced** *(recommended)* | Descended from fae who crossed into the mortal world *without* renouncing, over many centuries. They kept a measure of their nature and hid. They aren't elves (no Leaving), aren't human, and Faerie doesn't claim them (the courts call them deserters). | Gives them a culture and a history: a people, not a defect. Heritage is binary per child (rolled from data), with no blood fractions. |
| **SF-B. The Cast Shadows** | The Leaving cut the fae nature out of elves, and it sometimes resurfaces as a birth in elven or elf-descended families. | The strongest Jungian rhyme, but it reads as hereditary taint and gives them no people. |
| **SF-C. The Stayed** | Changelings, the stolen-and-returned, and the children of bargains, who found each other and became a people | Overlaps with the Alder Court and Fae-Touched |

**Rec: SF-A as ground truth, with SF-B and SF-C as in-world theories.** SF-B is Hall doctrine, which makes elven families suspect their own children. SF-C is the common human assumption, which makes humans suspect anyone born with a caul. Actors hold these theories as beliefs, and the wrong ones produce wrong suspicions.

"Between humans and elves" means between in *nature* (mortal and fae) and in *appearance*: a faekin can pass as either.

### 6.2 Why they hide [PROPOSAL]

- **In the Old World** they were hunted three ways: by humans as witch-kin and changelings, by the courts as deserters, and by the Halls as unrenounced.
- **In Hollin County** there's no statute against them, consistent with `01` §5.4's no witchcraft statute. The danger is extralegal, and a believed faekin starts on `04`'s ladder (§7.6).
- **In the Driftless** they feel at home (§6.6), and they're inside the Compact line.
- **The Prince courts faekin as kin.** That's recruitment *pressure*, not complicity. Persecution makes people desperate, and desperation is where most of his Origins come from (`06` §3.3).
- **Ground truth:** faekin are over-represented among witches only through that structural channel. The Director must not tune it otherwise.

### 6.3 In Hollin County, 1855 [PROPOSAL]

- **Numbers.** Roughly 60–100 people, in households that pass as human or elf.
- **Where they cluster:**
  - the failing lower farms of Lantern Coulee
  - ferry and wood-yard work at **Raft Island Slough**
  - ginseng digging, fiddling, midwifery, and peddling routes

  Mobility helps them move on before anyone notices that they don't age (§7.3).
- **No named institutions.** Instead there's the **Lantern**: households known to one another, recognized by small signs (a particular knot in a fence-rail tie, a phrase about dusk weather). A Lantern house shelters a faekin in trouble, no questions asked.
- **Authored-content rule.** Don't make the county's Black settler households faekin in authored content: not the Glovers (`01` §8.3), not the Cheyenne Valley model. That would map fantasy concealment onto real racial history. Procedural generation stays independent of culture.

### 6.4 Relations [PROPOSAL]

- **Humans:** intimacy without disclosure. Freethinkers and skeptics are the safest people to tell, so Brenner would shrug.
- **Elves:** the deepest hostility, from Hall doctrine. Some faekin pass *as* elves anyway, which is the boldest kind of passing.
- **Goblins:** indifferent, and so safe. Goblin plain speech doesn't pry. The Under-Court finds faekin unremarkable.
- **Fae:** treat faekin as kin, which is both shelter and danger. A fae will greet a faekin in public, and that greeting is a tell.

### 6.5 Naming [PROPOSAL]

- **Public names** come from the presenting community, drawn from its *commonest* names. The generator samples the top quartile, which is a statistical tell nobody in-world knows about.
- **Dusk-name:** given at a home rite and used only within the household and the Lantern. It's an identity name: the private self behind the Persona, not a sealed true name.
- **No invented faekin surnames.**

### 6.6 Mechanics [PROPOSAL]

- **No ability modifiers.** Nothing visible on the body.
- **Low-light vision.**
- **See the Seam:** +4 Perception vs. glamour. Unlike Second Sight, it gives no FI overlay.
- **Fae Courtesy +2.**
- **Kin's Guest-Right:** in fae dwellings and courts, a faekin counts as fae for hospitality and threshold rules. It doesn't stack with Fae-Touched's *Between*; use whichever is better.
- **Lifespan:** maturity 18, middle 50, old 80, venerable 105, max +2d20.
- **Apparent age** runs at about ⅔ of real age after 30, read from an integer table. This drives the Unaging tell.
- **Drift floor 10.**
- **Weakness offset +30** (input to `06`). For `06`'s weakness triggers, a faekin counts as Drift + 30.
  - A baseline faekin therefore sits on `06`'s Drift-40 band: iron discomfort scaled by `03` Iron Presence, salt stings, and bells ache.
  - **This is how fae heritage keys iron sensitivity without a separate rule.** It complies with C27: `06` owns the curve, and `03`'s Iron Presence is the input.
  - Caveat: at Drift 30 a faekin reaches the Drift-60 band (no running water unaided, no consecrated ground). `06` should check this, and +25 may be better.
- **Fae food:** `02`'s Bound chain (C26) advances at 50% rate for faekin. That makes fae food tempting, and eating it is a tell.
- **Dream-true:** faekin dreams (`10`) more often carry real information from Faerie. Gift and summons.
- **Comfort band:** FI 1–4. Long stays at FI 0 bring an Id-voiced restlessness.

---

## 7. Concealment and discovery [PROPOSAL]

Built only from `04` (Secrets, Beliefs, attribution, ladder) and `10` (Persona), per C47.

### 7.1 Identity model (C47)

Passing is **one identity with a concealed attribute**, not a second identity, Figure, or alias.
- **Ground truth:** the actor's `ancestryId`. Only the Chronicle epilogue reads it.
- **Secret** (`04` §3.5): the faekin holds `Is(self, kind:shadow_faekin)` concealed. `known_by` starts with household and Lantern.
- **Presentation:** `presentsAsId` (`human` or `elf`) is what strangers' default beliefs assume. It's the Persona-facing field.
- **Others' knowledge:** each actor may hold `Is(x, kind:shadow_faekin)` at credence 0–100, moved only by evidence.
- **Aliases and covers stay Figures** (`04` §5.1). A faekin witch in disguise uses both systems.

### 7.2 Tells

Tells are **generated events**. When their conditions hold, the sim rolls percentages on the existing `suspicion` rng stream, keyed by actor and tell. At T1 the roll is hourly for the relevant activity. At T0 it's per triggering action on the sub-minute clock (C21).

Each tell offers:
- a **suppression** check, where one exists
- an **observation** check for nearby observers, which on success creates an Observation memory that counts as evidence on `Is(x, faekin)`

Every tell has **lookalikes**: other things that produce the same event, by design.

| Tell | Trigger | Suppress | Observe | Strength (0–100) | Lookalikes (not faekin) |
|---|---|---|---|---|---|
| **Iron flinch** | Skin contact with iron (`06` band via the offset, scaled by `03` Iron Presence); cold iron is worse | Will DC 10 (15 for cold iron) | Perception vs. 10 + Disguise | 25 | Anyone at effective Drift ≥ 40; burns; palsy; nerves |
| **Shadow lag** | FI ≥ 3, in low sun or lamplight | None (avoid the situation) | Perception DC 15 | 40 | Glamour nearby; anyone at Drift ≥ 20 (`06`: "no shadow at noon on Sundays"); fog and bad light (false sightings are rolled for anyone at 0.5%/hr in such light) |
| **Bell ache** | Within range of a bell when it rings | Will DC 12 | Read People DC 12 | 15 | Migraine, hangover, Drift ≥ 40 |
| **Fae greeting** | A fae greets them as kin, with witnesses present | None | Automatic | 50 | Fae-Touched; anyone holding a bargain; anyone a fae is courting |
| **Unaging** | Apparent age lags real age by ≥ 8 years | Disguise DC 15 (aging makeup) | Acquaintances of ≥ 10 years, rolled yearly | 30 per year per observer | Good genes; elves (no tell at all if passing as an elf) |
| **Dream speech** | Asleep with a fae dream active (`10`) | None | Anyone sharing the room, Perception DC 10 | 35 | Fever; fae dreams in anyone; sleep-talk in an Old Country language |
| **Animal unease** | A horse or dog within 10 ft, on first meeting | Animal Handling DC 12 | Perception DC 10 | 10 | Drift ≥ 20; anyone animals dislike |
| **Glamour reaction** | See the Seam fires while others are present | Will DC 12 | Read People DC 15 | 20 | Second Sight; madness; drink |

Strength feeds `04`'s credence update. Proposed: a tell of strength *s* adds *s*/10 steps on the integer logit table that C49 requires, before trust, plausibility, and novelty apply.

### 7.3 Practiced concealment

- **No new skill.** Concealment uses **Disguise** (appearance and manner), **Will** (involuntary tells), and **Deceive** (explaining things away: "burned it on the stove").
- **Habit gear:** gloves, wooden-handled and brass-fitted tools, a gourd canteen (`03` §6.4), horn spoons.
  - Each item lowers iron contact.
  - Each is also a weak tell (strength 5) to anyone who knows to look for it.
- **Moving on.** A faekin passing as human has to relocate every 15–25 years, before the Unaging tell piles up.
  - At T2 this is an emigration driver (`05` §7.1).
  - In legacy play, it's why an old acquaintance can turn up in a new county.

### 7.4 Priors: who gets suspected

When an actor meets someone new, their starting credence for `Is(x, faekin)` is:
- base 2
- \+ Superstition × 2
- \+5 if x shows any Drift tell
- \+5 if x is an Outsider (`04` §5.4)
- \+5 if x was born with a caul (that's +10 under the SF-C folk theory)
- \+10 if x has been named in a faekin rumor before
- \+10 if x is from an elven family and the believer holds the SF-B Hall theory

**Plausibility** (`04` §5.3) reads Affection: people believe their enemies are faekin. Together with the lookalikes, this produces most false accusations.

The Commons proposition "faekin live among us" (`04` §5.5) starts low in 1855 and rises with uncanny events.

### 7.5 Tests and ordeals

Any actor can demand a test through a new `04` interaction, `Test`. Refusing is itself evidence (strength 15).

Each test is data with legible true-positive and false-positive rates, so P1 can show that ordeals are bad evidence:

| Test | Faekin "fails" | Non-faekin "fails" | Note |
|---|---|---|---|
| Iron key held in the palm through the Lord's Prayer | Will DC 15 (≈50% at Will +2) | ~10% from nerves; anyone at Drift ≥ 40 fails as if faekin | The commonest test |
| Shadow at Sunday noon | Only at FI ≥ 2; in town ≈10% | ~2% misread | Rarely works where it's actually done |
| Standing under the ringing bell | Will DC 12 | ~5% | |
| Bread and salt from the hand | ~5% | ~5% | Useless, and popular |
| Reciting the Lord's Prayer in English | ~10% | ~10%; ~40% for non-native speakers | Ordeals import other prejudices |

Results count as **Ordeal** evidence (`04` §5.2), weighted by the believer's Superstition and Piety.

### 7.6 Discovery

- **Revealed.** When Consensus (`04` §9.1) on `Is(x, faekin)` reaches 0.5 in a settlement, the sim emits a `Revealed` event. A Figure ("the faekin at the mill") can exist before anyone connects it to x.
- **Entering the ladder.** x enters `04`'s persecution Process at **rung 1**, with starting Heat equal to the sum of residents' group-opinion Fear toward faekin.
  - Under SF-A there's no rung-skipping: being faekin isn't being guilty of an act.
  - Escalation depends on misfortune pressure M and on catalysts, as in `04` §9.
- **Community responses** are data per culture and congregation:
  - credit pulled, a hired hand dismissed
  - broken engagements; pressure on a spouse to leave
  - Hall expulsion for whoever sheltered x
  - rungs 5–6 when a misfortune is attributed to x
  - **acceptance** from freethinkers, kin who already knew, and Lantern households
- **Household contagion.** Through `04` §6.2's +0.3 household term, the family gets tainted. Siblings are rolled independently, so beliefs spread to some children *wrongly*.
- **The Prince notices.** A revealed faekin becomes a candidate for The Accused or Desperation Origins (§6.2).
- **Witch labels.** Revelation isn't witch Notoriety (`06` labels per C41). The two attribution terms do reinforce each other (§11.3).

### 7.7 Self-knowledge, disclosure, psyche

- **Self-knowledge can be wrong.**
  - A faekin raised by a parent who hid it may not know.
  - A high-Drift human may wrongly believe they're faekin.
  - **PC creation option:** *knows / suspects / doesn't know*. Under "doesn't know," tells appear to the player as unexplained experiences, and the epilogue confirms the truth (P1).
- **Disclosure.**
  - `Confide` (`04` §3.5) trades the secret for Trust with one person.
  - **Coming out** is a public Event, judged by each witness's priors and opinions. It is never automatically fatal, and some households and towns accept it.
- **Psyche costs** (for `10`):
  - **Persona strain.** Each hour in company presenting falsely adds anxiety = 2 × local hostility (scaled 0–10) × (1 if x has internalized the anti-faekin norm, else ½). Integer weights.
  - **Possible defenses (never destined):**
    - **reaction formation:** the faekin who leads the faekin hunt
    - **projection:** naming someone else first
    - **sublimation:** healing or music
    - **repression:** "doesn't know" as a state of mind, not just a missing fact
- **The Quiet.** Lantern-raised faekin carry protective superego content: keep the secret, shelter your own, move on in time, never name another. It lowers strain, so a faekin raised among faekin is steadier than one raised human who learns late.
- **The Jungian Shadow is not the people.** A human's Shadow can hold fae longing, and projecting it onto a suspected faekin is how `10`'s defenses feed `04`'s attribution (§11.3). The glossary's deliberate echo becomes mechanism.

### 7.8 Real-world resonance: framing options [OPEN]

Concealment under persecution echoes several real histories:
- racial passing in the US, live in 1855
- conversos and crypto-Jews
- Romani concealment
- the queer closet
- European witch and changeling persecution, the setting's own folklore lineage

| Framing | In text and UI | Risk |
|---|---|---|
| **F1. Folkloric-primary** | Vocabulary from witch and changeling history: "witch-kin," "fairy blood," iron-key tests, Halls | Readers will still see other analogies. That's fine as long as the game doesn't lean on them. |
| **F2. Universal-psychological** | Foreground Persona and Shadow: everyone conceals something, and faekin are the sharpest case | Can abstract away the real costs |
| **F3. Explicit social analogy** | In-world vocabulary borrowed from real passing | Appropriative. Hollin County contains real Black settlers, and their history would be overwritten or trivialized. |

**Rec: F1 + F2, and avoid F3.** Concretely:
- **No real-race terms applied to faekin:** not "passing," "one-drop," "blood quantum," or period racial categories. The in-world verb is "going plain" (a placeholder).
- **No blood fractions.**
- **No tragic-by-default arc.** Most faekin live whole lives concealed and safe, and the Lantern and accepting households are real.
- **Director rule:** `05` may never nudge a faekin tell or seed a faekin rumor. Exposure is always emergent, so the game isn't structurally hunting them.
- **No faekin is dangerous by nature.** Any harm one does comes from their sheet and mind, like anyone else's.
- **Sensitivity readers** for faekin event text, budgeted like `01` §2.1's consultation.

---

## 8. Goblins

### 8.1 Pitfalls, and the design rules that avoid them [PROPOSAL]

| Pitfall | Source | Design rule |
|---|---|---|
| **Antisemitic coding** | Hooked noses, gold-hoarding, banking and moneylending, secret cabals, "rootless" traders, the goblin banker of recent fantasy | Goblins aren't bankers, moneylenders, pawnbrokers, or merchants and peddlers *by type*. No gold or coin iconography. Their name-privacy custom (§8.4) is open, ordinary, and widely known, like Norwegian farm-names. No goblin "network" controls anything. |
| **Racial caricature** | Simian or animal features; skin-tone coding; exaggerated lips, teeth, or noses; "savage horde" | Species differences are **size, eyes, and ears only**. No exaggerated human facial features. Skin tone never maps to a human group. Goblins dress like their neighbors and live as households and work crews, not hordes. |
| **The period's Irish caricature** | Mid-1800s cartoons drew the Irish as apelike goblins, and the Irish are in Hollin County (Dunleavy) | No Irish coding. No comic drunkenness or brawling. |
| **"Born evil"** | Tolkien's orcs | No innate morality |
| **Disability as ugliness** | "Twisted" bodies as moral markers | Small and proportionate, never deformed |
| **Infantilizing or comic relief** | Small read as childlike, squeaky, or dim | Adults with full dignity. No comic voices or names. Small isn't cute. |
| **Servility** | The hobgoblin servant, which in an antebellum setting echoes slavery | **Rejected outright.** Goblins don't fill `01` §6.1's "Hearth-kin" slot. |
| **"Here first"** | Cave-dwelling natives | Immigrant industrial workers (§8.2) |
| **"Dirty miners"** | Class contempt | Mining is skilled work, and goblins are its masters |

**Bestiary overlap (`01` §7):**
- **Knockers (#8)** are Under-Court fae. Goblins are the mortals who *treat with* them. Humans conflate the two, and goblins take "knocker" as an insult.
- The real *kobold* → cobalt etymology (#2) is folk etymology that humans use against goblins.
- **`05` F4 "Goblin market"** clashes with a playable people. Options:
  - (a) rename it **Night Market** in ids and system text
  - (b) keep "goblin market" as period human slang, so an NPC who says it in front of a goblin takes an `04` insult Reason
  - (c) both: Night Market in system text, the slang only in NPC barks *(recommended)*

### 8.2 Origins: options [PROPOSAL]

| Option | Ground truth | Hollin role |
|---|---|---|
| **G1. The Deep Accord** *(recommended)* | A small mortal people of the Old World mining uplands: Cornwall, the Harz, the Erzgebirge, Wales. Their ancestors struck the **Deep Accord** with the under-fae: goblin crews may work the deep and are warned and spared, in exchange for tribute, courtesy, and never sinking a shaft into a court's hall. They came with the Cornish and German lead miners in the 1820s–40s. | Penhallow Diggings, smelters, the shot tower, saltpeter caves, wells, quarries |
| **G2. River and bluff folk** | Boat-dwelling and quarrying families with an understanding with the River (`01` §4.3: not a court). Wood-yards, clamming, raft-piloting. | Raft Island Slough, the bluffs |
| **G3. Both** | Two goblin cultures, "Diggings" and "Slough," with some friction between them | Both |

**Rec: G1 now, G3 later.** G1 fills `01`'s "Underground neighbors" slot and uses knocker lore without making goblins fae. Slough goblins need care to avoid shantyboat caricature.

**Self-name [OPEN]:** most goblins accept "goblin," which was the Old World miners' word for them. Some prefer *Pare-folk*.

### 8.3 In Hollin County, 1855 [PROPOSAL]

- **Penhallow Diggings.** A goblin **pare** (a Cornish mining work-team) works within Trevenna's remaining crew: about 12 miners and their households. The knockers knock for the goblin pare first.
- **Elsewhere:** quarries on the bluffs above Iron Ford, a well-digging family, powder-men (blasting is a goblin specialty), and the saltpeter trade from the caves (`01` §1.5).
- **The Club.** A friendly society, modeled on real Cornish and German miners' benefit societies. It keeps:
  - a sick fund
  - burial dues
  - a widows' share
  - the **club pantry** (§8.6)
- **The Accord-speaker.** An elder who handles tribute and courtesy with the Under-Court, and the first person called when a drift goes wrong.
- **Religion.** Methodist (Cornish) or Lutheran (German), like their human co-migrants.
- **Economic niches:** mining *labor and skill*, smelting, blasting, stone, quarrying, cave work, the candle and lamp trade. Never mining capital: the Galena company's owners are human.

### 8.4 Relations and naming [PROPOSAL]

- **Humans:** co-workers and fellow congregants. Company men see goblin pares as leverage (their Under-Court standing) and as a labor problem (goblins organize). Many humans give goblins low Respect, out of class snobbery and knocker confusion.
- **Elves:** cordial, a little stiff (§5.3).
- **Faekin:** indifferent, and therefore safe (§6.4).
- **Under-Court:** knockers give a goblin in good standing +20 Affection and +20 Trust.
- **Prince's Court:** contempt mixed with wariness. Harming a goblin is a diplomatic incident with the Under-Court.
- **Names:**
  - **Given and family names** in Old Country style: Cornish (Jory, Tamsin, Jago, Loveday, Penrose, Trethewey) or German (Wendel, Gottlob, Barbara, Kohl, Bergmann).
  - **Pare-name:** a crew nickname, in the period mining tradition ("Lampy," "Old Sump").
  - **Deep-name:** given under the Accord and never spoken above ground. It fills `true_name`. Everyone knows deep-names *exist*; it's an ordinary custom.
  - **Generator rule:** no comic, onomatopoeic, or diminutive names.

### 8.5 Body and mechanics [PROPOSAL]

- **Body.** 3 ft 6 in–4 ft 2 in, 55–75 lb. Large, low-light-adapted eyes. Mobile, slightly pointed ears.
- **Coloring.** Skin and hair vary across the human range, independently of culture. **[OPEN]** If Ellie wants goblins visibly non-human, use a non-human palette (slate, lichen-grey), never one that tracks human groups.
- **Small** (`02` §9.9):
  - +1 Defense and attack
  - +4 Stealth
  - −4 grapple
  - speed 25
  - carrying capacity ×¾ (`02` owns C(STR))
- **CON +1, STR −1.**
- **Darkvision 60 ft.**
- **Deep Sense:** +2 Perception for bad air, unsound rock, and water behind a face; +2 Trade (Mining).
- **Accord Standing:** the Under-Court treats the goblin as a party to the Accord. A breach is an `04` event that hits the whole pare.
- **Lifespan:** maturity 14, middle 40, old 60, venerable 80, max +2d10.
- **Diet:** 70% of baseline kcal (about 1,700 kcal/day at rest per `05` §6.1).
- **Fae rules:** baseline. Comfort band FI 0–2 on the surface, 0–4 underground.

### 8.6 Material culture and P8 [PROPOSAL]

- **Rations.** A goblin eats 70% of a human ration, so the same weight of food lasts longer, offset by the ¾ carrying capacity. It's an honest tradeoff the Readiness panel should show.
- **Light.** Darkvision saves **lamp oil and candles** underground and in camp, a real P8 consumable. Goblin miners still carry candles, because a flame is the bad-air test that Deep Sense uses.
- **Food:**
  - pasty (shared with the Cornish)
  - **crib**, the packed miner's meal
  - cave-grown mushrooms, a winter fresh-food source against monotony and scurvy
  - sauerkraut and fermented roots (German)
  - strong tea
- **Cellar-craft.** A cellar or cave store fitted by a goblin crew spoils at 60% of the normal rate. This is an input to `05`'s spoilage physics, and it makes cellar-digging a sought-after service.
- **The club pantry.** An institutional inventory built on `03`'s item model (C48). Members pay dues in goods or cents and draw on it by rule: sickness, widowhood, strike weeks. It's a real safety net in a hard winter, and a real conflict when a non-member family starves next door.

### 8.7 Psyche: culture-level superego content [PROPOSAL, for `10`]

- **The Pare's Word:**
  - Never leave a man in the drift.
  - Nobody works alone below.
  - Keep the Accord's courtesies: no whistling underground, crusts for the knockers.
  - Pay your dues.
  - Speak plain.
- **Plain speech is a norm, not innate honesty.** Goblins can lie, but a social white lie raises a superego guilt thought, and Deceive used socially costs anxiety.
- **Club obligations** extend `04`'s Obligation ledger. Defaulting on dues brings a shame thought.
- **Archetypes humans project onto goblins:** the Smith-Dwarf and the Trickster. Goblins' own folk heroes are rescuers.

### 8.8 Play

- **Adventurer.**
  - The cave and mine specialist: darkvision, Deep Sense, Accord Standing (knockers warn you).
  - Food lasts longer, but the pack is smaller. Small-size Stealth.
  - Lead Delver is the natural Calling.
  - Town life brings Club and company politics, and the knocker slur.
- **Witch.**
  - A goblin bound to the Prince is an Accord crisis. The Under-Court may sanction the whole pare, which lowers knocker opinion and raises collapse risk.
  - So goblin communities have a strong motive to find and deal with their own witch quietly, before the humans do.
  - Revenge (a company man who let a pare drown) and Debt are natural Origins.

### 8.9 Hooks

1. **The steam pump.** The Galena company wants Penhallow's flooded lower drifts reopened with a steam pump and a *new* goblin pare from Mineral Point, hired for its Accord Standing. Trevenna's mixed crew sees its work leaving. The knockers have opinions about the pump.
2. **The cave-in.** A collapse kills two men, and the company blames the goblin powder-man. The goblins know the knockers did it because someone whistled. Who whistled, and who benefits from the blame?
3. **Club winter.** In January the Club pantry holds three weeks of flour, and a tenant family of Haugen's next door is starving. The Club's rules say members only.
4. **The Night Market.** The *Sentinel* mocks the "goblin market superstition," and goblin households demand a retraction. Bell refuses. Then a goblin miner is seen leaving the market on quarter-day night.

---

## 9. Humans

Humans get the shortest section because `01` §5 *is* their society.

- **Origins.** Mortal. They arrived from the 1820s on: Yankee, Norwegian, German, Swiss, Cornish, Irish, French and Métis, free Black settlers. They live alongside the Native nations per `01` §2. They aren't parties to the Compact, but their surveys, plows, names, and bells do the Ice's work. The Prince's thesis is about them.
- **In Hollin County.** Everywhere, in every institution and niche (`01` §5, §8).
- **Cultures carry the content** (Ground rule 1). Each `culture` record holds:
  - language and literacy (Lutheran confirmation made Norwegians notably literate)
  - naming and denomination
  - foodways
  - fae-reading tradition (`01` §5.5)
  - superego packages: Haugean pietism, Yankee thrift and temperance, freethinker skepticism, Cornish Methodist class discipline, Irish Catholic devotion
- **New `03` foodways items:**
  - flatbrød (keeps for months, light, a superb trail food)
  - klippfisk
  - a crock of sauerkraut (anti-scurvy)
  - the pasty
  - parched corn
- **Mechanics.**
  - No people-level ability mods; instead, a floating +1 the player chooses.
  - **Adaptable:** one extra Upbringing feat and +4 skill points at level 1.
  - `02` default lifespan. Fae-rule baseline everywhere.
  - **Unpriced advantage:** humans are the majority and carry no ancestry-keyed suspicion. **[OPEN]** Should the budget price that?
- **Psyche.** No people-level content. Everything comes from culture, congregation, and household. `04`'s Values fold into superego and Id per C3, and cultures shift their priors.
- **Adventurer.** The default and most flexible: no concealment burden, and the Outfitter's Book is written for them.
- **Witch.** The mob's default suspects are *others*. The human witch gets to watch her neighbors accuse the faekin-seeming widow instead.
- **Hooks:**
  1. **Wrongly suspected.** A red-haired, left-handed Yankee schoolmistress, born with a caul, reaches 0.5 faekin Consensus in Iron Ford. She's human.
  2. **Born again.** A Haugean lay preacher on Kvale Ridge teaches that elves are "baptized but not born again." The parish split (`01` §8.3) takes on a peoples dimension that Pastor Tveit can't afford.
  3. **Inherited debt.** Josiah Penhallow (`02` §14.1) grew up in a mixed pare. His father owes a goblin widow's Club share, and the debt passes to him through `04`'s inherited Obligation.

---

## 10. Mechanics summary [PROPOSAL]

### 10.1 Per-people data

| Field | human | elf | shadow_faekin | goblin |
|---|---|---|---|---|
| Ability mods | +1 floating (player's choice) | DEX +1, CON −1 | none | CON +1, STR −1 |
| Size / speed | medium / 30 | medium / 30 | medium / 30 | small / 25 |
| Senses | normal | low_light | low_light | darkvision 60 |
| Lifespan: maturity / middle / old / venerable / max | 15/35/53/70/+2d20 | 25/70/110/150/+3d20 | 18/50/80/105/+2d20 | 14/40/60/80/+2d10 |
| Bonuses | +1 Upbringing feat, +4 skill points at level 1 | — | Fae Courtesy +2 | Trade (Mining) +2 |
| Traits | adaptable | renounced, the_pull | see_the_seam, kin_guest_right, dream_true | deep_sense, accord_standing |
| kcal % of baseline | 100 | 100 | 100 | 70 |
| Concealed | no | no | **yes**, passes as human or elf | no |

### 10.2 Fae-rule inputs (to `06`, which owns the curves; C27)

| | human | elf | shadow_faekin | goblin |
|---|---|---|---|---|
| Drift floor | 0 | 0 | 10 | 0 |
| Drift gain % (below 40 / 40+) | 100 / 100 | 50 / 200 | 100 / 100 | 100 / 100 |
| Weakness offset | 0 | −10 | **+30** | 0 |
| Fae notice | 0 | −2 | +2 | 0 |
| FI comfort | 0–2 | 0–2, plus the Pull at 3+ | 1–4 | 0–2 surface, 0–4 underground |
| Name-targeting | — | −4 (sealed name) | — | −4 (deep-name). **[OPEN]** Against all fae, or only the Under-Court? |
| Bound rate % | 100 | 100 (and taboo) | 50 | 100 |
| Thresholds | normal | normal | counts as fae in fae dwellings | Under-Court halls by Accord |
| Can be a witch | yes | yes (coveted) | yes (courted) | yes (Accord crisis) |

### 10.3 Budget (`02`'s ~6 points; a design aid only)

| People | Total | Breakdown |
|---|---|---|
| Human | ≈5 | feat 2, skills 1, floating +1 = 1, plus unpriced majority status |
| Elf | ≈4.5 | low-light 1, renounced 2.5, lifespan 1.5; Lapse −1, Pull −0.5 |
| Faekin | ≈4 | low-light 1, See the Seam 1, Courtesy 0.5, Guest-Right 1.5, Bound ½ 0.5, dream-true 0.5, slow aging 0.5; offset −2, floor −0.5. The concealment burden is unpriced. |
| Goblin | ≈5 | darkvision 2, Deep Sense 1, Accord 1.5, rations 1; carry −0.5 |

**[OPEN] No-ability-mods variant:** drop all ability mods. Elves then get +1 Perception, and goblins +1 Athletics (climb).

### 10.4 Determinism and clock (C49, C21)

- Every multiplier is an integer percent, matching the content package's `_pct` convention.
- Drift-gain bands and apparent age are lookup tables.
- Tell and ordeal rolls use the existing `suspicion` stream.
- Credence steps follow the integer logit table from the `07` rewrite.
- No exp, log, pow, or trig anywhere.
- Time is integer game-minutes. Tells resolve hourly at T1 and per action at T0.

---

## 11. Relations, prejudice, and priors (data for `04`)

### 11.1 Should prejudice be simulated? (08 ★, `02` Q10, `04` Q2) [OPEN]

| Option | Effect | Notes |
|---|---|---|
| **P1. Full** | Priors toward peoples *and* human cultures: nativism, anti-Black racism, anti-Catholicism | The most honest for 1855, when the Know-Nothings peaked (1854–55). The heaviest content, and it needs `01` §2-level care. |
| **P2. Redirect** | Fantasy peoples get priors; human cultures get none | Implies 1855 Wisconsin had no real bigotry, which is erasure by another route |
| **P3. Restrained both** *(recommended)* | Human-culture priors exist but stay mild and mostly drive *attribution* (who gets suspected), not open hostility. Fantasy-people priors carry the visible, playable prejudice. | Honest without turning real bigotry into a gameplay toy |
| **P4. None** | No group priors | `04`'s Outsider and Oddness terms still produce bias, so this isn't neutral |

Whichever option wins, add a **Prejudice dial** to `06`'s content settings that scales all group priors from 0–150%. The Chronicle notes when it's not at default.

### 11.2 Default group-opinion priors (placeholders)

Priors use `04`'s dimensions and are keyed by the *holder's upbringing or culture* and the *target's people or role*. They enter Opinion `base` per `04` §6.2. Rows marked "believed" apply only once the holder believes the target belongs to that people.

| Holder → target | Aff | Res | Tru | Fear | Note |
|---|---|---|---|---|---|
| Human → elf | 0 | +10 | 0 | 0 | Established neighbors |
| Human (Superstition ≥ 2) → elf | 0 | +5 | −5 | +5 | "They were fae once" |
| Human → goblin | 0 | −10 | −5 | +5 | Class snobbery, knocker confusion |
| Human → faekin (believed) | −20 | −10 | −30 | +30 | Scaled by Superstition |
| Hall-raised elf → faekin (believed) | −40 | −20 | −50 | +20 | Doctrine |
| Hall-raised elf → human | 0 | −5 | 0 | 0 | "Hasty" |
| Goblin (Club) → goblin | +10 | +5 | +15 | 0 | Pare solidarity |
| Goblin → company men (a role) | −10 | 0 | −20 | 0 | Priors can key on roles |
| Lantern faekin → faekin (recognized) | +20 | 0 | +30 | 0 | |
| Prince's Court → elf | −30 | +10 | −20 | 0 | Apostates |
| Under-Court → goblin (in good standing) | +20 | +10 | +20 | 0 | |

### 11.3 Attribution (additions to `04` §5.4)

- **Faekin term:** `weight(c) += 2 × credence(b: Is(c, faekin)) / 100` for misfortunes the believer codes as uncanny. It runs parallel to KnownMagic and reads the *belief*, never the truth.
- **Outsider:** a difference in people counts toward `Outsider(c, b)`, scaled by the Prejudice dial.
- **Projection:** when `10`'s projection defense fires in a believer whose Shadow holds fae longing, the most plausible candidate gets a temporary +10 credence. That's how a frightened village's inner life picks a faekin scapegoat.

### 11.4 Settlement suspicion (C41)

`05`'s HearthState.suspicion "toward an ancestry group" is **not** a separate ladder. It's the aggregate of residents' group opinions plus the Commons proposition. Persecution of individuals runs through `04` §9, and `05`'s alert_level covers only non-person threats.

---

## 12. Conflicts addressed

| ID | Resolution here |
|---|---|
| **C5** | Fills out the roster. Separates faekin from Fae-Touched, Drift, and changelings (§4). Checks goblins against `01`'s cautions (§8.1–8.2). Answers `01` §6.2: any people can be a witch, and the Prince's preferences are about story, not nature (§10.2). Gives options for social tags and prejudice (§11). |
| **C47** | Passing is a Secret plus `presentsAs`. Aliases and covers stay Figures (§7.1). |
| **C27 / C28** | No people has its own iron rule. Heritage is a weakness offset into `06`'s Drift triggers, with `03` Iron Presence (including cold iron's ×3, if adopted) as input. The boolean `cold_iron_sensitive` goes away. |
| **C3** | Peoples carry no psyche. Cultures carry superego packages, and `10` owns the model. |
| **C26 / C38** | Faekin modify the *rate* of `02`'s Bound chain. Elves' Pull feeds the fae-longing need, which still needs a home in `04` or `10`. |
| **C41** | Faekin revelation enters `04`'s ladder at rung 1. There's no ancestry ladder in `05`. |
| **C48** | Peoples supply kcal %, preferences, and a cellar spoilage input. The Club pantry is an institutional inventory. New `03` items: hearth-loaf, hand-bell, flatbrød, klippfisk, sauerkraut crock, pasty, crib, cave mushrooms. |
| **C10 / C11 / C13** | "Elf-shot" is a human folk diagnosis that elves resent: another reason to drop the flint "elf arrows." This doc uses "the Ice" and "erratics." There's no faekin statute. |
| **`02` §6.1** | "No favored classes." That stays true now that the peoples are fixed. Occupation priors are NPC-generation data about 1855's social structure, not aptitude. |
| **`05` F4** | Becomes Night Market, with the slang kept in barks (§8.1). |

---

## 13. Implementation notes

**Code read 2026-10-10 ~20:50:**
- `content/base/peoples/peoples.toml`, marked "placeholder mechanics until 12-peoples.md lands"
- `packages/content/src/schema/world.ts` (`PeopleSchema`, `NamePoolSchema`)
- `scenario.ts` (`ancestry`, `presents_as`)
- `core/src/actor.ts` (`ancestryId`, `presentsAsId`)
- `belief.ts` (`secrets`)
- `rng.ts` (`STREAMS`)
- `items.ts` (P8 food fields)

**Already aligned:**
- The ids match.
- `concealed` + `passes_as` + `presents_as`/`presentsAsId` is exactly §7.1's model, and the schema comment forbids branching on people ids (ADR invariant 4).
- Scenario `secrets` implements `04` §3.5, which is what faekin need to seed `Is(self, faekin)`.
- The `suspicion` rng stream exists, so tells don't need a new stream.
- `_pct` integers are the content convention, and this doc now uses them.

**Divergences.** The doc is the design target. The code-side changes below are for the content-world owner.

| Code today | This doc | Change |
|---|---|---|
| `shadow_faekin.cold_iron_sensitive = true` (boolean) | Weakness offset +30 into `06`'s Drift triggers (C27) | Replace the field with `weakness_drift_offset: int` (and `drift_floor`, `drift_gain_pct` bands) |
| elf: maturity 30, lifespan 120/200/300 | 25 / 70 / 110 / 150 | Update. 300-year elves put most living elves before the Leaving's Christian era and make Hall memory trivially first-hand. |
| elf: `fae_notice_mod = 1`, `fae_comfort` 0–3 | −2 (renounced); 0–2 plus the Pull at FI 3+ | Update. The Pull is a trait, not a wider comfort band. |
| goblin: maturity 12, lifespan 30/45/60 | 14 / 40 / 60 / 80 | Update. A short goblin lifespan reads as "lesser people." |
| goblin: senses `["normal", "low_light"]` | darkvision 60 | Use `darkvision`, and add a range field (`darkvision_ft`) to the schema |
| `literacy_pct` per people (goblin 30, elf 80, human 60) | Literacy belongs to **culture** (Ground rule 1) | Move it to a culture record or to `NamePool.culture`. A 30% goblin literacy figure at people level is a caricature risk. |
| `abilityMods()` allows ±6 on all six | STR/DEX/CON ±1 only; INT/WIS/CHA must be 0 | A people-specific refinement in `PeopleSchema` (lint warning if the sum ≠ 0) |
| No `ability_mods` set (all zero) | §10.1 | Fill in when approved |
| Lifespan has no `max_roll` | `max_roll` dice string | Add it |
| No kcal multiplier | goblin 70% | Add `kcal_pct` (read by provisions/needs, `05`) |
| `NamePool.peoples` lists `["human"]` only | Elves share national pools (weighted to saints' names); faekin draw from their presenting community's top quartile; goblins use Cornish and German pools | Add `elf` and `goblin` to the relevant pools, plus an optional `weights`/`tags` field for the saint-name and top-quartile rules |
| `diet` enum | Unchanged | — |

**Proposed additions** (new files, schema owner's call):
- **Traits:** `traits = ["renounced", ...]` on `PeopleSchema`, resolved against `content/base/traits`.
- **`fae` block:** `drift_floor`, `drift_gain_pct = [[0, 50], [40, 200]]` (a band table), `weakness_drift_offset`, `bound_rate_pct`, `fi_comfort_underground`, `accord`.
- **`inheritance`:** `{ mode = "binary_per_child", chance_pct_one_parent = 50 }`, read by census materialization (`05` §3.6), deterministic from the household seed.
- **`content/base/peoples/tells.toml`:** `[[tell]]` with `id`, `trigger` (declarative conditions such as `fi_gte`, `light`, `iron_contact`, `bell_range`, `asleep_dreaming`, `years_known_gte`), `suppress`, `observe`, `strength`, `lookalikes`. `PeopleSchema.tells` references them, and only concealed peoples use them.
- **`content/base/peoples/ordeals.toml`:** `[[ordeal]]` with true-positive and false-positive percentages per condition.
- **`content/base/cultures/*.toml`:** language, `literacy_pct`, name pool, denomination mix, superego packages (`10`), and foodways (item ids from `03`).

---

## 14. Open questions for Ellie

1. **Elves and Faerie:** A, Renouncers *(rec)*; B, never fae; or C, fae under charter? (§3.3)
2. **Faekin origin:** SF-A *(rec)*, SF-B, or SF-C? Keep the other two as in-world theories? (§6.1)
3. **Goblins:** G1, the Deep Accord *(rec)*; G2; or G3? And what do they call themselves? (§8.2)
4. **Ability mods:** STR/DEX/CON at ±1 only, or none at all? (§1, §10.3)
5. **Human–elf intermarriage** with each child born one or the other: yes *(rec)*? (§5.3)
6. **Concealment framing:** F1 + F2 *(rec)*, with no real-race terms, a Director that never seeds faekin exposure, and sensitivity readers? (§7.8)
7. **False positives:** tune so that roughly 40–60% of people publicly believed to be faekin aren't, mirroring `06` §3.2? (§7.4)
8. **Prejudice:** P1, P2, P3 *(rec)*, or P4? Plus the Prejudice dial? (§11.1)
9. **`05` F4:** Night Market in system text, with the slang in NPC barks *(rec)*? (§8.1)
10. **Faekin weakness offset:** +30 or +25? (§6.6)
11. **Elven memory at half decay:** ship without it *(rec)*? (§5.6)
12. **Changeling mode:** re-pitch it as "Shadow-faekin coming of age," with a *knows / suspects / doesn't know* creation option? (§4, §7.7)
13. **The Prince:** should he covet elves and court faekin, or have no preferences? (§5.8, §6.2)
14. **Population shares:** does 85 / 8 / 2 / 5 feel right? (§2)
15. **Coined words:** the Leaving, Halls, the Roll, the Old Speech, the Renewal, the Lantern, dusk-names, "going plain," the Quiet, the Deep Accord, the Club, pare-names, deep-names. Keep them or replace them. Your own lore overrides all of it.
