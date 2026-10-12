# Playtest triage: 2026-10-11 persona wave

**Build:** `ca48292` (integrated town slice + worldgen + headless play), played before the review fixes landed.
**Sessions:** 8 personas × 2 worlds (Iron Ford seed 42; generated town seed 7), FAIR mode, via `coulee play --session`. Reports are in `playtests/2026-10-11-*/report.md`.

| Persona | Pool / model |
|---|---|
| Greenhorn | Claude Haiku |
| Catalog kid | Codex gpt-6.1-sol |
| Socialite | Claude Opus |
| Explorer | Claude Sonnet |
| Edge-case QA | Claude Sonnet |
| Pocket | Codex gpt-6-luna |

The Codex "exploit hunter" runs were blocked by OpenAI's cybersecurity classifier; the persona was renamed and rerun on Claude.

**Determinism held in every session:** `--verify` passed and forks matched. No FAIR-mode leak of a concealed shadow-faekin was found.

Findings are ranked by how many personas hit them and how much they hurt the "keep playing" pull (P5).

## Tier 1: blocks the loop (fix next)

| # | Finding | Who hit it | Owner |
|---|---|---|---|
| 1 | **Waits don't skip time.** `wait 1d` / `wait until 07:00` stop every 1–3 h on NPC-to-NPC `social.interaction`. One overnight wait took about 8 commands. | all 8 | play interrupts |
| 2 | **The PC acts on its own.** It insults ("I made sport of Amos Whitcomb"), gifts food, cooks, and buys (household auto-shopping spends the PC's purse: "Bought 12 flour for $0.60" during `wait`). A Court order turned into a Mock. Players can't tell what they control. | greenhorn ×2, socialite ×2, pocket, edgeqa | psyche PC policy + provisions household AI (08 Q05) |
| 3 | **Social verbs return no content.** Chat, gossip, "ask about the news", confide and court report only `success`; gossip never surfaces a rumor's text. The journal later tells the story beautifully, but the moment itself is empty. | socialite ×2, explorer ×2, greenhorn | social + belief + play observation |
| 4 | **Social commands fail with a false reason and cost an hour.** "The other person may have left" appears for ~20 of 43 attempts, but the real causes are: target asleep, target working, a cooldown or eligibility rule, or the target left. The menu offers impossible targets (Introduce at midnight). | socialite ×2, explorer ×2, edgeqa | social availability API + play menus |
| 5 | **Money is illegible.** Purse vs household cash split; wages go to a hidden household box (`Purse $0.00` still buys pork); unexplained drops ($7.82 overnight, $1.05 on day 1); tavern bed/meals ~$1.15/day silently. | greenhorn ×2, explorer, edgeqa ×2 | provisions + play observation |
| 6 | **Camping is impossible.** Sleep or wait on the ridge returns the PC to paid tavern lodging, so no expedition can be sustained. | catalog kid ×2 | activity + provisions |

## Tier 2: P8 crunch and economy (the catalog promise)

Some of these overlap the crunch review; check `fix/crunch` before re-fixing.

- **No outfitting pressure.** $1.28 of food buys a 15.7-day forecast. Parched corn yields 42,500 kcal/$, cornmeal costs 1.9–3.7¢ a day against a 75¢ wage, and food is never a constraint.
  - In 1855 food *was* cheap relative to wages. The pressure should come from weight, bulk, fuel, water, spoilage, nutrition/scurvy and gear, not price.
  - **The outfitter sells no camping gear.** Stock the 03 catalog.
- **The economy has no sinks.** Saturday wages are minted with no payer, and the money supply grew 5.3× in 60 days. Generated-town stores have no restock and run out by day 60. There is a mill→Pratt's arbitrage and a zero buy/sell spread (a blanket sold back for its full $3).
- **The Kit Sheet lacks per-food information.** No nutrition, prep requirements, container capacities, or forecast assumptions. One 533-kcal meal dropped the usable-energy forecast by 6,619 kcal with no explanation.
- **Physical accounting is wrong.**
  - A knapsack nests inside a full canteen.
  - A canteen with 1,900 ml of water accepts a pound of cheese.
  - Partly eaten food keeps its weight.
  - 382 kg ("Staggering") has no effect.
- **Auto-prep fails silently** with 15 days of food on hand: `provisions.prep_failed "Cannot prepare food: 0 ()"` is never shown to the player.
- **False famine at t=0 for a lone PC.** The pack isn't counted in the household pantry, so the ration is cut to 50% and the journal writes "the children no longer ask" for a man with no children.
- **Activities have no output.** Fish, forage, chop wood, ferry, mill and call-on-kin produce nothing; fishing and foraging hop between places each hour. There is no production system yet: no harvest, garden, fishing or forage.

## Tier 3: world texture and legibility

- **The world is thin:** `look` has no place description, `inspect` returns bare JSON, and the store shows no price list. The five "Kitchen garden and stubble" places are indistinguishable.
- **Nothing fae in 8 days.** Huldra's Shelf, the Cold Stair and the coulees are empty. The fae layer, the setting's core pillar, isn't in the sim yet.
- **The Go menu lists only about 4 places**, though others work when typed. Every move takes exactly 1 h, and walking the whole map is about 21 h.
- **Opinion totals don't match their listed reasons** (Elijah Carter: −3 with reasons +3, +3, +3; base and volatile components aren't shown).
- **Journal grammar for the PC:** "Me paid Michael Dunleavy…", "I and Lucius Vance made their peace". Duplicate entries.
- **The phone view repeats unchanged text:** status and menu lines repeat every call, and players want a "since last look" summary.

## Tier 4: robustness

- `-1` as a menu number crashes the CLI (CACError stack trace).
- `wait until <anything>` is accepted as an event name; `wait until 7:30` is silently accepted.
- The session-mode `help` lists `save`, `load`, `fork` and `quit`, which don't work in session mode.
- Errors for buy quantities of 0, negative, or more than stock are inconsistent.

## Strengths to protect

- The **journal**: "I am learning to let a gift be a gift."; "I had every reason for it… They read better each time."
- The **inner voices**: "Not one glass. You know where one glass goes."
- The NPC web and weekly rhythms (Sabbath, market day).
- Deterministic replay and forks, which make every bug report reproducible.

## Decisions surfaced for Ellie

- **PC agency (08 Q05).** Playtesters were confused by the PC acting on its own. Recommendation, matching 10's Rec (b):
  - the PC executes only commands plus routine *standing orders* (sleep at night, eat from own pack when hungry, keep warm);
  - other urges stay advisory (thoughts with anxiety costs);
  - consequential autonomous acts (spending, hostility, gifts) become prompts or interrupts, not actions.
  - This is implemented through Commands, so P2 holds.
- **Where P8 pressure comes from.** Recommendation: keep period-plausible cheap staples. Make the pressure weight, bulk, fuel, water, spoilage, nutrition and gear, plus wilderness trips where you can't buy.
- **Fae layer timing.** It's the biggest missing pillar for the "keep playing" pull. A first slice could add ambient fae signs keyed to the fae intensity field (omens, lights, lost time) plus place descriptions, before the full Faerie/Prince systems.
