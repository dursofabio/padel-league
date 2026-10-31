import type { AttentionItem, AttentionKind } from './attention';

/** Kinds that repeat once per match and read better as one block with a list inside. */
const GROUPABLE: AttentionKind[] = ['schedule-match', 'set-availability'];

export type FeedEntry =
  | { type: 'item'; item: AttentionItem }
  | { type: 'group'; kind: AttentionKind; items: AttentionItem[] };

/**
 * Collapses repeated items of a groupable kind into one group, placed where the first of them was.
 * `exclude` (the screen's primary item) always stays on its own. A kind with a single item is not grouped.
 * Input order is kept; call it once per priority group of the feed.
 */
export function groupFeed(items: AttentionItem[], exclude?: string): FeedEntry[] {
  const byKind = new Map<AttentionKind, AttentionItem[]>();
  for (const it of items)
    if (GROUPABLE.includes(it.kind) && it.id !== exclude) byKind.set(it.kind, [...(byKind.get(it.kind) ?? []), it]);

  const out: FeedEntry[] = [];
  const placed = new Set<AttentionKind>();
  for (const it of items) {
    const group = byKind.get(it.kind);
    if (!group || group.length < 2 || it.id === exclude) {
      out.push({ type: 'item', item: it });
      continue;
    }
    if (placed.has(it.kind)) continue;
    placed.add(it.kind);
    out.push({ type: 'group', kind: it.kind, items: group });
  }
  return out;
}
