/**
 * Pure display formatting. OWNER: module:web.
 *
 * Everything here turns numbers the core computed into words and units. Nothing here is a
 * rule: no thresholds that change outcomes, only how a value is printed (11 §1.5 rungs 1–3).
 */

export const G_PER_LB = 453.592;
export const G_PER_OZ = 28.3495;

/** "$4.15", "−$0.40", "12¢" for small sums (period price tags). */
export function money(cents: number): string {
  const neg = cents < 0;
  const c = Math.abs(Math.round(cents));
  const s = c < 100 && c > 0 ? `${c}¢` : `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
  return neg ? `−${s}` : s;
}

/** Weight from grams in period units: "12 oz", "1.5 lb", "61 lb". */
export function weight(g: number): string {
  if (g <= 0) return '0 oz';
  if (g < G_PER_LB) {
    const oz = g / G_PER_OZ;
    return oz < 1 ? `${oz.toFixed(1)} oz` : `${Math.round(oz)} oz`;
  }
  const lb = g / G_PER_LB;
  return lb < 10 ? `${(Math.round(lb * 10) / 10).toString()} lb` : `${Math.round(lb)} lb`;
}

/** Bulk tenths -> "Bulk 3.8". */
export function bulk(tenths: number): string {
  return `${(tenths / 10).toFixed(tenths % 10 === 0 ? 0 : 1)}`;
}

/** Days in tenths -> "6 d 10 h" (11 §2.8 "Food lasts 6 d 10 h"). */
export function daysTenths(tenths: number): string {
  if (tenths <= 0) return '0 d';
  const hoursTotal = Math.round(tenths * 2.4);
  const d = Math.floor(hoursTotal / 24);
  const h = hoursTotal % 24;
  if (d === 0) return `${h} h`;
  return h === 0 ? `${d} d` : `${d} d ${h} h`;
}

/** Thousands separators without locale APIs (deterministic across devices). */
export function num(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? `−${out}` : out;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0';
}

/** "4:10 p.m." (period long form) or "4:10p" (compact strip form). */
export function clock(hour: number, minute: number, compact = false): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  if (compact) return `${h12}:${mm}${hour < 12 ? 'a' : 'p'}`;
  if (hour === 12 && minute === 0) return 'noon';
  if (hour === 0 && minute === 0) return 'midnight';
  return `${h12}:${mm} ${hour < 12 ? 'a.m.' : 'p.m.'}`;
}

/** Game-minutes as a relative age: "3 h ago", "2 d ago". */
export function ago(minutes: number): string {
  if (minutes < 60) return 'just now';
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / 1440)} d ago`;
}

export const MOON_GLYPH: Record<string, string> = {
  new: '●',
  waxing_crescent: '☽',
  first_quarter: '◐',
  waxing_gibbous: '◐',
  full: '○',
  waning_gibbous: '◑',
  last_quarter: '◑',
  waning_crescent: '☾',
};

export function title(s: string): string {
  return s.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Credence (0..100) as the PC's own words (04 §12.1). Display only. */
export function credenceWord(c: number): string {
  if (c >= 90) return 'you’re sure';
  if (c >= 70) return 'you believe';
  if (c >= 45) return 'you’ve heard';
  if (c >= 20) return 'a rumor says';
  return 'you doubt it';
}

/** 03 §3.7.3 copy bands for Fresh (dead / keeping / fresh food). */
export function freshBand(fresh: number): string {
  if (fresh >= 40) return 'fresh food';
  if (fresh >= 10) return 'keeping food';
  return 'dead food';
}

/** Spoilage per-mille -> stage word (03 §3.7.4: turning at 750, spoiled at 1000). */
export function spoilStage(pm: number): 'fresh' | 'turning' | 'spoiled' {
  if (pm >= 1000) return 'spoiled';
  if (pm >= 750) return 'turning';
  return 'fresh';
}

/** Opinion axis value (−100..100) -> band word (04 §12.1). */
export function opinionBand(v: number): string {
  if (v >= 60) return 'Devoted';
  if (v >= 20) return 'Warm';
  if (v > -20) return 'Neutral';
  if (v > -60) return 'Wary';
  return 'Cold';
}

/** Severity class for a 0..1000 need: used for the rubric (red ink) + glyph treatment. */
export function needSeverity(value: number): 'ok' | 'low' | 'bad' {
  if (value < 250) return 'bad';
  if (value < 500) return 'low';
  return 'ok';
}

// ---------------------------------------------------------------------------------------
// Psyche labels (10 §12, 11 §2.3). Period labels by default; clinical as a setting.
// ---------------------------------------------------------------------------------------

export type LabelSet = 'period' | 'clinical';

const PERIOD = {
  id: 'Appetite',
  superego: 'Conscience',
  ego: 'Self-Command',
  anxiety: 'Nerves',
  defense: 'Self-deception',
  command: 'Your will',
  persona: 'Countenance',
  shadow: 'the Hidden Self',
} as const;
const CLINICAL = {
  id: 'Id',
  superego: 'Superego',
  ego: 'Ego',
  anxiety: 'Anxiety',
  defense: 'Defense',
  command: 'Command',
  persona: 'Persona',
  shadow: 'Shadow',
} as const;
export type PsycheTerm = keyof typeof PERIOD;

export function psycheLabel(term: PsycheTerm, set: LabelSet): string {
  return set === 'period' ? PERIOD[term] : CLINICAL[term];
}
/** The other set's word, for tooltips ("Tooltips always show both", 10 §12). */
export function psycheAlt(term: PsycheTerm, set: LabelSet): string {
  return set === 'period' ? CLINICAL[term] : PERIOD[term];
}

const DEFENSE_PERIOD: Record<string, string> = {
  repression: 'Putting it out of mind',
  denial: 'Won’t hear of it',
  projection: 'Laying it at another’s door',
  displacement: 'Kicking the dog',
  rationalization: 'Special pleading',
  reaction_formation: 'Protesting too much',
  undoing: 'Penance',
  isolation: 'Steeling oneself',
  regression: 'Going to pieces',
  identification: 'Running with the hounds',
  identification_with_aggressor: 'Running with the hounds',
  sublimation: 'Putting it to work',
  humor: 'Making light',
  somatization: 'A nervous complaint',
};
export function defenseLabel(id: string, set: LabelSet): string {
  return set === 'period' ? (DEFENSE_PERIOD[id] ?? title(id)) : title(id);
}

/** Voice styling key and glyph (11 §2.3: alignment + glyph + tint, never color alone). */
export function voiceOf(voice: string): { cls: 'id' | 'superego' | 'command' | 'ego'; glyph: string } {
  if (voice === 'id') return { cls: 'id', glyph: '◖' };
  if (voice === 'superego') return { cls: 'superego', glyph: '◗' };
  if (voice === 'command') return { cls: 'command', glyph: '☞' };
  return { cls: 'ego', glyph: '⚖' };
}

/** "activity:work@3" style urge labels from core -> readable words. */
export function urgeWords(urge: string, nameOf: (id: number) => string = (id) => `#${id}`): string {
  const [kind, rest = ''] = urge.split(':');
  const [what = '', target] = rest.split('->');
  const tgt = target !== undefined && target !== '' ? ` → ${nameOf(Number(target))}` : '';
  if (kind === 'activity') return `${title(what)}${tgt}`;
  if (kind === 'interaction') return `${title(what)}${tgt}`;
  if (kind === 'defense') return `${title(what)}${tgt}`;
  return urge;
}

/** Chronicle voices (05 §11.2, 11 §2.5): glyph per voice. */
export function chronicleGlyph(voice: string): string {
  switch (voice) {
    case 'journal':
      return '✒';
    case 'paper':
    case 'newspaper':
      return '▤';
    case 'almanac':
      return '☷';
    case 'ballad':
      return '♪';
    case 'ledger':
      return '§';
    default:
      return '·';
  }
}

/** Catalog section ids (content enum) -> Book thumb-index labels (03 §2.2). */
export const SECTION_LABEL: Record<string, string> = {
  packs_bedding: 'Packs & Bedding',
  shelter: 'Shelter',
  fire_light: 'Fire & Light',
  cookery: 'Cookery',
  provisions: 'Provisions',
  tools: 'Tools',
  clothing: 'Clothing',
  arms: 'Arms',
  ammunition: 'Powder & Shot',
  armor: 'Armor',
  medicine: 'Medicine',
  fishing_trapping: 'Fishing & Trapping',
  rope_climbing: 'Rope',
  folk_magic: 'Folk-Magic',
  books: 'Books',
  animals_tack_boats: 'Animals & Tack',
  trade_goods: 'Trade Goods',
  wild_food: 'Wild Food',
  fae: 'Fae',
  misc: 'Sundries',
};
export const SECTION_ORDER = Object.keys(SECTION_LABEL);

/** Short thumb-tab letter(s) for the vertical index. */
export function sectionTab(id: string): string {
  const l = SECTION_LABEL[id] ?? title(id);
  return l.slice(0, 2);
}

/** Supply kinds -> how a unit of supply reads ("60 fire-minutes"). */
export function supplyWords(kind: string, units: number): string {
  switch (kind) {
    case 'fire':
      return `${units} min of fire`;
    case 'match':
      return `${units} strikes`;
    case 'lamp_oil':
      return `${Math.round(units / 60)} h of lamplight`;
    case 'candle':
      return `${Math.round(units / 60)} h of candlelight`;
    case 'percussion_cap':
      return `${units} caps`;
    case 'fodder':
      return `${units} animal-days of fodder`;
    default:
      return `${units} ${kind.replaceAll('_', ' ')}`;
  }
}
