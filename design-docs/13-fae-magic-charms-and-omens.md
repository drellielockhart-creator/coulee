# 13: Fae Magic, Charms, and Omens

> **Synthesis draft, 2026-10-11.** This doc answers Ellie's 2026-10-11 decisions-log entry (`00`) on four things: fae **omens** keyed to Fae intensity; **fae magic anyone can learn**, at a cost; **fae charms that find their way into settlements and disrupt them**; and charms as **real P8 gear**. It also answers two playtest-triage findings: "Nothing fae in 8 days" and "`look` has no place description". It merges two independent drafts; Appendix A says what came from where.
>
> Tags: **[DECISION]** comes from `00`, an ADR or Ellie · **[PROPOSAL]** needs Ellie's sign-off · **[OPEN]** is unresolved. Code names were checked against `packages/core/src` and `content/base` on 2026-10-11.

**This doc owns:**
- the omen catalog, its keys, per-place **thinning**, and the fae layer of place descriptions;
- fae **workings** and the **Tally**;
- the `charms` content domain and the **conservation rule**;
- fae **agency effects**: what a charm or working may do to a will;
- arrival vectors and the "The Charm at ‹town›" pattern.

**It doesn't own:**
- FI, the courts and the Forfeit Rule (`01`);
- checks, skills, feats and folk charms (`02`; this doc proposes entries);
- item fields and the Book (`03`);
- beliefs, rumor, grudges and the ladder (`04`);
- the Director (`05`; this doc proposes nudge N13);
- Drift, weaknesses, Woe, the Tithe and curses (`06`);
- thoughts, arbitration, agency mode storage and dreams (`10`);
- peoples' data (`12`).

---

## 0. The doc in twelve lines

1. **Omens are events, not flavor text.** Each has witnesses, an Explain and at least one consumer: a belief, a thought, a pantry, a price or a chronicle line. An omen nothing reads doesn't ship.
2. **Every omen has a mundane lookalike**, rolled by the same system. Skeptics are right in town and wrong in the coulee.
3. **Omens thin a place.** Witnessed signs and fear-talk push a per-place `thinning` score through four stages: Signs → Portents → Visitations → Incursion.
4. **Places get a stable signature plus episodes.** `look` never rerolls. Dusk is when coming back pays off.
5. **Faerie makes nothing; it moves things.** No fae effect creates kcal, cents or stacks. Goods come from a source the sim names. Soft goods (rest, warmth, luck) are borrowed against strings.
6. **Fae magic is courtesy with a counterparty.** Anyone can learn a working through teachers, books, studied charms or bargains. It's rolled on **Fae Courtesy** and paid on the **Tally**, a debt to the court whose ground it was.
7. **The witch is a Tally that was bought.** A dabbler deep in debt is `06`'s Debt Origin waiting to happen.
8. **A charm is an ordinary `03` item plus a `charm` record.** The record holds virtue (charges), recharge, iron behavior, quirks, strings and allure, plus the **TRUE** function. The **BELIEVED** function exists only in people's beliefs.
9. **Desire reads the believed function; harm reads the true one.** The gap is the story.
10. **The disruption arc has no state machine.** A charm runs four small processes (virtue, draws, strings, allure). Interactions, beliefs, misfortunes, grudges and the ladder do the rest, and a chronicle sifter names what happened.
11. **The charm beats institutions, not anyone's intelligence.** The law, the mill, the store, the pulpit, the Hall and the Club each answer it competently, and each answer fails in its own way.
12. **The PC keeps high agency.** Charms and omens speak to the PC's psyche but never act for it. The one exception is an explicit, capped and disclosed **agency-transfer** effect (§2), which works on any actor's agency mode.

---

## 1. Ground rules [PROPOSAL]

1. **Sim first (P1).** Every omen, working and charm effect is an event with roles (including witnesses), an Explain with a `knowledge` level, and at least one consumer.
2. **Lookalikes everywhere.** Mundane signs (fox fire, a lantern on the ridge, settling rock, rats) are rolled alongside true ones. Ground truth rides on the event as `truth: fae|mundane` at `omniscient` knowledge. This is `12` §7.2's tell model applied to the landscape. It keeps the fae layer an epistemic problem rather than a light show, and it guarantees false positives by construction.
3. **The conservation rule.** No fae effect increases Σ kcal, Σ cents or stack count.
   - A never-empty sack *draws* flour from a store three miles off. A returning coin takes itself back out of a till.
   - Rest, warmth, luck and labor are *borrowed*, and the charm's strings say who repays.
   - The one standing exception is fae food, which is glamour (`fae_food`: kcal counts as 0, already in `provisions/meals.ts`).
   - Why: it is `03` §8.7's fae economy stated as physics. It keeps P8 honest, and it makes fae the one system that cannot mint money, at the moment the playtest found wages "minted with no payer".
4. **The narrative shape only.** Ellie named a narrative shape: one genuinely useful, genuinely strange object arrives, and a community's story becomes the object's story. No characters, scenes, framing or visual homage carry over from the source she referenced.
   - Nobody in Hollin County is naive about property, money, law or God. 1855 Wisconsin has *more* institutions to disrupt than most places: claim clubs, wildcat banks, replevin suits, a Haugean schism, benefit societies, the Deep Accord.
   - The charm disrupts because it is **correctly understood as valuable and wrongly understood as free**. A miller can understand the sack perfectly and still fear what it does to his trade. A congregation can identify a dangerous string correctly and still disagree over whether hungry neighbors should use the object.
   - No people is the charm's natural owner or natural victim. Arrivals are never weighted by people or culture (`05` §8.3), and the sovereign neighbor gets no windfall.
5. **Settler folklore only (`01` §2.1).** Sources are Norwegian, German, Cornish, Irish, Yankee and lumber-camp lore.
   - **Effigy mounds, burial sites, rock art and found stone points are never omen sites, anchors, loot or recharge stations.**
   - The only earthwork is the explicitly fictional **fae barrow** (`fictional = true`). "Mound" is not an eligibility tag.
6. **No new currency.** Woe stays the one fungible fae currency (`06`). Charm charges are per-item **virtue**: non-fungible, not poolable, like the oil in one lamp. "Glamour" keeps meaning illusion. The Tally is a debt, not money.
7. **Naming.** `02` §10.3 already uses "charm" for a **folk charm**: a mortal-made, sellable spell-object. This doc's objects are **fae charms**: fae-made, with virtue, strings and a will of their own. Code and UI say "fae charm" wherever the two could be confused.
8. **P2.** NPCs notice omens, learn workings and covet charms by the same rules as the PC.
9. **Determinism.** Add one RNG stream, `fae`. Views never consume RNG: descriptions pick lines by `hashString32`. All state is integer, and multipliers are per-mille, applied in a fixed order and rounded once.

---

## 2. Agency: fae effects and the commanded PC

### 2.1 The rule [DECISION `00` 2026-10-11; PROPOSAL for the fae side]

The PC acts only on Commands plus standing orders: sleep, eat from its own stores, keep warm. Agency is an **agency mode** on the psyche (`commanded` / `psyche` / later `fits`), a sheet property any actor can have, and **never a branch on `controller`**. Fae effects sort into four classes:

| Class | Examples | On a `commanded` actor (default PC) | On a `psyche` actor (default NPC) |
|---|---|---|---|
| **A. Advisory** | Omen fear and longing; `charm_covet`, `charm_keep`, `charm_conscience`; Tally callings as `duty` thoughts; dreams; Huldra's Comb (a soul-image glamour) | Thoughts and anxiety only. Overriding books anxiety, and the confirm line shows it (`10` §5.5 (b)). **Never** spends, takes, gives, hides, lends or uses | Normal arbitration: the thought can win |
| **B. Outcome-altering** | Lost minutes, turned paths, pixie-led arrival, a draw emptying your bin, iron souring your charm | Changes the *result* of a commanded act, never the choice. Disclosed before commitment where knowable ("time out of joint", "this path folds") | Same |
| **C. Compulsion** (`compel_activity`) | Fossegrim's String (dance until the tune ends); a ring dance (F1) | Bounded forced activity: ≤ 60 min per instance, Will save every 10 min to break, ends at iron contact or running water. **PC subject to the World flag below** | Same, no flag |
| **D. Agency transfer** (`set_agency`) | Rush Bridle (§5.8); later, greater workings and the Prince's bargains | Mode becomes `commanded` with a new **issuer**, for a capped duration. **PC subject to the flag** | Mode becomes `commanded`, issued by the holder. The holder, PC or NPC, commands the target through the same Command path |

Two rules for the PC, so its high agency survives contact with Faerie:
- **Attachment never overrides a Command.** NPCs at attachment ≥ 80 refuse to lend and lie about having the charm. The PC at the same score gets a loud `charm_keep` thought and pays anxiety to override it.
- **Strings never act for the PC.** A due string or called Tally becomes a Journal obligation with a deadline and a `duty` thought. Default consequences fall if the PC ignores it (§4.6). Nothing is done on the PC's behalf.

### 2.2 Agency transfer, specified [PROPOSAL]

Ellie wants it kept possible that a glamour puts someone under command. Here is the data shape. `psyche` stores it, and `fae` only requests changes through `psyche/api`.

```ts
type Issuer = { kind: 'player' } | { kind: 'actor'; id: ActorId };
interface AgencyState {
  mode: 'commanded' | 'psyche' | 'fits';
  issuer: Issuer | null;          // who may issue 'command'-voice urges; null in psyche mode
  until: GameMinute | null;       // null = indefinite (defaults)
  source: { kind: 'charm' | 'working' | 'bargain'; id: string } | null;
  restore: Omit<AgencyState, 'restore'> | null;  // what to return to on expiry/break
}
```

- **Arbitration** (an additive change to `psyche/arbitrate.ts`): in `commanded` mode, options carrying consequential urge tags (`spend trade aggress quarrel slander court` plus new `gift take fae_use`) win only with `voice: 'command'` from the current `issuer`. Standing-order tags (`rest warm eat drink_water home`) may still win from Id or Superego.
- **The Command validator** checks `issuer` against whoever issued the Command. A bridled NPC is commandable by its rider through the ordinary headless Command path (`command --as <actor>`). There is no rule branch on `controller` anywhere.
- **An NPC rider** proposes urges for its mount through a `proposeRiderUrges` hook. Errands come from data (plow, carry, fetch, go to a place) and are scored by the rider's own goals.
- **Breaks:** iron contact, crossing running water, a church bell in earshot, dawn, or the duration cap. On a break, `restore` applies and the event `fae.agency_restored` fires.
- **Aftermath is social fuel.** The ridden actor wakes Fatigued with an `uncanny` memory and a dream that shows the rider's face as spectral evidence (`10` §9.1). Uncanny-founded grudges don't decay (`01` §4.4). Hag-riding accusations come from this, and sometimes they're right.
- **PC as target.** The World flag `fae_compulsion_on_pc` takes `off | capped | full`.
  - `capped` is the recommended default: requires a forfeit basis (`01` §4.5: an accepted gift, a broken bargain, sleeping unwarded at FI ≥ 2); ≤ 6 h; a Will save at onset and every 2 h; a full-screen disclosure ("You are bridled. Rider: unknown. Ends at dawn, at running water, or at iron."). While it runs, the player has exactly one Command, `struggle`, which is a save at +2 that costs 1 h of fatigue.
  - `off` downgrades classes C and D on the PC to class A: loud thoughts instead of control.

### 2.3 What this asks of `psyche` [PROPOSAL]

- `AgencyState` goes on `ActorPsyche` (additive). Defaults: PC `commanded/player`, NPC `psyche`.
- `setAgency(world, ctx, actorId, next, source)` and `agencyOf()` go in `psyche/api.ts`. `fae` never writes psyche state directly.
- Urge tags `gift take fae_use` are added to `urge_tags.toml`.
- The Explain on every arbitration names the mode and issuer at `self` knowledge. For a bridled NPC the rider is `omniscient` until discovered.

---

## 3. Omens and signs (A)

### 3.1 Three kinds of sign [PROPOSAL]

| Kind | Example | Truth |
|---|---|---|
| **Lookalike** (ordinary sign, uncanny reading available) | Fox fire; summer frost on an algific slope; a cow balking at mud | Mundane, and can still become a supernatural rumor |
| **Ambient** (true, undirected) | A reflection keeps drinking after the cow lifts its head; bells on a prairie nobody grazes | A real anomaly with no hostile act behind it |
| **Directed** (true, caused) | Wet footprints at a locked pantry after a missed offering; a charm's `sings` quirk | An actor, obligation, working or charm caused it |

"Fae" does not mean hostile. A harmless sign can start a panic, and a dangerous working can go unnoticed.

```toml
# content/base/fae/omens/lights.toml  (module:fae)
[[omen]]
id = "wisp_lights"
family = "lights"
kind = "ambient"
fi = { min = 2, max = 4 }
windows = ["dusk", "midnight"]
lookalikes = ["fox_fire", "lantern_on_ridge", "marsh_gas"]
keys = { moon = { full = 2000, new = 1500 }, weather = { fog = 3000, rain = 500 }, tags = { creek = 1500, spring = 2000 } }
notice_dc = 12                      # 8 obvious · 12 subtle · 16 residue
read = { skill = "lore_fae", dc = 10, plain = { skill = "lore_nature", dc = 12 } }
duration_minutes = 120
thins = 15                          # thinning points when witnessed
prop = { pred = "fae_abroad", args = ["place"] }
thought = { drive = "fear", base = 250, alt = { drive = "longing", if_drift_min = 20 } }
leads_to = { nothing = 600, trace = 200, fae_site = 150, stray_charm = 50 }  # per-mille, followed at its hour
chronicle = "omen.lights"
text = "Lights in the bottoms, low, keeping pace with nothing."
```

### 3.2 Taxonomy by Fae intensity [PROPOSAL]

FI here is effective local FI after field modifiers. The table lists eligible families, not a mandatory sequence.

| FI | Register | True signs (examples) | Common lookalikes | Escalates toward |
|---|---|---|---|---|
| **0 Known** | **Providence signs only** | None from Faerie. The town's own omen culture: a bird in the house, a picture falls, the death-watch beetle. Read by the pious as `portent(actor)` | All of them | Nothing. Bells and iron reset |
| **1 Settled** | **Hearth signs** | Milk turns at the door; tools moved overnight; a plait in the horse's mane; the dog won't cross the threshold; the porridge bowl licked clean | Heat, rats, children, a hired girl | Nisse grievance |
| **2 Edge** | **A second reading** | Lights in the bottoms; an echo that answers before the call ends; tracks that stop at a spring; crows in sevens | Fox fire, a lantern, deer, wind in reeds | Pixie-led (F3) |
| **3 Wild** | **Rules visibly differ** | Cattle bells without cattle; a path that returns to its own fresh prints; fiddle music under the slope; flowers out of season | Echoes, a neighbor's fiddle, fatigue | Visitations; F1 at full moon |
| **4 Deep** | **Another jurisdiction** | Your watch and the sun disagree by 10–40 min; the coulee branches where the plat says it doesn't; a voice uses an unspoken name; a dream continues awake | A stopped watch, bad maps, drink | Incursion; region edges reroute (`05` §1.4) |
| **5 Court** | **Terms govern the place** | A spring reflects the Court's sky; a threshold admits invited guests only; being *seen* | None worth rolling | Time slippage (`01` §4.5 ratios and caps) |

- **At FI ≥ 3 the visitor recognizes danger without a check.** Identification explains *which* danger and *what answers it*.
- **Counter-omens (Ice signs)** occur on `algific` slopes, near erratics, and at iron-shod survey corners: summer frost, a granite boulder that wasn't there yesterday, birds gone silent, a feeling of being *sorted*.
  - They **lower** thinning by their strength.
  - Elves and surveyors find them comforting; fae dread them.
  - **The Cold Stair yields only Ice signs.** Its FI 3 contradicts its description ("a refuge from fae"). See Decision 11.

### 3.3 Frequency: windows, rates, keys [PROPOSAL]

- **Four logical windows per place per day:** dawn (sunrise ±60 min), noon, dusk (sunset −60 to +35 min, starting 90 min earlier in coulee bottoms, `05` §4.2), and midnight.
- **One episode per place per window at most**, shared by every witness. Each lasts 1–6 h or leaves a trace for 1–3 days.
- Rolls are keyed `ctx.rng('fae', mixKey(place, day, window, SALT_OMEN))`, so a lazy roll on arrival gives the same answer as an eager one. LOD catch-up can't reroll, and neither can visiting.

**Base per-window chance at dusk (‰).** Other windows are multiplied: dawn ×700‰, midnight ×600‰, noon ×150‰.

| FI | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|---:|
| True episode | 0 | 40 | 180 | 350 | 600 | 850 |
| Lookalike episode | 60 | 160 | 120 | 60 | 40 | 0 |

So lookalikes outnumber true signs about 4:1 at FI 1, and true signs outnumber lookalikes 15:1 at FI 4. Keys apply in this fixed order, each a ‰ multiplier, rounded once and clamped at 950:

| Key | Effect | Note |
|---|---|---|
| Moon | Full: lights, music, processions ×2000. New: voices, the Hunt, lost minutes ×1500. Waxing favors *gift* signs, waning *taking* signs | `05` §4.5 |
| Calendar slot | Walpurgisnacht and Sankthans: effective FI +1. All Hallows: +2. Yule–Twelfth Night: Hunt family on | Applied to the field first, never double-counted |
| **Sabbath bells** | ×0 **within actual bell range while ringing**, 06:00–13:00. Sunday evening ×1500 ("they come back hungry") | A distant farm isn't protected because it's Sunday |
| Season | Winter: rate ×600 but family tier +1 ("rarer but deeper"). Spring: water and returning objects. Summer: music and borrowed labor. Autumn: counting and claims | |
| Weather | Valley fog ×3000 (lights, voices, paths). First snow ×1500 (silence, tracks). Thunderstorm ×200. Rain hides tracks and adds reflections; wind masks voices | `05` W-series |
| Feature tags | See §3.4 | |
| Iron | Iron Presence ≥ 5 lb in the place: ×200 for subtle families | Iron suppresses the *phenomenon*, not the witness |

**Persistent signature.** Every FI ≥ 2 place gets one signature at worldgen (the spring's wrong reflection, the bluff's answering echo). It is always present to `look`, never rerolls, and supplies texture between episodes.

### 3.4 Terrain features [PROPOSAL]

Standardize the place `tags` vocabulary (tags already carry features in code). **Rename the fae-seat tag `court` to `fae_court`**, because Dunleavy's Tavern uses `court` for the JP's court.

| Tag | Families favored | Notes |
|---|---|---|
| `spring` | Independent reflections, submerged lights, voices through a vessel; ×2000 and local FI +1 (cap 5) | Dawn, thaw, fog, offerings |
| `cave` / `mine` | Answering taps, lamp shadows without bodies, cold breath | Blasting and Accord breaches (F7) |
| `sinkhole` | Grass flattened outward; objects returned clean | Heavy rain, a new collapse |
| `bluff` / `goat_prairie` | Bells above the ledge; a procession seen only from below; revels | Dusk, clear weather, summer |
| `old_growth` | Leaves moving against the wind; a tree that's always ahead | Dark moon, leaf fall |
| `creek` / `ford` | **Signs stop at running water.** A legible rule | `01` §4.5 |
| `fae_barrow` | Frost outlining a door; lamps under turf | `fictional = true` only |
| `farm` / `home` | Hearth family | Missed tribute raises it |
| `algific` | Ice signs only | Counter-omen |
| `church` | ×0 | |

### 3.5 Who notices, and how they read it [PROPOSAL]

There are two rolls, and each emits an Explain at `self` knowledge.

**Notice:** d20 + WIS + Perception ranks vs. the omen's DC, plus `02` §3.3 light and weather terms.
- **Drift** (`06` thresholds): +1 at 20, +2 at 40, +3 at 60, capped.
- **Second Sight:** +5 and the FI overlay. **`see_the_seam`:** +4 vs. glamour families. **`deep_sense`:** +2 for rock, air and water signs.
- **Animals:** horses, dogs and cattle roll at +6 from creature data. Their reaction (balking, barking, going off milk) is a second-hand sign that people witness. A frightened cow is evidence of a frightened cow, not of witchcraft.
- **Children** use the same rules with no bonus. They notice more because their schedules put them at the spring at dawn and in the hazel brush at dusk.
- **Faith** doesn't change noticing; it changes the reading. `fae_notice_mod` (`12`) means *Faerie noticing the actor*. Don't reverse it.
- **Sampling:** roll for at most 6 present actors per episode. At T1, roll only for actors whose activity puts them outdoors at the place.

**Read:** Lore (Fae) at DC 10 identifies the family, 15 a condition or countermeasure, 20 a particular court's signature. Lore (Nature), Woodcraft or the relevant Trade at the `plain` DC identifies a lookalike as mundane. Spellcraft reads working residue.
- **A success** yields an Observation at strength 100 ("That was fox fire.").
- **A failure** leaves honest uncertainty. It never fabricates a fact:

```
Omen: lights in the bottoms (River Bottoms, 21:40, fog)
  Notice  Perception +3, d20 13 = 16 vs DC 12 + moonlight 0 = 12 → noticed
  Read    Lore (Fae) +0, d20 7 = 7 vs 10 → you can't say what they were
  Truth   [not known to you]
```

**What NPCs conclude.** NPCs who fail to read are scored in `04` §5.4's attribution shape (leader needs a ≥ 350‰ share and a 1.5× lead):

| Reading | Weight |
|---|---|
| `fae_abroad(place)` | 100 + 40·Superstition + 10·Lore (Fae) ranks + Drift/2, plus a fitting Figure's notoriety ("the Lantern Lady") |
| `natural_sign(place, cause)` | max(20, 100 + 10·Lore (Nature) − 30·Superstition), +40 for a self-sourced `honesty` ≥ 60 (freethinkers, the lyceum) |
| `portent(actor)` | 50 + piety strength, at FI ≤ 1 only |

Culture enters only through norms and skills, never people ids. For example, a Hall-raised reader's catechism line ("Ring the bell") proposes a hand-bell urge that lowers thinning by 20.

### 3.6 What an omen does [PROPOSAL]

| Output | Lands in | Numbers |
|---|---|---|
| **Memory** | New `MEMORY_KINDS` id `omen` (fear or awe) | Intensity = strength. Consolidates ("lights in the bottoms, three times this spring") |
| **Thought** | `proposeFaeUrges` hook into psyche (like `proposeBeliefUrges`) | Novelty: `longing` 120. Threat: `fear` 250, anxiety +10 once per episode. Visitation: 400. Incursion: 500, anxiety +30. Superego `piety` for the pious (*The Pastor: "Look away and pray."*). Urges: avoid, go look, ward the house, tell someone. No per-hour anxiety for merely being in an eerie place |
| **Belief** | `observe()` | Evidence on the new predicate `fae_abroad(place)`: supernatural, juiciness 45, `exaggerates_to = "court_at"`. Commons prevalence ≥ 600‰ makes it "everyone knows" |
| **Rumor** | `transmit` | Supernaturalization and specification move "lights" toward a Figure |
| **Demand** | Provisions buy urges | Ward urges buy nails, horseshoes and rowan from Pratt & Daughter. A real sale, not a scripted price bump |
| **Misfortune attribution** | `attributeMisfortunes` | For a believer holding `fae_abroad` ≥ 50 within one place-hop and 7 days of a misfortune: Natural −20 per omen witnessed, Figure +20. A `portent(actor)` later matched by a misfortune is *Prophecy fulfilled* (`05` §9.2), and the believer's Superstition view rises by 1 for 30 days. Ridicule lowers it (`04` §9.5) |
| **Livestock (P8)** | Provisions, misfortunes | At FI ≥ 2: a cow off milk for a day, or a horse refusing the ford (+1 h). Three in a week report `cows_dried` through `reportMisfortune` |
| **Children** | Activity | At FI ≥ 3 within a mile of home, a `longing` urge to follow the lights. If a child acts on it: an Absence trace and a search party. What the child brings back (a story, or a stray charm, §6.4) sits behind `06`'s child-harm toggles |
| **Chronicle** | Journal, Almanac, Paper | Journal: one entry per PC-noticed family per day. Almanac: a weekly digest ("April 9. Fog held at Lantern Spring after the ridge had cleared. Two carriers reported bells under the water."). Paper: only with ≥ 3 witnesses. Ballad: only if a sign becomes famous, and identified as a telling |

**T2** settlements get a weekly aggregate: the expected count from their FI band seeds `fae_abroad` Commons drift plus one rumor carried by a census witness, materialized on contact.

### 3.7 Thinning: escalation toward incursion [PROPOSAL]

Each place has `thinning` 0–1000 in `world.fae.thinning`. An empty coulee doesn't thin, because Faerie runs on the uncanny and the uncanny needs a witness (`01` §4.2).

- **Rises:** a witnessed true episode (+`thins`, 5–25); an `aura` charm kept there (+2/day); workings (+5 × tier); Commons prevalence of `fae_abroad(place)` ≥ 400‰ in the nearest settlement (+10/day); a refused Tally calling (+100).
- **Falls:** −floor(thinning × 30 / 1000) per day; Ice signs; a bell rung in range (−30); iron set or a section corner run (−50); a printed debunking or a successful ridicule (−20).

| Thinning | Stage | What becomes eligible |
|---|---|---|
| 0–299 | **Signs** | §3.3 rates |
| 300–599 | **Portents** | Families from FI + 1. **Lost minutes:** a lone actor at dusk loses 5–30 min; an iron-cased watch shows it. **Turned paths:** the next move costs +1 h, or Wayfinding DC 12 + 2·FI, where failure means arriving at a neighboring place |
| 600–849 | **Visitations** | **Voices** call an actor's `known_as` (Will DC 12, or a `longing` urge to follow, class A for the PC). A voice may borrow a confined actor's relationships: Lydia Pratt hears her name in Tobias Vik's voice (scenario 00 holds Tobias captive). Fae seen plainly at the field edge |
| 850–1000 | **Incursion** | Effective FI +1 for 3 days. F-incidents eligible. Region edges reroute. Then thinning resets to 500 ("the land exhales") |

- **Guard:** thinning selects *eligible* manifestations only. **It never authorizes harm.** A harmful encounter still needs its court's forfeit basis and a capable actor (`01` §4.5).
- **Time:** lost time follows `01` §4.5's ratios and its three-day cap. The UI shows "time out of joint" and an exposure estimate before the player commits to lingering. The whole world advances; nothing rewinds.
- **Dynamic FI (`00`):** three incursions in a season raise a place's FI by 1. A season below thinning 50 with iron or survey activity lowers it by 1. At most ±1 per season, within the site's range.
- **Director:** may tilt rolls within ±1σ (N1) and may never author an omen.

### 3.8 Place descriptions [PROPOSAL]

Places already carry `description` and `tags` in TOML, but the runtime `Place` drops them. Add both to the runtime place. `describe(world, placeId, perspective)` is a pure view composed of six layers, with lines picked by `hashString32(place, day, layer)`:

1. **Base:** authored, or generated from kind × tags × FI.
2. **Season, weather, light:** from `ctx.cal`, air temperature and rain.
3. **People and use:** who is here, what is being done, visible Traces.
4. **Fae layer:** the persistent signature plus any live episode. Skill-gated: Woodcraft sees the detail; Lore (Fae) ≥ 2 or Second Sight sees what it is.
5. **Residue:** omens this PC noticed or heard of here in the last 7 days, taken from the PC's own beliefs.
6. **Counter-layer:** iron, bells, survey posts, Ice.

```toml
[[describe]]
id = "goat_prairie_bells"
layer = "fae"
tags_any = ["goat_prairie"]
fi = { min = 2, max = 4 }
hours = { from = 18, to = 22 }
seasons = ["spring", "summer"]
text = "A cow-bell somewhere upslope, though nobody grazes stock up here."
reads = [{ skill = "lore_fae", min = 2, text = "Cow-bells at dusk on a prairie nobody grazes: huldre cattle. Don't follow them." }]
```

> *Huldra's Shelf, May dusk, Lore (Fae) 0:* Goat prairie, steep to the southwest, bluestem and pasqueflower between the ledges. Survey stakes run across it. The coulee below is already blue. A cow-bell somewhere upslope, though nobody grazes stock up here. Two nights ago you saw lights here and could not say what they were. The new section post is iron-shod; the bells keep away from it.

Designer-facing text never leaks into fair views. "The Prince's court is held here" is `omniscient`.

### 3.9 The pull (P5) [PROPOSAL]

- **Signs & Wonders.** Each omen the PC notices and can't explain becomes an **open question** on a Journal page (headless `signs`). It closes when the PC's reading belief reaches ≥ 70 or ≤ 30, whether by investigating, asking around, a cunning woman, recurrence or escalation. The region map marks places with open signs. The Director treats an unexplained omen as a Chekhov gun (`05` §8.6).
- **Clues open an action.** For example: *"The bells stop when the springhouse latch closes. Marta says her father heard them before the May market. You could ask her, test the latch, or return at dusk."*
- **Signs lead somewhere.** Following an omen at its hour resolves on `leads_to`: nothing, a trace, a fae site or actor, or (5%) a **stray charm** (§6.4). Omens are the front door of the charm system.
- **Calibration targets:**
  - an explorer outdoors at FI 2–3 notices ~1 episode per day plus the signatures;
  - a town resident gets 1–3 observations a week, mostly as rumor;
  - every start has a place at FI 2–3 within a day's walk (worldgen QA, §7.5).
- **Spam guard:**
  - a same-family cooldown of 24 h per place (6 h per actor), and 7 days for an identical text variant;
  - ≤ 1 ambient-only interrupt per game-day; danger, a speaking visitor, an arrival or an actionable discovery may interrupt fast-forward;
  - `fae.omen` < 2% of a year log.

---

## 4. Fae magic anyone can learn (B)

### 4.1 Three routes, one catalog [PROPOSAL]

**[DECISION]** No ancestry gate. **[PROPOSAL]** No mandatory caster class for small workings.

| | Folk craft (`02` §10.3) | **Fae working** (this doc) | Fae caster (Fae-Touched, Witch) |
|---|---|---|---|
| What it is | A mortal binds an effect into a folk charm | A mortal *asks*, and the land answers | Their own marked nature, or the Pact |
| Check | Craft/Herbalism DC 10 + 2 × level | **Fae Courtesy** vs. Working DC | Spell points (`02` §10.4) |
| Price | Ingredients, charm capacity | **Tally** + Drift | Spell points + Drift; for the witch, Woe and the Tithe |
| Who collects | Nobody | The court whose ground it was | — / the Prince |
| Ceiling | Cantrip and 1st level without the class | Greater workings rare; misworkings | Full catalog; curses |

- Every **Fa**-tagged spell in `02` §10.5 is also a working at tier = spell level.
- Hedge workings (§4.9) join the same list.
- For a mortal, fae magic is **etiquette that the land answers**. Fae Courtesy handles the asking, and a working may also list a craft prerequisite (Stop Blood requires Medicine 1).

### 4.2 Sources and teachers [PROPOSAL]

Access runs through relationship and culture, never people. Traditions cross households: a human can teach goblin mining courtesies, and a goblin can teach an elf.

| Source | Teaches | Gate | Cost / strings |
|---|---|---|---|
| **Cunning folk** (braucher, pellar, *klok kone*) | Healing, finding, warding, milk-luck | Trust ≥ 40, or being "called upon" | 25–75¢ a lesson, labor or favor. Your name joins hers in town talk (shared `keeps_charms` evidence) |
| **A dissenting elf** | Names, thresholds, unbinding | Affection ≥ 50 | The teacher breaks the Hall Catechism ("Never bargain…"): moral anxiety, Hall discipline if seen |
| **An Accord-speaker** (a pare's office) | Underground courtesies: knock-reading, warnings | Pare or Club membership (a mixed-pare human qualifies) | A student's breach hits the whole pare's Accord standing |
| **Books** (*The Long-Hidden Friend*, a *svartebok*, a dead cunning-man's daybook) | Small and middling workings | Literacy; 35¢–$3 | `fidelity` 50–90%: a miscopied working misworks more often |
| **A fae charm, studied** | The working it embodies | Holding it, and its holder's permission | Spellcraft DC 15 + 3·tier, 1 virtue per day of study; +1 Tally (the court notices the theft of its secret) |
| **A bargain** | Any tier, in one night (the fossegrim and the fiddle) | Being in the right place | `06`'s +2–10 Drift by weight, Tally +5, and a named price |
| **A dream** | One working | Drift ≥ 20 | Consent given awake (`06` §3.3); Drift +1 |
| **Another learner** | What they know | — | Incomplete instruction; mistakes carry a traceable teaching lineage |

### 4.3 Learning structure [PROPOSAL]

| Grade | Prerequisite | To learn | Typical use |
|---|---|---|---|
| **Knack** (tier 0) | Instruction | 2 successes on 2-h lessons or experiments, DC 10 | Turn the Path; recognize a recharge condition |
| **Small working** (tier 1) | Fae Courtesy 1, plus Hedge Dabbler or Small Courtesies | 3 successes, ≤ 1/day, DC 12 | Stop Blood, Milk-Luck |
| **Middling** (2–3) | Fae Courtesy 4, Lore (Fae) 2, Fair Dealing | 5 successes, DC 16–18, with a teacher or an adequate text | Ask the Spring, Bread on the Water |
| **Greater** (4–5) | Fae Courtesy 8, Well-Spoken, or a fae-caster class | Individually authored, DC 22–30 | Send It Home; agency transfer |

- The learning check is d20 + INT + Lore (Fae) (+2 with a teacher present).
- **Fail by 5+:** a mistaken **hypothesis**, not mastery. It's stored as a belief `works(working, condition)`, so it can be tested and refuted. The recipe, the belief that it works and the ability to execute it are separate records.
- **No take-20** when experiments consume supplies or risk backlash. Repeating under unchanged conditions gives no new success; a new teacher, corrected text or different experiment reopens progress.
- **Specialists stay valuable.** Classes keep breadth, spell points, speed and advanced access. A farmer can get one useful working, not a specialist's daily output.

### 4.4 Working the check [PROPOSAL]

| Tier | Base DC | Time | Tally | Drift | Sign left |
|---|---|---|---|---|---|
| 0 Knack | 10 | 3 s | 0 | 0 | 25%: a lookalike-strength omen |
| 1 Small | 14 | 1 min | 1 | +20 centi-Drift (carry) | Strength 20, 3 days |
| 2–3 Middling | 18 / 22 | 10 min | 2 / 3 | +1 | Strength 40, 6–9 days |
| 4–5 Greater | 26 / 30 | 1 h to a night | 5 / 8 + a named price | +2 / +4 | Strength 70, 12–15 days |

`Working DC = base − (FI − 2) + iron + ground + timing + offering`
- **iron:** +1 per Iron Presence band above 2 lb within 10 ft (mirrors `02` §10.4);
- **ground:** +5 on consecrated ground or in earshot of a ringing bell. Inside a church, or across an iron line, the working fails outright and adds +1 Tally;
- **timing:** −2 when the working's key holds (dusk, full moon, spring water, a threshold);
- **offering:** −2 for a gift with meaning (bread, milk, a song, a storied object).

The roll is d20 + CHA + Fae Courtesy ranks + Lore (Fae) synergy (`02` §4.3). Every term appears in the Explain at `participants` knowledge.

- **Policies:** take-10 is allowed for tiers 0–1 with no threat. There is never Work It Through: asking twenty times is rude, and each failed attempt adds +1 Tally.
- **Beat the DC by 10+:** Tally halved ("given gladly").
- **Fail:** no effect, but the sign still lands.
- **Fail by 5+: a misworking.** Each working's table is authored, bounded by the working's tier, and built only from `02` §10.6 effect primitives. The effect inverts, lands on the nearest other person or beast, or comes out the wrong omen, and the Tally doubles. It is never an arbitrary disaster. **Misworkings are how innocent dabblers become real thieves:** Milk-Luck misworked dries the *neighbor's* cow, and the neighbor's accusation is correct.

### 4.5 Costs [PROPOSAL]

| Cost | Mechanism |
|---|---|
| **Tally** | Favors owed to the court whose ground it was: Hearth (farms and mills, FI 0–1), Thorn (the Prince's; coulee heads), Under (below ground), Alder (alder bottoms, fog, nurseries), River (running water). The court is read from the place's anchor |
| **Drift** | +1 on first learning a small working; +2 on first learning a greater one; the per-working carry in §4.4. Ordinary protective customs (a horseshoe, a nail in the threshold) cost nothing. Each working lowers the fae-longing need by 20 × tier: **practice makes you want more practice** |
| **Claim** | Unpaid Thorn Tally adds to `06` §3.8.1's claim: K += min(20, 5 × floor(owed / 3)). A heavy dabbler feels bells long before any Pact |
| **Suspicion** | Every working is an event. Witnesses get an Observation on the existing `keeps_charms(actor)` predicate (which exaggerates to `deals_with_fae`, then `witch`) at strength 20 + 20·tier. Spellcraft, Lore (Fae) or Unwitching finds the sign while it lasts. Attribution's `magic` term makes a practitioner the natural suspect: `01` §5.3's braucher-first pattern, run as arithmetic. Learning is never an automatic `witch` conviction |
| **Psyche** | Superego lines against (`piety`; the Hall Catechism; a Haugean conscience) and for (a pare's courtesies). Persona strain when someone condemns in public what they practice in private, with `10`'s defenses doing the rest. Dream receptivity +5 per tier that night |

### 4.6 The Tally: how the Fair Folk collect [PROPOSAL]

Each court has a **patience** and a **call threshold**:

| Court | Patience | Threshold |
|---|---|---|
| Hearth | 30 days | 3 favors |
| Under (mercantile) | 60 days | 5 favors |
| Thorn | one moon | 3 favors |
| Alder | 7 days | 2 favors |
| River | "at the next crossing" | 1 favor |

Crossing either limit fires `fae.tally_called`:

| Owed | Calling |
|---|---|
| 1–2 | **A service:** milk at the spring for a week; carry a stone from the ford to the ring; a tune at the crossroads. Delivered as a `duty` thought "from the Good Neighbors", with a deadline. Doing it clears the favors |
| 3–5 | **A gift with meaning** (`03` §8.7): a storied object, a memory, a season's taste of salt |
| 6–9 | **A bargain offered** (F6) |
| 10+ | **Sold on** to the Prince (§4.7) |

- **Refusal or default:** a never-decaying Affront in the collecting fae (`10` §10); uncanny weight on the debtor household's misfortunes; thinning +100 at the court's place; and the next calling is one row worse.
- **Paying early:** an offering of meaning at a place of that court clears 1 favor (2 for a storied object).
- **Legibility:** shown in the Obligation view in band words ("you owe something" / "a good deal" / "too much") until Lore (Fae) 4 or Second Sight. A witch sees exact figures.
- **Storage:** `world.fae.tally[actor][court]` until court actors are materialized. Then it migrates to `04`'s Obligation ledger with a court actor as creditor (Decision 3).

### 4.7 Relation to Witch mode: the conscripted extreme [PROPOSAL]

- **The witch is the far end of the same road.** The Tally makes `06` §5.1's **Debt Origin** simulated rather than rolled:
  1. at 10+ favors owed, the debt is sold on to the Prince;
  2. if the debtor's mind holds desperation (`fear` or `hunger` dominant, or a pantry below its horizon), a dream invitation follows;
  3. consent must be given awake, at a threshold, in words (`06` §3.3).
- **A PC adventurer can walk into this with open eyes.** The bill is never a surprise.
- **A dabbler doesn't get witch systems.** Learning a drying charm brings no Pact, Hold, Woe or Tithe. Any qualified actor can learn a curse rite; Woe-harvesting needs the actual Pact.
- **A bound witch can still do hedge workings**, paying 1 Woe per favor instead of Tally.
- **Gussie Pratt is the canon dabbler.** She bought fairy gold (`01` §8.3), so her Hearth Tally is a seeded debt.

### 4.8 Knowledge gating (P1) [PROPOSAL]

| Thing | Who sees it |
|---|---|
| The working check and every DC term | The worker (`participants`) |
| Which workings exist | Those you know, plus rumors ("Loveday Trevenna can stop blood") |
| Tally size and court | Band words, exact at Lore (Fae) 4 / Second Sight / Pact |
| A misworking's victim | `omniscient` until discovered ("your neighbor's cow went dry the same night") |
| Signs at a place | Anyone who succeeds at Spellcraft, Lore (Fae) or Unwitching there |

### 4.9 NPCs learn and use it (P2) [PROPOSAL]

- **Worldgen:** about **1 practitioner per 40 adults**, data per culture, with `cunning_folk` as occupation or side-trade. The fixture fits: Loveday Trevenna is a pellar.
- **Demand:** a household with a misfortune proposes a "send for the cunning woman" urge (`02` *Called Upon*). The practitioner gets income, standing and suspicion from the same events.
- **Diffusion:** `teach_working` is an interaction (Trust ≥ 40, 2–8 weeks), so hedge-craft spreads along friendships and kin. Practice marks accrue on Fae Courtesy (`02` §4.4).

**Starter workings:**

| Working | Tier | Effect | Misworking | Taught by |
|---|---|---|---|---|
| **Turn the Path** | 0 | Breaks pixie-led: a Wayfinding reroll | Turns your companion's path instead | Anyone; books |
| **Stop Blood** | 1 | Staunch (`02` §10.5) | The worker's nose bleeds | Cunning folk |
| **Milk-Luck** | 1 | Ends a *fae-caused* `cows_dried`; does nothing against a mundane cause | Draws the milk from the nearest neighbor's cow | Cunning folk |
| **Hearth-Blessing** | 1 | Household +2 vs. curses for a week; the nisse's opinion rises | The nisse is insulted | Cunning folk |
| **Knocker's Courtesy** | 1 | Collapse and bad-air warnings for a shift | The knockers knock for someone else | Accord-speaker |
| **Dusk-Sight** | 1 | One hour: auto-read the truth of omens at dusk | You read every lookalike as fae | Books; a dissenting elf |
| **Bread on the Water** | 2 | Find a lost thing or a drowned body within a mile | Finds *something else* lost: a stray charm | Cunning folk, River |
| **Ask the Spring** | 2 | One question answered sincerely by a spring's tenant, hedged per `10` §10 | The tenant asks one back (+2 Tally) | Bargain; books |
| **Keep the Name** | 2 | Name-Keeper for a season | Your name is spoken aloud at the next dusk | A dissenting elf |
| **Wake the Virtue** | 2 | +1 virtue to a charm outside its recharge condition | The charm wakes, and so does its court | Books; studied charms |
| **Send It Home** | 3 | Returns a charm to its court without carrying it to the hill | It comes back with a friend: a second charm | Bargain; a master |
| **Borrow the Hands** | 4 | `set_agency` on a sleeper who accepted your gift, ≤ 4 h (§2.2) | You are ridden instead, same duration | Bargain only |

**Feats for `02`.** Extend **Hedge Dabbler** so it may take 1 knack + 1 small working in place of its 2 folk cantrips. Add two feats:
- **Fair Dealing** ◆ (Fae Courtesy 4, Lore (Fae) 2): learn middling workings and see your exact Tally.
- **Well-Spoken in the Hollow** (Fae Courtesy 8, a calling paid in full): −2 Working DC; beating the DC by 5+ halves the Tally.

---

## 5. Fae charms as items (C)

### 5.1 Data model [PROPOSAL]

A fae charm is an ordinary `ItemSchema` item in the existing `fae` section, with `stackable = false`. It supplies the P8 fields (`weight_g`, `bulk`, `materials`, `affordances`, `value_cents`) plus `truth`, the hidden designer text. Its fae behavior lives in a separate `charms` domain owned by `module:fae`, keyed by item id, so `schema/items.ts` stays untouched.

```toml
# content/base/items/fae.toml  (module:content-items)
[[item]]
id = "never_empty_sack"
name = "Flour sack, moonsilk ticking"
section = "fae"
copy = "Tie it shut at night and don't look in till the cock crows. Don't thank it. It isn't listening anyway."
truth = "Moves 10 lb of flour each dawn from the nearest unwarded flour store within three miles."
unit = "each"
weight_g = 227
bulk = 1.0
value_cents = 4000
stackable = false
materials = [{ material = "moonsilk", pct = 100 }]
tags = ["fae_made", "notable"]

# content/base/fae/charms/hearth.toml  (module:fae)
[[charm]]
item = "never_empty_sack"
court = "hearth"
tier = 2
minimum_fi = 0                       # works in town; recharge may still need a place
virtue = { max = 7, start = 4 }
recharge = [{ kind = "closed_dark", hours = 10, amount = 1, cooldown_minutes = 1440 }]
effects = [{ kind = "draw", item_tag = "flour", qty_g = 4536, at = "dawn",
             from = ["store", "mill", "club_pantry", "household"], radius_mi = 3,
             skip_if = ["iron_ip_2_at_source", "hearth_tribute_kept"],
             misfortune = "pantry_theft", trace = "Missing" }]
iron = { contact = "dormant_day", nearby_ip = 2, sour_per_day = 2 }
quirks = ["unthanked"]
strings = []
allure = 70
signs = ["flour_on_the_sill"]
study = { inspect_dc = 10, identify_dc = 21, strings_dc = 26 }
claims = [
  { id = "feeds",        text = "{0} keeps a family in bread",            weight = 40 },
  { id = "never_empty",  text = "{0} never comes up empty",               weight = 60, from = "feeds",       route = "exaggerates" },
  { id = "from_nothing", text = "{0} makes flour out of nothing",         weight = 80, from = "never_empty", route = "exaggerates" },
  { id = "gold",         text = "{0} fills with gold for the right hand", weight = 95, from = "from_nothing", route = "exaggerates" },
  { id = "devils",       text = "{0} is the Devil's own sack",            weight = 50, from = "from_nothing", route = "supernaturalizes" },
  { id = "steals",       text = "{0} steals flour",                       weight = 30, route = "truth" },
]
lookalike = "a rich man's flour sack"
```

**Per-instance state** lives in `world.fae.charms[itemId]`:

```ts
interface CharmState {
  virtue: number; virtueCarry: number;
  boundTo: ActorId | null;            // whom it chose (a gift freely given binds); omniscient
  lastUseAt: GameMinute | null; uses: number;
  stringIds: number[];                // live strings (§5.5)
  drawLedger: Record<HouseholdId, number>;   // grams/cents moved, for the epilogue
  reserveId: number | null;           // for `reserve` effects
  facts: CharmFact[];                 // durable thread facts; the log is not storage
}
```

- **Effects are typed records, never executable strings.** Slice 1 kinds:
  - `draw` (move a stack from a named mortal source);
  - `reserve` (a finite store under the hill, with a string);
  - `spoilage_mult`, `fire_minutes` (heat borrowed from a named place);
  - `container_dry`, `light`, `path_guard`, `cash_return`, `emit_omen`.
- **Later kinds:** `rest_mult`, `compel_activity`, `set_agency`, `forecast`, `scry`.
- **Forecast and use share one pure resolver**, so the planner and the sim agree (CLAUDE.md invariant 8).

### 5.2 TRUE vs. BELIEVED [PROPOSAL]

Three things are stored separately:

1. **Truth** (fae state): effects, virtue, reserve and live strings. `omniscient` until earned.
2. **Evidence** (belief): what an actor observed, tested, read or was told.
3. **Belief:** per-actor credence on `does(item, claim)`, with rumor lineage.

- **Mutation.** The `claims` list is a small **claim graph** whose edges use the existing mutation links (`exaggerates_to`, `supernaturalizes_to`, `moralizes_to`, `truncates_to`). Rumor mutation climbs it; the true function never changes.
- **Learning the truth, one fact at a time:**
  - a 10-minute inspection (DC 10): construction and visible features;
  - one hour of Spellcraft (DC 15 + 3·tier, costs 1 virtue): the effects and the draw;
  - Lore (Fae) at DC +5: the court and strings;
  - controlled activation: observation of that result, including the supplies spent;
  - a lyceum **measurement**;
  - **tracing the shortfall back** from a source's ledger: Trade (Milling) or Bargain at the store.

  No single roll reveals an unknown owner's memories or anyone's concealed ancestry.
- **Print freezes a variant.** A finding the *Sentinel* prints becomes Document evidence and freezes that variant (newspaper mutation 0).
- **Item predicates never open a persecution process against an object.** An accusation needs an actor-subject claim.

### 5.3 Virtue, recharge, iron [PROPOSAL]

- **Virtue** runs 0..max and is spent per use. At 0 the charm is **dormant**, not broken.
- **Recharge kinds:**
  - `moon` (phase, amount);
  - `closed_dark` (hours);
  - `offering` (item tags, at a place of the charm's court);
  - `place_fi` (a night at FI ≥ n);
  - `water` (running water at dawn);
  - `labor` (an hour of real, unpaid ordinary work);
  - `never` (consumables).

  Validation rejects zero-time repeatable loops.
- **Iron** (`03` §3.3):
  - `contact`: `suppress`, `dormant_day` or `damage`;
  - `nearby_ip`: the threshold in lb;
  - `sour_per_day`: condition lost while over the threshold. A fae charm doesn't wear; **iron sours it**. Below condition 25 it no longer recharges, and at 0 it is an ordinary object forever.

  Temporary suppression is derived from current conditions. Permanent loss goes through the items API. Taking the charm out of an iron box restores nothing it actually lost.
- **An `iron_lined` container** (already in `PROTECTIONS`) *keeps* a charm: no use, no souring, no aura, no strings advancing. This is how a Hall seals one.

### 5.4 Quirks [PROPOSAL]

Quirks are data in `content/base/fae/quirks.toml`:

| Quirk | Behavior |
|---|---|
| `unthanked` | Thanking it, or its giver, aloud drains its virtue for a moon (`01` §4.5) |
| `chooser` | Full effect for `boundTo`, half for anyone else, none for a thief |
| `counted` | Counting its yield aloud spends 1 virtue |
| `homing` | On a full-moon night at FI ≥ 3, unless iron-kept, it strays one place toward its court |
| `jealous` | Another charm in the house: both lose 1 virtue a day |
| `sabbath_silent` | No effect Sunday 06:00–13:00 |
| `aura` | Local FI +1 within the house and thinning +2/day. **A charm makes its town more fae** |
| `sings` | A dusk omen the neighbors can hear |
| `cold` | Cold to the touch: a tell for anyone who handles it |
| `name_hungry` | After 30 days its court holds a +6 true-name link to the keeper (`06` §3.5) |

### 5.5 Strings [PROPOSAL]

A **string** is a deferred obligation with: a counterparty, exact terms, the liable party, a due condition, its state, a breach consequence, and a **transfer rule**:
- `travels` with the object;
- `stays` with the original accepter;
- or transfers only on **acknowledged acceptance**.

Selling the object never silently assigns another actor's debt, and destroying it never erases an independent debt.

String kinds:
- `toll`: the River takes something;
- `tithe`: leave a share, or the source is cursed;
- `turns_on_sale`: sold, it is gone at dawn, and the buyer finds leaves;
- `reclaim`: the court sends someone on a calendar slot;
- `lien`: the court may take the first of something;
- `return_loaf`: a weekly service.

`draw` isn't a string; it's the conservation mechanism, always active and always traced.

### 5.6 Allure, desire, attachment [PROPOSAL]

**Desire** is evaluated **on triggers only**: someone observes a use, learns a claim, suffers a relevant shortage, or gains access. There is no hourly actor × item scan.

`D = clamp(0, 100, floor((3U + A + L + E − 2R) / 4))`

| Input | Meaning |
|---|---|
| **U** | Believed utility: Σ believed claim weights × relevance to the actor's own needs. ×3 if the household pantry's `daysLeft` is below its horizon (*the hungry want it most*). Capped at 100 |
| **A** | The actor's attachment to it |
| **L** | The charm's `allure` |
| **E** | Envy of the holder's observed advantage (the prosperity delta on standing) |
| **R** | Believed danger, liability and string cost |

- **`charm_covet`** (Id) fires at intensity 10 × D, capped at 700.
  - The voice is `greed` for production charms, `envy` for status charms, `longing` for strange or beautiful ones, `fear` for dangerous ones.
  - Urges: `ask_to_see`, `beg_loan`, `offer_to_buy`; and `take`, only when `honesty` < 30 and `greed` ≥ 60.
  - Worked example: U 80, A 0, L 20, E 40, R 20 gives D = 65, a 650 thought: *"One turn with that sack would put bread in our cupboard."*
- **`charm_conscience`** (Superego), with speakers from `10` §3.3:
  - `piety` ("a devil's gift");
  - `honesty` ("it isn't honest bread", once `steals` is believed);
  - `neighborliness` ("The children next door have eaten nothing warm.");
  - `our_own` ("it stays in the family").
- **Attachment** is 0–100 per (holder, charm). It rises +3 per day the charm materially helps (cap +15 a week) and +10 when it resolves a real emergency. It falls −1 a day after 7 days without contact or benefit.
  - Losing the charm makes a grief memory at that intensity.
  - At ≥ 60, `charm_keep` fires ("Someone will take it": `fear`, real anxiety) with `hide` urges.
  - At ≥ 80, a `psyche`-mode holder refuses every lend and gift and lies about having it. The PC gets only the thought (§2.1).
- **Longing:** holding an active court charm lowers the fae-longing need by 10 a day. Keepers drift toward the hollow.

### 5.7 As PC gear (P8) [PROPOSAL]

- **Kit Sheet:** virtue shows as a countdown, like lamp oil ("Jack's Lantern: 4 nights; full moon in 6 days").
- **Readiness has three rows:**
  - carried supplies;
  - **verified** conditional charm output (only facts the PC has established);
  - **claims not included in the forecast**.

  A rumor that a sack is endless never silently extends food-days. The iron arithmetic is ungated ("Lantern will sour: 6 lb of iron in the same pack"). The *string* row is gated: a greenhorn sees "keeps fish"; Lore (Fae) 4 sees "keeps fish; one in seven goes back to the River".
- **The catalog-kid fight:** a cold-iron knife *or* a wisp lantern in the same knapsack.
- **No charms in the Book by type** (`03` Q11). Under the Counter, Gussie Pratt may hold one secondhand charm at a time, at `value_cents` adjusted by opinion, with a margin note in her hand.

### 5.8 Starter catalog [PROPOSAL]

The voice follows `03` §2.5. Courts: **H** Hearth, **T** Thorn, **U** Under, **A** Alder, **R** River. ★ marks the eight first-slice charms. Prices are specimen valuations, not shop stock.

| Charm | lb · $ | Virtue · recharge | True use | Quirk / string | The town will say | Disruption |
|---|---|---|---|---|---|---|
| **★ The Never-Empty Sack** (H) *"Tie it shut at night and don't look in till the cock crows."* | ½ · 40 | 7 · +1 per night shut in the dark | 10 lb of flour each dawn | **Draw** from the nearest unwarded flour within 3 mi. It skips iron-banded bins and households that keep the nisse's porridge. `unthanked` | "It makes flour out of nothing." | The mill and store come up short (`pantry_theft`, uncanny). The miller is undercut twice. Iron on his bin moves the draw down the street to a poorer bin |
| **★ The Butter-Print** (H) *"Pear-wood, with a hare. Your butter will come. Theirs is their own affair."* | ⅓ · 12 | 9 · +3 per full moon | The churn comes in five minutes, +50% yield | **Draw:** butterfat from the 3 nearest dairy households (`butter_wont_come`) | "Her butter always comes." | The classic butter-witch accusation, and the accusers are right about the theft, wrong about witchcraft, and the keeper may not know |
| **★ Rain-Hem** (H) *"Stitch inside the flap. Let the weather attend to the outside."* | ¼ · 3 | 2 · hung empty in dawn dew | One container ≤ 10 kg stays dry for 6 h; already-wet contents stay wet | The rain it turns falls on the nearest other uncovered pack within 10 ft | "Never a wet biscuit in his pack." | Mild: who sleeps downwind of whom in a shared camp. **An honest charm: usefulness survives identification** |
| **Mending Needle** (H) *"Bring the thread. It remembers the seam."* | — · 2 | 3 · after an hour of ordinary mending | 30 min and real thread restore 20 condition to cloth or leather (max 80) | Stitches the *repairer's* initials into the seam | "The seamstress's needle." | Initials become evidence in an ownership quarrel |
| **Hob's Besom** (H) *"Leave it porridge with butter. Never thank it, and never, ever give it clothes."* | 2 · 15 | — · while fed | The house is swept, scoured and banked overnight: adults gain 2 h a day | Borrowed labor. Thanked or given a rag, it leaves and takes the house's luck for a year (misfortune rates ×2) | "The house that cleans itself." | The hired girl is let go (her grudge); the farm's nisse is jealous; porridge in the hungry gap; is Sunday sweeping Sabbath-breaking? |
| **Seed-Corn of the Hollow** (H) *"Thirty-one kernels in a twist of paper. Leave the third row."* | — · 20 | 1 per season | A field yields ×3 in 60 days | **Draw:** fields within ½ mi yield ×0.8. **Tithe:** one row in three left standing, or the field goes barren two years | "He's drawing the profit out of our ground." (literally true) | Harvest envy; a neighbor "saves" the tithe row and the field dies. *Needs harvest: later* |
| **★ Bottomless Creel** (R) *"Willow and wet. Don't count your catch."* | 2 · 8 | 5 · dipped in running water at dawn | Contents never spoil for 7 days (spoilage ×0) | `counted`. **Toll:** one fish in seven goes back. With no fish aboard, the River takes something else from the creel | "Fish never rot in it." | Fresh trout at the landing in August undercuts the wood-yard family's fish trade. Mostly gear: fresh food for the scurvy road |
| **★ Spring-Kettle** (R) *"Copper; it never saw a forge. Fill it where the water has a tenant."* | 3 · 10 | 3 · filled at a tenanted spring at dawn | Boils 2 qt with no fire and no smoke (60 fire-minutes) | `cold`. Borrowed heat: the spring it came from skins with ice that day (an omen there) | "Boils on the Lord's own warmth." / "The devil's kettle." | Low in summer, high in a firewood famine. The Glovers' spring freezes, and its tenant's courtesy cools |
| **The River's Token** (R) *"A stone that is never dry. Carry it across."* | ½ · — | — | The keeper cannot drown; fords need no Swim check | **Toll:** within 13 moons the River takes someone who ate at the keeper's table and crosses running water. Behind a World toggle | "He walked out of the flood." | When the toll falls, the man who "can't drown" while his brother did draws a `cursed` attribution |
| **Fossegrim's String** (R) *"Gut, E string. It learned its tune at the falls."* | — · 6 | 3 · meat left at a waterfall | Perform (Fiddle) +10. Dancers are **compelled** (class C, §2.1) until the tune ends, ≤ 60 min; anxiety discharge ×2 | Anyone who has heard the fossegrim knows the tune: a tell on the fiddler | "The devil's fiddler." | The Haugean revival burned fiddles. The Kvale–Tveit split takes a side, and a dancer collapses |
| **★ Jack's Lantern** (T) *"Horn panes, and something inside that knocks."* | 2 · 18 | 5 nights · set out at a ford on a full-moon night | Light radius 3, no oil, never blows out, hidden at will | `aura`, `sings`. Not let out at full moon, it dies, and the bottoms' wisps hold a never-decaying grudge | "Witch-light at the Haas place." | An omen emitter in a low-FI town: thinning rises, fear talk, Bell's debunking. Excellent gear for the Diggings |
| **★ Clew of Red Wool** (T) *"Toss it ahead and follow. It knows every road with a name."* | ¼ · 9 | 20 mi · +1 per night in moonlight | Never lost; pixie-led reroll +10; immune to turned paths | Leads only to *named* places. Ask it for a name you don't know, and at FI ≥ 3 it leads to the court | "The surveyor's fairy thread." | Whitcomb wants it for running lines, a fae thing used to chain the land. The Prince's fury; a land-office dispute over a line laid by thread |
| **★ Hollow Penny** (T) *"A Spanish bit, holed. Spend it as often as you like."* | — · ⅛ | — | Back in the spender's pocket at dawn | `chooser`. **Draw:** it takes itself back out of the till. Stolen, it goes home to its chooser | "The stranger's coin." | Short tills (12½¢ every dawn); counterfeit suspicion; the Bank Note Detector; a Mountebank's con. The cleanest conservation test there is |
| **Huldra's Cowbell** (T) *"Bronze. Look for the clapper, and keep looking."* | 1 · 12 | 6 · +1 per night the cow lies out on a goat prairie | The cow comes when called from 2 mi; +25% milk; wolves pass her by | At full moon she is found at dawn on the prairie, combed, with flowers in her halter. **Reclaim:** at Midsummer a huldra comes courting the herdsman | "The cow that comes home by itself." | Dairy envy; cow theft; a courtship the pastor won't marry |
| **Huldra's Comb** (T) *"Horn, with one cow's hair that won't come out."* | — · 15 | 5 · +1 per night left at a spring | The next person the combed one thinks of sees them as their soul-image for a day (`10` §8.4). **Class A**: temptation, never command | The huldra learns each combed name. A false-love memory forms when it ends. Behind `06`'s seduction toggle | "The love-comb." | Broken engagements, jilted grudges, a marriage made by comb |
| **Rush Bridle** (T) *"Plaited rushes and a brass bit no bigger than a thumbnail. Slip it on a sleeper, and ride."* | — · — | 3 · +1 per new moon | **`set_agency`** (class D, §2.2): a sleeper is `commanded` by the holder until dawn (≤ 6 h). Will DC 14 + link at onset and every 2 h. Blocked by iron at the bed or open scissors | The ridden wake Fatigued, with mud on their boots and the rider's face in an `uncanny` dream. +6 link to the holder | "Hag-ridden." | Fields plowed overnight by a neighbor's exhausted son; spectral-evidence accusations that are sometimes right; the classic witch-bridle panic. **Slice 2** |
| **Blue-Burning Candle** (U) *"Tallow and something else. Leave the crusts."* | ⅓ · 7 | 10 h · +1 h per pasty crust left in a working overnight | Burns blue near galena (Trade (Mining) +6 to prospect); gutters 10 min before bad air or a fall | Used by someone not in the Accord's good standing, it finds ore *in a court's hall*, and a shaft there breaches the Accord | "The knocker's candle." | A lead strike, claim fights. Whose is it: the finder's, or the Club's? |
| **Measure That Agrees** (U) *"Two hands upon it, and neither may call the length otherwise."* | 1 · 7 | 2 · after settling a disputed account | Records a measured length and both parties' assent, sincerely | It proves agreement, **not** a correct boundary | "The honest chain." | Claim clubs want it for assent; surveyors want it for lines. A wrong boundary sworn true |
| **Briar Pin** (A) *"Blackthorn, red bead. Four hours' sleep, eight hours' rest."* | — · 6 | 7 · +1 per night pinned in an empty pillow | Rest recovery ×2 (borrowed) | Worn: dream receptivity +30, and the court sends freely. 30 nights: Drift +1 | "The man who never sleeps." | The employer wants pins for the whole crew; the crew's dreams converge (`10` §9.2); then a morning panic |
| **Jay's Feather in a Vial** (A) *"Ask it Thursday about Sunday."* | — · 9 | 3 · +1 a week | The true weather 72 h out, read from the weather path ahead | It can't foresee anything its keeper will change | "He knows when the frost is coming" → **"He makes the frost."** | His corn beats the early frost while the valley's dies. **A charm that predicts gets blamed for causing** |
| **Still-Water Glass** (A) *"Water that won't spill, in a looking-glass frame. Look at midnight."* | 1 · 25 | 3 · +1 per full moon | Shows what happened at a spot on a chosen night within the last moon, glamours included | Spectral testimony: weighted by Superstition and Piety; no standing before the JP | "The glass that tells the truth." | Every grudge wants a look; affairs exposed; accusations made "by the glass". *Needs a per-place memory: later* |
| **Name-Locket** (A) *"Pinchbeck, with a folded paper. Write in it the names you love."* | — · 10 | — | Up to 7 names inside are hidden: name-targeting −6, true-name links fail | Its keeper holds a +6 link on everyone named. So does its court, if it is ever opened at FI ≥ 3 | "A protection for the family." (half the truth) | Who keeps it: the mother, the Hall-reader, the pastor? Leverage, and a witch who wants it |
| **The Returned Cup** (A) *"Silver, engraved with a child's name and 1829. Found in the hollow."* | ½ · 30 | — | Milk in it never sours; a child fed from it gets +4 Fort vs. disease, and the Alder Court won't take that child | **Provenance:** taken from a christening 26 years ago. Worldgen names the household | "The Kessler cup." | Three claims (the name's family, the finder, the mother whose baby it guards); old grief reopened; the Alder Court wants it back |
| **Knotted Wind-Cord** (R) *"Three knots. One for a breeze, two for a blow. Leave the third."* | — · 5 | 3 knots · never | One knot: a fair wind for a day. Two: a gale. Three: a storm over the district | Consumable | "Wind for sale." | Raftsmen bid for it. Then the third knot, untied by a drunk, a child or a grudge, and the district's storm damage is attributed to the keeper |

Two rules apply to the whole catalog:
- **Not every useful charm hides a harmful price.** Rain-Hem, the Mending Needle and the Measure are fair bargains with inconveniences. Their stories are about access and credit, not ruin.
- **Fae-made is not fae food.** The sack moves ordinary mortal flour, with its real kcal, protein, Fresh, spoilage age and prep requirements.

---

## 6. The disruption arc (D)

### 6.1 No arc state machine [PROPOSAL]

Nothing in code is called `CharmArc`, and no state drives behavior by stage. A charm runs exactly four processes:

| Process | What it does |
|---|---|
| **virtue** | Spend and recharge |
| **draws** | Conservation transfers, plus the source's misfortune |
| **strings** | Deferred triggers |
| **allure** | The desire generator (§5.6) |

Everything else is the existing sim reacting. The "stages" below are **sifter readings**: the Chronicle and the Director *name* the stage a town is in; they never cause it. Any link can fail. The charm may stay private, become shared equipment, be sold promptly, or sit unused in a drawer.

### 6.2 New pieces, all small and additive [PROPOSAL]

1. **Items as belief subjects.** Core `PropArg` gains `item` (the schema allows it; core lacks it). New predicates:

   | Predicate | Kind |
   |---|---|
   | `does(item, claim)` | Supernatural, per claim |
   | `has(actor, item)` | Who people think holds it |
   | `owns(actor, item)` | Rightful claim |
   | `lent(actor, actor, item)` | |
   | `draws_from(item, household)` | |
   | `boon(item)` / `bane(item)` | The town's verdict |
   | `fae_abroad(place)`, `portent(actor)` | Omens |

2. **Charm notoriety:** per settlement, the share of adults with credence > 20 on any prop about the item.
3. **Thought rules:** `charm_covet`, `charm_keep`, `charm_conscience`, `omen_fear`, `omen_longing`.
4. **Interactions** (file `content/base/interactions/fae.toml`, owned by fae under a MODULES.md amendment):

   | Interaction | Resolution |
   |---|---|
   | `ask_to_see` | Free |
   | `beg_loan` | Persuade. Creates an **object loan**: a promise with a due date, allowed use, deposit and recharge duty. It moves the item |
   | `offer_to_buy` | Bargain |
   | `return_item` / `extend_loan` / `refuse_return` | A missed deadline is a remembered breach, not an automatic theft verdict |
   | `demand_return` | Intimidate or Persuade |
   | `take` | Sleight of Hand or Stealth vs. Perception. Witnessed → the existing `stole_from` |
   | `hide` | Conceal belief |
   | `share_out` | An undoing act |
   | `denounce` | A Preacher-office sermon with the item as subject |
   | `confiscate` | Office: preacher, sheriff, Hall-reader or Club steward. Slice 2 |
   | `sue_replevin` | JP hearing. Slice 2 |

   **Availability is validated before time is spent**, and the reason is named (asleep, working, not present, no access). This fixes triage finding #4.
5. **Draws** move stacks with `moveStack` and call `reportMisfortune` on the source household. They add `Misfortune.causeItemId?` so the epilogue can say "the sack did it" while `culpritId` stays empty. Draws aggregate into one `fae.charm_drew` per (charm, source) per day.
6. **Opinion defaults:** a returned loan gives Trust +5 and Obligation −5; a knowingly broken one gives Trust −15 plus a restitution grudge, through ordinary memory.

### 6.3 The stages as the sim runs them [PROPOSAL]

| Sifter stage | What is actually happening | Rides on (existing API) | Events |
|---|---|---|---|
| **1 Arrival** | A charm stack enters a settlement's orbit (§6.4) | items `moveStack` | `fae.charm_arrived` |
| **2 Novelty** | First uses are witnessed: an Observation on a `does()` claim. Uses emit their `signs` as omens | belief `observe`; omens | `fae.charm_used`, `fae.omen` |
| **3 Utility** | The keeper's household measurably gains pantry kcal, hours or cash. The prosperity delta raises Respect and feeds E | provisions; social labels | provisions events |
| **4 Desire** | `charm_covet`, strongest in the hungry: urges to see, beg, buy, take | psyche `addThought`, arbitration | `psyche.thought`, `psyche.arbitrated` |
| **5 Claims** | Competing voiced `owns` beliefs (§6.5). Opposed claimants at Affection ≤ −30 spawn grudges (aim: restitution) | belief, grudges | `belief.formed`, `belief.grudge_formed` |
| **6 Circulation** | Loans, theft, sale. Each transfer re-binds or doesn't (`chooser`). **A thief's half-working charm makes the thief believe the keeper is witching it** | social interactions; items | `social.interaction`, `items.moved` |
| **7 Talk and mutation** | Claims climb the claim graph ("feeds a family" → "makes gold"). `keeps_charms` on the keeper climbs toward `witch` | belief `transmit` | `belief.transmitted` |
| **8 Split** | Believers divide on `boon` vs. `bane`. Patrons cue clients (`04` §7.1); household feuds align with the split. Factions are agreements with real commitments (signed terms, pooled payment), not a stage timer | belief Commons; social | sifter only |
| **9 Economic shock** | Draws hit a source: stock short, attributed misfortunes. **Iron shifts the draw onto the next unwarded store, which belongs to someone poorer** | provisions; `reportMisfortune`, `attributeMisfortunes` | `fae.charm_drew`, `belief.misfortune`, `belief.attributed` |
| **10 Church, ban, accusation** | The preacher's psyche picks the sermon frame, bless or burn (reaction formation makes a crusader). Attribution's `magic` term points uncanny misfortunes at the keeper, and the process climbs | belief escalation (rungs 0–3 in code) | `belief.escalation` |
| **11 Crisis** | A collision of obligations. A string fires; theft turns violent; the keeper reaches rung ≥ 3; the truth is revealed (a moral flip: the "gift" was theft); or a **dependency crash**, where virtue runs out after the mill has cut its hours | fae strings; belief | `fae.string_due`, `fae.charm_revealed` |
| **12 Resolution** | §6.8 | | `fae.charm_disposed {how}` |

### 6.4 Arrival vectors [PROPOSAL]

**The Director never creates a charm** (`05` §8.3). Worldgen seeds a **reservoir** instead:
- 1–3 court-appropriate charms per anchor site (6–10 anchors);
- Night Market stock of 4–6;
- a sealed iron-lined chest in about 30% of Hall-reader households.

That makes 25–40 charms in a standard county, ~90% of them "under the hill". The reservoir is just charm stacks at places; it needs no separate state.

| Vector | How it happens in the sim | Rate / county-year |
|---|---|---|
| **Found** at FI ≥ 3 springs, rings, fictional barrows | Forage, ginseng, wood or play activity at a reservoir place: Perception DC 15, 5‰ per charm per hour. Children and sang-diggers find most | ~2 |
| **Strays** | On full-moon and festival nights (~16 a year), each reservoir charm at FI ≥ 3 strays to an adjacent lower-FI place at 6‰: dropped by the Hunt, left by a huldra at a spring | ~3 |
| **Hearth gifts** | A household that has kept tribute 3+ years and suffers a misfortune may be gifted by its nisse. Accepting is a forfeit: a gift binds | ~1 |
| **Courting gifts** | A huldra or an Erlking's daughter courting a mortal | ~1 |
| **Night Market** (F4) | Bought with names, memories, years or storied objects | ~1–2 |
| **Sealed chests** | Estate sales, theft, a child, a lapsed elf in hard times. Never trade by people type | ~0.5 |
| **Accord gifts** | The Under-Court rewards a pare in good standing; it becomes a Club matter at once | ~0.5 |
| **Peddlers** | 1 in 20 peddler arrivals carries one (N7 era tables, weighted by role only) | ~1 |
| **The Prince's games** | Agenda `gift_test`: his retainer leaves a charm where a target household will find it. In witch mode it's a Behest | ~1 |
| **The PC** | Brings one home | Commonest in practice |
| **Director windfall: N13** | A *compound* nudge on an **existing** charm within a day's travel: an N1 stray tilt (±1σ), an N8 peddler route, an N9 placement on a path, or an N2 choice among gift candidates. Cost 5. Only in RELAX or BUILD, with no charm thread active in that settlement. Never weighted by people or culture | Pacing |

**Target:** 8–12 arrivals a year, about half reaching a settlement. That is one charm thread somewhere in the county every 6–8 weeks, often arriving as rumor from Kvale Ridge or the Diggings (P3, P5), and one per settlement every 1–2 years.

### 6.5 Whose is it: claims and the four layers [PROPOSAL]

| Layer | Lives in |
|---|---|
| **Possession** | Item location |
| **Rightful claim** | Beliefs `owns(actor, item)`, with the basis as evidence source |
| **The law's word** | A JP ruling: Document evidence on `owns` |
| **What it chose** | `boundTo` |

**The arc lives in the disagreements between these layers.** Carrying a charm never means rightfully owning it. Claims seed when an actor comes to hold `has(x, item)`:

| Right | Claimant | Seed credence |
|---|---|---|
| Finder's | The finder | 70 |
| Land | The household whose place it was found on (`thrift`, `our_own`) | 60 |
| Source | Households that hold `draws_from(item, them)` ("it's our flour") | = that belief |
| Name | A name or provenance on the object (the cup) | 90 |
| Commons | The keeper's Club (dues make common property) | Club norm |
| The fire | The church, if `bane` prevails among its congregants | Church norm |
| Seal it | The Hall | Hall norm |
| The court's | The fae that made it, where a `reclaim` string exists | 100 (Law) |
| Heirs | Heirs, on the keeper's death | Kin rule |

A replevin verdict settles the law's word and leaves the charm's word unchanged.

### 6.6 The institutions answer, and lose [PROPOSAL]

This is the doc's answer to the colonial and primitivist framing. Every community is competent, and the charm defeats competence by falling outside its categories.

| Institution | Its sophisticated answer | Why the charm beats it |
|---|---|---|
| **The law** (JP, replevin, land office) | Treat it as property; sue for its value | It works for whom it chose. A judgment can give the sack to the claimant, not make it fill |
| **The market** (store ledger, Bank Note Detector, a Yankee speculator) | Price it; buy it under the counter; float "The Hollin Never-Fail Flour Company, 40 shares at $1" | Virtue doesn't scale with shareholders. Forty co-owners means forty grudges, and the draw still empties *somebody's* store |
| **The mill and its toll** | Iron on the bin; count the sacks | The draw skips iron and moves on to a poorer, unwarded bin. **Iron is wealth, and fae draws fall on the poor** |
| **The pulpit** | Bless it as Providence or burn it as the Devil's | The frame follows the preacher's psyche. A Haugean lay preacher and the settled pastor split along it |
| **The Hall** | Confiscate and seal it in iron | This *works*. But confiscation is theft to the keeper (a grudge), and the Hall's attic becomes the next arrival vector |
| **The Club** | Vote it common property; relief by rule | Members fight over priority, and a non-member family goes hungry next to a never-empty sack: `12` §8.9's "Club winter" made acute |
| **The lyceum and the freethinker** | Measure it and publish | This reveals the true function and flips the town's morality overnight. Bell's skeptic paper becomes the thread's protagonist |
| **The household** | Keep it in the family | Attachment, inheritance fights, the keeper who lies about having it |

The joke is always on the institution and never on anyone's intelligence. Responses are norms and office data, never people traits.

### 6.7 The economy, honestly [PROPOSAL]

- **Worked scale (illustrative prices):** the sack moves 10 lb a day, about 300 lb a month, or $9–15 of flour at 3–5¢/lb, out of someone else's bin. That's enough to feed a household of eight and to hurt a small mill's toll income. It is not a county collapse.
- **What makes it bigger:** a lean month, several keepers, a disputed debt, or a store with no restock.
- **Real flows:** fewer flour purchases by the keeper; stock shortfalls at the sources; more demand for iron bands, locks, recharge offerings, transport and interpretation.
- **Prices move only through `03` §8.2's supply and demand** once that exists. Until then, show displacement through stock and cash transactions. **Never fake a crash with a scripted penalty.**

### 6.8 Crisis and resolutions [PROPOSAL]

| Resolution | How | After |
|---|---|---|
| **Destroyed** | Cold iron and fire at a forge: Trade (Smithing) DC 15 + 3·tier with ≥ 5 lb iron. River charms need salt and running water | The court's Affront against the destroyer; uncanny weight on their household. Independent debts remain. Johann Brenner, who "absolutely believes in iron", is the obvious executioner |
| **Returned to Faerie** | Carried to an FI ≥ 3 place of its court at its calendar key: Fae Courtesy DC 15 + 2·tier, or *Send It Home* | Tally and strings released if the terms are met. Sometimes a gift comes back: a new arrival |
| **Sold away** | To a peddler, or downriver off-map | It leaves the county with disclosed or concealed strings. Ballad: "last seen at Galena". It may return in a legacy run |
| **Buried** | At a crossroads or under a threshold, with iron | Sours to dormancy over 30 days. A recoverable cache, not deletion; `homing` may undo it |
| **Confiscated** | By an office (slice 2) | The institution becomes the keeper and inherits the thread: the pastor's cupboard flour |
| **Shared out** | Lent by rota, plus restitution to the source, plus tribute kept | The Hearth Court approves; envy dissipates. **The only "good ending", and it takes three choices** |
| **Shared custody** | A schedule enforced by ordinary promises | A durable accommodation, and also a story |
| **Dormancy** | Virtue spent and never recharged | **Dependency crash:** the households that stopped buying flour, the mill that cut its hours |
| **Reclaimed** | A string: the court sends someone | A bargain to keep it (F6), or loss |
| **The keeper departs** | Emigration, or driven out at rung 3 | The charm goes with them, or stays in the house for the next family |
| **A quest to be rid of it** | A thread hook: "Carry it to Lantern Spring before the full moon" | Adventurer employment |

### 6.9 Chronicle pattern: "The Charm at ‹town›" [PROPOSAL]

The detector is `chronicle/patterns/charm.ts`. Its thread key is charm item × settlement. It **keeps its facts in the thread**, so it still resolves after source events leave the rolling log. It composes with existing patterns (`shortage` at the mill, `scapegoat` for a blamed hired man, `feud`, `debt`, `whispers`) by citing their thread ids.

| Fact | Condition |
|---|---|
| `arrived` | `fae.charm_arrived` |
| `used` | A witnessed use |
| `talked` | Prevalence ≥ 200‰ on any claim |
| `coveted` | ≥ 3 covet urges *acted on* |
| `claimed` | ≥ 2 opposing voiced `owns` |
| `circulated` | A transfer not by the keeper's free choice, or ≥ 2 loans |
| `mutated` | A variant ≥ 2 hops up the claim graph |
| `split` | `boon` and `bane` each ≥ 25% of believers |
| `shocked` | A source with ≥ 2 attributed misfortunes, or measured displacement ≥ 20% of a source's weekly sales |
| `accused` | A keeper's process at rung ≥ 2 |
| `crisis` | A string fired, violence, or the truth revealed |
| `resolved` | Any §6.8 outcome |

**Levels:**
1. **A curiosity:** arrived, used, talked.
2. **A want:** coveted, claimed.
3. **A quarrel:** circulated, plus split or shocked.
4. **A trouble:** accused or crisis.
5. **Closed**, then **Truth** in the epilogue.

New template slots (additive to the closed `TEMPLATE_SLOTS`): `charm`, `claim`, `keeper`, `source`, `omen`.

- *Paper, level 1:* **A Curiosity at Iron Ford.** "We are told that {keeper} has come into possession of a flour sack of uncommon habits. Our informant says it {claim}. We print it as given."
- *Paper, level 3:* **The Sack Question.** "Nothing has divided {town} like {charm} since the bell was hung. One party calls it Providence and the other theft, and both buy their flour cheaper."
- *Journal, level 3:* "The sack first passed between three kitchens. By Sunday, two households called it a loan and a third called it a gift."
- *Ballad* (charm notoriety ≥ 75): "It fed the ridge and starved the mill, / and no one asked whose bread."
- ***Epilogue, Truth:*** "The sack never made a pound of flour. It took 1,140 lb from Pratt & Daughter's back room, 600 lb from the mill, and 90 lb from the Club cupboard. The mill's loss was blamed on the Fenns' hired man, who left the county in September." This comes from `drawLedger` and the attributions. **The post-run truth reveal is where the story becomes worth telling** (P5).

Fair-mode prose uses only facts known to the PC.

### 6.10 The player: cause, exploit, prevent, resolve [PROPOSAL]

| Mode | Verbs |
|---|---|
| **Cause** | Bring one to town. *Whom* you give it to chooses the thread: the poor widow gets a scapegoat engine, the pastor a church crisis, the Club a rules war. Plant one to frame someone. Say "thank you" to the keeper's sack at supper |
| **Exploit** | Rent it out and become patron to half the town (the Obligation ledger). Buy cheap from a frightened keeper. Broker honestly (Intercede). Sell the true function to Bell. Take the fee to carry it to the hill. Run the Hollow Penny con, at a grudge per mark |
| **Prevent** | Ridicule early (Mock lowers Superstition); buy it out; keep it iron-lined; study it and tell the keeper what it really does; make restitution to the source; organize a public test. Warning the miller about iron only moves the draw down the street, and the epilogue says so |
| **Resolve** | Any §6.8 route; testify at the replevin hearing; organize sharing plus restitution; keep it private (a real strategy) |

**Exploit guards:**
- conservation, as a property test;
- `chooser` and `turns_on_sale` stop infinite resale;
- virtue caps throughput;
- *Wake the Virtue* costs Tally;
- no buy/sell spread duplication;
- the PC acts only by Command.

### 6.11 Witch mode [PROPOSAL]

- **Charm-sowing is cursing by gift.** A charm the witch gives is an accepted gift, a +4 link (`06` §3.5) on the receiver. Every thread she starts is also a target list.
- **Behests fit.** "Let the Lutherans believe the Methodists cursed them": a Butter-Print delivered to a Methodist dairy among Lutheran churns. The Prince's `gift_test` uses her as courier.
- **Woe rules stay `06`'s:**
  - ordinary satisfaction and jealousy mint no Woe;
  - harm through a qualifying curse uses its causal record;
  - uncaused misfortune can be **Gleaned** only by her claim and the victim's belief, at the reduced attribution;
  - one sufferer's loss is never counted again per rumor variant;
  - selling a charm doesn't reset habituation.
- **Sympathy runs both ways.** When a town destroys her gift with iron and fire, she takes 1d6 nonlethal and a burn tell, so destroying the charm is also how a town *finds* her.
- **Her gear:** the Spring-Kettle for a smokeless winter camp, the Clew for flight, the Rush Bridle for labor she can't do herself. Charms found at her hut on a rung-5 search are Physical evidence.
- **The trade-off:** a witch can save a town from a charm and lose the Woe its feud would have paid. The Tithe is still due at the full moon.
- **Adventurer counterpart:** hired to rid a town of a charm, or to recover one from a witch.

### 6.12 Worked example: the sack at Iron Ford (fixture `charm_at_iron_ford`)

- **Day 3:** a stray sack lands in Lower Lantern Coulee. A Fenn child finds it while foraging (a Perception success). The Fenns' pantry is below its horizon.
- **Days 4–9:** the dawn draws feed the Fenns. Two uses are witnessed by a visiting neighbor, giving `does(sack, feeds)` at 60. Chat moves it to `never_empty` by day 7.
- **Day 8:** Tollef Haugen's bin comes up short twice, and `pantry_theft` is attributed to a hired man (`scapegoat` thread). Then he iron-bands the bin. The draw shifts to the Club cupboard.
- **Day 12:** the Moe household's `charm_covet` reaches 650 and wins arbitration: `beg_loan`. The loan is due Sunday.
- **Day 16:** an overdue loan, two opposing `owns`, a `boon`/`bane` split along the Kvale–Tveit line. Level 3: a quarrel.
- **Day 20:** Clara Stoughton measures the sack. The *Sentinel* prints "steals flour". Moral flip; Haugen's grudge retargets from the hired man to the Fenns.

**None of this is scripted.** In another seed the Fenns hide it, or Brenner burns it on day 10, or the Club shares it out.

---

## 7. Implementation (E)

### 7.1 Module, ownership, foundation asks [PROPOSAL]

**`module:fae`** (amend `docs/impl/MODULES.md` first) owns:
- `packages/core/src/fae/{state,events,commands,system,api,view,index}.ts`, plus `omens.ts`, `thinning.ts`, `describe.ts`, `charms.ts`, `effects.ts`, `draws.ts`, `strings.ts`, `loans.ts`; later `workings.ts`, `tally.ts`, `drift.ts`;
- `packages/content/src/schema/fae.ts`, with `faeDomains`: `omens`, `describeLines`, `charms`, `quirks`, `strings`, `courts`, `workings`;
- `content/base/fae/`.

**World slice:**
`world.fae = { thinning: Record<PlaceId, number>, charms: Record<ItemId, CharmState>, strings, loans, tally, signatures: Record<PlaceId, OmenId>, cooldowns }`

**Foundation asks (additive):**
- `ModuleId += 'fae'`, `STREAMS += 'fae'`, and the event and command unions.
- Schedule: `needs → psyche → activity → fae → social → belief → provisions → chronicle`. Fae runs after activity, so it knows who is where. It runs before social and belief, so omen talk and evidence land the same hour, and before provisions, so draws reach this hour's meals. Fae urges reach psyche through the proposal hook on the next hour, matching current reactive-thought behavior.

**Cross-module asks (additive contracts, through `api.ts` only):**

| Module | Asks |
|---|---|
| **belief** | `PropArg 'item'`; the new predicates; `Misfortune.causeItemId?`; per-claim mutation links. Calls `observe`, `reportMisfortune`, `internProp` |
| **psyche** | `AgencyState`, `setAgency`, `agencyOf` (§2.3); the `proposeFaeUrges` hook; thought rules; urge tags `gift take fae_use` |
| **social** | Object-loan records; `addObligation`; the `interactions/fae.toml` file; memory kind `omen` |
| **items** | `moveStack`, `createStack` (worldgen only); `PROVENANCE_CAP` 8 → 16 for `notable` stacks (meaning lives in `CharmState.facts`, not event ids) |
| **content-world** | Runtime `Place.description` and `tags`; the standardized feature tags; `court` → `fae_court` |
| **chronicle** | Template slots; the `charm` detector |
| **play / web** | `look`, `signs`, charm cards, interrupt policy, the `struggle` command |

**Fae API:**
- `omensAt`, `describe`, `charmView`, `forecastCharmUse`, `useCharm`, `rechargeCharm`, `proposeFaeUrges`, `obligationsOf`;
- later `learnWorking`, `work`, `applyDriftGain` (Drift storage lives in `fae/drift.ts` until `06`'s home exists; peoples' `fae.drift_floor` is already data).

### 7.2 Events and Commands [PROPOSAL]

| Event | When | Importance |
|---|---|---|
| `fae.omen` | An episode with ≥ 1 noticer (true or lookalike) | 5–30 by strength |
| `fae.thinning` | A place crosses a stage | 20 |
| `fae.incursion` | Lost time, turned path, voice, sighting | 30–60 |
| `fae.charm_arrived` / `_used` (first witnessed per day) / `_drew` (daily per source) / `_recharged` / `_revealed` / `_disposed` | | 20–70 |
| `fae.string_accepted` / `_due` / `_breached` / `_released` | | 30–60 |
| `fae.agency_set` / `fae.agency_restored` | | 60 |
| `fae.working` / `fae.working_learned` / `fae.tally_called` | Slice 2 | 15–50 |

- **No per-actor-per-hour events.** Social owns claim and loan events, provisions owns material losses, and belief owns transmission and accusations.
- **Commands** (ADR 0002 parity; each is a headless verb):
  - `look`, `signs`, `fae.inspect`, `fae.study`, `fae.use {item, target?}`, `fae.recharge`, `fae.offer {item, place}`, `fae.let_out`, `fae.return`, `fae.destroy`, `fae.bury`, `fae.fulfill {string}`, `struggle`;
  - later `fae.practice`, `fae.work`, `fae.accept_terms`;
  - interactions go through `core.urge`, as today.
- **Queries** don't advance time. Inspect, study and test do.
- **Unavailable actions explain why before commitment.** A failed eligibility check never consumes an hour.

### 7.3 Explain and knowledge [PROPOSAL]

| Thing | `knowledge` | Unlocked by |
|---|---|---|
| Notice and read rolls | `self` | — |
| Omen truth | `omniscient` | A read; Dusk-Sight |
| A charm's true function, draw source, `boundTo` | `omniscient` | Study, measurement, a traced shortfall, observation |
| Virtue | `self` (holder) | — |
| A string's trigger | `omniscient` | Lore (Fae) study at DC +5 |
| Working checks | `participants` | — |
| Exact Tally | `self` | Lore (Fae) 4, Second Sight, the Pact |
| A rider's identity (bridle) | `omniscient` | A dream read, a confession, being caught |
| Thinning stage | `public`, as description words | — |

- **Separate the fair Explain from the full resolution** whenever the total would reveal a hidden modifier. Redacting a label while leaving revealing arithmetic isn't enough.
- **Normalize at `appendEvent`** with `term()` / `intValue()`. No `-0`.

### 7.4 Determinism and performance [PROPOSAL]

- **Rolls:** `ctx.rng('fae', mixKey(place|item, day, window|action, SALT_*))`. Checks use the `checks` stream. `describe()` uses `hashString32` only. Iterate with `idsOf()` / `rowsOf()`; sort by stable id.
- **Conservation property test:** 64 seeds × 60 days. Σ cents and Σ kcal never increase on any `fae.*` event, and every draw names its source in its Explain.
- **Hot paths:**
  - omens roll per (place, window), lazily, and only notice-roll for present actors;
  - desire is evaluated on triggers, indexed by charm, with ≤ 3 notable charms per settlement;
  - draws resolve once per dawn;
  - charms are indexed by holder and location, strings by due time;
  - no O(all stacks) scans in per-hour loops.
- **Budget:** fae ≤ 0.3 ms per game-hour at Iron Ford scale; a `--years 1` run within +10% of today's.

### 7.5 Worldgen hooks (ADR 0003) [PROPOSAL]

- **FI field (layer 4):** seeded from springs, caves, sinkholes, fog pockets and old growth. Algific slopes and erratics are negative. **Never from mound forms.** Fae barrows carry `fictional = true`.
- **Anchors:** 6–10, with a court chosen by terrain: springs → River or Thorn; caves → Under; alder and fog bottoms → Alder; farm rings → Hearth; coulee heads → Thorn.
- **Places:** standardized feature tags, base descriptions from tags × FI, and one persistent signature per FI ≥ 2 place.
- **Reservoir:** seeded per anchor, Night Market and Hall household (§6.4).
- **Pre-roll:** omens, thinning and charm processes run in history pre-roll. A start therefore has local signs in the Commons and 0–2 charm threads underway or remembered ("the year of the Haugen sack").
- **QA:**
  - a reachable FI 2–3 excursion within a day;
  - a stronger anchor within intended travel scale;
  - ≥ 2 terrain families;
  - no omen desert; no empty reservoir; the conservation check in the 30-day QA sim.

  QA never requires a persecuted person or uses concealed heritage as drama fuel.
- **`gen:town` today:** its FI-5 `spring` place gets one reservoir charm.

---

## 8. First slice: omens, a place, a useful object, a dispute [PROPOSAL]

This is about one module-agent wave, with owner integration requests written before work starts.

**Scope:**
1. **Foundation:** stream, ModuleId, schedule slot, unions, `PropArg 'item'`.
2. **Omens:**
   - 14 definitions spanning FI 0–5 and the main terrain families, including Providence signs, lookalikes and one Ice family;
   - windows and keys; notice and read;
   - `fae_abroad` evidence, the `omen` memory kind, fear and longing thoughts, livestock reactions;
   - thinning through **Portents** (lost minutes, turned paths). Visitations and Incursion emit stub events only.
3. **Descriptions:** runtime `description` and `tags`; persistent signatures; six-layer `describe()` for every `iron_ford` and `gen:town` place; `look` in play and the web inspector.
4. **Signs & Wonders:** the `signs` command and the Journal page.
5. **The eight ★ charms:**

   | Charm | Hooks into |
   |---|---|
   | Never-Empty Sack | Stores, mill stock, pantries, `pantry_theft` |
   | Butter-Print | `butter_wont_come` |
   | Rain-Hem | Wetness |
   | Bottomless Creel | Spoilage |
   | Spring-Kettle | Prep fire-minutes; spring places |
   | Jack's Lantern | Light supply; aura; omens |
   | Clew of Red Wool | Place moves; turned paths |
   | Hollow Penny | Till and cash |

   Effect kinds as listed in §5.1. Quirks: `unthanked`, `chooser`, `counted`, `homing`, `aura`, `sings`, `cold`. No death strings.
6. **Beliefs:** `does`, `has`, `owns`, `lent`, `draws_from`, `boon`, `bane`, `fae_abroad`; claim graphs for the eight; claim-seed rules; the `keeps_charms` link.
7. **Psyche:** `charm_covet` (the D formula), `charm_keep`, `charm_conscience`, `omen_fear`, `omen_longing`. **Agency gating of consequential tags for `commanded` actors** (the §2.3 minimum, which also closes triage finding #2).
8. **Interactions:** `ask_to_see`, `beg_loan` (object loan), `return_item`, `refuse_return`, `offer_to_buy`, `demand_return`, `take`, `denounce`.
9. **Arrival:** strays and found-by-activity, plus the fixture `charm_at_iron_ford`, which pins a sack stray into Lower Coulee on day 3. There is no Director work.
10. **Resolutions:** destroyed at the smithy, returned at Lantern Spring, buried, sold off-map, shared custody, dormancy.
11. **Chronicle:** the `charm` detector at levels 1–4 plus Closed and Truth, in Paper, Journal, Almanac and Epilogue.

**Out of scope:** learning, the Tally, court AI, Visitations and Incursion beyond stubs, path rewriting, time-slip encounters, a dynamic price model, confiscation and replevin, rungs 4–6, and agency transfer. Catalog entries that depend on these stay unspawnable.

**Acceptance:**
1. `just check` is green. Every golden chronicle diff has a one-line reason.
2. **Iron Ford, seed 42.** A scripted PC walks Iron Ford → Lower Coulee → Huldra's Shelf → Cold Stair, reaching the Cold Stair at dusk on day 2.
   - It notices ≥ 3 omens, ≥ 1 of them a lookalike.
   - The Cold Stair yields only Ice signs.
   - No Explain shows truth before a successful read.
3. **Fresh seeds.** In ≥ 7 of 8 fresh generated seeds, a fair-mode explorer finds a distinct description, notices a real fae sign and gets an actionable lead within 8 days, without forcing the same scene.
4. **Rumor.** By day 4, ≥ 3 named Iron Ford NPCs hold `fae_abroad(·)` ≥ 40 through rumor, and `ask_about` surfaces one.
5. **Descriptions.** Every `look` returns ≥ 3 layers. No two adjacent places render identically in the same hour. Lore (Fae) 0 and 4 see different fae lines. Repeated `look` never rerolls.
6. **Spam.**
   - ≤ 1 omen Journal entry per PC-day and ≤ 1 omen Paper item per week;
   - `fae.omen` < 2% of a year log;
   - the chronicle `uniq -c` check shows no dominant omen template.
7. **The arc is emergent.** On `charm_at_iron_ford`, 64 seeds × 60 days, nothing scripted:
   - level 2 in ≥ 50% and < 100% of seeds;
   - level 3 in 20–80%;
   - a keeper at rung ≥ 2 in ≥ 10%;
   - ≥ 15% of seeds close at level ≤ 2 (kept quietly, shared or sold);
   - ≥ 4 distinct resolution kinds across seeds.
8. **Gear.** Every ★ charm changes real state and Readiness. Forecast and use agree on fuel, water, wetness, spoilage and flour. Unverified claims never enter the forecast.
9. **P2.** A hungry NPC begs, borrows or takes a charm through the same rules as the PC. A controlled fixture produces a peaceful lending arrangement.
10. **Mutation and conservation.** A rumor exaggerates the sack while the truth stays finite. The conservation property test passes. The Epilogue prints the draw ledger.
11. **Agency.** A commanded PC never uses, lends, gives, hides or takes a charm without a Command, across 64 seeds.
12. **Persistence and fairness.**
    - Replay, forks and save/load mid-arc are bit-identical, and `findNonIntegers` is empty.
    - The pattern resolves after source events leave the log.
    - Fair mode leaks no truth, draw source, `boundTo` or concealed attribute through text, ids, actions or Explain arithmetic.
13. **Performance.** The §7.4 budget holds.

**Playtest gate (ADR 0002, fair mode):** `iron_ford` 42, `gen:town` 1–10, the charm fixture, plus fresh seeds.

| Persona | Must show |
|---|---|
| **Explorer** | Something fae within 2 days of going up the coulee. ≥ 4 of 5 runs report a sign they *wanted to follow*, and a return at dusk because timing mattered. "Nothing fae in 8 days" can't recur |
| **Socialite** | Hears of the charm, takes a side, can explain the dispute through needs, evidence and promises |
| **Catalog kid** | A charm changes a packing decision (creel or lantern vs. iron) and is still worth carrying once its inconvenience is clear |
| **Exploit hunter** | Fails to mint flour or cents, resell the penny, farm virtue or duplicate a reserve |
| **Greenhorn** | Uses `look`, `signs` and `fae.use` without help, and can tell what they control |

Reports record whether the run produced a story worth retelling.

---

## 9. Second slice: learning fae magic [PROPOSAL]

**Scope:**
- **Learning:** the §4.3 grades, with lessons, experiments and hypotheses as testable beliefs; sources: a cunning-folk mentor, *The Long-Hidden Friend*, studied charms; 8 small and 2 greater workings, 2 new feats and the Hedge Dabbler rider.
- **Execution:** the Fae Courtesy check with a full DC Explain; misworking tables.
- **Costs:** the Tally per court with callings for services and gifts ("sold on" emits a bargain-offer event until the Prince exists); Drift storage with `06`'s gain rows; claim K from Thorn Tally.
- **NPCs:** practitioners at worldgen (~1 per 40 adults), "send for her" demand from misfortunes, `teach_working`.
- **Charm links:** *Wake the Virtue* and *Send It Home*.
- **Agency transfer:** `setAgency` complete; the Rush Bridle and *Borrow the Hands*; the `fae_compulsion_on_pc` flag; `struggle`; Fossegrim's String (`compel_activity`).
- **Escalation:** Visitations and Incursion complete; strings `toll`, `tithe`, `reclaim`; `confiscate` and `sue_replevin`.

**Acceptance:**
1. Each of the four peoples can learn the same small working under equivalent prerequisites. Costs differ only through declared fields (Drift bands) and circumstances.
2. A PC can learn Stop Blood from Loveday Trevenna within 4 game-weeks through relationship alone.
3. Every working roll Explains every DC term. The Tally shows in band words below Lore (Fae) 4 and exact at 4.
4. A failed hypothesis can be tested, refuted and corrected.
5. An NPC learns a working and later teaches it, with no player involvement.
6. **The braucher-first pattern is measured, not assumed.** Over 64 seeds × 1 year, practitioners appear among the top-3 attribution candidates in ≥ 30% of their settlement's uncanny misfortunes, and the true-culprit share is reported.
7. A called Tally can be paid. Refusing it creates a non-decaying fae grudge. A 10-favor Thorn debt produces the Debt-Origin invitation only with desperation present.
8. **Agency:**
   - a bridled NPC executes only its rider's commands and returns to `psyche` mode at dawn, iron or running water;
   - the ridden NPC's dream names the rider as spectral evidence;
   - with `capped`, the PC's bridling is disclosed, saves every 2 h and lasts ≤ 6 h;
   - with `off`, the bridle produces only thoughts.
9. Iron suppression, bearer weakness, congregation response and Pact liability remain separate systems. The conservation test extends to workings.
10. A charm dispute can produce a playable release journey with stable Commands.

**Playtest gate:** Roleplayer, Catalog kid, Exploit hunter, plus a **Witch-preview** persona who runs a dabbler into debt and sees the bill coming.

**Later:**
- the Director's N13 (with M7);
- the Night Market;
- the Prince's `gift_test`;
- Hall chests;
- the Still-Water Glass (needs a per-place full-moon record in fae state);
- Seed-Corn (needs harvest);
- rungs 4–6 interplay;
- witch charm-sowing and backlash (M8);
- Ballads.

---

## 10. Decisions for Ellie

> **[DECISION] 2026-10-11 (Ellie): all thirteen recommendations below are approved as written** ("that all sounds delicious, let's do it!"). Treat each *Rec* as decided; the alternatives are kept for the record.

1. **Conservation rule.** No fae effect creates kcal, cents or stacks; goods move from a named source, and soft goods are borrowed. *Rec: yes.* It's the theme, P8's integrity and the epilogue's best line.
2. **The check for fae workings:** Fae Courtesy, a new "Hedgecraft" skill, or Spellcraft? *Rec: Fae Courtesy*, with craft prerequisites per working. It already exists, it's CHA like fae casting, and "magic as manners" is the setting.
3. **The Tally:** a debt per court, in fae state now and on `04`'s Obligation ledger once court actors exist, or its own meter? *Rec: the ledger path.* No new currency, and the debt is socially legible.
4. **Witch recruitment by debt.** Is a sold-on Tally the main way NPCs, and a dabbling PC, meet the Debt Origin? *Rec: yes.* It makes `06` §5.1 simulated.
5. **Agency-changing effects on the PC.** `fae_compulsion_on_pc` = `off | capped | full`. *Rec: `capped` by default:* forfeit basis required, ≤ 6 h, a save every 2 h, full disclosure, `struggle` available. NPCs are always subject (P2). Attachment and allure never override a Command.
6. **Do stored charms work at FI 0?** *Rec: yes, definition by definition (`minimum_fi`).* Recharging stays place-bound, so charms carry Faerie into town, which is the point.
7. **Must every useful charm hide a harmful price?** *Rec: no.* Keep a share of fair bargains (Rain-Hem, the Mending Needle). Usefulness should survive identification, and cooperation is also a story.
8. **Charms thin their town** (the `aura` quirk: local FI +1 and thinning +2/day, with iron cancelling). *Rec: yes, capped.* It's the macro loop that makes a charm a town's problem.
9. **Director windfall:** N13 as a compound nudge on *pre-existing* reservoir charms only. *Rec: yes.* `05`'s no-creation prohibition holds.
10. **How disruptive by default:** one county charm thread every 6–8 weeks, one per settlement every 1–2 years, with severe escalation conditional on existing tensions. *Rec: yes as the starting tune.* Tune it after the slice 1 seed-spread data.
11. **The Cold Stair.** Its FI 3 contradicts "a refuge from fae". *Rec: set it to FI 1 with `algific`*, so it yields Ice signs only and is a real refuge on the map.
12. **Heavy strings.** River's Token (a death toll), Huldra's Comb (love glamour), the Rush Bridle (agency). *Rec: on by default behind World toggles*, with deaths off-screen and the comb under `06`'s seduction toggle (consistent with `06` Q42).
13. **Under the Counter.** May Gussie Pratt hold one secondhand charm at a time, with no charm ever stocked by type? *Rec: yes.*

---

## Appendix A. Synthesis notes

**Draft A** is Claude's; **Draft B** is Codex GPT-6 Astra's. Both agreed on the fundamentals: no ancestry gate, the narrative shape only, no primitivism, Woe as the sole currency, mound exclusion, `commanded` actors never acting autonomously, and items as belief subjects.

| Area | Taken from | Why / what was dropped |
|---|---|---|
| Ten-line summary, ground rules, conservation rule | **A** | B's "transport or transformation of ordinary food" (its Q4) is the same principle. A states it as a testable rule with a property test |
| "Fae charm" vs. `02` folk charm naming | **New** | Neither draft flagged the collision with `02` §10.3 |
| §2 agency classes, `AgencyState`, `set_agency`, PC flag | **New**, built on B's agency line and A's rule 7 | Both drafts only said the PC never acts without a Command. Ellie's "a glamour can put someone under command" needed a data shape, arbitration gating by urge tags, and a PC safety valve |
| Three kinds of sign; FI-3 "recognize danger without a check" | **B** | Cleaner than A's lookalike-only split |
| Omen frequency | **B**'s four windows and per-window table, with **A**'s per-mille keys | B's windows are LOD-safe and shared by witnesses, and A's per-place-hour rates were spammy. B's FI 1 rate (80) was halved: hearth signs at every farm every ~5 days was too much |
| Persistent signature; `look` never rerolls | **B** | Directly answers "places empty and undescribed" |
| Notice modifiers | Mostly **B**: iron suppresses the phenomenon, not the witness; Drift +1/+2/+3 capped; no child bonus | Dropped A's "Iron Blind" (double-counts iron, which already lowers FI) and A's child +4 (a hardcoded age rule; schedules already produce the effect). Kept A's animal +6 and second-hand animal omens |
| Read DCs | **B**'s 10/15/20; **A**'s attribution-shaped reading weights for NPCs | Complementary |
| Omen consequences | **A**'s table with **B**'s thought and anxiety numbers | B's 120/250/500 scale by severity beats A's flat 300 |
| Escalation | **A**'s thinning (0–1000, four stages, dynamic FI), with **B**'s guard that pressure never authorizes harm | B's 0–6 "site disturbance" covered only directed signs and had no tie to FI dynamics |
| Place descriptions and the P5 pull | **A**'s six-layer `describe()` and Signs & Wonders; **B**'s clue-opens-an-action example | — |
| Magic learning | **B**'s grades, lesson successes and hypotheses-as-beliefs | A had sources but no learning process. B's version is better P1/P2 |
| Magic execution and costs | **A**: Fae Courtesy check, DC terms, misworkings, the Tally per court, callings, witch-by-debt | B lacked a Faerie-side debt. The brief asked for "debts/strings to Faerie", so the Tally is the core cost. Misworkings are kept but **bounded** by tier and effect primitives, per B's "no arbitrary disasters" |
| Drift costs | **B**'s Drift on learning, plus **A**'s per-working carry and fae-longing | B's "protective customs cost nothing" kept |
| Feats | **A**'s Fair Dealing and Well-Spoken; **B**'s reuse of Hedge Dabbler | Dropped A's Small Courtesies as a separate feat; Hedge Dabbler gets a rider instead (fewer new feats) |
| Charm data model | **A**'s item + `charms` domain, virtue, quirks, claim graph, `boundTo`, `drawLedger`; **B**'s typed `effects[]`, `minimum_fi`, `study` facts, string transfer rules, reserves, suppression vs. damage | A had effects implied by fields; B's typed vocabulary is safer for data-over-code. "Virtue" (A) chosen over "charges" so "glamour" stays illusion |
| TRUE / BELIEVED | **A**'s claim graph on the existing mutation links; **B**'s three-store split and fact-by-fact study | — |
| Desire | **B**'s formula `D = (3U + A + L + E − 2R)/4`, trigger-only evaluation; **A**'s hungry ×3, cap 700, voices and urges | A's `allure × utility` ignored risk |
| Attachment | **B**'s accrual and decay with **A**'s 60/80 thresholds | The 80 refusal is limited to `psyche`-mode actors (agency) |
| Readiness | **B**'s verified-output vs. unverified-claims rows | Keeps P8 honest under rumor |
| Catalog | 17 from **A**, 3 from **B** (Rain-Hem, Mending Needle, Measure That Agrees), 1 new (Rush Bridle) | A's charms carry the disruption brief and settler folklore. B's were strong P8 utility but socially mild. B's best honest charms were kept so the catalog includes fair bargains (B's Q3). Dropped B's Sack with the Second Bottom (its `reserve` survives as an effect kind), Borrowed Coal (overlaps Spring-Kettle), Cellar Button (overlaps Creel) and Listening Saucer (overlaps Still-Water Glass). Dropped A's Knocker-adjacent duplicates. Fixed A's internal inconsistency on Butter-Print recharge |
| First-slice charms | Mix | A's eight hook into live systems; Rain-Hem replaces Briar Pin, since dreams aren't implemented |
| Arc stages, institutions table, claims table, resolutions, player verbs | **A** | The institutions table is the strongest answer to the framing constraint |
| Economy realism, loans as promises, factions as agreements, "no faked crash", shared custody | **B** | A's "flour fell to 3¢" relied on a price model that doesn't exist yet |
| Woe non-duplication | **B**; charm-sowing and backlash from **A** | — |
| Arrival vectors | **A**'s reservoir and rates, with the stray rate **corrected**; **B**'s "every arrival has a physical history" | A's 3‰ per night × 30 charms gave ~33 strays a year against its stated ~3. Now 6‰ on ~16 full-moon/festival nights ≈ 3 |
| Chronicle pattern | **A**'s facts and levels; **B**'s rule to keep facts after log rollover | Composes with existing patterns by thread id (new) |
| Schedule slot | **A** (after activity, before social) | B placed fae after social. Omen memories should be gossip-able the same hour, and occupancy is known after activity |
| Ownership, API, Explain discipline | Merged | B's fair-vs-full Explain separation and "failed eligibility costs no hour" added (triage #4) |
| `court` → `fae_court` tag rename | **New** | Lantern Spring and Dunleavy's Tavern share the tag `court` |
| Slice 1 | **A**'s scope trimmed (no confiscate, replevin or Visitations), **B**'s exclusions; acceptance merged (A's seed-spread numbers, B's fresh-seed gate, forecast/use parity, peaceful-lending fixture) | Added the agency-gating minimum because the triage showed the PC acting on its own |
| Slice 2 | Merged acceptance; agency transfer added | B's equal-prerequisites test across four peoples; A's braucher-first measurement |
| Decisions | A's Q1–Q6, Q10, Q12; B's Q1, Q3 and Q5 folded in; Q11 new | Dropped A's lookalike-ratio and mound questions: the ratio is now a tuning table, and mound exclusion is canon in `01` §2.1 |
