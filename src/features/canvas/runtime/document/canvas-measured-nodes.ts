import type { CanvasMeasuredNode } from '../../tools/canvas-tool-types'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../../system/canvas-engine'

type MeasuredNodeLookupValue = {
  id: string
  type?: string
  data: Record<string, unknown>
  position: { x: number; y: number }
  measured?: {
    width?: number
    height?: number
  }
}

export function getMeasuredCanvasNodesFromLookup(
  nodeLookup: Map<string, MeasuredNodeLookupValue>,
): Array<CanvasMeasuredNode> {
  return Array.from(nodeLookup.values()).flatMap((internalNode) => {
    const width = internalNode.measured?.width
    const height = internalNode.measured?.height
    if (width === undefined || height === undefined) {
      return []
    }

    return [
      {
        id: internalNode.id,
        type: internalNode.type,
        data: internalNode.data,
        position: internalNode.position,
        width,
        height,
      },
    ]
  })
}

export function getMeasuredCanvasNodesFromEngineSnapshot(
  snapshot: CanvasEngineSnapshot,
): Array<CanvasMeasuredNode> {
  const nodeLookup = snapshot.nodeLookup
  if (!nodeLookup) {
    return []
  }

  return getMeasuredCanvasNodesFromLookup(normalizeMeasuredNodeLookup(nodeLookup))
}

function normalizeMeasuredNodeLookup(
  nodeLookup: ReadonlyMap<string, CanvasInternalNode>,
): Map<string, MeasuredNodeLookupValue> {
  const normalized = new Map<string, MeasuredNodeLookupValue>()
  for (const [nodeId, internalNode] of nodeLookup) {
    normalized.set(nodeId, {
      id: internalNode.node.id,
      type: internalNode.node.type,
      data: internalNode.node.data,
      position: internalNode.node.position,
      measured: internalNode.measured,
    })
  }
  return normalized
}
