import type { ResourceCatalog } from './catalog'
import type { FileSystemItemCreateOperations } from './item-operation-contracts'
import type { FileSystemLoadState } from './load-state'
import { resolveAssetsFolderId } from './assets-folder-resolver'

export function createAssetsFolderResolver({
  catalog,
  load,
  operations,
}: {
  catalog: Pick<ResourceCatalog, 'getVisibleRoots'>
  load: Pick<FileSystemLoadState, 'activeError' | 'activeStatus'>
  operations: FileSystemItemCreateOperations
}) {
  let pendingResolution: ReturnType<typeof resolveAssetsFolderId> | null = null
  let resolvedAssetsFolderId: Awaited<ReturnType<typeof resolveAssetsFolderId>> | null = null

  const resolve = async () => {
    if (resolvedAssetsFolderId) return resolvedAssetsFolderId
    if (pendingResolution) return await pendingResolution

    pendingResolution = resolveAssetsFolderId({
      rootItems: catalog.getVisibleRoots(),
      createItem: async (input) => {
        const created = await operations.createItem(input)
        if (created.status !== 'completed') {
          throw new Error(
            `Failed to create ${input.type} "${input.name}" in parent ${
              input.parentTarget.kind === 'direct'
                ? (input.parentTarget.parentId ?? 'root')
                : 'path'
            }`,
          )
        }
        return created
      },
      loadError: load.activeError,
      loaded: load.activeStatus === 'success',
    })
      .then((itemId) => {
        resolvedAssetsFolderId = itemId
        return itemId
      })
      .finally(() => {
        pendingResolution = null
      })

    return await pendingResolution
  }

  return {
    resolveAssetsFolderId: resolve,
    get isLoading() {
      return load.activeStatus === 'pending'
    },
    get error() {
      return load.activeError
    },
  }
}
