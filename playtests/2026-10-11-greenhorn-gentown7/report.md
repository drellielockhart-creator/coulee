# Playtest report: greenhorn-gentown7

_Report text returned by the playtest agent (the workflow harness blocked subagent writes to report.md). Running notes: notes.md; session logs: session/._

The report file was not written: the harness rejected the Write as a report file, so the full report is below as text. Session notes are in `/home/eleanor/projects/coulee/playtests/2026-10-11-greenhorn-gentown7/notes.md`.

**Persona/world/mode:** Greenhorn (Ellis Wayfarer), gentown seed 7, FAIR. Played 1855-04-01 00:00 to 04-07 07:00 (about 6 days 7 hours). 84 game commands; `--verify` gives `Verified 84 commands; final hash 7476337772e58685`.

**Top 5 findings**

1. **High: silent prep failure.** `provisions.prep_failed` logs "Cannot prepare food: 0 () -> failure" at 04-03 07:00 (event 3388, after `rations 100` at game command 42), again at 4807 and 8956. No message reaches the player.
2. **High: autonomy is invisible.** Ellis works, gifts food from its own stores, chats, flirts, cooks, and buys meals without orders. The player cannot tell what they control.
3. **Medium: wages don't reach the purse.** `provisions.wages` logs "Six paid workdays: 450 (Weekly wages cents) -> success" at 04-07 06:00, but the purse stays at $44.59. Work pay is otherwise never shown.
4. **Medium: silent purchase.** After `go crane general store` the log shows "Bought 35 cornmeal for $1.05" with no buy command. Store has no price list; bare `buy` lists internal ids (`buy:salt_pork`).
5. **Medium: opaque social and pacing.** Chat reports "success" but never shows dialogue. `wait until 06:00` stops on `social.interaction` about every 1–2 hours, so one overnight wait took about 8 commands.

**Other notes**
- Confusion: `explain` output is jargon ("Larder horizon and ration cut ... -> rations_cut"). The status says "at home" while at the Smithy. The Kit line ("Some food cannot be prepared...") has no action. Bare `explain 263` crashes with a CACError stack trace (needs quotes).
- Balance: purse $50 to $44.59 over 6.3 days (about $0.85/day). Bed $0.25, meal $0.20, cornmeal about 3c, flour 5c. Money has no pressure. Cooking one serving consumed a full armload of firewood (2 to 1) with no preview.
- Fun: journal lines such as "I am learning to let a gift be a gift" and "These things are noticed, and recorded here for the credit of the place." The story arc (Ellis feeding the Sheehans, "I made eyes at Timothy Costello") is worth retelling.
