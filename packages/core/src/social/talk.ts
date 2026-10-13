/**
 * Talk: the words of an exchange (playtest 2026-10-11: social verbs returned only "success").
 * Every interaction is voiced as 1–3 turns chosen from content (social/talk*.toml) by the
 * interaction, its outcome, how each party regards the other, each speaker's mood (the loudest
 * Appetite or Conscience thought), and the live world: weather, season, the Sabbath, market
 * day, store prices, the town's latest misfortune, what the speakers remember of each other.
 * Speakers use their own culture's idiom (`#word#`). No line is repeated between the same pair
 * within a week when alternatives fit (`world.social.talk`). Listener text hashes also keep
 * already-heard words out of an exchange for 30 days, even when another speaker says them.
 *
 * Two parts (P1): `act` lines go on the `social.interaction` event, which witnesses may
 * overhear, so they never carry a rumor's content; `said` lines carry the news itself and go on
 * the private `belief.transmitted` event, known only to teller and hearer.
 * OWNER: module:social.
 */

import { observanceActive } from '../activity/calendar.ts';
import { shortName } from '../actor.ts';
import { credenceOf } from '../belief/api.ts';
import { titleOf } from '../chronicle/names.ts';
import type { ContentBundle, InteractionDef } from '../content.ts';
import type { ActorId, PlaceId, PropId } from '../ids.ts';
import { rowsOf } from '../ids.ts';
import { needValue } from '../needs/api.ts';
import { airTempF, bestStore, isRaining, priceAt } from '../provisions/api.ts';
import { anxietyOf } from '../psyche/api.ts';
import type { Rng } from '../rng.ts';
import { hashString32, mixKey } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import { formatCents } from './model.ts';
import { opinionRecord, owedCents } from './opinion.ts';
import { whenSpecificity, whoMatches } from './talk-who.ts';
import { areKinBy } from './volition.ts';

type TalkLine = ContentBundle['talk_lines'][string];
type TalkWord = ContentBundle['talk_words'][string];
type When = TalkLine['when'];

/** One spoken turn. `speaker` is the display name; `speakerId` the actor. */
export interface TalkTurn {
  speaker: string;
  speakerId: ActorId;
  text: string;
}

/** The words of one exchange: `lines` turn by turn, `line` the same as one display string. */
export interface Exchange {
  line: string;
  lines: TalkTurn[];
  /** Talk line ids used (recorded so the pair does not hear them again within the week). */
  ids: string[];
}

/** What a news-carrying act told (or failed to tell), for `told`/`rumor`/`heard` conditions. */
export interface TalkFacts {
  told?: boolean;
  stale?: boolean;
  rumor?: 'scandal' | 'uncanny' | 'kind' | 'plain';
  heard?: 'already' | 'credits' | 'doubts';
  secondhand?: boolean;
  about?: 'self' | 'you' | 'other';
  /** Extra slots: rumor, subject, source, hedge... */
  slots?: Record<string, string>;
}

const SALT_TALK = 0x7a1c;
/** Under this age a speaker talks as a child (talk lines' `child`). */
const CHILD_AGE = 13;
const WEEK = 7 * 1440;
const HEARD = 30 * 1440;
/** A busy listener retains about 500 turns/month; cap pathological command-heavy saves. */
const MAX_HEARD = 1024;

// ---- content index (cached per bundle) ----

interface TalkIndex {
  act: Map<string, TalkLine[]>;
  said: Map<string, TalkLine[]>;
  words: Record<string, TalkWord>;
  weights: Map<TalkLine, number>;
  cultureByKey: Map<string, string>;
}

let indexCache: { content: ContentBundle; scenarioId: string; idx: TalkIndex } | null = null;

function indexOf(content: ContentBundle, scenarioId: string): TalkIndex {
  if (indexCache && indexCache.content === content && indexCache.scenarioId === scenarioId) return indexCache.idx;
  const act = new Map<string, TalkLine[]>();
  const said = new Map<string, TalkLine[]>();
  const lines = Object.keys(content.talk_lines ?? {})
    .sort()
    .map((k) => content.talk_lines[k] as TalkLine);
  for (const iid of Object.keys(content.interactions).sort()) {
    const def = content.interactions[iid];
    if (!def) continue;
    for (const l of lines) {
      if (!l.on.includes(iid) && !l.on_tags.some((t) => def.tags.includes(t))) continue;
      const m = l.part === 'said' ? said : act;
      const list = m.get(iid) ?? [];
      list.push(l);
      m.set(iid, list);
    }
  }
  const cultureByKey = new Map<string, string>();
  for (const a of content.scenarios[scenarioId]?.actors ?? []) if (a.culture) cultureByKey.set(a.key, a.culture);
  const weights = new Map(lines.map((l) => [l, l.weight * (1 + 2 * whenSpecificity(l.when))]));
  const idx: TalkIndex = { act, said, words: content.talk_words ?? {}, cultureByKey, weights };
  indexCache = { content, scenarioId, idx };
  return idx;
}

// ---- the scene: conditions read lazily from the world ----

type Mood = string;

/** Per-hour facts shared by every exchange that hour (weather, observances, prices, news). */
interface HourFacts {
  key: string;
  weather: 'rain' | 'snow' | 'dry';
  temp: 'freezing' | 'cold' | 'mild' | 'warm' | 'hot';
  part: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
  observances: string[];
  price: { item: string; price: string; store: string } | null;
  /** The town's misfortunes of the last fortnight, latest first (a speaker names one they know of). */
  misfortunes: Array<{ propId: PropId; text: string; householdId: number }>;
}

let hourCache: { world: World; facts: HourFacts } | null = null;

const STAPLES = ['flour', 'salt_pork', 'coffee_green', 'cornmeal', 'potatoes', 'sugar_brown', 'eggs'] as const;

function hourFacts(world: World, ctx: SimContext): HourFacts {
  const key = `${world.meta.seed}:${ctx.now}`;
  if (hourCache && hourCache.world === world && hourCache.facts.key === key) return hourCache.facts;
  const cal = ctx.cal;
  const f = airTempF(cal);
  const wet = isRaining(world.meta.seed, cal);
  const h = cal.hour;
  const observances = Object.keys(ctx.content.observances ?? {})
    .sort()
    .filter((id) => {
      const def = ctx.content.observances[id];
      return def !== undefined && observanceActive(def, cal);
    });
  // A staple's price at the store the town shops at (provisions' bestStore: the most food on its
  // shelves, not the first store by place id, which named the tavern; group D's r2 note). The item
  // rotates with the day so the talk of prices does not fix on flour.
  let price: HourFacts['price'] = null;
  const store = bestStore(world, ctx);
  if (store) {
    const item = STAPLES[cal.dayIndex % STAPLES.length] as string;
    const cents = priceAt(world, ctx.content, store.placeId, item);
    const def = ctx.content.items[item];
    if (cents !== null && cents > 0 && def) {
      const unit = def.unit === 'each' ? 'apiece' : `the ${def.unit === 'lb' ? 'pound' : def.unit}`;
      const name = def.name.toLowerCase().replace(/^([^,]+), ([^,]+)$/, '$2 $1');
      price = {
        item: name,
        price: `${formatPrice(cents)} ${unit}`,
        store: world.places[store.placeId]?.name ?? 'the store',
      };
    }
  }
  // The town's misfortunes of the last fortnight, in words, latest first.
  const misfortunes: HourFacts['misfortunes'] = [];
  for (const m of rowsOf(world.belief.misfortunes).sort((a, b) => b.at - a.at || b.id - a.id)) {
    if (ctx.now - m.at > 14 * 1440 || m.at > ctx.now) continue;
    const text = misfortuneWords(world, ctx.content, m.id);
    if (text) misfortunes.push({ propId: m.propId, text, householdId: m.householdId });
  }
  const facts: HourFacts = {
    key,
    weather: wet ? (f <= 32 ? 'snow' : 'rain') : 'dry',
    temp: f <= 32 ? 'freezing' : f < 50 ? 'cold' : f < 70 ? 'mild' : f < 85 ? 'warm' : 'hot',
    part:
      h >= 5 && h < 11
        ? 'morning'
        : h < 14 && h >= 11
          ? 'midday'
          : h >= 14 && h < 18
            ? 'afternoon'
            : h >= 18 && h < 22
              ? 'evening'
              : 'night',
    observances,
    price,
    misfortunes,
  };
  hourCache = { world, facts };
  return facts;
}

function formatPrice(cents: number): string {
  return cents < 100 ? `${cents} cents` : formatCents(cents);
}

function misfortuneWords(world: World, content: ContentBundle, id: number): string | null {
  const m = world.belief.misfortunes[id];
  const def = m ? content.misfortunes[m.kindId] : undefined;
  const h = m ? world.households[m.householdId] : undefined;
  if (!m || !def || !h) return null;
  const head = world.actors[h.headId];
  const family = head?.name.family || h.name.replace(/^The\s+/i, '');
  const plural = `${family}${/(s|x|z|ch|sh)$/i.test(family) ? 'es' : 's'}`;
  const victim = m.victimId === null ? 'a child' : (world.actors[m.victimId]?.name.given ?? 'someone');
  return def.text.replace('{0.poss}', `the ${plural}'`).replace('{0}', `the ${plural}`).replace('{1}', victim);
}

const PSYCHE_MOOD_MIN = 300;

/** The mood a speaker brings to a conversation (see TALK_STATES in the schema). */
export function moodOf(world: World, ctx: Pick<SimContext, 'content'>, id: ActorId): Mood {
  const a = world.actors[id];
  if (!a) return 'easy';
  if (a.sheet.conditions.includes('drunk')) return 'drunk';
  const p = world.psyche.byActor[id];
  let best: { mood: string; intensity: number } | null = null;
  for (const t of p?.thoughts ?? []) {
    if (t.voice === 'command' || t.intensity < PSYCHE_MOOD_MIN) continue;
    const mood = t.voice === 'id' ? t.drive : t.norm;
    if (!mood) continue;
    if (!best || t.intensity > best.intensity) best = { mood, intensity: t.intensity };
  }
  if (best) return best.mood;
  if (anxietyOf(world, id) >= 400) return 'anxious';
  if (ctx.content.needs.hunger && needValue(world, id, 'hunger') < 300) return 'hungry';
  if (ctx.content.needs.rest && needValue(world, id, 'rest') < 250) return 'weary';
  return 'easy';
}

function labelOf(world: World, from: ActorId, to: ActorId): string {
  const rec = opinionRecord(world, from, to);
  if (!rec) return 'stranger';
  return rec.label ? rec.label.toLowerCase() : 'acquaintance';
}

class Scene {
  private memo = new Map<string, unknown>();
  readonly world: World;
  readonly ctx: SimContext;
  readonly i: ActorId;
  readonly t: ActorId;
  readonly placeId: PlaceId | null;
  readonly facts: TalkFacts;
  /** Culture each scenario actor was raised in, by actor key (for `initiator`/`target` conditions). */
  cultureByKey: ReadonlyMap<string, string> = new Map();
  constructor(world: World, ctx: SimContext, i: ActorId, t: ActorId, placeId: PlaceId | null, facts: TalkFacts) {
    this.world = world;
    this.ctx = ctx;
    this.i = i;
    this.t = t;
    this.placeId = placeId;
    this.facts = facts;
  }
  private once<T>(key: string, f: () => T): T {
    if (this.memo.has(key)) return this.memo.get(key) as T;
    const v = f();
    this.memo.set(key, v);
    return v;
  }
  get hour(): HourFacts {
    return this.once('hour', () => hourFacts(this.world, this.ctx));
  }
  label(from: ActorId, to: ActorId): string {
    return this.once(`label:${from}`, () => labelOf(this.world, from, to));
  }
  close(): boolean {
    return this.once('close', () => {
      const a = this.world.actors[this.i];
      const b = this.world.actors[this.t];
      return (
        (a !== undefined && b !== undefined && a.householdId === b.householdId) ||
        this.kin() ||
        this.courting() ||
        this.label(this.i, this.t) === 'friend'
      );
    });
  }
  kin(): boolean {
    return this.once('kin', () => areKinBy(this.world, this.ctx.content, this.i, this.t));
  }
  courting(): boolean {
    return this.once('courting', () =>
      this.world.social.relationships.some(
        (r) =>
          (r.kind === 'courting' || r.kind === 'betrothed') &&
          ((r.a === this.i && r.b === this.t) || (r.a === this.t && r.b === this.i)),
      ),
    );
  }
  child(id: ActorId): boolean {
    return this.once(`child:${id}`, () => {
      const a = this.world.actors[id];
      return a !== undefined && yearsBetween(a.born, this.ctx.now) < CHILD_AGE;
    });
  }
  mood(id: ActorId): string {
    return this.once(`mood:${id}`, () => moodOf(this.world, this.ctx, id));
  }
  /** The place of the most salient memory `owner` has of `other` doing `kind` (salience ≥ 200). */
  remembered(owner: ActorId, other: ActorId, kind: string): PlaceId | null | false {
    return this.once(`mem:${owner}:${kind}`, () => {
      let best: { salience: number; place: PlaceId | null } | null = null;
      for (const mid of this.world.social.memoriesByOwner[owner] ?? []) {
        const m = this.world.social.memories[mid];
        if (!m || m.kind !== kind || m.aboutId !== other || m.did || m.salience < 200) continue;
        if (!best || m.salience > best.salience) best = { salience: m.salience, place: m.placeId };
      }
      return best ? best.place : false;
    });
  }
  /** A recent misfortune the initiator has heard of and credits (P1: nobody speaks of news they lack). */
  misfortune(): string | null {
    return this.once('misfortune', () => {
      // Someone else's trouble: a house's own misfortune is not news its people tell about "them".
      const home = this.world.actors[this.i]?.householdId;
      for (const m of this.hour.misfortunes)
        if (m.householdId !== home && credenceOf(this.world, this.i, m.propId) >= 50) return m.text;
      return null;
    });
  }
  owed(): { by: 'initiator' | 'target'; cents: number } | null {
    return this.once('owed', () => {
      const byTarget = owedCents(this.world, this.i, this.t);
      if (byTarget > 0) return { by: 'target' as const, cents: byTarget };
      const byInit = owedCents(this.world, this.t, this.i);
      return byInit > 0 ? { by: 'initiator' as const, cents: byInit } : null;
    });
  }
  /** Does a line's `when` hold here? */
  matches(w: When): boolean {
    const h = (): HourFacts => this.hour;
    if (w.weather !== undefined && h().weather !== w.weather) return false;
    if (w.temp !== undefined && h().temp !== w.temp) return false;
    if (w.season !== undefined && this.ctx.cal.season !== w.season) return false;
    if (w.part !== undefined && h().part !== w.part) return false;
    if (w.sabbath !== undefined && this.ctx.cal.isSabbath !== w.sabbath) return false;
    if (w.observance !== undefined && !h().observances.includes(w.observance)) return false;
    if (w.venue !== undefined) {
      const tags = this.placeId !== null ? (this.world.places[this.placeId]?.tags ?? []) : [];
      if (!tags.includes(w.venue)) return false;
    }
    if (w.label !== undefined && this.label(this.i, this.t) !== w.label) return false;
    if (w.target_label !== undefined && this.label(this.t, this.i) !== w.target_label) return false;
    if (w.kin !== undefined && this.kin() !== w.kin) return false;
    if (w.household !== undefined) {
      const same = this.world.actors[this.i]?.householdId === this.world.actors[this.t]?.householdId;
      if (same !== w.household) return false;
    }
    if (w.courting !== undefined && this.courting() !== w.courting) return false;
    if (w.mood !== undefined && this.mood(this.i) !== w.mood) return false;
    if (w.target_mood !== undefined && this.mood(this.t) !== w.target_mood) return false;
    if (w.remembers !== undefined && this.remembered(this.i, this.t, w.remembers) === false) return false;
    if (w.target_remembers !== undefined && this.remembered(this.t, this.i, w.target_remembers) === false) return false;
    if (w.owes !== undefined && this.owed()?.by !== w.owes) return false;
    if (w.misfortune !== undefined && (this.misfortune() !== null) !== w.misfortune) return false;
    if (w.price !== undefined && (h().price !== null) !== w.price) return false;
    if (w.told !== undefined && (this.facts.told ?? false) !== w.told) return false;
    if (w.stale !== undefined && (this.facts.stale ?? false) !== w.stale) return false;
    if (w.rumor !== undefined && this.facts.rumor !== w.rumor) return false;
    if (w.heard !== undefined && this.facts.heard !== w.heard) return false;
    if (w.secondhand !== undefined && (this.facts.secondhand ?? false) !== w.secondhand) return false;
    if (w.about !== undefined && this.facts.about !== w.about) return false;
    if (w.child !== undefined && this.child(this.i) !== w.child) return false;
    if (w.target_child !== undefined && this.child(this.t) !== w.target_child) return false;
    if (w.initiator !== undefined && !this.isWho(this.i, w.initiator)) return false;
    if (w.target !== undefined && !this.isWho(this.t, w.target)) return false;
    return true;
  }
  /** Does this speaker fit a line's `initiator` / `target` block (a teller, a kind of person)? */
  private isWho(id: ActorId, who: NonNullable<When['initiator']>): boolean {
    const a = this.world.actors[id];
    return a !== undefined && whoMatches(who, a, this.cultureByKey.get(a.key) ?? null, this.ctx.now);
  }
  /** Slots every line may use. Per-turn slots ({you}) are added when the turn is filled. */
  slots(line: TalkLine): Record<string, string> {
    return this.once(`slots:${line.when.remembers ?? ''}:${line.when.target_remembers ?? ''}`, () =>
      this.makeSlots(line),
    );
  }
  address(speaker: ActorId, listener: ActorId): string {
    return this.once(`address:${speaker}`, () => addressOf(this, speaker, listener));
  }
  private makeSlots(line: TalkLine): Record<string, string> {
    const w = this.world;
    const content = this.ctx.content;
    const place = this.placeId !== null ? w.places[this.placeId] : undefined;
    const siteId = place?.siteId ?? content.scenarios[w.meta.scenarioId]?.site;
    const site = siteId ? content.sites[siteId] : undefined;
    const out: Record<string, string> = {
      place: place?.name.replace(/^The /, 'the ') ?? 'here',
      town: site?.name ?? 'the village',
      // A creek with a name is named ("Hasp Creek"); otherwise it is just the creek.
      creek: site?.landmarks?.creek ?? 'the creek',
      main_street: site?.landmarks?.main_street ?? 'the main street',
      weekday: WEEKDAYS[this.ctx.cal.weekday] ?? '',
      season: this.ctx.cal.season,
      initiator: nameOf(w, this.i),
      target: nameOf(w, this.t),
      initiator_given: givenOf(w, this.i),
      target_given: givenOf(w, this.t),
    };
    const h = this.hour;
    if (h.price) {
      out.price_item = h.price.item;
      out.price = h.price.price;
      out.store = h.price.store.replace(/^The /, 'the ');
    }
    const mis = this.misfortune();
    if (mis) out.misfortune = mis;
    const owed = this.owed();
    if (owed) out.owed = formatCents(owed.cents);
    const rk = line.when.remembers ?? line.when.target_remembers;
    if (rk !== undefined) {
      const [owner, other] = line.when.remembers !== undefined ? [this.i, this.t] : [this.t, this.i];
      const p = this.remembered(owner, other, rk);
      const name = p !== false && p !== null ? w.places[p]?.name : undefined;
      out.memory_place = name ? `at ${name.replace(/^The /, 'the ')}` : 'that day';
    }
    return { ...out, ...(this.facts.slots ?? {}) };
  }
}

const WEEKDAYS: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

function nameOf(world: World, id: ActorId): string {
  const a = world.actors[id];
  return a ? shortName(a) : 'someone';
}

/** First name to call someone by (a family-less name "Ellis Wayfarer" gives "Ellis"). */
function givenOf(world: World, id: ActorId): string {
  const a = world.actors[id];
  if (!a) return 'friend';
  if (a.name.nickname) return a.name.nickname;
  return a.name.family ? a.name.given : (a.name.given.split(' ')[0] ?? a.name.given);
}

/** How `speaker` addresses `listener`: a first name among intimates, a title among acquaintances. */
function addressOf(scene: Scene, speaker: ActorId, listener: ActorId): string {
  const w = scene.world;
  const l = w.actors[listener];
  if (!l) return 'friend';
  const age = yearsBetween(l.born, scene.ctx.now);
  if (scene.close() || age < 15) return givenOf(w, listener);
  if (!opinionRecord(w, speaker, listener)) return l.sex === 'male' ? 'sir' : "ma'am";
  const title = spokenTitle(titleOf(w, scene.ctx.content, l));
  const family = l.name.family || l.name.given.split(' ').slice(1).join(' ') || l.name.given;
  return `${title} ${family}`;
}

/**
 * How `speaker` names a third person in talk: a first name for their own kin or household, a
 * title and surname otherwise ("Mrs. Fenn"), or the full name when they have none.
 */
export function referTo(world: World, ctx: Pick<SimContext, 'content'>, speaker: ActorId, other: ActorId): string {
  const a = world.actors[speaker];
  const o = world.actors[other];
  if (!o) return 'someone';
  if (a && (a.householdId === o.householdId || areKinBy(world, ctx.content, speaker, other)))
    return givenOf(world, other);
  if (!o.name.family) return nameOf(world, other);
  return `${spokenTitle(titleOf(world, ctx.content, o))} ${o.name.family}`;
}

/** A title as it is said aloud: "Reverend", "Doctor" (the page's "Rev.", "Dr."). */
function spokenTitle(title: string): string {
  return title === 'Rev.' ? 'Reverend' : title === 'Dr.' ? 'Doctor' : title;
}

// ---- expansion ----

function cultureOf(world: World, idx: TalkIndex, id: ActorId): string | null {
  const a = world.actors[id];
  return a ? (idx.cultureByKey.get(a.key) ?? null) : null;
}

function expandWords(text: string, idx: TalkIndex, culture: string | null, r: Rng, depth = 0): string {
  if (depth > 3) return text;
  return text.replace(/#([a-z][a-z0-9_]*)#/g, (_m, id: string) => {
    const w = idx.words[id];
    if (!w) return '';
    const list = (culture !== null ? w.by_culture[culture] : undefined) ?? w.words;
    return expandWords(r.pick(list) ?? '', idx, culture, r, depth + 1);
  });
}

function expandAlternatives(text: string, r: Rng): string {
  return text.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, body: string) => r.pick(body.split('|')) ?? '');
}

function fillSlots(text: string, slots: Record<string, string>): string {
  return text.replace(/\{(\^?)([a-z][a-z0-9_]*)\}/g, (_m, cap: string, name: string) => {
    const v = slots[name] ?? '';
    return cap && v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  });
}

function tidy(s: string): string {
  const t = s
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/,([.!?])/g, '$1')
    .replace(/^[,\s]+/, '')
    .trim()
    // A word of idiom that opens a sentence takes the capital ("Good day. God willing...").
    .replace(/([.!?]) +([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`);
  return t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// ---- choosing ----

function pairKey(a: ActorId, b: ActorId): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Lines said at one place stay out of the room's talk this long (two pairs, one joke). */
const ROOM = 3 * 60;
/** A speaker does not say the same line again, to anyone, for this long when another fits. */
const SPEAKER = 3 * 1440;

function speakerKey(id: ActorId): string {
  return `s${id}`;
}

function listenerKey(id: ActorId): string {
  return `h${id}`;
}

function retention(key: string): number {
  return key.startsWith('h') ? HEARD : key.startsWith('p') ? ROOM : key.startsWith('s') ? SPEAKER : WEEK;
}

function placeKey(placeId: PlaceId | null): string | null {
  return placeId === null ? null : `p${placeId}`;
}

function remember(world: World, key: string, ids: readonly string[], now: number): void {
  world.social.talk ??= {};
  const rec = world.social.talk[key] ?? {};
  for (const id of ids) {
    delete rec[id];
    rec[id] = now;
  }
  // Pair/speaker/room cooldowns retain their full live windows. Listener hashes also have
  // a hard count cap; under exceptional load the oldest remembered words are forgotten first.
  const keep = retention(key);
  const hashes = Object.keys(rec).filter((id) => {
    if (now - (rec[id] ?? 0) < keep) return true;
    delete rec[id];
    return false;
  });
  if (key.startsWith('h')) {
    if (hashes.length > MAX_HEARD) {
      hashes.sort((a, b) => (rec[a] ?? 0) - (rec[b] ?? 0) || Number(a) - Number(b));
      for (const hash of hashes.slice(0, hashes.length - MAX_HEARD)) delete rec[hash];
    }
  }
  world.social.talk[key] = rec;
}

/** Daily expiry of pair/speaker/room cooldowns and the bounded 30-day listener window. */
export function pruneTalk(world: World, now: number): void {
  const talk = world.social.talk;
  if (!talk) return;
  for (const k of Object.keys(talk)) {
    const rec = talk[k] ?? {};
    const keep = retention(k);
    for (const id of Object.keys(rec)) if (now - (rec[id] ?? 0) >= keep) delete rec[id];
    if (Object.keys(rec).length === 0) delete talk[k];
  }
}

export interface ComposeRequest {
  def: InteractionDef;
  initiatorId: ActorId;
  targetId: ActorId;
  placeId: PlaceId | null;
  success: boolean;
  part: 'act' | 'said';
  facts?: TalkFacts;
}

/**
 * Compose the words of an exchange, or null when no line fits (content validation makes sure
 * every interaction has `act` lines for each outcome). Records the lines used for the pair.
 */
export function composeExchange(world: World, ctx: SimContext, req: ComposeRequest): Exchange | null {
  const idx = indexOf(ctx.content, world.meta.scenarioId);
  const pool = (req.part === 'said' ? idx.said : idx.act).get(req.def.id);
  if (!pool || pool.length === 0) return null;
  const i = req.initiatorId;
  const t = req.targetId;
  const scene = new Scene(world, ctx, i, t, req.placeId, req.facts ?? {});
  scene.cultureByKey = idx.cultureByKey;
  const outcome = req.success ? 'success' : 'failure';
  const fits = pool.filter(
    (l) => !l.tags?.includes('repeat_aware') && (l.outcome === 'any' || l.outcome === outcome) && scene.matches(l.when),
  );
  if (fits.length === 0) return null;
  const pk = pairKey(i, t);
  const room = placeKey(req.placeId);
  const recent = world.social.talk?.[pk];
  const heardHere = room !== null ? world.social.talk?.[room] : undefined;
  const byI = world.social.talk?.[speakerKey(i)];
  const byT = world.social.talk?.[speakerKey(t)];
  const within = (rec: Record<string, number> | undefined, id: string, span: number): boolean =>
    rec?.[id] !== undefined && ctx.now - (rec[id] ?? 0) < span;
  const r = ctx.rng('social', mixKey(i, t, hashString32(req.def.id), SALT_TALK, req.part === 'said' ? 1 : 0));
  // Cooldowns are preferences, not barriers to unheard text. Child-specific lines have first
  // choice, then ordinary lines whose conditions fit: a tiny child pool must not trap a child
  // into hearing the same reply hundreds of times while suitable general lines go unused.
  const child = scene.child(i) || scene.child(t);
  const priority = (l: TalkLine): number => {
    const grown = child && l.when.child === undefined && l.when.target_child === undefined ? 3 : 0;
    if (within(recent, l.id, WEEK) || within(heardHere, l.id, ROOM)) return grown + 2;
    return grown + (within(byI, l.id, SPEAKER) || within(byT, l.id, SPEAKER) ? 1 : 0);
  };
  const tiers: TalkLine[][] = Array.from({ length: 6 }, () => []);
  for (const l of fits) tiers[priority(l)]?.push(l);

  const lastHeard = (turn: TalkTurn): number => {
    const listener = turn.speakerId === i ? t : i;
    const at = world.social.talk?.[listenerKey(listener)]?.[String(hashString32(turn.text))];
    return at !== undefined && ctx.now - at < HEARD ? at : -1;
  };
  let chosen: { line: TalkLine; turns: TalkTurn[]; repeats: number; last: number } | undefined;
  // Try each eligible template once, then two more renderings of templates with alternatives.
  // Rejection checks the final text, including replies shared by different template ids.
  search: for (let pass = 0; pass < 3; pass++) {
    for (const tier of tiers) {
      const candidates = pass === 0 ? [...tier] : tier.filter((l) => l.lines.some((x) => /[#|]/.test(x.text)));
      while (candidates.length > 0) {
        const line = r.weighted(candidates, (l) => idx.weights.get(l) ?? l.weight);
        if (!line) break;
        candidates.splice(candidates.indexOf(line), 1);
        // Candidate expansion uses its own counter-based stream, unaffected by skipped lines.
        const turns = render(line, scene, idx, r.fork(mixKey(hashString32(line.id), pass)));
        if (turns.length === 0) continue;
        const times = turns.map(lastHeard);
        const repeats = times.filter((at) => at >= 0).length;
        const last = Math.max(...times);
        if (!chosen || repeats < chosen.repeats || (repeats === chosen.repeats && last < chosen.last))
          chosen = { line, turns, repeats, last };
        if (repeats === 0) break search;
      }
    }
  }
  if (!chosen) return null;
  const { line, turns } = chosen;
  const ids = [line.id];
  if (chosen.repeats > 0) {
    const repeated = turns.find((turn) => lastHeard(turn) >= 0);
    if (repeated) {
      const speaker = repeated.speakerId;
      const listener = speaker === i ? t : i;
      // Repeat-aware content is written as the target's response, whichever side repeated.
      const replyScene = new Scene(world, ctx, speaker, listener, req.placeId, req.facts ?? {});
      replyScene.cultureByKey = idx.cultureByKey;
      const replies = pool.filter(
        (l) =>
          l.tags?.includes('repeat_aware') &&
          (l.outcome === 'any' || l.outcome === outcome) &&
          replyScene.matches(l.when),
      );
      while (replies.length > 0) {
        const reply = r.weighted(replies, (l) => l.weight);
        if (!reply) break;
        replies.splice(replies.indexOf(reply), 1);
        const response = render(reply, replyScene, idx, r.fork(hashString32(reply.id)));
        // The acknowledgement itself should not become a new repeated stock response.
        if (
          response.length !== 1 ||
          response[0]?.speakerId !== listener ||
          response.some((turn) => lastHeard(turn) >= 0)
        )
          continue;
        const repeatedAt = turns.indexOf(repeated);
        const at = turns.findIndex((turn, n) => n > repeatedAt && turn.speakerId === listener);
        if (at >= 0) turns[at] = response[0] as TalkTurn;
        else if (turns.length < 3) turns.push(response[0] as TalkTurn);
        else continue;
        ids.push(reply.id);
        break;
      }
    }
  }
  remember(world, pk, ids, ctx.now);
  if (room !== null) remember(world, room, ids, ctx.now);
  remember(world, speakerKey(i), ids, ctx.now);
  remember(world, speakerKey(t), ids, ctx.now);
  for (const turn of turns) {
    const listener = turn.speakerId === i ? t : i;
    remember(world, listenerKey(listener), [String(hashString32(turn.text))], ctx.now);
  }
  return {
    line: turns.map((x) => `${x.speaker}: “${x.text}”`).join(' '),
    lines: turns,
    ids,
  };
}

function render(line: TalkLine, scene: Scene, idx: TalkIndex, r: Rng): TalkTurn[] {
  const base = scene.slots(line);
  const turns: TalkTurn[] = [];
  for (const turn of line.lines) {
    const speaker = turn.by === 'initiator' ? scene.i : scene.t;
    const listener = speaker === scene.i ? scene.t : scene.i;
    const culture = cultureOf(scene.world, idx, speaker);
    const slots: Record<string, string> = { you: scene.address(speaker, listener) };
    for (const [k, v] of Object.entries(base)) slots[k] = v.includes('#') ? expandWords(v, idx, culture, r) : v;
    const words = expandWords(turn.text, idx, culture, r);
    const text = tidy(fillSlots(expandAlternatives(words, r), slots));
    if (text) turns.push({ speaker: nameOf(scene.world, speaker), speakerId: speaker, text });
  }
  return turns;
}
