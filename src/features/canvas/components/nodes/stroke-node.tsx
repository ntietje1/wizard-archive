import { pointsToPathD } from '../../utils/canvas-stroke-utils'
import { useCanvasInteractionStore } from '../../hooks/useCanvasInteractionStore'
import { ResizableNodeWrapper } from './resizable-node-wrapper'
import type { Bounds } from '../../utils/canvas-stroke-utils'
import type { Node, NodeProps } from '@xyflow/react'

const HIGHLIGHT_SCALE = 0.3
const ERASING_OPACITY = 0.3

export type StrokeNodeData = {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity?: number
  bounds: Bounds
}

export type StrokeNodeType = Node<StrokeNodeData, 'stroke'>

export function StrokePreview({
  data,
  width,
  height,
  opacityOverride,
}: {
  data: StrokeNodeData
  width: number
  height: number
  opacityOverride?: number
}) {
  const { points, color, size, bounds } = data
  const d = pointsToPathD(points, size)
  if (!d) return null

  const normalizedOpacity = opacityOverride ?? (data.opacity ?? 100) / 100

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible' }}
    >
      <path d={d} fill={color} opacity={normalizedOpacity} />
    </svg>
  )
}

export function StrokeNode({
  id,
  data,
  selected,
  dragging,
  width,
  height,
}: NodeProps<StrokeNodeType>) {
  const { points, size, bounds } = data
  const isErasing = useCanvasInteractionStore((s) => s.erasingStrokeIds.has(id))
  const isRectDeselected = useCanvasInteractionStore((s) => s.rectDeselectedIds.has(id))

  const svgWidth = width ?? bounds.width
  const svgHeight = height ?? bounds.height

  const highlightD =
    selected && !isRectDeselected ? pointsToPathD(points, size * HIGHLIGHT_SCALE) : null
  const highlightPath = highlightD ? (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      preserveAspectRatio="none"
      style={{
        overflow: 'visible',
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    >
      <path d={highlightD} fill="var(--primary)" />
    </svg>
  ) : null

  return (
    <ResizableNodeWrapper
      id={id}
      selected={!!selected}
      dragging={!!dragging}
      isRectDeselected={isRectDeselected}
      minWidth={20}
      minHeight={20}
    >
      <StrokePreview
        data={data}
        width={svgWidth}
        height={svgHeight}
        opacityOverride={isErasing ? ERASING_OPACITY : undefined}
      />
      {highlightPath}
    </ResizableNodeWrapper>
  )
}
