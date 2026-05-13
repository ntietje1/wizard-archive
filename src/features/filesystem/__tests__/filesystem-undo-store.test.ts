import { afterEach, describe, expect, it } from 'vitest'
import { shouldRecordFileSystemUndo, useFileSystemUndoStore } from '../filesystem-undo-store'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'convex/sidebarItems/filesystem/receipts'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import { SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { applyFileSystemPatchesToSnapshot } from '../filesystem-cache-patches'
import { applyFileSystemPatchesToSnapshot as applyItemPatchesToSnapshot } from 'convex/sidebarItems/filesystem/patchProjection'

function assertNotNull<T>(value: T | null, message: string): asserts value is T {
  if (value === null) throw new Error(message)
}

describe('filesystem undo recording', () => {
  const transactionId = 'tx-1' as Id<'filesystemTransactions'>
  const itemId = 'item-1' as Id<'sidebarItems'>

  afterEach(() => {
    useFileSystemUndoStore.getState().reset()
  })

  const receipt = (id: string, name: string): FileSystemTransactionReceipt => {
    const sidebarItemName = assertSidebarItemName(name)
    const forwardPatch = {
      type: 'updateSidebarItem' as const,
      itemId,
      before: { name: assertSidebarItemName('previous') },
      fields: { name: sidebarItemName },
    }
    const inversePatch = {
      type: 'updateSidebarItem' as const,
      itemId,
      before: forwardPatch.fields,
      fields: forwardPatch.before,
    }
    return {
      transactionId: id as Id<'filesystemTransactions'>,
      direction: 'forward',
      command: { type: 'rename', itemId, name: sidebarItemName },
      events: [{ type: 'renamed', itemId, slug: name, previousSlug: 'previous' }],
      patches: [forwardPatch],
      forwardPatches: [forwardPatch],
      inversePatches: [inversePatch],
      summary: {
        kind: 'renamed',
        affectedCount: 1,
        createdCount: 0,
        mergedCount: 0,
        skippedCount: 0,
      },
      undoable: true,
    }
  }

  it('records only undoable receipts with a stored transaction', () => {
    expect(
      shouldRecordFileSystemUndo({
        transactionId,
        undoable: true,
      } satisfies Pick<FileSystemTransactionReceipt, 'transactionId' | 'undoable'>),
    ).toBe(true)

    expect(
      shouldRecordFileSystemUndo({
        transactionId: null,
        undoable: true,
      } satisfies Pick<FileSystemTransactionReceipt, 'transactionId' | 'undoable'>),
    ).toBe(false)

    expect(
      shouldRecordFileSystemUndo({
        transactionId,
        undoable: false,
      } satisfies Pick<FileSystemTransactionReceipt, 'transactionId' | 'undoable'>),
    ).toBe(false)
  })

  it('preserves remaining redo entries when recording a redone transaction', () => {
    const store = useFileSystemUndoStore.getState()
    store.setCampaign('campaign-1' as Id<'campaigns'>)
    store.pushUndo(receipt('tx-1', 'First'))
    store.pushUndo(receipt('tx-2', 'Second'))

    const secondUndo = store.peekUndo()
    assertNotNull(secondUndo, 'Expected an undo entry for tx-2')
    expect(secondUndo.transactionId).toBe('tx-2')
    store.removeUndo()
    store.pushRedoEntry(secondUndo)

    const firstUndo = store.peekUndo()
    assertNotNull(firstUndo, 'Expected an undo entry for tx-1')
    expect(firstUndo.transactionId).toBe('tx-1')
    store.removeUndo()
    store.pushRedoEntry(firstUndo)

    const firstRedo = store.peekRedo()
    assertNotNull(firstRedo, 'Expected a redo entry for tx-1')
    expect(firstRedo.transactionId).toBe('tx-1')
    store.removeRedo()
    store.pushUndoEntry(firstRedo, { preserveRedo: true })

    expect(store.peekRedo()?.transactionId).toBe('tx-2')
    expect(store.peekUndo()?.transactionId).toBe('tx-1')
  })

  it('stores inverse patches that hide created rows on undo', () => {
    const created = createNote()
    const undoPatch = {
      type: 'updateSidebarItem' as const,
      itemId: created._id,
      before: {
        location: created.location,
        status: created.status,
        deletionTime: created.deletionTime,
        deletedBy: created.deletedBy,
      },
      fields: {
        location: created.location,
        status: SIDEBAR_ITEM_STATUS.undoHidden,
        deletionTime: null,
        deletedBy: null,
      },
    }
    const store = useFileSystemUndoStore.getState()
    store.setCampaign(created.campaignId)
    store.pushUndo({
      transactionId,
      direction: 'forward',
      command: {
        type: 'create',
        itemType: created.type,
        name: created.name,
        parentTarget: { kind: 'direct', parentId: created.parentId },
      },
      events: [{ type: 'created', itemId: created._id, slug: created.slug }],
      patches: [{ type: 'upsertSidebarItem', item: created }],
      forwardPatches: [{ type: 'upsertSidebarItem', item: created }],
      inversePatches: [undoPatch],
      summary: {
        kind: 'created',
        affectedCount: 1,
        createdCount: 1,
        mergedCount: 0,
        skippedCount: 0,
      },
      undoable: true,
    })

    const entry = store.peekUndo()
    assertNotNull(entry, 'Expected an undo entry for the created item')
    expect(entry.inversePatches).toEqual([undoPatch])

    store.removeUndo()
    // Created rows are hidden so redo can restore the same item id.
    const visibleProjection = applyFileSystemPatchesToSnapshot(
      { sidebar: [created], trash: [] },
      entry.inversePatches,
    )
    expect([...visibleProjection.sidebar, ...visibleProjection.trash]).not.toContainEqual(
      expect.objectContaining({ _id: created._id }),
    )
    const undone = applyItemPatchesToSnapshot({ items: [created] }, entry.inversePatches)
    const hidden = undone.items.find((item) => item._id === created._id)
    expect(hidden?.status).toBe(SIDEBAR_ITEM_STATUS.undoHidden)
    expect(hidden?.deletionTime).toBeNull()
    expect(hidden?.deletedBy).toBeNull()
  })
})
