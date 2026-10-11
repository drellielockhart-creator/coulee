# 10 — Psyche

**Status:** Draft v0.1, 2026-10-10. **Owns** the psyche: drives, Id/Superego/Ego, Thoughts, ego arbitration, anxiety, defenses, Persona, Shadow, archetypes and complexes, soul-image, individuation, dreams, and fae minds. **Does not own** memory, belief, opinion, grudge, rumor, Figure, notoriety, or persecution (`04`); physiological burn rates (`05`); checks, saves, conditions, and Callings (`02`); curses, Woe, Drift, or witch weaknesses (`06`).
**Depends on:** `00` P7 (canon sketch), `adr/0001` (psyche-lite, integer and determinism invariants), `09` C3, C36, C38, C47, C49.
**Tags:** **[DECISION]** comes from `00`, the ADR, or Ellie. **[PROPOSAL]** is mine. **[OPEN]** needs Ellie.

---

## 0. Summary

- **[DECISION]** No alignment. Every Thought is voiced by the **Id** (appetite) or the **Superego** (conscience). The **Ego** arbitrates once an hour (`egoStrength`, `superegoStrictness`, `idAppetite` 0–100, anxiety 0–1000; ADR).
- **[PROPOSAL]** Anxiety works as an economy. Unresolved conflict accrues it, and **defenses** discharge it. Every defense writes into a system that already exists: a Belief, an evidence clamp, a memory flag, an urge retarget, or an opinion Reason. That's how one frightened mind turns into a village's scapegoat (§7.3).
- **[PROPOSAL]** The Jungian layer is mostly *identity and story*. The **Persona** is the psychological side of `04`'s Figure. The **Shadow** supplies what projection projects. **Archetypes** cast story roles. **Individuation** is a long-arc progression whose main reward is **self-legibility**: your own defenses become visible in the UI.
- **[PROPOSAL]** **Dreams** are the channel Faerie uses to reach people. Hag-riding is a sent nightmare, and the face of the rider comes from the *victim's* projection, so the curse frames whoever the victim already resents.
- **[PROPOSAL]** **Fae minds** are Id plus Law, with no Ego. They have no defenses and no forgetting, and they can't speak insincerely.
- **[PROPOSAL]** **Period framing:** 1855 labels by default (Conscience, the Old Adam, Self-Command, Nerves, Self-Culture), with clinical labels as an option.

---

## 1. Stance and guardrails

**Why this model works in a sim.** Freud and Jung aren't good science, and we aren't claiming they are. They're a theory of *motivated misperception*, which is exactly the engine `04` needs. Our attribution formula already says "people blame the odd, the outside, and the disliked." The psyche adds *why*: blaming discharges the blamer's own anxiety, and the content of the blame comes from what the blamer can't admit about himself. In-world, this mental philosophy is treated like the humours: a lens the game's people half-believe, and one the game's systems happen to obey.

**Design rules [PROPOSAL]:**
1. **Output only to existing sinks.** A psyche mechanism must end in an urge, a Belief or evidence change, a Memory flag, an opinion Reason, a mood term, a condition, or a check modifier. There are no private psyche-only currencies, apart from anxiety and the charges in §8.
2. **Legible, but gated (P1).** Thoughts and arbitration are `knowledge: 'self'` Explains. Defenses are unconscious *by definition*, so their labels are `'omniscient'` until the actor gains **Insight** (§8.5). The post-run epilogue shows all of them.
3. **The world's numbers never lie to the player (P8).** A PC's defenses color thoughts, mood, NPC perception, and NPC behavior. They never falsify the Readiness panel, rations math, or check odds, unless the player opts into an "unreliable narrator" setting.
4. **Integer and deterministic** (ADR). Streams: `psyche` only, with distinct salts for arbitration, defenses, and dreams.
5. **Cheap at T2.** The psyche degrades to a few integers and one daily roll (§14.4).

**Sensitivity guardrails [PROPOSAL]:**
- **No people gets a psyche profile.** No "goblins are Id" or "elves are Superego." That would be racial essentialism, and goblins carry heavy caricature baggage. Psyche priors come from upbringing, culture, and congregation, all of which are human-diverse. `content/base/peoples/peoples.toml` correctly has no psyche fields. (Aside for `12`: the placeholder `literacy_pct` of 30 for goblins against 60 for humans is an undiscussed group difference worth reviewing.)
- **Shadow-faekin are not "the Shadow."** The echo is deliberate (`00`), but the mechanics must make the *community's* projection the harm, not any truth about the people (§8.2).
- **No Freudian sexual theory as mechanics:** no Oedipal complex, no "hysteria" as a female diagnosis, and no pathologizing of sexuality. `lust` is one drive among eight, with content toggles.
- **Mental distress is never a punchline.** Fits (§6) are rendered humanely, and the period's cruel treatments are shown as cruel.
- **Phrenology** was used to justify racism. Use its *faculty names* as period labels only. Phrenologist NPCs are mountebanks running Deceive checks. There is no skull-reading mechanic.
- **Dream lore stays European folk** (mara, hag, Swedenborg, dream-books). Native dream and vision practices are not the "collective unconscious" and not a fae channel (`01` §2).

---

## 2. Ownership and boundaries

| Concern | Owner | 10's role |
|---|---|---|
| Drives, voices, Thoughts, arbitration, anxiety, defenses | **10** | — |
| Norms (superego content), absorbing `04`'s Values | **10** | `04` reads derived Values (§3.3) |
| Need registry: which need feeds which drive | **10** [PROPOSAL, C38] | `05` owns physical burn rates; `04` owns social need satisfaction |
| Memory, Belief, Opinion, Grudge, Rumor, Figure, Notoriety, attribution | `04` | 10 adds flags, evidence types, and attribution and Heat terms (§13.2) |
| Persecution ladder (rungs 0–6) | `04` §9 | Defenses feed Heat, Consensus, and Catalyst choice; 10 never sets rungs |
| Persona (psychological mask) | **10** | `04` owns the Figure; one identity model (C47, §8.1) |
| Will, morale, conditions, Callings, XP | `02` | 10 supplies the Composure modifier and individuation hooks |
| Hunger burn and nutrition effects; food item fields | `05`; `03` | 10 turns deficits and monotony into Id thoughts |
| Curses, Woe, Drift, witch weaknesses | `06` | 10 supplies dream mechanics and the psyche reading of Suffering and Belief |
| Fae rules (iron, thresholds, bargains) | `01` | 10 models the fae *mind* that obeys them |

---

## 3. Structure

### 3.1 The three agencies [DECISION, ADR]

| Field | Range | Meaning | Seed [PROPOSAL] |
|---|---|---|---|
| `idAppetite` | 0–100 | Overall loudness of Id voices | 50 ± 3d6−10.5, then traits |
| `superegoStrictness` | 0–100 | Loudness of Superego voices and severity of guilt | Upbringing and congregation prior (Haugean 70, freethinker 30), then traits |
| `egoStrength` | 0–100 | Weight of reality appraisal over voices; anxiety tolerance; defense maturity | `40 + 4×WIS mod + floor(level/2) + upbringing + traits`, clamped 5–95 |

**[PROPOSAL] Seed `egoStrength` from WIS.** This lines up with `02`'s Will and morale (C3). It drifts afterward: +1 for each individuation stage step (§8.5) and each month in which a mature defense fired, −1 for each harrowing event (memory intensity ≥ 90), and −1 per week Starving or at Drift ≥ 80.

### 3.2 Drives (the Id's voices)

**[PROPOSAL]** Eight drives, with temperament weights 0–100 (default 50) per actor. Ellie's seven, plus **longing**.

| Drive | Fed by | Typical urges | Period label |
|---|---|---|---|
| `hunger` | Hunger and thirst needs, monotony, the sight of food, cravings (coffee, tobacco, drink) | Eat now, break rations, steal food, hoard, drink | Appetite |
| `lust` | Attraction (from `04` Flirt and Aff), loneliness, drink | Flirt, court, seek company, transgress | The Flesh (toggle: "Desire") |
| `rage` | Insults, grudges, pain, frustration, agentless misfortune | Insult, fight, destroy, accuse, curse | Temper / Choler |
| `sloth` | Rest and warmth deficits, wounds, despair, rain | Rest, skip work, abandon the task, skip the watch | Sloth / Ease |
| `greed` | Money need, debt, Ambition, the sight of goods | Take, cheat, hoard, haggle hard, claim credit | Acquisitiveness |
| `fear` | Threats, the Fear opinion dimension, Dread creatures, dark, Fae intensity | Flee, hide, appease, arm, strike first, seek the crowd | Cautiousness / Dread |
| `envy` | Standing comparisons, a neighbor's prosperity | Slight, gossip down, covet, sabotage | Envy / the Evil Eye |
| `longing` | Grief, homesickness, Company deficit, fae music and food | Seek the lost, go home, go *into the hollow*, drink to forget | Longing / Pining |

`longing` gives `02`'s "Fae longing" and grief a home that fits P7's canon (every Thought is Id- or Superego-voiced).

### 3.3 Norms (the Superego's content) and `04`'s Values

A **Norm** is internalized content with a **source**, and the source decides *who speaks it*:

```ts
interface NormHold { norm: NormId; strength: number /*0–100*/;
  source: 'parent'|'community'|'church'|'self'|'pact'|'law'; speaker?: EntityRef }
```

Launch norms: `duty`, `shame` (exposure), `piety`, `propriety`, `neighborliness`, `thrift`, `temperance`, `honesty`, `hospitality`, `our_own` (in-group loyalty), `sabbath`. Period gender and age norms ("a wife obeys") exist as data that some actors hold. The sim models them without endorsing them.

**[PROPOSAL] Folding `04`'s nine Values (C3).** Most of them become psyche content. I argue that three stay `04` dispositions:

| `04` Value | Becomes | Why |
|---|---|---|
| Piety, Thrift, Neighborliness | Norms (church, parent, community) | They're internalized prohibitions and injunctions |
| Parochialism | Norm `our_own` | Loyalty is conscience content ("we look after our own") |
| Temper | `rage` drive weight + a lower rage-thought threshold | Temperament, not conscience |
| Ambition | `greed` and `envy` weights + the Standing need | Appetite for rank |
| **Superstition** | **Stays in `04`** as an epistemic prior | It's a belief style, not a norm. Psyche *reads* it (projection supernaturalizes more) |
| **Rancor** | **Stays in `04`**; 10 reads it as resistance to repression and to forgiveness-undoing | It's a memory style |
| **Discretion** | **10 Persona control** (§8.1), exposed to `04` as a derived Value | It's mask discipline |

`04`'s formulas keep working through **derived views**: `value(v) = clamp(−3, 3, floor((strength − 50) / 15))`. Add `propriety`, `temperance`, and `honesty` as norms; this answers half of `04` Q1.

### 3.4 Need registry [PROPOSAL, C38]

| Need | Kind | Rates owned by | Drive or Norm fed | Thought threshold T |
|---|---|---|---|---|
| hunger, thirst | physical | `05` | `hunger` | 600 |
| rest, warmth | physical | `05` | `sloth` | 600 |
| company | social | `04` | `longing` (and `lust` if Aff target) | 500 |
| standing | social | `04` | `envy`; norm `shame` | 500 |
| security | social | `04` | `fear` | 500 |
| faith / ritual | spiritual | `04` | norm `piety`; `longing` | 400 |
| drink (vice) | physical | `05`/`02` | `hunger` (craving) | 500 |
| fae longing | spiritual | `06` (gain) | `longing` | 500 |
| monotony (P8) | derived | `05` (from diet history) | `hunger` (mood only) | — |

Needs are on a 0–1000 scale where 1000 means satisfied (matching the code).

---

## 4. Thoughts

### 4.1 Record

```ts
interface Thought {
  id: ThoughtId; voice: 'id'|'superego'; key: ThoughtKey;      // content key, e.g. "hunger.ration_temptation"
  drive?: DriveId; norm?: NormId; speaker?: EntityRef;          // "Mother", "the Pastor", "the neighbors", "the Prince"
  urge?: Urge; target?: EntityRef;                              // what it wants done, to whom
  intensity: number;   // 0–100
  mood: number;        // −50..+50 contribution to mood
  born: GameMinute; expires: GameMinute; decayPerHour: number;
  explain: Explain;    // knowledge 'self'
  maskedBy?: DefenseId // set when a defense produced or disguised it (§7)
}
interface Urge { kind: 'activity'|'interaction'|'action'|'avoid'; ref: string; target?: EntityRef; tags: string[] }
```

Mood (`04` §3.3) is the sum of all live thoughts' `mood`. RimWorld's moodlets become voiced thoughts: "Ate a fine meal" is an Id thought (+5), "Kept the Sabbath" is a Superego approval thought (+4). The Superego **approves** as well as forbids.

### 4.2 Generation

Generators are content rules evaluated on change events (T0), hourly (T1), or daily (T2). There are five source families:

1. **Needs.** For need `n` below threshold `T`:
   `base = floor((T − n) × 100 / T)`; `I = min(100, floor(base × (50 + idAppetite) × drive[d] / 5000) + Σ situational)`.
   At `idAppetite` 50 and drive weight 50, `I = base`.
2. **Memories.** Cue-matched recall (the person is present, the place, an anniversary, a dream) of a memory with salience ≥ 30. The memory's emotion sets the voice: anger → `rage`, fear → `fear`, grief → `longing`, shame → superego `shame` (speaker = the witnesses). `I = floor(salience × intensity / 100)`.
3. **Opinions.** A present actor with a strong opinion dimension: Aff ≤ −30 plus Temper → `rage`; that actor's Respect from others ≥ 40 plus the observer's Standing need → `envy`; Fear ≥ 40 → `fear`; Obligation owed → superego `duty` (speaker = the creditor).
4. **Situations** (data). An unguarded purse → `greed`. A lone cabin at night → `fear`. The Sabbath, church bells, a funeral. Food in hand while rationing. **Audience:** norms flagged `public` add `min(30, 5 × onlookers)`. Drink scales superego intensity by ×(100 − 15 × drinks)/100.
5. **Dreams, fae, and pacts** (§9, §10, §13.3).

Superego intensity: `I = min(100, floor(strength × (50 + superegoStrictness) × relevance / 15000) + audience)`, where relevance (0–100) measures how directly the current options touch the norm. Schedule duties in code (`ScheduleBlock.duty`, 0–1000) enter as `duty` norm thoughts at `I = floor(duty / 10)`.

**Caps:** the top 12 thoughts per actor at T0/T1 and the top 4 at T2. Same-key thoughts merge (max, plus half the next). Thoughts are **recomputable** from state, so they aren't saved history. Only defense-masked thoughts persist.

**Content example** (`content/base/thoughts/hunger.toml`):
```toml
[[thought]]
id = "hunger.ration_temptation"
voice = "id"
drive = "hunger"
when = { need_below = { hunger = 600 }, has_item_tag = "food", rationing = true }
situational = 15
urge = { kind = "action", ref = "eat_unrationed", tags = ["eat", "break_ration"] }
mood = -3
text = "thought.hunger.ration_temptation"   # "Eat the apples. All of them. Who's counting?"
```

### 4.3 How Thoughts look [PROPOSAL; `11` owns layout]

The **Inner Voices** panel is RimWorld's thoughts list, but voiced.
- **Id lines** are first person, present tense, and impulsive, in a warm ochre: *"Eat the apples. All of them."*
- **Superego lines** are quoted from their speaker, in a cool slate: *Mother: "Waste not, want not."* · *The Pastor: "Six days shalt thou labour."* · *The neighbors: "What will people say?"*
- **The Ego's verdict** is a single bottom line, with a check if one was rolled: *Self-Command: half the apples tonight, then the ration. (14 vs 14)*
- Each line shows intensity, mood, decay, and its urge. Tapping a line opens its Explain.
- **Pocket:** a swipeable card stack, with the verdict card pinned at the bottom.
- **Desktop:** a two-column table plus a mood sum.
- **Masked thoughts** (defense-produced) look like ordinary thoughts. Only Insight (§8.5) adds the hatched label "*Laying it at another's door?*"
- **Other actors** show only a band from Read People ("seems torn," "something's eating at him"), never their lines.
- **Voice text** comes from template banks per culture and congregation. A Norwegian Haugean's conscience quotes the catechism; a Cornish Methodist's quotes the class meeting. Scripture paraphrase is fine; no SRD text.

---

## 5. Ego arbitration

### 5.1 When it runs

- **T1:** hourly (ADR).
- **T0:** at decision points: an activity ends, a thought arrives with I ≥ 60, or a morale trigger fires (`02` §9.8). Timestamps are game-minutes, and T0 resolves within-minute ordering by game-second offset (C21).
- **T2:** daily and coarse (§14.4).

### 5.2 Scoring [PROPOSAL]

For each option `o`. The options are the activity scheduler's candidates, `04` interaction volitions, and the urges of live thoughts.
- `R(o)` ∈ −100..100 is the **reality appraisal**: need relief, goal progress, risk, cost, and feasibility, taken from the `04`/`05` scorers. This is the reality principle.
- `V(o) = Σ I(t) over thoughts that support o − Σ I(t) over thoughts that oppose o`, across both voices. A thought opposes `o` if its urge is incompatible by tag, or if its norm forbids one of `o`'s tags.
- `S(o) = floor(R(o) × E / 100) + floor(V(o) × (150 − E) / 100) + noise`, where `E = egoStrength`, `noise = rng.int(−n, n)`, and `n = floor((100 − E) / 5)`.

A strong ego weighs reality and dampens voices. A weak ego is pushed around by the loudest voice and by impulse noise.

### 5.3 Compromise and sublimation

- **Compromise.** It's eligible when the top two scores are within 20, their net voice is dominated by opposite agencies, and a **compromise template** links their tags. Examples: half the apples then the ration; gossip instead of a fight; pray, then rest; drink "medicinally"; ask for an extension instead of defaulting.
  - Ego check: `d20 + egoMod − band ≥ 10 + floor(tension / 10)`, where `tension = min(id support, superego support)`.
  - On success, the template's satisfaction percentages apply to each frustrated thought.
- **Sublimation.** A drive frustrated for 3 or more consecutive cycles, plus `E ≥ 55` (or a trait), plus a sublimation template for (drive, context), triggers a check of `d20 + egoMod ≥ 12`. On success, the sublimated activity wins. Examples:
  - rage → splitting rails, drilling, or preaching hellfire
  - fear → careful camp work, cleaning the gun, outfitting
  - greed → overtime, trade
  - lust → courtship, hymn-singing
  - longing → letters, fiddling

  The drive's frustration is fully satisfied, and the activity gets **+1 practice mark** (`02` §4.4). That makes the psyche a progression input.

`egoMod` comes from a table: E 0–19 gives −2, 20–39 gives −1, 40–59 gives 0, 60–79 gives +1, 80–100 gives +2. `band = min(4, floor(anxiety / 200))`. **Composure** = `egoMod − band`.

### 5.4 Explain record

```ts
interface ArbitrationExplain extends Explain {   // kind 'arbitration', knowledge 'self'
  options: { ref: string; R: number; V: number; score: number; noise: number }[];
  chosen: string; mode: 'plain'|'compromise'|'sublimation'|'impulse'|'fit';
  check?: Explain; anxietyDelta: { real: number; neur: number; moral: number };
  frustrated: ThoughtId[];
}
```
`impulse` means the noise flipped the winner, which happens only when E < 40. Impulse picks are logged as notable for the Chronicle ("Something came over him").

### 5.5 The PC: the player is the Ego [PROPOSAL, OPEN]

You play one character directly, and the psyche must not take that away. Options:
- **(a) Advisory:** thoughts and the verdict are suggestions only.
- **(b) Advisory with a cost (recommended):** the verdict is the default. Overriding it is free but books the anxiety the override causes, and the confirm line says so ("+30 Nerves: Appetite unheeded").
- **(c) Advisory with a cost, plus hard overrides at Fits** (§6), behind the same off switch `02` proposes for forced player morale.

---

## 6. Anxiety economics

**State:** `anxiety` 0–1000 (ADR), plus `anxSrc = {real, neur, moral}`, Freud's three anxieties, which sum to `anxiety`. The sources pick which defenses fit.

**Accrual per arbitration.** For each frustrated thought with `I ≥ 15`, with satisfaction `f` (0 for plain choices, the template percentage for compromises), and with sustained frustration scaled to 25% after the first cycle (habituation):
- **Id thought:** `neur += floor(I × (100 − f) / 100 × (100 − E) / 100)`
- **Superego thought** (the chosen option violates it, or a duty went undone): `moral += floor(I × (100 − f) / 100 × superegoStrictness / 100)`
- **`fear` thought whose threat persists:** `real += floor(I × (100 − E) / 100)`, whatever was chosen
- Gains are capped at +200 per hour. Shocks bypass the cap (a witnessed death adds the memory intensity directly).

**Discharge per hour:** `anxiety −= floor(anxiety × r / 1000) + floor(E / 10)`. The per-mille rate `r` depends on what the actor is doing:

| Activity | r | Condition |
|---|---|---|
| Base | 10 | — |
| Sleep | 40 × quality% | — |
| Company or gathering | 20 | — |
| Prayer or ritual | 25 | Requires `piety` ≥ 40 |
| Drink | 50 | Hangover follows (`02`) and the craving thought grows |
| Confession or Confide | 150, one shot | `04` interaction, so the secret now carries leak risk |
| Sublimated work | 30 | — |

Discharge comes off the sub-pools pro rata, with any remainder taken from the largest.

**Bands and effects:**

| Anxiety | Label (period) | Effects |
|---|---|---|
| 0–199 | Easy | — |
| 200–399 | Uneasy | Composure −1 |
| 400–599 | Nervous | −2; sleep quality −20 pts; `fear` thoughts +10 |
| 600–799 | Harrowed | −3; at least one defense fires each hour above Θ |
| 800+ | Breaking | −4; Fit risk |

- **Defense threshold:** `Θ = 250 + 3E`. E 20 gives 310, E 50 gives 400, E 90 gives 520.
- **Fit threshold:** `Φ = min(990, 700 + 3E)`. Each hour above Φ, a Will save at `DC 10 + floor((anxiety − 600) / 40)` decides whether a **Fit** happens.
  - A Fit is a timed episode chosen by the dominant drive: weeping, a binge, a rage, flight into the woods, religious mania, catatonic stillness.
  - It discharges 400.
  - It's always notable. `04` witnesses read it through Superstition, so a Fit can become "bewitched" (§7.2, regression).

**Community anxiety [PROPOSAL].** `A_S` is the weighted mean of resident anxiety, kept at T2 as an aggregate. It stays distinct from `04`'s Misfortune pressure M, which is an event sum. Both scale persecution thresholds, with `04` multiplying by `(1 − 0.35·M)(1 − A_S / 4000)`. This gives `05`'s HearthState.fear (C41's merge) a defined source: `fear_S = floor((M×100 + A_S/10) / 2)`.

---

## 7. Defenses

### 7.1 Selection

When `anxiety ≥ Θ` at the end of an arbitration, and no defense fired in the last 60 minutes (one per day at T2):
- **Candidates:** defenses whose trigger matches (`fit` 0–3).
- **Maturity gate:** *immature* defenses (denial, projection, displacement, regression, somatization) are always available. *Neurotic* defenses (repression, rationalization, reaction formation, undoing, isolation, identification) need E ≥ 25. *Mature* defenses (sublimation, humor) need E ≥ 55.
- **Weight:** `style[d] × fit`. `style` is 0–100 (default 10), seeded from traits and upbringing. Pick with `rng.weighted` on stream `psyche`, key `mixKey(actor, minute, SALT_DEFENSE)`.
- **Relief:** taken from the triggering sub-pool first.
- **Characterization:** each firing adds +2 to `style[d]`, which relaxes toward the trait baseline by −1 per week. At `style ≥ 70`, the actor acquires a trait (data mapping): Suspicious, Zealot, Scrupulous, Cold Fish, Wag, Nervous Constitution. This is how `04`'s `Pious Hypocrite` and `Firebrand` *emerge* instead of being rolled.
- **PC:** defenses fire automatically and appear as ordinary (masked) thoughts. Insight reveals them and offers **Own it**: reverse the defense's belief or retarget, take the anxiety back, and gain individuation progress (§8.5). Projection becomes a choice the player can learn to refuse.

### 7.2 Catalog

Each entry gives: **Trigger** · **Target** · **Sim effect** · **Social feed (`04`)** · relief.

**Repression** *(neurotic; "putting it out of mind"; relief 200)*
- **Trigger:** moral anxiety tied to one memory (shame or guilt), or a memory of intensity ≥ 70 encoded at Fae intensity 4+.
- **Target:** that memory.
- **Sim effect:** `repressed = true`. Salience is capped at 10 for recall and retelling, but the memory still supports beliefs at ×0.5 *without being citable*. It adds +10 to the **shadow** charge for its theme. **Return of the repressed:** the memory gets ×2 weight as dream material, a slip check (Discretion vs. the memory's intensity) when cued in conversation, and an optional somatic tie-in.
- **Social feed:** the witness who "doesn't remember." Key evidence in a witch hunt can be locked inside a frightened mind. A **mesmerist** (§12) can recover it, but recovered memories carry `Implant`-type confabulation risk: the mesmerist's own beliefs bleed in. That's the recovered-memory danger, as a mechanic.

**Denial** *(immature; "won't hear of it"; relief 150 + ongoing)*
- **Trigger:** realistic anxiety from a rising threatening prop (the child is sick, the larder won't last, I'm suspected).
- **Target:** that prop.
- **Sim effect:** evidence weight toward the prop ×0.25 while active (up to 14 days). Behavior ignores it: no rationing, no doctor, no flight.
- **Social feed:** deniers voice counter-statements ("there's no witch"), so they're dissent nodes against `04`'s Commons. When denial **breaks** (accumulated evidence weight ≥ 3× threshold), credence jumps to `min(95, credence + 40)` with +150 real anxiety, which commonly cascades into projection.
- **P8:** this is how NPC households mismanage pantries. For the PC it never edits numbers (§1).

**Projection** *(immature; "laying it at another's door"; relief 250)*. The engine of scapegoating.
- **Trigger:** neurotic or moral anxiety from a forbidden Id drive (envy, lust, rage, greed) whose shadow charge is ≥ 30.
- **Target:** acquaintances (top 30 by salience) plus active Figures, scored by projection fit:
  `PF(b,c,τ) = 30·H + 20·Odd + 20·Out + 15·Dis + 15·Weak`, all /100 integers. `H` is b's prior credence that c has trait τ, or a stereotype for it. `Odd` and `Out` are `04`'s terms. `Dis` = 100 if Aff(b→c) < 0. `Weak = 100 − power(b,c)`, where `power = max(Respect, Fear, 20 × office weight, kin ? 50 : 0)`.
- **Sim effect:** b gains `Belief(Is(c, τ))` or `Feels(c, τ, b)` at credence `5 + floor(PF/2)`, with evidence type `Defense:projection`. The holder perceives this as Inference; the Explain is omniscient. b's own drive thought decays ×0.5. Shadow charge +5: projection keeps the trait disowned.
- **Social feed:** an attribution term (§13.2), using a trait-to-misfortune map: envy → overlooking (the evil eye), stolen luck, dried cows; greed → stolen milk and butter, crop "drawn" away; lust → turned hearts, bewitched spouses; rage → sickness and death curses. *Witchcraft accusations end up being about the accuser's shadow*, which is historically apt. Projected beliefs are voiced at juiciness ×1.3 with the Moralization mutation. Figures absorb projections, so the Bluff Witch's rumored traits drift toward the **collective shadow** (§8.2).

**Displacement** *(immature; "kicking the dog"; relief 200 when the act completes)*
- **Trigger:** a rage or fear urge whose true object is blocked (power ≥ 50: the creditor, the patron, kin, God, the weather, an agentless misfortune).
- **Target:** displacement fit `DF = 30·Sim + 30·Weak + 20·Avail + 20·Dis`. `Sim` measures resemblance to the blocked object (household, role, "those who take what's mine"). `Avail` is co-presence in the next 3 days.
- **Sim effect:** a `displaced` store (the intensity, the original object). The urge is retargeted: Slight, Insult, Fight, Accuse, kicking the animal, harsh words at home.
- **Social feed:** an attribution term. Victims spawn **counter-grudges**, so cascades fan out. Animals are actors (the mule's Fear rises). Displacement is how M becomes Heat: an agentless misfortune finds the safest agent.

**Rationalization** *(neurotic; "special pleading"; relief 150)*
- **Trigger:** moral anxiety after acting on an Id urge or against a norm.
- **Target:** the act and its victim.
- **Sim effect:** a justification belief (`Deserved(victim)`, `Necessary(act)`, `Everyone(act)`) at credence 60, plus an opinion Reason against the victim, at Aff −10 and labeled *"had it coming."*
- **Social feed:** rationalizations are spoken, so they become rumors defaming the victim. After any persecution act (charivari, shunning), participants rationalize and are marked `voiced`, so Consensus **hardens** and defusal DCs rise by +2. Victim derogation is the main post-hoc engine of mob consensus.

**Reaction formation** *(neurotic; "protesting too much"; relief 300)*
- **Trigger:** a forbidden Id urge toward a specific target (lust, sympathy, envy), repeated 3+ times, with strictness ≥ 60.
- **Target:** the same target, or the vice itself.
- **Sim effect:** the urge flips sign and becomes a **superego-voiced crusade** (Expose, Preach at, Accuse, Shun-lobby) at intensity ×1.5. Credence in damaging props about the target gets +15, as motivated reasoning.
- **Social feed:** the zealot is the Catalyst. The deacon who wants the widow leads the case against her; the secret drinker leads Temperance; the witch-finder is drawn to witches. `04` Catalyst weight +30. Becomes the `Zealot` trait at style 70.

**Undoing** *(neurotic; "making amends" or "penance"; relief 150 + the act)*
- **Trigger:** guilt about a specific harm.
- **Target:** the harmed party, or the act itself.
- **Sim effect:** a compensatory act: a gift, help, prayer, penance, or compulsive warding (rechecking the nails in the threshold, salting the sill). It's mechanically real: wards lower Fae intensity (`01`), and a witch's undoing can lift her own curse or buy a Mercy (`06`).
- **Social feed:** unexplained gifts read as suspicious (`04` #19: a gift from a suspect might be a witch's charm). Compulsive warding signals fear, which gives +notoriety to "whatever she's afraid of."

**Isolation of affect** *(neurotic; "steeling oneself"; relief 200, with 50% deferred)*
- **Trigger:** overwhelming affect during necessary action: combat, surgery, butchery, burying kin, the hunt.
- **Target:** the current memories.
- **Sim effect:** they encode at intensity ×0.5 with emotion `none`, and the fear thought halves for 12 hours. 50% of the relieved anxiety comes back later as **deferred affect** through dreams.
- **Social feed:** flat retellings mean low juiciness. Observers form `Is(c, cold)`: "didn't weep at the funeral" adds +Oddness in attribution. Good for Veterans, doctors, and witch-finders, and bad for the bereaved who look unmoved.

**Regression** *(immature; "going to pieces"; relief 300)*
- **Trigger:** anxiety ≥ 700 with E < 35, or illness, starvation, or fae enchantment.
- **Target:** the self.
- **Sim effect:** Id thoughts act at half thresholds. The actor seeks the strongest Affection tie as a caretaker and refuses tasks. −2 INT and WIS checks. At T0 this is an episode.
- **Social feed:** seen as weakness (Respect −) or, by the Superstitious, as **affliction**. An afflicted actor's accusations carry `Ordeal`-like credibility with believers. That's the Salem "afflicted" pattern. Handle with care: the sim must show the afflicted as suffering, never as liars.

**Identification with the aggressor** *(neurotic; "running with the hounds"; relief 250)*
- **Trigger:** realistic anxiety plus Fear ≥ 60 toward a powerful actor or process that threatens one's group, with no exit.
- **Target:** that aggressor.
- **Sim effect:** copies the aggressor's key beliefs at credence `max(own, floor(theirs × 70 / 100) + 20)`, and their targets become one's own. Memory distortion rolls on related memories get advantage toward the aggressor's prop.
- **Social feed:** the friend who testifies. `04`'s Recruit nearly auto-succeeds, and Consensus jumps, because "even her friend says." Suspects under Heat name others to deflect. In witch mode, the witch who adopts the Prince's logic (§13.3).

**Sublimation** *(mature; "putting it to work"; relief 200)*
- Also an arbitration mode (§5.3). As a defense, it fires on persistent drive anxiety.
- **Social feed:** Respect +. **It isn't always benign:** a preacher's sublimated rage is a fire sermon, which accelerates rung 3+ Heat by 20–40% (`04` §9.3, inverted).

**Humor** *(mature; "making light"; relief 150)*
- **Trigger:** realistic or neurotic anxiety, E ≥ 55.
- **Target:** the threat's story.
- **Sim effect:** a tall tale or jibe. It spawns a rumor variant tagged `ridicule`.
- **Social feed:** listeners with Trust ≥ 20 in the teller get Superstition −1 for that prop (30 days), credence ×80/100, and their Heat contributions ×0.5. Humor is debunking: per `01` §4.6, debunking lowers Fae intensity, so ridicule of fae rumors lowers it slightly too (−1 local FI per 20 ridicule tellings in a season). The lumber-camp hodag joke is anti-fae magic.

**Somatization** *(immature; "a nervous complaint"; relief 200)*
- **Trigger:** moral or neurotic anxiety with no permitted outlet.
- **Target:** the body.
- **Sim effect:** a condition: Fatigued, a headache (−1 checks), a lame limb, or a fit. No pathogen.
- **Social feed:** an unexplained symptom invites Supernaturalization ("overlooked," "elf-shot"), which makes it a misattribution source like milk sickness. Never gendered: the same rule applies to everyone.

### 7.3 Cascades and damping

A witch-hunt is a **positive feedback loop across minds**:
1. Misfortune raises real anxiety.
2. Projection and displacement point it at a weak target, and rumors spread.
3. Hearing a fear-rumor adds real anxiety to listeners: `+floor(juiciness × Superstition_factor / 2)`.
4. Their defenses fire.
5. Reaction formation produces Catalysts, identification produces Consensus, and rationalization hardens it.
6. Meanwhile the target's counter-grudges create fresh "evidence."

**Dampers:**
- **Mature defenses:** humor and sublimation into work.
- **Restraining institutions:** a mercy sermon is a collective undoing, and a ritual reconciliation is an `A_S` discharge of 150 per attendee.
- **The doctor's natural explanation,** which lowers real anxiety.
- **Rising `E` across a community:** good harvests, sleep, full pantries. P8 matters here: hungry towns hunt. Starvation lowers E and raises anxiety.

---

## 8. The Jungian layer

### 8.1 Persona and the private self (C47)

**[PROPOSAL] One identity model across two owners.** An actor **wears** one or more **Personas** (10, psychological). Others perceive each Persona as a **Figure** (`04`, social), linked by `IsFigure` beliefs. Aliases (`02` Mountebank), witch cover identities (`06`), and passing are all Personas.

```ts
interface Persona { id: number; label: string;            // "the pious widow", "Mr. Lund the peddler"
  presents: { name?: string; people?: PeopleId; occupation?: string; congregation?: string;
              norms: Partial<Record<NormId, number>>; traits: TraitId[] };
  control: number;       // 0–100; Discretion lives here (derived Value = floor((control − 50)/15))
  strain: number;        // 0–100, computed: gap between presented and private self
  tells: TellId[] }      // content-defined leak cues (12 defines peoples' tells; 06 Drift tells)
```

- `strain = Σ |presented norm − actual norm| / count + 20 per secret held under this Persona`.
- Wearing a Persona in public adds `moral += floor(strain × (100 − control) / 400)` per hour. Masks are tiring.
- **Slips:** when drunk, at anxiety band ≥ 3, or in a Fit, observers roll Read People against `10 + control/5 − band`. A success reveals one private trait or one tell, as an Observation, and that becomes juicy rumor.
- `04` actors believe the Persona by default: presented traits seed `Is(...)` props at credence 50 for new acquaintances.

**Shadow-faekin passing [PROPOSAL, OPEN, framing only].** `00` says they're hidden. The ADR says they pass as human or elf and are known only through beliefs. 10 supplies the strain-and-slip machinery; `12` defines tells and what discovery means. The framing affects how much this reads as an analogy to racial passing:
- **A. Passing under prejudice.** Discovery stakes come from the simulated prejudice of `04`'s priors.
  - *Risk:* this reproduces real passing narratives, including the "tragic" trope and the passer framed as deceiver.
  - *Mitigation:* the sim must frame discovery's harm as the community's doing. Never treat the passer's Persona as a moral fault. No Insight reveal should label passing a defense.
- **B. Concealment as covenant.** Hiddenness is a fae-law or kin obligation ("we don't say what we are under the sky"), not a flight from prejudice. That decouples it from the racial analogy, and strain comes from Law, not fear.
- **C. Per-World choice**, or a blend in which communities differ.

I don't recommend among these. It's Ellie's call, and it depends on `12`.

### 8.2 The Shadow

`shadow: Record<TraitKey, number>` holds charges from 0 to 100 on drive and vice traits the actor disowns: high Id activity combined with a Persona or superego that denies it.
- Charge rises with repression, projection, denial of one's own urge, and reaction formation.
- It falls with Own-it events, confession, and integration (§8.5).
- **Shadow projection** is the content source for projection (τ must have charge ≥ 30).
- **Eruption:** at charge ≥ 80 with anxiety band ≥ 3, and drink, a Fit, or Fae intensity ≥ 3, the next arbitration adds `+charge` to the shadow drive's support. The result is an out-of-character act, flagged for the Chronicle.
- **Collective shadow [PROPOSAL]:** a per-settlement histogram of shadow charges (T2 aggregate, weekly). It biases `04`'s Moralization mutation and the traits rumor attaches to a Figure. A Temperance town's witch becomes a drunken temptress; a town in land disputes gets a luck-thief.

**The shadow-faekin echo [PROPOSAL, OPEN].** The deliberate resonance is that shadow-faekin are **projection magnets in the community's mind**: the rumor "faekin hide among us" draws the collective shadow, and anyone odd gets suspected. That's a mechanic about *prejudice*, not about them. A second, separable option is that shadow-faekin perceive others' Shadows (a Second Sight variant). That's lore for `12`, offered and not assumed.

### 8.3 Archetypes and complexes

**Complexes** are the psyche's working objects: feeling-toned clusters around an archetypal core.

```ts
interface Complex { archetype: ArchetypeId; charge: number /*0–100*/; nucleus: MemoryId[]; cues: CueKey[] }
```

When a cue is present (a person who fits the role, a place, a date), the complex **constellates**:
- It spawns thoughts in the archetype's voice.
- **Transference:** new acquaintances who fit the role get a base opinion seeded at `charge/5`% of the complex's associated opinion. A man whose father beat him meets the sheriff Cold.
- It biases distortion rolls.

**Archetypes as story roles.** Period names, with each Jungian original in parentheses:

| Archetype | Plays as |
|---|---|
| **the Hearth-Mother** (Mother) | Caretaker, or the smothering mother |
| **the Hag** (negative Mother) | The witch role. The town casts it on widows and herbalists |
| **the Patriarch** (Father) | Judge, creditor, pastor |
| **the Foundling** (Child) | Orphan, changeling |
| **the Peddler** (Trickster) | Mountebank, hob, hodag-teller |
| **the Cunning One** (Wise Old Man/Woman) | Braucher, almanacker |
| **the Pathfinder** (Hero) | Adventurer |
| **the Stranger** (Shadow) | Newcomer, drifter |
| **the Beloved** (soul-image) | Courtship |
| **the Prince** (Ruler) | The Faerie Prince embodies it |
| **the Ferryman** (Psychopomp) | The River, death |
| **the Wanderer** (Exile) | Witch-in-exile, deserter |

**Uses:**
1. The **Director and Chronicle** cast storylets by archetype (`04` §2's Wildermyth note; `05` sifting).
2. **ArchetypeFit** is an attribution term: the Hag archetype raises suspicion on widows who live alone and keep herbs. That's the historical bias, made explicit and inspectable.
3. **Figures carry archetypes:** "the Bluff Witch" is Hag-cast, and that shapes mutation.
4. **Possession [PROPOSAL]:** identifying with an archetype (complex charge ≥ 90 with individuation stage 0) drives behavior by script: the Hero who can't retreat, the Hag who stops pretending. This ties to Drift (§11).

### 8.4 Anima and animus, reframed

Jung's anima/animus is gendered, heteronormative, and essentialist. The options:
- **A. The soul-image (recommended).** This is Jung's own less-gendered term (*Seelenbild*). Each actor has one **soul-image**: the personified **unlived self**, made from the qualities they most lack. Its gender, age, and form are per-actor data with no rule tying them to the actor's own gender. It's what people fall in love with *too fast* (idealization: an Affection spike of 2× on Flirt, and a credence penalty on bad props about the beloved). **Fae lure with it:** a huldra or an Erlking's daughter wears your soul-image. A glamour that uses it is +2 DC.
- **B. Drop it** and fold it into the Shadow as its positive half (the "gold in the shadow").
- **C. A period belief only:** 1855 "separate spheres" thinking exists as norms that characters hold, while the mechanics stay A.

I recommend A, with C for texture.

### 8.5 Individuation ("Self-Culture") and Insight

**[PROPOSAL]** A long-arc progression driven by events, not grinding:

| Stage | Name | Advanced by |
|---|---|---|
| 0 | Mask-bound | — |
| 1 | The Shadow met | A shadow eruption, a dream of the shadow (§9), or a fae wearing your shadow's face |
| 2 | The Shadow owned | 3 **Own it** choices, a confession, or restitution for a shadow act |
| 3 | The soul-image met | A soul-image dream or lure, faced knowingly |
| 4 | The soul-image owned | Refusing the lure with open eyes, or a beloved seen clearly (an idealization reversal survived) |
| 5 | The Self glimpsed | A numinous event at FI 4–5 or near death, survived with stage 4. Rare |

- **Banking:** progress (0–1000 per stage) is banked out of order, but stages unlock in order.
- **Insight:** the self-legibility reward. Stage *k* reveals defense labels on your own thoughts for defenses whose maturity tier is ≤ *k*: stage 1 reveals immature defenses, stage 2 neurotic ones, stage 3 all of them. Before that, a self-check can reveal a defense: **Read People on yourself** against `DC 15 + floor(relief / 50)`. Self-knowledge is a skill you grow, and P1's "only the math your character could know" becomes a progression track.
- **Mechanical rewards:** +5 `egoStrength` per stage. The mature-defense gate drops by 10 per stage. +4 Will against glamours that use your soul-image once stage 4 is reached.
- **XP:** each stage is a `02` §6.6 story beat (250 × stage).
- **Calling [PROPOSAL for `02`]: the Dream-Reader.** Requirements: Read People 6, Lore (Fae) or Lore (Mental Philosophy) 4, individuation stage 3, and has read 5 dreams for others. It reads others' dreams (an Explain reveal of their thoughts at band level), counters hag-riding, walks a sleeper's dream at FI ≥ 3, and recovers repressed memories without the mesmerist's implant risk.
- **Witch:** Desperation's Hold, "your **shadow**" (`06` §3.3), blocks stage 2 until the shadow is reclaimed. The Prince literally holds what she can't own.

---

## 9. Dreams and the collective unconscious

### 9.1 Dream generation

One dream per sleep per actor at T0/T1. At T2, only sent dreams or anxiety ≥ 600 produce one.

**Material:** a weighted pick of 1–3 motifs (data, a dream-book dictionary) from:
- day residue (the top 3 memories by salience that day)
- repressed memories (×2 weight)
- shadow traits with charge ≥ 50
- complexes with charge ≥ 50
- frustrated drives (wish-fulfillment)
- deferred isolation affect
- a **sender's payload**

**Affect:**
- **Nightmare** if band ≥ 2, the sender is malicious, or a repressed motif is chosen: sleep quality −30 pts, anxiety +50 to +150, and a `fear` thought.
- **Wish dream** otherwise: anxiety −50 and mood +.

**Recall:** WIS check, DC 12. A remembered dream becomes `Memory{source: Dreamt}` at confidence 30. An unremembered dream still applies its affect. Repressed motifs give −30 anxiety now and +10 salience to the memory: the repressed returns.

**Evidence:** new EvidenceType `Dream`, `base = (Superstition + 3) × 25 / 100` (0 to 1.5). Some congregations credit dreams (data per church). This is **spectral evidence**, and it should feel as dangerous as it was in 1692.

### 9.2 The collective unconscious is Faerie's medium [PROPOSAL]

In-world names: the **Deep Commons**, Swedenborg's "spiritual world," Davis's "Summer-Land."
- Fae can't directly harm the unbargained (`01` §4.4), but they *can* send dreams. The dream is how Faerie talks to minds it can't touch.
- **Receptivity:** `Rcp = 10 + 10×FI(sleep tile) + floor(Drift/4) + 5×band + 10 (if exhausted) + 15 (Second Sight) − 15 (iron within reach) − 30 (cold iron) − 15 (open scissors or a horseshoe over the bed)`. A sent dream lands if `rng.int(0,99) < Rcp`.
- **Fae dreams are true but riddling.** Under Law (§10), a fae sender can't *assert* a falsehood, so the payload prop is one the sender believes, encoded as symbols. The dreamer's interpretation is where error comes in. That respects `05`'s rule that the Director only voices what a carrier knows (C43): fae senders are in-world carriers.
- **Bargains in dreams [OPEN]:** (a) a dream offer is only an *invitation*, and consent must be given awake (recommended); or (b) a dream bargain binds (horror, and very `06`).
- **Communal dreams:** when `A_S` ≥ 500 and a collective-shadow motif dominates, a Court may send the same motif to many sleepers at once. The result is simultaneous belief formation and a morning panic. A Court-level act with a Woe or Fae intensity cost (`06`).
- **The Prince speaks in dreams.** Proposed channel for `06`'s Behests and summons.

### 9.3 Hag-riding and other dream curses (`06` owns the curses)

**Hag-riding** (`06` #13) is a sent nightmare. The save and DC follow `06`. On a failed save, the dream lands regardless of Rcp:
- Sleep quality ×0.3, so `05` fatigue applies and `02` Fatigued follows.
- A `fear` thought at 70, +150 real anxiety, and a memory `Hag-ridden` (intensity 70, emotion fear).
- **The rider's face:** if the witch chooses to show herself, it's her face, which gives a truer link and a riskier "knows by whom." Otherwise it's whichever is higher: the sleeper's best `PF` candidate for a malice trait (rage or envy), or a Figure with notoriety ≥ 30. That face becomes an `Agent` role at role_conf 60, plus `Dream` evidence.

*The curse frames whoever the victim already resents.* Belief ×2 ("knows by whom") pays the witch either way (`06` §3.6). That's scapegoating as a side effect of the victim's own Shadow.

Other dream links: **the Fetch** (#22: the double is seen in others' dreams first), **Turn the Heart** (#19: withdraws the target's soul-image projection from the spouse), and **Pining** (#14: nightly wasting dreams, discharge blocked).

---

## 10. Fae minds (`09` gap #4, `04` Q5)

**[PROPOSAL] Fae are Id plus Law, with no Ego.** They run on the same Mind and Belief engine as humans, with these differences:

| Element | Human | Fae |
|---|---|---|
| Voices | Id + Superego | Id + **Law** (superego voice with `law: true`) |
| `egoStrength` | 5–95 | **0** (Hearth fae: see below) |
| Law | — | An absolute veto: options that break a bargain, lie, cross an iron line, enter uninvited, or break guest-right score −∞. Law produces **no guilt and no moral anxiety**. It's physics, not conscience (`01` §4.5) |
| Arbitration | §5.2 | `S = floor(V × 150 / 100)`: pure voices, no noise. **Guile** is a search over loophole templates: mislead-without-lying, harm-by-proxy, the letter of the bargain |
| Anxiety and defenses | Yes | **None.** A frustrated drive goes into an **Affront** store, which spawns grudges at half `04`'s thresholds. **Fae grudges and bargain memories never decay**, which makes `01`'s "grudges don't decay" literally true for fae and supports C12 option (a) |
| Persona | A mask over a self | **Glamour**: persona without a private self |
| Shadow | Disowned traits | None. They disown nothing. They *are* what the settlers disown, which makes them natural receivers of the collective shadow |
| Drives | §3.2 | `01` §4.2's fae needs map onto drives: tribute → `greed`/`hunger`; recognition → `envy` (be named, be remembered); novelty → `lust`/`longing`; propriety is **Law** (a breach of it enters the Affront store). Add `wildness` (rage at plows, surveys, iron) |

**"Cannot lie" in the Belief model.**
- **(a) Sincerity (recommended):** a fae can't assert a prop it holds at credence < 95 without a **hedge** ("it is said," "perhaps," "so the river thinks"). Fae can be *wrong*, but never insincere. A listener with Lore (Fae) ≥ 2 weights unhedged fae Statements at 2.5 (like Observation) and hedged ones at 0.5. Without the Lore they're an ordinary Statement (0.8). This builds on `04` Q5's suggestion.
- **(b) Truth:** the world prevents false utterances, which turns fae into ground-truth oracles. That breaks P1's epistemics. Not recommended.

**The Prince's opinion (C36).** `06`'s *desire* is a **drive with a target** (`lust`/`longing` toward a mortal: a fiddler, a child, the witch), not a fifth opinion dimension. Amusement maps to Affection, esteem to Respect, trust to Trust. No new dimension is needed.

**Hearth fae and the vestigial ego [PROPOSAL, lore for `01`].** Fae who have lived with a household for 20+ years grow `E` 10–30. With it come a little anxiety, defenses, and even guilt. The Prince's sneer that they've become *pets* gets a psychological reading: accommodation *is* growing an Ego. Whether any people (elves?) arose this way is `12`'s and Ellie's call. I'm only noting that the axis exists.

---

## 11. Cosmological hook [PROPOSAL]

**Faerie is the land's Id, the Ice is its Superego, and the settled, surveyed world is the Ego.**
- **Faerie** is appetite, the uncanny, and the unnamed. It is strong where minds haven't finished knowing it (`01` §4.2).
- **The Ice** (`01`'s "cold sovereign that makes the world flat, known, and sorted"; name it "the Ice" per C11) is the compulsive order of the survey grid, prohibition, and the till laid in rows.
- **The settlement** is the compromise formation: the mill dam is a negotiated settlement between the stream's appetite and the grid's order.

**Mechanical couplings (small, deliberate):**
1. Per-settlement psyche aggregates nudge Fae intensity. A high collective shadow plus fear-rumors raise it (`01` already lists fear-rumors). Humor and sublimation lower it.
2. Persecution is the **Ice's** work, not the Ego's. Rigid superego crusades (reaction formation, identification) count toward the Ice's quiet advance: the survey, the iron, and the organization that `01` §4.4 says the Prince's strategy feeds without admitting it. **Freud's point that the superego draws its energy from the id becomes cosmology:** the Prince's fear campaign powers the very Ice it fights. Only the Ego's middle way, the Hearth Court's accommodation, is sustainable.
3. **Drift as archetypal possession:** Drift thins the Persona (a −1 Persona `control` per 10 Drift above 40) and raises archetype charge. At Drift 100 you *become* an archetype with a body.

**[OPEN]** Does any in-world source ever say this outright? I recommend only fae intellectuals and one lyceum crank, held as beliefs (P1).

---

## 12. Period framing (1855)

Freud (*Interpretation of Dreams*, 1899) and Jung (c. 1912 onward) are decades away. In-world, the psyche is described by the schools that actually existed:

| School (real, 1850s America) | In-game role |
|---|---|
| **Mental philosophy** (Scottish Common Sense; college texts such as Upham's *Elements of Mental Philosophy*, 1831): intellect, sensibilities, will | The respectable framing. A Lore (Mental Philosophy) specialization, synergy +2 to Read People on psyche |
| **Phrenology** (Gall, Spurzheim; the Fowler brothers' American circuit) | **Faculty names as labels** (Alimentiveness, Amativeness, Combativeness, Acquisitiveness, Cautiousness, Approbativeness, Veneration, Conscientiousness, Secretiveness). Phrenologists are Mountebank NPCs; no racial content |
| **Mesmerism / animal magnetism** (Poyen's 1830s tours, "electrobiology") | The **Mesmerize** interaction: magnetic sleep recovers repressed memories (with Implant risk), discharges 200 anxiety, and plants a *suggestion* (an Implant belief). Lyceum fringe (`01` §5.3) |
| **Swedenborgian correspondences** (and the Midwest's own Swedenborgian missionary, John Chapman) | Dream symbolism and archetypes as **correspondences** between natural and spiritual things. Dream-readers' vocabulary |
| **Spiritualism and Harmonial philosophy** (1848 onward; A. J. Davis's *Summer-Land*) | Mediums and the collective unconscious as "the spirit world." Fae senders may be mistaken for the dead |
| **Moral treatment, "monomania," "nerves"** (Esquirol, asylum movement) | Fits, complexes ("a monomania"), anxiety ("nerves"). Asylums exist off-map and are shown honestly |
| **Pietist and evangelical soul-talk** (Haugean, Methodist, Catholic examen) | Superego as **Conscience**, Id as **the Old Adam** or **the Flesh**, guilt as **conviction of sin** |

**UI labels [PROPOSAL]:** period labels by default, with a **Clinical labels** setting that swaps in Freud and Jung's terms. Tooltips always show both.

| Clinical | Period default |
|---|---|
| Id / Superego / Ego | The Old Adam (or Appetites) / Conscience / **Self-Command** |
| egoStrength | Self-Command |
| Anxiety | Nerves |
| Defense | Self-deception |
| Repression / Denial / Projection / Displacement | Putting it out of mind / Won't hear of it / Laying it at another's door / Kicking the dog |
| Rationalization / Reaction formation / Undoing / Isolation | Special pleading / Protesting too much / Penance / Steeling oneself |
| Regression / Identification w/ aggressor / Sublimation / Humor / Somatization | Going to pieces / Running with the hounds / Putting it to work / Making light / A nervous complaint |
| Persona / Shadow / Complex / Archetype | Countenance / **the Hidden Self** (avoids the collision with shadow-faekin) / Monomania / Type (or Correspondence) |
| Soul-image / Individuation / Collective unconscious | the Beloved Image / **Self-Culture** (W. E. Channing, 1838) / the Deep Commons |

---

## 13. Integration

### 13.1 With `02` (replacing alignment)

- **Will and morale:** `Will = base save + WIS mod + Composure`. Morale checks (`02` §9.8) use the same Composure modifier. Results add anxiety: Shaken +50, Falls back +100, Flees +200. Panicked is a Fit.
- **Temptation vs. terror:** effects tagged `temptation` (Fair Words, fae food offers, bribes) add `floor((superegoStrictness − 50) / 25)` to the save. Effects tagged `terror` use Composure only. Rigid consciences resist temptation and break under shame.
- **Alignment-keyed effects** re-key to **live urges**. A *Protection from Evil* analogue wards against any actor whose current arbitration chose a harm urge toward the warded target. This is readable from the psyche, and no stored alignment is needed.
- **Divine Faith standing** (`02` §10.1): "deeds against the congregation's norms" = acts violating `church`-sourced norms *that became known* (public), plus private unatoned guilt (moral anxiety over 300). Atonement = undoing or confession.
- **No class has psyche prerequisites at creation.** Callings may: Dream-Reader (§8.5); Revivalist could use sublimated-rage sermons; Witch-Finder stays as written.
- **Feats and Hardships:** *Cool Head* adds +60 to Θ. *Faint of Heart* means E −15. *Drinker* means a craving thought with I +20. New Hardship: *Haunted* (a repressed trauma memory at intensity 80, dream weight ×3).
- **XP:** individuation stages are story beats. Sublimation feeds practice marks.

### 13.2 With `04`

- **Values:** become norms and drive weights, with derived views (§3.3). Superstition, Rancor, and Discretion as argued.
- **Mood:** = Σ thought mood (thoughts are 10's).
- **Memory:** new flags `repressed`, `isolated`, and `deferred`, plus source `Dreamt{sender?}` (already in `04` §4.1).
- **Belief:** new EvidenceTypes `Defense{kind}` (shown to the holder as Inference or Confabulation) and `Dream`. Denial applies an evidence-weight clamp.
- **Attribution (`04` §5.4) additions,** in ×100 fixed point:
  - `+200·PF(b,c,τ(m))/100`, applied if b has τ in an active projection (shadow charge ≥ 30, or projection fired within 30 days)
  - `+150·DF(b,c)/100`, applied if b's displaced store is > 0
  - `+100·ArchetypeFit(c, hag)`, applied for supernatural misfortune kinds
  - `weight(Natural) −= 50 × band`: an agentless explanation doesn't discharge anxiety
- **Heat (`04` §9.1):** `P_h × 125/100` for defense-sourced grudges and hostility (projection, displacement, reaction formation).
- **Catalyst weight:** +30 for reaction formation toward T, +20 for projection.
- **Rung ownership** stays with `04`. 10 never sets rungs.
- **New interactions:** Confess (to a preacher: one-shot discharge of 150, with secret leak risk), Read a Dream, Mesmerize, Mock (triggers the humor defense in the speaker or the audience), Penance.
- **Need registry:** §3.4.

### 13.3 With `06`

**The Pact is an Id bargain.** The Prince bargains with appetite, and each Origin keys a drive:
- Debt and Desperation: `hunger`/`greed`/`fear`
- Revenge: `rage`
- Stolen Child: `longing`
- Ambition: `greed`/`envy`
- The Accused: identification ("if they call me witch...")
- Inheritance: superego `duty`, an inherited norm

The **Hold** clamps the psyche:
- "your anger": the `rage` drive can't drop below 60
- "your shadow": blocks individuation stage 2
- "your heart": Affection toward anyone is capped at +40
- "your name": Persona `control` −20

**[PROPOSAL] The introjected Prince.** On binding, the witch gains a `pact`-sourced norm voiced by the Prince ("*The moon wanes. Remember what you owe.*"), carrying Behests and the Tithe. The witch has **two superegos**, and her old one (Mother, the Pastor) forbids what the new one commands. That conflict is the mode's moral engine without a morality meter (`06` §3.11):
- **Obedient** play is identification with the aggressor.
- **Defiance** sides with the old conscience.
- **Minimal harm** is compromise.
- **The Discerning Witch** runs on rationalization, and the epilogue can say so.

**Woe read through the victim's psyche [PROPOSAL; `06` owns the formula].**
- **Suffering:** `S = min(5, floor(moodLoss/10) + floor(anxietyGain/100))`, counting only what's attributable to the curse.
- **Psyche modifiers:**
  - Denial caps the Belief tier at *Unaware* (×0.25).
  - Isolation gives S −1.
  - Humor gives S −1 and caps Belief at *Uneasy*.
  - Projection or displacement onto *anyone* reaches *knows by whom* (×2).
  - Repression drops today's S to 0 but adds S +1 to that night's nightmare.
  - `06`'s ×0.8 weekly habituation is ego adaptation.
- **Result:** curses on calm, skeptical, humorous people yield little. Curses on the frightened, the superstitious, and the rigidly righteous yield the most. Woe is fed by the same minds that hunt witches.

**Weaknesses** (`06` owns them, keyed to Drift and the pact). 10 adds only voiced thoughts ("*Iron sings against your teeth*") and the Drift effects on Persona (§11).

---

## 14. Implementation

### 14.1 Data model (all integers)

```ts
interface Psyche {
  egoStrength: number; superegoStrictness: number; idAppetite: number;   // 0–100 (ADR)
  drives: Partial<Record<DriveId, number>>;          // 0–100, default 50
  norms: NormHold[];
  anxiety: number;                                    // 0–1000 (ADR)
  anxSrc: { real: number; neur: number; moral: number };
  thoughts: Thought[];                                // ≤12 (T0/T1), ≤4 (T2); recomputable except maskedBy
  frustration: Partial<Record<DriveId, number>>;      // consecutive-cycle streaks
  defenseStyle: Partial<Record<DefenseId, number>>;   // 0–100, default 10
  defenseReady: Partial<Record<DefenseId, GameMinute>>;
  displaced?: { amount: number; object: EntityRef; category: string };
  personas: Persona[]; activePersona: number;
  shadow: Partial<Record<TraitKey, number>>;          // 0–100
  complexes: Complex[];                               // ≤4
  soulImage?: { form: string; traits: TraitKey[] };
  individuation: { stage: number; bank: number[] };   // stage 0–5, bank 0–1000 per stage
  insight: number;                                    // revealed tier 0–3
  lastArbitration?: ArbitrationExplain;
}
interface DefenseEvent { kind: DefenseId; actor: ActorId; at: GameMinute;
  trigger: { pool: 'real'|'neur'|'moral'; amount: number }; target?: EntityRef;
  effects: EffectRef[]; relief: number; explain: Explain /* knowledge 'omniscient' until Insight */ }
```

Defenses are **events** in the log (ADR), so they appear in the Chronicle and can be sifted ("a projection that became a rung-3 shunning").

### 14.2 Determinism (C49)

- **Formulas are already integer:** linear terms, `floor` of integer products, and `/100` or `/1000` scaling. No transcendental Math.
- **Decays** use per-step fixed-point multipliers (`x −= floor(x × r / 1000)`). Repeated application approximates `exp(−t/τ)` with error < 1 point over 1,000 steps at these scales. That's acceptable, and it's identical across engines.
- **Credence math** reuses `04`'s integer logit table (C49 recommendation). Where 10 hands `04` a "credence," it's a 0–100 integer.
- **Randomness:**
  - stream `psyche`, keyed with `mixKey(actorId, minute, SALT_*)`
  - `SALT_ARB` for arbitration noise and checks, `SALT_DEFENSE` for defense picks, `SALT_DREAM` for dream material and landing
  - all choices via `rng.weighted` with integer weights
  - no new stream is needed
- **Iteration:** thoughts are ordered by (intensity desc, key asc) and options by (score desc, ref asc). Comparators are total.
- **System order** per tick: needs → thoughts → arbitration → anxiety → defenses → (`04` belief, opinion, rumor) → at wake: dreams.

### 14.3 Content (TOML)

The content domains are `drives`, `norms`, `thoughts` (generators), `compromises`, `sublimations`, `defenses` (gates, relief, trait-on-70), `motifs` (the dream-book), `archetypes`, and `voices` (per-culture template banks).

```toml
[[defense]]
id = "projection"
tier = "immature"
relief = 250
pools = ["neur", "moral"]
needs_shadow = 30
evidence = "defense_projection"
acquired_trait = "suspicious"
```

### 14.4 Performance by tier

| Tier | What runs | Cost (estimate; benchmark at M2) |
|---|---|---|
| **T0** (≤ 40 actors) | Event-driven thought regeneration plus a 10-minute sweep; arbitration at decision points; defenses event-driven; a dream per sleep | ~20 µs per arbitration; negligible per frame |
| **T1** (300–500) | Hourly: top-12 thoughts, ≤ 8 options, one anxiety update, a defense check; dreams per sleep with ≤ 30 motif candidates | ~10–20 µs per actor-hour, so 3–10 ms per game-hour at 500 actors in TS; 30 actors ≪ the ADR's 5 ms |
| **T2** (named) | **Daily coarse step:** anxiety += the day's delta from needs, misfortune, and rumor exposure (aggregate thoughts: 4 drive and norm sums); at most one defense per day, and **only the socially consequential ones (projection, displacement, identification, denial, reaction formation) resolve individually**; the others fold into discharge. Dreams only when sent or at anxiety ≥ 600. Shadow, complex, and `A_S` aggregates weekly. Individuation frozen | ~1–2 µs per actor-day |
| **Census** | No psyche; generated lazily from `hash(seed, censusSlot)` with culture priors at materialization | 0 |

**Promotion (T2 → T1):** thoughts are recomputed from state. Anxiety, style, shadow, and masked thoughts persist. Defense events from T2 are already real events, and `04` backfill may cite them.

### 14.5 Implementation notes (checked 2026-10-10 against `packages/`)

The psyche code is a scaffold, still being written. I read `core/src/urge.ts` and `core/src/psyche/{state,api,events,system,view}.ts`; `psycheSystem` and `addThought` are still stubs. I also read `content/src/schema/psyche.ts`, `needs-activities.ts`, and `content/base/peoples/peoples.toml`.

**Aligned:**
- The flow: proposals from modules → Thoughts → hourly Ego arbitration → a `ChosenUrge` with a `'self'` Explain. The system runs right after needs.
- `Urge.kind 'defense'` with a `targetId` is executed by social, and projection forms beliefs through the belief API. Both match §7.
- The `psyche.defense` event carries anxiety before and after.
- Psyche numbers 0–100, anxiety 0–1000, needs 0–1000 with 1000 = satisfied, and the `psyche` rng stream.
- Trait `voice_pct` and `urge_bias` apply as multipliers on I.

**Divergences (the doc is the target):**
1. **Intensity scale.** Code thoughts are **0–1000**, and the doc uses 0–100. Keep the code's scale and read every doc intensity ×10. Thresholds such as `I ≥ 15` become `≥ 150`.
2. **Thought identity.** Code thoughts carry `voice` + `source: ModuleId` + `label`. The doc adds `drive`, `norm`, and `speaker`, which are needed for defense fits, voiced speakers ("Mother:"), and per-drive frustration streaks. Add them to `UrgeProposal`.
3. **The `'command'` voice.** Player Commands enter arbitration as proposals. Per §5.5(b), a command must **always win** unless a Fit is active and the Fit toggle is on, and it should book anxiety from the voices it overrode. Arbitration must not be able to outscore it.
4. **P1 leak in `view.ts`.** `recentDefenses` (and `shadow`) are exposed to the perspective actor through `canSeeMind`. Per §1 and §8.5, defense labels are `'omniscient'` until Insight. The self-view should show masked thoughts only, and labels up to the actor's `insight` tier.
5. **Missing state.** `anxSrc` (the three pools), drives and norms, `defenseStyle`, `displaced`, Persona as a struct (code: a `persona: string` label), shadow charges (code: a `shadow: TraitId[]` list; for M1, read each as charge 60), complexes, and individuation.
6. **`DEFENSE_IDS`** has 7 entries, a fine M1 subset of the 13. Trait `defenses` is percent with 100 as neutral; map it as `style = 10 × pct / 100`.
7. **Values.** Trait `values` shift the stored `04` Values (`VALUE_IDS`). The target is norms with derived views (§3.3). Keeping Values for M1 is acceptable with a later migration (`strength = 50 + 15 × value`).
8. **`ScheduleBlock.duty`** (0–1000) becomes a `duty` superego thought at I = duty. This is consistent with item 1.

**`peoples.toml`:** it has no psyche fields, which is correct (§1). `shadow_faekin.cold_iron_sensitive = true` is a `12`/`06` call, not a psyche one.

---

## 15. Worked examples

Names are **illustrative, not canon** (C7). Numbers follow the formulas above. The `04` terms use `04`'s published weights.

### 15.1 Scapegoat cascade without a witch: the trembles at Iron Ford

**Cast:**
- **Anders Moe**, dairy farmer, Haugean. E 35, strictness 75, idAppetite 55. Drives: envy 70, rage 60. Norms: piety 85, thrift 80 (Father). Superstition +1, Rancor +2. Style: projection 40, displacement 30, undoing 20, denial 10, rationalization 10. He owes **Asa Crane**, land agent, $140 (Fear 55, Respect 40).
- **Widow Liesl Ebner**, German Catholic braucher, lives alone. Her cows graze the open meadow.
- **Halvor Rud**, Haugean lay preacher. E 40, strictness 85, lust 55 toward Ebner (forbidden for months). Reaction-formation style 50.
- **Kari Lund**, Ebner's friend. E 30, Fear(→Rud) 60.
- **Ole Strand**, tavern wag. E 65, humor style 50.
- M = 0.25.

**Day 1 (Aug 14).** Two of Moe's cows tremble and one dies: milk sickness from white snakeroot in the woodlot where he pastured them to save meadow rent (`05` §6.5). His thoughts at 6 pm: Id fear 52 ("If the herd goes, Crane takes the farm"), Id rage 60 ("Somebody did this"), Id envy 45 (passing her fence: "Her cows fat as butter"), and Father 50 ("You put them in the woodlot to save the rent"). He tends the herd. That cycle adds neur 39 + 29, real 33, and moral 37 (live guilt, ×75/100), for **+138**. Sustained cycles add about 35 an hour, and he sleeps badly. By morning, anxiety is **450** (real 160, neur 170, moral 120), against Θ = 250 + 105 = **355**.

**Day 2: projection.** Fits: projection 3 (envy shadow 70), displacement 2 (rage at Crane, power 55), and 1 each for undoing, denial, and rationalization. Weights: 120 / 60 / 20 / 10 / 10. `rng.int(0,219)` gives 87, so **projection**. PF(Moe→Ebner, envy) = 12 (she "always looks over the fence," H 0.40) + 16 Odd + 12 Out + 15 dislike + 13 Weak = **68**, and the next best is 31. Moe forms `Is(Ebner, envious_of(Moe))` at **39**, and anxiety drops to 200 (band 1). Attribution reruns (cattle sickness → τ = envy):

| Candidate | Terms | Weight |
|---|---|---|
| Ebner | 1 + 1.2 Odd + 0.6 Out + 0.2 dislike + 0.8 KnownMagic + 0.4 Hag + **0.58 Motive (from the projected belief) + 1.36 PF** | **6.14** |
| Natural | 2 − 1.5 + 0.75 − 0.5×band 1 | 0.75 |
| Crane | 1 + 0.6 Motive | 1.6 |
| 6 others | 1.0 each | 6.0 |

Ebner's share is 6.14 / 14.49 = **0.42**, which clears 0.35 and leads by more than 1.5×, so Moe forms `Caused(Ebner, cows)` at **42**. *Without the projection* (and with band 2, which puts Natural at its 0.5 floor), her share is 4.2 / 12.3 = 0.34, and **no belief forms.** The Explain, omniscient until Insight, shows exactly which term tipped it.

**Day 3: displacement.** Crane comes to dun Moe. Rage at Crane reaches 70, but Crane's power is 55 and Fear suppresses the Insult, so the displaced store fills with 70. Anxiety is back to 410. Displacement (fit 3, weight 90) beats projection (42) on the roll. DF(Ebner) = 9 Sim ("a neighbor doing better than me") + 27 Weak + 20 Avail (Saturday at the store) + 20 dislike = **76**; the hired boy scores 48. At the store, in front of 6 people, Moe **Insults** her: "Keep your eye off my cattle." `04` applies Aff −15, juiciness 0.4, and gives Ebner a humiliation memory at 72. Moe's grudge spawns (Rancor +2, Aff −45) at intensity 60 with aim Expulsion. Heat = 60 × 1 × 1.0 × **1.25** = 75.

**Day 7: reaction formation.** Rud hears the story at credence 35. His forbidden lust (40, opposed by propriety at 81) has put him at 380 against Θ 370. Reaction formation scores 150 against 30 and 20, and fires. The urge flips into a crusade ("Expose / Preach at Ebner," I 60), and his credence rises to 50. On Sunday he preaches on "the envious eye" at credibility 1.4. Heat = Rud 225 (60 × W 3 × 1.25) + Moe 75 + 8 new holders 112 = **412**. Consensus is 0.38, and M 0.3 scales thresholds by ×0.895, so **rung 3, shunning**.

**Day 12: identification.** Lund was seen at Ebner's door, which marks her a "suspect sympathizer" (`04` #32). Her anxiety reaches 340 = Θ, and she **runs with the hounds**: she adopts `Caused(Ebner)` at 50×70/100 + 20 = 55. Her memory of Ebner "humming over the churn" distorts into "muttering over the fence." A friend's testimony carries a plausibility bonus. Consensus **0.52**, and **rung 4**: a petition to the JP.

**Days 15–17: damping.** At the tavern, Strand's humor fires (450 against Θ 445). His tall tale is that the cows "took one look at Moe's account book and lay down." For his 14 listeners: Superstition −1 on the prop, credence ×0.8, and Heat contributions ×0.5. Dr. Fenwick returns and names it milk sickness (DoctorSaid +2). For Moe, guilt flares ("Thou shalt not bear false witness," I 45), and **rationalization** fires ("Yankee doctors don't know cattle," `Is(Fenwick, ignorant)` at 60), along with **denial**, which clamps the diagnosis to ×0.25. Moe holds at 55. The congregation and the tavern split, and the rung drifts back to 3 unless something fresh happens. Ebner's counter-grudge is a live seed.

**Epilogue line:** *"Nobody cursed Anders Moe's cows. White snakeroot grew in his woodlot. Moe laid his envy at the widow's door; Halvor Rud preached against what he wanted; Kari Lund ran with the hounds she feared."*

At T2, the same story runs as daily coarse defense rolls for the three named actors with notable states, and `04` individuates Catalysts.

### 15.2 An adventurer's inner life: Josiah Penhallow, day 6 of a wet expedition

**Josiah** (`02` §14, now level 2): E = 40 + 4 + 1 + 2 (noise) = **47**. Strictness 55, idAppetite 50, hunger drive 60. Norms: thrift 60 (Mother), temperance 70 (Chapel), duty 60 ($12 owed to Pratt), piety 45. Defense style: isolation 30, denial 20.

**Situation:**
- Rush Creek is up, so it's 4 more days to town.
- Food left: 2 lb hardtack, 1 lb salt pork, 1½ lb cornmeal, 1 lb dried apples, ¼ lb sugar. That's about 10,900 kcal against a travel burn of about 3,600 per day (per the `05` rate; kcal per `03`; placeholder values).
- The coffee ran out yesterday.
- Serious arm wound, rain, Fae intensity 3 at camp, a Sunday. Morning anxiety 380.

**Inner Voices** (period labels):

| Voice | Line | I | Mood |
|---|---|---|---|
| Appetite | "Eat the apples. All of them." (base 36 → 43 + food-in-hand 15) | 58 | −3 |
| Appetite | "Hardtack again." (monotony, P8) | 30 | −6 |
| Appetite | "One cup. Just one." (coffee craving) | 25 | −4 |
| Sloth | "Stay under the blanket; the traps can wait." (30 + wound 12 + wet 10) | 52 | −5 |
| Dread | "Something walked the ridge last night." | 44 | −4 |
| Longing | "The fiddle in the hollow. Go and listen." | 25 | +2 |
| Pratt | "Twelve dollars. Bring back pelts." | 33 | — |
| Mother | "Waste not, want not." (60×105×100/15000) | 42 | — |
| Chapel | "It's the Sabbath." | 18 | — |

**Breakfast arbitration** (noise ±10):
- **Eat freely:** R −20 (food runs out on day 3 of 4), V = 58 − 42 = +16, so S = −10 + 16 − 2 = **4**.
- **Ration ⅔:** R +30, V = 42 − 58 = −16, so S = 14 − 17 + 3 = **0**.
- **Compromise check** (within 20, opposite agencies, template `ration_with_treat`): DC 10 + 42/10 = 14. Roll 15 + egoMod 0 − band 1 = 14, so it **succeeds**.
- **Verdict:** *Self-Command: half the apples, then the ration (14 vs 14).*
- Hunger is 50% satisfied and thrift 70%: neur +15, moral +6.

As the player, overriding to "eat freely" shows the cost "+23 Nerves (Conscience)," and the panel adds a voiced Mother line. Overriding to "strict ration" shows "+30 Nerves (Appetite)." Either way, **the Readiness panel's "days of food at current rations" stays exact** (§1).

**The day.** He checks traps in the rain: duty beats sloth (+27, then about 6 an hour), and fear rises at dusk (+23). Evening anxiety is about **458**, against Θ = 250 + 141 = **391**. Isolation (fit 2 × style 30 = 60) beats denial (40), rationalization (10), and regression (10); sublimation and humor are gated because E < 55. **Isolation** fires: the fear thought halves, tonight's memories encode ×0.5, and anxiety drops to 258, with **100 deferred**. His panel shows only *"Steady. Do the next thing."* The Insight self-check (DC 19) fails, so the label stays a hatched "?".

**The hired hand.** Ben Swale (E 28, rage 60) is angry about the short rations, but his employer has power 50, so the rage displaces onto the mule (DF 78). He strikes her. Molly's Fear rises, and Josiah sees it (Aff toward Ben −8). In town, Ben will rationalize, and `04` will carry the rumor *"the stranger starved his man."*

**Night.** Rcp = 10 + 30 + 1 (Drift 6) + 5 + 10 (exhausted) − 15 (rifle and hatchet in reach) = **41**. A huldra of the Prince's Court sends a dream, and `rng` gives 23, so it **lands**. Its material is the deferred fear, his longing, and the payload *"there is bread in the hollow, and a fire."* Josiah's soul-image (generated at creation from unlived traits: ease, music, light) appears as **a fiddler in a lit doorway**. The wish discharge (−50) cancels the returning fear. He recalls the dream (14 against DC 12), and the next day Longing is at 45.

**Dusk, day 7.** The fiddle sounds in the hollow: a glamour wearing his soul-image, at Will DC 15 + 2 = **17**. With Will +1 and Composure −1, Josiah needs a natural 17. The player's options:
- **Grip the hatchet.** The iron breaks the glamour, but by `03`'s *Blind* rule he can't find the place at all.
- **Go without iron, eyes open, and refuse the bread** (`01` hospitality). That banks **200** toward individuation stage 3 and earns a **250 XP** story beat. A stage-4 Josiah would later face this glamour at +4.
- **Go and eat.** `06` Drift and `02`'s Bound chain apply.

### 15.3 Hag-riding read through the victim (witch mode)

**Grete Vosberg** (`02` §14.2, Witch 1) rides **Carl Ahrens**, whose household spread the poisoned-well story.
- Carl: E 45, strictness 60, Superstition +2, anxiety 220.
- Link: worn clothing +3. Dark moon +1. DC = 10 + 1 + 3 + 1 = **15**.
- Carl has a Bible under his pillow (+2, `06`): Will +1 + Composure (0 − 1) + 2 = +2. He rolls 9, for 11. **The save fails.**

**Grete's side.** The Prince's voice ("The Tithe is short," I 50, a pact norm) against Mother's ("Thou shalt not," I 48). She casts, and takes moral anxiety of 48×60/100 = 28. By morning, **rationalization** has fired: `Deserved(Ahrens)` at 60, "they called me a poisoner first."

**Night 1.** Grete hides, so the rider's face is the higher of Carl's best malice PF and his top Figure. His brother-in-law **Fritz Kähler** (a land dispute, envy shadow 55) scores PF **64**. The figure "the Kettle Witch" (Grete, credence 60) scores **60**. **The face is Fritz's.**
- **Effects:** sleep ×0.3, then Fatigued; fear 70; anxiety +150 → 370. Memory: *"a weight on my chest, and Fritz Kähler's face."*
- **Belief:** Dream evidence weighs (2+3)×25/100 = 1.25, which puts `Caused(Fritz, riding)` at 38.
- **Woe:** S = min(5, 2 + 1) = **3** × *Uneasy* 0.75 = **2.25** (225 centi-Woe).

**Night 3.** Anxiety is 590, and **displacement** lands his rage at the rider on Fritz. `Caused(Fritz)` reaches 55, which is *knows by whom*, ×2: S 4 → **8 Woe per day, for the wrong man.** Fritz's suffering as the accused also counts as Woe (`06`). The feud now belongs to the Ahrens and Kähler households. When Grete hears of it, Mother's guilt jumps to 70, and undoing becomes a candidate: lift the curse on night 5, or let it run. The epilogue counts her rationalizations and her undoings.

### 15.4 A fae mind: the nisse at Haugen's mill

At Yule, the porridge comes **without butter** (a `01` §5.5 tribute breach).
- Tribute (`greed`) is frustrated at I 70, so Affront +70. A grudge spawns at half thresholds, and it **never decays**.
- E = 0 (the nisse has lived at the mill 12 years, short of the 20 needed for a vestigial ego).
- **Options:**
  - Harm the household: Law forbids it (hospitality), so −∞.
  - Sour the cream: V 70.
  - Tangle the horses' manes: V 55.
  - Leave the mill: V 40 (novelty).
- **It sours the cream.**

The PC asks, "Did you sour the cream?" The nisse can't speak insincerely. It answers, unhedged at credence 100: *"Butter forgotten, cream remembers."* The PC has Lore (Fae) 2, so the statement weighs 2.5 and the PC's belief "the nisse soured it over the butterless porridge" lands at about 85. Without the Lore, it weighs 0.8 and lands at about 55. That gap is the Lore skill's value.

---

## 16. Open questions for Ellie

1. **The PC and the Ego (§5.5):** (a) advisory only, (b) advisory with an anxiety cost on overrides *(rec)*, or (c) (b) plus forced Fits behind an off switch?
2. **Labels (§12):** period labels by default with a clinical toggle *(rec)*, or clinical by default? Any period terms you love or hate (Self-Command, Nerves, the Old Adam, Self-Culture)?
3. **Soul-image (§8.4):** A, an ungendered soul-image *(rec)*; B, fold it into the Shadow; or C, keep it only as period belief?
4. **Shadow-faekin concealment framing (§8.1):** A (passing under prejudice), B (covenant), or C (per World)? I've deliberately not recommended one. This is probably a `12` conversation.
5. **Values (§3.3):** OK to fold six of `04`'s Values into norms and drives while Superstition, Rancor, and Discretion stay dispositions? Add Propriety, Temperance, and Honesty?
6. **`egoStrength` from WIS (§3.1)?** It aligns with `02`'s Will and morale.
7. **Spectral evidence (§9.1):** should dreams count as evidence in-world at all, weighted by Superstition and congregation? *(rec: yes. It's historically central and terrifying.)*
8. **Dream bargains (§9.2):** invitations only *(rec)*, or binding?
9. **Fae "cannot lie" (§10):** sincerity with hedges *(rec)*, or truth?
10. **Introjected Prince (§13.3):** do you want the witch to carry the Prince as a second conscience?
11. **Individuation (§8.5):** is "progression = self-knowledge (Insight reveals your own defenses)" the right reward? Should the Dream-Reader Calling exist?
12. **Cosmology (§11):** keep it as hidden structure with a few couplings *(rec)*, make it explicit lore, or drop it? Should any in-world voice ever say it?
13. **Content lines:** Fits (how intense, and do they toggle?); the `lust` drive and seduction urges (toggles?); regression rendered as "affliction" in witch hunts.
14. **Need registry ownership (C38):** may 10 own the need-to-drive registry (§3.4) while `04` and `05` keep semantics and rates?
15. **Eighth drive:** OK to add `longing` to your seven?
