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

## Deferred from reviews and playtests
- **Psyche and provisions performance.** About 12–15 ms per game-hour on desktop against a budget under 5 for phones. The determinism review lists the remaining hotspots.
- **Persecution ladder.** It rarely climbs past rung 1 in a seed-42 year.
- **Rumor mutation.** Mutations aren't narrated as such; the chronicle shows variants as separate rumors.
- **Captive chainmen.** The two confined chainmen have no food source; decide on a narrative fix such as fae food.
- **Social memory size.** Social memories dominate save size, so consolidate more aggressively.
- **Web PlaySession.** The web is a spectator UI today. Adopt PlaySession for a PC (UI parity, ADR 0002) when the Outfitter/M4 UI lands.
- **Low-severity review findings.** See the review JSON in the session scratch notes; fold them in as each area is touched.
