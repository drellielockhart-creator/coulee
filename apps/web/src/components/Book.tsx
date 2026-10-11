/**
 * The store's Book (03 §2, 11 §2.6): one store, one section at a time, thumb-index tabs.
 * OWNER: module:web. Opened from a store's place card ("Open Pratt's Book"); never appended to
 * the Kit Sheet. Buying is a Command; credit asks for a second tap (11 §1.2: consequential and
 * benign actions are kept apart).
 */
import { useState } from 'react';
import { cmd } from '../lib/commands.ts';
import { money, SECTION_LABEL, SECTION_ORDER, weight } from '../lib/format.ts';
import { useUi } from '../state/ui.ts';
import { useSimCtx, useVm } from './ctx.ts';
import { Empty, Row, Tabs } from './ui.tsx';

export function Book({ placeId }: { placeId: number | null }) {
  const sim = useSimCtx();
  const vm = useVm();
  const ui = useUi();
  const [credit, setCredit] = useState<string | null>(null);
  const place = vm.places.find((p) => p.id === placeId && p.provisions.stock !== null);
  const player = vm.actors.find((a) => a.id === vm.playerId) ?? null;
  if (!place) return <Empty>No store’s Book is open. Tap a store on the map to open its Book.</Empty>;
  const stock = place.provisions.stock ?? [];
  const sectionOf = (defId: string) => sim.items[defId]?.section ?? 'misc';
  const sections = SECTION_ORDER.filter((id) => stock.some((s) => sectionOf(s.defId) === id));
  const section = ui.bookSection !== null && sections.includes(ui.bookSection) ? ui.bookSection : (sections[0] ?? null);
  // One line per item: the store's separate stacks of the same thing read as one listing.
  const lines = [
    ...stock
      .filter((s) => sectionOf(s.defId) === section)
      .reduce((m, s) => {
        const prev = m.get(s.defId);
        m.set(
          s.defId,
          prev ? { ...prev, qty: prev.qty + s.qty, priceCents: Math.min(prev.priceCents, s.priceCents) } : s,
        );
        return m;
      }, new Map<string, (typeof stock)[number]>())
      .values(),
  ];
  return (
    <div className="book" data-testid="book">
      {player ? <Row k="Purse" v={money(player.provisions.purseCents)} /> : null}
      {place.provisions.open === false ? <p className="warn">⚠ Closed now: orders wait for opening hours.</p> : null}
      {sections.length === 0 ? (
        <Empty>No stock listed.</Empty>
      ) : (
        <>
          <Tabs
            tabs={sections.map((id) => ({ id, label: SECTION_LABEL[id] ?? id }))}
            value={section ?? ''}
            onChange={(id) => {
              setCredit(null);
              ui.setBookSection(id);
            }}
            label="Book sections"
          />
          <ul className="book-page" aria-label={SECTION_LABEL[section ?? ''] ?? 'Stock'}>
            {lines.map((s) => {
              const def = sim.items[s.defId];
              return (
                <li className="stock-line" key={s.itemId}>
                  <span>
                    <strong>{s.name}</strong> <span className="price">{money(s.priceCents)}</span>
                    <small>
                      {def ? `${def.unit} · ${weight(def.weight_g)} · ` : ''}
                      {s.qty} in stock
                    </small>
                    {def?.copy ? <small className="copy">“{def.copy}”</small> : null}
                  </span>
                  {player ? (
                    credit === s.defId ? (
                      <fieldset className="stack-actions confirm" aria-label="Confirm credit">
                        <button
                          type="button"
                          className="consequential"
                          onClick={() => {
                            sim.command(cmd.buy(player.id, place.id, s.defId, 1, true));
                            setCredit(null);
                          }}
                        >
                          Owe {money(s.priceCents)}
                        </button>
                        <button type="button" onClick={() => setCredit(null)}>
                          Cancel
                        </button>
                      </fieldset>
                    ) : (
                      <div className="stack-actions">
                        <button
                          type="button"
                          onClick={() => sim.command(cmd.buy(player.id, place.id, s.defId, 1, false))}
                        >
                          Buy one
                        </button>
                        <button type="button" onClick={() => setCredit(s.defId)}>
                          On credit…
                        </button>
                      </div>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="hint">A purchase is an order to your character: it is weighed and applied on the next hour.</p>
    </div>
  );
}
