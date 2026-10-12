import type { QaResult } from '../types.ts';
import { countyMetrics, segmentFt } from './metrics.ts';
import type { GeneratedCounty } from './types.ts';
export function checkCounty(c: GeneratedCounty): QaResult[] {
  const out: QaResult[] = [];
  const check = (name: string, errors: string[]) =>
    out.push({ check: name, pass: errors.length === 0, detail: errors.length ? errors.slice(0, 12).join('; ') : 'ok' });
  check(
    'ford town',
    c.settlements.some((s) => s.kind === 'ford_town' && c.hydrology[s.cell]?.ford) ? [] : ['No ford town'],
  );
  const topology: string[] = [];
  for (const t of c.terrain) {
    if (t.downstream !== null) {
      const p = c.terrain[t.downstream];
      if (!p || p.elevationFt > t.elevationFt) topology.push(`uphill ${t.id}`);
      if (p && (Math.abs(t.x - p.x) > 1 || Math.abs(t.y - p.y) > 1 || p.id === t.id))
        topology.push(`disconnected ${t.id}`);
    }
    const w = c.hydrology[t.id];
    if (t.downstream === null && !(t.x === 0 && t.y === c.recipe.size.height - 1))
      topology.push(`inland outlet ${t.id}`);
    if (w && w.kind !== 'dry') {
      if (w.downstream !== t.downstream) topology.push(`water/terrain mismatch ${t.id}`);
      if (w.downstream !== null) {
        const next = c.hydrology[w.downstream];
        if (!next || next.kind === 'dry') topology.push(`creek ends inland ${t.id}`);
        if (next && next.order < w.order) topology.push(`flow order decreases ${t.id}`);
      }
    }
  }
  // Visit downstream links once; reject cycles even when equal elevations conceal them.
  const state = new Uint8Array(c.terrain.length);
  for (const t of c.terrain) {
    let id: number | null = t.id;
    const chain: number[] = [];
    while (id !== null && state[id] === 0) {
      state[id] = 1;
      chain.push(id);
      id = c.terrain[id]?.downstream ?? null;
    }
    if (id !== null && state[id] === 1) topology.push(`cycle ${id}`);
    for (const n of chain) state[n] = 2;
  }
  check('water topology', topology);
  check('springs', c.hydrology.some((w) => w.spring) ? [] : ['No contact springs']);
  check(
    'slopes',
    c.terrain.some((t) => t.slopePm < 0 || t.slopePm > 500) ? ['Absurd slope outside 0..500 per mille'] : [],
  );
  check(
    'fae field',
    c.fae.anchors.length >= 6 &&
      c.fae.anchors.length <= 10 &&
      new Set(c.fae.anchors.map((a) => a.family)).size >= 2 &&
      c.fae.intensity.some((n) => n >= 2)
      ? []
      : ['Fae desert or missing terrain families/anchors'],
  );
  const protectedErrors: string[] = [];
  for (const t of c.terrain)
    if (t.protected && (c.fae.intensity[t.id] !== 0 || c.fae.anchors.some((a) => a.cell === t.id)))
      protectedErrors.push(`fae at protected ${t.id}`);
  for (const edge of c.graph.edges)
    if (
      edge.kind === 'fae_path' &&
      [edge.a, edge.b].some((id) => {
        const node = c.graph.nodes.find((n) => n.id === id);
        return !node || node.protected || c.terrain[node.cell]?.protected;
      })
    )
      protectedErrors.push(`protected path ${edge.id}`);
  check('protected sites', protectedErrors);
  const root = c.settlements.find((s) => s.kind === 'ford_town'),
    seen = new Set<string>(root ? [root.id] : []),
    cost = new Map<string, number>(root ? [[root.id, 0]] : []);
  // Small graph Bellman relaxation, excluding magical shortcuts and seasonal navigation.
  for (let i = 0; i < c.graph.nodes.length; i++) {
    let changed = false;
    for (const edge of c.graph.edges) {
      if (edge.kind === 'fae_path' || edge.kind === 'river') continue;
      for (const [a, b, d] of [
        [edge.a, edge.b, edge.costMinutes.ab],
        [edge.b, edge.a, edge.costMinutes.ba],
      ] as const) {
        if (seen.has(a)) seen.add(b);
        const candidate = (cost.get(a) ?? Number.MAX_SAFE_INTEGER) + d;
        if (candidate < (cost.get(b) ?? Number.MAX_SAFE_INTEGER)) {
          cost.set(b, candidate);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  check(
    'required connectivity',
    c.graph.nodes.filter((n) => n.required && !seen.has(n.id)).map((n) => `unreachable ${n.id}`),
  );
  check(
    'starting excursion',
    c.fae.anchors.some(
      (a) => (cost.get(a.id) ?? Number.MAX_SAFE_INTEGER) <= c.recipe.constraints.fordTownMaxAnchorMinutes,
    )
      ? []
      : ['No FI 2–3 anchor within the requested one-way walking time'],
  );
  const graphErrors: string[] = [];
  const ids = new Set(c.graph.nodes.map((n) => n.id));
  for (const edge of c.graph.edges) {
    if (!ids.has(edge.a) || !ids.has(edge.b)) graphErrors.push(`missing endpoint ${edge.id}`);
    if (edge.kind !== 'fae_path') {
      if (
        edge.lengthFt !==
        edge.cells.slice(1).reduce((sum, id, i) => sum + segmentFt(edge.cells[i] as number, id, c.recipe.size.width), 0)
      )
        graphErrors.push(`length ${edge.id}`);
      for (let i = 1; i < edge.cells.length; i++) {
        const a = c.terrain[edge.cells[i - 1] as number],
          b = c.terrain[edge.cells[i] as number];
        if (!a || !b || Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) !== 1)
          graphErrors.push(`non-contiguous ${edge.id}`);
        if (a && b && a.x !== b.x && a.y !== b.y && edge.kind.endsWith('_road')) {
          const u = c.hydrology[a.y * c.recipe.size.width + b.x],
            v = c.hydrology[b.y * c.recipe.size.width + a.x];
          if (
            u &&
            v &&
            ((u.kind !== 'dry' && u.downstream === v.cell) || (v.kind !== 'dry' && v.downstream === u.cell))
          )
            graphErrors.push(`unmarked diagonal crossing ${edge.id}`);
        }
      }
    }
    if (edge.kind === 'river' && edge.costMinutes.ab >= edge.costMinutes.ba)
      graphErrors.push(`water direction ${edge.id}`);
  }
  check('region graph', graphErrors);
  const m = countyMetrics(c),
    area = c.terrain.length / 12800;
  const band = (name: string, value: number, min: number, max: number) =>
    out.push({ check: name, pass: value >= min && value <= max, detail: `${value}; band ${min}..${max}` });
  band('flow axis share (per mille)', m.axisSharePm, 0, 600);
  band('largest flow direction (per mille)', m.maxDirectionSharePm, 0, area >= 1 ? 350 : 450);
  // At smaller recipe sizes a few streams cannot estimate county-scale Horton statistics.
  if (area >= 1) band('Horton bifurcation ratio (x1000)', m.bifurcationRatioX1000, 3000, 5000);
  band('drainage km per sq mi (x1000)', m.drainageKmPerSqMiX1000, 650, 1800);
  band('mean first-order run (feet)', m.runMeanFtOrder1, 4000, 20000);
  band('mean second-order run (feet)', m.runMeanFtOrder2, 4000, 60000);
  band('parallel creeks (per mille)', m.parallelSharePm, 0, 100);
  band('road boundary share (per mille)', m.roadBoundarySharePm, 0, 50);
  band('road ridge or valley share (per mille)', m.roadCorridorSharePm, 700, 1000);
  band('ford points', c.hydrology.filter((v) => v.ford).length, Math.floor(15 * area), Math.ceil(70 * area));
  band('spring points', c.hydrology.filter((v) => v.spring).length, Math.floor(50 * area), Math.ceil(150 * area));
  band('cave points', c.terrain.filter((v) => v.cave).length, Math.floor(15 * area), Math.ceil(70 * area));
  band('sinkhole points', m.sinkholes, Math.floor(10 * area), Math.ceil(60 * area));
  band('mill seats', c.hydrology.filter((v) => v.millSeat).length, Math.floor(10 * area), Math.ceil(40 * area));
  const featureErrors: string[] = [];
  for (const v of c.hydrology) {
    if (
      v.ford &&
      (!v.gravelBar || v.depthIn > 24 || v.fallFt > 8 || v.trailCells?.length !== 3 || v.trailCells[1] !== v.cell)
    )
      featureErrors.push(`invalid ford ${v.cell}`);
    if (
      v.millSeat &&
      !c.settlements.some(
        (s) =>
          Math.abs((s.cell % c.recipe.size.width) - (v.cell % c.recipe.size.width)) +
            Math.abs(Math.floor(s.cell / c.recipe.size.width) - Math.floor(v.cell / c.recipe.size.width)) <=
          12,
      )
    )
      featureErrors.push(`isolated mill ${v.cell}`);
  }
  check('feature siting', featureErrors);
  return out;
}

/** Integer report values: means are hundredths, so the pure QA artifact has no floats. */
export function countyStatsDistribution(samples: GeneratedCounty['report']['stats'][]) {
  if (!samples.length) throw new Error('County statistics require at least one sample');
  const keys = Object.keys(samples[0] ?? {}) as Array<keyof GeneratedCounty['report']['stats']>;
  return Object.fromEntries(
    keys.map((key) => {
      const values = samples.map((s) => s[key]);
      return [
        key,
        {
          min: Math.min(...values),
          max: Math.max(...values),
          meanX100: Math.round((values.reduce((a, b) => a + b, 0) * 100) / values.length),
        },
      ];
    }),
  );
}
