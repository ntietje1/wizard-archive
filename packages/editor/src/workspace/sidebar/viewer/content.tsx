import { useEffect } from 'react'
import type { AnyItemWithContent } from '../../items'
import { ErrorBoundary } from '@wizard-archive/ui/components/error-boundary'
import { ErrorFallback } from '@wizard-archive/ui/components/error-fallback'
import type { WorkspaceViewStateStores } from '../../runtime-host'
import type { ResourceHistory } from '../../../filesystem/history-types'
import { HistoryPreviewSurface } from '../../../filesystem/history-preview/surface'
import { useNoteScrollRequest } from '../../../notes/scroll-request-context'
import { useWorkspaceSidebarReveal } from '../use-reveal'
import { createRuntimeSidebarItemViewerSource } from './runtime-source'
import type { RuntimeSidebarItemViewerSourceInput } from './runtime-source'
import { SidebarItemViewer } from './sidebar-item-viewer'

export type SidebarItemContentRuntime = RuntimeSidebarItemViewerSourceInput & {
  filesystem: RuntimeSidebarItemViewerSourceInput['filesystem'] & {
    history: ResourceHistory
  }
}

type SidebarItemContentProps = {
  item: AnyItemWithContent
  runtime: SidebarItemContentRuntime
  viewStateStores: WorkspaceViewStateStores
}

export function SidebarItemContent({ item, runtime, viewStateStores }: SidebarItemContentProps) {
  const history = runtime.filesystem.history
  const clearHistoryItemSession = history.status === 'available' ? history.clearItemSession : null
  const noteScrollRequest = useNoteScrollRequest()
  const showItemInSidebar = useWorkspaceSidebarReveal()
  const viewerSource = createRuntimeSidebarItemViewerSource(runtime, {
    noteScrollRequest,
    showItemInSidebar,
    viewStateStores,
  })

  useEffect(() => {
    return () => clearHistoryItemSession?.()
  }, [clearHistoryItemSession, item.id])

  const content = <SidebarItemViewer item={item} source={viewerSource} />

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} key={item.id}>
      {history.status === 'available' ? (
        <HistoryPreviewSurface
          canEdit={runtime.filesystem.permissions.canEdit}
          history={history}
          itemId={item.id}
        >
          {content}
        </HistoryPreviewSurface>
      ) : (
        content
      )}
    </ErrorBoundary>
  )
}
