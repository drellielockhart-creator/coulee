# Coulee: rules for Claude Code

A simulationist fantasy-frontier game (3.5e-shaped rules × RimWorld), set in a fae-haunted Driftless Wisconsin, spring 1855. Designer: Ellie Lockhart, an expert designer. Be direct and specific.

## Canon (in order)
1. `design-docs/00-vision-and-pillars.md`: pillars P1–P8 and the glossary.
2. `design-docs/adr/0001` to `0003`: stack, invariants, headless play, procedural worldgen.
3. `docs/impl/MODULES.md`: module ownership, cross-module contracts, acceptance criteria.
4. Design docs 01–13. 01–07 predate the TypeScript ADR, so ignore their Rust/Godot specifics. "Persona" in 04 means **Figure**. 13 covers fae omens, magic and charms (decided 2026-10-11).

## Commands (run from the repo root)
- `just check` is the gate: biome, typecheck (all packages + scripts), vitest, invariants, content validation. It must pass before you say you're done.
- `just fmt`: biome auto-fix and format.
- `just test [pattern]`: vitest.
- `just run run --scenario iron_ford --seed 42 --days 10`: writes `runs/iron_ford-42/{chronicle.md,events.jsonl,stats.csv,final-hash.txt,manifest.json}`. Add `--profile` for ms per game-hour per system, `--save` for `save.json`, `--no-events` to skip the (large) streamed log. The manifest records ms/game-hour, heap, and save size by slice. A year (`--years 1`) takes ~2 minutes.
- `just run inspect "Gussie Pratt" --days 3`: character dossier (deterministic re-sim; `--run runs/<name>` reuses a run's manifest).
- `just content`: validate `content/base`. `just bundle` builds the JSON bundle for the web.
- `just web`: dev server (`--host`, so you can use a phone on the LAN). `just web-build`: PWA build. `just screens`: screenshots via the system chromium into `runs/screens/`.
- `just assets`: Blender 5.2 headless build into `apps/web/public/assets/`.
- Don't install packages or system software unless Ellie asks; the deps are already installed.

## Layout
- `packages/core`: the pure sim. Foundation files plus module dirs (`needs/ activity/ psyche/ social/ belief/ provisions/ items/ chronicle/`), each with `state/events/commands/system/api/view/index.ts`.
- `packages/content`: zod schemas (`src/schema/*.ts`, the single source of content types), the TOML loader, validator, and bundler.
- `packages/cli`: the `coulee` harness. Integration tests needing real content go in `packages/cli/test/`.
- `packages/play`: headless play (ADR 0002): `PlaySession`, fair/god observations, shared interrupt policy (also used by the web's auto-pause), replay/save/fork. Play as an agent with `just run play --session <dir> --new --scenario iron_ford --seed 42`, then `just run play --session <dir> "<command>"` (one command per call; `--verify` replays). See `packages/play/README.md`.
- `packages/worldgen`: procedural towns (ADR 0003). `--scenario gen:town --seed N` (`--world-seed` to vary separately); `just run gen town --seed N --out runs/gen-N` exports TOML.
- `apps/web`: Vite + React + three.js PWA. The sim runs in a Web Worker (`src/sim.worker.ts`), and the UI gets view-model snapshots.
- `content/base`: TOML. `tools/blender`: bpy scripts. `scripts`: repo scripts. `runs/`: gitignored output.

## Core invariants (ADR 0001; `scripts/check-invariants.ts` enforces the mechanical ones)
1. **Determinism.** In `packages/core/src` there is no `Math.random`, `Date`, `performance`, timers, `crypto`, `Intl`/locale APIs, or transcendental `Math` (`sin cos tan exp log pow atan2 …`, and `**`). There are no Node/DOM APIs and no runtime imports of packages (only `import type` from `@coulee/content/schema`).
   - All randomness goes through `ctx.rng(stream, mixKey(...))`: counter-based, and the streams are a closed union in `rng.ts`.
   - Iterate tables with `idsOf()`/`rowsOf()`. Sort only with total comparators.
2. **Integers in accumulated state.** Money in cents, needs 0..1000, opinions −100..100, credence 0..100, time in game-minutes since 1855-04-01 00:00, fractions in per-mille. Round explicitly before storing. `findNonIntegers(world)` must stay empty.
3. **Everyone is a character sheet (P2).** The player is an actor whose urges come from Commands. No player-only rule paths; never branch rules on `controller`. PC autonomy is the actor's **agency mode** (`commanded` for the PC, `psyche` for NPCs) plus standing orders. Every consequential executor must pass the agency check (`psyche` API; `authorizeAct` per doc 13 §2.2).
4. **Data over code.** Peoples, needs, traits, activities, interactions, and items live in TOML. Never compare against a people id in sim logic; read its fields.
5. **Legibility (P1).** Every check and arbitration emits an `Explain` (inputs, named modifiers, roll, DC, outcome) on its event, with a `knowledge` level. Views honor `perspective`/`omniscient`.
6. **Plain data + functions.** `World` is JSON-able; systems are `(world, ctx) => void` in the fixed order of `sim/schedule.ts`. The event log is append-only.
7. **Do not copy D&D/3.5e text.** Use mechanics shapes only.
8. **P8 crunch you can pack.** Food is never one number (kcal, protein/fat, fresh, shelf life, spoilage by temperature/wetness/packaging, prep needing fire+fuel+cookware+water). The planner and the sim use the same functions.

## Rules learned in integration (2026-10-11)
- **The event log is not storage.** The World keeps a rolling window (`DEFAULT_LOG_RETENTION`); the full stream goes to `Sim.sink`. Never look up an old event from core; keep what you need in your own slice. Tests that inspect a long log use `simFor()` (keeps everything) or `collectingSink()`.
- **Log what someone could tell or ask about**, not bookkeeping. No per-actor-per-hour events (the old hourly `needs.changed` was 77% of the log). Put routine math where the view can re-derive it (`needs/system.ts hourlyLedger`).
- **Explains are normalized at `appendEvent`** (integers, no `-0`); `findNonIntegers` flags `-0`. Use `term()` / `intValue()` when you build terms.
- **Hot paths:** `idsOf`/`rowsOf` are called thousands of times an hour; never add an O(all stacks) scan inside a per-meal or per-hour-per-actor loop. The P8 planner (`planReadiness`) runs a forward projection: give household decisions a short `horizonDays`; memoize per pass (`kitchenOf`, `PlacementMemo`), never in world state.
- **Measure balance with a year run**, not 14 days: spring can look fine while the town starves by January. Check `stats.csv` (hunger/rest/warmth means, cash, kcal) every month of a `--years 1` run, and `grep -o '^\*\*[^*]*\*\*' chronicle.md | sort | uniq -c` for chronicle spam.
- Scratch scripts go in `runs/scratch/` (gitignored) and import `../../packages/*/src/index.ts`.

## Two agent pools: Claude + Codex
- `AGENTS.md` is a symlink to this file, so Codex (OpenAI) agents follow the same rules.
- Delegate to Codex with `scripts/codex.sh <job> <prompt-file> [model] [effort] [sandbox] [output-schema]`. Logs go to `runs/codex/<job>/` (`last.md` = final message). **GPT-6.x only** (Ellie's rule): `gpt-6.1-sol` (default workhorse), `gpt-6-astra` (hardest problems), `gpt-6-luna` (mechanical). Never 5.x.
- The Claude Code plugin `codex@openai-codex` is installed (`/codex:review`, `/codex:adversarial-review`, `/codex:rescue`). Always pass `--model gpt-6.1-sol` (or astra) explicitly.
- Codex jobs follow the same file-ownership rules, don't run repo-wide formatters while others work, and never commit; the orchestrator commits.
- Cross-model review is the point: have Codex review Claude's work and vice versa.
- **Codex sandbox limits:** no localhost sockets or browser (Claude takes screenshots), and `.git` is read-only, so the orchestrator commits. Ellie has spare Codex quota: prefer `gpt-6-astra` for big implementation and review jobs.
- **Codex content filter:** OpenAI's cybersecurity classifier killed the "exploit hunter / griefer" playtests. Use neutral QA wording (edge-case QA, economy audit, robustness) in Codex prompts.
- **Claude workflow subagents can't write report files.** Have them return the report as their final message, then save it (`scratchpad/playtest/save-reports.mjs` pattern).
- **Parallel waves:** give each fix group its own git worktree (`git worktree add -b <branch> ../coulee-<name> main`, then `pnpm install --offline`), then merge one at a time and resolve conflicts. Refresh the golden once after the merges.

## GitHub
- Remote `origin` = https://github.com/drellielockhart-creator/coulee (public). `gh` is authenticated as drellielockhart-creator, and git uses gh's credential helper.
- `main` is the integration branch. Push after each green merge; feature/fix branches are pushed too.
- Never commit `runs/`, playtest `save.json`/`events.jsonl` (gitignored), secrets or large binaries.

## Working rules
- Respect file ownership in `docs/impl/MODULES.md`. Change other modules only through their `api.ts`. Contracts (exported types, view shapes, event payloads) are additive-only.
- Add event kinds in your module's `events.ts` (`'<module>.<kind>'`) and commands in `commands.ts`. The central unions already include every module.
- New content domain: add it to your schema file's `xDomains` (with a directory you own). `schema/bundle.ts` picks it up.
- Core unit tests sit next to the code. Integration tests use `packages/cli/test/helpers.ts`.
- Golden chronicle diffs are design reviews: update snapshots deliberately, with a one-line reason.
- Commit only when asked, on the branch the orchestrator or Ellie names. Follow the attribution instructions in the session.
- Feature ideas Ellie has queued but not prioritized live in `docs/impl/BACKLOG.md` (e.g., vehicles and river trade).
