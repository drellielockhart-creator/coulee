/**
 * Counter-based, hash-mixed randomness (ADR 0001 invariant 1; 07 §3.6).
 *
 * `rng(seed, stream, tick, key)` is a pure function of its inputs. Two systems can never
 * perturb each other's draws, and a draw keyed on (actor, rumor) gives the same answer
 * whenever it is evaluated. Only `Math.imul`, shifts and xors are used, so results are
 * bit-identical on V8, JavaScriptCore and SpiderMonkey.
 *
 * Rules:
 * - Never use Math.random. Never share one Rng object across unrelated decisions.
 * - Pick the stream for the *system* making the decision, and build `key` from the
 *   entities involved with `mixKey(...)`, e.g. `ctx.rng('social', mixKey(a, b, SALT_GOSSIP))`.
 * - Keys and seeds are 32-bit. Larger numbers are folded with mixKey.
 */

/** The closed set of random streams. Add one only via the foundation owner (see MODULES.md). */
export const STREAMS = [
  'worldgen',
  'census',
  'needs',
  'activity',
  'psyche',
  'social',
  'gossip',
  'memory',
  'belief',
  'rumor',
  'suspicion',
  'items',
  'provisions',
  'spoilage',
  'cooking',
  'market',
  'weather',
  'chronicle',
  'director',
  'combat',
  'loot',
  'checks',
  'test',
] as const;
export type Stream = (typeof STREAMS)[number];

/** 32-bit avalanche mixer (C. Wellons' "lowbias32"). Returns an unsigned 32-bit integer. */
export function mix32(x: number): number {
  let h = x | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Fold any number of integers into one 32-bit key. Order matters. */
export function mixKey(...parts: readonly number[]): number {
  let h = 0x2545f491;
  for (const p of parts) {
    // Fold values beyond 32 bits so large minute counts still contribute.
    const lo = p | 0;
    const hi = Math.floor(p / 4294967296) | 0;
    h = mix32(h ^ mix32(lo + 0x9e3779b9));
    if (hi !== 0) h = mix32(h ^ mix32(hi + 0x7f4a7c15));
  }
  return h >>> 0;
}

/** FNV-1a over UTF-16 code units; used for stream names and string keys. */
export function hashString32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mix32(h);
}

const STREAM_HASH: Record<Stream, number> = Object.fromEntries(
  STREAMS.map((s) => [s, hashString32(`coulee.stream.${s}`)]),
) as Record<Stream, number>;

/** The n-th 32-bit draw of a keyed generator. Pure. */
export function draw32(seed: number, stream: Stream, tick: number, key: number, n: number): number {
  return mixKey(seed, STREAM_HASH[stream], tick, key, n);
}

export interface Rng {
  readonly seed: number;
  readonly stream: Stream;
  readonly tick: number;
  readonly key: number;
  /** Number of draws taken so far. */
  readonly drawn: number;
  /** Unsigned 32-bit integer. */
  u32(): number;
  /** Uniform integer in [lo, hi] inclusive. Unbiased (rejection sampling). */
  int(lo: number, hi: number): number;
  /** 1..20 */
  d20(): number;
  /** Roll `count` dice of `sides`, summed. */
  dice(count: number, sides: number): number;
  /** True with probability permille/1000. */
  chancePermille(permille: number): boolean;
  /** True with probability percent/100. */
  chancePercent(percent: number): boolean;
  /** Uniform element; undefined if empty. */
  pick<T>(items: readonly T[]): T | undefined;
  /** Weighted pick with non-negative integer weights; undefined if all weights are 0. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
  /**
   * Deterministic shuffle whose result depends only on the set of item keys (not on input
   * order and not on the draw counter): each item is ranked by hash(rng identity, itemKey).
   * `keyOf` must return distinct integers per item.
   */
  shuffleByKey<T>(items: readonly T[], keyOf: (item: T) => number): T[];
  /** A child generator for a sub-decision, independent of this one's counter. */
  fork(subkey: number): Rng;
}

class CounterRng implements Rng {
  readonly seed: number;
  readonly stream: Stream;
  readonly tick: number;
  readonly key: number;
  drawn = 0;
  constructor(seed: number, stream: Stream, tick: number, key: number) {
    this.seed = seed;
    this.stream = stream;
    this.tick = tick;
    this.key = key;
  }

  u32(): number {
    const v = draw32(this.seed, this.stream, this.tick, this.key, this.drawn);
    this.drawn += 1;
    return v;
  }

  int(lo: number, hi: number): number {
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
      throw new Error(`rng.int bad range [${lo}, ${hi}]`);
    }
    const n = hi - lo + 1;
    if (n > 4294967296) throw new Error('rng.int range too large');
    const limit = 4294967296 - (4294967296 % n);
    for (;;) {
      const v = this.u32();
      if (v < limit) return lo + (v % n);
    }
  }

  d20(): number {
    return this.int(1, 20);
  }

  dice(count: number, sides: number): number {
    let t = 0;
    for (let i = 0; i < count; i++) t += this.int(1, sides);
    return t;
  }

  chancePermille(permille: number): boolean {
    if (permille <= 0) return false;
    if (permille >= 1000) return true;
    return this.int(0, 999) < permille;
  }

  chancePercent(percent: number): boolean {
    return this.chancePermille(percent * 10);
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    const ws: number[] = [];
    for (const it of items) {
      const w = weight(it);
      if (!Number.isInteger(w) || w < 0) throw new Error(`rng.weighted: weight must be int >= 0`);
      ws.push(w);
      total += w;
    }
    if (total <= 0) return undefined;
    let r = this.int(0, total - 1);
    for (let i = 0; i < items.length; i++) {
      r -= ws[i] as number;
      if (r < 0) return items[i];
    }
    return undefined;
  }

  shuffleByKey<T>(items: readonly T[], keyOf: (item: T) => number): T[] {
    const base = mixKey(this.seed, STREAM_HASH[this.stream], this.tick, this.key, 0x5f3759df);
    const ranked = items.map((item) => {
      const k = keyOf(item);
      return { item, k, h: mixKey(base, k) };
    });
    ranked.sort((a, b) => a.h - b.h || a.k - b.k);
    return ranked.map((r) => r.item);
  }

  fork(subkey: number): Rng {
    return new CounterRng(this.seed, this.stream, this.tick, mixKey(this.key, subkey, this.drawn));
  }
}

/** Create a keyed generator. `tick` is usually the current GameMinute. */
export function rng(seed: number, stream: Stream, tick: number, key: number): Rng {
  return new CounterRng(seed >>> 0, stream, tick, key >>> 0);
}
