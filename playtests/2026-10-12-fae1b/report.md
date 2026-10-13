# Fae slice 1b: one useful object, one dispute

Status: **PARTIAL.** Of the 15 criteria in doc 13 §8.2:
- 11 are MET;
- 1 is ACCEPTED by Ellie's ruling: 5 (honor-loans residual breaches are texture);
- 3 are PARTIAL: 6 (spread), 9 (year-long rota) and 15 (performance);
- none is NOT MET.

Update 2026-10-12 (later): main's r2 wave was merged into this branch, and Ellie ruled on two of the open design calls. See "Merge with main and Ellie's rulings" below. Sections further down carry the earlier, pre-credit numbers unless marked otherwise.

This pass also covers the six fae-sign fixes the orchestrator sent. Codex was out of quota, so all review is my own adversarial review.

- **Branch:** `wave5/fae1b`, from main `5188b00`; uncommitted.
- **Data:**
  - `sessions/<name>/` holds commands.jsonl, metrics.jsonl and transcript.txt for each session, with no saves;
  - `batch/<arm>.jsonl` holds the per-seed results.

## Gate

**Merged tree (final):** `just check` is green: 65 test files and 704 tests, plus lint, typecheck, invariants and content (exit 0). The golden Iron Ford 42 snapshot was refreshed once on the merge, for the same reason as below. The springhouse keeper doesn't change it.

**Branch before the merge:** `VITEST_MAX_WORKERS=6 just check` was green on the final code: 59 test files and 622 tests, plus lint, typecheck of all packages and scripts, invariants and content (exit 0).

There is one golden diff, the Iron Ford 42 30-day chronicle. Store and mill keepers now take a weekly Saturday stock count (17:00–18:00, discovery by count, 13 §5.2), which shifts every later encounter. Iron Ford has no charm.

## Merge with main and Ellie's rulings (2026-10-12, later)

**The merge.** Main's r2 wave was merged into `wave5/fae1b`: provisions (water, standing sleep and eat, `pay_lodging`, freight and restock, readiness), social (availability, waits, requests with terms and menus, gifts as real items, courtship, purse-to-purse loans), text (talk pools), and the county worldgen stage. Nine files conflicted. Both sides' behavior was kept:
- **`psyche/standing.toml`:** both standing capabilities, `tie_the_sack_nightly` and `pay_lodging`.
- **`social/events.ts`:** `social.interaction` carries both my `itemId` and main's `atWork`, `cents` and `itemDefId`.
- **`social/interact.ts`:**
  - both imports;
  - the holder's own decision on item requests runs before main's gift check;
  - the event payload carries both sides' fields;
  - request text now comes from main's `requestTerms`, which I extended (additively) with the four item responses: "begs the loan of what you keep, to bring it back by Sunday the 8th of April…", "asks for back what you were lent", and the rest. The old inline sentence and `dueWords` are gone.
- **`provisions/api.ts`:** `Readiness` carries both `charms?` and main's `needExplain?` and `needRange?`.
- **`provisions/planner.ts`:** main's pending-meal kcal and hypothetical pass, plus my early return through `charmRows` and the projected hem set.
- **`play/actions.ts`:** main's "Yes to / No to …" request labels. `requestLabel` gained the item cases (no money or favor owed), and my `requestNoun` was retired.
- **`play/text.ts`:** main's "Asked of you: …" request lines, and my charm lines kept beside them.
- **`cli/play-session.ts`:** main's one-line refusal. It already strips trailing periods, which was my sign fix 6.
- **The golden:** refreshed once, with the reason recorded in `chronicle.test.ts`.

**After the merge:**
- **Obligations and claims.** Main's new views list money and favors; things lent on terms now appear there too.
  - The lender sees "Michael Dunleavy has your flour sack, moonsilk ticking, lent until Sunday, the 8th of April, 1855."
  - A borrowing PC sees "You have Edwin's flour sack, moonsilk ticking, due back …".
  - Test: "a thing lent on terms shows as a claim…".
- **Fairness re-checked against main's new views.**
  - Setup: the PC keeps the sack, ties it, sees a draw and lends it.
  - Views scanned: the rendered observation (with the "To you" digest), `inspect me`, journal, plan, signs, and a refused charm order.
  - Result: none contains a ledger, case, source wording, `boundTo` or Truth text. Test: "the r2 views … leak nothing".
- **Agency re-checked against main's free settings.** The 64-seed commanded-keeper test and the standing-order test pass unchanged on the merged tree.
- **One of main's tests changed.** `worldgen.test.ts` pins a layout hash per generated town. The fae reservoir is now left out of that hash: it isn't layout and comes from its own random stream. With it left out, the pins reproduce main's values exactly.

**Ruling (a): butter on credit.** Implemented as data: `stocks[].keeper`, a new optional scenario field, names the household that keeps a store nobody lives at or works in. Iron Ford's town springhouse is kept by the Pratts, so its credit follows Pratt's rules exactly.
- **Iron Ford year control.** I ran Iron Ford 42 for a year with and without the keeper line. Hunger, kcal, cash and deaths are identical through September, then diverge slightly. There were no deaths either way.
- **A stats bug it exposed.** `provisions_tabs_cents` counted a keeper's ledger once per store kept. It now counts each ledger once (`provisions/view.ts`).
- **Batch after credit** (64 seeds × 60 days):

| arm | draws (lb) | fae tx / violations | loans / returned / breaches | grudges | L2 / L3 | closed peacefully | resolution kinds |
|---|---:|---:|---:|---:|---:|---:|---|
| baseline | 15.8 (63) | 1010 / 0 | 59 / 50 / 8 | 8 | 5% / 2% | 70% | quiet, settled |
| honor-loans | 15.9 (63) | 1020 / 0 | 63 / 52 / 5 | 5 | 3% / 3% | 69% | quiet, settled |

  - The sack no longer goes dormant: draws are up 70%, and `dormant` disappears as a resolution.
  - Honor loans still cuts breaches (8 → 5); per ruling (b), the rest stand.

**The fixture year after credit:**
- 140 draws, about 457 lb, mostly from Haugen's Grist Mill.
- 25 recharges, fed by the Fenns on credit.
- 3 loans, all in April–May, 2 of them left at the house.
- `fae.omen` was 0.26% of events.
- 40 alive all year; monthly hunger means 685–819.

The chronicle reads:
> **April 15.** The moonsilk flour sack came to Edwin Fenn out of the grass…
> **June 23.** The moonsilk flour sack was working again, in Minerva Fenn's keeping now…
> **July 22.** In the end the moonsilk flour sack was kept quietly.
> **July 29.** The moonsilk flour sack went on working in Minerva Fenn's house, a pound of somebody's flour at a time.
> **December 10.** The truth of it: … 156 lb from Haugen's Grist Mill, 58 lb from the stores of the Glovers, 46 lb from the stores of Miss Stoughton, 44 lb from the stores of the Pratts …
> **March 10.** The truth of it: … 257 lb from Haugen's Grist Mill …

**Chronicle fixes found in that year** (each tested):
- **"Shared out" overstated.** A closure said "shared out between households, week and week about" months after the last loan. `shared` now needs a rota active within the quiet window.
- **"Working again" repeated.** A story reopened under the same keeper repeated "working again… either". It now gets `when.stage = still` and its own short line.
- **Stories forgot their history.** Charm stories read their past from the 40-entry closed-thread list, which other patterns' closures evict within days, so the Truth dedupe and the previous keeper could be lost. Both now live in `ChronicleState.charmMemo?`, an optional per-charm memory created on first use.

**Ruling (b): due dates missed while the lender's house is at church or out are texture.** The honor-loans residual breaches stand: criterion 5 is ACCEPTED.

**Sessions.** The archived sessions were recorded on the branch's content before the merge. Merged content has a different hash, so they no longer pass `--verify` against main. That's true of any session archived before a content change; they replay on the pre-merge commit `9117458`.

## Acceptance audit

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `just check` and golden reasons | MET | See the gate above. |
| 2 | Conservation | MET | See below. |
| 3 | Discovery | MET | Tests: an undetected draw creates no misfortune, memory or belief. A stock count finds the total loss once; later counts add only bounded evidence. A household that knows and agreed records nothing new. Counting is a weekly duty. |
| 4 | Loan gate | MET | Test: an autonomous two-household loan, on terms, returned on the day with no `core.command`. Both households and a witness remember it. |
| 5 | Causal ablations | ACCEPTED (Ellie, 2026-10-12) | Three of four effects met. Under honor loans, breaches fall but aren't removed. Ellie ruled that a due date missed because the lender's house is at church or out is texture, so the residual breaches stand. Rota closures still don't rise within 60 days. |
| 6 | Spread | PARTIAL (reported, not gating) | See the spread table. |
| 7 | Readiness | MET | See below. |
| 8 | Culpability | MET | Test: after the truth is told, some households retract the hired-man blame and some keep it. `kept_drawing` forms only after a warning. |
| 9 | Attachment, year-long rota | PARTIAL (much improved by refusal costs) | With refusal costs (wave 6), 52-week runs lend in 42 of 52 weeks (seed 1) and hold a 29-week unbroken weekly rota (seed 5). No seed holds all 52 weeks. See "Refusal costs" below. |
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

### Before butter on credit

- **What held.** A keeper at attachment 90 with honesty 70 lent early and lent again, and every loan came back within the day's grace.
- **What didn't.** Weekly rotas lasted 6–8 weeks, then lapsed when the sack was spent and nobody who could feed it called. Attachment decayed while the sack was out on loan.

### After butter on credit (Ellie, 2026-10-12)

**The change.** The town springhouse is now kept by the Pratts. This is scenario data, `stocks[].keeper = "pratt"`, so its dairy gives ordinary store credit: the Pratts' ledger, their regard for the buyer, the 3000¢ limit. There is no fae-specific money path.

**The sack stops starving.**
- The Fenns buy butter on the tab and feed it themselves about weekly ("The bowl is licked clean by morning.").
- The keeper's attachment stays at its cap of 100.
- In the fixture year, draws rose from 53 to 140 and recharges from 10 to 25.

**52-week rota runs** (`runs/scratch/rota.ts`, keeper at 90, honesty 70, the Moes wanting it):

| seed | loans / returned / breaches | weekly stretch | keeper attachment, virtue at year end |
|---|---|---|---|
| 1 | 9 / 9 / 0, all to the Hatches | days 0–7, then near-weekly from day 238 to day 357 (about 17 weeks) | 100, 1 |
| 2 | 0 | none: the keeper keeps it all year | 100, 2 |

**Why the rota still doesn't hold for a year.** The Fenns can now feed the sack themselves, so they no longer lend it to a neighbor who can. At attachment 100, the keep term in the holder's arbitration is 5 × attachment = 500. Before any rota exists, neighborliness, need and trust rarely outweigh that. In a 12-week run of seed 1, all 17 neighbors' begs were refused, each with an explained arbitration. Once a loan has come back cleanly, the rota-promise term (300 + duty × 3) carries the rota forward, as in seed 1's run from day 238.

**Status: PARTIAL.** Holding a rota for a full year would need another design call:
- should attachment at its cap still yield to an honest keeper's neighbors (for example, cap the keep weight, or add an honesty term when a neighbor covets it openly)?
- or should the rota start from the first clean loan, wherever it comes from?

The 12-week test now asserts what holds. The keeper lends on terms, every loan comes back on the day, and a refused beg is an arbitration that weighs attachment against neighborliness, not a veto.

## Refusal costs (wave 6, 2026-10-12)

**Ruling.** Ellie delegated the open question: "go with the option that leads to the most interesting gameplay outcomes" (design-docs/00 decisions). A keeper at the attachment cap may refuse, but refusal has costs on both sides, so it becomes a story, not a stall. It is implemented in `packages/core/src/fae/refusal.ts`.

**What counts as a refusal.** Three cases call `charmRefused`:
- a failed `beg_loan` (the keeper's own arbitration, or a failed persuasion);
- a commanded keeper answering "no" to a lend request;
- a commanded keeper letting such a request lapse.

**The keeper's side.**
- **Guilt per refusal:** ⌊(2 × honesty + neighborliness) × need% × bond% / 10000⌋.
  - need% is 150 if the asker's household is short, else 100.
  - bond% is 100 + affection, with affection clamped to −50..100.
  - Guilt caps at 600, decays about 4% a day, and halves when the keeper lends to a household once turned away.
  - An honest keeper refusing a needy friend gains about 430; a dishonest keeper gains about 70.
- **What guilt does:**
  - It adds moral anxiety and a superego "I turned Johanne away" thought aimed at lending to them.
  - It is a pro term, "Guilt over turning neighbors away", in the next lending decision: in full toward a household already refused, half toward anyone else.
  - It pushes lending unasked to a refused neighbor who is present.
- **Commanded PC:** the guilt is felt (the conscience thought is held for orders), but the PC refuses or lends only by Command.
- **Legibility:** an inner event `fae.turned_away` carries the guilt formula as an Explain, knowledge `self`.

**The refused side.**
- Their opinion of the keeper falls: "Turned us away when we asked" (trust −6, affection −4, respect −2).
- Their desire for the sack rises by 8, or 16 if their household is short; covet acts follow.
- They observe `hoards(household, item)` ("…keep it to themselves while others go short", juiciness 60), which spreads by rumor.
- Repeat refusals found grudges along the existing strife lines: the third refusal founds an `apology` grudge, the fifth a `humiliation` grudge.

**Theft hook.** Theft is not built here. `charmCovetPressure(world, actorId, itemId)` (desire + 100 per refusal + 200 if short, and 0 for the keeper's own house) is the hook the generic desperation-theft act (wave 6 relief, module:social) can read. A comment marks the covet code where it would route.

**The epilogue tells it.** Fixture year, seed 42: Edwin Fenn refused 14 times and lent 11 times.
> **September 24.** Edwin Fenn turned Clara Stoughton away a third time. It sat on Edwin's conscience, and Clara began to say the sack was kept from people who went short.
> **October 8.** In the end Edwin Fenn lent the moonsilk flour sack to Clara Stoughton, whom Edwin had turned away, and slept the better for it.

**52-week rota** (`runs/scratch/rota2.ts`: the Fenns keep the sack at attachment 90 and honesty 70; the Moes want it). Before is main `36c0d10`; after is with refusal costs:

| seed | loans | refusals | longest weekly run | breaches | refusal grudges | gossip holders | guilt (year end) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 10 → **42** | 78 → 28 | 3 → **11** | 1 → 0 | 0 → 1 | 0 → 2 | 60 |
| 2 | 3 → 14 | 49 → 9 | 2 → 4 | 1 → 2 | 0 → 0 | 0 → 0 | 0 |
| 3 | 0 → 2 | 8 → 5 | 0 → 2 | 0 → 0 | 0 → 2 | 0 → 1 | 109 |
| 4 | 0 → 5 | 4 → 4 | 0 → 5 | 0 → 0 | 0 → 0 | 0 → 1 | 108 |
| 5 | 0 → **33** | 59 → 33 | 0 → **29** | 0 → 0 | 0 → 2 | 0 → 1 | 66 |
| 6 | 0 → 14 | 99 → 30 | 0 → 2 | 0 → 0 | 0 → 1 | 0 → 1 | 147 |

Over the six seeds:
- **Loans** rose from 13 to 110 and **refusals** fell from 297 to 109.
- **Seed 1** lent in 42 of 52 weeks.
- **Seed 5** ran an unbroken weekly rota for 29 weeks.
- **Seeds 3 and 4** stay sparse: few people asked.
- **Attachment** drains while the sack is out (seeds 1, 2 and 5 end at 0–13). The rota then runs on promise and conscience, not on attachment.

**Batch** (64 seeds × 60 days, main `36c0d10` → refusal costs):

| arm | loans / returned / breaches | refusals | covet acts | gossip (mean) | guilt max (mean) | L2 / L3 | closed peacefully | kinds | violations | non-integers |
|---|---|---:|---:|---:|---:|---|---:|---|---:|---:|
| baseline | 53/48/4 → 52/47/7 | 17 → 14 | 43 → 38 | 0 → 0.1 | 0 → 26 | 3%/0 → 2%/0 | 78% → 78% | quiet, settled, shared | 0 → 0 | 1 → 0 |
| honor-loans | 52/48/4 → 53/48/2 | 13 → 20 | 37 → 42 | 0 → 0.2 | 0 → 39 | 3%/0 → 3%/0 | 80% → 80% | quiet, settled, shared | 0 → 0 | 1 → 0 |

In 60 days a seed sees only about 0.2–0.3 refusals, so the batch barely moves. Spread (criterion 6) is unchanged: level 2 is 2–3% and level 3 is 0, against targets of 30–90% and 10–60%. The year is where refusal costs act.

The one non-integer before was a pre-existing `-0` in social's opinion-reason merge (seed 42, day 60). It is fixed (`social/opinion.ts`, an out-of-area edit).

**Tests** (`packages/cli/test/fae-refusal.test.ts`, 5 tests):
- honest versus dishonest guilt, and the guilt term in the next decision;
- the refused side: opinion, desire, the `hoards` belief, grudges at 3 and 5, and the theft-hook pressure;
- relief by lending, and decay;
- a commanded PC refusing by Command who feels guilt, with no loan;
- the two epilogue lines, each told once.

Fairness and agency stay green: `fae-charms` and the 64-seed agency test pass. The rota test now expects attachment to ease while the sack is lent, instead of staying at 90.

**Files:**
- New: `packages/core/src/fae/refusal.ts` and `packages/cli/test/fae-refusal.test.ts`.
- Edited (fae): `fae/{state,events,api,urges,witness,arc}.ts`.
- Edited (other modules): `social/{interact,requests,objects,opinion}.ts`; `chronicle/{facts.ts,patterns/charm.ts,patterns/types.ts}` (`PatternDef.entryKeys?`); `content/src/schema/chronicle.ts` (slots `asker`, `asker_short`); `play/src/describe.ts`.
- Content: `content/base/beliefs/charms.toml` (`hoards`) and `content/base/chronicle/patterns-charm.toml` (two epilogue templates).
- Also: `scripts/fae1b-batch.ts` (metrics), `docs/impl/MODULES.md`, the fae-charms rota test, and the template-coverage test in `chronicle.test.ts`, which now accepts pattern `entryKeys`. The golden snapshot is unchanged: Iron Ford has no charm.

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

## Remaining issues (after the merge and rulings)

- **Spread stays low** (level 2 in 3–5% of seeds, level 3 in 2–3%). The Fenns are discreet, and fed on credit they now keep the sack to themselves.
- **Year-long rota (criterion 9).** Attachment at its cap outweighs neighbors' begs until a rota exists; this is a design call (see "Rota").
- **Iron in ordinary pantries suppresses the sack** (tin plate, a coffee mill, an iron-fitted provisions box). That's the doc 03 rule applied to content data.
- **Gen-town finds are rare.**
- **Perf numbers come from a busy shared machine.**
- **From main, not touched:** Dunleavy's Tavern's store is owned by Whitcomb's Survey Party. Owner resolution takes the first household whose home is the tavern, and the survey party lodges there.

## Contracts, out-of-area edits, remaining issues, files

**Added in the merge pass** (additive):
- **Social:** `requestTerms(…, item?)` item phrasing.
- **Play:**
  - `requestLabel` gained the item cases;
  - `Obligation.kind 'thing'` with `thing?`;
  - `Claim.thing?`, `dueT?`, `overdue?`;
  - `claimsOf(world, pc, content?)`.
- **Provisions:** scenario `stocks[].keeper`.
- **Chronicle:** `when.stage = still` and `ChronicleState.charmMemo?`.

**Out-of-area edits in the merge pass:**
- `packages/content/src/schema/items.ts` (stocks keeper);
- `packages/core/src/provisions/{state,view}.ts`;
- `packages/core/src/social/requests.ts`;
- `packages/core/src/chronicle/state.ts`;
- `packages/play/src/{obligations,observation,session,actions,text}.ts`;
- `packages/cli/test/worldgen.test.ts`;
- `content/base/scenarios/iron_ford/50-stocks.toml`.

See the summary above; every contract is listed in `docs/impl/MODULES.md` under module:fae, slice 1b.

**Fae files:**
- New in `packages/core/src/fae/`: `charms`, `draws`, `hem`, `tend`, `found`, `desire`, `witness`, `discovery`, `arc`, `urges`, `actions`, `culpability`, `forecast`.
- Edited in `packages/core/src/fae/`: `state`, `view`, `events`, `commands`, `system`, `api`, `investigate`.
- `packages/content/src/schema/fae.ts`.
- `content/base/{fae/charms,fae/quirks,items/fae,beliefs/charms,activities/charms,interactions/fae,social/talk-charms,scenarios/charm_at_iron_ford,chronicle/patterns-charm}.toml`.
- Tests: `packages/cli/test/{fae-charms,fae-signs-r2}.test.ts` (new), with edits to `fae.test.ts` and `chronicle.test.ts` and the snapshot.
- `scripts/fae1b-batch.ts`.
