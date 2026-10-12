# Survival consequences — wave 3

Implemented on `wave3/survival`; no commit. Fair session transcripts and command logs originate from one CLI action per call. No save editing or god mode was used for these sessions. The accelerated cold, rescue, bereavement and orphan fixtures are integration tests, not fair play claims.

## Acceptance

1. **MET:** content-defined starvation, dehydration, cold, heat and exhaustion thresholds; keyed Fortitude saves; Vigor loss, cumulative Wounds, collapse, death and cause-specific recovery. The existing thermal ledger supplies clothing, wetness, wind, shelter, fire and temperature. Health and conditional collapse forecasts appear in fair observations and `plan`. Heat has a tested threshold, but the existing monthly weather normals do not generate exceptional heat waves.
2. **MET:** ordinary actor aid, social willingness (neighborliness, affection, kin and anxiety), real water/food consumption, carrying to a stocked home or water, and care triage. A hungry actor can ask an acquaintance for help before collapsing. A commanded actor uses `needs.aid`; the same core incapacitation gates apply to everyone.
3. **MET:** persistent body/place, discovery before public bereavement, household head succession, adoption by adult kin when a household lacks adults, household/kin estate transfer, historical widowhood, grief memories/opinion reasons/thoughts/anxiety feeding the existing defenses, church burial/attendance, and ordinary/uncanny misfortune attribution. Unfound bodies remain unknown to family and the paper. Graves remain at the funeral place.
4. **MET:** death closes play, reveals the life chronicle and omniscient epilogue, and refuses further time/action while permitting reading. Saveable per-actor ending records support later legacy work. `retire` and `depart` are deliberately simple ending Commands, not a complete legacy continuation system.
5. **MET:** Tobias Vik and Ezra Sloat are confined at Lantern Spring, whose `fae_time` flag freezes their needs. The occupation confinement flag is also required: a free visitor at the court is not protected. Explain: “Time runs otherwise under the hill.”
6. **MET for the tested seeds:** four deaths among 144 initial actors across five one-year simulations. All occurred in impoverished households in winter or early March; no town-wide die-off. An unprotected actor can die of cold within 72 hours in the actual January thermal model. Unassisted thirst is fatal in fair play within days.

## Evidence

Fair authored session: `runs/w3-final-hills` (Iron Ford, seed 42). Ellis disables automatic drinking and return to lodgings, walks to Upper Lantern Coulee, and waits. The Kit Sheet warns of collapse; failed saves spend Vigor, collapse removes action affordances, and later saves cause fatal Wounds. Ellis collapses at hour 39 and dies at hour 55. The final 17-command log replays to hash `0414e721eeb5ce53`; a subsequent wait is refused without advancing time. Observations recorded:

> You may collapse from thirst in about 4 hours if this continues (Fortitude saves vary).

> Collapsed from thirst; needs help.

> Ellis Wayfarer's account ends here. Death came by thirst; the coulee kept its own time.

Fair generated session: `runs/w3-generated` (`gen:town`, seed 7). `retire` produced:

> This life has ended: retire — A quiet retirement. Only reading remains.

The generated session replays to hash `5705284415fb4c00`. An attempted subsequent wait returned “This life has ended; only reading remains. No game time spent.”

Generated seed 73's annual chronicle supplies an actual obituary:

> DIED.—Bartolomeus Vik, from starvation. An empty chair remains among the living; neighbors are asked to remember the household in its affliction.

The church funeral was attended by one neighbor. His mother Marta died ten days later of thirst; her body remained undiscovered. In seed 7, Marta and Agnes Vik died of thirst on March 13; their bodies remained undiscovered. These outcomes come from the household simulation, not scripted mortality.

## Year runs

Each command used `just run run --scenario <source> --seed <seed> --years 1 --no-events --save --out runs/w3-balance-reviewed/<name>`. Retained death state supplies causes independently of the bounded event log. `deaths.csv` records the results; `monthly.csv` samples needs, cash, kcal and population every 30 days. `headlines.json` records the five most frequent chronicle headings per run.

| Source | Seed | Population | Thirst | Starvation | Cold / heat / exhaustion |
|---|---:|---:|---:|---:|---:|
| Iron Ford | 42 | 40 | 0 | 0 | 0 |
| Generated | 7 | 24 | 2 | 0 | 0 |
| Generated | 19 | 27 | 0 | 0 | 0 |
| Generated | 73 | 23 | 1 | 1 | 0 |
| Generated | 101 | 30 | 0 | 0 | 0 |

Initial generated-town mortality exposed two implementation errors: recovery incorrectly required every need to be satisfied, and an ambulatory hungry relative could monopolize the only caregiver ahead of an unconscious thirsty patient. Regression tests cover cause-specific Vigor recovery and triage. A final seed-7 rerun (`gen-7-current`) exactly reproduced the reviewed year's hash, `ad5ea50963254bcb`.

## Contracts and ownership

Additive content domains: `survival_rules`, `survival_tuning`. Optional `ActorNeeds.survival` stores harm by cause, timers, Vigor, Wounds, incapacity, death/discovery/burial and endings. New `needs.*` Commands and events use the existing central unions. Needs views add optional health and warnings; observations add ending, epilogue and local remains. Relationships add optional historical death/end fields.

Out-of-area integration: activity API for care/gathering movement and a shared incapacity gate; per-system core Command admission; provisions API adapters for real assisted intake, care destination and estate settlement, plus action gates (no planner/meal/economy restructuring); social availability/participation/widowhood gates; psyche autonomy delegates to shared capacity; content schema/domain registration and chronicle slots; Lantern Spring flags/Ezra's scenario location; integration tests and the deliberately updated golden chronicle. The golden change reflects the captive stasis/location correction and resulting event/chronicle stream.

## Limits

This is hourly survival, not anatomical combat Wounds or a tactical carrying/ambulance model. Funeral/care movement uses the existing within-site abstraction. Worn equipment augments the existing ordinary-seasonal-dress baseline. Heat uses the current weather hook; no new weather generator is included. Retire/depart record an ending and epilogue; playable descendants remain future work. No packages were installed and no commit was made.

## Validation

`just check` passed: 53 test files, 512 tests; formatting, all package/script typechecks, 161-file invariant scan and 82-file content validation. The nine new survival integration tests all pass. The existing 60-day belief fixture now allows 120 seconds under full-suite concurrency; no assertion was weakened. See `check.txt` for the gate output.

Both fair sessions replay exactly. `iron-ford-42.commands.jsonl` / `iron-ford-42.transcript.txt` and `generated-7.commands.jsonl` / `generated-7.transcript.txt` preserve their commands and observations. `files-changed.txt` lists every changed file. `git diff --check` is clean. No commit was made.
