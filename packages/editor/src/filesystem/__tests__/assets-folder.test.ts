import { describe, expect, it, vi } from 'vite-plus/test'
import { assertResourceItemSlug } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { createAssetsFolderResolver } from '../assets-folder'
import { resolveAssetsFolderId } from '../assets-folder-resolver'
import { createResourceCatalogModel } from '../catalog'
import type { FileSystemLoadState } from '../load-state'
import type { FileSystemCreateItem } from '../item-operation-contracts'
import { createFolder } from '../../test/sidebar-item-factory'
import { testResourceId } from '../../../../../shared/test/resource-id'

type ResolveAssetsFolderInput = Parameters<typeof resolveAssetsFolderId>[0]
type CreateAssetsFolder = ResolveAssetsFolderInput['createItem']

function createResolverItemMock() {
  return vi.fn<CreateAssetsFolder>()
}

function createRuntimeItemMock() {
  return vi.fn<FileSystemCreateItem>()
}

function createReadyFileSystemLoadState(): FileSystemLoadState {
  return {
    activeStatus: 'success',
    activeError: null,
    refreshActive: () => Promise.resolve(),
    refreshTrash: () => Promise.resolve(),
    trashError: null,
    trashStatus: 'success',
  }
}

function assetsFolderItem(): ReturnType<typeof createFolder> {
  return createFolder({
    id: testResourceId('assets-id'),
    name: 'Assets',
    parentId: null,
  })
}

const assetsFolderId = testResourceId('assets-id')
const newAssetsFolderId = testResourceId('new-assets')

describe('resolveAssetsFolderId', () => {
  it('reuses a root folder named Assets when it exists', async () => {
    const createItem = createResolverItemMock()

    const result = await resolveAssetsFolderId({
      rootItems: [assetsFolderItem()],
      createItem,
      loaded: true,
    })

    expect(result).toBe(assetsFolderId)
  })

  it('creates Assets at root with the asset icon when missing', async () => {
    const createItem = createResolverItemMock().mockResolvedValue({
      id: newAssetsFolderId,
    })

    const result = await resolveAssetsFolderId({
      rootItems: [],
      createItem,
      loaded: true,
    })

    expect(result).toBe(newAssetsFolderId)
    expect(createItem).toHaveBeenCalledWith({
      type: RESOURCE_TYPES.folders,
      name: 'Assets',
      iconName: 'Box',
      parentTarget: { kind: 'direct', parentId: null },
    })
  })
})

describe('createAssetsFolderResolver', () => {
  it('resolves against workspace filesystem catalog root items', async () => {
    const resolver = createTestAssetsFolderResolver({
      activeItems: [assetsFolderItem()],
    })

    await expect(resolver.resolveAssetsFolderId()).resolves.toBe(assetsFolderId)
  })

  it('creates through workspace filesystem operations when Assets is missing', async () => {
    const createItem = createRuntimeItemMock().mockResolvedValue({
      status: 'completed',
      id: newAssetsFolderId,
      slug: assertResourceItemSlug('new-assets'),
    })

    const resolver = createTestAssetsFolderResolver({ createItem })

    await expect(resolver.resolveAssetsFolderId()).resolves.toBe(newAssetsFolderId)
    expect(createItem).toHaveBeenCalledWith({
      type: RESOURCE_TYPES.folders,
      name: 'Assets',
      iconName: 'Box',
      parentTarget: { kind: 'direct', parentId: null },
    })
  })

  it('shares an in-flight Assets folder creation across concurrent resolves', async () => {
    const createdAssets = {
      status: 'completed' as const,
      id: newAssetsFolderId,
      slug: assertResourceItemSlug('new-assets'),
    }
    const releaseCreate: Array<() => void> = []
    const createItem = createRuntimeItemMock().mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseCreate.push(() => resolve(createdAssets))
        }),
    )

    const resolver = createTestAssetsFolderResolver({ createItem })
    const firstResolution = resolver.resolveAssetsFolderId()
    const secondResolution = resolver.resolveAssetsFolderId()

    await Promise.resolve()

    expect(createItem).toHaveBeenCalledTimes(1)

    releaseCreate.forEach((release) => release())

    await expect(Promise.all([firstResolution, secondResolution])).resolves.toEqual([
      newAssetsFolderId,
      newAssetsFolderId,
    ])
  })

  it('reuses the created Assets folder across sequential resolves while the catalog is stale', async () => {
    const createItem = createRuntimeItemMock().mockResolvedValue({
      status: 'completed',
      id: newAssetsFolderId,
      slug: assertResourceItemSlug('new-assets'),
    })
    const resolver = createTestAssetsFolderResolver({ createItem })

    await expect(resolver.resolveAssetsFolderId()).resolves.toBe(newAssetsFolderId)
    await expect(resolver.resolveAssetsFolderId()).resolves.toBe(newAssetsFolderId)

    expect(createItem).toHaveBeenCalledTimes(1)
  })

  it('reflects live active load state changes', () => {
    const load: FileSystemLoadState = {
      ...createReadyFileSystemLoadState(),
      activeStatus: 'pending' as const,
      activeError: null,
    }
    const resolver = createAssetsFolderResolver({
      catalog: createResourceCatalogModel({ activeItems: [], trashItems: [] }).catalog,
      load,
      operations: { createItem: createRuntimeItemMock() },
    })

    expect(resolver.isLoading).toBe(true)
    expect(resolver.error).toBeNull()

    const activeError = new Error('active failed')
    load.activeStatus = 'error'
    load.activeError = activeError

    expect(resolver.isLoading).toBe(false)
    expect(resolver.error).toBe(activeError)
  })
})

function createTestAssetsFolderResolver({
  activeError = null,
  activeItems = [],
  createItem = createRuntimeItemMock(),
}: {
  activeError?: Error | null
  activeItems?: Array<ReturnType<typeof createFolder>>
  createItem?: FileSystemCreateItem
}) {
  const catalog = createResourceCatalogModel({
    activeItems,
    trashItems: [],
  }).catalog
  const load = {
    ...createReadyFileSystemLoadState(),
    activeError,
  }

  return createAssetsFolderResolver({
    catalog,
    load,
    operations: { createItem },
  })
}
