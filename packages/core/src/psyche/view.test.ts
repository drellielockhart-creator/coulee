import { describe, expect, it } from 'vitest';
import type { ContentBundle } from '../content.ts';
import { type ActorId, asEventId, asThoughtId } from '../ids.ts';
import type { GameMinute } from '../time.ts';
import type { ViewOptions } from '../viewmodel-types.ts';
import type { World } from '../world.ts';
import { blankPsyche, type Thought } from './state.ts';
import { viewPsycheActor } from './view.ts';

const A = 1 as ActorId;
const B = 2 as ActorId;
const content = {
  defenses: { projection: { tier: 'immature' }, repression: { tier: 'neurotic' } },
  drives: { envy: { period_label: 'the Evil Eye' } },
  norms: {},
} as unknown as ContentBundle;

const th = (id: number, extra: Partial<Thought>): Thought => ({
  id: asThoughtId(id),
  voice: 'id',
  urge: { kind: 'activity', activityId: 'work' },
  intensity: 400,
  label: 'the Evil Eye: take Lydia down a peg',
  source: 'psyche',
  bornAt: 0 as GameMinute,
  decayPerHour: 100,
  reasons: [{ source: 'base', label: 'base', value: 400 }],
  line: 'What has Lydia got that I haven’t?',
  drive: 'envy',
  ...extra,
});

function world(insight: number): World {
  const pa = {
    ...blankPsyche(),
    insight,
    persona: 'the pious widow',
    personaTraits: ['pious'],
    shadow: ['envious'],
    shadowCharge: { envious: 60 },
    thoughts: [
      th(1, {}),
      th(2, { maskedBy: 'projection', stance: 'aside', urge: { kind: 'defense', defense: 'projection', targetId: B } }),
      th(3, { maskedBy: 'repression', stance: 'aside', urge: { kind: 'defense', defense: 'repression' } }),
    ],
    recentDefenses: [
      { defense: 'projection' as const, at: 0 as GameMinute, targetId: B, eventId: asEventId(5) },
      { defense: 'repression' as const, at: 0 as GameMinute, targetId: null, eventId: asEventId(6) },
    ],
  };
  return {
    time: 600,
    actors: { [A]: { traits: ['envious'], alive: true }, [B]: { traits: [], alive: true } },
    psyche: { counters: { thought: 3 }, byActor: { [A]: pa, [B]: { ...blankPsyche(), thoughts: [th(9, {})] } } },
  } as unknown as World;
}

const opts = (perspective: ActorId | null, omniscient = false): ViewOptions => ({
  perspective,
  omniscient,
  includeExplain: false,
  recentChronicle: 0,
});

describe('psyche view privacy (P1)', () => {
  it("thoughts never leak into another actor's view", () => {
    const v = viewPsycheActor(world(3), content, A, opts(B));
    expect(v.visible).toBe(false);
    expect(v.thoughts).toEqual([]);
    expect(v.recentDefenses).toEqual([]);
    expect(v.shadow).toEqual([]);
    expect(v.anxiety).toBe(0);
    expect(v.chosen).toBeNull();
    expect(JSON.stringify(v)).not.toContain('Lydia');
    // The Persona is public: the mask is what others see.
    expect(v.persona).toBe('the pious widow');
    expect(v.presentedTraits).toEqual(['pious']);
  });

  it('the self sees its thoughts but not its defenses or Shadow until Insight', () => {
    const v = viewPsycheActor(world(0), content, A, opts(A));
    expect(v.visible).toBe(true);
    expect(v.thoughts.map((t) => t.id)).toEqual([1, 2, 3]);
    // Masked thoughts look like ordinary ones: no defense label, no defense urge.
    expect(v.thoughts.every((t) => t.maskedBy === undefined)).toBe(true);
    expect(v.thoughts.filter((t) => t.urge.startsWith('defense'))).toEqual([]);
    expect(v.recentDefenses).toEqual([]);
    expect(v.shadow).toEqual([]);
  });

  it('Insight reveals defenses by maturity tier, and the Shadow from tier 1', () => {
    const v1 = viewPsycheActor(world(1), content, A, opts(A));
    expect(v1.recentDefenses.map((d) => d.defense)).toEqual(['projection']);
    expect(v1.thoughts.find((t) => t.id === 2)?.maskedBy).toBe('projection');
    expect(v1.thoughts.find((t) => t.id === 3)?.maskedBy).toBeUndefined();
    expect(v1.shadow).toEqual(['envious']);
    const v2 = viewPsycheActor(world(2), content, A, opts(A));
    expect(v2.recentDefenses.map((d) => d.defense)).toEqual(['projection', 'repression']);
  });

  it('god view and the epilogue see everything', () => {
    for (const o of [opts(null), opts(B, true)]) {
      const v = viewPsycheActor(world(0), content, A, o);
      expect(v.visible).toBe(true);
      expect(v.recentDefenses.length).toBe(2);
      expect(v.shadow).toEqual(['envious']);
    }
  });
});
