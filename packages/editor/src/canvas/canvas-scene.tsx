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
  CANVAS_EDGE_HIT_STROKE_WIDTH,
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
import type { CanvasConnectionHandle, CanvasPoint, CanvasSelection } from './interaction-types'
import { canvasNodeSize } from './canvas-layout'
import {
  CANVAS_EDGE_PENDING_OPACITY,
  canvasScreenStrokeWidth,
  resolveCanvasEdgeStyle,
} from './canvas-edge-style'
import { projectCanvasResizeNodeBounds } from './canvas-resize-geometry'
import { CanvasNodeSelectionIndicator, CanvasSelectionBounds } from './canvas-selection-bounds'
import { CanvasSnapGuides } from './canvas-snap-guides'
import { canvasBoundsFromPoints } from './selection-geometry'
import type { CanvasTextDocument } from './text/model'
import type { CanvasNodeId } from '../resources/domain-id'
import type { ContentCollaboration } from '../resources/content-session-contract'
import { CanvasCollaborationCursors } from './canvas-collaboration-cursors'
import { canvasStrokePath } from './canvas-stroke-geometry'
import { CanvasNodeVisual } from './canvas-node-visual'
import type { CanvasEmbedRenderer } from './canvas-editor'
import { projectCanvasRenderContent } from './canvas-render-projection'
import type { CanvasSurfaceSize } from './canvas-render-projection'
import { canvasTextPlacementDragBounds } from './canvas-node-placement'

export function CanvasScene({
  canEdit,
  collaboration,
  content,
  documentController,
  interaction,
  interactionController,
  onOpenContextMenu,
  renderEmbed,
  surface,
  surfaceSize,
}: {
  canEdit: boolean
  collaboration: ContentCollaboration
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  onOpenContextMenu: (event: MouseEvent<Element>, selection: CanvasSelection) => void
  renderEmbed: CanvasEmbedRenderer
  surface: RefObject<HTMLElement | null>
  surfaceSize: CanvasSurfaceSize
}) {
  const resizedNodeBounds = canvasResizedNodeBounds(interaction)
  const visualNodes = content.nodes.map((node) =>
    canvasVisualNode(node, interaction, resizedNodeBounds),
  )
  const defaultNodeZIndex = new Map(
    content.nodes.map((node, index) => [node.id, index + 1] as const),
  )
  const activeNodeZIndex =
    [...content.nodes, ...content.edges].reduce(
      (highest, element, index) => Math.max(highest, element.zIndex ?? index + 1),
      0,
    ) + 1
  const nodeById = new Map<CanvasNodeId, CanvasDocumentNode>(
    visualNodes.map((node) => [node.id, node]),
  )
  const rendered = projectCanvasRenderContent(visualNodes, content.edges, interaction, surfaceSize)
  const visualSelection = getVisualCanvasSelection(interaction)
  return (
    <>
      <div
        className="absolute left-0 top-0 size-0 origin-top-left"
        data-rendered-edge-count={rendered.edges.length}
        data-rendered-node-count={rendered.nodes.length}
        data-surface-height={surfaceSize.height}
        data-surface-width={surfaceSize.width}
        data-testid="canvas-viewport"
        style={
          {
            '--canvas-zoom': interaction.viewport.zoom,
            transform: `translate(${interaction.viewport.x}px, ${interaction.viewport.y}px) scale(${interaction.viewport.zoom})`,
          } as CSSProperties
        }
      >
        {rendered.edges.map((edge) => (
          <svg
            key={edge.id}
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            data-edge-id={edge.id}
            data-testid="canvas-edge-layer"
            style={{ zIndex: edge.zIndex ?? 0 }}
            width="1"
            height="1"
          >
            <CanvasEdge
              edge={edge}
              nodeById={nodeById}
              pendingSelected={
                interaction.interaction.type === 'selecting' &&
                interaction.interaction.candidate?.edgeIds.has(edge.id) === true
              }
              selection={visualSelection}
              tool={interaction.tool}
              visuallySelected={visualSelection.edgeIds.has(edge.id)}
              zoom={interaction.viewport.zoom}
              onOpenContextMenu={onOpenContextMenu}
              onSelect={(additive) => interactionController.selectEdge(edge.id, additive)}
            />
          </svg>
        ))}
        <CanvasConnectionOverlay interaction={interaction} nodeById={nodeById} />
        <CanvasDrawingOverlay interaction={interaction} />
        <CanvasTextPlacementOverlay interaction={interaction} />
        <CanvasSelectionOverlay interaction={interaction} />
        <CanvasSnapGuides interaction={interaction} />
        {rendered.nodes.map((node) => (
          <CanvasNode
            key={node.id}
            canEdit={canEdit}
            content={content}
            documentController={documentController}
            editing={
              canEdit &&
              interaction.interaction.type === 'editing' &&
              interaction.interaction.nodeId === node.id
            }
            editingActivation={
              canEdit &&
              interaction.interaction.type === 'editing' &&
              interaction.interaction.nodeId === node.id
                ? interaction.interaction.activation
                : null
            }
            erasing={
              interaction.interaction.type === 'erasing' &&
              interaction.interaction.nodeIds.has(node.id)
            }
            snappedConnectionHandle={
              interaction.interaction.type === 'connecting' &&
              interaction.interaction.target?.nodeId === node.id
                ? interaction.interaction.target.handle
                : null
            }
            interactionController={interactionController}
            node={node}
            onOpenContextMenu={onOpenContextMenu}
            renderEmbed={renderEmbed}
            exclusivelySelected={
              visualSelection.nodeIds.size === 1 && visualSelection.nodeIds.has(node.id)
            }
            selected={visualSelection.nodeIds.has(node.id)}
            showSelectionIndicator={
              visualSelection.nodeIds.has(node.id) &&
              (interaction.interaction.type === 'selecting' ||
                interaction.interaction.type === 'dragging' ||
                visualSelection.nodeIds.size > 1)
            }
            surface={surface}
            tool={interaction.tool}
            viewport={interaction.viewport}
            zIndex={
              canEdit &&
              interaction.interaction.type === 'editing' &&
              interaction.interaction.nodeId === node.id
                ? activeNodeZIndex
                : (node.zIndex ?? defaultNodeZIndex.get(node.id) ?? 0)
            }
          />
        ))}
        <CanvasCollaborationCursors
          collaboration={collaboration}
          zoom={interaction.viewport.zoom}
        />
      </div>
      <CanvasSelectionBounds
        canEdit={canEdit}
        interaction={interaction}
        interactionController={interactionController}
        nodes={visualNodes}
        surface={surface}
      />
    </>
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
  const position = getCanvasNodeInteractionPosition(interaction, node.id, node.position)
  return position === node.position ? node : { ...node, position }
}

function CanvasNode({
  canEdit,
  content,
  documentController,
  editing,
  editingActivation,
  erasing,
  interactionController,
  node,
  onOpenContextMenu,
  renderEmbed,
  exclusivelySelected,
  selected,
  showSelectionIndicator,
  snappedConnectionHandle,
  surface,
  tool,
  viewport,
  zIndex,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  editing: boolean
  editingActivation: Readonly<{ x: number; y: number }> | null
  erasing: boolean
  interactionController: CanvasInteractionController
  node: CanvasDocumentNode
  onOpenContextMenu: (event: MouseEvent<Element>, selection: CanvasSelection) => void
  renderEmbed: CanvasEmbedRenderer
  exclusivelySelected: boolean
  selected: boolean
  showSelectionIndicator: boolean
  snappedConnectionHandle: CanvasConnectionHandle | null
  surface: RefObject<HTMLElement | null>
  tool: CanvasInteractionSnapshot['tool']
  viewport: CanvasInteractionSnapshot['viewport']
  zIndex: number
}) {
  if (node.hidden) return null
  const position = node.position
  const size = canvasNodeSize(node)
  return (
    <div
      className={`absolute touch-none select-none rounded-md ${node.type === 'stroke' ? 'pointer-events-none' : ''}`}
      data-node-id={node.id}
      data-node-type={node.type}
      data-erasing={erasing}
      data-selected={selected}
      data-testid="canvas-node"
      style={{
        width: size.width,
        height: size.height,
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex,
        opacity: erasing ? 0.35 : undefined,
      }}
      onDoubleClickCapture={(event) => {
        const activatesText = node.type === 'text'
        const activatesEmbed =
          node.type === 'embed' &&
          event.currentTarget.querySelector('[data-canvas-editable-embed="true"]') !== null
        if (!canEdit || tool !== 'select' || (!activatesText && !activatesEmbed)) return
        event.preventDefault()
        event.stopPropagation()
        interactionController.selectNode(node.id, false)
        interactionController.editNode(node.id, { x: event.clientX, y: event.clientY })
      }}
      onContextMenu={(event) => {
        event.stopPropagation()
        onOpenContextMenu(
          event,
          selected
            ? interactionController.get().selection
            : { nodeIds: new Set([node.id]), edgeIds: new Set<string>() },
        )
      }}
      onPointerDown={(event) =>
        beginNodeDrag({
          canEdit,
          content,
          editing,
          event,
          interactionController,
          node,
          selected,
          surface,
        })
      }
      onPointerMove={(event) => updateNodeDrag(event, interactionController, surface)}
      onPointerUp={(event) =>
        commitNodeDrag(canEdit, event, documentController, interactionController, node.id, surface)
      }
      onPointerCancel={() => interactionController.cancelInteraction()}
    >
      <CanvasNodeVisual
        {...(editing
          ? {
              editing: true,
              onDefaultTextColorChange: (textColor: string) =>
                saveTextNodeData(canEdit, documentController, node.id, { textColor }),
            }
          : { editing: false })}
        exclusivelySelected={exclusivelySelected}
        embed={
          node.type === 'embed'
            ? renderEmbed({
                activation: editing
                  ? editingActivation
                    ? { kind: 'point', point: editingActivation }
                    : { kind: 'end' }
                  : null,
                editing,
                node,
                zoom: viewport.zoom,
              })
            : undefined
        }
        node={node}
        activation={
          editing
            ? editingActivation
              ? { kind: 'point', point: editingActivation }
              : { kind: 'end' }
            : null
        }
        selected={selected}
        zoom={viewport.zoom}
        onFinishEditing={() => interactionController.finishEditing()}
        onSaveContent={(nextContent) =>
          saveTextNodeData(canEdit, documentController, node.id, { content: nextContent })
        }
      />
      {showSelectionIndicator && <CanvasNodeSelectionIndicator zoom={viewport.zoom} />}
      {canEdit && tool === 'edge' && node.type !== 'stroke' && (
        <CanvasNodeConnectionHandles
          interactionController={interactionController}
          node={node}
          snappedHandle={snappedConnectionHandle}
          surface={surface}
        />
      )}
    </div>
  )
}

function CanvasNodeConnectionHandles({
  interactionController,
  node,
  snappedHandle,
  surface,
}: {
  interactionController: CanvasInteractionController
  node: CanvasDocumentNode
  snappedHandle: CanvasConnectionHandle | null
  surface: RefObject<HTMLElement | null>
}) {
  return CANVAS_CONNECTION_HANDLES.map((handle) => {
    const snapped = snappedHandle === handle
    return (
      <button
        key={handle}
        type="button"
        aria-label={`Connect from ${handle}`}
        className="canvas-node-connection-handle pointer-events-auto absolute z-20 size-8 rounded-full border-0 bg-transparent p-0 after:pointer-events-none after:absolute after:top-1/2 after:left-1/2 after:size-3.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-border after:bg-background after:content-[''] data-[snap-target=true]:after:border-primary data-[snap-target=true]:after:bg-primary"
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
  interactionController,
  node,
  selected,
  surface,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  editing: boolean
  event: PointerEvent<HTMLDivElement>
  interactionController: CanvasInteractionController
  node: CanvasDocumentNode
  selected: boolean
  surface: RefObject<HTMLElement | null>
}) {
  const interaction = interactionController.get()
  if (event.button !== 0 || interaction.tool !== 'select' || editing) return
  event.preventDefault()
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
  interactionController: CanvasInteractionController,
  surface: RefObject<HTMLElement | null>,
) {
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
  const bounds = surface.current?.getBoundingClientRect()
  if (!bounds) return
  const viewport = interactionController.get().viewport
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
  documentController: CanvasDocumentController,
  interactionController: CanvasInteractionController,
  nodeId: CanvasNodeId,
  surface: RefObject<HTMLElement | null>,
) {
  const captured = event.currentTarget.hasPointerCapture(event.pointerId)
  if (canEdit && captured) {
    updateNodeDrag(event, interactionController, surface)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const positions = interactionController.commitDrag(event.pointerId)
  if (!positions) {
    if (captured && !event.metaKey && !event.ctrlKey) {
      interactionController.selectNode(nodeId, false)
    }
    return
  }
  const nodes: Array<CanvasDocumentNodeUpdate> = []
  for (const candidate of documentController.read().nodes) {
    const position = positions.get(candidate.id)
    if (position) nodes.push({ id: candidate.id, type: candidate.type, position })
  }
  documentController.apply({ type: 'update', nodes, edges: [] })
}

function saveTextNodeData(
  canEdit: boolean,
  documentController: CanvasDocumentController,
  nodeId: CanvasNodeId,
  data: { content?: CanvasTextDocument; textColor?: string | null },
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
        data,
      },
    ],
    edges: [],
  })
}

function CanvasEdge({
  edge,
  nodeById,
  onOpenContextMenu,
  onSelect,
  pendingSelected,
  selection,
  tool,
  visuallySelected,
  zoom,
}: {
  edge: CanvasDocumentEdge
  nodeById: ReadonlyMap<CanvasNodeId, CanvasDocumentNode>
  onOpenContextMenu: (event: MouseEvent<Element>, selection: CanvasSelection) => void
  onSelect: (additive: boolean) => void
  pendingSelected: boolean
  selection: CanvasSelection
  tool: CanvasInteractionSnapshot['tool']
  visuallySelected: boolean
  zoom: number
}) {
  if (edge.hidden) return null
  const path = canvasEdgePath(edge, nodeById)
  if (!path) return null
  const style = resolveCanvasEdgeStyle(edge.style)
  const primaryStrokeWidth = canvasScreenStrokeWidth(style.strokeWidth, zoom)
  const highlightStrokeWidth = canvasScreenStrokeWidth(Math.max(style.strokeWidth * 0.15, 1), zoom)
  return (
    <g
      className={tool === 'select' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
      data-edge-id={edge.id}
      data-selected={visuallySelected}
      data-testid="canvas-edge"
      onContextMenu={(event) => {
        event.stopPropagation()
        onOpenContextMenu(
          event,
          visuallySelected
            ? selection
            : { nodeIds: new Set<CanvasNodeId>(), edgeIds: new Set([edge.id]) },
        )
      }}
      onPointerDown={(event) => {
        if (tool !== 'select') return
        event.stopPropagation()
        onSelect(event.metaKey || event.ctrlKey)
      }}
    >
      <path
        d={path}
        data-canvas-authored-stroke-width={style.strokeWidth}
        data-testid="canvas-edge-primary-path"
        fill="none"
        stroke={style.stroke}
        strokeLinecap="square"
        strokeLinejoin="round"
        strokeOpacity={pendingSelected ? CANVAS_EDGE_PENDING_OPACITY : style.opacity}
        strokeWidth={primaryStrokeWidth}
      />
      <path
        d={path}
        data-testid="canvas-edge-interaction"
        fill="none"
        pointerEvents="stroke"
        stroke="transparent"
        strokeWidth={CANVAS_EDGE_HIT_STROKE_WIDTH}
      />
      {visuallySelected && (
        <path
          d={path}
          data-canvas-highlight-stroke-width={Math.max(style.strokeWidth * 0.15, 1)}
          data-testid="canvas-edge-selection-highlight"
          fill="none"
          pointerEvents="none"
          stroke="var(--primary)"
          strokeLinecap="square"
          strokeLinejoin="round"
          strokeWidth={highlightStrokeWidth}
        />
      )}
    </g>
  )
}

function CanvasDrawingOverlay({ interaction }: { interaction: CanvasInteractionSnapshot }) {
  const drawing = interaction.interaction
  if (drawing.type !== 'drawing') return null
  const path = canvasStrokePath(getCanvasDrawingPoints(drawing), drawing.style.size)
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      data-testid="canvas-drawing-preview"
      width="1"
      height="1"
    >
      <path d={path} fill={drawing.style.color} fillOpacity={drawing.style.opacity / 100} />
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
    interaction.toolSettings.edgeType,
    connection.source,
    connection.current,
    connection.target,
    nodeById,
  )
  if (!path) return null
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width="1"
      height="1"
    >
      <path
        d={path}
        data-canvas-authored-stroke-width={interaction.toolSettings.strokeSize}
        data-edge-type={interaction.toolSettings.edgeType}
        data-snap-target={connection.target !== null}
        data-testid="canvas-connection-preview"
        fill="none"
        stroke={interaction.toolSettings.strokeColor}
        strokeLinecap="square"
        strokeLinejoin="round"
        strokeOpacity={interaction.toolSettings.strokeOpacity / 100}
        strokeWidth={Math.max(interaction.toolSettings.strokeSize, 1 / interaction.viewport.zoom)}
      />
    </svg>
  )
}

function CanvasSelectionOverlay({ interaction }: { interaction: CanvasInteractionSnapshot }) {
  const gesture = interaction.interaction
  if (gesture.type !== 'selecting') return null
  const status = gesture.candidate ? selectionStatus(gesture.candidate) : null
  if (gesture.kind === 'marquee') {
    const bounds = canvasBoundsFromPoints(gesture.origin, gesture.current)
    if (bounds.width === 0 && bounds.height === 0) return null
    return (
      <>
        <div
          className="pointer-events-none absolute bg-canvas-selection-fill"
          data-testid="canvas-marquee"
          style={{
            borderColor: 'var(--canvas-selection-stroke)',
            borderStyle: 'solid',
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
            borderWidth: 1.5 / interaction.viewport.zoom,
          }}
        />
        {status && <CanvasSelectionStatus status={status} />}
      </>
    )
  }
  return (
    <>
      <svg
        className="pointer-events-none absolute left-0 top-0 overflow-visible"
        data-testid="canvas-lasso"
        width="1"
        height="1"
      >
        <polygon
          fill="var(--canvas-selection-fill)"
          points={gesture.points.map(({ x, y }) => `${x},${y}`).join(' ')}
          stroke="var(--canvas-selection-stroke)"
          strokeWidth={1.5 / interaction.viewport.zoom}
        />
      </svg>
      {status && <CanvasSelectionStatus status={status} />}
    </>
  )
}

function CanvasTextPlacementOverlay({ interaction }: { interaction: CanvasInteractionSnapshot }) {
  const gesture = interaction.interaction
  if (gesture.type !== 'placing-text') return null
  const bounds = canvasTextPlacementDragBounds(gesture.origin, gesture.current, gesture.square)
  if (bounds.width === 0 && bounds.height === 0) return null
  return (
    <div
      className="pointer-events-none absolute bg-canvas-selection-fill"
      data-testid="canvas-text-placement"
      style={{
        borderColor: 'var(--canvas-selection-stroke)',
        borderStyle: 'solid',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        borderWidth: 1.5 / interaction.viewport.zoom,
      }}
    />
  )
}

function CanvasSelectionStatus({ status }: { status: string }) {
  return (
    <span className="sr-only" role="status">
      {status}
    </span>
  )
}

function selectionStatus(selection: CanvasSelection): string {
  const nodes = `${selection.nodeIds.size} ${selection.nodeIds.size === 1 ? 'node' : 'nodes'}`
  const edges = `${selection.edgeIds.size} ${selection.edgeIds.size === 1 ? 'edge' : 'edges'}`
  return `Selecting ${nodes} and ${edges}`
}
