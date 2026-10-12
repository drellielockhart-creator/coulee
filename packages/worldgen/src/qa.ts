import { type ContentBundle, crossCheck, PlaceSchema, ScenarioSchema, SiteSchema } from '@coulee/content/schema';
import { canonicalStringify, createSim, findNonIntegers, rowsOf, runHours, stateHash } from '@coulee/core';
import { sha256 } from './hash.ts';
import type { GeneratedTown, QaResult } from './types.ts';

/** Add normal authored tables to a bundle. The sim never sees a generator recipe. */
export function townContent(
  base: ContentBundle,
  town: Pick<GeneratedTown, 'scenario' | 'site' | 'places'>,
): ContentBundle {
  const { meta, ...baseTables } = base;
  const tables = {
    ...baseTables,
    sites: { ...base.sites, [town.site.id]: town.site },
    places: { ...base.places, ...Object.fromEntries(town.places.map((p) => [p.id, p])) },
    scenarios: { ...base.scenarios, [town.scenario.id]: town.scenario },
  };
  return { ...tables, meta: { ...meta, hash: sha256(canonicalStringify(tables)) } };
}

export function checkTown(base: ContentBundle, town: Pick<GeneratedTown, 'scenario' | 'site' | 'places'>): QaResult[] {
  const { scenario: s, site, places } = town;
  const out: QaResult[] = [];
  const check = (name: string, failures: string[]) =>
    out.push({ check: name, pass: failures.length === 0, detail: failures.length ? failures.join('; ') : 'passed' });
  check(
    'schemas',
    [ScenarioSchema.safeParse(s), SiteSchema.safeParse(site), ...places.map((p) => PlaceSchema.safeParse(p))].flatMap(
      (r) => (r.success ? [] : [r.error.message]),
    ),
  );
  if (!out[0]?.pass) return out;
  const content = townContent(base, town);
  check(
    'references',
    crossCheck(content).map((i) => `${i.where}: ${i.message}`),
  );
  check('integer seeds', findNonIntegers({ scenario: s, site, places }));
  const collisions: string[] = [];
  for (const [i, a] of places.entries())
    for (const b of places.slice(i + 1)) {
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
        collisions.push(`${a.id} overlaps ${b.id}`);
    }
  check('footprints', collisions);
  // Tile flood-fill: structures and creek are obstacles, ford is the crossing. A place
  // is reachable when at least one boundary tile is accessible from an entering road.
  const blocked = new Set<number>();
  const tile = (x: number, y: number) => y * site.grid.w + x;
  for (const p of places)
    if (['building', 'house', 'farmstead'].includes(p.kind) || p.tags.includes('creek')) {
      for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) blocked.add(tile(x, y));
    }
  const entry = places.find((p) => p.kind === 'road' && (p.x === 0 || p.y === 0));
  const visited = new Set<number>();
  const queue: number[] = [];
  if (entry) {
    queue.push(tile(entry.x, entry.y));
    visited.add(queue[0] as number);
  }
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i] as number;
    const x = v % site.grid.w;
    const y = Math.floor(v / site.grid.w);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx === undefined || ny === undefined || nx < 0 || ny < 0 || nx >= site.grid.w || ny >= site.grid.h) continue;
      const n = tile(nx, ny);
      if (blocked.has(n) || visited.has(n)) continue;
      visited.add(n);
      queue.push(n);
    }
  }
  check(
    'reachability',
    places
      .filter((p) => {
        for (let y = Math.max(0, p.y - 1); y <= Math.min(site.grid.h - 1, p.y + p.h); y++)
          for (let x = Math.max(0, p.x - 1); x <= Math.min(site.grid.w - 1, p.x + p.w); x++) {
            if ((x < p.x || x >= p.x + p.w) && (y < p.y || y >= p.y + p.h)) continue;
            if (visited.has(tile(x, y))) return false;
          }
        return true;
      })
      .map((p) => `unreachable ${p.id}`),
  );
  check(
    'households housed and fed',
    s.households.flatMap((h) => {
      const home = places.find((p) => p.id === h.home);
      const members = s.actors.filter((a) => a.household === h.key);
      return home?.tags.includes('home') &&
        members.some((a) => a.key === h.head) &&
        h.pantry.some((p) => p.qty > 0 && content.items[p.item]?.food)
        ? []
        : [h.key];
    }),
  );
  check(
    'workplaces',
    s.actors.flatMap((a) => {
      const p = places.find((p) => p.id === a.workplace);
      const tags = content.occupations[a.occupation]?.workplace_tags ?? [];
      return p && (tags.length === 0 || tags.some((t) => p.tags.includes(t)))
        ? []
        : [`${a.key}: ${a.occupation} lacks matching workplace`];
    }),
  );
  check('ford', places.some((p) => p.tags.includes('ford')) ? [] : ['no ford']);
  check(
    'fae anchor',
    places.some((p) => (p.fae_intensity ?? site.fae_intensity) + (p.tags.includes('spring') ? 1 : 0) >= 4)
      ? []
      : ['no strong fae anchor'],
  );
  check(
    'concealed faekin',
    s.actors.some(
      (a) =>
        content.peoples[a.ancestry]?.concealed &&
        a.presents_as !== a.ancestry &&
        s.secrets.some((x) => x.holder === a.key && x.prop.pred === 'faekin'),
    )
      ? []
      : ['no concealed person and secret'],
  );
  check(
    'tensions',
    s.tensions.length >= 2 && s.grudges.length >= 2 && s.beliefs.length > 0 ? [] : ['fewer than two playable tensions'],
  );
  check(
    'names',
    s.actors.length === new Set(s.actors.map((a) => `${a.given} ${a.family}`)).size ? [] : ['duplicate full names'],
  );
  return out;
}

/** Q08: only broad sustained deprivation fails; hungry households remain valid stories. */
export function playtestTown(content: ContentBundle, town: GeneratedTown): void {
  try {
    const sim = createSim(content, { scenarioId: town.scenario.id, seed: town.report.recipe.seed });
    let shortages = 0;
    sim.sink = (e) => {
      if (e.kind === 'provisions.shortage') shortages++;
    };
    runHours(sim, 30 * 24);
    const actors = rowsOf(sim.world.actors);
    const alive = actors.filter((a) => a.alive).length;
    const deprived = actors.filter((a) => {
      const days = sim.world.provisions.nutrition[a.id]?.history.slice(-7) ?? [];
      return days.filter((d) => d.needKcal > 0 && d.kcal * 4 < d.needKcal).length >= 5;
    }).length;
    const pass = alive * 2 > actors.length && deprived * 4 < actors.length * 3;
    town.report.playtest = {
      days: 30,
      hash: stateHash(sim.world),
      alive,
      population: actors.length,
      deprived,
      shortages,
    };
    town.report.qa.push({
      check: '30-day survival',
      pass,
      detail: `${alive}/${actors.length} alive; ${deprived} with <25% energy needs met on at least 5 of the final 7 days. Fails at >=50% deaths or >=75% sustained deprivation.`,
    });
    const nonInts = findNonIntegers(sim.world);
    town.report.qa.push({
      check: '30-day integer state',
      pass: nonInts.length === 0,
      detail: nonInts.join('; ') || 'passed',
    });
  } catch (error) {
    town.report.qa.push({
      check: '30-day survival',
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
