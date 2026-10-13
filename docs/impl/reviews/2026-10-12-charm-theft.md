# Charm theft, wave 6

Implementation is uncommitted on wave6/charm-theft.

## Mechanics

Covet pressure remains desire + 100 per refusal + 200 for a short household. At pressure 250 or higher, an actor wanting the sack (desire at least 20) voices an Id proposal only when generic theft preflight finds the sack reachable. Its strength is pressure + 5 × desire + 200 if the keeping household is away/asleep − 3 × honesty, capped at 990. An honesty-voiced alternative tells them to leave it; ordinary Ego/Self-Command arbitration weighs both. The chosen `steal_charm` activity holds the hour at the reachable sack, avoiding the ordinary schedule moving an autonomous speaker away before an interaction can execute.

Every move is through social.attemptTheft and its authorization, cooldown, roll, detection and moral cost. The existing explicit `take` interaction also uses that executor. Commanded actors require a Command. A narrow social adapter calls fae APIs to audit the move and record a charm loss instead of immediately reporting a generic misfortune. Sleeping people are excluded from detection witnesses.

The existing sack and contents move. Custody changes and its tie clears, while boundTo, rightful owns claims and the former keeper's refusal guilt remain. Witnesses and the taker learn possession, without gaining a rightful claim. Other people learn the loss through a stock count or an ordinary meal-hour check (Perception DC 8, one meal-hour attempt per day). Theft records survive saves and log trimming.

Discovery seeds the existing took_goods/caused beliefs. Witnesses can identify the taker; other observers weigh believed possession and prior charges. A keeper suspects their own refused askers first when evidence supplies no stronger candidate. Refusal records now retain who refused, so a later keeper does not inherit an earlier keeper's reasons for suspicion. These are inferences, and existing belief, strife and law systems carry them onward. The missing-sack paper names no unproved taker; the epilogue names the truth. Stolen custody is a new resolution kind.

## Measurements

| Run | Attempts | Successes | Discoveries | Right accusation transmissions | Wrong accusation transmissions | Audited transactions | Conservation violations | Non-integers |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline, seeds 1–64 × 60 days | 4 | 1 | 1 | 2 | 0 | 1088 | 0 | 0 |
| Hoarder control, seeds 1–8 × 60 days | 16 | 6 | 6 | 21 | 1 | 148 | 0 | 0 |
| Hoarder fixture, seed 1 × 365 days | 2 | 1 | 1 | 8 | 1 | 81 | 0 | 0 |
| Loan fixture, seed 1 × 52 weeks | 1 | 0 | 0 | 0 | 0 | 105 | 0 | 0 |

Baseline has quiet/settled closures; its late theft thread has not yet closed in the 60-day window. The hoarder control has settled/stolen endings, with stolen closures in 5 of 8 seeds. The year closes as stolen. The hoarder control starts with a disclosed sack, attachment 100, low keeper honesty/neighborliness, and three neighbors already refused three times; it is an initial-condition experiment, not a baseline balance change. Counted accusations are spoken belief transmissions carrying took_goods, classified against that victim's latest discovered charm loss, rather than all silent suspicions.

The 52-week check recreates the existing loan-test setup because runs/scratch/rota.ts was absent: Edwin holds the sack at attachment 90 and honesty 70, with reliefRules disabled to isolate loan demand. It opened one loan, returned it on time, with zero breaches or late returns. A weekly rota did not persist through the year; this change does not claim to improve that balance target.

The year finished with all 40 actors alive. Monthly needs/cash/kcal means are in year-monthly.json; daily samples in year-stats.csv. The most common headlines were Unpaid (49), A Debt Pressed (40), and A Good Neighbor (31). The new theft paper and theft epilogue each appeared once.

## Fixture year excerpt

Paper:
> The count finds the moonsilk flour sack missing from its keeping. It was not lent out. A theft is reported; no name has been proved.

Epilogue, April 22:
> Johanne Moe took the moonsilk flour sack from Minerva Fenn, and became its keeper by possession, without a right to it. The sack chose no new master that day.

## Validation

Seven theft integration tests cover desire/opportunity/conscience, commanded and autonomous paths, possession versus right and the original bond, conservation, delayed discovery/save/log trimming, a refused innocent, witnessed detection, failure, and paper/epilogue disclosure. Existing charm and refusal suites passed during implementation. Final gate GREEN: VITEST_MAX_WORKERS=4 VITEST_TEST_TIMEOUT_MS=600000 just check passed (exit 0): 75 test files / 806 tests, biome, all package/script typechecks, invariants across 220 core files, and content validation across 109 files. Full output is in check-green.log. No golden files changed, so no golden-update reason was needed.

## Tracked files changed

- content/base/activities/charms.toml
- content/base/interactions/fae.toml
- content/base/chronicle/patterns-charm.toml
- packages/core/src/fae/actions.ts
- packages/core/src/fae/api.ts
- packages/core/src/fae/discovery.ts
- packages/core/src/fae/events.ts
- packages/core/src/fae/refusal.ts
- packages/core/src/fae/state.ts
- packages/core/src/fae/system.ts
- packages/core/src/fae/urges.ts
- packages/core/src/fae/theft.ts (new)
- packages/core/src/social/theft.ts (fae API adapter and awake witnesses)
- packages/core/src/chronicle/facts.ts
- packages/core/src/chronicle/patterns/charm.ts
- packages/cli/test/fae-theft.test.ts (new)
- scripts/fae1b-batch.ts

Canonical raw results: final-baseline-64x60.jsonl, hoarder-8x60.jsonl, rota-52-weeks.json, and year.json. Preliminary/partial worker runs are excluded from these figures.
