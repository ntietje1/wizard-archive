import { useInternalNode, useViewport } from '@xyflow/react'
import { MiniMapStrokePath } from './canvas-strokes'
import type { StrokeNodeData } from './nodes/stroke-node'

interface MiniMapNodeProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: string
  borderRadius: number
  shapeRendering: string
}

export function MiniMapNode({
  id,
  x,
  y,
  width,
  height,
  color,
  borderRadius,
  shapeRendering,
}: MiniMapNodeProps) {
  const { zoom } = useViewport()
  const node = useInternalNode(id)
  if (node?.type === 'stroke') {
    const data = node.data as StrokeNodeData
    const d = MiniMapStrokePath(data.points, data.size, zoom)
    if (d) {
      return (
        <svg
          x={x}
          y={y}
          width={width}
          height={height}
          viewBox={`${data.bounds.x} ${data.bounds.y} ${data.bounds.width} ${data.bounds.height}`}
          overflow="visible"
        >
          <path d={d} fill={color} shapeRendering={shapeRendering} />
        </svg>
      )
    }
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={color}
      rx={borderRadius}
      ry={borderRadius}
      shapeRendering={shapeRendering}
    />
  )
}
