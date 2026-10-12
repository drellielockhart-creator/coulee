# Fae slice 1b: one useful object, one dispute

Status: **PARTIAL.** Of the 15 criteria in doc 13 §8.2:
- 11 are MET;
- 4 are PARTIAL: 5 (honor loans), 6 (spread), 9 (year-long rota) and 15 (performance);
- none is NOT MET.

This pass also covers the six fae-sign fixes the orchestrator sent. Codex was out of quota, so all review is my own adversarial review.

- **Branch:** `wave5/fae1b`, from main `5188b00`; uncommitted.
- **Data:**
  - `sessions/<name>/` holds commands.jsonl, metrics.jsonl and transcript.txt for each session, with no saves;
  - `batch/<arm>.jsonl` holds the per-seed results.

## Gate

`VITEST_MAX_WORKERS=6 just check` is green on the final code: 59 test files and 622 tests, plus lint, typecheck of all packages and scripts, invariants and content (exit 0).

There is one golden diff, the Iron Ford 42 30-day chronicle. Store and mill keepers now take a weekly Saturday stock count (17:00–18:00, discovery by count, 13 §5.2), which shifts every later encounter. Iron Ford has no charm.

## Acceptance audit

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `just check` and golden reasons | MET | See the gate above. |
| 2 | Conservation | MET | See below. |
| 3 | Discovery | MET | Tests: an undetected draw creates no misfortune, memory or belief. A stock count finds the total loss once; later counts add only bounded evidence. A household that knows and agreed records nothing new. Counting is a weekly duty. |
| 4 | Loan gate | MET | Test: an autonomous two-household loan, on terms, returned on the day with no `core.command`. Both households and a witness remember it. |
| 5 | Causal ablations | PARTIAL | Three of four effects met; honor loans reduces breaches but does not remove them (see the ablation table). |
| 6 | Spread | PARTIAL (reported, not gating) | See the spread table. |
| 7 | Readiness | MET | See below. |
| 8 | Culpability | MET | Test: after the truth is told, some households retract the hired-man blame and some keep it. `kept_drawing` forms only after a warning. |
| 9 | Attachment, year-long rota | PARTIAL | See "Rota" below. |
| 10 | Iron | MET | Test: a loan falls due while the sack is sealed in iron and the breach still fires; nothing recharges while sealed. Play: "Suppressed: 2.0 lb of iron in contact (Cut nails, lb)". |
| 11 | Persistence | MET | See below. |
| 12 | Fairness | MET | See below. |
| 13 | Agency | MET | 64-seed test: a commanded keeper never ties, lends, gives, hides, takes or answers without an order. The standing order `tie_the_sack_nightly` uses the same executor. A found charm lies where it is until `fae.take`. |
| 14 | Balance | MET | See the year-run section. |
| 15 | Performance | PARTIAL | See the performance section. |

**2. Conservation (MET)**
- 5 arms × 64 seeds × 60 days: 2,552 fae transactions, 0 violations, 0 non-integer values.
- The year run made 53 draws through `transact()`, which throws on any increase.
- Tests cover whole pounds, a partly used top unit staying at the source, empty-source and full-sack dawns, and iron moving the draw to the next source.

**7. Readiness (MET)**
- Tests:
  - planning leaves the world hash unchanged, and its output is the same whether hidden sources hold flour or not;
  - the Rain-Hem forecast matches execution on a 3-day rainy trip and a 7-day trip with cold iron;
  - an unseen hem projects nothing.
- New in this pass: the source is named only after study. Play shows three stages:
  - before seeing the sack work: "what is said of it is not counted until you have seen it work or studied it";
  - after seeing it work: "up to 10 lb of flour some mornings… Where the flour comes from you have not learned. Not counted in food-days.";
  - the hem: "keeps its bag dry for 3 of 5 rainy hours in this plan, then an ordinary flap".

**11. Persistence (MET)**
- Test: save/load and forks in the middle of the arc are bit-identical, and `findNonIntegers` is empty.
- All 14 sessions pass `--verify`.
- The year's Truth entries match `Σ fae.charm_drew` long after the early facts have left the log. The Dec 31 entry names 181 lb across 8 sources.
- A Truth is written again only when the pounds drawn change.

**12. Fairness (MET)**
- Test: fair play leaks no truth, source, case, `boundTo` or ledger through text, ids, actions or the observation.
- I found and fixed a leak: the sack's plan row named "an unwarded store within 3 miles" to a holder who had only seen it stand full. It has a regression test.
- The public paper prints only shortfalls, never sources.

## Causal ablations and spread (64 seeds × 60 days per arm, final code)

The arms (no stage-driven intervention):
- **no-witnesses:** disclosure is switched off.
- **no-shortage:** pantries are kept above the planning horizon.
- **reveal:** `draws_from` is set to 70 on day 4.
- **honor-loans:** the borrower's loan duty is set to its maximum.

**Counts and draws**

| arm | draws (lb) | fae tx / violations | talked | coveted | covet acts |
|---|---:|---:|---:|---:|---:|
| baseline | 9.3 (46) | 596 / 0 | 2.7 | 2.6 | 28 |
| no-witnesses | 8.7 (45) | 554 / 0 | **0** | **0.2** | **1** |
| no-shortage | 7.8 (38) | 497 / 0 | 1.2 | 1.4 | **4** |
| reveal | 4.8 (32) | 308 / 0 | 4.5 | 30.2 | 95 |
| honor-loans | 9.3 (46) | 597 / 0 | 2.9 | 2.8 | 24 |

**Loans, beliefs and resolutions**

| arm | loans / returned / breaches | restitutions / grudges | bane | blamed | L2 / L3 | closed peacefully | resolution kinds |
|---|---:|---:|---:|---:|---:|---:|---|
| baseline | 63 / 57 / 4 | 0 / 4 | 0.9 | 0.5 | 2% / 2% | 70% | dormant, quiet, settled |
| no-witnesses | 52 / 48 / 2 | 0 / 2 | 0.9 | 0.4 | 0 / 0 | 77% | dormant, quiet |
| no-shortage | **20** / 18 / 1 | 0 / 1 | 0.8 | 0.1 | 0 / 0 | 91% | dormant, quiet, settled |
| reveal | 68 / 59 / 9 | **39** / 9 | **32.8** | **0.1** | 27% / 9% | 66% | buried, dormant, restitution, settled |
| honor-loans | 71 / 64 / **3** | 0 / **3** | 0.9 | 0.5 | 2% / 2% | 67% | dormant, quiet |

Verdicts:
- **No witnesses: MET.** `talked` 2.7→0 and `coveted` 2.6→0.2, while draws continue.
- **No shortage: MET.** Covet acts 28→4, loans 63→20.
- **Reveal early: MET.** Bane 0.9→32.8, restitutions 0→39, hired-man blame 0.5→0.1.
- **Honor loans: PARTIAL.** Breaches and grudges fall 4→3 but don't reach zero, and rota closures stay at 0 within 60 days.
  - Making returns household-level already cut the baseline from 16 breaches to 4. The previous batch is archived in `runs/fae1b-v1`.
  - The rest are coordination misses, traced in seeds 2 and 5. On the Sunday it falls due, the borrower calls while the lender's whole household is at church or out visiting. On Monday the borrower's work shift, carried by several stacked thoughts, outranks a single loan thought, which is capped at 1000.

**Spread (baseline):**
- level 2 in 2% of seeds (target 30–90%);
- level 3 in 2% (target 10–60%);
- peaceful closure 70% (target ≥ 15%): met;
- resolution kinds: 3 in baseline (target ≥ 4); 5 across arms, plus `shared` in the year run.

The fixture's keepers, the Fenns, are the poorest and most discreet household (discretion +3, $1.50 in cash). The sack usually goes quiet before the town covets it in numbers. The reveal arm shows the arc can reach level 3 (9% of seeds).

## Year-run balance (`charm_at_iron_ford` 42, `--years 1`)

Values are month-end figures from `stats.csv`; draws and loans come from `events.jsonl`. Household keys:
- h1 Pratts, h2 Brenners, h3 Tveits, h4 Kvales;
- h6 Whitcomb's survey party, h12 Glovers, h13 Haugens;
- p16 Haugen's Grist Mill.

| month | alive | hunger | rest | warmth | kcal | cash $ | tabs $ | lb drawn by source | loans / feedings |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1855-04 | 40 | 763 | 460 | 995 | 99113 | 405.82 | 34.76 | h1 31 | — |
| 1855-05 | 40 | 753 | 426 | 995 | 97360 | 365.44 | 48.13 | — | — |
| 1855-06 | 40 | 716 | 395 | 998 | 94802 | 340.73 | 86.64 | — | — |
| 1855-07 | 40 | 697 | 414 | 998 | 96851 | 314.63 | 128.06 | h6 13, h13 15, p16 2 | 3 opened, 2 closed, fed 2 |
| 1855-08 | 40 | 762 | 467 | 998 | 100607 | 295.59 | 165.11 | h13 5, p16 12 | 1 opened, 1 closed, fed 2 |
| 1855-09 | 40 | 763 | 599 | 1000 | 73558 | 274.28 | 195.62 | h13 27 | 4 opened, 4 closed (1 left at the house), fed 2 |
| 1855-10 | 40 | 825 | 403 | 1000 | 101616 | 177.53 | 368.09 | h2 17, h4 9, h12 1, p16 1 | 4 opened, 2 closed (1 left at the house), fed 3 |
| 1855-11 | 40 | 834 | 416 | 1000 | 98554 | 167.73 | 401.28 | h2 15, h4 12, h3 9 | 3 opened, 3 closed, fed 1 |
| 1855-12 | 40 | 775 | 394 | 1000 | 110429 | 166.99 | 411.91 | h3 12 | 3 opened, 3 closed |
| 1856-01 | 40 | 805 | 452 | 1000 | 113787 | 160.74 | 447.26 | — | 2 opened, 3 closed |
| 1856-02 | 40 | 797 | 412 | 1000 | 104407 | 156.17 | 487.18 | — | — |
| 1856-03 | 40 | 802 | 601 | 1000 | 76672 | 148.01 | 552.67 | — | — |

**Against the base.** The base year at `5188b00` (Iron Ford, no charm) shows the same drift from cash to credit: $406.79 → $174.44 in cash and $40.76 → $534.42 in tabs, with no deaths. This run ends $26 lower in cash and $18 higher in tabs, within run-to-run divergence. The sack moved 181 lb over the year, worth about $9. Hunger stayed at or above 697 every month.

**The sack's year:**
1. Found by Edwin Fenn in April; 31 lb drawn from the Pratts.
2. Quiet in May and June: the Fenns can't buy butter, which only the cash-only Springhouse sells.
3. July to November: the Moes and Glovers borrow it on recharge-duty terms and feed it ("The bowl is licked clean by morning."), 10 times in all.
4. The thread closes on Feb 27: "shared out between households, week and week about".

`fae.omen` made up 2,742 of 1,017,934 events (0.27%).

## Rota (criterion 9)

**What holds.** A keeper at attachment 90 with honesty 70 lends early and lends again, and every loan comes back within the day's grace. A 12-week test asserts this.

**What doesn't.** In 52-week runs (`runs/scratch/rota.ts`), weekly rotas last 6–8 weeks: seed 2 ran days 84–126 with the Glovers and Moes, each loan fed and returned. The rota then lapses when the sack is spent and nobody who can feed it calls.

**Why attachment drains.** It decays a point a day once a week passes without benefit, and a sack that is out on loan gives its keeper no benefit.

**Fixing it needs a design call from Ellie,** either:
- a market where the poorest household can get butter on credit; or
- a rule that a lender benefits from a loan that comes back fed.

## Performance (§7.3)

Method: one-year runs at base `5188b00` and at this worktree, each pair run side by side (`--years 1 --profile --no-events --save`). The machine was shared with other agents' jobs (load 26–40).

| run | ms per game-hour | fae ms/h | belief+social+provisions ms/h | save KB |
|---|---|---|---|---|
| iron_ford 42 | 35.78 → 36.36 (+1.6%) | 0.385 → 0.384 | 18.89 → 19.14 (+1.4%) | 5865 → 5890 (+0.4%) |
| gen:town 1 | 15.70 → 15.29 (−2.6%) | 0.146 → 0.227 | 8.46 → 8.09 (−4.4%) | 4102 → 4030 (−1.7%) |
| gen:town 2 | 16.11 → 16.19 (+0.5%) | 0.141 → 0.293 | 8.79 → 8.45 (−3.9%) | 4651 → 4961 (+6.7%) |
| gen:town 3 | 12.66 → 12.85 (+1.5%) | 0.112 → 0.249 | 6.90 → 6.66 (−3.5%) | 4152 → 4113 (−0.9%) |

Against the budget:
- **Whole run ≤ +10%:** MET.
- **Belief + social + provisions ≤ +5%:** MET.
- **`fae.omen` < 2% of events:** MET (0.27%).
- **fae ≤ 0.3 ms/h:** MET on generated towns. The reservoir sack adds about 0.1 ms/h there. Iron Ford, which has no charm, reads 0.384, identical to its 1a base.
- **Save ≤ +5%:** missed on gen:town 2 (+6.7%). The fae slice grew only 5 KB; the rest is social state from a diverged trajectory with 14k more events.

A 30-day CPU profile of gen:town 1 puts all charm work at about 0.04 ms/h. The rest of the fae system's time is slice 1a's omen work.

## Fair play (session mode, one command per CLI call)

All 14 sessions pass `--verify` on the final content. They were re-recorded by re-issuing their original command lines after the last content change.

- **fixture** (`charm_at_iron_ford` 42, 59 commands):
  1. Empty `signs`; a guessed id gets the generic refusal.
  2. A dead end settles: "You find where the trace ends. It points nowhere further."
  3. The find: "Something lies in the grass at Huldra's Shelf: flour sack, moonsilk ticking, clean and dry as if just set down. A saying comes with it: 'Tie it shut at night and don't look in till the cock crows.'"
  4. Taking it, then "It must be tied after dark. No game time spent."
  5. Tied at 21:00; a second try gets "It is already tied for tonight."
  6. The plan row before and after seeing it work.
  7. "Lent to Michael, due back Sunday the 8th, at noon."
  8. "Heard: Ellis Wayfarer lent the moonsilk flour sack to Michael Dunleavy"
  9. "Michael brings it back to Ellis Wayfarer, on the day."
  10. Signs list Settled and Faded entries.
- **catalog:** the hem's plan row reads "3 of 5 rainy hours"; an oilcloth bag is bought as backup; packed nails take it from 1.0 lb of iron to "Suppressed: 2.0 lb".
- **exploit:** a starving newcomer forages at night and gets no free charm.
- **ironford42:** the generic refusal and a settled dead end.
- **gen1–gen10:** first-day signs; gen 9 hits a dead end. Each generated town has one reservoir sack. Towns 1 and 2 found none in 60 days, consistent with the doc's target of about two finds a year.

**Persona gates**

**Exploit hunter: MET.** `runs/scratch/exploit.ts`, final code:

| attempt | result |
|---|---|
| Tie in daylight, tie twice in a night, feed without makings | All refused at zero cost |
| Dawn draw | 10 lb moved from h6; world flour 1096→1092 (eating); world cents unchanged at 80270 |
| Sell the drawn flour | Cents unchanged (a transfer, not a mint) |
| Farm virtue by feeding after thanking it | "It will take nothing for now (it was thanked aloud)" every time |
| Launder a draw through a loan | Draws made while lent land in the same ledger and cases; the year Truth names those sources |
| Fork | Hash equal |
| Fair-view text | Never matches the ledger, cases or source wording |

**Catalog kid: MET.** The hem changes the packing decision (oilcloth bought, nails kept apart).

**Greenhorn: PARTIAL.** Used `signs`, `investigate`, `fae.use` and `plan` without help. The pending prompts that appeared were favors, not charm requests.

**Socialite: PARTIAL.** Lent the sack, heard who has it and whose it is, and got it back. Took no side in a dispute.

**A story worth retelling?** The year run's is one: a poor house's sack, the Pratts' short flour, a quiet spell, the Moes' turn, 181 lb taken from eight households, then shared week and week about.

## Chronicle (year run)

Epilogue (omniscient):
> **April 15.** The moonsilk flour sack came to Edwin Fenn out of the grass, and the first morning it stood full, nobody in the house asked where the flour had come from.
> **May 14.** The truth of it: the moonsilk flour sack never made a pound of flour. It took 31 lb from the stores of the Pratts.
> **July 8.** The moonsilk flour sack was working again, in Kristoffer Moe's keeping now, and nobody in that house asked where the flour had come from either.
> **November 25.** By now the moonsilk flour sack had taken 169 lb of other people's flour, and the neighbors who wanted it believed it keeps a family in bread.
> **December 31.** The truth of it: … 47 lb from the stores of the Haugens, 32 lb from the stores of the Brenners, 31 lb from the stores of the Pratts, 21 lb from the stores of the Kvales (Kvale Ridge), 21 lb from the stores of the Tveits, 15 lb from Haugen's Grist Mill, 13 lb from the stores of Whitcomb's Survey Party …
> **February 27.** In the end the moonsilk flour sack was shared out between households, week and week about.

Paper (public):
> **Ill Luck** Ill luck is reported: the Pratts' flour came up short at the count. We hear of nothing to be done but to bear it.

## The six sign fixes (tests in `fae-signs-r2.test.ts`)

1. **No existence oracle.** Notice is checked first, and any unnoticed or nonexistent id gets the same refusal: "You have noticed no sign by that name… No game time spent."
2. **Outside the window:** refused at zero cost, with when to come back.
3. **Retries:** one attempt per later window, never two in one ("You have already tested this sign. Returning cannot change the evidence.").
4. **Dead ends close.** Faded signs leave the open list; `signs` shows Settled and Faded.
5. **Description-only omens:** a place's signature reads as its character, not a sign.
6. **Messages:** the empty `signs` message, and refusals without double periods.

## Found and fixed in this pass (each with a test)

- **Recharge duty was recorded but never kept.** A borrower under the duty now feeds the sack at their own hearth, as a duty (superego, norm `duty`).
- **Tending happened wherever the keeper stood.** It now sends the keeper home.
- **Returns had to go to the lender in person.** Any adult of the lender's household now takes it back. A borrower on the return errand who finds nobody to take it leaves it with the house's stores (`loansHourly`, under their own `authorizeAct`). Baseline breaches fell from 16 to 4.
- **The porridge makings could only be bought for cash.** They now go on the tab where the store gives credit.
- **A lender coveted its own lent sack.** Fixed.
- **The plan row leaked the true source.** Fixed (see criterion 12).
- **Chronicle.**
  - A reopened thread repeated an unchanged Truth: three copies in gen:town 3. A Truth is now written again only when the pounds drawn change.
  - It also said the sack "came to Kristoffer Moe out of the grass" when he had borrowed it. A new `when.stage` condition (`arrived` or `again`) fixes this.
- **Earlier in the slice:**
  - the hem block reset during dry hours: a forecast showed "8 of 8" where "3 of 5" was right;
  - burying a full sack crashed;
  - investigation printed nothing;
  - `self` was used as an identifier in core (an invariants violation).

## Contracts, out-of-area edits, remaining issues, files

See the summary above; every contract is listed in `docs/impl/MODULES.md` under module:fae, slice 1b.

**Fae files:**
- New in `packages/core/src/fae/`: `charms`, `draws`, `hem`, `tend`, `found`, `desire`, `witness`, `discovery`, `arc`, `urges`, `actions`, `culpability`, `forecast`.
- Edited in `packages/core/src/fae/`: `state`, `view`, `events`, `commands`, `system`, `api`, `investigate`.
- `packages/content/src/schema/fae.ts`.
- `content/base/{fae/charms,fae/quirks,items/fae,beliefs/charms,activities/charms,interactions/fae,social/talk-charms,scenarios/charm_at_iron_ford,chronicle/patterns-charm}.toml`.
- Tests: `packages/cli/test/{fae-charms,fae-signs-r2}.test.ts` (new), with edits to `fae.test.ts` and `chronicle.test.ts` and the snapshot.
- `scripts/fae1b-batch.ts`.
