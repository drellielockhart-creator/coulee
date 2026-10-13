/**
 * Opinions with their reasons (04 §12.1 "What she thinks of you", 11 §2.3 "Of you").
 * Four axes as diverging bars with band words, reasons listed with their deltas.
 */
import type { ActorView } from '@coulee/core';
import { useState } from 'react';
import { OPINION_MEANING, opinionBand, signed, tieWords } from '../../lib/format.ts';
import { useUi } from '../../state/ui.ts';
import { useVm } from '../ctx.ts';
import { Bar, Empty, SectionHead } from '../ui.tsx';

const AXES = ['affection', 'respect', 'trust', 'fear'] as const;

/** Fear reads on its own scale: a high number is dread, not warmth. Display only. */
function fearBand(v: number): string {
  if (v >= 60) return 'Terrified';
  if (v >= 20) return 'Afraid';
  return 'Unafraid';
}

export function OpinionsTab(props: { actor: ActorView }) {
  const vm = useVm();
  const selectActor = useUi((s) => s.selectActor);
  const a = props.actor;
  /** Rung 3: tap an opinion's axes to read what each one means (touch has no hover). */
  const [explained, setExplained] = useState<number | null>(null);
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
            {a.social.relationships.map((r) => {
              // The label describes this dossier's owner: "child of Augusta Pratt", not "Augusta … child of".
              const w = tieWords(r.label);
              return (
                <li key={`${r.otherId}-${r.label}`}>
                  {w.before ? <span className="sub">{w.before}</span> : null}
                  <button type="button" className="link" onClick={() => selectActor(r.otherId)}>
                    {r.otherName}
                  </button>
                  {w.after ? <span className="sub">{w.after}</span> : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {(a.social.reliefObligations?.length ?? 0) > 0 ? (
        <>
          <SectionHead>Relief obligations</SectionHead>
          <ul className="ties">
            {a.social.reliefObligations?.map((r) => (
              <li key={r.officeId}>
                {r.name}: {r.favors} {r.favors === 1 ? 'favor' : 'favors'} owed in kind
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
            <button
              type="button"
              className="axes"
              aria-expanded={explained === o.targetId}
              aria-label={`Opinion of ${o.targetName}: tap for what each line means`}
              onClick={() => setExplained(explained === o.targetId ? null : o.targetId)}
            >
              {AXES.map((ax) => (
                <span key={ax} className="axis">
                  <span className="k">{ax[0]?.toUpperCase() + ax.slice(1)}</span>
                  <Bar value={o[ax]} min={-100} max={100} diverging label={`${ax} ${o[ax]}`} />
                  <span className="axis-v">
                    {signed(o[ax])} <span className="band">{ax === 'fear' ? fearBand(o[ax]) : opinionBand(o[ax])}</span>
                  </span>
                </span>
              ))}
            </button>
            {explained === o.targetId ? (
              <ul className="axis-meaning" role="note">
                {AXES.map((ax) => (
                  <li key={ax}>{OPINION_MEANING[ax]}</li>
                ))}
                <li>
                  Each runs −100 to +100. The words are bands: Cold, Wary, Neutral, Warm, Devoted (fear: Unafraid,
                  Afraid, Terrified).
                </li>
              </ul>
            ) : null}
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
