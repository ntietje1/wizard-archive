import { useCreateFileSystemItem } from '~/features/filesystem/useCreateFileSystemItem'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { SIDEBAR_ITEMS_VIEW } from '~/features/sidebar/contexts/sidebar-items-context'
import { resolveAssetsFolderId } from '~/features/embeds/utils/assets-folder-resolver'

export function useAssetsFolder() {
  const activeItems = useActiveSidebarItems()
  const { createItem } = useCreateFileSystemItem()
  const sidebarItemsCache = useSidebarItemsCache()

  const resolve = async () => {
    const cachedActiveItems = sidebarItemsCache.get(SIDEBAR_ITEMS_VIEW.active)
    return await resolveAssetsFolderId({
      rootItems:
        activeItems.status === 'success'
          ? activeItems.data
          : cachedActiveItems.length > 0
            ? cachedActiveItems
            : activeItems.data,
      createItem,
      loadError: activeItems.error,
      loaded: activeItems.status === 'success',
    })
  }

  return {
    resolveAssetsFolderId: resolve,
    isLoading: activeItems.status === 'pending',
    error: activeItems.error,
  }
}
