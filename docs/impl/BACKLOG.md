# Backlog

Things to build eventually. The milestone plan in `design-docs/07` sets the order; this is the parking lot. Items Ellie asked for are marked **(Ellie)**.

## Feature queue

### Vehicles and river trade (Ellie, 2026-10-11; not prioritized yet)
Ellie: "vehicles to be a thing, probably starting with river boats/canoes but also possibly wagons… some factions trade up and down rivers."

Notes for whoever designs it:
- **Craft, in rough order.**
  1. Canoes and skiffs (portage weight, capacity, a two-person paddle).
  2. Bateaux, keelboats and mackinaws.
  3. Lumber and shingle rafts: the Wisconsin pineries rafted downriver every spring, a perfect Driftless hook.
  4. Packet steamboats on the big river (1855 is peak packet era).
  5. Farm wagons, ox carts and the stage.
- **Each vehicle is a P8 object.** It has capacity (weight and bulk), crew, speed by current or road and season, repair and condition, cost, and risk (snags, low water, ice-out, wrecks). Cargo in a vehicle is a container in the existing item model.
- **Movement.** This builds on region travel (M5), the hydrology layer of worldgen (ADR 0003: rivers, creeks, fords, landings) and the route graph. Water routes are edges with direction-dependent cost (upstream vs downstream) and seasonal availability.
- **River trade as a sim.**
  - Factions run their own boats up and down: river merchants, raftsmen, packet lines, elvish or goblin traders if `12` supports it, and fae traffic on the river too (the River court in `13`).
  - Their arrivals restock stores. This makes the current abstract "freight" inflow physical and fixes the economy's missing source and sink accounting.
  - They carry news and rumors between towns (beliefs travel by boat), and they bring strangers and charms (`13` arrival vectors).
- **Play.** The PC can buy or build a canoe, hire on as crew, trade a cargo, or run a ferry. Headless Commands come first (ADR 0002).
- **Map.** The renderer needs boats on water and wagons on roads. Blender gets canoe, keelboat, raft, steamboat and wagon assets; there is already a wagon prop.
- **Dependencies.** M5 region travel and M5a county worldgen (hydrology and routes). It ties into the economy work from the 2026-10-11 playtest wave.

### Parties: recruited companions and emergent NPC parties (Ellie, 2026-10-12; after the current backlog)
Ellie: "allowing the player to recruit a party, and NPCs forming parties to do things (including hunt the player as the witch/hunt other witches or fae) happening emergently."

Notes for whoever designs it:
- **One mechanism for both sides (P2).** A party is ordinary social state: members, a leader, a purpose, a destination, shared stores and a pay or loyalty basis. A PC's party and an NPC posse are the same record, with no player-only path.
- **Recruiting.** Use the social layer (ask, hire, persuade, owe a favor) with opinion, fear, money and belief as inputs.
  - Companions are actors with their own psyche. Commanding them goes through **agency transfer** (doc 13 §2.3; `authorizeAct` issuers), so a hired hand obeys within their terms and balks outside them.
  - Standing orders per companion. P8 logistics for the whole party: food, water, load, bedding.
- **Emergent NPC parties.** Each needs a cause that comes from the sim:
  - suspicion and the persecution ladder (a witch-hunt is rung 3–4 made physical);
  - a fae incursion;
  - a lost child, or a debt to collect;
  - a hunting or trapping season;
  - a trading run (ties to river trade).

  Formation is a social event (someone proposes, others are persuaded). Hunts read beliefs, so they can be wrong about who the witch is. 07 M8 already says "whispers, then accusation, then a hunt emerges with no mode-scripted hunts".
- **Hunting the PC-as-witch:**
  - the posse forms from what the county believes;
  - it tracks you through the route graph and sightings;
  - it can be evaded, bargained with or split.
- **Dependencies.** M5 region travel (parties travel together), M6 combat, the M8 witch slice, persecution ladder tuning, and vehicles (a party in a canoe or wagon).

### Elevation, the sky and flying things (Ellie, 2026-10-12; long-term)
Ellie: elevation "both in terms of being able to go underground and up in buildings (while maintaining the top-down view most of the time, like Rimworld already does)", "simulation of things flying over the player's head", "being able to point the camera upward to look at flying things like birds or airships", "simulating the night sky and astrological phenomenon (with fictional constellations and implications)."

Notes:
- **Z-levels.** The sim gains a layer index per place or site cell: cellars, mines (Penhallow Diggings), caves and karst (the county generator already places caves and sinkholes), and upper floors and attics.
  - The view stays top-down by default with a level switcher.
  - Travel, light, warmth, sound and visibility read the level.
  - Under-the-hill fae spaces are a natural use.
- **Things overhead.**
  - Birds and flocks as an ecology layer (migration in season; omens: doc 13 omen families can include flights).
  - Weather aloft.
  - Later, hypothetical airships (an alt-history choice for Ellie).
  - Simulated as entities with altitude over the region graph, visible from below when in view.
- **Camera tilt.** A "look up" mode in the renderer (three.js): sky dome, clouds, flying things, and the night sky.
  - It's a view, not a rule path; what you can see is still perception-gated (P1 fairness).
- **Night sky.**
  - A deterministic integer sky model: the moon phase already exists in the calendar, plus planets and fictional constellations rising by season and hour.
  - Clouds and weather obscure it.
  - Astrological meaning is data: constellations and conjunctions feed belief (portents), psyche (dread, hope), fae timing (courts' seasons, doc 13), and almanac/chronicle text.
  - Who believes what is cultural (P7 psyche plus peoples data), and an astrology "skill" can read it.
- **Art.** These are the showcase for the watercolor art direction (00 decisions log, 2026-10-12): washes for sky gradients, painted stars and clouds.

### The storyteller: a RimWorld-style Director (Ellie, 2026-10-13)
Ellie: "something resembling a storyteller in RimWorld … that exists on a meta level to drive the storyline forward."

This is the Director from `design-docs/05` §8: a tension model, a pacing cycle, plausibility-bounded nudges, threads, Chekhov's guns, a Ledger and seven folklore personalities. It's designed but not built. **The implementation proposal is [`DIRECTOR-PLAN.md`](DIRECTOR-PLAN.md):**
- bias hooks that the owning modules consult, with no puppetry and no visible dice touched;
- era-calibrated exogenous pressures as the "incident deck";
- slices D0 (measure pacing only) → D1 (safe nudges, the Almanac) → D2 (minds and mercy) → D3 (arrivals, witch mode, posses).

D0 is cheap and useful now, as pacing analytics for playtests. The open decisions are C55, 05 Q8 and the foresight rule.

## Deferred from reviews and playtests

_Status checked 2026-10-12; the feature queue above is Ellie's unprioritized queue._

- **Performance.** Wave 4 cut Iron Ford from 39.8 to 17.1 ms/game-hour on desktop; the <5 ms/hour phone gate remains unmet. Readiness projections are the largest remaining cost (`docs/impl/perf/2026-10-11-wave4.md`); real device measurements are pending.
- **Persecution ladder.** Rungs 0–3 exist; rungs 4–6 and hunts remain M8 work. Validate escalation pacing with injected-misfortune and fair-play fixtures.
- **Rumor mutation prose.** Lineage/mutation and real belief transfer are built; Chronicle variants still lack explicit narration of how the telling changed.
- **Long-run social/save growth.** Memory caps, weekly consolidation, packed saves and Explain interning exist. County-scale retention/compaction and save-budget evidence remain ahead; fae 1b's generated seed 2 grew 6.7%, mostly social state (`playtests/2026-10-12-fae1b/report.md`).
- **Listener-heard dialogue repeats.** Speaker cooldown retention is fixed, but 30-day repeats remain 32.8% in Iron Ford and 38.5% in generated town 7; listener memory/ambient talk pacing remain (`docs/impl/reviews/2026-10-12-w5-social-fixes.md`).
- **Fae charm spread/rota.** Slice 1b is implemented; broad spread and a year-long rota remain partial. Refusal costs are in progress under Ellie's 2026-10-12 ruling; remeasure after they land.
- **County name qualifiers.** Names are unique in v3, but qualifiers can stack (e.g. “West Upper Silver Mills”).

Winter relief (M4 #3) and M5 slice 1 are active work, not deferred features. The M5 plan is `docs/impl/M5-PLAN.md`; its recommendations remain proposals pending the decisions in `08`.
