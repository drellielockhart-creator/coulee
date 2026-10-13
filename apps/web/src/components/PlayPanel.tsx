/**
 * Act (11 §2.1): the play loop. OWNER: module:web.
 *
 * Everything here is read from the session's fair observation and every button sends one of the
 * session's own offered actions (ADR 0002 UI parity): the same ids and Commands the headless
 * REPL numbers. A refused order says why and costs no time; an accepted one takes its hour at
 * once, and the "since your last order" digest says what came of it, in plain words.
 */

import type { AvailableAction } from '@coulee/play';
import { useState } from 'react';
import { money } from '../lib/format.ts';
import { actionForUrge, areaOf, GROUPS, groupActions, hhmm, moneyLine, talkParts, WAITS } from '../lib/play.ts';
import { useLayout } from '../lib/useLayout.ts';
import type { ActOutcome, Digest, PlayObservation } from '../protocol.ts';
import { type ActGroup, useUi } from '../state/ui.ts';
import { useSimCtx } from './ctx.ts';
import { ExplainView } from './ExplainView.tsx';
import { Empty, SectionHead } from './ui.tsx';

/**
 * Run offered actions one at a time; buttons rest while the hour is being lived. The guard is the
 * session handle's, shared by every panel, so no second order slips in against a stale view.
 */
export function useRunner() {
  const sim = useSimCtx();
  const run = (a: { command: AvailableAction['command']; label: string }): Promise<ActOutcome> =>
    sim.order(a.command, a.label);
  const wait = (text: string, label: string): Promise<ActOutcome> => sim.wait(text, label);
  return { busy: sim.busy, run, wait };
}

export function PlayPanel() {
  const sim = useSimCtx();
  const ui = useUi();
  // At the Desk the digest has its own dock under the map; elsewhere it rides in the Act sheet.
  const docked = useLayout() === 'desk';
  const play = sim.play;
  const runner = useRunner();
  if (!play) return <Empty>Opening the county ledger…</Empty>;
  const o = play.observation;
  if (o.ending) return <Ending o={o} />;
  const groups = groupActions(o, sim.actions);
  const group = ui.actGroup && groups.has(ui.actGroup) ? ui.actGroup : null;
  const meta = group ? GROUPS.find((g) => g.id === group) : null;
  return (
    <div className="play" data-testid="play">
      <Outcome last={play.last} stops={play.digest.stops} />
      {group && meta ? (
        <>
          <div className="act-crumb">
            <button type="button" onClick={() => ui.setActGroup(null)}>
              ◂ All kinds
            </button>
            <h3>
              <span className="glyph" aria-hidden="true">
                {meta.glyph}
              </span>{' '}
              {meta.label}
            </h3>
          </div>
          <section className="act-body" aria-label={meta.label} data-testid="act-body">
            <GroupBody group={group} actions={groups.get(group) ?? []} o={o} runner={runner} />
          </section>
        </>
      ) : (
        <>
          <Situation o={o} />
          <TravelCard key={o.place.id} o={o} runner={runner} />
          <nav className="act-groups" aria-label="Kinds of action">
            {GROUPS.filter((g) => groups.has(g.id)).map((g) => (
              <button key={g.id} type="button" onClick={() => ui.setActGroup(g.id)}>
                <span className="glyph" aria-hidden="true">
                  {g.glyph}
                </span>{' '}
                {g.label}
              </button>
            ))}
          </nav>
        </>
      )}
      {docked ? null : <DigestCard digest={play.digest} o={o} />}
      <Voices o={o} runner={runner} />
      {group ? <Situation o={o} /> : null}
    </div>
  );
}

/** What the last order came to: a refusal and its reason, a warning, a notice, a reading. */
export function Outcome({ last, stops }: { last: ActOutcome | null; stops: string[] }) {
  if (!last) return null;
  if (!last.ok)
    return (
      <p className="outcome refused" role="alert" data-testid="outcome">
        ⚠ {last.label}: {last.reason}. No time passed.
      </p>
    );
  const stopped = last.stopped ? stops[0] : null;
  return (
    <div className="outcome" role="status" data-testid="outcome">
      {last.elapsedMinutes > 0 ? (
        <p>
          <strong>{last.label}</strong> · {last.elapsedMinutes >= 60 ? `${last.elapsedMinutes / 60} h` : 'at once'}
        </p>
      ) : null}
      {stopped ? <p className="warn">❚❚ {stopped}</p> : null}
      {last.warning ? <p className="warn">⚠ {last.warning}</p> : null}
      {last.notice ? <p>{last.notice}</p> : null}
      {last.text && last.elapsedMinutes === 0 && !Array.isArray(last.detail) ? (
        <pre className="reading">{last.text}</pre>
      ) : null}
    </div>
  );
}

/** Where she is, what she is doing, who is here (the top of the headless `look`). */
function Situation({ o }: { o: PlayObservation }) {
  const a = o.self.activity;
  const doing =
    a.travelingTo !== null && a.arriveAt !== null
      ? `on the road to ${o.places.find((p) => p.id === a.travelingTo)?.name ?? 'your destination'}, about ${Math.max(1, a.arriveAt - o.time.t)} min more`
      : a.activityId === 'idle_at_home' && o.self.lodging && o.place.id !== o.self.lodging.placeId
        ? 'at leisure'
        : a.verb;
  const counter = o.store.hours
    ? `counter ${o.store.open ? 'open' : 'closed'} ${String(o.store.hours.opens).padStart(2, '0')}:00–${o.store.hours.closes}:00`
    : null;
  const owed = o.self.obligations.filter((d) => d.overdue || d.daysLeft <= 7);
  return (
    <div className="situation" data-testid="situation">
      <p className="where">
        <strong>{o.place.name}</strong>
        {counter ? ` · ${counter}` : ''} · {o.weather.temperatureF}°F, {o.weather.description.toLowerCase()}
      </p>
      <p className="doing">
        You are {doing}.{' '}
        {o.present.length
          ? `Here: ${o.present
              .slice(0, 5)
              .map((p) => `${p.name}${/sleep/i.test(p.activity) ? ' (asleep)' : ''}`)
              .join(', ')}${o.present.length > 5 ? ` and ${o.present.length - 5} more` : ''}.`
          : 'No one else is here.'}
      </p>
      {o.remains.map((r) => (
        <p key={r.actorId} className="warn">
          {r.buried ? 'A grave' : 'A body'}: {r.name}.
        </p>
      ))}
      {o.requests.length ? (
        <p className="warn">
          {o.requests.length === 1 ? 'Someone asks something of you' : `${o.requests.length} people ask things of you`}{' '}
          (Talk).
        </p>
      ) : null}
      {owed.map((d) => (
        <p key={d.creditorId} className="warn">
          You owe {d.creditor} {money(d.cents)},{' '}
          {d.overdue ? `overdue since ${d.dueDate}` : `due ${d.daysLeft <= 0 ? 'today' : `in ${d.daysLeft} d`}`}.
        </p>
      ))}
      {o.self.needs.survival?.collapsed ? <p className="warn">You have collapsed and need help.</p> : null}
      {(o.self.needs.warnings ?? []).map((w) => (
        <p key={w} className="warn">
          ⚠ {w}
        </p>
      ))}
    </div>
  );
}

type Runner = ReturnType<typeof useRunner>;

function ActionButton({ a, runner, children }: { a: AvailableAction; runner: Runner; children?: React.ReactNode }) {
  return (
    <button type="button" className="act-btn" disabled={runner.busy} onClick={() => void runner.run(a)}>
      {children ?? a.label}
    </button>
  );
}

function GroupBody({
  group,
  actions,
  o,
  runner,
}: {
  group: ActGroup;
  actions: AvailableAction[];
  o: PlayObservation;
  runner: Runner;
}) {
  const ui = useUi();
  switch (group) {
    case 'move':
      return <MoveList actions={actions} o={o} runner={runner} />;
    case 'talk':
      return <TalkList actions={actions} o={o} runner={runner} target={ui.actTarget} />;
    case 'trade':
      return (
        <>
          <button type="button" className="act-btn primary" onClick={() => ui.open('trade')}>
            ⚖ Open the counter: {o.place.name}
          </button>
          {actions
            .filter((a) => a.id === 'meal')
            .map((a) => (
              <ActionButton key={a.id} a={a} runner={runner} />
            ))}
          <p className="hint">
            {actions.filter((a) => a.id.startsWith('buy:')).length} goods for sale ·{' '}
            {actions.filter((a) => a.id.startsWith('sell:')).length} things you could sell
          </p>
        </>
      );
    case 'eat':
      return <EatList actions={actions} o={o} runner={runner} />;
    case 'rest':
      return (
        <>
          <ul className="act-list">
            {actions
              .filter((a) => a.id !== 'wait')
              .map((a) => (
                <li key={a.id}>
                  <ActionButton a={a} runner={runner} />
                </li>
              ))}
          </ul>
          <WaitControls runner={runner} />
        </>
      );
    case 'signs':
      return <SignsList actions={actions} o={o} runner={runner} />;
    case 'read':
      return (
        <ul className="act-list">
          {actions.map((a) => (
            <li key={a.id}>
              {a.id === 'journal' ? (
                <button type="button" className="act-btn" onClick={() => ui.openLedger('journal')}>
                  Read the journal
                </button>
              ) : (
                <ActionButton a={a} runner={runner}>
                  {a.id === 'look' ? 'Look about' : a.label}
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      );
    case 'pack':
      return (
        <>
          <button type="button" className="act-btn primary" onClick={() => ui.open('pack')}>
            ▣ Open the Kit Sheet
          </button>
          <ul className="act-list">
            {actions
              .filter((a) => a.id !== 'plan')
              .map((a) => (
                <li key={a.id}>
                  <ActionButton a={a} runner={runner} />
                </li>
              ))}
          </ul>
        </>
      );
    case 'life':
      return <LifeList actions={actions} runner={runner} />;
    default:
      return (
        <ul className="act-list">
          {actions.map((a) => (
            <li key={a.id}>
              <ActionButton a={a} runner={runner} />
            </li>
          ))}
        </ul>
      );
  }
}

function MoveList({ actions, o, runner }: { actions: AvailableAction[]; o: PlayObservation; runner: Runner }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const places = new Map<number, (typeof o.places)[number]>(o.places.map((p) => [p.id, p]));
  const goes = actions.filter(
    (a) => a.id.startsWith('go:') && (needle === '' || a.label.toLowerCase().includes(needle)),
  );
  const areas = new Map<string, AvailableAction[]>();
  for (const a of goes) {
    const area = areaOf(places.get(Number(a.id.slice(3)))?.kind ?? '');
    areas.set(area, [...(areas.get(area) ?? []), a]);
  }
  const order = ['In town', 'Farms & fields', 'Roads & the river', 'Out in the country'];
  return (
    <div className="move">
      <p className="hint">You are at {o.place.name}. A walk across town takes minutes; the hour is yours either way.</p>
      <label className="field search">
        <span className="visually-hidden">Find a place</span>
        <input type="search" placeholder="Find a place" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {order
        .filter((area) => areas.has(area))
        .map((area) => (
          <div key={area}>
            <SectionHead>{area}</SectionHead>
            <ul className="act-list">
              {(areas.get(area) ?? []).map((a) => (
                <li key={a.id}>
                  <ActionButton a={a} runner={runner}>
                    {a.label.replace(/^Go to /, '')}
                  </ActionButton>
                </li>
              ))}
            </ul>
          </div>
        ))}
      {actions
        .filter((a) => !a.id.startsWith('go:'))
        .map((a) => (
          <ActionButton key={a.id} a={a} runner={runner} />
        ))}
    </div>
  );
}

function TalkList({
  actions,
  o,
  runner,
  target,
}: {
  actions: AvailableAction[];
  o: PlayObservation;
  runner: Runner;
  target: number | null;
}) {
  const requests = actions.filter((a) => a.id.startsWith('answer:'));
  const talks = actions.filter((a) => a.id.startsWith('talk:'));
  const people = new Map<number, AvailableAction[]>();
  for (const a of talks) {
    const { targetId } = talkParts(a);
    if (targetId === null || (target !== null && targetId !== target)) continue;
    people.set(targetId, [...(people.get(targetId) ?? []), a]);
  }
  return (
    <div className="talk">
      {requests.length ? (
        <div className="stack-actions">
          {requests.map((a) => (
            <ActionButton key={a.id} a={a} runner={runner} />
          ))}
        </div>
      ) : null}
      {people.size === 0 ? (
        <Empty>
          {o.present.length
            ? 'No one here will talk just now: asleep, at work, or not yet acquainted.'
            : 'No one is here to talk to.'}
        </Empty>
      ) : (
        [...people].map(([id, list]) => {
          const who = o.present.find((p) => p.id === id);
          return (
            <div key={id} className="person-talk">
              <p className="who">
                <strong>{who?.name ?? talkParts(list[0] as AvailableAction).who}</strong>
                {who ? ` · ${who.people} · ${who.activity}` : ''}
              </p>
              <div className="verbs">
                {list.map((a) => (
                  <ActionButton key={a.id} a={a} runner={runner}>
                    {talkParts(a).verb}
                  </ActionButton>
                ))}
              </div>
            </div>
          );
        })
      )}
      <p className="hint">Your character says it in her own words; what was said appears below.</p>
    </div>
  );
}

function EatList({ actions, o, runner }: { actions: AvailableAction[]; o: PlayObservation; runner: Runner }) {
  const foods = new Map<number, AvailableAction[]>();
  const other: AvailableAction[] = [];
  for (const a of actions) {
    const m = /^eat:(\d+):/.exec(a.id);
    if (m) foods.set(Number(m[1]), [...(foods.get(Number(m[1])) ?? []), a]);
    else other.push(a);
  }
  return (
    <div className="eat">
      {[...foods].map(([id, list]) => {
        const stack = o.self.inventory.carried.find((s) => s.id === id);
        return (
          <div key={id} className="person-talk">
            <p className="who">
              <strong>{stack?.name ?? 'Food'}</strong>
            </p>
            <div className="verbs">
              {list.map((a) => (
                <ActionButton key={a.id} a={a} runner={runner}>
                  {/\(raw\)$/.test(a.label)
                    ? 'Eat it as it is'
                    : `Prepare: ${/\(([^()]*)\)$/.exec(a.label)?.[1] ?? 'cook'}`}
                </ActionButton>
              ))}
            </div>
          </div>
        );
      })}
      <ul className="act-list">
        {other.map((a) => (
          <li key={a.id}>
            <ActionButton a={a} runner={runner} />
          </li>
        ))}
      </ul>
      <p className="hint">
        Eating serves one portion and takes its hour. What each food is worth, and how long it keeps, is in the Kit
        Sheet.
      </p>
    </div>
  );
}

/** Wait orders stop on the same interrupts as a headless wait (ADR 0002 §3). */
export function WaitControls({ runner }: { runner: Runner }) {
  return (
    <div className="waits" data-testid="waits">
      <SectionHead aside="stops for anything that needs you">Wait</SectionHead>
      <div className="wait-grid">
        {WAITS.map((w) => (
          <button key={w.text} type="button" disabled={runner.busy} onClick={() => void runner.wait(w.text, w.label)}>
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SignsList({ actions, o, runner }: { actions: AvailableAction[]; o: PlayObservation; runner: Runner }) {
  const ui = useUi();
  return (
    <div className="signs">
      {o.signs.length === 0 ? (
        <Empty>Nothing out of the way has caught your eye. Some places keep stranger hours than others.</Empty>
      ) : (
        <ul className="act-list">
          {o.signs.map((q) => {
            const inv = actions.find((a) => a.id === `investigate:${q.signId}`);
            return (
              <li key={q.signId} className="sign">
                <p>
                  <strong>{q.closedAt === null ? 'An open question' : 'A sign read'}:</strong> {q.text}
                </p>
                {q.evidence ? <p className="hint">{q.evidence}</p> : null}
                {inv ? (
                  <ActionButton a={inv} runner={runner}>
                    Look into it
                  </ActionButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="act-btn" onClick={() => ui.openLedger('signs')}>
        ✶ Signs &amp; Wonders in the Ledger
      </button>
    </div>
  );
}

/** Retire and depart end the life: two taps, kept apart from the benign (11 §1.2). */
function LifeList({ actions, runner }: { actions: AvailableAction[]; runner: Runner }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <ul className="act-list">
      {actions.map((a) => (
        <li key={a.id}>
          {confirm === a.id ? (
            <fieldset className="confirm-box" aria-label={`Confirm: ${a.label}`}>
              <p>This ends the life. Afterwards only reading remains.</p>
              <div className="stack-actions">
                <button
                  type="button"
                  className="consequential"
                  disabled={runner.busy}
                  onClick={() => void runner.run(a)}
                >
                  {a.label}
                </button>
                <button type="button" onClick={() => setConfirm(null)}>
                  Not yet
                </button>
              </div>
            </fieldset>
          ) : (
            <button type="button" className="act-btn" onClick={() => setConfirm(a.id)}>
              {a.label}…
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Since your last order" (11 §1.3; the headless `Since last look`): only what she perceived. */
export function DigestCard({ digest: d, o, compact }: { digest: Digest; o: PlayObservation; compact?: boolean }) {
  const sim = useSimCtx();
  const [open, setOpen] = useState<number | null>(null);
  const empty =
    d.elapsed === 0 && !d.money.length && !d.events.length && !d.said.length && !d.needs.length && !d.stops.length;
  if (empty) return null;
  const hours = Math.round(d.elapsed / 60);
  return (
    <section className="digest-card" data-testid="digest-card" aria-label="Since your last order">
      <SectionHead aside={`${hhmm(d.from)}–${hhmm(d.to)}`}>
        Since your last order{hours ? ` · ${hours} h` : ''}
      </SectionHead>
      {d.stops.map((s) => (
        <p key={s} className="warn">
          ❚❚ {s}
        </p>
      ))}
      {d.money.map((m) => (
        <p key={`${m.eventId}:${m.at}`} className="money-line">
          ◈ {moneyLine(m)}
        </p>
      ))}
      {d.needs.map((n) => (
        <p key={n} className="need-line">
          ◑ {n}
        </p>
      ))}
      {d.said.length ? (
        <blockquote className="said" data-testid="said">
          {ownFirst(d.said, o.self.id).flatMap((e) =>
            e.lines?.length
              ? e.lines.map((l, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: an exchange's lines are fixed and ordered
                  <p key={`${e.id}:${i}`} className={l.speakerId === o.self.id ? 'own' : ''}>
                    <strong>{l.speakerId === o.self.id ? 'You' : l.speaker}:</strong> “{l.text}”
                  </p>
                ))
              : e.speakerId === o.self.id
                ? [
                    <p key={e.id} className="hint">
                      {e.summary}. Nothing worth repeating is said.
                    </p>,
                  ]
                : [],
          )}
        </blockquote>
      ) : null}
      <ul className="events">
        {(compact ? d.events.slice(-4) : d.events).map((e) =>
          e.explain ? (
            <li key={e.id} className="ev">
              <button
                type="button"
                className="event-btn"
                aria-expanded={open === e.id}
                onClick={() => setOpen(open === e.id ? null : e.id)}
              >
                {e.summary} <span className="why">{open === e.id ? '▾' : 'ⓘ'}</span>
              </button>
              {open === e.id ? <ExplainView explain={e.explain} /> : null}
            </li>
          ) : (
            <li key={e.id} className="ev">
              {e.summary}
            </li>
          ),
        )}
      </ul>
      {!d.money.length && !d.needs.length && !d.said.length && !d.events.length && !d.stops.length ? (
        <p className="hint">Nothing you’d notice.</p>
      ) : null}
      {d.skipped ? (
        <p className="hint">
          Passed over {d.skipped} minor conversation{d.skipped === 1 ? '' : 's'} nearby.
        </p>
      ) : null}
      <button type="button" className="noted" onClick={() => sim.seen()}>
        Noted
      </button>
    </section>
  );
}

/**
 * Her own exchange first within each hour, then what was said to her, news she was told, and talk
 * overheard: the order the session gives `observation.said`, kept across a multi-hour digest.
 */
function ownFirst(said: Digest['said'], self: number): Digest['said'] {
  const rank = (e: Digest['said'][number]) =>
    e.speakerId === self ? 0 : e.hearerId === self ? 1 : e.lines?.some((l) => l.speakerId === self) ? 2 : 3;
  return said
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Math.floor(a.e.t / 60) - Math.floor(b.e.t / 60) || rank(a.e) - rank(b.e) || a.i - b.i)
    .map((x) => x.e);
}

/** Appetite and Conscience, held for her order (P2): what she would do, and a way to say yes. */
function Voices({ o, runner }: { o: PlayObservation; runner: Runner }) {
  const held = (['Appetite', 'Conscience'] as const).flatMap((voice) => {
    const t = [...o.self.mind.thoughts]
      .filter((x) => x.voice === voice && x.stance !== 'against' && x.urge !== o.self.mind.chosen?.urge)
      .sort((a, b) => b.intensity - a.intensity || a.id - b.id)[0];
    return t ? [{ voice, t }] : [];
  });
  if (!held.length) return null;
  return (
    <section className="voices" aria-label="Inner voices">
      <SectionHead aside="held for your order">Inner voices</SectionHead>
      {held.map(({ voice, t }) => {
        const a = actionForUrge(o, t.urge);
        return (
          <div key={t.id} className={`voice ${voice === 'Appetite' ? 'voice-id' : 'voice-superego'}`}>
            <p>
              <span className="glyph" aria-hidden="true">
                {voice === 'Appetite' ? '◖' : '◗'}
              </span>{' '}
              <em>{voice}:</em> {t.line ? `“${t.line}”` : t.label}
            </p>
            {a ? (
              <ActionButton a={a} runner={runner}>
                You may: {a.label}
              </ActionButton>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

/** After death, retirement or departure only reading remains (ADR 0002; survival endings). */
function Ending({ o }: { o: PlayObservation }) {
  const ui = useUi();
  const ending = o.ending;
  if (!ending) return null;
  return (
    <div className="play ending" data-testid="ending">
      <h3 className="ending-head">❦ This life has ended</h3>
      <p>
        <strong>{ending.type === 'death' ? 'Died' : ending.type === 'retire' ? 'Retired' : 'Departed'}</strong>:{' '}
        {ending.cause}.
      </p>
      <p className="hint">Only reading remains: the journal, the Ledger and the Chronicle.</p>
      <div className="stack-actions">
        <button type="button" onClick={() => ui.openLedger('journal')}>
          Read the journal
        </button>
        <button type="button" onClick={() => ui.openLedger('journey')}>
          Begin again…
        </button>
      </div>
      {o.epilogue ? (
        <div className="epilogue">
          {o.epilogue
            .split('\n')
            .filter((l) => l.trim())
            .map((l, i) =>
              /^#/.test(l) ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: static epilogue lines
                <h4 key={i}>{l.replace(/^#+\s*/, '')}</h4>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: static epilogue lines
                <p key={i}>{l.replace(/\*\*/g, '')}</p>
              ),
            )}
        </div>
      ) : null}
    </div>
  );
}

/** No client routing or supply math: all controls use the fair session's offered Commands. */
function TravelCard({ o, runner }: { o: PlayObservation; runner: ReturnType<typeof useRunner> }) {
  const [preview, setPreview] = useState<string>('');
  const routes = o.actions.filter((a) => a.id.startsWith('route:'));
  const controls = o.actions.filter((a) => a.id.startsWith('travel:') || a.id.startsWith('journey:'));
  if (!o.region) return null;
  return (
    <section aria-label="Regional travel">
      <h3>Walk to the neighbors</h3>
      {o.region.location.kind === 'edge' ? (
        <p>
          {o.region.location.status} on {o.region.location.name} · {o.region.location.feet} feet along this leg. Carried
          supplies only.
        </p>
      ) : null}
      <label>
        Destination{' '}
        <select
          aria-label="Destination"
          defaultValue=""
          onChange={async (e) => {
            const a = routes.find((a) => a.id === e.target.value);
            if (a) {
              const result = await runner.run(a);
              setPreview(result.text ?? '');
            }
          }}
        >
          <option value="">Choose a destination</option>
          {routes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      {preview ? <pre className="reading">{preview}</pre> : null}
      <div>
        {controls.map((a) => (
          <button type="button" key={a.id} disabled={runner.busy} onClick={() => runner.run(a)}>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
