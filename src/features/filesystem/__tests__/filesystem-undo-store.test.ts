import { afterEach, describe, expect, it } from 'vitest'
import { shouldRecordFileSystemUndo, useFileSystemUndoStore } from '../filesystem-undo-store'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { createNote } from '~/test/factories/sidebar-item-factory'

function assertNotNull<T>(value: T | null, message: string): asserts value is T {
  if (value === null) throw new Error(message)
}

describe('filesystem undo recording', () => {
  const transactionId = 'tx-1' as Id<'filesystemTransactions'>
  const itemId = 'item-1' as Id<'sidebarItems'>

  afterEach(() => {
    useFileSystemUndoStore.getState().reset()
  })

  const receipt = ({
    id,
    name,
    direction = 'forward',
  }: {
    id: string
    name: string
    direction?: FileSystemTransactionReceipt['direction']
  }): FileSystemTransactionReceipt => {
    const sidebarItemName = assertSidebarItemName(name)
    const forwardPatch = {
      type: 'updateSidebarItem' as const,
      itemId,
      before: { name: assertSidebarItemName('previous') },
      fields: { name: sidebarItemName },
    }
    return {
      transactionId: id as Id<'filesystemTransactions'>,
      direction,
      command: { type: 'rename', itemId, name: sidebarItemName },
      events: [{ type: 'renamed', itemId, slug: name, previousSlug: 'previous' }],
      patches: [forwardPatch],
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
    store.pushUndo(receipt({ id: 'tx-1', name: 'First' }))
    store.pushUndo(receipt({ id: 'tx-2', name: 'Second' }))

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

  it('stores only the transaction id for undoable receipts', () => {
    const created = createNote()
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
    expect(entry).toEqual({ transactionId })
  })

  it('moves redo entries with their transaction id intact', () => {
    const store = useFileSystemUndoStore.getState()
    const renameReceipt = receipt({ id: transactionId, name: 'next' })
    store.pushUndo(renameReceipt)

    const undoEntry = store.peekUndo()
    assertNotNull(undoEntry, 'Expected undo entry')
    store.removeUndo()
    store.pushRedoEntry(undoEntry)

    const redoEntry = store.peekRedo()
    expect(redoEntry).toEqual(undoEntry)
  })
})
