import {
  type ActorId,
  type Command,
  type ContentBundle,
  type Event,
  items,
  makeContext,
  provisions,
  psyche,
  restoreSim,
  type Sim,
  social,
  stateHash,
  step,
} from '@coulee/core';
import { GEN_VERSION } from '@coulee/worldgen';
import { availableActions, validateCommand } from './actions.ts';
import { alertFor, type Interrupt, provisionsAlert } from './interrupts.ts';
import { knownExplain, type ObservationMode, observation } from './observation.ts';
import { type SessionSpec, sessionContent, sessionSim } from './source.ts';
export interface LogStep {
  type: 'command';
  command: Command;
  before: string;
  after: string;
  at: number;
  end: number;
}
export interface LogHeader {
  type: 'session';
  format: 1;
  spec: SessionSpec;
  contentHash: string;
}
export type ReplayLog = [LogHeader, ...LogStep[]];
export interface Metric {
  t: number;
  mode: 'telemetry';
  purseCents: number;
  householdCents: number;
  kcalEaten: number;
  kcalBurned: number;
  spoilageUnits: number;
  opinionDeltas: Array<{ actorId: number; affection: number; respect: number; trust: number; fear: number }>;
  rumorsAboutPC: number[];
  defensesTriggered: number[];
  storyBeats: number[];
  deaths: number[];
  idleMinutes: number;
  decidingMinutes: number;
  decidingTimeBasis: 'simulation';
}
export interface ActResult {
  ok: boolean;
  reason?: string;
  warning?: string;
  elapsedMinutes: number;
  interrupts: Interrupt[];
  observation: ReturnType<PlaySession['observe']>;
  detail?: unknown;
}
export class PlaySession {
  private sim: Sim;
  private known: number[] = [];
  private entries: LogStep[] = [];
  private metrics: Metric[] = [];
  private base: ContentBundle;
  private configuration: SessionSpec;
  get spec(): SessionSpec {
    return JSON.parse(JSON.stringify(this.configuration));
  }
  private constructor(base: ContentBundle, spec: SessionSpec, sim?: Sim) {
    this.base = base;
    this.configuration = spec;
    this.sim = sim ?? sessionSim(base, spec);
  }
  static create(content: ContentBundle, spec: SessionSpec): PlaySession {
    const normalized =
      spec.source === 'gen:town'
        ? {
            ...spec,
            source: {
              kind: 'generated' as const,
              recipe: { genVersion: GEN_VERSION, seed: spec.worldSeed ?? spec.seed },
            },
          }
        : spec;
    return new PlaySession(content, JSON.parse(JSON.stringify(normalized)));
  }
  get playerId(): ActorId {
    const id = this.sim.world.meta.playerId;
    if (id === null) throw new Error('No newcomer');
    return id;
  }
  get hash(): string {
    return stateHash(this.sim.world);
  }
  get commandLog(): ReplayLog {
    return JSON.parse(
      JSON.stringify([
        { type: 'session', format: 1, spec: this.spec, contentHash: this.base.meta.hash },
        ...this.entries,
      ]),
    );
  }
  get telemetry(): Metric[] {
    return JSON.parse(JSON.stringify(this.metrics));
  }
  observe(mode: ObservationMode = 'fair') {
    return JSON.parse(JSON.stringify(observation(this.sim, this.playerId, this.known, mode))) as ReturnType<
      typeof observation
    >;
  }
  private fail(reason: string, mode: ObservationMode): ActResult {
    return { ok: false, reason, elapsedMinutes: 0, interrupts: [], observation: this.observe(mode) };
  }
  act(input: Command | string, mode: ObservationMode = 'fair'): ActResult {
    const offered = availableActions(this.sim, this.playerId);
    const command = typeof input === 'string' ? offered.find((a) => a.id === input)?.command : input;
    if (!command) return this.fail('Unknown action id; use look for current actions', mode);
    let error: string | null;
    try {
      error = validateCommand(this.sim, this.playerId, command, offered);
    } catch {
      error = 'Malformed command';
    }
    if (error) return this.fail(error, mode);
    const before = this.hash,
      at = this.sim.world.time;
    let detail: unknown;
    const interrupts: Interrupt[] = [];
    let warning: string | undefined;
    if (command.kind === 'activity.observe') {
      const o = this.observe(mode),
        d = command.data;
      if (d.query === 'explain') {
        const event = this.sim.world.log.events.find((e) => e.id === Number(d.target));
        if (!event || (mode !== 'god' && !this.known.includes(event.id)))
          return this.fail('No known explanation with that id', mode);
        detail = knownExplain(event.explain, this.playerId, mode);
        if (!detail) return this.fail('That explanation is not known to your character', mode);
      } else if (d.query === 'plan') detail = { ...o.self.provisions.readiness, ...o.self.inventory };
      else if (d.query === 'journal') detail = o.journal;
      else if (d.query === 'inspect') {
        const [kind, id] = (d.target ?? '').split(':');
        detail =
          kind === 'actor'
            ? Number(id) === this.playerId
              ? o.self
              : o.present.find((a) => a.id === Number(id))
            : kind === 'item'
              ? o.self.inventory.carried.find((i) => i.id === Number(id))
              : o.places.find((p) => p.id === Number(id));
      }
    } else if (command.kind === 'activity.wait') {
      const end = command.data.untilTime ?? at + command.data.minutes;
      while (this.sim.world.time < end) {
        const alerts = this.tick([], true);
        interrupts.push(...alerts.filter((a) => a.pause));
        const last = this.metrics.at(-1);
        const recent = this.sim.world.log.events.filter(
          (e) => e.t === (last?.t ?? 0) - 60 && this.known.includes(e.id),
        );
        if (interrupts.length || recent.some((e) => e.kind === command.data.untilEvent)) break;
      }
    } else {
      const start = this.sim.world.log.events.length;
      interrupts.push(...this.tick([command], false).filter((a) => a.pause));
      const recent = this.sim.world.log.events.slice(start);
      const rejected = recent.find((e) => e.kind === 'provisions.command_rejected' && e.data.actorId === this.playerId);
      if (rejected?.kind === 'provisions.command_rejected') warning = rejected.data.reason;
      if (
        command.kind === 'core.urge' &&
        command.data.urge.kind === 'interaction' &&
        !recent.some((e) => e.kind === 'social.interaction' && e.data.initiatorId === this.playerId)
      )
        warning = 'Intention recorded; social has not resolved an interaction (module may still be stubbed).';
    }
    this.entries.push({
      type: 'command',
      command: JSON.parse(JSON.stringify(command)),
      before,
      after: this.hash,
      at,
      end: this.sim.world.time,
    });
    return {
      ok: true,
      ...(warning ? { warning } : {}),
      elapsedMinutes: this.sim.world.time - at,
      interrupts,
      observation: this.observe(mode),
      ...(detail === undefined ? {} : { detail }),
    };
  }
  advance(
    until: number | { time?: number; event?: string; maxMinutes?: number },
    mode: ObservationMode = 'fair',
  ): ActResult {
    return this.act(
      {
        kind: 'activity.wait',
        actorId: this.playerId,
        data:
          typeof until === 'number'
            ? { minutes: until }
            : {
                minutes: until.maxMinutes ?? 1440,
                ...(until.time === undefined ? {} : { untilTime: until.time }),
                ...(until.event === undefined ? {} : { untilEvent: until.event }),
              },
      },
      mode,
    );
  }
  private tick(commands: Command[], idle: boolean): Interrupt[] {
    const { world: w, content: c } = this.sim,
      pc = this.playerId;
    const prior = w.actors[pc]?.placeId;
    const count = w.log.events.length;
    const opinions = Object.values(w.actors).map((a) => ({ id: a.id, op: social.opinionOf(w, a.id, pc) }));
    const before = provisions.readinessOf(w, c, { actorId: pc }, w.time);
    const owned = new Set(
      Object.values(w.items.stacks)
        .filter((s) => {
          const root = items.rootOf(w, s);
          return (
            (root.kind === 'actor' && root.actorId === pc) ||
            (root.kind === 'household' && root.householdId === w.actors[pc]?.householdId)
          );
        })
        .map((s) => s.id),
    );

    // A transactional intention keeps the actor at the counter/table for its hour.
    const actual = [...commands];
    if (
      commands.length &&
      !commands.some((x) => x.kind === 'core.urge') &&
      c.activities.idle_at_home &&
      prior !== undefined
    )
      actual.unshift({
        kind: 'core.urge',
        actorId: pc,
        data: { urge: { kind: 'activity', activityId: 'idle_at_home', placeId: prior } },
      });
    psyche.supplyCommandFallback(w, makeContext(w, c, actual));
    step(this.sim, actual);
    const recent = w.log.events.slice(count);
    let place = prior;
    const seen: Event[] = [];
    for (const e of recent) {
      if (e.kind === 'activity.moved' && e.data.actorId === pc) place = e.data.to;
      const role = e.roles.find((r) => r.actor === pc);
      const own =
        role &&
        ((e.visibility !== 'secret' && e.visibility !== 'inner') || role.role === 'agent' || role.role === 'subject');
      const visible =
        own ||
        (e.visibility === 'public' && e.place !== undefined && e.place === place) ||
        (e.kind === 'activity.moved' &&
          (e.visibility === 'witnessed' || e.visibility === 'public') &&
          e.place === place);
      if (
        visible &&
        e.kind !== 'psyche.defense' &&
        !(e.kind === 'belief.tell' && !e.data.noticed && e.data.targetId !== pc)
      ) {
        this.known.push(e.id);
        seen.push(e);
      }
    }
    const alerts = seen.map((e) =>
      alertFor({
        id: e.id,
        kind: e.kind,
        importance: e.importance,
        participant: e.roles.some((r) => r.actor === pc && r.role !== 'witness'),
        addressed: e.kind === 'social.interaction' && e.data.targetId === pc,
        danger:
          (String(e.kind) === 'core.actor_died' && e.roles.some((r) => r.actor === pc)) ||
          (e.kind === 'social.interaction' &&
            !!c.interactions[e.data.interactionId]?.tags.includes('hostile') &&
            (e.data.targetId === pc || e.data.initiatorId === pc)),
        arrival:
          e.kind === 'activity.moved' && (e.data.actorId === pc || (w.chronicle.notoriety[e.data.actorId] ?? 0) >= 50),
        worseVital:
          e.kind === 'needs.band_changed' &&
          e.data.actorId === pc &&
          (() => {
            const def = c.needs[e.data.needId];
            if (def?.kind !== 'physical') return false;
            if (e.data.layer === 'debt') {
              const threshold = (label: string) => def.debt?.bands.find((b) => b.label === label)?.at_least ?? 0;
              return threshold(e.data.to) > threshold(e.data.from);
            }
            const threshold = (label: string) => def.bands.find((b) => b.label === label)?.below ?? 1001;
            return threshold(e.data.to) < threshold(e.data.from);
          })(),
      }),
    );
    const after = provisions.readinessOf(w, c, { actorId: pc }, w.time);
    const foodAlert = provisionsAlert(
      before.daysOfFoodTenths,
      after.daysOfFoodTenths,
      before.daysOfFuelTenths,
      after.daysOfFuelTenths,
    );
    if (foodAlert) alerts.push(foodAlert);
    this.metrics.push({
      t: w.time,
      mode: 'telemetry',
      purseCents: w.provisions.purses[pc] ?? 0,
      householdCents: w.provisions.households[w.actors[pc]?.householdId ?? 0]?.cashCents ?? 0,
      kcalEaten: recent.reduce(
        (n, e) => n + (e.kind === 'provisions.meal' && e.data.actorId === pc ? e.data.kcal : 0),
        0,
      ),
      kcalBurned: recent.reduce((sum, event) => {
        if (event.kind !== 'needs.changed' || event.data.actorId !== pc) return sum;
        const intake = c.needs[event.data.needId]?.intake;
        if (intake?.unit !== 'kcal') return sum;
        const expenditure = event.explain?.children?.find((child) => child.label === 'Hourly expenditure')?.total ?? 0;
        return sum + expenditure * intake.per_point;
      }, 0),
      spoilageUnits: recent.reduce(
        (n, e) =>
          n +
          ((e.kind === 'provisions.spoiled' || e.kind === 'provisions.vermin') && owned.has(e.data.itemId)
            ? e.data.qty
            : 0),
        0,
      ),
      opinionDeltas: opinions.flatMap(({ id, op }) => {
        const next = social.opinionOf(w, id, pc);
        const delta = {
          actorId: id,
          affection: next.affection - op.affection,
          respect: next.respect - op.respect,
          trust: next.trust - op.trust,
          fear: next.fear - op.fear,
        };
        return Object.values(delta)
          .slice(1)
          .some((x) => x !== 0)
          ? [delta]
          : [];
      }),
      rumorsAboutPC: seen
        .filter(
          (e) =>
            e.kind === 'belief.transmitted' &&
            e.data.listenerId === pc &&
            w.belief.props[e.data.propId]?.args.some((arg) => arg.kind === 'actor' && arg.id === pc),
        )
        .map((e) => e.id),
      defensesTriggered: recent
        .filter((e) => e.kind === 'psyche.defense' && (e.data.actorId === pc || e.data.targetId === pc))
        .map((e) => e.id),
      storyBeats: recent.filter((e) => e.kind === 'chronicle.pattern_matched').map((e) => e.id),
      deaths: seen.filter((e) => String(e.kind) === 'core.actor_died').map((e) => e.id),
      idleMinutes: idle ? 60 : 0,
      decidingMinutes: idle ? 0 : 60,
      decidingTimeBasis: 'simulation',
    });
    return alerts;
  }
  save(): string {
    return JSON.stringify({
      format: 1,
      spec: this.spec,
      contentHash: this.base.meta.hash,
      world: this.sim.world,
      known: this.known,
      entries: this.entries,
      metrics: this.metrics,
      // Retain generated source content so loading does not regenerate a town or run QA.
      ...(typeof this.configuration.source === 'object' ? { generatedContent: this.sim.content } : {}),
    });
  }
  static load(content: ContentBundle, json: string): PlaySession {
    const saved = JSON.parse(json);
    if (saved.format !== 1 || saved.contentHash !== content.meta.hash) throw new Error('Save format/content mismatch');
    const prepared = saved.generatedContent ?? sessionContent(content, saved.spec).content;
    const session = new PlaySession(content, saved.spec, restoreSim(prepared, saved.world));
    if (saved.world.meta.seed !== saved.spec.seed || saved.world.index.actorByKey.play_newcomer !== session.playerId)
      throw new Error('Save world/source mismatch');
    session.sim.world = saved.world;
    session.known = saved.known;
    session.entries = saved.entries;
    session.metrics = saved.metrics;
    return session;
  }
  fork(): PlaySession {
    const copy = new PlaySession(this.base, JSON.parse(JSON.stringify(this.spec)), {
      content: this.sim.content,
      world: JSON.parse(JSON.stringify(this.sim.world)),
    });
    copy.known = [...this.known];
    copy.entries = JSON.parse(JSON.stringify(this.entries));
    copy.metrics = JSON.parse(JSON.stringify(this.metrics));
    return copy;
  }
  static replay(content: ContentBundle, log: ReplayLog, mode: ObservationMode = 'fair'): PlaySession {
    const [header, ...steps] = log;
    if (header.type !== 'session' || header.format !== 1 || header.contentHash !== content.meta.hash)
      throw new Error('Replay content/version mismatch');
    const session = PlaySession.create(content, header.spec);
    for (const entry of steps) {
      if (entry.type !== 'command' || entry.before !== session.hash) throw new Error('Replay diverged before command');
      const result = session.act(entry.command, mode);
      if (!result.ok || session.hash !== entry.after || session.sim.world.time !== entry.end)
        throw new Error('Replay diverged after command');
    }
    return session;
  }
}
export const replay = PlaySession.replay;
