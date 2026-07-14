import * as Y from 'yjs'
import { parseCanvasEdgeStyle, parseCanvasEdgeType } from './edge'
import { parseCanvasEmbedNodeData } from './embed-node-data'
import { parseCanvasPoint2D } from './geometry'
import { hasOnlyKeys, isFiniteNumber, isRecord } from './parser-primitives'
import { parseCanvasStrokeNodeData } from './stroke-node-data'
import { canvasSurfaceStyleKeys, parseCanvasSurfaceStyles } from './surface-style'
import { parseCanvasTextDocument } from './text/model'
import type { CanvasTextDocument } from './text/model'
import type { EmbedTarget } from '../../../../shared/embeds/embedTargets'

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
  target?: EmbedTarget
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
  id: string
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
  source: string
  target: string
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

function isNonEmptyDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
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
  if (!isNonEmptyDocumentId(value.id)) return null

  const type = parseCanvasNodeType(value.type)
  const position = parseCanvasPoint2D(value.position)
  if (!type || !position) return null

  const data = parseCanvasNodeDataByType(type, value.data)
  if (!data) return null
  if (!hasValidOptionalNodeFields(value)) return null

  return {
    id: value.id,
    type,
    position,
    data,
    ...pickCanvasDocumentNodeFields(value),
  } as CanvasDocumentNode
}

export function normalizeCanvasDocumentNode(value: unknown): CanvasDocumentNode | null {
  return parseCanvasDocumentNode(
    stripLegacyCanvasRendererFields(stripEphemeralCanvasNodeState(value)),
  )
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
  if (
    !isNonEmptyDocumentId(value.id) ||
    !isNonEmptyDocumentId(value.source) ||
    !isNonEmptyDocumentId(value.target)
  ) {
    return null
  }

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
    source: value.source,
    target: value.target,
    type,
    ...pickCanvasDocumentEdgeFields(value),
    ...(style !== undefined ? { style } : {}),
  }
}

export function normalizeCanvasDocumentEdge(value: unknown): CanvasDocumentEdge | null {
  return parseCanvasDocumentEdge(stripLegacyCanvasRendererFields(value))
}

function stripLegacyCanvasRendererFields(value: unknown): unknown {
  if (!isRecord(value) || !('className' in value)) return value

  const { className: _className, ...documentValue } = value
  return documentValue
}

export interface CanvasDocumentContent {
  edges: ReadonlyArray<CanvasDocumentEdge>
  nodes: ReadonlyArray<CanvasDocumentNode>
}

export interface CanvasDocumentMaps {
  edgesMap: Y.Map<CanvasDocumentEdge>
  nodesMap: Y.Map<CanvasDocumentNode>
}

const CANVAS_DOCUMENT_INIT_ORIGIN = 'canvas-document-init'
const CANVAS_DOCUMENT_NODES_MAP = 'nodes'
const CANVAS_DOCUMENT_EDGES_MAP = 'edges'

export function getCanvasDocumentMaps(doc: Y.Doc): CanvasDocumentMaps {
  return {
    edgesMap: doc.getMap<CanvasDocumentEdge>(CANVAS_DOCUMENT_EDGES_MAP),
    nodesMap: doc.getMap<CanvasDocumentNode>(CANVAS_DOCUMENT_NODES_MAP),
  }
}

export function createCanvasDocumentDoc(content: CanvasDocumentContent): Y.Doc {
  const doc = new Y.Doc()
  const { edgesMap, nodesMap } = getCanvasDocumentMaps(doc)
  doc.transact(() => {
    content.nodes.forEach((node) => nodesMap.set(node.id, node))
    content.edges.forEach((edge) => edgesMap.set(edge.id, edge))
  }, CANVAS_DOCUMENT_INIT_ORIGIN)
  return doc
}

export function readCanvasDocumentContent(doc: Y.Doc): {
  edges: Array<CanvasDocumentEdge>
  nodes: Array<CanvasDocumentNode>
} {
  const { edgesMap, nodesMap } = getCanvasDocumentMaps(doc)
  return {
    edges: Array.from(edgesMap.values()),
    nodes: Array.from(nodesMap.values()),
  }
}
