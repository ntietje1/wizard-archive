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
  const getSnapshot = () => {
    const visibleSnapshot = cache.getSnapshot()
    const visibleIds = new Set([
      ...visibleSnapshot.sidebar.map((item) => item.id),
      ...visibleSnapshot.trash.map((item) => item.id),
    ])
    hiddenItems = hiddenItems.filter((item) => !visibleIds.has(item.id))
    return hiddenItems.length > 0 ? { ...visibleSnapshot, hidden: hiddenItems } : visibleSnapshot
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
