/**
 * Reading panels over the view model (perspective-gated in core): People, Places, Chronicle.
 * OWNER: module:web. The Ledger and the spectator rail both show them.
 */
import { type ReactNode, useState } from 'react';
import { useUi } from '../state/ui.ts';
import { placeName, useVm } from './ctx.ts';
import { Empty } from './ui.tsx';

export function People() {
  const vm = useVm();
  const ui = useUi();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = [...vm.actors]
    .filter(
      (a) =>
        needle === '' ||
        a.name.toLowerCase().includes(needle) ||
        a.occupation.toLowerCase().includes(needle) ||
        placeName(vm, a.placeId).toLowerCase().includes(needle),
    )
    .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || a.id - b.id);
  return (
    <div className="people">
      <label className="field search">
        <span className="visually-hidden">Find someone</span>
        <input
          type="search"
          placeholder="Find by name, trade or place"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {vm.actors.length === 0 ? (
        <Empty>No people recorded yet.</Empty>
      ) : list.length === 0 ? (
        <Empty>No one matches “{q}”.</Empty>
      ) : (
        <ul className="people-list">
          {list.map((a) => (
            <li key={a.id}>
              <button type="button" data-player={a.isPlayer} onClick={() => ui.selectActor(a.id)}>
                <strong>
                  {a.name}
                  {a.isPlayer ? ' · you' : ''}
                </strong>
                <span>
                  {a.occupation} · {a.activity.verb}
                </span>
                <small>{placeName(vm, a.placeId)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!ui.godView ? (
        <p className="hint">You know the folk who share your place; others appear as you meet them.</p>
      ) : null}
    </div>
  );
}

export function Chronicle() {
  const vm = useVm();
  const log = useUi((s) => s.godViewLog);
  const tag: ReactNode =
    log.length > 0 ? (
      <p className="warn god-tag" role="note">
        ◈ God view was used this session (first at {stampOf(log[0] ?? 0)}). Entries since may include what your
        character could not know.
      </p>
    ) : null;
  return vm.chronicle.recent.length === 0 ? (
    <>
      {tag}
      <Empty>The ledger is quiet. Advance an hour to begin its account.</Empty>
    </>
  ) : (
    <>
      {tag}
      <ol className="chronicle">
        {vm.chronicle.recent
          .slice(-30)
          .reverse()
          .map((e) => (
            <li key={e.id}>{e.text}</li>
          ))}
      </ol>
    </>
  );
}

/** Game minutes -> "Day 2, 14:00" (display only). */
function stampOf(t: number): string {
  const day = Math.floor(t / 1440) + 1;
  const m = t % 1440;
  return `day ${day}, ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function Surroundings() {
  const vm = useVm();
  const ui = useUi();
  return (
    <div className="surroundings">
      <ul className="people-list">
        {vm.places
          .filter((p) => p.kind !== 'road' && p.kind !== 'wild')
          .map((p) => {
            const here = vm.actors.filter((a) => a.placeId === p.id);
            return (
              <li key={p.id}>
                <button type="button" className="place-row" onClick={() => ui.selectPlace(p.id)}>
                  <strong>{p.name}</strong>
                  <span>
                    {p.kind}
                    {p.provisions.stock !== null ? ' · store' : ''}
                    {here.length > 0 ? ` · ${here.map((a) => a.shortName).join(', ')}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
