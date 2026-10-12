# Next session: how to pick up

_Updated 2026-10-11, late evening. The repo is https://github.com/drellielockhart-creator/coulee; `main` is the integration branch._

## Where things stand

- **The M1–M3 town slice plus wave 3 is integrated and green** (`just check`: 543 tests, invariants, content).
  - Iron Ford runs for a year deterministically.
  - The chronicle tells feuds, rumors, scapegoats, courtship, hunger and a faekin-suspicion arc in period voice.
  - The pocket and desktop web shell works.
  - Blender assets exist.
- **Headless play (ADR 0002)** works.
  - `coulee play --text|--jsonl|--replay` and the stateless `--session` mode for agents.
  - Fair and god observations, a shared interrupt policy (the web's auto-pause uses it too), replay, save, fork and verify.
- **Worldgen first slice (ADR 0003):** `--scenario gen:town --seed N`.
  - Varied generated ford towns, QA across seeds 1–50, and TOML export.
- **The first agent playtest wave ran:** 8 personas × 2 worlds, Claude and Codex mixed.
  - Triage is in `docs/impl/PLAYTEST-TRIAGE-2026-10-11.md`; reports are in `playtests/`.
  - Fixed since then:
    - high-agency PC (agency mode and standing orders);
    - waits that skip NPC chatter;
    - honest social failure reasons;
    - money legibility;
    - period-voice conversation lines and real belief transfer;
    - rumor damping;
    - employer-funded wages and money conservation;
    - camping, and production yields (fishing, foraging, wood, snares);
    - outfitter catalog stock;
    - packed saves (3.9 MB at 30 days).
- **Design doc 13** (fae omens, fae magic anyone can learn, disruptive fae charms) is written, critiqued by Codex, revised, and approved by Ellie.

## Wave 3 (merged 2026-10-11, `bea7674`)
- **Fae slice 1a** (Codex astra): `psyche.authorizeAct` with issuer-bearing Commands at every executor, the `fae/` module, six omen families with mundane lookalikes, witnessed thinning, protected-site exclusion, layered place descriptions, `signs` and `investigate`, omen rumors and Almanac/Paper lines. PARTIAL against doc 13 §8.1; the gaps are listed in `playtests/2026-10-11-fae1a-validation/report.md`.
- **Survival** (Codex astra): deprivation leads to Fortitude saves, Vigor/Wounds, collapse and death. Rescue (`aid`), funerals, estates, grief, obituaries, PC death/retire/depart endings, and fae-time captives. Four deaths in 144 actors across five seed-years.
- **Play polish** (Claude Sonnet): same-hour short walks, the PC's own talk lines, `describeEvent` plain-English text, camping, held-money guard and an obligations view.
- Known from the merge and smoke play: "Three tools lie with their handles pointing to the threshold" five times in the 30-day golden; "A Timely Kindness" 11 times; waits stop on bands the standing orders already handle. More notes are in the session scratch `w4/smoke-notes.md`, to be folded into the wave-4 fix brief.

## In flight (wave 4)
| Job | What | Where |
|---|---|---|
| `w4-review-fae` | Codex astra adversarial review: agency coverage, fair-play leaks of omen truth, fae determinism, protected sites, chronicle repeats, orders across ticks | read-only worktree `../coulee-w4-review`, output `runs/codex/w4-review-fae/last.md` |
| `w4-review-survival` | Codex astra adversarial review: thirst deaths in river towns, death aftermath, endings, polish regressions, `describeEvent` coverage | same worktree, `runs/codex/w4-review-survival/last.md` |
| `w4-perf` | Codex astra hash-identical perf pass toward under 5 ms per game-hour | worktree `../coulee-w4-perf`, branch `wave4/perf` |

## Next, in order
1. **Merge `wave4/perf`** only if the final hashes are identical and the golden is unchanged.
2. **Fix wave from the two reviews plus the smoke notes**, combined with **fae 1a completion** (the report's gap list, the Iron Ford 42 dusk gate, text-variant cooldown, lookalike pairing, `effectiveFi` in `belief/tells.ts`).
3. **Fae slice 1b** (doc 13): the Never-Empty Sack, Rain-Hem, the loan model, draw-vs-discovery, and the "Charm at ‹town›" detector with causal ablations.
4. **Regression playtests.** Rerun the personas on Iron Ford 42 and `gen:town` 7 (mostly Codex; Claude for the socialite and greenhorn). Use neutral QA wording for Codex.
5. **M4 Outfitter UI and web PlaySession:** the web is still a spectator UI. Give it a PC via PlaySession (UI parity) with the Book/Kit Sheet.
6. **Ellie's open decisions** in `design-docs/08-open-questions.md` "Start here", minus Q05 (answered).

The parking lot is `docs/impl/BACKLOG.md`. Ellie asked for vehicles and river trade there.

## Useful commands

```fish
cd ~/projects/coulee
just check
just run run --scenario iron_ford --seed 42 --years 1 --profile     # year run + per-system ms/h
just run play --session runs/me --new --scenario iron_ford --seed 42 # then: just run play --session runs/me "help"
just run gen town --seed 7 --out runs/gen-7
just web-build; pnpm exec tsx scripts/screens.ts                    # screenshots -> runs/screens/
scripts/codex.sh <job> <prompt.md> gpt-6-astra high                 # Codex job; logs in runs/codex/<job>/
```
