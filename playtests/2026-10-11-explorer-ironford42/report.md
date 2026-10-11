# Playtest report: explorer-ironford42

_Report text returned by the playtest agent (the workflow harness blocked subagent writes to report.md). Running notes: notes.md; session logs: session/._

I couldn't write `/home/eleanor/projects/coulee/playtests/2026-10-11-explorer-ironford42/report.md`. The Write tool refused it, so the findings are below. Notes are in `notes.md` in the same folder. I played 125 commands over 8 days and `--verify` passed (final hash ee7872c35212e904).

Top 5 findings:
1. **High: world and talk are thin.**
   - `look` gives no description of a place, and `inspect` returns only id, name and kind.
   - Chat results say only "success".
   - Wild and fae places (Huldra's Shelf, Cold Stair, the Coulees) were empty. I saw nothing fae in 8 days.
2. **High: failed talks are misleading and cost an hour.**
   - The message "may have left or be unavailable" appeared 5 times, often when the person was listed as Here but asleep, or had moved on since the menu was drawn.
3. **Medium: the loop goes flat after day 3.**
   - The character mostly runs itself (work at the tavern, eat, sleep, church, market).
   - A `wait 24h` stops after 1–14 hours, about 8 of 20 stops were NPC-to-NPC chatter, and the game gives no goals or income.
4. **Medium: money and kit change with no explanation.**
   - The purse fell from $49.75 to $41.93 in one sleeping hour.
   - Working lowers the purse.
   - Load fell from 33.9 kg to 14.2 kg on day 4 with no message, and firewood ran out with no way to buy more at the Wood-yard.
5. **Low: menus and errors.**
   - The "Go" menu lists only about 4 places; the rest work by typing `go <name>`.
   - Every move takes exactly 1 hour.
   - `wait until` accepts unknown event kinds without complaint.
   - Soft errors exit with code 2.

Best part: the journal voice. For example, "My heart did a thing it has no business doing in a person of sense." I'd keep playing only for that, not for the loop.
