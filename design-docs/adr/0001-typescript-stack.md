# ADR 0001: TypeScript stack, pocket-first, headless core

**Status:** Accepted (Ellie, 2026-10-10)
**Supersedes:** the Rust + Godot recommendation in `07-architecture-and-prototype.md` §2.4. 07's runner-up is now the plan, and 07 is being rewritten to match this ADR.
**Still valid from 07:** the headless-core/thin-shell split, the event log as backbone, LOD tier management, counter-based seeded RNG, content-as-data, the sim harness as the first target, golden-file chronicles, and milestone ordering (social sim first).

## Decision

### Platform targets
- **Phones (pocket interface) and desktop**, equally. The game runs in the browser as a **PWA**. Desktop gets dense multi-panel layouts; phones get a thumb-first pocket layout. App-store wrapping (Capacitor) and desktop wrapping (Tauri) come later and are optional.

### Stack
| Concern | Choice |
|---|---|
| Runtime | Node 26 (dev, CLI harness), modern browsers (game) |
| Package manager | pnpm workspaces |
| Language | TypeScript, `strict`, ESM only. Prefer erasable syntax: no `enum`, no `namespace`. Use union string literals and `as const` objects. |
| Run TS in Node | `tsx` |
| Tests | Vitest; fast-check for property tests; file snapshots for golden chronicles |
| Lint/format | Biome, plus `scripts/check-invariants.ts` (custom bans; see below) |
| Content | TOML authoring (`smol-toml`), validated by **zod** schemas, compiled to a JSON bundle for the web |
| Web build | Vite |
| UI | React (DOM overlay for panels, sheets, catalog, dossiers) |
| 3D | three.js: orthographic top-down-ish camera, flat-shaded low-poly glTF, instancing |
| Sim in browser | Runs in a **Web Worker**. The UI receives view-model snapshots (plain data). The renderer interpolates positions. |
| Assets | Blender 5.2 via headless Python scripts (`tools/blender/`) → `.glb` + preview PNGs. Vertex colors from a shared palette. |
| Task runner | `just` |

### Repo layout
```
coulee/
  package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, justfile, CLAUDE.md
  packages/
    core/        # pure sim library: NO DOM, NO Node APIs, NO IO, NO wall-clock, NO Math.random
    content/     # zod schemas, TOML loader, validator, JSON bundler
    cli/         # `coulee` harness: run scenarios headless, write chronicle/stats/events
  apps/
    web/         # Vite + React + three.js PWA; sim in a worker
  content/base/  # TOML: peoples, needs, traits, activities, interactions, names, scenarios...
  tools/blender/ # bpy asset scripts
  scripts/       # repo scripts (invariant checker, etc.)
  runs/          # harness output (gitignored)
  design-docs/
```

### Core invariants (enforced by `scripts/check-invariants.ts` and review)
1. **Determinism.** Same seed + same commands means an identical event log and an identical state hash, on any machine *and any JS engine* (V8 desktop and JavaScriptCore on iPhone).
   - No `Math.random`, `Date`, `performance.now`, timers, or `crypto` in `packages/core/src`.
   - **No transcendental Math** in core (`sin cos tan exp log pow atan2 …`). These can differ between engines. `Math.sqrt`, `floor`, `round`, `min`, `max`, `abs`, and `imul` are fine. Use integer tables or approximations.
   - All randomness goes through the counter-based `rng(seed, stream, tick, key)`, which is pure and hash-based (`Math.imul` mixing). Streams are a closed union of names.
   - Iteration order is always by ID or insertion order. Never sort with a non-total comparator.
2. **Integers in accumulated state.** Money is in cents, needs are 0–1000, opinion dimensions are −100..100, credence is 0–100, and time is integer game-minutes since the epoch. Floats are allowed transiently, but they're rounded with explicit `Math.round`/`floor` before being stored.
3. **Everyone is a character sheet (P2).** The player is an actor driven by Commands. There are no player-only rule paths.
4. **Data over code.** Peoples, needs, traits, activities, interactions, and items live in `content/` TOML. No hardcoded peoples in sim logic.
5. **Legibility (P1).** Every check and every arbitration produces an `Explain` record (the inputs, modifiers, roll, DC, and outcome) that the UI can show.
6. **Core is plain data plus functions.** World state is a serializable plain object (structured-clone-able, JSON-able). Systems are `(world, ctx) => void` functions run in a fixed order. The event log is append-only.
7. **Do not copy D&D/3.5e text.** Use mechanics shapes only.

### Time
- Canonical time is **integer game-minutes since 1855-04-01 00:00** (spring 1855).
- T1 (abstracted activity) steps hourly. T2 steps daily, with 6-hour sub-steps for rumor/weather (per 00).
- T0 (live site map) sub-steps within a minute for movement and animation.
- In the browser at 1× speed, 1 game-hour ≈ 40 real seconds (RimWorld-like). This is tunable.

### Psyche-lite (M1 implementation of 00 P7; full model in `10-psyche.md`)
- `Mind` has needs, a psyche (`egoStrength`, `superegoStrictness`, `idAppetite`, all 0–100), anxiety (0–1000), a list of Thoughts, Memories, Opinions, and (M2) Beliefs.
- A `Thought` is voiced by `id` or `superego`. It carries an urge (a proposed action/activity/interaction), an intensity, a target (optional), a reason (Explain), and decay.
- **Ego arbitration** each hour:
  1. Gather the competing urges.
  2. Score them (needs, traits, social context, psyche weights).
  3. The ego picks, or finds a **compromise/sublimation** when ego strength allows.
- Unresolved conflict adds **anxiety**. Above a threshold, a **defense** fires: displacement (aggress a safer target), projection (form a belief that *someone else* has the disowned trait), rationalization, repression (suppress a memory's salience), or sublimation. Defenses are events and show up in the Chronicle.

### Peoples (content, canon names; lore in `12-peoples.md`)
- `human`, `elf`, `shadow_faekin`, `goblin`.
- `shadow_faekin` is **concealed by default**. They pass as human (or elf), and other actors only know through **beliefs**. Mechanics are small placeholder modifiers until 12 lands.

## Consequences
- We lose the Rust performance ceiling. The mitigations are sparse data structures, worker threads, tier budgets, and a perf benchmark at M2 (target <5 ms per game-hour for 30 T1 actors on a mid phone; county-scale numbers come later).
- Cross-engine determinism needs discipline (the transcendental-Math ban). It's worth it, for share-a-seed and golden tests.
- The web build is trivially shareable, which is good for playtesting with friends.
