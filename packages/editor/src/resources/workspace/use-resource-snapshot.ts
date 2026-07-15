import { useSyncExternalStore } from 'react'
import type { EditorRuntime } from '../editor-runtime-contract'

export function useResourceSnapshot(runtime: EditorRuntime) {
  return useSyncExternalStore(
    (listener) => runtime.resources.index.subscribe(listener),
    () => runtime.resources.index.getSnapshot(),
    () => runtime.resources.index.getSnapshot(),
  )
}
