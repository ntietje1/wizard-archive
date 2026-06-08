import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CreateItemArgs } from '~/features/filesystem/useCreateFileSystemItem'

type AssetsFolderItem = {
  _id: Id<'sidebarItems'>
  type: string
  name: string
  parentId: Id<'sidebarItems'> | null
}

type CreateAssetsFolder = (args: CreateItemArgs) => Promise<{ id: Id<'sidebarItems'> }>

export async function resolveAssetsFolderId({
  rootItems,
  createItem,
  loadError = null,
  loaded = true,
}: {
  rootItems: Array<AssetsFolderItem>
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
      item.parentId === null && item.type === SIDEBAR_ITEM_TYPES.folders && item.name === 'Assets',
  )

  if (existing) {
    return existing._id
  }

  const created = await createItem({
    type: SIDEBAR_ITEM_TYPES.folders,
    name: 'Assets',
    iconName: 'Box',
    parentTarget: { kind: 'direct', parentId: null },
  })

  return created.id
}
