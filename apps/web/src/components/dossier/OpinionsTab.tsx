/**
 * Opinions with their reasons (04 §12.1 "What she thinks of you", 11 §2.3 "Of you").
 * Four axes as diverging bars with band words, reasons listed with their deltas.
 */
import type { ActorView } from '@coulee/core';
import { opinionBand, signed } from '../../lib/format.ts';
import { useUi } from '../../state/ui.ts';
import { useVm } from '../ctx.ts';
import { Bar, Empty, SectionHead } from '../ui.tsx';

const AXES = ['affection', 'respect', 'trust', 'fear'] as const;

export function OpinionsTab(props: { actor: ActorView }) {
  const vm = useVm();
  const selectActor = useUi((s) => s.selectActor);
  const a = props.actor;
  const ops = [...a.social.opinions].sort(
    (x, y) =>
      (y.targetId === vm.playerId ? 1 : 0) - (x.targetId === vm.playerId ? 1 : 0) ||
      Math.abs(y.affection) + Math.abs(y.trust) - (Math.abs(x.affection) + Math.abs(x.trust)) ||
      x.targetId - y.targetId,
  );
  return (
    <div className="opinions">
      {a.social.relationships.length > 0 ? (
        <>
          <SectionHead>Ties</SectionHead>
          <ul className="ties">
            {a.social.relationships.map((r) => (
              <li key={`${r.otherId}-${r.label}`}>
                <button type="button" className="link" onClick={() => selectActor(r.otherId)}>
                  {r.otherName}
                </button>{' '}
                <span className="sub">{r.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SectionHead>Opinions</SectionHead>
      {ops.length === 0 ? (
        <Empty>No settled opinions yet. Folk need time together, or something to talk about.</Empty>
      ) : (
        ops.map((o) => (
          <article key={o.targetId} className="opinion">
            <header>
              <button type="button" className="link name" onClick={() => selectActor(o.targetId)}>
                {o.targetId === vm.playerId ? `${o.targetName} (you)` : o.targetName}
              </button>
              {o.label ? <span className="chip">{o.label}</span> : null}
            </header>
            <div className="axes">
              {AXES.map((ax) => (
                <div key={ax} className="axis">
                  <span className="k">{ax[0]?.toUpperCase() + ax.slice(1)}</span>
                  <Bar value={o[ax]} min={-100} max={100} diverging label={`${ax} ${o[ax]}`} />
                  <span className="v" title={opinionBand(o[ax])}>
                    {signed(o[ax])}
                  </span>
                </div>
              ))}
            </div>
            {o.reasons.length > 0 ? (
              <ul className="reasons">
                {o.reasons.map((r, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: reasons are an ordered ledger
                  <li key={i}>
                    <span className="reason">{r.label}</span>
                    <span className="deltas">
                      {AXES.filter((ax) => r[ax] !== 0).map((ax) => (
                        <span key={ax} className={`delta ${r[ax] < 0 ? 'neg' : 'pos'}`}>
                          {signed(r[ax])} {ax.slice(0, 3)}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">▨ ? other reasons</p>
            )}
          </article>
        ))
      )}
    </div>
  );
}
