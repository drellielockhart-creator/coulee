import type { ContentBundle, ScenarioActor, ScenarioDef } from '@coulee/content/schema';
import { randomFor } from './layout.ts';
import type { TownRecipe } from './types.ts';

/** Weighted set pieces. Cast roles describe circumstances, never a person's identity. */
const grievances = [
  {
    key: 'innkeepers_grudge',
    weight: 3,
    from: 'inn',
    to: 'lodger',
    aim: 'restitution',
    debt: true,
    foundings: [
      'An advance for roof repairs went on survey gear; meltwater spoiled the bedding.',
      'Winter lodging was promised in exchange for shingles. Neither shingles nor payment arrived.',
    ],
  },
  {
    key: 'souring_debt',
    weight: 3,
    from: 'debtor',
    to: 'creditor',
    aim: 'apology',
    debt: true,
    foundings: [
      'The winter tab was demanded before the schoolchildren, against a promise of discretion.',
      'A private request for another week to pay was read aloud across the store counter.',
    ],
  },
  {
    key: 'mill_toll',
    weight: 3,
    from: 'debtor',
    to: 'miller',
    aim: 'restitution',
    foundings: [
      'A short sack came back from grinding; each side blames the other’s measure.',
      'Seed grain was ground with the meal after explicit instructions to keep it aside.',
    ],
  },
  {
    key: 'boundary_stakes',
    weight: 2,
    from: 'farmer',
    to: 'lodger',
    aim: 'restitution',
    foundings: [
      'New survey stakes cut through a garden planted before anyone drew this plat.',
      'The survey fee was paid, but two neighbors received different accounts of the same boundary.',
    ],
  },
  {
    key: 'straying_cattle',
    weight: 3,
    from: 'debtor',
    to: 'farmer',
    aim: 'restitution',
    foundings: [
      'Cattle broke through an unrepaired fence and ate the saved seed potatoes.',
      'A borrowed ox came home lame; the borrower says it stumbled before the loan.',
    ],
  },
  {
    key: 'smiths_promise',
    weight: 2,
    from: 'farmer',
    to: 'smith',
    aim: 'apology',
    foundings: [
      'A plow repair promised before thaw was set aside for a richer customer.',
      'The smith called a cracked share careless handling before examining the weld.',
    ],
  },
  {
    key: 'chapel_subscription',
    weight: 1,
    from: 'inn',
    to: 'pastor',
    aim: 'apology',
    foundings: [
      'A pledge for the chapel stove was announced as unpaid after the wood had been delivered.',
      'A gift for a sick neighbor was described from the pulpit as money for the chapel.',
    ],
  },
  {
    key: 'seed_promise',
    weight: 2,
    from: 'farmer',
    to: 'creditor',
    aim: 'restitution',
    foundings: [
      'Seed corn reserved through winter was sold to a passing teamster.',
      'A sack sold for planting proved damp through the middle; nobody agrees when it spoiled.',
    ],
  },
] as const;

/** Two material tensions plus one rumor, with an optional fourth card, without replacement. */
export function seedTensions(content: ContentBundle, recipe: TownRecipe, s: ScenarioDef): string[] {
  const r = randomFor(recipe, 'tensions');
  const cast = (role: string, test: (a: ScenarioActor) => boolean) => {
    const a = r.pick(s.actors.filter(test));
    if (!a) throw new Error(`Cannot cast tension role: ${role}`);
    return a;
  };
  const job = (role: string) => cast(role, (a) => content.occupations[a.occupation]?.roles.includes(role) === true);
  const inn = job('tavern_keeper');
  const lodger = cast(
    'adult in-law lodger',
    (a) =>
      a.age >= 21 &&
      s.relationships.some((e) => e.kind === 'lodger' && e.a === a.key && e.b === inn.key) &&
      s.relationships.some((e) => e.kind === 'sibling' && e.b === a.key),
  );
  const creditor = job('storekeeper');
  const debtor = cast(
    'cash-poor householder',
    (a) => a.key !== creditor.key && s.households.some((h) => h.head === a.key && h.cash_cents < 900),
  );
  const farmer = cast('neighboring farmer', (a) => a.key !== debtor.key && a.occupation === 'farmer');
  const hidden = cast('concealed adult', (a) => a.age >= 21 && content.peoples[a.ancestry]?.concealed === true);
  const observer = cast('literate neighbor', (a) => a.literate && a.age >= 21 && a.household !== hidden.household);
  const roles: Record<string, ScenarioActor> = {
    inn,
    lodger,
    creditor,
    debtor,
    farmer,
    miller: cast('miller', (a) => a.occupation === 'miller'),
    smith: cast('smith', (a) => a.occupation === 'blacksmith'),
    pastor: cast('pastor', (a) => a.occupation === 'pastor'),
  };
  const name = (a: ScenarioActor) => `${a.given} ${a.family}`;
  const opinion = (a: ScenarioActor, b: ScenarioActor, reason: string, affection: number, trust: number, fear = 0) =>
    s.opinions.push({ from: a.key, to: b.key, reason, affection, trust, fear, respect: 10 });
  s.secrets.push({
    holder: hidden.key,
    prop: { pred: 'faekin', args: [hidden.key] },
    known_by: [],
    note: 'A private dusk-name, an ordinary household, and no wish to have either discussed.',
  });
  const deck = [...grievances];
  const extra = r.chancePercent(50);
  const count = extra && r.chancePercent(50) ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const card = r.weighted(deck, (c) => c.weight);
    if (!card) break;
    deck.splice(deck.indexOf(card), 1);
    const a = roles[card.from] as ScenarioActor;
    const b = roles[card.to] as ScenarioActor;
    const founding = r.pick(card.foundings) as string;
    const intensity = r.int(40, 65);
    s.tensions.push({ key: card.key, summary: `${name(a)} and ${name(b)}: ${founding}`, actors: [a.key, b.key] });
    s.grudges.push({ holder: a.key, target: b.key, intensity, aim: card.aim, founding, public: false });
    opinion(a, b, founding, -r.int(20, 35), -r.int(20, 40));
    s.memories.push({
      owner: a.key,
      about: b.key,
      kind: 'insult',
      summary: founding,
      emotion: 'anger',
      intensity,
      days_ago: r.int(2, 20),
      affection: 0,
      respect: 0,
      trust: 0,
      fear: 0,
    });
    if ('debt' in card)
      s.relationships.push({
        a: card.key === 'souring_debt' ? b.key : a.key,
        b: card.key === 'souring_debt' ? a.key : b.key,
        kind: 'creditor',
        amount_cents: r.int(250, 800),
        note: founding,
      });
  }
  const rumors = r.shuffleByKey(['quiet_suspicion', 'returned_stranger'], (key) => key.length);
  for (const key of rumors.slice(0, extra && count === 2 ? 2 : 1)) {
    const [a, b] = key === 'quiet_suspicion' ? [observer, hidden] : [inn, lodger];
    const note =
      key === 'quiet_suspicion'
        ? (r.pick([
            'A face little changed since the first winter; a suspicion, not knowledge.',
            'An old portrait seems too like the neighbor who claims never to have sat for it.',
          ]) as string)
        : (r.pick([
            'A returned surveyor knows a path he swears he never walked; tavern talk mistakes evasion for enchantment.',
            'After a winter away, a lodger will not name his employer. A creditor supplies a stranger explanation.',
          ]) as string);
    s.beliefs.push({
      holder: a.key,
      prop: { pred: 'faekin', args: [b.key] },
      credence: r.int(20, 40),
      voiced: false,
      note,
    });
    opinion(a, b, note, -5, -10, 5);
    s.tensions.push({ key, summary: `${name(a)} watches ${name(b)}: ${note}`, actors: [a.key, b.key] });
  }
  return s.tensions.map((t) => `${t.key}: ${t.summary}`);
}
