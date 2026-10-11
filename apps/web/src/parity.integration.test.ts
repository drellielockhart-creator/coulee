/** Real-content parity: web constructors produce the same journaled Commands as the CLI. */
import { loadContentOrThrow } from '@coulee/content';
import { createSim, type ItemId, idsOf, step } from '@coulee/core';
import { expect, it } from 'vitest';
import { cmd } from './lib/commands.ts';

it('journals web action payloads unchanged in a seed-42 Iron Ford sim', () => {
  const content = loadContentOrThrow();
  const sim = createSim(content, { scenarioId: 'iron_ford', seed: 42, withPlayer: true });
  const actorId = sim.world.meta.playerId;
  if (actorId === null) throw new Error('scenario must create a player');
  const target = idsOf(sim.world.actors).find((id) => id !== actorId);
  const store = idsOf(sim.world.places).find((id) => sim.world.provisions.stores[id]);
  if (target === undefined || store === undefined) throw new Error('Iron Ford must have people and a store');
  const commands = [
    cmd.doActivity(actorId, 'sleep'),
    cmd.interact(actorId, 'gossip', target),
    cmd.buy(actorId, store, 'flour', 1, false),
    cmd.setRations(actorId, null, 75),
    cmd.eat(actorId, 99999 as ItemId, 'raw', 1),
    cmd.pack(actorId, 99999 as ItemId, 1, null),
  ];
  step(sim, commands);
  expect(sim.world.log.events.filter((e) => e.kind === 'core.command').map((e) => e.data.command)).toEqual(commands);
  expect(sim.world.time).toBe(60);
});
