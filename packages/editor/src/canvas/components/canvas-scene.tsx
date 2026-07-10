import { useLayoutEffect, useRef } from 'react'
import { CanvasAwarenessHost } from './canvas-awareness-host'
import { CanvasConnectionLayer } from './canvas-connection-layer'
import { CanvasEdgeRenderer } from './canvas-edge-renderer'
import { CanvasLocalOverlaysHost } from './canvas-local-overlays-host'
import { CanvasNodeRenderer } from './canvas-node-renderer'
import { CanvasPendingSelectionPreviewOverlay } from './canvas-pending-selection-preview-overlay'
import { CanvasSelectionResizeOverlay } from './canvas-selection-resize-overlay'
import { CanvasSceneViewport } from './canvas-scene-viewport'
import { CanvasNodeResizeMetadataProvider } from '../nodes/shared/canvas-node-resize-metadata-provider'
import { useCanvasConnectionGesture } from '../runtime/interaction/canvas-connection-gesture'
import { isCanvasInteractiveKeyboardTarget } from '../runtime/interaction/canvas-keyboard-targets'
import { isCanvasEmptyPaneTarget } from '../runtime/interaction/canvas-pane-targets'
import { useCanvasEngine } from '../react/canvas-engine-context-value'
import { useCanvasViewportRuntime } from '../runtime/providers/canvas-runtime'
import type { CanvasConnection } from '../types/canvas-domain-types'
import type { RemoteUser } from '../utils/canvas-awareness-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../document-contract'
import type {
  ComponentType,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

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
  NodeContentComponent: ComponentType<{ nodeId: string }>
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
  onPaneContextMenu: (event: ReactMouseEvent) => void
}

export function CanvasScene({
  canEdit,
  remoteUsers,
  sceneHandlers,
  NodeContentComponent,
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
  const handleNodeClick = (event: ReactMouseEvent, node: CanvasDocumentNode) => {
    nodeHandlersRef.current.onNodeClick?.(event, node)
  }
  const handleNodeContextMenu = (event: ReactMouseEvent, node: CanvasDocumentNode) => {
    nodeHandlersRef.current.onNodeContextMenu(event, node)
  }
  const handleSelectionContextMenu = (event: ReactMouseEvent, nodeId: string) => {
    const node = canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node
    if (node) {
      handleNodeContextMenu(event, node)
    }
  }
  const handleEdgeClick = (event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
    edgeHandlersRef.current.onEdgeClick?.(event, edge)
  }
  const handleEdgeContextMenu = (event: ReactMouseEvent, edge: CanvasDocumentEdge) => {
    edgeHandlersRef.current.onEdgeContextMenu(event, edge)
  }
  const getEventNode = (event: ReactMouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    const nodeElement = target?.closest<HTMLElement>('[data-node-id]')
    const nodeId = nodeElement?.dataset.nodeId
    return nodeId ? (canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null) : null
  }

  const handlePaneKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === ' ') {
      if (isCanvasInteractiveKeyboardTarget(event.target)) {
        return
      }

      event.preventDefault()
      return
    }

    connectionGesture.onEscapeKeyDown(event)
  }

  const handlePointerDownCapture = (event: ReactPointerEvent) => {
    if (!isCanvasInteractiveKeyboardTarget(event.target)) {
      const target = event.currentTarget
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true })
      }
    }

    connectionGesture.onPointerDownCapture(event)
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
            <CanvasSelectionResizeOverlay onSelectionContextMenu={handleSelectionContextMenu} />
            <CanvasLocalOverlaysHost />
            <CanvasAwarenessHost remoteUsers={remoteUsers} />
          </>
        }
        surfaceProps={{
          role: 'application',
          'aria-label': 'Canvas',
          tabIndex: -1,
          onClick: (event) => {
            const node = getEventNode(event)
            if (node) {
              handleNodeClick(event, node)
            }
          },
          onContextMenu: (event) => {
            if (isCanvasInteractiveKeyboardTarget(event.target)) {
              return
            }

            const node = getEventNode(event)
            if (node) {
              handleNodeContextMenu(event, node)
              return
            }

            if (isCanvasEmptyPaneTarget(event.target, paneRef.current)) {
              onPaneContextMenu(event)
            }
          },
          onMouseMove: sceneHandlers.onMouseMove,
          onMouseLeave: sceneHandlers.onMouseLeave,
          onKeyDown: handlePaneKeyDown,
          onPointerDownCapture: handlePointerDownCapture,
        }}
      >
        <CanvasEdgeRenderer
          onEdgeClick={handleEdgeClick}
          onEdgeContextMenu={handleEdgeContextMenu}
        />
        <svg
          className="canvas-connection-layer pointer-events-none absolute left-0 top-0 overflow-visible"
          data-canvas-connection-layer="true"
          width="1"
          height="1"
        >
          <CanvasConnectionLayer draft={connectionGesture.draft} />
        </svg>
        <CanvasNodeRenderer NodeContentComponent={NodeContentComponent} />
      </CanvasSceneViewport>
    </CanvasNodeResizeMetadataProvider>
  )
}
