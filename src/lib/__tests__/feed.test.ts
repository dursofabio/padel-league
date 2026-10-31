import { describe, expect, it } from 'vitest';
import type { AttentionItem, AttentionKind, Priority } from '../attention';
import { groupFeed } from '../feed';

function item(id: string, kind: AttentionKind, priority: Priority = 1): AttentionItem {
  return {
    id,
    kind,
    role: 'player',
    priority,
    deadline: null,
    refs: { tournamentId: 't', matchId: id },
    action: { type: 'navigate', to: `/t/t/partite/${id}` },
  };
}

describe('groupFeed', () => {
  it('keeps single items as they are', () => {
    const items = [item('a', 'schedule-match'), item('b', 'set-availability')];
    expect(groupFeed(items)).toEqual([
      { type: 'item', item: items[0] },
      { type: 'item', item: items[1] },
    ]);
  });

  it('collapses two or more schedule-match items into one group at the first one’s place', () => {
    const items = [item('x', 'accept-request'), item('a', 'schedule-match'), item('v', 'set-availability'), item('b', 'schedule-match')];
    expect(groupFeed(items)).toEqual([
      { type: 'item', item: items[0] },
      { type: 'group', kind: 'schedule-match', items: [items[1], items[3]] },
      { type: 'item', item: items[2] },
    ]);
  });

  it('leaves the excluded item (the primary one) out of the group', () => {
    const items = [item('a', 'schedule-match'), item('b', 'schedule-match'), item('c', 'schedule-match')];
    expect(groupFeed(items, 'a')).toEqual([
      { type: 'item', item: items[0] },
      { type: 'group', kind: 'schedule-match', items: [items[1], items[2]] },
    ]);
  });

  it('groups availability periods the same way, separately from matches', () => {
    const items = [item('a', 'schedule-match'), item('p2', 'set-availability'), item('b', 'schedule-match'), item('p3', 'set-availability')];
    expect(groupFeed(items)).toEqual([
      { type: 'group', kind: 'schedule-match', items: [items[0], items[2]] },
      { type: 'group', kind: 'set-availability', items: [items[1], items[3]] },
    ]);
  });

  it('does not group a lone schedule-match left after the exclusion', () => {
    const items = [item('a', 'schedule-match'), item('b', 'schedule-match')];
    expect(groupFeed(items, 'a')).toEqual([
      { type: 'item', item: items[0] },
      { type: 'item', item: items[1] },
    ]);
  });
});
