import { memo, useEffect, useRef } from 'react'
import { BezierCanvasEdge } from '../edges/bezier/bezier-canvas-edge'
import type { CanvasEdgeType } from '../edges/canvas-edge-types'
import { StepCanvasEdge } from '../edges/step/step-canvas-edge'
import { StraightCanvasEdge } from '../edges/straight/straight-canvas-edge'
import { useCanvasEngine, useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { Edge } from '@xyflow/react'
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react'

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
  onEdgeClick?: (event: ReactMouseEvent, edge: Edge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: Edge) => void
}) {
  const internalEdge = useCanvasEngineSelector((snapshot) => snapshot.edgeLookup.get(edgeId))
  const canvasEngine = useCanvasEngine()
  const edgeRef = useRef<SVGGElement | null>(null)

  useEffect(() => canvasEngine.registerEdgeElement(edgeId, edgeRef.current), [canvasEngine, edgeId])

  if (!internalEdge || !internalEdge.visible) {
    return null
  }

  const edge = internalEdge.edge
  const type = resolveEdgeType(edge.type)
  const Component = EDGE_RENDERERS[type] as ComponentType<Record<string, unknown>>
  const props = {
    ...edge,
    type,
    sourceHandleId: edge.sourceHandle ?? undefined,
    targetHandleId: edge.targetHandle ?? undefined,
    selected: internalEdge.selected,
  }

  return (
    <g
      ref={edgeRef}
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
