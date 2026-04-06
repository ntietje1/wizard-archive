import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { pointNearStrokePath } from '../utils/canvas-stroke-utils'
import type { StrokeNodeData } from '../components/nodes/stroke-node'

const STROKE_HIT_PADDING_PX = 12

export function useCanvasStrokeClick() {
  const reactFlow = useReactFlow()

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const flowPos = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const threshold = STROKE_HIT_PADDING_PX / reactFlow.getZoom()
      const strokeNodes = reactFlow
        .getNodes()
        .filter((n) => n.type === 'stroke')

      for (let i = strokeNodes.length - 1; i >= 0; i--) {
        const node = strokeNodes[i]
        const data = node.data as StrokeNodeData
        if (
          !data?.bounds ||
          !Array.isArray(data.points) ||
          typeof data.size !== 'number' ||
          data.size <= 0
        )
          continue

        const offsetX = node.position.x - data.bounds.x
        const offsetY = node.position.y - data.bounds.y
        const bboxLeft = node.position.x - threshold
        const bboxRight = node.position.x + data.bounds.width + threshold
        const bboxTop = node.position.y - threshold
        const bboxBottom = node.position.y + data.bounds.height + threshold
        if (
          flowPos.x < bboxLeft ||
          flowPos.x > bboxRight ||
          flowPos.y < bboxTop ||
          flowPos.y > bboxBottom
        )
          continue

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
          // microtask needed to prevent ReactFlow's internal pane-click handler
          // from immediately deselecting the node we just selected here
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
    [reactFlow],
  )

  return onPaneClick
}
