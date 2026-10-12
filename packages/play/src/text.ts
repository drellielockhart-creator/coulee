import { type Command, explainLine } from '@coulee/core';
import type { AvailableAction } from './actions.ts';
import type { Observation } from './observation.ts';
export const HELP = `One action = one game-hour; queries take no time. Sleep locks 4 hours.
Eat defaults to ONE serving; use eat hardtack 2 for two. Need effects use the previous hour's activity.
look | signs | investigate <sign id> | actions [page] | go <place name/id> | talk <person> | <interaction> <person>
buy <item> [qty] | sell <item> | eat <item> [servings] [method] | cook <item> [servings] [method]
drink | meal | sleep | rest | work | wait <Nh|Nd> | wait until <HH:00|dawn|morning|noon|dusk|night|tomorrow>
prices | places [page] | standing <sleep|eat|drink|warmth|lodging> <on|off> | agency <commanded|psyche>
inspect <actor/item/place> | pack <item> into <container> | unpack <item>
rations <10..150> | plan | journal | explain <event id>
Enter a menu number or stable action id. save <file> | load <file> | fork | help | quit`;
export const SESSION_HELP = HELP.replace('save <file> | load <file> | fork | help | quit', 'help');
export function menuActions(o: Observation, page = 0): AvailableAction[] {
  if (page < 0) return o.actions.filter((a) => a.id.startsWith('go:')).slice((-page - 1) * 20, -page * 20);
  if (page > 0) return o.actions.slice((page - 1) * 20, page * 20);
  const basic = [
    'look',
    'signs',
    'plan',
    'journal',
    'activity:sleep',
    'drink',
    'activity:idle_at_home',
    'activity:work',
    'wait',
  ];
  return [
    ...basic.flatMap((id) => o.actions.find((a) => a.id === id) ?? []),
    ...o.actions
      .filter((a) => a.id.startsWith('go:') && /tavern|outfit|store|mercantile|ford/i.test(a.label))
      .slice(0, 4),
    ...o.actions.filter((a) => a.id.startsWith('talk:introduce:') || a.id.startsWith('talk:chat:')).slice(0, 2),
    ...o.actions.filter((a) => a.id.startsWith('eat:')).slice(0, 2),
  ];
}
export function renderObservation(o: Observation, page = 0, previous?: Observation): string {
  const r = o.self.provisions.readiness;
  const cash = (n: number) => `${n < 0 ? '−' : '+'}$${(Math.abs(n) / 100).toFixed(2)}`;
  const changes = o.changes;
  const lines = [
    `Since last look: ${changes.elapsed ? `${changes.elapsed / 60}h passed` : 'no time passed'}${changes.needs.length ? '; ' + changes.needs.join('; ') : ''}.`,
    ...changes.money.map((m) => `Money: purse ${cash(m.purse)}, household ${cash(m.household)} — ${m.reason}`),
    ...(changes.skipped ? [`Skipped ${changes.skipped} minor conversations nearby.`] : []),
    ...changes.events.slice(-3),
    `${o.time.stamp} | ${o.mode.toUpperCase()} | ${o.place.name}`,
    `${o.self.name} — ${o.self.activity.verb}. Purse $${(o.self.provisions.purseCents / 100).toFixed(2)}; household $${(o.self.provisions.householdCents / 100).toFixed(2)}. ${o.weather.temperatureF}°F, ${o.weather.description.toLowerCase()}.`,
    `Food ${(r.daysOfFoodTenths / 10).toFixed(1)} days; ${o.self.inventory.loadBand}, ${(o.self.inventory.totalWeightG / 1000).toFixed(1)} kg.`,
    `Vitals: ${o.self.needs.list
      .filter((n) => n.kind === 'physical')
      .map((n) => `${n.name} ${n.value}${n.band ? ` (${n.band})` : ''}`)
      .join('; ')}`,
    ...(o.store.hours
      ? [`Counter ${o.store.open ? 'open' : 'closed'}; hours ${o.store.hours.opens}:00–${o.store.hours.closes}:00.`]
      : []),
    ...(o.store.bedCents !== undefined
      ? [
          `Board: bed $${(o.store.bedCents / 100).toFixed(2)} until noon; meal $${((o.store.mealCents ?? 0) / 100).toFixed(2)} (type meal).`,
        ]
      : []),
    o.place.description,
    ...o.requests.map((r) => `Pending loan request: answer:${r.id}:yes or answer:${r.id}:no (expires within the hour)`),
    ...o.signs
      .filter((q) => q.closedAt === null)
      .slice(-2)
      .map((q) => `Open sign: ${q.text} (investigate ${q.signId})`),
    `Here: ${
      o.present
        .slice(0, 6)
        .map((a) => `${a.name} (#${a.id})`)
        .join(', ') || 'no one else'
    }${o.present.length > 6 ? `; ${o.present.length - 6} more (inspect by name)` : ''}.`,
    ...['Appetite', 'Conscience'].flatMap((voice) => {
      const t = [...o.self.mind.thoughts]
        .filter(
          (t) =>
            t.voice === voice &&
            t.stance !== 'against' &&
            (o.self.agencyMode !== 'commanded' || t.urge !== o.self.mind.chosen?.urge),
        )
        .sort((a, b) => b.intensity - a.intensity || a.id - b.id)[0];
      return t
        ? [
            `${voice}: ${t.line ?? t.label}${
              o.self.agencyMode === 'commanded' && t.urge !== o.self.mind.chosen?.urge
                ? ` (held for your order; you may: ${t.urge
                    .replace(/^activity:sleep$/, 'sleep')
                    .replace(/^interaction:/, '')
                    .replace(
                      /->(\d+)/,
                      (_, id) => ' ' + (o.knownPeople.find((p) => p.id === Number(id))?.name ?? '#' + id),
                    )})`
                : ''
            }`,
          ]
        : [];
    }),
    ...(o.self.mind.chosen?.voice === 'Self-Command'
      ? [`Self-Command: ${o.self.mind.verdict?.label ?? o.self.mind.chosen.urge}`]
      : []),
    ...o.self.belief.beliefs.slice(-2).map((b) => `Heard: ${b.text}`),
    ...o.events
      .filter(
        (e) =>
          !previous?.events.some((p) => p.id === e.id) &&
          !(o.changes.skipped > 0 && e.kind === 'social.interaction' && !o.changes.events.includes(e.summary)),
      )
      .slice(-2)
      .map((e) => `[${e.id}] ${e.summary}${e.explain ? ' — explain ' + e.id : ''}`),
    // What was said this hour, in the speakers' words (social talk lines).
    ...(o.said ?? []).flatMap((e) => (e.lines ?? []).map((l) => `  ${l.speaker}: “${l.text}”`)),
    ...r.warnings.slice(0, 2).map((w) => `Kit: ${w}`),
    ...menuActions(o, page).map((a, i) => `${i + 1}. ${a.label} [${a.id}]`),
    `Actions ${o.actions.length}; “actions 1” for full menu pages; “places 1” for destinations; “help” for verbs.`,
  ];
  if (!previous) return lines.filter(Boolean).join('\n');
  const oldLines = new Set(renderObservation(previous, page).split('\n'));
  return lines
    .filter((line) => line && (!oldLines.has(line) || line.startsWith('Since last look:') || line.startsWith('Money:')))
    .join('\n');
}
const normalized = (s: string) => s.trim().toLowerCase().replaceAll('_', ' ');
export function parseText(line: string, o: Observation, page = 0): Command | string {
  const text = line.trim(),
    words = text.split(/\s+/),
    verb = words.shift()?.toLowerCase() ?? '',
    tail = words.join(' ');
  const find = (actions: AvailableAction[], query: string): Command | string => {
    const q = normalized(query);
    const exact = actions.filter((a) => normalized(a.id) === q || normalized(a.label) === q);
    const matches = exact.length
      ? exact
      : actions.filter((a) => normalized(a.label).includes(q) || normalized(a.id).includes(q));
    return matches.length === 1 && matches[0]
      ? matches[0].command
      : matches.length
        ? 'Ambiguous: ' +
          matches
            .slice(0, 8)
            .map((a) => a.id)
            .join(', ')
        : 'No available action matches; use look or actions';
  };
  const pc = o.self.id;
  const action = o.actions.find((a) => a.id === text);
  if (action) return action.command;
  if (/^[+-]?\d+$/.test(text)) return menuActions(o, page)[Number(text) - 1]?.command ?? 'No such menu number';
  if (verb === 'signs') return { kind: 'fae.signs', actorId: pc, data: {} };
  if (verb === 'investigate') return { kind: 'fae.investigate', actorId: pc, data: { signId: tail } };
  if (verb === 'help') return HELP;
  if (verb === 'agency' || verb === 'standing') {
    const orders = { ...o.self.standingOrders, activities: [...o.self.standingOrders.activities] };
    if (verb === 'agency')
      return ['commanded', 'psyche'].includes(tail)
        ? { kind: 'core.standing_orders', actorId: pc, data: { agencyMode: tail as 'commanded' | 'psyche', orders } }
        : 'Use agency commanded or agency psyche';
    const key = words[0] as 'sleep' | 'eat' | 'drink' | 'warmth' | 'lodging';
    if (
      !['sleep', 'eat', 'drink', 'warmth', 'lodging'].includes(key) ||
      words.length !== 2 ||
      !['on', 'off'].includes(words[1] ?? '')
    )
      return 'Use standing <sleep|eat|drink|warmth|lodging> <on|off>';
    orders[key] = words[1] === 'on';
    return { kind: 'core.standing_orders', actorId: pc, data: { orders } };
  }
  if (['look', 'journal', 'plan'].includes(verb))
    return { kind: 'activity.observe', actorId: pc, data: { query: verb as 'look' | 'journal' | 'plan' } };
  if (verb === 'explain') return { kind: 'activity.observe', actorId: pc, data: { query: 'explain', target: tail } };
  if (verb === 'inspect')
    return find(
      o.actions.filter((a) => a.id.startsWith('inspect:')),
      tail,
    );
  if (verb === 'go' && /^\d+$/.test(tail))
    return o.actions.find((a) => a.id === `go:${Number(tail)}`)?.command ?? 'No such destination';
  if (verb === 'go')
    return find(
      o.actions.filter((a) => a.id.startsWith('go:')),
      tail,
    );
  if (verb === 'wait') {
    if (words[0] === 'until') {
      const named: Record<string, number> = { dawn: 6, morning: 8, noon: 12, dusk: 18, night: 21, tomorrow: 0 };
      const raw = words.slice(1).join(' ');
      const value = raw in named ? `${named[raw]}:00` : raw,
        match = /^(\d{1,2}):00$/.exec(value);
      if (match) {
        const hour = Number(match[1]);
        if (hour > 23) return 'Hour must be 0–23';
        let time = Math.floor(o.time.t / 1440) * 1440 + hour * 60;
        if (time <= o.time.t) time += 1440;
        return { kind: 'activity.wait', actorId: pc, data: { minutes: 1440, untilTime: time } };
      }
      if (['social.interaction', 'belief.transmitted', 'provisions.wages', 'activity.gathering'].includes(value))
        return { kind: 'activity.wait', actorId: pc, data: { minutes: 1440, untilEvent: value } };
      return 'Unknown wait target; use HH:00, dawn, morning, noon, dusk, night or tomorrow (whole hours only)';
    }
    const m = /^(\d+)\s*(h|d|hours?|days?)?$/.exec(tail || '1h');
    return m
      ? { kind: 'activity.wait', actorId: pc, data: { minutes: Number(m[1]) * (m[2]?.startsWith('d') ? 1440 : 60) } }
      : 'Use wait 8h or wait until 08:00';
  }
  if (verb === 'rations' || (verb === 'set' && words[0] === 'rations'))
    return {
      kind: 'provisions.set_rations',
      actorId: pc,
      data: { householdId: null, rationPct: Number(verb === 'set' ? words[1] : tail) },
    };
  if (verb === 'drink') return 'No accessible water; fetch water at your lodgings or go to a water source.';
  if (['sleep', 'rest', 'work'].includes(verb))
    return find(
      o.actions,
      `activity:${{ sleep: 'sleep', rest: 'idle_at_home', drink: 'fetch_water', work: 'work' }[verb]}`,
    );
  if (verb === 'buy' || verb === 'sell') {
    const last = words.at(-1),
      qty = last && /^[+-]?\d+(?:\.\d+)?$/.test(last) ? Number(words.pop()) : 1;
    if (!Number.isSafeInteger(qty) || qty <= 0) return 'Quantity must be a positive whole number';
    const found = find(
      o.actions.filter((a) => a.id.startsWith(`${verb}:`)),
      words.join(' '),
    );
    return typeof found === 'string'
      ? found
      : found.kind === 'provisions.buy'
        ? { ...found, data: { ...found.data, qty } }
        : found.kind === 'provisions.sell'
          ? { ...found, data: { ...found.data, qty } }
          : found;
  }
  if (['eat', 'cook', 'prepare'].includes(verb)) {
    const countIndex = words.findIndex((word) => /^\d+$/.test(word));
    const servings = countIndex < 0 ? 1 : Number(words.splice(countIndex, 1)[0]);
    const requested = normalized(words.join(' '));
    let choices = o.actions.filter((a) => a.command.kind === 'provisions.eat');
    if (verb !== 'eat')
      choices = choices.filter((a) => a.command.kind === 'provisions.eat' && a.command.data.method !== 'raw');
    const direct = choices.filter(
      (a) => normalized(a.label).includes(requested) || normalized(a.id).includes(requested),
    );
    const matched = direct.length
      ? direct
      : choices.filter(
          (a) =>
            a.command.kind === 'provisions.eat' &&
            requested.endsWith(' ' + a.command.data.method) &&
            normalized(a.label).includes(requested.slice(0, -a.command.data.method.length - 1)),
        );
    const ids = new Set(matched.flatMap((a) => (a.command.kind === 'provisions.eat' ? [a.command.data.itemId] : [])));
    const foods = new Set(
      matched.map((a) => a.label.replace(/^(Prepare and eat|Eat) /, '').replace(/ \([^()]*\)$/, '')),
    );
    if (ids.size > 1 && foods.size > 1) return 'Ambiguous food: use a stable eat:item:method action id';
    // Separate batches of the same food are ordinary after shopping. Use the first feasible
    // batch in the stable catalog order; an explicit action id still selects a particular one.
    const command = matched.find((a) => {
      if (a.command.kind !== 'provisions.eat') return false;
      const id = a.command.data.itemId;
      const stack = o.self.inventory.carried.find((s) => s.id === id);
      return !stack || (stack.servingsLeftPm ?? 0) >= servings * 1000;
    })?.command;
    return command?.kind === 'provisions.eat'
      ? { ...command, data: { ...command.data, servings } }
      : 'No available food/preparation matches';
  }
  if (verb === 'unpack')
    return find(
      o.actions.filter((a) => a.id.startsWith(`${verb}:`)),
      tail,
    );
  if (verb === 'pack') {
    const [item, box] = tail.split(/ into /i);
    return find(
      o.actions.filter((a) => a.id.startsWith('pack:') && normalized(a.label).includes(normalized(box ?? ''))),
      item ?? '',
    );
  }
  const socialVerb =
    verb === 'talk' || verb === 'interact' ? 'chat' : verb === 'ask' && words[0] === 'about' ? 'ask_about' : verb;
  if (o.interactionVerbs.some((d) => d.id === socialVerb)) {
    const targetText = socialVerb === 'ask_about' ? words.slice(1).join(' ') : tail.replace(/^(to|with) /, '');
    const targets = o.present.filter(
      (p) => normalized(p.name).includes(normalized(targetText)) || String(p.id) === targetText,
    );
    if (targets.length !== 1 || !targets[0])
      return targets.length ? 'Ambiguous person; use their full name' : 'That person is not here';
    return {
      kind: 'core.urge',
      actorId: pc,
      data: { urge: { kind: 'interaction', interactionId: socialVerb, targetId: targets[0].id } },
    };
  }
  return find(o.actions, text);
}
export function renderDetail(detail: unknown): string {
  if (detail && typeof detail === 'object' && 'prices' in detail) {
    const stock = (detail as { prices: Observation['store']['stock'] }).prices;
    const groups = new Map<string, { name: string; priceCents: number; qty: number }>();
    for (const row of stock ?? []) {
      const key = `${row.defId}:${row.priceCents}`;
      const entry = groups.get(key);
      if (entry) entry.qty += row.qty;
      else groups.set(key, { ...row });
    }
    return groups.size
      ? [...groups.values()]
          .map((s) => `${s.name}: $${(s.priceCents / 100).toFixed(2)} each; ${s.qty} in stock`)
          .join('\n')
      : 'No goods for sale here.';
  }
  if (detail && typeof detail === 'object' && 'person' in detail) {
    const d = detail as {
      person?: Observation['present'][number];
      opinion?: Observation['self']['social']['opinions'][number];
      base?: Record<string, number>;
      volatile?: Record<string, number>;
      reasons: Array<{ label: string; affection: number; respect: number; trust: number; fear: number }>;
      relationships: Array<{ label: string }>;
      memories: Array<{ summary: string }>;
    };
    if (!d.person) return 'No known person here.';
    return [
      `${d.person.name} — ${d.person.people}; ${d.person.activity}.`,
      `Relationship: ${d.relationships.map((r) => r.label).join(', ') || 'no known tie'}. Your opinion: ${d.opinion ? d.opinion.label || 'Neutral' : 'unfamiliar'}.`,
      ...(['affection', 'respect', 'trust', 'fear'] as const).flatMap((key) =>
        d.opinion
          ? [
              `${key}: ${d.opinion[key]} = base ${d.base?.[key] ?? 0} + reasons ${d.reasons.reduce((n, r) => n + r[key], 0)} + immediate ${d.volatile?.[key] ?? 0} (clamped −100..100)`,
            ]
          : [],
      ),
      ...d.reasons.map(
        (r) => `${r.label}: affection ${r.affection}, respect ${r.respect}, trust ${r.trust}, fear ${r.fear}`,
      ),
      ...d.memories.slice(-3).map((m) => `Remembered: ${m.summary}`),
    ].join('\n');
  }
  if (detail && typeof detail === 'object' && 'item' in detail && 'catalog' in detail) {
    const d = detail as {
      item: Observation['self']['inventory']['carried'][number];
      catalog: import('@coulee/core').ContentBundle['items'][string];
    };
    const f = d.catalog.food;
    return [
      `${d.item.name}: ${d.item.qty} ${d.item.unit}; ${d.item.weightG} g; bulk ${d.item.bulkTenths / 10}.`,
      ...(f
        ? [
            `Per ${d.item.unit} (${f.servings} servings): ${f.kcal} kcal; protein ${f.protein_g} g; fat ${f.fat_g} g; fresh ${f.fresh}/100.`,
            `Remaining: ${(d.item.servingsLeftPm ?? 0) / 1000} servings; spoilage ${d.item.spoilage}/1000.`,
            `Preparation: ${f.prep.map((p) => p.method).join(', ')}.`,
          ]
        : []),
      ...(d.catalog.container
        ? [`Container: ${JSON.stringify(d.catalog.container)}; water ${d.item.waterMl} ml.`]
        : []),
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (detail && typeof detail === 'object' && 'description' in detail && 'name' in detail)
    return `${detail.name}\n${detail.description}`;

  if (detail && typeof detail === 'object' && 'summary' in detail && 'id' in detail) {
    const event = detail as Observation['events'][number];
    return `[${event.id}] ${event.summary}` + (event.explain ? `\n${explainLine(event.explain)}` : '');
  }
  if (detail && typeof detail === 'object' && 'knowledge' in detail && 'terms' in detail)
    return explainLine(detail as Parameters<typeof explainLine>[0]);
  if (Array.isArray(detail) && detail.some((e) => e && typeof e === 'object' && 'signId' in e))
    return detail
      .map(
        (e) =>
          `[${e.signId}] ${e.closedAt === null ? 'Open question' : 'Read sign'}: ${e.text}\n${e.evidence ?? ''}${e.available ? ` — investigate ${e.signId}` : ' — trace faded'}`,
      )
      .join('\n');
  if (Array.isArray(detail))
    return detail.length
      ? detail
          .map((e) => (e && typeof e === 'object' && 'text' in e ? `${e.stamp ?? ''} ${e.text}` : JSON.stringify(e)))
          .join('\n')
      : 'No journal entries known yet.';
  if (detail && typeof detail === 'object' && 'daysOfFoodTenths' in detail && 'warnings' in detail) {
    const r = detail as Observation['self']['provisions']['readiness'] & Observation['self']['inventory'];
    return [
      `Food ${(r.daysOfFoodTenths / 10).toFixed(1)} days; ${r.kcalOnHand} usable kcal / ${r.kcalPerDay} kcal per day.`,
      `Fuel: ${r.daysOfFuelTenths === null ? 'no cooking fuel required by projected meals' : (r.daysOfFuelTenths / 10).toFixed(1) + ' days'}.`,
      `Spoils first: ${r.spoilsFirst ? `${r.spoilsFirst.name} in ${(r.spoilsFirst.inDaysTenths / 10).toFixed(1)} days` : 'none'}.`,
      `Load: ${r.totalWeightG} g; bulk ${(r.totalBulkTenths / 10).toFixed(1)}; ${r.loadBand}.`,
      ...r.warnings,
      ...r.carried.map((i) => `${i.qty} × ${i.name} (#${i.id})${i.containerId ? ' in #' + i.containerId : ''}`),
    ].join('\n');
  }
  return JSON.stringify(detail, null, 2);
}
