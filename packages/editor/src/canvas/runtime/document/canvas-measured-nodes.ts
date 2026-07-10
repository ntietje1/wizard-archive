import type { CanvasMeasuredNode } from '../../tools/canvas-tool-types'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../../system/canvas-engine-types'
import type { CanvasDocumentNode } from '../../document-contract'
type MeasuredNodeLookupValue = Pick<CanvasDocumentNode, 'data' | 'id' | 'position' | 'type'> & {
  measured?: {
    width?: number
    height?: number
  }
}

export function getMeasuredCanvasNodesFromLookup(
  nodeLookup: Map<string, MeasuredNodeLookupValue>,
): Array<CanvasMeasuredNode> {
  return Array.from(nodeLookup.values()).flatMap(readMeasuredCanvasNode)
}

export function getMeasuredCanvasNodesFromEngineSnapshot(
  snapshot: CanvasEngineSnapshot,
): Array<CanvasMeasuredNode> {
  return Array.from(snapshot.nodeLookup.values()).flatMap((internalNode: CanvasInternalNode) =>
    readMeasuredCanvasNode({
      id: internalNode.node.id,
      type: internalNode.node.type,
      data: internalNode.node.data,
      position: internalNode.node.position,
      measured: internalNode.measured,
    }),
  )
}

function readMeasuredCanvasNode(internalNode: MeasuredNodeLookupValue) {
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
    } as CanvasMeasuredNode,
  ]
}
