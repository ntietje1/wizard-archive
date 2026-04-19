import { EmbedNode } from './embed/embed-node'
import { RectangleNode } from './rectangle/rectangle-node'
import { StickyNode } from './sticky/sticky-node'
import { StrokeNode } from './stroke/stroke-node'
import { TextNode } from './text/text-node'
import { buildCanvasNodeTypes } from './canvas-node-module-types'

export const canvasNodeTypes = buildCanvasNodeTypes([
  ['embed', EmbedNode],
  ['rectangle', RectangleNode],
  ['sticky', StickyNode],
  ['stroke', StrokeNode],
  ['text', TextNode],
])
