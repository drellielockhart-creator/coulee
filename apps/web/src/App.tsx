import type { ActorView, ViewModel } from '@coulee/core';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActPanel } from './components/ActPanel.tsx';
import { Book } from './components/Book.tsx';
import { actorById, placeName, SimCtx, useSimCtx, useVm } from './components/ctx.ts';
import { KnownTab } from './components/dossier/KnownTab.tsx';
import { MindTab } from './components/dossier/MindTab.tsx';
import { NeedsTab } from './components/dossier/NeedsTab.tsx';
import { OpinionsTab } from './components/dossier/OpinionsTab.tsx';
import { KitSheet } from './components/KitSheet.tsx';
import { ActorPeek, PlaceCard, StackChooser } from './components/Peek.tsx';
import { Settings } from './components/Settings.tsx';
import { Drawer, Sheet } from './components/Sheet.tsx';
import { SiteMap } from './components/SiteMap.tsx';
import { Empty, Tabs } from './components/ui.tsx';
import { type Baseline, baselineOf, digestLine } from './lib/digest.ts';
import {
  clockGlyph,
  clockGlyphTitle,
  displayMinute,
  effectiveSpeed,
  SPEED_LABEL,
  secondsToNextHour,
} from './lib/timePolicy.ts';
import { type Layout, useLayout } from './lib/useLayout.ts';
import { SPEED_ORDER, type Speed } from './protocol.ts';
import { type DossierTab, useUi } from './state/ui.ts';
import { useProgress, useSim } from './useSim.ts';

/** Short labels so the tab strip is one row at 360 px (11 §2.3: Mind · Body · Of you · Known · Pack). */
const TABS: { id: DossierTab; label: string }[] = [
  { id: 'mind', label: 'Mind' },
  { id: 'needs', label: 'Body' },
  { id: 'opinions', label: 'Ties' },
  { id: 'known', label: 'Known' },
  { id: 'pack', label: 'Pack' },
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

function panelTitle(
  vm: ViewModel,
  panel: string,
  selected: ActorView | null,
  place: number | null,
  book: number | null,
) {
  switch (panel) {
    case 'dossier':
      return selected?.name ?? 'Dossier';
    case 'chronicle':
      return 'Chronicle';
    case 'people':
      return `People of ${vm.site?.name ?? vm.scenario.name}`;
    case 'pack':
      return 'Your provisions';
    case 'place':
      return placeName(vm, place);
    case 'book':
      return `${placeName(vm, book)}: the Book`;
    case 'act':
      return 'Give an order';
    case 'settings':
      return 'Settings';
    case 'stack':
      return 'Who do you mean?';
    default:
      return 'Places & people';
  }
}

function Settlement() {
  const sim = useSimCtx();
  const vm = useVm();
  const layout = useLayout();
  const ui = useUi();
  const [hidden, setHidden] = useState(document.hidden);
  const player = actorById(vm, vm.playerId);
  const selected = actorById(vm, ui.selectedActor) ?? player ?? vm.actors[0] ?? null;
  const alerted = sim.alerts.length > 0;
  const speed = effectiveSpeed({
    chosen: ui.chosenSpeed,
    sheet: ui.sheet,
    pinned: ui.pinned,
    hidden,
    // Folio and Desk keep the map beside the panels: panels never slow the world there.
    desk: layout !== 'pocket',
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
  // The worker already stopped the clock on an alert; mirror it in the chosen speed (`❚❚!`).
  useEffect(() => {
    if (sim.alerts.length > 0) useUi.getState().setSpeed('paused');
  }, [sim.alerts]);
  const chooseSpeed = (s: Speed) => {
    sim.clearAlerts();
    ui.setSpeed(s);
  };
  const digest = useDigest(vm, hidden, layout === 'pocket' && ui.sheet === 'full');

  const title = panelTitle(vm, ui.panel, selected, ui.selectedPlace, ui.bookPlace);
  const pocketPeek = layout === 'pocket' && ui.sheet === 'peek';
  const body =
    ui.panel === 'dossier' ? (
      selected ? (
        pocketPeek ? (
          <ActorPeek actor={selected} />
        ) : (
          <Dossier actor={selected} summary={layout !== 'pocket'} />
        )
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
    ) : ui.panel === 'place' && ui.selectedPlace !== null ? (
      <PlaceCard placeId={ui.selectedPlace} />
    ) : ui.panel === 'book' ? (
      <Book placeId={ui.bookPlace} />
    ) : ui.panel === 'act' ? (
      <ActPanel />
    ) : ui.panel === 'settings' ? (
      <Settings />
    ) : ui.panel === 'stack' ? (
      <StackChooser ids={ui.stack} />
    ) : (
      <Surroundings />
    );
  const subtitle =
    ui.panel === 'dossier' && selected && !pocketPeek ? (
      <>
        {selected.age} · {selected.occupation} · {selected.activity.verb} · {placeName(vm, selected.placeId)}
      </>
    ) : null;
  return (
    <main className={`screen settlement ${layout}`} data-testid="settlement" data-layout={layout}>
      <header className="masthead">
        <div className="title">
          <h1>{vm.site?.name ?? vm.scenario.name}</h1>
          <span className="sub">Hollin County · Wisconsin</span>
        </div>
        <div className="date">
          <strong>{vm.time.dateText}</strong>
          <Clock vm={vm} chosen={ui.chosenSpeed} effective={speed} alerted={alerted} />
        </div>
        <span className="status">
          {vm.actors.length} in view · {vm.time.moon.replaceAll('_', ' ')} moon
        </span>
        <button type="button" className="icon settings-btn" aria-label="Settings" onClick={() => ui.open('settings')}>
          ⚙
        </button>
      </header>
      <div className="workspace">
        <div className="map-column">
          <SiteMap speed={speed} />
          <div className="dispatches">
            {alerted ? (
              <div className="dispatch alert" role="alert">
                <span>
                  <strong>❚❚! Paused:</strong> {sim.alerts.map((a) => a.text).join(' · ')}
                </span>
                <button type="button" onClick={() => sim.clearAlerts()}>
                  OK
                </button>
              </div>
            ) : null}
            {digest.line ? (
              <div className="dispatch digest" role="status" data-testid="digest">
                <span>{digest.line}</span>
                <button type="button" onClick={digest.dismiss}>
                  OK
                </button>
              </div>
            ) : null}
          </div>
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
              <h2>{ui.panel === 'none' ? (selected?.name ?? 'People') : title}</h2>
              {ui.panel === 'none' ? selected ? <Dossier actor={selected} summary /> : <People /> : body}
            </section>
            <aside className="paper kit-dock">
              <h2>Provisions</h2>
              {player ? <KitSheet actor={player} /> : <Empty>No kit recorded.</Empty>}
            </aside>
          </>
        ) : ui.panel === 'none' ? null : layout === 'folio' ? (
          <Drawer title={title}>{body}</Drawer>
        ) : (
          <Sheet title={title} subtitle={subtitle}>
            {body}
          </Sheet>
        )}
      </div>
      <footer className="bottom-bar">
        <fieldset className="time-controls" aria-label="Time controls">
          {SPEED_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className="speed"
              aria-label={s === 'paused' ? 'Pause' : s === 'ultra' ? 'Ultra' : `${SPEED_LABEL[s]} speed`}
              aria-pressed={ui.chosenSpeed === s}
              onClick={() => chooseSpeed(s)}
            >
              {s === 'ultra' ? 'Ultra' : SPEED_LABEL[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              sim.clearAlerts();
              sim.send({ type: 'step', hours: 1 });
            }}
          >
            +1h
          </button>
        </fieldset>
        <nav className="rail" aria-label="Settlement panels">
          <RailButton panel="act" label="Act" layout={layout} />
          <RailButton panel="map" label="Places" layout={layout} />
          <RailButton panel="people" label="People" layout={layout} />
          <RailButton panel="chronicle" label="Chronicle" layout={layout} />
          <button
            type="button"
            aria-current={ui.panel === 'dossier' && ui.dossierTab === 'pack' && selected?.isPlayer ? 'true' : undefined}
            onClick={() => (player ? ui.selectActor(player.id, { tab: 'pack', sheet: 'half' }) : ui.open('pack'))}
          >
            Pack
          </button>
        </nav>
        <OrdersLine pending={sim.pending} effective={speed} chosen={ui.chosenSpeed} alerted={alerted} />
      </footer>
    </main>
  );
}

function RailButton({
  panel,
  label,
  layout,
}: {
  panel: 'act' | 'map' | 'people' | 'chronicle';
  label: string;
  layout: Layout;
}) {
  const ui = useUi();
  const on = ui.panel === panel;
  return (
    <button
      type="button"
      aria-current={on ? 'true' : undefined}
      onClick={() => (on && layout !== 'desk' ? ui.close() : ui.open(panel, layout === 'pocket' ? 'half' : undefined))}
    >
      {label}
    </button>
  );
}

/** HH:MM with display-only minutes through the hour (11 §1.4), plus the policy glyph. */
function Clock(props: { vm: ViewModel; chosen: Speed; effective: Speed; alerted: boolean }) {
  const frac = useProgress((s) => s.frac);
  const { vm } = props;
  const minute = displayMinute(vm.time.minute, frac);
  return (
    <span className="clock" data-testid="clock" data-time={vm.time.t}>
      {String(vm.time.hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}{' '}
      <span className="clock-policy" aria-hidden="true">
        {clockGlyph(props.chosen, props.effective, props.alerted)}
      </span>
      <span className="visually-hidden">{clockGlyphTitle(props.chosen, props.effective, props.alerted)}</span>
    </span>
  );
}

/** The status line under the rail: when the next order lands, and which time policy is in force. */
function OrdersLine(props: { pending: number; effective: Speed; chosen: Speed; alerted: boolean }) {
  const frac = useProgress((s) => s.frac);
  const secs = secondsToNextHour(props.effective, frac);
  const when = secs === null ? 'when the clock runs (▶ or +1h)' : `in ~${secs} s`;
  const policy =
    props.chosen !== 'paused' && props.effective !== props.chosen
      ? ` · ${clockGlyphTitle(props.chosen, props.effective)}`
      : '';
  const text = props.alerted
    ? 'Paused: something needs you'
    : props.pending > 0
      ? `${props.pending} order${props.pending === 1 ? '' : 's'} apply ${when}`
      : `Orders apply on the next hour, ${when}`;
  return (
    <span className="orders" role="status">
      {text}
      {policy}
    </span>
  );
}

/**
 * Baseline when the map goes out of sight; a one-line digest when it comes back (11 §1.3).
 * Cheap: two small objects and one pass over the PC's own view.
 */
function useDigest(vm: ViewModel, hidden: boolean, covered: boolean): { line: string | null; dismiss: () => void } {
  const latest = useRef(vm);
  latest.current = vm;
  const base = useRef<Baseline | null>(null);
  const wasHidden = useRef(false);
  const [line, setLine] = useState<string | null>(null);
  const away = hidden || covered;
  useEffect(() => {
    const now = latest.current;
    if (away) {
      base.current ??= baselineOf(now);
      if (hidden) wasHidden.current = true;
      setLine(null);
    } else if (base.current) {
      // Closing a full sheet with the clock stopped changes nothing worth a card.
      const moved = now.time.t !== base.current.t;
      setLine(moved || wasHidden.current ? digestLine(base.current, now, (id) => placeName(now, id)) : null);
      base.current = null;
      wasHidden.current = false;
    }
  }, [away, hidden]);
  return { line, dismiss: () => setLine(null) };
}

export function Dossier({ actor, summary = true }: { actor: ActorView; summary?: boolean }) {
  const ui = useUi();
  const vm = useVm();
  return (
    <div className="dossier" data-testid="dossier">
      {summary ? (
        <p className="dossier-summary">
          {actor.age} · {actor.occupation} · {actor.activity.verb} · {placeName(vm, actor.placeId)}
        </p>
      ) : null}
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
    </div>
  );
}

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

function Surroundings() {
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
