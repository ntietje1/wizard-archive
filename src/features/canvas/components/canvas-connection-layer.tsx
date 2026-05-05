import { buildConnectionDraftGeometry } from './canvas-connection-layer-geometry'
import { clampCanvasEdgeStrokeWidth } from '../edges/shared/canvas-edge-style'
import { resolveCanvasScreenMinimumStrokeWidthCss } from '../utils/canvas-screen-stroke-width'
import type { CanvasConnectionDraft } from '../runtime/interaction/canvas-connection-gesture-types'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { CanvasInternalNode } from '../system/canvas-engine-types'
import type { CanvasDocumentNode } from 'convex/canvases/validation'
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

function createNodesById(nodeLookup: ReadonlyMap<string, CanvasInternalNode>) {
  const nodesById = new Map<string, CanvasDocumentNode>()
  for (const [nodeId, internalNode] of nodeLookup) {
    nodesById.set(nodeId, internalNode.node)
  }
  return nodesById
}
