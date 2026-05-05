import { useCallback, useLayoutEffect, useRef } from 'react'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasConnectionLayer } from './canvas-connection-layer'
import { CanvasEdgeRenderer } from './canvas-edge-renderer'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { CanvasNodeContent } from './canvas-node-content'
import { CanvasNodeRenderer } from './canvas-node-renderer'
import { CanvasPendingSelectionPreviewOverlay } from './canvas-pending-selection-preview-overlay'
import { CanvasSelectionResizeOverlay } from './canvas-selection-resize-overlay'
import { CanvasSceneViewport } from './canvas-scene-viewport'
import { CanvasNodeResizeMetadataProvider } from '../nodes/shared/canvas-node-resize-metadata-provider'
import { useCanvasConnectionGesture } from '../runtime/interaction/canvas-connection-gesture'
import { isCanvasEmptyPaneTarget } from '../runtime/interaction/canvas-pane-targets'
import { useCanvasEngine } from '../react/use-canvas-engine'
import { useCanvasViewportRuntime } from '../runtime/providers/canvas-runtime'
import type {
  CanvasConnection,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '../types/canvas-domain-types'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'

type CanvasSceneHandlers = {
  createEdgeFromConnection: (connection: CanvasConnection) => void
  onNodeClick?: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
  onMouseMove?: (event: ReactMouseEvent) => void
  onMouseLeave?: () => void
}

interface CanvasSceneProps {
  canEdit: boolean
  remoteUsers: Array<RemoteUser>
  sceneHandlers: CanvasSceneHandlers
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
  onPaneContextMenu: (event: ReactMouseEvent) => void
}

export function CanvasScene({
  canEdit,
  remoteUsers,
  sceneHandlers,
  onNodeContextMenu,
  onEdgeContextMenu,
  onPaneContextMenu,
}: CanvasSceneProps) {
  const canvasEngine = useCanvasEngine()
  const { domRuntime } = useCanvasViewportRuntime()
  const paneRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const nodeHandlersRef = useRef({
    onNodeClick: sceneHandlers.onNodeClick,
    onNodeContextMenu,
  })
  const edgeHandlersRef = useRef({
    onEdgeClick: sceneHandlers.onEdgeClick,
    onEdgeContextMenu,
  })
  const connectionGesture = useCanvasConnectionGesture({
    canEdit,
    canvasEngine,
    paneRef,
    createEdgeFromConnection: sceneHandlers.createEdgeFromConnection,
  })

  useLayoutEffect(() => {
    nodeHandlersRef.current = {
      onNodeClick: sceneHandlers.onNodeClick,
      onNodeContextMenu,
    }
    edgeHandlersRef.current = {
      onEdgeClick: sceneHandlers.onEdgeClick,
      onEdgeContextMenu,
    }
  }, [onEdgeContextMenu, onNodeContextMenu, sceneHandlers])
  const handleNodeClick = useCallback((event: ReactMouseEvent, node: CanvasDocumentNode) => {
    nodeHandlersRef.current.onNodeClick?.(event, node)
  }, [])
  const handleNodeContextMenu = useCallback((event: ReactMouseEvent, node: CanvasDocumentNode) => {
    nodeHandlersRef.current.onNodeContextMenu(event, node)
  }, [])
  const handleEdgeClick = useCallback((event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
    edgeHandlersRef.current.onEdgeClick?.(event, edge)
  }, [])
  const handleEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
    edgeHandlersRef.current.onEdgeContextMenu(event, edge)
  }, [])

  const handlePaneKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === ' ') {
      event.preventDefault()
      return
    }

    connectionGesture.onEscapeKeyDown(event)
  }

  return (
    <CanvasNodeResizeMetadataProvider>
      <CanvasSceneViewport
        engine={canvasEngine}
        domRuntime={domRuntime}
        surfaceRef={paneRef}
        viewportRef={viewportRef}
        className="absolute inset-0"
        testId="canvas-scene"
        surfaceOverlay={
          <>
            <CanvasPendingSelectionPreviewOverlay />
            <CanvasSelectionResizeOverlay />
            <CanvasLocalOverlaysHost />
            <CanvasAwarenessHost remoteUsers={remoteUsers} />
          </>
        }
        surfaceProps={{
          role: 'application',
          'aria-label': 'Canvas',
          tabIndex: -1,
          onContextMenu: (event) => {
            if (isCanvasEmptyPaneTarget(event.target, paneRef.current)) {
              onPaneContextMenu(event)
            }
          },
          onMouseMove: sceneHandlers.onMouseMove,
          onMouseLeave: sceneHandlers.onMouseLeave,
          onKeyDown: handlePaneKeyDown,
          onPointerDownCapture: connectionGesture.onPointerDownCapture,
        }}
      >
        <svg
          className="canvas-edge-layer pointer-events-none absolute left-0 top-0 overflow-visible"
          data-canvas-edge-layer="true"
          width="1"
          height="1"
        >
          <CanvasEdgeRenderer
            onEdgeClick={handleEdgeClick}
            onEdgeContextMenu={handleEdgeContextMenu}
          />
          <CanvasConnectionLayer draft={connectionGesture.draft} />
        </svg>
        <CanvasNodeRenderer
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          NodeContentComponent={CanvasNodeContent}
        />
      </CanvasSceneViewport>
    </CanvasNodeResizeMetadataProvider>
  )
}
