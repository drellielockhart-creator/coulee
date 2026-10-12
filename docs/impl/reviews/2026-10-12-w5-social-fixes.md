# Wave 5 social review fixes

1. FIXED — CLI fork header was absent (`savedBranched=true`, `headerBranched=false`, `replayedBranched=false`, matching hashes). Fresh CLI forks now preserve `true` in parent and child logs and replay, and saved/replayed epilogues match with secrets withheld. Verification checks branch metadata as well as hashes; regression tampers only with the header and expects failure. A second fork of an already-branched parent is covered.
2. FIXED — The fair courtship Explain previously exposed Affection 8 in the session fixture (2 in the edge fixture). Fresh fair output says “Joel Pike gave Ellis Wayfarer no encouragement.” Exact regard, threshold and attitude-adjusted DC are target-only Explain children, visible in god mode. Other social Explain notes were reviewed; the attitude DC labels had the same leak and are covered by the regression.
3. FIXED — An empty repayment previously returned success, left 100 cents owing, earned trust +10 and said “We're square.” It now returns failure, transfers nothing, earns no trust and says $1.00 is still owed. Regression covers 0/40/100-cent payments: a 40-cent payment leaves and describes 60 cents, with no full-settlement memory or reward. Successful settlement trust is awarded on completion, subject to the existing quick-repay rule. Partial payments remain incomplete (`success=false`) so the chronicle cannot falsely close the debt story; the regression exercises the chronicle consumer directly.
4. FIXED — A reverse $1 loan against $1 owed previously left two $1 creditor edges despite a zero ledger. It now leaves zero edges, obligations and claims. Regression also covers balances retaining the original direction and crossing into reverse debt, then repayment. All ledger mutations reconcile creditor edges as a projection of the net balance.
5. FIXED — The remote gift audit previously selected inaccessible pantry dried apples and succeeded. It now selects nothing and fails. Regression also verifies pantry access at home and gifts inside a carried container.
6. FIXED — The supplied 70-hour audit previously found 16 repeats, 54 unique lines and 24 retained entries. It now finds 0 repeats, 70 unique lines and 70 retained entries. Regression covers rotating listeners, pair/speaker histories beyond 24 entries, and expiration at 3/7 days. 30-day listener-heard repeat shares: Iron Ford 42, 2185/6282 = 34.8% → 2065/6292 = 32.8%; generated town 7, 1399/3556 = 39.3% → 1372/3560 = 38.5%. Save/load continuation hashes match before and after for both. Exhausted fitting pools can still repeat.
7. FIXED — The generic Keller property introduction now exchanges names without inventing housing. Reviewed all talk pools and rewrote additional generic claims about homes, letters, family, possessions and migration; culture-only personal histories are told as third-person tales. Stable dialogue IDs retained. Regression checks introduction pools and composes the previously failing line for a tavern lodger.

## Evidence

- Baseline audits: `../social-before/{fork,session,edge,agency,text}.log`.
- Current audits: `edge.log`, `agency.log`, `text.log`, `fork-fresh.log`, `session-fresh.log`.
- Repeat comparison: `repeat-comparison.json`.
- Fresh sessions: `s1/`, `f1/`; `refresh.log` includes CLI fork, retirement, courtship and both verifications.
- Original archived saves reject changed content hashes, as intended. Fork/session audit copies use fresh sessions with the same command sequence; the session copy locates the current courtship event ID. Original fixture files remain untouched.
- Agency audit: zero uncommanded PC social acts over 7 days; transfer preserves 74,531 total cents.

## Contracts and scope

No exported type, command, event-kind, replay format or view shape changes. Exact private check fields move into existing Explain children. A repayment's social event now cites the earlier cash-transfer event; `cents` means the actual payment. Dialogue gains `remaining` and `settlement` slots through the existing slots record. Creditor relationship amounts derive from the net ledger. No provisions, needs or play/actions changes; no out-of-area production edits; no commit.

Golden review reason: actual repayments, net creditor edges and accessible gifts change downstream stories. In particular, a false “Accounts Settled” for Hester Fenn is replaced by the still-owed debt. Golden test preserves leak/integer checks and its 60-day story-count assertion.

## Files changed

- `content/base/social/talk-chat.toml`
- `content/base/social/talk-depth.toml`
- `content/base/social/talk-everyday.toml`
- `content/base/social/talk-manners.toml`
- `content/base/social/talk-tales.toml`
- `content/base/social/talk.toml`
- `packages/cli/src/play-session.ts`
- `packages/cli/test/__snapshots__/chronicle-iron_ford-42-30d.md`
- `packages/cli/test/chronicle.test.ts`
- `packages/cli/test/play-session.test.ts`
- `packages/cli/test/social-wave5.test.ts`
- `packages/cli/test/social.test.ts`
- `packages/core/src/social/api.ts`
- `packages/core/src/social/gifts.ts`
- `packages/core/src/social/interact.ts`
- `packages/core/src/social/opinion.ts`
- `packages/core/src/social/talk.ts`
- `packages/cli/test/social-review-wave5.test.ts`

## Final validation

`VITEST_MAX_WORKERS=4 just check` passed: 63 test files, 668 tests; Biome, all package/script typechecks, invariants (179 files) and content validation (91 files) passed. Test duration: 629.28 seconds. Full log: `../social-check-final.log`. The dedicated CLI suite also passed all 6 tests, and the focused social regression suite passed all 11 tests. No timeout exceptions were needed in the final gate.
