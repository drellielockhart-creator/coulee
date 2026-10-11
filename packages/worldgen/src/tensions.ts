import type { ContentBundle, ScenarioActor, ScenarioDef } from '@coulee/content/schema';
import { randomFor } from './layout.ts';
import type { TownRecipe } from './types.ts';

/** Cast by social/physical constraints. No actor coordinates or names in the templates. */
export function seedTensions(content: ContentBundle, recipe: TownRecipe, s: ScenarioDef): string[] {
  const r = randomFor(recipe, 'tensions');
  const cast = (role: string, test: (a: ScenarioActor) => boolean) => {
    const candidates = s.actors.filter(test);
    const a = r.pick(candidates);
    if (!a) throw new Error(`Cannot cast tension role: ${role}`);
    return a;
  };
  const name = (a: ScenarioActor) => `${a.given} ${a.family}`;
  const inn = cast('innkeeper', (a) => content.occupations[a.occupation]?.roles.includes('tavern_keeper') === true);
  const lodger = cast(
    'adult lodger and in-law',
    (a) =>
      a.age >= 21 &&
      s.relationships.some((e) => e.kind === 'lodger' && e.a === a.key && e.b === inn.key) &&
      s.relationships.some((e) => e.kind === 'sibling' && e.b === a.key),
  );
  const creditor = cast(
    'storekeeper',
    (a) => content.occupations[a.occupation]?.roles.includes('storekeeper') === true,
  );
  const debtor = cast(
    'cash-poor householder',
    (a) => a.key !== creditor.key && s.households.some((h) => h.head === a.key && h.cash_cents < 900),
  );
  const hidden = cast(
    'concealed adult',
    (a) => a.age >= 21 && content.peoples[a.ancestry]?.concealed === true && a.presents_as !== a.ancestry,
  );
  const observer = cast(
    'literate neighbor outside the hidden household',
    (a) => a.literate && a.age >= 21 && a.household !== hidden.household && a.key !== lodger.key,
  );
  const add = (key: string, summary: string, actors: ScenarioActor[]) =>
    s.tensions.push({ key, summary, actors: actors.map((a) => a.key) });
  const opinion = (a: ScenarioActor, b: ScenarioActor, reason: string, affection: number, trust: number, fear = 0) =>
    s.opinions.push({ from: a.key, to: b.key, reason, affection, trust, fear, respect: 10 });
  const grudge = (a: ScenarioActor, b: ScenarioActor, founding: string, aim: 'apology' | 'restitution') =>
    s.grudges.push({ holder: a.key, target: b.key, intensity: r.int(45, 65), aim, founding, public: false });
  const innReason = `${name(lodger)} promised to repair the tavern roof, then spent the advance on survey gear. Meltwater spoiled the bedding.`;
  add('innkeepers_grudge', `${name(inn)} keeps a room for a brother-in-law and a grudge over the leaking roof.`, [
    inn,
    lodger,
  ]);
  grudge(inn, lodger, innReason, 'restitution');
  opinion(inn, lodger, innReason, -30, -40);
  s.relationships.push({
    a: inn.key,
    b: lodger.key,
    kind: 'creditor',
    amount_cents: r.int(250, 600),
    note: 'Roof advance and unpaid winter lodging.',
  });
  s.relationships.push({ a: inn.key, b: lodger.key, kind: 'in_law' });
  const debt = r.int(350, 800);
  s.relationships.push({
    a: creditor.key,
    b: debtor.key,
    kind: 'creditor',
    amount_cents: debt,
    note: 'Seed corn and winter staples; payable after the first cash work.',
  });
  add(
    'souring_debt',
    `${name(debtor)} owes ${name(creditor)} ${debt} cents. A public demand at the counter has made an ordinary debt a humiliation.`,
    [debtor, creditor],
  );
  const debtReason = 'Asked for the winter tab in front of the schoolchildren; promised to keep the account private.';
  grudge(debtor, creditor, debtReason, 'apology');
  opinion(debtor, creditor, debtReason, -25, -30);
  s.relationships.push({ a: debtor.key, b: creditor.key, kind: 'rival', note: debtReason });
  s.memories.push({
    owner: debtor.key,
    about: creditor.key,
    kind: 'dunning',
    summary: debtReason,
    emotion: 'shame',
    intensity: 65,
    days_ago: 3,
    affection: 0,
    respect: 0,
    trust: 0,
    fear: 0,
  });
  s.secrets.push({
    holder: hidden.key,
    prop: { pred: 'faekin', args: [hidden.key] },
    known_by: [],
    note: 'A private dusk-name and ordinary passing names. The household has been here eleven years.',
  });
  s.beliefs.push({
    holder: observer.key,
    prop: { pred: 'faekin', args: [hidden.key] },
    credence: r.int(25, 40),
    voiced: false,
    note: 'A face little changed since the first winter; a suspicion, not knowledge.',
  });
  opinion(observer, hidden, 'Remembers a face that seems not to have aged; says nothing yet.', -5, -10, 5);
  add(
    'quiet_suspicion',
    `${name(observer)} has begun counting the years in ${name(hidden)}’s face. The suspicion has not been spoken.`,
    [observer, hidden],
  );
  // A mundane stranger is also suspected: supernatural identity is not a synonym for wrongdoing.
  s.beliefs.push({
    holder: inn.key,
    prop: { pred: 'faekin', args: [lodger.key] },
    credence: 20,
    voiced: false,
    note: 'A bitter joke about the returned surveyor coming home changed; false.',
  });
  add(
    'returned_stranger',
    `${name(lodger)} returns with survey chains and evasive answers. ${name(inn)} mistakes an ordinary man’s debts for something stranger.`,
    [lodger, inn],
  );
  return s.tensions.map((t) => `${t.key}: ${t.summary}`);
}
