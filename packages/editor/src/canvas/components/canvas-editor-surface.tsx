import { ContextMenuHost } from '../../context-menu/components/host'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { CanvasScene } from './canvas-scene'
import { CanvasToolbar } from './canvas-toolbar'
import { useCanvasPendingSelectionPreviewSummary } from '../runtime/selection/use-canvas-pending-selection-preview'
import type { ContextMenuHostRef } from '../../context-menu/components/host'
import type { BuiltContextMenu } from '../../context-menu/types'
import type { ComponentProps, ComponentType, ReactNode, Ref } from 'react'

type CanvasSceneProps = ComponentProps<typeof CanvasScene>

export function CanvasEditorSurface({
  canEdit,
  canvasCursor,
  canvasSurfaceRef,
  contextMenu,
  dropOverlay,
  NodeContentComponent,
  remoteUsers,
  sceneHandlers,
}: {
  canEdit: boolean
  canvasCursor: string
  canvasSurfaceRef: Ref<HTMLDivElement>
  contextMenu: {
    hostRef: Ref<ContextMenuHostRef>
    menu: BuiltContextMenu
    onClose: () => void
    openForEdge: CanvasSceneProps['onEdgeContextMenu']
    openForNode: CanvasSceneProps['onNodeContextMenu']
    openForPane: CanvasSceneProps['onPaneContextMenu']
  }
  dropOverlay?: ReactNode
  NodeContentComponent: ComponentType<{ nodeId: string }>
  remoteUsers: CanvasSceneProps['remoteUsers']
  sceneHandlers: CanvasSceneProps['sceneHandlers']
}) {
  const pendingSelectionPreview = useCanvasPendingSelectionPreviewSummary()

  return (
    <div
      className="canvas-editor-shell relative flex-1 min-h-0 allow-motion"
      data-testid="canvas-editor-shell"
    >
      <CanvasToolbar canEdit={canEdit} />
      <CanvasConditionalToolbar canEdit={canEdit} />
      <section
        ref={canvasSurfaceRef}
        className="relative z-0 h-full w-full"
        style={{ cursor: canvasCursor }}
        data-testid="canvas-surface"
        aria-label="Canvas surface"
      >
        <CanvasScene
          canEdit={canEdit}
          remoteUsers={remoteUsers}
          sceneHandlers={sceneHandlers}
          NodeContentComponent={NodeContentComponent}
          onNodeContextMenu={contextMenu.openForNode}
          onEdgeContextMenu={contextMenu.openForEdge}
          onPaneContextMenu={contextMenu.openForPane}
        />

        <ContextMenuHost
          ref={contextMenu.hostRef}
          menu={contextMenu.menu}
          onClose={contextMenu.onClose}
        />

        {pendingSelectionPreview.active &&
          pendingSelectionPreview.nodeCount + pendingSelectionPreview.edgeCount > 0 && (
            <CanvasPendingSelectionStatus
              nodeCount={pendingSelectionPreview.nodeCount}
              edgeCount={pendingSelectionPreview.edgeCount}
            />
          )}

        {dropOverlay}
      </section>
    </div>
  )
}

function CanvasPendingSelectionStatus({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number
  edgeCount: number
}) {
  const parts = [
    nodeCount > 0 ? `${nodeCount} node${nodeCount === 1 ? '' : 's'}` : null,
    edgeCount > 0 ? `${edgeCount} edge${edgeCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <output
      className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm"
      aria-live="polite"
    >
      {`Selecting ${parts.join(', ')}`}
    </output>
  )
}
