/**
 * UI-only state (selection, open panels, sheet detent, chosen speed, label set, Book order).
 * OWNER: module:web. Nothing here is world state: the world changes only via Commands.
 */
import { create } from 'zustand';
import type { LabelSet } from '../lib/format.ts';
import type { SheetState } from '../lib/timePolicy.ts';
import type { Speed } from '../protocol.ts';

export type Panel = 'none' | 'people' | 'pack' | 'book' | 'chronicle' | 'map' | 'dossier' | 'place';
export type DossierTab = 'mind' | 'needs' | 'opinions' | 'known' | 'pack';

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
  order: OrderLine[];
  bookSection: string | null;
  /** Store place whose Book is open. */
  bookPlace: number | null;
  speedsOpen: boolean;

  selectActor: (id: number | null, opts?: { tab?: DossierTab; sheet?: SheetState }) => void;
  selectPlace: (id: number | null) => void;
  open: (panel: Panel, sheet?: SheetState) => void;
  close: () => void;
  setSheet: (s: SheetState) => void;
  setPinned: (p: boolean) => void;
  setTab: (t: DossierTab) => void;
  setSpeed: (s: Speed) => void;
  togglePause: () => void;
  setLabelSet: (l: LabelSet) => void;
  setGodView: (g: boolean) => void;
  addToOrder: (defId: string, qty: number) => void;
  setOrderQty: (defId: string, qty: number) => void;
  clearOrder: () => void;
  setBookSection: (s: string | null) => void;
  openBook: (placeId: number | null) => void;
  setSpeedsOpen: (o: boolean) => void;
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
  order: [],
  bookSection: null,
  bookPlace: null,
  speedsOpen: false,

  selectActor: (id, opts) =>
    set((s) => ({
      selectedActor: id,
      selectedPlace: id === null ? s.selectedPlace : null,
      panel: id === null ? (s.panel === 'dossier' ? 'none' : s.panel) : 'dossier',
      dossierTab: opts?.tab ?? s.dossierTab,
      sheet: id === null ? (s.panel === 'dossier' ? 'closed' : s.sheet) : (opts?.sheet ?? (s.sheet === 'closed' || s.sheet === 'peek' ? 'half' : s.sheet)),
    })),
  selectPlace: (id) =>
    set((s) => ({
      selectedPlace: id,
      selectedActor: id === null ? s.selectedActor : null,
      panel: id === null ? 'none' : 'place',
      sheet: id === null ? 'closed' : 'peek',
    })),
  open: (panel, sheet) =>
    set((s) => ({
      panel,
      sheet: panel === 'none' ? 'closed' : (sheet ?? (s.sheet === 'closed' || s.sheet === 'peek' ? 'half' : s.sheet)),
    })),
  close: () => set({ panel: 'none', sheet: 'closed', pinned: false, speedsOpen: false }),
  setSheet: (sheet) => set((s) => (sheet === 'closed' ? { sheet, panel: 'none', pinned: false } : { sheet, pinned: sheet === 'full' ? s.pinned : false })),
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
  setGodView: (godView) => set({ godView }),
  addToOrder: (defId, qty) =>
    set((s) => {
      const line = s.order.find((l) => l.defId === defId);
      if (line) return { order: s.order.map((l) => (l.defId === defId ? { ...l, qty: l.qty + qty } : l)) };
      return { order: [...s.order, { defId, qty }] };
    }),
  setOrderQty: (defId, qty) =>
    set((s) => ({
      order: qty <= 0 ? s.order.filter((l) => l.defId !== defId) : s.order.map((l) => (l.defId === defId ? { ...l, qty } : l)),
    })),
  clearOrder: () => set({ order: [] }),
  setBookSection: (bookSection) => set({ bookSection }),
  openBook: (bookPlace) =>
    set((s) => ({ bookPlace, panel: 'book', sheet: s.sheet === 'closed' || s.sheet === 'peek' ? 'full' : s.sheet })),
  setSpeedsOpen: (speedsOpen) => set({ speedsOpen }),
}));
