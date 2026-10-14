import type { ActorId } from '../ids.ts';
import type { World } from '../world.ts';
/** Exact elapsed form of linear thought decay; durable anxiety, shadow and defenses persist. */
export function dormantThoughtDecay(world: World, ids: readonly ActorId[], hours: number): void {
  for (const id of ids) {
    const p = world.psyche.byActor[id];
    if (!p) continue;
    for (const thought of p.thoughts) {
      const loss = Math.min(thought.intensity, hours * thought.decayPerHour);
      thought.intensity -= loss;
      if (loss) {
        const term = thought.reasons.find((t) => t.source === 'decay');
        if (term) term.value -= loss;
        else thought.reasons.push({ source: 'decay', label: 'Fading', value: -loss });
      }
    }
    p.thoughts = p.thoughts.filter((t) => t.intensity > 0);
    p.chosen = null;
  }
}
