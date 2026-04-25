import { EmbedNode } from './embed/embed-node'
import { StrokeMinimapNode, StrokeNode } from './stroke/stroke-node'
import { TextNode } from './text/text-node'
import type { CanvasNodeMinimapProps } from './canvas-node-types'
import type { ReactNode } from 'react'

export const canvasNodeTypes = {
  embed: EmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const

export function renderCanvasNodeMinimap(
  type: string | undefined,
  props: CanvasNodeMinimapProps,
): ReactNode {
  const minimapProps = {
    ...props,
    borderRadius: props.borderRadius ?? 0,
    shapeRendering: props.shapeRendering ?? 'geometricPrecision',
  }

  return type === 'stroke' ? <StrokeMinimapNode {...minimapProps} /> : null
}
