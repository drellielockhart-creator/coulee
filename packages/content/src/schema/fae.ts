import { z } from 'zod';
import type { ContentBundle } from './bundle.ts';
import { defineDomain, type Issue, id, int, nonNegInt, posInt, ref } from './common.ts';
export const OmenSchema = z
  .strictObject({
    id: id(),
    family: id(),
    fi_min: int().min(0).max(5),
    fi_max: int().min(0).max(5),
    tags: z.array(id()).default([]),
    weight: int().min(1).default(100),
    tag_weights: z.record(z.string(), int().min(0)).default({}),
    glamour: z.boolean().default(false),
    deep_sense: z.boolean().default(false),
    sight: z.boolean().default(true),
    notice_dc: int(),
    read_dc: int().default(10),
    plain_dc: int().default(12),
    duration_minutes: int().min(60).max(360).default(180),
    trace_minutes: int().min(1440).max(4320).default(4320),
    thins: int().min(-25).max(25),
    subtle: z.boolean().default(false),
    text: z.array(z.string()).min(1),
    plain: z.array(z.string()).min(1),
    signature: z.string(),
    reading: z.string(),
    counter: z.string(),
  })
  .refine((d) => d.text.length === d.plain.length, {
    message: 'Each surface variant must have its matching mundane reading',
    path: ['plain'],
  });

// ---- Fae charms (13 §5; slice 1b) --------------------------------------------------------

/** Counterparties (13 §1.1: "a court or the River"). */
export const COUNTERPARTIES = ['hearth', 'thorn', 'under', 'alder', 'river'] as const;
/** Claim groups: desire sums the best claim per group (13 §5.6). */
export const CLAIM_GROUPS = ['output', 'nature', 'danger'] as const;
/** How a claim was reached from its parent; `truth` marks a seed only evidence can reach. */
export const CLAIM_ROUTES = ['exaggerates', 'supernaturalizes', 'truncates', 'truth'] as const;
/** Where a draw may take from (13 §5.1): place stock at a store or mill, or a household's stores. */
export const DRAW_SOURCES = ['store', 'mill', 'club_pantry', 'household'] as const;

/** One thing the town may say about a charm; compiled to the predicate `claim.<item>.<id>(item)`. */
export const ClaimSchema = z.strictObject({
  id: id(),
  group: z.enum(CLAIM_GROUPS),
  /** "{0} keeps a family in bread"; {0} is the item. */
  text: z.string().min(1),
  /** Believed utility (output) or danger (danger) of the claim, 0..100 (13 §5.6 U, R). */
  weight: int().min(0).max(100),
  /** The claim this one grows from by rumor, and how. */
  from: id().optional(),
  route: z.enum(CLAIM_ROUTES).optional(),
  juiciness: int().min(0).max(100).default(40),
  valence: int().min(-100).max(100).default(0),
});
export type ClaimDef = z.output<typeof ClaimSchema>;

export const CharmRechargeSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('offering'),
    /** Items really consumed (13 §5.4). */
    items: z.array(z.strictObject({ def: ref(), qty: posInt() })).min(1),
    where: z.literal('keeper_hearth'),
    amount: posInt(),
    /** Minutes before the next offering is accepted; > 0 (no zero-time loops). */
    cooldown_minutes: posInt(),
  }),
  z.strictObject({
    kind: z.literal('dew'),
    amount: posInt(),
    /** Hung outdoors, empty, at dawn, no rain, above this temperature. */
    min_temp_f: int().default(33),
  }),
]);
export type CharmRechargeDef = z.output<typeof CharmRechargeSchema>;

export const CharmEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('draw'),
    defs: z.array(ref()).min(1),
    /** Whole units at most per dawn. */
    qty: posInt(),
    at: z.literal('dawn'),
    /** Virtue spent on a dawn that moves at least one unit. */
    virtue: posInt(),
    radius_mi: posInt(),
    from: z.array(z.enum(DRAW_SOURCES)).min(1),
    /** Iron Presence (g) at a source's bin that wards it (13 §5.2: 2 lb). */
    ward_g: posInt().default(908),
    /** The visible trace a draw leaves at its source (for discovery and the epilogue). */
    trace: z.string(),
  }),
  z.strictObject({
    kind: z.literal('container_dry'),
    /** Virtue per block of exposure. */
    virtue: posInt(),
    block_minutes: posInt(),
    /** Most the hemmed container may hold for the hem to cover it. */
    max_contents_g: posInt(),
    /** Where the turned rain goes (13 §5.8: the nearest other uncovered container). */
    spill: z.enum(['nearest_uncovered', 'none']).default('nearest_uncovered'),
  }),
]);
export type CharmEffectDef = z.output<typeof CharmEffectSchema>;

export const CharmSchema = z.strictObject({
  /** Charms are keyed by item def id (13 §5.1). */
  id: id(),
  item: ref(),
  /** What talk calls it: "the moonsilk flour sack". */
  called: z.string().min(1),
  /** The saying that comes with it, quoted on identification. */
  saying: z.string().default(''),
  court: z.enum(COUNTERPARTIES),
  tier: int().min(0).max(5),
  /** Rec 6: stored charms work at FI 0 when this is 0. */
  minimum_fi: int().min(0).max(5).default(0),
  /** 13 §1.1 [DECISION]: whose act the third-party effect is. */
  harm_basis: z.enum(['instrument', 'fae']),
  virtue: z.strictObject({ max: posInt(), start: nonNegInt() }),
  activation: z.strictObject({
    kind: z.enum(['tied_overnight', 'automatic']),
    /** Tied shut in the dark: the tie must be made at or after dusk. */
    dark: z.boolean().default(false),
  }),
  recharge: z.array(CharmRechargeSchema).min(1),
  effects: z.array(CharmEffectSchema).min(1),
  iron: z.strictObject({
    contact: z.enum(['suppress', 'dormant_day']),
    /** Iron Presence (g) in contact or the same container that suppresses it. */
    nearby_g: posInt(),
    /** Condition lost per day under iron; below `recharge_floor` it stops recharging, at 0 it is ordinary. */
    sour_per_day: nonNegInt(),
    recharge_floor: int().min(0).max(100).default(25),
  }),
  quirks: z.array(ref()).default([]),
  /** 0..100 (13 §5.6 L). */
  allure: int().min(0).max(100),
  /** What happens at no source, no room or no virtue: nothing moves (13 §5.8 failure). */
  failure: z.string().min(1),
  expiry: z.string().default('none'),
  /** Specimen valuation, cents (13 §5.8; not shop stock). */
  value_cents: nonNegInt().default(0),
  claims: z.array(ClaimSchema).min(1),
});
export type CharmDef = z.output<typeof CharmSchema>;

export const QuirkSchema = z.strictObject({
  id: id(),
  name: z.string().min(1),
  text: z.string().min(1),
  /** Minutes thanks aloud block recharge (`unthanked`). */
  block_minutes: nonNegInt().default(0),
});
export type QuirkDef = z.output<typeof QuirkSchema>;

/**
 * A charm lying somewhere to be found (13 §6.3 "Found"): a reservoir entry for a scenario.
 * A hazard per eligible actor-hour (an activity carrying one of `activity_tags`, at the place),
 * `find_permille`, then Perception vs `notice_dc`; at most one find per charm per season.
 */
export const ReservoirSchema = z.strictObject({
  item: ref(),
  place: ref(),
  /** Days after the scenario start before it lies there (the fixture pins it on day 3). */
  from_day: nonNegInt().default(0),
  find_permille: int().min(1).max(1000).default(5),
  /** Gathering at the place (an activity that yields goods at a venue: forage, sugar, wood) counts. */
  gathering: z.boolean().default(true),
  notice_dc: int().default(15),
  activity_tags: z.array(id()).default(['wild_production']),
  /** Virtue it is found with (a charm lain under the hill may be full); default its start. */
  virtue: nonNegInt().optional(),
});
export type ReservoirDef = z.output<typeof ReservoirSchema>;

/** Scenario fields owned by module:fae (composed into the scenario schema). */
export const faeScenarioFields = {
  fae_reservoir: z.array(ReservoirSchema).default([]),
};

export const faeDomains = {
  omens: defineDomain({ dir: 'fae', key: 'omen', schema: OmenSchema }),
  charms: defineDomain({ dir: 'fae', key: 'charm', schema: CharmSchema }),
  quirks: defineDomain({ dir: 'fae', key: 'quirk', schema: QuirkSchema }),
};

/** The derived predicate id of a charm claim (13 §5.3). */
export function claimPredicate(itemDefId: string, claimId: string): string {
  return `claim.${itemDefId}.${claimId}`;
}

const ROUTE_FIELD = {
  exaggerates: 'exaggerates_to',
  supernaturalizes: 'supernaturalizes_to',
  truncates: 'truncates_to',
} as const;

/**
 * Validate a charm's claim graph (13 §5.3): at most one child per route, no cycles, every claim
 * reachable from a seed (a claim without `from`), a `from` needs a route and vice versa except
 * for `truth` seeds.
 */
export function claimGraphIssues(c: CharmDef): Issue[] {
  const where = `charms:${c.id}`;
  const out: Issue[] = [];
  const byId = new Map(c.claims.map((x) => [x.id, x]));
  if (byId.size !== c.claims.length) out.push({ where, path: 'claims', message: 'duplicate claim id' });
  const children = new Map<string, number>();
  for (const x of c.claims) {
    if (x.from !== undefined) {
      if (!byId.has(x.from)) out.push({ where, path: `claims.${x.id}.from`, message: `unknown claim '${x.from}'` });
      if (x.route === undefined || x.route === 'truth')
        out.push({ where, path: `claims.${x.id}.route`, message: 'a claim grown from another needs a rumor route' });
      const key = `${x.from}:${x.route}`;
      children.set(key, (children.get(key) ?? 0) + 1);
      if ((children.get(key) ?? 0) > 1)
        out.push({ where, path: `claims.${x.id}`, message: `'${x.from}' has two ${x.route} children` });
    } else if (x.route !== undefined && x.route !== 'truth')
      out.push({ where, path: `claims.${x.id}.route`, message: 'a seed claim takes no rumor route' });
  }
  for (const x of c.claims) {
    const seen = new Set<string>();
    let cur: ClaimDef | undefined = x;
    while (cur?.from !== undefined) {
      if (seen.has(cur.id)) {
        out.push({ where, path: `claims.${x.id}`, message: 'claim cycle' });
        break;
      }
      seen.add(cur.id);
      cur = byId.get(cur.from);
    }
  }
  return out;
}

/**
 * Bundle-time derivation (13 §5.3): each claim becomes a predicate `claim.<item>.<claim>(item)`,
 * and each `from`/`route` edge the parent's `exaggerates_to`, `supernaturalizes_to` or
 * `truncates_to`, so rumor mutation needs no new code. Runs before hashing and cross-checks.
 */
export function deriveCharmClaims(tables: Record<string, Record<string, unknown>>, issues: Issue[]): void {
  const charms = tables.charms as Record<string, CharmDef> | undefined;
  const preds = tables.predicates as Record<string, Record<string, unknown>> | undefined;
  if (!charms || !preds) return;
  for (const key of Object.keys(charms).sort()) {
    const c = charms[key];
    if (!c) continue;
    const graph = claimGraphIssues(c);
    issues.push(...graph);
    if (graph.length) continue;
    for (const x of c.claims) {
      const pid = claimPredicate(c.item, x.id);
      if (preds[pid]) {
        issues.push({ where: `charms:${c.id}`, path: `claims.${x.id}`, message: `predicate '${pid}' already exists` });
        continue;
      }
      const edges: Record<string, string> = {};
      for (const y of c.claims)
        if (y.from === x.id && y.route !== undefined && y.route !== 'truth')
          edges[ROUTE_FIELD[y.route]] = claimPredicate(c.item, y.id);
      preds[pid] = {
        id: pid,
        args: ['item'],
        text: x.text,
        description: `A claim about a fae charm (${c.id}, ${x.group}).`,
        juiciness: x.juiciness,
        valence: x.valence,
        supernatural: x.route === 'supernaturalizes' || x.group === 'nature',
        tags: ['charm_claim', `claim_${x.group}`],
        prior: 5,
        charge: false,
        act: false,
        magic: false,
        moralizes_to: [],
        projects: [],
        ...edges,
      };
    }
  }
}

/** Cross-references and the 13 §5.8 "every shipping charm specifies" checks. */
export function faeRefs(b: ContentBundle): Issue[] {
  const out: Issue[] = [];
  for (const c of Object.values(b.charms ?? {})) {
    const where = `charms:${c.id}`;
    const item = b.items[c.item];
    if (c.id !== c.item) out.push({ where, path: 'id', message: 'a charm is keyed by its item id' });
    if (!item) out.push({ where, path: 'item', message: `unknown item '${c.item}'` });
    else {
      if (item.section !== 'fae') out.push({ where, path: 'item', message: 'charm items sit in the fae section' });
      if (item.stackable) out.push({ where, path: 'item', message: 'a charm item is not stackable' });
    }
    if (c.virtue.start > c.virtue.max) out.push({ where, path: 'virtue', message: 'start exceeds max' });
    for (const q of c.quirks) if (!b.quirks?.[q]) out.push({ where, path: 'quirks', message: `unknown quirk '${q}'` });
    for (const r of c.recharge)
      if (r.kind === 'offering')
        for (const it of r.items)
          if (!b.items[it.def]) out.push({ where, path: 'recharge', message: `unknown item '${it.def}'` });
    for (const e of c.effects) {
      if (e.kind === 'draw') {
        for (const d of e.defs) if (!b.items[d]) out.push({ where, path: 'effects', message: `unknown item '${d}'` });
        if (!item?.container) out.push({ where, path: 'effects', message: 'a drawing charm must be a container' });
        if (c.activation.kind !== 'tied_overnight')
          out.push({ where, path: 'activation', message: 'a draw needs an overnight activation' });
      }
      if (e.kind === 'container_dry' && c.activation.kind !== 'automatic')
        out.push({ where, path: 'activation', message: 'container_dry is automatic' });
    }
    if (!c.claims.some((x) => x.from === undefined && x.route !== 'truth'))
      out.push({ where, path: 'claims', message: 'needs a seed claim the town can start from' });
  }
  return out;
}
