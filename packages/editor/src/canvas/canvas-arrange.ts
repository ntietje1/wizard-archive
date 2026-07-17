import { canvasBoundsUnion, canvasNodeBounds } from './canvas-bounds'
import type { CanvasDocumentChange } from './document-controller'
import type { CanvasDocumentContent, CanvasDocumentNode } from './document-contract'
import type { CanvasSelection } from './interaction-types'

export const CANVAS_ARRANGE_ACTIONS = [
  { id: 'alignLeft', label: 'Align left', minimumNodes: 2 },
  { id: 'alignRight', label: 'Align right', minimumNodes: 2 },
  { id: 'alignTop', label: 'Align top', minimumNodes: 2 },
  { id: 'alignBottom', label: 'Align bottom', minimumNodes: 2 },
  { id: 'alignCenter', label: 'Align centers', minimumNodes: 2 },
  { id: 'alignCenterX', label: 'Align horizontal centers', minimumNodes: 2 },
  { id: 'alignCenterY', label: 'Align vertical centers', minimumNodes: 2 },
  { id: 'distributeHorizontal', label: 'Distribute horizontally', minimumNodes: 3 },
  { id: 'distributeVertical', label: 'Distribute vertically', minimumNodes: 3 },
  { id: 'flipHorizontal', label: 'Flip horizontally', minimumNodes: 2 },
  { id: 'flipVertical', label: 'Flip vertically', minimumNodes: 2 },
] as const

type CanvasArrangeAction = (typeof CANVAS_ARRANGE_ACTIONS)[number]['id']

export function createCanvasArrangeChange(
  content: CanvasDocumentContent,
  selection: CanvasSelection,
  action: CanvasArrangeAction,
): CanvasDocumentChange | null {
  const nodes = content.nodes.filter((node) => selection.nodeIds.has(node.id) && !node.hidden)
  const minimum = CANVAS_ARRANGE_ACTIONS.find(({ id }) => id === action)!.minimumNodes
  if (nodes.length < minimum) return null
  const aggregate = canvasBoundsUnion(nodes.map(canvasNodeBounds))
  if (!aggregate) return null
  const positions =
    action === 'distributeHorizontal' || action === 'distributeVertical'
      ? distributeCanvasNodes(nodes, action === 'distributeHorizontal' ? 'x' : 'y')
      : arrangeCanvasNodes(nodes, aggregate, action)
  const changed = nodes.flatMap((node) => {
    const position = positions.get(node.id)
    return position && (position.x !== node.position.x || position.y !== node.position.y)
      ? [{ id: node.id, type: node.type, position }]
      : []
  })
  return changed.length > 0 ? { type: 'update', nodes: changed, edges: [] } : null
}

function arrangeCanvasNodes(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  aggregate: Readonly<{ x: number; y: number; width: number; height: number }>,
  action: Exclude<CanvasArrangeAction, 'distributeHorizontal' | 'distributeVertical'>,
) {
  const right = aggregate.x + aggregate.width
  const bottom = aggregate.y + aggregate.height
  const centerX = aggregate.x + aggregate.width / 2
  const centerY = aggregate.y + aggregate.height / 2
  return new Map(
    nodes.map((node) => {
      const bounds = canvasNodeBounds(node)
      switch (action) {
        case 'alignLeft':
          return [node.id, { x: aggregate.x, y: node.position.y }]
        case 'alignRight':
          return [node.id, { x: right - bounds.width, y: node.position.y }]
        case 'alignTop':
          return [node.id, { x: node.position.x, y: aggregate.y }]
        case 'alignBottom':
          return [node.id, { x: node.position.x, y: bottom - bounds.height }]
        case 'alignCenter':
          return [node.id, { x: centerX - bounds.width / 2, y: centerY - bounds.height / 2 }]
        case 'alignCenterX':
          return [node.id, { x: centerX - bounds.width / 2, y: node.position.y }]
        case 'alignCenterY':
          return [node.id, { x: node.position.x, y: centerY - bounds.height / 2 }]
        case 'flipHorizontal':
          return [
            node.id,
            {
              x: 2 * centerX - (bounds.x + bounds.width / 2) - bounds.width / 2,
              y: node.position.y,
            },
          ]
        case 'flipVertical':
          return [
            node.id,
            {
              x: node.position.x,
              y: 2 * centerY - (bounds.y + bounds.height / 2) - bounds.height / 2,
            },
          ]
      }
    }),
  )
}

function distributeCanvasNodes(nodes: ReadonlyArray<CanvasDocumentNode>, axis: 'x' | 'y') {
  const sorted = [...nodes].sort((left, right) => left.position[axis] - right.position[axis])
  const sizes = new Map(
    sorted.map((node) => [
      node.id,
      axis === 'x' ? canvasNodeBounds(node).width : canvasNodeBounds(node).height,
    ]),
  )
  const first = sorted[0]!
  const last = sorted.at(-1)!
  const firstCoordinate = first.position[axis]
  const lastSize = sizes.get(last.id)!
  const span = last.position[axis] + lastSize - firstCoordinate
  const totalSize = Array.from(sizes.values()).reduce((sum, size) => sum + size, 0)
  const gap = (span - totalSize) / (sorted.length - 1)
  let coordinate = firstCoordinate
  const positions = new Map(nodes.map((node) => [node.id, { ...node.position }]))
  for (const node of sorted) {
    positions.set(node.id, { ...node.position, [axis]: coordinate })
    coordinate += sizes.get(node.id)! + gap
  }
  return positions
}
