# The storyteller (Director): an implementation proposal

_Drafted 2026-10-13 after Ellie asked for "something resembling a storyteller in RimWorld … on a meta level to drive the storyline forward." Status: proposal, backlog. Canon is `design-docs/05` §8 (the Nudging Director) and §9 (story sifting). This file covers how to build it on the code as it stands, and the gaps in 05 that need deciding._

## 0. What already exists

- **Design.** 05 §8 already specifies it:
  - an L4D-style tension model (τ, with fast and slow EMAs);
  - a RELAX → BUILD → PEAK → FADE pacing machine;
  - twelve plausibility-bounded nudges (N1–N12), each with a cost;
  - a daily budget;
  - a Thread registry with Chekhov's guns and callbacks;
  - seven personalities (the Almanac, Hearthside, Tall Tale, Hidebehind, Circuit Rider, Good Neighbors, and the Land Itself);
  - a hidden Ledger ("Show the Director's hand").

  The hard prohibitions are canon or near-canon: no fudging seen dice, no spawning from nowhere, no writing psyche state, no shaping by people or culture, and no faekin exposure. C43 and C55 in 09 cover the edges, and 07 M7 lists "a Director with 3–4 nudge types and a ledger".
- **Code.** No Director exists yet. What it can build on:
  - the closed rng union already reserves a `director` stream;
  - the Chronicle has a pattern sifter (`chronicle/patterns`, `engine.ts`, `notability.ts`) that already finds feuds, rumors, scapegoats and courtship arcs;
  - beliefs, opinions, grudges, the persecution ladder (rungs 0–3), fae arcs and episodes, the P8 planner's days-of-food, psyche anxiety, M5's region, census and LOD pins, and M6's tactical clock;
  - fair and god perspectives in play, and `PlaySession` fork and replay.

So the RimWorld storyteller Ellie wants is the Director. The work is building it, not designing it from scratch, plus the gaps in §6.

## 1. The shape in one paragraph

The Director is a **system in the schedule** that runs once a day (and reads τ hourly).
- It **reads** the world: sifted threads, tension terms, and minds read-only.
- It **plans** a small set of nudges within budget.
- It **publishes** them as *biases* that the owning modules' own rules consult at the moment they decide.

It never mutates another module's state directly. Every bias is recorded in the Ledger. Determinism holds because the Director is just another deterministic system with its own rng stream, and each nudge is data in `World`, so saves and replays carry it.

## 2. The core engineering idea: bias hooks, not puppetry

Nudges N1–N12 all reduce to four kinds of hook that owning modules expose through their `api.ts`. Each hook defaults to "no bias".

| Hook | Used by | Who consults it |
|---|---|---|
| `thresholdTilt(process, key) → permille` | N1, N9 | Any *unseen* stochastic check: weather track, trace detect DC, a pending d% |
| `optionTilt(actor, decision, option) → permille` | N2, N3 | Arbitration and goal scoring (psyche `arbitrate`, wildlife target choice, routes); capped by the 15% / ±10% envelopes |
| `windowPick(eventKind, key, window) → time` | N6, N11 | Anything with a window: queued threats, bills due, arrivals, a fae court's scheme clock |
| `carrierWeight(rumor, carrier) → permille` | N4 | Gossip topic selection, only for facts the carrier already holds |

N5, N7, N8 and N10 are compositions: a route choice is an `optionTilt`; an arrival mix is a re-weighting inside the arrival table.

**Fair dice, enforced mechanically.**
- A hook returns 0 whenever the check is **perceivable by the PC** (the same perception gate fair observations use) or the actor is in the PC's field of view at T0 (L4D's rule).
- Visible rolls never consult a hook; that's a code path, not a policy.
- An invariant test runs a 30-day scenario with the Director at maximum budget, collects every Explain whose `knowledge` lets the PC see it, and asserts that none carries a `director` term.

**Counter-based rng cuts both ways.** Draws are `rng(seed, stream, tick, key)`, so the Director could compute *which way an unseen roll will fall* before tilting it. That makes tilts precise (spend only when the tilt flips the outcome). It also allows a fully foreknowing puppet-master. Proposed rule: the Director **may** foresee unseen rolls that it is allowed to tilt, and only within its own ±1σ envelope. It must not use foresight to pick *which* thread to ripen; it plans from threads and τ, then tilts. The Ledger records "foresaw" on such nudges.

## 3. Pieces and where they live

New module `packages/core/src/director/` (07 already lists `director/` in its layout), following the standard `state/events/commands/system/api/view` shape:

1. **Tension (`tension.ts`).** τ terms from 05 §8.4, each read through an owning module's API:
   - physical danger: needs and combat;
   - survival: the P8 planner's days of food;
   - pursuit: pins and persecution;
   - social: grudges, debts, rung;
   - uncanny: fae intensity;
   - economic: purse against obligations;
   - inner: the PC's anxiety integer.

   Hourly integer EMAs (`τ_fast` over 6 h, `τ_slow` over 7 d). The work is cheap because each term is one read. **This lands first, with no nudges:** it's the pacing analytics we lack today.
2. **Threads (`threads.ts`).** Promote Chronicle sifter matches into persistent Thread records with roles, stakes, player involvement, guns and callbacks. It reuses the chronicle's pattern engine.
   - The chronicle sifts *after* the fact for prose; the Director needs the *open* state of the same patterns (Latent, Foreshadowed, Active).
   - So patterns get an optional "open-thread" projection, and the Chronicle keeps ownership of pattern definitions in content.
3. **Ripening moves (content).** Each pattern declares, as data, which nudges can advance it and for which roles. Examples:
   - **Feud:** N3 on the grudge-holder's confront goal, N8 to cross the parties' paths, N4 for the witness who saw the last blow.
   - **Debt:** N6 on the due date toward the anxiety threshold (N11).
   - **Fae bargain:** N6 on the court's scheme clock, N12 for the dream.

   This is the RimWorld "incident deck" reinterpreted: the deck is the set of ripening moves on live threads, not a list of random incidents.
4. **Planner (`plan.ts`).** A daily greedy knapsack:
   - Candidates are the ripening moves on the top-k threads by interest, filtered by the pacing state and plausibility (envelope check against the owning module's declared σ or its 15% band).
   - The value of each candidate is its interest delta times the personality's weights; the cost comes from the catalog.
   - Ties break by thread id, then nudge id.
   - It writes active biases with an expiry, never ongoing control.
5. **Ledger (`ledger.ts`).** `{t, nudge, target, before, after, rationale(threadId, τ), cost, foresaw}` with bounded retention (keep only the summary for compacted months). The Explain knowledge is `omniscient`, so a fair view never sees it. It's in god view and the post-run epilogue, plus an opt-in "Show the Director's hand" that applies 05's redaction of the PC's unconscious.
6. **Personalities (content TOML).** Each is a curve, budget per day, category multipliers and a mercy policy. "The Land Itself" is budget 0: τ and threads still run for the Chronicle and analytics. **Make the Land Itself the regression default for tests and goldens,** so adding the Director never changes legacy hashes.

**LOD tie-in (M5).** Active-thread actors are pinned to T1, which 07 already says. Preferred nudge sites are T1/T2 off-screen processes; that's where the plausibility budget is cheapest and where L4D says to act.

## 4. Exogenous pressure: what "drives the storyline" in a quiet town

RimWorld's storyteller works because something always arrives. 05 forbids spawning, which is right, but a quiet, stable town can then run out of drama. The answer is a set of **era-calibrated exogenous processes**: real hazards with base rates that the sim owns and the Director can only *time and select within*. Candidates:
- **Weather extremes:** blizzards, floods, drought, a late frost.
- **Disease seasons:** ague, cholera years (1854 was one).
- **Markets:** wheat prices, wildcat banknote discounts, then the Panic of 1857 and the rail survey from 01.
- **Arrivals:** steamboats, peddlers, land agents, a circuit rider, a witch-finder (N7, tied to river trade in the backlog).
- **Ecology:** pigeon nestings, wolf winters.
- **Fae courts' scheme clocks.**
- **Law and politics:** elections, a sheriff's sale, the census taker.

Each process has its own rng stream and a window. Their sum keeps the world from going flat even at budget 0, and the Director's leverage is only when inside the window and which plausible variant. These processes are also where most of the "storyline" comes from in practice. Building them is mostly content plus small owners in the existing modules: weather, market, the region arrivals table and fae.

## 5. Slices

| Slice | Contents | Gate |
|---|---|---|
| **D0: measure** | τ, Threads (open-state sifting), Ledger, the Land Itself only, no nudges. CLI `--profile` and the manifest report pacing: τ curve, dead-air hours (no notable event within the PC's knowledge), threads opened, resolved and abandoned. | Golden unchanged. Pacing metrics on the year runs and r3 playtests give a baseline for "is the story flat?" |
| **D1: safe nudges** | Bias hooks plus N4 (rumor carrier weight), N6 (timing in window), N8 (route crossing) and N9 (discovery steer); the Almanac personality; "Show the hand" in god view. These are 07 M7's "3–4 nudge types". | Visible-dice invariant test; plausibility envelope tests; Land Itself still hash-identical to D0; fair Socialite and Explorer playtests report fewer dead-air days without "that was contrived". |
| **D2: minds and mercy** | N3 goal tip, N11 stressor timing, N12 dream tilt, N10 mercy with the death-spiral detector; Hearthside, Hidebehind and Circuit Rider; exogenous processes for weather, disease and markets. | Needs Ellie on C55 (Director reads of the unconscious). Year runs with each personality: τ shapes match their curves; mercy never prevents a death that would have happened after its window. |
| **D3: big levers** | N7 arrivals (with vehicles and river trade), N1 weather track, Tall Tale and Good Neighbors (lunar peaks, tied to the night-sky backlog), witch-mode misattribution (only if Ellie answers 05 Q8 yes), Director timing for emergent NPC parties and posses (parties backlog: a posse is a thread; the Director may only time its formation within its window). | M8 witch slice; M5 county release. |

**Optional, later: rehearsal.** `World` is plain data and `PlaySession` can fork. A Director could fork the world and fast-forward a candidate nudge a few days at T2 to score it, a Monte Carlo storyteller. It's deterministic but expensive, so it would only run in desktop or "long think" settings, if ever. D0–D2 don't need it.

## 6. Gaps and decisions for Ellie

1. **C55 (open):** may the Director read the unconscious (anxiety near a threshold, a charged Shadow) to time stressors? D2 depends on it. Recommendation: reads yes, writes never, as 05 drafts.
2. **05 Q8 (open):** witch-mode mercy by misattribution: system behavior, or only a player Curse? Recommendation: defer to the M8 witch slice playtests.
3. **Foresight rule (new, §2):** may the Director peek at unseen counter-based rolls it may tilt? Recommendation: yes, only for rolls it may tilt, logged as "foresaw".
4. **Default personality:** 05 says the Almanac. For tests and goldens, the Land Itself (budget 0), so the sim stays the source of truth.
5. **Player-facing:** RimWorld shows its storyteller's portrait. Proposal: the chosen personality is named at new-game with its folklore blurb (the Almanac, the Hidebehind…) and appears in the annual Almanac and Paper voice. The Ledger stays hidden unless opted in.
6. **How much "plot" is welcome?** The Director ripens what the sim already grows; it never authors arcs. If Ellie wants authored beats (Wildermyth-style storylets cast from existing characters; 10 §8.3 already anticipates "the Director and Chronicle cast storylets by archetype"), that's a separate, optional content layer to decide later.
