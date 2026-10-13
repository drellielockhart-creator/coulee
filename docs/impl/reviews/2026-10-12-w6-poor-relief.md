# Wave 6: poor relief

Implementation against `36c0d10`, in `wave6/relief`. No commits made.

**Acceptance:** M4 acceptance 3 passes on the matched failed-harvest winter: 20% of households short, 19 ordinary relief transfers plus 198 successful loans, and 0% starvation against the 2% band. The full-year half-stores variant averts winter shortage entirely, so it does not itself satisfy the minimum-shortage condition. All five full-year revised runs have zero starvation deaths. **The performance requirement is not met:** Iron Ford is +8.3% CPU / +7.3% wall time, and town 19 is +8.2% CPU / +8.0% wall time. This is not ready for unconditional acceptance under the requested +5% ceiling.

## Mechanisms

Want is a household proposition, observed at meetings, church attendance, and an unpaid tab ledger. Evidence changes credence; ordinary belief transmission carries the news. The existing shortage chronicle consumes those same propositions and observations. Its public version requires three outside households to know, rather than becoming public simply with age.

Charity and asking are ordinary social interactions and psyche urges. Duty weighs kinship, congregation, opinion, Neighborliness, Thrift, and generosity. Proud recipients can refuse. A giver must retain four days of readiness after a virtual withdrawal; the parcel uses real food and the recipient's cooking requirements. A chosen delivery errand packs food before walking, and a chosen conversation reserves present participants through activity scheduling. There is no rescue at a calendar date or a named actor exception.

Congregation and Club offices have physical pantries, keepers, membership, and institutional favor accounts. Weekly contributions move existing goods and stop at a content-defined stock target of seven days for households the keeper believes to be in want, with a reserve sized to the keeper's household when no need is known. This target limits accumulation; actual distribution still checks cooking requirements and does not treat calories as a complete diet. Congregations prioritize members and form fallible deservingness beliefs; Clubs restrict relief to members. Distributed stacks leave the office inventory. A keeper can contribute personal surplus under the same reserve rule. Relief gratitude and refusals use ordinary memories, opinions, and grudges.

Storekeepers can extend a finite discretionary margin to kin or respected customers, subject to trust, Thrift, shunning, and agency. Exhausted accounts no longer generate futile shopping errands that displace relief-seeking. Scenario keeper attribution takes precedence over a household lodging at the store: Dunleavy's tavern now belongs to the Dunleavys.

Desperation proposes a theft Id urge alongside a conscience urge to ask. The generic executor handles any reachable item, deterministic effort and detection checks, moral anxiety, a superego thought, and witnessed charges feeding existing belief/law and strife machinery. Unseen theft reports missing goods without identifying the culprit to the victim.

Commanded actors use the same interactions and authorization. Requests describe food and favor terms before consent. Existing play/web interaction menus expose giving, asking, and contributing; institutional obligations appear in the play journal and web dossier.

## Contracts and integration

- `social.attemptTheft(world, ctx, { actorId, victimId, itemId?, qty?, basis?, interactionId? })` returns `{ eventId, success, detected, movedId }`. An explicit item may be nonfood; omission selects local food. `theftPreflight` is read-only. Callers supply the command/consent basis when appropriate. The executor performs agency and reachability checks and emits the ordinary interaction event as well as `social.theft`. Charm-specific consequences remain the fae caller's responsibility, using `movedId` after success.
- `social.knowsWant`, `reliefOffices`, `officeOf`, `reliefRules`, `prepareReliefTravel`, and `reliefReservations`; `provisions.reliefParcel`, `householdFoodDays`, and `creditLimitFor` are additive API exports.
- Optional social relief state, optional store refusal timestamps, optional relief obligations in social views, and optional institutional counterparty IDs in the play journal preserve older state/view shapes. New content domains are `reliefRules` and `reliefOffices`; scenario office seeds and interaction relief/theft fields are additive.
- Sibling charm integration should preserve the relief additions in `social/interact.ts`, `social/requests.ts`, and `social/availability.ts` when merging its item-request changes. Theft stays in `social/theft.ts`; charm-specific pressure need not implement a second transfer/detection executor.
- New events: `social.want_known`, `social.relief`, `social.theft`, `provisions.credit_extended`, `provisions.credit_refused`. Knowledge follows participants, witnesses, and private beliefs. Relief state retains what it needs rather than querying old event logs.

## Validation and measurements

`VITEST_MAX_WORKERS=2 just check` passed on the final implementation: 68 test files, 740 tests, all package/script typechecks, Biome, invariants (210 core files), and content validation (105 TOML files). Test duration was 805.30 seconds. The earlier run alongside concurrent year benchmarks exceeded the worldgen manifest test’s 60-second timeout; an isolated retry passed in 47.19 seconds, and the complete final gate passed with the repository’s normal timeouts. `git diff --check` is clean.

The year harness advances 8,760 hourly steps and records daily statistics, event counts, chronicle headlines, and final hashes. The failed-harvest variant removes half of each household food stack on November 1, leaving store supply and all actor decisions ordinary. A short household has reported food readiness below four days, or an active want assessment (below two days); intraday want counts even when aid precedes the next midnight assessment. Winter means November through March. Starvation mortality uses initial population as denominator.

The untouched baseline is extracted from `36c0d10` into `/tmp/coulee-relief-baseline`, with existing dependencies linked in and no installation. Final measurements use `RELIEF_MEASUREMENT_DIR=runs/relief-ship node --import tsx runs/scratch/relief-release.ts iron` and the same command with `town`: each baseline/revised pair runs in one process, alternating which arm goes first in each daily batch. CPU and wall ms/game-hour are reported separately. Town generation and its preliminary QA run occur before timing the year. Planning memoization is confined to a read-only pass; a donor reserve projection stops at the exact comparison horizon. Store totals, household energy/larder sums, and food availability share the existing provision-decision context, with personal credit eligibility checked separately. Charity errands are planned at the content-defined morning hour and Sunday collection; observations and requests continue throughout the day.

The year-long half-stores run can avert winter shortage through relief and borrowing earlier in the year. To test M4's required shortage condition independently, `runs/scratch/relief-winter.ts` also warms the baseline town-7 world to November 1, halves its food once, forks that common fixture, and runs each version through March 31. The revised branch has current content and the ordinary new mechanisms; there are no rescue Commands or actor-specific adjustments. This matched fixture separates the response to winter want from changes to the preceding summer. The baseline final hash agrees with the full baseline failed-harvest year.

The integration suite covers keeper attribution, physical transfer and donor reserves, commanded consent, observed want, fair action menus, members-only relief and institutional privacy, asking one's own household's Club keeper, finite pantry inventory, opinion-based credit, deterministic agency-respecting theft, empty donors, actual collections, and secret theft of nonfood goods. It also verifies that the internal food-horizon query agrees with the full readiness readout and leaves the World unchanged. Internal decisions run the identical meal/storage projection but omit display-only fuel accounting, spoilage descriptions, and the final seven-day readout explanation. Actual fuel/water consumption and spoilage still run hourly. Donor withdrawal reserve results are shared only within a read-only planning pass, keyed by household, stack, quantity, horizon, and time. The shared water query traverses inventory once for supplies and vessel water, and drinking reuses its availability calculation. Routine nutrition conditions build Explain terms only when a condition changes; their emitted text and values are preserved.

Existing fixture adjustments: the fae draw test verifies an actually tied sack, including an autonomous tying earlier that evening. The charm-loan fixtures omit relief policy so alternative food aid does not remove the loan demand they are testing; their loan, return, attachment, and witness assertions remain. A failed persuasion roll is distinguished from a keeper's attachment arbitration. The strict-conscience fixture sets appetite to its minimum rather than depending on incidental money-debt duty to beat hunger. The worldgen layout pin excludes the new empty relief-policy seed field and separately asserts it is empty, preserving all 50 original layout hashes. Combined relief outcomes are measured in the full-content year runs.

Golden reason: explicit tavern ownership changes boarding/economy; ordinary relief collections and known want change the story; public shortage headlines now require evidence of shared knowledge. The snapshot was deliberately regenerated after reviewing the prose.

## Files and ownership

New core implementation: `social/relief.ts`, `social/theft.ts`, and `provisions/relief.ts`. Integration changes are in the social API/state/events/system/urges/interact/requests/availability/view, provisions API/state/events/economy/planner/meals/nutrition, chronicle facts/shortage pattern, content social schema, and play actions/obligations. New TOML covers relief policy, offices, interactions, beliefs, dialogue, and Iron Ford office seeds. The tavern stock seed, social-relief integration tests, and 30-day chronicle snapshot also change.

Out-of-area edits: `packages/core/src/activity/system.ts` and its test mock (delivery packing and conversation reservations through the social API); `apps/web/src/components/dossier/OpinionsTab.tsx` (institutional favors); existing `packages/cli/test/fae-charms.test.ts`, `packages/cli/test/psyche.test.ts`, and `packages/cli/test/worldgen.test.ts` fixtures as explained above; this review document. Shared-contract edits: `packages/content/src/schema/social.ts`, `packages/play/src/actions.ts`, and `packages/play/src/obligations.ts`.

## Year and failed-harvest results

| Scenario | Short in winter | Neighbor / office / collections | Loans / tab purchases / extensions | Theft attempts | Starvation before → after |
|---|---:|---:|---:|---:|---:|
| iron_ford-42 | 1/16 (6%) | 350 / 16 / 93 | 1933 / 1156 / 1 | 2 | 0 → 0 (0.0%) |
| gen-town-7 | 1/10 (10%) | 130 / 5 / 37 | 475 / 1038 / 1 | 0 | 1 → 0 (0.0%) |
| gen-town-19 | 1/12 (8%) | 198 / 12 / 44 | 475 / 1265 / 1 | 0 | 0 → 0 (0.0%) |
| gen-town-73 | 0/10 (0%) | 220 / 19 / 73 | 481 / 1100 / 0 | 0 | 0 → 0 (0.0%) |
| gen-town-7-failed | 0/10 (0%) | 122 / 5 / 32 | 478 / 1031 / 0 | 0 | 1 → 0 (0.0%) |

Loans count successful `borrow` and `lend` interactions; tab purchases count transactions with an actual credit balance added. Relief counts actual food transfers, excluding collections. Shorts are unique households during winter, not a claim that they were short simultaneously.

## Performance

| Scenario | CPU ms/h before | CPU ms/h after | Delta | Wall ms/h before / after |
|---|---:|---:|---:|---:|
| iron_ford-42 | 55.58 | 60.21 | +8.3% | 52.36 / 56.18 |
| gen-town-7 | 36.41 | 35.75 | -1.8% | 32.41 / 33.09 |
| gen-town-19 | 45.73 | 49.46 | +8.2% | 39.13 / 42.24 |
| gen-town-73 | 39.29 | 38.07 | -3.1% | 34.48 / 35.18 |
| gen-town-7-failed | 40.54 | 37.24 | -8.2% | 36.03 / 35.29 |

The aggregate of the five equal-length years is +1.5% CPU and +3.9% wall time. That aggregate is under 5%, but it does not remove the two individual scenario overages. Absolute timings varied with host load; the table uses the complete final alternating-pair run, without selecting favorable timings from earlier trials.

## Monthly means

Each cell is daily mean hunger (0–1000, higher is better) / daily mean total household cash in cents. These are town aggregates; starvation and household shortage counts above retain distributional outcomes.

| Month | Iron Ford 42 | Town 7 | Town 19 | Town 73 | Town 7 failed harvest |
|---|---:|---:|---:|---:|---:|
| 4 | 806 / 38029 | 823 / 6114 | 812 / 9868 | 806 / 7179 | 823 / 6114 |
| 5 | 774 / 32153 | 782 / 3220 | 807 / 5875 | 809 / 3220 | 782 / 3220 |
| 6 | 728 / 27052 | 684 / 1426 | 658 / 3031 | 720 / 1107 | 684 / 1426 |
| 7 | 683 / 22141 | 646 / 437 | 591 / 1367 | 637 / 154 | 646 / 437 |
| 8 | 682 / 17006 | 698 / 32 | 605 / 266 | 644 / 27 | 698 / 32 |
| 9 | 728 / 12030 | 725 / 18 | 650 / 6 | 670 / 16 | 725 / 18 |
| 10 | 783 / 4238 | 803 / 16 | 783 / 77 | 799 / 30 | 803 / 16 |
| 11 | 818 / 399 | 825 / 1 | 807 / 12 | 805 / 35 | 795 / 8 |
| 12 | 799 / 0 | 815 / 0 | 805 / 10 | 799 / 0 | 817 / 0 |
| 1 | 802 / 14 | 820 / 0 | 805 / 0 | 815 / 0 | 809 / 0 |
| 2 | 813 / 10 | 825 / 5 | 781 / 3 | 819 / 1 | 808 / 1 |
| 3 | 764 / 0 | 808 / 0 | 755 / 11 | 774 / 4 | 816 / 2 |

## Chronicle headline audit

Counts exclude bold calendar-date labels. No new per-transfer chronicle headline is introduced, and “In Want” falls to two or three headlines per year. Total volume falls in four cases, but town 73 rises from 242 to 325 (+34%): chiefly existing church conflict stories (“Hard Words” +21, “A Poor Aim” +14) and coolness between neighbors (+12). This increase is disclosed for design review rather than described as an across-the-board reduction in chronicle volume.

| Scenario | Total before → after | In Want before → after | All Over the Ford before → after | Most frequent final headline |
|---|---:|---:|---:|---|
| iron_ford-42 | 456 → 438 | 20 → 2 | 15 → 16 | Unpaid: 41 |
| gen-town-7 | 281 → 263 | 14 → 3 | 3 → 6 | A Poor Aim at Ridge Baptist Church: 37 |
| gen-town-19 | 346 → 327 | 20 → 3 | 15 → 15 | A Poor Aim at Valley Baptist Church: 33 |
| gen-town-73 | 242 → 325 | 12 → 3 | 15 → 20 | A Poor Aim at Valley Baptist Church: 29 |
| gen-town-7-failed | 327 → 256 | 18 → 3 | 3 → 6 | A Poor Aim at Ridge Baptist Church: 43 |

## Matched failed-harvest winter (November–March)

| Version | Short households | Relief parcels | Collections | Successful loans | Tab purchases | Theft | Starvation | CPU / wall ms/h |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| before | 2/10 (20%) | 0 | 0 | 210 | 324 | 0 | 1 (4.17%) | 43.08 / 37.31 |
| after | 2/10 (20%) | 19 | 14 | 198 | 247 | 0 | 0 (0.00%) | 37.69 / 34.29 |

M4 acceptance 3 is assessed on this common winter starting state: at least 10% short, ordinary borrowing or relief, and starvation below the content-defined 20-per-mille band.

Full-year final hashes:

- iron_ford-42: `a1ab090c15a39827` → `4aef97f2d948a6ad`
- gen-town-7: `0349f4288a36bb13` → `ec31057893b41622`
- gen-town-19: `0d7311349868735c` → `0c02eedf8d0e32e7`
- gen-town-73: `734d2253279c35df` → `1c4cd737e2703f30`
- gen-town-7-failed: `020f0963d0ed1624` → `2a375cfaa8dbba54`

## Changed paths

- `apps/web/src/components/dossier/OpinionsTab.tsx`
- `content/base/beliefs/relief.toml`
- `content/base/interactions/relief.toml`
- `content/base/scenarios/iron_ford/35-relief.toml`
- `content/base/scenarios/iron_ford/50-stocks.toml`
- `content/base/social/relief.toml`
- `content/base/social/talk-relief.toml`
- `docs/impl/reviews/2026-10-12-w6-poor-relief.md`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`
- `packages/cli/test/fae-charms.test.ts`
- `packages/cli/test/psyche.test.ts`
- `packages/cli/test/social-relief.test.ts`
- `packages/cli/test/worldgen.test.ts`
- `packages/content/src/schema/social.ts`
- `packages/core/src/activity/system.test.ts`
- `packages/core/src/activity/system.ts`
- `packages/core/src/chronicle/facts.ts`
- `packages/core/src/chronicle/patterns/shortage.ts`
- `packages/core/src/provisions/api.ts`
- `packages/core/src/provisions/economy.ts`
- `packages/core/src/provisions/events.ts`
- `packages/core/src/provisions/meals.ts`
- `packages/core/src/provisions/nutrition.ts`
- `packages/core/src/provisions/planner.ts`
- `packages/core/src/provisions/relief.ts`
- `packages/core/src/provisions/state.ts`
- `packages/core/src/social/api.ts`
- `packages/core/src/social/availability.ts`
- `packages/core/src/social/events.ts`
- `packages/core/src/social/interact.ts`
- `packages/core/src/social/relief.ts`
- `packages/core/src/social/requests.ts`
- `packages/core/src/social/state.ts`
- `packages/core/src/social/system.ts`
- `packages/core/src/social/theft.ts`
- `packages/core/src/social/urges.ts`
- `packages/core/src/social/view.ts`
- `packages/play/src/actions.ts`
- `packages/play/src/obligations.ts`
