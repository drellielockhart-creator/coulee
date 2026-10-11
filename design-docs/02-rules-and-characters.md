# Coulee — Rules & Characters (the "Player's Handbook")

> **Revision 2026-10-10** (integration pass against `00` P6–P8, `adr/0001`, `09`, and the new `07`, `10`, `11`, `12`). What changed:
> - **Peoples (C5).** §12 now covers the four canon peoples (human, elf, shadow-faekin, goblin) per `12`, with a revised TOML schema, rules hooks for each field, and the concealment/Explain rule. Placeholder peoples are gone. Josiah and Grete are now human.
> - **Alignment → psyche (P7, C3).** Will = base + WIS + **Composure** (`10` §5.3). Morale is a Will save that books anxiety, and Panicked is a `10` Fit. Combat intent and the NPC policy chooser read ego arbitration. New Calling **Dream-Reader**; Hardships and feats hooked to `10`. Faith standing, temptation/terror tags, and a Protection-from-Evil analogue keyed to live urges (Hedge of Good Intent).
> - **T0 clock (C21).** §7 is restated in integer **tenths of a game-second** (0–599 within the canonical game-minute), per `07` §3.4.
> - **Witch weaknesses (C27).** *Unhallowed* is removed. The Witch, Fae-Touched and the Iron-Sick Hardship now feed **weakness offsets** into `06`'s Drift-keyed triggers, with `03`'s Iron Presence as an input.
> - **Curse DC (C29).** §10.6 sets one formula for `06` to use. Protections and the catalog stay with `06`; witch power (C30) is clarified.
> - **New skill: Gather Information** (gap #1, C20), §4.5. Lore (Old Peoples) is renamed **Lore (History)** (C10); Lore (Mental Philosophy) and Trade (Cartography) are added.
> - **Weapons and armor (gap #2, C35).** §9.10 stats `03` §6.7–6.8's arms and armor.
> - **Survival hooks (C22–C26, C38, C48).** C(STR) table (§11.1); stage effects keyed to `05`'s thresholds and the code's 0–1000 needs; scurvy and lean-diet conditions; one **Bound → Longing → Wasting** chain for fae food (§11.2). Wet no longer double-counts against cold.
> - **Determinism (C49).** §1.4 restates every non-integer formula here (the CR ×1.5 XP curve, compound exposure, initiative delay) as integer/fixed-point.
> - Also: Mountebank aliases become Personas/Figures (C47); Hard Reputation reads `04` notoriety directly (C42); charm prices cut ~10× (C34); backgrounds deferred to `06` (C31); a magic Fae-intensity curve offered (C17); dice math errors in §1.3/§14 fixed; worked-example names marked illustrative (C7). Implementation notes against today's code are in §16.

**Status:** Second draft. Builds on `00-vision-and-pillars.md`, which wins wherever the two disagree, and on `adr/0001-typescript-stack.md` for stack, determinism, and the clock. Cross-references go to `01-setting`, `03-gear-and-economy`, `04-social-simulation`, `05-world-sim-and-storyteller`, `06-game-modes`, `07-architecture-and-prototype`, `10-psyche`, `11-interface-and-platforms`, `12-peoples`, and `09-consistency-notes` (C-numbers).

**Tags:** **[DECISION]** follows directly from 00, the ADR, or Ellie. **[PROPOSAL]** is this doc's suggestion and is open to change. **[OPEN]** needs Ellie's input. Where this doc pushes back on 00, it says so in a **Challenge to 00** box.

**What this doc owns** (`09` §3): abilities, skills, feats, classes, Callings, XP, checks and DCs, saves, conditions, combat stats (including reload), wounds, morale, carrying capacity C(STR), magic engines and the spell catalog, the curse DC formula, per-victim disease mechanics, deficiency conditions, the fae-food condition chain, and the ancestry *schema*. It does **not** own the psyche (`10`), peoples lore and values (`12`), fae weaknesses and Drift (`06`), encumbrance bands, item fields and prices (`03`), burn rates and epidemiology (`05`), or persecution (`04` §9).

**Licensing:** The mechanical structures come from the 3.5e SRD under the OGL. All text here is new. Names of classes, feats, and spells are original or plain English, and no non-SRD proprietary names are used.

---

## 1. Design philosophy

### 1.1 What we're building
This is a rules engine that has to be three things at once:
1. **A PHB you can browse.** You can read every number, and every option is something you could shop for (00's catalog feeling).
2. **A simulation kernel.** The same functions resolve the player's Swim check, the farmhand's Swim check, and the county's drowning rate (P1, P2, P3).
3. **A real-time-with-pause tactics layer** on a RimWorld-style tile map, playable with thumbs on a phone as well as on a desktop (`00` P6, `11`).

Every rule here returns an `Explain` record (ADR invariant 5), so the "show the math" promise holds on a phone too: no rule may depend on information that only a hover tooltip could show (`11` §1.7: the UI asks, the core answers).

3.5e is already very good at (1). It does (2) fairly well by accident, because 3.5 NPCs really are built like PCs. The NPC classes, Profession checks, and DMG economics read like a simulationist's notes. It is poor at (3). Most of our changes come from (3) and from the LOD tiers.

### 1.2 Keep / change / drop

| 3.5e element | Verdict | Why |
|---|---|---|
| Six ability scores, (score−10)/2 modifiers | **Keep** [DECISION] | 00 names this. It's familiar, legible, and every NPC can carry it cheaply. |
| d20 + mod vs. DC | **Keep** [DECISION] | It's the core of legibility, and you can compute a success probability for it exactly (important for T1/T2). |
| Skill ranks, class/cross-class, synergy | **Keep, add practice** [PROPOSAL] | Ranks feel good to buy. Practice lets NPCs who never adventure still become good at their trades (P2). |
| Feats as discrete purchases | **Keep and expand** [DECISION] | This is the "catalog" core. We add many non-combat, trade, and fae feats. |
| Classes, multiclassing, prestige classes | **Keep** [PROPOSAL] | It's the charm. Prestige classes get sim-native prerequisites (relationships, deeds, memberships). |
| HP | **Split** into Vigor (HP) and Wounds [PROPOSAL] | HP alone can't support RimWorld-style located injury, infection, or maiming. Wounds alone lose D&D's heroic buffer. |
| 6-second rounds, initiative order, action economy | **Replace** with timed actions [DECISION per 00] | The game is real-time-with-pause. We keep 6 s as the unit of the "round" for rule conversions. At T0, actions are scheduled in integer tenths of a game-second inside the canonical game-minute (§7, C21). |
| Attacks of opportunity | **Keep, simplified** [PROPOSAL] | Provoking makes reloading in melee terrifying, which is exactly what black powder needs. |
| Vancian spell slots | **Keep for arcane/divine; vary by tradition** [PROPOSAL] | Slots are easy to simulate and very PHB. Folk and fae magic get different engines so each tradition feels distinct. |
| Alignment | **Drop; replaced by the psyche** [DECISION, Ellie 2026-10-10, `00` P7] | A "Lawful Good" tag on a sheet is a special case that the psyche (`10`) and the social sim (`04`) do better. Where 3.5 read alignment, we read live state: Will and morale add **Composure** (§3.7), magic that cares about "evil" keys off the target's *current arbitrated urge* or specific deeds and allegiances ("sworn to a Court", "has cursed"), and Faith standing reads violated church-sourced norms (§10.1). No class or Calling has an alignment-like gate. |
| Races | **Replace with four data-driven peoples** [DECISION, Ellie 2026-10-10] | Humans, elves, shadow-faekin, goblins (`00`). `12` owns their lore and values; this doc owns the schema and how each field enters the rules (§12). No hardcoded peoples in sim code (ADR invariant 4). |
| CR and XP by encounter | **Keep in spirit** [PROPOSAL] | XP for *overcoming* threats, including driving them off, plus peril, discovery, livelihood, and story. See §6.6. |
| Levels 1–20 | **Cap at 12 for v1** [PROPOSAL] | Low and mid levels are gritty and fit the frontier and firearms. Level 12 is a local legend. See §6.5. |

### 1.3 The Resolution Contract (the LOD problem)
Every rule in this doc must specify how it resolves at each tier. This is the most important engineering constraint in the document. **[PROPOSAL]**

| Tier | How rules resolve |
|---|---|
| **T0 Live** | Each action is resolved individually: individual d20 rolls, per-tile modifiers, timed actions, located hits. |
| **T1 Nearby** | Each **Activity** (00) resolves as a few rolls using the *same* check function with *aggregated* inputs: average conditions over the block, the number of exposures, and a take-10 policy. Outcomes fall into **bands** (e.g., Fine / Setback / Hurt / Disaster). |
| **T2 Distant** | No dice per actor. Rates are computed from the same probability function applied to population skill distributions. For example: P(drown per ford crossing) × crossings per season × population. |

**The equivalence rule:** For the same situation, the distribution of T1 outcomes should match the distribution of T0 outcomes within a tolerance (target: ±5 percentage points per band). We get there by **calibration rather than hand-tuning**. 07 should include a harness that runs T0 Monte Carlo on canonical situations and fits the T1 band tables. This works because d20 checks have closed-form probabilities, which is one more reason to keep the d20.

**One API, three samplers.** The core call is `Check(actor, skill, DC, context) → distribution over margin`. T0 samples it once per action. T1 samples it once per activity with an exposure count. T2 integrates it over a population. The rules are written once.

#### Example: the same check at T0 and T1 — climbing a 40 ft bluff path
- **Rule:** Athletics (climb). Moving at ¼ speed, you make one check per 10 ft climbed. Fail by 1–4 and you make no progress. Fail by 5 or more and you fall from your current height (1d6 per 10 ft, with a Wound check, §8).
- **T0:** Mae (Athletics +4) climbs a wet limestone face, DC 15 (base 10, +5 wet). The game makes 4 checks, one every ~6 s while she climbs. Each check has a 30% chance of a "fall" result: she falls if her total is 10 or less (fails by 5+), which means a natural 1–6. The rolls go 13 (17, up to 10 ft), 15 (19, up to 20 ft), 5 (9, fails by 6) → she falls from 20 ft: 2d6 Vigor, no automatic wound at exactly 20 ft (§8.6). The player watched it happen and could have chosen "Careful" (double time, +2) or "Steady" (take 10; §3.4, not allowed here because the rock was wet and her footing was under stress).
- **T1:** Off-screen, Mae's brother Abel (+4) takes the same bluff path as part of a "go to the ridge field" activity. Per-check fall chance is p = 6/20 = 300‰ and exposure is N = 4, so P(at least one fall) = 1 − 0.7⁴ ≈ 760‰ (computed as `65536 − ipowQ16(65536 − pQ16, 4)`, §1.4). The engine rolls once against that. If he falls, it rolls the height uniformly over 10–40 ft and resolves the damage and Wound check using the real tables. If the sheet had a rope and he knew to use it, the policy layer would have chosen Careful or a safer route, as an actual person would. That is the point: **T1 agents also choose risk policies**. They don't just take outcomes.

The result is the same. The cost is roughly 1/50th of the CPU.

### 1.4 The integer contract (ADR invariants 1–2, C49) **[DECISION: ADR] [PROPOSAL: the restatements]**
The core bans transcendental `Math` (`exp`, `log`, `pow`, `**`, trig) because engines can disagree in the last bit, and it stores integers only. d20 rules are friendly to this: a single check's probability is exactly `count / 20`. Everything in this doc is integer or fixed-point, using `07` §4's kit (per-mille probabilities at the roll site, Q16 fractions, offline-generated tables). The places where a 3.5-style rule would naturally reach for a float or a power, restated:

| Rule | Natural form | Integer form | Approximation note |
|---|---|---|---|
| Single check odds (T1/T2) | P = successes / 20 | per-mille `= 50 × count` | Exact |
| Compound exposure (§1.3, §14.4, disease contacts) | 1 − (1 − p)^N | `65536 − ipowQ16(65536 − pQ16, N)` by square-and-multiply with `mulQ16` (`07` §4.3(5)), then to per-mille | Under 1‰ error for N ≤ 64 |
| XP by CR difference (§6.6) | 300 × level × 1.5^(CR − level) | `floor(300 × level × XP_MULT‰[Δ] / 1000)`, table below | The table *is* the rule; 1.5^Δ rounded to the nearest ‰ |
| First-action delay (§7.2) | max(0.3, (30 − Init) × 0.1) s | `max(3, 30 − Init)` tenths | Exact |
| Halving (WT vs. Wounding, Staggered at CON/2) | x / 2 | `floor(x / 2)` | Exact (3.5 rounds down) |
| Average hit die (§6.2 option) | (d + 1) / 2 | `floor(d / 2) + 1` (d4 → 3, d6 → 4, d8 → 5, d10 → 6, d12 → 7) | Rounds the .5 up, always |
| Practice cost with INT (§4.4) | 20 × r × (1 − 0.1 × INT) | `ceilDiv(20 × r × max(50, 100 − 10 × INTmod), 100)` | Exact |
| Skirmish Threat Value (§14.4) | E[dmg/6 s] × E[rounds] | Expected damage in **tenths of a point** per 60 tenths × rounds-to-break, integer products, cached per pairing | Built from exact per-mille hit odds |

`XP_MULT‰` (Δ = CR − level): −4 or less: 0 · −3: 296 · −2: 444 · −1: 667 · 0: 1000 · +1: 1500 · +2: 2250 · +3: 3375 · +4: 5063 · +5 or more: 7594 (cap).

Randomness at T0 draws with `tick = T0Instant` (minute × 600 + tenth), so two attacks in the same game-minute never reuse a d20 (`07` §3.4).

---

## 2. Ability scores

### 2.1 The six **[DECISION: keep six] [PROPOSAL: keep names]**
We keep **Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma**. Renaming them (Brawn, Grit, Wits...) would make them more flavorful but less legible, and it would cost the instant PHB recognition that 00's catalog feeling depends on. We adjust what they *cover*:

| Ability | Covers | Drives (sim-relevant) |
|---|---|---|
| **STR** | Muscle, lifting, hard labor | Melee attack/damage, carrying capacity (3.5 table kept; see 03), Athletics, grappling, labor output at T1 (chopping, plowing rates) |
| **DEX** | Coordination, hand speed, balance | Defense, ranged attack, Reflex, initiative/reaction, reload speed modifiers, Stealth, fine crafts |
| **CON** | Health, stamina, resistance | Vigor per level, **Wound Threshold**, Fortitude, disease/infection/cold, hold breath, Wound Burden limit, aging resilience |
| **INT** | Learning, reasoning, memory, schooling | Skill points, Lore, Trade (craft side), arcane casting, **practice speed** (§4.4), literacy acquisition |
| **WIS** | Awareness, judgment, steadiness | Perception, Will, Read People, Woodcraft, divine/folk casting, resistance to fae *misdirection*, and the **seed of Self-Command** (`egoStrength`, `10` §3.1), which drives Composure on Will and morale (§3.7, §9.8) |
| **CHA** | Force of self, presence, how hard you are to ignore | Social skills, fae/witch casting, **fae notice** (fae perceive high-CHA mortals more vividly, both for good and ill), starting opinion intensity in 04 (CHA scales how *strongly* people feel about you, not *whether* they like you) |

**[PROPOSAL]** CHA as *intensity rather than valence* is a deliberate interface with 04. Charisma makes first impressions stronger in both directions. Whether that impression is good is decided by traits, deeds, and context.

**[PROPOSAL] WIS seeds the psyche, it doesn't replace it (C3).** `10` seeds `egoStrength` as `40 + 4 × WIS mod + floor(level / 2) + upbringing + traits` (clamped 5–95), and from then on it drifts with the actor's life: harrowing events, starvation, and Drift lower it; individuation and mature defenses raise it. So WIS is a starting temperament, and a high-WIS character can still be worn down. The mind itself (drives, norms, anxiety, defenses) is `10`'s, and this doc reads only two numbers from it: **egoMod** and the **anxiety band**, combined as Composure (§3.7). No ability score is a psyche stat, and no people modifies INT, WIS, or CHA (`12` §1).

### 2.2 Generation **[PROPOSAL: three options, player's choice at creation]**

| Method | Procedure | Notes |
|---|---|---|
| **Outfitter's Standard** (default) | 25-point buy, 3.5 cost table (8 = 0, 14 = 6, 16 = 10, 18 = 16) | Balanced and predictable. Good for the first run. |
| **Homestead Roll** | 4d6 drop lowest, ×6, arrange freely. Reroll if the total modifier ≤ +0 or no score ≥ 14 | The classic. The chronicle notes "rolled". |
| **Hard Country** | 3d6 in order, no rerolls | An ironman-flavored mode for RimWorld veterans. The chronicle flags it. Pairs well with Hardships (§5.4). |

**NPCs [PROPOSAL]:** NPCs are rolled from population distributions (3d6 per score, then shifted by people and occupation priors), then **adjusted by life history**: decades of labor give +1 STR (max 1), schooling +1 INT (max 1), and so on. Occupation priors describe 1855's social structure, not aptitude, and people priors touch only STR/DEX/CON (`12` §1). 3.5 aging categories apply (Middle Age −1 STR/DEX/CON, +1 INT/WIS/CHA, etc., using each people's age thresholds from §12). Census actors are rolled lazily and deterministically from `hash(seed, censusSlot)` when materialized (`07` §5.3), so the same farmer has the same STR whenever she's written down. This makes the county look like a population rather than a set of copies of the elite array. It also means a hardened 50-year-old lead miner really is stronger than you.

### 2.3 Ability increases
+1 to one ability at levels 4, 8, and 12 (3.5 cadence). Abilities can also change through aging, permanent wounds (§8.5: e.g., a lost eye is −2 to ranged attacks and Perception, not an ability drain), severe disease (temporary drain), and fae bargains (06).

---

## 3. Checks

### 3.1 Core resolution **[DECISION]**
`d20 + ability mod + ranks + misc ≥ DC`. Ties succeed. Skill checks do **not** auto-succeed on a 20 or auto-fail on a 1. Attack rolls and saves keep natural 1 = miss/fail and natural 20 = hit/success (3.5 behavior).

### 3.2 Difficulty bands

| DC | Label | Frontier example |
|---|---|---|
| 0 | Trivial | Notice a gunshot 100 yd away |
| 5 | Easy | Wade a calm riffle knee-deep |
| 10 | Routine | Start a fire with dry tinder; haggle a fair price |
| 15 | Challenging | Ford a swollen creek; track a deer over leaf litter after a day |
| 20 | Hard | Swim a flooded creek in spring melt; tell a changeling from the child |
| 25 | Very hard | Track a fox over limestone in rain; talk a lynch mob down |
| 30 | Heroic | Cross the big river in flood; strike a fair bargain with a Court noble |
| 40 | Legendary | Find the green road on a moonless night with no sign to follow |

### 3.3 World-state DCs **[PROPOSAL]**
A DC is **base + a sum of named modifiers pulled from world state**. Every modifier has a source tag, so the UI can show the math (P1 corollary). Typical sources:

| Source | Typical modifier |
|---|---|
| Light: dusk / moonlight / dark | +2 / +5 / +10 (sight-dependent checks). **Low-light vision** (elves, shadow-faekin; §12) reads moonlight as dusk (+2). **Darkvision 60 ft** (goblins) ignores darkness within range, in shades of grey (no color-dependent tasks) |
| Weather: rain / heavy rain / blizzard | +2 / +5 / +10 (outdoor checks) |
| Water: rising / flood stage | +5 / +10 (Swim, Riverwork) |
| Footing: wet, mud, ice | +2 / +5 / +5 (Athletics, Acrobatics, melee) |
| Actor conditions | Fatigued −2, Chilled −2, Drunk −2 to −6, Shaken −2 (as penalties on the roll, not on the DC) |
| Tools | Masterwork +2; improvised −2; no tools −4 (for crafts, Medicine, Tinkering) |
| Help | Aid Another +2 per helper who beats DC 10 (max +6) |
| **Fae intensity** | +0 to +10 on *mundane* Wayfinding and Woodcraft (the wilds lie to you); −0 to −10 on *fae*-tuned checks (Fae Courtesy) |

### 3.4 Time policies (take-10/20 for a sim) **[PROPOSAL]**
Every skill use has a **base time**. Actors (player and AI) pick a **policy**:

| Policy | Time | Effect | Allowed when |
|---|---|---|---|
| **Rush** | ×½ | −5 | Always |
| **Normal** | ×1 | Roll | Always |
| **Careful** | ×2 | +2 | Not in combat |
| **Steady (take 10)** | ×1 | Result = 10 + mod | No threat present and no stressor condition (Shaken, Bleeding, In Water over chest-deep, Exhausted) |
| **Work It Through (take 20)** | ×20 | Result = 20 + mod | Failure costs nothing but time (searching, picking a lock with no one around, finding a crossing) |

For the sim, this is a gift. Take-10/20 are already "time spent → reliability" conversions. At T1, Steady is the default policy wherever it's allowed, which makes most routine activities deterministic and cheap. **[PROPOSAL]** The policy choice is an ordinary option set in the Ego's arbitration (`10` §5.2). Reality appraisal `R` uses the exact per-mille odds of each policy against the stakes and time budget, and the voices push: loud `fear` favors Careful or turning back, loud `sloth` or `hunger` favors Rush, and a weak Self-Command lets the loudest voice win. Traits act through drive weights (a "Reckless" trait lowers `fear` and raises `idAppetite`; "Cautious" does the reverse). The PC picks policies directly; the arbitration's verdict is advisory (`10` §5.5).

### 3.5 Margins
Many rules key off the margin in steps of 5 (3.5 style): **fail by 5+ = bad failure** (fall, capsize, get caught), **beat by 10+ = exceptional** (extra yield, half time, a rumor about your skill). At T1 the band tables are built from these margins.

### 3.6 Opposed checks
Both sides roll and the higher result wins. The defender wins ties. Passive opposition (an unaware sentry) uses **10 + mod** for the passive side, so a sleeping camp is cheap to resolve at T1. Common pairs: Stealth vs. Perception, Deceive vs. Read People, Bargain vs. Bargain, Grapple vs. Grapple, Tracking vs. Woodcraft (covering a trail).

### 3.7 Saves
Fortitude (CON), Reflex (DEX), Will (WIS). Base save from class (good: 2 + floor(level/2); poor: floor(level/3)). DCs for effects = 10 + effect level + relevant mod, as in 3.5.

**Will reads the psyche [DECISION: P7; PROPOSAL: the formula, from `10` §13.1]:**

`Will = base save + WIS mod + Composure`, where **Composure = egoMod − anxiety band**.

| `egoStrength` (Self-Command) | 0–19 | 20–39 | 40–59 | 60–79 | 80–100 |
|---|---|---|---|---|---|
| egoMod | −2 | −1 | 0 | +1 | +2 |

| Anxiety (Nerves) | 0–199 Easy | 200–399 Uneasy | 400–599 Nervous | 600–799 Harrowed | 800+ Breaking |
|---|---|---|---|---|---|
| band | 0 | 1 | 2 | 3 | 4 |

Composure therefore runs from +2 (a steady, rested mind) to −6 (a weak ego at the breaking point). It's an integer read of two stored integers, and the Explain shows both terms ("Self-Command +1, Nerves −2"). WIS enters twice on purpose: directly as the save's ability, and faintly through egoStrength's seed (`4 × WIS mod` is worth about one egoMod step at creation). The overlap is small, and it's what lets a life change someone's Will without touching WIS (§2.1).

**Temptation vs. terror [PROPOSAL, `10` §13.1].** Effects carry a tag:
- `temptation` (Fair Words, Patter, fae food offered, bribes, the soul-image glamour): the save adds `floor((superegoStrictness − 50) / 25)`, so −2 to +2. A rigid conscience resists temptation.
- `terror` (morale, Dread creatures, Rebuke the Unquiet, The Boast, hag-riding): Composure only. A rigid conscience gives no help against fear, and shame (moral anxiety) makes it worse through the band.

**Who has a psyche.** People and named animals use `10`'s numbers. **[PROPOSAL, for `10` to confirm]** Beasts carry an `egoStrength` in creature data (a wolf ~30, a draft horse ~45, the hodag ~40) and anxiety from `fear` only, with no defenses. **Fae** have `egoStrength` 0 and no anxiety (`10` §10), but their Law isn't weakness, so **fae use Composure 0**. Their resistance is in their Law: they can't be talked out of a bargain, and they don't panic, though they can withdraw.

---

## 4. Skills

### 4.1 The list **[PROPOSAL]**
There are 29 skills plus three open families (Trade, Lore, Perform). The design goals: split "Survival" into its interesting parts, merge 3.5's perception and stealth pairs, which are bookkeeping noise in a real-time game, and add the frontier and fae verbs. **(T)** = trained only: you can't use it at 0 ranks except at DC ≤ 10.

| Skill | Abil | What it does | 3.5 ancestor |
|---|---|---|---|
| **Athletics** | STR | Climb, jump, run, lift-and-heave, chop | Climb, Jump |
| **Swim** | STR | Stay up, make headway, dive, rescue. Armor/load penalty ×2 | Swim |
| **Acrobatics** | DEX | Balance, tumble, escape bonds, keep footing on logs and ice | Balance, Tumble, Escape Artist |
| **Ride** | DEX | Horse, mule, ox-cart handling under stress | Ride |
| **Stealth** | DEX | Hide and move quietly as one skill | Hide + Move Silently |
| **Sleight of Hand** | DEX | Palm, pick pockets, cheat at cards, sneak a reload | Sleight of Hand |
| **Tinkering (T)** | INT | Locks, traps, mechanisms, firearm repair in the field | Disable Device, Open Lock |
| **Perception** | WIS | Notice by sight, sound, smell. Search is a timed action using this | Spot, Listen, Search |
| **Woodcraft** | WIS | Forage, shelter, fire, weather sense, camp, avoid natural hazards | Survival (part) |
| **Wayfinding** | WIS | Route-finding overland and underground; not getting lost; resisting fae misleading | Survival (part) |
| **Tracking (T)** | WIS | Follow and read sign; age a trail; count a pack | Survival / Track feat |
| **Trapping** | INT | Set and run snares and traplines; find and avoid traps in the wild | Survival/Craft (part) |
| **Fishing** | WIS | Rod, line, net, and weir; read trout water; ice fishing | — |
| **Riverwork** | STR or WIS* | Ford, pole, paddle, raft, read current and ice, handle skiffs and keelboats | Profession (sailor), Survival |
| **Animal Handling** | CHA | Calm, train, drive, pack, and doctor-adjacent care of animals | Handle Animal |
| **Herbalism (T)** | WIS | Identify, gather, and prepare medicinal, poisonous, and magical plants | Craft (alchemy)/Heal/Survival |
| **Medicine (T)** | WIS | Bandage, set bones, treat infection and disease, deliver babies, surgery | Heal |
| **Bargain** | CHA | Haggle, appraise in trade, read a market | Appraise + Diplomacy (trade) |
| **Persuade** | CHA | Change minds, calm, rally, make requests | Diplomacy |
| **Deceive** | CHA | Lie, bluff, feint, sell snake oil | Bluff |
| **Intimidate** | CHA (or STR**) | Cow, threaten, demoralize | Intimidate |
| **Read People** | WIS | Detect lies, sense mood, notice glamour on a person's *manner*; read another's inner state as a band ("seems torn"), never their thoughts (`10` §4.3); catch a Persona slip (`10` §8.1); read *yourself* for Insight (`10` §8.5) | Sense Motive |
| **Gather Information** | CHA | Ask around: learn what a crowd, crew, or congregation believes, how far a story has spread, and who might know more (§4.5) | Gather Information |
| **Disguise** | CHA | Pass as someone else | Disguise |
| **Fae Courtesy (T)** | CHA | Guest-right, gift protocol, safe phrasing, naming taboos, bargaining with the Fair Folk | — |
| **Spellcraft (T)** | INT | Identify magic, curses, and charms; counter; read spell residue | Spellcraft |
| **Concentration** | CON | Keep a spell, task, or composure going while hurt, cold, or harried | Concentration |
| **Trade (X)** | INT or STR* | Make and work: Smithing, Carpentry, Coopering, Leatherwork, Cookery, Gunsmithing, Milling, Brewing, Farming, Mining, Logging, Teamstering, Blasting, Sewing, Printing, Cartography (surveying and map-making; `05` §1.6's "Cartography/Craft", C20)... | Craft, Profession |
| **Lore (X) (T)** | INT | Fae, Nature, Scripture, Almanac (arcana/astronomy), Local (per settlement), Law & Land, Medicine-history, **History** (the region's nations, treaties, settlement, and wars, as ordinary human knowledge learned from books and from people; replaces "Old Peoples", C10 [PROPOSAL]), **Mental Philosophy** (the period's science of mind; +2 synergy to Read People on inner states, `10` §12) | Knowledge |
| **Perform (X)** | CHA | Fiddle, Song, Preaching, Storytelling, Dance, Oratory | Perform |

\*Riverwork uses STR for poling and paddling and WIS for reading water. Each Trade lists its key ability (Mining STR, Gunsmithing INT, etc.).
\*\*Intimidate uses STR when you're physically looming. The actor uses whichever is better.

**Languages and literacy [PROPOSAL]:** 3.5 Speak Language style. 1 skill point buys a language: English, German, Norwegian, Cornish, French, Welsh, the Native nations' languages (how they appear is `01` §2's decision), the elves' liturgical Old Speech (`12` §5.1, Hall-taught only), and the fae tongues, which need Lore (Fae) 4. **Literacy is separate**: 1 point per script, and it is *not* universal. Literacy gates almanac magic, letters, contracts, newspapers (rumor input, 04), and Bible-reading for the Circuit Rider. **Starting languages and NPC literacy rates come from the actor's *culture* record, never from their people** (`12` §1, §13): a Norwegian Lutheran elf and a Norwegian Lutheran human start with the same languages and the same literacy odds.

### 4.2 Ranks and caps **[DECISION: keep 3.5 ranks]**
- Max ranks = **level + 3** (class skill). Cross-class skills cost 2 points per rank and have a max of (level+3)/2 *when bought with points*.
- Skill points per level: class base + INT mod (min 1). ×4 at first level.

### 4.3 Synergy **[PROPOSAL]**
5 ranks in a skill gives +2 to its partner(s). The chart:

| 5 ranks in... | +2 to... |
|---|---|
| Woodcraft | Wayfinding, Herbalism (finding plants) |
| Tracking | Trapping, Woodcraft (hunting for food) |
| Riverwork | Swim (in current), Fishing (from boats) |
| Swim | Riverwork (when overboard) |
| Herbalism | Medicine (infection, disease), Lore (Nature) |
| Lore (Fae) | Fae Courtesy, Spellcraft (fae magic and curses) |
| Fae Courtesy | Wayfinding (in the Wilds) |
| Bargain | Persuade (about money), Read People (in trade) |
| Deceive | Disguise (acting the part), Sleight of Hand (patter) |
| Animal Handling | Ride |
| Trade (Gunsmithing) | Tinkering (firearms) |
| Lore (Almanac) | Woodcraft (weather sense) |
| Read People | Deceive, Persuade (with that person after a 1-min talk) |
| Lore (Local) | Gather Information (in that settlement) |
| Gather Information | Lore (Local) (in that settlement), Read People (spotting who's lying to the crowd) |
| Lore (Mental Philosophy) | Read People (inner states and Persona slips) |

### 4.4 Advancement: points *and* practice **[PROPOSAL: hybrid]**
**Why a hybrid:** Points at level-up give the PHB shopping moment. But P2 requires that the blacksmith's apprentice becomes a blacksmith by smithing, without ever "leveling" from killing wolves. Pure use-based progression (Skyrim/RuneQuest) kills the shopping moment and invites grinding. Pure points can't simulate a county.

**Practice marks:**
- An actor earns a mark in a skill when they make a check **with stakes** whose DC is in the **learning window**: DC between (their bonus + 3) and (their bonus + 18). That means real failure risk and real success chance. Steady/take-10 uses earn marks only if 10 + bonus < DC + 5, i.e., you're barely clearing it.
- At T1, on-the-job work earns **1 mark per 4 hours** of an activity whose task DC is in the window. Daily cap: 2 marks per skill.
- **INT modifier** adjusts the cost: each point of INT mod reduces rank cost by 10% (min 50%), and negative INT increases it.
- **Cost of the next rank** = 20 × (new rank) marks. Rank 1 = 20, rank 5 = 100, cumulative to rank 5 = 300.
- **Practice ignores class/cross-class.** You learn by doing. It still respects the **level + 3** cap, so practice can never outrun your experience.
- **Self-limiting:** once the work is easy for you, it falls out of the learning window and you plateau. A farmer whose fields need DC 12 stops improving at about +9. That's realistic, and it naturally makes the county's experts rare.

**Calibration target:** a mid-INT apprentice working daily reaches about 6–8 ranks in their trade over ~3–5 years. A PC who fords rivers weekly in spring gets a Riverwork rank every month or two. Points at level-up stay the fast, deliberate path.

**Sublimation feeds practice [PROPOSAL, `10` §5.3].** When the Ego sublimates a frustrated drive into work (rage into splitting rails, fear into cleaning the gun, longing into fiddling), that activity earns **+1 practice mark** on top of the normal rate, still under the daily cap. A troubled mind that copes well gets good at something.

**Livelihood XP:** see §6.6. Lifelong workers slowly gain *levels* (mostly in NPC classes), which raises their caps.

### 4.5 Gather Information (gap #1, C20) **[PROPOSAL: option (a) of `09`]**
`04` and `05` use investigation everywhere: the **Ask around** interaction, the rumor ledger's spread bands, settlement mood numbers, Figure links, and `05`'s traces. It gets its own skill, because investigation is how the player *feels* off-screen depth (`04` §2, the Bad News lesson).

**What it is.** A CHA skill for working a *crowd*: a tavern, a store porch, a work crew, the churchyard after service. Read People handles one face; Gather Information handles many. It returns **what people believe**, as `04` Statements and Overheard evidence. It never returns ground truth (P1).

**Resolution.**
- **Base time:** 1 game-hour of conversation (at T0, a scheduled job; at T1, an "ask around" Activity of 1–4 h). Standing drinks or buying something adds +2 and costs $0.05–$0.25 (`03` prices).
- **DC by prevalence** of the topic among the people present (`04` §8.3's spread, read as the fraction of holders):

| How widespread | Holders present | DC |
|---|---|---|
| Everyone knows | ≥ 75% | 5 |
| Talk of the town | 40–74% | 10 |
| Several households | 15–39% | 15 |
| Only a few | 1–14% | 20 |
| One person, or kept secret | a Secret (`04` §3.5) or a single holder | 25, and the holder may oppose with Deceive vs. your Read People |

- **Modifiers:** +2 synergy from Lore (Local) 5 in that settlement (§4.3); −5 if you don't speak the community's language, and you then reach only its bilingual members (`04` §8.4); −2 if you're an Outsider to them (`04` §5.4 term); −2 to −6 if your Reputation there is bad (`04` §8.6); +2 with the Neighborly feat; +2 when a friend (Trust ≥ 40) vouches for you. Prejudice priors apply as `04` and `12` §11 set them, scaled by the Prejudice dial.
- **Policies:** Steady (take 10) is allowed when no threat is present. **Work It Through is not**, because asking has a cost (below).
- **Results by margin** (§3.5):
  - **Success:** you hear the most prevalent variant of the topic and its **spread band**, as the PC's own Statement-weight evidence. This is what fills `04` §12's rumor-ledger entries and `11` §2.4's spread chips.
  - **Beat by 10+:** you also hear one competing variant and **one hop of the source chain** ("Sophie had it from the editor"), and you learn the settlement's mood words with numbers (`04` §12).
  - **Fail:** you hear nothing useful.
  - **Fail by 5+:** you hear the *juiciest* variant instead of the most common one, at Statement weight, and you don't know it's the outlier.
- **Asking is itself an event.** Every attempt seeds a rumor about the asker ("the stranger's asking about the Vogt spring"), with juiciness scaled by how sensitive the topic is. It raises your notoriety, and if a holder of a relevant Secret is present, it can tip them off. An investigation can warn its quarry.
- **Witch use:** through a cover identity (Persona/Figure, §6.3), a witch can learn her own rung words in a town, which is how she learns of changes when "Show the rung" is off (`11` §2.13).

**At T1/T2.** NPC investigators (a sheriff, a witch-finder, a curious editor) run the same check as an Activity, using per-mille odds and one roll. At T2 there's no per-actor investigation. The rumor model's own diffusion carries knowledge.

**Why a skill and not Persuade + Lore (Local) (option b) or Read People (option c):** Persuade changes minds rather than sampling them, and Read People is one-on-one. A dedicated skill also gives the catalog a "detective" build (Mountebank, Witch-Finder, a newspaper editor NPC) and gives the "ask around" pocket button (`11` §2.12) one number to show.

---

## 5. Feats

### 5.1 Acquisition **[PROPOSAL]**
- **One feat at levels 1, 3, 6, 9, 12** (3.5 cadence), plus class bonus feats.
- **Upbringing feat** at level 1: one free feat from a short list tied to your background ("Raised on a keelboat" → Waterman or Raftsman). This gives level-1 characters a frontier identity. **[PROPOSAL, C31]** `06` owns the single Background table. This doc contributes two columns to it: the upbringing feat list and skill pre-picks. `03` contributes the purse, money form, and possessions. Humans take a second Upbringing feat (§12).
- **Trained feats [PROPOSAL]:** some feats (marked ◆) can also be *learned* in the world from a mentor actor who has the feat. It costs 2–8 weeks of study, $, and the mentor's favorable opinion (04). They count against a separate pool: max one trained feat per 3 levels. This turns NPCs into shopping destinations, and relationships into progression.

### 5.2 Prerequisites can be sim facts
Beyond abilities, ranks, and BAB, a prerequisite can be **a world fact**: "has survived a winter in the Wilds", "has been a guest of a Court", "has killed with a firearm", "has a grudge-holder (04) in three settlements", "has reached individuation stage 2" (`10` §8.5). The engine checks these against the Chronicle and Memory. This keeps feats feeling *earned* by story. **Psyche facts may be prerequisites for feats and Callings, never for a class at creation** (`10` §13.1), and never a stored moral label.

### 5.3 The catalog (37 sample feats)

**Combat**
| Feat | Prereq | Effect |
|---|---|---|
| **Heavy Swing** | STR 13 | Trade up to −BAB on attack for +same damage (two-handed ×2). Axe, maul, musket butt. |
| **Follow Through** | Heavy Swing | When you drop a foe to 0 Vigor, make a free attack on an adjacent foe (once per 6 s). |
| **Light on Your Feet** | DEX 13 | +1 dodge Defense vs. one designated foe; +4 Defense vs. AoO when moving. |
| **Steady Aim** | BAB +1 | Spend 3 s aiming (or rest the barrel on cover): +2 to hit with your next shot and +1 crit range. |
| **Quick Loader** ◆ | DEX 13, proficiency | Firearm reload time −25%; with a paper cartridge, −40%. Stacks with Drill. |
| **Close Shot** | — | +1 to hit and damage with ranged attacks within 30 ft; firing in melee doesn't provoke if you have this and Light on Your Feet. |
| **Bayonet Drill** ◆ | BAB +1 | A musket with a bayonet counts as a reach-less spear; no penalty for switching between firing and fixing. Setting the bayonet vs. a charge = double damage. |
| **Hatchet Thrower** | DEX 13 | Throw hatchets and knives at range increment 15 ft; draw-and-throw as one action. |
| **Brawler** | — | Unarmed d4 → d6 lethal or nonlethal at will; no AoO for unarmed attacks. |
| **Wrestler** ◆ | Brawler or STR 13 | +4 grapple checks; break a hold as a 3 s action. |
| **Cool Head** | WIS 13 or Veteran 1 | +4 on morale saves (§9.8); allies within 30 ft who can see you get +2. Your defense threshold Θ rises by 60 (`10` §6): you carry more Nerves before self-deception kicks in. |
| **Iron Nerve** | Cool Head, has been wounded by a firearm | Don't lose your action to gunfire Deafened/Startled; +2 to hit while under fire. |

**Survival**
| Feat | Prereq | Effect |
|---|---|---|
| **Hard Traveler** | — | +4 on checks vs. fatigue from forced march, hunger, thirst; sleep in your clothes without becoming Fatigued. |
| **Winter-Hardened** | Has survived one winter outdoors or CON 13 | Treat the temperature band as one step milder for cold; +4 vs. frostbite. |
| **Iron Gut** | — | +4 Fort vs. foodborne illness, spoiled food, bad water; eat raw meat without Sickened. |
| **Waterman** | Swim 1 | +2 Swim and Riverwork; hold breath ×1.5; +4 vs. cold shock. |
| **Sure-Footed** | DEX 13 | Ignore the mud/wet footing penalty; +2 Athletics climb. |
| **Pack Mule** | STR 13 | Carry capacity as if STR +4. Load penalties to Swim are halved. |
| **Fire in the Rain** | Woodcraft 4 | Start fires in wet conditions at normal DC; fires you build need less fuel (−25%). |
| **Light Sleeper** | — | Perception at −2 (not −10) while asleep; wake instantly ready. |
| **Bee-Liner** ◆ | Tracking 2, Perception 2 | Find wild hives by following bees. 1 hr, Tracking DC 15 → honey and wax (sell or eat). +2 Tracking flying creatures. |

**Social**
| Feat | Prereq | Effect |
|---|---|---|
| **Neighborly** | CHA 12 | First impressions in settlements start +10 warmer (04 scale). Gossip about you mutates toward favorable. |
| **Silver Tongue** | — | +2 Persuade and Deceive; may reroll one failed Persuade per conversation. |
| **Horse Trader** ◆ | Bargain 4 | +4 Bargain when buying or selling animals; spot a doctored horse automatically. |
| **Card Sharp** ◆ | Sleight of Hand 4 | Cheat at cards: opposed Sleight vs. Perception, +2 on your gambling win rate; failing exposure creates a Grudge. |
| **Hymn-Singer** | Perform (Song) 2 | Lead a group song: allies get +1 on morale saves and −1 fatigue accrual for 1 hr, and the singing counts as a gathering for anxiety discharge (`10` §6, r = 20). In church: opinion gains with attendees. |
| **Hard Reputation** | Notoriety ≥ 300‰ in any settlement (`04` §8.6) | Intimidate gains `min(6, floor(notoriety‰ / 100))` in the current settlement, read directly from `04`'s per-settlement value (no tier table needed, C42). Persuade with strangers −2. |
| **Keeps an Ear Out** ◆ | Gather Information 2 | Gather Information takes half the time, and on a success you also learn whether anyone present seemed to *avoid* the topic (a Read People cue, §4.5). |

**Magic**
| Feat | Prereq | Effect |
|---|---|---|
| **Hedge Dabbler** | WIS or CHA 11 | Learn 2 cantrips from the Folk list; cast each 3/day. The catalog gateway for non-casters. |
| **Quiet Casting** | Caster 1 | Cast with no verbal component: +1 slot level, or +2 Concentration DC for folk/fae. |
| **Lingering Spell** | Caster 1 | ×2 duration: +1 slot level. |
| **Charm-Maker** ◆ | Caster 1 or Herbalism 4 | Make charms (one-use spell objects; see §10.3) of spells you know; cost = spell level × $5 + ingredients. |
| **Almanac Reckoning** | Lore (Almanac) 4 | When you cast or work under a favorable sign (§10.2), +1 caster level or +2 on the check. |

**Fae**
| Feat | Prereq | Effect |
|---|---|---|
| **Second Sight** | WIS 13 or born with a caul (background) | Perception vs. glamour DCs as a free reaction; see Fae intensity as a map overlay. Unsettled in crowds (an Id `fear` thought, `10`). +15 dream receptivity (`10` §9.2). |
| **Salt and Iron** | Lore (Fae) 2 | Iron and salt used by you deal +1d6 to fae (cold iron, if `03`'s premium tier is adopted, C28: +2d6); ward a doorway/camp in 10 min (fae need Will DC 12 + floor(level/2) to enter uninvited). |
| **Guest-Right** | Fae Courtesy 4 | Invoke the law of hospitality: a fae who has fed you or been fed by you can't harm you for a night unless you break it first. Breaking it yourself is catastrophic (06). |
| **Coat Turned** | — | Wearing a garment inside-out breaks fae misleading (pixie-led) on a reroll of Wayfinding; −2 to Persuade with humans who notice. |
| **Name-Keeper** | Fae Courtesy 2 | +4 vs. any effect that uses your name; you can tell when a fae is fishing for it. |
| **Touched** | Not chosen; gained by events | A fae mark. +2 Fae Courtesy, fae notice you from far away (encounters ↑), −2 Will vs. glamour. A prerequisite for the Fae-Touched prestige paths. |

**Frontier trades**
| Feat | Prereq | Effect |
|---|---|---|
| **Prospector's Nose** ◆ | Trade (Mining) 2 or Lore (Nature) 2 | Read float galena and sinkhole sign: identify lead-bearing ground (Perception DC 15 over 1 hr); +2 Trade (Mining). |
| **Raftsman** | Riverwork 4 | Build a raft in 4 hrs with tools; pilot rafts and keelboats through rapids at −5 DC. |
| **Gunsmith's Touch** ◆ | Trade (Gunsmithing) 4 | Field-repair firearms in 10 min (Tinkering DC 15); weapons you maintain have their misfire chance reduced by 1 step. |
| **Midwife** ◆ | Medicine 4 | Childbirth complications DC −5; +10 opinion with families you've delivered for (04). Highly valued in settlements. |
| **Trapline** | Trapping 4 | Run up to 12 traps (normal 6); check them at ½ time; pelts are +1 quality. |

That's 37. The production catalog should aim for 120+, mostly in survival, trade, social, and fae.

### 5.4 Hardships (flaws) **[PROPOSAL]**
At creation you may take up to two Hardships, each granting a bonus feat. Hardships are RimWorld-style traits, so they also feed the mind (`04`, `10`):
- **Drinker:** the `drink` vice need from `10` §3.4's registry; craving thoughts at +20 intensity; Drunk risk.
- **Bad Lung:** −4 vs. cold and disease affecting the lungs; Exhausted sooner.
- **Wanted:** a bounty in one county; certain NPCs start with a Grudge.
- **Marked by the Hill** (replaces "Iron-Sick"): born with a caul, stolen and returned, or simply unlucky at a fairy ring. A **weakness offset of +40** into `06`'s Drift-keyed triggers (§12.4), so iron, salt, and bells bite from Drift 0. It implies nothing about the character's people.
- **Faint of Heart:** Self-Command −15 at seed (`10` §13.1), so egoMod is usually one step lower and Θ 45 lower.
- **Haunted** (new, `10` §13.1): a repressed trauma memory at intensity 80, three times as likely to surface in dreams. Insight can eventually let you own it.
- **Unlettered:** illiterate, and can't buy literacy until level 3.

**[OPEN]** Can Hardships be bought off later through deeds? (Haunted, at least, has a built-in path: owning the memory through individuation, `10` §8.5.)

---

## 6. Classes and progression

### 6.1 Structure **[PROPOSAL: 3.5-style classes, multiclassing, Callings (prestige), NPC classes]**
- **Classes** with multiclassing at will and no XP penalty. There are no favored classes and no people restrictions: any of the four peoples can take any class, including Witch (`12` §10.2). Occupation priors in NPC generation describe 1855's society, not aptitude.
- **Callings** are prestige classes with sim-native entry requirements (§6.4).
- **NPC classes** (Hand, Tradesman, Gentry, Militia). Most of the county uses these. They exist because P2 says the innkeeper has a sheet, and 3.5 already proved this works.

Why not go classless: classes are the strongest "catalog page" in 3.5. Paging through the class chapter *is* the childhood feeling. Multiclassing plus feats plus practice already gives classless-level flexibility.

### 6.2 Progression math **[DECISION: keep 3.5 shapes]**

| Track | Good | Medium | Poor |
|---|---|---|---|
| BAB | = level | ¾ level | ½ level |
| Save | 2 + level/2 | — | level/3 |

Hit dice are maxed at level 1. After that, roll or take the average (option).

### 6.3 The core classes

| Class | Fantasy | HD | BAB | Good saves | Skill pts | Magic |
|---|---|---|---|---|---|---|
| **Veteran** | Fighter: drilled soldier, militia captain | d10 | Good | Fort | 2 | — |
| **Woodsrunner** | Ranger: hunter, scout, trapper, guide | d8 | Good | Fort, Ref | 6 | — (feats only) |
| **Keelman** | Barbarian: river brawler, raftsman, "half-horse, half-alligator" | d12 | Good | Fort | 4 | — |
| **Mountebank** | Rogue/bard: peddler, con man, medicine-show barker | d6 | Medium | Ref, Will | 8 | Folk, spontaneous, from L2 |
| **Circuit Rider** | Cleric: itinerant preacher on horseback | d8 | Medium | Fort, Will | 4 | Divine, prepared |
| **Almanacker** | Wizard: schoolmaster-magus, ephemeris scholar | d4 | Poor | Will | 2 | Arcane, prepared |
| **Cunning Folk** | Druid-ish: wise woman, charm doctor, unwitcher | d8 | Medium | Fort, Will | 4 | Folk, charm-based |
| **Fae-Touched** | Sorcerer: caul-born, stolen-and-returned, hill-marked (a vocation any people can take, not a people; `12` §4) | d6 | Poor | Will | 2 | Fae, spontaneous |
| **Witch** | The Prince's conscript (witch mode) | d6 | Poor | Fort, Will | 4 | Fae + Curses (06) |

**Signature features** (levels in parentheses):

- **Veteran:** Bonus combat feat (1, 2, 4, 6, 8, 10, 12). *Drill* (1): reload −20%, and the morale floor is never below Shaken while you're in formation with allies. *Steady Under Fire* (3): +2 on morale saves and Concentration while under fire, and gunfire triggers no `fear` thought above intensity 30 (`10`). *Field Dressing* (5): Medicine is a class skill and you can bandage at ½ time. *Officer's Voice* (7): Persuade/Intimidate to rally or rout as a 3 s action within 60 ft.
- **Woodsrunner:** *Quarry* (1, 5, 10): choose a creature category (wolves & dogs, deer & elk, Fae, Humans, River beasts). +2 Tracking, Perception, attack, and damage, rising by +2 per pick. *Woodland Stride* (2): undergrowth costs normal movement. *Trackless* (3): leave no trail (+10 DC to track you). *Hunter's Patience* (4): in a prepared hide you can Steady (take 10) on Stealth and shooting even under threat. *Live Off the Land* (6): Woodcraft forage feeds 2 extra people. *Camouflage* (9): hide with no cover in natural terrain.
- **Keelman:** *Rough-and-Tumble* (1): Brawler free; d6 unarmed lethal or nonlethal. *Riverborn* (1): Swim and Riverwork class skills, +2 each; no cold-shock check under DC 20. *The Boast* (1, 1/day per 4 levels): 3 s roaring brag, then +4 STR, +4 CON, +2 Will, −2 Defense for (3 + CON mod) × 6 s; all foes within 30 ft make a morale save (`terror`, DC 10 + floor(level/2) + CHA mod); Fatigued after. It's also a sanctioned `rage` discharge: the Keelman's own anxiety drops 100 (`10` §6). *Hard to Kill* (2): Wound Threshold +2, +2 per 4 levels. *Shrug It Off* (5): once per day, downgrade a just-taken wound one severity step.
- **Mountebank:** *Low Blow* (1): +1d6 damage per 2 levels vs. Unready/flanked foes (sneak-attack analogue; applies to firearms within 30 ft). *Patter* (1): a 6 s spiel that makes a crowd Fascinated (Perform/Deceive vs. Will; `temptation`) and adds +2 to Bargain sales to anyone in it. *Nostrums* (2): folk spontaneous casting (CHA), up to 4th-level spells by 12. *Slip Away* (3): Evasion analogue (Reflex success = no damage). *A Face in Every Town* (5) **[revised, C47]**: you may wear one extra **Persona** per 5 levels (`10` §8.1), and others perceive each as its own **Figure** (`04` §5.1). Rumors attach to the Figure, not to you, until someone forms an `IsFigure` belief that links them. Each of your Personas gets +10 `control` (mask discipline), so slips are rarer. Witch covers (`06` §3.9) work the same way, so there's no separate alias system. Shadow-faekin concealment is different: it's a concealed attribute *of one* Persona (a Secret plus `presentsAs`, `12` §7.1), not a second Figure.
- **Circuit Rider:** Divine prepared casting (WIS), 0–6th level. *Doctrines* (1): pick 2 of Revival, Temperance, Harvest, Wrath, Mercy, Wayfaring; each grants a bonus spell per level and a power. *Rebuke the Unquiet* (1): Perform (Preaching) as a 6 s action. Spirits, the restless dead, and lesser fae within 30 ft make a Will save (`terror`) or flee (Turn Undead analogue); fae resist with +floor(Fae intensity/2). *Circuit* (2): designate up to 4 settlements. Each one you visit at least monthly is an "active stop": it gives +opinion drift there (04) and 1 bonus prepared 1st-level spell per active stop. A neglected stop drifts cold and its people start rumors that you've abandoned them. *Saddle-Hardened* (3): no fatigue from riding up to 12 hr/day.
- **Almanacker:** Arcane prepared casting (INT) from an **Almanac** (spellbook). *Reckoning* (1): sees the current sign, phase, and hour; spells cast under a favorable conjunction get +1 CL (§10.2). *Scribe* (1): Charm-Maker for arcane spells. *Schoolhouse* (3): teach a class. Students gain practice marks in Literacy/Lore, you gain opinion and $, and a student can become a future apprentice actor. *Ephemeris* (5): predict weather 3 days out with no check; weather-dependent DCs drop by 2 for you. Familiar? **[OPEN]**: proposing that familiars belong to the Witch and Fae-Touched only.
- **Cunning Folk:** Folk casting via **charms** (§10.3; WIS). *Wise in Herbs* (1): Herbalism and Medicine class skills; +2 each. *Unwitching* (1): Spellcraft to identify a curse and its *maker's sign*; ritual counter-curse (§10.6). This is the witch's natural enemy. *Called Upon* (2): settlements with you as resident send people for help (a stream of jobs, opinion, and payment in goods). *Root and Bough* (4): speak with plants once per day. *Witch-Bottle* (6): ward a household against curses for a season.
- **Fae-Touched:** Fae spontaneous casting (CHA), spells known like a sorcerer; power varies with Fae intensity (§10.4). *Glamour* (1): cantrip-level illusions at will in Fae intensity ≥ 2. *Hill-Marked* (1) **[revised, C27]**: a **weakness offset of +20** into `06`'s Drift-keyed triggers (§12.4), so at Drift 20 you feel iron as a Drift-40 actor does; `03`'s Iron Presence scales it. This replaces the old class-specific *Iron-Sick* rule. *Between* (3): you count as fae *or* mortal, whichever is better, for wards and Guest-Right (doesn't stack with a shadow-faekin's Kin's Guest-Right; use the better). *Changeling's Luck* (5): once per day, reroll any d20.
- **Witch:** see 06 for the loop. Rules side: Fae spontaneous casting (CHA). *Prince's Mark* (1): sworn to the Court and sensed by Second Sight. *Familiar* (1): a beast actor with its own sheet and mind that shares senses within 1 mile. *Curse Rites* (1): learns curse rites (§10.6) as a separate catalog. *Pact-Bound* (1) **[revised, C27; replaces *Unhallowed*]**: the witch's weaknesses (iron, salt, bells, consecrated ground, running water) are **`06`'s** (§3.8.1): a *nature* track keyed to Drift plus any weakness offset (§12.4), with `03`'s Iron Presence as an input, and a *claim* track keyed to Drift plus the Pact's mark. Her Origin sets her starting Drift, and a Geas can add an absolute prohibition from day one (`06` §3.3). This doc adds no separate witch weakness, so the numbers live in one place and an adventurer at the same Drift suffers the same way (P4). *Two Consciences* (1): the introjected Prince, a `pact`-sourced superego voice carrying Behests and the Tithe (`10` §13.3), which argues with her old conscience. *Witch's Road* (3): move at full speed through any natural terrain in Fae intensity ≥ 1 and leave no trail for mundane trackers. *Power from Woe* (1+) **[revised, C30]**: one currency, two sinks (`06` §3.6). Woe is `06`'s single power currency, spent through `06`'s menu (Gifts, Favor, Workings, Mercies, self-healing) *and* through this class sink, so there's no parallel resource. The witch keeps one spell engine (fae spell points, shared with Fae-Touched). **[PROPOSAL] Exchange rates** (`06` asked `02` to set them; integers in centi-Woe):
  - **Spell points:** 300 centi-Woe (3 Woe) restores 1 fae spell point, at most `level` points per day. One low curse's daily yield buys roughly one point.
  - **Rite DC:** 500 centi-Woe (5 Woe) per +1, at most +2 per rite. This is the `woe` term in §10.6's formula.
  - **Fuel a rite:** a rite's Woe cost, if any, is `06`'s catalog data.
  Rates are content constants so `06` can rebalance them against the Tithe without touching rules code.

### 6.4 Callings (prestige classes) **[PROPOSAL]**
Each has a **sim-native requirement** in addition to ranks and BAB. None has an alignment-like gate. A few read the psyche as a *fact about what you've lived through* (an individuation stage), never as a moral label.

| Calling | Requirement highlights | Gist |
|---|---|---|
| **Iron Warden** | Salt and Iron; Lore (Fae) 6; **inducted by a living Iron Warden** who likes you (04) | Fae-hunter lodge; cold-iron mastery; sees through glamour. Hall culture produces many (`12` §5.2) |
| **Witch-Finder** | Spellcraft 6; Unwitching or Read People 8; **has helped expose a real curse-maker** (a `04` §9 process at rung 4+ against an actor who had in fact cursed; no court is needed, since there's no witchcraft statute, C13) | Hunts witches; a key antagonist template in witch mode. `10` notes reaction formation draws people to this work; the Calling doesn't require it |
| **Riverboat Gambler** | Sleight 6, Bargain 6; **won $500 at cards** | Luck manipulation, steamboat social standing |
| **Court Emissary** | Fae Courtesy 8; **was a guest of a Court and left unharmed** | Fae diplomacy, bargains, safe passage |
| **Lead Delver** | Trade (Mining) 6, Wayfinding 6; **survived a cave-in** | Underground mastery: old mines, sinkhole caves, what lives below. The natural goblin path (`12` §8.8), open to all |
| **Revivalist** | Circuit Rider 5; **led a camp meeting of 50+** | Mass-sermon effects, area morale, crowd conversions. A sublimated-rage sermon accelerates Heat (`10` §7.2), so a Revivalist can start a hunt without meaning to |
| **Dream-Reader** *(new, from `10` §8.5)* | Read People 6; Lore (Fae) or Lore (Mental Philosophy) 4; **individuation stage 3**; **has read 5 dreams for others** | Reads others' dreams (an Explain of their inner state at band level), counters hag-riding, walks a sleeper's dream at FI ≥ 3, recovers repressed memories without the mesmerist's implant risk |
| **Hag** (witch path) | Witch 6; **Woe threshold (06)** | Deeper curses, shapes, longevity costs |

### 6.5 Levels and XP **[PROPOSAL]**
- **Cap 12** for v1 (**[OPEN]** whether to extend to 20 later). XP to reach level n = 1,000 × n(n−1)/2 (the 3.5 table: L2 1,000; L5 10,000; L12 66,000).
- In the setting, levels mean the following. Most adults are levels 1–3. A county has a handful of level 5–7 people. A level 10+ figure is a legend with a name and a song.

### 6.6 XP sources **[PROPOSAL]**
The guiding rule: **XP for overcoming, surviving, and finding, never for killing as such.**

| Source | Amount | Notes |
|---|---|---|
| **Overcome a threat** | 3.5-style: 300 × level when CR = level, scaled by `XP_MULT‰[CR − level]` (§1.4: ×1.5 per CR above, ÷1.5 per CR below, 0 at CR ≤ level − 4). Solo, so no division | "Overcome" = the threat is killed, routed, captured, talked down, or evaded *after engagement*. Routing a wolf pack is worth the same as killing it. |
| **Peril survived** | Hazard Rating as CR (e.g., flooded ford = CR 2) | Only when the DC exceeds 10 + your bonus. |
| **Discovery** | 50–500 by site tier | First visit to a notable site; learning a true name; finding a green road. |
| **Story beats** | 250–2,000 | Ambition milestones (06), director beats (05), resolving a grudge, a Behest delivered, a scapegoat cleared or a Mercy bought (`06` §3.6). |
| **Self-Culture** | 250 × stage reached (stage 1 = 250 … stage 5 = 1,250) | Individuation stages (`10` §8.5). Self-knowledge is progression. |
| **Livelihood** | 2 XP per full workday of trade work | Mostly matters for NPCs: about 8 years to L4, 25 years to L6. |
| **Witch: Curses** | Only when a curse **overcomes** something: a protected target (CR-equivalent of the target's save bonus plus protections), a witch-finder evaded, a hunt turned | **[PROPOSAL, aligned with `06` §3.6, C30]** A routine curse on an unwarded dairy pays Woe and no XP. Woe buys breadth of power (Gifts); XP buys competence (levels). That keeps harm from paying twice and lets a low-harm witch level through story beats. |

At T1, NPC XP is credited from activity outcome bands using the same table.

---

## 7. Time, actions, and the "round"

### 7.0 The clock (C21) **[DECISION: ADR + lead call] [PROPOSAL: tenths, per `07` §3.4]**
- **Canonical time is integer game-minutes** since 1855-04-01 00:00 (ADR). T1 steps hourly, T2 daily. Every rule duration of a minute or more ("1 min to bandage", "10 min to ward a doorway", "per hour of exposure") is in game-minutes.
- **A live (T0) site adds a sub-minute clock:** `tenth`, 0–599, the game-seconds within the current minute at tenth-second resolution. An instant is `T0Instant = minute × 600 + tenth`, a plain integer. All timings in this section are integer tenths; the "s" figures below are for reading.
- **T0 is event-driven** (`07` §3.4): each action phase schedules its own end on a min-heap keyed `(instant, actorId, seq)`, which is a total order, so simultaneous completions always resolve the same way. Per-minute systems (needs, the hourly T1 step) run at minute rollover, but **per-wound timers** (bleeding, §8.5) and breath (§8.6) are scheduled from the instant they start, so a wound taken at :59.9 doesn't bleed a full point a tenth of a second later.
- **Speed is presentation.** Speed changes only how many tenths the worker advances per real second; outcomes never depend on it (`11` §5.1). **[OPEN, C21(b)]** `11` §2.11 proposes that hostility auto-pauses and drops to **Tactical** (1 game-second per real second). The rules side supplies the trigger: "hostility begins" (§7.2) is an `interrupt` event. I support `11`'s default.
- **Sleep and Wait** demote a site to T1 for their duration (`07` §3.4). Rules that fire "per minute" then resolve in closed form at T1 (bleeding, cold checks), with the same tables.

### 7.1 Timed actions **[DECISION: replace action economy]**
The 6-second round stays as the **conversion unit**: any 3.5 effect that lasted "1 round" lasts 60 tenths. Actions take time instead of slots:

| 3.5 action | Coulee timed action | Tenths |
|---|---|---|
| Free | 0 s | 0 |
| Swift | 0.5 s (max one per 6 s) | 5 |
| Move (move-equivalent: draw, stand up) | 1.5–3 s by task; walking is continuous at speed | 15–30 |
| Standard (attack, cast most spells) | 3 s, split into **windup** (60%) and **recovery** (40%) | 30 = 18 windup + 12 recovery |
| Full-round | 6 s | 60 |
| Reload (firearm) | Weapon-specific, 2–120 s (§9.5, §9.10) | 20–1,200 |
| Reach an item | `03` §3.4 reach time (pocket 2 s … pack interior 20–40 s) | 20–400 |

Being hit during **windup** of a spell or a careful action triggers Concentration (DC 10 + damage). This creates RimWorld-style interrupt drama. Windup and recovery are also exactly what `11`'s timing ribbon draws (▓ windup, ░ recovery), so the most important thing on a phone screen is a direct read of this table.

### 7.2 Reaction (initiative analogue) **[PROPOSAL]**
When hostility begins (any actor declares hostile intent or is attacked), everyone involved rolls **Initiative (d20 + DEX + mods)**. Each actor's **first-action delay** = `max(3, 30 − result)` tenths. An initiative of 20 acts after 10 tenths (1.0 s), and an initiative of 5 after 25 (2.5 s). Until their first action completes, an actor is **Unready** (flat-footed: no DEX to Defense, vulnerable to Low Blow). **Surprise:** actors who failed to perceive the threat add +30 tenths. "Hostility begins" is also a **decision point for the Ego** (`10` §5.1), where each NPC's combat intent is chosen (§9.1).

### 7.3 Iterative attacks
At BAB +6/+11, a **standing full attack** (60 tenths) gives 2/3 attacks at −0/−5/−10, as in 3.5. Attacking while moving gives one attack per 30 tenths. This keeps the 3.5 incentive to plant your feet.

---

## 8. Health, injury, and death

### 8.1 The hybrid **[PROPOSAL]**
- **Vigor** (= 3.5 HP in math, renamed so the meaning is honest) is **stamina, luck, near-misses, and grazes**. It recovers fast.
- **Wounds** are **located, persistent injuries**. They bleed, get infected, heal slowly, and can leave scars and missing parts. They are where the RimWorld-style drama lives.

### 8.2 Vigor
- Per level: HD + CON mod (3.5). A level-1 Woodsrunner with CON 14 has 10.
- **Recovery:** level + CON mod per hour of rest; full after 8 hours of sleep *if* you aren't Hungry, Chilled, or Exhausted (otherwise half).
- **Nonlethal damage** fills a separate counter against Vigor (3.5). When nonlethal ≥ current Vigor you're Unconscious. It never causes Wounds unless it comes from a critical hit (and then only a Light bruise or sprain).
- At 0 Vigor you are **Spent**: you can act, but every further hit gets through as a Wound.

### 8.3 When a Wound happens
A hit causes a Wound if **any** of these is true:
1. You are at **0 Vigor** (Spent): the *full* damage becomes Wound damage. If a hit takes you *to* 0, the overflow beyond your remaining Vigor becomes Wound damage.
2. The hit is a **critical**: the damage beyond the normal (×1) amount becomes Wound damage.
3. A single hit deals **≥ Wound Threshold (WT)**, where WT = CON score (e.g., 14). The excess over WT/2 becomes Wound damage. **Firearms and big beasts' bites have the *Wounding* property: WT is halved against them.** A musket ball that does 11 damage to a CON 14 person (WT 7 vs. Wounding) inflicts a Wound with 11 − 3 = 8 points.
4. **Hazards**: falls over 20 ft, crushing, burns, frostbite, and animal attacks while you're grappled each specify a wound directly.

If several conditions apply, use the largest Wound damage. Do not add them. Vigor damage is still applied (down to 0). The wound comes in *addition*.

### 8.4 Wound severity and location
**Location** (d20, or chosen by called shot at −4/−8):

| d20 | Location | Notes |
|---|---|---|
| 1–2 | Head | Vital. Severe+ → Fort DC 15 or Unconscious; Critical → death check |
| 3–9 | Torso | Vital. Bleeds more (+1 step) |
| 10–11 | Right arm | Weapon hand penalties |
| 12–13 | Left arm | |
| 14 | Right hand | Fine-work penalties |
| 15 | Left hand | |
| 16–17 | Right leg | Speed penalties |
| 18–19 | Left leg | |
| 20 | Foot / extremity of the attacker's choice | |

Quadrupeds and nonhumanoids use the body plan from their ancestry/creature data (§12).

**Severity** by Wound damage:

| Wound pts | Severity | Burden | Bleed | Heal time (rested) | Typical effect |
|---|---|---|---|---|---|
| 1–4 | **Light** | 1 | none | 3 days | −1 to checks using the part |
| 5–9 | **Serious** | 2 | slow | 2 weeks | −2 using the part; legs −10 ft speed |
| 10–14 | **Grievous** | 4 | fast | 6 weeks + Medicine DC 15 | Part useless until treated; Fort DC 15 or Stunned 6 s |
| 15+ | **Critical** | 8 | severe | Months; may leave permanent harm | Vital: Fort DC 20 or **Dying**. Limb: Fort DC 15 or **maimed** (lost or permanently useless) |

**Wound Burden** = the sum of active wound burdens. At Burden ≥ CON/2 the actor is **Staggered** (one action per 6 s, half speed). At Burden ≥ CON the actor is **Dying**. This is the "too many wounds" death path, and it replaces −10 HP.

### 8.5 Bleeding, infection, and permanence
- **Bleeding** drains a **Blood** track (= CON score). Per minute (every 600 tenths from the wound's instant at T0, closed form at T1): slow −1, fast −2, severe −4. Stages: ≤ ¾ **Pale** (−1), ≤ ½ **Faint** (−2, Fatigued), ≤ ¼ **Collapse** (Unconscious), 0 **Bled out** (dead). A bandage (Medicine DC 10 slow / 15 fast / 20 severe, 1 min) stops bleeding. A tourniquet (limbs, DC 10) stops any bleed but risks the limb after 2 hrs. Blood recovers 1/day, or 2/day with good food.
- **Infection** (RimWorld's race against immunity, d20-ified): each untreated Serious+ wound makes a daily infection save, Fort DC = 8 + 2 × severity rank (Serious = 2, Grievous = 3, Critical = 4) + dirt (+2 for mud, river water, or a bite) − treatment (Medicine result − 10, max −8; clean dressing −2). Fail → infection stage +1. Succeed twice in a row → that wound is safe. Stages: **Inflamed** (−1) → **Fevered** (Fatigued, −2) → **Septic** (Exhausted, Fort DC 15 daily or Burden +4) → **Gangrene** (limb: amputate or die; torso: Dying). Herbalism poultices give +2 to the save. Amputation is Medicine DC 20 with a saw; failing by 5+ adds a Critical torso wound.
- **Permanent outcomes:** Scar (cosmetic; 04 opinion tags such as "fearsome"/"ruined"), Lame (−10 ft), Lost fingers (−2 fine work per hand), Lost eye (−2 ranged and Perception, no depth perception), Lost limb (prosthetics in 03), Chronic pain (Concentration −2 in cold weather). They're all on the sheet and all visible in the low-poly model where possible (P6).

### 8.6 Environmental killers (rules hooks)
- **Drowning:** hold breath for CON × 120 tenths (2 × CON × 6 s; ×3/2 with Waterman, floored). After that, CON check DC 10, +1 per 60 tenths. Fail → Unconscious. Then 3 min to death. Rescue and revival: Medicine DC 15 within those minutes. **Cold shock:** entering water below ~50°F: Fort DC 15 or hold breath is halved for the first minute, and the Swim check that round is at −4.
- **Cold [revised, C23]:** `05` computes effective temperature and the comfort band, using `03`'s clothing insulation in **°F of band extension** (with wool keeping 50% when wet). This doc turns the deficit (°F below the band's low edge) into an **exposure step**: **Mild** 1–10 °F, **Cold** 11–25, **Severe** 26–40, **Deadly** 41+ **[PROPOSAL; `05` calibrates]**. Per hour (Mild), 10 min (Cold), 1 min (Severe and Deadly) of exposure: Fort DC 15 +1 per previous check. Fail → **Chilled → Hypothermic (Exhausted, Wound Burden +2) → Dying**. **Wetness is already inside `05`'s effective temperature** (wet penalty and wet retention), so the Wet condition no longer adds a step here. The old "+1 step" double-counted. **Frostbite:** with each failed check in Severe+ cold, the d6 extremity (hands, feet, face) takes a Light frostbite wound. A second failure on the same part upgrades it, and Grievous frostbite = lost digits.
- **Heat**, mirrored: Overheated → Heatstroke.
- **Falls:** 1d6 Vigor per 10 ft (max 20d6). Over 20 ft, each die of 6 also gives a Light wound on a random location, merged into a single higher-severity wound if they're all on one part.

### 8.7 Disease **[revised, C25]**
Each disease is one data entry, split by owner. **This doc owns the per-victim columns**: Fort DC, effect per failed save, saves to recover, and treatment hooks. **`05` owns the epidemiology columns**: vector, season, incubation, SEIR parameters, and the fatality targets the per-victim numbers are calibrated against (`05` §6.5). Where the two docs disagreed (cholera incubation 1 day vs. 0.5–5 days), `05`'s values win. At T2 it all runs as epidemics (`05`).

| Disease | Vector (`05`) | Inc. (`05`) | DC | Per failed save | Recover |
|---|---|---|---|---|---|
| **The Ague** (malarial) | Bottomland mosquitoes, Jun–Sep | 10–30 days | 13 | Fever cycles: Fatigued 2 days of 3; 1 CON | 3 saves; relapses each summer (DC 10); quinine +4 (`03`) |
| **Milk Sickness** | Milk from cows that ate white snakeroot | days | 16 | 1d3 CON, Nauseated | 2 saves |
| **Cholera** | Bad water, steamboat towns | 0.5–5 days | 17 | 1d4 CON, Thirst ×3 | 2 saves; boiled water prevents |
| **Lockjaw** | Deep dirty wounds | 1–3 wk | 15 | 1d2 DEX + 1 CON, can't eat | 3 saves; often fatal untreated |
| **Consumption** | Close quarters, chronic | months–years | 12 | 1 CON per month | Rarely; makes it a legacy story |
| **Fae food** | Eating or drinking in Faerie, a fae kiss | instant | by source | Not a disease: see the **Bound → Longing → Wasting** chain (§11.2, C26) | §11.2 |

Calibration targets are in integer per-mille (`05`'s fatality rates, `07` §8's harness). Untreated cholera's 1d4 CON per failed save against DC 17 should reproduce `05`'s ~40–50% for a typical CON 10–12 adult over 2–3 days; the harness checks this.

---

## 9. Combat

### 9.1 Shape **[DECISION: real-time-with-pause on tile maps]**
Most frontier violence is short, confused, and *not to the death*. The combat rules should produce brawls that end in a black eye, shootouts that end when someone runs, and wolves that test and leave. The deep-sim payoff happens afterward, in memory, grudges, and infection.

**Combat intent [PROPOSAL]:** Each hostile actor carries an **intent**: *Bluster* (posture, wants the other to back down), *Brawl* (nonlethal), *Drive Off*, *Capture*, *Rob*, *Kill*, *Feed* (predators). Intent sets weapon choice, whether the actor uses nonlethal attacks, and morale thresholds. Intent can escalate: drawing a gun in a brawl turns it into *Kill* for both sides and writes a memory everyone keeps.

**Where intent comes from (P7).** Intent is the option the Ego picks at the "hostility begins" decision point (`10` §5), not a stored disposition. The candidate intents are urges voiced by drives and norms: `fear` proposes Bluster, Drive Off, or flight; `rage` proposes Brawl or Kill; `greed` proposes Rob; `hunger` proposes Feed (animals); a `duty` norm proposes Capture (the constable); `our_own` proposes Drive Off when kin are threatened. Reality appraisal weighs the exact odds from this chapter. A weak Self-Command lets the loudest voice win, which is how a frightened man shoots first. **Displacement** (`10` §7.2) can supply a Brawl intent toward a *safer* target than the real one, so a man dunned by his creditor picks a fight with the hired boy. The PC chooses intent directly, and the Ego's verdict is advisory (`10` §5.5).

### 9.2 Attack and Defense
- **Attack:** d20 + BAB + STR (melee) or DEX (ranged) + mods vs. **Defense**.
- **Defense** (= AC) = 10 + DEX + dodge + armor + shield + size + misc. **[PROPOSAL]** Rename to "Defense" because armor is rare here: a heavy coat (+1, clothing), a buff coat (+3), an heirloom cuirass (+3 and Turn 4 on the torso, rare). Full armor stats for `03`'s catalog are in §9.10. Defense against touch effects ignores armor.
- **Critical:** threat range and ×multiplier as 3.5. Confirm by re-rolling. Crits create Wounds (§8.3).

### 9.3 Threat and attacks of opportunity **[PROPOSAL: keep, simplified]**
Each actor threatens the adjacent tiles (or reach). A provoking action while threatened gives each threatening foe **one AoO per 6 s** (Combat Reflexes-type feats raise it). Actions that provoke: leaving a threatened tile (except a deliberate 1-tile step at ½ speed), **reloading a firearm**, casting with windup > 1 s, drinking, picking something up, using a ranged weapon (except with Close Shot + Light on Your Feet), or standing up from Prone. AoOs fire in real time during the provoking action's windup.

### 9.4 Cover and concealment
These are tile properties. **Half cover** (fence, stump) +2 Defense, +1 Reflex. **Cover** (wall, big tree) +4, +2. **Improved** (loophole) +8, +4, and no AoOs through it. **Concealment:** dim light, brush, or a light smoke cloud = 20% miss. Darkness, dense smoke, or a fog spell = 50%. Line of fire is computed tile-to-tile as in RimWorld, and the hit chance shown on hover includes it.

### 9.5 Black-powder firearms **[PROPOSAL]**
Firearms are powerful, slow, loud, smoky, and unreliable. One good shot changes a fight, and then you have a problem.

| Weapon | Dmg | Crit | Range inc. | Reload | Misfire (dry/wet) | Notes |
|---|---|---|---|---|---|---|
| Flintlock pistol | 1d10 | 19–20 ×3 | 30 ft | 15 s | 1–2 / 1–6 | Wounding |
| Smoothbore musket | 1d12 | 19–20 ×3 | 60 ft | 20 s | 1–2 / 1–6 | Wounding; bayonet lug |
| Long rifle (flint) | 1d10 | 19–20 ×3 | 120 ft | 35 s | 1–2 / 1–6 | Wounding; +1 to hit beyond 2 increments |
| Percussion rifle | 1d10 | 19–20 ×3 | 120 ft | 30 s | 1 / 1–4 | Caps cost money; late-era, rarer |
| Fowling piece (shot) | 2d6 cone 15 ft / 1d8 beyond | ×2 | 30 ft | 20 s | 1–2 / 1–6 | Hits everyone in the cone (Reflex DC 13 half); great on birds |
| Cap-and-ball revolver | 1d8 | ×3 | 30 ft | 6 shots, then 90 s per cylinder | 1 / 1–3, chain-fire on 1 | Expensive, rare, a catalog dream (03) |

- **Misfire:** a natural attack roll in the misfire range is a misfire, not a miss. A flash in the pan wastes the shot and needs 6 s to re-prime. "Wet" applies in rain without an oilcloth cover, after fording without protecting the powder, or in mist with Fae intensity ≥ 3 (fae dislike gunpowder; **[OPEN]**).
- **Smoke:** each shot spawns a 1-tile smoke cloud (20% concealment) that lasts 10 s and drifts with the wind (05). Three or more shots in an area within 10 s → dense (50%). Volleys blind both sides.
- **Noise:** a gunshot is a **sound event** with radius ~1 mile in still air. Actors in range hear it on a Perception check against DC 0, +1 per 100 ft of distance, +5 through walls. At T1 it registers as an event at the site, which feeds rumors ("shots on Kettle Ridge last night", 04) and draws predators and curiosity. At 15 ft or closer, an unprotected ear makes a Fort DC 12 or is **Deafened** 1 min. A shot fired at someone who isn't used to gunfire forces a **morale check** (§9.8).
- **Reload provokes AoOs** and is interrupted by moving more than 1 tile. Reloading on horseback: ×2 time. Reload modifiers: Quick Loader, Veteran Drill, and paper cartridges (03) all stack multiplicatively. Floor: 8 s for a musket.
- **Firearms vs. armor [PROPOSAL]:** within the first range increment, firearms ignore armor and natural armor bonuses up to +4. Leather won't stop a ball.

### 9.6 Grappling **[PROPOSAL: 3 states]**
A grapple check is d20 + BAB + STR + size mod (+4 per size category above Medium) and is opposed. States: **Grabbed** → **Held** (no movement, −4 Defense vs. others) → **Pinned** (helpless to the pinner). The contest re-resolves every 3 s, and either side can choose to escalate, break, or act (stab with a light weapon at −4). Predators that **Feed** grapple and bite every 3 s, and those bites auto-wound. Brawl-intent grapples end in a pin plus a "yield" social action.

### 9.7 Nonlethal combat
Fists, saps, gun butts, and the flat of a blade (−4 to hit with a lethal weapon to deal nonlethal) fill the nonlethal track (§8.2). Most town fights are nonlethal **brawls**. 04 treats a brawl as a social event: winners gain respect from rough crowds, there are fines (law, 01), and grudges or reconciliations follow. Getting knocked out during a brawl writes a memory, not an injury log.

### 9.8 Morale and fleeing **[PROPOSAL; psyche hooks per `10` §13.1]**
**A morale check** is a Will save (`terror`), so it already includes **Composure** (§3.7): DC 10 + Threat, made at these triggers:
- First Wound taken; Vigor below ½; an ally down or fled; outnumbered 2:1; first gunfire at you (unless used to it); a **Dread** creature appears (fae lords, the hodag, the dead); Boast/Intimidate effects.

**Threat** = the actor's estimate (+0 to +10) of its danger based on what it can perceive: enemy count × relative level, wounds taken, ranged vs. melee mismatch. **Modifiers:** intent (Kill +2 to the save, Feed −2 for animals after the first wound, Bluster −4), traits (`04`/`10`, e.g. Nervous Constitution −2), Cool Head, protecting kin/young (+4; the `our_own` norm speaking), cornered (+4).

| Result | Outcome | Anxiety booked (`10` §13.1) |
|---|---|---|
| Pass | Steady | — |
| Fail by 1–4 | **Shaken** (−2), looks for cover, may parley | +50 |
| Fail by 5–9 | **Falls back** to cover or out of line of sight; won't advance; offers surrender if intent ≤ Rob | +100 |
| Fail by 10+ | **Flees** (Panicked: drops held items 50%, runs from threats), or **Surrenders** if fleeing is impossible. **Panicked is a `10` Fit** (a flight episode) and discharges per `10` §6 | +200 |

**The feedback loop.** Booked anxiety raises the band, which lowers Composure on the *next* morale save. A frightened fighter gets more frightened, and a steady one stays steady. That replaces 3.5's flat "morale bonus" with a state the player can see building in their own Nerves line.

**Morale is a decision point** (`10` §5.1): the result constrains the Ego's options (Shaken removes "advance", Falls back removes "attack in the open"), and arbitration picks among what's left. That's why two Shaken bandits behave differently.

**The PC [OPEN, merges `02` Q9 with `10` Q1].** Results are **advisory with a cost** by default: the PC is told "Shaken" and takes −2, and overriding the Ego's flee/fall-back verdict books the anxiety the override causes (`10` §5.5(b)). Only a Panicked result (a Fit) can take control away, and only if the "Fits can take the wheel" setting is on. My recommendation is on in Frontier, off in Settler, and on/off in Custom (`06` §8).

**Animals [PROPOSAL]:** Animals make a pack-level morale roll led by the alpha, with the alpha's Composure (beasts have `fear`-only anxiety, §3.7). Wolves "test" (Bluster/Drive Off) unless starving (05 hunger state sets intent to Feed). A wolf pack whose alpha takes a Serious wound usually breaks. Most encounters end without death, and RimWorld players will notice that this *feels* different.

Surrender, parley, and mercy are **social acts** (04). Sparing someone writes a strong memory on both sides. Executing a surrendered foe is a deed witnesses gossip about.

### 9.9 Mounted, size, and reach (brief)
3.5 rules mostly carry over. A horse is an actor with its own morale (gunfire!), and Ride checks keep control (DC 10, +5 per frightening event). Size categories Small/Medium/Large/Huge give the 3.5 Defense/attack mods and grapple mods. **Small** (goblins, §12): +1 Defense and attack, +4 Stealth, −4 grapple, carrying capacity ×¾ (§11.1). Reach is in tiles, and **the rules assume 5-ft tiles** (`05`), so reach 1 = 5 ft and a 30 ft range increment is 6 tiles.

### 9.10 Weapons and armor for `03`'s catalog (gap #2, C35) **[PROPOSAL]**
`03` §6.7–6.8 owns price, weight, bulk, materials, and handling tags. This doc owns the combat numbers. Every row below is an item `03` sells. Attacks take a standard action (30 tenths) unless noted. Damage dice are for a Medium wielder (Small wielders drop one die step, as in 3.5).

**Melee and thrown**

| Weapon (`03`) | Dmg | Crit | Range inc. | Properties |
|---|---|---|---|---|
| Unarmed | 1d3 nonlethal | ×2 | — | Brawler: 1d4, lethal or nonlethal |
| Clasp knife | 1d3 | 19–20 ×2 | — | Light; draw is free from a pocket (`03` reach 2 s) |
| Butcher knife | 1d4 | 19–20 ×2 | 10 ft | Light |
| Bowie knife | 1d6 | 19–20 ×2 | 10 ft | Light; +1 to hit in a grapple |
| Hatchet / belt axe | 1d6 | ×3 | 10 ft (15 with Hatchet Thrower) | Light; draw-and-throw with Hatchet Thrower |
| Felling axe | 1d10 | ×3 | — | Two-handed; −1 to hit (a tool, balanced for chopping); Long |
| Cavalry saber | 1d8 | 19–20 ×2 | — | +1 Defense vs. one melee foe when fighting defensively; Long |
| Sword-cane | 1d6 | 18–20 ×2 | — | Light; concealed (Perception DC 15 to recognize until drawn) |
| Musket butt / gun as club | 1d6 | ×2 | — | Two-handed; lethal or nonlethal at no penalty; a misfire-wet gun is still a club |
| Musket with bayonet | 1d8 | ×3 | — | Two-handed; set vs. charge for ×2 (Bayonet Drill); fixing it takes 30 tenths without the feat |

**Bows and crossbows** (silent: no sound event, §9.5)

| Weapon (`03`) | Dmg | Crit | Range inc. | Reload | Properties |
|---|---|---|---|---|---|
| Hunting bow | 1d6 | ×3 | 50 ft | 20 tenths (2 s) | Add STR mod to damage if negative; iron-headed arrows ×3 crit, horn-tipped (no Fe) ×2 |
| Crossbow, old-country | 1d8 | 19–20 ×2 | 80 ft | 250 tenths (25 s) | Two-handed to span; can be held loaded |

**Firearms not already in §9.5** (all have the Wounding property and spawn smoke and a sound event)

| Weapon (`03`) | Dmg | Crit | Range inc. | Reload | Misfire (dry / wet) | Notes |
|---|---|---|---|---|---|---|
| Percussion musket (converted) | 1d12 | 19–20 ×3 | 60 ft | 20 s | 1 / 1–4 | Bayonet lug |
| Squirrel rifle, .36 | 1d8 | 19–20 ×3 | 90 ft | 30 s | 1–2 / 1–6 | +1 to hit beyond 2 increments; half the powder per shot (`03` ammo burn) |
| Plains rifle, .54 | 1d12 | 19–20 ×3 | 120 ft | 30 s | 1 / 1–4 | +1 to hit beyond 2 increments; heavy ball: ignores armor and natural armor up to +6 in the first increment, not +4 |
| Double-barrel shotgun | as fowling piece, per barrel | ×2 | 30 ft | 40 s (both) | 1 / 1–4 | Fire one barrel (30 tenths) or both at one target (35 tenths, two attack rolls) |
| Single-shot percussion pistol | 1d10 | 19–20 ×3 | 30 ft | 20 s | 1 / 1–4 | Pocket-carried |
| Pepperbox, 4-barrel | 1d6 | ×3 | 15 ft | 120 s | 1–2 / 1–6; chain-fire on a natural 1 (all remaining barrels discharge, one attack roll at −4 for the lot) | −2 to hit beyond 15 ft |

The 02 §9.5 "Flintlock pistol" isn't in `03`'s catalog yet; `03` can add it or drop it. The §9.5 "Long rifle (flint)" is `03`'s Kentucky long rifle, and the "Cap-and-ball revolver" is the .36 six-shot. **Silver ball** does normal ball damage; creatures with a silver vulnerability (`01` §7) take the bestiary's extra effect.

**Iron against the fae [PROPOSAL].** Weapons tagged Fe deal +1 damage to fae and break a glamour on a hit (`03` §3.3's *Harm*). Cold iron, if `03`'s premium tier is adopted (C28), deals +1d4 instead. Salt and Iron stacks on top.

**Armor** (`03` §6.8). Armor here does two things. **Defense bonus** applies to all attacks. **Turn** is subtracted from Wound damage on the covered locations (§8.4) against blades, teeth, claws, and spent shot. Firearms within their first range increment ignore both, up to +4 Defense (+6 for heavy ball), unless the piece is **proofed**.

| Armor (`03`) | Defense | Turn (locations) | Max DEX | Check penalty | Speed | Notes |
|---|---|---|---|---|---|---|
| Heavy coat (clothing) | +1 | — | — | 0 | — | Any heavy wool or mackinaw (`03` §6.6) |
| Quilted jack | +2 | 1 (torso, arms) | +5 | 0 | — | Heat load in summer (`05`) |
| Smoked-hide jerkin | +2 | 1 (torso) | +6 | 0 (−2 when Wet) | — | No Fe; weight +50% when Wet |
| Buff coat | +3 | 2 (torso, arms) | +4 | −1 | — | Wolves can't get through: Turn 3 vs. bites |
| Plate-insert vest | +2 | 4 (torso) | +4 | −2 | — | Fe; torso only |
| Cuirass, heirloom | +3 | 4 (torso) | +2 | −4 | −5 ft | Fe; **proofed** against pistols beyond 15 ft; conspicuous (`04` notoriety) |
| Mail shirt | +4 | 2 (torso, arms) | +3 | −4 | −5 ft | Fe heavy (large Iron Presence); no help vs. firearms in the first increment |

Check penalties apply to Athletics, Acrobatics, Stealth, Sleight of Hand, and Swim (×2 for Swim, §4.1). They stack with `03`'s encumbrance-band penalties. **Content schema [PROPOSAL]:** `03`'s item record gains optional `weapon { dmg, crit_range, crit_mult, range_ft, reload_tenths, misfire_dry, misfire_wet, props[] }` and `armor { defense, turn, covers[], max_dex, check_penalty, speed_ft, proofed? }` blocks. The values are this doc's, and they're stored as integers.

---

## 10. Magic

### 10.1 Concept **[PROPOSAL]**
There are four traditions. They share a **spell catalog** (the PHB chapter Ellie loves) with levels 0–6 for v1, and differ in *how* spells are powered, prepared, and limited. That way each class reads differently on the page and plays differently in the sim. A spell entry lists which traditions have it, and some spells exist in only one.

| Tradition | Who | Engine | Limiter | World interaction |
|---|---|---|---|---|
| **Arcane (Almanac)** | Almanacker | Vancian prepared slots from the Almanac | Slots per day; literacy; the book can be lost or burned | Conjunction timing (§10.2) |
| **Divine** | Circuit Rider | Prepared slots chosen at dawn prayer; whole list available | Slots; *Faith* standing: deeds against the congregation's norms reduce slots until atoned (04 links) | Stronger on consecrated ground (+1 CL), weaker in high Fae intensity |
| **Folk** | Cunning Folk, Mountebank, Hedge Dabbler | **Charms**: spells bound into physical objects in advance (§10.3); Mountebanks cast a few spontaneously | Active charm capacity; ingredients cost money | Charms are inventory items: tradeable, stealable, rumor-worthy |
| **Fae** | Fae-Touched, Witch | Spontaneous from spells known; power scales with **Fae intensity** | Daily spell points; Iron and church weaken it | Strongest in deep Wilds; nearly dead in a mill town |

### 10.2 Arcane: Almanac reckoning
The Almanacker prepares like a 3.5 wizard. Slots by level follow the 3.5 wizard table truncated at 6th (the 6th-level slot comes at 11). **Conjunctions:** each spell has an affinity (Moon, Sun, Dawn/Dusk, a season, a weekday). Casting under it gives +1 CL, and +2 with Almanac Reckoning. Casting against it (e.g., a Sun spell at new-moon midnight) requires a Spellcraft DC 15 or the slot is lost. This makes the calendar (00 Time) matter mechanically, and it makes the Almanacker a *planner*.

### 10.3 Folk: charms
A charm is a physical object: a written charm-letter, charm bag, horseshoe nail, knotted cord, or witch bottle. Making one costs 10 min × spell level, ingredients ($2–$5 × level, often foraged via Herbalism), and a Trade/Herbalism or caster check (DC 10 + 2 × level). Charms sit in inventory and are triggered with a 3 s action (or automatically for wards). **Active charm capacity** (how many you can keep "live" at once) = caster level + WIS mod. Non-casters with Charm-Maker can make only cantrip/1st-level charms. **Charms are sellable**, which gives the Cunning Folk an economic role (03) and gives Mountebanks something to fake (a fake charm needs Deceive vs. Spellcraft).

### 10.4 Fae: tidal power
The caster has **spell points** per day = 3.5 sorcerer slot totals converted at 1/level (cantrips free). The effective cost of a spell = level − (Fae intensity − 2), minimum 1. In deep Wilds (FI 5) a 3rd-level spell costs 1 point. In a town (FI 0) it costs 5. Within 10 ft of cold iron: +2 cost. On consecrated ground: Will DC 15 + spell level or the spell fizzles. Fae magic is tied to place, which is the RimWorld lesson that terrain should matter.

> **Challenge to 00 — Fae intensity granularity.** 00 defines Fae intensity as a *map* property. For the rules to work (iron, hedgerows, a church at the edge of the woods, a fairy ring in a pasture), it needs to be a **per-tile scalar field** with a map-level baseline, the way RimWorld does temperature or fertility. A farm at the edge of the Wilds then has a gradient. I recommend 01/05/07 adopt "map baseline + tile field."

### 10.5 Spell catalog (sample, 22 spells)
Tradition key: **A** arcane, **D** divine, **F** folk, **Fa** fae. CT = casting time. Saves are DC 10 + level + casting mod.

| Lvl | Spell | Trad. | CT | Range / Duration | Effect |
|---|---|---|---|---|---|
| 0 | **Kindle** | A F Fa | 3 s | Touch / inst. | Light tinder or a pipe even when damp (not soaked). Fire in the Rain casters can light soaked wood. |
| 0 | **Mend** | A D F | 1 min | Touch | Repair a small break (torn strap, cracked stock, split boot) to working order; −10% durability loss (03). |
| 0 | **Know the Weather** | A F | 1 min | Self / inst. | Forecast next 12 hrs with certainty; Sun affinity. |
| 0 | **Wisp-Light** | A Fa | 3 s | 30 ft / 10 min | A floating light (torch-equivalent). Fa version is greenish and draws fae notice. |
| 1 | **Staunch** | D F | 3 s | Touch / inst. | Stop all bleeding on one wound; Blood +1. |
| 1 | **Comfort the Beast** | D F Fa | 3 s | 30 ft / 10 min | One animal: Will or becomes calm, ending fear or aggression (Feed intent animals +4 save). |
| 1 | **Sure Path** | A F | 1 min | Self + 4 / 4 hrs | +4 Wayfinding; immune to mundane getting-lost; vs. fae misleading, an opposed CL check. |
| 1 | **Keep Dry** | A F | 1 min | Touch / 8 hrs | One person's gear and powder stay dry; ford or rain without the Wet condition (below chest depth). |
| 1 | **Snare of Roots** | F Fa | 3 s | 60 ft, 2-tile radius / 1 min | Roots grab: Reflex or Entangled; Athletics DC 15 to break. |
| 1 | **Fair Words** | Fa | 3 s | 30 ft / 1 hr | Will or the target regards you as a trusted acquaintance (charm-person analogue); 04 records a false-friend memory when it ends. |
| 1 | **Iron Nail Ward** | D F | 10 min | A doorway / 1 night | Fae and spirits can't cross without Will DC (spell DC + 2); breaking it alerts you. |
| 2 | **Find the Lost** | A D F | 10 min | 1 mile / 1 hr | Sense direction to a named object or a person you've met; blocked by running water (Fa: also by iron). |
| 2 | **Bottomland Fog** | A Fa | 6 s | 120 ft, 6-tile radius / 10 min | Dense fog (50% concealment); damps powder (misfires use Wet). |
| 2 | **Break Fever** | D F | 1 min | Touch | New Fort save vs. one disease or infection at +4; on success, regress one stage. |
| 2 | **Owl's Eyes** | A F Fa | 3 s | Touch / 1 hr | See in moonlight as in day; darkness = dim. |
| 3 | **Speak to the Departed** | D F | 10 min | Grave or corpse / 5 questions | The dead answer from their memories (04 data!), in character, possibly lying if they held a grudge. |
| 3 | **Call the Wind** | A D | 1 min | 1 mile / 1 hr | Shift wind direction and strength one step; clears smoke and fog; affects boats and fire spread. |
| 3 | **Glamour of Seeming** | Fa | 6 s | 120 ft / concentration + 1 min | A full-sense illusion of a person, creature, or place; Read People/Perception vs. Will to disbelieve; Second Sight sees through. |
| 3 | **Unbinding** | D F | 10 min | Touch | End a curse or charm whose rank ≤ CL/2 (CL check vs. 11 + maker CL otherwise). The Unwitching core. |
| 4 | **Walk the Green Road** | Fa | 1 min | Self + 4 / travel | Enter a fae road at a fairy ring/sinkhole; travel 1 day's distance in 1 hr; Fae Courtesy DC 20 or arrive somewhere else (05 event). |
| 4 | **Wall of Brambles** | F Fa | 6 s | 120 ft, 6×1 tiles / 10 min | Thorny hedge: blocks movement; 2d6 + Light wound to pass through. |
| 5 | **Bind by Name** | A Fa | 1 hr | Unlimited, needs true name / until broken | Compel one task from a being whose true name you know (Will each week to resist). Witch counterpart in 06. |

**Spell slots per day (Almanacker/Circuit Rider) [PROPOSAL]:** use the 3.5 wizard/cleric tables truncated at 12th level. Bonus slots from a high casting ability as in 3.5.

### 10.6 Curse hooks (for 06)
Curses are a **separate catalog of Rites**, not spells, because they run on a different loop. They are long-casting, target-linked, and suffering-yielding. The rules interface 06 should build on **[PROPOSAL]**:
- **Link:** a rite needs a link to the target (a strand of hair, a footprint, a spoken name, a gift accepted, something they ate). Link quality modifies the DC (−4 to +4).
- **Rite DC** = 10 + rite rank + witch CHA + link quality. The target saves with Will (some curses: Fort). Protections add bonuses: a horseshoe over the door +1, a witch-bottle +4, a church member in good standing +2, Iron Nail Ward blocks entirely while active.
- **Effect primitives** are the vocabulary 06 composes curses from, and each must map to existing systems: condition imposition (Sickened, Fatigued), a need modifier (04), luck (−2 to a skill family), an opinion shift between two actors (04), a disease (§8.7), livestock or crop yield (05), or an object property (milk sours, powder fails).
- **Signs:** every curse leaves **signs** (detectable by Spellcraft, Unwitching, or Lore (Fae)) that point to the *witch's maker-sign*. This feeds the villagers' investigation and hunt. The sign strength is a dial 06 can tune.
- **Woe:** the curse's yield into 06's resource = a function of the victim's mood damage (04). Rules only promise that the damage is measured on 04's mood scale.

---

## 11. Needs and survival: rules hooks only
05 owns ecology and weather, and 04 owns the Mind. These are the hooks the rules expose:

| Need | Tracks | Rules effect by stage |
|---|---|---|
| **Rest** | Hours awake, exertion | 18 hrs awake or forced march → **Fatigued** (−2 STR/DEX, can't run). 24+ or march overtime → **Exhausted** (−6 STR/DEX, half speed). Fort DC 10 +1/hr past threshold to avoid the next step. |
| **Hunger** | Calories vs. labor (05 rates) | 1 day **Hungry** (Vigor recovery ½). 3+ days **Starving**: CON check DC 10 +1/day or 1d6 nonlethal that can't heal until fed (3.5 starvation shape). Weekly −1 STR. |
| **Thirst** | Water vs. heat and labor | After 1 day + CON hrs: CON check hourly → nonlethal. |
| **Warmth** | Temperature band vs. insulation, Wet | §8.6 exposure steps. |
| **Load** | Weight vs. STR carry table (3.5 numbers, 03) | Light / Medium (−3 check penalty, max DEX +3, speed −10) / Heavy (−6, +1, speed −10, ×3 run). Swim penalty doubled. |
| **Intoxication** | Drinks vs. CON | Tipsy (+2 morale, −1) → Drunk (−4 DEX/WIS checks, +4 morale) → Insensible. Hungover next day: Fatigued until noon. |
| **Fae longing** | Exposure to fae food, music, beauty | A 04 need that, when unmet, gives mood debuffs. Rules: −2 Will vs. fae effects at high longing. |

All conditions that need stages cause appear in §13.

---

## 12. Ancestry hooks **[DECISION: data slot only]**
No peoples are designed here. The engine reads an **Ancestry** record. Proposed schema:

```yaml
ancestry:
  id: placeholder_people_a
  ability_mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }   # guideline: net +0, max ±2 each
  size: medium            # small / medium / large; drives Defense, grapple, carry, reach
  speed_ft: 30
  body_plan: humanoid     # location table for wounds (§8.4); quadruped, winged, etc.
  senses: [normal]        # low_light, darkvision_60, scent, tremorsense, second_sight
  lifespan:               # aging thresholds in years: middle, old, venerable, max_roll
    middle: 35
    old: 53
    venerable: 70
    max_roll: 2d20
  maturity_age: 15
  traits:                 # rule-hook tags, each a small engine feature
    - cold_iron_sensitive: false
    - cold_tolerance_steps: 0
    - fae_notice_mod: 0
    - fae_intensity_comfort: [0, 2]   # mood effects outside this range
  bonus_skills: { }       # e.g., riverwork: 2
  bonus_feat_choices: [ ] # restricted upbringing list
  languages: { native: [], literacy_default: 0.4 }   # literacy base rate for NPC generation
  diet: omnivore          # food system hooks (05)
  social_tags: [ ]        # 04 uses these for prejudice/affinity opinion priors (careful: design-sensitive)
  magic_affinity: { arcane: 0, divine: 0, folk: 0, fae: 0 }   # CL mods or spell-point mods
  population_priors: { }  # occupation and ability distribution shifts for NPC generation
```

**Balance budget [PROPOSAL]:** each ancestry gets ~6 "points": +1 ability = 1, a sense = 1–2, a skill bonus = 0.5, a trait per its tag cost, and drawbacks refund. This is a design aid, not an engine rule.

**[OPEN]** Should social_tags (prejudice priors) exist at all? Period-accurate frontier bigotry is a serious content decision with real-world echoes. 04 and Ellie should decide how, or whether, opinion priors key on ancestry.

---

## 13. Conditions

| Condition | Rules effect | Sim notes / typical cause |
|---|---|---|
| **Unready** | No DEX to Defense; vulnerable to Low Blow | Start of combat, surprised, asleep-waking |
| **Shaken** | −2 attacks, saves, checks | Failed morale, Intimidate |
| **Frightened** | Shaken + moves away from source | Dread creatures |
| **Panicked** | Flees; drops items 50%; can't attack | Morale fail by 10+ |
| **Fatigued** | −2 STR/DEX; can't run | No sleep, march, Boast, fever |
| **Exhausted** | −6 STR/DEX; half speed | Fatigue worsened, hypothermia |
| **Hungry / Starving** | See §11 | |
| **Thirsty / Parched** | See §11 | |
| **Wet** | Cold exposure +1 step; firearms use the Wet misfire column unless protected; −2 Stealth (squelch) | Fording, rain, swimming; dries 1 hr by a fire / 4 hrs in air |
| **Chilled** | −2 DEX and fine checks | Cold exposure |
| **Hypothermic** | Exhausted; Burden +2; Concentration DC 15 for any task | Cold exposure worsened |
| **Overheated / Heatstroke** | Mirrors Chilled/Hypothermic | Summer labor |
| **Bleeding (slow/fast/severe)** | Blood loss per minute | Wounds |
| **Pale / Faint** | −1 / −2 and Fatigued | Blood loss |
| **Staggered** | One action per 6 s; half speed | Wound Burden ≥ CON/2 |
| **Spent** | Every hit wounds | Vigor 0 |
| **Dying** | Unconscious; Fort DC 10 (+1 per check) every minute to stabilize; fail by 5+ → dead | Vital Critical wound, Burden ≥ CON, bleed-out |
| **Unconscious** | Helpless | Nonlethal ≥ Vigor, Collapse |
| **Stunned** | No actions; −2 Defense, no DEX | Head wound, Grievous shock |
| **Dazed** | No actions | Nearby blast, Boast |
| **Deafened** | −4 initiative; −4 Perception (hearing); spell verbal failure 20% | Gunfire ≤ 15 ft |
| **Prone** | −4 melee; +4 Defense vs. ranged, −4 vs. melee; stand = 3 s, provokes | Trip, fall, cover-diving |
| **Grabbed / Held / Pinned** | §9.6 | |
| **Entangled** | −2 attack, −4 DEX; half speed | Snare of Roots, brush, nets |
| **Sickened** | −2 attack, damage, checks, saves | Bad food, curses |
| **Nauseated** | Move only | Milk sickness, fae-sickness |
| **Fevered** | Fatigued; −2 INT/WIS checks | Infection, ague |
| **Tipsy / Drunk / Insensible / Hungover** | §11 | |
| **Fascinated** | Stands and attends; −4 Perception | Patter, fae music |
| **Charmed** | Treats the caster as a trusted acquaintance | Fair Words |
| **Glamoured** | Perceives an illusion as real | Glamour of Seeming |
| **Pixie-Led** | Wayfinding fails and the actor walks in circles; WIS checks hourly at DC by Fae intensity | Wilds at night; broken by Coat Turned |
| **Encumbered (Med/Heavy)** | §11 | |
| **Hidden** | Unseen; attacks from Hidden target Unready | Stealth success |
| **Cursed** | Per curse (06); always has detectable signs | Witch rites |
| **Iron-Sick** | −2 all checks while touching or near cold iron | Fae-Touched, some ancestries |

---

## 14. Worked examples

### 14.1 Adventurer: Josiah Penhallow, Woodsrunner 1
A Cornish miner's son out of the lead diggings who took to the woods instead. Outfitter's Standard (25 points). Ancestry: placeholder human-equivalent (all mods 0).

| STR 13 (+1) | DEX 15 (+2) | CON 14 (+2) | INT 10 (+0) | WIS 12 (+1) | CHA 8 (−1) |
|---|---|---|---|---|---|
| cost 5 | 8 | 6 | 2 | 4 | 0 | 

Total 25. The creator shows this cost row live, because point buy should show its math.

- **Vigor** 8 + 2 = **10**. **WT 14** (7 vs. Wounding). Blood 14. Defense 10 + 2 + 1 (heavy wool coat) = **13**. BAB +1. Fort +4, Ref +4, Will +1. Initiative +2.
- **Skill points:** (6 + 0) × 4 = 24. Woodcraft 4 (+5), Tracking 4 (+5), Riverwork 2 (+3 STR / +3 WIS), Swim 2 (+3), Stealth 4 (+6), Perception 4 (+5), Trapping 2 (+2), Athletics 2 (+3).
- **Feats:** Steady Aim (L1); **Upbringing**: Prospector's Nose (miner's son). **Quarry:** wolves & dogs.
- **Outfit** ($50 budget, see 03): flintlock long rifle (secondhand, $14), powder horn + 1 lb powder + 5-lb lead bar ($1.25), oilcloth gunlock cover ($0.50), hatchet ($0.65), 3-point wool blanket ($3), flint, steel & char tin ($0.25), canteen ($0.75), tarred-canvas haversack ($0.75), 5 days of hardtack and bacon (~$0.70), 50 ft of hemp rope ($1)... and the $1.25 brogans versus $0.50 moccasins question, which is exactly the catalog agony 00 wants.

### 14.2 Witch: Grete Vosberg, Witch 1
A German dairy farmer's widow in Kettle Coulee who took the Prince's bargain during the cholera summer. Homestead Roll: 15, 14, 13, 12, 10, 9.

| STR 9 (−1) | DEX 12 (+1) | CON 13 (+1) | INT 10 (+0) | WIS 14 (+2) | CHA 15 (+2) |
|---|---|---|---|---|---|

- Vigor 6 + 1 = **7**. WT 13. Defense 11. BAB +0. Fort +3, Ref +0, Will +4.
- Skills (4 + 0) × 4 = 16: Herbalism 4 (+6), Fae Courtesy 4 (+6), Stealth 2 (+3), Lore (Fae) 2 (+2), Trade (Dairying) 2 (+2), Read People 2 (+4).
- Feats: **Name-Keeper** (L1); Upbringing: **Iron Gut** (farm life). Hardship: **Wanted** (Kettle Coulee believes she poisoned the Ahrens' well) → bonus feat **Second Sight**.
- Class: Prince's Mark; Familiar (a one-eyed barn cat, its own actor); Curse Rites known: 2 (06). Spells known: Wisp-Light, Kindle, Fair Words, Snare of Roots. Spell points 3/day. **Unhallowed:** she can't cast within sight of the Lutheran steeple without a Will check.

### 14.3 T0 scene: Rush Creek at dusk, then the hodag
**Setup.** Late April. Three days of rain have put Rush Creek at flood stage. Josiah (Wet: no, Fatigued: no, Load: Light, 28 lb) reaches the old ford at 7:40 pm, and the sun set at 7:52. Fae intensity at the ford tile is 2. Wind is from the NW.

**1. Reading the water.** Josiah auto-uses Riverwork (WIS) to read the ford: base time 1 min, Steady allowed (no threat present). 10 + 3 = 13 vs. DC 10. He learns the ford's crossing DC: **Riverwork (STR) DC 19** = 10 (wade, waist-deep) + 5 (rising) + 2 (dusk) + 2 (debris in the current). If he fails by 5+ he's **swept** (Swim DC 20 in current, carried d4 × 30 ft per 6 s toward the next riffle). The UI shows every term.

**2. The player's options** (paused):
- **Steady:** 10 + 3 = 13 < 19. Steady isn't enough, and the UI shows that.
- **Normal:** needs a 16+ (25%). Swept on 10 or less (50%). Bad odds.
- **Work It Through to find a better crossing:** Riverwork take-20 at 20 × 1 min = 20 min. It's dark by then (+5 for darkness replaces the +2 for dusk), but he finds the shoals 200 yd upstream: base DC 5 (knee-deep riffle) + 5 + 5 + 2 = **17**.
- **Rope:** tie off on a sycamore and use the rope as a handline: +4 (an aid item, 03), and a swept result becomes "lose your grip, Swim DC 15 to hold the line".

The player chooses to Work It Through plus the rope. DC 17, bonus +3 +4 = +7, needs 10+ (55%). Swept on a 4 or less (20%), but the rope turns that into a Swim check. He also spends 1 min wrapping the rifle lock in the oilcloth, because powder protection must be *declared*.

**3. The crossing.** It takes 2 checks (the shoal is 2 segments). Rolls 14 (21, pass) and 4 (11, fails by 6 → swept, but roped → Swim DC 15: rolls 12 + 3 = 15, holds). He's waist-deep for 40 s. Water temperature is 46°F, so **cold shock**: Fort DC 15: he rolls 16 + 4 = 20 and is fine. He's **Wet**. The air is 41°F with a wet wool coat: the exposure band moves from Mild → Cold, with Fort checks every 10 min. Practice: the Riverwork DC (17) is inside his learning window (3 + 3 to 3 + 18), so +1 mark. Swim also gets +1 mark.

**4. Camp or push on?** He's Wet in Cold exposure. At 8:10 pm the first Fort check comes up 9 + 4 = 13 < 15, and he's **Chilled** (−2 DEX). The player decides to make a fire. Woodcraft (fire) in wet conditions is DC 15, Normal: 11 + 5 = 16 ✓. Kindling takes 10 min. Drying takes 1 hour.

**5. The hodag.** It's 8:35 pm. The hodag (a CR 3 Large beast with Feed intent from 05's hunger state, Stealth +6, Defense 15 including +4 natural armor, CON 16) works upwind toward the fire. Josiah is tending the fire, so the sim uses his passive Perception: 10 + 5 − 2 (dark beyond the firelight) = 13. That's against the hodag's Stealth roll of 11 + 6 = 17, so **Josiah is surprised.** Chilled (−2 DEX score) drops his DEX mod to +1. He rolls Initiative 9 + 1 = 10, a delay of (30 − 10) × 0.1 = 2.0 s, plus 3 s for surprise = **5.0 s Unready**. The hodag rolls Initiative 15 and acts at 1.5 s. It is a **Dread** creature.

- *t = 1.5 s:* The hodag charges from 40 ft (+2 for the charge) with a horn gore at +7. Josiah is Unready, so his Defense is 11 (no DEX). The hodag rolls 13 + 9 = 22 and hits for 1d8 + 5 = 9. His Vigor drops from 10 to 1. Horns have the Wounding property, so his WT is halved to 7. The 9 damage meets that, so the excess over 3 becomes Wound damage: 6 points, **Serious**. The location roll is 12: **left arm**. That gives −2 to two-handed use and a slow bleed (Blood −1/min). The first wound plus a Dread creature triggers a morale check: Will DC 10 + Threat 6 = 16. He rolls 17 + 1 = 18 and holds **steady**. On a failure he could have panicked straight back into the creek.
- *t = 5.0 s:* Josiah's first action, and the player pauses. The options:
  - fire the rifle at point-blank (this provokes an AoO; −2 for the arm)
  - wave a burning brand (STR-based Intimidate, +4 vs. animals because of the fire, against the hodag's morale)
  - dive back into the creek (the hodag's data lists Swim −4)
- He fires. The AoO resolves first, during the shot's windup. Josiah is now Ready, so his Defense is 12 (10 + 1 DEX + 1 coat). The hodag rolls 6 + 7 = 13 and hits for 7. That takes his Vigor from 1 to 0, so the 6-point overflow becomes Wound damage. The WT test gives 7 − 3 = 4, and the larger value is used (§8.3): 6 points, **Serious**, location 5, **torso**, slow bleed. His Burden is 2 + 2 = 4 against CON 14 (Staggered at 7). He is **Spent** but still on his feet.
- The shot itself: +1 BAB, +1 DEX, −2 arm, and no Steady Aim because the player wouldn't spend 3 s aiming, for a total of +0. At point-blank the ball ignores the hodag's natural armor, so it's against Defense 11. The natural 15 isn't in the misfire range of 1–2; he uses the dry column because the oilcloth was declared. The total of 15 **hits** for 1d10 = 8. The hodag's WT of 16 is halved to 8, so 8 − 4 = 4 Wound points, **Light**, on the right foreleg. A smoke cloud spawns. The sound event carries about a mile, and the Haugen farm across the ridge hears it. That's a T1 event, which becomes a rumor.
- The hodag makes its own morale check, triggered by its first wound and by gunfire it isn't used to. The DC is 10 + Threat 3 = 13. It has Will +3 and takes −2 because it is a Feed-intent animal that has been wounded. It rolls 6, for a total of 7. That fails by 6, so it **falls back** into the dark beyond the smoke.
- Josiah bandages both slow bleeds. He's untrained, but Medicine allows untrained use at DC ≤ 10. The arm succeeds (13). The torso fails (8), and the retry a minute later succeeds (14). He builds up the fire. He reloads behind the sycamore, not in the open (35 s). Without Light Sleeper, he sleeps at −10 Perception. If the hodag gets hungry enough (05), it may come back.

**Aftermath.** Josiah drove the hodag off, which counts as overcoming it. That's a CR 3 threat at L1, worth 300 × 1.5² ≈ **675 XP**. The ford was a CR 2 peril, worth 300 × 1.5 = **450**. His total of 1,125 makes him **level 2** after one very bad night. That's probably too fast **[OPEN: tune the peril XP down]**. He also earned practice marks in Riverwork and Swim. Each of his two Serious wounds needs a daily infection save: Fort +4 vs. DC 8 + 4 (Serious) + 2 (river water; a bite or gore counts the same) = **14**, minus 2 if he keeps clean dressings on. That means a real chance of fever on Thursday, out in the Wilds, three days from the Outfitter. That's the story he'll tell.

### 14.4 The same kind of event at T1: Ole Haugen goes to Readstown
Ole Haugen (Hand 2, Riverwork +4, Swim +2, Perception +3, Vigor 11, CON 12, an old shotgun) has the **activity** "Travel: Haugen farm → Readstown store, 3 hrs, departs 6 pm" on the same evening, crossing Rush Creek 2 miles downstream. The region is T1 because Josiah's site is the only one promoted to T0.

1. **Route hazards** come from 05's segment data: [ford: Rush Creek, conditions averaged over the hour = DC 19 at the main ford], [encounter roll: Wilds edge, Fae intensity 1–2].
2. **Policy:** Ole's traits are Cautious and Stubborn (04). The policy chooser compares P(swept) at the main ford for his +4 against a DC of 19 (swept on 9 or less on the die = 45%) and decides to take the alternative: "walk up to the footlog" (+40 min, which pushes his arrival to dark). This is the same choice Josiah made, made by policy. *If his Cautious trait had been Reckless, he'd have taken Rush or Normal at the ford.*
3. **Footlog crossing:** Acrobatics (balance) DC 15 (wet log, dark), base 2 segments. Ole has +1. He falls if he fails by 5+, which means a roll of 8 or less: 40% per segment. Over 2 exposures that's a 1 − 0.6² ≈ 64% chance of a fall. With no threat present he could Steady, but 10 + 1 = 11 < 15, so he wouldn't fall and wouldn't get across either. The policy chooser looks at both numbers and Ole turns back. The activity resolves as **Setback: did not cross; went home; mood −3 "flooded out"**. No dice were rolled at all. That's realistic, because most farmers stayed home when the creek was up.
4. Suppose instead that Ole's brother-in-law Torvald (Reckless, Riverwork +6) makes the crossing on the same night. The T1 engine rolls **once** for the ford band at the main ford: DC 19, Normal policy. The bands come from margins. **Pass** (total ≥ 19, a roll of 13+): 40%. **Struggle** (total 15–18, a roll of 9–12): 20%, leaving him wet and cold with +1 practice mark. **Swept** (total ≤ 14, a roll of 8 or less): 40%. The roll is a 7: **Swept**. Next comes one roll on the calibrated rescue table for Swim +3 against DC 20, with 3 exposures before the riffle. That table is **Reached bank** 70%, **Reached bank, exhausted, lost gear** 22%, and **Drowned** 8%, all fitted from T0 runs. The roll comes up **Reached bank**. The engine records the Wet and Chilled conditions and rolls one cold-shock Fort. If the result had been "Drowned," the director (05) might be offered a promotion: "body found at the Rush Creek mill dam", and the Chronicle and the rumor system would carry it.
5. **Encounter roll** for Torvald's route segment at the Wilds edge: P(encounter) from the 05 ecology state, here the hungry hodag (which T0 and T1 share as one actor). If the hodag is engaged at T0 with Josiah at that time, it's unavailable. That's **consistency**: an actor exists in exactly one tier. Otherwise the **skirmish abstraction** resolves the fight:
   - Each side's **Threat Value** = expected damage per 6 s × expected rounds to break morale, computed from the sheets via the same attack, Defense, and morale functions (07 caches these per pairing).
   - One roll on a band table derived from the T0 Monte Carlo for "Hand 2 with a shotgun vs. hodag CR 3, surprised, night": Unharmed (10%), Drove it off (25%), Wounded and drove it off (35%), Fled wounded (20%), Killed (10%).
   - The wound result uses the *real* wound pipeline: one hit, roll damage, WT test, location, severity. So the wound Torvald carries home is a real wound object that can later get infected at T1 (daily infection saves continue as cheap daily rolls).
   - Outputs: Memory ("the hodag at Rush Creek", vivid), Rumor ("the hodag's back on Rush Creek"; 04 mutation may make it "two hodags"), Opinion (+ toward Josiah if Torvald heard his shot and later learns it was him), and XP credited (the band "Drove it off" = overcome → CR 3 XP at Hand level).
6. **T2:** the county's tally for the season contains "flood crossings: 312, swept: 41, drowned: 3", computed as population × crossing rate × P(swept) × P(drown | swept), using the same Riverwork probability function against the population's skill distribution. When Josiah reaches Readstown, the storekeeper's line "lost three to the creeks this spring" is *true* in the sim.

---

## 15. Open questions for Ellie

1. **Level cap:** is 12 right for v1? Do you want an E6-style "levels 1–6, then feats only" gritty option instead? Or the full 1–20 eventually?
2. **Ability names:** keep the classic six names (my recommendation) or rename them to fit the period?
3. **Practice:** do you like the hybrid points-plus-practice approach? Is "practice ignores cross-class" too generous?
4. **Vigor + Wounds:** is the wound system's lethality (firearms halve WT) in the right place? Should a single musket ball be able to kill a level-1 character outright? Currently it's possible but rare: it takes a crit to the head or torso.
5. **Alignment:** OK to drop it entirely in favor of 04's minds and deed tags?
6. **Classes:** is the starter nine right? Any you'd swap (a Lawman? a Lumberjack-type? a Schoolmarm distinct from the Almanacker)? Should non-witches ever be able to *become* Witches mid-run through the Prince's offer?
7. **Magic traditions:** four engines (slots, slots plus faith, charms, tidal spell points) is a lot to build. Would you trade one away for scope, e.g., fold Divine into Arcane mechanics?
8. **Gunpowder and fae:** should fae magic or high Fae intensity make powder unreliable ("the Fair Folk hate the stink of it")? It's a strong flavor lever with big balance effects.
9. **Morale for the player:** should the *player* character ever be forced to flee by a failed morale check (RimWorld-style mental breaks), or should it be advisory (penalties only)? I lean toward forcing it only at "Panicked," with an option to turn that off.
10. **Ancestry and prejudice:** should 04 opinion priors be able to key on ancestry? (See §12.)
11. **Spell catalog size target:** how many spells at launch? I'd suggest ~120 across levels 0–6, plus ~30 curse rites in 06.
12. **Curse XP:** do witches level from curses (XP) as well as gaining Woe, or should Woe be their *only* progression, with levels coming from other deeds?
