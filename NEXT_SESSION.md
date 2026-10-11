# Next session: how to pick up

_Written 2026-10-10, when we paused for the 5-hour usage limit. The status table is updated at the pause point._

## Where we stopped

| Track | State at pause |
|---|---|
| Design docs 00–12 + ADRs 0001–0003 | Docs workflow (`docs/impl/workflows/02-docs-v2.js`) was finishing its work on 01–06, then sweep and refresh of 08/09. See the status line below. |
| Implementation (`docs/impl/workflows/01-build-slice.js`) | Run through **Foundation → Modules → Integrate** (commits the playable slice). **Deliberately stopped before Review + Fix** to save usage. |
| Headless play + playtesting (ADR 0002) | **Not started.** |
| Procgen readiness + town-site generator (ADR 0003) | **Not started.** |

Status line (updated at pause): _see bottom of file_

## Restart order

Paste one of the prompts below into Claude Code from `~/projects/coulee`. Ultracode/workflows are fine. **Use Haiku subagents for mechanical work** (transcription, sweeps, naive-player playtests), Sonnet for mid-level implementation, and Opus for architecture, psyche/social, integration, and review.

### Step 1: Finish the slice (review + fix)
> Read `NEXT_SESSION.md`, `docs/impl/STATUS.md` (if present), `CLAUDE.md`, and `design-docs/adr/*`. The build-slice workflow was stopped after Integrate. Run its **Review** (determinism, story, pocket-UX, crunch lenses, all Opus) and **Fix** phases against the current repo. If this is still the original session, resume run `wf_9bd2e135-f7e` with `docs/impl/workflows/01-build-slice.js`; otherwise write a new workflow from the Review/Fix part of that script. Then write `docs/impl/STATUS.md` if missing.

### Step 2: Headless play + procgen readiness + first playtests
> Implement ADR 0002 and the first slice of ADR 0003 as one workflow:
> 1. **Build** (Opus): `packages/play` (`PlaySession`: player actor via Commands, fair-mode observation renderer, god mode, interrupt policy shared with the pocket UI's auto-pause, save/load/fork, replay from command log, telemetry JSONL) and `coulee play --text|--jsonl|--replay`. The player arrives in Iron Ford as a newcomer with dollars and a starting pack, and can go places, talk/interact, buy and sell at the store, eat, cook, sleep, wait, inspect, plan provisions, and explain. Enforce **UI parity**: the web UI calls the same Command/PlaySession API.
> 2. **Procgen readiness** (Opus): audit that core and web draw only from world data (no baked layouts). Create `packages/worldgen` with a deterministic **town-site generator** that emits the same site/place/household shapes as `content/base/scenarios/iron_ford`. Add a `generated_town` scenario option, a worldgen QA check (degenerate-world detectors), and a test that generated and authored towns both run.
> 3. **Playtest** in parallel with personas from ADR 0002: Greenhorn (Haiku), Catalog kid/min-maxer (Sonnet), Socialite (Opus), Explorer (Sonnet), Exploit hunter (Sonnet). Run each on Iron Ford seed 42 **and** a generated town. Each plays ~7–14 in-game days via `coulee play --text` and writes `playtests/<date>-<persona>-<seed>/report.md` + `commands.jsonl` + `metrics.jsonl`.
> 4. **Triage** (Opus): dedupe findings into a ranked list.
> 5. **Fix** (Opus): fix the top items.
> 6. **Regression playtest** (Haiku + Sonnet): replay the same command logs and confirm fixes.
> 7. **Update** `design-docs/07-architecture-and-prototype.md`'s milestone plan: add a playtest gate to every milestone, add M5a worldgen (ADR 0003), and add `packages/play` + `packages/worldgen` to the repo layout. Commit.

### Step 3: Ellie's decisions
`design-docs/08-open-questions.md` → "Start here" (top 10). Answers there unblock M4+ (Outfitter + provisions UI, region travel, combat, adventurer slice, witch slice).

## Useful commands
```fish
cd ~/projects/coulee
just check                                              # format, lint, typecheck, tests, invariants, content
just run --scenario iron_ford --seed 42 --years 1       # headless town year → runs/…/chronicle.md
just web                                                # dev server; add --host to reach it from a phone on the LAN
just web-build; just screens                            # production build + phone/desktop screenshots → runs/screens/
just assets                                             # rebuild Blender low-poly assets
```
(Recipe names come from the foundation agent's justfile. If one differs, run `just --list`.)

## Key files
- `design-docs/00-vision-and-pillars.md`: canon (P1–P8, glossary, decisions log)
- `design-docs/adr/0001` (TS stack), `0002` (headless play + playtesting), `0003` (procgen)
- `design-docs/08-open-questions.md`, `09-consistency-notes.md`
- `docs/impl/MODULES.md` (module contracts), `docs/impl/STATUS.md` (written by the fix phase), `docs/impl/BACKLOG.md`
- `docs/impl/workflows/*.js`: the workflow scripts used so far
