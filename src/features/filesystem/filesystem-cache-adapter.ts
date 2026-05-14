import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { createFileSystemReadModel } from 'convex/sidebarItems/filesystem/readModel'
import type { FileSystemReadModel } from 'convex/sidebarItems/filesystem/readModel'
import { applyFileSystemPatchesToSnapshot } from './filesystem-cache-patches'
import type { SidebarCacheSnapshot } from './filesystem-cache-patches'
import { SIDEBAR_ITEMS_VIEW } from '~/features/sidebar/hooks/useSidebarItems'
import type { SidebarItemsView } from '~/features/sidebar/hooks/useSidebarItems'

type FileSystemCacheAdapter = {
  getSnapshot: () => SidebarCacheSnapshot
  getReadModel: () => FileSystemReadModel<AnySidebarItem>
  applyPatches: (patches: Array<FileSystemPatch>) => void
}

type SidebarItemsCache = {
  get: (view: SidebarItemsView) => Array<AnySidebarItem>
  update: (
    view: SidebarItemsView,
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => void
}

export function createFileSystemCacheAdapter(cache: SidebarItemsCache): FileSystemCacheAdapter {
  let cachedReadModel: FileSystemReadModel<AnySidebarItem> | null = null
  const getSnapshot = (): SidebarCacheSnapshot => ({
    sidebar: cache.get(SIDEBAR_ITEMS_VIEW.active),
    trash: cache.get(SIDEBAR_ITEMS_VIEW.trash),
  })
  const getReadModel = () => {
    if (cachedReadModel) return cachedReadModel
    const snapshot = getSnapshot()
    cachedReadModel = createFileSystemReadModel([...snapshot.sidebar, ...snapshot.trash])
    return cachedReadModel
  }
  const replaceSnapshot = (updater: (prev: SidebarCacheSnapshot) => SidebarCacheSnapshot) => {
    let nextTrash: Array<AnySidebarItem> | null = null
    // The sidebar cache currently stores active and trash views as separate TanStack queries.
    // Apply them back-to-back and invalidate this adapter's read model only after both writes;
    // consumers must read through getReadModel/applyPatches rather than between view updates.
    cache.update(SIDEBAR_ITEMS_VIEW.active, (prevSidebar) => {
      const next = updater({
        sidebar: prevSidebar,
        trash: cache.get(SIDEBAR_ITEMS_VIEW.trash),
      })
      nextTrash = next.trash
      return next.sidebar
    })
    if (nextTrash !== null) {
      const trash = nextTrash
      cache.update(SIDEBAR_ITEMS_VIEW.trash, () => trash)
    }
    cachedReadModel = null
  }

  return {
    getSnapshot,
    getReadModel,
    applyPatches: (patches) => {
      if (patches.length === 0) return
      replaceSnapshot((snapshot) => applyFileSystemPatchesToSnapshot(snapshot, patches))
    },
  }
}
