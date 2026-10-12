/**
 * Plain-English text for every event the player can be shown. The sim speaks in event kinds
 * ('needs.band_changed'); a player is told "You're getting hungry". Everything here is a pure
 * function of the event plus the world's names, so headless play and any other front end can use
 * the same sentences. Nothing leaks an event kind: unknown kinds still get a readable fallback.
 */
import type { ActorId, ContentBundle, Event, World } from '@coulee/core';

export interface Described {
  /** One sentence, no event-kind words. */
  text: string;
  /** Bookkeeping the status lines already say (an arbitration, a routine meal step): listed last. */
  routine: boolean;
}

const cents = (c: number) => `$${(c / 100).toFixed(2)}`;
const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Band words that name the feeling better than "getting <label>". */
const FEELING: Record<string, { worse: string; better: string }> = {
  'faith:wanting church': { worse: 'You are missing church', better: 'You no longer miss church so badly' },
  'drink:hankering': { worse: "You've a hankering for a drink", better: 'The hankering for a drink passes' },
  'standing:overlooked': { worse: 'You feel overlooked', better: 'You no longer feel overlooked' },
  'faith:unmoored': { worse: 'You feel unmoored', better: 'You feel less unmoored' },
};

function bandSentence(content: ContentBundle, e: Extract<Event, { kind: 'needs.band_changed' }>, you: boolean) {
  const d = e.data;
  const def = content.needs[d.needId];
  const name = def?.name ?? 'condition';
  const bands = d.layer === 'debt' ? (def?.debt?.bands ?? []) : (def?.bands ?? []);
  const rank = (label: string) => {
    const i = bands.findIndex((b) => b.label === label);
    return i < 0 ? -1 : i;
  };
  // Bands are listed mildest first; a higher index is worse for meters, and for debt layers.
  const worse = d.to !== '' && (d.from === '' || rank(d.to) > rank(d.from));
  const label = (d.to || d.from).toLowerCase();
  const special = FEELING[`${d.needId}:${label}`];
  if (!you) return worse ? `${name}: someone nearby looks ${label}` : '';
  if (special) return special[worse ? 'worse' : 'better'];
  if (d.layer === 'debt')
    return worse
      ? `You are growing ${label}`
      : d.to === ''
        ? `You are no longer ${label}`
        : `You are less ${d.from.toLowerCase()}`;
  if (worse) return d.from === '' ? `You are getting ${label}` : `You are ${label} now`;
  if (d.to === '') return `You are no longer ${label}`;
  return `You are easing from ${d.from.toLowerCase()} to ${d.to.toLowerCase()}`;
}

/** A readable fallback for a kind with no hand-written sentence: "belief.grudge_formed" -> "Belief: grudge formed". */
export function fallbackText(kind: string): string {
  const [module = '', what = ''] = kind.split('.');
  return `${upperFirst(module)}: ${what.replaceAll('_', ' ')}`.trim();
}

export function describeEvent(world: World, content: ContentBundle, pc: ActorId, e: Event): Described {
  const actorName = (id: number | null | undefined) => {
    const a = id === null || id === undefined ? undefined : world.actors[id];
    return a ? `${a.name.given} ${a.name.family}`.trim() : 'someone';
  };
  const who = (id: number) => (id === pc ? 'you' : actorName(id));
  const Who = (id: number) => upperFirst(who(id));
  const place = (id: number | undefined) => (id === undefined ? 'somewhere' : (world.places[id]?.name ?? 'somewhere'));
  const itemName = (defId: string) => content.items[defId]?.name ?? defId.replaceAll('_', ' ');
  const stackName = (itemId: number) => {
    const s = world.items.stacks[itemId];
    return s ? itemName(s.defId) : 'an item';
  };
  const out = (text: string, routine = false): Described => ({ text, routine });

  switch (e.kind) {
    case 'activity.started': {
      const d = e.data;
      const def = content.activities[d.activityId];
      const mine = d.actorId === pc;
      const name = actorName(d.actorId);
      if (!def) return out(`${mine ? 'You begin' : `${name} begins`} something new`, !mine);
      if (def.tags.includes('travel')) {
        // The arrival line says it when the walk is done; "set off" only when she is still on the road.
        const road = world.activity.byActor[d.actorId]?.travel;
        return mine
          ? out(`You set off for ${place(d.placeId)}`, !road)
          : out(`${name} sets off for ${place(d.placeId)}`, true);
      }
      if (def.asleep) return mine ? out('You lie down to sleep') : out(`${name} lies down to sleep`, true);
      // "At home, at leisure" is only true at one's own hearth.
      const hearth = world.households[world.actors[d.actorId]?.householdId ?? 0]?.homePlaceId;
      const verb = d.placeId === hearth ? def.verb : def.verb.replace(/^at home, /, '');
      const first = verb.split(/\s+/)[0] ?? '';
      const gerund = first.endsWith('ing');
      // She knows what she does with her own hour: it is news only when she ordered it.
      return mine
        ? out(`You ${gerund ? `begin ${verb}` : `are ${verb}`}`, d.source !== 'command' || def.tags.includes('leisure'))
        : out(`${name} is ${verb}`, true);
    }
    case 'activity.moved': {
      const d = e.data;
      const walk = d.minutes && d.minutes > 1 ? ` (${d.minutes} min on foot)` : '';
      return d.actorId === pc
        ? out(`You arrive at ${place(d.to)}${walk}`)
        : out(`${actorName(d.actorId)} arrives at ${place(d.to)}`, true);
    }
    case 'activity.attendance': {
      const d = e.data;
      const obs = content.observances?.[d.observanceId]?.name ?? 'the gathering';
      return out(
        `${Who(d.actorId)} ${d.attends ? (d.actorId === pc ? 'go to' : 'goes to') : d.actorId === pc ? 'stay away from' : 'stays away from'} ${obs}`,
        true,
      );
    }
    case 'activity.rota': {
      const obs = content.observances?.[e.data.observanceId]?.name ?? 'the gathering';
      return out(
        `${Who(e.data.actorId)} ${e.data.actorId === pc ? 'are' : 'is'} on the household rota for ${obs}`,
        true,
      );
    }
    case 'activity.observance':
      return out(`${e.data.name} is observed today`);
    case 'activity.gathering': {
      const obs = content.observances?.[e.data.observanceId]?.name ?? 'A gathering';
      return out(`${obs} gathers at ${place(e.data.placeId)}`);
    }
    case 'needs.band_changed': {
      const d = e.data;
      const text = bandSentence(content, e, d.actorId === pc);
      return text ? out(text) : out(`${actorName(d.actorId)} looks worse for wear`, true);
    }
    case 'needs.fed':
      return out(`${Who(e.data.actorId)} ${e.data.actorId === pc ? 'take' : 'takes'} food (${e.data.kcal} kcal)`, true);
    case 'needs.drank':
      return out(`${Who(e.data.actorId)} ${e.data.actorId === pc ? 'drink' : 'drinks'} (${e.data.ml} ml)`, true);
    case 'needs.changed':
      return out(`${Who(e.data.actorId)}: ${content.needs[e.data.needId]?.name ?? 'a need'} shifts`, true);
    case 'needs.hearth':
      return out(
        e.data.lit
          ? `The hearth at ${place(e.data.placeId)} burns; it is ${e.data.temperatureF}°F within`
          : `The fire at ${place(e.data.placeId)} has gone out`,
        true,
      );
    case 'needs.survival_check': {
      const d = e.data;
      const harm = d.damage ? `${d.damage} harm` : 'held firm';
      return out(
        `${d.actorId === pc ? 'Your' : `${actorName(d.actorId)}'s`} Fortitude against ${d.cause}: ${harm}; Vigor ${d.vigor}, Wounds ${d.wounds}`,
        d.actorId !== pc,
      );
    }
    case 'needs.collapsed':
      return e.data.actorId === pc
        ? out(`You collapse from ${e.data.cause} and need help`)
        : out(`${actorName(e.data.actorId)} has collapsed from ${e.data.cause}`);
    case 'needs.recovered':
      return e.data.actorId === pc
        ? out('You come to: food, water, warmth and rest are restoring your Vigor')
        : out(`${actorName(e.data.actorId)} has come to`, true);
    case 'needs.stasis':
      return out(
        e.data.frozen
          ? `${e.data.actorId === pc ? 'For you' : `For ${actorName(e.data.actorId)}`}, time runs otherwise under the hill`
          : `${Who(e.data.actorId)} ${e.data.actorId === pc ? 'feel' : 'feels'} the hours take hold again`,
        e.data.actorId !== pc,
      );
    case 'needs.died':
    case 'needs.death_discovered':
      return out(`${e.data.actorId === pc ? 'You' : e.data.name} died of ${e.data.cause}`);
    case 'needs.funeral':
      return out(
        `The church bell tolled for ${e.data.name}; ${plural(e.data.attendees.length, 'mourner')} attended the funeral`,
      );
    case 'needs.aid': {
      const d = e.data;
      if (!d.success)
        return out(`${Who(d.actorId)} hesitated to help ${who(d.targetId)}`, d.actorId !== pc && d.targetId !== pc);
      const parts = [d.waterMl ? `${d.waterMl} ml of water` : '', d.carried ? 'carried home' : ''].filter(Boolean);
      return out(
        `${Who(d.actorId)} ${d.actorId === pc ? 'help' : 'helps'} ${who(d.targetId)}${parts.length ? ` (${parts.join('; ')})` : ''}`,
        d.actorId !== pc && d.targetId !== pc,
      );
    }
    case 'needs.estate':
      return out(`${actorName(e.data.heirId)} inherits what ${actorName(e.data.actorId)} left`, true);
    case 'needs.ending':
      return out(
        e.data.type === 'retire'
          ? 'You settle down for good; your account closes here'
          : 'You leave this country; your account closes here',
      );
    case 'needs.command_rejected':
      return out(e.data.reason);
    case 'fae.refused':
      return out(e.data.reason);
    case 'fae.omen':
    case 'fae.read':
    case 'fae.investigated':
      return out(e.data.text);
    case 'social.requested':
      return out(e.data.text.replace(/\.$/, ''));
    case 'social.request_answered': {
      // The request id is "<asker>:<asked>:<minute>:<interaction>".
      const [from, , , iid] = e.data.requestId.split(':');
      const asker = actorName(Number(from));
      const what = content.interactions[iid ?? '']?.name.toLowerCase() ?? 'request';
      const verb =
        e.data.status === 'accepted' ? 'accepted' : e.data.status === 'refused' ? 'refused' : 'let pass, unanswered,';
      return out(
        e.data.actorId === pc
          ? `You ${verb} ${asker}'s ${what}`
          : `${actorName(e.data.actorId)} ${verb} ${asker}'s ${what}`,
        e.data.actorId !== pc,
      );
    }
    case 'psyche.arbitrated': {
      const d = e.data;
      return out(
        `${d.actorId === pc ? 'You settle' : `${actorName(d.actorId)} settles`} on it: ${d.label ?? d.urge}`,
        true,
      );
    }
    case 'psyche.thought': {
      const d = e.data;
      return out(`${d.actorId === pc ? 'A thought' : `${actorName(d.actorId)} thinks`}: ${d.line ?? d.label}`, true);
    }
    case 'psyche.defense':
      return out(`${Who(e.data.actorId)} ${e.data.actorId === pc ? 'are' : 'is'} rattled: ${e.data.label}`, true);
    case 'social.interaction': {
      const d = e.data;
      const verdict = d.success ? 'it went well' : 'it went badly';
      // Who it was aimed at, and what changed hands (playtest r2: "Lend ▸ $1.00" hid the person).
      const label = content.interactions[d.interactionId]?.label ?? d.label.split(' ▸ ')[0] ?? d.label;
      const extras = [...(d.cents ? [cents(d.cents)] : []), ...(d.itemDefId ? [itemName(d.itemDefId)] : [])];
      const work = d.atWork ? `; it kept ${actorName(d.targetId)} from work` : '';
      const act = `${label} ▸ ${who(d.targetId)}${extras.length ? `: ${extras.join('; ')}` : ''} (${verdict}${work})`;
      if (d.initiatorId === pc) return out(act);
      return out(`${actorName(d.initiatorId)}: ${act}`);
    }
    case 'social.memory_formed':
      return out(
        `${e.data.ownerId === pc ? 'You will remember' : `${actorName(e.data.ownerId)} will remember`} that (${e.data.kind.replaceAll('_', ' ')})`,
        true,
      );
    case 'social.label_changed': {
      const d = e.data;
      if (d.holderId === pc)
        return out(`You now think of ${actorName(d.targetId)} as ${d.to.toLowerCase() || 'an acquaintance'}`);
      if (d.targetId === pc)
        return out(`${actorName(d.holderId)} now thinks of you as ${d.to.toLowerCase() || 'an acquaintance'}`);
      return out(
        `${actorName(d.holderId)} now thinks of ${actorName(d.targetId)} as ${d.to.toLowerCase() || 'an acquaintance'}`,
      );
    }
    case 'social.rupture':
      return out(`${actorName(e.data.aId)} and ${actorName(e.data.bId)} have come to blows; they are not speaking`);
    case 'social.mediation':
      return out(
        `${Who(e.data.mediatorId)} tried to bring ${actorName(e.data.aId)} and ${actorName(e.data.bId)} round, and ${e.data.success ? 'did' : 'could not'}`,
      );
    case 'social.reconciled':
      return out(`${actorName(e.data.aId)} and ${actorName(e.data.bId)} are speaking again`);
    case 'belief.formed':
      return out(`Heard: ${e.data.text}`);
    case 'belief.transmitted':
      return out(`${e.data.listenerId === pc ? 'Heard' : 'Told'}: ${e.data.text ?? 'a rumor'}`);
    case 'belief.tell':
      return out(`You notice something not quite right about ${actorName(e.data.targetId)}`);
    case 'belief.evidence':
    case 'belief.decayed':
      return out('Something you have heard seems more or less certain than it did', true);
    case 'belief.revealed':
      return out(`It comes out about ${actorName(e.data.actorId)}`);
    case 'belief.grudge_formed':
      return out(`${actorName(e.data.holderId)} has begun to hold a grudge against ${e.data.target}`);
    case 'belief.escalation':
      return out(`Feeling against ${e.data.target} runs higher in the town`);
    case 'provisions.cash_transfer': {
      const d = e.data;
      if (d.fromId === pc) return out(`You paid ${actorName(d.toId)} ${cents(d.cents)} (${d.reason})`);
      if (d.toId === pc) return out(`${actorName(d.fromId)} paid you ${cents(d.cents)} (${d.reason})`);
      return out(`${actorName(d.fromId)} paid ${actorName(d.toId)} ${cents(d.cents)} (${d.reason})`);
    }
    case 'provisions.purchase': {
      const d = e.data;
      return out(
        `${Who(d.buyerId)} ${d.buyerId === pc ? 'bought' : 'buys'} ${d.qty} ${itemName(d.defId)} for ${cents(d.priceCents)}${d.onCredit ? ', partly on account' : ''}`,
      );
    }
    case 'provisions.sale': {
      const d = e.data;
      return out(
        `${Who(d.sellerId)} ${d.sellerId === pc ? 'sold' : 'sells'} ${d.qty} ${itemName(d.defId)} for ${cents(d.priceCents)}`,
      );
    }
    case 'provisions.meal': {
      const d = e.data;
      const what = d.items.map((i) => itemName(i.defId)).join(', ');
      return out(
        `${Who(d.actorId)} ${d.actorId === pc ? 'ate' : 'eats'}${what ? ` ${what}` : ''}: ${d.kcal} kcal, ${d.hot ? 'hot' : 'cold'}`,
      );
    }
    case 'provisions.intake':
      return out(`A day's eating: ${e.data.kcal} kcal, ${e.data.proteinG} g protein, ${e.data.fatG} g fat`, true);
    case 'provisions.prepared':
      return out(
        `${upperFirst(String(e.data.from))} prepared as ${e.data.into} (${plural(Math.round(e.data.servings), 'serving')})`,
        true,
      );
    case 'provisions.prep_started':
      return out(`${Who(e.data.cookId)} ${e.data.cookId === pc ? 'start' : 'starts'} cooking`, true);
    case 'provisions.prep_failed':
      return out(`Cannot prepare that: missing ${e.data.missing.join(', ') || 'something'}`);
    case 'provisions.refilled':
      return out(
        `${Who(e.data.actorId)} ${e.data.actorId === pc ? 'filled' : 'fills'} ${stackName(e.data.itemId)} (${e.data.ml} ml)`,
        true,
      );
    case 'provisions.fire':
      return out(
        e.data.lit ? `A fire is lit at ${place(e.data.placeId)}` : `The fire at ${place(e.data.placeId)} goes out`,
      );
    case 'provisions.light':
      return out(`${upperFirst(stackName(e.data.itemId))} ${e.data.lit ? 'is lit' : 'is put out'}`, true);
    case 'provisions.supply_used':
      return out(`${upperFirst(e.data.kind)} used up (${e.data.units})`, true);
    case 'provisions.vermin':
      return out(`Vermin got into the ${itemName(e.data.defId)}`);
    case 'provisions.spoiled':
      return out(`${plural(e.data.qty, 'unit')} of ${itemName(e.data.defId)} spoiled`);
    case 'provisions.load_movement':
      return out(
        e.data.blocked
          ? 'Your load is too heavy to move'
          : `Your load is ${e.data.loadPct}% of what you can manage: you walk at ${e.data.speedPct}% pace`,
        true,
      );
    case 'provisions.production': {
      const got = e.data.yields.map((y) => `${y.qty} ${itemName(y.defId)}`).join(', ');
      return out(
        `${Who(e.data.actorId)} ${e.data.actorId === pc ? 'gathered' : 'gathers'}${got ? ` ${got}` : ' nothing'}`,
      );
    }
    case 'provisions.wages':
      return out(
        `Wages paid: ${cents(e.data.cents)}${e.data.arrearsCents ? ` (${cents(e.data.arrearsCents)} still owed)` : ''}`,
      );
    case 'provisions.restock':
      return out(`The store at ${place(e.data.placeId)} restocks ${itemName(e.data.defId)}`, true);
    case 'provisions.shopping_plan':
      return out('The household draws up its shopping', true);
    case 'provisions.shortage':
      return out(
        `The larder is low: about ${(e.data.daysOfFoodTenths / 10).toFixed(1)} days of food at ${e.data.rationPct}% rations`,
      );
    case 'provisions.rations':
      return out(`Rations are set to ${e.data.rationPct}%`);
    case 'provisions.nutrition': {
      const d = e.data;
      const mine = d.actorId === pc;
      const name = actorName(d.actorId);
      const word = d.condition.replaceAll('_', ' ');
      const known: Record<string, [string, string]> = {
        drunk: ['is drunk', 'has sobered up'],
        hungover: ['is hungover', 'is over the hangover'],
        scurvy_early: ['has aching gums: the first signs of scurvy', 'is shaking off the signs of scurvy'],
        scurvy: ['has the scurvy', 'is over the scurvy'],
        malnourished: ['is malnourished after a week of poor eating', 'is eating well enough again'],
      };
      const phrase = known[d.condition]?.[d.on ? 0 : 1] ?? (d.on ? `shows ${word}` : `is over ${word}`);
      return out(
        mine
          ? `You ${phrase
              .replace(/^is /, 'are ')
              .replace(/^has /, 'have ')
              .replace(/^shows /, 'show ')}`
          : `${name} ${phrase}`,
      );
    }
    case 'provisions.command_rejected':
      return out(e.data.reason);
    case 'provisions.water':
      return out('Water is drawn for the household', true);
    case 'items.created':
      return out(`${plural(e.data.qty, 'unit')} of ${itemName(e.data.defId)} appear`, true);
    case 'items.moved':
      return out(`${plural(e.data.qty, 'unit')} of ${itemName(e.data.defId)} moved`, true);
    case 'items.consumed':
      return out(`${plural(e.data.qty, 'unit')} of ${itemName(e.data.defId)} used (${e.data.reason})`, true);
    case 'items.depleted':
      return out(`The ${itemName(e.data.defId)} has run out`);
    case 'items.lit':
      return out(`${upperFirst(itemName(e.data.defId))} ${e.data.on ? 'is lit' : 'is put out'}`, true);
    case 'chronicle.pattern_matched':
      return out('A story takes shape in the town', true);
    case 'core.day_started':
      return out(`A new day begins${e.data.isSabbath ? ': the Sabbath' : ''}`, true);
    default: {
      const kind = String((e as { kind: string }).kind);
      if (kind === 'core.actor_died') return out('Someone has died');
      return out(fallbackText(kind), true);
    }
  }
}

/** The label on a ledger line ("Money: purse −$0.25 — Tavern bed: $0.25"): what it was for, not who did it. */
export function moneyReason(world: World, content: ContentBundle, pc: ActorId, e: Event): string {
  const item = (defId: string) => content.items[defId]?.name ?? defId.replaceAll('_', ' ');
  switch (e.kind) {
    case 'provisions.cash_transfer':
      return `${e.data.reason}: ${cents(e.data.cents)}`;
    case 'provisions.purchase':
      return `Bought ${e.data.qty} ${item(e.data.defId)} for ${cents(e.data.priceCents)}`;
    case 'provisions.sale':
      return `Sold ${e.data.qty} ${item(e.data.defId)} for ${cents(e.data.priceCents)}`;
    case 'provisions.wages':
      return 'Wages';
    default:
      return describeEvent(world, content, pc, e).text;
  }
}
