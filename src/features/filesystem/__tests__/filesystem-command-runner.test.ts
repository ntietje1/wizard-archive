import { describe, expect, it, vi } from 'vitest'
import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import { assertSidebarItemName } from 'convex/sidebarItems/validation/name'
import { runFileSystemMutation } from '../filesystem-command-runner'
import { applyFileSystemPatchesToSnapshot } from '../filesystem-cache-patches'
import type { SidebarCacheSnapshot } from '../filesystem-cache-patches'
import { OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX } from '../optimistic-sidebar-items'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

function rawSidebarRow(item: ReturnType<typeof createNote>) {
  const { shares, isBookmarked, myPermissionLevel, previewUrl, isActive, isTrashed, ...row } = item
  void shares
  void isBookmarked
  void myPermissionLevel
  void previewUrl
  void isActive
  void isTrashed
  return row
}

describe('filesystem command runner', () => {
  it('rolls back optimistic rows and waits for sidebar queries to insert authoritative rows', async () => {
    const created = createNote()
    const optimistic = {
      ...created,
      _id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}create-1` as typeof created._id,
    }
    let snapshot: SidebarCacheSnapshot = { sidebar: [], trash: [] }
    const applyPatches = (patches: Array<FileSystemPatch>) => {
      snapshot = applyFileSystemPatchesToSnapshot(snapshot, patches)
    }

    const removeOptimistic: FileSystemPatch = {
      type: 'removeSidebarItem',
      itemId: optimistic._id,
      snapshot: optimistic,
    }
    const receipt = await runFileSystemMutation({
      patches: {
        apply: [{ type: 'upsertSidebarItem', item: optimistic }],
        rollback: [removeOptimistic],
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
          patches: [{ type: 'upsertSidebarItem', item: rawSidebarRow(created) }],
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
    expect(snapshot.sidebar).toEqual([])
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
