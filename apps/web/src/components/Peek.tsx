/**
 * Peek cards (11 §2.3): what a tap on the map shows first. OWNER: module:web.
 * Actor: "name · Of you: Warm · activity" with [Talk] [Trade] [More ▴].
 * Place: kind, who is there, the store's Book, and the people present as links.
 */
import type { ActorView } from '@coulee/core';
import { opinionBand } from '../lib/format.ts';
import { useUi } from '../state/ui.ts';
import { placeName, useSimCtx, useVm } from './ctx.ts';
import { useRunner } from './PlayPanel.tsx';

export function ActorPeek({ actor }: { actor: ActorView }) {
  const vm = useVm();
  const ui = useUi();
  const own = actor.id === vm.playerId;
  const ofYou = actor.social.opinions.find((o) => o.targetId === vm.playerId);
  const place = vm.places.find((p) => p.id === actor.placeId);
  const store = place?.provisions.stock !== null && place?.provisions.stock !== undefined ? place : null;
  return (
    <div className="peek" data-testid="peek">
      <p className="peek-line">
        {own ? 'You' : ofYou ? `Of you: ${opinionBand(ofYou.affection)}` : 'Of you: not yet known'} ·{' '}
        {actor.activity.verb} · {placeName(vm, actor.placeId)}
      </p>
      <div className="peek-actions">
        {own ? (
          <button type="button" onClick={() => ui.open('pack', 'half')}>
            Pack
          </button>
        ) : (
          <button type="button" onClick={() => ui.openAct('talk', actor.id)}>
            Talk
          </button>
        )}
        {store ? (
          <button type="button" onClick={() => ui.open('trade', 'half')}>
            Trade
          </button>
        ) : own ? (
          <button type="button" onClick={() => ui.openAct(null)}>
            Act
          </button>
        ) : null}
        <button type="button" onClick={() => ui.setSheet('half')}>
          More ▴
        </button>
      </div>
    </div>
  );
}

/** The stack chooser (11 §2.2): who is under your finger, as a list. */
export function StackChooser({ ids }: { ids: readonly number[] }) {
  const vm = useVm();
  const ui = useUi();
  const here = ids.flatMap((id) => vm.actors.filter((a) => a.id === id));
  return (
    <div className="peek" data-testid="stack">
      <ul className="people-list compact">
        {here.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => ui.selectActor(a.id, { sheet: 'half' })}>
              <strong>
                {a.name}
                {a.isPlayer ? ' · you' : ''}
              </strong>
              <span>
                {a.activity.verb} · {placeName(vm, a.placeId)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlaceCard({ placeId }: { placeId: number }) {
  const vm = useVm();
  const ui = useUi();
  const sim = useSimCtx();
  const runner = useRunner();
  const o = sim.play?.observation;
  const here = o?.place.id === placeId;
  const go = o?.actions.find((a) => a.id === `go:${placeId}`);
  const place = vm.places.find((p) => p.id === placeId);
  if (!place) return <p className="empty">That place is not on this map.</p>;
  const present = vm.actors.filter((a) => a.placeId === place.id);
  const known = present.length;
  const counted = place.activity.occupantIds.length;
  return (
    <div className="peek" data-testid="place-card">
      <p className="peek-line">
        {place.kind}
        {place.provisions.open === undefined ? '' : place.provisions.open ? ' · open' : ' · closed'} ·{' '}
        {Math.max(known, counted) === 0
          ? 'no one you can see'
          : `${Math.max(known, counted)} ${Math.max(known, counted) === 1 ? 'person' : 'people'} here`}
      </p>
      {o && !here ? <p className="hint">{o.places.find((p) => p.id === placeId)?.description}</p> : null}
      <div className="peek-actions">
        {here && place.provisions.stock !== null ? (
          <button type="button" onClick={() => ui.open('trade')}>
            Open the store’s Book
          </button>
        ) : here ? (
          <button type="button" onClick={() => ui.openAct(null)}>
            You are here: Act
          </button>
        ) : go ? (
          <button type="button" disabled={runner.busy} onClick={() => void runner.run(go)}>
            Go there
          </button>
        ) : null}
      </div>
      {present.length > 0 ? (
        <ul className="people-list compact">
          {present.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => ui.selectActor(a.id, { sheet: 'half' })}>
                <strong>
                  {a.name}
                  {a.isPlayer ? ' · you' : ''}
                </strong>
                <span>{a.activity.verb}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : counted > 0 ? (
        <p className="hint">You can’t see who is inside from here.</p>
      ) : null}
    </div>
  );
}
