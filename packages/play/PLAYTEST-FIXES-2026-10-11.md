# Agency and play-loop fixes — pf/agency

All six assigned finding groups are addressed. No commits made.

## Before / after evidence

- Agency / money: replayed the greenhorn's original command log against archived build `ca48292`. At 07:00 the $7.82 loss was household auto-shopping at the tavern: 12 bread heels ($0.12), 20 eggs ($0.20), 25 whiskey quarts ($7.50). The observer formerly showed only the subsequent meal. In the new fair Iron Ford seed-42 session, `wait until 06:00` reports “Since last look: 6h passed” and “Purse $50.00; household $0.00”; `wait 1h` retains those balances. Commanded actors cannot initiate that shopping.
- Waits: original “wait until 06:00 stops on social.interaction about every 1–2 hours”; both new fair sessions reach dawn in one call. Iron Ford's following hour reports “Skipped 4 minor conversations nearby.” Needs deterioration, personal encounters and witnessed hostility still interrupt.
- Social feasibility: original “The other person may have left” after spending an hour; new generated-town `court Jory` reports “Jory Rowe is asleep” at 06:00 with no time or hash change. Core regression verifies one Court interaction and no substitute Mock. Commands reserve their conversational partner before movement.
- Ledger: new explicit Iron Ford purchase reports “Money: purse −$0.24, household +$0.00 — Bought 3 hardtack for $0.24.” A sale reports +$0.08; explicit lodging reports −$0.25 with “Tavern bed.” Generated-town flour purchase reports −$0.10. Every money event is captured independently of log retention.
- Inspection: original bare JSON/opinion reasons that did not add up; new `inspect Lydia` reports “affection: 3 = base 2 + reasons 1 + immediate 0,” a Neutral label, the weighted reason and the remembered introduction. Hardtack inspection reports weight/bulk, per-pound nutrition, remaining servings and preparations. Place descriptions, grouped stock prices and paged destinations are visible.
- Robustness: `-1` now exits 2 with “No such menu number”; invalid waits and nonpositive quantities also reject without time. Session help excludes unsupported REPL host verbs. Compact mode omits unchanged lines.

## Verification artifacts

- `runs/pf-evidence/baseline-hash.txt` and `baseline-comparison.txt`: the identical before/after 14-day all-NPC hash is **5f1a10e46bfde2ce**. The test pins the integrated content baseline; economy/content changes in another group will legitimately require reviewing that golden value.
- `packages/cli/test/play-agency.test.ts`: 14-day commanded simulation, no autonomous purchases/social initiations/purse transfers, P2 NPC command parity, standing-order control, Court identity, unsolicited lending protection, strict grammar, zero-time social refusal, money persistence/replay, and interrupt relevance.
- `runs/pf-evidence/historical-money.txt`: exact archived-build transactions accounting for $7.82. Historical code was extracted only into ignored `runs/scratch/before`; the working source was never reverted.
- Fair session directories: `runs/pf-iron-reviewed` (Iron Ford, seed 42), `runs/pf-gen-reviewed` (generated town, seed 7). Each shell call submits one command. Original dawn/wait, shopping, introduction and inspection commands were reused where meaningful; old event/stack/place ids are not replay-compatible with the integrated content.
- `runs/pf-evidence/gate-final.log`: **just check passed**, 481 tests / 50 files, plus lint, all typechecks, invariants and content validation. Fresh reviewed sessions were played after this gate. `iron-reviewed-verify.txt` / `gen-reviewed-verify.txt`: final session verification.

## Additive contracts and merge notes

- Psyche: optional `ActorPsyche.agencyMode` / `standingOrders`; absent agency remains `psyche` without adding serialized NPC fields. `AgencyMode`, `StandingOrders`, `DEFAULT_STANDING_ORDERS`, `agencyMode`, `autonomous`, `standingOrders` exports. Scenario schema adds optional `agency_mode` / `standing_orders`; PCSpec adds optional camel-case equivalents and defaults new PCs to commanded.
- Command: `core.standing_orders` with `{agencyMode?, orders: {sleep, eat, drink, warmth, lodging, activities}}`. No branching on controller. Thoughts, anxiety and their explanations remain active.
- Social API: `interactionAvailability(world, content, actorId, targetId, interactionId)` returns `{ok, reason?}`. Menus and command validation share it. Explicit commands resolve first; fallback rollback prevents an unresolved social action charging time.
- Play observation adds descriptions, known people, interaction verbs, agency/standing orders, household cash and `changes`. Save data adds money entries and last observation changes; CLI menu data adds compact preference and previous presentation. Existing fields remain.
- CLI: `--compact`; `prices`, `places [page]`, `agency`, `standing`, named wait boundaries; negative numbers handled before CAC flag parsing.

Unavoidable edits outside the strict area: `packages/content/src/schema/psyche.ts` (scenario data); `packages/cli/src/main.ts` (flag/numeric parsing); `packages/core/src/activity/system.ts` (reserve conversation target); `packages/core/src/social/{system,interact,strife,volition}.ts` (command priority and agency guards for encounters, displacement, retaliation, mediation and incoming loan requests); `packages/core/src/provisions/{api,services,system}.ts` (standing hydration/meals, own pack, prevent uncommanded paid board). The assigned household-shopping guard is in `provisions/economy.ts`. These edits deliberately avoid economy formulas, interaction content and dialogue. Authored place descriptions already existed, so no content/place schema edits were needed.

Remaining scope boundaries: hourly clock granularity, camping, economy balancing, dialogue content and fae systems belong to the other groups. Standing sleep uses free or already-paid shelter; renting a new bed requires an explicit order. Work availability also checks the upcoming occupation block; an unusual schedule exception may conservatively hide a target. No old replay hashes are promised across this behavior change, except the explicitly protected all-NPC baseline.

## Changed files

- `packages/play/`: README, this report; `src/{actions,interrupts,observation,session,source,text}.ts`.
- `packages/cli/src/{main,play,play-session}.ts`; `packages/cli/test/{play-agency,play,play-session,play-reconciliation}.test.ts`.
- `packages/core/src/psyche/{agency,api,commands,index,state,system}.ts`.
- `packages/core/src/social/{api,availability,interact,strife,system,volition}.ts`.
- `packages/core/src/provisions/{api,economy,services,system}.ts`; `packages/core/src/activity/system.ts`.
- `packages/content/src/schema/psyche.ts`; `packages/worldgen/src/layout.ts` (description fallback and distinct garden names).
