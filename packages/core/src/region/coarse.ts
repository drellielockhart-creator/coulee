/** Daily ownership batches the shared physical kernels; no stocks are reconstructed on arrival. */
import { regionActivityHour } from '../activity/api.ts';
import { regionBeliefHour } from '../belief/api.ts';
import { regionFaeHour } from '../fae/api.ts';
import { idsOf, rowsOf } from '../ids.ts';
import { withInventoryPass } from '../items/api.ts';
import { itineraryNeedsHour } from '../needs/api.ts';
import { householdProcessingHour } from '../provisions/api.ts';
import { regionPsycheHour } from '../psyche/api.ts';
import { rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { regionSocialHour } from '../social/api.ts';
import { asGameMinute, calendarAt } from '../time.ts';
import type { World } from '../world.ts';
import { actorSite, withDailySites } from './processing.ts';

/** A site is indivisible until cross-site meals, jobs, charms and journeys gain interval contracts. */
function eligibleSites(world: World): Set<string> {
  const candidates = new Set(world.region?.definition.nodes.map((n) => n.site) ?? []);
  for (const actor of rowsOf(world.actors)) {
    const home = actorSite(world, actor.id);
    const actual = world.places[actor.placeId]?.siteId ?? '';
    if (
      world.region?.lod?.actors[actor.id]?.selected !== 'T2' ||
      actual !== home ||
      (world.activity.journeys?.[actor.id]?.status && world.activity.journeys[actor.id]?.status !== 'arrived') ||
      world.tactical?.frame?.live.includes(actor.id)
    ) {
      candidates.delete(home);
      candidates.delete(actual);
    }
    const job = world.activity.byActor[actor.id]?.workplaceId;
    if (job != null && world.places[job]?.siteId !== home) candidates.delete(home);
  }
  // A reservoir can debit neighboring households. Keep all of its region hourly for now.
  if (rowsOf(world.fae.charms ?? {}).some((c) => !c.disposed)) candidates.clear();
  for (const worker of idsOf(world.provisions.contracts ?? {})) {
    const contract = world.provisions.contracts?.[worker];
    if (!contract) continue;
    const a = actorSite(world, worker),
      b = actorSite(world, contract.employerId);
    if (a !== b && !contract.ended) {
      candidates.delete(a);
      candidates.delete(b);
    }
  }
  for (const r of world.social.relationships) {
    // Care, bereavement and estates can move goods/people along kin ties.
    if (!['employer', 'parent', 'sibling', 'spouse', 'cousin', 'in_law', 'betrothed'].includes(r.kind)) continue;
    const a = actorSite(world, r.a),
      b = actorSite(world, r.b);
    if (a !== b) {
      candidates.delete(a);
      candidates.delete(b);
    }
  }
  for (const meal of world.provisions.pendingMeals ?? []) {
    const site = world.places[meal.placeId]?.siteId ?? '';
    for (const plate of meal.plates)
      if (actorSite(world, plate.id) !== site) {
        candidates.delete(site);
        candidates.delete(actorSite(world, plate.id));
      }
  }
  for (const loan of world.social.objectLoans ?? []) {
    if (loan.status !== 'open') continue;
    const a = actorSite(world, loan.borrowerId),
      b = actorSite(world, loan.lenderId);
    if (a !== b) {
      candidates.delete(a);
      candidates.delete(b);
    }
  }
  for (const store of rowsOf(world.provisions.stores)) {
    if (store.ownerHouseholdId === null) continue;
    const home = world.places[world.households[store.ownerHouseholdId]?.homePlaceId ?? 0]?.siteId ?? '';
    const site = world.places[store.placeId]?.siteId ?? '';
    if (home !== site) {
      candidates.delete(home);
      candidates.delete(site);
    }
  }
  for (const request of world.social.pendingRequests ?? []) {
    if (request.status !== 'pending') continue;
    const a = actorSite(world, request.from),
      b = actorSite(world, request.to);
    if (a !== b) {
      candidates.delete(a);
      candidates.delete(b);
    }
  }
  for (const p of world.belief.persecutions) {
    if (p.target.kind === 'actor') candidates.delete(actorSite(world, p.target.id));
    if (p.target.kind === 'household')
      candidates.delete(world.places[world.households[p.target.id]?.homePlaceId ?? 0]?.siteId ?? '');
  }
  return candidates;
}

/** Consume only [saved cursor, completed boundary). Repeated promotion has an empty interval.
 * Flush all sites together on contact: visit order cannot reorder outstanding physical work. */
export function settleDailySites(world: World, boundary: SimContext): void {
  if (world.tactical?.frame && world.tactical.frame.phase !== 'settled') return;
  const sites = world.region?.processing?.sites;
  if (!sites || !Object.keys(sites).length) return;
  const end = Math.floor(boundary.now / 60) * 60;
  const savedTime = world.time;
  try {
    withInventoryPass(world, () => {
      let at = Math.min(...Object.values(sites).map((s) => s.through));
      for (; at < end; at += 60) {
        const due = new Set(
          Object.keys(sites)
            .filter((id) => (sites[id]?.through ?? end) <= at)
            .sort(),
        );
        if (!due.size) continue;
        const now = asGameMinute(at),
          cal = calendarAt(now);
        world.time = now;
        const ctx: SimContext = {
          content: boundary.content,
          seed: boundary.seed,
          now,
          cal,
          isNewDay: at % 1440 === 0,
          commands: [],
          rng: (stream, key) => rng(boundary.seed, stream, now, key),
          rngAt: (stream, time, key) => rng(boundary.seed, stream, time, key),
          emit: (event) => boundary.emit({ ...event, t: event.t ?? now }),
        };
        withDailySites(world, due, () => {
          itineraryNeedsHour(world, ctx);
          regionPsycheHour(world, ctx);
          regionActivityHour(world, ctx);
          regionFaeHour(world, ctx);
          // Named social encounters use the same consent, memories and opinion ledgers.
          regionSocialHour(world, ctx);
          regionBeliefHour(world, ctx);
          householdProcessingHour(world, ctx);
        });
        for (const site of due) {
          const cursor = sites[site];
          if (cursor) cursor.through = at + 60;
        }
      }
    });
  } finally {
    world.time = savedTime;
  }
}

/** Called only at settled boundaries. No future consumption, and no arrival-time RNG. */
export function updateProcessingOwners(world: World, ctx: SimContext): void {
  if (!world.region || (world.tactical?.frame && world.tactical.frame.phase !== 'settled')) return;
  const eligible = eligibleSites(world);
  const old = world.region.processing?.sites ?? {};
  if (ctx.now % 1440 === 0 || Object.keys(old).some((site) => !eligible.has(site))) settleDailySites(world, ctx);
  for (const site of Object.keys(old)) if (!eligible.has(site)) delete old[site];
  if (eligible.size) {
    world.region.processing ??= { version: 1, householdEconomy: {} };
    world.region.processing.sites ??= {};
    for (const site of [...eligible].sort())
      world.region.processing.sites[site] ??= { through: ctx.now, since: ctx.now };
  }
  for (const actor of rowsOf(world.actors)) {
    const row = world.region.lod?.actors[actor.id];
    if (row)
      row.processing = world.region.processing?.sites?.[actorSite(world, actor.id)]
        ? 'T2'
        : row.selected === 'T0'
          ? 'T0'
          : 'T1';
  }
}
