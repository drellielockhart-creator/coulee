# 08 — Open Questions for Ellie

**Status:** A consolidated, deduplicated decision checklist built from the "Open questions" sections of `01`–`07` and the **[NEEDS DECISION]** items in `09-consistency-notes.md` (cited as **C#**). It's current as of the second 2026-10-10 revision of `00` (P6–P8) and `adr/0001`.

**How to read it:** each item gives the question, the options on the table (who proposed what), the recommendation if any doc made one (**Rec**), and the sources. Check the box when it's decided, and record the answer in `00`'s decisions log.

**Tiers:**
1. **Blocking for prototyping.** Answer these before or early in coding (milestones M0–M4).
2. **Important but can wait.** These shape systems or content that are built later.
3. **Flavor and taste calls.**

---

## 0. Already decided (closes these doc questions)

These came out of `00`'s revisions. The listed questions are closed and appear nowhere else in this file.

- **Start in spring 1855.** Closes most of `01` Q2 (the Civil War part is still open, see 2.1), `03` Q1, and the start-date half of `05` Q3 and `06` Q10. Selectable eras are still open (1.3).
- **TypeScript PWA stack** (`adr/0001`):
  - Node 26, pnpm, Vite, React, and three.js, with the sim in a Web Worker.
  - Capacitor and Tauri later.
  - Integer game-minutes since 1855-04-01, and 1× ≈ 40 real seconds per game-hour.
  - A psyche-lite Mind for M1.
  - Closes `07` Q2, Q3, and Q9.
- **Headless harness first** (ADR: "the sim harness as the first target"). Closes `07` Q1.
- **P8 "crunch you can pack":** detailed food, nutrition, spoilage, consumables, and pantries. This raises a new conflict (C48, below).
- **Phones are a full target** ("pocket" UI), equal with desktop.
- **Blender for placeholder art.** Closes most of `07` Q8.
- **No alignment; a Freud/Jung psyche instead.** Closes `02` Q5 and the alignment half of `04` Q1.
- **Peoples are humans, elves, shadow-faekin, and goblins.** Shadow-faekin are concealed by default and known only through others' beliefs (ADR). Closes the roster half of `01` Q9.
- **Departure is a third way to end a run.** Closes `06`'s challenge.
- **Fae intensity is a per-tile field with a map baseline; tiers include relevance; populations use census materialization.** Closes the challenges from `02`, `04`, `05`, and `07`. `05` Q1 is mostly closed too; scale is still open (1.2).
- **"Figure" replaces "Persona"** for rumor identities. Applied in `04`.

---

## ★ First: peoples (Ellie's own pending item)

You've named the four peoples. The fuller lore is still yours to write in `12-peoples.md`. These questions from the docs are waiting on it:

- [ ] **What is each people's relationship to Faerie?**
  - Are elves "renouncers": ex-fae who chose iron and names, the bitterest enemies of witches? Or are they unrelated to Faerie? ([01 §6.1–6.2](01-setting.md))
  - How are shadow-faekin different from three existing things: `02`'s **Fae-Touched** class ("changeling, caul-born"), `06`'s **Drift** stat, and `06`'s Changeling mode sketch? Without a clear line, four mechanisms will all represent "part-fae person". (C5, [02 §6.3](02-rules-and-characters.md), [06 §3.8, §6](06-game-modes.md))
- [ ] **How do shadow-faekin pass and get discovered?** The ADR settles that they're concealed by default and known only through beliefs. Still open: how discovery works, and whether one identity model covers this along with aliases (`02`), cover identities (`06`), Figures (`04`), and the Jungian Persona (`00`). `09` recommends one model. (C5, C47)
- [ ] **Goblins: what are they in this world?** No doc mentions them. Check the concept against `01`'s cautions: don't fill the "were here first, close to nature" slot (it reads as a Native stand-in), and don't map a people onto a real ethnicity. ([01 §6.1](01-setting.md), C5)
- [ ] **Do peoples differ mechanically against fae rules** (iron, thresholds, running water, Drift gain)? ([01 §6.2](01-setting.md), [02 §12](02-rules-and-characters.md) schema, which has `cold_iron_sensitive` and `fae_intensity_comfort`)
- [ ] **Can any people become a witch, and does the Prince prefer some?** ([01 §6.2](01-setting.md))
- [ ] **Should prejudice between peoples be simulated?**
  - Should opinion priors key on ancestry (`02`'s `social_tags`)?
  - The question underneath: should the sim redirect real-world frontier prejudice onto fantasy peoples, soften it, or reproduce it among human groups too? `04`'s attribution "Outsider" term will reproduce prejudice dynamics either way.
  - Sources: [02 §12, Q10](02-rules-and-characters.md), [04 Q2](04-social-simulation.md), [06 §3.2](06-game-modes.md)
- [ ] **Where did each people come from?** Did elves and goblins arrive as settlers alongside Yankees and Norwegians, or were they already in the Driftless? If they were already there, see `01`'s caution about the "were here first" slot. ([01 §6.2](01-setting.md))

---

## 1. Blocking for prototyping (answer before or early in coding)

### 1.1 Tech and platform

- [ ] **Confirm the `07` rewrite to match `adr/0001`.**
  - Rust, Godot, and session-plan specifics go.
  - The architecture principles stay.
  - Budgets get restated for TS and phones.
  - (C1, [07](07-architecture-and-prototype.md), [adr/0001](adr/0001-typescript-stack.md))
- [ ] **Integer and table-based math for `04` and `05`.**
  - The ADR bans `exp`/`log`/`pow` in core and requires integer state.
  - That conflicts with `04`'s exponential salience decay, log-odds credence, and sigmoid, and with `05`'s logistic ecology growth and 0–100 meters.
  - **Rec (`09`):** keep the models, implement them with lookup tables, and store values at the ADR's integer scales.
  - (C49)
- [ ] **Which phone, and how much simulation runs on it?**
  - The perf budgets in `04`, `05`, and `07` were set for a desktop running Rust.
  - **Option (a):** the full county sim runs on the device, probably in a Web Worker.
  - **Option (b):** phones get a smaller county.
  - **Option (c):** phones get a reduced T2 cadence.
  - Pick a minimum target device. (C2, [07 §6](07-architecture-and-prototype.md), [04 §13](04-social-simulation.md), [05 §3.5](05-world-sim-and-storyteller.md))
- [ ] **Confirm the mode order for the vertical slice.**
  - Adventurer first, with one NPC witch running at T1, then witch mode. `06` and `07` agree on this.
  - `07` also pulls a headless witch-hunt scenario forward into M2.
  - ([06 Q11](06-game-modes.md), [07 §9](07-architecture-and-prototype.md))

### 1.2 Simulation scale

- [ ] **County size and population.**
  - **`05`:** 720 sq mi, about 6 settlements, 3,000–5,000 people, of which 600–1,500 are named and the rest are lazily materialized census.
  - **`07`:** 2,000–5,000 named actors across 10–25 settlements, all with full minds.
  - **`04`:** 2,000–5,000 named, or a historical-scale 10–15k with census.
  - **`01`:** "a few hundred sq mi", 6–10 hearths.
  - **Rec (`09`):** use `05`'s numbers and lean small for TS on phones.
  - (C9; [04 Q8, §13.3](04-social-simulation.md), [05 §1.2, §3.5, Q1](05-world-sim-and-storyteller.md), [07 Q4](07-architecture-and-prototype.md), [01 §3.2](01-setting.md))
- [ ] **Is the county seat on the map or off it?** `05` puts it on-map, with the newspaper and court day. `01` puts it off-map, with Iron Ford running its own *Sentinel*. (C9)

### 1.3 Time

- [ ] **Sub-minute timing and combat speed.**
  - The ADR fixes the clock: integer game-minutes, with 1× ≈ 40 real seconds per game-hour.
  - `02`'s combat needs sub-second timing: 0.5 s swift actions, 0.1 s initiative steps, and 3 s attacks.
  - Two things are open:
    - how T0 schedules actions inside a minute (millisecond offsets?)
    - whether combat auto-drops to a tactical speed of about 1 game-second per real second
  - `05`'s 1× speed (60 s per game-hour) and `07`'s 1-second Tick are superseded.
  - (C21; [02 §7](02-rules-and-characters.md), [05 §4.1](05-world-sim-and-storyteller.md), [07 Q5](07-architecture-and-prototype.md))
- [ ] **Is the start year ever selectable?**
  - **`05`:** pick any year in 1835–1870, with era variants.
  - **`06`:** a "starting year" setting on the World screen.
  - **Rec (`09`):** fixed spring 1855 for v1, with other eras reachable only through legacy time-skips.
  - (C6; [05 §1.2, Q3](05-world-sim-and-storyteller.md), [06 §7.1, Q10](06-game-modes.md))

### 1.4 Mind and social model (needed for M1–M2)

- [ ] **How does `04`'s Mind fold into the ADR's psyche-lite?**
  - Psyche-lite: `egoStrength`, `superegoStrictness`, and `idAppetite`; Thoughts voiced by Id or Superego; hourly Ego arbitration; defenses as events.
  - **`09` rec:**
    - `04`'s nine Values become Superego content and Id temperament.
    - Projection and displacement become terms in `04`'s attribution formula.
    - Decide whether `egoStrength` is seeded from WIS.
  - `10-psyche.md` owns the answer.
  - The Values half of `04` Q1 is still open: "Which period values would you add or swap (Propriety, Temperance)?"
  - (C3; [04 §3, Q1](04-social-simulation.md), [00 P7](00-vision-and-pillars.md), [adr/0001](adr/0001-typescript-stack.md))
- [ ] **What's the opinion model?**
  - **`04`:** Affection, Respect, Trust, Fear, plus an Obligation ledger. Opinions change only through Reasons. Grudges are separate objects.
  - **`07`:** four `i8` fields with an embedded grudge, and no Obligation or Reasons.
  - **`06`:** the Prince rates the witch on amusement, esteem, trust, and desire.
  - **Rec (`09`):** `04`'s model everywhere, with the Prince's dimensions mapped onto it.
  - (C36; [04 §6](04-social-simulation.md), [07 §3.3](07-architecture-and-prototype.md), [06 §3.4](06-game-modes.md))
- [ ] **Do grudges decay?**
  - The lore says no: the Prince's whole thesis is that "grudges don't decay". The mechanics say yes: `04` decays them with a time constant τ of 60 days × (1 + Rancor).
  - **Option (a):** grudges about uncanny or fae events never decay, or decay only to a high floor. `09` recommends this, since it makes the lore literally true.
  - **Option (b):** keep `04`'s math and soften the lore.
  - (C12; [01 §4.4](01-setting.md), [04 §6.3, §9.5](04-social-simulation.md))
- [ ] **What's the canonical need list?** It needs to cover:
  - human physical needs (`05`)
  - social needs (`04`: Company, Standing, Security, Faith)
  - the vice and longing needs `02` cites, which `04` doesn't define: drink and fae-longing
  - fae needs (`01`: tribute, recognition, propriety, novelty)
  - `07` M1's list
  
  Also decide whether `04` owns the list or `10` does. (C38)
- [ ] **Should `07` implement `04`'s Belief and Rumor model in full?**
  - That model means interned propositions, typed evidence, lineage-based novelty, and T2 compartments.
  - `07` currently has simpler Rumor claims and per-settlement penetration.
  - **Rec (`09`):** yes, `04`'s semantics.
  - (C37; [04 §4–5, §8, §11.3](04-social-simulation.md), [07 §3.3, §6](07-architecture-and-prototype.md))
- [ ] **Who owns the persecution ladder?** Three versions exist:
  - **`04`:** rungs 0–6, Heat and Consensus. `04` declares that it owns this.
  - **`05`:** a settlement alert level from 0–5, plus HearthState.
  - **`06`:** witch notoriety tiers (Unknown → Hunted).
  
  **Rec (`09`):** `04` owns persecution of any person or Figure. `05`'s alert level covers only non-person threats. `06`'s tiers become labels for `04`'s rungs. Merge `04`'s M with `05`'s fear. (C41; [04 §9](04-social-simulation.md), [05 §7.1](05-world-sim-and-storyteller.md), [06 §3.9](06-game-modes.md))
- [ ] **Is there an investigation skill?** `04` and `05` lean heavily on Gather Information, but `02` has no such skill.
  - **Option (a):** add Gather Information to `02` as a CHA skill. `09` recommends this.
  - **Option (b):** map it to Persuade plus Lore (Local).
  - **Option (c):** make it an interaction resolved with Read People.
  - (C20)
- [ ] **What does the Chronicle show during play?**
  - `05` and `04` show only what the PC knows during a run and reveal the full truth post-run. That matches `00` P1.
  - `06` calls a live rumor-vs-truth side-by-side its "signature feature".
  - **Rec (`09`):** keep the side-by-side for the post-run epilogue.
  - Underneath that: is the post-run reveal a core payoff, or a spoiler for legacy play in the same World? ([04 Q9](04-social-simulation.md))
  - (C44; [05 §11](05-world-sim-and-storyteller.md), [06 §1.2](06-game-modes.md))

- [ ] **Which doc owns which parts of the P8 food model?**
  - `00` P8 asks for calories, nutrition and freshness, spoilage, preparation, rationing, and household pantries.
  - `03`'s item schema has no kcal or shelf-life fields. `02`'s hunger counts days. Nothing models scurvy, monotony, or cooking.
  - **Rec (`09`):**
    - `03` owns item fields.
    - `05` owns burn rates, spoilage physics, and pantries.
    - `02` owns deficiency conditions.
    - `04`/`10` owns monotony.
  - Needed by M1 (NPC needs) and M4 (Outfitter).
  - (C48, C24; [00 P8](00-vision-and-pillars.md), [03 §3.1, §6.4](03-gear-and-economy.md), [05 §6.1](05-world-sim-and-storyteller.md), [02 §11](02-rules-and-characters.md))

### 1.5 Starter content (needed for the `smoke_town` scenario)

- [ ] **Is the starter town authored or generated?**
  - **`01`:** hand-authored Iron Ford.
  - **`06`:** a "Threshold Town" generated per World. Its example is Prairie Landing with Halvorsen's.
  - **`05`:** an authored skeleton with procedural detail.
  - **Rec (`09`):** `05`'s hybrid, with Iron Ford as the default World.
  - (C8; [01 §8](01-setting.md), [06 §2.2](06-game-modes.md), [05 §1.2](05-world-sim-and-storyteller.md))
- [ ] **How much real geography?**
  - **Option (a):** a fictional county on real rivers, with real towns kept off-map. `01` recommends this.
  - **Option (b):** a fantasy remap of a real county such as Vernon or Crawford.
  - **Option (c):** fully original geography.
  - `02` and `04` currently put real Viroqua and Readstown on the map.
  - ([01 §3.2, Q3](01-setting.md), [05 Q2](05-world-sim-and-storyteller.md), C7)
- [ ] **Approve `01`'s Hollin County cast, then do one names pass.** The pass moves every worked example in `02`, `04`, `05`, and `06` into the county, or marks it illustrative. It also fixes three things:
  - "Whitcomb" is both a surveyor and a preacher.
  - "Brandt" is used for several unrelated people.
  - There are three different newspapers.
  
  ([01 §8](01-setting.md), C7)

---

## 2. Important but can wait

### 2.1 Setting and sensitivity

- [ ] **How do Native nations appear?** This is the most consequential tone decision. Answer it before authoring county content (M2.5/M5).
  - **Options (`01`):**
    - **A. Historical presence:** real nations, real names, accurate politics.
    - **B. Fictional nations** with analogous histories.
    - **C. Divergent history:** real nations, but a *political* divergence. For example, the Ho-Chunk keep a sovereign homeland on the county's northern border.
    - **D. Omit** them entirely.
  - **Rec (`01`):** C, with paid consultants and sensitivity readers, and named NPCs kept as placeholders until then.
  - Follow-ups `09` found:
    - Remove the flint "elf arrows" and plowed-up flint blades. In the Driftless those would be Native artifacts read as fae. (`05`, `06`, `03`)
    - Restate `05`'s "barrow-wights / a plow opens a barrow" so it's clearly fictional fae.
    - Rename `02`'s **Lore (Old Peoples)**.
    - If C is chosen, add a sovereign-neighbor faction to `05`.
  - (C10; [01 §2, Q1](01-setting.md), [03 Q9](03-gear-and-economy.md), [05 §7.2, Q9](05-world-sim-and-storyteller.md), [06 Q13](06-game-modes.md))
- [ ] **The Civil War: a scheduled world event (1861) or removed from this alt-history?** ([01 §3.1, Q2](01-setting.md))
- [ ] **Witchcraft law.**
  - **Option (a):** persecution is only extralegal. `01` recommends this.
  - **Option (b):** a statute exists, with formal trials.
  - If (a), `04`'s rung-6 "Trial" and `05`'s "hanged" become mundane charges and mob action.
  - (C13; [01 §5.4, Q6](01-setting.md), [04 §9.2](04-social-simulation.md), [05 S6](05-world-sim-and-storyteller.md))
- [ ] **Content limits** (merged from four docs):
  - Do changeling swaps, death curses, and infant harm exist at all? If so, are they toggleable, or NPC-only?
  - How far does rung 6 go? Mob killings of NPCs, or of the PC witch?
  - How dark do fae bargains get by default (firstborn liens, memory deletion)?
  - Is "Tie the Knot" (impotence) in?
  - Does the obedient witch path have a ceiling on mass harm?
  - **Recs:** `06` recommends toggles, with off-screen or threatened-only defaults for child harm. `01` asks for the "suspicion harms real children" framing for changelings.
  - ([06 Q5, Q6, §3.2, §8.3](06-game-modes.md), [04 Q2](04-social-simulation.md), [03 Q8](03-gear-and-economy.md), [01 Q13](01-setting.md))
- [ ] **Tone of witch mode.**
  - **A:** tragic folk horror (`06` recommends this).
  - **B:** dark power fantasy with consequences.
  - **C:** ambiguous magic, with gleaning as the main loop.
  - ([06 §3.2, Q1](06-game-modes.md))
- [ ] **Should the Director tip suspicion onto an innocent scapegoat as witch-mode "mercy"?** `05` proposes it. The alternative is to leave scapegoating to the player's own Curses. ([05 §8.9, Q8](05-world-sim-and-storyteller.md))
- [ ] **Real history references** (Salem, Bridget Cleary, the York hex murder, braucherei): use them only as background research, or allow in-world analogues such as an almanac of famous witch cases? ([06 Q12](06-game-modes.md))
- [ ] **Real remedies with true effects:** is it OK that calomel poisons and snakeroot does nothing, while the period copy claims otherwise? ([03 Q10](03-gear-and-economy.md))
- [ ] **Real or fictionalized denominations?**
  - Real names with fictional congregations (`01` leans this way), or fictionalized ones ("the Synod", "the Connexion")?
  - ([01 §5.2, Q4](01-setting.md))

### 2.2 Fae and witch systems

- [ ] **Witch weaknesses: what triggers them?** These are iron, consecrated ground, bells, salt, and running water. Four docs disagree:
  - **`02`:** the Witch class has Unhallowed from level 1, with no iron sensitivity.
  - **`03`:** the witch is iron-sensitive above IP 5.
  - **`06`:** weaknesses come from Drift thresholds (40 and 60), and some curses use iron nails.
  - **`01`:** running water stops witches, and the iron question is open.
  - **Rec (`09`):** tie every weakness to Drift, so the system is universal (P4) and adventurers share it.
  - (C27; [01 Q10](01-setting.md), [03 §3.3, Q2](03-gear-and-economy.md), [02 §6.3](02-rules-and-characters.md), [06 §3.8](06-game-modes.md))
- [ ] **What counts as cold iron?**
  - **Option (a):** cold-hammered and never quenched, as a premium tier at ×3 effect. `03` proposes this.
  - **Option (b):** all iron, as in the folklore.
  - **Option (c):** meteoric or bog iron only.
  - `02` uses the term without defining it. (C28; [03 Q3](03-gear-and-economy.md))
- [ ] **One fae currency or several?** The candidates are Woe (`06`), "glamour" as a fae need (`05`), and Fae intensity fed by rumor (`01`).
  - **Rec (`05`, `09`):** one fungible currency, Woe, with Fae intensity staying as the spatial field.
  - (C45; [05 §5.3, Q5](05-world-sim-and-storyteller.md))
- [ ] **Which doc owns the curse math?**
  - **`02`:** DC = 10 + rite rank + CHA + link (−4..+4).
  - **`06`:** DC = 10 + witch level + link (+0..+6) + timing + Gifts.
  - The protection bonuses also differ between them.
  - **Rec (`09`):** `06` owns the catalog and protections, `02` owns one DC formula, and the protections become items in `03`'s catalog.
  - (C29; [02 §10.6](02-rules-and-characters.md), [06 §3.5](06-game-modes.md))
- [ ] **How do witches progress?**
  - `02` gives the witch fae spell points plus Woe that substitutes for slots. `06` gives Woe that buys Gifts, Workings, and Mercies. Do both systems exist?
  - Do curses grant XP, or is Woe the witch's only reward for cursing?
  - ([02 §6.6, Q12](02-rules-and-characters.md), [06 §3.6](06-game-modes.md), C30)
- [ ] **Is the Prince one fixed character or generated per World?**
  - **`01`:** a fixed person: an ecological zealot, the younger son of the sleeping sovereign, keeps his word, bored by cruelty.
  - **`06`:** a randomized temperament per World (Capricious/Cold/Jealous/Hungry/Melancholy), recommended there.
  - **Rec (`09`):** `01`'s core stays fixed and `06`'s temperament becomes a mood overlay, minus the sadistic options.
  - (C15; [06 §3.4, Q3](06-game-modes.md), [01 §4.4](01-setting.md))
- [ ] **What is the scope of "fae may not directly harm humans who haven't trespassed or bargained"?** It conflicts with the Alder Court taking children, the Wild Hunt, ring dances, and elf-shot cattle. Does the rule bind only the Prince's Court, or is "trespass" defined broadly? (C14; [01 §4.4](01-setting.md), [05 §10.3](05-world-sim-and-storyteller.md))
- [ ] **How severe is time slippage?**
  - **`01`:** ×1.5–7 subjective-time ratios, capped and always displayed; losing a week to a revel is the open question.
  - **`05`:** 1d6 days per hour on a fae path at FI 4, possibly negative time at FI 5, and returns after "months or years"; `05` proposes a cap of 1d6 months outside Samhain.
  - (C18; [01 §4.5, Q11](01-setting.md), [05 §1.4, Q11](05-world-sim-and-storyteller.md))
- [ ] **What does eating fae food do?** There are four partial specs: Bound (`01`), Wasting plus longing (`02`), 50% nutrition (`05`), and Drift gain (`06`). **Rec (`09`):** one condition chain owned by `02`. (C26)
- [ ] **Should high Fae intensity or fae magic make gunpowder misfire?** It's a strong flavor lever with large balance effects. ([02 §9.5, Q8](02-rules-and-characters.md))
- [ ] **Do fae run on `04`'s Mind and Belief engine?** `04` leans toward yes, with fae-specific Values and "cannot lie" as a hard constraint. The alternative is separate fae logic. ([04 Q5](04-social-simulation.md))
- [ ] **Drift as a universal stat:** do you want adventurers slowly becoming fae as a long-term risk and reward? ([06 Q14](06-game-modes.md))
- [ ] **When is the Tithe due?** Monthly at the full moon (`06`), or at Lammas (`05`)? **Rec (`09`):** monthly, with Lammas as a special harvest Behest. (C19)

### 2.3 Rules and characters

- [ ] **Level cap.** 12 for v1 (`02`), an E6-style option (levels 1–6, then feats only), or eventually 1–20? ([02 §6.5, Q1](02-rules-and-characters.md))
- [ ] **Skill advancement.** Is the hybrid of points plus practice right? Is "practice ignores cross-class" too generous? ([02 §4.4, Q3](02-rules-and-characters.md))
- [ ] **Wound lethality.** Firearms halve the wound threshold. Should one musket ball be able to kill a level-1 character? It currently takes a crit to the head or torso. ([02 §8, Q4](02-rules-and-characters.md))
- [ ] **Player morale.** Should a failed check force the PC to flee? `02` leans toward forcing it only at Panicked, with an off switch. ([02 §9.8, Q9](02-rules-and-characters.md))
- [ ] **Class roster.**
  - Are the starter nine right? Would you swap in a Lawman, a Lumberjack, or a Schoolmarm?
  - Do settled pastors need a class, separate from the Circuit Rider? (C17)
  - Can non-witches become Witches mid-run through the Prince's offer?
  - ([02 §6.3, Q6](02-rules-and-characters.md))
- [ ] **Magic traditions.**
  - Four engines (slots, slots plus faith, charms, tidal spell points) is a lot to build. Fold one away?
  - Line them up with `01`:
    - Wizards: `01`'s survey-and-measurement "lyceum" or `02`'s astrological Almanacker?
    - Should arcane magic weaken, and folk magic strengthen, as Fae intensity rises?
    - Does clerical power scale with belief in *the cleric* (systemic) or belief in *God* (theological)?
  - (C17; [02 §10, Q7](02-rules-and-characters.md), [01 §5.3, Q5](01-setting.md))
- [ ] **Spell catalog size at launch.** `02` suggests about 120 spells plus about 30 curse rites. ([02 Q11](02-rules-and-characters.md))
- [ ] **Hardships.** Can they be bought off later through deeds? ([02 §5.4](02-rules-and-characters.md))
- [ ] **Familiars.** Witch and Fae-Touched only, or Almanackers too? ([02 §6.3](02-rules-and-characters.md))
- [ ] **Encumbrance owner.**
  - `02` uses 3.5's three bands. `03` uses five continuous bands. `05` treats heavy as over ⅓ capacity.
  - **Rec (`09`):** `02` owns carrying capacity from STR, `03` owns the bands, and `05` reads them. This is needed by M4.
  - (C22; [03 §4, Q5](03-gear-and-economy.md))
- [ ] **Insulation units.** `03` uses insulate points and `05` uses °F of band extension. They also disagree on how much warmth wet wool keeps (70% vs. 50%). **Rec (`09`):** `05`'s °F model. (C23)
- [ ] **Survival stage effects.** Hunger and fatigue are defined twice, in `02` and `05`. Disease tables are also defined twice. **Rec (`09`):** `05` owns rates and epidemiology, and `02` owns per-person effects. The hunger part is mostly settled by the P8 item in 1.4. (C24, C25)
- [ ] **Disease lethality.** Use real period fatality rates with legible protections (`05` recommends this), or tune them down? ([05 Q12](05-world-sim-and-storyteller.md))
- [ ] **Charm prices.** In `02`, a 1st-level charm costs $7–$10 (7–10 days' wages), while `03`'s folk wards cost $0.03–$1.50. **Rec (`09`):** cut `02`'s charm prices about 10×. (C34)
- [ ] **Backgrounds.** `03` and `06` each have their own list. **Rec (`09`):** one table owned by `06`, with columns contributed by `03` and `02`. (C31)
- [ ] **Notoriety tiers.** `02` and `06` refer to tiers that `04` never defines. (C42)
- [ ] **Ability-score names.** Keep the classic six (`02` recommends this) or rename them for the period? Moved here from flavor, because it touches every UI. ([02 Q2](02-rules-and-characters.md))

### 2.4 Economy and gear

- [ ] **Starting money.**
  - Rolled (3.5-style variance, `03` recommends) or fixed per background?
  - Is the $20–$150 range by background OK?
  - ([03 Q4](03-gear-and-economy.md), [06 Q7](06-game-modes.md))
- [ ] **Should the default adventurer start begin in debt to the Outfitter (a grubstake)?** `06` treats borrowing as optional. ([03 §8.5, Q7](03-gear-and-economy.md))
- [ ] **Readiness panel.** Gate it by skill, so a greenhorn's list is short and sometimes wrong? Or make it honest and complete? ([03 §2.4, Q6](03-gear-and-economy.md))
- [ ] **Inventory.** Confirm there's no spatial pack grid. `03` recommends bulk, nesting, and reach time instead. ([03 §2.3, Q5](03-gear-and-economy.md))
- [ ] **Magic items in shops.** None (`03` recommends storied items and folk wards only), or a PHB-style "under the counter" tier? ([03 Q11](03-gear-and-economy.md))
- [ ] **Do coins have weight?** 1,000 silver dollars weigh about 59 lb. `03` recommends yes. ([03 Q13](03-gear-and-economy.md))

### 2.5 Modes, legacy, and structure

- [ ] **Companion cap:** 2 people + 1 animal in v1? ([06 §2.6, Q8](06-game-modes.md))
- [ ] **"Choose a soul":** can the player play any existing NPC in a World? `06` recommends yes. ([06 §5.4, Q9](06-game-modes.md))
- [ ] **Time skip between runs:** offer 0, 1, 5, or 20 years? ([06 §5.4, Q10](06-game-modes.md); `05` §11.3 says 1–20 years)
- [ ] **Do NPCs remember a previous run's character** in a later run in the same World? ([04 Q10](04-social-simulation.md))
- [ ] **Witch-mode legibility:** an explicit heat/rung meter, or diegetic cues only? ([04 §12.3, Q3](04-social-simulation.md))
- [ ] **Does the adventurer get the full lying, framing, and planting toolkit?** P4 suggests yes. ([04 Q4](04-social-simulation.md))
- [ ] **Director's Ledger visibility:** opt-in "Show the Director's hand" (`05` recommends), on by default, or debug-only? ([05 Q6](05-world-sim-and-storyteller.md))
- [ ] **Director personalities:**
  - Do the seven work?
  - Can the player switch mid-run?
  - Is "The Land Itself" (no Director) a first-class option?
  - ([05 §8.8, Q7](05-world-sim-and-storyteller.md))
- [ ] **Map edge:** a hard wall with abstracted off-map journeys, or are other counties future content? ([05 Q13](05-world-sim-and-storyteller.md), [05 §1.2](05-world-sim-and-storyteller.md))
- [ ] **Extinctions** (elk, passenger pigeon, wolves):
  - Fixed historical schedules, or driven by simulated pressure?
  - `05` recommends simulated pressure, so a run can save the pigeons locally.
  - ([05 Q14](05-world-sim-and-storyteller.md))
- [ ] **Chronicle export** as formatted text or HTML for sharing? `06` recommends yes. ([06 §1.2](06-game-modes.md))
- [ ] **Language partitioning:** how much should Old Country languages matter? It needs UI for gossip the PC can't understand. ([04 §8.4, Q6](04-social-simulation.md))

### 2.6 Later tech

- [ ] **LLM text in the shipped game.** This merges three doc questions.
  - **Option (a):** dev-time only (`07`'s default).
  - **Option (b):** an optional runtime layer for documents and the Chronicle (`04` L2/L3).
  - **Option (c):** runtime barks (`04` L1).
  - **Option (d):** a mod hook.
  - The docs agree the LLM only renders text and never decides anything.
  - ([04 §14, Q7](04-social-simulation.md), [05 §11.2, Q10](05-world-sim-and-storyteller.md), [07 §7, Q6](07-architecture-and-prototype.md))
- [ ] **Modding and scripting ceiling.** Declarative effects only, or a real scripting language? `07`'s Rhai/Lua fallback needs a TS replacement. ([07 §3.8, Q7](07-architecture-and-prototype.md))
- [ ] **Art pipeline details.** Blender is decided. Will you model assets yourself, should Claude generate Blender Python scripts, or kitbash primitives until M7? ([07 Q8](07-architecture-and-prototype.md))
- [ ] **Git hosting and CI:** a remote (GitHub or Codeberg) with CI, or local only? ([07 Q10](07-architecture-and-prototype.md))
- [ ] **How strict is LOD consistency?** May trivia drift (a peddler who "was" at the tavern shows up elsewhere at T0), as long as memories and the Chronicle never contradict? `07` suggests yes. ([07 §3.5](07-architecture-and-prototype.md))

### 2.7 Housekeeping (quick confirmations; each has a `09` recommendation)

- [ ] **`00` vocabulary.** Change "persona" to "figure" in the Grudge, Notoriety, and Reputation definitions to match the rename. Only Ellie edits `00`. (C4)
- [ ] **One Event struct.** `07` owns it and adds `05`'s `causes`, `visibility`, and `director_nudge` fields. (C39)
- [ ] **LOD rules.** `05` owns tier policy. `07` owns mechanism and budgets, restated for TS and phones. `04` owns social hydration. (C40)
- [ ] **Director rumor powers.** `05`'s stricter rule wins: the Director can only voice facts a carrier knows, and can't plant false variants (which `04` §8.2 allows). (C43)
- [ ] **Court names.** Fix `03`'s "Thorn Court's ferryman" once `01`'s court names are approved. (C16)

---

## 3. Flavor and taste calls

### 3.1 Names

- [ ] **The Woe resource:** Woe (`06` recommends), Teind, Sorrow, Bane, or your own word? ([06 §3.6, Q4](06-game-modes.md))
- [ ] **"Drift" collision:**
  - `01` calls the Ice "the Drift" (anti-fae), which clashes with canon Drift (becoming fae). `01` also has "Drift-wights".
  - **Rec (`09`):** rename `01`'s terms to "the Ice", "the Till", or "the Sorting", and the wights to "erratics" or "till-wights".
  - (C11; [01 §4.1](01-setting.md))
- [ ] **Shared names:** "The Circuit Rider" names a Director personality (`05`), a class (`02`), and a mode (`06`). "The Hidebehind" is both a Director personality and an `01` creature. Keep or rename? (C32)
- [ ] **Working title "Coulee":** keep it or replace it? ([00](00-vision-and-pillars.md))
- [ ] **The in-world catalog:** `03` wants the Outfitter's catalog to be the proprietor's pasted-up **Book**, not a mail-order wishbook, to stay true to the 1850s. ([03 §2.1, §11](03-gear-and-economy.md))

### 3.2 Story and lore

- [ ] **The witch's gender:** player's choice, with the bias model making it matter (`06` recommends), or always "she"? ([06 Q2](06-game-modes.md))
- [ ] **The Prince's thesis:** should the game ever confirm that re-enchantment through fear backfires, or leave it ambiguous? ([01 §4.4, Q7](01-setting.md))
- [ ] **The sleeping sovereign:** a usable story lever (a monarch who might wake), or too epic for a sim? ([01 §4.3, Q8](01-setting.md))
- [ ] **Bestiary tone:**
  - How much lumber-camp comedy (hodag, squonk) vs. folk dread?
  - `01` suggests comedy at low Fae intensity and dread at high.
  - ([01 §7, Q12](01-setting.md))
- [ ] **Do the fae have a stake in the passenger pigeons?** ([05 §5.2](05-world-sim-and-storyteller.md))
- [ ] **Slope aspect as fae geography:** does the Court hold the sunny bluffs while something else holds the dark slopes? ([05 §1.3](05-world-sim-and-storyteller.md))
- [ ] **Sang digging:** do you want ginseng digging as a Driftless money loop, possibly fae-guarded? ([03 Q12](03-gear-and-economy.md))
- [ ] **Your own Driftless:** which coulees, towns, or family stories should go in? ([01 Q14](01-setting.md))
