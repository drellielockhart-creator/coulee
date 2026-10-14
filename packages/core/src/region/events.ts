import type { EventOf } from '../events/base.ts';
export type RegionEvent = EventOf<
  'region.fact',
  { key: string; site: string; kind: string; text: string; amount: number }
>;
