import type {
  CanvasDocumentChange,
  CanvasDocumentEdgeUpdate,
  CanvasDocumentNodeUpdate,
} from './document-controller'
import type {
  CanvasDocumentContent,
  CanvasDocumentEdge,
  CanvasDocumentNode,
  CanvasEdgeType,
} from './document-contract'
import type { CanvasSelection } from './interaction-types'

type CanvasPropertyCommand =
  | Readonly<{
      property: 'fill'
      value: Readonly<{ color: string | null; opacity: number }>
    }>
  | Readonly<{
      property: 'border'
      value: Readonly<{ color: string | null; opacity: number }>
    }>
  | Readonly<{ property: 'borderWidth'; value: number }>
  | Readonly<{ property: 'textColor'; value: string | null }>
  | Readonly<{
      property: 'linePaint'
      value: Readonly<{ color: string; opacity: number }>
    }>
  | Readonly<{ property: 'lineWidth'; value: number }>
  | Readonly<{ property: 'edgeType'; value: CanvasEdgeType }>

export type CanvasSharedValue<TValue> =
  | Readonly<{ state: 'unavailable' }>
  | Readonly<{ state: 'mixed' }>
  | Readonly<{ state: 'shared'; value: TValue }>

export function resolveCanvasSharedValue<TValue>(
  values: ReadonlyArray<TValue>,
): CanvasSharedValue<TValue> {
  if (values.length === 0) return { state: 'unavailable' }
  const first = values[0]!
  return values.every((value) => Object.is(value, first))
    ? { state: 'shared', value: first }
    : { state: 'mixed' }
}

export function createCanvasPropertyChange(
  content: CanvasDocumentContent,
  selection: CanvasSelection,
  command: CanvasPropertyCommand,
): CanvasDocumentChange | null {
  const selectedNodes = content.nodes.filter((node) => selection.nodeIds.has(node.id))
  const selectedEdges = content.edges.filter((edge) => selection.edgeIds.has(edge.id))
  let nodes: ReadonlyArray<CanvasDocumentNodeUpdate> = []
  let edges: ReadonlyArray<CanvasDocumentEdgeUpdate> = []
  switch (command.property) {
    case 'fill':
    case 'border':
    case 'borderWidth':
    case 'textColor':
      nodes = patchSurfaceNodes(selectedNodes, command)
      break
    case 'linePaint':
    case 'lineWidth':
      const line = patchLineSelection(selectedNodes, selectedEdges, command)
      nodes = line.nodes
      edges = line.edges
      break
    case 'edgeType':
      edges = selectedEdges.flatMap((edge) =>
        edge.type === command.value ? [] : [{ id: edge.id, type: command.value }],
      )
      break
  }
  return nodes.length > 0 || edges.length > 0 ? { type: 'update', nodes, edges } : null
}

function patchSurfaceNodes(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  command: Extract<
    CanvasPropertyCommand,
    { property: 'fill' | 'border' | 'borderWidth' | 'textColor' }
  >,
): ReadonlyArray<CanvasDocumentNodeUpdate> {
  return nodes.flatMap((node) => (node.type === 'stroke' ? [] : patchSurfaceNode(node, command)))
}

function patchSurfaceNode(
  node: Exclude<CanvasDocumentNode, { type: 'stroke' }>,
  command: Extract<
    CanvasPropertyCommand,
    { property: 'fill' | 'border' | 'borderWidth' | 'textColor' }
  >,
): ReadonlyArray<CanvasDocumentNodeUpdate> {
  switch (command.property) {
    case 'borderWidth':
      return patchSurfaceStrokeSize(node, command.value)
    case 'textColor':
      return patchSurfaceTextColor(node, command.value)
    case 'fill':
    case 'border':
      return patchSurfacePaint(node, command)
  }
}

function patchSurfaceStrokeSize(
  node: Exclude<CanvasDocumentNode, { type: 'stroke' }>,
  requestedValue: number,
): ReadonlyArray<CanvasDocumentNodeUpdate> {
  const borderWidth = normalizeStrokeSize(requestedValue, 0)
  return (node.data.borderWidth ?? 1) === borderWidth
    ? []
    : [{ id: node.id, type: node.type, data: { borderWidth } }]
}

function patchSurfaceTextColor(
  node: Exclude<CanvasDocumentNode, { type: 'stroke' }>,
  textColor: string | null,
): ReadonlyArray<CanvasDocumentNodeUpdate> {
  validateSurfaceColor(textColor)
  return (node.data.textColor ?? 'var(--foreground)') === textColor
    ? []
    : [{ id: node.id, type: node.type, data: { textColor } }]
}

function patchSurfacePaint(
  node: Exclude<CanvasDocumentNode, { type: 'stroke' }>,
  command: Extract<CanvasPropertyCommand, { property: 'fill' | 'border' }>,
): ReadonlyArray<CanvasDocumentNodeUpdate> {
  validateSurfaceColor(command.value.color)
  const opacity = normalizeOpacity(command.value.opacity)
  const colorKey = command.property === 'fill' ? 'backgroundColor' : 'borderStroke'
  const opacityKey = command.property === 'fill' ? 'backgroundOpacity' : 'borderOpacity'
  const defaultColor = command.property === 'fill' ? 'var(--background)' : 'var(--border)'
  if (
    (node.data[colorKey] ?? defaultColor) === command.value.color &&
    (node.data[opacityKey] ?? 100) === opacity
  ) {
    return []
  }
  return [
    {
      id: node.id,
      type: node.type,
      data: { [colorKey]: command.value.color, [opacityKey]: opacity },
    },
  ]
}

function validateSurfaceColor(color: string | null): void {
  if (color !== null && color.length === 0) {
    throw new TypeError('Canvas surface color cannot be empty')
  }
}

function patchLineSelection(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
  command: Extract<CanvasPropertyCommand, { property: 'linePaint' | 'lineWidth' }>,
): Readonly<{
  nodes: ReadonlyArray<CanvasDocumentNodeUpdate>
  edges: ReadonlyArray<CanvasDocumentEdgeUpdate>
}> {
  if (command.property === 'lineWidth') {
    const size = normalizeStrokeSize(command.value, 1)
    return {
      nodes: nodes.flatMap((node) =>
        node.type === 'stroke' && node.data.size !== size
          ? [{ id: node.id, type: 'stroke', data: { size } }]
          : [],
      ),
      edges: edges.flatMap((edge) =>
        (edge.style?.strokeWidth ?? 2) !== size
          ? [{ id: edge.id, style: { strokeWidth: size } }]
          : [],
      ),
    }
  }
  if (command.value.color.length === 0) throw new TypeError('Canvas line color cannot be empty')
  const opacity = normalizeOpacity(command.value.opacity)
  return {
    nodes: nodes.flatMap((node) =>
      node.type === 'stroke' &&
      (node.data.color !== command.value.color || node.data.opacity !== opacity)
        ? [
            {
              id: node.id,
              type: 'stroke',
              data: { color: command.value.color, opacity },
            },
          ]
        : [],
    ),
    edges: edges.flatMap((edge) =>
      (edge.style?.stroke ?? 'var(--foreground)') !== command.value.color ||
      (edge.style?.opacity ?? 0.75) !== opacity / 100
        ? [
            {
              id: edge.id,
              style: { stroke: command.value.color, opacity: opacity / 100 },
            },
          ]
        : [],
    ),
  }
}

function normalizeStrokeSize(value: number, minimum: number): number {
  if (!Number.isFinite(value)) throw new TypeError('Canvas property value must be finite')
  return Math.min(99, Math.max(minimum, value))
}

function normalizeOpacity(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new TypeError('Canvas opacity must be between zero and one hundred')
  }
  return value
}
