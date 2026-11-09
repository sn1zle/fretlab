/** Move one item of a list from index `from` to index `to` (positions in the result). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const t = Math.max(0, Math.min(out.length - 1, to));
  const [x] = out.splice(from, 1);
  out.splice(t, 0, x);
  return out;
}

/** Where an index ends up after moveItem(list, from, to): the moved item and everything in between. */
export function remapIndexAfterMove(idx: number | null, from: number, to: number): number | null {
  if (idx === null) return null;
  if (idx === from) return to;
  if (from < to && idx > from && idx <= to) return idx - 1;
  if (from > to && idx >= to && idx < from) return idx + 1;
  return idx;
}

/** Display order while dragging: the dragged item shown at `to`, the others closing the gap. */
export function previewOrder(count: number, from: number, to: number): number[] {
  return moveItem(Array.from({ length: count }, (_, i) => i), from, to);
}
