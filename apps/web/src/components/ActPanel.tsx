/**
 * Act (11 §2.1): give your character an order. OWNER: module:web.
 * A rail button, not a section buried under every dossier tab. Orders are urges the character
 * weighs alongside appetite and conscience (P2); they apply on the next hour.
 */
import { useState } from 'react';
import { cmd } from '../lib/commands.ts';
import { useUi } from '../state/ui.ts';
import { useSimCtx, useVm } from './ctx.ts';
import { Empty } from './ui.tsx';

export function ActPanel() {
  const sim = useSimCtx();
  const vm = useVm();
  const selected = useUi((s) => s.selectedActor);
  const [activity, setActivity] = useState('');
  const [interaction, setInteraction] = useState('');
  const others = vm.actors.filter((a) => a.id !== vm.playerId && a.alive);
  const [target, setTarget] = useState<number | null>(
    selected !== null && selected !== vm.playerId ? selected : (others[0]?.id ?? null),
  );
  if (vm.playerId === null) return <Empty>There is no character of yours to order.</Empty>;
  const pc = vm.playerId;
  const who = others.find((a) => a.id === target) ?? null;
  return (
    <div className="act" data-testid="act">
      <p className="hint">Your character weighs orders alongside appetite and conscience.</p>
      <label className="field">
        Activity
        <select value={activity} onChange={(e) => setActivity(e.target.value)}>
          <option value="">Choose an activity</option>
          {sim.actions.activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={!activity} onClick={() => sim.command(cmd.doActivity(pc, activity))}>
        Request activity
      </button>
      <h3 className="section-head">
        <span>Speak with someone</span>
      </h3>
      {others.length === 0 ? (
        <Empty>No one else is here.</Empty>
      ) : (
        <>
          <label className="field">
            With
            <select
              value={target ?? ''}
              onChange={(e) => setTarget(e.target.value === '' ? null : Number(e.target.value))}
            >
              {others.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Interaction
            <select value={interaction} onChange={(e) => setInteraction(e.target.value)}>
              <option value="">Choose an interaction</option>
              {sim.actions.interactions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!interaction || !who}
            onClick={() => {
              if (who) sim.command(cmd.interact(pc, interaction, who.id));
            }}
          >
            Request interaction{who ? ` with ${who.shortName}` : ''}
          </button>
        </>
      )}
    </div>
  );
}
