import { activity, belief, findNonIntegers, instantOf, makeContext, needs } from '@coulee/core';
import { PlaySession, parseText, sessionSimOf } from '@coulee/play';
import { describe, expect, it } from 'vitest';
import { baseContent } from './helpers.ts';

const content = baseContent();
function say(session: PlaySession, text: string) {
  const command = parseText(text, session.observe());
  if (typeof command === 'string') return { ok: false, reason: command };
  return session.act(command);
}

describe('r3 tactical command transcripts', () => {
  it('C1 edgeqa seed 7: go 27 cannot consume the opening, and resume is available immediately', () => {
    const s = PlaySession.create(content, { source: 'tavern_brawl', seed: 7 });
    expect(s.observe().tactical).toBeTruthy();
    const before = s.hash;
    expect(say(s, 'go 27').ok).toBe(false);
    expect(s.hash).toBe(before);
    expect(instantOf(sessionSimOf(s).world)).toBe(0);
    expect(say(s, 'tactical:resume').ok).toBe(true);
  });
  it('C2 socialite seed 8: wait, attack Joel, resume through the ending, inspect and walk', () => {
    const s = PlaySession.create(content, { source: 'tavern_brawl', seed: 8 });
    say(s, 'wait 1h');
    for (let n = 0; n < 4; n++) {
      say(s, 'tactical:attack:2');
      say(s, 'tactical:resume');
    }
    say(s, 'tactical:resume');
    expect(say(s, 'inspect Michael Dunleavy').ok).toBe(true);
    for (let n = 0; n < 40 && s.observe().tactical; n++) say(s, 'tactical:resume');
    expect(s.observe().tactical).toBeNull();
    if (s.observe().self.needs.survival?.conditions.includes('combat_unconscious')) say(s, 'wait 1h');
    expect(say(s, 'go 27').ok).toBe(true);
    expect(s.observe().place.id).toBe(27);
    expect(PlaySession.replay(content, s.commandLog).hash).toBe(s.hash);
  });
  it.each(['flee', 'yield'])('C2 edgeqa seed 7: attack, resume, %s, resume, ordinary wait and walk', (exit) => {
    const s = PlaySession.create(content, { source: 'tavern_brawl', seed: 7 });
    say(s, 'wait 1h');
    expect(say(s, 'fight Joel Pike').ok).toBe(true);
    for (let n = 0; n < 10 && !s.observe().actions.some((a) => a.id === `tactical:${exit}`); n++) say(s, 'resume');
    expect(say(s, `tactical:${exit}`).ok).toBe(true);
    for (let n = 0; n < 100 && s.observe().tactical; n++) say(s, 'resume');
    expect(s.observe().tactical).toBeNull();
    const w = sessionSimOf(s).world;
    expect(instantOf(w)).toBeLessThan(6000);
    const wait = say(s, 'wait 1h');
    expect(wait.ok).toBe(true);
    expect('elapsedTicks' in wait ? wait.elapsedTicks : undefined).toBeUndefined();
    if (!needs.canAct(w, s.playerId)) say(s, 'wait 1h');
    const destination = s.observe().place.id === 4 ? 27 : 4;
    expect(say(s, `go ${destination}`).ok).toBe(true);
    expect(s.observe().place.id).toBe(destination);
    expect(PlaySession.load(content, s.save()).hash).toBe(s.hash);
    expect(PlaySession.replay(content, s.commandLog).hash).toBe(s.hash);
  });
  it('C3 socialite gen:town 7: the recorded talk:fight:3 opens a witnessed tactical brawl', () => {
    const s = PlaySession.create(content, { source: 'gen:town', seed: 7 });
    // The report's local sequence at Rowe's, without four unrelated days of conversations.
    expect(say(s, 'inspect Jory Rowe').ok).toBe(true);
    expect(say(s, 'inspect Loveday Rowe').ok).toBe(true);
    const w = sessionSimOf(s).world;
    const before = instantOf(w),
      spent = activity.minuteBudget(w, s.playerId).spent;
    expect(say(s, 'talk:fight:3').ok).toBe(true);
    expect(s.observe().tactical).toBeTruthy();
    expect(instantOf(w)).toBe(before + spent * 600);
    expect(w.tactical?.participants[s.playerId]?.action?.kind).toBe('attack');
    const loaded = PlaySession.load(content, s.save());
    for (let n = 0; n < 100 && s.observe().tactical; n++) {
      const action =
        s.observe().actions.find((a) => a.id === 'tactical:accept:3') ??
        s.observe().actions.find((a) => a.id === 'tactical:attack:3');
      const c = action?.command ?? parseText('resume', s.observe());
      expect(s.act(c).ok).toBe(true);
      expect(loaded.act(c).ok).toBe(true);
    }
    expect(s.observe().tactical).toBeNull();
    expect(loaded.hash).toBe(s.hash);
    const incident = Object.values(w.social.combatIncidents ?? {}).find(
      (x) => x.a === s.playerId || x.b === s.playerId,
    );
    expect(incident?.witnesses.length).toBeGreaterThan(2);
    const news = Object.values(w.belief.props).find(
      (p) => p.pred === 'quarreled' && p.args.some((a) => a.kind === 'actor' && a.id === s.playerId),
    );
    expect(news).toBeDefined();
    const witness = incident?.witnesses.find((id) => id !== s.playerId && id !== 3);
    if (witness === undefined) throw Error('No bystander');
    expect(w.belief.beliefsByHolder[witness]?.some((id) => w.belief.beliefs[id]?.propId === news?.id)).toBe(true);
    expect(findNonIntegers(w)).toEqual([]);
    expect(PlaySession.replay(content, s.commandLog).hash).toBe(s.hash);
    const listener = Object.values(w.actors).find((a) => !incident?.witnesses.includes(a.id));
    if (!news || !listener) throw Error('Missing gossip topic or listener');
    const told = belief.transmit(w, makeContext(w, sessionSimOf(s).content, []), {
      speakerId: witness,
      listenerId: listener.id,
      placeId: w.actors[witness]?.placeId ?? null,
      channel: 'street',
      interactionEventId: null,
      topic: news.id,
      deliberate: true,
    });
    expect(told.told).toBe(true);
    expect(belief.beliefOf(w, listener.id, news.id)).toBeDefined();
  }, 180000);
  it('C4 cancelled attack has recovery but no brawl, blows, or social incident', () => {
    const s = PlaySession.create(content, { source: 'tavern_instant', seed: 7 });
    say(s, 'wait 1h');
    expect(say(s, 'attack Lucius').ok).toBe(true);
    expect(say(s, 'cancel').ok).toBe(true);
    for (let n = 0; n < 10 && s.observe().tactical; n++) say(s, 'resume');
    const w = sessionSimOf(s).world;
    expect(instantOf(w)).toBeGreaterThan(0);
    expect(w.log.events.some((e) => e.kind === 'tactical.blow' || e.kind === 'tactical.outcome')).toBe(false);
    expect(w.backgroundTactical?.brawls ?? []).toEqual([]);
    expect(Object.values(w.social.combatIncidents ?? {})).toEqual([]);
  });
  it('C4 mid-brawl status and drink refusal describe combat, with free inspection', () => {
    const s = PlaySession.create(content, { source: 'tavern_brawl', seed: 7 });
    expect(s.observe().self.activity.verb).toContain('brawl');
    expect(say(s, 'drink').reason).toContain('brawl');
    const before = s.hash;
    expect(say(s, 'inspect Joel Pike').ok).toBe(true);
    expect(s.hash).toBe(before);
  });
  it('C3 an attack transfers a spent town cursor once, preserves initiative and retires back to short walks', () => {
    const s = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
    expect(say(s, 'go 27').ok).toBe(true);
    expect(say(s, 'go 4').ok).toBe(true);
    const w = sessionSimOf(s).world,
      spent = activity.minuteBudget(w, s.playerId).spent;
    const hunger = needs.needValue(w, s.playerId, 'hunger');
    const result = say(s, 'attack Michael Dunleavy');
    expect(result.ok).toBe(true);
    expect('elapsedMinutes' in result && result.elapsedMinutes).toBe(0);
    expect(instantOf(w)).toBe(spent * 600);
    expect(w.tactical?.enteredAt).toBe(spent * 600);
    expect(w.tactical?.participants[s.playerId]?.readyAt).toBeGreaterThan(spent * 600);
    expect(w.tactical?.frame?.elapsed[s.playerId]).toBe(spent * 600);
    expect(needs.needValue(w, s.playerId, 'hunger')).toBeLessThanOrEqual(hunger);
    say(s, 'cancel');
    for (let n = 0; n < 10 && s.observe().tactical; n++) say(s, 'resume');
    const before = instantOf(w);
    expect(say(s, 'go 27').ok).toBe(true);
    expect(s.observe().place.id).toBe(27);
    expect(instantOf(w) - before).toBe(1200);
    expect(say(s, 'wait 1h').ok).toBe(true);
    expect(instantOf(w)).toBe(36000);
    expect(w.backgroundTactical?.frame?.elapsed[s.playerId]).toBe(36000);
    expect(findNonIntegers(w)).toEqual([]);
    expect(PlaySession.replay(content, s.commandLog).hash).toBe(s.hash);
  });
  it('C4 edgeqa parley: a heard appeal explicitly distinguishes refusal from peace', () => {
    let heard = false;
    for (const seed of [7, 8, 12, 42]) {
      const s = PlaySession.create(content, { source: 'tavern_brawl', seed });
      say(s, 'wait 1h');
      expect(say(s, 'tactical:parley').ok).toBe(true);
      for (let n = 0; n < 4 && s.observe().tactical; n++) say(s, 'resume');
      const w = sessionSimOf(s).world;
      const speech = w.log.events.find(
        (e) => e.kind === 'tactical.action' && e.data.action === 'parley' && e.data.phase === 'spoken',
      );
      expect(speech).toBeDefined();
      if (speech?.kind === 'tactical.action' && speech.explain?.outcome === 'success') {
        heard = true;
        expect(speech.data.text).toMatch(/accepted|refuse|another brawl continues/);
        if (speech.data.text.includes('accepted; the blows stop'))
          expect(w.log.events.some((e) => e.id > speech.id && e.kind === 'tactical.blow')).toBe(false);
      }
    }
    expect(heard).toBe(true);
  });
  it('C3 ordinary conversations after retirement retain the hourly allowance', () => {
    const s = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
    say(s, 'wait until 08:00');
    expect(say(s, 'attack Michael Dunleavy').ok).toBe(true);
    say(s, 'cancel');
    for (let n = 0; n < 10 && s.observe().tactical; n++) say(s, 'resume');
    expect(say(s, 'chat Michael Dunleavy').ok).toBe(true);
    const before = s.hash;
    expect(say(s, 'chat Michael Dunleavy').ok).toBe(false);
    expect(s.hash).toBe(before);
  });
  it('C3 a second town scene settles new witnesses needs and supplies from the same hour start', () => {
    const s = PlaySession.create(content, { source: 'iron_ford', seed: 42 });
    say(s, 'attack Michael Dunleavy');
    say(s, 'cancel');
    for (let n = 0; n < 10 && s.observe().tactical; n++) say(s, 'resume');
    const w = sessionSimOf(s).world;
    const prior = [...(w.backgroundTactical?.frame?.live ?? [])];
    say(s, 'go 1');
    const attack = s.observe().actions.find((a) => a.id.startsWith('talk:fight:'));
    if (!attack) throw Error('No opponent at Brenner House');
    expect(s.act(attack.command).ok).toBe(true);
    const newActors = w.tactical?.frame?.live.filter((id) => !prior.includes(id)) ?? [];
    expect(newActors.length).toBeGreaterThan(0);
    for (const id of newActors) {
      expect(w.tactical?.frame?.elapsed[id]).toBe(instantOf(w));
      expect(w.provisions.nutrition[id]?.today.burnKcal).toBeGreaterThan(0);
    }
    expect(findNonIntegers(w)).toEqual([]);
    expect(PlaySession.replay(content, s.commandLog).hash).toBe(s.hash);
  });
});
