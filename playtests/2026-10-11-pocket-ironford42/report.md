# Pocket Player playtest report

## 1. Persona, world, mode, days played, commands

Pocket Player; authored Iron Ford, seed 42; FAIR mode; 1855-04-01 00:00 through 1855-04-08 08:00 (7 days, 8 hours); 58 verified game commands.

## 2. Summary

I checked the kit, traveled among the tavern, church, print shop, and outfitters, and mostly let Ellis follow the town’s self-command. The world produced a strong town-level chronicle and a promising fae rumor, but moment-to-moment play settled into a repetitive tavern loop of work, meals, sleep, and frequent automatic social interactions. Long waits often stopped after one or two hours, which made the game active but made “wait 1d” a poor fit for a phone session unless the player expects to handle each interrupt.

## 3. Fun moments

- “The full moon, which the Norwegians watch and the Cornish do not discuss.”
- “I helped Michael Dunleavy at Dunleavy's Tavern on Thursday of an evening. It cost me little and, I think, meant a good deal.”
- “Brigid Dunleavy is of the hidden folk” (the live Heard line).
- Week 1 journal: “the larder was down to under a day at the worst.”

## 4. Confusion

- The opening says sleep locks 4 hours, but selecting sleep at 01:00 or 18:00 advanced only one hour in the immediate response. Subsequent waits continued sleeping; the lock’s exact behavior is unclear.
- During a wait, Ellis moved between locations, switched activities, and bought flour. The stop reason and event output help, but it is unclear which changes were player-directed and which were autonomous.
- `inspect Brigid Dunleavy` says “people: Human” while Heard says she is “of the hidden folk.” This works as a rumor, but inspect gives no knowledge context.
- `wait until 08:00` sometimes stopped well before the target on movement/social interrupts; other times it reached morning. The stop reason explains the early stop, but the command feels like a target rather than a request to advance toward it.

## 5. Boredom

Repeated chat/yarn/prayer/help interactions with Brigid, Nora, and Michael dominated the tavern. Many were back-to-back within one in-game hour, and the result is often only success/failure. I saw the same people and verbs dozens of times; after the first full moon and hidden-folk rumor, the loop had little new player-facing content. The live observation itself is phone-readable, but the repeated menu and 16-item list consume most of the screen. “Here: …; N more (inspect by name)” is helpful.

## 6. Bugs

No confirmed deterministic bug found.

- **Candidate: an unprompted purchase while waiting.** Command 31 (`wait 2d`): expected a wait that advances the current simulation until its next interrupt; actual output reported “Bought 12 flour for $0.60” while Ellis was at Pratt & Daughter “waiting on the mail.” No purchase choice appeared. Repro: session `/home/eleanor/projects/coulee/playtests/2026-10-11-pocket-ironford42/session`; `--verify` passed all 58 commands with final hash `9644f2dddeb98e84`. This may be intended self-command behavior, but the purchase lacks a clear cue that Ellis chose it.

## 7. Exploits

No deliberate exploit tested. An easy apparent optimization is to remain at the tavern: automatic meals repeatedly restore food, and sleep restores rest, while the carried food estimate stayed around 6.3–7.0 days. This is convenient but costs money and gives little reason to use the starting provisions.

## 8. Balance notes, with numbers

- Purse: $50.00 to $37.18 over 7 days 8 hours, a net drop of $12.82. At least one $0.60 flour purchase, recurring $0.20 tavern meals, and $0.25 lodging charges appeared. No visible wage/income appeared despite many hours with Work selected.
- Carried food estimate: 6.8 days initially; 6.5 days at the end. Tavern meals kept the character from consuming much of the pack.
- Final needs: Drink 499, Hunger 927, Rest 945, Thirst 1000, Warmth 1000. Rest recovered fully after sleeping; thirst reached 1000 repeatedly even while at the tavern.
- Weekly town journal: ration at 50%; larder below one day at worst; 9 meals, all 9 cold. Strong scarcity signal, although Ellis personally remained well supplied.

## 9. Was there a story worth retelling?

Yes. Iron Ford’s ration is cut to half, and by the week’s worst point the larder is nearly empty; Michael Dunleavy keeps carrying relief to neighbors, and I help him once. In the same tavern, a close talk between Nora and Brigid leaves the journal wondering what they discussed, while the live view says Brigid is of the hidden folk. Ellis later makes sport of Lydia Pratt and regrets it, a small social mistake that lands because the town already feels tightly connected. That is a strong pocket-sized frontier story, even though most of the days between those beats were repetitive.

## 10. Top 5 recommendations, ranked

1. **High:** Make the long-wait contract legible. Show a compact elapsed-time summary and why it stopped; consider an option to continue through routine social interactions until a more consequential interrupt.
2. **High:** Give the player a clearer choice/notification before autonomous spending. Work and purchases need visible outcomes so “wait” does not feel like silently spending the purse.
3. **Medium:** Reduce or vary repeated automatic social interactions, especially repeated conversation attempts with the same few people in adjacent hours.
4. **Medium:** Add a compact “since last look” summary for money, needs, location, and notable events; the journal is excellent but requires a separate query.
5. **Low:** Make inspection distinguish known fact from rumor/heard knowledge, and expose a next step for investigating the hidden-folk clue.
