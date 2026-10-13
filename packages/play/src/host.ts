/**
 * Host queries for graphical players (ADR 0002 UI parity; 11 §1.7 "the UI asks, the core
 * answers"). The web worker and any other host read a PlaySession through these functions:
 * the storefront for the counter the PC stands at, a buy/sell preview on a private projection,
 * and an Explain for every food number (07 §12.3 M4 acceptance #5).
 *
 * Nothing here changes the world. Every change still goes through `PlaySession.act`, and every
 * number comes from the same kernels the simulation uses (`readinessOf`, `recipesFor`,
 * `foodServings`, `dailyKcal`, `spoilageFactors`, `loadReport`, `priceAt`, `saleQuote`), so a
 * preview that says "5.1 days" is the planner's own answer (P8: the planner and the sim agree).
 */
import {
  type ActorId,
  asItemId,
  type Command,
  type ContentBundle,
  calendarAt,
  type Explain,
  type GameMinute,
  items,
  type PlaceId,
  provisions,
  rng,
  type Sim,
  type SimContext,
  term,
  type World,
} from '@coulee/core';
import { availableActions, catalogStock, validateCommand } from './actions.ts';
import type { KnownEvent } from './observation.ts';
import type { PlaySession } from './session.ts';

/** Read-only access to a session's sim for host queries. Never mutate it: act through the session. */
export function sessionSimOf(session: PlaySession): Sim {
  // Friend access within @coulee/play: the session keeps its sim private from players.
  // biome-ignore lint/complexity/useLiteralKeys: bracket access is TypeScript's sanctioned private read
  return session['sim'] as Sim;
}

/** Durable perceived deeds for view composition, including aid that creates no PC memory. */
export function sessionKnowledgeOf(session: PlaySession): readonly KnownEvent[] {
  // biome-ignore lint/complexity/useLiteralKeys: friend access within @coulee/play
  return session['knowledge'];
}

/** The figures a kit is judged by, before and after a trade. */
export interface KitNumbers {
  weightG: number;
  bulkTenths: number;
  loadBand: string;
  loadPct: number;
  capacityG: number;
  daysOfFoodTenths: number;
  kcalOnHand: number;
  kcalPerDay: number;
  daysOfFuelTenths: number | null;
  daysOfWaterTenths: number | null;
  purseCents: number;
  householdCents: number;
}

/**
 * Explains for each readiness number (and each carried food stack). Day counts are integer tenths
 * of a day, as in `Readiness`; terms whose source is `days` are tenths too, `pct` terms are rate
 * multipliers in percent and `permille` terms are per mille.
 */
export interface FoodExplains {
  daysOfFood: Explain;
  kcalOnHand: Explain;
  kcalPerDay: Explain;
  fuel: Explain;
  water: Explain;
  spoilsFirst: Explain | null;
}

export interface FoodLedger {
  readiness: provisions.Readiness;
  /** The standing ration order, percent (rations:<pct> sets it). */
  rationPct: number;
  explain: FoodExplains;
  /** What she has eaten lately (the 14-day window behind monotony and the scurvy watch); null for a pantry. */
  nutrition: Explain | null;
  /** Per carried food stack: its usable energy and its spoilage clock. */
  stacks: Record<number, { kcal: Explain; spoilage: Explain | null }>;
  /** Plain consequences of the load (03 §2.3), from the encumbrance kernel; null for a pantry. */
  load: { band: string; pct: number; capacityG: number; lines: string[] } | null;
}

export interface PrepOption {
  method: string;
  /** kcal one serving yields this way. */
  kcal: number;
  /** What the PC's own kit lacks for this preparation (empty when it can be done). */
  missing: string[];
}

export interface StoreLine {
  defId: string;
  name: string;
  section: string;
  unit: string;
  copy: string;
  priceCents: number;
  inStock: number;
  /** Per unit. */
  weightG: number;
  /** Per unit, Bulk as the catalog lists it. */
  bulk: number;
  /** Most the PC could buy now: stock and cash (credit not counted). */
  maxQty: number;
  /** The same, with the credit the keeper allows. */
  maxOnCredit: number;
  /** The offered stable action id (`buy:<defId>`), or null when buying is not on offer. */
  actionId: string | null;
  food: {
    kcal: number;
    proteinG: number;
    fatG: number;
    fresh: number;
    servings: number;
    shelfLifeDays: number;
    prep: PrepOption[];
    kcalPerLb: number;
    kcalPerDollar: number | null;
    explain: { kcal: Explain; worth: Explain };
  } | null;
}

export interface SellLine {
  itemId: number;
  defId: string;
  name: string;
  qty: number;
  unit: string;
  unitCents: number;
  weightG: number;
  actionId: string | null;
}

export interface Storefront {
  placeId: number;
  name: string;
  open: boolean;
  hours: { opens: number; closes: number } | null;
  purseCents: number;
  householdCents: number;
  creditCents: number;
  mealCents: number | null;
  bedCents: number | null;
  lines: StoreLine[];
  sell: SellLine[];
}

export type TradeOrder =
  | { kind: 'buy'; defId: string; qty: number; onCredit?: boolean }
  | { kind: 'sell'; itemId: number; qty: number };

export interface TradePreview {
  order: TradeOrder;
  /** The Command to confirm with; the host sends it back through `PlaySession.act`. */
  command: Command;
  /** Whether the session would accept it now (the same validation `act` runs). */
  ok: boolean;
  reason: string | null;
  unitCents: number;
  totalCents: number;
  before: KitNumbers;
  after: KitNumbers;
  /** Explains for the after-trade food numbers. */
  explain: FoodExplains;
  note: string;
}

const LB = 454;
/** "21,806": thousands separators without locale APIs (the same text on every device). */
const grouped = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function projectionContext(
  world: World,
  content: ContentBundle,
  commands: Command[],
  events: Array<{ kind: string; data: unknown }>,
): SimContext {
  const now = world.time as GameMinute;
  return {
    content,
    seed: world.meta.seed,
    now,
    cal: calendarAt(now),
    isNewDay: false,
    // The order itself, so the executor's agency check sees a command, as in the real hour.
    commands,
    rng: (stream, key) => rng(world.meta.seed, stream, now, key),
    emit: (event) => {
      events.push({ kind: event.kind, data: event.data });
      return 0 as never;
    },
  };
}

/**
 * A private copy for running a transaction's own kernel: items, provisions (purses, cash boxes,
 * tills, tabs) and, for credit, the social ledger are cloned; everything else is shared and only
 * read. Nothing here is ever written back.
 */
function projection(world: World, social: boolean): World {
  return {
    ...world,
    items: { counters: { ...world.items.counters }, stacks: JSON.parse(JSON.stringify(world.items.stacks)) },
    provisions: JSON.parse(JSON.stringify(world.provisions)),
    ...(social ? { social: JSON.parse(JSON.stringify(world.social)) } : {}),
  };
}

export function kitNumbers(world: World, content: ContentBundle, pc: ActorId): KitNumbers {
  const r = provisions.readinessOf(world, content, { actorId: pc }, world.time);
  const load = items.loadReport(world, content, pc);
  const householdId = world.actors[pc]?.householdId;
  return {
    weightG: load.weightG,
    bulkTenths: items.bulkTenths(world, content, items.carriedBy(pc)),
    loadBand: load.band.label,
    loadPct: load.loadPct,
    capacityG: load.capacityG,
    daysOfFoodTenths: r.daysOfFoodTenths,
    kcalOnHand: r.kcalOnHand,
    kcalPerDay: r.kcalPerDay,
    daysOfFuelTenths: r.daysOfFuelTenths,
    daysOfWaterTenths: r.daysOfWaterTenths ?? null,
    purseCents: world.provisions.purses[pc] ?? 0,
    householdCents: householdId === undefined ? 0 : (world.provisions.households[householdId]?.cashCents ?? 0),
  };
}

const formula = (
  label: string,
  subjects: ActorId[],
  terms: Explain['terms'],
  total: number,
  outcome: string,
  note?: string,
): Explain => ({
  kind: 'formula',
  label,
  subjects,
  // The PC's own kit and body: hers to know (P1).
  knowledge: 'self',
  terms,
  total: Math.round(total),
  outcome,
  ...(note ? { note } : {}),
});

function bestRecipe(world: World, content: ContentBundle, holder: provisions.ReadinessHolder, stack: items.ItemStack) {
  const recipes = provisions.recipesFor(world, content, holder, stack, 1, false);
  const usable = recipes.filter((r) => r.missing.length === 0);
  const best = usable.reduce<(typeof usable)[number] | null>((b, r) => (b === null || r.kcal > b.kcal ? r : b), null);
  return { recipes, best };
}

function spoilageExplain(world: World, content: ContentBundle, pc: ActorId, stack: items.ItemStack): Explain | null {
  const food = content.items[stack.defId]?.food;
  if (!food) return null;
  const factors = provisions.spoilageFactors(world, content, stack, calendarAt(world.time as GameMinute));
  if (!factors) return null;
  const minutes = provisions.minutesUntil(stack, food, factors.combinedPct, 1000);
  const name = content.items[stack.defId]?.name ?? stack.defId;
  const tenths = minutes === null ? 0 : Math.floor((minutes * 10) / 1440);
  return formula(
    `${name}: days until it spoils`,
    [pc],
    [
      term('item', `Shelf life at cool, dry, unpackaged: ${food.shelf_life_days} days`, food.shelf_life_days),
      term(
        'pct',
        `Kept ${factors.storage} at ${factors.storageTempF}°F, the ${factors.band} band: rate`,
        factors.tempPct,
      ),
      term('pct', factors.wet ? 'Wet: rate' : 'Dry: rate', factors.wetPct),
      ...(factors.packClasses.length
        ? factors.packClasses.map((p) => term('pct', `Packed (${p.cls.replaceAll('_', ' ')}): rate`, p.pct))
        : [term('pct', 'No protective packing: rate', 100)]),
      term('pct', 'Combined spoilage rate', factors.combinedPct),
      term('permille', 'Already spoiled (‰)', stack.spoilage),
    ],
    tenths,
    minutes === null ? 'keeps' : 'forecast',
    'Spoilage runs one integer accumulator per stack: shelf life is divided by the combined rate (temperature band × wetness × packaging), and the planner walks the real temperatures hour by hour.',
  );
}

/**
 * Food Explains for a kit (the PC's by default) or a household pantry: the same kernels
 * `readinessOf` runs. `pc` is the viewer the Explains are addressed to.
 */
export function foodLedger(
  world: World,
  content: ContentBundle,
  pc: ActorId,
  holder: provisions.ReadinessHolder = { actorId: pc },
): FoodLedger {
  const now = world.time;
  const own = 'actorId' in holder;
  const whose = own ? (holder.actorId === pc ? 'your kit' : 'their kit') : 'the household';
  const subject: ActorId = own ? holder.actorId : pc;
  const members = own
    ? [holder.actorId]
    : Object.values(world.actors)
        .filter((a) => a.alive && a.householdId === holder.householdId)
        .map((a) => a.id);
  const readiness = provisions.readinessOf(world, content, holder, now);
  const name = (defId: string) => content.items[defId]?.name ?? defId;
  const where = own ? items.carriedBy(holder.actorId) : items.pantryOf(holder.householdId);
  const carried = items.stacksDeep(world, where).map((s) => s.stack);
  const stacks: FoodLedger['stacks'] = {};
  const onHand: Explain['terms'] = [];
  let counted = 0;
  for (const stack of carried) {
    const food = content.items[stack.defId]?.food;
    if (!food) continue;
    const servings = provisions.foodServings(content, stack);
    const { recipes, best } = bestRecipe(world, content, holder, stack);
    const kcal = best ? Math.round(best.kcal * servings) : 0;
    if (servings > 0) {
      counted += kcal;
      onHand.push(
        term(
          'item',
          best
            ? `${name(stack.defId)}: ${Math.round(servings * 10) / 10} servings × ${grouped(best.kcal)} kcal (${best.steps[0]?.method ?? 'raw'})`
            : `${name(stack.defId)}: cannot be prepared here (missing ${[...new Set(recipes.flatMap((r) => r.missing))].join(', ')})`,
          kcal,
        ),
      );
    }
    stacks[stack.id] = {
      kcal: formula(
        `${name(stack.defId)}: usable energy (kcal)`,
        [subject],
        [
          term('item', `${food.kcal} kcal per ${content.items[stack.defId]?.unit ?? 'unit'} (catalog)`, food.kcal),
          term('item', `${food.servings} servings per unit`, food.servings),
          term('item', 'Servings left', Math.round(servings)),
          ...recipes.map((r) =>
            term(
              'tool',
              `${r.steps.map((s) => s.method).join(' → ')}: ${r.kcal} kcal a serving${r.missing.length ? ` (missing ${r.missing.join(', ')})` : ''}`,
              r.missing.length ? 0 : r.kcal,
            ),
          ),
        ],
        kcal,
        best ? 'usable' : 'cannot prepare',
        `Usable energy is the servings left times the best preparation ${whose} (fire, fuel, cookware, water, time) can manage now.`,
      ),
      spoilage: spoilageExplain(world, content, subject, stack),
    };
  }
  if (readiness.kcalOnHand !== counted)
    onHand.push(
      term(
        'meal',
        own ? 'Meals already being prepared' : 'Meals in the pot and a lone householder’s own pack',
        readiness.kcalOnHand - counted,
      ),
    );
  const kcalOnHand = formula(
    'Usable food on hand (kcal)',
    [subject],
    onHand,
    readiness.kcalOnHand,
    readiness.kcalOnHand > 0 ? 'on hand' : 'none',
    `Food ${whose} cannot prepare counts for nothing until it can.`,
  );
  const burns = members.map((id) => ({ id, kcal: provisions.dailyKcal(world, content, id, now) }));
  const burn = burns.reduce((sum, b) => sum + b.kcal, 0);
  const ration = own
    ? (world.provisions.nutrition[holder.actorId]?.rationPct ?? 100)
    : (world.provisions.households[holder.householdId]?.rationPct ?? 100);
  const kcalPerDay = formula(
    'Daily need at current rations (kcal)',
    [subject],
    [
      ...burns.map((b) =>
        term(
          'need',
          own
            ? 'A day’s burn: the schedule’s labor, the weather, age and build'
            : `${world.actors[b.id]?.name.given ?? 'A member'}: a day’s burn`,
          b.kcal,
        ),
      ),
      term('policy', `Ration order ${ration}%`, readiness.kcalPerDay - burn),
    ],
    readiness.kcalPerDay,
    'per day',
  );
  const simple = readiness.kcalPerDay > 0 ? Math.floor((readiness.kcalOnHand * 10) / readiness.kcalPerDay) : 0;
  const daysOfFood: Explain = {
    ...formula(
      'Days of food at current rations',
      [subject],
      [
        term(
          'days',
          `${grouped(readiness.kcalOnHand)} usable kcal ÷ ${grouped(readiness.kcalPerDay)} kcal a day`,
          simple,
        ),
        term(
          'days',
          'Hour-by-hour projection: meal sizes, preparation, spoilage on the way',
          readiness.daysOfFoodTenths - simple,
        ),
      ],
      readiness.daysOfFoodTenths,
      readiness.daysOfFoodTenths < 40 ? 'short' : 'provisioned',
      `Food lasts until the first full day whose meals reach less than half the ration. The planner runs the very meal, preparation and spoilage rules the simulation runs, on a private copy of ${whose}.`,
    ),
    children: [kcalOnHand, kcalPerDay],
  };
  const fire = items.supplyUnits(world, content, where, 'fire');
  const fuel =
    readiness.daysOfFuelTenths === null
      ? formula(
          'Cooking fuel',
          [subject],
          [term('fuel', 'Fire supply carried (minutes of burning)', fire)],
          0,
          'not needed',
          'None of the projected meals needs a fire, so fuel sets no limit.',
        )
      : formula(
          'Days of cooking fuel',
          [subject],
          [
            term('fuel', 'Fire supply carried (minutes of burning)', fire),
            term(
              'projection',
              'Minutes the first projected day burns',
              readiness.daysOfFuelTenths > 0 ? Math.round((fire * 10) / readiness.daysOfFuelTenths) : 0,
            ),
          ],
          readiness.daysOfFuelTenths,
          'forecast',
          'Fuel days are what you carry divided by what the first projected day of cooking burns.',
        );
  const waterMl = carried.reduce((n, s) => n + (s.waterMl ?? 0), 0);
  const thirst = content.needs.thirst;
  const daily = members.length * (thirst ? thirst.decay_per_hour * 24 * (thirst.intake?.per_point ?? 2) : 3000);
  const water =
    readiness.daysOfWaterTenths === null || readiness.daysOfWaterTenths === undefined
      ? formula(
          'Drinking water',
          [subject],
          [term('item', 'Water you can draw on (ml)', waterMl)],
          0,
          'replenished',
          'A spring, well or household water supply refills itself; stored water sets no limit here.',
        )
      : formula(
          'Days of stored water',
          [subject],
          [term('item', 'Water carried (ml)', waterMl), term('need', 'A day’s drinking (ml)', daily)],
          readiness.daysOfWaterTenths,
          readiness.daysOfWaterTenths < 10 ? 'short' : 'forecast',
          'Preparation (soaking, boiling) draws from the same water.',
        );
  // The stack the planner names: of that food, the one that turns soonest.
  let spoilsFirst: Explain | null = null;
  for (const s of carried)
    if (s.defId === readiness.spoilsFirst?.defId) {
      const e = stacks[s.id]?.spoilage ?? null;
      if (e && (spoilsFirst === null || e.total < spoilsFirst.total)) spoilsFirst = e;
    }
  const load = own ? items.loadReport(world, content, holder.actorId) : null;
  const n = own ? world.provisions.nutrition[holder.actorId] : undefined;
  const days = n?.history ?? [];
  const mean = (f: (d: (typeof days)[number]) => number) =>
    days.length ? Math.round(days.reduce((sum, d) => sum + f(d), 0) / days.length) : 0;
  const nutrition = !own
    ? null
    : formula(
        'What you have eaten lately',
        [subject],
        [
          term('meal', 'Today so far (kcal)', n?.today.kcal ?? 0),
          term(
            'meal',
            `Daily mean over ${days.length} recorded day${days.length === 1 ? '' : 's'} (kcal)`,
            mean((d) => d.kcal),
          ),
          term(
            'meal',
            'Protein, daily mean (g)',
            mean((d) => d.proteinG),
          ),
          term(
            'meal',
            'Fresh index, mean per serving',
            mean((d) => (d.servings ? Math.round(d.freshPoints / d.servings) : 0)),
          ),
          term('permille', 'Scurvy watch', n?.scurvy ?? 0),
          term('permille', 'Monotony: the same few foods', n?.monotony ?? 0),
          term('need', 'Days in a row without fresh food', n?.lowFreshDays ?? 0),
        ],
        n?.today.kcal ?? 0,
        (n?.scurvy ?? 0) >= 500 ? 'short of fresh food' : 'fed',
        'The last fourteen days are kept. Dead food (fresh under 10) feeds the scurvy watch; eating the same few foods day after day wears on the mind.',
      );
  return {
    readiness,
    nutrition,
    rationPct: ration,
    explain: { daysOfFood, kcalOnHand, kcalPerDay, fuel, water, spoilsFirst },
    stacks,
    load: load ? { band: load.band.label, pct: load.loadPct, capacityG: load.capacityG, lines: load.lines } : null,
  };
}

function eligibleStock(world: World, placeId: PlaceId, defId?: string): items.ItemStack[] {
  return items
    .stacksDeep(world, items.atPlace(placeId))
    .map((s) => s.stack)
    .filter(
      (s) =>
        (defId === undefined || s.defId === defId) &&
        s.condition > 0 &&
        s.spoilage < 1000 &&
        !s.partial &&
        !(s.foodPartialPm ?? 0),
    );
}

/** The counter the PC stands at: the real stock with prices, item facts and food worth. */
export function storefront(sim: Sim, pc: ActorId): Storefront | null {
  const { world: w, content: c } = sim;
  const actor = w.actors[pc];
  if (!actor) return null;
  const placeId = actor.placeId;
  const store = w.provisions.stores[placeId];
  const service = provisions.serviceAt(w, c, placeId);
  if (!store && !service) return null;
  const offered = availableActions(sim, pc);
  const offeredIds = new Set(offered.map((a) => a.id));
  const purse = w.provisions.purses[pc] ?? 0;
  const household = w.provisions.households[actor.householdId]?.cashCents ?? 0;
  const cash = purse + Math.max(0, household);
  const credit = store ? Math.max(0, store.creditLimitCents - (store.tabs[pc] ?? 0)) : 0;
  const byDef = new Map<string, { stack: items.ItemStack; qty: number }>();
  for (const s of store ? catalogStock(c, eligibleStock(w, placeId)) : []) {
    const prev = byDef.get(s.defId);
    if (prev) prev.qty += s.qty;
    else byDef.set(s.defId, { stack: s, qty: s.qty });
  }
  const lines: StoreLine[] = [];
  for (const [defId, { stack, qty }] of byDef) {
    const def = c.items[defId];
    const price = provisions.priceAt(w, c, placeId, defId);
    if (!def || price === null) continue;
    let food: StoreLine['food'] = null;
    if (def.food) {
      const f = def.food;
      const { recipes } = bestRecipe(w, c, { actorId: pc }, stack);
      const prep: PrepOption[] = recipes.map((r) => ({
        method: r.steps.map((s) => s.method).join(' → '),
        kcal: r.kcal,
        missing: r.missing,
      }));
      const kcalPerLb = def.weight_g > 0 ? Math.round((f.kcal * LB) / def.weight_g) : 0;
      const kcalPerDollar = price > 0 ? Math.round((f.kcal * 100) / price) : null;
      food = {
        kcal: f.kcal,
        proteinG: f.protein_g,
        fatG: f.fat_g,
        fresh: f.fresh,
        servings: f.servings,
        shelfLifeDays: f.shelf_life_days,
        prep,
        kcalPerLb,
        kcalPerDollar,
        explain: {
          kcal: formula(
            `${def.name}: food value per ${def.unit}`,
            [pc],
            [
              term('item', 'Energy (kcal)', f.kcal),
              term('item', 'Protein (g)', f.protein_g),
              term('item', 'Fat (g)', f.fat_g),
              term('item', 'Fresh (anti-scurvy, 0–100)', f.fresh),
              term('item', 'Servings', f.servings),
              term('item', 'Shelf life, cool and dry (days)', f.shelf_life_days),
              ...prep.map((p) =>
                term(
                  'tool',
                  `${p.method}: ${p.kcal} kcal a serving${p.missing.length ? ` — your kit lacks ${p.missing.join(', ')}` : ' — your kit can do it'}`,
                  p.kcal,
                ),
              ),
            ],
            f.kcal,
            'catalog',
            'Catalog figures from the store’s Book; preparation is checked against what you carry now.',
          ),
          worth: {
            ...formula(
              `${def.name}: weight for worth (kcal per lb)`,
              [pc],
              [
                term('item', `Energy per ${def.unit} (kcal)`, f.kcal),
                term('item', `Weight per ${def.unit} (g)`, def.weight_g),
              ],
              kcalPerLb,
              'per lb',
              `kcal × 454 ÷ grams. At ${price}¢ a ${def.unit} that is ${kcalPerDollar ?? '—'} kcal to the dollar.`,
            ),
            children: [
              formula(
                `${def.name}: kcal to the dollar`,
                [pc],
                [term('item', 'Energy (kcal)', f.kcal), term('price', 'Price here (cents)', price)],
                kcalPerDollar ?? 0,
                'per dollar',
              ),
            ],
          },
        },
      };
    }
    lines.push({
      defId,
      name: def.name,
      section: def.section ?? 'misc',
      unit: def.unit,
      copy: def.copy ?? '',
      priceCents: price,
      inStock: qty,
      weightG: def.weight_g,
      bulk: def.bulk,
      maxQty: Math.max(0, Math.min(qty, price > 0 ? Math.floor(cash / price) : qty)),
      maxOnCredit: Math.max(0, Math.min(qty, price > 0 ? Math.floor((cash + credit) / price) : qty)),
      actionId: offeredIds.has(`buy:${defId}`) ? `buy:${defId}` : null,
      food,
    });
  }
  const sell: SellLine[] = [];
  if (store)
    for (const { stack } of items.stacksDeep(w, items.carriedBy(pc))) {
      const quote = provisions.saleQuote(w, c, placeId, stack.id);
      const def = c.items[stack.defId];
      if (quote === null || !def) continue;
      sell.push({
        itemId: stack.id,
        defId: stack.defId,
        name: def.name,
        qty: stack.qty,
        unit: def.unit,
        unitCents: quote,
        weightG: def.weight_g,
        actionId: offeredIds.has(`sell:${stack.id}`) ? `sell:${stack.id}` : null,
      });
    }
  return {
    placeId,
    name: w.places[placeId]?.name ?? 'the store',
    open: provisions.storeOpen(w, c, placeId),
    hours: service ? { opens: service.opens, closes: service.closes } : null,
    purseCents: purse,
    householdCents: household,
    creditCents: credit,
    mealCents: service?.meal_cents ?? null,
    bedCents: service?.bed_cents ?? null,
    lines,
    sell,
  };
}

/** The Command a trade order confirms with (the offered action, at the chosen quantity). */
export function tradeCommand(world: World, pc: ActorId, order: TradeOrder): Command {
  const placeId = world.actors[pc]?.placeId as PlaceId;
  return order.kind === 'buy'
    ? {
        kind: 'provisions.buy',
        actorId: pc,
        data: { placeId, defId: order.defId, qty: order.qty, onCredit: order.onCredit === true },
      }
    : { kind: 'provisions.sell', actorId: pc, data: { placeId, itemId: asItemId(order.itemId), qty: order.qty } };
}

/**
 * What a buy or sell would do to the kit before it is confirmed: weight, bulk, load band, days of
 * food and cash, on a projection that moves the very stacks the transaction would move.
 */
export function tradePreview(sim: Sim, pc: ActorId, order: TradeOrder): TradePreview {
  const { world: w, content: c } = sim;
  const command = tradeCommand(w, pc, order);
  let reason: string | null;
  try {
    reason = validateCommand(sim, pc, command, availableActions(sim, pc));
  } catch {
    reason = 'Malformed order';
  }
  const before = kitNumbers(w, c, pc);
  // The transaction's own kernel on a copy: the keeper's price (at cost from one's own shelves, a
  // hard price to someone shunned), cash before credit, and the very stacks that would move.
  const p = projection(w, order.kind === 'buy' && order.onCredit === true);
  const events: Array<{ kind: string; data: unknown }> = [];
  const ctx = projectionContext(p, c, [{ ...command, issuer: { kind: 'player' } }], events);
  const placeId = w.actors[pc]?.placeId as PlaceId;
  let moved = 0;
  let totalCents = 0;
  if (order.kind === 'buy') {
    moved = provisions.purchase(p, ctx, pc, placeId, order.defId, Math.floor(order.qty), order.onCredit === true);
    const receipt = events.find((e) => e.kind === 'provisions.purchase')?.data as { priceCents: number } | undefined;
    totalCents = receipt?.priceCents ?? 0;
  } else {
    const sold = provisions.sell(p, ctx, pc, placeId, asItemId(order.itemId), Math.floor(order.qty));
    const receipt = events.find((e) => e.kind === 'provisions.sale')?.data as { priceCents: number } | undefined;
    moved = sold ? Math.floor(order.qty) : 0;
    totalCents = receipt?.priceCents ?? 0;
  }
  const unitCents =
    moved > 0
      ? Math.round(totalCents / moved)
      : order.kind === 'buy'
        ? (provisions.priceAt(w, c, placeId, order.defId) ?? 0)
        : (provisions.saleQuote(w, c, placeId, asItemId(order.itemId)) ?? 0);
  const after = kitNumbers(p, c, pc);
  return {
    order,
    command,
    ok: reason === null,
    reason,
    unitCents,
    totalCents,
    before,
    after,
    explain: foodLedger(p, c, pc).explain,
    note:
      order.kind === 'buy'
        ? 'If bought now. The purchase spends minutes; the receipt shows what the keeper charged.'
        : 'If sold now. The store pays below county retail for used goods.',
  };
}
