# 11 — Interface & Platforms

**Status:** First draft, 2026-10-10. This doc owns the **pocket (phone) and desktop interfaces**, touch and keyboard controls, platform packaging, client performance budgets, and the **visual style guide** (09 gap #12). It resolves the UI half of **C2** (every screen gets a pocket variant here) and proposes the platform answer to **C9** (§5.6).

**Reads from (does not redefine):**
- `00` P1 (legibility gated by character knowledge), P6 (pocket), P7 (psyche), P8 (crunch you can pack).
- `adr/0001`: PWA, React DOM panels, three.js, sim in a Web Worker, integer game-minutes, 1× ≈ 40 real s per game-hour, Explain records.
- `03` §2 (Book, Kit Sheet, Flat-Lay, Readiness) and the P8 item fields, which `03` owns (C48).
- `04` §12 (dossier, rumor ledger, notifications) and the persecution rungs in §9, which `04` owns (C41).
- `05`: §1.5 (map knowledge), §4 (calendar), §6 (burn rates and physiology, which `05` owns), §11 (Chronicle voices).
- `06`: §3 (curses, Woe, Drift, and witch weaknesses, which `06` owns, C27), §7 (creation flow), §8 (difficulty, saves, accessibility).
- `10-psyche` owns the Mind structure: Id/Superego/Ego, anxiety, defenses, Persona/Shadow, archetypes, dreams. This doc only lays it out on screen. `10` hadn't landed when I wrote this, so its labels here are placeholders.

**Tags:** **[DECISION]** comes from `00`, the ADR, or Ellie. **[PROPOSAL]** is mine. **[OPEN]** needs Ellie. "Lead call" marks the editorial ownership calls recorded in `09`.

---

## 0. Summary

1. **Three layouts, one game.** **[DECISION]** (P6): phones and desktop are equal targets. **[PROPOSAL]** The layouts are *Pocket* (< 600 px wide, portrait-first), *Folio* (600–1023 px: tablets, landscape phones, Steam Deck), and *Desk* (≥ 1024 px). They share one component library. Only the arrangement changes, never the rules or the information.
2. **The interface never computes rules.** Every number on screen (odds, days of food, spoilage order, load penalties) is a **query to the core in the worker** and comes back with an Explain record. The UI formats it. It doesn't recompute it. That keeps P1 honest and keeps phone and desktop in agreement.
3. **Sim budgets that change outcomes are the same on every platform.** Tier caps, T1 radius, and World size never vary by device, because that would break determinism, share-a-seed, and cross-device saves. A slower device runs the *same* sim *slower*: a speed governor lowers the effective speed and shows it. Phones get a smaller county only if the player picks a smaller **World size** at creation, and that size is recorded in the World (§5.6).
4. **On a phone, sheet height sets the time policy.** A peek sheet leaves the sim running. A half sheet clamps it to reading speed. A full sheet pauses it. You can read while the world moves, and the clock glyph always shows which policy is in force (§1.6).
5. **Combat drops to Tactical (1 game-second per real second)** when hostility begins, then pauses and lets you plan. The T0 sub-minute clock (lead call, C21) is what makes `02`'s timed actions followable on a phone.
6. **Ink-and-paper UI over a muted low-poly world, with one reserved hue family for Faerie.** No state is shown by color alone (§7).
7. **Platform:** an installable PWA first. Saves are snapshots plus a journaled command log in OPFS, with an IndexedDB index. Export/import files come first, then optional sync. Capacitor and Tauri are later wrappers. Each has one sharp caveat: iOS storage eviction for Capacitor, Linux WebKitGTK for Tauri (§4).

---

## 1. Design principles

### 1.1 Three layouts

**[PROPOSAL]**

| Layout | Width | Typical device | Shape |
|---|---|---|---|
| **Pocket** | < 600 px (design width 390) | Phone, portrait | Map, a bottom action rail, and **bottom sheets**. One panel at a time. |
| **Folio** | 600–1023 px | Tablet, phone in landscape, Steam Deck (1280×800 at 1.25×) | Map plus one docked side panel. Sheets become side drawers. The Book shows a two-page spread. |
| **Desk** | ≥ 1024 px | Laptop, desktop | RimWorld-dense: map plus docked inspector, dispatches, Chronicle feed, and pop-out panels (§3). |

- The layout is chosen by viewport, not by device sniffing. Rotating a phone moves it from Pocket to Folio live, without losing state.
- Input is chosen separately from layout. A touchscreen laptop at Desk width still gets touch affordances, so hover is never the only path to anything (§3.3).

### 1.2 Thumb zones and one-handed play

```
 ┌──────────────────────┐
 │ ✗ hard     ✗ hard    │  status strip: read it, don't tap it
 │ ~ stretch            │
 │ ~ stretch  ~ stretch │  map: gestures work anywhere
 │ ✓ easy     ✓ easy    │
 │ ✓ easy  ✓ easy  ✓ ✓  │  rail, sheet content, primary actions
 └──────────────────────┘
   (mirrored when the Handedness setting is Left)
```

**[PROPOSAL] Rules:**
- **Primary actions live in the bottom 40%**, the action rail and the lower half of sheets. The top strip is **glance-only**. Anything there that can be tapped also has a path from the rail.
- **Targets:** at least 48×48 CSS px, 56 px for combat and time controls, and 8 px between destructive and benign buttons. No swipe triggers anything irreversible.
- **The whole game is playable with one thumb.** Pinch-zoom has one-thumb substitutes: double-tap-and-drag to zoom (the Maps convention) and +/− buttons in the map's Settings. Two-handed gestures are only shortcuts.
- **Edges are hostile.** Keep drag gestures off the bottom 24 px (the home indicator) and the left and right 16 px (back-swipe). Respect `env(safe-area-inset-*)`. Canvas gets `touch-action: none` and panels get `manipulation`. Set `overscroll-behavior: none` to kill pull-to-refresh.

### 1.3 Short sessions (2–10 minutes) and interruptibility

- **[DECISION]** (ADR) The sim runs in a worker and is deterministic. **[PROPOSAL]** It **never runs while the app is hidden**. On `visibilitychange` it pauses and flushes the journal. There's no background simulation and no push notifications. The world waits for you, which is the honest consequence of determinism and also good for battery and attention.
- **Resume card.** On return the game shows one card: where you are, what you were doing, the last 3 Journal lines, open threads, and any vital warnings ("Food: 1 day"). Tapping it dismisses it. There's no recap of things the character doesn't know.
- **Natural stopping points.** The game marks them quietly ("A good place to stop": arrival in town, camp made, nightfall, a sale completed). Sleep, Wait, and Travel are the session-sized verbs. At 1×, a 10-minute session is about 15 game-hours, so a 1–10 day expedition (`06` §2.4) spans roughly 3–12 sessions.
- **Kill-safety.** Every command is appended to the journal before its effects are shown (§4.3). A force-quit loses at most the unacknowledged animation. It doesn't lose a decision, and in Commitment mode it can't undo one.

### 1.4 Glanceable state

**[PROPOSAL]** The **status strip** has two lines, 56 px tall in total:

```
 Thu 12 Apr '55  4:10p ☼ 48°F  ▶3×
 ◔Food 6d  ◑Warm  ◕Rest  ✚1  $4.15
```

- **Line 1** shows the date, local solar time (`05` §4.2), a sun or moon glyph (the moon shows its phase), temperature *as the character feels it*, and the **clock glyph** (§1.6).
- **Line 2** holds up to **five vitals pips**. Each pip is a glyph plus a word or number, and its fill is redundant with the text. Defaults:
  - **Adventurer:** Food-days (P8), Warmth, Rest, Wounds, money.
  - **Witch:** Food-days, Warmth, Wounds, Woe, Drift, with the Tithe countdown as a sub-label of Woe.
- The player can pick the five, and tapping a pip opens its panel.
- A pip in a bad band gets the **rubric** treatment, the period red ink of §7.3, *and* a shape change, so color is never the only signal.

### 1.5 The legibility ladder

A 390 px screen can't show a RimWorld inspector, so every fact climbs a fixed **four-rung ladder**. The player decides how high to climb.

| Rung | Form | Example | Gesture |
|---|---|---|---|
| 1. **Glyph/label** | Icon plus one word | `◑ Chilled` | Always visible |
| 2. **Band** | Period wording plus a band bar | "Chilled: your coat is damp" | Tap |
| 3. **Number** | The value, its cause, and its trend | "Comfort floor 41°F; feels 36°F; wool coat 60% wet" | Tap again, or the row expands |
| 4. **Explain** | The full Explain record: inputs, terms, roll, DC, outcome | Ledger-style sum (below) | "Show the math" |

**[DECISION]** (P1, ADR invariant 5) Each rung is gated by the viewer's knowledge. The code's `Explain.knowledge` (`public | participants | self | omniscient`) decides whether rung 4 exists for the viewer at all. Rungs 2–3 for *other* actors are also gated by checks, following `04` §12.1: bands by default, and numbers ±10 after Read People. When a rung is gated, it shows *why* ("You'd need to read her better: Read People vs. her Deceive"). It never just hides.

The **Explain sheet** has the same layout everywhere:

```
 ┌ Woodcraft: start a fire in rain ──┐
 │ d20                         9    │
 │ Woodcraft ranks            +4    │
 │ Wisdom                     +1    │
 │ Fatwood (dry tinder)       +2    │
 │ ─────────────────────────────    │
 │ Total                      16    │
 │ vs DC  base 10, rain +5    15    │
 │ ✓ Success by 1                   │
 └──────────────────────────────────┘
```

### 1.6 Real-time-with-pause on a phone

**Speeds** **[DECISION]** use the ADR's 1× ≈ 40 real s per game-hour, which supersedes `05` §4.1's table (C21). The **[PROPOSAL]** speed ladder:

| Speed | Game time per real second | One game-hour takes | Notes |
|---|---|---|---|
| **Tactical** | 1 game-second | 60 min | T0 sub-minute clock. Automatic in combat. Can be chosen any time. |
| Tactical ½ | 0.5 game-second | — | Accessibility (`06` §8.3, "slower than 1×") |
| **1×** | 90 game-seconds | 40 s | The default. |
| **3×** | 4.5 game-minutes | ~13 s | |
| **6×** | 9 game-minutes | ~6.7 s | |
| **Ultra** | Whatever the device can do | ≤ 0.6 s target | Only during Sleep/Wait/Craft/Travel with no threat perceived (`05`). |

**Clock (lead call, C21).** The canonical cross-tier clock is integer game-minutes. T0 runs a sub-minute clock (game-seconds within the current minute) for movement and combat. The strip shows `4:10p` normally and `4:10:23p` in Tactical. **[OPEN for `02`/`07`]** `02` §7.2's initiative steps are 0.1 s. If they stay, the T0 sub-clock needs deciseconds. The UI handles either.

**The clock glyph** is a single symbol that always shows the current time policy:

| Glyph | Meaning |
|---|---|
| `▶3×` | Running at the chosen speed |
| `▶1×·` | Running, clamped to reading speed by a sheet (the dot means "clamped") |
| `❚❚` | Paused by you |
| `❚❚!` | Auto-paused by an event. Tap to see why. |
| `▶6×→4×` | The governor has throttled the speed (§5.1). The second number is the effective speed. |

**Controls** **[PROPOSAL]**: the big ❚❚/▶ button sits at the rail's thumb-side end. Press-and-hold it to open a **speed arc** (Tactical · 1× · 3× · 6× · Ultra) and drag along the arc to choose. Tapping the clock glyph in the strip toggles pause, as a convenience for two-handed play.

**Sheet height sets the time policy** **[PROPOSAL]**. On a phone you can't watch the map and read a dossier at once. So the gesture that hides the map also slows the world:

| Sheet state | Map visible | Default policy |
|---|---|---|
| Closed | All | The chosen speed |
| **Peek** (≈ 96 px) | ~85% | The chosen speed |
| **Half** | ~50% | Clamped to **reading speed** (1× by default; can be set to Tactical or Pause) |
| **Full** | None | **Pause**, unless the sheet is pinned with "Keep running" (a pin glyph in its header) |

Auto-pause stays armed in every state. A pinned full sheet makes a good "watch the Chronicle scroll while I wait out the rain" mode.

**Auto-pause and alerts** **[PROPOSAL]**. Every event the PC *perceives or learns* (never off-screen truth; `04` §12.6) gets an integer **alert score** from 0 to 1000. The score is computed in the worker shell from `05`'s event `importance`, not in core:

```
score = clamp(0, 1000,
          importance_permille
        + 250·[PC is a participant] + 150·[a pinned/kin/companion actor is]
        + 100·[first time PC learns this prop] + category_bias)
≥ 700 → pause + dispatch      400–699 → dispatch (toast)      < 400 → Journal/log only
```

Category overrides (Desk uses the same defaults; every cell can be changed in Settings):

| Category | Default | Examples |
|---|---|---|
| **Danger** | Always pause | Hostile intent declared, ambush, PC wounded, a fall, drowning risk |
| **Summons** | Always pause | Someone addresses the PC; an accusation against the PC (`04` rung 2+) |
| **Vitals** | Pause on crossing into a worse band | Hunger → Hungry, Chilled → Hypothermic |
| **Provisions (P8)** | Pause below 1 day of food or fuel; otherwise dispatch | "The trout will turn by morning"; "Last caps: 3 shots" |
| **Learned** | Dispatch | A new rumor about you, a price change, a trace noticed |
| **Gear** | Dispatch, or pause if it's in hand during Danger | Rope fraying, powder damp, lantern dry |
| **Weather** | Dispatch, or pause if dangerous | Front coming in, creek rising |
| **Fae** | Dispatch, or pause at FI ≥ 3 | Path warping, a ring, music |
| **Witch** | Dispatch, or pause within 1 day of the Tithe | Behest, Tithe due, a cover blown |
| **Arrival / done** | Pause | Travel arrival; a craft or long action finished |

- **Interrupt budget.** After 3 auto-pauses within 30 real seconds, further non-Danger pauses are **coalesced** into a single "3 things need you" pause. That prevents alert fatigue in towns.
- **"Pause when my action ends"** is a separate toggle. It's on by default in Pocket combat, and it's the closest thing to a turn-based safety net (§2.11).

### 1.7 The UI asks; the core answers

**[PROPOSAL] Architecture rule for `apps/web`:**
- **Commands** go UI → worker. They're appended to the journal (§4.3) and stamped with the tick they apply to.
- **Snapshots** go worker → UI, as view models (plain data) at ≤ 10 Hz. Positions travel separately at the render rate (§5.4).
- **Queries** go UI → worker → UI and are pure: `odds(interaction)`, `planProvisions(actor, policy, horizon)`, `loadConsequences(kit)`, `readiness(kit, viewer)`, `curseForecast(plan)`. Each returns values plus an Explain record, filtered by viewer knowledge.
- **Why:** if the UI recomputed rules, it could disagree with the sim. A P8 planner that says "6 days" when the sim then delivers 5 is a broken promise. Queries debounce at 100 ms during slider drags.
- The renderer (camera easing, interpolation, shaders) may use transcendental `Math`. It's outside `packages/core`, and **nothing it computes is allowed to flow back into a command**.

---

## 2. Pocket, screen by screen

Wireframes are drawn at about 36 characters ≈ 390 px. `▸` means drill in, `[ ]` is a button, `━━━` is a sheet grabber, and `▨` is hatched, gated information.

### 2.1 The shell

```
┌────────────────────────────────────┐
│ Thu 12 Apr '55  4:10p ☼ 48°F  ▶3×  │ status (glance)
│ ◔Food 6d ◑Warm ◕Rest ✚1  $4.15     │
├────────────────────────────────────┤
│                         ⌂ Pratt's  │
│      ·   ☗          ⟡ G. Pratt     │
│              ◉ Ada   ⟨Dun ▸ $4⟩    │ speech label (04 §11.1)
│   ⛬                                │
│            ⟡ Mrs. Haas             │
│                                    │
│ ┌──────────────────────────────┐   │
│ │✉ You overhear: Mrs. Haas says│   │ dispatch toast
│ │  you soured her milk.   [▸]  │   │ (belief-gated)
│ └──────────────────────────────┘   │
├────────────────────────────────────┤
│ [Go] [Act] [Pack] [Ledger] [ ❚❚ ]  │ action rail
└────────────────────────────────────┘
```

- **Go:** move orders, travel, Wait/Sleep.
- **Act:** a context menu for the current selection, or a list of nearby affordances.
- **Pack:** inventory, Kit Sheet, provisions.
- **Ledger:** the hub for everything that's *read*: Chronicle, rumor ledger, people known, map knowledge, money and debts, and (for witches) Woe.
- **❚❚:** time.
- The map has no overflow "More" menu. Settings sit at the top of the Ledger.

### 2.2 Map view and camera gestures

The camera is three.js, orthographic, top-down-ish (ADR). It has **two tilt presets**: a 55° "survey" view and an 80° "plan" view. There's no free tilt, because free tilt is a gesture that phones get wrong.

| Gesture | Effect |
|---|---|
| One-finger drag | Pan |
| Pinch, or double-tap-and-drag | Zoom, across 3 named stops: Field (one tile ≈ 28 px), Yard, Site |
| Two-finger twist | Rotate, snapping to 45° steps |
| Two-finger vertical drag | Toggle between the two tilt presets |
| Tap | **Select or inspect.** It never issues a move. |
| Tap ground while the PC is selected | Places a **ghost path** with its time and route risks. Tap **Go** or the ghost's end to confirm. **[OPTION]** an experienced-player setting "Tap to move" confirms in one tap. |
| Long-press (350 ms; adjustable) | **Inspect card** (§3.3) plus a radial of contextual actions |
| Long-press and drag | **Loupe**: a 2× magnifier above the thumb for tile-precise placement (cover, traps, salt lines) |
| Double-tap | Center on the target. A second double-tap sets **Follow**. |

- **Hit slop.** Every actor and item gets at least a 44 px hit area. When areas overlap, a tap opens a **stack chooser**, a vertical list of what's under your finger. You never get a mis-select lottery.
- **Overlays**, one at a time, chosen from a small chip row above the rail: Fae intensity, Light, Temperature, Iron presence (`03` IP), Sound, Suspicion. **Suspicion is the PC's beliefs only.** The full heat map belongs to the God view. Every overlay pairs color with pattern (§7.4).
- **Labels declutter by priority:** selected, then hostile, then speaking, then known by name, then everything else. Speech labels (`04` §11.1) are tappable and open the interaction record.
- **Surroundings list.** A rail button (and the screen-reader entry point, §6) lists nearby actors, items, and exits by distance and compass direction ("Mrs. Haas, 6 yd NE, gossiping"). On a busy market day it's often faster than the map.

### 2.3 Selection and the dossier sheet

Selecting an actor opens the **dossier** (`04` §12.1) as a bottom sheet with three detents.

**Peek:**
```
├━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤
│ Gussie Pratt   Pratt & Daughter    │
│ Of you: Warm ▮▮▮▮▯   minding store │
│ [Talk] [Trade] [Look] [▴ more]     │
└────────────────────────────────────┘
```

**Half / Full,** with tabs: **Mind · Body · Of you · Known · Pack**.

**Mind, for the PC** (P7; `10` owns content and labels):
```
│ MIND — Ada Kessler                  │
│ Self-command ⚖ 62   Unease ▮▮▮▯▯   │
│ ── Appetite ◖      ◗ Conscience ── │
│ ◖ "Eat the dried apples   │         │
│    now. Who'd know?"  +12 │         │
│           │ "Henry's share. You  ◗ │
│           │  promised Mother." +18 │
│      ⚖ You held to Conscience       │
│        (margin 6 · Show the math)  │
│ ◖ "Whiskey, for the cold." +7       │
│ ✒ Rationalized yesterday:           │
│   "It's medicinal."                 │
│ ── The face and the hidden ──────  │
│ Persona: the Schoolmistress   ▸    │
│ Shadow:  ▨▨▨ unseen           ▸    │
│ Last dream: The Drowned Bell  ▸    │
└────────────────────────────────────┘
```

**[PROPOSAL] Layout rules for the Mind tab:**
- **The voice is shown by alignment *and* glyph.** Id thoughts are left-aligned with ◖. Superego thoughts are right-aligned with ◗, like the two speakers in a chat thread. Ego arbitrations are centered with ⚖. Color tint (warm ink vs. cool ink) is a third, redundant cue.
- Each thought shows its **urge** (what it would have you do), its **intensity**, and its decay. Tapping a thought gives its reason (the code's Thought `reason` Explain).
- **Ego arbitrations** appear as centered verdict lines. "Show the math" opens the arbitration Explain (knowledge `self`).
- **Defenses** look like marginalia stamped in the ledger (✒). They're events, so they also appear in the Journal.
- **Persona/Shadow.** The Persona is the PC's chosen public face. It's editable at creation, and it shows how others are likely to read her.
  - The **Shadow is hatched by default**: the PC doesn't own those traits, so the player doesn't see them listed (P1).
  - Shadow traits reveal themselves one at a time through dreams, projections the player notices ("You keep accusing others of greed"), or a confidant's Deep Talk.
  - **[OPEN for `10`]** Is it OK that the player can be ignorant of their own character's Shadow? I think it's the most interesting P1 consequence of P7.
- **Dreams** arrive as a card on waking. The card is styled inverted, cream ink on dark paper, and it's filed in the Journal. Pausing on a dream is optional and off by default.

**Mind, for an NPC.** The PC can't hear other people's thoughts. The tab is retitled **"What you read in her"** and lists *inferences*: "She wants to be rid of you" (Read People success, *you're fairly sure*), "Something shames her about the store's books" (*a guess*). Each inference has a credence word and a source. Ego strength, anxiety, and defenses are visible only as inferred bands. Full NPC minds are reserved for the post-run epilogue and the God view.

**Labels** **[OPEN, Ellie/`10`]**: P7 suggests period-flavored labels. There are three candidate sets. The player can switch between them, and the other two sets appear in the Explain:

| Agency | Clinical | Mental philosophy (≈1855) | Plain folk |
|---|---|---|---|
| Id | Id | Appetite / the Passions | The Want |
| Superego | Superego | Conscience | The Ought |
| Ego | Ego (strength) | Self-command / Self-government | The Choosing |
| Anxiety | Anxiety | Unease / Nervous disquiet | Dread |

I recommend the middle column as the default. It's in-period, and "Self-command" reads as a stat.

**Body:** needs and conditions. Needs are bars on the code's 0–1000 scale, *displayed as band words* (the content `bands[].label`), with numbers at rung 3. They're grouped Physical (`05`), Social (`04`), and Spiritual. Hunger expands to show calories today, protein/fat, Fresh, and Monotony (P8, §2.8). Wounds show as a body silhouette with located marks (`02` §8.4).

**Of you:** `04` §12.1 as written. It has five opinion rows (Affection, Respect, Trust, Fear, and an Obligation ledger line). Bars appear as bands until Read People succeeds. Reasons are listed with their deltas, and unknown contributions show as a hatched `? other reasons` segment. Reasons the PC was present for are always listed.

**Known:** the PC's beliefs about this actor, each with a credence word ("you're sure", "you've heard", "a rumor says"). Each has a source chain ("from Liesl, after church, May") that can be tapped back to the source's dossier. Below that come memories involving her, sorted by salience, and **ties** as a mini web of 5 nodes that expands to the full web.

**Pack / Pantry:** what the PC knows of her inventory. That means what she carries visibly, what she's traded with you, and her **household pantry** *if the PC has seen it*: hosted there, helped at butchering, or saw the cellar half-empty (that last one is a belief with a date). It uses `03`'s item model and the §2.7 tree, read-only.

### 2.4 The rumor ledger (and Figure ledger)

Ledger → **Talk of the County**. It's grouped by settlement (`04` §12.2) and populated only from what the PC has heard or learned.

```
│ TALK OF THE COUNTY      [About you▾]│
│ ▾ Iron Ford — uneasy               │
│   "The Kessler woman soured the     │
│    Haas milk."                      │
│    heard from Liesl Haas, Tue       │
│    spread: several households  ↑    │
│    3 versions ▸                     │
│    [Counter] [Find source] [More ▾] │
│   "Somebody's been at the Vogt      │
│    springhouse."   only a few  →   │
│ ▸ Kvale Ridge — quiet (2)           │
│ ── FIGURES ─────────────────────── │
│ "The stranger who killed the hodag" │
│   who they think it is: you ▮▮▮▯    │
└────────────────────────────────────┘
```

- The **filter** chips are About you · About people you know · Figures · Everything heard. Spread bands and trend arrows follow `04`.
- **Actions** (Counter, Find the source, Feed it, Plant a rival rumor) open the matching interaction flow (§2.12). "Find source" builds a breadcrumb chain of who-told-whom, and each hop is one investigation step.
- **Figures** (renamed from Persona) list every rumor identity the PC knows about, along with the PC's estimate of who the county thinks each one is. In witch mode this section gets the most use.
- **Settlement mood** (`04` §12.3) is the group header. Witch mode adds the notoriety label (§2.13).

### 2.5 The Chronicle

Ledger → **Chronicle**. There's one surface with four voices (`05` §11.2), each on its own paper:

| Voice | Paper | Pocket treatment |
|---|---|---|
| **Journal** | Ruled notebook, the PC's hand | A single column. The main font stays for legibility; the hand feel comes from ink color and the margins, not a script face. You can annotate it (`05` `player_annotations`). |
| **Paper** | Newsprint | One column with small-caps headlines and a masthead strip. Multi-column only at Desk. |
| **Almanac** | Tabular yearbook | Tables collapse into key/value rows, and a chart opens on tap. |
| **Ballad** | Broadside verse | Centered stanzas with a woodcut header glyph. |

- **Default view: "All voices"**, as one interleaved timeline with a voice glyph per entry. A voice filter sits at the top. Threads are filterable too ("The Haas milk business").
- **[DECISION]** (`00` P1: "the full truth comes out in the post-run Chronicle epilogue") During play, the Chronicle contains only what the PC knows or what's public. `06`'s live side-by-side (C44) is placed in the epilogue only.
- After the run, the **Epilogue** adds the omniscient layer.
  - On Pocket, the rumor-vs-truth side-by-side (`06` §1.2) becomes a **flip card**: "What was said" on the front, "What happened" on the back, flipped with a tap. Reduced motion swaps the flip for a cross-fade.
  - At Desk the two sides sit next to each other.
- **Export** (`06` Q) is a share-sheet action that produces a self-contained HTML file in the same paper styles.

### 2.6 The Outfitter: Book, Kit Sheet, Flat-Lay, Readiness

**[DECISION]** (`03` §2) The catalog is the proprietor's pasted-up **Book**. The pocket version keeps it a *book*, one page at a time.

```
┌────────────────────────────────────┐
│ PRATT'S BOOK · Fire & Light     ⌕  │
│ ┌──────────────────────────────┐ P │
│ │                              │ S │ thumb-index tabs
│ │   (engraved plate: lantern)  │ F │ (vertical, on the
│ │                              │ C │  thumb side; drag
│ └──────────────────────────────┘ T │  to scrub sections)
│ TIN LANTERN, PIERCED       $0.45 W │
│ 1.5 lb · Bulk 3 · light 2 · iron A │
│ "Throws stars on the barn wall and │
│  not much on the path."            │
│ ̶$̶0̶.̶4̶0̶ "freight — Mar." (Pratt)    │
│ Common · Brass $0.90 ▸             │
│ [Compare]            [Add to order]│
├━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤
│ Order $23.15 · Purse $40.00        │ ledger strip = a
│ Load Medium ▮▮▮▯▯ · Ready 9/12  ▴  │ peek sheet
└────────────────────────────────────┘
```

- **Thumb-index tabs** sit on the right edge as a vertical strip, which is both a dictionary's thumb cuts and the thumb's natural reach. Drag along the strip to scrub through sections.
  - *Under the Counter* appears only per `03` §2.2.
  - Horizontal swipe turns pages within a section. It's safe here because page turns are non-destructive.
- **Plates are baked at build time** (§5.5), so pocket rendering costs nothing.
- **Compare** takes 2 items on Pocket (stacked, with tag deltas) and 4 at Desk.
- **Marginalia and remarks** from the proprietor's Mind appear as handwritten notes. A remark is a social interaction (`03` §2.4), so it can be a lie, and the dossier will remember who said it.
- **The ledger strip is a peek sheet.** Pull it up to Half to see order lines and the purse breakdown (specie vs. notes at discount, `03` §8.6). Pull it to Full to get three tabs: **Kit Sheet · Readiness · Flat-Lay**.
  - **Kit Sheet:** a front/back paper-doll silhouette with carry points. Tapping a point opens its nested packing list (§2.7).
  - **Readiness:** `03` §2.4 as a list of `✓ / ✗ / ~` rows, each with a plain-words reason. The rows are **filtered through the character's Woodcraft and Lore**, so a greenhorn sees four rows and one of them is wrong. A footer reads "Your Woodcraft 1: you may not know what you don't know". **[OPEN, `03` Q6]** This matters more on phones, because there's less room to brute-force read everything.
  - **Flat-Lay:** a full-screen top-down render of the chosen kit on a blanket, grouped by function, with dashed outlines for empty groups. On Pocket it starts zoomed to fit, and pinch zooms in. Tapping an item opens its Book page. The Flat-Lay is also the **best "what am I missing?" glance in the game**, so it's reachable from Pack anywhere, not only in the store.
- **Rotating to landscape (Folio) gives the two-page spread**: plate left, listing right, and the Kit Sheet as a docked third column at ≥ 900 px.

### 2.7 Inventory and packing

Pack → **Kit**. One data model, `03` §3.4 nesting, shown as an indented ledger tree:

```
│ KIT · 61 lb · Bulk 38/44 · Medium  │
│ Weight ▮▮▮▮▮▮▯▯▯ |L |M |H           │
│ Bulk   ▮▮▮▮▮▮▮▯▯                   │
│ "2.4 mph on trail · Stealth −2     │
│  (tin cup clanks — lash it) ·      │
│  you'll sink fording deep water"   │
│ ▾ Knapsack, painted     31 lb      │
│   ├ Match safe [dry]    reach 20s  │
│   │  └ Lucifers ×40                │
│   ├ Hardtack 6 lb       reach 30s  │
│   └ … 7 more                       │
│ ▸ Belt (3/4 hooks)                 │
│ ▸ Coat pockets (4/5)               │
│ ▸ Mule "Dorcas" — 118/200 lb       │
│ [Move] [Use] [Drop] [Flat-Lay]     │
└────────────────────────────────────┘
```

- **Moving items without drag.** Drag-and-drop on a phone is a precision task. The primary method is **tap the item → Move → tap the destination**. Valid destinations light up with their remaining capacity and the new reach time ("Belt hook: reach 3 s"). Long-press-drag also works for players who want it.
- **Reach time** is a right-aligned column. Re-packing "for the emergency you expect" (`03` §3.4) shows its payoff immediately: the powder horn moves from pack-interior 30 s to belt 3 s.
- **Consequences in plain words** come from a `loadConsequences` query and update live. Each line expands to its Explain.
- **Quick actions** in context: Lash noisy items, Dry (near a fire), Oil, Drop pack (an emergency, a single tap, available from the rail during Danger).
- **[PROPOSAL]** No spatial grid. That follows `03`'s recommendation, but `08` 2.4 is still open. A grid would make the pocket UI worse, which is one more argument for `03`'s position.

### 2.8 The provisions planner (P8)

Pack → **Provisions**. This is P8's promise made legible: **days of food at current rations, what spoils first, and the weight/bulk tradeoffs.** It covers the PC plus any companions and animals the PC feeds. The same component, pointed at a household, is the **Pantry** view.

```
┌────────────────────────────────────┐
│ PROVISIONS — Ada + Dorcas (mule)   │
│ Ration [Full][¾][½][Custom]   ¾    │
│ Eat order [Spoils first ▾]         │
├────────────────────────────────────┤
│ Food lasts   6 d 10 h   (est. 5–7) │
│ 1  2  3  4  5  6  7                │
│ ●●|●●|●●|●●|●●|●◐|○○  meals        │
│ Fresh  ▮▮▯▯▯ low from day 4        │
│ Monotony: hardtack-and-bacon by d5 │
│ Fuel 3 nights · Caps 22 shots      │
│ Lamp oil 4 nights · Coffee 9 days  │
│ Oats (Dorcas) 3 days ⚠             │
├── SPOILS FIRST ────────────────────┤
│ ! Trout ×2        tonight  [Eat]   │
│ ! Cheese 1 lb     ~3 d warm        │
│   Bread 2 lb      ~5 d  oilcloth ▸ │
├── WEIGHT FOR WORTH ────────────────┤
│ Pemmican  ~3,000 kcal/lb  no fire  │
│ Bacon     ~2,500         fire,pan  │
│ Flour     ~1,600   fire,pan,water  │
│ Hardtack  ~1,700         soak      │
│ [Suggestions (Woodcraft 4) ▸]      │
└────────────────────────────────────┘
```
*(kcal values are illustrative. `03` owns item fields and `05` owns burn rates.)*

**[PROPOSAL] What it shows, and who owns each number:**

| Readout | Source | Notes |
|---|---|---|
| **Days of food** | `planProvisions` in core: a day-by-day integer projection of meals, given the ration %, the eat-order policy, `05`'s burn (2,400 kcal/day × labor and cold modifiers), and spoilage | Shown as days + hours, with a **range** when the forecast is uncertain. The range narrows with Woodcraft and an Almanac (P1: the character's estimate, with its work shown). |
| **Meal strip** | Same projection | Each pip is a meal. ◐ is a short meal and ○ is none. Tapping a day lists what gets eaten. |
| **Nutrition** | Item fields (`03`: kcal, protein/fat, Fresh) and deficiency conditions (`02`) | Fresh is the anti-scurvy factor. Monotony is a mood thought (`10`/`04`). |
| **Consumables** | Item counts ÷ planned use (fires per night, shots, nights of lamplight) | The use rates come from the player's planned activity: "Hunting daily" raises caps used. |
| **Spoils first** | Spoilage physics (`05`: temperature, wetness, packaging) applied to `03` shelf-life fields | Sorted by projected spoil time, with the packaging shown, and **[Eat]** / **[Repack ▸]** inline. |
| **Weight for worth** | kcal per lb and per Bulk, plus preparation needs (`03`) | Prep needs are cross-checked against the kit: "needs pan ✓, fire ✓, water ✗ (canteen empty)". |
| **Suggestions** | A Readiness-style query, **filtered by Woodcraft** | "Swap 6 lb flour → 3 lb pemmican: −3 lb, +0 days, no fire needed." A greenhorn gets fewer suggestions, and sometimes wrong ones. |

**Integer math.** The planner runs in core, so it follows the ADR's invariants. All values are integers: kcal/day, kcal per item unit, ration %, and spoil times in game-minutes. Spoilage rates are a **lookup table** keyed by temperature band × wetness band × packaging class. That replaces any exponential decay curve (C49), and the approximation error against a continuous model should be noted in `05`. The projection walks day by day with integer arithmetic. "Days of food" is the last day whose meals reach ≥ 50% of ration. **The same function drives NPC household rationing**, so a hard winter emptying a pantry (P8, P2) is the same arithmetic the player sees.

**Rations as a command.** Setting a ration is a standing order to the character (a Command). It isn't a UI preference. Companions may grumble about it through `04`, and the Id voice will argue with it (P7).

**Pantry mode** (your own household, or a hosting household you can see): the same panel plus **stores** (crocks, barrels, root cellar, smokehouse as containers with protective properties), **mouths** (household members and their burn), and a **season horizon** (to spring thaw, to harvest). A pantry you see is a belief with a date stamp ("as of Tue").

**Region-map tie-in.** When you plan a route (§2.10), the route card shows "Food on arrival: 4 d" from the same query.

### 2.9 Character creation

`06` §7 has 15 screens. Pocket keeps them all but makes each one **a single decision with a thumb-zone Next**. Screens are grouped into four chapters so progress feels short: *The World · Your Story · Yourself · Your People and Ties*. **Quick start** (`06`) is the first button.

```
┌────────────────────────────────────┐
│ ◀  Yourself · 2 of 4      🎲   ⓘ   │
│ PEOPLE                             │
│ ┌───────────────┐┌───────────────┐ │
│ │    Human      ││     Elf       │ │
│ └───────────────┘└───────────────┘ │
│ ┌───────────────┐┌───────────────┐ │
│ │ Shadow-faekin ││    Goblin     │ │
│ │   (hidden)    ││               │ │
│ └───────────────┘└───────────────┘ │
│ Shadow-faekin. Your nature is      │
│ hidden. Others will take you for:  │
│  (•) human    ( ) elf              │
│ What this changes ▸   Show math ▸  │
│                                    │
│ [ Back ]                [ Next ▶ ] │
└────────────────────────────────────┘
```

- **🎲 Randomize** applies to the current screen. Long-press it to randomize everything from here on.
- **Show the math** opens a sheet with the people's modifiers, from content (`PeopleSchema`), as an Explain. **[DECISION]** The four peoples are canon. **[PROPOSAL]** Descriptions stay as blank placeholders until `12-peoples.md` lands. The UI must not invent lore.
- **Shadow-faekin concealment** is **[DECISION]** (ADR: concealed by default, passes as human or elf; the code has `concealed` and `passes_as`). **[OPEN] How the UI frames it** touches real-world "passing" narratives. Options for Ellie:
  - **(a) Fae-forward framing.** The language is all about fae concealment: glamour, tells, iron, a name the fae know you by. Discovery comes through fae signs. No vocabulary is borrowed from racial passing.
  - **(b) Social-identity framing.** The UI uses the identity model (C47: you present a Figure; others hold `IsFigure`/`Is(kind)` credences), the same as an alias or a cover. It's mechanically uniform and emotionally neutral.
  - **(c) Explicit theme.** The game names the experience of hiding who you are, with care and sensitivity readers.

  I recommend (a)+(b): fae framing in the words, the identity model underneath, and no gamified "exposure meter". Discovery shows as other actors' *beliefs* in the dossier, the same as any rumor.
- **Goblins:** the card stays plain and neutral until `12` lands. See the depiction rules in §7.7.
- **Persona** is set on the Traits screen as "the face you show". The Shadow isn't chosen by the player. It's derived from traits by `10`'s rules and starts hatched.
- **Ties** (screen 14) shows each generated actor as a dossier peek, and each one can be edited.
- **Review** is a PHB-style sheet that scrolls vertically. At Desk it's a two-page sheet.

### 2.10 Region map and travel

Go → **Region**. Paper-map styling follows `05` §1.5:
- **Unknown** areas are blank paper.
- **Rumored** features are dashed glyphs with an error circle and a quote label.
- **Charted** features are drawn in printed-map style, with the map item's provenance on tap.
- **Visited** features are inked, with a last-seen date.

The fae calendar sits in the header.

```
┌────────────────────────────────────┐
│ HOLLIN COUNTY   ☽ waxing · Thu     │
│        ≈≈ river ≈≈   ⌂ Iron Ford   │
│              ╲ ridge rd            │
│   ◌ "a ring?" ±2mi   ╲             │
│                       ✕ Lantern    │
│      (blank paper)       Coulee    │
├━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┤
│ To Lantern Coulee                  │
│ (•) Ridge   9 h  dry · open wind   │
│ ( ) Bottom  7 h  ford waist · ague │
│ ( ) Fae path ?   Drift+ · lost?    │
│ Pace [Easy][Steady][Hard]          │
│ Arrive Fri ~2p · Food then 5 d     │
│ Load: Medium → fatigue ×1.4        │
│ [ Set out ]          [ Camp first ]│
└────────────────────────────────────┘
```

- **Travel runs at Ultra** (`05` §4.1), with edge-by-edge interrupts that use the §1.6 alert policy. A thin progress ribbon shows the route, the time, and weather icons.
- On interrupt, the sim drops to a camp-sized site at T0 with a Danger pause if one applies.
- **Fae path** values are shown as `?` and words. The honest answer is that you don't know (`05` §1.4; time-slip severity C18 is still open).
- **Fog and knowledge are per-character** (`05`), so the map *is* your character's map. Tapping a dashed rumor opens the rumor ledger entry it came from.

### 2.11 Combat on a phone

**[PROPOSAL] The flow:**
1. Hostility begins (`02` §7.2).
2. The sim **auto-pauses** and switches to **Tactical**. The camera frames all known combatants.
3. **Plan.** Queue up to 3 actions for the PC. Each shows its time cost, its provocation (AoO) warning, and its odds.
4. **Resume** runs in real time at 1 game-second per real second. "Pause when my action ends" is on by default in Pocket.
5. Combat ends when no hostile intent has been perceived for 6 s. The sim returns to the prior speed after a "Breathe" card (wounds, ammo, morale).

```
┌────────────────────────────────────┐
│ ⚔ TACTICAL  4:12:07p        ❚❚ PLAN│
│ You    ▓▓▓▓▓░░ aim → fire  1.2s    │ timing ribbon
│ Wolf 1 ▓▓░░░░░ lunge       0.6s ⚠  │ (windup ▓ /
│ Wolf 2 ······· circling            │  recovery ░)
├────────────────────────────────────┤
│        ⛨           (W1)            │
│   ⛨      ◉ ─ ─ 62% ─ ─▶            │
│                   (W2)             │
│      ⛨ cover: stump +2             │
├────────────────────────────────────┤
│ Target  ◀ Wolf 1 ▶   62% · 3 s     │
│ [  FIRE  ] [ CLUB ] [ TO COVER ]   │
│ [Reload 20s] [Item▾] [Shout] [Yield]│
└────────────────────────────────────┘
```

- **The timing ribbon** is `02` §7 made visible. It shows every *perceived* combatant's current action as windup (▓) and recovery (░), plus your first-action delay from Initiative. Windup is when you get interrupted (`02` §7.1), so it's the most important thing on the screen. Tapping a ribbon row selects that actor, which gets around tiny sprites.
- **Big targets.**
  - **◀ ▶ buttons** cycle targets. The order is nearest, then most dangerous, then intent.
  - **Cover** is suggested: the three best tiles get large ⛨ markers you can tap.
  - Actions are 56 px buttons. Hit chance includes line of fire (`02` §9.4), and a long-press shows the Explain.
- **Item▾** lists usable items **with reach time** ("Powder horn, belt: 3 s · Spare flints, pack: 30 s"). This is where `03`'s reach model becomes life or death.
- **Morale and intent** (`02` §9.1, §9.8) show as words above enemies ("testing", "falling back"). They're not health bars. Vigor and Wounds appear on the PC's own pip only. Enemy condition is described in words, gated by Perception and Medicine: "limping", "bleeding badly".
- **Social exits are first-class buttons.** Shout (Intimidate), Parley, Yield, and Flee are in the main grid, not hidden. Most frontier fights end that way (`02` §9.1).
- **Accessibility.** No input is time-pressured (`06` §8.3). Combat can always be played at Tactical ½ or fully paused per action. **Auto-resolve** and **AI control** (`06`) sit at the bottom of the Plan sheet.
- **Firearm sound** (`02` §9.5) shows as a directional **sound pip** at the screen edge, for deaf and hard-of-hearing players and for anyone with the sound off.

### 2.12 Conversations and interactions

Tap an actor → **Talk** opens the **conversation sheet**. The map stays visible at the top, because who's within earshot matters (`04` §11.1).

```
│ ━━━  Liesl Haas · Warm toward you  │
│ ┄ 2 others within earshot ┄ ⓘ      │
│ TALK      Chat · Deep talk · Toast │
│ ASK       Ask around ▸ · Gossip ▸  │
│ MEND      Apologize ~65% · Gift ▸  │
│ PRESS     Dun · Threaten 40% · …   │
│ ── Recent ─────────────────────── │
│ You: asked about the Vogt spring.  │
│ Liesl: "Mother says it was you.    │
│  I don't believe it." (+Trust)     │
└────────────────────────────────────┘
```

- Interactions come from `04` §10's catalog, grouped by intent. Each one shows predicted odds as **a word plus a number** ("likely ~65%"). The number is gated by Read People, the same as opinion numbers.
- **Topic pickers** (Gossip, Ask around, Warn, Expose) open a searchable list of *the PC's own beliefs*, with credence words. You can only say what you believe, or knowingly lie, which is the **Lie** interaction and is flagged.
- **Results** are written to the transcript in plain period prose, with a delta chip ("+Trust") whose Explain is one tap away.
- **Earshot** lists who can overhear. The Overheard mechanic matters both ways.
- **Foreign-language speech** (09 gap #11) shows as `[Norwegian — you catch: "heks"…]` with a gloss, gated by language skill.
- **Speech-bubble labels** on the map (`04` §11.1) are tappable from anywhere and open a **read-only transcript** of NPC–NPC interactions the PC perceived.

### 2.13 The witch's curse UI

**[PROPOSAL]** The witch plans a curse at her hearth as **The Working**, a recipe card that fills in from top to bottom. `06` owns the catalog, links, protections, and Woe. `02` owns the DC formula (C29), which is unresolved, so the numbers below are illustrative.

```
┌────────────────────────────────────┐
│ THE WORKING · Sour the Milk        │
│ Target   Haas household (4)    ▸   │
│   also bears it: Liesl, little Jakob│
│ Link     Threshold crossed  +2  ✓  │
│          Pail touched          —   │
│ Items    Rennet, a pinch    ✓ hut  │
│ Timing   ◐ waxing tonight   +0     │
│          Walpurgis in 5 d   +2 ▸   │
│ Place    their springhouse 1.2 mi  │
├────────────────────────────────────┤
│ They resist   ~35%   (DC 15) ▸     │
│ Woe           ~2/day while uneasy  │
│ Trace         Low: soured pail     │
│ Talk          Iron Ford: +a little │
│ Protections   horseshoe over door  │
│ Backlash      hot iron in a churn  │
│ [Show the math]  [Begin · 1 h]     │
└────────────────────────────────────┘
```

**Design intent:**
- **The victims are people, on the card.** The Target row lists the household members who'll bear it, as dossier links (`06` §3.6 secondary sufferers). Legibility (P1) and moral weight come from the same row.
  - No celebratory feedback. No chimes, no confetti, and no gold numbers for Woe.
  - Woe gained is entered in the **Woe ledger** as quiet ledger lines.
- **Unknowns stay unknown.** Protections the witch hasn't seen show as `?`. The "They resist" odds widen when the target's Will and protections are uncertain.
- **Content toggles** (`06` §8.3) remove disabled curses from the catalog entirely. They aren't greyed out.

**Other witch surfaces:**
- **Woe ledger** (Ledger → Woe):
  - per-sufferer yield with its Belief tier (`06` §3.6);
  - habituation decay;
  - the **Tithe countdown** to the full moon, with arrears;
  - spending (Gifts, Favor, Workings, Mercies) in a catalog that reuses the Book component (`03` §2.2's "same UI for spells"). A Gift is a Book page.
- **Drift and weaknesses.** `06` owns them (C27). Triggers key off Drift thresholds and the Pact. `03`'s iron load is an *input*.
  - The Drift pip expands into a threshold track (20 / 40 / 60 / 80 / 100) with the weaknesses currently in force.
  - The UI shows weaknesses **where they bite**:
    - The Kit view marks iron items with the discomfort they'll cause at the current Drift ("Hatchet: −2 while held").
    - The map's Iron overlay shows ambient IP.
    - Route cards flag running water and consecrated ground.
- **Notoriety** (lead call, C41). `04` §9's rungs 0–6 are canonical. The witch-facing labels from `06` map onto them: Unknown 0 · Whispered 1 · Suspected 2–3 · Known 4 · Hunted 5–6. They're shown per settlement in the rumor ledger header and on the region map as a small label by each town. **[OPEN, `04` Q3]** Explicit rung or diegetic only? I propose a setting, **"Show the rung"**, off by default in Frontier and on in Settler. When it's off, the label still updates, but only when the PC *learns* the change (a friend's warning, a sermon, a notice nailed up).
- **Cover identities** appear as alternate Figures in the Figure ledger, each with its own known-opinions summary. A blown cover is a Danger-class summons.

### 2.14 Settings and accessibility

Ledger → ⚙. Settings are grouped by what players look for, and each group is one sheet.

| Group | Contents |
|---|---|
| **Reading** | Text size (4 steps plus following the OS Dynamic Type / font scale up to 200%); font (Period: EB Garamond, or Plain: Atkinson Hyperlegible); line spacing; plain-language summaries (`06` §8.3); psyche label set (§2.3) |
| **Seeing** | Theme (Day paper / Lamplight dark / High contrast); color-vision palette (Default / Deutan / Protan / Tritan / Monochrome ink); overlay patterns on or off (on by default); night-brightness floor; label density |
| **Motion** | Reduced motion (follows `prefers-reduced-motion`; also a manual switch): no camera easing, no page curls or flips, no screen shake, plus cross-fades only |
| **Time** | Auto-pause matrix (§1.6); reading speed; "pause when my action ends"; interrupt budget; Tactical ½ |
| **Hands** | Handedness (mirrors the rail and the thumb-index); long-press duration (250–800 ms); tap-to-move; gesture alternatives (on-screen zoom and rotate buttons); haptics |
| **Hearing** | Sound pips (directional visual cues); captions for barks and sound events; master, music, and effects volumes |
| **Content** | `06` §3.2/§8.3 toggles. Changing these mid-run follows `06` (Chronicle tag). |
| **Device** | Battery mode (30 fps, render scale 0.75, lower T0 visual LOD; **sim unchanged**, §5.1); wake lock while running; storage use and export; sync |
| **Debug** | God view (`04` §12.7) and "Show the Director's hand" (`05`), both opt-in and Chronicle-tagged |

---

## 3. Desk (desktop) and Folio

### 3.1 Desk layout

**[PROPOSAL]** RimWorld-dense, with every panel dockable:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Thu 12 Apr 1855 · 4:10 p.m. ☼ 48°F wind NW 9 · ☽ waxing   Food 6d10h  Fuel 3n  $4.15   │
│ [❚❚][1×][3×][6×][⏩]  Overlays: Fae · Light · Temp · Iron · Sound · Suspicion   ⚙ ?   │
├───────────────────────┬─────────────────────────────────────────────┬───────────────────┤
│ INSPECTOR (dossier)   │                                             │ DISPATCHES        │
│ Gussie Pratt          │                                             │ ✉ Mrs. Haas says  │
│ Mind|Body|Of you|...  │                 MAP (three.js)              │   you soured...   │
│ Of you: Warm  ▮▮▮▮▯   │                                             │ ⚠ Trout spoils by │
│  +8 Trust  repaid $4  │                                             │   morning         │
│  −3 Aff    haggled    │                                             ├───────────────────┤
│  ▨ ? other reasons    │                                             │ CHRONICLE (feed)  │
│ Known: …              │                                             │ Journal · Paper   │
│ Ties: (mini web)      │                                             │ "Bought a lantern │
├───────────────────────┤                                             │  I could not      │
│ SELECTION STACK       │                                             │  afford…"         │
│ ◉ Ada  ⟡ Pratt  ⟡ Haas│                                             │                   │
├───────────────────────┴─────────────────────────────────────────────┴───────────────────┤
│ [Go G] [Act E] [Pack I] [Provisions P] [Talk T] [Region M] [Ledger L]   Ada: buying     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Panels** are the same React components as in Pocket, arranged differently. Any panel can **pop out** into a floating window, which is useful for comparing two dossiers side by side or pinning the provisions planner while you shop.
- **The Book at Desk** is `03` §2.2's three-pane layout: plate, listing, Kit Sheet, plus the ledger strip.
- **The sim never pauses for open panels at Desk** (the map stays visible). Only auto-pause and the player pause it. The sheet policy from §1.6 applies only to full-screen overlays.
- **Multi-select** is reserved for a future party or colony (`00`). Today, selection is the PC plus inspection of anything else.

### 3.2 Keyboard shortcuts

**[PROPOSAL]** Defaults. Everything can be remapped (`06` §8.3), and keys are context-scoped (combat keys apply only in Tactical).

| Key | Action | Key | Action |
|---|---|---|---|
| Space | Pause / resume | 1 / 2 / 3 / 4 | 1× / 3× / 6× / Ultra |
| \` | Tactical toggle | Shift+\` | Tactical ½ |
| WASD / arrows | Pan | Q / E | Rotate 45° |
| Wheel, Z/X | Zoom | V | Toggle tilt preset |
| F | Follow / center PC | Tab / Shift+Tab | Cycle targets (hostile first in combat) |
| G | Go (move / ghost path) | E | Act (context radial) |
| T | Talk to selected | I | Pack / Kit |
| P | Provisions | M | Region map |
| L | Ledger hub | J | Chronicle |
| R | Rumor ledger (Reload in Tactical) | O | Overlay cycle |
| C | Character (own dossier) | B | The Book (at an Outfitter) |
| H | Hold to inspect under cursor | Esc | Close topmost panel; again for menu |
| Ctrl+Z | Undo the *unconfirmed* ghost order only | ? | Shortcut sheet |
| **Tactical:** A | Attack primary | **Tactical:** C | To cover (best) |
| **Tactical:** Y | Yield / parley | **Tactical:** Enter | Commit plan and resume |

A gamepad (Steam Deck) is **[OPEN]**. The Folio layout plus a radial-menu mapping would cover it, but it isn't scoped here.

### 3.3 Hover tooltips vs. tap-and-hold

**[PROPOSAL] One component, two triggers.**
- **Desk (mouse): hover tooltips** after 300 ms. They're **nested** (CK-style): hovering a glossary term inside a tooltip opens its own tooltip. Middle-click or holding **H** *locks* a tooltip so the mouse can move into it.
- **Touch: long-press opens an *inspect card*,** the same content as a docked card rather than a floating one. Glossary terms inside it are tappable and push a **stack** with a back chevron, so going three terms deep stays navigable with one thumb. A pin button turns an inspect card into a docked panel at Folio/Desk.
- **Hover is never the only path.** Everything a tooltip shows is also reachable by tapping into the legibility ladder (§1.5). That's what makes touch laptops and screen readers work.

### 3.4 Folio

Folio is "Pocket with one docked side panel":
- The inspector docks right (left when Handedness is Left).
- Sheets become side drawers.
- The Book shows a two-page spread.
- Combat puts the timing ribbon down the side instead of across the top.

Phones in landscape get Folio automatically. That's the recommended way to play combat and the Outfitter on a phone, but neither *requires* it.

---

## 4. Platform and packaging

### 4.1 PWA first

**[DECISION]** (ADR) The game is a browser PWA built with Vite. The code already includes `vite-plugin-pwa`. **[PROPOSAL]:**
- **Offline.** The app shell, the JS, the compiled content bundle, glTF models, baked plates, and fonts are precached with a versioned manifest. The game needs **no network after install**. There's no runtime fetch of content: the content bundle is versioned with the build, and each save records the content version it needs.
- **Updates.** A new service worker waits and never swaps under a running game. An unobtrusive "A new edition is ready; it applies next launch" dispatch announces it. Save migrations follow `07`.
- **Install prompts.** On iOS Safari the game shows a one-time explainer card: *Share → Add to Home Screen*. It's **strongly recommended** because of storage eviction (§4.3).
- **Required browser APIs:** Web Workers (module workers), WebGL2, OPFS, IndexedDB, `CompressionStream`, Pointer Events, `visibilitychange`.
  - **Optional:** Screen Wake Lock, Vibration (Android), `SharedArrayBuffer` (§5.4), File System Access (Desk export).
  - **Floor:** Safari/iOS 17+, Chrome/Android 2023+, current Firefox. **[PROPOSAL]** Ellie should confirm.

### 4.2 Orientation

**[PROPOSAL]** Portrait-first on phones, landscape everywhere, and **no forced rotation**:
- **Portrait Pocket** is the canonical layout. Every screen is fully playable in it.
- **Landscape on a phone** switches to Folio. The game *suggests* it, once, for the Outfitter (two-page spread), Flat-Lay, and combat. It never requires it.
- An orientation lock setting is available for players who play lying down.

### 4.3 Saves: IndexedDB and OPFS

**[PROPOSAL] Model:** a save is the **latest snapshot** plus the **command journal** since that snapshot. Determinism (ADR invariant 1) lets the worker rebuild exact state by replaying the commands.

| Store | Holds | Why |
|---|---|---|
| **OPFS** (worker, `createSyncAccessHandle`) | Snapshot bodies (gzip via `CompressionStream`), the command journal (append-only), the event log segments for the Chronicle | Fast synchronous writes from the worker. Large files. No main-thread jank. |
| **IndexedDB** | Save index (run, World, date, Chronicle headline, thumbnail), settings, content-version map | Queryable metadata. It's the fallback store where OPFS sync handles aren't available. |

- **Cadence:**
  - Append each command as it's issued.
  - Take a **snapshot** at each in-game dawn, on `visibilitychange: hidden`, and before Travel/Sleep.
  - Keep 3 rotating snapshots per run (hidden in Commitment mode, where they serve crash recovery only).
- **Budgets:** a Standard World snapshot should be ≤ 15 MB gzipped on phone and desktop alike (`07` §6 said ≤ 50 MB for a 5k county). Snapshot write ≤ 300 ms in the worker. Resume from cold ≤ 3 s on the reference phone.
- **Eviction.** Call `navigator.storage.persist()` on first save. Safari can evict script-written storage for sites that aren't installed and aren't used for 7 days. Installed home-screen PWAs are exempt. The game warns about this until the app is installed or a backup has been exported.
- **Commitment integrity.** The journal is written *before* a command's effects are shown, so force-quitting can't undo a death. Free saves are just named snapshots.

### 4.4 Cross-device save sync

**[OPEN] Options, from least to most infrastructure:**

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Export/import file** | `.coulee` file (snapshot + journal + content version) through the share sheet, download, or File System Access | Zero servers, works today, also the backup story | Manual |
| **B. Your own cloud folder** | Write the same file to iCloud Drive or Google Drive through the share sheet (or natively under Capacitor) | No servers of ours | Clunky in the browser, decent in native builds |
| **C. Peer handoff** | QR code plus WebRTC on the local network, phone ↔ desktop | No servers, feels magical | A signaling stub is needed, and NAT can get in the way |
| **D. Coulee sync service** | An account plus blob storage. Content-addressed snapshots and journal tails. | Seamless | Costs, privacy, accounts, an ongoing obligation |
| **E. Store-native** | iCloud/Game Center saves, Play Games Saved Games (Capacitor) | Seamless for app-store users | Per-platform plumbing. Doesn't cross iOS ↔ Android ↔ desktop. |

- **Recommendation:** A now, as the backup story. Add C as the "move to desktop tonight" feature. Decide on D only if playtesters ask.
- **Determinism makes every option cheap.** After the first full snapshot, sync can send just the **journal tail** (kilobytes). The receiving device replays it, and any JS engine reproduces the state (ADR: V8 ↔ JSC).
- **Conflicts.**
  - **Commitment runs** use a **custody token**: a run is "open" on one device. Opening it elsewhere asks to take custody, and the old device's newer journal tail, if any, must merge first. Forking a Commitment run would be a save-scum, so it's refused.
  - **Free-save runs** can fork freely into named branches.

### 4.5 Capacitor (app stores)

**[PROPOSAL, later]** Capacitor wraps the same build:
- **What it adds:** durable storage (no ITP eviction), store presence, native haptics (iOS Safari has no Vibration API), native share and file sync (B/E above), keep-awake, and status-bar control.
- **What doesn't change:** iOS still runs JavaScriptCore in WKWebView, and Android runs Chromium WebView. Workers and WebGL2 work in both. The determinism invariant already covers the two engines.
- **Watch items:**
  - App Store review of web-wrapped apps is generally fine for games with real native integration. That's another reason to adopt haptics, share, and saves rather than ship a bare wrapper.
  - Content updates should ship with app updates rather than live-patching code. The bundle is already versioned with saves.
  - Pricing and IAP policy are **[OPEN]**.

### 4.6 Tauri (desktop)

**[PROPOSAL, later]** Tauri gives small native desktop builds, filesystem saves, and a Steam-friendly executable. **The caveat:** Tauri uses the system webview.

| OS | Webview | Notes |
|---|---|---|
| Windows | WebView2 (Chromium) | Fine |
| macOS | WKWebView | Fine |
| Linux | WebKitGTK | WebGL performance and compatibility have historically lagged. Ellie's own machine is Linux (CachyOS), so it needs testing early. |

- **Alternatives:** Electron (bundles Chromium; heavier but uniform), or no wrapper (the installed PWA from Chromium is already a good desktop app).
- **Recommendation:** ship the PWA on desktop first. Prototype Tauri when Steam becomes real, and benchmark WebKitGTK against Electron on Linux before committing.

---

## 5. Performance budgets

### 5.1 The governing rule: outcomes are platform-independent

**[PROPOSAL, important]** Tier assignment changes outcomes: a T1 actor resolves activities differently from a T2 actor. So the following must **never** depend on the device:
- Tier caps, T1 radius and relevance thresholds, census materialization rules, and World size.
- If they did, the same seed plus the same commands would diverge between phone and desktop. That breaks share-a-seed, golden tests, and journal-tail sync (§4.4).

**What may vary by device:** frame rate, render resolution, visual LOD, label density, interpolation, and **wall-clock throughput**.
- When the worker can't keep up with the chosen speed, the **speed governor** lowers the *effective* speed and shows it (`▶6×→4×`). The sim never drops or simplifies work to keep up.
- The **budgets below are guarantees about throughput** on reference hardware. They are not knobs the sim turns.

### 5.2 Reference devices

**[PROPOSAL; Ellie to confirm]**

| Class | Reference | Role |
|---|---|---|
| **Phone floor** | iPhone 12 (A14, 4 GB); a 2022 Android mid-ranger (Snapdragon 7-series, 6 GB) | Must play Standard at 1×, and Small at 6×, without throttling |
| **Mid phone** | iPhone 15 / Pixel 8a class | The ADR's "mid phone": Standard at 6× |
| **Desktop floor** | 2020 laptop, integrated GPU, 8 GB | Standard at 6×, Large at 3× |
| **Desktop** | Ellie's dev machine | Fast-forward, harness, Large at 6× |

JavaScriptCore on iOS and V8 on Android both have to pass the perf CI (`07`), using Playwright WebKit as a proxy plus on-device spot checks.

### 5.3 Frame, battery, thermal

| Budget | Mid phone | Desktop |
|---|---|---|
| Frame rate | 60 fps while the camera or animations move. 30 fps cap while the sim runs and the camera is still. **0 fps (no redraw) when paused and idle.** | 60 fps, or the display refresh rate |
| Main-thread work per frame | ≤ 8 ms (React + scene submit) | ≤ 6 ms |
| React panel re-render | ≤ 4 ms per snapshot (selectors and memoized rows; long lists **virtualized**: Chronicle, rumors, Book, census) | same |
| Battery at 1×, 50% brightness | ≤ 10% per hour (Battery mode ≤ 7%) | n/a |
| Thermal | No throttling after 20 min at 6× in a market-day town (test protocol) | n/a |
| Render resolution | `devicePixelRatio` capped at 2. Battery mode renders at 0.75 scale with CSS upscale. | Native |

The renderer runs frames **on demand** (`@react-three/fiber` `frameloop="demand"` plus invalidation on snapshot, input, and animation), not in an always-on loop. That's the single biggest battery lever.

### 5.4 Worker sim budgets

These are measured as worker CPU time, given 1× = 40 real s per game-hour.

| Work | Mid phone | Desktop | Notes |
|---|---|---|---|
| **T0** sustained, 150-actor town | ≤ 15% of one core at 1×; ≤ 50% at 6× | ≤ 5% / ≤ 20% | At 1× that's 90 game-seconds per real second. T0 must be **event-driven** (actions schedule their completions; movement is analytic along path segments; needs update per game-minute), not a per-second loop over all actors. |
| **T0** Tactical | ≤ 5% | trivial | 1 game-second per real second |
| **T1** step (1 game-hour), 400 actors | ≤ 40 ms | ≤ 12 ms | ≈ 0.1 ms per actor. That's in line with the ADR's M2 target (< 5 ms for 30 actors). |
| **T2** day step | ≤ 150 ms, staggered across frames | ≤ 50 ms (`05`) | 6-hour sub-steps ≤ 15 ms / ≤ 5 ms |
| **Ultra** | Sleep 8 h in ≤ 5 s; a day of overland travel in ≤ 3 s | ≤ 1 s | Interrupt checks included |
| **Queries** (§1.7) | ≤ 20 ms (planner, odds, readiness) | ≤ 5 ms | Debounced at 100 ms |
| **Snapshot to UI** | ≤ 2 ms to build. Structural sharing, so only changed view models are posted. | | ≤ 10 Hz |
| **Positions** | `Float32Array` per frame batch, transferred. Or a `SharedArrayBuffer` ring when the page is cross-origin isolated (COOP/COEP headers; Capacitor and Tauri can set them). | | The renderer interpolates. |

### 5.5 Rendering and assets

| Budget | Mid phone | Desktop |
|---|---|---|
| Draw calls per frame | ≤ 120 | ≤ 400 |
| Visible triangles | ≤ 150k | ≤ 600k |
| Lights | Ambient + 1 directional; lantern and fire lights as **unlit additive decals** | + up to 8 point lights near the camera |
| Shadows | Blob decals under actors and items | One 2048 cascaded directional shadow map (optional) |
| Textures | One shared **palette texture** (vertex colors index it; ADR) + UI atlas + baked plates | same |
| GPU memory | ≤ 120 MB | ≤ 500 MB |

**[PROPOSAL] Asset triangle budgets** (Blender scripts, `tools/blender/`, should lint these):

| Asset | LOD0 | LOD1 / far | Notes |
|---|---|---|---|
| Humanoid actor | 500–800 | 150 | ≤ 16 bones. Skinned meshes for the 24 nearest actors; posed **instanced** proxies beyond that. |
| Animal | 200–600 | 100 | Same skinning policy |
| Hand item (axe, lantern) | 60–200 | — | Shown in hand or on the ground |
| **Hero item** (Flat-Lay, plate source) | 300–1,500 | uses the hand item | Only the Flat-Lay and plate baking use these |
| Tree / shrub | 150–400 | Billboard impostor | Instanced. A town site has ~1–3k. |
| Building | 400–3,000 | 200 | Interiors cut away by roof hiding |
| Terrain chunk (32×32 tiles) | ~2k | ~500 | Elevation layers for goat prairies |

- **Catalog plates are baked at build time.** `tools/blender` renders each item's hero mesh with a hatching/engraving pass to WebP (`03` §2.2's shader idea moved offline). Phones never pay for the engraving shader. The live shader stays an optional Desk effect for the Flat-Lay "photo" mode.
- **Instancing:** one `InstancedMesh` per (model, LOD) per site chunk. Items on the ground are instanced per item def.

### 5.6 County scale per platform (C9)

**[PROPOSAL]** World size is a **creation setting recorded in the World** (§5.1). Phones recommend Standard, and every size loads on every platform.

| World size | Area | Settlements | People (census) | Named actors | T1 cap | T0 cap | Phone floor | Mid phone | Desktop |
|---|---|---|---|---|---|---|---|---|---|
| **Small** ("A Coulee") | ~360 sq mi | 3–4 | 1,500–2,000 | ~400 | 250 | 150 | 6× | 6× | 6× |
| **Standard** ("A County"; default) | ~720 sq mi (`05`) | ~6 | 3,000–4,000 | ~800 | 400 | 150 | 1×–3× | 6× | 6× |
| **Large** ("The Long County") | ~1,000 sq mi | 8–10 | ~5,000 | ~1,500 | 600 | 150 | 1× (slow Ultra) | 3× | 6× |

- **T0 cap is fixed at 150** for every size. It's set by the busiest site (a market-day town), not by the county.
- **Named counts follow `05`'s lazy census.** The cap grows during play as census members materialize. Each World size sets a soft ceiling, and beyond it the oldest *irrelevant* named actors are compacted to T2-minimal (never deleted).
- **Memory, worker heap:** Small ≤ 60 MB, Standard ≤ 120 MB, Large ≤ 220 MB. The phone tab total (heap + GPU + DOM) should stay ≤ 400 MB, to keep clear of iOS's per-tab kill limits.
- This answers `08` 1.1 "which phone, how much sim" with **option (a) for every size**: the full county runs on the device, in a worker. **Option (b)**, a smaller county, becomes a player choice rather than a platform fork. **Option (c)**, a slower T2 cadence, is rejected because it breaks determinism across devices.

---

## 6. Accessibility

The controls are in §2.14. These are the requirements behind them. **[PROPOSAL]** Target WCAG 2.2 AA for every DOM surface.

- **Text.** Body is ≥ 16 px and in-run text never drops below 13 px. Everything scales to 200% with reflow. Numbers use **lining, tabular figures**: EB Garamond's default oldstyle figures are lovely in prose and bad in a ledger.
- **Color vision.** No state is shown by color alone. Overlays pair hue with **pattern**: stipple density for Fae intensity, hatch angle for temperature, ring count for sound. Each palette variant is validated for ΔE separation of the overlay ramps.
- **Contrast.** Text is ≥ 4.5:1 and glyphs and bar fills are ≥ 3:1 against the paper. Night is hue and ink, held above a brightness floor.
- **Reduced motion.** Cuts instead of easing. No curl, flip, or shake. Pulses become static rubric marks.
- **Screen readers.**
  - Panels are semantic DOM: sheets are `dialog`s with focus management, the Kit is a `tree`, and ledgers are real `table`s.
  - Dispatches go to a `polite` live region and Danger pauses to `assertive`.
  - **The map is not the accessible path. The Surroundings list (§2.2) is.** Together with the Act menu, target cycling, and the paused Plan sheet, it makes T0 and combat navigable without sight.
  - Explain sheets read as sentences.
  - **[OPEN]** Full blind playability is a stretch goal, but the plumbing costs little if it's there from day one.
- **Motor.** No timed inputs, ever. Every gesture has a button alternative.
- **Hearing.** Directional sound pips and captions for sound events (gunshots, bells, *music from the hill*).
- **Cognitive.**
  - Plain-language summaries for the Chronicle and rumors (`06` §8.3).
  - The legibility ladder (§1.5) lets players stop at bands.
  - A **"What should I worry about?"** button in the Ledger lists the top 3 pressing facts the PC knows, sorted by the alert score.
- **Photosensitivity.** No flashing faster than 3 Hz. Lightning and muzzle flashes are capped in luminance delta.

---

## 7. Visual style guide (09 gap #12)

### 7.1 The idea

**Ink and paper over a muted, low-poly world.** The UI is a 19th-century printed and hand-kept object: ledgers, a store's Book, newsprint, an almanac, a notebook. The world is cheap, readable low-poly with flat-shaded vertex color (P6, ADR). The two meet in the catalog plates, which are the 3D models rendered as engravings.

**Readability beats period accuracy wherever they conflict.** Period accuracy decorates. It never encodes information on its own.

### 7.2 Type

**[PROPOSAL]** This aligns with the fonts the web app already includes.

| Role | Face | Rules |
|---|---|---|
| Body, UI, ledgers | **EB Garamond** | 16 px+ body; `font-variant-numeric: lining-nums tabular-nums` for every number |
| Display (headers ≥ 20 px, mastheads, Book section titles) | **IM Fell English** | **Never below 20 px, and never for numbers or body text.** Its period irregularity is the charm, and also the legibility cost. |
| Explain math, debug, God view | **IBM Plex Mono** | Tabular. This is the honest "machine" voice for the math. |
| Plain mode | **Atkinson Hyperlegible** | Replaces Garamond and Fell in the Plain font setting |

Small caps for headers come from Garamond's real small caps, not synthesized ones. Italics are for voices and quotation, never for data.

### 7.3 UI color tokens

**[PROPOSAL]** Defined as CSS tokens, re-mapped by theme and color-vision setting:

| Token | Day paper | Lamplight (dark) | Use |
|---|---|---|---|
| `--paper` | #F3EBDC | #1E1A15 | Ground |
| `--paper-2` | #E8DCC6 | #2A241D | Sheets, cards |
| `--ink` | #2B241C | #EADFCB | Text (≈ 12:1 on paper) |
| `--ink-2` | #5A4D3E | #B9AC96 | Secondary text (≥ 4.5:1) |
| `--rule` | #B8A88E | #4A4136 | Rules, borders |
| `--rubric` | #A3301E | #E2694F | Urgency, bad bands. Period red ink. Always paired with a glyph. |
| `--id-ink` | #8A4B24 | #D9925C | Id voice (warm). Paired with ◖ and left alignment. |
| `--superego-ink` | #2F4D6B | #8FB0CF | Superego voice (cool). Paired with ◗ and right alignment. |
| `--fae` | #2E7F78 | #6FC7BC | **Reserved for Faerie** (see §7.4) |
| `--good` | #4E6B2F | #9DBB72 | Rare. "Ready ✓". Always paired with ✓. |

- **Paper texture:** at most 3% luminance noise, never behind text smaller than 20 px, and off in High contrast.
- **No pure black or pure white** anywhere, except in High contrast.

### 7.4 Low-poly world palette

**[PROPOSAL]** A shared palette of about 40 swatches, which the Blender scripts index by vertex color (ADR). The families are:

- **Ground:** loess brown, dolomite cap grey, sandstone buff, sinkhole shade, mud. Plus seasonal grass greens (spring, high summer, August straw) and snow.
- **Water:** spring-clear, creek, river brown, slough green, ice.
- **Woods:** oak, maple (autumn red and orange), white pine, hemlock, birch bark, tamarack gold.
- **Built:** whitewash, weathered board, raw log, red-ochre barn, fieldstone, shingle.
- **Cloth:** indigo, butternut, madder, undyed wool, black broadcloth, calico.
- **Iron:** blue-black, rust. Iron items read as iron at a glance, because iron matters (`03` §3.3).
- **Fae (reserved):** verdigris-teal, glamour violet, foxfire pale green. **No mundane object uses these.**

**Rules:**
- **The mundane world is desaturated earth.** Saturation is a signal.
- **Fae intensity shifts the world's grade toward the reserved family**, per tile, by a shader uniform: hue drift, a little extra saturation, and longer and stranger shadows at FI 4–5. Because FI is also gameplay, its overlay *also* uses stipple pattern density (§6).
- **Night** is a blue-ink grade plus warm light pools, held above the brightness floor.
- **Seasons** recolor through palette swaps (cheap) and snow cover. The geometry stays the same.

### 7.5 Readability rules for the 3D view

1. **Silhouette first.** Actors are distinguishable by silhouette at the Field zoom stop: hat shapes, coats, pack humps, rifles carried long. A people's silhouette isn't allowed to be a caricature (§7.7).
2. **Minimum on-screen actor size is 24 px** at the default Pocket zoom. Below that, the actor gets an **ink pip** marker.
3. **Ink outline** on actors and interactables (inverted-hull, which is cheap on phones) for figure–ground against busy terrain.
4. **Selection** is a ground ring plus an outline thickening, never a color change alone.
5. **Relationship markers** above heads use shape (♦ kin, ● known, ○ stranger), shown only at Field zoom or on demand.
6. **Item piles** collapse into a single tagged bundle glyph with a count.
7. **Smoke, fog, and darkness** must leave the PC's own ring visible at all times.

### 7.6 Iconography

Woodcut-style glyphs on a 24 px grid with 2 px strokes, filled or outlined by state. Plates and woodcut headers come from the same Blender pipeline, so the style is consistent and cheap. Every icon has a text label available (at rung 2, or as an `aria-label`).

### 7.7 Depiction rules (sensitive material)

**[PROPOSAL]** Ellie owns these choices. These rules keep the options open and avoid foreclosing anything by accident.

- **Period print carries baggage.** 1850s engravings and newspaper cuts routinely caricatured Irish, German, Black, Native, and Jewish people. **The style guide adopts the hatching technique, not the period's caricature conventions.** No exaggerated ethnic features, no minstrel or "comic immigrant" types, and no "savage" iconography. Every plate and woodcut gets this check in review.
- **Goblins.** The caricature risk is the highest here: hooked noses, money-grubbing, hoarding, "swarthy" coding, and vermin imagery all have antisemitic and racist history. Until `12` lands, goblins get a **neutral silhouette and palette** taken from the shared Cloth and Built families, with no "goblin color". **[OPEN]** Options for Ellie:
  - (a) Folklore-first design: household hobgoblins, mine knockers, and similar European traditions.
  - (b) A wholly invented look.
  - (c) Goblins as a settler-era immigrant people. If so, the risk of mapping them onto a real ethnicity has to be checked (`01` §6.1).
- **Elves.** Avoid Native-coded visual shorthand: feathers, beadwork, "at one with the forest" palettes. That's the "were here first" slot `01` warns about. Elves are established in "the civilized world of humans and elves" (`00`), so they get period dress.
- **Shadow-faekin.** There's no visual tell in the default render; concealment is canon. Tells appear only as *the PC's* perceptions (a dossier note, a Perception highlight) and are framed as fae signs (§2.9).
- **Native nations.** No map icon, plate, or treasure glyph for mounds or artifacts (`01` §2, `03` §9). How the nations appear on the region map waits on `01` Q1. The UI has no placeholder that would presume an answer.
- **Witch persecution.** Mob and trial scenes (`04` rung 6) are shown with restraint: lantern light, crowds as massed silhouettes, and consequences in the Chronicle rather than gore. The UI never shows persecution with gamified feedback, for the witch or for the hunters.
- **Real disease and death** (cholera, children's illnesses). Black crepe, graves, and Paper notices: period mourning signs, not spectacle.

### 7.8 Motion, sound, and haptics (brief)

- **Motion** is restrained: sheet slides of 180 ms or less, page turns that read as paper, and no idle animation on UI chrome.
- **Haptics** (native or Android only): a light tick when a long-press opens, a heavier pulse for a Danger pause, and nothing for routine events. Off is respected.
- **Sound** belongs in an audio doc that doesn't exist yet (09 gap #12, still open). The UI only reserves its hooks: dispatch chimes by category, a page-turn sound, and the ledger pen scratch.

---

## 8. Contracts this doc needs from others

| From | What 11 needs | Why |
|---|---|---|
| `07` (TS rewrite) | Worker protocol: Commands, view-model snapshots, pure **query** API returning Explain records; journal format; speed governor; snapshot/restore budgets | §1.7, §4.3, §5 |
| `07` / `02` | T0 sub-minute clock resolution (seconds vs deciseconds); combat auto-Tactical trigger | C21, §1.6 |
| `03` | P8 item fields: integer kcal, protein/fat, Fresh, shelf life, packaging class, prep requirements; **integer weight units** (oz or g) so sums never accumulate floats | §2.8 |
| `05` | Integer burn rates; spoilage **lookup tables** (temperature band × wetness band × packaging) replacing continuous decay; forecast uncertainty for planner ranges; event `importance` on a 0–1000 integer scale | §1.6, §2.8, C49 |
| `04` | Per-viewer knowledge of opinions and reasons (Read People reveals); rumor spread bands; notoriety rungs | §2.3, §2.4 |
| `10` | Thought, arbitration, defense, Persona/Shadow, and dream records; label sets; Shadow reveal rules | §2.3 |
| `06` | Curse catalog fields (Target, Link, Items, Timing, Trace, Backlash); Woe ledger lines; Drift thresholds and weakness triggers; content toggles; creation screens | §2.9, §2.13 |
| `12` | Peoples' descriptions, depiction guidance, concealment framing | §2.9, §7.7 |

---

## 9. Implementation notes

As of this writing (2026-10-10, ~20:40), `apps/web` has only a `package.json` and `tsconfig.json`. There's no UI code yet. `packages/core/src` has `ids`, `time`, `rng`, and `explain`. `packages/content/src/schema` has psyche, needs, social, belief, world, and rules schemas. Divergences and alignments:

1. **Explain gating aligns** (`core/src/explain.ts`): `knowledge: public | participants | self | omniscient` is what §1.5 needs. **Gap:** knowledge in the doc is *learnable*. Read People turns an NPC's opinion bands into numbers, and a confidant can reveal a Shadow trait. That needs a per-viewer reveal layer (e.g. viewer-scoped `revealed` flags or derived beliefs) on top of the static class. **The doc is the target.**
2. **Time aligns** (`core/src/time.ts`): integer game-minutes, local solar time, and moon phase via an integer parabola (no trig). The status strip can use `calendarAt` directly. There's no sub-minute T0 type yet (C21).
3. **Needs** (`needs-activities.ts`): 0–1000 with `bands[].label` matches §1.5's band words exactly. **Divergence from P8 and §2.8:** hunger is an abstract per-hour decay, with no kcal, nutrition, or spoilage. The provisions planner needs `03`'s item fields and kcal-based burn (`05`). Fine for M1. Flagged for M4.
4. **Psyche** (`psyche.ts`): `egoStrength / superegoStrictness / idAppetite` (0–100), `anxiety` (0–1000), seven defenses, and `TraitSchema.period_label` all support §2.3's period labels. **Divergences:**
   - `persona` is a free-text string. §2.3 and C47 want the Persona tied to the identity/Figure model.
   - `shadow` is a list of trait ids with no reveal state. §2.3 needs per-viewer knowledge of it, including the PC's own.
5. **Peoples** (`world.ts`): `concealed` and `passes_as` match §2.9. The descriptions are empty placeholders, which matches the "don't invent lore" rule.
6. **Site tile size: divergence.** `SiteSchema.tile_ft` defaults to **10 ft**, but `05` §2.1 specifies **5 ft** tiles (the 3.5 inheritance). Zoom stops and touch-target math (§2.2) assume 5 ft. Someone should reconcile this in `05`/`07`. Not my call.
7. **Opinions** (`social.ts`): deltas carry affection, respect, trust, and fear. There's no Obligation ledger yet (`04` §6, C36), and the dossier's "Of you" row has a slot for it.
8. **Web dependencies:** `vite-plugin-pwa` (aligns with §4.1); `@react-three/fiber` (fine under the ADR's three.js; **use `frameloop="demand"`**, §5.3); `zustand` (fine for view-model stores; keep worker snapshots immutable and use selectors to hold the 4 ms re-render budget); fonts EB Garamond, IM Fell English, and IBM Plex Mono (match §7.2). **Add:** Atkinson Hyperlegible for the Plain option. There's no list-virtualization or gesture library yet; either is a reasonable add.

---

## 10. Open questions for Ellie

**New decisions this doc needs:**
1. **Platform-independent sim budgets (§5.1).** Do you accept that World size is the *only* scale lever, and that phones run the same sim more slowly rather than a different sim? This is my strongest recommendation, because it protects determinism and cross-device saves.
2. **World sizes (§5.6).** Small, Standard, and Large at roughly 400 / 800 / 1,500 named actors, with Standard as the default everywhere. Does Standard match the county you picture? (This answers C9 and `08` 1.1–1.2.)
3. **Reference devices (§5.2).** Is iPhone 12 / a 2022 Android mid-ranger the right floor?
4. **Sheet-height time policy (§1.6).** Does peek, half, and full mapping to run, slow, and pause feel right, or should reading always pause on phones?
5. **Tactical speed (§1.6, §2.11).** Should combat auto-drop to 1 game-second per real second, with pause-and-plan and "pause when my action ends" on by default in Pocket?
6. **Psyche labels (§2.3).** Clinical, mental-philosophy (*Appetite / Conscience / Self-command*), or plain folk (*The Want / The Ought / The Choosing*) as the default? And can the player be **ignorant of their own character's Shadow** until it's revealed?
7. **Shadow-faekin framing in the UI (§2.9).** (a) fae-forward, (b) the neutral identity model, (c) the explicit theme, or a mix. I recommend a+b.
8. **Goblin visual direction (§7.7).** Folklore-first, wholly invented, or immigrant-people? Only after `12`.
9. **Save sync (§4.4).** Export/import now, peer handoff next, and defer the server. Do you want a Coulee account service ever?
10. **Witch notoriety display (§2.13; `04` Q3).** A "Show the rung" setting, off by default in Frontier. OK?
11. **Desktop wrapper (§4.6).** PWA-only on desktop until Steam is real, then benchmark Tauri (WebKitGTK on your Linux box) against Electron?
12. **Accessibility ambition (§6).** Treat full screen-reader playability as a stretch goal, but build the DOM-first plumbing from day one?
13. **Gamepad / Steam Deck.** In scope for v1, or later?

**Items this doc depends on that are already in `08`:** the C21 sub-minute clock resolution; the C48 P8 field ownership (planner inputs); `03` Q6 Readiness gating, which matters more on phones; C44 Chronicle truth during play (this doc assumes the epilogue only); C29 curse DC formula (the Working card shows whichever wins); `06` content toggles; `01` Q1 Native nations (no map placeholder until it's decided).
