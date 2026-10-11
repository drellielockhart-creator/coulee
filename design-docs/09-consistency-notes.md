# 09 — Consistency Notes

**Status:** Integration pass over `00`–`07`, 2026-10-10. `00` is canonical. Every conflict below gives the docs and sections involved, what disagrees, a recommended resolution (which doc should own it, and which version is better), and a status:

- **[FIXED]**: a trivial inconsistency (terminology, a wrong cross-reference, a number that contradicts its owning doc) that I corrected with a small, surgical edit. The edit is listed.
- **[NEEDS DECISION]**: a real design choice, or a fix too large to make without one. Each of these is also in `08-open-questions.md`.

> **Note on timing.** `00` was revised twice *during* this pass (20:27 and 20:29), and `adr/0001-typescript-stack.md` appeared at 20:29. The revisions added:
> - **P6 "pocket" (phone) play**
> - **P7 Freud/Jung psyche** replacing alignment
> - **P8 "crunch you can pack"**: detailed food, rations, consumables, and spoilage
> - the **peoples roster** (humans, elves, shadow-faekin, goblins)
> - the **TypeScript/PWA stack**, which the ADR spells out: Node, pnpm, Vite, React, three.js, the sim in a Web Worker, integer game-minutes, no transcendental Math in core, and a "psyche-lite" M1 model
> - **Blender** for placeholder art
> - **Persona → Figure** as the name of the rumor-identity concept
>
> Docs `01`–`07` predate all of this. `10-psyche.md`, `11-interface-and-platforms.md`, and `12-peoples.md` didn't exist yet when I checked, so §2.A is checked against `00`'s and the ADR's summaries only.

**At a glance:** 49 conflicts or mismatches logged (C1–C49). 3 were fixed outright and 5 more partly fixed, for about 135 individual text edits across `02`, `03`, `04`, `05`, `06`, and `07`. I didn't edit `00`, `01`, or the ADR. The other 46 (including the unfixed parts of the 5 partial fixes) need a decision or a doc rewrite. C48–C49 come from the second revision of `00` and the ADR. Section 2 is grouped by topic, so IDs run in order within each group.

---

## 1. Edit log (everything I changed)

All edits are word- or number-level. No sections were rewritten. A backup of the pre-edit docs is in the session scratchpad.

| Doc | Edit | Why |
|---|---|---|
| `02` §14.1 | Josiah's outfit prices brought in line with `03` §6: powder horn + powder + lead $3 → $1.25, hatchet $1.25 → $0.65, blanket $2 → 3-point $3, fire steel $0.40 → flint, steel & char tin $0.25, haversack $1.50 → $0.75, "jerky and hardtack $2" → "hardtack and bacon ~$0.70", "$8 brogans vs. $3 moccasins" → "$1.25 vs. $0.50" | `03` owns prices (C34) |
| `03` §8.3, §8.5, §10.1, §10.4 | Outfitter "Mr. Pruitt" → **Gussie Pratt** (`01` §8.3), i.e. "pay back Pratt", "Pratt's Grubstake Rifle", "Bought at Pratt's". The generic proprietor "he" elsewhere is untouched (other towns have other Outfitters). | `01` owns the starter cast (C46). This also removes the collision with `04`'s Deacon Pruitt. |
| `03` §3.3 | "per `02` bestiary" → "per `01` §7 bestiary" | Wrong cross-reference |
| `03` (14 spots) | 3.5e skill names → `02` names: Bluff/Sense Motive → Deceive/Read People; Survival → Woodcraft; Knowledge: Nature/Folklore → Lore (Nature/Fae); Heal → Medicine; Appraise → Bargain; Profession → Bargain/Trade; Craft → Trade; Handle Animal → Animal Handling; Search/Hide → Perception/Stealth | C20 |
| `03` §6.7 | Musket reload ~25 s → ~20 s; revolver ~2 min → ~90 s per cylinder | `02` §9.5 owns combat stats (C35) |
| `04` §15.3 | "1858, game start" → 1855; "1841–1858" → "1841–1855"; "after 17 years" → "after 14 years" | `00`: the game starts in spring 1855 (C6) |
| `04` (≈30 spots) | Skill names → `02` (Diplomacy → Persuade, Bluff → Deceive, Sense Motive → Read People, Spot/Listen → Perception, Appraise → Bargain, Profession → Trade, Heal/Survival → Medicine/Tracking). Deleted "(02 skill names TBD)". **Gather Information is kept** and marked "not yet in 02; see 09", because `02` has no equivalent (C20). | C20 |
| `04` (29 spots) | **Persona → Figure** (Persona/Personae/IsPersona/PersonaFit → Figure/Figures/IsFigure/FigureFit; "Persona ledger" → "Figure ledger") | `00` vocabulary rename (C4) |
| `05` (11 spots) | Skill names → `02`: lost check Survival → **Wayfinding**; forage Survival_margin → Woodcraft_margin; traces Survival/Search/Appraise → Tracking/Perception/Bargain; Hide → Stealth; Heal → Medicine; forecasting via Trade (Farming) or Lore (Nature/Almanac); H4 Survival → Tracking | C20 |
| `06` §1.2, §9.1, §9.2 | Chronicle dates '47 / '52 / '52 → **'55** | C6 |
| `06` §1.3 | "HP/injury per 02" → "Vigor/Wounds per 02" | `00` vocabulary |
| `06` §2.4, §2.6, §3.6, §3.10, §9.1 | Skill names → `02` (Deceive/Perform/Persuade, Bargain/Persuade, Deceive vs. Read People, Tracking/Perception, Herbalism/Medicine/Lore (Nature), Woodcraft) | C20 |
| `06` §7.1 | Creation screen 11 "**Calling**" → "**Class**", with a note that `02`'s Callings are prestige classes. Also "Witch calling" → "Witch class" in §7.1 and §7.3. | C32: in `02`, "Calling" means a prestige class |
| `06` §7.1 | Abilities screen now lists all three of `02` §2.2's methods (adds Hard Country) | C33 |
| `06` §3 setup screen | "Director persona" → "Director personality" | `05` term; avoids the new Jungian "Persona" |
| `06` §7.2, §11 Q7 | Starting dollars "$25–$150" → "$20–$150" | `03` §7.2 (itinerant preacher starts at $20) |
| `06` §9.1 | Ada's shopping: hatchet $1.25 → $0.65; "Hawken-style rifle" → "Kentucky long rifle" ($14, the `03` item; `03` avoids real brand names); "shotgun $8" → "fowling piece $7"; map $0.25 → $0.50 | `03` prices |
| `06` §3.2 | "powwow" → "braucherei ('powwowing'; `01` §5.3 keeps that word out of the game)" | `01` §5.3 |
| `07` §3.3 | `Site.fae_intensity` annotated as the map baseline, with the per-tile field living in the TileMap | `00`: per-tile field plus map baseline |
| `07` §3.8 | Sample content aligned with its owners: hatchet 75¢/2.5 lb → 65¢/1.5 lb (`03`); `skill.survival` → `skill.woodcraft` (×3); Kindle casting time 6 s → 3 s (`02`); `school = "evocation"` → `traditions = [...]`, and the lint "spell with no school" → "no tradition" (`02` §10.1 has traditions, not schools); gossip need `"social"` → `"company"` (`04` §3.3) | Owning docs |

---

## 2. Conflicts

### A. Canon added to `00` after `01`–`07` were written

**C1. Tech stack: `07` recommends Rust + Godot; `00` and `adr/0001` say TypeScript PWA.** **[NEEDS DECISION]** (the decision is made; what's left is a rewrite of `07`, plus the items below)
- *Where:* `adr/0001` ("Supersedes the Rust + Godot recommendation… 07 is being rewritten") vs. `07` §0, §2.4, §3.1–3.3 (Rust structs), §3.6 (clippy/HashMap bans), §3.7 (serde/postcard), §3.8 (Rust schemas, Rhai), §3.10 (gdext), §8 (repo layout), §9 M0/M3 (Godot), §10 (rustup/cargo session plan), §11 (gdext risk), and §13 Q2/Q3/Q9.
- *Settled by the ADR:* PWA in the browser, Capacitor and Tauri later; Node 26 + pnpm + tsx + Vitest + Biome; TOML → zod → a JSON bundle; Vite + React + three.js; the sim runs in a Web Worker.
- *Still carrying over from `07`, per the ADR:* the core/shell split, the event log, LOD management, counter-based RNG, content as data, harness first, golden Chronicles, and milestone order.
- *Remaining:* rewrite `07` to match the ADR. `07`'s performance budgets (§6) and county scale (C9) were sized for Rust; `07` itself estimates a TS core at 3–10× slower. The ADR sets only an M2 phone target ("<5 ms per game-hour for 30 T1 actors on a mid phone; county-scale numbers come later").

**C2. Phone ("pocket") play vs. dense desktop UI specs and desktop perf budgets.** **[NEEDS DECISION]**
- *Where:* `00` P6 vs. `03` §2.2 (a three-pane landscape catalog with Flat-Lay and paper doll), `04` §12 (dossier, relationship web, rumor ledger), `05` §1.5 (the region map), `06` §7 (a 15-screen creation flow), `07` §6 (budgets for "a mid-range PC", 300 MB resident), and `04` §13.1 (also "mid-range PC").
- *Nature:* Every UI spec assumes a desktop. The perf targets (a 5,000-actor county fast-forwarding through years) were set for desktop Rust and now have to run in TS on a phone.
- *Resolution:* `11` owns the pocket variants of every screen. `07` (rewritten) owns per-platform budgets. Ellie still needs to decide whether the *whole county* sim (C9) runs on a mid-range phone, or whether phones get a smaller county or a slower T2 cadence. The ADR names only "a mid phone" as the target.

**C3. `00` P7 psyche (Freud/Jung) vs. `04`'s Mind model.** **[NEEDS DECISION]**
- *Where:* `00` P7 (Thoughts voiced by Id or Superego, Ego arbitration, Ego strength "like a stat", anxiety, defense mechanisms that drive scapegoating, Persona/Shadow, archetypes, dreams) vs. `04` §3.1 (nine bipolar Values), §3.3 (RimWorld-style mood as a sum of thoughts), and §5.4 (an attribution formula with no defense terms). Also `07` §3.3 (the `Mind` struct), `02` §2.1 (WIS drives Will and morale), and `02` §9.8 (morale).
- *Nature:* `04` is a values-and-beliefs model. `00` now mandates a structural psyche on top of it. The two overlap at scapegoating (`04` gets it from the attribution priors, `00` from projection and displacement) and at mood. Where "Ego strength" sits is undefined: a 7th stat, derived from WIS, or a Mind field?
- *Partly settled by the ADR's psyche-lite:* the `Mind` holds `egoStrength`, `superegoStrictness`, and `idAppetite` (each 0–100) plus anxiety (0–1000). Thoughts are voiced by Id or Superego. Every hour the Ego arbitrates among the competing urges. Defenses (displacement, projection, rationalization, repression, sublimation) fire as events. That answers the "where does Ego strength live" question: it's a Mind field, not a 7th ability.
- *Remaining:* how `04`'s nine Values, its mood "thoughts", and its attribution formula fold into this. Recommendation:
  - `04`'s Values become Superego content (Piety, Thrift, Neighborliness, Parochialism) and Id temperament (Temper, Ambition).
  - Projection and displacement become explicit terms in `04` §5.4's attribution weight.
  - Decide whether `egoStrength` is seeded from WIS so it lines up with `02`'s Will/morale.
  - `10-psyche.md` owns the answer.

**C4. Persona → Figure.** **[FIXED]** in `04` (29 occurrences) and `06` (one "Director persona").
- *Still open in `00` itself:* `00`'s own vocabulary still says "persona" in the **Grudge**, **Notoriety**, and **Reputation** definitions (lines 125–127), right below the new Figure entry. I didn't edit `00`. Recommend Ellie changes those three to "figure".

**C5. Peoples roster is now canon, but `01`, `02`, and `06` treat ancestry as an empty slot.** **[NEEDS DECISION]** (owner: `12-peoples.md`)
- *Where:* `00` (humans, elves, shadow-faekin, goblins) vs. `01` §6 (structural slots, "elves" provisional, plus cautions), `02` §12 (ancestry schema with a ~6-point budget), `04` §6.2 (group opinions keyed on ancestry), and `06` §3.1 ("human and elven company").
- *Open points:*
  - **Shadow-faekin "hidden"**: the ADR settles that they're concealed by default and pass as human or elf, so other actors know them only through beliefs (`04` `Is(kind)` props and Figures fit). Still open: how they differ from `02`'s **Fae-Touched** class ("changeling, caul-born"), `01`'s changeling with its disguised sheet, `06`'s Changeling mode sketch, and `06` **Drift**. Otherwise several mechanisms will represent "part-fae person".
  - **Goblins** appear in no doc. `01` §6.1's cautions apply directly: don't fill the "were here first, close to nature" slot (a Native stand-in), and don't map a people onto a real ethnicity. Goblins have a heavy caricature history, so `12` should check them against those cautions.
  - `01` §6.2's questions are now live: are elves renouncers from Faerie, can any people become a witch, and do iron and thresholds affect peoples differently?
  - `02` §12's `social_tags` (prejudice priors) and `04` Q2 (redirect real-world prejudice onto fantasy peoples?) need an answer now that real peoples exist in the roster.

### B. Setting, time, and place

**C6. Start date.** Mostly **[FIXED]**; the remaining question is **[NEEDS DECISION]**.
- *Fixed:* `04` §15.3 (1858 → 1855) and `06` §1.2/§9 ('47/'52 → '55).
- *Still conflicting:* `05` §1.2 has "a run picks a start year in the 1835–1870 band" with era variants, plus `05` Q3. `06` §7.1 has "New World (… starting year)" and Q10. `00` says "The game starts in spring 1855".
- *Recommendation:* fixed spring 1855 for v1. Reach other eras only through legacy time-skips (`06` §5.4, `05` §11.3), so `05`'s era variants become *later* states of the same county. The Civil War question (`01` Q2: a scheduled event or removed?) is still open.

**C7. Starter county, town, and NPC names diverge across docs.** **[NEEDS DECISION]** (owner: `01`)

| Doc | Places / people used |
|---|---|
| `01` §8 | Hollin County, **Iron Ford**, Lantern Coulee, Penhallow Diggings, Kvale Ridge, Raft Island Slough. Gussie **Pratt**, Horace **Bell** (*Iron Ford Sentinel*), Amos **Whitcomb** (surveyor), Tollef **Haugen** (miller) |
| `02` §14 | Kettle Coulee, Rush Creek ford, Haugen farm, **Readstown** store |
| `03` | Bank of Kickapoo (Valley), Black Earth Creek, "Father Doyle", Viroqua (in a chronicle line) |
| `04` §15 | **Rush Creek** settlement (~180), **Viroqua**, **Readstown**, Hemlock Coulee, ***Bad Axe Clarion*** (editor Sloane), **Rev. Whitcomb** (Methodist circuit rider), Deacon Pruitt, Sheriff Rude |
| `05` | Fenner Coulee, the Vogt farm |
| `06` §9 | **Prairie Landing**, **Halvorsen's** Outfitting, Rush Coulee, Bear Creek, Hollow Coulee, Sugar Bluff, Hartmann mill, Doyle |

- *Problems:*
  - Viroqua and Readstown are real towns used as on-map settlements, which contradicts `01` §3.2 ("real towns… exist as off-map T2 cities").
  - "Whitcomb" is two different people (`01`'s surveyor, `04`'s preacher).
  - "Brandt" appears four times (a `04` dairy farmer, a `06` widow, and `06`'s "Josiah Brandt", alongside `02`'s Josiah Penhallow).
  - There are three different newspapers.
- *Recommendation:* once `01`'s county is approved, do one names pass that moves every worked example into Hollin County (or labels it "illustrative, not canon") and renames `04`'s Rev. Whitcomb. *Partly fixed:* `03`'s Outfitter is now Pratt (C46).

**C8. Starter town: hand-authored (`01`) vs. generated per World (`06`).** **[NEEDS DECISION]**
- `01` §8 hand-authors Iron Ford, with the Outfitter, the cast, and seeded tensions. `06` §2.2 says the "Threshold Town" is "generated per World, with a guaranteed cast", and its own example is a different town (Prairie Landing, Halvorsen's). `05` §1.2 splits it: a hand-authored skeleton with procedural detail.
- `06`'s guaranteed-institutions list includes a "land office or claims agent", but `01` puts the land office at the off-map county seat.
- *Recommendation:* `05`'s hybrid. The default World uses `01`'s authored Iron Ford. "Threshold Town" is the *role* that generated Worlds fill. `06` keeps the guaranteed-institution checklist as a validation rule.

**C9. County size, population, settlements, and named actors.** **[NEEDS DECISION]**

| Doc | Area | Settlements | Population | Named actors / census |
|---|---|---|---|---|
| `01` §3.2, §8 | ~25 mi across, "a few hundred sq mi" | 6–10 hearths; **county seat off-map** | — | — |
| `05` §1.2, §3.5 | 24 × 30 mi ≈ 720 sq mi | ~6, **county seat on-map** | 3,000–5,000 | 600–1,500 named + lazy census |
| `04` §13 | — | — | notes a real county held 10–15k | T2 named 2,000–5,000 + census |
| `07` §3.5, §6 | — | ~10–25 | — | 2,000–5,000 named, **all with full Sheet + Mind always**; census only *beyond* the county |

- `07`'s "every named actor always has a full Sheet and Mind… only the statistical background population beyond the county is truly aggregate" contradicts `00`'s census materialization.
- The newspaper is also split: `05` puts it at the county seat as the Chronicle's "Paper" voice, while `01` gives Iron Ford (pop. 260) its own *Sentinel*.
- *Recommendation:* `05` owns world scale, and its numbers are the most defensible: 720 sq mi, 3–5k people, ~1k named, everyone else as census. `07` adopts census materialization. Given C1 and C2 (TS on phones), lean small. Decide whether the county seat is on-map (`05`) or off-map (`01`).

**C10. Native nations: the shared principles hold, but several details break them.** **[NEEDS DECISION]** (owner: `01` §2)
- *Aligned:* `03` §9 (mounds aren't loot), `05` §7.2 (not a hostile faction), `05` M4 (fae barrows are never a real mound type), and `06` Q13 all defer to `01`.
- *Conflicts:*
  1. **Flint "elf arrows."** `05` §6.5 ("a flint 'elf arrow' may be found in the wound"), `05` F9 ("flint points found"), `06` §3.7 #15 Elf-Shot ("a flint arrowhead found in a field"), and `03` §6.12 ("Knapped flint blade… Turned up by the plow"). In the Driftless, flint points turned up by plows are Native artifacts. Treating them as fae weapons, curse components, or no-iron trade goods is the mystification `01` §2.1 principles 2 and 3 forbid. *Recommendation:* keep the European folk diagnosis "elf-shot" but drop the found-flint artifact (use a fae-made thorn or splinter instead). Replace `03`'s flint blade with an imported gunflint scraper, or cut it.
  2. `05` §5.3 "**Barrow-wights / old dead** — undisturbed graves; a plow opens a barrow" sits next to the "Indian burial ground" trope `01` excludes. Restate it as explicitly fae and fictional, as `05` M4 already does.
  3. `02` §4.1 **Lore (Old Peoples)** invites the "vanished mound-builders" myth. Rename it (e.g., Lore (History) or Lore (Nations)) and define it as ordinary human knowledge.
  4. `05` §7.2's history ("removals in 1830–1874") assumes `01`'s Option A. Under `01`'s recommended **Option C**, which `01` §8 already writes into the county map ("Ho-Chunk homeland borders it to the north"), there's a sovereign neighbor that `05` §7.2's faction table doesn't include.
- *Decision:* `01` Q1 (Option A/B/C/D and a consultation budget).

**C11. "Drift" means opposite things in `01` and `00`/`06`.** **[NEEDS DECISION]** (flavor)
- `00` and `06` §3.8: **Drift** = 0–100 progress *toward* Faerie. `01` §4.1: "**the Drift**" = the Ice as a "cold sovereign that makes the world flat, known, and sorted" (*anti*-fae), "settlers are the Drift by other means", and **Drift-wights** lower Fae intensity.
- *Recommendation:* `00`'s usage is canon, so rename `01`'s concept (e.g., "the Ice", "the Till", "the Sorting"), and rename Drift-wights to something like "erratics" or "till-wights". `00` P7's hook ("the Ice is the land's Superego") already calls it "the Ice".

**C12. Do grudges decay? Lore says no, mechanics say yes.** **[NEEDS DECISION]**
- `01` §4.4 bases the Prince's whole strategy on "**Grudges don't decay**… the only human memories that don't fade". `04` §6.3 decays grudge intensity with τ = 60 d × (1 + Rancor), and `04` §9.5 lists Time as a defusal lever. `06` §8.1 offers a "Social memory" slider for how long grudges last.
- *Options:* (a) grudges founded on uncanny or fae events get no decay (or a high floor), which makes the Prince's thesis literally true and extends Woe; (b) keep `04`'s math and soften `01` to "grudges outlast every other memory". I'd pick (a), because it turns lore into mechanism.

**C13. Witch trials vs. "no crime of witchcraft".** **[NEEDS DECISION]**
- `01` §5.4: there's no witchcraft statute, so persecution is extralegal. But `04` §9.2 rung 6 includes "**Trial** (JP court, church trial)" and §9.3 gives the sheriff `Arrest`. `05` S6 says a scapegoat is "tried, hanged, or swum", court day means "a hanging is possible", and §8.9 says "the Chronicle remembers who hanged".
- *Recommendation:* if Ellie keeps `01`'s no-statute rule (`01` Q6), legal rungs only process **mundane** charges (poisoning a well, arson, slander suits), church trials are ecclesiastical discipline, and `05`'s "hanged" becomes lynching or mob action. `04` rung 6 already covers mobs.

**C14. "Fae may not directly harm humans" vs. fae that take and harm humans.** **[NEEDS DECISION]** (owner: `01`)
- `01` §4.4 justifies the witch by saying "the Fair Folk may not *directly* harm humans who haven't trespassed or bargained". Yet `01` §4.3/§7 has the Alder Court "predatory toward the young" and an ambush-predator nøkk. `05` F1 and F5 have the Wild Hunt and ring dances taking travelers, and F9 has elf-shot cattle "from fae grievance". `06` curse #28 has the Prince doing changeling swaps.
- *Resolution:* scope the rule. Either it binds only the Prince's Court (the courts differ), or "trespass" is broad (night roads, rings, unbaptized infants), and the UI shows it per P1.

**C15. The Prince: a fixed character (`01`) vs. generated per World (`06`).** **[NEEDS DECISION]**
- `01` §4.4 defines a specific person: the sleeping sovereign's younger son, a sincere ecological zealot who keeps his word to the letter, is bored by cruelty, and prizes harm that becomes a story. `06` §3.4 generates a temperament per World (Capricious/Cold/Jealous/Hungry/Melancholy), calls him "the true predator", and gives him agendas like "make the parson curse God".
- *Recommendation:* `01`'s core (motive, honesty, taste for story) stays fixed. `06`'s temperament is a *mood overlay*, minus "Hungry" and "Cold" sadism, which contradict `01`.

**C16. Courts and patrons.** **[NEEDS DECISION]** (minor)
- `03` §10.4's "**Thorn Court's ferryman**" mixes `01`'s names: "the Thorn" is the Prince's Court, and ferrymen belong to the River, which `01` says is "not a court". `06`'s "1–2 rival Courts as alternate patrons" fits `01`'s Hearth, Under, and Alder Courts.
- Fix the `03` line once `01`'s court names are approved.

**C17. Magic traditions: `01` and `02` describe different wizards and different Fae-intensity interactions.** **[NEEDS DECISION]**
- `01` §5.3 has three traditions:
  - Congregational clerics: power scales with flock size and opinion; settled pastors like Rev. Tveit.
  - Lyceum wizards: "measuring and naming"; surveyors and natural philosophers; strongest at low FI; their Detect *lowers* FI.
  - Folk magic: strongest at *high* FI.
  
  It also puts mesmerists, spiritualists, and patent-medicine showmen in the lyceum tradition.
- `02` §10 has four:
  - **Almanacker:** astrology/conjunction timing, with no FI curve.
  - **Circuit Rider:** an itinerant preacher whose only congregation link is "active stops" and Faith standing.
  - **Folk charms:** no FI scaling.
  - **Fae:** spell points that scale with FI.
  
  It also puts the Mountebank (the patent-medicine man) in folk magic.
- *Recommendation:* `02` owns mechanics and `01` owns cultural framing. Adopt `01`'s FI curve in `02` §10.1 (arcane weakens as FI rises, folk strengthens). Fold the Almanacker's conjunctions into a broader "lyceum" identity. Settled clergy need a path (a Circuit Rider variant or a Pastor class). This ties to `01` Q5 and `02` Q7.

**C18. Time slippage severity.** **[NEEDS DECISION]**
- `01` §4.5–4.6: subjective time runs slow. FI 3 is ×1.5–2, FI 4 is ×3–7, FI 5 is "severe". The ratio should be capped and always shown, and reverse slippage should be "very rare". `05` §1.4: a 1-hour fae-path walk at FI 4 costs **1d6 days** (×24–144), time can go *negative* at FI 5, F1 can return you after "days, months, or years", and `05` Q11 proposes a 1d6-month cap outside Samhain.
- These differ by an order of magnitude. `01` owns the rule and `05` owns the fae-path numbers.

**C19. Fae calendar names and Tithe cadence.** **[NEEDS DECISION]** (minor)
- `05` §4.5 uses the Celtic wheel (Imbolc, Beltane, Lammas, Samhain) but says `01` owns the names. `01` uses the settlers' festivals (Sankthans/Midsummer, Walpurgisnacht, All Hallows, Yule).
- `05` makes Lammas "harvest tithes owed to the Court (witch mode: Prince's demand cadence)", while `06` §3.6 collects the **Tithe at each full moon**.
- *Recommendation:* the Tithe is monthly (`06`), and Lammas is a special harvest Behest. `05` should use `01`'s festival names.

### C. Rules, characters, and items

**C20. Skill vocabulary.** **[FIXED]** in `03`, `04`, `05`, `06`, and `07` (see §1). Remaining **[NEEDS DECISION]**:
- **Gather Information** is central to `04` (the "Ask around" interaction, the rumor ledger, spread bands, settlement mood) and to `05` traces, but it has **no `02` skill**. Options: (a) add it as a CHA skill to `02`; (b) map it to Persuade plus Lore (Local); (c) treat it as an `04` interaction resolved with Read People. I recommend (a), since investigation is a core verb (`04` §2, "Bad News").
- `05` §1.6's "Cartography/Craft skill" doesn't exist. It could become Trade (Cartography) or Lore (Local).

**C21. Time resolution: sub-second actions, tick size, and 1× speed.** **[NEEDS DECISION]** (partly settled by the ADR)
- `02` §7 needs sub-second timing: swift actions take 0.5 s, first-action delay is (30 − Initiative) × 0.1 s, and a 3 s attack splits into windup and recovery. `00` says "sub-second game ticks".
- Three docs set the clock differently:
  - **`07` §3.3:** `Tick = 1 game-second`.
  - **`05` §3.3 and §4.1:** a 1-second T0 tick, and 1× = 1 game-minute per real second (1 game-hour = 60 real s).
  - **The ADR:** canonical time is integer game-minutes since 1855-04-01. T0 "sub-steps within a minute for movement and animation", and 1× ≈ 40 real s per game-hour.
- At either of those 1× speeds, a 3 s attack lasts well under 0.1 real seconds, so `02`'s tactical combat can't be followed.
- *Settled:* the canonical clock (the ADR wins over `05` and `07`).
- *Remaining:* (a) how T0 schedules sub-minute timed actions, e.g. a millisecond offset within the current minute; (b) whether combat auto-drops to a tactical speed of about 1 game-second per real second. `05` should adopt the ADR's 1× number. This blocks M6.

**C22. Encumbrance: three band schemes and circular ownership.** **[NEEDS DECISION]**
- `02` §11 uses 3.5 bands (Light/Medium/Heavy; −3/−6 check penalties; max DEX; speed −10) and says the carry table is "3.5 numbers, 03". `03` §4.1 says carrying capacity comes "from Strength… defined in 02" (placeholder 100 lb) and defines five continuous bands by load/C (Unburdened ≤25%, Light ≤40%, Medium ≤66%, Heavy ≤100%, Staggering ≤150%) with different penalties. `05` §1.4 uses "heavy load (>⅓ capacity, per 03)", a third scheme.
- *Recommendation:* `02` owns C(STR) (the 3.5 heavy-load column), `03` owns the bands and penalties (its continuous model is richer and fits P1's "plain words"), and `05` reads `03`'s bands. Needed by M4.

**C23. Warmth and insulation units.** **[NEEDS DECISION]**
- `03` §6.6 gives `insulate` points (wool shirt 1, mackinaw 4, buffalo robe 5; Readiness needs "insulation ≥ 9" for January) and says "layer rules live in 05". `05` §6.3 measures insulation in **°F of comfort-band extension** (wool shirt 6, buffalo robe 25) and says "03 supplies the numbers". `02` §8.6 reads "temperature bands (05) vs. clothing insulation (03)" as exposure steps.
- Wet retention also differs: `03` keeps wool at ~70%, `05` at 50%.
- *Recommendation:* use `05`'s °F model (it's physical and legible), have `03` publish its values in °F, and agree on one wool number.

**C24. Hunger and fatigue stages are defined twice.** **[NEEDS DECISION]**
- `02` §11 is time-based: Hungry after 1 day halves Vigor recovery; Starving after 3+ days means CON DC 10 (+1/day) or 1d6 nonlethal damage, plus −1 STR per week; Fatigued after 18 h awake; Exhausted after 24 h. `05` §6.1/§6.4 uses 0–100 meters with kcal (Peckish <60; Hungry <30 at −1 to physical checks; Starving <10 with a Con check or ability damage; fatigue +6/h; Con checks after 40 h awake).
- *Recommendation:* `05` owns burn rates and thresholds, and `02` owns what each stage *does*. Delete the duplicated effects from `05` and map its thresholds onto `02`'s conditions. `00` P8 now requires calorie- and nutrition-based food (C48), so `02`'s "1 day without food = Hungry" can't stay the model. The ADR's integer needs (0–1000) also replace `05`'s 0–100 meters.

**C25. Disease tables are defined twice.** **[NEEDS DECISION]**
- `02` §8.7 (6 diseases with Fort DCs and effects) vs. `05` §6.5 (10 diseases with incubation and fatality). They disagree on details, e.g. cholera incubates in 1 day vs. 0.5–5 days.
- *Recommendation:* `02` owns per-victim mechanics (DC, stages, effects), and `05` owns epidemiology (vectors, seasons, SEIR, fatality targets for calibration). Merge into one data table.

**C26. Eating fae food has four partial specs.** **[NEEDS DECISION]**
- `01` §4.5: the condition **Bound**, with escalating effects. `02` §8.7: **Fae-Sickness/Wasting** (1 WIS + "longing", an `04` need). `02` §11: the **Fae longing** need, which `04` doesn't define. `05` §6.1/§6.5: mortal food satisfies at 50% for 1d6 weeks, with a wasting risk. `06` §3.8: +Drift.
- *Recommendation:* `02` owns one condition chain (Bound → Longing → Wasting), `05` supplies the nutrition effect, `06` the Drift gain, and `04` the need.

**C27. Witch weaknesses (iron, holy ground, bells, salt, running water) come from four sources with incompatible triggers.** **[NEEDS DECISION]**
- `01` §4.5: running water stops "witches, per old belief"; "[OPEN] does the witch suffer from iron?"
- `02` §6.3: the Witch class gets **Unhallowed at level 1** (consecrated ground, bells, salt lines: −2, and no casting without Will DC 15). It has *no* iron sensitivity; that's the Fae-Touched class's *Iron-Sick*.
- `03` §3.3 proposes the witch is iron-sensitive above IP 5 and can't wield iron weapons without a Will save.
- `06` §3.8 ties weaknesses to **Drift thresholds** (Drift 40: iron −2, salt stings, bells give headaches; Drift 60: no running water, no consecrated ground). Yet `06`'s own curses use iron (#4 drives an iron nail; "a nail from a coffin"), and a Geas can independently forbid running water.
- *Recommendation:* tie every fae weakness to **Drift** (`06`), which makes it a general system per P4 that adventurers share. Witches start with Drift above 0 by Origin. `02`'s Unhallowed becomes Drift-scaled, and `03`'s IP thresholds become the Drift-scaled penalty curve. Iron components stay usable with discomfort. This is one of the top five decisions.

**C28. What "cold iron" means.** **[NEEDS DECISION]**
- `01` treats iron generically. `02` uses "cold iron" in *Salt and Iron* and *Iron-Sick* with no definition. `03` §3.3 defines cold iron as a premium tier (cold-hammered, never quenched, ×3 effect). See `03` Q3.

**C29. Curse resolution math is defined twice.** **[NEEDS DECISION]**
- `02` §10.6: Rite DC = 10 + rite rank + **witch CHA** + link quality (−4..+4). Protections: horseshoe +1, witch bottle +4, church member in good standing +2, Iron Nail Ward blocks entirely.
- `06` §3.5: DC = 10 + **witch level** + link bonus (+0..+6) + timing + Gifts. Protections: horseshoe +2 (household), hex sign +2 (livestock), Bible +2 (vs. hag-riding), iron nails in the threshold (crossing links fail), witch bottle reflects with backlash.
- `07` §3.8's sample curse has `cost = { favor = 1 }`, a currency nobody uses.
- `02`'s "effect primitives" and `06`'s "Malady" are the same idea under two names.
- *Recommendation:* `06` owns the curse catalog, links, protections, and economy. `02` owns the DC formula (pick level-based or CHA-based, not both). Keep one protection table, with the items in `03`'s catalog. Change `07`'s sample to a Woe yield.

**C30. The witch has two parallel power systems, and it's unclear whether curses grant XP.** **[NEEDS DECISION]**
- `02` §6.3/§10.4: the Witch class has fae spontaneous spells on spell points; *Power from Woe* substitutes for slots, boosts DCs, and fuels rites; the Hag prestige class requires a "Woe threshold".
- `06` §3.6: Woe buys Gifts (Hedge/Craft/Changes), Favor, Workings, Mercies, and self-healing. It never mentions a spell list or slots.
- On XP, `02` §6.6 proposes curse XP and leaves the split to `06`. `06` says levels come "from XP as usual" and Gifts from Woe, but never says whether a curse is an XP source. See `02` Q12.

**C31. Backgrounds have no single owner.** **[NEEDS DECISION]** (structural, low)
- `02` §5.1 says "01/06 define backgrounds", but `01` doesn't. `03` §7.2 lists 9 backgrounds with purses and money forms. `06` §7.2 lists a different set (Yankee clerk, Cornish miner, discharged soldier, farm daughter, failed seminarian, river pilot), and `06` §7.3 adds witch "Former lives".
- *Recommendation:* one Background table owned by `06`, with columns contributed by `03` (purse, money form, possessions, heirloom) and `02` (upbringing feat list, skill pre-picks).

**C32. Name collisions in mechanics.**
- `06`'s creation screen "Calling" (= class) collided with `02`'s Callings (= prestige classes). **[FIXED]** (see §1).
- `05` §8.8 Director personality "**The Circuit Rider**" also names `02`'s cleric class and an `06` §6 mode. "**The Hidebehind**" personality is also an `01` creature. **[NEEDS DECISION]** (flavor; probably fine).

**C33. Ability generation methods.** **[FIXED]** `06` §7.1 now lists all three of `02`'s methods.

**C34. Prices vs. the $1/day wage.**
- `02` §14.1, `06` §9.1, and `07` §3.8 item prices: **[FIXED]** (now match `03`).
- **Charm prices:** **[NEEDS DECISION]**. `02` §10.3/§5.3 prices a charm at "ingredients $2–$5 × level", and *Charm-Maker* at "spell level × $5 + ingredients". A 1st-level charm therefore costs $7–$10, which is 7–10 days' wages. `03` §6.12's folk wards cost $0.03–$1.50 (witch bottle $0.40, Himmelsbrief $0.50). Either `02`'s charms are luxury goods, which contradicts `02` §10.3's claim that they give Cunning Folk an everyday economic role, or they should be about 10× cheaper. *Recommendation:* scale `02`'s costs down to roughly $0.25–$0.50 per spell level.

**C35. Reload times.** **[FIXED]** (`03` now matches `02`). The gap that remains is in §4: most of `03`'s arms have no `02` combat stats.

### D. Mind, social, and simulation architecture

**C36. Opinion model: `04` vs. `07` vs. `06`.** **[NEEDS DECISION]**
- `04` §6: five dimensions (Affection, Respect, Trust at −100..100; Fear at 0..100; **Obligation** as a ledger). Opinions change *only* through Reasons. Grudge is a separate first-class object.
- `07` §3.3: `Opinion { affection, respect, trust, fear: i8, familiarity, last_contact, grudge: Option<GrudgeId> }`. No Obligation, no Reasons, and the grudge is embedded. `07` M1 says "four-dimension opinions".
- `06` §3.4: the Prince's opinion of the witch uses *amusement, esteem, trust, desire*.
- *Recommendation:* `04` owns the model, and `07` (in its TS rewrite) copies `04`'s structure. Map the Prince onto `04` (amusement ≈ Affection, esteem ≈ Respect, trust = Trust), and treat *desire* either as a fae-specific dimension or through `04` Q5 (fae Value sets). This blocks M1.

**C37. Memory, Belief, and Rumor data model; T2 rumor granularity.** **[NEEDS DECISION]**
- `04` §4–5, §8: rich Memory records (roles, source, affect, emotion, salience, confidence, distortions, pinned); Beliefs over **interned propositions** with typed evidence and credence; Rumors as variant lineages, which the novelty discount needs; T2 diffusion over **compartments** (household ⊂ congregation/language ⊂ settlement).
- `07` §3.3/§6: `Memory { event, perceived, salience, formed }`; a BeliefStore of `(RumorId, confidence)`; Rumor as a `(subject, predicate, object)` claim with a parent; T2 as a per-**settlement** penetration fraction.
- `05` §3.2 calls it "a graph process between settlements".
- *Recommendation:* `04` owns the semantics, including compartments, and `07` implements them. This blocks M2.

**C38. The canonical need list.** **[NEEDS DECISION]**
- `04` §3.3 lists social needs: Company, Standing, Security, Faith/Ritual. `05` §6 lists physical needs.
- `02` §11 and §5.4 cite "Fae longing" and a "need for alcohol" as `04` needs, but `04` doesn't list them.
- `01` §4.2 promises fae needs (tribute, recognition, propriety, novelty) "in 04", but `04` leaves fae minds open (Q5).
- `07` M1 lists "hunger, rest, social, faith, work/duty".
- P7 (Id drives) may reframe the whole set.
- *Recommendation:* `04` (or `10`) publishes one need table covering human physical, human social, vice/longing, and fae needs. This blocks M1.

**C39. Two Event structs.** **[NEEDS DECISION]** (low; an implementer's merge)
- `05` §9.1's Event has `causes`, `effects`, `visibility`, `importance`, `director_nudge`, and an instrument role. `07` §3.4's has `explain`, `payload`, `salience`, and `tier`.
- `07` should own the struct and include `05`'s fields. Sifting and the Director's Ledger need `causes` and `director_nudge`.

**C40. LOD rules are specified three times.** **[NEEDS DECISION]** (low)
- *Tier rule:* `04` §11.4 uses max(geographic, relevance). `05` §3.1 uses travel ≤ 6 h or a relevance score. `07` §3.5 uses R1 travel-hours plus flags plus hysteresis.
- *Promotion:* `04` uses hash-based hydration. `05` §2.3 uses layered reconstruction plus a T1 backfill capped at 48 h. `07` uses pending deltas keyed on RNG.
- *T1 granularity:* `05` uses 1 game-hour steps with 1–8 h activities, `04` uses 4-hour blocks, and `07` uses an event queue.
- *Budgets:*

  | Tier | `04` | `05` | `07` |
  |---|---|---|---|
  | T0 | 20–40 actors | ≤150 actors | ≤150 actors |
  | T1 | 300–500 actors, <20 ms per day-step | 300–1,500 actors, ≤5 ms per game-hour | 300–500 actors, ≤1 ms per game-hour |
  | T2 | — | ≤50 ms per day | ≤20 ms per day for 5k actors |

- They're compatible in spirit. *Recommendation:* `05` owns the tier policy, `07` owns the mechanism and budgets (restated for TS and phones), and `04` owns social hydration.

**C41. The persecution ladder is specified three times.** **[NEEDS DECISION]** (one of the top five)
- `04` §9.1–9.2 (which declares that it owns the mechanism): a per-target **process** with rungs 0–6 (Unease, Whispers, Accusation, Shunning, Institutional, Hunt, Mob/Trial), driven by Heat and Consensus, plus a settlement **Misfortune pressure M** (0..1).
- `05` §7.1: a settlement **alert_level 0–5** (Normal, Talk, Watch, Posse, Militia/bounty, Panic) with HearthState fear and suspicion (0–100). S6 "Witch panic" fires at fear >70. `05` §7.1 says "In witch mode the ladder *is* the antagonist".
- `06` §3.9: witch **Notoriety tiers** (Unknown, Whispered, Suspected, Known, Hunted). `06` §1.4/§8.9 point at `05` §7.1's "ladder".
- `01` §5.6 describes the same pipeline in prose.
- *Recommendation:*
  - `04` owns persecution of any *person or figure*.
  - `05`'s alert_level covers only non-person threats (wolves, fire, epidemics), and S6 is defined as `04` rungs 5–6.
  - `06`'s tiers become the witch-facing *labels* for `04` rungs: Unknown = 0, Whispered = 1, Suspected = 2–3, Known = 4, Hunted = 5–6.
  - `04`'s M and `05`'s HearthState.fear merge into one value.
  
  M2's witch-hunt scenario needs this settled.

**C42. Notoriety tiers are used but never defined.** **[NEEDS DECISION]**
- `04` §8.6 defines Notoriety as a continuous 0..1 value per settlement. But `02` §5.3 *Hard Reputation* uses a "Notoriety tier" (+0 to +6) and a "Notoriety threshold" prerequisite, and `06` §2.3/§2.8 uses "Notoriety tier N" and "County Legend". `04` should publish a tier table.

**C43. How much power the Director has over rumors.** **[NEEDS DECISION]** (low)
- `04` §8.2 lets the Director "seed a plausible-but-false variant… through an in-world carrier". `05` §8.3 N4 (the owner) requires that "the speaker must know the fact", so content derives from memory, and §8.3 forbids editing memories. `07` §3.4 says the Director may "spawn a pressure".
- *Recommendation:* `05`'s stricter rule wins. Edit `04` and `07` to match after confirmation.

**C44. Chronicle ownership, and showing the truth during play.** **[NEEDS DECISION]**
- `05` §11 claims ownership: four voices, PC-knowledge-only during the run, an omniscient epilogue after it. `04` §12.5 agrees, and `04` Q9 asks whether the reveal is a spoiler.
- `06` §1.2 calls the "**side-by-side view of rumor and truth**" the signature feature and says the Chronicle can be read *at any time during play*. Showing the truth during play contradicts `00` P1 ("the full truth comes out in the post-run Chronicle epilogue").
- *Recommendation:* `05` owns the Chronicle. `06`'s side-by-side view appears only in the post-run epilogue. During play, the Chronicle shows what the PC knows.

**C45. Which fae currency?** **[NEEDS DECISION]**
- `06`: **Woe** (Suffering × Belief × Attribution) with a Tithe. `05` §5.3 and Q5: fae populations need "**glamour**/belief/offerings", and "Curses produce" it ("one currency"). `01` §4.2: rumors, notoriety, and grudges about fae phenomena are "literally fae power", expressed through **Fae intensity**.
- *Recommendation:* Woe is the single fungible currency (`06`, as the `00` vocabulary implies). Fae intensity stays the spatial field (`00`/`01`). `05`'s fae "glamour" need is satisfied by Woe and offerings.

**C46. The Outfitter's identity.** Partly **[FIXED]**.
- `03` now uses `01`'s Gussie Pratt (Pratt & Daughter). `06` §9.1's "Halvorsen's" stays as the example of a *generated* World (see C8).

**C47. Alternate identities have four overlapping mechanisms.** **[NEEDS DECISION]**
- `02` §6.3 Mountebank *A Face in Every Town* (Aliases; rumors don't cross over). `06` §3.9 **cover identity** ("a separate social identity in 04 with its own opinions"). `04` §5.1 **Figure** with `IsFigure` identity beliefs. Now `00`'s **Jungian Persona** and shadow-faekin **passing** join them.
- *Recommendation:* one identity model in `04`: an actor presents N public identities, and each is a Figure with `IsFigure` credence held by others. Aliases, covers, and passing are all instances of it. `10` defines the Jungian Persona as the *psychological* side of the same thing.

**C48. `00` P8 ("crunch you can pack") vs. the existing food and consumables models.** **[NEEDS DECISION]**
- *Where:* `00` P8 says each foodstuff has weight, bulk, calories, a nutrition profile (calories, protein/fat, a "fresh" factor against scurvy and monotony), shelf life and **spoilage** (driven by temperature, wetness, packaging), and **preparation requirements**. Consumables must run out on a plannable schedule, packaging is gear, and NPC households have pantries.
- *Gaps against that:*
  - **`03` §3.1:** the item schema has no `kcal`, nutrition, shelf-life, or preparation fields; there's only a `perishable` tag. Yet `05` §6.1 says "food items carry kcal and spoilage (03)".
  - **`03` §6.4:** food uses coarse tags ("food (~25 days bread)") and lacks items P8 names (parched corn, tinned oysters, fresh trout, morels).
  - **`02` §11:** hunger is day-count based.
  - **No doc:** scurvy, "monotony" (a mood effect), or cooking actions.
  - **`03` §8.2 and `05` §7.1:** settlement stock is "~25 commodity classes" at T2, but P8 wants household pantries.
- *Recommendation:* `03` owns the food and consumable item fields. `05` owns burn rates, spoilage physics (temperature and wetness), and pantries at T1/T2. `02` owns the deficiency conditions (add scurvy). `04` or `10` owns monotony as a mood or Id thought. `03`'s Readiness panel gains "days of food at current rations / what spoils first".

**C49. ADR numeric invariants vs. the formulas in `04` and `05`.** **[NEEDS DECISION]**
- *Where:* the ADR bans transcendental Math in core (`exp`, `log`, `pow`, `sin`…) for cross-engine determinism, and mandates integer stored state (needs 0–1000, opinions −100..100, credence 0–100, time in game-minutes).
- *Formulas that conflict:*
  - `04` §4.3: salience decay `s₀·exp(−Δt/τ)`.
  - `04` §5.3: credence updates in **log-odds**.
  - `04` §8.3: `sigmoid` for telling a rumor.
  - `04`: credence, salience, and juiciness as 0..1 floats.
  - `05` §5.1: logistic ecology growth.
  - `05` §6: 0–100 need meters.
  - `07` §3.6 (the floats discussion).
- *Recommendation:* keep `04`'s and `05`'s models but specify integer or lookup-table implementations: a precomputed decay table per τ, an integer logit table for credence, and a piecewise-linear sigmoid. Store values at the ADR's integer scales. This belongs in the `07` rewrite. Needed before M1/M2.

---

## 3. Ownership map

| Mechanism | Authoritative doc | Contributors / readers |
|---|---|---|
| Pillars, vocabulary, start date (spring 1855), FI scale, LOD tiers, peoples roster, P8 supply crunch | `00` | all |
| Stack, platform targets, determinism and numeric invariants, canonical clock, psyche-lite (M1) | `adr/0001` | `07` (rewrite), `10`, `11` |
| Geography, history, Hollin County, starter cast and names | `01` | `05` (raster/skeleton), all worked examples |
| Native nations handling, sensitivity rules | `01` §2 | `03` §9, `05` §7.2, `06` Q13 |
| Fae rules (iron, thresholds, bargains, running water), courts, the Prince's character, bestiary | `01` §4, §7 | `02` (stats), `05` (populations), `06` (Prince as patron) |
| Fae intensity: meaning of each level, raise/lower causes | `01` §4.6 | `05` (raster storage, calendar modifiers), `02` (DC modifiers) |
| Peoples (humans, elves, shadow-faekin, goblins) | `12` (pending) | `02` §12 schema, `04` group opinions |
| Psyche (Id/Ego/Superego, defenses, Persona/Shadow, dreams) | `10` (pending) | `04` Mind, `02` Will/morale |
| Interfaces, pocket vs. desktop, platform packaging | `11` (pending) | `03` catalog UI, `04` §12 UX, `06` §7 creation |
| Abilities, skills, feats, classes, Callings, XP | `02` | `06` (witch progression inputs) |
| Checks, DCs, conditions, combat, wounds, morale | `02` | `05` (hooks), `07` (Explain traces) |
| Combat stats, including reload | `02` §9.5 | `03` (prices, handling tags) |
| Carrying capacity C(STR) | `02` | `03` |
| Encumbrance bands and penalties | `03` §4 (recommended, C22) | `02`, `05` |
| Magic engines and spell catalog | `02` §10 | `01` (tradition framing) |
| Items, prices, catalog, Outfitter UX, money, credit, fae exchange, provenance; food and consumable item fields (P8) | `03` | `05` (quantities, spoilage, pantries), `06` (witch channels) |
| Settlement economy | split: `05` quantities, `03` prices | `07` |
| Clothing insulation values | `03`, in `05`'s °F units (recommended, C23) | `02` exposure |
| Mind (beliefs, memory, opinion, grudge, rumor, figures, notoriety) | `04` | `10`, `07` |
| Persecution ladder (any person or figure) | `04` §9 | `05` (alert for non-person threats), `06` (witch-facing labels) |
| Social needs | `04` (or `10`) | `02` (vices, longing), `07` |
| Physical needs: burn rates and thresholds | `05` §6 | `02` (stage effects) |
| Disease | `02` per-victim, `05` epidemiology | — |
| Region map, site maps, LOD policy, weather, ecology, calendar, time scale | `05` | `07` (mechanism) |
| Factions and faction clocks | `05` §7.2 | `01` (names), `06` (Prince's agendas) |
| Director, nudges, Director's Ledger, story sifting, incidents | `05` §8–10 | `04`, `06` (pressure vocabulary) |
| Chronicle (voices, knowledge basis, epilogue, legacy payload) | `05` §11 | `04` (belief data), `06` (ledger contents), `07` (prose adapter) |
| Modes, Ambitions, Origins, Pact, Curse catalog, Woe and Tithe, Drift, endings, creation flow, difficulty, save modes | `06` | `02` (DC math), `03` (protections), `04` |
| Backgrounds | `06` (recommended, C31) | `02` (upbringing feats), `03` (purses) |
| Curse DC formula | `02` (recommended, C29) | `06` |
| Data model, event-log struct, determinism, saves, content pipeline, harness, milestones, perf budgets, LLM adapter | `07` (being rewritten for TS) | `04` §14 (LLM layers), `05` §9.1 (event fields) |

---

## 4. Notable gaps (nobody covers these)

1. **An investigation skill.** Gather Information is used throughout `04` and `05` but has no `02` skill (C20).
2. **Weapon and armor stats.** `02` §9.5 statts six firearms. Nothing statts `03`'s melee weapons (Bowie, saber, sword-cane), bows, crossbow, squirrel rifle, plains rifle, double shotgun, or pepperbox. `03` §6.8's armor has no Defense values, and `02` §9.2's armor examples (buffalo-hide coat, breastplate) aren't in `03`'s catalog.
3. **Notoriety tier table** (C42).
4. **Fae minds:** needs, Values, and how "cannot lie" works in the Belief model. `01` promises them in `04`, and `04` Q5 leaves them open.
5. **A Native polity faction** under Option C: its interests, institutions, and diplomacy. `01` §2.2 implies one, but `05` §7.2's faction table doesn't have it.
6. **Building, construction, and farming.** No doc specs structures, building actions, roofs and repair, crops at T0, or harvest labor, even though `00` lists "harvest cycles", `06` relies on homestead/hut sites and a Homesteader mode, and `05` §7.1 has production recipes.
7. **Lifecycle:** births, aging, marriage, inheritance, NPC death, and how a household is succeeded. These are scattered across `04` (courtship), `05` (growth rates), `03` (debts to heirs), and `06` (estates, "Choose a soul").
8. **Law procedure:** JP hearings, fines, slander suits, the circuit court, jail ("pay a farmer to hold prisoners"). `01` §5.4 and `04` §9.3 only sketch it.
9. **Companion and hireling AI:** stances, contracts, desertion, and pay. `06` §2.6 is a sketch.
10. **Rivers and boats at T0:** skiffs, canoes, rafts, steamboat decks, and ferries as site maps or vehicles. `02` Riverwork, `03` §6.14, and `05` §1.4 travel speeds each touch it.
11. **Language and literacy in play.** `02` §4.1 has the rules and `04` §8.4 the partitions, but there's no UX for overheard foreign-language gossip, letters, or newspapers in German or Norwegian.
12. **Art direction and audio** beyond `03`'s engraving shader. `00` now says Blender for placeholders, but there's no style guide, palette, readability rules for P6, or music and sound plan (the `01` §9.3 touchstones aside).
13. **Pocket UI for every screen** (`11` pending; C2).
14. **Psyche integration** (`10` pending; C3).
15. **Peoples lore** (`12` pending; C5).
16. **The sleeping sovereign and Court politics as a simulation:** Court-vs-Court schemes and what happens if the sovereign wakes. `01` §4.3 and `05` §7.2 cover it only as lore and generic clocks.
17. **Tutorial and onboarding** beyond `06` §9's "first 30 minutes" scripts.
18. **TS-specific modding and scripting** (`07` §3.8's Rhai/mlua fallback no longer applies).
19. **Food, nutrition, cooking, and spoilage** at the level P8 demands (C48): cooking actions, scurvy, monotony, pantries, smokehouses, and root cellars as structures.
