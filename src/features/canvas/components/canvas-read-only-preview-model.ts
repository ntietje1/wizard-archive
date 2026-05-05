import { buildCanvasEdgeGeometry, resolveCanvasEdgeType } from '../edges/canvas-edge-registry'
import type { CanvasEdgeGeometry } from '../edges/shared/canvas-edge-geometry'
import type { CanvasEngineSnapshot, CanvasInternalNode } from '../system/canvas-engine'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'

export type CanvasPreviewNodeShellSnapshot = {
  id: string
  type: string | undefined
  className: string | undefined
  position: { x: number; y: number }
  width: number | undefined
  height: number | undefined
  zIndex: number
}

export function selectCanvasPreviewNodeShell(
  internalNode: CanvasInternalNode | undefined,
): CanvasPreviewNodeShellSnapshot | null {
  if (!internalNode) {
    return null
  }

  const node = internalNode.node
  return {
    id: node.id,
    type: node.type,
    className: node.className,
    position: node.position,
    width: node.width ?? internalNode.measured.width,
    height: node.height ?? internalNode.measured.height,
    zIndex: internalNode.zIndex,
  }
}

export function areCanvasPreviewNodeShellsEqual(
  left: CanvasPreviewNodeShellSnapshot | null,
  right: CanvasPreviewNodeShellSnapshot | null,
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
    left.className === right.className &&
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.zIndex === right.zIndex
  )
}

export type CanvasPreviewEdgeType = 'bezier' | 'straight' | 'step'

export type CanvasPreviewEdgeRender = {
  edge: CanvasDocumentEdge
  geometry: CanvasEdgeGeometry
  type: CanvasPreviewEdgeType
}

export function selectCanvasPreviewEdgeRender(
  snapshot: Pick<CanvasEngineSnapshot, 'edgeLookup' | 'nodeLookup'>,
  edgeId: string,
): CanvasPreviewEdgeRender | null {
  const internalEdge = snapshot.edgeLookup.get(edgeId)
  if (!internalEdge) {
    return null
  }

  const edge = internalEdge.edge
  const nodesById = getPreviewEdgeEndpointNodes(edge, snapshot.nodeLookup)
  const type = resolvePreviewEdgeType(edge.type)
  const geometry = getPreviewEdgeGeometry({ ...edge, type }, nodesById)

  return geometry ? { edge, geometry, type } : null
}

function getPreviewEdgeEndpointNodes(
  edge: CanvasDocumentEdge,
  nodeLookup: CanvasEngineSnapshot['nodeLookup'],
) {
  const nodesById = new Map<string, CanvasDocumentNode>()
  const sourceNode = nodeLookup.get(edge.source)?.node
  const targetNode = nodeLookup.get(edge.target)?.node
  if (sourceNode) {
    nodesById.set(sourceNode.id, sourceNode)
  }
  if (targetNode) {
    nodesById.set(targetNode.id, targetNode)
  }

  return nodesById
}

function resolvePreviewEdgeType(type: string | undefined): CanvasPreviewEdgeType {
  return resolveCanvasEdgeType(type)
}

function getPreviewEdgeGeometry(
  edge: CanvasDocumentEdge & { type: CanvasPreviewEdgeType },
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
) {
  return buildCanvasEdgeGeometry(edge, nodesById)
}

export function areCanvasPreviewEdgeRendersEqual(
  left: CanvasPreviewEdgeRender | null,
  right: CanvasPreviewEdgeRender | null,
) {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  return (
    left.edge === right.edge &&
    left.type === right.type &&
    left.geometry.path === right.geometry.path
  )
}
