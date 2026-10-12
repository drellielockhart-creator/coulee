# Pocket player notes (gentown7)

- Start: seed 7, gen:town, FAIR mode, 1855-04-01 00:00 at Red Oak Tavern.

## Chunk 1 (cmds 1-11, 1855-04-01 00:00 -> 09:00)
- Every reply repeats the full status block (Purse, Food, Vitals, Health, Board, place text, Here list, menu ~16 lines). Even a no-time query like `signs`/`journal` reprints it. Phone-unfriendly. Regression Q1: likely STILL BROKEN (only the "Since last look" line is new; when time passes it reads "Since last look: 1h passed; Hunger: steady -> Peckish").
- `signs` printed "No journal entries known yet." as its first line (wrong header for signs). No signs found yet at tavern or Badger Ford.
- Intro to Jory: "Good day > Jory Rowe (it went well)". Jory gossip: "Richard Pascoe is of the hidden folk" (rumor, fae hook).
- Jargon in Self-Command line: "Resolved: Introduce oneself: 1068 (Reality 50 x Self-Command 50%, Voices 1000 x 100%, Impulse (+/-100))" -- confusing for a phone player.
- Conscience line: "It is late; the day starts early (held for your order; you may: sleep)" -- nagging but readable.
- `sleep` at Badger Ford (open ground, no bed): "Make camp and sleep here" -> advanced only 1h, status "sleeping at camp", menu collapses to 8 items. `wait until morning` then ran 5h and stopped at 08:00 with "You are getting thirsty" (reasonable interrupt).
- BUG? After `drink` while camped: "Self-Command: Resolved: At home" appears though we are at Badger Ford camp. Also "Health: Vigor 7/7; Wounds 0/12. thirsty" has a stray word appended.
- Place text Badger Ford: "The smith resets iron bars in the shallow gravel each spring..." (nice).

## Chunk 2 (cmds ~12-24, 04-01 10:00 -> 04-03 00:00)
- `wait until tomorrow` from camp: "Since last look: 14h passed." then auto-ate Pemmican/Dried apples/Hardtack via routine standing orders and "You lie down to sleep" -- no interrupt. Food 6.0 -> 5.0 -> 4.0 days over 2 days.
- `wait 1d` at camp: "Since last look: 24h passed." no interrupts. Summary line does not say what changed (only time).
- Status line stuck on "sleeping at camp" even after waking (menu offers "Make camp and sleep here"). Possibly stale.
- `standing` (no args) and `standing eat` both error: "Use standing <sleep|eat|drink|warmth|lodging> <on|off>". There is NO way to view the current standing order from the CLI. Brief says "standing to view or change" -> view missing.
- `eat 145 raw` -> "Ambiguous food: use a stable eat:item:method action id." even though kit sheet lists the item as #145. Usability.
- `places 1` / `places` at camp -> "Use actions <page> with an available positive page number.." (wrong, and double period). Camp menu is 8 items, 'actions 2' lists 'Inspect ...' rows only.
- Actions page 2 shows "Inspect Water Street" twice (place 23 and 24) -- duplicate name, no disambiguator.
- Conscience line did not reappear after camp; "Self-Command: Held for your order; routine standing orders only" is the normal idle line.

## Chunk 3 (04-03 00:00 -> 09:00)
- Camp stayed "sleeping at camp" for a while, and `go 22` at camp -> "No such destination." Camp menu only has Inspect rows on page 2. Had to `wait 1h` / `wait until morning` to wake; woke at 08:00 "at leisure". Breaking camp is not obvious from the menu.
- Food days jumped 4.0 -> 5.0 after 1h of sleep (no explanation). Probably projection at current activity rate. Confusing.
- `prices` at Whitlock Mercantile printed ~330 lines in one observation (not paged) and then repeated the whole status block. Not phone-friendly.
- Good interrupt text: "Appetite: Drink accessible water (held for your order; you may: fetch water)" and "Conscience: The table is laid (held for your order; you may: take a meal)".
- Conscience at Mercantile: "The pantry is nearly bare: go to the store (held for your order; you may: call for the mail)". "call for the mail" is odd/unclear.
- Mercantile: Hannah Whitlock/Josiah Whitlock/Prince Freeman: "Josiah Whitlock: Lend a hand > Hannah Whitlock (it went well)" -- NPC-to-NPC chatter; good texture.
- Shop list has two "Water Street" place entries (23 and 24) and two identical "Arrows, horn-tipped, dozen" lines (price list dupes).

## Chunk 4 (04-03 09:00 -> 12:00, ~cmds 27-37)
- `buy pemmican 4` -> "Money: purse -$1.20, household +$0.00 — Bought 4 Pemmican for $1.20". Clear. Food 5.0 -> 9.0 days. Good.
- Dangling option text: "Appetite: That's done and gone. Least said. (held for your order; you may: )" -- empty "you may:" clause. Appeared twice (mercantile, tavern). BUG (low).
- `work` at mercantile ALSO walked me to the Red Oak Tavern ("You arrive at the Red Oak Tavern (2 min on foot)") with no prior prompt. Work location unclear.
- Fae sign found at tavern: "Open sign: The porridge bowl is licked clean on the outside. (investigate 25:2:dawn)". Journal: "I would like to know what made it." Good hook.
- `investigate 25:2:dawn` at 11:00 (NOT dawn) -> "Investigate: 10 (d20 9, Intelligence +1) vs DC 10 -> success" -> "You find where the trace ends. It points nowhere further." Sign still listed as Open. Success yet no progress; sign still open. Confusing. Also the 'dawn' tag was ignored.
- Journal entries are first-person psyche text ("I notice I am saying the same thing to myself over and over...", "I shut a door in myself today"). Strong flavor; also "I had every reason for it, and I have written the reasons down" (04-02 12:00) -- unexplained, no matching event I caused.
- Loan: "Jory Rowe: Lend > $1.00 (it went well)" happened between NPCs; not a request to me. Journal: "Money passes, and so do obligations; I have begun to keep a list." No obligations to me shown yet.
- Journal "Since last look" line sits mid-journal output. OK.
- Status line "Self-Command: Resolved: At home" appears again when at Red Oak after `work` (it was 'Work' at tavern). Mislabel recurring.

## Chunk 5 (04-03 12:00 -> 04-04 09:00, ~cmds 38-50)
- `wait until dawn` from noon -> "Wait stopped at 20:00 (you meant to wait until 06:00)." + "You are getting tired" + "Skipped 14 minor conversations nearby." Good interrupt, clear reason. Also "Rest: steady -> Tired". Survival warning: "You may collapse from exhaustion in about 92 hours if this continues (Fortitude saves vary)." Good.
- Appetite line when tired: "Weary: a bed would be welcome (held for your order; you may: sleep)". Good.
- `sleep` at tavern bed: "Money: purse -$0.25 ... Tavern bed: $0.25". Clear. But 'sleep' only ran 1h before the next prompt ("sleeping"), 'wait until morning' ran 11h: "Since last look: 11h passed; Rest: Tired -> steady." Good.
- After waking: status line "Health: Vigor 7/7; Wounds 0/12. malnourished" -- condition appears with Hunger 864 and no explanation shown in the status. Confusing. (Looked at inspect output: survival.conditions = ["malnourished"].)
- BUG (medium?): investigate 25:2:dawn at 08:00 next day -> "You have already tested this sign. Returning cannot change the evidence." but the sign stays listed in the status block as "Open sign: ... (investigate 25:2:dawn)" and in `signs`. A dead action stays in the UI. Also the earlier investigation (noon) returned "points nowhere further" yet the sign stayed open. Dead end, no closure.
- `fetch water` -> "Since last look: 1h passed" + "Resolved: Fetch water"; no visible "water fetched" line. Kit line "Kit: Less than a day of stored drinking water; preparation also draws from it." appeared only after the 'plan'.
- `inspect Ellis Wayfarer` dumps ~41 KB of JSON (needs, formulas, action explanations). Not phone-friendly (dev/debug, but it's exposed in the play CLI).
- `plan`: Food 8.0 days; 22993 usable kcal / 2889 kcal per day. Kit now has "4 x Pemmican (#695)" separate from "3 x Pemmican (#146)" -- two stacks, fine.
- Chat NPC lines: "Jory Rowe: 'I've not forgotten the hand you lent me at the Red Oak Tavern, Richard.'" -- nice callback texture.

## Chunk 6 (04-04 09:00 -> 14:00, ~cmds 51-58)
- `wait until noon` stopped at 10:00 for "Loveday Rowe: Good day > Ellis Wayfarer (it went well)". A greeting interrupted a wait: interrupt too eager for trivial social lines? (Noted; 'Skipped N minor conversations' suggests a filter exists but this one got through.)
- Kvale Ford Smithy description: "Ford Smithy stands at (44, 24)..." -- the word "Kvale" is missing from the place description (name truncated). BUG (low).
- `work` at the Smithy -> "You arrive at the Red Oak Tavern" -- Work walks you to the tavern again. Purse unchanged ($48.55), no pay shown. Work is unclear.
- `explain 5821` (Work) -> "Resolved: Work: 1680 (Reality 100 x Self-Command 50%, Voices 1605 x 100%, Impulse (+/-100)) -> command". Dice/voices jargon, not a player-facing explanation of what work does or pays.
- Open sign line repeats everywhere, including Kvale Ford Smithy, though the sign is about the tavern porridge bowl.
- BUG (high-ish, reproduce): `standing eat off` at 04-04 14:00 (Red Oak) -> status line "Food 0.0 days; Medium, 30.9 kg." and "Less than one day of food or cooking fuel remains." while `plan` the same minute says "Food 0.0 days; 22993 usable kcal / 2889 kcal per day" and lists 2 Hardtack, 3+4 Pemmican, 2 Dried apples. 22993/2889 = 8.0 days. `standing eat on` restored "Food 8.0 days". False scarcity alarm, and it flips with a standing-order toggle.
- Also `plan` spoils line changed from "Dried apples in 533.5 days" (04-04 08:00) to "266.5 days" (04-04 15:00, rain) -- half, no explanation. Minor.
- "Work" at tavern again no pay after 1h. (Still unclear.)

## Chunk 7 (04-04 17:00 -> 04-05 12:00, ~cmds 62-72)
- `wait until morning` from tavern bed: "Since last look: 15h passed; Company: steady -> Restless; Hunger: Peckish -> steady." Clean summary. Interrupt at 08:00 "You are getting restless". OK.
- `aid Peran Rowe` / `aid Peran` -> "Nothing here matches 'Peran Rowe'" even though "Peran Rowe (#5)" is in the Here list. `aid` is not on any menu; discoverability poor. Name matching for aid is inconsistent with `talk`/`inspect`.
- `wait 2d` at tavern stopped at 12:00 (04-05) on "Peran Rowe: Good day > Ellis Wayfarer (it went well)". Second 'Good day' greeting interrupt of a wait (first was Loveday at 10:00). Greetings interrupt too often.
- Wait summary "Since last look: 4h passed; Company: Restless -> steady." Good.
- Dialog: "Peran Rowe: 'I'm Peran. Who are you?'" then "Ellis Wayfarer: 'Ellis. Pleased to meet you.'" (NPC lines show our side too).
- Money still $48.30; Work pays nothing visible after 3 shifts.
- Journal 04-04 00:00: "I am down with want of food. Too long on salt meat and meal; the body keeps its own books." -- a hunger/malnutrition line while the status still said food ok; no explanation of 'malnourished' anywhere in the status.
- BUG (medium): journal 04-04 20:00 "Peran Rausch was in close talk with Peran Rowe at the Red Oak Tavern..." -- name "Peran Rausch" is not a person in this town (Peran Rowe is). Wrong name in journal.
- Journal is noisy: ~25 entries in 5 game days, most are "in close talk ... I would give a good deal to know the subject." Duplicates at 13:00 and 14:00 (identical text). Boredom risk; no grouping or summary.
- Journal entries "I shut a door in myself today" / "I notice I am saying the same thing to myself over and over" (psyche texture) -- good flavor.

## Chunk 8 (starvation test, 04-05 12:00 -> 17:00, ~cmds 73-80)
- Turned `standing eat off` again: "Less than one day of food or cooking fuel remains." + "Food 0.0 days" again while kit has ~8 days. REPRODUCED (2nd time). Verify with --verify later.
- `wait 1d` #1 stopped at 15:00 for "Jory Rowe arrives at the Red Oak Tavern" (not worth stopping) and Loveday chat (fair). Message: "Wait stopped at 15:00 (you meant to wait until 13:00)" -- the 'until' target text is confusing for "wait 1d".
- `wait 1d` #2 stopped at 17:00 for "Jory Rowe: Slight > Ellis Wayfarer (it went well)" -- a social slight, arguably worth a stop, but after 2h. "(you meant to wait until 15:00)" again odd wording for a 1-day wait.
- Hunger falls ~30-35/hour awake (807 at 13:00 -> 736 at 15:00 -> 678 at 17:00). Interrupts so far for waits: greetings, arrivals, slights (3-4 per day) -- too many social stops for a pocket player.
- After eat off, the Eat menu items now show "Eat Pemmican (raw) [eat:146:raw]" as well.
- 04-05 18:00 `sleep` (bed) then `wait until morning` stopped at 22:00 "You are getting peckish"; also "[8069] You are missing church" and new need line "Faith & Ritual: steady -> Wanting church". Note: first time Faith & Ritual surfaced. Interrupt for hunger at 22:00 = fair.
- `wait until morning` #2 stopped at 03:00 (target 08:00) for "Nils Dahl: Good day > Ellis Wayfarer (it went well)". THIRD greeting-stop (Loveday 10:00, Peran 12:00, Nils 03:00). Greetings are the most frequent interrupt -> too often for a pocket player. Could be a tuning issue.
- Status at 03:00 04-06: "Hunger 487 (Peckish)", "Health: ... malnourished" (no fatigue), "Counter closed". No collapse yet.
- Nils Dahl is a new NPC here ("Nils Dahl (#14)"). Introductions read fine.
- 04-06 06:00 `wait until morning` stopped at 06:00 for "Loveday Rowe: Comfort > Ellis Wayfarer (it went badly)". Then the newcomer's own line: "Ellis Wayfarer: 'Leave me be, if it's all the same to you.'" -- I (the player) gave no order; newcomer refused help on its own (psyche agency?). Confusing for "acts only on your orders".
- `agency` with no args -> "Use agency commanded or agency psyche." (no view of current mode).
- `agency commanded` -> 1h passed; afterwards "Appetite: Hungry: eat from the larder or pack" while vitals say "Hunger 358 (Peckish)": label mismatch.
- Kit line (04-06 06:00 via `agency` query): "Less than four days of usable food at current rations." vs status "Food 0.0 days" same minute. Two different food numbers for the same state. INCONSISTENT (part of the food-days bug).
- "The fire wants minding (held for your order; you may: cook)" -- cooking/fuel prompt, newcomer wants to cook? (Fire/cook option appears when commanded.)
- Self-Command "Resolved: At home" again while outdoors-at-tavern (label mismatch seen many times now).
- Starvation timeline (agency commanded, eat off): 04-06 07:00 Hunger 358 Peckish -> 10:00 271 Hungry ("You are hungry now", wait stopped; good) -> 16:00 Hunger 71 Starving ("You are starving now"; wait stopped at 16:00 for target 18:00).
- BUG (medium, numbers): "You may collapse from starvation in about 367 hours if this continues" at Hunger 271, and "about 363 hours" at Hunger 71. Hunger is falling ~30/hour, so collapse is ~2-3 hours away, not ~15 days. The estimate is ~100x off and barely moves.
- Compare: exhaustion warning "You may collapse from exhaustion in about 92 hours" at Rest 294 (plausible-ish).
- Status line now: "Health: Vigor 7/7; Wounds 0/12. malnourished, starving" (the health line grows; phone-width risk).
- "Food 0.0 days" persists while I have 2 Hardtack + 3 Pemmican + 4 Pemmican + 2 Dried apples (confirmed in plan).
- Request (04-06 17:00): "Jory Rowe offers a favor with an obligation. Answer within the hour; silence means no answer." + "Pending favor with an obligation: answer:3:25:8160:help:yes or answer:3:25:8160:help:no (expires within the hour)". Typed-only answers. NOT on the default 14-item menu page; they are on `actions 1` page 2 ("4. Accept favor with an obligation from Jory [answer:3:25:8160:help:yes]"). The favor's content is never described (explain 8160 -> "No known explanation with that id"). Pocket player cannot tell what they are agreeing to. HIGH-ish confusion.
- Accepted (cmd ~92): "Your answer on the request: accepted - explain 9439". Then "Jory Rowe: Lend a hand > Ellis Wayfarer (it went well)" and Ellis: "Thank you. I'd have been at it all day." Favor executed within the hour, took 1h. Obligation shown? (checking journal next).
- Jory had "slighted me" in journal 04-05 16:00 ("I held my face still and counted to a hundred; it did not help.") -- good texture.
- Starvation: Hunger 71 (16:00) -> 42 (17:00) -> 13 (18:00). Still no collapse at Hunger 13; "collapse from starvation in about 361 hours" still.
- 04-06 19:00 Hunger 0 "Starving", no collapse message yet; ate Pemmican (menu 15) at 19:00 -> "You ate Pemmican: 967 kcal, cold"; "You are easing from starving to hungry". Good recovery text.
- `standing eat on` (cmd ~96) -> "Food 7.0 days" again immediately (bug confirmed a 3rd time: off => 0.0 days, on => 7.0 days).
- `sleep` in tavern bed 21:00-22:00 then `wait until morning` -> 04-07 08:00 "Since last look: 10h passed; Hunger: Hungry -> steady; Rest: Exhausted -> steady." Clean summary. Status still says "sleeping" and menu shows only 8 items at 08:00 (no Sleep/Make-camp/Go options) -> stale/awake-ambiguous state.
- NEW fae sign: "Open sign: Three tools lie with their handles pointing to the threshold. (investigate 25:6:dawn)" -- two open signs now in the status block; no grouping.
- Exhaustion: Rest 76 "Exhausted" -> "You are exhausted now" interrupt; "You may collapse from exhaustion in about 86 hours" (ok-ish).
- 04-07 09:00 "Vitals ... sleeping" label stale: at 09:00 status "Ellis Wayfarer - sleeping" but menu is the full awake menu (Sleep, Work, Go...). Stale state label.
- `investigate 25:6:dawn` at 10:00 -> "[10476] The trace runs toward Tregear Upper Coulee Farm. Return there at dusk; the timing matters. - explain 10476". GOOD fun hook: a timed follow-up.
- Sign 25:2:dawn still "Open sign" after the dead-end result; repeated in every observation.
- Appetite line: "Something's wrong. I can feel it in my teeth. (held for your order; you may: keep house)" -- creepy, good. "keep house" option text is clear.
- Fun moment: `go Tregear Upper Coulee Farm` (04-07 19:00, after dusk): "A frost pocket, patched fence and a root cellar nearly through its winter stores... Ash gathers on the wrong side of the hearthstone. There is danger here; the ordinary rules feel uncertain. Iron at a threshold keeps small visitors out." Strong fae place text.
- Waits 04-07: stopped 14:00 (Jory "it went badly"), 16:00 (Jory "Gossip"), 18:00-ish (Jory "Chat", Peran "Slight"). Gossip/chat/slights stop waits every 2 hours; too often for a pocket player.
- Command count at end of play: ~115 game commands (incl. errors). Days played: 04-01 to 04-07 (7 days).
- Stopped playing here (budget). Next: --verify, then report.
