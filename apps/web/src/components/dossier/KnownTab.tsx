/**
 * Memories & Beliefs (11 §2.3 "Known", 04 §12.1): beliefs with credence words and evidence,
 * grudges with their founding reasons, memories by salience.
 */
import type { ActorView } from '@coulee/core';
import { ago, credenceWord, title } from '../../lib/format.ts';
import { useVm } from '../ctx.ts';
import { Bar, Empty, SectionHead } from '../ui.tsx';

export function KnownTab(props: { actor: ActorView }) {
  const vm = useVm();
  const a = props.actor;
  const b = a.belief;
  const memories = [...a.social.memories].sort((x, y) => y.salience - x.salience || y.at - x.at || x.id - y.id);
  return (
    <div className="known">
      <SectionHead>Beliefs</SectionHead>
      {b.beliefs.length === 0 ? (
        <Empty>Holds no opinions on the talk of the county, or none you know of.</Empty>
      ) : (
        <ul className="beliefs">
          {[...b.beliefs]
            .sort((x, y) => y.credence - x.credence || x.id - y.id)
            .map((x) => (
              <li key={x.id}>
                <q>{x.text}</q>
                <div className="meta">
                  <Bar value={x.credence} max={100} label={`credence ${x.credence}`} />
                  <span>
                    {credenceWord(x.credence)} ({x.credence}) · {x.evidenceCount} piece{x.evidenceCount === 1 ? '' : 's'}{' '}
                    of evidence{x.voiced ? ' · said aloud' : ''}
                    {x.conceal ? ' · kept close' : ''}
                  </span>
                </div>
              </li>
            ))}
        </ul>
      )}
      {b.grudges.length > 0 ? (
        <>
          <SectionHead>Grudges</SectionHead>
          <ul className="grudges">
            {b.grudges.map((g) => (
              <li key={g.id}>
                <strong>{g.targetLabel}</strong> <span className="sub">aims to {g.aim.replaceAll('_', ' ')}</span>
                <Bar value={g.intensity} max={100} bad={g.intensity >= 60} label={`grudge ${g.intensity}`} />
                {g.founding.length > 0 ? <p className="sub">because: {g.founding.join('; ')}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SectionHead>Memories</SectionHead>
      {memories.length === 0 ? (
        <Empty>Nothing yet stands out in memory.</Empty>
      ) : (
        <ul className="memories">
          {memories.map((m) => (
            <li key={m.id} className={m.salience >= 600 ? 'vivid' : ''}>
              <span className="mem-text">{m.summary}</span>
              <span className="meta">
                {title(m.kind)}
                {m.emotion ? ` · ${m.emotion}` : ''} · {m.source} · {ago(vm.time.t - m.at)}
              </span>
              <Bar value={m.salience} label={`salience ${m.salience} of 1000`} className="thin" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
