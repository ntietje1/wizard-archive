import { createFileSystemCacheAdapter } from '../cache'
import type { SidebarCacheSnapshot } from '../cache-patches'

export function createReadWriteTestCache(snapshot: SidebarCacheSnapshot) {
  return createFileSystemCacheAdapter({
    getSnapshot: () => snapshot,
    replaceSnapshot: (updater) => {
      const next = updater(snapshot)
      snapshot.sidebar = next.sidebar
      snapshot.trash = next.trash
    },
  })
}
