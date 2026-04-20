import { BaseEdge } from '@xyflow/react'
import {
  buildBezierCanvasEdgeGeometryFromRenderProps,
  getBezierCanvasEdgeInteractionWidth,
} from './bezier-canvas-edge-geometry'
import { useCanvasEdgeVisualSelection } from '../shared/use-canvas-edge-visual-selection'
import type { CanvasEdgeRendererProps } from '../canvas-edge-module-types'
import type { CSSProperties } from 'react'

const SELECTED_EDGE_STYLE: CSSProperties = {
  stroke: 'var(--primary)',
  strokeWidth: 1.5,
}

export function BezierCanvasEdge(props: CanvasEdgeRendererProps) {
  const { visuallySelected, pendingPreviewActive, pendingSelected } = useCanvasEdgeVisualSelection(
    props.id,
    !!props.selected,
  )
  const geometry = buildBezierCanvasEdgeGeometryFromRenderProps(props)
  if (!geometry) return null

  const style = visuallySelected
    ? {
        ...props.style,
        ...SELECTED_EDGE_STYLE,
        opacity: pendingPreviewActive && pendingSelected ? 0.45 : props.style?.opacity,
      }
    : props.style

  return (
    <g
      data-testid="canvas-edge"
      data-edge-id={props.id}
      data-edge-type={props.type}
      data-edge-selected={props.selected ? 'true' : 'false'}
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
        interactionWidth={props.interactionWidth ?? getBezierCanvasEdgeInteractionWidth()}
        style={style}
      />
    </g>
  )
}
