import { createEmptyCanvasRichTextContent } from './shared/canvas-rich-text-editor'
import {
  bindCanvasNodeSurfaceBorderPaintProperty,
  bindCanvasNodeSurfaceBorderWidthProperty,
  bindCanvasNodeSurfaceFillProperty,
  bindCanvasNodeTextColorProperty,
  normalizeCanvasNodeSurfaceStyleData,
} from './shared/canvas-node-surface-style'
import { clampStrokeNodeSize, resizeStrokeNode } from './stroke/stroke-node-model'
import {
  strokeNodeContainsPoint,
  strokeNodeIntersectsPolygon,
  strokeNodeIntersectsRect,
} from './stroke/stroke-node-interactions'
import { TEXT_NODE_DEFAULT_HEIGHT, TEXT_NODE_DEFAULT_WIDTH } from './text/text-node-constants'
import {
  freehandStrokeSizeCanvasProperty,
  linePaintCanvasProperty,
} from '../properties/canvas-property-definitions'
import {
  EMPTY_CANVAS_INSPECTABLE_PROPERTIES,
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../properties/canvas-property-types'
import { polygonIntersectsBounds, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type { CanvasNodeCreateArgs, CanvasNodeDataByType } from './canvas-node-types'
import { parseCanvasDocumentNode } from 'convex/canvases/validation'
import type {
  CanvasDocumentNode,
  CanvasEmbedDocumentNode,
  CanvasNodeType,
  CanvasStrokeDocumentNode,
  CanvasTextDocumentNode,
} from 'convex/canvases/validation'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { CanvasPosition } from '~/features/canvas/types/canvas-domain-types'
import { assertNever } from '~/shared/utils/utils'
import { normalizeCanvasNode } from './canvas-node-normalization'
import type { AnyNormalizedCanvasNode } from './canvas-node-normalization'

const DEFAULT_EMBED_SIZE = { width: 320, height: 240 } as const
const DEFAULT_TEXT_SIZE = {
  width: TEXT_NODE_DEFAULT_WIDTH,
  height: TEXT_NODE_DEFAULT_HEIGHT,
} as const
export type CanvasNodeDataPatch<TType extends CanvasNodeType = CanvasNodeType> = Partial<{
  [TKey in keyof CanvasNodeDataByType[TType]]: CanvasNodeDataByType[TType][TKey] | null
}>

type PatchCanvasNodeData = <TType extends CanvasNodeType>(
  nodeId: string,
  data: CanvasNodeDataPatch<TType>,
) => void
type CanvasNodePropertyOptions = { includeTextColor?: boolean; includeFill?: boolean }
type CanvasDocumentNodeByType<TType extends CanvasNodeType> = {
  embed: CanvasEmbedDocumentNode
  stroke: CanvasStrokeDocumentNode
  text: CanvasTextDocumentNode
}[TType]

function getStrokeNodeProperties(
  node: Extract<AnyNormalizedCanvasNode, { type: 'stroke' }>,
  patchNodeData: PatchCanvasNodeData,
  _options?: { includeTextColor?: boolean },
): CanvasInspectableProperties {
  return {
    bindings: [
      bindCanvasPaintProperty(linePaintCanvasProperty, {
        getColor: () => node.data.color,
        setValue: ({ color, opacity }) =>
          patchNodeData(node.id, {
            color: validateColor(color, node.data.color),
            opacity: validateOpacity(opacity, node.data.opacity ?? 100),
          }),
        setColor: (color) =>
          patchNodeData(node.id, {
            color: validateColor(color, node.data.color),
          }),
        getOpacity: () => node.data.opacity ?? 100,
        setOpacity: (opacity) =>
          patchNodeData(node.id, {
            opacity: validateOpacity(opacity, node.data.opacity ?? 100),
          }),
      }),
      bindCanvasStrokeSizeProperty(
        freehandStrokeSizeCanvasProperty,
        () => clampStrokeNodeSize(node.data.size),
        (size) => patchNodeData(node.id, { size: clampStrokeNodeSize(size) }),
      ),
    ],
  }
}

function validateColor(color: unknown, fallback: string) {
  return typeof color === 'string' && color.length > 0 ? color : fallback
}

function validateOpacity(opacity: number | undefined, fallback: number) {
  if (opacity === undefined || !Number.isFinite(opacity)) {
    return fallback
  }

  return Math.max(0, Math.min(100, opacity))
}

function getSurfaceNodeProperties(
  node: Extract<AnyNormalizedCanvasNode, { type: 'embed' | 'text' }>,
  patchNodeData: PatchCanvasNodeData,
  options: CanvasNodePropertyOptions = {},
): CanvasInspectableProperties {
  const textColorBindings = options.includeTextColor
    ? [bindCanvasNodeTextColorProperty(node, patchNodeData)]
    : []
  const fillBindings =
    options.includeFill === false ? [] : [bindCanvasNodeSurfaceFillProperty(node, patchNodeData)]

  return {
    bindings: [
      ...textColorBindings,
      ...fillBindings,
      bindCanvasNodeSurfaceBorderPaintProperty(node, patchNodeData),
      bindCanvasNodeSurfaceBorderWidthProperty(node, patchNodeData),
    ],
  }
}

export function getCanvasNodeInspectableProperties(
  normalizedNode: AnyNormalizedCanvasNode | null,
  patchNodeData: PatchCanvasNodeData,
  options: { includeTextColor?: boolean } = {},
): CanvasInspectableProperties {
  if (!normalizedNode) {
    return EMPTY_CANVAS_INSPECTABLE_PROPERTIES
  }

  switch (normalizedNode.type) {
    case 'embed':
      return getSurfaceNodeProperties(normalizedNode, patchNodeData, {
        ...options,
        includeFill: false,
      })
    case 'stroke':
      return getStrokeNodeProperties(normalizedNode, patchNodeData)
    case 'text':
      return getSurfaceNodeProperties(normalizedNode, patchNodeData, {
        ...options,
        includeTextColor: options.includeTextColor ?? true,
      })
    default:
      return assertNever(normalizedNode)
  }
}

function getDefaultCanvasNodeSize(type: CanvasNodeType): { width: number; height: number } | null {
  switch (type) {
    case 'embed':
      return DEFAULT_EMBED_SIZE
    case 'stroke':
      return null
    case 'text':
      return DEFAULT_TEXT_SIZE
    default:
      return assertNever(type)
  }
}

function getCanvasNodePlacementBehavior(type: CanvasNodeType) {
  switch (type) {
    case 'embed':
      return {
        anchor: 'top-left',
        selectOnCreate: false,
        startEditingOnCreate: false,
      } as const
    case 'stroke':
      return null
    case 'text':
      return {
        anchor: 'center',
        selectOnCreate: true,
        startEditingOnCreate: true,
      } as const
    default:
      return assertNever(type)
  }
}

function createDefaultCanvasNodeData(type: CanvasNodeType): CanvasNodeDataPatch | null {
  switch (type) {
    case 'embed':
      return { ...normalizeCanvasNodeSurfaceStyleData(undefined) }
    case 'stroke':
      return null
    case 'text':
      return {
        ...normalizeCanvasNodeSurfaceStyleData(undefined),
        content: createEmptyCanvasRichTextContent(),
      }
    default:
      return assertNever(type)
  }
}

export function createCanvasNodePlacement<TType extends CanvasNodeType>(
  type: TType,
  args: CanvasNodeCreateArgs<TType>,
): { node: CanvasDocumentNodeByType<TType>; selectOnCreate: boolean; startEditing: boolean }
export function createCanvasNodePlacement(
  type: CanvasNodeType,
  args: CanvasNodeCreateArgs,
): { node: CanvasDocumentNode; selectOnCreate: boolean; startEditing: boolean } {
  const resolvedSize = args.size ?? getDefaultCanvasNodeSize(type)
  if (!resolvedSize) {
    throw new Error(`Missing default canvas node size for "${type}"`)
  }

  const placement = getCanvasNodePlacementBehavior(type)
  const position =
    placement?.anchor === 'center'
      ? {
          x: args.position.x - resolvedSize.width / 2,
          y: args.position.y - resolvedSize.height / 2,
        }
      : args.position
  const defaultData = createDefaultCanvasNodeData(type)
  const mergedData =
    defaultData && args.data ? { ...defaultData, ...args.data } : (args.data ?? defaultData)
  const data = mergedData ?? null
  if (!data) {
    throw new Error(`Missing default canvas node data for "${type}"`)
  }

  const node = parseCanvasDocumentNode({
    id: crypto.randomUUID(),
    type,
    position,
    width: resolvedSize.width,
    height: resolvedSize.height,
    data,
  })
  if (!node) {
    throw new Error(`Invalid default canvas node data for "${type}"`)
  }

  return {
    node,
    selectOnCreate: placement?.selectOnCreate ?? false,
    startEditing: placement?.startEditingOnCreate ?? false,
  }
}

export { normalizeCanvasNode }

export function resizeCanvasNode(
  node: CanvasDocumentNode,
  resize: { width: number; height: number; position: CanvasPosition },
): CanvasDocumentNode {
  const normalizedNode = normalizeCanvasNode(node)
  if (normalizedNode?.type === 'stroke') {
    return resizeStrokeNode(normalizedNode, resize)
  }

  return { ...node, ...resize }
}

export function matchesCanvasNodePointSelection(
  node: AnyNormalizedCanvasNode,
  point: { x: number; y: number },
  context: { zoom: number },
): boolean {
  switch (node.type) {
    case 'embed':
    case 'text':
      return pointInBounds(point, getNormalizedCanvasNodeBounds(node))
    case 'stroke':
      return strokeNodeContainsPoint(node, point, context.zoom)
    default:
      return assertNever(node)
  }
}

export function matchesCanvasNodeRectangleSelection(
  node: AnyNormalizedCanvasNode,
  rect: { x: number; y: number; width: number; height: number },
  context: { zoom: number },
): boolean {
  switch (node.type) {
    case 'embed':
    case 'text':
      return rectIntersectsBounds(rect, getNormalizedCanvasNodeBounds(node))
    case 'stroke':
      return strokeNodeIntersectsRect(node, rect, context.zoom)
    default:
      return assertNever(node)
  }
}

export function matchesCanvasNodeLassoSelection(
  node: AnyNormalizedCanvasNode,
  polygon: ReadonlyArray<{ x: number; y: number }>,
  _context: { zoom: number },
): boolean {
  switch (node.type) {
    case 'embed':
    case 'text':
      return polygonIntersectsBounds(polygon, getNormalizedCanvasNodeBounds(node))
    case 'stroke':
      return strokeNodeIntersectsPolygon(node, polygon)
    default:
      return assertNever(node)
  }
}

function getNormalizedCanvasNodeBounds(
  node: Extract<AnyNormalizedCanvasNode, { type: 'embed' | 'text' }>,
) {
  if (typeof node.width !== 'number' || typeof node.height !== 'number') {
    throw new Error(`Missing bounds for canvas node "${node.id}"`)
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width: node.width,
    height: node.height,
  }
}

function pointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
) {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}
