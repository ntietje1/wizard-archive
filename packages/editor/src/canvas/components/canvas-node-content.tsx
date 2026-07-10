import { CanvasNodeContentRenderer } from './canvas-node-content-renderer'
import { TextNode } from '../nodes/text/text-node'
import { EmbedNode } from '../nodes/embed/embed-node'
import { StrokeNode } from '../nodes/stroke/stroke-node'
import type { CanvasNodeRendererMap } from './canvas-node-content-renderer'

const NODE_RENDERERS = {
  embed: EmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const satisfies CanvasNodeRendererMap

export function CanvasNodeContent({ nodeId }: { nodeId: string }) {
  return <CanvasNodeContentRenderer nodeId={nodeId} renderers={NODE_RENDERERS} />
}
