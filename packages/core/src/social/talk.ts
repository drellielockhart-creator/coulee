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
import { hashString32, mixKey, rng } from '../rng.ts';
import type { SimContext } from '../sim/context.ts';
import { yearsBetween } from '../time.ts';
import type { World } from '../world.ts';
import type { TalkRef } from './events.ts';
import { formatCents } from './model.ts';
import { opinionRecord, owedCents } from './opinion.ts';
import { relationsBetween } from './pairs.ts';
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
  /** Content-only prefilter of each pool: ordinary (not repeat-aware) lines for one outcome. */
  base: Map<string, TalkLine[]>;
}

function basePool(idx: TalkIndex, part: string, iid: string, outcome: string, pool: TalkLine[]): TalkLine[] {
  const key = `${part}|${iid}|${outcome}`;
  let lines = idx.base.get(key);
  if (!lines) {
    lines = pool.filter((l) => !l.tags?.includes('repeat_aware') && (l.outcome === 'any' || l.outcome === outcome));
    idx.base.set(key, lines);
  }
  return lines;
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
  const idx: TalkIndex = { act, said, words: content.talk_words ?? {}, cultureByKey, weights, base: new Map() };
  indexCache = { content, scenarioId, idx };
  return idx;
}

// ---- the scene: conditions read lazily from the world ----

type Mood = string;

/** Per-hour facts shared by every exchange that hour (weather, observances, prices, news).
 * The store price and the town's misfortunes are read only when a line asks for them. */
class HourFacts {
  readonly key: string;
  readonly weather: 'rain' | 'snow' | 'dry';
  readonly temp: 'freezing' | 'cold' | 'mild' | 'warm' | 'hot';
  readonly part: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
  readonly observances: string[];
  private readonly world: World;
  private readonly ctx: SimContext;
  private priceMemo: { item: string; price: string; store: string } | null | undefined;
  /** Pools filtered by this hour's conditions (Scene.hourPool). */
  readonly pools = new Map<string, readonly TalkLine[]>();
  private misfortuneMemo: Array<{ propId: PropId; text: string; householdId: number }> | undefined;
  constructor(world: World, ctx: SimContext, key: string) {
    this.world = world;
    this.ctx = ctx;
    this.key = key;
    const cal = ctx.cal;
    const f = airTempF(cal, world);
    const wet = isRaining(world.meta.seed, cal, world);
    const h = cal.hour;
    this.observances = Object.keys(ctx.content.observances ?? {})
      .sort()
      .filter((id) => {
        const def = ctx.content.observances[id];
        return def !== undefined && observanceActive(def, cal);
      });
    this.weather = wet ? (f <= 32 ? 'snow' : 'rain') : 'dry';
    this.temp = f <= 32 ? 'freezing' : f < 50 ? 'cold' : f < 70 ? 'mild' : f < 85 ? 'warm' : 'hot';
    this.part =
      h >= 5 && h < 11
        ? 'morning'
        : h < 14 && h >= 11
          ? 'midday'
          : h >= 14 && h < 18
            ? 'afternoon'
            : h >= 18 && h < 22
              ? 'evening'
              : 'night';
  }
  /** A staple's price at the store the town shops at (provisions' bestStore: the most food on its
   * shelves, not the first store by place id, which named the tavern; group D's r2 note). The item
   * rotates with the day so the talk of prices does not fix on flour. */
  get price(): { item: string; price: string; store: string } | null {
    if (this.priceMemo !== undefined) return this.priceMemo;
    const { world, ctx } = this;
    let price: { item: string; price: string; store: string } | null = null;
    const store = bestStore(world, ctx);
    if (store) {
      const item = STAPLES[ctx.cal.dayIndex % STAPLES.length] as string;
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
    this.priceMemo = price;
    return price;
  }
  /** The town's misfortunes of the last fortnight, in words, latest first (a speaker names one they know of). */
  get misfortunes(): Array<{ propId: PropId; text: string; householdId: number }> {
    if (this.misfortuneMemo) return this.misfortuneMemo;
    const { world, ctx } = this;
    const out: Array<{ propId: PropId; text: string; householdId: number }> = [];
    for (const m of rowsOf(world.belief.misfortunes).sort((a, b) => b.at - a.at || b.id - a.id)) {
      if (ctx.now - m.at > 14 * 1440 || m.at > ctx.now) continue;
      const text = misfortuneWords(world, ctx.content, m.id);
      if (text) out.push({ propId: m.propId, text, householdId: m.householdId });
    }
    this.misfortuneMemo = out;
    return out;
  }
}

let hourCache: { world: World; facts: HourFacts } | null = null;

const STAPLES = ['flour', 'salt_pork', 'coffee_green', 'cornmeal', 'potatoes', 'sugar_brown', 'eggs'] as const;

function hourFacts(world: World, ctx: SimContext): HourFacts {
  const key = `${world.meta.seed}:${ctx.now}`;
  if (hourCache && hourCache.world === world && hourCache.facts.key === key) return hourCache.facts;
  const facts = new HourFacts(world, ctx, key);
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

/** The `when` conditions in their canonical evaluation order. */
const WHEN_ORDER = [
  'weather',
  'temp',
  'season',
  'part',
  'sabbath',
  'observance',
  'venue',
  'label',
  'target_label',
  'kin',
  'household',
  'courting',
  'mood',
  'target_mood',
  'remembers',
  'target_remembers',
  'owes',
  'misfortune',
  'price',
  'told',
  'stale',
  'rumor',
  'heard',
  'secondhand',
  'about',
  'child',
  'target_child',
  'initiator',
  'target',
] as const;
type WhenKey = (typeof WHEN_ORDER)[number];
type WhoBlock = NonNullable<When['initiator']>;
/** Conditions that read only the hour (weather, calendar, the store's price): shared by every
 * exchange in it, so a pool is filtered by them once an hour (`hourPool`). */
const HOUR_KEYS: ReadonlySet<WhenKey> = new Set<WhenKey>([
  'weather',
  'temp',
  'season',
  'part',
  'sabbath',
  'observance',
  'price',
]);
/** The conditions a `when` sets, in canonical order, split into hour-level and the rest.
 * Content-only, cached per object (bounded). */
const whenKeyCache = new Map<When, { all: readonly WhenKey[]; hour: readonly WhenKey[]; pair: readonly WhenKey[] }>();
function whenSplit(w: When): { all: readonly WhenKey[]; hour: readonly WhenKey[]; pair: readonly WhenKey[] } {
  let keys = whenKeyCache.get(w);
  if (!keys) {
    if (whenKeyCache.size >= 8192) whenKeyCache.clear();
    const all = WHEN_ORDER.filter((k) => w[k] !== undefined);
    keys = { all, hour: all.filter((k) => HOUR_KEYS.has(k)), pair: all.filter((k) => !HOUR_KEYS.has(k)) };
    whenKeyCache.set(w, keys);
  }
  return keys;
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
  // Hot path (every candidate line of every exchange): plain lazy fields, no closures or string keys.
  private hourMemo: HourFacts | undefined;
  private labelI: string | undefined;
  private labelT: string | undefined;
  private kinMemo: boolean | undefined;
  private courtingMemo: boolean | undefined;
  private moodI: string | undefined;
  private moodT: string | undefined;
  get hour(): HourFacts {
    this.hourMemo ??= hourFacts(this.world, this.ctx);
    return this.hourMemo;
  }
  label(from: ActorId, to: ActorId): string {
    // Callers always pass the pair (i, t) or (t, i); memoized by the speaking side as before.
    if (from === this.i) {
      this.labelI ??= labelOf(this.world, from, to);
      return this.labelI;
    }
    if (from === this.t) {
      this.labelT ??= labelOf(this.world, from, to);
      return this.labelT;
    }
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
    this.kinMemo ??= areKinBy(this.world, this.ctx.content, this.i, this.t);
    return this.kinMemo;
  }
  courting(): boolean {
    this.courtingMemo ??= relationsBetween(this.world, this.i, this.t).some(
      (r) => r.kind === 'courting' || r.kind === 'betrothed',
    );
    return this.courtingMemo;
  }
  private childI: boolean | undefined;
  private childT: boolean | undefined;
  child(id: ActorId): boolean {
    if (id === this.i) {
      this.childI ??= this.isChild(id);
      return this.childI;
    }
    if (id === this.t) {
      this.childT ??= this.isChild(id);
      return this.childT;
    }
    return this.once(`child:${id}`, () => this.isChild(id));
  }
  private isChild(id: ActorId): boolean {
    const a = this.world.actors[id];
    return a !== undefined && yearsBetween(a.born, this.ctx.now) < CHILD_AGE;
  }
  mood(id: ActorId): string {
    if (id === this.i) {
      this.moodI ??= moodOf(this.world, this.ctx, id);
      return this.moodI;
    }
    if (id === this.t) {
      this.moodT ??= moodOf(this.world, this.ctx, id);
      return this.moodT;
    }
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
  /** Does a line's `when` hold here? Only the conditions the line sets are visited, in the
   * canonical order below (hot path: every candidate line of every exchange). */
  matches(w: When): boolean {
    for (const key of whenSplit(w).all) if (!this.holds(w, key)) return false;
    return true;
  }
  /** `matches` for a line already known to pass its hour-level conditions (`hourPool`). */
  matchesPair(w: When): boolean {
    for (const key of whenSplit(w).pair) if (!this.holds(w, key)) return false;
    return true;
  }
  /** A pool's lines whose hour-level conditions hold this hour (same order; memoized per hour). */
  hourPool(key: string, lines: readonly TalkLine[]): readonly TalkLine[] {
    const memo = this.hour.pools;
    let out = memo.get(key);
    if (!out) {
      out = lines.filter((l) => {
        for (const k of whenSplit(l.when).hour) if (!this.holds(l.when, k)) return false;
        return true;
      });
      memo.set(key, out);
    }
    return out;
  }
  private holds(w: When, key: WhenKey): boolean {
    switch (key) {
      case 'weather':
        if (this.hour.weather !== w.weather) return false;
        break;
      case 'temp':
        if (this.hour.temp !== w.temp) return false;
        break;
      case 'season':
        if (this.ctx.cal.season !== w.season) return false;
        break;
      case 'part':
        if (this.hour.part !== w.part) return false;
        break;
      case 'sabbath':
        if (this.ctx.cal.isSabbath !== w.sabbath) return false;
        break;
      case 'observance':
        if (!this.hour.observances.includes(w.observance as string)) return false;
        break;
      case 'venue': {
        const tags = this.placeId !== null ? (this.world.places[this.placeId]?.tags ?? []) : [];
        if (!tags.includes(w.venue as string)) return false;
        break;
      }
      case 'label':
        if (this.label(this.i, this.t) !== w.label) return false;
        break;
      case 'target_label':
        if (this.label(this.t, this.i) !== w.target_label) return false;
        break;
      case 'kin':
        if (this.kin() !== w.kin) return false;
        break;
      case 'household': {
        const same = this.world.actors[this.i]?.householdId === this.world.actors[this.t]?.householdId;
        if (same !== w.household) return false;
        break;
      }
      case 'courting':
        if (this.courting() !== w.courting) return false;
        break;
      case 'mood':
        if (this.mood(this.i) !== w.mood) return false;
        break;
      case 'target_mood':
        if (this.mood(this.t) !== w.target_mood) return false;
        break;
      case 'remembers':
        if (this.remembered(this.i, this.t, w.remembers as string) === false) return false;
        break;
      case 'target_remembers':
        if (this.remembered(this.t, this.i, w.target_remembers as string) === false) return false;
        break;
      case 'owes':
        if (this.owed()?.by !== w.owes) return false;
        break;
      case 'misfortune':
        if ((this.misfortune() !== null) !== w.misfortune) return false;
        break;
      case 'price':
        if ((this.hour.price !== null) !== w.price) return false;
        break;
      case 'told':
        if ((this.facts.told ?? false) !== w.told) return false;
        break;
      case 'stale':
        if ((this.facts.stale ?? false) !== w.stale) return false;
        break;
      case 'rumor':
        if (this.facts.rumor !== w.rumor) return false;
        break;
      case 'heard':
        if (this.facts.heard !== w.heard) return false;
        break;
      case 'secondhand':
        if ((this.facts.secondhand ?? false) !== w.secondhand) return false;
        break;
      case 'about':
        if (this.facts.about !== w.about) return false;
        break;
      case 'child':
        if (this.child(this.i) !== w.child) return false;
        break;
      case 'target_child':
        if (this.child(this.t) !== w.target_child) return false;
        break;
      case 'initiator':
        if (!this.isWho(this.i, w.initiator as WhoBlock)) return false;
        break;
      case 'target':
        if (!this.isWho(this.t, w.target as WhoBlock)) return false;
        break;
    }
    return true;
  }
  /** Does this speaker fit a line's `initiator` / `target` block (a teller, a kind of person)? */
  private isWho(id: ActorId, who: NonNullable<When['initiator']>): boolean {
    const a = this.world.actors[id];
    return a !== undefined && whoMatches(who, a, this.cultureByKey.get(a.key) ?? null, this.ctx.now);
  }
  address(speaker: ActorId, listener: ActorId): string {
    return this.once(`address:${speaker}`, () => addressOf(this, speaker, listener));
  }
  /**
   * One world slot of `line` as the turn's speaker (`by`) would say it, or undefined when the
   * scene has no such value (no price, no misfortune, no debt). Facts slots are not read here:
   * they take precedence and are captured by the caller. Read only for slots a chosen turn uses.
   */
  worldSlot(name: string, line: TalkLine, by: 'initiator' | 'target'): string | undefined {
    const w = this.world;
    switch (name) {
      case 'you':
        return by === 'initiator' ? this.address(this.i, this.t) : this.address(this.t, this.i);
      case 'place': {
        const place = this.placeId !== null ? w.places[this.placeId] : undefined;
        return place?.name.replace(/^The /, 'the ') ?? 'here';
      }
      case 'town':
        return this.site()?.name ?? 'the village';
      case 'creek':
        // A creek with a name is named ("Hasp Creek"); otherwise it is just the creek.
        return this.site()?.landmarks?.creek ?? 'the creek';
      case 'main_street':
        return this.site()?.landmarks?.main_street ?? 'the main street';
      case 'weekday':
        return WEEKDAYS[this.ctx.cal.weekday] ?? '';
      case 'season':
        return this.ctx.cal.season;
      case 'initiator':
        return nameOf(w, this.i);
      case 'target':
        return nameOf(w, this.t);
      case 'initiator_given':
        return givenOf(w, this.i);
      case 'target_given':
        return givenOf(w, this.t);
      case 'price_item':
        return this.hour.price?.item;
      case 'price':
        return this.hour.price?.price;
      case 'store':
        return this.hour.price?.store.replace(/^The /, 'the ');
      case 'misfortune':
        return this.misfortune() ?? undefined;
      case 'owed': {
        const owed = this.owed();
        return owed ? formatCents(owed.cents) : undefined;
      }
      case 'memory_place': {
        const rk = line.when.remembers ?? line.when.target_remembers;
        if (rk === undefined) return undefined;
        const [owner, other] = line.when.remembers !== undefined ? [this.i, this.t] : [this.t, this.i];
        const p = this.remembered(owner, other, rk);
        const placeName = p !== false && p !== null ? w.places[p]?.name : undefined;
        return placeName ? `at ${placeName.replace(/^The /, 'the ')}` : 'that day';
      }
      default:
        return undefined;
    }
  }
  private site() {
    return this.once('site', () => {
      const content = this.ctx.content;
      const place = this.placeId !== null ? this.world.places[this.placeId] : undefined;
      const siteId = place?.siteId ?? content.scenarios[this.world.meta.scenarioId]?.site;
      return siteId ? content.sites[siteId] : undefined;
    });
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

// ---- expansion: templates compiled once; choices drawn without building the words ----

/**
 * A compiled template. `#word#` is a word of idiom (a per-culture pick, itself a template),
 * `{a|b}` alternatives, `{slot}`/`{^slot}` a value from the scene or the act. Choosing a line
 * walks the template with the line's seed and records only a skeleton (world slots stay
 * `{name}`), so the words themselves are built only when someone reads them (`renderTalk`).
 */
type Token =
  | { k: 0; s: string }
  | { k: 1; id: string }
  | { k: 2; opts: Token[][] }
  | { k: 3; name: string; cap: boolean };

const WORD_AT = /#([a-z][a-z0-9_]*)#/y;
const SLOT_BODY = /^(\^?)([a-z][a-z0-9_]*)$/;
const NO_TOKENS: readonly Token[] = [];

function compile(text: string, wordsOnly: boolean): Token[] {
  const out: Token[] = [];
  let lit = '';
  const flush = () => {
    if (lit) out.push({ k: 0, s: lit });
    lit = '';
  };
  let i = 0;
  while (i < text.length) {
    const c = text.charAt(i);
    if (c === '#') {
      WORD_AT.lastIndex = i;
      const m = WORD_AT.exec(text);
      if (m) {
        flush();
        out.push({ k: 1, id: m[1] as string });
        i += m[0].length;
        continue;
      }
    } else if (c === '{' && !wordsOnly) {
      const end = text.indexOf('}', i + 1);
      const open = text.indexOf('{', i + 1);
      if (end > i && (open < 0 || open > end)) {
        const body = text.slice(i + 1, end);
        const slot = body.includes('|') ? null : SLOT_BODY.exec(body);
        if (body.includes('|') || slot) {
          flush();
          out.push(
            slot
              ? { k: 3, name: slot[2] as string, cap: slot[1] === '^' }
              : { k: 2, opts: body.split('|').map((b) => compile(b, false)) },
          );
          i = end + 1;
          continue;
        }
      }
    }
    lit += c;
    i++;
  }
  flush();
  return out;
}

// Content strings are finite; act values with words ('#hedge_sure#') are few. Bounded anyway.
const compiledTemplates = new Map<string, readonly Token[]>();
const compiledValues = new Map<string, readonly Token[]>();
function compiled(text: string, wordsOnly: boolean): readonly Token[] {
  const cache = wordsOnly ? compiledValues : compiledTemplates;
  let tokens = cache.get(text);
  if (!tokens) {
    if (cache.size >= 16384) cache.clear();
    tokens = compile(text, wordsOnly);
    cache.set(text, tokens);
  }
  return tokens;
}

/** One walk of one turn: in skeleton mode `world` is null and world slots stay `{name}`. */
interface Walk {
  words: Record<string, TalkWord>;
  culture: string | null;
  facts: Record<string, string> | undefined;
  world: ((name: string) => string | undefined) | null;
  out: string;
  /** Skeleton mode: world slots the turn uses, and facts slots it uses. */
  used: string[];
  usedFacts: string[];
}

function capAt(w: Walk, at: number): void {
  if (w.out.length > at) w.out = w.out.slice(0, at) + w.out.charAt(at).toUpperCase() + w.out.slice(at + 1);
}

function walk(tokens: readonly Token[], w: Walk, r: Rng, depth: number): void {
  for (const tok of tokens) {
    switch (tok.k) {
      case 0:
        w.out += tok.s;
        break;
      case 1: {
        if (depth > 3) break;
        const def = w.words[tok.id];
        if (!def) break;
        const list = (w.culture !== null ? def.by_culture[w.culture] : undefined) ?? def.words;
        walk(compiled(r.pick(list) ?? '', false), w, r, depth + 1);
        break;
      }
      case 2:
        walk(r.pick(tok.opts) ?? NO_TOKENS, w, r, depth);
        break;
      case 3: {
        const at = w.out.length;
        const fact = w.facts?.[tok.name];
        if (fact !== undefined) {
          if (w.world === null && !w.usedFacts.includes(tok.name)) w.usedFacts.push(tok.name);
          if (fact.includes('#')) walk(compiled(fact, true), w, r, depth);
          else w.out += fact;
        } else if (w.world !== null) {
          w.out += w.world(tok.name) ?? '';
        } else {
          if (!w.used.includes(tok.name)) w.used.push(tok.name);
          w.out += `{${tok.name}}`;
        }
        if (tok.cap) capAt(w, at);
        break;
      }
    }
  }
}

/** The draws of one turn of a chosen line: counter-based on the line's seed, nothing else. */
function turnRng(seed: number, n: number): Rng {
  return rng(seed, 'social', 0, n);
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

// Derived index only: talk records remain the save data. This module owns every write;
// restored/replaced records get new identities and are indexed on first use. Refreshing
// the earliest entry may leave an early expiry bound, which only causes an extra scan.
// Bound retention across worlds without relying on GC-dependent collections (ADR 0001).
const talkExpiry = new Map<Record<string, number>, { count: number; next: number }>();
function expireTalk(rec: Record<string, number>, now: number, keep: number) {
  const index = { count: 0, next: Number.POSITIVE_INFINITY };
  for (const id of Object.keys(rec)) {
    const expires = (rec[id] ?? 0) + keep;
    if (now >= expires) delete rec[id];
    else {
      index.count++;
      index.next = Math.min(index.next, expires);
    }
  }
  if (!talkExpiry.has(rec) && talkExpiry.size >= 512) talkExpiry.clear();
  talkExpiry.set(rec, index);
  return index;
}

function remember(world: World, key: string, ids: readonly string[], now: number): void {
  world.social.talk ??= {};
  const rec = world.social.talk[key] ?? {};
  const keep = retention(key);
  let index = talkExpiry.get(rec);
  // Index before insertion without expiring: a refreshed key must keep its original
  // insertion/eviction semantics, including at the exact retention boundary.
  index ??= expireTalk(rec, Number.NEGATIVE_INFINITY, keep);
  for (const id of ids) {
    if (rec[id] === undefined) index.count++;
    delete rec[id];
    rec[id] = now;
  }
  if (ids.length) index.next = Math.min(index.next, now + keep);
  // Pair/speaker/room cooldowns retain their full live windows. Listener hashes also have
  // a hard count cap; under exceptional load the oldest remembered words are forgotten first.
  if (now >= index.next) index = expireTalk(rec, now, keep);
  if (key.startsWith('h') && index.count > MAX_HEARD) {
    const hashes = Object.keys(rec);
    hashes.sort((a, b) => (rec[a] ?? 0) - (rec[b] ?? 0) || Number(a) - Number(b));
    for (const hash of hashes.slice(0, hashes.length - MAX_HEARD)) delete rec[hash];
    index.count = MAX_HEARD;
  }
  world.social.talk[key] = rec;
}

/** Daily expiry of pair/speaker/room cooldowns and the bounded 30-day listener window. */
export function pruneTalk(world: World, now: number): void {
  const talk = world.social.talk;
  if (!talk) return;
  for (const k of Object.keys(talk)) {
    const rec = talk[k] ?? {};
    if (expireTalk(rec, now, retention(k)).count === 0) delete talk[k];
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

/** One chosen turn: the line, its turn index, the line's seed, who says it, and in which scope. */
interface TurnPlan {
  line: TalkLine;
  n: number;
  seed: number;
  by: 'initiator' | 'target';
  who: ActorId;
  s: number;
  /** Listener-memory identity of the turn: a hash of its skeleton (words and alternatives
   * chosen, act values filled, world slots as `{name}`). */
  sig: number;
  used: string[];
  usedFacts: string[];
}

interface Plan {
  turns: TurnPlan[];
  ids: string[];
  /** Scope 0: the exchange's scene; scope 1: the repeat-aware reply's (speaker and listener). */
  scenes: Scene[];
}

/** Does any turn of a line draw words or alternatives (so another draw may say it otherwise)? */
const choiceCache = new Map<TalkLine, boolean>();
function hasChoices(line: TalkLine): boolean {
  let v = choiceCache.get(line);
  if (v === undefined) {
    if (choiceCache.size >= 16384) choiceCache.clear();
    v = line.lines.some((x) => /[#|]/.test(x.text));
    choiceCache.set(line, v);
  }
  return v;
}

/** The skeleton plan of a line's turns (no words built); blank turns are dropped. */
function planLine(line: TalkLine, scene: Scene, idx: TalkIndex, seed: number, s: number): TurnPlan[] {
  const out: TurnPlan[] = [];
  for (let n = 0; n < line.lines.length; n++) {
    const turn = line.lines[n] as TalkLine['lines'][number];
    const who = turn.by === 'initiator' ? scene.i : scene.t;
    const w: Walk = {
      words: idx.words,
      culture: cultureOf(scene.world, idx, who),
      facts: scene.facts.slots,
      world: null,
      out: '',
      used: [],
      usedFacts: [],
    };
    walk(compiled(turn.text, false), w, turnRng(seed, n), 0);
    if (blank(w, scene, line, turn.by)) continue;
    out.push({
      line,
      n,
      seed,
      by: turn.by,
      who,
      s,
      sig: hashString32(w.out),
      used: w.used,
      usedFacts: w.usedFacts,
    });
  }
  return out;
}

/** A turn that would say nothing (only spaces and commas once its slots are filled). */
function blank(w: Walk, scene: Scene, line: TalkLine, by: 'initiator' | 'target'): boolean {
  if (w.used.length === 0) return !/[^\s,]/.test(w.out);
  if (/[^\s,]/.test(w.out.replace(/\{[a-z][a-z0-9_]*\}/g, ''))) return false;
  return !w.used.some((name) => /[^\s,]/.test(scene.worldSlot(name, line, by) ?? ''));
}

function cultureOf(world: World, idx: TalkIndex, id: ActorId): string | null {
  const a = world.actors[id];
  return a ? (idx.cultureByKey.get(a.key) ?? null) : null;
}

/**
 * Choose an exchange's lines (and record them for the pair, room, speakers and listeners)
 * without building its words. Null when no line fits (content validation makes sure every
 * interaction has `act` lines for each outcome).
 */
function chooseLines(world: World, ctx: SimContext, req: ComposeRequest): Plan | null {
  const idx = indexOf(ctx.content, world.meta.scenarioId);
  const pool = (req.part === 'said' ? idx.said : idx.act).get(req.def.id);
  if (!pool || pool.length === 0) return null;
  const i = req.initiatorId;
  const t = req.targetId;
  const scene = new Scene(world, ctx, i, t, req.placeId, req.facts ?? {});
  scene.cultureByKey = idx.cultureByKey;
  const outcome = req.success ? 'success' : 'failure';
  const fits = scene
    .hourPool(`${req.part}|${req.def.id}|${outcome}`, basePool(idx, req.part, req.def.id, outcome, pool))
    .filter((l) => scene.matchesPair(l.when));
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
  // Cooldowns are preferences, not barriers to unheard words. Child-specific lines have first
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

  const listeners = [world.social.talk?.[listenerKey(t)], world.social.talk?.[listenerKey(i)]];
  const lastHeard = (turn: TurnPlan): number => {
    const at = listeners[turn.who === i ? 0 : 1]?.[String(turn.sig)];
    return at !== undefined && ctx.now - at < HEARD ? at : -1;
  };
  let chosen: { line: TalkLine; turns: TurnPlan[]; repeats: number; last: number } | undefined;
  // Try each eligible template once, then two more draws of templates with alternatives.
  // Rejection checks each turn's skeleton, including replies shared by different template ids.
  search: for (let pass = 0; pass < 3; pass++) {
    for (const tier of tiers) {
      const candidates = pass === 0 ? [...tier] : tier.filter(hasChoices);
      while (candidates.length > 0) {
        const line = r.weighted(candidates, (l) => idx.weights.get(l) ?? l.weight);
        if (!line) break;
        candidates.splice(candidates.indexOf(line), 1);
        // Candidate draws use their own counter-based seed, unaffected by skipped lines.
        const seed = r.fork(mixKey(hashString32(line.id), pass)).u32();
        const turns = planLine(line, scene, idx, seed, 0);
        if (turns.length === 0) continue;
        let repeats = 0;
        let last = -1;
        for (const turn of turns) {
          const at = lastHeard(turn);
          if (at >= 0) repeats++;
          if (at > last) last = at;
        }
        if (!chosen || repeats < chosen.repeats || (repeats === chosen.repeats && last < chosen.last))
          chosen = { line, turns, repeats, last };
        if (repeats === 0) break search;
      }
    }
  }
  if (!chosen) return null;
  const { line, turns } = chosen;
  const ids = [line.id];
  const scenes = [scene];
  if (chosen.repeats > 0) {
    const repeated = turns.find((turn) => lastHeard(turn) >= 0);
    if (repeated) {
      const speaker = repeated.who;
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
        const response = planLine(reply, replyScene, idx, r.fork(hashString32(reply.id)).u32(), 1);
        // The acknowledgement itself should not become a new repeated stock response.
        if (response.length !== 1 || response[0]?.who !== listener || response.some((turn) => lastHeard(turn) >= 0))
          continue;
        const repeatedAt = turns.indexOf(repeated);
        const at = turns.findIndex((turn, n) => n > repeatedAt && turn.who === listener);
        if (at >= 0) turns[at] = response[0] as TurnPlan;
        else if (turns.length < 3) turns.push(response[0] as TurnPlan);
        else continue;
        ids.push(reply.id);
        scenes.push(replyScene);
        break;
      }
    }
  }
  remember(world, pk, ids, ctx.now);
  if (room !== null) remember(world, room, ids, ctx.now);
  remember(world, speakerKey(i), ids, ctx.now);
  remember(world, speakerKey(t), ids, ctx.now);
  for (const turn of turns) {
    const listener = turn.who === i ? t : i;
    remember(world, listenerKey(listener), [String(turn.sig)], ctx.now);
  }
  return { turns, ids, scenes };
}

/** A turn's words: the same walk as its skeleton, with every slot filled. */
function turnText(
  text: string,
  seed: number,
  n: number,
  words: Record<string, TalkWord>,
  culture: string | null,
  facts: Record<string, string> | undefined,
  world: (name: string) => string | undefined,
): string {
  const w: Walk = { words, culture, facts, world, out: '', used: [], usedFacts: [] };
  walk(compiled(text, false), w, turnRng(seed, n), 0);
  return tidy(w.out);
}

function exchangeOf(lines: TalkTurn[]): { line: string; lines: TalkTurn[] } {
  return { line: lines.map((x) => `${x.speaker}: “${x.text}”`).join(' '), lines };
}

/**
 * Compose the words of an exchange now (the private `said` part, and tests), or null when no
 * line fits. Records the lines used for the pair. The same choice as `chooseExchange`; its words
 * are exactly what `renderTalk` gives for that choice's reference.
 */
export function composeExchange(world: World, ctx: SimContext, req: ComposeRequest): Exchange | null {
  const plan = chooseLines(world, ctx, req);
  if (!plan) return null;
  const idx = indexOf(ctx.content, world.meta.scenarioId);
  const lines: TalkTurn[] = [];
  for (const turn of plan.turns) {
    const scene = plan.scenes[turn.s] as Scene;
    const text = turnText(
      turn.line.lines[turn.n]?.text ?? '',
      turn.seed,
      turn.n,
      idx.words,
      cultureOf(world, idx, turn.who),
      scene.facts.slots,
      (name) => scene.worldSlot(name, turn.line, turn.by),
    );
    if (text) lines.push({ speaker: nameOf(world, turn.who), speakerId: turn.who, text });
  }
  return { ...exchangeOf(lines), ids: plan.ids };
}

/**
 * Choose an exchange (recording it like `composeExchange`) but keep only a reference to its
 * words: the chosen turns and seeds, and the slot values those turns use, captured now. Nobody
 * pays for the words until a view reads them (`renderTalk`).
 */
export function chooseExchange(
  world: World,
  ctx: SimContext,
  req: ComposeRequest,
): { ids: string[]; talk: TalkRef } | null {
  const plan = chooseLines(world, ctx, req);
  if (!plan) return null;
  const idx = indexOf(ctx.content, world.meta.scenarioId);
  const scopes: TalkRef['scopes'] = plan.scenes.map((scene) => {
    const ci = cultureOf(world, idx, scene.i);
    const ct = cultureOf(world, idx, scene.t);
    return {
      slots: {},
      ni: nameOf(world, scene.i),
      nt: nameOf(world, scene.t),
      ...(ci !== null ? { ci } : {}),
      ...(ct !== null ? { ct } : {}),
    };
  });
  for (const turn of plan.turns) {
    const scope = scopes[turn.s] as TalkRef['scopes'][number];
    const scene = plan.scenes[turn.s] as Scene;
    for (const name of turn.used) {
      const key = name === 'you' ? `you:${turn.by}` : name;
      if (scope.slots[key] === undefined) scope.slots[key] = scene.worldSlot(name, turn.line, turn.by) ?? '';
    }
    for (const name of turn.usedFacts) {
      const v = scene.facts.slots?.[name];
      if (v !== undefined) {
        scope.facts ??= {};
        scope.facts[name] = v;
      }
    }
  }
  return {
    ids: plan.ids,
    talk: {
      turns: plan.turns.map((x) => ({ line: x.line.id, n: x.n, seed: x.seed, who: x.who, by: x.by, s: x.s })),
      scopes,
    },
  };
}

/** The words of a talk reference: exactly the text chosen when it was said, from content alone. */
export function renderTalk(content: ContentBundle, ref: TalkRef): { line: string; lines: TalkTurn[] } {
  const words = content.talk_words ?? {};
  const lines: TalkTurn[] = [];
  for (const turn of ref.turns) {
    const scope = ref.scopes[turn.s];
    const text = content.talk_lines?.[turn.line]?.lines[turn.n]?.text;
    if (!scope || text === undefined) continue;
    const said = turnText(
      text,
      turn.seed,
      turn.n,
      words,
      (turn.by === 'initiator' ? scope.ci : scope.ct) ?? null,
      scope.facts,
      (name) => scope.slots[name === 'you' ? `you:${turn.by}` : name],
    );
    if (said) lines.push({ speaker: turn.by === 'initiator' ? scope.ni : scope.nt, speakerId: turn.who, text: said });
  }
  return exchangeOf(lines);
}
