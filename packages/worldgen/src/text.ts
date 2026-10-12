/**
 * Names and descriptions for a generated town's places (ADR 0003; wave 5 group D).
 *
 * Runs after population, when owners are known: every place gets a name that is distinct in the
 * town and period-plausible (owner, landmark or direction, never a coordinate), and a description
 * built from that place's own features: its aspect, soil and water, the household that keeps it,
 * its crop and stock, and the one thing you would remember. Nothing here shows fae knowledge; a
 * newcomer reads only what is visible from the road.
 *
 * Draws use their own RNG keys (`text:<place>`), so the geography, the cast and the tensions of a
 * seed never move when this text changes. Pools are dealt without replacement within a town, which
 * is what keeps twin places from reading alike.
 */
import type { ContentBundle, PlaceDef, ScenarioActor, ScenarioDef, SiteDef } from '@coulee/content/schema';
import { randomFor } from './layout.ts';
import * as D from './text-data.ts';
import type { TownRecipe } from './types.ts';

export interface TextInput {
  content: ContentBundle;
  recipe: TownRecipe;
  site: SiteDef;
  places: PlaceDef[];
  scenario: ScenarioDef;
  /** Creek x and ford y on the grid: aspect and "north of the ford" come from them. */
  creek: number;
  ford: number;
  /** Each household's means, 1 (thin) to 5. */
  means: Record<string, number>;
}

const poss = (name: string): string => `${name}'${/s$/i.test(name) ? '' : 's'}`;
const numberWord = (n: number): string =>
  ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ??
  `${n}`;
const oxford = (list: string[]): string =>
  list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
const join = (...parts: Array<string | null | undefined | false>): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');

export function nameAndDescribe(inp: TextInput): void {
  const { content, recipe, site, places, scenario, means } = inp;
  const place = (key: string): PlaceDef | undefined => places.find((p) => p.id === `${site.id}_${key}`);
  const actors = scenario.actors;
  const head = (hk: string): ScenarioActor | undefined => actors.find((a) => a.key === `${hk}_head`);
  const spouse = (hk: string): ScenarioActor | undefined => actors.find((a) => a.key === `${hk}_spouse`);
  const child = (hk: string): ScenarioActor | undefined => actors.find((a) => a.key === `${hk}_child`);
  const family = (hk: string): string => head(hk)?.family ?? '';
  const titled = (hk: string): string => {
    const h = head(hk);
    if (!h) return 'The keeper';
    return `${h.sex === 'male' ? 'Mr.' : 'Mrs.'} ${h.family}`;
  };
  const rngFor = (key: string) => randomFor(recipe, 'layout', `text:${key}`);

  // A pool dealt without replacement: the same sentence is not used twice in a town. Callers pass
  // the pool every time (it may carry per-call names), so only the shuffled order is remembered.
  const dealt = new Map<string, { order: number[]; n: number }>();
  const deal = (name: string, pool: readonly string[]): string => {
    let d = dealt.get(name);
    if (!d) {
      d = {
        order: rngFor(`deal:${name}`).shuffleByKey(
          pool.map((_, i) => i),
          (i) => i,
        ),
        n: 0,
      };
      dealt.set(name, d);
    }
    return pool[(d.order[d.n++ % d.order.length] as number) % pool.length] as string;
  };

  const landmarks = site.landmarks ?? { main_street: 'Main Street', back_road: 'Back Road', creek: 'The Creek' };
  const creekShort = landmarks.creek.replace(/ Creek$/, '');
  const ford = place('ford');
  const fordName = ford?.name ?? 'the ford';

  // ---- names that do not depend on owners ----

  // ---- names that follow the household ----

  const name = (key: string, text: string) => {
    const p = place(key);
    if (p) p.name = text;
  };
  const storeBase = place('store')?.name ?? 'General Store';
  name(
    'store',
    /^Mercantile$/.test(storeBase) ? `${family('store')} Mercantile` : `${poss(family('store'))} ${storeBase}`,
  );
  const schoolBase = place('school')?.name ?? 'District School';
  name(
    'school',
    /^Subscription/.test(schoolBase) ? `${site.name} Subscription School` : `${creekShort} Creek District School`,
  );
  name('smith', `${poss(family('smith'))} Smithy`);
  const millKind = /Flour/.test(place('mill')?.name ?? '') ? 'Flour Mill' : 'Grist Mill';
  name('mill', `${poss(family('mill'))} ${millKind}`);
  name('pastor', `${family('pastor')} Parsonage`);
  const service = place('service');
  if (service) {
    // The printer's shop is named for his paper ("Alder Mills Gazette Print Shop").
    if (service.tags.includes('print')) service.name = `${service.name} Print Shop`;
    else if (service.tags.includes('pellar')) service.name = `${poss(family('service'))} Herb House`;
    else service.name = `${poss(family('service'))} Prayer House`;
  }

  // Farms and their fields, named for the family and what they grow.
  const farmKeys: string[] = [];
  for (let i = 0; place(`farm${i}`); i++) farmKeys.push(`farm${i}`);
  const cropOf = new Map<string, keyof typeof D.CROPS>();
  const taken = new Set<string>();
  for (const [i, hk] of farmKeys.entries()) {
    const h = head(hk);
    const culture = content.cultures[h?.culture ?? ''];
    const crops = (culture?.foodways.staples ?? []).filter((s) => s in D.CROPS);
    // Rotate through what the culture eats so neighboring farms do not grow the same thing.
    const options = crops.length ? crops : ['potatoes'];
    const pick = options.find((c) => !taken.has(c)) ?? options[i % options.length] ?? 'potatoes';
    taken.add(pick);
    cropOf.set(hk, pick as keyof typeof D.CROPS);
    name(hk, `${family(hk)} Farm`);
    name(`field${i}`, `${family(hk)} ${D.CROPS[pick as keyof typeof D.CROPS]?.ground ?? 'Fields'}`);
  }

  // ---- descriptions ----

  const describe = (key: string, text: string) => {
    const p = place(key);
    if (p) p.description = text;
  };
  const fam = (hk: string) => family(hk);

  // Streets and roads: what stands along them, what the ground is like.
  const fronting = (lo: number, hi: number): string[] =>
    ['tavern', 'store', 'school', 'service']
      .map((k) => place(k))
      .filter((p): p is PlaceDef => !!p && p.y >= lo && p.y < hi)
      .sort((a, b) => a.y - b.y)
      .map((p) => `${p.name.replace(/^The /, 'the ')}`);
  const streetWord = landmarks.main_street.split(' ')[0] ?? '';
  const streetFlavor = D.STREET_CHARACTER[streetWord] ?? '';
  const frontText = (list: string[], where: string): string =>
    list.length
      ? `${oxford(list).replace(/^./, (c) => c.toUpperCase())} ${list.length === 1 ? 'stands' : 'stand'} ${where}.`
      : 'Only fences and a woodlot stand along this stretch.';
  describe(
    'street_n',
    join(
      `The upper stretch of ${landmarks.main_street}, from the head of the valley down to ${fordName}.`,
      frontText(fronting(0, inp.ford), 'on the west side'),
      streetFlavor,
      deal('street', D.STREET_SURFACES),
    ),
  );
  describe(
    'street_s',
    join(
      `${landmarks.main_street} below ${fordName}, running on toward the bottoms and the valley road.`,
      frontText(fronting(inp.ford + 2, 99), 'on the west side'),
      deal('street', D.STREET_SURFACES),
    ),
  );

  const westFarms = farmKeys.filter((hk) => (place(hk)?.x ?? 0) < inp.creek);
  const eastFarms = farmKeys.filter((hk) => (place(hk)?.x ?? 0) >= inp.creek);
  const lanes = (list: string[]): string =>
    list.length
      ? `The lanes to ${oxford(list.map((hk) => `the ${fam(hk)} place`))} turn off it.`
      : 'Nothing lies up it but pasture and woodlot.';
  describe(
    'road_w',
    join(
      `The track west from ${fordName} into the side coulee, rutted by the farm wagons.`,
      lanes(westFarms),
      deal('road_w', [
        'In wet weather the ruts hold water and the teams go single file along the shoulder.',
        'It narrows where the bluff crowds it, and a loaded wagon has to wait for the one coming down.',
        'Dogs from every farm along it announce a stranger a quarter mile before he arrives.',
      ]),
    ),
  );
  const backWord = landmarks.back_road.split(' ')[0] ?? '';
  describe(
    'road_e',
    join(
      `${landmarks.back_road} leaves the valley at ${fordName} and climbs east.`,
      D.ROAD_CHARACTER[backWord] ?? '',
      lanes(eastFarms),
    ),
  );

  // The ford and the creek.
  if (ford)
    describe(
      'ford',
      join(
        `${titled('smith')} resets the iron bars in the gravel each spring, and the bottom rings under a hoof.`,
        deal('ford_depth', D.FORD_DEPTHS),
        deal('ford', D.FORD_DETAILS),
      ),
    );
  describe(
    'creek_upper',
    join(
      `${landmarks.creek} above the mill: cold brook-trout water, with a small fall at the mill seat.`,
      deal('creek_up', D.UPPER_CREEK_DETAILS),
    ),
  );
  describe(
    'creek_lower',
    join(
      `${landmarks.creek} below the ford, spreading wider, with spring runoff carrying maple leaves down from the shaded coves.`,
      deal('creek_low', D.LOWER_CREEK_DETAILS),
    ),
  );

  // The bluffs: aspect first, then one thing.
  describe(
    'west_cap',
    join(
      'Dolomite ledges over soft sandstone along the west rim, looking east across the valley.',
      deal('west_cap', D.WEST_CAP),
      'The road follows a break in the cap.',
    ),
  );
  describe(
    'east_cap',
    join(
      'Gray dolomite over sandstone along the east rim, facing west into the afternoon.',
      deal('east_cap', D.EAST_CAP),
      'A narrow path follows a break in the cap down to the farms below.',
    ),
  );
  describe(
    'west_slope',
    join('Maple and basswood shade the north-facing cove below the west rim.', deal('west_slope', D.WEST_SLOPE)),
  );
  describe(
    'east_slope',
    join('Goat prairie and pasqueflower on the warm slope under the east rim.', deal('east_slope', D.EAST_SLOPE)),
  );

  // The spring: its fixed lines first (they pair with the church bell), then the nearest farm.
  const spring = place('spring');
  if (spring) {
    const nearest = [...farmKeys].sort((a, b) => {
      const pa = place(a);
      const pb = place(b);
      const d = (p: PlaceDef | undefined) => (p ? Math.abs(p.x - spring.x) + Math.abs(p.y - spring.y) : 1e9);
      return d(pa) - d(pb) || (a < b ? -1 : 1);
    })[0];
    describe(
      'spring',
      join(
        'Cold water issues at the sandstone/dolomite contact. Neighbors leave a clean saucer; nobody admits hearing the bell below the water.',
        deal('spring', D.SPRING_DETAILS),
        nearest ? `The ${fam(nearest)} place carries its drinking water from here when the well runs low.` : '',
      ),
    );
  }
  const bottomFarm = [...farmKeys].sort((a, b) => (place(b)?.y ?? 0) - (place(a)?.y ?? 0))[0];
  describe(
    'bottom',
    join(
      'Silver maple at the wet edge and a mat of hay stubble across the valley floor.',
      deal('hay', D.HAY_GROUND),
      bottomFarm ? `The ${fam(bottomFarm)} team is usually first onto it.` : '',
    ),
  );

  // Village buildings.
  const clerk = child('store');
  describe(
    'store',
    join(
      deal('store_a', [
        `Dry goods, nails, tea and powder under one low roof; ${titled('store')} keeps the counter and the ledger.`,
        `A long counter, a scale and shelves to the ceiling; ${titled('store')}'s book of what the district owes is kept under it.`,
        `Calico, kettles, lamp oil and seed corn, crowded together; ${titled('store')} knows the price of each without looking.`,
      ]),
      clerk
        ? `${titled('store').startsWith('Mrs.') ? 'Her' : 'His'} ${clerk.sex === 'male' ? 'son' : 'daughter'} ${clerk.given} works the floor.`
        : '',
      deal('store_b', D.STORE_DETAILS),
    ),
  );

  const boarder = actors.find((a) => a.key === 'boarder');
  const ferryman = actors.find((a) => a.key === 'ferryman');
  describe(
    'tavern',
    join(
      `${titled('tavern')} keeps this frame house, with a long bar room below and beds above.`,
      boarder
        ? `${boarder.given} ${boarder.family}, the keeper's brother-in-law, has the front room upstairs, and a survey chain hangs on a peg at the foot of the stairs.`
        : '',
      ferryman ? `${ferryman.given} ${ferryman.family} the ferryman boards here too.` : '',
      deal('tavern', D.TAVERN_DETAILS),
    ),
  );

  const teacher = head('school');
  const scholars = actors.filter((a) => a.occupation === 'child').length;
  describe(
    'school',
    join(
      `${teacher ? `${teacher.sex === 'male' ? 'Mr.' : 'Miss'} ${teacher.family}` : 'The teacher'} keeps school here${
        scholars ? `, with ${numberWord(scholars)} scholars on the roll` : ''
      }.`,
      deal('school', D.SCHOOL_DETAILS),
    ),
  );

  describe(
    'smith',
    join(
      `${titled('smith')} works the forge, and the fire is never let out between the first frost and the last.`,
      `His hammer can be heard at ${fordName}, and the dogs along the street know it by heart.`,
      deal('smith', D.SMITH_DETAILS),
    ),
  );
  describe(
    'mill',
    join(
      deal('mill_a', [
        `An overshot wheel on the race from the fall, and a single run of stone; ${titled('mill')} takes his toll in kind.`,
        `A tall frame mill with an overshot wheel and two runs of stone; ${titled('mill')} takes his toll in kind and keeps his own count.`,
        `An undershot wheel in the pond below the fall, and one run of stone that is never idle in the wheat season; ${titled('mill')} takes his toll in kind.`,
      ]),
      deal('mill_b', D.MILL_DETAILS),
    ),
  );

  const pastor = head('pastor');
  const denomination = place('church')?.tags.find((t) => ['lutheran', 'methodist', 'baptist'].includes(t)) ?? '';
  const pastorTitle = denomination === 'lutheran' ? 'Pastor' : 'the Rev.';
  describe(
    'pastor',
    join(
      `${pastor ? `${pastorTitle === 'Pastor' ? 'Pastor' : 'The Rev.'} ${pastor.family}` : 'The pastor'} and his family live here.`,
      deal('parsonage', D.PARSONAGE_DETAILS),
    ),
  );

  const church = place('church');
  if (church) {
    const languages = (content.cultures[pastor?.culture ?? '']?.languages ?? []).filter((l) => l !== 'english');
    const preach =
      denomination === 'lutheran' && languages.length
        ? `The preaching alternates between ${languages[0]?.replace(/^./, (c) => c.toUpperCase())} and English from one Sabbath to the next.`
        : 'The Sabbath school meets before the preaching.';
    church.description = join(
      'A plain frame church; the bell was cast downriver.',
      D.CHURCH_DETAILS[denomination] ?? '',
      preach,
    );
  }

  if (service) {
    const kind = service.tags.includes('print') ? 'print' : service.tags.includes('pellar') ? 'pellar' : 'chapel';
    const sh = head('service');
    const who = sh ? `${sh.sex === 'male' ? 'Mr.' : 'Mrs.'} ${sh.family}` : 'The keeper';
    const opener: Record<string, string> = {
      print: `${who} sets the type, works the press and writes most of the paper himself.`,
      pellar: `${who} is the district's pellar, consulted for ailments and then discussed as little as possible.`,
      chapel: `${who} is a lay preacher, and holds the meetings here himself.`,
    };
    service.description = join(opener[kind], deal('service', D.SERVICE_DETAILS[kind] ?? []));
  }

  const landing = place('landing');
  if (landing)
    describe(
      'landing',
      join(
        ferryman
          ? `${ferryman.given} ${ferryman.family} keeps the flatboat and the ferry fare, which is mostly paid in kind.`
          : '',
        deal('landing', D.LANDING_DETAILS),
        'The valley road ends in a muddy track to the water.',
      ),
    );

  // Farms and fields: position, soil, water, household, stock, crop, and the one thing you remember.
  for (const [i, hk] of farmKeys.entries()) {
    const p = place(hk);
    if (!p) continue;
    const h = head(hk);
    const side = p.x < inp.creek ? 'west' : 'east';
    const band = p.y < inp.ford - 14 ? 'head' : p.y < inp.ford + 8 ? 'upper' : 'lower';
    const where = D.FARM_SITES[`${side}:${band}`] ?? (D.FARM_SITES['west:upper'] as (typeof D.FARM_SITES)[string]);
    const m = means[hk] ?? 2;
    const stock = deal(`stock:${m}`, D.LIVESTOCK[m] ?? D.LIVESTOCK[2] ?? []);
    const ch = child(hk);
    const kid = ch ? `${ch.sex === 'male' ? 'son' : 'daughter'} ${ch.given}` : '';
    const couple = !!spouse(hk) && !!h;
    const folks = !h
      ? 'A family works it'
      : couple
        ? `Mr. and Mrs. ${h.family} work it${kid ? ` with their ${kid}` : ''}; they keep ${stock}.`
        : `${h.sex === 'male' ? `Mr. ${h.family}` : `Mrs. ${h.family}, a widow,`} works it${
            kid ? ` with ${h.sex === 'male' ? 'his' : 'her'} ${kid}` : ''
          }; ${h.sex === 'male' ? 'he' : 'she'} keeps ${stock}.`;
    const hand = actors.find((a) => a.key === 'hired_hand' && a.household === hk);
    // One thing you would remember: the culture's own detail (when it has one left) or a general one.
    const culture = h?.culture ?? '';
    const cultural = D.CULTURE_DETAILS[culture];
    const memorable =
      cultural && rngFor(`memorable:${hk}`).chancePercent(60)
        ? deal(`memorable:${culture}`, cultural)
        : deal('memorable', D.FARM_MEMORABLE);
    p.description = join(
      `${where.setting}.`,
      `The soil is ${where.soil}, and the water comes from ${where.water}.`,
      i === 0
        ? 'Cold air pools in the dooryard on still mornings, and the frost comes a week before it comes to the neighbors.'
        : '',
      folks,
      i === 0 ? 'The fence is patched, and the root cellar is nearly through its winter stores.' : '',
      hand ? `A hired man, ${hand.given} ${hand.family}, sleeps in the loft.` : '',
      memorable,
    );
    const crop = D.CROPS[cropOf.get(hk) ?? 'potatoes'];
    const field = place(`field${i}`);
    if (field && crop) {
      field.description = join(
        deal(`crop:${cropOf.get(hk)}`, crop.sights),
        `The soil is ${where.soil}.`,
        i === 0
          ? 'The family can spare no part of it.'
          : deal('field_tail', [
              `It runs down from the ${fam(hk)} house toward the lane.`,
              `The ${fam(hk)} fence closes it in on three sides.`,
              `The ${fam(hk)} children are sent to pick stones from it every spring, and every spring there are more.`,
              `It lies where the ${fam(hk)} family can see it from the kitchen door.`,
            ]),
      );
    }
  }
}

/**
 * What is wrong with a town's place text, one line each: a name or description shared by two
 * places, a coordinate in either, an empty description, or unfinished-looking text. Empty when the
 * text is fit to show (QA check "place text").
 */
export function placeTextProblems(places: ReadonlyArray<Pick<PlaceDef, 'id' | 'name' | 'description'>>): string[] {
  const out: string[] = [];
  const names = new Map<string, string>();
  const descriptions = new Map<string, string>();
  for (const p of places) {
    const nameKey = p.name.toLowerCase();
    const first = names.get(nameKey);
    if (first) out.push(`${p.id} repeats the name of ${first}: "${p.name}"`);
    else names.set(nameKey, p.id);
    const dFirst = descriptions.get(p.description);
    if (p.description && dFirst) out.push(`${p.id} repeats the description of ${dFirst}`);
    else descriptions.set(p.description, p.id);
    if (!p.description.trim()) out.push(`${p.id} has no description`);
    if (/\(\s*\d+\s*,\s*\d+\s*\)/.test(`${p.name} ${p.description}`)) out.push(`${p.id} shows a coordinate`);
    if (/placeholder|awaiting|todo|lorem|\bTBD\b|consultation/i.test(`${p.name} ${p.description}`))
      out.push(`${p.id} has unfinished text`);
  }
  return out;
}
