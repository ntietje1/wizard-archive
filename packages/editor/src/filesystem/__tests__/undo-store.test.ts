import type { ResourceId, OperationId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'
import { shouldRecordFileSystemUndo } from '../undo-recording'
import { createFileSystemUndoStore } from '../undo-store'
import { testCampaignId } from '../../../../../shared/test/campaign-id'
import type { ResourceTransactionReceipt } from '../transaction-contract'
import { canonicalizeResourceItemTitle } from '../../workspace/items'
import { createNote } from '../../test/sidebar-item-factory'
import { createFileSystemReceipt } from './receipt-factory'
import { resourcePatchRowFromCacheItem } from '../cache-patches'
import { testOperationId } from '../../test/operation-id'

function assertNotNull<T>(value: T | null, message: string): asserts value is T {
  if (value === null) throw new Error(message)
}

describe('filesystem undo recording', () => {
  const transactionId = testOperationId('tx-1')
  const itemId = 'item-1' as ResourceId
  const workspaceId = testCampaignId('campaign-1')
  const otherWorkspaceId = testCampaignId('campaign-2')

  const receipt = ({
    id,
    name,
    direction = 'forward',
  }: {
    id: OperationId
    name: string
    direction?: ResourceTransactionReceipt['direction']
  }): ResourceTransactionReceipt => {
    const sidebarItemName = canonicalizeResourceItemTitle(name)
    const forwardPatch = {
      type: 'updateResource' as const,
      itemId,
      before: { name: canonicalizeResourceItemTitle('previous') },
      fields: { name: sidebarItemName },
    }
    return createFileSystemReceipt({
      transactionId: id,
      direction,
      command: { type: 'rename', itemId, name: sidebarItemName },
      events: [{ type: 'renamed', itemId }],
      patches: [forwardPatch],
    })
  }

  it('recognizes undoable receipts with a stored transaction', () => {
    expect(
      shouldRecordFileSystemUndo({
        transactionId,
        undoable: true,
      } satisfies Pick<ResourceTransactionReceipt, 'transactionId' | 'undoable'>),
    ).toBe(true)
  })

  it('ignores non-undoable receipts', () => {
    expect(
      shouldRecordFileSystemUndo({
        transactionId,
        undoable: false,
      } satisfies Pick<ResourceTransactionReceipt, 'transactionId' | 'undoable'>),
    ).toBe(false)
  })

  it('preserves remaining redo entries when recording a redone transaction', () => {
    const store = createFileSystemUndoStore().getState()
    const secondTransactionId = testOperationId('tx-2')
    store.setWorkspace(workspaceId)
    store.pushUndo(workspaceId, receipt({ id: transactionId, name: 'First' }))
    store.pushUndo(workspaceId, receipt({ id: secondTransactionId, name: 'Second' }))

    const secondUndo = store.peekUndo()
    assertNotNull(secondUndo, 'Expected an undo entry for tx-2')
    expect(secondUndo.transactionId).toBe(secondTransactionId)
    store.removeUndo()
    store.pushRedoEntry(secondUndo)

    const firstUndo = store.peekUndo()
    assertNotNull(firstUndo, 'Expected an undo entry for tx-1')
    expect(firstUndo.transactionId).toBe(transactionId)
    store.removeUndo()
    store.pushRedoEntry(firstUndo)

    const firstRedo = store.peekRedo()
    assertNotNull(firstRedo, 'Expected a redo entry for tx-1')
    expect(firstRedo.transactionId).toBe(transactionId)
    store.removeRedo()
    store.pushUndoEntry(firstRedo, { preserveRedo: true })

    expect(store.peekRedo()?.transactionId).toBe(secondTransactionId)
    expect(store.peekUndo()?.transactionId).toBe(transactionId)
  })

  it('stores the replay fingerprint with undoable receipts when supplied', () => {
    const created = createNote()
    const store = createFileSystemUndoStore().getState()
    store.setWorkspace(created.campaignId)
    store.pushUndo(
      created.campaignId,
      createFileSystemReceipt({
        transactionId,
        direction: 'forward',
        command: {
          type: 'create',
          resourceId: created.id,
          itemType: created.type,
          name: created.name,
          parentTarget: { kind: 'direct', parentId: created.parentId },
        },
        events: [{ type: 'created', itemId: created.id }],
        patches: [{ type: 'upsertResource', item: resourcePatchRowFromCacheItem(created) }],
      }),
      { replayFingerprint: 'graph-after-create' },
    )

    const entry = store.peekUndo()
    assertNotNull(entry, 'Expected an undo entry for the created item')
    expect(entry).toEqual({
      workspaceId: created.campaignId,
      transactionId,
      replayFingerprint: 'graph-after-create',
    })
  })

  it('moves redo entries with their transaction id intact', () => {
    const store = createFileSystemUndoStore().getState()
    store.setWorkspace(workspaceId)
    const renameReceipt = receipt({ id: transactionId, name: 'next' })
    store.pushUndo(workspaceId, renameReceipt)

    const undoEntry = store.peekUndo()
    assertNotNull(undoEntry, 'Expected undo entry')
    store.removeUndo()
    store.pushRedoEntry(undoEntry)

    const redoEntry = store.peekRedo()
    expect(redoEntry).toEqual(undoEntry)
  })

  it('ignores undo receipts from stale workspaces', () => {
    const store = createFileSystemUndoStore().getState()
    store.setWorkspace(workspaceId)

    store.pushUndo(otherWorkspaceId, receipt({ id: transactionId, name: 'stale' }))

    expect(store.peekUndo()).toBeNull()
  })

  it('isolates history stacks across store instances for the same workspace', () => {
    const firstStore = createFileSystemUndoStore()
    const secondStore = createFileSystemUndoStore()
    firstStore.getState().setWorkspace(workspaceId)
    secondStore.getState().setWorkspace(workspaceId)

    firstStore.getState().pushUndo(workspaceId, receipt({ id: transactionId, name: 'current' }))

    expect(firstStore.getState().peekUndo()?.transactionId).toBe(transactionId)
    expect(secondStore.getState().peekUndo()).toBeNull()
  })

  it('does not move stale workspace history entries into the active redo stack', () => {
    const store = createFileSystemUndoStore().getState()
    store.setWorkspace(workspaceId)
    store.pushUndo(workspaceId, receipt({ id: transactionId, name: 'current' }))
    const undoEntry = store.peekUndo()
    assertNotNull(undoEntry, 'Expected undo entry')
    store.removeUndo()

    store.setWorkspace(otherWorkspaceId)
    store.pushRedoEntry(undoEntry)

    expect(store.peekRedo()).toBeNull()
  })

  it('does not reuse stale history entries after returning to the original workspace', () => {
    const store = createFileSystemUndoStore().getState()
    store.setWorkspace(workspaceId)
    store.pushUndo(workspaceId, receipt({ id: transactionId, name: 'current' }))
    const undoEntry = store.peekUndo()
    assertNotNull(undoEntry, 'Expected undo entry')
    store.removeUndo()

    store.setWorkspace(otherWorkspaceId)
    store.setWorkspace(workspaceId)
    store.pushRedoEntry(undoEntry)

    expect(store.peekRedo()).toBeNull()
  })
})
