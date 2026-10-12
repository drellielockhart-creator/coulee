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

## Wave 5 (in flight)
r2 playtests are done (7 Claude personas, all sessions verify). Triage: `docs/impl/PLAYTEST-TRIAGE-2026-10-11-r2.md`. New decisions D1–D3 for Ellie were added to 08 "Start here" (items 11–13).

| Job | What | Where |
|---|---|---|
| Fae slice 1b + sign fixes | Claude Opus: doc 13 §8.2, plus r2 Tier 1 #6 (investigate oracle) and #7 (sign windows, retries, dead ends) | `../coulee-w5-fae1b`, branch `wave5/fae1b` |
| A: provisions | Claude Opus: water in the wild, food readout, standing sleep/eat, survival ETAs, containers/load, stock, balance | `../coulee-w5-provisions`, branch `wave5/provisions` |
| B: social + play | Claude Opus: availability, waits, requests, fair-leak epilogue/explain, refusal wording, phone-size output, journal/screen, exploits | `../coulee-w5-social`, branch `wave5/social` |
| D: text | DONE and merged (`cc3307c`): distinct generated place names and descriptions, Iron Ford text fixes, talk pools 294 → 1,233 with teller-owned yarns | merged |
| County worldgen | Codex astra: M5a county stage (terrain, hydrology, ecology, fae field, siting, routes, QA 1–64, `coulee gen county` with SVG map, county → town context) | `../coulee-w5-county`, branch `wave5/county` |

## Next, in order
1. **Merge wave 5** one branch at a time (`just check` each). Refresh the golden once.
2. **Codex astra adversarial review** of all of wave 5 (cross-model: Claude built it), then r3 playtests on the fixes.
3. **Ellie's decisions** D1–D3 (08 items 11–13) and the original "Start here" list.
4. **Perf wave 2:** readiness projections, then psyche arbitration, all hash-identical.
5. **Neighbor relief for zero-food households** (M4 acceptance 3), if group A didn't cover it.

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
