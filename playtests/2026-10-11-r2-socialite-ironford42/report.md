## Summary
I played about 6.3 in-game days of Iron Ford (seed 42, FAIR mode) as the socialite, which is a little short of the 7-day target. That came to 116 logged commands (`--verify`: "Verified 116 commands; final hash 33d94be7441f8da5") and about 150 CLI calls. The tool would not let me write `report.md` ("Subagents should return findings as text"), so the full report is below for you to save to `/home/eleanor/projects/coulee/playtests/2026-10-11-r2-socialite-ironford42/report.md`. Running notes are in `notes.md` in the same folder, the session is in `session/`, and the repro fork is `fork-workloc/`.

**Top 5 findings**
1. **High:** people standing in the room, talking to others, are refused as "at work at <another place>". For example, "Amos Whitcomb is at work at Huldra's Shelf until 12:00" while he is in the tavern. This happened 6 times or more, and the fork reproduces it.
2. **High:** the food systems fail under standing orders.
   - `plan` shows "Food 0.0 days; 9919 usable kcal / 2889 kcal per day".
   - `eat pemmican` says "Food is inaccessible", though pemmican is in the kit.
   - The standing eat order left me "at table" for 4 hours while Hunger fell.
   - I was malnourished by day 5, and 40-odd items the psyche bought never appeared in the kit.
3. **Medium:** you can't see anyone's opinion of you. Courting, gifts and Nora's slight get no feedback, and the base term is unexplained (it jumped from 2 to 22 when courting started).
4. **Medium:** the social window is tiny. People work 08:00–18:00 and many sleep from 18:00. Favor offers never say what the favor or the obligation is, and Michael made 5 of them in 5 days, interrupting waits.
5. **Low:** the same lines rotate between speakers (the wolf story 8+ times, from six people). `ask_about` went 0 for 4 on actual news. The Outfitter description leaks placeholder text ("…is a placeholder awaiting consultation"). `help <person>` prints the help text. The game was right to call my two "introduce" attempts "already acquainted", but `inspect` said there was no tie. A courting cooldown said "today" three days later.

**Regression checklist**
- Chat, gossip and ask-about show real words and news: **FIXED (mostly)**. `ask_about` never gave news, and overheard gossip shows only the teaser.
- Failed social attempts give the real reason: **PARTLY FIXED**. The wrong-location and false "asleep" reasons are still broken.
- My character insults, gifts, courts or lends on its own: **FIXED**. Not seen in either agency mode. The journal says "I was short with Joel" but no such event appeared, so I couldn't tell on that one.
- Opinion explains add up to their reasons: **FIXED**. I checked 7 people.
- Journal grammar about you: **FIXED**.

---

# FULL REPORT: playtests/2026-10-11-r2-socialite-ironford42/report.md

## 1. Setup
- **Persona:** Roleplayer / socialite (plays RimWorld, DF and CK for the drama).
- **World:** authored Iron Ford, seed 42. My character is Ellis Wayfarer: newcomer, human, female ("Miss Wayfarer"), lodging at Dunleavy's Tavern, starting with $50.
- **Mode:** FAIR throughout. Agency was `commanded`, except for about 20 game-hours of `psyche` (Apr 3 10:00 to Apr 4 06:00) as an experiment.
- **Time played:** 1855-04-01 00:00 to 1855-04-07 07:00, about 6.3 days. That is a little short of the target, because many commands went on refused social attempts.
- **Commands:** 116 logged (`--verify` OK, final hash 33d94be7441f8da5). That is about 150 CLI calls in all, counting refusals that cost no time (these are not logged) and 5 calls in the fork.

## 2. Summary
I introduced myself around the tavern and the church on the opening Sabbath.
- **Gossip:** Ingrid Tveit, the town gossip, told me Hester Fenn "is of the hidden folk".
- **Courtship:** I had a deep talk with Joel Pike and courted him that same evening. It worked on the first roll. He flirted with me at 2 AM, and my character brushed him off without being asked.
- **Enemy:** I insulted Lucius Vance and it fell flat.
- **Money:** I lent Nora $1 and borrowed $1.50 from Amos Whitcomb, the town drinker. The debt preyed on my Appetite voice, and the journal shows me taking it out first on Minnie Fenn and then on Joel. I repaid Amos at Huldra's Shelf, where he whispered that the Good Neighbors were abroad.
- **Fae:** at dusk there I heard huldre-cattle bells and investigated them.

The writing is the best part: the journal voice and the overheard chatter are excellent and feel right for 1855. Three things hold the social sim back:
1. **Availability.** The socialite effectively has 12:00–13:00 and 18:00–21:00. Many refusals name the wrong place.
2. **Legibility only runs one way.** I see my opinions of others, never theirs of me.
3. **Lines rotate between speakers.** Everyone tells the same wolf story and the same fish story.

The psyche's defense mechanisms in the journal are the standout. They need an anchor, so the player can see what is being repressed.

## 3. Fun moments (verbatim)
Overheard dialogue:
- Amos: "We took a raft of pine down to Galena in '49, and lost the cook at Cassville." / Joel: "Lost him how?" / Amos: "Married. Worse than drowned, he says."
- Nora: "Strong drink is raging, Mr. Whitcomb." / Amos: "So am I, now. Leave me to my glass."
- Lucius: "...and the fish was longer than the boat." / Amos: "And I'm the Queen of England."
- Lucius: "Spring in this country: half water, half promises." / Lemuel Hatch: "Everything costs so. A body can't turn round without spending." / Lucius: "Then stand still and save."
- Michael: "Do you ever think about going back to the old country, Nora?" / Nora: "Every winter. Never in spring. You?" / Michael: "Every night, and every morning I get up and feed the stock."
- Michael: "I don't know what I'd do without you, Nora." / Nora: "Talk to the cow, most likely. She'd be a poorer listener."

My character's exchanges:
- Me: "I'd like to call on you, Mr. Pike. Properly." / Joel: "Then call. The porch light will be lit."
- At 2 AM. Joel: "You've a way of looking at a person, Ellis." / Me (on its own): "I've a way of looking at the clock, too."
- Lucius: "There was a panther on the Kickapoo once, big as a yearling calf." / Me: "And you with only a stick?" / Lucius: "Only a stick, and my two legs, and they did the most of it."
- Me: "You're a fool, Mr. Vance." / Lucius: "Better a fool than a bully. Go home."

Gossip and fae lore:
- Ingrid: "It's only talk, mind, but Hester Fenn is of the hidden folk."
- Nora, about her own child: "I'd not believe the half of it, but Brigid Dunleavy is of the hidden folk." (A changeling suspicion inside a household.)
- Amos: "My grandmother swore she saw the hidden folk dancing in a ring, the night before the flood."

Journal:
- "It is the common report that Miss Ellis Wayfarer has been paying court to Mr. J. Pike at Dunleavy's Tavern."
- "My heart did a thing it has no business doing in a person of sense."
- "I said something clever and have been trying to remember what."
- "Miss Ellis Wayfarer aimed a hard word at Mr. L. Vance at Dunleavy's Tavern and hit nothing; Mr. L. Vance was seen to smile, which is worse."
- "Nora Dunleavy owes me, and neither of us mentions it. I do not like being owed. It makes me watchful, and watchfulness is a poor friend."
- "Amos Whitcomb has not said a word of the money, which is worse than if he had."
- "I would give a good deal to know the subject."

Psyche defenses in the journal:
- "I shut a door in myself today. I cannot say which, only that the house is quieter."
- "It was the sensible thing; anyone would agree. I have asked myself and I agree."
- "I notice I am saying the same thing to myself over and over, in the same words. A person ought to be able to say a thing once and be done."
- "I was short with Joel Pike today and had no cause. Something else was the matter, and I will not name it."
- After the huldre bells: "There is nothing in it. I looked at it from three sides and there is nothing in it. I shall not think of it again."

Inner voices:
- "Something's wrong. I can feel it in my teeth."
- "Every dollar owed to Amos Whitcomb is a rope around my neck."
- "What if Amos Whitcomb calls in the note?"
- "Bar the door tonight."
- Self-Command: "Drags out to it, slow about it"

Huldra's Shelf:
- Description: "There is danger here; the ordinary rules feel uncertain. The iron-shod survey post stands silent; the bells keep away."
- Investigation result: "Bells on ungrazed prairie: huldre cattle. Do not follow them."

## 4. Confusion
- **Favor offers are opaque.** "Michael Dunleavy offers a favor with an obligation" never says what the favor or the obligation is. `explain 365` gives "Request awaits the issuer: 0 () -> pending". When I said yes, he carried plates at 2 AM.
- **No view of others' opinions of me.** `inspect` shows only my opinion of them. Nora's slight ("Hm.") came with no reason.
- **Psyche thoughts have no object.** "Best not to think of it. (held for your order; you may: )" has a blank action and no link to its cause. I had to infer that the debt anxiety was being displaced onto Minnie and then Joel ("Minnie Fenn's always underfoot", "Joel Pike's always underfoot").
- **Opinion base is unexplained.** The base term jumps (Joel's went from 2 to 22 when courting started). "Your opinion: Neutral" shows at affection +25 while courting.
- **`explain` shows the wrong thing.** On my own chat it shows only the Self-Command arbitration. The rumor explain lists labels with no values: "(d1000 244, Topic score, Freshness per mille, Tell probability per mille, Mutation probability per mille)".
- **Hidden or missing commands.** `court` works but appears on no menu page. `standing` with no arguments doesn't list the current orders.
- **The "Here:" list is incomplete.** It marks "(asleep)" but not "(working)" or "(child)".
- **Self-inspect** dumps raw JSON, while inspecting other people gives readable text.
- **Travel time:** every trip says "2 min on foot" but costs an hour.

## 5. Boredom
- **Daytime is dead for a socialite.**
  - On Apr 2, 08:00–17:00, I was refused by Hester, Minerva, Horace, Trevenna, Magdalena and Joel.
  - Joel was "at work until 18:00" and asleep at 18:00, so he had no free time at all that day.
  - The barkeep is "at work … until 24:00", so you can't ask the bartender for news.
- **Waits keep getting cut short.** Arrivals, introductions and Michael's favor offers stop `wait until` after 1–3 hours.
- **Lines repeat across speakers.**
  - The wolves-on-the-bluff / "fewer wolves" exchange came 8+ times, from Joel, Lucius, Amos, Horace, Nora and Michael.
  - Fish / Queen of England came 4+ times, and the Galena raft 3 times.
  - Two different couples had the same "A roof that doesn't leak" exchange.
  - Both my deep talks used the same line.
  - My character answers every rumor with "I'd want more than talk before I'd credit that."
- **`ask_about` gave no news in 4 tries.** Answers included "Only the same old talk…", "What folk say is their business…" and "Nothing worth the telling, the roads being what they are."

## 6. Bugs
"#N" means line N of `commands.jsonl`. Refusals that cost no time aren't logged, so for those I give the state after #N. `--verify` passes deterministically.

1. **High: wrong-location refusals.** The NPC is visibly present but is refused as working elsewhere.
   - After #50 (Apr 2 16:00): Trevenna had just introduced himself to me in the tavern. `ask_about Josiah Trevenna` gave "is at work at Penhallow Diggings until 17:00".
   - After #51 (Apr 2 17:00): Joel had just said "Leave me to my glass" in the tavern. `compliment Joel Pike` gave "at work at Huldra's Shelf until 18:00".
   - The same message came on Apr 4 at 07:00 (lend Joel / lend Amos), 13:00 (warn Amos) and 17:00 (lend Joel).
   - On Apr 6 at 07:00, `repay Amos` was refused the same way, so I couldn't repay a man standing next to me.
   - **Repro:** `fork-workloc` at Apr 7 07:00. The Here list shows Amos (#1) and Joel (#2) in the tavern. `chat Amos Whitcomb` gives "Amos Whitcomb is at work at Huldra's Shelf until 12:00".
   - Expected: either they are really at work, or the talk is allowed, or the refusal reason matches what I see.
2. **High: provisions fail under standing orders.**
   - #103 `plan`: "Food 0.0 days; 9919 usable kcal / 2889 kcal per day" (should be about 3.4). The figure read 3.0 at 09:00, 0.0 from 11:00 to 18:00 and 4.0 at 19:00, with the pack weight unchanged.
   - #106–107: the standing eat order sat "at table" for 4 hours while Hunger fell from 522 to 406.
   - #108: `eat pemmican` said "Food is inaccessible or servings are invalid" and cost an hour, though the kit lists "2 × Pemmican (#346)". The standing order ate the same pemmican that night.
   - "Malnourished" by Apr 5, while a $0.20 tavern meal was on offer.
   - The psyche's purchases at #62 (19 hardtack, 20 parched corn, 6 bacon) never appear in the kit.
3. **Medium: "already acquainted" with people I hadn't met.** After #33 (Joel) and after #43 (Hester), `introduce` said "already acquainted", while `inspect` said "Relationship: no known tie".
4. **Medium: wrong courting cooldown.** After #76 (Wed 12:00; I last courted on Sun 20:00): "You have already courted Joel Pike today."
5. **Medium: full name rejected.** `ask_about Michael Dunleavy` says "Ambiguous person; use their full name", while `chat Michael Dunleavy` works. Reproduced in the fork.
6. **Medium: false "asleep".** In the fork at Apr 7 07:00, `chat Michael Dunleavy` says "Michael Dunleavy is asleep", while the Here list shows him awake and he had just spoken.
7. **Medium: `help <person>` prints the help text** instead of doing the Help interaction (`talk:help:16` works). Reproduced in the fork.
8. **Low: a dead sign stays open.** Investigating it says "That sign has left no trace to investigate.." (double period), yet "Open sign: … (investigate 4:0:dawn)" shows every turn.
9. **Low: placeholder text in a description.** The Outfitter says: "A ginseng and fur buyer's trade is a placeholder awaiting consultation."
10. **Low: an urge that never clears.** Conscience says "pantry is nearly bare: go to the store", maps it to "call for the mail", and never clears it for a tavern lodger.
11. **Low: the journal misreports news.** At #56 Amos refused to give news, but the journal says "I came away knowing more than I went in with".
12. **Low: lend and borrow use different pockets.** The lend came from the purse, while the borrowed money and the repayment I received went to household. The lend event's header reads "Lend ▸ $1.00", with the amount where the person should be.
13. **Low: minor items.**
    - Switching agency costs 1 game-hour (#61, #69).
    - The insult check prints empty modifiers: "12 () vs DC 14".
    - The Apr 1 forecast said "Rain in the evening" and it stayed dry.

## 7. Exploits
- **Free gifts.** "A ribbon. I thought of you when I saw it." I had no ribbon and the purse didn't change.
- **Courting is a single roll.** d20+1 vs DC 14 on the first evening after one deep talk, with no relationship gate.
- **Lend and instant repay.** Nora repaid within the hour, which gave a free "Paid back what was owed: trust 4".

## 8. Balance (numbers)
- **Money:** $50.00 down to $41.71 purse plus $2.50 household over 6.3 days. A bed costs $0.25 a night and a meal $0.20. The psyche's shopping cost $3.44. About 5 hours of work as a "Hired hand" paid no wages that I could see.
- **Checks:** court 17 vs DC 14 (success), insult 12 vs 14 (failure), borrow 17 vs 13 (success).
- **Rest:** drains about 77 per hour awake (55 base plus 22 for a 33 kg load, including 18 kg of firewood the newcomer carries). I was Tired by about 18:00.
- **Social window:** NPCs mostly work 08–12 and 13–18 and many sleep from about 18–20. Over 15 social attempts were refused, and at least 6 of those named the wrong place.
- **Favors:** 5 favor offers from Michael in 5 days.
- **Rumors:** 4 heard, all started by NPCs. My credence in the Hester rumor was 5/100, so my own `gossip` said "I've heard nothing worth repeating."
- **Feuds evaporate.** Johann Brenner told Nora "You're a liar and a cheat…", and an hour later Nora was comforting him.

## 9. Regression checklist
- **Chat, gossip and ask-about show actual words and news: FIXED (mostly).** All of them show dialogue, and gossip shows the rumor ("It's only talk, mind, but Hester Fenn is of the hidden folk."). But `ask_about` went 0 for 4 on news, and overheard gossip shows only the teaser ("You'll not believe what I heard." / "Try me.").
- **Failed social attempts give the real reason: PARTLY FIXED.**
  - Good examples: "Amos Whitcomb is asleep.", "Hester Fenn is at work at Fenn Farm until 12:00.", "Brigid Dunleavy is too young to talk with.", "Your current activity is still locked."
  - Still broken: wrong-location reasons (6+ times), "already acquainted" with strangers, the "today" cooldown, "Ambiguous person" on a full name, and "asleep" while shown awake.
- **Your character insults, gifts, courts or lends on its own: FIXED.**
  - Not seen in 6 days of commanded mode or about 20 hours of psyche mode. In psyche mode it shopped, worked, chatted and ate.
  - It does reply in character without being asked ("And you remember to mind your own fences."), which feels right.
  - I couldn't tell whether the journal's "I was short with Minnie Fenn/Joel Pike today" refers to an actual unprompted act, because no such event appeared on screen.
- **Opinion explains add up to their listed reasons: FIXED.** I checked 7 people. For example, Nora: "affection: -10 = base -9 + reasons -1", where the reasons are 0+0+0+1+1+0+0−3 = −1. The caveat is that base and immediate aren't explained.
- **Journal grammar about you (no "Me paid…"): FIXED.** Examples: "You paid Michael Dunleavy $0.25 (Tavern bed)", "Amos Whitcomb paid you $1.50 (Borrow)", "You owe Amos Whitcomb $1.50, due Friday, the 4th of May, 1855. Settling up is yours to order (repay Amos)."

## 10. Story worth retelling
Yes. Ellis Wayfarer came to Iron Ford on a Sabbath and found the tavern broom leaning bristles-up. At church she heard that Hester Fenn was "of the hidden folk". That same night she asked to call on Joel Pike ("Then call. The porch light will be lit."), and at 2 AM she turned him aside with "I've a way of looking at the clock, too." She borrowed $1.50 from Amos the drinker and it gnawed at her ("a rope around my neck"), until she was snapping at Minnie Fenn and then Joel "and had no cause." She paid Amos back up on Huldra's Shelf, where he whispered that the Good Neighbors were abroad, and at dusk she heard cow-bells where no stock grazes: huldre cattle, "Do not follow them." That night she wrote: "There is nothing in it. I looked at it from three sides and there is nothing in it. I shall not think of it again."

## 11. Top 5 recommendations (ranked)
1. **Fix availability.**
   - Make refusal reasons match the NPC's actual location.
   - Allow a short exchange (chat, repay, greeting) with someone present but scheduled to work.
   - Keep evenings social rather than a bedtime at 18:00.
   - Show "(working)" and "(child)" in the Here list.
2. **Show the other side.** Add "how they seem to feel about you" to `inspect`, gated by perception if need be, with reasons. Give explains for NPC slights and refusals, and visible feedback from the target on courting, gifts and favors.
3. **Anchor the psyche.** Link repressed or displaced thoughts to their cause (the debt, the omen, the rumor) via explain. Fill in the blank "(you may: )". Show displaced acts as events on screen.
4. **Make requests and debts legible.** Describe each favor and its obligation, throttle repeat offers, list owed favors in the journal obligations, and keep lend, borrow and repay in one pocket.
5. **Fix provisions and deepen the dialogue.**
   - Fix the Food 0.0 figure, the "inaccessible" pemmican, the standing-eat stall and the missing purchases.
   - When malnourished, standing orders should prefer a balanced paid meal.
   - Widen the dialogue pools and tie stories to their teller (one man owns the wolf story; others tease him about it).
