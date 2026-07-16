import type { CSSProperties, MouseEvent, PointerEvent, RefObject } from 'react'
import type { CanvasBounds } from './canvas-bounds'
import type { CanvasDocumentController, CanvasDocumentNodeUpdate } from './document-controller'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from './document-contract'
import {
  CANVAS_CONNECTION_HANDLES,
  canvasConnectionPreviewPath,
  canvasEdgePath,
  canvasNodeHandlePoint,
} from './canvas-edge-geometry'
import {
  getCanvasNodeInteractionPosition,
  getCanvasDrawingPoints,
  getVisualCanvasSelection,
} from './interaction-controller'
import { screenToCanvasPoint } from './canvas-viewport'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'
import type {
  CanvasConnectionHandle,
  CanvasPoint,
  CanvasSelection,
  CanvasViewport,
} from './interaction-types'
import { canvasNodeSize } from './canvas-layout'
import { projectCanvasResizeNodeBounds } from './canvas-resize-geometry'
import { CanvasSelectionBounds } from './canvas-selection-bounds'
import { CanvasSnapGuides } from './canvas-snap-guides'
import { canvasStrokeLocalPoints } from './canvas-stroke-geometry'
import { canvasBoundsFromPoints } from './selection-geometry'
import type { CanvasTextDocument } from './text/model'
import type { CanvasNodeId } from '../resources/domain-id'
import { CanvasTextEditor } from './canvas-text-editor'
import { CanvasTextPreview } from './canvas-text-preview'

export function CanvasScene({
  canEdit,
  content,
  documentController,
  interaction,
  interactionController,
  onOpenContextMenu,
  surface,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  onOpenContextMenu: (event: MouseEvent<Element>, selection: CanvasSelection) => void
  surface: RefObject<HTMLElement | null>
}) {
  const resizedNodeBounds = canvasResizedNodeBounds(interaction)
  const visualNodes = content.nodes.map((node, index) =>
    canvasVisualNode({ ...node, zIndex: node.zIndex ?? index + 1 }, interaction, resizedNodeBounds),
  )
  const nodeById = new Map<CanvasNodeId, CanvasDocumentNode>(
    visualNodes.map((node) => [node.id, node]),
  )
  const visualSelection = getVisualCanvasSelection(interaction)
  return (
    <div
      className="absolute left-0 top-0 size-0 origin-top-left"
      data-testid="canvas-viewport"
      style={{
        transform: `translate(${interaction.viewport.x}px, ${interaction.viewport.y}px) scale(${interaction.viewport.zoom})`,
      }}
    >
      {content.edges.map((edge, index) => (
        <svg
          key={edge.id}
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          data-edge-id={edge.id}
          data-testid="canvas-edge-layer"
          style={{ zIndex: edge.zIndex ?? content.nodes.length + index + 1 }}
          width="1"
          height="1"
        >
          <CanvasEdge
            edge={edge}
            nodeById={nodeById}
            selected={visualSelection.edgeIds.has(edge.id)}
            selection={visualSelection}
            tool={interaction.tool}
            onOpenContextMenu={onOpenContextMenu}
            onSelect={(additive) => interactionController.selectEdge(edge.id, additive)}
          />
        </svg>
      ))}
      <CanvasConnectionOverlay interaction={interaction} nodeById={nodeById} />
      <CanvasDrawingOverlay interaction={interaction} />
      <CanvasSelectionOverlay interaction={interaction} />
      <CanvasSnapGuides interaction={interaction} />
      {visualNodes.map((node) => (
        <CanvasNode
          key={node.id}
          canEdit={canEdit}
          content={content}
          documentController={documentController}
          interaction={interaction}
          interactionController={interactionController}
          node={node}
          onOpenContextMenu={onOpenContextMenu}
          selected={visualSelection.nodeIds.has(node.id)}
          surface={surface}
        />
      ))}
      <CanvasSelectionBounds
        canEdit={canEdit}
        interaction={interaction}
        interactionController={interactionController}
        nodes={visualNodes}
        surface={surface}
      />
    </div>
  )
}

function canvasResizedNodeBounds(
  interaction: CanvasInteractionSnapshot,
): ReadonlyMap<CanvasNodeId, CanvasBounds> {
  const resizing = interaction.interaction
  return resizing.type === 'resizing'
    ? projectCanvasResizeNodeBounds(
        resizing.initialBounds,
        resizing.bounds,
        resizing.initialNodeBounds,
      )
    : new Map()
}

function canvasVisualNode(
  node: CanvasDocumentNode,
  interaction: CanvasInteractionSnapshot,
  resizedNodeBounds: ReadonlyMap<CanvasNodeId, CanvasBounds>,
): CanvasDocumentNode {
  const resized = resizedNodeBounds.get(node.id)
  if (resized) {
    return {
      ...node,
      position: { x: resized.x, y: resized.y },
      width: resized.width,
      height: resized.height,
    }
  }
  return {
    ...node,
    position: getCanvasNodeInteractionPosition(interaction, node.id, node.position),
  }
}

function CanvasNode({
  canEdit,
  content,
  documentController,
  interaction,
  interactionController,
  node,
  onOpenContextMenu,
  selected,
  surface,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  node: CanvasDocumentNode
  onOpenContextMenu: (event: MouseEvent<Element>, selection: CanvasSelection) => void
  selected: boolean
  surface: RefObject<HTMLElement | null>
}) {
  if (node.hidden) return null
  const position = node.position
  const editing =
    canEdit &&
    interaction.interaction.type === 'editing' &&
    interaction.interaction.nodeId === node.id
  const erasing =
    interaction.interaction.type === 'erasing' && interaction.interaction.nodeIds.has(node.id)
  const size = canvasNodeSize(node)
  return (
    <div
      className={`absolute rounded-md ${node.type === 'stroke' ? 'pointer-events-none' : ''}`}
      data-node-id={node.id}
      data-node-type={node.type}
      data-erasing={erasing}
      data-selected={selected}
      data-testid="canvas-node"
      style={{
        width: size.width,
        height: size.height,
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: node.zIndex ?? 0,
        opacity: erasing ? 0.35 : undefined,
      }}
      onDoubleClick={(event) => {
        if (!canEdit || interaction.tool !== 'select' || node.type !== 'text') return
        event.stopPropagation()
        interactionController.editNode(node.id)
      }}
      onContextMenu={(event) => {
        event.stopPropagation()
        onOpenContextMenu(
          event,
          selected
            ? interaction.selection
            : { nodeIds: new Set([node.id]), edgeIds: new Set<string>() },
        )
      }}
      onPointerDown={(event) =>
        beginNodeDrag({
          canEdit,
          content,
          editing,
          event,
          interaction,
          interactionController,
          node,
          selected,
          surface,
        })
      }
      onPointerMove={(event) =>
        updateNodeDrag(event, interaction.viewport, interactionController, surface)
      }
      onPointerUp={(event) =>
        commitNodeDrag(
          canEdit,
          event,
          interaction.viewport,
          documentController,
          interactionController,
          surface,
        )
      }
      onPointerCancel={() => interactionController.cancelInteraction()}
    >
      <CanvasNodeContent
        editing={editing}
        node={node}
        selected={selected}
        zoom={interaction.viewport.zoom}
        onFinishEditing={() => interactionController.finishEditing()}
        onSaveContent={(nextContent) =>
          saveTextNode(canEdit, documentController, node.id, nextContent)
        }
      />
      {canEdit && interaction.tool === 'edge' && (
        <CanvasNodeConnectionHandles
          interaction={interaction}
          interactionController={interactionController}
          node={node}
          surface={surface}
        />
      )}
    </div>
  )
}

function CanvasNodeConnectionHandles({
  interaction,
  interactionController,
  node,
  surface,
}: {
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  node: CanvasDocumentNode
  surface: RefObject<HTMLElement | null>
}) {
  const connection = interaction.interaction
  return CANVAS_CONNECTION_HANDLES.map((handle) => {
    const snapped =
      connection.type === 'connecting' &&
      connection.target?.nodeId === node.id &&
      connection.target.handle === handle
    return (
      <button
        key={handle}
        type="button"
        aria-label={`Connect from ${handle}`}
        className="pointer-events-auto absolute z-20 size-4 rounded-full border border-border bg-background shadow-sm data-[snap-target=true]:border-primary data-[snap-target=true]:bg-primary"
        data-canvas-node-handle="true"
        data-handle-position={handle}
        data-snap-target={snapped}
        data-testid={`canvas-node-handle-${handle}`}
        style={connectionHandleStyle(handle)}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.stopPropagation()
          surface.current?.setPointerCapture(event.pointerId)
          interactionController.beginConnection(
            event.pointerId,
            { nodeId: node.id, handle },
            canvasNodeHandlePoint(node, handle),
          )
        }}
      />
    )
  })
}

function connectionHandleStyle(handle: CanvasConnectionHandle): CSSProperties {
  switch (handle) {
    case 'top':
      return { left: '50%', top: 0, transform: 'translate(-50%, -50%)' }
    case 'right':
      return { right: 0, top: '50%', transform: 'translate(50%, -50%)' }
    case 'bottom':
      return { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }
    case 'left':
      return { left: 0, top: '50%', transform: 'translate(-50%, -50%)' }
  }
}

function beginNodeDrag({
  canEdit,
  content,
  editing,
  event,
  interaction,
  interactionController,
  node,
  selected,
  surface,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  editing: boolean
  event: PointerEvent<HTMLDivElement>
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  node: CanvasDocumentNode
  selected: boolean
  surface: RefObject<HTMLElement | null>
}) {
  if (event.button !== 0 || interaction.tool !== 'select' || editing) return
  event.stopPropagation()
  const additive = event.metaKey || event.ctrlKey
  if (additive) {
    interactionController.selectNode(node.id, true)
    return
  }
  if (!selected) interactionController.selectNode(node.id, false)
  if (!canEdit) return
  const selectedIds = interactionController.get().selection.nodeIds
  const positions = new Map<CanvasNodeId, CanvasPoint>()
  content.nodes.forEach((candidate) => {
    if (selectedIds.has(candidate.id)) positions.set(candidate.id, candidate.position)
  })
  const bounds = surface.current?.getBoundingClientRect()
  if (!bounds) return
  event.currentTarget.setPointerCapture(event.pointerId)
  interactionController.beginDrag(
    event.pointerId,
    screenToCanvasPoint({ x: event.clientX, y: event.clientY }, interaction.viewport, {
      x: bounds.left,
      y: bounds.top,
    }),
    positions,
  )
}

function updateNodeDrag(
  event: PointerEvent<HTMLDivElement>,
  viewport: CanvasViewport,
  interactionController: CanvasInteractionController,
  surface: RefObject<HTMLElement | null>,
) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
  const bounds = surface.current?.getBoundingClientRect()
  if (!bounds) return
  const point = screenToCanvasPoint({ x: event.clientX, y: event.clientY }, viewport, {
    x: bounds.left,
    y: bounds.top,
  })
  interactionController.updateDrag(
    event.pointerId,
    point,
    event.shiftKey,
    event.metaKey || event.ctrlKey,
  )
}

function commitNodeDrag(
  canEdit: boolean,
  event: PointerEvent<HTMLDivElement>,
  viewport: CanvasViewport,
  documentController: CanvasDocumentController,
  interactionController: CanvasInteractionController,
  surface: RefObject<HTMLElement | null>,
) {
  if (!canEdit) {
    interactionController.cancelInteraction()
    return
  }
  updateNodeDrag(event, viewport, interactionController, surface)
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const positions = interactionController.commitDrag(event.pointerId)
  if (!positions) return
  const nodes: Array<CanvasDocumentNodeUpdate> = []
  for (const candidate of documentController.read().nodes) {
    const position = positions.get(candidate.id)
    if (position) nodes.push({ id: candidate.id, type: candidate.type, position })
  }
  documentController.apply({ type: 'update', nodes, edges: [] })
}

function saveTextNode(
  canEdit: boolean,
  documentController: CanvasDocumentController,
  nodeId: CanvasNodeId,
  content: CanvasTextDocument,
) {
  if (!canEdit) return
  const latest = documentController.read().nodes.find((candidate) => candidate.id === nodeId)
  if (!latest || latest.type !== 'text') return
  documentController.apply({
    type: 'update',
    nodes: [
      {
        id: latest.id,
        type: 'text',
        data: { content },
      },
    ],
    edges: [],
  })
}

function CanvasNodeContent({
  editing,
  node,
  onFinishEditing,
  onSaveContent,
  selected,
  zoom,
}: {
  editing: boolean
  node: CanvasDocumentNode
  onFinishEditing: () => void
  onSaveContent: (content: CanvasTextDocument) => void
  selected: boolean
  zoom: number
}) {
  if (node.type === 'stroke') {
    const size = canvasNodeSize(node)
    const points = canvasStrokeLocalPoints(node)
      .map(({ x, y }) => `${x},${y}`)
      .join(' ')
    return (
      <svg className="size-full overflow-visible" viewBox={`0 0 ${size.width} ${size.height}`}>
        <polyline
          data-testid="canvas-stroke-hit-target"
          fill="none"
          points={points}
          pointerEvents="stroke"
          stroke="transparent"
          strokeWidth={Math.max(node.data.size, 24 / zoom)}
        />
        <polyline
          fill="none"
          points={points}
          pointerEvents="none"
          stroke={node.data.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={(node.data.opacity ?? 100) / 100}
          strokeWidth={node.data.size}
        />
      </svg>
    )
  }
  const sharedStyle = {
    color: node.data.textColor ?? undefined,
    backgroundColor: node.data.backgroundColor ?? undefined,
    opacity: node.data.backgroundOpacity ?? undefined,
    borderColor: node.data.borderStroke ?? undefined,
    borderWidth: node.data.borderWidth ?? 1,
  }
  if (node.type === 'embed') {
    return (
      <div
        className="flex size-full items-center justify-center rounded-md border bg-card p-3 text-center text-sm shadow-sm"
        style={sharedStyle}
      >
        {canvasEmbedLabel(node)}
      </div>
    )
  }
  if (editing) {
    return (
      <CanvasTextEditor
        content={node.data.content}
        onChange={onSaveContent}
        onFinish={onFinishEditing}
      />
    )
  }
  return <CanvasTextPreview content={node.data.content} selected={selected} style={sharedStyle} />
}

function CanvasEdge({
  edge,
  nodeById,
  onOpenContextMenu,
  onSelect,
  selected,
  selection,
  tool,
}: {
  edge: CanvasDocumentEdge
  nodeById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>
  onOpenContextMenu: (event: MouseEvent<Element>, selection: CanvasSelection) => void
  onSelect: (additive: boolean) => void
  selected: boolean
  selection: CanvasSelection
  tool: CanvasInteractionSnapshot['tool']
}) {
  if (edge.hidden) return null
  const path = canvasEdgePath(edge, nodeById)
  if (!path) return null
  return (
    <g
      className="pointer-events-auto cursor-pointer"
      data-edge-id={edge.id}
      data-selected={selected}
      data-testid="canvas-edge"
      onContextMenu={(event) => {
        event.stopPropagation()
        onOpenContextMenu(
          event,
          selected ? selection : { nodeIds: new Set<CanvasNodeId>(), edgeIds: new Set([edge.id]) },
        )
      }}
      onPointerDown={(event) => {
        if (tool !== 'select') return
        event.stopPropagation()
        onSelect(event.metaKey || event.ctrlKey)
      }}
    >
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={path}
        fill="none"
        stroke={selected ? 'var(--ring)' : (edge.style?.stroke ?? 'var(--foreground)')}
        strokeOpacity={edge.style?.opacity ?? 0.75}
        strokeWidth={edge.style?.strokeWidth ?? 2}
      />
    </g>
  )
}

function CanvasDrawingOverlay({ interaction }: { interaction: CanvasInteractionSnapshot }) {
  const drawing = interaction.interaction
  if (drawing.type !== 'drawing') return null
  const points = getCanvasDrawingPoints(drawing)
    .map(([x, y]) => `${x},${y}`)
    .join(' ')
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      data-testid="canvas-drawing-preview"
      width="1"
      height="1"
    >
      <polyline
        fill="none"
        points={points}
        stroke={drawing.style.color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={drawing.style.opacity / 100}
        strokeWidth={drawing.style.size}
      />
    </svg>
  )
}

function CanvasConnectionOverlay({
  interaction,
  nodeById,
}: {
  interaction: CanvasInteractionSnapshot
  nodeById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>
}) {
  const connection = interaction.interaction
  if (connection.type !== 'connecting') return null
  const path = canvasConnectionPreviewPath(
    connection.source,
    connection.current,
    connection.target,
    nodeById,
  )
  if (!path) return null
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      data-snap-target={connection.target !== null}
      data-testid="canvas-connection-preview"
      width="1"
      height="1"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeLinecap="round"
        strokeWidth={2 / interaction.viewport.zoom}
      />
    </svg>
  )
}

function CanvasSelectionOverlay({ interaction }: { interaction: CanvasInteractionSnapshot }) {
  const gesture = interaction.interaction
  if (gesture.type !== 'selecting') return null
  const marqueeBounds =
    gesture.kind === 'marquee' ? canvasBoundsFromPoints(gesture.origin, gesture.current) : null
  if (marqueeBounds?.width === 0 && marqueeBounds.height === 0) return null
  const status = gesture.candidate ? selectionStatus(gesture.candidate) : null
  return (
    <>
      {gesture.kind === 'marquee' ? (
        <div
          className="pointer-events-none absolute border border-primary bg-primary/10"
          data-testid="canvas-marquee"
          style={{
            ...marqueeBounds,
            borderWidth: 1 / interaction.viewport.zoom,
          }}
        />
      ) : (
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          data-testid="canvas-lasso"
          width="1"
          height="1"
        >
          <polygon
            fill="var(--primary)"
            fillOpacity={0.1}
            points={gesture.points.map(({ x, y }) => `${x},${y}`).join(' ')}
            stroke="var(--primary)"
            strokeWidth={1 / interaction.viewport.zoom}
          />
        </svg>
      )}
      {status && (
        <span className="sr-only" role="status">
          {status}
        </span>
      )}
    </>
  )
}

function selectionStatus(selection: CanvasSelection): string {
  const nodes = `${selection.nodeIds.size} ${selection.nodeIds.size === 1 ? 'node' : 'nodes'}`
  const edges = `${selection.edgeIds.size} ${selection.edgeIds.size === 1 ? 'edge' : 'edges'}`
  return `Selecting ${nodes} and ${edges}`
}

function canvasEmbedLabel(node: Extract<CanvasDocumentNode, { type: 'embed' }>) {
  const destination = node.data.destination
  if (!destination) return 'Empty embed'
  if (destination.kind === 'externalUrl') return destination.url
  if (destination.kind === 'unresolved') return destination.rawTarget || 'Unresolved embed'
  return `${destination.target.kind} embed`
}
