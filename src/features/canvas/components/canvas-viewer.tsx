import { ReactFlowProvider } from '@xyflow/react'
import { ClientOnly } from '@tanstack/react-router'
import '@xyflow/react/dist/style.css'
import { CanvasProviders } from '../hooks/useCanvasContext'
import { useCanvasFlowController } from '../hooks/useCanvasFlowController'
import { useCanvasViewerSession } from '../hooks/useCanvasViewerSession'
import type { CanvasViewerSession } from '../hooks/useCanvasViewerSession'
import { CanvasFlowShell } from './canvas-flow-shell'
import type { EditorViewerProps } from '~/features/editor/components/viewer/sidebar-item-editor'
import type { CanvasWithContent } from 'convex/canvases/types'
import { LoadingSpinner } from '~/shared/components/loading-spinner'

export function CanvasViewer({ item: canvas }: EditorViewerProps<CanvasWithContent>) {
  return (
    <ClientOnly fallback={null}>
      <ReactFlowProvider>
        <CanvasViewerInner canvas={canvas} />
      </ReactFlowProvider>
    </ClientOnly>
  )
}

function CanvasViewerInner({ canvas }: { canvas: CanvasWithContent }) {
  const session = useCanvasViewerSession(canvas)

  if (session.status === 'error') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
        <p>
          {typeof session.error === 'string'
            ? session.error
            : session.error?.message || 'Failed to load canvas. Please try refreshing the page.'}
        </p>
      </div>
    )
  }

  if (session.status === 'loading') {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return <CanvasFlow {...session} />
}

type ReadyCanvasSession = Extract<CanvasViewerSession, { status: 'ready' }>

function CanvasFlow({
  canvasId,
  canEdit,
  colorMode,
  provider,
  user,
  doc,
  nodesMap,
  edgesMap,
}: ReadyCanvasSession) {
  const { nodeActions, editSession, viewState, shellProps } = useCanvasFlowController({
    nodesMap,
    edgesMap,
    canvasId,
    canEdit,
    provider,
    user,
    doc,
  })

  return (
    <CanvasProviders nodeActions={nodeActions} editSession={editSession} viewState={viewState}>
      <CanvasFlowShell {...shellProps} canEdit={canEdit} colorMode={colorMode} />
    </CanvasProviders>
  )
}
