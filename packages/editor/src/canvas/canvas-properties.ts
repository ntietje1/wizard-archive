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
  | Readonly<{ property: 'fill'; value: string | null }>
  | Readonly<{ property: 'border'; value: string | null }>
  | Readonly<{ property: 'borderWidth'; value: number }>
  | Readonly<{ property: 'textColor'; value: string | null }>
  | Readonly<{ property: 'lineColor'; value: string }>
  | Readonly<{ property: 'lineWidth'; value: number }>
  | Readonly<{ property: 'lineOpacity'; value: number }>
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
    case 'lineColor':
    case 'lineWidth':
    case 'lineOpacity': {
      const line = patchLineSelection(selectedNodes, selectedEdges, command)
      nodes = line.nodes
      edges = line.edges
      break
    }
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
  return nodes.flatMap((node) => {
    if (node.type === 'stroke') return []
    const key =
      command.property === 'fill'
        ? 'backgroundColor'
        : command.property === 'border'
          ? 'borderStroke'
          : command.property
    const value = normalizedSurfaceValue(command)
    if (node.data[key] === value) return []
    return [{ id: node.id, type: node.type, data: { [key]: value } }]
  })
}

function normalizedSurfaceValue(
  command: Extract<
    CanvasPropertyCommand,
    { property: 'fill' | 'border' | 'borderWidth' | 'textColor' }
  >,
): number | string | null {
  if (command.property === 'borderWidth') {
    if (!Number.isFinite(command.value)) throw new TypeError('Canvas property value must be finite')
    return Math.min(99, Math.max(0, command.value))
  }
  if (command.value !== null && command.value.length === 0) {
    throw new TypeError('Canvas surface color cannot be empty')
  }
  return command.value
}

function patchLineSelection(
  nodes: ReadonlyArray<CanvasDocumentNode>,
  edges: ReadonlyArray<CanvasDocumentEdge>,
  command: Extract<CanvasPropertyCommand, { property: 'lineColor' | 'lineWidth' | 'lineOpacity' }>,
): Readonly<{
  nodes: ReadonlyArray<CanvasDocumentNodeUpdate>
  edges: ReadonlyArray<CanvasDocumentEdgeUpdate>
}> {
  const strokeKey =
    command.property === 'lineColor'
      ? 'color'
      : command.property === 'lineWidth'
        ? 'size'
        : 'opacity'
  const edgeKey =
    command.property === 'lineColor'
      ? 'stroke'
      : command.property === 'lineWidth'
        ? 'strokeWidth'
        : 'opacity'
  const strokeValue = normalizedPropertyValue(command)
  const edgeValue =
    command.property === 'lineOpacity'
      ? Math.min(100, Math.max(0, command.value)) / 100
      : strokeValue
  return {
    nodes: nodes.flatMap((node) =>
      node.type === 'stroke' && node.data[strokeKey] !== strokeValue
        ? [{ id: node.id, type: 'stroke', data: { [strokeKey]: strokeValue } }]
        : [],
    ),
    edges: edges.flatMap((edge) =>
      edge.style?.[edgeKey] !== edgeValue ? [{ id: edge.id, style: { [edgeKey]: edgeValue } }] : [],
    ),
  }
}

function normalizedPropertyValue(
  command: Extract<CanvasPropertyCommand, { property: 'lineColor' | 'lineWidth' | 'lineOpacity' }>,
): number | string {
  if (command.property === 'lineColor') {
    if (command.value.length === 0) throw new TypeError('Canvas line color cannot be empty')
    return command.value
  }
  if (!Number.isFinite(command.value)) throw new TypeError('Canvas property value must be finite')
  if (command.property === 'lineWidth') return Math.min(99, Math.max(1, command.value))
  return Math.min(100, Math.max(0, command.value))
}
