# Playtest report: socialite-gentown7

_Report text returned by the playtest agent (the workflow harness blocked subagent writes to report.md). Running notes: notes.md; session logs: session/._

**Playtest: socialite, gen:town seed 7.** I played 5.4 in-game days in FAIR mode (Apr 1 00:00 to Apr 6 10:00) using 146 commands. `--verify` passed at command 128 (hash 0a0416818231b0ea). I did not write `report.md`: the tool refused to let a subagent write report files. The full draft (sections 1–10, bugs B1–B18) is in this session, and my running notes are saved in `notes.md`.

**Top 5 findings:**
1. **High: social verbs return no content.** Ask about the news, gossip, warn, accuse and confide all report "success" but show nothing that was said, and no belief forms. The story only shows up later in the journal, which is excellent: "I had every reason for it… They read better each time."
2. **High: one catch-all failure message.** "The requested conversation did not take place: the other person may have left" covered about 14 of 34 social attempts. It hides three different causes: the target is asleep (the menu still offers them), the target left during the hour, or a hidden eligibility/cooldown rule. Forks at Apr 2 09:00 show flirting with Johanna fails while flirting with Timothy rolls normally.
3. **High: long waits don't work.** `wait 1d`, `2d` and `3d` stop after 1–2 hours on "social.interaction", even at an empty spring. That's why I only reached day 6.
4. **Medium: opinions and the psyche aren't readable.** Opinion totals don't match the listed reasons (Elijah Carter is −3 with reasons +3, +3, +3). The best voice lines ("Not one glass. You know where one glass goes.") appear only in a roughly 600-line raw JSON `inspect`. The grudge list stayed empty and ego/superego/id stayed at 50/50/50 all game.
5. **Medium: money and journal bugs.**
   - A $1 loan was "repaid" but never came back to my purse (cmd 103).
   - The game bought cornmeal on its own for $1.35 and it never reached my inventory (cmd 63).
   - Standing drinks costs nothing (cmd 75).
   - The journal narrator says she doesn't know the subject of her own conversations.
   - The journal calls my household "Newcomer lodgingses".
   - The "Timothy forgave me" entry is written from the wrong point of view.

There is a story worth retelling: Ellis, a hired hand with a drink problem, accuses the lodger rumoured to be one of the hidden folk, is forgiven, then courts him and is turned away.

Files are in `/home/eleanor/projects/coulee/playtests/2026-10-11-socialite-gentown7/`:
- notes.md
- session/
- fork-flirt/, fork-flirt2/, fork-flirt3/
