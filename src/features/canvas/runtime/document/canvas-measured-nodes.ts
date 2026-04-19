import type { CanvasMeasuredNode } from '../../tools/canvas-tool-types'

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
