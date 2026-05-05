import { memo, useCallback, useRef } from 'react'
import { BezierCanvasEdge } from '../edges/bezier/bezier-canvas-edge'
import type { CanvasEdgeRendererProps } from '../edges/canvas-edge-types'
import { StepCanvasEdge } from '../edges/step/step-canvas-edge'
import { StraightCanvasEdge } from '../edges/straight/straight-canvas-edge'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useCanvasViewportRuntime } from '../runtime/providers/canvas-runtime'
import type { CanvasDocumentEdge, CanvasEdgeType } from 'convex/canvases/validation'
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react'

type EdgeRendererProps = CanvasEdgeRendererProps<CanvasEdgeType>

const EDGE_RENDERERS = {
  bezier: BezierCanvasEdge,
  straight: StraightCanvasEdge,
  step: StepCanvasEdge,
} as const

export const CanvasEdgeWrapper = memo(function CanvasEdgeWrapper({
  edgeId,
  onEdgeClick,
  onEdgeContextMenu,
}: {
  edgeId: string
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const internalEdge = useCanvasEngineSelector((snapshot) => snapshot.edgeLookup.get(edgeId))
  const { domRuntime } = useCanvasViewportRuntime()
  const unregisterEdgeRef = useRef<(() => void) | null>(null)

  const setEdgeRef = useCallback(
    (element: SVGGElement | null) => {
      unregisterEdgeRef.current?.()
      unregisterEdgeRef.current = null
      if (element) {
        unregisterEdgeRef.current = domRuntime.registerEdgeElement(edgeId, element)
      }
    },
    [domRuntime, edgeId],
  )

  if (!internalEdge || !internalEdge.visible) {
    return null
  }

  const edge = internalEdge.edge
  const type = resolveEdgeType(edge.type)
  const Component = EDGE_RENDERERS[type] as ComponentType<EdgeRendererProps>
  const props = {
    ...edge,
    type,
    sourceHandleId: edge.sourceHandle ?? undefined,
    targetHandleId: edge.targetHandle ?? undefined,
    selected: internalEdge.selected,
  } as EdgeRendererProps

  return (
    <g
      ref={setEdgeRef}
      className="pointer-events-auto"
      data-canvas-edge-id={edge.id}
      onClick={(event) => onEdgeClick?.(event, edge)}
      onContextMenu={(event) => onEdgeContextMenu(event, edge)}
    >
      <Component {...props} />
    </g>
  )
})

function resolveEdgeType(type: string | undefined): CanvasEdgeType {
  return type === 'straight' || type === 'step' || type === 'bezier' ? type : 'bezier'
}
