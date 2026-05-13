import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { resolveSidebarSurfaceDropCommand } from '~/features/dnd/utils/surface-drop-command'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function itemMap(items: Array<AnySidebarItem>) {
  return new Map<Id<'sidebarItems'>, AnySidebarItem>(items.map((item) => [item._id, item]))
}

describe('resolveSidebarSurfaceDropCommand', () => {
  it('keeps trashed dragged items so surface validation can reject them', () => {
    const active = createNote({ name: 'Active' })
    const trashed = createNote({
      name: 'Trashed',
      status: 'trashed',
    })

    expect(
      resolveSidebarSurfaceDropCommand({
        sourceData: { sidebarItemIds: [active._id, trashed._id] },
        activeItemsMap: itemMap([active]),
        trashedItemsMap: itemMap([trashed]),
        target: { type: NOTE_EDITOR_DROP_TYPE, noteId: testId<'sidebarItems'>('note_target') },
        planningContext: { campaignId: active.campaignId },
      }),
    ).toMatchObject({
      status: 'partial',
      action: 'link',
      items: [active],
      rejectedItems: [{ item: trashed, reason: 'trashed_item' }],
    })
  })
})
