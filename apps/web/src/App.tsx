/**
 * PLACEHOLDER screen (M0). OWNER: module:web, who builds the real pocket + desktop UI
 * (00 P6, 11-interface-and-platforms.md).
 */
import type { SPEEDS } from './protocol.ts';
import { useSim } from './useSim.ts';

const SPEED_LABELS: Array<[keyof typeof SPEEDS, string]> = [
  ['paused', '❚❚'],
  ['x1', '1×'],
  ['x3', '3×'],
  ['x6', '6×'],
  ['ultra', '»'],
];

export function App() {
  const { vm, error, stepMs, send, setSpeed } = useSim('iron_ford', 1);
  if (error)
    return (
      <main className="screen">
        <p className="error">{error}</p>
      </main>
    );
  if (!vm)
    return (
      <main className="screen">
        <p>Loading Hollin County…</p>
      </main>
    );
  const placeName = (id: number) => vm.places.find((p) => p.id === id)?.name ?? '—';
  return (
    <main className="screen">
      <header>
        <h1>Coulee</h1>
        <p className="date">
          {vm.time.dateText} · {String(vm.time.hour).padStart(2, '0')}:00 · {vm.time.moon.replaceAll('_', ' ')} moon
        </p>
        <nav className="speeds">
          {SPEED_LABELS.map(([s, label]) => (
            <button key={s} type="button" onClick={() => setSpeed(s)}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => send({ type: 'step', hours: 1 })}>
            +1h
          </button>
        </nav>
      </header>
      <section>
        <h2>{vm.scenario.name}</h2>
        <ul className="actors">
          {vm.actors.map((a) => (
            <li key={a.id}>
              <strong>{a.name}</strong> — {a.occupation}, {a.activity.verb} at {placeName(a.placeId)}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Chronicle</h2>
        <ol className="chronicle">
          {vm.chronicle.recent.slice(-8).map((e) => (
            <li key={e.id}>{e.text}</li>
          ))}
        </ol>
      </section>
      <footer>
        {vm.eventCount} events · step {stepMs.toFixed(1)} ms
      </footer>
    </main>
  );
}
