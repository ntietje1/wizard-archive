import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../system/canvas-engine-types'
import type {
  CanvasNodeComponentDataByType,
  CanvasNodeComponentProps,
} from '../nodes/canvas-node-types'
import type { ComponentType } from 'react'
import type { CanvasDocumentNode, CanvasNodeType } from '~/features/canvas/domain/canvas-document'

type CanvasNodeDataUnion = CanvasNodeComponentDataByType[CanvasNodeType]

export type CanvasNodeRendererMap = {
  [TType in CanvasNodeType]: ComponentType<
    CanvasNodeComponentProps<CanvasNodeComponentDataByType[TType]>
  >
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
    CanvasNodeComponentProps<CanvasNodeDataUnion>
  >

  return (
    <div className="canvas-node-content h-full w-full" style={{ contain: 'layout style' }}>
      <Component
        id={content.id}
        type={content.type}
        data={content.data as CanvasNodeDataUnion}
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

  return {
    id: node.id,
    type: node.type,
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
