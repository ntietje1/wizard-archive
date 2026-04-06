import { useInternalNode, useViewport } from '@xyflow/react'
import { getMiniMapStrokePath } from '../utils/canvas-stroke-utils'
import type { InternalNode, Node } from '@xyflow/react'
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

function MiniMapStrokeNode({
  node,
  x,
  y,
  width,
  height,
  color,
  shapeRendering,
}: {
  node: InternalNode<Node>
  x: number
  y: number
  width: number
  height: number
  color?: string
  shapeRendering: string
}) {
  const { zoom } = useViewport()

  const data = node.data as StrokeNodeData
  const d = getMiniMapStrokePath(data.points, data.size, zoom)
  if (!d) return null

  const safeWidth = Math.max(data.bounds.width, 1)
  const safeHeight = Math.max(data.bounds.height, 1)

  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`${data.bounds.x} ${data.bounds.y} ${safeWidth} ${safeHeight}`}
      overflow="visible"
    >
      <path d={d} fill={color} shapeRendering={shapeRendering} />
    </svg>
  )
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
  const node = useInternalNode(id)
  if (node?.type === 'stroke') {
    return (
      <MiniMapStrokeNode
        node={node}
        x={x}
        y={y}
        width={width}
        height={height}
        color={color}
        shapeRendering={shapeRendering}
      />
    )
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
