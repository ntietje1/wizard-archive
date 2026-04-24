import type { Id } from '../_generated/dataModel'
import { canvasPartialBlockNoteDocumentSchema } from '../blocks/blockSchemas'
import { z } from 'zod'

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const finiteNumberSchema = z.number().finite()
const canvasUnknownRecordSchema = z.object({}).catchall(z.unknown())
const canvasPositionSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
})
const canvasBoundsSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  width: finiteNumberSchema,
  height: finiteNumberSchema,
})
const canvasBoundsDimensionsSchema = z.object({
  width: finiteNumberSchema,
  height: finiteNumberSchema,
})
const canvasPointSchema = z.tuple([finiteNumberSchema, finiteNumberSchema, finiteNumberSchema])
const canvasSidebarItemIdSchema = z
  .string()
  .min(1)
  .transform((value) => value as Id<'sidebarItems'>)
const canvasLockedAspectRatioSchema = finiteNumberSchema.refine((value) => value > 0)
const canvasNodeSurfaceColorSchema = z.union([z.string(), z.null()])
const canvasNodeSurfaceOpacitySchema = finiteNumberSchema.transform((value) =>
  clampNumber(value, 0, 100),
)
const canvasNodeBorderWidthSchema = finiteNumberSchema.transform((value) =>
  clampNumber(value, 0, 99),
)

export interface PersistedCanvasViewportValue {
  x: number
  y: number
  zoom: number
}

export type PersistedCanvasNodeValue = Record<string, unknown> & {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
}

export interface ParsedCanvasStrokeNodeData {
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

export interface ParsedCanvasEmbedNodeData {
  sidebarItemId?: Id<'sidebarItems'>
  lockedAspectRatio?: number
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export interface ParsedCanvasTextNodeData {
  content?: unknown
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export interface ParsedCanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ParsedCanvasBoundsDimensions {
  width: number
  height: number
}

export interface ParsedCanvasStrokeSelectionData {
  points: Array<[number, number, number]>
  size: number
  bounds: ParsedCanvasBounds
}

export interface ParsedCanvasPoint2D {
  x: number
  y: number
}

export interface ParsedCanvasAwarenessUser {
  name: string
  color: string
}

export interface ParsedCanvasResizeAwarenessEntry {
  x: number
  y: number
  width: number
  height: number
}

export interface ParsedCanvasDrawAwarenessState {
  points: Array<[number, number, number]>
  color: string
  size: number
  opacity: number
}

export interface ParsedCanvasSelectAwarenessState {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export interface ParsedCanvasLassoAwarenessState {
  type: 'lasso'
  points: Array<ParsedCanvasPoint2D>
}

export interface ParsedCanvasReorderPayload {
  kind: 'reorder'
  direction: 'sendToBack' | 'sendBackward' | 'bringForward' | 'bringToFront'
}

export type ParsedCanvasDraggingAwarenessState = Record<string, ParsedCanvasPoint2D>
export type ParsedCanvasResizingAwarenessState = Record<string, ParsedCanvasResizeAwarenessEntry>
export type ParsedCanvasRichTextContent = z.infer<typeof canvasPartialBlockNoteDocumentSchema>
export type ParsedCanvasNodeType = 'embed' | 'stroke' | 'text'
export type ParsedCanvasEdgeType = 'bezier' | 'straight' | 'step'

interface ParsedCanvasRuntimeNodeBase<TType extends ParsedCanvasNodeType, TData> {
  id: string
  type: TType
  position: ParsedCanvasPoint2D
  data: TData
  width?: number
  height?: number
}

export type ParsedCanvasRuntimeEmbedNode = ParsedCanvasRuntimeNodeBase<
  'embed',
  ParsedCanvasEmbedNodeData
>
export type ParsedCanvasRuntimeStrokeNode = ParsedCanvasRuntimeNodeBase<
  'stroke',
  ParsedCanvasStrokeNodeData
>
export type ParsedCanvasRuntimeTextNode = ParsedCanvasRuntimeNodeBase<
  'text',
  ParsedCanvasTextNodeData
>

export type ParsedCanvasRuntimeNode =
  | ParsedCanvasRuntimeEmbedNode
  | ParsedCanvasRuntimeStrokeNode
  | ParsedCanvasRuntimeTextNode

export interface ParsedCanvasEdgeStyle {
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

export interface ParsedCanvasRuntimeEdge {
  id: string
  source: string
  target: string
  type: ParsedCanvasEdgeType
  sourceHandle?: string | null
  targetHandle?: string | null
  style?: ParsedCanvasEdgeStyle
}

export const persistedCanvasViewportSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  zoom: finiteNumberSchema,
})

export const persistedCanvasNodeSchema: z.ZodType<PersistedCanvasNodeValue> = z
  .object({
    id: z.string(),
    type: z.string().optional(),
    position: canvasPositionSchema,
    data: canvasUnknownRecordSchema,
    width: finiteNumberSchema.optional(),
    height: finiteNumberSchema.optional(),
  })
  .catchall(z.unknown())

export const canvasStrokeNodeDataSchema: z.ZodType<ParsedCanvasStrokeNodeData> = z
  .object({
    points: z.array(canvasPointSchema).min(1),
    color: z.string(),
    size: finiteNumberSchema,
    opacity: canvasNodeSurfaceOpacitySchema.optional(),
    bounds: canvasBoundsSchema,
  })
  .catchall(z.unknown())

export const canvasBoundsDimensionsOnlySchema: z.ZodType<ParsedCanvasBoundsDimensions> =
  canvasBoundsDimensionsSchema

export const canvasStrokeSelectionDataSchema: z.ZodType<ParsedCanvasStrokeSelectionData> = z
  .object({
    points: z.array(canvasPointSchema).min(1),
    size: finiteNumberSchema,
    bounds: canvasBoundsSchema,
  })
  .catchall(z.unknown())

export const canvasPoint2DSchema: z.ZodType<ParsedCanvasPoint2D> = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
})

export const canvasAwarenessUserSchema: z.ZodType<ParsedCanvasAwarenessUser> = z
  .object({
    name: z.string(),
    color: z.string(),
  })
  .catchall(z.unknown())

export const canvasResizeAwarenessEntrySchema: z.ZodType<ParsedCanvasResizeAwarenessEntry> = z
  .object({
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: finiteNumberSchema.min(0),
    height: finiteNumberSchema.min(0),
  })
  .catchall(z.unknown())

export const canvasDrawAwarenessStateSchema: z.ZodType<ParsedCanvasDrawAwarenessState> = z
  .object({
    points: z.array(canvasPointSchema).min(1),
    color: z.string(),
    size: finiteNumberSchema.positive(),
    opacity: canvasNodeSurfaceOpacitySchema,
  })
  .catchall(z.unknown())

export const canvasSelectAwarenessStateSchema: z.ZodType<ParsedCanvasSelectAwarenessState> = z
  .object({
    type: z.literal('rect'),
    x: finiteNumberSchema,
    y: finiteNumberSchema,
    width: finiteNumberSchema.min(0),
    height: finiteNumberSchema.min(0),
  })
  .catchall(z.unknown())

export const canvasLassoAwarenessStateSchema: z.ZodType<ParsedCanvasLassoAwarenessState> = z
  .object({
    type: z.literal('lasso'),
    points: z.array(canvasPoint2DSchema),
  })
  .catchall(z.unknown())

export const canvasDraggingAwarenessStateSchema: z.ZodType<ParsedCanvasDraggingAwarenessState> =
  z.record(z.string(), canvasPoint2DSchema)

export const canvasResizingAwarenessStateSchema: z.ZodType<ParsedCanvasResizingAwarenessState> =
  z.record(z.string(), canvasResizeAwarenessEntrySchema)

export const canvasSelectionAwarenessStateSchema = z.array(z.string())
export const canvasNodeTypeSchema = z.enum(['embed', 'stroke', 'text'])
export const canvasEdgeTypeSchema = z.enum(['bezier', 'straight', 'step'])
export const canvasReorderPayloadSchema: z.ZodType<ParsedCanvasReorderPayload> = z
  .object({
    kind: z.literal('reorder'),
    direction: z.enum(['sendToBack', 'sendBackward', 'bringForward', 'bringToFront']),
  })
  .catchall(z.unknown())

const embeddedCanvasStableIdSchema = z.object({
  id: z.string().min(1),
})

const canvasRuntimeEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: canvasEdgeTypeSchema,
    sourceHandle: z.union([z.string(), z.null()]).optional(),
    targetHandle: z.union([z.string(), z.null()]).optional(),
    style: z.unknown().optional(),
  })
  .catchall(z.unknown())

export function parsePersistedCanvasViewport(value: unknown): PersistedCanvasViewportValue | null {
  const result = persistedCanvasViewportSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parsePersistedCanvasNode(value: unknown): PersistedCanvasNodeValue | null {
  const result = persistedCanvasNodeSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasSidebarItemId(value: unknown): Id<'sidebarItems'> | undefined {
  const result = canvasSidebarItemIdSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export function parseCanvasLockedAspectRatio(value: unknown): number | undefined {
  const result = canvasLockedAspectRatioSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export function parseCanvasNodeSurfaceColor(value: unknown): string | null | undefined {
  const result = canvasNodeSurfaceColorSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export function parseCanvasNodeSurfaceOpacity(value: unknown, fallback = 100): number {
  const result = canvasNodeSurfaceOpacitySchema.safeParse(value)
  return result.success ? result.data : fallback
}

export function parseCanvasNodeBorderWidth(value: unknown, fallback = 1): number {
  const result = canvasNodeBorderWidthSchema.safeParse(value)
  return result.success ? result.data : fallback
}

export function parseCanvasStrokeNodeData(value: unknown): ParsedCanvasStrokeNodeData | null {
  const result = canvasStrokeNodeDataSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasBounds(value: unknown): ParsedCanvasBounds | null {
  const result = canvasBoundsSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasBoundsDimensions(value: unknown): ParsedCanvasBoundsDimensions | null {
  const result = canvasBoundsDimensionsOnlySchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasStrokeSelectionData(
  value: unknown,
): ParsedCanvasStrokeSelectionData | null {
  const result = canvasStrokeSelectionDataSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasPoint2D(value: unknown): ParsedCanvasPoint2D | null {
  const result = canvasPoint2DSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasAwarenessUser(value: unknown): ParsedCanvasAwarenessUser | null {
  const result = canvasAwarenessUserSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasAwarenessPresence(value: unknown): Record<string, unknown> | null {
  const result = canvasUnknownRecordSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasDrawAwarenessState(
  value: unknown,
): ParsedCanvasDrawAwarenessState | null {
  const result = canvasDrawAwarenessStateSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasSelectAwarenessState(
  value: unknown,
): ParsedCanvasSelectAwarenessState | null {
  const result = canvasSelectAwarenessStateSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasLassoAwarenessState(
  value: unknown,
): ParsedCanvasLassoAwarenessState | null {
  const result = canvasLassoAwarenessStateSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasDraggingAwarenessState(
  value: unknown,
): ParsedCanvasDraggingAwarenessState | null {
  const result = canvasDraggingAwarenessStateSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasResizingAwarenessState(
  value: unknown,
): ParsedCanvasResizingAwarenessState | null {
  const result = canvasResizingAwarenessStateSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasSelectionAwarenessState(value: unknown): Array<string> | null {
  const result = canvasSelectionAwarenessStateSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasReorderPayload(value: unknown): ParsedCanvasReorderPayload | null {
  const result = canvasReorderPayloadSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasRichTextContent(value: unknown): ParsedCanvasRichTextContent | null {
  const result = canvasPartialBlockNoteDocumentSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseEmbeddedCanvasStableId(value: unknown): string | undefined {
  const result = embeddedCanvasStableIdSchema.safeParse(value)
  return result.success ? result.data.id : undefined
}

type ParsedCanvasSurfaceStyling = Pick<
  ParsedCanvasEmbedNodeData,
  'backgroundColor' | 'backgroundOpacity' | 'borderStroke' | 'borderOpacity' | 'borderWidth'
>

function parseCanvasSurfaceStyling(data: Record<string, unknown>): ParsedCanvasSurfaceStyling {
  const backgroundColor = parseCanvasNodeSurfaceColor(data.backgroundColor)
  const backgroundOpacity = finiteNumberSchema.safeParse(data.backgroundOpacity)
  const borderStroke = parseCanvasNodeSurfaceColor(data.borderStroke)
  const borderOpacity = finiteNumberSchema.safeParse(data.borderOpacity)
  const borderWidth = finiteNumberSchema.safeParse(data.borderWidth)

  return {
    ...(backgroundColor !== undefined ? { backgroundColor } : {}),
    ...(backgroundOpacity.success
      ? { backgroundOpacity: clampNumber(backgroundOpacity.data, 0, 100) }
      : {}),
    ...(borderStroke !== undefined ? { borderStroke } : {}),
    ...(borderOpacity.success ? { borderOpacity: clampNumber(borderOpacity.data, 0, 100) } : {}),
    ...(borderWidth.success ? { borderWidth: clampNumber(borderWidth.data, 0, 99) } : {}),
  }
}

export function parseCanvasEmbedNodeData(value: unknown): ParsedCanvasEmbedNodeData | null {
  const result = canvasUnknownRecordSchema.safeParse(value)
  if (!result.success) {
    return null
  }

  const sidebarItemId = parseCanvasSidebarItemId(result.data.sidebarItemId)
  const lockedAspectRatio = parseCanvasLockedAspectRatio(result.data.lockedAspectRatio)

  return {
    ...(sidebarItemId ? { sidebarItemId } : {}),
    ...(lockedAspectRatio ? { lockedAspectRatio } : {}),
    ...parseCanvasSurfaceStyling(result.data),
  }
}

export function parseCanvasTextNodeData(value: unknown): ParsedCanvasTextNodeData | null {
  const result = canvasUnknownRecordSchema.safeParse(value)
  if (!result.success) {
    return null
  }

  return {
    // Content stays lazy at this boundary; callers should use parseCanvasRichTextContent when they
    // need validated rich-text blocks instead of the persisted raw payload.
    ...(result.data.content !== undefined ? { content: result.data.content } : {}),
    ...parseCanvasSurfaceStyling(result.data),
  }
}

export function parseCanvasNodeType(value: unknown): ParsedCanvasNodeType | null {
  const result = canvasNodeTypeSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasNodeDataByType(
  type: 'embed',
  value: unknown,
): ParsedCanvasEmbedNodeData | null
export function parseCanvasNodeDataByType(
  type: 'stroke',
  value: unknown,
): ParsedCanvasStrokeNodeData | null
export function parseCanvasNodeDataByType(
  type: 'text',
  value: unknown,
): ParsedCanvasTextNodeData | null
export function parseCanvasNodeDataByType(
  type: ParsedCanvasNodeType,
  value: unknown,
): ParsedCanvasEmbedNodeData | ParsedCanvasStrokeNodeData | ParsedCanvasTextNodeData | null
export function parseCanvasNodeDataByType(type: ParsedCanvasNodeType, value: unknown) {
  switch (type) {
    case 'embed':
      return parseCanvasEmbedNodeData(value)
    case 'stroke':
      return parseCanvasStrokeNodeData(value)
    case 'text':
      return parseCanvasTextNodeData(value)
  }
}

export function parseCanvasRuntimeNode(value: unknown): ParsedCanvasRuntimeNode | null {
  const recordResult = canvasUnknownRecordSchema.safeParse(value)
  if (!recordResult.success) {
    return null
  }

  const id = z.string().safeParse(recordResult.data.id)
  const type = parseCanvasNodeType(recordResult.data.type)
  const position = parseCanvasPoint2D(recordResult.data.position)

  if (!id.success || !type || !position) {
    return null
  }

  const data = parseCanvasNodeDataByType(type, recordResult.data.data)
  if (!data) {
    return null
  }

  const width = finiteNumberSchema.safeParse(recordResult.data.width)
  const height = finiteNumberSchema.safeParse(recordResult.data.height)

  return {
    id: id.data,
    type,
    position,
    data,
    ...(width.success ? { width: width.data } : {}),
    ...(height.success ? { height: height.data } : {}),
  } as ParsedCanvasRuntimeNode
}

export function parseCanvasRuntimeNodes(value: unknown): Array<ParsedCanvasRuntimeNode> | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((node) => {
    const parsedNode = parseCanvasRuntimeNode(node)
    return parsedNode ? [parsedNode] : []
  })
}

export function parseCanvasEdgeType(value: unknown): ParsedCanvasEdgeType | null {
  const result = canvasEdgeTypeSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasEdgeStyle(value: unknown): ParsedCanvasEdgeStyle | null {
  const result = canvasUnknownRecordSchema.safeParse(value)
  if (!result.success) {
    return null
  }

  const stroke = z.string().min(1).safeParse(result.data.stroke)
  const strokeWidth = finiteNumberSchema.min(0).safeParse(result.data.strokeWidth)
  const opacity = finiteNumberSchema.safeParse(result.data.opacity)

  return {
    ...(stroke.success ? { stroke: stroke.data } : {}),
    ...(strokeWidth.success ? { strokeWidth: strokeWidth.data } : {}),
    ...(opacity.success ? { opacity: clampNumber(opacity.data, 0, 1) } : {}),
  }
}

export function parseCanvasRuntimeEdge(value: unknown): ParsedCanvasRuntimeEdge | null {
  const result = canvasRuntimeEdgeSchema.safeParse(value)
  if (!result.success) {
    return null
  }

  return {
    ...result.data,
    type: result.data.type,
    style:
      result.data.style === undefined ? undefined : (parseCanvasEdgeStyle(result.data.style) ?? {}),
  }
}

export function parseCanvasRuntimeEdges(value: unknown): Array<ParsedCanvasRuntimeEdge> | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((edge) => {
    const parsedEdge = parseCanvasRuntimeEdge(edge)
    return parsedEdge ? [parsedEdge] : []
  })
}
