# Coulee r3 playtest: Greenhorn, iron_ford seed 42

**Persona/world:** Greenhorn kit (`--kit greenhorn`, $3.00 purse, about 6 days of trail food, blanket, kettle, canteen), iron_ford, seed 42, FAIR mode. **Days:** 1855-04-01 00:00 to 04-11 06:00 (about 10 days). **Commands:** 240 logged (268 in the transcript). **Verify:** `Verified 240 commands; final hash 78aafdd967817a71.`

**Harness problem, not a game bug:** sibling playtest agents share one scratchpad. The socialite agent overwrote my `scratchpad/p.sh` with its own session path. About 6 of my early commands (`journal`, `look`, plus several `inspect` and `hire` calls that errored) ran against `playtests/2026-10-13-r3-socialite-gentown7/session`. One collided with their lock: `EEXIST ... socialite-gentown7/session/.lock`. Errored commands are not logged, but the `journal`/`look` observes may be in their commands.jsonl. They change no state, but their replay log may hold them. After that I used `scratchpad/greenhorn42-only/gh.sh`. Future waves should give each agent its own scratch subdirectory.

## Top 5 findings
1. **BALANCE/HIGH: a full workday plus a normal waking day uses more Rest than you have.** Rest drains −97/h working and −39/h at leisure, and `rest` does not restore it. `work` ×8 from 06:00 gives `Rest 0 (Exhausted)` by 16:00 every day. The game warns: "You may collapse from exhaustion … rest runs out in about 3 hours at the current rate (-97/h)". The newcomer has to sleep 11–12 hours a night. `rest` at the mill: `Rest 434` → `337`, then `298 (Tired)`.
2. **MEDIUM: `standing lodging off` is ignored by `sleep`.** Lodging was off (confirmed by `standing` → "lodging off"). `sleep` at the mill still gave "Money: purse −$0.25 … Tavern bed: $0.25 / You arrive at Dunleavy's Tavern". The same happened at Ferry Landing. Camping only happens if you first walk to a creek or spring.
3. **MEDIUM: Sunday work is silently unpaid.** Hired 1 Apr (Sunday) with "until Tuesday the 3rd". About 6 h of `work` gave "Earned and unpaid $0.00". The code skips Sundays (`weekday === 'sun'`) but nothing tells the player. The contract ends at the start of Tuesday, so a Sunday hire buys one paid day.
4. **MEDIUM: piece rates barely exist in play.**
   - Firewood is listed at 3¢ in income.toml, but the sale gives `Sold 1 Armload of firewood for $0.01`. The explain reads "First-unit bid (below county retail) +1", because retail is 2¢.
   - At 06:00 the store had no cash: "The store has only $0.00 to pay out just now; 1 Brook trout, fresh would be $0.04."
   - By 11:00 the standing eat order had eaten the trout ("you ate Brook trout, fresh, Brook trout, fresh…"), and then "Partly used Brook trout, fresh cannot be sold."
   - `prices` never shows what the store pays.
5. **MEDIUM: `sleep` can be overridden by the eat standing order.** `sleep` at 18:00 paid for the bed, but the next status was "Ellis Wayfarer — cooking", with no "You lie down to sleep". After 11 h, Rest was only 511.

## Run summary (money)
| Day | Events | Purse |
|---|---|---|
| 1 Sun | 2 tavern beds −0.50, sold firewood +0.01, worked unpaid | $2.51 |
| 2 Mon | store day wage +0.60, camped | $3.11 |
| 3 Tue | 5 h fishing (0.5 trout), hired at the mill weekly, forced tavern bed −0.25 | $2.86 |
| 4–5 | mill; cornmeal + bacon −0.42; camped | $2.44 |
| 6 Fri | mill; bed −0.25 | $2.19 |
| 7 Sat | weekly wage +2.62; quit; refused by Fenn; ferry day +0.60; bed −0.25 | $5.16 |
| 8 Sun | foraging/wood, sold 2 wood +0.02 | $5.18 |
| 9 Mon | store weekly; food −0.24, fishing line −0.40; 1 trout | $4.54 |
| 10 Tue | quit → wages +1.20, rehired at once | $5.74 |

Totals: wages $5.02, piece sales $0.03, beds −$1.75, goods −$1.06. Net +$2.74.

## Fun moments
- Joel Pike: "You've a tongue like a rusty hinge." Nora Dunleavy: "And you've a mind to match. It never opens."
- Amos Whitcomb: "I once ran a line straight through a bee tree." / "And the bees?" / "Ran a line straight through me."
- Me to Lydia: "I'm steady because I'm tired. Don't confuse the two." That fits the Rest crisis.
- A chat mid-shift: "it kept Lydia Pratt from work". Fae signs: "A neat plait has appeared in the loose straw by the door."

## Confusion and boredom
- **Finding an employer is guesswork.** "This employer has no seasonal hiring business" for the smith and all four miners at Penhallow Diggings. Mines not hiring in 1855 feels wrong. Nothing in-world hints who is hiring.
- **"Spring at Pratt & Daughter"** is the season, but reads like a water spring. `fill canteen` there: "No water to draw here … nearest is Glover Spring".
- **Unhelpful errors:**
  - `hire Brenner` (two Brenners present) and `hire Tollef Haugen` (he was absent) both say "Name one person present here".
  - "Edwin Fenn refuses paid work: Cannot fund that term" reads as if Fenn refused to work.
- **Perception reads:** a failed roll ("6 … vs DC 18 -> failure") still prints a confident "Seems to feel about you: cool".
- **Repeated or stale text:**
  - "Conscience: It is late; the day starts early" appears at 06:00.
  - "Appetite: Drink accessible water" appears at Thirst 900.
  - The "How are the hens laying?" chat was reused verbatim for a storekeeper.
- **Other gaps:**
  - You cannot inspect store goods before buying ("You cannot inspect 'cornmeal'").
  - The status line said "Food 2.0 days" while `plan` said 5.0.
  - Cornmeal won't cook at camp despite kettle, water and firewood ("No available food/preparation matches"). It works at a hearth, and the "You ate" event arrives one command late.
- **Grind:** `work` must be retyped every hour, and `wait` cancels work (activity became "at leisure" or "fetching water"). A full day is 8–9 commands.

## Reproducible bugs
1. Lodging off ignored: `standing lodging off` → `go Haugen's Grist Mill` → `sleep` → tavern charges $0.25.
2. Sunday unpaid with no message: from start, `go Pratt & Daughter, Outfitters`, `hire Augusta Pratt`, `work` ×4 → "Earned and unpaid $0.00".
3. Duplicate stacks: gather 1 firewood while holding 1 → `sell firewood 2` → "Which one? … [sell:344]; … [sell:1047]".
4. Store duplicate: `prices` lists both "Arrows, dozen, horn-tipped" and "Arrows, horn-tipped, dozen".
5. Trade goods eaten: catch a trout → keep working → the standing eat order eats it → "Partly used … cannot be sold."
6. Free cash-out loop: `quit` (wages paid at once: "+$1.20 — Wages") → `hire Augusta Pratt weekly` succeeds in the same hour. Weekly pay can be cashed any day with no cooldown and no opinion cost.

## Income loop verdict
Yes, but only through wages, and only barely. Wages run 60–75¢ a day and cornmeal is about 3¢ a day of calories, so food is cheap. The tavern bed (25¢) is the main cost, and avoiding it means camping and walking to a creek before `sleep`. Net savings are about 25–40¢ a day.

- **What's tight:** Rest, not money. The Sabbath also gives no income. Daily contracts last a day or two, so you keep re-hiring, and each hire or refusal costs most of an hour.
- **Piece rates:** wood about 0.5¢/h, fish 0–0.2 trout/h without a line, morels 0.1/h. That is roughly 10× worse than wages, so they are not a real fallback.

## Minute-budget verdict
It works well for shopping and social chains: three buys, two chats and a purchase fit in 35 minutes. A 10-minute chat correctly cut that hour's pay (0.06 instead of 0.07–0.08). It feels inconsistent elsewhere: `drink`, `fill kettle`, `fetch water` (a 1-minute walk), `hire`, `quit` and `wake` each burn the rest of the hour, often 49–58 minutes.

## Suggested fixes (ranked)
1. Rebalance Rest: lower the work and idle drain, or let `rest` recover some.
2. Make `sleep` honour lodging off by camping where you stand (or saying why it can't). Don't let standing eat or cook override a sleep command.
3. Warn when the Sabbath pays nothing, both at hire and on `work`.
4. Show piece-rate bids in `prices`. Fix the 3¢ firewood rate being clamped to 1¢. Let the player mark goods "for sale" so the eat order skips them.
5. Make `hire`, `quit`, `drink`, `fill`, `wake` and `fetch water` short acts.
6. Let `work` persist across `wait` until the shift ends.
7. Add a cooldown or opinion cost to quit-then-rehire, or only settle weekly pay on payday.
8. Small fixes: say "ambiguous" or "not here" in hire/inspect errors; hedge failed perception reads; rename the season line "Spring at X"; merge identical stacks; allow inspecting store goods.
