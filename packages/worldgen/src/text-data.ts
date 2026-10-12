/**
 * Word stock for generated place names and descriptions (ADR 0003; wave 5 group D). Plain data:
 * the grammar that combines it lives in text.ts. Everything here is something a newcomer could
 * see or be told on the spot; fae knowledge belongs in the omen and rumor layers, never in a
 * place's base text. No coordinates, no meta text, no people but settlers and their neighbors.
 *
 * A pool is written so that each entry stands alone as a sentence (capitalized, with its period),
 * and so that a town never uses the same entry twice (text.ts deals each pool out without
 * replacement), which is what keeps twin places from reading alike.
 */

/** The one thing you would remember about a farm, whoever lives there. */
export const FARM_MEMORABLE: readonly string[] = [
  'A lightning-split butternut stands in the dooryard, and nobody has had the heart to cut it down.',
  'The well sweep groans across the whole yard on a windy day.',
  'Five bee gums stand in a row along the south fence, and the children are forbidden the end one.',
  'A grindstone worn to a crescent sits by the woodshed, with a bucket under the drip.',
  'The cellar door is painted blue, the only paint on the place.',
  'The rail fence zigzags down to the road, and every third rail is a different wood.',
  'Hollyhocks crowd the porch, grown from seed carried across the lake in a handkerchief.',
  'A rooster of no known age commands the dooryard and has opinions about visitors.',
  'The dog lies in the lane, and the lane goes around him.',
  'The barn is bigger than the house, and the family says so before you can.',
  'Washing flaps on the line every Monday, whatever the weather.',
  'A quarter-acre pile of fieldstones waits beside the pasture to become a wall.',
  'The smokehouse chimney leans, and the family will tell you it has leaned since the day it was built.',
  'Boards for a second story have been stacked under the eaves since last fall, going gray.',
  'A grapevine over the door was brought as a cutting from Ohio and has outgrown the porch.',
  'A row of milk pans is always upside down on the fence, shining.',
  'The woodpile is stacked in a neat round like a haycock, and the children are proud of it.',
  'Somebody has whitewashed the stones along the path, and the effect is out of all proportion to the house.',
  'A tin horn hangs from the porch post and is blown to call the family in from the far field.',
  'A mule stands in the near paddock and has been known to follow strangers to the road.',
  'There is a swing on the old oak that nobody over fourteen will admit to using.',
];

/** What a kind of household keeps about the house: observable things, nothing guessed at. */
export const CULTURE_DETAILS: Readonly<Record<string, readonly string[]>> = {
  yankee: [
    'A clock from a Connecticut shop ticks on the kitchen shelf, and the family sets it by the mill whistle.',
    'A lilac by the door was dug up from a Vermont dooryard and carried west in a barrel.',
    'The fence is whitewashed, and kept so, against all sense.',
    'A shelf of almanacs and a hymnal share the mantel with a brass lamp.',
  ],
  norwegian: [
    'A loom takes up half the front room, and the cloth on it is never idle.',
    'A painted chest from the old country sits at the foot of the best bed.',
    'The coffeepot is never off the stove, and visitors are not asked whether they want any.',
    'Flatbread dries on a rack above the stove, and the porch is swept every morning.',
  ],
  german: [
    'Geraniums crowd the front window, wintered over on the sill.',
    'A bake oven stands in the yard, and the whole neighborhood knows what day it is fired.',
    'A grapevine on a trellis shades the back step, trained with German exactness.',
    'The cellar smells of sauerkraut and apples, and the barrels are chalked with the month they were put up.',
  ],
  cornish: [
    "A miner's dinner pail hangs on a peg by the door, scrubbed bright.",
    'The chimney and doorstep are whitewashed every spring, and the step is scoured on Saturdays.',
    'A hymnbook, worn soft at the corners, lies on the sill where the light is best.',
    'There is always a pot of strong tea on the hob, and a cup is poured before a visitor has said what brings him.',
  ],
  irish: [
    "A small picture of the Virgin hangs by the kitchen door, with a sprig of last Easter's palm behind it.",
    'The table is scrubbed white, and the dresser holds more plates than the family has ever used at once.',
    'A flax wheel stands idle in the corner, and a fiddle hangs above it.',
  ],
  black_ohio: [
    'A smokehouse stands behind the kitchen, and the garden is fenced against deer, and kept like a ledger.',
    'A school slate hangs by the door, and the Bible and the account book share a shelf.',
    'The brick chimney was laid by the owner himself, and it draws better than any in the district.',
    'The fences are sound, the gate swings true, and the barn door has never once been left open.',
  ],
  elf_hall: [
    'A small hand-bell hangs by the door, and a line of salt lies across the sill.',
    'A twice-baked rye loaf sits on the shelf, wrapped in a cloth against a journey nobody has announced.',
    'The yard is so orderly that visitors wipe their feet without being told.',
    'The garden is planted in careful squares, with every herb labeled in a fine hand.',
  ],
  goblin_pare: [
    'A cellar cut deep into the hillside keeps everything cool far into summer.',
    'The tools hang in order of size on the wall, each on its own painted outline.',
  ],
};

/** Crops by the staple a culture eats: [name of the ground, what you see]. */
export const CROPS: Readonly<Record<string, { ground: string; sights: readonly string[] }>> = {
  potatoes: {
    ground: 'Potato Ground',
    sights: [
      'Potatoes in long ridged rows, with the seed tubers kept back in the cellar each spring.',
      'Potato hills run down the slope, banked against the wash, and a kitchen garden is fenced into one corner.',
    ],
  },
  cornmeal: {
    ground: 'Corn Field',
    sights: [
      'Corn planted in hills among the stumps, with pumpkins sprawling between the rows.',
      'Dent corn in squared rows, the stalks stacked in shocks come fall.',
    ],
  },
  flour: {
    ground: 'Wheat Field',
    sights: [
      'Wheat on the best of the ground, broadcast by hand and cradled at harvest, with oats on the rest for the team.',
      'A small wheat field, a smaller one of oats, and a kitchen garden between them and the house.',
    ],
  },
  beans_dry: {
    ground: 'Bean Patch',
    sights: [
      'Pole beans on hazel brush, and squash on the mounds between.',
      'A long bean patch with peas along the fence, picked and dried each fall for the winter pot.',
    ],
  },
  dried_apples: {
    ground: 'Orchard',
    sights: [
      'Young apple trees set in rows, the trunks wrapped against mice, with a kitchen garden under them.',
      'An orchard of grafted apples, whitewashed to the knee, and the drying racks propped against the fence.',
    ],
  },
  cheese: {
    ground: 'Dairy Pasture',
    sights: [
      'A fenced pasture worn into cow paths, with a trough fed from a springhouse pipe at the low corner.',
      'Pasture cropped short by the milk cows, and a cheese press standing under the shed roof.',
    ],
  },
};

/** What a farm keeps, by how well it is doing (the household's means, 1 thin to 4 comfortable). */
export const LIVESTOCK: Readonly<Record<number, readonly string[]>> = {
  1: [
    'a single cow, a shoat in a pen, and no team to speak of',
    'a cow, a handful of hens, and a borrowed yoke at plowing',
    'one cow, a few sheep, and a mule they cannot afford to lose',
  ],
  2: [
    'a cow, a yoke of oxen and a pen of hogs',
    'two cows, a flock of sheep, and a team shared with a neighbor',
    'a cow, a pair of steers and more hens than anyone has counted',
    'a yoke of oxen, three cows and a sow that rules the barnyard',
    'two cows, a mare past her best, and a pen of hogs that gets out',
  ],
  3: [
    'a team of horses, two cows and a flock of sheep',
    'a pair of horses, a few cows and a smokehouse always in use',
    'a good team, three cows and a flock of geese',
    'a yoke of oxen, a driving horse and a dairy of four cows',
    'a team of grays, a few hogs and a flock of sheep for the wool',
  ],
  4: [
    'a good team, a dairy of six cows and a barn that has seen a second coat of paint',
    'two teams, a herd of cattle and a hay barn that dwarfs the house',
    'a pair of matched horses, a dairy herd and a sheep pasture that pays for the rest',
    'a team of grays, eight cows and a flock of sheep that is the envy of the creek',
    'a driving horse and buggy, two work teams and a herd the neighbors count each spring',
  ],
};

/** Aspect, soil and water of a farm by where it stands: side of the coulee, and how far up. */
export const FARM_SITES: Readonly<Record<string, { setting: string; soil: string; water: string }>> = {
  'west:head': {
    setting: 'Under the west bluff near the head of the coulee, where the sun comes late and the frost stays late',
    soil: 'thin and stony over the cap rock',
    water: 'a seep that runs a little all summer',
  },
  'west:upper': {
    setting: 'On a bench of the west slope, facing the morning',
    soil: 'silt loam, the best-drained on this side',
    water: 'a dug well on the bench',
  },
  'west:lower': {
    setting: "At the foot of the west slope, a field's width above the hay ground",
    soil: 'heavy and rich, slow to dry in spring',
    water: 'a shallow well that turns brackish in a dry August',
  },
  'east:head': {
    setting: 'On a shelf under the east rim, with the afternoon sun full on the roof',
    soil: 'light and sandy, quick to warm and quick to dry out',
    water: 'a well dug forty feet through sandstone',
  },
  'east:upper': {
    setting: 'On the east slope, looking across the valley at the sunrise bluff',
    soil: 'light loam over sandstone, easy to plow and easy to lose',
    water: 'a well dug forty feet through sandstone',
  },
  'east:lower': {
    setting: 'Low on the east side, near enough to the bottoms to smell them in August',
    soil: 'black bottom loam that floods in a wet spring',
    water: 'a hand-dug well near the bottoms',
  },
};

export const STREET_SURFACES: readonly string[] = [
  'Plank walks run in front of the larger buildings and give out at the edges.',
  'Corduroy logs bridge the wet places, and the ruts between them hold water for weeks.',
  'Wheel ruts cut deep in spring and bake hard by July.',
  'A split-log footway runs along the west side, worn pale in the middle.',
  'Stumps still stand in the roadbed where nobody has found the time to pull them.',
  'Hitching rails line the stretch where the stores and the tavern stand, and the posts are chewed.',
];

/** The first word of the main street's name, and what it says about the place. */
export const STREET_CHARACTER: Readonly<Record<string, string>> = {
  Mill: 'The mill wagons keep it cut to ribbons.',
  Water: 'The creek runs close beside it, and the low places stay wet well into the summer.',
  Market: 'Farm wagons line it on market days, tongues propped on the rail.',
  Front: 'Every house on it turns its face to the creek.',
};

/** The first word of the back road's name, and what it says about the road. */
export const ROAD_CHARACTER: Readonly<Record<string, string>> = {
  Quarry: 'Chips of limestone from the quarry crunch under the wheels.',
  Ridge: 'It climbs to the ridge in two long switchbacks, and teams rest at the turn.',
  Prairie: 'At the top it comes out onto open prairie, where the wind has nothing to stop it.',
  Cove: 'It runs through a shaded cove where the road stays wet long after the rest has dried.',
  Orchard: 'Apple trees from an abandoned clearing still line one side, bearing for whoever gets there first.',
};

export const FORD_DETAILS: readonly string[] = [
  'Teamsters let their horses drink here before they climb the ridge.',
  'A flat stone in midstream serves the washing women as a bench.',
  'Boys fish the tail of the riffle for chub and are told to stop.',
  'The wheel tracks of every season show in the gravel after a dry spell.',
  'Drovers stop their cattle on the upstream bank and let them drink their fill before the crossing.',
  'A plank footbridge crosses a little above the ford, and the boys wade anyway.',
];

export const FORD_DEPTHS: readonly string[] = [
  'Knee-deep for a horse in April and ankle-deep by August.',
  'The water comes to the hubs at spring runoff and turns to a trickle in a dry fall.',
  'Gravel bottom, a hand deep in summer and hock-deep after rain.',
];

export const UPPER_CREEK_DETAILS: readonly string[] = [
  'Watercress grows thick at the seeps, and the children are sent for it.',
  'Alder tangles shade the banks, and a footlog crosses where the trout lie.',
  'The pools below the fall hold the biggest trout, and the oldest boys know which.',
  'Moss and fern hang over the cut banks, and the water stays cold into July.',
];

export const LOWER_CREEK_DETAILS: readonly string[] = [
  'It runs silty after rain and clears in two days.',
  'The deep pools below the riffles hold chub, redhorse and the odd sunfish.',
  'Cottonwoods lean over the lower banks, shedding white fluff in June.',
  'Cattle have worn the banks to mud at every crossing.',
];

export const WEST_CAP: readonly string[] = [
  'Red cedar hangs from the ledges and catches the first sun, and lichen spreads in orange coins across the stone.',
  'Turkey vultures roost on the ledges and leave at sunrise, one at a time.',
  'The village chimneys can be counted from the lip on a still morning.',
];
export const EAST_CAP: readonly string[] = [
  'The ledges bake all afternoon, and timber rattlers lie out on the sunny shelves.',
  'The stone stays hot until dusk, and swallows nest in the soft rock below it.',
  'A lone white pine stands on the edge and can be seen from the ford.',
];

export const WEST_SLOPE: readonly string[] = [
  'Fern and moss hang on the sandstone, and the leaf mold is deep enough to lose a boot.',
  'Names and dates have been cut in the soft stone by surveyors and idle boys.',
  'Ginseng hunters know this slope, and say nothing of where they dig.',
];
export const EAST_SLOPE: readonly string[] = [
  'Little bluestem and coneflower grow in the thin soil, and the cattle graze the lower end.',
  'The slope is so steep that the hay is cut by hand and rolled down to the wagons.',
  'Prickly pear grows on the dry ledges, an odd thing in a country of maples.',
];

export const SPRING_DETAILS: readonly string[] = [
  'A path worn by buckets runs down to it.',
  'A hollowed log serves as the trough, and a tin dipper hangs from a peg.',
  'Watercress rings the pool, and the stones around it are slick with moss.',
];

export const HAY_GROUND: readonly string[] = [
  'It is mowed in July by whoever gets there first.',
  'The wet corner stays wet all summer and grows sedge instead of hay.',
  'Teams cross it in dry weather and sink in wet, and everyone knows which is which.',
];

export const STORE_DETAILS: readonly string[] = [
  'Barrels of nails and salt stand on the porch.',
  'A bench by the door has been worn smooth by the old men, who do not get up for anyone.',
  'The sign was painted by the schoolmaster, and one letter was added later in a different hand.',
  'A pair of brass scales sits on the counter, and every customer watches the beam.',
  'Bolts of calico are stacked in the window, faded on the side the sun reaches.',
];

export const SMITH_DETAILS: readonly string[] = [
  'A heap of worn plowshares waits by the door for the spring rush.',
  'The anvil is so old it has a hollow worn in its face, and the smith will not hear of replacing it.',
  'The ring of the hammer carries to the ford and sets the dogs off.',
  'A tire platform stands in the yard, and the wagon wheels waiting on it are stacked like cheeses.',
];

export const MILL_DETAILS: readonly string[] = [
  "Meal dust whitens the floor, the cats and the miller's eyebrows.",
  'A clapper on the hopper chatters when the grain runs low.',
  'The stones are French burrs, shipped from Milwaukee, and the miller tells you the price unprompted.',
  "The toll box by the door is kept locked, and the key hangs round the miller's neck.",
];

export const TAVERN_DETAILS: readonly string[] = [
  'The porch roof sags at one corner, and a prop has stood under it so long it has put out roots.',
  'The yard behind holds a stable, a woodshed and a well, and a bell for the hostler.',
  'A boot scraper at the door is shaped like a dog, and every drover has a view on it.',
  'A brass lantern on a post is lit at dusk, and the traffic seems to find it.',
];

export const SCHOOL_DETAILS: readonly string[] = [
  'A box stove, a water pail with a common dipper and rows of split-log benches.',
  'A recitation bench stands at the front, and slates hang from nails by the door.',
  "Scholars' names are carved on every desk, and some are carved twice.",
];

export const LANDING_DETAILS: readonly string[] = [
  'Cordwood is racked for the steamboats, and the smell of woodsmoke hangs over the bank.',
  'A muddy path runs up from the valley road, and the boards laid across it have sunk.',
  'A flatboat rides at the bank, tied with a rope as thick as a wrist.',
];

export const CHURCH_DETAILS: Readonly<Record<string, string>> = {
  lutheran: 'Plain wooden pews face a painted altar rail, and the hymn numbers are chalked on a board.',
  methodist:
    'The benches are bare boards, and a class meeting gathers on Thursday evenings after the Sabbath preaching.',
  baptist: 'The congregation baptizes in the creek below the ford, and the whole district turns out to watch.',
};

export const PARSONAGE_DETAILS: readonly string[] = [
  'The study holds more books than the rest of the district put together, and the yard holds a church-lent cow.',
  'A tidy yard, a small garden, and a study window with a lamp in it long after the rest of the village is dark.',
];

export const SERVICE_DETAILS: Readonly<Record<string, readonly string[]>> = {
  print: [
    "The press stands in the front room under a skylight, and the type cases are ranged along the wall like drawers in a chemist's.",
    'Subscribers pay in cordwood and cornmeal as often as coin, and the loft smells of both.',
  ],
  pellar: [
    'Bundles of dried herbs hang from the beams, and stoppered bottles stand along the sill.',
    'People come by the back door for warts, fevers and sick cattle, and mostly say they were passing.',
  ],
  chapel: [
    'A bare room with plain benches and a table; prayer meetings are held on weekday evenings.',
    'A lamp is kept lit in the window for the evening meetings, and the benches are always more than the congregation needs.',
  ],
};
