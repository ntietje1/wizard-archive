import { embedNodeContextMenuContributors } from './embed/embed-node-context-menu'
import { createEmptyCanvasRichTextContent } from './shared/canvas-rich-text-editor'
import {
  bindCanvasNodeSurfaceBorderPaintProperty,
  bindCanvasNodeSurfaceBorderWidthProperty,
  bindCanvasNodeSurfaceFillProperty,
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
import type {
  CanvasNodeCreateArgs,
  CanvasNodeDataByType,
  CanvasNodePlacementBehavior,
} from './canvas-node-types'
import { parseCanvasDocumentNode } from 'convex/canvases/validation'
import type {
  CanvasEmbedDocumentNode,
  CanvasStrokeDocumentNode,
  CanvasTextDocumentNode,
} from 'convex/canvases/validation'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { CanvasContextMenuContributor } from '../runtime/context-menu/canvas-context-menu-types'
import type {
  CanvasDocumentNode,
  CanvasNodeType,
  CanvasPosition,
} from '~/features/canvas/types/canvas-domain-types'
import { assertNever } from '~/shared/utils/utils'
import { normalizeCanvasNode } from './canvas-node-normalization'
import type { AnyNormalizedCanvasNode } from './canvas-node-normalization'

const DEFAULT_EMBED_SIZE = { width: 320, height: 240 } as const
const DEFAULT_TEXT_SIZE = {
  width: TEXT_NODE_DEFAULT_WIDTH,
  height: TEXT_NODE_DEFAULT_HEIGHT,
} as const
const EMPTY_CONTEXT_MENU_CONTRIBUTORS: ReadonlyArray<CanvasContextMenuContributor> = []
export type CanvasNodeDataPatch<TType extends CanvasNodeType = CanvasNodeType> = Partial<{
  [TKey in keyof CanvasNodeDataByType[TType]]: CanvasNodeDataByType[TType][TKey] | null
}>

type PatchCanvasNodeData = <TType extends CanvasNodeType>(
  nodeId: string,
  data: CanvasNodeDataPatch<TType>,
) => void
type CanvasDocumentNodeByType<TType extends CanvasNodeType> = {
  embed: CanvasEmbedDocumentNode
  stroke: CanvasStrokeDocumentNode
  text: CanvasTextDocumentNode
}[TType]

function withNormalizedCanvasNode<TResult>(
  node: CanvasDocumentNode,
  onNode: (node: AnyNormalizedCanvasNode) => TResult,
  onInvalid: () => TResult,
): TResult {
  const normalizedNode = normalizeCanvasNode(node)
  return normalizedNode ? onNode(normalizedNode) : onInvalid()
}

function getStrokeNodeProperties(
  node: Extract<AnyNormalizedCanvasNode, { type: 'stroke' }>,
  patchNodeData: PatchCanvasNodeData,
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
): CanvasInspectableProperties {
  return {
    bindings: [
      bindCanvasNodeSurfaceFillProperty(node, patchNodeData),
      bindCanvasNodeSurfaceBorderPaintProperty(node, patchNodeData),
      bindCanvasNodeSurfaceBorderWidthProperty(node, patchNodeData),
    ],
  }
}

type CanvasNodeSpec<TType extends CanvasNodeType = CanvasNodeType> = {
  placement: CanvasNodePlacementBehavior | null
  defaultSize: { width: number; height: number } | null
  createDefaultData: () => CanvasNodeDataPatch<TType> | null
  contextMenuContributors: ReadonlyArray<CanvasContextMenuContributor>
  getProperties?: (
    node: Extract<AnyNormalizedCanvasNode, { type: TType }>,
    patchNodeData: PatchCanvasNodeData,
  ) => CanvasInspectableProperties
  resize?: (
    node: Extract<AnyNormalizedCanvasNode, { type: TType }>,
    resize: { width: number; height: number; position: CanvasPosition },
  ) => CanvasDocumentNode
}

export const canvasNodeSpecs = {
  embed: {
    placement: {
      anchor: 'top-left',
      selectOnCreate: false,
      startEditingOnCreate: false,
    },
    defaultSize: DEFAULT_EMBED_SIZE,
    createDefaultData: () => ({ ...normalizeCanvasNodeSurfaceStyleData(undefined) }),
    contextMenuContributors: embedNodeContextMenuContributors,
    getProperties: getSurfaceNodeProperties,
    resize: undefined,
  },
  stroke: {
    placement: null,
    defaultSize: null,
    createDefaultData: () => null,
    contextMenuContributors: EMPTY_CONTEXT_MENU_CONTRIBUTORS,
    getProperties: getStrokeNodeProperties,
    resize: resizeStrokeNode,
  },
  text: {
    placement: {
      anchor: 'center',
      selectOnCreate: true,
      startEditingOnCreate: true,
    },
    defaultSize: DEFAULT_TEXT_SIZE,
    createDefaultData: () => ({
      ...normalizeCanvasNodeSurfaceStyleData(undefined),
      content: createEmptyCanvasRichTextContent(),
    }),
    contextMenuContributors: EMPTY_CONTEXT_MENU_CONTRIBUTORS,
    getProperties: getSurfaceNodeProperties,
    resize: undefined,
  },
} as const satisfies { [TType in CanvasNodeType]: CanvasNodeSpec<TType> }

export function getCanvasNodeInspectableProperties(
  normalizedNode: AnyNormalizedCanvasNode | null,
  patchNodeData: PatchCanvasNodeData,
): CanvasInspectableProperties {
  if (!normalizedNode) {
    return EMPTY_CANVAS_INSPECTABLE_PROPERTIES
  }

  const getProperties = canvasNodeSpecs[normalizedNode.type].getProperties
  return getProperties
    ? getProperties(normalizedNode as never, patchNodeData)
    : EMPTY_CANVAS_INSPECTABLE_PROPERTIES
}

export function createCanvasNodePlacement<TType extends CanvasNodeType>(
  type: TType,
  args: CanvasNodeCreateArgs<TType>,
): { node: CanvasDocumentNodeByType<TType>; selectOnCreate: boolean; startEditing: boolean }
export function createCanvasNodePlacement(
  type: CanvasNodeType,
  args: CanvasNodeCreateArgs,
): { node: CanvasDocumentNode; selectOnCreate: boolean; startEditing: boolean } {
  const spec = canvasNodeSpecs[type]
  const resolvedSize = args.size ?? spec.defaultSize
  if (!resolvedSize) {
    throw new Error(`Missing default canvas node size for "${type}"`)
  }

  const placement = spec.placement
  const position =
    placement?.anchor === 'center'
      ? {
          x: args.position.x - resolvedSize.width / 2,
          y: args.position.y - resolvedSize.height / 2,
        }
      : args.position
  const defaultData = spec.createDefaultData()
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
export type { AnyNormalizedCanvasNode }

export function resizeCanvasNode(
  node: CanvasDocumentNode,
  resize: { width: number; height: number; position: CanvasPosition },
): CanvasDocumentNode {
  return withNormalizedCanvasNode(
    node,
    (normalizedNode) =>
      canvasNodeSpecs[normalizedNode.type].resize?.(normalizedNode as never, resize) ?? {
        ...node,
        ...resize,
      },
    () => ({ ...node, ...resize }),
  )
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
