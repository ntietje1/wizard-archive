import { useEffect, useRef } from 'react'
import type { Ref } from 'react'
import type { CanvasNodeComponentProps } from '../canvas-node-types'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { StrokeNodeData } from './stroke-node-model'
import { pointsToCenterlinePathD } from './stroke-node-model'
import { getCachedStrokeDetailPath } from './stroke-path-cache'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import { useEraseToolLocalOverlayStore } from '../../tools/erase/erase-tool-local-overlay'
import { useCanvasNodeVisualSelection } from '../shared/use-canvas-node-visual-selection'
import { getStrokeSelectionPadding } from './stroke-node-interactions'
import { resolveCanvasScreenMinimumStrokeWidth } from '../../utils/canvas-screen-stroke-width'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasViewportRuntime } from '../../runtime/providers/canvas-runtime'

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

export function StrokeVisual({
  id,
  data,
  width,
  height,
  opacityOverride,
  detailSize,
  highlightD,
  pathRef,
  highlightPathRef,
}: {
  id: string
  data: StrokeNodeData
  width?: number
  height?: number
  opacityOverride?: number
  detailSize: number
  highlightD: string | null
  pathRef?: Ref<SVGPathElement>
  highlightPathRef?: Ref<SVGPathElement>
}) {
  const { color = 'transparent', bounds } = data
  const detailD = getCachedStrokeDetailPath(id, data, detailSize)
  if (!detailD && !highlightD) return null

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
      className="canvas-stroke-visual"
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
      {highlightD ? (
        <path
          ref={highlightPathRef}
          className="canvas-stroke-highlight-path"
          d={highlightD}
          fill="var(--primary)"
        />
      ) : null}
      {detailD ? (
        <path
          ref={pathRef}
          className="canvas-stroke-detail-path"
          d={detailD}
          fill={color}
          opacity={normalizedOpacity}
        />
      ) : null}
    </svg>
  )
}

export function StrokeNode({
  id,
  data,
  dragging,
  width,
  height,
}: CanvasNodeComponentProps<StrokeNodeData>) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const { domRuntime, viewportController } = useCanvasViewportRuntime()
  const { size, bounds } = data
  const zoom = viewportController?.getZoom() ?? 1
  const isErasing = useEraseToolLocalOverlayStore((state) => state.erasingStrokeIds.has(id))
  const { visuallySelected } = useCanvasNodeVisualSelection(id)

  const svgWidth = width ?? bounds.width
  const svgHeight = height ?? bounds.height
  const viewBox = resolveViewBox(bounds, svgWidth, svgHeight)
  const hitPadding = getStrokeSelectionPadding(zoom)
  const hitTargetD = pointsToCenterlinePathD(data.points)
  const hitTargetViewBox = viewBox
    ? {
        x: viewBox.x - hitPadding,
        y: viewBox.y - hitPadding,
        width: viewBox.width + hitPadding * 2,
        height: viewBox.height + hitPadding * 2,
      }
    : null

  const detailSize = resolveCanvasScreenMinimumStrokeWidth(size, zoom)
  const highlightSize = resolveCanvasScreenMinimumStrokeWidth(size * HIGHLIGHT_SCALE, zoom)
  const highlightD = visuallySelected ? getCachedStrokeDetailPath(id, data, highlightSize) : null
  const pathRef = useRef<SVGPathElement | null>(null)
  const highlightPathRef = useRef<SVGPathElement | null>(null)

  useEffect(() => {
    if (!highlightD) {
      highlightPathRef.current = null
    }

    return domRuntime.registerStrokeNodePaths(id, {
      path: pathRef.current,
      highlightPath: highlightD ? highlightPathRef.current : null,
      data,
    })
  }, [data, domRuntime, highlightD, id])
  const hitTarget =
    interactiveRenderMode && hitTargetD && hitTargetViewBox ? (
      <svg
        className="canvas-stroke-hit-target-layer"
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
  return (
    <ResizableNodeWrapper
      id={id}
      nodeType="stroke"
      dragging={!!dragging}
      minWidth={20}
      minHeight={20}
    >
      {hitTarget}
      <StrokeVisual
        id={id}
        data={data}
        width={svgWidth}
        height={svgHeight}
        opacityOverride={interactiveRenderMode && isErasing ? ERASING_OPACITY : undefined}
        detailSize={detailSize}
        highlightD={interactiveRenderMode ? highlightD : null}
        pathRef={pathRef}
        highlightPathRef={highlightPathRef}
      />
    </ResizableNodeWrapper>
  )
}
