import type { ActorView, items, provisions } from '@coulee/core';
import { useState } from 'react';
import { cmd } from '../lib/commands.ts';
import { bulk, money, weight } from '../lib/format.ts';
import { useUi } from '../state/ui.ts';
import { useReadiness } from '../useSim.ts';
import { useSimCtx, useVm } from './ctx.ts';
import { Empty, Row, SectionHead } from './ui.tsx';

export function ReadinessLedger({ readiness: r }: { readiness: provisions.Readiness | null }) {
  if (!r) return <Empty>Checking the provisions…</Empty>;
  return (
    <div className="readiness">
      <Row k="Days of food" v={`${(r.daysOfFoodTenths / 10).toFixed(1)} days`} />
      <Row k="Usable food" v={`${r.kcalOnHand} kcal`} />
      <Row k="Daily allowance" v={`${r.kcalPerDay} kcal`} />
      <Row
        k="Cooking fuel"
        v={r.daysOfFuelTenths === null ? 'Not assessed' : `${(r.daysOfFuelTenths / 10).toFixed(1)} days`}
      />
      <Row
        k="Spoils first"
        v={
          r.spoilsFirst
            ? `${r.spoilsFirst.name} · ${(r.spoilsFirst.inDaysTenths / 10).toFixed(1)} days`
            : 'None forecast'
        }
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

/** Pack view for someone who eats at the family table: the pantry's horizon and its warnings. */
function HomeLedger({ household, readiness: r }: { household: string; readiness: provisions.Readiness | null }) {
  if (!r) return <Empty>Checking the household pantry…</Empty>;
  return (
    <div className="readiness">
      <Row k="Eats at home" v={`household pantry ${(r.daysOfFoodTenths / 10).toFixed(1)} days`} />
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

export function KitSheet({ actor }: { actor: ActorView }) {
  const sim = useSimCtx();
  const vm = useVm();
  const [pantry, setPantry] = useState(false);
  const [container, setContainer] = useState('');
  const household = vm.households.find((h) => h.id === actor.householdId);
  const holder = pantry && household ? { householdId: household.id } : { actorId: actor.id };
  const readiness = useReadiness(sim, holder);
  // Someone who eats at home lives off the household pantry, not their pockets (P8 legibility:
  // warn about the store that feeds them). The pack ledger shows only if the pack holds food.
  const homeReadiness = useReadiness(sim, !pantry && household ? { householdId: household.id } : null);
  const packHasFood = actor.items.carried.some((st) => sim.items[st.defId]?.food);
  const eatsAtHome = !pantry && household !== undefined && !packHasFood;
  const stacks = pantry ? (household?.provisions.pantry ?? []) : actor.items.carried;
  const own = actor.id === vm.playerId;
  const containers = actor.items.carried.filter((s) => sim.items[s.defId]?.container);
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
        <HomeLedger household={household?.name ?? 'the household'} readiness={homeReadiness} />
      ) : (
        <ReadinessLedger readiness={readiness} />
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
      {own && containers.length > 0 ? (
        <label className="field">
          Pack into
          <select value={container} onChange={(e) => setContainer(e.target.value)}>
            <option value="">Directly carried</option>
            {containers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {stacks.length === 0 ? (
        <Empty>Nothing recorded here yet.</Empty>
      ) : (
        <ul className="inventory" aria-label="Inventory">
          {stacks.map((s) => (
            <StackLine key={s.id} stack={s} actor={actor} own={own} into={container} />
          ))}
        </ul>
      )}
      {own ? (
        <>
          <SectionHead>Standing ration order</SectionHead>
          <label className="field">
            Allowance
            <select
              aria-label="Ration allowance"
              value={household?.provisions.rationPct ?? 100}
              onChange={(e) =>
                sim.command(cmd.setRations(actor.id, pantry ? actor.householdId : null, Number(e.target.value)))
              }
            >
              <option value={50}>Half · 50%</option>
              <option value={75}>Three quarters · 75%</option>
              <option value={100}>Full · 100%</option>
              <option value={125}>Extra · 125%</option>
            </select>
          </label>
          <StoreBooks purseCents={actor.provisions.purseCents} />
        </>
      ) : (
        <p className="hint">Orders are given through your own character.</p>
      )}
    </div>
  );
}

/** The Book lives in its own panel (11 §2.6); the Kit Sheet only points to the stores. */
function StoreBooks({ purseCents }: { purseCents: number }) {
  const vm = useVm();
  const openBook = useUi((s) => s.openBook);
  const stores = vm.places.filter((p) => p.provisions.stock !== null);
  if (stores.length === 0) return null;
  return (
    <>
      <SectionHead>The store here</SectionHead>
      <Row k="Purse" v={money(purseCents)} />
      <div className="store-links">
        {stores.map((p) => (
          <button type="button" key={p.id} onClick={() => openBook(p.id)}>
            {p.name}: the Book
          </button>
        ))}
      </div>
    </>
  );
}

function StackLine({
  stack: s,
  actor,
  own,
  into,
}: {
  stack: items.ItemStackView;
  actor: ActorView;
  own: boolean;
  into: string;
}) {
  const sim = useSimCtx();
  const def = sim.items[s.defId];
  return (
    <li className="stack" style={{ paddingLeft: `${Math.min(s.depth, 4) * 10}px` }}>
      <strong>{s.name}</strong>
      <span className="meta">
        {s.qty} {s.unit} · {weight(s.weightG)} · Bulk {bulk(s.bulkTenths)}
        {s.worn ? ' · worn' : ''}
      </span>
      <span className="meta">
        Condition {s.condition}% · Wet {s.wetness}%{s.spoilage === null ? '' : ` · Spoilage ${s.spoilage}/1000`}
      </span>
      {def?.food ? (
        <span className="meta">
          {def.food.kcal} kcal · Protein {def.food.protein_g} g · Fat {def.food.fat_g} g · Fresh {def.food.fresh}
        </span>
      ) : null}
      {own ? (
        <div className="stack-actions">
          {def?.food?.prep.map((p) => (
            <button
              type="button"
              key={p.method}
              onClick={() => sim.command(cmd.eat(actor.id, s.id as Parameters<typeof cmd.eat>[1], p.method, 1))}
            >
              Eat · {p.method}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              sim.command(
                cmd.pack(
                  actor.id,
                  s.id as Parameters<typeof cmd.pack>[1],
                  1,
                  into === '' ? null : (Number(into) as Parameters<typeof cmd.pack>[3]),
                ),
              )
            }
          >
            Pack one
          </button>
        </div>
      ) : null}
    </li>
  );
}
