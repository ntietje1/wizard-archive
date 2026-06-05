import { parseCanvasRichTextDocument } from 'shared/editor-blocks/blockSchemas'
import type {
  CanvasEdgeStyle,
  CanvasEdgeType,
  CanvasEmbedNodeData,
  CanvasNodeType,
  CanvasStrokeNodeData,
  CanvasTextNodeData,
} from './canvas-document'

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key))
}

function parsePoint(value: unknown): [number, number, number] | null {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !isFiniteNumber(value[0]) ||
    !isFiniteNumber(value[1]) ||
    !isFiniteNumber(value[2])
  ) {
    return null
  }
  return [value[0], value[1], value[2]]
}

function parsePoints(value: unknown): Array<[number, number, number]> | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const points = value.map(parsePoint)
  return points.every((point) => point !== null)
    ? (points as Array<[number, number, number]>)
    : null
}

const surfaceStyleKeys = new Set([
  'textColor',
  'backgroundColor',
  'backgroundOpacity',
  'borderStroke',
  'borderOpacity',
  'borderWidth',
])

function parseSurfaceStyles(value: Record<string, unknown>): Partial<CanvasEmbedNodeData> | null {
  const styles: Partial<CanvasEmbedNodeData> = {}

  for (const key of surfaceStyleKeys) {
    if (!(key in value)) continue

    switch (key) {
      case 'textColor':
      case 'backgroundColor':
      case 'borderStroke': {
        const color = parseCanvasNodeSurfaceColor(value[key])
        if (color === undefined) return null
        styles[key] = color
        break
      }
      case 'backgroundOpacity':
      case 'borderOpacity': {
        if (!isFiniteNumber(value[key])) return null
        styles[key] = parseCanvasNodeSurfaceOpacity(value[key])
        break
      }
      case 'borderWidth': {
        if (!isFiniteNumber(value[key])) return null
        styles.borderWidth = parseCanvasNodeBorderWidth(value[key])
        break
      }
    }
  }

  return styles
}

interface CanvasViewportValue {
  x: number
  y: number
  zoom: number
}

interface ParsedCanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

interface ParsedCanvasBoundsDimensions {
  width: number
  height: number
}

interface ParsedCanvasStrokeSelectionData {
  points: Array<[number, number, number]>
  size: number
  bounds: ParsedCanvasBounds
}

interface ParsedCanvasPoint2D {
  x: number
  y: number
}

interface ParsedCanvasAwarenessUser {
  name: string
  color: string
}

interface ParsedCanvasResizeAwarenessEntry {
  x: number
  y: number
  width: number
  height: number
}

interface ParsedCanvasDrawAwarenessState {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity: number
}

interface ParsedCanvasSelectAwarenessState {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

interface ParsedCanvasLassoAwarenessState {
  type: 'lasso'
  points: Array<ParsedCanvasPoint2D>
}

interface ParsedCanvasReorderPayload {
  kind: 'reorder'
  direction: 'sendToBack' | 'sendBackward' | 'bringForward' | 'bringToFront'
}

type ParsedCanvasResizingAwarenessState = Record<string, ParsedCanvasResizeAwarenessEntry>

export function parseCanvasViewport(value: unknown): CanvasViewportValue | null {
  if (!isRecord(value)) return null
  const { x, y, zoom } = value
  return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(zoom) ? { x, y, zoom } : null
}

function parseCanvasSidebarItemId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseCanvasLockedAspectRatio(value: unknown): number | undefined {
  return isFiniteNumber(value) && value > 0 ? value : undefined
}

export function parseCanvasNodeSurfaceColor(value: unknown): string | null | undefined {
  return typeof value === 'string' || value === null ? value : undefined
}

export function parseCanvasNodeSurfaceOpacity(value: unknown, fallback = 100): number {
  return isFiniteNumber(value) ? clampNumber(value, 0, 100) : fallback
}

export function parseCanvasNodeBorderWidth(value: unknown, fallback = 1): number {
  return isFiniteNumber(value) ? clampNumber(value, 0, 99) : fallback
}

function parseCanvasBounds(value: unknown): ParsedCanvasBounds | null {
  if (!isRecord(value)) return null
  const { x, y, width, height } = value
  return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height)
    ? { x, y, width, height }
    : null
}

export function parseCanvasBoundsDimensions(value: unknown): ParsedCanvasBoundsDimensions | null {
  if (!isRecord(value)) return null
  const { width, height } = value
  return isFiniteNumber(width) && isFiniteNumber(height) ? { width, height } : null
}

export function parseCanvasStrokeNodeData(value: unknown): CanvasStrokeNodeData | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, new Set(['points', 'color', 'size', 'opacity', 'bounds']))
  ) {
    return null
  }

  const points = parsePoints(value.points)
  const bounds = parseCanvasBounds(value.bounds)
  if (!points || typeof value.color !== 'string' || !isFiniteNumber(value.size) || !bounds) {
    return null
  }
  if (value.opacity !== undefined && !isFiniteNumber(value.opacity)) {
    return null
  }

  return {
    points,
    color: value.color,
    size: value.size,
    ...(value.opacity !== undefined
      ? { opacity: parseCanvasNodeSurfaceOpacity(value.opacity) }
      : {}),
    bounds,
  }
}

export function parseCanvasStrokeSelectionData(
  value: unknown,
): ParsedCanvasStrokeSelectionData | null {
  if (!isRecord(value)) return null
  const points = parsePoints(value.points)
  const bounds = parseCanvasBounds(value.bounds)
  return points && isFiniteNumber(value.size) && bounds
    ? { points, size: value.size, bounds }
    : null
}

export function parseCanvasPoint2D(value: unknown): ParsedCanvasPoint2D | null {
  if (!isRecord(value)) return null
  const { x, y } = value
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : null
}

export function parseCanvasAwarenessUser(value: unknown): ParsedCanvasAwarenessUser | null {
  if (!isRecord(value)) return null
  return typeof value.name === 'string' && typeof value.color === 'string'
    ? { name: value.name, color: value.color }
    : null
}

export function parseCanvasAwarenessPresence(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

export function parseCanvasDrawAwarenessState(
  value: unknown,
): ParsedCanvasDrawAwarenessState | null {
  if (!isRecord(value)) return null
  const points = parsePoints(value.points)
  return points &&
    typeof value.color === 'string' &&
    isFiniteNumber(value.size) &&
    value.size > 0 &&
    isFiniteNumber(value.opacity)
    ? {
        points,
        color: value.color,
        size: value.size,
        opacity: parseCanvasNodeSurfaceOpacity(value.opacity),
      }
    : null
}

export function parseCanvasSelectAwarenessState(
  value: unknown,
): ParsedCanvasSelectAwarenessState | null {
  if (!isRecord(value) || value.type !== 'rect') return null
  const { x, y, width, height } = value
  return isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    width >= 0 &&
    isFiniteNumber(height) &&
    height >= 0
    ? { type: 'rect', x, y, width, height }
    : null
}

export function parseCanvasLassoAwarenessState(
  value: unknown,
): ParsedCanvasLassoAwarenessState | null {
  if (!isRecord(value) || value.type !== 'lasso' || !Array.isArray(value.points)) {
    return null
  }

  const points = value.points.map(parseCanvasPoint2D)
  return points.every((point) => point !== null)
    ? { type: 'lasso', points: points as Array<ParsedCanvasPoint2D> }
    : null
}

export function parseCanvasResizingAwarenessState(
  value: unknown,
): ParsedCanvasResizingAwarenessState | null {
  if (!isRecord(value)) return null

  const entries: ParsedCanvasResizingAwarenessState = {}
  for (const [key, entry] of Object.entries(value)) {
    const parsed = parseCanvasBounds(entry)
    if (!parsed || parsed.width < 0 || parsed.height < 0) {
      return null
    }
    entries[key] = parsed
  }
  return entries
}

export function parseCanvasSelectionAwarenessState(value: unknown): Array<string> | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null
}

export function parseCanvasReorderPayload(value: unknown): ParsedCanvasReorderPayload | null {
  if (!isRecord(value) || value.kind !== 'reorder') return null
  const direction = value.direction
  return direction === 'sendToBack' ||
    direction === 'sendBackward' ||
    direction === 'bringForward' ||
    direction === 'bringToFront'
    ? { kind: 'reorder', direction }
    : null
}

export function parseEmbeddedCanvasStableId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0
    ? value.id
    : undefined
}

const embedDataKeys = new Set(['sidebarItemId', 'lockedAspectRatio', ...surfaceStyleKeys])
const textDataKeys = new Set(['content', ...surfaceStyleKeys])
export function parseCanvasEmbedNodeData(value: unknown): CanvasEmbedNodeData | null {
  if (!isRecord(value) || !hasOnlyKeys(value, embedDataKeys)) return null

  const data: CanvasEmbedNodeData = {}
  if ('sidebarItemId' in value) {
    const sidebarItemId = parseCanvasSidebarItemId(value.sidebarItemId)
    if (sidebarItemId === undefined) return null
    data.sidebarItemId = sidebarItemId
  }
  if ('lockedAspectRatio' in value) {
    const lockedAspectRatio = parseCanvasLockedAspectRatio(value.lockedAspectRatio)
    if (lockedAspectRatio === undefined) return null
    data.lockedAspectRatio = lockedAspectRatio
  }

  const styles = parseSurfaceStyles(value)
  return styles ? { ...data, ...styles } : null
}

function parseCanvasTextNodeData(value: unknown): CanvasTextNodeData | null {
  if (!isRecord(value) || !hasOnlyKeys(value, textDataKeys)) return null

  const data: CanvasTextNodeData = {}
  if (value.content !== undefined) {
    const content = parseCanvasRichTextDocument(value.content)
    if (!content) return null
    data.content = content
  }
  const styles = parseSurfaceStyles(value)
  return styles ? { ...data, ...styles } : null
}

export function parseCanvasNodeType(value: unknown): CanvasNodeType | null {
  return value === 'embed' || value === 'stroke' || value === 'text' ? value : null
}

export function parseCanvasNodeDataByType(type: 'embed', value: unknown): CanvasEmbedNodeData | null
export function parseCanvasNodeDataByType(
  type: 'stroke',
  value: unknown,
): CanvasStrokeNodeData | null
export function parseCanvasNodeDataByType(type: 'text', value: unknown): CanvasTextNodeData | null
export function parseCanvasNodeDataByType(
  type: CanvasNodeType,
  value: unknown,
): CanvasEmbedNodeData | CanvasStrokeNodeData | CanvasTextNodeData | null
export function parseCanvasNodeDataByType(type: CanvasNodeType, value: unknown) {
  switch (type) {
    case 'embed':
      return parseCanvasEmbedNodeData(value)
    case 'stroke':
      return parseCanvasStrokeNodeData(value)
    case 'text':
      return parseCanvasTextNodeData(value)
  }
}

export function parseCanvasEdgeType(value: unknown): CanvasEdgeType | null {
  return value === 'bezier' || value === 'straight' || value === 'step' ? value : null
}

export function parseCanvasEdgeStyle(value: unknown): CanvasEdgeStyle | null {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(['stroke', 'strokeWidth', 'opacity']))) {
    return null
  }
  if (value.stroke !== undefined && (typeof value.stroke !== 'string' || value.stroke.length < 1)) {
    return null
  }
  if (
    value.strokeWidth !== undefined &&
    (!isFiniteNumber(value.strokeWidth) || value.strokeWidth < 0)
  ) {
    return null
  }
  if (value.opacity !== undefined && !isFiniteNumber(value.opacity)) {
    return null
  }

  return {
    ...(value.stroke !== undefined ? { stroke: value.stroke } : {}),
    ...(value.strokeWidth !== undefined ? { strokeWidth: value.strokeWidth } : {}),
    ...(value.opacity !== undefined ? { opacity: clampNumber(value.opacity, 0, 1) } : {}),
  }
}
