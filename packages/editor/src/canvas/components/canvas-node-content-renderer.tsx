import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import {
  areNullableCanvasSnapshotsEqual,
  resolveCanvasNodeRenderSize,
} from './canvas-renderer-utils'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../system/canvas-engine-types'
import type { CanvasNodeComponentProps } from '../nodes/canvas-node-types'
import type { ComponentType } from 'react'
import type { CanvasDocumentNode, CanvasNodeType } from '../document-contract'

export type CanvasNodeRendererMap = {
  [TType in CanvasNodeType]: ComponentType<CanvasNodeComponentProps<TType>>
}

type CanvasNodeContentSnapshot = {
  id: string
  type: CanvasNodeType
  data: CanvasDocumentNode['data']
  dragging: boolean
  selected: boolean
  width: number | undefined
  height: number | undefined
}

interface CanvasNodeContentRendererProps {
  nodeId: string
  renderers: CanvasNodeRendererMap
}

export function CanvasNodeContentRenderer({ nodeId, renderers }: CanvasNodeContentRendererProps) {
  const content = useCanvasEngineSelector(
    (snapshot: CanvasEngineSnapshot) =>
      selectCanvasNodeContentSnapshot({
        internalNode: snapshot.nodeLookup.get(nodeId),
      }),
    areCanvasNodeContentSnapshotsEqual,
  )

  if (!content) {
    return null
  }

  const Component = renderers[content.type] as ComponentType<
    CanvasNodeComponentProps<typeof content.type>
  >

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
}

function selectCanvasNodeContentSnapshot({
  internalNode,
}: {
  internalNode: CanvasInternalNode | undefined
}): CanvasNodeContentSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  const size = resolveCanvasNodeRenderSize(internalNode)

  return {
    id: node.id,
    type: node.type,
    data: node.data,
    dragging: internalNode.dragging,
    selected: internalNode.selected,
    width: size.width,
    height: size.height,
  }
}

function areCanvasNodeContentSnapshotsEqual(
  left: CanvasNodeContentSnapshot | null,
  right: CanvasNodeContentSnapshot | null,
) {
  return areNullableCanvasSnapshotsEqual(
    left,
    right,
    (leftSnapshot, rightSnapshot) =>
      leftSnapshot.id === rightSnapshot.id &&
      leftSnapshot.type === rightSnapshot.type &&
      leftSnapshot.data === rightSnapshot.data &&
      leftSnapshot.dragging === rightSnapshot.dragging &&
      leftSnapshot.selected === rightSnapshot.selected &&
      leftSnapshot.width === rightSnapshot.width &&
      leftSnapshot.height === rightSnapshot.height,
  )
}
