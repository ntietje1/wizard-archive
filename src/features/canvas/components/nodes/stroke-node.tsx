import { pointsToPathD } from '../../utils/canvas-stroke-utils'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Bounds } from '../../utils/canvas-stroke-utils'
import type { Node, NodeProps } from '@xyflow/react'

export type StrokeNodeData = {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity?: number
  bounds: Bounds
}

export type StrokeNodeType = Node<StrokeNodeData, 'stroke'>

export function StrokeNode({
  id,
  data,
  selected,
  dragging,
  width,
  height,
}: NodeProps<StrokeNodeType>) {
  const { points, color, size, bounds } = data
  const isErasing = useCanvasToolStore((s) => s.erasingStrokeIds.has(id))
  const isRectDeselected = useCanvasToolStore((s) =>
    s.rectDeselectedIds.has(id),
  )
  const d = pointsToPathD(points, size)
  if (!d) return null

  const svgWidth = width ?? bounds.width
  const svgHeight = height ?? bounds.height

  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      isRectDeselected={isRectDeselected}
      minWidth={20}
      minHeight={20}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <path
          d={d}
          fill={color}
          opacity={isErasing ? 0.3 : (data.opacity ?? 100) / 100}
          style={{ pointerEvents: 'auto' }}
        />
        {selected && !isRectDeselected && (
          <path d={pointsToPathD(points, size * 0.3)} fill="var(--primary)" />
        )}
      </svg>
    </ResizableNodeWrapper>
  )
}
