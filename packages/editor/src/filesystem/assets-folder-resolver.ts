import type { ResourceId } from '../resources/domain-id'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { CreateParentTarget } from '../workspace/items'
import type { ResourceIconName, ResourceKind } from '../workspace/resource-contract'

type AssetsFolderItem = {
  id: ResourceId
  type: ResourceKind
  name: string
  parentId: ResourceId | null
}

type CreateAssetsFolder = (args: {
  type: ResourceKind
  name: string
  iconName: ResourceIconName
  parentTarget: CreateParentTarget
}) => Promise<{ id: ResourceId }>

export async function resolveAssetsFolderId({
  rootItems,
  createItem,
  loadError = null,
  loaded = true,
}: {
  rootItems: ReadonlyArray<AssetsFolderItem>
  createItem: CreateAssetsFolder
  loadError?: Error | null
  loaded?: boolean
}) {
  if (loadError) {
    return Promise.reject(loadError)
  }

  if (!loaded) {
    return Promise.reject(new Error('Cannot resolve Assets folder before sidebar items load'))
  }

  const existing = rootItems.find(
    (item) =>
      item.parentId === null && item.type === RESOURCE_TYPES.folders && item.name === 'Assets',
  )

  if (existing) {
    return existing.id
  }

  const created = await createItem({
    type: RESOURCE_TYPES.folders,
    name: 'Assets',
    iconName: 'Box',
    parentTarget: { kind: 'direct', parentId: null },
  })

  return created.id
}
