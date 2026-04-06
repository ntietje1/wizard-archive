import { useCallback } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { pointNearStrokePath } from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'

const STROKE_HIT_PADDING_PX = 12

export function useCanvasStrokeClick() {
  const reactFlow = useReactFlow()
  const { zoom } = useViewport()

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const flowPos = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const threshold = STROKE_HIT_PADDING_PX / zoom
      const strokeNodes = reactFlow
        .getNodes()
        .filter((n) => n.type === 'stroke')

      for (const node of strokeNodes) {
        const data = node.data as StrokeNodeData
        const offsetX = node.position.x - data.bounds.x
        const offsetY = node.position.y - data.bounds.y
        const adjustedPoints = data.points.map(
          ([x, y, p]) =>
            [x + offsetX, y + offsetY, p] as [number, number, number],
        )

        if (
          pointNearStrokePath(
            flowPos.x,
            flowPos.y,
            adjustedPoints,
            data.size,
            threshold,
          )
        ) {
          const isMultiSelect = event.shiftKey
          const targetId = node.id
          // Deferred to apply after ReactFlow's internal pane-click deselection
          queueMicrotask(() => {
            reactFlow.setNodes((nodes) =>
              nodes.map((n) => ({
                ...n,
                selected:
                  n.id === targetId ? true : isMultiSelect && !!n.selected,
              })),
            )
          })
          return
        }
      }
    },
    [reactFlow, zoom],
  )

  return onPaneClick
}
