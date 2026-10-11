import type { ActorView, provisions, ViewModel } from '@coulee/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { Chronicle, Dossier, People } from '../App.tsx';
import { useUi } from '../state/ui.ts';
import type { SimHandle } from '../useSim.ts';
import { SimCtx } from './ctx.ts';
import { KnownTab } from './dossier/KnownTab.tsx';
import { MindTab } from './dossier/MindTab.tsx';
import { NeedsTab } from './dossier/NeedsTab.tsx';
import { OpinionsTab } from './dossier/OpinionsTab.tsx';
import { KitSheet, ReadinessLedger } from './KitSheet.tsx';

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

afterEach(() => useUi.setState({ dossierTab: 'mind', selectedActor: null, panel: 'none' }));

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
