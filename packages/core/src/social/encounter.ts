/**
 * Encounter sampling (04 §11.2, §13.2): no all-pairs scan.
 * OWNER: module:social.
 *
 * For an initiator in a venue pool, candidates are its top `tieSample` ties who are
 * present (by familiarity, one pass over its opinion table, which is capped at
 * `max_opinions`) plus one stranger slot (at most `strangerAttempts` random draws from the
 * pool). Cost per initiator is O(min(ties, max_opinions) + strangerAttempts), so a venue of
 * n actors costs O(n·k), never O(n²). `work` counts every candidate evaluation so tests can
 * assert the bound.
 */
import type { ActorId, Table } from '../ids.ts';
import type { Rng } from '../rng.ts';
import type { Opinion } from './state.ts';

export interface EncounterCandidate {
  id: ActorId;
  /** Sampling weight (familiarity-based; strangers get a flat weight). */
  weight: number;
  stranger: boolean;
}

export interface SampleResult {
  candidates: EncounterCandidate[];
  /** Candidate evaluations performed (the complexity counter). */
  work: number;
}

export const STRANGER_WEIGHT = 80;
export const TIE_WEIGHT_FLOOR = 100;

export function sampleCandidates(
  initiatorId: ActorId,
  ties: Table<ActorId, Opinion> | undefined,
  pool: readonly ActorId[],
  present: ReadonlySet<number>,
  available: (id: ActorId) => boolean,
  rng: Rng,
  tieSample: number,
  strangerAttempts: number,
): SampleResult {
  let work = 0;
  const top: Array<{ id: ActorId; fam: number }> = [];
  if (ties && tieSample > 0) {
    // Integer-like keys enumerate in ascending numeric order (deterministic).
    for (const k of Object.keys(ties)) {
      work++;
      const id = Number(k) as ActorId;
      if (id === initiatorId || !present.has(id) || !available(id)) continue;
      const fam = ties[id]?.familiarity ?? 0;
      // Keep the best `tieSample` by familiarity desc, then id asc (insertion sort, k small).
      let pos = top.length;
      while (pos > 0) {
        const prev = top[pos - 1] as { id: ActorId; fam: number };
        if (prev.fam > fam || (prev.fam === fam && prev.id < id)) break;
        pos--;
      }
      if (pos < tieSample) {
        top.splice(pos, 0, { id, fam });
        if (top.length > tieSample) top.pop();
      }
    }
  }
  const candidates: EncounterCandidate[] = top.map((x) => ({
    id: x.id,
    weight: TIE_WEIGHT_FLOOR + x.fam,
    stranger: false,
  }));
  if (pool.length > 1) {
    for (let a = 0; a < strangerAttempts; a++) {
      work++;
      const pick = pool[rng.int(0, pool.length - 1)] as ActorId;
      if (pick === initiatorId || ties?.[pick] !== undefined || !available(pick)) continue;
      candidates.push({ id: pick, weight: STRANGER_WEIGHT, stranger: true });
      break;
    }
  }
  return { candidates, work };
}
