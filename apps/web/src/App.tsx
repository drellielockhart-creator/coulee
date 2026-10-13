import type { ActorView, ViewModel } from '@coulee/core';
import { useEffect, useRef, useState } from 'react';
import { actorById, placeName, SimCtx, useSimCtx, useVm } from './components/ctx.ts';
import { KnownTab } from './components/dossier/KnownTab.tsx';
import { MindTab } from './components/dossier/MindTab.tsx';
import { NeedsTab } from './components/dossier/NeedsTab.tsx';
import { OpinionsTab } from './components/dossier/OpinionsTab.tsx';
import { KitSheet } from './components/KitSheet.tsx';
import { Ledger } from './components/Ledger.tsx';
import { MapView } from './components/MapView.tsx';
import { ActorPeek, PlaceCard, StackChooser } from './components/Peek.tsx';
import { DigestCard, PlayPanel } from './components/PlayPanel.tsx';
import { Chronicle, People, Surroundings } from './components/Reading.tsx';
import { Settings } from './components/Settings.tsx';
import { Drawer, Sheet } from './components/Sheet.tsx';
import { Storefront } from './components/Storefront.tsx';
import { Empty, Tabs } from './components/ui.tsx';
import { money } from './lib/format.ts';
import { getSave, putSave, type SaveMeta } from './lib/saves.ts';
import {
  clockGlyph,
  clockGlyphTitle,
  displayMinute,
  effectiveSpeed,
  SPEED_LABEL,
  secondsToNextHour,
} from './lib/timePolicy.ts';
import { type Layout, useLayout } from './lib/useLayout.ts';
import { type PlayState, SPEED_ORDER, type Speed } from './protocol.ts';
import { type DossierTab, type Panel, type UiState, useUi } from './state/ui.ts';
import { useProgress, useSim } from './useSim.ts';

export { Chronicle, People } from './components/Reading.tsx';

/** Short labels so the tab strip is one row at 360 px (11 §2.3: Mind · Body · Of you · Known · Pack). */
const TABS: { id: DossierTab; label: string }[] = [
  { id: 'mind', label: 'Mind' },
  { id: 'needs', label: 'Body' },
  { id: 'opinions', label: 'Ties' },
  { id: 'known', label: 'Known' },
  { id: 'pack', label: 'Pack' },
];

export function App() {
  const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'iron_ford';
  const sim = useSim(scenario, 42);
  return (
    <SimCtx.Provider value={sim}>
      {sim.error ? (
        <main className="screen">
          <h1>Coulee</h1>
          <p className="error" role="alert">
            {sim.error}
          </p>
        </main>
      ) : sim.vm && sim.play ? (
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

function panelTitle(vm: ViewModel, panel: Panel, selected: ActorView | null, ui: UiState, play: PlayState) {
  switch (panel) {
    case 'dossier':
      return selected?.name ?? 'Dossier';
    case 'chronicle':
      return 'Chronicle';
    case 'people':
      return `People of ${vm.site?.name ?? vm.scenario.name}`;
    case 'pack':
      return 'Your kit';
    case 'place':
      return placeName(vm, ui.selectedPlace);
    case 'book':
    case 'trade':
      return play.observation.store.stock ? `The Book: ${play.observation.place.name}` : 'Trade';
    case 'act':
      return ui.actGroup === 'move' ? 'Go' : `Act · ${play.observation.place.name}`;
    case 'ledger':
      return 'Ledger';
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
  const play = sim.play as PlayState;
  const o = play.observation;
  const [hidden, setHidden] = useState(document.hidden);
  const [kept, setKept] = useState<SaveMeta | null>(null);
  // While an earlier journey is on offer, the new one must not autosave over it (it would destroy
  // the very save the player is being asked about).
  const offering = useRef(true);
  const player = actorById(vm, vm.playerId);
  const selected = actorById(vm, ui.selectedActor) ?? player ?? vm.actors[0] ?? null;
  const alerted = sim.alerts.length > 0;
  const ended = o.ending !== null;
  const speed = effectiveSpeed({
    chosen: ui.chosenSpeed,
    sheet: ui.sheet,
    pinned: ui.pinned,
    hidden,
    // Folio and Desk keep the map beside the panels: panels never slow the world there.
    desk: layout !== 'pocket',
  });
  useEffect(() => {
    const visibility = () => {
      setHidden(document.hidden);
      // The world waits while you are away (11 §1.3); keep the journey in case you never return.
      if (document.hidden && !offering.current)
        void sim.query({ kind: 'save' }).then((r) => {
          if (r.kind === 'save')
            void putSave({
              slot: 'auto',
              json: r.json,
              stamp: r.stamp,
              place: r.place,
              t: r.t,
              mode: sim.play?.mode ?? 'fair',
              savedAt: Date.now(),
            });
        });
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [sim.query, sim.play?.mode]);
  // A journey kept from an earlier sitting: offer it once, never load it unasked.
  useEffect(() => {
    let live = true;
    void getSave('auto').then((r) => {
      if (!live) return;
      if (r && r.t > 0) {
        const { json: _json, ...meta } = r;
        setKept(meta);
      } else offering.current = false;
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => sim.setSpeed(speed), [sim.setSpeed, speed]);
  useEffect(
    () => sim.setView({ omniscient: ui.godView, perspective: ui.godView ? null : vm.playerId }),
    [sim.setView, ui.godView, vm.playerId],
  );
  // The worker already stopped the clock (an alert, an arrival, an ending, a load); mirror it in the
  // chosen speed so the controls never show a clock that is not running.
  useEffect(() => {
    if (sim.alerts.length > 0 || ended) useUi.getState().setSpeed('paused');
  }, [sim.alerts, ended]);
  const pausesSeen = useRef(sim.pauses);
  useEffect(() => {
    // Only a new self-pause: the count since the session began is not a reason to stop again.
    if (sim.pauses !== pausesSeen.current) {
      pausesSeen.current = sim.pauses;
      useUi.getState().setSpeed('paused');
    }
  }, [sim.pauses]);
  const chooseSpeed = (s: Speed) => {
    sim.clearAlerts();
    ui.setSpeed(s);
  };

  const title = panelTitle(vm, ui.panel, selected, ui, play);
  const pocketPeek = layout === 'pocket' && ui.sheet === 'peek';
  const body = panelBody(ui.panel, { selected, player, pocketPeek, layout, ui });
  const subtitle =
    ui.panel === 'dossier' && selected && !pocketPeek ? (
      <>
        {selected.age} · {selected.occupation} · {selected.activity.verb} · {placeName(vm, selected.placeId)}
      </>
    ) : null;
  const digestWaiting =
    ui.panel !== 'act' && (play.digest.elapsed > 0 || play.digest.events.length > 0 || play.digest.money.length > 0);
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
          {o.self.name} · {o.place.name}
          {ui.godView ? ' · ◈ God view' : ''}
        </span>
        <button type="button" className="icon settings-btn" aria-label="Settings" onClick={() => ui.open('settings')}>
          ⚙
        </button>
        <Vitals play={play} onOpen={() => ui.open('pack', layout === 'pocket' ? 'half' : undefined)} />
      </header>
      <div className="workspace">
        <div className="map-column">
          <MapView speed={speed} />
          <div className="dispatches">
            {alerted ? (
              <div className="dispatch alert" role="alert" data-testid="alert">
                <span>
                  <strong>❚❚! Paused:</strong> {sim.alerts.map((a) => a.text).join(' · ')}
                </span>
                <button type="button" onClick={() => sim.clearAlerts()}>
                  OK
                </button>
              </div>
            ) : null}
            {ended ? (
              <div className="dispatch alert" role="status">
                <span>
                  <strong>❦ This life has ended:</strong> {o.ending?.cause}. Only reading remains.
                </span>
                <button type="button" onClick={() => ui.openAct(null)}>
                  Read
                </button>
              </div>
            ) : null}
            {digestWaiting && layout !== 'desk' && !alerted ? (
              <div className="dispatch digest" role="status" data-testid="digest">
                <span>{digestLine(play)}</span>
                <button type="button" onClick={() => ui.openAct(null)}>
                  Read
                </button>
                <button type="button" aria-label="Mark as read" onClick={() => sim.seen()}>
                  ✕
                </button>
              </div>
            ) : null}
            {kept ? (
              <div className="dispatch" role="status" data-testid="kept">
                <span>
                  A journey is kept from {kept.stamp}, at {kept.place}.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void getSave('auto').then(async (r) => {
                      if (!r) return;
                      const done = await sim.restart(r.json);
                      if (done.ok) {
                        offering.current = false;
                        setKept(null);
                      }
                    });
                  }}
                >
                  Resume
                </button>
                <button
                  type="button"
                  aria-label="Dismiss the kept journey"
                  onClick={() => {
                    // Set aside, not lost: it stays under Ledger · Journey as the earlier journey.
                    void getSave('auto').then(async (r) => {
                      if (r) await putSave({ ...r, slot: 'earlier' });
                      offering.current = false;
                      setKept(null);
                    });
                  }}
                >
                  ✕
                </button>
              </div>
            ) : null}
          </div>
          {layout === 'desk' ? (
            <section className="paper chronicle-dock">
              <h2>Since your last order</h2>
              <DigestCard digest={play.digest} o={o} />
              {play.digest.elapsed === 0 && play.digest.events.length === 0 ? (
                <Empty>Nothing yet. Give an order, or let the clock run.</Empty>
              ) : null}
            </section>
          ) : null}
        </div>
        {layout === 'desk' ? (
          <>
            <section className="paper inspector">
              <h2>{ui.panel === 'none' ? `Act · ${o.place.name}` : title}</h2>
              {ui.panel === 'none' ? <PlayPanel /> : body}
            </section>
            <aside className="paper kit-dock">
              {ui.panel === 'pack' ? (
                <>
                  {/* The kit is in the inspector already: keep the orders at hand beside it. */}
                  <h2>Act · {o.place.name}</h2>
                  <PlayPanel />
                </>
              ) : (
                <>
                  <h2>Your kit</h2>
                  {player ? <KitSheet actor={player} /> : <Empty>No kit recorded.</Empty>}
                </>
              )}
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
        <fieldset className="time-controls" aria-label="Time controls" disabled={ended}>
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
        <nav className="rail" aria-label="Play">
          <RailButton label="Act" on={ui.panel === 'act' && ui.actGroup !== 'move'} onClick={() => ui.openAct(null)} />
          <RailButton label="Go" on={ui.panel === 'act' && ui.actGroup === 'move'} onClick={() => ui.openAct('move')} />
          <RailButton
            label="Trade"
            on={ui.panel === 'trade' || ui.panel === 'book'}
            onClick={() => ui.open('trade', layout === 'pocket' ? 'full' : undefined)}
          />
          <RailButton
            label="Pack"
            on={ui.panel === 'pack'}
            onClick={() => ui.open('pack', layout === 'pocket' ? 'half' : undefined)}
          />
          <RailButton label="Ledger" on={ui.panel === 'ledger'} onClick={() => ui.openLedger()} />
        </nav>
        <StatusLine play={play} effective={speed} chosen={ui.chosenSpeed} alerted={alerted} />
      </footer>
    </main>
  );
}

function panelBody(
  panel: Panel,
  ctx: {
    selected: ActorView | null;
    player: ActorView | null;
    pocketPeek: boolean;
    layout: Layout;
    ui: UiState;
  },
) {
  const { selected, player, pocketPeek, layout, ui } = ctx;
  switch (panel) {
    case 'dossier':
      return selected ? (
        pocketPeek ? (
          <ActorPeek actor={selected} />
        ) : (
          <Dossier actor={selected} summary={layout !== 'pocket'} />
        )
      ) : (
        <Empty>No character selected.</Empty>
      );
    case 'chronicle':
      return <Chronicle />;
    case 'people':
      return <People />;
    case 'pack':
      return player ? <KitSheet actor={player} /> : <Empty>No player character in this scenario.</Empty>;
    case 'place':
      return ui.selectedPlace !== null ? <PlaceCard placeId={ui.selectedPlace} /> : <Surroundings />;
    case 'book':
    case 'trade':
      return <Storefront wide={layout === 'desk'} />;
    case 'act':
      return <PlayPanel />;
    case 'ledger':
      return <Ledger />;
    case 'settings':
      return <Settings />;
    case 'stack':
      return <StackChooser ids={ui.stack} />;
    default:
      return <Surroundings />;
  }
}

function RailButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  const ui = useUi();
  const layout = useLayout();
  return (
    <button
      type="button"
      aria-current={on ? 'true' : undefined}
      onClick={() => (on && layout !== 'desk' ? ui.close() : onClick())}
    >
      {label}
    </button>
  );
}

/** Line 2 of the status strip (11 §1.4): food-days, the bodily needs in a bad band, money. */
function Vitals({ play, onOpen }: { play: PlayState; onOpen: () => void }) {
  const o = play.observation;
  const food = o.self.provisions.readiness.daysOfFoodTenths;
  const troubled = o.self.needs.list.filter((n) => n.kind === 'physical' && n.band);
  const survival = o.self.needs.survival;
  return (
    // One target for the whole line (11 §1.4: tapping a pip opens its panel); the Kit Sheet holds
    // every figure's Explain.
    <button type="button" className="vitals" data-testid="vitals" aria-label="Vitals: open your kit" onClick={onOpen}>
      <span className={food < 20 ? 'pip bad' : 'pip'}>
        {food < 20 ? '⚠ ' : ''}Food {(food / 10).toFixed(1)} d
      </span>
      {troubled.length ? (
        troubled.map((n) => (
          <span key={n.id} className="pip bad">
            ⚠ {n.name}: {n.band}
          </span>
        ))
      ) : (
        <span className="pip">Body well</span>
      )}
      {survival && survival.wounds > 0 ? (
        <span className="pip bad">
          ⚠ Wounds {survival.wounds}/{survival.woundLimit}
        </span>
      ) : null}
      <span className="pip">{money(o.self.provisions.purseCents)}</span>
    </button>
  );
}

/** One line for the map when the Act sheet is closed: what came of the last order. */
function digestLine(play: PlayState): string {
  const d = play.digest;
  const parts: string[] = [];
  if (d.said.length) parts.push('words were said');
  if (d.events.length) parts.push(`${d.events.length} thing${d.events.length === 1 ? '' : 's'} seen`);
  if (d.money.length) {
    const net = d.money.reduce((n, m) => n + m.purse + m.household, 0);
    parts.push(`${net > 0 ? '+' : ''}${money(net)}`);
  }
  for (const n of d.needs.slice(0, 2)) parts.push(n.replace(/^.*?:\s*/, `${n.split(':')[0]}: `));
  const span = d.elapsed >= 60 ? ` (${Math.round(d.elapsed / 60)} h)` : '';
  return `Since your last order${span}: ${parts.length ? parts.join(' · ') : 'nothing you’d notice'}.`;
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

/** The status line under the rail: what the last order came to, and the time policy in force. */
function StatusLine(props: { play: PlayState; effective: Speed; chosen: Speed; alerted: boolean }) {
  const frac = useProgress((s) => s.frac);
  const secs = secondsToNextHour(props.effective, frac);
  const last = props.play.last;
  const policy =
    props.chosen !== 'paused' && props.effective !== props.chosen
      ? ` · ${clockGlyphTitle(props.chosen, props.effective)}`
      : '';
  const text = props.play.observation.ending
    ? 'This life has ended; only reading remains'
    : props.alerted
      ? 'Paused: something needs you'
      : last && !last.ok
        ? `Not done: ${last.reason}`
        : last && last.elapsedMinutes > 0
          ? `${last.label}: done${last.warning ? `, but ${last.warning}` : ''}`
          : secs === null
            ? 'Each order takes its hour at once; the clock waits for you'
            : `Next hour in ~${secs} s`;
  return (
    <span className="orders" role="status" data-testid="status-line">
      {text}
      {policy}
    </span>
  );
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
