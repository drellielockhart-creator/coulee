/**
 * D1 planner (DIRECTOR-PLAN §3.4): a daily greedy knapsack over the ripening moves of the
 * top-k open threads, filtered by pacing state and plausibility, within the personality's
 * budget. It writes biases with an expiry into `world.director.plan` and nothing else: it never
 * touches another module's state, draws no RNG, and reads minds only through their APIs.
 *
 * Hard prohibitions (05 §8.3) enforced here and at each hook:
 * - no target is selected or weighted by people or culture (nothing here reads either);
 * - faekin_suspicion / scapegoat / defense_fired threads are never ripened, and a carrier is
 *   never weighted toward a kind (people) predicate or a charge;
 * - the PC is never a subject, and every hook refuses a decision the PC could perceive;
 * - no psyche writes; no fabricated rumor (N4 only weights a fact the carrier already holds).
 */
import { beliefOf, WORTH_TELLING } from '../belief/api.ts';
import type { ContentBundle } from '../content.ts';
import { undiscoveredDrawHouseholds } from '../fae/api.ts';
import { type ActorId, idsOf, type PropId, rowsOf } from '../ids.ts';
import type { SimContext } from '../sim/context.ts';
import { loansOf } from '../social/api.ts';
import type { World } from '../world.ts';
import { pushRecord, totalsOf } from './bias.ts';
import type { DirectorState, Pacing, PlanState, Thread } from './state.ts';
import { rankThreads } from './threads.ts';

const DAY = 1440;
export const BUDGET_CAP = 30;
/** 05 §8.3: never ripened (no faekin exposure; the scapegoat ladder and minds wait for D2's N3). */
export const FORBIDDEN_PATTERNS: readonly string[] = ['faekin_suspicion', 'scapegoat', 'defense_fired'];
/** 05 §8.7: the death-spiral detector, on the display scale ×10. */
const SPIRAL_TAU = 800;
const SPIRAL_DAYS = 3;
const N4_FACTS = 3;

type Personality = NonNullable<ContentBundle['directorPersonalities']>[string];
type Move = NonNullable<ContentBundle['directorMoves']>[string];

export function personalityOf(content: ContentBundle, st: DirectorState): Personality | undefined {
  return content.directorPersonalities?.[st.settings.personality];
}

export function ensurePlan(st: DirectorState): PlanState {
  st.plan ??= {
    budget: 0,
    reserved: 0,
    next_bias: 0,
    biases: [],
    nudges: [],
    nudges_compacted: 0,
    totals: {},
    cycle: { target: null, build_started: null, seen_at_start: 0, peaks: 0, fizzles: 0, builds: 0 },
    spiral_days: 0,
    mercy_wanted: 0,
  };
  return st.plan;
}

function seenGuns(th: Thread | undefined): number {
  return th ? th.guns.filter((g) => g.seen_by_player).length : 0;
}

/**
 * The Almanac's seasonal curve (05 §8.8): RELAX for the season's rest, then BUILD toward the
 * chosen threat thread; PEAK when the PC meets it (a planted gun of the target seen) or τ_fast
 * crosses the threshold; a BUILD that never reaches the PC fizzles to FADE after `build_days`.
 */
export function seasonalPacing(st: DirectorState, ctx: SimContext, p: Personality): void {
  const plan = ensurePlan(st);
  st.low_hours = st.tau_fast < 300 ? st.low_hours + 1 : 0;
  const elapsed = ctx.now - st.pacing_since;
  const m = ctx.cal.month;
  const season = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  const relax = p.season_relax_days?.[season] ?? p.relax_days;
  let next: Pacing = st.pacing;
  if (st.pacing === 'RELAX' && elapsed >= relax * DAY) next = 'BUILD';
  else if (st.pacing === 'BUILD') {
    const target = plan.cycle.target === null ? undefined : st.threads[plan.cycle.target];
    if (st.tau_fast >= p.peak_threshold || (target && seenGuns(target) > plan.cycle.seen_at_start)) next = 'PEAK';
    else if (elapsed >= p.build_days * DAY) {
      next = 'FADE';
      plan.cycle.fizzles++;
    }
  } else if (st.pacing === 'PEAK' && elapsed >= p.peak_hours * 60) next = 'FADE';
  else if (st.pacing === 'FADE' && (st.low_hours >= 12 || elapsed >= DAY)) next = 'RELAX';
  if (next === st.pacing) return;
  if (next === 'BUILD') {
    plan.cycle.builds++;
    plan.cycle.build_started = ctx.now;
    plan.cycle.target = null;
  }
  if (next === 'PEAK') plan.cycle.peaks++;
  if (next === 'RELAX') plan.cycle.target = null;
  st.pacing = next;
  st.pacing_since = ctx.now;
  st.low_hours = 0;
}

type Mode = 'ripen' | 'suppress';
function modeFor(pacing: Pacing, move: Move, isTarget: boolean): Mode | null {
  switch (pacing) {
    case 'RELAX':
      if (move.category !== 'threat') return 'ripen';
      return move.nudge === 'N6' && move.suppress_amount !== undefined ? 'suppress' : null;
    case 'BUILD':
      return isTarget && (move.category === 'threat' || move.nudge === 'N4') ? 'ripen' : null;
    case 'PEAK':
      return !isTarget && move.nudge === 'N6' && move.suppress_amount !== undefined ? 'suppress' : null;
    case 'FADE':
      return move.category === 'social' || move.category === 'opportunity' ? 'ripen' : null;
  }
}

interface Target {
  subject: number | null;
  key: number | null;
  toward_pc: boolean;
}

/** Thread participants whose decisions may be tilted: alive, never the PC. */
function subjectsOf(world: World, th: Thread, pc: ActorId | null, role: string | undefined): ActorId[] {
  const out: ActorId[] = [];
  for (const [r, id] of Object.entries(th.actors).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (role !== undefined && r !== role) continue;
    if (id === pc || !world.actors[id]?.alive || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * N4 carriers: a living non-PC holder of an unconcealed belief (credence ≥ 20) about a thread
 * participant, of a claim the PC does not already hold and the holder has not told the PC.
 * Never a kind (people) predicate or a charge. Juiciest × most believed first, then belief id.
 */
function carriersFor(
  world: World,
  content: ContentBundle,
  actors: ReadonlySet<number>,
  pc: ActorId | null,
): Map<number, Array<{ holder: ActorId; prop: PropId; credence: number; id: number; juicy: number }>> {
  const out = new Map<number, Array<{ holder: ActorId; prop: PropId; credence: number; id: number; juicy: number }>>();
  if (actors.size === 0) return out;
  const households = new Map<number, number>();
  for (const id of [...actors].sort((a, b) => a - b)) {
    const hh = world.actors[id as ActorId]?.householdId;
    if (hh !== undefined && !households.has(hh)) households.set(hh, id);
  }
  for (const id of idsOf(world.belief.beliefs)) {
    const b = world.belief.beliefs[id];
    if (!b || b.conceal || b.credence < 20 || b.holderId === pc) continue;
    if (pc !== null && b.toldTo.includes(pc)) continue;
    const prop = world.belief.props[b.propId];
    if (!prop) continue;
    // About a participant, or a participant's household (a misfortune that befell them).
    let about: number | undefined;
    for (const a of prop.args) {
      if (a.kind === 'actor' && actors.has(a.id)) about = a.id;
      else if (a.kind === 'household') about ??= households.get(a.id);
      if (about !== undefined) break;
    }
    if (about === undefined) continue;
    const pred = content.predicates[prop.pred];
    if (!pred || pred.kind_of !== undefined || pred.charge) continue;
    // Only what is worth the telling at all: the hook never revives a dull or stale topic.
    if (pred.juiciness * 10 < 2 * WORTH_TELLING) continue;
    if (!world.actors[b.holderId]?.alive) continue;
    if (pc !== null && beliefOf(world, pc, b.propId)) continue;
    const list = out.get(about) ?? [];
    list.push({ holder: b.holderId, prop: b.propId, credence: b.credence, id: b.id as number, juicy: pred.juiciness });
    out.set(about, list);
  }
  for (const list of out.values()) list.sort((a, b) => b.juicy * b.credence - a.juicy * a.credence || a.id - b.id);
  return out;
}

function targetsFor(
  world: World,
  th: Thread,
  move: Move,
  pc: ActorId | null,
  carriers: () => ReturnType<typeof carriersFor>,
): Target[] {
  const pcPlace = pc === null ? null : (world.actors[pc]?.placeId ?? null);
  const pcHousehold = pc === null ? null : (world.actors[pc]?.householdId ?? null);
  switch (move.process) {
    case 'gossip': {
      const index = carriers();
      // Facts about the other participants first; talk about the PC last.
      for (const subject of Object.values(th.actors).sort((a, b) => Number(a === pc) - Number(b === pc) || a - b)) {
        // Any holder of the fact may voice it (the hook iterates each carrier's own beliefs):
        // the juiciest, best-believed fact on the most tongues that the town has not yet heard.
        const byProp = new Map<number, number>();
        for (const c of index.get(subject) ?? []) {
          // Fresh news travels: weight against claims the town already widely holds.
          const common = Math.min(1000, world.belief.commons[c.prop]?.prevalence ?? 0);
          byProp.set(c.prop, (byProp.get(c.prop) ?? 0) + Math.floor((c.juicy * c.credence * (1000 - common)) / 1000));
        }
        // Up to three such facts per move (one cost): whichever a carrier happens to voice.
        const best = [...byProp].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, N4_FACTS);
        if (best.length) return best.map(([key]) => ({ subject: null, key, toward_pc: false }));
      }
      return [];
    }
    case 'company_venue':
    case 'call_target': {
      if (pcPlace === null) return [];
      return subjectsOf(world, th, pc, move.role)
        .filter((id) => move.process !== 'call_target' || world.actors[id]?.householdId !== pcHousehold)
        .map((id) => ({ subject: id, key: null, toward_pc: true }));
    }
    case 'loan_breach': {
      const actors = new Set<number>(Object.values(th.actors));
      const loan = loansOf(world).find(
        (l) =>
          l.status === 'open' &&
          l.breachedAt === null &&
          actors.has(l.borrowerId) &&
          l.borrowerId !== pc &&
          l.lenderId !== pc,
      );
      return loan ? [{ subject: loan.borrowerId, key: null, toward_pc: false }] : [];
    }
    case 'fae.shortfall': {
      const open = new Set(undiscoveredDrawHouseholds(world));
      const hh = Object.values(th.actors)
        .map((id) => world.actors[id]?.householdId)
        .filter((h): h is NonNullable<typeof h> => h !== undefined && open.has(h))
        .sort((a, b) => a - b)[0];
      return hh === undefined ? [] : [{ subject: null, key: hh, toward_pc: false }];
    }
    case 'fae.notice': {
      const place = th.places.find((p) => p !== pcPlace && world.places[p as never] !== undefined);
      return place === undefined ? [] : [{ subject: null, key: place, toward_pc: false }];
    }
  }
  return [];
}

/** 05 §8.7's death-spiral detector. Mercy (N10) is D2: D1 records that mercy was wanted. */
function mercyCheck(world: World, st: DirectorState, plan: PlanState, p: Personality): void {
  plan.spiral_days = st.tau_slow > SPIRAL_TAU ? plan.spiral_days + 1 : 0;
  if (p.mercy === 'none' || plan.spiral_days < SPIRAL_DAYS) return;
  plan.mercy_wanted++;
  totalsOf(plan, 'mercy_wanted').placed++;
  pushRecord(world, {
    t: world.time,
    nudge: 'mercy_wanted',
    bias: null,
    process: 'mercy',
    target: st.focus,
    before: st.tau_slow,
    after: st.tau_slow,
    rationale: { threadId: null, tension: st.tau, move: 'death_spiral', pacing: st.pacing },
    cost: 0,
    foresaw: false,
    knowledge: 'omniscient',
  });
}

/** Daily: expire, accrue, and place biases. A no-op for a zero-budget personality. */
export function planDay(world: World, ctx: SimContext): void {
  const st = world.director;
  if (!st) return;
  const p = personalityOf(ctx.content, st);
  if (!p || p.budget_per_day <= 0) return;
  const plan = ensurePlan(st);
  const now = ctx.now;
  plan.biases = plan.biases.filter((b) => {
    if (b.expires > now) return true;
    const leader = (b.group ?? b.id) === b.id;
    if (leader && !b.charged) plan.reserved = Math.max(0, plan.reserved - b.cost);
    if (leader && !plan.biases.some((x) => (x.group ?? x.id) === (b.group ?? b.id) && x.effects > 0))
      totalsOf(plan, b.nudge).expired_unused++;
    return false;
  });
  plan.budget = Math.min(BUDGET_CAP, plan.budget + p.budget_per_day);
  mercyCheck(world, st, plan, p);
  const pc = st.focus;
  const moves = Object.keys(ctx.content.directorMoves ?? {})
    .sort()
    .map((k) => ctx.content.directorMoves?.[k])
    .filter((m): m is Move => m !== undefined && !FORBIDDEN_PATTERNS.includes(m.pattern));
  const threads = rowsOf(st.threads)
    .filter((t) => t.closed_at === null && !FORBIDDEN_PATTERNS.includes(t.pattern))
    .sort(rankThreads)
    .slice(0, p.top_k);
  // BUILD picks its threat thread from the threads and τ first; only then does it look at rolls.
  if (st.pacing === 'BUILD') {
    const current = plan.cycle.target === null ? undefined : st.threads[plan.cycle.target];
    if (!current || current.closed_at !== null) {
      const threat = threads.find((t) => moves.some((m) => m.pattern === t.pattern && m.category === 'threat'));
      plan.cycle.target = threat?.id ?? null;
      plan.cycle.seen_at_start = seenGuns(threat);
    }
  }
  const mult = (m: Move) => p.category_multipliers[m.category] ?? p.category_multipliers.balanced ?? 1000;
  const candidates: Array<{ th: Thread; move: Move; mode: Mode; value: number }> = [];
  for (const th of threads) {
    for (const move of moves) {
      if (move.pattern !== th.pattern) continue;
      const mode = modeFor(st.pacing, move, th.id === plan.cycle.target);
      if (!mode) continue;
      const value = Math.floor((th.interest * mult(move)) / 1000);
      if (value > 0) candidates.push({ th, move, mode, value });
    }
  }
  candidates.sort(
    (a, b) =>
      b.value * a.move.cost - a.value * b.move.cost ||
      b.value - a.value ||
      a.th.id - b.th.id ||
      (a.move.id < b.move.id ? -1 : a.move.id > b.move.id ? 1 : 0),
  );
  let index: ReturnType<typeof carriersFor> | null = null;
  const carriers = () => {
    index ??= carriersFor(world, ctx.content, new Set(threads.flatMap((t) => Object.values(t.actors))), pc);
    return index;
  };
  for (const c of candidates) {
    if (plan.budget - plan.reserved < c.move.cost) continue;
    const amount = c.mode === 'suppress' ? (c.move.suppress_amount ?? 0) : c.move.amount;
    const targets = targetsFor(world, c.th, c.move, pc, carriers).filter(
      (target) =>
        !plan.biases.some(
          (b) =>
            b.process === c.move.process &&
            b.subject === target.subject &&
            b.key === target.key &&
            b.toward_pc === target.toward_pc,
        ),
    );
    if (targets.length === 0) continue;
    const hook =
      c.move.nudge === 'N4'
        ? 'carrier'
        : c.move.nudge === 'N6'
          ? 'window'
          : c.move.nudge === 'N8'
            ? 'option'
            : 'threshold';
    // One move, one cost: its biases (one per participant) form a group charged once.
    const group = plan.next_bias + 1;
    const charged = st.settings.foresight === 'off';
    const totals = totalsOf(plan, c.move.nudge);
    totals.placed++;
    if (charged) {
      // No foresight: the Director cannot know whether the tilt will matter; it pays up front.
      plan.budget -= c.move.cost;
      totals.charged++;
      totals.cost += c.move.cost;
    } else plan.reserved += c.move.cost;
    for (const target of targets)
      plan.biases.push({
        id: ++plan.next_bias,
        group,
        nudge: c.move.nudge,
        hook,
        process: c.move.process,
        subject: target.subject,
        key: target.key,
        toward_pc: target.toward_pc,
        amount,
        thread: c.th.id,
        move: c.mode === 'suppress' ? `${c.move.id}:held_back` : c.move.id,
        tau: st.tau,
        cost: c.move.cost,
        placed_at: now,
        expires: now + c.move.expires_hours * 60,
        charged,
        effects: 0,
      });
  }
}
