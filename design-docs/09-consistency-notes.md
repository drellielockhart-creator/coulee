# 09 — Consistency Notes

**Status:** Current-state audit, 2026-10-11, after the 2026-10-10 revisions of 01–07 and the arrival of 10–12 and ADRs 0002–0003. Canon order: [00](00-vision-and-pillars.md), then the [ADRs](adr/0001-typescript-stack.md). Implementation ownership and contracts are in [MODULES](../docs/impl/MODULES.md).

**Status key:** **[RESOLVED in <doc §>]** means the documents now agree, not that Ellie has approved every numerical proposal. **[STILL OPEN - NEEDS DECISION]** marks an actual design choice. **[PARTIAL]** means ownership or direction is settled but a contract, integration edit, or validation remains. Decisions are consolidated in [08](08-open-questions.md); implementation tasks are not approval requests.

**Most consequential remaining disagreements:** county seat on/off-map (C9); ordinary versus uncanny grudge decay (C12); fae time-loss limits (C18); curse DC and weakness offsets (C27/C29); PC agency and unconscious knowledge (C50/C51); human ability modifiers and faekin recruitment (C53/C54). M5a and playable headless sessions are decided; their integration into 07 remains incomplete (C57–C62).

## 1. Conflicts C1–C49

### Canon and setting

- **C1. Stack. [RESOLVED in 07 §2.1–2.3]** TypeScript PWA replaces the historical Rust/Godot recommendation; ADR 0001 governs.
- **C2. Pocket play and performance. [PARTIAL]** 11 §2–3 covers the screens and 07 §6 adopts device-independent simulation; reference devices, measured budgets, and World presets still need ratification (11 §5, Q1–3).
- **C3. Psyche versus Values. [PARTIAL]** 04 §3 and 10 §3 split epistemic dispositions from norms/drives; WIS seeding and the fold remain proposals, and Discretion's ownership wording still differs (C52).
- **C4. Persona versus Figure. [RESOLVED in 00 Shared vocabulary; 04 §5.7]** Figure is the rumor identity; Persona is the psychological mask. The old complaint about 00's Grudge/Notoriety/Reputation definitions is obsolete: they already say Figure.
- **C5. Peoples as empty slots. [PARTIAL]** 01 §6, 02 §12, and 12 specify the four decided peoples; 12 §4 distinguishes heritage, Drift, vocation, and changelings. Origins, numerical traits, and framing remain proposals, not an undecided roster.
- **C6. Start date. [RESOLVED in 05 §1.2; 06 §7.1]** New runs start in spring 1855; later dates come from legacy skips. The Civil War timeline remains a separate choice (01 Q2).
- **C7. Divergent example names. [RESOLVED in 01 §8.4; 02 §14; 04 §15; 06 §9]** Hollin names have a crosswalk, other worked worlds are labelled illustrative, and Rev. Whitcomb became Rev. Ashby. Approval of cast templates is still content work, not a broken identity model.
- **C8. Authored versus generated town. [RESOLVED in ADR 0003 Decision 1–4; 06 §2.2]** Procedural counties are the target; Hollin is the flavor bible/constraints, Iron Ford an authored fixture, and Threshold Town a generated role.
- **C9. County scale and seat. [PARTIAL]** 05 §1.2, 07 §6, and 11 §5.6 converge on Small/Standard/Large (~400/800/1,500 named). **Seat location still needs a decision:** 01 §3.2/Q20 puts it on-map with the land office off-map; 05 §1.2/Q15 recommends an off-map seat and incorrectly says 01 agrees. Do not conflate that conflict with the settled census rule.
- **C10. Native nations and artifact treatment. [PARTIAL]** 02's Lore (History), 03's imported gunflint goods, and 05/06's fae-thorn fixes remove the old artifact conflicts. 01 §2's A/B/C/D choice, consultation budget, and the conditional sovereign-neighbor faction remain open before generated setting content ships.
- **C11. Two meanings of Drift. [RESOLVED in 01 §4.1; 12 §3.1]** Ice/erratics name the anti-fae power; Drift remains the universal 0–100 movement toward Faerie.
- **C12. Grudge decay. [STILL OPEN - NEEDS DECISION]** 01 §4.4 and 04 §6.3 offer an uncanny-founded non-decaying flag; 04 Q11 still offers ordinary decay for all humans instead. Rec: uncanny grudges persist; ordinary feuds cool; fae grudges never decay (10 §10).
- **C13. Witch trials and law. [PARTIAL]** 01 §5.4, 04 §9.2, and 05 S6 now distinguish mundane prosecution, church discipline, and mob action. No-witchcraft-statute is the shared proposal; Ellie can still choose a statute (01 Q6).
- **C14. Direct fae harm. [PARTIAL]** 01 §4.5's per-court Forfeit Rule supplies trespass/bargain/hospitality/tribute bases for 05's incidents. Scope and child-related forfeits need approval with the content limits, rather than a new exception in each incident.
- **C15. Prince: fixed or generated. [PARTIAL]** 01 §4.4 and 06 §3.4 keep his motive and sincerity fixed. Overlay lists differ: 01 Q17 allows Capricious/Jealous/Melancholy; 06 Q3 also allows Exacting/Wry. Choose the overlay pool, not a wholly new Prince.
- **C16. Ferryman's patron. [RESOLVED in 03 §10.4]** The ferryman belongs to the River, not the Thorn Court.
- **C17. Magic framing and FI curves. [PARTIAL]** 01 §5.3 and 02 §10.1 now map cultural traditions to engines and offer the same FI curve. Four-engine scope, congregation-versus-cleric belief, and a settled-pastor path remain choices (01 Q5/Q24; 02 Q6–7).
- **C18. Time-slip severity. [STILL OPEN - NEEDS DECISION]** FI3–4 ratios agree, but FI5 is up to ×24 in 01 §4.5–4.6 versus ×8–12 in 05 §1.4. 01 still permits a disclosed 1d6-day traversal while 05 withdraws that rate; caps are three outside days per sitting versus six days per traversal. Director/festival exceptions also differ, and 05 F1 still permits an All Hallows exception. Rec: one non-consensual cap and explicit consent for every larger loss; decide whether reverse slip survives.
- **C19. Festival names and Tithe. [RESOLVED in 01 §4.6; 05 §4.5; 06 §3.6]** Settler festival names, monthly full-moon Tithe, and separate harvest Behests now coexist. Easter/Lent granularity remains a taste choice.

### Rules, gear, and survival

- **C20. Skill vocabulary/investigation. [RESOLVED in 02 §4.5]** Gather Information is now a CHA skill and Trade (Cartography) exists. 04 Q16's “until then” fallback is stale, not a missing skill; acceptance of the new skill is still 02 Q13.
- **C21. Clock and combat speed. [PARTIAL]** ADR 0001's minutes and 40 real seconds/game-hour are adopted; 02 §7 and 07 §3.4 propose 0–599 tenths within a minute. Auto-Tactical and pause-on-hostility still need approval (02 Q15; 07 Q1; 11 Q5).
- **C22. Encumbrance. [RESOLVED in 02 §11.1; 03 §4; 05 §1.4]** 02 supplies capacity, 03 the five bands/penalties, and travel reads those bands.
- **C23. Insulation. [RESOLVED in 03 §3.5/§6.6; 05 §6.3]** Units are °F comfort-band extension; wool retains 50% wet insulation. 02 §8.6 removes the duplicate Wet exposure step.
- **C24. Hunger/fatigue stages. [PARTIAL]** 05 §6 owns ledgers/rates and 02 §11 effects, on integer 0–1000 needs. The stale “pending 05” threshold reference in 02 is corrected; rate/difficulty calibration and the shared planner still need M4 validation.
- **C25. Disease. [RESOLVED in 02 §8.7; 05 §6.5]** One per-victim rules/epidemiology split; 05 owns incubation and fatality calibration. Default lethality remains 05 Q12.
- **C26. Fae food. [PARTIAL]** 02 §11.2 owns Bound → Longing → Wasting; 03 supplies the flag, 05 nutrition, 06 Drift, and 10 the thought. Verify zero true kcal versus perceived satiety and reduced mortal-food satisfaction in the shared planner; condition rates remain proposals.
- **C27. Fae weaknesses. [PARTIAL]** Ownership is settled in 06 §3.8.1: nature versus claim, IP as an input, heritage excluded from claim. Offset rules disagree: 02 §12.4 proposes highest-wins (+20 feature/+40 Hardship), while 06 still describes a +20 feature/hardship and a people-only effective-Drift formula. Ratify the split and publish one combination rule.
- **C28. Cold iron. [STILL OPEN - NEEDS DECISION]** 03 §3.3/Q3 offers cold-hammered/unquenched ×3, all iron, or rare meteoric/bog iron. Other docs cite the premium tier as a proposal; no canon definition has been chosen.
- **C29. Curse resolution. [STILL OPEN - NEEDS DECISION]** 02 §10.6 proposes `10 + floor(level/2) + CHA + link + timing + Gifts + Woe boost`; 06 §3.5 retains its interim `10 + level + link + timing + Gifts`. 02 owns the DC; 06 owns links/protections/economy. 11 §2.13's Working card must read the chosen formula.
- **C30. Witch power and XP. [PARTIAL]** 02 §6.3/§10.4 and 06 §3.6 now agree: Woe has rite/Gift and spell-power sinks; XP rewards overcoming obstacles, not suffering farming. Exchange rates and acceptance of that XP rule remain proposals (02 Q12; 06 Q18).
- **C31. Background ownership. [RESOLVED in 06 §7.4; 03 §7.2]** 06 owns one table with 02 feat/skill and 03 purse/gear columns; unfinished purse rows are content gaps.
- **C32. Shared names. [PARTIAL]** Creation uses Class versus prestige Calling (06 §7.1). Circuit Rider and Hidebehind still name multiple things; keep or rename is a taste call, not an architecture blocker.
- **C33. Ability generation. [RESOLVED in 06 §7.1]** Creation lists all three 02 methods.
- **C34. Prices and wages. [RESOLVED in 02 §10.3; 03 §6; 06 §9.1]** Charm costs were reduced roughly tenfold; starter examples now use the catalog's prices. The old luxury-charm complaint is obsolete.
- **C35. Reloads and weapon stats. [RESOLVED in 02 §9.5/§9.10; 03 §6.7–6.8]** Reloads agree and the missing arms/armor now have stats. Armor Turn remains an explicit optional rule (02 Q18).

### Mind, world, and architecture

- **C36. Opinion model. [RESOLVED in 04 §6; 06 §3.4; 07 §3.3]** Affection/Respect/Trust/Fear, Reasons, separate grudges, and Obligation ledger; the Prince's desire is a targeted drive, not a fifth dimension.
- **C37. Memory/belief/rumor semantics. [RESOLVED in 04 §4–5/§8/§11; 07 §3.3/§5]** 07 now implements interned propositions, evidence, lineage, and compartments rather than a competing simplified design.
- **C38. Need registry. [PARTIAL]** 10 §3.4 publishes the proposed need-to-drive registry; 04 owns social satisfaction and 05 physical rates. Ratify that boundary and complete the fae-specific needs alongside 10 §10; “no list exists” is obsolete.
- **C39. Event shape. [RESOLVED in 07 §3.5; 05 §9.1]** 07 owns the additive superset including causes, visibility, importance, tier, tenth, and Director linkage. Code fields still need implementation; importance-scale conversion must be explicit (C56).
- **C40. LOD policy/mechanism. [PARTIAL]** 05 §3 owns policy, 07 §5 mechanism, 04 §11 social hydration. Hourly T1 and six-hour rumor substeps agree; promotion/backfill equivalence, caps, and permitted trivia drift need verification/ratification.
- **C41. Persecution ladders. [RESOLVED in 04 §9.7; 05 §7.1; 06 §3.9]** 04 owns target rungs 0–6; 05 alerts cover non-person threats; witch labels map to the highest linked target rung. Fear/suspicion are derived views over misfortune and community anxiety.
- **C42. Notoriety tiers. [PARTIAL]** 04 §8.6 now has a seven-tier table; 02 reads it. 06 §2.3/§2.8 still calls its Glory/County Legend thresholds placeholders pending that table; align the labels/thresholds rather than invent another notoriety scale.
- **C43. Director rumor powers. [RESOLVED in 04 §8.2; 05 §8.3; 07 §3.5]** Nudges voice only claims some carrier knows; falsehood comes from actors' beliefs, not direct Director fabrication.
- **C44. Chronicle truth. [RESOLVED in 05 §11; 06 §1.2; 11 §2.5]** Fair play contains known/public facts; rumor/truth comparison belongs to the post-run epilogue. Legacy spoiler presentation may be adjusted without reopening live omniscience.
- **C45. Fae currency. [PARTIAL]** 03 §8.7 and 05 §5.3 now use 06's Woe; FI remains a field and offerings remain inputs. 05 Q5 explicitly leaves single-currency acceptance open; no second spendable glamour meter should be implemented meanwhile.
- **C46. Outfitter identity. [RESOLVED in 01 §8.3; 03 §8.3; 06 §9]** Gussie Pratt owns the Iron Ford fixture; Halvorsen is labelled as an illustrative generated proprietor.
- **C47. Alternate identities. [RESOLVED in 04 §5.7–5.8; 10 §8.1; 12 §7.1]** Masks are Personas; aliases/covers can be Figures; concealed people is one identity with a Secret and presented-kind field, not an automatic second Figure.
- **C48. P8 provisions. [RESOLVED in 03 §3.7–3.9; 05 §6; 02 §11; 10 §3.4; 11 §2.8]** Item fields, burn/environment, deficiencies, monotony thoughts, pantries, and planner ownership now exist. Difficulty/calibration and structures remain work; P8 itself is decided.
- **C49. Numeric invariants. [RESOLVED in 07 §4; 04 §13.5; 05 §13; 10 §14.2; 12 §10.4]** Integer/fixed-point/LUT forms replace runtime transcendental math; surviving continuous formulas are explanatory or offline. Credence carry remains an implementation proposal (04 Q19; 07 Q2), not permission to ignore ADR 0001.

## 2. New conflicts and integration gaps C50+

- **C50. PC agency versus Ego/Fits. [STILL OPEN - NEEDS DECISION]** 10 §5.5 recommends advisory choices with anxiety costs; 02 §9.8 additionally recommends forced Panicked Fits in Frontier. Choose defaults once, with Commands obeying the same urge/cost rules as NPCs (P2; ADR 0002).
- **C51. Fair Explain versus self-knowledge. [PARTIAL]** 10 §8.5 and 11 §2.3 hide the PC's defenses/Shadow until Insight; ADR 0002 exposes own thoughts and participated-check math. Define which Explain fields are conscious and which require Insight/god view; participation alone must not reveal a masked defense.
- **C52. Discretion stored or derived. [PARTIAL]** 10 §3.3/Q5 calls three Values social dispositions, but its table assigns Discretion to Persona control; 04 §3.1/Q1 keeps only Superstition/Rancor independently. Rec: two stored dispositions plus derived Discretion; update 10's summary when the fold is accepted.
- **C53. Human floating ability modifier. [STILL OPEN - NEEDS DECISION]** 02 §12.4/Q17 allows considering INT/WIS/CHA for humans; 12 §1/§9/§10 limits all peoples to bodily ±1 modifiers, or none. One ancestry rule must cover humans too.
- **C54. Faekin prevalence among witches. [STILL OPEN - NEEDS DECISION]** 12 §1 says faekin are not disproportionately witches; §6.2 says recruitment/persecution produces structural over-representation. Decide equal realized prevalence versus equal aptitude with emergent recruitment bias, and calibrate pre-roll/playtests accordingly.
- **C55. Director access to the unconscious. [STILL OPEN - NEEDS DECISION]** 05 §8.3/Q18 permits reading anxiety and arranging stressors, never writing psyche state; 10/11 restrict self-knowledge. Approve the read boundary and decide whether “Show the Director's hand” redacts unconscious inputs until Insight.
- **C56. One interrupt policy across clients. [PARTIAL]** ADR 0002 requires shared headless/pocket interruption; 07 §7.3 and 11 §1.6 place scores in the web worker and coalesce by real seconds. Put game-relevant stopping in the pure play/session layer, convert event importance explicitly, and keep wall-clock toast coalescing in presentation. Ratify thresholds/defaults; test identical stop points.
- **C57. M5a missing from detailed 07 plan. [PARTIAL]** ADR 0003 fixes worldgen before M5. Surgical pointers now restore the order in 07, but a full M5a scope/acceptance block and `packages/worldgen` integration still belong to the lead; no order decision is pending.
- **C58. Generated-world replay identity. [PARTIAL]** ADR 0002 says scenario + seed + commands; ADR 0003 adds constraints, pins, layer versions, and `gen_version`. 07 §7 saves content/engine versions but needs a canonical world recipe in sessions, saves, forks, and playtest reports. This is an additive contract task, not a choice between authored and generated worlds.
- **C59. History pre-roll versus phone budget/lifecycle. [PARTIAL]** ADR 0003 targets 5–10 years of headless history inside <3 s new-game generation; 07 M1 allows ≤3 s for one year alone, and lifecycle remains scattered. Benchmark the full layered pipeline; choose the first pre-roll duration and authored-actor survival/placement policy without silently relaxing the ADR target.
- **C60. Worldgen QA versus hungry spring. [STILL OPEN - NEEDS DECISION]** ADR 0003 rejects “starvation within a month,” while 05 §6.9 and 07 M4 deliberately produce shortage and some household mortality. Define whose starvation invalidates a seed, and hard failures versus allowed difficult worlds; include playable routes, food access, fae anchors, and tensions.
- **C61. Harness versus playable headless game. [PARTIAL]** 07 §10.2 documents `run`/`inspect`, not ADR 0002's `packages/play`, PlaySession, REPL/JSONL, stable actions, wait-until, save/load/fork/replay, and fair/god observations. UI parity is decided; the API/transport plan needs integration.
- **C62. Every-milestone playtests. [PARTIAL]** ADR 0002 requires agent passes and report/commands/metrics artifacts at every milestone. 07's shared gate now cites that requirement; detailed acceptance criteria still need persona coverage, seeds, report triage, and a measurable pass rubric. Prototype QA scope is an open process choice, not whether agents playtest.
- **C63. Append-only log versus pruning. [PARTIAL]** ADR 0001 invariant 6 requires an append-only event log; 07 §3.5 proposes pruning low-importance events after 30 days. Distinguish immutable archived events from a compact active index/snapshot; replay, causes, Chronicle, and legacy references must survive. Escalate any actual deletion proposal to the lead.
- **C64. Site tile scale. [PARTIAL]** 05 §2.1 and 02 §9.9 target 5-ft tiles; the revised docs' implementation notes report a 10-ft schema/fixture. Ratify the target and make movement/range/zoom conversions read site data; visual scale cannot change the combat rules.
- **C65. Readiness accuracy. [RESOLVED in 03 §2.4; 11 §2.6]** 11's stale blanket “shorter and sometimes wrong” wording is narrowed surgically: only judgment is skill-gated; P8 arithmetic remains correct with forecast ranges. Acceptance of judgment gating remains 03 Q6.
- **C66. Agent forks versus Commitment saves. [PARTIAL]** ADR 0002 requires save/load/fork for A/B tests; 11 §4.4 refuses forks of Commitment runs and 06 §8.2 frames save discipline as gameplay. Specify designer/test forks separately from fair player save policy, recording mode and branch ancestry; preserve gameplay constraints.
- **C67. World content flags versus player settings. [PARTIAL]** 06 §3.2 fixes content toggles at world creation and 07 M8 replays them; 11 §2.14 presents settings and 10 Q13 leaves Fits/lust toggles open. Separate outcome-changing World flags from label/layout/notification preferences; headless and graphical clients must share World flags.
- **C68. Fae mind and animal arbitration. [PARTIAL]** 10 §10 proposes Id plus Law/no Ego/no defenses; 02 Q19 proposes fae Composure 0 and beast fear-only anxiety. 00 P2 and P7 still require shared sheets/minds. Define species data and arbitration exceptions once; elf renunciation lore does not automatically make elves Ego-less fae.
- **C69. Archetypes/cosmology versus people essentialism. [PARTIAL]** 10 §1 forbids people psyche profiles; 12 §3.1 calls elves “Faerie's Superego made flesh.” Keep that axis as lore/metaphor, not people-keyed psyche weights; any mechanical cosmology couplings require the separate 10 Q12 decision.

- **C70. Live rung truth versus fair knowledge. [PARTIAL]** 04 §12.3 calls “Show the rung” an opt-in P1 relaxation that tracks the true rung; 11 §2.13 assumes it as a setting. 00 P1 and ADR 0002 require fair knowledge gating. A fair meter must show learned/inferred escalation only; ground-truth rungs belong to explicit god/debug views. The lead must align that proposal and observation contract, rather than treat a normal UI preference as omniscience.

## 3. Ownership map

| Mechanism | Authoritative source | Contributors / readers |
|---|---|---|
| Pillars, glossary, spring 1855, dollars, peoples roster, P1–P8 | 00 | all |
| TS/PWA, determinism, numeric invariants, canonical clock, core contract | ADR 0001 | 07; MODULES for implementation contracts |
| PlaySession, UI/headless Command parity, fair/god observations, replay, agent passes | ADR 0002 | 07 machinery, 11 presentation, all milestone owners |
| Procedural default, layered worldgen, constraint/fixture parity, M5a | ADR 0003 | 01 flavor/templates; 05 geography/population; 07 machinery; 12 priors |
| Geography/lore, Native nations policy, courts, Forfeit Rule, Prince core, cast/name pools | 01 | 05, 06, 12; worldgen constraints |
| Fae intensity meaning and lore causes | 01 §4.6, within 00's scale | 05 field/calendar; 02 magic modifiers |
| Peoples lore/body/metaphysical fields, cultures, tells/ordeals, prejudice options | 12 | 02 sheet hooks; 04 evidence/priors; 05 census; 10 norms; 11 depiction |
| Abilities, skills, feats/classes/Callings, XP, checks, combat, conditions | 02 | 03 items, 05 hazards, 06 curses, 10 Composure |
| Curse DC | 02 §10.6 | 06 link/timing/protection inputs; 11 Working query |
| Capacity/size; encumbrance; insulation | 02 capacity; 03 bands and °F values | 05 travel/exposure; 11 inventory |
| Items, prices, Outfitter semantics, food/prep/storage/consumable fields, planner contract | 03 | 05 burn/environment; 02 deficiencies; 11 screens |
| Memory, belief/evidence, opinion/Reasons/Obligation, grudge, rumor, Figure, notoriety | 04 | 10 defense outputs; 07 data contracts |
| Persecution rungs/Heat/Consensus, identity belief and concealed kind | 04 §5/§9 | 05 non-person alerts; 06 witch labels; 12 tells |
| Drives/norms, thoughts, Ego/anxiety/defenses, Persona/Shadow, dreams, fae minds | 10 | 04 epistemics; 02 Will/morale; 06 Pact/Woe; 11 self-knowledge |
| Need-to-drive registry | 10 §3.4 (proposed) | 04 social satisfaction; 05 physical rates; 06 longing inputs |
| Region/site maps, travel, LOD policy, weather/ecology/calendar, epidemiology | 05 | 07 mechanism; ADR 0003 generation; 02 victim effects |
| Pantries/economy | 03 item inventories/prices; 05 production, burn, rationing/environment | 10 monotony; 04 social consequences |
| Director/nudges/Ledger, story sifting, Chronicle voices/epilogue | 05 | 04 knowledge; 10 inner inputs; 06 mode pressure; 07 storage/prose |
| Modes, Ambitions, Backgrounds/Origins, Pact, curse catalog, Woe/Tithe, Drift/weaknesses, endings, difficulty | 06 | 02 math; 03 purse/gear/protections; 04 social state; 10 psyche |
| Pocket/Folio/Desk layouts, controls, accessibility, packaging, visual style, reference devices | 11 | owning rules docs; ADR 0002 shared interruption policy |
| Data/event/save/worker contracts, LOD machinery, deterministic math, content pipeline, tests, milestone plan | 07 | ADRs; MODULES for additive module contracts |

## 4. Gaps and work still needed

These are missing specifications or implementation/validation, not automatically decisions for Ellie.

1. **Investigation:** 02 §4.5 now specifies Gather Information. Remaining work is consistent interaction/CLI/UI wiring; no missing-skill gap.
2. **Weapons/armor:** 02 §9.10 now fills the old catalog-stat gap. Remaining decision: Armor Turn; remaining work: content coverage and combat tuning.
3. **Notoriety:** 04 §8.6 now provides the table. Align 06's placeholder achievement labels (C42).
4. **Fae minds:** 10 §10 supplies a proposal. Ratify sincerity, Law, Composure and animal behavior; implement through the shared engine (C68).
5. **Native polity:** 01 §2.4 and 05 §7.2 reserve a sovereign-neighbor design. Concrete institutions/diplomacy depend on the representation decision and consultation.
6. **Construction/farming:** still no unified structure/roof/repair/build/harvest-labor contract, including smokehouses, cellars, and the witch hearth.
7. **Lifecycle:** still no consolidated birth/aging/marriage/death/inheritance/household succession rules. Necessary for pre-roll and long legacy skips (C59).
8. **Law procedure:** mundane hearings, warrants, fines, slander, jail, and faction authority remain sketches.
9. **Companions/hirelings:** 06 §2.6 sketches contracts and caps; stances, pay/desertion, travel/provisions ownership, and commands need a shared spec.
10. **T0 rivers/boats:** 02 skills, 03 vehicles, and 05 speeds exist; boarding, ferry/deck sites, currents, and vehicle ownership remain unspecified.
11. **Language/literacy:** partitions exist; untranslated gossip, documents and partial comprehension need fair observations and pocket affordances.
12. **Art/audio:** 11 §7 now gives palette, silhouettes, and Blender readability rules. Sound/music scope and goblin depiction approval remain.
13. **Pocket screens:** 11 §2–3 covers them. Validate thumb flows, interruption fatigue, accessibility, and headless parity instead of commissioning another screen spec.
14. **Psyche:** 10 exists. Remaining gaps are PC agency, unconscious Explain filtering, data migration and tuning, not a missing model.
15. **Peoples:** 12 exists. Lore proposals, priors, tells/lookalikes and culture-versus-people fields need ratification and content migration.
16. **Court politics/sleeping sovereign:** lore and generic clocks exist; inter-court schemes and consequences of waking remain a missing simulation spec.
17. **Onboarding:** 06 §9 gives opening scripts, 11 creation flows; reusable instruction/affordance discovery and Greenhorn playtest acceptance remain.
18. **Modding:** 07 §9 now specifies declarative effects and a possible QuickJS-WASM ceiling. No Rust scripting-language decision remains.
19. **Provisions:** 03/05/02/10/11 cover P8. Implement one planner/sim path, validate nutrition/spoilage/cooking and household transfers, and settle difficulty—not whether crunch exists.
20. **Playable headless layer:** implement ADR 0002 sessions/transports, stable action/query IDs, fair/god rendering, deterministic waits and artifact exports (C56/C61/C66).
21. **M5a worldgen:** integrate recipe/version/pin contracts, layers/site materialization, pre-roll, cast placement and seed QA (C57–C60).
22. **Acceptance evidence:** assign every milestone agent reports/repro logs/metrics, cross-engine checks and measured phone budgets. Decide pass bands; do not infer them from aspirational examples.
23. **Log/archive contract:** reconcile active compaction with append-only history and legacy/Chronicle/replay retention (C63).

## 5. History

The first integration pass on 2026-10-10 logged C1–C49 while 00 was changing and before 10–12 existed. It made roughly 135 word/number/reference edits: catalog prices and reloads aligned to owners; starter dates became 1855; skills were renamed; rumor Persona became Figure; Pratt replaced Pruitt as Outfitter; Class was separated from Calling; creation gained all ability-generation methods; sample content gained owner-correct fields. That log described the old Rust/Godot architecture and missing psyche/peoples/pocket/P8 specs, not the current plan.

Later 2026-10-10 rewrites supplied those specs. This 2026-10-11 audit preserves C-numbers, removes obsolete “missing doc” claims, adds C50–C70, and confines further edits in 01–07/10–12 to surgical stale-reference fixes. It does not approve proposals, change 00/ADRs, or claim that code has reached the design target.
