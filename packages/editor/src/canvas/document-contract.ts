import * as Y from 'yjs'
import {
  createCanvasEdgeMap,
  createCanvasNodeMap,
  getCanvasDocumentMaps,
  readCanvasEdgeMap,
  readCanvasNodeMap,
} from './document-crdt'
import { parseCanvasEdgeStyle, parseCanvasEdgeType } from './edge'
import { parseCanvasEmbedNodeData } from './embed-node-data'
import { parseCanvasPoint2D } from './geometry'
import { hasOnlyKeys, isFiniteNumber, isRecord } from './parser-primitives'
import { parseCanvasStrokeNodeData } from './stroke-node-data'
import { canvasSurfaceStyleKeys, parseCanvasSurfaceStyles } from './surface-style'
import { parseCanvasTextDocument } from './text/model'
import type { CanvasTextDocument } from './text/model'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import { DOMAIN_ID_KIND, parseDomainId } from '../resources/domain-id'
import type { CanvasNodeId } from '../resources/domain-id'

export interface CanvasStrokeNodeData {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity?: number
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface CanvasEmbedNodeData {
  destination?: AuthoredDestination
  lockedAspectRatio?: number
  textColor?: string | null
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export interface CanvasTextNodeData {
  content?: CanvasTextDocument
  textColor?: string | null
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export type CanvasNodeType = 'embed' | 'stroke' | 'text'
export type CanvasEdgeType = 'bezier' | 'straight' | 'step'

function parseCanvasNodeType(value: unknown): CanvasNodeType | null {
  return value === 'embed' || value === 'stroke' || value === 'text' ? value : null
}

const textDataKeys = new Set(['content', ...canvasSurfaceStyleKeys])

function parseCanvasTextNodeData(value: unknown): CanvasTextNodeData | null {
  if (!isRecord(value) || !hasOnlyKeys(value, textDataKeys)) return null

  const data: CanvasTextNodeData = {}
  if (value.content !== undefined) {
    const content = parseCanvasTextDocument(value.content)
    if (!content) return null
    data.content = content
  }
  const styles = parseCanvasSurfaceStyles(value)
  return styles ? { ...data, ...styles } : null
}

function parseCanvasNodeDataByType(type: 'embed', value: unknown): CanvasEmbedNodeData | null
function parseCanvasNodeDataByType(type: 'stroke', value: unknown): CanvasStrokeNodeData | null
function parseCanvasNodeDataByType(type: 'text', value: unknown): CanvasTextNodeData | null
function parseCanvasNodeDataByType(
  type: CanvasNodeType,
  value: unknown,
): CanvasEmbedNodeData | CanvasStrokeNodeData | CanvasTextNodeData | null
function parseCanvasNodeDataByType(type: CanvasNodeType, value: unknown) {
  switch (type) {
    case 'embed':
      return parseCanvasEmbedNodeData(value)
    case 'stroke':
      return parseCanvasStrokeNodeData(value)
    case 'text':
      return parseCanvasTextNodeData(value)
  }
}

interface CanvasDocumentPoint {
  x: number
  y: number
}

interface CanvasDocumentNodeBase<TType extends CanvasNodeType, TData> {
  id: CanvasNodeId
  type: TType
  position: CanvasDocumentPoint
  data: TData
  width?: number
  height?: number
  hidden?: boolean
  zIndex?: number
}

export type CanvasEmbedDocumentNode = CanvasDocumentNodeBase<'embed', CanvasEmbedNodeData>
export type CanvasStrokeDocumentNode = CanvasDocumentNodeBase<'stroke', CanvasStrokeNodeData>
export type CanvasTextDocumentNode = CanvasDocumentNodeBase<'text', CanvasTextNodeData>

export type CanvasDocumentNode =
  | CanvasEmbedDocumentNode
  | CanvasStrokeDocumentNode
  | CanvasTextDocumentNode

export interface CanvasEdgeStyle {
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

export interface CanvasDocumentEdge {
  id: string
  source: CanvasNodeId
  target: CanvasNodeId
  type: CanvasEdgeType
  sourceHandle?: string | null
  targetHandle?: string | null
  style?: CanvasEdgeStyle
  hidden?: boolean
  zIndex?: number
}

export function stripEphemeralCanvasNodeState(node: CanvasDocumentNode): CanvasDocumentNode
export function stripEphemeralCanvasNodeState(node: unknown): unknown
export function stripEphemeralCanvasNodeState(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return node
  }

  const {
    selected: _selected,
    draggable: _draggable,
    dragging: _dragging,
    resizing: _resizing,
    ...documentNode
  } = node as Record<string, unknown>
  return documentNode
}

function hasValidSharedDocumentFields(value: Record<string, unknown>): boolean {
  return (
    (value.hidden === undefined || typeof value.hidden === 'boolean') &&
    (value.zIndex === undefined || isFiniteNumber(value.zIndex))
  )
}

function pickSharedDocumentFields(value: Record<string, unknown>) {
  return {
    ...(value.hidden !== undefined ? { hidden: value.hidden as boolean } : {}),
    ...(value.zIndex !== undefined ? { zIndex: value.zIndex as number } : {}),
  }
}

const documentNodeKeys = new Set([
  'id',
  'type',
  'position',
  'data',
  'width',
  'height',
  'hidden',
  'zIndex',
])

function hasValidOptionalNodeFields(value: Record<string, unknown>): boolean {
  return (
    hasValidSharedDocumentFields(value) &&
    (value.width === undefined || (isFiniteNumber(value.width) && value.width >= 0)) &&
    (value.height === undefined || (isFiniteNumber(value.height) && value.height >= 0))
  )
}

function pickCanvasDocumentNodeFields(value: Record<string, unknown>) {
  return {
    ...(value.width !== undefined ? { width: value.width as number } : {}),
    ...(value.height !== undefined ? { height: value.height as number } : {}),
    ...pickSharedDocumentFields(value),
  }
}

export function parseCanvasDocumentNode(value: unknown): CanvasDocumentNode | null {
  if (!isRecord(value) || !hasOnlyKeys(value, documentNodeKeys)) return null
  if (typeof value.id !== 'string') return null
  const id = parseDomainId(DOMAIN_ID_KIND.canvasNode, value.id)
  if (!id) return null

  const type = parseCanvasNodeType(value.type)
  const position = parseCanvasPoint2D(value.position)
  if (!type || !position) return null

  const data = parseCanvasNodeDataByType(type, value.data)
  if (!data) return null
  if (!hasValidOptionalNodeFields(value)) return null

  return {
    id,
    type,
    position,
    data,
    ...pickCanvasDocumentNodeFields(value),
  } as CanvasDocumentNode
}

export function normalizeCanvasDocumentNode(value: unknown): CanvasDocumentNode | null {
  return parseCanvasDocumentNode(stripEphemeralCanvasNodeState(value))
}

const documentEdgeKeys = new Set([
  'id',
  'source',
  'target',
  'type',
  'sourceHandle',
  'targetHandle',
  'style',
  'hidden',
  'zIndex',
])

function hasValidOptionalEdgeFields(value: Record<string, unknown>): boolean {
  return (
    hasValidSharedDocumentFields(value) &&
    (value.sourceHandle === undefined ||
      value.sourceHandle === null ||
      typeof value.sourceHandle === 'string') &&
    (value.targetHandle === undefined ||
      value.targetHandle === null ||
      typeof value.targetHandle === 'string')
  )
}

function pickCanvasDocumentEdgeFields(value: Record<string, unknown>) {
  return {
    ...(value.sourceHandle !== undefined
      ? { sourceHandle: value.sourceHandle as string | null }
      : {}),
    ...(value.targetHandle !== undefined
      ? { targetHandle: value.targetHandle as string | null }
      : {}),
    ...pickSharedDocumentFields(value),
  }
}

export function parseCanvasDocumentEdge(value: unknown): CanvasDocumentEdge | null {
  if (!isRecord(value) || !hasOnlyKeys(value, documentEdgeKeys)) return null
  if (typeof value.id !== 'string' || value.id.trim().length === 0) return null
  if (typeof value.source !== 'string' || typeof value.target !== 'string') return null
  const source = parseDomainId(DOMAIN_ID_KIND.canvasNode, value.source)
  const target = parseDomainId(DOMAIN_ID_KIND.canvasNode, value.target)
  if (!source || !target) return null

  const type = parseCanvasEdgeType(value.type)
  if (!type) return null
  if (!hasValidOptionalEdgeFields(value)) return null

  let style: CanvasEdgeStyle | undefined
  if (value.style !== undefined) {
    const parsedStyle = parseCanvasEdgeStyle(value.style)
    if (!parsedStyle) return null
    style = parsedStyle
  }

  return {
    id: value.id,
    source,
    target,
    type,
    ...pickCanvasDocumentEdgeFields(value),
    ...(style !== undefined ? { style } : {}),
  }
}

export function normalizeCanvasDocumentEdge(value: unknown): CanvasDocumentEdge | null {
  return parseCanvasDocumentEdge(value)
}

export interface CanvasDocumentContent {
  edges: ReadonlyArray<CanvasDocumentEdge>
  nodes: ReadonlyArray<CanvasDocumentNode>
}

const CANVAS_DOCUMENT_INIT_ORIGIN = 'canvas-document-init'

export function createCanvasDocumentDoc(content: CanvasDocumentContent): Y.Doc {
  const doc = new Y.Doc()
  const { edgesMap, nodesMap } = getCanvasDocumentMaps(doc)
  doc.transact(() => {
    content.nodes.forEach((node) => nodesMap.set(node.id, createCanvasNodeMap(node)))
    content.edges.forEach((edge) => edgesMap.set(edge.id, createCanvasEdgeMap(edge)))
  }, CANVAS_DOCUMENT_INIT_ORIGIN)
  return doc
}

export function readCanvasDocumentContent(doc: Y.Doc): {
  edges: Array<CanvasDocumentEdge>
  nodes: Array<CanvasDocumentNode>
} {
  const content = parseCanvasDocumentEntries(doc)
  if (!content) throw new TypeError('Canvas document content is invalid')
  return { edges: [...content.edges], nodes: [...content.nodes] }
}

export function parseCanvasDocumentContent(doc: Y.Doc): CanvasDocumentContent | null {
  const content = parseCanvasDocumentEntries(doc)
  if (!content) return null
  const nodeIds = new Set(content.nodes.map((node) => node.id))
  if (content.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
    return null
  }
  return content
}

export function canonicalizeCanvasDocumentContent(
  doc: Y.Doc,
  origin?: unknown,
): CanvasDocumentContent | null {
  const content = parseCanvasDocumentEntries(doc)
  if (!content) return null
  const nodeIds = new Set(content.nodes.map((node) => node.id))
  const danglingEdgeIds: Array<string> = []
  const edges: Array<CanvasDocumentEdge> = []
  for (const edge of content.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      danglingEdgeIds.push(edge.id)
    } else {
      edges.push(edge)
    }
  }
  if (danglingEdgeIds.length === 0) return content

  const { edgesMap } = getCanvasDocumentMaps(doc)
  doc.transact(() => danglingEdgeIds.forEach((edgeId) => edgesMap.delete(edgeId)), origin)
  return { nodes: content.nodes, edges }
}

function parseCanvasDocumentEntries(doc: Y.Doc): CanvasDocumentContent | null {
  const { edgesMap, nodesMap } = getCanvasDocumentMaps(doc)
  const nodes = Array.from(nodesMap.entries(), ([key, value]) => {
    return parseCanvasDocumentNode(readCanvasNodeMap(key, value))
  })
  const edges = Array.from(edgesMap.entries(), ([key, value]) => {
    return parseCanvasDocumentEdge(readCanvasEdgeMap(key, value))
  })
  if (nodes.some((node) => node === null) || edges.some((edge) => edge === null)) return null
  return {
    nodes: nodes as Array<CanvasDocumentNode>,
    edges: edges as Array<CanvasDocumentEdge>,
  }
}
