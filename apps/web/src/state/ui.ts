/**
 * UI-only state (selection, open panels, sheet detent, chosen speed, label set, Book order).
 * OWNER: module:web. Nothing here is world state: the world changes only via Commands.
 */

import type { RoutePreview } from '@coulee/play';
import { create } from 'zustand';
import type { LabelSet } from '../lib/format.ts';
import type { SheetState } from '../lib/timePolicy.ts';
import type { Speed } from '../protocol.ts';

export type Panel =
  | 'none'
  | 'people'
  | 'pack'
  | 'book'
  | 'chronicle'
  | 'map'
  | 'dossier'
  | 'place'
  | 'act'
  | 'settings'
  | 'stack'
  | 'trade'
  | 'ledger';
export type DossierTab = 'mind' | 'needs' | 'opinions' | 'known' | 'pack';
/** Groups of the Act menu (11 §2.1), built from the session's offered actions. */
export type ActGroup =
  | 'move'
  | 'talk'
  | 'trade'
  | 'eat'
  | 'rest'
  | 'work'
  | 'errands'
  | 'pack'
  | 'signs'
  | 'aid'
  | 'read'
  | 'life';
export type LedgerTab = 'journal' | 'money' | 'signs' | 'folk' | 'places' | 'chronicle' | 'journey';

export interface OrderLine {
  defId: string;
  qty: number;
}

export interface UiState {
  selectedActor: number | null;
  selectedPlace: number | null;
  panel: Panel;
  sheet: SheetState;
  pinned: boolean;
  dossierTab: DossierTab;
  chosenSpeed: Speed;
  /** Last non-paused speed, for the play/pause toggle. */
  resumeSpeed: Speed;
  labelSet: LabelSet;
  godView: boolean;
  /**
   * Game minutes at which God view was switched on this session (11 §2.14: opt-in and
   * Chronicle-tagged). The Chronicle shows the tag so a fair account is never silently mixed.
   */
  godViewLog: number[];
  order: OrderLine[];
  bookSection: string | null;
  /** Actors under the finger when hit areas overlap (the stack chooser, 11 §2.2). */
  stack: number[];
  /** Store place whose Book is open. */
  bookPlace: number | null;
  speedsOpen: boolean;
  /** The open group of the Act menu (null: the group chooser). */
  actGroup: ActGroup | null;
  /** Talk filtered to one person (from a map peek's Talk). */
  actTarget: number | null;
  ledgerTab: LedgerTab;
  routePreview: { nodeId: string; text: string; at: number; view?: RoutePreview } | null;
  showRoute: (nodeId: string, text: string, at: number, view?: RoutePreview) => void;
  clearRoute: () => void;

  /** `fromMap`: a tap on the map opens the peek card first (11 §2.3), unless a sheet is already up. */
  selectActor: (id: number | null, opts?: { tab?: DossierTab; sheet?: SheetState; fromMap?: boolean }) => void;
  selectPlace: (id: number | null) => void;
  chooseFrom: (ids: number[]) => void;
  open: (panel: Panel, sheet?: SheetState) => void;
  close: () => void;
  setSheet: (s: SheetState) => void;
  setPinned: (p: boolean) => void;
  setTab: (t: DossierTab) => void;
  setSpeed: (s: Speed) => void;
  togglePause: () => void;
  setLabelSet: (l: LabelSet) => void;
  setGodView: (g: boolean, at?: number) => void;
  addToOrder: (defId: string, qty: number) => void;
  setOrderQty: (defId: string, qty: number) => void;
  clearOrder: () => void;
  setBookSection: (s: string | null) => void;
  openBook: (placeId: number | null) => void;
  setSpeedsOpen: (o: boolean) => void;
  /** Open the Act menu at a group (Go opens it at Move). */
  openAct: (group: ActGroup | null, target?: number | null) => void;
  setActGroup: (group: ActGroup | null) => void;
  openLedger: (tab?: LedgerTab) => void;
  setLedgerTab: (tab: LedgerTab) => void;
}

function readLabelSet(): LabelSet {
  try {
    return localStorage.getItem('coulee.labels') === 'clinical' ? 'clinical' : 'period';
  } catch {
    return 'period';
  }
}

export const useUi = create<UiState>((set, get) => ({
  selectedActor: null,
  selectedPlace: null,
  panel: 'none',
  sheet: 'closed',
  pinned: false,
  dossierTab: 'mind',
  chosenSpeed: 'paused',
  resumeSpeed: 'x1',
  labelSet: readLabelSet(),
  godView: false,
  godViewLog: [],
  order: [],
  bookSection: null,
  stack: [],
  bookPlace: null,
  speedsOpen: false,
  actGroup: null,
  actTarget: null,
  ledgerTab: 'journal',
  routePreview: null,
  showRoute: (nodeId, text, at, view) => set({ routePreview: { nodeId, text, at, ...(view ? { view } : {}) } }),
  clearRoute: () => set({ routePreview: null }),

  selectActor: (id, opts) =>
    set((s) => ({
      selectedActor: id,
      selectedPlace: id === null ? s.selectedPlace : null,
      panel: id === null ? (s.panel === 'dossier' ? 'none' : s.panel) : 'dossier',
      dossierTab: opts?.tab ?? s.dossierTab,
      sheet:
        id === null
          ? s.panel === 'dossier'
            ? 'closed'
            : s.sheet
          : (opts?.sheet ??
            (opts?.fromMap
              ? s.sheet === 'half' || s.sheet === 'full'
                ? s.sheet
                : 'peek'
              : s.sheet === 'closed' || s.sheet === 'peek'
                ? 'half'
                : s.sheet)),
    })),
  selectPlace: (id) =>
    set((s) => ({
      selectedPlace: id,
      selectedActor: id === null ? s.selectedActor : null,
      panel: id === null ? 'none' : 'place',
      sheet: id === null ? 'closed' : 'peek',
    })),
  chooseFrom: (ids) =>
    set((s) => ({
      stack: ids,
      panel: 'stack',
      sheet: s.sheet === 'half' || s.sheet === 'full' ? s.sheet : 'peek',
    })),
  open: (panel, sheet) =>
    set((s) => ({
      panel,
      sheet: panel === 'none' ? 'closed' : (sheet ?? (s.sheet === 'closed' || s.sheet === 'peek' ? 'half' : s.sheet)),
    })),
  close: () => set({ panel: 'none', sheet: 'closed', pinned: false, speedsOpen: false }),
  setSheet: (sheet) =>
    set((s) =>
      sheet === 'closed'
        ? { sheet, panel: 'none', pinned: false }
        : { sheet, pinned: sheet === 'full' ? s.pinned : false },
    ),
  setPinned: (pinned) => set({ pinned }),
  setTab: (dossierTab) => set({ dossierTab }),
  setSpeed: (chosenSpeed) =>
    set((s) => ({ chosenSpeed, resumeSpeed: chosenSpeed === 'paused' ? s.resumeSpeed : chosenSpeed })),
  togglePause: () => {
    const s = get();
    set({ chosenSpeed: s.chosenSpeed === 'paused' ? s.resumeSpeed : 'paused' });
  },
  setLabelSet: (labelSet) => {
    try {
      localStorage.setItem('coulee.labels', labelSet);
    } catch {
      // per-viewer convenience only
    }
    set({ labelSet });
  },
  setGodView: (godView, at) =>
    set((s) => ({ godView, godViewLog: godView && at !== undefined ? [...s.godViewLog, at] : s.godViewLog })),
  addToOrder: (defId, qty) =>
    set((s) => {
      const line = s.order.find((l) => l.defId === defId);
      if (line) return { order: s.order.map((l) => (l.defId === defId ? { ...l, qty: l.qty + qty } : l)) };
      return { order: [...s.order, { defId, qty }] };
    }),
  setOrderQty: (defId, qty) =>
    set((s) => ({
      order:
        qty <= 0
          ? s.order.filter((l) => l.defId !== defId)
          : s.order.map((l) => (l.defId === defId ? { ...l, qty } : l)),
    })),
  clearOrder: () => set({ order: [] }),
  setBookSection: (bookSection) => set({ bookSection }),
  openBook: (bookPlace) =>
    set((s) => ({
      bookPlace,
      bookSection: s.bookPlace === bookPlace ? s.bookSection : null,
      panel: 'book',
      sheet: s.sheet === 'closed' || s.sheet === 'peek' ? 'full' : s.sheet,
    })),
  setSpeedsOpen: (speedsOpen) => set({ speedsOpen }),
  openAct: (actGroup, actTarget = null) =>
    set((s) => ({
      panel: 'act',
      actGroup,
      actTarget,
      sheet: s.sheet === 'closed' || s.sheet === 'peek' ? 'half' : s.sheet,
    })),
  setActGroup: (actGroup) => set({ actGroup, actTarget: null }),
  openLedger: (tab) =>
    set((s) => ({
      panel: 'ledger',
      ledgerTab: tab ?? s.ledgerTab,
      sheet: s.sheet === 'closed' || s.sheet === 'peek' ? 'half' : s.sheet,
    })),
  setLedgerTab: (ledgerTab) => set({ ledgerTab }),
}));
