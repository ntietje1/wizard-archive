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
const warnedNodeTypes = new Set<string>()

export function CanvasNodeContent({ nodeId }: { nodeId: string }) {
  return (
    <CanvasNodeContentRenderer
      nodeId={nodeId}
      renderers={NODE_RENDERERS}
      fallbackType="text"
      onUnknownNodeType={warnUnknownCanvasNodeType}
    />
  )
}

function warnUnknownCanvasNodeType(nodeType: string, expectedRenderers: ReadonlyArray<string>) {
  if (!import.meta.env.DEV || warnedNodeTypes.has(nodeType)) {
    return
  }

  console.warn('Unknown canvas node type; falling back to NODE_RENDERERS.text', {
    nodeType,
    expectedRenderers,
  })
  warnedNodeTypes.add(nodeType)
}
