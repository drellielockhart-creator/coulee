import { describe, expect, it } from 'vitest';
import type { ActorCore } from '../actor.ts';
import { asActorId, asHouseholdId, asPlaceId } from '../ids.ts';
import { asGameMinute } from '../time.ts';
import { whenSpecificity, whoMatches } from './talk-who.ts';

const NOW = asGameMinute(0);

function actor(over: Partial<ActorCore> = {}, ageYears = 40): ActorCore {
  return {
    id: asActorId(1),
    key: 'lemuel_hatch',
    name: { given: 'Lemuel', family: 'Hatch' },
    sex: 'male',
    // 1855-04-01 is minute 0; born N years before.
    born: asGameMinute(-ageYears * 365 * 1440),
    ancestryId: 'human',
    presentsAsId: 'human',
    occupationId: 'ferryman',
    householdId: asHouseholdId(1),
    placeId: asPlaceId(1),
    values: {},
    traits: ['tippler'],
    sheet: { abilities: {}, skills: {}, level: 1, feats: [], conditions: [], languages: [], literate: true },
    controller: 'ai',
    alive: true,
    ...over,
  } as unknown as ActorCore;
}

describe('talk lines that belong to a person or a kind of person', () => {
  it('matches a teller by scenario key, trade, culture, trait, sex and age band', () => {
    const a = actor();
    expect(whoMatches({ actor: ['lemuel_hatch'] }, a, 'yankee', NOW)).toBe(true);
    expect(whoMatches({ actor: ['amos_whitcomb'] }, a, 'yankee', NOW)).toBe(false);
    expect(whoMatches({ occupation: ['ferryman', 'boatman'] }, a, null, NOW)).toBe(true);
    expect(whoMatches({ occupation: ['miller'] }, a, null, NOW)).toBe(false);
    expect(whoMatches({ culture: ['yankee'] }, a, 'yankee', NOW)).toBe(true);
    expect(whoMatches({ culture: ['yankee'] }, a, null, NOW)).toBe(false);
    expect(whoMatches({ trait: ['tippler'] }, a, null, NOW)).toBe(true);
    expect(whoMatches({ trait: ['pious'] }, a, null, NOW)).toBe(false);
    expect(whoMatches({ sex: 'male' }, a, null, NOW)).toBe(true);
    expect(whoMatches({ sex: 'female' }, a, null, NOW)).toBe(false);
    expect(whoMatches({ age: 'prime' }, a, null, NOW)).toBe(true);
    expect(whoMatches({ age: 'elder' }, a, null, NOW)).toBe(false);
    expect(whoMatches({ age: 'elder' }, actor({}, 60), null, NOW)).toBe(true);
    expect(whoMatches({ age: 'young' }, actor({}, 19), null, NOW)).toBe(true);
  });

  it('needs every field it names to hold', () => {
    const a = actor();
    expect(whoMatches({ actor: ['lemuel_hatch'], occupation: ['ferryman'] }, a, null, NOW)).toBe(true);
    expect(whoMatches({ actor: ['lemuel_hatch'], occupation: ['miller'] }, a, null, NOW)).toBe(false);
  });

  it('counts the fields inside initiator/target so a line naming its teller outweighs a general one', () => {
    expect(whenSpecificity({})).toBe(0);
    expect(whenSpecificity({ season: 'spring', weather: 'rain' })).toBe(2);
    expect(whenSpecificity({ initiator: { actor: ['x'] } })).toBe(1);
    expect(whenSpecificity({ initiator: { actor: ['x'], sex: 'male' }, venue: 'tavern' })).toBe(3);
    expect(whenSpecificity({ venue: undefined })).toBe(0);
  });
});
