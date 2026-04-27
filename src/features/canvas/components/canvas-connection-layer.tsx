import { buildConnectionDraftGeometry } from './canvas-connection-layer-geometry'
import type { CanvasConnectionDraft } from './canvas-connection-layer-geometry'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasInternalNode } from '../system/canvas-engine'
import type { CanvasNode } from '../types/canvas-domain-types'
import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/shallow'

const CONNECTION_PREVIEW_PATH_STYLE: CSSProperties = {
  fill: 'none',
  pointerEvents: 'none',
  strokeLinecap: 'square',
  strokeLinejoin: 'round',
}

export function CanvasConnectionLayer({ draft }: { draft: CanvasConnectionDraft | null }) {
  const nodeLookup = useCanvasEngineSelector((snapshot) => snapshot.nodeLookup)
  const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore(
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

  const geometry = buildConnectionDraftGeometry(edgeType, draft, createNodesById(nodeLookup))
  if (!geometry) {
    return null
  }

  return (
    <path
      d={geometry.path}
      style={{
        ...CONNECTION_PREVIEW_PATH_STYLE,
        stroke: strokeColor,
        strokeWidth: strokeSize,
        opacity: strokeOpacity / 100,
      }}
      data-testid="canvas-connection-preview"
      data-edge-type={edgeType}
      data-snap-target={draft.snapTarget ? 'true' : 'false'}
    />
  )
}

function createNodesById(nodeLookup: ReadonlyMap<string, CanvasInternalNode>) {
  const nodesById = new Map<string, CanvasNode>()
  for (const [nodeId, internalNode] of nodeLookup) {
    nodesById.set(nodeId, internalNode.node)
  }
  return nodesById
}
