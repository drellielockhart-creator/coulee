import { rowsOf } from '../ids.ts';
import { hashString32 } from '../rng.ts';
import type { InitContext, SimContext } from '../sim/context.ts';
import type { World } from '../world.ts';
import { effectiveFi } from './api.ts';
import { ironByPlace, recordSnow } from './conditions.ts';
import { eligibleFamilies, resolveEpisode, snapshotWindow, windows } from './episodes.ts';
import { investigate } from './investigate.ts';
import { noticeEpisode } from './omens.ts';
import { isProtectedSite } from './sites.ts';
export function initFaeState(world: World, ctx: InitContext): void {
  for (const p of rowsOf(world.places)) {
    if (isProtectedSite(p) || effectiveFi(world, p) < 2) continue;
    const options = eligibleFamilies(ctx.content, p, effectiveFi(world, p));
    const id = options[hashString32(p.defId) % options.length];
    if (id) world.fae.signatures[p.id] = id;
  }
}
export function faeSystem(world: World, ctx: SimContext): void {
  if (!world.fae.enabled) return;
  recordSnow(world, ctx.now, ctx);
  let iron: Record<number, number> | undefined;
  if (ctx.isNewDay) {
    for (const key of Object.keys(world.fae.episodes).sort())
      if ((world.fae.episodes[key]?.traceEnd ?? 0) < ctx.now) delete world.fae.episodes[key];
    for (const p of rowsOf(world.places)) {
      const v = world.fae.thinning[p.id] ?? 0;
      if (v) world.fae.thinning[p.id] = v - Math.floor((v * 30) / 1000);
    }
    for (const key of Object.keys(world.fae.cooldowns).sort())
      if ((world.fae.cooldowns[key] ?? 0) < ctx.now - 10080) delete world.fae.cooldowns[key];
    for (const a of rowsOf(world.actors))
      if (world.fae.questions[a.id])
        world.fae.questions[a.id] = (world.fae.questions[a.id] ?? []).filter((q) => q.openedAt > ctx.now - 10080);
  }
  for (const p of rowsOf(world.places)) {
    if (isProtectedSite(p)) continue;
    if (effectiveFi(world, p) === 0 && !p.tags.includes('home')) continue;
    for (const period of windows(p, ctx.cal.dayIndex)) {
      if (period.at < ctx.now || period.at >= ctx.now + 60) continue;
      iron ??= ironByPlace(world, ctx.content);
      const e = resolveEpisode(world, ctx, snapshotWindow(world, ctx, p, period.window, period.at, iron));
      if (!e) continue;
      const key = `place:${p.id}:${e.family}`;
      if ((world.fae.cooldowns[key] ?? -10000) > period.at) continue;
      world.fae.episodes[e.id] = e;
      world.fae.cooldowns[`text:place:${p.id}:${e.text}`] = period.at + 10080;
    }
  }
  for (const key of Object.keys(world.fae.episodes).sort()) {
    const e = world.fae.episodes[key];
    if (!e) continue;
    if (e.end >= ctx.now && e.snapshot.at < ctx.now + 60) noticeEpisode(world, ctx, e);
  }
  for (const c of ctx.commands)
    if (c.kind === 'fae.investigate')
      investigate(world, ctx, c.actorId, c.data.signId, { kind: 'command', issuer: c.issuer ?? { kind: 'player' } });
}
