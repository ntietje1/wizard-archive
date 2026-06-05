import { describe, expect, it } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemName } from 'shared/sidebar-items/name'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { createFileSystemCacheAdapter } from '../filesystem-cache-adapter'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { planFileSystemReceiptEffects } from '../filesystem-receipt-effect-planner'

function createReceipt(item: AnySidebarItem): FileSystemTransactionReceipt {
  return {
    transactionId: 'transaction_1' as Id<'filesystemTransactions'>,
    direction: 'forward',
    command: {
      type: 'create',
      itemType: SIDEBAR_ITEM_TYPES.notes,
      name: 'Scene' as SidebarItemName,
      parentTarget: { kind: 'direct', parentId: null },
    },
    events: [{ type: 'created', itemId: item._id, slug: item.slug }],
    patches: [{ type: 'upsertSidebarItem', item }],
    summary: {
      kind: 'created',
      affectedCount: 1,
      createdCount: 1,
      mergedCount: 0,
      skippedCount: 0,
    },
    undoable: true,
  }
}

function createReadModel(snapshot: SidebarCacheSnapshot) {
  return createFileSystemCacheAdapter({
    get: (view) => (view === 'trash' ? snapshot.trash : snapshot.sidebar),
    update: () => {},
  }).getReadModel()
}

describe('filesystem receipt effects', () => {
  it('plans committed create selection and navigation as lifecycle intents', () => {
    const item = createNote({
      _id: 'item_1' as Id<'sidebarItems'>,
      name: 'Scene',
      slug: 'scene',
      status: SIDEBAR_ITEM_STATUS.active,
    })
    const receipt = createReceipt(item)
    const snapshot: SidebarCacheSnapshot = {
      sidebar: [item],
      trash: [],
    }

    expect(
      planFileSystemReceiptEffects({
        receipt,
        readModel: createReadModel(snapshot),
        currentSlug: null,
        selectedItemIds: [],
      }),
    ).toEqual([
      { type: 'selectItems', itemIds: ['item_1' as Id<'sidebarItems'>] },
      { type: 'navigateToItem', slug: 'scene', replace: true },
    ])
  })
})
