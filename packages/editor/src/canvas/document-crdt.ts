import * as Y from 'yjs'
import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'
import type { CanvasDocumentEdgeUpdate, CanvasDocumentNodeUpdate } from './document-controller'

const CANVAS_DOCUMENT_NODES_MAP = 'nodes'
const CANVAS_DOCUMENT_EDGES_MAP = 'edges'
const NO_NESTED_FIELDS = new Set<string>()
const NODE_NESTED_FIELDS = new Set(['position', 'data'])
const EDGE_NESTED_FIELDS = new Set(['style'])
const NODE_DATA_NESTED_FIELDS = new Set(['bounds'])

interface CanvasDocumentMaps {
  edgesMap: Y.Map<Y.Map<unknown>>
  nodesMap: Y.Map<Y.Map<unknown>>
}

export function getCanvasDocumentMaps(doc: Y.Doc): CanvasDocumentMaps {
  return {
    edgesMap: doc.getMap<Y.Map<unknown>>(CANVAS_DOCUMENT_EDGES_MAP),
    nodesMap: doc.getMap<Y.Map<unknown>>(CANVAS_DOCUMENT_NODES_MAP),
  }
}

export function createCanvasNodeMap(node: CanvasDocumentNode): Y.Map<unknown> {
  const fields = new Y.Map<unknown>()
  fields.set('type', node.type)
  fields.set('position', createSharedMap(node.position))
  fields.set('data', createNodeDataMap(node))
  setPresentFields(fields, node, ['width', 'height', 'hidden', 'zIndex'])
  return fields
}

export function createCanvasEdgeMap(edge: CanvasDocumentEdge): Y.Map<unknown> {
  const fields = new Y.Map<unknown>()
  fields.set('source', edge.source)
  fields.set('target', edge.target)
  fields.set('type', edge.type)
  setPresentFields(fields, edge, ['sourceHandle', 'targetHandle', 'hidden', 'zIndex'])
  if (edge.style !== undefined) fields.set('style', createSharedMap(edge.style))
  return fields
}

export function readCanvasNodeMap(id: string, value: unknown): unknown {
  if (!(value instanceof Y.Map) || value.has('id')) return null
  const fields = readSharedMap(value, NODE_NESTED_FIELDS)
  if (!fields) return null
  const position = readFlatSharedMap(fields.position)
  const data = readNodeDataMap(fields.data)
  if (!position || !data) return null
  return { ...fields, id, position, data }
}

export function readCanvasEdgeMap(id: string, value: unknown): unknown {
  if (!(value instanceof Y.Map) || value.has('id')) return null
  const fields = readSharedMap(value, EDGE_NESTED_FIELDS)
  if (!fields) return null
  if (fields.style !== undefined) {
    const style = readFlatSharedMap(fields.style)
    if (!style) return null
    fields.style = style
  }
  return { ...fields, id }
}

export function applyCanvasNodeUpdate(
  fields: Y.Map<unknown>,
  update: CanvasDocumentNodeUpdate,
): void {
  if (update.position !== undefined) {
    applySharedMap(requireSharedMap(fields, 'position'), update.position)
  }
  if (update.data !== undefined) {
    const data = requireSharedMap(fields, 'data')
    for (const [key, value] of Object.entries(update.data)) {
      if (key === 'bounds' && value !== undefined) {
        applySharedMap(requireSharedMap(data, 'bounds'), value)
      } else {
        setOptional(data, key, value)
      }
    }
  }
  applyOptionalFields(fields, update, ['width', 'height', 'hidden', 'zIndex'])
}

export function applyCanvasEdgeUpdate(
  fields: Y.Map<unknown>,
  update: CanvasDocumentEdgeUpdate,
): void {
  applyOptionalFields(fields, update, [
    'source',
    'target',
    'type',
    'sourceHandle',
    'targetHandle',
    'hidden',
    'zIndex',
  ])
  if (Object.hasOwn(update, 'style')) {
    if (update.style === undefined) {
      fields.delete('style')
    } else {
      const style = fields.get('style')
      if (style === undefined) {
        fields.set('style', createSharedMap(update.style))
      } else if (style instanceof Y.Map) {
        applySharedMap(style, update.style)
      } else {
        throw new TypeError('Canvas edge style has invalid CRDT storage')
      }
    }
  }
}

function createNodeDataMap(node: CanvasDocumentNode): Y.Map<unknown> {
  const data = createSharedMap(node.data)
  if (node.type === 'stroke') data.set('bounds', createSharedMap(node.data.bounds))
  return data
}

function createSharedMap(value: Readonly<object>): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined) map.set(key, field)
  }
  return map
}

function readSharedMap(
  value: unknown,
  nestedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!(value instanceof Y.Map)) return null
  const result: Record<string, unknown> = {}
  for (const [key, field] of value) {
    if (nestedKeys.has(key)) {
      if (!(field instanceof Y.Map)) return null
    } else if (field instanceof Y.AbstractType) {
      return null
    }
    result[key] = field
  }
  return result
}

function readFlatSharedMap(value: unknown): Record<string, unknown> | null {
  return readSharedMap(value, NO_NESTED_FIELDS)
}

function readNodeDataMap(value: unknown): Record<string, unknown> | null {
  const data = readSharedMap(value, NODE_DATA_NESTED_FIELDS)
  if (!data) return null
  if (data.bounds !== undefined) {
    const bounds = readFlatSharedMap(data.bounds)
    if (!bounds) return null
    data.bounds = bounds
  }
  return data
}

function requireSharedMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const value = parent.get(key)
  if (!(value instanceof Y.Map)) throw new TypeError(`Canvas ${key} has invalid CRDT storage`)
  return value
}

function applySharedMap(target: Y.Map<unknown>, update: Readonly<object>): void {
  for (const [key, value] of Object.entries(update)) setOptional(target, key, value)
}

function applyOptionalFields<TValue extends object>(
  target: Y.Map<unknown>,
  update: TValue,
  keys: ReadonlyArray<keyof TValue>,
): void {
  for (const key of keys) {
    if (Object.hasOwn(update, key)) setOptional(target, String(key), update[key])
  }
}

function setPresentFields<TValue extends object>(
  target: Y.Map<unknown>,
  value: TValue,
  keys: ReadonlyArray<keyof TValue>,
): void {
  for (const key of keys) {
    const field = value[key]
    if (field !== undefined) target.set(String(key), field)
  }
}

function setOptional(target: Y.Map<unknown>, key: string, value: unknown): void {
  if (value === undefined) target.delete(key)
  else target.set(key, value)
}
