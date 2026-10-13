/**
 * The Outfitter (11 §2.6; 07 §12.3 M4): the Book of the counter the PC stands at. OWNER: module:web.
 *
 * The price list is the store's real stock (@coulee/play `storefront`). Compare sets two items
 * side by side on Pocket and four at Desk. Buying or selling opens an order with a quantity and a
 * preview, from the planner's own projection, of weight, bulk, load band, days of food and purse
 * before anything is confirmed. Confirming sends the session the very Command the preview judged;
 * it spends minutes through the shared session. Every food number has its Explain one tap away (M4 #5).
 */
import type { Storefront as Front, StoreLine, TradeOrder } from '@coulee/play';
import { useEffect, useRef, useState } from 'react';
import { bulk as bulkText, money, num, SECTION_LABEL, SECTION_ORDER, weight } from '../lib/format.ts';
import { moneyLine } from '../lib/play.ts';
import { useUi } from '../state/ui.ts';
import { useQuery } from '../useSim.ts';
import { useSimCtx, useVm } from './ctx.ts';
import { dayTenths, ExplainRow, ExplainView } from './ExplainView.tsx';
import { Outcome, useRunner } from './PlayPanel.tsx';
import { Empty, Row, Tabs } from './ui.tsx';

export function Storefront({ wide = false }: { wide?: boolean }) {
  const sim = useSimCtx();
  const front = useQuery(sim, { kind: 'storefront' }, 'storefront');
  if (!sim.play || !front) return <Empty>Reading the store’s Book…</Empty>;
  if (!front.storefront) return <NoCounter />;
  return <Counter front={front.storefront} wide={wide} />;
}

/** Not at a counter: where the stores are, with the Go order for each. */
function NoCounter() {
  const sim = useSimCtx();
  const vm = useVm();
  const runner = useRunner();
  const o = sim.play?.observation;
  const shops = vm.places.filter((p) => p.tags?.some((t) => t === 'store' || t === 'tavern' || t === 'mill'));
  return (
    <div className="storefront" data-testid="storefront">
      <Empty>There is no counter where you stand. The Book is read at the store itself.</Empty>
      <ul className="act-list">
        {shops.map((p) => {
          const go = o?.actions.find((a) => a.id === `go:${p.id}`);
          return go ? (
            <li key={p.id}>
              <button type="button" className="act-btn" disabled={runner.busy} onClick={() => void runner.run(go)}>
                Go to {p.name}
              </button>
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
}

/** The counter itself (exported for static rendering in tests). */
export function Counter({ front, wide }: { front: Front; wide: boolean }) {
  const sim = useSimCtx();
  const ui = useUi();
  const runner = useRunner();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [order, setOrder] = useState<TradeOrder | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const limit = wide ? 4 : 2;
  const sections = SECTION_ORDER.filter((id) => front.lines.some((l) => l.section === id));
  const section = ui.bookSection !== null && sections.includes(ui.bookSection) ? ui.bookSection : (sections[0] ?? null);
  const meal = sim.play?.observation.actions.find((a) => a.id === 'meal');
  const toggle = (defId: string) =>
    setCompare((c) => (c.includes(defId) ? c.filter((x) => x !== defId) : [...c, defId].slice(-limit)));
  const chosen = compare.flatMap((id) => front.lines.filter((l) => l.defId === id));
  const last = sim.play?.last ?? null;
  const traded = last?.ok && /^(Buy|Sell|Owe) /.test(last.label);
  return (
    <div className="storefront" data-testid="storefront">
      {last && (traded || !last.ok) ? <Outcome last={last} stops={[]} /> : null}
      {traded && sim.play?.digest.money.length ? (
        <div className="receipt" data-testid="receipt">
          {sim.play.digest.money.map((m) => (
            <p key={`${m.eventId}:${m.at}`}>◈ {moneyLine(m)}</p>
          ))}
        </div>
      ) : null}
      <p className="store-head">
        <strong>{front.name}</strong>
        {front.hours
          ? ` · ${front.open ? 'open' : 'closed'} ${String(front.hours.opens).padStart(2, '0')}:00–${front.hours.closes}:00`
          : ''}
      </p>
      <Row k="Purse" v={money(front.purseCents)} />
      {front.householdCents ? <Row k="Lodging cash box" v={money(front.householdCents)} /> : null}
      {front.creditCents ? <Row k="Credit the keeper allows" v={money(front.creditCents)} /> : null}
      {!front.open ? <ClosedNote front={front} runner={runner} /> : null}
      {meal || front.bedCents !== null ? (
        <div className="board">
          {meal ? (
            <button type="button" className="act-btn" disabled={runner.busy} onClick={() => void runner.run(meal)}>
              {meal.label}
            </button>
          ) : null}
          {front.bedCents !== null ? (
            <p className="hint">
              A bed here is {money(front.bedCents)}, charged once through the next noon when you sleep.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="segmented split" role="tablist" aria-label="Buy or sell">
        <button type="button" role="tab" aria-selected={side === 'buy'} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === 'sell'}
          disabled={front.sell.length === 0}
          onClick={() => setSide('sell')}
        >
          Sell{front.sell.length ? ` (${front.sell.length})` : ''}
        </button>
      </div>
      {comparing && chosen.length > 0 ? (
        <CompareTable lines={chosen} onClose={() => setComparing(false)} />
      ) : side === 'buy' ? (
        front.lines.length === 0 ? (
          <Empty>The shelves are bare.</Empty>
        ) : (
          <>
            <Tabs
              tabs={sections.map((id) => ({ id, label: SECTION_LABEL[id] ?? id }))}
              value={section ?? ''}
              onChange={(id) => {
                setOrder(null);
                ui.setBookSection(id);
              }}
              label="Book sections"
            />
            <ul className="book-page" aria-label={SECTION_LABEL[section ?? ''] ?? 'Stock'}>
              {front.lines
                .filter((l) => l.section === section)
                .map((l) => (
                  <StockLine
                    key={l.defId}
                    line={l}
                    compared={compare.includes(l.defId)}
                    onCompare={() => toggle(l.defId)}
                    ordering={order?.kind === 'buy' && order.defId === l.defId ? order : null}
                    onOrder={(o) => setOrder(o)}
                    canBuy={front.open && l.actionId !== null}
                    credit={front.creditCents}
                  />
                ))}
            </ul>
          </>
        )
      ) : (
        <ul className="book-page" aria-label="Things you could sell">
          {front.sell.map((s) => (
            <li key={s.itemId} className="stock-line">
              <span>
                <strong>{s.name}</strong> <span className="price">{money(s.unitCents)}</span>
                <small>
                  You carry {s.qty} {s.unit} · {weight(s.weightG)} each
                </small>
              </span>
              {order?.kind === 'sell' && order.itemId === s.itemId ? (
                <OrderEditor order={order} max={s.qty} unit={s.unit} name={s.name} onChange={setOrder} />
              ) : (
                <div className="stack-actions">
                  <button
                    type="button"
                    disabled={!s.actionId || !front.open}
                    onClick={() => setOrder({ kind: 'sell', itemId: s.itemId, qty: 1 })}
                  >
                    Sell…
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {compare.length > 0 && !comparing ? (
        <div className="compare-bar" data-testid="compare-bar">
          <span className="compare-names">
            Comparing {chosen.map((l) => l.name.split(/[,(]/)[0]?.trim()).join(' & ')}
            {compare.length < 2 ? ' (choose another)' : ''}
          </span>
          <button type="button" disabled={compare.length < 2} onClick={() => setComparing(true)}>
            Compare ▸
          </button>
          <button type="button" aria-label="Clear the comparison" onClick={() => setCompare([])}>
            ✕
          </button>
        </div>
      ) : null}
      <p className="hint">
        Each buy or sell line spends minutes from this hour. Figures come from the store’s Book and your own kit.
      </p>
    </div>
  );
}

function ClosedNote({ front, runner }: { front: Front; runner: ReturnType<typeof useRunner> }) {
  const opens = front.hours ? `${String(front.hours.opens).padStart(2, '0')}:00` : null;
  return (
    <div className="warn closed-note">
      <p>⚠ The counter is closed{opens ? `; it opens at ${opens}` : ''}. You may still read the Book.</p>
      {opens ? (
        <button
          type="button"
          disabled={runner.busy}
          onClick={() => void runner.wait(`wait until ${opens}`, `Wait till ${opens}`)}
        >
          Wait till {opens}
        </button>
      ) : null}
    </div>
  );
}

function StockLine({
  line: l,
  compared,
  onCompare,
  ordering,
  onOrder,
  canBuy,
  credit,
}: {
  line: StoreLine;
  compared: boolean;
  onCompare: () => void;
  ordering: TradeOrder | null;
  onOrder: (o: TradeOrder | null) => void;
  canBuy: boolean;
  credit: number;
}) {
  const f = l.food;
  return (
    <li className="stock-line" data-testid={`stock-${l.defId}`}>
      <span>
        <strong>{l.name}</strong>{' '}
        <span className="price">
          {money(l.priceCents)}
          <small> /{l.unit}</small>
        </span>
        <small>
          {weight(l.weightG)} · Bulk {l.bulk} · {l.inStock} in stock
        </small>
        {l.copy ? <small className="copy">“{l.copy}”</small> : null}
      </span>
      {f ? (
        <div className="food-facts">
          <ExplainRow
            k={`Food per ${l.unit}`}
            v={
              <>
                {num(f.kcal)} kcal
                <small className="sub-v">
                  {f.proteinG} g protein · {f.fatG} g fat · fresh {f.fresh} · keeps {f.shelfLifeDays} d
                </small>
              </>
            }
            explain={f.explain.kcal}
          />
          <ExplainRow
            k="Weight for worth"
            v={`${num(f.kcalPerLb)} kcal/lb${f.kcalPerDollar === null ? '' : ` · ${num(f.kcalPerDollar)}/$`}`}
            explain={f.explain.worth}
          />
          <p className="prep">
            Your kit:{' '}
            {f.prep.map((p, i) => (
              <span key={p.method} className={p.missing.length ? 'warn' : ''}>
                {i ? ' · ' : ''}
                {p.method} {p.missing.length ? `✗ needs ${p.missing.join(', ')}` : '✓'}
              </span>
            ))}
          </p>
        </div>
      ) : null}
      {ordering ? (
        <OrderEditor
          order={ordering}
          max={Math.max(1, l.maxQty)}
          maxOnCredit={Math.max(1, l.maxOnCredit)}
          unit={l.unit}
          name={l.name}
          onChange={onOrder}
          credit={credit}
        />
      ) : (
        <div className="stack-actions">
          <button type="button" aria-pressed={compared} onClick={onCompare}>
            {compared ? '✓ Comparing' : 'Compare'}
          </button>
          <button type="button" disabled={!canBuy} onClick={() => onOrder({ kind: 'buy', defId: l.defId, qty: 1 })}>
            Buy…
          </button>
        </div>
      )}
    </li>
  );
}

/** Quantity, preview, confirm: nothing changes until the confirm tap (11 §1.2). */
function OrderEditor({
  order,
  max,
  unit,
  name,
  onChange,
  credit = 0,
  maxOnCredit,
}: {
  order: TradeOrder;
  max: number;
  /** The quantity limit when the keeper's credit counts too. */
  maxOnCredit?: number;
  unit: string;
  name: string;
  onChange: (o: TradeOrder | null) => void;
  credit?: number;
}) {
  const sim = useSimCtx();
  const runner = useRunner();
  const preview = useQuery(sim, { kind: 'trade_preview', order }, 'trade_preview')?.preview ?? null;
  const fresh = preview && JSON.stringify(preview.order) === JSON.stringify(order) ? preview : null;
  const buying = order.kind === 'buy';
  const onCredit = order.kind === 'buy' && order.onCredit === true;
  const limit = Math.max(1, onCredit ? (maxOnCredit ?? max) : max);
  const setQty = (qty: number) => onChange({ ...order, qty: Math.max(1, Math.min(limit, qty)) } as TradeOrder);
  const verb = buying ? (onCredit ? 'Owe' : 'Buy') : 'Sell';
  const ref = useRef<HTMLDivElement>(null);
  // The order opens where the thumb tapped; bring all of it into view once.
  useEffect(() => {
    // Braced: scrollIntoView may return a promise, and an effect must return nothing or a cleanup.
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  return (
    <div className="order" data-testid="order" ref={ref}>
      <fieldset className="qty" aria-label="Quantity">
        <button type="button" aria-label="One fewer" onClick={() => setQty(order.qty - 1)}>
          −
        </button>
        <output aria-live="polite">
          {order.qty} {unit}
        </output>
        <button type="button" aria-label="One more" onClick={() => setQty(order.qty + 1)}>
          +
        </button>
        <button type="button" onClick={() => setQty(limit)}>
          Most ({limit})
        </button>
      </fieldset>
      {fresh ? (
        <div className="preview" data-testid="preview">
          <Delta
            k="Weight · Bulk"
            a={`${weight(fresh.before.weightG)} · ${bulkText(fresh.before.bulkTenths)}`}
            b={`${weight(fresh.after.weightG)} · ${bulkText(fresh.after.bulkTenths)}`}
          />
          <Delta
            k="Load"
            a={`${fresh.before.loadBand} ${fresh.before.loadPct}%`}
            b={`${fresh.after.loadBand} ${fresh.after.loadPct}%`}
            warn={fresh.after.loadBand !== fresh.before.loadBand}
          />
          <ExplainRow
            k="Days of food"
            v={`${dayTenths(fresh.before.daysOfFoodTenths)} → ${dayTenths(fresh.after.daysOfFoodTenths)}`}
            explain={fresh.explain.daysOfFood}
            totalUnit="days"
            testId="preview-days"
          />
          <ExplainRow
            k="Usable food"
            v={`${num(fresh.before.kcalOnHand)} → ${num(fresh.after.kcalOnHand)} kcal`}
            explain={fresh.explain.kcalOnHand}
          />
          <Delta k="Purse" a={money(fresh.before.purseCents)} b={money(fresh.after.purseCents)} />
          {!fresh.ok ? <p className="warn">⚠ {fresh.reason}</p> : null}
        </div>
      ) : (
        <p className="hint">Weighing it up…</p>
      )}
      <div className="stack-actions">
        <button
          type="button"
          className={onCredit ? 'consequential' : 'primary'}
          disabled={!fresh?.ok || runner.busy}
          onClick={async () => {
            if (!fresh) return;
            const r = await runner.run({
              command: fresh.command,
              label: `${verb} ${order.qty} ${unit} ${name}`,
            });
            if (r?.ok) onChange(null);
          }}
        >
          {verb} {order.qty} for {fresh ? money(fresh.totalCents || 0) : '…'}
        </button>
        {buying && credit > 0 ? (
          <button
            type="button"
            aria-pressed={onCredit}
            onClick={() => onChange({ ...order, onCredit: !onCredit } as TradeOrder)}
          >
            {onCredit ? 'Pay cash' : 'On credit…'}
          </button>
        ) : null}
        <button type="button" onClick={() => onChange(null)}>
          Cancel
        </button>
      </div>
      {fresh ? <p className="hint">{fresh.note}</p> : null}
    </div>
  );
}

function Delta({ k, a, b, warn }: { k: string; a: string; b: string; warn?: boolean }) {
  return <Row k={k} v={a === b ? a : `${a} → ${b}`} warn={warn ?? false} />;
}

/** Side by side (11 §2.6: two on Pocket, four at Desk); every food figure explains itself. */
function CompareTable({ lines, onClose }: { lines: StoreLine[]; onClose: () => void }) {
  const [open, setOpen] = useState<{ defId: string; row: string; key: 'kcal' | 'worth' } | null>(null);
  const shown = open ? lines.find((l) => l.defId === open.defId)?.food?.explain[open.key] : null;
  // Each food figure is its own target; several share one Explain (the catalog's food value).
  const cell = (l: StoreLine, row: string, key: 'kcal' | 'worth', text: string) =>
    l.food ? (
      <button
        type="button"
        className="cell-btn"
        aria-pressed={open?.defId === l.defId && open.row === row}
        onClick={() => setOpen(open?.defId === l.defId && open.row === row ? null : { defId: l.defId, row, key })}
      >
        {text}
      </button>
    ) : (
      '—'
    );
  const rows: Array<[string, (l: StoreLine) => React.ReactNode]> = [
    ['Price', (l) => `${money(l.priceCents)}/${l.unit}`],
    ['Weight', (l) => weight(l.weightG)],
    ['Bulk', (l) => String(l.bulk)],
    ['Energy', (l) => cell(l, 'Energy', 'kcal', l.food ? `${num(l.food.kcal)} kcal` : '')],
    ['kcal per lb', (l) => cell(l, 'kcal per lb', 'worth', l.food ? num(l.food.kcalPerLb) : '')],
    [
      'kcal per $',
      (l) => cell(l, 'kcal per $', 'worth', l.food?.kcalPerDollar != null ? num(l.food.kcalPerDollar) : '—'),
    ],
    ['Protein', (l) => cell(l, 'Protein', 'kcal', l.food ? `${l.food.proteinG} g` : '')],
    ['Fat', (l) => cell(l, 'Fat', 'kcal', l.food ? `${l.food.fatG} g` : '')],
    ['Fresh', (l) => cell(l, 'Fresh', 'kcal', l.food ? String(l.food.fresh) : '')],
    ['Keeps', (l) => cell(l, 'Keeps', 'kcal', l.food ? `${l.food.shelfLifeDays} d` : '')],
    [
      'Your kit can',
      (l) =>
        l.food
          ? l.food.prep
              .filter((p) => !p.missing.length)
              .map((p) => p.method)
              .join(', ') || 'not prepare it'
          : '—',
    ],
  ];
  return (
    <div className="compare" data-testid="compare">
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Figure</span>
            </th>
            {lines.map((l) => (
              <th key={l.defId} scope="col">
                {l.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {lines.map((l) => (
                <td key={l.defId}>{f(l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {shown ? <ExplainView explain={shown} /> : <p className="hint">Tap a food figure for its working.</p>}
      <button type="button" className="back" onClick={onClose}>
        ◂ Back to the Book
      </button>
    </div>
  );
}
