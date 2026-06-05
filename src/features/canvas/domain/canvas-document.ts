import {
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  parseCanvasEdgeStyle,
  parseCanvasEdgeType,
  parseCanvasNodeDataByType,
  parseCanvasNodeType,
  parseCanvasPoint2D,
} from './validation'
import type { CanvasRichTextDocument } from 'shared/editor-blocks/blockSchemas'

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
  sidebarItemId?: string
  lockedAspectRatio?: number
  textColor?: string | null
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export interface CanvasTextNodeData {
  content?: CanvasRichTextDocument
  textColor?: string | null
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export type CanvasNodeType = 'embed' | 'stroke' | 'text'
export type CanvasEdgeType = 'bezier' | 'straight' | 'step'

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
  className?: string
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
  className?: string
}

function hasValidSharedDocumentFields(value: Record<string, unknown>): boolean {
  return (
    (value.hidden === undefined || typeof value.hidden === 'boolean') &&
    (value.zIndex === undefined || isFiniteNumber(value.zIndex)) &&
    (value.className === undefined || typeof value.className === 'string')
  )
}

function isNonEmptyDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function pickSharedDocumentFields(value: Record<string, unknown>) {
  return {
    ...(value.hidden !== undefined ? { hidden: value.hidden as boolean } : {}),
    ...(value.zIndex !== undefined ? { zIndex: value.zIndex as number } : {}),
    ...(value.className !== undefined ? { className: value.className as string } : {}),
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
  'className',
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
  'className',
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
