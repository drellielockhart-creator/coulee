# Coulee (working title)

Coulee is a simulationist fantasy-frontier game: 3.5e-shaped rules crossed with RimWorld, set in a fae-haunted alternate Driftless Wisconsin in spring 1855. You play one character among people with the same sheets, needs, memories and rules. The design follows a living county whose people keep working, gossiping and holding grudges beyond your sight.

The catalog feeling matters: budget $50 between a bedroll, a second canteen and a hatchet, then live with the weight, water, fuel, preparation and spoilage. Stories come from systems colliding, with legible checks and a Chronicle of what happened. Adventurer and witch starts are planned ways into the same world; death, retirement or departure closes a run.

As of 2026-10-12, the M1–M3 town slice, survival, headless/web PlaySession, M4 storefront/Kit Sheet, and fae slices 1a/1b are integrated. Town generation v2 and county stage v3 are built. Winter relief, charm refusal costs and M5 slice 1 are in progress; census, history pre-roll, non-town layouts, playable county travel and combat remain ahead. Full milestone and phone/cross-engine gates are still pending.

Run from the repository root with the installed dependencies:

```sh
just check
just run play --session runs/my-play --new --scenario iron_ford --seed 42
just run play --session runs/my-play "help"
just web
```

Start with [the vision and pillars](design-docs/00-vision-and-pillars.md), then [ADRs 0001–0003](design-docs/adr/) and [milestone status](design-docs/07-architecture-and-prototype.md). [Module ownership](docs/impl/MODULES.md), [the M5 plan](docs/impl/M5-PLAN.md), [the backlog](docs/impl/BACKLOG.md), [headless play instructions](packages/play/README.md) and [worldgen instructions](packages/worldgen/README.md) cover implementation; playtest reports live in [playtests/](playtests/). Working rules are in [AGENTS.md](AGENTS.md).

License: not yet chosen.
