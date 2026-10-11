/**
 * Typed message protocol between the UI thread and the sim worker. OWNER: module:web.
 *
 * The sim runs in a Web Worker (ADR 0001). The UI only ever receives plain-data
 * ViewModel snapshots; it never touches World directly. Player actions go in as Commands.
 */
import type { ActorId, Command, HouseholdId, provisions, ViewModel, ViewOptions } from '@coulee/core';

/** Game-hours per real second at each speed. 1× ≈ 40 real seconds per game-hour (ADR 0001). */
export const SPEEDS = { paused: 0, x1: 1 / 40, x3: 3 / 40, x6: 6 / 40, ultra: 1.5 } as const;
export type Speed = keyof typeof SPEEDS;

/**
 * Pure queries (11 §1.7 "The UI asks; the core answers"): the UI never recomputes rules.
 * Each is answered by a core module api function, filtered by viewer knowledge.
 * Extend this union as module APIs land (odds, planProvisions, loadConsequences...).
 */
export type Query = { kind: 'readiness'; holder: { actorId: ActorId } | { householdId: HouseholdId } };
export type QueryResult = { kind: 'readiness'; readiness: provisions.Readiness };

export type ToWorker =
  | { type: 'query'; id: number; query: Query }
  | { type: 'init'; scenarioId: string; seed: number; withPlayer: boolean }
  | { type: 'set_speed'; speed: Speed }
  | { type: 'step'; hours: number }
  | { type: 'command'; command: Command }
  | { type: 'set_view'; options: Partial<ViewOptions> };

export type FromWorker =
  | { type: 'ready'; scenarios: Array<{ id: string; name: string }>; contentHash: string }
  | { type: 'snapshot'; vm: ViewModel; hash: string | null; stepMs: number }
  | { type: 'query_result'; id: number; result: QueryResult }
  | { type: 'error'; message: string };
