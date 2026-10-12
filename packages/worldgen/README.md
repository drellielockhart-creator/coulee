# Town generation, version 2

`generateTown(content, { genVersion: GEN_VERSION, seed, preset?, constraints? })`
returns `{ scenario, site, places, report }`. `scenario`, `site` and `places` are
ordinary `ScenarioDef`, `SiteDef` and `PlaceDef` records. `townContent(content,
town)` installs them in a new content bundle without changing the input. Core
and the renderer need no generator-specific branch. Sites carry optional local
landmark names for chronicle prose.

The uint32 world seed is independent of the simulation seed. Supported presets
are `coulee` (default) and `river`. Constraints are `townName`, `onRiver`, and
`farmsteads` (3–5). Unsupported versions, presets and impossible constraints
fail explicitly. The current slice creates roughly 23–33 actors, depending on farm and
landing choices, rather than materializing an entire county.

Terrain, settlement, population and tensions have independent, fixed salts on
core's `worldgen` RNG stream, keyed by generator version. Actor draws also have
stable actor keys. Places use existing tags, footprints and models. Terrain
includes a creek ford, mill seat, spring at the rock contact, limestone caps,
sandstone faces, floodplain, entering valley/ridge roads and optional landing.

Every call validates schemas and references, footprint separation, tile
reachability, homes and pantries, workplaces, names, concealment, fae anchors
and playable tensions, then runs a disposable 30-day simulation. QA does not
advance the returned starting scenario. There is no retry or silent seed
substitution. Rejection names the seed and failing checks.

The provisional Q08 collapse threshold rejects at least 50% deaths, or at
least 75% of the population receiving less than 25% of energy requirements on
five or more of the final seven days. It reports shortages and individual
hardship without rejecting them. This threshold is an engineering detector,
not a settled design decision about acceptable hunger. Nutrition uses the
sim's recorded intake and energy obligations. Generated pantries use ordinary
items, packaging, cookware, fuel and household storage.

Place names and descriptions come from a text stage (`src/text.ts`, word stock in
`src/text-data.ts`) that runs after population, once owners are known. Every place gets a name
that is distinct in its town (owner, landmark or direction: "Tregear Farm", "Water Street, north
of the ford", "Kvale's Smithy") and a description built from its own features: aspect, soil and
water, the household, its stock and crop, and one thing you would remember. There are no
coordinates and no fae lore in base text. It draws from its own RNG keys (`text:<place>`), so
geography, cast and tensions of a seed do not move, and pools are dealt without replacement so
twin places cannot read alike. QA check `place text` (`placeTextProblems`) fails a town with a
repeated name or description, a coordinate, or unfinished text.

Pure reports leave `elapsedMs` null. `generateTownStages` yields each completed
layer so the CLI can measure durations outside the pure package. The 30-day
check dominates generation cost; this is not a phone performance benchmark.
The bundle hash is the same canonical UTF-8 SHA-256 used by the authored loader;
it remains equal after a TOML export/reload.

From the repository root:

```sh
just run run --scenario gen:town --seed 42 --days 30
just run run --scenario gen:town --seed 9 --world-seed 42 --days 7
just run gen town --seed 42 --out runs/gen-42
just run gen town --seed 42 --preset river --out runs/river-42
just run inspect "Thankful Fenn" --run runs/gen-town-42
```

The export is a content mod containing `places/<id>.toml`,
`scenarios/<id>/{00-scenario,10-households,20-actors,30-social,40-belief,50-stocks}.toml`,
`recipe.json` and `report.md`. Edit and load it through the authored route:

```sh
just run run --mods base,../runs/gen-42 --scenario town_v2_42 --seed 9 --days 7
```

Run manifests include the full generated recipe (or authored scenario ID),
simulation seed, content hash, and an empty command log for these all-AI CLI
runs. `inspect --run` restores the source and mod list. The authored Iron Ford site supplies the same landmark fields.

`packages/cli/test/worldgen.test.ts` checks all seeds 1–50, including 30-day QA,
determinism, seven-day authored/generated runs, negative detectors, river and
farm constraints, manifest replay, and TOML round trips. It writes the seed
matrix to `runs/worldgen-qa.json`. The invariant checker scans this package as
well as core; runtime dependencies are core and content's browser-safe schema
entry, never the Node content loader.

Current limitations: the renderer infers elevation and stream curves; geology
is descriptive place data, not a heightfield or hydrological simulation. The standalone town has no county context unless supplied. County generation is
described below; history pre-roll, ecological production and long-term wholesale
restocking remain unimplemented. The integrated social and chronicle systems simulate the selected tensions.
Version 2 varies street plats, institutional names and denominations, household
cultures and a weighted ten-card tension deck. Naming has its own RNG key;
pinning the displayed town name cannot move geography. Authored full names are
excluded. Version 1 recipes are rejected explicitly rather than silently rerolled.

The social API change is only additive compatibility for memory fields already
passed by belief code (`aboutId`, `did`, `count`, `since`); it adds no behavior to
the stub. The `justfile` uses `node --import tsx` for scripts so restricted
sandboxes do not need the `tsx` executable's IPC socket. Build the web content
artifact with `just bundle` before the first `just check` in a fresh worktree.


## County generation (M5a slice 2, version 3)

`generateCounty({genVersion: COUNTY_GEN_VERSION, seed, preset?, size?, layerVersions?, constraints?})` returns the six pure layers, graph, recipe, SHA-256 hashes and integer QA statistics. Default: 100 × 128 forty-acre cells, 800 square miles. Dimensions accept 32–256; impossible constraints reject. Town generation keeps its independent version.

Version 1 passed topology QA but rendered a comb. Version 2 computes integer fractal value noise (six octaves, integer smooth interpolation), tilted toward the western big river; a priority flood resolves depressions with seed-keyed positive flat gradients. D8 chooses maximum drop divided by step length using integer cross-products and seed-keyed ties. Reverse flood order accumulates contributing area. Channel-only Strahler orders drive incision beneath a gently tilted plateau; wall expansion leaves broad interfluves. Caprock/contact crossings produce bluffs.

Channel initiation is calibrated to the nearest 25-cell contributing area within 20–40 cells (1.25–2.5 sq mi), accepting a count-weighted Horton ratio of 3–5. This is an explicit morphometric constraint, not independent evidence of realism; it changes which computed runs are wet, never their directions. The same terrain-stage orders drive carving and hydrology. No seed rerolls or hand-stamped basins.

Springs are spaced contact points near first/second-order heads. Caves and sinkholes are spaced valley-wall/caprock points. Fords are shallow gravel reaches with an explicit three-cell transverse bank-to-bank trail, independent of subsequent wagon roads. Mills are ranked order-2–4 falls near those trails; settlement siting adds dispersed farmstead clusters so every selected seat has a settlement within three miles. Main villages retain two ford towns, two landings, a mill and diggings. Eight-neighbor roads favor uplands and valley floors, penalize boundaries and bridges, and cannot cross diagonal water unnoticed. D8 segment lengths and grades are accounted for.

### Before/after audit

Seeds **1–64**, `coulee`; every value is **minimum / mean / maximum**. Both presets pass the full 128-county matrix. Version-1 channel orders were recomputed from channel heads for this comparison because its stored orders incorrectly included dry hillslopes. Thus Horton alone would not have caught the comb.

| Metric | Version 1 | Version 2 | Gate |
| --- | --- | --- | --- |
| Axis-aligned segments (%) | 100.00 / 100.00 / 100.00 | 39.80 / 47.30 / 53.60 | ≤60 |
| Largest compass direction (%) | 64.60 / 73.95 / 80.10 | 20.00 / 26.34 / 33.70 | ≤35 |
| Count-weighted Horton ratio | 3.54 / 4.12 / 4.89 | 3.81 / 4.44 / 5.00 | 3–5 |
| Creek km / sq mi | 1.07 / 1.15 / 1.26 | 0.85 / 0.92 / 0.99 | 0.65–1.80 |
| Parallel creek cells (%) | 10.50 / 15.90 / 23.50 | 1.30 / 3.49 / 7.20 | ≤10 |
| Road boundary length (%) | 0.30 / 14.90 / 35.80 | 0.20 / 0.39 / 0.70 | ≤5 |
| Road ridge/valley length (%) | 65.60 / 80.20 / 88.80 | 76.90 / 86.56 / 92.70 | ≥70 |

| Mean run length by order, km | Version 1 | Version 2 |
| --- | --- | --- |
| 1 | 2.94 / 3.43 / 3.95 | 2.21 / 2.73 / 3.15 |
| 2 | 5.05 / 7.15 / 10.47 | 3.72 / 6.09 / 8.05 |
| 3 | 8.11 / 15.22 / 25.21 | 7.53 / 13.84 / 27.45 |
| 4 | 0.94 / 13.84 / 30.78 | 4.30 / 27.36 / 81.12 |
| 5 | 1.21 / 1.81 / 2.41 | 4.83 / 22.26 / 45.55 |

Run lengths use maximal constant-order reaches, including the outgoing segment at a confluence. Missing orders are omitted from this table (raw artifacts use zero). First/second-order means are also gated at 4,000–20,000 / 4,000–60,000 ft. Horton is `sum(Nu) / sum(Nu+1)`, weighting adjacent ratios by receiving runs and including terminal orders; per-order run counts are exported. Parallel detection requires another same-order, same-direction run within two cells, excluding the same run and confluences within four downstream steps. Road corridor classification uses retained loess uplands or floodplain cells; shares are length-weighted. These are raster proxies, not surveyed road alignments.

Density gate 0.65–1.80 km/sq mi is a coarse mapped-channel design band: [Wisconsin DNR reports over 1,720 stream miles across 1,860 square miles](https://dnr.wisconsin.gov/topic/Watersheds/basins/gpsp/spbasin), about 1.49 km/sq mi, including small headwaters unresolved by this raster/threshold. The lower bound allows that omission; it is not a claimed measured Driftless-wide interval. County-scale gates apply at 800 sq mi; smaller windows omit the Horton gate and allow up to 45% in one direction because of outlet/boundary sampling.

| Selected features | Version 1 | Version 2 | Gate per 800 sq mi |
| --- | --- | --- | --- |
| Fords | 477.00 / 564.61 / 666.00 | 35.00 / 44.75 / 55.00 | 15–70 |
| Springs | 1269.00 / 1409.02 / 1502.00 | 75.00 / 99.19 / 125.00 | 50–150 |
| Caves | 863.00 / 940.39 / 1017.00 | 40.00 / 40.00 / 40.00 | 15–70 |
| Sinkholes | 148.00 / 178.17 / 216.00 | 30.00 / 30.00 / 30.00 | 10–60 |
| Mill seats | 110.00 / 140.52 / 181.00 | 14.00 / 20.89 / 29.00 | 10–40 |

Cave/sinkhole target caps are deliberately 40/30 at default area; spring/ford targets vary by their own layer keys. All point classes enforce circular spacing (springs 5 cells, fords 6, mills 7, caves 8, sinkholes 10). Ecology still supplies five vegetation classes; fae supplies 6–10 anchors, with protected-site exclusion before every hook and negative Ice sources.

### Reproduction and validation

```sh
just run gen county --seed 42 --out runs/county-42 --town
just test packages/cli/test/county.test.ts
rsvg-convert runs/county-42/map.svg -o runs/county-42/map.png
just check
```

The matrix writes `runs/county-qa.json` and `runs/county-qa-summary.json` (both presets). Revision comparison: `runs/county-before.json`, `runs/county-after.json`, `runs/county-comparison.json`, and `runs/county-revision-report.md`. The old source snapshot and comparison driver are retained under `runs/scratch/` for audit. SVGs merge equal-color raster runs into paths and quantize elevation shading: reviewed seeds 7/42/63 remain below 0.60 MB each (limit 1.5 MB). PNGs: `runs/county-7/map.png`, `runs/county-42/map.png`, `runs/county-63/map.png`.

Focused generation with hashing and QA: 92.00 / 103.70 / 187.00 ms (minimum / mean / maximum), below ~200 ms/seed on this desktop; ×4 phone estimate 368.00 / 414.81 / 748.00 ms. Excludes history pre-roll, town survival QA, SVG/PNG rendering. Prior v1 focused timing was 78–141 ms (88 ms mean); benchmark conditions are not controlled. Real phone/cross-browser measurements remain pending.

Tests protect exact repeat output, earlier-layer hashes under every later-layer version change, integer output, protected sites, connectivity, channel confluences, dry head exclusions, feature spacing, crossing geometry, and SVG size. A synthetic connected comb and boundary-road fixture fails the new shape gates. County-to-town context/export/reload remains covered. The no-context town regression fixture checks default-town seeds 1–50, byte for byte; the prior audit also checked both presets’ 100 layouts. No town generation code or golden snapshots changed in this revision.

Changed this revision: `src/county/{common,terrain,nature,types,index,metrics,routes,settlements,qa,svg}.ts`, `packages/cli/test/county.test.ts`, and this README. Additive fields include terrain channel orders, ford trail cells and scalar morphology statistics; county generation version is 2. No edits to core/play/web, no content domains, no commits.

Deferred: M5 travel, non-town layouts, fair starting-food/travel acceptance, real device benchmarks, Q07 Native-nations content, Q08 census/history pre-roll, and the fae reservoir.

Final validation: `VITEST_MAX_WORKERS=4 just check` passed: 645 tests / 61 files, invariants (189 files), and content validation (91 files). No commits.


### County polish (version 3)

County recipes now use version 3; settlement/cartography and route layer versions
advance to 2. The v2 RNG namespace and the first four default layer versions stay
fixed. All 64 `coulee` terrain, hydrology, ecology and fae hashes match the saved
v2 fixture, and settlement cells are unchanged. Town generation retains version
2 and its existing no-context byte regression.

The settlement stage adds `namedFeatures`: named creek reaches (every wet creek
cell belongs to exactly one), plus major valleys. At confluences the largest
contributing tributary retains the name. Names use local geology, vegetation,
landmarks, existing creek names and Hollin family templates from design doc 01.
Settlements record a founding-family surname for the future census and a nearby
feature reference; no census actors or history are invented. Generic parts
follow the site: Ford, Landing, Mills, Diggings, Prairie, Ridge, Hollow, Valley
or Settlement. Geographic qualifiers resolve collisions without numeric names.
SVG creek/valley labels reserve space around settlement labels.

Road cost adds quadratic grade, distance from interfluve crests, local relief,
stronger hillside penalties and explicit ford/bridge costs. Distance fields are
computed once per county, and shared roads still form the connected region graph.
Each road exports integer `sinuosityPm` (path length divided by Euclidean endpoint
distance × 1000); QA statistics include the mean and maximum. Straight connectors
remain possible across level ground. Portable SHA-256 uses a typed UTF-8 buffer
and generation reuses its computed QA metrics, preserving all hash values while
reducing allocations and repeated work.

Seeds 1–64 (`coulee`): repeated settlement-name occurrences **176 → 0**;
affected counties **52 → 0**. Unweighted mean road-edge sinuosity **1.1266 →
1.1993** (3,947 / 3,660 edges); minima 1.000 / 1.000, maxima 4.040 / 4.246.
Reviewed seeds 7/42/63: **1.1178 / 1.1313 / 1.1244 → 1.1862 / 1.2498 /
1.2143**. Their longest constant-direction road runs fall from **35 / 17 /
15 cells to 13 / 12 / 11**. All existing county QA bands pass all 128 counties across both presets. Standalone full
generation, including hashing/QA: **85 / 97 / 170 ms** minimum/mean/maximum;
all 64 samples are below 200 ms. Final measurement excludes competing simulation tests; timing varies with shared CPU load and cold
startup; rendering and town survival QA are excluded.

Audit artifacts: `runs/county-polish-before.json`, `runs/county-polish-after.json`;
PNGs rendered with `rsvg-convert`: `runs/county-{7,42,63}/map.png`.


Version-3 validation: `VITEST_MAX_WORKERS=4 just check` passed: **667 tests / 63
files**, invariants (**191 files**), content validation (**91 files**). Includes
county-to-town export/reload and the unchanged 50-seed no-context town fixture.
No commits.
