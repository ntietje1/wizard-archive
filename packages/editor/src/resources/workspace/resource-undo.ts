import { useSyncExternalStore } from 'react'
import type { ResourceCapability } from '../editor-runtime-contract'
import type { ResourceUndoHistory, ResourceUndoHistorySnapshot } from '../resource-undo-history'
import type { WorkspaceReport } from './resource-operations'

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

export async function runResourceUndo(
  history: ResourceUndoHistory,
  direction: 'undo' | 'redo',
  report: WorkspaceReport,
): Promise<void> {
  const run = () => (direction === 'undo' ? history.undo() : history.redo())
  const delivery = await run()
  if (delivery.status === 'received') {
    if (delivery.result.status === 'completed') return
    const label = direction === 'undo' ? 'Undo' : 'Redo'
    report(
      delivery.result.status === 'rejected' && delivery.result.reason === 'history_conflict'
        ? `${label} is no longer safe because the resource changed`
        : `${label} is unavailable`,
    )
    return
  }
  const retry = delivery.retryable
    ? () => void runResourceUndo(history, direction, report)
    : undefined
  report(
    delivery.status === 'indeterminate'
      ? `${direction === 'undo' ? 'Undo' : 'Redo'} status is unknown`
      : `${direction === 'undo' ? 'Undo' : 'Redo'} was not applied`,
    retry,
  )
}
