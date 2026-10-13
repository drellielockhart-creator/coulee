# M6 unarmed brawl distribution

1,000 trials, seeds 1–1000, `tavern_instant`, standard newcomer versus adjacent Lucius Vance.
The newcomer explicitly orders one unarmed attack whenever ready, accepts offered surrender,
and otherwise advances to the next heap deadline. Lucius uses the ordinary psyche arbitration.
No actor stats, health, AI policy or RNG were modified. Outcome counters are post-run measurements.

| At least one outcome per brawl | Count | Rate |
| --- | ---: | ---: |
| Knockout | 270 | 27.0% |
| Light nonbleeding bruise | 84 | 8.4% |
| Death | 0 | 0.0% |

Knockout/bruise rows can overlap. Endings are exclusive: 519 flight, 270 knockout,
211 accepted submission; no unfinished trials. Mean time to the ending: 16.7035 seconds.
Nonlethal criticals make light bruises; the current unarmed model contains no lethal accident
rule. This is a distribution for this fixture and explicit attack policy, not firearm tuning.
Vigor is unchanged from the pre-M7 rules, and all actors use the same health paths.

Reproduction: run the following from the repository root after saving it as
`runs/scratch/m6-brawl-distribution.ts`; `node --import tsx runs/scratch/m6-brawl-distribution.ts`.

```ts
import { writeFileSync } from 'node:fs';
import { loadContentOrThrow } from '../../packages/content/src/index.ts';
import { advanceUntil, instantOf, needs } from '../../packages/core/src/index.ts';
import { PlaySession, sessionSimOf } from '../../packages/play/src/index.ts';
const content = loadContentOrThrow(['base']);
const rows = [];
for (let seed = 1; seed <= 1000; seed++) {
  const session = PlaySession.create(content, { source: 'tavern_instant', seed });
  session.advance(60);
  const sim = sessionSimOf(session), pc = session.playerId;
  const command = session.observe().actions.find((a) => a.command.kind === 'tactical.attack')?.command;
  if (command?.kind !== 'tactical.attack') throw Error('No fair adjacent target');
  const target = command.data.targetId;
  advanceUntil(sim, instantOf(sim.world), [command]);
  for (let n = 0; n < 1000; n++) {
    const s = sim.world.tactical;
    if (!s) throw Error('No scene');
    if (s.brawls?.[0]?.endedAt !== undefined) break;
    const p = s.participants[pc];
    if (p && !p.action && needs.canAct(sim.world, pc)) {
      const kind = s.participants[target]?.submitted ? 'tactical.accept' as const : 'tactical.attack' as const;
      advanceUntil(sim, instantOf(sim.world), [{ kind, actorId: pc, data: { targetId: target } }]);
    }
    const next = s.heap[0]?.instant;
    if (next === undefined) throw Error(`Stall ${seed}`);
    advanceUntil(sim, next);
  }
  const pair = [pc, target];
  rows.push({ seed, outcome: sim.world.tactical?.brawls?.[0]?.outcome ?? 'unfinished', ticks: instantOf(sim.world),
    knockouts: pair.filter((id) => needs.combatUnconscious(sim.world, id)).length,
    injuries: pair.filter((id) => (needs.healthOf(sim.world, id)?.bruises ?? 0) > 0).length,
    deaths: pair.filter((id) => !sim.world.actors[id]?.alive).length });
}
const summary = { trials: rows.length, knockouts: rows.filter((r) => r.knockouts > 0).length, injuries: rows.filter((r) => r.injuries > 0).length, deaths: rows.filter((r) => r.deaths > 0).length,
  endings: Object.fromEntries([...new Set(rows.map((r) => r.outcome))].sort().map((outcome) => [outcome, rows.filter((r) => r.outcome === outcome).length])),
  meanTicks: rows.reduce((sum, r) => sum + r.ticks, 0) / rows.length };
writeFileSync('runs/scratch/m6-brawl-distribution.json', JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
```
