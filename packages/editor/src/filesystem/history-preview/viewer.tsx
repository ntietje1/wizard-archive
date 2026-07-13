import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { HistoryPreviewBanner } from './banner'
import type { HistoryPreviewState } from '../history-types'
import { getPreviewFallbackCopy } from '../../previews/fallback-policy'
import { HistoryDocumentPreview } from './document-preview'

export function HistoryPreviewViewer({
  canEdit,
  onExit,
  onRestore,
  state,
}: {
  canEdit: boolean
  onExit: () => void
  onRestore: () => void
  state: HistoryPreviewState
}) {
  let content: ReactNode
  if (state.status === 'loading') {
    content = (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  } else if (state.status === 'error') {
    content = (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {getPreviewFallbackCopy({ surface: 'history', reason: 'loadError' })}
        </p>
      </div>
    )
  } else if (state.status === 'unavailable') {
    content = (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {getPreviewFallbackCopy({ surface: 'history', reason: 'unavailableVersion' })}
        </p>
      </div>
    )
  } else {
    content = <HistoryDocumentPreview snapshot={state.snapshot} />
  }

  return (
    <PreviewShell
      canEdit={canEdit}
      entryTime={state.entryTime}
      onExit={onExit}
      onRestore={onRestore}
    >
      {content}
    </PreviewShell>
  )
}

function PreviewShell({
  canEdit,
  children,
  entryTime,
  onExit,
  onRestore,
}: {
  canEdit: boolean
  children: ReactNode
  entryTime: number | undefined
  onExit: () => void
  onRestore: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <HistoryPreviewBanner
        canEdit={canEdit}
        entryTime={entryTime}
        onExit={onExit}
        onRestore={onRestore}
      />
      {children}
    </div>
  )
}
