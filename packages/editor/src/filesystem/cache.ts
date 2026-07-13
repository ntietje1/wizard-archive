import { createWorkspaceResourceReadModel } from '../workspace/items'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'
import type { ResourcePatch } from './patch-contract'
import { applyFileSystemPatchesToSidebarCache } from './cache-patches'
import type { SidebarCacheSnapshot } from './cache-patches'

export type FileSystemCacheAdapter = {
  getSnapshot: () => SidebarCacheSnapshot
  getReadModel: () => WorkspaceResourceReadModel<AnyItem>
  applyPatches: (patches: Array<ResourcePatch>) => void
}

export type SidebarItemsCache = {
  getSnapshot: () => SidebarCacheSnapshot
  replaceSnapshot: (updater: (prev: SidebarCacheSnapshot) => SidebarCacheSnapshot) => void
}

export function createFileSystemCacheAdapter(cache: SidebarItemsCache): FileSystemCacheAdapter {
  let cachedReadModel: WorkspaceResourceReadModel<AnyItem> | null = null
  let cachedSidebar: Array<AnyItem> | null = null
  let cachedTrash: Array<AnyItem> | null = null
  let hiddenItems: Array<AnyItem> = []
  let cachedVisibleSnapshot: SidebarCacheSnapshot | null = null
  let cachedHiddenItems: Array<AnyItem> | null = null
  let cachedMergedSnapshot: SidebarCacheSnapshot | null = null
  const getSnapshot = () => {
    const visibleSnapshot = cache.getSnapshot()
    if (hiddenItems.length === 0) return visibleSnapshot
    if (
      cachedMergedSnapshot &&
      cachedVisibleSnapshot === visibleSnapshot &&
      cachedHiddenItems === hiddenItems
    ) {
      return cachedMergedSnapshot
    }
    const visibleIds = new Set([
      ...visibleSnapshot.sidebar.map((item) => item.id),
      ...visibleSnapshot.trash.map((item) => item.id),
    ])
    const visibleHiddenItems = hiddenItems.filter((item) => !visibleIds.has(item.id))
    cachedVisibleSnapshot = visibleSnapshot
    cachedHiddenItems = hiddenItems
    cachedMergedSnapshot =
      visibleHiddenItems.length > 0
        ? { ...visibleSnapshot, hidden: visibleHiddenItems }
        : visibleSnapshot
    return cachedMergedSnapshot
  }
  const getReadModel = () => {
    const snapshot = getSnapshot()
    if (cachedReadModel && cachedSidebar === snapshot.sidebar && cachedTrash === snapshot.trash) {
      return cachedReadModel
    }
    cachedSidebar = snapshot.sidebar
    cachedTrash = snapshot.trash
    cachedReadModel = createWorkspaceResourceReadModel([...snapshot.sidebar, ...snapshot.trash])
    return cachedReadModel
  }
  const replaceSnapshot = (updater: (prev: SidebarCacheSnapshot) => SidebarCacheSnapshot) => {
    cache.replaceSnapshot((prev) => {
      const next = updater(hiddenItems.length > 0 ? { ...prev, hidden: hiddenItems } : prev)
      const visibleIds = new Set([
        ...next.sidebar.map((item) => item.id),
        ...next.trash.map((item) => item.id),
      ])
      hiddenItems = (next.hidden ?? []).filter((item) => !visibleIds.has(item.id))
      return { sidebar: next.sidebar, trash: next.trash }
    })
    cachedVisibleSnapshot = null
    cachedHiddenItems = null
    cachedMergedSnapshot = null
    cachedReadModel = null
    cachedSidebar = null
    cachedTrash = null
  }

  return {
    getSnapshot,
    getReadModel,
    applyPatches: (patches) => {
      if (patches.length === 0) return
      replaceSnapshot((snapshot) => applyFileSystemPatchesToSidebarCache(snapshot, patches))
    },
  }
}
