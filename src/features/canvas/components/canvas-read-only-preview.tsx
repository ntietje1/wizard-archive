import { useEffect, useRef, useState } from 'react'
import { CanvasRenderModeProvider } from '../runtime/providers/canvas-render-mode-context'
import { CanvasRuntimeProvider } from '../runtime/providers/canvas-runtime-context'
import { CanvasEngineProvider } from '../react/canvas-engine-context'
import { CanvasBackground } from './canvas-background'
import { CanvasEdgeRenderer } from './canvas-edge-renderer'
import { CanvasNodeContentRenderer } from './canvas-node-content-renderer'
import type { CanvasNodeRendererMap } from './canvas-node-content-renderer'
import { CanvasNodeRenderer } from './canvas-node-renderer'
import {
  READ_ONLY_CANVAS_RUNTIME,
  createCanvasDomRuntimeAdapter,
} from '../runtime/providers/canvas-runtime'
import { createCanvasEngine } from '../system/canvas-engine'
import { createCanvasViewportController } from '../system/canvas-viewport-controller'
import { getCanvasFitViewport } from '../utils/canvas-fit-view'
import { useCanvasViewportInteractions } from '../runtime/interaction/use-canvas-viewport-interactions'
import { TextNode } from '../nodes/text/text-node'
import { StrokeNode } from '../nodes/stroke/stroke-node'
import { ResizableNodeWrapper } from '../nodes/shared/resizable-node-wrapper'
import { CanvasNodeConnectionHandles } from '../nodes/shared/canvas-node-connection-handles'
import { getCanvasNodeSurfaceStyle } from '../nodes/shared/canvas-node-surface-style'
import { normalizeEmbedNodeData } from '../nodes/embed/embed-node-data'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'
import { cn } from '~/features/shadcn/lib/utils'
import type { MouseEvent as ReactMouseEvent } from 'react'

const DEFAULT_MIN_ZOOM = 0.01
const DEFAULT_MAX_ZOOM = 4
const DEFAULT_FIT_PADDING = 0.12
const DEFAULT_EMBED_MIN_WIDTH = 240
const DEFAULT_EMBED_MIN_HEIGHT = 180

interface CanvasReadOnlyPreviewProps {
  nodes: ReadonlyArray<CanvasDocumentNode>
  edges: ReadonlyArray<CanvasDocumentEdge>
  interactive?: boolean
  fitPadding?: number
  minZoom?: number
  maxZoom?: number
  className?: string
}

export function CanvasReadOnlyPreview({
  nodes,
  edges,
  interactive = false,
  fitPadding = DEFAULT_FIT_PADDING,
  minZoom = DEFAULT_MIN_ZOOM,
  maxZoom = DEFAULT_MAX_ZOOM,
  className,
}: CanvasReadOnlyPreviewProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasEngineRef = useRef<ReturnType<typeof createCanvasEngine> | null>(null)
  canvasEngineRef.current ??= createCanvasEngine()
  const canvasEngine = canvasEngineRef.current
  const domRuntimeRef = useRef<ReturnType<typeof createCanvasDomRuntimeAdapter> | null>(null)
  domRuntimeRef.current ??= createCanvasDomRuntimeAdapter(canvasEngine)
  const domRuntime = domRuntimeRef.current
  const viewportControllerRef = useRef<ReturnType<typeof createCanvasViewportController> | null>(
    null,
  )
  viewportControllerRef.current ??= createCanvasViewportController({
    canvasEngine,
    getSurfaceElement: () => surfaceRef.current,
  })
  const viewportController = viewportControllerRef.current
  const size = useElementSize(surfaceRef)

  useEffect(() => {
    canvasEngine.setDocumentSnapshot({ nodes, edges })
  }, [canvasEngine, edges, nodes])

  useEffect(() => () => canvasEngine.destroy(), [canvasEngine])
  useEffect(() => () => viewportController.destroy(), [viewportController])

  useEffect(() => {
    const unregister = domRuntime.registerViewportElement(viewportRef.current)
    domRuntime.scheduleViewportTransform(canvasEngine.getSnapshot().viewport)
    domRuntime.scheduleCameraState(canvasEngine.getSnapshot().cameraState)
    domRuntime.flushRenderScheduler()
    return unregister
  }, [canvasEngine, domRuntime])

  useEffect(() => {
    if (size.width <= 0 || size.height <= 0) {
      viewportController.syncFromDocumentOrAdapter({ x: 0, y: 0, zoom: 1 })
      return
    }

    const viewport = getCanvasFitViewport({
      nodes,
      width: size.width,
      height: size.height,
      minZoom,
      maxZoom,
      padding: fitPadding,
    })
    viewportController.syncFromDocumentOrAdapter(viewport ?? { x: 0, y: 0, zoom: 1 })
  }, [fitPadding, maxZoom, minZoom, nodes, size.height, size.width, viewportController])

  useCanvasViewportInteractions({
    ref: surfaceRef,
    viewportController,
    canPrimaryPan: () => interactive,
    enabled: interactive,
  })

  return (
    <CanvasEngineProvider engine={canvasEngine}>
      <CanvasRuntimeProvider
        {...READ_ONLY_CANVAS_RUNTIME}
        canvasEngine={canvasEngine}
        domRuntime={domRuntime}
        viewportController={viewportController}
      >
        <CanvasRenderModeProvider mode="embedded-readonly">
          <div
            ref={surfaceRef}
            className={cn(
              'canvas-scene relative h-full w-full min-h-0 min-w-0 touch-none select-none overflow-hidden bg-background',
              className,
            )}
            data-canvas-pane="true"
            data-testid="canvas-read-only-preview"
            role="application"
            aria-label="Canvas preview"
            tabIndex={-1}
            onContextMenu={preventCanvasPreviewMenu}
          >
            <CanvasBackground />
            <div
              ref={viewportRef}
              data-canvas-viewport="true"
              className="canvas-scene__viewport absolute left-0 top-0 h-full w-full"
              style={{
                backfaceVisibility: 'hidden',
                transformOrigin: '0 0',
              }}
            >
              <svg
                className="canvas-edge-layer pointer-events-none absolute left-0 top-0 overflow-visible"
                data-canvas-edge-layer="true"
                width="1"
                height="1"
              >
                <CanvasEdgeRenderer onEdgeContextMenu={preventCanvasPreviewEdgeMenu} />
              </svg>
              <CanvasNodeRenderer
                onNodeContextMenu={preventCanvasPreviewNodeMenu}
                NodeContentComponent={CanvasPreviewNodeContent}
              />
            </div>
          </div>
        </CanvasRenderModeProvider>
      </CanvasRuntimeProvider>
    </CanvasEngineProvider>
  )
}

function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const syncSize = () => {
      const rect = element.getBoundingClientRect()
      setSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      )
    }
    syncSize()
    const observer = new ResizeObserver(syncSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

function preventCanvasPreviewMenu(event: ReactMouseEvent) {
  event.preventDefault()
}

function preventCanvasPreviewNodeMenu(event: ReactMouseEvent, _node: CanvasDocumentNode) {
  event.preventDefault()
}

function preventCanvasPreviewEdgeMenu(event: ReactMouseEvent, _edge: CanvasDocumentEdge) {
  event.preventDefault()
}

const PREVIEW_NODE_RENDERERS = {
  embed: CanvasPreviewEmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const satisfies CanvasNodeRendererMap

function CanvasPreviewNodeContent({ nodeId }: { nodeId: string }) {
  return <CanvasNodeContentRenderer nodeId={nodeId} renderers={PREVIEW_NODE_RENDERERS} />
}

function CanvasPreviewEmbedNode({ id, data, dragging }: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)
  const { data: contentItem, isLoading, error } = useSidebarItemById(normalizedData.sidebarItemId)

  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="embed"
      dragging={!!dragging}
      minWidth={DEFAULT_EMBED_MIN_WIDTH}
      minHeight={DEFAULT_EMBED_MIN_HEIGHT}
      chrome={<CanvasNodeConnectionHandles />}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-lg"
        style={getCanvasNodeSurfaceStyle(normalizedData)}
      >
        {contentItem ? <SidebarItemPreviewContent item={contentItem} /> : null}
        {!contentItem && isLoading ? (
          <div
            className="flex h-full items-center justify-center opacity-50"
            role="status"
            aria-live="polite"
          >
            <div
              className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
              aria-hidden={true}
            />
            <span className="sr-only">Loading embedded item</span>
          </div>
        ) : null}
        {!contentItem && error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Failed to load embedded item
          </div>
        ) : null}
        {!contentItem && !isLoading && !error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Embedded item unavailable
          </div>
        ) : null}
      </div>
    </ResizableNodeWrapper>
  )
}
