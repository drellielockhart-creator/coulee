# ADR 0003: Procedural world generation is the target

**Status:** Accepted (Ellie, 2026-10-10: "I want it to ultimately be procedural generation")
**Amends:** 05 §1.2 (hand-authored county skeleton with procedural flesh) and 01's fixed Hollin County.
**Builds on:** ADR 0001 (determinism, content-as-data) and ADR 0002 (headless play).

## Decision
1. **Procedural by default.** A new game generates the county: terrain, hydrology, ecology, fae intensity, settlements, roads, sites, population, and pre-play history. Hand-authored worlds remain a supported input format, used for the tutorial, curated "story seeds," regression fixtures, and golden tests.
2. **The sim never knows where its world came from.** `packages/worldgen` is pure and deterministic and has no IO. It emits exactly the same data shapes (sites, places, households, actors, relationships, pantries) that authored TOML scenarios produce, so core and UI have no generator-specific paths. The hand-authored `iron_ford` scenario is the first fixture.
3. **Generation is layered and seeded per layer.** Each layer uses `rng(seed, stream, …)` with its own stream and a `gen_version`, so later layers can change without reshaping earlier ones.
   1. **Terrain:** a Driftless dissected plateau. Dendritic drainage comes first, then valley carving, then a dolomite caprock over sandstone (bluffs where valleys cut the cap), then karst (sinkholes, caves). The 40-acre raster stores elevation, aspect, soil, and geology layer.
   2. **Hydrology:** the big river edge, creeks, springs at the sandstone/dolomite contact elevation, floodplains, and fords.
   3. **Ecology:** vegetation by aspect, slope, and soil (goat prairie on steep S/SW slopes, maple-basswood on N slopes, oak savanna on ridgetops, floodplain forest), and wildlife stocks.
   4. **Fae intensity field:** seeded from terrain uncanniness (caves, springs, mounds-that-aren't-real-mound-types, old-growth), then smoothed. 01's Glacier Compact lore explains why.
   5. **Settlement siting:** suitability scoring for fords, mill seats on creeks with fall, river landings, lead-mineral ranges, and prairie farmland, plus era density (1855).
   6. **Routes:** ridge roads and valley roads form the region graph (05's graph-over-raster). Fae paths are added as non-geographic edges.
   7. **Town and site layout:** plats along creeks and roads, with buildings by institutional role. Site maps are generated on demand (05 §2.2, unchanged).
   8. **Population:** census by era and peoples mix (12), then households and kinship, then occupations, then **named actors** materialized lazily per 00.
   9. **History pre-roll:** run the headless social sim for N years (default 5–10, fast T1/T2) before play starts, so grudges, debts, rumors, courtships, and Figures already exist. The chronicle of the pre-roll becomes "local history" the player can learn.
   10. **Set pieces:** 01's authored NPC seeds and anchor sites (the Prince's seat, the mine district, the innkeeper's grudge) become **templates with placement constraints** that the generator casts onto suitable generated people and places.
4. **Constraints over coordinates.** Authored content says *what must exist and what it must be near* ("a ford town on a mid-size creek within a day of a fae anchor"), not *where*. A curated seed is a generator seed plus constraints, optionally pinned.
5. **Generation is playtested.** Agent playtests (ADR 0002) run across many seeds. A **worldgen QA harness** flags degenerate worlds automatically: no ford town, unreachable sites, an unplayable starting food situation or county-wide collapse (the threshold is open: 08 Q08; a hungry spring and individual household hardship are intended and reported, not rejected), a fae intensity desert, a town with no tensions.

## Consequences
- The iron_ford fixture and today's schemas stay valid.
- **The renderer must draw from world data** (heightfield, water, footprints), never from baked layouts. That's already the plan, but it needs enforcing.
- 01's Hollin County becomes the *flavor bible and constraint set* for generated counties, not a fixed map. Its named places are candidates for name pools and set pieces.
- Phone budget: a ~800 sq mi county at 40-acre resolution is about 13k cells. Generation runs once in the worker at new game, target under 3 s on a mid phone with the history pre-roll included (to be verified).
- **Milestone impact:** worldgen slots in as **M5a**, before region-map travel (M5). Until then, sites can be generated from a hand-written region context, with the town site generator first.
