import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { resolveAssetsFolderId } from '~/features/filesystem/filesystem-assets-folder-resolver'
import { testId } from '~/test/helpers/test-id'
import { useAssetsFolder } from '~/features/filesystem/filesystem-assets-folder'

type ResolveAssetsFolderInput = Parameters<typeof resolveAssetsFolderId>[0]
type AssetsFolderItem = ResolveAssetsFolderInput['rootItems'][number]
type CreateAssetsFolder = ResolveAssetsFolderInput['createItem']
type ActiveSidebarItemsState = Pick<
  ReturnType<typeof useActiveSidebarItems>,
  'data' | 'error' | 'status'
>

const activeSidebarItemsState = vi.hoisted(() => ({
  current: {
    status: 'success',
    data: [] as Array<AssetsFolderItem>,
    error: null,
  } as ActiveSidebarItemsState,
}))
const cachedActiveItems = vi.hoisted(() => ({
  current: [] as Array<AssetsFolderItem>,
}))
const createFileSystemItem = vi.hoisted(() => ({
  current: vi.fn<CreateAssetsFolder>(),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () =>
    activeSidebarItemsState.current as ReturnType<typeof useActiveSidebarItems>,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItemsCache', () => ({
  useSidebarItemsCache: () => ({
    get: () => cachedActiveItems.current,
  }),
}))

vi.mock('~/features/filesystem/useCreateFileSystemItem', () => ({
  useCreateFileSystemItem: () => ({ createItem: createFileSystemItem.current }),
}))

function createItemMock(): ReturnType<typeof vi.fn<CreateAssetsFolder>> {
  return vi.fn<CreateAssetsFolder>()
}

function assetsFolderItem(): AssetsFolderItem {
  return {
    _id: testId('assets-id'),
    type: SIDEBAR_ITEM_TYPES.folders,
    name: 'Assets',
    parentId: null,
  }
}

beforeEach(() => {
  activeSidebarItemsState.current = {
    status: 'success',
    data: [],
    error: null,
  } as ActiveSidebarItemsState
  cachedActiveItems.current = []
  createFileSystemItem.current = createItemMock()
})

describe('resolveAssetsFolderId', () => {
  it('does not resolve before sidebar items have loaded', async () => {
    const createItem = createItemMock()

    await expect(
      resolveAssetsFolderId({
        rootItems: [],
        createItem,
        loaded: false,
      }),
    ).rejects.toThrow('Cannot resolve Assets folder before sidebar items load')
    expect(createItem).not.toHaveBeenCalled()
  })

  it('does not resolve when sidebar items failed to load', async () => {
    const createItem = createItemMock()
    const error = new Error('Sidebar items failed to load')

    await expect(
      resolveAssetsFolderId({
        rootItems: [],
        createItem,
        loadError: error,
        loaded: false,
      }),
    ).rejects.toThrow('Sidebar items failed to load')
    expect(createItem).not.toHaveBeenCalled()
  })

  it('reuses a root folder named Assets when it exists', async () => {
    const createItem = createItemMock()

    const result = await resolveAssetsFolderId({
      rootItems: [assetsFolderItem()],
      createItem,
      loaded: true,
    })

    expect(result).toBe('assets-id')
    expect(createItem).not.toHaveBeenCalled()
  })

  it('creates Assets at root with the asset icon when missing', async () => {
    const createItem = createItemMock().mockResolvedValue({ id: testId('new-assets') })

    const result = await resolveAssetsFolderId({
      rootItems: [],
      createItem,
      loaded: true,
    })

    expect(result).toBe('new-assets')
    expect(createItem).toHaveBeenCalledWith({
      type: SIDEBAR_ITEM_TYPES.folders,
      name: 'Assets',
      iconName: 'Box',
      parentTarget: { kind: 'direct', parentId: null },
    })
  })
})

describe('useAssetsFolder', () => {
  it('resolves against the sidebar cache before stale loaded hook data', async () => {
    activeSidebarItemsState.current = {
      status: 'success',
      data: [],
      error: null,
    } as ActiveSidebarItemsState
    cachedActiveItems.current = [assetsFolderItem()]

    const { result } = renderHook(() => useAssetsFolder())

    await expect(result.current.resolveAssetsFolderId()).resolves.toBe('assets-id')
    expect(createFileSystemItem.current).not.toHaveBeenCalled()
  })
})
