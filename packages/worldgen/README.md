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
is descriptive place data, not a heightfield or hydrological simulation. No
county graph, history pre-roll, ecological production or long-term wholesale
restocking is generated. The integrated social and chronicle systems simulate the selected tensions.
Version 2 varies street plats, institutional names and denominations, household
cultures and a weighted ten-card tension deck. Naming has its own RNG key;
pinning the displayed town name cannot move geography. Authored full names are
excluded. Version 1 recipes are rejected explicitly rather than silently rerolled.

The social API change is only additive compatibility for memory fields already
passed by belief code (`aboutId`, `did`, `count`, `since`); it adds no behavior to
the stub. The `justfile` uses `node --import tsx` for scripts so restricted
sandboxes do not need the `tsx` executable's IPC socket. Build the web content
artifact with `just bundle` before the first `just check` in a fresh worktree.
