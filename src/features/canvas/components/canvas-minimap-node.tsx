import { useInternalNode } from '@xyflow/react'
import { getCanvasNodeModuleByType } from './nodes/canvas-node-registry'

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
  const module = getCanvasNodeModuleByType(node.type)
  if (module?.renderMinimap) {
    return module.renderMinimap({
      id,
      x,
      y,
      width,
      height,
      color,
      borderRadius,
      shapeRendering,
    })
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
