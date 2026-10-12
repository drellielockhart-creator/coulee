# Next session: how to pick up

_Updated 2026-10-11 evening. The repo is https://github.com/drellielockhart-creator/coulee; `main` is the integration branch._

## Where things stand

- **The M1–M3 town slice is integrated and green** (`just check`: 503 tests, invariants, content).
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

## In flight when this was written (wave 3: worktrees `../coulee-w3-*`, branches `wave3/*`)

| Branch | Work | Agent |
|---|---|---|
| `wave3/fae1a` | Fae slice 1a: `authorizeAct` agency contract, the `fae/` module, six omen families, thinning, place descriptions, `investigate`, protected-site exclusion | Codex gpt-6-astra |
| `wave3/survival` | Starvation, dehydration, exposure and exhaustion leading to collapse and death; NPC deaths with grief, funerals and obituaries; PC death as an ending; captives in "fae time" | Codex gpt-6-astra |
| `wave3/polish` | Play-loop polish: `go` arrives, the PC's own talk lines print, humane event text, camping via sleep/wait, agency on repayment | Claude Sonnet |

If those branches have uncommitted work in their worktrees, commit each one there (attribution trailers), merge into `main` one at a time, run `just check`, refresh the golden once (`pnpm exec vitest run packages/cli/test/chronicle.test.ts -u`, with a one-line reason), and push.

## Next, in order

1. **Merge wave 3**, then take a Codex gpt-6-astra adversarial review pass over the merged fae, survival and polish work.
2. **Perf wave.** It runs about 12–20 ms per game-hour on desktop, mostly psyche and provisions; the phone budget is under 5. Hash-identical refactors only.
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
