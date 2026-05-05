import { useEffect, useRef } from 'react'
import { CanvasNodeContentRenderer } from './canvas-node-content-renderer'
import { areArraysEqual } from './canvas-renderer-utils'
import { CanvasPathEdgeVisual } from '../edges/shared/canvas-path-edge'
import {
  areCanvasPreviewEdgeRendersEqual,
  areCanvasPreviewNodeShellsEqual,
  selectCanvasPreviewEdgeRender,
  selectCanvasPreviewNodeShell,
} from './canvas-read-only-preview-model'
import { normalizeEmbedNodeData } from '../nodes/embed/embed-node-data'
import { CanvasRichTextPreview } from '../nodes/shared/canvas-rich-text-node'
import { normalizeCanvasRichTextNodeData } from '../nodes/shared/canvas-rich-text-node-data'
import {
  getCanvasNodeSurfaceStyle,
  getCanvasNodeTextStyle,
} from '../nodes/shared/canvas-node-surface-style'
import { normalizeStrokeNodeData } from '../nodes/stroke/stroke-node-model'
import { StrokeVisual } from '../nodes/stroke/stroke-node'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import { readResizeObserverBorderBoxSize } from '../system/canvas-element-size'
import { resolveCanvasScreenMinimumStrokeWidth } from '../utils/canvas-screen-stroke-width'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { cn } from '~/features/shadcn/lib/utils'
import type { CanvasNodeRendererMap } from './canvas-node-content-renderer'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { EmbedNodeData } from '../nodes/embed/embed-node-data'
import type { CanvasRichTextNodeInputData } from '../nodes/shared/canvas-rich-text-node-data'
import type { StrokeNodeData } from '../nodes/stroke/stroke-node-model'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'

const DEFAULT_EMBED_MIN_WIDTH = 240
const DEFAULT_EMBED_MIN_HEIGHT = 180

const PREVIEW_NODE_RENDERERS = {
  embed: CanvasPreviewEmbedNode,
  stroke: CanvasPreviewStrokeNode,
  text: CanvasPreviewTextNode,
} as const satisfies CanvasNodeRendererMap

export function CanvasPreviewNodeRenderer({
  interactive,
  onNodeContextMenu,
}: {
  interactive: boolean
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areArraysEqual)
  return nodeIds.map((nodeId) => (
    <CanvasPreviewNodeShell
      key={nodeId}
      interactive={interactive}
      nodeId={nodeId}
      onNodeContextMenu={onNodeContextMenu}
    >
      <CanvasNodeContentRenderer nodeId={nodeId} renderers={PREVIEW_NODE_RENDERERS} />
    </CanvasPreviewNodeShell>
  ))
}

function CanvasPreviewNodeShell({
  children,
  interactive,
  nodeId,
  onNodeContextMenu,
}: {
  children: ReactNode
  interactive: boolean
  nodeId: string
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
}) {
  const shell = useCanvasEngineSelector(
    (snapshot) => selectCanvasPreviewNodeShell(snapshot.nodeLookup.get(nodeId)),
    areCanvasPreviewNodeShellsEqual,
  )
  const canvasEngine = useCanvasEngine()
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const shellId = shell?.id

  useEffect(() => {
    if (!shellId) {
      return undefined
    }

    const nodeElement = nodeRef.current
    if (!nodeElement || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return
      }

      const size = readResizeObserverBorderBoxSize(entry)
      if (size.width <= 0 || size.height <= 0) {
        return
      }

      canvasEngine.measureNode(shellId, size)
    })
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [canvasEngine, shellId])

  if (!shell) {
    return null
  }

  const getCurrentNode = () => canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node ?? null

  return (
    <div
      ref={nodeRef}
      className={cn(
        'canvas-node-shell absolute left-0 top-0 touch-none select-none',
        shell.className,
      )}
      data-node-id={shell.id}
      data-node-type={shell.type}
      role="group"
      aria-label={`${shell.type ?? 'canvas'} node`}
      tabIndex={-1}
      style={{
        contain: 'layout style',
        transform: `translate(${shell.position.x}px, ${shell.position.y}px)`,
        width: shell.width,
        height: shell.height,
        zIndex: shell.zIndex,
        pointerEvents: interactive ? 'auto' : 'none',
      }}
      onContextMenu={(event) => {
        const node = getCurrentNode()
        if (node) {
          onNodeContextMenu(event, node)
        }
      }}
    >
      {children}
    </div>
  )
}

export function CanvasPreviewEdgeRenderer({
  interactive,
  onEdgeContextMenu,
}: {
  interactive: boolean
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const edgeIds = useCanvasEngineSelector((snapshot) => snapshot.edgeIds, areArraysEqual)
  return edgeIds.map((edgeId) => (
    <CanvasPreviewEdge
      key={edgeId}
      edgeId={edgeId}
      interactive={interactive}
      onEdgeContextMenu={onEdgeContextMenu}
    />
  ))
}

function CanvasPreviewEdge({
  edgeId,
  interactive,
  onEdgeContextMenu,
}: {
  edgeId: string
  interactive: boolean
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const edgeRender = useCanvasEngineSelector(
    (snapshot) => selectCanvasPreviewEdgeRender(snapshot, edgeId),
    areCanvasPreviewEdgeRendersEqual,
  )

  if (!edgeRender) {
    return null
  }

  return (
    <g
      className={interactive ? 'pointer-events-auto' : 'pointer-events-none'}
      data-canvas-edge-id={edgeRender.edge.id}
      onContextMenu={(event) => onEdgeContextMenu(event, edgeRender.edge)}
    >
      <CanvasPathEdgeVisual
        geometry={edgeRender.geometry}
        id={edgeRender.edge.id}
        type={edgeRender.type}
        style={edgeRender.edge.style}
      />
    </g>
  )
}

function CanvasPreviewNodeFrame({
  children,
  dragging,
  nodeType,
}: {
  children: ReactNode
  dragging: boolean
  nodeType: CanvasDocumentNode['type']
}) {
  return (
    <div
      className="relative h-full w-full select-none"
      data-testid="canvas-node"
      data-node-type={nodeType}
      data-node-selected="false"
      data-node-visual-selected="false"
      data-node-pending-preview-active="false"
      data-node-pending-selected="false"
      data-node-editing="false"
      data-node-dragging={dragging ? 'true' : 'false'}
    >
      {children}
    </div>
  )
}

function CanvasPreviewEmbedNode({ data, dragging }: CanvasNodeComponentProps<EmbedNodeData>) {
  const normalizedData = normalizeEmbedNodeData(data)
  const { data: contentItem, isLoading, error } = useSidebarItemById(normalizedData.sidebarItemId)

  return (
    <CanvasPreviewNodeFrame nodeType="embed" dragging={!!dragging}>
      <div
        className="relative h-full w-full overflow-hidden rounded-lg"
        style={{
          ...getCanvasNodeSurfaceStyle(normalizedData),
          ...getCanvasNodeTextStyle(normalizedData),
          minHeight: DEFAULT_EMBED_MIN_HEIGHT,
          minWidth: DEFAULT_EMBED_MIN_WIDTH,
        }}
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
    </CanvasPreviewNodeFrame>
  )
}

function CanvasPreviewTextNode({
  data,
  dragging,
}: CanvasNodeComponentProps<CanvasRichTextNodeInputData>) {
  const normalizedData = normalizeCanvasRichTextNodeData(data)
  const invalid = normalizedData.richText.kind === 'invalid'

  return (
    <CanvasPreviewNodeFrame nodeType="text" dragging={!!dragging}>
      <CanvasRichTextPreview
        content={normalizedData.richText.content}
        data={normalizedData}
        invalid={invalid}
        variant={{
          containerClassName: 'min-h-[30px] min-w-[80px] rounded-lg',
          contentClassName: 'h-full w-full overflow-hidden',
          invalidContentLabel: 'Invalid text content',
          textClassName: 'text-sm',
        }}
      />
    </CanvasPreviewNodeFrame>
  )
}

function CanvasPreviewStrokeNode({
  id,
  data,
  dragging,
  width,
  height,
}: CanvasNodeComponentProps<StrokeNodeData>) {
  const normalizedData = normalizeStrokeNodeData(data)
  const detailSize = resolveCanvasScreenMinimumStrokeWidth(normalizedData.size, 1)

  return (
    <CanvasPreviewNodeFrame nodeType="stroke" dragging={!!dragging}>
      <StrokeVisual
        id={id}
        data={normalizedData}
        width={width}
        height={height}
        detailSize={detailSize}
        highlightD={null}
      />
    </CanvasPreviewNodeFrame>
  )
}
