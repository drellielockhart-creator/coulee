# Fae slice 1a implementation and validation

Status: **PARTIAL; not a claim that all of doc 13 §8.1 is complete.** No commits. Baseline `589a3894618aeb841ea73a5bcc01181c70a82be2`, branch `wave3/fae1a`.

Implemented: fae state, fixed schedule slot, canonical-time RNG, effective FI, protected-site exclusion, six omen families, deterministic episode/lead/observer caches, witnessed memory/thought/belief consumers, Signs & Wonders and investigation Commands, layered place descriptions, generated terrain hooks, Journal/Almanac/Paper consumers, and the psyche authorization API with issuer-bearing Commands and queued loan requests. Charms, workings and Tally are absent as requested.

## Acceptance audit (doc 13 §8.1)

| Criterion | Status | Evidence / limit |
|---|---|---|
| 1. Gate + golden reason | MET | `VITEST_MAX_WORKERS=1 just check`: 53 files / 516 tests pass, typechecks/lint/invariants/content pass. See `check.log`. Golden rationale below. |
| 2. Determinism | PARTIAL | Tests cover canonical snapshot eager/deferred resolution, table insertion order, cached notices, save/load/fork hashes and integers. Actual staggered arrival orders are not exhaustively tested. Fair seed-42 and generated-7 replay verified. |
| 3. Iron Ford 42 | NOT MET | Required route reaches Cold Stair at 18:00 day 2, but notices one omen, a lookalike, rather than three. Ice-only eligibility is tested; fair explanations hide the omniscient truth child. |
| 4. Descriptions | PARTIAL | Stable base, three baseline layers, adjacent place names, signature differences at Lore 0/4, pure view hash tested. Weather/light and activity/trace description layers are incomplete. |
| 5. Investigation | PARTIAL | Three actors share one frozen lead; each has a cached attempt; repeat/ineligible attempts cost nothing. Read and physical trace evidence can close questions. Testimony/recurrence-driven closure is incomplete. |
| 6. Rumor | MET | Final-code day-4 run: Karl Brenner 43, Johann Brenner 45, Gussie Pratt 95, Lemuel Hatch 41, each with a non-self evidence source. See `day4-rumor.json`. |
| 7. Ablations | MET | Tests: no witnesses means no thinning/belief change; bell-range removal restores rates; FI 0 admits Providence lookalikes only. |
| 8. Agency | MET | 64 seeds × 720 hours: zero commanded-PC social initiations, purchases or outgoing cash transfers; all worlds integral. See `agency-soak.json`. Run predates final asleep-notice filtering and prose-only fixes; authorization/executor logic is unchanged. Final tests additionally force an omen on the PC across 64 seeds. |
| 9. Protected sites | MET | `protected + spring`, `mound`, `fae_barrow + mound` fixtures produce no fae output. Schema rejects protected places with positive FI/fae roles. |
| 10. Spam | PARTIAL | Final regression simulates 365 days of chronicle cleanup: 53 almanac and 53 paper entries, templates <=10%. Earlier full-year audit bounded omen events below 0.60% of the log, but revealed the old weekly-counter bug. Dedicated cap state fixes that bug; full year was not rerun after the fix. |
| 11. Fresh seeds | PARTIAL | Fair first-dusk sessions in gen:town 1–10 are archived. Five saw sandstone-face episodes; seed 3 found a destination, seed 7 a trace. The 7-of-8 within-eight-days gate is not established. |
| 12. Performance | PARTIAL | Earlier year: fae 0.186 ms/game-hour, total 35.4 ms/hour, save 6,065,161 bytes. No pinned baseline delta or generated-year matrix; no performance optimization attempted. |

**Golden reason:** witnessed omen beliefs/thoughts/rumors, corrected place tags, and capped/varied omen prose legitimately change the Iron Ford 42 chronicle; the snapshot was deliberately regenerated.

## Fair play

Reports and command/telemetry logs: `sessions/ironford-42/` (Iron Ford) and `sessions/gen-1/` through `sessions/gen-10/` (generated towns). Every call issued one command or query. No hidden-state inspection, save editing, god mode or replay fishing was used during play. Each default newcomer slept, used the public places menu, disabled lodging travel and walked uphill for dusk.

Generated 7:

> Under the hazels, three low lights turn together.

> These lights hold their distance like guests waiting to be invited.

> You examine the residue: These lights hold their distance like guests waiting to be invited.

Repeating investigation: “You have already tested this sign. Returning cannot change the evidence.” No game time spent. Journal: “At East sandstone face: Under the hazels, three low lights turn together. I would like to know what made it.” Eleven Commands replayed to `e796460697afb6d3`.

Generated 3:

> The trace runs toward East limestone cap. Return there at dusk; the timing matters.

This was a **lookalike**, identified as marsh gas; it is not counted as proof of a real fae sign. Iron Ford 42 replayed 19 Commands to `169c2221a7bce357`.

The Explorer desire-to-follow and unaided Greenhorn criteria need actual user observation; these agent-run smoke sessions do not establish them. Exploit checks cover repetition, three-actor rotation and deterministic replay.

## Exact agency isolation

Both before/after runs use Iron Ford 42 for 336 hours, fae disabled, original authored place definitions overlaid to isolate the agency refactor from intentional place/content changes. The complete event-kind count map, provisions state and social state compare byte-identically. Final implementation was rechecked against the original captured baseline.

- Events: **36,465** in both.
- Social interactions **2,492**, memory-formed events **25**, label changes **33**.
- Actor purses **24,270 cents**, household cash **45,172 cents**, store tills **0**.
- Entire captured-result SHA-256: `c4a3c9fea18b856eb03b40b17f842de9f157b45745466f7acabb47aefabf6fdd`.
- Compact proof: `agency-equivalence.json`; original comparison artifacts/scripts remain in `runs/scratch/agency-{before,after,isolated}*`.

## Year audit provenance

`year-manifest-before-prose-fix.json` is explicitly an **earlier implementation** run, before final notice/prose fixes, not a current-build benchmark. It ran 8,760 hours and produced 1,001,535 events. Fae raw state occupied 90,244 bytes. Recomputing every unthrottled window gave at most 5,971 candidate episodes (0.5962% of events), an upper bound rather than an exact streamed count. The run intentionally used `--no-events`.

The old run produced 351 omen almanac and 221 omen paper entries, exposing the timestamp-cleanup/cap bug. Final cap regression exercises cleanup explicitly and passes. Monthly stats are preserved in `monthly-before-prose-fix.json`: all 40 actors survive; month-end hunger ranges 654–808, rest 376–588, warmth 949–1000. This is observation, not a balance certification.

## Additive contracts

- `World.fae`; ModuleId/RNG stream `fae`; schedule slot after activity; fae events and Commands in central unions.
- `ctx.rngAt(stream, canonicalTime, key)` (optional in context interfaces for fixture compatibility; real contexts supply it).
- `Command.issuer?`; `psyche.authorizeAct`, `agencyOf`, `setAgency`, `authorizationExplain`, `commandBasis`, agency types. Existing `autonomous` export retained for compatibility; call sites refactored.
- Optional psyche agency state and social pending requests; `social.answer_request`; public pending-request view.
- `fae.effectiveFi`, `isProtectedSite`, `describe`, `signs`, `investigate`, `investigationEligibility`, `episodesAt`.
- Optional place description and bell range; new omen/standing-capability content domains; omen memory kind and belief predicates; chronicle cap/count fields and omen/edition bindings.

## Remaining implementation gaps

These are substantive reasons this branch is partial:

- Notice does not yet implement Drift/Second Sight/Seam/Deep Sense or full light/weather modifiers. Reads lack the complete trained-skill and competing natural/portent attribution rules.
- Episode weighting omits full fog/thunder/first-snow and physical iron-presence rules, family weighting and the seven-day text-variant cooldown. Iron currently uses place tags.
- `belief/tells.ts` still reads base FI; effective FI is centralized for new fae paths but not yet adopted by that existing consumer.
- Mundane reading text currently draws independently of surface text; seed 9 exposed tools being explained as straw. Content pairs need reconciliation.
- Leads have a stable destination, but the dusk instruction is currently prose; investigation eligibility does not enforce a distinct follow-up time condition.
- Late witnesses receive their reading but may miss a Journal entry if the shared omen event was emitted for earlier witnesses.
- Standing defaults are represented in content, but the authorization helper retains legacy boolean mapping; arbitrary bounded capabilities (e.g. weekly spending limits) are not implemented. Refusals are not uniformly emitted as Explain events by every executor.
- Protected geometry is recognized by the helper, but a full fictional-European-barrow schema/geometry separation is not implemented.
- Bell/iron/debunking thinning effects beyond witnessed Ice and daily decay, and some downstream attribution/ward consumers, remain incomplete.

## Ownership and files

Explicitly requested agency changes span psyche, social and provisions. Necessary additive shared edits include foundation composition/unions/context, content registry and schema enums, belief predicate/social-memory data, chronicle state/templates, and integration tests/golden. Outside the named implementation areas: `docs/impl/MODULES.md` adds ownership documentation, and `playtests/` holds these required reports. No edits to sibling worktrees, web presentation, charms, workings, survival or optimization code.

The complete changed-file inventory is `files-changed.txt`.

Additional generated-session replays: seed 1 `89cb822c16b55498`, seed 3 `87e1e05e81ff5c26`, seed 8 `494e756f23bd7e9a`, seed 10 `74ceb24b3db286b1` (10 Commands each).

Final repository gate: `VITEST_MAX_WORKERS=1 just check` passed (53 test files, 516 tests; Vitest 1020.29 seconds). The long serial run completed successfully; redundant diagnostic runs were stopped after its result arrived. No runtime changes followed the gate.
