/**
 * Mind tab (10 §4.3, 11 §2.3): Inner Voices. Appetite (Id) lines left with ◖ in warm ink,
 * Conscience (Superego) lines right with ◗ in cool ink, the ego's verdict centered with ⚖ and
 * its arbitration Explain one tap away. P1: another's mind is not readable; the core sends
 * `visible: false` and this tab says so instead of showing anything.
 */
import type { ActorView } from '@coulee/core';
import { useState } from 'react';
import {
  ago,
  defenseLabel,
  num,
  psycheAlt,
  psycheLabel,
  title,
  urgeWords,
  voiceOf,
} from '../../lib/format.ts';
import { useUi } from '../../state/ui.ts';
import { nameOf, useVm } from '../ctx.ts';
import { ExplainView } from '../ExplainView.tsx';
import { Bar, Empty, Gated, SectionHead } from '../ui.tsx';

export function MindTab(props: { actor: ActorView }) {
  const vm = useVm();
  const labels = useUi((s) => s.labelSet);
  const [math, setMath] = useState(false);
  const a = props.actor;
  const p = a.psyche;
  const L = (t: Parameters<typeof psycheLabel>[0]) => psycheLabel(t, labels);
  const alt = (t: Parameters<typeof psycheLabel>[0]) => psycheAlt(t, labels);
  const who = (id: number) => nameOf(vm, id);
  const pronoun = a.sex === 'female' ? 'her' : 'him';

  if (!p.visible) {
    return (
      <div className="mind">
        <SectionHead>What you read in {pronoun}</SectionHead>
        <Gated>
          You can’t hear another’s thoughts. A Read People check would give you inferences, each with how sure you
          are; none have been made yet.
        </Gated>
        {p.persona ? (
          <p className="persona">
            <span className="k" title={alt('persona')}>
              {L('persona')}
            </span>{' '}
            <em>{p.persona}</em>
          </p>
        ) : null}
      </div>
    );
  }

  const thoughts = [...p.thoughts].sort((x, y) => y.intensity - x.intensity || x.id - y.id);
  const selfView = vm.playerId === a.id;
  return (
    <div className="mind">
      <div className="psyche-stats">
        <div className="stat" title={`${alt('ego')} strength, 0–100`}>
          <span className="k">⚖ {L('ego')}</span>
          <span className="v">{p.ego}</span>
        </div>
        <div className="stat" title={`${alt('superego')} strictness, 0–100`}>
          <span className="k superego-ink">◗ {L('superego')}</span>
          <span className="v">{p.superego}</span>
        </div>
        <div className="stat" title={`${alt('id')} appetite, 0–100`}>
          <span className="k id-ink">◖ {L('id')}</span>
          <span className="v">{p.idAppetite}</span>
        </div>
        <div className="stat wide" title={`${alt('anxiety')} 0–1000`}>
          <span className="k">{L('anxiety')}</span>
          <Bar value={p.anxiety} bad={p.anxiety >= 500} label={`${L('anxiety')} ${p.anxiety} of 1000`} />
          <span className="v">{p.anxiety >= 700 ? '⚠ ' : ''}{num(p.anxiety)}</span>
        </div>
      </div>

      <SectionHead aside={<span title="Left: Appetite ◖ · Right: Conscience ◗">◖ · ◗</span>}>Inner voices</SectionHead>
      {thoughts.length === 0 ? (
        <Empty>Quiet in there. No thoughts are pressing this hour.</Empty>
      ) : (
        <ol className="thoughts">
          {thoughts.map((t) => {
            const v = voiceOf(t.voice);
            return (
              <li key={t.id} className={`thought voice-${v.cls}`}>
                <span className="glyph" aria-hidden="true">
                  {v.glyph}
                </span>
                <div className="body">
                  <q>{t.label}</q>
                  <div className="meta">
                    <span title={v.cls === 'command' ? 'your order' : `${L(v.cls === 'id' ? 'id' : 'superego')}`}>
                      {v.cls === 'command' ? L('command') : L(v.cls === 'id' ? 'id' : 'superego')}
                    </span>{' '}
                    · wants: {urgeWords(t.urge, who)} · {ago(t.ageMinutes)}
                  </div>
                </div>
                <span className="intensity" title={`intensity ${t.intensity} / 1000`}>
                  {Math.round(t.intensity / 10)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {p.chosen ? (
        <div className="verdict">
          <div className="verdict-line">
            <span aria-hidden="true">⚖</span> {L('ego')}: {urgeWords(p.chosen.urge, who)}
            {p.chosen.compromise ? ' (a compromise)' : ''}
            <span className="sub">
              {' '}
              — held to{' '}
              {p.chosen.voice === 'command'
                ? L('command').toLowerCase()
                : p.chosen.voice === 'ego'
                  ? 'reason'
                  : L(p.chosen.voice === 'id' ? 'id' : 'superego')}
            </span>
          </div>
          {p.chosen.explain ? (
            <>
              <button type="button" className="link" onClick={() => setMath((m) => !m)} aria-expanded={math}>
                {math ? 'Hide the math' : 'Show the math'}
              </button>
              {math ? <ExplainView explain={p.chosen.explain} /> : null}
            </>
          ) : (
            <p className="hint">The arbitration’s math wasn’t sent with this view.</p>
          )}
        </div>
      ) : (
        <p className="hint">No arbitration yet: the ego hasn’t had to choose.</p>
      )}

      <SectionHead>{L('defense')}</SectionHead>
      {p.recentDefenses.length > 0 ? (
        <ul className="defenses">
          {p.recentDefenses.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: defenses are an ordered log
            <li key={i} className="marginalia">
              <span aria-hidden="true">✒</span> <em>{defenseLabel(d.defense, labels)}</em>
              {labels === 'period' ? <span className="sub"> ({title(d.defense)})</span> : null}
              {d.targetId !== null ? ` — at ${who(d.targetId)}` : ''} · {ago(vm.time.t - d.at)}
            </li>
          ))}
        </ul>
      ) : selfView ? (
        <Gated>A mind doesn’t see its own self-deceptions. Insight would reveal them, one at a time.</Gated>
      ) : (
        <Empty>None recorded lately.</Empty>
      )}

      <SectionHead>The face and the hidden</SectionHead>
      <p className="persona">
        <span className="k" title={alt('persona')}>
          {L('persona')}
        </span>{' '}
        {p.persona ? <em>{p.persona}</em> : <span className="sub">none set</span>}
      </p>
      <p className="persona">
        <span className="k" title={alt('shadow')}>
          {L('shadow')}
        </span>{' '}
        {p.shadow.length > 0 ? (
          p.shadow.map(title).join(', ')
        ) : (
          <span className="hatch" title="Disowned traits stay unseen until dreams or a confidant reveal them">
            ▨▨▨ unseen
          </span>
        )}
      </p>
    </div>
  );
}
