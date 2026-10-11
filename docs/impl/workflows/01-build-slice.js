export const meta = {
  name: 'coulee-m0-m3-slice',
  description: 'Build Coulee TS foundation, parallel sim/web/asset modules, integrate, adversarially review, fix',
  phases: [
    { title: 'Foundation', detail: 'monorepo, core skeleton, contracts, content schemas, CLI (opus)' },
    { title: 'Modules', detail: 'parallel module builders with exclusive file ownership' },
    { title: 'Integrate', detail: 'wire, green checks, run Iron Ford, screenshots (opus)' },
    { title: 'Review', detail: 'determinism, story quality, pocket UX, crunch (opus)' },
    { title: 'Fix', detail: 'apply findings, recheck, commit (opus)' },
  ],
}

const ROOT = '/home/eleanor/projects/coulee'

const COMMON = `
You are working on "Coulee", a simulationist fantasy-frontier game (3.5e D&D x RimWorld, set in a fae-haunted alternate Driftless Region of Wisconsin, spring 1855) for Ellie Lockhart, an expert designer. Repo: ${ROOT} (git, branch main). Toolchain installed: Node 26, pnpm, just, Blender 5.2 (blender), Chromium (chromium), git. sudo works without a password, but do NOT install system packages unless told to.

CANON (read before coding): ${ROOT}/design-docs/00-vision-and-pillars.md (pillars P1-P8, glossary) and ${ROOT}/design-docs/adr/0001-typescript-stack.md (stack, layout, core invariants, time, psyche-lite, peoples). These win over everything else. The detailed design docs 01-07 in design-docs/ were written BEFORE the TypeScript decision. Their game design is useful, but ignore their Rust/Godot specifics. Note that 04 uses "Persona" for rumor identities; that concept is now called "Figure" (see 00 glossary).

Key core invariants (from the ADR): packages/core has no DOM, no Node APIs, no IO, no Date/Math.random/performance.now/timers, no transcendental Math (sin/cos/exp/log/pow/atan2...). All randomness goes through the counter-based rng(seed, stream, tick, key). Accumulated state is integers. Iterate by ID or insertion order. World state is plain serializable data, and systems are functions. Every check/arbitration emits an Explain record. There are no player-only rule paths. Content is TOML in content/base validated by zod. No copying of D&D text.
`

const MODULE_RULES = `
PARALLEL WORK RULES (other agents are editing other parts of this same repo right now):
- Read ${ROOT}/docs/impl/MODULES.md first. Find the section for your module id and follow its contract, owned paths, and acceptance criteria.
- Only create or edit files inside your OWNED paths. Do not edit packages/core/src/sim.ts wiring, shared type files, package.json files, or lockfiles. Exception: if you absolutely must change a shared type, make the smallest additive change and list it in sharedTypeChanges.
- Do NOT run pnpm install/add. If you need a dependency, list it in needsDeps and work around it.
- Do NOT git commit.
- When typechecking or testing, scope to your own files (e.g. pnpm -C packages/core exec vitest run src/<yourdir>), and ignore errors in files you don't own. Other agents are mid-edit.
- Write focused unit tests for your module, including determinism-relevant ones.
- Prefer depth and correctness in your module over breadth. Read the relevant design doc sections named in your contract, and implement the spirit of the design, not a toy.
`

phase('Foundation')
const foundation = await agent(`${COMMON}
YOUR TASK: Build the FOUNDATION (milestone M0) so that ~10 agents can then build modules IN PARALLEL with exclusive file ownership. Quality of contracts matters more than anything else you do.

1. Scaffold the pnpm monorepo exactly per the ADR layout: packages/core, packages/content, packages/cli, apps/web, content/base, tools/blender, scripts, runs (gitignored), docs/impl.
   - Root: package.json, pnpm-workspace.yaml, tsconfig.base.json (strict, ESM, verbatimModuleSyntax, erasable syntax), biome.json, justfile, .gitignore (node_modules, dist, runs/*, coverage, apps/web/dev-dist, *.tsbuildinfo), CLAUDE.md (concise repo rules for future Claude sessions, mirroring the ADR invariants + how to run things).
   - Install ALL deps any module will need, at current versions, in one go, because module agents cannot install. That includes: typescript, tsx, vitest, fast-check, @biomejs/biome, zod, smol-toml, a CLI arg parser (e.g. cac or commander), and for apps/web: vite, react, react-dom, @types/react, @types/react-dom, @vitejs/plugin-react, three, @types/three, vite-plugin-pwa, playwright-core (to drive the system chromium at /usr/bin/chromium for screenshots; do not download browsers). Add anything else you foresee.
   - justfile recipes: check (biome check, typecheck all packages, vitest all, scripts/check-invariants.ts, content validate), test, run *ARGS (cli), web (vite dev), web-build, assets (blender headless build), screens (screenshot script).
   - scripts/check-invariants.ts: bans in packages/core/src (excluding tests) for Math.random, Date, performance, setTimeout/setInterval, crypto, transcendental Math functions, and import of node: modules. It exits nonzero with file:line.
2. packages/core: REAL implementations of the foundations:
   - ids: branded numeric ids.
   - time: game-minutes since 1855-04-01 00:00; calendar date, weekday, season, hour, moon phase via integer math.
   - rng: counter-based, Math.imul hash mixing. Streams are a closed union. Helpers: int range, d20, chance per-mille, weighted pick, shuffle-by-key. Include tests for distribution sanity and determinism.
   - explain: Explain records.
   - checks: d20 + mods vs DC with Explain; opposed checks; take-10/take-20 as time policies.
   - events: typed append-only event log with a discriminated union of event kinds. Every module will add kinds, so make adding kinds easy, e.g. one events file per module merged into a union via a registry pattern. DESIGN THIS SO PARALLEL AGENTS DON'T ALL EDIT ONE FILE.
   - world: World state type composed of per-module state slices, each slice type defined in that module's own file.
   - actor: ActorCore + Sheet (six abilities, a few skills, ancestry id, occupation, household, place).
   - sim: Sim create/step/hash. Fixed system order per hour: needs -> psyche (thoughts + ego arbitration) -> activity (apply chosen urge or schedule; move between places) -> social encounters at shared venues -> beliefs/rumor diffusion -> provisions (meals, spoilage, pantries) -> chronicle sifting. Each system is a STUB in its module's own directory, with the full typed interface the module agent will implement (no-op bodies are fine).
   - viewmodel: toViewModel(world, opts) for the web UI. Plain data covering actors (position/place, activity, needs, thoughts with voice id/superego, opinions with reasons, memories, beliefs, inventory), places, time, and recent chronicle entries. Module agents will extend their own parts, so make the viewmodel compose per-module view functions owned by each module.
   - The Urge type that psyche proposes and activity/social consume: e.g. {kind:'activity', activityId} | {kind:'interaction', interactionId, targetId?} | {kind:'defense', defense, targetId?}.
   - Command type (player actions as data; P2).
   - A state hash function (stable, over a canonical serialization).
   - Module directories with stubs: needs/, activity/, psyche/, social/, belief/, provisions/ (and items/), chronicle/. Also define the shared content-facing types they need.
3. packages/content: zod schemas + TOML loader + validator + JSON bundler (pnpm -C packages/content run bundle -> a JSON bundle the web imports). Schemas for: peoples (human, elf, shadow_faekin [concealed by default], goblin), needs, traits (including psyche weights), activities, interactions, items (with affordance tags, weight in grams, bulk, value in cents, material tags incl. iron, AND food fields for P8: calories per unit, protein/fat, fresh factor, shelf life days, spoilage modifiers by temperature/wetness/packaging, prep requirements raw|cook|soak|brew with fuel/cookware/water needs, units/servings), places/buildings (with a map position and footprint on a town site grid), name pools, occupations, scenarios (households, actors, relationships, starting pantries/inventories, seeded tensions). Seed MINIMAL valid content so everything validates (module agents will flesh content out).
4. packages/cli: 'coulee run --scenario <id> --seed <n> --days/--years <n> --out runs/<name>' writes chronicle.md, events.jsonl, stats.csv, final state hash. Also 'coulee content check'. Also 'coulee inspect <actorName>' printing a dossier.
5. Tests: determinism test (run twice -> same hash, same event log) and rng tests. 'just check' MUST pass.
6. apps/web: a minimal Vite+React app that compiles, with the Worker scaffold (sim worker that loads the content bundle + scenario and posts view-model snapshots, plus a typed message protocol). A placeholder screen is fine; the web module agent builds the real thing.
7. WRITE ${ROOT}/docs/impl/MODULES.md: the parallel build contract. One section per module id below, headed exactly '## module:<id>'. Each section gives: OWNED paths (exclusive, non-overlapping across modules), the interfaces/stubs it implements (with file paths), what it may read, the event kinds it should add, the viewmodel parts it owns, the design doc sections to read (cite file + heading), and crisp acceptance criteria. Also add a top section with the system order, data-flow diagram, and cross-module call contracts (e.g. social's gossip calls belief.transmit(); psyche's urges are consumed by activity/social; provisions feeds the hunger need). Module ids:
   - needs-activities: needs decay/satisfaction, role/occupation schedules, T1 hourly activity scheduler, venue occupancy, place movement, sleep.
   - psyche: Thoughts voiced by id/superego, ego arbitration with Explain, anxiety, defense mechanisms as events, persona/shadow minimal fields, psyche traits.
   - social: encounters at shared venues, interaction catalog content, social checks, multi-dimensional opinions with reasons, memories with salience/decay, relationships/kinship.
   - belief: beliefs with credence/evidence, gossip transmission + mutation, Figures (rumor identities), grudges as objects, community suspicion (04 mob formula), escalation ladder levels 0-3, concealed shadow_faekin suspicion.
   - provisions: item/inventory model with containers and affordances, food crunch (calories, nutrition, fresh factor/scurvy-monotony, spoilage, prep needs fire+fuel+cookware), household pantries, meals, store stock, temperature hook.
   - content-items: transcribe the 03-gear-and-economy catalog into content/base/items/*.toml per the item schema (owned: content/base/items/**). Food/provision items need full P8 fields.
   - chronicle: story sifting over the event log, notability, pattern detectors, period-voice template prose, chronicle.md + structured entries for the UI feed.
   - content-world: peoples TOML, name pools, occupations, places, and the Iron Ford scenario (from 01-setting's Iron Ford + NPC seeds; ~30-40 actors in households with relationships and seeded tensions, including at least one concealed shadow_faekin, some elves, a goblin or two). Owned: content/base/{peoples,names,occupations,places,scenarios}/**.
   - web: apps/web/** EXCEPT apps/web/public/assets/**.
   - assets: tools/blender/** and apps/web/public/assets/**. Blender 5.2 headless bpy scripts generating flat-shaded low-poly glb models + preview PNGs.
   Make sure owned paths don't overlap and every stub file belongs to exactly one module.
8. git add -A && git commit -m "M0: TypeScript monorepo foundation, core skeleton, module contracts" with these trailer lines at the end of the message:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MgSYvuhmX6epreX3U7Dj2d

Return a concise summary of what exists, any deviations from the ADR, and anything module agents must know.`, {
  label: 'foundation', phase: 'Foundation', model: 'opus', effort: 'high',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      checkPassed: { type: 'boolean' },
      commit: { type: 'string' },
      notesForModules: { type: 'string' },
    },
    required: ['summary', 'checkPassed', 'notesForModules'],
  },
})

if (!foundation) throw new Error('foundation failed')
log(`Foundation: check ${foundation.checkPassed ? 'green' : 'RED'}`)

const WEB_EXTRA = `Read 00 P6 (pocket + desktop), 03 (Outfitter UI ideas), 04 (player-facing UX). Build the real apps/web:
- Rendering: the sim runs in the worker. three.js renders the Iron Ford site map top-down at a slight angle (orthographic, RimWorld-ish): terrain ground with creek and bluffs, buildings at place positions, trees, and actors as figures walking between places (interpolate along simple paths).
- Assets: load glb from /assets/NAME.glb when present (manifest at /assets/manifest.json), with simple procedural placeholder meshes as fallback.
- Camera: touch pinch/drag and mouse wheel/drag.
- Time controls: pause/1x/2x/3x plus a date/time readout.
- POCKET layout (narrow or coarse pointer): a thumb-reachable bottom bar (time, People, Chronicle, Map); tap an actor to open a bottom-sheet dossier with tabs: Mind (thoughts with Id/Superego voice styling and ego arbitration explain, anxiety, recent defenses), Needs, Opinions (with reasons), Memories & Beliefs, Pack/Pantry (provisions with days-of-food).
- DESKTOP layout: side panels.
- Chronicle feed panel. Period-appropriate visual styling (paper, ink, serif headings) that stays legible. Installable PWA manifest.
- Write scripts/screens.ts (playwright-core driving /usr/bin/chromium headless against vite preview) that captures phone (390x844, mobile UA, touch) and desktop (1440x900) screenshots, including one with a dossier open, into runs/screens/. The viewmodel fields from other modules may still be empty while you work. Code against the types and render gracefully when data is empty.`

const ASSETS_EXTRA = `Write tools/blender/build_assets.py (run: blender -b --factory-startup -P tools/blender/build_assets.py -- --out apps/web/public/assets). It generates a cohesive flat-shaded low-poly set with vertex colors from a shared muted palette (period, Driftless: limestone/dolomite cream, oak green, weathered wood browns, barn red, slate):
- Buildings: cabin, general store/outfitter, tavern, church with steeple, smithy, mill with wheel, schoolhouse, house.
- Nature: oak, white pine, birch, shrub, rock, dolomite outcrop, grass tuft.
- Props: fence segment, barrel, crate, wagon, campfire, tent.
- Figures: base person, plus variants for elf (taller/slender), goblin (short, big ears), shadow_faekin (human-looking, subtle).
- Animals: deer, wolf, cow.
Keep tri counts low for phones. Use consistent scale (1 unit = 1 m), origin at ground center, Y-up glTF export. Also write manifest.json and render preview PNGs plus a contact sheet into tools/blender/previews/. Run it and iterate until the models look good in the previews. Actually LOOK at the preview images with the Read tool and fix ugly ones.`

const MODULES = [
  { id: 'needs-activities', model: 'sonnet', effort: 'high', extra: 'Read 05-world-sim-and-storyteller (time, settlements) and 04 (venues/encounters) for schedules and venues. Model a believable 1855 Driftless town day: farm/mill/smithy/store/tavern/church/school routines, the Sabbath, market day, seasons.' },
  { id: 'psyche', model: 'opus', effort: 'high', extra: 'This is the thematic heart: 00 P7 + the ADR psyche-lite. Id thoughts (hunger, lust, rage, sloth, greed, fear) and superego thoughts (duty, shame, piety, propriety, neighborliness) compete, and the ego arbitrates with an Explain record whose quality depends on egoStrength. Implement compromise/sublimation and anxiety accumulation. Defense mechanisms (displacement, projection, rationalization, repression, sublimation, denial, reaction formation) fire as events with targets chosen plausibly. Projection should produce a belief via the belief module contract, and displacement should produce an aggressive interaction urge at a safer target. Add minimal Jungian fields (persona: public-mask traits vs private; shadow: disowned traits) that affect projection targeting. Thoughts must be human-readable (short text, voice, intensity, reason) because the UI shows them like RimWorld thoughts.' },
  { id: 'social', model: 'opus', effort: 'high', extra: 'Read 04-social-simulation in depth (Mind model, Memory, Opinion, interactions catalog, T1 resolution). Implement a rich interaction catalog (20+ interactions in content/base/interactions) with preconditions and effects, opinion dimensions per 04, opinions with REASONS (so the UI can answer why), memories with salience/decay, and kinship/household relationships. Encounters happen between actors sharing a venue in the same hour.' },
  { id: 'belief', model: 'opus', effort: 'high', extra: 'Read 04-social-simulation sections on beliefs, rumors, Personas (now called Figures), grudges, mob/suspicion formula, and the escalation ladder, plus 06-game-modes on persecution. Beliefs are claims (subject, predicate, object) with credence 0-100 and evidence/sources. Gossip transmits with mutation/exaggeration and source-echo discounting. Concealed shadow_faekin: actors can come to suspect someone is faekin (rightly or wrongly). Grudges are first-class objects that can target an actor, household, Figure, or unknown culprit.' },
  { id: 'provisions', model: 'sonnet', effort: 'high', extra: 'P8 Crunch you can pack is a firm Ellie requirement: food must not be one number. Read 03-gear-and-economy (item model, encumbrance, Cookery & Provisions) and 05 (survival, foraging, temperature). Implement the item/inventory model with containers, weight+bulk, affordance tags, food items with calories/protein-fat/fresh factor, spoilage driven by temperature/wetness/packaging, prep requirements (cooking needs fire+fuel+cookware+water as applicable), household pantries that NPCs eat from at meals, monotony and scurvy-risk tracking, and a days-of-food planning function (the UI needs "days of food at current rations; what spoils first"). Store stock for the Iron Ford store. Everything legible via Explain.' },
  { id: 'content-items', model: 'haiku', effort: 'medium', extra: 'Mechanical transcription: read ALL catalog tables in design-docs/03-gear-and-economy.md and write them into content/base/items/*.toml (one file per catalog section) following the item zod schema exactly. Fill food/provision P8 fields with period-plausible values (e.g. hardtack ~ 3,500 kcal/kg-ish, very long shelf life; salt pork high fat; dried apples moderate fresh factor). Run the content validator (coulee content check) and fix every error in your files.' },
  { id: 'chronicle', model: 'sonnet', effort: 'high', extra: 'Read 05-world-sim-and-storyteller sections on story sifting and the Chronicle (four voices). Implement notability scoring and pattern detectors over the event log: feud forming, defenses firing, rumor spreading through town, scapegoating, courtship, hunger/scarcity, suspicion of faekin, kindness. Write template prose in a period journal/newspaper voice, with variety via rng (no LLM). Output chronicle.md grouped by week, plus structured entries for the UI feed.' },
  { id: 'content-world', model: 'sonnet', effort: 'medium', extra: 'Read 01-setting (Iron Ford and its NPC seeds, tone guide, Driftless details) and 00 (peoples). Write peoples TOML (four peoples, placeholder small modifiers, shadow_faekin concealed), name pools (Yankee, German, Norwegian, Cornish, Irish, plus elvish and goblin naming; faekin use passing names), occupations, places with map positions on a town grid laid along a creek/coulee with bluffs, and the iron_ford scenario: ~30-40 actors in households, relationships, starting pantries (mixed foods, realistic for April 1855, spring being a lean season), and seeded tensions from 01 seeds. Validate with coulee content check.' },
  { id: 'web', model: 'opus', effort: 'high', extra: WEB_EXTRA },
  { id: 'assets', model: 'sonnet', effort: 'high', extra: ASSETS_EXTRA },
]

phase('Modules')
const modResults = await parallel(MODULES.map(m => () => agent(`${COMMON}
${MODULE_RULES}
FOUNDATION NOTES: ${foundation.notesForModules}

YOUR MODULE: ${m.id}
${m.extra}

When finished, return the summary object.`, {
  label: `module:${m.id}`, phase: 'Modules', model: m.model, effort: m.effort,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      filesChanged: { type: 'array', items: { type: 'string' } },
      needsDeps: { type: 'array', items: { type: 'string' } },
      sharedTypeChanges: { type: 'array', items: { type: 'string' } },
      knownIssues: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'filesChanged', 'needsDeps', 'sharedTypeChanges', 'knownIssues'],
  },
}).then(r => ({ id: m.id, ...(r || { summary: 'AGENT FAILED', filesChanged: [], needsDeps: [], sharedTypeChanges: [], knownIssues: ['agent returned null'] }) }))))

const modReport = modResults.filter(Boolean).map(r => `### ${r.id}\n${r.summary}\nneedsDeps: ${JSON.stringify(r.needsDeps)}\nsharedTypeChanges: ${JSON.stringify(r.sharedTypeChanges)}\nknownIssues: ${JSON.stringify(r.knownIssues)}`).join('\n\n')
log(`Modules done: ${modResults.filter(r => r && r.summary !== 'AGENT FAILED').length}/${MODULES.length}`)

phase('Integrate')
const integ = await agent(`${COMMON}
YOUR TASK: INTEGRATION. Ten module agents just built modules in parallel per ${ROOT}/docs/impl/MODULES.md. Their reports:

${modReport}

Do the following:
1. Install any needsDeps. Reconcile sharedTypeChanges. Fix all type errors, lint issues, failing tests, and invariant violations across the repo until 'just check' passes. Fix root causes; don't delete tests or loosen invariants.
2. Make sure the systems are actually WIRED and interacting in sim order:
   - needs drive psyche thoughts
   - urges drive activities and interactions
   - interactions create memories and opinions with reasons
   - gossip moves beliefs
   - defenses fire
   - meals consume pantry food and spoilage happens
   - the chronicle sifts it all
3. Run: coulee run --scenario iron_ford --seed 42 --years 1 (and again to confirm an identical hash). Read the chronicle.md. Is it telling STORIES (feuds, rumors, defenses, scarcity, suspicion), or is it mush or spam? Tune parameters/content (not structure) for one or two passes until it reads well, with a Driftless spring-to-spring year. Check performance (ms per game-hour) and note it.
4. Bundle content. just web-build must succeed. Run scripts/screens.ts to capture phone and desktop screenshots (dossier open, chronicle feed open). LOOK at them with the Read tool and fix glaring layout/rendering problems: phone usability is a hard requirement.
5. Run the Blender asset build if assets are missing, and confirm the web app loads the glbs.
6. Commit: "M1-M3 slice: Iron Ford town sim with psyche, social, beliefs, provisions, chronicle; pocket/desktop web shell; Blender assets" with trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MgSYvuhmX6epreX3U7Dj2d
Return the summary.`, {
  label: 'integrate', phase: 'Integrate', model: 'opus', effort: 'high',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      checkPassed: { type: 'boolean' },
      deterministic: { type: 'boolean' },
      msPerGameHour: { type: 'string' },
      chronicleHighlights: { type: 'string' },
      screenshots: { type: 'array', items: { type: 'string' } },
      remainingIssues: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'checkPassed', 'deterministic', 'chronicleHighlights', 'screenshots', 'remainingIssues'],
  },
})
if (!integ) throw new Error('integration failed')
log(`Integrate: check ${integ.checkPassed ? 'green' : 'RED'}, deterministic ${integ.deterministic}`)

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          title: { type: 'string' },
          where: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'title', 'where', 'evidence', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const LENSES = [
  { key: 'determinism', prompt: 'Audit packages/core for determinism and invariant violations that the regex checker would miss. Look for:\n- floats accumulated into state\n- non-total sort comparators\n- iteration over object keys with numeric-vs-string ordering pitfalls\n- shared mutable state across runs\n- rng stream/key collisions (two systems drawing identical numbers)\n- engine-dependent behavior (e.g. Array.prototype.sort stability assumptions, toFixed/locale, Intl)\n- save/load round-trip gaps\n- unbounded growth (event log, memories, beliefs) that will blow up over years\nActually run things: run the sim twice with different --days splits if supported, write a quick property test or two, and measure memory growth over 3 years.' },
  { key: 'story', prompt: 'You are a skeptical narrative designer who loves RimWorld, Dwarf Fortress and James Ryan\'s Talk of the Town. Run coulee run --scenario iron_ford --seed 42 --years 1 and also seeds 7 and 1855, then read the chronicles and inspect a few actors (coulee inspect). Judge against 00 P1-P3, P7 (psyche) and 04:\n- Do relationships evolve with reasons?\n- Do rumors spread and mutate?\n- Do id/superego conflicts and defenses produce plausible, varied behavior, or degenerate (everyone insults everyone, nothing happens, the same event repeats)?\n- Does the concealed shadow-faekin plotline go anywhere?\n- Does food scarcity in a lean spring matter?\nFindings must be concrete: which mechanism, which numbers, and what to change.' },
  { key: 'pocket-ux', prompt: 'You are a mobile UX reviewer. Build and serve the web app, run scripts/screens.ts (or write your own playwright-core script against /usr/bin/chromium) at 390x844 (iPhone-ish, touch, mobile UA), 360x780 (small Android) and 1440x900 desktop. Exercise: open a dossier, switch tabs, open chronicle, change speed, pan/zoom (simulate touch if you can). LOOK at every screenshot with the Read tool. Judge:\n- thumb reach and tap target sizes (>=44px)\n- legibility (font sizes, contrast)\n- whether the map is visible and readable\n- whether sheets obstruct sensibly\n- performance (fps/frame time in headless if measurable, bundle size)\n- console errors\n- whether the period styling works\nCompare against 00 P6.' },
  { key: 'crunch', prompt: 'You are a hardcore survival-sim player reviewing against 00 P8 (Crunch you can pack) and 03-gear-and-economy. Inspect the item/food content and the provisions code. Check:\n- Does food differ meaningfully (calories, nutrition, fresh factor, spoilage, prep needs)?\n- Is spoilage driven by temperature/wetness/packaging?\n- Do households run out in a lean spring?\n- Is the days-of-food planning function correct?\n- Are content values period-plausible and internally consistent (price vs wages, kcal/weight)?\n- Are all 03 catalog items transcribed?\n- Is everything legible via Explain?\nWrite small tests or scripts to probe edge cases.' },
]

phase('Review')
const reviews = await parallel(LENSES.map(l => () => agent(`${COMMON}
YOUR TASK: adversarial REVIEW (read-only for source; you may write scratch scripts under runs/ or /tmp, but do not edit project source files). The integration report says: ${integ.summary}
Remaining issues it listed: ${JSON.stringify(integ.remainingIssues)}

LENS: ${l.key}
${l.prompt}

Report only real, evidenced problems with concrete fixes. Rank by severity. Ten strong findings beat thirty weak ones.`, {
  label: `review:${l.key}`, phase: 'Review', model: 'opus', effort: 'high', schema: FINDINGS,
}).then(r => ({ lens: l.key, findings: (r && r.findings) || [] }))))

const allFindings = reviews.filter(Boolean).flatMap(r => r.findings.map(f => ({ lens: r.lens, ...f })))
const actionable = allFindings.filter(f => f.severity !== 'low')
const lows = allFindings.filter(f => f.severity === 'low')
log(`Review: ${allFindings.length} findings (${actionable.length} high/medium, ${lows.length} low deferred to backlog)`)

phase('Fix')
const fix = await agent(`${COMMON}
YOUR TASK: apply review FIXES. Reviewers produced these high/medium findings (JSON):
${JSON.stringify(actionable, null, 1)}

And these LOW findings, which you should NOT fix now: append them to ${ROOT}/docs/impl/BACKLOG.md as a checklist, grouped by lens:
${JSON.stringify(lows, null, 1)}

For each high/medium finding: verify it's real (reproduce if you can), then fix it properly. If you judge one wrong, skip it and say why. After fixing:
- 'just check' must pass.
- The iron_ford seed-42 one-year run must be deterministic.
- Regenerate screenshots.
- Re-read the chronicle to confirm the story fixes worked.
Update CLAUDE.md if you learned rules future sessions need. Also write ${ROOT}/docs/impl/STATUS.md: what works now, how to run everything (CLI, web on desktop, web on phone via LAN with vite --host, assets), the architecture at a glance, known gaps, and suggested next milestones per 07/ADR ordering.
Commit: "Review fixes: <short list>" with trailer lines:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MgSYvuhmX6epreX3U7Dj2d`, {
  label: 'fix', phase: 'Fix', model: 'opus', effort: 'high',
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      fixed: { type: 'array', items: { type: 'string' } },
      skipped: { type: 'array', items: { type: 'string' } },
      checkPassed: { type: 'boolean' },
      screenshots: { type: 'array', items: { type: 'string' } },
      chronicleExcerpt: { type: 'string' },
    },
    required: ['summary', 'fixed', 'skipped', 'checkPassed', 'screenshots', 'chronicleExcerpt'],
  },
})

return { foundation, modules: modResults.map(r => r && { id: r.id, summary: r.summary, knownIssues: r.knownIssues }), integ, findingsCount: allFindings.length, actionableCount: actionable.length, fix }
