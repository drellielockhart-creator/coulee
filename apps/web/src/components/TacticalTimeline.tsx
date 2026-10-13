import type { AvailableAction } from '@coulee/play';
import type { PlayObservation } from '../protocol.ts';
/** Thin shell: deadlines, affordances and commands all arrive from the shared fair session. */
export function TacticalTimeline({
  observation,
  run,
  busy,
}: {
  observation: PlayObservation;
  run: (action: AvailableAction) => unknown;
  busy: boolean;
}) {
  if (!observation.tactical) return null;
  return (
    <section aria-label="Tactical timeline">
      <p role="status">{observation.tactical.timeline}</p>
      <p>Time waits for your order. Resume stops when your action finishes.</p>
      <div className="act-buttons">
        {observation.actions
          .filter((a) => a.id.startsWith('tactical:'))
          .map((a) => (
            <button type="button" key={a.id} disabled={busy} onClick={() => run(a)} style={{ minHeight: 56 }}>
              {a.label}
            </button>
          ))}
      </div>
    </section>
  );
}
