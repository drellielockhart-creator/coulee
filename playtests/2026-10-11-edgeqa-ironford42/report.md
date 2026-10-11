# Playtest report: edgeqa-ironford42

_Report text returned by the playtest agent (the workflow harness blocked subagent writes to report.md). Running notes: notes.md; session logs: session/._

**Report not written.** The Write tool refused `report.md` because subagents must return findings as text, and I did not work around that. Running notes are in `/home/eleanor/projects/coulee/playtests/2026-10-11-edgeqa-ironford42/notes.md`. The main session is `.../session` (FAIR, Apr 1–9 1855, 135 log lines). `--verify` passes: `Verified 135 commands; final hash 5d9a2aa6f26b161e`. A fork given the same commands ends on the same hash.

Top 5 findings:
1. **MEDIUM [fair]:** The PC's carried food doesn't count toward its household pantry. At minute 0 the game cuts the ration to 50% and writes a journal line about "the children no longer ask". The week-1 summary claims "larder down to under a day" while the PC held 48 days of food. Neighbours bring "something for the pot". Repro: `go Pratt`, then `journal` and `explain 402`; log lines 2–4.
2. **MEDIUM [fair]:** The menu offers Repay, Dun and Borrow to people who can't take them. Choosing one costs an hour and says "the other person may have left", though they are present. Repro: log lines 76–78, and `repay Hester` in `fork-hester`.
3. **MEDIUM [fair/source]:** The Purse line omits household cash. Saturday wages of $4.50 arrive silently (`householdCents` 450 in metrics) and are paid whether or not you work.
4. **LOW-MEDIUM exploit [fair/source]:** Haugen's mill (80% markup) sells flour at 4c and cornmeal at 2c. Pratt's buys them at 5c and 3c (+25% and +50%). Sells are one unit per hour, so the gain is tiny. Pratt's also buys back at its sell price (zero spread), so I sold my blanket for $3.00. Food is nearly free: cornmeal is about 3.7c per day.
5. **LOW [fair]:** Typing `-1` crashes the CLI with a stack trace. `wait until 7:30` is silently accepted. Errors for buy quantity 0, negative or over stock are inconsistent. Waits are interrupted every 3–4 hours. A purse drop of $1.05 on day 1 is unexplained.

No FAIR-mode leak of Edwin or Hester Fenn's true nature found.
