import { CELL_FT, countyRandom, Heap, neighbors8 } from './common.ts';
import { segmentFt } from './metrics.ts';
import { permitsFae } from './nature.ts';
import type {
  CountySettlement,
  FaeLayer,
  RegionEdge,
  RegionGraph,
  RegionNode,
  ResolvedCountyRecipe,
  TerrainCell,
  WaterCell,
} from './types.ts';

export function countyRoutes(
  r: ResolvedCountyRecipe,
  t: TerrainCell[],
  water: WaterCell[],
  fae: FaeLayer,
  s: CountySettlement[],
): RegionGraph {
  const nodes: RegionNode[] = s.map((v) => ({ ...v, protected: t[v.cell]?.protected ?? false }));
  for (const a of fae.anchors)
    if (permitsFae(t[a.cell] as TerrainCell))
      nodes.push({
        id: a.id,
        cell: a.cell,
        kind: 'site',
        name: `${a.court} ${a.family}`,
        required: true,
        protected: false,
      });
  const byCell = new Map(nodes.map((n) => [n.cell, n]));
  const source = s[0]?.cell as number,
    dist = new Array<number>(t.length).fill(Number.MAX_SAFE_INTEGER),
    previous = new Array<number>(t.length).fill(-1),
    heap = new Heap();
  dist[source] = 0;
  heap.push([0, source]);
  const jitter = t.map((c) => countyRandom(r, 'routes', c.id).int(0, 9));
  while (heap.data.length) {
    const [d, id] = heap.pop();
    if (d !== dist[id]) continue;
    for (const next of neighbors8(id, r.size.width, r.size.height)) {
      const c = t[next] as TerrainCell,
        w = water[next] as WaterCell;
      if (c.protected || (w.kind === 'river' && !byCell.has(next))) continue;
      // D8 roads cannot silently cross a diagonal channel between raster centers.
      const from = t[id] as TerrainCell;
      if (from.x !== c.x && from.y !== c.y) {
        const a = from.y * r.size.width + c.x,
          b = c.y * r.size.width + from.x;
        if (
          (water[a]?.kind !== 'dry' && water[a]?.downstream === b) ||
          (water[b]?.kind !== 'dry' && water[b]?.downstream === a)
        )
          continue;
      }
      const rise = Math.abs(c.elevationFt - (t[id] as TerrainCell).elevationFt);
      const cost =
        Math.round(segmentFt(id, next, r.size.width) / 13.2) +
        rise * 5 +
        (c.x <= 1 || c.x >= r.size.width - 2 || c.y <= 1 || c.y >= r.size.height - 2 ? 3000 : 0) +
        (c.soil === 'loess' || w.floodplain ? 0 : 180) +
        (c.bluff ? 200 : 0) +
        (c.slopePm > 80 ? 80 : 0) +
        (jitter[next] as number) +
        (w.kind === 'creek' && !w.ford ? 4000 : 0);
      if (d + cost < (dist[next] as number)) {
        dist[next] = d + cost;
        previous[next] = id;
        heap.push([d + cost, next]);
      }
    }
  }
  const roads = new Map<number, Set<number>>();
  const connect = (a: number, b: number) => {
    if (!roads.has(a)) roads.set(a, new Set());
    roads.get(a)?.add(b);
  };
  for (const n of nodes) {
    if (n.cell !== source && previous[n.cell] === -1)
      throw new Error(`County seed ${r.seed}: unreachable required site ${n.id}`);
    let cur = n.cell;
    while (cur !== source) {
      const p = previous[cur] as number;
      connect(cur, p);
      connect(p, cur);
      cur = p;
    }
  }
  // Every physical crossing/branch becomes a graph node; shared road miles count once.
  for (const [cell, adj] of roads)
    if (!byCell.has(cell) && (adj.size !== 2 || (water[cell] as WaterCell).ford)) {
      const node: RegionNode = {
        id: `junction_${cell}`,
        cell,
        kind: (water[cell] as WaterCell).ford ? 'ford' : 'junction',
        name: (water[cell] as WaterCell).ford ? 'Gravel ford' : 'Road junction',
        required: false,
        protected: false,
      };
      nodes.push(node);
      byCell.set(cell, node);
    }
  const edges: RegionEdge[] = [],
    used = new Set<string>();
  const key = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
  const addRoad = (a: RegionNode, b: RegionNode, cells: number[]) => {
    let climb = 0,
      descent = 0,
      maxGrade = 0,
      low = 0,
      lengthFt = 0;
    for (let i = 1; i < cells.length; i++) {
      const change =
        (t[cells[i] as number] as TerrainCell).elevationFt - (t[cells[i - 1] as number] as TerrainCell).elevationFt;
      const step = segmentFt(cells[i - 1] as number, cells[i] as number, r.size.width);
      lengthFt += step;
      climb += Math.max(0, change);
      descent += Math.max(0, -change);
      maxGrade = Math.max(maxGrade, Math.round((Math.abs(change) * 1000) / step));
    }
    for (const c of cells) if ((t[c] as TerrainCell).geology === 'sandstone') low++;
    const kind = low * 2 >= cells.length ? 'valley_road' : 'ridge_road';
    edges.push({
      id: `road_${edges.length}`,
      a: a.id,
      b: b.id,
      kind,
      cells,
      lengthFt,
      crossings: cells
        .filter((id) => water[id]?.kind === 'creek')
        .map((cell) => ({ cell, kind: water[cell]?.ford ? ('ford' as const) : ('timber_bridge' as const) })),
      climbFt: climb,
      descentFt: descent,
      gradePm: maxGrade,
      surface: cells.some((c) => (water[c] as WaterCell).ford) ? 'gravel' : 'earth',
      availableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      seasonalHazards: kind === 'valley_road' ? ['spring_mud', 'flood', 'snow'] : ['spring_mud', 'snow', 'exposure'],
      costMinutes: {
        ab: Math.ceil(lengthFt / 264 + (climb * 30) / 1000 + (descent * 15) / 1000),
        ba: Math.ceil(lengthFt / 264 + (descent * 30) / 1000 + (climb * 15) / 1000),
      },
      downstream: null,
    });
  };
  for (const a of nodes)
    for (const first of roads.get(a.cell) ?? []) {
      if (used.has(key(a.cell, first))) continue;
      const path = [a.cell, first];
      used.add(key(a.cell, first));
      let prev = a.cell,
        cur = first;
      while (!byCell.has(cur)) {
        const next = [...(roads.get(cur) ?? [])].find((n) => n !== prev) as number;
        used.add(key(cur, next));
        path.push(next);
        prev = cur;
        cur = next;
      }
      addRoad(a, byCell.get(cur) as RegionNode, path);
    }
  const landings = nodes.filter((n) => n.kind === 'landing').sort((a, b) => a.cell - b.cell);
  for (let i = 1; i < landings.length; i++) {
    const a = landings[i - 1] as RegionNode,
      b = landings[i] as RegionNode,
      cells: number[] = [];
    for (let id = a.cell; id <= b.cell; id += r.size.width) cells.push(id);
    const lengthFt = (cells.length - 1) * CELL_FT;
    edges.push({
      id: `river_${i}`,
      a: a.id,
      b: b.id,
      kind: 'river',
      cells,
      lengthFt,
      climbFt: 0,
      descentFt: (t[a.cell] as TerrainCell).elevationFt - (t[b.cell] as TerrainCell).elevationFt,
      gradePm: 0,
      surface: 'water',
      availableMonths: [4, 5, 6, 7, 8, 9, 10, 11],
      seasonalHazards: ['ice', 'flood'],
      costMinutes: { ab: Math.ceil(lengthFt / 396), ba: Math.ceil(lengthFt / 154) },
      downstream: 'ab',
    });
  }
  const anchors = fae.anchors.filter((a) => permitsFae(t[a.cell] as TerrainCell));
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1],
      b = anchors[i];
    if (!a || !b) continue;
    const minutes = countyRandom(r, 'routes', `fae:${a.id}:${b.id}`).int(20, 90);
    edges.push({
      id: `fae_${i}`,
      a: a.id,
      b: b.id,
      kind: 'fae_path',
      cells: [],
      lengthFt: 0,
      climbFt: 0,
      descentFt: 0,
      gradePm: 0,
      surface: 'other',
      availableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      seasonalHazards: ['fae_conditions'],
      costMinutes: { ab: minutes, ba: minutes },
      downstream: null,
    });
  }
  return { nodes, edges };
}
