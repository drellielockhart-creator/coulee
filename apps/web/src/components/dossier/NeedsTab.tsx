/**
 * Needs (11 §2.3 "Body"): bars on the 0–1000 scale shown as band words, numbers at rung 3.
 * Hunger expands into the P8 nutrition block: calories today, protein, Fresh, scurvy, monotony.
 */
import type { ActorView } from '@coulee/core';
import { useState } from 'react';
import { ago, freshBand, needSeverity, num, title } from '../../lib/format.ts';
import { useVm } from '../ctx.ts';
import { Bar, Empty, Row, SectionHead } from '../ui.tsx';

const KIND_LABEL = { physical: 'Body', social: 'Company', spiritual: 'Spirit' } as const;

export function NeedsTab(props: { actor: ActorView }) {
  const vm = useVm();
  const [open, setOpen] = useState<string | null>(null);
  const a = props.actor;
  const n = a.provisions.nutrition;
  const kinds = ['physical', 'social', 'spiritual'] as const;
  return (
    <div className="needs">
      {a.needs.list.length === 0 ? <Empty>No needs defined in content.</Empty> : null}
      {kinds.map((k) => {
        const list = a.needs.list.filter((x) => x.kind === k);
        if (list.length === 0) return null;
        return (
          <section key={k}>
            <SectionHead>{KIND_LABEL[k]}</SectionHead>
            <ul className="need-list">
              {list.map((need) => {
                const sev = needSeverity(need.value);
                const expanded = open === need.id;
                return (
                  <li key={need.id} className={`need sev-${sev}`}>
                    <button
                      type="button"
                      className="need-row"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : need.id)}
                    >
                      <span className="need-name">{need.name}</span>
                      <Bar value={need.value} bad={sev === 'bad'} label={`${need.name} ${need.value} of 1000`} />
                      <span className="need-band">
                        {sev === 'bad' ? '⚠ ' : sev === 'low' ? '▾ ' : ''}
                        {need.band || 'Content'}
                      </span>
                    </button>
                    {expanded ? (
                      <div className="need-detail">
                        <Row k="Value" v={`${num(need.value)} / 1000`} />
                        {need.id === 'hunger' || need.id === 'food' ? <NutritionBlock n={n} now={vm.time.t} /> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <SectionHead>Victuals</SectionHead>
      <NutritionBlock n={n} now={vm.time.t} />
      {a.conditions.length > 0 ? (
        <>
          <SectionHead>Conditions</SectionHead>
          <p className="chips">
            {a.conditions.map((c) => (
              <span key={c} className="chip">
                {title(c)}
              </span>
            ))}
          </p>
        </>
      ) : null}
    </div>
  );
}

export function NutritionBlock(props: { n: ActorView['provisions']['nutrition']; now: number }) {
  const n = props.n;
  return (
    <div className="nutrition">
      <Row k="Eaten today" v={`${num(n.kcalToday)} kcal`} />
      <Row k="Daily average" v={`${num(n.kcalAvg)} kcal · ${num(n.proteinAvgG)} g protein`} />
      <Row k="Fresh (avg)" v={`${n.freshAvg} — ${freshBand(n.freshAvg)}`} warn={n.freshAvg < 10} />
      <div className="meter">
        <span className="k">Scurvy</span>
        <Bar value={n.scurvy} bad={n.scurvy >= 300} label={`Scurvy ${n.scurvy} of 1000`} />
        <span className="v">{n.scurvy >= 300 ? '⚠ ' : ''}{num(n.scurvy)}</span>
      </div>
      <div className="meter">
        <span className="k">Monotony</span>
        <Bar value={n.monotony} bad={n.monotony >= 500} label={`Monotony ${n.monotony} of 1000`} />
        <span className="v">{num(n.monotony)}</span>
      </div>
      <Row k="Last meal" v={n.lastMealAt === null ? 'none recorded' : ago(props.now - n.lastMealAt)} />
    </div>
  );
}
