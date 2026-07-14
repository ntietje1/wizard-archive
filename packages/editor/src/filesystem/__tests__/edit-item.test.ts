import { testResourceId } from '../../../../../shared/test/resource-id'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { createNote } from '../../test/sidebar-item-factory'
import { createEditFileSystemItem } from '../edit-item'
import type { FileSystemItemMetadataUpdateOperations } from '../item-operation-contracts'
import type { FileSystemPermissions } from '../permissions'

const item = createNote({
  id: testResourceId('note-1'),
  name: 'Old name',
})

const sourceMocks = vi.hoisted(() => ({
  editItem: vi.fn<FileSystemItemMetadataUpdateOperations['updateItemMetadata']>(),
}))

describe('createEditFileSystemItem', () => {
  beforeEach(() => {
    sourceMocks.editItem.mockReset()
  })

  it('updates changed metadata', async () => {
    sourceMocks.editItem.mockResolvedValue(undefined)
    const editItem = createEditFileSystemItem(createSource())

    const result = await editItem({ item, name: 'New name' })

    expect(sourceMocks.editItem).toHaveBeenCalledWith({
      item,
      name: 'New name',
      iconName: undefined,
      color: undefined,
    })
    expect(result).toBeUndefined()
  })

  it('skips unchanged metadata without requiring edit permission', async () => {
    const editItem = createEditFileSystemItem(createSource({ canMutate: false }))

    await expect(editItem({ item, name: ' Old name ' })).resolves.toBeUndefined()

    expect(sourceMocks.editItem).not.toHaveBeenCalled()
  })

  it('rejects metadata changes without edit permission', async () => {
    const editItem = createEditFileSystemItem(createSource({ canMutate: false }))

    await expect(editItem({ item, name: 'New name' })).rejects.toThrow(
      'Sidebar item editing is not supported',
    )
    await expect(editItem({ item, iconName: 'FileText' })).rejects.toThrow(
      'Sidebar item editing is not supported',
    )
    await expect(editItem({ item, color: '#ff0000' })).rejects.toThrow(
      'Sidebar item editing is not supported',
    )

    expect(sourceMocks.editItem).not.toHaveBeenCalled()
  })

  it('checks permission before normalizing a requested metadata change', async () => {
    const editItem = createEditFileSystemItem(createSource({ canMutate: false }))

    await expect(editItem({ item, name: '   ' })).rejects.toThrow(
      'Sidebar item editing is not supported',
    )

    expect(sourceMocks.editItem).not.toHaveBeenCalled()
  })

  it('allows item metadata changes when the item can be mutated independently of current item state', async () => {
    sourceMocks.editItem.mockResolvedValue(undefined)
    const editItem = createEditFileSystemItem(createSource({ canMutate: true }))

    await expect(editItem({ item, name: 'New name' })).resolves.toBeUndefined()

    expect(sourceMocks.editItem).toHaveBeenCalledExactlyOnceWith({
      item,
      name: 'New name',
      iconName: undefined,
      color: undefined,
    })
  })
})

function createSource({ canMutate = true }: { canMutate?: boolean } = {}) {
  return {
    catalog: {
      getVisibleChildren: () => [item],
    },
    operations: {
      updateItemMetadata: sourceMocks.editItem,
    },
    permissions: {
      canMutateItem: (_item, requiredLevel) => canMutate && requiredLevel === PERMISSION_LEVEL.EDIT,
    } satisfies Pick<FileSystemPermissions, 'canMutateItem'>,
  }
}
