import { memo, useEffect } from 'react'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../system/canvas-engine'
import type { CanvasNode } from '../types/canvas-domain-types'
import type { CanvasNodeComponentProps, CanvasNodeType } from '../nodes/canvas-node-types'
import type { ComponentType } from 'react'

export type CanvasNodeRendererMap = Record<
  CanvasNodeType,
  ComponentType<CanvasNodeComponentProps<any>>
>

type CanvasNodeContentSnapshot = {
  id: string
  type: CanvasNodeType
  rawType: string | undefined
  isKnownType: boolean
  data: CanvasNode['data']
  dragging: boolean
  selected: boolean
  width: number | undefined
  height: number | undefined
}

interface CanvasNodeContentRendererProps {
  nodeId: string
  renderers: CanvasNodeRendererMap
  fallbackType: CanvasNodeType
  onUnknownNodeType?: (nodeType: string, rendererTypes: ReadonlyArray<string>) => void
}

export const CanvasNodeContentRenderer = memo(function CanvasNodeContentRenderer({
  nodeId,
  renderers,
  fallbackType,
  onUnknownNodeType,
}: CanvasNodeContentRendererProps) {
  const selectContent = (snapshot: CanvasEngineSnapshot) =>
    selectCanvasNodeContentSnapshot({
      internalNode: snapshot.nodeLookup.get(nodeId),
      renderers,
      fallbackType,
    })
  const content = useCanvasEngineSelector(selectContent, areCanvasNodeContentSnapshotsEqual)

  useEffect(() => {
    if (!content?.rawType || content.isKnownType) {
      return
    }

    onUnknownNodeType?.(content.rawType, Object.keys(renderers))
  }, [content?.isKnownType, content?.rawType, onUnknownNodeType, renderers])

  if (!content) {
    return null
  }

  const Component = renderers[content.type]
  if (!Component) {
    return null
  }

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

function selectCanvasNodeContentSnapshot({
  internalNode,
  renderers,
  fallbackType,
}: {
  internalNode: CanvasInternalNode | undefined
  renderers: CanvasNodeRendererMap
  fallbackType: CanvasNodeType
}): CanvasNodeContentSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  const rawType = node.type
  const isKnownType = isCanvasNodeType(rawType) && rawType in renderers
  const type = isKnownType ? rawType : fallbackType

  return {
    id: node.id,
    type,
    rawType,
    isKnownType,
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
    left.rawType === right.rawType &&
    left.isKnownType === right.isKnownType &&
    left.data === right.data &&
    left.dragging === right.dragging &&
    left.selected === right.selected &&
    left.width === right.width &&
    left.height === right.height
  )
}

function isCanvasNodeType(value: unknown): value is CanvasNodeType {
  return value === 'embed' || value === 'stroke' || value === 'text'
}
