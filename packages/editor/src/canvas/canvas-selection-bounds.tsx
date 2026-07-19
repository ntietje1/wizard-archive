import type { ReactNode, RefObject } from 'react'
import {
  RESIZE_HANDLES,
  resizeHandleCursor,
  resizeHandleZoneStyle,
} from '../interaction/resize-handle'
import type { ResizeHandle } from '../interaction/resize-handle'
import { canvasBoundsUnion, canvasNodeBounds } from './canvas-bounds'
import type { CanvasBounds } from './canvas-bounds'
import type { CanvasDocumentNode } from './document-contract'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'
import type { CanvasSelection } from './interaction-types'
const CANVAS_SELECTION_OUTSET_PX = 3
const CANVAS_SELECTION_STROKE_WIDTH_PX = 1.5
const CANVAS_SELECTION_Z_INDEX = 30
const MOUSE_RESIZE_HIT_SIZE_PX = 18
const TOUCH_RESIZE_HIT_SIZE_PX = 36

export function CanvasNodeSelectionIndicator({ zoom }: { zoom: number }) {
  return (
    <div
      className="pointer-events-none absolute"
      data-testid="canvas-node-selection-indicator"
      style={{
        borderColor: 'var(--canvas-selection-stroke)',
        borderRadius: 2 / zoom,
        borderStyle: 'solid',
        borderWidth: CANVAS_SELECTION_STROKE_WIDTH_PX / zoom,
        inset: -CANVAS_SELECTION_OUTSET_PX / zoom,
        opacity: 'var(--canvas-selection-indicator-opacity)',
      }}
    />
  )
}

export function CanvasSelectionBounds({
  canEdit,
  interaction,
  interactionController,
  nodes,
  surface,
}: {
  canEdit: boolean
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  nodes: ReadonlyArray<CanvasDocumentNode>
  surface: RefObject<HTMLElement | null>
}) {
  if (interaction.interaction.type === 'selecting') {
    return (
      <CanvasPendingSelectionBounds
        interaction={interaction}
        nodes={nodes}
        selection={interaction.interaction.candidate}
      />
    )
  }
  if (interaction.interaction.type === 'dragging' || interaction.interaction.type === 'editing') {
    return null
  }
  const selectedNodes = getSelectedNodes(nodes, interaction.selection)
  const bounds = canvasBoundsUnion(selectedNodes.map(canvasNodeBounds))
  if (!bounds) return null
  const initialNodeBounds = new Map(selectedNodes.map((node) => [node.id, canvasNodeBounds(node)]))
  const lockedAspectRatio =
    selectedNodes.length === 1 &&
    selectedNodes[0]?.type === 'embed' &&
    typeof selectedNodes[0].data.lockedAspectRatio === 'number'
      ? selectedNodes[0].data.lockedAspectRatio
      : null
  const hitSize = resizeHitSize()
  return (
    <CanvasSelectionChrome
      bounds={bounds}
      interaction={interaction}
      testIdPrefix="canvas-selection-resize"
    >
      {canEdit &&
        RESIZE_HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={resizeHandleLabel(handle)}
            className="canvas-selection-resize-zone pointer-events-auto absolute z-[2] touch-none border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-selection-focus-ring focus-visible:ring-offset-0"
            data-resize-zone-position={handle}
            data-testid={`canvas-selection-resize-zone-${handle}`}
            style={{
              ...resizeHandleZoneStyle(handle, hitSize),
              cursor: resizeHandleCursor(handle),
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              surface.current?.setPointerCapture(event.pointerId)
              interactionController.beginResize(
                event.pointerId,
                handle,
                bounds,
                initialNodeBounds,
                lockedAspectRatio,
              )
            }}
          />
        ))}
    </CanvasSelectionChrome>
  )
}

function CanvasPendingSelectionBounds({
  interaction,
  nodes,
  selection,
}: {
  interaction: CanvasInteractionSnapshot
  nodes: ReadonlyArray<CanvasDocumentNode>
  selection: CanvasSelection | null
}) {
  if (!selection || selection.nodeIds.size === 0) return null
  const bounds = canvasBoundsUnion(getSelectedNodes(nodes, selection).map(canvasNodeBounds))
  return bounds ? (
    <CanvasSelectionChrome
      bounds={bounds}
      interaction={interaction}
      testIdPrefix="canvas-pending-selection-preview"
    />
  ) : null
}

function getSelectedNodes(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  selection: CanvasSelection,
): Array<CanvasDocumentNode> {
  const selected: Array<CanvasDocumentNode> = []
  for (const node of nodes) {
    if (!node.hidden && selection.nodeIds.has(node.id)) selected.push(node)
  }
  return selected
}

function CanvasSelectionChrome({
  bounds,
  children,
  interaction,
  testIdPrefix,
}: {
  bounds: CanvasBounds
  children?: ReactNode
  interaction: CanvasInteractionSnapshot
  testIdPrefix: string
}) {
  const screenBounds = canvasBoundsToScreenBounds(bounds, interaction)
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      data-testid={`${testIdPrefix}-wrapper`}
      style={{
        height: screenBounds.height,
        transform: `translate(${screenBounds.x}px, ${screenBounds.y}px)`,
        width: screenBounds.width,
        zIndex: CANVAS_SELECTION_Z_INDEX,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-sm bg-canvas-selection-fill"
        data-testid={`${testIdPrefix}-fill`}
      />
      <div
        className="pointer-events-none absolute rounded-sm"
        data-testid={`${testIdPrefix}-outline`}
        style={{
          borderColor: 'var(--canvas-selection-stroke)',
          borderStyle: 'solid',
          borderWidth: CANVAS_SELECTION_STROKE_WIDTH_PX,
          inset: -CANVAS_SELECTION_OUTSET_PX,
        }}
      />
      {children}
    </div>
  )
}

function canvasBoundsToScreenBounds(
  bounds: CanvasBounds,
  interaction: CanvasInteractionSnapshot,
): CanvasBounds {
  const { viewport } = interaction
  return {
    x: viewport.x + bounds.x * viewport.zoom,
    y: viewport.y + bounds.y * viewport.zoom,
    width: bounds.width * viewport.zoom,
    height: bounds.height * viewport.zoom,
  }
}

function resizeHitSize(): number {
  const coarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  const touchDevice =
    typeof navigator !== 'undefined' &&
    'maxTouchPoints' in navigator &&
    navigator.maxTouchPoints > 0
  return coarsePointer || touchDevice ? TOUCH_RESIZE_HIT_SIZE_PX : MOUSE_RESIZE_HIT_SIZE_PX
}

function resizeHandleLabel(handle: ResizeHandle): string {
  return `Resize ${handle} selection ${handle.includes('-') ? 'corner' : 'edge'}`
}
