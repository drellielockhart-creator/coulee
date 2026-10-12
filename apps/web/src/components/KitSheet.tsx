/**
 * The Kit Sheet and Readiness (11 §2.6–2.8; P8). OWNER: module:web.
 *
 * Your own sheet reads the session's observation and the planner's food ledger (@coulee/play
 * `foodLedger`, the very kernels `readinessOf` runs): every food number opens its Explain, and
 * every button is one of the session's offered actions (eat, prepare, pack, unpack, refill,
 * sell, rations). Someone else's pack, seen in God view, is read-only.
 */
import type { ActorView, Explain, items, provisions } from '@coulee/core';
import type { AvailableAction, FoodExplains } from '@coulee/play';
import { useState } from 'react';
import { bulk, money, num, weight } from '../lib/format.ts';
import { useUi } from '../state/ui.ts';
import { useQuery, useReadiness } from '../useSim.ts';
import { useSimCtx, useVm } from './ctx.ts';
import { dayTenths, ExplainRow } from './ExplainView.tsx';
import { useRunner } from './PlayPanel.tsx';
import { Empty, Row, SectionHead } from './ui.tsx';

export function ReadinessLedger({
  readiness: r,
  explain,
}: {
  readiness: provisions.Readiness | null;
  explain?: FoodExplains | null | undefined;
}) {
  if (!r) return <Empty>Checking the provisions…</Empty>;
  return (
    <div className="readiness">
      <ExplainRow
        k="Days of food"
        v={`${(r.daysOfFoodTenths / 10).toFixed(1)} days`}
        explain={explain?.daysOfFood}
        totalUnit="days"
      />
      <ExplainRow k="Usable food" v={`${r.kcalOnHand} kcal`} explain={explain?.kcalOnHand} />
      <ExplainRow k="Daily allowance" v={`${r.kcalPerDay} kcal`} explain={explain?.kcalPerDay} />
      <ExplainRow
        k="Cooking fuel"
        v={r.daysOfFuelTenths === null ? 'Not assessed' : `${(r.daysOfFuelTenths / 10).toFixed(1)} days`}
        explain={explain?.fuel}
        totalUnit="days"
      />
      <ExplainRow
        k="Spoils first"
        v={
          r.spoilsFirst
            ? `${r.spoilsFirst.name} · ${(r.spoilsFirst.inDaysTenths / 10).toFixed(1)} days`
            : 'None forecast'
        }
        explain={explain?.spoilsFirst}
        totalUnit="days"
      />
      {r.unpreparable.map((f) => (
        <p className="warn" key={f.defId}>
          ⚠ {f.name}: missing {f.missing.join(', ')}
        </p>
      ))}
      {r.warnings.length ? (
        <ul className="warnings">
          {r.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : (
        <p className="hint">No readiness warnings reported.</p>
      )}
    </div>
  );
}

/** Your own Kit Sheet when you are the newcomer; a read-only pack for anyone else. */
export function KitSheet({ actor }: { actor: ActorView }) {
  const sim = useSimCtx();
  const vm = useVm();
  if (actor.id === vm.playerId && sim.play) return <PlayKit />;
  return <ActorKit actor={actor} />;
}

const RATIONS: Record<number, string> = { 50: '½', 75: '¾', 100: 'Full', 125: '1¼', 150: '1½' };

function PlayKit() {
  const sim = useSimCtx();
  const ui = useUi();
  const runner = useRunner();
  const ledger = useQuery(sim, { kind: 'ledger' }, 'ledger')?.ledger ?? null;
  const play = sim.play;
  if (!play) return <Empty>Opening your pack…</Empty>;
  const o = play.observation;
  const r = o.self.provisions.readiness;
  const ex = ledger?.explain;
  const inv = o.self.inventory;
  const rations = o.actions.filter((a) => a.id.startsWith('rations:'));
  const nutrition = o.self.provisions.nutrition;
  return (
    <div className="kit-sheet" data-testid="kit-sheet">
      <SectionHead aside="tap a figure for its working">Readiness</SectionHead>
      <div className="readiness" data-testid="readiness">
        <ExplainRow
          k="Days of food"
          v={`${dayTenths(r.daysOfFoodTenths)}`}
          explain={ex?.daysOfFood}
          totalUnit="days"
          warn={r.daysOfFoodTenths < 40}
          testId="days-of-food"
        />
        <ExplainRow k="Usable food" v={`${num(r.kcalOnHand)} kcal`} explain={ex?.kcalOnHand} />
        <ExplainRow k="Daily need" v={`${num(r.kcalPerDay)} kcal`} explain={ex?.kcalPerDay} />
        <ExplainRow
          k="Cooking fuel"
          v={r.daysOfFuelTenths === null ? 'none needed' : dayTenths(r.daysOfFuelTenths)}
          explain={ex?.fuel}
          totalUnit="days"
        />
        <ExplainRow
          k="Stored water"
          v={
            r.daysOfWaterTenths === null || r.daysOfWaterTenths === undefined
              ? 'a source at hand'
              : dayTenths(r.daysOfWaterTenths)
          }
          explain={ex?.water}
          totalUnit="days"
          warn={(r.daysOfWaterTenths ?? 99) < 10}
        />
        <ExplainRow
          k="Spoils first"
          v={r.spoilsFirst ? `${r.spoilsFirst.name} · ${dayTenths(r.spoilsFirst.inDaysTenths)}` : 'nothing soon'}
          explain={ex?.spoilsFirst}
          totalUnit="days"
        />
        <ExplainRow
          k="Eaten today"
          v={`${num(nutrition.kcalToday)} kcal${nutrition.scurvy >= 500 ? ' · scurvy watch' : ''}`}
          explain={ledger?.nutrition}
          warn={nutrition.scurvy >= 500}
        />
        {r.unpreparable.map((f) => (
          <p className="warn" key={f.defId}>
            ⚠ {f.name}: missing {f.missing.join(', ')}
          </p>
        ))}
        {r.warnings.map((w) => (
          <p className="warn" key={w}>
            ⚠ {w}
          </p>
        ))}
      </div>
      {rations.length ? (
        <>
          <SectionHead aside="a standing order">Rations</SectionHead>
          <fieldset className="segmented rations" aria-label="Ration order">
            {rations.map((a) => {
              const pct = Number(a.id.split(':')[1]);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={ledger?.rationPct === pct}
                  disabled={runner.busy}
                  onClick={() => void runner.run(a)}
                >
                  {RATIONS[pct] ?? `${pct}%`}
                </button>
              );
            })}
          </fieldset>
        </>
      ) : null}
      <SectionHead aside={`${weight(inv.totalWeightG)} · Bulk ${bulk(inv.totalBulkTenths)}`}>
        Load: {inv.loadBand}
      </SectionHead>
      {(ledger?.load?.lines ?? []).map((l) => (
        <p key={l} className="load-line">
          {l}
        </p>
      ))}
      <Row k="Purse" v={money(o.self.provisions.purseCents)} />
      {o.self.provisions.householdCents ? (
        <Row k="Lodging cash box" v={money(o.self.provisions.householdCents)} />
      ) : null}
      <SectionHead>Carried &amp; worn</SectionHead>
      {inv.carried.length === 0 ? (
        <Empty>Nothing recorded here yet.</Empty>
      ) : (
        <ul className="inventory" aria-label="Inventory">
          {inv.carried.map((s) => (
            <StackLine
              key={s.id}
              stack={s}
              actions={o.actions.filter((a) => actionItem(a) === s.id)}
              explain={ledger?.stacks[s.id]}
              runner={runner}
            />
          ))}
        </ul>
      )}
      <div className="store-links">
        <button type="button" onClick={() => ui.open('trade')}>
          ⚖ The store’s Book
        </button>
      </div>
    </div>
  );
}

/** The carried stack an offered action is about (`eat:12:raw`, `pack:12:9`, `sell:12`...). */
function actionItem(a: AvailableAction): number | null {
  const m = /^(?:eat|pack|unpack|refill|empty|sell):(\d+)/.exec(a.id);
  return m ? Number(m[1]) : null;
}

function StackLine({
  stack: s,
  actions,
  explain,
  runner,
}: {
  stack: items.ItemStackView;
  actions: AvailableAction[];
  explain: { kcal: Explain; spoilage: Explain | null } | undefined;
  runner: ReturnType<typeof useRunner>;
}) {
  const [more, setMore] = useState(false);
  const label = (a: AvailableAction) => {
    if (a.id.startsWith('eat:'))
      return /\(raw\)$/.test(a.label) ? 'Eat' : `Prepare: ${/\(([^()]*)\)$/.exec(a.label)?.[1]}`;
    if (a.id.startsWith('pack:')) return `Into ${a.label.split(' into ')[1] ?? 'container'}`;
    if (a.id.startsWith('unpack:')) return 'Take out';
    if (a.id.startsWith('sell:')) return `Sell ${/\(([^()]*)\)$/.exec(a.label)?.[1] ?? ''}`;
    return a.label;
  };
  const shown = more ? actions : actions.slice(0, 3);
  return (
    <li className="stack" style={{ paddingLeft: `${Math.min(s.depth, 4) * 12}px` }}>
      <strong>{s.name}</strong>
      <span className="meta">
        {s.qty} {s.unit} · {weight(s.weightG)} · Bulk {bulk(s.bulkTenths)}
        {s.worn ? ' · worn' : ''}
        {s.waterMl ? ` · ${s.waterMl} ml water` : ''}
      </span>
      {s.condition < 100 || s.wetness > 0 ? (
        <span className="meta">
          Condition {s.condition}% · Wet {s.wetness}%
        </span>
      ) : null}
      {s.isFood && explain ? (
        <div className="food-facts">
          <ExplainRow
            k="Usable"
            v={`${s.servingsLeftPm === null ? '' : `${Math.floor(s.servingsLeftPm / 100) / 10} servings · `}${num(explain.kcal.total)} kcal`}
            explain={explain.kcal}
          />
          {explain.spoilage ? (
            <ExplainRow
              k="Keeps"
              v={`${dayTenths(explain.spoilage.total)}${s.spoilage ? ` · ${s.spoilage}‰ gone` : ''}`}
              explain={explain.spoilage}
              totalUnit="days"
              warn={explain.spoilage.total < 20}
            />
          ) : null}
        </div>
      ) : null}
      {actions.length ? (
        <div className="stack-actions">
          {shown.map((a) => (
            <button key={a.id} type="button" disabled={runner.busy} onClick={() => void runner.run(a)}>
              {label(a)}
            </button>
          ))}
          {actions.length > 3 ? (
            <button type="button" aria-expanded={more} onClick={() => setMore(!more)}>
              {more ? 'Fewer' : `${actions.length - 3} more…`}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Pack view for someone who eats at the family table: the pantry's horizon and its warnings. */
function HomeLedger({
  household,
  readiness: r,
  explain,
}: {
  household: string;
  readiness: provisions.Readiness | null;
  explain?: FoodExplains | null | undefined;
}) {
  if (!r) return <Empty>Checking the household pantry…</Empty>;
  return (
    <div className="readiness">
      <ExplainRow
        k="Eats at home"
        v={`household pantry ${(r.daysOfFoodTenths / 10).toFixed(1)} days`}
        explain={explain?.daysOfFood}
        totalUnit="days"
      />
      <p className="hint">Nothing to eat in the pack: meals come from the pantry of {household}.</p>
      {r.warnings.length ? (
        <ul className="warnings">
          {r.warnings.map((w) => (
            <li key={w}>⚠ Pantry: {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Another's pack (God view or a dossier): read-only. Orders are given through your own character. */
export function ActorKit({ actor }: { actor: ActorView }) {
  const sim = useSimCtx();
  const vm = useVm();
  const [pantry, setPantry] = useState(false);
  const household = vm.households.find((h) => h.id === actor.householdId);
  const holder = pantry && household ? { householdId: household.id } : { actorId: actor.id };
  const readiness = useReadiness(sim, holder);
  const homeReadiness = useReadiness(sim, !pantry && household ? { householdId: household.id } : null);
  const packHasFood = actor.items.carried.some((st) => sim.items[st.defId]?.food);
  const eatsAtHome = !pantry && household !== undefined && !packHasFood;
  // Explains for whichever ledger is shown: the worker answers only what this view may know.
  const ledger =
    useQuery(
      sim,
      { kind: 'ledger', holder: eatsAtHome && household ? { householdId: household.id } : holder },
      'ledger',
    )?.ledger ?? null;
  const stacks = pantry ? (household?.provisions.pantry ?? []) : actor.items.carried;
  const ui = useUi();
  const stores = vm.places.filter((p) => p.provisions.stock !== null);
  return (
    <div className="kit-sheet" data-testid="kit-sheet">
      <SectionHead>Kit Sheet</SectionHead>
      <div className="segmented">
        <button type="button" aria-pressed={!pantry} onClick={() => setPantry(false)}>
          Pack
        </button>
        <button type="button" aria-pressed={pantry} disabled={!household} onClick={() => setPantry(true)}>
          Pantry
        </button>
      </div>
      {eatsAtHome ? (
        <HomeLedger
          household={household?.name ?? 'the household'}
          readiness={homeReadiness}
          explain={ledger?.explain}
        />
      ) : (
        <ReadinessLedger readiness={readiness} explain={ledger?.explain} />
      )}
      {pantry ? (
        <p>{household?.name}</p>
      ) : (
        <>
          <Row k="Carried weight" v={weight(actor.items.totalWeightG)} />
          <Row k="Bulk" v={bulk(actor.items.totalBulkTenths)} />
          <Row k="Load" v={actor.items.loadBand} />
        </>
      )}
      <SectionHead>{pantry ? 'On the pantry shelves' : 'Carried & worn'}</SectionHead>
      {stacks.length === 0 ? (
        <Empty>Nothing recorded here yet.</Empty>
      ) : (
        <ul className="inventory" aria-label="Inventory">
          {stacks.map((s) => (
            <li key={s.id} className="stack" style={{ paddingLeft: `${Math.min(s.depth, 4) * 10}px` }}>
              <strong>{s.name}</strong>
              <span className="meta">
                {s.qty} {s.unit} · {weight(s.weightG)} · Bulk {bulk(s.bulkTenths)}
                {s.worn ? ' · worn' : ''}
              </span>
              <span className="meta">
                Condition {s.condition}% · Wet {s.wetness}%{s.spoilage === null ? '' : ` · Spoilage ${s.spoilage}/1000`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">Orders are given through your own character.</p>
      {stores.length ? (
        <div className="store-links">
          {stores.map((p) => (
            <button type="button" key={p.id} onClick={() => ui.openBook(p.id)}>
              {p.name}: the Book
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
