import type { Id } from '../_generated/dataModel'
import { canvasPartialBlockNoteDocumentSchema } from '../blocks/blockSchemas'
import { logger } from '../common/logger'
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

export interface CanvasViewportValue {
  x: number
  y: number
  zoom: number
}

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
  sidebarItemId?: Id<'sidebarItems'>
  lockedAspectRatio?: number
  backgroundColor?: string | null
  backgroundOpacity?: number
  borderStroke?: string | null
  borderOpacity?: number
  borderWidth?: number
}

export interface CanvasTextNodeData {
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

export type ParsedCanvasResizingAwarenessState = Record<string, ParsedCanvasResizeAwarenessEntry>
export type ParsedCanvasRichTextContent = z.infer<typeof canvasPartialBlockNoteDocumentSchema>
export type CanvasNodeType = 'embed' | 'stroke' | 'text'
export type CanvasEdgeType = 'bezier' | 'straight' | 'step'

interface CanvasDocumentNodeBase<TType extends CanvasNodeType, TData> {
  id: string
  type: TType
  position: ParsedCanvasPoint2D
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

export const canvasViewportSchema = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  zoom: finiteNumberSchema,
})

const canvasSurfaceStylingSchema = {
  backgroundColor: canvasNodeSurfaceColorSchema.optional(),
  backgroundOpacity: canvasNodeSurfaceOpacitySchema.optional(),
  borderStroke: canvasNodeSurfaceColorSchema.optional(),
  borderOpacity: canvasNodeSurfaceOpacitySchema.optional(),
  borderWidth: canvasNodeBorderWidthSchema.optional(),
} as const

export const canvasEmbedNodeDataSchema: z.ZodType<CanvasEmbedNodeData> = z
  .object({
    sidebarItemId: canvasSidebarItemIdSchema.optional(),
    lockedAspectRatio: canvasLockedAspectRatioSchema.optional(),
    ...canvasSurfaceStylingSchema,
  })
  .strict()

export const canvasTextNodeDataSchema: z.ZodType<CanvasTextNodeData> = z
  .object({
    content: z.unknown().optional(),
    ...canvasSurfaceStylingSchema,
  })
  .strict()

export const canvasStrokeNodeDataSchema: z.ZodType<CanvasStrokeNodeData> = z
  .object({
    points: z.array(canvasPointSchema).min(1),
    color: z.string(),
    size: finiteNumberSchema,
    opacity: canvasNodeSurfaceOpacitySchema.optional(),
    bounds: canvasBoundsSchema,
  })
  .strict()

const canvasDocumentNodeBaseSchema = z
  .object({
    id: z.string(),
    position: canvasPositionSchema,
    width: finiteNumberSchema.optional(),
    height: finiteNumberSchema.optional(),
    hidden: z.boolean().optional(),
    zIndex: finiteNumberSchema.optional(),
    className: z.string().optional(),
  })
  .strict()

export const canvasDocumentNodeSchema: z.ZodType<CanvasDocumentNode> = z.discriminatedUnion(
  'type',
  [
    canvasDocumentNodeBaseSchema.extend({
      type: z.literal('embed'),
      data: canvasEmbedNodeDataSchema,
    }),
    canvasDocumentNodeBaseSchema.extend({
      type: z.literal('stroke'),
      data: canvasStrokeNodeDataSchema,
    }),
    canvasDocumentNodeBaseSchema.extend({
      type: z.literal('text'),
      data: canvasTextNodeDataSchema,
    }),
  ],
)

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

const canvasDocumentEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: canvasEdgeTypeSchema,
    sourceHandle: z.union([z.string(), z.null()]).optional(),
    targetHandle: z.union([z.string(), z.null()]).optional(),
    style: z.unknown().optional(),
    hidden: z.boolean().optional(),
    zIndex: finiteNumberSchema.optional(),
    className: z.string().optional(),
  })
  .strict()

export function parseCanvasViewport(value: unknown): CanvasViewportValue | null {
  const result = canvasViewportSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasDocumentNode(value: unknown): CanvasDocumentNode | null {
  const result = canvasDocumentNodeSchema.safeParse(value)
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

export function parseCanvasStrokeNodeData(value: unknown): CanvasStrokeNodeData | null {
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

export function parseCanvasEmbedNodeData(value: unknown): CanvasEmbedNodeData | null {
  const result = canvasEmbedNodeDataSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasTextNodeData(value: unknown): CanvasTextNodeData | null {
  const result = canvasTextNodeDataSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasNodeType(value: unknown): CanvasNodeType | null {
  const result = canvasNodeTypeSchema.safeParse(value)
  return result.success ? result.data : null
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

export function parseCanvasDocumentNodes(value: unknown): Array<CanvasDocumentNode> | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((node, index) => {
    const parsedNode = parseCanvasDocumentNode(node)
    if (parsedNode) {
      return [parsedNode]
    }

    logger.warn('parseCanvasDocumentNodes: dropped malformed canvas document node', {
      index,
      nodeId: getCanvasNodeLogField(node, 'id'),
      nodeType: getCanvasNodeLogField(node, 'type'),
    })
    return []
  })
}

function getCanvasNodeLogField(node: unknown, field: 'id' | 'type'): unknown {
  if (!node || typeof node !== 'object') {
    return undefined
  }

  return (node as Record<string, unknown>)[field]
}

export function parseCanvasEdgeType(value: unknown): CanvasEdgeType | null {
  const result = canvasEdgeTypeSchema.safeParse(value)
  return result.success ? result.data : null
}

export function parseCanvasEdgeStyle(value: unknown): CanvasEdgeStyle | null {
  const result = z
    .object({
      stroke: z.string().min(1).optional(),
      strokeWidth: finiteNumberSchema.min(0).optional(),
      // SVG edge opacity is a CSS alpha value, unlike node surface opacity stored on a 0-100 UI scale.
      opacity: finiteNumberSchema.transform((opacity) => clampNumber(opacity, 0, 1)).optional(),
    })
    .strict()
    .safeParse(value)

  return result.success ? result.data : null
}

export function parseCanvasDocumentEdge(value: unknown): CanvasDocumentEdge | null {
  const result = canvasDocumentEdgeSchema.safeParse(value)
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

export function parseCanvasDocumentEdges(value: unknown): Array<CanvasDocumentEdge> | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value.flatMap((edge) => {
    const parsedEdge = parseCanvasDocumentEdge(edge)
    return parsedEdge ? [parsedEdge] : []
  })
}
