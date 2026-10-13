# Next session: how to pick up

_Updated 2026-10-11, night. The repo is https://github.com/drellielockhart-creator/coulee; `main` is the integration branch._

## Where things stand

- **The M1–M3 town slice plus waves 3–4 is integrated and green** (`just check`: 573+ tests, invariants, content).
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

## Wave 4 (merged 2026-10-11, `5188b00`)
- **Reviews** (Codex astra) of wave 3 found 11 real problems; all were fixed in `wave4/fae-fix` and `wave4/survival-fix`. Reports: `playtests/2026-10-11-fae1a-validation/report-fix.md` and `playtests/2026-10-11-survival-wave3/report-fix.md`.
  - **Fae:** loan consent for held actors, witnessed-only omens in fair output, no truth in failed-read Explains, leads you can follow, 8 paired text variants per omen family. The fae 1a gates now pass: four omens by day-2 dusk on Iron Ford 42, and 8/8 fresh seeds on the explorer route.
  - **Survival:** caregivers cook and serve the incapacitated, estates carry debts, collapsed people don't shop, same-step arrivals, and evidence-based kindness stories. The play loop no longer stops waits for bands the standing orders handle, and prefers a nearby paid bed to camping.
  - **Year deaths:** Iron Ford 0, gen 73 0 (was 5), gen 7 1. The open defect: a zero-food household gets no neighbor relief.
- **Perf:** hash-identical, Iron Ford 39.8 → 17.1 ms/h (`docs/impl/perf/2026-10-11-wave4.md`). Readiness projections are now the top cost.
- **Web:** the app plays through `PlaySession` (a web command log replays headlessly to the same hash), with the Outfitter storefront and buy preview, Kit Sheet Explains, and the pocket flow. M4 UI acceptance #5 and #6 are met.
- **Codex quota ran out** at 2026-10-11 ~22:36 PT. Ellie applied one of her banked resets on 2026-10-12, so Codex is available again.

## Wave 5 (DONE, merged 2026-10-12; `just check` 728 green)
- **r2 fixes:** text, social and play, provisions/water/standing orders.
- **Codex review fixes:** `fix-social` and `fix-prov`.
- **Fae slice 1b** with the r2 sign fixes and butter on credit.
- **County worldgen:** v2 terrain, then v3 names and roads; maps in `docs/impl/worldgen/`.
- **Ellie's 2026-10-12 decisions** in 00:
  - watercolor art direction;
  - parties and elevation in the backlog;
  - butter on credit;
  - church-time loan misses accepted;
  - a keeper's refusal has costs on both sides.

## Wave 6
**Merged** (`43fba9a`, `just check` 799 green; default test timeout is now 180 s for loaded machines):
- poor relief: M4 acceptance 3 passes on the half-stores harness; no starvation deaths in the year runs;
- charm refusal costs;
- fae 1b cross-model fixes (12);
- M5 plan and slice 1 plus polish (walk to Cedar Farm in `iron_ford_neighbors`);
- talk listener memory: repeats 10–14%;
- M6 plan;
- docs sync with a root README.

**In flight (all Codex):**

| Job | Where |
|---|---|
| M6 slice 1, tactical clock and auto-pause (on the Q04 defaults) | `../coulee-w6-m6-slice1`, branch `wave6/m6-slice1` |
| Web region map (basic; Claude must run the screenshots) | `../coulee-w6-web-region`, branch `wave6/web-region` |
| Charm theft wiring (coveting → `social.attemptTheft`) | `../coulee-w6-theft`, branch `wave6/charm-theft` |
| Perf wave 2 (hash-identical; target under 5 ms/h) | `../coulee-w6-perf2`, branch `wave6/perf2` |

Two of these, M6 slice 1 and the web map, were launched detached; watch with `pgrep -fa "codex exec"`.

## Next
1. Merge the four in-flight jobs. Screenshot the region map (`pnpm exec tsx scripts/screens.ts`).
2. **Ellie's decisions:** 08 items 11–15 (D1–D3, M5 defaults, M6 defaults including Q04).
3. **Social tuning:** borrow/lend interactions fire about 5 a day in Iron Ford (1,933 a year) against about 1.3 a day in generated towns. Find out why and tune.
4. **M5 slice 2** (census, T1/T2 LOD), then slice 3 (start in a generated county).
5. **r3 persona playtests** on the current build, CLI plus web, with per-agent helper dirs.
6. **Small:** stacked county name qualifiers.

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
