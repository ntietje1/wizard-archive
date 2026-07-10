import { buildConnectionDraftGeometry } from './canvas-connection-layer-geometry'
import { clampCanvasEdgeStrokeWidth } from '../edges/shared/canvas-edge-style'
import { resolveCanvasScreenMinimumStrokeWidthCss } from '../screen-stroke-width'
import type { CanvasConnectionDraft } from '../runtime/interaction/canvas-connection-gesture-types'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useCanvasToolRuntimeStore } from '../runtime/providers/canvas-runtime'
import type { CanvasInternalNode } from '../system/canvas-engine-types'
import type { CSSProperties } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { CanvasDocumentNode } from '../document-contract'

const CONNECTION_PREVIEW_PATH_STYLE: CSSProperties = {
  fill: 'none',
  pointerEvents: 'none',
  strokeLinecap: 'square',
  strokeLinejoin: 'round',
}

export function CanvasConnectionLayer({ draft }: { draft: CanvasConnectionDraft | null }) {
  const toolStore = useCanvasToolRuntimeStore()
  const previewNodesById = useCanvasEngineSelector((snapshot) => {
    if (!draft?.snapTarget) {
      return EMPTY_NODES_BY_ID
    }
    return createConnectionPreviewNodesById(
      snapshot.nodeLookup,
      draft.source.nodeId,
      draft.snapTarget.nodeId,
    )
  }, areConnectionPreviewNodeMapsEqual)
  const { edgeType, strokeColor, strokeOpacity, strokeSize } = useStore(
    toolStore,
    useShallow((state) => ({
      edgeType: state.edgeType,
      strokeColor: state.strokeColor,
      strokeOpacity: state.strokeOpacity,
      strokeSize: state.strokeSize,
    })),
  )

  if (!draft) {
    return null
  }

  const geometry = buildConnectionDraftGeometry(edgeType, draft, previewNodesById)
  if (!geometry) {
    return null
  }
  const strokeWidth = clampCanvasEdgeStrokeWidth(strokeSize)

  return (
    <path
      d={geometry.path}
      style={{
        ...CONNECTION_PREVIEW_PATH_STYLE,
        stroke: strokeColor,
        strokeWidth: resolveCanvasScreenMinimumStrokeWidthCss(strokeWidth),
        opacity: strokeOpacity / 100,
      }}
      data-canvas-authored-stroke-width={strokeWidth}
      data-testid="canvas-connection-preview"
      data-edge-type={edgeType}
      data-snap-target={draft.snapTarget ? 'true' : 'false'}
    />
  )
}

const EMPTY_NODES_BY_ID: ReadonlyMap<string, CanvasDocumentNode> = new Map()

function areConnectionPreviewNodeMapsEqual(
  left: ReadonlyMap<string, CanvasDocumentNode>,
  right: ReadonlyMap<string, CanvasDocumentNode>,
) {
  if (left === right) {
    return true
  }
  if (left.size !== right.size) {
    return false
  }
  for (const [id, node] of left) {
    if (right.get(id) !== node) {
      return false
    }
  }
  return true
}

function createConnectionPreviewNodesById(
  nodeLookup: ReadonlyMap<string, CanvasInternalNode>,
  sourceId: string,
  targetId: string,
) {
  const nodesById = new Map<string, CanvasDocumentNode>()
  const sourceNode = nodeLookup.get(sourceId)?.node
  if (sourceNode) {
    nodesById.set(sourceId, sourceNode)
  }
  const targetNode = nodeLookup.get(targetId)?.node
  if (targetNode) {
    nodesById.set(targetId, targetNode)
  }
  return nodesById
}
