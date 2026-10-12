import type { ActorView, provisions, ViewModel } from '@coulee/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Chronicle, Dossier, People } from '../App.tsx';
import { groupOf } from '../lib/play.ts';
import type { PlayState } from '../protocol.ts';
import { useUi } from '../state/ui.ts';
import type { SimHandle } from '../useSim.ts';
import { SimCtx } from './ctx.ts';
import { KnownTab } from './dossier/KnownTab.tsx';
import { MindTab } from './dossier/MindTab.tsx';
import { NeedsTab } from './dossier/NeedsTab.tsx';
import { OpinionsTab } from './dossier/OpinionsTab.tsx';
import { ExplainRow } from './ExplainView.tsx';
import { KitSheet, ReadinessLedger } from './KitSheet.tsx';
import { DigestCard, PlayPanel, useRunner, WaitControls } from './PlayPanel.tsx';
import { detentAfterDrag } from './Sheet.tsx';
import { Counter } from './Storefront.tsx';

const readiness: provisions.Readiness = {
  kcalOnHand: 0,
  kcalPerDay: 0,
  daysOfFoodTenths: 0,
  daysOfFuelTenths: null,
  spoilsFirst: null,
  unpreparable: [],
  warnings: [],
};
const actor: ActorView = {
  id: 1 as never,
  key: 'test',
  name: 'Ada North',
  shortName: 'Ada',
  sex: 'female',
  age: 28,
  people: 'Human',
  occupation: 'Traveler',
  householdId: 1 as never,
  placeId: 1 as never,
  isPlayer: true,
  alive: true,
  traits: [],
  conditions: [],
  needs: { list: [] },
  activity: {
    activityId: null,
    name: 'Idle',
    verb: 'idling',
    placeId: 1 as never,
    since: 0,
    source: 'init',
    travelingTo: null,
    arriveAt: null,
  },
  psyche: {
    visible: true,
    ego: 0,
    superego: 0,
    idAppetite: 0,
    anxiety: 0,
    thoughts: [],
    chosen: null,
    recentDefenses: [],
    persona: null,
    shadow: [],
  },
  social: { opinions: [], memories: [], relationships: [] },
  belief: { beliefs: [], grudges: [] },
  items: { carried: [], totalWeightG: 0, totalBulkTenths: 0, loadBand: 'Unburdened' },
  provisions: {
    purseCents: 0,
    readiness,
    nutrition: { kcalToday: 0, kcalAvg: 0, proteinAvgG: 0, freshAvg: 0, scurvy: 0, monotony: 0, lastMealAt: null },
  },
};
const vm = {
  playerId: actor.id,
  actors: [actor],
  places: [],
  households: [],
  time: { t: 0 },
  chronicle: { recent: [] },
} as unknown as ViewModel;
const sim = {
  vm,
  items: {},
  actions: { activities: [], interactions: [] },
  query: async () => ({ kind: 'readiness', readiness }),
} as unknown as SimHandle;
const render = (node: React.ReactNode, snapshot = vm) =>
  renderToStaticMarkup(<SimCtx.Provider value={{ ...sim, vm: snapshot }}>{node}</SimCtx.Provider>);

afterEach(() => useUi.setState({ dossierTab: 'mind', selectedActor: null, panel: 'none', godViewLog: [] }));

describe('empty module snapshots', () => {
  it('renders all dossier tabs without data or catalog entries', () => {
    expect(render(<MindTab actor={actor} />)).toContain('No thoughts are pressing');
    expect(render(<NeedsTab actor={actor} />)).toContain('No needs defined');
    expect(render(<OpinionsTab actor={actor} />)).toContain('No settled opinions');
    expect(render(<KnownTab actor={actor} />)).toContain('Nothing yet stands out');
    expect(render(<KitSheet actor={actor} />)).toContain('Nothing recorded');
    for (const dossierTab of ['mind', 'needs', 'opinions', 'known', 'pack'] as const) {
      useUi.setState({ dossierTab });
      expect(render(<Dossier actor={actor} />)).toContain('data-testid="dossier"');
    }
  });
  it('renders empty population, chronicle and core readiness without NaN or missing controls', () => {
    expect(render(<People />, { ...vm, actors: [] })).toContain('No people recorded');
    expect(render(<Chronicle />)).toContain('The ledger is quiet');
    const html = render(<ReadinessLedger readiness={readiness} />);
    expect(html).toContain('0.0 days');
    expect(html).toContain('None forecast');
    expect(html).not.toMatch(/NaN|undefined/);
  });
  it('does not render inner thoughts when the perspective hides the mind', () => {
    const hidden = {
      ...actor,
      psyche: {
        ...actor.psyche,
        visible: false,
        thoughts: [{ id: 1, voice: 'id', label: 'SECRET', intensity: 800, urge: 'eat', ageMinutes: 0 }],
      },
    };
    const html = render(<MindTab actor={hidden} />);
    expect(html).toContain('Read People');
    expect(html).not.toContain('SECRET');
  });
  it('renders the core spoil-first forecast and warnings verbatim', () => {
    const r = {
      ...readiness,
      daysOfFoodTenths: 37,
      spoilsFirst: { defId: 'trout', name: 'Trout', inDaysTenths: 4 },
      warnings: ['No fresh food'],
      unpreparable: [{ defId: 'beans', name: 'Beans', missing: ['kettle'] }],
    };
    const html = render(<ReadinessLedger readiness={r} />);
    expect(html).toContain('3.7 days');
    expect(html).toContain('Trout · 0.4 days');
    expect(html).toContain('No fresh food');
    expect(html).toContain('Beans: missing kettle');
  });
});

const store = {
  id: 5,
  name: 'Pratt & Daughter',
  kind: 'building',
  tags: ['store'],
  activity: { occupantIds: [] },
  provisions: {
    open: true,
    stock: [
      { itemId: 1, defId: 'haversack', name: 'Haversack', qty: 1, priceCents: 75 },
      { itemId: 2, defId: 'haversack', name: 'Haversack', qty: 1, priceCents: 75 },
      { itemId: 3, defId: 'flour', name: 'Flour', qty: 4, priceCents: 5 },
    ],
  },
};
const items = {
  haversack: { section: 'packs_bedding', unit: 'each', weight_g: 454, copy: 'Slung at the hip.' },
  flour: { section: 'provisions', unit: 'lb', weight_g: 454, copy: '' },
};
const withStore = { ...vm, places: [store] } as unknown as ViewModel;
const renderStore = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <SimCtx.Provider value={{ ...sim, vm: withStore, items } as unknown as SimHandle}>{node}</SimCtx.Provider>,
  );

describe('review fixes (pocket UX)', () => {
  it('keeps the Book out of the Kit Sheet: one link, no buy buttons', () => {
    const html = renderStore(<KitSheet actor={actor} />);
    expect(html).not.toContain('Buy one');
    expect(html).toContain('Pratt &amp; Daughter: the Book');
  });
  it('puts band words beside psyche numbers and opinion values, and reads ties label-first', () => {
    const mind = render(<MindTab actor={{ ...actor, psyche: { ...actor.psyche, ego: 45, anxiety: 69 } }} />);
    expect(mind).toContain('steady');
    expect(mind).toContain('calm');
    expect(mind).not.toMatch(/title="/);
    const ties = render(
      <OpinionsTab
        actor={{
          ...actor,
          social: {
            ...actor.social,
            relationships: [{ otherId: 2 as never, otherName: 'Augusta Pratt', label: 'child of' }],
            opinions: [
              {
                targetId: 2 as never,
                targetName: 'Augusta Pratt',
                label: null,
                affection: 30,
                respect: 0,
                trust: 0,
                fear: 0,
                reasons: [],
              },
            ] as never,
          },
        }}
      />,
    );
    expect(ties.indexOf('child of')).toBeLessThan(ties.indexOf('Augusta Pratt'));
    expect(ties).toContain('Warm');
    expect(ties).toContain('Neutral');
  });
  it('dossier tabs use short labels on one row, and the dossier no longer buries the orders', () => {
    const html = render(<Dossier actor={actor} />);
    for (const t of ['Mind', 'Body', 'Ties', 'Known', 'Pack']) expect(html).toContain(`>${t}<`);
    expect(html).not.toContain('Give an order');
  });
  it('People has a find field instead of the God view toggle (God view lives in Settings)', () => {
    const people = render(<People />);
    expect(people).toContain('type="search"');
    expect(people).not.toContain('God view');
    // The confirm + Chronicle tag flow is driven in scripts/screens.ts (store state is client-only).
  });
  it('sheet drags step one detent at a time; a small wobble does nothing', () => {
    expect(detentAfterDrag('peek', -60)).toBe('half');
    expect(detentAfterDrag('half', -60)).toBe('full');
    expect(detentAfterDrag('full', 80)).toBe('half');
    expect(detentAfterDrag('peek', 80)).toBe('closed');
    expect(detentAfterDrag('half', 10)).toBe('half');
  });
});

/** A small fair observation, as the worker posts it (only the fields the play panels read). */
function playState(over: Partial<PlayState['observation']> = {}): PlayState {
  const say = (id: number, speakerId: number, speaker: string, text: string) => ({
    id,
    t: 60,
    kind: 'social.interaction' as const,
    summary: 'You chat with Gussie Pratt',
    explain: null,
    speakerId,
    hearerId: speakerId === 1 ? 2 : 1,
    lines: [{ speaker, speakerId, text }],
  });
  const observation = {
    time: { t: 120, hour: 2, minute: 0, stamp: '1855-04-01 02:00' },
    mode: 'fair',
    ending: null,
    epilogue: null,
    remains: [],
    requests: [],
    signs: [],
    weather: { temperatureF: 44, raining: false, description: 'Dry' },
    place: { id: 5, name: 'Pratt & Daughter', kind: 'building', description: '', layers: [] },
    store: { stock: [], open: true, hours: { opens: 6, closes: 21 } },
    present: [{ id: 2, name: 'Gussie Pratt', people: 'Human', activity: 'keeping the shop' }],
    places: [{ id: 6, name: 'Dunleavy’s Tavern', kind: 'building', description: '' }],
    knownPeople: [],
    interactionVerbs: [],
    journal: [],
    rumors: [],
    events: [],
    said: [],
    changes: { elapsed: 0, money: [], needs: [], events: [], skipped: 0 },
    self: {
      id: 1,
      name: 'Ellis Wayfarer',
      alive: true,
      activity: { activityId: 'idle_at_home', verb: 'at home, at leisure', travelingTo: null, arriveAt: null },
      lodging: { placeId: 6, name: 'Dunleavy’s Tavern' },
      obligations: [],
      needs: { list: [], warnings: [] },
      mind: { thoughts: [], chosen: null },
      inventory: { carried: [], totalWeightG: 0, totalBulkTenths: 0, loadBand: 'Light' },
      provisions: { purseCents: 5000, householdCents: 0, readiness, nutrition: actor.provisions.nutrition },
      belief: { beliefs: [] },
    },
    actions: [
      { id: 'go:6', label: 'Go to Dunleavy’s Tavern', command: {} },
      { id: 'talk:chat:2', label: 'Chat: Gussie Pratt', command: {} },
      { id: 'activity:sleep', label: 'Sleep', command: {} },
      { id: 'retire', label: 'Retire from this life', command: {} },
    ],
    ...over,
  } as unknown as PlayState['observation'];
  return {
    observation,
    digest: {
      from: 60,
      to: 120,
      elapsed: 60,
      money: [{ at: 60, eventId: 9, purse: -25, household: 0, reason: 'a bed at Dunleavy’s Tavern' }],
      needs: ['Rest: steady → weary'],
      events: [{ id: 7, t: 60, summary: 'You arrive at Pratt & Daughter (2 min on foot)', explain: null }],
      said: [say(8, 2, 'Gussie Pratt', 'What can I get you?'), say(9, 1, 'Ellis Wayfarer', 'Good morning.')] as never,
      skipped: 2,
      stops: [],
    },
    last: null,
    mode: 'fair',
    money: [],
    steps: 3,
  };
}
const catalog = {
  activities: [{ id: 'sleep', name: 'Sleep', verb: 'sleeping', at: 'home', venue_tags: [], asleep: true, tags: [] }],
  interactions: [],
};
const renderPlay = (node: React.ReactNode, play: PlayState) =>
  renderToStaticMarkup(
    <SimCtx.Provider value={{ ...sim, vm, play, actions: catalog } as unknown as SimHandle}>{node}</SimCtx.Provider>,
  );

describe('play panels (ADR 0002 parity: the session’s own actions and words)', () => {
  it('groups the offered actions by stable id and content tags', () => {
    expect(groupOf({ id: 'go:6', label: '', command: {} as never }, catalog)).toBe('move');
    expect(groupOf({ id: 'talk:chat:2', label: '', command: {} as never }, catalog)).toBe('talk');
    expect(groupOf({ id: 'activity:sleep', label: '', command: {} as never }, catalog)).toBe('rest');
    expect(groupOf({ id: 'buy:flour', label: '', command: {} as never }, catalog)).toBe('trade');
    expect(groupOf({ id: 'eat:3:raw', label: '', command: {} as never }, catalog)).toBe('eat');
    expect(groupOf({ id: 'investigate:4:0:dawn', label: '', command: {} as never }, catalog)).toBe('signs');
    expect(groupOf({ id: 'retire', label: '', command: {} as never }, catalog)).toBe('life');
  });
  it('shows where she is, the groups on offer, and the digest with her own words first', () => {
    useUi.setState({ actGroup: null });
    const p = playState();
    // The Act panel (the Desk docks its digest under the map; Pocket shows it in the sheet).
    const html = renderPlay(
      <>
        <PlayPanel />
        <DigestCard digest={p.digest} o={p.observation} />
      </>,
      p,
    );
    expect(html).toContain('Pratt &amp; Daughter');
    expect(html).toContain('Here: Gussie Pratt');
    for (const g of ['Go', 'Talk', 'Rest &amp; wait', 'This life']) expect(html).toContain(g);
    expect(html).toContain('Since your last order');
    expect(html).toContain('−25¢ purse: a bed at Dunleavy’s Tavern');
    expect(html).toContain('Rest: steady → weary');
    expect(html.indexOf('Good morning.')).toBeLessThan(html.indexOf('What can I get you?'));
    expect(html).toContain('Passed over 2 minor conversations');
  });
  it('the wait-until controls offer the REPL’s waits, all stopped by the shared interrupts', () => {
    function Waits() {
      return <WaitControls runner={useRunner()} />;
    }
    const html = renderPlay(<Waits />, playState());
    expect(html).toContain('data-testid="waits"');
    expect(html).toContain('stops for anything that needs you');
    for (const w of ['An hour', 'Four hours', 'Till dawn', 'Till nightfall', 'Till spoken to'])
      expect(html).toContain(w);
  });
  it('a refused order says why and that no time passed', () => {
    const p = playState();
    const html = renderPlay(<PlayPanel />, {
      ...p,
      last: {
        ok: false,
        reason: 'The shop is closed',
        elapsedMinutes: 0,
        interrupts: [],
        label: 'Buy 3 lb Flour',
        t: 120,
      },
    });
    expect(html).toContain('Buy 3 lb Flour: The shop is closed. No time passed.');
  });
  it('after an ending only reading remains', () => {
    const html = renderPlay(
      <PlayPanel />,
      playState({ ending: { type: 'death', at: 100, cause: 'starvation' }, epilogue: '# Ellis\nShe came in April.' }),
    );
    expect(html).toContain('This life has ended');
    expect(html).toContain('starvation');
    expect(html).toContain('She came in April.');
    expect(html).not.toContain('Rest &amp; wait');
  });
  it('the counter lists real stock with food worth, compare and an order per line', () => {
    const explain = {
      kind: 'formula',
      label: 'x',
      subjects: [],
      knowledge: 'self',
      terms: [],
      total: 1,
      outcome: 'ok',
    };
    const html = renderPlay(
      <Counter
        wide={false}
        front={{
          placeId: 5,
          name: 'Pratt & Daughter',
          open: true,
          hours: { opens: 6, closes: 21 },
          purseCents: 5000,
          householdCents: 0,
          creditCents: 500,
          mealCents: null,
          bedCents: null,
          sell: [],
          lines: [
            {
              defId: 'hardtack',
              name: 'Hardtack',
              section: 'provisions',
              unit: 'lb',
              copy: 'Soak it.',
              priceCents: 8,
              inStock: 30,
              weightG: 454,
              bulk: 1,
              maxQty: 30,
              maxOnCredit: 30,
              actionId: 'buy:hardtack',
              food: {
                kcal: 1650,
                proteinG: 40,
                fatG: 6,
                fresh: 0,
                servings: 3,
                shelfLifeDays: 540,
                prep: [{ method: 'soak', kcal: 550, missing: ['water'] }],
                kcalPerLb: 1650,
                kcalPerDollar: 20625,
                explain: { kcal: explain as never, worth: explain as never },
              },
            },
          ],
        }}
      />,
      playState(),
    );
    expect(html).toContain('Hardtack');
    expect(html).toContain('1,650 kcal/lb · 20,625/$');
    expect(html).toContain('soak ✗ needs water');
    expect(html).toContain('keeps 540 d');
    expect(html).toContain('>Compare<');
    expect(html).toContain('Buy…');
    expect(html).toContain('Show the math');
  });
  it('an Explain row is a single full-width target and stays closed until tapped', () => {
    const html = renderToStaticMarkup(
      <ExplainRow
        k="Days of food"
        v="6.0 d"
        explain={{
          kind: 'formula',
          label: 'Days',
          subjects: [],
          knowledge: 'self',
          terms: [],
          total: 60,
          outcome: 'ok',
        }}
        totalUnit="days"
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Days of food');
    expect(html).not.toContain('class="explain');
  });
});
