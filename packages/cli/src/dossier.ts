/**
 * `coulee inspect` dossier rendering (04 §12.1 Character dossier, as text). FOUNDATION-OWNED;
 * modules may ask the orchestrator to add sections for their view parts.
 */
import { type ActorView, explainLine, type ViewModel } from '@coulee/core';

const bar = (v: number, max = 1000, width = 20) => {
  const n = Math.max(0, Math.min(width, Math.round((v / max) * width)));
  return `${'#'.repeat(n)}${'.'.repeat(width - n)}`;
};
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const kg = (g: number) => `${(g / 453.592).toFixed(1)} lb`;

export function findActor(vm: ViewModel, query: string): { actor?: ActorView; matches: ActorView[] } {
  const q = query.trim().toLowerCase();
  const exact = vm.actors.filter((a) => a.key === q || a.name.toLowerCase() === q || a.shortName.toLowerCase() === q);
  if (exact.length === 1) return { actor: exact[0] as ActorView, matches: exact };
  const partial = vm.actors.filter((a) => a.key.includes(q.replaceAll(' ', '_')) || a.name.toLowerCase().includes(q));
  return partial.length === 1 ? { actor: partial[0] as ActorView, matches: partial } : { matches: partial };
}

export function renderDossier(vm: ViewModel, a: ActorView): string {
  const place = (id: number) => vm.places.find((p) => p.id === id)?.name ?? `#${id}`;
  const L: string[] = [];
  L.push(`=== ${a.name} ===`);
  L.push(
    `${a.age}-year-old ${a.sex} ${a.people}, ${a.occupation}. ${vm.time.dateText}, ${String(vm.time.hour).padStart(2, '0')}:00.`,
  );
  L.push(`At: ${place(a.placeId)} — ${a.activity.verb} (since ${a.activity.since}, ${a.activity.source})`);
  if (a.traits.length) L.push(`Traits: ${a.traits.join(', ')}`);
  if (a.conditions.length) L.push(`Conditions: ${a.conditions.join(', ')}`);
  L.push('', '-- Needs --');
  for (const n of a.needs.list)
    L.push(`  ${n.name.padEnd(16)} ${bar(n.value)} ${String(n.value).padStart(4)} ${n.band}`);
  L.push('', '-- Psyche --');
  const p = a.psyche;
  L.push(
    `  ego ${p.ego}  superego ${p.superego}  id ${p.idAppetite}  anxiety ${p.anxiety}${p.persona ? `  persona: ${p.persona}` : ''}`,
  );
  for (const t of p.thoughts) L.push(`  [${t.voice}] ${t.label} (${t.intensity})`);
  if (p.chosen) {
    L.push(`  chose: ${p.chosen.urge} (${p.chosen.voice}${p.chosen.compromise ? ', compromise' : ''})`);
    if (p.chosen.explain) L.push(`    ${explainLine(p.chosen.explain)}`);
  }
  for (const d of p.recentDefenses) L.push(`  defense: ${d.defense} at ${d.at}`);
  L.push('', '-- Relationships --');
  for (const r of a.social.relationships) L.push(`  ${r.label} ${r.otherName}`);
  L.push('', '-- Opinions --');
  for (const o of a.social.opinions) {
    L.push(`  ${o.targetName}: aff ${o.affection} res ${o.respect} tru ${o.trust} fear ${o.fear} ${o.label}`);
    for (const r of o.reasons)
      L.push(`    - ${r.label} (aff ${r.affection} res ${r.respect} tru ${r.trust} fear ${r.fear})`);
  }
  L.push('', '-- Memories --');
  for (const m of a.social.memories.slice(-10)) L.push(`  [${m.kind}] ${m.summary} (salience ${m.salience})`);
  L.push('', '-- Beliefs --');
  for (const b of a.belief.beliefs)
    L.push(`  ${b.text} — credence ${b.credence}${b.conceal ? ' (concealed)' : ''}${b.voiced ? ' (voiced)' : ''}`);
  for (const g of a.belief.grudges)
    L.push(`  GRUDGE vs ${g.targetLabel}: ${g.intensity} (${g.aim}) — ${g.founding.join('; ')}`);
  L.push('', '-- Carried --');
  L.push(
    `  ${kg(a.items.totalWeightG)}, bulk ${(a.items.totalBulkTenths / 10).toFixed(1)}, ${a.items.loadBand}; purse ${money(a.provisions.purseCents)}`,
  );
  for (const s of a.items.carried) L.push(`  ${'  '.repeat(s.depth)}${s.qty} × ${s.name} (${kg(s.weightG)})`);
  const r = a.provisions.readiness;
  L.push('', '-- Provisions --');
  L.push(
    `  kcal today ${a.provisions.nutrition.kcalToday}, avg ${a.provisions.nutrition.kcalAvg}; scurvy ${a.provisions.nutrition.scurvy}; monotony ${a.provisions.nutrition.monotony}`,
  );
  L.push(
    `  days of food ${(r.daysOfFoodTenths / 10).toFixed(1)} at ${r.kcalPerDay} kcal/day${r.spoilsFirst ? `; spoils first: ${r.spoilsFirst.name} in ${(r.spoilsFirst.inDaysTenths / 10).toFixed(1)} d` : ''}`,
  );
  for (const w of r.warnings) L.push(`  ! ${w}`);
  const hh = vm.households.find((h) => h.id === a.householdId);
  if (hh) {
    L.push(
      '',
      `-- Household: ${hh.name} (cash ${money(hh.provisions.cashCents)}, rations ${hh.provisions.rationPct}%) --`,
    );
    for (const s of hh.provisions.pantry) L.push(`  ${'  '.repeat(s.depth)}${s.qty} ${s.unit} ${s.name}`);
  }
  return L.join('\n');
}
