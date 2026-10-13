import { mkdirSync, writeFileSync } from 'node:fs';
import { loadContentOrThrow } from '../../packages/content/src/index.ts';
import { advanceUntil, instantOf, needs } from '../../packages/core/src/index.ts';
import { PlaySession, sessionSimOf } from '../../packages/play/src/index.ts';

const content = loadContentOrThrow(['base']);
const rows = [];
for (let seed = 1; seed <= 1000; seed++) {
  const session = PlaySession.create(content, { source: 'tavern_instant', seed });
  session.advance(60);
  const sim = sessionSimOf(session),
    pc = session.playerId;
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
      const kind = s.participants[target]?.submitted ? ('tactical.accept' as const) : ('tactical.attack' as const);
      advanceUntil(sim, instantOf(sim.world), [{ kind, actorId: pc, data: { targetId: target } }]);
    }
    const next = s.heap[0]?.instant;
    if (next === undefined) throw Error(`Stall ${seed}`);
    advanceUntil(sim, next);
  }
  const pair = [pc, target];
  rows.push({
    seed,
    outcome: sim.world.tactical?.brawls?.[0]?.outcome ?? 'unfinished',
    ticks: instantOf(sim.world),
    knockouts: pair.filter((id) => needs.combatUnconscious(sim.world, id)).length,
    injuries: pair.filter((id) => (needs.healthOf(sim.world, id)?.bruises ?? 0) > 0).length,
    deaths: pair.filter((id) => !sim.world.actors[id]?.alive).length,
  });
}
const summary = {
  trials: rows.length,
  knockouts: rows.filter((r) => r.knockouts > 0).length,
  injuries: rows.filter((r) => r.injuries > 0).length,
  deaths: rows.filter((r) => r.deaths > 0).length,
  endings: Object.fromEntries(
    [...new Set(rows.map((r) => r.outcome))]
      .sort()
      .map((outcome) => [outcome, rows.filter((r) => r.outcome === outcome).length]),
  ),
  meanTicks: rows.reduce((sum, r) => sum + r.ticks, 0) / rows.length,
};
mkdirSync('runs/scratch', { recursive: true });
writeFileSync('runs/scratch/m6-brawl-distribution.json', JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
