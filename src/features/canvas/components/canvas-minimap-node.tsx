import { useInternalNode } from '@xyflow/react'
import { renderCanvasNodeMinimap } from '../nodes/canvas-node-renderers'

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
  const node = useInternalNode(id)
  if (!node) return null

  const minimapNode = renderCanvasNodeMinimap(node.type, {
    id,
    x,
    y,
    width,
    height,
    color,
    borderRadius,
    shapeRendering,
  })
  if (minimapNode) return minimapNode

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
