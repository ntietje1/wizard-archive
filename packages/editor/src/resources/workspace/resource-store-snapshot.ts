import { useCallback, useSyncExternalStore } from 'react'
import type { ResourceId } from '../domain-id'
import type { WorkspaceResourceIndex } from '../resource-index-contract'

type ResourceStateSource<TState> = Readonly<{
  get(resourceId: ResourceId): TState
  subscribe(resourceId: ResourceId, listener: () => void): () => void
}>

export function useResourceStoreSnapshot<TState>(
  source: ResourceStateSource<TState>,
  resourceId: ResourceId,
): TState {
  const subscribe = useCallback(
    (listener: () => void) => source.subscribe(resourceId, listener),
    [resourceId, source],
  )
  const getSnapshot = useCallback(() => source.get(resourceId), [resourceId, source])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useWorkspaceIndexSnapshot(source: WorkspaceResourceIndex) {
  const subscribe = useCallback((listener: () => void) => source.subscribe(listener), [source])
  const getSnapshot = useCallback(() => source.getSnapshot(), [source])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
