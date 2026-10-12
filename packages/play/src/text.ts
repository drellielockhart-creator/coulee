import { asActorId, type Command, explainLine, timeView } from '@coulee/core';
import type { AvailableAction } from './actions.ts';
import { obligationText } from './obligations.ts';
import type { Observation } from './observation.ts';
export const HELP = `One action = one game-hour; queries take no time. Sleep keeps you in bed at least 4 hours (8 when you camp); wait to sleep on.
Eat defaults to ONE serving; use eat hardtack 2 for two. Need effects use the previous hour's activity.
Out on open ground with bedding, sleep makes camp where you stand; wait follows your lodging order, returning to a nearby paid or own bed when available.
look | signs | investigate <sign id> | actions [page] | go <place name/id> | talk <person> | <interaction> <person>
buy <item> [qty] | sell <item> [qty] | eat <item> [servings] [method] | cook <item> [servings] [method]
drink | meal | sleep | rest | work | wait <Nh|Nd> | wait until <HH:00|dawn|morning|noon|dusk|night|tomorrow>
prices | places [page] | standing <sleep|eat|drink|warmth|lodging> <on|off> | agency <commanded|psyche>
inspect <person/item/place> | pack <item> into <container> (moves one) | unpack <item>
aid <person> | retire | depart | rations <10..150> | plan | journal (lists what you owe) | explain <event id>
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
/** A held urge as the verb the player would type: "sleep", "take a meal", "repay Michael Dunleavy". */
function orderHint(o: Observation, urge: string): string {
  if (urge === 'activity:sleep') return 'sleep';
  const activity = /^activity:(.+)$/.exec(urge);
  if (activity?.[1]) {
    const label = o.actions.find((a) => a.id === urge)?.label;
    return label ? label.charAt(0).toLowerCase() + label.slice(1) : activity[1].replaceAll('_', ' ');
  }
  return urge
    .replace(/^interaction:/, '')
    .replace(/->(\d+)/, (_, id) => ' ' + (o.knownPeople.find((p) => p.id === Number(id))?.name ?? '#' + id));
}
/** What the character is doing, in a phrase: on the road with the minutes left, or the activity's verb. */
function doing(o: Observation): string {
  const a = o.self.activity;
  if (a.travelingTo !== null && a.arriveAt !== null) {
    const left = Math.max(1, a.arriveAt - o.time.t);
    const to = o.places.find((p) => p.id === a.travelingTo)?.name ?? 'your destination';
    return `on the road to ${to}, about ${left} min more`;
  }
  // "At home, at leisure" is only true at her lodgings.
  if (a.activityId === 'idle_at_home' && o.self.lodging && o.place.id !== o.self.lodging.placeId) return 'at leisure';
  return a.verb;
}
export function renderObservation(o: Observation, page = 0, previous?: Observation): string {
  if (o.ending)
    return `This life has ended: ${o.ending.type} — ${o.ending.cause}.
Only reading remains.

${o.epilogue ?? ''}`;
  const r = o.self.provisions.readiness;
  const cash = (n: number) => `${n < 0 ? '−' : '+'}$${(Math.abs(n) / 100).toFixed(2)}`;
  const changes = o.changes;
  const lines = [
    `Since last look: ${changes.elapsed ? `${changes.elapsed / 60}h passed` : 'no time passed'}${changes.needs.length ? '; ' + changes.needs.join('; ') : ''}.`,
    ...changes.money.map((m) => `Money: purse ${cash(m.purse)}, household ${cash(m.household)} — ${m.reason}`),
    ...(changes.skipped
      ? [`Skipped ${changes.skipped} minor conversation${changes.skipped === 1 ? '' : 's'} nearby.`]
      : []),
    ...changes.events.slice(-3),
    `${o.time.stamp} | ${o.mode.toUpperCase()} | ${o.place.name}`,
    `${o.self.name} — ${doing(o)}. Purse $${(o.self.provisions.purseCents / 100).toFixed(2)}; household $${(o.self.provisions.householdCents / 100).toFixed(2)}. ${o.weather.temperatureF}°F, ${o.weather.description.toLowerCase()}.`,
    `Food ${(r.daysOfFoodTenths / 10).toFixed(1)} days; ${o.self.inventory.loadBand}, ${(o.self.inventory.totalWeightG / 1000).toFixed(1)} kg.`,
    `Vitals: ${o.self.needs.list
      .filter((n) => n.kind === 'physical' && (n.id !== 'drink' || n.band))
      .map((n) => `${n.name} ${n.value}${n.band ? ` (${n.band})` : ''}`)
      .join('; ')}`,
    ...(o.self.needs.survival
      ? [
          `Health: Vigor ${o.self.needs.survival.vigor}/${o.self.needs.survival.maxVigor}; Wounds ${o.self.needs.survival.wounds}/${o.self.needs.survival.woundLimit}. ${o.self.needs.survival.conditions.join(', ')}`.trimEnd(),
        ]
      : []),
    ...(o.self.needs.warnings ?? []),
    ...(o.store.hours
      ? [`Counter ${o.store.open ? 'open' : 'closed'}; hours ${o.store.hours.opens}:00–${o.store.hours.closes}:00.`]
      : []),
    ...(o.store.bedCents !== undefined
      ? [
          `Board: bed $${(o.store.bedCents / 100).toFixed(2)} until noon; meal $${((o.store.mealCents ?? 0) / 100).toFixed(2)} (type meal).`,
        ]
      : []),
    o.place.description,
    ...o.remains.map((r) => `${r.buried ? 'Grave' : 'Body'}: ${r.name}.`),
    ...o.requests.map(
      (r) =>
        `Pending ${r.response === 'borrow' ? 'loan offer (you would borrow)' : r.response === 'lend' || !r.response ? 'loan request (you would lend)' : r.response === 'proposal' ? 'proposal' : r.response === 'disclose' ? 'information request' : 'favor with an obligation'}: answer:${r.id}:yes or answer:${r.id}:no (expires within the hour)`,
    ),
    ...o.signs
      .filter((q) => q.closedAt === null)
      .slice(-2)
      .map((q) => `Open sign: ${q.text} (investigate ${q.signId})`),
    `Here: ${
      o.present
        .slice(0, 6)
        .map((a) => `${a.name} (#${a.id}${/sleep/i.test(a.activity) ? ', asleep' : ''})`)
        .join(', ') || 'no one else'
    }${o.present.length > 6 ? `; ${o.present.length - 6} more (inspect by name)` : ''}.`,
    ...(o.self.activity.asleep ? [] : ['Appetite', 'Conscience']).flatMap((voice) => {
      const t = [...o.self.mind.thoughts]
        .filter(
          (t) =>
            t.voice === voice &&
            !(!o.place.fireLit && t.urge === 'activity:cook') &&
            t.stance !== 'against' &&
            (o.self.agencyMode !== 'commanded' || t.urge !== o.self.mind.chosen?.urge),
        )
        .sort((a, b) => b.intensity - a.intensity || a.id - b.id)[0];
      return t
        ? [
            `${voice}: ${t.line ?? t.label}${
              !o.self.needs.survival?.collapsed &&
              o.self.agencyMode === 'commanded' &&
              t.urge !== o.self.mind.chosen?.urge
                ? ` (held for your order; you may: ${orderHint(o, t.urge)})`
                : ''
            }`,
          ]
        : [];
    }),
    ...(o.self.mind.chosen?.voice === 'Self-Command'
      ? [
          `Self-Command: ${o.self.mind.verdict?.label ?? o.self.mind.chosen.urge}${
            o.self.mind.verdictEventId === undefined ? '' : ` — explain ${o.self.mind.verdictEventId}`
          }`,
        ]
      : []),
    // What she has been told shows when it happens (as an event); a look lists what she holds.
    ...(changes.elapsed === 0 ? o.self.belief.beliefs.slice(-2).map((b) => `Heard: ${b.text}`) : []),
    ...o.self.obligations.filter((d) => d.overdue || d.daysLeft <= 7).map((d) => obligationText(d)),
    ...freshEvents(o, previous).map((e) => `[${e.id}] ${e.summary}${e.explain ? ' — explain ' + e.id : ''}`),
    // What was said this hour, in the speakers' words (social talk lines). Her own exchange comes
    // first; an act whose words were not worth composing still says so rather than vanishing.
    ...(o.said ?? []).flatMap((e) =>
      e.lines?.length
        ? e.lines.map((l) => `  ${l.speaker}: “${l.text}”`)
        : e.speakerId === o.self.id
          ? ['  Nothing worth repeating is said.']
          : [],
    ),
    ...(changes.elapsed === 0 ? r.warnings.slice(0, 2).map((w) => `Kit: ${w}`) : []),
    ...menuActions(o, page).map((a, i) => `${i + 1}. ${a.label} [${a.id}]`),
    `Actions ${o.actions.length}; “actions 1” for full menu pages; “places 1” for destinations; “help” for verbs.`,
  ];
  if (!previous) return lines.filter(Boolean).join('\n');
  const oldLines = new Set(renderObservation(previous, page).split('\n'));
  return lines
    .filter((line) => line && (!oldLines.has(line) || line.startsWith('Since last look:') || line.startsWith('Money:')))
    .join('\n');
}
/** The few events worth a line this turn: not routine bookkeeping, not already said above. */
function freshEvents(o: Observation, previous?: Observation) {
  const since = o.time.t - Math.max(60, o.changes.elapsed);
  return o.events
    .filter(
      (e) =>
        !e.routine &&
        e.t >= since &&
        !previous?.events.some((p) => p.id === e.id) &&
        !o.changes.events.includes(e.summary) &&
        !(o.changes.skipped > 0 && e.kind === 'social.interaction'),
    )
    .slice(-3);
}
/**
 * Lines about interrupts: a wait cut short says when it stopped and for what it was meant (the
 * cause itself is in the lines below); an alert with no event behind it is simply stated.
 */
export function renderInterrupts(result: {
  interrupts: Array<{ reason: string; eventId?: number }>;
  stopped?: { at: number; wanted: number | null; reasons: string[] };
  observation: { changes: { events: string[] } };
}): string[] {
  const stamp = (t: number) => timeView(t).stamp;
  const lines: string[] = [];
  if (result.stopped) {
    const { at, wanted, reasons } = result.stopped;
    const when =
      wanted === null
        ? ''
        : ` (you meant to wait until ${wanted - at > 1380 ? stamp(wanted).slice(5) : stamp(wanted).slice(-5)})`;
    const unsaid = reasons.filter((r) => !result.observation.changes.events.includes(r));
    lines.push(`Wait stopped at ${stamp(at).slice(-5)}${when}${unsaid.length ? `: ${unsaid.join('; ')}` : ''}.`);
  }
  for (const i of result.interrupts) if (i.eventId === undefined && !result.stopped) lines.push(`${i.reason}.`);
  return lines;
}
const normalized = (s: string) => s.trim().toLowerCase().replaceAll('_', ' ');
export function parseText(line: string, o: Observation, page = 0): Command | string {
  const text = line.trim(),
    words = text.split(/\s+/),
    verb = words.shift()?.toLowerCase() ?? '',
    tail = words.join(' ');
  const choose = (matches: AvailableAction[], query: string): Command | string => {
    if (matches.length === 1 && matches[0]) return matches[0].command;
    if (!matches.length) return `Nothing here matches “${query.trim()}”; try look, prices, places or actions`;
    // Say what each candidate is (names and prices), then the id that picks one exactly.
    const shown = matches.slice(0, 8).map((a) => `${a.label} [${a.id}]`);
    return `Which one? ${shown.join('; ')}${matches.length > 8 ? `; and ${matches.length - 8} more` : ''}`;
  };
  const find = (actions: AvailableAction[], query: string): Command | string => {
    const q = normalized(query);
    const exact = actions.filter((a) => normalized(a.id) === q || normalized(a.label) === q);
    return choose(
      exact.length ? exact : actions.filter((a) => normalized(a.label).includes(q) || normalized(a.id).includes(q)),
      query,
    );
  };
  const pc = o.self.id;
  const action = o.actions.find((a) => a.id === text);
  if (action) return action.command;
  // A stable social id that is not on offer now still goes to the game, which says exactly why not.
  const talk = /^talk:([a-z_]+):(\d+)$/.exec(text);
  if (talk?.[1] && o.interactionVerbs.some((d) => d.id === talk[1]))
    return {
      kind: 'core.urge',
      actorId: pc,
      data: { urge: { kind: 'interaction', interactionId: talk[1], targetId: asActorId(Number(talk[2])) } },
    };
  if (/^[+-]?\d+$/.test(text)) return menuActions(o, page)[Number(text) - 1]?.command ?? 'No such menu number';
  if (verb === 'signs') return { kind: 'fae.signs', actorId: pc, data: {} };
  if (verb === 'investigate') return { kind: 'fae.investigate', actorId: pc, data: { signId: tail } };
  if (verb === 'help') return HELP;
  const reading = ['look', 'plan', 'journal', 'explain', 'inspect', 'prices'].includes(verb);
  if (o.ending && !reading) return 'This life has ended; only reading remains';
  if (o.self.needs.survival?.collapsed && !reading && verb !== 'wait') return 'You have collapsed and need help';
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
  if (verb === 'inspect') {
    const found = find(
      o.actions.filter((a) => a.id.startsWith('inspect:')),
      tail,
    );
    return typeof found === 'string' && found.startsWith('Nothing here matches')
      ? `You cannot inspect “${tail}”: it is not here, in your pack, or someone you know. Try look, plan or places`
      : found;
  }
  if (verb === 'aid')
    return find(
      o.actions.filter((a) => a.id.startsWith('aid:')),
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
  if ((verb === 'buy' || verb === 'sell') && !words.length)
    return verb === 'buy'
      ? 'Buy what? Type prices to see what is for sale, then buy <item> [qty]'
      : 'Sell what? Type plan to see what you carry, then sell <item> [qty]';
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
    // "Pack <item> into <container>": the item is what comes before "into", the container after.
    const [item, box] = tail.split(/ into /i);
    if (!item || !box) return 'Use pack <item> into <container>';
    const [wantItem, wantBox] = [normalized(item), normalized(box)];
    const matched = o.actions.filter((a) => {
      if (!a.id.startsWith('pack:')) return false;
      const parts = /^Pack (.+) into (.+)$/.exec(a.label);
      return !!parts && normalized(parts[1] ?? '').includes(wantItem) && normalized(parts[2] ?? '').includes(wantBox);
    });
    return choose(matched, `${item} into ${box}`);
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
