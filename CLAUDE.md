# Coulee: rules for Claude Code

A simulationist fantasy-frontier game (3.5e-shaped rules × RimWorld), set in a fae-haunted Driftless Wisconsin, spring 1855. Designer: Ellie Lockhart, an expert designer. Be direct and specific.

## Canon (in order)
1. `design-docs/00-vision-and-pillars.md`: pillars P1–P8 and the glossary.
2. `design-docs/adr/0001` to `0003`: stack, invariants, headless play, procedural worldgen.
3. `docs/impl/MODULES.md`: module ownership, cross-module contracts, acceptance criteria.
4. Design docs 01–12. 01–07 predate the TypeScript ADR, so ignore their Rust/Godot specifics. "Persona" in 04 means **Figure**.

## Commands (run from the repo root)
- `just check` is the gate: biome, typecheck (all packages + scripts), vitest, invariants, content validation. It must pass before you say you're done.
- `just fmt`: biome auto-fix and format.
- `just test [pattern]`: vitest.
- `just run run --scenario iron_ford --seed 42 --days 10`: writes `runs/iron_ford-42/{chronicle.md,events.jsonl,stats.csv,final-hash.txt,manifest.json}`.
- `just run inspect "Gussie Pratt" --days 3`: character dossier (deterministic re-sim; `--run runs/<name>` reuses a run's manifest).
- `just content`: validate `content/base`. `just bundle` builds the JSON bundle for the web.
- `just web`: dev server (`--host`, so you can use a phone on the LAN). `just web-build`: PWA build. `just screens`: screenshots via the system chromium into `runs/screens/`.
- `just assets`: Blender 5.2 headless build into `apps/web/public/assets/`.
- Don't install packages or system software unless Ellie asks; the deps are already installed.

## Layout
- `packages/core`: the pure sim. Foundation files plus module dirs (`needs/ activity/ psyche/ social/ belief/ provisions/ items/ chronicle/`), each with `state/events/commands/system/api/view/index.ts`.
- `packages/content`: zod schemas (`src/schema/*.ts`, the single source of content types), the TOML loader, validator, and bundler.
- `packages/cli`: the `coulee` harness. Integration tests needing real content go in `packages/cli/test/`.
- `apps/web`: Vite + React + three.js PWA. The sim runs in a Web Worker (`src/sim.worker.ts`), and the UI gets view-model snapshots.
- `content/base`: TOML. `tools/blender`: bpy scripts. `scripts`: repo scripts. `runs/`: gitignored output.

## Core invariants (ADR 0001; `scripts/check-invariants.ts` enforces the mechanical ones)
1. **Determinism.** In `packages/core/src` there is no `Math.random`, `Date`, `performance`, timers, `crypto`, `Intl`/locale APIs, or transcendental `Math` (`sin cos tan exp log pow atan2 …`, and `**`). There are no Node/DOM APIs and no runtime imports of packages (only `import type` from `@coulee/content/schema`).
   - All randomness goes through `ctx.rng(stream, mixKey(...))`: counter-based, and the streams are a closed union in `rng.ts`.
   - Iterate tables with `idsOf()`/`rowsOf()`. Sort only with total comparators.
2. **Integers in accumulated state.** Money in cents, needs 0..1000, opinions −100..100, credence 0..100, time in game-minutes since 1855-04-01 00:00, fractions in per-mille. Round explicitly before storing. `findNonIntegers(world)` must stay empty.
3. **Everyone is a character sheet (P2).** The player is an actor whose urges come from Commands. No player-only rule paths; never branch rules on `controller`.
4. **Data over code.** Peoples, needs, traits, activities, interactions, and items live in TOML. Never compare against a people id in sim logic; read its fields.
5. **Legibility (P1).** Every check and arbitration emits an `Explain` (inputs, named modifiers, roll, DC, outcome) on its event, with a `knowledge` level. Views honor `perspective`/`omniscient`.
6. **Plain data + functions.** `World` is JSON-able; systems are `(world, ctx) => void` in the fixed order of `sim/schedule.ts`. The event log is append-only.
7. **Do not copy D&D/3.5e text.** Use mechanics shapes only.
8. **P8 crunch you can pack.** Food is never one number (kcal, protein/fat, fresh, shelf life, spoilage by temperature/wetness/packaging, prep needing fire+fuel+cookware+water). The planner and the sim use the same functions.

## Two agent pools: Claude + Codex
- `AGENTS.md` is a symlink to this file, so Codex (OpenAI) agents follow the same rules.
- Delegate to Codex with `scripts/codex.sh <job> <prompt-file> [model] [effort] [sandbox] [output-schema]`. Logs go to `runs/codex/<job>/` (`last.md` = final message). **GPT-6.x only** (Ellie's rule): `gpt-6.1-sol` (default workhorse), `gpt-6-astra` (hardest problems), `gpt-6-luna` (mechanical). Never 5.x.
- The Claude Code plugin `codex@openai-codex` is installed (`/codex:review`, `/codex:adversarial-review`, `/codex:rescue`). Always pass `--model gpt-6.1-sol` (or astra) explicitly.
- Codex jobs follow the same file-ownership rules, don't run repo-wide formatters while others work, and never commit; the orchestrator commits.
- Cross-model review is the point: have Codex review Claude's work and vice versa.

## Working rules
- Respect file ownership in `docs/impl/MODULES.md`. Change other modules only through their `api.ts`. Contracts (exported types, view shapes, event payloads) are additive-only.
- Add event kinds in your module's `events.ts` (`'<module>.<kind>'`) and commands in `commands.ts`. The central unions already include every module.
- New content domain: add it to your schema file's `xDomains` (with a directory you own). `schema/bundle.ts` picks it up.
- Core unit tests sit next to the code. Integration tests use `packages/cli/test/helpers.ts`.
- Golden chronicle diffs are design reviews: update snapshots deliberately, with a one-line reason.
- Commit only when asked, on the branch the orchestrator or Ellie names. Follow the attribution instructions in the session.
