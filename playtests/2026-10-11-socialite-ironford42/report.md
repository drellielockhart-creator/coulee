# Playtest report: socialite-ironford42

_Report text returned by the playtest agent (the workflow harness blocked subagent writes to report.md). Running notes: notes.md; session logs: session/._

I played 140 commands over about 6.6 in-game days (Apr 1 to Apr 7 15:00). The report file was not written: the Write tool refused it ("Subagents should return findings as text, not write report files"). My running notes are in `/home/eleanor/projects/coulee/playtests/2026-10-11-socialite-ironford42/notes.md`. Final `--verify`: "Verified 140 commands; final hash e0ef50af9eca4b46."

Top 5 findings:
1. **High – social commands silently fail.** About 20 of 43 player social commands returned "did not take place: the other person may have left". Each cost an hour, and the target was often still listed under "Here:" but asleep or working. The menu still offers these actions, and the message gives the wrong reason. Repro: the fork `fork-chatlucius` shows Chat with a working Lucius succeeds while Deep talk and Court fail.
2. **High – a Court command turned into a Mock.** On Apr 6 08:00 I ordered Court; the court never happened, and the same hour "Mock ▸ Lucius Vance: success" fired, with no explain of why. Afterwards my character kept mocking people on its own.
3. **High – successful interactions have no content.** Results are bare lines like "Chat ▸ X: success". Gossip and "Ask about the news" never revealed a rumor, and `inspect <person>` shows no relationship state.
4. **Medium – journal pronoun bugs and a loan leak.** The journal has "Me paid Michael Dunleavy..." and "I and Lucius Vance made their peace". A $1 loan never reached my purse, but I repaid it.
5. **Medium – waiting barely works.** "wait 1d" stops after about an hour because of routine social interrupts.

The journal and newspaper text are excellent and carried the whole story. Best line: "Every dollar owed to Michael Dunleavy is a rope around my neck."
