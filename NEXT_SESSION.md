# Next session: how to pick up

_Updated 2026-10-14 (wave 13). The repo is https://github.com/drellielockhart-creator/coulee; `main` is the integration branch._

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

## Wave 11 (2026-10-13, late evening; `main` green, 1,037 tests, `f6258e1`)
- **Perf 4** (`wave11/perf4`, Claude; reviewed by a second Claude): all hashes, chronicles and stats identical. Iron Ford 17.6 → 14.7 ms/h; county seed 41 (400 T1 + 2,400 T3) 280 → 123 ms/h, i.e. **~280 µs per T1 actor-hour, still ~9× over 30 µs**. Report: `docs/impl/perf/2026-10-13-wave4-hourly.md`.
  - **Behavior-changing proposals, awaiting Ellie:** daily-step ration projection (25–40%), skip proposal gathering for sleeping or locked minds (10–12%), lazy talk rendering (5–7%), callers drawn from acquaintances and kin (6% at county). Even all four leave T1 5–6× over budget, so reaching the target needs coarser or less frequent simulation per actor: a design decision.
  - **LOW hardening from the review:**
    - the `social/pairs.ts` index assumes edges change only by push or replace;
    - the venue index is keyed by `places` identity, and the 16-entry cap thrashes under projections;
    - `items/api.ts` `at` is prototype-chained (no `Object.keys`);
    - `talk.ts` `WHEN_ORDER` needs `satisfies keyof When`;
    - module caches retain old worlds (use a WeakMap).
- **Director D1** (`wave11/director-d1`): bias hooks N4 carrierWeight, N6 windowPick, N8 optionTilt and N9 thresholdTilt behind a fair-dice gate; a daily planner over `content/base/director/moves.toml`; the **Almanac** personality (`--director almanac`, web `?director=almanac`). The Land Itself stays the default, so the golden is unchanged. Report: `docs/impl/director/2026-10-13-d1.md`.
  - **Claude review fixes:**
    - no N9 tilt on the PC's household;
    - the N4 mutation closure (no fact that can mutate into a charge, people claim or supernatural claim; none about the PC);
    - N8 no longer ping-pongs;
    - the Ledger records only on commit (`activity.settleDirectorChoices`);
    - owners import only `director/api.ts`.
  - **Effect so far: none on dead air.** Only 3 of 90 BUILDs reached a peak, and the budget sits at its 30 cap because few tilts change an outcome. The year tables predate the review fixes, so rerun them.
  - **Open for D2:**
    - `kept_drawing` and `benefited_from` (charm-draw gossip) still pass the N4 filter; add a content tag to exclude them;
    - under-spending and BUILDs that fizzle; N3/N10/N11/N12;
    - Hearthside, Hidebehind and Circuit Rider;
    - the exogenous era pressures (DIRECTOR-PLAN §4), which is where dead air will actually move;
    - a god-only Explain for N8 and N6, and the `full` foresight setting;
    - commanded playtests.

## Wave 12 (2026-10-13, night; `main` green, 1,043 tests)
- **Cheaper food forecasts** (Ellie's pick from the perf proposals; `wave12/food-forecast`, Claude, with a Claude review). Report: `docs/impl/perf/2026-10-13-food-forecast.md`.
  - **What changed:** standing forecasts (bounded by a 125% larder-drop guard, shown in the readiness readout with an Explain); quiet-hour projection; lean days instead of false "out of food".
  - **Planner bugs fixed:** the live diner rule, and no live walking or tactical state leaking into projections.
  - **Speed:** about 17–22% faster (Iron Ford 13.7 → 11.2 ms/h; county 131 → 102).
  - **Balance:** better hunger, far fewer false 50% cuts, no deaths.
  - **Replay `rulesVersion` is now 5.** The golden was refreshed.
  - **Open for Ellie:** restoring full rations is judged at the cut ration, so a household can be restored and then cut again the next day. Should it be judged at full instead?
  - **Open risks:**
    - a standing forecast misses non-kcal losses (cookware, tinder, woodpile) for up to the lease length;
    - Iron Ford household 6's projected thirst swings;
    - the needs module copies all actors per walking actor (O(n²) at county): next perf target.

## Wave 13 (2026-10-14; `main` green, 1,057 tests, `0446981`; replay `rulesVersion` 7)
Ellie said to focus on perf. Three Claude agents, each with a Claude review:
- **perf-needs:** EXACT wins (the needs ledger's O(n²) actor copy, one inventory index per hour, index-backed `tryMerge`, rota grouping); county −18%.
  - **Ellie's decision:** restores are judged at full rations (a 30-day full-ration forecast). A refused restore shops toward a target derived from that forecast (kcal only).
  - Report: `docs/impl/perf/2026-10-14-needs.md`.
- **perf-psyche:** EXACT incremental memory digests (Iron Ford −3–6%; single write path enforced by `memory-digests.test.ts`). The idle-mind cadence was a negative result (no gain) and was removed; the prototype is in `b2ed909`. Report: `docs/impl/perf/2026-10-14-psyche.md`.
- **perf-social:**
  - Lazy talk rendering (`TalkRef`, `social.talkWords`); repeat identity includes the news slots.
  - Call candidates: acquaintances, kin, the 3 nearest households, plus up to 3 "isolated or new" households. County calls now actually land.
  - Escalating loan-return duties (fae fetch plus the social return).
  - Dormancy gated on *live* persecutions only (`region/coarse.ts`).
  - Report: `docs/impl/perf/2026-10-14-social.md`.
- **Combined (this host):**
  - Iron Ford 42 30 d ≈ 10.4 ms/h (17.6 at the start of wave 11), ≈ 260 µs/actor-h. Psyche 4.0, provisions 3.0, social 2.0.
  - County bench, 24 h after a 48 h warmup: seed 41 92 ms/h, seed 42 89 ms/h, ≈ 205 µs per hourly actor. Provisions 38 and psyche 24 dominate; provisions here are the early-county forecast burst.
  - **Still ~7× over the 30 µs budget.** Further gains need coarser or less frequent per-actor simulation: a design call for Ellie.
- **Open follow-ups:**
  - belief grudge urges (insult/dun) propose absent targets and starve duties;
  - persecution rows are never retired (they no longer block dormancy);
  - credit headroom in poor gen towns by winter;
  - the talk-repeat guard is 17% per seed (the 15% target is a mean);
  - the early-county forecast burst (every household forecasts on days 1–3).

## Next
1. **Ellie decides** on the remaining perf proposals (psyche cadence, lazy talk, callers), per-actor coarsening, and the ration-restore question (above).
2. **Director D2:** era pressures first (the "incident deck"), then the under-spend and fizzle fixes, then the charm-draw content tag.
3. **T3 follow-up:** aggregate shopping, restock and trade so generated towns survive dormancy; grudge fidelity; then enable T3 automatically.
4. **r4 playtests**, including an Almanac run, with helper scripts confined to each agent's own playtest directory.
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
