import { useEffect, useRef } from 'react'
import type { Ref } from 'react'
import type { CanvasNodeComponentProps, CanvasNodeMinimapProps } from '../canvas-node-types'
import type { CanvasConnectionHandleDescriptor } from '../shared/canvas-node-connection-handles'
import { ResizableNodeWrapper } from '../shared/resizable-node-wrapper'
import type { StrokeEndpoint, StrokeNodeData, StrokeNodeType } from './stroke-node-model'
import {
  getAbsoluteStrokePointsForNode,
  getMiniMapStrokePath,
  getStrokeEndpointConnectionPosition,
  getStrokeEndpointPoint,
  pointsToCenterlinePathD,
} from './stroke-node-model'
import { getCachedStrokeDetailPath } from './stroke-path-cache'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import { useEraseToolLocalOverlayStore } from '../../tools/erase/erase-tool-local-overlay'
import { useCanvasNodeVisualSelection } from '../shared/use-canvas-node-visual-selection'
import { CanvasNodeConnectionHandles } from '../shared/canvas-node-connection-handles'
import { getStrokeSelectionPadding } from './stroke-node-interactions'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'

const HIGHLIGHT_SCALE = 0.3
const ERASING_OPACITY = 0.3
const MIN_HIT_STROKE_OPACITY = 0.001
const STROKE_CONNECTION_ENDPOINTS: ReadonlyArray<StrokeEndpoint> = ['start', 'end']

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

function getStrokeConnectionHandles(data: StrokeNodeData): Array<CanvasConnectionHandleDescriptor> {
  const strokeNode = {
    position: { x: data.bounds.x, y: data.bounds.y },
    data,
  }

  return STROKE_CONNECTION_ENDPOINTS.flatMap((endpoint) => {
    const absolutePoints = getAbsoluteStrokePointsForNode(strokeNode)
    const point = getStrokeEndpointPoint(strokeNode, endpoint, absolutePoints)
    if (!point) {
      return []
    }

    return [
      {
        id: endpoint,
        position: getStrokeEndpointConnectionPosition(strokeNode, endpoint, absolutePoints),
        style: {
          left: point.x - data.bounds.x,
          top: point.y - data.bounds.y,
          right: 'auto',
          bottom: 'auto',
          transform: 'translate(-50%, -50%)',
        },
      } satisfies CanvasConnectionHandleDescriptor,
    ]
  })
}

function StrokeVisual({
  id,
  data,
  width,
  height,
  opacityOverride,
  highlightD,
  pathRef,
  highlightPathRef,
}: {
  id: string
  data: StrokeNodeData
  width?: number
  height?: number
  opacityOverride?: number
  highlightD: string | null
  pathRef?: Ref<SVGPathElement>
  highlightPathRef?: Ref<SVGPathElement>
}) {
  const { color, bounds } = data
  const detailD = getCachedStrokeDetailPath(id, data)
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
  const { canvasEngine, viewportController } = useCanvasRuntime()
  const { size, bounds } = data
  const zoom = viewportController?.getZoom?.() ?? 1
  const isErasing = useEraseToolLocalOverlayStore((state) => state.erasingStrokeIds.has(id))
  const { visuallySelected } = useCanvasNodeVisualSelection(id)
  const connectionHandles = getStrokeConnectionHandles(data)

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

  const highlightD = visuallySelected
    ? getCachedStrokeDetailPath(id, data, size * HIGHLIGHT_SCALE)
    : null
  const pathRef = useRef<SVGPathElement | null>(null)
  const highlightPathRef = useRef<SVGPathElement | null>(null)

  useEffect(
    () =>
      canvasEngine.registerStrokeNodePaths(id, {
        path: pathRef.current,
        highlightPath: highlightPathRef.current,
      }),
    [canvasEngine, highlightD, id],
  )
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
      chrome={<CanvasNodeConnectionHandles handles={connectionHandles} />}
    >
      {hitTarget}
      <StrokeVisual
        id={id}
        data={data}
        width={svgWidth}
        height={svgHeight}
        opacityOverride={interactiveRenderMode && isErasing ? ERASING_OPACITY : undefined}
        highlightD={interactiveRenderMode ? highlightD : null}
        pathRef={pathRef}
        highlightPathRef={highlightPathRef}
      />
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
  const { canvasEngine, viewportController } = useCanvasRuntime()
  const node = canvasEngine.getSnapshot().nodeLookup.get(id)?.node as StrokeNodeType | undefined
  if (!node || node.type !== 'stroke') {
    return null
  }

  return {
    data: node.data,
    zoom: viewportController?.getZoom?.() ?? 1,
  }
}
