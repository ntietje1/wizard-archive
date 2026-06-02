import { describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { NOTE_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import {
  executeSurfaceDropCommand,
  resolveSidebarSurfaceDropCommand,
} from '~/features/dnd/utils/surface-drop-command'
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

  it('does not open a batch decision dialog when every surface item is rejected', async () => {
    const rejected = createNote({ status: 'trashed' })
    const setBatchDecision = vi.fn()
    const execute = vi.fn()

    await executeSurfaceDropCommand({
      command: {
        status: 'failed',
        action: 'link',
        target: { type: NOTE_EDITOR_DROP_TYPE, noteId: testId<'sidebarItems'>('note_target') },
        items: [],
        rejectedItems: [{ item: rejected, reason: 'trashed_item' }],
        label: 'Item cannot be linked',
      },
      action: 'link',
      setBatchDecision,
      execute,
      failureMessage: 'Failed to link items',
    })

    expect(setBatchDecision).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })
})
