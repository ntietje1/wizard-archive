import { useSyncExternalStore } from 'react'
import type { ResourceCapability } from '../editor-runtime-contract'
import type { ResourceUndoHistorySnapshot, ResourceUndoHistory } from '../resource-undo-history'

const EMPTY_UNDO: ResourceUndoHistorySnapshot = { status: 'ready', undo: null, redo: null }
const noSubscription = () => () => undefined

export function useResourceUndoSnapshot(
  capability: ResourceCapability<ResourceUndoHistory>,
): ResourceUndoHistorySnapshot {
  const history = capability.status === 'available' ? capability.value : null
  return useSyncExternalStore(
    history ? (listener) => history.subscribe(listener) : noSubscription,
    history ? () => history.getSnapshot() : () => EMPTY_UNDO,
    () => EMPTY_UNDO,
  )
}
