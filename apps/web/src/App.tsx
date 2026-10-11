import type { ActorView } from '@coulee/core';
import { useEffect, useRef, useState } from 'react';
import { actorById, placeName, SimCtx, useSimCtx, useVm } from './components/ctx.ts';
import { KnownTab } from './components/dossier/KnownTab.tsx';
import { MindTab } from './components/dossier/MindTab.tsx';
import { NeedsTab } from './components/dossier/NeedsTab.tsx';
import { OpinionsTab } from './components/dossier/OpinionsTab.tsx';
import { KitSheet } from './components/KitSheet.tsx';
import { SiteMap } from './components/SiteMap.tsx';
import { Empty, Tabs } from './components/ui.tsx';
import { cmd } from './lib/commands.ts';
import { clockGlyph, clockGlyphTitle, effectiveSpeed, SPEED_LABEL } from './lib/timePolicy.ts';
import { useLayout } from './lib/useLayout.ts';
import { SPEED_ORDER } from './protocol.ts';
import { type DossierTab, useUi } from './state/ui.ts';
import { useSim } from './useSim.ts';

const TABS: { id: DossierTab; label: string }[] = [
  { id: 'mind', label: 'Mind' },
  { id: 'needs', label: 'Needs' },
  { id: 'opinions', label: 'Opinions' },
  { id: 'known', label: 'Memories & Beliefs' },
  { id: 'pack', label: 'Pack / Pantry' },
];

export function App() {
  const sim = useSim('iron_ford', 42);
  return (
    <SimCtx.Provider value={sim}>
      {sim.error ? (
        <main className="screen">
          <h1>Coulee</h1>
          <p className="error" role="alert">
            {sim.error}
          </p>
        </main>
      ) : sim.vm ? (
        <Settlement />
      ) : (
        <main className="screen">
          <h1>Coulee</h1>
          <p role="status">Opening the county ledger…</p>
        </main>
      )}
    </SimCtx.Provider>
  );
}

function Settlement() {
  const sim = useSimCtx();
  const vm = useVm();
  const layout = useLayout();
  const ui = useUi();
  const [hidden, setHidden] = useState(document.hidden);
  const player = actorById(vm, vm.playerId);
  const selected = actorById(vm, ui.selectedActor) ?? player ?? vm.actors[0] ?? null;
  const speed = effectiveSpeed({
    chosen: ui.chosenSpeed,
    sheet: ui.sheet,
    pinned: ui.pinned,
    hidden,
    desk: layout === 'desk',
  });
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => sim.setSpeed(speed), [sim.setSpeed, speed]);
  useEffect(
    () => sim.setView({ omniscient: ui.godView, perspective: ui.godView ? null : vm.playerId }),
    [sim.setView, ui.godView, vm.playerId],
  );
  const panelTitle =
    ui.panel === 'dossier'
      ? (selected?.name ?? 'Dossier')
      : ui.panel === 'chronicle'
        ? 'Chronicle'
        : ui.panel === 'people'
          ? 'People of Iron Ford'
          : ui.panel === 'pack'
            ? 'Your provisions'
            : ui.panel === 'place'
              ? placeName(vm, ui.selectedPlace)
              : 'Surroundings';
  const body =
    ui.panel === 'dossier' ? (
      selected ? (
        <Dossier actor={selected} />
      ) : (
        <Empty>No character selected.</Empty>
      )
    ) : ui.panel === 'chronicle' ? (
      <Chronicle />
    ) : ui.panel === 'people' ? (
      <People />
    ) : ui.panel === 'pack' ? (
      player ? (
        <KitSheet actor={player} />
      ) : (
        <Empty>No player character in this scenario.</Empty>
      )
    ) : (
      <Surroundings />
    );
  return (
    <main className={`screen settlement ${layout}`} data-testid="settlement">
      <header className="masthead">
        <div>
          <h1>Coulee</h1>
          <span className="sub">Hollin County · Wisconsin</span>
        </div>
        <div className="date">
          <strong>{vm.time.dateText}</strong>
          <span data-testid="clock" data-time={vm.time.t}>
            {String(vm.time.hour).padStart(2, '0')}:{String(vm.time.minute).padStart(2, '0')}{' '}
            <span className="clock-policy" title={clockGlyphTitle(ui.chosenSpeed, speed)}>
              {clockGlyph(ui.chosenSpeed, speed)}
            </span>
          </span>
        </div>
        <span className="status">
          {vm.actors.length} souls · {vm.time.moon.replaceAll('_', ' ')} moon
        </span>
      </header>
      <div className="workspace">
        <div className="map-column">
          <SiteMap speed={speed} />
          {layout === 'desk' ? (
            <section className="paper chronicle-dock">
              <h2>Chronicle</h2>
              <Chronicle />
            </section>
          ) : null}
        </div>
        {layout === 'desk' ? (
          <>
            <section className="paper inspector">
              <h2>{ui.panel === 'none' ? (selected?.name ?? 'People') : panelTitle}</h2>
              {ui.panel === 'none' ? selected ? <Dossier actor={selected} /> : <People /> : body}
            </section>
            <aside className="paper kit-dock">
              <h2>Provisions</h2>
              {player ? <KitSheet actor={player} /> : <Empty>No kit recorded.</Empty>}
            </aside>
          </>
        ) : ui.panel !== 'none' ? (
          <Sheet title={panelTitle}>{body}</Sheet>
        ) : null}
      </div>
      <footer className="bottom-bar">
        <fieldset className="time-controls" aria-label="Time controls">
          {SPEED_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={s === 'paused' ? 'Pause' : s === 'ultra' ? 'Ultra' : `${SPEED_LABEL[s]} speed`}
              aria-pressed={ui.chosenSpeed === s}
              onClick={() => ui.setSpeed(s)}
            >
              {s === 'ultra' ? 'Ultra' : SPEED_LABEL[s]}
            </button>
          ))}
          <button type="button" onClick={() => sim.send({ type: 'step', hours: 1 })}>
            +1h
          </button>
        </fieldset>
        <nav className="rail" aria-label="Settlement panels">
          <button type="button" onClick={() => ui.open('people')}>
            People
          </button>
          <button type="button" onClick={() => ui.open('chronicle')}>
            Chronicle
          </button>
          <button
            type="button"
            onClick={() => {
              ui.close();
              if (layout === 'desk') ui.open('map');
            }}
          >
            Map
          </button>
          <button type="button" onClick={() => (player ? ui.selectActor(player.id, { tab: 'pack' }) : ui.open('pack'))}>
            Pack
          </button>
        </nav>
        <span className="orders" role="status">
          {sim.pending > 0
            ? `${sim.pending} order${sim.pending === 1 ? '' : 's'} awaiting the hour`
            : 'Orders apply on the next hour'}
        </span>
      </footer>
    </main>
  );
}

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  const ui = useUi();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`paper sheet sheet-${ui.sheet}`}
      role="dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') ui.close();
      }}
    >
      <header className="sheet-head">
        <h2>{title}</h2>
        <div className="sheet-controls">
          <button type="button" onClick={() => ui.setSheet(ui.sheet === 'full' ? 'half' : 'full')}>
            {ui.sheet === 'full' ? 'Half' : 'Expand'}
          </button>
          {ui.sheet === 'full' ? (
            <button type="button" aria-pressed={ui.pinned} onClick={() => ui.setPinned(!ui.pinned)}>
              Keep running
            </button>
          ) : null}
          <button type="button" aria-label="Close sheet" onClick={() => ui.close()}>
            Close
          </button>
        </div>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

export function Dossier({ actor }: { actor: ActorView }) {
  const ui = useUi();
  return (
    <div className="dossier" data-testid="dossier">
      <p className="dossier-summary">
        {actor.age} · {actor.occupation} · {actor.activity.verb}
        <br />
        {placeName(useVm(), actor.placeId)}
      </p>
      <Tabs tabs={TABS} value={ui.dossierTab} onChange={ui.setTab} label="Dossier tabs" />
      <div className="tab-content" role="tabpanel" aria-label={TABS.find((t) => t.id === ui.dossierTab)?.label}>
        {ui.dossierTab === 'mind' ? (
          <MindTab actor={actor} />
        ) : ui.dossierTab === 'needs' ? (
          <NeedsTab actor={actor} />
        ) : ui.dossierTab === 'opinions' ? (
          <OpinionsTab actor={actor} />
        ) : ui.dossierTab === 'known' ? (
          <KnownTab actor={actor} />
        ) : (
          <KitSheet actor={actor} />
        )}
      </div>
      <Actions target={actor} />
    </div>
  );
}

export function People() {
  const vm = useVm();
  const ui = useUi();
  return (
    <div className="people">
      <div className="preferences">
        <label>
          Mind labels
          <select
            value={ui.labelSet}
            onChange={(e) => ui.setLabelSet(e.target.value === 'clinical' ? 'clinical' : 'period')}
          >
            <option value="period">Period</option>
            <option value="clinical">Clinical</option>
          </select>
        </label>
        <button type="button" aria-pressed={ui.godView} onClick={() => ui.setGodView(!ui.godView)}>
          God view {ui.godView ? 'on' : 'off'}
        </button>
      </div>
      {vm.actors.length === 0 ? (
        <Empty>No people recorded yet.</Empty>
      ) : (
        <ul className="people-list">
          {[...vm.actors]
            .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || a.id - b.id)
            .map((a) => (
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
    </div>
  );
}

export function Chronicle() {
  const vm = useVm();
  return vm.chronicle.recent.length === 0 ? (
    <Empty>The ledger is quiet. Advance an hour to begin its account.</Empty>
  ) : (
    <ol className="chronicle">
      {vm.chronicle.recent
        .slice(-30)
        .reverse()
        .map((e) => (
          <li key={e.id}>{e.text}</li>
        ))}
    </ol>
  );
}

function Surroundings() {
  const vm = useVm();
  const ui = useUi();
  return (
    <div className="surroundings">
      <h3>Places & people</h3>
      <ul className="people-list">
        {vm.places
          .filter((p) => ui.selectedPlace === null || ui.panel === 'map' || p.id === ui.selectedPlace)
          .map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <p>
                {p.kind} · {p.activity.occupantIds.length} present
              </p>
              {vm.actors
                .filter((a) => a.placeId === p.id)
                .map((a) => (
                  <button type="button" key={a.id} onClick={() => ui.selectActor(a.id)}>
                    {a.name} · {a.activity.verb}
                  </button>
                ))}
            </li>
          ))}
      </ul>
    </div>
  );
}

function Actions({ target }: { target: ActorView }) {
  const sim = useSimCtx();
  const vm = useVm();
  const [activity, setActivity] = useState('');
  const [interaction, setInteraction] = useState('');
  if (vm.playerId === null) return null;
  return (
    <details className="act">
      <summary>Give an order</summary>
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
      <button
        type="button"
        disabled={!activity}
        onClick={() => {
          if (vm.playerId !== null) sim.command(cmd.doActivity(vm.playerId, activity));
        }}
      >
        Request activity
      </button>
      {target.id !== vm.playerId ? (
        <>
          <label className="field">
            Interaction with {target.shortName}
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
            disabled={!interaction}
            onClick={() => {
              if (vm.playerId !== null) sim.command(cmd.interact(vm.playerId, interaction, target.id));
            }}
          >
            Request interaction
          </button>
        </>
      ) : null}
    </details>
  );
}
