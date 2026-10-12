import { type PlaceDef, PlaceSchema, SiteSchema } from '@coulee/content/schema';
import { hashString32, mixKey, rng } from '@coulee/core';
import type { TownRecipe } from './types.ts';

// Stable independent layer salts: adding population draws cannot move the creek.
export const LAYERS = { terrain: 0x74657272, layout: 0x706c6174, population: 0x706f7075, tensions: 0x74656e73 };
export const randomFor = (r: TownRecipe, layer: keyof typeof LAYERS, key = '') =>
  rng(
    r.seed,
    'worldgen',
    r.genVersion,
    mixKey(LAYERS[layer], hashString32(r.regionContext ? `${r.regionContext.settlementId}:${key}` : key)),
  );

/**
 * Tavern signs, as a 5x5 table indexed by the same two draws the old word lists used, so the rest
 * of a seed's layout does not move: every cell reads like a real sign of the 1850s.
 */
const TAVERN_SIGNS = [
  ['Red Lion', 'White Horse', 'Black Bear', 'Golden Eagle', 'Green Tree'],
  ['Plow and Harrow', "Drovers' Rest", 'Wagon Wheel', 'Spread Eagle', 'Red Oak'],
  ['White Swan', 'Black Horse', 'Blue Anchor', 'Golden Ball', 'Silver Stag'],
  ['Wheat Sheaf', "Travelers' Rest", 'Rising Sun', 'Star and Garter', 'Half Moon'],
  ['Cross Keys', 'Three Crows', 'Old Oak', "Hunter's Horn", 'Black Swan'],
] as const;

export function terrain(recipe: TownRecipe) {
  const r = randomFor(recipe, 'terrain');
  const names = randomFor(recipe, 'terrain', 'names');
  const feature = names.pick([
    'Alder',
    'Bell',
    'Hazel',
    'Linden',
    'Willow',
    'Flint',
    'Maple',
    'Basswood',
    'Kettle',
    'Badger',
  ]);
  const defaultName = `${feature} ${names.pick(['Ford', 'Mills', 'Hollow', 'Crossing'])}`;
  const name = recipe.constraints?.townName ?? recipe.regionContext?.townName ?? defaultName;
  const landmarks = {
    creek: `${names.pick(['Trout', 'Coldwater', 'Otter', 'Silver', 'Rush', 'Plum'])} Creek`,
    main_street: `${names.pick(['Mill', 'Water', 'Market', 'Front'])} Street`,
    back_road: `${names.pick(['Quarry', 'Ridge', 'Prairie', 'Cove', 'Orchard'])} Road`,
  };
  if (recipe.regionContext) landmarks.creek = recipe.regionContext.creekName;
  const id = `town_v${recipe.genVersion}_${recipe.seed}${recipe.regionContext ? `_${recipe.regionContext.settlementId}` : ''}`;
  const creek = r.int(37, 43);
  const ford = r.int(26, 30);
  const onRiver = recipe.constraints?.onRiver ?? recipe.regionContext?.onRiver ?? recipe.preset === 'river';
  const site = SiteSchema.parse({
    id,
    name,
    grid: { w: 80, h: 64 },
    landmarks,
    tile_ft: 10,
    fae_intensity: 1,
    description: `${name}, a spring-fed mill village in a narrow Driftless coulee. Dolomite caps soft sandstone; a ridge road crosses the iron-shod ford.${onRiver ? ' The creek empties into the big river beside the landing.' : ' The valley road leads downstream toward the river towns.'}`,
  });
  const places: PlaceDef[] = [];
  const add = (
    key: string,
    name: string,
    kind: PlaceDef['kind'],
    x: number,
    y: number,
    w: number,
    h: number,
    tags: string[],
    description = '',
    model?: string,
    fi?: number,
  ) => {
    const p = PlaceSchema.parse({
      id: `${id}_${key}`,
      site: id,
      name,
      kind,
      x,
      y,
      w,
      h,
      tags,
      description: describePlace(name, kind, description),
      model,
      fae_intensity: fi,
    });
    places.push(p);
    return p;
  };
  add(
    'creek_upper',
    `${landmarks.creek}, upper reach`,
    'outdoor',
    creek,
    0,
    2,
    ford,
    ['water', 'creek'],
    'Cold brook-trout water; a small fall above the mill seat.',
    undefined,
    2,
  );
  add(
    'creek_lower',
    `${landmarks.creek}, lower reach`,
    'outdoor',
    creek,
    ford + 2,
    2,
    62 - ford,
    ['water', 'creek'],
    'Spring runoff carries maple leaves from the shaded coves.',
  );
  add(
    'ford',
    `${feature} Ford`,
    'outdoor',
    creek - 2,
    ford,
    6,
    2,
    ['ford', 'iron', 'water'],
    'The smith resets iron bars in the shallow gravel each spring.',
    'ford',
    0,
  );
  for (const [side, x] of [
    ['West', 1],
    ['East', 76],
  ] as const) {
    add(
      `${side.toLowerCase()}_cap`,
      `${side} limestone cap`,
      'wild',
      x,
      2,
      3,
      ford - 2,
      ['bluff', 'dolomite', 'wild'],
      'Dolomite ledges over sandstone. The road follows a break in the cap.',
      undefined,
      2,
    );
    add(
      `${side.toLowerCase()}_slope`,
      `${side} sandstone face`,
      'wild',
      x,
      ford + 3,
      3,
      31,
      ['bluff', 'sandstone', 'wild', side === 'East' ? 'goat_prairie' : 'old_growth'],
      side === 'West'
        ? 'Maple and basswood shade the north-facing cove.'
        : 'Goat prairie and pasqueflower on the warm slope.',
      undefined,
      2,
    );
  }
  add(
    'spring',
    `${names.pick(['Bellwether', 'Hollow', 'Fern', 'Hazel'])} Spring`,
    'wild',
    6,
    2,
    3,
    3,
    ['spring', 'fae', 'contact'],
    'Cold water issues at the sandstone/dolomite contact. Neighbors leave a clean saucer; nobody admits hearing the bell below the water.',
    undefined,
    3,
  );
  add(
    'bottom',
    'Coulee hay ground',
    'field',
    creek + 6,
    51,
    12,
    5,
    ['field', 'floodplain', 'coulee'],
    'Silver maple at the wet edge, last year’s hay stubble on the valley floor.',
  );
  return { site, places, creek, ford, onRiver, add };
}
export type TerrainDraft = ReturnType<typeof terrain>;

export function settlement(recipe: TownRecipe, t: TerrainDraft) {
  const r = randomFor(recipe, 'layout');
  const street = t.creek - 7;
  const add = t.add;
  // Split intersections into adjacent rectangles: even road and water footprints never overlap.
  // The two reaches of the street carry distinct names (the Go menu lists both).
  const mainStreet = t.site.landmarks?.main_street ?? 'Valley Road';
  add('street_n', `${mainStreet}, north of the ford`, 'road', street, 0, 2, t.ford, ['road']);
  add('street_s', `${mainStreet}, south of the ford`, 'road', street, t.ford + 2, 2, 62 - t.ford, ['road']);
  add('road_w', 'Coulee Road', 'road', 0, t.ford, t.creek - 2, 2, ['road']);
  add('road_e', t.site.landmarks?.back_road ?? 'Ridge road', 'road', t.creek + 4, t.ford, 76 - t.creek, 2, ['road']);
  const homes: Record<string, PlaceDef> = {};
  const building = (key: string, name: string, tag: string, x: number, y: number, model: string, w = 5, h = 4) => {
    homes[key] = add(key, name, 'building', x, y, w, h, [tag, 'home', 'workplace'], '', model);
  };
  const ys = [r.int(7, 10), r.int(17, 21), r.int(35, 40)];
  const townRoles = r.shuffleByKey(['store', 'tavern', 'school'], hashString32);
  for (const [i, role] of townRoles.entries()) {
    building(
      role,
      {
        store: r.pick(['General Store', 'Mercantile', 'Store and Outfitter']),
        tavern: `the ${TAVERN_SIGNS[r.int(0, 4)]?.[r.int(0, 4)]}`,
        school: r.pick(['District School', 'Subscription School']),
      }[role] ?? role,
      role,
      street - 6,
      ys[i] as number,
      role === 'school' ? 'schoolhouse' : role,
    );
  }
  building('smith', 'Ford Smithy', 'smithy', t.creek + 5, t.ford - 6, 'smithy', 4);
  building(
    'mill',
    `${t.site.landmarks?.creek.replace(' Creek', '')} ${r.pick(['Grist Mill', 'Flour Mill'])}`,
    'mill',
    t.creek + 3,
    6,
    'mill',
    6,
    5,
  );
  building('pastor', 'Parsonage', 'home', t.creek + 13, 35, 'house', 4, 3);
  const denomination = r.pick(['lutheran', 'methodist', 'baptist']) as string;
  homes.pastor?.tags.push(denomination);
  const churchY = r.pick([13, 35, 42]) as number;
  add(
    'church',
    `${r.pick(['Spring', 'Valley', 'Ridge'])} ${denomination[0]?.toUpperCase()}${denomination.slice(1)} ${denomination === 'methodist' ? 'Meeting House' : 'Church'}`,
    'building',
    t.creek + 5,
    churchY,
    5,
    6,
    ['church', denomination, 'workplace'],
    'A plain frame church; the bell was cast downriver.',
    'church',
  );
  const service = r.pick(['printer', 'pellar', 'meeting']);
  if (service === 'printer')
    building(
      'service',
      `${t.site.name} ${r.pick(['Gazette', 'Courier', 'Herald'])}`,
      'print',
      street - 6,
      49,
      'print_shop',
    );
  else if (service === 'pellar') building('service', 'Herb House', 'pellar', street - 6, 49, 'house');
  else building('service', 'Prayer Room', 'chapel', street - 6, 49, 'house');
  const farmCount = recipe.constraints?.farmsteads ?? r.int(3, 5);
  const farmPlots = r.shuffleByKey(
    [
      [11, 7],
      [61, 8],
      [10, 42],
      [61, 43],
      [11, 18],
    ] as const,
    ([x, y]) => x * 100 + y,
  );
  for (let i = 0; i < farmCount; i++) {
    const [x, y] = farmPlots[i] as readonly [number, number];
    // Placeholder names by where the plot lies (distinct, no coordinates); text.ts renames them
    // for their families once the households exist.
    const where = `${y < t.ford - 14 ? 'Head' : y < t.ford + 8 ? 'Upper' : 'Lower'} ${x < t.creek ? 'West' : 'East'}`;
    homes[`farm${i}`] = add(
      `farm${i}`,
      `${where} Farm`,
      'farmstead',
      x,
      y,
      5,
      4,
      ['home', 'farm', 'workplace'],
      i === 0
        ? 'A frost pocket, patched fence and a root cellar nearly through its winter stores.'
        : 'A house, garden and byre above the spring floods.',
      'farmstead',
      i === 0 ? 3 : 1,
    );
    add(
      `field${i}`,
      `${where} Fields`,
      'field',
      x + 6,
      y,
      6,
      5,
      ['field', 'farm'],
      'Potatoes held back for seed; no new crop before summer.',
    );
  }
  if (t.onRiver) {
    homes.landing = add(
      'landing',
      'River Landing',
      'landing',
      t.creek + 3,
      59,
      6,
      4,
      ['landing', 'workplace'],
      'Cordwood, a flatboat and a muddy path from the valley road.',
      'landing',
    );
  }
  return homes;
}

/** Stable local texture; no random draw that could disturb population or layout. */
export function describePlace(name: string, kind: string, authored = ''): string {
  // A stand-in until text.ts writes the real description (it knows the owners); never a coordinate.
  return authored || `${name}: a ${kind} in the valley.`;
}
