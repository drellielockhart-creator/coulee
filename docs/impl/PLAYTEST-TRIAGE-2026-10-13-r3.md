# r3 playtest triage (2026-10-13)

Four Claude persona playtests ran on `main` at `aa216a8`, in FAIR mode through the headless CLI. Reports are in `playtests/2026-10-13-r3-*/report.md`. Every session's `--verify` passed (16 sessions).

| Persona | World | Days | Commands |
|---|---|---|---|
| Greenhorn | iron_ford 42 (`--kit greenhorn`, $3) | ~10 | 240 |
| Socialite | gen:town 7 (+ 2 tavern_brawl) | ~7.5 | 262 |
| Edge-case QA | iron_ford 42 + tavern_brawl | — | ~330 over 10 sessions |
| Explorer | iron_ford_neighbors 42 | ~9 | 260 |

**What works:**
- The minute budget chains shopping and chats well.
- Money balances on every transaction checked.
- A newcomer *can* make a living on wages.
- The route preview was exact on every leg after the first.
- The absent town kept living: its store, rumors and feelings all moved.
- The dialogue writing is the highlight.
- The tavern_brawl opener is tense.

**Quiet days:** about 4 of 7.5 (Socialite) and about 3 of 9 (Explorer), plus empty road legs. This matches Director D0's dead-air baseline.

**Harness:** agents again collided on a shared helper script in the Claude scratchpad. Future briefs must require helper scripts inside the agent's own playtest directory.

## Fix groups for wave 10 (parallel worktrees)

### A. Needs, rest and sleep (core needs/activity; golden will change)
1. **HIGH, the one-hour lag** (QA H1; Greenhorn). Each hour is charged at the *previous* hour's activity. Work is charged as leisure, the next idle hour as work, and sleep is credited an hour late. A meal's Hunger lands the next hour. This is the original "physiology runs first, using the previous activity" design; players read it as broken.
   - Charge each hour at the activity actually done in it. With the minute budget, that means the hour's minutes by activity.
   - Pay is prorated for partial-hour work but needs are not (QA M6): prorate needs the same way.
2. **BALANCE/HIGH, the Rest economy.**
   - Drain is −97 to −176/h working and −39/h idle, so a full workday reaches Exhausted by 16:00 and needs 11–12 h of sleep. `rest` doesn't recover anything.
   - Camp sleep: 17 h took Rest from 0 to 649.
   - Retune against a target day: 8–10 h of work + 4–6 h awake + 7–8 h of sleep is sustainable at normal load.
3. **Sleep commands:**
   - `sleep` ignores `standing lodging off` (pays for a tavern bed). With lodging off, it should camp where you stand or say why it can't.
   - The standing eat/cook order overrides a `sleep` command.
   - `sleep` in another site's house says "Use a regional travel order to leave this site".
   - The standing eat order drank whiskey while asleep.

### B. Social view and memory (social, play view; fair-view leaks)
1. **HIGH, fair-mode leaks on `inspect`:**
   - exact affection/respect/trust/fear breakdowns and per-memory deltas;
   - "Your opinion" numbers;
   - numbers even for absent people.

   Show only the band, phrased as an impression. On a failed read it is the (mis)read band, hedged ("hard to read; seems cool"). God view stays exact.
2. **HIGH, reasons from the wrong side.** NPC regard cites slights *they* did to the PC ("Turned me away when I asked"), their own help ("Lent me a hand unasked"), and a winner fearing the loser. Fix the memory direction in the reason projection, and in social memory itself if that is where it is wrong. Also:
   - deduplicate lines;
   - never use raw event text as a reason label ("…the brawl ends….: affection 0").
3. **Hearsay as fact.** "Remembered: X is of the hidden folk" shows up as fact before the PC was told, and on a Human-listed character. Store and present rumors as "heard that…", with the source when known. Audit this against 12's concealment rules: exposure must be emergent and fair views must not assert it.
4. **Introductions.** Overheard talk counts as "already met"; it should need a real introduction. The game also says "You notice something not quite right about Ellis Wayfarer" to the PC about themself.
5. **Small:**
   - gift refuses carried food ("a little food would do");
   - mismatched gift line;
   - the yield text addresses the PC as the accepter;
   - NPCs chat and help across buildings, and talk to a sleeping PC.

### C. Tactical brawls (M6; follow-up to the slice-2 review fixes)
1. **HIGH, tavern_brawl's opening:** the first command is lost and the brawl resolves without the player. `go`/`drink` cost an hour and don't happen; `fight X` says "is asleep" while they are awake; `tactical:resume` as the first command says "Nothing here matches".
2. **HIGH, the scene still won't let go** after flee, yield or a brawl's end. Tactical persists for hours, `go` costs an hour without moving, `wait` prints "3600s passed", `inspect` fails, and Breathe only appears after `wait 1h`. This survived the review fixes.
3. **MEDIUM, ordinary towns have no brawls.** `fight X` / `talk:fight` is an hour-long abstract roll with no injury, and `attack` doesn't exist. A fight in a normal town should open a tactical brawl scene (the M6 plan's intent); `tavern_brawl` must not be the only door. Bystanders should hear about it.
4. **Small:**
   - a parley that is "heard" but still followed by damage;
   - a cancelled attack still starts the brawl;
   - "at home, at leisure" while mid-brawl;
   - a mid-brawl `drink` message says "no spring … here".

### D. Income and economy
1. **Sunday:** work silently pays $0, and a Sunday hire buys only one paid day. Warn at hire and on `work`.
2. **Quit-then-rehire** cashes weekly pay any day with no cost. Settle weekly pay on payday; same-day rehire by the same employer is refused, or it costs opinion.
3. **Piece rates:**
   - Firewood's 3¢ rate is clamped to 1¢ by "below county retail" (retail is 2¢), so fix the data or the clamp.
   - The store had $0 cash at 06:00.
   - `prices` doesn't show bids.
   - Let goods be marked "for sale" so the eat standing order skips them.
4. **Store restock is additive and uncapped:** bacon 80 → 307, potatoes 200 → 387. Cap it at the authored stock level. This is an economy conservation issue.
5. **Hiring legibility:**
   - "no seasonal hiring business" for the smith and all four miners (mines should hire in 1855);
   - no in-world hint of who is hiring;
   - "Edwin Fenn refuses paid work: Cannot fund that term" reads backwards.
6. **The work menu:**
   - `work` is offered with no employer and burns heavy labor for nothing;
   - `work` must be retyped every hour, and `wait` cancels it: a shift should persist;
   - "Daily round: Work" still shows after quitting.
7. **Other:**
   - `activity:go_to_market` locks you out of trading at the market;
   - a failed `meal` (closed) still costs an hour, and the prompt still says the table is laid after a paid meal.

### E. Play UX, the minute budget and regional
1. **Dialogue panel:** each short act reprints the hour's *oldest* 6–10 lines, so a new chat seems to draw an old reply. Show only lines new since the last command.
2. **More short acts:** `hire`, `quit`, `drink`, `fill`, `wake` and `fetch water` each burn the rest of the hour. Make them short acts with data costs. A failed act costs nothing.
3. **"Spring at X."** reads as a water spring (two testers were misled). Rephrase the season line, e.g. "Spring has come to X."
4. **Cedar Farm water:**
   - The farm has no reachable water. Add a well or spring.
   - `fetch water` with no source should fail immediately.
   - The route preview should warn about water at the destination.
   - `travel` with "Critical vitals along the route" should require confirmation.
5. **Menus:**
   - "(1 min)" vs the actual 2–3 min walk;
   - "Collapsed [activity:incapacitated]" selectable while healthy;
   - two "Walk" entries;
   - "Attend church" missing from the menu and inconsistently matched.
6. **`wait`:** `wait until 07:00` from 20:00 stopped at 22:00; `wait until tomorrow` stopped at 14:00. Report the stop reason.
7. **Journal and weather:**
   - journal entries are out of order and one says "went to bed" at a working hour;
   - the status line says "fixed authored weather 55°F dry" while the journal and NPCs mention snow and rain.
8. **Small:**
   - `look` says "use signs" when all signs have faded;
   - a regional `route` doesn't work on the road;
   - `places` at Cedar Farm lists no destinations;
   - identical stacks aren't merged ("Which one?");
   - a duplicate arrows entry in `prices`;
   - store goods can't be inspected before buying;
   - "Conscience: It is late" at 06:00;
   - "Appetite: drink" at Thirst 900.

### Deferred (noted, not in wave 10)
- **News crossing the road:** nothing from Cedar Farm ever reached Iron Ford. This belongs to M5 slice 5 (road rumor carriers).
- **Empty roads, no encounters:** M5 slice 4 and the Director's exogenous pressures.
- **The gen:town evening:** the tavern is empty and households are asleep by 18:00–20:00, even on Saturday. Routine tuning; it pairs with C3 (a brawl needs a crowd).
- **Bacon dominates food value** (r2): still open for economy tuning.
