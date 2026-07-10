import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-bounds'
import type { CanvasPosition } from '../../types/canvas-domain-types'
import type { CanvasSelectionSnapshot } from '../../system/canvas-selection'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type * as Y from 'yjs'
import type { CanvasDocumentNode } from '../../document-contract'

export const CANVAS_ARRANGE_ACTIONS = [
  { id: 'alignLeft', label: 'Align Left' },
  { id: 'alignRight', label: 'Align Right' },
  { id: 'alignTop', label: 'Align Top' },
  { id: 'alignBottom', label: 'Align Bottom' },
  { id: 'alignCenter', label: 'Align Center' },
  { id: 'alignVertical', label: 'Align V' },
  { id: 'alignHorizontal', label: 'Align H' },
  { id: 'distributeHorizontal', label: 'Distribute H' },
  { id: 'distributeVertical', label: 'Distribute V' },
  { id: 'flipHorizontal', label: 'Flip H' },
  { id: 'flipVertical', label: 'Flip V' },
] as const

export type CanvasArrangeAction = (typeof CANVAS_ARRANGE_ACTIONS)[number]['id']

type ArrangeableNode = {
  node: CanvasDocumentNode
  bounds: Bounds
}
type ArrangeAxis = 'x' | 'y'

function getAxisSize(node: ArrangeableNode, axis: ArrangeAxis) {
  return axis === 'x' ? node.bounds.width : node.bounds.height
}

function getAxisOffset(offset: CanvasPosition, axis: ArrangeAxis) {
  return axis === 'x' ? offset.x : offset.y
}

function getArrangeableNodes(
  nodesMap: Y.Map<CanvasDocumentNode>,
  selection: CanvasSelectionSnapshot,
): Array<ArrangeableNode> {
  return Array.from(selection.nodeIds).flatMap((nodeId) => {
    const node = nodesMap.get(nodeId)
    if (!node) {
      return []
    }

    const bounds = getCanvasNodeBounds(node)
    return bounds ? [{ node, bounds }] : []
  })
}

function getCanvasArrangeMinimumNodeCount(action: CanvasArrangeAction) {
  return action === 'distributeHorizontal' || action === 'distributeVertical' ? 3 : 2
}

function getAggregateBounds(nodes: ReadonlyArray<ArrangeableNode>): Bounds {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  for (const { bounds } of nodes) {
    left = Math.min(left, bounds.x)
    top = Math.min(top, bounds.y)
    right = Math.max(right, bounds.x + bounds.width)
    bottom = Math.max(bottom, bounds.y + bounds.height)
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function positionMapFromNodes(nodes: ReadonlyArray<ArrangeableNode>) {
  return new Map<string, CanvasPosition>(
    nodes.map(({ node }) => [node.id, { x: node.position.x, y: node.position.y }]),
  )
}

function setNodePosition(
  positions: Map<string, CanvasPosition>,
  node: ArrangeableNode,
  position: CanvasPosition,
) {
  positions.set(node.node.id, position)
}

function getNodeBoundsOffset(node: ArrangeableNode): CanvasPosition {
  return {
    x: node.node.position.x - node.bounds.x,
    y: node.node.position.y - node.bounds.y,
  }
}

function alignNodes(
  nodes: ReadonlyArray<ArrangeableNode>,
  positions: Map<string, CanvasPosition>,
  getPosition: (node: ArrangeableNode, nodeOffset: CanvasPosition) => CanvasPosition,
) {
  for (const node of nodes) {
    setNodePosition(positions, node, getPosition(node, getNodeBoundsOffset(node)))
  }

  return positions
}

function distributeNodes(nodes: ReadonlyArray<ArrangeableNode>, axis: ArrangeAxis) {
  const sortedNodes = [...nodes].sort((left, right) => left.bounds[axis] - right.bounds[axis])
  const positions = positionMapFromNodes(nodes)
  const first = sortedNodes[0]!
  const last = sortedNodes[sortedNodes.length - 1]!
  const totalSize = sortedNodes.reduce((total, node) => total + getAxisSize(node, axis), 0)
  const availableSize = last.bounds[axis] + getAxisSize(last, axis) - first.bounds[axis]
  const gap = (availableSize - totalSize) / (sortedNodes.length - 1)
  let nextCoordinate = first.bounds[axis]

  for (const node of sortedNodes) {
    const nodeOffset = getNodeBoundsOffset(node)
    setNodePosition(positions, node, {
      x: axis === 'x' ? nextCoordinate + nodeOffset.x : node.node.position.x,
      y: axis === 'y' ? nextCoordinate + nodeOffset.y : node.node.position.y,
    })
    nextCoordinate += getAxisSize(node, axis) + gap
  }

  return positions
}

function distributeHorizontal(nodes: ReadonlyArray<ArrangeableNode>) {
  return distributeNodes(nodes, 'x')
}

function distributeVertical(nodes: ReadonlyArray<ArrangeableNode>) {
  return distributeNodes(nodes, 'y')
}

function flipNodes(
  nodes: ReadonlyArray<ArrangeableNode>,
  positions: Map<string, CanvasPosition>,
  axis: ArrangeAxis,
  center: number,
) {
  for (const node of nodes) {
    const nodeCenter = node.bounds[axis] + getAxisSize(node, axis) / 2
    const nodeOffset = getNodeBoundsOffset(node)
    const flippedCoordinate =
      2 * center - nodeCenter - getAxisSize(node, axis) / 2 + getAxisOffset(nodeOffset, axis)

    setNodePosition(positions, node, {
      x: axis === 'x' ? flippedCoordinate : node.node.position.x,
      y: axis === 'y' ? flippedCoordinate : node.node.position.y,
    })
  }

  return positions
}

export function createCanvasArrangePlan(
  nodesMap: Y.Map<CanvasDocumentNode>,
  selection: CanvasSelectionSnapshot,
  action: CanvasArrangeAction,
): Map<string, CanvasPosition> | null {
  const nodes = getArrangeableNodes(nodesMap, selection)
  if (nodes.length < getCanvasArrangeMinimumNodeCount(action)) {
    return null
  }

  const aggregate = getAggregateBounds(nodes)
  const right = aggregate.x + aggregate.width
  const bottom = aggregate.y + aggregate.height
  const centerX = aggregate.x + aggregate.width / 2
  const centerY = aggregate.y + aggregate.height / 2
  const positions = positionMapFromNodes(nodes)

  switch (action) {
    case 'alignLeft':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: aggregate.x + nodeOffset.x,
        y: node.node.position.y,
      }))
    case 'alignRight':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: right - node.bounds.width + nodeOffset.x,
        y: node.node.position.y,
      }))
    case 'alignTop':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: node.node.position.x,
        y: aggregate.y + nodeOffset.y,
      }))
    case 'alignBottom':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: node.node.position.x,
        y: bottom - node.bounds.height + nodeOffset.y,
      }))
    case 'alignCenter':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: centerX - node.bounds.width / 2 + nodeOffset.x,
        y: centerY - node.bounds.height / 2 + nodeOffset.y,
      }))
    case 'alignVertical':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: centerX - node.bounds.width / 2 + nodeOffset.x,
        y: node.node.position.y,
      }))
    case 'alignHorizontal':
      return alignNodes(nodes, positions, (node, nodeOffset) => ({
        x: node.node.position.x,
        y: centerY - node.bounds.height / 2 + nodeOffset.y,
      }))
    case 'distributeHorizontal':
      return distributeHorizontal(nodes)
    case 'distributeVertical':
      return distributeVertical(nodes)
    case 'flipHorizontal':
      return flipNodes(nodes, positions, 'x', centerX)
    case 'flipVertical':
      return flipNodes(nodes, positions, 'y', centerY)
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
