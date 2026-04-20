import { useInternalNode, useViewport } from '@xyflow/react'
import type { CanvasNodeMinimapProps } from '../canvas-node-module-types'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { Node, NodeProps } from '@xyflow/react'
import type { StrokeNodeData, StrokeNodeType } from './stroke-node-model'
import { getMiniMapStrokePath, pointsToCenterlinePathD, pointsToPathD } from './stroke-node-model'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import { useEraseToolLocalOverlayStore } from '../../tools/erase/erase-tool-local-overlay'
import { useCanvasNodeVisualSelection } from '../shared/use-canvas-node-visual-selection'
import { getStrokeSelectionPadding } from './stroke-node-interactions'

const HIGHLIGHT_SCALE = 0.3
const ERASING_OPACITY = 0.3
const MIN_HIT_STROKE_OPACITY = 0.001

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
  dragging,
  width,
  height,
}: NodeProps<Node<StrokeNodeData>>) {
  const { points, size, bounds } = data
  const { zoom } = useViewport()
  const isErasing = useEraseToolLocalOverlayStore((state) => state.erasingStrokeIds.has(id))
  const { visuallySelected } = useCanvasNodeVisualSelection(id)

  const svgWidth = width ?? bounds.width
  const svgHeight = height ?? bounds.height
  const viewBox = resolveViewBox(bounds, svgWidth, svgHeight)
  const hitPadding = getStrokeSelectionPadding(zoom)
  const hitTargetD = pointsToCenterlinePathD(points)
  const hitTargetViewBox = viewBox
    ? {
        x: viewBox.x - hitPadding,
        y: viewBox.y - hitPadding,
        width: viewBox.width + hitPadding * 2,
        height: viewBox.height + hitPadding * 2,
      }
    : null

  const highlightD = visuallySelected ? pointsToPathD(points, size * HIGHLIGHT_SCALE) : null
  const hitTarget =
    hitTargetD && hitTargetViewBox ? (
      <svg
        width={svgWidth + hitPadding * 2}
        height={svgHeight + hitPadding * 2}
        viewBox={`${hitTargetViewBox.x} ${hitTargetViewBox.y} ${hitTargetViewBox.width} ${hitTargetViewBox.height}`}
        preserveAspectRatio="none"
        style={{
          overflow: 'visible',
          position: 'absolute',
          top: -hitPadding,
          left: -hitPadding,
        }}
      >
        <path
          d={hitTargetD}
          fill="none"
          stroke="currentColor"
          strokeOpacity={MIN_HIT_STROKE_OPACITY}
          strokeWidth={hitPadding * 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="stroke"
          data-testid="stroke-hit-target"
        />
      </svg>
    ) : null
  const highlightPath =
    highlightD && viewBox ? (
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
      nodeType="stroke"
      dragging={!!dragging}
      minWidth={20}
      minHeight={20}
    >
      {hitTarget}
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

export function StrokeMinimapNode({
  id,
  x,
  y,
  width,
  height,
  color,
  borderRadius,
  shapeRendering,
}: CanvasNodeMinimapProps) {
  return (
    <StrokeMinimapSvg
      id={id}
      x={x}
      y={y}
      width={width}
      height={height}
      color={color}
      borderRadius={borderRadius}
      shapeRendering={shapeRendering}
    />
  )
}

function StrokeMinimapSvg({
  id,
  x,
  y,
  width,
  height,
  color,
  shapeRendering,
}: CanvasNodeMinimapProps) {
  const internal = useInternalStrokeNode(id)
  if (!internal) return null

  const d = getMiniMapStrokePath(internal.data.points, internal.data.size, internal.zoom)
  if (!d || !internal.data.bounds) return null

  const viewBox = resolveViewBox(internal.data.bounds, 1, 1)
  if (!viewBox) return null

  return (
    <svg
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="none"
      overflow="visible"
    >
      <path d={d} fill={color} shapeRendering={shapeRendering} />
    </svg>
  )
}

function useInternalStrokeNode(id: string) {
  const node = useInternalNode<StrokeNodeType>(id)
  const { zoom } = useViewport()
  if (!node || node.type !== 'stroke') {
    return null
  }

  return {
    data: node.data,
    zoom,
  }
}
