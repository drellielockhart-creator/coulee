# Newcomer headless playtest — Iron Ford, seed 42

Mode: **FAIR** throughout. Persona: Greenhorn / catalog shopper. Source: authored `iron_ford`; default newcomer kit and tavern lodging. Commands and deterministic telemetry are attached. The text transport was exercised through piped stdin, without a browser or sockets. The final run reached **1855-04-06 18:00** (138 game hours).

## What happened

Arrived with $50 and a 6.8-day traveling pack. Went to Pratt & Daughter, bought twelve units of hardtack and six dried apples, tried speaking to Augusta, and returned to Dunleavy's. Alternated meals, water hauling/drinking, sleep, and interruptible waits. Ended with **$47.39**, **9.5 projected days of food**, hunger **882**, thirst **832**, and rest **1000**. The pack started Medium at 33.4 kg, became Heavy at 41.5 kg after shopping, and ended Medium at 36.1 kg.

The most useful catalog moment was the immediate tradeoff: “Food 17.4 days; Heavy, 41.5 kg.” The preparation menu distinguishes raw hardtack from soaking, and `plan` names what spoils first and lists the actual kit. Two servings of hardtack produced “Meal: 1100 kcal (cold)” with an accessible Explain event.

## Confusion found and fixed

- The interaction catalog calls greeting **introduce**, not greet. The abbreviated action menu now offers the catalog's actual introduction command.
- An explicit conversation initially let the activity schedule put the speaker to sleep before social could resolve it. Activity now keeps commanded conversations at their venue; this applies to any actor supplying the same Command.
- Movement used to display “at home, at leisure” at every destination. `go` now uses a normal data-driven walk activity.
- The first exploratory script ate one serving per meal and eventually became Starving despite having food in the pack. Help now explicitly says one serving is the default; text accepts `eat hardtack 2`. A second full playthrough maintained hunger and thirst.
- The original Kit Sheet printed a large JSON object. Its text rendering is now a short readiness summary plus one line per carried stack.
- Busy gatherings made the “Here” line too long. It now lists six people plus the remaining count; the complete fair observation and inspect/action catalog remain available.

## Remaining limitations / balance

- Social is still stubbed: “Intention recorded; social has not resolved an interaction (module may still be stubbed).” No friendship or conversation outcome was fabricated. This run did **not** produce a social story worth retelling, and the fair journal remained empty. These are explicit integration gaps for the social/chronicle owners.
- The newcomer is a normal household head. Shared household shopping bought cornmeal automatically on the first store visit, spending $1.05. The purchase is now legible in the event text, but automatic shopping may deserve a standing-order UI.
- Taverns charge no lodging fee yet, and a newcomer household gets the existing domestic water/fuel routines. Current jobs use the occupation's wage rules rather than negotiated odd-job contracts.
- All actions occupy whole hours; activity recovery uses the previous hour's activity. Sleep locks its minimum duration. This needs a visible duration/lock indicator when the web adopts PlaySession.
- Interrupts successfully stopped waits at arrivals and worsening vital bands. Long safe periods can be quiet; the unresolved social/psyche systems amplify that quiet.
- No economic profit loop was found in the implemented sale path: intact goods sell at base value capped at retail, and the store must fund the transaction. The automated conservation test checks cash transfer.
- The core does not currently implement starvation death. The survival tests check hunger/thirst as well as alive status so that a permanently true flag cannot pass on its own.

## Knowledge audit

Fair output uses a stricter projection than the existing whole-world view. It removes remote actors, other actors' minds/traits, unknown global Figures, omniscient explanations, failed concealed-tell notice labels, and independent private journals. These gaps were found in the underlying combined/social/belief/chronicle views and are documented in `packages/play/README.md` for their owners. God mode is explicit. Designer metrics contain ground-truth diagnostic data and are not part of the fair observation.

## Reproduction

```
just run play --replay playtests/2026-10-11-greenhorn-42/commands.jsonl
just run play --text --scenario iron_ford --seed 42 --log runs/new-visit
```

The attached replay validates the world hash at every command boundary, including queries and interrupted waits. The integration suite separately runs seven-day survival scripts for `iron_ford` seed 42 and `gen:town` seed 7.

## Validation

`VITEST_MAX_WORKERS=2 just check` passed: 28 test files, 249 tests, all package/script typechecks, invariant enforcement (114 core files), and content validation (66 files). The cap limits concurrency only; no checks are skipped. The attached text-run replay completed successfully. No commits were made.
