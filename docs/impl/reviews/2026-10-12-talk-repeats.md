# Dialogue repetition audit — wave6/talk-repeats

Thirty days from 1855-04-01, Iron Ford seed 42 and generated town seed 7. Each voiced `social.interaction` or private `belief.transmitted` event is one exchange. A repeated exchange contains at least one turn whose **listener** (the other party, excluding the speaker and witnesses) heard the exact rendered text earlier in the preceding window. Windows expire at exactly 7 or 30 days (`age < days × 1440`). A news event is attributed to its initiating interaction through its cause id. Counts cover the full streamed event log, not the rolling World log.

| World | Exchanges before → after | 7-day repeats | 30-day repeats | Social ms/h | Total ms/h | Packed save MB |
|---|---:|---:|---:|---:|---:|---:|
| iron | 6232 → 6232 | 12.21% → 4.17% | 32.72% → 14.23% | 4.912 → 7.982 | 39.72 → 47.59 | 4.361 → 4.576 |
| gen | 3551 → 3551 | 20.81% → 2.76% | 37.40% → 9.66% | 2.889 → 3.894 | 47.98 → 48.95 | 2.725 → 2.858 |

Profiled runs were serialized in an isolated baseline checkout and this worktree, with streamed logs, `--profile --save`. Total ms/h includes creation/generation; system timings isolate simulation work. The host is shared with sibling work, so these are measured samples rather than a controlled hardware benchmark.

## Mechanisms and volume

Listener hashes share the existing optional social dialogue slice (`h<actor>`); they retain 30 days and at most 1,024 hashes per actor, forgetting the oldest first under exceptional load. Only listeners receive their partner’s spoken text. Template cooldowns become preferences subordinate to avoiding already-heard rendered text. Children prefer their own content, then suitable general lines when their small pools are exhausted. Candidate alternatives get up to three deterministic renderings; unavoidable repeats prefer fewer repeated turns, then the oldest hearing. Content tagged `repeat_aware` supplies an unused listener acknowledgement after the repeated turn. No source/date claims are inferred from text hashes.

Rates remain at 300‰: chat accounts for 1.88 and 2.11 participations per resident-day (about 19–21 minutes); the other interactions include shared work, prayer, requests, and meaningful conversation. This observed small-talk volume does not justify reducing encounter rates. Exchange counts are unchanged.

## Outcome equality

The saved social slices (except dialogue histories) and entire belief slices are exactly equal before/after in both worlds. Thus all opinions, relationship labels/edges, familiarity, debt, memories, rumor evidence and courtship outcomes have 0% drift. Observed transmissions: 159/172; distinct listener–proposition pairs: 126/116; flirting attempts: 1/0. No court/proposal interactions occurred in either window. Courtship edges: Iron Ford 1 (authored), generated town 0, unchanged.

## iron: repeats by interaction

| Kind | Before exchanges | After exchanges | Before 7d | After 7d | Before 30d | After 30d |
|---|---:|---:|---:|---:|---:|---:|
| help | 1164 | 1164 | 9.02% | 0.00% | 29.30% | 3.35% |
| chat | 1128 | 1128 | 5.32% | 3.19% | 29.70% | 12.59% |
| pray_with | 814 | 814 | 11.79% | 0.00% | 37.35% | 7.49% |
| deep_talk | 587 | 587 | 1.87% | 0.00% | 16.18% | 0.00% |
| gossip | 516 | 516 | 39.34% | 22.48% | 53.88% | 40.50% |
| comfort | 357 | 357 | 14.57% | 3.08% | 38.66% | 23.53% |
| warn | 274 | 274 | 17.88% | 10.58% | 41.97% | 33.58% |
| compliment | 262 | 262 | 11.83% | 0.38% | 28.24% | 12.98% |
| tell_tale | 207 | 207 | 39.61% | 17.87% | 58.45% | 46.86% |
| repay | 141 | 141 | 10.64% | 9.22% | 34.04% | 16.31% |
| news:gossip | 129 | 129 | 7.75% | 0.00% | 13.18% | 0.00% |
| lend | 120 | 120 | 9.17% | 1.67% | 35.83% | 15.83% |
| introduce | 119 | 119 | 0.00% | 0.00% | 0.84% | 0.00% |
| preach_at | 113 | 113 | 15.93% | 6.19% | 42.48% | 33.63% |
| apologize | 62 | 62 | 14.52% | 6.45% | 51.61% | 41.94% |
| insult | 41 | 41 | 0.00% | 0.00% | 7.32% | 2.44% |
| borrow | 41 | 41 | 0.00% | 0.00% | 9.76% | 4.88% |
| news:warn | 29 | 29 | 0.00% | 0.00% | 17.24% | 0.00% |
| confess | 26 | 26 | 7.69% | 7.69% | 42.31% | 38.46% |
| gift | 18 | 18 | 0.00% | 0.00% | 22.22% | 0.00% |
| forgive | 18 | 18 | 0.00% | 0.00% | 27.78% | 5.56% |
| toast | 17 | 17 | 11.76% | 5.88% | 17.65% | 5.88% |
| confide | 13 | 13 | 0.00% | 0.00% | 38.46% | 38.46% |
| dun | 12 | 12 | 8.33% | 8.33% | 25.00% | 16.67% |
| slight | 12 | 12 | 8.33% | 0.00% | 16.67% | 0.00% |
| mock | 7 | 7 | 28.57% | 0.00% | 42.86% | 14.29% |
| fight | 3 | 3 | 33.33% | 0.00% | 33.33% | 0.00% |
| news:confide | 1 | 1 | 0.00% | 0.00% | 0.00% | 0.00% |
| flirt | 1 | 1 | 0.00% | 0.00% | 0.00% | 0.00% |

### Before: most repeated exact lines

| Text | Uses | Repeated hearings (30d) |
|---|---:|---:|
| That's a shame. I'd a taste for something. | 29 | 16 |
| If I knew anything, I'd tell it. | 29 | 15 |
| Nothing new. Only the same old talk, and I'm tired of the sound of it. | 24 | 15 |
| Tell them I'm paying. | 28 | 15 |
| There's always a strange feeling about. I take it for the weather. | 30 | 15 |
| You'd tell it even if you didn't. | 29 | 15 |
| A dry week for talk. | 27 | 14 |
| And a wet one for everything else. | 27 | 14 |
| Everything I know, you know. We've used it up. | 24 | 14 |
| I'd tell you the news if there were any. | 25 | 14 |
| I'd tell you, but I've forgotten what it was. | 26 | 14 |
| I've heard nothing but the stove. | 27 | 14 |
| My sources have gone quiet. | 28 | 14 |
| Then spare me it, and we'll talk of the weather. | 24 | 14 |
| And you on yours. | 27 | 13 |
| Convenient. Let me know when it returns. | 26 | 13 |
| I do. It's the others I can't watch. | 24 | 13 |
| No news is good news, they say. | 25 | 13 |
| No. We never did. Sit by me. | 27 | 13 |
| Quiet's no bad thing. | 27 | 13 |

### After: most repeated exact lines

| Text | Uses | Repeated hearings (30d) |
|---|---:|---:|
| That's a shame. I'd a taste for something. | 29 | 16 |
| Everything I know, you know. We've used it up. | 24 | 14 |
| Then the walls are asleep. | 28 | 14 |
| Quiet's no bad thing. | 28 | 13 |
| Then we'll fill it with the weather. | 26 | 13 |
| Nothing new. Only the same old talk, and I'm tired of the sound of it. | 22 | 12 |
| Then the rumors are still up. | 26 | 12 |
| A dry week for talk. | 25 | 11 |
| And a wet one for everything else. | 25 | 11 |
| I haven't a scrap. My ear's been shut. | 24 | 11 |
| I've heard nothing but the stove. | 26 | 11 |
| Nor I. I'll go back to molasses. | 21 | 11 |
| Then I'll buy two and hide one. | 21 | 11 |
| I do. It's the others I can't watch. | 24 | 10 |
| I don't believe you've said why yet. | 17 | 10 |
| I'd tell you, but I've forgotten what it was. | 23 | 10 |
| If I knew anything, I'd tell it. | 24 | 10 |
| My sources have gone quiet. | 24 | 10 |
| Open it a little. Something will fall in. | 23 | 10 |
| There's gold in these hills, I tell you. A man I met had a handful of it. | 18 | 10 |

Packed-save increase: 215,425 bytes (4.94%); peak retained listener hashes: 696.

## gen: repeats by interaction

| Kind | Before exchanges | After exchanges | Before 7d | After 7d | Before 30d | After 30d |
|---|---:|---:|---:|---:|---:|---:|
| chat | 761 | 761 | 19.32% | 0.00% | 36.01% | 3.29% |
| help | 641 | 641 | 31.83% | 0.00% | 45.71% | 0.16% |
| deep_talk | 519 | 519 | 6.55% | 0.39% | 27.94% | 6.55% |
| gossip | 400 | 400 | 23.50% | 3.00% | 47.75% | 27.75% |
| warn | 262 | 262 | 30.53% | 26.34% | 50.38% | 41.98% |
| comfort | 204 | 204 | 13.73% | 1.47% | 33.82% | 11.27% |
| pray_with | 196 | 196 | 47.45% | 0.00% | 54.08% | 0.00% |
| news:gossip | 123 | 123 | 6.50% | 0.00% | 13.01% | 0.00% |
| introduce | 85 | 85 | 4.71% | 0.00% | 10.59% | 0.00% |
| compliment | 80 | 80 | 3.75% | 0.00% | 18.75% | 0.00% |
| news:warn | 49 | 49 | 6.12% | 0.00% | 10.20% | 0.00% |
| repay | 36 | 36 | 13.89% | 5.56% | 22.22% | 11.11% |
| insult | 34 | 34 | 26.47% | 0.00% | 38.24% | 5.88% |
| lend | 31 | 31 | 6.45% | 0.00% | 22.58% | 3.23% |
| slight | 25 | 25 | 44.00% | 0.00% | 52.00% | 24.00% |
| apologize | 21 | 21 | 4.76% | 4.76% | 42.86% | 33.33% |
| confide | 21 | 21 | 33.33% | 28.57% | 57.14% | 57.14% |
| preach_at | 16 | 16 | 6.25% | 0.00% | 12.50% | 0.00% |
| mock | 13 | 13 | 7.69% | 0.00% | 15.38% | 7.69% |
| borrow | 12 | 12 | 0.00% | 0.00% | 8.33% | 0.00% |
| confess | 12 | 12 | 33.33% | 25.00% | 50.00% | 50.00% |
| forgive | 3 | 3 | 0.00% | 0.00% | 0.00% | 0.00% |
| fight | 2 | 2 | 0.00% | 0.00% | 0.00% | 0.00% |
| snub | 2 | 2 | 0.00% | 0.00% | 0.00% | 0.00% |
| gift | 2 | 2 | 0.00% | 0.00% | 0.00% | 0.00% |
| dun | 1 | 1 | 0.00% | 0.00% | 0.00% | 0.00% |

### Before: most repeated exact lines

| Text | Uses | Repeated hearings (30d) |
|---|---:|---:|
| I nearly had it. | 119 | 109 |
| Here, Peran, let me show you how. | 37 | 36 |
| Fold your hands, then. | 36 | 33 |
| And the horse, and the hens. Amen. | 34 | 31 |
| Please. Three armloads, and don't drop them on the cat. | 33 | 29 |
| Both hands. And don't run. | 32 | 28 |
| So you are. Mind the step. | 31 | 27 |
| Are you minding your lessons? | 27 | 23 |
| Here, Elijah, let me show you how. | 24 | 23 |
| Here, Lars, let me show you how. | 24 | 23 |
| God bless Mama and Papa and the cow. | 34 | 19 |
| Have you done your chores, Peran? | 19 | 18 |
| Here, Bartholomew, let me show you how. | 19 | 18 |
| Look how you've grown, Peran. You'll be taller than me by harvest. | 18 | 17 |
| Mostly. I know my sums, and nearly all my spelling. | 27 | 17 |
| I pray the Lord my soul to keep. | 26 | 16 |
| Minding your elders, Peran? | 17 | 16 |
| Wishes are always welcome. | 26 | 16 |
| Almost. I did the hens, and the cow did the rest. | 21 | 15 |
| Here, Agnes, let me show you how. | 15 | 14 |

### After: most repeated exact lines

| Text | Uses | Repeated hearings (30d) |
|---|---:|---:|
| Watch your step. | 24 | 12 |
| I do. It's the others I can't watch. | 22 | 11 |
| I've little else to keep. | 20 | 11 |
| It's not a warning, only a wish: be careful. | 23 | 11 |
| There's always a strange feeling about. I take it for the weather. | 24 | 11 |
| And you on yours. | 18 | 9 |
| I do both. It's the second that's hard. | 20 | 9 |
| Keep your wits about you this week. | 20 | 9 |
| Wishes are always welcome. | 20 | 9 |
| Then we'll fill it with the weather. | 20 | 7 |
| Mind how you go, Loveday. These are uneasy times. | 7 | 6 |
| Then spare me it, and we'll talk of the weather. | 18 | 6 |
| And a wet one for everything else. | 16 | 5 |
| I always do. I'm obliged. | 9 | 5 |
| I always do. Thank 'ee kindly. | 10 | 5 |
| The stove tells no tales. | 19 | 5 |
| Then it's the weather again. | 16 | 5 |
| Then the walls are asleep. | 21 | 5 |
| Every winter. Never in spring. | 8 | 4 |
| I haven't a scrap. My ear's been shut. | 20 | 4 |

Packed-save increase: 133,670 bytes (4.91%); peak retained listener hashes: 569.

## Files

- `packages/core/src/social/talk.ts`: listener selection and retention.
- `packages/core/src/social/state.ts`: existing dialogue-slice documentation only (scope exception).
- `packages/content/src/schema/social.ts`: additive optional line tags (scope exception needed for content-tagged replies).
- `content/base/social/talk-repeats.toml`: six repeat-aware responses.
- `packages/cli/test/talk-listener.test.ts`: memory, cooldown precedence, replies, expiry, cap, save/reload, and legacy initialization.
- `packages/cli/test/talk-repeats.test.ts`: 30-day repeat budget for both worlds.
- `runs/scratch/talk-audit.ts`, `talk-compare.ts`, `talk-benchmark.py`: reproducible audit/measurement scripts (gitignored).

No commits. Golden chronicle unchanged.

## Validation

`VITEST_MAX_WORKERS=2 just check` passed: 69 test files, 739 tests, typechecks, Biome, invariants (207 files), and content validation (101 files). All 11 new focused tests also passed. Both 30-day audit targets and exact social/belief state equality checks passed. Golden chronicles are identical before/after in both worlds. No commits.
