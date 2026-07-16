import type { CSSProperties, RefObject } from 'react'
import { canvasBoundsUnion, canvasNodeBounds } from './canvas-bounds'
import type { CanvasDocumentNode } from './document-contract'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
  CanvasResizeHandle,
} from './interaction-controller'

const CANVAS_RESIZE_HANDLES: ReadonlyArray<CanvasResizeHandle> = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
]

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
  if (interaction.tool !== 'select' || interaction.interaction.type === 'selecting') return null
  const selectedNodes = nodes.filter(
    (node) => !node.hidden && interaction.selection.nodeIds.has(node.id),
  )
  const bounds = canvasBoundsUnion(selectedNodes.map(canvasNodeBounds))
  if (!bounds) return null
  const initialNodeBounds = new Map(selectedNodes.map((node) => [node.id, canvasNodeBounds(node)]))
  return (
    <div
      className="pointer-events-none absolute border border-primary bg-primary/5"
      data-testid="canvas-selection-resize-wrapper"
      style={{
        ...bounds,
        borderWidth: 1 / interaction.viewport.zoom,
        zIndex: 2_147_483_646,
      }}
    >
      {canEdit &&
        interaction.interaction.type !== 'dragging' &&
        CANVAS_RESIZE_HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={`Resize ${handle.replace('-', ' ')}`}
            className={`pointer-events-auto absolute rounded-sm border border-primary bg-background p-0 ${resizeCursor(handle)}`}
            data-resize-handle={handle}
            data-testid={`canvas-selection-resize-zone-${handle}`}
            style={resizeHandleStyle(handle, interaction.viewport.zoom)}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              surface.current?.setPointerCapture(event.pointerId)
              interactionController.beginResize(event.pointerId, handle, bounds, initialNodeBounds)
            }}
          />
        ))}
    </div>
  )
}

function resizeHandleStyle(handle: CanvasResizeHandle, zoom: number): CSSProperties {
  const size = 12 / zoom
  const offset = -size / 2
  const style = { width: size, height: size }
  switch (handle) {
    case 'top-left':
      return { ...style, left: offset, top: offset }
    case 'top':
      return { ...style, left: `calc(50% - ${size / 2}px)`, top: offset }
    case 'top-right':
      return { ...style, right: offset, top: offset }
    case 'right':
      return { ...style, right: offset, top: `calc(50% - ${size / 2}px)` }
    case 'bottom-right':
      return { ...style, bottom: offset, right: offset }
    case 'bottom':
      return { ...style, bottom: offset, left: `calc(50% - ${size / 2}px)` }
    case 'bottom-left':
      return { ...style, bottom: offset, left: offset }
    case 'left':
      return { ...style, left: offset, top: `calc(50% - ${size / 2}px)` }
  }
}

function resizeCursor(handle: CanvasResizeHandle): string {
  if (handle === 'top' || handle === 'bottom') return 'cursor-ns-resize'
  if (handle === 'left' || handle === 'right') return 'cursor-ew-resize'
  if (handle === 'top-left' || handle === 'bottom-right') return 'cursor-nwse-resize'
  return 'cursor-nesw-resize'
}
