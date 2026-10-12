# 13: Fae Magic, Charms, and Omens

> **Synthesis draft, 2026-10-11; revised the same day after an adversarial review** (Codex GPT-6 Astra, 19 findings; Appendix A.2). This doc answers Ellie's 2026-10-11 decisions (`00`) on fae **omens** keyed to Fae intensity, **fae magic anyone can learn** at a cost, **fae charms that reach settlements and disrupt them**, and charms as **real P8 gear**. It also answers the playtest findings "Nothing fae in 8 days" and "`look` has no place description".
>
> Tags: **[DECISION]** comes from `00`, an ADR or Ellie (all thirteen §10 recommendations are approved) · **[PROPOSAL]** needs sign-off · **[AMENDMENT]** changes another doc's canon and needs a decision · **[OPEN]** is unresolved. Code names were checked against `packages/core/src` and `content/base` on 2026-10-11.

**This doc owns:** the omen catalog, episodes and per-place **thinning**; the fae layer of place descriptions; fae **workings** and the **Tally**; the `charms` domain, the executable **conservation rule**, draws and their discovery; what fae effects may ask of a will; arrival vectors; and the "The Charm at ‹town›" pattern.

**It doesn't own:** the base FI field, the courts and the Forfeit Rule (`01`); checks, skills, feats and folk charms (`02`); item fields, Readiness and the items API (`03`, module:provisions); beliefs, rumor, grudges and misfortunes (`04`, module:belief); object loans and other promises (module:social); the Director (`05`); Drift, Woe, the Tithe and curses (`06`); thoughts, arbitration, **agency mode and the authorization contract** (`10`, module:psyche; a parallel workstream is building it now); peoples (`12`).

---

## 0. The doc in twelve lines

1. **Omens are events, not flavor text.** Each has witnesses, an Explain and a consumer. An omen nothing reads doesn't ship.
2. **Every omen has a mundane lookalike** from the same roll. Town skeptics are usually right; coulee skeptics, less often.
3. **Omens thin a place**, through Signs → Portents → Visitations → Incursion.
4. **Places have a stable signature plus episodes**, fixed when their window opens. `look` never rerolls; dusk is when coming back pays off.
5. **Faerie makes nothing; it moves things.** A fae transfer never increases material or money across its named accounts; soft goods are borrowed against strings. A draw is *known* only when someone finds the shortfall.
6. **Fae magic is courtesy with a counterparty**, rolled on **Fae Courtesy** and paid on the **Tally**.
7. **The witch is a Tally that was bought**: `06`'s Debt Origin, simulated.
8. **A charm is an ordinary `03` item plus a `charm` record** holding the **TRUE** function. The **BELIEVED** function lives only in beliefs.
9. **Desire reads the believed function; harm reads the true one.** The gap is the story.
10. **The arc has no state machine.** One causal chain (benefit seen → utility believed → item-specific proposal → arbitration → validated transfer → promise → witnessed outcome) runs through ordinary systems; a sifter names what happened.
11. **Institutions answer competently, and sometimes it works.** Outcomes follow evidence, resources and commitments, not a script that makes them lose.
12. **The PC keeps high agency.** Every consequential act, by anyone, passes one authorization check (§2.2). Only an explicit, capped, disclosed agency-transfer effect acts through a will, on any actor's agency mode.

---

## 1. Ground rules [PROPOSAL]

1. **Sim first (P1).** Every omen, working and charm effect is an event with witnesses, an Explain with a `knowledge` level, and a consumer.
2. **Lookalikes everywhere.** Mundane signs come from the same roll as true ones (§3.3), and truth rides on the event as `truth: fae|mundane` at `omniscient`. This is `12` §7.2's tell model applied to the landscape: an epistemic problem, not a light show.
3. **Conservation [DECISION, Rec 1; executable form].** *A fae transfer cannot increase the total remaining material quantity or spendable money across its explicit source and destination accounts. Stack splitting is permitted.*
   - Material counts in each def's integer units (flour: 1 unit = 1 lb = 454 g); money in integer cents. A partly used top unit stays with the source, as `moveStack` already does; moved units keep their spoilage, wetness and condition.
   - One effect resolution is one transaction. The test compares Σ units per def and Σ cents over exactly the named accounts, before and after. Restocks, production, wages and consumption are outside it and accounted separately.
   - An effect moves what exists and what fits. A failed effect changes nothing.
   - Rest, warmth, luck and labor are borrowed, not material; strings say who repays. Fae food stays glamour (`fae_food`: kcal 0).
   - This is a new law, approved 2026-10-11, consistent with `03` §8.7 but not derived from it. Rec 1's "stacks" means quantity, not stack records.
4. **The narrative shape only.** One genuinely useful, genuinely strange object arrives, and a community's story becomes the object's story. No characters, scenes, framing or visual homage carry over from the source Ellie referenced. Nobody in Hollin County is naive about property, money, law or God; 1855 Wisconsin has *more* institutions to disrupt than most places (claim clubs, wildcat banks, replevin suits, a Haugean schism, benefit societies, the Deep Accord). The charm disrupts because it is **correctly understood as valuable and wrongly understood as free**. No people is its natural owner or victim, and arrivals are never weighted by people or culture (`05` §8.3).
5. **Settler folklore only (`01` §2.1):** Norwegian, German, Cornish, Irish, Yankee and lumber-camp lore. Real Indigenous sites are never used; rule 8 makes that executable.
6. **No new currency.** Woe stays the one fungible fae currency (`06`). Virtue is per item, like the oil in one lamp. The Tally is a debt. `02` §10.3's mortal **folk charm** is not a **fae charm**, and the UI says which.
7. **P2 and determinism.** NPCs notice, learn and covet by the PC's rules. One new RNG stream, `fae`; views use `hashString32`, never RNG; integer state, per-mille multipliers in a fixed order, rounded once.
8. **One protected-site check.** `isProtectedSite(place)` (module:content-world) runs first in every fae path: FI anchors, signatures, omens, recharge places, reservoirs, stray destinations, lead targets and the fae description layer.
   - A place is protected if it has any of `protected_site`, `mound`, `burial`, `rock_art`, `rockshelter`, `atrocity_site`, or mound-family worldgen geometry. **Protection beats every positive tag** (`protected` + `spring` is protected), and `effectiveFi` there is 0: "nothing fae happens there".
   - Validation and worldgen QA reject a protected place carrying `fae`, `fae_court`, `fae_barrow`, a signature, a seeded charm or a recharge role.
   - The only fae earthwork is the **fae barrow**: `fictional = true`, its own vocabulary, and a European long-barrow geometry family kept disjoint from mound forms.

### 1.1 Canon touchpoints

| Point | Treatment |
|---|---|
| **The River is not a court** (`01` §4.3) | This doc says **counterparty** for "a court or the River" (Tally, strings, returns) |
| **Forfeits** (`01` §4.5) | Fae compulsion needs one of `01`'s listed forfeits. This doc adds none |
| **Working DCs** | Iron and consecrated ground mirror `02` §10.4 exactly (§4.4) |
| **Object-mediated harm** [DECISION 2026-10-11, Ellie: **per-charm data**; AMENDMENT to `01` §4.5] | Each charm definition declares `harm_basis = "instrument" \| "fae"` for its effects on third parties.<br>• `instrument`: the effect is the **keeper's** act, as a witch's curse is (`01` §4.4: a human hand may harm humans), so the target needs no forfeit. Slice 1b's Never-Empty Sack draw and Rain-Hem's spilled rain use this.<br>• `fae`: the effect is fae harm and touches only people who have forfeited protection; otherwise it fizzles, disclosed in the Explain.<br>• A fae *actor* using any charm on a human always needs a forfeit.<br>The basis is shown on identification (P1) |
| **Effective FI** | One function, `fae.api.effectiveFi(world, place, t)`, in one order: base `Place.faeIntensity` → seasonal shift (`world.fae.fiShift`, §3.7) → `spring` +1 → calendar (§3.3) → `aura` → incursion, clamped to 0..5 once, and 0 at a protected site. Iron is a phenomenon multiplier and a DC term, never an FI term. Dreams, checks and omens all call it |

---

## 2. Agency

### 2.1 The rule [DECISION `00` 2026-10-11; PROPOSAL for the fae side]

The PC acts only on Commands plus standing orders (sleep, eat from its own stores, keep warm). Agency is an **agency mode** on the psyche (`commanded` / `psyche` / later `fits`), a sheet property any actor can have, and **never a branch on `controller`**.

| Class | Examples | On a `commanded` actor (default PC) | On a `psyche` actor |
|---|---|---|---|
| **A. Advisory** | Omen fear and longing; `charm_covet`, `charm_keep`, `charm_conscience`; Tally callings; dreams; Huldra's Comb | Thoughts and anxiety only. Overriding books anxiety, shown on the confirm line (`10` §5.5 (b)) | Normal arbitration |
| **B. Outcome-altering** | Lost minutes, turned paths, a draw emptying your bin, iron souring your charm | Changes the *result* of a commanded act, never the choice; disclosed before commitment where knowable | Same |
| **C. Compulsion** (`compel_activity`) | Fossegrim's String; a ring dance (F1) | ≤ 60 min, a Will save every 10 min, ends at iron or running water. Subject to the actor's `compulsion` policy | Same; policy `full` |
| **D. Agency transfer** (`set_agency`) | Rush Bridle; the Prince's bargains | `commanded` by a new **issuer** for a capped time. Subject to the `compulsion` policy | Commanded by the holder through the same Command path |

**Attachment is never a veto** (§5.6), and **strings never act for the PC**: a due string or calling is a Journal obligation with a deadline and a `duty` thought, and default consequences fall if it's ignored (§4.6).

### 2.2 The authorization contract [PROPOSAL; owned by module:psyche]

Filtering inside arbitration isn't enough: defenses replace the chosen urge afterward (`psyche/system.ts` step 5), social runs spontaneous encounters and stored displacement for every pooled actor (`social/system.ts`), and shopping spends through whichever member stands in the store (`provisions/economy.ts shoppingHour`). A parallel workstream is implementing agency mode now; fae relies on these properties, not on exact names:

```ts
type Issuer = { kind: 'player' } | { kind: 'actor'; id: ActorId };
type Basis = { kind: 'command'; issuer: Issuer } | { kind: 'standing'; capability: StandingId } | { kind: 'own' };
interface Act { kind: ActKind; targetId?: ActorId; itemId?: ItemId; cents?: number }
function authorizeAct(world: World, actorId: ActorId, act: Act, basis: Basis): { ok: true } | { ok: false; reason: string };

interface AgencyState {
  mode: 'commanded' | 'psyche' | 'fits';
  issuer: Issuer | null;
  standing: StandingId[];                    // granted beyond the defaults
  compulsion: 'off' | 'capped' | 'full';     // how classes C and D land on this actor
  until: GameMinute | null;
  source: { kind: 'charm' | 'working' | 'bargain'; id: string } | null;
  restore: Omit<AgencyState, 'restore'> | null;
}
```

1. **One gate, every executor.** Arbitration, defenses, chosen and spontaneous interactions, stored displacement, purchases, shopping, transfers and fae effects call `authorizeAct` before changing state. A refusal is named in the Explain and costs no time.
2. **Default-deny.** Every act is consequential unless it is a standing capability. The defaults are data (`content/base/psyche/standing.toml`: `sleep`, `eat_own_stores`, `drink`, `keep_warm`, `go_home`, `shelter`); a player may grant more (`buy_staples ≤ 50¢ a week`, `tie_the_sack_nightly`). An untagged act is denied.
3. **Mode decides `own`:** `psyche` authorizes it; `commanded` never does.
4. **The issuer travels with the Command** (`Command.issuer?`, foundation, additive; the harness sets `player`), so a rider issues through the same path.
5. **Requests to a commanded actor wait.** A neighbor's `beg_loan` becomes a pending request the issuer answers by Command within the hour (24 h if delivered); unanswered, it lapses as "no answer", never a silent yes.
6. **Defaults are actor data.** The played actor starts `commanded`, issuer `player`, `compulsion` from the World setting `fae_compulsion_on_pc` (default `capped`, Rec 5); others start `psyche`, `full`. Rules never read who controls an actor. Mode, basis and issuer appear in the Explain at `self`.

**Tests fae needs from the contract:** a commanded actor idle for 30 days spends, gifts, attacks and displaces nothing; a loan request to it lapses or is answered by Command; it shops only by Command or standing order; its defenses book anxiety but no act.

### 2.3 Agency transfer [PROPOSAL; slice 4]

`fae` changes agency only through `psyche/api` (`setAgency`, `agencyOf`). An NPC rider proposes errands for its mount from data through `proposeRiderUrges`. Iron, running water, a church bell in earshot, dawn or the cap break it; `restore` applies and `fae.agency_restored` fires. The ridden wake Fatigued, with an `uncanny` memory and a dream showing the rider's face as spectral evidence (`10` §9.1); hag-riding accusations follow, and sometimes they're right. Under `capped`, it needs a `01` forfeit, lasts ≤ 6 h, saves at onset and every 2 h, and is disclosed full-screen ("You are bridled. Rider: unknown. Ends at dawn, at running water, or at iron."); the player's one Command is `struggle` (a save at +2, 1 h of fatigue). `off` turns classes C and D into class A.

---

## 3. Omens and signs (A)

### 3.1 Three kinds of sign [PROPOSAL]

| Kind | Example | Truth |
|---|---|---|
| **Lookalike** | Fox fire; summer frost on an algific slope; a cow balking at mud | Mundane, but can still become a supernatural rumor |
| **Ambient** | A reflection keeps drinking after the cow lifts its head; bells on a prairie nobody grazes | A real anomaly with no hostile act behind it |
| **Directed** | Wet footprints at a locked pantry after a missed offering; a charm's `sings` quirk | An actor, obligation, working or charm caused it |

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
thins = 15
prop = { pred = "fae_abroad", args = ["place"] }
thought = { drive = "fear", base = 250, alt = { drive = "longing", if_drift_min = 20 } }
leads_to = { nothing = 600, trace = 200, fae_site = 150, stray_charm = 50 }  # one draw per episode (§3.9)
text = "Lights in the bottoms, low, keeping pace with nothing."
```

### 3.2 Taxonomy by Fae intensity [PROPOSAL]

FI means `effectiveFi`. The table lists eligible families, not a sequence.

| FI | Register | True signs (examples) | Lookalikes |
|---|---|---|---|
| **0** | **Providence signs only** | A bird in the house, a picture falls, the death-watch beetle; the pious read `portent(actor)` | All of them |
| **1** | **Hearth signs** | Milk turns at the door; tools moved overnight; a plait in the horse's mane; the porridge bowl licked clean | Heat, rats, children, a hired girl |
| **2** | **A second reading** | Lights in the bottoms; an echo that answers before the call ends; tracks that stop at a spring | Fox fire, a lantern, deer, wind in reeds |
| **3** | **Rules visibly differ** | Cattle bells without cattle; a path that returns to its own fresh prints; fiddle music under the slope | Echoes, a neighbor's fiddle, fatigue |
| **4** | **Another jurisdiction** | Watch and sun disagree by 10–40 min; the coulee branches where the plat says it doesn't; a voice uses an unspoken name | A stopped watch, bad maps, drink |
| **5** | **Terms govern the place** | A spring reflects the Court's sky; a threshold admits invited guests only; being *seen* | None worth rolling |

- **At FI ≥ 3 a visitor recognizes danger without a check.** Identification explains *which* danger and *what answers it*.
- **Ice signs** (on `algific` slopes, near erratics, at iron-shod survey corners): summer frost, a granite boulder that wasn't there yesterday, birds gone silent, a feeling of being *sorted*. They **lower** thinning. Who reads them as comfort follows from norms, beliefs and needs (a Hall catechism that prizes order, a surveyor's trade, a frightened settler's want of security); fae dread them by Law. **The Cold Stair yields only Ice signs** (Rec 11).

### 3.3 Episodes: identity, keying and rates [PROPOSAL]

**Windows.** Each place has four a day: dawn (sunrise ±60 min), noon, dusk (sunset −60 to +35 min; 90 min earlier in coulee bottoms, `05` §4.2) and midnight. A window has at most one episode, shared by every witness, lasting 1–6 h or leaving a trace for 1–3 days.

**Identity and keying.** `ctx.rng` is bound to the current hour (`sim/sim.ts makeContext`), so a roll made at dusk and the same roll made on a later arrival would differ. Therefore:
- An episode is identified by (place, dayIndex, window); its **canonical time** is the window's start minute.
- **Eager resolution:** in the hour a window opens, fae resolves it for every eligible place (FI ≥ 1, a fae-relevant tag, or an occupied home for Providence signs), ~160 rolls a day at Iron Ford.
- **Snapshot:** rates read the effective FI, iron band, weather, moon, calendar slot and bells at that moment. Episodes persist in `world.fae.episodes` (family, truth, strength, end, trace expiry, lead, observers) until the trace expires.
- **Keying:** `ctx.rngAt('fae', canonicalTime, mixKey(place, day, window, SALT_OMEN))`, a foundation-approved additive; the pure `rng(seed, stream, tick, key)` already supports it, as `planReadiness` shows.
- **Observers:** one notice roll per actor per episode, keyed `mixKey(episodeId, actorId)` at canonical time, the first hour they're present. Attempts persist, so lateness, arrival order and save/load can't roll twice. A future T2 catch-up reads stored snapshots, never current values.

**The roll is categorical.** One d1000 per window: `[0, pTrue)` true, `[pTrue, pTrue + pLook)` lookalike, otherwise nothing. If keyed pTrue + pLook exceeds 950, both scale down proportionally, rounded once. The family is then picked by weight.

**Base chance at dusk (‰).** Dawn ×700‰, midnight ×600‰, noon ×150‰.

| FI | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|---:|
| True | 0 | 40 | 180 | 350 | 600 | 850 |
| Lookalike | 60 | 160 | 120 | 60 | 40 | 0 |

**Keys**, in this fixed order, each a ‰ multiplier: **moon** (full ×2000 for lights, music, processions; new ×1500 for voices, the Hunt, lost minutes); **calendar** (Walpurgisnacht and Sankthans +1 effective FI, All Hallows +2, the Hunt from Yule to Twelfth Night; through `effectiveFi` only); **Sabbath bells** (×0 *within actual bell range while ringing*, 06:00–13:00; Sunday evening ×1500, "they come back hungry"); **season** (winter ×600 but family tier +1, "rarer but deeper"); **weather** (valley fog ×3000, first snow ×1500, thunderstorm ×200); **tags** (§3.4); **iron** (Iron Presence ≥ 5 lb ×200 for subtle families: iron suppresses the *phenomenon*, not the witness).

**Persistent signature.** Every non-protected FI ≥ 2 place gets one at worldgen (the spring's wrong reflection, the bluff's answering echo). It never rerolls and gives texture between episodes.

### 3.4 Terrain features [PROPOSAL]

Standardize place `tags`, and **rename the fae-seat tag `court` to `fae_court`** (Dunleavy's Tavern uses `court` for the JP).

| Tag | Families favored |
|---|---|
| `spring` | Independent reflections, submerged lights, voices through a vessel; ×2000 and local FI +1 |
| `cave` / `mine` | Answering taps, lamp shadows without bodies, cold breath; Accord breaches (F7) |
| `sinkhole` | Grass flattened outward; objects returned clean |
| `bluff` / `goat_prairie` | Bells above the ledge; a procession seen only from below |
| `old_growth` | Leaves moving against the wind; a tree that's always ahead |
| `creek` / `ford` | **Signs stop at running water**, a legible rule (`01` §4.5) |
| `fae_barrow` | Frost outlining a door; lamps under turf (`fictional = true` only) |
| `farm` / `home` | The hearth family; missed tribute raises it |
| `algific` | Ice signs only |
| `church` | ×0 |

### 3.5 Who notices, and how they read it [PROPOSAL]

Two rolls, each with an Explain at `self`.

**Notice:** d20 + WIS + Perception vs. the omen's DC, plus `02` §3.3 light and weather. Drift +1/+2/+3 at 20/40/60; Second Sight +5 and the FI overlay; `see_the_seam` +4 vs. glamours; `deep_sense` +2 for rock, air and water. Once animals are actors (slice 2) they notice at +6, and their balking is a second-hand sign: a frightened cow is evidence of a frightened cow, not of witchcraft. Children get no bonus; their schedules put them at the spring at dawn. Faith changes the reading, not the noticing. At most 6 present actors outdoors at the place are sampled, by ascending `mixKey(episodeId, actorId)`, so order doesn't matter.

**Read:** Lore (Fae) DC 10 names the family, 15 a countermeasure, 20 a court's signature. Lore (Nature), Woodcraft or a Trade at the `plain` DC names a lookalike as mundane. Success yields an Observation at strength 100 ("That was fox fire."). Failure leaves honest uncertainty and never fabricates a fact:

```
Omen: lights in the bottoms (River Bottoms, 21:40, fog)
  Notice  Perception +3, d20 13 = 16 vs DC 12 + moonlight 0 = 12 → noticed
  Read    Lore (Fae) +0, d20 7 = 7 vs 10 → you can't say what they were
  Truth   [not known to you]
```

**What NPCs conclude** follows `04` §5.4's attribution shape (the leader needs ≥ 350‰ and a 1.5× lead): `fae_abroad(place)` weighs 100 + 40·Superstition + 10·Lore (Fae) + Drift/2 (plus a fitting Figure's notoriety); `natural_sign` weighs max(20, 100 + 10·Lore (Nature) − 30·Superstition), +40 for a self-sourced `honesty` ≥ 60; `portent(actor)` weighs 50 + piety, at FI ≤ 1. Culture enters only through norms and skills: a Hall-raised reader's catechism ("Ring the bell") proposes a hand-bell urge that lowers thinning by 20.

### 3.6 What an omen does [PROPOSAL]

| Output | Lands in | Numbers |
|---|---|---|
| **Memory** | New kind `omen` (fear or awe) | Intensity = strength; consolidates ("lights in the bottoms, three times this spring") |
| **Thought** | `proposeFaeUrges` hook | `longing` 120; threat `fear` 250 and anxiety +10 once per episode; Visitation 400; Incursion 500 and +30. `piety` for the pious (*The Pastor: "Look away and pray."*). Urges: avoid, go look, ward the house, tell someone. No hourly anxiety for merely being somewhere eerie |
| **Belief** | `observe()` | Evidence on `fae_abroad(place)`: supernatural, juiciness 45, `exaggerates_to = "court_at"`. Prevalence ≥ 600‰ makes it "everyone knows" |
| **Rumor** | `transmit` | Supernaturalization and specification move "lights" toward a Figure |
| **Demand** | Provisions | Ward urges buy nails, horseshoes and rowan through `authorizeAct`: a real sale, not a price bump |
| **Attribution** | `attributeMisfortunes` | With `fae_abroad` ≥ 50 within one hop and 7 days of a misfortune: Natural −20 per omen witnessed, Figure +20. A matched `portent` is *Prophecy fulfilled* (`05` §9.2) |
| **Children** | Activity | At FI ≥ 3 near home, a `longing` urge to follow the lights; acting on it brings an Absence trace and a search party (behind `06`'s child-harm toggles) |
| **Chronicle** | Journal, Almanac, Paper | One Journal entry per PC-noticed family per day. A weekly Almanac digest ("April 9. Fog held at Lantern Spring after the ridge had cleared. Two carriers reported bells under the water."). Paper only with ≥ 3 witnesses |

Livestock effects (a cow off milk, a horse refusing the ford) wait for animal behavior (slice 2). **T2** settlements get a weekly aggregate that seeds `fae_abroad` Commons drift plus one rumor from a census witness.

### 3.7 Thinning [PROPOSAL]

`world.fae.thinning[place]` runs 0–1000. An empty coulee doesn't thin: the uncanny needs a witness (`01` §4.2).
- **Rises:** a witnessed true episode (+`thins`, 5–25); an `aura` charm there (+2/day); workings (+5 × tier); `fae_abroad(place)` prevalence ≥ 400‰ nearby (+10/day); a refused calling (+100).
- **Falls:** −floor(thinning × 30 / 1000) a day; Ice signs; a bell rung in range (−30); iron set or a corner run (−50); a printed debunking or successful ridicule (−20).

| Thinning | Stage | Newly eligible |
|---|---|---|
| 0–299 | **Signs** | §3.3 rates |
| 300–599 | **Portents** | Families from FI + 1; **lost minutes** (a lone actor at dusk loses 5–30 min; an iron-cased watch shows it); **turned paths** (+1 h, or Wayfinding DC 12 + 2·FI). Both need a sub-hour time policy (slice 2) |
| 600–849 | **Visitations** | **Voices** call an actor's `known_as` (Will DC 12, or a class-A `longing` urge). Lydia Pratt hears her name in Tobias Vik's voice. Fae seen plainly at the field edge |
| 850–1000 | **Incursion** | Effective FI +1 for 3 days; F-incidents; region edges reroute. Then thinning resets to 500 ("the land exhales") |

Thinning makes manifestations *eligible* and **never authorizes harm**, which still needs a `01` forfeit. Lost time follows `01` §4.5's ratios and cap, shown as "time out of joint" before the player lingers. Three incursions in a season add +1 to `fiShift`; a quiet season with iron or survey work subtracts 1. The Director may tilt rolls within ±1σ (N1) and never authors an omen.

### 3.8 Place descriptions [PROPOSAL]

The runtime `Place` already carries `tags` and `faeIntensity` but not `description`. Authored places read it from content by `defId`; generated places get an additive `Place.description`. `describe(world, placeId, perspective)` is a pure view in six layers:
1. **Base:** authored, or generated from kind × tags × FI; keyed by place alone, so it never changes.
2. **Season, weather, light**, picked by `hashString32(place, day, layer)`.
3. **People and use:** who is here, what they're doing, visible Traces.
4. **Fae:** the signature plus any live episode, skill-gated (Woodcraft sees the detail; Lore (Fae) ≥ 2 or Second Sight sees what it is). Empty at a protected site.
5. **Residue:** omens this PC noticed or heard of here in the last 7 days, from the PC's own beliefs.
6. **Counter-layer:** iron, bells, survey posts, Ice.

```toml
[[describe]]
id = "goat_prairie_bells"
layer = "fae"
tags_any = ["goat_prairie"]
fi = { min = 2, max = 4 }
hours = { from = 18, to = 22 }
text = "A cow-bell somewhere upslope, though nobody grazes stock up here."
reads = [{ skill = "lore_fae", min = 2, text = "Cow-bells at dusk on a prairie nobody grazes: huldre cattle. Don't follow them." }]
```

> *Huldra's Shelf, May dusk, Lore (Fae) 0:* Goat prairie, steep to the southwest, bluestem and pasqueflower between the ledges. Survey stakes run across it. The coulee below is already blue. A cow-bell somewhere upslope, though nobody grazes stock up here. Two nights ago you saw lights here and could not say what they were. The new section post is iron-shod; the bells keep away from it.

Designer-facing text never leaks into fair views. "The Prince's court is held here" is `omniscient`.

### 3.9 The pull: investigation and leads (P5) [PROPOSAL]

**`investigate {signId}`** is the one investigation verb. The Journal's "follow it", "test the latch" and "return at dusk" all map to it at the right place and time.
- **Eligible** while the episode runs or its trace lasts, at its place or its lead's place, for an actor who noticed or heard of it. An ineligible attempt says why and costs nothing.
- **One lead per episode**, drawn once when the episode resolves, keyed by the episode. Categories with no existing referent (no trace, no fae site or actor in reach, no reservoir charm in reach) are excluded first. Leads point at existing things and never create them.
- **One cached attempt per actor per episode.** A Woodcraft, Lore (Fae) or Perception check decides whether *that actor* finds the lead. Returning, asking again or rotating the party can't redraw it. An attempt takes 30–60 min.

**Signs & Wonders.** Each omen the PC notices and can't explain becomes an **open question** (headless `signs`). It closes only on *new* evidence gathered after it opened (an investigation, a read, a correctly read recurrence, testimony) that leaves the PC's reading belief ≥ 70 or ≤ 30; a belief that merely starts low closes nothing. The map marks open signs, and the Director treats one as a Chekhov gun (`05` §8.6).

> *"The bells stop when the springhouse latch closes. Marta says her father heard them before the May market. You could ask her, test the latch, or return at dusk."*

**Signs lead somewhere:** nothing, a trace, a fae site or actor, or (rarely, and only if one exists in reach) a **stray charm** (§6.3). Omens are the front door of the charm system.

**Targets:** an explorer at FI 2–3 notices ~1 episode a day plus signatures; a town resident gets 1–3 a week, mostly as rumor; every start has an FI 2–3 place within a day's walk. **Spam guard:** same-family cooldowns of 24 h per place, 6 h per actor and 7 days per text variant; ≤ 1 ambient-only interrupt a day; `fae.omen` < 2% of a year log.

---

## 4. Fae magic anyone can learn (B; slice 3)

### 4.1 Three routes, one catalog [PROPOSAL]

**[DECISION]** No ancestry gate. **[PROPOSAL]** No caster class needed for small workings.

| | Folk craft (`02` §10.3) | **Fae working** | Fae caster (Fae-Touched, Witch) |
|---|---|---|---|
| What it is | A mortal binds an effect into a folk charm | A mortal *asks*, and the land answers | A marked nature, or the Pact |
| Check | Craft/Herbalism DC 10 + 2 × level | **Fae Courtesy** vs. Working DC | Spell points (`02` §10.4) |
| Price | Ingredients | **Tally** + Drift | Spell points + Drift; Woe and the Tithe |
| Ceiling | Cantrip and 1st level | Greater workings rare; misworkings | Full catalog; curses |

Every **Fa**-tagged spell in `02` §10.5 is also a working at tier = level. For a mortal, fae magic is **etiquette the land answers**, and a working may list a craft prerequisite (Stop Blood needs Medicine 1).

### 4.2 Sources and teachers [PROPOSAL]

Access runs through relationship and culture, never people; a human can teach goblin mining courtesies.

| Source | Teaches | Gate | Cost / strings |
|---|---|---|---|
| **Cunning folk** (braucher, pellar, *klok kone*) | Healing, finding, warding, milk-luck | Trust ≥ 40 | 25–75¢ a lesson, labor or favor; your name joins hers in town talk |
| **A dissenting elf** | Names, thresholds, unbinding | Affection ≥ 50 | The teacher breaks the Hall Catechism: moral anxiety, discipline if seen |
| **An Accord-speaker** | Knock-reading, warnings | Pare or Club membership | A student's breach hits the whole pare's standing |
| **Books** (*The Long-Hidden Friend*, a *svartebok*) | Small and middling | Literacy; 35¢–$3 | `fidelity` 50–90%: miscopies miswork more |
| **A studied fae charm** | The working it embodies | The holder's permission | Spellcraft DC 15 + 3·tier, 1 virtue a day; +1 Tally |
| **A bargain** | Any tier, in one night | The right place | `06`'s +2–10 Drift, Tally +5, a named price |
| **A dream** | One working | Drift ≥ 20 | Consent given awake (`06` §3.3); Drift +1 |

### 4.3 Learning [PROPOSAL]

| Grade | Prerequisite | Exercises |
|---|---|---|
| **Knack** (tier 0) | Instruction | 2, DC 10 |
| **Small** (1) | Fae Courtesy 1 and Hedge Dabbler (with the §4.9 rider) | 3, DC 12, ≤ 1 a day |
| **Middling** (2–3) | Fae Courtesy 4, Lore (Fae) 2, Fair Dealing | 5, DC 16–18, with a teacher or adequate text |
| **Greater** (4–5) | Fae Courtesy 8, Well-Spoken, or a fae-caster class | Authored, DC 22–30 |

- **Exercises are authored and distinct**; each success counts once. A 2-h lesson works the next unfinished exercise, so one teacher and one text never stall a learner. The check is d20 + INT + Lore (Fae), +2 with a teacher.
- **Anti-grinding covers self-experiments only:** repeating one under unchanged conditions gives nothing new. No take-20 when experiments cost supplies or risk backlash.
- **Fail by 5+:** a mistaken hypothesis, stored as a testable belief `works(working, condition)`. Recipe, belief and ability are separate records.
- **Relationship supplies instruction, not prerequisites. Bargains teach but don't qualify:** they complete the exercises, and execution still needs the prerequisites unless the bargain's terms grant that boon.
- **Specialists stay valuable.** A farmer gets one useful working, not a specialist's daily output.

### 4.4 Working the check [PROPOSAL]

| Tier | Base DC | Time | Tally (favors) | Drift | Sign left |
|---|---|---|---|---|---|
| 0 | 10 | 3 s | 0 | 0 | 25%: lookalike-strength |
| 1 | 14 | 1 min | 1 | +20 centi-Drift | Strength 20, 3 days |
| 2–3 | 18 / 22 | 10 min | 2 / 3 | +1 | 40, 6–9 days |
| 4–5 | 26 / 30 | 1 h to a night | 5 / 8 + a named price | +2 / +4 | 70, 12–15 days |

`Working DC = base − (FI − 2) + iron + timing + offering`, rolled as d20 + CHA + Fae Courtesy + Lore (Fae) synergy, every term in the Explain at `participants`.
- **Iron:** +2 within 10 ft of Iron Presence ≥ 5, as `02` §10.4. **Consecrated ground:** Will DC 15 + tier or the working fizzles (`02` §10.4); the sign still lands.
- **Timing** −2 when the key holds (dusk, full moon, spring water, a threshold); **offering** −2 for a gift with meaning.
- Take-10 for tiers 0–1 with no threat; never Work It Through (each failure adds +1 Tally: asking twenty times is rude).
- **Beat by 10+:** Tally halved, rounding up. **Fail by 5+:** an authored, tier-bounded misworking built from `02` §10.6 primitives, and the Tally doubles. **Misworkings make innocent dabblers real thieves:** Milk-Luck misworked dries the *neighbor's* cow, and the neighbor's accusation is correct.

### 4.5 Costs [PROPOSAL]

- **Tally:** integer favors owed to the counterparty whose ground it was: Hearth (farms and mills), Thorn (the Prince's; coulee heads), Under (below ground), Alder (alder bottoms, fog, nurseries) or the River (running water).
- **Drift:** +1 on first learning a small working, +2 for a greater one, plus the carry in §4.4. Protective customs (a horseshoe, a nail in the threshold) cost nothing. Each working lowers fae-longing by 20 × tier: **practice makes you want more practice**.
- **Claim:** unpaid Thorn Tally adds K += min(20, 5 × floor(owed / 3)) to `06` §3.8.1's claim.
- **Suspicion:** witnesses observe `keeps_charms(actor)` (→ `deals_with_fae` → `witch`) at 20 + 20·tier, making a practitioner the natural suspect: `01` §5.3's braucher-first pattern as arithmetic.
- **Psyche:** Superego voices against (`piety`, the Hall Catechism) and for (a pare's courtesies); Persona strain for condemning in public what one practices in private.

### 4.6 The Tally [PROPOSAL]

| Counterparty | Hearth | Under | Thorn | Alder | River |
|---|---|---|---|---|---|
| Patience | 30 days | 60 days | one moon | 7 days | the next crossing |
| Threshold | 3 | 5 | 3 | 2 | 1 |

**Callings are records.** Crossing either limit fires `fae.tally_called` and creates one calling: id, counterparty, **covered principal** (favors owed and not covered by an open calling), deadline, and state `open → paid | defaulted`. Default is one transition that fires once.

| Principal | Calling |
|---|---|
| 1–2 | **A service** (milk at the spring for a week; a tune at the crossroads), as a `duty` thought "from the Good Neighbors" |
| 3–5 | **A gift with meaning** (`03` §8.7): a storied object, a memory, a season's taste of salt |
| 6–9 | **A bargain offered** (F6) |
| 10+ | **Sold on** to the Prince (§4.7). The sale **transfers** the principal and zeroes it at the seller |

- **Default:** a never-decaying Affront; uncanny weight on the debtor's misfortunes; thinning +100 at the counterparty's place; the next calling is one row worse.
- **Paying early.** Each court's data values offering kinds (bread, milk, a song, labor, a storied object by provenance). A repeat of the same kind to the same counterparty within a season is worth half, then nothing; acceptance is recorded per (debtor, counterparty, kind, season). At most one favor a week clears this way, two for a storied object. This closes the loop of paying for *Wake the Virtue* with songs.
- **Legibility:** band words ("you owe something" / "a good deal" / "too much") until Lore (Fae) 4 or Second Sight; exact for a witch.
- **Storage:** `world.fae.tally[actor][counterparty]`, migrating to `04`'s Obligation ledger once court actors exist (Rec 3).

### 4.7 The conscripted extreme [PROPOSAL]

The Tally makes `06` §5.1's **Debt Origin** simulated (Rec 4): at 10+ favors the debt is sold to the Prince; if the debtor's mind holds desperation (`fear` or `hunger` dominant, or a pantry below its horizon) a dream invitation follows; consent must be given awake, at a threshold, in words (`06` §3.3). A PC can walk in with open eyes; the bill is never a surprise. A dabbler gets no Pact, Hold, Woe or Tithe. A bound witch pays hedge workings in Woe, 1 per favor. **Gussie Pratt is the canon dabbler:** she bought fairy gold (`01` §8.3), so her Hearth Tally is seeded.

### 4.8 Knowledge and NPCs [PROPOSAL]

- **Gating (P1):** the worker sees every DC term; others know rumored workings ("Loveday Trevenna can stop blood"); a misworking's victim stays `omniscient` until discovered; Spellcraft, Lore (Fae) or Unwitching finds signs at a place.
- **NPCs (P2):** about 1 practitioner per 40 adults (Loveday Trevenna is a pellar). A household with a misfortune proposes "send for the cunning woman", and she gets income, standing and suspicion from the same events. `teach_working` (Trust ≥ 40, 2–8 weeks) spreads hedge-craft along friendships and kin.

### 4.9 Starter workings and feats [PROPOSAL]

| Working | Tier | Effect | Misworking |
|---|---|---|---|
| **Turn the Path** | 0 | Breaks pixie-led: a Wayfinding reroll | Turns your companion's path instead |
| **Stop Blood** | 1 | Staunch (`02` §10.5) | The worker's nose bleeds |
| **Milk-Luck** | 1 | Ends a *fae-caused* `cows_dried` | Draws the milk from the nearest neighbor's cow |
| **Hearth-Blessing** | 1 | Household +2 vs. curses for a week | The nisse is insulted |
| **Knocker's Courtesy** | 1 | Collapse and bad-air warnings for a shift | The knockers knock for someone else |
| **Dusk-Sight** | 1 | One hour: read the truth of dusk omens | You read every lookalike as fae |
| **Bread on the Water** | 2 | Find a lost thing or a drowned body within a mile | Finds *something else*: a stray charm, if one exists |
| **Ask the Spring** | 2 | One sincere, hedged answer from a spring's tenant | The tenant asks one back (+2 Tally) |
| **Wake the Virtue** | 2 | +1 virtue outside the recharge condition | The charm wakes, and so does its court |
| **Send It Home** | 3 | Returns a charm to its counterparty from afar | It comes back with a second reservoir charm |
| **Borrow the Hands** | 4 | `set_agency` on a sleeper who accepted your gift, ≤ 4 h | You are ridden instead |

**Feats for `02`:** **Hedge Dabbler** may take 1 knack + 1 small working instead of its 2 folk cantrips. **Fair Dealing** ◆ (Fae Courtesy 4, Lore (Fae) 2): middling workings and an exact Tally. **Well-Spoken in the Hollow** (Fae Courtesy 8, a calling paid in full): −2 Working DC; beating it by 5+ halves the Tally, rounding up.

---

## 5. Fae charms as items (C)

### 5.1 Data model [PROPOSAL]

A fae charm is an ordinary item in the existing `fae` section (`stackable = false`, P8 fields, `container` capacity if it holds things, and `truth`). Its fae behavior lives in a `charms` domain owned by `module:fae`, keyed by item id.

```toml
# content/base/items/fae.toml  (module:content-items)
[[item]]
id = "never_empty_sack"
name = "Flour sack, moonsilk ticking"
section = "fae"
truth = "Tops itself up with flour at dawn from the nearest unwarded flour store within three miles."
weight_g = 227
stackable = false
container = { capacity_g = 11340, capacity_bulk = 15.0 }   # 25 lb of flour

# content/base/fae/charms/hearth.toml  (module:fae)
[[charm]]
item = "never_empty_sack"
court = "hearth"
tier = 2
minimum_fi = 0                                            # Rec 6
virtue = { max = 7, start = 4 }
activation = { kind = "tied_overnight", dark = true }
recharge = [{ kind = "offering", items = [{ def = "cornmeal", qty = 1 }, { def = "butter", qty = 1 }],
              where = "keeper_hearth", amount = 7, cooldown_minutes = 10080 }]
effects = [{ kind = "draw", defs = ["flour"], qty = 10, at = "dawn", virtue = 1, radius_mi = 3,
             from = ["store", "mill", "club_pantry", "household"], trace = "flour_on_the_sill" }]
iron = { contact = "suppress", nearby_g = 908, sour_per_day = 2 }
quirks = ["unthanked"]
allure = 70
claims = [
  { id = "feeds",        group = "output", text = "{0} keeps a family in bread",            weight = 40 },
  { id = "never_empty",  group = "output", text = "{0} never comes up empty",               weight = 60, from = "feeds",        route = "exaggerates" },
  { id = "from_nothing", group = "output", text = "{0} makes flour out of nothing",         weight = 80, from = "never_empty",  route = "exaggerates" },
  { id = "gold",         group = "output", text = "{0} fills with gold for the right hand", weight = 95, from = "from_nothing", route = "exaggerates" },
  { id = "devils",       group = "nature", text = "{0} is the Devil's own sack",            weight = 50, from = "from_nothing", route = "supernaturalizes" },
  { id = "steals",       group = "nature", text = "{0} steals flour",                       weight = 30, route = "truth" },
]
```

Draws name defs, not tags: `flour` has no `flour` tag. **Per-instance state** is `world.fae.charms[itemId]`: `virtue`, `boundTo` (whom it chose; `omniscient`), `tiedSince`, `lastUseAt`, `lastRechargeAt`, `rechargeBlockedUntil`, `stringIds`, and `drawLedger` (units moved per source household, the truth for the epilogue). The stack, its place and its condition stay with module:provisions.

Effects are typed records, never executable strings: `draw` and `container_dry` in slice 1b; `reserve`, `spoilage_mult`, `boil_water`, `light`, `path_guard`, `emit_omen` in slice 2; later `cash_return`, `rest_mult`, `compel_activity`, `set_agency`, `forecast`, `scry`. **Every shipping charm specifies** capacity, activation, operation, charge debit, duration, recharge, expiry, iron and non-destructive failure (§5.8).

### 5.2 Draws and discovery [PROPOSAL]

Calling `reportMisfortune` at each dawn would be wrong twice: it would give every member of the source household certain knowledge of a loss nobody noticed, and `pantry_theft` adds 50 misfortune pressure, 120 anxiety and −200 security per report. A draw is physical at once and known later.

**The draw**, in the dawn hour (fae runs before provisions, so breakfast sees the flour):
1. **Conditions:** tied overnight in the dark and not opened; virtue ≥ 1; no iron suppression; recharge not blocked. Tying is the *use*: fae proposes it to an NPC keeper as an ordinary evening urge (`thrift`, `hunger`), and a commanded keeper ties only by Command or the standing order `tie_the_sack_nightly`.
2. **Source:** the nearest eligible stack of a listed def by place distance (ties by place id, then stack id): inside the radius, not in an `iron_lined` container, and under 2 lb of Iron Presence at its container or bin (`ironPresenceG`, module:provisions). One source per dawn.
3. **Quantity:** min(10, room in the sack, units there). Zero moves nothing and spends no virtue; the empty sack at dawn is evidence.
4. **Transaction:** `moveStack` moves whole units under the conservation test. One `omniscient` `fae.charm_drew` per charm per day names the source. `drawLedger` and the source's **draw case** update. Nothing else is written.

**A draw case** is fae's private record of a discrepancy, one per (charm, source household, def): `undiscovered` and `discovered` units, first and last draw, `misfortuneId`, `lastEvidenceAt`, and `accepted`.

**Discovery** comes from other people's ordinary acts, which call `fae.api.checkShortfall(world, ctx, householdId, trigger)`: a **stock count** (an activity tagged `stocktake`, weekly for store and mill keepers, or by Command), a **shortage** (a meal, sale or purchase finding a listed def at zero or below a day's need while a case is open), or a witnessed **trace**. The check is Perception or the relevant Trade vs. DC 15 − 2 per 10% of stock missing (minimum 5).
- **First discovery** reports one misfortune of a new, milder kind, `stock_short` ("the flour came up short"; proposed to module:belief), linked to the case. `Misfortune.causeItemId?` lets the epilogue say "the sack did it"; attribution never reads it.
- **Later discoveries** add evidence to that misfortune ("short again: 30 lb since April") at most weekly, with anxiety and security capped per case. Another debit isn't new evidence; another count is.
- **Responses are ordinary urges:** a discovered loss proposes counting oftener, a lock or iron bands on the bin, all real purchases through `authorizeAct`.
- **Informed acceptance:** a source holding `draws_from(item, them)` ≥ 60 with a promise from the keeper (restitution or plain consent) records nothing new: a legitimate ending.

### 5.3 TRUE vs. BELIEVED [PROPOSAL]

Truth (effects, virtue, strings, cases; `omniscient` until earned), evidence (what an actor observed, tested, read or was told) and belief (credence, with rumor lineage) are stored separately.

**Claims compile to predicates.** Rumor mutation changes a prop's predicate and keeps a prefix of its args (`belief/api.ts`); it can't rewrite an argument. So each claim becomes a derived predicate at bundle time, `claim.<item>.<claim>(item)`, and each `from`/`route` edge becomes the parent's `exaggerates_to`, `supernaturalizes_to` or `truncates_to`. Validation requires at most one child per route, no cycles, reachability from a seed claim and no collision with authored predicates. Lineage is the existing rumor lineage, and no mutation code changes. Desire reads each claim's `group` (§5.6).

**Learning the truth, one fact at a time:** inspection (10 min, DC 10) shows construction; Spellcraft (1 h, DC 15 + 3·tier, 1 virtue) the effects and the draw; Lore (Fae) at DC +5 counterparty and strings; a controlled activation its result; Trade (Milling) or Bargain traces a discovered case back; a lyceum measurement, or (slice 2) print, which freezes a variant. No roll reveals an unknown owner's memories or anyone's concealed ancestry.

**Culpability is inferred, never implied.** Attribution scores actors, so believing `draws_from(sack, mill)` doesn't blame the keeper, clear the hired man or retarget a grudge by itself. Module:belief adds evidence-driven, actor-subject rules:

| Predicate | Formed when the holder believes… | Grudge aim |
|---|---|---|
| `benefited_from(actor, household)` | `draws_from(item, H)` ≥ 50 and `has(actor, item)` ≥ 50 over the loss window | Restitution, mild |
| `kept_drawing(actor, household)` | the above, plus that the actor was told or shown before a later draw | Restitution |
| `stole_from(actor, household)` (existing) | direct evidence of a deliberate take | Existing |

**Refutation is separate from accusation.** When a holder comes to believe a misfortune was a draw (`draws_from` ≥ 60 covering that household and window), each earlier attribution of it to another actor gets counter-evidence, and a grudge founded on it loses its founding weight. Clearing the hired man doesn't depend on blaming the Fenns. Item predicates never open a persecution process against an object.

### 5.4 Virtue, recharge, iron [PROPOSAL]

- **Virtue** runs 0..max. At 0 the charm is **dormant**, not broken.
- **Recharge kinds:** `moon`, `closed_dark`, `offering` (items really consumed at a place of the counterparty), `place_fi`, `water` (running water at dawn), `dew` (hung empty outdoors at dawn, no rain, above freezing), `labor` (an hour of real, unpaid work), `never`. Validation rejects zero-time repeatable loops.
- **Iron** (`03` §3.3): `contact` (`suppress`, `dormant_day` or `damage`), a `nearby_g` threshold and `sour_per_day`. A fae charm doesn't wear; **iron sours it**. Below condition 25 it stops recharging, and at 0 it is ordinary forever.
- **Iron storage suppresses the object, not the bargain.** An `iron_lined` container stops activation, recharge, aura, souring and effects. It **doesn't pause** string deadlines, callings, loan due dates or anything owed "by" a date; boxing Jack's Lantern through a full moon means it isn't let out, and it dies. A string pauses only if its data says `pause_when_sealed = true`. That is how a Hall seals a charm, and why sealing can't dodge a debt.

### 5.5 Quirks and strings [PROPOSAL]

**Quirks** (`content/base/fae/quirks.toml`): `unthanked` (thanks aloud block recharge for a moon); `chooser` (full effect for `boundTo`, half for others, none for a thief); `counted` (counting the yield aloud spends 1 virtue); `homing` (on a full-moon night at FI ≥ 3 it strays a place toward its counterparty); `jealous`; `sabbath_silent`; `aura` (local FI +1 and thinning +2/day: **a charm makes its town more fae**, Rec 8); `sings` (a dusk omen); `cold` (a tell); `name_hungry` (a +6 true-name link after 30 days, `06` §3.5).

**A string** is a deferred obligation: counterparty, exact terms, liable party, due condition, state, breach consequence, `pause_when_sealed`, and a **transfer rule**: `travels` with the object, `stays` with the original accepter, or moves only on **acknowledged acceptance**. Selling never silently assigns another's debt; destroying never erases an independent one. Kinds: `toll` (the River takes a stated share), `tithe`, `turns_on_sale` (gone at dawn; the buyer finds leaves), `reclaim`, `lien`, `return_loaf`. A draw isn't a string; it's conservation, always traced.

### 5.6 Desire and attachment [PROPOSAL]

**Desire** is evaluated **on triggers only** (a use or result observed, a claim learned, a shortage suffered, access gained), never by hourly scan.

`D = clamp(0, 100, floor((3U + A + L + E − 2R) / 4))`
- **U**, believed utility: per claim group, the maximum over its claims of weight × credence / 100, summed over groups and scaled by relevance to the actor's needs; ×3 if the pantry's `daysLeft` is below its horizon (*the hungry want it most*); capped at 100. Exaggerations of one function no longer add up.
- **A** attachment; **L** allure; **E** envy of the holder's observed advantage; **R** believed danger, liability and string cost.

**`charm_covet`** (Id) fires at 10 × D, capped at 700, voiced `greed`, `envy`, `longing` or `fear` by charm kind, with item-typed urges (§6.1): `ask_to_see`, `beg_loan`, `offer_to_buy`, and `take` only when `honesty` < 30 and `greed` ≥ 60. U 80, A 0, L 20, E 40, R 20 gives a 650 thought: *"One turn with that sack would put bread in our cupboard."* **`charm_conscience`** (Superego) speaks as `piety` ("a devil's gift"), `honesty` ("it isn't honest bread"), `neighborliness` ("The children next door have eaten nothing warm."), `our_own` and a loan's `duty`.

**Attachment is a preference, never a veto.** It runs 0–100 per (holder, charm): +3 a day of material help (cap +15 a week), +10 for a real emergency, −1 a day after a week without contact or benefit. It adds a `charm_keep` thought (`fear` or `greed`) at 5 × attachment, supporting `refuse`, `hide` and `deny_having` and opposing lending, selling and disposal. `honesty` opposes `deny_having`; a loan's `duty` and `neighborliness` support lending. No threshold flips behavior. Losing the charm leaves grief at attachment intensity. Holding an active charm lowers fae-longing by 10 a day: keepers drift toward the hollow.

### 5.7 As PC gear: Readiness (P8) [PROPOSAL]

Virtue shows on the Kit Sheet as a countdown, like lamp oil ("Rain-Hem: 2 soakings; dew at dawn if it clears").

**The forecast contract** (module:provisions with fae). `planReadiness` projects a private copy of selected state (`provisions/planner.ts`), with no fae state and no view of other households' stocks. Fae adds a pure `forecastCharm(input)`:
- **Input** is a knowledge-filtered model built for the holder: facts verified by observation or test (not rumor), self-known virtue, the plan's recharge chances and carried resources. Never live `world.fae`; never remote stocks.
- **Projected state:** the projection carries its own copy of virtue and activation.
- **Output:** *exact* deltas for carried or known resources (Rain-Hem keeps these containers dry for these hours) and *conditional ranges* for remote effects ("Sack: 0–10 lb a day if an unwarded store within 3 mi has flour; not counted in food-days").

Readiness rows: carried supplies; verified exact output; conditional output (shown, never counted); **claims not included**. Iron arithmetic is ungated ("Rain-Hem suppressed: a 2½ lb cold-iron knife in the same pack"); string rows are gated by Lore (Fae). **The catalog-kid fight** is a cold-iron knife *or* a working charm in the same knapsack. No charm is in the Book by type (`03` Q11); Under the Counter (Rec 13), Gussie Pratt may hold one secondhand charm at a time.

### 5.8 Starter catalog [PROPOSAL]

Counterparties: **H** Hearth, **T** Thorn, **U** Under, **A** Alder, **R** River. ★ ships in slice 1b; ☆ is a slice 2 candidate. Prices are specimen valuations, not shop stock.

| Charm | lb · $ · virtue | True use · price | The town will say | Disruption |
|---|---|---|---|---|
| **★ Never-Empty Sack** (H) *"Tie it shut at night and don't look in till the cock crows."* | ½ · 40 · 7 | Tops itself up to 25 lb of flour at dawn, 10 lb at most, by **draw** from the nearest unwarded flour within 3 mi. `unthanked` | "It makes flour out of nothing." | Stores and the mill come up short at the next count. Iron on one bin moves the draw to the next nearest unwarded bin; whose depends on who can afford iron and where they live |
| **★ Rain-Hem** (H) *"Stitch inside the flap. Let the weather attend to the outside."* | ¼ · 3 · 2 | One container stays dry; the rain it turns lands on the nearest other uncovered container | "Never a wet biscuit in his pack." | Who sleeps downwind of whom in a shared camp. **Honest: usefulness survives identification** |
| **☆ Mending Needle** (H) *"Bring the thread. It remembers the seam."* | — · 2 · 3 | 30 min and real thread restore 20 condition (max 80); stitches the repairer's initials | "The seamstress's needle." | Initials become evidence in an ownership quarrel |
| **☆ Bottomless Creel** (R) *"Willow and wet. Don't count your catch."* | 2 · 8 · 5 | Holds 15 lb unspoiling, 1 virtue per 7 days or part; recharged in running water at dawn. `counted`. **Toll:** each dawn, one fish in seven put in goes back (by count, rounded down); with no fish, the last item put in, ≤ 1 lb | "Fish never rot in it." | August trout at the landing undercut the wood-yard family's fish trade |
| **☆ Spring-Kettle** (R) *"Copper; it never saw a forge. Fill it where the water has a tenant."* | 3 · 10 · 3 | Boils ≤ 2 qt of water per virtue, no fire or smoke; `boil_water` only. `cold`. The spring skins with ice that day | "Boils on the Lord's own warmth." | Precious in a firewood famine; the Glovers' spring tenant cools toward them |
| **☆ Jack's Lantern** (T) *"Horn panes, and something inside that knocks."* | 2 · 18 · 5 nights | Light without oil that never blows out. `aura`, `sings`. Not let out at a full moon (iron is no excuse), it dies, and the wisps hold a grudge | "Witch-light at the Haas place." | An omen emitter in a low-FI town: thinning, fear talk, Bell's debunking |
| **☆ Clew of Red Wool** (T) *"Toss it ahead and follow. It knows every road with a name."* | ¼ · 9 · 5 | 1 virtue per leg, +1 per moonlit night. Never lost; only *named* places; ask for a name you don't know at FI ≥ 3 and it leads to the court | "The surveyor's fairy thread." | Whitcomb wants it for running lines: a fae thing used to chain the land |

**Later entries**, each fully specified before it ships: **Butter-Print** (H) *"Your butter will come. Theirs is their own affair."*: butterfat drawn from the 3 nearest dairies, so the butter-witch accusation is right about the theft and wrong about witchcraft (needs churning in provisions). **Hob's Besom** (H) *"Never, ever give it clothes."*: borrowed overnight labor; the hired girl is let go. **Seed-Corn of the Hollow** (H) *"Leave the third row."*: ×3 yield drawn from neighbors' fields (needs harvest). **The River's Token** (R): the keeper cannot drown, and within 13 moons the River takes someone who ate at his table. **Fossegrim's String** (R): dancers compelled until the tune ends; the Haugean revival burned fiddles. **Hollow Penny** (T) *"Spend it as often as you like."* (below). **Huldra's Cowbell** (T): at Midsummer a huldra comes courting the herdsman. **Huldra's Comb** (T): a day's soul-image glamour, class A. **Rush Bridle** (T) *"Slip it on a sleeper, and ride."*: fields plowed overnight by a neighbor's exhausted son. **Blue-Burning Candle** (U): outside the Accord's good standing, it finds ore in a court's hall. **Measure That Agrees** (U): proves assent, **not** a correct boundary. **Briar Pin** (A): borrowed rest and a crew's converging dreams. **Jay's Feather** (A) *"Ask it Thursday about Sunday."*: "He knows when the frost is coming" becomes **"He makes the frost."** **Still-Water Glass** (A): spectral testimony with no standing before the JP. **Name-Locket** (A): hides seven names until it's opened at FI ≥ 3. **The Returned Cup** (A): a child's name, 1829, three claimants. **Knotted Wind-Cord** (R): the third knot is a storm on the keeper's name.

**Slice 1b specifications:**

| Field | Never-Empty Sack | Rain-Hem |
|---|---|---|
| Capacity | 25 lb of flour; it only tops up | The one container it's stitched into, ≤ 10 kg |
| Activation | Tied shut overnight in the dark (`fae.use`); opened before cockcrow, nothing comes | Automatic when the container would take rain or immersion |
| Operation · charge | `draw` at dawn (§5.2) · 1 virtue per dawn that moves ≥ 1 lb | `container_dry` (wet contents stay wet) · 1 virtue per 6-h block of exposure |
| Recharge · expiry | +7 for porridge with butter (1 lb cornmeal, 1 lb butter, consumed) left by it overnight at the keeper's hearth, weekly · none, but `unthanked` blocks recharge for a moon | +1 per dawn hung empty in dew, max 2 · none |
| Iron | ≥ 2 lb in contact or the same container: no draw; sours 2 a day | ≥ 2 lb in the container: suppressed |
| Failure | No source or no room: nothing moves, no virtue spent | At 0 virtue, an ordinary flap |
| Gear check | On a trail with no store within 3 mi it yields nothing, and the forecast says so | vs. an oilcloth wrap on a 3-day rainy trip and a 7-day trip with a cold-iron knife |

**The Hollow Penny ships only with** an integer denomination (a worn bit passes as a *short bit*, 10¢); a unique instrument record with one holder; a dawn return that debits the payee's till 10¢, or what remains if it was spent (the gap is a discrepancy found at the count, §5.2); spending kept distinct from selling it as an artifact (sold, it still goes home: fraud on the buyer); and discovered fraud producing item-specific refusal ("not that bit") and a restitution claim. `chooser` is how it comes home, not an exploit guard.

**Not every useful charm hides a harmful price** (Rec 7); Rain-Hem, the Needle and the Measure are fair bargains whose stories are about access and credit. **Fae-made is not fae food:** the sack moves ordinary flour, with its real kcal, Fresh, spoilage and prep.

---

## 6. The disruption arc (D)

### 6.1 The causal chain [PROPOSAL]

Nothing in code is called `CharmArc`. A charm runs four processes (virtue, draws, strings, allure), and everything else is the existing sim reacting. Each step below has one owner, and each can fail: the charm may stay private, become shared equipment, be sold or sit in a drawer.

| # | Step | Mechanism | Owner |
|---|---|---|---|
| 1 | **Benefit observed** | A witnessed use or result (the full sack at dawn, bread on a hungry table) gives each witness an Observation on a claim predicate | fae emits; belief `observe` |
| 2 | **Utility believed** | D (§5.6), on that trigger, for each witness and later hearer | fae |
| 3 | **Item-specific proposal** | `proposeFaeUrges`: `{ kind: 'interaction', interactionId: 'beg_loan', targetId, itemId, terms }` | fae proposes |
| 4 | **Arbitration** | Covet vs. conscience for the asker; keep vs. duty vs. neighborliness for the keeper | psyche |
| 5 | **Validated transfer** | Availability, possession, room, both parties' `authorizeAct`, and the keeper's own decision, all checked before time is spent; then `moveStack` | social, provisions items API |
| 6 | **Promise** | An **object loan**: lender, borrower, item, due date, allowed use, deposit cents, recharge duty | social |
| 7 | **Witnessed outcome** | At the due date the borrower gets a `duty` thought. Return, extension or breach is an interaction with witnesses: memories, opinion reasons, gossip | social, psyche, belief |

**Typed urge payloads** (foundation, additive): `interaction` and `activity` urges gain `itemId?`; `interaction` gains `terms?`:

```ts
type Terms =
  | { kind: 'loan'; dueAt: GameMinute; use: 'household' | 'any'; depositCents: number; rechargeDuty: boolean }
  | { kind: 'sale'; priceCents: number }
  | { kind: 'gift' };
```

`sameUrge` compares them field by field (integers and closed strings), `urgeLabel` includes them, and they serialize unchanged into `core.command` and `psyche.arbitrated`, so replay is exact.

**NPC decisions use the Command resolvers**, proposed by fae with data-declared voices: `inspect` / `study` (curiosity, or `honesty` when a claim is believed without knowing where the goods come from); `lend` / `share_out` (`neighborliness` at an observed hunger, against `charm_keep`); `return_item` (the loan's `duty`); `make_restitution` (`honesty`, once the keeper believes `draws_from`); `bury`, `destroy`, `return_to_faerie`, `sell` (`fear` or `piety` once `bane` ≥ 50; `thrift` or `greed` to sell); `take` (`greed`, only with `honesty` < 30 and `greed` ≥ 60).

**The loan gate comes first.** Before any arc distribution is measured, an autonomous two-household loan must work with no Commands: the Moes beg the sack, the Fenns lend it on terms, it comes back on the due date, and both households remember it.

### 6.2 New pieces, all additive [PROPOSAL]

- **Items as belief subjects.** Core `PropArg` gains `item`. Predicates: derived `claim.<item>.<claim>` (§5.3); `has(actor, item)`; `owns(actor, item)`; `lent(actor, actor, item)`; `draws_from(item, household)`; `boon(item)` / `bane(item)`; `benefited_from` and `kept_drawing`; `fae_abroad(place)`, `portent(actor)`.
- **Charm notoriety:** per settlement, the share of adults with credence > 20 on any prop about the item.
- **Thought rules:** `charm_covet`, `charm_keep`, `charm_conscience`, `omen_fear`, `omen_longing`.
- **Interactions** (`content/base/interactions/fae.toml`, fae-owned by MODULES.md amendment), each validated before time is spent with the reason named (triage finding #4): `ask_to_see`; `beg_loan` (Persuade, then the keeper's decision); `offer_to_buy`; `return_item` / `extend_loan` / `refuse_return` (a missed deadline is a remembered breach, not a theft verdict); `demand_return`; `take` (Sleight of Hand or Stealth vs. Perception; witnessed → `stole_from`); `hide` / `deny_having` (a lie that books `honesty` anxiety); `share_out`; `denounce`. `confiscate` and `sue_replevin` wait for slice 2.
- **Opinion defaults:** a returned loan gives Trust +5 and Obligation −5; a knowingly broken one gives Trust −15 and a restitution grudge.
- **A thief's half-working charm** (`chooser`) makes the thief believe the keeper is witching it.

### 6.3 Arrival vectors [PROPOSAL]

**The Director never creates a charm** (`05` §8.3). Worldgen seeds a **reservoir**, placed after the protected-site check: 1–3 counterparty-appropriate charms per anchor (6–10 anchors), Night Market stock of 4–6, and an iron-lined chest in ~30% of Hall-reader households: 25–40 charms per county, ~90% "under the hill".

| Vector | Mechanism | Per county-year |
|---|---|---|
| **Found** (slice 1b) | A hazard per **eligible actor-hour** (forage, ginseng, wood or play at a reservoir place): Perception DC 15, 5‰ per charm present, at most one find per charm per season. Finds are reported per eligible actor-hour as well as per year | ~2 (target, measured) |
| **Strays** (slice 2) | On ~16 full-moon and festival nights, each reservoir charm at FI ≥ 3 strays to an adjacent, lower-FI, non-protected place at 6‰ | ~3 |
| **Gifts** | A nisse's gift to a tribute-keeping household in misfortune; a huldra's or Erlking's daughter's courting gift; an Accord reward. Accepting binds | ~2.5 |
| **Trade** | The Night Market (names, memories, years); estate sales of sealed chests; 1 in 20 peddlers | ~3 |
| **The Prince's games** | `gift_test`: a charm left where a target household will find it; in witch mode, a Behest | ~1 |
| **The PC** | Brings one home | Commonest |
| **N13** (Rec 9) | A compound nudge (N1, N8, N9 or N2) on an **existing** charm. Cost 5; RELAX or BUILD only; no thread active there | Pacing |

**Target (Rec 10):** 8–12 arrivals a year, half reaching a settlement: one county thread every 6–8 weeks, one per settlement every 1–2 years.

### 6.4 Whose is it [PROPOSAL]

Four layers disagree, and the arc lives in the disagreement: **possession** (item location), **rightful claim** (`owns` beliefs with their basis), **the law's word** (a JP ruling, Document evidence) and **what it chose** (`boundTo`). Claims seed when an actor comes to hold `has(x, item)`: finder 70; the household whose land it was found on 60; sources holding `draws_from` at that belief's credence; a name or provenance on the object 90; the keeper's Club, church ("the fire") or Hall by norm; the counterparty 100 (Law) where a `reclaim` string exists; heirs by kin rule. A replevin verdict settles the law's word and leaves the charm's word unchanged.

### 6.5 Institutions: competing, sometimes effective [PROPOSAL]

This is the doc's answer to the colonial and primitivist framing. **Institutions make competing, sometimes effective responses; consequences depend on evidence, resources and commitments.** No institution is set up to lose, and no ending is preferred. Responses come from norms, office data and resources, never people traits.

| Institution | Its answer | When it works | How it can go wrong |
|---|---|---|---|
| **The law** | Replevin | Settles possession and compensation | It decides who holds the sack, not whom it serves |
| **The market** | Price it; float "The Hollin Never-Fail Flour Company, 40 shares at $1" | An informed sale with disclosed strings | Forty shareholders, one virtue; an undisclosed string becomes a grievance |
| **Mill and store** | Iron on the bin; count the stock | Iron protects that bin; counting finds the loss early | The draw moves to the next unwarded bin, whoever's it is |
| **The pulpit** | Providence, or the Devil's | A shared frame settles a congregation | The frame follows the preacher's psyche; a lay preacher and the pastor can split |
| **The Hall** | Seal it in iron | Sealing stops the object | Confiscation is theft to the keeper; the attic is a future arrival vector |
| **The Club** | Common property, relief by rule | Fair allocation among members | A non-member family hungry beside the sack (`12` §8.9's "Club winter") |
| **The lyceum** | Measure and publish | Reveals the truth; blame can leave the hired man | Some keep old claims; a keeper who never knew is suddenly suspect |
| **The household** | Keep, lend, sell or destroy it | Each is a reasonable choice | Attachment, inheritance fights, denial |

**The economy, honestly.** At most 10 lb a day is ~300 lb a month, $9–15 of flour out of someone else's bin: enough to feed eight and hurt a small mill, not to collapse a county. Prices move only through `03` §8.2 once it exists. **Never fake a crash with a scripted penalty.**

### 6.6 Resolutions and closure [PROPOSAL]

| Resolution | How | After |
|---|---|---|
| **Kept quietly** | One holder, little talk | A peaceful closure that can reopen |
| **Informed acceptance** | The source agrees, paid or not (§5.2) | Draws continue as a known bargain |
| **Restitution** | The keeper repays the source in kind or cash | Grudges ease |
| **Shared out** | A rota by ordinary promises, with restitution and tribute kept | The Hearth Court approves; envy eases |
| **Destroyed** | Cold iron and fire at a forge: Trade (Smithing) DC 15 + 3·tier with ≥ 5 lb iron | The counterparty's Affront; independent debts remain. Johann Brenner, who "absolutely believes in iron", is a likely smith |
| **Returned to Faerie** | **Hearth:** left overnight with porridge and butter where tribute has been kept a year (tag `hearth_tribute`: the cream saucer behind the Haugen mill's hopper, the Kvale barn sill). **Others:** an FI ≥ 3 place of that counterparty at its calendar key. Fae Courtesy DC 15 + 2·tier | Strings released if the terms are met; sometimes a gift comes back |
| **Sold away** | To a peddler, or downriver | Gone with its strings. "Last seen at Galena"; it may return in a legacy run |
| **Buried** | At a crossroads or under a threshold, with iron | Dormant in 30 days; a cache `homing` may undo |
| **Dormancy** | Virtue spent, not recharged | A **dependency crash** if households stopped buying flour and the mill cut its hours |

Later slices add confiscation by an office, reclamation by a `reclaim` string, and the keeper departing with it or leaving it for the next family.

**Closure.** A thread closes peacefully after 30 days with no forced transfer, no newly discovered draw, no new accusation involving the item, and stable custody (one holder, or a rota with no breach). Any of those reopens it, as does arrival in a new settlement. "Kept quietly" is a peaceful closure with one holder and notoriety below 20%.

### 6.7 Chronicle pattern: "The Charm at ‹town›" [PROPOSAL]

The detector `chronicle/patterns/charm.ts` keys threads by charm × settlement and cites `shortage`, `scapegoat`, `feud`, `debt` and `whispers` threads by id. **Levels:** 1 **A curiosity** (arrived, a witnessed use, a claim ≥ 200‰); 2 **A want** (≥ 3 covet urges acted on, ≥ 2 opposing `owns`); 3 **A quarrel** (a forced transfer or ≥ 2 loans, plus a `boon`/`bane` split at ≥ 25% each or a discovered case with ≥ 2 attributed misfortunes); 4 **A trouble** (a keeper at rung ≥ 2, a fired string, violence, or the truth revealed); 5 **Closed** (§6.6), then **Truth** in the epilogue.

**Milestones.** Threads keep 40 facts (`chronicle/engine.ts MAX_FACTS`) and the log rolls, so the detector writes ≤ 12 bounded milestone summaries into `thread.data` (level reached, transfers, discovered totals, closures), each stamped with its audience (public, PC, all). Long arcs survive both evictions, and fair prose stays fair. The epilogue's numbers come from `drawLedger`. New template slots: `charm`, `claim`, `keeper`, `source`, `omen`.

- *Paper, level 1:* **A Curiosity at Iron Ford.** "We are told that {keeper} has come into possession of a flour sack of uncommon habits. Our informant says it {claim}. We print it as given."
- *Paper, level 3:* **The Sack Question.** "Nothing has divided {town} like {charm} since the bell was hung. One party calls it Providence and the other theft, and both buy their flour cheaper."
- *Ballad* (notoriety ≥ 75): "It fed the ridge and starved the mill, / and no one asked whose bread."
- ***Epilogue, Truth:*** "The sack never made a pound of flour. It took 1,140 lb from Pratt & Daughter's back room, 600 lb from the mill, and 90 lb from the Club cupboard. The mill's loss was blamed on the Fenns' hired man, who left the county in September." **The post-run truth reveal is where the story becomes worth telling** (P5). Fair-mode prose uses only facts known to the PC.

### 6.8 The player and the witch [PROPOSAL]

- **Cause:** bring one to town (*whom* you give it to shapes the thread); plant one to frame someone; say "thank you" to the keeper's sack at supper.
- **Exploit:** rent it out and become patron to half the town; buy cheap from a frightened keeper; sell the true function to Bell.
- **Prevent:** ridicule early; buy it out; study it and tell the keeper; organize a public test. Warning the miller protects his bin and moves the draw; the epilogue says whose.
- **Resolve:** any §6.6 route, including brokering an informed arrangement with the source or keeping it private.
- **Exploit guards:** the conservation test; virtue and real offerings cap throughput; one lead per episode; iron pauses objects, not deadlines; valued Tally offerings; the Penny's instrument record; `authorizeAct` everywhere.

**Witch mode.** A charm the witch gives is an accepted gift and a +4 link (`06` §3.5): every thread she starts is a target list ("Let the Lutherans believe the Methodists cursed them": a Butter-Print at a Methodist dairy). Woe rules stay `06`'s, with no recounting per rumor variant. When a town destroys her gift with iron and fire she takes 1d6 nonlethal and a burn tell, so destroying the charm is also how a town *finds* her.

### 6.9 Worked example: the sack at Iron Ford (fixture `charm_at_iron_ford`)

- **Day 3:** the fixture pins a sack in Lower Lantern Coulee. A Fenn child finds it while foraging. The Fenns' pantry is below its horizon.
- **Days 4–9:** tied nightly, it tops up from the nearest unwarded flour, the Haugen mill's back bin. A visiting neighbor sees the full sack twice (`claim.never_empty_sack.feeds` at 60); gossip carries `never_empty` by day 7. Nobody at the mill knows.
- **Day 8:** the mill's weekly count finds 40 lb short: one `stock_short`, which some attribute to the hired man. Haugen bands the bin with iron, and the next draw comes from the Club cupboard.
- **Day 12:** the Moes' covet wins arbitration: `beg_loan`, due Sunday, household use, recharge duty. The Fenns' own arbitration lends.
- **Day 16:** it comes back on Sunday (Trust up; a rota may form), or it doesn't (a remembered breach and two opposing `owns`).
- **Day 20:** if Clara Stoughton's honesty wins and she studies the sack, she tells what she found. Some retract the hired-man attribution, some keep it, a few form `benefited_from(Fenn, Haugen)`. Nobody forms `kept_drawing` unless the Fenns keep tying it after they've been told.

**None of this is scripted.** In other seeds the Fenns hide it, Brenner burns it on day 10, the Fenns settle with Haugen in flour and keep it, or no count comes before the sack goes dormant.

---

## 7. Implementation (E)

### 7.1 Module and integration owners [PROPOSAL]

**`module:fae`** (amend `docs/impl/MODULES.md` first) owns `packages/core/src/fae/` (the standard files plus `episodes`, `omens`, `thinning`, `describe`, `charms`, `effects`, `draws`, `forecast`, `strings`; later `workings`, `tally`, `drift`), `packages/content/src/schema/fae.ts` (`faeDomains`: omens, describeLines, charms, quirks, strings, courts, workings), `content/base/fae/` and `content/base/interactions/fae.toml`.

**World slice**, one owner per record: `world.fae = { episodes, thinning, fiShift, signatures, cooldowns, charms, drawCases, strings, tally }`. Loans are social's, stacks provisions', misfortunes belief's, agency psyche's.

**Schedule:** `needs → psyche → activity → fae → social → belief → provisions → chronicle`. After activity, fae knows who is where; before social and belief, omen talk lands the same hour; before provisions, dawn draws reach breakfast. Fae urges reach psyche next hour, like current reactive thoughts.

**Integration owners** (additive contracts through `api.ts`; 1a first, then 1b):
- **foundation:** `ModuleId` and `STREAMS` += `fae`, unions, the slot, `ctx.rngAt`, `Command.issuer?`; then urge `itemId` and `terms`.
- **psyche:** `authorizeAct`, `AgencyState` and standing data (the parallel workstream); `proposeFaeUrges`; thought rules.
- **needs-activities:** `authorizeAct` on activities; `stocktake`; `investigate`, `inspect`, `study`, `bury` as activities with `itemId`.
- **social:** `authorizeAct` in chosen, spontaneous and displacement paths; pending requests; object-loan promises; memory kind `omen`.
- **belief:** `PropArg 'item'`, `fae_abroad`, derived claims, item predicates, `stock_short`, `causeItemId?`, culpability and refutation.
- **provisions (incl. items):** `authorizeAct` in purchase and shopping; `moveStack` for draws; `ironPresenceG`; `checkShortfall` calls; the forecast contract.
- **content-world / worldgen:** `isProtectedSite`, generated descriptions, tags, `fae_court`, the Cold Stair, `hearth_tribute`, signatures. **content-items:** `items/fae.toml`.
- **chronicle:** template slots, the omen digest, the `charm` detector. **play / web:** `look`, `signs`, `investigate`, `fae.*`, pending-request prompts, interrupts, Signs & Wonders, charm cards, Readiness rows.

**Fae API:** `effectiveFi`, `episodesAt`, `describe`, `investigate`, `charmView`, `forecastCharm`, `useCharm`, `rechargeCharm`, `checkShortfall`, `proposeFaeUrges`, `obligationsOf`; later `learnWorking`, `work`, `applyDriftGain`.

### 7.2 Events, Commands, Explain [PROPOSAL]

**Events:** `fae.omen` (an episode with ≥ 1 noticer; importance 5–30); `fae.investigated`; `fae.thinning` (a stage crossed); `fae.incursion` (slice 2); `fae.charm_arrived` / `_used` (first witnessed per day) / `_drew` (daily per charm) / `_recharged` / `_revealed` / `_disposed`; `fae.string_*`; `fae.agency_*` (slice 4); `fae.working*` and `fae.tally_called` (slice 3). No per-actor-per-hour events. Social owns claim and loan events, provisions material losses, belief transmission, misfortunes and accusations.

**Commands** (each a headless verb, ADR 0002): `look`, `signs`, `investigate`, `fae.inspect`, `fae.study`, `fae.use {item, target?}`, `fae.recharge`, `fae.offer`, `fae.return`, `fae.destroy`, `fae.bury`, `fae.answer {request}`; later `fae.let_out`, `fae.fulfill`, `struggle`, `fae.practice`, `fae.work`. Interactions go through `core.urge` with §6.1's payloads. Queries don't advance time; a failed eligibility or authorization check never consumes an hour.

**Knowledge:** notice, read, investigation and authorization at `self`; omen truth `omniscient` until read; a charm's function, draw source, cases and `boundTo` `omniscient` until study, measurement or a traced shortfall; virtue `self` (holder); string triggers `omniscient` until Lore (Fae) study; working checks `participants`; exact Tally at Lore (Fae) 4; a rider `omniscient` until discovered; thinning `public` as description words. **Separate the fair Explain from the full resolution** whenever the total would reveal a hidden term. Normalize with `term()` / `intValue()`.

### 7.3 Determinism and performance [PROPOSAL]

- **Rolls:** episodes use `ctx.rngAt` (§3.3); charm effects use `ctx.rng('fae', mixKey(item, day, action, SALT_*))` in their hour; checks use `checks`; `describe()` uses `hashString32`. Iterate with `idsOf()` / `rowsOf()`.
- **Equivalence tests:** eager vs. deferred episode resolution, arrival order, save/load mid-episode and forks give identical episodes and world hashes.
- **Conservation test:** every fae effect transaction, 64 seeds × 60 days plus a year run.
- **Hot paths:** ~160 episode rolls a day at Iron Ford; notice rolls only for present actors; desire on triggers, ≤ 3 notable charms per settlement; draws once per dawn, searching places by distance and then one place's stacks; no O(all stacks) scans per hour.
- **Budget, pinned** against the commit that lands slice 1a's foundation asks, on the machine recorded in `manifest.json`, seeds `iron_ford` 42 and `gen:town` 1–3, `--years 1 --profile`: fae ≤ 0.3 ms per game-hour; whole-run ms per game-hour ≤ +10%; belief + social + provisions ≤ +5% (downstream cost); year-end save ≤ +5%; `fae.omen` < 2% of events.

### 7.4 Worldgen (ADR 0003) [PROPOSAL]

The protected-site check runs before every hook. **FI field** (layer 4): seeded from springs, caves, sinkholes, fog pockets and old growth; algific slopes and erratics are negative; **never mound forms**. **Places** (1a): standardized tags, base descriptions from tags × FI, a signature per FI ≥ 2 place. **Reservoir** (1b, minimal): `gen:town` gets one Hearth charm at a farm place, findable by activity. **Slice 2, once worldgen generates counties:** 6–10 anchors (springs → River or Thorn; caves → Under; alder and fog → Alder; farm rings → Hearth; coulee heads → Thorn), the full reservoir, and history pre-roll ("the year of the Haugen sack"). **QA:** an FI 2–3 excursion within a day; ≥ 2 terrain families; no omen desert; no fae output at a protected site; the conservation check in the 30-day QA sim; never a persecuted person or concealed heritage as drama fuel.

---

## 8. First slice [PROPOSAL]

**1a** makes the fae layer visible without touching anyone's will or goods. **1b** adds one useful object and one dispute, with every link of §6.1 tested.

### 8.1 Slice 1a: agency-safe omens and places

**Prerequisite:** the agency contract (§2.2) has landed with its tests for idle hours, loan requests, defenses and shopping.

**Scope:** (1) foundation: the stream, ModuleId, slot, unions, `rngAt`, `Command.issuer`; (2) places: `isProtectedSite`, generated descriptions, tags, `fae_court`, the Cold Stair at FI 1 `algific`, signatures, `describe()` for every `iron_ford` and `gen:town` place, `look`; (3) **six omen families** as §3.3 episodes with notice and read: Providence signs (FI 0), hearth signs (FI 1), lights (FI 2–4; fox fire, lantern and marsh-gas lookalikes), the answering echo (bluffs), huldre bells (goat prairies) and Ice signs; (4) the `omen` memory, class-A `omen_fear` / `omen_longing`, `fae_abroad` and rumor, Journal and Almanac lines; (5) thinning through Signs; (6) Signs & Wonders and `investigate`, leading only to traces, actors and places.

**Acceptance:**
1. `just check` is green; every golden diff has a one-line reason.
2. **Determinism:** eager vs. deferred resolution, two arrival orders, mid-episode save/load and a fork give identical episodes, notice results and world hashes.
3. **Iron Ford, seed 42:** a scripted PC reaching the Cold Stair at dusk on day 2 via Lower Coulee and Huldra's Shelf notices ≥ 3 omens, ≥ 1 a lookalike; the Cold Stair yields only Ice signs; no Explain shows truth before a read.
4. **Descriptions:** ≥ 3 layers per `look`; adjacent places never identical in the same hour; Lore (Fae) 0 and 4 see different fae lines; nothing changes within a day, and the base layer never.
5. **Investigation:** repetition, returning and rotating three party members never redraw a lead; ineligible attempts cost nothing; questions close only on new evidence.
6. **Rumor:** by day 4, ≥ 3 named NPCs hold `fae_abroad(·)` ≥ 40 through rumor.
7. **Causal ablations:** with no witnesses, true episodes occur but cause no thinning, belief or rumor; without bell ranges, Sunday-morning episodes return to base rate; at FI 0 everywhere, only Providence signs and lookalikes appear.
8. **Agency:** over 64 seeds × 30 days, a commanded PC's omen thoughts never produce an act.
9. **Protected sites:** fixtures tagged `protected` + `spring`, `mound`, and `fae_barrow` + `mound` fail validation or yield no fae output.
10. **Spam:** ≤ 1 omen Journal entry per PC-day, ≤ 1 omen Paper item a week, `fae.omen` < 2% of a year log, no omen template above 10% of a year's omen lines.
11. **Fresh seeds:** in ≥ 7 of 8 fresh `gen:town` seeds, a fair-mode explorer finds a distinct description, a real sign and an actionable lead within 8 days.
12. **Performance:** the §7.3 budget.

**Playtest gate (ADR 0002, fair mode):** `iron_ford` 42 and `gen:town` 1–10, reports in `playtests/<date>-<persona>-<seed>/` with `report.md`, `commands.jsonl` and `metrics.jsonl`. **Explorer:** something fae within 2 days up the coulee; ≥ 4 of 5 runs report a sign they *wanted to follow* and a dusk return because timing mattered. **Greenhorn:** uses `look`, `signs` and `investigate` unaided. **Exploit hunter:** can't farm leads by repetition, rotation or replay.

### 8.2 Slice 1b: one useful object, one dispute

**Scope:** (1) the Never-Empty Sack and Rain-Hem (§5.8), quirk `unthanked`, no strings; (2) conservation, draws, cases, discovery, `stock_short`, informed acceptance (§5.2); (3) the whole §6.1 chain with one object-loan model and the listed NPC decisions; (4) item beliefs, derived claims, culpability and refutation (§5.3); (5) the forecast contract (Rain-Hem exact, the sack conditional); (6) the fixture `charm_at_iron_ford`, found-by-activity and one `gen:town` reservoir charm; (7) resolutions: kept quietly, informed acceptance, restitution, rota, buried, destroyed, returned at a tribute hearth; (8) the `charm` detector, levels 1–3 plus Closed and Truth, with milestones.

**Acceptance:**
1. `just check` is green, with reasons for golden diffs.
2. **Conservation:** every fae transaction passes §1 rule 3 over 64 seeds × 60 days and a year run; flour moves in whole pounds with spoilage carried; empty-source and full-sack dawns move nothing and spend no virtue.
3. **Discovery:** undetected draws create no misfortune, memory or belief; a count finds cumulative loss once, and later counts add bounded evidence only; an informed, agreeing household records nothing new.
4. **The loan gate** (§6.1) passes with no Commands and is remembered by both households and a witness.
5. **Causal ablations** on the fixture, 64 seeds × 60 days each, with no stage-driven intervention: *prevent disclosure* (no witnesses) drops `talked` and `coveted` to near zero while draws continue; *remove shortage* (pantries above horizon) measurably drops covet acts and loans; *reveal the source early* (`draws_from` at 70 on day 4) raises `bane` and restitution and lowers hired-man attributions; *honor loans* (maximal loan `duty`) removes breaches and restitution grudges and raises rota closures.
6. **Spread, reported, not gating:** level 2 in 30–90% of seeds, level 3 in 10–60%, ≥ 15% closing peacefully, ≥ 4 resolution kinds.
7. **Readiness:** `planReadiness` leaves the world hash unchanged and its output identical whether hidden sources hold flour or not; Rain-Hem's forecast matches execution on both trip profiles; unverified claims never enter.
8. **Culpability:** after Clara Stoughton tells what she found, some holders retract the hired-man attribution and some don't; `kept_drawing` forms only after a warning.
9. **Attachment:** a keeper at 90 with `honesty` ≥ 60 keeps a weekly rota for a game-year.
10. **Iron:** a loan's due date passes while the charm is sealed and still fires; nothing recharges sealed.
11. **Persistence:** replay, forks and mid-arc save/load are bit-identical, `findNonIntegers` is empty, and in a year run the epilogue's numbers stay right after the source events and early facts are gone.
12. **Fairness:** fair mode leaks no truth, source, case, `boundTo` or concealed attribute through text, ids, actions or Explain arithmetic.
13. **Agency:** across 64 seeds, a commanded PC never ties, lends, gives, hides, takes or answers a request without a Command or granted standing order.
14. **Balance:** a `--years 1` fixture run reviewed month by month (`stats.csv` hunger, cash, kcal; draws per source) in the slice report.
15. **Performance:** the §7.3 budget.

**Playtest gate (fair mode):** the fixture, `iron_ford` 42 and `gen:town` 1–10, with ADR 0002 reports that say whether the run produced a story worth retelling. **Socialite:** takes a side and explains the dispute through needs, evidence and promises. **Catalog kid:** Rain-Hem changes a packing decision (hem or oilcloth vs. a cold-iron knife) and stays worth carrying. **Exploit hunter:** fails to mint flour or cents, farm virtue, or launder a draw through a loan. **Greenhorn:** uses `fae.use`, `signs` and pending-request prompts unaided.

---

## 9. Later slices [PROPOSAL]

**Slice 2: the arc widened.** The Creel, Kettle, Lantern, Clew and Mending Needle, each fully specified and checked against a gear alternative on two trip profiles (with iron load and recharge access); the Butter-Print once provisions churns butter. Quirks `chooser`, `counted`, `homing`, `aura`, `sings`, `cold`; strings `toll`, `return_loaf`, `reclaim`, with a use–seal–deadline–unseal test per transfer rule. Thinning through Incursion with a sub-hour time policy; livestock once animals behave. The full reservoir, strays, anchors and pre-roll. `confiscate`, `sue_replevin`, and the press as a belief channel. Tune Rec 10 from slice 1b data.

**Slice 3: learning fae magic and the Tally.** The §4.3 grades, exercises and hypotheses; a cunning-folk mentor, *The Long-Hidden Friend* and studied charms; 8 small and 2 greater workings, two feats and the Hedge Dabbler rider; the check and misworkings; the Tally with calling records and valued offerings ("sold on" emits a bargain-offer event until the Prince exists); Drift storage; practitioners and `teach_working`; *Wake the Virtue* and *Send It Home*. **Acceptance:** (1) the four peoples learn the same small working under equivalent prerequisites; (2) a PC with the prerequisites (Fae Courtesy 1, Hedge Dabbler, Medicine 1) learns Stop Blood from Loveday Trevenna within 4 game-weeks through her lessons alone, with no bargain or book, and never stalls; (3) every DC term is Explained, and the Tally is in band words below Lore (Fae) 4; (4) a failed hypothesis can be tested, refuted and corrected; (5) an NPC learns a working and later teaches it unprompted; (6) braucher-first is measured: over 64 seeds × 1 year, practitioners are top-3 candidates in ≥ 30% of their settlement's uncanny misfortunes, with the true-culprit share reported; (7) the Tally can't be farmed: repeated songs hit the seasonal discount, a threshold crossed twice makes one calling, a default fires once, a sold debt sits on one ledger, and a 10-favor Thorn debt invites the Debt Origin only with desperation; (8) iron, bearer weakness, congregation and Pact stay separate systems. Playtest gate: Roleplayer, Catalog kid, Exploit hunter, and a **Witch-preview** persona who runs a dabbler into debt and sees the bill coming.

**Slice 4: agency transfer, heavy strings, the Director.** `setAgency`; the Rush Bridle and *Borrow the Hands*; the `compulsion` policy (Rec 5) and `struggle`; Fossegrim's String. The River's Token and Huldra's Comb behind toggles (Rec 12). N13 (Rec 9, with M7), the Night Market, `gift_test`, Hall chests, Under the Counter (Rec 13). The Hollow Penny (§5.8), the Still-Water Glass, Seed-Corn, rungs 4–6, witch charm-sowing and backlash (M8), Ballads. **Acceptance:** a bridled NPC obeys only its rider, through `authorizeAct`, and returns to `psyche` mode at dawn, iron or running water; its dream names the rider; with `capped`, the PC's bridling needs a `01` forfeit, is disclosed, saves every 2 h and lasts ≤ 6 h; with `off`, it produces only thoughts; a charm dispute can produce a playable release journey with stable Commands.

---

## 10. Decisions for Ellie

> **[DECISION] 2026-10-11 (Ellie): all thirteen recommendations below are approved as written** ("that all sounds delicious, let's do it!"). Treat each *Rec* as decided; the alternatives are kept for the record. Bracketed post-review notes say where each is now specified; none changes a decision.

1. **Conservation rule.** No fae effect creates kcal, cents or stacks; goods move from a named source, and soft goods are borrowed. *Rec: yes.* It's the theme, P8's integrity and the epilogue's best line. [Executable form: §1 rule 3; "stacks" means item quantity.]
2. **The check for fae workings:** Fae Courtesy, a new "Hedgecraft" skill, or Spellcraft? *Rec: Fae Courtesy*, with craft prerequisites per working. It already exists, it's CHA like fae casting, and "magic as manners" is the setting.
3. **The Tally:** a debt per court, in fae state now and on `04`'s Obligation ledger once court actors exist, or its own meter? *Rec: the ledger path.* No new currency, and the debt is socially legible. [Per counterparty, including the River: §4.6.]
4. **Witch recruitment by debt.** Is a sold-on Tally the main way NPCs, and a dabbling PC, meet the Debt Origin? *Rec: yes.* It makes `06` §5.1 simulated.
5. **Agency-changing effects on the PC.** `fae_compulsion_on_pc` = `off | capped | full`. *Rec: `capped` by default:* forfeit basis required, ≤ 6 h, a save every 2 h, full disclosure, `struggle` available. NPCs are always subject (P2). Attachment and allure never override a Command. [Stored as the actor's own `compulsion` policy, set from this World setting at creation: §2.2. Ships in slice 4.]
6. **Do stored charms work at FI 0?** *Rec: yes, definition by definition (`minimum_fi`).* Recharging stays place-bound, so charms carry Faerie into town, which is the point.
7. **Must every useful charm hide a harmful price?** *Rec: no.* Keep a share of fair bargains (Rain-Hem, the Mending Needle). Usefulness should survive identification, and cooperation is also a story.
8. **Charms thin their town** (the `aura` quirk: local FI +1 and thinning +2/day, with iron cancelling). *Rec: yes, capped.* It's the macro loop that makes a charm a town's problem.
9. **Director windfall:** N13 as a compound nudge on *pre-existing* reservoir charms only. *Rec: yes.* `05`'s no-creation prohibition holds.
10. **How disruptive by default:** one county charm thread every 6–8 weeks, one per settlement every 1–2 years, with severe escalation conditional on existing tensions. *Rec: yes as the starting tune.* Tune it after the slice 1 seed-spread data.
11. **The Cold Stair.** Its FI 3 contradicts "a refuge from fae". *Rec: set it to FI 1 with `algific`*, so it yields Ice signs only and is a real refuge on the map.
12. **Heavy strings.** River's Token (a death toll), Huldra's Comb (love glamour), the Rush Bridle (agency). *Rec: on by default behind World toggles*, with deaths off-screen and the comb under `06`'s seduction toggle (consistent with `06` Q42).
13. **Under the Counter.** May Gussie Pratt hold one secondhand charm at a time, with no charm ever stocked by type? *Rec: yes.*

**Decided 2026-10-11 (Ellie):** object-mediated harm under the Forfeit Rule is **per-charm data** (`harm_basis = instrument | fae`, §1.1), an amendment to `01` §4.5.

---

## Appendix A. Revision notes

### A.1 Synthesis

**Draft A** is Claude's; **Draft B** is Codex GPT-6 Astra's. Both agreed on no ancestry gate, the narrative shape only, no primitivism, Woe as the sole currency, mound exclusion, commanded actors never acting autonomously, and items as belief subjects. **From A:** the twelve lines, ground rules and conservation; thinning and dynamic FI; six-layer descriptions and Signs & Wonders; Fae Courtesy, misworkings, the Tally and witch-by-debt; the charm data model, quirks, claim graph and `drawLedger`; 17 catalog entries; claims, resolutions, player verbs and the chronicle pattern; the schedule slot. **From B:** the three kinds of sign, four windows and signatures; read DCs and notice modifiers; learning grades and hypotheses; typed effects, `minimum_fi`, study facts and string transfer rules; the desire formula; verified vs. unverified Readiness; economy realism, loans as promises and shared custody; three honest charms (Rain-Hem, Mending Needle, Measure That Agrees); the fair-vs-full Explain split. **New in synthesis:** the "fae charm" naming, agency classes, the Rush Bridle, `court` → `fae_court`, and the corrected stray rate (A's gave ~33 a year against a stated ~3).

### A.2 Revision 2026-10-11 (critique)

Codex GPT-6 Astra's adversarial review produced 19 findings. Each was checked against this doc and the code it cites; all were valid in substance, and part of one was declined.

| # | Finding | Handling |
|---|---|---|
| 1 | No item-specific action path (H) | §6.1: a seven-step chain; typed `itemId` and `terms`; NPC decisions via Command resolvers; the loan gate first |
| 2 | Arbitration filter doesn't enforce agency (H) | §2.2: default-deny `authorizeAct` in every executor, standing capabilities, `Command.issuer`, pending requests. **Declined in part:** `capped` stays the PC default (Rec 5), now an actor property |
| 3 | Omen key not lazy-invariant (H) | §3.3: canonical time, `ctx.rngAt`, eager snapshot resolution, persisted episodes and observers |
| 4 | Every draw makes a grievance (H) | §5.2: private cases, discovery by count, shortage or trace, one bounded `stock_short`, informed acceptance |
| 5 | Conservation's units and boundary (H) | §1 rule 3: units and cents over named accounts, splitting allowed, 10 whole flour units; a new law; Rec 1 annotated |
| 6 | Readiness not knowledge-safe (H) | §5.7: filtered input, projected charge state, exact vs. conditional output, hash and hidden-source tests |
| 7 | Eight charms aren't one wave (H) | Slices 1a and 1b; the rest to §9; one owner per record; runtime-place claim corrected |
| 8 | Mutation and culpability (M) | §5.3: derived claim predicates; `benefited_from`, `kept_drawing`; refutation separate from accusation |
| 9 | Attachment as a hidden stage (M) | §5.6: a competing preference; utility by claim group; a year-long rota test |
| 10 | Canon changes unflagged (M) | §1.1: "counterparty"; no new forfeit; DCs mirror `02` §10.4; one amendment flagged; tribute-hearth returns; one `effectiveFi` |
| 11 | No investigation verb; grinding (M) | §3.9: `investigate`, one lead per episode, one cached attempt per actor, evidence-gated closure; categorical roll; finds per actor-hour |
| 12 | Iron storage freezes obligations (M) | §5.4: sealing stops objects, not deadlines |
| 13 | Hollow Penny resale (M) | Slice 4: 10¢, an instrument record, a defined dawn debit, spend vs. sell, fraud memory |
| 14 | Capacity and charge rules (M) | §5.8: full 1b specifications and gear checks; Creel, Kettle and Clew fixed |
| 15 | Tally conversion loop (M) | §4.4, §4.6: round-up halving, valued offerings with repeat discounts, calling records, transferring sale |
| 16 | Learning contradictions (M) | §4.3: Small Courtesies removed; authored exercises; bargains teach, not qualify; its own slice 3 |
| 17 | Prescribed institutional failure (M) | §0 line 11, §6.5: competing, sometimes effective responses; no preferred ending |
| 18 | Protected sites not executable (M) | §1 rule 8: one shared check with precedence on every path; distinct barrow vocabulary and geometry |
| 19 | Frequency over causality (M) | Causal ablations (§8); closure (§6.6); milestones (§6.7); pinned budget (§7.3); year runs; ADR 0002 reports |
