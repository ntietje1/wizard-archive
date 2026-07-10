import { useRef, useSyncExternalStore } from 'react'

import { createFileSystemExecutorRuntime } from './executor-runtime'
import type { FileSystemExecutorRuntimeArgs } from './executor-runtime'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { AnyItem } from '../workspace/items'

export interface FileSystemNavigationEffects {
  getCurrentResourceId: () => SidebarItemId | null
  clearWorkspaceContent: () => Promise<void>
  openResource: (
    resource: AnyItem,
    options?: { heading?: string; replace?: boolean },
  ) => Promise<void>
}

export function useFileSystemExecutor(args: FileSystemExecutorRuntimeArgs) {
  const runtimeRef = useRef<ReturnType<typeof createFileSystemExecutorRuntime> | null>(null)
  if (!runtimeRef.current) {
    runtimeRef.current = createFileSystemExecutorRuntime(args)
  }
  const runtime = runtimeRef.current
  runtime.updateArgs(args)
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)

  return {
    ...snapshot,
    clearPendingConflict: runtime.clearPendingConflict,
    resolvePendingConflict: runtime.resolvePendingConflict,
    executeCommand: runtime.executeCommand,
    discardCreatedItem: runtime.discardCreatedItem,
    runHistoryCommand: runtime.runHistoryCommand,
  }
}
