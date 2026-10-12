/**
 * Story atoms: events normalized for sifting (05 §9.1). A Fact says who did what to whom,
 * where, who could have known (P1), and how notable it is on its face. Detectors and the
 * notability scorer read Facts, never raw events. OWNER: module:chronicle.
 */
import type { ContentBundle } from '../content.ts';
import type { Event } from '../events/index.ts';
import type { ActorId, HouseholdId } from '../ids.ts';
import { readinessOf } from '../provisions/api.ts';
import type { World } from '../world.ts';
import {
  conditionName,
  defenseNames,
  familiesOf,
  familyOfActor,
  formalName,
  misfortuneText,
  predOfProp,
  resolveTarget,
  rumorText,
  rungName,
  shortNameOf,
  subjectOfProp,
} from './names.ts';
import type { PatternParams } from './params.ts';
import type { Bindings } from './prose.ts';
import { uniq } from './text.ts';

export type FactClass =
  | 'harm'
  | 'help'
  | 'courtship'
  | 'amends'
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
  | 'need'
  | 'misfortune'
  | 'figure'
  | 'reveal'
  | 'gathering'
  | 'observance'
  | 'rupture'
  /** A fae charm's story (13 §6.7): arrival, uses, draws, loans, discoveries, resolutions. */
  | 'charm'
  | 'reconciled';

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
  /** The person a belief event is about (the rumor's subject, the escalation's target), 0 if none. */
  subject: number;
  /** Proposition id for belief events, 0 if none. */
  prop: number;
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
  amendsKinds: readonly string[];
  debtKinds: readonly string[];
  dunKinds: readonly string[];
  repayKinds: readonly string[];
  confessKinds: readonly string[];
  chatKinds: readonly string[];
  harmIds: readonly string[];
  helpIds: readonly string[];
  courtIds: readonly string[];
  dunIds: readonly string[];
  repayIds: readonly string[];
  /** Need ids whose worst band is a story (hunger yes, a tired afternoon no). */
  storyNeeds: readonly string[];
  /** Condition ids worth a line (scurvy, malnourished); others ('drunk') are not nutrition stories. */
  nutritionConditions: readonly string[];
  /** [past tense, noun] for an interaction id ("insulted", "insult"); [] if unknown. */
  verb(interactionId: string): readonly string[];
}

export function classVocab(p: PatternParams): ClassVocab {
  return {
    harmKinds: p.l('harm_kinds', ['slight', 'snub', 'mockery', 'insult', 'threat', 'fight', 'theft', 'accusation']),
    helpKinds: p.l('help_kinds', ['help', 'gift', 'comfort']),
    courtKinds: p.l('court_kinds', ['courtship', 'betrothal']),
    amendsKinds: p.l('amends_kinds', ['apology', 'forgiveness']),
    debtKinds: p.l('debt_kinds', ['loan']),
    dunKinds: p.l('dun_kinds', ['dunning']),
    repayKinds: p.l('repay_kinds', ['repayment']),
    confessKinds: p.l('confess_kinds', ['confession']),
    chatKinds: p.l('chat_kinds', [
      'chat',
      'sermon',
      'kindness',
      'introduction',
      'toast',
      'tale',
      'prayer',
      'confidence',
      'warning',
    ]),
    harmIds: p.l('harm_ids', ['insult', 'accuse', 'slander', 'steal', 'attack', 'curse', 'threaten', 'fight']),
    helpIds: p.l('help_ids', ['help', 'gift', 'aid', 'comfort', 'share_food', 'share', 'nurse']),
    courtIds: p.l('court_ids', ['court', 'flirt', 'walk_out', 'propose', 'woo']),
    dunIds: p.l('dun_ids', ['dun', 'demand_payment']),
    repayIds: p.l('repay_ids', ['repay', 'pay_debt', 'settle', 'pay_up']),
    storyNeeds: p.l('story_needs', ['hunger', 'thirst', 'warmth']),
    nutritionConditions: p.l('nutrition_conditions', ['scurvy_early', 'scurvy', 'malnourished']),
    verb: (id) => p.l(`verb_${id}`, []),
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

/** At three weeks of food in hand nobody is short (provisions' first ration cut, rules.ts). */
const SHORT_TENTHS = 210;

/** Days of food (tenths) every member carries beyond the pantry: the least any one of them has. */
function carriedTenths(world: World, content: ContentBundle, members: readonly number[], t: number): number {
  let least = Number.MAX_SAFE_INTEGER;
  for (const m of members) {
    if (!world.actors[m as ActorId]?.alive) continue;
    least = Math.min(least, readinessOf(world, content, { actorId: m as ActorId }, t, 22).daysOfFoodTenths);
    if (least === 0) break;
  }
  return least === Number.MAX_SAFE_INTEGER ? 0 : least;
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
  if (v.dunIds.includes(interactionId) || v.dunKinds.includes(kind)) cls = 'dun';
  else if (v.repayIds.includes(interactionId) || v.repayKinds.includes(kind)) cls = 'repay';
  // A charge flung in someone's face is harm, not news, though it carries a claim; a confidence
  // is close talk, not gossip (playtest 2026-10-11: the journal wondered what an accusation was about).
  else if (v.harmKinds.includes(kind) || v.harmIds.includes(interactionId)) cls = 'harm';
  else if ((def?.transmits_rumor && def.rumor_mode !== 'confidence') || kind === 'gossip') cls = 'gossip';
  else if (v.helpKinds.includes(kind) || v.helpIds.includes(interactionId)) cls = 'help';
  else if (v.courtKinds.includes(kind) || v.courtIds.includes(interactionId)) cls = 'courtship';
  else if (v.amendsKinds.includes(kind)) cls = 'amends';
  else if (v.debtKinds.includes(kind)) cls = 'debt';
  else if (v.confessKinds.includes(kind)) cls = 'confession';
  else if (v.chatKinds.includes(kind)) cls = 'chat';
  return { cls, notable, name };
}

const CLASS_BASE: Record<string, number> = {
  harm: 30,
  help: 25,
  courtship: 25,
  amends: 20,
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
  amends: 35,
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
      subject: 0,
      prop: 0,
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
            act: vocab.verb(d.interactionId)[0] ?? 'had dealings with',
            act_pp: vocab.verb(d.interactionId)[2] ?? vocab.verb(d.interactionId)[0] ?? 'had dealings with',
            act_noun: vocab.verb(d.interactionId)[1] ?? c.name,
            label: d.label,
            success: d.success,
            // playtest r2: "I came away knowing more" only when something was told.
            told: d.told === true,
            cls: c.cls,
            via_defense: d.viaDefense ?? '',
            household:
              householdOf(world, d.initiatorId as number) > 0 &&
              householdOf(world, d.initiatorId as number) === householdOf(world, d.targetId as number),
            family: familyOfActor(world, d.initiatorId as number),
            item_id: (d.itemId as number | undefined) ?? 0,
          },
        },
        [d.initiatorId, d.targetId],
      );
    }
    case 'fae.charm_arrived':
    case 'fae.charm_used':
    case 'fae.charm_drew':
    case 'fae.charm_revealed':
    case 'fae.charm_disposed':
    case 'fae.shortfall':
    case 'social.loan_opened':
    case 'social.loan_closed':
    case 'social.loan_breached': {
      const d = ev.data as Record<string, unknown>;
      const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : 0);
      const agent = num('finderId') || num('actorId') || num('keeperId') || num('lenderId') || num('borrowerId');
      const target = num('borrowerId') && num('lenderId') ? num('borrowerId') : 0;
      return base(
        {
          cls: 'charm',
          sub: ev.kind.slice(ev.kind.indexOf('.') + 1),
          agent,
          target,
          weight: num('qty') || num('units'),
          valence: ev.kind === 'social.loan_breached' || ev.kind === 'fae.shortfall' ? -30 : 0,
          base: ev.importance ?? 20,
          bind: {
            item_id: num('itemId'),
            household_id: num('householdId'),
            status: typeof d.status === 'string' ? (d.status as string) : '',
            disposal: typeof d.kind === 'string' && ev.kind === 'fae.charm_disposed' ? (d.kind as string) : '',
          },
        },
        [agent, target].filter((x) => x > 0),
      );
    }
    case 'social.rupture': {
      const d = ev.data;
      return base(
        {
          cls: 'rupture',
          sub: d.household ? 'household' : 'kin',
          agent: d.aId,
          target: d.bId,
          weight: d.fights,
          valence: -50,
          base: ev.importance ?? 55,
          bind: {
            cls: 'rupture',
            household: d.household,
            family: familyOfActor(world, d.aId as number),
            families: familiesOf(world, householdOf(world, d.aId as number)),
            fights: d.fights,
          },
        },
        [d.aId, d.bId],
      );
    }
    case 'social.reconciled': {
      const d = ev.data;
      const m = d.mediatorId ?? 0;
      return base(
        {
          cls: 'reconciled',
          sub: m ? 'mediated' : 'time',
          agent: d.aId,
          target: d.bId,
          valence: 40,
          base: ev.importance ?? 35,
          bind: {
            cls: 'reconciled',
            mediated: m > 0,
            mediator: m ? formalName(world, content, m) : '',
            mediator_short: m ? shortNameOf(world, m) : '',
            household: householdOf(world, d.aId as number) === householdOf(world, d.bId as number),
            family: familyOfActor(world, d.aId as number),
          },
        },
        [d.aId, d.bId],
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
      const pred = predOfProp(world, d.propId);
      const subject = subjectOfProp(world, d.propId);
      // What a person privately believes is known to them alone; the subject is not told.
      const f = base(
        {
          cls: 'belief',
          sub: pred,
          agent: d.holderId,
          target: subject,
          subject,
          prop: d.propId as number,
          weight: d.credence,
          base: ev.importance ?? 10,
          bind: { pred, rumor: d.text || rumorText(world, content, d.propId), cls: 'belief' },
        },
        [d.holderId],
      );
      if (subject) f.actors = uniq([...f.actors, subject]);
      return f;
    }
    case 'belief.transmitted': {
      const d = ev.data;
      const pred = predOfProp(world, d.propId);
      const subject = subjectOfProp(world, d.propId);
      const text = rumorText(world, content, d.propId);
      // Who could know: the two in the conversation (and any witnesses), never the subject.
      const f = base(
        {
          cls: 'transmit',
          sub: pred,
          agent: d.speakerId,
          target: d.listenerId,
          subject,
          prop: d.propId as number,
          success: d.accepted,
          weight: d.rumorId as number,
          base: ev.importance ?? 8,
          bind: { pred, rumor: text, mutation: d.mutation ?? '', cls: 'transmit' },
        },
        [d.speakerId, d.listenerId],
      );
      if (subject) f.actors = uniq([...f.actors, subject]);
      return f;
    }
    case 'belief.grudge_formed': {
      const d = ev.data;
      const tgt = resolveTarget(world, d.target);
      const who = tgt.actorId ?? 0;
      const f = base(
        {
          cls: 'grudge',
          sub: d.aim,
          agent: d.holderId,
          target: who,
          subject: who,
          weight: d.intensity,
          valence: -50,
          base: ev.importance ?? 30 + Math.floor(d.intensity / 5),
          bind: {
            cls: 'grudge',
            kind: d.aim,
            aim: content.grudgeAims?.[d.aim]?.phrase ?? (content.grudgeAims?.[d.aim]?.name ?? d.aim).toLowerCase(),
            subject: tgt.actorId
              ? shortNameOf(world, tgt.actorId)
              : tgt.householdId
                ? familiesOf(world, tgt.householdId)
                : tgt.label,
          },
        },
        [d.holderId, who],
      );
      if (tgt.householdId) f.households = uniq([...f.households, tgt.householdId as number]);
      return f;
    }
    case 'belief.escalation': {
      const d = ev.data;
      const tgt = resolveTarget(world, d.target);
      const who = tgt.actorId ?? ev.roles.find((r) => r.role === 'target')?.actor ?? 0;
      const f = base(
        {
          cls: 'escalation',
          sub: String(d.to),
          agent: who,
          target: 0,
          subject: who,
          weight: d.to,
          valence: -70,
          base: ev.importance ?? 40 + 10 * d.to,
          bind: {
            cls: 'escalation',
            rung: d.to,
            rung_name: rungName(content, d.to),
            kind: d.to > d.from ? 'up' : 'down',
          },
        },
        who ? [who] : [],
      );
      if (tgt.householdId) f.households = uniq([...f.households, tgt.householdId as number]);
      if (!who) f.bind.subject = tgt.label;
      return f;
    }
    case 'psyche.defense': {
      const d = ev.data;
      const names = defenseNames(content, d.defense);
      const dimp = (content.defenses?.[d.defense as never] as { importance?: number } | undefined)?.importance;
      return base(
        {
          cls: 'defense',
          sub: d.defense,
          agent: d.actorId,
          target: d.targetId ?? 0,
          weight: d.anxietyBefore,
          valence: -20,
          base: ev.importance ?? dimp ?? 15 + Math.min(30, Math.floor(d.anxietyBefore / 20)),
          bind: {
            cls: 'defense',
            aimed: (d.targetId ?? 0) > 0,
            defense: d.defense,
            defense_name: names.name,
            defense_clinical: names.clinical,
            anxiety: d.anxietyBefore,
            acted: d.act !== undefined,
          },
        },
        [d.actorId, d.targetId ?? 0],
      );
    }
    case 'provisions.shortage': {
      const d = ev.data;
      const members = householdMembers(world, d.householdId);
      // The larder count the story tells is what the household really has to eat: the pantry
      // and what every one of its people carries (a newcomer's pack is food, playtest
      // 2026-10-11). Counting both, a household that is not short at all is no story.
      const real = d.daysOfFoodTenths + carriedTenths(world, content, members, ev.t);
      if (real >= SHORT_TENTHS) return null;
      const k = knowledgeOf(ev, members);
      const f = base(
        {
          cls: 'shortage',
          sub: String(d.householdId),
          agent: 0,
          target: 0,
          weight: real,
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
      if (!vocab.nutritionConditions.includes(d.condition)) return null;
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
          bind: { cls: 'nutrition', condition: d.condition, condition_name: conditionName(d.condition) },
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
    case 'needs.died':
    case 'needs.death_discovered': {
      return base(
        {
          cls: 'other',
          sub: 'death',
          agent: ev.data.actorId,
          base: 100,
          valence: -100,
          bind: { cause: ev.data.cause, deceased: ev.data.name },
        },
        [ev.data.actorId],
      );
    }
    case 'needs.funeral': {
      return base(
        {
          cls: 'gathering',
          sub: 'funeral',
          agent: ev.data.actorId,
          base: 85,
          bind: {
            deceased: ev.data.name,
            attendance: ev.data.attendees.length === 1 ? 'One of the' : ev.data.attendees.length,
          },
        },
        [ev.data.actorId, ...ev.data.attendees],
      );
    }
    case 'needs.band_changed': {
      const d = ev.data;
      const { depth, of } = needDepth(content, d.needId, d.to);
      const need = content.needs?.[d.needId];
      const severe =
        depth > 0 && depth === of && of >= 2 && need?.kind === 'physical' && vocab.storyNeeds.includes(d.needId);
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
    case 'belief.misfortune': {
      const d = ev.data;
      const victims = ev.roles.filter((r) => r.role === 'victim').map((r) => r.actor as number);
      const text = misfortuneText(world, content, d.misfortuneId) ?? d.text;
      const def = content.misfortunes?.[d.kindId];
      return base(
        {
          cls: 'misfortune',
          sub: d.kindId,
          agent: victims[0] ?? 0,
          target: 0,
          valence: -50,
          base: ev.importance ?? 35,
          bind: { cls: 'misfortune', misfortune: text, uncanny: def?.uncanny === true, kind: d.kindId },
        },
        victims,
      );
    }
    case 'belief.figure_attached': {
      const d = ev.data;
      const fig = world.belief?.figures?.[d.figureId as never] as { name: string } | undefined;
      return base(
        {
          cls: 'figure',
          sub: String(d.figureId),
          agent: d.actorId,
          target: 0,
          subject: d.actorId,
          weight: d.consensus,
          valence: -40,
          base: ev.importance ?? 45,
          bind: { cls: 'figure', figure: fig?.name ?? 'a figure of local legend' },
        },
        [d.actorId],
      );
    }
    case 'belief.revealed': {
      const d = ev.data;
      const pred = predOfProp(world, d.propId);
      return base(
        {
          cls: 'reveal',
          sub: pred,
          agent: d.actorId,
          target: 0,
          subject: d.actorId,
          prop: d.propId as number,
          weight: d.consensus,
          valence: -60,
          base: ev.importance ?? 70,
          bind: { cls: 'reveal', pred, rumor: rumorText(world, content, d.propId) },
        },
        [d.actorId],
      );
    }
    case 'activity.gathering': {
      const d = ev.data;
      return base(
        {
          cls: 'gathering',
          sub: d.observanceId,
          agent: 0,
          target: 0,
          place: d.placeId as number,
          weight: d.actorIds.length,
          base: ev.importance ?? 0,
          bind: { cls: 'gathering' },
        },
        [],
      );
    }
    case 'activity.observance': {
      const d = ev.data;
      return base(
        {
          cls: 'observance',
          sub: d.observanceId,
          agent: 0,
          target: 0,
          base: ev.importance ?? 0,
          bind: { cls: 'observance', observance: d.name.toLowerCase() },
        },
        [],
      );
    }
    default:
      return null;
  }
}
