import { useEffect, useRef } from 'react'
import { getCanvasEdgeInteractionWidth } from './canvas-edge-geometry'
import {
  buildCanvasEdgeRenderStyle,
  normalizeCanvasEdgeStyle,
  PENDING_PREVIEW_EDGE_OPACITY,
} from './canvas-edge-style'
import { useCanvasEdgeVisualSelection } from './use-canvas-edge-visual-selection'
import { resolveCanvasScreenMinimumStrokeWidthCss } from '../../utils/canvas-screen-stroke-width'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'
import type { CSSProperties, Ref } from 'react'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasDomRuntime } from '../../runtime/providers/canvas-runtime'

const CANVAS_EDGE_PATH_STYLE: CSSProperties = {
  strokeLinecap: 'square',
  strokeLinejoin: 'round',
}
const SELECTED_EDGE_HIGHLIGHT_STYLE: CSSProperties = {
  ...CANVAS_EDGE_PATH_STYLE,
  stroke: 'var(--primary)',
  fill: 'none',
  pointerEvents: 'none',
}
const SELECTED_EDGE_HIGHLIGHT_SCALE = 0.15
const SELECTED_EDGE_HIGHLIGHT_WIDTH_MIN = 1

export interface CanvasPathEdgeGeometry {
  path: string
  labelX: number
  labelY: number
}

export function CanvasPathEdge({
  props,
  geometry,
}: {
  props: CanvasEdgeRendererProps
  geometry: CanvasPathEdgeGeometry | null
}) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const domRuntime = useCanvasDomRuntime()
  const pathRef = useRef<SVGPathElement | null>(null)
  const highlightPathRef = useRef<SVGPathElement | null>(null)
  const interactionPathRef = useRef<SVGPathElement | null>(null)
  const { visuallySelected, pendingPreviewActive, pendingSelected, selected } =
    useCanvasEdgeVisualSelection(props.id)
  const hasSelectedHighlight = interactiveRenderMode && visuallySelected
  const hasGeometry = geometry !== null
  useEffect(() => {
    if (!hasGeometry) {
      return undefined
    }

    return domRuntime.registerEdgePaths(props.id, {
      path: pathRef.current,
      highlightPath: highlightPathRef.current,
      interactionPath: interactionPathRef.current,
    })
  }, [domRuntime, props.id, hasGeometry, hasSelectedHighlight, interactiveRenderMode])

  return (
    <CanvasPathEdgeVisual
      geometry={geometry}
      id={props.id}
      type={props.type}
      style={props.style}
      interactive={interactiveRenderMode}
      selected={selected}
      visuallySelected={visuallySelected}
      pendingPreviewActive={pendingPreviewActive}
      pendingSelected={pendingSelected}
      showSelectedHighlight={hasSelectedHighlight}
      pathRef={pathRef}
      highlightPathRef={highlightPathRef}
      interactionPathRef={interactionPathRef}
    />
  )
}

export function CanvasPathEdgeVisual({
  geometry,
  id,
  type,
  style,
  interactive = false,
  selected = false,
  visuallySelected = false,
  pendingPreviewActive = false,
  pendingSelected = false,
  showSelectedHighlight = false,
  pathRef,
  highlightPathRef,
  interactionPathRef,
}: {
  geometry: CanvasPathEdgeGeometry | null
  id: string
  type: string
  style?: CanvasEdgeRendererProps['style']
  interactive?: boolean
  selected?: boolean
  visuallySelected?: boolean
  pendingPreviewActive?: boolean
  pendingSelected?: boolean
  showSelectedHighlight?: boolean
  pathRef?: Ref<SVGPathElement>
  highlightPathRef?: Ref<SVGPathElement>
  interactionPathRef?: Ref<SVGPathElement>
}) {
  if (!geometry) return null

  const normalizedStyle = normalizeCanvasEdgeStyle(style)
  const edgeStyle = {
    ...CANVAS_EDGE_PATH_STYLE,
    ...buildCanvasEdgeRenderStyle(normalizedStyle),
    opacity:
      pendingPreviewActive && pendingSelected
        ? PENDING_PREVIEW_EDGE_OPACITY
        : normalizedStyle.opacity,
  }
  const selectedHighlightStrokeWidth = Math.max(
    normalizedStyle.strokeWidth * SELECTED_EDGE_HIGHLIGHT_SCALE,
    SELECTED_EDGE_HIGHLIGHT_WIDTH_MIN,
  )
  const selectedHighlightStyle = showSelectedHighlight
    ? {
        ...SELECTED_EDGE_HIGHLIGHT_STYLE,
        strokeWidth: resolveCanvasScreenMinimumStrokeWidthCss(selectedHighlightStrokeWidth),
      }
    : null

  return (
    <g
      data-testid="canvas-edge"
      data-edge-id={id}
      data-edge-type={type}
      data-edge-selected={selected ? 'true' : 'false'}
      data-edge-visual-selected={visuallySelected ? 'true' : 'false'}
      data-edge-pending-preview-active={pendingPreviewActive ? 'true' : 'false'}
      data-edge-pending-selected={pendingSelected ? 'true' : 'false'}
    >
      <path
        ref={pathRef}
        id={id}
        d={geometry.path}
        fill="none"
        style={edgeStyle}
        data-canvas-authored-stroke-width={normalizedStyle.strokeWidth}
        data-testid="canvas-edge-primary-path"
      />
      {interactive ? (
        <path
          ref={interactionPathRef}
          d={geometry.path}
          fill="none"
          stroke="transparent"
          strokeWidth={getCanvasEdgeInteractionWidth()}
          pointerEvents="stroke"
          data-testid="canvas-edge-interaction"
        />
      ) : null}
      {selectedHighlightStyle ? (
        <path
          ref={highlightPathRef}
          d={geometry.path}
          style={selectedHighlightStyle}
          data-canvas-authored-stroke-width={selectedHighlightStrokeWidth}
          data-testid="canvas-edge-selection-highlight"
        />
      ) : null}
    </g>
  )
}
