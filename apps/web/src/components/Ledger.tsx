/**
 * The Ledger (11 §2.1): the hub for everything that is read. OWNER: module:web.
 * Journal (the session's own `journal`, with debts and what was heard), money, signs and
 * wonders, folk known, places, the Chronicle, and the journey itself: save, resume, export the
 * replay log. Settings sit at its top.
 */
import { useEffect, useState } from 'react';
import { money } from '../lib/format.ts';
import { moneyLine } from '../lib/play.ts';
import { download, getSave, listSaves, putSave, type SaveMeta } from '../lib/saves.ts';
import { type LedgerTab, useUi } from '../state/ui.ts';
import { useSimCtx } from './ctx.ts';
import { useRunner } from './PlayPanel.tsx';
import { Chronicle, People, Surroundings } from './Reading.tsx';
import { Empty, Row, SectionHead } from './ui.tsx';

const TABS: Array<{ id: LedgerTab; label: string }> = [
  { id: 'journal', label: 'Journal' },
  { id: 'money', label: 'Money' },
  { id: 'signs', label: 'Signs' },
  { id: 'folk', label: 'Folk' },
  { id: 'places', label: 'Places' },
  { id: 'chronicle', label: 'Chronicle' },
  { id: 'journey', label: 'Journey' },
];

export function Ledger() {
  const ui = useUi();
  return (
    <div className="ledger" data-testid="ledger">
      <div className="tabs wrap" role="tablist" aria-label="Ledger">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={ui.ledgerTab === t.id}
            className={ui.ledgerTab === t.id ? 'tab on' : 'tab'}
            onClick={() => ui.setLedgerTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content" role="tabpanel" aria-label={TABS.find((t) => t.id === ui.ledgerTab)?.label}>
        {ui.ledgerTab === 'journal' ? (
          <Journal />
        ) : ui.ledgerTab === 'money' ? (
          <Money />
        ) : ui.ledgerTab === 'signs' ? (
          <Signs />
        ) : ui.ledgerTab === 'folk' ? (
          <People />
        ) : ui.ledgerTab === 'places' ? (
          <Surroundings />
        ) : ui.ledgerTab === 'chronicle' ? (
          <Chronicle />
        ) : (
          <Journey />
        )}
      </div>
    </div>
  );
}

interface Entry {
  id: number;
  stamp?: string;
  voice?: string;
  headline?: string | null;
  text: string;
}

/** The session's `journal` (the full known chronicle, debts at the end), re-read as it grows. */
function Journal() {
  const sim = useSimCtx();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const o = sim.play?.observation;
  const read = o?.actions.find((a) => a.id === 'journal');
  const grown = `${o?.journal.length ?? 0}:${o?.journal.at(-1)?.id ?? 0}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read only when the journal grows
  useEffect(() => {
    if (!read) return;
    let live = true;
    sim.act(read.command, 'Read the journal').then((r) => {
      if (live && r.ok && Array.isArray(r.detail)) setEntries(r.detail as Entry[]);
    });
    return () => {
      live = false;
    };
  }, [grown]);
  if (!o) return <Empty>Opening the journal…</Empty>;
  const kept = (entries ?? []).filter((e) => e.id >= 0);
  return (
    <div className="journal" data-testid="journal">
      {o.self.obligations.length ? (
        <>
          <SectionHead>What you owe</SectionHead>
          {o.self.obligations.map((d) => (
            <p key={d.creditorId} className={d.overdue || d.daysLeft <= 7 ? 'warn' : ''}>
              {d.creditor}: {money(d.cents)}, {d.overdue ? `overdue since ${d.dueDate}` : `due ${d.dueDate}`}. Settling
              up is yours to order (Talk: Repay).
            </p>
          ))}
        </>
      ) : null}
      <SectionHead aside={entries ? `${kept.length} entries` : ''}>Journal</SectionHead>
      {entries === null ? (
        <Empty>Turning the pages…</Empty>
      ) : kept.length === 0 ? (
        <Empty>No entries yet. The days will fill it.</Empty>
      ) : (
        <ol className="chronicle journal-list">
          {[...kept].reverse().map((e) => (
            <li key={e.id} className={e.voice === 'paper' ? 'paper-voice' : ''}>
              <small>{e.stamp}</small>
              {e.headline ? <strong className="headline">{e.headline}</strong> : null}
              <span className="entry-text">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
      <SectionHead>Heard about town</SectionHead>
      {o.self.belief.beliefs.length === 0 && o.rumors.length === 0 ? (
        <Empty>No news has come your way yet. Ask about the news, or keep company at the tavern.</Empty>
      ) : (
        <ul className="beliefs">
          {o.self.belief.beliefs.slice(-8).map((b) => (
            <li key={b.id}>{b.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Money() {
  const sim = useSimCtx();
  const play = sim.play;
  if (!play) return <Empty>Counting…</Empty>;
  const o = play.observation;
  return (
    <div className="money" data-testid="money">
      <Row k="Purse" v={money(o.self.provisions.purseCents)} />
      <Row k="Lodging cash box" v={money(o.self.provisions.householdCents)} />
      {o.self.obligations.map((d) => (
        <Row key={d.creditorId} k={`Owed to ${d.creditor}`} v={money(d.cents)} warn={d.overdue} />
      ))}
      <SectionHead aside="this sitting">Money moved</SectionHead>
      {play.money.length === 0 ? (
        <Empty>No money has changed hands since you sat down.</Empty>
      ) : (
        <ul className="beliefs">
          {[...play.money].reverse().map((m) => (
            <li key={`${m.eventId}:${m.at}`}>
              <small>{stampOf(m.at)}</small> {moneyLine(m)}
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Money moves only on your order: lodging and meals you asked for, purchases and sales.</p>
    </div>
  );
}

function stampOf(t: number): string {
  const day = Math.floor(t / 1440) + 1;
  const m = t % 1440;
  return `day ${day}, ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Signs & Wonders (13): omens she has noticed, open questions, and the order to look into one. */
function Signs() {
  const sim = useSimCtx();
  const runner = useRunner();
  const o = sim.play?.observation;
  if (!o) return <Empty>…</Empty>;
  return (
    <div className="signs" data-testid="signs">
      {o.signs.length === 0 ? (
        <Empty>Nothing out of the way has caught your eye yet.</Empty>
      ) : (
        <ul className="act-list">
          {[...o.signs].reverse().map((q) => {
            const inv = o.actions.find((a) => a.id === `investigate:${q.signId}`);
            return (
              <li key={q.signId} className="sign">
                <p>
                  <strong>{q.closedAt === null ? 'Open question' : 'Sign read'}:</strong> {q.text}
                </p>
                {q.evidence ? <p className="hint">{q.evidence}</p> : null}
                {inv ? (
                  <button type="button" className="act-btn" disabled={runner.busy} onClick={() => void runner.run(inv)}>
                    Look into it (an hour)
                  </button>
                ) : q.available ? null : (
                  <p className="hint">The trace has faded.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="hint">Signs are what you noticed, never what is true. Read them with care.</p>
    </div>
  );
}

/** Save, resume, export the replay log, begin again. Storage failures are reported, never thrown. */
function Journey() {
  const sim = useSimCtx();
  const ui = useUi();
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const refresh = () => {
    listSaves().then(setSaves);
  };
  useEffect(refresh, []);
  const save = async () => {
    const r = await sim.query({ kind: 'save' });
    if (r.kind !== 'save') return;
    const ok = await putSave({
      slot: 'kept',
      json: r.json,
      stamp: r.stamp,
      place: r.place,
      t: r.t,
      mode: sim.play?.mode ?? 'fair',
      savedAt: Date.now(),
    });
    setNote(ok ? `Saved at ${r.stamp}, ${r.place}.` : 'This browser would not keep the save (storage refused).');
    refresh();
  };
  const resume = async (slot: string) => {
    const rec = await getSave(slot);
    if (!rec) return setNote('That save could not be read.');
    setNote('Opening the kept journey…');
    const done = await sim.restart(rec.json);
    setNote(
      done.ok
        ? `Resumed from ${rec.stamp}.`
        : `That journey could not be opened (${done.message ?? 'unknown reason'}); this one carries on.`,
    );
  };
  const exportLog = async () => {
    const r = await sim.query({ kind: 'log' });
    if (r.kind !== 'log') return;
    const ok = download('commands.jsonl', `${r.log.map((x) => JSON.stringify(x)).join('\n')}\n`);
    setNote(ok ? `Log of ${r.log.length - 1} orders; hash ${r.hash.slice(0, 12)}…` : 'The download was refused.');
  };
  return (
    <div className="journey" data-testid="journey">
      <div className="stack-actions">
        <button type="button" className="primary" onClick={() => void save()}>
          Save the journey
        </button>
        <button type="button" onClick={() => ui.open('settings')}>
          Settings
        </button>
      </div>
      {note ? <p role="status">{note}</p> : null}
      <SectionHead>Kept journeys</SectionHead>
      {saves === null ? (
        <Empty>Looking…</Empty>
      ) : saves.length === 0 ? (
        <Empty>Nothing kept in this browser yet.</Empty>
      ) : (
        <ul className="act-list">
          {saves.map((s) => (
            <li key={s.slot}>
              <button type="button" className="act-btn" onClick={() => void resume(s.slot)}>
                Resume{' '}
                {s.slot === 'auto'
                  ? 'where you left off'
                  : s.slot === 'earlier'
                    ? 'the earlier journey'
                    : 'the kept journey'}
                : {s.stamp}, {s.place}
                {s.mode === 'god' ? ' · God view' : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      <SectionHead>The record</SectionHead>
      <p className="hint">
        Every order is logged. The log replays headlessly to the same world:{' '}
        <code>just run play --replay commands.jsonl</code>.
      </p>
      <button type="button" onClick={() => void exportLog()}>
        Export the command log
      </button>
      <SectionHead>Begin again</SectionHead>
      {fresh ? (
        <fieldset className="confirm-box" aria-label="Confirm a new arrival">
          <p>A new arrival at Iron Ford. Save first if you mean to come back to this one.</p>
          <div className="stack-actions">
            <button
              type="button"
              className="consequential"
              onClick={() => {
                void sim.restart();
                setFresh(false);
                ui.close();
              }}
            >
              Arrive anew
            </button>
            <button type="button" onClick={() => setFresh(false)}>
              Cancel
            </button>
          </div>
        </fieldset>
      ) : (
        <button type="button" onClick={() => setFresh(true)}>
          A new arrival…
        </button>
      )}
    </div>
  );
}
