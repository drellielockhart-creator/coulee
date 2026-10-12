# Fae slice 1a: review fixes and completion (wave 4)

Codex gpt-6-astra built this on `wave4/fae-fix`. Codex ran out of usage quota during the final write-up, so the orchestrator (Claude) assembled this report from the job's progress notes and artifacts in this folder (`acceptance-fix.json`, `fair-fix.json`, `fresh-fix.json`, `rumor-fix.json`, `year-fix-monthly.json`, `agency-fix-equivalence.json`, `commands-fix-*.jsonl`), then re-ran `just check` on the branch.

## Review findings (runs/review-w3-fae, 2026-10-11)

| # | Finding | Status | Evidence |
|---|---|---|---|
| R1 | Incoming loans put a commanded PC in debt without consent | FIXED | Consequential replies (accepting a loan, a proposal, answering a question) now go through `authorizeAct` for the target. For a commanded target they become pending requests. Fair session: Michael offered a loan after several days: "Pending loan offer (you would borrow)". Declining gave "Your answer on the request: refused", with no transfer or debt (`commands-fix-42-offer.jsonl`). The 14-day all-NPC comparison with fae disabled is byte-identical (`agency-fix-equivalence.json`). |
| R2 | Fair observations showed omens the PC failed to notice | FIXED | `fae.omen` reaches fair output only through an explicit witnessed notice. This applies to the archive, text, JSONL, interrupts and the journal. |
| R3 | Failed-read Explains revealed truth through counterfactual checks | FIXED | Truth-selected and counterfactual rolls are omniscient only. A regression asserts that fair output for a failed read is identical across truth. |
| R4 | Discovering a lead used up the attempt needed to follow it | FIXED | Discovery and follow-up are separate: one persisted resolution at the named place and time window, with no reroll. Seed 3: "At East limestone cap, dusk reveals the end of the trace: Marsh gas burns low over the wet ground." |
| R5 | Omen text variety (three surfaces in 90 days) | FIXED | Eight paired surface and mundane-reading variants per family, a repeat cooldown, and place cooldowns that start on first witness. Iron Ford year: 2,734 omen events (0.27% of the log), no published surface repeated within 30 days, no omen template above 5.44%. |

## Slice 1a completion (doc 13 §8.1)

- **Iron Ford 42 route gate: MET.** Four omens noticed by day-2 dusk (three lookalikes, plus Ice at the Cold Stair).
- **Fresh-seed gate: MET with an active exploration route.** The fixed route passes all 8 acceptance seeds, and seeds 9–10 also find real signs and actionable leads; all ten explorers survive.
  - Earlier routes managed 5/8 and 4/8, so route choice matters a lot.
  - The first eight-day explorer audit failed for lack of supplies; the provisioned route fetches water and replenishes food.
- **Notice and episode work:**
  - Notice modifiers and episode weighting added.
  - Episodes persist six hours.
  - Terrain weighting is stronger.
  - Conspicuous Ice signs have an easier notice DC.
  - An unwitnessed dawn episode no longer blocks dusk.
- **Year spam rerun after the cap fix: MET** (above). The old year-cap test expected identical weekly text; it is now a weekly-cap test plus a 30-day repeat test.
- **Performance:** the fae system measures 0.238 ms per game-hour on the Iron Ford year (limit 0.3). Whole-run and save-size limits are reported separately and not all pass.
- **Sessions:** all four fair CLI sessions replay, including the declined loan.
- **Test harness:** the CLI subprocess test now captures stdout through a file, because sandboxed pipes return EPERM. Its assertions are unchanged.

## Remaining
- Whole-run time and save-size budgets (perf wave 2).
- Full-route dependence of the fresh-seed gate: a passive newcomer sees fewer signs. This is intended, but worth a Greenhorn playtest.
