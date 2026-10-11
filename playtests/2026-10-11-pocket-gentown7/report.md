# Pocket Player playtest report

## 1. Persona, world, mode, days played, commands

- Persona: Pocket Player (phone, five-minute bus chunks)
- World: generated ford town, seed 7; Ellis Wayfarer, newcomer kit, tavern lodging
- Mode: FAIR
- Time played: 1855-04-01 00:00 to 1855-04-08 07:00 (7 days, 7 hours)
- Commands: 78 accepted stateless commands (session verification count)
- Session: `/home/eleanor/projects/coulee/playtests/2026-10-11-pocket-gentown7/session`
- Verification: `--verify` passed; 78 commands, final hash `3486f40ca9511c24`.

## 2. Summary

I began at the Wagon Bell Tavern, walked to the Iron Ford, and mostly let Ellis follow her emerging routines: work, meals, sleep, fetching water, church, and socializing. Long waits were the main way I advanced time. At night they sometimes ran several hours, but daytime waits often stopped after one hour for a social interaction. The journal built a compelling story of quiet aid and town gossip with little direction from me.

For phone-sized sessions, the current view is fairly scannable, but it is repeated after every command and has about 20 lines before the menu. The journal is substantially longer. The newest event lines do help explain immediate changes; a persistent rumor line and the 15-item menu use space even when unchanged.

## 3. Fun moments

- “The ration is at 50 in the hundred and the children no longer ask. That is the worst of it: they no longer ask.”
- “Miss Ellis Wayfarer, whose pantry has been bare, did not go hungry this week; Mrs. H. Sheehan saw to that, and mentioned it to nobody. We mention it for her.”
- “Johanna Sheehan was in close talk with Patrick Sheehan at The Wagon Bell Tavern on Sunday in the afternoon. I would give a good deal to know the subject.” (This line appeared twice verbatim.)
- After an autonomous flirt with Timothy: “My heart did a thing it has no business doing in a person of sense.”
- The town rumor “Timothy Costello is of the hidden folk” became explorable; its explanation was “Choose a rumor to tell: 1600 (d1000 673, Topic score, Tell probability per mille, Mutation probability per mille) -> applied”.

## 4. Confusion

- `wait until 08:00` returned at 02:00 with `Stopped: activity.moved`, after Ellis returned to the tavern and began sleeping. The interruption reason is visible, but it is hard to know whether the requested wait has been canceled, paused, or is still intended to continue.
- Help advertises `inspect <actor/item/place>`, but typing `inspect Timothy Costello` returned “No available action matches; use look or actions.” I found the person through `actions 2` and selected the numbered inspect action instead.
- A rumor appears in the view, but `explain` on recent generic social results can return “That explanation is not known to your character.” It was unclear at first which event IDs had explanations available.
- Self-command changes were not always obvious: Ellis moved to the store and bought 45 cornmeal for $1.35 while I was waiting, then was “waiting on the mail.” The purchase and activity appeared only in the event lines, without stating why that plan was selected.

## 5. Boredom

Repeatedly issuing long waits during daytime became mechanical: many 8-hour or 1-day requests advanced only an hour before another interaction interrupted them. Social interrupts are interesting when they reveal gossip or a meaningful relationship turn, but two generic “Chat ▸ …: success” results per stop grew repetitive. Repeated full menus and the unchanged “Heard” rumor also made each turn feel more verbose than its new information.

## 6. Bugs

No confirmed simulation bug found. The early wait stop is deterministic and appears to be an intentional interrupt, so I’m reporting it as a short-session usability issue rather than a bug.

- Repro detail: command 4 was `wait until 08:00`, issued at 1855-04-01 01:00. Actual: stopped at 02:00 with `activity.moved`, at the Wagon Bell Tavern and sleeping. Expected from the typed time: reach 08:00 unless an interrupt is meant to cancel the wait; the current output does not say whether it is paused or canceled.
- Repro session: `/home/eleanor/projects/coulee/playtests/2026-10-11-pocket-gentown7/session`; `just run play --session /home/eleanor/projects/coulee/playtests/2026-10-11-pocket-gentown7/session --verify` returned `Verified 78 commands; final hash 3486f40ca9511c24`.

## 7. Exploits

No clear exploit found. Tavern meals cost $0.20 and a bed cost $0.25; water at the tavern was free. Free water makes maintaining thirst inexpensive in town, but this short run did not establish whether water access stays available outside town.

## 8. Balance notes, with numbers

- Started with $50.00; ended with $42.45, a $7.55 decrease over 7 days, 7 hours. One visible purchase was 45 cornmeal for $1.35. Tavern meals cost $0.20 and beds $0.25.
- Food estimate started at 6.8 days and ended at 6.5 days. It fluctuated between 6.3 and 7.0 days as meals and gifts arrived.
- Hunger often returned to 971–1000; the character was fed automatically at the tavern for $0.20. Rest fell as low as 355 while weary, then recovered during sleep.
- Thirst fell as low as 474 while asleep; drinking 500 ml at the tavern raised it from 484 to 706 in one hour. Warmth remained 1000 through rain and temperatures in the low 30s.
- Weather shifted from dry to rain and back; temperature ranged about 32–53°F.

## 9. Was there a story worth retelling?

Yes. Ellis arrived with a bare pantry during a town ration crisis, and Honora quietly made sure she ate without asking for thanks. Around them, the Sheehans and Timothy helped one another, lent and repaid money, carried relief to struggling neighbors, and traded close-talk rumors. Ellis eventually carried food to Honora in return, while the journal recorded her own awkward flirtation with Timothy, rumored to be one of the hidden folk. The small acts made the town feel like it existed beyond my commands.

## 10. Top 5 recommendations, ranked

1. **High:** Let long waits advance to the requested time unless the player chooses to stop, or clearly say whether an interrupt paused or canceled the wait. Daytime one-hour stops undermine five-minute play chunks.
2. **High:** Reduce or batch low-information social interrupts during long waits. Keep notable outcomes (gossip, secrets, relationship turns) prominent and summarize routine chats.
3. **Medium:** Make help’s `inspect <thing>` syntax work directly, or teach the menu-number route in help. It took an extra menu-page search to inspect someone.
4. **Medium:** Make the observation prioritize what changed since the prior command; collapse unchanged rumor, location, and menu text on repeat views, especially for phone use.
5. **Low:** Deduplicate identical journal events and offer a short recent-entries view so a week of play does not require scrolling through the full chronicle.
