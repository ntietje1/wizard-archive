import { createFileSystemCacheAdapter } from '../cache'
import type { SidebarCacheSnapshot } from '../cache-patches'

export function createReadWriteTestCache(snapshot: SidebarCacheSnapshot) {
  return createFileSystemCacheAdapter({
    getSnapshot: () => snapshot,
    replaceSnapshot: (updater) => {
      const next = updater(snapshot)
      for (const key of Object.keys(snapshot) as Array<keyof SidebarCacheSnapshot>) {
        delete snapshot[key]
      }
      Object.assign(snapshot, next)
    },
  })
}
