import { describe, expect, it, vi } from 'vite-plus/test'

import { createRuntimeTrashSource } from '../runtime-source'
import type { RuntimeTrashSourceInput } from '../runtime-source'
import { createNote } from '../../../test/sidebar-item-factory'
import { RESOURCE_STATUS } from '../../../workspace/items-persistence-contract'

describe('createRuntimeTrashSource', () => {
  it('requests empty-trash confirmation through the trash operation contract', async () => {
    const requestEmptyTrash = vi.fn()
    const source = createRuntimeTrashSource(
      createRuntime({
        operations: {
          requestDeleteItemsForever: vi.fn(),
          requestEmptyTrash,
          restoreItems: vi.fn(),
        },
      }),
    )

    await source.requestEmptyTrash()

    expect(requestEmptyTrash).toHaveBeenCalledOnce()
  })

  it('derives restore availability from the current root target capability', () => {
    const rootCapableSource = createRuntimeTrashSource(createRuntime({}))
    const rootBlockedSource = createRuntimeTrashSource(
      createRuntime({
        permissions: {
          canCreateItems: false,
          canManageFolders: false,
          canMutateItem: () => true,
        },
      }),
    )
    const trashedNote = createNote({ status: RESOURCE_STATUS.trashed })

    expect(rootCapableSource.canRestoreItem(trashedNote)).toBe(true)
    expect(rootBlockedSource.canRestoreItem(trashedNote)).toBe(false)
  })

  it('returns the typed restore result from the runtime operation', async () => {
    const result = { status: 'rejected' as const, reason: 'stale-conflict' as const }
    const restoreItems = vi.fn().mockResolvedValue(result)
    const source = createRuntimeTrashSource(
      createRuntime({
        operations: {
          requestDeleteItemsForever: vi.fn(),
          requestEmptyTrash: vi.fn(),
          restoreItems,
        },
      }),
    )
    const item = createNote({ status: RESOURCE_STATUS.trashed })

    await expect(source.restoreItems([item.id], null)).resolves.toBe(result)
  })

  it('exposes trash load errors and retry through the runtime source', async () => {
    const trashError = new Error('trash query failed')
    const refreshTrash = vi.fn().mockResolvedValue(undefined)
    const source = createRuntimeTrashSource(
      createRuntime({
        load: {
          trashError,
          refreshTrash,
          trashStatus: 'error',
        },
      }),
    )

    expect(source.getError()).toBe(trashError)
    expect(source.getStatus()).toBe('error')

    await source.refresh()

    expect(refreshTrash).toHaveBeenCalledOnce()
  })
})

function createRuntime({
  load,
  operations,
  permissions,
}: {
  load?: Partial<RuntimeTrashSourceInput['filesystem']['load']>
  operations?: {
    requestDeleteItemsForever: RuntimeTrashSourceInput['filesystem']['operations']['requestDeleteItemsForever']
    requestEmptyTrash: () => void
    restoreItems: RuntimeTrashSourceInput['filesystem']['operations']['restoreItems']
  }
  permissions?: {
    canCreateItems?: boolean
    canManageFolders?: boolean
    canMutateItem?: RuntimeTrashSourceInput['filesystem']['permissions']['canMutateItem']
  }
}): RuntimeTrashSourceInput {
  return {
    navigation: {
      current: { kind: 'trash' },
      openItem: vi.fn(),
      openTrash: vi.fn(),
    },
    filesystem: {
      catalog: {
        getKnownItemById: vi.fn(),
        getTrashedItems: () => [],
        getTrashedRoots: () => [],
      },
      load: {
        refreshTrash: vi.fn(),
        trashError: null,
        trashStatus: 'success',
        ...load,
      },
      operationItems: {
        resolveItems: () => [],
      },
      operations: {
        requestDeleteItemsForever: vi.fn(),
        requestEmptyTrash: vi.fn(),
        restoreItems: vi.fn(),
        ...operations,
      } satisfies RuntimeTrashSourceInput['filesystem']['operations'],
      permissions: {
        canEdit: true,
        canEmptyTrash: true,
        canCreateItems: true,
        canManageFolders: true,
        canMutateItem: () => true,
        ...permissions,
      },
      sharing: {
        viewAsParticipant: { status: 'unsupported', reason: 'not_available' },
      },
    },
  }
}
