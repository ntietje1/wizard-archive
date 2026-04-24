import { BaseEdge } from '@xyflow/react'
import { getCanvasEdgeInteractionWidth } from './canvas-edge-geometry'
import { buildCanvasEdgeRenderStyle, normalizeCanvasEdgeStyle } from './canvas-edge-style'
import { useCanvasEdgeVisualSelection } from './use-canvas-edge-visual-selection'
import type { CanvasEdgeRendererProps } from '../canvas-edge-types'
import type { CSSProperties } from 'react'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'

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
  const { visuallySelected, pendingPreviewActive, pendingSelected, selected } =
    useCanvasEdgeVisualSelection(props.id)
  if (!geometry) return null

  const normalizedStyle = normalizeCanvasEdgeStyle(props.style)
  const style = {
    ...CANVAS_EDGE_PATH_STYLE,
    ...buildCanvasEdgeRenderStyle(normalizedStyle),
    opacity: pendingPreviewActive && pendingSelected ? 0.45 : normalizedStyle.opacity,
  }
  const selectedHighlightStyle =
    interactiveRenderMode && visuallySelected
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
      <BaseEdge
        id={props.id}
        path={geometry.path}
        labelX={geometry.labelX}
        labelY={geometry.labelY}
        label={props.label}
        labelStyle={props.labelStyle}
        labelShowBg={props.labelShowBg}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        interactionWidth={
          interactiveRenderMode ? (props.interactionWidth ?? getCanvasEdgeInteractionWidth()) : 0
        }
        style={style}
      />
      {selectedHighlightStyle ? (
        <path
          d={geometry.path}
          style={selectedHighlightStyle}
          data-testid="canvas-edge-selection-highlight"
        />
      ) : null}
    </g>
  )
}
