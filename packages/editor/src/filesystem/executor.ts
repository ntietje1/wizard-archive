import type { ResourceId } from '../resources/domain-id'
import { useRef, useSyncExternalStore } from 'react'

import { createFileSystemExecutorRuntime } from './executor-runtime'
import type { FileSystemExecutorRuntimeArgs } from './executor-runtime'

import type { AnyItem } from '../workspace/items'

export interface FileSystemNavigationEffects {
  getCurrentResourceId: () => ResourceId | null
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
    executeCommand: runtime.executeCommand,
    discardCreatedItem: runtime.discardCreatedItem,
    runHistoryCommand: runtime.runHistoryCommand,
  }
}
