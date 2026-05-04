import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-bounds'
import type {
  CanvasDocumentNode,
  CanvasPosition,
} from '~/features/canvas/types/canvas-domain-types'
import type { CanvasSelectionSnapshot } from '../../tools/canvas-tool-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type * as Y from 'yjs'

export const CANVAS_ARRANGE_ACTIONS = [
  { id: 'alignLeft', label: 'Align Left' },
  { id: 'alignRight', label: 'Align Right' },
  { id: 'alignTop', label: 'Align Top' },
  { id: 'alignBottom', label: 'Align Bottom' },
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
  const left = Math.min(...nodes.map(({ bounds }) => bounds.x))
  const top = Math.min(...nodes.map(({ bounds }) => bounds.y))
  const right = Math.max(...nodes.map(({ bounds }) => bounds.x + bounds.width))
  const bottom = Math.max(...nodes.map(({ bounds }) => bounds.y + bounds.height))

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

function distributeHorizontal(nodes: ReadonlyArray<ArrangeableNode>) {
  const sortedNodes = [...nodes].sort((left, right) => left.bounds.x - right.bounds.x)
  const positions = positionMapFromNodes(nodes)
  const first = sortedNodes[0]!
  const last = sortedNodes[sortedNodes.length - 1]!
  const totalWidth = sortedNodes.reduce((total, { bounds }) => total + bounds.width, 0)
  const availableWidth = last.bounds.x + last.bounds.width - first.bounds.x
  const gap = (availableWidth - totalWidth) / (sortedNodes.length - 1)
  let nextX = first.bounds.x

  for (const node of sortedNodes) {
    const nodeOffset = getNodeBoundsOffset(node)
    setNodePosition(positions, node, { x: nextX + nodeOffset.x, y: node.node.position.y })
    nextX += node.bounds.width + gap
  }

  return positions
}

function distributeVertical(nodes: ReadonlyArray<ArrangeableNode>) {
  const sortedNodes = [...nodes].sort((top, bottom) => top.bounds.y - bottom.bounds.y)
  const positions = positionMapFromNodes(nodes)
  const first = sortedNodes[0]!
  const last = sortedNodes[sortedNodes.length - 1]!
  const totalHeight = sortedNodes.reduce((total, { bounds }) => total + bounds.height, 0)
  const availableHeight = last.bounds.y + last.bounds.height - first.bounds.y
  const gap = (availableHeight - totalHeight) / (sortedNodes.length - 1)
  let nextY = first.bounds.y

  for (const node of sortedNodes) {
    const nodeOffset = getNodeBoundsOffset(node)
    setNodePosition(positions, node, { x: node.node.position.x, y: nextY + nodeOffset.y })
    nextY += node.bounds.height + gap
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
  const positions = positionMapFromNodes(nodes)

  switch (action) {
    case 'alignLeft':
      for (const node of nodes) {
        const nodeOffset = getNodeBoundsOffset(node)
        setNodePosition(positions, node, {
          x: aggregate.x + nodeOffset.x,
          y: node.node.position.y,
        })
      }
      return positions
    case 'alignRight':
      for (const node of nodes) {
        const nodeOffset = getNodeBoundsOffset(node)
        setNodePosition(positions, node, {
          x: right - node.bounds.width + nodeOffset.x,
          y: node.node.position.y,
        })
      }
      return positions
    case 'alignTop':
      for (const node of nodes) {
        const nodeOffset = getNodeBoundsOffset(node)
        setNodePosition(positions, node, {
          x: node.node.position.x,
          y: aggregate.y + nodeOffset.y,
        })
      }
      return positions
    case 'alignBottom':
      for (const node of nodes) {
        const nodeOffset = getNodeBoundsOffset(node)
        setNodePosition(positions, node, {
          x: node.node.position.x,
          y: bottom - node.bounds.height + nodeOffset.y,
        })
      }
      return positions
    case 'distributeHorizontal':
      return distributeHorizontal(nodes)
    case 'distributeVertical':
      return distributeVertical(nodes)
    case 'flipHorizontal': {
      const centerX = aggregate.x + aggregate.width / 2
      for (const node of nodes) {
        const nodeCenterX = node.bounds.x + node.bounds.width / 2
        setNodePosition(positions, node, {
          x: 2 * centerX - nodeCenterX - node.bounds.width / 2,
          y: node.node.position.y,
        })
      }
      return positions
    }
    case 'flipVertical': {
      const centerY = aggregate.y + aggregate.height / 2
      for (const node of nodes) {
        const nodeCenterY = node.bounds.y + node.bounds.height / 2
        setNodePosition(positions, node, {
          x: node.node.position.x,
          y: 2 * centerY - nodeCenterY - node.bounds.height / 2,
        })
      }
      return positions
    }
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}
