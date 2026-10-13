import type { OpenProjection } from '../chronicle/api.ts';
import { normalizeExplain, term } from '../explain.ts';
import { idsOf, rowsOf } from '../ids.ts';
import { memoriesOf } from '../social/api.ts';
import type { World } from '../world.ts';
import type { DirectorState, Thread } from './state.ts';

const DAY = 1440;
export function patternCounts(st: DirectorState, pattern: string) {
  st.patterns[pattern] ??= { opened: 0, resolved: 0, abandoned: 0 };
  return st.patterns[pattern];
}
function finish(st: DirectorState, thread: Thread, state: 'Resolved' | 'Abandoned', at: number) {
  if (thread.closed_at !== null) return;
  thread.state = state;
  thread.closed_at = at;
  thread.open_questions = [];
  patternCounts(st, thread.pattern)[state === 'Resolved' ? 'resolved' : 'abandoned']++;
  if (state === 'Resolved') st.recent_resolutions.push({ pattern: thread.pattern, at });
}
export function recordProjection(world: World, p: OpenProjection): void {
  const st = world.director;
  if (!st) return;
  let th = st.threads[p.id];
  if (!th) {
    th = {
      id: p.id,
      pattern: p.pattern,
      actors: { ...p.actors },
      places: [...p.places],
      opened_at: p.opened_at,
      last_advanced: p.last_advanced,
      stakes_pm: p.stakes_pm,
      player_involvement_pm: 0,
      open_questions: [...p.open_questions],
      state: 'Latent',
      guns: [],
      callbacks: [],
      interest: 0,
      interest_explain: null,
      closed_at: null,
      last_fact: 0,
      level: 0,
    };
    const previous = st.pattern_recency[p.pattern];
    st.pattern_recency[p.pattern] = { id: p.id, at: p.opened_at, previous_at: previous?.at ?? null };
    st.threads[p.id] = th;
    patternCounts(st, p.pattern).opened++;
  }
  if (th.closed_at !== null) return;
  th.actors = { ...p.actors };
  th.places = [...p.places];
  th.stakes_pm = p.stakes_pm;
  th.last_advanced = p.last_advanced;
  th.level = p.level;
  th.open_questions = [...p.open_questions];
  for (const plant of p.guns) {
    if (plant.event <= th.last_fact) continue;
    th.guns.push({
      planted_event: plant.event,
      planted_at: plant.at,
      salience: plant.salience,
      seen_by_player: false,
      fire_window: [...plant.window],
      fired: false,
      expired: false,
      fired_at: null,
    });
    th.last_fact = Math.max(th.last_fact, plant.event);
    st.guns.planted++;
  }
  for (const gun of th.guns) {
    const age = p.firedAt === null ? -1 : p.firedAt - gun.planted_at;
    if (!gun.fired && !gun.expired && age >= gun.fire_window[0] * DAY && age <= gun.fire_window[1] * DAY) {
      gun.fired = true;
      gun.fired_at = p.firedAt;
      st.guns.fired++;
    }
  }
  th.state = p.state;
  if (p.state === 'Resolved' || p.state === 'Abandoned') finish(st, th, p.state, world.time);
}
export function ripeness(age: number): number {
  const points = [
    [0, 0],
    [7, 1000],
    [21, 1000],
    [60, 200],
    [90, 0],
  ] as const;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (a && b && age <= b[0]) return a[1] + Math.floor(((age - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  }
  return 0;
}
export function scoreThread(st: DirectorState, th: Thread, now: number) {
  const recent = st.recent_resolutions.filter((r) => r.pattern === th.pattern && now - r.at <= 30 * DAY);
  const history = st.pattern_recency[th.pattern];
  const lastOther = history?.id === th.id ? history.previous_at : history?.at;
  const novelty =
    lastOther == null ? 1000 : Math.max(0, Math.min(1000, Math.floor(((now - lastOther) * 1000) / (30 * DAY))));
  const callback = Math.max(0, ...th.callbacks.map((m) => m.salience));
  const guns = Math.min(1000, th.guns.filter((g) => g.seen_by_player && !g.fired && !g.expired).length * 500);
  const terms = [
    term('director', 'Player involvement ×30', 30 * th.player_involvement_pm),
    term('director', 'Stakes ×20', 20 * th.stakes_pm),
    term('director', 'Ripeness ×15', 15 * ripeness(Math.max(0, Math.floor((now - th.opened_at) / DAY)))),
    term('memory', 'Callback strength ×15', 15 * callback),
    term('director', 'Seen unfired guns ×10', 10 * guns),
    term('director', 'Novelty ×10', 10 * novelty),
    term('director', 'Mode fit ×5 (neutral in D0)', 2500),
    term('director', 'Repetition ×−20', -20 * Math.min(1000, recent.length * 250)),
    term('director', 'Implausibility ×−30 (no nudges)', 0),
  ];
  th.interest = Math.floor(terms.reduce((s, t) => s + t.value, 0) / 10);
  th.interest_explain = normalizeExplain({
    kind: 'formula',
    label: 'Daily thread interest (weighted numerator / 10)',
    knowledge: 'omniscient',
    subjects: Object.values(th.actors),
    terms,
    total: th.interest,
    outcome: 'assessed',
  });
}
export function rankThreads(a: Thread, b: Thread): number {
  return b.interest - a.interest || a.id - b.id;
}
export function updateThreads(world: World, now: number, seen: ReadonlySet<number>, daily: boolean): void {
  const st = world.director;
  if (!st) return;
  const memories = st.focus === null ? [] : memoriesOf(world, st.focus);
  const memoryEvents = new Set(memories.flatMap((m) => (m.eventId === null ? [] : [m.eventId as number])));
  st.recent_resolutions = st.recent_resolutions.filter((r) => now - r.at <= 30 * DAY);
  for (const id of idsOf(st.threads)) {
    const th = st.threads[id];
    if (!th) continue;
    for (const gun of th.guns) {
      if (!gun.seen_by_player && (seen.has(gun.planted_event) || memoryEvents.has(gun.planted_event))) {
        gun.seen_by_player = true;
        st.guns.seen++;
      }
      if (!gun.fired && !gun.expired && now > gun.planted_at + gun.fire_window[1] * DAY) {
        gun.expired = true;
        st.guns.expired++;
        if (!gun.seen_by_player) st.guns.expired_unseen++;
      }
    }
    if (th.closed_at === null && now - th.last_advanced > 120 * DAY) finish(st, th, 'Abandoned', now);
    if (th.state === 'Latent' && th.guns.some((g) => g.seen_by_player)) th.state = 'Foreshadowed';
    if (daily) {
      const actors = Object.values(th.actors);
      th.callbacks = memories
        .filter(
          (m) =>
            m.salience >= 600 &&
            ((m.aboutId !== null && m.aboutId !== st.focus && actors.includes(m.aboutId)) ||
              m.roles.some((r) => r.who !== st.focus && actors.includes(r.who)) ||
              th.guns.some((g) => g.planted_event === m.eventId)),
        )
        .sort((a, b) => b.salience - a.salience || a.id - b.id)
        .slice(0, 8)
        .map((m) => ({ owner: m.ownerId, memory: m.id, salience: m.salience }));
      th.player_involvement_pm =
        st.focus !== null && actors.includes(st.focus)
          ? 1000
          : th.guns.some((g) => g.seen_by_player) || th.callbacks.length
            ? 500
            : 0;
      scoreThread(st, th, now);
    }
  }
  if (daily) {
    const best = new Map(st.top_threads.map((t) => [t.id, t]));
    for (const th of rowsOf(st.threads)) {
      const old = best.get(th.id);
      if (!old || old.interest < th.interest) best.set(th.id, th);
    }
    st.top_threads = [...best.values()]
      .sort(rankThreads)
      .slice(0, 10)
      .map((t) => ({
        ...t,
        actors: { ...t.actors },
        places: [...t.places],
        guns: t.guns.map((g) => ({ ...g, fire_window: [...g.fire_window] })),
        callbacks: t.callbacks.map((m) => ({ ...m })),
        open_questions: [...t.open_questions],
      }));
    for (const th of rowsOf(st.threads)) {
      // Keep a closed thread until every gun's window has elapsed, then compact into counters.
      if (th.closed_at !== null && now - th.closed_at > 90 * DAY && th.guns.every((g) => g.fired || g.expired))
        delete st.threads[th.id];
    }
  }
}
