import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { ErrorFallback } from '@wizard-archive/ui/components/error-fallback'
import type { ResourceHistoryAvailable, HistoryPreviewState, RollbackState } from '../history-types'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { HistoryPreviewViewer } from './viewer'
import { RollbackConfirmDialog } from './rollback-confirm-dialog'

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
  itemId: SidebarItemId
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

    const result = await history.restoreRollback(rollbackEntryId)
    if (
      result.status === 'restored' &&
      currentHistoryRef.current === history &&
      currentItemIdRef.current === itemId &&
      history.rollbackEntryId === rollbackEntryId
    ) {
      history.clearPreview()
      history.clearRollback()
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
