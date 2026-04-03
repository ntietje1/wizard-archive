import { pointsToPathD } from '../canvas-stroke-utils'
import type { Bounds } from '../canvas-stroke-utils'
import type { Node, NodeProps } from '@xyflow/react'
import { useCanvasToolStore } from '~/features/editor/stores/canvas-tool-store'

export type StrokeNodeData = {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity?: number
  bounds: Bounds
}

export type StrokeNodeType = Node<StrokeNodeData, 'stroke'>

export function StrokeNode({ id, data, selected }: NodeProps<StrokeNodeType>) {
  const { points, color, size, bounds } = data
  const isErasing = useCanvasToolStore((s) => s.erasingStrokeIds.has(id))
  const d = pointsToPathD(points, size)
  if (!d) return null

  return (
    <svg
      width={bounds.width}
      height={bounds.height}
      style={{ overflow: 'visible' }}
    >
      <g transform={`translate(${-bounds.x}, ${-bounds.y})`}>
        <path
          d={d}
          fill={color}
          opacity={isErasing ? 0.3 : (data.opacity ?? 100) / 100}
        />
        {selected && (
          <path
            d={d}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
      </g>
    </svg>
  )
}
