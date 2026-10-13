# Wave 10 A — needs, rest and sleep

All group-A items are implemented; no deferrals. No commit was made.

## Implementation and regressions

| Item | Fix | Regression in `packages/cli/test/play-needs-r3.test.ts` |
|---|---|---|
| A1 / QA H1 | Choose the current activity before physiology; charge sleep/work/waking immediately, for NPCs too. | `A1 H1: idle, work, work, idle charges the activity just performed; sleep and wake have no lag`; `A1/P2: NPC commanded work, sleep and waking use the same current-hour ledger` |
| A1 / QA M6 | Weight short orders and commutes by actual minutes; round the combined need delta once. | `A1 M6: eleven buys then work charges 55 leisure minutes and five work minutes` |
| A1 / meal | Complete meals due by the end of the elapsed hour. | `A1 H1 meal: bought supper feeds within its own elapsed hour` |
| A2 / Rest | Leisure costs 21/h, light activity 30/h, heavy work 48/h before load; deliberate rest restores a net 19/h before nutrition penalties. Ordinary and camp sleep retain 140/h before quality penalties. | `A2: rest recovers immediately after work without sending the actor home`; `A2 Greenhorn: ten work hours, six evening hours and %i camp hours sustain Rest at starting load` (7 and 8 hours) |
| A3 / lodging | Lodging off makes a camp bed in place, even inside the tavern; no bed charge. | `A3 lodging off: sleep at %s camps in place and charges no bed` (mill, landing, tavern) |
| A3 / overridden sleep and whiskey | Exclude sleepers from automatic meals, cooking recruitment and unassisted pending-plate intake. | `A3: standing eat cannot replace commanded sleep with cooking or drink carried whiskey asleep` |
| A3 / other site | Remote-home sleep resolves to a local camp bed. | `A3 Explorer: sleep inside Hale farmhouse stays at Cedar Farm even with home at another site` |

Repros use the r3 QA H1/M6 and session-k sequences, Greenhorn mill/landing lodging and bedtime sequences, and Explorer’s Hale farmhouse destination state. Tests isolate the latter destination rather than repeating the separately tested journey. The old minute-review tests explicitly asserted lagged physiology; they now assert replacement of work/sleep minutes by walking. The road Appetite test starts at Thirst 600 and disables automatic drinking so it tests an unmet thirst urge rather than demanding a drink thought at Thirst 900.

## Year balance

Each baseline and final run uses `just run run --scenario <source> --seed <seed> --years 1 --no-events --save --out runs/scratch/<name>`. Baselines were started before edits. Final runs include the occupancy correction. Each row is the rounded arithmetic mean of daily `stats.csv` hunger/rest/warmth means for that calendar month; March ends March 30 (365 days).

### iron_ford 42

| Month | Baseline H/R/W | Final H/R/W |
|---|---|---|
| 1855-04 | 805 / 528 / 995 | 696 / 801 / 995 |
| 1855-05 | 766 / 506 / 995 | 685 / 778 / 995 |
| 1855-06 | 750 / 502 / 995 | 635 / 764 / 995 |
| 1855-07 | 696 / 458 / 998 | 602 / 740 / 995 |
| 1855-08 | 731 / 446 / 1000 | 639 / 743 / 996 |
| 1855-09 | 744 / 454 / 1000 | 689 / 769 / 1000 |
| 1855-10 | 807 / 457 / 1000 | 725 / 774 / 1000 |
| 1855-11 | 815 / 459 / 1000 | 729 / 770 / 1000 |
| 1855-12 | 808 / 453 / 1000 | 716 / 763 / 1000 |
| 1856-01 | 804 / 452 / 1000 | 685 / 761 / 1000 |
| 1856-02 | 809 / 438 / 1000 | 676 / 730 / 1000 |
| 1856-03 | 780 / 441 / 1000 | 672 / 748 / 1000 |

| Measure | Baseline | Final |
|---|---|---|
| Living actors at year end | 40 | 40 |
| All survival deaths | 0 | 0 |
| Starvation deaths | 0 | 0 |
| Exhaustion deaths | 0 | 0 |
| Year-end food kcal | 75234 | 77695 |
| Year-end cash cents | 0 | 75 |
| Maximum simultaneous collapses in daily samples | 2 | 2 |
| Actor-days collapsed in daily samples | 183 | 89 |

Artifacts: `runs/scratch/baseline-iron/` and `runs/scratch/needs-iron/` (stats, chronicle, manifest, packed save and final hash).

### gen:town 7

| Month | Baseline H/R/W | Final H/R/W |
|---|---|---|
| 1855-04 | 821 / 658 / 1000 | 740 / 891 / 1000 |
| 1855-05 | 778 / 622 / 1000 | 719 / 868 / 1000 |
| 1855-06 | 687 / 546 / 1000 | 646 / 817 / 1000 |
| 1855-07 | 647 / 500 / 1000 | 590 / 780 / 1000 |
| 1855-08 | 656 / 497 / 1000 | 638 / 833 / 1000 |
| 1855-09 | 679 / 504 / 1000 | 650 / 841 / 1000 |
| 1855-10 | 794 / 592 / 1000 | 689 / 854 / 1000 |
| 1855-11 | 832 / 606 / 1000 | 598 / 784 / 1000 |
| 1855-12 | 822 / 619 / 1000 | 588 / 775 / 1000 |
| 1856-01 | 825 / 593 / 1000 | 623 / 808 / 1000 |
| 1856-02 | 827 / 594 / 1000 | 659 / 834 / 1000 |
| 1856-03 | 803 / 592 / 1000 | 629 / 839 / 1000 |

| Measure | Baseline | Final |
|---|---|---|
| Living actors at year end | 24 | 24 |
| All survival deaths | 0 | 0 |
| Starvation deaths | 0 | 0 |
| Exhaustion deaths | 0 | 0 |
| Year-end food kcal | 47625 | 50191 |
| Year-end cash cents | 0 | 0 |
| Maximum simultaneous collapses in daily samples | 1 | 0 |
| Actor-days collapsed in daily samples | 6 | 0 |

Artifacts: `runs/scratch/baseline-gen/` and `runs/scratch/needs-gen/` (stats, chronicle, manifest, packed save and final hash).

No new population starvation/exhaustion collapse appears. Town 7 has no collapsed actors in any final daily sample. Iron Ford’s existing exhaustion is reduced, not eliminated: Pike retains 159 Rest debt at year end; all other actors have no Rest debt. Collapsed actor-days fall from 183 to 89 in Iron Ford and from 6 to 0 in town 7. Hunger means decline when people stop eating in their sleep and spend more time awake, but neither settlement loses an actor, and winter monthly means stay above Hungry. Both final saves have zero nonintegers. Cash depletion is pre-existing economy behavior, outside group A.

## Greenhorn and fair replay

The unmodified Greenhorn starting pack sustains ten heavy work hours and six evening hours: Rest 979 after waking → 309 after work → 183 at bedtime → 1000 after sleep. The new regression checks both seven- and eight-hour camps; it also checks hunger above 300, no Rest debt/collapse, and identical replay hash. These are normal command sequences, without test-state edits. `runs/scratch/greenhorn-day.json` and `greenhorn-day-commands.json` retain a longer diagnostic transcript. That longer trial intentionally buys no food; its later hunger loss is not a claim that the initial rations last forever.

The CLI FAIR transcript in `runs/scratch/needs-fair-final` runs `standing lodging off`, `sleep`, `wait 7h`, `wake`, `work`, `rest`, `sleep`. `just run play --session runs/scratch/needs-fair-final --verify` reports **Verified 7 commands; final hash `2c47db26f694e254`**.

## Golden review

Reason: **Current-hour minute accounting, sustainable Rest and awake-only timely meals change routines and stories.** The reason is recorded alongside the golden assertion. The 30-day golden changes by +87/−97 lines (237 → 227 total). Main headlines change from 18 to 19: debts and kindnesses shift, disputes move between the tavern, print shop and store, and later gossip/omen choices diverge. Gathering attendance and diary entries also change. No chronicle templates were changed.

Year chronicle headline audit, Iron Ford: 466 → 478 main headlines. Largest final categories: Unpaid (34), A Poor Aim at Dunleavy's Tavern (34), A Good Neighbor (31). No per-actor physiology bookkeeping events were introduced.

Year chronicle headline audit, Town 7: 289 → 351 main headlines. Largest final categories: A Poor Aim at Ridge Baptist Church (43), Hard Words at Ridge Baptist Church (28), A Poor Aim at Whitlock Mercantile (20). No per-actor physiology bookkeeping events were introduced.

## Verification

The full suite exposed stale occupancy after care/funerals moved actors following the reordered activity phase; needs now refreshes it through the activity API. The existing 14-day occupancy regression passes. The cold-exposure fixture disables rescue, and the seven-day play fixture issues one explicit bedtime even when Rest never drops below its old 420 trigger.

`VITEST_MAX_WORKERS=2 just check`: **PASS** — 89 test files, 956 tests; Biome, all package/script typechecks, invariants (260 files), and content validation (115 files) are green. Full output: `runs/scratch/needs-check.log`. The gate includes 30-day generated-town checks for seeds 1–50. `git diff --check` is clean.

## Files touched

- `content/base/activities/play.toml`
- `content/base/needs/needs.toml`
- `docs/impl/MODULES.md`
- `docs/impl/WAVE10-A-NEEDS.md`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`
- `packages/cli/test/chronicle.test.ts`
- `packages/cli/test/needs-activities.test.ts`
- `packages/cli/test/play-minutes-review.test.ts`
- `packages/cli/test/play-needs-r3.test.ts`
- `packages/cli/test/play.test.ts`
- `packages/cli/test/region-travel.test.ts`
- `packages/cli/test/survival.test.ts`
- `packages/core/src/activity/api.ts`
- `packages/core/src/activity/state.ts`
- `packages/core/src/activity/system.ts`
- `packages/core/src/needs/state.ts`
- `packages/core/src/needs/system.ts`
- `packages/core/src/provisions/meals.ts`
- `packages/core/src/provisions/services.ts`
- `packages/core/src/provisions/system.ts`
- `packages/core/src/region/coarse.ts`
- `packages/core/src/sim/schedule.ts`
- `packages/play/src/actions.ts`
- `packages/play/src/session.ts`
- `packages/play/src/text.ts`
