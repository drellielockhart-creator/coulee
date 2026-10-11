# Coulee (working title)

A simulationist fantasy-frontier adventuring game: a 3.5e Player's Handbook crossed with RimWorld, set in a fae-haunted alternate Driftless Region in 1855.

You play one character, either an **adventurer** outfitting at the edge of the faerie wilds or a **witch** bound to the Faerie Prince and hunted by the villages she curses. The county's people keep living, gossiping, and holding grudges whether or not you're watching.

## Status
Design and prototype in progress.

Commands and working rules: [CLAUDE.md](CLAUDE.md).

Current implementation status and next work: [NEXT_SESSION.md](NEXT_SESSION.md).

## Where to start reading
1. `design-docs/00-vision-and-pillars.md`: the canonical vision, pillars, and glossary. Read this first.
2. `design-docs/08-open-questions.md`: the decision checklist.
3. `design-docs/04-social-simulation.md`: the heart of what makes this game different.
4. Everything else, as interest takes you:

| Doc | Covers |
|---|---|
| [00-vision-and-pillars.md](design-docs/00-vision-and-pillars.md) | Canonical vision, pillars P1–P8, glossary, decisions log |
| [01-setting.md](design-docs/01-setting.md) | Driftless lore, Glacier Compact, courts, Hollin County flavor and worldgen constraints |
| [02-rules-and-characters.md](design-docs/02-rules-and-characters.md) | Abilities, skills, feats, classes, Vigor/Wounds, timed combat, magic |
| [03-gear-and-economy.md](design-docs/03-gear-and-economy.md) | Outfitter's Book, gear, provisions, spoilage/preparation, encumbrance, prices and trade |
| [04-social-simulation.md](design-docs/04-social-simulation.md) | Memory, belief, opinion, rumors, Figures, grudges and persecution |
| [05-world-sim-and-storyteller.md](design-docs/05-world-sim-and-storyteller.md) | Region/site maps, LOD, ecology, weather, survival, Director and Chronicle |
| [06-game-modes.md](design-docs/06-game-modes.md) | Adventurer/Witch loops, creation, Pact, Woe/Tithe/Drift, curses and legacy |
| [07-architecture-and-prototype.md](design-docs/07-architecture-and-prototype.md) | TypeScript architecture, deterministic core, saves, testing and milestones |
| [08-open-questions.md](design-docs/08-open-questions.md) | Current decision checklist and ten priority questions for Ellie |
| [09-consistency-notes.md](design-docs/09-consistency-notes.md) | Current conflicts/resolutions, ownership map, gaps and history |
| [10-psyche.md](design-docs/10-psyche.md) | Id/Ego/Superego, anxiety, defenses, Persona/Shadow, dreams and fae minds |
| [11-interface-and-platforms.md](design-docs/11-interface-and-platforms.md) | Pocket/Folio/Desk interfaces, controls, accessibility, PWA packaging and visual budgets |
| [12-peoples.md](design-docs/12-peoples.md) | Humans, elves, shadow-faekin, goblins; lore proposals, concealment and culture data |
| [adr/0001-typescript-stack.md](design-docs/adr/0001-typescript-stack.md) | Accepted TypeScript PWA stack, numeric/determinism invariants and canonical clock |
| [adr/0002-headless-play-and-agent-playtesting.md](design-docs/adr/0002-headless-play-and-agent-playtesting.md) | Playable headless sessions, UI Command parity, fair observations and every-milestone agent playtests |
| [adr/0003-procedural-world-generation.md](design-docs/adr/0003-procedural-world-generation.md) | Procedural counties, seeded layers/history, authored fixtures, seed QA and M5a |
