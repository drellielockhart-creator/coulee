# Coulee — Social Simulation

**Status:** Draft v0.2 (revised 2026-10-10). **Owns:** Memory, Belief (props, evidence, credence, attribution, Commons), Opinion and Reasons, Relationships and Households, Rumor, Grudge and Feud, **Figure** and the identity model's social side, Notoriety/Reputation (including the tier table), Secrets, social Goals, the **persecution ladder (rungs 0–6, canonical for any person or Figure)**, social hydration across LOD tiers, and the *knowledge semantics* of social UX (what the PC can know, and how it's gated). **Does not own:** drives, conscience, Ego arbitration, mood, anxiety, defenses, Persona, Shadow, archetypes, dreams, or the need registry (`10`); screen layouts (`11`); peoples lore and tells (`12`); tier policy (`05`); integer-math machinery and budgets (`07`).
**Depends on:** `00-vision-and-pillars.md` (canonical), `adr/0001-typescript-stack.md` (stack, determinism, integer scales, clock), `10-psyche.md`, `12-peoples.md`. **Referenced by:** `05` (LOD scheduler, Director, alert levels for non-person threats), `06` (witch mode reads the ladder through its labels; adventurer mode uses notoriety), `07` (data layout, integer forms), `10` (defenses write into 04's stores), `11` (dossier, rumor ledger, notoriety display), `12` (concealment and discovery run on 04's beliefs), `02` (skills and saves used by social checks; Notoriety tiers), `03` (debts, prices under shunning, pantries as household inventories).

Tags: **[DECISION]** follows from `00`, the ADR, or Ellie. **[PROPOSAL]** is my recommendation. **[OPEN]** needs Ellie.

> **Revision 2026-10-10.** What changed, and why:
> - **Mind split (C3, C36, C38).** §3 now keeps only the social and epistemic stores. Drives, Id/Superego/Ego, mood, anxiety, defenses, Persona, and Shadow defer to `10`. The nine Values become `10`'s superego norms and drive weights, read here through **derived views**. Superstition and Rancor stay `04` dispositions, and Discretion derives from Persona control. Alignment is gone (P7).
> - **Defenses in the pipeline.** Projection and displacement are explicit terms in attribution (§5.4), and §9.6 traces how each defense feeds suspicion, Heat, Catalysts, Consensus, and the ladder.
> - **Persecution ladder is canonical here (C41).** §9.2 is the single definition of rungs 0–6. §9.7 gives the mapping hooks: `06`'s witch-facing labels, `05`'s alert levels (non-person threats only), `05`'s HearthState fear/suspicion as read-only views, and the merged M/A_S scaling. Legal rungs follow `01`'s no-statute rule (C13).
> - **Identity and concealment (C47, `12`).** New §5.7 (one identity model: Persona ↔ Figure; concealed kind as a Secret plus `presentsAs`) and §5.8 (beliefs about who is faekin, tells, ordeals, discovery, false accusation). New worked story §15.5.
> - **Integer forms (C49).** Every exp/log/sigmoid is restated as integer or lookup-table math, using `07` §4's kit, with approximation notes. Summary in §13.5. Credence is 0–100, salience and juiciness 0–1000, notoriety 0–1000.
> - **Clock (C21).** T0 social timing runs on the sub-minute game-second clock; T1 resolves on hourly steps; T2 rumor runs on 6-hour sub-steps.
> - **Persona → Figure throughout.** "Persona" now means only the Jungian mask (`10`).
> - **Other 09 items:** Notoriety tier table (C42), Director rumor powers per `05` (C43), Chronicle truth only post-run (C44), grudge decay options with a data flag (C12), the Prince's opinion mapped onto 04's dimensions (C36), pantries as household inventories (C48), social hydration vs. `05`/`07` (C40), budgets restated for TS, phones, and `11`'s World sizes (C2, C9), UX cross-referenced to `11`, worked examples marked illustrative and Rev. Whitcomb renamed Rev. Ashby (C7).
> - **New §18 Implementation notes** list where today's code diverges from this doc.

---

## 1. Thesis

RimWorld's social sim is a sum of feelings. Coulee's should be a **sum of feelings about things people believe happened**.

The distinctive move is to put an **epistemic layer** between events and attitudes:

```
 Ground-truth Event ──perceive──▶ Memory (episodic, per actor, distortable)
                                     │ supports
                                     ▼
 Rumor ◀──speak── Belief (propositional, credence, evidence) ◀──hear── Rumor
                                     │ justifies
                                     ▼
                     Opinion (multi-dim, with Reasons) ──▶ Grudge ──▶ Goals ──▶ urges ──▶ Ego (10) ──▶ Actions ──▶ new Events
                                     │ aggregates (per settlement)                    ▲
                                     ▼                                                │
                     Notoriety / Reputation / Heat ──▶ Persecution process      anxiety ─▶ defenses (10)
                                                                                      │ write back into
                                                                                      ▼ Belief, Opinion, attribution, Heat
```

**[DECISION, lead call]** Since the 2026-10-10 revision, this doc is the *epistemic and social* layer: what people remember, believe, feel toward each other, say, and do together. The *motivational* layer (drives, conscience, arbitration, anxiety, defenses) is `10-psyche.md`. The two meet at well-defined seams (§3.6): `10`'s defenses end in 04 stores, and 04's memories, opinions, and grudges generate `10`'s thoughts.

Three properties follow, and they are the whole design:

1. **Reasons propagate.** Opinions are always derived from beliefs and memories, so the game can answer "why does she hate me?" with a chain the player can contest: "Because she believes you soured her cows. She believes it because Mrs. Pfaff told her at the quilting bee, and Mrs. Pfaff got it from the Brandt boy, who saw you on the bluff road that night."
2. **Nobody reads ground truth.** Every NPC decision reads that NPC's beliefs. Wrong suspects, framings, false credit, and mob logic fall out for free; nothing needs scripting.
3. **The same pipeline runs at every LOD tier.** Tiers change *sampling resolution* (individual conversations, rolled encounters, compartment diffusion), not the data model. That is what makes promotion coherent.

**[DECISION]** Per P2, the PC has a full Mind like any NPC. The PC's Belief store is also **the player's information boundary**: UX shows what the PC believes, never ground truth (except in an explicit debug/"God view" mode). `00` P1 now states this outright ("only the math your character could know"). `11` owns how it's laid out on Pocket, Folio, and Desk (§12).

---

## 2. Prior art: what to steal

| System | What it does | Where it's shallow (for us) | Steal |
|---|---|---|---|
| **RimWorld** | Opinion = Σ social thoughts (memory thoughts with opinion offsets and decay, plus situational thoughts such as "annoying voice" or "pretty"). Interactions (chitchat, deep talk, slight, insult, romance attempt) roll per pawn pair in proximity. Insults → social fights. Mood = Σ mood thoughts with stack limits and decay. Relationships are typed (family, lover, spouse, rival-by-opinion). | World pawns off-map are frozen or near-inert. No information model: B never learns that A insulted C. Thoughts don't carry *propositions*, so they can't be retold, doubted, or refuted. Single-axis opinion. Opinion reasons are visible, which deserves credit, but they are flat and terminal. | Opinion-as-sum-of-labeled-modifiers with per-modifier decay. Stack caps. Interaction labels as speech bubbles. Social fights as a mechanical outlet of Temper. |
| **Dwarf Fortress** | Historical figures persist through worldgen. Legends mode is a queryable event log. ~50 personality facets plus cultural values, with value conflicts driving stress. Adventure-mode rumors and reputation travel. Intrigue (schemes, plots, assets) arrived in 0.47. | Huge raw log, weak curation. Rumor content is coarse. Relationships are mostly static labels. | Persistent event log as source of truth for the Chronicle. **Values** (not alignment) as personality; in Coulee these are now `10`'s internalized norms (§3.1). Facts flow along ties. Worldgen as deep history (05 owns this; we seed the feuds it produces). |
| **Crusader Kings II/III** | Traits with opinion compatibility. Stress. Opinion modifiers with tooltips and expiry. **Secrets** with known-by sets. **Hooks** (weak/strong leverage) from secrets and favors. Schemes as long-running hidden progress bars. **Dread** as a fear axis separate from like. | Abstracted: no space, no conversations, and knowledge mostly binary (secret known or not). | Secrets as true facts with a `known_by` set and an exposure cost. Hooks as Obligation/leverage. Schemes as goal processes with discovery rolls. Dread → our Fear dimension. Tooltips everywhere. |
| **Comme il Faut / Prom Week** (McCoy, Treanor, Samuel, Mateas, Wardrip-Fruin) | Social exchanges (intent + preconditions + influence rules + outcome effects). A **Social Facts Database** of past exchanges that rules can query ("has X ever embarrassed Y?"). Volition = sum of weighted influence rules. Multiple networks (buddy, romance, cool). | Small cast, turn-based, no space or time pressure. | Interaction catalog as data: `intent / preconditions / volition rules / effects`. Rules that query **history**, not just current numbers. Separate relationship networks (our opinion dimensions). |
| **Versu** (Evans & Short) | Social **practices** (a dinner party, a conversation, a feud) run concurrently and offer role-specific affordances. Agents choose by evaluating desires. Norms make violations meaningful. Exclusion logic (Praxis). | Authoring-heavy, and limited to drawing-room scale. | **Gatherings as practices**: a quilting bee, church service, husking bee, or tavern evening offers roles, norms, and affordances. Breaking a norm (gossiping in church, refusing to bring a dish) is itself an event that generates memories. |
| **Façade** | A beat-based drama manager. Hidden "affinity games." NL input. | It doesn't scale, and the NLU is brittle. | A cautionary tale for free-text input (see §14). The idea that social pressure *on the player* can be the game. |
| **The Sims** (esp. Sims 2) | Motives/needs. Smart objects advertising affordances. Daily vs. lifetime relationship scores. Memories. Wants/Fears. | Off-lot Sims frozen. No knowledge model. | Venues that **advertise** social affordances to T1 scheduling. Two-timescale opinion (volatile vs. settled). Wants/Fears → our short Intents. |
| **Oblivion Radiant AI** | Schedule packages. Goal-driven NPCs. Infamous pre-release absurdity: NPCs murdered to satisfy item goals, then got nerfed. | Shipped version is mostly schedules. | Activity packages for T1. **The lesson:** unconstrained goal pursuit plus a cheap hostile action yields nonsense. Our hostile actions are gated by norms, Fear, and the escalation ladder. |
| **Shadow of Mordor nemesis** | Enemies remember encounters, gain scars and traits, taunt with references to history, and are promoted in a hierarchy. | Only player-centric, so there are no NPC-NPC memories. | Recurring antagonists whose barks cite **specific shared memories**. In witch mode, the witch-finder who survived her curse comes back scarred, with a grudge that has a founding memory. |
| **Wildermyth** | Authored story fragments that **cast** existing heroes by trait and relationship queries. Relationships grow out of events. Legacy heroes carry across campaigns. | Story is authored, and the sim underneath is thin. | **Storylet casting** as a presentation layer: when the sim produces a pattern ("two actors with mutual Affection > 60 and a feud between households"), surface it with an authored frame. It doesn't drive outcomes. |
| **Caves of Qud** | Procedurally generated histories (sultans) rationalized after the fact into gospels. Faction reputation. The **water ritual** trades secrets as currency. | Faction-level rather than person-level. | **Secrets as currency** (tell a secret to gain Trust or Obligation). Post-hoc rationalization: generate the event first, then the story people tell about it. That is exactly what our distortion does. |
| **Ultima Ratio Regum** (Mark Johnson) | Deep procedural cultures, religions, and ideologies. Signs and artifacts carry meaning the player must interpret. | Not a social-relationship sim. | **Interpretive frameworks**: a superstitious German Catholic, a skeptical Yankee doctor, and a Norwegian Lutheran read the same sign (a dead calf, a ring of toadstools) differently. In our terms, Superstition and culture shape attribution priors. |
| **Talk of the Town** (Ryan, Summerville, Mateas, Wardrip-Fruin) | Each character holds **mental models** of others, facet by facet (hair color, workplace, home). Knowledge is typed by **evidence**: observation, reflection, eavesdropping, statement, lie, transference, confabulation, mutation, forgetting, implant, declaration. Belief strength accumulates over evidence, and facts degrade and confabulate. | Facts are mostly mundane identity facets, with little about *events* or blame. | **Nearly everything.** Our Belief model is Talk of the Town's evidence typology extended to event propositions (who did what), with credence, attribution, and persecution on top. Knowing people by **descriptor** ("the woman from the bluff with the red shawl") rather than by name. |
| **Ryan: curationism, Bad News** | Simulation produces a vast, mostly dull storyworld, and narrative is a **curation** problem (story sifting). Bad News: a player investigates a generated town to deliver a death notification. The sim's depth is felt through *investigation*. Kreminski's Felt and Winnow formalize sifting patterns. | n/a | The **Chronicle** and **Director** are sifters over the event log plus the belief layer. The player *experiences* off-screen depth by **investigating** it (asking around, Gather Information, Read People), not by being shown it. Bad News is the best proof that off-screen depth is only worth what the player can dig up. |

**[PROPOSAL]** Design rule distilled from all of the above: *the sim may be deep anywhere, but it must be discoverable everywhere.* Each social state should have an in-fiction way for the PC to learn it (asking, overhearing, reading the paper, a Read People check, a fae oracle).

---

## 3. The Mind: what 04 keeps

A Mind is the psychological part of an Actor (per `00`). **[DECISION, lead call; C3]** It is split between two docs:

| Part of the Mind | Owner | Notes |
|---|---|---|
| Drives, norms (superego content), Thoughts, Ego arbitration, mood, anxiety, defenses, Persona, Shadow, complexes and archetypes, soul-image, individuation, dreams, fae minds | **`10`** | `10` §3–§10 |
| Need registry (which need feeds which drive, thought thresholds) | **`10`** §3.4 (C38) | 04 owns the *social* needs' satisfaction sources and behaviors (§3.3) |
| Memory, Belief, Opinion and Reasons, Grudge, Rumor, Figure, Notoriety/Reputation, Secrets, social Goals (Ambitions, Intents, Schemes) | **04** | §3.4–§9 |
| Social dispositions read by 04's formulas (derived Value views, Superstition, Rancor) | **04** reads, **`10`** stores most | §3.1 |
| Traits | data, shared | Traits shift both `10`'s numbers and 04's dispositions (§3.2) |

Everything the Mind *does* is chosen by `10`'s hourly Ego arbitration. 04's Goals, interaction volitions, and grudge aims are **option sources**: they propose urges, and the Ego picks (§3.4).

### 3.1 Social dispositions: Values as derived views

The v0.1 draft gave every actor nine bipolar **Values** (−3..+3) as stored personality. **[DECISION, lead call; C3, C36]** They become superego content. **[PROPOSAL, per `10` §3.3; 04 concurs]** Six fold into `10`, and three stay social dispositions:

| Value | +3 | −3 | Lives in (rev. 2026-10-10) | What 04 still reads it for |
|---|---|---|---|---|
| **Piety** | Devout, Sabbath-keeper | Worldly, scoffer | `10` norm `piety` (church, parent) | Church attendance; outrage at sin-coded acts; trust in preacher; receptivity to sermons; Ordeal credibility |
| **Thrift** | Close-fisted, saving | Free-handed | `10` norm `thrift` | Lending/borrowing; grudges over money (doubled weight); envy of the prosperous |
| **Neighborliness** | Communal: bees, barn raisings | Keeps to self | `10` norm `neighborliness` (community) | Gathering attendance (rumor exposure); help-giving; shunning compliance |
| **Parochialism** | Distrusts outsiders | Welcomes strangers | `10` norm `our_own` | Outsider penalty in attribution priors; stranger Trust baseline |
| **Superstition** | Reads signs, fears fae | Skeptic/rationalist | **04, stored** (an epistemic prior, not a norm) | Supernatural attribution; witch- and faekin-belief uptake; rumor embellishment; Dream and Ordeal evidence weight |
| **Ambition** | Striving | Content | `10` drives `greed` + `envy`, and the Standing need | Scheme generation; rivalry; credit-claiming |
| **Temper** | Hot | Placid | `10` drive `rage` weight + rage-thought threshold | Insult/fight probability; public accusation; escalation leadership |
| **Rancor** | Vindictive, long memory | Forgiving | **04, stored** (a memory style) | Grudge time constant; grudge inheritance; restitution acceptance. `10` reads it as resistance to forgiveness |
| **Discretion** | Close-mouthed | Tattler | `10` Persona `control` | Gossip rate; secret-keeping; who becomes a rumor hub |

**Derived views [PROPOSAL, from `10` §3.3].** Every formula in this doc that names a Value reads an integer −3..+3 **view**:
- From a norm: `view = clamp(−3, 3, floorDiv(strength − 50, 15))`, where `strength` (0–100) is the actor's strongest hold on that norm.
- Temper from the `rage` drive weight, and Ambition from `max(greed, envy)`, the same way.
- Discretion from the active Persona: `view = floorDiv(control − 50, 15)`, clamped.
- Superstition and Rancor are stored here as −3..+3 integers. Together they're the small **epistemic temperament block** that `07` §3.3 asks about (`07` Q4): 04 keeps those two fields and nothing else.

So the formulas below keep their v0.1 shape, but the numbers now come from the psyche. A Haugean with `piety` held at 92 reads as Piety +2. If he lapses and the norm weakens, his Piety view drops, and so does his outrage at Sabbath-breakers. Norms carry a **source** and a **speaker** (`10` §3.3), which matters socially: a `community`-sourced norm speaks as "the neighbors," so shame thoughts track who could see (§5.5).

**Culture, not people.** Norm priors come from culture, congregation, and household (`12` §1; `10` §1). No people carries psyche content or a Value profile.

**[PROPOSAL]** Courage and perceptiveness are **not** dispositions. They come from the Sheet (Will save, WIS, Read People, CHA) and from `10`'s Composure, per P2. Fear response = Will (+ Composure) vs. a fear DC derived from the Fear dimension, so a brave farmer is brave by the same rules as the PC.

**Compatibility** (base Affection drift between two actors), integer: `compat(a,b) = clamp(−15, 15, −Σ_v w_v·|a.v − b.v|)`, over the views of Piety, Parochialism, and Superstition (`w = 2`) and Thrift, Neighborliness, and Temper (`w = 1`). This is RimWorld's "situational thought" generalized. `10`'s **transference** (§8.3) adds a second base term for actors who fit a charged complex.

**[DECISION, P7]** There is no alignment. Alignment-keyed effects re-key to **live urges** (`10` §13.1): a *Protection from Evil* analogue wards against any actor whose current arbitration chose a harm urge toward the warded target.

### 3.2 Traits

Discrete tags, about 2–4 per actor, data-driven. They shift `10`'s numbers (drive weights, norm holds, defense style) and 04's dispositions, and they unlock interactions. Examples: `Gossip`, `Drunkard`, `Pious Hypocrite` (high public Piety, secret vice), `Skeptic`, `Fae-touched`, `Old Country` (speaks the home tongue, so rumor channels are partitioned by language; the language itself now comes from the actor's **culture** record, `12` §13), `Widowed`, `Healer`, `Cunning-folk`, `Abolitionist`, `Temperance`, `Teetotal`, `Veteran`, `Debtor`, `Grasping`, `Peacemaker` (intercession bonus), `Firebrand` (escalation leadership bonus), `Recluse`.

**[PROPOSAL, from `10` §7.1]** Some traits are better **earned than rolled**. A defense style that reaches 70 grants a trait: projection → `Suspicious`, reaction formation → `Zealot`, and so on. `Pious Hypocrite` and `Firebrand` should usually emerge this way during worldgen history and play. Rolling them at creation stays allowed for authored actors.

### 3.3 Social needs, mood, and community climate

**[DECISION]** Physical needs (hunger, rest, warmth) and their burn rates live in `05`; their stage effects live in `02`. **[PROPOSAL, C38]** `10` §3.4 owns the single **need registry** (which need feeds which drive or norm, and its thought threshold). 04 owns what *satisfies* the social needs and what their starvation does socially. Needs are 0–1000, where 1000 is satisfied (ADR).

| Need | Satisfied by | Starved → (social) | Feeds (`10` §3.4) |
|---|---|---|---|
| **Company** | Any positive interaction, gatherings, a shared meal | Seeks gatherings; Discretion view −1 while starved (lonely people talk) | `longing` (and `lust` toward an Aff target) |
| **Standing** | Respect received, being consulted, public role | Ambitious schemes, credit-claiming, envy | `envy`; norm `shame` |
| **Security** | Safety, savings, a full pantry, no recent misfortune | Raises Fear; feeds attribution ("someone is doing this to us") | `fear` |
| **Faith/Ritual** | Church, prayer, folk rite, a Hall Renewal (`12`) | Susceptibility to new prophets or fae bargains | norm `piety`; `longing` |

`02`'s **drink** and **fae longing** needs are in `10`'s registry (rates from `05`/`02` and `06`). 04 reads them only through behavior: the tavern channel (§8.4) and the Fae whisper channel.

**Mood** is `10`'s: the sum of live Thoughts' mood (`10` §4.1). RimWorld moodlets became voiced thoughts. 04 contributes the *inputs*: memories cue thoughts, opinions and grudges generate rage, envy, and fear thoughts, and being shunned feeds `shame` (`10` §4.2).

**Monotony (P8, C48)** is a `10` Id thought fed by `05`'s diet history. Its social side lives here: hosting a meal or sending a food **Gift** (#19) relieves the guest's monotony and Company at once, and a household that "eats nothing but mush" is gossip about its standing.

**Misfortune pressure M [PROPOSAL].** Each settlement keeps **M**, 0–1000 per mille: a decaying sum of recent bad events in the community (dead livestock, sick children, crop blight, disappearances, empty root cellars), weighted by how widely they're known. It decays with `07`'s `decayQ16` at τ = 30 days. M is the dry tinder of persecution: it scales suspicion priors and lowers escalation thresholds (§9).

**Community anxiety A_S** is `10`'s (§6): the weighted mean of resident anxiety, 0–1000, a T2 aggregate. M is an event sum and A_S is a mind sum. They stay distinct, and both scale the ladder (§9.1). Their merge into `05`'s HearthState.fear is defined in §9.7.

### 3.4 Goals

Three layers, all expressed as data. **[DECISION, ADR psyche-lite]** None of them act directly. Each proposes **urges** to `10`'s hourly Ego arbitration (in code, `proposeSocialUrges` and `proposeBeliefUrges`), where they compete with drives and conscience. A Scheme only advances when the Ego picks its next step, so a frightened schemer stalls and a reckless one overreaches.

- **Ambitions** (months/years): "own the mill," "see daughter married to a Yankee family," "be elected justice," "drive the Kass woman out." 1–2 per actor.
- **Intents** (days/weeks): concrete subgoals with a target ("get Nils to repay $4," "find out who soured the cows," "court Anna Brandt"). They bias venue choice at T1 and interaction choice everywhere.
- **Schemes** (CK-style): hidden long-running processes against a target (frame, ruin, seduce, swindle, expose), with `progress`, `secrecy`, and a per-step discovery roll. Schemes are how off-screen NPCs actively *do* things to each other, not just feel things.

### 3.5 Secrets

**[PROPOSAL]** A Secret is a **true** proposition about the holder (or their household) with `exposure_cost` (Reputation, legal, Grudge-triggering) and a `known_by` set. It isn't a separate store. It's a Belief that the owner holds with `conceal=true`, plus a global index for performance. Knowing someone's secret creates **Leverage** (an Obligation-like edge, CK's hook): you can spend it once (Blackmail, Expose) or hold it as a threat. Secrets are currency (Qud's water ritual): **Confide** trades a secret for Trust. It also gives the confider a one-shot anxiety discharge (`10` §6), which is why people confess things they shouldn't.

Secrets are also what Personas hide. `10` §8.1 counts +20 Persona **strain** per secret held under a Persona, and slips under strain become Observation evidence for others (§5.7).

Witch-mode note: the witch's identity is the master secret. Her cover identity is a Persona that others perceive as a Figure (§5.7; C47). A **concealed people** (shadow-faekin) is a Secret of the same kind: `Is(self, kind)` held with `conceal = true` (§5.8). `06` owns how the witch plays it, and the mechanism is here.

### 3.6 The seam with `10`: what each side writes

**[PROPOSAL]** The contract, so neither doc reaches into the other's state:

| `10` → 04 (psyche writes social state) | 04 → `10` (social state cues the psyche) |
|---|---|
| **Projection:** a Belief `Is(c, τ)` or `Feels(c, τ, b)` with evidence type `Defense{projection}` (§5.2), plus the attribution term `PF` (§5.4) | **Memories** with salience ≥ 300 cue thoughts; emotion sets the voice (anger → `rage`, shame → superego `shame` spoken by the witnesses) |
| **Displacement:** a retargeted urge (Slight, Insult, Accuse, Fight) executed as an ordinary 04 interaction, plus the attribution term `DF` (§5.4) | **Opinions:** Aff ≤ −30 → `rage`; a rival's Respect → `envy`; Fear ≥ 40 → `fear`; Obligation owed → superego `duty` spoken by the creditor |
| **Rationalization:** a justification Belief at credence 60 and an Opinion Reason "had it coming" (Aff −10); the actor is marked `voiced` | **Grudges** keep rage thoughts alive; grudge rehearsal is a thought cue |
| **Reaction formation, identification, sublimation, humor:** Catalyst weight, credence copying, sermon framing, ridicule variants (§9.6) | **Rumor exposure** to a fear-rumor adds real anxiety (`10` §7.3) |
| **Denial:** an evidence-weight clamp (×25/100) on one prop | **Being shunned or accused** adds moral and real anxiety; **Confide/Confess** discharges it |
| **Repression/isolation:** Memory flags `repressed`, `isolated`, `deferred` (§4.1) | **Commons props** voiced from the pulpit become `community`/`church` norm content over time (§5.5) |
| **Dreams:** Memories with `source: Dreamt{sender?}` and `Dream` evidence (§5.2) | **Figures** offer projection targets; Hag-cast Figures attract `ArchetypeFit` (§5.4) |
| **Fits, eruptions, slips:** notable Events, witnessed and remembered like any other | |

Two rules hold across the seam:
1. **Defense provenance is omniscient.** A projected belief looks to its holder like an Inference. The `Defense{kind}` label is visible only in the epilogue, the God view, or to a self with enough Insight (`10` §8.5). 04's UX must never print it for the PC by default (§12.8).
2. **`10` never sets a rung, an opinion value, or a credence directly** (apart from the initial credence of the belief a defense creates). It writes Reasons, evidence, beliefs, and urges, and 04's formulas do the rest.

---

## 4. Memory

### 4.1 Record

Memory is **episodic**: "what I experienced or was told happened." It's distinct from Belief (propositional, §5), and memories serve as evidence for beliefs.

```
Memory {
  id
  owner: ActorId
  event: EventId?            // ground-truth event; null for confabulations/lies-received
  kind: EventKind            // Insult, Theft, Help, Curse-symptom, Kill, Courtship, Tell, ...
  when: FuzzyTime            // game-minute + fuzz band; exact for witnessed-recent, "spring of '55" after consolidation
  where: PlaceRef?
  roles: [ {who: EntityRef, role: Role, role_conf: 0..100} ]
          // EntityRef = ActorId | Descriptor ("stranger in a red shawl") | Unknown#k | FigureId
          // Role = Agent | Victim | Witness | Beneficiary | Accomplice | Bystander
  source: Witnessed | Overheard | Told{by: ActorId, rumor: RumorId}
        | Read{doc: DocId} | Inferred{from: [MemoryId]} | Dreamt{sender?: EntityRef}   // fae-sent dreams carry a sender (10 §9)
  affect: {Affection, Respect, Trust, Fear} deltas per participant  // what this memory does to opinions
  emotion: Anger | Fear | Shame | Grief | Gratitude | Joy | Disgust | Awe | None
  intensity: 0..100          // at encoding
  s0, tRef                   // salience 0..1000 at tRef; current salience is computed lazily (§4.3)
  confidence: 0..1000        // "am I sure that's how it went"
  distortions: [Mutation]    // audit trail: what drifted from the event and when
  rehearsals: int            // times recalled/retold
  pinned: bool               // observed by PC / part of PC-visible record: never silently rewritten
  repressed?, isolated?, deferred?: bool   // written by 10's defenses (10 §7.2); see below
  synthetic?: bool           // backfilled at promotion (§11.4); debug-visible only
}
```

**Psyche flags (`10` §7.2).** A **repressed** memory recalls and retells at salience ≤ 100 and still supports beliefs at half weight, but it can't be *cited* as a Reason or as evidence in conversation. It's the witness who "doesn't remember." A **mesmerist** can recover it, with Implant risk (§5.2). An **isolated** memory encoded at half intensity with emotion `None`, so it retells flat (low juiciness). **Deferred** affect returns through dreams.

Witnessing at T0 is perception-based: line of sight, an earshot radius for speech, and Perception checks (`02`) for subtle acts such as a witch's gesture or a faekin's tell (§5.8). Timing within a minute uses the T0 sub-minute clock (C21; `07` §3.4). At T1/T2, witnesses are sampled from venue occupancy (§11).

### 4.2 Encoding intensity

All factors are integer percents: `intensity = min(100, floorDiv(base(kind) × stakes% × surprise% × trait%, 100³))`. `stakes%` is high when the owner or kin is the victim: a cursed cow is 70 for its owner, 30 for a neighbor, and 10 for the town. A public humiliation adds +20 per 10 onlookers, capped at +40. `10`'s **isolation of affect** halves intensity at encoding.

### 4.3 Decay and consolidation

- **Salience decay (C49).** The model is exponential: `s(t) = s₀·e^(−Δt/τ)`. It's computed **lazily** with `07` §4.3's committed table: on read, `s = max(floor(kind), floorDiv(s0 × decayQ16(now − tRef, τ), 65536))`. There's no daily decay pass. τ in integers (game-minutes; I = intensity, R = Rancor view, N = Neighborliness view):
  - negative memories: `τ = floorDiv(τ_kind × (50 + I) × (4 + R), 200)`
  - positive memories: `τ = floorDiv(τ_kind × (50 + I) × (20 + 3N), 1000)`

  These equal v0.1's `τ_kind × (1 + I/50) × (1 + 0.25·R)` and `(1 + 0.15·N)` exactly, up to the final floor. *Approximation note:* `EXP_NEG_Q16` is `round(65536·e^(−i/256))`, interpolated linearly; absolute error is under 2/65536, far below one salience point. Insults fade in weeks; a dead child never drops below a floor of 300.
- **Rehearsal:** each recall or retelling sets `s0 ← min(1000, s + 200)`, `tRef ← now`, and gives a distortion roll (§4.4). Grudges stay fresh *because people keep talking about them*, so the rumor system feeds memory persistence.
- **Consolidation** (per actor, weekly at T1, monthly at T2): memories of the same `kind` about the same target with `s < 250` merge into a **Summary memory**: `{kind, target, count, worst_instance (kept verbatim), span}`. "Nils has shorted me on flour three or four times since '53." This is the main memory-budget lever, and it's also psychologically right.
- **Forgetting:** below `s < 50` and not supporting any live Belief or Grudge → deleted (the event log keeps ground truth). Repressed memories are exempt: they're kept, unreachable, until something cues them.

### 4.4 Distortion

**[PROPOSAL]** Distortion is *motivated*. On each rehearsal, roll d20 + WIS mod vs. DC `10 + floorDiv(intensity, 20) + floorDiv(|opinion bias|, 25)`. Failure applies one mutation, weighted below. `10` adds three biases: **identification with the aggressor** gives the aggressor's version advantage on related memories; a constellated **complex** biases Role drift toward whoever fits its archetype; and a high **collective shadow** in the settlement weights Supernaturalization and Moralization (`10` §8.2).

| Mutation | Effect | Bias |
|---|---|---|
| **Role drift** | An ambiguous participant (`role_conf < 70`) gets reassigned toward Agent | Toward actors the owner dislikes or fears |
| **Intensification** | intensity +10%, worst detail sharpened | Grudge-bearing memories, high Temper |
| **Softening** | intensity −10% | Toward liked actors; forgiving (low Rancor) |
| **Detail loss** | Specific → descriptor ("Ottilie" → "that widow by the creek") or time fuzzes | Old, unrehearsed |
| **Supernaturalization** | Adds a sign or omen detail; kind may shift (Illness → Curse-symptom) | High Superstition, high M |
| **Conflation** | Merges with another memory of a similar kind | Summaries, elderly |

Pinned memories (the PC's own, and anything the player observed) never mutate silently. **[PROPOSAL]** The PC can still misremember on a failed check, but the UI then shows an uncertainty marker. We don't gaslight the player.

---

## 5. Beliefs and knowledge

### 5.1 Propositions and entities

Beliefs are about **propositions** interned in a global table:

```
Prop { id, pred: Pred, args: [EntityRef | Value], when?: FuzzyTime, where?: PlaceRef }
Pred ∈ {Did(act), Caused(misfortune), Is(trait|kind|role), Has(item),
        Owes(amount), LocatedAt, Kin(relation), Feels(dim, sign), IsFigure(figure),
        Courting, Adulterous, Drinks, Witch, FaeBargained, Deserved, Framed, ...}   // data-driven, ~40 at launch
```

`Is(x, kind:<people>)` is how anyone holds a belief about someone's people (`12` §7.1). Peoples are data, so the predicate is generic and never names a people in code (ADR invariant 4). **[PROPOSAL]** Kind props carry **valence 0**. What a believer *feels* about a people comes from their culture-keyed group priors (§6.2, `12` §11.2), scaled by `06`'s Prejudice dial, not from the proposition. `Deserved` and `Framed` are the predicates that `10`'s rationalization and §15.4's investigator need.

**[PROPOSAL] Figures.** An `EntityRef` can be a **Figure**: a socially constructed identity that may or may not map to a real actor. Examples: "the Bluff Witch," "the stranger who killed the hodag," "whoever is stealing from the smokehouses." A figure has its own beliefs-about (via rumor), notoriety, and grudges against it. Identity is a separate proposition, `IsFigure(actor, figure)`, with its own credence. This is the key structure for both modes:
- Witch mode: the town can fear and hate "the Bluff Witch" (high notoriety) without knowing she's Marit the hired girl. Persecution targets whoever the community's identity beliefs attach the figure to, *rightly or wrongly*.
- Adventurer mode: fame can accrue to "the stranger" before it attaches to your name, and someone else can claim the figure.

Figures are the *social* half of the identity model. The wearer's half is `10`'s **Persona** (§5.7).

### 5.2 Belief record

```
Belief {
  prop: PropId
  credence: 0..100    // integer (ADR); 0 and 100 reserved for certainty states (§5.3)
  carry: −127..127    // logit residual in Q8 (07 §4.3; pending 07 Q2)
  evidence: [ {memory: MemoryId, weightQ8: int, type: EvidenceType, dir: ±1, rumor?: RumorId} ]   // capped, top-k
  first_heard: GameMinute, first_source: ActorId?
  voiced: bool        // has asserted it publicly (commitment: harder to retract, raises Rancor-style stubbornness)
  conceal: bool       // secret, or deliberately not repeating
  clamp?: {pct: 25, until: GameMinute}   // 10's denial: evidence toward this prop counts at 25%
}
```

**EvidenceType** (Talk of the Town extended): `Observation`, `Overheard`, `Statement` (told directly), `Document` (letter, newspaper), `Physical` (found a clue item), `Inference` (reasoned from other beliefs), `Confession`, `Ordeal` (a cunning-man's test, a church trial result, a folk test from `12` §7.5; credibility depends on the believer's Superstition and Piety), `Lie-received` (indistinguishable to the receiver), `Confabulation` (filled gap), `Implant` (fae glamour, witch charm, a mesmerist's suggestion), and, added in this revision:
- **`Dream`** (`10` §9.1): spectral evidence. Base weight scales with Superstition from 0 to 1.5, and some congregations credit dreams more (data per church).
- **`Defense{kind}`** (`10` §7.2): a belief a defense produced. The holder perceives it as Inference (or Confabulation); the `kind` label is omniscient (§3.6).
- **`Seed`**: scenario- or worldgen-authored beliefs with no simulated history (the code already has this).

Folk **tells** (`12` §7.2) are not a separate type. A tell is an Event; an observer who notices it gets an Observation memory, and that memory is Observation evidence with a per-tell weight (§5.8).

### 5.3 Credence update

**[PROPOSAL]** Log-odds accumulation with source independence. The model, in real numbers:

```
logit(c') = logit(c) + Σ_i  w_i · dir_i
w_i = base(type_i) × trust(listener→source_i) × plausibility(prop | listener) × novelty_i
novelty_i = 1 / (1 + k·shared_ancestry(source_i, existing evidence))
```

**Integer form (C49; `07` §4.3 (2)).** Credence is stored 0–100. The update runs in Q8 logit space through the committed table `LOGIT_Q8[c] = round(256·ln(c/(100−c)))`, c = 1..99:

```
w      = mulQ8(mulQ8(mulQ8(baseQ8, trustQ8), plausQ8), noveltyQ8)        // each factor Q8 (×256)
L      = LOGIT_Q8[clamp(c, 1, 99)] + carry + Σ dir_i·w_i
c'     = nearestIndex(LOGIT_Q8, clamp(L, LOGIT_Q8[1], LOGIT_Q8[99]))      // binary search; ties → lower
carry' = clamp(L − LOGIT_Q8[c'], −127, 127)
```

- **`base` (Q8):** Observation 640 (2.5), Physical 384 (1.5), Document 256 (1.0; newspaper ×130/100 if the listener reads it habitually), Statement 205 (0.8), Overheard 154 (0.6), Ordeal `clamp(0, 512, 128 + 64·Superstition + 32·Piety)` (0–2.0), Dream `64·(Superstition + 3)` (0–384), Confession 512, Inference 128.
- **`trust` (Q8):** the listener's Trust in the source, mapped −100..100 → 0.2..1.5 as `51 + floorDiv((T + 100) × 333, 200)`. One's own observation uses 256. Strangers get a baseline of Trust `−10 × Parochialism`.
- **`plausibility` (Q8)** reads consistency, prejudice, and esteem:
  ```
  p = 256
  p = floorDiv(p × (100 + clamp(−50, 50, bias)), 100)   // bias = floorDiv(Aff(L→subject) × sgn(v_L), 2):
                                                       //   people believe bad things about those they dislike
  if v_L < 0: p = floorDiv(p × (150 − max(0, Res(L→subject))), 150)       // the respected resist bad props
  if supernatural: p = floorDiv(p × (10 + 3·Superstition), 10)           // ×0.1 .. ×1.9
  p = p + consistency                                    // ±64 from existing beliefs that support or contradict
  p = clamp(26, 640, p)
  ```
  `v_L` is the prop's valence *for this listener*: the predicate's valence, except for kind props (valence 0, §5.1), where it's the sign of L's group-prior Affection toward that people (§6.2). So "people believe their enemies are faekin" (`12` §7.4) holds exactly where the listener's culture treats being faekin as bad, and the Prejudice dial turns it down.
- **`novelty` (Q8):** `floorDiv(512, 2 + shared)`, where `shared` counts existing evidence on the same rumor lineage (k = 0.5). This is **rumor-lineage tracking**: hearing the same story from five people who all got it from Mrs. Pfaff counts for much less than five independent witnesses. Each Told memory carries its rumor's lineage id, which makes this cheap. Lineage is ground truth the listener doesn't know, so we deliberately discount *partially*: real people over-count echoes, and that's how mob consensus forms.
- **Denial** (`10`): while a belief has a `clamp`, supporting evidence counts at `floorDiv(w × 25, 100)`. When the clamped evidence banks 3× the threshold, denial breaks and `10` jumps credence to `min(95, c + 40)`.
- **Approximation note.** `LOGIT_Q8` is exact to rounding. The nearest-index step quantizes credence to whole points, and the carry keeps the sub-point residual, so weak echoes still accumulate near the extremes. Check against §15.1: c = 44 → L = −62; a Statement at trust ≈ 1.2 and plausibility 0.6 gives w = 147; L = 85 → **c' = 58**, as in v0.1.
- **0 and 100** are certainty states the logit path never produces. 100 is self-knowledge of one's own Secrets and the PC's pinned observations of physical fact; 0 is "I know this is false" (an alibi the believer personally witnessed).

### 5.4 Attribution: who did it?

When an actor experiences or learns of a misfortune with no observed agent, they create an **Unknown culprit** entity `Unknown#k` and an **Attribution distribution** over candidates. Since this revision, the formula includes the terms through which the believer's *own psyche* chooses the culprit (`10` §13.2) and the faekin belief term (`12` §11.3).

**Integer form (C49), in centi-units (×100).** Term inputs `Odd`, `Out`, `KM` (KnownMagic), `PA` (PriorAccused), `Mot` (Motive), `Ev` (Evidence), `FF` (FigureFit), and `Arch` (ArchetypeFit) are integers 0–100:

```
W(c) = 100
     + floorDiv(150·Odd + 100·Out + 200·KM + 100·PA + 150·Mot + 300·Ev + 100·FF, 100)
     + 2·max(0, −Aff(b→c))
     + Arch(c, archetype(m))          // 10 §8.3: e.g. the Hag for supernatural misfortune kinds
     + 2·PF(b, c, τ(m))               // 10 projection fit, if b has τ under active projection
     + floorDiv(3·DF(b, c), 2)        // 10 displacement fit, if b's displaced store > 0
     + 2·cred_b(Is(c, kind:faekin))   // 12 §11.3; uncanny misfortune kinds only; reads the BELIEF
W(Natural) = max(50, 200 − 150·Superstition + 200·DoctorSaid + (100 − floorDiv(M, 10)) − 50·band_b)
W(Figure p) = floorDiv(notoriety(p, S) × max(0, 2 + Superstition), 10)    // "the Bluff Witch did it"
```

- `band_b` is the believer's anxiety band (`10` §6): an agentless explanation doesn't discharge anxiety, so anxious people find culprits.
- `Mot(c, m)` includes projected motives: if b holds a projected `Is(c, τ)` and τ maps to this misfortune kind through `10`'s trait-to-misfortune map (envy → dried cows and stolen luck; greed → stolen butter and drawn-off crops; lust → turned hearts; rage → sickness and death), then `Mot ≥ cred(Is(c, τ))`. A projection supplies both a motive and a fit.
- `Out(c, b)` counts a different people, culture, language, or congregation, scaled by the Prejudice dial (`12` §11.3).
- Every weight is integer, so the distribution is exact and engine-identical. Ties resolve by actor id.

**Forming a belief.** Candidates = the believer's acquaintances (≤ 30, ranked by a cheap prior) plus active Figures in the area. `share(c) = floorDiv(1000 × W(c), ΣW)` per mille. If the leader's share ≥ 350 **and** `2·W(leader) ≥ 3·W(next)` (a 1.5× lead), the believer forms `Belief(Caused(c, m))` at credence `floorDiv(share, 10)`. When `Natural` leads, the believer shrugs. Attribution re-runs whenever new evidence arrives, and whenever a projection or displacement fires in the believer.

This is mob logic as a formula. The prior is mostly social (oddness, outsiderness, dislike, prior accusation) and psychological (projection, displacement, anxiety), and only partly evidential. A widow herbalist who lives alone, speaks German badly, and once quarreled with the victim is the natural suspect, whoever actually did it. **Framing** is just manipulating the `Ev` and `Mot` terms (plant a charm in her shed, curse her enemy right after their quarrel). **Defense** works on the same terms: an alibi, a doctor's natural explanation, or a better suspect. `10` §15.1 shows the psyche terms deciding a case: with projection, the widow's share is 0.42 and a belief forms; without it, 0.34, and nobody is blamed.

### 5.5 Common knowledge

**[PROPOSAL]** Each settlement keeps a **Commons** table: `prop → {prevalence ‰, mean_credence, assumed}`. A prop becomes `assumed = true` ("everyone knows") when network-weighted prevalence among adults with credence > 50 reaches 600‰, **or** it was preached from the pulpit or printed and not publicly contradicted for a week. Effects:
- Newcomers and promoted actors get assumed props as priors at credence 60.
- Speaking against an assumed prop costs the speaker Respect with believers (social risk of dissent), and raises a `10` superego `shame` thought spoken by "the neighbors." `10`'s **deniers** are the usual dissent nodes.
- The Commons is what T2 simulates directly (§11.3).
- Some Commons props are **atmosphere**, not accusations: "there's a witch about," "faekin live among us" (`12` §7.4). They start low in 1855, rise with uncanny events, and raise everyone's priors for the matching attributions.

### 5.6 Lying, and fae sincerity

A **Lie** is a Statement interaction with a prop the speaker believes false (or doesn't believe). The receiver gets a `Lie-received` evidence that looks like a Statement. Detection: receiver Read People vs. speaker Deceive (`02`). Success → the receiver's Trust in the speaker drops and they form `Belief(Lied(speaker, prop))`, which is itself juicy gossip. Lying against a held `honesty` norm (or a goblin pare's plain-speech norm, `12` §8.7) costs the liar moral anxiety in `10`; the dice don't care, but the conscience does.

**Fae sincerity [PROPOSAL, from `10` §10; answers v0.1 Q5].** Fae run on this same Belief engine. They can't assert a prop held below credence 95 without a **hedge** ("it is said," "so the river thinks"). Fae can be wrong, but never insincere. A listener with Lore (Fae) ≥ 2 weights unhedged fae Statements at Observation base (640) and hedged ones at 128. Without the Lore, they're ordinary Statements (205). Fae dream senders are bound by the same rule (`10` §9.2).

### 5.7 Identity: Persona, Figure, cover, and concealed kind (C47)

**[PROPOSAL; `10` §8.1, `12` §7.1]** One identity model, with two owners:
- **`10` owns the wearer's side.** An actor wears one or more **Personas**: the mask, its presented traits and norms, its `control` (the Discretion view), and its `strain`.
- **04 owns the community's side.** Others perceive each Persona as a **Figure** and hold `IsFigure(actor, figure)` beliefs about who wears it.

The four v0.1 mechanisms are instances of it:

| Case | Model | Notes |
|---|---|---|
| Everyday public face | One Persona, perceived as the actor themself | No Figure needed. `10`'s presented traits seed `Is(...)` props at credence 50 for new acquaintances |
| Alias (`02` Mountebank) or witch cover (`06` §3.9) | A second Persona, perceived as a **separate Figure** with its own notoriety, opinions-toward, and grudges-against | Rumors about the cover don't reach the actor until `IsFigure(actor, cover)` gains credence. A blown cover merges the Figure's grudges onto the actor (§6.3) |
| Rumor identity ("the Bluff Witch") | A Figure first, possibly with no known wearer | Attribution and recognition checks attach it to actors, rightly or wrongly |
| **Concealed people** (shadow-faekin) | **Not** a Figure. One identity with a concealed attribute: the Secret `Is(self, kind)` plus `presentsAs` | Strangers assume `presentsAs` without storing a belief (cheap). Only evidence creates an explicit `Is(x, kind)` belief (§5.8) |

**Slips.** Persona slips (`10` §8.1: drunk, anxiety band ≥ 3, or a Fit) let observers roll Read People against `10 + floorDiv(control, 5) − band`. Success gives the observer an Observation of one private trait, tell, or secret. That's juicy, and it's how covers blow.

**Notoriety attaches to Figures, not Personas.** A witch's Persona is in `10`; the town's fear lives on the Figure and on whichever actors it has been attached to.

### 5.8 Who is faekin? Suspicion, discovery, and false accusation

**[DECISION, ADR and `00`]** Shadow-faekin are concealed by default and pass as human or elf, and other actors know them only through beliefs. **[PROPOSAL, built from `12` §7]** Everything below uses ordinary 04 machinery. No faekin-specific rule exists in sim code, so any concealed people defined in content gets the same treatment.

**Priors.** On first acquaintance, a believer holds no explicit kind belief, which means "they're what they present as." An explicit `Is(x, kind:faekin)` belief is created the first time any evidence arrives, starting from `12` §7.4's integer prior: `2 + 2·Superstition`, +5 if x shows any Drift tell, +5 if x is an Outsider, +5 if x was born with a caul (+10 if the believer holds the changeling folk theory), +10 if x has been named in a faekin rumor, +10 if x is from an elven family and the believer holds the Hall theory. These folk theories are themselves Beliefs (`12` §6.1), so wrong theories make wrong suspects.

**Tells as evidence [PROPOSAL; reconciles `12` §7.2's "strength s"].** A tell of strength `s` (0–100) produces Observation evidence with `baseQ8 = floorDiv(s × 640, 100)`: a strength-100 tell weighs as much as an unambiguous Observation. Trust (256 for one's own eyes), plausibility, and novelty then apply as usual, so **plausibility's dislike term means people see tells in their enemies**. Every tell has mundane **lookalikes** (a migraine at the bell, a burn from the stove, an old friend who ages well, fog), and the sim rolls lookalike events for non-faekin at the rates in `12` §7.2. An observer can't tell a lookalike from a real tell; that's the source of false positives.

**Tests and ordeals.** The `Test` interaction (§10, #37) runs one of `12` §7.5's folk tests, each with legible true- and false-positive rates. Witnesses get `Ordeal` evidence weighted by Superstition and Piety. **Refusing a test** is Observation evidence at strength 15. P1 shows the rates in the Explain, so the player can learn that the iron key fails one nervous human in ten and that bread-and-salt is useless.

**Spread.** Kind beliefs travel like any rumor. The `faekin` predicate's base juiciness is high, and `10`'s **projection** feeds it: a believer whose Shadow holds fae longing, and who projects it, forms a projected `Is(c, kind:faekin)` (§9.6). The Commons prop "faekin live among us" raises every prior while it's high.

**Discovery.** A per-settlement Consensus on `Is(x, kind:faekin)` (§9.1) of 500‰ emits a `Revealed` event. A Figure ("the faekin at the mill") can exist and be feared before anyone attaches it to x.

**Entering the ladder.** A kind belief opens a persecution process on x like any other charge: rung 0 when a first believer forms it, rung 1 at ≥ 3 holders above 40. **`Revealed` forces at least rung 1.** The process's charge set is identity-only (§9.2), so it **caps at rung 4** until some misfortune is attributed to x: being faekin isn't an act. Once an act is attributed (the faekin attribution term in §5.4 makes that likelier), the cap lifts and rungs 5–6 are possible. Community responses at each rung are data per culture and congregation (`12` §7.6): pulled credit, broken engagements, Hall expulsion for whoever sheltered x, and **acceptance** from freethinkers, kin who knew, and Lantern households.

**Household contagion** runs through the household term in §6.2 (30/100). Siblings' kinds are rolled independently (`12` §7.6), so suspicion lands on some children *wrongly*.

**False accusation is the expected case, not an accident.** Lookalikes, ordeal false positives, dislike-driven plausibility, outsider priors, and projection all point suspicion at the odd, the disliked, and the anxious-making, and none of them read ground truth. **[OPEN, `12` Q7]** `12` proposes tuning so that roughly 40–60% of people publicly believed to be faekin aren't. That's a harness metric (`07` §8), not a rule. §15.5 is the worked example.

**Guardrails [PROPOSAL, from `12` §7.8].**
- `05`'s Director may never nudge a faekin tell, seed a faekin rumor, or tip faekin attribution. Exposure is always emergent (consistent with C43, §8.2).
- Ground truth (`ancestryId`) is read only by the Chronicle epilogue and the God view.
- The sim frames discovery's harm as the community's doing. Concealment is never treated as a moral fault, and no Insight reveal labels passing a defense (`10` §8.1).
- **Framing is Ellie's call** (`12` Q6, `10` Q4, `11` §2.9): folkloric-primary and universal-psychological (F1 + F2, `12`'s recommendation), concealment as covenant (`10`'s option B), or per-World. The mechanics above work under any of them. This doc uses no real-race vocabulary for faekin, and the code's placeholder text ("of the hidden folk") is a framing choice pending that decision.

**The PC.** A faekin PC's creation option (`12` §7.7: knows / suspects / doesn't know) sets the PC's own `Is(self, kind:faekin)` at 100 / 50 / absent. Under "doesn't know," the PC's tells reach the player as unexplained experiences, and the epilogue confirms the truth.

---

## 6. Opinion

### 6.1 Dimensions

**[DECISION]** Opinion is multi-dimensional (00). **[PROPOSAL]** Five dimensions:

| Dim | Range | Meaning | Primary sources |
|---|---|---|---|
| **Affection** | −100..+100 | Like/dislike | Kindness, insults, compatibility, kin |
| **Respect** | −100..+100 | Esteem for competence and standing | Deeds, wealth, office, piety, prowess |
| **Trust** | −100..+100 | Expects honesty and reliability | Kept or broken promises, caught lies, repaid debts |
| **Fear** | 0..100 | Expects harm, dread | Threats, violence, witnessed magic, notoriety as dangerous |
| **Obligation** | signed ledger | Who owes whom (favors, dollars, leverage) | Lending, help, gifts, secrets held |

Obligation is a **ledger**, not a feeling: `{favors: int, cents: int, leverage: [SecretId]}`. It's directional, and the mirror view on the other side is maintained. It drives reciprocity: people help those they owe, and resent creditors as debts age (Thrift-weighted). Institutional obligations use the same ledger with a group as the counterparty: a goblin pare's **Club** dues and relief (`12` §8.3), church tithes, a Hall's claims. An owed Obligation also voices a `10` superego `duty` thought, spoken by the creditor.

Derived labels for UI and AI shorthand: *Friend* (Aff > 40 & Trust > 20), *Enemy* (Aff < −40), *Rival* (Respect > 20 & Aff < −20 & Ambition overlap), *Patron* (Respect > 40 & Obligation owed), *Cowed* (Fear > 50 & Aff < 0), *Admirer* (Respect > 50), and so on. These are labels on numbers, not separate state.

**One model for every mind (C36).** **[PROPOSAL, per `09` and `10` §10]** `07`'s data model copies these dimensions and Reasons. Fae use them too. The Prince's opinion of his witch (`06` §3.4) maps as *amusement* → Affection, *esteem* → Respect, *trust* → Trust. His *desire* is not a fifth dimension: it's a `10` drive (`lust`/`longing`) with a target. Fae have no defenses, so a slight to a fae goes into `10`'s **Affront** store and spawns grudges at half the human thresholds (§6.3).

### 6.2 Reasons

```
Opinion { subject, target: EntityRef|HouseholdId|GroupId,
          base: {dims}                      // compat + kin + group prejudice, recomputed on demand
          reasons: [Reason]  (cap 8 + "other" bucket)
          volatile: {dims}                  // short-term (Sims 2 daily), fast decay; today's spat
}
Reason { label_key, cites: MemoryId | BeliefId | Relationship,
         delta: {dims}, decay: Rule, since: GameMinute, viaDefense?: DefenseId }
value(dim) = clamp(base + Σ floorDiv(reason.delta(dim) × strength(reason), 1000) + volatile)
strength(reason) = salience(cited memory) (0..1000), or 10 × credence(cited belief) (0..1000)
```

`viaDefense` marks a Reason that a `10` defense created (rationalization's "had it coming," a projection's justified dislike). It behaves like any Reason, but its provenance is omniscient (§3.6), so the PC sees it labeled only with Insight.

**[DECISION]** Opinions are never set directly. They change only by adding or removing Reasons, or by the cited memories and beliefs changing. That gives us:
- **Legibility (P1):** every point is attributable.
- **Contestability:** refute the belief (credence ↓) and the reason weakens automatically. That's the player's main social verb.
- **Correct inheritance:** opinions toward groups and households are the same structure.

**Group opinions**: actors hold opinions toward Households, Congregations, Cultures, **Peoples** (`human`, `elf`, `shadow_faekin`, `goblin` as data; ADR invariant 4), roles ("company men"), "the Fair Folk," and Figures. An individual's effective opinion of someone = their individual opinion + `floorDiv(30 × household opinion, 100)` + `floorDiv(15 × group opinion, 100)` over the target's groups. That's how one Haas's misdeed taints them all.

**Peoples priors (C5) [PROPOSAL, per `12` §11].** A holder's group opinion toward a people starts from a **prior keyed by the holder's culture or upbringing and the target's people or role** (`12` §11.2), scaled by `06`'s **Prejudice dial** (0–150%). Which people counts is a **belief**, never ground truth:
- for a non-concealed people, the target's presented people (which is also their real one);
- for a concealed people, the prior applies only in proportion to the holder's credence: `floorDiv(prior × cred(Is(x, kind)), 100)`. A neighbor who half-suspects you gets half the hostility.

How strong these priors are, and whether real 1855 prejudices among human cultures (nativism, anti-Catholicism, anti-Black racism) are simulated too, is **[OPEN]**: `12` §11.1 gives options P1–P4 and recommends P3 (restrained for both). 04's Outsider and Oddness terms produce bias even under P4, so "none" isn't neutral.

### 6.3 Grudge

**[DECISION]** A Grudge is a strong, durable negative opinion tied to specific memories that drives goal-directed hostility (00). **[PROPOSAL]** Make it a first-class object, spawned when thresholds are crossed, because it needs state that an Opinion doesn't have:

```
Grudge { holder: ActorId | HouseholdId, target: EntityRef (incl. Figure/Unknown),
         founding: [MemoryId|BeliefId], intensity: 0..100,
         aim: Restitution | Apology | Humiliation | Expulsion | Harm | Death,
         patience: days, public: bool, inherited_from?: GrudgeId,
         viaDefense?: DefenseId,     // founded by projection, displacement, or reaction formation (10)
         decay: Normal | Floor(n) | None }   // see C12 below
spawn when: Aff ≤ −50 and some cited memory intensity ≥ 60, or Rancor ≥ 2 and Aff ≤ −35
            (fae holders: half these thresholds, from 10's Affront store)
intensity drift: exponential, τ_grudge = 60 d × (1 + Rancor), computed lazily with decayQ16 (§4.3);
                 rehearsal +3 per retelling
aim from: offense kind × rage-drive view (Temper) × piety view (the pious favor Apology/Expulsion over Harm)
```

Grudge **aims** generate Intents and Schemes, which become urges in `10`'s arbitration. Aims also define what satisfies the grudge (§9.4). A grudge's rage thoughts persist while it lives; that's the psychological cost of holding one.

**Do grudges decay? (C12) [OPEN].** `01` §4.4's Prince builds his strategy on "grudges don't decay," while v0.1 decays them. Options:
- **(a) Uncanny grudges don't decay** *(`09`'s recommendation; 04 concurs)*. Grudges founded on uncanny or fae events (a cursed herd, a hag-riding, a changeling) get `decay: Floor(60)` or `None`, so the Prince's thesis is literally true and Woe lasts. Ordinary grudges decay as above. **Fae-held grudges never decay** under any option, per `10` §10.
- **(b)** Keep v0.1's decay for all human grudges and soften `01` to "grudges outlast every other memory."
Both are a data flag on the grudge, so either is cheap. `06` §8.1's "Social memory" slider scales τ_grudge.

---

## 7. Relationships, households, lineage

### 7.1 Typed edges

Relationships are **structural facts**. Opinions are attitudes. Both exist: you can loathe your brother.

| Edge | Notes | Mechanical role |
|---|---|---|
| Kin (parent, child, sibling, cousin, in-law) | Generated with worldgen depth (05) | Base Affection +20..+40; grudge inheritance; information channel at home |
| Spouse / Courting / Betrothed | Courtship is a process (§10) | Shared household; scandal surface |
| Friend / Rival | **Derived** from opinion and contact, with hysteresis | Gossip routing; fights |
| Patron / Client | Respect + Obligation; e.g., mill owner and his tenants | Clients adopt patron's opinions (×0.3), shun on cue |
| Employer / Employee | Contract with wage | Daily co-location → many T1 encounters |
| Creditor / Debtor | Mirrors Obligation ledger; may be legal (note) | Leverage; foreclosure → grudge |
| Congregant (of Church X) | Membership in an institution | Weekly broadcast channel; church discipline |
| Neighbor | Geographic (adjacent claims) | Encounter frequency; boundary disputes |
| Lodger / Hired hand | Lives in household without kinship | Witness to household secrets |
| Bound (fae bargain) | Fae edge (01/06) | Fae-specific obligations |
| Member (society) | A Hall (`12` §5), a miners' Club (`12` §8.3), a Lantern household network (`12` §6.3), a temperance society | Group Obligation ledger; discipline and expulsion as office interactions (§9.3); a private rumor channel |

### 7.2 Households as units

**[PROPOSAL]** A Household is a first-class social entity with: members, head, property, **Name standing** (household-level Respect/Reputation aggregate), a shared **Household Obligation ledger**, **Household Grudges/Feuds**, and a **pantry**. Many community actions target households ("don't trade with the Haases"). A household's standing feeds members' base Respect from outsiders.

**Pantries (P8, C48) [DECISION, lead call].** A pantry is a household inventory built on `03`'s item model: the same item fields (kcal, nutrition, shelf life, packaging), stacks, and spoilage that the PC's pack uses. `05` owns burn rates, spoilage physics, and the effects of hunger. 04 owns what pantries do *socially*:
- **Lend, Borrow, Gift, Help** (§10) move pantry items, not abstract "food," and create Obligation entries priced by `03`.
- **What a pantry holds is a belief** for everyone outside the household. Neighbors learn it by being hosted, helping at butchering, or seeing the cellar half-empty (`11` §2.3 shows these as dated beliefs).
- **Want is a social force.** A pantry running short drains the Security need, which raises `fear` and real anxiety in `10`, and hungry towns hunt (`10` §7.3). A failed harvest also adds to M. A cursed root cellar is a misfortune event and gets attributed like any other (§5.4).
- **Relief is politics.** Church charity, a Club pantry's members-only rule (`12` §8.6), and a storekeeper's credit are office interactions with norms, so who gets fed is a source of grudges and gratitude.

### 7.3 Inherited grudges ("my father said your family...")

**[PROPOSAL]** Inheritance runs through **telling**, not magic, so it uses the same pipeline:
- **Upbringing transfer:** while a child lives in a household, the household's grudges and feuds are retold (T1 "home" activity). The child gets a `Told{by: parent}` memory with lower confidence and *high* salience (parental authority: trust ×150/100 under age 16). If the child's Rancor ≥ 0, a derived Grudge spawns at `floorDiv(intensity × 60, 100)`, with `inherited_from`. The same table builds a conscience: `10`'s `parent`-sourced norms are transmitted here, so a child inherits both the feud and the voice that says "we don't forgive the Coles."
- **Inherited Obligation:** debts pass to heirs through the household ledger (`03` debts to heirs; `12` §9's Club-share hook).
- **Deathbed and wedding transfers:** high-salience events re-tell feuds, and they're notable in the Chronicle.
- **Founding memory reference:** the inherited grudge cites the *story*, which may be badly distorted by now (two generations of Role drift), and the game can show it: "Her grandfather told her a Kass poisoned the Brandt well in '41. (The event log says it was a dead raccoon.)" In normal mode the player only sees the first sentence.
- **Feud object** (household ↔ household): spawned when ≥ 2 members on each side hold mutual grudges. It has `origin`, `incidents[]`, and `temperature`, and it inherits forward until defused (§9.5) or until a marriage alliance passes a reconciliation roll.

---

## 8. Rumor system

### 8.1 What a Rumor is

**[DECISION]** A Rumor is a transmissible claim that moves through contact and mutates (00). **[PROPOSAL]** Implementation: a Rumor is a **lineage** of transmitted propositions, and each actor's copy is just a Belief whose evidence includes a `Told` memory carrying the lineage id.

```
Rumor { id, root_prop, origin: {actor|event|doc}, born: time,
        variants: tree of {prop, parent, mutation, first_carrier},
        juiciness: 0..1000,   // computed: scandal × novelty × stakes × notoriety(subject); content authors 0..100, ×10 at load
        per_settlement: {prevalence ‰, dominant_variant, assumed} }
```

### 8.2 Generation

Rumors are born when an actor *voices* a belief that others lack. Sources:
- Witnessing anything with juiciness > 300‰ (a fight, a drunk deacon, the PC coming out of the woods bloody).
- Attribution conclusions ("I think it was the Kass woman").
- Lies and schemes (an Ambitious actor claims the hodag kill).
- Documents: a newspaper item, a letter read aloud.
- **Defenses** (`10`): projected beliefs are voiced at juiciness ×130/100 with a Moralization mutation; rationalizations are spoken and become rumors defaming the victim; humor spawns `ridicule` variants (§9.6).
- **Dreams** (`10` §9): a remembered dream is a Memory, and a dreamer who tells it seeds a rumor carrying `Dream` evidence. A Court's communal dream seeds many at once.
- **Director nudges (C43) [DECISION, `05` §8.3 N4 wins].** The Director prefers nudges (`00`), but it may only raise the juiciness or the carrier traffic of a rumor that some in-world carrier **already holds** (a peddler who knows the story arrives sooner). It may not author a variant, seed a false one, or edit a memory. It never touches faekin tells or rumors (§5.8). v0.1's "seed a plausible-but-false variant" is withdrawn. False variants come only from actors: liars, schemers, the witch, mutation.

### 8.3 Transmission: who talks to whom about what

In any conversation (T0) or rolled encounter (T1), the speaker picks a topic:

```
topic_score(rumor r, listener L) = juiciness(r) × talk(S)
     × relevance(r, L)        // about L's kin/neighbors/enemies: ×2; about strangers: ×0.5
     × unknown_to_L_estimate  // speaker's guess; repeats are possible and fine
     × safety(r, L)           // ×0.1 if subject is L's kin/friend (unless speaker hostile)
     × venue_norm(r, venue)   // church: scandal ×0.3 inside, ×1.5 on the steps after
talk(S) = clamp(0.1, 2.2, 1 − 0.4·Discretion_S)      // v0.1's (1 + 0.4·(−Discretion)) went negative at +3
```

**Integer form (C49).** Juiciness is per mille and every factor is an integer percent, so `score` is per mille (0–~4000): `score = floorDiv(juic × talk% × rel% × unk% × safe% × venue%, 100⁵)`. The top topic is told with probability `p_tell = σ(k·(score − 0.5))`, read from `07`'s committed table `SIG_PERMILLE` (x from −8 to 8 in Q8, interpolated; error under 0.2‰): `xQ8 = floorDiv((score − 500) × 256 × k, 1000)`, then `rng.chancePermille(SIG(xQ8))`.

**[PROPOSAL] Steepness k = 4** (new in this revision). With v0.1's k = 1, a rumor scoring zero was still told 38% of the time. With k = 4 it's 12% at score 0, 50% at 0.5, and 88% at 1.0. Tune against the M2 harness.

**[PROPOSAL]** At most one rumor per T1 encounter and up to three per T0 conversation, which keeps propagation rates analyzable. **Hearing** a fear-rumor adds real anxiety to the listener (`10` §7.3), which is the step where a rumor becomes a defense in someone else.

### 8.4 Channels

| Channel | Cadence | Reach | Who | Credibility × | Mutation × | Notes |
|---|---|---|---|---|---|---|
| Tavern/saloon | Nightly | 5–20 | Men, travelers, drinkers | 0.8 | 1.5 | Drunk = −Discretion, +Temper; fights |
| Sunday church (inside) | Weekly | Congregation | Families | Sermon 1.4 | 0.3 | Preacher **broadcasts** (§9.3) |
| Church steps/after | Weekly | Congregation | Families, women's circles | 1.0 | 1.0 | Peak gossip node |
| Market day / store | Weekly + daily | 10–40 | Everyone, cross-household | 1.0 | 1.0 | Storekeeper is a hub |
| Quilting/husking bee, barn raising | Seasonal/monthly | 8–30 | Women / whole neighborhood | 1.1 | 1.2 | Long duration = many exchanges; Versu-style practice |
| Mill / smithy queue | Daily | 2–6 | Farmers | 0.9 | 1.0 | Cross-coulee mixing |
| Letters | Days–weeks | 1 (then read aloud) | Literate, kin abroad | 1.2 | 0.5 | Inter-settlement; postmaster may read them (!) |
| Newspaper (weekly) | Weekly | Subscribers + readers-aloud | Literate, then everyone | 1.3 (habitual) | **0** | **Freezes** a variant; becomes Document evidence; the editor is an actor with opinions |
| Peddler / circuit rider | Irregular | Route | Isolated farms | 0.9 | 1.4 | Main T2 carriers between settlements |
| Steamboat landing | Weekly (seasonal) | Town | River folk | 0.8 | 1.3 | Brings outside rumors; carries yours downriver |
| Household table | Daily | Household | Kin | Trust-based | 0.8 | Grudge inheritance channel |
| Fae whisper | Rare | 1 | Fae-touched, children | Superstition-based | 2.0 | Fae can seed rumors (06, 01), sincerely (§5.6) |
| Dream (sent) | Per sleep | 1 sleeper, or many (communal) | Anyone; receptivity per `10` §9.2 | `Dream` evidence | Interpretation | Faerie's channel into minds it can't touch; the payload is true, the reading may not be (`10` §9.2) |
| Lantern / Hall / Club | As members meet | Members | Faekin households, elves, goblin pares (`12`) | Trust-based | 0.8 | Closed channels: news moves fast inside, slowly out |

Multipliers in this table are stored as integer percents (credibility 80 = ×0.8).

Language partitions: speakers of the same home language (from the **culture** record, `12` §13) share rumors more readily. Rumors cross language communities mainly through bilingual hubs (the storekeeper, the priest). That gives a natural "the Germans all know but the Yankees don't yet" effect.

### 8.5 Mutation

On each transmission, `p_mut = base 0.12 × channel_mutation × (1 + 0.1·Superstition_S) × (1 − 0.05·Int_mod_S)`. Integer form, per mille: `p_mut = floorDiv(120 × chanMut% × (100 + 10·Sup) × (100 − 5·IntMod), 100³)`. Mutation types parallel memory distortion: **Exaggeration** (counts and intensities rise: "one cow" → "all his cows"), **Attribution drift** (Agent swaps to a similar or disliked candidate, the most consequential type; the speaker's active projection or displacement target is weighted ×2), **Specification** (vague → specific: "someone" → "the Kass widow"; this is how figures get attached to people), **Supernaturalization**, **Moralization** (attaching a sin: "...and she doesn't keep the Sabbath"), and **Truncation**. Each mutation creates a variant node, and the variant tree is kept so the UX can show "versions" of a rumor.

**The collective shadow steers mutation [PROPOSAL, from `10` §8.2].** Moralization picks its sin from the settlement's collective-shadow histogram, and the traits a Figure accumulates drift the same way. A Temperance town's witch becomes a drunken temptress; a town in land disputes gets a luck-thief. Figures also carry an **archetype** (the Bluff Witch is Hag-cast; `10` §8.3), which biases Specification toward actors who fit it: widows who live alone and keep herbs.

### 8.6 Notoriety and Reputation

**[DECISION]** Notoriety = how widely and vividly known; reputation is valenced (00). Per entity (actor or figure) per settlement:

```
Notoriety(e, S) = floorDiv(Σ_{a∈S} salience_max(a, e) × W_a, Σ W_a)     // 0..1000 ‰, "how many think of e, how vividly"
Reputation(e, S) = mean over a with salience > 100 of floorDiv(2·(Aff + Respect + Trust) − Fear, 6) toward e   // −100..100
```

Notoriety rises with rumor prevalence about e and decays with salience (lazily, §4.3). It's maintained incrementally at T2 from compartment prevalence. **[PROPOSAL]** Notoriety also scales how often e is *topic-selected* (fame begets talk), and it gates the "Stranger recognized" check: when the PC enters a settlement, actors roll to connect the PC's descriptors to known figures.

**Notoriety tiers (C42) [PROPOSAL].** `02` (*Hard Reputation*, +0 to +6) and `06` (Glory, County Legend) need discrete tiers. They're a view on notoriety, valenced by Reputation. **They are not persecution rungs** (§9.2): a beloved preacher can be tier 5 at rung 0.

| Tier | Name | Condition (per entity) | `02` bonus | Valence words (Reputation ≥ +20 / ≤ −20) |
|---|---|---|---|---|
| 0 | Unknown | Notoriety < 50‰ in every settlement | +0 | — |
| 1 | Talked of | ≥ 50‰ in one settlement | +1 | "spoken well of" / "spoken of" |
| 2 | Known locally | ≥ 150‰ in one settlement | +2 | "well thought of" / "ill thought of" |
| 3 | A name in town | ≥ 300‰ in one settlement | +3 | "respected" / "notorious" |
| 4 | Known across the county | ≥ 150‰ in at least half the settlements | +4 | "renowned" / "infamous" |
| 5 | County figure | ≥ 300‰ in at least half the settlements, or printed in the county paper | +5 | "celebrated" / "feared" |
| 6 | County Legend | ≥ 500‰ in at least ¾ of settlements, and a variant frozen in a Document | +6 | "a legend" / "a terror" |

Tiers are computed per entity (actor or Figure). An adventurer's fame can sit on the Figure "the stranger who killed the hodag" at tier 3 while their own name is tier 1, until `IsFigure` credence joins them (§5.7). For the PC, the dossier and rumor ledger show the tier the PC *believes* (from Gather Information, gossip heard, papers read), per §12.

---

## 9. Grudges and persecution

**[DECISION, lead call; C41]** **This section is the canonical definition of persecution for any person or Figure.** §9.2's rungs 0–6 are the only ladder. `05`'s alert levels cover non-person threats only, `06`'s Notoriety tiers for the witch are *labels* on these rungs, and `05`'s HearthState fear and suspicion are read-only views of this section's state (§9.7). `06` owns witch mode's use of the ladder (curse economy, the Prince's demands, win/lose framing). `10` feeds it through defenses but never sets a rung (§9.6). `12` feeds it through kind beliefs (§5.8).

### 9.1 Aggregation: Heat and Consensus

For each target T (actor, household, or Figure) in settlement S. Integer form (C49): `W_h` in tenths, `P_h` in percent.

```
Heat(T,S) = floorDiv(Σ_{holders h} G_h.intensity × W_h × P_h × D_h, 10 × 100 × 100)
          + floorDiv(20 × Σ_{adults a} W_a × Fear_a(T) × M_S, 10 × 100 × 1000)
   W_h = social weight, tenths: 5 (child, hired hand) .. 10 (adult) .. 20 (household head, respected) .. 30 (office-holder, preacher)
   P_h = publicness %: 30 private grudge, 70 voiced to kin/friends, 100 publicly accused
   D_h = defense multiplier %: 125 if the grudge or hostility is viaDefense (projection, displacement,
         reaction formation; 10 §13.2); 50 if h heard and accepted a ridicule variant about T this month (humor); else 100
Consensus(T,S) = floorDiv(1000 × Σ_a W_a·[cred_a(charge(T)) > 50], Σ_a W_a)      // 0..1000 ‰, adults only
   charge(T) = the strongest damaging prop in the process's charge set (below)
```

The second Heat term is **Fear mass**: how much the whole community fears T, made combustible by misfortune. It's why Fear is double-edged (§9.5).

Heat is "how much anger is pointed at T." Consensus is "how many agree." A feud has high Heat and low Consensus. A pariah has both.

**Threshold scaling.** Every rung's Heat and Consensus threshold is multiplied by hard times and frightened minds:
```
thr' = floorDiv(thr × (1000 − floorDiv(350 × M_S, 1000)) × (4000 − A_S), 1000 × 4000)
```
That's v0.1's `(1 − 0.35·M)` times `10`'s `(1 − A_S/4000)`. At M = 300‰ and A_S = 400, thresholds are ×0.805 (0.895 × 0.9). Liquor at the tavern takes a further 15% off rung 6.

### 9.2 The escalation ladder (canonical)

**[PROPOSAL]** Persecution is a per-target, per-settlement **Process** (in the Versu "practice" sense) with a rung, leaders, momentum, a charge set, and a history log. Advancing a rung requires thresholds **and an actor who takes the step**: a **Catalyst** whose own goals, drives, and defenses make the act likely (§9.4). Thresholds are scaled per §9.1, so hard times make mobs.

```
Process { target: Actor | Household | Figure, settlement: SettlementId,
          rung: 0..6, since: GameMinute, heat: int, consensus: 0..1000,
          charges: [PropId],          // what T is believed guilty of or to be: Witch(T), Caused(T, m), Is(T, kind), ...
          actAttributed: bool,        // some charge is an act (Caused, Did). False for identity-only charges
          leaders: [ActorId], restraint: [ {office, actor, until} ],
          history: [ {rung, at, catalyst, eventId} ] }
```

| Rung | Name | Entry condition (thresholds scaled per §9.1) | What happens (mechanics) | Typical catalyst |
|---|---|---|---|---|
| 0 | **Unease** | Any attribution or damaging kind belief forming on T | Private beliefs; nothing visible | — |
| 1 | **Whispers** | ≥ 3 holders with credence > 40, or a `Revealed` event (§5.8) | Rumor juiciness about T ×150/100; T's casual interactions get colder (volatile Aff −10) | Any low-Discretion holder |
| 2 | **Accusation** | Heat ≥ 150 | A named public accusation (an event: everyone present gets an Observation of the accusation). The accuser is now `voiced` and harder to move. T gets a **Defend** window | High Temper or Rancor holder with grudge ≥ 60, or a displaced rage urge (§9.6) |
| 3 | **Shunning** | Heat ≥ 300, Consensus ≥ 350‰ | Store prices +20–50% or refusal; no help at bees; pew isolation; children forbidden to play. Shunning compliance per actor = f(Neighborliness view, patron cue, own belief) | Respected household head, or a patron cueing clients |
| 4 | **Institutional** | Consensus ≥ 500‰ and an office-holder believes | Sheriff inquiry (on a mundane charge; see below), church discipline or expulsion, Hall discipline (`12`), a newspaper item (freezes the narrative), a petition, the JP hearing. **Institutions can also *restrain*** (§9.3) | Preacher, editor, sheriff, deacon, Hall-reader |
| 5 | **Hunt** | `actAttributed`, Heat ≥ 800, plus a fresh misfortune or a leader with aim Harm/Expulsion | Posse or militia muster; a witch-finder or cunning-man is hired; search parties enter the Wilds; a bounty. T's property may be searched (evidence events) | Firebrand, grieving parent, militia captain |
| 6 | **Mob / Trial** | `actAttributed`, Heat ≥ 1200, Consensus ≥ 650‰, institutional restraint failed or absent | A **trial** (see the legal note) or **mob action**: charivari/shivaree (period-correct rough music), tar-and-feathers, barn burning, ride-out-of-county, and at the extreme, killing (the "burning analogue"). Resolved as a T0 set piece if the PC is present, otherwise as a T1 group action. `11` §7.7 governs depiction | Crowd + leader; liquor at the tavern lowers thresholds 15% |

**Identity-only processes cap at rung 4 [PROPOSAL].** If no charge is an act (`actAttributed = false`), as for a believed faekin, an unbaptized "changeling" infant's mother, or a household of the wrong church, the process can reach shunning and institutional pressure, but not a hunt or a mob. The moment a misfortune is attributed to T (§5.4), `actAttributed` becomes true and the cap lifts. This keeps `12`'s rule that being faekin isn't being guilty of an act, while letting the community's fear find the act it wants.

**Legal note (C13) [PROPOSAL, follows `01` §5.4; OPEN pending `01` Q6].** There's no witchcraft statute. So:
- The sheriff's `Arrest` and the JP's `Hearing` need a **mundane charge**: poisoning a well, arson, theft, assault, slander, trespass, fraud. A witch hunt that wants the law must find one, which is exactly what framing provides.
- **Church trials** are ecclesiastical discipline (admonition, suspension, expulsion). They're serious socially and have no legal force.
- **Ordeals** (a cunning-man's test, the iron key) are folk practice with no legal standing.
- A "**trial**" for witchcraft at rung 6 is therefore a mob court: extralegal, and the Chronicle says so. `05`'s "tried, hanged, or swum" reads as lynching or mob action.
If Ellie overrules `01` and adds a statute, rung 4–6's legal paths simply gain a witchcraft charge.

**Momentum.** Each rung has a **dwell time** (rung 2: 3 days, rung 3: 1 week, rung 4: 1–2 weeks). Without fresh fuel, Heat decays and the process steps **down** one rung per two dwell periods. Fresh misfortunes attributed to T add Heat, and those attributed elsewhere *divert* it. `10`'s rationalization slows the descent: participants who rationalized a persecution act are `voiced`, so Consensus decays more slowly and defusal DCs rise by 2 (§9.5).

### 9.3 Frontier institutions as actors

**[DECISION]** Per P2, institutions don't get special logic. An institution is a role held by an actor, plus a set of **office interactions** gated by the role and constrained by office **norms** (with violation costs).

| Office | Office interactions | Restraint/accelerant |
|---|---|---|
| **Preacher** (settled or circuit rider) | `Sermon` (broadcast a prop or a moral frame to the congregation at credibility 1.4), `Church Discipline`, `Visit` (counsel), `Intercede`, hear `Confess` (`10`) | His psyche decides the sermon: Piety and Temper views, plus `10`'s defenses. A **mercy sermon** cuts rung-3+ Heat among congregants by 20–40%, and it's a collective *undoing* that discharges A_S. A **sublimated-rage fire sermon** accelerates rung-3+ Heat by 20–40% (`10` §7.2). A preacher in **reaction formation** toward T is a Catalyst, not a brake |
| **Sheriff / constable** | `Inquire`, `Arrest` (mundane charges only, §9.2), `Protect`, `Deputize` (forms the posse) | Requires an **evidence threshold** (credence > 70 from Observation/Physical evidence, not just Statements). A legalistic sheriff is the main brake on rung 6. A cowed one (Fear) is not, and one who **identifies with the aggressor** (`10`) joins it |
| **Justice of the Peace** | `Hearing`, `Bind over`, `Fine` | Turns persecution into a trial with rules (02 checks: Persuade, Deceive, Read People). Verdict = belief update for all attendees |
| **Militia captain** | `Muster`, `Lead hunt` | Accelerant; wants Respect (Standing need) |
| **Newspaper editor** | `Print` (weekly), `Editorialize`, `Refuse to print` | Freezes a variant and creates Document evidence for every reader. Can be bribed, threatened, or befriended. A skeptic editor ridicules witch talk (Superstition push −1 for readers who trust him) |
| **Doctor** | `Diagnose` (natural explanation) | Adds `DoctorSaid` to Natural attribution weight |
| **Cunning-folk / witch-finder** | `Divine`, `Test` (ordeal; `12` §7.5's tests and rates), `Counter-charm` | Produces Ordeal evidence. Biased by their own beliefs and by payment. Can be real (`02` magic) or fraudulent. `10`: "the witch-finder is drawn to witches" (reaction formation) |
| **Mesmerist** (lyceum fringe) | `Mesmerize` (`10` §12) | Recovers repressed memories, with Implant risk: the mesmerist's own beliefs bleed into the "recovered" testimony. Key evidence in a hunt can be manufactured this way, sincerely |
| **Storekeeper/postmaster** | `Extend credit`, `Refuse service`, read letters | Hub and shunning enforcer |
| **Hall-reader / Club steward / Accord-speaker** (`12`) | `Hall discipline`, `Club relief` (from the club pantry), `Expel` | Community institutions of elves and goblin pares. They can shield their own or sacrifice them; a Hall's doctrine makes sheltering a believed faekin an offence (`12` §5.3) |

### 9.4 Grudge satisfaction and individual action

A grudge with aim A drives Intents in line with what the holder's sheet can actually do: Restitution → *Demand*, *Sue*; Humiliation → *Insult in public*, *spread Rumor*; Expulsion → *Petition*, *Shun-lobby*; Harm → *Sabotage*, *Assault*, *hire someone*. Hostile actions are gated by `Fear` of the target (high Fear suppresses direct action and **raises** covert action, community lobbying, and `10`'s **displacement** onto safer targets), by norms (Sabbath, kin; these are now superego thoughts that oppose the urge in arbitration), and by the ladder: **[PROPOSAL]** individuals can't take rung-6-type actions alone unless Temper ≥ 3 and grudge ≥ 90 (the Radiant AI lesson). A shadow **eruption** or a Fit (`10`) can break that rule once, and it's always notable.

**Catalyst selection [PROPOSAL].** When a process meets a rung's thresholds, each candidate h in S gets an integer score for taking the step:
```
Catalyst(h, rung) = volition(h, the rung's step interaction)    // Accuse, Shun-lobby, Petition, Recruit/Muster, lead the crowd (§10)
                  + 30·[h is in reaction formation toward T]     // 10 §13.2
                  + 20·[h projected onto T within 30 days]
                  + 10·office_weight(h, rung)                    // the institution a rung needs
```
The top scorer above the step's volition threshold proposes the step as an urge to `10`'s arbitration. If the Ego picks it, the rung advances and the Catalyst is recorded in `history`. If nobody's Ego picks it, the process waits at its rung, even with Heat to spare. That's a town where everyone agrees and nobody acts. At T2, Catalysts are individuated from named actors (§11.3).

### 9.5 Defusal

| Lever | Mechanism | Who can pull it |
|---|---|---|
| **Restitution** | Pay or replace → adds a Reason with positive Trust/Aff that *cites the same founding event*; grudge intensity −`floorDiv(value × 60, stakes)`. High Thrift holders demand full value | Target, kin, patron |
| **Apology** | Persuade check; DC by intensity and Respect toward the apologizer, +2 if the holder has rationalized (`10`); public apology ×1.5 but costs Respect | Target |
| **Intercession** | A third party with high Trust from the holder vouches. Their Trust is at stake (failure → their Trust drops too) | Preacher, Peacemaker, patron, PC |
| **Counter-evidence / alibi** | Lowers credence of the founding Belief → reasons weaken automatically | Anyone with the evidence; the PC investigating |
| **Scapegoat** | A better candidate appears; attribution renormalizes. Heat *moves*; it isn't destroyed | Witch (06!), schemers, chance |
| **Time** | Salience and grudge decay; blocked by rehearsal (the gossip keeps it alive) | — |
| **Fear** | Raises the threshold for *individual* action but adds to community Heat via Fear_mass. **Double-edged by design** | Witch, violent PC |
| **Distraction** | A bigger misfortune or threat captures topic selection and attention (a flood, a fae incursion) | Director, world |
| **Ritual reconciliation** | A revival meeting, a wedding between feuding houses, a community feast: mass Affection repair, roll per attendee; each attendee discharges 150 anxiety (`10` §7.3) | Preacher, families, PC organizing |
| **Ridicule** (`10` humor) | A tall tale about the threat: listeners who trust the teller take Superstition −1 on that prop for 30 days, credence ×80/100, and Heat contributions ×50/100 | Tavern wags, skeptic editors, the PC with Perform |
| **Confession** (`10`) | A holder who confesses envy or guilt to a preacher or confidant discharges anxiety, and their projection loses its fuel (shadow charge falls); the projected belief stops being refreshed | Preacher, confidant |
| **"Own it"** (`10` §7.1, PC only) | With enough Insight, the player can refuse a projection or displacement the PC's psyche produced: the projected belief is reversed and the PC takes the anxiety back | PC |
| **Full pantries** | Want feeds anxiety and anxiety feeds defenses; a good harvest, a relief drive, or the Club pantry lowers A_S (`10` §7.3: hungry towns hunt) | Households, church, Club, PC |
| **Departure/death** | Target leaves → grudge persists against a memory; may transfer to the household | — |

### 9.6 How defenses feed suspicion and the ladder

`00` P7: "Projection and displacement are how a frightened village picks a scapegoat." This is the explicit wiring. `10` §7 owns each defense's trigger, selection, and relief; this table owns where its output lands in 04.

```
misfortune ─▶ real anxiety (10) ─▶ defense fires ─┬─ projection ──▶ Is(c,τ) belief ─▶ Mot + PF terms ─┐
                                                   ├─ displacement ─▶ retargeted Insult/Accuse ─▶ DF term ┤
     agentless misfortune: W(Natural) −50·band ────┘                                                   ▼
                                                              attribution (§5.4) ─▶ Caused(c, m) ─▶ grudge (viaDefense)
                                                                                                        │ P_h × 125%
                                                                                                        ▼
       reaction formation ─▶ Catalyst +30 ─────────────────────────────────▶ Heat, Consensus ─▶ rung (§9.2)
       identification ─▶ credence copying, Recruit ≈ auto ─▶ Consensus ────────────▲    ▲
       rationalization ─▶ "had it coming" Reasons, voiced ─▶ Consensus hardens ────┘    │
       humor ─▶ ridicule variant ─▶ Heat × 50%, credence × 80% ─────────────────────────┘ (damping)
```

| Defense (`10` §7.2) | Lands in 04 as | Effect on suspicion | Effect on the ladder |
|---|---|---|---|
| **Projection** | Belief `Is(c, τ)` or `Feels(c, τ, b)` at credence `5 + floorDiv(PF, 2)`, evidence `Defense{projection}`; juiciness ×130/100 with Moralization when voiced | Attribution gains `2·PF` and a projected motive (`Mot ≥` the projected credence); a projected fae longing becomes a projected `Is(c, kind:faekin)` (§5.8) | Grudges founded on it are `viaDefense` (Heat ×125/100); the projector is a Catalyst candidate (+20) |
| **Displacement** | A retargeted urge (Slight, Insult, Fight, **Accuse**) executed as a normal interaction; a `displaced` store in `10` | Attribution gains `floorDiv(3·DF, 2)`; the safest available target inherits blame for the uncatchable one | A displaced **Accuse** is a rung-2 event like any other. Its victim spawns a **counter-grudge**, so cascades fan out |
| **Reaction formation** | A superego crusade (Expose, Preach at, Accuse, Shun-lobby) at intensity ×150/100; +15 credence on damaging props about the target | The zealot believes harder than the evidence warrants | Catalyst +30. The deacon who wants the widow leads the case against her |
| **Identification with the aggressor** | Copies the aggressor's beliefs at `max(own, floorDiv(theirs × 70, 100) + 20)`; memory distortion favors the aggressor's version | Friends and suspects testify ("even her friend says"), with a plausibility bonus | Recruit (#32) nearly auto-succeeds; Consensus jumps. Suspects under Heat name others to deflect |
| **Rationalization** | Justification belief (`Deserved`, `Necessary`) at 60; Reason "had it coming" (Aff −10, `viaDefense`); marked `voiced` | Spoken rationalizations become rumors defaming the victim | After any persecution act, participants rationalize: Consensus decays slower, defusal DCs +2. Victim derogation is the main post-hoc engine of mob consensus |
| **Denial** | Evidence clamp on one prop | Deniers voice counter-statements ("there's no witch"): dissent nodes in the Commons | Damps until it breaks; a broken denial jumps credence and often cascades into projection |
| **Regression** | An "afflicted" actor (`10`) | The Superstitious read affliction as bewitchment; the afflicted's accusations carry Ordeal-like credibility with believers | The Salem pattern. The sim shows the afflicted as suffering, never as liars |
| **Isolation of affect** | Flat memories; observers form `Is(c, cold)` | "Didn't weep at the funeral" adds Oddness (+20) | Mourners who seem unmoved become suspects |
| **Undoing** | Compensatory gifts, help, compulsive warding | Unexplained gifts from a suspect read as witch charms (#19); visible warding raises notoriety of "whatever she's afraid of" | Can feed or damp; a witch's undoing can lift her own curse (`06`) |
| **Somatization** | A condition with no pathogen | An unexplained symptom invites Supernaturalization ("overlooked," "elf-shot") | A misattribution source like milk sickness: new misfortunes, new M |
| **Humor** | A `ridicule` rumor variant | Listeners' Superstition −1 on the prop, credence ×80/100 | Their Heat contributions ×50/100; enough ridicule lowers local Fae intensity too (`10` §7.2) |
| **Sublimation** | Work, preaching, music | — | A sublimated-rage fire sermon accelerates Heat (§9.3); sublimation into work is a damper |
| **Repression** | A witness who "doesn't remember" | Key evidence locked away; a mesmerist can recover it with Implant risk | A trial can turn on a recovered memory that was never there |

**Dreams** close the loop (`10` §9.3). A hag-riding victim sees the face of their best *malice* projection candidate, so the curse frames whoever the victim already resents, and the face arrives as `Dream` evidence on an `Agent` role at confidence 60.

**At T2** only the socially consequential defenses (projection, displacement, identification, denial, reaction formation) resolve per actor, once a day at most (`10` §14.4). That's enough for a distant town's witch hunt to have a real psychology behind it.

**Worked trace.** `10` §15.1 ("the trembles at Iron Ford") runs this whole table with numbers: projection decides the attribution (share 0.42 vs. 0.34 without it), displacement produces the public Insult, reaction formation produces the preacher-Catalyst who pushes the town to rung 3, identification gets rung 4, and humor plus a doctor's diagnosis pull it back to rung 3. Read it alongside §15.1 below, which shows the same ladder driven mostly by attribution priors.

### 9.7 Mapping hooks for `05`, `06`, `02`, and `11` (C41)

**[DECISION, lead call]** These are the only ways other docs read persecution. They're read-only views; none of them writes a rung.

**`06` witch-facing labels.** Per settlement S, the witch's label is the **highest rung among processes in S that target her actor, any Figure she truly is, or any cover Persona's Figure**:

| `06` label | 04 rungs | What it means mechanically |
|---|---|---|
| Unknown | 0 (or no process) | Misfortunes read as bad luck |
| Whispered | 1 | Usually a process on a Figure ("there's a witch about") with no attached actor |
| Suspected | 2–3 | Named suspects, who may or may not include her known identity |
| Known | 4 | Consensus on one identity, with institutions moving |
| Hunted | 5–6 | An active hunt or mob with a leader |

Processes against **scapegoats** don't raise her label, but `06` reads them for Woe (a scapegoat's suffering pays her through Belief ×2). For the PC, the label is what the PC *knows* (§12.3): `11`'s "Show the rung" setting decides whether it updates live or only when the PC learns of a change.

**`05` alert levels and HearthState.** `alert_level` 0–5 covers **non-person threats only**: wolves, a fire, an epidemic, a flood, a fae incursion treated as a phenomenon. When a threat gets a believed culprit (the wolves were "sent"; the fever was "laid"), the response moves to an 04 process. `05`'s **S6 "Witch panic"** is defined as *any 04 process in S at rung ≥ 5 with a supernatural charge*. HearthState fields that `05` keeps become views:
- **`fear_S`** = `floorDiv(floorDiv(M_S, 10) + floorDiv(A_S, 10), 2)`, 0–100. This is the merge `09` C41 asked for, with `10` §6's definition.
- **`suspicion`** (directed) = for each target, `floorDiv(Heat(T,S), 12)` capped at 100, plus a group term from the Commons (e.g., "faekin live among us" prevalence ÷ 10). It is never a separate ladder, and an ancestry group is never a process target: individuals are (`12` §11.4).

**Read API [PROPOSAL, for `07`].** `processesIn(S)`, `rung(T, S)`, `maxRung(S)`, `witchLabel(actor, S)`, `fearS(S)`, `suspicionS(S, T)`. All are pure reads over 04 state; the Director (`05` §8) reads them for pacing and acts only through its in-world nudges.

**`02`** reads **Notoriety tiers** (§8.6), not rungs, for *Hard Reputation*. Rung 6 trials use `02`'s checks.

**`11`** displays rungs only through the PC's knowledge (§12.3), as the settlement-mood header in the rumor ledger and a label on the region map (`11` §2.13). An accusation against the PC (rung 2+) is a Summons-class alert (`11` §1.6).

---

## 10. Social interactions catalog

**[PROPOSAL]** Data-driven, Comme il Faut style. Each entry has: `intent`, `preconditions`, `volition` (a sum of influence rules; examples shown), a **check** (`02` skills: Persuade, Deceive, Intimidate, Read People, Gather Information, Perform, Trade), `effects`, and the generated memory/rumor. "Aff/Res/Tru/Fear" mean deltas on the *target's* opinion of the initiator unless noted. Every interaction is an Event, so witnesses get memories.

**Volition is an urge, not a decision.** An interaction's volition score becomes the reality appraisal `R` of an option in `10`'s arbitration (`10` §5.2), where drives and conscience vote on it too. A Temper-driven Accuse can lose to a Sabbath thought; a displaced rage urge can make an Insult win that volition alone wouldn't. Volition drivers that name Values (`value:temper`) read the derived views of §3.1.

**Gather Information (C20) [OPEN, `02`].** It's central here (Ask around, the rumor ledger, spread bands), but `02` has no such skill. `09` recommends adding it to `02` as a CHA skill. Until then, 04 resolves it as Read People + Lore (Local), the better of the two.

| # | Interaction | Preconditions | Volition drivers | Check | Success effects | Failure / notes |
|---|---|---|---|---|---|---|
| 1 | **Chat** | Co-located | Company need, Aff | none | Aff +1–3 (volatile), Company | Base glue; may carry 0 rumors |
| 2 | **Gossip** | Acquainted, rumor available | −Discretion, juiciness | none | Transmit rumor (§8.3); Aff +2 if listener likes subject-negativity | If subject is listener's kin: Aff −10 |
| 3 | **Ask around** | — | Intent "find out X" | Gather Info | Speaker reveals beliefs about topic (filtered by Trust) | Too pushy → Belief(Nosy(asker)) |
| 4 | **Deep talk** | Aff > 20 | Company, Trust | none | Aff +5, Trust +3 | — |
| 5 | **Confide secret** | Trust > 40 | Need relief, Neighborliness | none | Trust +10 both ways; listener gains secret (Leverage) | Discretion of listener decides leak risk |
| 6 | **Compliment** | — | Aff, Ambition (flattery) | Persuade | Aff +4, Res +1 | Low Trust → Belief(Flatterer) |
| 7 | **Slight** | Aff < 0 | −Aff, Temper | none | Aff −5 target→init | RimWorld "slight" |
| 8 | **Insult** | Aff < −20 or drunk | Temper, grudge | Perform/Intimidate | Aff −15, Respect ± by audience; rumor juiciness 0.4 | Target Temper roll → Fight |
| 9 | **Fight** (fisticuffs) | Insult or grudge Harm | Temper | Combat (02) | Respect ± by outcome; Fear +; public event | Sheriff interest; injury |
| 10 | **Flirt** | Eligibility (data) | Attraction, Company | Persuade/Perform | Aff +6; Belief(Interested) in target | Rebuffed: Aff −3 initiator; rumor |
| 11 | **Court** (visit, walk out) | Flirt success, family not hostile | Ambition, Aff | Persuade | Courting edge; household opinions update | Family feud → blocked or secret courtship (Scheme) |
| 12 | **Propose** | Courting ≥ N weeks | Aff > 60 | Persuade vs. family | Betrothed; household alliance | Refusal: grudge risk (Rancor) |
| 13 | **Lend** | Has money/item | Neighborliness, Aff, −Thrift | none | Obligation ledger; Aff +5 borrower→lender | Creates future Repay/Default |
| 14 | **Borrow** (ask) | Need | Security need | Persuade | Item/money; Obligation | Refused: Aff −3 asker→lender |
| 15 | **Repay** | Debt | Trust norms, Thrift | none | Clears ledger; Trust +10 | Late repayment: half credit |
| 16 | **Dun** (demand payment) | Creditor | Thrift, aged debt | Intimidate | Repay chance ↑ | Public dunning: humiliation memory |
| 17 | **Bargain** | Trade context | Thrift | Bargain vs. same | Price shift (03) | Sharp dealing → Trust −, Belief(Cheat) |
| 18 | **Help** (labor, chores) | Co-located, need visible | Neighborliness, Obligation | Trade | Obligation +1 favor; Aff +5 | — |
| 19 | **Gift** | Has item | Aff, Ambition, apology | none | Aff/Obligation by value | Gift from a feared or suspect actor → suspicion (witch charm?) |
| 20 | **Warn** | Believes threat to target | Aff | none | Transmit prop with credibility +; Trust + | Creates Told memory citing warner |
| 21 | **Accuse** | Belief credence > 50, grudge or Temper | Temper, −Discretion, voiced | Persuade/Intimidate vs. Will | Public event; rung-2 trigger; audience update | Rebutted → accuser Respect −; target may sue for slander |
| 22 | **Deny / Defend** | Accused | — | Persuade/Deceive vs. Read People | Lowers audience credence | Failed denial raises it (protesting too much) |
| 23 | **Apologize** | Holds belief own fault, or strategic | Piety, Aff, Fear | Persuade | Grudge −; Aff + (§9.5) | Insincere + caught → Trust −15 |
| 24 | **Forgive** | Holds grudge, apology/restitution received | −Rancor, Piety | none | Grudge resolved; Chronicle event | — |
| 25 | **Threaten** | — | Fear wanted, Temper | Intimidate vs. Will | Fear +15–30; compliance | Affection −; may trigger Accuse/Sheriff |
| 26 | **Blackmail** | Leverage on target | Ambition, grudge | Intimidate | Compliance; Obligation forced | Exposure risk; Grudge certain |
| 27 | **Expose secret** | Knows secret | Grudge, Piety (moral) | Perform/Persuade | Secret → rumor at high juiciness; target Reputation − | Exposer gains Belief(Tattler) among some |
| 28 | **Lie** | — | Scheme, self-protection | Deceive vs. Read People | Lie-received evidence | Caught: Belief(Liar), Trust −20 |
| 29 | **Preach at** | Piety ≥ 2 or Preacher | Piety, target's perceived sin | Persuade/Perform | Target Piety-drift roll; audience Respect ± | Worldly targets: Aff − |
| 30 | **Pray with / Comfort** | Grief/Fear in target | Piety, Aff | Persuade | Mood +; Aff +8 | — |
| 31 | **Intercede** | Third party with Trust | Peacemaker, Aff for target | Persuade | Holder grudge −; transfers Trust stake | Failure: intercessor taints by association |
| 32 | **Recruit** (to hunt/petition) | Rung ≥ 3 process | Grudge, Ambition, Firebrand | Persuade/Intimidate | Holder joins process (P_h → 1.0) | Refusal noted: refuser becomes suspect sympathizer |
| 33 | **Shun** (refuse service/greeting) | Shunning active | Compliance (§9.2) | none | T humiliation memory; Security − | Visible: everyone present notes compliance |
| 34 | **Swear oath / testify** | Hearing/trial | Piety, Trust | Persuade/Deceive | Statement credibility ×1.5 (Piety-weighted) | Perjury discovered → disaster |
| 35 | **Toast / stand drinks** | Tavern | Ambition, Company | Cha | Aff +3 to all present, Obligation +0.2 each | Drunkenness → Discretion −1 for evening |
| 36 | **Tell tale** (story of deeds) | Has notable memory | Standing need | Perform | Respect + if believed; spawns rumor about teller | Boasting → Belief(Braggart) if implausible |
| 37 | **Test** (demand an ordeal; `12` §7.5) | Suspects target (credence > 30) of a kind or of witchcraft; a gathering or an office | Superstition, Fear, grudge | target's Will vs. the test's DC, or the test's rates | Witnesses get `Ordeal` evidence by the test's true/false-positive rates | **Refusal** is evidence (strength 15). The Explain shows the rates (P1) |
| 38 | **Confess** (`10`) | A preacher, priest, or confidant with Trust > 40 | Moral anxiety, piety | none | One-shot anxiety discharge; shadow charge falls | The secret now carries leak risk by the hearer's Discretion |
| 39 | **Mock** (`10` humor) | An audience; a fear-rumor or a pompous target | Humor style, Temper, drink | Perform | Spawns a `ridicule` variant; listeners' Heat contributions ×50/100 (§9.6) | Mocking the pious in church: Aff −, Respect − with believers |
| 40 | **Read a dream** | Target told a dream | Dream-Reader Calling, Lore | Read People or Lore (Mental Philosophy) | Interprets the dream as a prop with `Dream` evidence; band-level read of the dreamer's thoughts (`10` §8.5) | A misreading is a confident wrong prop |
| 41 | **Mesmerize** (`10` §12) | Willing or entranced subject | Mesmerist role, Ambition | Perform vs. Will | Recovers a repressed memory; discharges anxiety; plants a suggestion (`Implant`) | The mesmerist's beliefs bleed into the "recovered" memory |
| 42 | **Penance** (`10` undoing) | Guilt about a specific harm | Moral anxiety | none | A compensatory act or public penance; discharges guilt | Unexplained penance by a suspect reads as admission |
| 43 | **Disclose** (come out; `12` §7.7) | Holds a concealed-kind Secret | Trust, Persona strain, Company | Persuade | Public event; each witness updates by their own priors and opinions; strain ends | Never automatically fatal. Opens or feeds a process only through ordinary beliefs |

Volition example (Accuse), integer: `+30·[grudge ≥ 60] + 10·Temper − 10·Discretion + 15·[voiced already] + 20·[M ≥ 500] − floorDiv(25·Fear(target), 100) − 20·[target is kin]`, proposed as an urge if it passes `> 40`. In arbitration, a displaced rage thought supports it and a `piety` or `neighborliness` thought may oppose it.

---

## 11. Off-screen social life at LOD tiers

**[DECISION]** Same data model at every tier (§1). Tiers per `00` and the ADR: T0 live on the site map, T1 hourly steps, T2 daily steps with 6-hour sub-steps for rumor and weather. **Ownership (C40):** `05` owns tier *policy* (who is at which tier, relevance, pinning), `07` owns the *mechanism* and budgets, and **04 owns social hydration**: what social state looks like at each tier and how it's reconstructed on promotion (this section).

### 11.1 T0: live conversations

- **Clock (C21).** Canonical time is integer game-minutes; a live site adds a sub-minute clock of game-seconds within the current minute (`07` §3.4, tenth-second resolution). Social timing uses it: every 30–90 game-seconds an idle or co-working actor schedules a `social_tick` event on the T0 queue, picks a partner within 6 tiles (Company need, Aff, Intents), then proposes interactions by volition to `10`'s decision-point arbitration.
- Interactions are short timed actions (2–10 game-minutes) shown as **speech-bubble labels** (RimWorld-style) carrying *content*: `Gossip ▸ Kass widow`, `Dun ▸ $4 flour`, `Accuse!`, `Flirt`. The label is a tap or click target into the interaction record (`11` §2.12).
- Bystanders within earshot roll Perception (02) to **overhear** (Overheard evidence). Eavesdropping is a PC verb.
- Full-fidelity memory creation, distortion rolls on rehearsal, immediate opinion updates.
- Gatherings run as **practices** with roles: a church service has preacher, congregants, choir, and latecomers; a bee has host, workers, and children. Practices schedule interaction slots and norms.

### 11.2 T1: activity-scheduled encounters

- T1 steps **hourly** (ADR). Each T1 actor has an **Activity** lasting 1–8 hours (`05`'s scheduler, chosen by `10`'s hourly arbitration: work field, mill run, tavern, church, visit kin, peddle route). Venues advertise social affordances (Sims-style smart venues).
- **Encounter pooling:** actors sharing a venue during an activity span form a pool, resolved at the hourly step when the span ends (or every 4 hours for long spans). Each actor draws `k = floorDiv(Sociability × venue_factor%, 100)` partners (Sociability from the Neighborliness view, Company need, and drink), weighted by acquaintance and Aff, with no all-pairs scan: sampling goes from the actor's top-N ties present plus 1 random stranger slot.
- Each encounter resolves **one** interaction by volition (as an arbitration option for the initiator). Checks are full d20s (cheap), producing:
  - memories for both participants (with `when` = the span, consolidation-friendly),
  - 0–1 rumor transmission,
  - opinion reasons,
  - witnesses: 0–2 sampled from the pool, with Overheard memories.
- Big events (fights, accusations, proposals) are flagged **notable** and logged for the Chronicle and Director at full detail.
- Budget: about 3 encounters per actor-day on average, 8 on gathering days.

### 11.3 T2: compartment diffusion

T2 actors are still named, but only their **key state** is individual: household, ties (top 15), key opinions (top 10, compressed reasons), grudges, secrets, and beliefs about **notable** props. Ordinary rumor spread is computed at the **compartment** level:

- Compartments: households ⊂ congregations/language groups (and closed societies: Hall, Club, Lantern) ⊂ settlement. For each (rumor variant, compartment), store `prevalence p` (‰) and `mean credence` (0–100).
- Update on each **6-hour sub-step** (`00`, ADR), a network SIR with mutation:
  `Δp_c = β_c·(1−p_c)·Σ_d A_cd·p_d·juiciness − γ·p_c` where `A` is a sparse compartment-contact matrix derived from channels (church weekly spikes, market day, bees). `γ` is forgetting. Mutation splits a fraction `μ` into child variants. It's polynomial, so no table is needed. **Integer form (C49):** `β, A, juic, γ, μ` are per mille; prevalence is kept internally in parts per million (`q`, 0–10⁶) so small flows aren't floored away, and exposed as ‰. Per sub-step, with every intermediate product under 2⁵³:
  ```
  S_c = Σ_d floorDiv(A_cd × q_d, 1000)                 // contact-weighted prevalence, ppm
  t   = floorDiv((10⁶ − q_c) × S_c, 10⁶)               // susceptible × exposure, ppm
  q_c += floorDiv(β_c × t × juic, 10⁶) − floorDiv(γ × q_c, 1000)
  ```
- **Psyche at T2** (`10` §14.4): a daily coarse anxiety step and at most one defense per actor per day, with projection, displacement, identification, denial, and reaction formation resolved individually. A T2 projection writes a real belief and can individuate a Catalyst.
- Inter-settlement flow comes from carrier events (peddler arrives, the newspaper reaches subscribers, a letter), which are discrete and logged.
- Persecution processes run at T2 with aggregate Heat and Consensus from compartment beliefs plus individually held grudges. **Individuation:** when a T2 process wants a Catalyst, it **selects a named actor** whose sheet fits (the T2 actor with the highest grudge × Temper) and records a notable event attributed to them. Off-screen consequences get faces.
- Grudge-pair pressure: T2 rolls a daily `incident` for every active grudge (p ∝ intensity × proximity). Incidents become notable events between named actors.

### 11.4 Promotion: coherent backlogs

**[PROPOSAL]** Lazy, deterministic hydration.

**T2 → T1** (the player is heading there, or the actor became relevant):
1. **Beliefs:** for each rumor variant with prevalence p (‰) in the actor's compartment, the actor holds it iff `mod(hash(actor_id, variant_id, seed), 1000) < p`. That's deterministic, so repeated promote/demote cycles agree. Credence ~ compartment mean ± personality (Superstition for supernatural props, Aff toward subject).
2. **Source backfill:** each held belief gets a synthesized `Told` memory. The source = the highest-weight tie in a compartment where p was highest at the earliest time, and `when` = the first day the actor's compartment p crossed 0.2 (stored as a compartment time series; cheap). Venue = the dominant channel that week (church, market). Result: "Heard it from her sister-in-law after church, mid-May."
3. **Opinions:** compressed reasons inflate back into Reason records citing synthesized Summary memories.
4. **Notable events** in which the actor was individuated are already real memories. That includes T2 **defense events** (`10` §14.4): a projection or displacement that fired off-screen is a real event, and backfill may cite it as a belief's origin.
5. **Psyche:** thoughts are recomputed from state; anxiety, defense style, shadow charges, and masked thoughts persist (`10` §14.4).
6. **Mark synthesized memories `synthetic=true`** (debug only). They're first-class from then on.

**Census → named:** a census member materialized for a story (§13.3) gets the same backfill from their compartment, so the boy who saw her on the bluff road has heard what his household heard.

**T1 → T0:** positions from the current Activity, mid-activity state, and recent volatile opinion. Memories are already individual. Pending interactions (an Intent to Dun) start as queued T0 actions, so the farmer who planned to confront you does so *when you arrive*.

**Demotion (T0/T1 → T2):** consolidate memories aggressively; individual beliefs about non-notable props fold into compartment prevalence (they increment p by 1/|compartment|); keep top-K reasons; keep everything `pinned`.

**Consistency rule:** anything the PC observed is pinned, and synthesized backfill may never contradict a pinned memory or an event-log notable. Backfill sources are chosen among actors whose own state is consistent (they must hold the belief earlier).

**[DECISION, adopted into `00`] Tiering by relevance.** v0.1 challenged `00`'s purely geographic tiers; `00` now says tier is set by relevance as well as distance. For the social sim, tier = `max(geographic tier, relevance tier)`. Relevance = holds a grudge or persecution role against the PC, is kin or a close tie of the PC or a companion, is a recurring nemesis, is a Catalyst or leader of a process at rung ≥ 3, or is involved in an active notable process. A witch-finder 40 miles away who is hunting you should be T1. This keeps the people who matter to the story from going statistical. Budget impact is small (≤ 50 extra T1 actors). `05` owns the policy.

---

## 12. Player-facing UX

**[DECISION]** UX shows the PC's beliefs, not ground truth (P1 legibility applies to what the PC *could* know).

**Division of labor with `11`.** `11` owns layout, gestures, time policy, and the three layouts (Pocket, Folio, Desk) built from shared panels. This section owns the **knowledge semantics**: what each panel may show, at what accuracy, and what gates it. Every number comes from core with its Explain record, and the Explain's `knowledge` level (`public | participants | self | omniscient`) decides whether it's shown at all (`11` §1.5, "the legibility ladder"). Every UI action is also a headless Command (ADR 0002).

### 12.1 Character dossier

Opened by selecting an actor. On Pocket it's a bottom sheet with Peek/Half/Full detents and tabs **Mind · Body · Of you · Known · Pack** (`11` §2.3); on Desk it's the Inspector panel. Sections, as 04 defines their content:

- **Header:** name or descriptor ("the miller's wife," if the PC doesn't know her name), household, known roles, and her **presented** people (never her true one, §5.8).
- **What she thinks of you:** five bars, with **known reasons** as a list ("Insulted her husband at the store (−12 Aff)," "Repaid your debt promptly (+8 Trust)"). Unknown contributions appear as a hatched "**?** (other reasons)" segment. Accuracy is gated:
  - Bars are shown as *bands* (Cold / Wary / Neutral / Warm / Devoted) unless the PC passes Read People vs. DC (10 + her Deceive, or + Discretion×2 for concealment). Success shows numbers ±10.
  - Reasons the PC was present for are always known. Others need investigation (Gather Information, asking her friends, a fae oracle, *her telling you* when Trust is high enough).
- **What you know about her:** the PC's beliefs about her, each with credence shown as wording ("you're sure," "you've heard," "a rumor says"), plus source links. Kind beliefs ("you've heard she's of the hidden folk") appear here like any other belief; there's no exposure meter (`11` §2.9).
- **What you read in her** (the NPC Mind tab, `11` §2.3): the PC can't hear other people's thoughts. Read People successes yield *inferences* with credence words ("she wants to be rid of you," "something shames him about the store's books"). Ego strength, anxiety, and defenses show only as inferred bands. Full NPC minds are for the epilogue and God view.
- **Her ties (known):** the mini relationship web.
- **Pack / Pantry:** what the PC knows of her inventory and household pantry, as dated beliefs (§7.2).
- **Actions:** contextual interactions with predicted odds ("Apologize: likely ~65%"). The number is gated by Read People like the opinion numbers.

### 12.2 Rumor ledger ("what's being said about you in Iron Ford")

`11` §2.4 lays it out as **Talk of the County**, grouped by settlement. Populated only from what the PC has heard or overheard, or learned by Gather Information:
- Each entry: the variant text (templated from the prop), where and from whom heard, **estimated spread band** (only a few / several households / the talk of the town / everyone knows, from Gather Information DC by prevalence), **trend** arrow if heard multiple times, and **versions** (variant tree, collapsed).
- Actions per rumor: *Counter* (deny publicly at a gathering), *Find the source* (an investigation chain: ask whoever told you who told them, i.e. Bad News-style legwork), *Feed it* (embellish), *Plant a rival rumor*.
- A **Figures** section (every mode; most used in witch mode) lists each rumor identity the PC knows of: what's said about it, its believed notoriety tier (§8.6), and who people think it is (the PC's estimate of the `IsFigure` distribution). A witch's cover identities appear here as alternate Figures (`11` §2.13).

### 12.3 Settlement mood

A diegetic one-liner plus detail: "Iron Ford is **uneasy**: cattle sickness, two families accusing the Kass widow." It maps to M, A_S, and the highest known process rung, shown as wording, with numbers available under a PC skill check or Gather Information. It's the group header of the rumor ledger (`11` §2.4).

**Witch-mode notoriety display [OPEN, v0.1 Q3; `11` proposes].** The witch-facing label (§9.7) appears per settlement in the ledger header and on the region map. `11` §2.13 proposes a **"Show the rung"** setting: off by default in Frontier and on in Settler. When it's off, the label updates only when the PC *learns* of a change (a friend's warning, a sermon, a notice nailed up), which is 04's knowledge rule. When it's on, the label tracks the true rung: a deliberate, opt-in P1 relaxation. 04 supports either; the label is computed from §9.7's `witchLabel` and filtered by the PC's knowledge unless the setting is on.

### 12.4 Relationship web

A graph view of the PC's known actors. Edges are colored by dominant dimension (with a pattern as well as color, `11` §6), and dashed edges are ones the PC is unsure of. Filters: household, congregation, grudges, debts. Nodes the PC knows only by descriptor show as silhouettes. On Pocket it opens from the dossier's mini web (5 nodes) to full screen.

### 12.5 Chronicle

The run's readable history (P5). **[DECISION, C44]** `05` §11 owns the Chronicle (voices, knowledge basis, epilogue). 04 supplies belief data for sifting. During a run, entries are written from what the PC knows ("You learned..."). Ground truth appears only in the **post-run epilogue** ("What really happened"), including every defense label and every concealed people. `06`'s side-by-side rumor-vs-truth view belongs to the epilogue, not to play. **[PROPOSAL]** The post-run "truth reveal" is the payoff for a hidden-information sim: you finally see that the Brandt cows died of milk fever and that the whole Kass affair was a story. (Whether it spoils legacy play in the same World is still Q9.)

### 12.6 Notifications

Opt-in, belief-gated toasts: "**Mrs. Haas has started telling people you soured her milk.**" These fire only when the PC learns it (overhears, is told by a friend who has Aff > 30 and Discretion < 1, reads it), never at the moment it happens off-screen. `11` §1.6 turns each into an integer **alert score** that decides pause behavior; an accusation against the PC (rung 2+) is a Summons and always pauses. **[PROPOSAL]** Friends report to you. Cultivating Discretion-low friends is how you build an intelligence network. That's a real strategic layer.

### 12.7 Debug / God view

The full truth: all opinions, the rumor heat-map across the region, lineage trees, attribution distributions with every term (including `PF`, `DF`, and the faekin term), defense provenance, true peoples. It's needed for development, and maybe as a "storyteller sandbox" mode. `11` §2.14 puts it under Debug, opt-in and Chronicle-tagged. The map's **Suspicion overlay** outside the God view shows only the PC's beliefs (`11` §2.2).

### 12.8 Self-knowledge: the PC's own mind and kind

- **The PC's own defenses** are hidden by default (`10` §1, §8.5). A projection the PC's psyche produced looks to the player like an ordinary Inference ("you've come to think she envies you"). Insight stages, or a Read People check on oneself, reveal the label ("*Laying it at another's door?*") and offer **Own it** (§9.5). This is the most interesting P1 consequence of P7, and `11` §2.3 asks Ellie to confirm it (`10` Q1, `11` Q3).
- **The PC's Shadow** starts hatched in the Mind tab (`11` §2.3) and reveals traits one at a time.
- **The PC's own people** follows the creation option (§5.8): known, suspected, or unknown to the PC, with tells reaching the player as unexplained experiences in the last case.
- **Implementation note:** the code's psyche view currently shows the PC's `recentDefenses` and `shadow` directly, which breaks this rule (`10` §14.5 item 4).

---

## 13. Performance and scale

### 13.1 Budgets

**[DECISION, ADR; `11` §5, `07` §6]** The sim is TypeScript in a Web Worker, and phones are an equal target. Outcomes are platform-independent: a slower phone runs the same sim slower, never a coarser one. Scale is set by the **World size** chosen at creation (C9, C2):

| World size | Named actors (soft ceiling) | T1 cap | T0 cap |
|---|---|---|---|
| Small ("A Coulee") | ~400 | 250 | 150 |
| **Standard** ("A County", default) | ~800 | 400 | 150 |
| Large ("The Long County") | ~1,500 | 600 | 150 |

`11` owns the presets and the per-device worker budgets; `07` owns the sim-side budgets. **[PROPOSAL]** The social sim's share, on the mid phone at Standard:

| Tier | Actors | Ticked | Social share (mid phone) | Memory per actor |
|---|---|---|---|---|
| T0 | ≤ 150 (typically 20–60 social) | `social_tick` events every 30–90 game-s each, event-driven | ≤ 5% of one core at 1× | ≤ 300 memories, ≤ 60 opinions × 8 reasons, ≤ 400 beliefs |
| T1 | ≤ 400 | hourly steps; encounters resolved at activity-span ends | ≤ 15 ms of `11`'s ≤ 40 ms per T1 hour step | Same caps, consolidated weekly |
| T2 named | the rest of ~800 | daily minds, 6-hour rumor sub-steps | ≤ 60 ms of `07`'s ≤ 150 ms T2 day; sub-step ≤ 6 ms | ≤ 20 memories, ≤ 10 opinions, notable beliefs only |
| Census | 3,000–4,000 counts | — | Per-settlement aggregates | none; individuated on demand (§13.3) |

The ADR's M2 gate (< 5 ms per game-hour for 30 T1 actors on the mid phone) covers social plus psyche. At ~6 KB per T0/T1 actor and ~1 KB per T2 actor, Standard's social state is ~2–3 MB, well inside `11`'s 120 MB worker heap.

### 13.2 Avoiding O(n²)

- **Opinions are sparse:** an actor holds opinions only toward acquaintances (Dunbar-capped at 150, typical 30–60) plus groups and figures. No dense matrices.
- **Encounters by venue buckets and tie lists,** never all-pairs (§11.2). T0 uses a spatial hash for earshot.
- **Rumor diffusion at T2 is compartment-level** with a sparse contact matrix (`O(edges × active variants)`).
- **Interned propositions:** beliefs are `(prop_id, credence 0–100, carry, evidence_ptr)`. Commons per settlement is a map over props with prevalence > 0, iterated in id order.
- **Lazy salience:** memories store `s0, tRef` and compute salience on read (§4.3), so there's no per-day decay pass over every memory.
- **Kind beliefs are sparse:** nobody stores "she's human." Only evidence creates an `Is(x, kind)` belief (§5.8), so concealed peoples cost nothing until someone suspects.
- **Lineage ids** make the novelty discount O(evidence count), not a graph search.
- **Heat** is incrementally maintained per (target, settlement) on grudge change. It's not recomputed by scanning.
- **Attribution** is computed only on new misfortune or evidence, over ≤ 30 top candidates (acquaintances ranked by a cheap prior).
- **Event log** is append-only, columnar, and sifted incrementally (Chronicle and Director subscribe to patterns rather than scanning).

### 13.3 Census individuation

Settlement population beyond the named set is a count by age/sex/household-type (and people and culture, `12` §2's priors). When a story needs "the boy who saw her on the bluff road," an actor is individuated with a deterministic seed and a backlog from compartment state (§11.4). **[DECISION, `00`]** Census materialization is canon: the population exists as a census and sheets are materialized lazily. `07` §5.3 owns the generator, and census identity is independent of when someone is materialized. v0.1's Q8 (census vs. all-named) is closed; the remaining scale question is `07` Q3 (confirm World size as the only lever).

### 13.4 Determinism

**[DECISION, ADR]** Same seed + same commands ⇒ the same event log and state hash on every JS engine. All randomness goes through the counter-based `rng(seed, stream, tick, key)`. The social sim uses the existing streams `social`, `gossip`, `memory`, `belief`, `rumor`, and `suspicion` (tells and ordeals), keyed by `mixKey(actor or process, minute, salt)`, so replays, the save/promote cycle, and the hash-based hydration in §11.4 are reproducible. Iteration is by id; comparators are total (attribution ties break by actor id). `07` owns the implementation.

### 13.5 Integer forms at a glance (C49)

**[PROPOSAL]** Every formula in this doc, in the form core implements. No `exp`, `log`, `pow`, or trig in core; tables are generated offline and committed (`07` §4.2).

| Formula | Model | Core form | Approximation note |
|---|---|---|---|
| Memory salience decay (§4.3) | `s₀·e^(−Δt/τ)` | Lazy `decayQ16(Δt, τ)` from `EXP_NEG_Q16`, integer τ | < 2/65536 absolute; below one salience point |
| Grudge drift (§6.3) | exponential, τ = 60 d × (1 + R) | same lazy form; `decay` flag for C12 | same |
| Misfortune pressure M (§3.3) | decaying event sum | `decayQ16` at τ = 30 d, per mille | same |
| Credence (§5.3) | log-odds sum | `LOGIT_Q8` + Q8 weights + nearest index + int8 carry | exact to table rounding; carry preserves sub-point residue |
| Attribution (§5.4) | normalized weights | integer centi-weights; share per mille | exact |
| Rumor telling (§8.3) | `σ(k·(score − 0.5))` | `SIG_PERMILLE` lookup, interpolated | < 0.2‰ |
| Mutation chance (§8.5) | product of factors | per-mille integer product | exact to floor |
| Heat, Consensus, thresholds (§9.1) | sums and products | integer tenths/percent/per mille | exact to floor |
| Notoriety, Reputation, tiers (§8.6) | weighted means | per mille; tier table | exact to floor |
| T2 diffusion (§11.3) | network SIR | ppm accumulators, 6-h sub-steps | Euler step; error well under parameter uncertainty |
| Projection/displacement terms (§5.4) | `10` fits | integer `PF`, `DF` from `10` | exact |
| Kind priors and tells (§5.8) | `12` priors and strengths | integer credence; Q8 tell weights | exact |

---

## 14. LLM integration options (optional layers)

**[PROPOSAL] Principle:** the LLM is a **renderer, never an authority**. Simulation state is structured and deterministic, and LLM output is view-only. It can't create props, opinions, or events. The game must be fully playable with every layer off. `07` §10.3 owns the adapter (timeouts, template fallback, proper-noun post-check). Knowledge gating applies to prompts too: an L1 bark gets the speaker's beliefs and *masked* thoughts, never `10`'s defense labels or anyone's true people.

| Layer | What it does | Input | Value | Risks | Mitigation |
|---|---|---|---|---|---|
| **L0 (baseline, always)** | Templated grammar (Tracery-like) renders props, barks, ledgers, chronicle | Structured records | Free, offline, consistent | Repetitive prose | Large authored template banks; dialect variants per Old Country group |
| **L1 Barks & conversation rendering** | Turns an interaction record (`Dun ▸ $4 flour`, speaker values, opinion bands, cited memories) into 1–3 lines of period-voiced dialogue | Speaker's *beliefs only* + interaction + mood | Characters sound like they remember; nemesis-style callbacks for free | Latency (bubbles need < 1 s, or else prefetch); leaking facts the speaker doesn't know | Feed only the speaker's belief slice; prefetch on T0 entry; cache by record hash; fallback to L0 on timeout |
| **L2 Documents** | Weekly newspaper, letters, sermons, wanted posters, trial transcripts | The editor's/writer's beliefs + which variant they print | High: documents are artifacts the player reads and keeps; period pastiche is a strong LLM skill | Hallucinated claims in a doc the player treats as in-world evidence | **Claim validation:** the doc's facts come *from* a structured list; post-check named entities and numbers against inputs; reject or retry; the sim already decided what the doc asserts |
| **L3 Chronicle prose** | Run summary, "legends" retellings, the post-run truth reveal | Sifted event log + belief data | Very high: the P5 payoff is narrative | Low risk (non-interactive) | Generate at retire/death; can run offline with a local model |
| **L4 Free-text player speech (experimental)** | Parse player text into an interaction intent plus a prop | Text → constrained schema | Expressiveness | Façade problem: brittle, exploitable, breaks legibility | Classifier only, mapped to the catalog; always show the parsed intent for confirmation. **Not recommended for v1** |
| **Authoring-time** | Generate L0 template variants and period vocabulary offline; human-curated | — | Cheap content volume, zero runtime cost | Quality control | Review pipeline |

Tradeoffs: per-bark API calls at T0 density (~1 bubble/sec visible) are too costly and too slow, so L1 should render **only clicked or focused** bubbles, or run a small local model. Documents and chronicle are low-frequency and high-value, which makes L2/L3 the best ROI. Offline play rules out a hard dependency, so a local-model option (small instruct model) for L2/L3 is plausible. **Consistency:** the same record should render the same way on re-view, so cache by `(record_id, layer_version)`. **[OPEN]** Does Ellie want L2/L3 as a shipped feature, a mod hook, or a dev-only toy? (Same question as `07` Q7.)

---

## 15. Worked stories

Numbers are illustrative but follow the formulas above. They're shown as decimals for readability; the integer forms (§13.5) reproduce them within rounding. **Names and places are illustrative, not canon (C7).** They predate `01`'s Hollin County cast; the names pass will move them into the county (Viroqua and Readstown are real towns, which `01` keeps off-map). v0.1's "Rev. Whitcomb" is renamed **Rev. Ashby** to avoid colliding with `01`'s surveyor Amos Whitcomb.

### 15.1 Witch mode: "The Brandt cows" (rungs 0→5, wrong suspect)

**Cast (Rush Creek settlement, ~180 people):** **Marit** (PC witch, cover: hired girl at the Lund farm). **Heinrich Brandt** (dairy farmer; Temper +2, Superstition +2, Rancor +2). **Ottilie Kass** (widow herbalist, lives alone at the creek mouth; Parochialism-relevant: speaks poor English; quarreled with Brandt in March over a strayed sow). **Mrs. Pfaff** (Discretion −3, `Gossip`). **Rev. Ashby** (Methodist circuit rider; Piety +3, Temper +1). **Sheriff Rude** (legalistic, Superstition −1). Starting M = 0.2. (Value numbers are the derived views of §3.1. This run predates `10`, so it shows the attribution-prior engine with A_S and defenses left out; `10` §15.1 runs the psyche version.)

**Day 1 (T1, night).** Marit casts *Sour Udder* on Brandt's herd (`06`'s curse economy: it yields Woe). Event `E101: Curse(Marit → Brandt cows)`. No witness: Brandt's son Karl, 11, was in the barn loft, but his Perception (sight) roll failed against Marit's concealment. He did roll a Perception (hearing) success, so he gets a memory: `{kind: Strange-sound, roles: [{who: Descriptor("a woman singing low"), role: Agent?, role_conf: 0.3}], intensity 45, confidence 0.4}`.

**Day 2.** Three cows dry and one dies. Brandt: `Memory{kind: Misfortune(livestock), intensity 70}`. Attribution runs (Brandt, Superstition +2, M 0.2):

| Candidate | Terms | Weight |
|---|---|---|
| Natural | 2 + 1.5·(−2) + 0 + 0.8 = −0.2 | **0.5** (floor) |
| Ottilie Kass | 1 + 1.5·Odd(1.0) + 1.0·Outsider(1) + 0.02·45 + 2·KnownMagic(0.5: herbalist) + 1.5·Motive(0.8: the sow quarrel) | **6.6** |
| "the Bluff Witch" figure | notoriety 0.15 × 4 | **0.6** |
| Lund household | Motive 0, Odd 0 | 1.0 |
| (others, 6 acquaintances) | | ~1.0 each |

Kass share = 6.6/14.7 ≈ 0.449 (449‰ in integers) and leads the next by >1.5×, so `Belief(Caused(Kass, cows), 0.44)`. Then Karl tells his father about the singing (Told evidence, trust 1.2), and plausibility for "a woman" fits Kass. Credence → logit(0.44) + 0.8·1.2·0.6 → **0.58** (integer: L = −62 + 147 = 85 → 58, §5.3). Grudge spawns (Aff −52, memory intensity 70, Rancor +2): `aim: Expulsion` (Temper +2 and Piety +1 → not Harm yet), intensity 62.

**Day 4 (Sunday, church steps).** Brandt is voiced to his wife (P 0.7). His wife tells Mrs. Pfaff. Mrs. Pfaff (topic_score high: juiciness 0.7 × Discretion −3 bonus) seeds variant v1 to 5 listeners over the morning. Mutation roll on the third telling: **Exaggeration**: "*all* his cows." Heat(Kass) = 62·2·0.7 = 87, plus 4 new holders at ~20 intensity × 1 × 0.3 = 24 → **111**. Rung 1 (Whispers).

**Day 9.** A second misfortune unrelated to Marit: the Gundersons' baby has croup. The doctor is away. M → 0.35. Mrs. Gunderson (Superstition +1) attributes with Kass already in her beliefs at credence 0.5 (from rumor: PriorAccused term +1). Kass share 0.41 → a second grudge, intensity 55. **Heat 287**.

**Day 11 (store).** Brandt, drunk the night before and still sour, rolls Accuse volition: 30 + 20 + 15 (voiced) + 0 (M 0.35 < 0.5) − 5 (Fear of Kass) ≈ 60 > 40 → **Accuse** at the store, with 7 present. Kass's Defend: Persuade +2 vs. the audience's Read People, penalized by language (−4). She fails. The audience updates with Observation-of-accusation (it's a Statement in content but publicly committed: ×1.2). **Rung 2.** The thresholds are scaled by (1 − 0.35·0.35) = 0.88, and Heat after the accusation is 380 with Consensus 0.31.

**Day 16.** Marit, wanting Kass blamed (06 lets the witch exploit scapegoats), plants a hawthorn-and-hair charm in Kass's woodshed. The next search will produce Physical evidence. Meanwhile Rev. Ashby arrives on circuit. He hears from three congregants, but the novelty discount bites (two derive from the Pfaff lineage), so his credence ends at 0.52. Piety +3 and Temper +1 → `Sermon` volition picks the frame "suffer not a witch," weighted down because his Superstition is only 0. He compromises on a **"sin among us"** sermon without a name. That still gives Statement-like evidence at 1.4 credibility toward a generic prop that raises everyone's Superstition-weighted plausibility. Consensus → **0.42**, Heat 520. **Rung 3, Shunning:** the storekeeper (patron of 6 client families) refuses Kass credit, and Kass's flour costs +40%.

**Day 23.** Karl and two boys "search" the woodshed and find the charm (Physical, base 1.5). Credence among 30 adults who hear it: +0.15 average. Consensus **0.57**. Brandt petitions the sheriff, on the mundane charge he can name: that she poisoned the herd (§9.2, C13). **Rung 4.** Sheriff Rude's evidence threshold is 0.7 from Observation or Physical evidence. His credence is 0.61 (Skeptic −1 dampens), so he *refuses to arrest*, which is restraint. That's a notable event and gets logged.

**Day 26.** Another curse from Marit (she needs Woe for the Tithe) falls on the Pfaff hens. Heat jumps to **840**. Brandt (aim updated to Harm: grudge 88, Temper +2) recruits 9 men at the tavern. **Rung 5: hunt.** They plan a charivari at the Kass place on Saturday.

**Branch point for the player.** (a) Let it happen: rung 6 resolves at T1, Kass's cabin burns, and she flees to Readstown. Heat on the Bluff Witch figure *falls* (attributions have resolved), and the Prince is pleased (06). (b) Intervene in disguise: kill the Natural explanation, or plant better evidence on someone else. (c) Intervene as Marit: bring the sheriff Kass's alibi (Marit saw her at the Lund kitchen that night). That's a Statement worth ~0.8 × Trust 1.1 to the sheriff, and he forms `Protect`. But Marit now has a voiced connection to the affair, and her own Oddness term ticks up. Note the asymmetry: the true culprit's best protection is a suspect who looks like a better fit than she does.

**With the psyche on (`10`).** The same days read differently once minds have defenses. Brandt's rage at an agentless misfortune is a **displacement** candidate, so his Day 11 Accuse can come from a displaced urge even if his volition had fallen short, and his grudge then counts at P_h ×125/100. Mrs. Gunderson, frightened for her baby, is the likeliest **projection** (her anxiety band also docks the Natural weight). If Rev. Ashby carried a forbidden fondness for the widow, **reaction formation** would turn his nameless "sin among us" sermon into a named one (Catalyst +30). And after the charivari, the participants **rationalize** ("she had it coming"), so the step-down is slower than Heat decay alone would give. Witch-facing, Marit's label in Rush Creek (§9.7) never rose above *Whispered*: the process with real Heat targeted Kass.

### 15.2 Adventurer mode: "Who killed the hodag"

**Cast (Viroqua):** **PC** (newcomer, Notoriety 50‰: tier 1). **Amos Pell** (trapper; Ambition +3, Discretion +1, Respect-hungry). **Editor Sloane** of the weekly *Bad Axe Clarion* (Superstition −1, likes Pell: Aff +30, drinks with him). **Sophie Vang** (store clerk, Discretion −2, Aff toward PC +25 after the PC tipped her).

**Week 1, Day 3 (Wilds, T0).** The PC kills the hodag in Hemlock Coulee. No human witnesses. A fae observer (a court spy) holds `Memory(Kill, PC)`. The PC keeps the **horned head** (an item with `Provenance(E220)`), sells the hide in Viroqua, and moves on to a 9-day expedition.

**Day 4 (Viroqua, T1).** The hide sale: the storekeeper witnesses it, and his Belief(Killed(**"the stranger"**, hodag)) has credence 0.55 (Physical but ambiguous: a hide can be bought). Sophie overhears. Variant v1 born: "A stranger brought in a hodag hide." Notoriety of figure "the stranger with the hodag hide" ≈ 80‰ (tier 1).

**Day 5 (tavern).** Pell hears v1. His Ambition and Standing need are starved (Respect toward him low). **Scheme: claim credit.** He tells the tavern he wounded it last week and "that stranger just found it dying." That's a Lie with Deceive +6 vs. drinkers' Read People, and 7 of 9 fail. Variant v2 (Attribution drift, induced): `Killed(Pell, hodag)` with the PC as Beneficiary. Pell's partner corroborates. That's a second Statement, but from Pell's lineage, so the novelty factor is 0.67.

**Day 7.** Sloane prints v2 in the *Clarion*: "Local Trapper Bests Fabled Beast." Credibility 1.3 for 140 subscribers, plus read-aloud reach. Variant v2 is **frozen**. By Day 10 Commons: v2 prevalence 0.62, `assumed=true` (printed and uncontradicted for a week). Pell Respect +18 town-wide.

**Day 13 (PC returns).** Promotion T1 → T0. Sophie, who likes the PC, *Warns*: "Pell's telling everyone he killed it and you scavenged it." The PC gets a ledger entry: "*Pell killed the hodag; the stranger took the hide*," spread band *everyone knows*.

**Player options, and the math:**
- **Show the head** at the store on market day (12 present): Physical evidence, base 1.5, plus Plausibility (the head carries the PC's distinctive ball wound, and Medicine/Tracking checks by onlookers notice a mismatch with Pell's "shot in the flank" story). Per-witness Δlogit ≈ +1.5·0.9·1.0 ≈ +1.35 toward `Killed(PC)`, which competes with v2 at ~0.7. Witnesses land around 0.6/0.4 in the PC's favor. Twelve independent observers seed v3 at high credibility.
- **Contradicting an assumed prop** costs the PC Respect −5 with hard believers (dissent cost), and Pell takes a public Respect hit when v3 overtakes: a **grudge** (Ambition +3, humiliation intensity 75, `aim: Humiliation`). Pell becomes a recurring rival, which is a nemesis-style seed.
- Or **ask Sloane to print a correction**: his Aff toward Pell (+30) vs. toward the PC (+0) means he refuses unless the PC brings the head *and* passes Persuade DC 20, or buys an advertisement. Printing a correction flips the frozen variant at credibility 1.3 and costs Sloane Respect for having been wrong (he'll resist).

**Off-screen consequence (Week 6, T2):** a peddler carries v3 to Readstown. There, the figure "the stranger who killed the hodag" picks up a variant via Supernaturalization ("killed it with a silver ball blessed by a priest"). When the PC arrives in Readstown, recognition checks connect the PC's descriptor (the horned-head trophy on the pack) to the figure, and a Readstown farmer begs for help with "a beast" in his coulee. The rumor got ahead of you, which is the 00 campaign feeling.

### 15.3 Off-screen generations: "The fence line" (T2 → T1 promotion)

**Worldgen (05) seed, 1841:** Nils Haugen and Ezra Cole dispute a 2-acre bottomland strip. Event: Cole's ox breaks Haugen's fence, the corn is trampled, Haugen strikes Cole. Both households spawn Grudges (Haugen intensity 70 → aim Restitution; Cole 65 → aim Humiliation). They become a Feud object with temperature 0.7.

**1841–1855 (T2, compressed):** daily incident rolls produce 11 notable incidents (a fence moved, a dog shot, a church-pew snub). Upbringing transfers: 4 Haugen children and 3 Cole children inherit grudges at ×0.6 intensity, with founding memories drifting. In Haugen family telling, Role drift (biased by dislike) turned the ox into "Cole *drove* his oxen through our corn." In Cole family telling, Supernaturalization (the grandmother has Superstition +2) became "Haugen's corn was hexed by that Norwegian granny, and the ox went mad."

**1855, game start.** The player is in the opposite corner of the county. T2 continues. **Week 2:** Lars Haugen (19) and Abigail Cole (18) are both at a husking bee hosted by a neutral household. T2 can't resolve a romance, but the bee is a T1-promoted gathering because the Director (05) flagged an active Feud with eligible young people. The encounter pool pairs them (stranger slot; their mutual inherited grudges are low: Lars Rancor −2 → 0.6 × 70 × 0.4 ≈ 17, Abigail Rancor −1 → 22). Flirt volition beats the feud penalty because both have Company need high. Flirt succeeds. Over four T1 weeks, three secret meetings (a Scheme: `secret courtship`, secrecy 0.8).

**Week 6:** a discovery roll succeeds for Lars's sister (Discretion −1). Rumor born: `Courting(Lars, Abigail)`, juiciness 0.8 (Feud bonus). It reaches both households in 2 days via church steps (they attend the same Methodist church: the feud spans one congregation, which raises the temperature). Ezra Cole Jr. (Abigail's father, grudge 58 inherited, Temper +2): Aff to Lars −60 → `Threaten`. Feud temperature 0.85.

**Week 9: the player arrives.** Rush Creek promotes to T1, then T0. Hydration: of 60 adults, 41 hold the courtship rumor (hash < prevalence 0.7), with sources backfilled to the church-steps cluster on Week 6 Sunday. The PC's Gather Information in the store surfaces: "*the Haugen boy and the Cole girl, and old Cole's fit to kill him.*" The dossier for Lars shows the inherited grudge with the *Haugen* version of the 1841 story. Abigail's shows the *Cole* version. The two founding memories contradict each other, and the Chronicle's post-run truth reveal shows it was a loose ox.

**Hooks:** the PC can intercede (Trust stake), help elope (Lars gets an Expulsion-aimed grudge from his own father), or witness the wedding roll: if Rev. Ashby (Peacemaker) performs it and both fathers attend, a **ritual reconciliation** rolls per attendee, and the feud may close after 14 years. Or the PC does nothing, and in Week 14 a T1 incident roll fires: Ezra Jr. assaults Lars at the mill. The sheriff, an assault, and a new founding memory follow, and the feud gets a fresh generation.

### 15.4 Short: "The framing goes wrong" (witch mode, belief-model edge cases)

Marit tries to divert Heat from herself by framing **Deacon Pruitt** (Respect high; an actor with a real secret: he drinks, `conceal`). She curses the Lund pigs the night after Pruitt argued with Lund, and leaves his monogrammed handkerchief (stolen; Provenance → Pruitt) by the sty.

- Attribution for Lund: Pruitt gets Motive 1.5 plus Evidence 3.0, but **Respect** feeds plausibility negatively (`plausibility` multiplies by `1 − Res/150`): people resist believing bad things about the respected. Pruitt's share: 0.31, below threshold. No belief forms, but the *handkerchief* is a juicy rumor anyway.
- Rumor `Has(handkerchief-at-sty, Pruitt)` spreads. Mutation (Moralization): "...and he was drunk, they say." That variant hits **true** Pruitt's secret (several actors privately had weak Drinks(Pruitt) beliefs at 0.2–0.3). Corroboration from *independent* lineages (not novelty-discounted) pushes Drinks(Pruitt) to 0.7 in the congregation. Pruitt's Respect collapses, and **then** his attribution share for the pigs rises (Respect term removed) to 0.48.
- Pruitt, who knows he didn't do it, rolls a Read People-like "who benefits?" Inference over recent events. His high Int finds that the handkerchief went missing on the day Marit did the Pruitt laundry for the Lunds. He forms `Belief(Framed(Marit?, Pruitt), 0.35)`, a private suspicion with Grudge `aim: Humiliation` (pursued by exposure). **A smart NPC now runs his own investigation scheme against the PC**, off-screen, at T1.

That's the system working as intended: the frame partially succeeded, exposed a true secret through rumor mutation, and created a nemesis who reasons about evidence the same way the town does.

**With the psyche on (`10`).** Pruitt is the textbook case for two defenses. A deacon with a concealed vice and a strict conscience (`superegoStrictness` 70) has a high **Persona strain** (`10` §8.1), and his drinking is Shadow charge. Before the frame, he was a candidate for **reaction formation** into Temperance zeal. After the exposure, his anxiety spikes, and **projection** makes the frame's true author easier to suspect only if Marit fits his projected trait (she doesn't drink). So his investigation is driven by evidence, which is why it's dangerous. If his Ego were weak, he'd **displace** instead: the hired girl's "who benefits?" would turn into a public scene at the Lunds' door that the whole parish hears.

### 15.5 Short: "The schoolmistress and the ferryman" (faekin suspicion, false positive)

Built on `12` §9's "wrongly suspected" hook. Integer forms throughout (§5.3, §5.4, §5.8).

**Cast.** **Miss Prudence Ames**, Yankee schoolmistress in a German parish: red-haired, left-handed, born with a caul (her landlady repeats this), prone to migraines. *Human.* **Mrs. Ruland**, Superstition +2, Piety view +1; she holds the changeling folk theory (`12` §6.1, SF-C as a belief), and her Affection toward Ames is −20 since Ames caned her boy. **Matthias Brekke**, ferryman at the slough, Norwegian Lutheran, well liked (most neighbors' Aff +30), from a Lantern household, wears gloves at the ferry chain. *Shadow-faekin.* M = 300‰.

**Sunday, the bell.** Ames winces as the bell rings: a migraine, which is a **lookalike** for the Bell-ache tell. Ruland passes Read People DC 12. That creates her kind belief at the prior: 2 + 2·2 + 5 (Outsider) + 10 (caul, under her folk theory) = **21**. The tell is strength 15, so base 96; trust 256 (her own eyes); plausibility 256 → ×110/100 for dislike → 281 → ×16/10 for Superstition → **449**. w = 168. L = LOGIT_Q8[21] + 168 = −339 + 168 = −171 → **34** (carry −1).

**The quilting bee.** Ruland demands the iron-key **Test** (#37) in front of 14 women. A human fails it about 10% of the time from nerves; Ames is anxious and fumbles the key. Ordeal evidence:
- Ruland: base 128 + 64·2 + 32·1 = 288, × 449/256 → 505. L = −170 − 1 + 505 = 334 → **79**.
- A typical witness (Superstition 0, Piety +1, prior 2 + 5 = 7, no caul theory): base 160, plausibility 256, w = 160. L = −662 + 160 = −502 → **12**.

Two other women with Superstition +2 (prior 11, no caul theory) land at 43. Three holders above 40, so the process on Ames opens at **rung 1** (Whispers). Its only charge is `Is(Ames, kind:faekin)`, so it's identity-only and capped at rung 4. Consensus is about 17‰ (only Ruland is above 50): nowhere near `Revealed`.

**Day 20, croup.** Ruland's boy has croup. Attribution (§5.4), with Ames at Odd 40, Out 100, Mot 20:
- Ames: 100 + floorDiv(6000 + 10000 + 3000, 100) + 2·20 + **2·79 (faekin term)** = **488**
- Natural: max(50, 200 − 300 + 0 + 70 − 50·band 1) = 50
- six others: 600

Ames's share is 488/1138 = **428‰**, which clears 350 with the lead, so Ruland forms `Caused(Ames, croup)` at 42. **Without the faekin belief** Ames weighs 330, her share is 336‰, and nobody is blamed. The belief about what Ames *is* supplied the act. `actAttributed` flips, so the rung-4 cap lifts.

**Why it stalls.** Ruland's grudge spawns at 55 (Rancor +2, Aff −40) and she accuses Ames at the Altar Society: Heat = 55·10·100/1000 = 55, plus a Fear-mass term of about 13 (the believed-faekin Fear prior, scaled by everyone's low credence and M) → **~68**, under rung 2's 150 × 0.895. One frightened believer doesn't make a hunt. Then the doctor names croup (DoctorSaid), and Ames's freethinking landlady **mocks** the iron-key business at the store (#39): her listeners' credence ×80/100 and Heat ×50/100. With no fresh fuel, the process steps down to rung 0 after two dwell periods. Ruland's private belief stays at 79, which is a seed.

**Epilogue.** Ames was human. The bell flinch was a migraine, the key slipped from nerves, and the caul was a caul. Brekke, the parish's only faekin, never had a kind belief created about him at all. His neighbors like him (plausibility ×85/100), he's no Outsider in a Norwegian-speaking district, and his gloves are a strength-5 tell that nobody knew to look for. In this parish the false-positive rate was one out of one. That's `12`'s point, and 04 gets it without a single faekin-specific rule.

---

## 16. Challenges to 00

All four v0.1 challenges have been **adopted** in `00`'s 2026-10-10 revision. They're kept here as a record.

1. ~~LOD tiering should include relevance, not just geography~~ **Adopted** (`00` LOD revisions; §11.4).
2. ~~"Grudge" should allow non-actor targets~~ **Adopted**: `00`'s glossary now lets a Grudge target an actor, a household, a Figure, or an unknown culprit.
3. ~~Add "Figure," "Belief," and "Reputation" to the shared vocabulary~~ **Adopted**, with Persona → Figure (C4).
4. ~~P1 "show the math" only for what the PC knows~~ **Adopted**: `00` P1's corollary now says "only the math your character could know."

No new challenges to `00` in this revision. One small vocabulary note: `00`'s **Mind** entry ("needs, mood, traits, memories, opinions, goals") predates the 04/`10` split; it still reads correctly as a union of the two.

---

## 17. Open questions for Ellie

Status of the v0.1 questions after this revision, then new ones. Where another doc carries the same question, its number is given so it gets answered once.

**Closed or narrowed**
- **Q1.** ~~**Values vs. alignment**~~ Alignment is gone (P7). **Still open (= `10` Q5, `07` Q4):** confirm the fold in §3.1 (six Values become `10` norms and drive weights; Superstition and Rancor stay as 04's two-field temperament block; Discretion derives from Persona control), and whether to add the norms Propriety, Temperance, and Honesty.
- **Q5.** ~~**Fae as social actors**~~ Answered by `10` §10's proposal: the same engine, Id plus Law, no Ego, sincerity with hedges (§5.6). **Confirm via `10` Q9.**
- **Q8.** ~~**Census vs. all-named**~~ Closed by `00` (census materialization) and `11`'s World sizes. **Confirm via `07` Q3** that World size is the only scale lever.
- **Q3.** **Witch-mode legibility** now has a concrete proposal: `11`'s "Show the rung" setting (§12.3). **Confirm via `11` Q10.**

**Still open from v0.1**
- **Q2.** **How dark does rung 6 go?** Charivari, tar-and-feathers, and burning out are period-plausible. Do we allow mob killings of NPCs (and of the PC witch) as simulated outcomes? What's the content line around frontier violence, and around historical persecution patterns (ethnic and religious minorities as default suspects)? The prejudice half now has options in `12` §11.1 (P1–P4, recommended P3, plus a Prejudice dial; = `12` Q8). The violence line is still yours.
- **Q4.** **Player lying and framing:** should the PC have the full Lie/Frame/Plant toolkit in adventurer mode too (P4 says yes: it's a general system)?
- **Q6.** **Language and peoples:** how much should Old Country language partitioning matter? It's a great rumor mechanic, but it needs UI (the PC doesn't understand the German gossip unless they have the language skill; `09` gap 11).
- **Q7.** **LLM layers:** ship L2/L3 (documents, chronicle) as a feature, a mod hook, or dev-only? (= `07` Q7)
- **Q9.** **Post-run truth reveal:** a core feature (I think it's the best payoff of a hidden-information sim) or a spoiler that undercuts the mystery of the world for legacy play in the same world?
- **Q10.** **Persistence across runs (P5 legacy):** do NPC memories of a previous PC carry into a new run in the same world? ("My father said a witch lived on that bluff...") The mechanism supports it directly via inheritance.

**New in this revision**

- **Q11.** **Grudge decay (C12, §6.3):** (a) uncanny-founded grudges don't decay *(rec, with `09`)*, or (b) all human grudges decay and `01` softens? Fae grudges never decay either way.
- **Q12.** **Legal rungs (C13, §9.2):** confirm `01`'s no-witchcraft-statute rule, so the law only processes mundane charges and a witchcraft "trial" is a mob court? (= `01` Q6)
- **Q13.** **Identity-only cap (§9.2):** processes whose only charge is what someone *is* (a believed faekin) stop at rung 4 until an act is attributed. Right line, or should identity alone never pass rung 3?
- **Q14.** **Notoriety tiers (C42, §8.6):** do the seven tiers and thresholds work for `02`'s *Hard Reputation* and `06`'s County Legend?
- **Q15.** **Rumor-telling steepness (§8.3):** k = 4, so worthless gossip is rarely told (12% at score 0, vs. v0.1's 38%)?
- **Q16.** **Gather Information (C20):** `02` §4.5 now specifies the CHA skill; confirm that addition via `02` Q13 *(rec, with `09`)*. The former Read People + Lore (Local) fallback is superseded.
- **Q17.** **Faekin framing (§5.8):** F1 + F2, covenant, or per-World? 04's mechanics work under all of them and this doc doesn't recommend one. (= `12` Q6, `10` Q4, `11` Q7)
- **Q18.** **Kind-prop valence (§5.1):** OK that "X is faekin" carries no built-in valence, so all hostility comes from culture-keyed priors and the Prejudice dial?
- **Q19.** **Credence storage (§5.2):** 0–100 plus a logit carry *(rec)*, or amend the ADR to store logit-Q8? (= `07` Q2)

---

## 18. Implementation notes (checked 2026-10-10 against `packages/` and `content/base/`)

I read `core/src/belief/{state,api,view}.ts`, `core/src/social/{state,api,view}.ts`, `core/src/psyche/state.ts`, `core/src/actor.ts`, `core/src/rng.ts`, `content/src/schema/{belief,social,common}.ts`, `content/base/beliefs/predicates.toml`, `content/base/needs/needs.toml`, and `docs/impl/MODULES.md`. Most social and belief behavior is still stubbed (`transmit`, `observe`, `formProjection`, `suspicionOf`, `addMemory`). **The doc is the design target**; these are notes for the module owners, not changes I made.

**Aligned**
- Credence is an integer 0–100; opinions are −100..100 with Fear 0..100; salience and confidence are per mille.
- Opinions change only through Reasons (`addOpinionReason`), with `base`, `volatile`, and an **Obligation** ledger in favors and cents, as §6 wants.
- Grudge targets are actor, household, or Figure; aims match §6.3.
- Figures carry a ground-truth `trulyId` that decision code must never read, which is §5.1's rule.
- `EvidenceType` matches §5.2's v0.1 list, plus `seed`; evidence carries its rumor lineage id for novelty.
- Predicates are data with `juiciness`, `valence`, and a `supernatural` flag; `is_figure` exists.
- Interactions are a data catalog with named volition drivers (`value:temper`, `need:company`), which keep working through §3.1's derived views.
- RNG streams `social`, `gossip`, `memory`, `belief`, `rumor`, and `suspicion` exist; no new stream is needed.
- Scenario `secrets` with `known_by` implement §3.5, and `presentsAsId` implements §5.7's concealed kind.
- MODULES.md scopes M2 to rungs 0–3 and faekin suspicion via tells; that's a fine subset of §9.2 and §5.8.

**Divergences (doc wins unless Ellie says otherwise)**

| # | Code today | This doc | Suggested change |
|---|---|---|---|
| 1 | `Persecution { target, rung 0..3, heat, consensus, leaderIds }`, no settlement | Per (target, **settlement**) process, rungs 0–6, with `charges`, `actAttributed`, `restraint`, `history` (§9.2) | Add `settlementId` and the missing fields; widen the rung type to 0..6 now so the contract stays additive |
| 2 | `misfortune`: one global value | M per settlement (§3.3), plus `10`'s A_S for threshold scaling (§9.1) | Move M into settlement state |
| 3 | `viewBeliefGlobal` returns every Figure's notoriety and the true M to any viewer | P1: the PC sees settlement mood as wording and notoriety as believed tiers (§12.3) | Filter by `perspective`; keep raw values for `omniscient` |
| 4 | `viewSocialActor` ignores `opts`: any viewer sees any actor's full opinion numbers, every reason, and all memories | §12.1: bands until Read People; only reasons the PC witnessed or learned | Gate by `perspective`; this is the same class of P1 leak `10` §14.5 flags in `psyche/view.ts` |
| 5 | `BeliefView` shows numeric credence of others' voiced beliefs | Credence words for others unless a check succeeds | Gate numbers like opinion numbers |
| 6 | Juiciness and notoriety 0..100; evidence weight in hundredths | Juiciness and notoriety per mille; weights in Q8, to match `LOGIT_Q8` (§5.3, `07` §4.2) | Switch evidence weights to Q8 before `transmit` is written; scale authored juiciness ×10 at load |
| 7 | `Belief` has no `carry` or `clamp` | §5.2 | Add when `07` Q2 is settled (carry) and when denial lands (clamp) |
| 8 | `EvidenceType` lacks `dream` and `defense` | §5.2 | Add both; `defense` carries the defense id |
| 9 | Predicate `faekin` with `valence = -50` | Kind props carry valence 0; hostility comes from culture-keyed group priors and the Prejudice dial (§5.1, §5.3) | Set valence 0. Consider a generic `is_kind(actor, people)` predicate so no content predicate is faekin-specific |
| 10 | `suspicionOf()` returns one 0..100 for "concealed/fae/witch" | Suspicion is credence in a specific prop | Take a prop or kind argument |
| 11 | Opinions keyed actor → actor only | Also toward Households, groups (people, culture, congregation, role), and Figures (§6.2) | Add group and Figure opinion tables |
| 12 | Grudge holder is an actor only; no `viaDefense` or `decay` | Household holders, Feud objects, defense provenance, C12 decay flag (§6.3, §7.3) | Add the fields |
| 13 | `Memory.roles.who` is an `ActorId`; no descriptors, `Unknown#k`, distortions, `affect`, or psyche flags; `dreamt` has no sender | §4.1 | Widen `who` to `EntityRef`; add flags; store `s0, tRef` for lazy salience |
| 14 | `opinionOf` weights every reason fully | Reasons weighted by cited salience or credence (§6.2) | Already a known stub in MODULES.md |
| 15 | `ActorCore.values` stores nine −3..+3 Values | Six fold into `10` norms and drives; Superstition and Rancor stay; Discretion from Persona control (§3.1) | Keep for M1; migrate with `strength = 50 + 15 × value` (`10` §14.5 item 7) and expose derived views |
| 16 | Needs content has `company` and `faith`; no `standing` or `security` | §3.3 | Add both, registered per `10` §3.4 |
| 17 | Figure `notoriety` is a single global number | Notoriety per (entity, settlement), tiers derived (§8.6) | Make it a per-settlement map |
| 18 | `Rumor` has no per-settlement prevalence or `assumed` | §8.1, §5.5 | Needed for T2 diffusion and hydration |
