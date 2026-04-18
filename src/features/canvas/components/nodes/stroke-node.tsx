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

function resolveSvgDimension(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function resolveViewBox(bounds: Bounds, fallbackWidth: number, fallbackHeight: number) {
  const width = resolveSvgDimension(bounds.width, fallbackWidth)
  const height = resolveSvgDimension(bounds.height, fallbackHeight)
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null
  }

  return {
    x: Number.isFinite(bounds.x) ? bounds.x : 0,
    y: Number.isFinite(bounds.y) ? bounds.y : 0,
    width,
    height,
  }
}

export function StrokePreview({
  data,
  width,
  height,
  opacityOverride,
}: {
  data: StrokeNodeData
  width?: number
  height?: number
  opacityOverride?: number
}) {
  const { points, color, size, bounds } = data
  const d = pointsToPathD(points, size)
  if (!d) return null

  const normalizedOpacity = opacityOverride ?? (data.opacity ?? 100) / 100
  const svgWidth = resolveSvgDimension(width, bounds.width)
  const svgHeight = resolveSvgDimension(height, bounds.height)
  const viewBox = resolveViewBox(bounds, svgWidth, svgHeight)
  if (
    !Number.isFinite(svgWidth) ||
    svgWidth <= 0 ||
    !Number.isFinite(svgHeight) ||
    svgHeight <= 0 ||
    !viewBox
  ) {
    return null
  }

  return (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
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
  const viewBox = resolveViewBox(bounds, svgWidth, svgHeight)

  const highlightD =
    selected && !isRectDeselected ? pointsToPathD(points, size * HIGHLIGHT_SCALE) : null
  const highlightPath = highlightD && viewBox ? (
    <svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
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
