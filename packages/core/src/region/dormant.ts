/** Separate monthly settlement owner. T2's physical/decision executor is unchanged. */
import { dormantProduction, resumeDormantActor } from '../activity/api.ts';
import { formGrudge, internProp, observe } from '../belief/api.ts';
import { type ActorId, idsOf, rowsOf } from '../ids.ts';
import { regionalInventories, withInventoryPass } from '../items/api.ts';
import { dormantNeeds, dormantSurvivalHour, recordRegionalDeath } from '../needs/api.ts';
import {
  dormantHouseholdMeal,
  dormantNutritionDay,
  dormantPantries,
  finishDormantMeals,
  transferCash,
} from '../provisions/api.ts';
import { authorizeAct, dormantThoughtDecay } from '../psyche/api.ts';
import { hashString32, mixKey, rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { changeRegionalHousehold, installRegionalBirth } from '../sim/population.ts';
import {
  addMemory,
  areKin,
  decayMemorySnapshot,
  dormantMarriage,
  dormantSocialDecay,
  eligible,
  makePair,
  memoryDecayPolicy,
  opinionOf,
  settleRegionalDebt,
} from '../social/api.ts';
import { asGameMinute, calendarAt, yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { ensureCensus } from './census.ts';
import { settleDailySites } from './coarse.ts';
import { DORMANT_POLICY, type DormantFact, type DormantPolicy, type DormantSite } from './dormant-state.ts';
import { actorSite, withDailySites } from './processing.ts';

export function configureDormancy(world: World, policy: Partial<DormantPolicy> = {}): void {
  if (!world.region) return;
  const next = { ...(world.region.dormant?.policy ?? DORMANT_POLICY), ...policy };
  if (
    typeof next.enabled !== 'boolean' ||
    next.exitMinutes > next.enterMinutes ||
    Object.entries(next).some(
      ([key, value]) =>
        key !== 'enabled' && (!Number.isSafeInteger(value) || Object.is(value, -0) || Number(value) < 0),
    )
  )
    throw new Error('Invalid dormant policy');
  world.region.dormant ??= { version: 1, policy: next, sites: {}, facts: [], belowSince: {} };
  world.region.dormant.policy = next;
}

function contextAt(boundary: SimContext, at: number): SimContext {
  const now = asGameMinute(at);
  return {
    ...boundary,
    now,
    cal: calendarAt(now),
    commands: [],
    isNewDay: at % 1440 === 0,
    rng: (stream, key) => rng(boundary.seed, stream, now, key),
    emit: (event) => boundary.emit({ ...event, t: event.t ?? now }),
  };
}
function fact(world: World, ctx: SimContext, input: Omit<DormantFact, 'at' | 'hydrated'>): void {
  const state = world.region?.dormant;
  if (!state || state.facts.some((f) => f.key === input.key)) return;
  const rates: Partial<Record<DormantFact['kind'], number>> = {
    birth: state.policy.birthsPerThousand,
    death: state.policy.deathsPerThousand,
    marriage: state.policy.marriagesPerThousand,
    move: state.policy.movesPerThousand,
    feud: state.policy.feudsPerThousand,
  };
  const source = input.actors[0],
    rate = rates[input.kind];
  const roll =
    source !== undefined && rate !== undefined
      ? ctx.rng('census', mixKey(source, hashString32(input.kind), 0x7433)).int(0, 364999)
      : undefined;
  state.facts.push({
    ...input,
    at: ctx.now,
    hydrated: false,
    ...(rate !== undefined && roll !== undefined
      ? { chance: { annualPerThousand: rate, draw: roll, denominator: 365000 } }
      : {}),
    trace: {
      kind:
        input.kind === 'death'
          ? 'absence'
          : ['debt', 'default', 'pantry', 'harvest'].includes(input.kind)
            ? 'ledger'
            : 'notice',
      placeId: source === undefined ? null : (world.actors[source]?.placeId ?? null),
      at: ctx.now,
    },
  });
  ctx.emit({
    kind: 'region.fact',
    data: { key: input.key, site: input.site, kind: input.kind, text: input.text, amount: input.amount },
    roles: input.actors.map((actor) => ({ actor, role: 'subject' as const })),
    visibility: 'private',
    importance: 30,
    explain: {
      kind: 'formula',
      label: 'Dormant settlement fact',
      subjects: input.actors,
      knowledge: 'participants',
      terms: [{ source: 'region', label: input.kind, value: input.amount }],
      ...(rate !== undefined && roll !== undefined
        ? {
            children: [
              {
                kind: 'formula',
                label: 'Canonical daily opportunity',
                subjects: input.actors,
                knowledge: 'omniscient' as const,
                terms: [
                  { source: 'policy', label: 'Annual opportunities per thousand eligible people', value: rate },
                  {
                    source: 'roll',
                    label: 'Counter-based draw, 0..364999 (draw below rate admits opportunity)',
                    value: roll,
                  },
                ],
                total: roll,
                outcome: roll < rate ? 'opportunity' : 'existing fact',
              },
            ],
          }
        : {}),
      total: input.amount,
      outcome: input.text,
    },
  });
}

/** Daily Bernoulli opportunity, evaluated inside monthly batches. Canonical person/day
 * keys make partial months, delayed evaluation and restoration unable to reroll it. */
function opportunity(ctx: SimContext, id: ActorId, kind: string, annualPerThousand: number): boolean {
  const draw = ctx.rng('census', mixKey(id, hashString32(kind), 0x7433));
  return draw.int(0, 364999) < annualPerThousand;
}
function demographics(world: World, ctx: SimContext, site: string, row: DormantSite): void {
  const policy = world.region?.dormant?.policy;
  if (!policy) return;
  const alive = row.actors.filter((id) => world.actors[id]?.alive);
  for (const id of alive) {
    const actor = world.actors[id];
    if (!actor?.alive) continue;
    const age = yearsBetween(actor.born, ctx.now);
    const key = (kind: string) => `${site}:${ctx.now}:${id}:${kind}`;
    if (opportunity(ctx, id, 'death', policy.deathsPerThousand)) {
      recordRegionalDeath(world, ctx, id, 'illness during dormancy', {
        kind: 'formula',
        label: 'Background mortality prior',
        subjects: [id],
        knowledge: 'participants',
        terms: [{ source: 'region', label: 'Annual deaths per thousand', value: policy.deathsPerThousand }],
        total: 1,
        outcome: 'died',
      });
      fact(world, ctx, {
        key: key('death'),
        site,
        kind: 'death',
        actors: [id],
        amount: 1,
        text: `${actor.name.given} ${actor.name.family} died of illness.`,
      });
      continue;
    }
    const can = authorizeAct(world, id, { kind: 'consequential' }, { kind: 'own' }).ok;
    if (!can) continue;
    if (
      actor.sex === 'female' &&
      age >= 20 &&
      age < 45 &&
      opportunity(ctx, id, 'birth', policy.birthsPerThousand) &&
      !world.region?.dormant?.facts.some((f) => f.kind === 'birth' && f.actors[0] === id && ctx.now - f.at < 300 * 1440)
    ) {
      const child = installRegionalBirth(world, ctx, id, key('child'));
      const parentTier = world.region?.lod?.actors[id];
      if (parentTier && world.region?.lod)
        world.region.lod.actors[child] = {
          ...parentTier,
          selected: 'T3',
          processing: 'T3',
          pinned: false,
          relevance: 0,
          reasons: ['born while dormant'],
        };
      if (world.region)
        world.region.knownNodes[child] = world.region.definition.nodes
          .filter((n) => n.site === site)
          .map((n) => n.id)
          .sort();
      row.actors.push(child);
      row.actors.sort((a, b) => a - b);
      fact(world, ctx, {
        key: key('birth'),
        site,
        kind: 'birth',
        actors: [id, child],
        amount: 1,
        text: `A child was born to ${actor.name.given} ${actor.name.family}.`,
      });
    }
    if (age >= 18 && opportunity(ctx, id, 'feud', policy.feudsPerThousand)) {
      const target = (row.dispositions[id] ?? [])
        .filter((op) => alive.includes(op.targetId) && world.actors[op.targetId]?.alive)
        .sort((a, b) => a.affection - b.affection || a.targetId - b.targetId)[0]?.targetId;
      if (target !== undefined)
        fact(world, ctx, {
          key: key('feud'),
          site,
          kind: 'feud',
          actors: [id, target],
          amount: 40,
          text: `A quarrel with ${world.actors[target]?.name.given} left ${actor.name.given} nursing a grudge.`,
        });
    }
    if (age >= 18 && opportunity(ctx, id, 'marriage', policy.marriagesPerThousand)) {
      const partner = alive.find(
        (other) =>
          other !== id &&
          world.actors[other]?.alive &&
          yearsBetween(world.actors[other]?.born ?? ctx.now, ctx.now) >= 18 &&
          !areKin(world, id, other) &&
          (row.dispositions[id]?.find((op) => op.targetId === other)?.affection ?? 0) >= 20 &&
          (row.dispositions[other]?.find((op) => op.targetId === id)?.affection ?? 0) >= 20 &&
          authorizeAct(world, other, { kind: 'consequential' }, { kind: 'own' }).ok,
      );
      const pair = partner === undefined ? null : makePair(world, ctx, id, partner, actor.placeId, 0);
      if (partner !== undefined && pair && eligible(pair) && dormantMarriage(world, ctx.content, id, partner))
        fact(world, ctx, {
          key: key('marriage'),
          site,
          kind: 'marriage',
          actors: [id, partner],
          amount: 1,
          text: `${actor.name.given} married ${world.actors[partner]?.name.given}.`,
        });
    }
    if (
      age >= 18 &&
      world.households[actor.householdId]?.headId !== id &&
      opportunity(ctx, id, 'move', policy.movesPerThousand)
    ) {
      const spouse = world.social.relationships.find((r) => r.kind === 'spouse' && (r.a === id || r.b === id));
      const partner = spouse && world.actors[spouse.a === id ? spouse.b : spouse.a];
      if (partner?.alive && partner.householdId !== actor.householdId && actorSite(world, partner.id) === site) {
        changeRegionalHousehold(world, id, partner.householdId);
        resumeDormantActor(world, id, ctx.now);
        fact(world, ctx, {
          key: key('move'),
          site,
          kind: 'move',
          actors: [id, partner.id],
          amount: 1,
          text: `${actor.name.given} moved into the household of ${partner.name.given}.`,
        });
      }
    }
  }
  // Existing named liabilities and enmities become persistent news, never invented cash.
  if (ctx.cal.day === 1)
    for (const id of alive)
      for (const op of rowsOf(world.social.opinions[id] ?? {})) {
        if (!alive.includes(op.targetId)) continue;
        const debt = op.obligation.cents;
        if (debt > 0) {
          const debtor = world.actors[op.targetId];
          const cash =
            (world.provisions.purses[op.targetId] ?? 0) +
            (world.provisions.households[debtor?.householdId ?? 0]?.cashCents ?? 0);
          if (
            cash >= debt &&
            (row.dispositions[op.targetId]?.find((d) => d.targetId === id)?.trust ?? 0) >= 0 &&
            authorizeAct(world, op.targetId, { kind: 'consequential' }, { kind: 'own' }).ok
          ) {
            const paid = transferCash(
              world,
              ctx,
              op.targetId,
              id,
              debt,
              'Dormant settlement: repay recorded debt',
              undefined,
              { kind: 'own' },
              'purse',
            );
            if (paid === debt) {
              settleRegionalDebt(world, ctx.content, op.targetId, id, 'cents');
              fact(world, ctx, {
                key: `${site}:${ctx.now}:${id}:${op.targetId}:repaid`,
                site,
                kind: 'debt',
                actors: [id, op.targetId],
                amount: 0,
                text: `A debt of ${paid} cents was repaid.`,
              });
              continue;
            }
          }
          const kind = cash < debt ? 'default' : 'debt';
          fact(world, ctx, {
            key: `${site}:${id}:${op.targetId}:${kind}:${debt}`,
            site,
            kind,
            actors: [id, op.targetId],
            amount: debt,
            text:
              kind === 'default'
                ? 'An outstanding debt exceeds the debtor’s available cash; the claim remains unpaid.'
                : 'An outstanding debt remains on the household ledger.',
          });
        }
        if (
          (row.dispositions[id]?.find((d) => d.targetId === op.targetId)?.affection ?? 0) <= -40 &&
          !row.dispositions[id]?.find((d) => d.targetId === op.targetId)?.hadGrudge
        )
          fact(world, ctx, {
            key: `${site}:${id}:${op.targetId}:feud`,
            site,
            kind: 'feud',
            actors: [id, op.targetId],
            amount: 40,
            text: 'An old quarrel hardened into a lasting grudge.',
          });
      }
}

/** Canonical event calendar inside a monthly batch. All settlements finish one
 * event hour before any advances further, including partial-day promotion/save. */
export function settleDormantSites(world: World, boundary: SimContext, hydrate = false): void {
  const state = world.region?.dormant;
  if (!state || (world.tactical?.frame && world.tactical.frame.phase !== 'settled')) return;
  const end = Math.floor(boundary.now / 60) * 60;
  const saved = world.time;
  const entries = Object.keys(state.sites).sort();
  if (!entries.length) return;
  const inventory = regionalInventories(world, new Set(entries));
  const advance = (through: number) => {
    for (const site of entries) {
      const row = state.sites[site];
      if (!row || row.through >= through) continue;
      const local = inventory.worlds[site];
      if (!local) continue;
      local.time = asGameMinute(row.through);
      withDailySites(local, new Set([site]), () =>
        withInventoryPass(local, () => dormantPantries(local, contextAt(boundary, row.through), row.through, through)),
      );
      row.through = through;
    }
  };
  try {
    withInventoryPass(world, () => {
      let at = Math.min(...entries.map((site) => state.sites[site]?.through ?? end));
      while (at < end) {
        const day = Math.floor(at / 1440) * 1440;
        const noon = day + 720;
        let next = Math.min(at === day ? at : day + 1440, at <= noon ? noon : day + 2160);
        for (const meal of world.provisions.pendingMeals ?? []) {
          const site = world.places[meal.placeId]?.siteId ?? '';
          if (!state.sites[site]) continue;
          next = Math.min(next, Math.max(at, Math.ceil(meal.completesAt / 60) * 60));
        }
        if (next >= end) break;
        advance(next);
        for (const site of entries) {
          const row = state.sites[site];
          if (!row || row.through > next) continue;
          const local = inventory.worlds[site];
          if (!local) continue;
          const ctx = contextAt(boundary, next);
          local.time = ctx.now;
          withDailySites(local, new Set([site]), () =>
            withInventoryPass(local, () => {
              finishDormantMeals(local, ctx);
              if (next % 1440 === 0 && next > row.since) {
                const produced = dormantProduction(local, contextAt(boundary, next - 60), row.actors);
                row.producedKcal += produced;
                if (produced > 0)
                  fact(local, ctx, {
                    key: `${site}:${next}:harvest`,
                    site,
                    kind: 'harvest',
                    actors: [],
                    amount: produced,
                    text: `Scheduled gathering brought in ${produced} kcal in actual food stacks.`,
                  });
                if (
                  row.actors.some(
                    (id) => local.actors[id]?.alive && (local.needs.byActor[id]?.values.hunger ?? 1000) <= 100,
                  )
                ) {
                  // Famine retains actual owner checks. Rolls use the preceding canonical
                  // hours; aggregate consequences are dated at this committed boundary.
                  for (let hour = 0; hour < 24; hour++)
                    dormantSurvivalHour(local, {
                      ...ctx,
                      rng: (stream, key) => rng(ctx.seed, stream, asGameMinute(next - 1440 + hour * 60), key),
                    });
                }
                dormantNutritionDay(local, ctx);
                if (ctx.cal.day === 1)
                  fact(local, ctx, {
                    key: `${site}:${next}:pantry`,
                    site,
                    kind: 'pantry',
                    actors: [],
                    amount: row.consumedKcal,
                    text: `Dormant households have consumed ${row.consumedKcal} kcal since dormancy began; unmet demand totals ${row.shortageKcal} kcal.`,
                  });
              }
              if (next % 1440 === 720) {
                demographics(local, ctx, site, row);
                for (const hid of row.households) {
                  const result = dormantHouseholdMeal(local, ctx, hid);
                  row.consumedKcal += result.consumed;
                  row.shortageKcal += result.shortage;
                }
              }
            }),
          );
        }
        at = next + 60;
        advance(Math.min(at, end));
      }
      advance(end);
    });
    inventory.commit();
    world.time = saved;
    if (hydrate) hydrateDormantMinds(world, boundary);
  } finally {
    inventory.commit();
    world.time = saved;
  }
}
function hydrateDormantMinds(world: World, ctx: SimContext): void {
  const state = world.region?.dormant;
  if (!state) return;
  for (const site of Object.keys(state.sites).sort()) {
    const row = state.sites[site];
    if (!row) continue;
    const days = Math.max(0, Math.ceil(row.through / 1440) - Math.ceil(row.mindsThrough / 1440));
    const hours = Math.max(0, Math.floor((row.through - row.mindsThrough) / 60));
    dormantSocialDecay(world, ctx.content, row.actors, days);
    dormantThoughtDecay(world, row.actors, hours);
    for (const id of row.actors) dormantNeeds(world, ctx, id, hours);
    row.mindsThrough = row.through;
  }
  state.facts.sort(
    (a, b) =>
      a.at - b.at || (a.site < b.site ? -1 : a.site > b.site ? 1 : 0) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  for (const f of state.facts) {
    if (f.hydrated) continue;
    const factCtx = contextAt(ctx, f.at);
    for (const id of f.actors) {
      if (!world.actors[id]?.alive) continue;
      const memory: import('../social/state.ts').MemoryInput = {
        ownerId: id,
        eventId: null,
        kind: 'observation',
        at: factCtx.now,
        placeId: world.actors[id]?.placeId ?? null,
        roles: f.actors.map((who) => ({ who, role: 'subject', conf: 100 })),
        source: { kind: 'witnessed' },
        emotion: 'none',
        intensity: 40,
        salience: 600,
        confidence: 1000,
        rehearsals: 0,
        pinned: false,
        summary: f.text,
      };
      const policy = memoryDecayPolicy(world, ctx.content, memory);
      let salience: number | null = memory.salience;
      for (
        let day = 0;
        day < Math.min(1001, Math.max(0, Math.ceil(ctx.now / 1440) - Math.ceil(f.at / 1440))) && salience !== null;
        day++
      )
        salience = decayMemorySnapshot(salience, false, policy);
      if (salience !== null) addMemory(world, factCtx, { ...memory, salience });
    }
    if (f.kind === 'debt' || f.kind === 'default' || f.kind === 'feud') {
      const [creditor, debtor] = f.actors;
      if (creditor !== undefined && debtor !== undefined) {
        const prop =
          f.kind === 'feud'
            ? internProp(world, 'quarreled', [
                { kind: 'actor', id: creditor },
                { kind: 'actor', id: debtor },
              ])
            : internProp(world, 'owes', [
                { kind: 'actor', id: debtor },
                { kind: 'actor', id: creditor },
                { kind: 'number', value: f.amount },
              ]);
        for (const holder of f.actors)
          if (world.actors[holder]?.alive)
            observe(world, factCtx, holder, prop, { type: 'observation', dir: 1, sourceId: null, eventId: null });
      }
    }
    if (f.kind === 'feud') {
      const [holderId, target] = f.actors;
      if (holderId !== undefined && target !== undefined)
        formGrudge(world, factCtx, {
          holderId,
          target: { kind: 'actor', id: target },
          aim: 'apology',
          intensity: f.amount,
          label: f.text,
        });
    }
    f.hydrated = true;
  }
}
export function wakeDormantSite(world: World, ctx: SimContext, site: string): void {
  const state = world.region?.dormant,
    row = state?.sites[site];
  if (!row) return;
  // Always flush every pending settlement before any allocations/hydration: contact order is irrelevant.
  settleDormantSites(world, ctx, true);
  for (const id of row.actors) {
    resumeDormantActor(world, id, ctx.now);
    const tier = world.region?.lod?.actors[id];
    if (tier) {
      tier.selected = tier.selected === 'T0' ? 'T0' : 'T1';
      tier.processing = tier.selected;
      tier.belowSince = null;
    }
  }
  delete state?.sites[site];
  if (state) delete state.belowSince[site];
  ensureCensus(world);
}

export function updateDormantOwners(world: World, ctx: SimContext, eligible: Set<string>): void {
  const region = world.region;
  if (!region) return;
  // Explicit host opt-in while town livelihood and county cost gates remain open.
  const state = region.dormant;
  if (!state) return;
  const actorsBySite = new Map<string, ActorId[]>();
  for (const id of idsOf<ActorId>(world.actors)) {
    const site = actorSite(world, id),
      ids = actorsBySite.get(site) ?? [];
    ids.push(id);
    actorsBySite.set(site, ids);
  }
  const wanted = new Set<string>();
  for (const [site, ids] of actorsBySite) {
    const threshold = state.sites[site] ? state.policy.exitMinutes : state.policy.enterMinutes;
    const far =
      state.policy.enabled &&
      ids.every((id) => {
        const r = region.lod?.actors[id];
        return r && !r.pinned && r.relevance === 0 && r.distanceMinutes !== null && r.distanceMinutes > threshold;
      });
    if (!far) {
      delete state.belowSince[site];
      continue;
    }
    state.belowSince[site] ??= ctx.now;
    if (eligible.has(site) && (state.sites[site] || ctx.now - state.belowSince[site] >= state.policy.dwellMinutes))
      wanted.add(site);
  }
  const leaving = Object.keys(state.sites)
    .filter((site) => !wanted.has(site))
    .sort();
  if (leaving.length || (ctx.cal.day === 1 && ctx.cal.hour === 0)) settleDormantSites(world, ctx, leaving.length > 0);
  for (const site of leaving) wakeDormantSite(world, ctx, site);
  const entering = [...wanted].filter((site) => !state.sites[site]).sort();
  if (entering.length) settleDailySites(world, ctx);
  for (const site of entering) {
    // Meal reservations and unresolved activity must complete before freezing.
    if (
      world.provisions.pendingMeals?.some((m) => world.places[m.placeId]?.siteId === site) ||
      actorsBySite.get(site)?.some((id) => world.activity.byActor[id]?.travel)
    )
      continue;
    const actors = actorsBySite.get(site) ?? [];
    state.sites[site] = {
      since: ctx.now,
      through: ctx.now,
      mindsThrough: ctx.now,
      actors,
      households: rowsOf(world.households)
        .filter((h) => world.places[h.homePlaceId]?.siteId === site)
        .map((h) => h.id),
      dispositions: Object.fromEntries(
        actors.map((id) => [
          id,
          rowsOf(world.social.opinions[id] ?? {})
            .filter((op) => actors.includes(op.targetId))
            .map((op) => ({
              targetId: op.targetId,
              affection: opinionOf(world, id, op.targetId).affection,
              trust: opinionOf(world, id, op.targetId).trust,
              hadGrudge: rowsOf(world.belief.grudges).some(
                (g) => g.holderId === id && g.target.kind === 'actor' && g.target.id === op.targetId,
              ),
            })),
        ]),
      ),
      consumedKcal: 0,
      shortageKcal: 0,
      producedKcal: 0,
    };
    if (region.processing?.sites) delete region.processing.sites[site];
  }
  for (const [site, row] of Object.entries(state.sites)) {
    eligible.delete(site);
    for (const id of row.actors) {
      const tier = region.lod?.actors[id];
      if (tier) {
        tier.selected = 'T3';
        tier.processing = 'T3';
      }
    }
  }
}
export function validateDormantState(world: World): void {
  const state = world.region?.dormant;
  if (!state) return;
  if (state.version !== 1) throw new Error('Unsupported dormant version');
  if (
    typeof state.policy.enabled !== 'boolean' ||
    state.policy.exitMinutes > state.policy.enterMinutes ||
    Object.entries(state.policy).some(
      ([key, value]) =>
        key !== 'enabled' && (!Number.isSafeInteger(value) || Object.is(value, -0) || Number(value) < 0),
    )
  )
    throw new Error('Invalid dormant policy');
  const seen = new Set<number>();
  for (const [site, row] of Object.entries(state.sites)) {
    for (const id of row.actors) {
      if (seen.has(id) || !world.actors[id] || actorSite(world, id) !== site)
        throw new Error('Invalid dormant membership');
      seen.add(id);
    }
    if (world.region?.processing?.sites?.[site]) throw new Error('Overlapping dormant and daily ownership');
    if (
      ![row.since, row.through, row.mindsThrough].every(Number.isSafeInteger) ||
      row.since < 0 ||
      row.mindsThrough < row.since ||
      row.through < row.mindsThrough ||
      row.through > world.time ||
      row.through % 60 !== 0
    )
      throw new Error('Invalid dormant cursor');
  }
}

/** Settlement news is visible only in person or through an explicit omniscient query.
 * A road-map node being known is not knowledge of its current births/deaths/debts. */
export function dormantNews(world: World, site: string, perspective: ActorId, omniscient = false): DormantFact[] {
  if (!omniscient && world.places[world.actors[perspective]?.placeId ?? 0]?.siteId !== site) return [];
  return (world.region?.dormant?.facts ?? [])
    .filter((f) => f.site === site && ['birth', 'death', 'marriage', 'move', 'harvest'].includes(f.kind))
    .map((f) => ({
      ...f,
      actors: [...f.actors],
      ...(f.chance ? { chance: { ...f.chance } } : {}),
      ...(f.trace ? { trace: { ...f.trace } } : {}),
    }));
}
