import type { ResourceId } from '../../resources/domain-id'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { ErrorFallback } from '@wizard-archive/ui/components/error-fallback'
import type { ResourceHistoryAvailable, HistoryPreviewState, RollbackState } from '../history-types'

import { HistoryPreviewViewer } from './viewer'
import { RollbackConfirmDialog } from './rollback-confirm-dialog'
import { handleError } from '../../errors/handle-error'

const UNAVAILABLE_HISTORY_PREVIEW_STATE = {
  status: 'unavailable',
  entryTime: undefined,
} satisfies HistoryPreviewState

const CLOSED_HISTORY_ROLLBACK_STATE = {
  status: 'closed',
  isRestoring: false,
} satisfies RollbackState

export function HistoryPreviewSurface({
  canEdit,
  children,
  history,
  itemId,
}: {
  canEdit: boolean
  children: ReactNode
  history: ResourceHistoryAvailable
  itemId: ResourceId
}) {
  const currentHistoryRef = useRef(history)
  const currentItemIdRef = useRef(itemId)
  useEffect(() => {
    currentHistoryRef.current = history
    currentItemIdRef.current = itemId
  }, [history, itemId])
  const previewState =
    history.itemId === itemId ? history.preview : UNAVAILABLE_HISTORY_PREVIEW_STATE
  const rollbackState = history.itemId === itemId ? history.rollback : CLOSED_HISTORY_ROLLBACK_STATE
  const restoreRollback = async () => {
    const rollbackEntryId = history.rollbackEntryId
    if (history.itemId !== itemId || !rollbackEntryId || rollbackState.isRestoring) return

    let result: Awaited<ReturnType<typeof history.restoreRollback>>
    try {
      result = await history.restoreRollback(rollbackEntryId)
    } catch (error) {
      handleError(error, 'Failed to restore history version')
      return
    }
    const currentHistory = currentHistoryRef.current
    if (
      result.status === 'restored' &&
      currentItemIdRef.current === itemId &&
      currentHistory.itemId === itemId &&
      currentHistory.rollbackEntryId === rollbackEntryId
    ) {
      currentHistory.clearPreview()
      currentHistory.clearRollback()
    }
  }
  const rollbackDialog = (
    <RollbackConfirmDialog
      state={rollbackState}
      onOpenChange={(open) => {
        if (!open && !rollbackState.isRestoring) history.clearRollback()
      }}
      onRestore={() => void restoreRollback()}
    />
  )

  if (!history.previewingEntryId || history.itemId !== itemId) {
    return (
      <>
        {children}
        {rollbackDialog}
      </>
    )
  }

  return (
    <>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        key={`preview-${history.previewingEntryId}`}
        onReset={history.clearPreview}
      >
        <HistoryPreviewViewer
          canEdit={canEdit}
          state={previewState}
          onExit={history.clearPreview}
          onRestore={() => history.requestRollback(history.previewingEntryId)}
        />
      </ErrorBoundary>
      {rollbackDialog}
    </>
  )
}
