# Next session: how to pick up

_Updated 2026-10-13, evening. The repo is https://github.com/drellielockhart-creator/coulee; `main` is the integration branch._

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

## Wave 6 (merged into `main`)
- **Poor relief** (M4 acceptance 3 passes) and **charm refusal costs**.
- **Charm theft:** coveting turns to theft via `social.attemptTheft`; custody vs claims; accusations follow beliefs.
- **The 12 fae 1b cross-model fixes.**
- **Talk listener memory:** repeats are 10–14%.
- **M5:** the plan, slice 1 plus polish, and the basic web region map. Screenshots are in `runs/screens/*-region-*`.
- **M6:** the plan and slice 1, a tenth-second tactical clock with auto-pause on the Q04 defaults (`TICKS_PER_SECOND`), in the opt-in `tavern_instant` fixture.
- **Docs sync and root README.**
- The default test timeout is now 180 s for loaded machines.

**Perf wave 2:** merged (Iron Ford 24.8 → 22.6 ms/h, hash-identical).

## Waves 7–8 (2026-10-13; `main` green, 935 tests)
- **Ellie's 2026-10-13 decisions** (00 log; 08 items 11–15): a minute budget; day labor and piece rates; an opinion band with reasons; all M6 defaults approved. Also for the Director: reads the unconscious (C55), misattribution yes (05 Q8), and a foresight setting.
- **Wave 7:**
  - social loans need funds and need (5.3 → 1.96/day);
  - perf 3 (hash-identical);
  - the web route card;
  - county names (one qualifier);
  - M5 slice 2a (census, tiers, hydration).
- **Wave 8:**
  - the **minute budget** plus Claude-review fixes (lagged physiology, locks, one exchange per pair per hour, `short_act` opt-in);
  - **income** (hiring on, piece rates);
  - the **opinion line** on `inspect`;
  - **M6 slice 2 brawls** plus review fixes (no stalls over seeds 1–300, 0 deaths over 1,000 seeds, rulesVersion 3);
  - **M5 2b–2d**: lifecycle hooks, ownership filters, coarse T2 runs. The fidelity gates fail (rest 47 pp, thirst 31 pp) and the speedup is unmeasured at 2 T2 actors.
- **The storyteller:** Ellie wants a RimWorld-style one. It's the 05 §8 Director, with the plan in `docs/impl/DIRECTOR-PLAN.md`.
  - **D0** (measure only) is on `wave9/director-d0`.
  - Baseline: 96% dead-air hours, about 160–186 entirely quiet days a year, and τ flat at about 140/1000 with no peaks (`docs/impl/director/2026-10-13-d0-baseline.md`).
  - A slimming pass is running before merge (2.25 → <0.5 ms/h; 3.3 MB → <150 KB slice).
- **Merge practice learned today:** never merge in `main`'s checkout while `just check` runs there. Use an integration worktree (`wave8/int-*`), run `just bundle` in fresh worktrees before web tests, then fast-forward `main`.

## Wave 9–10 (2026-10-13, evening; `main` green, 1,027 tests)
- **Director D0** merged: τ, pacing states, a thread registry, the Ledger and personalities as data. It costs 0.18 ms/h and about 55 KB a year.
  - Baseline: 96% dead-air hours, and τ flat at about 140 with no peaks (`docs/impl/director/2026-10-13-d0-baseline.md`).
  - Decisions: it reads the unconscious (C55); misattribution yes; a foresight setting (off/tiltable/full).
- **r3 playtests** (4 Claude personas) were triaged in `docs/impl/PLAYTEST-TRIAGE-2026-10-13-r3.md`. All five fix groups were merged and reconciled:
  - **A** needs at the current hour, sustainable Rest, sleep fixes;
  - **B** fair inspect hides numbers, correct memory roles, hearsay;
  - **C** brawls in any town, scenes retire;
  - **D** capped restock, Sabbath pay, wages, piece rates;
  - **E** fresh dialogue, more short acts, season wording, Cedar Farm well.
- **M5:**
  - 2e: T2 fidelity bands pass;
  - 2f: dormant T3 as an **opt-in prototype**. Generated-town promotion fidelity fails because there is no aggregate shopping or restock.
- **County scale:** Ellie chose dormant T3 plus a faster hourly sim; no statistical T2 and no smaller county.
  - The **real budget** is per tier: T1 400 actors ≤ 40 ms/h on a mid phone, about ≤ 30 µs per actor-hour on desktop. Today it is about 660 µs, roughly 20× over. See the correction at the end of M5-PLAN.
- **Codex quota ran out** at about 18:15 PT on 2026-10-13 and resets on 2026-10-20, unless Ellie uses a banked reset. Use Claude subagents until then. They can edit code but not create report files, so save their final messages (`scratchpad/save-report.py` pattern).

## Next
1. **In flight:** the hourly-sim perf campaign (Claude) on `wave11/perf4` (`../coulee-w11-perf`): hash-identical structural wins first, with behavior-changing ideas listed separately.
2. **T3 follow-up:** aggregate shopping, restock and trade so generated towns survive dormancy; grudge fidelity; then enable T3 automatically.
3. **Director D1:** bias hooks plus N4/N6/N8/N9, the Almanac, the visible-dice invariant; then the era pressures from DIRECTOR-PLAN §4.
4. **r4 playtests** after the perf and D1 work, with helper scripts confined to each agent's own playtest directory.
5. **M6 slice 3** (firearms, injuries, bleeding, treatment).
6. **Open from r3 (deferred):** news crossing between sites (M5 slice 5), empty roads (M5 slice 4 and the Director), gen:town evenings (routine tuning), bacon dominance.

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
