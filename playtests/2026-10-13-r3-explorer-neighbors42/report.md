# Coulee r3 playtest: Explorer, iron_ford_neighbors, seed 42

**Persona:** Explorer (outfit, travel, come back, see what changed). **World:** iron_ford_neighbors, FAIR mode, seed 42. **Days played:** 1855-04-01 00:00 to 04-09 18:00, about 9 days. **Commands:** 260 recorded and verified (about 175 were real player commands; the rest were free queries). **Final verify:** `Verified 260 commands; final hash f4d5461c6eca0a3a.` Both mid-journey verifies also passed: `Verified 32 commands; final hash 3441ebcd680302ea` and `Verified 162 commands; final hash df7c098eca908b12`.

**Process note (no game time spent):** the scratchpad is shared with another playtester. My first helper script `p.sh` was overwritten by the socialite tester's script. Before I noticed, three query commands went into **their** session (`playtests/2026-10-13-r3-socialite-gentown7`): `inspect me`, `introduce Michael Dunleavy` and `inspect Michael Dunleavy`. All three were "No game time spent", so their game state didn't change, but there are three extra lines in their transcript. I also overwrote their `p.sh` once, and they put it back. After that I used only `scratchpad/explorer42/`.

## Top 5 findings
1. **HIGH: Cedar Farm has no water a visitor can reach, and "fetch water" there spends an hour and does nothing.** At Cedar Farm fields:
   - `drink`: "Your camp kettle and canteen are empty, and there is no spring, creek or ford here."
   - `fetch water`: one hour passed, status "fetching water", thirst stayed at 0 (Parched).

   The standing drink order emptied both vessels while I worked and gave no warning. I went from Thirst 900 to 0 in 5 work hours and had to walk 5 hours home Parched.
2. **HIGH (wording): every place says "Spring at <place>." and it reads as a water spring.** Cedar Farm fields says "Spring at Cedar Farm fields." even though there is no water there. It is the season line. This is what made me trust the farm for water.
3. **MED-HIGH: the rest economy is very harsh.** After a full night I had Rest 805. By 11:00, four hours into farm work, I was Tired at 199 (−123 to −176 per hour). Seventeen hours asleep at camp took me from 0 to 649. Neither paid day could be finished without collapsing. The route preview at 09:00 on day 1 said "rest 533" on arrival; one hour later it said "rest 83/1000", which was correct.
4. **MED: `inspect <person>` gives away the hidden numbers.**
   - With a failed read ("Perception … 14 vs DC 15 -> failure") it still printed `affection: 5 = base 5…`, while also saying "cool — keeps you at arm's length".
   - When the person is away ("You cannot read their manner from here") it still prints the numbers.
   - It mixes my memories in under the heading "Seems to feel about you".
   - It shows "Remembered: Martha Hale is of the hidden folk" on a character listed as "Human".
5. **MED: overhearing someone counts as having met them.** `introduce Amos Whitcomb` returned "You have already met Amos Whitcomb; there is no need to introduce yourself again." `inspect` showed familiarity 0, "Ties: none". I had never spoken to him, and the menu still offered "Introduce oneself".

## The trips
| Leg | Preview | Actual | Food predicted vs used |
|---|---|---|---|
| Iron Ford to Cedar Farm, day 1, left 10:00 | 388 min, arrive 17:00, rest 83 | arrived 17:00 after 420 min, rest 83 | 428 kcal / ate 428 kcal |
| Cedar Farm to Iron Ford, day 3, left 15:00, parched | 300 min, arrive 20:00, "No carried water remains" | arrived 20:00 | 1272 / 1272 |
| Iron Ford to Cedar Farm, day 5, left 09:00 | 417 min, arrive 16:00, rest 85 | 16:00, rest 85 | 579 / 579 |
| Cedar Farm to Iron Ford, day 7, left 06:00 | 300 min, arrive 11:00, rest 264 | 11:00, rest 264 | 843 / 843 |

The preview was spot-on on every leg after that first-morning rest misread (finding 3). On day 1 the trip stopped itself at 54,720 of 60,000 ft with "Critical vitals: stopped on the road" at Rest 140, even though the collapse estimate was 2.8 days away. On the trip home the parched walk stopped itself every hour.

## Fun moments
- Jonas Hale: "You have... Eyes." / Me: "Everyone does. It's the usual number."
- Jonas: "Jonas Hale. I've heard many names. Yours is new."
- Johann Brenner, unprompted: "Your word's worth less than a ledger entry in pencil." / Me: "That's rich, from someone who doesn't own a pencil."
- The journal: "I went to bed parched. A person can learn a good deal about the world from the floor of an empty belly."
- Glover Spring: "a pale glimmer rests where the bank hides the sky… Do not follow a light across running water."

## Confusing or boring
- The road is empty. Four legs, 22 road hours, no encounters at all.
- Cedar Farm is just two people and three places, and has no store ("No goods for sale here").
- `places` at Cedar Farm lists no destinations.
- `route cedar_farm` doesn't work once you're on the road: "Nothing here matches".
- `wait until 12:00` quietly ends paid work, so I earned $0.06 that day.
- "Attend church" never appears in the menu. `activity:attend_church` worked once, then later answered "Nothing here matches".
- Every short action reprints the dialogue from earlier actions, often 6–10 old lines.

## Reproducible bugs
1. `sleep` in Hale farmhouse answers "Use a regional travel order to leave this site." It still did so after `standing lodging off`. Sleeping works in the fields.
2. `look` at Pratt's says "The question is still open; use signs" while `signs` shows both signs as "Faded".
3. Weather: the status line always says "55°F, dry (fixed authored weather)". The journal says "Snow in the morning" (04-04) and "Rain in the night", and Michael says "Rain on the plowing again."
4. The journal is out of order: the "Week 1" entry is stamped 04-07 00:00 but listed after the 04-07 12:00 entry. It also says "04-03 09:00 I went to bed parched" when I was working at that hour.
5. Seen in output only, not investigated: "You ate Potatoes, Butter, Cornmeal, Flour, fine milled, Vinegar, cider, Tea, black: 1011 kcal, cold" when Hunger was already 1000.
6. On day 9 I went Parched (Thirst 0) in Iron Ford with the standing drink order on. Glover Spring is 1 minute away and I had had full vessels on day 5. I didn't check whether the vessels were empty. `wait until tomorrow` stopped at 14:00 and `wait until morning` stopped at 18:00.
7. "You notice something not quite right about Ellis Wayfarer": the player is told this about themself.
8. The menu offers "Collapsed [activity:incapacitated]" and two separate "Walk" entries.
9. Martha paid my $0.37 wages into my purse while I was 60,000 ft away in Iron Ford.

## Travel verdict
Route preview accuracy is excellent: time, rest and food were exact once on the road. The readiness warnings ("Carried water is exhausted", "Rest will be low; plan a camp") are useful, but:
- None of them warn that the destination has no water.
- `travel` sets off even while the preview says "Critical vitals along the route", with no confirmation.
- The preview lists the same food twice (one line per purchase) with odd fractions like "8.433 left".

## "The town kept living" verdict
Mostly yes. While I was away:
- **Store:** hardtack went 120 → 115 (someone bought some), then back up to 120 on restock.
- **News:** a "Good Neighbors abroad at Pratt's" rumor came up ("Old news… It came by Tuesday"), a sign appeared and then faded, and the town later moved on to "abroad at Huldra's Shelf".
- **Feelings:** familiarity decayed (Michael 40 → 26) and people drifted cool toward me.
- **Jonas and Martha Hale:** they kept flirting with and snubbing each other.

Implausible:
- **Store stock only climbs:** dried apples 30 → 80 → 160, bacon 80 → 191 → 307, potatoes 200 → 387. Restock looks additive and uncapped.
- **The Brigid rumor:** Nora Dunleavy tells a near stranger "Brigid Dunleavy is of the hidden folk", about her own daughter, in the third person.
- **News doesn't cross the road:** nothing from Cedar Farm (my work there, the Hales) ever reached Iron Ford. I carried the Good Neighbors rumor out to the Hales; that is the only news that crossed.
- **NPCs talk to me while I sleep:** "Amos Whitcomb stopped to talk… in the small hours".
- **Michael Dunleavy:** he was asleep at 11:00, 07:00 and 09:00 on different days.

## Quiet days
About 3 (days 2 and 6, the work days at the farm, and day 9). The road legs were always quiet.

## Suggested fixes (ranked)
1. Give Cedar Farm water (a spring, or the Hales' well/bucket), make `fetch water` fail immediately when there is none, and warn about water at the destination in the route preview.
2. Rename the "Spring at X." season line, for example "Spring has come to X."
3. Retune rest drain from work and load, and camp-sleep recovery.
4. Hide the affection/trust breakdown from `inspect` in FAIR mode, or only show it on a successful read.
5. Don't count overheard talk as an introduction.
6. Cap store restock at the authored maximum stock.
7. Fix `sleep` inside another site's houses, and keep the journal and weather consistent.
8. Stop reprinting old dialogue, list "Attend church" in the menu, and add some road encounters.
