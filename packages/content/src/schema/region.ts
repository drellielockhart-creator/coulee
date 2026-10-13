/** Authored regional graph. OWNER: content-world. Slice 1 keeps both sites hourly. */
import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { checkRefs, defineDomain, type Issue, id, int, ref } from './common.ts';
export const RegionSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  version: z.literal(1),
  nodes: z.array(z.strictObject({ id: id(), site: ref(), entrance: ref(), name: z.string().min(1) })).min(2),
  edges: z
    .array(
      z.strictObject({
        id: id(),
        a: ref(),
        b: ref(),
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        distance_ft: int().positive(),
        cost_minutes: z.strictObject({ ab: int().positive(), ba: int().positive() }),
        capability: z.enum(['walk', 'boat']),
        available_months: z.array(int().min(1).max(12)).min(1),
        cells: z.array(int().nonnegative()).default([]),
        climb_ft: int().nonnegative().default(0),
        descent_ft: int().nonnegative().default(0),
        crossings: z.array(z.string()).default([]),
        hazards: z.array(z.string()).default([]),
        downstream: z.enum(['ab', 'ba']).optional(),
      }),
    )
    .min(1),
  fixed_weather: z.strictObject({ temperature_f: int(), raining: z.boolean() }).optional(),
  walking_minutes_per_day: int().min(60).max(720).default(480),
});
export type RegionDef = z.output<typeof RegionSchema>;
export type RegionEdge = RegionDef['edges'][number];
export const regionDomains = { regions: defineDomain({ dir: 'regions', key: 'region', schema: RegionSchema }) };
export function regionRefs(b: ContentBundle): Issue[] {
  const out: Issue[] = [];
  for (const r of Object.values(b.regions ?? {})) {
    const nodes = Object.fromEntries(r.nodes.map((n) => [n.id, n]));
    if (Object.keys(nodes).length !== r.nodes.length || new Set(r.edges.map((e) => e.id)).size !== r.edges.length)
      out.push({ where: `regions:${r.id}`, message: 'Node and edge IDs must be unique' });
    for (const n of r.nodes) {
      checkRefs(out, r.id, 'site', [n.site], b.sites, 'site');
      checkRefs(out, r.id, 'entrance', [n.entrance], b.places, 'place');
      if (b.places[n.entrance]?.site !== n.site)
        out.push({ where: r.id, message: 'Entrance must belong to node site' });
    }
    for (const e of r.edges) {
      checkRefs(out, r.id, 'endpoints', [e.a, e.b], nodes, 'node');
      if (e.a === e.b) out.push({ where: r.id, message: 'A road must join distinct nodes' });
    }
  }
  for (const s of Object.values(b.scenarios))
    if (s.region) checkRefs(out, s.id, 'region', [s.region], b.regions, 'region');
  return out;
}
