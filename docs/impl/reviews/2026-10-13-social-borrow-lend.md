# Social loan balance — year runs

All runs simulate 365 days with full events.jsonl streams. Needs use 0–1000 (higher is better); cash is the household-box total in stats.csv, not total wealth. Monthly means average daily rows; deltas are tuned minus baseline.

| World | People | Successful loans before → after | All attempts/day before → after | Successful loans/day before → after | After/day per 40 people | Successful zero-money loans before → after |
|---|---:|---:|---:|---:|---:|---:|
| iron42 | 40 | 1933 → 716 | 5.422 → 2.003 | 5.296 → 1.962 | 1.962 | 1030 → 0 |
| gen7 | 24 | 479 → 176 | 1.392 → 0.512 | 1.312 → 0.482 | 0.804 | 262 → 0 |
| gen19 | 27 | 467 → 109 | 1.334 → 0.307 | 1.279 → 0.299 | 0.442 | 280 → 0 |

## Root cause and final tuning

The reported 1,933 Iron Ford loans are successful social interactions, not item-loan openings. `lend` promises 100 cents, `borrow` 150 cents; these interactions have no itemId. Of 1,979 attempts, 1,720 (87%) are within one household. In gen 7, 506/508 (99.6%) are within the household; gen 19 has 465/487 (95.5%).

**The economic loop:** housemates already have access to the same cash box and pantry, but pre-meal hunger raises lending/borrowing utility without checking financial means. Neighborliness, affection, kinship, trust and whim dominate. Iron Ford has 38 adults vs. 19/20 in the generated towns and adult mean thrift 1.00 vs. 1.68/1.90. High-affection family pairs repeatedly loan and repay the same fungible money. Kristoffer → Johanne Moe accounts for 72 attempts and 39 repayments; Jory → Josiah Trevenna and Josiah → Loveday Trevenna each account for 63 attempts. The first Moe loan is day 0 at 07:00 ($1 Johanne → Kristoffer), repaid at 08:00; the reverse loan at 15:00 is repaid at 19:00. The cycle returns the following week, including a $1.50 borrow request netting against a reverse $1 loan. These are money cycles, not borrowed tools being returned and re-borrowed.

**The false-success feedback:** 1,030/1,933 successful Iron Ford interactions move zero cents; gen 7 has 262/479 and gen 19 280/467. `transferCash` correctly returns zero and no debt is added, but the successful interaction still awards gratitude/affection/trust and speaks as though the nominal loan happened. The lender has no cash availability precondition. At year-scale that becomes both log noise and a self-reinforcing social motive. Affection +100 supplies +20 to 1,104 Iron Ford lending choices; kin and whim are common additional contributors. A wealthy borrower and an empty lender were both eligible.

**Final fix:** optional initiator/target minimum-cash preconditions, read through provisions' existing `cashOf` API, configured at one cent to preserve partial loans; additive `cash`/`target_cash` volition drivers in the schema and social evaluator. Borrowers' purse plus spendable household cash applies a data weight of −15 on the existing $0–$10 scale used by `owed_cents`. Hungry people with money already available have less reason to borrow or be offered credit. Values and urgent hunger can outweigh this; commands retain their existing agency rules. No global cap, changed cooldown, new world-state field, item rule, provisions-internal edit, or scenario-specific rule.

Rejected tuning: a flat shared-household penalty suppressed generated-town lending too far; a −20 means weight put Iron Ford at 1.51/day but gen 19 at 0.28/day. The final −15 means weight retains more family generosity while eliminating every successful zero-cash loan. Generated-town rates remain lower than the nominal 40-person target; sizes are 24 and 27, with rates of 0.80 and 0.44 per 40 residents. We have not added loans merely to meet a quota.

Survival/cash assessment: all worlds have zero deaths before and after, and Iron Ford end-of-year collapse count falls from 2 to 1. Monthly cash dips are transient: worst −$7.50 on Iron Ford's June baseline $270.5, and −$2.55 on gen 7's May baseline $32.2; later reserves are comparable or better. Gen 7's August/September hunger/rest means fall (maximum −46/−73.5 points); there are no collapses or deaths and October–March hunger recovers. This is a measured limitation, not a claim that every monthly metric improves. Full cash, kcal, and needs means below.

## Reproduction and verification

Before: `just run run --scenario iron_ford --seed 42 --years 1 --out runs/social-before-iron42` and equivalent `gen:town --seed 7/19` runs. Final: the same commands with `--out runs/social-tuned-{iron42,gen7,gen19}`. Full streamed events, stats, chronicles, manifests and hashes remain in those directories. Scratch scripts are `runs/scratch/social-metadata.ts`, `analyze-social.py`, and `report-social.py`; probe scripts record the alternatives. `analysis.json` beside each run provides actor pairs, terms, transfers, counts and zero-money successes.

Chronicle spam: ran `grep -o '^\*\*[^*]*\*\*' chronicle.md | sort | uniq -c` on all six before/tuned year chronicles, saved to `runs/scratch/social-{before,tuned}-{iron42,gen7,gen19}-headings.txt`. Iron Ford `Unpaid` 41 → 34, `A Debt Pressed` 34 → 33, `A Good Neighbor` 32 → 37, `Accounts Settled` 4 → 5. Kindness headlines also include other interactions, so total headline noise does not track the loan-event reduction directly. Detailed top headings below.

Golden design reason: **Cash-backed loans reflect borrowers' means instead of converting ordinary hunger and family affection into spurious debt.** Refreshed only with `pnpm exec vitest run packages/cli/test/chronicle.test.ts -t 'tells a readable 30-day chronicle' -u`. Snapshot: 221 → 237 lines; 54 → 62 bold headings including the epilogue. Newspaper headings shift from 13 to 19: Debt Pressed 3 → 5 and Good Neighbor 1 → 4; encounter dates/participants, prices, disagreements, and epilogue memories change downstream. No chronicle logic was edited.

Four new regression cases verify lender-vs-borrower cash, shared-box and purse funds, structural checks in all modes, partial-loan eligibility, and identical hunger with rich vs. poor means crossing the choice threshold. The target test and targeted golden test pass. Full gate: lint and every typecheck pass; 79/80 test files, 832/833 tests pass. The sole failure is the fae-owned 12-week fixture assuming at least one object loan in seed 1; it now generates zero. No return assertion fails. A prepared fixture-only patch changes it to seed 5; an exact reproduction of all original assertions passes with three loans returned at due−1 h, due+3 h and due+5 h, zero breaches, and keeper attachment 100. Patch: `runs/scratch/social-fae-test-refresh.patch`; proof: `runs/scratch/social-charm-fixture.ts 5`. The patch is pending scope authorization because this file belongs to fae. Full output is in `runs/scratch/social-check-green.log`.

Tracked files touched (six):
- `content/base/interactions/obligation.toml`
- `packages/content/src/schema/social.ts`
- `packages/core/src/social/volition.ts`
- `packages/core/src/social/availability.ts`
- `packages/cli/test/social.test.ts`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`

No commit. Only touched TypeScript files were formatted. The ignored web content bundle was generated with `just bundle` for the gate's worker tests.

## iron42: monthly means

| Month | Hunger before → after (Δ) | Rest before → after (Δ) | Warmth before → after (Δ) | Household cash $ before → after (Δ) | Kcal/day before → after (Δ) |
|---|---:|---:|---:|---:|---:|
| 1855-04 | 806.4 → 805.4 (-1.1) | 529.3 → 528.1 (-1.2) | 995.0 → 995.0 (+0.0) | 380.3 → 391.5 (+11.2) | 94756.0 → 94783.8 (+27.8) |
| 1855-05 | 774.4 → 765.5 (-8.9) | 506.4 → 505.6 (-0.7) | 995.0 → 995.0 (+0.0) | 321.5 → 320.7 (-0.8) | 95506.6 → 95093.1 (-413.5) |
| 1855-06 | 727.8 → 750.1 (+22.3) | 490.0 → 502.0 (+12.0) | 995.0 → 995.0 (+0.0) | 270.5 → 263.0 (-7.5) | 93598.8 → 94855.8 (+1257.0) |
| 1855-07 | 682.5 → 695.6 (+13.1) | 454.8 → 458.3 (+3.5) | 998.6 → 998.4 (-0.2) | 221.4 → 220.0 (-1.4) | 89988.8 → 90040.3 (+51.5) |
| 1855-08 | 681.7 → 731.0 (+49.3) | 421.6 → 445.9 (+24.3) | 1000.0 → 1000.0 (+0.0) | 170.1 → 173.4 (+3.3) | 92288.1 → 92213.7 (-74.4) |
| 1855-09 | 728.5 → 743.7 (+15.2) | 460.4 → 453.6 (-6.8) | 1000.0 → 1000.0 (+0.0) | 120.3 → 128.7 (+8.4) | 90963.8 → 90587.0 (-376.8) |
| 1855-10 | 783.0 → 807.3 (+24.3) | 447.2 → 456.7 (+9.5) | 1000.0 → 1000.0 (+0.0) | 42.4 → 43.7 (+1.4) | 93411.0 → 94225.1 (+814.1) |
| 1855-11 | 818.5 → 814.6 (-3.9) | 465.8 → 458.8 (-7.0) | 1000.0 → 1000.0 (+0.0) | 4.0 → 12.7 (+8.7) | 95973.7 → 95673.2 (-300.5) |
| 1855-12 | 799.3 → 808.0 (+8.7) | 461.8 → 453.5 (-8.4) | 999.9 → 999.9 (-0.1) | 0.0 → 0.2 (+0.2) | 102497.6 → 101882.4 (-615.3) |
| 1856-01 | 801.8 → 804.1 (+2.3) | 458.3 → 451.7 (-6.6) | 999.8 → 999.6 (-0.2) | 0.1 → 0.3 (+0.2) | 106038.6 → 105772.7 (-265.9) |
| 1856-02 | 812.8 → 809.2 (-3.6) | 436.6 → 438.4 (+1.8) | 1000.0 → 1000.0 (+0.0) | 0.1 → 0.1 (+0.0) | 102784.3 → 101923.8 (-860.6) |
| 1856-03 | 764.5 → 780.0 (+15.5) | 431.5 → 441.1 (+9.6) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.3 (+0.3) | 91971.5 → 91854.2 (-117.3) |

Year-end survival: {"actors_alive": ["40", "40"], "survival_deaths": ["0", "0"], "survival_collapsed": ["2", "1"], "deaths_dehydration": ["0", "0"], "deaths_exhaustion": ["0", "0"], "deaths_heatstroke": ["0", "0"], "deaths_hypothermia": ["0", "0"], "deaths_starvation": ["0", "0"]}

## iron42: chronicle heading counts

| Heading | Before | After |
|---|---:|---:|
| Unpaid | 41 | 34 |
| A Poor Aim at Dunleavy's Tavern | 38 | 35 |
| A Good Neighbor | 32 | 37 |
| A Debt Pressed | 34 | 33 |
| Hard Words at Dunleavy's Tavern | 33 | 26 |
| Peace Made | 5 | 28 |
| Ill Luck | 17 | 21 |
| A Brawl at Dunleavy's Tavern | 20 | 10 |
| All Over the Ford | 16 | 16 |
| Hard Words at Ferry Landing | 15 | 5 |
| Hard Words at Pratt & Daughter, Outfitters | 5 | 15 |
| Hard Words at Iron Ford Lutheran Church | 2 | 13 |
| An Apology | 12 | 12 |
| A Coolness Between Neighbors | 10 | 11 |
| Hard Words at Trevenna House | 11 | 6 |
| A Heavy Loss | 10 | 9 |
| A Poor Aim at Pratt & Daughter, Outfitters | 1 | 10 |
| July 29. | 10 | 9 |
| August 12. | 3 | 9 |
| Keeping Company | 6 | 9 |

Total bold headings: 975 → 1026.

## gen7: monthly means

| Month | Hunger before → after (Δ) | Rest before → after (Δ) | Warmth before → after (Δ) | Household cash $ before → after (Δ) | Kcal/day before → after (Δ) |
|---|---:|---:|---:|---:|---:|
| 1855-04 | 823.0 → 820.5 (-2.5) | 662.1 → 658.2 (-3.9) | 1000.0 → 1000.0 (+0.0) | 61.1 → 62.9 (+1.8) | 57673.2 → 57494.5 (-178.7) |
| 1855-05 | 782.4 → 777.6 (-4.8) | 631.1 → 622.5 (-8.6) | 1000.0 → 1000.0 (+0.0) | 32.2 → 29.7 (-2.5) | 57663.6 → 57685.2 (+21.5) |
| 1855-06 | 684.0 → 687.3 (+3.3) | 554.1 → 546.3 (-7.8) | 1000.0 → 1000.0 (+0.0) | 14.3 → 14.6 (+0.3) | 56117.2 → 55722.8 (-394.4) |
| 1855-07 | 645.9 → 647.3 (+1.4) | 516.5 → 499.6 (-16.8) | 1000.0 → 1000.0 (+0.0) | 4.4 → 5.5 (+1.1) | 54572.2 → 53759.9 (-812.3) |
| 1855-08 | 698.2 → 655.8 (-42.4) | 550.7 → 497.4 (-53.3) | 1000.0 → 1000.0 (+0.0) | 0.3 → 0.8 (+0.4) | 56121.7 → 55114.8 (-1006.9) |
| 1855-09 | 724.6 → 678.6 (-46.0) | 577.5 → 504.0 (-73.5) | 1000.0 → 1000.0 (+0.0) | 0.2 → 0.3 (+0.1) | 56269.7 → 54883.0 (-1386.8) |
| 1855-10 | 803.2 → 794.1 (-9.1) | 590.2 → 592.0 (+1.8) | 1000.0 → 1000.0 (+0.0) | 0.2 → 0.2 (+0.0) | 57981.9 → 57582.9 (-399.0) |
| 1855-11 | 824.5 → 832.0 (+7.5) | 629.6 → 605.8 (-23.8) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (-0.0) | 58940.0 → 59045.1 (+105.2) |
| 1855-12 | 815.1 → 821.9 (+6.8) | 626.2 → 618.9 (-7.2) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (+0.0) | 63041.3 → 63470.0 (+428.6) |
| 1856-01 | 821.4 → 825.2 (+3.8) | 590.6 → 593.0 (+2.4) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (-0.0) | 64860.7 → 65568.0 (+707.4) |
| 1856-02 | 821.2 → 827.0 (+5.8) | 597.1 → 594.3 (-2.8) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (-0.0) | 63115.1 → 63475.4 (+360.3) |
| 1856-03 | 794.0 → 803.0 (+9.0) | 607.4 → 591.5 (-15.9) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (+0.0) | 58296.0 → 58201.7 (-94.2) |

Year-end survival: {"actors_alive": ["24", "24"], "survival_deaths": ["0", "0"], "survival_collapsed": ["0", "0"], "deaths_dehydration": ["0", "0"], "deaths_exhaustion": ["0", "0"], "deaths_heatstroke": ["0", "0"], "deaths_hypothermia": ["0", "0"], "deaths_starvation": ["0", "0"]}

## gen7: chronicle heading counts

| Heading | Before | After |
|---|---:|---:|
| A Poor Aim at Ridge Baptist Church | 32 | 37 |
| Hard Words at Ridge Baptist Church | 21 | 24 |
| A Poor Aim at Whitlock Mercantile | 15 | 11 |
| A Laughingstock at Ridge Baptist Church | 14 | 12 |
| A Coolness Between Neighbors | 12 | 13 |
| A Debt Pressed | 13 | 13 |
| Hard Words at Whitlock Mercantile | 12 | 13 |
| Unpaid | 13 | 12 |
| A Good Neighbor | 12 | 10 |
| A Poor Aim at Rush Creek District School | 4 | 11 |
| January 20. | 6 | 9 |
| A Truce, of a Kind | 6 | 8 |
| August 19. | 8 | 2 |
| December 16. | 8 | 8 |
| December 2. | 8 | 8 |
| December 23. | 8 | 5 |
| December 30. | 8 | 6 |
| December 9. | 7 | 8 |
| February 1. | 0 | 8 |
| February 10. | 3 | 8 |

Total bold headings: 756 → 826.

## gen19: monthly means

| Month | Hunger before → after (Δ) | Rest before → after (Δ) | Warmth before → after (Δ) | Household cash $ before → after (Δ) | Kcal/day before → after (Δ) |
|---|---:|---:|---:|---:|---:|
| 1855-04 | 812.3 → 814.1 (+1.8) | 623.6 → 626.8 (+3.2) | 1000.0 → 1000.0 (+0.0) | 98.7 → 100.0 (+1.3) | 64654.1 → 64430.5 (-223.6) |
| 1855-05 | 809.2 → 803.3 (-5.9) | 614.9 → 622.5 (+7.6) | 1000.0 → 1000.0 (+0.0) | 58.8 → 60.5 (+1.7) | 65586.0 → 65288.0 (-298.0) |
| 1855-06 | 662.7 → 672.3 (+9.7) | 519.7 → 532.7 (+13.0) | 1000.0 → 1000.0 (+0.0) | 32.5 → 32.9 (+0.4) | 62380.1 → 62669.3 (+289.2) |
| 1855-07 | 609.0 → 607.3 (-1.6) | 455.8 → 457.4 (+1.5) | 1000.0 → 1000.0 (+0.0) | 13.3 → 15.9 (+2.5) | 61438.1 → 61056.8 (-381.3) |
| 1855-08 | 581.8 → 615.5 (+33.8) | 445.9 → 464.9 (+19.0) | 1000.0 → 1000.0 (+0.0) | 2.2 → 5.3 (+3.1) | 61293.3 → 62222.3 (+928.9) |
| 1855-09 | 620.3 → 661.8 (+41.5) | 473.5 → 510.7 (+37.2) | 1000.0 → 1000.0 (+0.0) | 0.0 → 1.7 (+1.7) | 62280.1 → 62310.0 (+29.9) |
| 1855-10 | 782.5 → 783.2 (+0.7) | 560.8 → 555.9 (-4.9) | 1000.0 → 1000.0 (+0.0) | 0.1 → 0.0 (-0.1) | 66319.0 → 66354.8 (+35.8) |
| 1855-11 | 800.4 → 799.2 (-1.3) | 604.9 → 598.4 (-6.5) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (+0.0) | 66595.5 → 66755.9 (+160.4) |
| 1855-12 | 802.5 → 809.7 (+7.2) | 597.8 → 596.2 (-1.5) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (+0.0) | 70750.7 → 71767.6 (+1016.9) |
| 1856-01 | 799.3 → 805.4 (+6.1) | 583.4 → 584.7 (+1.3) | 1000.0 → 1000.0 (+0.0) | 0.0 → 0.0 (-0.0) | 73400.5 → 74235.8 (+835.3) |
| 1856-02 | 774.9 → 808.1 (+33.2) | 579.6 → 581.0 (+1.4) | 1000.0 → 1000.0 (+0.0) | 0.6 → 0.0 (-0.6) | 69955.8 → 71291.6 (+1335.8) |
| 1856-03 | 740.0 → 772.8 (+32.8) | 554.7 → 569.8 (+15.1) | 1000.0 → 1000.0 (+0.0) | 0.2 → 0.0 (-0.2) | 64413.8 → 65594.0 (+1180.2) |

Year-end survival: {"actors_alive": ["27", "27"], "survival_deaths": ["0", "0"], "survival_collapsed": ["0", "0"], "deaths_dehydration": ["0", "0"], "deaths_exhaustion": ["0", "0"], "deaths_heatstroke": ["0", "0"], "deaths_hypothermia": ["0", "0"], "deaths_starvation": ["0", "0"]}

## gen19: chronicle heading counts

| Heading | Before | After |
|---|---:|---:|
| A Poor Aim at Valley Baptist Church | 39 | 27 |
| A Debt Pressed | 35 | 29 |
| Unpaid | 31 | 24 |
| A Good Neighbor | 21 | 25 |
| Hard Words at Valley Baptist Church | 23 | 7 |
| A Coolness Between Neighbors | 17 | 9 |
| All Over the Ford | 16 | 14 |
| A Poor Aim at Jordan's General Store | 15 | 9 |
| Hard Words at Jordan's General Store | 15 | 11 |
| Ill Luck | 13 | 15 |
| A Poor Aim at Trout Creek District School | 14 | 0 |
| A Brawl at Jordan's General Store | 10 | 7 |
| A Laughingstock at Valley Baptist Church | 10 | 10 |
| March 30. | 9 | 8 |
| The Talk of the County | 5 | 9 |
| A Truce, of a Kind | 8 | 4 |
| December 16. | 8 | 7 |
| December 2. | 8 | 1 |
| December 30. | 8 | 5 |
| December 9. | 8 | 4 |

Total bold headings: 892 → 778.

Mechanical invariants passed (235 files), content validation passed (110 files), and `git diff --check` passed. No tracked file outside the six listed above was edited. The fae fixture refresh is prepared but unapplied.
