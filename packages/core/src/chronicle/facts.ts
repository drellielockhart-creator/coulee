/**
 * Story atoms: events normalized for sifting (05 §9.1). A Fact says who did what to whom,
 * where, who could have known (P1), and how notable it is on its face. Detectors and the
 * notability scorer read Facts, never raw events. OWNER: module:chronicle.
 */
import { propText } from '../belief/api.ts';
import type { ContentBundle } from '../content.ts';
import type { Event } from '../events/index.ts';
import type { ActorId, HouseholdId } from '../ids.ts';
import type { World } from '../world.ts';
import type { PatternParams } from './params.ts';
import type { Bindings } from './prose.ts';
import { uniq } from './text.ts';

export type FactClass =
  | 'harm'
  | 'help'
  | 'courtship'
  | 'debt'
  | 'dun'
  | 'repay'
  | 'gossip'
  | 'chat'
  | 'confession'
  | 'other'
  | 'label'
  | 'belief'
  | 'transmit'
  | 'grudge'
  | 'escalation'
  | 'defense'
  | 'shortage'
  | 'nutrition'
  | 'purchase'
  | 'spoiled'
  | 'meal'
  | 'consumed'
  | 'need';

export interface Fact {
  ev: Event;
  id: number;
  kind: string;
  t: number;
  /** Place id, 0 if none. */
  place: number;
  /** First actor (agent/holder/subject), 0 if none; second actor (target), 0 if none. */
  agent: number;
  target: number;
  /** Everyone involved, agent and target first, unique. */
  actors: number[];
  households: number[];
  /** Public, or known only to `by` (P1). */
  pub: boolean;
  by: number[];
  /** A mind event: the owner feels it, nobody sees it. */
  inner: boolean;
  cls: FactClass;
  /** Finer discriminator: interaction id, defense id, condition id, need id, item def... */
  sub: string;
  success: boolean | null;
  /** Base importance 0..100 on its face. */
  base: number;
  /** −100..100 */
  valence: number;
  /** Detector magnitude: credence, cents, days (tenths), rung, quantity. */
  weight: number;
  /** Bindings this fact contributes to a single-event entry. */
  bind: Bindings;
}

/** Interaction vocabulary, tunable in content (`notability` pattern record). */
export interface ClassVocab {
  harmKinds: readonly string[];
  helpKinds: readonly string[];
  courtKinds: readonly string[];
  debtKinds: readonly string[];
  confessKinds: readonly string[];
  harmIds: readonly string[];
  helpIds: readonly string[];
  courtIds: readonly string[];
  dunIds: readonly string[];
  repayIds: readonly string[];
}

export function classVocab(p: PatternParams): ClassVocab {
  return {
    harmKinds: p.l('harm_kinds', ['insult', 'fight', 'theft', 'accusation', 'threat']),
    helpKinds: p.l('help_kinds', ['kindness', 'help', 'gift']),
    courtKinds: p.l('court_kinds', ['courtship']),
    debtKinds: p.l('debt_kinds', ['debt']),
    confessKinds: p.l('confess_kinds', ['confession']),
    harmIds: p.l('harm_ids', ['insult', 'accuse', 'slander', 'steal', 'attack', 'curse', 'threaten', 'fight']),
    helpIds: p.l('help_ids', ['help', 'gift', 'lend', 'aid', 'comfort', 'share_food', 'share', 'nurse']),
    courtIds: p.l('court_ids', ['court', 'flirt', 'walk_out', 'propose', 'woo']),
    dunIds: p.l('dun_ids', ['dun', 'demand_payment']),
    repayIds: p.l('repay_ids', ['repay', 'pay_debt', 'settle', 'pay_up']),
  };
}

/** Who could know an event: `extra` are the participants the payload names, agent first. */
export function knowledgeOf(ev: Event, extra: readonly number[]): { pub: boolean; by: number[]; inner: boolean } {
  const roles = ev.roles.map((r) => r.actor as number);
  switch (ev.visibility) {
    case 'public':
      return { pub: true, by: [], inner: false };
    case 'witnessed':
    case 'private':
      return { pub: false, by: uniq([...extra, ...roles].filter((x) => x > 0)), inner: false };
    case 'secret':
      return { pub: false, by: uniq(extra.filter((x) => x > 0)).slice(0, 1), inner: false };
    default:
      return { pub: false, by: uniq(extra.filter((x) => x > 0)).slice(0, 1), inner: true };
  }
}

function householdMembers(world: World, hid: number): number[] {
  return (world.households[hid as HouseholdId]?.memberIds ?? []).map((m) => m as number);
}

function householdOf(world: World, actor: number): number {
  return actor ? (world.actors[actor as ActorId]?.householdId ?? 0) : 0;
}

function lower(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function classOfInteraction(
  content: ContentBundle,
  v: ClassVocab,
  interactionId: string,
): { cls: FactClass; notable: boolean; name: string } {
  const def = content.interactions?.[interactionId];
  const kind = def?.memory?.kind ?? '';
  const name = (def?.name ?? interactionId.replace(/_/g, ' ')).toLowerCase();
  const notable = def?.notable ?? false;
  let cls: FactClass = 'other';
  if (v.dunIds.includes(interactionId)) cls = 'dun';
  else if (v.repayIds.includes(interactionId)) cls = 'repay';
  else if (def?.transmits_rumor || kind === 'gossip') cls = 'gossip';
  else if (v.harmKinds.includes(kind) || v.harmIds.includes(interactionId)) cls = 'harm';
  else if (v.helpKinds.includes(kind) || v.helpIds.includes(interactionId)) cls = 'help';
  else if (v.courtKinds.includes(kind) || v.courtIds.includes(interactionId)) cls = 'courtship';
  else if (v.debtKinds.includes(kind)) cls = 'debt';
  else if (v.confessKinds.includes(kind)) cls = 'confession';
  else if (kind === 'chat' || kind === 'sermon') cls = 'chat';
  return { cls, notable, name };
}

const CLASS_BASE: Record<string, number> = {
  harm: 30,
  help: 25,
  courtship: 25,
  debt: 25,
  dun: 35,
  repay: 40,
  gossip: 8,
  chat: 0,
  confession: 40,
  other: 8,
};
const CLASS_VALENCE: Record<string, number> = {
  harm: -60,
  help: 50,
  courtship: 40,
  debt: -10,
  dun: -30,
  repay: 30,
  gossip: -5,
  chat: 5,
  confession: 20,
  other: 0,
};

/** Depth of a need band: 0 = fine, 1 = mildest named band ... bands.length = the worst. */
export function needDepth(content: ContentBundle, needId: string, band: string): { depth: number; of: number } {
  const bands = content.needs?.[needId]?.bands ?? [];
  const idx = bands.findIndex((b) => b.label === band);
  return { depth: idx < 0 ? 0 : idx + 1, of: bands.length };
}

/** Subject actor of a proposition (its first actor argument), 0 if none. */
function subjectOfProp(world: World, propId: number): number {
  const prop = world.belief?.props?.[propId as never] as { args: Array<{ kind: string; id?: number }> } | undefined;
  const a = prop?.args.find((x) => x.kind === 'actor');
  return a?.id ?? 0;
}

export function factOf(world: World, content: ContentBundle, ev: Event, vocab: ClassVocab): Fact | null {
  const base = (over: Partial<Fact> & Pick<Fact, 'cls' | 'sub'>, extra: readonly number[]): Fact => {
    const k = knowledgeOf(ev, extra);
    const actors = uniq([...extra, ...ev.roles.map((r) => r.actor as number)].filter((x) => x > 0));
    const agent = over.agent ?? extra[0] ?? 0;
    const target = over.target ?? extra[1] ?? 0;
    const households = uniq([agent, target].map((a) => householdOf(world, a)).filter((h) => h > 0));
    return {
      ev,
      id: ev.id as number,
      kind: ev.kind,
      t: ev.t as number,
      place: (ev.place as number | undefined) ?? 0,
      agent,
      target,
      actors,
      households,
      pub: k.pub,
      by: k.by,
      inner: k.inner,
      success: null,
      base: ev.importance ?? 0,
      valence: 0,
      weight: 0,
      bind: {},
      ...over,
    };
  };

  switch (ev.kind) {
    case 'social.interaction': {
      const d = ev.data;
      const c = classOfInteraction(content, vocab, d.interactionId);
      const dflt = (CLASS_BASE[c.cls] ?? 8) + (c.notable ? 20 : 0) + (d.success ? 0 : -3);
      return base(
        {
          cls: c.cls,
          sub: d.interactionId,
          agent: d.initiatorId,
          target: d.targetId,
          success: d.success,
          base: ev.importance ?? Math.max(0, dflt),
          valence: CLASS_VALENCE[c.cls] ?? 0,
          place: (d.placeId as number | null) ?? (ev.place as number | undefined) ?? 0,
          bind: {
            interaction: d.interactionId,
            interaction_name: c.name,
            label: d.label,
            success: d.success,
            cls: c.cls,
          },
        },
        [d.initiatorId, d.targetId],
      );
    }
    case 'social.label_changed': {
      const d = ev.data;
      return base(
        {
          cls: 'label',
          sub: lower(d.to),
          agent: d.holderId,
          target: d.targetId,
          base: ev.importance ?? 30,
          bind: { band: d.to, cls: 'label' },
        },
        [d.holderId, d.targetId],
      );
    }
    case 'belief.formed': {
      const d = ev.data;
      const prop = world.belief?.props?.[d.propId as never] as { pred: string } | undefined;
      const subject = subjectOfProp(world, d.propId);
      return base(
        {
          cls: 'belief',
          sub: prop?.pred ?? '',
          agent: d.holderId,
          target: subject,
          weight: d.credence,
          base: ev.importance ?? 10,
          bind: { pred: prop?.pred ?? '', rumor: d.text, cls: 'belief' },
        },
        [d.holderId, subject],
      );
    }
    case 'belief.transmitted': {
      const d = ev.data;
      const prop = world.belief?.props?.[d.propId as never] as { pred: string } | undefined;
      const text = propText(world, content, d.propId);
      return base(
        {
          cls: 'transmit',
          sub: prop?.pred ?? '',
          agent: d.speakerId,
          target: d.listenerId,
          success: d.accepted,
          weight: d.rumorId as number,
          base: ev.importance ?? 8,
          bind: { pred: prop?.pred ?? '', rumor: text, mutation: d.mutation ?? '', cls: 'transmit' },
        },
        [d.speakerId, d.listenerId],
      );
    }
    case 'belief.grudge_formed': {
      const d = ev.data;
      return base(
        {
          cls: 'grudge',
          sub: d.aim,
          agent: d.holderId,
          weight: d.intensity,
          valence: -50,
          base: ev.importance ?? 30 + Math.floor(d.intensity / 5),
          bind: { cls: 'grudge', kind: d.aim },
        },
        [d.holderId],
      );
    }
    case 'belief.escalation': {
      const d = ev.data;
      return base(
        {
          cls: 'escalation',
          sub: String(d.to),
          weight: d.to,
          valence: -70,
          base: ev.importance ?? 40 + 10 * d.to,
          bind: { cls: 'escalation', rung: d.to },
        },
        [],
      );
    }
    case 'psyche.defense': {
      const d = ev.data;
      return base(
        {
          cls: 'defense',
          sub: d.defense,
          agent: d.actorId,
          target: d.targetId ?? 0,
          weight: d.anxietyBefore,
          valence: -20,
          base: ev.importance ?? 15 + Math.min(30, Math.floor(d.anxietyBefore / 20)),
          bind: { cls: 'defense', defense: d.defense, anxiety: d.anxietyBefore },
        },
        [d.actorId, d.targetId ?? 0],
      );
    }
    case 'provisions.shortage': {
      const d = ev.data;
      const members = householdMembers(world, d.householdId);
      const k = knowledgeOf(ev, members);
      const f = base(
        {
          cls: 'shortage',
          sub: String(d.householdId),
          agent: 0,
          target: 0,
          weight: d.daysOfFoodTenths,
          valence: -40,
          base: ev.importance ?? (d.daysOfFoodTenths < 30 ? 55 : 35),
          bind: { cls: 'shortage', ration_pct: d.rationPct },
        },
        members,
      );
      f.households = [d.householdId as number];
      f.pub = k.pub;
      f.by = k.by;
      f.actors = members.slice(0, 6);
      return f;
    }
    case 'provisions.nutrition': {
      const d = ev.data;
      const hh = householdOf(world, d.actorId);
      const members = hh ? householdMembers(world, hh) : [d.actorId as number];
      const f = base(
        {
          cls: 'nutrition',
          sub: d.condition,
          agent: d.actorId,
          valence: d.on ? -50 : 25,
          success: d.on,
          weight: d.on ? 1 : 0,
          base: ev.importance ?? (d.on ? 55 : 25),
          bind: { cls: 'nutrition', condition: d.condition },
        },
        [d.actorId],
      );
      if (ev.visibility !== 'public') f.by = uniq([d.actorId as number, ...members]);
      return f;
    }
    case 'provisions.purchase': {
      const d = ev.data;
      return base(
        {
          cls: 'purchase',
          sub: d.defId,
          agent: d.buyerId,
          weight: d.priceCents,
          success: d.onCredit,
          place: (d.placeId as number | undefined) ?? 0,
          base: ev.importance ?? 0,
          bind: { cls: 'purchase', food: d.defId },
        },
        [d.buyerId],
      );
    }
    case 'provisions.spoiled': {
      const d = ev.data;
      const owner = ev.roles[0]?.actor as number | undefined;
      return base(
        {
          cls: 'spoiled',
          sub: d.defId,
          weight: d.qty,
          valence: -20,
          base: ev.importance ?? 0,
          bind: { cls: 'spoiled' },
        },
        owner ? [owner] : [],
      );
    }
    case 'provisions.meal': {
      const d = ev.data;
      const f = base(
        { cls: 'meal', sub: d.hot ? 'hot' : 'cold', agent: d.actorId, weight: d.kcal, base: 0, bind: { cls: 'meal' } },
        [d.actorId],
      );
      if (d.householdId) f.households = [d.householdId as number];
      return f;
    }
    case 'needs.band_changed': {
      const d = ev.data;
      const { depth, of } = needDepth(content, d.needId, d.to);
      const need = content.needs?.[d.needId];
      const severe = depth > 0 && depth === of && of >= 2 && need?.kind === 'physical';
      const hh = householdOf(world, d.actorId);
      const f = base(
        {
          cls: 'need',
          sub: d.needId,
          agent: d.actorId,
          weight: depth,
          success: severe,
          valence: severe ? -40 : 0,
          base: ev.importance ?? (severe ? 40 : 3),
          bind: {
            cls: 'need',
            need: d.needId,
            need_name: (need?.name ?? d.needId).toLowerCase(),
            band: d.to.toLowerCase(),
          },
        },
        [d.actorId],
      );
      if (ev.visibility !== 'public') f.by = uniq([d.actorId as number, ...(hh ? householdMembers(world, hh) : [])]);
      return f;
    }
    case 'items.consumed': {
      const d = ev.data;
      return base(
        { cls: 'consumed', sub: d.defId, weight: d.qty, base: 0, bind: { cls: 'consumed' } },
        ev.roles[0] ? [ev.roles[0].actor as number] : [],
      );
    }
    default:
      return null;
  }
}
