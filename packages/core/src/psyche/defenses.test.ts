import { describe, expect, it } from 'vitest';
import type { ContentBundle, DefenseId } from '../content.ts';
import type { ActorId } from '../ids.ts';
import { mixKey, rng } from '../rng.ts';
import type { GameMinute } from '../time.ts';
import { type DefenseSituation, defenseCandidates, displacementFit, pickDefense, projectionFit } from './defenses.ts';
import { blankPsyche, STYLE_DEFAULT } from './state.ts';

// The seven M1 defenses, as in content/base/psyche/defenses.toml (gates, pools, relief).
const D = (id: DefenseId, tier: string, min_ego: number, pools: string[], relief: number, needs_shadow = 0) => ({
  id,
  name: id,
  period_label: id,
  tier,
  min_ego,
  pools,
  relief,
  needs_shadow,
  acts: [],
  importance: 30,
  lines: ['x'],
});
const content = {
  defenses: {
    repression: D('repression', 'neurotic', 25, ['moral', 'neur'], 200),
    denial: D('denial', 'immature', 0, ['real'], 150),
    projection: D('projection', 'immature', 0, ['neur', 'moral'], 250, 30),
    displacement: D('displacement', 'immature', 0, ['neur', 'real'], 200),
    rationalization: D('rationalization', 'neurotic', 25, ['moral'], 150),
    reaction_formation: D('reaction_formation', 'neurotic', 25, ['neur', 'moral'], 300),
    sublimation: D('sublimation', 'mature', 55, ['neur', 'real'], 200),
  },
} as unknown as ContentBundle;

/** Style = 10 × Π(trait pct/100), as state.ts seeds it from traits.toml. */
const style = (pcts: Partial<Record<DefenseId, number>>) => {
  const out: Partial<Record<DefenseId, number>> = {};
  for (const d of Object.keys(content.defenses) as DefenseId[])
    out[d] = Math.round((STYLE_DEFAULT * (pcts[d] ?? 100)) / 100);
  return out;
};
// traits.toml: hot_tempered { displacement = 180 }; pious { reaction_formation = 150, repression = 130 }.
const HOT = style({ displacement: 180 });
const PIOUS = style({ reaction_formation: 150, repression: 130 });

/** A troubled hour: rage frustrated at someone out of reach, a forbidden wish, guilt and nerves. */
const situation: DefenseSituation = {
  now: 6000 as GameMinute,
  projection: null,
  displacement: { targetId: 7 as ActorId, blockedId: 9 as ActorId, df: 70 },
  wish: null,
  forbiddenStreak: 'rage',
  sublimation: null,
  displaceable: true,
  fearLive: false,
};

function shares(defenseStyle: Partial<Record<DefenseId, number>>, superego: number, ego: number, n = 2000) {
  const p = {
    ...blankPsyche(),
    ego,
    superego,
    defenseStyle,
    anxSrc: { real: 80, neur: 220, moral: 200 },
    anxiety: 500,
  };
  const counts: Record<string, number> = {};
  const cands = defenseCandidates(content, p, situation);
  for (let seed = 1; seed <= n; seed++) {
    const pick = pickDefense(cands, rng(seed, 'psyche', 6000, mixKey(3, 0x50a4)));
    if (pick) counts[pick.id] = (counts[pick.id] ?? 0) + 1;
  }
  const f = (ids: string[]) => ids.reduce((s, id) => s + (counts[id] ?? 0), 0) / n;
  return { displacement: f(['displacement']), conscience: f(['repression', 'reaction_formation']), counts };
}

describe('defense selection (10 §7.1)', () => {
  it('temperament skews the pick: the hot-tempered displace, the pious repress and protest', () => {
    // Same troubled hour, same ego; only trait-seeded style (and the pious conscience) differ.
    const hot = shares(HOT, 50, 45);
    const pious = shares(PIOUS, 75, 45);
    expect(hot.displacement).toBeGreaterThan(0.25);
    expect(pious.conscience).toBeGreaterThan(0.45);
    // Ratio bands: displacement at least 1.5× as likely for the hot-tempered; repression +
    // reaction formation at least 1.5× as likely for the pious.
    expect(hot.displacement / Math.max(0.001, pious.displacement)).toBeGreaterThan(1.5);
    expect(pious.conscience / Math.max(0.001, hot.conscience)).toBeGreaterThan(1.5);
  });

  it('gates: maturity by ego, reaction formation by strictness, triggers by situation', () => {
    const base = { ...blankPsyche(), anxSrc: { real: 300, neur: 300, moral: 300 }, anxiety: 900 };
    const ids = (p: typeof base, sit: DefenseSituation = situation) =>
      defenseCandidates(content, p, sit).map((c) => c.id);
    // Weak ego: no neurotic or mature defenses.
    expect(ids({ ...base, ego: 20, superego: 80 })).toEqual(['denial', 'displacement']);
    // Strict enough for reaction formation; no sublimation template → no sublimation.
    expect(ids({ ...base, ego: 60, superego: 80 })).toContain('reaction_formation');
    expect(ids({ ...base, ego: 60, superego: 50 })).not.toContain('reaction_formation');
    // Projection needs a shadow target; rationalization a recent transgression.
    const sit2: DefenseSituation = {
      ...situation,
      projection: { targetId: 4 as ActorId, trait: 'envious', drive: 'envy', pf: 60, hidden: false },
      sublimation: { drive: 'rage', templateId: 'rage_into_work' },
    };
    const p2 = {
      ...base,
      ego: 60,
      superego: 50,
      lastTransgression: { at: 5900 as GameMinute, norm: 'propriety', targetId: null },
    };
    expect(ids(p2, sit2)).toEqual([
      'denial',
      'displacement',
      'projection',
      'rationalization',
      'repression',
      'sublimation',
    ]);
    // Pool fit 0 when the pools are empty.
    expect(ids({ ...base, ego: 60, anxSrc: { real: 0, neur: 0, moral: 0 }, anxiety: 0 })).toEqual([]);
  });

  it('target fits are the 10 §7.2 weighted sums', () => {
    expect(projectionFit({ H: 40, Odd: 80, Out: 60, Dis: 100, Weak: 87 })).toBe(
      Math.floor((1200 + 1600 + 1200 + 1500 + 1305) / 100),
    );
    expect(displacementFit({ Sim: 30, Weak: 90, Avail: 100, Dis: 100 })).toBe(76);
  });
});
