import { describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import { runFileSystemMutation } from '../filesystem-command-runner'
import { applyFileSystemPatchesToSnapshot } from '../filesystem-cache-patches'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

describe('filesystem command runner', () => {
  it('reconciles optimistic rollback and authoritative patches as one cache update', async () => {
    const created = createNote()
    let snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }
    const applyPatches = (patches: Array<FileSystemPatch>) => {
      snapshot = applyFileSystemPatchesToSnapshot(snapshot, patches)
    }

    const hideCreated: FileSystemPatch = {
      type: 'updateSidebarItem',
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
    const receipt = await runFileSystemMutation({
      patches: {
        apply: [{ type: 'upsertSidebarItem', item: created }],
        rollback: [hideCreated],
      },
      applyPatches,
      mutate: () =>
        Promise.resolve({
          transactionId: testId<'filesystemTransactions'>('transaction_1'),
          direction: 'redo',
          command: {
            type: 'create',
            itemType: created.type,
            name: assertSidebarItemName(created.name),
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
        }),
      onSuccess: vi.fn(),
      onError: vi.fn(),
    })

    expect(receipt).not.toBeNull()
    expect(snapshot.sidebar).toEqual([expect.objectContaining({ _id: created._id })])
  })

  it('reports success-side failures instead of silently treating the command as complete', async () => {
    const created = createNote()
    const onError = vi.fn()
    const receipt = await runFileSystemMutation({
      patches: {
        apply: [],
        rollback: [],
      },
      applyPatches: vi.fn(),
      mutate: () =>
        Promise.resolve({
          transactionId: testId<'filesystemTransactions'>('transaction_2'),
          direction: 'forward',
          command: {
            type: 'create',
            itemType: created.type,
            name: assertSidebarItemName(created.name),
            parentTarget: { kind: 'direct', parentId: created.parentId },
          },
          events: [{ type: 'created', itemId: created._id, slug: created.slug }],
          patches: [],
          summary: {
            kind: 'created',
            affectedCount: 1,
            createdCount: 1,
            mergedCount: 0,
            skippedCount: 0,
          },
          undoable: true,
        }),
      onSuccess: () => {
        throw new Error('side effect failed')
      },
      onError,
    })

    expect(receipt).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'side effect failed' }))
  })
})
