import { createEmptyCanvasTextContent } from '../text/editor'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { normalizeCanvasNodeSurfaceStyleData } from '../node-surface-style'
import type { CanvasNormalizedNodeSurfaceStyleData } from '../node-surface-style'
import { clampStrokeNodeSize, resizeStrokeNode } from './stroke/stroke-node-model'
import {
  strokeNodeIntersectsPolygon,
  strokeNodeIntersectsRect,
} from './stroke/stroke-node-interactions'
import { TEXT_NODE_DEFAULT_HEIGHT, TEXT_NODE_DEFAULT_WIDTH } from './text/text-node-constants'
import { resolveEmbedNodeDefaultSize } from '../embed-node-size'
import {
  fillCanvasProperty,
  freehandStrokeSizeCanvasProperty,
  linePaintCanvasProperty,
  strokeSizeCanvasProperty,
  textColorCanvasProperty,
} from '../properties/canvas-property-definitions'
import {
  EMPTY_CANVAS_INSPECTABLE_PROPERTIES,
  bindCanvasPaintProperty,
  bindCanvasStrokeSizeProperty,
} from '../properties/canvas-property-types'
import { polygonIntersectsBounds, rectIntersectsBounds } from '../utils/canvas-geometry-utils'
import type { CanvasNodeCreateArgs, CanvasNodeDataByType } from './canvas-node-types'
import type { CanvasInspectableProperties } from '../properties/canvas-property-types'
import type { CanvasPosition } from '../types/canvas-domain-types'
import { normalizeCanvasNode } from './canvas-node-normalization'
import { getCanvasNodeBounds } from './shared/canvas-node-bounds'
import type { AnyNormalizedCanvasNode } from './canvas-node-normalization'
import { parseCanvasDocumentNode } from '../document-contract'
import type {
  CanvasDocumentNode,
  CanvasEmbedDocumentNode,
  CanvasNodeType,
  CanvasStrokeDocumentNode,
  CanvasTextDocumentNode,
} from '../document-contract'

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

function validateColor(color: unknown, fallback: string | null) {
  return typeof color === 'string' && color.length > 0 ? color : fallback
}

function validateOpacity(opacity: number | undefined, fallback: number) {
  if (opacity === undefined || !Number.isFinite(opacity)) {
    return fallback
  }

  return Math.max(0, Math.min(100, opacity))
}

function bindCanvasNodeSurfaceFillProperty<TData extends CanvasNormalizedNodeSurfaceStyleData>(
  node: { id: string; data: TData },
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasPaintProperty(fillCanvasProperty, {
    getColor: () => node.data.backgroundColor,
    setValue: ({ color: backgroundColor, opacity: backgroundOpacity }) =>
      patchNodeData(node.id, {
        backgroundColor: validateColor(backgroundColor, node.data.backgroundColor),
        backgroundOpacity: validateOpacity(backgroundOpacity, node.data.backgroundOpacity),
      } as Partial<TData>),
    setColor: (backgroundColor) =>
      patchNodeData(node.id, {
        backgroundColor: validateColor(backgroundColor, node.data.backgroundColor),
      } as Partial<TData>),
    getOpacity: () => node.data.backgroundOpacity,
    setOpacity: (backgroundOpacity) =>
      patchNodeData(node.id, {
        backgroundOpacity: validateOpacity(backgroundOpacity, node.data.backgroundOpacity),
      } as Partial<TData>),
  })
}

function bindCanvasNodeTextColorProperty<TData extends CanvasNormalizedNodeSurfaceStyleData>(
  node: { id: string; data: TData },
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasPaintProperty(textColorCanvasProperty, {
    getColor: () => node.data.textColor,
    setValue: ({ color: textColor }) =>
      patchNodeData(node.id, {
        textColor: validateColor(textColor, node.data.textColor),
      } as Partial<TData>),
    setColor: (textColor) =>
      patchNodeData(node.id, {
        textColor: validateColor(textColor, node.data.textColor),
      } as Partial<TData>),
  })
}

function bindCanvasNodeSurfaceBorderPaintProperty<
  TData extends CanvasNormalizedNodeSurfaceStyleData,
>(
  node: { id: string; data: TData },
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasPaintProperty(linePaintCanvasProperty, {
    getColor: () => node.data.borderStroke,
    setValue: ({ color: borderStroke, opacity: borderOpacity }) =>
      patchNodeData(node.id, {
        borderStroke: validateColor(borderStroke, node.data.borderStroke),
        borderOpacity: validateOpacity(borderOpacity, node.data.borderOpacity),
      } as Partial<TData>),
    setColor: (borderStroke) =>
      patchNodeData(node.id, {
        borderStroke: validateColor(borderStroke, node.data.borderStroke),
      } as Partial<TData>),
    getOpacity: () => node.data.borderOpacity,
    setOpacity: (borderOpacity) =>
      patchNodeData(node.id, {
        borderOpacity: validateOpacity(borderOpacity, node.data.borderOpacity),
      } as Partial<TData>),
  })
}

function bindCanvasNodeSurfaceBorderWidthProperty<
  TData extends CanvasNormalizedNodeSurfaceStyleData,
>(
  node: { id: string; data: TData },
  patchNodeData: <TPatch extends Partial<TData>>(nodeId: string, data: TPatch) => void,
) {
  return bindCanvasStrokeSizeProperty(
    strokeSizeCanvasProperty,
    () => node.data.borderWidth,
    (borderWidth) =>
      patchNodeData(node.id, { borderWidth: clampStrokeNodeSize(borderWidth) } as Partial<TData>),
  )
}

function getSurfaceNodeProperties(
  node: Extract<AnyNormalizedCanvasNode, { type: 'embed' | 'text' }>,
  patchNodeData: PatchCanvasNodeData,
  options: CanvasNodePropertyOptions = {},
): CanvasInspectableProperties {
  const patchSurfaceNodeData = <TPatch extends Partial<CanvasNormalizedNodeSurfaceStyleData>>(
    nodeId: string,
    data: TPatch,
  ) => {
    patchNodeData(nodeId, data as CanvasNodeDataPatch)
  }
  const textColorBindings = options.includeTextColor
    ? [
        bindCanvasNodeTextColorProperty<CanvasNormalizedNodeSurfaceStyleData>(
          node,
          patchSurfaceNodeData,
        ),
      ]
    : []
  const fillBindings =
    options.includeFill === false
      ? []
      : [
          bindCanvasNodeSurfaceFillProperty<CanvasNormalizedNodeSurfaceStyleData>(
            node,
            patchSurfaceNodeData,
          ),
        ]

  return {
    bindings: [
      ...textColorBindings,
      ...fillBindings,
      bindCanvasNodeSurfaceBorderPaintProperty<CanvasNormalizedNodeSurfaceStyleData>(
        node,
        patchSurfaceNodeData,
      ),
      bindCanvasNodeSurfaceBorderWidthProperty<CanvasNormalizedNodeSurfaceStyleData>(
        node,
        patchSurfaceNodeData,
      ),
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

function getDefaultCanvasNodeSize(
  type: CanvasNodeType,
  data: CanvasNodeDataPatch | null,
): { width: number; height: number } | null {
  switch (type) {
    case 'embed':
      return resolveEmbedNodeDefaultSize(getCanvasNodeDataLockedAspectRatio(data))
    case 'stroke':
      return null
    case 'text':
      return DEFAULT_TEXT_SIZE
    default:
      return assertNever(type)
  }
}

function getCanvasNodeDataLockedAspectRatio(data: CanvasNodeDataPatch | null): number | null {
  const lockedAspectRatio = data && 'lockedAspectRatio' in data ? data.lockedAspectRatio : null
  return isValidLockedAspectRatio(lockedAspectRatio) ? lockedAspectRatio : null
}

function isValidLockedAspectRatio(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
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
        content: createEmptyCanvasTextContent(),
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
  const defaultData = createDefaultCanvasNodeData(type)
  const mergedData =
    defaultData && args.data ? { ...defaultData, ...args.data } : (args.data ?? defaultData)
  const data = mergedData ?? null
  if (!data) {
    throw new Error(`Missing default canvas node data for "${type}"`)
  }
  const normalizedData = normalizeCanvasNodeCreateData(type, data)

  const resolvedSize = args.size ?? getDefaultCanvasNodeSize(type, normalizedData)
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

  const node = parseCanvasDocumentNode({
    id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
    type,
    position,
    width: resolvedSize.width,
    height: resolvedSize.height,
    data: normalizedData,
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

export function matchesCanvasNodeRectangleSelection(
  node: AnyNormalizedCanvasNode,
  rect: { x: number; y: number; width: number; height: number },
  context: { zoom: number },
): boolean {
  switch (node.type) {
    case 'embed':
    case 'text': {
      const bounds = getNormalizedCanvasNodeBounds(node)
      return bounds ? rectIntersectsBounds(rect, bounds) : false
    }
    case 'stroke':
      return strokeNodeIntersectsRect(node, rect, context.zoom)
    default:
      return assertNever(node)
  }
}

export function matchesCanvasNodeLassoSelection(
  node: AnyNormalizedCanvasNode,
  polygon: ReadonlyArray<{ x: number; y: number }>,
  context: { zoom: number },
): boolean {
  switch (node.type) {
    case 'embed':
    case 'text': {
      const bounds = getNormalizedCanvasNodeBounds(node)
      return bounds ? polygonIntersectsBounds(polygon, bounds) : false
    }
    case 'stroke':
      return strokeNodeIntersectsPolygon(node, polygon, context.zoom)
    default:
      return assertNever(node)
  }
}

function getNormalizedCanvasNodeBounds(
  node: Extract<AnyNormalizedCanvasNode, { type: 'embed' | 'text' }>,
) {
  return getCanvasNodeBounds(node)
}

function normalizeCanvasNodeCreateData(
  type: CanvasNodeType,
  data: CanvasNodeDataPatch,
): CanvasNodeDataPatch {
  if (type !== 'embed' || !('lockedAspectRatio' in data)) {
    return data
  }

  if (isValidLockedAspectRatio(data.lockedAspectRatio)) {
    return data
  }

  const { lockedAspectRatio: _lockedAspectRatio, ...rest } = data
  return rest as CanvasNodeDataPatch
}

function assertNever(value: never): never {
  throw new Error(`Unexpected canvas node value: ${String(value)}`)
}
