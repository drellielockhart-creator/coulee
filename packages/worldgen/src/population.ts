import {
  type ContentBundle,
  type PlaceDef,
  type ScenarioActor,
  ScenarioActorSchema,
  type ScenarioDef,
  ScenarioHouseholdSchema,
  type StackSeed,
} from '@coulee/content/schema';
import { randomFor } from './layout.ts';
import type { TownRecipe } from './types.ts';

export function populate(
  content: ContentBundle,
  recipe: TownRecipe,
  scenario: ScenarioDef,
  homes: Record<string, PlaceDef>,
): { means: Record<string, number> } {
  // Authored casts are fixtures, not a source of recycled generated identities.
  const names = new Set(Object.values(content.scenarios).flatMap((s) => s.actors.map((a) => `${a.given} ${a.family}`)));

  const families = new Set<string>();
  const r = randomFor(recipe, 'population', 'households');
  const concealed = Object.keys(content.peoples)
    .sort()
    .map((k) => content.peoples[k])
    .find((p) => p?.concealed);
  if (!concealed) throw new Error('Town requires a concealed people in content');
  const headOf: Record<string, ScenarioActor> = {};
  /** Each household's means (1 thin .. 5 comfortable), handed to text.ts for farm and stock prose. */
  const meansOf: Record<string, number> = {};
  function actor(
    key: string,
    household: string,
    occupation: string,
    cultureId: string,
    ancestry: string,
    age: number,
    sex: 'female' | 'male',
    family?: string,
  ) {
    const ar = randomFor(recipe, 'population', key);
    const culture = content.cultures[cultureId];
    const people = content.peoples[ancestry];
    const job = content.occupations[occupation];
    if (!culture || !people || !job)
      throw new Error(`Missing population content: ${cultureId}/${ancestry}/${occupation}`);
    const pool = content.namePools[culture.name_pools[0] ?? ''];
    if (!pool) throw new Error(`Missing name pool for ${cultureId}`);
    const givenPool = sex === 'female' ? pool.given_female : pool.given_male;
    const surname = family ?? ar.pick(pool.family);
    // Rotate a content pool; never append a number to a person's name.
    const start = ar.int(0, givenPool.length - 1);
    let picked = '';
    for (let i = 0; i < givenPool.length; i++) {
      const g = givenPool[(i + start) % givenPool.length] as string;
      if (!names.has(`${g} ${surname}`)) {
        picked = g;
        break;
      }
    }
    if (!picked || !surname) throw new Error(`Name pool exhausted: ${cultureId}/${surname}`);
    names.add(`${picked} ${surname}`);
    const home = homes[household];
    if (!home) throw new Error(`No home for ${household}`);
    const workplace = occupation === 'pastor' ? `${scenario.site}_church` : home.id;
    const abilities = {
      str: ar.int(8, 15),
      dex: ar.int(8, 15),
      con: ar.int(8, 15),
      int: ar.int(8, 15),
      wis: ar.int(8, 15),
      cha: ar.int(8, 15),
    };
    for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) abilities[k] += people.ability_mods[k] ?? 0;
    const specialPool = Object.keys(content.namePools)
      .sort()
      .map((k) => content.namePools[k])
      .find((p) => p?.peoples.length === 1 && p.peoples[0] === ancestry && p.private_names.length);
    const a = ScenarioActorSchema.parse({
      key,
      given: picked,
      family: surname,
      sex,
      age,
      ancestry,
      culture: cultureId,
      presents_as: people.concealed ? people.passes_as[0] : ancestry,
      household,
      occupation,
      workplace,
      abilities,
      skills: Object.fromEntries(job.skills.map((s) => [s, age < 16 ? 1 : ar.int(2, 6)])),
      traits: [ar.pick(['pious', 'gossip', 'hot_tempered', 'kind', 'proud'].filter((t) => content.traits[t]))].filter(
        Boolean,
      ),
      values: {
        thrift: ar.int(0, 3),
        neighborliness: ar.int(0, 2),
        discretion: ar.int(0, 2),
        superstition: ar.int(-1, 2),
      },
      psyche: { ego: ar.int(40, 70), superego: ar.int(35, 75), id_appetite: ar.int(35, 65) },
      anxiety: ar.int(80, 220),
      languages: culture.languages,
      literate: age >= 8 && ar.chancePercent(culture.literacy_pct),
      true_name: specialPool ? ar.pick(specialPool.private_names) : undefined,
      house_name: specialPool ? ar.pick(specialPool.house_names) : undefined,
      purse_cents: age < 16 ? ar.int(0, 12) : ar.int(35, 180),
      persona: age < 16 ? 'a child of the district' : `a ${job.name.toLowerCase()} with a household to keep`,
    });
    scenario.actors.push(a);
    return a;
  }
  function kin(
    a: ScenarioActor,
    b: ScenarioActor,
    kind: 'spouse' | 'parent' | 'sibling' | 'employer' | 'lodger' | 'friend',
    note?: string,
  ) {
    scenario.relationships.push({ a: a.key, b: b.key, kind, note });
    if (kind === 'parent' || kind === 'spouse' || kind === 'friend')
      scenario.opinions.push({
        from: a.key,
        to: b.key,
        affection: r.int(35, 65),
        respect: 20,
        trust: 35,
        fear: 0,
        reason:
          kind === 'friend'
            ? 'Shared seed potatoes after a hard winter'
            : 'The work and worry of keeping a household together',
      });
  }
  function household(
    key: string,
    culture: string,
    occupation: string,
    means: number,
    shape: 'couple' | 'widow' | 'single',
    ancestry = 'human',
  ) {
    const hr = randomFor(recipe, 'population', key);
    const pool = content.namePools[content.cultures[culture]?.name_pools[0] ?? ''];
    const family = hr
      .shuffleByKey(pool?.family ?? [], (s) => {
        let n = 0;
        for (let i = 0; i < s.length; i++) n = Math.imul(n, 31) + s.charCodeAt(i);
        return n;
      })
      .find((f) => !families.has(f));
    if (!family) throw new Error(`Household surname pool exhausted: ${culture}`);
    families.add(family);
    const head = actor(
      `${key}_head`,
      key,
      occupation,
      culture,
      ancestry,
      hr.int(34, 53),
      shape === 'widow' ? 'female' : 'male',
      family,
    );
    headOf[key] = head;
    head.notes =
      shape === 'widow'
        ? 'Widowed three winters ago; keeps the business and the family ledger.'
        : 'Settled here before the last hard winter; spring work cannot wait for old quarrels.';
    if (shape === 'couple') {
      const spouse = actor(
        `${key}_spouse`,
        key,
        key.startsWith('farm') ? 'farm_wife' : 'housewife',
        culture,
        ancestry,
        head.age - hr.int(0, 5),
        'female',
        family,
      );
      kin(head, spouse, 'spouse');
    }
    if (shape !== 'single' && key !== 'mill' && key !== 'pastor') {
      const child = actor(
        `${key}_child`,
        key,
        key === 'store' ? 'shop_clerk' : 'child',
        culture,
        ancestry,
        key === 'store' ? 18 : hr.int(7, 13),
        hr.chancePercent(50) ? 'female' : 'male',
        family,
      );
      kin(head, child, 'parent');
      const spouse = scenario.actors.find((a) => a.key === `${key}_spouse`);
      if (spouse) kin(spouse, child, 'parent');
    }
    meansOf[key] = means;
    const members = scenario.actors.filter((a) => a.household === key).length;
    const pantry: StackSeed[] = [];
    const stock = (item: string, qty: number, container?: string) => {
      if (!content.items[item]) throw new Error(`Missing pantry item ${item}`);
      const previous = pantry.find((p) => p.item === item && p.in === container);
      if (previous) previous.qty += qty;
      else pantry.push({ item, qty, worn: false, ...(container ? { in: container } : {}) });
    };
    stock('brine_keg_10gal', 1);
    stock('flour', members * (means + hr.int(4, 7)));
    stock('cornmeal', members * (means + 3));
    stock('salt_pork', members * (means + 2), 'brine_keg_10gal');
    stock('potatoes', members * (means + 4));
    stock('beans_dry', members * (means + 2));
    stock('dried_apples', members * Math.max(1, means));
    stock('firewood_armload', members * 10);
    stock('camp_kettle_pair', 1);
    stock('frying_pan', 1);
    for (const item of content.cultures[culture]?.foodways.staples ?? []) {
      if (!pantry.some((s) => s.item === item)) stock(item, members * 2);
    }
    if (means >= 3) {
      stock('cheese', members * 2);
      stock('sugar_brown', 2);
    }
    scenario.households.push(
      ScenarioHouseholdSchema.parse({
        key,
        name: `The ${family} household`,
        home: homes[key]?.id,
        head: head.key,
        cash_cents: means * 350 + hr.int(50, 200),
        storage: means >= 2 ? 'cellar' : 'indoor',
        pantry,
        note: `${shape === 'widow' ? 'Widowed household. ' : ''}${means === 1 ? 'Thin April stores: last year’s potatoes, little fruit, wages already promised.' : 'Winter grain and pork, a root cellar, and a small reserve for seedtime.'} ${content.cultures[culture]?.foodways.customs[0] ?? ''}`,
      }),
    );
  }
  const choose = (cultures: string[]) => r.pick(cultures) as string;
  const tavernCulture = choose(['irish', 'cornish', 'german']);
  household('store', choose(['yankee', 'german', 'norwegian', 'black_ohio']), 'storekeeper', 5, 'widow');
  household('tavern', tavernCulture, 'tavern_keeper_jp', 3, 'couple');
  household('smith', choose(['german', 'cornish', 'norwegian']), 'blacksmith', 2, 'couple');
  household('mill', choose(['norwegian', 'german', 'yankee']), 'miller', 4, 'couple');
  household(
    'pastor',
    homes.pastor?.tags.includes('lutheran') ? choose(['norwegian', 'german']) : choose(['yankee', 'black_ohio']),
    'pastor',
    2,
    'couple',
  );
  household('school', choose(['yankee', 'norwegian', 'black_ohio']), 'schoolteacher', 2, 'single');
  if (homes.service?.tags.includes('print'))
    household('service', choose(['yankee', 'german', 'black_ohio']), 'editor_printer', 3, 'single');
  else if (homes.service?.tags.includes('pellar')) household('service', 'cornish', 'pellar', 2, 'single');
  else household('service', 'norwegian', 'lay_preacher', 2, 'single');
  const farmCultures = r.shuffleByKey(
    ['cornish', 'black_ohio', 'german', 'norwegian', 'yankee'],
    (s) => s.length * 100 + s.charCodeAt(0),
  );
  for (let i = 0; homes[`farm${i}`]; i++) {
    const culture =
      i === 0 ? choose(['yankee', 'cornish', 'norwegian']) : i === 1 ? 'elf_hall' : (farmCultures[i - 2] as string);
    household(
      `farm${i}`,
      culture,
      'farmer',
      i === 0 ? 1 : r.int(2, 4),
      r.chancePercent(35) ? 'widow' : 'couple',
      content.cultures[culture]?.peoples[0] ?? 'human',
    );
  }
  // Concealment cuts across ordinary settler households; it never maps onto Black settler history.
  const hidden = headOf.farm0 as ScenarioActor;
  hidden.ancestry = concealed.id;
  hidden.presents_as = concealed.passes_as[0];
  hidden.true_name = r.pick(content.namePools.faekin_dusk?.private_names ?? []);
  for (const k of ['str', 'dex', 'con'] as const)
    hidden.abilities[k] += (concealed.ability_mods[k] ?? 0) - (content.peoples.human?.ability_mods[k] ?? 0);
  const goblinPool = content.namePools.goblin_pare;
  if (!goblinPool) throw new Error('Town requires the goblin pare name pool');
  const hired = actor(
    'hired_hand',
    'farm2',
    'hired_hand',
    'goblin_pare',
    goblinPool.peoples[0] as string,
    r.int(21, 38),
    'male',
  );
  hired.notes = 'A paid hand lodging with the farm family; sends part of his wages to the pare sick fund.';
  kin(headOf.farm2 as ScenarioActor, hired, 'employer');
  const keeper = headOf.tavern as ScenarioActor;
  const sister = scenario.actors.find((a) => a.key === 'tavern_spouse') as ScenarioActor;
  const maiden = randomFor(recipe, 'population', 'innkeeper_in_law').pick(
    (content.namePools[content.cultures[tavernCulture]?.name_pools[0] ?? '']?.family ?? []).filter(
      (f) => f !== keeper.family,
    ),
  );
  if (!maiden) throw new Error('Innkeeper name pool needs a distinct maiden surname');
  sister.notes = `Born ${maiden}; her brother has returned to lodge at the tavern.`;
  const boarder = actor('boarder', 'tavern', 'surveyor', tavernCulture, 'human', sister.age - 3, 'male', maiden);
  boarder.notes =
    'The innkeeper’s brother-in-law, newly returned with a survey contract; still owes for last winter’s room.';
  kin(sister, boarder, 'sibling');
  kin(boarder, keeper, 'lodger');
  if (homes.landing) {
    const ferryman = actor('ferryman', 'tavern', 'ferryman', 'yankee', 'human', r.int(25, 48), 'male');
    ferryman.workplace = homes.landing.id;
    kin(ferryman, keeper, 'lodger');
  }
  kin(headOf.mill as ScenarioActor, headOf.farm2 as ScenarioActor, 'friend');
  kin(headOf.smith as ScenarioActor, headOf.school as ScenarioActor, 'friend');
  for (const key of ['store', 'mill']) {
    scenario.stocks.push({
      place: (homes[key] as PlaceDef).id,
      markup_pct: key === 'store' ? 100 : 90,
      restock: key === 'store' ? 'pratt_wholesale' : 'haugen_mill_delivery',
      credit_limit_cents: 2400,
      items: (content.restocks[key === 'store' ? 'pratt_wholesale' : 'haugen_mill_delivery']?.lines ?? []).map(
        (line) => ({
          item: line.item,
          qty: Math.min(line.target_qty, line.max_delivery ?? line.target_qty),
          worn: false,
        }),
      ),
    });
  }
  // The minimal reservoir (13 §7.4, slice 1b): one Hearth charm lying about a farmstead, found by
  // the work done there (field labor or gathering) at the doc's hazard. The Director never adds one.
  const farmKeys = Object.keys(homes)
    .filter((k) => /^farm\d+$/.test(k))
    .sort();
  const charmFarm = randomFor(recipe, 'population', 'charm_reservoir').pick(farmKeys);
  const farmPlace = charmFarm ? homes[charmFarm] : undefined;
  if (farmPlace && content.charms?.never_empty_sack)
    scenario.fae_reservoir.push({
      item: 'never_empty_sack',
      place: farmPlace.id,
      from_day: 0,
      find_permille: 5,
      notice_dc: 15,
      gathering: true,
      activity_tags: ['wild_production', 'labor'],
    });
  for (const h of scenario.households) {
    const home = homes[h.key] as PlaceDef;
    home.capacity = Math.max(8, scenario.actors.filter((a) => a.household === h.key).length + 4);
    // Every other building is named for its owner by text.ts; the tavern's sign is its name.
    if (h.key === 'tavern') {
      // Sign names take a lowercase article in running prose; ownership varies by seed.
      if (randomFor(recipe, 'layout', 'tavern_owner').chancePercent(50))
        home.name = `${headOf[h.key]?.family}'s ${home.name.slice(4)} Tavern`;
      else home.name += ' Tavern';
    }
  }
  scenario.player = 'store_child';
  return { means: meansOf };
}
