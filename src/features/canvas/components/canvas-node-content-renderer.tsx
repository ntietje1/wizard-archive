import { memo, useCallback, useEffect, useRef } from 'react'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../system/canvas-engine'
import type { CanvasDocumentNode, CanvasNodeType } from '../types/canvas-domain-types'
import { CANVAS_NODE_TYPES } from '../nodes/canvas-node-types'
import type {
  CanvasNodeComponentDataByType,
  CanvasNodeComponentProps,
} from '../nodes/canvas-node-types'
import type { ComponentType } from 'react'

type CanvasNodeDataUnion = CanvasNodeComponentDataByType[CanvasNodeType]

export type CanvasNodeRendererMap = Partial<{
  [TType in CanvasNodeType]: ComponentType<
    CanvasNodeComponentProps<CanvasNodeComponentDataByType[TType]>
  >
}>

const canvasNodeTypeSet = new Set<string>(CANVAS_NODE_TYPES)

type CanvasNodeContentSnapshot = {
  id: string
  type: CanvasNodeType
  rawType: string | undefined
  isKnownType: boolean
  data: CanvasDocumentNode['data']
  dragging: boolean
  selected: boolean
  width: number | undefined
  height: number | undefined
}

interface CanvasNodeContentRendererProps {
  nodeId: string
  renderers: CanvasNodeRendererMap
  onUnknownNodeType?: (nodeType: string, rendererTypes: ReadonlyArray<string>) => void
}

const DEFAULT_CANVAS_NODE_RENDERER_TYPE = 'text' as const satisfies CanvasNodeType

export const CanvasNodeContentRenderer = memo(function CanvasNodeContentRenderer({
  nodeId,
  renderers,
  onUnknownNodeType,
}: CanvasNodeContentRendererProps) {
  const reportedUnknownTypesRef = useRef(new Set<string>())
  const selectContent = useCallback(
    (snapshot: CanvasEngineSnapshot) =>
      selectCanvasNodeContentSnapshot({
        internalNode: snapshot.nodeLookup.get(nodeId),
        renderers,
      }),
    [nodeId, renderers],
  )
  const content = useCanvasEngineSelector(selectContent, areCanvasNodeContentSnapshotsEqual)

  useEffect(() => {
    if (!content?.rawType || content.isKnownType) {
      return
    }

    if (reportedUnknownTypesRef.current.has(content.rawType)) {
      return
    }

    reportedUnknownTypesRef.current.add(content.rawType)
    onUnknownNodeType?.(content.rawType, Object.keys(renderers))
  }, [content?.isKnownType, content?.rawType, onUnknownNodeType, renderers])

  if (!content) {
    return null
  }

  const Component = renderers[content.type] as
    | ComponentType<CanvasNodeComponentProps<CanvasNodeDataUnion>>
    | undefined
  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(
        `CanvasNodeContentRenderer: missing "${DEFAULT_CANVAS_NODE_RENDERER_TYPE}" renderer for fallback from "${content.rawType ?? 'unknown'}" node type`,
      )
    }
    return null
  }

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
})

function selectCanvasNodeContentSnapshot({
  internalNode,
  renderers,
}: {
  internalNode: CanvasInternalNode | undefined
  renderers: CanvasNodeRendererMap
}): CanvasNodeContentSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  const rawType = node.type
  const isKnownType = isCanvasNodeType(rawType) && rawType in renderers
  const type = isKnownType ? rawType : DEFAULT_CANVAS_NODE_RENDERER_TYPE

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
  return typeof value === 'string' && canvasNodeTypeSet.has(value)
}
