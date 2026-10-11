export const meta = {
  name: 'coulee-docs-v2',
  description: 'Write psyche/interface/peoples docs, rewrite 07 for TS, propagate decisions into 01-06, sweep, refresh 08/09',
  phases: [
    { title: 'New docs', detail: '10-psyche, 11-interface, 12-peoples, 07 TS rewrite (opus)' },
    { title: 'Propagate', detail: 'one agent per doc 01-06 applies decisions + resolves 09 items' },
    { title: 'Sweep', detail: 'haiku stale-reference sweep' },
    { title: 'Refresh', detail: 'update 08 open questions, 09 consistency, README (opus)' },
  ],
}

const D = '/home/eleanor/projects/coulee/design-docs'

const CTX = `
You are editing the design docs for "Coulee" (working title), a simulationist fantasy-frontier game: 3.5e D&D x RimWorld in a fae-haunted alternate Driftless Region of Wisconsin, spring 1855. The designer is Ellie Lockhart, an expert who works with AI professionally, so aim for density over hand-holding. Docs live in ${D}.

CANON, read first and follow:
- ${D}/00-vision-and-pillars.md: pillars P1-P8, glossary, decisions log.
- ${D}/adr/0001-typescript-stack.md: TypeScript stack, determinism invariants including the ban on transcendental Math (exp/log/pow/sin...) in the sim core, canonical integer game-minute clock, psyche-lite, peoples ids.
- ${D}/09-consistency-notes.md: 49 logged cross-doc conflicts (C1..C49), an ownership map, and gaps.
- ${D}/08-open-questions.md: the decision checklist.

ELLIE'S DECISIONS (2026-10-10):
- TypeScript implementation (07's Rust/Godot recommendation is superseded).
- Fully playable on phones via a "pocket" interface, with desktop also targeted.
- Freud/Jung psychology replaces D&D alignment: id and superego are competing forces in the thoughts system, the ego arbitrates, and there are defenses, Persona, Shadow, archetypes, and dreams. She called it "a fun thematic swing-for-the-benches."
- Peoples are humans, elves, shadow-faekin (hidden, somewhat between humans and elves), and goblins. Those one-liners are ALL she has said about them; anything more you write is a [PROPOSAL].
- Lots of meaningful supply crunch (P8): food types, rations, consumables.
- "Persona" (rumor identity) has been renamed "Figure"; Persona now means the Jungian mask.

EDITORIAL OWNERSHIP CALLS (made by the lead; apply them):
- Persecution ladder: 04 §9 owns it (rungs 0-6). 05's alert levels apply only to non-person threats, or derive from 04. 06 supplies witch-facing labels mapped onto 04's rungs (C41).
- P8 food/consumable item fields: 03 owns them. 05 owns physiological burn rates and the effects of hunger and nutrition. Pantries are household inventories using 03's item model (C48).
- Witch weaknesses: 06 owns them. Triggers are keyed to Drift thresholds and the pact. 03's iron-load rules are an INPUT to them, and 02's Witch class feature references 06 (C27).
- Mind structure: 10-psyche owns the psyche (drives, Id/Superego/Ego, anxiety, defenses, Persona/Shadow, archetypes, dreams). 04 keeps memory, belief, opinion, grudge, rumor, Figure, and notoriety. 04's "Values" become superego content (internalized norms) unless 10 argues otherwise (C3, C36).
- Determinism (C1, C49): any formula using exp/log/pow/trig must be restated in integer/fixed-point form or as lookup tables, with an approximation note.
- Clock (C21): the canonical cross-tier clock is integer game-minutes. T0 runs a sub-minute clock (game-seconds within the current minute) for movement and combat timing.

The implementation is being built RIGHT NOW in /home/eleanor/projects/coulee/packages and content/ by another team, following the ADR. Where a doc you write specifies something the code is implementing (psyche, peoples, provisions), read the code if it exists, for alignment. The DOC is the design target: note divergences in a "Implementation notes" subsection rather than silently conforming to the code. Do NOT edit any code.

Conventions: Markdown; tag key statements **[DECISION]** (from 00/ADR/Ellie), **[PROPOSAL]**, **[OPEN]**. Write fresh text and don't copy D&D/SRD text. Handle real-world sensitive material (Native nations, historical witch persecution, racial "passing" analogies, goblin caricature baggage) thoughtfully, and give Ellie options instead of deciding for her.
`

const NEWDOCS = [
  { id: '10-psyche', model: 'opus', prompt: `Write ${D}/10-psyche.md (target 7-10k words): the Freudian/Jungian mind model, which is the owner of the psyche.
- **Thoughts system:** Id voices (hunger, lust, rage, sloth, greed, fear, envy) vs. Superego voices (duty, shame, piety, propriety, neighborliness, internalized parental/community/church norms). Cover how thoughts are generated from needs, memories, opinions, and situations, and how thoughts look in the UI (RimWorld-like, but voiced).
- **Ego arbitration:** egoStrength, compromise and sublimation, Explain records.
- **Anxiety economics and defenses:** a catalog of 10+ defenses (repression, projection, displacement, rationalization, sublimation, denial, reaction formation, regression, isolation, undoing, identification with the aggressor...). For each: its trigger, how it picks targets, its sim effects, and how it feeds rumor, belief, and persecution in 04 (projection and displacement drive scapegoating!).
- **Jungian layer:** Persona vs. private self, which interacts with Figures and concealment (shadow-faekin passing); the Shadow, disowned traits, and shadow projection; archetypes as complexes and story roles; anima/animus (handle carefully: it's gendered and dated, so propose a reframing); individuation as a long-arc progression path for the player, possibly an XP or Calling hook with 02.
- **Dreams and the collective unconscious** as the channel Faerie uses to reach people; witch curses like hag-riding act through dreams (link to 06).
- **Fae minds** (gap #4 in 09): are fae pure Id bound by inviolable superego-like Law (cannot lie, must keep bargains) with no ego? How does that work in the Belief model?
- **The cosmological hook**, as a proposal: Faerie = Id of the land, Ice = Superego, settled world = Ego.
- **Period framing for 1855** (Freud and Jung are anachronistic): in-world schools such as mesmerism, phrenology, Swedenborgian correspondences, and "mental philosophy," plus a proposal for period-flavored UI labels with clinical labels as an option.
- **Integration:** how psyche replaces alignment in 02 (Will saves, morale, Callings, spell or class restrictions), in 04 (Values -> superego content, attribution), and in 06 (witch pact as an Id bargain; Woe read through the victim's psyche).
- **Implementation:** an integer data model, deterministic formulas, and perf at T0/T1/T2 (what's coarse at T2).
- **Worked examples:** 3-4 with numbers, at least one witch-hunt scapegoat cascade and one adventurer's inner life on a hard expedition.
- Open questions for Ellie.` },
  { id: '11-interface', model: 'opus', prompt: `Write ${D}/11-interface-and-platforms.md (target 6-9k words): the pocket (phone) interface and the desktop interface for the same game.
- **Design principles:** thumb zones, one-handed play, short sessions (2-10 min), interruptibility, glanceable state, and legibility of a dense simulation on a 390px screen. Also how real-time-with-pause works on a phone: auto-pause policies, "interesting event" alerts, and letting the sim run while you read.
- **Screen-by-screen designs for both layouts,** with ASCII wireframes for pocket:
  - the map view and camera gestures
  - actor selection, the dossier bottom sheet (Mind thoughts with Id/Superego voices, needs, opinions-with-reasons, memories/beliefs, pack/pantry), and the rumor ledger
  - the Chronicle (four voices from 05)
  - the Outfitter catalog (03's Book, Flat-Lay, and Readiness panel)
  - inventory, packing, and the P8 provisions planner (days of food at current rations, what spoils first, weight/bulk tradeoffs)
  - character creation, travel on the region map, combat on a phone (timed actions, pause-and-plan, big targets), conversations and interactions, and the witch's curse UI
  - settings and accessibility
- **Desktop:** RimWorld-dense multi-panel layouts, keyboard shortcuts, hover tooltips vs. tap-and-hold.
- **Platform and packaging:** PWA, offline, saves in IndexedDB/OPFS, cross-device save sync options, Capacitor for app stores, Tauri for desktop, and orientation (portrait-first? landscape?).
- **Performance budgets on phones:** frame time, battery, sim tick budgets in the worker, draw calls/instancing, asset tri budgets. Propose county-scale numbers per platform (C9: how many T0/T1/T2 actors on a mid phone vs. desktop).
- **Accessibility:** text size, color-blind palettes, reduced motion, screen readers for DOM panels.
- **Visual style guide** (gap #12): the period engraving/ink-and-paper UI, the low-poly palette, and readability rules.
- Open questions for Ellie.` },
  { id: '12-peoples', model: 'opus', prompt: `Write ${D}/12-peoples.md (target 5-8k words): the four peoples (humans, elves, shadow-faekin, goblins).
Ellie's only guidance: elves are part of "the civilized world of humans and elves"; shadow-faekin are "sort of hidden and somewhat between humans and elves"; goblins exist. She will provide more lore later, so everything beyond that is a [PROPOSAL] with alternatives.
For each people, give:
- origins and relationship to Faerie and to the Glacier Compact (01)
- where they live in Hollin County, and their communities, institutions, and economic niches in 1855
- their relations with the other peoples
- prejudices and priors (as data for 04: group opinions and suspicion)
- naming conventions
- material culture (gear/food preferences that tie into 03 and P8)
- mechanics as data per 02's ancestry hooks (small ability mods, senses, traits, lifespan, size), plus iron sensitivity, if any, keyed to fae heritage
- psyche tendencies (10): avoid essentializing, so frame these as cultural norms, i.e. superego content, not innate morality
- play experience in adventurer and witch modes
- 3+ character hooks
Specific topics:
- **Shadow-faekin concealment:** how passing works mechanically (Persona vs. private self, tells, discovery events, beliefs about who is faekin, true positives vs. false accusations), why they hide, and what happens when discovered. Handle the real-world resonance with racial passing and persecution thoughtfully, and offer framing options.
- **Elves vs. Faerie:** are elves fae? Address the questions at the top of 08.
- **Goblins:** goblins carry real antisemitic and racial-caricature baggage in fantasy. Name the pitfalls and propose a design that avoids them (e.g. not greedy bankers or hook-nosed caricatures), with options. Possible ties: Cornish knockers/miners, river or bluff folk. Check 01's bestiary for overlap.
Also address peoples-related conflicts in 09 (e.g. C5).
Finish with an "Implementation notes" section mapping to content/base/peoples TOML as the code defines it (read it if it exists), and with open questions for Ellie.` },
  { id: '07-rewrite', model: 'opus', prompt: `REWRITE ${D}/07-architecture-and-prototype.md for the TypeScript decision. Keep its strong architectural content (headless core/thin shell, event log backbone, LOD promotion/demotion, counter-based RNG, content as data, the sim harness as first target, golden chronicles, testing, perf, the optional LLM adapter, risks), but recast everything per adr/0001:
- pnpm workspaces; packages core/content/cli; apps/web; Vite+React+three.js
- the sim in a Web Worker and the worker protocol
- zod/TOML; Vitest/fast-check; Biome + the invariant checker
- PWA and the pocket target; Capacitor/Tauri later
Specifics to cover:
- **Cross-engine determinism** (V8 vs. JavaScriptCore): the transcendental-Math ban, and fixed-point/LUT replacements for the exp/log/pow formulas used in 04/05 (C1, C49). Provide concrete integer formulations.
- **The T0 sub-minute clock** (C21).
- **County scale per platform** (C9), coordinated with what 11 proposes. Read 11 if it exists yet, else propose.
- **Census materialization** per 00.
- **Save/load** (IndexedDB/OPFS) and snapshot transfer costs to the UI.
- **Repo layout:** read the ACTUAL repo at /home/eleanor/projects/coulee (packages/, apps/, docs/impl/MODULES.md, CLAUDE.md) and describe what exists vs. what's planned.
- **Milestone plan:** update it with reality. M0 and a M1-M3 slice are being built today, so make the next milestones concrete (M4 Outfitter + P8 provisions, M5 region map/travel, M6 combat, M7 adventurer slice, M8 witch slice) with acceptance criteria.
Remove the Rust/Godot content except for a short "Alternatives considered" note pointing to ADR 0001. Keep the doc 6-9k words.` },
]

phase('New docs')
const newDocs = await parallel(NEWDOCS.map(n => () => agent(`${CTX}\nYOUR TASK:\n${n.prompt}\n\nWrite only your file. Return a summary under 200 words: key proposals, and any new decisions Ellie must make.`, { label: n.id, phase: 'New docs', model: n.model, effort: 'high' }).then(s => ({ id: n.id, summary: s || 'FAILED' }))))
const newDocsReport = newDocs.filter(Boolean).map(r => `### ${r.id}\n${r.summary}`).join('\n\n')
log('New docs written: ' + newDocs.filter(r => r && r.summary !== 'FAILED').map(r => r.id).join(', '))

const PROP = [
  { file: '01-setting.md', model: 'sonnet', focus: 'Peoples: integrate humans/elves/shadow-faekin/goblins per 12 (replace generic "peoples slot" language; check bestiary overlap with goblins). Psyche cosmology hook (Faerie=Id, Ice=Superego) per 10, as a cross-reference. Persona->Figure. Fix C10-style slips (Native artifacts as fae material) in this doc if any. Resolve the 09 items assigned to 01.' },
  { file: '02-rules-and-characters.md', model: 'opus', focus: 'Ancestry section: the four peoples per 12. Replace any alignment-shaped mechanics (Will saves, morale, Callings, class restrictions) with psyche hooks per 10. T0 sub-minute clock for combat timing (C21). Witch class weaknesses reference 06 (C27). Curse DC formula ownership (C29). Fill gap #1 (an investigation/Gather Information skill) and, if feasible, gap #2 (stat 03\'s weapons and armor in a compact table). Restate any exp/log/pow formulas in integer form. Resolve the 09 items assigned to 02.' },
  { file: '03-gear-and-economy.md', model: 'opus', focus: 'P8 is the big one: 03 OWNS food/consumable item fields. Deepen the food and provisions model: per-item calories/protein-fat/fresh factor, shelf life, spoilage by temperature/wetness/packaging, prep requirements (fire, fuel, cookware, water, time), rations planning, packaging as gear, fuel/caps/oil burn as consumables, and pantries as household inventories. Make sure the catalog tables carry these columns for food items. Pocket Outfitter UX: cross-reference 11, and adjust the Book/Flat-Lay/Readiness designs for phones. Peoples-specific goods per 12. Iron vs. witch weakness is an input to 06 (C27). Encumbrance ownership (C22). Fix the "elf arrow" Native-artifact slip (C10). Resolve the 09 items assigned to 03.' },
  { file: '04-social-simulation.md', model: 'opus', focus: 'Integrate 10-psyche: 04 keeps memory/belief/opinion/grudge/rumor/Figure/notoriety, while the Mind model section now defers drives, conflict, and defenses to 10. Values become superego content (C3, C36). Show explicitly how projection and displacement feed suspicion and the persecution ladder. 04 §9 OWNS the persecution ladder 0-6 (C41): make it the canonical definition and give the mapping hooks 05/06 use. Shadow-faekin concealment: beliefs about who is faekin, discovery, false accusation, per 12. Restate exp/log formulas in integer/LUT form (C49). Player-facing UX: cross-reference 11. Persona->Figure throughout. Resolve the 09 items assigned to 04.' },
  { file: '05-world-sim-and-storyteller.md', model: 'sonnet', focus: 'Physiology owner for P8: burn rates, hunger/nutrition/scurvy/monotony effects, spoilage environment inputs (temperature/wetness), pantries in a lean 1855 spring. Alert levels: apply only to non-person threats, or derive from 04\'s ladder (C41). The T0 sub-minute clock and county scale per 07/11 (C9, C21). Director nudges that use psyche (e.g. raising anxiety) per 10. Peoples in settlement censuses per 12. Fix the elf-arrow slip (C10). Restate exp/log formulas in integer form (C49). Resolve the 09 items assigned to 05.' },
  { file: '06-game-modes.md', model: 'opus', focus: 'Character creation flows: add the four peoples (per 12) and psyche setup (per 10) in place of any alignment. The witch pact as an Id bargain; Woe read through victims\' psyches per 10; hag-riding and dream curses per 10. 06 OWNS witch weaknesses (C27), keyed to Drift thresholds and the pact, with 03 iron load as an input. Witch-facing persecution labels mapped onto 04\'s rungs (C41). Pocket UX for the curse UI and creation per 11. Shadow-faekin play in both modes. Fix the elf-arrow slip (C10). Resolve the 09 items assigned to 06.' },
]

phase('Propagate')
const props = await parallel(PROP.map(p => () => agent(`${CTX}
NEW DOCS JUST WRITTEN (read the relevant ones in full: 10-psyche.md, 11-interface-and-platforms.md, 12-peoples.md, and the rewritten 07):
${newDocsReport}

YOUR TASK: revise ${D}/${p.file} so it agrees with canon, Ellie's decisions, the ownership calls, and the new docs. Focus:
${p.focus}

Rules:
- Edit surgically but thoroughly: revise the sections that need it, add new subsections where the focus requires, and keep the doc's voice and good content. Don't shrink the doc or delete strong material.
- Search your doc for stale items: Rust/Godot, alignment, generic "placeholder peoples," Persona-as-rumor-identity, exp/log formulas, wrong start dates.
- At the top, under the title, add a short "Revision 2026-10-10" note listing what changed.
- Only edit ${p.file}.
Return a summary under 150 words: what changed, and which C-numbers you resolved.`, { label: `prop:${p.file}`, phase: 'Propagate', model: p.model, effort: 'high' }).then(s => ({ file: p.file, summary: s || 'FAILED' }))))
const propReport = props.filter(Boolean).map(r => `### ${r.file}\n${r.summary}`).join('\n\n')

phase('Sweep')
const sweep = await agent(`Mechanical stale-reference sweep over the Markdown files in ${D} (00 through 12, plus adr/). Do NOT edit anything. Use grep, and read context around each hit. Report every line that still has one of these:
(a) Rust, Godot, gdext, cargo, Bevy, presented as the current plan (fine if inside an "alternatives considered" note or 09's historical log)
(b) D&D alignment as an active mechanic
(c) "Persona" meaning a rumor identity (the correct term is now Figure; Persona is the Jungian mask)
(d) placeholder or unnamed peoples where the canon four (humans, elves, shadow-faekin, goblins) should be named
(e) start years other than 1855 for the game start
(f) exp/log/pow/sin/cos formulas presented as sim-core math without an integer/LUT note
(g) cross-references to files or sections that don't exist
(h) Native artifacts treated as fae/elf material
Return a plain list, one per line: file:line | category | the offending text | suggested fix.`, { label: 'sweep', phase: 'Sweep', model: 'haiku', effort: 'medium' })

phase('Refresh')
const refresh = await agent(`${CTX}
Revisions just made:
NEW DOCS:
${newDocsReport}

PROPAGATION:
${propReport}

STALE-REFERENCE SWEEP RESULTS (from a cheap model, so verify each before acting):
${sweep || '(sweep failed)'}

YOUR TASK:
1. Fix the verified sweep hits with surgical edits in any doc except 00 and the ADR. List any 00/ADR issues for the lead instead of editing them.
2. Rewrite ${D}/09-consistency-notes.md as a current-state document. Keep the C-numbering. For each conflict, mark it [RESOLVED in <doc §>], [STILL OPEN - NEEDS DECISION], or [PARTIAL], with one line on how it was resolved. Add any NEW conflicts introduced by 10/11/12 or the rewrites (C50+). Update the ownership map (10, 11, 12 are no longer pending) and the gaps list. Keep the old edit log in a short "History" appendix.
3. Rewrite ${D}/08-open-questions.md as the current decision checklist:
   - remove questions Ellie answered (stack, peoples roster, pocket, psyche, crunch) or mark them answered with the answer
   - add the new questions from 10, 11, 12 and 07, deduplicated
   - keep the tiers (Blocking for prototyping / Important but can wait / Flavor & taste), checkboxes, options with which doc proposed what, recommendations, and links
   - put the top 10 most consequential open questions in a short "Start here" section at the top
4. Update /home/eleanor/projects/coulee/README.md's doc table to include 08-12 and adr/, one line each.
Return a summary under 250 words: the top remaining open conflicts, the "Start here" questions, and any 00/ADR issues for the lead.`, { label: 'refresh', phase: 'Refresh', model: 'opus', effort: 'high' })

return { newDocs, props, refresh }
