import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'
import type { CreateItemArgs } from '~/features/filesystem/useCreateFileSystemItem'
import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { SIDEBAR_ITEMS_VIEW } from '~/features/sidebar/contexts/sidebar-items-context'

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
  loaded = true,
}: {
  rootItems: Array<AssetsFolderItem>
  createItem: CreateAssetsFolder
  loaded?: boolean
}) {
  if (!loaded) {
    throw new Error('Cannot resolve Assets folder before sidebar items load')
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

export function useAssetsFolder() {
  const activeItems = useActiveSidebarItems()
  const { createItem } = useCreateFileSystemItem()
  const sidebarItemsCache = useSidebarItemsCache()

  const resolve = async () => {
    const cachedActiveItems = sidebarItemsCache.get(SIDEBAR_ITEMS_VIEW.active)
    return await resolveAssetsFolderId({
      rootItems: cachedActiveItems.length > 0 ? cachedActiveItems : activeItems.data,
      createItem,
      loaded: activeItems.status === 'success',
    })
  }

  return {
    resolveAssetsFolderId: resolve,
    isLoading: activeItems.status === 'pending',
    error: activeItems.error,
  }
}
