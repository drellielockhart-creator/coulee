/** Saved plain entries, total order even for the same actor at the same instant. */
export interface TimedEntry {
  instant: number;
  actorId: number;
  seq: number;
}
export const compareEntries = (a: TimedEntry, b: TimedEntry): number =>
  a.instant - b.instant || a.actorId - b.actorId || a.seq - b.seq;
export function heapPush<T extends TimedEntry>(heap: T[], entry: T): void {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const p = Math.floor((i - 1) / 2);
    if (compareEntries(heap[p] as T, entry) <= 0) break;
    heap[i] = heap[p] as T;
    i = p;
  }
  heap[i] = entry;
}
export function heapPop<T extends TimedEntry>(heap: T[]): T | undefined {
  const first = heap[0],
    last = heap.pop();
  if (!heap.length || !last) return first;
  let i = 0;
  while (i * 2 + 1 < heap.length) {
    let c = i * 2 + 1;
    if (c + 1 < heap.length && compareEntries(heap[c + 1] as T, heap[c] as T) < 0) c++;
    if (compareEntries(last, heap[c] as T) <= 0) break;
    heap[i] = heap[c] as T;
    i = c;
  }
  heap[i] = last;
  return first;
}
