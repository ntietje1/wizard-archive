import { useEffect, useRef } from 'react'
import { getCanvasEdgeInteractionWidth } from './canvas-edge-geometry'
import {
  buildCanvasEdgeRenderStyle,
  normalizeCanvasEdgeStyle,
  PENDING_PREVIEW_EDGE_OPACITY,
} from './canvas-edge-style'
import { useCanvasEdgeVisualSelection } from './use-canvas-edge-visual-selection'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'
import type { CSSProperties } from 'react'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'

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

interface CanvasPathEdgeGeometry {
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
  const { domRuntime } = useCanvasRuntime()
  const pathRef = useRef<SVGPathElement | null>(null)
  const highlightPathRef = useRef<SVGPathElement | null>(null)
  const interactionPathRef = useRef<SVGPathElement | null>(null)
  const { visuallySelected, pendingPreviewActive, pendingSelected, selected } =
    useCanvasEdgeVisualSelection(props.id)
  const hasSelectedHighlight = interactiveRenderMode && visuallySelected
  useEffect(() => {
    return domRuntime.registerEdgePaths(props.id, {
      path: pathRef.current,
      highlightPath: highlightPathRef.current,
      interactionPath: interactionPathRef.current,
    })
  }, [domRuntime, props.id, hasSelectedHighlight])

  if (!geometry) return null

  const normalizedStyle = normalizeCanvasEdgeStyle(props.style)
  const style = {
    ...CANVAS_EDGE_PATH_STYLE,
    ...buildCanvasEdgeRenderStyle(normalizedStyle),
    opacity:
      pendingPreviewActive && pendingSelected
        ? PENDING_PREVIEW_EDGE_OPACITY
        : normalizedStyle.opacity,
  }
  const selectedHighlightStyle = hasSelectedHighlight
    ? {
        ...SELECTED_EDGE_HIGHLIGHT_STYLE,
        strokeWidth: Math.max(
          normalizedStyle.strokeWidth * SELECTED_EDGE_HIGHLIGHT_SCALE,
          SELECTED_EDGE_HIGHLIGHT_WIDTH_MIN,
        ),
      }
    : null

  return (
    <g
      data-testid="canvas-edge"
      data-edge-id={props.id}
      data-edge-type={props.type}
      data-edge-selected={selected ? 'true' : 'false'}
      data-edge-visual-selected={visuallySelected ? 'true' : 'false'}
      data-edge-pending-preview-active={pendingPreviewActive ? 'true' : 'false'}
      data-edge-pending-selected={pendingSelected ? 'true' : 'false'}
    >
      <path
        ref={pathRef}
        id={props.id}
        d={geometry.path}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        fill="none"
        style={style}
        data-testid="canvas-edge-primary-path"
      />
      {interactiveRenderMode ? (
        <path
          ref={interactionPathRef}
          d={geometry.path}
          fill="none"
          stroke="transparent"
          strokeWidth={props.interactionWidth ?? getCanvasEdgeInteractionWidth()}
          pointerEvents="stroke"
          data-testid="canvas-edge-interaction"
        />
      ) : null}
      {selectedHighlightStyle ? (
        <path
          ref={highlightPathRef}
          d={geometry.path}
          style={selectedHighlightStyle}
          data-testid="canvas-edge-selection-highlight"
        />
      ) : null}
    </g>
  )
}
