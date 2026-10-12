import {
  type ActorId,
  belief,
  type Command,
  type ContentBundle,
  type Event,
  eventsSince,
  fae,
  items,
  needs,
  provisions,
  restoreSim,
  type Sim,
  social,
  stateHash,
  step,
} from '@coulee/core';
import { GEN_VERSION } from '@coulee/worldgen';
import { availableActions, validateCommand } from './actions.ts';
import { alertForEvent, type Interrupt, perceivedEvents, provisionsAlert } from './interrupts.ts';
import { packKnowledge, unpackKnowledge } from './knowledge.ts';
import {
  eventView,
  type KnownEvent,
  knownExplain,
  type MoneyChange,
  type Observation,
  type ObservationMode,
  observation,
} from './observation.ts';
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
  private knowledge: KnownEvent[] = [];
  private entries: LogStep[] = [];
  private metrics: Metric[] = [];
  private money: MoneyChange[] = [];
  private changes: Observation['changes'] = { elapsed: 0, money: [], needs: [], events: [], skipped: 0 };
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
    return JSON.parse(
      JSON.stringify({
        ...observation(this.sim, this.playerId, this.known, mode, this.knowledge),
        changes: this.changes,
      }),
    ) as ReturnType<typeof observation>;
  }
  private fail(reason: string, mode: ObservationMode): ActResult {
    return {
      ok: false,
      reason,
      elapsedMinutes: 0,
      interrupts: [],
      observation: { ...this.observe(mode), changes: { elapsed: 0, money: [], needs: [], events: [], skipped: 0 } },
    };
  }
  act(input: Command | string, mode: ObservationMode = 'fair'): ActResult {
    const offered = availableActions(this.sim, this.playerId);
    const proposed = typeof input === 'string' ? offered.find((a) => a.id === input)?.command : input;
    const command = proposed ? { ...proposed, issuer: proposed.issuer ?? { kind: 'player' as const } } : undefined;
    if (!command) return this.fail('Unknown action id; use look for current actions', mode);
    let error: string | null;
    try {
      error = validateCommand(this.sim, this.playerId, command, offered);
    } catch {
      error = 'Malformed command';
    }
    if (error) return this.fail(error, mode);
    const socialSave =
      command.kind === 'core.urge' && command.data.urge.kind === 'interaction' ? this.save() : undefined;
    const previous = this.observe(mode);
    const moneyStart = this.money.length,
      knowledgeStart = this.knowledge.length;
    const before = this.hash,
      at = this.sim.world.time;
    let detail: unknown;
    const interrupts: Interrupt[] = [];
    let warning: string | undefined;
    if (command.kind === 'fae.signs') {
      detail = fae.signs(this.sim.world, this.playerId);
    } else if (command.kind === 'activity.observe') {
      const o = this.observe(mode),
        d = command.data;
      if (d.query === 'explain') {
        const retained = this.sim.world.log.events.find((e) => e.id === Number(d.target));
        const event =
          mode === 'god'
            ? (retained ?? this.knowledge.find((e) => e.id === Number(d.target)))
            : (this.knowledge.find((e) => e.id === Number(d.target)) ?? retained);
        if (
          !event ||
          (mode !== 'god' &&
            (!this.known.includes(event.id) ||
              ('data' in event &&
                event.kind === 'belief.tell' &&
                !event.data.noticed &&
                event.data.targetId !== this.playerId)))
        )
          return this.fail('No known explanation with that id', mode);
        detail = knownExplain(event.explain ?? undefined, this.playerId, mode);
        if (!detail) return this.fail('That explanation is not known to your character', mode);
      } else if (d.query === 'look' && d.target === 'prices') detail = { prices: o.store.stock ?? [] };
      else if (d.query === 'plan') detail = { ...o.self.provisions.readiness, ...o.self.inventory };
      else if (d.query === 'journal')
        detail = observation(this.sim, this.playerId, this.known, mode, this.knowledge, 0).journal;
      else if (d.query === 'inspect') {
        const [kind, id] = (d.target ?? '').split(':');
        if (kind === 'actor' && Number(id) !== this.playerId) {
          const person = o.knownPeople.find((a) => a.id === Number(id));
          const opinion = o.self.social.opinions.find((a) => a.targetId === Number(id));
          const target = person?.id;
          const record = target === undefined ? undefined : this.sim.world.social.opinions[this.playerId]?.[target];
          const reasons =
            target === undefined
              ? []
              : social.reasonsOf(this.sim.world, this.playerId, target).map((r) => ({
                  label: r.label,
                  ...social.reasonContribution(this.sim.world, this.playerId, target, r),
                }));
          detail = {
            person,
            opinion,
            base: record?.base,
            volatile: record?.volatile,
            reasons,
            relationships: o.self.social.relationships.filter((r) => r.otherId === target),
            memories: o.self.social.memories.filter((m) => person && m.summary.includes(person.name)),
          };
        } else if (kind === 'item') {
          const item = o.self.inventory.carried.find((i) => i.id === Number(id));
          detail = item ? { item, catalog: this.sim.content.items[item.defId] } : undefined;
        } else detail = kind === 'actor' ? o.self : o.places.find((p) => p.id === Number(id));
      }
    } else if (command.kind === 'activity.wait') {
      const end = command.data.untilTime ?? at + command.data.minutes;
      while (this.sim.world.time < end) {
        const lastId = this.sim.world.log.lastId;
        const alerts = this.tick([], true);
        interrupts.push(...alerts.filter((a) => a.pause));
        const recent = eventsSince(this.sim.world.log, lastId).filter((e) => this.known.includes(e.id));
        if (interrupts.length || recent.some((e) => e.kind === command.data.untilEvent)) break;
      }
    } else {
      const start = this.sim.world.log.lastId;
      interrupts.push(...this.tick([command], false).filter((a) => a.pause));
      const recent = eventsSince(this.sim.world.log, start);
      const rejected = recent.find((e) => e.kind === 'provisions.command_rejected' && e.data.actorId === this.playerId);
      if (rejected?.kind === 'provisions.command_rejected') warning = rejected.data.reason;
      if (command.kind === 'core.urge' && command.data.urge.kind === 'interaction') {
        const urge = command.data.urge;
        const interaction = recent.find(
          (e) =>
            e.kind === 'social.interaction' &&
            e.data.initiatorId === this.playerId &&
            e.data.interactionId === urge.interactionId &&
            (urge.targetId === undefined || e.data.targetId === urge.targetId),
        );
        if (interaction) detail = eventView(interaction, this.playerId, mode);
        else if (socialSave) {
          const reason =
            urge.targetId === undefined
              ? 'No target'
              : social.interactionAvailability(
                  this.sim.world,
                  this.sim.content,
                  this.playerId,
                  urge.targetId,
                  urge.interactionId,
                ).reason;
          const restored = PlaySession.load(this.base, socialSave);
          this.sim = restored.sim;
          this.known = restored.known;
          this.knowledge = restored.knowledge;
          this.metrics = restored.metrics;
          this.money = restored.money;
          this.changes = restored.changes;
          return this.fail(reason ?? 'The conversation cannot take place this hour; no time spent', mode);
        }
      }
    }
    const next = this.observe(mode);
    const recentKnown = this.knowledge.slice(knowledgeStart);
    const background = recentKnown.filter(
      (e) => e.kind === 'social.interaction' && !interrupts.some((i) => i.eventId === e.id),
    );
    this.changes = {
      elapsed: this.sim.world.time - at,
      money: this.money.slice(moneyStart),
      needs: next.self.needs.list.flatMap((n) => {
        const old = previous.self.needs.list.find((p) => p.id === n.id);
        return old?.band !== n.band ? [`${n.name}: ${old?.band || 'steady'} → ${n.band || 'steady'}`] : [];
      }),
      events: recentKnown.filter((e) => interrupts.some((i) => i.eventId === e.id)).map((e) => e.summary),
      skipped: command.kind === 'activity.wait' ? background.length : 0,
    };
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
    const lastId = w.log.lastId;
    // Physiology runs first, using the previous activity. Read the same ledger before stepping.
    const kcalBurned = needs
      .viewNeedsActor(w, c, pc, { perspective: pc, omniscient: false, includeExplain: true, recentChronicle: 0 })
      .list.reduce((sum, n) => {
        const intake = c.needs[n.id]?.intake;
        return (
          sum +
          (intake?.unit === 'kcal'
            ? (n.explain?.children?.find((x) => x.label === 'Hourly expenditure')?.total ?? 0) * intake.per_point
            : 0)
        );
      }, 0);
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

    let purse = w.provisions.purses[pc] ?? 0;
    const householdId = w.actors[pc]?.householdId ?? 0;
    let household = w.provisions.households[householdId]?.cashCents ?? 0;
    this.sim.sink = (event) => {
      const p = w.provisions.purses[pc] ?? 0,
        h = w.provisions.households[householdId]?.cashCents ?? 0;
      if (
        (p !== purse || h !== household) &&
        [
          'provisions.cash_transfer',
          'provisions.purchase',
          'provisions.sale',
          'provisions.wages',
          'provisions.restock',
        ].includes(event.kind)
      ) {
        const reason = event.kind === 'provisions.wages' ? 'Wages' : eventView(event, pc, 'fair').summary;
        this.money.push({ at: event.t, eventId: event.id, purse: p - purse, household: h - household, reason });
        purse = p;
        household = h;
      }
    };
    step(this.sim, actual);
    this.sim.sink = undefined;
    const recent = eventsSince(w.log, lastId);
    // Perception and alert classification are shared with the web worker (ADR 0002 §3).
    const seen: Event[] = perceivedEvents(recent, pc, prior);
    for (const e of seen) {
      this.known.push(e.id);
      if (!['needs.changed', 'core.command', 'provisions.water'].includes(e.kind))
        this.knowledge.push({
          ...eventView(e, pc, 'fair'),
          ...(e.kind === 'belief.transmitted'
            ? { summary: `${e.data.listenerId === pc ? 'Heard' : 'Told'}: ${belief.propText(w, c, e.data.propId)}` }
            : {}),
        });
    }
    const alerts = seen.map((e) => alertForEvent(w, c, pc, e));
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
      kcalBurned,
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
      knowledgeArchive: packKnowledge(this.knowledge),
      entries: this.entries,
      metrics: this.metrics,
      money: this.money,
      changes: this.changes,
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
    session.knowledge =
      (saved.knowledgeArchive ? unpackKnowledge(saved.knowledgeArchive) : saved.knowledge) ??
      saved.world.log.events
        .filter(
          (e: Event) =>
            saved.known.includes(e.id) &&
            e.kind !== 'psyche.defense' &&
            !(e.kind === 'belief.tell' && !e.data.noticed && e.data.targetId !== session.playerId),
        )
        .map((e: Event) => eventView(e, session.playerId, 'fair'));
    session.entries = saved.entries;
    session.metrics = saved.metrics;
    session.money = saved.money ?? [];
    session.changes = saved.changes ?? session.changes;
    return session;
  }
  fork(): PlaySession {
    const copy = new PlaySession(this.base, JSON.parse(JSON.stringify(this.spec)), {
      content: this.sim.content,
      world: JSON.parse(JSON.stringify(this.sim.world)),
    });
    copy.known = [...this.known];
    copy.knowledge = JSON.parse(JSON.stringify(this.knowledge));
    copy.entries = JSON.parse(JSON.stringify(this.entries));
    copy.metrics = JSON.parse(JSON.stringify(this.metrics));
    copy.money = JSON.parse(JSON.stringify(this.money));
    copy.changes = JSON.parse(JSON.stringify(this.changes));
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
