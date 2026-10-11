# Playtest report: edgeqa-gentown7

_Report text returned by the playtest agent (the workflow harness blocked subagent writes to report.md). Running notes: notes.md; session logs: session/._

Top 5 findings. The full report could not be written to `report.md`: the Write tool refused it, so I'm not writing it another way. The running notes are in `/home/eleanor/projects/coulee/playtests/2026-10-11-edgeqa-gentown7/notes.md`.

1. **HIGH [fair + source], grain can be cornered and never recovers.** Stores in gen:town have `restockId: None`. At command index 118 to 120 I bought 465 flour, 160 beans and 130 pork for about $55, which is 99 days of food. In a headless 60-day run with no hoarder, both stores ended with 0 flour, cornmeal, beans and potatoes.
2. **MEDIUM [fair + source], the PC's money is spent without consent and hidden.**
   - Autonomous shopping (index 19, event 722) bought 35 cornmeal for $1.05 from my purse.
   - Beds and tavern meals cost about $1.15 a day during waits.
   - Wages and loans go to a household cash box that the UI never shows; `Purse $0.00` still bought pork.
3. **MEDIUM [god/source], false famine at t=0.** Event 264 cuts the lone PC's household ration to 50% because the pack isn't counted. The journal then says "the children no longer ask", though there are no children.
4. **MEDIUM [god/source], economy has no sinks.** Wages are minted every Saturday with no payer, and the money supply grew 5.3x in 60 days. Cornmeal costs 1.9c per 1000 kcal against a 75c daily wage, so food is never a constraint.
5. **LOW [fair], input and UX problems.**
   - A menu number of `-1` crashes the CLI with a CACError.
   - `wait until <anything>` is accepted as an event name.
   - The "conversation did not take place" message is false when the person is present.
   - The `save`, `load`, `fork` and `quit` verbs shown in `help` don't work in session mode.
   - Waits are interrupted every few hours.
   - There is no carry limit (382 kg, "Staggering", no effect).

No FAIR leak of Silas Vance's faekin nature was found. Determinism held: `--verify` passed on the main session and on forks.

Directory: `/home/eleanor/projects/coulee/playtests/2026-10-11-edgeqa-gentown7/` (main session in `session/`; ground-truth side runs in `god1/` and `headless60/`).
