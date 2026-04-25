import { memo } from 'react'
import { TextNode } from '../nodes/text/text-node'
import { EmbedNode } from '../nodes/embed/embed-node'
import { StrokeNode } from '../nodes/stroke/stroke-node'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { CanvasInternalNode } from '../system/canvas-engine'
import type { Node } from '@xyflow/react'
import type { ComponentType } from 'react'

const NODE_RENDERERS = {
  embed: EmbedNode,
  stroke: StrokeNode,
  text: TextNode,
} as const

type CanvasNodeContentSnapshot = {
  id: string
  type: keyof typeof NODE_RENDERERS
  data: Node['data']
  dragging: boolean
  selected: boolean
  width: number | undefined
  height: number | undefined
}

export const CanvasNodeContent = memo(function CanvasNodeContent({ nodeId }: { nodeId: string }) {
  const content = useCanvasEngineSelector(
    (snapshot) => selectCanvasNodeContentSnapshot(snapshot.nodeLookup.get(nodeId)),
    areCanvasNodeContentSnapshotsEqual,
  )

  if (!content) {
    return null
  }

  const Component = NODE_RENDERERS[content.type] as ComponentType<CanvasNodeComponentProps>
  return (
    <div className="canvas-node-content h-full w-full" style={{ contain: 'layout style' }}>
      <Component
        id={content.id}
        type={content.type}
        data={content.data}
        dragging={content.dragging}
        selected={content.selected}
        width={content.width}
        height={content.height}
      />
    </div>
  )
})

function selectCanvasNodeContentSnapshot(
  internalNode: CanvasInternalNode | undefined,
): CanvasNodeContentSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  const type =
    node.type === 'embed' || node.type === 'stroke' || node.type === 'text' ? node.type : 'text'
  return {
    id: node.id,
    type,
    data: node.data,
    dragging: internalNode.dragging,
    selected: internalNode.selected,
    width: node.width ?? internalNode.measured.width,
    height: node.height ?? internalNode.measured.height,
  }
}

function areCanvasNodeContentSnapshotsEqual(
  left: CanvasNodeContentSnapshot | null,
  right: CanvasNodeContentSnapshot | null,
) {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return (
    left.id === right.id &&
    left.type === right.type &&
    left.data === right.data &&
    left.dragging === right.dragging &&
    left.selected === right.selected &&
    left.width === right.width &&
    left.height === right.height
  )
}
