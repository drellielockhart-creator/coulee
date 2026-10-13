# Coulee r3 playtest: Socialite, gen:town seed 7

**Persona/world:** Socialite (Ellis Wayfarer), `gen:town` seed 7 (Badger Hollow), FAIR mode. **Days:** 1855-04-01 00:00 to 04-08 10:00 (about 7.5 days). **Commands:** 262 in the main session (`--verify`: **Verified 262 commands; final hash 8a29ddb227066c04**). I also ran two short `tavern_brawl` side sessions in my own directory (`.../brawl` 17 cmds, hash 9df1084c33452559; `.../brawl2` 18 cmds, hash ed72e606a5cada8f), all verified. Everything is under `/home/eleanor/projects/coulee-pt-r3/playtests/2026-10-13-r3-socialite-gentown7/`.

## Top 5 findings
1. **HIGH: the reasons listed for opinions are written from the wrong side.** People dislike me more because of slights *they* made against me.
   - `talk:borrow:2` (Josiah refused, even though he owed me a favor), then `inspect Josiah Whitlock` showed: `Turned me away when I asked: affection -2` (Josiah's opinion of me).
   - Peran slighted me twice: `Was short with me at the Wagon Wheel Tavern: affection -2` / `-3` (Peran's opinion of me).
   - After Jory *won* our fight: `Put me down in front of everyone: affection 0, respect 3, trust 0, fear 4`.
   - Richard's own help to me shows up in his opinion of me: `Lent me a hand unasked: affection 2`.
   - Lists also repeat lines: Loveday has `Saw Loveday Rowe help Peran Rowe...` five times.
2. **HIGH: in FAIR mode, `inspect` shows the true numbers, which makes the Perception read pointless.**
   - Example: `Seems to feel about you: friendly ... Perception ... failure` followed straight away by `affection: 0 = base -1 + reasons 1 + immediate 0`.
   - Species are also shown to the player. `Marta Vik — Elf`, `Peran Rausch — Goblin` appear while "hidden folk" rumors are going around.
   - Before anyone had told me anything, `inspect Elijah Freeman` showed `Remembered: Elijah Freeman is of the hidden folk`.
3. **HIGH: a brawl can't happen in gen:town.**
   - `talk:fight:3` is a one-hour abstract roll: `Fight! ▸ Jory Rowe (it went badly)`, with `Wounds 0/12`.
   - `attack Jory Rowe` gives `Nothing here matches`.
   - The code comment in `sim/advance.ts` says "ordinary scenarios never allocate tactical state".
   - The town's tavern was empty every evening; the household was asleep by 18:00–20:00, even on Saturday.
4. **MED: tactical mode keeps going after the brawl ends.**
   - After `the brawl ends with one fighter crossing the tavern door.`, the screen still showed `Tactical 00:00:17.8 — awaiting your order` with only tactical verbs.
   - `inspect <anyone>` failed with `not here... or someone you know`.
   - `wait 1h` ran as `3600s passed. Tactical 01:00:17.8`. `tactical:breathe` only showed up after that wait.
5. **MED: the conversation panel shows the oldest 8 lines of the hour, not the newest.**
   - While I chained chats with Johanne Kvale, every output repeated the Rowe and Whitlock lines from earlier.
   - Her replies (`"Not a thing. Badger Hollow's as quiet as a churchyard."`) only appeared after the hour rolled over.
   - It looks as if your new chat drew an old reply.

## Summary
Meeting people works well. Within about 30 commands I had introduced myself to about 22 people, mostly at Sunday church. The dialogue writing is the best part of the game. The relationship model underneath is hard to read:
- Gifts and help create a favor owed but no warmth. Josiah stayed at -3 after a tobacco gift. Loveday stayed at 1 after help.
- Warmth from talk wears off: Richard went from 10 to 2 overnight, even with a gift.
- Insults and fights matter only to the target. Nobody else heard about my fight with Jory.

## Fun moments (verbatim)
- Richard flirting: "That's a fine ribbon, Miss Wayfarer." / "It's a fine neck it's tied around, I hope." Later: "If there were a fiddler, I'd ask you to dance." / "Then somebody find a fiddler."
- My insult: "You've a tongue like a rusty hinge." / Jory: "And you've a mind to match. It never opens."
- Tollef's mock: "Ellis Wayfarer could plow a field crooked with a rope for a guide." / "And you couldn't find the field."
- Johanne: "A good stove. A better neighbor. A third thing that I'll think of."
- Gunnar: "You'll find me at the back, where the Lord can't see me yawn."
- Following the "Good Neighbors at the Mercantile" rumor led to: "Small claw marks betray the pantry visitor." A nice mundane payoff.

## Confusion / boredom
- Player gossip almost always came out empty ("I'm as dry as a well in August") even after I had heard rumors. It worked once (I passed the Kvale's Smithy rumor to Richard).
- `ask_about` usually yields nothing.
- The "hidden folk" rumor was stored as fact (`Remembered: Richard Pascoe is of the hidden folk`) with no way to follow it up.
- `wait until 19:00` at Dahl's carried me back to the tavern at 16:00. `sleep` with `standing lodging off` still put me in the tavern bed, which made me miss a dawn sign ("That trace has faded").
- An offer of help lapsed during a wait with no prompt, shown only as `You let pass, unanswered, Loveday Rowe's help`. `explain 5102` printed `no answer: 0 () -> no answer`.
- NPCs chat, flirt and help me from other buildings: Richard helped "churn" while I was at the smithy.
- Help is refused while someone works: `Gunnar Nordby is working here until 12:00; a short word...`.
- `talk:gift` said I had nothing to give ("a little food would do") while I carried pemmican and dried apples. The gift line for tobacco was "Some eggs for your table."
- The menu says "(1 min)" but the arrival line says "2–3 min on foot".
- `EEXIST ... session/.lock` appeared once between back-to-back calls.

## Reproducible bugs
1. Dialogue lag: `talk:introduce:1`, `talk:introduce:2`, `talk:ask_about:1`, `go Kvale's Smithy`, `talk:introduce:7`, `talk:chat:7`. Johanne's lines are missing until the hour ends.
2. Wrong-side reasons: `talk:borrow:2` at the Mercantile, then `inspect Josiah Whitlock`.
3. Gift with food in the pack: `talk:gift:24` on day 1 refuses.
4. Lingering tactical mode: `--new --scenario tavern_brawl --seed 8`, `wait 1h`, `tactical:attack:2`, then `tactical:resume` ×5. Tactical mode persists, and `inspect Michael Dunleavy` fails.
5. Unexplained grudge: in both brawl runs, after the brawl the `Appetite:` line says `I haven't forgotten, Amos Whitcomb. I won't. (... you may: insult Amos Whitcomb)`. I never dealt with Amos; in run 2 I had fought on his side. Next morning Amos: "What a fine day you're having, Miss Wayfarer!" / me: "What do you want?"
6. Broken reason label: Joel's opinion of me lists `Ellis Wayfarer and Joel Pike: the brawl ends with one fighter crossing the tavern door.: affection 0, respect -4`. It is the raw event text with a stray ".:".

## Opinion-line verdict
- **Legible:** the bands are readable, and "What you know between you" is good.
- **Believable:** the wording varies with no meaning I could find ("keeps you at arm's length" vs "is cool toward you"). Richard flirted twice and still read as "cool".
- **Fair misreads:** they can't feel fair or unfair, because the true numbers are printed right underneath. Hide the numbers in FAIR mode and the misread system could work.

## Brawl verdict
- **Main town:** not reachable. "Fight" is an hour-long abstract roll, with no injury and no bystander reaction.
- **tavern_brawl scenario:** clear and tense. "Join, call for peace, or leave through the door" is a good opener.
- **Breaking it up:** my first parley ended with no message at all ("parley resolves"). The second gave `Your call for peace fails to carry` (d20 4 vs DC 12).
- **Joining:** it ended sensibly, with Pike out the door.
- **Aftermath:** thin. Pike lost 4 respect and still had +2 affection. My ally Amos turned cool and I held a grudge against him. The tactical clock lingered.

## Minute budget for socializing
Good overall. Chaining four or five 10–15 minute acts per hour feels right. `Peran has no more time for talk at work this hour; try next hour.` is clear, and "it kept X from work" is a nice touch. The problems:
- Gift, help, insult, fight and borrow eat the rest of the hour without warning.
- Dialogue display lags, as in finding 5.

## Quiet days
About 4 of 7.5 days had nothing new: Apr 3, 4 (the freight day brought no crowd), 6 and 7. Every evening the town was asleep by 18:00–20:00. The prayer-meeting preacher was asleep at 18:00 on a weekday.

## Suggested fixes, ranked
1. Make opinion reasons show the NPC's point of view: no self-blame for their own slights, a victor doesn't gain fear of the loser, and remove duplicate lines.
2. Hide raw opinion numbers, true species and unearned "Remembered" facts in FAIR mode.
3. Show the newest dialogue lines first, or all lines produced since the last command.
4. Drop out of tactical mode automatically when the last brawl in the room ends, and allow `inspect` during tactical mode.
5. Let NPCs in gen:town drink in the evenings and give gen:town towns a real brawl path (escalate the Fight interaction, or have drinkers' quarrels start one). Keep households awake past dusk.
6. Let gifts and help add a small affection gain. Let a favor owed improve borrow odds. Let bystanders hear about a fight.
7. Let the player pass on rumors they've heard. Store hearsay as "heard that…", not as fact.
8. Smaller fixes:
   - Lodging should not override a player who wants to stay out overnight.
   - Show a yes/no offer as an interrupt.
   - Count food as a giftable item.
   - Make the menu's travel minutes match the actual walk.
   - Stop NPC chats and help from reaching me across buildings.