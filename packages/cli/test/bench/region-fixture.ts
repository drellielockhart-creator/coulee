/** Synthetic farm settlements, ordinary scenario materialization/census; no production content. */
import type { ContentBundle } from '@coulee/core';

export function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing benchmark fixture data');
  return value;
}

export function countyBenchContent(base: ContentBundle, settlements = 14, householdsPerSite = 100): ContentBundle {
  const content = {
    ...base,
    sites: { ...base.sites },
    places: { ...base.places },
    regions: { ...base.regions },
    scenarios: { ...base.scenarios },
  };
  const scenario = structuredClone(required(base.scenarios.iron_ford));
  scenario.id = 'iron_ford_county_bench';
  scenario.region = scenario.id;
  const region = structuredClone(required(base.regions.iron_ford_neighbors));
  region.id = scenario.id;
  region.nodes = [required(region.nodes[0])];
  region.edges = [];
  const source = required(base.scenarios.iron_ford_neighbors);
  const household = required(source.households.find((h) => h.key === 'cedar_farm_hale'));
  const actors = source.actors.filter((a) => a.household === household.key);
  for (let site = 0; site < settlements; site++) {
    const key = `bench_${site}`;
    content.sites[key] = { ...required(base.sites.cedar_farm), id: key, grid: { w: 400, h: 400 } };
    const gate = `${key}_gate`;
    content.places[gate] = { ...required(base.places.cedar_farm_gate), id: gate, site: key };
    region.nodes.push({ id: key, site: key, entrance: gate, name: `Settlement ${site}` });
    region.edges.push({
      ...structuredClone(required(required(base.regions.iron_ford_neighbors).edges[0])),
      id: `${key}_road`,
      a: 'iron_ford',
      b: key,
      cost_minutes: site < 2 ? { ab: 300, ba: 300 } : { ab: 900, ba: 900 },
    });
    for (let h = 0; h < householdsPerSite; h++) {
      const prefix = `${key}_${h}`;
      const home = `${prefix}_home`,
        field = `${prefix}_field`;
      const x = (h % 10) * 35,
        y = Math.floor(h / 10) * 35;
      content.places[home] = { ...required(base.places.cedar_farm_house), id: home, site: key, x: x + 8, y: y + 8 };
      content.places[field] = { ...required(base.places.cedar_farm_field), id: field, site: key, x: x + 15, y: y + 2 };
      scenario.households.push({ ...structuredClone(household), key: prefix, home, head: `${prefix}_0` });
      actors.forEach((a, i) => {
        scenario.actors.push({
          ...structuredClone(a),
          key: `${prefix}_${i}`,
          given: `${a.given} ${site}-${h}`,
          household: prefix,
          workplace: field,
        });
      });
    }
  }
  content.regions[region.id] = region;
  content.scenarios[scenario.id] = scenario;
  return content;
}
