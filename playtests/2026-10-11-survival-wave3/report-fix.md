# Survival and play loop: review fixes (wave 4)

Codex gpt-6-astra built this on `wave4/survival-fix`. Codex ran out of usage quota during its final gate. The orchestrator (Claude) assembled this report from the job's progress notes, then re-ran the `gen:town` 73 year and the full gate itself.

## Findings (runs/review-w3-survival and runs/smoke-notes.md)

| # | Item | Status | Evidence |
|---|---|---|---|
| S1 | Aid refused food that needs cooking | FIXED | An authorized caregiver now prepares through timed preparation and reserves the patient's plate. The aid repro makes a timed beans preparation with a reserved 750-kcal plate.<br>The annual audit found two follow-on bugs, both fixed:<br>• helpers spent hours tending an empty pantry;<br>• a household whose members had all collapsed got no visit.<br>Care that can't provide intake or shelter now stops, and nearby relatives and acquaintances make daytime check-ins.<br>A seed-7 winter trace found the generic care action overwrote the cook's reservation, and care served the household's half ration during hunger debt. The reservation now holds until serving, and a content rule gives full emergency portions. All food, fuel, water and time are still charged. |
| S2 | Store succession erased tabs; debts stayed on the deceased | FIXED | Claims and liabilities move to an estate with a living representative before the shop changes hands. Inherited debts keep their original dates. The additive `social/api.ts` hook lets provisions transfer both sides of a debt; inheritance is a content rule. |
| S3 | Collapsed NPCs still shopped | FIXED | `canAct` is checked in shopper selection and the purchase executor; another able member shops instead. |
| S4 | Aid ignored the helper's supplies at a shared lodging | FIXED | The supplying household is chosen by available resources. Repro: the patient now gets 1,000 ml from the helper's supply. |
| S5 | Long walks arrived a step late | FIXED | Boundary tests: a 60-minute trip takes one step, a 114-minute trip two. |
| S6 | "A Timely Kindness" narrated ordinary favors as food relief | FIXED | Food-relief claims need a food transfer or assisted-intake event. Other help gets generic prose, aggregated weekly. Single-event "A Neighborly Act" stories also go through the aggregate. Iron Ford 42: 7 kindness headlines in 90 days (was 18) and 26 in a year; no "A Timely Kindness" in 90 days. |
| S7 | Year balance, cash and rest | DONE | Table below.<br>• Cash: Iron Ford county cash fell by exactly 42,090 cents, the freight ledger's total, with a zero conservation residual. That is the intended freight sink; personal purses also absorb transfers.<br>• Rest: there is recurring fatigue, but the midnight mean overstates it; see the monthly tired/exhausted percentages in the audit. |
| P1 | Waits stopped on bands the standing orders handle | FIXED | Manageable bands no longer pause a wait. This lives in the shared interrupt policy, so the web auto-pause gets it too. |
| P2 | Camped instead of using a paid bed nearby | FIXED | Nearby paid lodging takes precedence over camping. This needed a small edit to psyche's standing-order selection, which is out of area. |
| P3/P4 | "walking about" after arrival; thoughts while asleep; fire-minding thought with no fire | FIXED | The fire thought appears only with a live local fire (regression test). |
| P5 | Vitals labels and the repeated Kit warning | FIXED | See the play-polish tests. |

## Year runs after the fixes (deaths)

| World | Before (review) | After |
|---|---|---|
| Iron Ford 42 | 0 | 0 (40 alive) |
| gen:town 7 | 2 (Marta and Agnes Vik, starvation, March 1856) | 1. Agnes Vik, age 3, died of starvation on 17 March 1856 at Freeman Lower Slope Farm. Her household had no food and no cash, and four able Freeman/Rausch helpers were present. |
| gen:town 73 | 5 (3 starvation, 2 thirst) | 0 (23 alive; hungry winter nights for the Viks, Dades and Nances; orchestrator run, hash `bda38fb80620c5ee`) |

All three runs total one death among 87 actors (about 1.1%), inside the M4 band (under 2%). **Agnes Vik's death is still a defect:** a household with nothing gets no neighbor relief, though better-off neighbors are present. Next fix: charity or relief for a zero-food household (doc 04 club relief / M4 acceptance 3).

## Fair play
Both fair CLI sessions showed collapse and rescue and replay successfully (20 commands on Iron Ford 42, 23 on gen:town 73):
- "Nora Dunleavy helps you (1000 ml of water)"
- "Heinrich Strauss helps you (1000 ml of water)"

## Test harness
The CLI smoke test captures subprocess stdout through a file, because sandboxed pipes return EPERM. Its assertions are unchanged.
