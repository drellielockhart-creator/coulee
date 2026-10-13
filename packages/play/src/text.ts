import { asActorId, asItemId, type Command, explainLine, TICKS_PER_SECOND, timeView } from '@coulee/core';
import type { AvailableAction } from './actions.ts';
import { claimText, obligationText } from './obligations.ts';
import type { Observation } from './observation.ts';
export const HELP = `One action = one game-hour; queries take no time, nor do settings (standing, agency, rations). Sleep keeps you in bed at least 4 hours (8 when you camp); wait to sleep on, or give any order (wake, drink, go) to get up.
Eat defaults to ONE serving; use eat hardtack 2 for two. Need effects use the previous hour's activity.
Out on open ground with bedding, sleep makes camp where you stand; wait follows your lodging order, returning to a nearby paid or own bed when available.
look | signs | investigate <sign id> | actions [page] | go <place name/id> | talk <person> | <interaction> <person>
hire <employer> [daily|weekly] | quit | dismiss <worker>
buy <item> [qty] | sell <item> [qty] | eat <item> [servings] [method] | cook <item> [servings] [method]
drink | fill <canteen/kettle> | empty <canteen/kettle> | fetch water | meal | sleep | wake | rest | work | wait <Nh|Nd> | wait until <HH:00|dawn|morning|noon|dusk|night|tomorrow>
Springs, creeks, rivers and fords are water: drink raw there and fill your vessels (a litre weighs a kilo: a fill stops where you could no longer walk, and empty pours a vessel out); fetch water walks to the nearest.
prices [page|word] | places [page] | standing [<sleep|eat|drink|warmth|lodging> <on|off>] | agency [commanded|psyche]
inspect <person/item/place/me> | pack <item> into <container> (moves one) | unpack <item>
yes | no (answer what you were asked) | aid <person> | rations [10..150] | plan | journal (lists what you owe) | explain <event id>
retire confirm | depart confirm (each ends this life) | Enter a menu number or stable action id. save <file> | load <file> | fork | help | quit`;
export const SESSION_HELP = HELP.replace('save <file> | load <file> | fork | help | quit', 'help');

/** The nearest destinations shown on the first menu page (playtest r2: only 3-4 hubs were). */
const NEAREST = 8;

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
    // What needs her answer, and anyone here who needs help, come first.
    ...o.actions.filter((a) => a.id.startsWith('answer:')),
    ...o.actions.filter((a) => a.id.startsWith('aid:')),
    ...o.actions.filter((a) => a.id.startsWith('tactical:')),
    ...o.actions.filter((a) => /^(route:|travel:|journey:)/.test(a.id)),
    ...basic.flatMap((id) => o.actions.find((a) => a.id === id) ?? []),
    // Destinations are offered nearest first, with their minutes on foot.
    ...o.actions.filter((a) => a.id.startsWith('go:')).slice(0, NEAREST),
    ...o.actions.filter((a) => a.id.startsWith('talk:introduce:') || a.id.startsWith('talk:chat:')).slice(0, 2),
    ...o.actions.filter((a) => a.id.startsWith('eat:')).slice(0, 2),
  ];
}
/** A held urge as the verb the player would type: "sleep", "take a meal", "repay Michael Dunleavy". */
function orderHint(o: Observation, urge: string): string {
  if (!urge) return '';
  if (urge === 'activity:fetch_water' && o.region?.location.kind === 'edge')
    return o.actions.some((a) => a.id === 'drink') ? 'drink' : '';
  if (urge === 'activity:sleep') return 'sleep';
  const activity = /^activity:(.+)$/.exec(urge);
  if (activity?.[1]) {
    const label = o.actions.find((a) => a.id === urge)?.label;
    return label ? label.charAt(0).toLowerCase() + label.slice(1) : activity[1].replaceAll('_', ' ');
  }
  if (!/^interaction:/.test(urge)) return '';
  return urge
    .replace(/^interaction:/, '')
    .replace(/->(\d+)/, (_, id) => ' ' + (o.knownPeople.find((p) => p.id === Number(id))?.name ?? '#' + id));
}
/** The person a thought is about, by its urge, when its line does not already name them. */
function thoughtObject(o: Observation, urge: string, line: string): string {
  const id = /->(\d+)/.exec(urge)?.[1];
  const name = id === undefined ? undefined : o.knownPeople.find((p) => p.id === Number(id))?.name;
  return name && !line.includes(name) && !line.includes(name.split(' ')[0] ?? name) ? ` (about ${name})` : '';
}
/** What the character is doing, in a phrase: on the road with the minutes left, or the activity's verb. */
function doing(o: Observation): string {
  const a = o.self.activity;
  if (o.region?.location.kind === 'edge') {
    const loc = o.region.location;
    return `${loc.status} on ${loc.name}, ${loc.feet} feet from this leg's entrance; only carried supplies are at hand`;
  }
  if (a.travelingTo !== null && a.arriveAt !== null) {
    const left = Math.max(1, a.arriveAt - o.time.t);
    const to = o.places.find((p) => p.id === a.travelingTo)?.name ?? 'your destination';
    return `on the road to ${to}, about ${left} min more`;
  }
  // "At home, at leisure" is only true at her lodgings.
  if (a.activityId === 'idle_at_home' && o.self.lodging && o.place.id !== o.self.lodging.placeId) return 'at leisure';
  return a.verb;
}
/** "(#12, working)": what the Here list says of someone present. */
function presentTags(a: Observation['present'][number]): string {
  const tags = [
    `#${a.id}`,
    ...((a.asleep ?? /sleep/i.test(a.activity)) ? ['asleep'] : []),
    ...(a.working ? ['working'] : []),
    ...(a.child ? ['child'] : []),
  ];
  return `(${tags.join(', ')})`;
}
/** One line for a reply that took no time (playtest r2: phone-size output). */
export function renderBrief(o: Observation): string {
  if (o.tactical) return o.tactical.timeline;
  return `No time passed (${o.time.stamp}, ${o.place.name}).`;
}
/** The standing orders, agency and rations as they stand, with how to change them. */
export function settingsText(o: Observation): string {
  const s = o.self.standingOrders;
  const orders = (['sleep', 'eat', 'drink', 'warmth', 'lodging'] as const)
    .map((k) => `${k} ${s[k] ? 'on' : 'off'}`)
    .join(', ');
  const agency =
    o.self.agencyMode === 'commanded'
      ? 'commanded (only your orders and the standing orders move you)'
      : 'psyche (your character follows her own wants between your orders)';
  return [
    `Standing orders: ${orders}.`,
    `Agency: ${agency}.`,
    `Rations: ${o.self.rationPct ?? 100}%.`,
    'Change with standing <sleep|eat|drink|warmth|lodging> <on|off>, agency <commanded|psyche> or rations <10..150>. Settings take no game time.',
  ].join('\n');
}
/** Retiring or departing ends the life: a typed confirmation, never a stray menu number (playtest r2). */
export function confirmEnding(command: Command, text: string): string | null {
  if (command.kind !== 'needs.retire' && command.kind !== 'needs.depart') return null;
  if (/\b(confirm|yes)\b/i.test(text)) return null;
  const word = command.kind === 'needs.retire' ? 'retire' : 'depart';
  return `${word === 'retire' ? 'Retiring settles your character down for good' : 'Departing takes your character out of this country for good'}: the story ends and only reading remains. Type “${word} confirm” if you mean it`;
}
/** Text for a reading verb with no argument (help, standing, agency, rations), or null. */
export function infoFor(line: string, o: Observation): string | null {
  const [verb, ...rest] = line.trim().split(/\s+/);
  if (rest.length) return null;
  const v = verb?.toLowerCase() ?? '';
  if (v === 'help') return SESSION_HELP;
  if (v === 'standing' || v === 'agency' || v === 'rations') return settingsText(o);
  return null;
}
export function renderObservation(o: Observation, page = 0, previous?: Observation): string {
  if (o.ending)
    return `This life has ended: ${o.ending.type} — ${o.ending.cause}.
Only reading remains.

${o.epilogue ?? ''}`;
  const r = o.self.provisions.readiness;
  const cash = (n: number) => `${n < 0 ? '−' : '+'}$${(Math.abs(n) / 100).toFixed(2)}`;
  const changes = o.changes;
  const addressed = changes.addressed ?? [];
  const lines = [
    `Since last look: ${changes.elapsedTicks ? `${changes.elapsedTicks / TICKS_PER_SECOND}s passed` : changes.elapsed ? `${changes.elapsed / 60}h passed` : 'no time passed'}${changes.needs.length ? '; ' + changes.needs.join('; ') : ''}.`,
    ...changes.money.map((m) => `Money: purse ${cash(m.purse)}, household ${cash(m.household)} — ${m.reason}`),
    ...(changes.skipped
      ? [`Skipped ${changes.skipped} minor conversation${changes.skipped === 1 ? '' : 's'} nearby.`]
      : []),
    // What was said or done to her that asked nothing of her: the digest, not a stop.
    ...(addressed.length
      ? [
          `To you: ${addressed.slice(-3).join('; ')}${addressed.length > 3 ? `; and ${addressed.length - 3} more (journal)` : ''}.`,
        ]
      : []),
    // A request is said once, below, with how to answer it.
    ...changes.events.filter((e) => !o.requests.some((r) => r.text && e.startsWith(askOf(r.text)))).slice(-3),
    ...(o.tactical ? [o.tactical.timeline] : []),
    `${o.time.stamp} | ${o.mode.toUpperCase()} | ${o.place.name}`,
    `${o.self.name} — ${doing(o)}. Purse $${(o.self.provisions.purseCents / 100).toFixed(2)}; household $${(o.self.provisions.householdCents / 100).toFixed(2)}. ${o.weather.temperatureF}°F, ${o.weather.description.toLowerCase()}.`,
    ...(o.self.provisions.employment ? [employmentText(o.self.provisions.employment)] : []),
    `Food ${(r.daysOfFoodTenths / 10).toFixed(1)} days${pantryNote(o)}; ${o.self.inventory.loadBand}, ${(o.self.inventory.totalWeightG / 1000).toFixed(1)} kg.`,
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
      ? [
          `Counter ${o.store.open ? 'open' : 'closed'}; hours ${o.store.hours.opens}:00–${o.store.hours.closes}:00.${o.store.freight ? ` ${freightLine(o.store.freight)}` : ''}`,
        ]
      : []),
    ...(o.store.bedCents !== undefined
      ? [
          `Board: bed $${(o.store.bedCents / 100).toFixed(2)} until noon; meal $${((o.store.mealCents ?? 0) / 100).toFixed(2)} (type meal).`,
        ]
      : []),
    o.place.description,
    ...o.remains.map((r) => `${r.buried ? 'Grave' : 'Body'}: ${r.name}.`),
    // What is asked of her, in full: what a yes undertakes (playtest r2: "a favor with an obligation").
    ...o.requests.map((r) => {
      const who = o.knownPeople.find((p) => p.id === r.from)?.name.split(' ')[0] ?? `#${r.from}`;
      const how = o.requests.length > 1 ? `yes ${who} or no ${who}` : 'yes or no';
      return `Asked of you: ${r.text ? askOf(r.text) : `a request from ${who}.`} Answer now (${how}); silence lets it lapse this hour.`;
    }),
    ...o.charms.map(
      (k) =>
        `Charm: ${k.name} (#${k.itemId}) ${k.relation === 'known' ? '' : `[${k.relation}] `}${k.status}${k.heard.length ? ` Said: it ${k.heard[k.heard.length - 1]?.replace(/^it /, '')}.` : ''}`,
    ),
    ...o.signs
      .filter((q) => q.closedAt === null && q.available)
      .slice(-2)
      .map((q) => `Open sign: ${q.text} (investigate ${q.signId})`),
    `Here: ${
      o.present
        .slice(0, 6)
        .map((a) => `${a.name} ${presentTags(a)}`)
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
      if (!t) return [];
      const line = t.line ?? t.label;
      const hint = orderHint(o, t.urge);
      const held =
        !o.self.needs.survival?.collapsed && o.self.agencyMode === 'commanded' && t.urge !== o.self.mind.chosen?.urge;
      // Never a blank "(you may: )": a feeling with nothing to order is just said.
      return [
        `${voice}: ${line}${thoughtObject(o, t.urge, line)}${held && hint ? ` (held for your order; you may: ${hint})` : ''}`,
      ];
    }),
    // The verdict on her own order says nothing new; the psyche's own choices are shown.
    ...(o.self.mind.chosen?.voice === 'Self-Command' && o.self.mind.verdict?.mode !== 'command'
      ? [
          `Self-Command: ${(o.self.mind.verdict?.label ?? o.self.mind.chosen.urge).replace(/^Resolved: /, '')}${
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
/** A request's ask and terms, without its closing "answer within the hour". */
function askOf(text: string): string {
  return text.replace(/ Answer yes or no within the hour; silence means no\.?$/, '');
}
const WEEKDAYS: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};
/** "Freight due Wednesday (in 2 days; every 3 days); sold out until then: Cornmeal, Pemmican." */
function freightLine(f: NonNullable<Observation['store']['freight']>): string {
  const when = f.inDays === 1 ? 'tomorrow' : `${WEEKDAYS[f.weekday] ?? f.weekday} (in ${f.inDays} days)`;
  return `Freight due ${when}, every ${f.everyDays} days${f.deliveryPct < 100 ? `, a ${f.deliveryPct}% load while the river is closed` : ''}${f.awaited.length ? `; sold out until then: ${f.awaited.slice(0, 6).join(', ')}${f.awaited.length > 6 ? ` and ${f.awaited.length - 6} more` : ''}` : ''}.`;
}
/** `drink` was not on offer: say exactly why (asleep, vessels empty, no source here) and where water is. */
function drinkRefusal(o: Observation): string {
  const vessels = o.self.inventory.carried.filter((s) => (s.liquidMl ?? 0) > 0);
  const water = vessels.reduce((n, s) => n + (s.waterMl ?? 0), 0);
  const fetch = o.actions.find((a) => a.id === 'activity:fetch_water');
  const near = fetch ? /^Fetch water at (.+?) \((\d+) min on foot/.exec(fetch.label) : null;
  const where = near
    ? `. The nearest water is ${near[1]}, ${near[2]} min on foot: fetch water (or go there) to drink and fill`
    : '';
  const what = !vessels.length
    ? 'You carry no water vessel'
    : water === 0
      ? `Your ${vessels.map((v) => v.name.split(',')[0]?.toLowerCase()).join(' and ')} ${vessels.length > 1 ? 'are' : 'is'} empty`
      : `You carry ${water} ml but cannot drink just now`;
  return `${what}, and there is no spring, creek or ford here${where}`;
}
/** Household purchases go to the pantry at her lodgings: the status line says how much is there. */
function pantryNote(o: Observation): string {
  const p = o.self.pantry;
  if (!p) return '';
  const days = (p.daysOfFoodTenths / 10).toFixed(1);
  return p.withPack
    ? ` in your pack, ${days} with the pantry here`
    : ` in your pack; ${days} more in the pantry at ${p.placeName}`;
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
        !(o.changes.addressed ?? []).includes(e.summary) &&
        !(o.changes.skipped > 0 && e.kind === 'social.interaction' && e.speakerId !== o.self.id),
    )
    .slice(-3);
}
/** "17:00 on Thursday the 5th": a moment with its day, so a stop never reads as an overshoot. */
function moment(t: number): string {
  const v = timeView(t);
  const day = v.dateText.replace(/^(\w+), the (\w+) of .*$/, '$1 the $2');
  return `${v.stamp.slice(-5)} on ${day}`;
}
const unstop = (s: string) => s.replace(/[.\s]+$/, '');
/**
 * Lines about interrupts: a wait cut short says when it stopped (with the day), what it was meant
 * for, and why. `allReasons` repeats a reason the observation also lists (the headless REPL, whose
 * compact output may drop an unchanged line); the web shows the cause in its own digest.
 */
export function renderInterrupts(
  result: {
    interrupts: Array<{ reason: string; eventId?: number }>;
    stopped?: { at: number; wanted: number | null; reasons: string[] };
    observation: { changes: { events: string[] } };
  },
  opts: { allReasons?: boolean } = {},
): string[] {
  const lines: string[] = [];
  if (result.stopped) {
    const { at, wanted, reasons } = result.stopped;
    const when = wanted === null ? '' : ` (you meant to wait until ${moment(wanted)})`;
    const shown = (
      opts.allReasons ? reasons : reasons.filter((r) => !result.observation.changes.events.includes(r))
    ).map(unstop);
    lines.push(`Wait stopped at ${moment(at)}${when}${shown.length ? `: ${shown.join('; ')}` : ''}.`);
  }
  for (const i of result.interrupts) if (i.eventId === undefined && !result.stopped) lines.push(`${unstop(i.reason)}.`);
  return lines;
}
const normalized = (s: string) => s.trim().toLowerCase().replaceAll('_', ' ');
export function parseText(line: string, o: Observation, page = 0): Command | string {
  if (o.tactical) {
    const phrase = line.trim().toLowerCase();
    const id =
      phrase === 'resume'
        ? 'tactical:resume'
        : ['guard', 'cancel', 'breathe'].includes(phrase)
          ? `tactical:${phrase}`
          : /^(step|move) (north|south|east|west)$/.test(phrase)
            ? `tactical:move:${phrase.split(' ')[1]}`
            : '';
    const action = o.actions.find((a) => a.id === id);
    if (action) return action.command;
  }
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
  if (verb === 'route' || verb === 'travel')
    return find(
      o.actions.filter((a) => a.id.startsWith(`${verb}:`)),
      tail,
    );
  if (verb === 'stop' || verb === 'resume' || verb === 'camp' || text === 'turn back') {
    const id = `journey:${text === 'turn back' ? 'turn_back' : verb}`;
    const offered = o.actions.find((a) => a.id === id);
    if (offered) return offered.command;
  }
  const action = o.actions.find((a) => a.id === text);
  if (action) return confirmEnding(action.command, text) ?? action.command;
  // A stable social id that is not on offer now still goes to the game, which says exactly why not.
  const talk = /^talk:([a-z_]+):(\d+)$/.exec(text);
  if (talk?.[1] && o.interactionVerbs.some((d) => d.id === talk[1]))
    return {
      kind: 'core.urge',
      actorId: pc,
      data: { urge: { kind: 'interaction', interactionId: talk[1], targetId: asActorId(Number(talk[2])) } },
    };
  if (/^[+-]?\d+$/.test(text)) {
    const chosen = menuActions(o, page)[Number(text) - 1];
    return chosen ? (confirmEnding(chosen.command, text) ?? chosen.command) : 'No such menu number';
  }
  if (verb === 'signs') return { kind: 'fae.signs', actorId: pc, data: {} };
  if (verb === 'investigate') return { kind: 'fae.investigate', actorId: pc, data: { signId: tail } };
  // Bare help is the verb list; help <person> lends them a hand (playtest r2).
  if (verb === 'help' && !tail) return HELP;
  const reading = ['look', 'plan', 'journal', 'explain', 'inspect', 'prices'].includes(verb);
  if (o.ending && !reading) return 'This life has ended; only reading remains';
  if (o.self.needs.survival?.collapsed && !reading && verb !== 'wait') return 'You have collapsed and need help';
  // Answers to what she was asked: yes / no, or accept / refuse (playtest r2: only answer:<id> worked).
  if (['yes', 'no', 'accept', 'refuse', 'decline'].includes(verb)) {
    const yes = verb === 'yes' || verb === 'accept';
    const open = o.requests.filter(
      (r) =>
        !tail ||
        normalized(o.knownPeople.find((p) => p.id === r.from)?.name ?? '').includes(normalized(tail)) ||
        String(r.from) === tail,
    );
    if (!o.requests.length) return 'Nobody has asked you anything just now';
    if (open.length !== 1 || !open[0])
      return `Which? ${o.requests.map((r) => `${verb} ${o.knownPeople.find((p) => p.id === r.from)?.name ?? `#${r.from}`}`).join('; ')}`;
    return { kind: 'social.answer_request', actorId: pc, data: { requestId: open[0].id, accept: yes } };
  }
  if (verb === 'retire' || verb === 'depart') {
    const act = o.actions.find((a) => a.id === verb);
    if (!act) return `You cannot ${verb} just now`;
    return confirmEnding(act.command, text) ?? act.command;
  }
  if (verb === 'agency' || verb === 'standing') {
    if (!tail) return settingsText(o);
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
  // Prices a page or a word at a time (playtest r2: 230-330 lines at once).
  if (verb === 'prices')
    return {
      kind: 'activity.observe',
      actorId: pc,
      data: { query: 'look', target: tail ? `prices:${normalized(tail)}` : 'prices' },
    };
  if (verb === 'explain') return { kind: 'activity.observe', actorId: pc, data: { query: 'explain', target: tail } };
  if (verb === 'inspect') {
    const q = normalized(tail);
    if (['me', 'myself', 'self', 'yourself', normalized(o.self.name)].includes(q))
      return { kind: 'activity.observe', actorId: pc, data: { query: 'inspect', target: `actor:${pc}` } };
    const found = find(
      o.actions.filter((a) => a.id.startsWith('inspect:')),
      tail,
    );
    return typeof found === 'string' && found.startsWith('Nothing here matches')
      ? `You cannot inspect “${tail}”: it is not here, in your pack, or someone you know. Try look, plan or places`
      : found;
  }
  if (verb === 'aid') {
    const helping = o.actions.filter((a) => a.id.startsWith('aid:'));
    const found = find(helping, tail);
    if (typeof found !== 'string' || found.startsWith('Which one?')) return found;
    const q = normalized(tail);
    const person = o.present.find((p) => normalized(p.name).includes(q) || String(p.id) === tail);
    if (person) return `${person.name} does not need help just now`;
    return tail ? `${tail} is not here` : 'Nobody here needs help just now';
  }
  if (verb === 'go') {
    const goes = o.actions.filter((a) => a.id.startsWith('go:'));
    const byId = /^\d+$/.test(tail) ? goes.find((a) => a.id === `go:${Number(tail)}`) : undefined;
    if (byId) return byId.command;
    const found = /^\d+$/.test(tail) ? 'No such destination' : find(goes, tail);
    if (typeof found !== 'string' || found.startsWith('Which one?')) return found;
    // Not on offer (asleep at camp, a locked hour): name the place and let the game say why not.
    const q = normalized(tail);
    const places = o.places.filter((p) => normalized(p.name).includes(q) || String(p.id) === tail);
    if (places.length === 1 && places[0]) {
      if (places[0].id === o.place.id) return `You are already at ${places[0].name}`;
      return {
        kind: 'core.urge',
        actorId: pc,
        data: { urge: { kind: 'activity', activityId: 'walk', placeId: places[0].id as never } },
      };
    }
    return places.length > 1 ? `Which place? ${places.map((p) => `${p.name} [go ${p.id}]`).join('; ')}` : found;
  }
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
  if (verb === 'drink') return drinkRefusal(o);
  if (verb === 'fill' || verb === 'refill') {
    if (!tail) return 'Fill what? Use fill <canteen, kettle or other vessel>';
    const vessels = o.self.inventory.carried.filter((s) => normalized(s.name).includes(normalized(tail)));
    const offered = o.actions.filter(
      (a) => a.id.startsWith('refill:') && vessels.some((v) => a.id === `refill:${v.id}`),
    );
    if (offered[0]) return offered[0].command;
    // Not on offer: hand the game a refill of the first matching vessel so it says exactly why not.
    const vessel = vessels.find((v) => v.waterMl !== undefined) ?? vessels[0];
    return vessel
      ? { kind: 'provisions.refill', actorId: pc, data: { itemId: asItemId(vessel.id) } }
      : `You carry nothing called “${tail}”; plan lists your pack`;
  }
  if (verb === 'empty' || (verb === 'pour' && words[0] === 'out')) {
    const query = verb === 'pour' ? words.slice(1).join(' ') : tail;
    if (!query) return 'Empty what? Use empty <canteen, kettle or other vessel>';
    const vessels = o.self.inventory.carried.filter((s) => normalized(s.name).includes(normalized(query)));
    const offered = o.actions.filter((a) => a.id.startsWith('empty:') && vessels.some((v) => a.id === `empty:${v.id}`));
    if (offered.length) return choose(offered, query);
    // Not on offer (already dry, not a vessel): hand the game the pour so it says exactly why not.
    const vessel = vessels.find((v) => v.waterMl !== undefined) ?? vessels[0];
    return vessel
      ? { kind: 'provisions.empty', actorId: pc, data: { itemId: asItemId(vessel.id) } }
      : `You carry nothing called “${query}”; plan lists your pack`;
  }
  if (verb === 'wake') return find(o.actions, 'activity:idle_at_home');
  if (verb === 'sleep' && o.region?.location.kind === 'edge')
    return o.actions.find((a) => a.id === 'journey:camp')?.command ?? 'Camp is unavailable';
  if (['sleep', 'rest', 'work'].includes(verb)) {
    const activityId = { sleep: 'sleep', rest: 'idle_at_home', work: 'work' }[verb as 'sleep' | 'rest' | 'work'];
    const offered = o.actions.find((a) => a.id === `activity:${activityId}`);
    // Not on offer (a locked hour, not her trade): the game says why, with no internal ids.
    return offered?.command ?? { kind: 'core.urge', actorId: pc, data: { urge: { kind: 'activity', activityId } } };
  }
  if ((verb === 'buy' || verb === 'sell') && !words.length)
    return verb === 'buy'
      ? 'Buy what? Type prices to see what is for sale, then buy <item> [qty]'
      : 'Sell what? Type plan to see what you carry, then sell <item> [qty]';
  if (verb === 'buy' || verb === 'sell') {
    const last = words.at(-1),
      qty = last && /^[+-]?\d+(?:\.\d+)?$/.test(last) ? Number(words.pop()) : 1;
    if (!Number.isSafeInteger(qty) || qty <= 0) return 'Quantity must be a positive whole number';
    const query = words.join(' ');
    const found = find(
      o.actions.filter((a) => a.id.startsWith(`${verb}:`)),
      query,
    );
    if (typeof found !== 'string')
      return found.kind === 'provisions.buy'
        ? { ...found, data: { ...found.data, qty } }
        : found.kind === 'provisions.sell'
          ? { ...found, data: { ...found.data, qty } }
          : found;
    if (found.startsWith('Which one?')) return found;
    // Not on offer: name the goods and let the game say why (closed, sold out, too dear, broken open).
    const q = normalized(query);
    if (verb === 'buy') {
      if (o.store.stock === null) return 'Nothing is sold here';
      const defs = [
        ...new Set(
          o.store.stock
            .filter((s) => normalized(s.name).includes(q) || normalized(s.defId).includes(q))
            .map((s) => s.defId),
        ),
      ];
      if (defs.length === 1 && defs[0])
        return {
          kind: 'provisions.buy',
          actorId: pc,
          data: { placeId: o.place.id as never, defId: defs[0], qty, onCredit: false },
        };
      return defs.length > 1
        ? `Which one? ${defs.map((d) => o.store.stock?.find((s) => s.defId === d)?.name ?? d).join('; ')}`
        : `“${query}” is not sold here; prices lists what is`;
    }
    const mine = o.self.inventory.carried.filter(
      (s) => normalized(s.name).includes(q) || normalized(s.defId).includes(q),
    );
    if (mine[0] && new Set(mine.map((s) => s.defId)).size === 1)
      return {
        kind: 'provisions.sell',
        actorId: pc,
        data: { placeId: o.place.id as never, itemId: mine[0].id as never, qty },
      };
    return mine.length ? `Which one? ${[...new Set(mine.map((s) => s.name))].join('; ')}` : `You carry no ${query}`;
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
    if (matched.length) return choose(matched, `${item} into ${box}`);
    // Not on offer: name both from the pack and let the game give the real reason (full, holds water…).
    const thing = o.self.inventory.carried.find((s) => normalized(s.name).includes(wantItem));
    const into = o.self.inventory.carried.find((s) => normalized(s.name).includes(wantBox) && s.id !== thing?.id);
    if (!thing) return `You carry nothing called “${item.trim()}”; plan lists your pack`;
    if (!into) return `You carry no container called “${box.trim()}”; plan lists your pack`;
    return {
      kind: 'provisions.pack',
      actorId: pc,
      data: { itemId: asItemId(thing.id), qty: 1, intoItemId: asItemId(into.id) },
    };
  }
  if (verb === 'hire' || verb === 'dismiss') {
    const pay = words.at(-1) === 'weekly' ? 'weekly' : 'daily';
    const target = tail.replace(/^(on with|on|with) /, '').replace(/ (daily|weekly)$/, '');
    const q = normalized(target);
    const exact = o.present.filter((p) => normalized(p.name) === q || String(p.id) === q);
    const matches = exact.length ? exact : o.present.filter((p) => normalized(p.name).includes(q));
    if (matches.length !== 1 || !matches[0]) return 'Name one person present here';
    return verb === 'hire'
      ? { kind: 'provisions.hire_on', actorId: pc, data: { employerId: matches[0].id, term: pay } }
      : { kind: 'provisions.dismiss', actorId: pc, data: { workerId: matches[0].id } };
  }
  if (verb === 'quit') return { kind: 'provisions.quit', actorId: pc, data: {} };
  // Social verbs: "chat Amos", "talk to Amos", "talk introduce Amos", "ask about Amos",
  // "ask_about Amos Whitcomb", "help Joel Pike". A full name beats a partial one.
  let socialVerb =
    verb === 'talk' || verb === 'interact' ? 'chat' : verb === 'ask' && words[0] === 'about' ? 'ask_about' : verb;
  let targetText = verb === 'ask' && words[0] === 'about' ? words.slice(1).join(' ') : tail.replace(/^(to|with) /, '');
  if ((verb === 'talk' || verb === 'interact') && o.interactionVerbs.some((d) => d.id === words[0])) {
    socialVerb = words[0] ?? 'chat';
    targetText = words.slice(1).join(' ');
  }
  if (o.interactionVerbs.some((d) => d.id === socialVerb)) {
    const q = normalized(targetText);
    const exact = o.present.filter((p) => normalized(p.name) === q || String(p.id) === targetText);
    const targets = exact.length ? exact : o.present.filter((p) => normalized(p.name).includes(q));
    if (targets.length !== 1 || !targets[0]) {
      if (targets.length) return `Which person? ${targets.map((p) => p.name).join('; ')}`;
      const known = o.knownPeople.find((p) => normalized(p.name).includes(q));
      return known ? `${known.name} is not here` : 'That person is not here';
    }
    return {
      kind: 'core.urge',
      actorId: pc,
      data: { urge: { kind: 'interaction', interactionId: socialVerb, targetId: targets[0].id } },
    };
  }
  return find(o.actions, text);
}
/** Lines for one page of prices (or those matching a word): 20 to a page, grouped by item and price. */
function renderPrices(stock: Observation['store']['stock'], page?: number, filter?: string): string {
  const groups = new Map<string, { name: string; priceCents: number; qty: number }>();
  for (const row of stock ?? []) {
    if (filter && !normalized(row.name).includes(normalized(filter)) && !normalized(row.defId).includes(filter))
      continue;
    const key = `${row.defId}:${row.priceCents}`;
    const entry = groups.get(key);
    if (entry) entry.qty += row.qty;
    else groups.set(key, { ...row });
  }
  if (!groups.size) return filter ? `Nothing here matches “${filter}”.` : 'No goods for sale here.';
  const rows = [...groups.values()].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : a.priceCents - b.priceCents,
  );
  const size = 20;
  const pages = Math.ceil(rows.length / size);
  const p = Math.min(Math.max(1, page ?? 1), pages);
  const goods = `${rows.length} ${rows.length === 1 ? 'line' : 'lines'}`;
  const head =
    pages > 1
      ? `Prices${filter ? ` matching “${filter}”` : ''}: page ${p} of ${pages} (${goods}). “prices ${p < pages ? p + 1 : 1}” for ${p < pages ? 'the next' : 'the first'} page; “prices <word>” to search.`
      : `Prices${filter ? ` matching “${filter}”` : ''} (${goods}).`;
  return [
    head,
    ...rows
      .slice((p - 1) * size, p * size)
      .map((s) => `${s.name}: $${(s.priceCents / 100).toFixed(2)} each; ${s.qty} in stock`),
  ].join('\n');
}
export function renderDetail(detail: unknown): string {
  if (detail && typeof detail === 'object' && 'boundaryMinutes' in detail) {
    const r = detail as import('@coulee/core').provisions.TripReadiness;
    return [
      `Route to ${r.destination}: ${r.elapsedMinutes / 60} hours to arrival if nothing goes wrong (hourly boundaries; final spare minutes are waiting).`,
      ...(r.walkingMinutes === undefined
        ? []
        : [`Walking time: ${r.walkingMinutes} min; arrival ${timeView(r.arrivalTime).stamp}.`]),
      `Carried provisions: ${r.kcal} kcal, protein ${r.proteinG} g, fat ${r.fatG} g, Fresh ${r.freshPoints}; water ${r.waterUsedMl} ml used / ${r.waterLeftMl} ml left; fuel ${r.fuelUsed}.`,
      ...r.foods.map(
        (f) =>
          `${f.name}: ${f.servingsPm / 1000} servings used, ${f.remainingPm / 1000} left; spoilage ${f.spoilage}/1000.`,
      ),
      `Arrival load ${r.loadPct}%; rest ${r.needs.rest ?? '?'}/1000.`,
      ...(r.risks ?? []),
      ...r.warnings,
      ...r.uncertainty,
    ].join('\n');
  }
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'prices' in detail) {
    const d = detail as {
      prices: Observation['store']['stock'];
      page?: number;
      filter?: string;
      freight?: Observation['store']['freight'];
    };
    const list = renderPrices(d.prices, d.page, d.filter);
    return d.freight ? `${freightLine(d.freight)}\n${list}` : list;
  }
  if (detail && typeof detail === 'object' && 'selfSummary' in detail) {
    const s = (detail as { selfSummary: Record<string, unknown> }).selfSummary as {
      name: string;
      people: string;
      doing: string;
      place: string;
      lodging: string | null;
      agencyMode: string;
      orders: Record<string, unknown>;
      rationPct: number;
      vitals: string[];
      mind: string[];
      conditions: string[];
      purseCents: number;
      householdCents: number;
      load: string;
      obligations: string[];
      claims: string[];
      ties: string[];
      known: number;
    };
    const on = (['sleep', 'eat', 'drink', 'warmth', 'lodging'] as const)
      .map((k) => `${k} ${s.orders[k] ? 'on' : 'off'}`)
      .join(', ');
    return [
      `${s.name} — ${s.people}; ${s.doing} at ${s.place}${s.lodging ? `; lodging at ${s.lodging}` : ''}.`,
      `Purse $${(s.purseCents / 100).toFixed(2)}; household $${(s.householdCents / 100).toFixed(2)}. Load: ${s.load}.`,
      `Body: ${s.vitals.join('; ')}${s.conditions.length ? `. Conditions: ${s.conditions.join(', ')}` : ''}.`,
      ...(s.mind.length ? [`Mind: ${s.mind.join('; ')}.`] : []),
      `Standing orders: ${on}; agency ${s.agencyMode}; rations ${s.rationPct}%.`,
      ...(s.obligations.length ? s.obligations : ['You owe no one.']),
      ...s.claims,
      `Ties: ${s.ties.join(', ') || 'none yet'}; you have met ${s.known} ${s.known === 1 ? 'person' : 'people'}.`,
    ].join('\n');
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
      acquainted?: boolean;
      familiarity?: number;
      between?: string[];
    };
    if (!d.person) return 'No known person here.';
    const met =
      d.acquainted === undefined
        ? ''
        : d.acquainted
          ? `You have met (familiarity ${d.familiarity ?? 0} of 1000). `
          : 'You have not met. ';
    return [
      `${d.person.name} — ${d.person.people}; ${d.person.activity}${d.person.child ? ' (a child)' : ''}.`,
      `${met}Ties: ${d.relationships.map((r) => r.label).join(', ') || 'none'}. Your opinion: ${d.opinion ? d.opinion.label || 'Neutral' : 'unfamiliar'}.`,
      ...(d.between ?? []),
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
    const box = d.catalog.container;
    return [
      `${d.item.name}: ${d.item.qty} ${d.item.unit}; ${d.item.weightG} g; bulk ${d.item.bulkTenths / 10}.`,
      ...(f
        ? [
            `Per ${d.item.unit} (${f.servings} servings): ${f.kcal} kcal; protein ${f.protein_g} g; fat ${f.fat_g} g; fresh ${f.fresh}/100.`,
            `Remaining: ${(d.item.servingsLeftPm ?? 0) / 1000} servings; spoilage ${d.item.spoilage}/1000.`,
            `Preparation: ${f.prep.map((p) => p.method).join(', ')}.`,
          ]
        : []),
      ...(box
        ? [
            `Container: holds up to ${(box.capacity_g / 1000).toFixed(1)} kg and bulk ${box.capacity_bulk}${box.liquid_ml ? `, or ${box.liquid_ml} ml of liquid` : ''}${box.protects.length ? `; keeps out ${box.protects.join(', ').replaceAll('_', ' ')}` : ''}; carried on the ${box.carry.replaceAll('_', ' ')}. Water in it: ${d.item.waterMl} ml.`,
          ]
        : []),
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (detail && typeof detail === 'object' && 'description' in detail && 'name' in detail)
    return `${detail.name}\n${detail.description}`;

  if (detail && typeof detail === 'object' && 'summary' in detail && 'id' in detail) {
    // The act in words; its dice and the reasons behind it stay in explain (playtest r2: no jargon).
    const event = detail as Observation['events'][number];
    return `[${event.id}] ${event.summary}${event.explain ? ` — explain ${event.id} for how it went` : ''}`;
  }
  if (detail && typeof detail === 'object' && 'knowledge' in detail && 'terms' in detail)
    return explainLine(detail as Parameters<typeof explainLine>[0]);
  if (Array.isArray(detail) && detail.some((e) => e && typeof e === 'object' && 'signId' in e))
    return detail
      .map(
        (e) =>
          `[${e.signId}] ${e.closedAt !== null ? 'Settled' : e.available ? 'Open question' : 'Faded'}: ${e.text}${e.evidence ? `\n${e.evidence}` : ''}${e.closedAt === null ? (e.available ? ` (investigate ${e.signId})` : ' (the trace has faded)') : ''}`,
      )
      .join('\n');
  if (Array.isArray(detail))
    return detail.length
      ? detail
          .map((e) => (e && typeof e === 'object' && 'text' in e ? `${e.stamp ?? ''} ${e.text}` : JSON.stringify(e)))
          .join('\n')
      : 'No journal entries known yet.';
  if (detail && typeof detail === 'object' && 'daysOfFoodTenths' in detail && 'warnings' in detail) {
    const r = detail as Observation['self']['provisions']['readiness'] &
      Observation['self']['inventory'] & { pantry?: Observation['self']['pantry'] };
    const need = r.needExplain;
    const hours = need?.terms
      .flatMap((t) => {
        const m = /^(.+?) (\d+) h, kcal$/.exec(t.label);
        return m?.[1] && Number(m[2]) > 0 ? [`${m[1].toLowerCase()} ${m[2]} h`] : [];
      })
      .join(', ');
    return [
      `Food ${(r.daysOfFoodTenths / 10).toFixed(1)} days in your pack; ${r.kcalOnHand} usable kcal / ${r.kcalPerDay} kcal per day (the mean of the days projected).`,
      ...(need
        ? [
            `Daily need today: ${need.total} kcal by your occupation's scheduled day (${hours})${r.needRange && r.needRange.max !== r.needRange.min ? `; this week ${r.needRange.min}–${r.needRange.max} kcal` : ''}. ${need.note ?? ''}`.trimEnd(),
          ]
        : []),
      ...(r.daysOfWaterTenths != null
        ? [`Water carried: ${(r.daysOfWaterTenths / 10).toFixed(1)} days of drinking.`]
        : []),
      ...(r.pantry
        ? [
            `Pantry at ${r.pantry.placeName}${r.pantry.withPack ? ' (with your pack)' : ''}: ${(r.pantry.daysOfFoodTenths / 10).toFixed(1)} days; ${r.pantry.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}.`,
          ]
        : []),
      `Fuel: ${r.daysOfFuelTenths === null ? 'no cooking fuel required by projected meals' : (r.daysOfFuelTenths / 10).toFixed(1) + ' days'}.`,
      `Spoils first: ${r.spoilsFirst ? `${r.spoilsFirst.name} in ${(r.spoilsFirst.inDaysTenths / 10).toFixed(1)} days` : 'none'}.`,
      `Load: ${r.totalWeightG} g; bulk ${(r.totalBulkTenths / 10).toFixed(1)}; ${r.loadBand}.`,
      ...r.warnings,
      ...(r.charms ?? []).map(
        (k) =>
          `${k.kind === 'exact' ? 'Charm (counted)' : k.kind === 'conditional' ? 'Charm (shown, not counted)' : 'Charm (claims not included)'}: ${k.text}`,
      ),
      ...r.carried.map((i) => `${i.qty} × ${i.name} (#${i.id})${i.containerId ? ' in #' + i.containerId : ''}`),
    ].join('\n');
  }
  return JSON.stringify(detail, null, 2);
}
/** What is owed between her and others, as journal lines (playtest r2: favors never showed). */
export function obligationLines(o: Observation): string[] {
  return [...o.self.obligations.map((d) => obligationText(d)), ...(o.self.claims ?? []).map((c) => claimText(c))];
}

function employmentText(e: NonNullable<Observation['self']['provisions']['employment']>): string {
  const terms = `${e.employer}: $${(e.dailyCents / 100).toFixed(2)} per ${e.hours}h day, paid ${e.pay}; ${e.fromHour}:00–${e.toHour}:00 at ${e.workplace}`;
  return `Employment ${e.ended ? `ended (${e.ended})` : terms}. Earned and unpaid $${(e.earnedCents / 100).toFixed(2)}.`;
}
