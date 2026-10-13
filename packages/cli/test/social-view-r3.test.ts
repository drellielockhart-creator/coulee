import { readFileSync } from 'node:fs';
import { asActorId, asEventId, asGameMinute, belief, type Command, makeContext, social } from '@coulee/core';
import {
  describeEvent,
  PlaySession,
  parseText,
  playViewModel,
  regardOf,
  renderDetail,
  sessionSimOf,
} from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing fixture');
  return value;
}

const opts = (perspective: number, omniscient = false) => ({
  perspective: asActorId(perspective),
  omniscient,
  includeExplain: true,
  recentChronicle: 0,
});
function setup(source = 'gen:town', seed = 7) {
  const session = PlaySession.create(baseContent(), { source, seed });
  const sim = sessionSimOf(session),
    w = sim.world,
    pc = session.playerId;
  const other = Object.values(w.actors).find((a) => a.name.given === 'Josiah') ?? Object.values(w.actors)[0];
  if (!other || !w.actors[pc]) throw new Error('fixture');
  w.time = asGameMinute(9 * 60);
  other.placeId = w.actors[pc].placeId;
  for (const id of [pc, other.id]) {
    const activity = w.activity.byActor[id];
    if (activity) {
      activity.activityId = 'idle_at_home';
      activity.lockedUntil = null;
      activity.travel = null;
    }
  }
  social.bumpFamiliarity(w, sim.content, pc, other.id);
  return { session, sim, w, pc, other, ctx: () => makeContext(w, sim.content, []) };
}
function text(s: PlaySession, line: string, god = false) {
  const c = parseText(line, s.observe(god ? 'god' : 'fair'));
  expect(typeof c, line).toBe('object');
  return s.act(c as Command, god ? 'god' : 'fair');
}

describe('r3 group B social view regressions', () => {
  it('inspect hides both ledgers nearby and absent, hedges failed reads, and keeps god exact', () => {
    const f = setup();
    required(f.w.actors[f.pc]).sheet.skills.perception = -100;
    const incoming = required(f.w.social.opinions[f.other.id]?.[f.pc]);
    incoming.base = { affection: 23, respect: 37, trust: 17, fear: 4 };
    for (const absent of [false, true]) {
      if (absent) f.other.placeId = required(Object.values(f.w.places).find((p) => p.id !== f.other.placeId)).id;
      const result = text(f.session, 'inspect Josiah Whitlock');
      const prose = renderDetail(result.detail);
      expect(prose).not.toMatch(/affection:|respect:|trust:|fear:|True cause|= base|familiarity/);
      expect(result.detail).not.toHaveProperty('base');
      if (!absent) expect(prose).toContain('hard to read; seems');
      else expect(prose).toContain('cannot read their manner from here');
      expect(renderDetail(text(f.session, 'inspect Josiah Whitlock', true).detail)).toContain(
        'True regard: affection 23',
      );
    }
    const self = required(playViewModel(f.w, f.sim.content, opts(f.pc)).actors.find((a) => a.id === f.pc));
    expect(self.social.opinions.every((o) => o.numbersKnown === false && o.reasons.length === 0)).toBe(true);
  });

  it('socialite borrow refusal, help and lost fight belong to the recipient’s ledger', () => {
    const f = setup();
    const resolve = (id: string, from: number, to: number, failure = false) => {
      const def = structuredClone(required(f.sim.content.interactions[id]));
      def.check = failure ? { kind: 'dc', skill: 'persuade', dc: 1000, attitude: false } : { kind: 'none' };
      const command: Command = {
        kind: 'core.urge',
        actorId: asActorId(from),
        data: { urge: { kind: 'interaction', interactionId: id, targetId: asActorId(to) } },
      };
      return social.resolveInteraction(f.w, makeContext(f.w, f.sim.content, [command]), {
        def,
        initiatorId: asActorId(from),
        targetId: asActorId(to),
        placeId: f.other.placeId,
        present: [],
        mode: 'forced',
        via: 'encounter',
      });
    };
    // The report's talk:borrow:2 -> inspect Josiah Whitlock, with its failed check fixed for this fixture.
    resolve('borrow', f.pc, f.other.id, true);
    const refusal = required(social.memoriesOf(f.w, f.pc).find((m) => m.kind === 'rejection'));
    expect(refusal.did).toBe(false);
    expect(refusal.aboutId).toBe(f.other.id);
    expect(refusal.roles.find((r) => r.role === 'agent')?.who).toBe(f.other.id);
    expect(social.memoriesOf(f.w, f.other.id).find((m) => m.kind === 'rejection')?.did).toBe(true);
    expect(social.reasonsOf(f.w, f.pc, f.other.id).some((r) => r.label === 'Turned me away when I asked')).toBe(true);
    expect(social.reasonsOf(f.w, f.other.id, f.pc).some((r) => r.label === 'Turned me away when I asked')).toBe(false);
    resolve('help', f.other.id, f.pc);
    // Accept the offer of help before asserting the memories.
    const pending = social.pendingRequests(f.w, f.pc)[0];
    if (pending) {
      pending.status = 'accepted';
      const command: Command = {
        kind: 'social.answer_request',
        actorId: f.pc,
        data: { requestId: pending.id, accept: true },
      };
      social.resolveInteraction(f.w, makeContext(f.w, f.sim.content, [command]), {
        def: required(f.sim.content.interactions.help),
        initiatorId: f.other.id,
        targetId: f.pc,
        placeId: f.other.placeId,
        present: [],
        mode: 'forced',
        via: 'encounter',
        acceptedRequestId: pending.id,
      });
    }
    expect(social.reasonsOf(f.w, f.pc, f.other.id).some((r) => r.label === 'Lent me a hand unasked')).toBe(true);
    resolve('slight', f.other.id, f.pc);
    expect(social.reasonsOf(f.w, f.pc, f.other.id).some((r) => r.label.startsWith('Was short with me'))).toBe(true);
    expect(social.reasonsOf(f.w, f.other.id, f.pc).some((r) => r.label.startsWith('Was short with me'))).toBe(false);
    resolve('fight', f.pc, f.other.id, true);
    const defeat = required(social.memoriesOf(f.w, f.pc).find((m) => m.kind === 'fight'));
    expect(defeat.did).toBe(false);
    expect(defeat.roles.find((r) => r.role === 'agent')?.who).toBe(f.other.id);
    expect(social.reasonsOf(f.w, f.pc, f.other.id).some((r) => r.label === 'Put me down in front of everyone')).toBe(
      true,
    );
    expect(social.reasonsOf(f.w, f.other.id, f.pc).some((r) => r.delta.fear > 0)).toBe(false);
    expect(renderDetail(text(f.session, 'inspect Josiah Whitlock').detail)).not.toMatch(
      /Turned me away|Lent me a hand unasked|Put me down/,
    );
  });

  it('replays the socialite’s opening commands through inspect and food gift to Richard Pascoe', () => {
    const lines = readFileSync('playtests/2026-10-13-r3-socialite-gentown7/session/commands.jsonl', 'utf8')
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s));
    const s = PlaySession.create(baseContent(), { source: 'gen:town', seed: 7 });
    for (const row of lines.slice(1, 21)) expect(s.act(row.command).ok).toBe(true);
    const result = text(s, 'talk:gift:24');
    expect(result.ok, result.reason).toBe(true);
    expect(result.warning).toBeUndefined();
    const sim = sessionSimOf(s);
    const gift = sim.world.log.events.findLast(
      (e) => e.kind === 'social.interaction' && e.data.interactionId === 'gift' && e.data.initiatorId === s.playerId,
    );
    expect(gift?.kind).toBe('social.interaction');
    if (gift?.kind === 'social.interaction') {
      expect(sim.content.items[gift.data.itemDefId ?? '']?.food).toBeDefined();
      expect(gift.data.line).not.toMatch(/eggs|ribbon|tobacco|lettuce|dry wood/i);
    }
    expect(PlaySession.replay(baseContent(), s.commandLog).save()).toBe(s.save());
  });

  it('presents a tell as suspicion and hearsay with its source, including after log eviction', () => {
    const f = setup();
    const pred = required(
      Object.values(f.sim.content.predicates).find((p) => p.kind_of && f.sim.content.peoples[p.kind_of]?.concealed),
    );
    const prop = belief.internProp(f.w, pred.id, [{ kind: 'actor', id: f.other.id }]);
    belief.observe(f.w, f.ctx(), f.pc, prop, { type: 'observation', dir: 1, sourceId: null, eventId: null });
    expect(renderDetail(text(f.session, 'inspect Josiah Whitlock').detail)).toContain('Suspected that Josiah Whitlock');
    belief.observe(f.w, f.ctx(), f.pc, prop, { type: 'statement', dir: 1, sourceId: asActorId(3), eventId: null });
    f.w.log.events = [];
    const prose = renderDetail(text(f.session, 'inspect Josiah Whitlock').detail);
    expect(prose).toContain('Heard from Jory Rowe that Josiah Whitlock');
    expect(prose).not.toContain('Remembered: Josiah Whitlock is of the hidden folk');
    expect(f.session.observe().self.belief.beliefs.find((b) => b.text.includes('Josiah'))?.account).toContain(
      'Heard from Jory',
    );
  });

  it('overheard opinions do not prevent a real introduction', () => {
    const f = setup('iron_ford_neighbors', 42);
    const amos = required(Object.values(f.w.actors).find((a) => a.name.given === 'Amos'));
    amos.placeId = required(f.w.actors[f.pc]).placeId;
    required(f.w.activity.byActor[amos.id]).activityId = 'idle_at_home';
    required(f.w.social.opinions[f.pc])[amos.id] = social.emptyOpinion(amos.id);
    social.addOpinionReason(f.w, f.ctx(), f.pc, amos.id, {
      label: 'Overheard a kindness',
      cites: { kind: 'other', strength: 1000 },
      delta: { affection: 1, respect: 0, trust: 0, fear: 0 },
      since: f.w.time,
    });
    expect(social.hasMet(f.w, f.pc, amos.id)).toBe(false);
    const result = text(f.session, 'introduce Amos Whitcomb');
    expect(result.ok, result.reason).toBe(true);
    expect(social.hasMet(f.w, f.pc, amos.id)).toBe(true);
  });

  it('does not narrate a suppression check as noticing oneself; yield addresses the yielder', () => {
    const f = setup();
    const base = {
      id: asEventId(999),
      t: f.w.time,
      roles: [{ actor: f.pc, role: 'subject' as const }],
      visibility: 'inner' as const,
    };
    const tell = describeEvent(f.w, f.sim.content, f.pc, {
      ...base,
      kind: 'belief.tell',
      data: { targetId: f.pc, tellId: 'bell_ache', noticed: false },
    });
    expect(tell.text).not.toMatch(/notice|Ellis Wayfarer/);
    const yieldText = describeEvent(f.w, f.sim.content, f.pc, {
      ...base,
      kind: 'tactical.submission',
      data: { actorId: f.pc, text: 'Accept the surrender' },
    });
    expect(yieldText.text).toMatch(/^You yield/);
    expect(yieldText.text).not.toContain('Accept');
  });

  it.each(['away', 'asleep'])('refuses NPC chat and help when the PC is %s', (condition) => {
    const f = setup();
    if (condition === 'away')
      f.other.placeId = required(Object.values(f.w.places).find((p) => p.id !== f.other.placeId)).id;
    else required(f.w.activity.byActor[f.pc]).activityId = 'sleep';
    for (const id of ['chat', 'help']) {
      const result = social.resolveInteraction(f.w, f.ctx(), {
        def: required(f.sim.content.interactions[id]),
        initiatorId: f.other.id,
        targetId: f.pc,
        placeId: f.other.placeId,
        present: [],
        mode: 'forced',
        via: 'encounter',
      });
      expect(result.success).toBe(false);
    }
    expect(social.pendingRequests(f.w, f.pc)).toEqual([]);
  });

  it('deduplicates known reasons and gives combat a reason label instead of raw event text', () => {
    const f = setup();
    social.recordCombatOutcome(f.w, f.ctx(), {
      key: 'repro',
      a: f.pc,
      b: f.other.id,
      eventId: asEventId(999),
      text: 'Ellis and Josiah: the brawl ends.',
      outcome: 'flight',
      witnesses: [f.pc, f.other.id],
    });
    expect(social.reasonsOf(f.w, f.other.id, f.pc).every((r) => !r.label.includes('brawl ends'))).toBe(true);
    const op = required(f.w.social.opinions[f.other.id]?.[f.pc]);
    op.reasons.push(...op.reasons);
    const reasons = required(regardOf(f.w, f.sim.content, f.pc, f.other.id)).reasons;
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons).toEqual([...new Set(reasons)]);
  });
});
