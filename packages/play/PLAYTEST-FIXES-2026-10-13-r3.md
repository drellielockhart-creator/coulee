# Wave 10 E: headless play and UX

Source: `docs/impl/PLAYTEST-TRIAGE-2026-10-13-r3.md`, group E. Repro sequences come from the Socialite gen:town 7, Explorer iron_ford_neighbors 42 and Greenhorn iron_ford 42 reports, transcripts and session `commands.jsonl` files. No group E items are deferred.

| Item | Result | Regression tests |
|---|---|---|
| E1 | Session dialogue contains only exchanges produced by the current command; saved/forked snapshots retain it. CLI and worker use the same list. | `Socialite introduce/ask/go/introduce/chat shows only this command’s new exchanges`; web `Socialite short chat chains replace the web dialogue with the newest command’s lines` |
| E2 | Data costs: hire 10, quit 5, drink 2, refill 3, wake 1, fetch 3 plus the loaded walk, in minutes. Short executor refusals restore the previous state and spend nothing. Road drinks use the remaining walking budget in both execution and forecast. | `Greenhorn go Pratt/hire/quit uses authored minutes; a refused hire spends nothing`; `drink/fill/fetch water chain without consuming the hour or moving NPCs`; `sleep/wake spends the wake cost and unlocks the bed`; `a road drink takes two minutes and the route forecast respects the remaining walking budget` |
| E3 | “Spring has come to X.” identifies the season. | `r3 E3 season prose cannot be read as a water spring` |
| E4 | Cedar Farm has a well. Missing sources refuse immediately. Route water checks name destination sources or warn that none are recorded. Critical forecasts require `travel <destination> confirm`; the web route card requires a second click. | `Explorer travel/go fields/fetch water reaches the Cedar Farm well`; `no-source fixture warns in the preview and refuses fetch water without time or state changes`; `critical vitals require explicit travel confirmation, and road route projects only what remains`; `an overloaded traveler can read a road route refusal without spending time`; web `critical travel needs two clicks on the same preview; ordinary Go does not preconfirm a changed forecast` |
| E5 | Walk labels include load; internal collapse and destination-free walk activities disappear. Attend church is on the first menu; text and stable-id requests explain a locked service consistently. | `loaded go menu minutes match arrival; collapse and destination-free walks are absent`; `Attend church is in the first menu and repeated stable/text orders explain its lock` |
| E6 | An early wait stop always includes its cause, time and intended target, even when the digest contains the same cause. The CLI session already reported the cited stops; suppression in the shared renderer is removed. | `r3 E6 wait until 07:00/tomorrow always explains an early stop` |
| E7 | Journal entries sort by time/id. Severe-need prose describes the condition without inventing bedtime. Almanac, conversations and fae weather text use the world's fixed-weather override. | `r3 E7 journal is chronological and fixed weather agrees with almanac and social text` |
| E8 | Faded signs say so; road routes preview the current journey; places includes regional destinations; same goods sell across multiple stacks; compatibility arrows share one catalog listing; counter goods can be inspected before buying; satisfied thirst and daytime status suppress stale drink/night duty hints. | `r3 E8 small usability` (five tests), plus the E4 road-route test |

Tests live in `packages/cli/test/play-ux-r3.test.ts`, `apps/web/src/dialogue-r3.integration.test.ts`, and `apps/web/src/components/RouteCard-confirm.test.tsx`. The existing road Appetite regression was updated because its previous assertion required a drink thought at Thirst 900. The Greenhorn income/replay integration now explicitly waits until 08:00 before its eight-hour shift; short hiring no longer advances the clock to that hour implicitly.

The core already merges interchangeable stacks. Cross-stack sales preserve distinct wetness, condition and preparation state; a private preflight makes the sale atomic. Catalog aliases preserve authored physical stocks and existing compatibility item ids, avoiding event-id shifts in the ordinary simulation.

## Validation

`VITEST_MAX_WORKERS=2 just check` passed: 91 test files, 965 tests; Biome, all package/script typechecks, invariants (260 files), and content validation (115 files) are green. Fresh FAIR transcript: `runs/scratch/w10-ux-fair-final`, 22 commands verified, final hash `71eb2ff3a00e0642`. The full gate verified the golden chronicle unchanged; no snapshot was rewritten. The season sentence is place-description text and does not occur in this golden. The journal wording correction likewise does not alter its entries.

## Files touched

- `apps/web/src/components/PlayPanel.tsx`
- `apps/web/src/components/RouteCard-confirm.test.tsx`
- `apps/web/src/components/RouteCard.tsx`
- `apps/web/src/dialogue-r3.integration.test.ts`
- `content/base/activities/activities.toml`
- `content/base/activities/play.toml`
- `content/base/chronicle/singles-journal.toml`
- `content/base/items/ammunition.toml`
- `content/base/places/cedar_farm.toml`
- `content/base/play-time/town.toml`
- `packages/cli/test/income.test.ts`
- `packages/cli/test/play-ux-r3.test.ts`
- `packages/cli/test/region-travel.test.ts`
- `packages/content/src/schema/items.ts`
- `packages/content/src/schema/needs-activities.ts`
- `packages/core/src/activity/travel.ts`
- `packages/core/src/chronicle/digest.ts`
- `packages/core/src/chronicle/system.ts`
- `packages/core/src/chronicle/weather.ts`
- `packages/core/src/fae/conditions.ts`
- `packages/core/src/fae/view.ts`
- `packages/core/src/provisions/api.ts`
- `packages/core/src/provisions/commands.ts`
- `packages/core/src/provisions/system.ts`
- `packages/core/src/provisions/trip.ts`
- `packages/core/src/social/talk.ts`
- `packages/play/PLAYTEST-FIXES-2026-10-13-r3.md`
- `packages/play/src/actions.ts`
- `packages/play/src/host.ts`
- `packages/play/src/minutes.ts`
- `packages/play/src/observation.ts`
- `packages/play/src/route.ts`
- `packages/play/src/session.ts`
- `packages/play/src/text.ts`
