import {
  type ActorId,
  activity,
  admitScriptedScene,
  advanceUntil,
  asGameMinute,
  belief,
  CLOCK_VERSION,
  type Command,
  type ContentBundle,
  type Event,
  eventsSince,
  fae,
  hashValue,
  instantOf,
  items,
  makeContext,
  needs,
  provisions,
  psyche,
  restoreSim,
  type Sim,
  social,
  stateHash,
  step,
  TICKS_PER_HOUR,
  TICKS_PER_MINUTE,
  tactical,
  timeView,
} from '@coulee/core';
import { GEN_VERSION } from '@coulee/worldgen';
import { availableActions, validateCommand } from './actions.ts';
import { moneyReason } from './describe.ts';
import { addressedToPC, alertForEvent, type Interrupt, perceivedEvents, provisionsAlert } from './interrupts.ts';
import { packKnowledge, unpackKnowledge } from './knowledge.ts';
import { shortMinutes } from './minutes.ts';
import { claimsOf, claimText, obligationsOf, obligationText } from './obligations.ts';
import {
  eventView,
  type KnownEvent,
  knownExplain,
  type MoneyChange,
  type Observation,
  type ObservationMode,
  observation,
} from './observation.ts';
import { type RoutePreview, routePreviewOf } from './route.ts';
import { type SessionSpec, sessionContent, sessionSim } from './source.ts';
import { regardOf } from './view.ts';
export interface LogStep {
  type: 'command';
  command: Command;
  before: string;
  after: string;
  at: number;
  end: number;
  atInstant?: number;
  endInstant?: number;
  atMinute?: number;
  endMinute?: number;
  seq?: number;
}
export interface LogHeader {
  type: 'session';
  format: 1;
  spec: SessionSpec;
  contentHash: string;
  clockVersion?: number;
  engineVersion?: string;
  rulesVersion?: number;
  sourceHash?: string;
  /** Additive: a forked story (its fair ending keeps the omniscient epilogue to itself). */
  branched?: boolean;
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
/** A wait that ended before the hour the player named: when, what was wanted, and why. */
export interface WaitStopped {
  at: number;
  wanted: number | null;
  reasons: string[];
}
export interface ActResult {
  ok: boolean;
  reason?: string;
  warning?: string;
  /** A plain confirmation of what the command did, when the world's events do not say it. */
  notice?: string;
  /** Set when a wait stopped early. */
  stopped?: WaitStopped;
  elapsedMinutes: number;
  elapsedTicks?: number;
  interrupts: Interrupt[];
  observation: ReturnType<PlaySession['observe']>;
  detail?: unknown;
  routePreview?: RoutePreview;
}
export class PlaySession {
  private sim: Sim;
  private known: number[] = [];
  private knowledge: KnownEvent[] = [];
  private entries: LogStep[] = [];
  private metrics: Metric[] = [];
  private money: MoneyChange[] = [];
  private changes: Observation['changes'] = { elapsed: 0, money: [], needs: [], events: [], skipped: 0 };
  /** Said or done to her during the current order that asked nothing of her (the digest). */
  private addressed: string[] = [];
  /**
   * This story has been forked (or is a fork): a fair ending then keeps "what the county never
   * knew" to itself, or a fork could read it and play on in the original (playtest r2).
   */
  private branched = false;
  private base: ContentBundle;
  private configuration: SessionSpec;
  get spec(): SessionSpec {
    return JSON.parse(JSON.stringify(this.configuration));
  }
  private constructor(base: ContentBundle, spec: SessionSpec, sim?: Sim) {
    this.base = base;
    this.configuration = spec;
    this.sim = sim ?? sessionSim(base, spec);
    if (!sim && admitScriptedScene(this.sim)) {
      const w = this.sim.world;
      const initial = perceivedEvents(w.log.events, this.playerId, w.actors[this.playerId]?.placeId);
      this.known = initial.map((e) => e.id);
      this.knowledge = initial
        .filter((e) => e.kind !== 'core.command')
        .map((e) => eventView(e, this.playerId, 'fair', this.sim));
    }
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
        {
          type: 'session',
          format: 1,
          spec: this.spec,
          contentHash: this.base.meta.hash,
          clockVersion: CLOCK_VERSION,
          engineVersion: 'm6-r3',
          rulesVersion: 4,
          sourceHash: hashValue(this.spec),
          ...(this.branched ? { branched: true } : {}),
        },
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
        ...observation(
          this.sim,
          this.playerId,
          this.known,
          mode,
          this.knowledge,
          12,
          this.branched ? 'fair' : 'omniscient',
        ),
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
      observation: {
        ...this.observe(mode),
        changes: { elapsed: 0, money: [], needs: [], events: [], skipped: 0 },
        events: [],
        said: [],
      },
    };
  }
  act(input: Command | string, mode: ObservationMode = 'fair'): ActResult {
    const offered = availableActions(this.sim, this.playerId);
    let proposed = typeof input === 'string' ? offered.find((a) => a.id === input)?.command : input;
    if (
      proposed?.kind === 'core.urge' &&
      proposed.data?.urge?.kind === 'interaction' &&
      proposed.data.urge.interactionId === 'fight' &&
      proposed.data.urge.targetId !== undefined
    )
      proposed = {
        kind: 'tactical.attack',
        actorId: proposed.actorId,
        issuer: proposed.issuer,
        data: { targetId: proposed.data.urge.targetId },
      };
    const command = proposed ? { ...proposed, issuer: proposed.issuer ?? { kind: 'player' as const } } : undefined;
    if (!command) return this.fail('Unknown action id; use look for current actions', mode);
    let error: string | null;
    try {
      error = validateCommand(this.sim, this.playerId, command, offered);
    } catch {
      error = 'Malformed command';
    }
    if (error) return this.fail(error, mode);
    if (command.kind.startsWith('tactical.') || (command.kind === 'activity.wait' && this.sim.world.tactical))
      return this.actAtInstant(command, mode);
    // Settings take no game time (playtest r2): the order is logged and applied at once, through
    // the same setters the systems use, so a replay applies it identically.
    if (command.kind === 'core.standing_orders' || command.kind === 'provisions.set_rations')
      return this.settle(command, mode);
    const socialSave =
      command.kind === 'core.urge' && command.data.urge.kind === 'interaction' ? this.save() : undefined;
    // A charm Command refused by its executor costs nothing (13 §7.2): roll the hour back.
    const charmSave =
      command.kind.startsWith('fae.') && command.kind !== 'fae.signs' && command.kind !== 'fae.investigate'
        ? this.save()
        : undefined;
    const previous = this.observe(mode);
    this.addressed = [];
    const moneyStart = this.money.length,
      knowledgeStart = this.knowledge.length;
    const before = this.hash,
      at = this.sim.world.time;
    const atMinute = this.sim.world.backgroundTactical ? 0 : activity.minuteBudget(this.sim.world, this.playerId).spent;
    let detail: unknown;
    let routePreview: RoutePreview | undefined;
    const interrupts: Interrupt[] = [];
    let warning: string | undefined;
    let notice: string | undefined;
    let stopped: WaitStopped | undefined;
    if (command.kind === 'fae.signs') {
      const list = fae.signs(this.sim.world, this.playerId);
      detail = list.length
        ? list
        : 'No signs or wonders yet. Strange things you notice, or hear of, are listed here until you settle them or they fade.';
    } else if (command.kind === 'activity.observe') {
      const o = this.observe(mode),
        d = command.data;
      if (d.query === 'route') {
        const edgeIds = activity.routeTo(this.sim.world, this.playerId, d.target ?? '');
        detail = edgeIds
          ? provisions.tripReadiness(this.sim.world, this.sim.content, this.playerId, {
              destinationNodeId: d.target ?? '',
              edgeIds,
              pace: 'walk',
              campPolicy: 'ask',
            })
          : 'No known route from here';
        if (edgeIds && typeof detail !== 'string')
          routePreview = routePreviewOf(
            this.sim,
            this.playerId,
            d.target ?? '',
            edgeIds,
            detail as provisions.TripReadiness,
          );
      } else if (d.query === 'explain') {
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
          return this.fail(NO_EXPLANATION, mode);
        detail = knownExplain(event.explain ?? undefined, this.playerId, mode);
        // One refusal for a secret and a missing id alike: a different answer would be an oracle.
        if (!detail) return this.fail(NO_EXPLANATION, mode);
      } else if (d.query === 'look' && /^prices(:.*)?$/.test(d.target ?? '')) {
        // `prices`, `prices 2` (a page), `prices bacon` (a filter): the counter's stock, a page at a time.
        const arg = (d.target ?? '').slice('prices:'.length);
        detail = {
          prices: o.store.stock ?? [],
          freight: o.store.freight,
          ...(/^\d+$/.test(arg) ? { page: Number(arg) } : arg ? { filter: arg } : {}),
        };
      } else if (d.query === 'plan')
        detail = {
          ...o.self.provisions.readiness,
          ...o.self.inventory,
          survival: o.self.needs.survival,
          // Kit warnings and survival warnings are both shown; neither hides the other.
          warnings: [...(o.self.needs.warnings ?? []), ...o.self.provisions.readiness.warnings],
          pantry: o.self.pantry,
        };
      else if (d.query === 'journal') {
        const entries = observation(this.sim, this.playerId, this.known, mode, this.knowledge, 0).journal;
        // Open debts close the journal as obligations with their due dates.
        const owed = obligationsOf(this.sim.world, this.sim.content, this.playerId);
        // ...and what others owe her (playtest r2: favors and loans never showed in the list).
        const claims = claimsOf(this.sim.world, this.playerId, this.sim.content);
        detail = [
          ...entries,
          ...owed.map((o, i) => ({
            id: -1 - i,
            t: o.since,
            stamp: o.kind === 'favor' ? 'Owed:' : timeView(o.since).stamp,
            voice: 'journal',
            headline: null,
            text: obligationText(o),
            importance: 0,
            actorIds: [o.creditorId],
            pattern: null,
            knowledge: 'self',
          })),
          ...claims.map((c, i) => ({
            id: -1 - owed.length - i,
            t: c.since,
            stamp: 'Owed to you:',
            voice: 'journal',
            headline: null,
            text: claimText(c),
            importance: 0,
            actorIds: [c.debtorId],
            pattern: null,
            knowledge: 'self',
          })),
        ];
      } else if (d.query === 'inspect') {
        const [kind, id] = (d.target ?? '').split(':');
        if (kind === 'actor' && Number(id) === this.playerId) {
          // Herself, in words (playtest r2: a 1,400-line JSON dump).
          const me = o.self;
          detail = {
            selfSummary: {
              name: me.name,
              people: this.sim.content.peoples[this.sim.world.actors[this.playerId]?.presentsAsId ?? '']?.name ?? '',
              doing: me.activity.verb,
              place: o.place.name,
              lodging: me.lodging?.name ?? null,
              agencyMode: me.agencyMode,
              orders: me.standingOrders,
              rationPct: this.sim.world.provisions.nutrition[this.playerId]?.rationPct ?? 100,
              vitals: me.needs.list
                .filter((n) => n.kind === 'physical' && (n.id !== 'drink' || n.band))
                .map((n) => `${n.name} ${n.value}${n.band ? ` (${n.band})` : ''}`),
              mind: me.needs.list.filter((n) => n.kind !== 'physical' && n.band).map((n) => `${n.name}: ${n.band}`),
              conditions: me.needs.survival?.conditions ?? [],
              purseCents: me.provisions.purseCents,
              householdCents: me.provisions.householdCents,
              load: `${me.inventory.loadBand}, ${(me.inventory.totalWeightG / 1000).toFixed(1)} kg`,
              obligations: me.obligations.map((x) => obligationText(x)),
              claims: claimsOf(this.sim.world, this.playerId, this.sim.content).map((x) => claimText(x)),
              ties: me.social.relationships.map((r) => r.label),
              known: social.acquaintancesOf(this.sim.world, this.playerId).length,
            },
          };
        } else if (kind === 'actor') {
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
          const owe = o.self.obligations.filter((x) => x.creditorId === target).map((x) => obligationText(x));
          const owed = claimsOf(this.sim.world, this.playerId, this.sim.content)
            .filter((x) => x.debtorId === target)
            .map((x) => claimText(x));
          detail = {
            person,
            ...(target === undefined
              ? {}
              : {
                  regard: regardOf(
                    this.sim.world,
                    this.sim.content,
                    this.playerId,
                    target,
                    mode === 'god',
                    this.knowledge,
                  ),
                }),
            opinion,
            base: record?.base,
            volatile: record?.volatile,
            reasons,
            relationships: o.self.social.relationships.filter((r) => r.otherId === target),
            memories: o.self.social.memories.filter((m) => person && m.summary.includes(person.name)),
            // Additive (playtest r2): met or not, how well, and what lies between you.
            acquainted: record !== undefined,
            familiarity: record?.familiarity ?? 0,
            between: [...owe, ...owed],
          };
        } else if (kind === 'item') {
          const item = o.self.inventory.carried.find((i) => i.id === Number(id));
          detail = item ? { item, catalog: this.sim.content.items[item.defId] } : undefined;
          if (!item) return this.fail('That is not in your pack', mode);
        } else detail = o.places.find((p) => p.id === Number(id));
      }
    } else if (command.kind === 'activity.wait') {
      const end =
        command.data.untilTime ??
        (this.sim.world.backgroundTactical ? Math.floor(at / 60) * 60 : at) + command.data.minutes;
      let event: string | undefined;
      while (this.sim.world.time < end) {
        const lastId = this.sim.world.log.lastId;
        const alerts = this.tick([], true);
        interrupts.push(...alerts.filter((a) => a.pause));
        const recent = eventsSince(this.sim.world.log, lastId).filter((e) => this.known.includes(e.id));
        const awaited = recent.find((e) => e.kind === command.data.untilEvent);
        if (awaited) event = this.knowledge.find((k) => k.id === awaited.id)?.summary;
        if (this.sim.world.needs.byActor[this.playerId]?.survival?.ending || interrupts.length || awaited) break;
      }
      // A stop always says why (playtest r2: stops with no reason, and a 24-hour stop unexplained).
      if (this.sim.world.time < end)
        stopped = {
          at: this.sim.world.time,
          wanted: end,
          reasons: interrupts.length
            ? [...new Set(interrupts.map((i) => i.reason))]
            : this.sim.world.needs.byActor[this.playerId]?.survival?.ending
              ? ['your life has ended']
              : [event ?? 'what you were waiting for happened'],
        };
    } else {
      const start = this.sim.world.log.lastId;
      const urge = command.kind === 'core.urge' && command.data.urge.kind === 'activity' ? command.data.urge : null;
      const bedDef = urge ? this.sim.content.activities[urge.activityId] : undefined;
      // Out on open ground with nothing to sleep in, a bed means the walk back to her lodgings.
      if (bedDef?.asleep && bedDef.at === 'home' && previous.self.camp.afield && !previous.self.camp.bedding)
        notice = 'You carry nothing to sleep in out here, so you head back to your lodgings.';
      interrupts.push(
        ...this.tick([command], false, shortMinutes(this.sim, command) ?? undefined).filter((a) => a.pause),
      );
      const recent = eventsSince(this.sim.world.log, start);
      const rejected = recent.find(
        (e) =>
          (e.kind === 'provisions.command_rejected' || e.kind === 'needs.command_rejected') &&
          e.data.actorId === this.playerId,
      );
      if (rejected?.kind === 'provisions.command_rejected' || rejected?.kind === 'needs.command_rejected')
        warning = rejected.data.reason;
      else if (command.kind === 'provisions.pack') {
        const name = (id: number) => {
          const stack = this.sim.world.items.stacks[id as never];
          return stack ? (this.sim.content.items[stack.defId]?.name ?? 'item') : 'item';
        };
        const d = command.data;
        notice = `Moved ${d.qty} of your ${name(d.itemId)} ${d.intoItemId === null ? 'out of its container' : `into the ${name(d.intoItemId)}`}.`;
      }
      const charmRefusal = recent.find((e) => e.kind === 'fae.charm_refused' && e.data.actorId === this.playerId);
      if (charmSave && charmRefusal?.kind === 'fae.charm_refused') {
        const restored = PlaySession.load(this.base, charmSave);
        this.sim = restored.sim;
        this.known = restored.known;
        this.knowledge = restored.knowledge;
        this.metrics = restored.metrics;
        this.money = restored.money;
        this.changes = restored.changes;
        return this.fail(charmRefusal.data.reason, mode);
      }
      // A fae Command's own result is what the player asked for: show it (r2 playtest #7: an
      // investigation "printed nothing").
      if (command.kind.startsWith('fae.')) {
        const own = recent.find(
          (e) =>
            (e.kind === 'fae.investigated' && e.data.actorId === this.playerId) ||
            (e.kind === 'fae.refused' && e.data.actorId === this.playerId) ||
            (e.kind === 'fae.charm_tended' && e.data.actorId === this.playerId) ||
            (e.kind === 'fae.charm_revealed' && e.data.actorId === this.playerId) ||
            (e.kind === 'fae.charm_disposed' && e.data.actorId === this.playerId) ||
            (e.kind === 'fae.charm_arrived' && e.data.finderId === this.playerId) ||
            (e.kind === 'fae.stock_counted' && e.data.actorId === this.playerId) ||
            (e.kind === 'fae.shortfall' && e.data.actorId === this.playerId),
        );
        if (own) detail = eventView(own, this.playerId, mode, { world: this.sim.world, content: this.sim.content });
      }
      if (command.kind === 'core.urge' && command.data.urge.kind === 'interaction') {
        const urge = command.data.urge;
        const interaction = recent.find(
          (e) =>
            e.kind === 'social.interaction' &&
            e.data.initiatorId === this.playerId &&
            e.data.interactionId === urge.interactionId &&
            (urge.targetId === undefined || e.data.targetId === urge.targetId),
        );
        if (interaction)
          detail = eventView(interaction, this.playerId, mode, { world: this.sim.world, content: this.sim.content });
        else if (
          socialSave &&
          needs.canAct(this.sim.world, this.playerId) &&
          !recent.some((e) => e.kind === 'social.requested' && e.data.from === this.playerId)
        ) {
          const itemRefusal = recent.find((e) => e.kind === 'social.item_refused' && e.data.actorId === this.playerId);
          const reason =
            itemRefusal?.kind === 'social.item_refused'
              ? itemRefusal.data.reason
              : urge.targetId === undefined
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
      elapsed:
        this.sim.world.time -
        at +
        (this.sim.world.backgroundTactical ? 0 : activity.minuteBudget(this.sim.world, this.playerId).spent) -
        atMinute,
      money: this.money.slice(moneyStart),
      needs: next.self.needs.list.flatMap((n) => {
        const old = previous.self.needs.list.find((p) => p.id === n.id);
        return old?.band !== n.band ? [`${n.name}: ${old?.band || 'steady'} → ${n.band || 'steady'}`] : [];
      }),
      events: recentKnown.filter((e) => interrupts.some((i) => i.eventId === e.id)).map((e) => e.summary),
      skipped: command.kind === 'activity.wait' ? background.length : 0,
      ...(this.addressed.length ? { addressed: [...this.addressed] } : {}),
    };
    this.entries.push({
      type: 'command',
      command: JSON.parse(JSON.stringify(command)),
      before,
      after: this.hash,
      at,
      end: this.sim.world.time,
      atMinute,
      endMinute: this.sim.world.backgroundTactical ? 0 : activity.minuteBudget(this.sim.world, this.playerId).spent,
    });
    return {
      ok: true,
      ...(warning ? { warning } : {}),
      ...(notice ? { notice } : {}),
      ...(stopped ? { stopped } : {}),
      elapsedMinutes:
        this.sim.world.time -
        at +
        (this.sim.world.backgroundTactical ? 0 : activity.minuteBudget(this.sim.world, this.playerId).spent) -
        atMinute,
      interrupts,
      observation: this.observe(mode),
      ...(detail === undefined ? {} : { detail }),
      ...(routePreview ? { routePreview } : {}),
    };
  }
  /** Same atomic driver and interrupt callback for CLI and worker. */
  private actAtInstant(command: Command, mode: ObservationMode): ActResult {
    const w = this.sim.world,
      pc = this.playerId;
    const before = this.hash,
      start =
        instantOf(w) +
        (!w.tactical && !w.backgroundTactical ? activity.minuteBudget(w, pc).spent * TICKS_PER_MINUTE : 0),
      at = Math.floor(start / TICKS_PER_MINUTE);
    const ticks =
      command.kind === 'tactical.advance'
        ? command.data.ticks
        : command.kind === 'activity.wait'
          ? this.entries.length === 0 && w.tactical?.enteredAt === start
            ? 0
            : command.data.minutes * TICKS_PER_MINUTE
          : 0;
    const interrupts: Interrupt[] = [];
    const prior = w.actors[pc]?.placeId;
    const seenIds = new Set<number>();
    const receive = (events: Event[]): boolean => {
      for (const e of perceivedEvents(events, pc, prior)) {
        if (seenIds.has(e.id)) continue;
        seenIds.add(e.id);
        this.known.push(e.id);
        if (e.kind !== 'core.command')
          this.knowledge.push(eventView(e, pc, 'fair', { world: w, content: this.sim.content }));
        const alert = alertForEvent(w, this.sim.content, pc, e);
        if (alert.pause) interrupts.push(alert);
      }
      return interrupts.length > 0;
    };
    const last = w.log.lastId;
    let retired = false;
    const receiveAndRetire = (events: Event[]): boolean => {
      const pause = receive(events);
      const deadline = tactical.quietDeadline(w, pc);
      if (
        deadline !== null &&
        instantOf(w) >= deadline &&
        !tactical.tacticalCommandCheck(w, this.sim.content, { kind: 'tactical.breathe', actorId: pc, data: {} })
      ) {
        tactical.commandTactical(w, makeContext(w, this.sim.content, [], this.sim.sink), {
          kind: 'tactical.breathe',
          actorId: pc,
          data: {},
          issuer: command.issuer,
        });
        retired = true;
      }
      return pause || retired;
    };
    const result = advanceUntil(this.sim, start + ticks, [command], receiveAndRetire, () =>
      tactical.quietDeadline(w, pc),
    );
    receive(eventsSince(w.log, last));
    if (ticks === 0 && this.entries.length === 0) receive(w.log.events.filter((e) => e.kind === 'tactical.danger'));
    this.changes = {
      elapsed: w.time - at,
      elapsedTicks: result.elapsedTicks,
      money: [],
      needs: [],
      events: interrupts.map((i) => i.reason),
      skipped: 0,
    };
    this.entries.push({
      type: 'command',
      command: JSON.parse(JSON.stringify(command)),
      before,
      after: this.hash,
      at,
      end: w.time,
      atInstant: start,
      endInstant: instantOf(w),
      seq: this.entries.length + 1,
    });
    return {
      ok: true,
      elapsedMinutes: w.time - at,
      elapsedTicks: result.elapsedTicks,
      interrupts,
      observation: this.observe(mode),
      ...(retired
        ? { notice: 'The brawl has let go. Ordinary time resumes from this instant.' }
        : result.interrupted
          ? { notice: `Paused at ${this.observe(mode).tactical?.clock ?? 'the hour boundary'}.` }
          : command.kind === 'tactical.breathe'
            ? { notice: 'You take a breath. Ordinary time resumes from this instant.' }
            : {}),
    };
  }
  /** Apply a settings order (standing orders, agency, rations) now, in no game time. */
  private settle(command: Command, mode: ObservationMode): ActResult {
    const w = this.sim.world,
      pc = this.playerId;
    const before = this.hash,
      at = w.time;
    let notice: string;
    if (command.kind === 'core.standing_orders') {
      const was = { mode: psyche.agencyMode(w, pc), orders: psyche.standingOrders(w, pc) };
      psyche.applyStandingOrders(w, pc, command.data);
      notice = ordersChange(was, { mode: psyche.agencyMode(w, pc), orders: psyche.standingOrders(w, pc) });
    } else if (command.kind === 'provisions.set_rations') {
      const was = w.provisions.nutrition[pc]?.rationPct ?? 100;
      const refused = provisions.applyRations(w, pc, command.data.householdId, command.data.rationPct);
      if (refused) return this.fail(refused, mode);
      notice = `Rations set to ${command.data.rationPct}% (they were ${was}%).`;
    } else return this.fail('Not a setting', mode);
    this.changes = { elapsed: 0, money: [], needs: [], events: [], skipped: 0 };
    this.entries.push({
      type: 'command',
      command: JSON.parse(JSON.stringify(command)),
      before,
      after: this.hash,
      at,
      end: at,
      ...(w.tactical ? { atInstant: instantOf(w), endInstant: instantOf(w), seq: this.entries.length + 1 } : {}),
    });
    return { ok: true, notice, elapsedMinutes: 0, interrupts: [], observation: this.observe(mode) };
  }
  /** Mark this story as branched (forked from, or a fork): its fair ending withholds the omniscient epilogue. */
  markBranched(): void {
    this.branched = true;
  }
  get isBranched(): boolean {
    return this.branched;
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
  private tick(commands: Command[], idle: boolean, minutes?: number): Interrupt[] {
    const { world: w, content: c } = this.sim,
      pc = this.playerId;
    const prior = w.actors[pc]?.placeId;
    const lastId = w.log.lastId;
    const spentBefore = activity.minuteBudget(w, pc).spent;
    if (minutes === undefined) {
      const urge = commands.find((c) => c.kind === 'core.urge');
      const remaining =
        urge?.kind === 'core.urge' && urge.data.urge.kind === 'activity' ? urge.data.urge.activityId : undefined;
      activity.settleMinuteActivity(w, pc, remaining);
    }
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

    // A transactional intention keeps the actor at the counter/table while it resolves.
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
        const reason = moneyReason(w, c, pc, event);
        this.money.push({ at: event.t, eventId: event.id, purse: p - purse, household: h - household, reason });
        purse = p;
        household = h;
      }
    };
    if (minutes === undefined) {
      if (w.backgroundTactical)
        advanceUntil(this.sim, (Math.floor(instantOf(w) / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR, actual);
      else step(this.sim, actual);
      activity.clearMinuteBudget(w, pc);
    } else {
      const ctx = makeContext(w, c, actual, this.sim.sink);
      // Different sub-hour orders draw independently, while cooldowns/calendar stay hourly.
      const shortCtx = {
        ...ctx,
        rng: (stream: Parameters<typeof ctx.rng>[0], key: number) =>
          ctx.rngAt?.(stream, asGameMinute(Math.floor(w.time / 60) * 60 + spentBefore + 1), key) ??
          ctx.rng(stream, key),
      };
      for (const command of ctx.commands)
        ctx.emit({
          kind: 'core.command',
          roles: [{ actor: command.actorId, role: 'agent' }],
          visibility: 'private',
          data: { command },
        });
      const command = commands[0];
      const walk =
        command?.kind === 'core.urge' && command.data.urge.kind === 'activity' ? command.data.urge.placeId : undefined;
      // A short order wakes the actor and leaves them at leisure at their destination.
      psyche.arbitrateShortCommand(w, shortCtx, pc, minutes);
      activity.shortAct(w, shortCtx, pc, minutes, walk);
      if (command?.kind === 'core.urge' && command.data.urge.kind === 'interaction')
        social.executeSocialCommand(w, shortCtx, pc);
      provisions.executeProvisionCommands(w, shortCtx);
      if (w.backgroundTactical) {
        activity.clearMinuteBudget(w, pc);
        advanceUntil(this.sim, instantOf(w) + minutes * TICKS_PER_MINUTE);
      } else
        activity.spendMinutes(w, pc, Math.min(minutes, 60 - spentBefore), walk === undefined ? 'idle_at_home' : 'walk');
    }
    this.sim.sink = undefined;
    const recent = eventsSince(w.log, lastId);
    // Perception and alert classification are shared with the web worker (ADR 0002 §3).
    const seen: Event[] = perceivedEvents(recent, pc, prior);
    for (const e of seen) {
      this.known.push(e.id);
      if (!['needs.changed', 'core.command', 'provisions.water'].includes(e.kind)) {
        const view = {
          ...eventView(e, pc, 'fair', { world: w, content: c }),
          ...(e.kind === 'belief.transmitted'
            ? { summary: `${e.data.listenerId === pc ? 'Heard' : 'Told'}: ${belief.propText(w, c, e.data.propId)}` }
            : {}),
        };
        this.knowledge.push(view);
        // Said or done to her, asking nothing: the digest, never a stop (playtest r2).
        if (addressedToPC(c, pc, e)) this.addressed.push(view.summary);
      }
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
      kcalBurned: minutes === undefined ? kcalBurned : 0,
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
      deaths: seen.filter((e) => e.kind === 'needs.died').map((e) => e.id),
      idleMinutes: idle ? 60 - spentBefore : 0,
      decidingMinutes: idle ? 0 : (minutes ?? 60 - spentBefore),
      decidingTimeBasis: 'simulation',
    });
    if (minutes !== undefined && !w.backgroundTactical && spentBefore + minutes >= 60) {
      alerts.push(...this.tick([], false));
      const carried = spentBefore + minutes - 60;
      if (carried > 0) {
        const command = commands[0];
        const walking = command?.kind === 'core.urge' && command.data.urge.kind === 'activity';
        activity.spendMinutes(w, pc, carried, walking ? 'walk' : 'idle_at_home');
      }
    }
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
      ...(this.branched ? { branched: true } : {}),
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
        .map((e: Event) =>
          eventView(e, session.playerId, 'fair', { world: session.sim.world, content: session.sim.content }),
        );
    // Older archives may contain the former exact-label and check-label disclosures.
    const privateLabels = new Set(
      session.knowledge
        .filter((event) => event.kind === 'social.label_changed' && !event.summary.startsWith('You now think'))
        .map((event) => event.id),
    );
    session.known = session.known.filter((id) => !privateLabels.has(id));
    session.knowledge = session.knowledge
      .filter((event) => !privateLabels.has(event.id))
      .map((event) => ({
        ...event,
        explain: knownExplain(event.explain ?? undefined, session.playerId, 'fair'),
      }));
    session.entries = saved.entries;
    session.metrics = saved.metrics;
    session.money = saved.money ?? [];
    session.changes = saved.changes ?? session.changes;
    session.branched = saved.branched === true;
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
    // Both lines of a forked story are branched: neither may read the other's omniscient ending.
    this.branched = true;
    copy.branched = true;
    return copy;
  }
  static replay(content: ContentBundle, log: ReplayLog, mode: ObservationMode = 'fair'): PlaySession {
    const [header, ...steps] = log;
    if (header.rulesVersion !== undefined && header.rulesVersion !== 4)
      throw new Error('Unsupported replay rules version');
    if (header.sourceHash !== undefined && header.sourceHash !== hashValue(header.spec))
      throw new Error('Replay source mismatch');
    if (header.clockVersion !== undefined && header.clockVersion !== CLOCK_VERSION)
      throw new Error('Unsupported replay clock version');
    if (header.type !== 'session' || header.format !== 1 || header.contentHash !== content.meta.hash)
      throw new Error('Replay content/version mismatch');
    const session = PlaySession.create(content, header.spec);
    if (header.branched) session.branched = true;
    for (const entry of steps) {
      if (entry.type !== 'command' || entry.before !== session.hash) throw new Error('Replay diverged before command');
      const result = session.act(entry.command, mode);
      if (
        !result.ok ||
        session.hash !== entry.after ||
        session.sim.world.time !== entry.end ||
        (entry.endInstant !== undefined && instantOf(session.sim.world) !== entry.endInstant) ||
        (entry.endMinute !== undefined &&
          (session.sim.world.backgroundTactical
            ? 0
            : activity.minuteBudget(session.sim.world, session.playerId).spent) !== entry.endMinute)
      )
        throw new Error('Replay diverged after command');
    }
    return session;
  }
}
export const replay = PlaySession.replay;

/** The one answer to `explain` for an id she cannot read, whether it is secret or does not exist. */
export const NO_EXPLANATION = 'No explanation you know of has that id';

/** "Standing orders: sleep on, eat OFF (was on)…; agency commanded." What a settings order changed. */
export function ordersChange(
  was: { mode: string; orders: psyche.StandingOrders },
  now: { mode: string; orders: psyche.StandingOrders },
): string {
  const keys = ['sleep', 'eat', 'drink', 'warmth', 'lodging'] as const;
  const changed = keys.filter((k) => was.orders[k] !== now.orders[k]);
  const list = keys.map((k) => `${k} ${now.orders[k] ? 'on' : 'off'}`).join(', ');
  const what =
    changed.length || was.mode !== now.mode
      ? `Changed: ${[
          ...changed.map((k) => `${k} ${now.orders[k] ? 'on' : 'off'}`),
          ...(was.mode !== now.mode ? [`agency ${now.mode}`] : []),
        ].join(', ')}.`
      : 'Nothing changed.';
  return `${what} Standing orders now: ${list}; agency ${now.mode}.`;
}
