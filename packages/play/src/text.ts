import { type Command, explainLine } from '@coulee/core';
import type { AvailableAction } from './actions.ts';
import type { Observation } from './observation.ts';
export const HELP = `One action = one game-hour; queries take no time. Sleep locks 4 hours.
Eat defaults to ONE serving; use eat hardtack 2 for two. Need effects use the previous hour's activity.
look | actions [page] | go <place name/id> | talk <person> | <interaction> <person>
buy <item> [qty] | sell <item> | eat <item> [servings] [method] | cook <item> [servings] [method]
drink | meal | sleep | rest | work | wait <Nh|Nd> | wait until <HH:00|event.kind>
inspect <actor/item/place> | pack <item> into <container> | unpack <item>
rations <10..150> | plan | journal | explain <event id>
Enter a menu number or stable action id. save <file> | load <file> | fork | help | quit`;
export function menuActions(o: Observation, page = 0): AvailableAction[] {
  if (page > 0) return o.actions.slice((page - 1) * 20, page * 20);
  const basic = [
    'look',
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
    ...o.actions.filter((a) => a.id.startsWith('go:') && /tavern|outfit|store|ford/i.test(a.label)).slice(0, 4),
    ...o.actions.filter((a) => a.id.startsWith('talk:introduce:') || a.id.startsWith('talk:chat:')).slice(0, 2),
    ...o.actions.filter((a) => a.id.startsWith('eat:')).slice(0, 2),
  ];
}
export function renderObservation(o: Observation, page = 0): string {
  const r = o.self.provisions.readiness;
  const lines = [
    `${o.time.stamp} | ${o.mode.toUpperCase()} | ${o.place.name}`,
    `${o.self.name} — ${o.self.activity.verb}. Purse $${(o.self.provisions.purseCents / 100).toFixed(2)}. ${o.weather.temperatureF}°F, ${o.weather.description.toLowerCase()}.`,
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
    `Here: ${
      o.present
        .slice(0, 6)
        .map((a) => `${a.name} (#${a.id})`)
        .join(', ') || 'no one else'
    }${o.present.length > 6 ? `; ${o.present.length - 6} more (inspect by name)` : ''}.`,
    ...['Appetite', 'Conscience'].flatMap((voice) => {
      const t = o.self.mind.thoughts.find((t) => t.voice === voice);
      return t ? [`${voice}: ${t.line ?? t.label}`] : [];
    }),
    ...(o.self.mind.chosen?.voice === 'Self-Command'
      ? [`Self-Command: ${o.self.mind.verdict?.label ?? o.self.mind.chosen.urge}`]
      : []),
    ...o.self.belief.beliefs.slice(-2).map((b) => `Heard: ${b.text}`),
    ...o.events.slice(-2).map((e) => `[${e.id}] ${e.summary}${e.explain ? ' — explain ' + e.id : ''}`),
    // What was said this hour, in the speakers' words (social talk lines).
    ...(o.said ?? []).flatMap((e) => (e.lines ?? []).map((l) => `  ${l.speaker}: “${l.text}”`)),
    ...r.warnings.slice(0, 2).map((w) => `Kit: ${w}`),
    ...menuActions(o, page).map((a, i) => `${i + 1}. ${a.label} [${a.id}]`),
    `Actions ${o.actions.length}; “actions 1” for full menu pages; “help” for verbs.`,
  ];
  return lines.join('\n');
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
  if (/^\d+$/.test(text)) return menuActions(o, page)[Number(text) - 1]?.command ?? 'No such menu number';
  if (verb === 'help') return HELP;
  if (['look', 'journal', 'plan'].includes(verb))
    return { kind: 'activity.observe', actorId: pc, data: { query: verb as 'look' | 'journal' | 'plan' } };
  if (verb === 'explain') return { kind: 'activity.observe', actorId: pc, data: { query: 'explain', target: tail } };
  if (verb === 'inspect')
    return find(
      o.actions.filter((a) => a.id.startsWith('inspect:')),
      tail,
    );
  if (verb === 'go')
    return find(
      o.actions.filter((a) => a.id.startsWith('go:')),
      tail,
    );
  if (verb === 'wait') {
    if (words[0] === 'until') {
      const value = words.slice(1).join(' '),
        match = /^(\d{1,2}):00$/.exec(value);
      if (match) {
        const hour = Number(match[1]);
        if (hour > 23) return 'Hour must be 0–23';
        let time = Math.floor(o.time.t / 1440) * 1440 + hour * 60;
        if (time <= o.time.t) time += 1440;
        return { kind: 'activity.wait', actorId: pc, data: { minutes: 1440, untilTime: time } };
      }
      return { kind: 'activity.wait', actorId: pc, data: { minutes: 1440, untilEvent: value } };
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
  if (verb === 'buy') {
    const last = words.at(-1),
      qty = last && /^\d+$/.test(last) ? Number(words.pop()) : 1;
    const found = find(
      o.actions.filter((a) => a.id.startsWith('buy:')),
      words.join(' '),
    );
    return typeof found === 'string'
      ? found
      : found.kind === 'provisions.buy'
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
  if (verb === 'sell' || verb === 'unpack')
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
  if (verb === 'talk' || verb === 'interact')
    return find(
      o.actions.filter((a) => a.id.startsWith('talk:chat:')),
      tail.replace(/^(to|with) /, ''),
    );
  if (verb === 'ask' && words[0] === 'about')
    return find(
      o.actions.filter((a) => a.id.startsWith('talk:ask_about:')),
      words.slice(1).join(' '),
    );
  const social = o.actions.filter((a) => a.id.startsWith(`talk:${verb}:`));
  if (social.length) return find(social, tail);
  return find(o.actions, text);
}
export function renderDetail(detail: unknown): string {
  if (detail && typeof detail === 'object' && 'summary' in detail && 'id' in detail) {
    const event = detail as Observation['events'][number];
    return `[${event.id}] ${event.summary}` + (event.explain ? `\n${explainLine(event.explain)}` : '');
  }
  if (detail && typeof detail === 'object' && 'knowledge' in detail && 'terms' in detail)
    return explainLine(detail as Parameters<typeof explainLine>[0]);
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
